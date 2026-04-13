import { describe, it, expect } from 'vitest';
import { RokuKeyMap } from '../src/roku-key-map.js';
import type { RemoteKey } from '@uncle-jesse/core';

describe('RokuKeyMap', () => {
  const expectedMappings: [RemoteKey, string][] = [
    ['home', 'Home'],
    ['back', 'Back'],
    ['select', 'Select'],
    ['up', 'Up'],
    ['down', 'Down'],
    ['left', 'Left'],
    ['right', 'Right'],
    ['play', 'Play'],
    ['rewind', 'Rev'],
    ['fastForward', 'Fwd'],
    ['info', 'Info'],
    ['enter', 'Enter'],
    ['backspace', 'Backspace'],
    ['volumeUp', 'VolumeUp'],
    ['volumeDown', 'VolumeDown'],
    ['mute', 'VolumeMute'],
    ['powerOff', 'PowerOff'],
  ];

  it.each(expectedMappings)('maps %s to %s', (key, ecpKey) => {
    expect(RokuKeyMap[key]).toBe(ecpKey);
  });

  it('has a mapping for every RemoteKey', () => {
    const allKeys: RemoteKey[] = [
      'home', 'back', 'select', 'up', 'down', 'left', 'right',
      'play', 'pause', 'rewind', 'fastForward', 'info', 'enter',
      'backspace', 'volumeUp', 'volumeDown', 'mute', 'powerOff',
      'channelUp', 'channelDown',
    ];
    for (const key of allKeys) {
      expect(RokuKeyMap[key]).toBeDefined();
    }
  });
});
