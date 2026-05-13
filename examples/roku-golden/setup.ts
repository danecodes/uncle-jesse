import { resolve } from 'node:path';
import { RegistryState } from '@danecodes/uncle-jesse-core';
import { configureUncleJesse } from '@danecodes/uncle-jesse-test/vitest';
import { App } from './pages/App.js';

const testChannelPath = resolve(import.meta.dirname, '../../test-channels/uncle-jesse-test-app');

configureUncleJesse({
  sessionFactory: ({ testName, tags }) => ({
    deviceIp: process.env.ROKU_IP ?? process.env.UNCLE_JESSE_ROKU_IP ?? '192.168.0.30',
    devPassword: process.env.ROKU_DEV_PASSWORD ?? process.env.UNCLE_JESSE_ROKU_PASSWORD ?? 'rokudev',
    channelId: process.env.ROKU_CHANNEL_ID ?? 'dev',
    channelArtifact: { path: testChannelPath },
    registry: [
      new RegistryState().set('UNCLE_JESSE', 'lastTestName', testName),
    ],
    launchArgs: {
      testName,
      tags: tags.map((tag) => tag.name).join(','),
    },
    artifacts: {
      baseDir: 'test-results',
      captureLog: true,
      screenshotOnFail: true,
    },
    appFactory: (device) => new App(device),
  }),
});
