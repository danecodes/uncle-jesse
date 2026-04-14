import { test as baseTest, expect, onTestFailed } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { tvMatchers } from './matchers.js';

export interface TVFixtures {
  tv: TVDevice;
}

let _deviceFactory: (() => Promise<TVDevice>) | null = null;
let _screenshotOnFailure = true;
let _screenshotDir = './test-results';

export function setDeviceFactory(factory: () => Promise<TVDevice>): void {
  _deviceFactory = factory;
}

export function setScreenshotOnFailure(enabled: boolean, dir?: string): void {
  _screenshotOnFailure = enabled;
  if (dir) _screenshotDir = dir;
}

export const test = baseTest.extend<TVFixtures>({
  // eslint-disable-next-line no-empty-pattern
  tv: async ({}, use) => {
    if (!_deviceFactory) {
      throw new Error(
        'No device factory configured. Call setDeviceFactory() in your vitest setup file, ' +
        'or use the uncle-jesse vitest plugin.',
      );
    }
    const device = await _deviceFactory();
    await device.connect();

    if (_screenshotOnFailure) {
      onTestFailed(async (result) => {
        try {
          const screenshot = await device.screenshot();
          await mkdir(_screenshotDir, { recursive: true });
          const slug = result.task.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
          const path = join(_screenshotDir, `${slug}-failure.png`);
          await writeFile(path, screenshot);
          console.log(`Failure screenshot: ${path}`);
        } catch {
          // don't mask the original test error
        }
      });
    }

    await use(device);
    await device.disconnect();
  },
});

expect.extend(tvMatchers);
