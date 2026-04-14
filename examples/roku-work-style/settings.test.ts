import { beforeEach, afterEach, it } from 'vitest';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { createDevice } from './setup.js';
import { HomePage } from './pages/HomePage.js';
import { SettingsPage } from './pages/SettingsPage.js';

let device: TVDevice;
let home: HomePage;
let settings: SettingsPage;

beforeEach(async () => {
  device = await createDevice();
  home = new HomePage(device, null);
  settings = new SettingsPage(device, null);

  await device.home();
  await device.launchApp('dev');
  await home.waitForLoaded();

  // Navigate to settings
  await device.press('up');
  await device.press('right', { times: 2 });
  await device.press('select');
  await settings.waitForLoaded();
});

afterEach(async () => {
  await device.disconnect();
});

it('settings screen loads with options', async () => {
  await settings.root.toBeDisplayed();
  await settings.settingsList.toExist();
});

it('toggle closed captions updates status', async () => {
  await device.select();
  await settings.statusLabel.toHaveText('Closed Captions: On', { timeout: 5000 });
});

it('navigate through settings items', async () => {
  await device.press('down');
  await device.press('down');
  await device.press('down');
  await device.press('down');
  // Select "About"
  await device.select();
  await settings.statusLabel.toHaveText('Uncle Jesse Test App v1.0', { timeout: 5000 });
});

it('back from settings returns to home', async () => {
  await device.back();
  await home.root.toBeDisplayed();
});
