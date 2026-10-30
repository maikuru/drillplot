# The drill-diagram format, version 1

This is the specification of the `drill-diagram` source format that `drillplot` reads, writes and embeds in the SVG it exports. The code is the reference implementation: [`src/format`](../src/format) is the validator and [`schema/drill-diagram.v1.schema.json`](../schema/drill-diagram.v1.schema.json) is the JSON Schema, and a shared set of samples in [`test/schema.test.ts`](../test/schema.test.ts) keeps the two in agreement. How to use them is in [api.md](api.md); the short version is in the [README](../README.md).

**Contents:** [Overview](#overview) · [Coordinates and court geometry](#coordinates-and-court-geometry) · [The document](#the-document) · [Items](#items) · [Additions in 0.2](#additions-in-02) · [Text rules](#text-rules) · [Limits](#limits) · [Normalization](#normalization) · [Drawing](#drawing) · [Embedding in SVG](#embedding-in-svg) · [Versioning and compatibility](#versioning-and-compatibility) · [Legacy team keys](#legacy-team-keys) · [Examples](#examples) · [Error keys](#error-keys)

## Overview

A source is one JSON object. It describes a pickleball court view and a list of items placed on it: players, ball machines, cones, target zones, movement arrows and numbered ball paths. Everything is measured in feet on a regulation court. Package 0.2 adds optional fields and two item types, all still in format version 1: see [Additions in 0.2](#additions-in-02).

The words "must", "may" and "should" are used in the usual specification sense. A **reader** is anything that opens a source (the validator, the editor); a **writer** produces one.

## Coordinates and court geometry

- **Unit:** feet. All lengths, positions and sizes in a source are feet. Angles are degrees.
- **Court:** 20 feet wide and 44 feet long, the regulation pickleball court.
- **Axes:** `x` runs from 0 to 20 across the court. `y` runs from 0 to 44 from one end line to the other. The origin `(0, 0)` is a corner of the court, at the top left in portrait, so `y` increases down the page, as on a screen.
- **Net:** across the court at `y = 22`, which splits it into two halves of 22 feet.
- **Kitchen** (the non-volley zone): 7 feet on each side of the net, so the kitchen lines are at `y = 15` and `y = 29`.
- **Center lines:** at `x = 10`, from each end line to the kitchen line (`y` 0 to 15 and 29 to 44).
- **Margin:** a position may sit up to 2 feet outside the court lines, so `x` is from -2 to 22 and `y` from -2 to 46. This lets you draw a player behind the baseline or a ball landing long.
- **Precision:** values are rounded to two decimals (hundredths of a foot) on read. The editor snaps to a quarter foot.

The court in portrait:

```text
 y=0   +-----------+-----------+   end line
       |           |           |
       |           |           |
 y=15  +-----------+-----------+   kitchen line
       |        kitchen        |
 y=22  =========== net =========
       |        kitchen        |
 y=29  +-----------+-----------+   kitchen line
       |           |           |
       |           |           |
 y=44  +-----------+-----------+   end line
      x=0        x=10        x=20
```

### Views

`view` chooses what part of the court is framed. The frames below are in court feet, as `x y width height`, and include 2.5 feet of grass around the lines, so the full view shows everything within the 2 foot position margin. The half and kitchen views frame less, and a piece outside the frame is simply not visible (the editor says how many are).

| `view` | `side` | Frame (portrait) | Shows |
| --- | --- | --- | --- |
| `full` | ignored | `-2.5 -2.5 25 49` | The whole court |
| `half` | `bottom` | `-2.5 19.5 25 27` | The half with `y` from 22 to 44, and the net |
| `half` | `top` | `-2.5 -2.5 25 27` | The half with `y` from 0 to 22, and the net |
| `kitchen` | ignored | `-2.5 13 25 18` | Both kitchens and the net |

### Orientation

`orient` chooses how the court is turned on the page.

- `portrait` (default): the court is drawn as described above. The net runs across the page, `x` runs left to right and `y` runs top to bottom.
- `landscape`: the whole drawing is turned a quarter turn counterclockwise (SVG `rotate(-90)`), so the net runs up and down. A court point `(x, y)` lands at `(y, -x)` on the page: `y` runs left to right (so `y = 0` is the left end line) and `x` runs upward (so `x = 0` is at the bottom). The frames above turn with it, and `half` with `side: "bottom"` is the right-hand half. Text is kept upright.

Item coordinates always stay in court feet, whatever the orientation: a source rotated from portrait to landscape changes `orient` and nothing else.

## The document

| Field | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `format` | string | yes | | Always `"drill-diagram"`. |
| `version` | number | yes | | Always `1` in this version of the format. |
| `title` | string | no | `""` | A one-line title. Up to 120 characters. Used as the SVG's `<title>` and `aria-label`. |
| `caption` | string | no | `""` | A description of what the drill does. Up to 300 characters; may have line breaks. Used as the SVG's `<desc>`, the accessible description. |
| `view` | string | no | `"full"` | `"full"`, `"half"` or `"kitchen"`. |
| `side` | string | no | `"bottom"` | `"bottom"` or `"top"`. Only used when `view` is `"half"`, but always validated. |
| `orient` | string | no | `"portrait"` | `"portrait"` or `"landscape"`. |
| `showCaption` | boolean | no | `false` | Since 0.2. Also draw the caption as text under the court. See [the visible caption](#the-visible-caption). |
| `courts` | array | no | | Since 0.2. One to four [courts](#several-courts) drawn side by side. |
| `legend` | array | no | | Since 0.2. Up to 20 [legend notes](#legend-and-badges) drawn under the court. |
| `items` | array | yes | | Up to 200 [items](#items). May be empty. |

Unknown properties, at the top level or on an item, are ignored by a reader and dropped on save. (This is how the editor-internal `id` that earlier exports carried disappears.)

## Items

Every item is an object with a `type`. Items are drawn back to front by type, not by list order (see [Drawing](#drawing)). `x` and `y` are within [the margin](#coordinates-and-court-geometry).

### `player`

A numbered or lettered player disc.

| Field | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `type` | `"player"` | yes | | |
| `x`, `y` | number | yes | | Center of the disc, in feet. |
| `label` | string | no | `""` | Up to 8 characters, one line. Typically `A`, `B`, `C`, `D` or a short name. |
| `team` | string | no | `"orange"` | `"orange"`, `"blue"`, `"white"` or `"black"` (also the [legacy keys](#legacy-team-keys)). |

The four colors are the Okabe-Ito set, chosen to differ in lightness as well as hue so they stay apart for color-blind viewers and on a black and white printer: orange `#e69f00`, blue `#0072b2`, white `#ffffff`, black `#1a1a1a`.

### `machine`

A ball machine.

| Field | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `type` | `"machine"` | yes | | |
| `x`, `y` | number | yes | | Center of the machine, in feet. |
| `angle` | number | no | `0` | Which way the machine fires, in degrees, from 0 up to but not including 360. Zero points toward the `y = 0` end line (up the page in portrait); the angle grows clockwise as seen in portrait. |

An angle that rounds up to 360 (for example 359.996) is accepted and becomes 0.

### `cone`

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `type` | `"cone"` | yes | |
| `x`, `y` | number | yes | The cone's position, in feet. |

### `zone`

A translucent target zone, rectangular, aligned to the court axes.

| Field | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `type` | `"zone"` | yes | | |
| `x`, `y` | number | yes | | The corner with the smallest `x` and `y` (top left in portrait), in feet. |
| `w` | number | yes | | Width along `x`, from 1 to 20 feet. |
| `h` | number | yes | | Height along `y`, from 1 to 44 feet. |
| `label` | string | no | `""` | Up to 24 characters, one line, drawn in the middle of the zone. |

Only the corner position is checked against the margin. A zone may extend past the margin (`x: 22` with `w: 20` is valid); it is simply clipped by the view.

### `move`

A dashed movement arrow: where a player goes.

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `type` | `"move"` | yes | |
| `x1`, `y1` | number | yes | Start, in feet. |
| `x2`, `y2` | number | yes | End, where the arrowhead is, in feet. |

### `ball`

A numbered ball path: a shot.

| Field | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `type` | `"ball"` | yes | | |
| `x1`, `y1` | number | yes | | Where the ball is hit, in feet. |
| `x2`, `y2` | number | yes | | Where it lands (the arrowhead), in feet. |
| `curve` | boolean | no | `false` | `true` draws a curved path, like a drop or a lob; `false` draws a straight drive. |
| `bend` | `1` or `-1` | no | `1` | Which side a curved path bows toward: `1` to the right of the direction of travel, `-1` to the left, as seen in portrait. Ignored when `curve` is `false`, but still validated. |
| `n` | integer | yes | | The shot number, from 1 to 200, drawn as a badge on the path. |

Shot order is by `n`; paths with the same `n` keep their order in `items`. Numbers do not have to be consecutive, but the editor offers Renumber to close gaps, and the helpers in [api.md](api.md#shot-numbering) do the same in code. A curved path's control point sits 22 percent of its length off the midpoint, so the path's furthest point is about 11 percent of its length from the straight line.

## Additions in 0.2

Package 0.2 extends format version 1 with the optional fields and item types below, so that a diagram can carry everything a printed drill handout shows: a keyed legend, a line to split-step on, path colors and dashes with a meaning, start positions and open space, a role under a player, either-or shots, a visible caption, more than one court, and named targets. ([coverage-0.2.md](coverage-0.2.md) is the inventory this came from.)

The rules that keep 0.1 documents unchanged:

- Every addition is optional. A reader **does not fill it in**: a normalized source carries a 0.2 field only when it is set, and a boolean only when it is `true`. Empty text (`""`) is the same as leaving the field out. So a document written for 0.1 normalizes, saves (`stringifySource`) and renders exactly as it did, byte for byte.
- `stringifySource` writes the 0.2 fields after the 0.1 fields: `showCaption`, `courts` and `legend` after `orient` (before `items`), and on each item after its 0.1 fields in the order listed below.
- A 0.1 package opening a document that uses an addition drops an unknown field on save, and refuses an unknown item type (`line`, `mark`) with `unknown_item_type`, as [Versioning and compatibility](#versioning-and-compatibility) says.

### Legend and badges

A **legend** is a list of notes drawn under the court, in order. Each note is an object:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `key` | string | no | 1 to 3 characters, one line, not only spaces. The note explains the badge with this key. |
| `color` | string | no | A [path color](#path-styles). For a note with no key: drawn as a swatch, for a note that explains a color. |
| `text` | string | yes | Up to 100 characters, one line. The renderer wraps it. |

A note's key matches a **badge** on the court. Any of `player`, `machine`, `cone`, `zone`, `move` and `line` may carry a `key` (the same rule as above), drawn as a small white disc with the key in dark text: beside a player, a machine or a cone, inside a zone's corner, at the middle of a movement arrow, and at the start of a line. A ball path's badge is its shot number, so a note whose key is a shot label (`"2"`, or `"2a"` for [an alternative](#either-or-shots)) is drawn with that shot's dark badge, unless an item also carries that key. Keys do not have to be unique and need not match anything.

A **`mark`** is a badge on its own, at a point:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `type` | `"mark"` | yes | |
| `x`, `y` | number | yes | Center of the badge, in feet. |
| `key` | string | yes | The badge, as above. |

Short on-court callouts ("go", "split", "mine") are written as badges with legend notes, not as free text on the court: one mechanism, text that never collides with pieces, stays upright and legible at print size, and is read in order by a screen reader.

### Lines

A **`line`** is a plain line with no arrowhead, such as the line across the court where players split-step.

| Field | Type | Required | Default | Meaning |
| --- | --- | --- | --- | --- |
| `type` | `"line"` | yes | | |
| `x1`, `y1`, `x2`, `y2` | number | yes | | The ends, in feet. |
| `color` | string | no | `"white"` | A [path color](#path-styles). |
| `dash` | boolean | no | `false` | Drawn dashed. |
| `label` | string | no | | Up to 24 characters, one line, written above the middle of the line. |
| `key` | string | no | | A [badge](#legend-and-badges) at the start. |

### Path styles

`ball`, `move` and `line` may carry a **`color`**, one of `yellow`, `white`, `orange`, `red`, `pink`, `green` and `black` (the path, its arrowhead and a ball path's shot badge take it). The defaults are unchanged: yellow ball paths, white movement arrows. A `ball` (and a `line`) may also be **`dash`**ed, the usual mark of a cooperative or optional shot. Movement arrows are always dashed. What a color means is up to the diagram; say it in the legend, with a swatch note if you like.

### Start positions and open space

`ghost: true` on a **player** draws a dashed white ring with the label inside and no fill: where a player starts, was, or is going. On a **zone** it draws the outline only, dashed: space left open, or a target outlined rather than filled.

### Notes and names

A **player** may have a **`note`**, up to 16 characters, one line, written under the disc: a role such as "feeder" or "hitter", or a name. A **cone** may have a **`label`**, up to 6 characters, one line, written beside it: a named target such as "T1" or "R2".

### Either-or shots

A ball path may have **`alt`**, one lower-case letter. Paths with the same `n` that each have a letter are choices for that shot, not a sequence: their badges read `2a`, `2b`. Shot order sorts by `n`, then by letter; [renumbering](api.md#shot-numbering) gives the choices one number between them.

### The visible caption

With `showCaption: true` the caption is also drawn as text under the court (and under the legend), in italics, wrapped to the width of the drawing, keeping its own line breaks. It is in `<desc>` either way.

### Several courts

`courts` lists one to four courts, drawn side by side in portrait and stacked in landscape, each framed by the same `view`. Each court is an object:

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `label` | string | no | Up to 24 characters, one line, written above the court. |
| `link` | string | no | Up to 40 characters, one line, written in the gap after this court with an arrow to the next one, such as "Winner moves up". Ignored on the last court. |

Every item may then say which court it is on with **`court`**, a whole number from 1 to the number of courts (1 when left out). Each court's items keep their own coordinates on their own court. Without `courts`, `court` may only be 1. The schema checks that `court` is from 1 to 4; only the reader can check it against the number of courts.

### Drawing the additions

A source with a `legend`, `showCaption` or `courts` is drawn on a white page: the courts (each clipped to its frame in its own nested `<svg>` viewport), then the legend notes, one per row with their badge or swatch, then the caption. The page grows to fit; its `width` and `height` stay 16 pixels per foot. A source without any of these three is drawn exactly as in 0.1.

### An example

```json
{
 "format": "drill-diagram",
 "version": 1,
 "title": "Split step on a line",
 "caption": "Be still before each contact.",
 "view": "half",
 "side": "top",
 "orient": "portrait",
 "showCaption": true,
 "legend": [
  { "key": "1", "text": "Move up after the third shot." },
  { "key": "2", "text": "Split on the line." },
  { "color": "pink", "text": "Pink: the cooperative feed." }
 ],
 "items": [
  { "type": "line", "x1": 0, "y1": 9.5, "x2": 20, "y2": 9.5, "color": "orange", "dash": true, "label": "Split", "key": "2" },
  { "type": "player", "x": 10, "y": 1.5, "label": "A", "team": "orange", "ghost": true },
  { "type": "player", "x": 10, "y": 9.5, "label": "A", "team": "orange", "note": "hitter" },
  { "type": "move", "x1": 10, "y1": 3, "x2": 10, "y2": 8, "key": "1" },
  { "type": "ball", "x1": 14, "y1": 21, "x2": 11.2, "y2": 10.4, "n": 1, "color": "pink", "dash": true }
 ]
}
```

## Text rules

`title`, `label` (player, zone and, since 0.2, cone and line), `caption`, and the 0.2 `note`, `key`, legend `text`, and court `label` and `link` are plain text; markup in them is not an error because it is text, and the renderer escapes it.

- **Length** counts Unicode code points, not UTF-16 units, so an emoji counts as one.
- **A title and labels are one line:** no control character at all (U+0000 to U+001F, U+007F).
- **A caption** may hold tab (U+0009), line feed (U+000A) and carriage return (U+000D), and no other control character.
- **Never allowed:** U+FFFE, U+FFFF and unpaired surrogates. They cannot be written in XML 1.0, so an SVG containing them would not open. All of these are rejected with `bad_character`, and the renderer strips them if given one anyway.
- A value that is not a string is `not_text`. A string over its limit is `title_too_long`, `caption_too_long` or `label_too_long`.

## Limits

| What | Limit | Error when exceeded |
| --- | --- | --- |
| Items in a document | 200 | `too_many_items` |
| Shot number `n` | 1 to 200, whole | `bad_shot_number` |
| Title | 120 characters | `title_too_long` |
| Caption | 300 characters | `caption_too_long` |
| Player label | 8 characters | `label_too_long` |
| Zone label | 24 characters | `label_too_long` |
| Zone width `w` | 1 to 20 feet | `bad_size` |
| Zone height `h` | 1 to 44 feet | `bad_size` |
| Position `x` | -2 to 22 feet | `out_of_bounds` |
| Position `y` | -2 to 46 feet | `out_of_bounds` |
| Machine angle | 0 up to, not including, 360 degrees | `bad_angle` |
| Player note (0.2) | 16 characters | `label_too_long` |
| Cone label (0.2) | 6 characters | `label_too_long` |
| Line label (0.2) | 24 characters | `label_too_long` |
| Badge or legend key (0.2) | 1 to 3 characters, not only spaces | `bad_key` |
| Legend notes (0.2) | 20, each up to 100 characters | `bad_legend`, `label_too_long` |
| Courts (0.2) | 1 to 4; label 24, link 40 characters | `bad_courts`, `label_too_long` |
| Item `court` (0.2) | 1 to the number of courts | `bad_court` |

These are exported from the package as `LIMITS`, `COURT` and `BOUNDS`. Range checks use the number as written, before rounding: `-2.004` is out of bounds even though it would round to `-2`. A number must be a finite JSON number; `"7"` (a string), `null` and `NaN` are `not_a_number`.

## Normalization

`parseSource` returns a normalized copy, and the editor and renderer only ever see normalized sources:

- Defaults are filled in (`title`, `caption`, `view`, `side`, `orient`, `label`, `team`, `angle`, `curve`, `bend`).
- Numbers are rounded to two decimals.
- Unknown properties are dropped.
- [Legacy team keys](#legacy-team-keys) become the current color names.
- `stringifySource` writes keys in a fixed order (the header fields, then each item's fields in the order listed in this document) with one-space indentation, so the same drawing is always the same text.

The JSON Schema describes the shape and the limits, but it does not round or fill defaults; `parseSource` is the normalizing reader.

## Drawing

The renderer ([`renderSvg`](api.md#rendersvgsource-options)) draws, back to front:

1. The court: grass, the court surface, the two kitchens in a darker blue, the lines, the labels "Kitchen", and the net.
2. Items by layer: zones, lines, cones, machines, players, movement arrows, ball paths, marks. Within a layer the order in `items` is kept. (Lines and marks are since 0.2.)
3. Since 0.2, the legend and the visible caption under the court; see [Drawing the additions](#drawing-the-additions).

So a ball path is always above a player, whatever their order in the list. The SVG's own `width` and `height` are 16 pixels per foot of the frame. In greyscale mode every color becomes its luma grey; this is for display and the editor never exports it.

## Embedding in SVG

An exported SVG carries the normalized source, as the text of `<metadata>`, XML-escaped (`&`, `<` and `>`), so that a diagram can be reopened. `parseText` reads it back without a DOM. It ignores a `<metadata>` inside an XML comment, and also reads a CDATA section, which an earlier exporter used. An SVG not made by drillplot has no source and is refused with `no_svg_source`.

## Versioning and compatibility

`version` identifies the format, not the package. The package version is separate and follows [Semantic Versioning](https://semver.org/); the format is currently at **version 1**, and a reader of this package accepts exactly the versions it lists (`FORMAT_VERSION`, currently only 1). Any other value is refused with `unsupported_version`, with the message that the diagram was made with a newer version of the format, rather than guessed at.

The promise is backward compatibility: **a document that is valid under version 1 stays valid, and keeps its meaning, in every release of this package that reads version 1.** Changes are classified by whether they can keep that promise.

**Stays in version 1** (a package minor or patch release, listed in the [changelog](../CHANGELOG.md)):

- Loosening a rule: a higher limit, a wider range, a new optional property with a default, a new enum value or item type. Documents written before still validate and mean the same. A document that *uses* the addition needs a package release that knows it; an older package drops an unknown property on save, or refuses an unknown value with the matching `bad_*` or `unknown_item_type` key.
- Adding an error key, rewording a message, or changing how a drawing looks (colors, line weights) without changing what a source means.
- A fix that makes the validator match this specification, where the specification already said a document is invalid.

**Needs a new format version** (a new `version` number, a new schema file with its own `$id`, and a release that says so in the changelog):

- Removing or renaming a property, an item type or an enum value, or changing its meaning, its unit or the coordinate system.
- Making an optional property required.
- Tightening a limit or a range that this specification promised, so that a document that was valid becomes invalid.

When a new version is introduced, the package keeps reading the old one (migrating on read), and ships a schema per version. A diagram saved by a newer version is refused by an older package with `unsupported_version` instead of being opened with data lost.

**Error keys are stable.** A key will not be renamed or change meaning within a format version; a message may be reworded, so branch on `key`, never on `message`. The `path` is a JSON-pointer-like location (`/items/3/x`).

## Legacy team keys

Older diagrams used `t1`, `t2` and `coach` for the player `team`. They still open, and read as:

| Legacy key | Reads as |
| --- | --- |
| `t1` | `orange` |
| `t2` | `blue` |
| `coach` | `black` |

They are normalized on read, so a source saved again carries the new name. The JSON Schema accepts them too. Any other value is `bad_team`.

## Examples

A minimal document (valid; everything else defaults):

```json
{ "format": "drill-diagram", "version": 1, "items": [] }
```

A full example, the one the package ships as `sampleDrill()`:

```json
{
 "format": "drill-diagram",
 "version": 1,
 "title": "Third-shot drop and walk in",
 "caption": "D feeds from the kitchen line. A hits a curved drop into the opposing kitchen, then A and B walk up together to the transition zone and the kitchen line.",
 "view": "full",
 "side": "bottom",
 "orient": "portrait",
 "items": [
  { "type": "zone", "x": 3, "y": 16.5, "w": 6, "h": 4, "label": "Target" },
  { "type": "cone", "x": 2, "y": 33 },
  { "type": "cone", "x": 18, "y": 33 },
  { "type": "player", "x": 7, "y": 40, "label": "A", "team": "orange" },
  { "type": "player", "x": 15, "y": 41, "label": "B", "team": "orange" },
  { "type": "player", "x": 14, "y": 14.5, "label": "D", "team": "blue" },
  { "type": "move", "x1": 7, "y1": 38.4, "x2": 7, "y2": 31 },
  { "type": "move", "x1": 15, "y1": 39.4, "x2": 15, "y2": 31 },
  { "type": "ball", "x1": 13.4, "y1": 15.9, "x2": 7.6, "y2": 38.4, "curve": false, "bend": 1, "n": 1 },
  { "type": "ball", "x1": 6.4, "y1": 38.4, "x2": 6, "y2": 19, "curve": true, "bend": -1, "n": 2 }
 ]
}
```

A ball machine feeding the kitchen, in landscape, showing the top half:

```json
{
  "format": "drill-diagram",
  "version": 1,
  "title": "Machine feed to the kitchen",
  "view": "half",
  "side": "top",
  "orient": "landscape",
  "items": [
    { "type": "machine", "x": 10, "y": 1, "angle": 180 },
    { "type": "player", "x": 10, "y": 18, "label": "A" },
    { "type": "ball", "x1": 10, "y1": 3, "x2": 10, "y2": 16, "n": 1 }
  ]
}
```

A legacy document, which opens and becomes an orange player:

```json
{ "format": "drill-diagram", "version": 1, "items": [{ "type": "player", "x": 5, "y": 30, "label": "A", "team": "t1" }] }
```

An invalid document and what `parseSource` says about it:

```json
{ "format": "drill-diagram", "version": 1, "items": [{ "type": "cone", "x": 30, "y": 1 }, { "type": "ball", "x1": 1, "y1": 1, "x2": 2, "y2": 2 }] }
```

```text
out_of_bounds    /items/0/x
bad_shot_number  /items/1/n
```

## Error keys

`parseSource` reports every problem it finds, not only the first, as `{ key, path, message }`. If an item has any error, that item is left out of the result, and the others are still checked. `parseText` adds the keys marked below. Keys are stable; messages are for people.

| Key | When | Path |
| --- | --- | --- |
| `not_json` | The input was a string that is not valid JSON. | `""` |
| `not_an_object` | The value is not a JSON object (a number, `null`, an array). `parseText` gives this for JSON text that is not an object. | `""` |
| `wrong_format` | `format` is not `"drill-diagram"`. `version` is not checked until the format matches. | `/format` |
| `unsupported_version` | `format` is right but `version` is not `1`. The message says the diagram is from a newer version. | `/version` |
| `not_text` | `title`, `caption`, a `label`, or a 0.2 text field is not a string; or a legend note has no `text`. | the field |
| `title_too_long` | The title is over 120 characters. | `/title` |
| `caption_too_long` | The caption is over 300 characters. | `/caption` |
| `label_too_long` | A player label is over 8 or a zone label over 24 characters, or a 0.2 text field is over [its limit](#limits). | the field |
| `bad_character` | Text has a control character not allowed in that field, U+FFFE, U+FFFF, or an unpaired surrogate. | the text field |
| `bad_view` | `view` is not `full`, `half` or `kitchen`. | `/view` |
| `bad_side` | `side` is not `bottom` or `top`. | `/side` |
| `bad_orient` | `orient` is not `portrait` or `landscape`. | `/orient` |
| `items_not_array` | `items` is missing or is not an array. | `/items` |
| `too_many_items` | More than 200 items. No item is checked then. | `/items` |
| `item_not_object` | An item is not an object (`null`, a number, an array). | `/items/N` |
| `unknown_item_type` | `type` is missing or not one of `player`, `machine`, `cone`, `zone`, `move`, `ball`, `line`, `mark`. | `/items/N/type` |
| `not_a_number` | A coordinate, size or angle is missing, not a number, or not finite. | the field |
| `out_of_bounds` | A position is outside -2 to 22 (`x`) or -2 to 46 (`y`). | the field |
| `bad_size` | A zone `w` or `h` is outside 1 to 20 or 1 to 44. | `/items/N/w`, `/h` |
| `bad_angle` | A machine `angle` is below 0 or 360 or above. | `/items/N/angle` |
| `bad_team` | A player `team` is not a known color or legacy key. | `/items/N/team` |
| `bad_bend` | A ball `bend` is not `1` or `-1`. | `/items/N/bend` |
| `bad_shot_number` | A ball `n` is missing, not a whole number, or outside 1 to 200. | `/items/N/n` |
| `not_boolean` | A ball `curve`, or a 0.2 `dash`, `ghost` or `showCaption`, is not `true` or `false`. | the field |
| `bad_color` | Since 0.2. A `color` is not a path color. | `/items/N/color`, `/legend/N/color` |
| `bad_key` | Since 0.2. A `key` is not 1 to 3 characters of one-line text, or is only spaces; or a `mark` has none. | `/items/N/key`, `/legend/N/key` |
| `bad_alt` | Since 0.2. A ball `alt` is not one letter `a` to `z`. | `/items/N/alt` |
| `bad_court` | Since 0.2. An item's `court` is not a whole number from 1 to the number of courts. | `/items/N/court` |
| `bad_courts` | Since 0.2. `courts` is not a list of 1 to 4 objects. | `/courts` |
| `bad_legend` | Since 0.2. `legend` is not a list of at most 20 objects. A note without `text` is `not_text`. | `/legend` |
| `empty_input` | `parseText` was given empty or whitespace-only text. | `""` |
| `no_svg_source` | `parseText` was given an SVG with no embedded source (not made by drillplot). | `""` |
| `bad_svg_source` | `parseText` found a source in the SVG but it is not valid JSON. | `""` |

`not_a_number` for a missing field means required numbers: an absent `x` is reported as `not_a_number`, not as a separate "missing" key.
