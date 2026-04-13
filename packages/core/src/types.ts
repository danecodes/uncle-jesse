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

export interface WaitOptions {
  timeout?: number;
  interval?: number;
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
