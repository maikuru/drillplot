/** Public theme tokens. A host app sets any of these on <drillplot-editor> (or an ancestor). */
const COLOR_TOKENS = [
  'font', 'surface', 'surface-sunken', 'surface-raised', 'border', 'border-strong', 'text', 'text-muted',
  'accent', 'accent-text', 'accent-quiet', 'danger', 'danger-quiet', 'focus', 'stage-bg', 'select',
] as const;

/** Every public custom property is --drillplot-<name>. The last four are sizes, not colors. */
export const TOKENS = [...COLOR_TOKENS, 'radius', 'touch-target', 'stage-height', 'side-width'] as const;

const LIGHT: Record<(typeof COLOR_TOKENS)[number], string> = {
  font: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  surface: '#ffffff',
  'surface-sunken': '#f3f3ef',
  'surface-raised': '#ffffff',
  border: '#d8dbe0',
  'border-strong': '#8a9099',
  text: '#16191d',
  'text-muted': '#5b6169',
  accent: '#2d5a27',
  'accent-text': '#ffffff',
  'accent-quiet': '#e8f0e6',
  danger: '#a4262c',
  'danger-quiet': '#fbeaea',
  focus: '#1e4d8c',
  'stage-bg': '#e4e8e2',
  select: '#00a3b4',
};
const DARK: Partial<typeof LIGHT> = {
  surface: '#16191d',
  'surface-sunken': '#101316',
  'surface-raised': '#1d2126',
  border: '#2f343b',
  'border-strong': '#6b727c',
  text: '#eef0f2',
  'text-muted': '#a3aab3',
  accent: '#8cc97a',
  'accent-text': '#0f170d',
  'accent-quiet': '#1b2a18',
  danger: '#f1707a',
  'danger-quiet': '#2a1416',
  focus: '#8fb8f0',
  'stage-bg': '#0c0f11',
  select: '#7df9ff',
};
const decl = (m: Partial<typeof LIGHT>): string => Object.entries(m).map(([k, v]) => `--_${k}: ${v};`).join(' ');
const alias = COLOR_TOKENS.map((k) => `--${k}: var(--drillplot-${k}, var(--_${k}));`).join(' ');

export const CSS = `
:host { display: flex; flex-direction: column; color-scheme: light dark; ${decl(LIGHT)} }
@media (prefers-color-scheme: dark) { :host(:not([theme="light"])) { ${decl(DARK)} color-scheme: dark; } }
:host([theme="dark"]) { ${decl(DARK)} color-scheme: dark; }
:host([theme="light"]) { color-scheme: light; }
:host([hidden]) { display: none; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.root { ${alias}
  --radius: var(--drillplot-radius, 6px); --touch: var(--drillplot-touch-target, 44px);
  display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; position: relative;
  font-family: var(--font); font-size: 16px; line-height: 1.4; color: var(--text);
  background: var(--surface); border: 1px solid var(--border); border-radius: calc(var(--radius) + 4px); overflow: hidden; }
button, input, select, textarea { font: inherit; color: inherit; }
:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
h3 { font-size: 1rem; font-weight: 700; margin: 0 0 .5rem; }
.btn { min-height: var(--touch); padding: 0 .9rem; border: 1px solid var(--border-strong); background: var(--surface-raised); border-radius: var(--radius); cursor: pointer; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }
.btn:hover:not(:disabled) { background: var(--surface-sunken); }
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn.primary { background: var(--accent); color: var(--accent-text); border-color: var(--accent); }
.btn.primary:hover:not(:disabled) { background: var(--accent); filter: brightness(1.1); }
.btn.danger { color: var(--danger); border-color: var(--danger); }
.btn.sm { min-height: 36px; padding: 0 .7rem; font-size: .92rem; }
.btn[aria-pressed="true"], .btn[aria-pressed="true"]:hover:not(:disabled) { background: var(--accent); border-color: var(--accent); color: var(--accent-text); }
.tools { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; padding: .5rem .75rem; border-bottom: 1px solid var(--border); background: var(--surface-sunken); }
.sp { flex: 1; }
.seg { display: inline-flex; border: 1px solid var(--border-strong); border-radius: var(--radius); background: var(--surface-raised); }
.seg input { position: absolute; opacity: 0; pointer-events: none; }
.seg label { min-height: var(--touch); padding: 0 .75rem; display: inline-flex; align-items: center; cursor: pointer; font-weight: 600; border-right: 1px solid var(--border); }
.seg label:first-of-type { border-radius: calc(var(--radius) - 1px) 0 0 calc(var(--radius) - 1px); }
.seg label:last-of-type { border-right: 0; border-radius: 0 calc(var(--radius) - 1px) calc(var(--radius) - 1px) 0; }
.seg input:checked + label { background: var(--accent); color: var(--accent-text); }
.seg input:focus-visible + label { outline: 3px solid var(--focus); outline-offset: 2px; position: relative; z-index: 1; }
.sel, .field input[type=text], .field input[type=number], .field select, .field textarea, .ta { width: 100%; min-height: var(--touch); padding: 6px 10px; border: 1px solid var(--border-strong); border-radius: var(--radius); background: var(--surface-raised); }
.sel { width: auto; padding: 0 .5rem; }
.confirm { display: inline-flex; flex-wrap: wrap; align-items: center; gap: .5rem; background: var(--danger-quiet); border: 1px solid var(--danger); border-radius: var(--radius); padding: 2px .5rem; }
/* The court area is --drillplot-stage-height tall, or fills the editor when the host gives the element a height.
   Its row never grows with the side panel, which scrolls on its own; the court then scales to fit both ways. */
.body { position: relative; flex: 1 1 var(--drillplot-stage-height, min(78vh, 760px)); min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) var(--drillplot-side-width, 340px); grid-template-rows: minmax(0, 1fr); }
.stage-col { min-height: 0; min-width: 0; display: flex; flex-direction: column; background: var(--stage-bg); }
.stage-wrap { flex: 1 1 0; min-height: 0; min-width: 0; padding: .5rem; display: flex; }
.stage { display: block; width: 100%; height: 100%; min-height: 0; touch-action: none; user-select: none; -webkit-user-select: none; border-radius: var(--radius); cursor: default; }
.stage.drawing { cursor: crosshair; }
.note { display: flex; justify-content: space-between; gap: .75rem; padding: 6px .75rem; font-size: .9rem; color: var(--text-muted); border-top: 1px solid var(--border); background: var(--surface); }
.side { min-height: 0; overflow: auto; padding: .75rem 1rem; border-left: 1px solid var(--border); display: flex; flex-direction: column; gap: 1rem; }
.field { display: flex; flex-direction: column; gap: 4px; }
.field label, .lbl { font-weight: 600; font-size: .92rem; }
.field textarea { min-height: 64px; resize: vertical; }
.row { display: flex; flex-wrap: wrap; gap: .5rem; }
.row > .field { flex: 1 1 5rem; }
.pal .btn { touch-action: none; user-select: none; -webkit-user-select: none; min-width: 48px; }
.dot { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--border-strong); display: inline-block; flex: none; }
.dot.orange { background: #e69f00; } .dot.blue { background: #0072b2; } .dot.black { background: #1a1a1a; }
.dot.sq { border-radius: 3px; background: #3d3d3d; } .dot.cone { border-radius: 2px; background: #ff5a1f; } .dot.zone { border-radius: 3px; background: #ff922b; }
.dot.key { background: #fff; color: #1a1a1a; border-color: #1a1a1a; font-size: 11px; font-weight: 700; line-height: 14px; text-align: center; }
.legend-rows { display: flex; flex-direction: column; gap: .5rem; }
.legend-row { display: grid; grid-template-columns: 4.2rem minmax(0, 1fr) auto; gap: .4rem; align-items: end; }
.legend-row .wide { grid-column: 1 / -1; }
.hint { font-size: .92rem; color: var(--text-muted); margin: .5rem 0 0; min-height: 2.8em; }
.small { font-size: .88rem; color: var(--text-muted); margin: 0; }
.insp { border: 1px solid var(--border); border-radius: var(--radius); padding: .75rem; background: var(--surface-sunken); display: flex; flex-direction: column; gap: .75rem; margin-top: .5rem; }
.check { display: flex; align-items: center; gap: .5rem; min-height: var(--touch); font-weight: 600; }
.check input { width: 22px; height: 22px; accent-color: var(--accent); }
.foot { display: flex; flex-wrap: wrap; gap: .5rem; align-items: center; padding: .75rem 1rem; border-top: 1px solid var(--border); background: var(--surface-sunken); }
.sheet { position: absolute; inset: 0; z-index: 3; background: var(--surface); overflow: auto; padding: 1rem; display: flex; flex-direction: column; gap: .75rem; }
.sheet-head { display: flex; justify-content: space-between; align-items: center; gap: .75rem; flex-wrap: wrap; }
.sheet-head h3 { font-size: 1.2rem; margin: 0; }
.sheet-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 260px); gap: 1rem; }
.col { display: flex; flex-direction: column; gap: .75rem; min-width: 0; }
.ta { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: .8rem; line-height: 1.35; min-height: 180px; resize: vertical; }
.preview { background: var(--stage-bg); border-radius: var(--radius); padding: .5rem; align-self: start; }
.preview svg { display: block; width: 100%; height: auto; max-height: 360px; }
.status { min-height: 1.4em; font-weight: 600; color: var(--accent); }
.status.err { color: var(--danger); }
.ghost { position: fixed; z-index: 50; pointer-events: none; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%; background: var(--accent); color: var(--accent-text); display: grid; place-items: center; font-weight: 700; opacity: .85; font-size: .8rem; }
.sel-ring { fill: none; stroke: var(--select); stroke-width: .2px; stroke-dasharray: .5 .4; pointer-events: none; }
.handle { fill: #fff; stroke: #0b6c7a; stroke-width: .18px; cursor: grab; }
.piece { cursor: grab; }
.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 760px) {
  .body { display: block; flex: none; }
  .stage-wrap { flex: none; height: var(--drillplot-stage-height, clamp(300px, 62vh, 560px)); }
  .side { border-left: 0; border-top: 1px solid var(--border); overflow: visible; }
  .sheet-grid { grid-template-columns: 1fr; }
  .foot .sp { display: none; }
  .note { flex-direction: column; gap: 0; }
}
@media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
`;
