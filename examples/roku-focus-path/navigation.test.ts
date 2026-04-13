import { test, focusPath } from '@uncle-jesse/test';
import { expect } from 'vitest';

test('grid row navigation', async ({ tv }) => {
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  // Verify we can get the focused element
  const focused = await tv.getFocusedElement();
  expect(focused).toExist();
  expect(focused).toBeFocused();
});

test('grid to details and back', async ({ tv }) => {
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  // Select an item to go to details
  await tv.select();

  const details = await tv.waitForElement('DetailsScreen[focused="true"]');
  expect(details).toExist();

  // Navigate the details screen buttons
  const buttons = await tv.$('LabelList#Buttons');
  expect(buttons).toExist();

  // Back to grid
  await tv.back();
  const grid = await tv.$('GridScreen');
  expect(grid).toExist();
  expect(grid?.getAttribute('visible')).not.toBe('false');
});

test('focus path failure reporting', async ({ tv }) => {
  await tv.launchApp('dev');
  await tv.waitForElement('RowList');

  // Demonstrate focusPath error reporting.
  // Pressing right moves focus to a different grid item,
  // but we intentionally expect a wrong element to show the error format.
  const result = await focusPath(tv)
    .press('right').expectFocus('#nonExistent')
    .verify();

  expect(result.passed).toBe(false);
  expect(result.failures).toHaveLength(1);
  expect(result.failures[0].message).toContain('Step 1');
  expect(result.failures[0].message).toContain('RIGHT');
  expect(result.failures[0].message).toContain('#nonExistent');
});
