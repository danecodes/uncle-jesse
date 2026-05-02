import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { RegistryState } from '@danecodes/uncle-jesse-core';

export interface RokuSessionOptions {
  deviceIp: string;
  channelId: string;
  devPassword?: string;
  timeout?: number;
  pressDelay?: number;

  /** Path to a .zip or .squashfs to sideload before launch. */
  channelArtifact?: { path: string };

  /** Registry state helpers to compose before launch. Written via ODC. */
  registry?: RegistryState[];

  /** Extra launch params (feature flags, overrides, etc). */
  launchArgs?: Record<string, string>;

  /** Artifact configuration for logs and screenshots. */
  artifacts?: {
    baseDir?: string;
    captureLog?: boolean;
    screenshotOnFail?: boolean;
  };

  /** User-supplied app factory. Called with the device after launch. */
  appFactory?: (device: TVDevice) => any;

  /** Lifecycle hooks. */
  hooks?: {
    beforeLaunch?: (device: TVDevice) => Promise<void>;
    afterLaunch?: (device: TVDevice, app: any) => Promise<void>;
    beforeDispose?: (device: TVDevice) => Promise<void>;
  };
}

export interface RokuSession<TApp = unknown> {
  device: TVDevice;
  app: TApp;
  screenshot(): Promise<Buffer | null>;
  saveScreenshot(name: string): Promise<string | null>;
  dispose(): Promise<void>;
}

/**
 * Consolidates Roku test setup into a single call.
 *
 * The full sequence:
 * 1. Create RokuAdapter with auto-ODC
 * 2. Connect to the device
 * 3. (Optional) Sideload channel artifact
 * 4. Write registry state via ODC if available, otherwise via launch params
 * 5. Launch the channel
 * 6. Start log capture if configured
 * 7. Return { device, app, dispose }
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
export class RokuTestSession<TApp = unknown> implements RokuSession<TApp> {
  private _device: TVDevice;
  private _app: TApp;
  private _artifacts: RokuSessionOptions['artifacts'];
  private _stopLogCapture: (() => void) | null;
  private _options: RokuSessionOptions;
  private _hooks: RokuSessionOptions['hooks'];

  private constructor(
    device: TVDevice,
    app: TApp,
    artifacts: RokuSessionOptions['artifacts'],
    stopLogCapture: (() => void) | null,
    options: RokuSessionOptions,
  ) {
    this._device = device;
    this._app = app;
    this._artifacts = artifacts;
    this._stopLogCapture = stopLogCapture;
    this._options = options;
    this._hooks = options.hooks;
  }

  get device(): TVDevice { return this._device; }
  get app(): TApp { return this._app; }

  static async create<TApp = unknown>(options: RokuSessionOptions & {
    appFactory?: (device: TVDevice) => TApp;
  }): Promise<RokuTestSession<TApp>> {
    // Dynamic import so test package doesn't hard-depend on roku package
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
      odc: true,
    });

    await device.connect();

    // Sideload if artifact provided
    if (options.channelArtifact) {
      await device.sideload(options.channelArtifact.path);
    }

    // Compose registry state
    let registryData: Record<string, Record<string, string>> | null = null;
    if (options.registry && options.registry.length > 0) {
      const combined = new RegistryState();
      for (const r of options.registry) {
        combined.merge(r.toJSON());
      }
      registryData = combined.toJSON();
    }

    // Write registry via ODC if available, otherwise fall back to launch params
    const launchParams: Record<string, string> = { ...options.launchArgs };
    if (registryData) {
      if (device.hasOdc) {
        await device.clearRegistry();
        await device.setRegistry(registryData);
      } else {
        // Fall back to launch params
        const rs = RegistryState.from(registryData);
        Object.assign(launchParams, rs.toLaunchParams());
      }
    }

    // Start log capture before launch so we catch launch logs
    let stopLogCapture: (() => void) | null = null;
    if (options.artifacts?.captureLog && typeof device.startLogCapture === 'function') {
      await device.startLogCapture();
      stopLogCapture = () => device.stopLogCapture();
    }

    // beforeLaunch hook
    if (options.hooks?.beforeLaunch) {
      await options.hooks.beforeLaunch(device);
    }

    // Launch
    await device.launchApp(options.channelId, launchParams);

    // Build app if factory provided
    const app = (options.appFactory ? options.appFactory(device) : null) as TApp;

    // afterLaunch hook
    if (options.hooks?.afterLaunch) {
      await options.hooks.afterLaunch(device, app);
    }

    return new RokuTestSession<TApp>(device, app, options.artifacts, stopLogCapture, options);
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

  /** Relaunch the channel without reconnecting or re-sideloading. */
  async relaunch(launchArgs?: Record<string, string>): Promise<void> {
    await this._device.closeApp();

    const params: Record<string, string> = { ...this._options.launchArgs, ...launchArgs };

    // Re-apply registry if configured
    if (this._options.registry && this._options.registry.length > 0) {
      const combined = new RegistryState();
      for (const r of this._options.registry) {
        combined.merge(r.toJSON());
      }
      const device = this._device as any;
      if (device.hasOdc) {
        await device.clearRegistry();
        await device.setRegistry(combined.toJSON());
      } else {
        Object.assign(params, combined.toLaunchParams());
      }
    }

    if (this._hooks?.beforeLaunch) {
      await this._hooks.beforeLaunch(this._device);
    }

    await this._device.launchApp(this._options.channelId, params);

    if (this._hooks?.afterLaunch) {
      await this._hooks.afterLaunch(this._device, this._app);
    }
  }

  async dispose(): Promise<void> {
    if (this._hooks?.beforeDispose) {
      await this._hooks.beforeDispose(this._device);
    }
    if (this._stopLogCapture) {
      this._stopLogCapture();
    }
    await this._device.disconnect();
  }
}
