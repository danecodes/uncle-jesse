import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { RegistryState } from '@danecodes/uncle-jesse-core';

export interface RokuSessionOptions {
  deviceIp: string;
  channelId: string;
  devPassword?: string;
  timeout?: number;
  pressDelay?: number;

  /** Registry state helpers to compose before launch. */
  registry?: RegistryState[];

  /** Extra launch params (clearRegistry, feature flags, etc). */
  launchArgs?: Record<string, string>;

  /** Artifact configuration for logs and screenshots. */
  artifacts?: {
    baseDir?: string;
    captureLog?: boolean;
    screenshotOnFail?: boolean;
  };

  /** User-supplied app factory. Called with the device after connect. */
  appFactory?: (device: TVDevice) => unknown;
}

export interface RokuSession {
  device: TVDevice;
  app: unknown;
  screenshot(): Promise<Buffer | null>;
  saveScreenshot(name: string): Promise<string | null>;
  dispose(): Promise<void>;
}

/**
 * Consolidates Roku test setup into a single call. Connects, composes
 * registry state, launches the channel, starts log capture, and returns
 * a session you can destructure.
 *
 * ```typescript
 * const session = await RokuTestSession.create({
 *   deviceIp: process.env.ROKU_IP!,
 *   channelId: 'dev',
 *   registry: [RegistryState.skipOnboarding()],
 *   artifacts: { captureLog: true, screenshotOnFail: true },
 * });
 * const { device } = session;
 * await session.dispose();
 * ```
 */
export class RokuTestSession implements RokuSession {
  private _device: TVDevice;
  private _app: unknown;
  private _artifacts: RokuSessionOptions['artifacts'];
  private _stopLogCapture: (() => void) | null;

  private constructor(
    device: TVDevice,
    app: unknown,
    artifacts: RokuSessionOptions['artifacts'],
    stopLogCapture: (() => void) | null,
  ) {
    this._device = device;
    this._app = app;
    this._artifacts = artifacts;
    this._stopLogCapture = stopLogCapture;
  }

  get device(): TVDevice { return this._device; }
  get app(): unknown { return this._app; }

  static async create(options: RokuSessionOptions): Promise<RokuTestSession> {
    // Dynamic import -- test package doesn't hard-depend on roku package
    let RokuAdapter: any;
    try {
      const mod = await import('@danecodes/uncle-jesse-roku' as string);
      RokuAdapter = mod.RokuAdapter;
    } catch {
      throw new Error(
        'RokuTestSession requires @danecodes/uncle-jesse-roku. Install it as a dependency.'
      );
    }

    const device = new RokuAdapter({
      name: 'test',
      ip: options.deviceIp,
      devPassword: options.devPassword ?? 'rokudev',
      timeout: options.timeout,
      pressDelay: options.pressDelay,
    });

    await device.connect();

    // Start log capture if requested
    let stopLogCapture: (() => void) | null = null;
    if (options.artifacts?.captureLog && typeof device.startLogCapture === 'function') {
      await device.startLogCapture();
      stopLogCapture = () => device.stopLogCapture();
    }

    // Compose registry state from helpers
    const launchParams: Record<string, string> = { ...options.launchArgs };
    if (options.registry && options.registry.length > 0) {
      const combined = new RegistryState();
      for (const r of options.registry) {
        combined.merge(r.toJSON());
      }
      Object.assign(launchParams, combined.toLaunchParams());
    }

    // Launch
    await device.launchApp(options.channelId, launchParams);

    // Build app if factory provided
    const app = options.appFactory ? options.appFactory(device) : null;

    return new RokuTestSession(device, app, options.artifacts, stopLogCapture);
  }

  async screenshot(): Promise<Buffer | null> {
    try {
      return await this._device.screenshot();
    } catch {
      return null;
    }
  }

  async saveScreenshot(name: string): Promise<string | null> {
    const buf = await this.screenshot();
    if (!buf) return null;
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const dir = this._artifacts?.baseDir ?? 'test-results';
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(dir, `${name}.png`);
    await fs.writeFile(file, buf);
    return file;
  }

  async dispose(): Promise<void> {
    if (this._stopLogCapture) {
      this._stopLogCapture();
    }
    await this._device.disconnect();
  }
}
