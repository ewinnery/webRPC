let clientConnected = false;
let clientPort = 8765;
let ws = null;
let currentActivity = null;
let lastSentJson = '';

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
  chrome.storage.local.get(['settings', 'clientPort', 'iconPrefix'], (r) => {
    if (r.settings) settings = { ...DEFAULT_SETTINGS, ...r.settings };
    if (r.clientPort) clientPort = r.clientPort;
    if (r.iconPrefix) iconPrefix = r.iconPrefix;
    connectWS();
  });
}
loadSettings();

chrome.storage.onChanged.addListener((changes) => {
  if (changes.iconPrefix) {
    iconPrefix = changes.iconPrefix.newValue || 'icon';
    
    lastSentJson = '';
    if (currentActivity) {
      
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, { action: 'getActivity' }, (r) => {
          if (!chrome.runtime.lastError && r?.activity) {
            processActivity(r.activity);
          }
        });
      });
    }
  }
});

function saveSettings() {
  chrome.storage.local.set({ settings, clientPort });
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  switch (req.action) {
    case 'updateActivity':
      handleActivityUpdate(req.data, sender.tab);
      sendResponse({ success: true });
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
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    ws.close();
  }
  try {
    ws = new WebSocket(`ws://127.0.0.1:${clientPort}/ws`);
    ws.onopen = () => {
      clientConnected = true;
      console.log('WebRPC: WS connected to port', clientPort);
      if (currentActivity) { lastSentJson = ''; sendToClient(currentActivity); }
    };
    ws.onclose = () => {
      clientConnected = false;
      scheduleReconnect();
    };
    ws.onerror = () => {
      clientConnected = false;
      
      connectHTTP();
    };
    ws.onmessage = (e) => {
      
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'portChanged') {
          clientPort = msg.port;
          saveSettings();
        }
      } catch {}
    };
  } catch {
    connectHTTP();
  }
}

function scheduleReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer);
  wsReconnectTimer = setTimeout(() => connectWS(), 5000);
}

function connectHTTP() {
  fetch(`http://127.0.0.1:${clientPort}/health`)
    .then(r => { if (r.ok) { clientConnected = true; } })
    .catch(() => { clientConnected = false; });
}

setInterval(() => {
  if (!clientConnected) connectWS();
}, 15000);

let updateTimer = null;

function handleActivityUpdate(activity, tab) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0] || tabs[0].id !== tab.id) return;
    if (settings.hiddenPages.some(p => activity.url.includes(p))) {
      sendToClient({ type: 'clearActivity' });
      return;
    }
    if (updateTimer) clearTimeout(updateTimer);
    updateTimer = setTimeout(() => processActivity(activity, tabs[0]), 300);
  });
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

function processActivity(activity, tab) {
  let domain = '';
  try { domain = new URL(activity.url).hostname; } catch {}

  let largeImage = activity.largeImage;
  
  if (!largeImage || largeImage === 'icon_globe' || largeImage === 'webrpc' || !largeImage.startsWith('http')) {
    if (tab?.favIconUrl && tab.favIconUrl.startsWith('http')) {
      const l = tab.favIconUrl.toLowerCase();
      if (!l.includes('.svg') && !l.includes('.ico') && !l.includes('data:')) {
        largeImage = tab.favIconUrl;
      }
    }
  }

  largeImage = sanitizeImage(largeImage, domain);
  if (!largeImage) largeImage = getSiteFavicon(domain);

  const out = {
    type: activity.type || 'page',
    title: settings.showPageTitle ? (activity.title || 'Browsing') : 'Browsing',
    details: settings.showDetailedInfo ? (activity.details || null) : null,
    state: settings.showDetailedInfo ? (activity.state || null) : null,
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
  const json = JSON.stringify(msg);
  if (json === lastSentJson) return;
  lastSentJson = json;

  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(json);
    return;
  }

  if (!clientConnected) return;
  fetch(`http://127.0.0.1:${clientPort}/webrpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: json,
  }).catch(() => { clientConnected = false; });
}

function requestActivity(tabId, tab) {
  chrome.tabs.sendMessage(tabId, { action: 'getActivity' }, (r) => {
    if (chrome.runtime.lastError) {
      chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] }, () => {
        if (chrome.runtime.lastError) return;
        setTimeout(() => {
          chrome.tabs.sendMessage(tabId, { action: 'getActivity' }, (r2) => {
            if (!chrome.runtime.lastError && r2?.activity) handleActivityUpdate(r2.activity, tab);
          });
        }, 300);
      });
      return;
    }
    if (r?.activity) handleActivityUpdate(r.activity, tab);
  });
}

chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.status !== 'complete') return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id === tabId) requestActivity(tabId, tab);
  });
});

chrome.tabs.onActivated.addListener((info) => {
  chrome.tabs.get(info.tabId, (tab) => {
    if (chrome.runtime.lastError || !tab?.url || tab.url.startsWith('chrome://')) return;
    requestActivity(tab.id, tab);
  });
});

chrome.windows.onFocusChanged.addListener((wid) => {
  if (wid === chrome.windows.WINDOW_ID_NONE) return;
  chrome.tabs.query({ active: true, windowId: wid }, (tabs) => {
    if (tabs[0]?.url && !tabs[0].url.startsWith('chrome://')) requestActivity(tabs[0].id, tabs[0]);
  });
});

chrome.tabs.onRemoved.addListener(() => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs.length) { sendToClient({ type: 'clearActivity' }); currentActivity = null; lastSentJson = ''; }
  });
});

async function checkExtensionUpdates() {
  try {
    const res = await fetch('https://raw.githubusercontent.com/ewinnery/webRPC/main/version.json?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) return;
    const data = await res.json();
    
    const manifestVer = chrome.runtime.getManifest().version;
    const currentVer = "1.0.0"; // Simulated 1.0.0 for instant update prompt test!
    const remoteVer = data.extension_version || data.version || "1.0.1";
    
    if (remoteVer && isNewerVersion(remoteVer, currentVer)) {
      console.log(`[WebRPC Update] New version available: ${remoteVer} (current: ${currentVer})`);
      
      chrome.storage.local.set({
        updateAvailable: true,
        remoteVersion: remoteVer,
        currentVersion: currentVer,
        downloadUrl: data.download_url || 'https://github.com/ewinnery/webRPC/releases/tag/v2',
        exeUrl: data.exe_download_url || 'https://github.com/ewinnery/webRPC/releases/download/v2/webRPC.exe',
        crxUrl: data.crx_download_url || 'https://github.com/ewinnery/webRPC/releases/download/v2/extension.crx'
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
