# Uncle Jesse

E2E testing framework for smart TVs. Roku first. TypeScript, runs off-device over HTTP.

Your tests run in Node and talk to the Roku ECP API on port 8060. No Appium, no WebdriverIO, no Selenium Grid, no Java.

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

LiveElement is a persistent reference to a UI element. It re-queries the device on every call, so you never work with stale data. Full method list in the [API reference](./docs/api.md#liveelement).

```typescript
import { LiveElement } from '@danecodes/uncle-jesse-core';

const homeScreen = new LiveElement(tv, 'HomeScreen');

// Chained queries scope to the parent's subtree
const grid = homeScreen.$('RowList');
const title = homeScreen.$('Label#screenTitle');

// Actions
await homeScreen.select();
await homeScreen.focus();                              // navigates via D-pad using bounds
await homeScreen.clear();                              // backspace for each character
await settingsBtn.select({ ifNotDisplayedNavigate: 'down' }); // scroll until visible, then select

// State queries
await homeScreen.isDisplayed();    // true if visible attr is not "false"
await homeScreen.isExisting();     // true if element exists in tree
await homeScreen.isFocused();      // true if element has focused="true"
await homeScreen.isStale();        // true if element changed since first query
await title.getText();             // returns the text attribute value
await title.getAttribute('color'); // returns any attribute

// Assertions with polling (wait up to timeout for condition)
await homeScreen.toBeDisplayed({ timeout: 10000 });
await homeScreen.toNotBeDisplayed();
await homeScreen.toExist();
await title.toHaveText('Home');
await title.toHaveAttribute('color', '0xffffffff');
await title.toHaveAttribute('text', /Episode \d+/);
await grid.toBeFocused({ timeout: 5000 });
```

## Element Collections

`$$` returns an `ElementCollection` with assertions, iteration, and indexed access.

```typescript
const rows = home.$$('RowListItem');
const count = await rows.length;
const first = rows.get(0);

// Assertions
await rows.toHaveLength(3);
await rows.toHaveText(['Featured', 'Recently Added', 'Popular']);
await rows.toHaveTextInOrder(['Featured', /Recent/, 'Popular']);

// Iteration
const titles = await rows.map(async (el) => el.getText());
const visible = await rows.filter(async (el) => el.isDisplayed());

// Typed collections
const cards = home.$$('LinearCard', CardComponent);
const firstCard = cards.get(0);      // returns a CardComponent instance
```

## Stability and Loading

Wait for the UI to stop changing before you do anything else. By default this just checks that the tree hasn't changed between two consecutive polls. You can also pass loading indicator selectors and tracked attributes if your app needs something more specific.

```typescript
// Default: wait until the UI tree stops changing
await tv.waitForStable();

// App-specific: wait until spinners are gone and tracked attributes settle
await tv.waitForStable({
  indicators: ['BusySpinner', 'LoadingIndicator'],
  trackedAttributes: ['focused', 'text', 'visible', 'opacity'],
  settleCount: 2,
  timeout: 15000,
});
```

## ECP Input Events

Send events to the Roku app via the ECP `/input` endpoint. Transport controls, voice commands, custom app events, etc.

```typescript
await tv.sendInput({ command: 'pause', type: 'transport' });
await tv.sendInput({ command: 'seek', type: 'transport', direction: 'forward', duration: 30 });
```

## Touch Input

Send touch events to the device screen. Coordinates use pixel positions.

```typescript
await tv.touch(640, 360);                    // tap center of 1280x720 screen
await tv.touch(100, 200, 'down');            // touch down
await tv.touch(200, 200, 'move');            // drag
await tv.touch(200, 200, 'up');              // release
```

## App State

Query and wait for app lifecycle states.

```typescript
const state = await tv.getAppState('dev'); // 'foreground' | 'not-running' | 'not-installed'
await tv.waitForAppState('dev', 'foreground');
```

## Page Objects

If you're coming from WebdriverIO, `BasePage` and `BaseComponent` work the same way you're used to. See the [migration guide](./docs/migration.md). For simpler tests, `TVPage` in `@danecodes/uncle-jesse-test` is a lighter base class that takes a device directly.

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

## Selectors

CSS-like selectors against the Roku SceneGraph tree. See [Writing Testable Channels](./docs/testable-channels.md) for tips on structuring your app so selectors don't suck.

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
| :has() | `Item:has([text="Fantasy"])` | Item containing a descendant with that text |

Attribute values with spaces work: `[text="Add to List"]`. `:has()` supports nesting: `A:has(B:has(C))`.

## focusPath

Chainable builder for verifying D-pad navigation. It runs every step and collects all failures instead of bailing on the first one. After each key press, it waits for focus to stabilize (two consecutive tree polls agreeing) before checking your expectation. See [Roku Focus Behavior](./docs/roku-focus.md) for the gory details on how Roku reports focus.

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

Pass `{ record: true }` to focusPath and it captures a screenshot and UI tree snapshot at every step. You get a self-contained HTML file with a scrubber so you can step through the navigation and see exactly where focus went wrong.

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

When a test fails, a screenshot is automatically saved to `test-results/`. Configure with:

```typescript
import { setScreenshotOnFailure } from '@danecodes/uncle-jesse-test';
setScreenshotOnFailure(true, './test-results');
```

## Log Capture

Stream BrightScript console output during tests via [@danecodes/roku-log](https://github.com/danecodes/roku-log). Errors, crashes, backtraces, and performance beacons get parsed into structured data you can query and assert against.

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

[CTRF](https://ctrf.io) (Common Test Reporting Format) reports. Useful if you feed test results into Databricks or CI dashboards.

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

The output includes device name, environment metadata, and focusPath step failures. It follows the CTRF schema so you can ingest it as Parquet or whatever your pipeline expects.

## Multi-Device Parallel Testing

Run tests across multiple Rokus at once. `DevicePool` handles allocation. Use `poolTest` instead of `test` and the device gets acquired and released for you.

```typescript
// setup.ts
import { setDevicePool } from '@danecodes/uncle-jesse-test';
import { DevicePool } from '@danecodes/uncle-jesse-core';
import { RokuAdapter } from '@danecodes/uncle-jesse-roku';

const devices = [
  new RokuAdapter({ name: 'roku-1', ip: '192.168.1.50' }),
  new RokuAdapter({ name: 'roku-2', ip: '192.168.1.51' }),
  new RokuAdapter({ name: 'roku-3', ip: '192.168.1.52' }),
];
for (const d of devices) await d.connect();
setDevicePool(new DevicePool(devices));

// test file
import { poolTest as test } from '@danecodes/uncle-jesse-test';

test('navigate grid', async ({ tv }) => {
  // tv is acquired from the pool, released after the test
  await tv.launchApp('dev');
});
```

## File Operations (ODC)

Read and write files on the device. Requires `@danecodes/roku-odc` and an app with the ODC component injected.

```typescript
import { OdcClient } from '@danecodes/roku-odc';

const odc = new OdcClient('192.168.1.100');
tv.setOdc(odc);

await tv.pushFile('tmp:/test-data.json', Buffer.from('{"key":"value"}'));
const data = await tv.pullFile('tmp:/test-data.json');
const files = await tv.listFiles('tmp:/');
```

## Mock API Server

`@danecodes/roku-mock` gives you a local HTTP mock server so your tests don't hit real APIs. `MockTestHelper` manages the server lifecycle.

```typescript
import { MockTestHelper } from '@danecodes/uncle-jesse-test';
import { MockServer, ScenarioManager } from '@danecodes/roku-mock';

const server = new MockServer({ port: 3000 });
const scenarios = new ScenarioManager();
const mock = new MockTestHelper({
  server,
  scenarios,
  configureDevice: async (srv, device) => {
    // Point the app at the mock server
    await device.sendInput({ apiBaseUrl: srv.baseUrl });
  },
});

beforeEach(async () => {
  await mock.setup(device);
  mock.activateScenario('premiumUser');
});

afterEach(async () => {
  await mock.teardown();
});

it('loads profile', async () => {
  await device.launchApp('dev');
  expect(mock.requestCount('/v1/profile')).toBeGreaterThan(0);
});
```

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

The call blocks until the app is in the foreground.

## Registry State

Pre-load registry values before launching. Skip onboarding, set language prefs, configure feature flags -- anything your app reads from the registry on launch. Works with apps that handle the `odc_registry` launch param.

```typescript
import { RegistryState } from '@danecodes/uncle-jesse-core';

const registry = RegistryState.skipOnboarding();
const params = registry.toLaunchParams();
await tv.launchApp('dev', params);

// Or build custom state
const custom = new RegistryState()
  .set('APP_CONFIG', 'isFirstLaunch', 'false')
  .set('SETTINGS', 'subtitleLanguage', 'en');
await tv.launchApp('dev', custom.toLaunchParams());
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

Working test suites in [`examples/`](./examples) that run against a bundled test channel:

- `roku-basic` - smoke tests: launch, navigate, select, back
- `roku-focus-path` - focusPath with title-based selectors and replay recording
- `roku-page-objects` - page object pattern with GridScreen and DetailsScreen
- `roku-work-style` - full test suite using BasePage/BaseComponent (23 tests covering navigation, search, settings, deep linking, focusPath)

## Docs

More in [`docs/`](./docs):

- [Migration from Appium/WebdriverIO](./docs/migration.md)
- [API Reference](./docs/api.md)
- [Writing Testable Channels](./docs/testable-channels.md)
- [Roku Focus Behavior](./docs/roku-focus.md)

## License

MIT
