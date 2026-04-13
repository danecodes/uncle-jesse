import { test, focusPath } from '@uncle-jesse/test';
import { expect } from 'vitest';

// focusPath() is Uncle Jesse's killer feature — a chainable builder
// for testing D-pad spatial navigation. It collects ALL failures
// instead of aborting on the first one, giving you the full picture
// of what broke in your navigation flow.

test('grid row navigation', async ({ tv }) => {
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  // Navigate through the first row of the grid.
  // focusPath records each step and reports all failures at once.
  const result = await focusPath(tv)
    .press('right').expectFocus('#RowList')
    .press('right').expectFocus('#RowList')
    .press('down').expectFocus('#RowList')
    .verify();

  expect(result.passed).toBe(true);
});

test('grid to details and back', async ({ tv }) => {
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  // Select an item to go to details
  await tv.select();
  await tv.waitForElement('DetailsScreen[visible="true"]');

  // Navigate the details screen buttons
  const result = await focusPath(tv)
    .press('down').expectFocus('#Buttons')
    .press('down').expectFocus('#Buttons')
    .verify();

  // Back to grid
  await tv.back();
  await tv.waitForElement('GridScreen[visible="true"]');

  expect(result.passed).toBe(true);
});

test('focus path failure reporting', async ({ tv }) => {
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  // This test demonstrates focusPath's error reporting.
  // When expectations fail, you get messages like:
  //   Step 1: After pressing RIGHT, expected focus on #nonExistent
  //           but found focus on #RowList
  const result = await focusPath(tv)
    .press('right').expectFocus('#nonExistent')
    .verify();

  // We expect this to fail — that's the point of the demo
  expect(result.passed).toBe(false);
  expect(result.failures).toHaveLength(1);
  expect(result.failures[0].message).toContain('Step 1');
  expect(result.failures[0].message).toContain('RIGHT');
  expect(result.failures[0].message).toContain('#nonExistent');
});
