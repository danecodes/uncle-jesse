import type { RemoteKey } from '@danecodes/uncle-jesse-core';
import type { KeyName } from '@danecodes/roku-ecp';

export const RokuKeyMap: Record<RemoteKey, KeyName> = {
  home: 'Home',
  back: 'Back',
  select: 'Select',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  play: 'Play',
  pause: 'Play', // Roku has a single Play/Pause toggle key
  rewind: 'Rev',
  fastForward: 'Fwd',
  info: 'Info',
  enter: 'Enter',
  backspace: 'Backspace',
  volumeUp: 'VolumeUp',
  volumeDown: 'VolumeDown',
  mute: 'VolumeMute',
  powerOff: 'PowerOff',
  channelUp: 'InputTuner', // Roku has no channel keys; maps to tuner input
  channelDown: 'InputTuner',
};
