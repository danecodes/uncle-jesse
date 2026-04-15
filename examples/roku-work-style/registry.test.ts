import { beforeEach, afterEach, it, expect } from 'vitest';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { RegistryState } from '@danecodes/uncle-jesse-core';
import { createDevice } from './setup.js';
import { OdcClient } from '@danecodes/roku-odc';

const ip = process.env.UNCLE_JESSE_ROKU_IP ?? '192.168.0.30';
let device: TVDevice;
let odc: OdcClient;

beforeEach(async () => {
  device = await createDevice();
  odc = new OdcClient(ip);
  // ODC server only runs while the dev app is running.
  await device.home();
  await device.launchApp('dev');
  // Wait for ODC server to be ready (starts ~1s after app launch)
  await device.waitForCondition(async () => {
    try {
      await odc.getRegistry();
      return true;
    } catch {
      return false;
    }
  }, { timeout: 10000, interval: 500 });
});

afterEach(async () => {
  await device.disconnect();
});

it('write registry via ODC and read it back', async () => {
  const state = new RegistryState()
    .set('TEST_SECTION', 'testKey', 'testValue')
    .set('TEST_SECTION', 'anotherKey', 'anotherValue');

  await state.applyViaOdc(odc);

  const readBack = await RegistryState.readFromDevice(odc);
  const data = readBack.toJSON();

  expect(data['TEST_SECTION']).toBeDefined();
  expect(data['TEST_SECTION']['testKey']).toBe('testValue');
  expect(data['TEST_SECTION']['anotherKey']).toBe('anotherValue');
});

it('clear registry via ODC', async () => {
  // Write something first
  const state = new RegistryState().set('CLEAR_TEST', 'key', 'value');
  await state.applyViaOdc(odc, { clearFirst: false });

  // Verify it's there
  let data = await RegistryState.readFromDevice(odc);
  expect(data.toJSON()['CLEAR_TEST']).toBeDefined();

  // Clear and verify it's gone
  await odc.clearRegistry();
  data = await RegistryState.readFromDevice(odc);
  expect(data.toJSON()['CLEAR_TEST']).toBeUndefined();
});

it('launch params and ODC write produce equivalent registry state', async () => {
  const state = new RegistryState()
    .set('CR_ROKU', 'isFirstLaunch', 'false')
    .set('SETTINGS', 'language', 'en');

  // Write via ODC
  await state.applyViaOdc(odc);
  const odcResult = await RegistryState.readFromDevice(odc);

  // What launch params would have sent
  const params = state.toLaunchParams();
  const launchData = JSON.parse(params.odc_registry);

  // The registry sections we wrote should match
  for (const [section, values] of Object.entries(launchData)) {
    const odcSection = odcResult.toJSON()[section];
    expect(odcSection).toBeDefined();
    for (const [key, value] of Object.entries(values as Record<string, string>)) {
      expect(odcSection[key]).toBe(value);
    }
  }
});

it('skipOnboarding writes the correct registry value', async () => {
  const state = RegistryState.skipOnboarding();
  await state.applyViaOdc(odc);

  const readBack = await RegistryState.readFromDevice(odc);
  expect(readBack.toJSON()['CR_ROKU']?.['isFirstLaunch']).toBe('false');
});
