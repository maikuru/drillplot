# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.2.0] - 2026-10-29

Every format addition below is optional and still format version 1. A document written for 0.1 validates, saves and renders byte for byte as before; `test/compat.test.ts` checks that against SVGs written by 0.1.1. [docs/coverage-0.2.md](docs/coverage-0.2.md) lists what real drill handouts draw and how each feature is covered.

### Added

- **Legend and badges.** A top-level `legend` of notes (`{ key?, color?, text }`) drawn under the court; a `key` badge on players, machines, cones, zones, movement arrows and lines; a new `mark` item, a badge at a point. A note keyed to a shot number uses that shot's badge; a note with a `color` and no key shows a swatch. Short on-court callouts are written this way rather than as free text.
- **Lines.** A new `line` item with no arrowhead, with `color`, `dash`, `label` and `key`, such as a line to split-step on.
- **Path styles.** `color` on ball paths, movement arrows and lines (`PATH_COLORS`: yellow, white, orange, red, pink, green, black; `PATH_PALETTE` has the hex values); `dash` on ball paths and lines for a cooperative or optional shot. The arrowhead and the shot badge follow the color.
- **Start positions and open space.** `ghost: true` draws a player as a dashed ring and a zone as a dashed outline.
- **Notes and names.** `note` on a player (up to 16 characters) under the disc; `label` on a cone (up to 6 characters) beside it.
- **Either-or shots.** `alt`, one letter, on a ball path: `2a` and `2b` are choices for shot 2. `ballItems`, `hasShotGap` and `renumberShots` keep alternatives together.
- **A visible caption.** `showCaption: true` prints the caption under the drawing.
- **Several courts.** A top-level `courts` list (1 to 4, each with a `label` and a `link` to the next, such as "Winner moves up") and `court` on each item; side by side in portrait, stacked in landscape, each court clipped in its own nested `<svg>`.
- New error keys `bad_color`, `bad_key`, `bad_alt`, `bad_court`, `bad_courts` and `bad_legend`, and the new limits in `LIMITS`. The JSON Schema describes every addition.
- The editor edits all of it: a legend badge in the palette, a Line tool, inspector fields for the badge key, role, start position or open space, color, dash and either-or letter, a cone's name and a line's label, and side-panel sections for the printed caption, the legend and the courts (with a court picker in the toolbar; new pieces go on the court being edited).
- Six generic fixture diagrams rebuilt from real handouts, with SVG snapshots, and a demo gallery of examples including two that use the additions.

### Changed

- The editor's court now scales to fit its area in both directions. Before, the court area grew with the side panel, so on a laptop the court was drawn too large to see whole. The area is `--drillplot-stage-height` tall (default unchanged), or fills the element when the host gives it a height; the side panel scrolls on its own. `:host` is now a flex column.
- The demo page has a compact header with a link to the GitHub repository, sizes the editor to the window on wide screens, and shows a gallery of examples that open in the editor.
- Draw order adds lines (after zones) and marks (on top). Items of the 0.1 types keep their order.

### Notes

- The editor draws the court being edited; the legend, the printed caption and the other courts appear in Get SVG and the exported SVG.
- The JSON Schema cannot check an item's `court` against the number of courts; `parseSource` does.

### Security

- `parseText` and `extractSourceText` read an SVG's embedded source in one left-to-right pass, in linear time. Before, crafted text (a run of unclosed `<!--`, unclosed `<metadata>` tags, or `<metadata ` with no `>`) took time growing with the square of its length: about 4 seconds for 320 KB and over 20 seconds for a megabyte, a denial of service for a server that opens uploaded SVGs. The result is the same for every input (checked against the old code on 300,000 random inputs). Closes CodeQL alerts `js/polynomial-redos` and `js/incomplete-multi-character-sanitization`: nothing is now removed and searched again, so removing a comment cannot form a new one.
- Development only: `fast-uri` (used by `ajv` in the tests) updated from 3.1.8 to 3.1.9 for GHSA-w74x-v6f9-j3xg, GHSA-wjr9-j795-jxcr, GHSA-xhq7-xmqj-769h and GHSA-333x-w4r6-6crp. The published package has no dependencies and was not affected.

## [0.1.1] - 2026-10-19

### Added

- Documentation: a restructured README with badges, a quick start for the renderer, the editor, React and Vue, the editor reference (attributes, properties, events, keyboard, theming, parts) and validation; [docs/format.md](docs/format.md), the format as a specification; [docs/api.md](docs/api.md), every export of `drillplot`, `drillplot/editor` and `drillplot/schema`; a sample SVG under `docs/`.
- [CONTRIBUTING.md](CONTRIBUTING.md) and a [Code of Conduct](CODE_OF_CONDUCT.md) (Contributor Covenant 2.1).
- `npm run docs:check` (`scripts/check-docs.mjs`): checks every relative link and anchor in the Markdown files, the JSON examples in the format specification, and that every export is in the API reference.
- Repository hygiene: CODEOWNERS, Dependabot for npm and GitHub Actions with a two-week cooldown after a release, CodeQL analysis, a security policy ([SECURITY.md](SECURITY.md)), issue and pull request templates, and Actions pinned to commit SHAs.
- CI runs the typecheck, tests and build on Node 22 and 24.

### Changed

- The build uses TypeScript 7.0.2. Type declarations are now written by `tsc` (TypeScript 7 has no JavaScript API for tsup's declaration step) into `dist/types`, and `dist/index.d.ts` and `dist/editor.d.ts` re-export them. The public types and entry points are unchanged.
- Dev dependencies updated: vitest 5.0.5, jsdom 30.1.3, vite 8.3.4, @types/node 26.6.5. GitHub Actions updated to checkout 7, setup-node 7, configure-pages 6, upload-pages-artifact 5, deploy-pages 5 and CodeQL 4.
- The Release workflow skips a version npm already has, so pushing an earlier release's tag again is harmless. Releases publish with npm trusted publishing (OIDC) and provenance, with no stored token.
- `package.json` gains the `docs:check` script.

## [0.1.0] - 2026-10-19

### Added

- Source format `drill-diagram` version 1: players, ball machines, cones, target zones, movement arrows and numbered ball paths, in court feet, with a parser and validator that return typed errors with stable keys.
- JSON Schema (draft 2020-12) for the format, tested against the validator, with `$id` `https://maikuru.github.io/drillplot/schema/drill-diagram.v1.schema.json`.
- `renderSvg(source, { greyscale? })`: deterministic SVG with explicit fills, a viewBox, a title, an optional description and the source embedded in `<metadata>`.
- `<drillplot-editor>` custom element: palette, select, move and nudge, delete, undo and redo, inspector, full, half and kitchen views, portrait and landscape, a display-only greyscale view, Get SVG, Copy SVG, Copy source and Open from source; `change`, `save` and `source-error` events; theme tokens as CSS custom properties.
- A static demo site and GitHub Actions workflows for CI and GitHub Pages.
- Package metadata: author, repository, homepage, bugs, `engines` (Node 20 or newer) and `prepublishOnly`.

### Changed

- Text may not contain control characters, U+FFFE or U+FFFF, or unpaired surrogates (error key `bad_character`; the caption may keep tabs and line breaks). Such characters made exported SVGs malformed XML. The renderer also strips them.
- Shot numbers are capped at 200 in the validator and schema; the renderer writes `n` as a whole number.
- An angle that rounds up to 360 (359.995 up to 360) is accepted and becomes 0, matching the schema.

### Fixed

- The keyboard focus ring on the checked view and orientation option is now visible; the pressed tool button has a solid fill.
- Undoing Open from source restores the title and caption fields.
- Escape closes a sheet and returns focus to the button that opened it.
- `defineDrillplotEditor(name)` works for a custom tag name.
- Live regions, the piece list and the panels are no longer rewritten on every pointer move.
- The aim slider steps by 1, so a loaded angle is not snapped.
- Metadata inside an XML comment is ignored when opening an SVG.

### Fixed (relative to the prototype this was ported from)

- Exported SVGs no longer carry an `id` that clashes when several are inlined in one page.
- The embedded source no longer includes the editor's internal item ids.
- Metadata is XML-escaped text instead of a CDATA block, which a source containing `]]>` could break; CDATA exports from the prototype still open.
- Pieces and arrows can no longer be dragged, nudged or typed outside the court plus margin.
- Opening a diagram is one undo step that restores the title, caption and view as well as the pieces.
- Every action can be done without a pointer: exact coordinate fields for the selected piece, and Enter adds an arrow when an arrow tool is chosen.
- Unknown team keys and out-of-range values are refused with a message instead of being silently replaced.

[Unreleased]: https://github.com/maikuru/drillplot/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/maikuru/drillplot/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/maikuru/drillplot/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/maikuru/drillplot/releases/tag/v0.1.0
