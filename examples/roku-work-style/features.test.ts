import { beforeEach, afterEach, it, expect } from 'vitest';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { LiveElement, ElementCollection, BaseComponent } from '@danecodes/uncle-jesse-core';
import { createDevice } from './setup.js';
import { HomePage } from './pages/HomePage.js';
import { DetailsPage } from './pages/DetailsPage.js';

let device: TVDevice;
let home: HomePage;
let details: DetailsPage;

beforeEach(async () => {
  device = await createDevice();
  home = new HomePage(device, null);
  details = new DetailsPage(device, null);
  await device.home();
  await device.launchApp('dev');
  await home.waitForLoaded();
});

afterEach(async () => {
  await device.disconnect();
});

it('toBeFocused passes on the actual focused element', async () => {
  // The RowList in home screen should have focus
  const rowList = new LiveElement(device, 'RowList#contentGrid');
  await rowList.toBeFocused({ timeout: 5000 });
});

it('ElementCollection .length returns correct count', async () => {
  const rows = new ElementCollection(device, 'RowListItem');
  const count = await rows.length;
  expect(count).toBe(3); // Featured, Recently Added, Popular
});

it('TypedElementCollection returns component instances', async () => {
  class RowItem extends BaseComponent {
    async getLabel() {
      return this.$('Label');
    }
  }

  const rows = home.$$('RowListItem', RowItem);
  const count = await rows.length;
  expect(count).toBe(3);

  const firstRow = rows.get(0);
  expect(firstRow).toBeInstanceOf(RowItem);
  const label = await firstRow.getLabel();
  await label.toExist();
});

it('waitForCondition resolves when predicate returns truthy', async () => {
  // Wait for the grid to have 3 rows
  const result = await device.waitForCondition(async () => {
    const rows = await device.$$('RowListItem');
    return rows.length === 3 ? rows.length : false;
  }, { timeout: 5000 });

  expect(result).toBe(3);
});

it('console log capture reads device output', async () => {
  // readConsole is Roku-specific, cast to access it
  const rokuDevice = device as any;
  if (typeof rokuDevice.readConsole !== 'function') {
    throw new Error('readConsole not available on device');
  }

  const output = await rokuDevice.readConsole({ duration: 1000 });
  // Should return a string (may be empty if no recent output)
  expect(typeof output).toBe('string');
});

it('video playback screen loads', async () => {
  // Navigate to details
  await device.select();
  await details.waitForLoaded();

  // Select Play button (first in the action buttons list)
  await device.select();

  // Video screen should appear
  const videoScreen = new LiveElement(device, 'VideoScreen');
  await videoScreen.toBeDisplayed({ timeout: 10000 });

  const videoPlayer = new LiveElement(device, 'Video#videoPlayer');
  await videoPlayer.toExist();
});
