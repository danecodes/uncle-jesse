import { describe, it, expect } from 'vitest';
import { focusByKeys } from '../src/focus-by-keys.js';
import { UIElement, setDefaultQueryEngine } from '../src/ui-element.js';
import type { TVDevice } from '../src/tv-device.js';
import type { RemoteKey } from '../src/types.js';

setDefaultQueryEngine({ query: () => null, queryAll: () => [] });

interface MockSpec {
  initial: string | null;
  /**
   * For each key, the sequence of focused ids after each press. If the key
   * is pressed more times than the array length, the last value sticks
   * (focus didn't move further — stuck at the end of a row).
   */
  steps: Partial<Record<RemoteKey, (string | null)[]>>;
}

type MockDevice = TVDevice & { presses: RemoteKey[] };

function makeMockDevice(spec: MockSpec): MockDevice {
  let currentId: string | null = spec.initial;
  const counters: Partial<Record<RemoteKey, number>> = {};
  const presses: RemoteKey[] = [];

  const elFor = (id: string | null): UIElement | null => {
    if (id === null) return null;
    // Bounds vary per id so fingerprint changes when focus moves.
    return new UIElement('Node', { name: id, bounds: `{0, 0, ${id.length || 1}, 1}` });
  };

  const notImpl = (name: string) => () => { throw new Error(`mock: ${name} not implemented`); };
  // Cast lets us satisfy the wide TVDevice surface while only filling what's used.
  const device = {
    platform: 'roku', name: 'mock', ip: '0.0.0.0',
    connect: notImpl('connect'), disconnect: notImpl('disconnect'),
    isConnected: () => true,
    longPress: notImpl('longPress'), type: notImpl('type'),
    sendInput: notImpl('sendInput'), touch: notImpl('touch'),
    navigate: notImpl('navigate'), select: notImpl('select'),
    back: notImpl('back'), home: notImpl('home'),
    launchApp: notImpl('launchApp'), closeApp: notImpl('closeApp'),
    getActiveApp: notImpl('getActiveApp'), getInstalledApps: notImpl('getInstalledApps'),
    getUITree: notImpl('getUITree'),
    $: notImpl('$'), $$: notImpl('$$'),
    waitForElement: notImpl('waitForElement'), waitForFocus: notImpl('waitForFocus'),
    waitForCondition: notImpl('waitForCondition'), waitUntil: notImpl('waitUntil'),
    waitForStable: notImpl('waitForStable'), pause: notImpl('pause'),
    on: () => {}, off: () => {},
    deepLink: notImpl('deepLink'), screenshot: notImpl('screenshot'),
    logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
    presses,
    async press(key: RemoteKey | RemoteKey[]) {
      const k = Array.isArray(key) ? key[0] : key;
      presses.push(k);
      const seq = spec.steps[k];
      if (seq && seq.length > 0) {
        const idx = counters[k] ?? 0;
        currentId = idx < seq.length ? seq[idx] : seq[seq.length - 1];
        counters[k] = idx + 1;
      }
    },
    async getFocusedElement(): Promise<UIElement | null> { return elFor(currentId); },
    async focusByKeys() { /* unused in helper */ },
  };
  return device as unknown as MockDevice;
}

describe('focusByKeys', () => {
  it('returns immediately when already focused on target', async () => {
    const mock = makeMockDevice({ initial: 'target', steps: {} });
    await focusByKeys(mock, 'target', { keys: ['down'] });
    expect(mock.presses).toEqual([]);
  });

  it('drives a single key until target is focused', async () => {
    const mock = makeMockDevice({
      initial: 'a',
      steps: { down: ['b', 'c', 'target'] },
    });
    await focusByKeys(mock, 'target', { keys: ['down'] });
    expect(mock.presses).toEqual(['down', 'down', 'down']);
  });

  it('accepts an array of acceptable target ids', async () => {
    const mock = makeMockDevice({
      initial: 'a',
      steps: { right: ['b', 'c'] },
    });
    await focusByKeys(mock, ['c', 'd'], { keys: ['right'] });
    expect(mock.presses).toEqual(['right', 'right']);
  });

  it('switches keys when intermediate is reached', async () => {
    const mock = makeMockDevice({
      initial: 'a',
      steps: {
        up: ['playBtn'],
        right: ['watchlistBtn'],
      },
    });
    await focusByKeys(mock, 'watchlistBtn', {
      keys: ['up', 'right'],
      intermediateIds: ['playBtn', 'watchlistBtn'],
    });
    expect(mock.presses).toEqual(['up', 'right']);
  });

  it('moves to next key when intermediate budget is exhausted', async () => {
    const mock = makeMockDevice({
      initial: 'a',
      steps: {
        up: ['x', 'y', 'z'],
        right: ['target'],
      },
    });
    await focusByKeys(mock, 'target', {
      keys: ['up', 'right'],
      intermediateIds: ['playBtn'],
      maxPressesPerKey: 3,
    });
    expect(mock.presses).toEqual(['up', 'up', 'up', 'right']);
  });

  it('stops early if final key lands on target before budget', async () => {
    const mock = makeMockDevice({
      initial: 'a',
      steps: {
        down: ['actionBtn', 'cancelBtn'],
        right: ['actionBtn'],
      },
    });
    await focusByKeys(mock, 'actionBtn', {
      keys: ['down', 'right'],
      intermediateIds: ['actionBtn', 'cancelBtn'],
      maxPressesPerKey: 5,
    });
    // Down lands on actionBtn (intermediate). Since actionBtn is also a target,
    // we exit early without pressing right.
    expect(mock.presses).toEqual(['down']);
  });

  it('throws with trail when target is never reached', async () => {
    const mock = makeMockDevice({
      initial: 'a',
      steps: { down: ['b', 'c', 'd'] },
    });
    await expect(
      focusByKeys(mock, 'target', { keys: ['down'], maxPressesPerKey: 3 }),
    ).rejects.toThrow(/never reached 'target'.*Budgets exhausted on: down.*down→b, down→c, down→d/s);
  });

  it('rejects when options.keys is empty', async () => {
    const mock = makeMockDevice({ initial: 'a', steps: {} });
    await expect(
      focusByKeys(mock, 'target', { keys: [] }),
    ).rejects.toThrow('at least one key');
  });
});
