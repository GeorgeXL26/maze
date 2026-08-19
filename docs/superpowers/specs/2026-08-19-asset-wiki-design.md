# Asset Library Wiki Page — Design

Date: 2026-08-19

## Global Constraints

- **Dev-only tool, not part of the deployed game.** Unlike `index.html`/
  `game.html`/`editor.html`, this page is never served from GitHub Pages and
  is not linked from `index.html`. It's for the person deciding what to
  build next, run locally via `node tools/asset-wiki/server.js`. Because
  there's no GitHub Pages constraint here, it's free to run an actual local
  Node server and compute everything live on each request — no generated,
  committed data file, no staleness, no regeneration step.

## 1. Overview

The vendored asset packs (`assets/kaykit-dungeon`, `assets/kaykit-adventurers`,
`assets/kaykit-skeletons`, `assets/kaykit-character-animations`,
`assets/audio/*`) contain hundreds of files, only a handful of which are
wired into `game.html`/`editor.html` today. There's no single place to see
what exists, what's already used, and what a future phase (per
`docs/ROADMAP.md`) might use next.

This feature adds a local reference page that lists every vendored asset,
grouped and filterable, cross-referenced against the actual game/editor code
to show wired-in vs. unused status, and tagged with which roadmap phase
would plausibly use each still-unused item.

## 2. Scope

**In scope:**
- A Node dev server that live-scans `assets/` and greps `game.html`,
  `editor.html`, and `shared/*.js` for wired-in asset paths.
- A page with two views: **by pack** (grouped/collapsible by pack →
  category) and **by status** (wired-in vs. unused, still labeled by
  pack/category).
- A small hand-curated phase-tag map (`pack` + `category` → phase number +
  note) merged in at request time; unmapped categories just show no tag.
- A distinct audio section: per-pack license/curation prose (read directly
  from the existing `assets/audio/README.md` rather than re-encoded into a
  second data file) plus a flat, per-file list with inline `<audio
  controls>` playback.
- Search-by-label filtering within the current view, client-side.

**Out of scope (explicitly deferred):**
- Deployment on GitHub Pages / linking from `index.html`.
- Thumbnail images or any 3D model preview (text/catalog only, per the
  roadmap). Once Phase 2's thumbnail generator exists, a later revision of
  this page can reuse those PNGs instead of text-only rows.
- A generated-and-committed data file (no build/regeneration step needed —
  the dev server computes everything live).
- Editing phase tags or curation from the page itself — `phase-tags.js` and
  `assets/audio/README.md` are edited by hand, in an editor, not through the
  UI.

## 3. Data model

Every non-audio asset becomes one entry, computed live by `server.js`:

```js
{
  id: 'banner_red',                          // filename without extension
  label: 'Banner Red',                       // humanized filename
  pack: 'kaykit-dungeon',                    // kaykit-dungeon | kaykit-adventurers |
                                              // kaykit-skeletons | kaykit-character-animations
  category: 'banner',                        // see derivation rules below
  path: 'assets/kaykit-dungeon/gltf/banner_red.gltf',
  status: 'unused',                          // 'wired-in' | 'unused'
  phaseTag: null                             // { phase: 2, note: '...' } | null
}
```

**Category derivation:**
- `kaykit-dungeon`, `kaykit-adventurers`: the filename's leading token
  before the first underscore, lowercased (`banner_red` → `banner`,
  `sword_2handed` → `sword`). This matches the convention already
  established in
  `docs/superpowers/specs/2026-08-19-decoration-props-design.md` §3.
- `kaykit-skeletons`: every file in this pack is prefixed `Skeleton_`
  (`Skeleton_Mage.glb`, `Skeleton_Shield_Large_A.gltf`,
  `Skeleton_Axe.gltf`), so the plain leading-token rule would collapse the
  whole pack into one `skeleton` category. Strip that redundant pack-name
  prefix first, then apply the same leading-token rule to what's left:
  `Skeleton_Mage` → `mage`, `Skeleton_Shield_Large_A` → `shield`,
  `Skeleton_Axe` → `axe`, `Skeleton_Quiver` → `quiver`. (General rule: strip
  a leading `<PackNoun>_` if the filename starts with one, case-insensitive,
  before taking the leading token.)
- `kaykit-character-animations`: structurally different — files are
  per-rig animation-clip bundles, not standalone props. `pack` stays
  `kaykit-character-animations`; a `rig` field (`Rig_Large` | `Rig_Medium`)
  replaces the usual pack/category split as the primary grouping, and
  `category` is the clip-set name (`CombatMelee`, `MovementBasic`, etc.).

**Wired-in detection:** for each entry, `server.js` checks whether its
`path` string appears verbatim in `game.html`, `editor.html`, or any
`shared/*.js` file. Simple substring match, computed fresh on every
request — cheap enough given the file count, and always correct even as
those files change.

**Phase tags** live in `tools/asset-wiki/phase-tags.js`, a small
hand-maintained lookup:

```js
module.exports = [
  { pack: 'kaykit-dungeon', category: 'chest', phase: 2, note: 'key/chest puzzle chain' },
  { pack: 'kaykit-dungeon', category: 'barrel', phase: 2, note: 'pushable prop' },
  { pack: 'kaykit-adventurers', category: 'sword', phase: 3, note: 'equippable weapon' },
  { pack: 'kaykit-skeletons', category: 'mage', phase: 4, note: 'enemy roster (ranged)' },
  { pack: 'kaykit-skeletons', category: 'warrior', phase: 4, note: 'enemy roster (melee)' },
  // ...
];
```

Matched by `pack` + `category` (whole categories, not per-file — a handful
of entries covers most of the catalog). `server.js` merges this into each
entry's `phaseTag` at request time; anything unmatched stays `null` and
renders with no tag rather than blocking the page.

**Audio entries** are shaped differently — no `category`/`phaseTag`:

```js
{ pack: 'spooky-playtime-davidkbd', file: 'DavidKBD---...-Labyrinth.ogg',
  path: 'assets/audio/spooky-playtime-davidkbd/....ogg' }
```

Curation (BGM picks, license terms, the known torch-ignite gap) is **not**
duplicated into a data structure — the audio view renders
`assets/audio/README.md` directly (parsed to HTML) above the file list for
context, keeping that content single-sourced.

## 4. Server (`tools/asset-wiki/server.js`)

Node built-ins only (`http`, `fs`, `path`) — no dependencies, consistent
with the project having no build tooling today.

- On each request to `/api/catalog`: walks `assets/` (excluding `audio/`),
  builds the entry list per §3, greps the three source locations for
  wired-in status, merges `phase-tags.js`, returns JSON.
- On each request to `/api/audio`: walks `assets/audio/`, builds the file
  list, reads and returns `assets/audio/README.md`'s raw markdown text
  alongside it.
- Serves `tools/asset-wiki/index.html` and `app.js` as static files.
- Serves everything under `assets/` as static files too, so `<audio src>`
  and any future model/thumbnail links resolve directly against the same
  server — no separate static file server needed.
- Listens on `http://localhost:4173` (arbitrary, uncommonly-used port;
  printed to the console on startup along with the URL to open).

## 5. Page (`tools/asset-wiki/index.html` + `app.js`)

- On load, fetches `/api/catalog` and `/api/audio`, renders client-side —
  no further server round-trips for interaction.
- **Tab control** at the top: "By pack" / "By status" / "Audio".
- **By pack**: one `<details>` section per pack (per-rig sub-sections for
  `kaykit-character-animations`), each containing `<details>` per category,
  each listing its entries. Matches the collapsible pattern already used in
  Phase 2's planned editor panel.
- **By status**: two top-level groups, **Wired-in** and **Unused**, entries
  still labeled with their pack/category inline. Unused entries carrying a
  `phaseTag` show it as a small badge (`Phase 2 — key/chest puzzle chain`)
  — this is the "what's next" view.
- **Audio**: per pack, the rendered README section for that pack (if any)
  followed by a flat row-per-file list, each row an `<audio controls
  src="...">`. `README.md`'s markdown is small and simple (headers, bullet
  lists, bold) — no markdown library, a short hand-rolled converter for
  just those constructs is enough and keeps the zero-dependency constraint
  from §4 intact.
- **Search box** (per view except Audio, where the file list is short
  enough not to need it): filters currently-visible rows by label
  substring, auto-expanding any category with a match — same interaction
  Phase 2's editor panel spec already describes.
- Plain CSS, no framework — matches `game.html`/`editor.html`'s existing
  style (inline `<style>` block, no external UI libraries).

## 6. Testing

- `tests/logic-tests.html` is a **browser-only** harness — it loads
  `shared/*.js` via `<script>` tags (the `window.X` IIFE pattern), with no
  Node involved. `server.js`'s logic (category derivation, wired-in
  matching, phase-tag lookup) is plain Node/CommonJS, so it can't run
  through that harness and doesn't belong there — it's dev tooling, not
  part of the deployed game's shared code.
- Instead, pure logic gets its own small Node test script,
  `tools/asset-wiki/test-logic.js`, run directly with `node
  tools/asset-wiki/test-logic.js` (same `assertEqual`/`assertTrue`-style
  pattern as `tests/logic-tests.html`, just printing to the console instead
  of the DOM).
- Server/rendering behavior is verified by actually running
  `node tools/asset-wiki/server.js` and checking the rendered output
  against the real `assets/` tree — e.g. confirming the By-pack view's
  per-pack counts match `find assets/<pack> -name '*.gltf' -o -name
  '*.glb' | wc -l`, and that every path currently referenced in
  `game.html`/`editor.html` shows as wired-in.
