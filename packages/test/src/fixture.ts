import { test as baseTest, expect } from 'vitest';
import type { TVDevice } from '@uncle-jesse/core';
import { tvMatchers } from './matchers.js';

export interface TVFixtures {
  tv: TVDevice;
}

let _deviceFactory: (() => Promise<TVDevice>) | null = null;

export function setDeviceFactory(factory: () => Promise<TVDevice>): void {
  _deviceFactory = factory;
}

export const test = baseTest.extend<TVFixtures>({
  tv: async ({}, use) => {
    if (!_deviceFactory) {
      throw new Error(
        'No device factory configured. Call setDeviceFactory() in your vitest setup file, ' +
        'or use the uncle-jesse vitest plugin.',
      );
    }
    const device = await _deviceFactory();
    await device.connect();
    await use(device);
    await device.disconnect();
  },
});

expect.extend(tvMatchers);
