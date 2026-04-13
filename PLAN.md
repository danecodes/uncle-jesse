# Uncle Jesse — Playwright for Smart TVs

## Context

There is no open-source E2E testing framework for TV apps. The options today:

1. **Commercial platforms** (Suitest, TV Labs, Witbe) — enterprise pricing, proprietary hardware
2. **Appium stack** — 5-layer middleware (Tests > WebdriverIO > Appium > appium-roku-driver > ECP). Requires Java runtime, Selenium Grid, flaky session management
3. **Abandoned repos** — single-digit GitHub stars, no maintenance

The key insight: the Appium drivers are just calling ECP/SSAP/CDP under the hood. You can do this directly in TypeScript — no Appium, no WebdriverIO, no Java.

**Positioning:** "Rooibos tests your code, Uncle Jesse tests your app." Rooibos/Rocha are BrightScript unit testing frameworks that run ON the device. Uncle Jesse is E2E automation from OUTSIDE the device — TypeScript, off-device, over HTTP. Different layers of the testing pyramid, no competition.

## Strategy: Roku-First

Phase 1 is Roku-only. The monorepo architecture proves extensibility (core/roku/test packages) without building a half-baked second adapter. WebOS, Tizen, dashboard, and cross-platform divergence go in ROADMAP.md.

The builder has `@danecodes/roku-ecp` published on npm — Uncle Jesse wraps it. Selector engine validated against 188 production selectors (94% simple patterns, all covered).

## Architecture

```
  Test Script (user code)
        |
  @danecodes/uncle-jesse-test    (expect API, focusPath builder, vitest plugin)
        |
  @danecodes/uncle-jesse-core    (TVDevice interface, DeviceManager, UIElement, selectors)
        |
  @danecodes/uncle-jesse-roku    (adapter wrapping @danecodes/roku-ecp)
        |
  ECP HTTP API (port 8060 on device)
```

Monorepo with pnpm workspaces + turborepo.

## Core API (TVDevice interface)

```typescript
interface TVDevice {
  readonly platform: Platform;
  readonly name: string;
  readonly ip: string;

  // Connection
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  // Remote control
  press(key: RemoteKey, options?: { times?: number; delay?: number }): Promise<void>;
  longPress(key: RemoteKey, duration?: number): Promise<void>;
  type(text: string): Promise<void>;

  // Navigation helpers
  navigate(direction: Direction, steps?: number): Promise<void>;
  select(): Promise<void>;
  back(): Promise<void>;
  home(): Promise<void>;

  // App lifecycle
  launchApp(appId: string, params?: Record<string, string>): Promise<void>;
  closeApp(): Promise<void>;
  getActiveApp(): Promise<AppInfo>;
  getInstalledApps(): Promise<AppInfo[]>;

  // UI inspection
  getUITree(): Promise<UIElement>;
  $(selector: string): Promise<UIElement | null>;
  $$(selector: string): Promise<UIElement[]>;
  getFocusedElement(): Promise<UIElement | null>;
  waitForElement(selector: string, options?: WaitOptions): Promise<UIElement>;
  waitForFocus(selector: string, options?: WaitOptions): Promise<UIElement>;

  // Screenshots
  screenshot(): Promise<Buffer>;
}
```

## Novel API: focusPath()

The killer differentiator — a chainable builder for testing D-pad spatial navigation:

```typescript
test('hero carousel navigation', async ({ tv }) => {
  await focusPath(tv)
    .start('#heroItem0')
    .press('right').expectFocus('#heroItem1')
    .press('right').expectFocus('#heroItem2')
    .press('down').expectFocus('#categoryRow1')
    .verify();
});
```

**Error behavior:** Shows ALL failures, doesn't abort on first. Spatial nav bugs cascade — seeing "steps 3, 7, and 11 failed" is more diagnostic than stopping at step 3.

Error message: "Step 3: After pressing RIGHT, expected focus on #heroItem2 but found focus on #heroItem1"

## Visual Replay Debugger (Phase 1.5)

Record every focusPath step as a frame — full UI tree snapshot, focused element highlighted, key pressed, time delta. Serialize as JSON timeline, ship a tiny HTML viewer that lets you scrub through the test like a video.

Turns "test failed at step 7 of 12" into something you can watch. This is the README demo that gets stars.

## Error Handling

- `waitForElement`/`waitForFocus` throw `TimeoutError` with selector, elapsed time, and last UI tree state
- Device unreachable mid-test throws `DeviceConnectionError` — test runner marks as errored (not failed)
- ECP HTTP errors (non-200) throw `ECPError` with status code and endpoint
- All error types exported from `@danecodes/uncle-jesse-core/errors`

## Package Breakdown

**@danecodes/uncle-jesse-core** — platform-agnostic interfaces and utilities:
- `TVDevice` interface
- `UIElement` class with query methods
- `SelectorEngine` — CSS-like selector parser (delegates to roku-ecp's engine for Roku; future adapters provide their own)
- `DeviceManager` — connection orchestration
- `Discovery` — SSDP shared scanner
- `Config` — `defineConfig()`, cosmiconfig loader
- Types: `Platform`, `RemoteKey`, `Direction`, `WaitOptions`, `AppInfo`
- Errors: `TimeoutError`, `DeviceConnectionError`, `ECPError`

**@danecodes/uncle-jesse-roku** — implements TVDevice for Roku:
- `RokuAdapter` wrapping `@danecodes/roku-ecp`
- `RokuKeyMap` — unified RemoteKey to ECP key names
- `RokuUIParser` — XML to UIElement tree
- `RokuDiscovery` — SSDP for `roku:ecp`

**@danecodes/uncle-jesse-test** — testing API:
- `focusPath()` builder
- Assertion methods: `toBeFocused()`, `toBeVisible()`, `toHaveText()`, `toExist()`, `toHaveAttribute()`
- `TVPage` base class for Page Object Model
- Vitest plugin with `tv` fixture (setup/teardown, injects device connection)
- Standalone runner for Jest/Mocha users

**uncle-jesse CLI:**
- `uncle-jesse test` — run tests
- `uncle-jesse discover` — find devices on network
- Console + JUnit XML reporters (JSON and GHA annotations in follow-up)

## CI/CD Integration (GitHub Actions)

### Device Mode (Roku requires a physical device)
Tests connect to devices by IP — configured in `uncle-jesse.config.ts` or via env vars.

```yaml
# .github/workflows/tv-tests.yml
name: TV Tests
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install
      - run: pnpm test  # selector engine, UI parsers, key maps — no device needed

  device-tests:
    runs-on: self-hosted  # runner on same network as Roku devices
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: pnpm install
      - run: npx uncle-jesse test
        env:
          UNCLE_JESSE_ROKU_IP: 10.0.1.50
```

### Test Output Formats
- **Console**: default, colored pass/fail output
- **JUnit XML**: `--reporter junit` for GHA test summary integration

### Artifacts
- Screenshots on failure auto-saved to `./test-results/`
- GHA workflow uploads via `actions/upload-artifact`

## Config File

```typescript
// uncle-jesse.config.ts
import { defineConfig } from '@danecodes/uncle-jesse-core';

export default defineConfig({
  devices: [
    { name: 'living-room', platform: 'roku', ip: '192.168.1.100', rokuDevPassword: 'rokudev' },
  ],
  defaults: { timeout: 10000, pressDelay: 150 },
  app: { rokuAppId: 'dev' },
});
```

## Project Structure

```
uncle-jesse/
  packages/
    core/src/
      index.ts, tv-device.ts, types.ts, device-manager.ts,
      ui-element.ts, selector-engine.ts, discovery.ts, config.ts, errors.ts
    roku/src/
      index.ts, roku-adapter.ts, roku-key-map.ts,
      roku-ui-parser.ts, roku-discovery.ts
    test/src/
      index.ts, expect.ts, focus-path.ts, tv-page.ts,
      fixtures.ts, runner.ts, vitest/plugin.ts
    uncle-jesse/src/
      index.ts, cli.ts
    uncle-jesse/bin/uncle-jesse
  examples/
    roku-basic/           -- simple smoke tests
    roku-focus-path/      -- focusPath() showcase
    roku-page-objects/    -- page object pattern demo
  pnpm-workspace.yaml
  turbo.json
  tsconfig.base.json
  README.md
  ROADMAP.md
```

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `@danecodes/roku-ecp` | Roku ECP client (published package) |
| `commander` | CLI |
| `chalk` | CLI output |
| `cosmiconfig` | Config loading |
| `vitest` | Test runner + extendable expect |
| `turbo` | Monorepo builds |
| `tsup` | Package bundling |
| `@changesets/cli` | Versioning/publishing |

## Phased Delivery

### Phase 1 — Foundation + Roku
1. Scaffold monorepo (pnpm workspace, turborepo, tsconfig, four packages)
2. `@danecodes/uncle-jesse-core` — TVDevice interface, UIElement, SelectorEngine, types, config loader, errors
3. `@danecodes/uncle-jesse-roku` — RokuAdapter wrapping `@danecodes/roku-ecp`, key mapping, UI parser, discovery
4. `@danecodes/uncle-jesse-test` — focusPath() builder, assertion matchers, vitest plugin with `tv` fixture
5. CLI — `uncle-jesse test`, `uncle-jesse discover`, console + JUnit reporters
6. Examples — roku-basic, roku-focus-path, roku-page-objects
7. README with demo GIF, publish to npm via changesets

### Phase 1.5 — Visual Replay Debugger
- Record focusPath steps as JSON timeline (UI tree snapshot + focused element + key + timestamp per step)
- Ship tiny HTML viewer for scrubbing through test runs
- Integrate into failure output: "View replay: file://test-results/hero-nav-replay.html"

### Phase 2 — WebOS Adapter (ROADMAP.md)
- `@danecodes/uncle-jesse-webos` — SSAP WebSocket + Chrome DevTools Protocol adapter
- Headless mode for WebOS apps (Chromium, no physical TV)
- Cross-platform examples, `onPlatform()` blocks, PageManager

### Phase 3 — Device Dashboard (ROADMAP.md)
- `@danecodes/uncle-jesse-dashboard` — local web UI via `uncle-jesse dashboard`
- Device fleet grid: model, firmware, IP, online/offline, app versions, dev mode token status
- Test run history: pass/fail per device, failure screenshots, run-from-dashboard
- Backend: Express/Fastify + WebSocket for live status
- Frontend: React/Preact SPA, SQLite/JSON for history

### Phase 4 — Polish (ROADMAP.md)
- Platform divergence strategy (smart adapter defaults, onPlatform blocks, Page Object subclasses)
- Screenshot comparison / visual regression
- Video recording of test runs
- Documentation site
- Additional reporters (JSON, GitHub Actions annotations)
- Tizen, Android TV, Fire TV adapters

## Success Criteria

- `npx uncle-jesse test` runs a test suite against a real Roku device
- focusPath() produces clear, actionable error messages showing ALL navigation failures
- A developer unfamiliar with Uncle Jesse can write a new test in under 15 minutes using examples
- All 188 selector patterns from production audit work correctly
- README has a demo GIF showing focusPath in action
- Published to npm as `@danecodes/uncle-jesse-core`, `@danecodes/uncle-jesse-roku`, `@danecodes/uncle-jesse-test`
- Vitest plugin works with `tv` fixture injection

## Verification Plan

1. **Unit tests**: Selector engine, UI parsers, key maps, focusPath builder — run via `pnpm test` in CI (no device needed)
2. **Integration test**: Launch sideloaded channel on physical Roku, run `uncle-jesse test` against `examples/roku-basic/`
3. **focusPath test**: Run `examples/roku-focus-path/` against real device, verify error messages on intentional failures
4. **CI validation**: GitHub Actions runs unit tests on ubuntu-latest, device tests on self-hosted runner
