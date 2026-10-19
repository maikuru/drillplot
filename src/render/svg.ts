import type { DrillSource } from '../format/types.js';
import { stringifySource } from '../format/open.js';
import { courtView, drawOrder, viewBox } from './geometry.js';
import { courtMarkup, esc, FONT, itemMarkup } from './markup.js';

export interface RenderOptions {
  /**
   * Draw every color as its grey. For display only: an export that keeps the colors is the
   * default, and the editor never exports a greyscale drawing.
   */
  greyscale?: boolean;
}

/** The source as it is embedded: JSON, XML-escaped so it is plain text inside <metadata>. */
export function embedSource(source: DrillSource): string {
  // JSON writes control characters and lone surrogates as escapes already; U+FFFE and U+FFFF it does not
  return stringifySource(source)
    .replace(/[\uFFFE\uFFFF]/g, (c) => '\\u' + c.charCodeAt(0).toString(16))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Renders a source to a standalone SVG string. Deterministic: the same source gives the same
 * text. Every fill and stroke is explicit (no CSS, no currentColor), there are no ids, and the
 * source JSON travels in <metadata> so the SVG can be reopened and edited.
 */
export function renderSvg(source: DrillSource, options: RenderOptions = {}): string {
  const greyscale = options.greyscale === true;
  const ctx = { orient: source.orient, greyscale };
  const v = viewBox(source.view, source.side, source.orient);
  const title = source.title || 'Drill diagram';
  const world = source.orient === 'landscape' ? '<g transform="rotate(-90)">' : '<g>';
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" width="${Math.round(v.w * 16)}" height="${Math.round(v.h * 16)}" role="img" aria-label="${esc(title)}" font-family="${FONT}">\n` +
    `<title>${esc(title)}</title>\n` +
    (source.caption ? `<desc>${esc(source.caption)}</desc>\n` : '') +
    `<metadata>${embedSource(source)}</metadata>\n` +
    world +
    courtMarkup(courtView(source.view, source.side), ctx) +
    '\n' +
    drawOrder(source.items)
      .map((it) => itemMarkup(it, ctx))
      .join('\n') +
    '\n</g>\n</svg>'
  );
}
