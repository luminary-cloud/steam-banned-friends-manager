# Steam Banned Friends Manager

A browser extension that shows which of your Steam friends are banned and lets
you remove them in bulk. Also works on Steam group member pages so you can spot
banned accounts at a glance.

Built with [WXT](https://wxt.dev), so a single codebase produces Chrome and
Firefox builds.

## Features

- Marks banned friends with a red label that breaks down the ban type (VAC,
  Game, Community, Trade) and how long ago it happened.
- Flags fully private profiles so you can prune them too.
- Toolbar with one-click filter buttons: VAC, Game, Comm, Trade, Private, All.
- Select banned friends and remove them in one batch from your friends list.
- Optional "Show banned section" button that lifts every banned friend into a
  dedicated group at the top of the list, preserving the original order so
  it can be restored.
- Resolves vanity URLs automatically so older friends with custom URLs are
  scanned correctly.
- Reacts to in-page navigation, so jumping between your friends page, a group
  members page, and back does not require a reload.

## Install

### From the store

- Chrome, Edge, Brave, Opera: [Chrome Web Store](https://chromewebstore.google.com/detail/steam-banned-friends-mana/eihdfnoindcooealhliklndnffdlafam)
- Firefox: [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/steam-banned-friends-manager/)

### From a release zip

1. Grab the latest `chrome.zip` or `firefox.zip` from the
   [Releases](../../releases) page.
2. **Chrome / Edge / Brave / Opera:** open `chrome://extensions`, enable
   *Developer mode*, drag the zip onto the page.
3. **Firefox:** open `about:debugging#/runtime/this-firefox`, click *Load
   Temporary Add-on*, point at the zip.

### From source

```bash
git clone https://github.com/luminary-cloud/steam-banned-friends-manager.git
cd steam-banned-friends-manager
npm install
npm run build           # Chrome build at .output/chrome-mv3
npm run build:firefox   # Firefox build at .output/firefox-mv2
```

## Development

```bash
npm install
npm run dev             # opens Chrome with the extension auto-loaded
npm run dev:firefox     # opens Firefox with the extension auto-loaded
```

WXT handles hot reload, the per-browser manifest, and asset copying. Edits to
files under `src/` and `entrypoints/` reload the extension automatically.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server, Chrome target. |
| `npm run dev:firefox` | Dev server, Firefox target. |
| `npm run build` | Production Chrome build into `.output/chrome-mv3`. |
| `npm run build:firefox` | Production Firefox build into `.output/firefox-mv2`. |
| `npm run zip` | Bundle a Chrome zip for store submission. |
| `npm run zip:firefox` | Bundle a Firefox zip for AMO submission. |
| `npm run compile` | TypeScript type-check. |
| `npm run lint` | ESLint over the project. |
| `npm run format` | Prettier write. |

## Project structure

```
entrypoints/
  background.ts          Steam Web API relay (service worker / event page)
  steam.content.ts       Content script entry, registers matches and lifecycle

src/
  style.css              Toolbar and ban label styling
  lib/
    messaging.ts         Typed message contract between content and background
    identity.ts          Detects the logged-in user and own-profile check
    pages.ts             Route classification (friends / group / other)
    state.ts             Per-route mutable page state
    dom.ts               Steam DOM helpers (target collection, sections, checkboxes)
    bans.ts              Renders ban labels and data attributes on persona elements
    scanner.ts           Orchestrates vanity resolution, batching, and concurrency
    toolbar.ts           Toolbar UI, filter buttons, selection state
    sort.ts              Snapshot, move-to-top, and restore for the friends list
    remove.ts            Bulk friend removal via Steam's friends/action endpoint

public/
  icon/                  Extension icons (16, 48, 128)

wxt.config.ts            WXT configuration with per-browser manifest overrides
```

## How it works

The content script runs on Steam Community pages and watches for SPA route
changes. When the user lands on their own friends page or a group members
page, it scrapes the visible profile elements, resolves any vanity URLs
through the Steam Web API, then fetches ban and visibility data in batches.
Each banned (or private) account gets a label and data attributes that drive
the toolbar's filters and the bulk remove flow.

Steam Web API calls are proxied through the background script so the keys
never appear in the page's own network log. The store builds ship with API
keys included; if you are building from source you need to add your own to
the `API_KEYS` array in `entrypoints/background.ts`. Grab one for free at
https://steamcommunity.com/dev/apikey.

## Contributing

Issues and pull requests are welcome. The unit-tested modules are `pages.ts`
and `sort.ts` (regex classification and DOM round-trip); the rest is covered
by manual verification against a real Steam account.

Before submitting a PR:

```bash
npm run compile
npm run lint
npm run build
```

Please keep the diff small, avoid unrelated refactors, and match the existing
style.

## License

MIT, see [LICENSE](LICENSE).

## Disclaimer

This project is not affiliated with Valve or Steam. Use it responsibly. The
Steam Web API has rate limits and abuse policies; do not bulk-scan accounts
beyond what you need.
