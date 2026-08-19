# Decoration Props & Editor Model Browser — Design

Date: 2026-08-19

## Global Constraints

- **The game and editor must remain playable as static files on GitHub
  Pages** — no server-side code, no Node.js at runtime. Everything the
  player's or editor's browser loads (`asset-catalog.js`, the `.png`
  thumbnails, `.gltf`/`.glb` models, level JSON) must be a static file
  fetchable over plain HTTP. The Puppeteer thumbnail generator (§8) is a
  dev-machine-only, run-once-then-commit-the-output tool — it never runs as
  part of loading or playing the game, exactly like `tools/` scripts don't
  run in any existing static-hosting setup.

## 1. Overview

The editor currently only places six structural/gameplay entities (Wall, Floor,
Torch, Item, Start, Exit), each with a hand-picked GLTF model. The vendored
asset packs (`assets/kaykit-dungeon`, `assets/kaykit-adventurers`) contain
~234 additional models — furniture, banners, barrels, weapons, shields, etc.
— that are currently unused.

This feature lets level designers place any of those 234 models as
**decorations**: cosmetic set-dressing that can optionally block movement, and
in a few cases (like barrels) be pushed around by the player during play. It
also redesigns the editor's placement panel from a small fixed icon grid into
a single scrollable, searchable, image-thumbnailed list covering every
placeable entity — the existing six tools included.

## 2. Scope

**In scope:**
- A static asset catalog covering all `kaykit-dungeon` (~205) and
  `kaykit-adventurers` equipment (~29) GLTF models.
- A `decorations` array on level data: grid-snapped position + 90°-step
  rotation, referencing a catalog id.
- Three interaction classes per catalog model: `decorative` (walk through),
  `solid` (blocks like a wall), `pushable` (blocks, but the player can shove
  it one cell if the far side is clear).
- A corner-aware collision fix for existing wall pieces (see §6) — the
  player's user report during this design surfaced that whole-cell blocking
  over-blocks corner/T-junction wall cells relative to their actual L-shaped
  geometry.
- A single unified, scrollable, filterable editor panel (search + category
  accordion) with real rendered picture thumbnails, covering Wall/Floor/
  Torch/Item/Start/Exit and all decorations. Pan remains a separate pinned
  control (it's a UI mode, not a placeable entity).
- A one-time, dev-only thumbnail generation script producing static PNGs.
- Lazy per-level model loading in both editor and game (only catalog ids
  actually used by the current level get fetched).

**Out of scope (explicitly deferred):**
- Free (non-grid-snapped) placement or arbitrary rotation.
- Per-model collision footprints (blocking is always whole-cell).
- Chain-pushing (pushing a pushable prop into another decoration).
- Smooth push animation (pushes snap instantly to the new cell).
- Persisting pushed positions back into level JSON.
- Live in-browser thumbnail rendering (using static pre-baked PNGs instead).

## 3. Asset catalog

New file: `shared/asset-catalog.js`, plain data (`window.AssetCatalog`, array
of entries), no build step required to load it (like every other `shared/*`
file, included via a plain `<script>` tag).

```js
{
  id: 'table_long_decorated_A',   // filename without extension
  label: 'Table Long Decorated A', // humanized filename
  category: 'table',               // derived from filename prefix
  pack: 'kaykit-dungeon',          // or 'kaykit-adventurers'
  path: 'assets/kaykit-dungeon/gltf/table_long_decorated_A.gltf',
  thumbnail: 'assets/thumbnails/table_long_decorated_A.png',
  interaction: 'solid'             // 'decorative' | 'solid' | 'pushable'
}
```

Six additional synthetic entries represent the existing structural tools so
they can live in the same list (id prefixed `core-` to avoid collision with
decoration ids): `core-wall`, `core-floor`, `core-torch`, `core-item`,
`core-start`, `core-exit`. `core-start` points its thumbnail/model at
`kaykit-adventurers/characters/Knight.glb` (the same model already used for
the player); `core-exit` points at `kaykit-dungeon/gltf/banner_red.gltf`
(there is no dedicated "flag" asset in either pack, and the red banner both
reads as a flag and keeps the existing red exit-marker association).

**Category** is the filename's leading word before the first underscore
(`banner_red` → `banner`, `wall_corner_gated` → `wall`, `sword_1handed` →
`sword`). The six `core-*` entries get a synthetic `core` category, always
sorted first and expanded by default.

**Interaction** is assigned by category, by hand, once, when the catalog is
generated — furniture/containers/barrels/shelves/beds default to `solid`;
small clutter, banners, candles, plates, bottles, coins, keys, weapons,
shields default to `decorative`; barrels specifically (`barrel_small`,
`barrel_large`, `barrel_small_stack`) default to `pushable`, matching the
prompted example. This is a data decision made once while writing the
catalog, not a runtime computation — reviewable and adjustable per-entry
without touching any logic code.

## 4. Level schema

`shared/maze-schema.js`'s `validateMazeData` gains one more check:
`decorations` must be an array. Each entry: `{ x, y, id, model, rotationY }`
— `model` is the catalog id; `id` is a unique instance id (`model + '-' + x +
'-' + y`, matching the existing item-id convention). Whether a decoration
blocks or is pushable is *not* stored per-instance — it's looked up from the
catalog at collision-check time, so retuning a model's `interaction` in the
catalog updates every level automatically.

## 5. Editor UI

**Layout.** The current `#palette` 2-column grid and its "Tools" label are
replaced by:
- A search `<input>`.
- A single scrollable container of category sections (`<details>` elements
  are enough — free collapse/expand, no JS state to manage). `core` is
  always first and starts expanded; every other category starts collapsed.
  Typing in the search box filters entries across all categories by label
  substring match, and auto-expands (via the `open` attribute) any category
  with at least one match while search is non-empty; clearing search
  restores the collapsed-by-default state.
- Each row: `<img>` thumbnail (from the pre-baked PNG), label, and — for
  non-core entries — a small text badge (`solid`/`pushable`; nothing shown
  for `decorative`, the common case, to keep rows quiet).
- Pan stays a separate pinned button above the search box, unchanged.

**Selection & placement.** `currentTool` becomes a string that's either one
of the existing `EditorGrid.TOOLS` values or `'decoration:' + catalogId`.
Clicking a row selects it (same active-state styling already used).
`applyToolAt` gets one new branch: for a `decoration:*` tool, it toggles a
decoration at that cell in `data.decorations` (remove if the same catalog id
already occupies that exact cell, otherwise replace whatever's there and add
the new one) — mirroring the existing Torch/Item toggle logic exactly.
`findEntityAt`/`moveEntity` gain a `decoration` case so placed decorations
drag-move like every other marker already does.

**Rotation.** Pressing `R`:
- If the cell under the cursor holds a decoration, rotate that decoration's
  `rotationY` by 90° in place and re-render it.
- Otherwise, rotate a small "pending facing" value (shown as a rotating
  arrow glyph near the search box) that gets applied to the *next* placement.

**Rendering.** `editor.html` keeps a `decorationTemplates` cache keyed by
catalog id, populated on first use via the existing `loadModel()` helper —
opening the editor never loads all 234 GLTFs, only the ones a level actually
references (plus whatever the user places during the session).

## 6. Corner-aware wall collision

Both `game.html` movement and decoration-blocking need to answer "is this
exact world point walkable," not just "is this whole cell walkable." New
function in `shared/maze-schema.js`:

```js
isWorldWalkable(data, x, z)
```

- Rounds `(x, z)` to the nearest cell `(gx, gy)`.
- If a decoration occupies `(gx, gy)` with `interaction !== 'decorative'`
  (i.e. `solid` or `pushable`), the whole cell is blocked — decorations
  never get the quadrant treatment, only wall pieces do. (Pushable props are
  re-checked specially by the caller before it relies on this generic
  answer — see §7 — so this function only needs to give the *default*
  blocked/open verdict, not know about pushing.)
- Otherwise, if the cell is floor, walkable.
- If it's a wall cell, compute its neighbor mask (already done for
  auto-tiling) and the query point's quadrant relative to the cell center
  (`NW`/`NE`/`SW`/`SE`, from the sign of `x - gx` and `z - gy`). Look up
  quadrant solidity from the mask's connection pattern:
  - 0, 1, or 2-opposite connections (dead end / straight / pillar): all 4
    quadrants solid — unchanged from today's whole-cell block.
  - 2-adjacent connections (corner, e.g. N+E): 3 quadrants solid, the one
    diagonally opposite the turn open (N+E → SW open; S+E → NW open; S+W →
    NE open; N+W → SE open).
  - 3 connections (T-junction): the 2 quadrants adjacent to the missing
    direction open (missing W → NW and SW open, etc.).
  - 4 connections (crossing): all 4 quadrants solid.

`shared/player-controller.js`'s `cellBlocked` is replaced by a call to
`isWorldWalkable`, passing the exact probed point instead of a pre-rounded
cell — same call site in `resolveCollision`, richer answer.

## 7. Game rendering, collision, and pushable props

- On level load, `game.html` scans `data.decorations` for the set of unique
  `model` ids in use and loads only those (mirroring the editor's lazy
  loading), building one mesh per decoration entry.
- Movement collision (`resolveCollision`) is extended: before falling back on
  `isWorldWalkable`'s generic verdict (§6 — which already blocks `solid` and
  `pushable` cells alike), the caller checks whether the target cell holds a
  `pushable` decoration specifically. If so, it tries the push: when the cell
  one step further in the push direction (same axis being resolved) is
  walkable *and* unoccupied by another decoration, the decoration's live
  position moves there and the player is allowed through. If the push isn't
  possible, resolution falls through to `isWorldWalkable`, which blocks the
  cell exactly like a wall. `solid` decorations never get a push attempt —
  they always resolve straight to `isWorldWalkable`'s block. No
  chain-pushing — a pushable prop cannot be pushed into a cell that already
  holds another decoration, even a pushable one.
- Pushable decorations keep a live `{x, y}` separate from the authored level
  data; reloading the level resets them, the same way collected items don't
  rewrite the source JSON.
- New pure function in `shared/player-controller.js`:
  `resolvePush(decorations, cell, direction, mazeData)` returning either the
  updated decorations array (prop moved) or `null` (push failed, caller
  treats the move as blocked) — kept separate from `resolveCollision` so
  it's independently testable.

## 8. Thumbnail generation

A dev-only Node script, `tools/generate-thumbnails.js` (not loaded by the
game or editor at runtime), using Puppeteer to drive a headless Chromium
running a tiny three.js scene:
- For each catalog entry, load its model (or `Knight.glb`/`banner_red.gltf`
  for the two synthetic core entries that borrow another model), compute its
  bounding box, frame an orthographic camera to fit it with a small margin,
  render at a fixed small size (e.g. 160×160) against a transparent
  background, and save to `assets/thumbnails/<id>.png`.
- Run manually (`node tools/generate-thumbnails.js`) whenever a new model is
  added to the catalog; output is committed to the repo like any other
  asset. Not part of any player-facing load path.

## 9. Testing

- `shared/asset-catalog.js`: every entry has `{id, label, category, pack,
  path, thumbnail, interaction}`; no duplicate ids; `interaction` is one of
  the three valid values.
- `shared/maze-schema.js`: `isWorldWalkable` quadrant cases — one per corner
  orientation, one per T-junction orientation, straight/crossing still fully
  solid, plus decoration-blocking cases (solid blocks, decorative doesn't).
- `shared/player-controller.js`: `resolvePush` — succeeds into an open cell,
  fails against a wall, fails against another decoration (no chain-push),
  and is never invoked for `decorative`-class props.
- `shared/editor-grid.js`: `applyTool` with a `decoration:*` tool value —
  add, toggle-off, replace-on-occupied-cell, rotate.
- No new browser-automation suite; UI changes continue to be verified with
  manual Playwright spot-checks, consistent with how this project has been
  tested throughout.

## 10. Files touched

- New: `shared/asset-catalog.js`, `tools/generate-thumbnails.js`,
  `assets/thumbnails/*.png` (~240 files).
- Modified: `shared/maze-schema.js`, `shared/player-controller.js`,
  `shared/editor-grid.js`, `editor.html`, `game.html`,
  `tests/logic-tests.html`.
