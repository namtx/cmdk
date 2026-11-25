// Routes the ⌘K shortcut (and toolbar button) to the right place:
//  1. An in-page overlay via the content script (normal web pages).
//  2. A small centered popup window when the page can't host an overlay
//     (chrome:// pages, the New Tab page, the Web Store, PDFs, ...).

const PALETTE_URL = chrome.runtime.getURL('palette.html');

chrome.commands.onCommand.addListener((command) => {
  if (command === 'toggle-palette') togglePalette();
});

chrome.action.onClicked.addListener(() => togglePalette());

async function togglePalette() {
  // If the popup-window palette is already open, the shortcut closes it.
  const existing = await findPaletteWindow();
  if (existing) {
    await chrome.windows.remove(existing.id).catch(() => {});
    return;
  }

  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab && (await tryOverlay(tab))) return;
  await openPaletteWindow(tab);
}

async function tryOverlay(tab) {
  if (await sendToggle(tab.id)) return true;

  // The tab was open before the extension was installed or reloaded, so it has
  // no content script yet. Inject one if this page allows scripts.
  const url = tab.url || '';
  if (!/^(https?|file):/.test(url)) return false;
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
  } catch {
    return false;
  }
  return sendToggle(tab.id);
}

async function sendToggle(tabId) {
  try {
    const res = await chrome.tabs.sendMessage(tabId, { type: 'cmdk:toggle' });
    return !!res?.ok;
  } catch {
    return false;
  }
}

async function findPaletteWindow() {
  const wins = await chrome.windows.getAll({ populate: true, windowTypes: ['popup'] });
  return wins.find((w) => w.tabs?.some((t) => (t.url || t.pendingUrl || '').startsWith(PALETTE_URL)));
}

async function openPaletteWindow(tab) {
  const width = 680;
  const height = 500;
  const opts = { type: 'popup', width, height, focused: true };

  if (tab) {
    try {
      const win = await chrome.windows.get(tab.windowId);
      opts.left = Math.max(0, Math.round(win.left + (win.width - width) / 2));
      opts.top = Math.max(0, Math.round(win.top + Math.min(140, (win.height - height) / 3)));
    } catch {}
  }

  const params = new URLSearchParams({ mode: 'window' });
  if (tab) {
    params.set('tab', String(tab.id));
    params.set('win', String(tab.windowId));
  }
  opts.url = `${PALETTE_URL}?${params}`;
  await chrome.windows.create(opts);
}
