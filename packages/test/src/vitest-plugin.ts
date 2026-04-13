import type { Plugin } from 'vitest/config';
import type { UncleJesseConfig } from '@danecodes/uncle-jesse-core';

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
