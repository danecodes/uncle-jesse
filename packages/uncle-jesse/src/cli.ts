import { Command } from 'commander';
import { runTests } from './commands/test.js';
import { runDiscover } from './commands/discover.js';
import { runSideload } from './commands/sideload.js';
import { runDoctor } from './commands/doctor.js';

declare const __UNCLE_JESSE_VERSION__: string | undefined;

function getPackageVersion(): string {
  if (typeof __UNCLE_JESSE_VERSION__ !== 'undefined') {
    return __UNCLE_JESSE_VERSION__;
  }
  return process.env['npm_package_version'] ?? '0.0.0';
}

export function createCli(): Command {
  const program = new Command();

  program
    .name('uncle-jesse')
    .description('E2E testing framework for smart TVs')
    .version(getPackageVersion());

  program
    .command('test')
    .description('Run TV E2E tests')
    .option('-c, --config <path>', 'Path to vitest config file')
    .option('--reporter <type>', 'Reporter: console, junit, ctrf', 'console')
    .option('-w, --watch', 'Run in watch mode')
    .action(runTests);

  program
    .command('discover')
    .description('Discover TV devices on the network')
    .option('--timeout <ms>', 'Discovery timeout in ms', '5000')
    .action(runDiscover);

  program
    .command('sideload')
    .description('Sideload a channel to a Roku device')
    .argument('<path>', 'Path to a .zip file or channel directory')
    .option('--ip <address>', 'Device IP (or set UNCLE_JESSE_ROKU_IP)')
    .option('--password <password>', 'Dev password (default: rokudev)')
    .action(runSideload);

  program
    .command('doctor')
    .description('Check Roku connectivity and Uncle Jesse test prerequisites')
    .option('--ip <address>', 'Device IP (or set UNCLE_JESSE_ROKU_IP / ROKU_IP)')
    .option('--password <password>', 'Dev password (default: rokudev)')
    .option('--timeout <ms>', 'Per-check timeout in ms', '5000')
    .option('--channel <id>', 'Channel id to check (or set ROKU_CHANNEL_ID)')
    .option('--odc', 'Require ODC availability')
    .option('--screenshot', 'Verify screenshot capture support')
    .option('--logs', 'Verify debug console log capture support')
    .action(runDoctor);

  return program;
}
