import type { Plugin } from 'vitest/config';

export interface UncleJessePluginOptions {
  config?: string;
}

export function uncleJessePlugin(options?: UncleJessePluginOptions): Plugin {
  return {
    name: 'uncle-jesse',
    config() {
      return {
        test: {
          setupFiles: [options?.config ?? 'uncle-jesse.setup.ts'],
        },
      };
    },
  };
}
