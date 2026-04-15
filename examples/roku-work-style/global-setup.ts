import { resolve } from 'node:path';
import { EcpClient } from '@danecodes/roku-ecp';

const ip = process.env.UNCLE_JESSE_ROKU_IP ?? '192.168.0.30';
const password = process.env.UNCLE_JESSE_ROKU_PASSWORD ?? 'rokudev';
const testAppDir = resolve(import.meta.dirname, '../../test-channels/uncle-jesse-test-app');

export async function setup() {
  const client = new EcpClient(ip, { devPassword: password });

  // Check if the test app is already the active dev channel
  const active = await client.queryActiveApp();
  if (active.id === 'dev' && active.name === 'Uncle Jesse Test App') {
    return;
  }

  // Sideload the test app
  console.log(`Sideloading test app from ${testAppDir}...`);
  await client.sideload(testAppDir);
  console.log('Test app sideloaded.');
}
