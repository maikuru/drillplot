import { LIMITS } from '../format/limits.js';
import { parseText } from '../format/open.js';
import { parseSource } from '../format/parse.js';
import { ballItems, hasShotGap } from '../format/shots.js';
import type { DrillSource, Item, ParseError, ParseResult } from '../format/types.js';
import { arrowGeom, countOffView, courtView, drawOrder, viewBox } from '../render/geometry.js';
import { courtMarkup, esc, itemMarkup } from '../render/markup.js';
import { renderSvg } from '../render/svg.js';
import { stringifySource } from '../format/open.js';
import { clamp, clampX, clampY, DrillModel, KIND_NAME, moveBy, round2, snapFt, type EditorItem, type Kind } from './model.js';
import { CSS } from './style.js';
import { TEMPLATE } from './template.js';

type Tool = 'select' | 'drive' | 'drop' | 'move';
type Drag =
  | { mode: 'move'; before: ReturnType<DrillModel['snap']>; p0: { x: number; y: number }; orig: EditorItem }
  | { mode: 'draw'; before: ReturnType<DrillModel['snap']>; id: string }
  | { mode: 'handle'; before: ReturnType<DrillModel['snap']>; h: string };

export interface ChangeDetail {
  source: DrillSource;
}
export interface SaveDetail {
  source: DrillSource;
  /** The exported SVG, always in color. */
  svg: string;
}
export interface SourceErrorDetail {
  errors: ParseError[];
}

function itemName(it: Item): string {
  switch (it.type) {
    case 'player':
      return 'Player ' + (it.label || '(no label)');
    case 'machine':
      return 'Ball machine';
    case 'cone':
      return 'Cone';
    case 'zone':
      return 'Target zone' + (it.label ? ' ' + it.label : '');
    case 'move':
      return 'Movement arrow';
    case 'ball':
      return (it.curve ? 'Drop or lob ' : 'Drive ') + it.n;
  }
}

const POINT_KINDS = new Set(['player', 'machine', 'cone', 'zone']);

/**
 * <drillplot-editor>: draw a pickleball drill on a to-scale court.
 *
 * Shadow DOM (open): the editor ships its own styles and ids, so it cannot be restyled by
 * accident or clash with a host page. Hosts restyle it on purpose through the --drillplot-*
 * custom properties (they inherit into the shadow tree) and the `part` names.
 *
 * Attributes: source (JSON text), greyscale, theme (light or dark), save-label.
 * Events: change (detail.source), save (detail.source, detail.svg), source-error (detail.errors).
 */
export class DrillplotEditor extends HTMLElement {
  static observedAttributes = ['source', 'greyscale', 'save-label'];

  private model = new DrillModel();
  private sel: string | null = null;
  private tool: Tool = 'select';
  private armed: Kind | null = null;
  private mono = false;
  private drag: Drag | null = null;
  private quiet = 0;
  private opener: HTMLElement | null = null;
  private labelBefore: ReturnType<DrillModel['snap']> | null = null;
  private aimBefore: ReturnType<DrillModel['snap']> | null = null;
  private readonly shadow: ShadowRoot;
  private stage: SVGSVGElement;

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
    this.shadow.innerHTML = `<style>${CSS}</style>${TEMPLATE}`;
    this.stage = this.$('stage') as unknown as SVGSVGElement;
    this.model.onChange = () => {
      if (!this.model.byId(this.sel)) this.sel = null;
      this.render();
      this.emitChange();
    };
    this.bind();
    this.loadFields();
    this.render();
  }

  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(name: string, _old: string | null, value: string | null): void {
    if (name === 'source' && value) this.load(value);
    else if (name === 'greyscale') {
      this.mono = value !== null;
      this.render();
    } else if (name === 'save-label') this.$('save').textContent = value || 'Save';
  }

  /* ---------- public API ---------- */

  get source(): DrillSource {
    return this.model.toSource();
  }
  set source(value: DrillSource | string | null) {
    if (value !== null) this.load(value);
  }

  get greyscale(): boolean {
    return this.mono;
  }
  set greyscale(on: boolean) {
    this.toggleAttribute('greyscale', on);
  }

  /** Replaces the drawing with a validated source. Does not fire `change`. */
  load(input: DrillSource | string): ParseResult {
    const r = typeof input === 'string' ? parseText(input) : parseSource(input);
    if (!r.ok) {
      this.dispatchEvent(new CustomEvent<SourceErrorDetail>('source-error', { detail: { errors: r.errors } }));
      return r;
    }
    this.model.load(r.source, { undoable: false });
    this.sel = null;
    this.loadFields();
    this.render();
    return r;
  }

  getSource(): DrillSource {
    return this.model.toSource();
  }

  /** The export: always in color, the same as Get SVG. */
  getSvg(): string {
    return renderSvg(this.model.toSource());
  }

  /* ---------- plumbing ---------- */

  private $(id: string): HTMLElement {
    const el = this.shadow.getElementById(id);
    if (!el) throw new Error('drillplot: missing #' + id);
    return el;
  }
  private input(id: string): HTMLInputElement {
    return this.$(id) as HTMLInputElement;
  }
  private all(sel: string): HTMLElement[] {
    return [...this.shadow.querySelectorAll<HTMLElement>(sel)];
  }

  private emitChange(): void {
    if (this.quiet) return;
    this.dispatchEvent(new CustomEvent<ChangeDetail>('change', { detail: { source: this.model.toSource() }, bubbles: true, composed: true }));
  }
  private save(): void {
    this.dispatchEvent(new CustomEvent<SaveDetail>('save', { detail: { source: this.model.toSource(), svg: this.getSvg() }, bubbles: true, composed: true }));
  }

  private get landscape(): boolean {
    return this.model.meta.orient === 'landscape';
  }

  private loadFields(): void {
    this.input('title').value = this.model.meta.title;
    (this.$('caption') as HTMLTextAreaElement).value = this.model.meta.caption;
  }

  /** Runs a change to the view settings, then redraws and tells the host. */
  private setMeta(patch: Partial<DrillModel['meta']>): void {
    Object.assign(this.model.meta, patch);
    this.render();
    this.emitChange();
  }

  /* ---------- render ---------- */

  private render(): void {
    const m = this.model;
    const v = viewBox(m.meta.view, m.meta.side, m.meta.orient);
    const ctx = { orient: m.meta.orient, greyscale: this.mono };
    this.stage.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
    const world = this.landscape ? '<g data-world transform="rotate(-90)">' : '<g data-world>';
    this.stage.innerHTML =
      world +
      courtMarkup(courtView(m.meta.view, m.meta.side), ctx) +
      drawOrder(m.items)
        .map((it) => `<g class="piece" data-id="${it.id}">${itemMarkup(it, ctx)}${this.hit(it)}</g>`)
        .join('') +
      `<g>${this.overlay()}</g></g>`;
    this.stage.classList.toggle('drawing', this.tool !== 'select' || !!this.armed);
    this.syncUI();
  }

  private hit(it: Item): string {
    if (it.type !== 'move' && it.type !== 'ball') return '';
    return `<path d="${arrowGeom(it).d}" fill="none" stroke="transparent" stroke-width="2.4" pointer-events="stroke"/>`;
  }

  private overlay(): string {
    const it = this.model.byId(this.sel);
    if (!it) return '';
    const H = (name: string, x: number, y: number, sq = false): string =>
      sq
        ? `<rect class="handle" data-handle="${name}" x="${round2(x - 0.6)}" y="${round2(y - 0.6)}" width="1.2" height="1.2"/>`
        : `<circle class="handle" data-handle="${name}" cx="${round2(x)}" cy="${round2(y)}" r="0.75"/>`;
    switch (it.type) {
      case 'player':
        return `<circle class="sel-ring" cx="${it.x}" cy="${it.y}" r="1.8"/>`;
      case 'machine':
        return `<circle class="sel-ring" cx="${it.x}" cy="${it.y}" r="2.3"/>`;
      case 'cone':
        return `<circle class="sel-ring" cx="${it.x}" cy="${it.y}" r="1.5"/>`;
      case 'zone':
        return `<rect class="sel-ring" x="${it.x - 0.2}" y="${it.y - 0.2}" width="${it.w + 0.4}" height="${it.h + 0.4}"/>` + H('corner', it.x + it.w, it.y + it.h, true);
      default: {
        const g = arrowGeom(it.type === 'ball' ? it : { ...it, curve: false });
        return `<path class="sel-ring" d="${g.d}" style="stroke-width:.9px;stroke-opacity:.5;stroke-dasharray:none"/>` + H('p1', it.x1, it.y1) + H('p2', it.x2, it.y2);
      }
    }
  }

  private setIfIdle(id: string, val: string | number): void {
    const el = this.input(id);
    if (this.shadow.activeElement !== el) el.value = String(val);
  }

  private syncUI(): void {
    const m = this.model;
    const it = m.byId(this.sel);
    const meta = m.meta;
    (this.$('undo') as HTMLButtonElement).disabled = !m.canUndo();
    (this.$('redo') as HTMLButtonElement).disabled = !m.canRedo();
    (this.$('delete') as HTMLButtonElement).disabled = !it;
    this.input('view-' + meta.view).checked = true;
    this.input('orient-' + meta.orient).checked = true;
    this.input('mono').checked = this.mono;
    const half = this.$('half-side') as HTMLSelectElement;
    half.hidden = meta.view !== 'half';
    half.value = meta.side;
    half.options[0]!.textContent = this.landscape ? 'Right half' : 'Bottom half';
    half.options[1]!.textContent = this.landscape ? 'Left half' : 'Top half';

    const off = countOffView({ view: meta.view, side: meta.side, items: m.items });
    this.$('offview').textContent = off ? `${off} piece${off === 1 ? ' is' : 's are'} outside this view` : '';
    this.$('scale').textContent =
      meta.view === 'full'
        ? 'Drawn to scale: the court is 20 by 44 feet.'
        : meta.view === 'half'
          ? 'Drawn to scale: one half, 20 by 22 feet.'
          : 'Drawn to scale: both kitchens (7 feet each) and the net.';

    this.all('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(!this.armed && b.dataset['tool'] === this.tool)));
    this.all('[data-kind]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset['kind'] === this.armed)));
    this.$('hint').textContent = this.armed
      ? `Tap or click the court to place ${KIND_NAME[this.armed]}. You can also drag it there.`
      : this.tool === 'drive'
        ? 'Drag on the court from where the ball is hit to where it lands. A straight line, numbered in shot order.'
        : this.tool === 'drop'
          ? 'Drag on the court from the hit to the landing spot. The arrow curves, like a drop or a lob.'
          : this.tool === 'move'
            ? 'Drag to show where a player moves. Dashed arrow.'
            : 'Drag a piece to move it. Drag the white handles to reshape an arrow or resize a zone. Drag a button above onto the court to add a piece.';

    const pick = this.$('pick') as HTMLSelectElement;
    pick.innerHTML =
      `<option value="">${m.items.length ? 'Choose a piece' : 'Nothing on the court yet'}</option>` +
      drawOrder(m.items)
        .map((i) => `<option value="${i.id}">${esc(itemName(i))}</option>`)
        .join('');
    pick.value = this.sel ?? '';

    this.$('insp').hidden = !it;
    if (it) {
      this.$('insp-name').textContent = itemName(it);
      this.$('g-label').hidden = !(it.type === 'player' || it.type === 'zone');
      this.$('sel-label-l').textContent = it.type === 'zone' ? 'Zone label (optional)' : 'Label';
      this.input('sel-label').maxLength = it.type === 'zone' ? LIMITS.zoneLabelLength : LIMITS.playerLabelLength;
      this.$('g-team').hidden = it.type !== 'player';
      this.$('g-ball').hidden = it.type !== 'ball';
      this.$('g-aim').hidden = it.type !== 'machine';
      this.$('g-zone').hidden = it.type !== 'zone';
      this.$('g-pos').hidden = !POINT_KINDS.has(it.type);
      this.$('g-pos2').hidden = POINT_KINDS.has(it.type);
      if (it.type === 'player' || it.type === 'zone') this.setIfIdle('sel-label', it.label);
      if (it.type === 'player') (this.$('sel-team') as HTMLSelectElement).value = it.team;
      if (it.type === 'ball') this.input('sel-curve').checked = it.curve;
      if (it.type === 'machine') {
        this.setIfIdle('sel-aim', it.angle);
        this.$('sel-aim-v').textContent = String(it.angle);
      }
      if (it.type === 'zone') {
        this.setIfIdle('sel-w', round2(it.w));
        this.setIfIdle('sel-h', round2(it.h));
      }
      if ('x' in it) {
        this.setIfIdle('sel-x', it.x);
        this.setIfIdle('sel-y', it.y);
      } else {
        this.setIfIdle('sel-x1', it.x1);
        this.setIfIdle('sel-y1', it.y1);
        this.setIfIdle('sel-x2', it.x2);
        this.setIfIdle('sel-y2', it.y2);
      }
    }

    const balls = ballItems(m.items);
    this.$('shots-note').textContent = !balls.length
      ? 'No ball paths yet. Each new one gets the next number.'
      : hasShotGap(m.items)
        ? 'Numbers skip a shot. Renumber to close the gap.'
        : `${balls.length} shot${balls.length === 1 ? '' : 's'}, numbered 1 to ${balls.length}.`;
    (this.$('renumber') as HTMLButtonElement).disabled = !balls.length;
  }

  /* ---------- court coordinates ---------- */

  private toFt(cx: number, cy: number): { x: number; y: number } {
    const w = this.stage.querySelector<SVGGElement>('[data-world]') ?? this.stage;
    const ctm = w.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(cx, cy).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  /* ---------- behaviour ---------- */

  private place(kind: Kind, x: number, y: number): void {
    const it = this.model.add(kind, x, y);
    this.sel = it.id;
    this.armed = null;
    this.render();
  }

  private deleteSel(): void {
    if (this.sel) {
      this.model.delete(this.sel);
      this.sel = null;
      this.render();
    }
  }

  private hideClearConfirm(): void {
    this.$('clear-confirm').hidden = true;
    this.$('clear').hidden = false;
  }

  private showSheet(which: 'svg' | 'open' | null): void {
    this.$('sheet-svg').hidden = which !== 'svg';
    this.$('sheet-open').hidden = which !== 'open';
    if (which === 'svg') {
      const source = this.model.toSource();
      const svg = renderSvg(source);
      (this.$('out-svg') as HTMLTextAreaElement).value = svg;
      (this.$('out-json') as HTMLTextAreaElement).value = stringifySource(source);
      this.$('preview').innerHTML = renderSvg(source, { greyscale: this.mono });
      this.$('preview-note').textContent = this.mono ? 'Previewed in greyscale. The exported SVG keeps its colors.' : '';
      this.$('copy-svg-s').textContent = '';
      this.$('copy-json-s').textContent = '';
      this.$('sheet-svg-back').focus();
    } else if (which === 'open') {
      this.$('open-s').textContent = '';
      this.$('open-s').classList.remove('err');
      this.$('open-input').focus();
    }
  }

  private async copy(text: string, ta: HTMLTextAreaElement, status: HTMLElement): Promise<void> {
    status.classList.remove('err');
    try {
      await navigator.clipboard.writeText(text);
      status.textContent = 'Copied';
    } catch {
      ta.focus();
      ta.select();
      status.classList.add('err');
      status.textContent = 'Copying is blocked here. The text is selected: press Ctrl+C or Cmd+C.';
    }
  }

  private errorText(errors: ParseError[]): string {
    const first = errors.slice(0, 3).map((e) => (e.path ? `${e.message} (${e.path})` : e.message));
    const more = errors.length - first.length;
    return first.join(' ') + (more > 0 ? ` And ${more} more.` : '');
  }

  private sheetOpen(): boolean {
    return !this.$('sheet-svg').hidden || !this.$('sheet-open').hidden;
  }

  private nudgeSel(dx: number, dy: number): void {
    if (this.sel) this.model.nudge(this.sel, dx, dy);
  }

  private bind(): void {
    const m = this.model;
    const stage = this.stage;

    /* pointer on the court */
    stage.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.hideClearConfirm();
      const p = this.toFt(e.clientX, e.clientY);
      const target = e.target as Element;
      const hEl = target.closest<HTMLElement>('[data-handle]');
      const gEl = target.closest<HTMLElement>('[data-id]');
      const before = m.snap();
      if (hEl && m.byId(this.sel)) {
        this.drag = { mode: 'handle', h: hEl.dataset['handle'] ?? '', before };
      } else if (this.armed) {
        this.place(this.armed, p.x, p.y);
        e.preventDefault();
        return;
      } else if (this.tool !== 'select') {
        const sx = clampX(p.x);
        const sy = clampY(p.y);
        const it = m.addArrow(this.tool, sx, sy, sx, sy);
        m.items.push(it);
        this.sel = it.id;
        this.drag = { mode: 'draw', before, id: it.id };
      } else if (gEl && gEl.dataset['id']) {
        this.sel = gEl.dataset['id'];
        const cur = m.byId(this.sel);
        if (!cur) return;
        this.drag = { mode: 'move', before, p0: p, orig: JSON.parse(JSON.stringify(cur)) as EditorItem };
      } else {
        this.sel = null;
        this.render();
        return;
      }
      stage.setPointerCapture(e.pointerId);
      e.preventDefault();
      stage.focus({ preventScroll: true });
      this.render();
    });
    stage.addEventListener('pointermove', (e) => {
      const d = this.drag;
      if (!d) return;
      const p = this.toFt(e.clientX, e.clientY);
      const it = m.byId(this.sel);
      if (!it) return;
      if (d.mode === 'move') {
        moveBy(it, snapFt(p.x - d.p0.x), snapFt(p.y - d.p0.y), d.orig);
      } else if ((d.mode === 'draw' || (d.mode === 'handle' && d.h === 'p2')) && 'x2' in it) {
        it.x2 = clampX(p.x);
        it.y2 = clampY(p.y);
      } else if (d.mode === 'handle' && d.h === 'p1' && 'x1' in it) {
        it.x1 = clampX(p.x);
        it.y1 = clampY(p.y);
      } else if (d.mode === 'handle' && d.h === 'corner' && it.type === 'zone') {
        it.w = round2(clamp(snapFt(p.x - it.x), LIMITS.zoneWidth.min, Math.min(LIMITS.zoneWidth.max, 22 - it.x)));
        it.h = round2(clamp(snapFt(p.y - it.y), LIMITS.zoneHeight.min, Math.min(LIMITS.zoneHeight.max, 46 - it.y)));
      }
      this.render();
    });
    const endDrag = (): void => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      const it = m.byId(this.sel);
      if (d.mode === 'draw' && it && 'x2' in it && Math.hypot(it.x2 - it.x1, it.y2 - it.y1) < 1.5) {
        // a click, not a drag: no arrow
        m.items = m.items.filter((i) => i.id !== it.id);
        this.sel = null;
        this.render();
        return;
      }
      if (m.record(d.before)) this.emitChange();
      this.render();
    };
    stage.addEventListener('pointerup', endDrag);
    stage.addEventListener('pointercancel', endDrag);

    stage.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter') {
        if (this.armed) {
          const s = m.defaultSpot();
          this.place(this.armed, s.x, s.y);
          e.preventDefault();
        } else if (this.tool !== 'select') {
          const v = courtView(m.meta.view, m.meta.side);
          const cy = v.y + v.h / 2;
          const it = m.addArrow(this.tool, 10, cy + 4, 10, cy - 4);
          m.act(() => m.items.push(it));
          this.sel = it.id;
          this.render();
          e.preventDefault();
        }
        return;
      }
      if (!this.sel) return;
      const base: Record<string, [number, number]> = { ArrowLeft: [-0.5, 0], ArrowRight: [0.5, 0], ArrowUp: [0, -0.5], ArrowDown: [0, 0.5] };
      let step = base[e.key];
      if (!step) return;
      if (this.landscape) step = [-step[1], step[0]]; // screen right is court +y, screen up is court +x
      e.preventDefault();
      this.nudgeSel(step[0], step[1]);
    });

    /* palette: drag, tap to arm, or press Enter */
    const ghost = this.$('ghost');
    this.all('[data-kind]').forEach((b) => {
      const kind = b.dataset['kind'] as Kind;
      b.addEventListener('pointerdown', (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        const st = { x: e.clientX, y: e.clientY, moved: false };
        b.setPointerCapture(e.pointerId);
        const mv = (ev: PointerEvent): void => {
          if (!st.moved && Math.hypot(ev.clientX - st.x, ev.clientY - st.y) > 6) {
            st.moved = true;
            ghost.hidden = false;
            ghost.textContent = (b.textContent ?? '').trim().slice(0, 5);
          }
          if (st.moved) {
            ghost.style.left = ev.clientX + 'px';
            ghost.style.top = ev.clientY + 'px';
          }
        };
        const done = (ev: PointerEvent, drop: boolean): void => {
          b.removeEventListener('pointermove', mv);
          b.removeEventListener('pointerup', up);
          b.removeEventListener('pointercancel', cancel);
          ghost.hidden = true;
          if (!drop) return;
          if (st.moved) {
            const r = stage.getBoundingClientRect();
            if (ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom) {
              const p = this.toFt(ev.clientX, ev.clientY);
              this.place(kind, p.x, p.y);
            }
          } else {
            this.armed = this.armed === kind ? null : kind;
            this.tool = 'select';
            this.render();
          }
        };
        const up = (ev: PointerEvent): void => done(ev, true);
        const cancel = (ev: PointerEvent): void => done(ev, false);
        b.addEventListener('pointermove', mv);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', cancel);
      });
      b.addEventListener('click', (e) => {
        if (e.detail === 0) {
          const s = m.defaultSpot();
          this.place(kind, s.x, s.y);
        }
      });
    });
    this.all('[data-tool]').forEach((b) =>
      b.addEventListener('click', () => {
        this.tool = b.dataset['tool'] as Tool;
        this.armed = null;
        this.render();
      }),
    );

    /* toolbar */
    this.all('input[name="view"]').forEach((r) => r.addEventListener('change', () => this.setMeta({ view: (r as HTMLInputElement).value as DrillSource['view'] })));
    this.all('input[name="orient"]').forEach((r) => r.addEventListener('change', () => this.setMeta({ orient: (r as HTMLInputElement).value as DrillSource['orient'] })));
    this.$('half-side').addEventListener('change', (e) => this.setMeta({ side: (e.target as HTMLSelectElement).value as DrillSource['side'] }));
    this.$('mono').addEventListener('change', (e) => {
      this.mono = (e.target as HTMLInputElement).checked;
      this.toggleAttribute('greyscale', this.mono);
    });
    this.$('undo').addEventListener('click', () => m.undo());
    this.$('redo').addEventListener('click', () => m.redo());
    this.$('delete').addEventListener('click', () => this.deleteSel());
    this.$('clear').addEventListener('click', () => {
      if (!m.items.length) return;
      this.$('clear').hidden = true;
      this.$('clear-confirm').hidden = false;
      this.$('clear-no').focus();
    });
    this.$('clear-no').addEventListener('click', () => {
      this.hideClearConfirm();
      this.$('clear').focus();
    });
    this.$('clear-yes').addEventListener('click', () => {
      this.sel = null;
      m.clear();
      this.hideClearConfirm();
      this.$('clear').focus();
    });
    this.$('title').addEventListener('input', (e) => {
      m.meta.title = (e.target as HTMLInputElement).value;
      this.emitChange();
    });
    this.$('caption').addEventListener('input', (e) => {
      m.meta.caption = (e.target as HTMLTextAreaElement).value;
      this.emitChange();
    });
    this.$('pick').addEventListener('change', (e) => {
      this.sel = (e.target as HTMLSelectElement).value || null;
      this.render();
    });

    /* inspector */
    const cur = (): EditorItem | undefined => m.byId(this.sel);
    const label = this.input('sel-label');
    label.addEventListener('focus', () => {
      this.labelBefore = m.snap();
    });
    label.addEventListener('input', () => {
      const it = cur();
      if (it && (it.type === 'player' || it.type === 'zone')) {
        it.label = label.value;
        this.render();
      }
    });
    label.addEventListener('change', () => {
      if (this.labelBefore && m.record(this.labelBefore)) this.emitChange();
      this.labelBefore = null;
      this.render();
    });
    this.$('sel-team').addEventListener('change', (e) =>
      m.act(() => {
        const it = cur();
        if (it?.type === 'player') it.team = (e.target as HTMLSelectElement).value as typeof it.team;
      }),
    );
    this.$('sel-curve').addEventListener('change', (e) =>
      m.act(() => {
        const it = cur();
        if (it?.type === 'ball') it.curve = (e.target as HTMLInputElement).checked;
      }),
    );
    this.$('sel-flip').addEventListener('click', () =>
      m.act(() => {
        const it = cur();
        if (it?.type === 'ball') {
          it.curve = true;
          it.bend = it.bend === -1 ? 1 : -1;
        }
      }),
    );
    this.$('sel-earlier').addEventListener('click', () => this.sel && m.shiftShot(this.sel, -1));
    this.$('sel-later').addEventListener('click', () => this.sel && m.shiftShot(this.sel, 1));
    const aim = this.input('sel-aim');
    aim.addEventListener('pointerdown', () => {
      this.aimBefore = m.snap();
    });
    aim.addEventListener('focus', () => {
      this.aimBefore = m.snap();
    });
    aim.addEventListener('input', () => {
      const it = cur();
      if (it?.type === 'machine') {
        it.angle = +aim.value;
        this.render();
      }
    });
    aim.addEventListener('change', () => {
      if (this.aimBefore && m.record(this.aimBefore)) this.emitChange();
      this.aimBefore = null;
      this.render();
    });
    (['sel-w', 'sel-h'] as const).forEach((id) =>
      this.$(id).addEventListener('change', (e) =>
        m.act(() => {
          const it = cur();
          if (it?.type !== 'zone') return;
          const raw = +(e.target as HTMLInputElement).value || 1;
          if (id === 'sel-w') it.w = round2(clamp(raw, LIMITS.zoneWidth.min, LIMITS.zoneWidth.max));
          else it.h = round2(clamp(raw, LIMITS.zoneHeight.min, LIMITS.zoneHeight.max));
        }),
      ),
    );
    // exact positions, so everything can be done without a pointer
    (['sel-x', 'sel-y', 'sel-x1', 'sel-y1', 'sel-x2', 'sel-y2'] as const).forEach((id) =>
      this.$(id).addEventListener('change', (e) =>
        m.act(() => {
          const it = cur();
          const raw = (e.target as HTMLInputElement).value;
          if (!it || raw.trim() === '' || !Number.isFinite(+raw)) return;
          const key = id.slice(4) as 'x' | 'y' | 'x1' | 'y1' | 'x2' | 'y2';
          const v = key.startsWith('x') ? clampX(+raw) : clampY(+raw);
          (it as unknown as Record<string, number>)[key] = v;
        }),
      ),
    );
    this.$('renumber').addEventListener('click', () => m.renumber());

    /* sheets */
    const back = (id: string, opener: string) =>
      this.$(id).addEventListener('click', () => {
        this.showSheet(null);
        this.$(opener).focus();
      });
    this.$('open-svg').addEventListener('click', () => this.showSheet('svg'));
    this.$('open-src').addEventListener('click', () => this.showSheet('open'));
    back('sheet-svg-back', 'open-svg');
    back('sheet-open-back', 'open-src');
    this.$('copy-svg').addEventListener('click', () => void this.copy((this.$('out-svg') as HTMLTextAreaElement).value, this.$('out-svg') as HTMLTextAreaElement, this.$('copy-svg-s')));
    this.$('copy-json').addEventListener('click', () => void this.copy((this.$('out-json') as HTMLTextAreaElement).value, this.$('out-json') as HTMLTextAreaElement, this.$('copy-json-s')));
    this.$('open-go').addEventListener('click', () => {
      const s = this.$('open-s');
      const r = parseText((this.$('open-input') as HTMLTextAreaElement).value);
      if (r.ok) {
        m.load(r.source, { undoable: true });
        this.sel = null;
        this.loadFields();
        this.render();
        this.emitChange();
        s.classList.remove('err');
        s.textContent = `Opened "${r.source.title || 'Untitled'}". Go back to drawing to keep working.`;
      } else {
        s.classList.add('err');
        s.textContent = this.errorText(r.errors);
      }
    });
    this.$('save').addEventListener('click', () => this.save());

    /* keys that work anywhere in the editor */
    this.shadow.addEventListener('keydown', (ev) => {
      const e = ev as KeyboardEvent;
      const t = e.composedPath()[0] as HTMLElement | undefined;
      const tag = t?.tagName;
      const editable = !!t && ((tag === 'INPUT' && (t as HTMLInputElement).type !== 'checkbox' && (t as HTMLInputElement).type !== 'range' && (t as HTMLInputElement).type !== 'radio') || tag === 'TEXTAREA' || tag === 'SELECT');
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.save();
        return;
      }
      if (e.key === 'Escape') {
        if (this.sheetOpen()) {
          this.showSheet(null);
          return;
        }
        if (!this.$('clear-confirm').hidden) {
          this.hideClearConfirm();
          return;
        }
        if (this.armed || this.tool !== 'select' || this.sel) {
          this.armed = null;
          this.tool = 'select';
          this.sel = null;
          this.render();
        }
        return;
      }
      if (mod && !editable && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) m.redo();
        else m.undo();
        return;
      }
      if (mod && !editable && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        m.redo();
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && !editable && this.sel && !this.sheetOpen() && tag !== 'BUTTON') {
        e.preventDefault();
        this.deleteSel();
      }
    });
  }
}

