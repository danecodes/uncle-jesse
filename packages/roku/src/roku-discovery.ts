import { EcpClient } from '@danecodes/roku-ecp';
import { RokuAdapter } from './roku-adapter.js';

export interface DiscoveredDevice {
  ip: string;
  name: string;
}

export class RokuDiscovery {
  async findFirst(options?: { timeout?: number }): Promise<RokuAdapter> {
    const client = await EcpClient.discover(options);
    const info = await client.queryDeviceInfo();
    return new RokuAdapter({
      name: info.friendlyName,
      ip: client.deviceIp,
    });
  }

  async findAll(options?: { timeout?: number }): Promise<RokuAdapter[]> {
    const clients = await EcpClient.discoverAll(options);
    const adapters: RokuAdapter[] = [];
    for (const client of clients) {
      const info = await client.queryDeviceInfo();
      adapters.push(
        new RokuAdapter({
          name: info.friendlyName,
          ip: client.deviceIp,
        }),
      );
    }
    return adapters;
  }
}
