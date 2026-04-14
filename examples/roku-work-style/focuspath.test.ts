import { beforeEach, afterEach, it, expect } from 'vitest';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { focusPath } from '@danecodes/uncle-jesse-test';
import { createDevice } from './setup.js';
import { HomePage } from './pages/HomePage.js';

let device: TVDevice;
let home: HomePage;

beforeEach(async () => {
  device = await createDevice();
  home = new HomePage(device, null);
  await device.home();
  await device.launchApp('dev');
  await home.waitForLoaded();
});

afterEach(async () => {
  await device.disconnect();
});

it('focusPath navigates grid items by title', async () => {
  const result = await focusPath(device)
    .press('right').expectFocus('[title="featured-item-2"]')
    .press('right').expectFocus('[title="featured-item-3"]')
    .press('right').expectFocus('[title="featured-item-4"]')
    .verify();

  for (const f of result.failures) console.log(f.message);
  expect(result.passed).toBe(true);
});

it('focusPath navigates between rows', async () => {
  const result = await focusPath(device)
    .press('down').expectFocus('[title="recent-item-1"]')
    .press('down').expectFocus('[title="popular-item-1"]')
    .press('up').expectFocus('[title="recent-item-1"]')
    .verify();

  for (const f of result.failures) console.log(f.message);
  expect(result.passed).toBe(true);
});

it('focusPath collects all failures without stopping', async () => {
  const result = await focusPath(device)
    .press('right').expectFocus('[title="WRONG"]')
    .press('right').expectFocus('[title="featured-item-3"]')
    .press('right').expectFocus('[title="ALSO WRONG"]')
    .verify();

  expect(result.passed).toBe(false);
  expect(result.failures).toHaveLength(2);
  expect(result.failures[0].step).toBe(1);
  expect(result.failures[0].message).toContain('WRONG');
  expect(result.failures[1].step).toBe(3);
  expect(result.failures[1].message).toContain('ALSO WRONG');
});

it('focusPath records replay with screenshots', async () => {
  const result = await focusPath(device, { record: true, testName: 'grid-replay' })
    .press('right').expectFocus('[title="featured-item-2"]')
    .press('down').expectFocus('[title="recent-item-2"]')
    .verify();

  for (const f of result.failures) console.log(f.message);
  expect(result.passed).toBe(true);
  expect(result.replay).toBeDefined();
  expect(result.replay!.frames).toHaveLength(2);
  expect(result.replay!.frames[0].screenshot).toBeDefined();
  expect(result.replay!.frames[1].screenshot).toBeDefined();

  // Verify screenshots are different (different focus positions)
  expect(result.replay!.frames[0].screenshot).not.toBe(result.replay!.frames[1].screenshot);

  // Save the replay for inspection
  const { saveReplay } = await import('@danecodes/uncle-jesse-test/replay');
  await saveReplay(result.replay!, './test-results');
});
