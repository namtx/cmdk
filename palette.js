'use strict';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const params = new URLSearchParams(location.search);
const MODE = params.get('mode') === 'window' ? 'window' : 'overlay';
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
document.body.classList.add(MODE);

const input = document.getElementById('q');
const list = document.getElementById('list');
const footer = document.getElementById('footer');
const toastEl = document.getElementById('toast');

const ctx = { tab: null, windowId: undefined, tabs: [] };
const state = { flat: [], sel: 0, token: 0, userMoved: false, busy: false, closing: false };

const SUGGESTED = ['new-tab', 'reopen', 'copy-url', 'pin', 'duplicate', 'new-window'];

const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  window: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18"/>',
  incognito: '<circle cx="7" cy="16" r="3"/><circle cx="17" cy="16" r="3"/><path d="M10 16h4M3 11h18M6 11l2-6h8l2 6"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  pin: '<path d="M12 17v5M9 3h6l-1 6 3 3v2H7v-2l3-3z"/>',
  volume: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 6a9 9 0 0 1 0 12"/>',
  mute: '<path d="M11 5L6 9H3v6h3l5 4z"/><path d="M16 9l5 6M21 9l-5 6"/>',
  reload: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  duplicate: '<rect x="3" y="3" width="13" height="13" rx="2"/><path d="M8 21h11a2 2 0 0 0 2-2V8"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  puzzle: '<path d="M4 8h4V6a2 2 0 1 1 4 0v2h4v4h-2a2 2 0 1 0 0 4h2v4H4z"/>',
  keyboard: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
  out: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  restore: '<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/>',
  back: '<path d="M19 12H5M12 19l-7-7 7-7"/>',
  forward: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/>',
  zoomReset: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/><circle cx="11" cy="11" r="1.5"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  tabsRight: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M13 5v14M16 10l2 2-2 2"/>',
  closeOthers: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 10l4 4M14 10l-4 4"/>',
};

const svg = (name) =>
  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ICONS.globe}</svg>`;

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

const SID = params.get('sid');

init();

async function init() {
  ensureFocus();
  ctx.tab = await getTargetTab();
  ctx.windowId = ctx.tab?.windowId;
  await refreshTabs();
  await update();
}

async function getTargetTab() {
  if (MODE === 'window') {
    const id = Number(params.get('tab'));
    if (id) {
      try { return await chrome.tabs.get(id); } catch {}
    }
    const win = Number(params.get('win'));
    if (win) {
      const [t] = await chrome.tabs.query({ active: true, windowId: win }).catch(() => []);
      if (t) return t;
    }
    const [t] = await chrome.tabs.query({ active: true, lastFocusedWindow: true, windowType: 'normal' });
    return t || null;
  }
  try {
    const t = await chrome.tabs.getCurrent();
    if (t) return t;
  } catch {}
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t || null;
}

async function refreshTabs() {
  const paletteUrl = chrome.runtime.getURL('palette.html');
  const all = await chrome.tabs.query({});
  ctx.tabs = all.filter((t) => !(t.url || '').startsWith(paletteUrl));
  if (ctx.tab) ctx.tab = ctx.tabs.find((t) => t.id === ctx.tab.id) || ctx.tab;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

function buildActions() {
  const t = ctx.tab;
  const w = ctx.windowId;
  const A = [];
  const add = (a) => A.push({ kind: 'action', hintAlways: true, ...a, id: a.id, hint: a.shortcut ? keys(a.shortcut) : '' });

  add({ id: 'new-tab', title: 'New Tab', icon: 'plus', keys: 'open create blank', shortcut: '⌘T',
    run: () => chrome.tabs.create(clean({ windowId: w })) });
  add({ id: 'new-window', title: 'New Window', icon: 'window', keys: 'open create', shortcut: '⌘N',
    run: () => chrome.windows.create({}) });
  add({ id: 'incognito', title: 'New Incognito Window', icon: 'incognito', keys: 'private', shortcut: '⇧⌘N',
    run: () => chrome.windows.create({ incognito: true }) });
  add({ id: 'reopen', title: 'Reopen Closed Tab', icon: 'restore', keys: 'undo restore recently closed', shortcut: '⇧⌘T',
    run: () => chrome.sessions.restore() });

  if (t) {
    add({ id: 'close-tab', title: 'Close Tab', icon: 'x', keys: 'remove', shortcut: '⌘W',
      run: () => chrome.tabs.remove(t.id) });
    add({ id: 'copy-url', title: 'Copy URL', icon: 'copy', keys: 'link clipboard address', shortcut: '⇧⌘C',
      run: async () => { await copyText(t.url); return { toast: 'Copied URL' }; } });
    add({ id: 'copy-md', title: 'Copy as Markdown Link', icon: 'link', keys: 'clipboard title url',
      run: async () => { await copyText(`[${(t.title || t.url).replace(/[[\]]/g, '\\$&')}](${t.url})`); return { toast: 'Copied Markdown link' }; } });
    add({ id: 'pin', title: t.pinned ? 'Unpin Tab' : 'Pin Tab', icon: 'pin', keys: 'pin unpin',
      run: () => chrome.tabs.update(t.id, { pinned: !t.pinned }) });
    add({ id: 'duplicate', title: 'Duplicate Tab', icon: 'duplicate', keys: 'copy clone',
      run: () => chrome.tabs.duplicate(t.id) });
    add({ id: 'mute', title: t.mutedInfo?.muted ? 'Unmute Tab' : 'Mute Tab', icon: t.mutedInfo?.muted ? 'volume' : 'mute', keys: 'sound audio silence',
      run: () => chrome.tabs.update(t.id, { muted: !t.mutedInfo?.muted }) });
    add({ id: 'reload', title: 'Reload Tab', icon: 'reload', keys: 'refresh', shortcut: '⌘R',
      run: () => chrome.tabs.reload(t.id) });
    add({ id: 'hard-reload', title: 'Hard Reload Tab', icon: 'reload', keys: 'refresh cache bypass', shortcut: '⇧⌘R',
      run: () => chrome.tabs.reload(t.id, { bypassCache: true }) });
    add({ id: 'back', title: 'Go Back', icon: 'back', keys: 'previous navigate', shortcut: '⌘[',
      run: () => chrome.tabs.goBack(t.id) });
    add({ id: 'forward', title: 'Go Forward', icon: 'forward', keys: 'next navigate', shortcut: '⌘]',
      run: () => chrome.tabs.goForward(t.id) });
    add({ id: 'bookmark', title: 'Bookmark This Tab', icon: 'bookmark', keys: 'save favorite star', shortcut: '⌘D',
      run: async () => {
        const existing = await chrome.bookmarks.search({ url: t.url }).catch(() => []);
        if (existing.length) return { toast: 'Already bookmarked' };
        await chrome.bookmarks.create({ title: t.title, url: t.url });
        return { toast: 'Bookmarked' };
      } });
    add({ id: 'move-window', title: 'Move Tab to New Window', icon: 'out', keys: 'detach split',
      run: () => chrome.windows.create({ tabId: t.id }) });
    add({ id: 'open-incognito', title: 'Open Tab in Incognito', icon: 'incognito', keys: 'private',
      run: () => chrome.windows.create({ url: t.url, incognito: true }) });
    add({ id: 'close-others', title: 'Close Other Tabs', icon: 'closeOthers', keys: 'remove cleanup',
      run: async () => {
        const ids = ctx.tabs.filter((x) => x.windowId === w && x.id !== t.id && !x.pinned).map((x) => x.id);
        if (ids.length) await chrome.tabs.remove(ids);
      } });
    add({ id: 'close-right', title: 'Close Tabs to the Right', icon: 'tabsRight', keys: 'remove cleanup',
      run: async () => {
        const ids = ctx.tabs.filter((x) => x.windowId === w && x.index > t.index && !x.pinned).map((x) => x.id);
        if (ids.length) await chrome.tabs.remove(ids);
      } });
    add({ id: 'close-dupes', title: 'Close Duplicate Tabs', icon: 'layers', keys: 'remove cleanup dedupe',
      run: async () => {
        const seen = new Set();
        const dupes = [];
        // Keep the current tab, then the leftmost copy of each URL.
        const ordered = ctx.tabs.filter((x) => x.windowId === w).sort((a, b) => (b.id === t.id) - (a.id === t.id) || a.index - b.index);
        for (const x of ordered) {
          const key = normUrl(x.url);
          if (seen.has(key)) dupes.push(x.id);
          else seen.add(key);
        }
        if (dupes.length) await chrome.tabs.remove(dupes);
        return { toast: dupes.length ? `Closed ${dupes.length} duplicate${dupes.length > 1 ? 's' : ''}` : 'No duplicates' };
      } });
    add({ id: 'zoom-in', title: 'Zoom In', icon: 'zoomIn', keys: 'bigger larger', shortcut: '⌘+',
      run: async () => chrome.tabs.setZoom(t.id, Math.min(5, (await chrome.tabs.getZoom(t.id)) + 0.1)) });
    add({ id: 'zoom-out', title: 'Zoom Out', icon: 'zoomOut', keys: 'smaller', shortcut: '⌘-',
      run: async () => chrome.tabs.setZoom(t.id, Math.max(0.25, (await chrome.tabs.getZoom(t.id)) - 0.1)) });
    add({ id: 'zoom-reset', title: 'Reset Zoom', icon: 'zoomReset', keys: 'actual size 100', shortcut: '⌘0',
      run: () => chrome.tabs.setZoom(t.id, 0) });
  }

  const page = (id, title, url, icon, kw, shortcut) =>
    add({ id, title, icon, keys: kw, shortcut, run: () => openUrl(url, {}) });
  page('history', 'Open History', 'chrome://history', 'history', 'browsing visited', '⌘Y');
  page('downloads', 'Open Downloads', 'chrome://downloads', 'download', 'files', '⇧⌘J');
  page('bookmarks', 'Open Bookmark Manager', 'chrome://bookmarks', 'bookmark', 'favorites', '⌥⌘B');
  page('settings', 'Open Settings', 'chrome://settings', 'settings', 'preferences options', '⌘,');
  page('extensions', 'Manage Extensions', 'chrome://extensions', 'puzzle', 'addons plugins');
  page('shortcuts', 'Customize Keyboard Shortcuts', 'chrome://extensions/shortcuts', 'keyboard', 'hotkey keybinding command k');

  return A;
}

// ---------------------------------------------------------------------------
// Result items
// ---------------------------------------------------------------------------

function tabItem(t) {
  return {
    id: 'tab:' + t.id,
    kind: 'tab',
    title: t.title || t.url,
    subtitle: cleanUrl(t.url),
    favicon: t.favIconUrl && /^(https?|data):/.test(t.favIconUrl) ? t.favIconUrl : faviconUrl(t.url),
    fallback: faviconUrl(t.url),
    hint: t.windowId === ctx.windowId ? 'Switch to Tab' : 'Switch to Tab (other window)',
    fields: [[t.title, 1, true], [cleanUrl(t.url), 0.85, false]],
    tab: t,
    run: async () => {
      await chrome.tabs.update(t.id, { active: true });
      await chrome.windows.update(t.windowId, { focused: true });
    },
  };
}

function bookmarkItem(b) {
  return {
    id: 'bm:' + b.id,
    kind: 'bookmark',
    title: b.title || cleanUrl(b.url),
    subtitle: cleanUrl(b.url),
    favicon: faviconUrl(b.url),
    hint: 'Open',
    fields: [[b.title, 1, true], [cleanUrl(b.url), 0.85, false]],
    url: b.url,
    run: (m) => openUrl(b.url, m),
  };
}

function historyItem(h) {
  return {
    id: 'h:' + h.id,
    kind: 'history',
    title: h.title || cleanUrl(h.url),
    subtitle: cleanUrl(h.url),
    favicon: faviconUrl(h.url),
    hint: 'Open',
    fields: [[h.title, 1, true], [cleanUrl(h.url), 0.85, false]],
    boost: Math.min(h.visitCount || 0, 40) / 400 + Math.min(h.typedCount || 0, 10) / 200,
    url: h.url,
    run: (m) => openUrl(h.url, m),
  };
}

function headItems(q) {
  const items = [];
  const url = toUrl(q);
  if (url) {
    items.push({
      id: 'url', kind: 'url', title: cleanUrl(url) || url, subtitle: 'Open URL', icon: 'globe',
      favicon: /^https?:/.test(url) ? faviconUrl(url) : null, hint: 'Open',
      run: (m) => openUrl(url, m),
    });
  }
  items.push({
    id: 'search', kind: 'search', title: `Search for “${q}”`, subtitle: 'Default search engine', icon: 'search',
    hint: 'Search', run: (m) => webSearch(q, m),
  });
  return items;
}

// ---------------------------------------------------------------------------
// Searching and ranking
// ---------------------------------------------------------------------------

async function update() {
  const raw = input.value.trimStart();
  const token = ++state.token;
  const actions = buildActions();

  // ">" prefix: command mode, listing only actions (like VS Code's palette).
  const commandMode = raw.startsWith('>');
  document.body.classList.toggle('commands', commandMode);
  if (commandMode) {
    const cq = raw.slice(1).trim();
    const items = cq ? rank(actions, tokenize(cq)) : actions;
    render([{ title: 'Commands', items }]);
    return;
  }

  const q = raw.trim();
  const otherTabs = ctx.tabs.filter((t) => t.id !== ctx.tab?.id);

  if (!q) {
    const recent = [...otherTabs].sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0)).slice(0, 6).map(tabItem);
    const sugg = SUGGESTED.map((id) => actions.find((a) => a.id === id)).filter(Boolean);
    render([{ title: 'Open Tabs', items: recent }, { title: 'Actions', items: sugg }]);
    return;
  }

  const tokens = tokenize(q);
  const base = {
    head: headItems(q),
    tabs: rank(otherTabs.map(tabItem), tokens).slice(0, 8),
    acts: rank(actions, tokens).slice(0, 6),
  };
  compose(base, [], []);

  const [bms, hist] = await Promise.all([
    chrome.bookmarks.search(q).catch(() => []),
    chrome.history.search({ text: q, maxResults: 60, startTime: 0 }).catch(() => []),
  ]);
  if (token !== state.token) return;

  const seen = new Set(ctx.tabs.map((t) => normUrl(t.url)));
  const bmItems = rank(bms.filter((b) => b.url && !seen.has(normUrl(b.url))).map(bookmarkItem), tokens).slice(0, 5);
  bmItems.forEach((b) => seen.add(normUrl(b.url)));
  const hItems = rank(hist.filter((h) => !seen.has(normUrl(h.url))).map(historyItem), tokens).slice(0, 8);

  compose(base, bmItems, hItems);
}

function compose(base, bookmarks, history) {
  // A strong match (prefix or word-start) is promoted above the search row.
  let top = null;
  for (const it of [...base.tabs, ...base.acts, ...bookmarks]) {
    if (it.score >= 0.85 && (!top || it.score > top.score)) top = it;
  }
  const rest = (arr) => arr.filter((i) => i !== top);
  render([
    top && { title: 'Top Hit', items: [top] },
    { title: '', items: base.head },
    { title: 'Tabs', items: rest(base.tabs) },
    { title: 'Actions', items: rest(base.acts) },
    { title: 'Bookmarks', items: rest(bookmarks) },
    { title: 'History', items: history },
  ]);
}

function tokenize(q) {
  return q.toLowerCase().split(/\s+/).filter(Boolean);
}

function rank(items, tokens) {
  const out = [];
  for (const it of items) {
    let total = 0;
    let ok = true;
    for (const tok of tokens) {
      let best = 0;
      for (const [text, weight, fuzzy] of it.fields || [[it.title, 1, true], [it.keys, 0.8, false]]) {
        best = Math.max(best, matchScore(tok, text, fuzzy) * weight);
      }
      if (best === 0) { ok = false; break; }
      total += best;
    }
    if (!ok) continue;
    it.score = total / tokens.length + (it.boost || 0);
    if (it.score < 0.3) continue;
    it.titleHtml = highlight(it.title, tokens);
    out.push(it);
  }
  return out.sort((a, b) => b.score - a.score);
}

function matchScore(q, text, fuzzy) {
  if (!text) return 0;
  const t = text.toLowerCase();
  const i = t.indexOf(q);
  if (i === 0) return 1;
  if (i > 0) {
    if (/[\s\-_/.:([]/.test(t[i - 1])) return 0.9;
    return 0.72 - Math.min(i, 40) / 400;
  }
  if (!fuzzy || q.length < 2) return 0;
  // Subsequence match ("gml" -> "Gmail"), scored by how tight it is.
  let from = 0;
  let last = -1;
  let gaps = 0;
  for (const ch of q) {
    const f = t.indexOf(ch, from);
    if (f < 0) return 0;
    if (last >= 0) gaps += f - last - 1;
    last = f;
    from = f + 1;
  }
  const firstBonus = t.indexOf(q[0]) === 0 ? 0.1 : 0;
  return Math.max(0, 0.55 + firstBonus - gaps / (q.length * 6));
}

function highlight(text, tokens) {
  const lower = (text || '').toLowerCase();
  const ranges = [];
  for (const tok of tokens) {
    const i = lower.indexOf(tok);
    if (i >= 0) ranges.push([i, i + tok.length]);
  }
  if (!ranges.length) return esc(text);
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const r of ranges) {
    const l = merged[merged.length - 1];
    if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]);
    else merged.push([...r]);
  }
  let out = '';
  let p = 0;
  for (const [s, e] of merged) {
    out += esc(text.slice(p, s)) + '<mark>' + esc(text.slice(s, e)) + '</mark>';
    p = e;
  }
  return out + esc(text.slice(p));
}

// ---------------------------------------------------------------------------
// Rendering and selection
// ---------------------------------------------------------------------------

function render(sections) {
  const prevId = state.userMoved ? state.flat[state.sel]?.id : null;
  state.flat = [];
  const frag = document.createDocumentFragment();

  for (const sec of sections) {
    if (!sec || !sec.items.length) continue;
    if (sec.title) {
      const h = document.createElement('div');
      h.className = 'section';
      h.textContent = sec.title;
      frag.append(h);
    }
    for (const it of sec.items) {
      const idx = state.flat.push(it) - 1;
      frag.append(rowFor(it, idx));
    }
  }

  list.replaceChildren(frag);
  if (!state.flat.length) list.innerHTML = '<div class="empty">No results</div>';

  let sel = 0;
  if (prevId) {
    const i = state.flat.findIndex((x) => x.id === prevId);
    if (i >= 0) sel = i;
  }
  select(sel);
}

function rowFor(it, idx) {
  const row = document.createElement('div');
  row.className = 'item';
  row.dataset.idx = idx;
  row.id = 'opt-' + idx;
  row.setAttribute('role', 'option');
  const icon = it.favicon
    ? `<img src="${esc(it.favicon)}" data-fb="${esc(it.fallback || '')}" alt="">`
    : svg(it.icon);
  row.innerHTML =
    `<span class="icon">${icon}</span>` +
    `<span class="text"><span class="title">${it.titleHtml ?? esc(it.title)}</span>` +
    (it.subtitle ? `<span class="sub">${esc(it.subtitle)}</span>` : '') +
    `</span>` +
    (it.hint ? `<span class="hint${it.hintAlways ? '' : ' on-sel'}">${esc(it.hint)}</span>` : '');
  return row;
}

function select(i, scroll = true) {
  const n = state.flat.length;
  list.querySelector('.item.sel')?.classList.remove('sel');
  if (!n) {
    state.sel = 0;
    renderFooter(null);
    return;
  }
  state.sel = ((i % n) + n) % n;
  const row = document.getElementById('opt-' + state.sel);
  row?.classList.add('sel');
  input.setAttribute('aria-activedescendant', 'opt-' + state.sel);
  if (scroll) {
    if (state.sel === 0) list.scrollTop = 0;
    else row?.scrollIntoView({ block: 'nearest' });
  }
  renderFooter(state.flat[state.sel]);
}

function renderFooter(item) {
  const k = (s) => `<kbd>${esc(s)}</kbd>`;
  const parts = [`<span>${k('↑')}${k('↓')} Navigate</span>`];
  const kind = item?.kind;
  if (kind === 'tab') {
    parts.push(`<span>${k('↵')} Switch</span>`, `<span>${k(keys('⌘⌫'))} Close tab</span>`);
  } else if (kind === 'action') {
    parts.push(`<span>${k('↵')} Run</span>`);
  } else if (kind) {
    parts.push(`<span>${k('↵')} New tab</span>`, `<span>${k(keys('⌥↵'))} Open here</span>`);
  }
  parts.push('<span class="spacer"></span>', `<span>${k('esc')} Close</span>`);
  footer.innerHTML = parts.join('');
}

// ---------------------------------------------------------------------------
// Running items
// ---------------------------------------------------------------------------

async function runItem(it, mods = {}) {
  if (!it || state.busy) return;
  state.busy = true;
  try {
    const res = await it.run(mods);
    if (res && typeof res.toast === 'string') {
      showToast(res.toast);
      await sleep(650);
    }
    close();
  } catch (err) {
    console.error(err);
    showToast(err?.message || String(err), true);
    state.busy = false;
  }
}

async function closeTabItem(it) {
  const keep = state.sel;
  await chrome.tabs.remove(it.tab.id).catch(() => {});
  await refreshTabs();
  state.userMoved = false;
  await update();
  state.userMoved = true;
  select(Math.min(keep, state.flat.length - 1));
}

function isBlankTab(t) {
  const u = t?.pendingUrl || t?.url || '';
  return u === '' || u === 'about:blank' || /^chrome:\/\/(newtab|new-tab-page)\/?$/.test(u);
}

function openUrl(url, { here } = {}) {
  const t = ctx.tab;
  if (t && (here || isBlankTab(t))) return chrome.tabs.update(t.id, { url });
  return chrome.tabs.create(clean({ url, windowId: ctx.windowId, index: t ? t.index + 1 : undefined }));
}

async function webSearch(text, { here } = {}) {
  const t = ctx.tab;
  let tabId;
  if (t && (here || isBlankTab(t))) tabId = t.id;
  else tabId = (await chrome.tabs.create(clean({ windowId: ctx.windowId, index: t ? t.index + 1 : undefined }))).id;
  await chrome.search.query({ text, tabId });
}

function close() {
  if (state.closing) return;
  state.closing = true;
  if (MODE === 'window') window.close();
  else window.parent.postMessage({ type: 'cmdk:close' }, '*');
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

// Chrome ignores `autofocus` in cross-origin iframes, and the frame may not be
// focused yet when this script runs. Focus the input now, whenever the frame
// gains focus, and keep asking the host page for focus until we have it.
function ensureFocus() {
  input.focus({ preventScroll: true });
  if (MODE !== 'overlay') return;
  let tries = 0;
  const check = () => {
    if (state.closing) return;
    if (document.hasFocus() && document.activeElement === input) return;
    window.parent.postMessage({ type: 'cmdk:focus' }, '*');
    input.focus({ preventScroll: true });
    if (++tries < 20) setTimeout(check, 50);
  };
  check();
}

window.addEventListener('focus', () => input.focus({ preventScroll: true }));

// Clicks on the panel's background shouldn't take focus away from the input.
document.getElementById('panel').addEventListener('mousedown', (e) => {
  if (e.target !== input) e.preventDefault();
});

// Keys typed before focus reached this frame are forwarded by the content
// script. The per-open sid makes sure they come from our own overlay.
chrome.runtime.onMessage.addListener((msg) => {
  if (MODE !== 'overlay' || !SID || msg?.type !== 'cmdk:key' || msg.sid !== SID) return;
  input.value = msg.key === 'Backspace' ? input.value.slice(0, -1) : input.value + msg.key;
  input.setSelectionRange(input.value.length, input.value.length);
  input.focus({ preventScroll: true });
  state.userMoved = false;
  update();
});

input.addEventListener('input', () => {
  state.userMoved = false;
  update();
});

window.addEventListener('keydown', (e) => {
  const mod = IS_MAC ? e.metaKey : e.ctrlKey;
  const key = e.key;

  if (key === 'Escape' || (mod && (key === 'k' || key === 'K'))) {
    e.preventDefault();
    close();
  } else if (key === 'ArrowDown' || (e.ctrlKey && key === 'n')) {
    e.preventDefault();
    state.userMoved = true;
    select(state.sel + 1);
  } else if (key === 'ArrowUp' || (e.ctrlKey && key === 'p')) {
    e.preventDefault();
    state.userMoved = true;
    select(state.sel - 1);
  } else if (key === 'Enter' && !e.isComposing) {
    e.preventDefault();
    runItem(state.flat[state.sel], { here: e.altKey });
  } else if (mod && key === 'Backspace') {
    // Close the selected tab when it was navigated to or nothing has been typed;
    // otherwise leave ⌘⌫ to edit the text.
    const it = state.flat[state.sel];
    if (it?.kind === 'tab' && (state.userMoved || !input.value)) {
      e.preventDefault();
      closeTabItem(it);
    }
  }
});

list.addEventListener('mousemove', (e) => {
  const row = e.target.closest('.item');
  if (!row) return;
  const i = Number(row.dataset.idx);
  if (i !== state.sel) {
    state.userMoved = true;
    select(i, false);
  }
});

list.addEventListener('click', (e) => {
  const row = e.target.closest('.item');
  if (row) runItem(state.flat[Number(row.dataset.idx)], { here: e.altKey });
});

list.addEventListener(
  'error',
  (e) => {
    const img = e.target;
    if (img.tagName === 'IMG' && img.dataset.fb && img.src !== img.dataset.fb) img.src = img.dataset.fb;
  },
  true
);

document.addEventListener('mousedown', (e) => {
  if (MODE === 'overlay' && e.target === document.body) close();
});

if (MODE === 'window') {
  window.addEventListener('blur', () => {
    setTimeout(() => {
      if (!document.hasFocus()) close();
    }, 120);
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toUrl(q) {
  q = q.trim();
  if (!q || /\s/.test(q)) return null;
  if (/^[a-z][\w+.-]*:\/\//i.test(q) || /^(about|data|mailto|javascript):/i.test(q)) {
    return /^javascript:/i.test(q) ? null : q;
  }
  if (/^localhost(:\d+)?(\/|$)/i.test(q) || /^(\d{1,3}\.){3}\d{1,3}(:\d+)?(\/|$)/.test(q)) return 'http://' + q;
  if (/^[^\s/@]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(q)) return 'https://' + q;
  return null;
}

function cleanUrl(url) {
  if (!url) return '';
  return url.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function normUrl(url) {
  return (url || '').replace(/#.*$/, '').replace(/\/$/, '');
}

function faviconUrl(pageUrl) {
  const u = new URL(chrome.runtime.getURL('/_favicon/'));
  u.searchParams.set('pageUrl', pageUrl || '');
  u.searchParams.set('size', '32');
  return u.toString();
}

function keys(s) {
  if (IS_MAC) return s;
  return s
    .replace(/⇧/g, 'Shift+')
    .replace(/⌥/g, 'Alt+')
    .replace(/⌘/g, 'Ctrl+')
    .replace(/⌫/g, 'Backspace')
    .replace(/↵/g, 'Enter');
}

function clean(obj) {
  for (const k of Object.keys(obj)) if (obj[k] === undefined) delete obj[k];
  return obj;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.append(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    input.focus();
  }
}

let toastTimer;
function showToast(msg, isError = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('error', isError);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), isError ? 2500 : 1200);
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
