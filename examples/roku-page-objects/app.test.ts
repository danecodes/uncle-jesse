import { test } from '@danecodes/uncle-jesse-test';
import { expect } from 'vitest';
import { GridScreen } from './pages/grid-screen.js';
import { DetailsScreen } from './pages/details-screen.js';

test('browse grid and view item details', async ({ tv }) => {
  await tv.launchApp('dev');

  const grid = new GridScreen(tv);
  await grid.waitForLoad();

  const rowList = await grid.getRowList();
  expect(rowList).toExist();

  // Navigate and select
  await grid.navigateRight();
  await grid.selectCurrentItem();

  // Verify details screen loaded
  const details = new DetailsScreen(tv);
  await details.waitForLoad();
  expect(await details.isVisible()).toBe(true);

  const buttons = await details.getButtons();
  expect(buttons).toExist();
});

test('navigate details buttons and go back', async ({ tv }) => {
  await tv.launchApp('dev');

  const grid = new GridScreen(tv);
  await grid.waitForLoad();
  await grid.selectCurrentItem();

  const details = new DetailsScreen(tv);
  await details.waitForLoad();

  // Navigate through buttons
  await details.navigateButtons('down');
  await details.navigateButtons('down');

  // Go back to grid — wait for GridScreen to regain focus
  await details.goBack();
  await tv.waitForElement('RowList');

  expect(await grid.isVisible()).toBe(true);
});
