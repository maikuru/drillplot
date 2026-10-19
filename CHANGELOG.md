# Changelog

All notable changes to this project are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-10-19

### Added

- Source format `drill-diagram` version 1: players, ball machines, cones, target zones, movement arrows and numbered ball paths, in court feet, with a parser and validator that return typed errors with stable keys.
- JSON Schema (draft 2020-12) for the format, tested against the validator.
- `renderSvg(source, { greyscale? })`: deterministic SVG with explicit fills, a viewBox, a title, an optional description and the source embedded in `<metadata>`.
- `<drillplot-editor>` custom element: palette, select, move and nudge, delete, undo and redo, inspector, full, half and kitchen views, portrait and landscape, a display-only greyscale view, Get SVG, Copy SVG, Copy source and Open from source; `change`, `save` and `source-error` events; theme tokens as CSS custom properties.
- A static demo site and GitHub Actions workflows for CI and GitHub Pages.

### Fixed (relative to the prototype this was ported from)

- Exported SVGs no longer carry an `id` that clashes when several are inlined in one page.
- The embedded source no longer includes the editor's internal item ids.
- Metadata is XML-escaped text instead of a CDATA block, which a source containing `]]>` could break; CDATA exports from the prototype still open.
- Pieces and arrows can no longer be dragged, nudged or typed outside the court plus margin.
- Opening a diagram is one undo step that restores the title, caption and view as well as the pieces.
- Every action can be done without a pointer: exact coordinate fields for the selected piece, and Enter adds an arrow when an arrow tool is chosen.
- Unknown team keys and out-of-range values are refused with a message instead of being silently replaced.
