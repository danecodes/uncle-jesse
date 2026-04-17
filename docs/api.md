# API Reference

For migration from Appium/WebdriverIO, see [Migration Guide](./migration.md). For Roku-specific behavior, see [Roku Focus Behavior](./roku-focus.md). For structuring your app for testing, see [Writing Testable Channels](./testable-channels.md).

## @danecodes/uncle-jesse-core

### TVDevice

Every platform adapter implements this interface. Right now that's just RokuAdapter.

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

  // Navigation shortcuts
  navigate(direction: Direction, steps?: number): Promise<void>;
  select(): Promise<void>;
  back(): Promise<void>;
  home(): Promise<void>;

  // App lifecycle
  launchApp(appId: string, params?: Record<string, string>): Promise<void>;
  closeApp(): Promise<void>;
  deepLink(channelId: string, contentId: string, mediaType?: string): Promise<void>;
  getActiveApp(): Promise<AppInfo>;
  getInstalledApps(): Promise<AppInfo[]>;

  // UI inspection
  getUITree(): Promise<UIElement>;
  $(selector: string): Promise<UIElement | null>;
  $$(selector: string): Promise<UIElement[]>;
  getFocusedElement(): Promise<UIElement | null>;
  waitForElement(selector: string, options?: WaitOptions): Promise<UIElement>;
  waitForFocus(selector: string, options?: WaitOptions): Promise<UIElement>;
  waitForCondition<T>(predicate: () => Promise<T | null | false>, options?: WaitOptions): Promise<T>;
  waitUntil(predicate: () => Promise<boolean>, options?: { timeout?: number; interval?: number; timeoutMsg?: string }): Promise<void>;

  // Timing
  pause(ms: number): Promise<void>;

  // Input
  sendInput(params: Record<string, string | number>): Promise<void>;
  touch(x: number, y: number, op?: 'down' | 'up' | 'press' | 'move'): Promise<void>;

  // Stability
  waitForStable(options?: WaitForStableOptions): Promise<void>;

  // Media
  screenshot(): Promise<Buffer>;
}
```

### RemoteKey

```typescript
type RemoteKey =
  | 'home' | 'back' | 'select'
  | 'up' | 'down' | 'left' | 'right'
  | 'play' | 'pause' | 'rewind' | 'fastForward'
  | 'info' | 'enter' | 'backspace'
  | 'volumeUp' | 'volumeDown' | 'mute'
  | 'powerOff' | 'channelUp' | 'channelDown';
```

### LiveElement

Persistent reference to a UI element. Re-queries the device on every method call.

```typescript
class LiveElement {
  // Access the underlying device
  getDevice(): TVDevice;

  // Query within this element's subtree
  $(childSelector: string): LiveElement;
  $$(childSelector: string): ElementCollection;
  $$<T>(childSelector: string, ComponentClass: new (el: LiveElement) => T): TypedElementCollection<T>;

  // Resolve to a UIElement snapshot
  resolve(): Promise<UIElement | null>;

  // State
  getAttribute(name: string): Promise<string | undefined>;
  getText(): Promise<string>;   // reads text attr, or walks descendant Label/Button elements
  getRect(): Promise<Rect | null>; // absolute screen bounds (walks parent translations)
  isExisting(): Promise<boolean>;
  isDisplayed(): Promise<boolean>;
  isFocused(): Promise<boolean>;

  // Actions
  select(options?: { ifNotDisplayedNavigate?: Direction }): Promise<void>;
  focus(options?: { maxAttempts?: number; timeout?: number }): Promise<void>;
  clear(): Promise<void>;

  // Identity
  isStale(): Promise<boolean>;

  // Wait helpers
  waitForDisplayed(options?: WaitOptions): Promise<void>;
  waitForExisting(options?: WaitOptions): Promise<void>;

  // Assertions (poll with timeout)
  toBeFocused(options?: WaitOptions): Promise<void>;
  toBeDisplayed(options?: WaitOptions): Promise<void>;
  toNotBeDisplayed(options?: WaitOptions): Promise<void>;
  toHaveText(expected: string | RegExp, options?: WaitOptions): Promise<void>;
  toHaveAttribute(name: string, expected: string | RegExp, options?: WaitOptions): Promise<void>;
  toNotHaveAttribute(name: string, expected: string | RegExp, options?: WaitOptions): Promise<void>;
  toExist(options?: WaitOptions): Promise<void>;
  toNotExist(options?: WaitOptions): Promise<void>;
  toNotBeFocused(options?: WaitOptions): Promise<void>;
  toNotHaveText(expected: string | RegExp, options?: WaitOptions): Promise<void>;
  toHaveTextContaining(text: string, options?: WaitOptions): Promise<void>;
  toBeInFocusChain(options?: WaitOptions): Promise<void>;
}
```

### ElementCollection

Returned by `$$()`. Elements are queried lazily when you access them.

```typescript
class ElementCollection {
  get(index: number): LiveElement;
  get length(): Promise<number>;

  // Assertions
  toHaveLength(expected: number | { gte?: number; lte?: number; eq?: number }, options?: WaitOptions): Promise<void>;
  toHaveText(expected: string[], options?: WaitOptions): Promise<void>;
  toHaveTextInOrder(expected: (string | RegExp)[], options?: WaitOptions): Promise<void>;

  // Iteration
  map<R>(fn: (el: LiveElement, i: number) => Promise<R>): Promise<R[]>;
  filter(fn: (el: LiveElement, i: number) => Promise<boolean>): Promise<LiveElement[]>;
}
```

### TypedElementCollection

Returned by `$$('selector', ComponentClass)`. Each `.get()` returns an instance of the component class.

```typescript
class TypedElementCollection<T extends BaseComponent> {
  get(index: number): T;
  get length(): Promise<number>;
}
```

### BasePage

Base class for page objects. Takes a device and optional app context.

```typescript
class BasePage<TApp = unknown> {
  protected device: TVDevice;
  protected app: TApp;

  constructor(device: TVDevice, app: TApp);

  $(selector: string): LiveElement;
  $$(selector: string): ElementCollection;
  $$<T>(selector: string, ComponentClass: new (el: LiveElement) => T): TypedElementCollection<T>;

  get driver(): TVDevice;
}
```

### BaseComponent

Base class for component objects. Wraps a LiveElement and scopes queries to its subtree.

```typescript
class BaseComponent {
  protected element: LiveElement;
  protected device: TVDevice;

  constructor(element: LiveElement);  // device is inferred from the element

  $(selector: string): LiveElement;
  $$(selector: string): ElementCollection;
  $$<T>(selector: string, ComponentClass: new (el: LiveElement) => T): TypedElementCollection<T>;

  waitUntil(predicate: () => Promise<boolean>, options?: { timeout?: number; interval?: number; timeoutMsg?: string }): Promise<void>;
  waitForCondition<T>(predicate: () => Promise<T | null | false>, options?: WaitOptions): Promise<T>;

  get driver(): TVDevice;
}
```

### UIElement

Static snapshot of a SceneGraph node. `TVDevice.$()` returns these, and LiveElement uses them internally.

```typescript
class UIElement {
  readonly tag: string;
  readonly attributes: Record<string, string>;
  readonly children: UIElement[];
  readonly parent: UIElement | null;

  get id(): string | undefined;
  get text(): string | undefined;
  get focused(): boolean;
  get visible(): boolean;
  get bounds(): { x: number; y: number; width: number; height: number } | undefined;

  getAttribute(name: string): string | undefined;
  $(selector: string): UIElement | null;
  $$(selector: string): UIElement[];
  findFirst(predicate: (el: UIElement) => boolean): UIElement | null;
  findAll(predicate: (el: UIElement) => boolean): UIElement[];
  toString(depth?: number): string;
}
```

### Selector Syntax

CSS-like selectors for querying the SceneGraph tree. Used by `$()`, `$$()`, `waitForElement()`, `waitForFocus()`, and `focusPath`.

| Pattern | Example | Description |
|---------|---------|-------------|
| Tag | `RowList` | Elements with that tag name |
| ID | `#screenTitle` | Element with `name="screenTitle"` |
| Tag + ID | `Label#screenTitle` | Tag and name combined |
| Descendant | `HomeScreen RowList` | RowList anywhere inside HomeScreen |
| Child | `LayoutGroup > Label` | Direct child only |
| Adjacent sibling | `Module + Module` | Module preceded by another Module |
| Attribute value | `[text="Home"]` | Element with exact attribute value |
| Attribute existence | `[focusable]` | Element with attribute present |
| Tag + attribute | `Label[text="Home"]` | Combined tag and attribute |
| `:nth-child(n)` | `NavTab:nth-child(2)` | 1-based child index |
| `:has()` | `Item:has([text="Fantasy"])` | Element containing a matching descendant |

`:has()` supports nesting: `A:has(B:has(C))` matches an A containing a B that contains a C.

When connected to a real device, RokuAdapter swaps in roku-ecp's selector engine, which also supports `*`, `[attr*=]`, `[attr^=]`, `[attr$=]`, and comma-separated groups.

### Config

```typescript
import { defineConfig } from '@danecodes/uncle-jesse-core';

export default defineConfig({
  devices: [{
    name: string;
    platform: 'roku';
    ip: string;
    rokuDevPassword?: string;
  }],
  defaults?: {
    timeout?: number;     // default: 10000
    pressDelay?: number;  // default: 150
  },
  app?: {
    rokuAppId?: string;
  },
});
```

### RegistryState

Registry state builder. Apply via launch params or write directly through ODC.

```typescript
class RegistryState {
  set(section: string, key: string, value: string): this;
  merge(other: RegistryData): this;
  toJSON(): RegistryData;

  // Via ECP launch params (app must handle odc_registry param)
  toLaunchParams(options?: { clearRegistry?: boolean }): Record<string, string>;

  // Via roku-odc direct registry access (requires @danecodes/roku-odc)
  applyViaOdc(odc: OdcClient, options?: { clearFirst?: boolean }): Promise<void>;
  static readFromDevice(odc: OdcClient): Promise<RegistryState>;

  static skipOnboarding(): RegistryState;
  static authenticated(): RegistryState;
  static from(data: RegistryData): RegistryState;
}
```

### DevicePool

Device pool for running tests across multiple Rokus in parallel.

```typescript
class DevicePool {
  constructor(devices: TVDevice[], options?: { acquireTimeout?: number });

  get size(): number;
  get freeCount(): number;
  get busyCount(): number;

  acquire(): Promise<TVDevice>;   // blocks until a device is available
  release(device: TVDevice): void;
  drain(): Promise<void>;         // disconnects all devices
}
```

## @danecodes/uncle-jesse-roku

### RokuAdapter

```typescript
class RokuAdapter implements TVDevice {
  constructor(options: {
    name: string;
    ip: string;
    devPassword?: string;
    timeout?: number;
    pressDelay?: number;
  });

  // All TVDevice methods, plus Roku-specific:
  readConsole(options?: { duration?: number; filter?: string }): Promise<string>;
  getMediaPlayerState(): Promise<MediaPlayerInfo>;
  waitForPlayback(options?: { timeout?: number }): Promise<MediaPlayerInfo>;
  waitForPlaybackPosition(positionMs: number, options?: { timeout?: number }): Promise<MediaPlayerInfo>;

  // Structured log capture via @danecodes/roku-log
  get logs(): LogSession;              // current session's parsed log entries
  startLogCapture(): Promise<void>;    // start streaming from port 8085
  stopLogCapture(): void;              // stop streaming
  hasErrors(): boolean;                // any BrightScript errors captured
  hasCrashes(): boolean;               // any crashes/backtraces captured
  getLogSummary(): { errorCount: number; crashCount: number; beaconCount: number; launchTime?: number; uniqueErrors: string[] };

  // Log assertions (throw on failure)
  expectNoErrors(): void;
  expectNoCrashes(): void;
  expectBeacon(event: string, options?: { within?: number }): void;

  // Media player assertions
  toBePlayingVideo(options?: { timeout?: number }): Promise<void>;
  toHavePlaybackPosition(minMs: number, maxMs?: number, options?: { timeout?: number }): Promise<void>;
  toHaveDuration(minMs: number, options?: { timeout?: number }): Promise<void>;

  // App state
  getAppState(appId: string): Promise<'not-running' | 'foreground' | 'not-installed'>;
  waitForAppState(appId: string, state: 'not-running' | 'foreground' | 'not-installed', options?: WaitOptions): Promise<void>;
  getPageSourceXml(): Promise<string>;
  sendInput(params: Record<string, string | number>): Promise<void>;

  // File operations (requires roku-odc)
  setOdc(odc: OdcLike): void;
  pullFile(source: string): Promise<Buffer>;
  pushFile(destination: string, data: Buffer): Promise<void>;
  listFiles(path?: string): Promise<string[]>;

  // Note: home() waits for the current app to exit before returning.
  // launchApp() and deepLink() wait for the target app to become active.
  // launchApp() dismisses the screensaver if the device was idle.
  // waitForStable() delegates to roku-ecp by default. Pass indicators
  // and trackedAttributes for app-specific stability definitions.
}
```

#### Roku key mapping notes

Some RemoteKey values map differently on Roku than you might expect:

- `pause` maps to the same ECP key as `play` (Roku has a single Play/Pause toggle)
- `channelUp` and `channelDown` map to `InputTuner` (Roku has no channel keys)

### RokuDiscovery

```typescript
class RokuDiscovery {
  findFirst(options?: { timeout?: number }): Promise<RokuAdapter>;
  findAll(options?: { timeout?: number }): Promise<RokuAdapter[]>;
  scan(options?: { timeout?: number }): Promise<DiscoveredDevice[]>;
}
```

## @danecodes/uncle-jesse-test

### Vitest Plugin

Vitest plugin that handles device setup, log capture, screenshots on failure, and cleanup so you don't have to wire all that up yourself.

```typescript
// vitest.config.ts
import { uncleJessePlugin } from '@danecodes/uncle-jesse-test/vitest-plugin';

export default defineConfig({
  plugins: [uncleJessePlugin({
    screenshotOnFailure: true,    // default: true
    logCapture: true,             // default: false
    artifactDir: 'test-results',  // default: ./test-results
    logDir: 'test-logs',          // default: ./test-logs
    onTestStart: async (device) => { /* custom setup */ },
    onTestFinished: async (device, result) => { /* custom teardown */ },
  })],
});
```

Configuration functions for setup files:

```typescript
import { setDeviceFactory, setScreenshotOnFailure, setLogCapture, setTestHooks } from '@danecodes/uncle-jesse-test';

setDeviceFactory(async () => new RokuAdapter({ ... }));
setScreenshotOnFailure(true, './test-results');
setLogCapture(true, './test-logs');
setTestHooks({
  onTestStart: async (device) => { /* ... */ },
  onTestFinished: async (device, result) => { /* ... */ },
});
```

### focusPath

```typescript
function focusPath(device: TVDevice, options?: {
  record?: boolean;
  testName?: string;
}): FocusPathBuilder;

interface FocusPathResult {
  passed: boolean;
  failures: FocusPathFailure[];
  replay?: ReplayTimeline;
}

interface FocusPathFailure {
  step: number;
  key: RemoteKey;
  expectedSelector: string;
  actualFocus: string | undefined;
  message: string;
}
```

### Vitest matchers

Extended on `expect()` when using the test package:

```typescript
expect(element).toBeFocused();
expect(element).toBeVisible();
expect(element).toHaveText('Movies');
expect(element).toExist();
expect(element).toHaveAttribute('opacity', '1.0');
```

### Replay

```typescript
import { saveReplay } from '@danecodes/uncle-jesse-test/replay';
import { ReplayRecorder, generateReplayHtml } from '@danecodes/uncle-jesse-test/replay';

// Save a focusPath replay to disk
await saveReplay(timeline, './test-results');

// Or generate HTML manually
const html = generateReplayHtml(timeline);
```

### CtrfReporter

[CTRF](https://ctrf.io) report generator. Writes JSON you can feed into Databricks, CI dashboards, or wherever you aggregate test results.

```typescript
import { CtrfReporter } from 'uncle-jesse';

const reporter = new CtrfReporter({
  outputDir?: string;          // default: ./test-results
  outputFile?: string;         // default: ctrf-report.json
  deviceName?: string;         // appears on each test result
  appName?: string;            // environment metadata
  appVersion?: string;
  buildId?: string;
  testEnvironment?: string;
});

// Feed results, then save
reporter.save();               // returns the file path

// Or get raw JSON
const json = reporter.getOutput();
```

Includes device name per test, suite hierarchy, and focusPath step failures. The `errored` status maps to CTRF's `other`.

## uncle-jesse CLI

```
uncle-jesse test [options]        Run TV E2E tests
  -c, --config <path>             Path to vitest config file
  --reporter <type>               Reporter: console, junit, ctrf (default: console)
  -w, --watch                     Run in watch mode

uncle-jesse discover [options]    Discover TV devices on the network
  --timeout <ms>                  Discovery timeout in ms (default: 5000)

uncle-jesse sideload <path>       Sideload a channel to a Roku device
  --ip <address>                  Device IP (or set UNCLE_JESSE_ROKU_IP)
  --password <password>           Dev password (default: rokudev)
```

### Environment variables

| Variable | Description |
|----------|-------------|
| `UNCLE_JESSE_ROKU_IP` | Default device IP for sideload and tests |
| `UNCLE_JESSE_ROKU_PASSWORD` | Default dev password (default: rokudev) |
