import { describe, expect, it } from 'vitest';
import { parseSource, parseText, renderSvg, sampleDrill, toGrey, type DrillSource } from '../src/index.js';

const landscape = (): DrillSource => ({ ...sampleDrill(), orient: 'landscape' });

describe('renderSvg snapshots', () => {
  it('sample, portrait', () => {
    expect(renderSvg(sampleDrill())).toMatchSnapshot();
  });
  it('sample, landscape', () => {
    expect(renderSvg(landscape())).toMatchSnapshot();
  });
  it('sample, greyscale', () => {
    expect(renderSvg(sampleDrill(), { greyscale: true })).toMatchSnapshot();
  });
  it('sample, landscape greyscale', () => {
    expect(renderSvg(landscape(), { greyscale: true })).toMatchSnapshot();
  });
  it('half court, top, and kitchen views', () => {
    expect(renderSvg({ ...sampleDrill(), view: 'half', side: 'top' })).toMatchSnapshot();
    expect(renderSvg({ ...sampleDrill(), view: 'kitchen' })).toMatchSnapshot();
  });
});

describe('renderSvg properties', () => {
  it('is deterministic', () => {
    expect(renderSvg(sampleDrill())).toBe(renderSvg(sampleDrill()));
  });

  it('has a viewBox, title, desc and no ids or classes that could clash', () => {
    const svg = renderSvg(sampleDrill());
    expect(svg).toContain('viewBox="-2.5 -2.5 25 49"');
    expect(svg).toContain('<title>Third-shot drop and walk in</title>');
    expect(svg).toContain('<desc>');
    expect(svg).not.toMatch(/\sid=/);
    expect(svg).not.toMatch(/\sclass=/);
    expect(svg).not.toMatch(/<style|currentColor|url\(#/);
  });

  it('landscape swaps the box and keeps text upright', () => {
    const svg = renderSvg(landscape());
    expect(svg).toContain('viewBox="-2.5 -22.5 49 25"');
    expect(svg).toContain('rotate(-90)');
    expect(svg).toContain('rotate(90 ');
  });

  it('omits desc without a caption and titles an untitled drill', () => {
    const svg = renderSvg({ ...sampleDrill(), title: '', caption: '' });
    expect(svg).not.toContain('<desc>');
    expect(svg).toContain('<title>Drill diagram</title>');
  });

  it('escapes markup in labels, title and caption everywhere', () => {
    const src: DrillSource = {
      ...sampleDrill(),
      title: '"><script>x</script>',
      caption: '<img src=x onerror=1>',
      items: [{ type: 'player', x: 5, y: 5, label: '<b>&', team: 'blue' }, { type: 'zone', x: 1, y: 1, w: 3, h: 3, label: '</text><g>' }],
    };
    const svg = renderSvg(src);
    expect(svg).not.toContain('<script');
    expect(svg).not.toContain('<img');
    expect(svg).not.toContain('<b>');
    expect(svg).not.toContain('</text><g>');
    expect(svg.match(/<svg/g)).toHaveLength(1);
  });

  it('the greyscale option only touches fills: the default export keeps its colors', () => {
    const color = renderSvg(sampleDrill());
    const grey = renderSvg(sampleDrill(), { greyscale: true });
    expect(color).toContain('#e69f00');
    expect(color).toContain('#0072b2');
    expect(grey).not.toContain('#e69f00');
    expect(grey).not.toContain('#0072b2');
    // the embedded source is identical either way
    expect(grey.match(/<metadata>[\s\S]*<\/metadata>/)?.[0]).toBe(color.match(/<metadata>[\s\S]*<\/metadata>/)?.[0]);
  });

  it('keeps the four player colors apart in lightness', () => {
    const lum = (hex: string) => parseInt(toGrey(hex).slice(1, 3), 16);
    const [w, o, b, k] = [lum('#ffffff'), lum('#e69f00'), lum('#0072b2'), lum('#1a1a1a')];
    expect(w).toBeGreaterThan(o);
    expect(o).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(k);
    expect(Math.min(w - o, o - b, b - k)).toBeGreaterThan(30);
  });
});

describe('open from SVG', () => {
  it('reads the source back out of an exported SVG', () => {
    const src = sampleDrill();
    const r = parseText(renderSvg(src));
    expect(r).toEqual({ ok: true, source: src });
  });

  it('survives markup, ampersands and the close of a CDATA block in the source', () => {
    const src: DrillSource = { ...sampleDrill(), title: 'a <b> & ]]> "c"', caption: '</metadata><svg>' };
    const svg = renderSvg(src);
    expect(svg.match(/<\/metadata>/g)).toHaveLength(1);
    expect(parseText(svg)).toEqual({ ok: true, source: src });
  });

  it('every orientation and greyscale give the same source back', () => {
    for (const s of [sampleDrill(), landscape()]) {
      for (const greyscale of [false, true]) expect(parseText(renderSvg(s, { greyscale }))).toEqual({ ok: true, source: s });
    }
  });

  it('opens the earlier concept export (CDATA, ids, older team keys)', () => {
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg"><metadata><![CDATA[{"format":"drill-diagram","version":1,"title":"Old","caption":"","view":"full","side":"bottom","orient":"portrait","items":[{"id":"i1","type":"player","x":7,"y":40,"label":"A","team":"t1"},{"id":"i2","type":"player","x":3,"y":4,"label":"C","team":"coach"}]}]]></metadata></svg>';
    const r = parseText(svg);
    expect(r.ok && r.source.items).toEqual([
      { type: 'player', x: 7, y: 40, label: 'A', team: 'orange' },
      { type: 'player', x: 3, y: 4, label: 'C', team: 'black' },
    ]);
  });

  it('refuses an SVG without a source, with a key', () => {
    const r = parseText('<svg xmlns="http://www.w3.org/2000/svg"><title>x</title></svg>');
    expect(r.ok === false && r.errors[0]?.key).toBe('no_svg_source');
  });

  it('refuses a damaged source, with a key', () => {
    const r = parseText('<svg><metadata>{not json</metadata></svg>');
    expect(r.ok === false && r.errors[0]?.key).toBe('bad_svg_source');
  });

  it('refuses an SVG whose source is not a drill', () => {
    const r = parseText('<svg><metadata>{"format":"other"}</metadata></svg>');
    expect(r.ok === false && r.errors.map((e) => e.key)).toContain('wrong_format');
  });

  it('the exported SVG validates as a document', () => {
    expect(parseSource(sampleDrill()).ok).toBe(true);
  });
});
