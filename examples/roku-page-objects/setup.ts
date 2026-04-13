import { setDeviceFactory } from '@danecodes/uncle-jesse-test';
import { RokuAdapter } from '@danecodes/uncle-jesse-roku';
import config from './uncle-jesse.config.js';

const device = config.devices[0];

setDeviceFactory(async () => {
  return new RokuAdapter({
    name: device.name,
    ip: device.ip,
    devPassword: device.rokuDevPassword,
    timeout: config.defaults?.timeout,
    pressDelay: config.defaults?.pressDelay,
  });
});
