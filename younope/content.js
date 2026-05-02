(() => {
  let nuked = false;
  let navInterval = null;

  // --- PHASE 1: INSTANT BLACKOUT (runs at document_start, before any paint) ---
  const cloak = document.createElement('style');
  cloak.textContent = 'html { opacity: 0 !important; }';
  (document.head || document.documentElement).appendChild(cloak);

  // If URL is a channel page (/@handle), resolve instantly from URL
  function decodeHandle(raw) { try { return decodeURIComponent(raw).toLowerCase(); } catch { return raw.toLowerCase(); } }
  const urlMatch = location.pathname.match(/^\/@([^/?]+)/);
  const urlHandle = urlMatch ? decodeHandle(urlMatch[1]) : null;

  chrome.storage.local.get({ blocked: [] }, ({ blocked }) => {
    if (urlHandle && blocked.includes(urlHandle)) {
      nukeAndShowCat(urlHandle);
      return;
    }
    if (!blocked.length) {
      uncloak();
      startFeedCleaner(blocked);
      return;
    }
    if (location.pathname === '/watch' || location.pathname.startsWith('/shorts/')) {
      waitForChannelData(blocked);
    } else {
      uncloak();
      startFeedCleaner(blocked);
    }
  });

  // --- PHASE 2: INTERCEPT YOUTUBE'S INLINE DATA (before DOM renders) ---
  function waitForChannelData(blockedList) {
    const blocked = new Set(blockedList);
    let resolved = false;
    const deadline = setTimeout(() => { if (!resolved) { resolved = true; uncloak(); startFeedCleaner(blockedList); } }, 3000);

    const scriptObserver = new MutationObserver((mutations) => {
      if (resolved) return;
      for (const mut of mutations) {
        for (const node of mut.addedNodes) {
          if (node.nodeType !== 1 || node.tagName !== 'SCRIPT' || node.src) continue;
          const text = node.textContent;
          const match = text.match(/"ownerProfileUrl"\s*:\s*"https?:\/\/www\.youtube\.com\/@([^"]+)"/)
                     || text.match(/"channelHandle"\s*:\s*"@?([^"]+)"/)
                     || text.match(/"vanityChannelUrl"\s*:\s*"[^"]*\/@([^"]+)"/);
          if (match) {
            const handle = match[1].toLowerCase();
            resolved = true;
            clearTimeout(deadline);
            scriptObserver.disconnect();
            if (blocked.has(handle)) {
              nukeAndShowCat(handle);
            } else {
              uncloak();
              startFeedCleaner(blockedList);
            }
            return;
          }
        }
      }
    });
    scriptObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function uncloak() { cloak.remove(); }

  // --- CAT PAGE ---
  const CAT_URLS = [
    'https://cataas.com/cat/cute',
    'https://cataas.com/cat/gif',
    'https://cataas.com/cat/says/NOPE',
  ];
  const QUOTES = [
    "This channel has been yeeted from your reality.",
    "You don't need this energy in your life.",
    "The cat has spoken. This channel is blocked.",
    "Nothing to see here. Just vibes and cats.",
    "You blocked this channel. Past you was wise.",
    "This content has been replaced with something better: cats.",
    "Your future self thanks you for this block.",
    "Congrats! You've unlocked: inner peace.",
  ];
  function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function nukeAndShowCat(channelName) {
    channelName = escapeHtml(channelName);
    nuked = true;
    clearInterval(navInterval);
    document.querySelectorAll('video, audio').forEach(el => {
      el.pause();
      el.removeAttribute('src');
      el.load();
      el.remove();
    });
    document.documentElement.innerHTML = `
    <head><title>\u{1F6AB} YouNope</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body {
        min-height: 100vh; display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        background: #0f0f0f; color: #e1e1e1; font-family: system-ui, sans-serif;
        text-align: center; padding: 24px;
      }
      .badge { background: #ff4444; color: #fff; font-weight: 700; font-size: 14px;
        padding: 6px 16px; border-radius: 99px; margin-bottom: 24px;
        letter-spacing: 1px; text-transform: uppercase; }
      img { max-width: 420px; width: 100%; border-radius: 16px;
        box-shadow: 0 8px 32px rgba(0,0,0,.6); margin-bottom: 24px; }
      h1 { font-size: 28px; margin-bottom: 12px; }
      p { font-size: 16px; color: #888; max-width: 500px; line-height: 1.5; }
      .channel { color: #ff4444; font-weight: 600; }
      .back { margin-top: 24px; color: #555; font-size: 13px; }
      .back a { color: #ff4444; text-decoration: none; }
      .back a:hover { text-decoration: underline; }
    </style></head>
    <body>
      <div class="badge">BLOCKED</div>
      <img src="${pickRandom(CAT_URLS)}" alt="A very cute cat" />
      <h1>\u{1F431} Nope!</h1>
      <p>${pickRandom(QUOTES)}</p>
      <p style="margin-top:8px">You blocked <span class="channel">@${channelName}</span>.</p>
      <div class="back"><a href="https://www.youtube.com">\u2190 Take me home</a></div>
    </body>`;
  }

  // --- FEED CLEANING ---
  function removeBlockedFromFeed(blocked) {
    if (nuked) return;
    const selectors = 'ytd-rich-item-renderer,ytd-video-renderer,ytd-compact-video-renderer,ytd-grid-video-renderer,ytd-reel-item-renderer,ytd-shelf-renderer';
    document.querySelectorAll(selectors).forEach(item => {
      item.querySelectorAll('a[href*="/@"]').forEach(a => {
        const m = (a.getAttribute('href') || '').match(/\/@([^/?]+)/);
        if (m && blocked.has(m[1].toLowerCase())) item.remove();
      });
    });
  }

  function startFeedCleaner(blockedList) {
    if (!blockedList.length) return;
    const blocked = new Set(blockedList);
    let feedTimer = null;
    const throttledClean = () => {
      if (feedTimer || nuked) return;
      feedTimer = setTimeout(() => { feedTimer = null; removeBlockedFromFeed(blocked); }, 200);
    };
    const observe = () => {
      new MutationObserver(throttledClean)
        .observe(document.body, { childList: true, subtree: true });
    };
    document.body ? observe() : document.addEventListener('DOMContentLoaded', observe);
  }

  // --- SPA NAVIGATION ---
  let blockBtnInjected = false;
  let lastUrl = location.href;
  const navCheck = () => {
    if (nuked || location.href === lastUrl) return;
    lastUrl = location.href;
    blockBtnInjected = false;

    // Only cloak pages that might be blocked (video/shorts/channel), not feeds
    const needsCloak = location.pathname === '/watch' || location.pathname.startsWith('/shorts/') || location.pathname.startsWith('/@');
    if (needsCloak) {
      const existing = document.getElementById('cn-cloak');
      if (existing) existing.remove();
      const c = document.createElement('style');
      c.id = 'cn-cloak';
      c.textContent = 'html { opacity: 0 !important; }';
      document.documentElement.appendChild(c);
    }

    chrome.storage.local.get({ blocked: [] }, ({ blocked }) => {
      const removeCloak = () => { const el = document.getElementById('cn-cloak'); if (el) el.remove(); };
      if (!blocked.length) { removeCloak(); return; }

      const um = location.pathname.match(/^\/@([^/?]+)/);
      if (um && blocked.includes(um[1].toLowerCase())) { nukeAndShowCat(um[1].toLowerCase()); return; }

      if (location.pathname === '/watch' || location.pathname.startsWith('/shorts/')) {
        let attempts = 0;
        const poll = setInterval(() => {
          if (++attempts > 30) { clearInterval(poll); removeCloak(); return; }
          for (const a of document.querySelectorAll('#owner a[href*="/@"], ytd-video-owner-renderer a[href*="/@"], ytd-channel-name a[href*="/@"]')) {
            const m = (a.getAttribute('href') || '').match(/\/@([^/?]+)/);
            if (m) {
              clearInterval(poll);
              if (new Set(blocked).has(m[1].toLowerCase())) { nukeAndShowCat(m[1].toLowerCase()); } else { removeCloak(); startFeedCleaner(blocked); }
              return;
            }
          }
        }, 100);
      } else {
        removeCloak();
        startFeedCleaner(blocked);
      }
    });
  };

  window.addEventListener('popstate', navCheck);
  navInterval = setInterval(navCheck, 300);

  // --- INLINE BLOCK BUTTON (next to subscribe) ---
  function getCurrentHandle() {
    const um = location.pathname.match(/^\/@([^/?]+)/);
    if (um) return um[1].toLowerCase();
    for (const a of document.querySelectorAll('#owner a[href*="/@"], ytd-video-owner-renderer a[href*="/@"], ytd-channel-name a[href*="/@"]')) {
      const m = (a.getAttribute('href') || '').match(/\/@([^/?]+)/);
      if (m) return m[1].toLowerCase();
    }
    return null;
  }

  function injectBlockButton() {
    if (nuked || blockBtnInjected) return;
    const handle = getCurrentHandle();
    if (!handle) return;
    blockBtnInjected = true;

    // Remove any stale buttons
    document.querySelectorAll('.cn-block-btn').forEach(el => el.remove());

    const sub = document.querySelector('#owner #subscribe-button, #owner ytd-subscribe-button-renderer');
    if (!sub) { blockBtnInjected = false; return; }

    chrome.storage.local.get({ blocked: [] }, ({ blocked }) => {
      if (blocked.includes(handle)) return;
      document.querySelectorAll('.cn-block-btn').forEach(el => el.remove());
      const btn = document.createElement('button');
      btn.className = 'cn-block-btn';
      btn.textContent = '\u{1F6AB} Nope';
      btn.style.cssText = 'margin-left:8px;padding:8px 16px;background:#ff4444;color:#fff;border:none;border-radius:20px;font-size:13px;font-weight:600;cursor:pointer;vertical-align:middle;';
      btn.onmouseenter = () => btn.style.background = '#cc3333';
      btn.onmouseleave = () => btn.style.background = '#ff4444';
      btn.addEventListener('click', () => {
        blocked.push(handle);
        chrome.storage.local.set({ blocked }, () => nukeAndShowCat(handle));
      });
      sub.parentElement.insertBefore(btn, sub.nextSibling);
    });
  }

  // Inject button once the subscribe area loads
  function waitForSubscribeButton() {
    const tryInject = () => {
      if (location.pathname === '/watch' || location.pathname.startsWith('/shorts/') || location.pathname.startsWith('/@')) {
        injectBlockButton();
      }
    };
    const btnObserver = new MutationObserver(tryInject);
    document.body ? btnObserver.observe(document.body, { childList: true, subtree: true }) :
      document.addEventListener('DOMContentLoaded', () => btnObserver.observe(document.body, { childList: true, subtree: true }));
  }
  waitForSubscribeButton();

  // Respond to popup asking for current channel
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'getChannel') {
      sendResponse({ handle: getCurrentHandle() });
    }
  });

  // Live updates when user blocks a channel from the popup
  chrome.storage.onChanged.addListener((changes) => {
    if (nuked || !changes.blocked) return;
    const blocked = new Set(changes.blocked.newValue || []);
    if (!blocked.size) return;
    const ids = new Set();
    const um = location.pathname.match(/^\/@([^/?]+)/);
    if (um) ids.add(um[1].toLowerCase());
    document.querySelectorAll('#owner a[href*="/@"], ytd-video-owner-renderer a[href*="/@"]').forEach(a => {
      const m = (a.getAttribute('href') || '').match(/\/@([^/?]+)/);
      if (m) ids.add(m[1].toLowerCase());
    });
    for (const id of ids) { if (blocked.has(id)) { nukeAndShowCat(id); return; } }
  });
})();
