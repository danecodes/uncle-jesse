import { test } from '@uncle-jesse/test';
import { expect } from 'vitest';

test('app launches and shows grid screen', async ({ tv }) => {
  await tv.launchApp('dev');

  // Wait for the grid to appear
  const grid = await tv.waitForElement('RowList');
  expect(grid).toExist();
});

test('grid screen has focused element', async ({ tv }) => {
  const focused = await tv.getFocusedElement();
  expect(focused).toExist();
  expect(focused).toBeFocused();
});

test('can navigate grid with D-pad', async ({ tv }) => {
  await tv.press('right');
  const focused = await tv.getFocusedElement();
  expect(focused).toBeFocused();
});

test('selecting grid item shows details screen', async ({ tv }) => {
  await tv.select();

  // DetailsScreen should become visible
  const details = await tv.waitForElement('DetailsScreen[visible="true"]');
  expect(details).toExist();

  // Buttons should have focus
  const buttons = await tv.waitForElement('LabelList#Buttons');
  expect(buttons).toExist();
});

test('back from details returns to grid', async ({ tv }) => {
  await tv.back();

  const grid = await tv.waitForElement('GridScreen[visible="true"]');
  expect(grid).toExist();
});
