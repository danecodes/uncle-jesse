import { beforeEach, afterEach, it, expect } from 'vitest';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { createDevice } from './setup.js';
import { HomePage } from './pages/HomePage.js';
import { SearchPage } from './pages/SearchPage.js';

let device: TVDevice;
let home: HomePage;
let search: SearchPage;

beforeEach(async () => {
  device = await createDevice();
  home = new HomePage(device, null);
  search = new SearchPage(device, null);

  await device.home();
  await device.launchApp('dev');
  await home.waitForLoaded();

  // Navigate to search
  await device.press('up');
  await device.press('right');
  await device.press('select');
  await search.waitForLoaded();
});

afterEach(async () => {
  await device.disconnect();
});

it('search screen loads with keyboard', async () => {
  await search.root.toBeDisplayed();
  await search.keyboard.toExist();
  await search.resultsLabel.toHaveText('Type to search');
});

it('typing shows search results', async () => {
  await device.type('popular');
  await search.resultsList.toBeDisplayed({ timeout: 5000 });
  await search.resultsLabel.toHaveText('5 results');
});

it('typing with no matches shows no results', async () => {
  await device.type('zzzzz');
  await search.resultsLabel.toHaveText('No results', { timeout: 5000 });
  await search.resultsList.toNotBeDisplayed();
});

it('back from search returns to home', async () => {
  await device.back();
  await home.root.toBeDisplayed();
});
