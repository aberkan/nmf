# Facebook time limiter (Chrome extension)

A Chrome extension that **tracks time spent on Facebook**, shows **rolling 7-day usage** in the popup, and **closes the active Facebook tab** if you exceed **10 hours in the last 24 hours**.

> **Status:** Repository scaffold — extension code is planned in [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md).

## Features (target)

- Time on `facebook.com` (and related hostnames TBD) while the tab is active in the focused window.
- **Popup:** total Facebook time in the **last 7 days**.
- **Limit:** if **last 24 hours &gt; 10 hours** on Facebook, the extension **closes** that tab.

## Development

1. Clone this repository.
2. Load unpacked extension: Chrome → Extensions → Developer mode → **Load unpacked** → select this folder (once `manifest.json` exists).
3. Follow the implementation plan for MV3 structure (`background` service worker, `popup`, `storage`).

## License

[MIT](./LICENSE)

Before distributing, add your name to the copyright line in `LICENSE`.
