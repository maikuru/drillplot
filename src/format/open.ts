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
  const m = /<metadata(?:\s[^>]*)?>([\s\S]*?)<\/metadata>/i.exec(svg);
  if (!m || m[1] === undefined) return null;
  const inner = m[1].trim();
  if (!inner) return null;
  const cdata = /^<!\[CDATA\[([\s\S]*)\]\]>$/.exec(inner);
  return cdata && cdata[1] !== undefined ? cdata[1] : decodeEntities(inner);
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

const KEY_ORDER: Record<string, readonly string[]> = {
  player: ['type', 'x', 'y', 'label', 'team'],
  machine: ['type', 'x', 'y', 'angle'],
  cone: ['type', 'x', 'y'],
  zone: ['type', 'x', 'y', 'w', 'h', 'label'],
  move: ['type', 'x1', 'y1', 'x2', 'y2'],
  ball: ['type', 'x1', 'y1', 'x2', 'y2', 'curve', 'bend', 'n'],
};

/** The same source with its keys in a fixed order, so the same drawing is always the same text. */
function canonical(source: DrillSource): unknown {
  const items = source.items.map((it) => {
    const order = KEY_ORDER[it.type] ?? [];
    const rec = it as unknown as Record<string, unknown>;
    return Object.fromEntries(order.filter((k) => k in rec).map((k) => [k, rec[k]]));
  });
  const { format, version, title, caption, view, side, orient } = source;
  return { format, version, title, caption, view, side, orient, items };
}

/** The source as JSON text, as stored in a file or copied from the editor. Key order is fixed. */
export function stringifySource(source: DrillSource): string {
  return JSON.stringify(canonical(source), null, 1);
}
