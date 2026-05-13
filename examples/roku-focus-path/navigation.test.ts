import { test, focusPath } from '@danecodes/uncle-jesse-test';
import { expect } from 'vitest';

async function launchHome(tv: any) {
  await tv.closeApp();
  await tv.home();
  await tv.launchApp('dev');
  await tv.waitForElement('HomeScreen RowList#contentGrid');
}

test('grid row navigation', async ({ tv }) => {
  await launchHome(tv);

  const focused = await tv.getFocusedElement();
  expect(focused).toExist();
  expect(focused).toBeFocused();
  expect(focused?.getAttribute('title')).toBe('featured-item-1');
});

test('grid to details and back', async ({ tv }) => {
  await launchHome(tv);

  await tv.select();

  const details = await tv.waitForElement('DetailsScreen');
  expect(details).toExist();

  const buttons = await tv.$('LabelList#actionButtons');
  expect(buttons).toExist();

  await tv.back();
  const grid = await tv.$('HomeScreen RowList#contentGrid');
  expect(grid).toExist();
  const focused = await tv.getFocusedElement();
  expect(focused?.getAttribute('title')).toBe('featured-item-1');
});

test('focus path failure reporting', async ({ tv }) => {
  await launchHome(tv);

  const result = await focusPath(tv)
    .press('right').expectFocus('#nonExistent')
    .verify();

  expect(result.passed).toBe(false);
  expect(result.failures).toHaveLength(1);
  expect(result.failures[0].message).toContain('Step 1');
  expect(result.failures[0].message).toContain('RIGHT');
  expect(result.failures[0].message).toContain('#nonExistent');
});
