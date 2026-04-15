import type { Plugin } from 'vitest/config';

export interface UncleJessePluginOptions {
  setupFile?: string;
  screenshotOnFailure?: boolean;
  logCapture?: boolean;
  artifactDir?: string;
  logDir?: string;
  onTestStart?: (device: unknown, ctx: unknown) => Promise<void>;
  onTestFinished?: (device: unknown, result: unknown, ctx: unknown) => Promise<void>;
}

// Store config so the fixture can read it
let _pluginConfig: UncleJessePluginOptions = {};

export function getPluginConfig(): UncleJessePluginOptions {
  return _pluginConfig;
}

export function uncleJessePlugin(options?: UncleJessePluginOptions): Plugin {
  _pluginConfig = {
    screenshotOnFailure: true,
    logCapture: false,
    artifactDir: './test-results',
    logDir: './test-logs',
    ...options,
  };

  return {
    name: 'uncle-jesse',
    config() {
      const setupFiles = options?.setupFile
        ? [options.setupFile]
        : [];

      return {
        test: {
          setupFiles,
        },
      };
    },
  };
}
