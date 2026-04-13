import { test } from '@danecodes/uncle-jesse-test';
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

  // DetailsScreen gets focused when shown (GridScreen gets visible="false",
  // but DetailsScreen's visible attr is absent when true — Roku default)
  const details = await tv.waitForElement('DetailsScreen[focused="true"]');
  expect(details).toExist();

  // Buttons should exist
  const buttons = await tv.waitForElement('LabelList#Buttons');
  expect(buttons).toExist();
});

test('back from details returns to grid', async ({ tv }) => {
  await tv.back();

  // GridScreen regains focus when returning from details
  const grid = await tv.waitForElement('GridScreen');
  expect(grid).toExist();
  // GridScreen should no longer have visible="false"
  expect(grid.getAttribute('visible')).not.toBe('false');
});
