import { cosmiconfig } from 'cosmiconfig';
import type { UncleJesseConfig } from './types.js';

export function defineConfig(config: UncleJesseConfig): UncleJesseConfig {
  return config;
}

const explorer = cosmiconfig('uncle-jesse', {
  searchPlaces: [
    'package.json',
    'uncle-jesse.config.ts',
    'uncle-jesse.config.js',
    'uncle-jesse.config.mjs',
    'uncle-jesse.config.cjs',
    '.uncle-jesserc',
    '.uncle-jesserc.json',
    '.uncle-jesserc.yaml',
    '.uncle-jesserc.yml',
  ],
});

export async function loadConfig(searchFrom?: string): Promise<{
  config: UncleJesseConfig;
  filepath: string;
} | null> {
  const result = await explorer.search(searchFrom);
  if (!result || result.isEmpty) return null;

  const config = result.config as UncleJesseConfig;
  if (!config.devices || !Array.isArray(config.devices)) {
    throw new Error(
      `Invalid config at ${result.filepath}: "devices" must be an array`,
    );
  }

  for (const device of config.devices) {
    if (!device.name || !device.platform || !device.ip) {
      throw new Error(
        `Invalid device config at ${result.filepath}: each device needs name, platform, and ip`,
      );
    }
  }

  return { config, filepath: result.filepath };
}

export async function loadConfigFromFile(filepath: string): Promise<UncleJesseConfig> {
  const result = await explorer.load(filepath);
  if (!result || result.isEmpty) {
    throw new Error(`Config file is empty: ${filepath}`);
  }
  return result.config as UncleJesseConfig;
}
