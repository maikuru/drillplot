import type { CourtView, DrillSource, HalfSide, Item, Orientation } from '../format/types.js';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Framed areas in court feet, portrait (net across the page). */
export const VIEWS = {
  full: { x: -2.5, y: -2.5, w: 25, h: 49 },
  kitchen: { x: -2.5, y: 13, w: 25, h: 18 },
  halfBottom: { x: -2.5, y: 19.5, w: 25, h: 27 },
  halfTop: { x: -2.5, y: -2.5, w: 25, h: 27 },
} as const satisfies Record<string, Rect>;

export function courtView(view: CourtView, side: HalfSide): Rect {
  if (view === 'half') return side === 'top' ? VIEWS.halfTop : VIEWS.halfBottom;
  return VIEWS[view];
}

/**
 * What is visible on screen. Landscape turns the court a quarter turn (rotate(-90) maps x,y to
 * y,-x), so the net runs up and down.
 */
export function viewBox(view: CourtView, side: HalfSide, orient: Orientation): Rect {
  const v = courtView(view, side);
  return orient === 'landscape' ? { x: v.y, y: -(v.x + v.w), w: v.h, h: v.w } : { ...v };
}

export interface ArrowGeometry {
  /** Arrow head polygon points. */
  poly: string;
  /** Shaft path, ending where the head starts. */
  d: string;
  /** Midpoint, where the shot number badge sits. */
  mx: number;
  my: number;
}

interface Arrow {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  curve?: boolean;
  bend?: number;
}

export function arrowGeom(it: Arrow): ArrowGeometry {
  const { x1, y1, x2, y2 } = it;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  let cx: number | null = null;
  let cy: number | null = null;
  if (it.curve) {
    const k = 0.22 * len * (it.bend === -1 ? -1 : 1);
    cx = (x1 + x2) / 2 + (-dy / len) * k;
    cy = (y1 + y2) / 2 + (dx / len) * k;
  }
  const tx = cx === null ? dx : x2 - cx;
  const ty = cy === null ? dy : y2 - cy;
  const tl = Math.hypot(tx, ty) || 1;
  const ux = tx / tl;
  const uy = ty / tl;
  const head = Math.min(1.3, len * 0.6);
  const hw = 0.55;
  const bx = x2 - ux * head;
  const by = y2 - uy * head;
  const poly = `${round2(x2)},${round2(y2)} ${round2(bx - uy * hw)},${round2(by + ux * hw)} ${round2(bx + uy * hw)},${round2(by - ux * hw)}`;
  const d =
    cx === null || cy === null
      ? `M${round2(x1)} ${round2(y1)}L${round2(bx)} ${round2(by)}`
      : `M${round2(x1)} ${round2(y1)}Q${round2(cx)} ${round2(cy)} ${round2(bx)} ${round2(by)}`;
  const mx = cx === null ? (x1 + x2) / 2 : 0.25 * x1 + 0.5 * cx + 0.25 * x2;
  const my = cy === null ? (y1 + y2) / 2 : 0.25 * y1 + 0.5 * cy + 0.25 * y2;
  return { poly, d, mx, my };
}

/** Back to front: zones, lines, cones, machines, players, movement, ball paths, legend marks. Stable within a layer. */
const LAYER: Record<Item['type'], number> = { zone: 0, line: 1, cone: 2, machine: 3, player: 4, move: 5, ball: 6, mark: 7 };
export function drawOrder<T extends Item>(items: readonly T[]): T[] {
  return items
    .map((it, i) => [it, i] as const)
    .sort((a, b) => LAYER[a[0].type] - LAYER[b[0].type] || a[1] - b[1])
    .map((p) => p[0]);
}

/** Position of an item for "is it inside this view" checks. */
export function anchor(it: Item): { x: number; y: number } {
  return 'x' in it ? { x: it.x, y: it.y } : { x: (it.x1 + it.x2) / 2, y: (it.y1 + it.y2) / 2 };
}

export function countOffView(source: Pick<DrillSource, 'view' | 'side' | 'items'>): number {
  const v = courtView(source.view, source.side);
  return source.items.filter((it) => {
    const { x, y } = anchor(it);
    return x < v.x || x > v.x + v.w || y < v.y || y > v.y + v.h;
  }).length;
}
