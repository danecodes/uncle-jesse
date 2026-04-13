# Roadmap

## Phase 1.5 — Visual Replay Debugger
- Record focusPath steps as JSON timeline (UI tree snapshot + focused element + key + timestamp per step)
- HTML viewer for scrubbing through test runs
- Integrate into failure output: `View replay: file://test-results/hero-nav-replay.html`

## Phase 2 — WebOS Adapter
- `@uncle-jesse/webos` — SSAP WebSocket + Chrome DevTools Protocol
- Headless mode for WebOS apps (Chromium, no physical TV)
- Cross-platform examples, `onPlatform()` blocks

## Phase 3 — Device Dashboard
- `@uncle-jesse/dashboard` — local web UI via `uncle-jesse dashboard`
- Device fleet grid: model, firmware, IP, online/offline, app versions
- Test run history: pass/fail per device, failure screenshots

## Phase 4 — Polish
- Screenshot comparison / visual regression
- Video recording of test runs
- Documentation site
- Additional reporters (JSON, GitHub Actions annotations)
- Tizen, Android TV, Fire TV adapters
