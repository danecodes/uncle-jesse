import chalk from 'chalk';
import { RokuDiscovery } from '@uncle-jesse/roku';

export async function runDiscover(options: { timeout: string }): Promise<void> {
  const timeout = Number(options.timeout);
  console.log(chalk.dim(`Scanning for TV devices (${timeout}ms timeout)...\n`));

  try {
    const discovery = new RokuDiscovery();
    const devices = await discovery.findAll({ timeout });

    if (devices.length === 0) {
      console.log(chalk.yellow('No devices found.'));
      console.log(chalk.dim('Make sure your TV is on and connected to the same network.'));
      return;
    }

    console.log(chalk.green(`Found ${devices.length} device${devices.length > 1 ? 's' : ''}:\n`));

    for (const device of devices) {
      console.log(`  ${chalk.bold(device.name)}`);
      console.log(`  ${chalk.dim('IP:')} ${device.ip}`);
      console.log(`  ${chalk.dim('Platform:')} ${device.platform}`);
      console.log('');
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('timeout')) {
      console.log(chalk.yellow('Discovery timed out. No devices found.'));
    } else {
      throw err;
    }
  }
}
