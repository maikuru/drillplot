import { errorMessage, parseSource } from './parse.js';
import type { DrillSource, ErrorKey, ParseResult } from './types.js';

const decodeEntities = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|lt|gt|amp|quot|apos);/gi, (m, e: string) => {
    const k = e.toLowerCase();
    if (k === 'lt') return '<';
    if (k === 'gt') return '>';
    if (k === 'amp') return '&';
    if (k === 'quot') return '"';
    if (k === 'apos') return "'";
    const code = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10);
    return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : m;
  });

/**
 * Pulls the embedded source text out of an SVG without a DOM, so it works in Node too.
 * Reads both escaped text and a CDATA section (the earlier concept's exports used CDATA).
 */
export function extractSourceText(svg: string): string | null {
  const raw = metadataText(svg);
  if (raw === null) return null;
  const inner = raw.trim();
  if (!inner) return null;
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(inner);
  return cdata && cdata[1] !== undefined ? cdata[1] : decodeEntities(inner);
}

/**
 * The text of the first <metadata> element outside an XML comment, with any comments inside it
 * left out. One left-to-right pass over the input, in linear time: no regular expression that
 * backtracks over untrusted text, and nothing is removed and searched again, so removing a
 * comment can never form a new one.
 */
function metadataText(svg: string): string | null {
  // a literal pattern, matched from a given position: no backtracking. (Lower-casing the input
  // instead would shift positions for the few characters whose lower case is longer.)
  const closeTag = /<\/metadata>/gi;
  const closeTagFrom = (p: number): number => {
    closeTag.lastIndex = p;
    return closeTag.exec(svg)?.index ?? -1;
  };
  // the next "-->" at or after a position, remembered so a run of unclosed comments stays linear
  let close = -2;
  const closeFrom = (p: number): number => {
    if (close !== -1 && close < p) close = svg.indexOf('-->', p);
    return close;
  };
  let i = 0;
  for (;;) {
    const lt = svg.indexOf('<', i);
    if (lt < 0) return null;
    if (svg.startsWith('<!--', lt)) {
      const end = closeFrom(lt + 4);
      // an unclosed comment is read as text, as before
      i = end < 0 ? lt + 4 : end + 3;
      continue;
    }
    const next = svg[lt + 9];
    if (svg.slice(lt, lt + 9).toLowerCase() === '<metadata' && next !== undefined && /[\s>]/.test(next)) {
      const open = svg.indexOf('>', lt + 9);
      if (open < 0) return null;
      let text = '';
      let j = open + 1;
      let end = closeTagFrom(j);
      for (;;) {
        if (end < 0) return null;
        const c = svg.indexOf('<!--', j);
        const cEnd = c >= 0 && c < end ? closeFrom(c + 4) : -1;
        if (cEnd < 0) return text + svg.slice(j, end);
        text += svg.slice(j, c);
        j = cEnd + 3;
        if (j > end) end = closeTagFrom(j);
      }
    }
    i = lt + 1;
  }
}

function fail(key: ErrorKey): ParseResult {
  return { ok: false, errors: [{ key, path: '', message: errorMessage(key) }] };
}

/** Opens a diagram from pasted text: either an SVG exported by drillplot or the JSON source. */
export function parseText(input: string): ParseResult {
  const t = input.trim();
  if (!t) return fail('empty_input');
  if (t.startsWith('<')) {
    const inner = extractSourceText(t);
    if (inner === null) return fail('no_svg_source');
    try {
      JSON.parse(inner);
    } catch {
      return fail('bad_svg_source');
    }
    return parseSource(inner);
  }
  return parseSource(t);
}

/** Each item's keys in order: the 0.1 fields, then the optional 0.2 fields, which are written only when set. */
const KEY_ORDER: Record<string, readonly string[]> = {
  player: ['type', 'x', 'y', 'label', 'team', 'note', 'ghost', 'key', 'court'],
  machine: ['type', 'x', 'y', 'angle', 'key', 'court'],
  cone: ['type', 'x', 'y', 'label', 'key', 'court'],
  zone: ['type', 'x', 'y', 'w', 'h', 'label', 'ghost', 'key', 'court'],
  move: ['type', 'x1', 'y1', 'x2', 'y2', 'color', 'key', 'court'],
  ball: ['type', 'x1', 'y1', 'x2', 'y2', 'curve', 'bend', 'n', 'color', 'dash', 'alt', 'court'],
  line: ['type', 'x1', 'y1', 'x2', 'y2', 'color', 'dash', 'label', 'key', 'court'],
  mark: ['type', 'x', 'y', 'key', 'court'],
};

const present = (rec: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.filter((k) => k in rec && rec[k] !== undefined).map((k) => [k, rec[k]]));

/** The same source with its keys in a fixed order, so the same drawing is always the same text. */
function canonical(source: DrillSource): unknown {
  const items = source.items.map((it) => {
    const order = KEY_ORDER[it.type] ?? [];
    return present(it as unknown as Record<string, unknown>, order);
  });
  const { format, version, title, caption, view, side, orient } = source;
  const extra = present(
    {
      showCaption: source.showCaption || undefined,
      courts: source.courts?.map((ct) => present(ct as Record<string, unknown>, ['label', 'link'])),
      legend: source.legend?.map((e) => present(e as unknown as Record<string, unknown>, ['key', 'color', 'text'])),
    },
    ['showCaption', 'courts', 'legend'],
  );
  return { format, version, title, caption, view, side, orient, ...extra, items };
}

/** The source as JSON text, as stored in a file or copied from the editor. Key order is fixed. */
export function stringifySource(source: DrillSource): string {
  return JSON.stringify(canonical(source), null, 1);
}
