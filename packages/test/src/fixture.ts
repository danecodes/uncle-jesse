import { test as baseTest, expect, onTestFailed, onTestFinished, type TestContext } from 'vitest';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { tvMatchers } from './matchers.js';
import { getPluginConfig } from './vitest-plugin.js';

// Track the current test name for artifact naming
let _currentTestName = 'unknown';

export interface TVFixtures {
  tv: TVDevice;
}

let _deviceFactory: (() => Promise<TVDevice>) | null = null;
let _screenshotOnFailure = true;
let _screenshotDir = './test-results';
let _logCapture = false;
let _logDir = './test-logs';
let _onTestStart: ((device: TVDevice, ctx: unknown) => Promise<void>) | null = null;
let _onTestFinished: ((device: TVDevice, result: unknown, ctx: unknown) => Promise<void>) | null = null;

export function setDeviceFactory(factory: () => Promise<TVDevice>): void {
  _deviceFactory = factory;
}

export function setScreenshotOnFailure(enabled: boolean, dir?: string): void {
  _screenshotOnFailure = enabled;
  if (dir) _screenshotDir = dir;
}

export function setLogCapture(enabled: boolean, dir?: string): void {
  _logCapture = enabled;
  if (dir) _logDir = dir;
}

export function setTestHooks(hooks: {
  onTestStart?: (device: TVDevice, ctx: unknown) => Promise<void>;
  onTestFinished?: (device: TVDevice, result: unknown, ctx: unknown) => Promise<void>;
}): void {
  _onTestStart = hooks.onTestStart ?? null;
  _onTestFinished = hooks.onTestFinished ?? null;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const test = baseTest.extend<TVFixtures>({
  // eslint-disable-next-line no-empty-pattern
  tv: async ({}, use) => {
    const pluginConfig = getPluginConfig();
    const screenshotEnabled = pluginConfig.screenshotOnFailure ?? _screenshotOnFailure;
    const screenshotPath = pluginConfig.artifactDir ?? _screenshotDir;
    const logEnabled = pluginConfig.logCapture ?? _logCapture;
    const logPath = pluginConfig.logDir ?? _logDir;

    if (!_deviceFactory) {
      throw new Error(
        'No device factory configured. Call setDeviceFactory() in your vitest setup file.',
      );
    }

    const device = await _deviceFactory();
    await device.connect();

    const rokuDevice = device as any;
    if (logEnabled && typeof rokuDevice.startLogCapture === 'function') {
      await rokuDevice.startLogCapture();
    }

    const startHook = (pluginConfig.onTestStart as typeof _onTestStart) ?? _onTestStart;
    if (startHook) {
      await startHook(device, null);
    }

    const testSlug = slugify(_currentTestName);

    if (screenshotEnabled) {
      onTestFailed(async () => {
        try {
          const screenshot = await device.screenshot();
          await mkdir(screenshotPath, { recursive: true });
          const path = join(screenshotPath, `${testSlug}-failure.png`);
          await writeFile(path, screenshot);
          console.log(`Failure screenshot: ${path}`);
        } catch {
          // don't mask the original test error
        }
      });
    }

    onTestFinished(async (result) => {
      if (logEnabled && typeof rokuDevice.logs !== 'undefined') {
        try {
          await mkdir(logPath, { recursive: true });
          const logFile = join(logPath, `${testSlug}.txt`);
          await writeFile(logFile, rokuDevice.logs.toText(), 'utf-8');
        } catch {
          // best effort
        }
      }

      const finishHook = (pluginConfig.onTestFinished as typeof _onTestFinished) ?? _onTestFinished;
      if (finishHook) {
        await finishHook(device, result, null);
      }

      if (logEnabled && typeof rokuDevice.stopLogCapture === 'function') {
        rokuDevice.stopLogCapture();
      }
    });

    await use(device);
    await device.disconnect();
  },
});

// Capture test name for artifact naming
baseTest.beforeEach((context) => {
  _currentTestName = context.task.name;
});

expect.extend(tvMatchers);
