import { describe, expect, it } from 'vitest';
import { ballItems, hasShotGap, nextShotNumber, renumberShots, type Item } from '../src/index.js';

const b = (n: number): Item => ({ type: 'ball', x1: 0, y1: 0, x2: 1, y2: 1, curve: false, bend: 1, n });
const cone: Item = { type: 'cone', x: 1, y: 1 };

describe('shot numbering', () => {
  it('the first shot is 1', () => expect(nextShotNumber([cone])).toBe(1));
  it('the next shot follows the highest, even past a gap', () => expect(nextShotNumber([b(1), b(5)])).toBe(6));
  it('orders ball paths by number, not by position in the list', () => {
    expect(ballItems([b(3), cone, b(1), b(2)]).map((x) => x.n)).toEqual([1, 2, 3]);
  });
  it('detects a gap', () => {
    expect(hasShotGap([b(1), b(2)])).toBe(false);
    expect(hasShotGap([b(1), b(3)])).toBe(true);
    expect(hasShotGap([])).toBe(false);
  });
  it('renumbers 1..N in the current order and leaves other items alone', () => {
    const items = [b(7), cone, b(2), b(9)];
    renumberShots(items);
    expect(items.map((i) => (i.type === 'ball' ? i.n : 0))).toEqual([2, 0, 1, 3]);
    expect(hasShotGap(items)).toBe(false);
  });
  it('keeps list order for ties', () => {
    const items = [b(2), b(2)];
    renumberShots(items);
    expect(items.map((i) => (i.type === 'ball' ? i.n : 0))).toEqual([1, 2]);
  });
});
