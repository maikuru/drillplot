import type { Item, PlayerColor, Orientation } from '../format/types.js';
import { arrowGeom, round2, type Rect } from './geometry.js';

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
} as const;

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

export const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

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

export function itemMarkup(it: Item, ctx: MarkupContext): string {
  const { c, up } = mk(ctx);
  switch (it.type) {
    case 'zone': {
      let s = `<rect x="${round2(it.x)}" y="${round2(it.y)}" width="${round2(it.w)}" height="${round2(it.h)}" fill="${c(COLOR.zone)}" fill-opacity="${COLOR.zoneOpacity}" stroke="${c(COLOR.zone)}" stroke-width="0.2"/>`;
      if (it.label) {
        const cx = it.x + it.w / 2;
        const cy = it.y + it.h / 2;
        s += `<text x="${round2(cx)}" y="${round2(cy)}" dy="0.35em" font-size="1.1" font-weight="700" fill="${c(COLOR.white)}" stroke="${c(COLOR.ink)}" stroke-width="0.2" paint-order="stroke" text-anchor="middle" font-family="${FONT}"${up(cx, cy)}>${esc(it.label)}</text>`;
      }
      return s;
    }
    case 'cone':
      return `<polygon points="${round2(it.x)},${round2(it.y - 1)} ${round2(it.x + 0.85)},${round2(it.y + 0.8)} ${round2(it.x - 0.85)},${round2(it.y + 0.8)}" fill="${c(COLOR.cone)}" stroke="${c(COLOR.outline)}" stroke-width="0.12" stroke-linejoin="round"/>`;
    case 'machine':
      return (
        `<g transform="translate(${round2(it.x)} ${round2(it.y)}) rotate(${round2(it.angle)})"><rect x="-0.3" y="-1.9" width="0.6" height="1.2" fill="${c(COLOR.machineInk)}" stroke="${c(COLOR.outline)}" stroke-width="0.1"/>` +
        `<rect x="-1.1" y="-0.9" width="2.2" height="1.9" rx="0.3" fill="${c(COLOR.machine)}" stroke="${c(COLOR.outline)}" stroke-width="0.12"/><circle cx="0" cy="0.1" r="0.6" fill="${c(COLOR.ball)}"/></g>`
      );
    case 'player': {
      const f = PLAYER_PALETTE[it.team];
      const n = [...it.label].length;
      const fs = n <= 1 ? 1.5 : n === 2 ? 1.15 : n === 3 ? 0.9 : 0.68;
      return (
        `<circle cx="${round2(it.x)}" cy="${round2(it.y)}" r="1.3" fill="${c(f[0])}" stroke="${c(f[2])}" stroke-width="0.14"/>` +
        (n ? `<text x="${round2(it.x)}" y="${round2(it.y)}" dy="0.35em" font-size="${fs}" font-weight="700" fill="${c(f[1])}" text-anchor="middle" font-family="${FONT}"${up(it.x, it.y)}>${esc(it.label)}</text>` : '')
      );
    }
    case 'move': {
      const g = arrowGeom(it);
      return `<path d="${g.d}" fill="none" stroke="${c(COLOR.move)}" stroke-width="0.24" stroke-dasharray="${COLOR.moveDash}"/><polygon points="${g.poly}" fill="${c(COLOR.move)}"/>`;
    }
    case 'ball': {
      const g = arrowGeom(it);
      return (
        `<path d="${g.d}" fill="none" stroke="${c(COLOR.ball)}" stroke-width="0.3" stroke-linecap="round"/><polygon points="${g.poly}" fill="${c(COLOR.ball)}"/>` +
        `<circle cx="${round2(g.mx)}" cy="${round2(g.my)}" r="0.85" fill="${c(COLOR.badge)}" stroke="${c(COLOR.ball)}" stroke-width="0.12"/>` +
        `<text x="${round2(g.mx)}" y="${round2(g.my)}" dy="0.35em" font-size="1.1" font-weight="700" fill="${c(COLOR.ball)}" text-anchor="middle" font-family="${FONT}"${up(g.mx, g.my)}>${it.n}</text>`
      );
    }
  }
}
