import { describe, expect, it } from 'vitest';
import { extractSourceText, parseText, renderSvg, sampleDrill } from '../src/index.js';

/* Reading the source out of pasted or uploaded SVG text, which is untrusted input. */
const meta = (s: string): string => `<svg>${s}</svg>`;
const ms = (fn: () => void): number => {
  const t = performance.now();
  fn();
  return performance.now() - t;
};

describe('extractSourceText', () => {
  it('reads plain, attributed, upper-case and CDATA metadata', () => {
    expect(extractSourceText(meta('<metadata>{"a":1}</metadata>'))).toBe('{"a":1}');
    expect(extractSourceText(meta('<metadata id="m">{"a":1}</metadata>'))).toBe('{"a":1}');
    expect(extractSourceText(meta('<METADATA>{"a":1}</Metadata>'))).toBe('{"a":1}');
    expect(extractSourceText(meta('<metadata><![CDATA[{"a":"<b>"}]]></metadata>'))).toBe('{"a":"<b>"}');
    expect(extractSourceText(meta('<metadata>a &amp;&lt; b</metadata>'))).toBe('a &< b');
  });

  it('skips metadata in a comment and comments in metadata', () => {
    expect(extractSourceText(meta('<!-- <metadata>no</metadata> --><metadata>yes</metadata>'))).toBe('yes');
    expect(extractSourceText(meta('<metadata>y<!-- </metadata> -->es</metadata>'))).toBe('yes');
  });

  it('ignores other elements and returns null when there is no source', () => {
    expect(extractSourceText(meta('<metadataX>no</metadataX>'))).toBeNull();
    expect(extractSourceText(meta('<metadata>  </metadata>'))).toBeNull();
    expect(extractSourceText(meta('<metadata>never closed'))).toBeNull();
    expect(extractSourceText('<!-- never closed <metadata>x</metadata>')).toBe('x');
  });

  it('reads back what renderSvg wrote, for text whose lower case is longer', () => {
    const src = { ...sampleDrill(), title: 'İİİ <metadata> İ' };
    expect(parseText(renderSvg(src))).toEqual({ ok: true, source: src });
    expect(extractSourceText('İİİİ<metadata>x</metadata>')).toBe('x');
  });

  it('never forms a comment by removing one', () => {
    // left to right, "<!" is text, then a whole comment, then text: the first metadata is not in a comment
    expect(extractSourceText('<!<!-- x -->-- <metadata>first</metadata> --><metadata>second</metadata>')).toBe('first');
  });

  // These inputs took time growing with the square of their length (CodeQL js/polynomial-redos):
  // 320 KB took about 4 seconds, a megabyte about 40.
  it.each([
    ['unclosed comments', '<' + '<!--'.repeat(250_000)],
    ['unclosed metadata', '<svg>' + '<metadata>'.repeat(100_000)],
    ['comments inside unclosed metadata', '<metadata>' + '<!---->'.repeat(150_000)],
    ['metadata tags without a ">"', '<metadata '.repeat(100_000)],
  ])('reads a megabyte of %s in linear time', (_name, input) => {
    expect(input.length).toBeGreaterThan(900_000);
    expect(ms(() => parseText(input))).toBeLessThan(250);
  });
});
