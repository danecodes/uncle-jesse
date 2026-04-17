import type { Platform, RemoteKey, Direction, WaitOptions, AppInfo } from './types.js';
import type { UIElement } from './ui-element.js';

export interface WaitForStableOptions {
  timeout?: number;
  interval?: number;
  indicators?: string[];
  trackedAttributes?: string[];
  settleCount?: number;
}

export interface TVDevice {
  readonly platform: Platform;
  readonly name: string;
  readonly ip: string;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  press(key: RemoteKey, options?: { times?: number; delay?: number }): Promise<void>;
  longPress(key: RemoteKey, duration?: number): Promise<void>;
  type(text: string): Promise<void>;
  sendInput(params: Record<string, string | number>): Promise<void>;
  touch(x: number, y: number, op?: 'down' | 'up' | 'press' | 'move'): Promise<void>;

  navigate(direction: Direction, steps?: number): Promise<void>;
  select(): Promise<void>;
  back(): Promise<void>;
  home(): Promise<void>;

  launchApp(appId: string, params?: Record<string, string>): Promise<void>;
  closeApp(): Promise<void>;
  getActiveApp(): Promise<AppInfo>;
  getInstalledApps(): Promise<AppInfo[]>;

  getUITree(): Promise<UIElement>;
  $(selector: string): Promise<UIElement | null>;
  $$(selector: string): Promise<UIElement[]>;
  getFocusedElement(): Promise<UIElement | null>;
  waitForElement(selector: string, options?: WaitOptions): Promise<UIElement>;
  waitForFocus(selector: string, options?: WaitOptions): Promise<UIElement>;
  waitForCondition<T>(predicate: () => Promise<T | null | false>, options?: WaitOptions): Promise<T>;
  waitUntil(predicate: () => Promise<boolean>, options?: { timeout?: number; interval?: number; timeoutMsg?: string }): Promise<void>;
  waitForStable(options?: WaitForStableOptions): Promise<void>;
  pause(ms: number): Promise<void>;

  // ODC observation (optional, used by assertions for faster waiting)
  observeField?(nodeId: string, field: string, options?: {
    match?: unknown;
    timeout?: number;
  }): Promise<{ value: unknown; matched: boolean }>;

  deepLink(channelId: string, contentId: string, mediaType?: string): Promise<void>;
  screenshot(): Promise<Buffer>;
}
