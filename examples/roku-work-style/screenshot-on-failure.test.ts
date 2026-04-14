import { beforeEach, afterEach, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { test, setDeviceFactory, setScreenshotOnFailure } from '@danecodes/uncle-jesse-test';
import { RokuAdapter } from '@danecodes/uncle-jesse-roku';

const ip = process.env.UNCLE_JESSE_ROKU_IP ?? '192.168.0.30';
const screenshotDir = './test-results';

setDeviceFactory(async () => {
  return new RokuAdapter({
    name: 'test-roku',
    ip,
    devPassword: 'rokudev',
    timeout: 10000,
    pressDelay: 150,
  });
});

setScreenshotOnFailure(true, screenshotDir);

// This test intentionally fails to verify screenshot capture
test.fails('intentional failure captures screenshot', async ({ tv }) => {
  await tv.home();
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  // This will fail, triggering screenshot capture
  throw new Error('Intentional failure to test screenshot capture');
});

// Verify the screenshot was saved by the previous test
it('screenshot file exists from previous failure', async () => {
  const expectedPath = join(screenshotDir, 'intentional-failure-captures-screenshot-failure.png');
  expect(existsSync(expectedPath)).toBe(true);
});
