import { readFileSync, existsSync } from 'node:fs';
import chalk from 'chalk';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { RokuAdapter } from '@danecodes/uncle-jesse-roku';

const require = createRequire(join(process.cwd(), 'package.json'));

type DoctorStatus = 'pass' | 'warn' | 'fail' | 'skip';

interface DoctorCheck {
  name: string;
  status: DoctorStatus;
  message: string;
  detail?: string;
}

export interface DoctorOptions {
  ip?: string;
  password?: string;
  timeout?: string;
  channel?: string;
  odc?: boolean;
  screenshot?: boolean;
  logs?: boolean;
}

export async function runDoctor(options: DoctorOptions): Promise<void> {
  const timeout = Number(options.timeout ?? '5000');
  const ip = options.ip ?? process.env.UNCLE_JESSE_ROKU_IP ?? process.env.ROKU_IP;
  const password = options.password ?? process.env.UNCLE_JESSE_ROKU_PASSWORD ?? process.env.ROKU_DEV_PASSWORD ?? 'rokudev';
  const channelId = options.channel ?? process.env.UNCLE_JESSE_ROKU_CHANNEL_ID ?? process.env.ROKU_CHANNEL_ID;
  const checks: DoctorCheck[] = [];

  console.log(chalk.bold('Uncle Jesse Doctor'));
  console.log(chalk.dim('Checking local packages and Roku connectivity.\n'));

  checks.push(packageVersionCheck());

  if (!ip) {
    checks.push({
      name: 'Device IP',
      status: 'fail',
      message: 'No Roku IP configured',
      detail: 'Pass --ip or set UNCLE_JESSE_ROKU_IP.',
    });
    printChecks(checks);
    process.exitCode = 1;
    return;
  }

  checks.push({
    name: 'Device IP',
    status: 'pass',
    message: ip,
  });

  const device = new RokuAdapter({
    name: 'doctor',
    ip,
    devPassword: password,
    timeout,
    odc: options.odc ? true : undefined,
  });

  let connected = false;
  try {
    const reachable = await device.ping(timeout);
    checks.push({
      name: 'ECP reachability',
      status: reachable ? 'pass' : 'fail',
      message: reachable ? 'Port 8060 responded' : `No response within ${timeout}ms`,
      detail: reachable ? undefined : 'Make sure the Roku is on and on the same network.',
    });
  } catch (err) {
    checks.push({
      name: 'ECP reachability',
      status: 'fail',
      message: errorMessage(err),
      detail: 'Make sure the Roku is on and ECP is reachable on port 8060.',
    });
  }

  try {
    await device.connect();
    connected = true;
    checks.push({
      name: 'Device info',
      status: 'pass',
      message: await describeDevice(device),
    });
  } catch (err) {
    checks.push({
      name: 'Device info',
      status: 'fail',
      message: errorMessage(err),
      detail: 'ECP connected enough to ping may still fail if the device is locked down or unavailable.',
    });
  }

  if (connected && channelId) {
    try {
      const state = await device.getAppState(channelId);
      checks.push({
        name: 'Channel',
        status: state === 'not-installed' ? 'warn' : 'pass',
        message: `${channelId}: ${state}`,
        detail: state === 'not-installed' ? 'Install or sideload the channel before running tests.' : undefined,
      });
    } catch (err) {
      checks.push({
        name: 'Channel',
        status: 'warn',
        message: errorMessage(err),
      });
    }
  } else {
    checks.push({
      name: 'Channel',
      status: 'skip',
      message: 'No --channel or ROKU_CHANNEL_ID provided',
    });
  }

  if (connected && options.odc) {
    try {
      await device.connectOdc();
      checks.push({
        name: 'ODC',
        status: device.hasOdc ? 'pass' : 'fail',
        message: device.hasOdc ? 'ODC client configured' : 'ODC unavailable',
        detail: device.hasOdc ? undefined : 'Install/inject @danecodes/roku-odc support or run without --odc.',
      });
    } catch (err) {
      checks.push({
        name: 'ODC',
        status: 'fail',
        message: errorMessage(err),
      });
    }
  } else {
    checks.push({
      name: 'ODC',
      status: 'skip',
      message: 'Pass --odc to require ODC availability',
    });
  }

  if (connected && options.screenshot) {
    try {
      const screenshot = await device.screenshot();
      checks.push({
        name: 'Screenshot',
        status: screenshot.length > 0 ? 'pass' : 'warn',
        message: screenshot.length > 0 ? `${screenshot.length} bytes captured` : 'Screenshot endpoint returned an empty image',
      });
    } catch (err) {
      checks.push({
        name: 'Screenshot',
        status: 'warn',
        message: errorMessage(err),
        detail: 'Screenshots can fail when developer mode is disabled, credentials are wrong, or the app blocks capture.',
      });
    }
  } else {
    checks.push({
      name: 'Screenshot',
      status: 'skip',
      message: 'Pass --screenshot to verify capture support',
    });
  }

  if (connected && options.logs) {
    try {
      await device.startLogCapture();
      checks.push({
        name: 'Debug console',
        status: device.isLogConnected ? 'pass' : 'warn',
        message: device.isLogConnected ? 'Port 8085 log stream connected' : 'Log stream unavailable',
        detail: device.isLogConnected ? undefined : 'The debug console may already be in use or disabled.',
      });
    } catch (err) {
      checks.push({
        name: 'Debug console',
        status: 'warn',
        message: errorMessage(err),
      });
    } finally {
      device.stopLogCapture();
    }
  } else {
    checks.push({
      name: 'Debug console',
      status: 'skip',
      message: 'Pass --logs to verify port 8085 log capture',
    });
  }

  await device.disconnect().catch(() => {});

  printChecks(checks);
  printNextSteps(checks);

  if (checks.some((check) => check.status === 'fail')) {
    process.exitCode = 1;
  }
}

function packageVersionCheck(): DoctorCheck {
  const versions = [
    packageVersion('uncle-jesse'),
    packageVersion('@danecodes/uncle-jesse-core'),
    packageVersion('@danecodes/uncle-jesse-roku'),
    packageVersion('@danecodes/uncle-jesse-test'),
  ].filter(Boolean);

  return {
    name: 'Package versions',
    status: 'pass',
    message: versions.join(', '),
  };
}

function packageVersion(name: string): string | null {
  try {
    const entry = require.resolve(name);
    const pkgPath = entry.endsWith('package.json') ? entry : findPackageJson(entry, name);
    if (!pkgPath) return null;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string };
    return `${pkg.name ?? name}@${pkg.version ?? 'unknown'}`;
  } catch {
    return null;
  }
}

function findPackageJson(from: string, expectedName: string): string | null {
  let dir = dirname(from);
  for (let i = 0; i < 8; i++) {
    const candidate = join(dir, 'package.json');
    if (existsSync(candidate)) {
      try {
        const pkg = JSON.parse(readFileSync(candidate, 'utf8')) as { name?: string };
        if (pkg.name === expectedName) return candidate;
      } catch {
        // Keep walking.
      }
    }
    const next = dirname(dir);
    if (next === dir) break;
    dir = next;
  }
  return null;
}

async function describeDevice(device: RokuAdapter): Promise<string> {
  const info = await device.getDeviceInfo();
  const model = getInfoField(info, 'modelName') ?? getInfoField(info, 'model-number') ?? getInfoField(info, 'modelNumber');
  const name = getInfoField(info, 'friendlyName') ?? getInfoField(info, 'friendly-device-name') ?? getInfoField(info, 'userDeviceName');
  const version = getInfoField(info, 'softwareVersion') ?? getInfoField(info, 'software-version');
  return [name, model, version].filter(Boolean).join(' / ') || 'Device info returned';
}

function getInfoField(info: unknown, field: string): string | undefined {
  if (!info || typeof info !== 'object') return undefined;
  const value = (info as Record<string, unknown>)[field];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function printChecks(checks: DoctorCheck[]): void {
  console.log('');
  for (const check of checks) {
    console.log(`${statusLabel(check.status)} ${chalk.bold(check.name)} ${check.message}`);
    if (check.detail) {
      console.log(`   ${chalk.dim(check.detail)}`);
    }
  }
}

function printNextSteps(checks: DoctorCheck[]): void {
  const failed = checks.filter((check) => check.status === 'fail');
  const warned = checks.filter((check) => check.status === 'warn');
  if (failed.length === 0 && warned.length === 0) {
    console.log(chalk.green('\nDoctor passed.'));
    return;
  }

  console.log(chalk.bold('\nNext steps'));
  for (const check of [...failed, ...warned]) {
    if (check.detail) {
      console.log(`- ${check.name}: ${check.detail}`);
    }
  }
}

function statusLabel(status: DoctorStatus): string {
  switch (status) {
    case 'pass':
      return chalk.green('PASS');
    case 'warn':
      return chalk.yellow('WARN');
    case 'fail':
      return chalk.red('FAIL');
    case 'skip':
      return chalk.dim('SKIP');
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
