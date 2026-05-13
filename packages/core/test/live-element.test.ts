import { describe, it, expect, vi } from 'vitest';
import { LiveElement } from '../src/live-element.js';
import { UIElement } from '../src/ui-element.js';
import type { TVDevice } from '../src/tv-device.js';

function makeDevice(resolve: () => UIElement | null): TVDevice {
  const notImpl = (name: string) => () => { throw new Error(`mock: ${name} not implemented`); };

  return {
    platform: 'roku',
    name: 'mock',
    ip: '0.0.0.0',
    connect: notImpl('connect'),
    disconnect: notImpl('disconnect'),
    isConnected: () => true,
    press: notImpl('press') as TVDevice['press'],
    longPress: notImpl('longPress'),
    type: notImpl('type'),
    sendInput: notImpl('sendInput'),
    touch: notImpl('touch'),
    navigate: notImpl('navigate'),
    select: notImpl('select'),
    back: notImpl('back'),
    home: notImpl('home'),
    launchApp: notImpl('launchApp'),
    closeApp: notImpl('closeApp'),
    getActiveApp: notImpl('getActiveApp'),
    getInstalledApps: notImpl('getInstalledApps'),
    getUITree: notImpl('getUITree'),
    $: vi.fn(async () => resolve()),
    $$: notImpl('$$'),
    getFocusedElement: notImpl('getFocusedElement'),
    focusByKeys: notImpl('focusByKeys'),
    waitForElement: notImpl('waitForElement'),
    waitForFocus: notImpl('waitForFocus'),
    waitForCondition: notImpl('waitForCondition'),
    waitUntil: notImpl('waitUntil'),
    waitForStable: notImpl('waitForStable'),
    pause: notImpl('pause'),
    on: () => {},
    off: () => {},
    deepLink: notImpl('deepLink'),
    screenshot: notImpl('screenshot'),
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
  } as TVDevice;
}

describe('LiveElement identity', () => {
  it('is not stale before it has cached an identity', async () => {
    const device = makeDevice(() => new UIElement('Button', { name: 'play' }));
    const el = new LiveElement(device, '#play');

    await expect(el.isStale()).resolves.toBe(false);
  });

  it('detects changed identity without refreshing the cached identity', async () => {
    let current = new UIElement('Button', { name: 'play', rcid: '1' });
    const device = makeDevice(() => current);
    const el = new LiveElement(device, '#play');

    await el.resolve();
    current = new UIElement('Button', { name: 'play', rcid: '2' });

    await expect(el.isStale()).resolves.toBe(true);
    await expect(el.isStale()).resolves.toBe(true);
  });

  it('treats a missing element as stale', async () => {
    let current: UIElement | null = new UIElement('Button', { name: 'play' });
    const device = makeDevice(() => current);
    const el = new LiveElement(device, '#play');

    await el.resolve();
    current = null;

    await expect(el.isStale()).resolves.toBe(true);
  });
});
