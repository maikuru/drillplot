// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { parseSource, renderSvg, sampleDrill } from '../src/index.js';

const wellFormed = (svg: string): boolean => {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
  return doc.getElementsByTagName('parsererror').length === 0;
};

describe('exported SVG is well-formed XML', () => {
  it('for the sample, in every orientation and view', () => {
    for (const orient of ['portrait', 'landscape'] as const)
      for (const view of ['full', 'half', 'kitchen'] as const) expect(wellFormed(renderSvg({ ...sampleDrill(), orient, view }))).toBe(true);
  });

  it('for hostile but valid text', () => {
    const r = parseSource({
      ...sampleDrill(),
      title: '"><script>&amp;</script>',
      caption: 'line one\n\tline two ]]> </metadata>',
      items: [{ type: 'player', x: 1, y: 1, label: '<&>', team: 'white' }],
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(wellFormed(renderSvg(r.source))).toBe(true);
  });

  it('the validator refuses what would break it', () => {
    for (const title of ['a\u0007b', '\u0001', '\ud800', '￿']) {
      expect(parseSource({ ...sampleDrill(), title }).ok).toBe(false);
      expect(wellFormed(renderSvg({ ...sampleDrill(), title }))).toBe(true); // and esc strips it anyway
    }
  });
});
