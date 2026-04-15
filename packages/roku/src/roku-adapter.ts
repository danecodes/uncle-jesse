import {
  EcpClient, type KeyName, parseUiXml, findElement, findElements, type UiNode,
  waitForApp, waitForElement as ecpWaitForElement, waitForFocus as ecpWaitForFocus,
  waitFor, waitForStable as ecpWaitForStable,
} from '@danecodes/roku-ecp';
import { LogStream, LogSession, type LogEntry } from '@danecodes/roku-log';
import {
  type TVDevice,
  type Platform,
  type RemoteKey,
  type Direction,
  type WaitOptions,
  type WaitForStableOptions,
  type AppInfo,
  UIElement,
  DeviceConnectionError,
  TimeoutError,
} from '@danecodes/uncle-jesse-core';
import { RokuKeyMap } from './roku-key-map.js';

export class RokuAdapter implements TVDevice {
  readonly platform: Platform = 'roku';
  readonly name: string;
  readonly ip: string;

  private client: EcpClient;
  private connected = false;
  private pressDelay: number;
  private logStream: LogStream | null = null;
  private _logSession: LogSession = new LogSession();

  constructor(options: {
    name: string;
    ip: string;
    devPassword?: string;
    timeout?: number;
    pressDelay?: number;
  }) {
    this.name = options.name;
    this.ip = options.ip;
    this.pressDelay = options.pressDelay ?? 150;
    this.client = new EcpClient(options.ip, {
      devPassword: options.devPassword,
      timeout: options.timeout,
    });
  }

  get logs(): LogSession {
    return this._logSession;
  }

  async connect(): Promise<void> {
    try {
      await this.client.queryDeviceInfo();
      this.connected = true;
    } catch (err) {
      throw new DeviceConnectionError(this.ip, err as Error);
    }
  }

  async disconnect(): Promise<void> {
    this.stopLogCapture();
    this.connected = false;
  }

  async startLogCapture(): Promise<void> {
    if (this.logStream) return;
    this._logSession.clear();
    this.logStream = new LogStream(this.ip);
    this.logStream.on('entry', (entry: LogEntry) => {
      this._logSession.add(entry);
    });
    try {
      await this.logStream.connect();
    } catch {
      // Debug console might be in use or unavailable
      this.logStream = null;
    }
  }

  stopLogCapture(): void {
    if (this.logStream) {
      this.logStream.disconnect();
      this.logStream = null;
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  async press(key: RemoteKey, options?: { times?: number; delay?: number }): Promise<void> {
    const ecpKey = RokuKeyMap[key];
    const times = options?.times ?? 1;
    const delay = options?.delay ?? this.pressDelay;
    await this.client.press(ecpKey, { times, delay });
  }

  async longPress(key: RemoteKey, duration?: number): Promise<void> {
    const ecpKey = RokuKeyMap[key];
    await this.client.keydown(ecpKey);
    await new Promise((resolve) => setTimeout(resolve, duration ?? 1000));
    await this.client.keyup(ecpKey);
  }

  async type(text: string): Promise<void> {
    await this.client.type(text);
  }

  async sendInput(params: Record<string, string | number>): Promise<void> {
    const stringParams: Record<string, string> = {};
    for (const [key, value] of Object.entries(params)) {
      stringParams[key] = String(value);
    }
    await this.client.input(stringParams);
  }

  async navigate(direction: Direction, steps = 1): Promise<void> {
    await this.press(direction, { times: steps });
  }

  async select(): Promise<void> {
    await this.press('select');
  }

  async back(): Promise<void> {
    await this.press('back');
  }

  async home(): Promise<void> {
    const appBefore = await this.client.queryActiveApp();
    await this.press('home');
    // Wait until the active app changes (we've left the current app)
    const start = Date.now();
    while (Date.now() - start < 10000) {
      const app = await this.client.queryActiveApp();
      if (app.id !== appBefore.id) return;
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  async launchApp(appId: string, params?: Record<string, string>): Promise<void> {
    await this.client.launch(appId, params);

    // Dismiss screensaver if the device was idle
    await new Promise((r) => setTimeout(r, 500));
    const app = await this.client.queryActiveApp();
    if (app.type === 'screensaver' || app.name?.includes('Screensaver')) {
      await this.client.keypress('Enter');
      await new Promise((r) => setTimeout(r, 1000));
    }

    await waitForApp(this.client, appId, { timeout: 15000 });
  }

  async closeApp(): Promise<void> {
    await this.client.closeApp();
  }

  async deepLink(channelId: string, contentId: string, mediaType?: string): Promise<void> {
    await this.client.deepLink(channelId, contentId, mediaType);
    await waitForApp(this.client, channelId, { timeout: 15000 });
  }

  async getActiveApp(): Promise<AppInfo> {
    const app = await this.client.queryActiveApp();
    return {
      id: app.id,
      name: app.name,
      version: app.version,
    };
  }

  async getInstalledApps(): Promise<AppInfo[]> {
    const apps = await this.client.queryInstalledApps();
    return apps.map((app) => ({
      id: app.id,
      name: app.name,
      version: app.version,
    }));
  }

  async getAppState(appId: string): Promise<'not-running' | 'foreground' | 'not-installed'> {
    const active = await this.client.queryActiveApp();
    if (active.id === appId) return 'foreground';
    const installed = await this.client.queryInstalledApps();
    const found = installed.some((a) => a.id === appId);
    return found ? 'not-running' : 'not-installed';
  }

  async waitForAppState(
    appId: string,
    state: 'not-running' | 'foreground' | 'not-installed',
    options?: WaitOptions,
  ): Promise<void> {
    await waitFor(async () => {
      const current = await this.getAppState(appId);
      return current === state ? true : undefined;
    }, { ...options, label: `waitForAppState(${appId}, ${state})` });
  }

  private getTreeSource = async (): Promise<UiNode> => {
    const xml = await this.client.queryAppUi();
    return parseUiXml(xml);
  };

  private async getRawUITree(): Promise<UiNode> {
    return this.getTreeSource();
  }

  private uiNodeToElement(node: UiNode, parent: UIElement | null = null): UIElement {
    const attrs = { ...node.attrs };
    if (node.name) attrs['name'] = node.name;
    const element = new UIElement(node.tag, attrs, [], parent);
    for (const child of node.children) {
      element.children.push(this.uiNodeToElement(child, element));
    }
    return element;
  }

  async getUITree(): Promise<UIElement> {
    const raw = await this.getRawUITree();
    return this.uiNodeToElement(raw);
  }

  async $(selector: string): Promise<UIElement | null> {
    const raw = await this.getRawUITree();
    const found = findElement(raw, selector);
    return found ? this.uiNodeToElement(found) : null;
  }

  async $$(selector: string): Promise<UIElement[]> {
    const raw = await this.getRawUITree();
    const found = findElements(raw, selector);
    return found.map((n) => this.uiNodeToElement(n));
  }

  async getFocusedElement(): Promise<UIElement | null> {
    // Roku marks focused="true" on items in every row, not just the
    // active one. Walk down the focus chain from root, always picking
    // the first focused child at each level. When no direct child is
    // focused (e.g. PosterGrid doesn't get the attr), search all
    // descendants of each child for focused nodes and follow that branch.
    const raw = await this.getRawUITree();
    const leaf = this.findFocusLeaf(raw);
    if (!leaf) return null;
    return this.uiNodeToElement(leaf);
  }

  private findFocusLeaf(node: UiNode): UiNode | null {
    const focusedChild = node.children.find(
      (c) => c.attrs['focused'] === 'true',
    );
    if (focusedChild) {
      // Recurse deeper into this branch
      return this.findFocusLeaf(focusedChild) ?? focusedChild;
    }

    // No direct focused child. Check if any child has a focused descendant
    // (handles cases like PosterGrid where the container isn't focused).
    for (const child of node.children) {
      if (this.hasFocusedDescendant(child)) {
        return this.findFocusLeaf(child);
      }
    }

    return null;
  }

  private hasFocusedDescendant(node: UiNode): boolean {
    for (const child of node.children) {
      if (child.attrs['focused'] === 'true') return true;
      if (this.hasFocusedDescendant(child)) return true;
    }
    return false;
  }

  async waitForElement(selector: string, options?: WaitOptions): Promise<UIElement> {
    const node = await ecpWaitForElement(this.getTreeSource, selector, options);
    return this.uiNodeToElement(node);
  }

  async waitForFocus(selector: string, options?: WaitOptions): Promise<UIElement> {
    const node = await ecpWaitForFocus(this.getTreeSource, selector, options);
    return this.uiNodeToElement(node);
  }

  async waitForCondition<T>(predicate: () => Promise<T | null | false>, options?: WaitOptions): Promise<T> {
    return waitFor(async () => {
      const result = await predicate();
      if (result === null || result === false) return undefined;
      return result;
    }, { ...options, label: 'waitForCondition' });
  }

  async getPageSourceXml(): Promise<string> {
    return this.client.queryAppUi();
  }

  async waitForStable(options?: WaitForStableOptions): Promise<void> {
    const hasCustomChecks = options?.indicators?.length || options?.trackedAttributes?.length;

    if (!hasCustomChecks) {
      // No app-specific config: delegate to roku-ecp's tree-level stability check
      await ecpWaitForStable(this.getTreeSource, options);
      return;
    }

    // App-specific stability: user provided indicators or tracked attributes
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 100;
    const settleCount = options?.settleCount ?? 2;
    const indicators = options.indicators ?? [];
    const trackedAttrs = options.trackedAttributes;

    const start = Date.now();
    let stableCount = 0;
    let previousSnapshot = '';

    while (Date.now() - start < timeout) {
      const xml = await this.client.queryAppUi();

      // Check for user-specified loading indicators
      let hasIndicator = false;
      if (indicators.length > 0) {
        const tree = parseUiXml(xml);
        for (const indicator of indicators) {
          const found = findElement(tree, indicator);
          if (found && found.attrs['visible'] !== 'false') {
            hasIndicator = true;
            break;
          }
        }
      }

      if (hasIndicator) {
        stableCount = 0;
        previousSnapshot = '';
        await new Promise((r) => setTimeout(r, interval));
        continue;
      }

      const snapshot = trackedAttrs ? stripToTrackedAttrs(xml, trackedAttrs) : xml;

      if (snapshot === previousSnapshot) {
        stableCount++;
        if (stableCount >= settleCount) return;
      } else {
        stableCount = 1;
      }

      previousSnapshot = snapshot;
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new TimeoutError('waitForStable', Date.now() - start);
  }

  async readConsole(options?: { duration?: number; filter?: string }): Promise<string> {
    return this.client.readConsole(options);
  }

  hasErrors(): boolean {
    return this._logSession.errors.length > 0;
  }

  hasCrashes(): boolean {
    return this._logSession.crashes.length > 0;
  }

  getLogSummary() {
    return this._logSession.summary();
  }

  async getMediaPlayerState(): Promise<MediaPlayerInfo> {
    const state = await this.client.queryMediaPlayer();
    return {
      state: state.state,
      isError: state.error,
      position: state.position ? parseTimeMs(state.position) : undefined,
      duration: state.duration ? parseTimeMs(state.duration) : undefined,
      isLive: state.isLive,
      format: state.format ? {
        audio: state.format.audio,
        video: state.format.video,
        captions: state.format.captions,
        drm: state.format.drm,
      } : undefined,
      plugin: state.plugin ? {
        id: state.plugin.id,
        name: state.plugin.name,
      } : undefined,
    };
  }

  async waitForPlayback(options?: { timeout?: number }): Promise<MediaPlayerInfo> {
    const timeout = options?.timeout ?? 15000;
    const interval = 500;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const state = await this.getMediaPlayerState();
      if (state.state === 'play') return state;
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`Video did not start playing within ${timeout}ms`);
  }

  async waitForPlaybackPosition(positionMs: number, options?: { timeout?: number }): Promise<MediaPlayerInfo> {
    const timeout = options?.timeout ?? 30000;
    const interval = 500;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const state = await this.getMediaPlayerState();
      if (state.position !== undefined && state.position >= positionMs) return state;
      await new Promise((r) => setTimeout(r, interval));
    }

    throw new Error(`Playback did not reach ${positionMs}ms within ${timeout}ms`);
  }

  // Media player assertions
  async toBePlayingVideo(options?: { timeout?: number }): Promise<void> {
    const state = await this.waitForPlayback(options);
    if (state.isError) {
      throw new Error(`Expected video to be playing but got error state`);
    }
  }

  async toHavePlaybackPosition(minMs: number, maxMs?: number, options?: { timeout?: number }): Promise<void> {
    const state = await this.waitForPlaybackPosition(minMs, options);
    if (maxMs !== undefined && state.position !== undefined && state.position > maxMs) {
      throw new Error(
        `Expected playback position between ${minMs}ms and ${maxMs}ms, got ${state.position}ms`
      );
    }
  }

  async toHaveDuration(minMs: number, options?: { timeout?: number }): Promise<void> {
    const timeout = options?.timeout ?? 15000;
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const state = await this.getMediaPlayerState();
      if (state.duration !== undefined && state.duration >= minMs) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    const state = await this.getMediaPlayerState();
    throw new Error(
      `Expected duration >= ${minMs}ms, got ${state.duration ?? 'unknown'}ms`
    );
  }

  // Log assertions
  expectNoErrors(): void {
    const errors = this._logSession.errors;
    if (errors.length > 0) {
      const messages = errors.map((e) => `${e.errorClass} at ${e.source.file}:${e.source.line}`);
      throw new Error(
        `Expected no BrightScript errors but found ${errors.length}:\n${messages.join('\n')}`
      );
    }
  }

  expectNoCrashes(): void {
    const crashes = this._logSession.crashes;
    if (crashes.length > 0) {
      const messages = crashes.map((c) => {
        const frames = c.frames.map((f) => `  ${f.function} (${f.file}:${f.line})`).join('\n');
        return `Crash:\n${frames}`;
      });
      throw new Error(
        `Expected no crashes but found ${crashes.length}:\n${messages.join('\n')}`
      );
    }
  }

  expectBeacon(event: string, options?: { within?: number }): void {
    const beacons = this._logSession.beacons.filter((b) => b.event === event);
    if (beacons.length === 0) {
      throw new Error(`Expected beacon "${event}" but none was captured`);
    }
    if (options?.within !== undefined) {
      const beacon = beacons[0];
      if (beacon.duration !== undefined && beacon.duration > options.within) {
        throw new Error(
          `Beacon "${event}" took ${beacon.duration}ms, expected within ${options.within}ms`
        );
      }
    }
  }

  async screenshot(): Promise<Buffer> {
    return this.client.takeScreenshot();
  }
}

export interface MediaPlayerInfo {
  state: string;
  isError: boolean;
  position?: number;
  duration?: number;
  isLive?: boolean;
  format?: {
    audio: string;
    video: string;
    captions: string;
    drm: string;
  };
  plugin?: {
    id: string;
    name: string;
  };
}

function stripToTrackedAttrs(xml: string, trackedAttrs: string[]): string {
  // Replace all attribute values that aren't in the tracked list with empty strings.
  // This gives us a comparable string that only reflects the attributes we care about.
  const attrPattern = /\s(\w+)="([^"]*)"/g;
  return xml.replace(attrPattern, (match, name) => {
    if (trackedAttrs.includes(name)) return match;
    return '';
  });
}

function parseTimeMs(value: string): number {
  // ECP returns position/duration as "HH:MM:SS" or milliseconds
  if (value.includes(':')) {
    const parts = value.split(':').map(Number);
    if (parts.length === 3) {
      return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
  }
  const ms = Number(value);
  return isNaN(ms) ? 0 : ms;
}
