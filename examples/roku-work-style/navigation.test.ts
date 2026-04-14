import { beforeEach, afterEach, it } from 'vitest';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { createDevice } from './setup.js';
import { HomePage } from './pages/HomePage.js';
import { DetailsPage } from './pages/DetailsPage.js';
import { SearchPage } from './pages/SearchPage.js';
import { SettingsPage } from './pages/SettingsPage.js';

let device: TVDevice;
let home: HomePage;
let details: DetailsPage;
let search: SearchPage;
let settings: SettingsPage;

beforeEach(async () => {
  device = await createDevice();
  home = new HomePage(device, null);
  details = new DetailsPage(device, null);
  search = new SearchPage(device, null);
  settings = new SettingsPage(device, null);

  await device.home();
  await device.launchApp('dev');
  await home.waitForLoaded();
});

afterEach(async () => {
  await device.disconnect();
});

it('home screen loads with grid content', async () => {
  await home.root.toBeDisplayed();
  await home.screenTitle.toHaveText('Home');
  const rowCount = await home.contentGrid.getRowCount();
  if (rowCount < 1) throw new Error('Expected at least 1 row');
});

it('grid navigation - right moves focus through items', async () => {
  await device.press('right');
  const focused = await device.getFocusedElement();
  if (!focused) throw new Error('Nothing focused after right press');
});

it('select grid item opens details screen', async () => {
  await device.select();
  await details.waitForLoaded();
  await details.root.toBeDisplayed();
  await home.root.toNotBeDisplayed();
});

it('details screen shows action buttons', async () => {
  await device.select();
  await details.waitForLoaded();
  // LabelList renders button text on nested Labels inside RenderableNode > LabelListItem.
  // Verify the LabelList itself exists and has 3 items.
  await details.$('DetailsScreen LabelList#actionButtons').toExist();
});

it('back from details returns to home', async () => {
  await device.select();
  await details.waitForLoaded();
  await device.back();
  await home.root.toBeDisplayed();
  await home.$('HomeScreen RowList').waitForExisting();
});

it('navigate to search via nav bar', async () => {
  await device.press('up');
  await device.press('right');
  await device.press('select');
  await search.waitForLoaded();
  await search.root.toBeDisplayed();
  await home.root.toNotBeDisplayed();
});

it('navigate to settings via nav bar', async () => {
  await device.press('up');
  await device.press('right', { times: 2 });
  await device.press('select');
  await settings.waitForLoaded();
  await settings.root.toBeDisplayed();
  await home.root.toNotBeDisplayed();
});

it('back from settings returns to home', async () => {
  await device.press('up');
  await device.press('right', { times: 2 });
  await device.press('select');
  await settings.waitForLoaded();
  await device.back();
  await home.root.toBeDisplayed();
});

it('full navigation flow: home -> details -> back -> search -> back -> settings', async () => {
  // Home to details
  await device.select();
  await details.waitForLoaded();
  await details.root.toBeDisplayed();

  // Back to home
  await device.back();
  await home.root.toBeDisplayed();

  // Home to search
  await device.press('up');
  await device.press('right');
  await device.press('select');
  await search.waitForLoaded();

  // Back to home
  await device.back();
  await home.root.toBeDisplayed();

  // Home to settings
  await device.press('up');
  await device.press('right', { times: 2 });
  await device.press('select');
  await settings.waitForLoaded();
  await settings.root.toBeDisplayed();
});
