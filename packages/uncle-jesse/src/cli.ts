import { Command } from 'commander';
import { runTests } from './commands/test.js';
import { runDiscover } from './commands/discover.js';
import { runSideload } from './commands/sideload.js';

export function createCli(): Command {
  const program = new Command();

  program
    .name('uncle-jesse')
    .description('E2E testing framework for smart TVs')
    .version('1.0.7');

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

  return program;
}
