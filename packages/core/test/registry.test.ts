import { describe, it, expect } from 'vitest';
import { RegistryState } from '../src/registry.js';

describe('RegistryState', () => {
  it('builds registry data with set()', () => {
    const state = new RegistryState()
      .set('CR_ROKU', 'isFirstLaunch', 'false')
      .set('CR_ROKU', 'language', 'en');

    expect(state.toJSON()).toEqual({
      CR_ROKU: { isFirstLaunch: 'false', language: 'en' },
    });
  });

  it('merges registry data', () => {
    const state = new RegistryState()
      .set('CR_ROKU', 'isFirstLaunch', 'false')
      .merge({ SETTINGS: { subtitles: 'on' } });

    expect(state.toJSON()).toEqual({
      CR_ROKU: { isFirstLaunch: 'false' },
      SETTINGS: { subtitles: 'on' },
    });
  });

  it('generates launch params with clear registry', () => {
    const state = new RegistryState().set('CR_ROKU', 'isFirstLaunch', 'false');
    const params = state.toLaunchParams();

    expect(params.odc_clear_registry).toBe('true');
    expect(params.odc_registry).toBe(JSON.stringify({
      CR_ROKU: { isFirstLaunch: 'false' },
    }));
  });

  it('generates launch params without clear registry', () => {
    const state = new RegistryState().set('CR_ROKU', 'isFirstLaunch', 'false');
    const params = state.toLaunchParams({ clearRegistry: false });

    expect(params.odc_clear_registry).toBeUndefined();
  });

  it('skipOnboarding sets isFirstLaunch to false', () => {
    const state = RegistryState.skipOnboarding();
    expect(state.toJSON()).toEqual({
      CR_ROKU: { isFirstLaunch: 'false' },
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
});
