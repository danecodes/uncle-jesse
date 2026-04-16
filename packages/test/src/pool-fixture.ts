import { test as baseTest, expect } from 'vitest';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { DevicePool } from '@danecodes/uncle-jesse-core';
import { tvMatchers } from './matchers.js';

export interface PoolFixtures {
  tv: TVDevice;
}

let _pool: DevicePool | null = null;

export function setDevicePool(pool: DevicePool): void {
  _pool = pool;
}

export const poolTest = baseTest.extend<PoolFixtures>({
  // eslint-disable-next-line no-empty-pattern
  tv: async ({}, use) => {
    if (!_pool) {
      throw new Error(
        'No device pool configured. Call setDevicePool() in your vitest setup file.',
      );
    }

    const device = await _pool.acquire();

    try {
      await use(device);
    } finally {
      _pool.release(device);
    }
  },
});

expect.extend(tvMatchers);
