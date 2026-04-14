import { describe, it, expect, vi } from 'vitest';
import { focusPath } from '../src/focus-path.js';
import type { TVDevice } from '@danecodes/uncle-jesse-core';
import { UIElement } from '@danecodes/uncle-jesse-core';

function mockDevice(focusSequence: (string | undefined)[]): TVDevice {
  let callIdx = 0;

  return {
    platform: 'roku',
    name: 'test',
    ip: '0.0.0.0',
    connect: vi.fn(),
    disconnect: vi.fn(),
    isConnected: vi.fn(() => true),
    press: vi.fn(),
    longPress: vi.fn(),
    type: vi.fn(),
    navigate: vi.fn(),
    select: vi.fn(),
    back: vi.fn(),
    home: vi.fn(),
    launchApp: vi.fn(),
    closeApp: vi.fn(),
    getActiveApp: vi.fn(),
    getInstalledApps: vi.fn(),
    getUITree: vi.fn(),
    $: vi.fn(),
    $$: vi.fn(),
    screenshot: vi.fn(),
    waitForElement: vi.fn(),
    waitForFocus: vi.fn(),
    waitForCondition: vi.fn(),
    deepLink: vi.fn(),
    getFocusedElement: vi.fn(() => {
      const id = focusSequence[callIdx++];
      if (!id) return Promise.resolve(null);
      return Promise.resolve(new UIElement('AppButton', { name: id }));
    }),
  };
}

describe('focusPath', () => {
  it('passes when all focus expectations match', async () => {
    const device = mockDevice(['heroItem1', 'heroItem2']);

    const result = await focusPath(device)
      .press('right').expectFocus('#heroItem1')
      .press('right').expectFocus('#heroItem2')
      .verify();

    expect(result.passed).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(device.press).toHaveBeenCalledTimes(2);
  });

  it('collects ALL failures without aborting on first', async () => {
    const device = mockDevice(['wrong1', 'heroItem2', 'wrong3']);

    const result = await focusPath(device)
      .press('right').expectFocus('#heroItem1')
      .press('right').expectFocus('#heroItem2')
      .press('down').expectFocus('#categoryRow1')
      .verify();

    expect(result.passed).toBe(false);
    expect(result.failures).toHaveLength(2);
    expect(result.failures[0].step).toBe(1);
    expect(result.failures[1].step).toBe(3);
  });

  it('includes descriptive error messages', async () => {
    const device = mockDevice(['wrong']);

    const result = await focusPath(device)
      .press('right').expectFocus('#heroItem1')
      .verify();

    expect(result.failures[0].message).toContain('Step 1');
    expect(result.failures[0].message).toContain('RIGHT');
    expect(result.failures[0].message).toContain('#heroItem1');
    expect(result.failures[0].message).toContain('#wrong');
  });

  it('handles null focus (nothing focused)', async () => {
    const device = mockDevice([undefined]);

    const result = await focusPath(device)
      .press('down').expectFocus('#item1')
      .verify();

    expect(result.passed).toBe(false);
    expect(result.failures[0].message).toContain('<nothing>');
    expect(result.failures[0].actualFocus).toBe('<nothing>');
  });

  it('waits for initial focus with start()', async () => {
    const device = mockDevice(['heroItem1']);

    await focusPath(device)
      .start('#heroItem0')
      .press('right').expectFocus('#heroItem1')
      .verify();

    expect(device.waitForFocus).toHaveBeenCalledWith('#heroItem0');
  });
});
