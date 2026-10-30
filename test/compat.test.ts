import { readdirSync, readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { parseSource, renderSvg, sampleDrill, stringifySource, type DrillSource } from '../src/index.js';

/*
 * Format 1 documents written for 0.1 must keep validating and render byte for byte as 0.1.1 drew
 * them. The SVGs in fixtures/v1-svg were written by drillplot 0.1.1 (commit 5c087ac) and are
 * never regenerated: if one of these tests fails, the change broke compatibility.
 */
const dir = new URL('./fixtures/', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('../schema/drill-diagram.v1.schema.json', import.meta.url), 'utf8')) as object;
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);

const docs: Array<[string, unknown]> = [
  ['sample', sampleDrill()],
  ['sample-landscape', { ...sampleDrill(), orient: 'landscape' }],
  ...readdirSync(new URL('v1/', dir))
    .filter((f) => f.endsWith('.json'))
    .map((f): [string, unknown] => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(new URL(`v1/${f}`, dir), 'utf8'))]),
];
const golden = (name: string, grey: boolean): string => readFileSync(new URL(`v1-svg/${name}${grey ? '.grey' : ''}.svg`, dir), 'utf8');

describe('format 1 documents from 0.1 are unchanged', () => {
  it('covers every golden file', () => {
    expect(readdirSync(new URL('v1-svg/', dir)).length).toBe(docs.length * 2);
  });

  it.each(docs)('%s still validates, against the validator and the schema', (_name, doc) => {
    expect(parseSource(doc).ok).toBe(true);
    expect(validate(doc)).toBe(true);
  });

  it.each(docs)('%s renders byte for byte as 0.1.1 did, in color and greyscale', (name, doc) => {
    const r = parseSource(doc);
    if (!r.ok) throw new Error('invalid');
    expect(renderSvg(r.source)).toBe(golden(name, false));
    expect(renderSvg(r.source, { greyscale: true })).toBe(golden(name, true));
  });

  it.each(docs)('%s normalizes to the same source text, with no new keys added', (_name, doc) => {
    const r = parseSource(doc);
    if (!r.ok) throw new Error('invalid');
    const text = stringifySource(r.source);
    expect(parseSource(text)).toEqual(r);
    const keys = (s: DrillSource): string[] => [...Object.keys(s), ...s.items.flatMap((it) => Object.keys(it))];
    expect(new Set(keys(JSON.parse(text) as DrillSource))).toEqual(new Set(keys(r.source)));
  });
});
