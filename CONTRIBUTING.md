# Contributing to drillplot

Thank you for helping. drillplot is a small library, so the bar is simple: a change is small, has a test next to the behavior it changes, and keeps the renderer deterministic. By taking part you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md).

**Contents:** [Setup](#setup) · [Scripts](#scripts) · [Project layout](#project-layout) · [Coding standards](#coding-standards) · [Changing the format safely](#changing-the-format-safely) · [Documentation](#documentation) · [Pull requests](#pull-requests) · [Dependencies](#dependencies) · [Releasing](#releasing) · [Security](#security)

## Setup

You need **Node 22 or newer** (CI runs Node 22 and 24) and npm. The package itself has no runtime dependencies and declares `node >= 20`, but the test toolchain (vitest 5, jsdom 30) needs Node 22.

```sh
git clone https://github.com/maikuru/drillplot.git
cd drillplot
npm ci
```

Use `npm ci`, which installs exactly what `package-lock.json` pins. The repository's `.npmrc` sets `legacy-peer-deps=true`: it was added because the pinned test runner's peer dependency ranges did not resolve under npm 10. It keeps every contributor and CI on the same dependency tree, so leave it in place; if you change it, say why in your pull request.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run typecheck` | `tsc --noEmit` over `src`, `test` and `scripts` (strict mode). |
| `npm test` | Runs the tests once (`vitest run`). `npm run test:watch` watches. |
| `npm run build` | Bundles `dist/index.js` and `dist/editor.js` with tsup, writes the declarations to `dist/types` with `tsc`, then writes the two type entry points. |
| `npm run build:demo` | Builds, then copies `dist/` and `schema/` into `demo/` for a local look. Serve `demo/` with any static file server and open `index.html`. |
| `npm run docs:check` | Checks every relative link and anchor in the Markdown files, that the JSON examples in [docs/format.md](docs/format.md) are what the text says, and that every export is in [docs/api.md](docs/api.md). Run it after `npm run build`. |

`npm run typecheck`, `npm test` and `npm run build` are what CI runs, in that order, and what `prepublishOnly` runs before a publish. Run all three before you open a pull request.

## Project layout

```text
src/
  index.ts          the `drillplot` entry point
  sample.ts         sampleDrill()
  format/           the format: types, limits, the validator (parse.ts), opening an SVG or JSON (open.ts), shot numbering
  render/           the SVG renderer: geometry.ts (framing, arrows), markup.ts (court and pieces), svg.ts (the document)
  editor/           the <drillplot-editor> custom element: element.ts (behavior), model.ts (state and undo, no DOM),
                    template.ts (markup), style.ts (CSS and theme tokens), index.ts (the `drillplot/editor` entry point)
schema/             the JSON Schema, shipped as `drillplot/schema`
test/               vitest tests; test/__snapshots__ holds the renderer snapshot
demo/               the static demo site published to GitHub Pages
docs/               format.md, api.md and the sample SVG
scripts/            build helpers (write-type-entries.mjs, copy-demo.mjs) and check-docs.mjs
.github/            workflows (ci, codeql, pages, release), CODEOWNERS, Dependabot, issue and pull request templates
```

## Coding standards

- **TypeScript in strict mode**, with `noUncheckedIndexedAccess`. No `any` to get past a type error.
- **No runtime dependencies.** Anything the package needs at runtime is written here. Dev dependencies are for building and testing.
- **Tests next to behavior.** A bug fix gets a test that fails without the fix; a feature gets tests for what it promises. The editor's state and undo live in `src/editor/model.ts` with no DOM so they can be tested without a browser; the element itself is tested in jsdom (`test/editor.test.ts`).
- **The renderer is deterministic.** The same source gives the same text, byte for byte: no clocks, no randomness, no ids, no iteration over unordered data. `test/render.test.ts` snapshots the output. If a change alters the snapshot, that is a visible change to every exported diagram, so say so in the pull request and the changelog, and update the snapshot (`npx vitest run -u`) only on purpose.
- **Exported SVG stays self-contained:** explicit fills and strokes, no CSS, no `currentColor`, no `id` or `class` attributes (so many exports can share a page), and all text from a source escaped.
- **Accessibility is part of the feature.** Every control needs a visible label, a keyboard path and a focus ring; see the Accessibility section of the [README](README.md#accessibility).
- **Formatting:** match the surrounding code (single quotes, semicolons, two-space indent). Keep comments for why, not what.

## Changing the format safely

The format is a public contract: other people's diagrams and stored sources depend on it. The rules are in [docs/format.md](docs/format.md#versioning-and-compatibility). To change it:

1. **Decide whether it needs a new version.** If a document that is valid today would stop being valid or change meaning (removing or renaming a field, making a field required, tightening a limit, changing a unit or the coordinate system), it needs a new format version, not an edit of version 1. Open an issue first to agree on that.
2. **Change the three things together:** the validator ([`src/format/parse.ts`](src/format/parse.ts) and the limits and types beside it), the JSON Schema ([`schema/drill-diagram.v1.schema.json`](schema/drill-diagram.v1.schema.json)), and the shared samples in [`test/schema.test.ts`](test/schema.test.ts). The samples are a list of documents marked valid or invalid; the test runs each through both the validator and the schema (compiled with Ajv exactly as shipped) and fails if they disagree. A new rule needs a good sample and a bad one.
3. **New error keys** go in the `ErrorKey` type, the messages table, and [docs/format.md](docs/format.md#error-keys). An existing key is never renamed or repurposed.
4. **Update the renderer and editor** if the change is visible, and the render snapshot with it.
5. **Update the docs:** [docs/format.md](docs/format.md), [docs/api.md](docs/api.md) if an export changed, and the README.
6. **Add a line to [CHANGELOG.md](CHANGELOG.md)** under Unreleased, and say in the pull request whether older documents are affected.
7. **A new format version** also means a new schema file with its own `$id`, a reader that migrates the old version on read, and an `unsupported_version` refusal for versions the package does not know.

## Documentation

Docs are Markdown in the repository root and `docs/`. Link with relative paths, and run `npm run docs:check` after a build. Code samples in the docs should run: if you change an API, run the sample. Keep [docs/api.md](docs/api.md) in step with the exports (the check fails when an export is missing from it).

## Pull requests

`main` is protected, so every change arrives by pull request:

1. Fork the repository (or branch, if you are a maintainer) and make a branch from `main`.
2. Make the change, with tests and a changelog line. Keep it focused; unrelated cleanups go in their own pull request.
3. Run `npm run typecheck`, `npm test` and `npm run build` locally.
4. Open the pull request and fill in the template: what it changes, how it was checked, and the checklist.
5. Wait for the required checks and the review. A pull request to `main` needs **review from a code owner** (see [`.github/CODEOWNERS`](.github/CODEOWNERS); today that is the maintainer), and **passing checks**: CI on **Node 22 and Node 24**, and **CodeQL**.
6. History is **linear**: pull requests are merged by **squash** or **rebase**, never with a merge commit. Write the commit message (or the pull request title, for a squash) as a short summary of the change.

Bug reports and feature requests use the issue templates. For a question or a half-formed idea, an issue is fine.

## Dependencies

[Dependabot](.github/dependabot.yml) proposes weekly updates for npm packages and GitHub Actions, in grouped pull requests. It has a **two-week cooldown**: it waits 14 days after a release is published before proposing it, so a brand-new release has time to be vetted before it is adopted. Actions in the workflows are pinned to full commit SHAs, with the version in a comment; keep that when you update them.

## Releasing

Only maintainers release. A release is a version bump and a tag; the rest is automated.

```sh
# on an up-to-date main, with a clean tree and CHANGELOG.md ready
npm version patch   # or minor, or major: edits package.json, commits, and tags vX.Y.Z
git push --follow-tags
```

Before you run it, move the changelog's Unreleased entries under a new heading for the version and today's date (and add the comparison links if you use them).

Pushing a `v*` tag starts the **Release** workflow ([`.github/workflows/release.yml`](.github/workflows/release.yml)). Only maintainers can create `v*` tags. The workflow:

1. checks that the tag matches the version in `package.json`, and stops if it does not;
2. skips the publish, harmlessly, when npm already has that version, so re-pushing an old tag does nothing;
3. runs `npm ci`, then `npm publish --access public`, whose `prepublishOnly` runs the typecheck, the tests and the build first;
4. authenticates to npm with **trusted publishing** over OIDC (npm 11.5.1 or later; the workflow installs it), so **no npm token is stored anywhere**, and npm records the release's **provenance**.

For trusted publishing to work, npmjs.com must list this repository and the workflow file `release.yml` as the package's trusted publisher. Releases do not need a separate step to build the demo: the Pages workflow republishes the demo on every push to `main`.

A format version is not a package version: a package release does not change `version` in a source unless the format itself changed.

## Security

Do not report security problems in a public issue. Follow [SECURITY.md](SECURITY.md): use the repository's Security tab and choose **Report a vulnerability**.
