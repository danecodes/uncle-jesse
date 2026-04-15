# API Reference

For migration from Appium/WebdriverIO, see [Migration Guide](./migration.md). For Roku-specific behavior, see [Roku Focus Behavior](./roku-focus.md). For structuring your app for testing, see [Writing Testable Channels](./testable-channels.md).

## @danecodes/uncle-jesse-core

### TVDevice

The interface that all platform adapters implement. RokuAdapter is the Roku implementation.

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

A persistent reference to a UI element. Re-queries the device on each method call.

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
  getText(): Promise<string>;
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
  toExist(options?: WaitOptions): Promise<void>;
}
```

### ElementCollection

Returned by `$$()`. Lazy - elements are queried on demand.

```typescript
class ElementCollection {
  get(index: number): LiveElement;
  get length(): Promise<number>;
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

  get driver(): TVDevice;
}
```

### UIElement

A static snapshot of a SceneGraph node. Returned by `TVDevice.$()` and used internally by LiveElement.

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

Builds and applies registry state via launch params or direct ODC writes.

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

Manages a pool of devices for parallel test execution.

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

  // Note: home() waits for the current app to exit before returning.
  // launchApp() and deepLink() wait for the target app to become active.
}
```

#### Roku key mapping notes

Some RemoteKey values map differently on Roku than you might expect:

- `pause` maps to the same ECP key as `play` (Roku has a single Play/Pause toggle)
- `channelUp` and `channelDown` map to `InputTuner` (Roku has no channel keys)

```typescript
}
```

### RokuDiscovery

```typescript
class RokuDiscovery {
  findFirst(options?: { timeout?: number }): Promise<RokuAdapter>;
  findAll(options?: { timeout?: number }): Promise<RokuAdapter[]>;
  scan(options?: { timeout?: number }): Promise<DiscoveredDevice[]>;
}
```

## @danecodes/uncle-jesse-test

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

## uncle-jesse CLI

```
uncle-jesse test [options]        Run TV E2E tests
  -c, --config <path>             Path to vitest config file
  --reporter <type>               Reporter: console, junit (default: console)
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
