import { BOUNDS, LIMITS } from '../format/limits.js';
import { ballItems, nextShotNumber, renumberShots } from '../format/shots.js';
import { emptySource } from '../format/parse.js';
import type { DrillSource, Item } from '../format/types.js';
import { courtView } from '../render/geometry.js';

/** An item as the editor holds it: the source item plus an id that never leaves the editor. */
export type EditorItem = Item & { id: string };
export type Meta = Pick<DrillSource, 'title' | 'caption' | 'view' | 'side' | 'orient'>;
export type Kind = 'pA' | 'pB' | 'pC' | 'pD' | 'pCoach' | 'machine' | 'cone' | 'zone';

export const KIND_NAME: Record<Kind, string> = {
  pA: 'player A',
  pB: 'player B',
  pC: 'player C',
  pD: 'player D',
  pCoach: 'the coach',
  machine: 'a ball machine',
  cone: 'a cone',
  zone: 'a target zone',
};

const KINDS: Record<Kind, Item> = {
  pA: { type: 'player', x: 0, y: 0, label: 'A', team: 'orange' },
  pB: { type: 'player', x: 0, y: 0, label: 'B', team: 'orange' },
  pC: { type: 'player', x: 0, y: 0, label: 'C', team: 'blue' },
  pD: { type: 'player', x: 0, y: 0, label: 'D', team: 'blue' },
  pCoach: { type: 'player', x: 0, y: 0, label: 'Coach', team: 'black' },
  machine: { type: 'machine', x: 0, y: 0, angle: 0 },
  cone: { type: 'cone', x: 0, y: 0 },
  zone: { type: 'zone', x: 0, y: 0, w: 6, h: 4, label: '' },
};

export const round2 = (v: number): number => Math.round(v * 100) / 100;
export const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
/** Snap to a quarter foot. */
export const snapFt = (v: number, s = 0.25): number => Math.round(v / s) * s;
export const clampX = (v: number): number => round2(clamp(snapFt(v), BOUNDS.xMin, BOUNDS.xMax));
export const clampY = (v: number): number => round2(clamp(snapFt(v), BOUNDS.yMin, BOUNDS.yMax));

interface Entry {
  items: EditorItem[];
  /** Present when the entry also restores title, caption and view (opening a diagram). */
  meta?: Meta;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const key = (e: Entry): string => JSON.stringify(e);

/**
 * The editor's state and every change to it, with undo and redo. No DOM in here, so it is
 * testable on its own. Undo covers the pieces on the court; title, caption and view changes are
 * not steps of their own, except that opening a diagram restores them too.
 */
export class DrillModel {
  meta: Meta = { title: '', caption: '', view: 'full', side: 'bottom', orient: 'portrait' };
  items: EditorItem[] = [];
  undoStack: Entry[] = [];
  redoStack: Entry[] = [];
  private nextId = 1;
  /** Called after any change a user made, with the new source. */
  onChange: (() => void) | undefined;

  uid(): string {
    return 'i' + this.nextId++;
  }

  byId(id: string | null): EditorItem | undefined {
    return id === null ? undefined : this.items.find((i) => i.id === id);
  }

  snap(withMeta = false): Entry {
    return withMeta ? { items: clone(this.items), meta: { ...this.meta } } : { items: clone(this.items) };
  }

  /** Records `before` as an undo step if anything changed since. */
  record(before: Entry): boolean {
    if (key(before) === key(this.snap(before.meta !== undefined))) return false;
    this.undoStack.push(before);
    if (this.undoStack.length > 100) this.undoStack.shift();
    this.redoStack = [];
    return true;
  }

  act(fn: () => void): void {
    const before = this.snap();
    fn();
    this.record(before);
    this.onChange?.();
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  private restore(e: Entry): void {
    this.items = e.items;
    if (e.meta) this.meta = { ...e.meta };
  }

  undo(): void {
    const e = this.undoStack.pop();
    if (!e) return;
    this.redoStack.push(this.snap(e.meta !== undefined));
    this.restore(e);
    this.onChange?.();
  }

  redo(): void {
    const e = this.redoStack.pop();
    if (!e) return;
    this.undoStack.push(this.snap(e.meta !== undefined));
    this.restore(e);
    this.onChange?.();
  }

  /** Replaces everything with a validated source. Undoable, including title and view. */
  load(source: DrillSource, { undoable }: { undoable: boolean }): void {
    const before = this.snap(true);
    this.meta = { title: source.title, caption: source.caption, view: source.view, side: source.side, orient: source.orient };
    this.items = source.items.map((it) => ({ ...clone(it), id: this.uid() }));
    if (undoable) {
      this.undoStack.push(before);
      this.redoStack = [];
    } else {
      this.undoStack = [];
      this.redoStack = [];
    }
  }

  /** The source, without editor ids. */
  toSource(): DrillSource {
    const items = this.items.map(({ id: _id, ...rest }) => clone(rest) as Item);
    return { ...emptySource(), ...this.meta, items };
  }

  makeItem(kind: Kind, x: number, y: number): EditorItem {
    const it = { ...clone(KINDS[kind]), id: this.uid() } as EditorItem;
    const cx = clampX(x);
    const cy = clampY(y);
    if (it.type === 'zone') {
      it.x = round2(clamp(cx - it.w / 2, BOUNDS.xMin, BOUNDS.xMax - it.w));
      it.y = round2(clamp(cy - it.h / 2, BOUNDS.yMin, BOUNDS.yMax - it.h));
    } else if ('x' in it) {
      it.x = cx;
      it.y = cy;
    }
    return it;
  }

  add(kind: Kind, x: number, y: number): EditorItem {
    let made!: EditorItem;
    this.act(() => {
      made = this.makeItem(kind, x, y);
      this.items.push(made);
    });
    return made;
  }

  /** Where a keyboard user's piece lands: spread across the visible court so they do not stack. */
  defaultSpot(): { x: number; y: number } {
    const v = courtView(this.meta.view, this.meta.side);
    const n = this.items.length;
    return { x: 10 + ((n % 5) - 2) * 2.5, y: v.y + v.h / 2 + ((n % 3) - 1) * 2 };
  }

  delete(id: string): void {
    this.act(() => {
      this.items = this.items.filter((i) => i.id !== id);
    });
  }

  clear(): void {
    this.act(() => {
      this.items = [];
    });
  }

  /** Moves a piece by a distance in court feet, keeping it inside the bounds. */
  nudge(id: string, dx: number, dy: number): void {
    const it = this.byId(id);
    if (!it) return;
    this.act(() => moveBy(it, dx, dy, it));
  }

  /** Adds an arrow of the given kind with its start and end already set. */
  addArrow(tool: 'drive' | 'drop' | 'move', x1: number, y1: number, x2: number, y2: number): EditorItem {
    const base = { id: this.uid(), x1: clampX(x1), y1: clampY(y1), x2: clampX(x2), y2: clampY(y2) };
    return tool === 'move'
      ? { type: 'move', ...base }
      : { type: 'ball', ...base, curve: tool === 'drop', bend: 1, n: nextShotNumber(this.items) };
  }

  /** Swaps the shot number with the neighbouring shot. */
  shiftShot(id: string, dir: -1 | 1): void {
    this.act(() => {
      const bs = ballItems(this.items);
      const i = bs.findIndex((b) => (b as EditorItem).id === id);
      const j = i + dir;
      const a = bs[i];
      const b = bs[j];
      if (!a || !b) return;
      const t = a.n;
      a.n = b.n;
      b.n = t;
    });
  }

  renumber(): void {
    this.act(() => renumberShots(this.items));
  }
}

/** Moves any item by (dx, dy), clamped so it stays in bounds. Arrows move as a whole. */
export function moveBy(it: Item, dx: number, dy: number, from: Item): void {
  if ('x' in it && 'x' in from) {
    const w = it.type === 'zone' ? it.w : 0;
    const h = it.type === 'zone' ? it.h : 0;
    it.x = round2(clamp(from.x + dx, BOUNDS.xMin, BOUNDS.xMax - w));
    it.y = round2(clamp(from.y + dy, BOUNDS.yMin, BOUNDS.yMax - h));
  } else if ('x1' in it && 'x1' in from) {
    // keep the whole arrow inside: limit the shift, not each end, so its shape survives
    const minX = Math.min(from.x1, from.x2);
    const maxX = Math.max(from.x1, from.x2);
    const minY = Math.min(from.y1, from.y2);
    const maxY = Math.max(from.y1, from.y2);
    const sx = clamp(dx, BOUNDS.xMin - minX, BOUNDS.xMax - maxX);
    const sy = clamp(dy, BOUNDS.yMin - minY, BOUNDS.yMax - maxY);
    it.x1 = round2(from.x1 + sx);
    it.x2 = round2(from.x2 + sx);
    it.y1 = round2(from.y1 + sy);
    it.y2 = round2(from.y2 + sy);
  }
}

export { LIMITS };
