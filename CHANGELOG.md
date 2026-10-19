# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

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

[Unreleased]: https://github.com/maikuru/drillplot/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/maikuru/drillplot/releases/tag/v0.1.0
