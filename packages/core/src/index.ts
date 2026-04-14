export type { TVDevice } from './tv-device.js';
export type {
  Platform,
  RemoteKey,
  Direction,
  WaitOptions,
  AppInfo,
  DeviceConfig,
  UncleJesseConfig,
} from './types.js';
export { UIElement, setDefaultQueryEngine } from './ui-element.js';
export type { ElementQueryEngine } from './ui-element.js';
export { SelectorEngine } from './selector-engine.js';
export { DeviceManager } from './device-manager.js';
export { LiveElement, ElementCollection, TypedElementCollection, BaseComponent, BasePage } from './live-element.js';
export { defineConfig, loadConfig, loadConfigFromFile } from './config.js';
export {
  TimeoutError,
  DeviceConnectionError,
  ECPError,
} from './errors.js';

// Initialize the default query engine so UIElement.$() works out of the box
import { SelectorEngine } from './selector-engine.js';
import { setDefaultQueryEngine } from './ui-element.js';
setDefaultQueryEngine(new SelectorEngine());
