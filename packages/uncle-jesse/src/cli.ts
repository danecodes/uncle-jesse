import { Command } from 'commander';

export function createCli(): Command {
  const program = new Command();

  program
    .name('uncle-jesse')
    .description('E2E testing framework for smart TVs')
    .version('0.0.1');

  program
    .command('test')
    .description('Run TV E2E tests')
    .option('-c, --config <path>', 'Path to config file')
    .option('--reporter <type>', 'Reporter: console, junit', 'console')
    .action(async (options) => {
      console.log('Running tests...', options);
    });

  program
    .command('discover')
    .description('Discover TV devices on the network')
    .option('--timeout <ms>', 'Discovery timeout in ms', '5000')
    .action(async (options) => {
      console.log('Discovering devices...', options);
    });

  return program;
}
