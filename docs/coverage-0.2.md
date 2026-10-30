# Coverage of real drill diagrams, for 0.2

Before 0.2, the diagrams in a set of printed coaching materials were inventoried: drill cards, session plans and player handouts from three workshops, about 150 diagrams in all, from polished print layouts to rough sketches. This page lists every feature they use, whether format version 1 as of 0.1.1 could draw it, and, where it could not, the smallest addition that does. The descriptions are generic; no diagram is reproduced. Six diagrams rebuilt from the material, with generic names and wording, are the fixtures in [`test/fixtures/v2`](../test/fixtures/v2).

The format is specified in [format.md](format.md); the additions are in [Additions in 0.2](format.md#additions-in-02). Every addition is optional and still format version 1, and a 0.1 document draws byte for byte as it did (`test/compat.test.ts`).

## Already supported in 0.1.1

| Feature | How |
| --- | --- |
| Full court, one half, both kitchens; portrait or landscape | `view`, `side`, `orient` |
| Players as lettered or numbered discs in up to four colors, including repeated labels and unlabelled discs | `player` |
| A ball machine with its aim | `machine` |
| Cones | `cone` |
| Shaded target zones and lanes, rectangular, with a label | `zone` |
| Movement arrows, dashed | `move` |
| Ball paths, straight or curved, numbered in shot order, from any point (a serve from behind the baseline, a feed fan) | `ball` |
| Two-way rallies (two paths going opposite ways) | two `ball` items |
| A title, and a caption for screen readers | `title`, `caption` (`<desc>`) |

## Missing in 0.1.1, and the addition

| Id | Feature in the material | 0.2 addition |
| --- | --- | --- |
| G1 | A keyed legend: three or four numbered notes under (or beside) the court, with the number badge on a move, a line, a ring, a lane, a half of the court or a bare point, not only on a ball path. Some rows have a color swatch instead of a number. | Top-level `legend`: notes `{ key?, color?, text }`, drawn under the court. A `key` badge on `player`, `machine`, `cone`, `zone`, `move` and `line`, and a new `mark` item: a badge at a point. A note keyed to a shot uses that shot's badge. |
| G2 | A line across the court to split-step on, dashed and colored, sometimes with a badge; elsewhere a band with "split step" in it. | New `line` item: two ends, `color`, `dash`, `label`, `key`, no arrowhead. A band stays a `zone`. |
| G3 | Path color and dash with a meaning: a color per kind of shot (patient, aggressive, feed, partner cover), dashed for cooperative or optional, on ball paths and movement alike. The arrowhead follows the line. | `color` on `ball`, `move` and `line` from seven path colors that read on the court; `dash` on `ball` and `line`. The head and the shot badge take the color. |
| G4 | Start or vacated positions: a dashed ring the size of a player with the number inside; a faded disc at the start of a move; a dashed outline box for space left open. | `ghost: true` on `player` (dashed ring, label inside, no fill) and on `zone` (dashed outline, no fill). |
| G5 | A role written under a player disc: hitter, feeder, reader, partner, attacker, blocker and the like, 6 to 8 characters, on a second line under a one-letter disc. | `note` on `player`, up to 16 characters, under the disc. |
| G6 | Alternative shots from one player, either-or rather than a sequence (a drop or a drive; patient or aggressive), told apart by color and the legend. | `alt` letter on `ball`: paths with the same `n` and a letter draw `2a`, `2b`, and renumbering keeps them together. |
| G7 | A caption line printed under the diagram, one sentence. | `showCaption: true` draws the caption under the court and legend, wrapped, in italics. |
| G8 | Two courts side by side, the same setup on each, a heading above each and "winner moves up" between them (rough sketches). | Top-level `courts` (1 to 4) with a `label` and a `link` to the next; `court` on each item. Side by side in portrait, stacked in landscape. |
| G9 | Named targets: outline boxes or cones labelled R1, R2, T1, T2; numbered stations. | `label` on `cone` (up to 6 characters); a `ghost` `zone` with its label is an outlined named target; stations are `mark` badges or keyed cones. |
| G10 | About thirty short callouts on the court, 2 to 15 characters ("go", "punch", "reset?", "mine", "split-step"), nearly all beside a path, a player or a point. | **No new item.** Each becomes a badge (G1) on that path, player or point, with its words in the legend. Free text on the court collides with pieces and other text, has to be placed by hand to stay legible at print size, is not read in order by a screen reader, and would need an item type of its own; a badge plus a legend note says the same thing, keeps the court clear, and reuses one mechanism. |

## Out of scope for 0.2

| Id | Feature | Why |
| --- | --- | --- |
| G11 | A distance marker ("about 7 ft" between two players). | Seen once, as text only; the caption or a legend note carries it. |
| G12 | Flow diagrams off the court. | Not found in the material. The nearest are a word chain and a station circuit, both on a court and both drawable with badges and the legend. |
| G13 | Named court regions on a reference sheet ("baseline", "service court", "kitchen (7 ft)"), and a heading under each half when one court holds two games. | A reference sheet is documentation, not a drill. A `zone` with a label, or a `ghost` `zone`, names a region today; the two-games case is a legend note per half. |

## Left for later

Seen in the material but not added, each rare enough to wait for a request:

- A larger dashed halo around a player that "holds" (one diagram). A `ghost` player at the same spot or a badge with a legend note says it.
- Multi-segment paths and checkpoints along a path (two diagrams). Draw them as consecutive `move` or `line` items.
- A small ball marker with a word beside it (two diagrams). A `mark` and a legend note.
- A colored or dashed outline on a zone in a color other than its own, and a red team color (one workshop used blue against red teams). Player colors stay the four that remain distinct for color-blind viewers and in greyscale.
- A legend beside the court instead of under it. Under it wraps and prints reliably at any width.
- The editor draws the court of the diagram being edited; the legend, the caption and the other courts show in Get SVG, and are edited in the side panel.
