import type { Ball, Item } from './types.js';

/** Ball paths in shot order: by number, then alternative letter. Ties keep their order in the list. */
export function ballItems<T extends Item>(items: readonly T[]): Extract<T, Ball>[] {
  return items
    .map((it, i) => [it, i] as const)
    .filter((p): p is readonly [Extract<T, Ball>, number] => p[0].type === 'ball')
    .sort((a, b) => a[0].n - b[0].n || (a[0].alt ?? '').localeCompare(b[0].alt ?? '') || a[1] - b[1])
    .map((p) => p[0]);
}

/**
 * The shot slot of each ball path, in shot order: 1, 2, 3... Paths that share a number and both
 * carry an alternative letter are choices for one shot, so they share a slot.
 */
function slots(items: readonly Item[]): Array<[Ball, number]> {
  const out: Array<[Ball, number]> = [];
  let slot = 0;
  let prev: Ball | undefined;
  for (const b of ballItems(items)) {
    if (!(prev && b.alt !== undefined && prev.alt !== undefined && b.n === prev.n)) slot++;
    out.push([b, slot]);
    prev = b;
  }
  return out;
}

/** The number the next ball path should get. */
export function nextShotNumber(items: readonly Item[]): number {
  return items.reduce((m, it) => (it.type === 'ball' ? Math.max(m, it.n) : m), 0) + 1;
}

/** True when the shot numbers are not exactly 1..N (alternatives for one shot count once). */
export function hasShotGap(items: readonly Item[]): boolean {
  return slots(items).some(([b, s]) => b.n !== s);
}

/** Numbers the ball paths 1..N in their current order, keeping alternatives together. Mutates the items it is given. */
export function renumberShots(items: readonly Item[]): void {
  for (const [b, s] of slots(items)) b.n = s;
}
