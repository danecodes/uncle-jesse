import { describe, it, expect, vi } from 'vitest';
import { RegistryState } from '../src/registry.js';
import type { OdcClient } from '../src/registry.js';

function mockOdc(): OdcClient & { _data: Record<string, Record<string, string>> } {
  const store: Record<string, Record<string, string>> = {};
  return {
    _data: store,
    setRegistry: vi.fn(async (data) => {
      for (const [section, values] of Object.entries(data)) {
        if (!store[section]) store[section] = {};
        Object.assign(store[section], values);
      }
    }),
    clearRegistry: vi.fn(async (sections?) => {
      if (sections) {
        for (const s of sections) delete store[s];
      } else {
        for (const key of Object.keys(store)) delete store[key];
      }
    }),
    getRegistry: vi.fn(async () => {
      return JSON.parse(JSON.stringify(store));
    }),
  };
}

describe('RegistryState', () => {
  it('builds registry data with set()', () => {
    const state = new RegistryState()
      .set('APP_CONFIG', 'isFirstLaunch', 'false')
      .set('APP_CONFIG', 'language', 'en');

    expect(state.toJSON()).toEqual({
      APP_CONFIG: { isFirstLaunch: 'false', language: 'en' },
    });
  });

  it('merges registry data', () => {
    const state = new RegistryState()
      .set('APP_CONFIG', 'isFirstLaunch', 'false')
      .merge({ SETTINGS: { subtitles: 'on' } });

    expect(state.toJSON()).toEqual({
      APP_CONFIG: { isFirstLaunch: 'false' },
      SETTINGS: { subtitles: 'on' },
    });
  });

  it('generates launch params with clear registry', () => {
    const state = new RegistryState().set('APP_CONFIG', 'isFirstLaunch', 'false');
    const params = state.toLaunchParams();

    expect(params.odc_clear_registry).toBe('true');
    expect(params.odc_registry).toBe(JSON.stringify({
      APP_CONFIG: { isFirstLaunch: 'false' },
    }));
  });

  it('generates launch params without clear registry', () => {
    const state = new RegistryState().set('APP_CONFIG', 'isFirstLaunch', 'false');
    const params = state.toLaunchParams({ clearRegistry: false });

    expect(params.odc_clear_registry).toBeUndefined();
  });

  it('skipOnboarding sets isFirstLaunch to false', () => {
    const state = RegistryState.skipOnboarding();
    expect(state.toJSON()).toEqual({
      APP_CONFIG: { isFirstLaunch: 'false' },
    });
  });

  it('creates from existing data', () => {
    const state = RegistryState.from({
      SECTION_A: { key1: 'val1' },
      SECTION_B: { key2: 'val2' },
    });
    expect(state.toJSON()).toEqual({
      SECTION_A: { key1: 'val1' },
      SECTION_B: { key2: 'val2' },
    });
  });

  describe('applyViaOdc', () => {
    it('clears registry and sets new values', async () => {
      const odc = mockOdc();
      odc._data['OLD_SECTION'] = { old: 'data' };

      const state = new RegistryState()
        .set('APP_CONFIG', 'isFirstLaunch', 'false')
        .set('SETTINGS', 'language', 'en');

      await state.applyViaOdc(odc);

      expect(odc.clearRegistry).toHaveBeenCalledOnce();
      expect(odc.setRegistry).toHaveBeenCalledWith({
        APP_CONFIG: { isFirstLaunch: 'false' },
        SETTINGS: { language: 'en' },
      });
      expect(odc._data['OLD_SECTION']).toBeUndefined();
      expect(odc._data['APP_CONFIG']).toEqual({ isFirstLaunch: 'false' });
    });

    it('skips clear when clearFirst is false', async () => {
      const odc = mockOdc();
      odc._data['EXISTING'] = { keep: 'this' };

      const state = new RegistryState().set('NEW', 'key', 'val');
      await state.applyViaOdc(odc, { clearFirst: false });

      expect(odc.clearRegistry).not.toHaveBeenCalled();
      expect(odc._data['EXISTING']).toEqual({ keep: 'this' });
      expect(odc._data['NEW']).toEqual({ key: 'val' });
    });

    it('does not call setRegistry when state is empty', async () => {
      const odc = mockOdc();
      const state = new RegistryState();
      await state.applyViaOdc(odc);

      expect(odc.clearRegistry).toHaveBeenCalledOnce();
      expect(odc.setRegistry).not.toHaveBeenCalled();
    });
  });

  describe('readFromDevice', () => {
    it('reads registry and returns a RegistryState', async () => {
      const odc = mockOdc();
      odc._data['APP_CONFIG'] = { isFirstLaunch: 'false', user: 'dane' };
      odc._data['SETTINGS'] = { language: 'en' };

      const state = await RegistryState.readFromDevice(odc);

      expect(state.toJSON()).toEqual({
        APP_CONFIG: { isFirstLaunch: 'false', user: 'dane' },
        SETTINGS: { language: 'en' },
      });
    });

    it('returns empty state when registry is empty', async () => {
      const odc = mockOdc();
      const state = await RegistryState.readFromDevice(odc);
      expect(state.toJSON()).toEqual({});
    });
  });

  describe('round trip', () => {
    it('applyViaOdc then readFromDevice returns the same data', async () => {
      const odc = mockOdc();

      const original = new RegistryState()
        .set('APP_CONFIG', 'isFirstLaunch', 'false')
        .set('APP_CONFIG', 'language', 'en')
        .set('SETTINGS', 'subtitles', 'on')
        .set('SETTINGS', 'quality', 'auto');

      await original.applyViaOdc(odc);
      const readBack = await RegistryState.readFromDevice(odc);

      expect(readBack.toJSON()).toEqual(original.toJSON());
    });

    it('toLaunchParams and applyViaOdc produce equivalent registry data', async () => {
      const odc = mockOdc();

      const state = RegistryState.skipOnboarding()
        .set('SETTINGS', 'language', 'ja');

      // What launch params would send
      const params = state.toLaunchParams();
      const launchData = JSON.parse(params.odc_registry);

      // What ODC would write
      await state.applyViaOdc(odc);
      const odcData = await odc.getRegistry();

      expect(odcData).toEqual(launchData);
    });
  });
});
