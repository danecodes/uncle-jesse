# Roadmap

Phase 1 (Roku foundation) and Phase 1.5 (visual replay debugger) are complete.

## Phase 2 - WebOS Adapter

- `@danecodes/uncle-jesse-webos` package using SSAP WebSocket + Chrome DevTools Protocol
- Headless mode for WebOS apps via Chromium (no physical TV needed)
- Cross-platform test helpers and `onPlatform()` blocks

## Phase 3 - Device Dashboard

- `@danecodes/uncle-jesse-dashboard` local web UI, launched via `uncle-jesse dashboard`
- Fleet overview: model, firmware, IP, online/offline status, app versions
- Test run history with pass/fail per device and failure screenshots

## Phase 4 - Polish

- Screenshot comparison and visual regression
- Video recording of test runs
- Documentation site
- Additional reporters (JSON, GitHub Actions annotations)
- Tizen, Android TV, Fire TV adapters
