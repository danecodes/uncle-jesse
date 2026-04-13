import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    setupFiles: [path.resolve(import.meta.dirname, 'setup.ts')],
    include: [path.resolve(import.meta.dirname, '*.test.ts')],
    testTimeout: 30000,
  },
});
