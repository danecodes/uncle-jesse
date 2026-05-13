import { expect } from 'vitest';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { OdcClient } from '@danecodes/roku-odc';
import { RegistryState } from '@danecodes/uncle-jesse-core';
import { focusPath, saveReplay } from '@danecodes/uncle-jesse-test';
import { RokuTestSession } from '@danecodes/uncle-jesse-test/roku';
import { test } from '@danecodes/uncle-jesse-test/vitest';
import { App } from './pages/App.js';

const testChannelPath = resolve(import.meta.dirname, '../../test-channels/uncle-jesse-test-app');
const deviceIp = process.env.ROKU_IP ?? process.env.UNCLE_JESSE_ROKU_IP ?? '192.168.0.30';
const devPassword = process.env.ROKU_DEV_PASSWORD ?? process.env.UNCLE_JESSE_ROKU_PASSWORD ?? 'rokudev';

test('opens details from home and saves useful artifacts @smoke', async ({ app, device, session }) => {
  await app.home.waitForLoaded();
  await app.home.contentGrid.expectSeedContent();

  const homeScreenshot = await session.saveScreenshot('home-loaded');
  await expectPngArtifact(homeScreenshot);

  await device.focusByKeys('navBar', {
    keys: ['up'],
    maxPressesPerKey: 1,
  });

  await device.closeApp();
  await device.home();
  await device.launchApp('dev', { testName: 'golden-home-navigation' });
  await app.home.waitForLoaded();

  const result = await focusPath(device, {
    record: true,
    testName: 'golden-home-navigation',
  })
    .press('right')
    .expectFocus('[title="featured-item-2"]')
    .press('right')
    .expectFocus('[title="featured-item-3"]')
    .verify();

  expect(result.passed).toBe(true);
  let replayPaths: { htmlPath: string; jsonPath: string } | null = null;
  if (result.replay) {
    replayPaths = await saveReplay(result.replay, 'test-results');
  }
  await expectTextArtifact(replayPaths?.htmlPath, '<!doctype html>');
  await expectJsonArtifact(replayPaths?.jsonPath);

  await app.home.openFocusedItem();
  await app.details.actionButtons.expectDefaultActions();

  const title = await app.details.titleLabel.getText();
  expect(title).toContain('featured-item-3');

  const detailsScreenshot = await session.saveScreenshot('details-opened');
  await expectPngArtifact(detailsScreenshot);

  const logPath = await session.saveLog('details-opened');
  await expectTextArtifact(logPath);
});

test('seeds registry via launch params when ODC is unavailable during setup', async () => {
  const registry = new RegistryState()
    .set('UNCLE_JESSE_FALLBACK', 'transport', 'launchParams')
    .set('UNCLE_JESSE_FALLBACK', 'testName', 'registry-fallback');

  const session = await RokuTestSession.create({
    deviceIp,
    devPassword,
    channelId: 'dev',
    channelArtifact: { path: testChannelPath },
    registry: [registry],
    registryMode: 'launchParams',
    artifacts: {
      baseDir: 'test-results',
      captureLog: false,
      screenshotOnFail: false,
    },
    appFactory: (device) => new App(device),
  });

  try {
    await session.app.home.waitForLoaded();
    const odc = new OdcClient(deviceIp);
    const registryData = await session.device.waitForCondition(async () => {
      try {
        const data = await odc.getRegistry();
        return data['UNCLE_JESSE_FALLBACK']?.['transport'] === 'launchParams'
          ? data
          : false;
      } catch {
        return false;
      }
    }, { timeout: 10000, interval: 500 });

    expect(registryData['UNCLE_JESSE_FALLBACK']?.['testName']).toBe('registry-fallback');
  } finally {
    await session.dispose();
  }
});

async function expectPngArtifact(path: string | null | undefined) {
  expect(path).toBeTruthy();
  const bytes = await readFile(path!);
  expect(bytes.length).toBeGreaterThan(24);
  expect(bytes.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(bytes.readUInt32BE(16)).toBeGreaterThan(0);
  expect(bytes.readUInt32BE(20)).toBeGreaterThan(0);
}

async function expectTextArtifact(path: string | null | undefined, expectedText?: string) {
  expect(path).toBeTruthy();
  const fileStat = await stat(path!);
  expect(fileStat.size).toBeGreaterThan(0);
  if (expectedText) {
    const text = await readFile(path!, 'utf-8');
    expect(text.toLowerCase()).toContain(expectedText.toLowerCase());
  }
}

async function expectJsonArtifact(path: string | null | undefined) {
  expect(path).toBeTruthy();
  const text = await readFile(path!, 'utf-8');
  expect(JSON.parse(text)).toMatchObject({
    testName: 'golden-home-navigation',
  });
}
