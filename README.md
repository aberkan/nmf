# Facebook time limiter (Chrome extension)

A Chrome extension that **tracks time spent on Facebook**, shows **rolling 7-day usage** in the popup, and **closes the active Facebook tab** if you exceed **10 hours in the last 24 hours**.

> **Status:** Phases 1–2 implemented (tracking + popup readout). Enforcement (10h / 24h tab close) is Phase 4 — see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Features

- **Tracking (Phase 2):** Time on `facebook.com` and `*.facebook.com` when that tab is active in a Chrome window that has OS focus. Events: `tabs.onActivated`, `tabs.onUpdated`, `windows.onFocusChanged`, plus periodic checkpoints to survive service worker sleep.
- **Storage:** Closed intervals in `chrome.storage.local` (pruned after 8 days); open segment mirrored so MV3 worker restarts do not lose the current visit.
- **Popup:** Rolling **last 7 days** and **last 24 hours** totals (basic formatting; polish in Phase 3).
- **Limit (planned):** if **last 24 hours &gt; 10 hours** on Facebook, **close** that tab (Phase 4).

## Permissions

`storage`, `tabs`, `windows`, `alarms` — no broad `facebook.com` host permission required for URL checks from the service worker.

## Development

1. Clone this repository.
2. Chrome → **Extensions** → **Developer mode** → **Load unpacked** → choose the repo folder (the one containing `manifest.json`).
3. Open the extension popup to see rolling usage; use Facebook with the tab focused to accumulate time.

## License

[MIT](./LICENSE)

Before distributing, add your name to the copyright line in `LICENSE`.
