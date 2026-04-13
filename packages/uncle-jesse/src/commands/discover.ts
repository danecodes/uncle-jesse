import chalk from 'chalk';
import { RokuDiscovery } from '@danecodes/uncle-jesse-roku';

export async function runDiscover(options: { timeout: string }): Promise<void> {
  const timeout = Number(options.timeout);
  console.log(chalk.dim(`Scanning for TV devices (${timeout}ms timeout)...\n`));

  try {
    const discovery = new RokuDiscovery();
    const devices = await discovery.scan({ timeout });

    if (devices.length === 0) {
      console.log(chalk.yellow('No devices found.'));
      console.log(chalk.dim('Make sure your TV is on and connected to the same network.'));
      return;
    }

    const reachable = devices.filter((d) => d.reachable);
    const unreachable = devices.filter((d) => !d.reachable);

    if (reachable.length > 0) {
      console.log(chalk.green(`Found ${reachable.length} reachable device${reachable.length > 1 ? 's' : ''}:\n`));
      for (const device of reachable) {
        console.log(`  ${chalk.bold(device.name)}`);
        console.log(`  ${chalk.dim('IP:')} ${device.ip}`);
        console.log('');
      }
    }

    if (unreachable.length > 0) {
      console.log(chalk.yellow(`${unreachable.length} device${unreachable.length > 1 ? 's' : ''} responded to SSDP but ECP is unreachable:\n`));
      for (const device of unreachable) {
        console.log(`  ${chalk.dim('IP:')} ${device.ip}`);
        console.log(`  ${chalk.dim('Error:')} ${device.error}`);
        console.log(`  ${chalk.dim('Tip:')} Enable developer mode on this device`);
        console.log('');
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('timeout')) {
      console.log(chalk.yellow('Discovery timed out. No devices found.'));
    } else {
      throw err;
    }
  }
}
