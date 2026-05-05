import type { Plugin } from 'vitest/config';
import type { RokuSessionOptions } from './roku-session.js';

export interface UncleJessePluginOptions {
  /** Session factory called per-test. Receives the Vitest TestContext. */
  sessionFactory?: (ctx: any) => RokuSessionOptions;

  /** Additional setup files to inject. */
  setupFile?: string;

  /** Enable code-frame source highlighting on assertion failures. Default true. */
  codeFrame?: boolean;

  /** Tag expression env var name. Default 'TAGS'. */
  tagsEnvVar?: string;

  /** Explicit tag expression (overrides env var). */
  tagExpression?: string;
}

let _pluginConfig: UncleJessePluginOptions = {};

export function getPluginConfig(): UncleJessePluginOptions {
  return _pluginConfig;
}

export function uncleJessePlugin(options?: UncleJessePluginOptions): Plugin {
  _pluginConfig = { codeFrame: true, tagsEnvVar: 'TAGS', ...options };

  return {
    name: 'uncle-jesse',
    config() {
      const setupFiles: string[] = [];
      if (options?.setupFile) setupFiles.push(options.setupFile);

      return {
        test: {
          setupFiles,
        },
      };
    },
  };
}
