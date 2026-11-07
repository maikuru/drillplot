import { readdirSync, readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { describe, expect, it } from 'vitest';
import { drawOrder, parseSource, parseText, renderSvg, sampleDrill, stringifySource, type DrillSource, type Item, type Player } from '../src/index.js';
import { itemMarkup, itemsMarkup } from '../src/render/markup.js';

/* The 0.3 additions: tethers, moments, named regions, handedness, and the single-court clipping fix. */
const dir = new URL('./fixtures/additions/', import.meta.url);
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
const player = (x: number, y: number, extra: Partial<Player> = {}): Player => ({ type: 'player', x, y, label: 'A', team: 'orange', ...extra });
const ctx = { orient: 'portrait' as const, greyscale: false };
/** The court part of a drawing: everything after the embedded source. */
const drawing = (svg: string): string => svg.slice(svg.indexOf('</metadata>'));

describe('fixture diagrams of the additions', () => {
  it.each(fixtures)('%s validates against the validator and the schema', (_name, doc) => {
    expect(parseSource(doc).ok).toBe(true);
    expect(validate(doc)).toBe(true);
  });

  it.each(fixtures)('%s matches its SVG snapshot', async (name, doc) => {
    await expect(renderSvg(parsed(doc))).toMatchFileSnapshot(`./fixtures/additions-svg/${name}.svg`);
    await expect(renderSvg(parsed(doc), { greyscale: true })).toMatchFileSnapshot(`./fixtures/additions-svg/${name}.grey.svg`);
  });

  it.each(fixtures)('%s reopens from its SVG with nothing lost', (_name, doc) => {
    const src = parsed(doc);
    expect(parseText(renderSvg(src))).toEqual({ ok: true, source: src });
    expect(parseSource(stringifySource(src))).toEqual({ ok: true, source: src });
  });

  it.each(fixtures)('%s has no ids, classes, styles or references', (_name, doc) => {
    expect(renderSvg(parsed(doc))).not.toMatch(/\sid=|\sclass=|<style|currentColor|url\(#/);
  });
});

describe('tethers', () => {
  const pair = (dx = 0): Item[] => [player(4 + dx, 30, { tether: 'AB' }), player(12 + dx, 30, { label: 'B', tether: 'AB' })];

  it('joins two players edge to edge, in the first one’s team color, under the players', () => {
    const svg = renderSvg(withItems(pair()));
    expect(svg).toContain('<path d="M5.3 30L10.7 30" fill="none" stroke="#ffffff" stroke-width="0.62" stroke-linecap="round"/>');
    expect(svg).toContain('<path d="M5.3 30L10.7 30" fill="none" stroke="#e69f00" stroke-width="0.34" stroke-linecap="round"/>');
    expect(svg.indexOf('stroke-width="0.62"')).toBeLessThan(svg.indexOf('r="1.3"'));
  });

  it('follows the players when they move', () => {
    expect(renderSvg(withItems(pair(3)))).toContain('<path d="M8.3 30L13.7 30"');
  });

  it('needs the same name, the same moment and the same court', () => {
    const none = (items: Item[], extra: Partial<DrillSource> = {}) => expect(renderSvg(withItems(items, extra))).not.toContain('stroke-width="0.62"');
    none([player(4, 30, { tether: 'AB' }), player(12, 30, { tether: 'CD' })]);
    none([player(4, 30, { tether: 'AB', moment: 1 }), player(12, 30, { tether: 'AB', moment: 2 })]);
    none([player(4, 30, { tether: 'AB' }), player(12, 30, { tether: 'AB', court: 2 })], { courts: [{}, {}] });
    none([player(4, 30, { tether: 'AB' })]);
    none([player(4, 30, { tether: 'AB' }), player(5, 30, { tether: 'AB' })]); // discs touching
  });

  it('fades with an earlier moment', () => {
    const svg = renderSvg(withItems([...pair().map((p) => ({ ...p, moment: 1 })), player(4, 40, { moment: 2 })]));
    expect(svg).toContain('<g opacity="0.45"><path d="M5.3 30L10.7 30"');
  });

  it('refuses a third player with the same tether on one court in one moment', () => {
    const r = parseSource(withItems([...pair(), player(18, 30, { tether: 'AB' }), player(18, 40, { tether: 'AB', moment: 1 })]));
    expect(r.ok === false && r.errors.map((e) => `${e.key} ${e.path}`)).toEqual(['bad_tether /items/2/tether']);
  });

  it('draws a legend swatch of a tether', () => {
    const svg = renderSvg({ ...sampleDrill(), legend: [{ tether: 'blue', text: 'The tether' }] });
    expect(svg).toMatch(/<rect [^>]*width="1.7" height="0.9" rx="0.15" fill="#2b6ca3"\/><path [^>]*stroke="#ffffff" stroke-width="0.62"[^>]*\/><path [^>]*stroke="#0072b2"/);
  });
});

describe('moments', () => {
  const ball: Item = { type: 'ball', x1: 1, y1: 40, x2: 10, y2: 10, curve: false, bend: 1, n: 1 };

  it('fades items of an earlier moment and leaves the latest and the timeless as they were', () => {
    const items: Item[] = [{ ...ball, moment: 1 }, { ...ball, n: 2, moment: 2 }, { ...ball, n: 3 }];
    const svg = renderSvg(withItems(items));
    expect(svg).toContain(`<g opacity="0.45">${itemMarkup(ball, ctx)}</g>`);
    expect(svg).toContain(itemMarkup({ ...ball, n: 2 }, ctx));
    expect(svg.match(/opacity="0.45"/g)).toHaveLength(1);
  });

  it('draws nothing faded when every item is in the same moment', () => {
    const svg = renderSvg(withItems([{ ...ball, moment: 3 }, player(5, 30, { moment: 3 })]));
    expect(drawing(svg)).toBe(drawing(renderSvg(withItems([ball, player(5, 30)]))));
  });

  it('draws a player of an earlier moment as a ring in its team color', () => {
    const svg = renderSvg(withItems([player(5, 30, { team: 'blue', moment: 1 }), player(9, 30, { moment: 2 })]));
    expect(svg).toContain('<circle cx="5" cy="30" r="1.1" fill="#0072b2" fill-opacity="0.2" stroke="#0072b2" stroke-width="0.4"/>');
    expect(svg).toContain('<circle cx="5" cy="30" r="1.3" fill="none" stroke="#ffffff" stroke-width="0.16" stroke-dasharray="0.45 0.35"/>');
  });

  it('keeps a ghost’s team color in a moment; a ghost with no moment stays the white ring of 0.2', () => {
    const inMoment = renderSvg(withItems([player(5, 30, { team: 'blue', ghost: true, moment: 1 })]));
    expect(inMoment).toContain('fill="#0072b2" fill-opacity="0.2"');
    const plain = renderSvg(withItems([player(5, 30, { team: 'blue', ghost: true })]));
    expect(plain).toContain('r="1.3" fill="none" stroke="#ffffff" stroke-width="0.18" stroke-dasharray="0.45 0.35"');
    expect(plain).not.toContain('#0072b2');
  });

  it('takes the latest moment court by court', () => {
    const svg = renderSvg(withItems([{ ...ball, moment: 1 }, { ...ball, moment: 2, court: 2 }], { courts: [{}, {}] }));
    expect(svg).not.toContain('opacity="0.45"');
  });

  it('refuses a moment that is not a whole number from 1 to 9', () => {
    for (const moment of [0, 10, 1.5, '1']) {
      const r = parseSource(withItems([{ ...ball, moment } as unknown as Item]));
      expect(r.ok === false && r.errors[0]).toMatchObject({ key: 'bad_moment', path: '/items/0/moment' });
    }
  });
});

describe('named regions', () => {
  const band: Item = { type: 'region', x: 0, y: 29, w: 20, h: 2.5, label: 'at the kitchen' };

  it('is a neutral box, not the orange of a target zone, under everything else', () => {
    const svg = renderSvg(withItems([player(5, 30), band]));
    expect(svg).toContain('<rect x="0" y="29" width="20" height="2.5" fill="#ffffff" fill-opacity="0.12" stroke="#ffffff" stroke-opacity="0.7" stroke-width="0.12"/>');
    expect(svg).not.toContain('#ff922b');
    expect(svg.indexOf('fill-opacity="0.12"')).toBeLessThan(svg.indexOf('cx="5" cy="30"'));
  });

  it('places its label where asked', () => {
    const at = (labelAt: string) => renderSvg(withItems([{ ...band, labelAt } as Item]));
    expect(at('center')).toContain('<text x="10" y="30.25" dy="0.35em" font-size="1"');
    expect(at('left')).toMatch(/<text x="0.6" y="30.25"[^>]*text-anchor="start"/);
    expect(at('top-right')).toMatch(/<text x="19.4" y="29.9"[^>]*text-anchor="end"/);
    expect(at('bottom')).toMatch(/<text x="10" y="30.6"[^>]*text-anchor="middle"/);
  });

  it('places the label on the page side in landscape, upright', () => {
    // court x 0..20, y 29..31.5 is page x 29..31.5, y -20..0 in landscape; page left is court y 29.6
    const svg = renderSvg(withItems([{ ...band, labelAt: 'left' } as Item], { orient: 'landscape' }));
    expect(svg).toContain('<text x="10" y="29.6"');
    expect(svg).toContain('transform="rotate(90 10 29.6)">at the kitchen</text>');
  });

  it('with mirror, is one item for a band on both halves', () => {
    const svg = renderSvg(withItems([{ ...band, mirror: true } as Item]));
    expect(svg).toContain('<rect x="0" y="29" width="20" height="2.5"');
    expect(svg).toContain('<rect x="0" y="12.5" width="20" height="2.5"');
    expect(svg.match(/>at the kitchen<\/text>/g)).toHaveLength(2);
  });

  it('refuses a bad label position and a bad size', () => {
    const r = parseSource(withItems([{ ...band, labelAt: 'middle', w: 30 } as unknown as Item]));
    expect(r.ok === false && r.errors.map((e) => `${e.key} ${e.path}`)).toEqual(['bad_size /items/0/w', 'bad_label_position /items/0/labelAt']);
  });
});

describe('handedness', () => {
  const paddleX = (p: Player): number => Number(/<ellipse cx="([\d.-]+)"/.exec(renderSvg(withItems([p])))?.[1]);

  it('draws a paddle on the forehand side, facing the net', () => {
    expect(paddleX(player(10, 30, { hand: 'right' }))).toBe(11.97); // near half faces up the page
    expect(paddleX(player(10, 30, { hand: 'left' }))).toBe(8.03);
    expect(paddleX(player(10, 14, { hand: 'right' }))).toBe(8.03); // far half faces down the page
    expect(paddleX(player(10, 14, { hand: 'left' }))).toBe(11.97);
  });

  it('draws nothing without a hand, and refuses an unknown one', () => {
    expect(renderSvg(withItems([player(10, 30)]))).not.toContain('<ellipse');
    const r = parseSource(withItems([player(10, 30, { hand: 'both' as 'right' })]));
    expect(r.ok === false && r.errors[0]).toMatchObject({ key: 'bad_hand', path: '/items/0/hand' });
  });
});

describe('a single court with a legend or caption is clipped to its frame', () => {
  // the bug: in a kitchen or half view, the court and its pieces ran on under the legend
  it.each(['kitchen', 'half'] as const)('%s view', (view) => {
    const svg = renderSvg({ ...sampleDrill(), view, legend: [{ key: '1', text: 'x' }] });
    const v = view === 'kitchen' ? '-2.5 13 25 18' : '-2.5 19.5 25 27';
    expect(svg).toContain(`<svg x="${v.split(' ')[0]}" y="${v.split(' ')[1]}" width="25" height="${v.split(' ')[3]}" viewBox="${v}">`);
    expect(svg.match(/<svg/g)).toHaveLength(2);
    expect(renderSvg({ ...sampleDrill(), view, showCaption: true })).toContain(`viewBox="${v}">`);
  });

  it('a full view, and any view without a footer, draw as before', () => {
    expect(renderSvg({ ...sampleDrill(), legend: [{ key: '1', text: 'x' }] }).match(/<svg/g)).toHaveLength(1);
    expect(renderSvg({ ...sampleDrill(), view: 'kitchen' }).match(/<svg/g)).toHaveLength(1);
  });
});

describe('compatibility of the additions', () => {
  it('with no moment and no tether, the items draw exactly as drawOrder and itemMarkup did', () => {
    const items = sampleDrill().items;
    expect(itemsMarkup(items, ctx)).toEqual(drawOrder(items).map((it) => itemMarkup(it, ctx)));
  });

  it('writes the new fields after the older ones, in a fixed order', () => {
    const r = parseSource({
      format: 'drill-diagram',
      version: 1,
      legend: [{ text: 'x', tether: 'blue' }],
      items: [
        { moment: 2, tether: 'p', hand: 'left', key: 'k', type: 'player', x: 1, y: 1 },
        { mirror: true, labelAt: 'top', type: 'region', x: 0, y: 0, w: 20, h: 2, mirror_: 1 },
      ],
    });
    expect(r.ok && r.source.items).toEqual([
      { type: 'player', x: 1, y: 1, label: '', team: 'orange', key: 'k', hand: 'left', tether: 'p', moment: 2 },
      { type: 'region', x: 0, y: 0, w: 20, h: 2, label: '', labelAt: 'top', mirror: true },
    ]);
    expect(r.ok && stringifySource(r.source)).toContain('"key": "k",\n   "hand": "left",\n   "tether": "p",\n   "moment": 2');
    expect(r.ok && r.source.legend).toEqual([{ tether: 'blue', text: 'x' }]);
  });
});
