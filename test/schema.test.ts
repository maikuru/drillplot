import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { LIMITS, parseSource, sampleDrill } from '../src/index.js';

const schema = JSON.parse(readFileSync(new URL('../schema/drill-diagram.v1.schema.json', import.meta.url), 'utf8')) as object;
// The shipped file, exactly as consumers of `drillplot/schema` get it.
const ajv = new Ajv2020({ allErrors: true, strict: true });
const validate = ajv.compile(schema);

const base = { format: 'drill-diagram', version: 1, items: [] };
const one = (item: unknown) => ({ ...base, items: [item] });
const long = (n: number) => 'x'.repeat(n);
const ball = { type: 'ball', x1: 1, y1: 1, x2: 2, y2: 2, n: 1 };

const samples: Array<[string, unknown, boolean]> = [
  ['the sample', sampleDrill(), true],
  ['minimal', base, true],
  ['full header', { ...base, title: 't', caption: 'c', view: 'half', side: 'top', orient: 'landscape' }, true],
  ['older team key t1', one({ type: 'player', x: 1, y: 1, label: 'A', team: 't1' }), true],
  ['older team key coach', one({ type: 'player', x: 1, y: 1, team: 'coach' }), true],
  ['old export with ids', one({ id: 'i3', type: 'cone', x: 1, y: 1 }), true],
  ['edge coordinates', one({ type: 'cone', x: -2, y: 46 }), true],
  ['wide zone', one({ type: 'zone', x: 22, y: 0, w: 20, h: 44, label: long(24) }), true],
  ['machine angle', one({ type: 'machine', x: 1, y: 1, angle: 359.5 }), true],
  ['angle that rounds up to 360', one({ type: 'machine', x: 1, y: 1, angle: 359.996 }), true],
  ['highest shot number', one({ ...ball, n: 200 }), true],
  ['caption with line breaks and tabs', { ...base, caption: 'a\nb\tc\r\n' }, true],
  ['curved ball', one({ ...ball, curve: true, bend: -1 }), true],
  ['astral characters', one({ type: 'player', x: 1, y: 1, label: '🎾'.repeat(8) }), true],
  ['200 items', { ...base, items: Array.from({ length: LIMITS.maxItems }, () => ({ type: 'cone', x: 1, y: 1 })) }, true],

  // since 0.2
  ['visible caption', { ...base, caption: 'c', showCaption: true }, true],
  ['legend', { ...base, legend: [{ key: '1', text: 'First note' }, { key: 'T1', text: long(100) }] }, true],
  ['empty legend', { ...base, legend: [] }, true],
  ['legend swatch and plain notes', { ...base, legend: [{ color: 'red', text: 'Space left open' }, { text: 'A plain note' }] }, true],
  ['legend swatch of an unknown color', { ...base, legend: [{ color: 'purple', text: 'x' }] }, false],
  ['two courts', { ...base, courts: [{ label: 'Court 1', link: 'Winner moves up' }, { label: 'Court 2' }], items: [{ type: 'cone', x: 1, y: 1, court: 2 }] }, true],
  ['court 1 without courts', one({ type: 'cone', x: 1, y: 1, court: 1 }), true],
  ['player note, ghost and key', one({ type: 'player', x: 1, y: 1, note: long(16), ghost: true, key: '12' }), true],
  ['labelled cone', one({ type: 'cone', x: 1, y: 1, label: 'T1', key: 'a' }), true],
  ['ghost zone', one({ type: 'zone', x: 1, y: 1, w: 3, h: 3, ghost: true }), true],
  ['colored dashed alternative ball', one({ ...ball, color: 'pink', dash: true, alt: 'b' }), true],
  ['colored move with key', one({ type: 'move', x1: 1, y1: 1, x2: 2, y2: 2, color: 'orange', key: '2' }), true],
  ['line', one({ type: 'line', x1: 0, y1: 33, x2: 20, y2: 33, color: 'yellow', dash: true, label: 'Split step', key: '3' }), true],
  ['bare line', one({ type: 'line', x1: 0, y1: 33, x2: 20, y2: 33 }), true],
  ['mark', one({ type: 'mark', x: 5, y: 5, key: '4' }), true],

  ['showCaption as text', { ...base, showCaption: 'yes' }, false],
  ['legend not a list', { ...base, legend: { key: '1' } }, false],
  ['21 legend notes', { ...base, legend: Array.from({ length: 21 }, () => ({ key: '1', text: 'x' })) }, false],
  ['legend note without text', { ...base, legend: [{ key: '1' }] }, false],
  ['legend key too long', { ...base, legend: [{ key: '1234', text: 'x' }] }, false],
  ['legend key blank', { ...base, legend: [{ key: ' ', text: 'x' }] }, false],
  ['legend text too long', { ...base, legend: [{ key: '1', text: long(101) }] }, false],
  ['no courts', { ...base, courts: [] }, false],
  ['five courts', { ...base, courts: [{}, {}, {}, {}, {}] }, false],
  ['court label too long', { ...base, courts: [{ label: long(25) }, {}] }, false],
  ['court 0', one({ type: 'cone', x: 1, y: 1, court: 0 }), false],
  ['court 1.5', one({ type: 'cone', x: 1, y: 1, court: 1.5 }), false],
  ['player note too long', one({ type: 'player', x: 1, y: 1, note: long(17) }), false],
  ['ghost as text', one({ type: 'player', x: 1, y: 1, ghost: 'yes' }), false],
  ['cone label too long', one({ type: 'cone', x: 1, y: 1, label: long(7) }), false],
  ['unknown path color', one({ ...ball, color: 'purple' }), false],
  ['alt in capitals', one({ ...ball, alt: 'A' }), false],
  ['alt of two letters', one({ ...ball, alt: 'ab' }), false],
  ['mark without a key', one({ type: 'mark', x: 5, y: 5 }), false],
  ['empty key', one({ type: 'cone', x: 1, y: 1, key: '' }), false],
  ['line missing end', one({ type: 'line', x1: 0, y1: 33, x2: 20 }), false],

  ['not an object', [1], false],
  ['wrong format', { ...base, format: 'x' }, false],
  ['future version', { ...base, version: 2 }, false],
  ['no items', { format: 'drill-diagram', version: 1 }, false],
  ['items not a list', { ...base, items: 5 }, false],
  ['bad view', { ...base, view: 'wide' }, false],
  ['bad side', { ...base, side: 'left' }, false],
  ['bad orient', { ...base, orient: 'x' }, false],
  ['title not text', { ...base, title: 4 }, false],
  ['title too long', { ...base, title: long(121) }, false],
  ['caption too long', { ...base, caption: long(301) }, false],
  ['201 items', { ...base, items: Array.from({ length: LIMITS.maxItems + 1 }, () => ({ type: 'cone', x: 1, y: 1 })) }, false],
  ['item not an object', one('cone'), false],
  ['unknown type', one({ type: 'net', x: 1, y: 1 }), false],
  ['x as text', one({ type: 'cone', x: '1', y: 1 }), false],
  ['missing y', one({ type: 'cone', x: 1 }), false],
  ['x past margin', one({ type: 'cone', x: 22.01, y: 1 }), false],
  ['y past margin', one({ type: 'cone', x: 1, y: -2.01 }), false],
  ['player label too long', one({ type: 'player', x: 1, y: 1, label: long(9) }), false],
  ['zone label too long', one({ type: 'zone', x: 1, y: 1, w: 3, h: 3, label: long(25) }), false],
  ['unknown team', one({ type: 'player', x: 1, y: 1, team: 'green' }), false],
  ['zone too narrow', one({ type: 'zone', x: 1, y: 1, w: 0.99, h: 3 }), false],
  ['zone too long', one({ type: 'zone', x: 1, y: 1, w: 3, h: 44.5 }), false],
  ['shot number 201', one({ ...ball, n: 201 }), false],
  ['title with a control character', { ...base, title: 'a\u0007b' }, false],
  ['title with a newline', { ...base, title: 'a\nb' }, false],
  ['caption with a control character', { ...base, caption: 'a\u0001' }, false],
  ['caption with a null', { ...base, caption: '\u0000' }, false],
  ['label with a control character', one({ type: 'player', x: 1, y: 1, label: '\u0001' }), false],
  ['zone label with a lone surrogate', one({ type: 'zone', x: 1, y: 1, w: 3, h: 3, label: '\ud800' }), false],
  ['title with a lone low surrogate', { ...base, title: 'x\udc00' }, false],
  ['title with U+FFFF', { ...base, title: '\uffff' }, false],
  ['title with DEL', { ...base, title: '\u007f' }, false],
  ['angle 360', one({ type: 'machine', x: 1, y: 1, angle: 360 }), false],
  ['negative angle', one({ type: 'machine', x: 1, y: 1, angle: -1 }), false],
  ['bend 0', one({ ...ball, bend: 0 }), false],
  ['curve as text', one({ ...ball, curve: 'yes' }), false],
  ['shot 0', one({ ...ball, n: 0 }), false],
  ['shot 1.5', one({ ...ball, n: 1.5 }), false],
  ['no shot number', one({ type: 'ball', x1: 1, y1: 1, x2: 2, y2: 2 }), false],
  ['move missing end', one({ type: 'move', x1: 1, y1: 1, x2: 2 }), false],
];

describe('JSON Schema and validator agree', () => {
  it.each(samples)('%s', (_name, value, good) => {
    expect(validate(value)).toBe(good);
    expect(parseSource(value).ok).toBe(good);
  });

  it('compiles as shipped, with a real $id', () => {
    expect((schema as { $id: string }).$id).toBe('https://maikuru.github.io/drillplot/schema/drill-diagram.v1.schema.json');
    expect(() => new Ajv2020({ strict: true }).compile(schema)).not.toThrow();
  });

  it('the reader alone checks a court number against the number of courts', () => {
    const doc = { ...base, courts: [{}, {}], items: [{ type: 'cone', x: 1, y: 1, court: 3 }] };
    expect(validate(doc)).toBe(true);
    expect(parseSource(doc).ok === false && parseSource(doc)).toMatchObject({ errors: [{ key: 'bad_court', path: '/items/0/court' }] });
  });
});
