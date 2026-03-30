# Implementation plan: Facebook time limiter (Chrome extension)

## Goals

1. **Track** active time spent on Facebook domains (e.g. `facebook.com`, `www.facebook.com`, `m.facebook.com`).
2. **Popup UI**: Opening the extension popup shows **total Facebook time in the last 7 days** (rolling window).
3. **Enforcement**: If **more than 10 hours** were spent on Facebook in the **last 24 hours** (rolling), **close** the active Facebook tab (or block further use—initial choice: close tab when threshold is exceeded while on Facebook).

## Architecture (Manifest V3)

| Piece | Role |
|--------|------|
| **Service worker** (`background.js`) | Heart of tracking: reacts to tab updates, visibility, navigation; aggregates time; enforces the daily limit; persists state. |
| **Popup** (`popup.html` + `popup.js`) | Read-only display of last-week totals; optional link to options. |
| **Storage** | `chrome.storage.local` for session slices or minute-bucket tallies (survives browser restart). |

## Time tracking model

- **Active tab heuristic**: Count time only when the focused window has a Facebook URL in the **active** tab. Optionally pause when the document is hidden (`visibilityState`) if we want stricter “attention” tracking (phase 2).
- **Resolution**: Store **end timestamps** or **fixed buckets** (e.g. per minute) to avoid writing constantly; finalize elapsed time when the user leaves Facebook, switches tabs, or closes the tab.
- **Windows**:
  - **Last 7 days**: Sum all recorded Facebook seconds where event time falls inside `[now - 7d, now]`.
  - **Last 24 hours**: Same for `[now - 24h, now]`.
- **Data pruning**: Drop or ignore records older than 7 days (or 8 days with buffer) to cap storage size.

## Enforcement flow

1. On each **tick** or **navigation** to Facebook, recompute **last-24h total**.
2. If `last24h > 10 hours` (36,000 seconds), call `chrome.tabs.remove(tabId)` for the offending Facebook tab (or `chrome.tabs.update` to a neutral page—product choice: **close** per requirements).
3. Avoid loops: do not reopen Facebook automatically; optional cooldown or “snooze” can be a later feature.

## Permissions (expected)

- `storage` — persist usage.
- `tabs` — detect URL / active tab, close tab (minimal scope).
- `alarms` (optional) — periodic flush of in-memory elapsed time.
- **Host permissions**: `*://*.facebook.com/*` (and subdomains as needed) for matching only; alternatively rely on `tabs` URL reads without broad host permission if matching in the service worker suffices—document final choice in README once implemented.

## Phases

### Phase 1 — Scaffold

- `manifest.json` (MV3), empty service worker, popup shell, icons placeholder.
- Git repo, README, LICENSE (done).

### Phase 2 — Tracking core

- Implement start/stop of active intervals on `tabs.onActivated`, `tabs.onUpdated`, `windows.onFocusChanged`.
- Persist events or buckets to `chrome.storage.local`.
- Utility: `sumUsage(sinceMs)` for arbitrary windows.

### Phase 3 — UI

- Popup: formatted duration for **last 7 days** (e.g. “4h 12m”).
- Optional: show **last 24 hours** for transparency.

### Phase 4 — Enforcement

- When crossing **> 10h / 24h** on Facebook, close the Facebook tab.
- Manual test matrix: multiple tabs, background windows, suspend/resume.

### Phase 5 — Hardening (optional)

- Options page for daily limit and domain list.
- Export/clear history.
- Respect `chrome.storage` quota; compress old buckets.

## Testing checklist

- Focus switch between Facebook and non-Facebook tabs updates totals correctly.
- Browser restart: totals still consistent for last week.
- Exactly at 10h boundary: deterministic behavior (define: strict `>` so 10h 0m is allowed).
- Multiple Facebook tabs: only one “active” timer; enforcement targets the active violating tab.

## Out of scope (initially)

- Instagram / Meta family unless explicitly added.
- Cross-device sync.
- Password or uninstall protection (can be circumvented by disabling the extension).

Replace `Copyright (c) 2026` in `LICENSE` with your legal name or entity when publishing.
