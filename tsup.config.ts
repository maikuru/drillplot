import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', editor: 'src/editor/index.ts' },
  format: ['esm'],
  // Declarations come from tsc (tsconfig.build.json): TypeScript 7 has no JS API for tsup's dts step.
  dts: false,
  clean: true,
  sourcemap: true,
  target: 'es2022',
  splitting: true,
});
