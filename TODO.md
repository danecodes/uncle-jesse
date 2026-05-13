# Uncle Jesse TODOs

This backlog comes from the integration/codebase review after the `focusByKeys` work. Priority order is intentional, but everything below is worth doing.

## P0 - Correctness and Release Polish

- [x] Fix `LiveElement.isStale()`.
  - Problem: `isStale()` calls `resolve()`, and `resolve()` updates `cachedIdentity` when the selected element changes. That can hide the stale transition.
  - Suggested fix: split "resolve snapshot" from "resolve and update identity cache", or let `isStale()` resolve without mutating `cachedIdentity`.
  - Add tests for: first resolve is not stale, changed identity is stale, missing element is stale, and calling `isStale()` does not refresh the cached identity.

- [x] Fix CLI version reporting.
  - Problem: `packages/uncle-jesse/src/cli.ts` hardcodes `.version('1.2.4')`, while package versions are now managed by Changesets.
  - Suggested fix: load version from package metadata or inject it at build time.
  - Add a unit test or smoke check for `uncle-jesse --version`.

- [x] Fix log artifact capture in `RokuTestSession`.
  - Problem: `artifacts.captureLog` starts `roku-log`, but `saveLog()` writes `_logLines` from `device.logger`, not necessarily the BrightScript log stream.
  - Suggested fix: when available, save `device.logs.toText()` or structured `LogSession` output; keep `device.logger` breadcrumbs as a separate optional artifact.
  - Add tests with a fake device exposing both logger breadcrumbs and Roku log session output.

## P1 - Documentation and Public API Clarity

- [x] Update `docs/api.md` to match the real API surface.
  - Include `press(keys: RemoteKey[])`.
  - Include `focusByKeys`.
  - Include event hooks: `on`, `off`, `logger`, and breadcrumb events.
  - Include app state helpers: `getAppState`, `waitForAppState`, `toHaveActiveApp`.
  - Include ODC helpers: `connectOdc`, `setOdc`, registry/file/node methods, and `hasOdc`.
  - Include media helpers and assertions: playback state, position, duration, voice commands.
  - Include log helpers: `startLogCapture`, `stopLogCapture`, `logs`, `expectNoErrors`, `expectNoCrashes`, beacons, `matchLog`.
  - Include diagnostics: page source XML/formatted, SG node endpoints, chanperf, graphics frame rate, app thread state, rendezvous tracking.

- [x] Add a dedicated `focusByKeys` docs section.
  - Explain when to prefer it over `LiveElement.focus()` and `focusPath`.
  - Show single-key, multi-key, waypoint, and multi-target examples.
  - Document failure output and budget behavior.

- [x] Document the recommended fixture path.
  - Explain `configureUncleJesse` and `RokuTestSession`.
  - Mark the older `setDeviceFactory` fixture as legacy or low-level if it stays.
  - Add migration notes from the old fixture to the session fixture.

- [x] Add a "strict testable channel" guide.
  - Stable `name`/`id` conventions.
  - Focusable node structure.
  - Recommended attributes for selectors and replay readability.
  - Patterns to avoid: duplicate names, invisible focused branches, unstable bounds, text-only selectors for dynamic copy.

- [x] Add a golden end-to-end example.
  - One cohesive example that uses config, session fixture, registry state, page objects, app factory, screenshots, logs, and replay.
  - This should become the canonical example for new users.

## P2 - Developer Experience

- [ ] Add `uncle-jesse init`.
  - Generate `uncle-jesse.config.ts`.
  - Generate Vitest config and setup file.
  - Generate `.env.example`.
  - Generate one smoke test and one page object.
  - Detect package manager where possible.

- [ ] Add `uncle-jesse doctor`.
  - Check device reachability.
  - Check ECP availability.
  - Check developer mode assumptions.
  - Check sideload credentials.
  - Check ODC availability when requested.
  - Check screenshot support.
  - Check debug console/log stream availability.
  - Check installed Uncle Jesse package versions.
  - Print actionable next steps.

- [ ] Improve publish/release ergonomics.
  - Document the Changesets release flow including OTP.
  - Add a release checklist: build, typecheck, test, version, commit, push, publish, verify npm versions.
  - Consider a script that prints pending package versions and currently published npm versions.

## P3 - Reliability and Diagnostics

- [ ] Centralize polling and timeout behavior.
  - Create shared wait helpers in core for retrying predicates.
  - Standardize timeout errors to include selector/action, elapsed time, last UI tree, last focused element, and recent key trail when relevant.
  - Replace ad hoc loops where it makes sense, while preserving package boundaries with `roku-ecp`.

- [ ] Improve `LiveElement.focus()` diagnostics.
  - Include final focused element details.
  - Include candidate directions/gaps in failure output.
  - Optionally expose a debug trace for replay or logs.

- [ ] Make ODC failure behavior configurable.
  - Current `connectOdc()` silently leaves ODC disabled if optional dependency/client setup fails.
  - Suggested modes: `odc: false`, `odc: true` best effort with warning, `odc: 'required'` hard failure.
  - Surface why ODC is unavailable.

- [ ] Add mocked UI-sequence integration tests.
  - Simulate `roku-ecp` UI XML changing over time.
  - Cover focus leaf selection, modal branch preference, invisible focused branches, wait helpers, `focusPath`, and `focusByKeys`.

- [ ] Review `home()` and media wait loops.
  - Prefer `roku-ecp` wait helpers where available.
  - Ensure timeout errors carry useful context.
  - Avoid indefinite or silent no-op behavior when the device state does not change.

## P4 - Architecture Cleanup

- [ ] Reduce global selector engine state.
  - Problem: `setDefaultQueryEngine()` is global. `RokuAdapter.connect()` mutates global query behavior.
  - Suggested fix: attach a query engine to each `UIElement` tree or device instance.
  - This matters before adding WebOS/Tizen/other adapters.

- [ ] Split `RokuAdapter` internally into capability modules.
  - Keep the public `RokuAdapter` class.
  - Internally separate UI/focus, ODC, sideload, logs, media, device diagnostics, and debug endpoints.
  - Keep protocol-level calls delegated to `roku-ecp`, `roku-odc`, and `roku-log`.

- [ ] Clarify core vs adapter-specific API.
  - Decide which methods belong in `TVDevice` versus Roku-only extensions.
  - Consider exported capability interfaces, e.g. `SupportsLogs`, `SupportsOdc`, `SupportsMediaPlayback`, `SupportsDiagnostics`.
  - This will make future WebOS/Tizen adapters easier to type.

- [ ] Rationalize fixtures.
  - Decide whether `packages/test/src/fixture.ts` remains supported.
  - If yes, document it as low-level.
  - If no, deprecate it and route users to `vitest-fixtures.ts` and `RokuTestSession`.

## P5 - Replay and Reporting

- [ ] Make replay-on-failure first class.
  - Allow session/test config to enable replay capture for focus navigation failures.
  - Print the replay file path in failure output.
  - Attach replay artifacts to Vitest metadata when possible.

- [ ] Improve replay viewer UX.
  - Add search/filter in UI tree.
  - Show focused path/breadcrumbs.
  - Show key trail and timing summary.
  - Highlight changed nodes between frames.
  - Consider optional diff integration via `@danecodes/roku-diff`.

- [ ] Add JSON and GitHub Actions annotation reporters.
  - JSON for machine processing.
  - GitHub Actions annotations for failures with selector/context.
  - Keep CTRF/JUnit support.

- [ ] Add screenshot comparison and visual regression integration.
  - Use `@danecodes/roku-screenshot` rather than implementing diffing here.
  - Define where baselines live and how failure artifacts are stored.

- [ ] Add video recording support.
  - Decide whether this belongs in Uncle Jesse or a dependency package.
  - If using external capture, document setup and artifact paths.

## P6 - Product Roadmap

- [ ] Build the WebOS adapter.
  - Package: `@danecodes/uncle-jesse-webos`.
  - Use SSAP WebSocket plus Chrome DevTools Protocol.
  - Include headless Chromium mode for app logic where feasible.

- [ ] Add cross-platform test helpers.
  - `onPlatform()` blocks.
  - Capability detection.
  - Platform-specific skips with clear reporting.

- [ ] Build the device dashboard.
  - Package: `@danecodes/uncle-jesse-dashboard`.
  - Launch via `uncle-jesse dashboard`.
  - Show fleet overview, model, firmware, IP, online/offline, app versions.
  - Show test history, failures, screenshots, logs, and replay links.

- [ ] Add more platform adapters.
  - Tizen.
  - Android TV.
  - Fire TV.

- [ ] Create a documentation site.
  - Quick start.
  - API reference.
  - Migration guide.
  - Testable channel guide.
  - Replay examples.
  - Troubleshooting and doctor output reference.
