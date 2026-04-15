# Uncle Jesse

E2E testing framework for smart TVs. TypeScript, off-device, over HTTP. Roku first, with other platforms planned.

Uncle Jesse talks directly to the Roku External Control Protocol (ECP) on port 8060. No Appium, no WebdriverIO, no Selenium Grid, no Java runtime. Your tests run in Node and send HTTP requests to the device.

## Install

```bash
npm install @danecodes/uncle-jesse-core @danecodes/uncle-jesse-roku @danecodes/uncle-jesse-test
```

## Quick Start

```typescript
import { RokuAdapter } from '@danecodes/uncle-jesse-roku';
import { BasePage } from '@danecodes/uncle-jesse-core';

const tv = new RokuAdapter({
  name: 'dev-roku',
  ip: process.env.ROKU_IP ?? '192.168.1.100',
  devPassword: 'rokudev',
});

await tv.connect();
await tv.launchApp('dev');

// Query the UI tree with CSS-like selectors
const grid = await tv.$('HomeScreen RowList');
const title = await tv.$('Label#screenTitle');

// Navigate with D-pad
await tv.press('right', { times: 3 });
await tv.select();

// Check what has focus
const focused = await tv.getFocusedElement();
console.log(focused?.getAttribute('title'));

await tv.disconnect();
```

## LiveElement

LiveElement is a persistent reference to a UI element that re-queries the device on each call. It supports chained selectors, actions, and built-in assertions with polling. See the [API reference](./docs/api.md#liveelement) for the full method list.

```typescript
import { LiveElement } from '@danecodes/uncle-jesse-core';

const homeScreen = new LiveElement(tv, 'HomeScreen');

// Chained queries scope to the parent's subtree
const grid = homeScreen.$('RowList');
const title = homeScreen.$('Label#screenTitle');

// Actions
await homeScreen.select();
await homeScreen.focus();                              // navigates via D-pad until focused
await homeScreen.focus({ direction: 'down' });         // specify scroll direction
await settingsBtn.select({ ifNotDisplayedNavigate: 'down' }); // scroll until visible, then select

// State queries
await homeScreen.isDisplayed();    // true if visible attr is not "false"
await homeScreen.isExisting();     // true if element exists in tree
await homeScreen.isFocused();      // true if element has focused="true"
await title.getText();             // returns the text attribute value
await title.getAttribute('color'); // returns any attribute

// Assertions with polling (wait up to timeout for condition)
await homeScreen.toBeDisplayed({ timeout: 10000 });
await homeScreen.toNotBeDisplayed();
await homeScreen.toExist();
await title.toHaveText('Home');
await grid.toBeFocused({ timeout: 5000 });
```

## Page Objects

`BasePage` and `BaseComponent` provide the same structure used in production Roku test suites with WebdriverIO. If you're migrating from an Appium-based setup, this is the API you want. See the [migration guide](./docs/migration.md) for a detailed walkthrough. For simpler cases, `TVPage` in `@danecodes/uncle-jesse-test` provides a lighter base class that takes a device directly.

```typescript
import { BasePage, BaseComponent } from '@danecodes/uncle-jesse-core';

class NavBar extends BaseComponent {
  get homeTab() { return this.$('NavTab#tabHome'); }
  get searchTab() { return this.$('NavTab#tabSearch'); }

  async selectHome() { await this.homeTab.select(); }
  async selectSearch() { await this.searchTab.select(); }
}

class HomePage extends BasePage {
  get root() { return this.$('HomeScreen'); }
  get navBar() { return new NavBar(this.$('NavBar')); }
  get grid() { return this.$('HomeScreen RowList'); }

  async waitForLoaded() {
    await this.root.toBeDisplayed();
    await this.grid.waitForExisting();
  }
}
```

Use them in tests:

```typescript
import { beforeEach, it } from 'vitest';

let device: TVDevice;
let home: HomePage;

beforeEach(async () => {
  device = new RokuAdapter({ name: 'test', ip: '192.168.1.100' });
  await device.connect();
  home = new HomePage(device, null);
  await device.home();
  await device.launchApp('dev');
  await home.waitForLoaded();
});

it('navigate to search', async () => {
  await device.press('up');
  await home.navBar.selectSearch();
  await home.root.toNotBeDisplayed();
});
```

## Element Collections

`$$` returns an `ElementCollection` with `.get(index)` and async `.length`. You can also pass a component class to get typed results.

```typescript
const rows = home.$$('RowListItem');
const count = await rows.length;     // number of matching elements
const first = rows.get(0);           // LiveElement for the first match
await first.toBeDisplayed();

// Typed collections
const cards = home.$$('LinearCard', CardComponent);
const firstCard = cards.get(0);      // returns a CardComponent instance
```

## Selectors

Uncle Jesse uses CSS-like selectors against the Roku SceneGraph tree. See [Writing Testable Channels](./docs/testable-channels.md) for how to structure your app for best results.

| Pattern | Example | Matches |
|---------|---------|---------|
| Tag name | `RowList` | Elements with that tag |
| ID | `#screenTitle` | Element with `name="screenTitle"` |
| Tag + ID | `Label#screenTitle` | Label with that name |
| Descendant | `HomeScreen RowList` | RowList anywhere inside HomeScreen |
| Child | `LayoutGroup > Label` | Direct child only |
| Attribute | `[focused="true"]` | Element with that attribute value |
| Attribute existence | `[focusable]` | Element with that attribute present |
| Tag + attribute | `Label[text="Home"]` | Label with text="Home" |
| Adjacent sibling | `Module + Module` | Module preceded by another Module |
| nth-child | `NavTab:nth-child(2)` | Second NavTab child |

Attribute values with spaces work: `[text="Add to List"]`.

## focusPath

A chainable builder for verifying D-pad spatial navigation. Runs every step and collects all failures instead of stopping on the first one. After each key press, it waits for focus to stabilize (two consecutive tree queries agreeing) before checking the expectation. For details on how Roku handles focus, see [Roku Focus Behavior](./docs/roku-focus.md).

```typescript
import { focusPath } from '@danecodes/uncle-jesse-test';

const result = await focusPath(tv)
  .press('right').expectFocus('[title="featured-item-2"]')
  .press('right').expectFocus('[title="featured-item-3"]')
  .press('down').expectFocus('[title="recent-item-2"]')
  .verify();

expect(result.passed).toBe(true);
```

Supports `#id`, `[attr="value"]`, `Tag#id`, and `Tag[attr="value"]` selectors for focus matching.

When steps fail:

```
Step 1: After pressing RIGHT, expected focus on [title="featured-item-2"]
        but found focus on RenderableNode[title="featured-item-1"]
```

## Visual Replay Debugger

Pass `{ record: true }` to focusPath to capture a device screenshot and UI tree snapshot at each step. The output is a self-contained HTML file with a scrubber, step details, and side-by-side screenshot and tree view.

```typescript
const result = await focusPath(tv, { record: true, testName: 'grid-nav' })
  .press('right').expectFocus('[title="featured-item-2"]')
  .press('down').expectFocus('[title="recent-item-2"]')
  .verify();

if (result.replay) {
  const { saveReplay } = await import('@danecodes/uncle-jesse-test/replay');
  await saveReplay(result.replay, './test-results');
}
```

## Screenshot on Failure

When using the vitest `tv` fixture, a device screenshot is automatically saved to `test-results/` when a test fails. Configure with:

```typescript
import { setScreenshotOnFailure } from '@danecodes/uncle-jesse-test';
setScreenshotOnFailure(true, './test-results');
```

## Log Capture

Stream and parse BrightScript console output during test runs using [@danecodes/roku-log](https://github.com/danecodes/roku-log). Captures errors, crashes, backtraces, and performance beacons as structured data.

```typescript
const tv = new RokuAdapter({ name: 'test', ip: '192.168.1.100' });
await tv.connect();
await tv.startLogCapture();

await tv.launchApp('dev');
// ... run tests ...

// Check for errors during the test
if (tv.hasErrors()) {
  console.log('Errors:', tv.logs.errors);
}
if (tv.hasCrashes()) {
  console.log('Crashes:', tv.logs.crashes);
}

// Get a summary
const summary = tv.getLogSummary();
console.log(`${summary.errorCount} errors, launch time: ${summary.launchTime}ms`);

// Filter and search logs
const networkErrors = tv.logs.filter({ file: 'NetworkTask.brs' });
const authLogs = tv.logs.search('authentication');

tv.stopLogCapture();
```

## CTRF Reporting

Generate [CTRF](https://ctrf.io) (Common Test Reporting Format) reports for integration with Databricks, CI dashboards, and cross-team test analytics.

```typescript
import { CtrfReporter } from 'uncle-jesse';

const reporter = new CtrfReporter({
  deviceName: 'Roku Ultra',
  appName: 'MyApp',
  appVersion: '2.0.0',
  buildId: process.env.BUILD_ID,
  testEnvironment: 'staging',
  outputDir: './test-results',
});

// Feed test results to the reporter, then save
reporter.save(); // writes test-results/ctrf-report.json
```

The report includes device name, environment metadata, focusPath step failures, and maps to the CTRF schema for Parquet ingestion.

## CLI

```bash
# Run tests
npx uncle-jesse test
npx uncle-jesse test --reporter junit
npx uncle-jesse test --reporter ctrf
npx uncle-jesse test --watch

# Discover devices on the network
npx uncle-jesse discover
npx uncle-jesse discover --timeout 10000

# Sideload a channel (zip file or directory)
npx uncle-jesse sideload ./my-channel --ip 192.168.1.100
npx uncle-jesse sideload ./build.zip --ip 192.168.1.100 --password rokudev
```

## Deep Linking

Launch directly to a specific content item:

```typescript
await tv.deepLink('dev', 'content-123', 'movie');
```

The adapter waits for the target app to become active before returning.

## Registry State

Inject registry state before launching the app. This lets you skip onboarding flows, set language preferences, or configure any app state that's stored in the Roku registry. Compatible with apps that handle the `odc_registry` launch param convention.

```typescript
import { RegistryState } from '@danecodes/uncle-jesse-core';

const registry = RegistryState.skipOnboarding();
const params = registry.toLaunchParams();
await tv.launchApp('dev', params);

// Or build custom state
const custom = new RegistryState()
  .set('CR_ROKU', 'isFirstLaunch', 'false')
  .set('SETTINGS', 'subtitleLanguage', 'en');
await tv.launchApp('dev', custom.toLaunchParams());
```

## Multi-Device Parallel Testing

`DevicePool` manages a pool of devices for parallel test execution. Tests acquire a device from the pool, run against it, and release it when done. If all devices are busy, the next test waits until one becomes available.

```typescript
import { DevicePool } from '@danecodes/uncle-jesse-core';
import { RokuAdapter } from '@danecodes/uncle-jesse-roku';

const devices = [
  new RokuAdapter({ name: 'roku-1', ip: '192.168.1.50' }),
  new RokuAdapter({ name: 'roku-2', ip: '192.168.1.51' }),
  new RokuAdapter({ name: 'roku-3', ip: '192.168.1.52' }),
];

for (const d of devices) await d.connect();
const pool = new DevicePool(devices, { acquireTimeout: 30000 });

// In each test worker
const device = await pool.acquire();
try {
  // run tests against device
} finally {
  pool.release(device);
}

// When done
await pool.drain();
```

## Architecture

```
Test Script (user code)
      |
@danecodes/uncle-jesse-test    focusPath, assertions, vitest plugin, replay
      |
@danecodes/uncle-jesse-core    TVDevice, LiveElement, BasePage, selectors
      |
@danecodes/uncle-jesse-roku    RokuAdapter wrapping @danecodes/roku-ecp
      |
ECP HTTP API                   port 8060 on the Roku device
```

## Packages

| Package | Description |
|---------|-------------|
| `@danecodes/uncle-jesse-core` | TVDevice, LiveElement, BasePage, BaseComponent, SelectorEngine, RegistryState, DevicePool |
| `@danecodes/uncle-jesse-roku` | Roku adapter, media player, log capture via [@danecodes/roku-ecp](https://github.com/danecodes/roku-ecp) and [@danecodes/roku-log](https://github.com/danecodes/roku-log) |
| `@danecodes/uncle-jesse-test` | focusPath, vitest matchers, vitest plugin, replay debugger |
| `uncle-jesse` | CLI (test, discover, sideload) and reporters (console, JUnit, CTRF) |

Optional integrations:

| Package | Description |
|---------|-------------|
| `@danecodes/roku-odc` | Direct registry read/write and file operations via ODC (port 8061) |
| `@danecodes/roku-log` | Structured BrightScript log parsing and streaming (included in roku adapter) |

## Examples

The [`examples/`](./examples) directory has working test suites that run against a bundled test channel:

- `roku-basic` - smoke tests: launch, navigate, select, back
- `roku-focus-path` - focusPath with title-based selectors and replay recording
- `roku-page-objects` - page object pattern with GridScreen and DetailsScreen
- `roku-work-style` - full test suite using BasePage/BaseComponent (23 tests covering navigation, search, settings, deep linking, focusPath)

## Docs

See the [`docs/`](./docs) directory for detailed guides:

- [Migration from Appium/WebdriverIO](./docs/migration.md)
- [API Reference](./docs/api.md)
- [Writing Testable Channels](./docs/testable-channels.md)
- [Roku Focus Behavior](./docs/roku-focus.md)

## License

MIT
