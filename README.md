# drillplot

Draw pickleball drill diagrams and export editable SVG.

drillplot is a browser tool and a small library. You place players, cones, a ball machine and target zones on a to-scale pickleball court, draw numbered drives, drops and movement arrows, and export an SVG that carries its own editable source, so a diagram can be reopened and changed later. No framework, no runtime dependencies.

## Install

```sh
npm install drillplot
```

It ships ES modules and TypeScript types, and needs Node 20 or newer to build and test. To work from a clone instead, see [Contributing](#contributing).

Entry points: `drillplot` (format, validator and renderer, no DOM needed), `drillplot/editor` (registers `<drillplot-editor>` and exports `defineDrillplotEditor`, `DrillplotEditor`, `DrillModel` and `TOKENS`) and `drillplot/schema` (the JSON Schema).

## Use the renderer

```ts
import { renderSvg, parseSource, sampleDrill } from 'drillplot';

const result = parseSource(jsonTextOrObject); // validates and normalizes
if (result.ok) {
  const svg = renderSvg(result.source); // a string of standalone SVG
  const grey = renderSvg(result.source, { greyscale: true }); // display only
} else {
  for (const e of result.errors) console.log(e.key, e.path, e.message);
}
```

`renderSvg` expects a validated source: pass it `parseSource(...).source` (the editor always does). It is not defensive about other input. Given a validated source it is deterministic (the same source gives the same text), uses explicit fills and strokes (no CSS, no `currentColor`), sets a `viewBox`, a `<title>`, a `<desc>` when there is a caption, and puts the source JSON, XML-escaped, in `<metadata>`. It adds no `id` or `class`, so any number of exports can sit in one page. All text from a source (title, caption, labels) is escaped.

The greyscale option turns every color into its grey, to show what a black and white printer makes of a drawing. It is for display. The editor's Get SVG never uses it, and nothing stores it.

To reopen an exported SVG, or pasted JSON:

```ts
import { parseText } from 'drillplot';
const r = parseText(svgOrJsonText); // reads <metadata>, no DOM needed (works in Node)
```

## Use the editor (web component)

```html
<drillplot-editor id="ed"></drillplot-editor>
<script type="module">
  import 'drillplot/editor'; // registers <drillplot-editor>
  import { sampleDrill } from 'drillplot';

  const ed = document.getElementById('ed');
  ed.source = sampleDrill();                  // property: an object, JSON text, or an exported SVG
  ed.addEventListener('change', (e) => console.log(e.detail.source));
  ed.addEventListener('save', (e) => upload(e.detail.svg, e.detail.source));
</script>
```

| Member | What it does |
| --- | --- |
| `source` property | Get the current source, or load an object, JSON text or an exported SVG. Loading does not fire `change`. |
| `source` attribute | JSON text (or an exported SVG) to load. |
| `greyscale` attribute and property | The display-only greyscale view. |
| `theme` attribute | `light` or `dark`. By default it follows `prefers-color-scheme`. |
| `save-label` attribute | Text of the Save button. |
| `defineDrillplotEditor(name)` | Importing `drillplot/editor` registers `<drillplot-editor>`. Call this to register it under another tag name too (a subclass is registered, since a constructor can be registered only once). |
| `getSvg()`, `getSource()`, `load()` | Export the SVG (always in color), export the source, load and get a parse result back. |
| `change` event | After every edit. `detail.source` is the source. |
| `save` event | From the Save button or Ctrl or Cmd + S. `detail.source` and `detail.svg`. |
| `source-error` event | A source set from outside was refused. `detail.errors` holds the typed errors. The drawing is left as it was. |

The editor has a palette (players A to D and a coach, ball machine, cone, target zone), select, move and nudge, delete, undo and redo, an inspector, Full, Half and Kitchen views, Portrait and Landscape, the greyscale view, Get SVG (with Copy SVG and Copy source) and Open from source.

**Why shadow DOM.** The editor is a self-contained widget with its own markup, ids and styles. Shadow DOM stops a host page's CSS from breaking it by accident and stops its ids and class names from clashing with the host, while still letting a host restyle it on purpose: custom properties inherit into the shadow tree, and the main regions expose `part` names (`root`, `toolbar`, `stage`, `panel`, `footer`, `save`).

### Theme tokens

Set any of these on `drillplot-editor` or an ancestor (the exported `TOKENS` array lists them, and a test keeps this list and the code in step):

`--drillplot-font`, `--drillplot-surface`, `--drillplot-surface-sunken`, `--drillplot-surface-raised`, `--drillplot-border`, `--drillplot-border-strong`, `--drillplot-text`, `--drillplot-text-muted`, `--drillplot-accent`, `--drillplot-accent-text`, `--drillplot-accent-quiet`, `--drillplot-danger`, `--drillplot-danger-quiet`, `--drillplot-focus`, `--drillplot-stage-bg`, `--drillplot-select`, `--drillplot-radius`, `--drillplot-touch-target`, `--drillplot-stage-height`, `--drillplot-side-width`.

```css
drillplot-editor { --drillplot-accent: #7a1f5c; --drillplot-stage-height: 70vh; }
```

## The format

A source is JSON. Positions are court feet: `x` runs 0 to 20 across the court, `y` runs 0 to 44 end line to end line, and the net is at `y = 22`. A position (the top left corner, for a zone) may sit up to 2 feet outside the court lines.

```json
{
  "format": "drill-diagram",
  "version": 1,
  "title": "Third-shot drop and walk in",
  "caption": "A hits a curved drop into the kitchen, then A and B walk up.",
  "view": "full",
  "side": "bottom",
  "orient": "portrait",
  "items": [
    { "type": "zone", "x": 3, "y": 16.5, "w": 6, "h": 4, "label": "Target" },
    { "type": "player", "x": 7, "y": 40, "label": "A", "team": "orange" },
    { "type": "move", "x1": 7, "y1": 38.4, "x2": 7, "y2": 31 },
    { "type": "ball", "x1": 6.4, "y1": 38.4, "x2": 6, "y2": 19, "curve": true, "bend": -1, "n": 1 }
  ]
}
```

| Field | Values |
| --- | --- |
| `view` | `full`, `half` or `kitchen`. Default `full`. |
| `side` | `bottom` or `top`, for the half view. Default `bottom`. |
| `orient` | `portrait` (net across the page) or `landscape` (net up and down). Default `portrait`. |
| `player` | `x`, `y`; `label` (up to 8 characters); `team`: `orange`, `blue`, `white` or `black` (default `orange`). |
| `machine` | `x`, `y`; `angle` in degrees, 0 up to (not including) 360, default 0. |
| `cone` | `x`, `y`. |
| `zone` | `x`, `y` (top left), `w` 1 to 20 and `h` 1 to 44 (all required); `label` (up to 24 characters). |
| `move` | A dashed movement arrow, `x1`, `y1` to `x2`, `y2`. |
| `ball` | A ball path, `x1`, `y1` to `x2`, `y2`, `curve` (a drop or lob), `bend` (`1` or `-1`, which way it bows) and the shot number `n`, a whole number from 1 to 200 (`n` is required; `curve` defaults to false and `bend` to 1). |

Limits: at most 200 items, a title of 120 characters, a caption of 300. Text may not contain control characters, U+FFFE or U+FFFF, or unpaired surrogates (error `bad_character`), because they cannot be written in XML and the exported SVG would not open. A title and labels are one line; a caption may also hold tabs and line breaks. Older team keys still open: `t1` becomes `orange`, `t2` becomes `blue`, `coach` becomes `black`. Unknown properties are dropped.

The four player colors are from the Okabe-Ito set and were chosen to differ in lightness as well as hue, so they stay apart for color-blind viewers and on a black and white printer.

### Errors

`parseSource` returns `{ ok: false, errors }` where every error is `{ key, path, message }`. The `key` is stable and meant for code to branch on; the message is for people and may be reworded. Keys: `not_json`, `not_an_object`, `wrong_format`, `unsupported_version`, `not_text`, `title_too_long`, `caption_too_long`, `label_too_long`, `bad_view`, `bad_side`, `bad_orient`, `items_not_array`, `too_many_items`, `item_not_object`, `unknown_item_type`, `not_a_number`, `out_of_bounds`, `bad_size`, `bad_angle`, `bad_team`, `bad_bend`, `bad_shot_number`, `not_boolean`, `bad_character`, plus `no_svg_source`, `bad_svg_source` and `empty_input` from `parseText`. Markup in a label is not an error: it is text, and the renderer escapes it.

### JSON Schema

[`schema/drill-diagram.v1.schema.json`](schema/drill-diagram.v1.schema.json) is JSON Schema draft 2020-12 and is tested against the validator on a shared set of good and bad samples. It is also exported as `drillplot/schema`.

The schema's `$id` is `https://maikuru.github.io/drillplot/schema/drill-diagram.v1.schema.json`, where the demo site publishes it.

## Accessibility

- Every control is a real button, radio, checkbox, select or input with a visible label, at least a 44 pixel touch target (36 for the small buttons), and a visible focus ring.
- The court can be worked without a pointer: the palette buttons place a piece when you press Enter, the piece list selects any piece, arrow keys nudge the selected piece, Delete removes it, and exact coordinate fields set a position. With an arrow tool chosen, Enter on the court adds an arrow you then adjust with the fields. Ctrl or Cmd + Z, Shift + Z and Y undo and redo; Ctrl or Cmd + S saves; Escape backs out of a tool, a selection or a sheet.
- Drag, tap-to-place and touch all work (pointer events, `touch-action: none` on the court).
- Status and hints are in live regions. Clearing the court asks first.
- The four player colors also differ in lightness. Use the Greyscale view to check a diagram against a black and white printer. Player letters are always drawn on the piece, so color is never the only signal.
- Exported SVGs are `role="img"`, with an `aria-label` and a `<title>`, and a `<desc>` from the caption. A good caption is the accessible description: say what the drill does, not only what is drawn.
- `prefers-reduced-motion` is respected (there is no motion to speak of).

## Contributing

```sh
npm install
npm run typecheck
npm test
npm run build
npm run build:demo   # builds, then copies dist/ and schema/ into demo/ for a local look
```

The repository's `.npmrc` sets `legacy-peer-deps`, which the pinned test runner needs with npm 10.

Open `demo/index.html` through any static file server after `build:demo`. Please keep changes small, add a test next to the behavior you change, and add a line to [CHANGELOG.md](CHANGELOG.md). Changes to the format need a schema change, a validator change and a sample in `test/schema.test.ts` that both agree on; a change that older diagrams cannot open needs a new format version.

The code is TypeScript in strict mode. `src/format` is the types and the validator, `src/render` is the SVG renderer, `src/editor` is the custom element (its state and undo live in `model.ts` with no DOM, so they are tested without a browser).

## Releasing

Releases publish from GitHub Actions with npm's trusted publishing: the workflow proves who it is to npm over OIDC, so no npm token is stored anywhere, and npm records the release's provenance. To release, bump the version and push its tag:

```sh
npm version patch   # or minor, major; commits and tags vX.Y.Z
git push --follow-tags
```

The Release workflow ([.github/workflows/release.yml](.github/workflows/release.yml)) refuses a tag that does not match `package.json`, then runs the typecheck, the tests and the build before publishing.

## License

[MIT](LICENSE).
