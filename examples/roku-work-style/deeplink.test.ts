import { beforeEach, afterEach, it } from 'vitest';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { createDevice } from './setup.js';
import { DetailsPage } from './pages/DetailsPage.js';
import { HomePage } from './pages/HomePage.js';

let device: TVDevice;
let details: DetailsPage;
let home: HomePage;

beforeEach(async () => {
  device = await createDevice();
  details = new DetailsPage(device, null);
  home = new HomePage(device, null);
  await device.home();
});

afterEach(async () => {
  await device.disconnect();
});

it('deep link to movie opens details screen', async () => {
  await device.deepLink('dev', 'movie-123', 'movie');
  await details.waitForLoaded();
  await details.root.toBeDisplayed();
  await details.titleLabel.toHaveText('Deep Link Item');
  await details.descriptionLabel.toHaveText('Loaded via deep link');
});

it('back from deep linked details returns to home', async () => {
  await device.deepLink('dev', 'movie-456', 'movie');
  await details.waitForLoaded();
  await device.back();
  await home.waitForLoaded();
  await home.root.toBeDisplayed();
});
