# Facebook time limiter (Chrome extension)

A Chrome extension that **tracks time spent on Facebook**, shows **rolling 7-day usage** in the popup, and **closes the active Facebook tab** if you exceed **10 hours in the last 24 hours**.

> **Status:** Phases 1–3 implemented (tracking, popup UI, formatted usage). Enforcement (10h / 24h tab close) is Phase 4 — see [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Features

- **Tracking (Phase 2):** Time on `facebook.com` and `*.facebook.com` when that tab is active in a Chrome window that has OS focus. Events: `tabs.onActivated`, `tabs.onUpdated`, `windows.onFocusChanged`, plus periodic checkpoints to survive service worker sleep.
- **Storage:** Closed intervals in `chrome.storage.local` (pruned after 8 days); open segment mirrored so MV3 worker restarts do not lose the current visit.
- **Popup (Phase 3):** Formatted rolling totals for **last 7 days** (e.g. `4h 12m`, `1d 2h`) and **last 24 hours**, plus a **progress readout vs the planned 10h daily limit** (bar fills at 100% at 10h; overage shows as a red bar and percent &gt; 100%).
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
