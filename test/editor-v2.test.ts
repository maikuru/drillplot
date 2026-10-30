// @vitest-environment jsdom
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { parseSource, renderSvg, sampleDrill, type DrillSource, type Item } from '../src/index.js';
import { defineDrillplotEditor, type DrillplotEditor } from '../src/editor/index.js';

/* The editor and the 0.2 fields: it keeps every one through a load and save, and edits them. */
beforeAll(() => defineDrillplotEditor());

const make = (): DrillplotEditor => {
  const el = document.createElement('drillplot-editor');
  document.body.append(el);
  return el;
};
const q = <T extends HTMLElement>(el: DrillplotEditor, id: string) => el.shadowRoot!.getElementById(id) as T;
const type = (input: HTMLInputElement, value: string): void => {
  input.dispatchEvent(new Event('focus'));
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
};
const choose = (select: HTMLSelectElement | HTMLInputElement, value: string | boolean): void => {
  if (typeof value === 'boolean') (select as HTMLInputElement).checked = value;
  else select.value = value;
  select.dispatchEvent(new Event('change', { bubbles: true }));
};
const selectItem = (el: DrillplotEditor, index: number): void => {
  const pick = q<HTMLSelectElement>(el, 'pick');
  const opts = [...pick.options].filter((o) => o.value);
  choose(pick, opts[index]!.value);
};

const dir = resolve(process.cwd(), 'test/fixtures/v2');
const fixtures = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => {
    const r = parseSource(readFileSync(resolve(dir, f), 'utf8'));
    if (!r.ok) throw new Error(f);
    return [f, r.source] as [string, DrillSource];
  });

describe('<drillplot-editor> with the 0.2 fields', () => {
  it.each(fixtures)('%s loads and saves unchanged, and exports the same SVG', (_f, src) => {
    const el = make();
    el.source = src;
    expect(el.source).toEqual(src);
    expect(el.getSvg()).toBe(renderSvg(src));
  });

  it('a 0.1 diagram saves with no 0.2 keys', () => {
    const el = make();
    el.source = sampleDrill();
    expect(Object.keys(el.source).sort()).toEqual(Object.keys(sampleDrill()).sort());
    el.source.items.forEach((it, i) => expect(Object.keys(it).sort()).toEqual(Object.keys(sampleDrill().items[i]!).sort()));
  });

  it('edits a player note, ghost and badge, and undoes them', () => {
    const el = make();
    el.source = { ...sampleDrill(), items: [{ type: 'player', x: 5, y: 40, label: 'A', team: 'orange' }] };
    selectItem(el, 0);
    expect(q(el, 'g-note').hidden).toBe(false);
    type(q(el, 'sel-note'), 'feeder');
    type(q(el, 'sel-key'), '1');
    choose(q(el, 'sel-ghost'), true);
    expect(el.source.items[0]).toEqual({ type: 'player', x: 5, y: 40, label: 'A', team: 'orange', note: 'feeder', ghost: true, key: '1' });
    q(el, 'undo').click();
    q(el, 'undo').click();
    q(el, 'undo').click();
    expect(el.source.items[0]).toEqual({ type: 'player', x: 5, y: 40, label: 'A', team: 'orange' });
  });

  it('clearing a field removes it rather than saving an empty value', () => {
    const el = make();
    el.source = { ...sampleDrill(), items: [{ type: 'cone', x: 5, y: 40, label: 'T1', key: '2' }] };
    selectItem(el, 0);
    type(q(el, 'sel-label'), '');
    type(q(el, 'sel-key'), '');
    expect(el.source.items[0]).toEqual({ type: 'cone', x: 5, y: 40 });
  });

  it('styles a ball path: color, dash and an either-or letter', () => {
    const el = make();
    el.source = sampleDrill();
    const balls = el.source.items.filter((i) => i.type === 'ball').length;
    const pickBall = [...q<HTMLSelectElement>(el, 'pick').options].find((o) => o.text.startsWith('Drive'))!;
    choose(q(el, 'pick'), pickBall.value);
    expect(q(el, 'g-alt').hidden).toBe(false);
    choose(q(el, 'sel-color'), 'pink');
    choose(q(el, 'sel-dash'), true);
    choose(q(el, 'sel-alt'), 'a');
    const ball = el.source.items.find((i): i is Extract<Item, { type: 'ball' }> => i.type === 'ball' && i.n === 1)!;
    expect(ball).toMatchObject({ color: 'pink', dash: true, alt: 'a' });
    choose(q(el, 'sel-color'), '');
    expect('color' in el.source.items.find((i) => i.type === 'ball' && i.n === 1)!).toBe(false);
    expect(el.source.items.filter((i) => i.type === 'ball')).toHaveLength(balls);
  });

  it('adds a legend badge with the next free key, and the line tool exists', () => {
    const el = make();
    el.source = sampleDrill(); // shots 1 and 2
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-kind="mark"]')!.click();
    expect(el.source.items.at(-1)).toMatchObject({ type: 'mark', key: '3' });
    expect(el.shadowRoot!.querySelector('[data-tool="line"]')).not.toBeNull();
  });

  it('edits the legend: add, type, swatch, remove', () => {
    const el = make();
    el.source = sampleDrill();
    q(el, 'legend-add').click();
    type(q(el, 'lg-text-0'), 'The first shot');
    expect(el.source.legend).toEqual([{ key: '3', text: 'The first shot' }]);
    type(q(el, 'lg-key-0'), '1');
    q(el, 'legend-add').click();
    type(q(el, 'lg-key-1'), '');
    choose(q(el, 'lg-color-1'), 'orange');
    type(q(el, 'lg-text-1'), 'Open space');
    expect(el.source.legend).toEqual([{ key: '1', text: 'The first shot' }, { color: 'orange', text: 'Open space' }]);
    (q(el, 'legend-rows').querySelector('[data-i="0"] [data-remove]') as HTMLButtonElement).click();
    expect(el.source.legend).toEqual([{ color: 'orange', text: 'Open space' }]);
    (q(el, 'legend-rows').querySelector('[data-remove]') as HTMLButtonElement).click();
    expect('legend' in el.source).toBe(false);
  });

  it('prints the caption when asked', () => {
    const el = make();
    el.source = sampleDrill();
    choose(q(el, 'show-caption'), true);
    expect(el.source.showCaption).toBe(true);
    expect(el.getSvg()).toContain('font-style="italic"');
    choose(q(el, 'show-caption'), false);
    expect('showCaption' in el.source).toBe(false);
  });

  it('adds a second court, places new pieces on the court being edited, and shows only that court', () => {
    const el = make();
    el.source = { ...sampleDrill(), items: [{ type: 'cone', x: 1, y: 1 }] };
    choose(q(el, 'courts-n'), '2');
    expect(el.source.courts).toEqual([{ label: 'Court 1' }, { label: 'Court 2' }]);
    expect(q(el, 'court-pick').hidden).toBe(false);
    type(q(el, 'ct-link-0'), 'Winner moves up');
    choose(q(el, 'court-pick'), '2');
    expect(el.shadowRoot!.querySelectorAll('.piece')).toHaveLength(0);
    el.shadowRoot!.querySelector<HTMLButtonElement>('[data-kind="cone"]')!.click();
    expect(el.source.items.at(-1)).toMatchObject({ type: 'cone', court: 2 });
    expect(el.source.courts![0]).toEqual({ label: 'Court 1', link: 'Winner moves up' });
    // a court with pieces on it cannot be removed
    expect([...q<HTMLSelectElement>(el, 'courts-n').options].find((o) => o.value === '1')!.disabled).toBe(true);
    expect(parseSource(el.source).ok).toBe(true);
  });

  it('the stage fills its row and never grows with the side panel', () => {
    const css = make().shadowRoot!.querySelector('style')!.textContent!;
    expect(css).toMatch(/\.body \{[^}]*flex: 1 1 var\(--drillplot-stage-height, min\(78vh, 760px\)\)[^}]*grid-template-rows: minmax\(0, 1fr\)/);
    expect(css).toMatch(/\.stage-wrap \{[^}]*flex: 1 1 0; min-height: 0/);
    expect(css).toMatch(/\.side \{[^}]*overflow: auto/);
  });
});
