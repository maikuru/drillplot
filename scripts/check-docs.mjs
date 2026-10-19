// Checks the Markdown documentation: every relative link points at a file that exists, every
// #anchor exists in its target, the JSON examples in docs/format.md that claim to be valid are,
// and every export of the built package is mentioned in docs/api.md. Run after `npm run build`.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SKIP = new Set(['node_modules', 'dist', '.git']);

function markdownFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    if (SKIP.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...markdownFiles(full));
    else if (name.endsWith('.md')) out.push(full);
  }
  return out;
}

/** GitHub's heading slug: lower case, punctuation dropped, spaces to hyphens, repeats numbered. */
function anchorsOf(text) {
  const seen = new Map();
  const anchors = new Set();
  let fence = false;
  for (const line of text.split('\n')) {
    if (/^\s*```/.test(line)) fence = !fence;
    const m = !fence && /^#{1,6}\s+(.*?)\s*#*\s*$/.exec(line);
    if (!m) continue;
    const base = m[1]
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[`*_~]/g, (c) => (c === '_' ? '_' : ''))
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, '')
      .trim()
      .replace(/\s/g, '-');
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    anchors.add(n === 0 ? base : `${base}-${n}`);
  }
  return anchors;
}

const files = markdownFiles(root);
const anchorCache = new Map();
const anchorsFor = (file) => {
  if (!anchorCache.has(file)) anchorCache.set(file, anchorsOf(readFileSync(file, 'utf8')));
  return anchorCache.get(file);
};

const problems = [];
let checked = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8');
  const prose = text.replace(/```[\s\S]*?```/g, (b) => b.replace(/[^\n]/g, ' ')).replace(/`[^`\n]*`/g, (b) => ' '.repeat(b.length));
  const targets = [...prose.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
  targets.push(...[...prose.matchAll(/<(?:img|a)\s[^>]*?(?:src|href)="([^"]+)"/g)].map((m) => m[1]));
  for (const target of targets) {
    if (/^(https?:|mailto:)/.test(target)) continue;
    checked++;
    const [path, hash] = target.split('#');
    const dest = path ? resolve(dirname(file), path) : file;
    const where = `${relative(root, file)}: ${target}`;
    if (!existsSync(dest)) {
      problems.push(`${where} (no such file)`);
      continue;
    }
    if (hash && dest.endsWith('.md') && !anchorsFor(dest).has(hash)) problems.push(`${where} (no such heading)`);
  }
}

// JSON examples in the format spec that are meant to be valid
const { parseSource } = await import(pathToFileURL(join(root, 'dist/index.js')).href);
const format = readFileSync(join(root, 'docs/format.md'), 'utf8');
const blocks = [...format.matchAll(/```json\n([\s\S]*?)```/g)].map((m) => m[1]);
blocks.forEach((b, i) => {
  const invalidExample = b.includes('"x": 30');
  const r = parseSource(b);
  if (r.ok === invalidExample) problems.push(`docs/format.md: JSON example ${i + 1} is ${r.ok ? 'valid' : 'invalid'}, which is not what the text says`);
});

// every export is documented
const api = readFileSync(join(root, 'docs/api.md'), 'utf8');
const exportsOf = async (entry) => Object.keys(await import(pathToFileURL(join(root, entry)).href));
let names = await exportsOf('dist/index.js');
try {
  names = names.concat(await exportsOf('dist/editor.js'));
} catch {
  names = names.concat(['DrillplotEditor', 'DrillModel', 'TOKENS', 'defineDrillplotEditor']); // the editor module needs a browser to load
}
const typeNames = [...readFileSync(join(root, 'dist/types/format/types.d.ts'), 'utf8').matchAll(/export (?:interface|type) (\w+)/g)].map((m) => m[1]);
typeNames.push('RenderOptions', 'Rect', 'ChangeDetail', 'SaveDetail', 'SourceErrorDetail');
for (const name of new Set([...names, ...typeNames])) {
  if (!new RegExp(`\\b${name}\\b`).test(api)) problems.push(`docs/api.md: export ${name} is not mentioned`);
}

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`${files.length} Markdown files, ${checked} relative links and ${blocks.length} JSON examples checked; all ${new Set([...names, ...typeNames]).size} exports are documented.`);
