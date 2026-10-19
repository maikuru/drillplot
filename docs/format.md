# The drill-diagram format, version 1

This is the specification of the `drill-diagram` source format that `drillplot` reads, writes and embeds in the SVG it exports. The code is the reference implementation: [`src/format`](../src/format) is the validator and [`schema/drill-diagram.v1.schema.json`](../schema/drill-diagram.v1.schema.json) is the JSON Schema, and a shared set of samples in [`test/schema.test.ts`](../test/schema.test.ts) keeps the two in agreement. How to use them is in [api.md](api.md); the short version is in the [README](../README.md).

**Contents:** [Overview](#overview) · [Coordinates and court geometry](#coordinates-and-court-geometry) · [The document](#the-document) · [Items](#items) · [Text rules](#text-rules) · [Limits](#limits) · [Normalization](#normalization) · [Drawing](#drawing) · [Embedding in SVG](#embedding-in-svg) · [Versioning and compatibility](#versioning-and-compatibility) · [Legacy team keys](#legacy-team-keys) · [Examples](#examples) · [Error keys](#error-keys)

## Overview

A source is one JSON object. It describes a pickleball court view and a list of items placed on it: players, ball machines, cones, target zones, movement arrows and numbered ball paths. Everything is measured in feet on a regulation court.

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

## Text rules

`title`, `label` (player and zone) and `caption` are plain text; markup in them is not an error because it is text, and the renderer escapes it.

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
2. Items by layer: zones, cones, machines, players, movement arrows, ball paths. Within a layer the order in `items` is kept.

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
| `not_text` | `title`, `caption` or a `label` is not a string. | `/title`, `/caption`, `/items/N/label` |
| `title_too_long` | The title is over 120 characters. | `/title` |
| `caption_too_long` | The caption is over 300 characters. | `/caption` |
| `label_too_long` | A player label is over 8 or a zone label over 24 characters. | `/items/N/label` |
| `bad_character` | Text has a control character not allowed in that field, U+FFFE, U+FFFF, or an unpaired surrogate. | the text field |
| `bad_view` | `view` is not `full`, `half` or `kitchen`. | `/view` |
| `bad_side` | `side` is not `bottom` or `top`. | `/side` |
| `bad_orient` | `orient` is not `portrait` or `landscape`. | `/orient` |
| `items_not_array` | `items` is missing or is not an array. | `/items` |
| `too_many_items` | More than 200 items. No item is checked then. | `/items` |
| `item_not_object` | An item is not an object (`null`, a number, an array). | `/items/N` |
| `unknown_item_type` | `type` is missing or not one of `player`, `machine`, `cone`, `zone`, `move`, `ball`. | `/items/N/type` |
| `not_a_number` | A coordinate, size or angle is missing, not a number, or not finite. | the field |
| `out_of_bounds` | A position is outside -2 to 22 (`x`) or -2 to 46 (`y`). | the field |
| `bad_size` | A zone `w` or `h` is outside 1 to 20 or 1 to 44. | `/items/N/w`, `/h` |
| `bad_angle` | A machine `angle` is below 0 or 360 or above. | `/items/N/angle` |
| `bad_team` | A player `team` is not a known color or legacy key. | `/items/N/team` |
| `bad_bend` | A ball `bend` is not `1` or `-1`. | `/items/N/bend` |
| `bad_shot_number` | A ball `n` is missing, not a whole number, or outside 1 to 200. | `/items/N/n` |
| `not_boolean` | A ball `curve` is not `true` or `false`. | `/items/N/curve` |
| `empty_input` | `parseText` was given empty or whitespace-only text. | `""` |
| `no_svg_source` | `parseText` was given an SVG with no embedded source (not made by drillplot). | `""` |
| `bad_svg_source` | `parseText` found a source in the SVG but it is not valid JSON. | `""` |

`not_a_number` for a missing field means required numbers: an absent `x` is reported as `not_a_number`, not as a separate "missing" key.
