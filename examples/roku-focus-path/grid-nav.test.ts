import { test, focusPath } from '@danecodes/uncle-jesse-test';
import { expect } from 'vitest';

test('navigate through grid items by title', async ({ tv }) => {
  await tv.home();
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  // Navigate right through the first row, verifying focus by title
  const result = await focusPath(tv)
    .press('right').expectFocus('[title="Action Movies Item 2"]')
    .press('right').expectFocus('[title="Action Movies Item 3"]')
    .press('right').expectFocus('[title="Action Movies Item 4"]')
    .verify();

  console.log('Failures:', result.failures.length);
  for (const f of result.failures) {
    console.log(f.message);
  }

  expect(result.passed).toBe(true);
});

test('navigate down to second row', async ({ tv }) => {
  await tv.home();
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  const result = await focusPath(tv)
    .press('down').expectFocus('[title="Comedy Shows Item 1"]')
    .press('right').expectFocus('[title="Comedy Shows Item 2"]')
    .verify();

  console.log('Failures:', result.failures.length);
  for (const f of result.failures) {
    console.log(f.message);
  }

  expect(result.passed).toBe(true);
});

test('collects all failures across a navigation sequence', async ({ tv }) => {
  await tv.home();
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  // Intentionally wrong expectations to test failure collection
  const result = await focusPath(tv)
    .press('right').expectFocus('[title="WRONG ITEM"]')
    .press('right').expectFocus('[title="Action Movies Item 3"]')
    .press('right').expectFocus('[title="ALSO WRONG"]')
    .verify();

  // Should have 2 failures (steps 1 and 3), step 2 should pass
  expect(result.passed).toBe(false);
  expect(result.failures).toHaveLength(2);
  expect(result.failures[0].step).toBe(1);
  expect(result.failures[0].message).toContain('WRONG ITEM');
  expect(result.failures[1].step).toBe(3);
  expect(result.failures[1].message).toContain('ALSO WRONG');
});

test('navigate grid with recording enabled', async ({ tv }) => {
  await tv.home();
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  const result = await focusPath(tv, { record: true, testName: 'grid-nav-replay' })
    .press('right').expectFocus('[title="Action Movies Item 2"]')
    .press('right').expectFocus('[title="Action Movies Item 3"]')
    .press('down').expectFocus('[title="Comedy Shows Item 1"]')
    .verify();

  expect(result.replay).toBeDefined();
  expect(result.replay!.frames).toHaveLength(3);

  // Save the replay for manual inspection
  const { saveReplay } = await import('@danecodes/uncle-jesse-test/replay');
  const { htmlPath } = await saveReplay(result.replay!, './test-results');
  console.log('Replay saved:', htmlPath);
});
