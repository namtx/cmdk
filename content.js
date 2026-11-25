// Hosts the palette as an isolated iframe overlay on regular web pages.
(() => {
  if (window.__cmdkLoaded) return;
  window.__cmdkLoaded = true;

  const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  const PALETTE_URL = chrome.runtime.getURL('palette.html?mode=overlay');

  let host = null;
  let frame = null;
  let prevFocus = null;
  let lastToggle = 0;

  function open() {
    if (host) return;
    prevFocus = document.activeElement;

    host = document.createElement('cmdk-root');
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'closed' });

    frame = document.createElement('iframe');
    frame.src = PALETTE_URL;
    frame.allow = 'clipboard-write';
    frame.setAttribute('allowtransparency', 'true');
    // color-scheme must match the iframe document's (normal), or Chrome paints
    // an opaque backdrop behind the iframe.
    frame.style.cssText =
      'position:fixed;inset:0;width:100%;height:100%;border:0;margin:0;padding:0;' +
      'background:transparent;color-scheme:normal;display:block;';
    frame.addEventListener('load', () => frame && frame.focus());

    shadow.appendChild(frame);
    document.documentElement.appendChild(host);
  }

  function close() {
    if (!host) return;
    host.remove();
    host = frame = null;
    try {
      prevFocus?.focus?.({ preventScroll: true });
    } catch {}
    prevFocus = null;
  }

  function toggle() {
    // The browser shortcut and the keydown fallback can both fire; only count one.
    const now = Date.now();
    if (now - lastToggle < 250) return;
    lastToggle = now;
    host ? close() : open();
  }

  // Fallback when the Chrome shortcut isn't assigned. It also takes ⌘K back from
  // sites that bind it themselves, the way Arc does.
  window.addEventListener(
    'keydown',
    (e) => {
      const mod = IS_MAC ? e.metaKey : e.ctrlKey;
      if (mod && !e.shiftKey && !e.altKey && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        toggle();
      }
    },
    true
  );

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === 'cmdk:toggle') {
      toggle();
      sendResponse({ ok: true });
    }
  });

  window.addEventListener('message', (e) => {
    if (frame && e.source === frame.contentWindow && e.data?.type === 'cmdk:close') close();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) close();
  });
})();
