import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import chalk from 'chalk';

export interface TestCommandOptions {
  config?: string;
  reporter: string;
  watch?: boolean;
}

export async function runTests(options: TestCommandOptions): Promise<void> {
  const args = ['vitest', 'run'];

  if (options.config) {
    const configPath = resolve(options.config);
    if (!existsSync(configPath)) {
      console.error(chalk.red(`Config file not found: ${configPath}`));
      process.exit(1);
    }
    args.push('--config', configPath);
  }

  if (options.reporter === 'junit') {
    args.push('--reporter', 'junit');
  }

  if (options.watch) {
    args[1] = 'watch';
  }

  console.log(chalk.dim(`Running: npx ${args.join(' ')}\n`));

  return new Promise((resolve, reject) => {
    const child = spawn('npx', args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      env: {
        ...process.env,
        FORCE_COLOR: '1',
      },
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        process.exit(code ?? 1);
      }
    });

    child.on('error', (err) => {
      console.error(chalk.red(`Failed to start test runner: ${err.message}`));
      reject(err);
    });
  });
}
