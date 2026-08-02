let extensionValid = true;
let currentTitle = document.title;
let sendTimer = null;
let lastVideoState = null;

const DEBOUNCE_PAGE = 150;
const DEBOUNCE_VIDEO = 100;

function isExtensionValid() {
  try { return chrome.runtime && chrome.runtime.id && extensionValid; }
  catch { return false; }
}

function extractDomain(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); }
  catch { return url; }
}

function platformName(url) {
  const d = extractDomain(url);
  const map = {
    'youtube.com': 'YouTube', 'music.youtube.com': 'YouTube Music',
    'twitch.tv': 'Twitch', 'netflix.com': 'Netflix',
    'spotify.com': 'Spotify', 'soundcloud.com': 'SoundCloud',
    'discord.com': 'Discord', 'web.telegram.org': 'Telegram',
    'twitter.com': 'Twitter', 'x.com': 'X',
    'reddit.com': 'Reddit', 'github.com': 'GitHub',
    'vk.com': 'VK', 'bilibili.com': 'Bilibili',
    'crunchyroll.com': 'Crunchyroll', 'disneyplus.com': 'Disney+',
    'primevideo.com': 'Prime Video', 'hulu.com': 'Hulu',
    'kick.com': 'Kick', 'rumble.com': 'Rumble',
    'tiktok.com': 'TikTok', 'instagram.com': 'Instagram',
    'facebook.com': 'Facebook', 'linkedin.com': 'LinkedIn',
    'pinterest.com': 'Pinterest', 'tumblr.com': 'Tumblr',
    'medium.com': 'Medium', 'notion.so': 'Notion',
    'figma.com': 'Figma', 'slack.com': 'Slack',
    'zoom.us': 'Zoom', 'gitlab.com': 'GitLab',
  };
  for (const [k, v] of Object.entries(map)) {
    if (d === k || d.endsWith('.' + k)) return v;
  }
  
  const parts = d.split('.');
  const name = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

const KNOWN_ICONS = {
  'youtube.com': 'https://icon.horse/icon/youtube.com',
  'twitch.tv': 'https://icon.horse/icon/twitch.tv',
  'netflix.com': 'https://icon.horse/icon/netflix.com',
  'disneyplus.com': 'https://icon.horse/icon/disneyplus.com',
  'hulu.com': 'https://icon.horse/icon/hulu.com',
  'primevideo.com': 'https://icon.horse/icon/primevideo.com',
  'crunchyroll.com': 'https://icon.horse/icon/crunchyroll.com',
  'bilibili.com': 'https://icon.horse/icon/bilibili.com',
  'kick.com': 'https://icon.horse/icon/kick.com',
  'rumble.com': 'https://icon.horse/icon/rumble.com',
  'dailymotion.com': 'https://icon.horse/icon/dailymotion.com',
  'vimeo.com': 'https://icon.horse/icon/vimeo.com',
  'plex.tv': 'https://icon.horse/icon/plex.tv',
  'hbomax.com': 'https://icon.horse/icon/hbomax.com',
  'max.com': 'https://icon.horse/icon/max.com',
  'peacocktv.com': 'https://icon.horse/icon/peacocktv.com',
  'paramountplus.com': 'https://icon.horse/icon/paramountplus.com',
  'funimation.com': 'https://icon.horse/icon/funimation.com',
  'ani.me': 'https://icon.horse/icon/ani.me',
  
  'spotify.com': 'https://icon.horse/icon/spotify.com',
  'soundcloud.com': 'https://icon.horse/icon/soundcloud.com',
  'music.apple.com': 'https://icon.horse/icon/apple.com',
  'deezer.com': 'https://icon.horse/icon/deezer.com',
  'tidal.com': 'https://icon.horse/icon/tidal.com',
  'pandora.com': 'https://icon.horse/icon/pandora.com',
  'bandcamp.com': 'https://icon.horse/icon/bandcamp.com',
  
  'discord.com': 'https://icon.horse/icon/discord.com',
  'telegram.org': 'https://icon.horse/icon/telegram.org',
  'twitter.com': 'https://icon.horse/icon/twitter.com',
  'x.com': 'https://icon.horse/icon/x.com',
  'reddit.com': 'https://icon.horse/icon/reddit.com',
  'facebook.com': 'https://icon.horse/icon/facebook.com',
  'instagram.com': 'https://icon.horse/icon/instagram.com',
  'tiktok.com': 'https://icon.horse/icon/tiktok.com',
  'linkedin.com': 'https://icon.horse/icon/linkedin.com',
  'pinterest.com': 'https://icon.horse/icon/pinterest.com',
  'tumblr.com': 'https://icon.horse/icon/tumblr.com',
  'snapchat.com': 'https://icon.horse/icon/snapchat.com',
  'threads.net': 'https://icon.horse/icon/threads.net',
  'mastodon.social': 'https://icon.horse/icon/mastodon.social',
  'bsky.app': 'https://icon.horse/icon/bsky.app',
  'vk.com': 'https://icon.horse/icon/vk.com',
  'ok.ru': 'https://icon.horse/icon/ok.ru',
  
  'whatsapp.com': 'https://icon.horse/icon/whatsapp.com',
  'signal.org': 'https://icon.horse/icon/signal.org',
  'messenger.com': 'https://icon.horse/icon/messenger.com',
  
  'github.com': 'https://icon.horse/icon/github.com',
  'gitlab.com': 'https://icon.horse/icon/gitlab.com',
  'bitbucket.org': 'https://icon.horse/icon/bitbucket.org',
  'stackoverflow.com': 'https://icon.horse/icon/stackoverflow.com',
  'codepen.io': 'https://icon.horse/icon/codepen.io',
  'replit.com': 'https://icon.horse/icon/replit.com',
  'codesandbox.io': 'https://icon.horse/icon/codesandbox.io',
  'npmjs.com': 'https://icon.horse/icon/npmjs.com',
  'pypi.org': 'https://icon.horse/icon/pypi.org',
  'hub.docker.com': 'https://icon.horse/icon/docker.com',
  
  'notion.so': 'https://icon.horse/icon/notion.so',
  'figma.com': 'https://icon.horse/icon/figma.com',
  'slack.com': 'https://icon.horse/icon/slack.com',
  'zoom.us': 'https://icon.horse/icon/zoom.us',
  'medium.com': 'https://icon.horse/icon/medium.com',
  'trello.com': 'https://icon.horse/icon/trello.com',
  'asana.com': 'https://icon.horse/icon/asana.com',
  'miro.com': 'https://icon.horse/icon/miro.com',
  'canva.com': 'https://icon.horse/icon/canva.com',
  'airtable.com': 'https://icon.horse/icon/airtable.com',
  
  'google.com': 'https://raw.githubusercontent.com/ewinnery/webRPC/main/docs/google.png',
  'docs.google.com': 'https://raw.githubusercontent.com/ewinnery/webRPC/main/docs/google.png',
  'drive.google.com': 'https://raw.githubusercontent.com/ewinnery/webRPC/main/docs/google.png',
  'mail.google.com': 'https://raw.githubusercontent.com/ewinnery/webRPC/main/docs/google.png',
  'meet.google.com': 'https://raw.githubusercontent.com/ewinnery/webRPC/main/docs/google.png',
  
  'chatgpt.com': 'https://cdn.openai.com/chatgpt/share-og.png',
  'chat.openai.com': 'https://cdn.openai.com/chatgpt/share-og.png',
  'claude.ai': 'https://icon.horse/icon/anthropic.com',
  'gemini.google.com': 'https://raw.githubusercontent.com/ewinnery/webRPC/main/docs/google.png',
  'perplexity.ai': 'https://icon.horse/icon/perplexity.ai',
  
  'amazon.com': 'https://icon.horse/icon/amazon.com',
  'ebay.com': 'https://icon.horse/icon/ebay.com',
  'wikipedia.org': 'https://icon.horse/icon/wikipedia.org',
  'steampowered.com': 'https://icon.horse/icon/steampowered.com',
  'store.steampowered.com': 'https://icon.horse/icon/steampowered.com',
  'epicgames.com': 'https://icon.horse/icon/epicgames.com',
  'roblox.com': 'https://icon.horse/icon/roblox.com',
  
  'vercel.com': 'https://icon.horse/icon/vercel.com',
  'netlify.com': 'https://icon.horse/icon/netlify.com',
  'heroku.com': 'https://icon.horse/icon/heroku.com',
  'cloudflare.com': 'https://icon.horse/icon/cloudflare.com',
  'aws.amazon.com': 'https://icon.horse/icon/amazon.com',
};

// ===== МЕГА-УНИВЕРСАЛ ДЛЯ ИЗВЛЕЧЕНИЯ FAVICON =====

const REL_PATTERNS = [
  "icon",
  "shortcut icon",
  "apple-touch-icon",
  "apple-touch-icon-precomposed",
  "mask-icon",
  "fluid-icon",
];

const META_PATTERNS = [
  { attr: "name", value: "msapplication-TileImage" },
  { attr: "name", value: "msapplication-square310x310logo" },
  { attr: "name", value: "msapplication-square150x150logo" },
  { attr: "property", value: "og:image" },
  { attr: "property", value: "og:image:secure_url" },
  { attr: "name", value: "twitter:image" },
  { attr: "itemprop", value: "image" }
];

const COMMON_PATHS = [
  "/favicon.ico",
  "/favicon.png",
  "/favicon.svg",
  "/apple-touch-icon.png",
  "/apple-touch-icon-precomposed.png",
  "/assets/favicon.ico",
  "/static/favicon.ico",
];

function abs(href, base = document.baseURI) {
  try { return new URL(href, base).href; } catch { return null; }
}

function scoreCandidate(url, sizes, type, relHint) {
  let score = 0;
  if (sizes && sizes.includes("x")) {
    const n = parseInt(sizes.split("x")[0], 10);
    if (!isNaN(n)) score += n;
  }
  if (type === "image/svg+xml" || url.endsWith(".svg")) score -= 1000;
  if (url.endsWith(".ico")) score -= 1000;
  if (relHint?.includes("apple-touch")) score += 100;
  if (relHint === "mask-icon") score -= 50;
  if (/\.(png|jpg|jpeg|webp|gif)/i.test(url)) score += 200;
  return score;
}

function isDiscordSafe(url) {
  if (!url) return false;
  const l = url.toLowerCase();
  if (l.endsWith('.ico') || l.includes('.ico?')) return false;
  if (l.endsWith('.svg') || l.includes('.svg?')) return false;
  if (l.startsWith('data:')) return false;
  if (!l.startsWith('http://') && !l.startsWith('https://')) return false;
  return true;
}

function collectFromLinks(doc = document) {
  const out = [];
  doc.querySelectorAll("link[rel]").forEach(link => {
    const rel = (link.getAttribute("rel") || "").toLowerCase();
    if (!REL_PATTERNS.some(p => rel.includes(p))) return;
    const href = link.getAttribute("href");
    if (!href) return;
    const url = abs(href, doc.baseURI);
    if (!url) return;
    out.push({
      url,
      score: scoreCandidate(url, link.getAttribute("sizes"), link.getAttribute("type"), rel),
      source: "link:" + rel,
    });
  });
  return out;
}

function collectFromMeta(doc = document) {
  const out = [];
  META_PATTERNS.forEach(({ attr, value }) => {
    const el = doc.querySelector(`meta[${attr}="${value}"]`);
    const content = el?.getAttribute("content");
    if (!content) return;
    const url = abs(content, doc.baseURI);
    if (url) out.push({ url, score: value.includes("og:") ? 400 : 50, source: "meta:" + value });
  });
  return out;
}

async function collectFromManifest(doc = document) {
  const link = doc.querySelector('link[rel="manifest"]');
  if (!link?.href) return [];
  try {
    const manifestUrl = abs(link.getAttribute("href"), doc.baseURI);
    const resp = await fetch(manifestUrl, { credentials: "omit", mode: "cors" });
    const json = await resp.json();
    if (!Array.isArray(json.icons)) return [];
    return json.icons.map(icon => ({
      url: abs(icon.src, manifestUrl),
      score: scoreCandidate(icon.src, icon.sizes, icon.type, "manifest") + 200,
      source: "manifest",
    })).filter(c => c.url);
  } catch {
    return [];
  }
}

function collectFromIframes() {
  const out = [];
  document.querySelectorAll("iframe").forEach(iframe => {
    try {
      const doc = iframe.contentDocument;
      if (doc) out.push(...collectFromLinks(doc), ...collectFromMeta(doc));
    } catch {}
  });
  return out;
}

async function waitForHeadStable(maxWait = 1500, grace = 300) {
  return new Promise(resolve => {
    let timer = null;
    const done = () => { if (obs) obs.disconnect(); resolve(); };
    const obs = new MutationObserver(() => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(done, grace);
    });
    obs.observe(document.head || document.documentElement, { childList: true, subtree: true });
    setTimeout(done, maxWait);
  });
}

function checkImage(url, timeout = 2000) {
  return new Promise(resolve => {
    const img = new Image();
    const timer = setTimeout(() => resolve(null), timeout);
    img.onload = () => { clearTimeout(timer); resolve({ width: img.naturalWidth, height: img.naturalHeight }); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

async function bruteForceCommonPaths() {
  const origin = location.origin;
  const results = await Promise.all(COMMON_PATHS.map(async p => {
    const url = origin + p;
    if (!isDiscordSafe(url)) return null;
    try {
      const r = await fetch(url, { method: "HEAD", mode: "no-cors" });
      return { url, ok: true };
    } catch { return null; }
  }));
  return results.filter(Boolean)
    .map(r => ({ url: r.url, score: 1, source: "bruteforce" }));
}

function getKnownIcon(hostname) {
  if (!hostname) return 'https://raw.githubusercontent.com/ewinnery/webRPC/main/extension/icons/icon-512.png';
  const d = hostname.toLowerCase().replace(/^www\./, '');

  for (const [pattern, url] of Object.entries(KNOWN_ICONS)) {
    if (d === pattern || d.endsWith('.' + pattern)) return url;
  }

  const root = d.split('.').slice(-2).join('.');
  return 'https://icon.horse/icon/' + root;
}

let cachedFaviconUrl = null;
let cachedFaviconHref = null;

async function extractFavicon() {
  if (cachedFaviconUrl && cachedFaviconHref === location.href) {
    return { url: cachedFaviconUrl, score: 9999, source: "cache" };
  }
  cachedFaviconHref = location.href;
  cachedFaviconUrl = null;

  const domain = location.hostname.toLowerCase();
  
  if (domain.includes('google.') || domain.includes('github.com') || domain.includes('chatgpt.com') || domain.includes('openai.com')) {
    const known = getKnownIcon(domain);
    cachedFaviconUrl = known;
    return { url: known, score: 10000, source: "known-priority" };
  }

  await waitForHeadStable(1500, 300);

  let candidates = [
    ...collectFromLinks(),
    ...collectFromMeta(),
    ...collectFromIframes(),
    ...(await collectFromManifest()),
  ];

  if (candidates.length === 0) {
    candidates = await bruteForceCommonPaths();
  }

  const byUrl = new Map();
  for (const c of candidates) {
    if (!byUrl.has(c.url) || byUrl.get(c.url).score < c.score) byUrl.set(c.url, c);
  }
  const sorted = [...byUrl.values()].sort((a, b) => b.score - a.score);

  for (const candidate of sorted) {
    if (!isDiscordSafe(candidate.url)) continue;
    const check = await checkImage(candidate.url, 2000);
    if (check && check.width > 0) {
      cachedFaviconUrl = candidate.url;
      return { ...candidate, width: check.width, height: check.height };
    }
  }

  const known = getKnownIcon(domain);
  cachedFaviconUrl = known;
  return { url: known, score: 500, source: "known-fallback" };
}

function getFavicon() {
  if (cachedFaviconUrl && cachedFaviconHref === location.href) return cachedFaviconUrl;
  cachedFaviconHref = location.href;

  const domain = location.hostname.toLowerCase();
  if (domain.includes('google.') || domain.includes('github.com') || domain.includes('chatgpt.com') || domain.includes('openai.com')) {
    cachedFaviconUrl = getKnownIcon(domain);
    return cachedFaviconUrl;
  }

  const links = collectFromLinks();
  for (const link of links) {
    if (isDiscordSafe(link.url)) {
      cachedFaviconUrl = link.url;
      return cachedFaviconUrl;
    }
  }
  const metas = collectFromMeta();
  for (const meta of metas) {
    if (isDiscordSafe(meta.url)) {
      cachedFaviconUrl = meta.url;
      return cachedFaviconUrl;
    }
  }

  cachedFaviconUrl = getKnownIcon(domain);
  return cachedFaviconUrl;
}

extractFavicon().then(result => {
  if (result?.url) {
    cachedFaviconUrl = result.url;
    sendActivity();
  }
});

function isAdPlaying() {
  if (document.querySelector('.ad-showing, .ad-interrupting, .video-ads .ad-preview, .ytp-ad-text, .ytp-ad-preview-text, [class*="ad-showing"]')) {
    return true;
  }
  return false;
}

function safeUrl(u, fallback) {
  if (!u || typeof u !== 'string') return fallback || null;
  const str = u.trim();
  if (str.startsWith('data:') || str.startsWith('blob:') || str.startsWith('javascript:')) {
    return fallback || null;
  }
  if (!str.startsWith('http://') && !str.startsWith('https://')) {
    return fallback || null;
  }
  return str;
}

function cleanVideoTitle(raw) {
  if (!raw) return 'Watching video';
  return raw
    .replace(/^\(\d+\)\s*/, '')
    .replace(/\s*[-–|]\s*(Lordfilm|Лордфильм|Кинопоиск|HDRezka|Filmix|Kodik|Rutube|VK|YouTube|Vimeo|Dailymotion|Netflix|Twitch).*$/i, '')
    .replace(/\s*смотр(еть|ите)\s+онлайн.*$/i, '')
    .trim() || raw;
}

function findActiveVideo() {
  if (isAdPlaying()) return null;

  let best = null, bestScore = 0;
  for (const v of document.querySelectorAll('video')) {
    const isAd = v.closest('[class*="ad-player"], [class*="video-ads"], [class*="preroll"], [id*="ad-"], [class*="ad-container"]');
    if (isAd) continue;

    const playing = !v.paused && !v.ended && v.currentTime > 0;
    const w = v.videoWidth || v.clientWidth || v.offsetWidth || 0;
    const h = v.videoHeight || v.clientHeight || v.offsetHeight || 0;

    if (!playing) {
      if (w > 0 && w < 100) continue;
      if (h > 0 && h < 100) continue;
      const dur = v.duration;
      const hasDur = isFinite(dur) && !isNaN(dur) && dur > 3;
      if (!hasDur && v.readyState < 1) continue;
    }

    let score = (w || 300) * (h || 200);
    if (playing) score += 2000000;
    if (v.src && !v.src.startsWith('blob:')) score += 10000;
    if (v.currentTime > 0) score += 50000;

    if (score > bestScore) {
      best = v;
      bestScore = score;
    }
  }
  return best;
}

function getVideoContext(video) {
  let title = null, author = null;
  const container = video.closest(
    '[class*="player"], [class*="video"], [class*="media"], article, section, main, [role="main"]'
  );
  if (container) {
    const titleEl = container.querySelector(
      'h1, h2, .title, .video-title, [class*="title"]:not(link):not(meta)'
    );
    if (titleEl) {
      const t = titleEl.textContent.trim();
      if (t.length > 2 && t.length < 300) title = t;
    }
    const authorEl = container.querySelector(
      '.author, .channel, .uploader, [class*="author"], [class*="channel"], [class*="uploader"]'
    );
    if (authorEl) {
      const a = authorEl.textContent.trim();
      if (a.length > 1 && a.length < 100) author = a;
    }
  }
  return { title, author };
}

function buildVideoActivity(video, url, favicon, extraTitle, extraAuthor, extraChannel) {
  const playing = !video.paused && !video.ended && video.currentTime > 0;
  const dur = video.duration;
  const cur = video.currentTime;

  const hasValidCur = isFinite(cur) && !isNaN(cur) && cur >= 0;
  const hasValidDur = isFinite(dur) && !isNaN(dur) && dur > 1 && dur < 864000;

  const ctx = getVideoContext(video);
  let videoTitle = extraTitle || ctx.title || null;

  if (!videoTitle || videoTitle.length < 2) {
    videoTitle = cleanVideoTitle(document.title);
  }

  const author = extraAuthor || ctx.author || null;
  const platform = platformName(url);

  let posterImg = null;
  if (video.poster && typeof video.poster === 'string') {
    const p = video.poster.trim();
    if (p.startsWith('http://') || p.startsWith('https://')) {
      posterImg = p;
    }
  }

  const baseFavicon = favicon || getFavicon();
  const largeImg = posterImg || baseFavicon;
  const cleanWebUrl = safeUrl(url, location.href);

  const result = {
    type: 'video',
    title: platform,
    url: cleanWebUrl,
    favicon: safeUrl(baseFavicon, getFavicon()),
    details: videoTitle ? (playing ? videoTitle : `${videoTitle} (Paused)`) : (playing ? 'Watching video' : 'Video paused'),
    state: author || extractDomain(cleanWebUrl),
    largeImage: safeUrl(largeImg, getFavicon()),
    largeText: videoTitle || platform,
    smallImage: playing ? 'icon_play' : 'icon_pause',
    smallText: playing ? 'Playing' : 'Paused',
    videoUrl: cleanWebUrl,
    channelUrl: extraChannel ? safeUrl(extraChannel, null) : null,
    timestamps: null,
    isPlaying: playing,
  };

  if (playing && hasValidCur) {
    const startTs = Math.floor(Date.now() - cur * 1000);
    if (hasValidDur) {
      const endTs = Math.floor(Date.now() + (dur - cur) * 1000);
      result.timestamps = { start: startTs, end: endTs };
    } else {
      result.timestamps = { start: startTs };
    }
  }

  return result;
}

function detectYouTube(url) {
  const hostname = new URL(url).hostname;

  if (hostname === 'music.youtube.com') return detectYouTubeMusic(url);

  const isShorts = url.includes('/shorts/');
  const isLive = url.includes('/live') || !!document.querySelector('.ytp-live-badge-text, .ytp-live');
  const isWatch = url.includes('/watch') || isShorts || isLive;

  if (!isWatch) {
    const miniplayer = document.querySelector('ytd-miniplayer video, .miniplayer video');
    if (miniplayer && !miniplayer.paused && miniplayer.currentTime > 0) {
      const miniTitle = document.querySelector('ytd-miniplayer .title, .miniplayer .title');
      return buildVideoActivity(
        miniplayer, url, getIcon('youtube.com'),
        miniTitle ? miniTitle.textContent.trim() : null, null, null
      );
    }
    const pn = 'YouTube';
    const rawTitle = document.title.replace(/^\(\d+\)\s*/, '').replace(/ - YouTube$/, '').trim() || 'Browsing YouTube';
    return {
      type: 'page', title: pn, url, favicon: getIcon('youtube.com'),
      details: rawTitle, state: 'youtube.com',
      largeImage: getIcon('youtube.com'), largeText: rawTitle,
      smallImage: 'icon_globe', smallText: pn,
      videoUrl: null, channelUrl: null, timestamps: null, isPlaying: false,
    };
  }

  let videoId;
  if (isShorts) {
    videoId = url.match(/shorts\/([a-zA-Z0-9_-]+)/)?.[1];
  } else {
    try { videoId = new URL(url).searchParams.get('v'); } catch {}
  }

  const video = document.querySelector('#movie_player video, ytd-player video, video');

  let channel = null, channelUrl = null;
  const chEl = document.querySelector(
    '#channel-name a, #owner #channel-name a, ytd-channel-name a, .ytd-video-owner-renderer a, #upload-info #channel-name a, #text-container.ytd-channel-name a'
  );
  if (chEl) {
    channel = chEl.textContent.trim();
    if (chEl.href) channelUrl = chEl.href;
  }

  let videoTitle = null;
  const titleEl = document.querySelector(
    'ytd-watch-metadata #title h1, #container > h1.ytd-watch-metadata, h1.ytd-video-primary-info-renderer, h1.title.ytd-video-primary-info-renderer'
  );
  if (titleEl && titleEl.textContent.trim()) {
    videoTitle = titleEl.textContent.trim();
  }
  if (!videoTitle) {
    videoTitle = document.title.replace(/^\(\d+\)\s*/, '').replace(/ - YouTube$/, '').trim() || 'Watching YouTube';
  }

  const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : getIcon('youtube.com');

  if (video) {
    const activity = buildVideoActivity(video, url, thumb, videoTitle, channel, channelUrl);
    activity.title = isLive ? 'YouTube Live' : isShorts ? 'YouTube Shorts' : 'YouTube';
    activity.largeImage = thumb;
    activity.largeText = videoTitle;
    activity.videoUrl = videoId ? `https://youtube.com/watch?v=${videoId}` : url;
    activity.channelUrl = channelUrl;
    return activity;
  } else {
    return {
      type: 'video',
      title: isLive ? 'YouTube Live' : isShorts ? 'YouTube Shorts' : 'YouTube',
      url: url,
      favicon: getIcon('youtube.com'),
      details: `${videoTitle} (Paused)`,
      state: channel || 'YouTube',
      largeImage: thumb,
      largeText: videoTitle,
      smallImage: 'icon_pause',
      smallText: 'Paused',
      videoUrl: videoId ? `https://youtube.com/watch?v=${videoId}` : url,
      channelUrl: channelUrl,
      timestamps: null,
      isPlaying: false,
    };
  }
}

function detectYouTubeMusic(url) {
  const video = document.querySelector('video');
  if (!video) return null;

  const titleEl = document.querySelector('.title.ytmusic-player-bar, .content-info-wrapper .title');
  const artistEl = document.querySelector('.byline.ytmusic-player-bar a, .content-info-wrapper .subtitle a');
  const songTitle = titleEl ? titleEl.textContent.trim() : document.title.replace(/ - YouTube Music$/, '');
  const artist = artistEl ? artistEl.textContent.trim() : null;

  const playing = !video.paused && !video.ended;
  const dur = video.duration;
  const cur = video.currentTime;

  return {
    type: 'music',
    title: 'YouTube Music',
    url: url,
    favicon: getIcon('youtube.com'),
    details: songTitle,
    state: artist || 'YouTube Music',
    largeImage: getIcon('youtube.com'),
    largeText: songTitle,
    smallImage: playing ? 'icon_play' : 'icon_pause',
    smallText: playing ? 'Playing' : 'Paused',
    videoUrl: url,
    channelUrl: artistEl ? artistEl.href : null,
    timestamps: playing && !isNaN(dur) && dur > 0 ? {
      start: Math.floor(Date.now() - cur * 1000),
      end: Math.floor(Date.now() + (dur - cur) * 1000),
    } : null,
  };
}

function detectTwitch(url) {
  const path = new URL(url).pathname;
  const isChannel = /^\/[a-zA-Z0-9_]+\/?$/.test(path);
  const isVod = path.includes('/videos/');
  const isClip = path.includes('/clip/');
  const channelName = path.split('/').filter(Boolean)[0] || 'twitch';

  const video = document.querySelector('video');
  if (!video || video.readyState < 1) return null;

  const titleEl = document.querySelector('[data-a-target="stream-title"]');
  const streamTitle = titleEl ? titleEl.textContent.trim() : document.title.replace(/ - Twitch$/, '');
  const viewerEl = document.querySelector('[data-a-target="animated-channel-viewers-count"]');
  const viewers = viewerEl ? viewerEl.textContent.trim() : null;
  const isLive = isChannel && !isVod && !isClip;

  const channelUrl = `https://twitch.tv/${channelName}`;
  const thumb = `https://static-cdn.jtvnw.net/previews-ttv/live_user_${channelName.toLowerCase()}-440x248.jpg`;

  const activity = buildVideoActivity(video, url, thumb, streamTitle, channelName, channelUrl);
  activity.title = 'Twitch';
  activity.largeImage = thumb;

  if (isLive) {
    activity.details = streamTitle;
    activity.state = viewers ? `${channelName} (${viewers} viewers)` : channelName;
    activity.smallImage = 'icon_live';
    activity.smallText = 'Live';
    activity.timestamps = { start: Math.floor(Date.now() / 1000) * 1000 };
  }

  return activity;
}

function detectNetflix(url) {
  const video = document.querySelector('video');
  if (!video || video.readyState < 1) return null;

  const titleEl = document.querySelector('[data-uia="video-title"]');
  const nTitle = titleEl ? titleEl.textContent.trim() : document.title.replace(/ \| Netflix$/, '');

  const activity = buildVideoActivity(video, url, getIcon('netflix.com'), nTitle, null, null);
  activity.title = 'Netflix';
  activity.largeImage = getIcon('netflix.com');
  return activity;
}

function detectSpotify(url) {
  const titleEl = document.querySelector('[data-testid="nowplaying-track-link"], .track-info__name a');
  const artistEl = document.querySelector('[data-testid="nowplaying-artist"], .track-info__artists a');
  const songTitle = titleEl ? titleEl.textContent.trim() : document.title.replace(/ \| Spotify.*/, '');
  const artist = artistEl ? artistEl.textContent.trim() : 'Spotify';

  return {
    type: 'music',
    title: 'Spotify',
    url: url,
    favicon: getIcon('spotify.com'),
    details: songTitle,
    state: artist,
    largeImage: getIcon('spotify.com'),
    largeText: songTitle,
    smallImage: 'icon_sound',
    smallText: 'Spotify',
    videoUrl: url,
    channelUrl: null,
    timestamps: null,
  };
}

function detectGitHub(url) {
  let details = 'Browsing', state = 'GitHub';
  try {
    const p = new URL(url).pathname.split('/').filter(Boolean);
    if (p.length >= 2) {
      state = `${p[0]}/${p[1]}`;
      const s = p[2];
      if (s === 'pull' || s === 'pulls') details = 'Reviewing PR';
      else if (s === 'issues') details = 'Browsing issues';
      else if (s === 'blob') details = 'Viewing file';
      else if (s === 'tree') details = 'Browsing files';
      else if (s === 'commit' || s === 'commits') details = 'Viewing commits';
      else if (s === 'actions') details = 'CI/CD';
      else if (!s) details = 'Viewing repo';
      else details = 'Browsing';
    } else if (p.length === 1) {
      state = p[0]; details = 'Viewing profile';
    }
  } catch {}
  return {
    type: 'coding', title: 'GitHub', url, favicon: getIcon('github.com'),
    details, state, largeImage: getIcon('github.com'),
    largeText: document.title, smallImage: 'icon_code', smallText: 'GitHub',
    videoUrl: null, channelUrl: null, timestamps: null,
  };
}

const SITE_CATS = {
  
  'youtube.com':       { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'twitch.tv':         { cat: 'Streaming', icon: 'icon_live',  type: 'video' },
  'kick.com':          { cat: 'Streaming', icon: 'icon_live',  type: 'video' },
  'rumble.com':        { cat: 'Streaming', icon: 'icon_live',  type: 'video' },
  'netflix.com':       { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'disneyplus.com':    { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'hulu.com':          { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'primevideo.com':    { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'max.com':           { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'hbomax.com':        { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'peacocktv.com':     { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'paramountplus.com': { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'crunchyroll.com':   { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'funimation.com':    { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'bilibili.com':      { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'dailymotion.com':   { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'vimeo.com':         { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'plex.tv':           { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'tiktok.com':        { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'rutube.ru':         { cat: 'Video',     icon: 'icon_play',  type: 'video' },
  'vk.com':            { cat: 'Social',    icon: 'icon_globe',  type: 'social' },
  
  'spotify.com':       { cat: 'Music',     icon: 'icon_sound', type: 'music' },
  'soundcloud.com':    { cat: 'Music',     icon: 'icon_sound', type: 'music' },
  'music.apple.com':   { cat: 'Music',     icon: 'icon_sound', type: 'music' },
  'deezer.com':        { cat: 'Music',     icon: 'icon_sound', type: 'music' },
  'tidal.com':         { cat: 'Music',     icon: 'icon_sound', type: 'music' },
  'pandora.com':       { cat: 'Music',     icon: 'icon_sound', type: 'music' },
  'bandcamp.com':      { cat: 'Music',     icon: 'icon_sound', type: 'music' },
  'music.youtube.com': { cat: 'Music',     icon: 'icon_sound', type: 'music' },
  'music.yandex.ru':   { cat: 'Music',     icon: 'icon_sound', type: 'music' },
  
  'discord.com':       { cat: 'Chat',      icon: 'icon_chat',  type: 'chat' },
  'web.telegram.org':  { cat: 'Chat',      icon: 'icon_chat',  type: 'chat' },
  'whatsapp.com':      { cat: 'Chat',      icon: 'icon_chat',  type: 'chat' },
  'web.whatsapp.com':  { cat: 'Chat',      icon: 'icon_chat',  type: 'chat' },
  'messenger.com':     { cat: 'Chat',      icon: 'icon_chat',  type: 'chat' },
  'signal.org':        { cat: 'Chat',      icon: 'icon_chat',  type: 'chat' },
  'slack.com':         { cat: 'Chat',      icon: 'icon_chat',  type: 'chat' },
  'teams.microsoft.com': { cat: 'Chat',    icon: 'icon_chat',  type: 'chat' },
  'meet.google.com':   { cat: 'Chat',      icon: 'icon_chat',  type: 'chat' },
  'zoom.us':           { cat: 'Chat',      icon: 'icon_chat',  type: 'chat' },
  
  'twitter.com':       { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'x.com':             { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'reddit.com':        { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'facebook.com':      { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'instagram.com':     { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'linkedin.com':      { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'pinterest.com':     { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'tumblr.com':        { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'bsky.app':          { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'mastodon.social':   { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'threads.net':       { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'ok.ru':             { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  'snapchat.com':      { cat: 'Social',    icon: 'icon_globe', type: 'social' },
  
  'github.com':        { cat: 'Code',      icon: 'icon_code',  type: 'coding' },
  'gitlab.com':        { cat: 'Code',      icon: 'icon_code',  type: 'coding' },
  'bitbucket.org':     { cat: 'Code',      icon: 'icon_code',  type: 'coding' },
  'stackoverflow.com': { cat: 'Code',      icon: 'icon_code',  type: 'coding' },
  'codepen.io':        { cat: 'Code',      icon: 'icon_code',  type: 'coding' },
  'replit.com':        { cat: 'Code',      icon: 'icon_code',  type: 'coding' },
  'codesandbox.io':    { cat: 'Code',      icon: 'icon_code',  type: 'coding' },
  'npmjs.com':         { cat: 'Code',      icon: 'icon_code',  type: 'coding' },
  'pypi.org':          { cat: 'Code',      icon: 'icon_code',  type: 'coding' },
  
  'notion.so':         { cat: 'Work',      icon: 'icon_globe', type: 'page' },
  'figma.com':         { cat: 'Design',    icon: 'icon_globe', type: 'page' },
  'canva.com':         { cat: 'Design',    icon: 'icon_globe', type: 'page' },
  'miro.com':          { cat: 'Work',      icon: 'icon_globe', type: 'page' },
  'trello.com':        { cat: 'Work',      icon: 'icon_globe', type: 'page' },
  
  'chatgpt.com':       { cat: 'AI',        icon: 'icon_chat',  type: 'page' },
  'chat.openai.com':   { cat: 'AI',        icon: 'icon_chat',  type: 'page' },
  'claude.ai':         { cat: 'AI',        icon: 'icon_chat',  type: 'page' },
  'gemini.google.com': { cat: 'AI',        icon: 'icon_chat',  type: 'page' },
  'perplexity.ai':     { cat: 'AI',        icon: 'icon_search',type: 'page' },
  
  'steampowered.com':  { cat: 'Gaming',    icon: 'icon_game',  type: 'page' },
  'store.steampowered.com': { cat: 'Gaming', icon: 'icon_game', type: 'page' },
  'epicgames.com':     { cat: 'Gaming',    icon: 'icon_game',  type: 'page' },
  'roblox.com':        { cat: 'Gaming',    icon: 'icon_game',  type: 'page' },
};

function getSiteCat(domain) {
  const clean = domain.replace(/^www\./, '');
  if (SITE_CATS[clean]) return SITE_CATS[clean];
  const parts = clean.split('.');
  if (parts.length > 2) {
    const parent = parts.slice(-2).join('.');
    if (SITE_CATS[parent]) return SITE_CATS[parent];
    
    if (SITE_CATS[clean]) return SITE_CATS[clean];
  }
  return null;
}

function detectChat(url, cat) {
  const pn = platformName(url);
  return {
    type: 'chat', title: pn, url, favicon: getFavicon(),
    details: 'Chatting', state: pn,
    largeImage: getIcon(extractDomain(url)),
    largeText: pn, smallImage: 'icon_chat', smallText: 'Chatting',
    videoUrl: null, channelUrl: null, timestamps: null,
  };
}

function detectSocial(url) {
  const pn = platformName(url);
  const d = extractDomain(url);
  return {
    type: 'social', title: pn, url, favicon: getIcon(d),
    details: 'Browsing ' + pn, state: d,
    largeImage: getIcon(d), largeText: document.title,
    smallImage: 'icon_globe', smallText: pn,
    videoUrl: null, channelUrl: null, timestamps: null,
  };
}

function detectVideoPlatform(url) {
  const pn = platformName(url);
  const d = extractDomain(url);
  const video = findActiveVideo();
  if (video) {
    const act = buildVideoActivity(video, url, getIcon(d), null, null, null);
    act.title = pn;
    act.largeImage = getIcon(d);
    return act;
  }
  
  return {
    type: 'page', title: pn, url, favicon: getIcon(d),
    details: 'Browsing ' + pn, state: d,
    largeImage: getIcon(d), largeText: document.title,
    smallImage: 'icon_globe', smallText: pn,
    videoUrl: null, channelUrl: null, timestamps: null,
  };
}

function detectMusicPlatform(url) {
  const pn = platformName(url);
  const d = extractDomain(url);
  const video = document.querySelector('video, audio');
  const playing = video && !video.paused && !video.ended;

  const titleEl = document.querySelector(
    '[class*="track"] [class*="title"], [class*="song"] [class*="title"], .playback-title, h1'
  );
  const artistEl = document.querySelector(
    '[class*="artist"], [class*="author"], .playback-artist'
  );

  const track = titleEl ? titleEl.textContent.trim() : document.title;
  const artist = artistEl ? artistEl.textContent.trim() : pn;

  const result = {
    type: 'music', title: pn, url, favicon: getIcon(d),
    details: track, state: artist,
    largeImage: getIcon(d), largeText: track,
    smallImage: playing ? 'icon_play' : 'icon_sound',
    smallText: playing ? 'Playing' : pn,
    videoUrl: url, channelUrl: null, timestamps: null,
  };

  if (playing && video && !isNaN(video.duration) && video.duration > 0) {
    result.timestamps = {
      start: Math.floor(Date.now() - video.currentTime * 1000),
      end: Math.floor(Date.now() + (video.duration - video.currentTime) * 1000),
    };
  }
  return result;
}

function detectCodePlatform(url) {
  const pn = platformName(url);
  const d = extractDomain(url);
  return {
    type: 'coding', title: pn, url, favicon: getIcon(d),
    details: document.title || 'Browsing', state: d,
    largeImage: getIcon(d), largeText: document.title,
    smallImage: 'icon_code', smallText: pn,
    videoUrl: null, channelUrl: null, timestamps: null,
  };
}

function detectGenericSite(url) {
  const d = extractDomain(url);
  const pn = platformName(url);
  const cat = getSiteCat(d);
  return {
    type: cat?.type || 'page', title: pn, url, favicon: getFavicon(),
    details: document.title || 'Browsing', state: d,
    largeImage: getFavicon(), largeText: document.title,
    smallImage: cat?.icon || 'icon_globe', smallText: pn,
    videoUrl: null, channelUrl: null, timestamps: null,
  };
}

function detectActivity() {
  const url = window.location.href;
  const host = extractDomain(url);
  const cat = getSiteCat(host);

  if (host.includes('youtube.com')) {
    const yt = detectYouTube(url);
    if (yt) return yt;
  }

  if (host.includes('twitch.tv')) {
    const tw = detectTwitch(url);
    if (tw) return tw;
  }

  if (host.includes('netflix.com')) {
    const nf = detectNetflix(url);
    if (nf) return nf;
  }

  if (host.includes('spotify.com')) return detectSpotify(url);

  if (host.includes('github.com')) return detectGitHub(url);

  if (cat) {
    
    if (cat.type === 'chat') return detectChat(url, cat);

    if (cat.type === 'video') return detectVideoPlatform(url);

    if (cat.type === 'music') return detectMusicPlatform(url);

    if (cat.type === 'coding') return detectCodePlatform(url);

    if (cat.type === 'social') return detectSocial(url);
  }

  const video = findActiveVideo();
  if (video) {
    const playing = !video.paused && !video.ended && video.currentTime > 0;
    const hasDur = !isNaN(video.duration) && video.duration > 5;
    if (playing || hasDur) {
      return buildVideoActivity(video, url, getFavicon(), null, null, null);
    }
  }

  for (const iframe of document.querySelectorAll('iframe')) {
    const src = iframe.src || '';
    if (src.includes('youtube.com/embed')) {
      const vid = src.match(/embed\/([a-zA-Z0-9_-]+)/)?.[1];
      return {
        type: 'video', title: 'YouTube', url, favicon: getIcon('youtube.com'),
        details: document.title, state: extractDomain(url),
        largeImage: vid ? `https://img.youtube.com/vi/${vid}/hqdefault.jpg` : getIcon('youtube.com'),
        largeText: document.title, smallImage: 'icon_play', smallText: 'YouTube',
        videoUrl: vid ? `https://youtube.com/watch?v=${vid}` : url,
        channelUrl: null, timestamps: null,
      };
    }
    if (src.includes('player.twitch.tv')) {
      return {
        type: 'video', title: 'Twitch', url, favicon: getIcon('twitch.tv'),
        details: document.title, state: extractDomain(url),
        largeImage: getIcon('twitch.tv'), largeText: document.title,
        smallImage: 'icon_live', smallText: 'Twitch',
        videoUrl: url, channelUrl: null, timestamps: null,
      };
    }
  }

  return detectGenericSite(url);
}

function sendActivity() {
  if (!isExtensionValid()) return;
  if (sendTimer) clearTimeout(sendTimer);
  const hasVideo = !!findActiveVideo();
  sendTimer = setTimeout(doSend, hasVideo ? DEBOUNCE_VIDEO : DEBOUNCE_PAGE);
}

function checkAndSendActivity() {
  sendActivity();
}

function doSend() {
  if (!isExtensionValid()) return;
  try {
    const activity = detectActivity();
    chrome.runtime.sendMessage({ action: 'updateActivity', data: activity }, (r) => {
      if (chrome.runtime.lastError) {
        const m = chrome.runtime.lastError.message || '';
        if (m.includes('invalidated') || m.includes('closed')) extensionValid = false;
      }
    });
  } catch { extensionValid = false; }
}

chrome.runtime.onMessage.addListener((req, sender, sendResponse) => {
  if (req.action === 'getActivity') {
    try { sendResponse({ activity: detectActivity() }); }
    catch { sendResponse({ activity: null }); }
  }
});

setTimeout(sendActivity, 500);

let lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== lastUrl) { lastUrl = location.href; sendActivity(); }
}).observe(document.body || document.documentElement, { subtree: true, childList: true });

try {
  const t = document.querySelector('title');
  if (t) new MutationObserver(() => {
    if (document.title !== currentTitle) { currentTitle = document.title; sendActivity(); }
  }).observe(t, { childList: true });
} catch {}

function attachVideoListeners() {
  for (const v of document.querySelectorAll('video')) {
    if (v._wrpcAttached) continue;
    v._wrpcAttached = true;
    for (const evt of ['play', 'pause', 'playing', 'seeked', 'ended', 'ratechange', 'loadedmetadata']) {
      v.addEventListener(evt, () => {
        if (sendTimer) clearTimeout(sendTimer);
        doSend(); 
      });
    }
  }
}
attachVideoListeners();
new MutationObserver(attachVideoListeners).observe(
  document.body || document.documentElement, { subtree: true, childList: true }
);

function onYouTubeNavigation() {
  doSend();
  setTimeout(doSend, 300);
  setTimeout(doSend, 800);
  setTimeout(doSend, 1500);
}

window.addEventListener('yt-navigate-finish', onYouTubeNavigation);
window.addEventListener('yt-page-data-updated', onYouTubeNavigation);
window.addEventListener('spfdone', onYouTubeNavigation);
window.addEventListener('popstate', onYouTubeNavigation);

setInterval(() => {
  if (!isExtensionValid()) return;
  doSend();
}, 5000);
