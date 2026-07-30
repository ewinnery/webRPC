let extensionValid = true;
let currentTitle = document.title;
let sendTimer = null;
let lastVideoState = null;

const DEBOUNCE_PAGE = 2000;
const DEBOUNCE_VIDEO = 800;

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
  
  'youtube.com': 'https://logo.clearbit.com/youtube.com',
  'twitch.tv': 'https://logo.clearbit.com/twitch.tv',
  'netflix.com': 'https://logo.clearbit.com/netflix.com',
  'disneyplus.com': 'https://logo.clearbit.com/disneyplus.com',
  'hulu.com': 'https://logo.clearbit.com/hulu.com',
  'primevideo.com': 'https://logo.clearbit.com/primevideo.com',
  'crunchyroll.com': 'https://logo.clearbit.com/crunchyroll.com',
  'bilibili.com': 'https://logo.clearbit.com/bilibili.com',
  'kick.com': 'https://logo.clearbit.com/kick.com',
  'rumble.com': 'https://logo.clearbit.com/rumble.com',
  'dailymotion.com': 'https://logo.clearbit.com/dailymotion.com',
  'vimeo.com': 'https://logo.clearbit.com/vimeo.com',
  'plex.tv': 'https://logo.clearbit.com/plex.tv',
  'hbomax.com': 'https://logo.clearbit.com/hbomax.com',
  'max.com': 'https://logo.clearbit.com/max.com',
  'peacocktv.com': 'https://logo.clearbit.com/peacocktv.com',
  'paramountplus.com': 'https://logo.clearbit.com/paramountplus.com',
  'funimation.com': 'https://logo.clearbit.com/funimation.com',
  'ani.me': 'https://logo.clearbit.com/ani.me',
  
  'spotify.com': 'https://logo.clearbit.com/spotify.com',
  'soundcloud.com': 'https://logo.clearbit.com/soundcloud.com',
  'music.apple.com': 'https://logo.clearbit.com/apple.com',
  'deezer.com': 'https://logo.clearbit.com/deezer.com',
  'tidal.com': 'https://logo.clearbit.com/tidal.com',
  'pandora.com': 'https://logo.clearbit.com/pandora.com',
  'bandcamp.com': 'https://logo.clearbit.com/bandcamp.com',
  
  'discord.com': 'https://logo.clearbit.com/discord.com',
  'telegram.org': 'https://logo.clearbit.com/telegram.org',
  'twitter.com': 'https://logo.clearbit.com/twitter.com',
  'x.com': 'https://logo.clearbit.com/x.com',
  'reddit.com': 'https://logo.clearbit.com/reddit.com',
  'facebook.com': 'https://logo.clearbit.com/facebook.com',
  'instagram.com': 'https://logo.clearbit.com/instagram.com',
  'tiktok.com': 'https://logo.clearbit.com/tiktok.com',
  'linkedin.com': 'https://logo.clearbit.com/linkedin.com',
  'pinterest.com': 'https://logo.clearbit.com/pinterest.com',
  'tumblr.com': 'https://logo.clearbit.com/tumblr.com',
  'snapchat.com': 'https://logo.clearbit.com/snapchat.com',
  'threads.net': 'https://logo.clearbit.com/threads.net',
  'mastodon.social': 'https://logo.clearbit.com/mastodon.social',
  'bsky.app': 'https://logo.clearbit.com/bsky.app',
  'vk.com': 'https://logo.clearbit.com/vk.com',
  'ok.ru': 'https://logo.clearbit.com/ok.ru',
  
  'whatsapp.com': 'https://logo.clearbit.com/whatsapp.com',
  'signal.org': 'https://logo.clearbit.com/signal.org',
  'messenger.com': 'https://logo.clearbit.com/messenger.com',
  
  'github.com': 'https://logo.clearbit.com/github.com',
  'gitlab.com': 'https://logo.clearbit.com/gitlab.com',
  'bitbucket.org': 'https://logo.clearbit.com/bitbucket.org',
  'stackoverflow.com': 'https://logo.clearbit.com/stackoverflow.com',
  'codepen.io': 'https://logo.clearbit.com/codepen.io',
  'replit.com': 'https://logo.clearbit.com/replit.com',
  'codesandbox.io': 'https://logo.clearbit.com/codesandbox.io',
  'npmjs.com': 'https://logo.clearbit.com/npmjs.com',
  'pypi.org': 'https://logo.clearbit.com/pypi.org',
  'hub.docker.com': 'https://logo.clearbit.com/docker.com',
  
  'notion.so': 'https://logo.clearbit.com/notion.so',
  'figma.com': 'https://logo.clearbit.com/figma.com',
  'slack.com': 'https://logo.clearbit.com/slack.com',
  'zoom.us': 'https://logo.clearbit.com/zoom.us',
  'medium.com': 'https://logo.clearbit.com/medium.com',
  'trello.com': 'https://logo.clearbit.com/trello.com',
  'asana.com': 'https://logo.clearbit.com/asana.com',
  'miro.com': 'https://logo.clearbit.com/miro.com',
  'canva.com': 'https://logo.clearbit.com/canva.com',
  'airtable.com': 'https://logo.clearbit.com/airtable.com',
  
  'google.com': 'https://logo.clearbit.com/google.com',
  'docs.google.com': 'https://logo.clearbit.com/google.com',
  'drive.google.com': 'https://logo.clearbit.com/google.com',
  'mail.google.com': 'https://logo.clearbit.com/gmail.com',
  'meet.google.com': 'https://logo.clearbit.com/google.com',
  
  'chatgpt.com': 'https://logo.clearbit.com/openai.com',
  'chat.openai.com': 'https://logo.clearbit.com/openai.com',
  'claude.ai': 'https://logo.clearbit.com/anthropic.com',
  'gemini.google.com': 'https://logo.clearbit.com/google.com',
  'perplexity.ai': 'https://logo.clearbit.com/perplexity.ai',
  
  'amazon.com': 'https://logo.clearbit.com/amazon.com',
  'ebay.com': 'https://logo.clearbit.com/ebay.com',
  'wikipedia.org': 'https://logo.clearbit.com/wikipedia.org',
  'steampowered.com': 'https://logo.clearbit.com/steampowered.com',
  'store.steampowered.com': 'https://logo.clearbit.com/steampowered.com',
  'epic games.com': 'https://logo.clearbit.com/epicgames.com',
  'roblox.com': 'https://logo.clearbit.com/roblox.com',
  'twitch.tv': 'https://logo.clearbit.com/twitch.tv',
  
  'vercel.com': 'https://logo.clearbit.com/vercel.com',
  'netlify.com': 'https://logo.clearbit.com/netlify.com',
  'heroku.com': 'https://logo.clearbit.com/heroku.com',
  'cloudflare.com': 'https://logo.clearbit.com/cloudflare.com',
  'aws.amazon.com': 'https://logo.clearbit.com/amazon.com',
};

function isLocalDomain(d) {
  return !d || d === 'localhost' || d === '127.0.0.1' || d === '0.0.0.0'
    || d.startsWith('192.168.') || d.startsWith('10.') || d.startsWith('172.')
    || d.endsWith('.local') || d.endsWith('.localhost')
    || /^\d+\.\d+\.\d+\.\d+$/.test(d);
}

function getIcon(domain) {
  const clean = domain.replace(/^www\./, '');
  if (isLocalDomain(clean)) return 'webrpc';
  return `https://www.google.com/s2/favicons?domain=${clean}&sz=128`;
}

function getFavicon() {
  const domain = window.location.hostname;
  const baseUrl = window.location.href;

  const selectors = [
    'link[rel*="icon"]',
    'link[rel*="apple-touch-icon"]',
    'link[rel*="shortcut"]',
    'meta[property="og:image"]',
    'meta[name="twitter:image"]',
    'meta[itemprop="image"]',
    'header img[src*="logo"]',
    'nav img[src*="logo"]',
    '[class*="logo"] img',
    '[id*="logo"] img'
  ];

  for (const sel of selectors) {
    for (const el of document.querySelectorAll(sel)) {
      const raw = el.getAttribute('href') || el.getAttribute('content') || el.getAttribute('src') || el.href || el.src;
      if (raw && !raw.startsWith('data:')) {
        try {
          const absUrl = new URL(raw, baseUrl).href;
          if (absUrl.startsWith('http://') || absUrl.startsWith('https://')) {
            return absUrl;
          }
        } catch {}
      }
    }
  }

  return getIcon(domain);
}

function isAdPlaying() {
  if (document.querySelector('.ad-showing, .ad-interrupting, .video-ads .ad-preview, .ytp-ad-text, .ytp-ad-preview-text, [class*="ad-showing"]')) {
    return true;
  }
  return false;
}

function findActiveVideo() {
  if (isAdPlaying()) return null;

  let best = null, bestScore = 0;
  for (const v of document.querySelectorAll('video')) {
    if (v.readyState < 1) continue;

    const isAd = v.closest('[class*="ad-player"], [class*="video-ads"], [class*="preroll"], [id*="ad-"]');
    if (isAd) continue;

    const w = v.videoWidth || v.clientWidth || v.offsetWidth || 0;
    const h = v.videoHeight || v.clientHeight || v.offsetHeight || 0;
    if (w < 120 || h < 120) continue;

    const playing = !v.paused && !v.ended && v.currentTime > 0;
    const dur = v.duration;
    const hasDur = !isNaN(dur) && dur > 3;
    if (!playing && !hasDur) continue;

    let score = w * h;
    if (playing) score += 1000000;
    if (score > bestScore) { best = v; bestScore = score; }
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
  const hasDur = !isNaN(dur) && dur > 1;

  const ctx = getVideoContext(video);
  const videoTitle = extraTitle || ctx.title || null;
  const author = extraAuthor || ctx.author || null;
  const platform = platformName(url);

  const result = {
    type: 'video',
    title: platform,
    url: url,
    favicon: favicon,
    details: videoTitle || 'Viewing video',
    state: author || extractDomain(url),
    largeImage: favicon,
    largeText: videoTitle || platform,
    smallImage: playing ? 'icon_play' : 'icon_pause',
    smallText: playing ? 'Playing' : 'Paused',
    videoUrl: url,
    channelUrl: extraChannel || null,
    timestamps: null,
  };

  if (hasDur && playing) {
    result.timestamps = {
      start: Math.floor(Date.now() - cur * 1000),
      end: Math.floor(Date.now() + (dur - cur) * 1000),
    };
  }

  if (!playing && hasDur) {
    result.details = videoTitle ? `${videoTitle} (Paused)` : 'Video paused';
  }

  return result;
}

function detectYouTube(url) {
  const hostname = new URL(url).hostname;

  if (hostname === 'music.youtube.com') return detectYouTubeMusic(url);

  if (!url.includes('/watch') && !url.includes('/shorts/') && !url.includes('/live')) {
    
    const miniplayer = document.querySelector('ytd-miniplayer video, .miniplayer video');
    if (miniplayer && !miniplayer.paused && miniplayer.currentTime > 0) {
      const miniTitle = document.querySelector('ytd-miniplayer .title, .miniplayer .title');
      return buildVideoActivity(
        miniplayer, url, getIcon('youtube.com'),
        miniTitle ? miniTitle.textContent.trim() : null, null, null
      );
    }
    return null; 
  }

  const isShorts = url.includes('/shorts/');
  const isLive = url.includes('/live') || !!document.querySelector('.ytp-live-badge-text, .ytp-live');
  let videoId;
  if (isShorts) {
    videoId = url.match(/shorts\/([a-zA-Z0-9_-]+)/)?.[1];
  } else {
    try { videoId = new URL(url).searchParams.get('v'); } catch {}
  }

  const video = document.querySelector('#movie_player video, ytd-player video, video');
  if (!video || video.readyState < 1) return null;

  let channel = null, channelUrl = null;
  const chEl = document.querySelector(
    '#channel-name a, #owner a, ytd-channel-name a, .ytd-video-owner-renderer a, a.yt-simple-endpoint.yt-formatted-string'
  );
  if (chEl) {
    channel = chEl.textContent.trim();
    if (chEl.href) channelUrl = chEl.href;
  }

  const rawTitle = document.title.replace(/ - YouTube$/, '').trim();
  const favicon = getIcon('youtube.com');
  const thumb = videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : favicon;

  const activity = buildVideoActivity(video, url, thumb, rawTitle, channel, channelUrl);
  activity.title = isLive ? 'YouTube Live' : isShorts ? 'YouTube Shorts' : 'YouTube';
  activity.largeImage = thumb;
  activity.videoUrl = videoId ? `https://youtube.com/watch?v=${videoId}` : url;

  return activity;
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
    for (const evt of ['play', 'pause', 'seeked', 'ended']) {
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

setInterval(() => {
  if (!isExtensionValid()) return;
  doSend();
}, findActiveVideo() ? 5000 : 30000);
