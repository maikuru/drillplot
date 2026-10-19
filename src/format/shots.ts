import type { Ball, Item } from './types.js';

/** Ball paths in shot order. Ties keep their order in the list. */
export function ballItems<T extends Item>(items: readonly T[]): Extract<T, Ball>[] {
  return items
    .map((it, i) => [it, i] as const)
    .filter((p): p is readonly [Extract<T, Ball>, number] => p[0].type === 'ball')
    .sort((a, b) => a[0].n - b[0].n || a[1] - b[1])
    .map((p) => p[0]);
}

/** The number the next ball path should get. */
export function nextShotNumber(items: readonly Item[]): number {
  return items.reduce((m, it) => (it.type === 'ball' ? Math.max(m, it.n) : m), 0) + 1;
}

/** True when the shot numbers are not exactly 1..N. */
export function hasShotGap(items: readonly Item[]): boolean {
  return ballItems(items).some((b, i) => b.n !== i + 1);
}

/** Numbers the ball paths 1..N in their current order. Mutates the items it is given. */
export function renumberShots(items: readonly Item[]): void {
  ballItems(items).forEach((b, i) => {
    b.n = i + 1;
  });
}
