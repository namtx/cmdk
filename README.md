# Command K

An Arc-style ⌘K command bar for Google Chrome.

## Install

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and choose this folder.
3. Open `chrome://extensions/shortcuts` and check that **Command K → Open the command bar** is set to ⌘K (Ctrl+K on Windows/Linux). If Chrome left it blank, set it there.
4. Tabs that were already open need a reload before ⌘K works in them. Clicking the toolbar icon works right away.

## What it does

- **Switch tabs** in any window, with fuzzy matching on title and URL.
- **Search bookmarks and history.** Results that are already open as a tab are skipped.
- **Open URLs or search the web.** Type `github.com` or any text. Search uses your default search engine.
- **Run actions**: new tab or window, incognito, reopen closed tab, close/duplicate/pin/mute/reload, copy URL or Markdown link, bookmark, move tab to a new window, close other/right/duplicate tabs, zoom, back/forward, and open Chrome's built-in pages.
- **Top Hit**: a strong match moves above the search row, so pressing Enter goes straight to it.

| Key | Action |
| --- | --- |
| ⌘K / Esc | Open / close |
| `>` as first character | Show commands only (e.g. `>pin`) |
| ↑ ↓ (or Ctrl+N / Ctrl+P) | Move selection |
| ↵ | Run, switch to the tab, or open in a new tab |
| ⌥↵ | Open in the current tab |
| ⌘⌫ | Close the selected tab |

## How it works

- `content.js` draws the palette over web pages inside a shadow-DOM iframe, so page CSS can't affect it. It also takes ⌘K back from sites that bind it themselves (Slack, GitHub), like Arc does.
- Chrome doesn't let extensions run scripts on `chrome://` pages, the New Tab page or the Web Store. On those pages, `background.js` opens the same palette as a small centered popup window instead.
- `palette.html/js/css` is the UI. It runs as an extension page, so it calls the `chrome.tabs`, `bookmarks`, `history`, `sessions` and `search` APIs directly.
