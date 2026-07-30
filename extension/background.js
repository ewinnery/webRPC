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
  if (!domain || isLocal(domain)) return 'webrpc';
  const clean = domain.replace(/^www\./, '');
  return `https://logo.clearbit.com/${clean}`;
}

function sanitizeImage(url, domain) {
  if (!url || url.startsWith('data:')) return getSiteFavicon(domain);
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (url.includes('/') && domain) {
      try { return new URL(url, `https://${domain}`).href; } catch {}
    }
    return getSiteFavicon(domain);
  }
  return url;
}

function processActivity(activity, tab) {
  let domain = '';
  try { domain = new URL(activity.url).hostname; } catch {}

  let largeImage = activity.largeImage;
  if ((!largeImage || largeImage === getSiteFavicon(domain)) && tab?.favIconUrl) {
    if (tab.favIconUrl.startsWith('http')) {
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
