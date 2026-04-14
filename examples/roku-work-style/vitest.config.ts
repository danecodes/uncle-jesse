import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  test: {
    include: [path.resolve(import.meta.dirname, '*.test.ts')],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
    sequence: { concurrent: false },
  },
});
