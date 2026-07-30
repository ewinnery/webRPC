let settings = {};
let clientConnected = false;
let clientPort = 8765;

document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  loadSettings();
  checkStatus();
  setupTabs();
  setupEvents();
  setupTheme();
  loadActivity();
});

function loadSettings() {
  chrome.runtime.sendMessage({ action: 'getSettings' }, (r) => {
    if (chrome.runtime.lastError || !r) return;
    settings = r.settings || {};
    clientPort = r.clientPort || 8765;
    document.getElementById('clientPort').value = clientPort;
    updateToggles();
    renderHiddenPages();
  });
}

const TOGGLE_IDS = ['showDetailedInfo', 'showPageTitle', 'showVideoDuration', 'showButtons', 'showWatchButton', 'showChannelButton'];

function updateToggles() {
  TOGGLE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = settings[id] !== false;
  });
}

function saveSettings() {
  chrome.runtime.sendMessage({ action: 'updateSettings', settings, clientPort });
}

function loadTheme() {
  chrome.storage.local.get('theme', (r) => {
    applyTheme(r.theme || 'dark');
  });
}

const THEME_ICON_PREFIX = {
  dark: 'icon',       
  neutral: 'bicon',   
  light: 'wicon',     
  discord: 'bicon',   
};

function applyTheme(name) {
  document.body.setAttribute('data-theme', name);
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === name);
  });
}

function setupTheme() {
  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = btn.dataset.theme;
      applyTheme(t);
      const prefix = THEME_ICON_PREFIX[t] || 'icon';
      chrome.storage.local.set({ theme: t, iconPrefix: prefix });
    });
  });
}

function renderHiddenPages() {
  const c = document.getElementById('hiddenPagesList');
  if (!c) return;
  c.innerHTML = '';
  (settings.hiddenPages || []).forEach((url, i) => {
    const d = document.createElement('div');
    d.className = 'hidden-page-item';
    d.innerHTML = `<span class="hidden-page-url">${url}</span><button class="hidden-page-remove" data-i="${i}">&times;</button>`;
    c.appendChild(d);
  });
  c.querySelectorAll('.hidden-page-remove').forEach(b => {
    b.addEventListener('click', (e) => {
      settings.hiddenPages.splice(parseInt(e.target.dataset.i), 1);
      saveSettings(); renderHiddenPages();
    });
  });
}

function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.dataset.tab + 'Tab').classList.add('active');
    });
  });
}

function checkStatus() {
  chrome.runtime.sendMessage({ action: 'checkClientStatus' }, (r) => {
    if (chrome.runtime.lastError) return;
    clientConnected = r?.connected || false;
    updateConnectionUI();
  });
}

function updateConnectionUI() {
  const dl = document.getElementById('downloadSection');
  const main = document.getElementById('mainContent');
  const dot = document.getElementById('headerDot');
  const label = document.getElementById('headerLabel');
  if (clientConnected) {
    dl.style.display = 'none'; main.style.display = 'flex';
    dot.className = 'connection-dot connected'; label.textContent = 'Connected';
  } else {
    dl.style.display = 'flex'; main.style.display = 'none';
    dot.className = 'connection-dot'; label.textContent = 'Offline';
  }
}

function reconnect() {
  const port = parseInt(document.getElementById('clientPort').value);
  const dot = document.getElementById('headerDot');
  const label = document.getElementById('headerLabel');
  const btn = document.getElementById('reconnectBtn');
  dot.className = 'connection-dot connecting'; label.textContent = 'Connecting...';
  if (btn) btn.disabled = true;
  clientPort = port;
  chrome.runtime.sendMessage({ action: 'connectToClient', port }, () => {
    setTimeout(() => { checkStatus(); if (btn) btn.disabled = false; }, 2000);
  });
}

function manualConnect() {
  const status = document.getElementById('downloadStatus');
  status.textContent = 'Connecting...';
  const port = parseInt(document.getElementById('clientPort').value);
  clientPort = port;
  chrome.runtime.sendMessage({ action: 'connectToClient', port }, () => {
    setTimeout(() => { checkStatus(); if (!clientConnected) status.textContent = 'Failed. Is client running?'; }, 2000);
  });
}

function setupEvents() {
  document.getElementById('downloadBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: 'https://github.com/ewinnery/webRPC/releases' });
  });
  document.getElementById('downloadStatus').addEventListener('click', manualConnect);
  document.getElementById('refreshBtn').addEventListener('click', () => {
    document.getElementById('refreshBtn').classList.add('spinning');
    loadActivity();
    setTimeout(() => document.getElementById('refreshBtn').classList.remove('spinning'), 600);
  });

  TOGGLE_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', (e) => { settings[id] = e.target.checked; saveSettings(); });
  });

  document.getElementById('addHiddenPageBtn').addEventListener('click', () => {
    const input = document.getElementById('newHiddenPage');
    const v = input.value.trim();
    if (v) { if (!settings.hiddenPages) settings.hiddenPages = []; settings.hiddenPages.push(v); saveSettings(); renderHiddenPages(); input.value = ''; }
  });
  document.getElementById('newHiddenPage').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') document.getElementById('addHiddenPageBtn').click();
  });

  document.getElementById('reconnectBtn').addEventListener('click', reconnect);
  document.getElementById('clientPort').addEventListener('change', (e) => {
    const p = parseInt(e.target.value);
    if (p >= 1024 && p <= 65535) { clientPort = p; saveSettings(); }
  });
}

function loadActivity() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { action: 'getActivity' }, (r) => {
      if (chrome.runtime.lastError || !r?.activity) {
        displayActivity({ type: 'page', title: tabs[0].title || 'Unknown', details: 'Browsing', state: '', url: tabs[0].url, largeImage: tabs[0].favIconUrl || '' });
        return;
      }
      displayActivity(r.activity);
    });
  });
}

function displayActivity(a) {
  if (!a) return;
  let domain = '';
  try { domain = new URL(a.url).hostname; } catch {}

  document.getElementById('discordName').textContent = a.title || 'Browsing';
  document.getElementById('discordDetails').textContent = a.details || '';
  document.getElementById('discordState').textContent = a.state || '';

  const timeEl = document.getElementById('discordTime');
  if (a.timestamps?.start) {
    const el = Math.floor((Date.now() - a.timestamps.start) / 1000);
    timeEl.textContent = `${Math.floor(el/60).toString().padStart(2,'0')}:${(el%60).toString().padStart(2,'0')} elapsed`;
  } else { timeEl.textContent = ''; }

  const img = document.getElementById('discordLargeImgSrc');
  const fb = document.getElementById('discordLargeFallback');
  if (a.largeImage && !a.largeImage.startsWith('data:')) {
    img.src = a.largeImage; img.style.display = 'block'; fb.style.display = 'none';
    img.onerror = () => { img.style.display = 'none'; fb.style.display = 'flex'; };
  } else { img.style.display = 'none'; fb.style.display = 'flex'; }

  const badge = document.getElementById('activityType');
  badge.textContent = a.type || 'page';
  badge.className = 'activity-type-badge ' + (a.type || 'page');

  document.getElementById('activityTitle').textContent = a.title || 'Unknown';
  document.getElementById('activityDetails').textContent = a.details || '-';
  document.getElementById('activityState').textContent = a.state || '-';
  document.getElementById('activitySite').textContent = domain;

  const dr = document.getElementById('activityDetailsRow');
  const sr = document.getElementById('activityStateRow');
  if (dr) dr.style.display = a.details ? 'flex' : 'none';
  if (sr) sr.style.display = a.state ? 'flex' : 'none';
}

setInterval(checkStatus, 5000);
setInterval(loadActivity, 10000);
