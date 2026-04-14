import { EcpClient, type KeyName, parseUiXml, findElement, findElements, findFocused, type UiNode, waitForApp } from '@danecodes/roku-ecp';
import {
  type TVDevice,
  type Platform,
  type RemoteKey,
  type Direction,
  type WaitOptions,
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

  async connect(): Promise<void> {
    try {
      await this.client.queryDeviceInfo();
      this.connected = true;
    } catch (err) {
      throw new DeviceConnectionError(this.ip, err as Error);
    }
  }

  async disconnect(): Promise<void> {
    this.connected = false;
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

  private async getRawUITree(): Promise<UiNode> {
    const xml = await this.client.queryAppUi();
    return parseUiXml(xml);
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
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();
    let lastTree: UIElement | undefined;

    while (Date.now() - start < timeout) {
      const raw = await this.getRawUITree();
      lastTree = this.uiNodeToElement(raw);
      const found = findElement(raw, selector);
      if (found) return this.uiNodeToElement(found);
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new TimeoutError(selector, Date.now() - start, lastTree);
  }

  async waitForFocus(selector: string, options?: WaitOptions): Promise<UIElement> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();
    let lastTree: UIElement | undefined;

    while (Date.now() - start < timeout) {
      const raw = await this.getRawUITree();
      lastTree = this.uiNodeToElement(raw);
      const found = findElement(raw, selector);
      if (found && found.attrs['focused'] === 'true') {
        return this.uiNodeToElement(found);
      }
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new TimeoutError(selector, Date.now() - start, lastTree);
  }

  async waitForCondition<T>(predicate: () => Promise<T | null | false>, options?: WaitOptions): Promise<T> {
    const timeout = options?.timeout ?? 10000;
    const interval = options?.interval ?? 200;
    const start = Date.now();

    while (Date.now() - start < timeout) {
      const result = await predicate();
      if (result !== null && result !== false) return result;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new TimeoutError('waitForCondition', Date.now() - start);
  }

  async readConsole(options?: { duration?: number; filter?: string }): Promise<string> {
    return this.client.readConsole(options);
  }

  async screenshot(): Promise<Buffer> {
    return this.client.takeScreenshot();
  }
}
