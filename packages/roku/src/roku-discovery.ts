import { EcpClient, type DeviceInfo } from '@danecodes/roku-ecp';
import { RokuAdapter } from './roku-adapter.js';

export interface DiscoveredDevice {
  ip: string;
  name: string;
  reachable: boolean;
  error?: string;
}

// roku-ecp types `friendlyName` but the actual ECP response uses `friendlyDeviceName`
function resolveDeviceName(info: DeviceInfo, fallback: string): string {
  const rec = info as Record<string, unknown>;
  return (info.friendlyName
    ?? rec['friendlyDeviceName']
    ?? rec['userDeviceName']
    ?? rec['defaultDeviceName']
    ?? fallback) as string;
}

export class RokuDiscovery {
  async findFirst(options?: { timeout?: number }): Promise<RokuAdapter> {
    const client = await EcpClient.discover(options);
    const info = await client.queryDeviceInfo();
    return new RokuAdapter({
      name: resolveDeviceName(info, client.deviceIp),
      ip: client.deviceIp,
    });
  }

  async findAll(options?: { timeout?: number }): Promise<RokuAdapter[]> {
    const clients = await EcpClient.discoverAll(options);
    const adapters: RokuAdapter[] = [];

    for (const client of clients) {
      try {
        const info = await client.queryDeviceInfo();
        adapters.push(
          new RokuAdapter({
            name: resolveDeviceName(info, client.deviceIp),
            ip: client.deviceIp,
          }),
        );
      } catch {
        // Device responded to SSDP but ECP isn't reachable — skip it
      }
    }

    return adapters;
  }

  async scan(options?: { timeout?: number }): Promise<DiscoveredDevice[]> {
    const clients = await EcpClient.discoverAll(options);
    const results: DiscoveredDevice[] = [];

    for (const client of clients) {
      try {
        const info = await client.queryDeviceInfo();
        results.push({
          ip: client.deviceIp,
          name: resolveDeviceName(info, client.deviceIp),
          reachable: true,
        });
      } catch (err) {
        results.push({
          ip: client.deviceIp,
          name: '(unreachable)',
          reachable: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return results;
  }
}
