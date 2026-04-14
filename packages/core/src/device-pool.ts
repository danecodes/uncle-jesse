import type { TVDevice } from './tv-device.js';

export interface DevicePoolOptions {
  acquireTimeout?: number;
}

export class DevicePool {
  private available: TVDevice[] = [];
  private inUse = new Set<TVDevice>();
  private waiters: Array<(device: TVDevice) => void> = [];
  private acquireTimeout: number;

  constructor(devices: TVDevice[], options?: DevicePoolOptions) {
    this.available = [...devices];
    this.acquireTimeout = options?.acquireTimeout ?? 60000;
  }

  get size(): number {
    return this.available.length + this.inUse.size;
  }

  get freeCount(): number {
    return this.available.length;
  }

  get busyCount(): number {
    return this.inUse.size;
  }

  async acquire(): Promise<TVDevice> {
    const device = this.available.shift();
    if (device) {
      this.inUse.add(device);
      return device;
    }

    return new Promise<TVDevice>((resolve, reject) => {
      const timer = setTimeout(() => {
        const idx = this.waiters.indexOf(resolve);
        if (idx >= 0) this.waiters.splice(idx, 1);
        reject(new Error(
          `DevicePool: timed out waiting for a device (${this.acquireTimeout}ms). ` +
          `${this.inUse.size} device(s) in use, 0 available.`
        ));
      }, this.acquireTimeout);

      this.waiters.push((d: TVDevice) => {
        clearTimeout(timer);
        resolve(d);
      });
    });
  }

  release(device: TVDevice): void {
    if (!this.inUse.has(device)) return;
    this.inUse.delete(device);

    const waiter = this.waiters.shift();
    if (waiter) {
      this.inUse.add(device);
      waiter(device);
    } else {
      this.available.push(device);
    }
  }

  async drain(): Promise<void> {
    const all = [...this.available, ...this.inUse];
    for (const device of all) {
      try {
        await device.disconnect();
      } catch {
        // best effort
      }
    }
    this.available = [];
    this.inUse.clear();
  }
}
