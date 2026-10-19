// Copies the built package into demo/dist so the demo is a self-contained static site.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
rmSync('demo/dist', { recursive: true, force: true });
mkdirSync('demo/dist', { recursive: true });
cpSync('dist', 'demo/dist', { recursive: true });
cpSync('schema', 'demo/schema', { recursive: true });
