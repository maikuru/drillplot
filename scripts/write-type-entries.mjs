// The package's two type entry points re-export the declarations tsc wrote to dist/types.
import { writeFileSync } from 'node:fs';
writeFileSync('dist/index.d.ts', "export * from './types/index.js';\n");
writeFileSync('dist/editor.d.ts', "export * from './types/editor/index.js';\n");
