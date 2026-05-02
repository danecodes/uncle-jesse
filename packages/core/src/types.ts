export type Platform = 'roku' | 'webos' | 'tizen' | 'firetv' | 'androidtv';

export type RemoteKey =
  | 'home'
  | 'back'
  | 'select'
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'play'
  | 'pause'
  | 'rewind'
  | 'fastForward'
  | 'info'
  | 'enter'
  | 'backspace'
  | 'volumeUp'
  | 'volumeDown'
  | 'mute'
  | 'powerOff'
  | 'channelUp'
  | 'channelDown';

export type Direction = 'up' | 'down' | 'left' | 'right';

/** Const companion for Direction. Use `Direction.Up` instead of `'up'`. */
export const Direction = {
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
} as const satisfies Record<string, Direction>;

/** Const companion for RemoteKey. Use `RemoteKey.Right` instead of `'right'`. */
export const RemoteKey = {
  Home: 'home',
  Back: 'back',
  Select: 'select',
  Up: 'up',
  Down: 'down',
  Left: 'left',
  Right: 'right',
  Play: 'play',
  Pause: 'pause',
  Rewind: 'rewind',
  FastForward: 'fastForward',
  Info: 'info',
  Enter: 'enter',
  Backspace: 'backspace',
  VolumeUp: 'volumeUp',
  VolumeDown: 'volumeDown',
  Mute: 'mute',
  PowerOff: 'powerOff',
  ChannelUp: 'channelUp',
  ChannelDown: 'channelDown',
} as const satisfies Record<string, RemoteKey>;

export interface WaitOptions {
  timeout?: number;
  interval?: number;
  timeoutMsg?: string;
}

export interface AppInfo {
  id: string;
  name: string;
  version?: string;
}

export interface DeviceConfig {
  name: string;
  platform: Platform;
  ip: string;
  rokuDevPassword?: string;
}

export interface UncleJesseConfig {
  devices: DeviceConfig[];
  defaults?: {
    timeout?: number;
    pressDelay?: number;
  };
  app?: {
    rokuAppId?: string;
  };
}
