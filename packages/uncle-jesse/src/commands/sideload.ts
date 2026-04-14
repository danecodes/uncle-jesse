import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import chalk from 'chalk';
import { EcpClient } from '@danecodes/roku-ecp';

export interface SideloadOptions {
  ip?: string;
  password?: string;
}

export async function runSideload(zipPath: string, options: SideloadOptions): Promise<void> {
  const resolved = resolve(zipPath);
  if (!existsSync(resolved)) {
    console.error(chalk.red(`File not found: ${resolved}`));
    process.exit(1);
  }

  if (!resolved.endsWith('.zip')) {
    console.error(chalk.red('Sideload requires a .zip file'));
    process.exit(1);
  }

  const ip = options.ip ?? process.env.UNCLE_JESSE_ROKU_IP;
  if (!ip) {
    console.error(chalk.red('No device IP. Use --ip or set UNCLE_JESSE_ROKU_IP'));
    process.exit(1);
  }

  const password = options.password ?? process.env.UNCLE_JESSE_ROKU_PASSWORD ?? 'rokudev';

  console.log(`Sideloading ${chalk.bold(zipPath)} to ${chalk.bold(ip)}...`);

  const client = new EcpClient(ip, { devPassword: password });

  try {
    const result = await client.sideload(resolved);
    console.log(chalk.green('Sideload complete.'));
    if (result) console.log(chalk.dim(result));
  } catch (err) {
    console.error(chalk.red(`Sideload failed: ${err instanceof Error ? err.message : err}`));
    process.exit(1);
  }
}
