# API reference

Every public export of the three entry points of `drillplot`. The signatures come from the package's generated declarations (`dist/types`), and `npm run docs:check` fails if an export is missing from this page (see [CONTRIBUTING.md](../CONTRIBUTING.md)). The format itself is specified in [format.md](format.md).

| Entry point | Contents |
| --- | --- |
| `drillplot` | [Format](#format-constants-and-limits), [validation](#validation-and-parsing), [shot helpers](#shot-numbering), [rendering](#rendering), [geometry](#geometry), [sample](#sampledrill), [types](#types). No DOM needed. |
| `drillplot/editor` | [The element](#drillploteditor-the-editor-element), [`defineDrillplotEditor`](#definedrillploteditorname), [`DrillModel`](#drillmodel), [`TOKENS`](#tokens), [event detail types](#event-detail-types). Needs a browser. |
| `drillplot/schema` | [The JSON Schema](#drillplotschema). |

The package is ESM only. Every example below is a module.

**Contents:** [Format constants and limits](#format-constants-and-limits) · [Validation and parsing](#validation-and-parsing) · [Shot numbering](#shot-numbering) · [Rendering](#rendering) · [Geometry](#geometry) · [sampleDrill](#sampledrill) · [Types](#types) · [drillplot/editor](#drillploteditor) · [drillplot/schema](#drillplotschema)

## `drillplot`

### Format constants and limits

All are exported values, read-only (`as const` or `Readonly`).

| Export | Type | Value and meaning |
| --- | --- | --- |
| `FORMAT_NAME` | `'drill-diagram'` | The `format` every source carries. |
| `FORMAT_VERSION` | `1` | The format version this package reads and writes. |
| `COURT` | `{ width: 20; length: 44; netY: 22; kitchen: 7 }` | Court geometry, in feet. |
| `MARGIN` | `2` | How far outside the court lines a position may sit, in feet. |
| `BOUNDS` | `{ xMin: number; xMax: number; yMin: number; yMax: number }` | The court plus `MARGIN`: the allowed range of positions. |
| `LIMITS` | see below | Input caps. |
| `PLAYER_COLORS` | `readonly ['orange', 'blue', 'white', 'black']` | The valid `team` values. |
| `LEGACY_TEAMS` | `Readonly<Record<string, PlayerColor>>` | `{ t1: 'orange', t2: 'blue', coach: 'black' }`, the older keys that still open. |

`LIMITS` is `{ maxItems: 200, maxShot: 200, titleLength: 120, captionLength: 300, playerLabelLength: 8, zoneLabelLength: 24, zoneWidth: { min: 1, max: 20 }, zoneHeight: { min: 1, max: 44 } }`.

```js
import { COURT, BOUNDS, LIMITS } from 'drillplot';

COURT.netY; // 22
BOUNDS.xMax; // 22
LIMITS.maxItems; // 200
```

### Validation and parsing

#### `parseSource(input)`

```ts
function parseSource(input: unknown): ParseResult
```

Validates and normalizes a drill diagram. This is the function to use on anything that did not come from your own code.

- **`input`**: an already parsed value, or a JSON string.
- **Returns** `{ ok: true, source: DrillSource }` with defaults filled in, numbers rounded to two decimals, unknown properties dropped and [legacy team keys](format.md#legacy-team-keys) mapped; or `{ ok: false, errors: ParseError[] }` with every problem found.
- **Throws** nothing for bad input: every failure is in the result. A non-string, non-object `input` is `not_an_object`; a string that is not JSON is `not_json`.

```js
import { parseSource } from 'drillplot';

const r = parseSource('{"format":"drill-diagram","version":1,"items":[{"type":"player","x":7,"y":40,"team":"t1"}]}');
r.ok; // true
r.source.items[0]; // { type: 'player', x: 7, y: 40, label: '', team: 'orange' }

parseSource({ format: 'drill-diagram', version: 1, items: [{ type: 'cone', x: 30, y: 1 }] });
// { ok: false, errors: [{ key: 'out_of_bounds', path: '/items/0/x', message: '...' }] }
```

#### `validateSource(input)`

```ts
function validateSource(input: unknown): ParseError[]
```

Only the errors of `parseSource`: an empty array when the input is valid. Accepts the same inputs, throws nothing.

```js
import { validateSource } from 'drillplot';

validateSource({}).map((e) => e.key + e.path); // ['wrong_format/format', 'items_not_array/items']
```

#### `parseText(input)`

```ts
function parseText(input: string): ParseResult
```

Opens a diagram from pasted text: an SVG exported by drillplot (the source is read from its `<metadata>`) or the JSON source. No DOM needed, so it works in Node.

- **`input`**: the text. Leading and trailing whitespace is ignored. Text starting with `<` is treated as an SVG; anything else as JSON.
- **Returns** a `ParseResult`. On top of the `parseSource` keys, it can fail with `empty_input` (nothing to read), `no_svg_source` (an SVG without an embedded source) and `bad_svg_source` (the embedded source is not valid JSON), each with path `""`.

```js
import { parseText, renderSvg, sampleDrill } from 'drillplot';

const svg = renderSvg(sampleDrill());
parseText(svg).ok; // true: the source travels in the SVG
parseText('<svg/>').errors[0].key; // 'no_svg_source'
parseText('  ').errors[0].key; // 'empty_input'
```

#### `extractSourceText(svg)`

```ts
function extractSourceText(svg: string): string | null
```

Pulls the embedded source text out of an SVG, without parsing it. Returns `null` when there is no `<metadata>` or it is empty. Ignores a `<metadata>` inside an XML comment, decodes XML entities, and also reads a CDATA section (an earlier exporter used CDATA).

```js
import { extractSourceText, renderSvg, emptySource } from 'drillplot';

extractSourceText(renderSvg(emptySource())); // '{\n "format": "drill-diagram", ...'
extractSourceText('<svg/>'); // null
```

#### `stringifySource(source)`

```ts
function stringifySource(source: DrillSource): string
```

The source as JSON text with keys in a fixed order and one-space indentation, as stored in a file or copied from the editor. The same drawing is always the same text. It does not validate; pass a normalized source.

#### `embedSource(source)`

```ts
function embedSource(source: DrillSource): string
```

`stringifySource` with `&`, `<` and `>` XML-escaped (and U+FFFE and U+FFFF written as escapes), which is exactly what `renderSvg` puts inside `<metadata>`. Exported from `drillplot` although it belongs with rendering.

#### `errorMessage(key)`

```ts
function errorMessage(key: ErrorKey): string
```

The English message for an error key. The `message` of every `ParseError` is this text. Messages may be reworded between releases; branch on `key`.

```js
import { errorMessage } from 'drillplot';

errorMessage('bad_bend'); // 'The bend must be 1 or -1.'
```

#### `emptySource()`

```ts
function emptySource(): DrillSource
```

A valid source with nothing on the court: `format` and `version` set, empty `title` and `caption`, `view: 'full'`, `side: 'bottom'`, `orient: 'portrait'`, `items: []`. A fresh object on every call.

### Shot numbering

Ball paths carry a shot number `n`. These helpers work on an `items` array.

#### `ballItems(items)`

```ts
function ballItems<T extends Item>(items: readonly T[]): Extract<T, Ball>[]
```

The ball paths in shot order (by `n`; equal numbers keep their list order). Returns a new array of the same objects.

#### `nextShotNumber(items)`

```ts
function nextShotNumber(items: readonly Item[]): number
```

One more than the highest `n` among the ball paths, or 1 when there are none. It can be above `LIMITS.maxShot`; the editor caps what it assigns.

#### `hasShotGap(items)`

```ts
function hasShotGap(items: readonly Item[]): boolean
```

`true` when, in shot order, the numbers are not exactly 1, 2, 3 and so on up to the count.

#### `renumberShots(items)`

```ts
function renumberShots(items: readonly Item[]): void
```

Numbers the ball paths 1 to N in their current order. **Mutates** the ball items it is given.

```js
import { sampleDrill, hasShotGap, renumberShots, nextShotNumber, ballItems } from 'drillplot';

const d = sampleDrill();
nextShotNumber(d.items); // 3
d.items[9].n = 5;
hasShotGap(d.items); // true
renumberShots(d.items);
ballItems(d.items).map((b) => b.n); // [1, 2]
```

### Rendering

#### `renderSvg(source, options?)`

```ts
function renderSvg(source: DrillSource, options?: RenderOptions): string

interface RenderOptions {
  greyscale?: boolean; // default false
}
```

Renders a source to a standalone SVG string.

- **`source`**: a validated `DrillSource`, ideally from `parseSource`. The renderer does not validate and is not defensive about malformed input.
- **`options.greyscale`**: draw every color as its grey (luma, the same weights as the CSS `grayscale()` filter). For display only; exports should keep their colors.
- **Returns** the SVG text. Deterministic: the same source gives the same text. Explicit fills and strokes (no CSS, no `currentColor`), a `viewBox`, `width` and `height` at 16 pixels per foot, `role="img"`, an `aria-label` and `<title>` (the title, or "Drill diagram"), a `<desc>` when there is a caption, the source in `<metadata>`, and no `id` or `class`. Text is XML-escaped and characters XML cannot carry are removed.
- **Throws** nothing for valid input.

```js
import { writeFileSync } from 'node:fs';
import { parseSource, renderSvg, sampleDrill } from 'drillplot';

const r = parseSource(sampleDrill());
if (r.ok) writeFileSync('drill.svg', renderSvg(r.source));
const grey = renderSvg(sampleDrill(), { greyscale: true });
```

#### `PLAYER_PALETTE`

```ts
const PLAYER_PALETTE: Record<PlayerColor, readonly [string, string, string]>
```

The player colors as `[fill, letter, outline]` hex strings: `orange` `['#e69f00', '#1a1a1a', '#ffffff']`, `blue` `['#0072b2', '#ffffff', '#ffffff']`, `white` `['#ffffff', '#1a1a1a', '#1a1a1a']`, `black` `['#1a1a1a', '#ffffff', '#ffffff']`. The Okabe-Ito set, chosen to differ in lightness as well as hue.

#### `toGrey(hex)`

```ts
function toGrey(hex: string): string
```

The luma of a `#rrggbb` color as a grey hex (`0.2126 R + 0.7152 G + 0.0722 B`). Anything that is not a six-digit hex color is returned unchanged.

```js
import { toGrey } from 'drillplot';

toGrey('#e69f00'); // '#a3a3a3'
```

### Geometry

The framing and arrow maths the renderer and the editor share. Court feet throughout.

#### `VIEWS`

```ts
const VIEWS: {
  readonly full: Rect;       // { x: -2.5, y: -2.5, w: 25, h: 49 }
  readonly kitchen: Rect;    // { x: -2.5, y: 13, w: 25, h: 18 }
  readonly halfBottom: Rect; // { x: -2.5, y: 19.5, w: 25, h: 27 }
  readonly halfTop: Rect;    // { x: -2.5, y: -2.5, w: 25, h: 27 }
}
```

The framed areas in portrait (see [Views](format.md#views)).

#### `courtView(view, side)`

```ts
function courtView(view: CourtView, side: HalfSide): Rect
```

The framed area, in court feet and portrait, for a view. `side` only matters for `'half'`.

#### `viewBox(view, side, orient)`

```ts
function viewBox(view: CourtView, side: HalfSide, orient: Orientation): Rect
```

What is visible on the page: `courtView` for portrait, and for landscape the same area after the quarter turn (`rotate(-90)` maps a court point `(x, y)` to `(y, -x)`). This is the SVG `viewBox`.

```js
import { viewBox, courtView } from 'drillplot';

viewBox('full', 'bottom', 'portrait'); // { x: -2.5, y: -2.5, w: 25, h: 49 }
viewBox('half', 'bottom', 'landscape'); // { x: 19.5, y: -22.5, w: 27, h: 25 }
courtView('half', 'top'); // { x: -2.5, y: -2.5, w: 25, h: 27 }
```

#### `countOffView(source)`

```ts
function countOffView(source: Pick<DrillSource, 'view' | 'side' | 'items'>): number
```

How many items sit outside the framed area (an arrow counts by the midpoint of its ends). The editor uses it for "N pieces are outside this view".

```js
import { countOffView, sampleDrill } from 'drillplot';

countOffView(sampleDrill()); // 0
countOffView({ ...sampleDrill(), view: 'kitchen' }); // 6
```

#### `arrowGeom(arrow)`

```ts
function arrowGeom(it: {
  x1: number; y1: number; x2: number; y2: number;
  curve?: boolean; bend?: number;
}): { poly: string; d: string; mx: number; my: number }
```

The geometry of a `move` or `ball` item. `poly` is the arrowhead as SVG `points`; `d` is the shaft path, ending where the head starts (a straight `M L`, or with `curve` a quadratic `M Q` that bows to the `bend` side); `mx, my` is the midpoint, where the shot number badge sits. A `bend` of `-1` bows the other way; any other value is treated as `1`.

```js
import { arrowGeom } from 'drillplot';

arrowGeom({ x1: 0, y1: 0, x2: 10, y2: 0, curve: true, bend: 1 });
// { poly: '10,0 9.03,1.03 8.59,0.02', d: 'M0 0Q5 2.2 8.81 0.52', mx: 5, my: 1.1 }
```

The return type is not exported by name; use `ReturnType<typeof arrowGeom>`.

#### `drawOrder(items)`

```ts
function drawOrder<T extends Item>(items: readonly T[]): T[]
```

The items back to front: zones, cones, machines, players, movement arrows, ball paths; stable within a layer. A new array.

### `sampleDrill()`

```ts
function sampleDrill(): DrillSource
```

A small worked example, "Third-shot drop and walk in": ten items, valid. A fresh object on every call; the full text is in [format.md](format.md#examples).

### Types

All are type-only exports of `drillplot`.

```ts
type PlayerColor = 'orange' | 'blue' | 'white' | 'black';
type CourtView = 'full' | 'half' | 'kitchen';
type HalfSide = 'bottom' | 'top';
type Orientation = 'portrait' | 'landscape';

interface Player  { type: 'player';  x: number; y: number; label: string; team: PlayerColor }
interface Machine { type: 'machine'; x: number; y: number; angle: number }
interface Cone    { type: 'cone';    x: number; y: number }
interface Zone    { type: 'zone';    x: number; y: number; w: number; h: number; label: string }
interface Move    { type: 'move';    x1: number; y1: number; x2: number; y2: number }
interface Ball    { type: 'ball';    x1: number; y1: number; x2: number; y2: number; curve: boolean; bend: 1 | -1; n: number }

type Item = Player | Machine | Cone | Zone | Move | Ball;
type ItemType = Item['type'];

interface DrillSource {
  format: 'drill-diagram';
  version: 1;
  title: string;
  caption: string;
  view: CourtView;
  side: HalfSide;
  orient: Orientation;
  items: Item[];
}

interface ParseError { key: ErrorKey; path: string; message: string }
type ParseResult = { ok: true; source: DrillSource } | { ok: false; errors: ParseError[] };
type ErrorKey = 'not_json' | 'not_an_object' | 'wrong_format' | 'unsupported_version' | 'not_text'
  | 'title_too_long' | 'caption_too_long' | 'label_too_long' | 'bad_character' | 'bad_view' | 'bad_side'
  | 'bad_orient' | 'items_not_array' | 'too_many_items' | 'item_not_object' | 'unknown_item_type'
  | 'not_a_number' | 'out_of_bounds' | 'bad_size' | 'bad_angle' | 'bad_team' | 'bad_bend'
  | 'bad_shot_number' | 'not_boolean' | 'no_svg_source' | 'bad_svg_source' | 'empty_input';

interface RenderOptions { greyscale?: boolean }
interface Rect { x: number; y: number; w: number; h: number }
```

`DrillSource` is what a *validated* source looks like: every field present. What a document may leave out is in [format.md](format.md#the-document). `ParseError.path` is a JSON-pointer-like location such as `/items/3/x`, or `""` for the whole document. Each `ErrorKey` is explained in [format.md](format.md#error-keys).

```ts
import { parseSource, type DrillSource, type ErrorKey } from 'drillplot';

function load(text: string): DrillSource {
  const r = parseSource(text);
  if (!r.ok) {
    const keys: ErrorKey[] = r.errors.map((e) => e.key);
    throw new Error('Not a drill diagram: ' + keys.join(', '));
  }
  return r.source;
}
```

## `drillplot/editor`

Importing this module registers `<drillplot-editor>` (when `customElements` exists) and needs a browser: **it throws where `HTMLElement` is not defined**, so import it only on the client. The attributes, events, keyboard shortcuts, theming and parts are in the [README](../README.md#the-editor-reference); this section is the programmatic surface.

### `DrillplotEditor` (the editor element)

```ts
class DrillplotEditor extends HTMLElement {
  static observedAttributes: string[]; // ['source', 'greyscale', 'save-label']
  get source(): DrillSource;
  set source(value: DrillSource | string | null);
  get greyscale(): boolean;
  set greyscale(on: boolean);
  load(input: DrillSource | string): ParseResult;
  getSource(): DrillSource;
  getSvg(): string;
}
```

| Member | Description |
| --- | --- |
| `source` (get) | The current drawing as a fresh `DrillSource`, without editor ids. |
| `source` (set) | Loads an object, JSON text or an exported SVG text. `null` is ignored. An invalid value fires `source-error` and leaves the drawing as it was. Does not fire `change`; clears the undo history. |
| `greyscale` | Whether the display-only greyscale view is on. Reflects the `greyscale` attribute. Setting it toggles the attribute. |
| `load(input)` | The same as setting `source`, returning the `ParseResult` so you can read the errors. A string goes through `parseText` (JSON or SVG); an object through `parseSource`. |
| `getSource()` | The same as reading `source`. |
| `getSvg()` | The export: `renderSvg` of the current source, always in color. The same as Get SVG. |

Attributes: `source` (JSON text or SVG text to load), `greyscale` (boolean), `theme` (`light` or `dark`) and `save-label` (the Save button's text). Events (all `CustomEvent`): `change` with `ChangeDetail`, `save` with `SaveDetail` (both bubble and are composed), and `source-error` with `SourceErrorDetail` (does not bubble).

```js
import 'drillplot/editor';
import { sampleDrill } from 'drillplot';

const ed = document.createElement('drillplot-editor');
document.body.append(ed);

const r = ed.load(sampleDrill());
r.ok; // true
ed.load('{"format":"nope"}').ok; // false, and a 'source-error' event fired
ed.getSvg().startsWith('<svg'); // true
```

The global `HTMLElementTagNameMap` is augmented, so `document.createElement('drillplot-editor')` is typed as `DrillplotEditor`.

### `defineDrillplotEditor(name?)`

```ts
function defineDrillplotEditor(name?: string): void // name defaults to 'drillplot-editor'
```

Registers the editor under a tag name. Importing the module already registers `<drillplot-editor>`; call this to register it under another name as well. A custom element constructor can be registered only once, so any other name gets a subclass of `DrillplotEditor` (which is `instanceof DrillplotEditor`). Calling it twice with the same name is safe, and it does nothing when `customElements` does not exist.

```js
import { defineDrillplotEditor } from 'drillplot/editor';

defineDrillplotEditor('team-drill-editor');
document.createElement('team-drill-editor');
```

### `TOKENS`

```ts
const TOKENS: readonly ['font', 'surface', ..., 'side-width'] // a readonly tuple of the 20 names
```

The names of the public theme custom properties, without the `--drillplot-` prefix: `font`, `surface`, `surface-sunken`, `surface-raised`, `border`, `border-strong`, `text`, `text-muted`, `accent`, `accent-text`, `accent-quiet`, `danger`, `danger-quiet`, `focus`, `stage-bg`, `select`, `radius`, `touch-target`, `stage-height`, `side-width`. The last four are sizes, not colors.

```js
import { TOKENS } from 'drillplot/editor';

for (const name of TOKENS) document.documentElement.style.setProperty(`--drillplot-${name}`, '');
```

### Event detail types

```ts
interface ChangeDetail { source: DrillSource }
interface SaveDetail { source: DrillSource; svg: string } // svg is always in color
interface SourceErrorDetail { errors: ParseError[] }
```

```ts
import type { DrillplotEditor, SaveDetail } from 'drillplot/editor';

const ed = document.querySelector<DrillplotEditor>('drillplot-editor')!;
ed.addEventListener('save', (e) => {
  const { source, svg } = (e as CustomEvent<SaveDetail>).detail;
  console.log(source.title, svg.length);
});
```

### `DrillModel`

The editor's state and undo history, with no DOM in it, so it can be driven and tested on its own. It is exported for tests and advanced use; most code should use the element. Its own types (`EditorItem`, `Kind`, `Meta`) are not exported by name.

```ts
class DrillModel {
  meta: Pick<DrillSource, 'title' | 'caption' | 'view' | 'side' | 'orient'>;
  items: EditorItem[];           // a source item plus an editor-only `id`
  undoStack: unknown[];
  redoStack: unknown[];
  onChange: (() => void) | undefined; // called after any change a user made

  uid(): string;
  byId(id: string | null): EditorItem | undefined;
  snap(withMeta?: boolean): Entry;
  record(before: Entry): boolean;
  act(fn: () => void): void;
  canUndo(): boolean;
  canRedo(): boolean;
  undo(): void;
  redo(): void;
  load(source: DrillSource, options: { undoable: boolean }): void;
  toSource(): DrillSource;
  makeItem(kind: Kind, x: number, y: number): EditorItem;
  add(kind: Kind, x: number, y: number): EditorItem;
  defaultSpot(): { x: number; y: number };
  delete(id: string): void;
  clear(): void;
  nudge(id: string, dx: number, dy: number): void;
  addArrow(tool: 'drive' | 'drop' | 'move', x1: number, y1: number, x2: number, y2: number): EditorItem;
  shiftShot(id: string, dir: -1 | 1): void;
  renumber(): void;
}
// Kind = 'pA' | 'pB' | 'pC' | 'pD' | 'pCoach' | 'machine' | 'cone' | 'zone'
```

| Method | Description |
| --- | --- |
| `add(kind, x, y)` | Adds a piece centered at `(x, y)` (snapped to a quarter foot and kept inside the bounds), as one undo step, and returns it. `pA` and `pB` are orange players labelled A and B, `pC` and `pD` blue players C and D, `pCoach` a black player labelled "Coach"; `zone` is 6 by 4 feet. |
| `addArrow(tool, ...)` | Makes an arrow with its ends set and the next shot number (`'drive'` straight, `'drop'` curved, `'move'` a movement arrow) and returns it. It does not add it to `items`. |
| `nudge(id, dx, dy)` | Moves a piece or whole arrow by feet, kept inside the bounds, as one undo step. |
| `delete(id)`, `clear()` | Remove one piece or all of them (undoable). |
| `shiftShot(id, dir)` | Swaps a ball path's number with the previous (`-1`) or next (`1`) shot. |
| `renumber()` | Numbers the ball paths 1 to N. |
| `act(fn)` | Runs a mutation of `items` as one undo step and then calls `onChange`. |
| `snap()` and `record(before)` | For drags: take a snapshot, mutate, then `record` it, which pushes an undo step only if something changed (and returns whether it did). The undo stack keeps 100 steps. |
| `load(source, { undoable })` | Replaces everything with a validated source. With `undoable: true` it is an undo step that also restores title, caption and view; otherwise it clears both stacks. |
| `toSource()` | The source, without editor ids. |
| `defaultSpot()` | Where a keyboard user's piece lands: spread across the visible court so pieces do not stack. |

```js
import { DrillModel } from 'drillplot/editor';

const m = new DrillModel();
const a = m.add('pA', 7, 40);
m.nudge(a.id, 0.5, 0);
m.toSource().items[0]; // { type: 'player', x: 7.5, y: 40, label: 'A', team: 'orange' }
m.undo();
m.toSource().items[0].x; // 7
```

## `drillplot/schema`

```js
import schema from 'drillplot/schema' with { type: 'json' };
```

The JSON Schema (draft 2020-12) for format version 1: the file `schema/drill-diagram.v1.schema.json`. It is a JSON module, not code: import it with an import attribute (`with { type: 'json' }`) in Node, or let your bundler load it. Its `$id` is `https://maikuru.github.io/drillplot/schema/drill-diagram.v1.schema.json`, where the demo site publishes it. It describes the shape and the limits; `parseSource` additionally rounds and fills defaults. Both are tested against the same set of good and bad samples.

```js
import Ajv2020 from 'ajv/dist/2020.js';
import schema from 'drillplot/schema' with { type: 'json' };

const validate = new Ajv2020({ strict: true }).compile(schema);
validate({ format: 'drill-diagram', version: 1, items: [] }); // true
```

`package.json` is also exported (`drillplot/package.json`).
