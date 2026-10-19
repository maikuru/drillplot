import { describe, expect, it } from 'vitest';
import { LIMITS, parseSource, parseText, sampleDrill, stringifySource, validateSource, type ErrorKey } from '../src/index.js';

const base = { format: 'drill-diagram', version: 1, items: [] };
const withItem = (item: unknown) => ({ ...base, items: [item] });

describe('round trip', () => {
  it('the sample survives stringify then parse unchanged', () => {
    const sample = sampleDrill();
    const r = parseSource(stringifySource(sample));
    expect(r).toEqual({ ok: true, source: sample });
  });

  it('fills defaults for optional fields', () => {
    const r = parseSource(base);
    expect(r).toEqual({
      ok: true,
      source: { format: 'drill-diagram', version: 1, title: '', caption: '', view: 'full', side: 'bottom', orient: 'portrait', items: [] },
    });
  });

  it('drops unknown properties, including the ids older exports carried', () => {
    const r = parseSource(withItem({ id: 'i7', type: 'cone', x: 1, y: 2, color: 'red' }));
    expect(r.ok && r.source.items).toEqual([{ type: 'cone', x: 1, y: 2 }]);
  });

  it('rounds positions to hundredths', () => {
    const r = parseSource(withItem({ type: 'cone', x: 1.23456, y: 2 }));
    expect(r.ok && r.source.items[0]).toEqual({ type: 'cone', x: 1.23, y: 2 });
  });
});

describe('older team keys', () => {
  it.each([
    ['t1', 'orange'],
    ['t2', 'blue'],
    ['coach', 'black'],
    ['white', 'white'],
  ])('%s opens as %s', (old, now) => {
    const r = parseSource(withItem({ type: 'player', x: 5, y: 5, label: 'A', team: old }));
    expect(r.ok && r.source.items[0]).toMatchObject({ team: now });
  });

  it('a missing team is orange', () => {
    const r = parseSource(withItem({ type: 'player', x: 5, y: 5 }));
    expect(r.ok && r.source.items[0]).toMatchObject({ team: 'orange', label: '' });
  });

  it('a name that is not an own key does not leak through the prototype', () => {
    expect(validateSource(withItem({ type: 'player', x: 5, y: 5, team: 'constructor' })).map((e) => e.key)).toEqual(['bad_team']);
  });
});

describe('labels are text', () => {
  it('markup in a label is kept as given, for the renderer to escape', () => {
    const r = parseSource(withItem({ type: 'player', x: 5, y: 5, label: '<b>&' }));
    expect(r.ok && r.source.items[0]).toMatchObject({ label: '<b>&' });
  });
});

const long = (n: number) => 'x'.repeat(n);
const refusals: Array<[ErrorKey, string, unknown]> = [
  ['not_json', '', '{nope'],
  ['not_an_object', '', [1]],
  ['not_an_object', '', null],
  ['wrong_format', '/format', { ...base, format: 'other' }],
  ['unsupported_version', '/version', { ...base, version: 2 }],
  ['not_text', '/title', { ...base, title: 3 }],
  ['title_too_long', '/title', { ...base, title: long(LIMITS.titleLength + 1) }],
  ['caption_too_long', '/caption', { ...base, caption: long(LIMITS.captionLength + 1) }],
  ['bad_view', '/view', { ...base, view: 'wide' }],
  ['bad_side', '/side', { ...base, side: 'left' }],
  ['bad_orient', '/orient', { ...base, orient: 'diagonal' }],
  ['items_not_array', '/items', { ...base, items: {} }],
  ['items_not_array', '/items', { format: 'drill-diagram', version: 1 }],
  ['too_many_items', '/items', { ...base, items: Array.from({ length: LIMITS.maxItems + 1 }, () => ({ type: 'cone', x: 1, y: 1 })) }],
  ['item_not_object', '/items/0', withItem('cone')],
  ['unknown_item_type', '/items/0/type', withItem({ type: 'net', x: 1, y: 1 })],
  ['not_a_number', '/items/0/x', withItem({ type: 'cone', x: '1', y: 1 })],
  ['not_a_number', '/items/0/y', withItem({ type: 'cone', x: 1 })],
  ['out_of_bounds', '/items/0/x', withItem({ type: 'cone', x: 22.5, y: 1 })],
  ['out_of_bounds', '/items/0/y', withItem({ type: 'cone', x: 1, y: -2.5 })],
  ['label_too_long', '/items/0/label', withItem({ type: 'player', x: 1, y: 1, label: long(LIMITS.playerLabelLength + 1) })],
  ['label_too_long', '/items/0/label', withItem({ type: 'zone', x: 1, y: 1, w: 3, h: 3, label: long(LIMITS.zoneLabelLength + 1) })],
  ['bad_team', '/items/0/team', withItem({ type: 'player', x: 1, y: 1, team: 'green' })],
  ['bad_size', '/items/0/w', withItem({ type: 'zone', x: 1, y: 1, w: 0.5, h: 3 })],
  ['bad_size', '/items/0/h', withItem({ type: 'zone', x: 1, y: 1, w: 3, h: 45 })],
  ['bad_angle', '/items/0/angle', withItem({ type: 'machine', x: 1, y: 1, angle: 360 })],
  ['bad_bend', '/items/0/bend', withItem({ type: 'ball', x1: 1, y1: 1, x2: 2, y2: 2, n: 1, bend: 0 })],
  ['bad_shot_number', '/items/0/n', withItem({ type: 'ball', x1: 1, y1: 1, x2: 2, y2: 2, n: 0 })],
  ['bad_shot_number', '/items/0/n', withItem({ type: 'ball', x1: 1, y1: 1, x2: 2, y2: 2 })],
  ['not_boolean', '/items/0/curve', withItem({ type: 'ball', x1: 1, y1: 1, x2: 2, y2: 2, n: 1, curve: 'yes' })],
];

describe('validation refusals', () => {
  it.each(refusals)('%s at %s', (key, path, input) => {
    const r = parseSource(input);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.map((e) => [e.key, e.path])).toContainEqual([key, path]);
  });

  it('reports every problem, not only the first', () => {
    const r = parseSource({ ...base, view: 'x', side: 'y', items: [{ type: 'cone', x: 99, y: 99 }] });
    expect(r.ok === false && r.errors.map((e) => e.key)).toEqual(['bad_view', 'bad_side', 'out_of_bounds', 'out_of_bounds']);
  });

  it('every error has a human message', () => {
    for (const [, , input] of refusals) {
      const r = parseSource(input);
      if (!r.ok) for (const e of r.errors) expect(e.message.length).toBeGreaterThan(5);
    }
  });

  it('accepts the exact edges', () => {
    expect(validateSource(withItem({ type: 'cone', x: -2, y: 46 }))).toEqual([]);
    expect(validateSource(withItem({ type: 'zone', x: 22, y: -2, w: 20, h: 44, label: long(24) }))).toEqual([]);
    expect(validateSource({ ...base, title: long(120), caption: long(300) })).toEqual([]);
    expect(validateSource(withItem({ type: 'machine', x: 1, y: 1, angle: 359.99 }))).toEqual([]);
  });

  it('counts characters, not UTF-16 units', () => {
    expect(validateSource(withItem({ type: 'player', x: 1, y: 1, label: '🎾'.repeat(8) }))).toEqual([]);
  });
});

describe('parseText', () => {
  it('refuses empty input with a key', () => {
    const r = parseText('   ');
    expect(r.ok === false && r.errors[0]?.key).toBe('empty_input');
  });
});
