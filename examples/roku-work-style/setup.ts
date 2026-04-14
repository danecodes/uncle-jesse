import { RokuAdapter } from '@danecodes/uncle-jesse-roku';

const ip = process.env.UNCLE_JESSE_ROKU_IP ?? '192.168.0.30';
const password = process.env.UNCLE_JESSE_ROKU_PASSWORD ?? 'rokudev';

export async function createDevice() {
  const device = new RokuAdapter({
    name: 'test-roku',
    ip,
    devPassword: password,
    timeout: 10000,
    pressDelay: 150,
  });
  await device.connect();
  return device;
}
