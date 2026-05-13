import { test } from '@danecodes/uncle-jesse-test';
import { expect } from 'vitest';
import { HomeScreen } from './pages/home-screen.js';
import { DetailsScreen } from './pages/details-screen.js';

test('browse grid and view item details', async ({ tv }) => {
  await tv.closeApp();
  await tv.home();
  await tv.launchApp('dev');

  const home = new HomeScreen(tv);
  await home.waitForLoad();

  const rowList = await home.getRowList();
  expect(rowList).toExist();

  await home.navigateRight();
  await home.selectCurrentItem();

  // Verify details screen loaded
  const details = new DetailsScreen(tv);
  await details.waitForLoad();
  expect(await details.isVisible()).toBe(true);

  const buttons = await details.getButtons();
  expect(buttons).toExist();
});

test('navigate details buttons and go back', async ({ tv }) => {
  await tv.closeApp();
  await tv.home();
  await tv.launchApp('dev');

  const home = new HomeScreen(tv);
  await home.waitForLoad();
  await home.selectCurrentItem();

  const details = new DetailsScreen(tv);
  await details.waitForLoad();

  // Navigate through buttons
  await details.navigateButtons('down');
  await details.navigateButtons('down');

  await details.goBack();
  await tv.waitForElement('HomeScreen RowList#contentGrid');

  expect(await home.isVisible()).toBe(true);
});
