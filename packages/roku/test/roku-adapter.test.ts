import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RokuAdapter } from '../src/roku-adapter.js';
import { DeviceConnectionError } from '@danecodes/uncle-jesse-core';

const mockClient = {
  queryDeviceInfo: vi.fn(),
  queryActiveApp: vi.fn().mockResolvedValue({ id: 'dev', name: 'test' }),
  queryInstalledApps: vi.fn(),
  queryAppUi: vi.fn(),
  takeScreenshot: vi.fn(),
  press: vi.fn(),
  keydown: vi.fn(),
  keyup: vi.fn(),
  type: vi.fn(),
  launch: vi.fn(),
  closeApp: vi.fn(),
  deepLink: vi.fn(),
};

vi.mock('@danecodes/roku-ecp', () => {
  class MockEcpClient {
    constructor() {
      return mockClient;
    }
  }

  return {
    EcpClient: MockEcpClient,
    parseUiXml: vi.fn(),
    findElement: vi.fn(),
    findElements: vi.fn(),
    findFocused: vi.fn(),
    waitForApp: vi.fn().mockResolvedValue({ id: 'dev', name: 'test' }),
  };
});

describe('RokuAdapter', () => {
  let adapter: RokuAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new RokuAdapter({
      name: 'test-roku',
      ip: '192.168.1.100',
      devPassword: 'rokudev',
    });
  });

  describe('connect', () => {
    it('queries device info to verify connectivity', async () => {
      const mock = mockClient;
      mock.queryDeviceInfo.mockResolvedValue({ friendlyName: 'Test Roku' });

      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
      expect(mock.queryDeviceInfo).toHaveBeenCalledOnce();
    });

    it('throws DeviceConnectionError on failure', async () => {
      const mock = mockClient;
      mock.queryDeviceInfo.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(adapter.connect()).rejects.toThrow(DeviceConnectionError);
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('disconnect', () => {
    it('marks device as disconnected', async () => {
      const mock = mockClient;
      mock.queryDeviceInfo.mockResolvedValue({});

      await adapter.connect();
      expect(adapter.isConnected()).toBe(true);
      await adapter.disconnect();
      expect(adapter.isConnected()).toBe(false);
    });
  });

  describe('press', () => {
    it('maps RemoteKey to ECP key and delegates', async () => {
      const mock = mockClient;
      mock.press.mockResolvedValue(undefined);

      await adapter.press('select');
      expect(mock.press).toHaveBeenCalledWith('Select', { times: 1, delay: 150 });
    });

    it('passes times and delay options', async () => {
      const mock = mockClient;
      mock.press.mockResolvedValue(undefined);

      await adapter.press('right', { times: 3, delay: 200 });
      expect(mock.press).toHaveBeenCalledWith('Right', { times: 3, delay: 200 });
    });
  });

  describe('navigate', () => {
    it('calls press with direction and step count', async () => {
      const mock = mockClient;
      mock.press.mockResolvedValue(undefined);

      await adapter.navigate('down', 3);
      expect(mock.press).toHaveBeenCalledWith('Down', { times: 3, delay: 150 });
    });
  });

  describe('type', () => {
    it('delegates to EcpClient.type', async () => {
      const mock = mockClient;
      mock.type.mockResolvedValue(undefined);

      await adapter.type('hello');
      expect(mock.type).toHaveBeenCalledWith('hello');
    });
  });

  describe('app lifecycle', () => {
    it('launches an app with params', async () => {
      const mock = mockClient;
      mock.launch.mockResolvedValue(undefined);
      mock.queryActiveApp.mockResolvedValue({ id: '12345', name: 'Test', type: 'appl', version: '1.0' });

      await adapter.launchApp('12345', { contentId: 'abc' });
      expect(mock.launch).toHaveBeenCalledWith('12345', { contentId: 'abc' });
    });

    it('gets active app info', async () => {
      const mock = mockClient;
      mock.queryActiveApp.mockResolvedValue({
        id: '12345',
        name: 'My App',
        version: '1.0.0',
        type: 'appl',
      });

      const app = await adapter.getActiveApp();
      expect(app).toEqual({ id: '12345', name: 'My App', version: '1.0.0' });
    });

    it('gets installed apps', async () => {
      const mock = mockClient;
      mock.queryInstalledApps.mockResolvedValue([
        { id: '1', name: 'App One', version: '1.0', type: 'appl' },
        { id: '2', name: 'App Two', version: '2.0', type: 'appl' },
      ]);

      const apps = await adapter.getInstalledApps();
      expect(apps).toHaveLength(2);
      expect(apps[0]).toEqual({ id: '1', name: 'App One', version: '1.0' });
    });
  });

  describe('properties', () => {
    it('exposes platform, name, and ip', () => {
      expect(adapter.platform).toBe('roku');
      expect(adapter.name).toBe('test-roku');
      expect(adapter.ip).toBe('192.168.1.100');
    });
  });
});
