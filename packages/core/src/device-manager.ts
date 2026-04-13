import type { TVDevice } from './tv-device.js';
import type { DeviceConfig, UncleJesseConfig } from './types.js';

export class DeviceManager {
  private devices = new Map<string, TVDevice>();
  private config: UncleJesseConfig;

  constructor(config: UncleJesseConfig) {
    this.config = config;
  }

  register(name: string, device: TVDevice): void {
    this.devices.set(name, device);
  }

  get(name: string): TVDevice | undefined {
    return this.devices.get(name);
  }

  getAll(): TVDevice[] {
    return [...this.devices.values()];
  }

  getConfig(): UncleJesseConfig {
    return this.config;
  }

  getDeviceConfigs(): DeviceConfig[] {
    return this.config.devices;
  }

  async connectAll(): Promise<void> {
    await Promise.all(
      this.getAll().map((device) => device.connect()),
    );
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(
      this.getAll().map((device) => device.disconnect()),
    );
  }
}
