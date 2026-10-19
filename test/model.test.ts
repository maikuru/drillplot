import { describe, expect, it } from 'vitest';
import { parseSource, sampleDrill } from '../src/index.js';
import { DrillModel } from '../src/editor/model.js';

const loaded = () => {
  const m = new DrillModel();
  const r = parseSource(sampleDrill());
  if (!r.ok) throw new Error('sample invalid');
  m.load(r.source, { undoable: false });
  return m;
};

describe('DrillModel', () => {
  it('toSource has no editor ids and equals what was loaded', () => {
    expect(loaded().toSource()).toEqual(sampleDrill());
  });

  it('adds snapped, clamped pieces and undoes and redoes them', () => {
    const m = loaded();
    const n = m.items.length;
    const it = m.add('pA', 100, -100);
    expect(it).toMatchObject({ x: 22, y: -2, label: 'A', team: 'orange' });
    expect(m.items).toHaveLength(n + 1);
    m.undo();
    expect(m.items).toHaveLength(n);
    m.redo();
    expect(m.items).toHaveLength(n + 1);
  });

  it('a new zone is centred on the drop and kept inside the margin', () => {
    const m = new DrillModel();
    expect(m.add('zone', 10, 22)).toMatchObject({ x: 7, y: 20, w: 6, h: 4 });
    expect(m.add('zone', 100, 100)).toMatchObject({ x: 16, y: 42 });
  });

  it('nudging stays in bounds, for points and for whole arrows', () => {
    const m = new DrillModel();
    const p = m.add('cone', 21.9, 5);
    m.nudge(p.id, 5, 0);
    expect(m.byId(p.id)).toMatchObject({ x: 22 });
    const a = m.addArrow('drive', 1, 1, 10, 10);
    m.act(() => m.items.push(a));
    m.nudge(a.id, -50, 0);
    const moved = m.byId(a.id);
    expect(moved).toMatchObject({ x1: -2, x2: 7 });
  });

  it('opening a diagram is one undo step that restores title and view too', () => {
    const m = loaded();
    const other = parseSource({ format: 'drill-diagram', version: 1, title: 'Other', view: 'kitchen', orient: 'landscape', items: [{ type: 'cone', x: 1, y: 1 }] });
    if (!other.ok) throw new Error('invalid');
    m.load(other.source, { undoable: true });
    expect(m.meta).toMatchObject({ title: 'Other', view: 'kitchen', orient: 'landscape' });
    m.undo();
    expect(m.toSource()).toEqual(sampleDrill());
    m.redo();
    expect(m.meta.title).toBe('Other');
    expect(m.items).toHaveLength(1);
  });

  it('a change that changes nothing is not an undo step', () => {
    const m = loaded();
    m.act(() => undefined);
    expect(m.canUndo()).toBe(false);
  });

  it('swaps shot numbers with the neighbour, and renumbers', () => {
    const m = loaded();
    const [one, two] = m.items.filter((i) => i.type === 'ball');
    m.shiftShot(one!.id, 1);
    expect([one, two].map((b) => (b!.type === 'ball' ? b!.n : 0))).toEqual([2, 1]);
    m.shiftShot(one!.id, 1); // already last: no change
    expect(one!.type === 'ball' && one!.n).toBe(2);
    m.act(() => {
      if (two!.type === 'ball') two!.n = 9;
    });
    m.renumber();
    expect(m.items.filter((i) => i.type === 'ball').map((b) => (b.type === 'ball' ? b.n : 0))).toEqual([1, 2]);
  });

  it('caps the undo history', () => {
    const m = new DrillModel();
    for (let i = 0; i < 120; i++) m.add('cone', 1, i % 40);
    expect(m.undoStack).toHaveLength(100);
  });
});
