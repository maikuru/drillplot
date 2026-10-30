import { readdirSync, readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { parseSource, parseText, renderSvg, sampleDrill, stringifySource, type DrillSource, type Item } from '../src/index.js';

/* The 0.2 additions: generic diagrams rebuilt from real drill handouts, and one test per feature. */
const dir = new URL('./fixtures/v2/', import.meta.url);
const schema = JSON.parse(readFileSync(new URL('../schema/drill-diagram.v1.schema.json', import.meta.url), 'utf8')) as object;
const validate = new Ajv2020({ allErrors: true, strict: true }).compile(schema);
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f): [string, unknown] => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(new URL(f, dir), 'utf8'))]);

const parsed = (doc: unknown): DrillSource => {
  const r = parseSource(doc);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.source;
};
const withItems = (items: Item[], extra: Partial<DrillSource> = {}): DrillSource => ({ ...sampleDrill(), items, ...extra });

describe('0.2 fixture diagrams', () => {
  it.each(fixtures)('%s validates against the validator and the schema', (_name, doc) => {
    expect(parseSource(doc).ok).toBe(true);
    expect(validate(doc)).toBe(true);
  });

  it.each(fixtures)('%s matches its SVG snapshot', async (name, doc) => {
    await expect(renderSvg(parsed(doc))).toMatchFileSnapshot(`./fixtures/v2-svg/${name}.svg`);
    await expect(renderSvg(parsed(doc), { greyscale: true })).toMatchFileSnapshot(`./fixtures/v2-svg/${name}.grey.svg`);
  });

  it.each(fixtures)('%s reopens from its SVG with nothing lost', (_name, doc) => {
    const src = parsed(doc);
    expect(parseText(renderSvg(src))).toEqual({ ok: true, source: src });
    expect(parseSource(stringifySource(src))).toEqual({ ok: true, source: src });
  });

  it.each(fixtures)('%s has no ids, classes, styles or references', (_name, doc) => {
    const svg = renderSvg(parsed(doc));
    expect(svg).not.toMatch(/\sid=|\sclass=|<style|currentColor|url\(#/);
  });
});

describe('legend (G1)', () => {
  it('draws each note under the court and grows the drawing to fit', () => {
    const base = renderSvg(sampleDrill());
    const svg = renderSvg({ ...sampleDrill(), legend: [{ key: '1', text: 'First' }, { key: 'X', text: 'Second' }] });
    expect(svg).toContain('>First</text>');
    expect(svg).toContain('>Second</text>');
    const h = (s: string) => Number(/viewBox="[^"]+ ([\d.]+)"/.exec(s)?.[1]);
    expect(h(svg)).toBeGreaterThan(h(base));
    expect(svg).toContain('fill="#ffffff"/>\n<g>');
  });

  it('a note keyed to a shot uses that shot badge; other keys use the white badge', () => {
    const svg = renderSvg({ ...sampleDrill(), legend: [{ key: '2', text: 'Shot two' }, { key: 'Q', text: 'Other' }] });
    const legendPart = svg.slice(svg.lastIndexOf('</g>'));
    expect(legendPart).toMatch(/r="0.85" fill="#1a1a1a" stroke="#e6f23a"/);
    expect(legendPart).toMatch(/r="0.75" fill="#ffffff" stroke="#1a1a1a"/);
  });

  it('draws a swatch for a note with a color and no key', () => {
    const svg = renderSvg({ ...sampleDrill(), legend: [{ color: 'red', text: 'Open space' }] });
    expect(svg).toMatch(/<rect [^>]*width="1.7" height="0.6" fill="#ff6a3d"/);
  });

  it('puts badges on players, cones, zones, machines, moves, lines and marks', () => {
    const items: Item[] = [
      { type: 'player', x: 5, y: 40, label: 'A', team: 'orange', key: 'p' },
      { type: 'cone', x: 2, y: 30, key: 'c' },
      { type: 'zone', x: 1, y: 1, w: 4, h: 4, label: '', key: 'z' },
      { type: 'machine', x: 10, y: 2, angle: 180, key: 'm' },
      { type: 'move', x1: 5, y1: 38, x2: 5, y2: 31, key: 'v' },
      { type: 'line', x1: 0, y1: 33, x2: 20, y2: 33, key: 'l' },
      { type: 'mark', x: 10, y: 20, key: 'k' },
    ];
    const svg = renderSvg(withItems(items));
    for (const k of ['p', 'c', 'z', 'm', 'v', 'l', 'k']) expect(svg).toContain(`>${k}</text>`);
  });

  it('wraps long notes and escapes them', () => {
    const text = 'a '.repeat(49) + '<b>';
    const svg = renderSvg({ ...sampleDrill(), legend: [{ key: '1', text }] });
    expect(svg).not.toContain('<b>');
    expect(svg.match(/font-size="1" fill="#1a1a1a"/g)!.length).toBeGreaterThan(1);
  });
});

describe('lines, path styles, ghosts, notes and labels (G2 to G5, G9)', () => {
  it('draws a line with no arrowhead, dashed and colored, with its label', () => {
    const svg = renderSvg(withItems([{ type: 'line', x1: 0, y1: 33, x2: 20, y2: 33, color: 'yellow', dash: true, label: 'Split' }]));
    expect(svg).toContain('<path d="M0 33L20 33" fill="none" stroke="#e6f23a" stroke-width="0.24" stroke-dasharray="0.8 0.6"/>');
    expect(svg).toContain('>Split</text>');
    expect(svg).not.toContain('<polygon points="20,33');
  });

  it('colors and dashes a ball path, its head and its badge', () => {
    const svg = renderSvg(withItems([{ type: 'ball', x1: 1, y1: 40, x2: 10, y2: 10, curve: false, bend: 1, n: 1, color: 'pink', dash: true }]));
    expect(svg).toContain('stroke="#ff8fd0" stroke-width="0.3" stroke-dasharray="0.8 0.6"');
    expect(svg).toMatch(/<polygon points="[^"]+" fill="#ff8fd0"\/>/);
    expect(svg).toMatch(/fill="#1a1a1a" stroke="#ff8fd0"/);
  });

  it('colors a movement arrow and keeps it dashed', () => {
    const svg = renderSvg(withItems([{ type: 'move', x1: 5, y1: 38, x2: 5, y2: 31, color: 'green' }]));
    expect(svg).toContain('stroke="#5fd38d" stroke-width="0.24" stroke-dasharray="0.7 0.55"');
  });

  it('a ball path with the default style draws exactly as in 0.1', () => {
    const plain: Item = { type: 'ball', x1: 1, y1: 40, x2: 10, y2: 10, curve: false, bend: 1, n: 1 };
    expect(renderSvg(withItems([{ ...plain, dash: undefined } as Item]))).toBe(renderSvg(withItems([plain])));
  });

  it('draws a ghost player as a dashed ring and a ghost zone as a dashed outline', () => {
    const svg = renderSvg(withItems([
      { type: 'player', x: 5, y: 40, label: 'A', team: 'blue', ghost: true },
      { type: 'zone', x: 1, y: 1, w: 7, h: 7, label: '', ghost: true },
    ]));
    expect(svg).toContain('r="1.3" fill="none" stroke="#ffffff" stroke-width="0.18" stroke-dasharray="0.45 0.35"');
    expect(svg).toContain('width="7" height="7" fill="none" stroke="#ff922b" stroke-width="0.2" stroke-dasharray="0.8 0.6"');
    expect(svg).not.toContain('#0072b2');
  });

  it('writes a note under a player and a label beside a cone, upright in landscape', () => {
    const items: Item[] = [{ type: 'player', x: 5, y: 40, label: 'A', team: 'orange', note: 'feeder' }, { type: 'cone', x: 2, y: 30, label: 'T1' }];
    const p = renderSvg(withItems(items));
    expect(p).toContain('<text x="5" y="42.05"');
    expect(p).toContain('>feeder</text>');
    expect(p).toContain('<text x="3.1" y="30"');
    const l = renderSvg(withItems(items, { orient: 'landscape' }));
    expect(l).toContain('<text x="2.95" y="40"');
    expect(l).toContain('transform="rotate(90 2.95 40)">feeder</text>');
  });
});

describe('alternatives (G6)', () => {
  it('labels either-or shots with their letter', () => {
    const svg = renderSvg(withItems([
      { type: 'ball', x1: 1, y1: 40, x2: 10, y2: 10, curve: false, bend: 1, n: 2, alt: 'a' },
      { type: 'ball', x1: 1, y1: 40, x2: 15, y2: 10, curve: true, bend: 1, n: 2, alt: 'b' },
    ]));
    expect(svg).toContain('>2a</text>');
    expect(svg).toContain('>2b</text>');
  });
});

describe('visible caption (G7)', () => {
  it('draws the caption only when asked, and keeps it in desc either way', () => {
    const off = renderSvg(sampleDrill());
    const on = renderSvg({ ...sampleDrill(), showCaption: true });
    expect(off).toBe(renderSvg({ ...sampleDrill(), showCaption: false }));
    expect(on).toContain('font-style="italic"');
    expect(on).toContain('<desc>');
    expect(on.slice(on.indexOf('</metadata>'))).toContain('D feeds from the kitchen line.');
  });

  it('keeps the caption line breaks and draws nothing for an empty caption', () => {
    const svg = renderSvg({ ...sampleDrill(), caption: 'one\ntwo', showCaption: true });
    expect(svg).toContain('>one</text>');
    expect(svg).toContain('>two</text>');
    const drawing = (src: DrillSource) => renderSvg(src).replace(/<metadata>[\s\S]*<\/metadata>/, '');
    expect(drawing({ ...sampleDrill(), caption: '', showCaption: true })).toBe(drawing({ ...sampleDrill(), caption: '' }));
  });
});

describe('several courts (G8)', () => {
  const two = (orient: DrillSource['orient']): DrillSource => ({
    ...sampleDrill(),
    orient,
    courts: [{ label: 'Court 1', link: 'Winner moves up' }, { label: 'Court 2' }],
    items: [
      { type: 'player', x: 5, y: 40, label: 'A', team: 'orange' },
      { type: 'player', x: 5, y: 40, label: 'B', team: 'blue', court: 2 },
    ],
  });

  it('draws each court in its own clipped viewport, side by side in portrait', () => {
    const svg = renderSvg(two('portrait'));
    expect(svg.match(/<svg x=/g)).toHaveLength(2);
    expect(svg).toContain('viewBox="-2.5 -4.7 56 51.2"');
    expect(svg).toContain('>Court 1</text>');
    expect(svg).toContain('>Winner</text>');
  });

  it('stacks the courts in landscape', () => {
    const svg = renderSvg(two('landscape'));
    expect(svg).toMatch(/viewBox="-2.5 -24.7 49 /);
    expect(svg).toContain('>Winner moves up</text>');
  });

  it('puts each item on its own court', () => {
    const svg = renderSvg(two('portrait'));
    const second = svg.slice(svg.lastIndexOf('<svg x='));
    expect(second).toContain('>B</text>');
    expect(second).not.toContain('>A</text>');
  });

  it('refuses an item on a court that does not exist', () => {
    const r = parseSource({ ...two('portrait'), items: [{ type: 'cone', x: 1, y: 1, court: 3 }] });
    expect(r.ok === false && r.errors[0]).toMatchObject({ key: 'bad_court', path: '/items/0/court' });
  });
});

describe('normalization of the 0.2 fields', () => {
  it('drops empty and false optional fields, and writes the rest in a fixed order', () => {
    const r = parseSource({
      format: 'drill-diagram',
      version: 1,
      legend: [{ text: 'x', key: '1' }],
      showCaption: false,
      items: [{ court: 1, ghost: false, note: '', key: 'k', type: 'player', x: 1, y: 1 }],
    });
    expect(r.ok && r.source).toEqual({
      format: 'drill-diagram', version: 1, title: '', caption: '', view: 'full', side: 'bottom', orient: 'portrait',
      legend: [{ key: '1', text: 'x' }],
      items: [{ type: 'player', x: 1, y: 1, label: '', team: 'orange', key: 'k', court: 1 }],
    });
    expect(r.ok && stringifySource(r.source)).toContain('"team": "orange",\n   "key": "k",\n   "court": 1');
  });

  it('reports each bad 0.2 field with its key and path', () => {
    const r = parseSource({
      format: 'drill-diagram',
      version: 1,
      courts: [],
      legend: 'x',
      items: [{ type: 'ball', x1: 1, y1: 1, x2: 2, y2: 2, n: 1, color: 'blue', alt: 'Z', dash: 1 }, { type: 'mark', x: 1, y: 1 }],
    });
    expect(r.ok === false && r.errors.map((e) => `${e.key} ${e.path}`)).toEqual([
      'bad_courts /courts',
      'bad_legend /legend',
      'bad_alt /items/0/alt',
      'bad_color /items/0/color',
      'not_boolean /items/0/dash',
      'bad_key /items/1/key',
    ]);
  });
});
