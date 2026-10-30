import type { DrillSource, Item } from '../format/types.js';
import { stringifySource } from '../format/open.js';
import { courtView, drawOrder, round2, viewBox, type Rect } from './geometry.js';
import { courtMarkup, esc, FONT, itemMarkup, keyBadge, PATH_PALETTE, shotBadge, shotLabel, toGrey, type MarkupContext } from './markup.js';

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
    .replace(/[￾￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16))
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* Since 0.2: the parts drawn outside the court, in page units (feet of the frame). */

const PAPER = '#ffffff';
const INK = '#1a1a1a';
/** Space between courts: across the page in portrait, down it in landscape. */
const GAP = { portrait: 6, landscape: 4 } as const;
/** Height of the strip above the courts that carries their labels. */
const HEAD = 2.2;
const TEXT_SIZE = 1;
const LINE_HEIGHT = 1.4;
/** Average Arial character width as a share of the font size, for wrapping without a DOM. */
const CHAR_WIDTH = 0.53;

/** Wraps text into lines of at most `width` page units at the given size. Keeps the caption's own line breaks. */
export function wrapText(text: string, width: number, size = TEXT_SIZE): string[] {
  const max = Math.max(8, Math.floor(width / (size * CHAR_WIDTH)));
  const out: string[] = [];
  for (const para of text.split(/\r\n|\r|\n/)) {
    let line = '';
    for (const word of para.split(/[ \t]+/).filter(Boolean)) {
      if (!line) line = word;
      else if ([...line].length + 1 + [...word].length <= max) line += ' ' + word;
      else {
        out.push(line);
        line = word;
      }
      while ([...line].length > max) {
        out.push([...line].slice(0, max).join(''));
        line = [...line].slice(max).join('');
      }
    }
    out.push(line);
  }
  while (out.length && out[out.length - 1] === '') out.pop();
  return out;
}

function textLine(s: string, x: number, y: number, ctx: MarkupContext, opts = ''): string {
  const ink = ctx.greyscale ? toGrey(INK) : INK;
  return `<text x="${round2(x)}" y="${round2(y)}" font-size="${TEXT_SIZE}" fill="${ink}" font-family="${FONT}"${opts}>${esc(s)}</text>`;
}

/** The legend and the visible caption, stacked under the drawing. Returns the markup and its height. */
function footer(source: DrillSource, x: number, top: number, width: number, ctx: MarkupContext): { svg: string; h: number } {
  const pad = 0.8;
  let y = top + pad;
  let svg = '';
  const itemKeys = new Set(source.items.flatMap((it) => ('key' in it && it.key ? [it.key] : [])));
  const shots = new Map(source.items.flatMap((it) => (it.type === 'ball' ? [[shotLabel(it), it] as const] : [])));
  for (const e of source.legend ?? []) {
    const lines = wrapText(e.text, width - pad * 2 - 2.2);
    const cy = y + 0.75;
    const flat = { ...ctx, orient: 'portrait' as const };
    if (e.key !== undefined) {
      const shot = itemKeys.has(e.key) ? undefined : shots.get(e.key);
      svg += shot ? shotBadge(e.key, x + pad + 0.85, cy, shot.color, flat) : keyBadge(e.key, x + pad + 0.85, cy, flat);
    } else if (e.color) {
      const col = ctx.greyscale ? toGrey(PATH_PALETTE[e.color][0]) : PATH_PALETTE[e.color][0];
      const edge = ctx.greyscale ? toGrey(INK) : INK;
      svg += `<rect x="${round2(x + pad)}" y="${round2(cy - 0.3)}" width="1.7" height="0.6" fill="${col}" stroke="${edge}" stroke-width="0.06"/>`;
    }
    lines.forEach((l, i) => (svg += textLine(l, x + pad + 2.2, cy + i * LINE_HEIGHT, ctx, ' dy="0.35em"')));
    y += Math.max(1, lines.length) * LINE_HEIGHT + 0.5;
  }
  if (source.showCaption && source.caption) {
    if (source.legend?.length) y += 0.3;
    const lines = wrapText(source.caption, width - pad * 2);
    lines.forEach((l, i) => (svg += textLine(l, x + pad, y + 0.75 + i * LINE_HEIGHT, ctx, ' dy="0.35em" font-style="italic"')));
    y += lines.length * LINE_HEIGHT + 0.3;
  }
  return { svg, h: svg ? round2(y - top + pad - 0.5) : 0 };
}

/** One court with its items, turned for landscape. */
function courtGroup(source: DrillSource, items: readonly Item[], ctx: MarkupContext): string {
  const world = source.orient === 'landscape' ? '<g transform="rotate(-90)">' : '<g>';
  return world + courtMarkup(courtView(source.view, source.side), ctx) + '\n' + drawOrder(items).map((it) => itemMarkup(it, ctx)).join('\n') + '\n</g>';
}

/** Where each court sits on the page and how big the drawing is, before the footer. */
export function courtLayout(source: Pick<DrillSource, 'view' | 'side' | 'orient' | 'courts'>): { frame: Rect; offsets: Array<{ x: number; y: number }>; head: number } {
  const v = viewBox(source.view, source.side, source.orient);
  const n = source.courts?.length ?? 1;
  const across = source.orient === 'portrait';
  const head = source.courts?.some((ct) => ct.label) ? HEAD : 0;
  const gap = GAP[source.orient];
  // stacked courts each get their own label strip, so the gap above it holds only the link
  const offsets = Array.from({ length: n }, (_, i) => (across ? { x: i * (v.w + gap), y: 0 } : { x: 0, y: i * (v.h + gap + head) }));
  const frame = {
    x: v.x,
    y: v.y - head,
    w: across ? n * v.w + (n - 1) * gap : v.w,
    h: head + (across ? v.h : n * v.h + (n - 1) * (gap + head)),
  };
  return { frame, offsets, head };
}

function multiCourt(source: DrillSource, ctx: MarkupContext): { body: string; frame: Rect } {
  const { frame, offsets, head } = courtLayout(source);
  const v = viewBox(source.view, source.side, source.orient);
  const courts = source.courts ?? [{}];
  const across = source.orient === 'portrait';
  const gap = GAP[source.orient];
  const ink = ctx.greyscale ? toGrey(INK) : INK;
  let body = '';
  courts.forEach((ct, i) => {
    const o = offsets[i] ?? { x: 0, y: 0 };
    const mine = source.items.filter((it) => (it.court ?? 1) === i + 1);
    // a nested viewport clips each court to its frame, as the outer viewBox does for one court, without ids
    body += `<svg x="${round2(v.x + o.x)}" y="${round2(v.y + o.y)}" width="${v.w}" height="${v.h}" viewBox="${v.x} ${v.y} ${v.w} ${v.h}">` + courtGroup(source, mine, ctx) + '</svg>\n';
    if (ct.label) body += `<text x="${round2(v.x + o.x + v.w / 2)}" y="${round2(v.y + o.y - 0.8)}" font-size="1.3" font-weight="700" fill="${ink}" text-anchor="middle" font-family="${FONT}">${esc(ct.label)}</text>\n`;
    if (i === courts.length - 1) return;
    // the gap after this court: an arrow to the next one, and the link text
    const gx = across ? v.x + o.x + v.w : v.x;
    const gy = across ? v.y + o.y : v.y + o.y + v.h;
    const cx = across ? gx + gap / 2 : gx + v.w / 2;
    const cy = across ? gy + v.h / 2 : gy + gap / 2 + (head ? 0.2 : 0);
    const lines = ct.link ? (across ? wrapText(ct.link, gap - 0.6, 0.85) : [ct.link]) : [];
    const arrow = across
      ? `<path d="M${round2(cx - 1.6)} ${round2(cy)}H${round2(cx + 0.9)}" stroke="${ink}" stroke-width="0.24"/><polygon points="${round2(cx + 1.7)},${round2(cy)} ${round2(cx + 0.8)},${round2(cy - 0.5)} ${round2(cx + 0.8)},${round2(cy + 0.5)}" fill="${ink}"/>`
      : `<path d="M${round2(cx)} ${round2(cy - 1.4)}V${round2(cy + 0.6)}" stroke="${ink}" stroke-width="0.24"/><polygon points="${round2(cx)},${round2(cy + 1.4)} ${round2(cx - 0.5)},${round2(cy + 0.5)} ${round2(cx + 0.5)},${round2(cy + 0.5)}" fill="${ink}"/>`;
    body += arrow;
    lines.forEach((l, j) => {
      const tx = across ? cx : cx + 1.2;
      const ty = across ? cy - 1.2 - (lines.length - j) * 1.1 + 0.55 : cy;
      body += `<text x="${round2(tx)}" y="${round2(ty)}" dy="0.35em" font-size="0.85" font-weight="700" fill="${ink}" text-anchor="${across ? 'middle' : 'start'}" font-family="${FONT}">${esc(l)}</text>`;
    });
    body += '\n';
  });
  return { body, frame };
}

/**
 * Renders a source to a standalone SVG string. Deterministic: the same source gives the same
 * text. Every fill and stroke is explicit (no CSS, no currentColor), there are no ids, and the
 * source JSON travels in <metadata> so the SVG can be reopened and edited.
 */
export function renderSvg(source: DrillSource, options: RenderOptions = {}): string {
  const greyscale = options.greyscale === true;
  const ctx = { orient: source.orient, greyscale };
  const title = source.title || 'Drill diagram';
  const head = (v: Rect): string =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.x} ${v.y} ${v.w} ${v.h}" width="${Math.round(v.w * 16)}" height="${Math.round(v.h * 16)}" role="img" aria-label="${esc(title)}" font-family="${FONT}">\n` +
    `<title>${esc(title)}</title>\n` +
    (source.caption ? `<desc>${esc(source.caption)}</desc>\n` : '') +
    `<metadata>${embedSource(source)}</metadata>\n`;
  const extras = !!source.courts || !!source.legend?.length || (!!source.showCaption && !!source.caption);
  if (!extras) {
    // exactly the 0.1 drawing
    return head(viewBox(source.view, source.side, source.orient)) + courtGroup(source, source.items, ctx) + '\n</svg>';
  }
  const { body, frame } = source.courts ? multiCourt(source, ctx) : { body: courtGroup(source, source.items, ctx) + '\n', frame: viewBox(source.view, source.side, source.orient) };
  const foot = footer(source, frame.x, frame.y + frame.h, frame.w, ctx);
  const page = { ...frame, h: round2(frame.h + foot.h) };
  const paper = ctx.greyscale ? toGrey(PAPER) : PAPER;
  return (
    head(page) +
    `<rect x="${page.x}" y="${page.y}" width="${page.w}" height="${page.h}" fill="${paper}"/>\n` +
    body +
    foot.svg +
    (foot.svg ? '\n' : '') +
    '</svg>'
  );
}
