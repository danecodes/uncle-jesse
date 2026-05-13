import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { createCli } from '../src/cli.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

describe('createCli', () => {
  it('reports the package version', () => {
    expect(createCli().version()).toBe(pkg.version);
  });

  it('registers the doctor command', () => {
    expect(createCli().commands.map((command) => command.name())).toContain('doctor');
  });
});
