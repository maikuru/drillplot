import type { Item, LabelPosition, PathColor, Player, PlayerColor, Orientation, Region } from '../format/types.js';
import { arrowGeom, drawOrder, latestMoment, round2, type Rect } from './geometry.js';

export const FONT = "Arial, Helvetica, 'Helvetica Neue', sans-serif";

const COLOR = {
  grass: '#3d7a4a',
  court: '#2b6ca3',
  kitchen: '#1f5788',
  line: '#ffffff',
  netFill: '#f4f4f0',
  netEdge: '#1a1a1a',
  ball: '#e6f23a',
  ink: '#1a1a1a',
  move: '#ffffff',
  cone: '#ff5a1f',
  zone: '#ff922b',
  zoneOpacity: 0.38,
  machine: '#3d3d3d',
  machineInk: '#222222',
  white: '#ffffff',
  outline: '#ffffff',
  label: '#ffffff',
  labelOpacity: 0.55,
  badge: '#1a1a1a',
  moveDash: '0.7 0.55',
  pathDash: '0.8 0.6',
  ghostDash: '0.45 0.35',
  keyFill: '#ffffff',
  paper: '#ffffff',
  /** Unreleased. */
  region: '#ffffff',
  regionOpacity: 0.12,
  regionEdgeOpacity: 0.7,
  fade: 0.45,
  ringFillOpacity: 0.2,
  paddle: '#ffffff',
} as const;

/**
 * Since 0.2. Path colors, bright enough to read on the court's blues. Each is [stroke, badge
 * fill, badge number]: a ball path's shot badge is dark with the path color, except on a black path.
 */
export const PATH_PALETTE: Record<PathColor, readonly [string, string, string]> = {
  yellow: ['#e6f23a', '#1a1a1a', '#e6f23a'],
  white: ['#ffffff', '#1a1a1a', '#ffffff'],
  orange: ['#e69f00', '#1a1a1a', '#e69f00'],
  red: ['#ff6a3d', '#1a1a1a', '#ff6a3d'],
  pink: ['#ff8fd0', '#1a1a1a', '#ff8fd0'],
  green: ['#5fd38d', '#1a1a1a', '#5fd38d'],
  black: ['#1a1a1a', '#ffffff', '#1a1a1a'],
};

/**
 * Player colors from the Okabe-Ito set, chosen so the four also differ in lightness (white,
 * orange, blue, black), which keeps them apart for color-blind viewers and on a black and white
 * printer. Each is [fill, letter, outline].
 */
export const PLAYER_PALETTE: Record<PlayerColor, readonly [string, string, string]> = {
  orange: ['#e69f00', '#1a1a1a', '#ffffff'],
  blue: ['#0072b2', '#ffffff', '#ffffff'],
  white: ['#ffffff', '#1a1a1a', '#1a1a1a'],
  black: ['#1a1a1a', '#ffffff', '#ffffff'],
};

/** Characters XML cannot carry (control characters, U+FFFE and U+FFFF, unpaired surrogates). */
const XML_ILLEGAL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF\uD800-\uDFFF]/gu;

/** Escapes text for XML, dropping any character XML cannot carry. */
export const esc = (s: string): string =>
  String(s)
    .replace(XML_ILLEGAL, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** Luma of an sRGB hex color, as a grey hex (same weights as the CSS grayscale() filter). */
export function toGrey(hex: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m || m[1] === undefined) return hex;
  const n = parseInt(m[1], 16);
  const y = Math.round(0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255));
  return '#' + y.toString(16).padStart(2, '0').repeat(3);
}

export interface MarkupContext {
  orient: Orientation;
  greyscale: boolean;
}

const mk = (ctx: MarkupContext) => ({
  c: (hex: string): string => (ctx.greyscale ? toGrey(hex) : hex),
  /** keeps text upright when the court is turned */
  up: (x: number, y: number): string => (ctx.orient === 'landscape' ? ` transform="rotate(90 ${round2(x)} ${round2(y)})"` : ''),
});

/** The court point that is (dx, dy) away from (x, y) on the page, whichever way the court is turned. */
export function pageOffset(orient: Orientation, x: number, y: number, dx: number, dy: number): { x: number; y: number } {
  return orient === 'landscape' ? { x: x - dy, y: y + dx } : { x: x + dx, y: y + dy };
}

/** Since 0.2. The badge for a legend key: a white disc with a dark key, unlike the dark shot badge. */
export function keyBadge(key: string, x: number, y: number, ctx: MarkupContext, r = 0.75): string {
  const { c, up } = mk(ctx);
  const n = [...key].length;
  const fs = round2((n <= 1 ? 1.25 : n === 2 ? 1 : 0.8) * r);
  return (
    `<circle cx="${round2(x)}" cy="${round2(y)}" r="${r}" fill="${c(COLOR.keyFill)}" stroke="${c(COLOR.ink)}" stroke-width="0.12"/>` +
    `<text x="${round2(x)}" y="${round2(y)}" dy="0.35em" font-size="${fs}" font-weight="700" fill="${c(COLOR.ink)}" text-anchor="middle" font-family="${FONT}"${up(x, y)}>${esc(key)}</text>`
  );
}

/** Since 0.2. A shot badge: the number (and alternative letter) of a ball path. */
export function shotBadge(label: string, x: number, y: number, color: PathColor | undefined, ctx: MarkupContext): string {
  const { c, up } = mk(ctx);
  const [stroke, fill, ink] = PATH_PALETTE[color ?? 'yellow'];
  const fs = [...label].length > 1 ? 0.9 : 1.1;
  return (
    `<circle cx="${round2(x)}" cy="${round2(y)}" r="0.85" fill="${c(fill)}" stroke="${c(stroke)}" stroke-width="0.12"/>` +
    `<text x="${round2(x)}" y="${round2(y)}" dy="0.35em" font-size="${fs}" font-weight="700" fill="${c(ink)}" text-anchor="middle" font-family="${FONT}"${up(x, y)}>${esc(label)}</text>`
  );
}

/** Since 0.2. Short text on the court with a dark halo, so it reads on any surface. */
function haloText(text: string, x: number, y: number, size: number, anchor: 'start' | 'middle' | 'end', ctx: MarkupContext): string {
  const { c, up } = mk(ctx);
  return `<text x="${round2(x)}" y="${round2(y)}" dy="0.35em" font-size="${size}" font-weight="700" fill="${c(COLOR.white)}" stroke="${c(COLOR.ink)}" stroke-width="0.2" paint-order="stroke" text-anchor="${anchor}" font-family="${FONT}"${up(x, y)}>${esc(text)}</text>`;
}

/** Unreleased. A ring's letter: white with a dark halo, so it reads over a faint team color. */
function haloLetter(text: string, x: number, y: number, size: number, ctx: MarkupContext): string {
  const { c, up } = mk(ctx);
  return `<text x="${round2(x)}" y="${round2(y)}" dy="0.35em" font-size="${size}" font-weight="700" fill="${c(COLOR.white)}" stroke="${c(COLOR.ink)}" stroke-width="0.22" paint-order="stroke" text-anchor="middle" font-family="${FONT}"${up(x, y)}>${esc(text)}</text>`;
}

/** The shot label: the number, then the alternative letter if there is one. */
export const shotLabel = (it: { n: number; alt?: string | undefined }): string => String(Math.trunc(Number(it.n)) || 1) + (it.alt ?? '');

export function courtMarkup(v: Rect, ctx: MarkupContext): string {
  const { c, up } = mk(ctx);
  const ln = `stroke="${c(COLOR.line)}" stroke-width="0.2" fill="none"`;
  const kl = (y: number): string =>
    `<text x="10" y="${y}" dy="0.35em" font-size="1.3" fill="${c(COLOR.label)}" fill-opacity="${COLOR.labelOpacity}" text-anchor="middle" font-family="${FONT}"${up(10, y)}>Kitchen</text>`;
  return (
    `<rect x="${v.x}" y="${v.y}" width="${v.w}" height="${v.h}" fill="${c(COLOR.grass)}"/>` +
    `<rect x="0" y="0" width="20" height="44" fill="${c(COLOR.court)}"/>` +
    `<rect x="0" y="15" width="20" height="7" fill="${c(COLOR.kitchen)}"/><rect x="0" y="22" width="20" height="7" fill="${c(COLOR.kitchen)}"/>` +
    `<rect x="0" y="0" width="20" height="44" ${ln}/>` +
    `<path d="M0 15H20M0 29H20M10 0V15M10 29V44" ${ln}/>` +
    kl(18.5) +
    kl(25.5) +
    `<rect x="-1" y="21.82" width="22" height="0.36" fill="${c(COLOR.netFill)}" stroke="${c(COLOR.netEdge)}" stroke-width="0.07"/>`
  );
}

/** Unreleased. Whether an item belongs to a moment earlier than the latest one on its court. */
const isEarlier = (it: Item, latest: number | undefined): boolean => it.moment !== undefined && latest !== undefined && it.moment < latest;

/**
 * Unreleased. The paddle on a player's forehand side. A player faces the net, so a right-hander
 * on the bottom half has the forehand to page right (+x), and on the top half to page left.
 */
function paddle(p: Player, ctx: MarkupContext): string {
  if (!p.hand) return '';
  const { c } = mk(ctx);
  const s = (p.hand === 'right') === (p.y >= 22) ? 1 : -1;
  return (
    `<path d="M${round2(p.x + s * 1.3)} ${round2(p.y)}H${round2(p.x + s * 1.55)}" stroke="${c(COLOR.ink)}" stroke-width="0.22"/>` +
    `<ellipse cx="${round2(p.x + s * 1.97)}" cy="${round2(p.y)}" rx="0.45" ry="0.6" fill="${c(COLOR.paddle)}" stroke="${c(COLOR.ink)}" stroke-width="0.12"/>`
  );
}

/** Unreleased. Where a region's label goes: a point inset from the chosen side, as the region is drawn on the page. */
function regionLabel(r: { x: number; y: number; w: number; h: number }, at: LabelPosition, orient: Orientation): { x: number; y: number; anchor: 'start' | 'middle' | 'end' } {
  // the region as drawn: landscape turns the court a quarter turn (court x, y is page y, -x)
  const page = orient === 'landscape' ? { x: r.y, y: -(r.x + r.w), w: r.h, h: r.w } : r;
  const ix = Math.min(0.6, page.w / 4);
  const iy = Math.min(0.9, page.h / 2);
  const left = at === 'left' || at.endsWith('-left');
  const right = at === 'right' || at.endsWith('-right');
  const top = at === 'top' || at.startsWith('top-');
  const bottom = at === 'bottom' || at.startsWith('bottom-');
  const px = left ? page.x + ix : right ? page.x + page.w - ix : page.x + page.w / 2;
  const py = top ? page.y + iy : bottom ? page.y + page.h - iy : page.y + page.h / 2;
  const anchor = left ? 'start' : right ? 'end' : 'middle';
  return orient === 'landscape' ? { x: -py, y: px, anchor } : { x: px, y: py, anchor };
}

function regionMarkup(it: Region, ctx: MarkupContext): string {
  const { c } = mk(ctx);
  const rects = [{ x: it.x, y: it.y, w: it.w, h: it.h }];
  if (it.mirror) rects.push({ x: it.x, y: 44 - it.y - it.h, w: it.w, h: it.h });
  let s = '';
  for (const r of rects) {
    s += `<rect x="${round2(r.x)}" y="${round2(r.y)}" width="${round2(r.w)}" height="${round2(r.h)}" fill="${c(COLOR.region)}" fill-opacity="${COLOR.regionOpacity}" stroke="${c(COLOR.region)}" stroke-opacity="${COLOR.regionEdgeOpacity}" stroke-width="0.12"/>`;
    if (it.label) {
      const p = regionLabel(r, it.labelAt ?? 'center', ctx.orient);
      s += haloText(it.label, p.x, p.y, 1, p.anchor, ctx);
    }
  }
  if (it.key) s += keyBadge(it.key, it.x + 0.9, it.y + 0.9, ctx);
  return s;
}

/** Unreleased. A tether between two players: a cased rope in the first one's team color. */
export function tetherRope(x1: number, y1: number, x2: number, y2: number, team: PlayerColor, ctx: MarkupContext): string {
  const { c } = mk(ctx);
  const f = PLAYER_PALETTE[team] ?? PLAYER_PALETTE.orange;
  const d = `M${round2(x1)} ${round2(y1)}L${round2(x2)} ${round2(y2)}`;
  return `<path d="${d}" fill="none" stroke="${c(f[2])}" stroke-width="0.62" stroke-linecap="round"/><path d="${d}" fill="none" stroke="${c(f[0])}" stroke-width="0.34" stroke-linecap="round"/>`;
}

/** Unreleased. The tethers among the items of one court: each pair with the same tether name and moment. */
export function tetherMarkup(items: readonly Item[], ctx: MarkupContext, latest = latestMoment(items)): string {
  const pairs = new Map<string, Player[]>();
  for (const it of items) {
    if (it.type !== 'player' || it.tether === undefined) continue;
    const k = JSON.stringify([it.moment ?? 0, it.tether]);
    const list = pairs.get(k) ?? [];
    list.push(it);
    pairs.set(k, list);
  }
  let s = '';
  for (const [a, b] of pairs.values()) {
    if (!a || !b) continue;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    // from disc edge to disc edge; nothing when the discs touch
    if (len <= 2.6) continue;
    const ux = dx / len;
    const uy = dy / len;
    const rope = tetherRope(a.x + ux * 1.3, a.y + uy * 1.3, b.x - ux * 1.3, b.y - uy * 1.3, a.team, ctx);
    s += isEarlier(a, latest) ? `<g opacity="${COLOR.fade}">${rope}</g>` : rope;
  }
  return s;
}

/**
 * Unreleased. The markup of one court's items, back to front, with the tethers just under the
 * players. `wrap` lets the editor put each piece in its own group. With no moment and no tether
 * this is exactly `drawOrder(items).map(itemMarkup)`.
 */
export function itemsMarkup<T extends Item>(items: readonly T[], ctx: MarkupContext, wrap: (it: T, svg: string) => string = (_it, svg) => svg): string[] {
  const latest = latestMoment(items);
  const tethers = tetherMarkup(items, ctx, latest);
  const out: string[] = [];
  let placed = tethers === '';
  for (const it of drawOrder(items)) {
    if (!placed && it.type === 'player') {
      out.push(tethers);
      placed = true;
    }
    out.push(wrap(it, itemMarkup(it, ctx, latest)));
  }
  if (!placed) out.push(tethers);
  return out;
}

/**
 * One item. `latest` is the latest moment on the item's court (see `latestMoment`): an item of an
 * earlier moment is drawn faded, a player of an earlier moment as a ring in its team color.
 */
export function itemMarkup(it: Item, ctx: MarkupContext, latest?: number): string {
  if (it.type !== 'player' && isEarlier(it, latest)) return `<g opacity="${COLOR.fade}">${itemBody(it, ctx, latest)}</g>`;
  return itemBody(it, ctx, latest);
}

function itemBody(it: Item, ctx: MarkupContext, latest: number | undefined): string {
  const { c, up } = mk(ctx);
  switch (it.type) {
    case 'region':
      return regionMarkup(it, ctx);
    case 'zone': {
      let s = it.ghost
        ? `<rect x="${round2(it.x)}" y="${round2(it.y)}" width="${round2(it.w)}" height="${round2(it.h)}" fill="none" stroke="${c(COLOR.zone)}" stroke-width="0.2" stroke-dasharray="${COLOR.pathDash}"/>`
        : `<rect x="${round2(it.x)}" y="${round2(it.y)}" width="${round2(it.w)}" height="${round2(it.h)}" fill="${c(COLOR.zone)}" fill-opacity="${COLOR.zoneOpacity}" stroke="${c(COLOR.zone)}" stroke-width="0.2"/>`;
      if (it.label) {
        const cx = it.x + it.w / 2;
        const cy = it.y + it.h / 2;
        s += `<text x="${round2(cx)}" y="${round2(cy)}" dy="0.35em" font-size="1.1" font-weight="700" fill="${c(COLOR.white)}" stroke="${c(COLOR.ink)}" stroke-width="0.2" paint-order="stroke" text-anchor="middle" font-family="${FONT}"${up(cx, cy)}>${esc(it.label)}</text>`;
      }
      if (it.key) s += keyBadge(it.key, it.x + 0.9, it.y + 0.9, ctx);
      return s;
    }
    case 'cone': {
      let s = `<polygon points="${round2(it.x)},${round2(it.y - 1)} ${round2(it.x + 0.85)},${round2(it.y + 0.8)} ${round2(it.x - 0.85)},${round2(it.y + 0.8)}" fill="${c(COLOR.cone)}" stroke="${c(COLOR.outline)}" stroke-width="0.12" stroke-linejoin="round"/>`;
      if (it.label) {
        const p = pageOffset(ctx.orient, it.x, it.y, 1.1, 0);
        s += haloText(it.label, p.x, p.y, 1, 'start', ctx);
      }
      if (it.key) {
        const p = pageOffset(ctx.orient, it.x, it.y, 0, -1.9);
        s += keyBadge(it.key, p.x, p.y, ctx);
      }
      return s;
    }
    case 'machine': {
      let s =
        `<g transform="translate(${round2(it.x)} ${round2(it.y)}) rotate(${round2(it.angle)})"><rect x="-0.3" y="-1.9" width="0.6" height="1.2" fill="${c(COLOR.machineInk)}" stroke="${c(COLOR.outline)}" stroke-width="0.1"/>` +
        `<rect x="-1.1" y="-0.9" width="2.2" height="1.9" rx="0.3" fill="${c(COLOR.machine)}" stroke="${c(COLOR.outline)}" stroke-width="0.12"/><circle cx="0" cy="0.1" r="0.6" fill="${c(COLOR.ball)}"/></g>`;
      if (it.key) {
        const p = pageOffset(ctx.orient, it.x, it.y, 1.5, -1.5);
        s += keyBadge(it.key, p.x, p.y, ctx);
      }
      return s;
    }
    case 'player': {
      const f = PLAYER_PALETTE[it.team] ?? PLAYER_PALETTE.orange;
      const n = [...it.label].length;
      const fs = n <= 1 ? 1.5 : n === 2 ? 1.15 : n === 3 ? 0.9 : 0.68;
      // a ghost in a moment keeps its team color; a ghost with no moment is the white ring of 0.2
      const ring = it.moment !== undefined && (it.ghost === true || isEarlier(it, latest));
      let s = ring
        ? `<circle cx="${round2(it.x)}" cy="${round2(it.y)}" r="1.1" fill="${c(f[0])}" fill-opacity="${COLOR.ringFillOpacity}" stroke="${c(f[0])}" stroke-width="0.4"/>` +
          `<circle cx="${round2(it.x)}" cy="${round2(it.y)}" r="1.3" fill="none" stroke="${c(f[2])}" stroke-width="0.16" stroke-dasharray="${COLOR.ghostDash}"/>` +
          (n ? haloLetter(it.label, it.x, it.y, fs, ctx) : '')
        : it.ghost
        ? `<circle cx="${round2(it.x)}" cy="${round2(it.y)}" r="1.3" fill="none" stroke="${c(COLOR.white)}" stroke-width="0.18" stroke-dasharray="${COLOR.ghostDash}"/>` +
          (n ? `<text x="${round2(it.x)}" y="${round2(it.y)}" dy="0.35em" font-size="${fs}" font-weight="700" fill="${c(COLOR.white)}" fill-opacity="0.85" text-anchor="middle" font-family="${FONT}"${up(it.x, it.y)}>${esc(it.label)}</text>` : '')
        : `<circle cx="${round2(it.x)}" cy="${round2(it.y)}" r="1.3" fill="${c(f[0])}" stroke="${c(f[2])}" stroke-width="0.14"/>` +
          (n ? `<text x="${round2(it.x)}" y="${round2(it.y)}" dy="0.35em" font-size="${fs}" font-weight="700" fill="${c(f[1])}" text-anchor="middle" font-family="${FONT}"${up(it.x, it.y)}>${esc(it.label)}</text>` : '');
      s += paddle(it, ctx);
      if (it.note) {
        const p = pageOffset(ctx.orient, it.x, it.y, 0, 2.05);
        s += haloText(it.note, p.x, p.y, 0.9, 'middle', ctx);
      }
      if (it.key) {
        const p = pageOffset(ctx.orient, it.x, it.y, 1.2, -1.2);
        s += keyBadge(it.key, p.x, p.y, ctx);
      }
      return s;
    }
    case 'move': {
      const g = arrowGeom(it);
      const col = c(it.color ? PATH_PALETTE[it.color][0] : COLOR.move);
      return (
        `<path d="${g.d}" fill="none" stroke="${col}" stroke-width="0.24" stroke-dasharray="${COLOR.moveDash}"/><polygon points="${g.poly}" fill="${col}"/>` +
        (it.key ? keyBadge(it.key, g.mx, g.my, ctx) : '')
      );
    }
    case 'ball': {
      const g = arrowGeom(it);
      if (it.color === undefined && !it.dash && it.alt === undefined) {
        return (
          `<path d="${g.d}" fill="none" stroke="${c(COLOR.ball)}" stroke-width="0.3" stroke-linecap="round"/><polygon points="${g.poly}" fill="${c(COLOR.ball)}"/>` +
          `<circle cx="${round2(g.mx)}" cy="${round2(g.my)}" r="0.85" fill="${c(COLOR.badge)}" stroke="${c(COLOR.ball)}" stroke-width="0.12"/>` +
          `<text x="${round2(g.mx)}" y="${round2(g.my)}" dy="0.35em" font-size="1.1" font-weight="700" fill="${c(COLOR.ball)}" text-anchor="middle" font-family="${FONT}"${up(g.mx, g.my)}>${Math.trunc(Number(it.n)) || 1}</text>`
        );
      }
      const col = c(PATH_PALETTE[it.color ?? 'yellow'][0]);
      const dash = it.dash ? ` stroke-dasharray="${COLOR.pathDash}"` : ' stroke-linecap="round"';
      return (
        `<path d="${g.d}" fill="none" stroke="${col}" stroke-width="0.3"${dash}/><polygon points="${g.poly}" fill="${col}"/>` +
        shotBadge(shotLabel(it), g.mx, g.my, it.color, ctx)
      );
    }
    case 'line': {
      const col = c(PATH_PALETTE[it.color ?? 'white'][0]);
      const dash = it.dash ? ` stroke-dasharray="${COLOR.pathDash}"` : ' stroke-linecap="round"';
      let s = `<path d="M${round2(it.x1)} ${round2(it.y1)}L${round2(it.x2)} ${round2(it.y2)}" fill="none" stroke="${col}" stroke-width="0.24"${dash}/>`;
      const mx = (it.x1 + it.x2) / 2;
      const my = (it.y1 + it.y2) / 2;
      if (it.label) {
        const p = pageOffset(ctx.orient, mx, my, 0, -0.85);
        s += haloText(it.label, p.x, p.y, 0.95, 'middle', ctx);
      }
      if (it.key) s += keyBadge(it.key, it.x1, it.y1, ctx);
      return s;
    }
    case 'mark':
      return keyBadge(it.key, it.x, it.y, ctx, 0.9);
  }
}
