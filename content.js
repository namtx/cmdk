// Hosts the palette as an isolated iframe overlay on regular web pages.
(() => {
  if (window.__cmdkLoaded) return;
  window.__cmdkLoaded = true;

  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const PALETTE_URL = chrome.runtime.getURL('palette.html?mode=overlay');

  let host = null;
  let frame = null;
  let sid = null; // per-open secret so only this overlay accepts forwarded keys
  let prevFocus = null;
  let lastToggle = 0;

  function open() {
    if (host) return;
    prevFocus = document.activeElement;
    // Drop focus from the page's editor/input so it can't keep the caret.
    if (prevFocus && prevFocus !== document.body) {
      try { prevFocus.blur(); } catch {}
    }

    sid = crypto.randomUUID();
    host = document.createElement('cmdk-root');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'closed' });

    frame = document.createElement('iframe');
    frame.src = `${PALETTE_URL}&sid=${sid}`;
    frame.allow = 'clipboard-write';
    frame.setAttribute('allowtransparency', 'true');
    // color-scheme must match the iframe document's (normal), or Chrome paints
    // an opaque backdrop behind the iframe.
    frame.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;' +
      'background:transparent;color-scheme:normal;display:block;';
    frame.addEventListener('load', focusFrame);

    shadow.appendChild(frame);
    document.documentElement.appendChild(host);
    focusFrame();
  }

  function focusFrame() {
    if (!frame) return;
    try {
      frame.focus();
      frame.contentWindow?.focus();
    } catch {}
  }

  function close() {
    if (!host) return;
    host.remove();
    host = frame = sid = null;
    try {
      prevFocus?.focus?.({ preventScroll: true });
    } catch {}
    prevFocus = null;
  }

  function toggle() {
    // The browser shortcut and the keydown fallback can both fire; only count one.
    const now = Date.now();
    if (now - lastToggle < 150) return;
    lastToggle = now;
    host ? close() : open();
  }

  window.addEventListener(
    'keydown',
    (e) => {
      const mod = IS_MAC ? e.metaKey : e.ctrlKey;
      const isToggle = mod && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K');

      if (isToggle) {
        // Fallback when the Chrome shortcut isn't assigned. It also takes ⌘K back
        // from sites that bind it themselves, the way Arc does.
        e.preventDefault();
        e.stopImmediatePropagation();
        toggle();
        return;
      }

      if (!host) return;

      // While the overlay is open, keys only reach the page if focus didn't make
      // it into the iframe (still loading, or the page pulled focus back).
      // Keep them away from the page, pass the text on, and retry focus.
      e.preventDefault();
      e.stopImmediatePropagation();
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (!e.metaKey && !e.ctrlKey && !e.altKey && (e.key.length === 1 || e.key === 'Backspace')) {
        chrome.runtime.sendMessage({ type: 'cmdk:key', sid, key: e.key }).catch(() => {});
      }
      focusFrame();
    },
    true
  );

  // Pages with focus traps (dialogs, rich editors) often grab focus back when
  // it moves into the overlay. Hide those focus changes from page scripts while
  // the overlay is open. This listener is registered at document_start, so it
  // runs before the page's own listeners.
  for (const type of ['focusin', 'focusout', 'focus', 'blur']) {
    window.addEventListener(
      type,
      (e) => {
        if (host && (e.target === host || e.relatedTarget === host || e.target === window)) {
          e.stopImmediatePropagation();
        }
      },
      true
    );
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'cmdk:toggle') {
      toggle();
      sendResponse({ ok: true });
    }
  });

  window.addEventListener('message', (e) => {
    if (!frame || e.source !== frame.contentWindow) return;
    const type = e.data?.type;
    if (type === 'cmdk:close') close();
    else if (type === 'cmdk:focus') focusFrame();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) close();
  });
})();
