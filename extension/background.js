let clientConnected = false;
let clientPort = 8765;
let ws = null;
let currentActivity = null;
let lastSentJson = '';
let updateTimer = null;

const DEFAULT_SETTINGS = {
  showDetailedInfo: true,
  showVideoDuration: true,
  showPageTitle: true,
  showButtons: true,
  showWatchButton: true,
  showChannelButton: true,
  hiddenPages: [],
};
let settings = { ...DEFAULT_SETTINGS };
let iconPrefix = 'icon'; 

function loadSettings() {
  chrome.storage.local.get(['settings', 'clientPort', 'iconPrefix', 'theme'], (r) => {
    if (r.settings) settings = { ...DEFAULT_SETTINGS, ...r.settings };
    if (r.clientPort) clientPort = r.clientPort;
    const THEME_PREFIX = { dark: 'icon', neutral: 'bicon', light: 'wicon', discord: 'bicon' };
    if (r.iconPrefix) {
      iconPrefix = r.iconPrefix;
    } else if (r.theme) {
      iconPrefix = THEME_PREFIX[r.theme] || 'icon';
    }
    connectWS();
  });
}
loadSettings();

chrome.storage.onChanged.addListener((changes) => {
  if (changes.iconPrefix || changes.theme) {
    const THEME_PREFIX = { dark: 'icon', neutral: 'bicon', light: 'wicon', discord: 'bicon' };
    if (changes.iconPrefix?.newValue) {
      iconPrefix = changes.iconPrefix.newValue;
    } else if (changes.theme?.newValue) {
      iconPrefix = THEME_PREFIX[changes.theme.newValue] || 'icon';
    }
    lastSentJson = '';
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs[0]?.id) requestActivity(tabs[0].id, tabs[0]);
    });
  }
});

function saveSettings() {
  chrome.storage.local.set({ settings, clientPort });
}

const activeTabActivities = new Map();
const playingMediaTabs = new Map();
let currentFocusedActiveTabId = null;

function handleTabActivityUpdate(tabId, rawActivity, tab) {
  if (!rawActivity) return;

  if (tab) {
    if (tab.title) {
      const cleanTitle = tab.title.replace(/^\(\d+\)\s*/, '').replace(/ - [^-]+$/, '').trim();
      if (!rawActivity.details || rawActivity.details === 'Watching video' || rawActivity.details === 'Viewing video' || rawActivity.isIframe) {
        const isPlaying = rawActivity.isPlaying === true || (rawActivity.smallImage && rawActivity.smallImage.includes('play'));
        rawActivity.details = isPlaying ? cleanTitle : `${cleanTitle} (Paused)`;
        rawActivity.largeText = cleanTitle;
      }
    }
    if (tab.url) {
      try {
        const hostname = new URL(tab.url).hostname.replace(/^www\./, '');
        if (!rawActivity.state || rawActivity.isIframe) {
          rawActivity.state = hostname;
        }
      } catch {}
    }
  }

  const isMedia = rawActivity.type === 'video' || rawActivity.type === 'music';
  const isPlaying = rawActivity.isPlaying === true || (isMedia && rawActivity.smallImage && rawActivity.smallImage.includes('play'));

  if (isMedia && isPlaying) {
    playingMediaTabs.set(tabId, { activity: rawActivity, tab });
  } else {
    playingMediaTabs.delete(tabId);
  }

  chrome.tabs.query({ active: true, lastFocusedWindow: true }, (activeTabs) => {
    const activeTab = activeTabs[0];
    if (activeTab) {
      currentFocusedActiveTabId = activeTab.id;
      if (activeTab.id === tabId) {
        activeTabActivities.set(tabId, { activity: rawActivity, tab: tab || activeTab });
      }
    }
    evaluateAndDispatchActivity();
  });
}

function evaluateAndDispatchActivity() {
  let targetItem = null;

  if (currentFocusedActiveTabId && activeTabActivities.has(currentFocusedActiveTabId)) {
    targetItem = activeTabActivities.get(currentFocusedActiveTabId);
  }

  const activeIsMedia = targetItem?.activity && (targetItem.activity.type === 'video' || targetItem.activity.type === 'music');
  const activeIsPlaying = targetItem?.activity && (targetItem.activity.isPlaying === true || (activeIsMedia && targetItem.activity.smallImage?.includes('play')));

  if (!activeIsPlaying && playingMediaTabs.size > 0) {
    for (const [tId, item] of playingMediaTabs) {
      if (tId !== currentFocusedActiveTabId && item.activity) {
        targetItem = item;
        break;
      }
    }
  }

  if (targetItem && targetItem.activity) {
    handleActivityUpdate(targetItem.activity, targetItem.tab);
  }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  switch (req.action) {
    case 'updateActivity':
      if (sender.tab) {
        handleTabActivityUpdate(sender.tab.id, req.data, sender.tab);
      } else {
        handleActivityUpdate(req.data);
      }
      sendResponse({ success: true });
      break;
    case 'getCurrentActivity':
      sendResponse({ activity: currentActivity });
      break;
    case 'getSettings':
      sendResponse({ settings, clientPort });
      break;
    case 'updateSettings':
      settings = { ...settings, ...req.settings };
      if (req.clientPort !== undefined) clientPort = req.clientPort;
      saveSettings();
      sendResponse({ success: true });
      break;
    case 'checkClientStatus':
      sendResponse({ connected: clientConnected });
      break;
    case 'connectToClient':
      if (req.port) clientPort = req.port;
      saveSettings();
      connectWS();
      sendResponse({ success: true });
      break;
  }
});

let wsReconnectTimer = null;

function connectWS() {
  if (ws) {
    if (ws.readyState === WebSocket.OPEN) {
      clientConnected = true;
      return;
    }
    if (ws.readyState === WebSocket.CONNECTING) {
      return;
    }
  }

  try {
    ws = new WebSocket(`ws://127.0.0.1:${clientPort}/ws`);
    ws.onopen = () => {
      clientConnected = true;
      console.log('[WebRPC] Connected via WebSocket on port', clientPort);
      lastDeliveredJson = '';
      try { ws.send(JSON.stringify({ type: 'ping' })); } catch {}
      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
        if (tabs[0]?.url && !tabs[0].url.startsWith('chrome://')) {
          requestActivity(tabs[0].id, tabs[0]);
        }
      });
    };
    ws.onclose = () => {
      clientConnected = false;
      ws = null;
      scheduleReconnect();
    };
    ws.onerror = () => {
      clientConnected = false;
      ws = null;
      connectHTTP();
    };
    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'portChanged' && msg.port) {
          clientPort = msg.port;
          saveSettings();
        }
      } catch {}
    };
  } catch {
    ws = null;
    connectHTTP();
  }
}

function scheduleReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(() => connectWS(), 3000);
}

function connectHTTP() {
  fetch(`http://127.0.0.1:${clientPort}/health`, { cache: 'no-store' })
    .then(r => {
      if (r.ok) {
        clientConnected = true;
        if (currentActivity) {
          lastSentJson = '';
          sendToClient(currentActivity);
        }
      }
    })
    .catch(() => {
      clientConnected = false;
    });
}

setInterval(() => {
  if (!clientConnected || !ws || ws.readyState !== WebSocket.OPEN) {
    connectWS();
  }
}, 5000);

function handleActivityUpdate(activity, tab) {
  if (!activity) return;
  if (settings.hiddenPages.some(p => activity.url && activity.url.includes(p))) {
    sendToClient({ type: 'clearActivity' });
    return;
  }
  if (updateTimer) clearTimeout(updateTimer);
  updateTimer = setTimeout(() => processActivity(activity, tab), 100);
}

function isLocal(d) {
  return !d || d === 'localhost' || d === '127.0.0.1' || d === '0.0.0.0'
    || d.startsWith('192.168.') || d.startsWith('10.') || d.startsWith('172.')
    || d.endsWith('.local') || d.endsWith('.localhost')
    || /^\d+\.\d+\.\d+\.\d+$/.test(d);
}

function getSiteFavicon(domain) {
  if (!domain) return 'https://raw.githubusercontent.com/ewinnery/webRPC/main/extension/icons/icon-512.png';
  const d = domain.toLowerCase().replace(/^www\./, '');
  if (d.includes('google.')) return 'https://raw.githubusercontent.com/ewinnery/webRPC/main/docs/google.png';
  if (d.includes('chatgpt.com') || d.includes('openai.com')) return 'https://cdn.openai.com/chatgpt/share-og.png';
  if (d.includes('youtube.com')) return 'https://icon.horse/icon/youtube.com';
  if (d.includes('github.com')) return 'https://icon.horse/icon/github.com';
  const root = d.split('.').slice(-2).join('.');
  return 'https://icon.horse/icon/' + root;
}

function sanitizeImage(url, domain) {
  if (!url || url === 'webrpc' || url === 'icon_globe') return getSiteFavicon(domain);
  if (url.startsWith('data:')) return getSiteFavicon(domain);
  if (!url.startsWith('http://') && !url.startsWith('https://')) return getSiteFavicon(domain);
  const l = url.toLowerCase();
  if (l.endsWith('.ico') || l.includes('.ico?') || l.includes('.ico/')) return getSiteFavicon(domain);
  if (l.endsWith('.svg') || l.includes('.svg?') || l.includes('.svg/')) return getSiteFavicon(domain);
  return url;
}

function cleanStateDomain(st) {
  if (!st) return null;
  let str = String(st).trim();
  if (str.startsWith('http://') || str.startsWith('https://')) {
    try {
      const u = new URL(str);
      return u.hostname.replace(/^www\./, '');
    } catch {
      return str;
    }
  }
  return str.replace(/^www\./, '');
}

function processActivity(activity, tab) {
  let domain = '';
  try { domain = new URL(activity.url).hostname; } catch {}

  let largeImage = activity.largeImage;
  
  if (!largeImage || largeImage === 'icon_globe' || largeImage === 'webrpc') {
    largeImage = getSiteFavicon(domain);
  }

  largeImage = sanitizeImage(largeImage, domain);
  if (!largeImage) largeImage = getSiteFavicon(domain);

  const out = {
    type: activity.type || 'page',
    title: settings.showPageTitle ? (activity.title || 'Browsing') : 'Browsing',
    details: settings.showDetailedInfo ? (activity.details || null) : null,
    state: settings.showDetailedInfo ? cleanStateDomain(activity.state) : null,
    largeImage: largeImage,
    smallImage: applyIconPrefix(activity.smallImage) || null,
    largeText: settings.showPageTitle ? (activity.largeText || null) : null,
    smallText: activity.smallText || null,
    startTimestamp: 0,
    endTimestamp: 0,
    button1Label: null, button1Url: null,
    button2Label: null, button2Url: null,
  };

  if (settings.showVideoDuration && activity.type !== 'page' && activity.timestamps) {
    out.startTimestamp = activity.timestamps.start || 0;
    out.endTimestamp = activity.timestamps.end || 0;
  }

  if (settings.showButtons) {
    if (settings.showWatchButton && activity.videoUrl) {
      out.button1Label = 'Watch Video';
      out.button1Url = activity.videoUrl;
    }
    if (settings.showChannelButton && activity.channelUrl) {
      out.button2Label = 'View Channel';
      out.button2Url = activity.channelUrl;
    }
  }

  currentActivity = out;
  sendToClient(out);
}

function applyIconPrefix(key) {
  if (!key) return null;
  
  if (key.startsWith('icon_')) {
    return iconPrefix + key.slice(4); 
  }
  return key; 
}

function sendToClient(msg) {
  if (!msg) return;
  const json = JSON.stringify(msg);
  console.log('[WebRPC Dispatching]', msg);

  if (ws && ws.readyState === WebSocket.OPEN) {
    try {
      ws.send(json);
      lastSentJson = json;
      clientConnected = true;
      return;
    } catch (e) {
      ws = null;
      clientConnected = false;
    }
  }

  fetch(`http://127.0.0.1:${clientPort}/webrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json,
  })
    .then(r => {
      if (r.ok) {
        clientConnected = true;
        lastSentJson = json;
      }
    })
    .catch(() => {
      clientConnected = false;
      connectWS();
    });
}

function requestActivity(tabId, tab) {
  chrome.tabs.sendMessage(tabId, { action: 'getActivity' }, (r) => {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
        if (chrome.runtime.lastError) return;
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'getActivity' }, (r2) => {
            if (!chrome.runtime.lastError && r2?.activity) handleTabActivityUpdate(tabId, r2.activity, tab);
          });
        }, 150);
      });
      return;
    }
    if (r?.activity) handleTabActivityUpdate(tabId, r.activity, tab);
  });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  if (tab.active) requestActivity(tabId, tab);
});

chrome.tabs.onActivated.addListener((info) => {
  currentFocusedActiveTabId = info.tabId;
  chrome.tabs.get(info.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url || tab.url.startsWith('chrome://')) return;
    requestActivity(tab.id, tab);
  });
});

chrome.windows.onFocusChanged.addListener((wid) => {
  if (wid === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, windowId: wid }, (tabs) => {
    if (tabs[0]?.url && !tabs[0].url.startsWith('chrome://')) {
      currentFocusedActiveTabId = tabs[0].id;
      requestActivity(tabs[0].id, tabs[0]);
    }
  });
});

chrome.tabs.onRemoved.addListener((tabId) => {
  playingMediaTabs.delete(tabId);
  activeTabActivities.delete(tabId);
  if (currentFocusedActiveTabId === tabId) {
    currentFocusedActiveTabId = null;
  }
  evaluateAndDispatchActivity();
});

async function checkExtensionUpdates() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/ewinnery/webRPC/main/version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    
    const manifestVer = chrome.runtime.getManifest().version;
    const currentVer = manifestVer;
    const remoteVer = data.extension_version || data.version || "1.0.2";
    
    if (remoteVer && isNewerVersion(remoteVer, currentVer)) {
      console.log(`[WebRPC Update] New version available: ${remoteVer} (current: ${currentVer})`);
      
      chrome.storage.local.set({
        updateAvailable: true,
        remoteVersion: remoteVer,
        currentVersion: currentVer,
        downloadUrl: data.download_url || 'https://github.com/ewinnery/webRPC/releases/tag/v3',
        exeUrl: data.exe_download_url || 'https://github.com/ewinnery/webRPC/releases/download/v3/webRPC.exe',
        crxUrl: data.crx_download_url || 'https://github.com/ewinnery/webRPC/releases/download/v3/extension.crx'
      });

      chrome.action.setBadgeText({ text: 'NEW' });
      chrome.action.setBadgeBackgroundColor({ color: '#5865F2' });

      if (chrome.notifications) {
        chrome.notifications.create('webrpc-update-prompt', {
          type: 'basic',
          iconUrl: 'icons/icon-128.png',
          title: '⚡ WebRPC Update Available!',
          message: `Version ${remoteVer} is available. Click to download from GitHub!`,
          priority: 2
        });
      }
    } else {
      chrome.storage.local.set({ updateAvailable: false });
      chrome.action.setBadgeText({ text: '' });
    }
  } catch (e) {
    console.error('[WebRPC Update Check Failed]', e);
  }
}

function isNewerVersion(remote, current) {
  const r = remote.split('.').map(Number);
  const c = current.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, c.length); i++) {
    const rv = r[i] || 0;
    const cv = c[i] || 0;
    if (rv > cv) return true;
    if (rv < cv) return false;
  }
  return false;
}

if (chrome.notifications) {
  chrome.notifications.onClicked.addListener((id) => {
    if (id === 'webrpc-update-prompt') {
      chrome.tabs.create({ url: 'https://github.com/ewinnery/webRPC/releases/tag/v2' });
    }
  });
}

checkExtensionUpdates();
setInterval(checkExtensionUpdates, 15 * 60 * 1000);
