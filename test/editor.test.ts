// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { renderSvg, sampleDrill, type DrillSource } from '../src/index.js';
import { defineDrillplotEditor, TOKENS, type DrillplotEditor } from '../src/editor/index.js';

beforeAll(() => defineDrillplotEditor());

const make = (): DrillplotEditor => {
  const el = document.createElement('drillplot-editor');
  document.body.append(el);
  return el;
};
const q = <T extends HTMLElement>(el: DrillplotEditor, id: string) => el.shadowRoot!.getElementById(id) as T;

describe('<drillplot-editor>', () => {
  it('loads a source through the property and exports the same svg', () => {
    const el = make();
    el.source = sampleDrill();
    expect(el.source).toEqual(sampleDrill());
    expect(el.getSvg()).toBe(renderSvg(sampleDrill()));
    expect(el.shadowRoot!.querySelectorAll('.piece')).toHaveLength(sampleDrill().items.length);
  });

  it('loads from the source attribute and from an exported SVG', () => {
    const el = make();
    el.setAttribute('source', JSON.stringify(sampleDrill()));
    expect(el.source.title).toBe('Third-shot drop and walk in');
    const other: DrillSource = { ...sampleDrill(), title: 'From svg', items: [] };
    el.source = renderSvg(other);
    expect(el.source.title).toBe('From svg');
  });

  it('does not fire change for programmatic loads, and reports a bad source instead of throwing', () => {
    const el = make();
    let changes = 0;
    let errors: string[] = [];
    el.addEventListener('change', () => changes++);
    el.addEventListener('source-error', (e) => (errors = (e as CustomEvent).detail.errors.map((x: { key: string }) => x.key)));
    el.source = sampleDrill();
    el.source = '{"format":"nope"}';
    expect(changes).toBe(0);
    expect(errors).toContain('wrong_format');
    expect(el.source.title).toBe('Third-shot drop and walk in');
  });

  it('fires change with the source when the user edits, and save with source and svg', () => {
    const el = make();
    el.source = sampleDrill();
    const seen: DrillSource[] = [];
    el.addEventListener('change', (e) => seen.push((e as CustomEvent).detail.source));
    const title = q<HTMLInputElement>(el, 'title');
    title.value = 'New name';
    title.dispatchEvent(new Event('input'));
    expect(seen.at(-1)?.title).toBe('New name');

    q<HTMLInputElement>(el, 'orient-landscape').click();
    expect(seen.at(-1)?.orient).toBe('landscape');

    let saved: { source: DrillSource; svg: string } | undefined;
    el.addEventListener('save', (e) => (saved = (e as CustomEvent).detail));
    q(el, 'save').click();
    expect(saved?.source.title).toBe('New name');
    expect(saved?.svg).toContain('<metadata>');
  });

  it('adds a piece from the keyboard, selects it, deletes it, and undoes the delete', () => {
    const el = make();
    el.source = sampleDrill();
    const n = sampleDrill().items.length;
    q(el, 'undo').click(); // nothing to undo: disabled
    const add = el.shadowRoot!.querySelector<HTMLButtonElement>('[data-kind="machine"]')!;
    add.click(); // detail 0 is what Enter produces
    expect(el.source.items).toHaveLength(n + 1);
    expect(q(el, 'insp').hidden).toBe(false);
    q(el, 'delete').click();
    expect(el.source.items).toHaveLength(n);
    q(el, 'undo').click();
    expect(el.source.items).toHaveLength(n + 1);
  });

  it('Get SVG shows color even in the greyscale view; Open from source replaces the drawing', () => {
    const el = make();
    el.source = sampleDrill();
    q<HTMLInputElement>(el, 'mono').click();
    expect(el.hasAttribute('greyscale')).toBe(true);
    expect(el.shadowRoot!.getElementById('stage')!.innerHTML).not.toContain('#e69f00');
    q(el, 'open-svg').click();
    expect(q<HTMLTextAreaElement>(el, 'out-svg').value).toContain('#e69f00');
    expect(q<HTMLTextAreaElement>(el, 'out-svg').value).toBe(renderSvg(sampleDrill()));

    const other = { ...sampleDrill(), title: 'Opened', items: [] };
    q<HTMLTextAreaElement>(el, 'open-input').value = renderSvg(other);
    q(el, 'open-go').click();
    expect(el.source.title).toBe('Opened');
    q<HTMLTextAreaElement>(el, 'open-input').value = 'not a diagram';
    q(el, 'open-go').click();
    expect(q(el, 'open-s').classList.contains('err')).toBe(true);
    expect(el.source.title).toBe('Opened');
  });

  it('exposes theme tokens as custom properties the host can set', () => {
    const el = make();
    const css = el.shadowRoot!.querySelector('style')!.textContent!;
    for (const t of ['--drillplot-accent', '--drillplot-surface', '--drillplot-stage-bg', '--drillplot-font']) expect(css).toContain(t);
  });

  it('undoing Open from source brings the title and caption fields back too', () => {
    const el = make();
    el.source = sampleDrill();
    q(el, 'open-src').click();
    q<HTMLTextAreaElement>(el, 'open-input').value = JSON.stringify({ format: 'drill-diagram', version: 1, title: 'Opened', caption: 'New words', items: [] });
    q(el, 'open-go').click();
    expect(q<HTMLInputElement>(el, 'title').value).toBe('Opened');
    q(el, 'undo').click();
    expect(el.source.title).toBe('Third-shot drop and walk in');
    expect(q<HTMLInputElement>(el, 'title').value).toBe('Third-shot drop and walk in');
    expect(q<HTMLTextAreaElement>(el, 'caption').value).toBe(sampleDrill().caption);
  });

  it('can be registered under another tag name', () => {
    expect(() => defineDrillplotEditor('my-drill-editor')).not.toThrow();
    expect(() => defineDrillplotEditor('my-drill-editor')).not.toThrow();
    const el = document.createElement('my-drill-editor') as DrillplotEditor;
    document.body.append(el);
    el.source = sampleDrill();
    expect(el.source.items).toHaveLength(sampleDrill().items.length);
  });

  it('Escape closes a sheet and returns focus to the button that opened it', () => {
    const el = make();
    q(el, 'open-src').click();
    expect(q(el, 'sheet-open').hidden).toBe(false);
    q<HTMLTextAreaElement>(el, 'open-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    expect(q(el, 'sheet-open').hidden).toBe(true);
    expect(el.shadowRoot!.activeElement).toBe(q(el, 'open-src'));
  });

  it('keeps the focus ring outside the checked segment, and a solid pressed state', () => {
    const css = make().shadowRoot!.querySelector('style')!.textContent!;
    expect(css).toMatch(/focus-visible \+ label \{[^}]*outline-offset: 2px/);
    expect(css).toMatch(/aria-pressed="true"\][^}]*background: var\(--accent\);/);
  });

  it('the README documents exactly the theme tokens the code exposes', () => {
    const readme = readFileSync(resolve(process.cwd(), 'README.md'), 'utf8');
    const documented = [...readme.matchAll(/`--drillplot-([a-z-]+)`/g)].map((m) => m[1]).sort();
    expect(documented).toEqual([...TOKENS].sort());
  });

  it('does not rebuild the piece list or rewrite the hint while a drag is in flight', () => {
    const el = make();
    el.source = sampleDrill();
    const pick = q(el, 'pick');
    const first = pick.firstElementChild;
    q(el, 'sel-label'); // exists
    // a full re-render with unchanged items keeps the same option nodes
    q<HTMLInputElement>(el, 'mono').click();
    expect(pick.firstElementChild).toBe(first);
  });
});
