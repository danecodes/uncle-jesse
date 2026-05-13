import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockDevice = {
  ping: vi.fn(),
  connect: vi.fn(),
  getDeviceInfo: vi.fn(),
  getAppState: vi.fn(),
  connectOdc: vi.fn(),
  hasOdc: false,
  screenshot: vi.fn(),
  startLogCapture: vi.fn(),
  stopLogCapture: vi.fn(),
  isLogConnected: false,
  disconnect: vi.fn(),
};

const RokuAdapterMock = vi.fn(function MockRokuAdapter() {
  return mockDevice;
});

vi.mock('@danecodes/uncle-jesse-roku', () => ({
  RokuAdapter: RokuAdapterMock,
}));

describe('runDoctor', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  let originalIp: string | undefined;
  let originalRokuIp: string | undefined;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    process.exitCode = undefined;
    originalIp = process.env.ROKU_IP;
    originalRokuIp = process.env.UNCLE_JESSE_ROKU_IP;
    delete process.env.ROKU_IP;
    delete process.env.UNCLE_JESSE_ROKU_IP;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockDevice.ping.mockResolvedValue(true);
    mockDevice.connect.mockResolvedValue(undefined);
    mockDevice.getDeviceInfo.mockResolvedValue({
      friendlyName: 'Living Room',
      modelName: 'Roku Ultra',
      softwareVersion: '12.5',
    });
    mockDevice.getAppState.mockResolvedValue('foreground');
    mockDevice.connectOdc.mockResolvedValue(undefined);
    mockDevice.hasOdc = true;
    mockDevice.screenshot.mockResolvedValue(Buffer.from('png'));
    mockDevice.startLogCapture.mockResolvedValue(undefined);
    mockDevice.stopLogCapture.mockReturnValue(undefined);
    mockDevice.isLogConnected = true;
    mockDevice.disconnect.mockResolvedValue(undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
    setOptionalEnv('ROKU_IP', originalIp);
    setOptionalEnv('UNCLE_JESSE_ROKU_IP', originalRokuIp);
    process.exitCode = undefined;
  });

  it('checks requested Roku capabilities', async () => {
    const { runDoctor } = await import('../src/commands/doctor.js');

    await runDoctor({
      ip: '192.168.1.50',
      password: 'secret',
      timeout: '1234',
      channel: 'dev',
      odc: true,
      screenshot: true,
      logs: true,
    });

    expect(RokuAdapterMock).toHaveBeenCalledWith({
      name: 'doctor',
      ip: '192.168.1.50',
      devPassword: 'secret',
      timeout: 1234,
      odc: true,
    });
    expect(mockDevice.ping).toHaveBeenCalledWith(1234);
    expect(mockDevice.connect).toHaveBeenCalledOnce();
    expect(mockDevice.getAppState).toHaveBeenCalledWith('dev');
    expect(mockDevice.connectOdc).toHaveBeenCalledOnce();
    expect(mockDevice.screenshot).toHaveBeenCalledOnce();
    expect(mockDevice.startLogCapture).toHaveBeenCalledOnce();
    expect(mockDevice.stopLogCapture).toHaveBeenCalledOnce();
    expect(mockDevice.disconnect).toHaveBeenCalledOnce();
    expect(process.exitCode).toBeUndefined();
  });

  it('fails fast when no device IP is configured', async () => {
    const { runDoctor } = await import('../src/commands/doctor.js');

    await runDoctor({});

    expect(RokuAdapterMock).not.toHaveBeenCalled();
    expect(process.exitCode).toBe(1);
  });

  it('sets a failing exit code when a required check fails', async () => {
    mockDevice.ping.mockResolvedValue(false);
    const { runDoctor } = await import('../src/commands/doctor.js');

    await runDoctor({ ip: '192.168.1.50' });

    expect(process.exitCode).toBe(1);
    expect(mockDevice.disconnect).toHaveBeenCalledOnce();
  });
});

function setOptionalEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}
