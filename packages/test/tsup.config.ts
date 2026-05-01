import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/vitest-plugin.ts', 'src/replay.ts', 'src/roku-session.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  target: 'node20',
  outDir: 'dist',
});
