import { defineConfig } from '@uncle-jesse/core';

export default defineConfig({
  devices: [
    {
      name: 'dev-roku',
      platform: 'roku',
      ip: process.env.UNCLE_JESSE_ROKU_IP ?? '192.168.1.100',
      rokuDevPassword: process.env.UNCLE_JESSE_ROKU_PASSWORD ?? 'rokudev',
    },
  ],
  defaults: {
    timeout: 10000,
    pressDelay: 150,
  },
  app: {
    rokuAppId: 'dev',
  },
});
