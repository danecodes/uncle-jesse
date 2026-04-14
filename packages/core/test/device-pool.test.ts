import { describe, it, expect, vi } from 'vitest';
import { DevicePool } from '../src/device-pool.js';
import type { TVDevice } from '../src/tv-device.js';

function mockDevice(name: string): TVDevice {
  return {
    platform: 'roku',
    name,
    ip: `192.168.1.${name}`,
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => true),
    press: vi.fn(),
    longPress: vi.fn(),
    type: vi.fn(),
    navigate: vi.fn(),
    select: vi.fn(),
    back: vi.fn(),
    home: vi.fn(),
    launchApp: vi.fn(),
    closeApp: vi.fn(),
    deepLink: vi.fn(),
    getActiveApp: vi.fn(),
    getInstalledApps: vi.fn(),
    getUITree: vi.fn(),
    $: vi.fn(),
    $$: vi.fn(),
    getFocusedElement: vi.fn(),
    waitForElement: vi.fn(),
    waitForFocus: vi.fn(),
    waitForCondition: vi.fn(),
    screenshot: vi.fn(),
  };
}

describe('DevicePool', () => {
  it('acquires and releases devices', async () => {
    const d1 = mockDevice('1');
    const d2 = mockDevice('2');
    const pool = new DevicePool([d1, d2]);

    expect(pool.size).toBe(2);
    expect(pool.freeCount).toBe(2);

    const acquired = await pool.acquire();
    expect(pool.freeCount).toBe(1);
    expect(pool.busyCount).toBe(1);

    pool.release(acquired);
    expect(pool.freeCount).toBe(2);
    expect(pool.busyCount).toBe(0);
  });

  it('queues when all devices are in use', async () => {
    const d1 = mockDevice('1');
    const pool = new DevicePool([d1]);

    const first = await pool.acquire();
    expect(pool.freeCount).toBe(0);

    let resolved = false;
    const secondPromise = pool.acquire().then((d) => {
      resolved = true;
      return d;
    });

    // Not resolved yet since the device is in use
    await new Promise((r) => setTimeout(r, 50));
    expect(resolved).toBe(false);

    // Release makes it available to the waiter
    pool.release(first);
    const second = await secondPromise;
    expect(resolved).toBe(true);
    expect(second).toBe(d1);
  });

  it('times out when no device becomes available', async () => {
    const d1 = mockDevice('1');
    const pool = new DevicePool([d1], { acquireTimeout: 100 });

    await pool.acquire();
    await expect(pool.acquire()).rejects.toThrow('timed out');
  });

  it('drains all devices', async () => {
    const d1 = mockDevice('1');
    const d2 = mockDevice('2');
    const pool = new DevicePool([d1, d2]);

    await pool.acquire();
    await pool.drain();

    expect(d1.disconnect).toHaveBeenCalled();
    expect(d2.disconnect).toHaveBeenCalled();
    expect(pool.size).toBe(0);
  });
});
