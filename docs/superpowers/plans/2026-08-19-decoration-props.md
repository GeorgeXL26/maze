# Decoration Props & Editor Model Browser Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let level designers place any of the ~236 vendored KayKit models as decorative props (some blocking movement, one class pushable) via a redesigned, unified, searchable/filterable editor panel with real rendered thumbnails, and make those props render and behave correctly during play — including a corner-aware collision fix for existing wall pieces.

**Architecture:** A statically-generated asset catalog (`shared/asset-catalog.js`) drives both a redesigned editor sidebar and game-side rendering. Decorations are grid-snapped `{x, y, model, rotationY}` entries on level data; their `interaction` class (`decorative`/`solid`/`pushable`) lives in the catalog, not per-instance. A new `isWorldWalkable` collision primitive in `shared/maze-schema.js` replaces whole-cell wall blocking with quadrant-aware blocking for corner/T-junction pieces, and also accounts for blocking decorations — both the editor and the game read it through the same code path. Thumbnails are pre-baked PNGs produced once by a dev-only Puppeteer script; nothing at runtime needs Node.

**Tech Stack:** Vanilla JS (ES5-style, `var`/`function`, matching the existing codebase), three.js r160 via CDN importmap, plain `<script>`-tag shared modules (no bundler), Node + Puppeteer for the one-time thumbnail generator only.

**Spec:** `docs/superpowers/specs/2026-08-19-decoration-props-design.md`

## Global Constraints

- **The game and editor must remain playable as static files on GitHub Pages** — no server-side code, no Node.js at runtime. `asset-catalog.js`, the `.png` thumbnails, `.gltf`/`.glb` models, and level JSON must all be plain static files. The Puppeteer thumbnail generator runs once on a dev machine and its *output* gets committed — it is never invoked while loading or playing the game.
- No free/sub-cell placement or arbitrary rotation — decorations are grid-snapped with 90°-step rotation only.
- Decoration blocking is always whole-cell (no per-model collision footprints).
- No chain-pushing (a pushable prop cannot be pushed into a cell already holding another decoration).
- No smooth push animation — pushes snap instantly.
- Pushed positions are live-only; reloading a level resets them.
- Existing structural tools (Wall/Floor/Torch/Item/Start/Exit) keep their current special gameplay behavior unchanged (auto-tiling, fog-of-war, collectibles, win/spawn) — decorations are a separate, additive layer.

---

### Task 1: Asset catalog generator + generated catalog

**Files:**
- Create: `tools/generate-catalog.js`
- Create (generated output, committed): `shared/asset-catalog.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Produces: `window.AssetCatalog` — array of `{ id, label, category, pack, path, thumbnail, interaction }`. `interaction` is one of `'decorative' | 'solid' | 'pushable'`. Six entries have ids `core-wall`, `core-floor`, `core-torch`, `core-item`, `core-start`, `core-exit` and `category: 'core'`.

- [ ] **Step 1: Write the catalog generator script**

Create `tools/generate-catalog.js`:

```js
// tools/generate-catalog.js
// Run: node tools/generate-catalog.js
// Regenerates shared/asset-catalog.js by scanning the vendored asset packs.
// This is a dev-only tool — its OUTPUT is a plain static file, and that
// output (not this script) is what the game and editor load at runtime.
var fs = require('fs');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var DUNGEON_DIR = path.join(ROOT, 'assets/kaykit-dungeon/gltf');
var ADVENTURER_DIR = path.join(ROOT, 'assets/kaykit-adventurers/assets');
var OUT_FILE = path.join(ROOT, 'shared/asset-catalog.js');

// Already owned by the dedicated Wall/Torch/Item tools — excluded here so
// the decoration browser never shows a confusing duplicate.
var EXCLUDE_DUNGEON_FILES = [
  'wall.gltf', 'wall_corner.gltf', 'wall_Tsplit.gltf', 'wall_crossing.gltf',
  'torch.gltf', 'torch_lit.gltf', 'coin.gltf'
];

var CATEGORY_INTERACTION = {
  banner: 'decorative', floor: 'decorative', wall: 'solid', stairs: 'decorative',
  table: 'solid', trunk: 'solid', bottle: 'decorative', candle: 'decorative',
  plate: 'decorative', barrier: 'solid', coin: 'decorative', box: 'solid',
  barrel: 'pushable', torch: 'decorative', sword: 'decorative', shelf: 'solid',
  bed: 'solid', rubble: 'decorative', pillar: 'solid', keyring: 'decorative',
  keg: 'solid', chest: 'solid', stool: 'solid', shelves: 'solid', key: 'decorative',
  crates: 'solid', column: 'solid', chair: 'solid', ceiling: 'decorative',
  arrow: 'decorative', axe: 'decorative', bow: 'decorative', crossbow: 'decorative',
  dagger: 'decorative', mug: 'decorative', quiver: 'decorative', shield: 'decorative',
  smokebomb: 'decorative', spellbook: 'decorative', staff: 'decorative', wand: 'decorative'
};

function humanize(id) {
  return id.split('_').map(function (w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

function scanPack(dir, pack, relPrefix, exclude) {
  var files = fs.readdirSync(dir).filter(function (f) {
    return /\.(gltf|glb)$/i.test(f) && exclude.indexOf(f) === -1;
  });
  return files.map(function (file) {
    var id = file.replace(/\.(gltf|glb)$/i, '');
    var category = id.split('_')[0];
    var interaction = CATEGORY_INTERACTION[category];
    if (!interaction) {
      throw new Error('No interaction mapping for category "' + category + '" (file ' + file + ')');
    }
    return {
      id: id,
      label: humanize(id),
      category: category,
      pack: pack,
      path: relPrefix + '/' + file,
      thumbnail: 'assets/thumbnails/' + id + '.png',
      interaction: interaction
    };
  });
}

var coreEntries = [
  { id: 'core-wall', label: 'Wall', category: 'core', pack: 'kaykit-dungeon', path: 'assets/kaykit-dungeon/gltf/wall.gltf', thumbnail: 'assets/thumbnails/core-wall.png', interaction: 'decorative' },
  { id: 'core-floor', label: 'Floor', category: 'core', pack: null, path: null, thumbnail: 'assets/thumbnails/core-floor.png', interaction: 'decorative' },
  { id: 'core-torch', label: 'Torch', category: 'core', pack: 'kaykit-dungeon', path: 'assets/kaykit-dungeon/gltf/torch_lit.gltf', thumbnail: 'assets/thumbnails/core-torch.png', interaction: 'decorative' },
  { id: 'core-item', label: 'Item', category: 'core', pack: 'kaykit-dungeon', path: 'assets/kaykit-dungeon/gltf/coin.gltf', thumbnail: 'assets/thumbnails/core-item.png', interaction: 'decorative' },
  { id: 'core-start', label: 'Start', category: 'core', pack: 'kaykit-adventurers', path: 'assets/kaykit-adventurers/characters/Knight.glb', thumbnail: 'assets/thumbnails/core-start.png', interaction: 'decorative' },
  { id: 'core-exit', label: 'Exit', category: 'core', pack: 'kaykit-dungeon', path: 'assets/kaykit-dungeon/gltf/banner_red.gltf', thumbnail: 'assets/thumbnails/core-exit.png', interaction: 'decorative' }
];

var entries = coreEntries.concat(
  scanPack(DUNGEON_DIR, 'kaykit-dungeon', 'assets/kaykit-dungeon/gltf', EXCLUDE_DUNGEON_FILES),
  scanPack(ADVENTURER_DIR, 'kaykit-adventurers', 'assets/kaykit-adventurers/assets', [])
);

var seen = {};
entries.forEach(function (e) {
  if (seen[e.id]) throw new Error('Duplicate catalog id: ' + e.id);
  seen[e.id] = true;
});

var header = '// AUTO-GENERATED by tools/generate-catalog.js — do not hand-edit.\n' +
  '// Re-run `node tools/generate-catalog.js` after adding/removing asset files.\n' +
  'window.AssetCatalog = ' + JSON.stringify(entries, null, 2) + ';\n';

fs.writeFileSync(OUT_FILE, header);
console.log('Wrote ' + entries.length + ' entries to ' + path.relative(ROOT, OUT_FILE));
```

- [ ] **Step 2: Run the generator**

Run: `node tools/generate-catalog.js`
Expected: `Wrote 241 entries to shared/asset-catalog.js` (204 dungeon decorations + 31 adventurer decorations + 6 core entries). If the count differs, a new file was added to the asset packs since this plan was written, or the exclude list needs adjusting — investigate before continuing, don't just accept a different number.

- [ ] **Step 3: Add a catalog smoke test**

Add to `tests/logic-tests.html`, in a new `<script src="../shared/asset-catalog.js"></script>` tag placed right after the existing `<script src="../shared/maze-schema.js"></script>` line, then add these assertions in the main test `<script>` block (near the top, after the existing `maze-schema` tests):

```js
// asset-catalog tests
var VALID_INTERACTIONS = { decorative: true, solid: true, pushable: true };
var catalogIds = {};
var catalogErrors = [];
window.AssetCatalog.forEach(function (entry) {
  ['id', 'label', 'category', 'pack', 'path', 'thumbnail', 'interaction'].forEach(function (field) {
    if (!(field in entry)) catalogErrors.push('entry missing "' + field + '": ' + JSON.stringify(entry));
  });
  if (!VALID_INTERACTIONS[entry.interaction]) catalogErrors.push('bad interaction on ' + entry.id);
  if (catalogIds[entry.id]) catalogErrors.push('duplicate id: ' + entry.id);
  catalogIds[entry.id] = true;
});
assertEqual(catalogErrors, [], 'AssetCatalog: every entry has required fields, valid interaction, unique id');
assertTrue(window.AssetCatalog.length > 200, 'AssetCatalog: has the expected large number of entries');
```

- [ ] **Step 4: Run tests to verify they pass**

Start the dev server if not already running (`python3 -m http.server 8934` from the repo root), then load `http://localhost:8934/tests/logic-tests.html` and check the console output (or `document.getElementById('out').textContent`). All assertions — including the two new ones — must read `PASS`.

- [ ] **Step 5: Commit**

```bash
git add tools/generate-catalog.js shared/asset-catalog.js tests/logic-tests.html
git commit -m "Add generated asset catalog covering all vendored decoration models"
```

---

### Task 2: Thumbnail generation pipeline

**Files:**
- Create: `package.json`
- Create: `.gitignore` (or append to it if one already exists)
- Create: `tools/thumbnail-harness.html`
- Create: `tools/generate-thumbnails.js`
- Create (generated output, committed): `assets/thumbnails/*.png` (241 files)

**Interfaces:**
- Consumes: `window.AssetCatalog` from Task 1 (`shared/asset-catalog.js`).
- Produces: one PNG per catalog entry at the `thumbnail` path already recorded in the catalog (`assets/thumbnails/<id>.png`), consumed by the editor UI in Task 8.

- [ ] **Step 1: Check for an existing `.gitignore` and add `node_modules/`**

```bash
test -f .gitignore && echo exists || echo none
```

If it exists, append `node_modules/` on its own line (only if not already present). If it doesn't exist, create one containing exactly:

```
node_modules/
```

- [ ] **Step 2: Create `package.json`**

```json
{
  "name": "torch-maze-tools",
  "private": true,
  "version": "1.0.0",
  "description": "Dev-only tooling for Torch Maze (thumbnail generation). Not required to play the game — the game and editor are static files with no build step.",
  "devDependencies": {
    "puppeteer": "^23.0.0"
  }
}
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`
Expected: completes without error, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 4: Create the render harness page**

Create `tools/thumbnail-harness.html`:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>html,body{margin:0;background:transparent;}</style>
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
    "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
  }
}
</script>
</head>
<body>
<script type="module">
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

var SIZE = 320;
var renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setSize(SIZE, SIZE);
document.body.appendChild(renderer.domElement);

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(35, 1, 0.05, 500);

var ambient = new THREE.AmbientLight(0xffffff, 2.0);
scene.add(ambient);
var dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
dirLight.position.set(3, 5, 4);
scene.add(dirLight);

var loader = new GLTFLoader();
var current = null;

function frameObject(obj) {
  var box = new THREE.Box3().setFromObject(obj);
  var center = box.getCenter(new THREE.Vector3());
  var sphere = box.getBoundingSphere(new THREE.Sphere());
  var radius = Math.max(sphere.radius, 0.05);
  var dir = new THREE.Vector3(1, 1, 1).normalize();
  var distance = radius * 2.4;
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = distance * 0.1;
  camera.far = distance * 10;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
}

window.renderColorSwatch = function (hex) {
  if (current) { scene.remove(current); current = null; }
  var geo = new THREE.PlaneGeometry(2, 2);
  var mat = new THREE.MeshBasicMaterial({ color: hex });
  var mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  current = mesh;
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);
  camera.near = 0.1; camera.far = 10; camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  var url = renderer.domElement.toDataURL('image/png');
  scene.remove(mesh);
  current = null;
  return url;
};

window.renderThumbnail = async function (path) {
  if (current) { scene.remove(current); current = null; }
  var gltf = await loader.loadAsync(path);
  var model = gltf.scene;
  scene.add(model);
  current = model;
  frameObject(model);
  renderer.render(scene, camera);
  var url = renderer.domElement.toDataURL('image/png');
  scene.remove(model);
  current = null;
  return url;
};

window.harnessReady = true;
</script>
</body>
</html>
```

- [ ] **Step 5: Create the generator script**

Create `tools/generate-thumbnails.js`:

```js
// tools/generate-thumbnails.js
// Run: node tools/generate-thumbnails.js
// Starts a throwaway static file server, drives a headless browser to
// render each catalog model via tools/thumbnail-harness.html, and writes
// the resulting PNGs to assets/thumbnails/. Dev-only — the game and editor
// never run this; they only load its output (plain PNG files).
var fs = require('fs');
var path = require('path');
var http = require('http');
var puppeteer = require('puppeteer');

var ROOT = path.join(__dirname, '..');
var PORT = 8935;
var OUT_DIR = path.join(ROOT, 'assets/thumbnails');

var MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.png': 'image/png', '.jpg': 'image/jpeg'
};

function startServer() {
  return new Promise(function (resolve) {
    var server = http.createServer(function (req, res) {
      var filePath = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      fs.readFile(filePath, function (err, data) {
        if (err) { res.writeHead(404); res.end(); return; }
        var ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(PORT, function () { resolve(server); });
  });
}

function writeDataUrl(dataUrl, outPath) {
  var base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
  fs.writeFileSync(outPath, Buffer.from(base64, 'base64'));
}

async function main() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  var catalogSrc = fs.readFileSync(path.join(ROOT, 'shared/asset-catalog.js'), 'utf8');
  var sandbox = {};
  new Function('window', catalogSrc)(sandbox);
  var entries = sandbox.AssetCatalog;

  var server = await startServer();
  var browser = await puppeteer.launch();
  var page = await browser.newPage();
  page.on('console', function (msg) { console.log('[page]', msg.text()); });
  await page.goto('http://localhost:' + PORT + '/tools/thumbnail-harness.html');
  await page.waitForFunction('window.harnessReady === true');

  for (var i = 0; i < entries.length; i++) {
    var entry = entries[i];
    var outPath = path.join(OUT_DIR, entry.id + '.png');
    var dataUrl;
    if (entry.id === 'core-floor') {
      dataUrl = await page.evaluate(function () { return window.renderColorSwatch(0x556655); });
    } else {
      dataUrl = await page.evaluate(function (p) { return window.renderThumbnail(p); }, entry.path);
    }
    writeDataUrl(dataUrl, outPath);
    console.log('[' + (i + 1) + '/' + entries.length + '] ' + entry.id + '.png');
  }

  await browser.close();
  server.close();
}

main().catch(function (err) { console.error(err); process.exit(1); });
```

- [ ] **Step 6: Run the generator**

Run: `node tools/generate-thumbnails.js`
Expected: 241 log lines counting up to `[241/241] ...png`, no errors. Takes a few minutes (loads and renders 241 models sequentially in a real headless browser).

- [ ] **Step 7: Verify the output**

```bash
ls assets/thumbnails/*.png | wc -l
```
Expected: `241`. Spot-check two or three files open fine as images (e.g. `assets/thumbnails/core-start.png` should show the knight character, `assets/thumbnails/core-exit.png` the red banner, `assets/thumbnails/core-floor.png` a plain green-gray swatch).

- [ ] **Step 8: Commit**

```bash
git add package.json .gitignore tools/thumbnail-harness.html tools/generate-thumbnails.js assets/thumbnails/
git commit -m "Add dev-only thumbnail generator and pre-baked decoration thumbnails"
```

---

### Task 3: Level schema — `decorations` field

**Files:**
- Modify: `shared/maze-schema.js` (`validateMazeData`)
- Modify: `shared/level-io.js` (`createDefaultLevel`)
- Modify: `shared/editor-grid.js` (`resizeGrid`)
- Modify: `levels/default.json`, `levels/level1.json` (add `"decorations": []`)
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Produces: every level data object now has a `decorations` array: `{ x, y, id, model, rotationY }[]`. `validateMazeData` rejects a level missing it, matching the existing treatment of `monsters`/`equipment`.

- [ ] **Step 1: Add the failing test**

Add to `tests/logic-tests.html`, right after the existing `validateMazeData` tests:

```js
assertTrue(!window.MazeSchema.validateMazeData({
  width: 3, height: 2, cells: ['#.#', '...'],
  torches: [], items: [], start: {x:1,y:0}, exit: {x:1,y:1},
  monsters: [], equipment: []
  // decorations intentionally omitted
}).valid, 'validateMazeData rejects a level missing decorations');
```

- [ ] **Step 2: Run test to verify it fails**

Reload `tests/logic-tests.html`. Expected: `FAIL` on the new assertion (current `validateMazeData` doesn't check `decorations` at all, so it accepts the object).

- [ ] **Step 3: Update `validateMazeData`**

In `shared/maze-schema.js`, find:

```js
    if (!Array.isArray(data.monsters)) errors.push('monsters must be an array (reserved for future use)');
    if (!Array.isArray(data.equipment)) errors.push('equipment must be an array (reserved for future use)');
    return { valid: errors.length === 0, errors: errors };
```

Replace with:

```js
    if (!Array.isArray(data.monsters)) errors.push('monsters must be an array (reserved for future use)');
    if (!Array.isArray(data.equipment)) errors.push('equipment must be an array (reserved for future use)');
    if (!Array.isArray(data.decorations)) errors.push('decorations must be an array');
    return { valid: errors.length === 0, errors: errors };
```

- [ ] **Step 4: Update the existing `validData` test fixture so earlier tests keep passing**

Near the top of `tests/logic-tests.html`, find:

```js
  var validData = {
    width: 3, height: 2, cells: ['#.#', '...'],
    torches: [], items: [], start: {x:1,y:0}, exit: {x:1,y:1},
    monsters: [], equipment: []
  };
```

Replace with:

```js
  var validData = {
    width: 3, height: 2, cells: ['#.#', '...'],
    torches: [], items: [], start: {x:1,y:0}, exit: {x:1,y:1},
    monsters: [], equipment: [], decorations: []
  };
```

- [ ] **Step 5: Run tests to verify they pass**

Reload `tests/logic-tests.html`. All assertions (old and new) must read `PASS`.

- [ ] **Step 6: Update `createDefaultLevel`**

In `shared/level-io.js`, find:

```js
    return {
      width: width, height: height, cells: cells,
      torches: [], items: [],
      start: { x: 1, y: 1 },
      exit: { x: width - 2, y: height - 2 },
      monsters: [], equipment: []
    };
```

Replace with:

```js
    return {
      width: width, height: height, cells: cells,
      torches: [], items: [],
      start: { x: 1, y: 1 },
      exit: { x: width - 2, y: height - 2 },
      monsters: [], equipment: [], decorations: []
    };
```

- [ ] **Step 7: Update `resizeGrid` to keep decorations in-bounds**

In `shared/editor-grid.js`, find:

```js
    return {
      width: newWidth, height: newHeight, cells: newCells,
      torches: data.torches.filter(inBounds),
      items: data.items.filter(inBounds),
      start: inBounds(data.start) ? data.start : { x: 1, y: 1 },
      exit: inBounds(data.exit) ? data.exit : { x: newWidth - 2, y: newHeight - 2 },
      monsters: [], equipment: []
    };
```

Replace with:

```js
    return {
      width: newWidth, height: newHeight, cells: newCells,
      torches: data.torches.filter(inBounds),
      items: data.items.filter(inBounds),
      decorations: (data.decorations || []).filter(inBounds),
      start: inBounds(data.start) ? data.start : { x: 1, y: 1 },
      exit: inBounds(data.exit) ? data.exit : { x: newWidth - 2, y: newHeight - 2 },
      monsters: [], equipment: []
    };
```

- [ ] **Step 8: Add a resizeGrid decoration test**

Add to `tests/logic-tests.html`, after the existing `resizeGrid` tests:

```js
var decoResizeLevel = window.LevelIO.createDefaultLevel(5, 5);
decoResizeLevel.decorations.push({ x: 4, y: 4, id: 'chest-4-4', model: 'chest', rotationY: 0 });
var decoResized = window.EditorGrid.resizeGrid(decoResizeLevel, 3, 3);
assertEqual(decoResized.decorations, [], 'resizeGrid drops decorations that fall outside the new bounds');
```

- [ ] **Step 9: Update the two shipped level files**

Read `levels/default.json`, add `"decorations": []` alongside the existing `"monsters": []` and `"equipment": []` fields (same nesting level, valid JSON). Do the same for `levels/level1.json`.

- [ ] **Step 10: Run tests to verify everything passes**

Reload `tests/logic-tests.html`. All assertions must read `PASS`.

- [ ] **Step 11: Manually verify the two levels still load**

With the dev server running, open `http://localhost:8934/game.html?level=level1` and `http://localhost:8934/game.html?level=default` in a browser (or via Playwright navigation) and confirm no console errors — `validateMazeData` must accept both updated files.

- [ ] **Step 12: Commit**

```bash
git add shared/maze-schema.js shared/level-io.js shared/editor-grid.js levels/default.json levels/level1.json tests/logic-tests.html
git commit -m "Add decorations array to the level schema"
```

---

### Task 4: Corner-aware wall collision (`isWorldWalkable`)

**Files:**
- Modify: `shared/maze-schema.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Consumes: `wallNeighborMask`, `isWalkable`, `isWallCell` (all already in this file); `window.AssetCatalog` (Task 1) if present, for decoration-blocking — must degrade gracefully to "no decoration blocking" if `window.AssetCatalog` is undefined, so this function works in test contexts that don't load the catalog.
- Produces: `MazeSchema.isWorldWalkable(data, x, z)` — takes **continuous** world coordinates (not pre-rounded), returns `true`/`false`. Consumed by Task 5.

- [ ] **Step 1: Write the failing tests**

Add to `tests/logic-tests.html`, after the existing `isWalkable` tests:

```js
// isWorldWalkable: corner pieces open their diagonal quadrant
var cornerMaze = { width: 3, height: 3, cells: ['.#.', '.##', '...'], decorations: [] };
assertEqual(window.MazeSchema.isWorldWalkable(cornerMaze, 0.7, 1.3), true,
  'isWorldWalkable: N+E corner opens its diagonally-opposite SW quadrant');
assertEqual(window.MazeSchema.isWorldWalkable(cornerMaze, 1.3, 0.7), false,
  'isWorldWalkable: N+E corner still blocks the NE quadrant (adjacent to both connected sides)');

// isWorldWalkable: T-junctions open the two quadrants next to the missing side
var tsplitMaze = { width: 3, height: 3, cells: ['.#.', '.##', '.#.'], decorations: [] };
assertEqual(window.MazeSchema.isWorldWalkable(tsplitMaze, 0.7, 0.7), true,
  'isWorldWalkable: T-junction missing W opens its NW quadrant');
assertEqual(window.MazeSchema.isWorldWalkable(tsplitMaze, 1.3, 0.7), false,
  'isWorldWalkable: T-junction missing W still blocks NE (adjacent to connected E)');

// isWorldWalkable: straight walls stay fully solid
var straightMaze = { width: 3, height: 3, cells: ['.#.', '.#.', '.#.'], decorations: [] };
assertEqual(window.MazeSchema.isWorldWalkable(straightMaze, 0.7, 1.3), false,
  'isWorldWalkable: straight wall pieces remain fully solid');

// isWorldWalkable: floor cells are always walkable regardless of quadrant
var openMaze = { width: 3, height: 3, cells: ['...', '...', '...'], decorations: [] };
assertEqual(window.MazeSchema.isWorldWalkable(openMaze, 1.3, 1.3), true,
  'isWorldWalkable: floor cells are walkable in every quadrant');

// isWorldWalkable: decorations block/don't block based on catalog interaction
window.AssetCatalog = [
  { id: 'test-solid', interaction: 'solid' },
  { id: 'test-decor', interaction: 'decorative' }
];
var decoBlockMaze = {
  width: 3, height: 3, cells: ['...', '...', '...'],
  decorations: [{ x: 1, y: 1, id: 'test-solid-1-1', model: 'test-solid', rotationY: 0 }]
};
assertEqual(window.MazeSchema.isWorldWalkable(decoBlockMaze, 1, 1), false,
  'isWorldWalkable: a solid decoration blocks its floor cell');
var decoOpenMaze = {
  width: 3, height: 3, cells: ['...', '...', '...'],
  decorations: [{ x: 1, y: 1, id: 'test-decor-1-1', model: 'test-decor', rotationY: 0 }]
};
assertEqual(window.MazeSchema.isWorldWalkable(decoOpenMaze, 1, 1), true,
  'isWorldWalkable: a decorative-only decoration does not block its floor cell');
```

Note: this sets `window.AssetCatalog` to a small fake catalog for the rest of the test run. No other test in this file reads `window.AssetCatalog`, so this is harmless, but it must run *after* the Task 1 catalog-shape tests (which check the real, generated catalog) — place this whole block after those, not before.

- [ ] **Step 2: Run tests to verify they fail**

Reload `tests/logic-tests.html`. Expected: `FAIL` on all six new assertions with `TypeError: window.MazeSchema.isWorldWalkable is not a function` (or similar) in the console.

- [ ] **Step 3: Implement `isWorldWalkable`**

In `shared/maze-schema.js`, add this function after `computeWallPiece` and before the `buildMazeMesh` function:

```js
  function decorationInteractionAt(data, gx, gy) {
    if (!data.decorations) return null;
    var found = null;
    for (var i = 0; i < data.decorations.length; i++) {
      if (data.decorations[i].x === gx && data.decorations[i].y === gy) { found = data.decorations[i]; break; }
    }
    if (!found || !window.AssetCatalog) return null;
    for (var j = 0; j < window.AssetCatalog.length; j++) {
      if (window.AssetCatalog[j].id === found.model) return window.AssetCatalog[j].interaction;
    }
    return null;
  }

  // Continuous-coordinate walkability check. Floor cells and non-blocking
  // decorations are walkable everywhere; solid/pushable decorations block
  // their whole cell; wall cells are quadrant-aware — a corner or T-junction
  // piece only fills part of its cell footprint, so the query point's
  // quadrant (NW/NE/SW/SE, relative to the cell center) is checked against
  // which sides that piece actually connects to.
  function isWorldWalkable(data, x, z) {
    var gx = Math.round(x), gy = Math.round(z);
    var interaction = decorationInteractionAt(data, gx, gy);
    if (interaction === 'solid' || interaction === 'pushable') return false;
    if (isWalkable(data, gx, gy)) return true;
    if (!isWallCell(data, gx, gy)) return false;

    var mask = wallNeighborMask(data, gx, gy);
    var N = !!(mask & 1), E = !!(mask & 2), S = !!(mask & 4), W = !!(mask & 8);
    var count = (N ? 1 : 0) + (E ? 1 : 0) + (S ? 1 : 0) + (W ? 1 : 0);
    var quad = (z >= gy ? 'S' : 'N') + (x >= gx ? 'E' : 'W');

    var openQuadrants = [];
    if (count === 2 && N && E) openQuadrants = ['SW'];
    else if (count === 2 && S && E) openQuadrants = ['NW'];
    else if (count === 2 && S && W) openQuadrants = ['NE'];
    else if (count === 2 && N && W) openQuadrants = ['SE'];
    else if (count === 3 && !N) openQuadrants = ['NW', 'NE'];
    else if (count === 3 && !E) openQuadrants = ['NE', 'SE'];
    else if (count === 3 && !S) openQuadrants = ['SW', 'SE'];
    else if (count === 3 && !W) openQuadrants = ['NW', 'SW'];
    // count 0, 1, 4, or 2-opposite (N+S / E+W): openQuadrants stays [] — fully solid.

    return openQuadrants.indexOf(quad) !== -1;
  }
```

- [ ] **Step 4: Export it**

In `shared/maze-schema.js`, find the module's return object:

```js
    computeWallPiece: computeWallPiece,
    validateConnectivity: validateConnectivity,
    reachableFloorSet: reachableFloorSet
  };
```

Replace with:

```js
    computeWallPiece: computeWallPiece,
    validateConnectivity: validateConnectivity,
    reachableFloorSet: reachableFloorSet,
    isWorldWalkable: isWorldWalkable
  };
```

- [ ] **Step 5: Run tests to verify they pass**

Reload `tests/logic-tests.html`. All assertions must read `PASS`.

- [ ] **Step 6: Commit**

```bash
git add shared/maze-schema.js tests/logic-tests.html
git commit -m "Add quadrant-aware wall collision and decoration blocking (isWorldWalkable)"
```

---

### Task 5: Wire `isWorldWalkable` into player movement

**Files:**
- Modify: `shared/player-controller.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Consumes: `MazeSchema.isWorldWalkable` (Task 4).
- Produces: `resolveCollision`'s behavior now reflects quadrant-aware wall collision and decoration blocking, with the exact same signature as before — no caller changes needed elsewhere yet.

- [ ] **Step 1: Write the failing test**

Add to `tests/logic-tests.html`, after the existing `resolveCollision` tests:

```js
// Under the OLD whole-cell-blocking model this move would have been fully
// blocked (the target cell is a '#' corner piece); with quadrant-aware
// collision the open SW quadrant now lets the player graze into it.
var cornerMaze2 = { width: 3, height: 3, cells: ['.#.', '.##', '...'], decorations: [] };
var cornerMove = window.PlayerController.resolveCollision({x:0.5,z:1.3}, {x:0.9,z:1.3}, 0.05, cornerMaze2);
assertEqual(cornerMove, {x:0.9,z:1.3}, 'resolveCollision: player can graze the open diagonal quadrant of a corner wall cell');
```

- [ ] **Step 2: Run test to verify it fails**

Reload `tests/logic-tests.html`. Expected: `FAIL` — `resolveCollision` currently still uses whole-cell blocking, so this move is blocked and `cornerMove.x` stays at `0.5`.

- [ ] **Step 3: Update `cellBlocked`**

In `shared/player-controller.js`, find:

```js
  function cellBlocked(mazeData, worldX, worldZ) {
    var gx = Math.round(worldX);
    var gy = Math.round(worldZ);
    return !window.MazeSchema.isWalkable(mazeData, gx, gy);
  }
```

Replace with:

```js
  function cellBlocked(mazeData, worldX, worldZ) {
    return !window.MazeSchema.isWorldWalkable(mazeData, worldX, worldZ);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Reload `tests/logic-tests.html`. All assertions — including the pre-existing `resolveCollision stops player before entering wall cell` and `resolveCollision allows movement through open floor` tests — must still read `PASS`, plus the new one.

- [ ] **Step 5: Commit**

```bash
git add shared/player-controller.js tests/logic-tests.html
git commit -m "Route player collision through the quadrant-aware wall check"
```

---

### Task 6: Pushable prop resolution (`resolvePush`)

**Files:**
- Modify: `shared/player-controller.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Consumes: `MazeSchema.isWalkable` (whole-cell — pushes move by a full grid step, so the simpler check is correct here, not `isWorldWalkable`).
- Produces: `PlayerController.resolvePush(decorations, fromCell, direction, mazeData)` — `decorations` is an array of `{x, y, id, model, rotationY}`; `fromCell` is `{x, y}`; `direction` is `{dx, dy}`, one of the four cardinal unit steps. Returns a **new** decorations array with the matching entry's position updated on success, or `null` if the push isn't possible (destination is a wall, out of bounds, or occupied by another decoration). Does not mutate its inputs. Consumed by Task 10 — note `resolvePush` itself has no notion of `interaction`; the caller is responsible for only invoking it on `pushable`-class decorations (verified manually in Task 11, not as a unit test here, since that policy lives at the call site, not inside this pure function).

- [ ] **Step 1: Write the failing tests**

Add to `shared/player-controller.js`'s section of `tests/logic-tests.html` (after the existing `player-controller` tests, e.g. after the `checkWin` tests):

```js
// resolvePush
var pushMaze = { width: 4, height: 3, cells: ['####', '#..#', '####'] };
var pushDecorations = [{ x: 1, y: 1, id: 'barrel-1-1', model: 'barrel_small', rotationY: 0 }];

var pushed = window.PlayerController.resolvePush(pushDecorations, {x:1,y:1}, {dx:1,dy:0}, pushMaze);
assertEqual(pushed, [{ x: 2, y: 1, id: 'barrel-1-1', model: 'barrel_small', rotationY: 0 }],
  'resolvePush: succeeds into an open cell, returns a new array with the updated position');
assertEqual(pushDecorations, [{ x: 1, y: 1, id: 'barrel-1-1', model: 'barrel_small', rotationY: 0 }],
  'resolvePush: does not mutate the input array');

var blockedByWall = window.PlayerController.resolvePush(pushDecorations, {x:1,y:1}, {dx:0,dy:-1}, pushMaze);
assertEqual(blockedByWall, null, 'resolvePush: fails when the destination cell is a wall');

var twoBarrels = [
  { x: 1, y: 1, id: 'barrel-1-1', model: 'barrel_small', rotationY: 0 },
  { x: 2, y: 1, id: 'barrel-2-1', model: 'barrel_small', rotationY: 0 }
];
var blockedByDecoration = window.PlayerController.resolvePush(twoBarrels, {x:1,y:1}, {dx:1,dy:0}, pushMaze);
assertEqual(blockedByDecoration, null, 'resolvePush: fails when the destination cell holds another decoration (no chain-push)');
```

- [ ] **Step 2: Run tests to verify they fail**

Reload `tests/logic-tests.html`. Expected: `FAIL` with `TypeError: window.PlayerController.resolvePush is not a function`.

- [ ] **Step 3: Implement `resolvePush`**

In `shared/player-controller.js`, add after `resolveCollision`:

```js
  function resolvePush(decorations, fromCell, direction, mazeData) {
    var toX = fromCell.x + direction.dx;
    var toY = fromCell.y + direction.dy;
    if (!window.MazeSchema.isWalkable(mazeData, toX, toY)) return null;
    for (var i = 0; i < decorations.length; i++) {
      if (decorations[i].x === toX && decorations[i].y === toY) return null;
    }
    return decorations.map(function (d) {
      if (d.x === fromCell.x && d.y === fromCell.y) {
        return { x: toX, y: toY, id: d.id, model: d.model, rotationY: d.rotationY };
      }
      return d;
    });
  }
```

- [ ] **Step 4: Export it**

In `shared/player-controller.js`, find:

```js
  return {
    computeMove: computeMove,
    resolveCollision: resolveCollision,
    findNearbyTorch: findNearbyTorch,
    findNearbyItem: findNearbyItem,
    checkWin: checkWin
  };
```

Replace with:

```js
  return {
    computeMove: computeMove,
    resolveCollision: resolveCollision,
    resolvePush: resolvePush,
    findNearbyTorch: findNearbyTorch,
    findNearbyItem: findNearbyItem,
    checkWin: checkWin
  };
```

- [ ] **Step 5: Run tests to verify they pass**

Reload `tests/logic-tests.html`. All assertions must read `PASS`.

- [ ] **Step 6: Commit**

```bash
git add shared/player-controller.js tests/logic-tests.html
git commit -m "Add pushable-decoration resolution logic"
```

---

### Task 7: Editor-grid decoration tool support

**Files:**
- Modify: `shared/editor-grid.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Produces: `EditorGrid.applyTool(data, tool, x, y, rotationY)` — `rotationY` is a new, optional 5th parameter (defaults to `0`), used only when `tool` is a `'decoration:<catalogId>'` string. `EditorGrid.rotateDecorationAt(data, x, y)` — rotates the decoration at that cell by 90° in place if one exists there, returns `true`/`false`. Consumed by Task 9 (editor.html placement/rotation wiring).

- [ ] **Step 1: Write the failing tests**

Add to `tests/logic-tests.html`, after the existing `applyTool`/`resizeGrid` tests:

```js
// EditorGrid decoration support
var decoLevel = window.LevelIO.createDefaultLevel(4, 4);
window.EditorGrid.applyTool(decoLevel, 'decoration:barrel_small', 1, 1);
assertEqual(decoLevel.decorations, [{ x: 1, y: 1, id: 'barrel_small-1-1', model: 'barrel_small', rotationY: 0 }],
  'applyTool decoration: places a decoration with rotationY 0 by default');

window.EditorGrid.applyTool(decoLevel, 'decoration:barrel_small', 1, 1);
assertEqual(decoLevel.decorations, [],
  'applyTool decoration: placing the same model on the same cell toggles it off');

window.EditorGrid.applyTool(decoLevel, 'decoration:barrel_small', 2, 2, Math.PI / 2);
assertEqual(decoLevel.decorations, [{ x: 2, y: 2, id: 'barrel_small-2-2', model: 'barrel_small', rotationY: Math.PI / 2 }],
  'applyTool decoration: honors the rotationY argument on placement');

window.EditorGrid.applyTool(decoLevel, 'decoration:chest', 2, 2);
assertEqual(decoLevel.decorations, [{ x: 2, y: 2, id: 'chest-2-2', model: 'chest', rotationY: 0 }],
  'applyTool decoration: placing a different model on an occupied cell replaces it');

assertTrue(window.EditorGrid.rotateDecorationAt(decoLevel, 2, 2), 'rotateDecorationAt: returns true and rotates an existing decoration');
assertEqual(decoLevel.decorations[0].rotationY, Math.PI / 2, 'rotateDecorationAt: rotation advances by 90 degrees');
assertEqual(window.EditorGrid.rotateDecorationAt(decoLevel, 0, 0), false, 'rotateDecorationAt: returns false when no decoration is at that cell');
```

- [ ] **Step 2: Run tests to verify they fail**

Reload `tests/logic-tests.html`. Expected: `FAIL` — `applyTool` doesn't recognize `'decoration:*'` tool values yet, and `rotateDecorationAt` doesn't exist.

- [ ] **Step 3: Implement decoration support**

In `shared/editor-grid.js`, find:

```js
  function applyTool(data, tool, x, y) {
    if (x < 0 || y < 0 || x >= data.width || y >= data.height) return data;
    switch (tool) {
      case TOOLS.WALL: setCellChar(data, x, y, '#'); break;
      case TOOLS.FLOOR: setCellChar(data, x, y, '.'); break;
      case TOOLS.TORCH:
        toggleAt(data.torches, x, y, function (x, y) { return { x: x, y: y }; });
        break;
      case TOOLS.ITEM:
        toggleAt(data.items, x, y, function (x, y) {
          return { x: x, y: y, id: 'item-' + x + '-' + y, type: 'gem' };
        });
        break;
      case TOOLS.START: data.start = { x: x, y: y }; break;
      case TOOLS.EXIT: data.exit = { x: x, y: y }; break;
    }
    return data;
  }
```

Replace with:

```js
  function findDecorationIndexAt(data, x, y) {
    for (var i = 0; i < data.decorations.length; i++) {
      if (data.decorations[i].x === x && data.decorations[i].y === y) return i;
    }
    return -1;
  }

  function applyDecoration(data, modelId, x, y, rotationY) {
    var idx = findDecorationIndexAt(data, x, y);
    var entry = { x: x, y: y, id: modelId + '-' + x + '-' + y, model: modelId, rotationY: rotationY || 0 };
    if (idx !== -1) {
      if (data.decorations[idx].model === modelId) {
        data.decorations.splice(idx, 1);
      } else {
        data.decorations[idx] = entry;
      }
    } else {
      data.decorations.push(entry);
    }
  }

  function rotateDecorationAt(data, x, y) {
    var idx = findDecorationIndexAt(data, x, y);
    if (idx === -1) return false;
    data.decorations[idx].rotationY = (data.decorations[idx].rotationY + Math.PI / 2) % (Math.PI * 2);
    return true;
  }

  function applyTool(data, tool, x, y, rotationY) {
    if (x < 0 || y < 0 || x >= data.width || y >= data.height) return data;
    if (typeof tool === 'string' && tool.indexOf('decoration:') === 0) {
      applyDecoration(data, tool.slice('decoration:'.length), x, y, rotationY);
      return data;
    }
    switch (tool) {
      case TOOLS.WALL: setCellChar(data, x, y, '#'); break;
      case TOOLS.FLOOR: setCellChar(data, x, y, '.'); break;
      case TOOLS.TORCH:
        toggleAt(data.torches, x, y, function (x, y) { return { x: x, y: y }; });
        break;
      case TOOLS.ITEM:
        toggleAt(data.items, x, y, function (x, y) {
          return { x: x, y: y, id: 'item-' + x + '-' + y, type: 'gem' };
        });
        break;
      case TOOLS.START: data.start = { x: x, y: y }; break;
      case TOOLS.EXIT: data.exit = { x: x, y: y }; break;
    }
    return data;
  }
```

- [ ] **Step 4: Export `rotateDecorationAt`**

In `shared/editor-grid.js`, find:

```js
  return { TOOLS: TOOLS, pixelToCell: pixelToCell, applyTool: applyTool, resizeGrid: resizeGrid };
```

Replace with:

```js
  return {
    TOOLS: TOOLS, pixelToCell: pixelToCell, applyTool: applyTool, resizeGrid: resizeGrid,
    rotateDecorationAt: rotateDecorationAt
  };
```

- [ ] **Step 5: Run tests to verify they pass**

Reload `tests/logic-tests.html`. All assertions must read `PASS`.

- [ ] **Step 6: Commit**

```bash
git add shared/editor-grid.js tests/logic-tests.html
git commit -m "Add decoration placement, toggling, and rotation to EditorGrid"
```

---

### Task 8: Editor sidebar — unified searchable/categorized panel

**Files:**
- Modify: `editor.html`

**Interfaces:**
- Consumes: `window.AssetCatalog` (Task 1, loaded via a new `<script>` tag).
- Produces: a `.palette-row[data-tool]` DOM element per catalog entry inside `#paletteScroll`, wired to call `selectTool(tool)` on click. Task 9 depends on `selectTool` accepting both the existing `EditorGrid.TOOLS` string values and new `'decoration:<id>'` values (already true today — `selectTool` just stores whatever string it's given).

This task only replaces the palette markup/build/search logic and the CSS. It does **not** yet touch placement, rotation, or 3D rendering of decorations — those come in Task 9. After this task, clicking a row selects it (visually highlighted) but placing it on the map won't render anything yet; that's expected and gets fixed next task.

- [ ] **Step 1: Add the catalog script tag**

In `editor.html`, find:

```html
<script src="shared/maze-schema.js"></script>
<script src="shared/level-io.js"></script>
<script src="shared/editor-grid.js"></script>
```

Replace with:

```html
<script src="shared/maze-schema.js"></script>
<script src="shared/asset-catalog.js"></script>
<script src="shared/level-io.js"></script>
<script src="shared/editor-grid.js"></script>
```

- [ ] **Step 2: Replace the Tools section markup**

Find:

```html
  <div class="section-title">Tools</div>
  <div id="palette">
    <div class="palette-item active" data-tool="wall" draggable="true"><span class="icon">🧱</span><span class="label">Wall</span></div>
    <div class="palette-item" data-tool="floor" draggable="true"><span class="icon">⬜</span><span class="label">Floor</span></div>
    <div class="palette-item" data-tool="torch" draggable="true"><span class="icon">🔥</span><span class="label">Torch</span></div>
    <div class="palette-item" data-tool="item" draggable="true"><span class="icon">🪙</span><span class="label">Item</span></div>
    <div class="palette-item" data-tool="start" draggable="true"><span class="icon">🟢</span><span class="label">Start</span></div>
    <div class="palette-item" data-tool="exit" draggable="true"><span class="icon">🔴</span><span class="label">Exit</span></div>
    <div class="palette-item" data-tool="pan"><span class="icon">✋</span><span class="label">Pan</span></div>
  </div>
```

Replace with:

```html
  <div class="section-title">Tools &amp; Decorations</div>
  <div id="panelControls">
    <button class="action" id="panBtn" type="button">✋ Pan</button>
    <input id="paletteSearch" type="text" placeholder="Search models…">
  </div>
  <div id="paletteScroll"></div>
```

- [ ] **Step 3: Replace the palette CSS**

Find:

```css
  #palette { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .palette-item {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    padding: 10px 4px; border-radius: 8px; border: 2px solid transparent;
    background: #fff; cursor: grab; user-select: none;
    box-shadow: 0 1px 2px rgba(0,0,0,0.12);
  }
  .palette-item:hover { background: #f7f0da; }
  .palette-item.active { border-color: #f2a900; background: #ffedb3; }
  .palette-item .icon { font-size: 26px; line-height: 1; }
  .palette-item .label { font-size: 11px; color: #444; }
  .palette-item:active { cursor: grabbing; }
```

Replace with:

```css
  #panelControls { display: flex; flex-direction: column; gap: 6px; }
  #panelControls .action { text-align: left; }
  #paletteSearch { padding: 6px 8px; border: 1px solid #ccc; border-radius: 6px; font-size: 12px; }
  #paletteScroll { flex: 1; min-height: 140px; max-height: 360px; overflow-y: auto; border: 1px solid #ddd; border-radius: 6px; background: #fff; }
  details.category summary { padding: 6px 8px; cursor: pointer; font-size: 11px; font-weight: bold; color: #555; background: #e8e8e8; text-transform: uppercase; letter-spacing: 0.04em; }
  details.category summary:hover { background: #ddd; }
  .palette-row { display: flex; align-items: center; gap: 8px; padding: 6px 8px; cursor: pointer; border-bottom: 1px solid #eee; }
  .palette-row:hover { background: #f7f0da; }
  .palette-row.active { background: #ffedb3; }
  .palette-row img { width: 32px; height: 32px; object-fit: contain; background: #ddd; border-radius: 4px; flex-shrink: 0; }
  .palette-row .row-label { font-size: 11px; color: #333; flex: 1; }
  .palette-row .row-badge { font-size: 9px; padding: 2px 5px; border-radius: 4px; background: #ccc; color: #333; white-space: nowrap; }
  .palette-row .row-badge.pushable { background: #f2a900; color: #fff; }
  .palette-row .row-badge.solid { background: #555; color: #fff; }
```

- [ ] **Step 4: Replace the tool-selection JS**

Find:

```js
var data = window.LevelIO.createDefaultLevel(15, 15);
var currentTool = window.EditorGrid.TOOLS.WALL;
```

Replace with:

```js
var data = window.LevelIO.createDefaultLevel(15, 15);
var currentTool = 'wall';
var pendingRotation = 0;

var CORE_TOOL_MAP = {
  'core-wall': 'wall', 'core-floor': 'floor', 'core-torch': 'torch',
  'core-item': 'item', 'core-start': 'start', 'core-exit': 'exit'
};

function toolValueForCatalogEntry(entry) {
  return CORE_TOOL_MAP[entry.id] || ('decoration:' + entry.id);
}
```

- [ ] **Step 5: Replace the old `.palette-item` click/dragstart wiring and `selectTool`**

Find:

```js
function selectTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.palette-item').forEach(function (el) {
    el.classList.toggle('active', el.dataset.tool === tool);
  });
  var isPan = tool === 'pan';
  controls.mouseButtons.LEFT = isPan ? THREE.MOUSE.PAN : null;
  renderer.domElement.classList.toggle('pan-mode', isPan);
}

document.querySelectorAll('.palette-item').forEach(function (el) {
  el.addEventListener('click', function () { selectTool(el.dataset.tool); });
  if (el.dataset.tool !== 'pan') {
    el.addEventListener('dragstart', function (e) {
      e.dataTransfer.setData('text/plain', el.dataset.tool);
      e.dataTransfer.effectAllowed = 'copy';
    });
  }
});
```

Replace with:

```js
function selectTool(tool) {
  currentTool = tool;
  document.querySelectorAll('.palette-row').forEach(function (el) {
    el.classList.toggle('active', el.dataset.tool === tool);
  });
  var isPan = tool === 'pan';
  controls.mouseButtons.LEFT = isPan ? THREE.MOUSE.PAN : null;
  renderer.domElement.classList.toggle('pan-mode', isPan);
}

document.getElementById('panBtn').addEventListener('click', function () { selectTool('pan'); });

var paletteScroll = document.getElementById('paletteScroll');
var paletteSearch = document.getElementById('paletteSearch');
var paletteRows = [];

function badgeTextFor(interaction) {
  if (interaction === 'pushable') return 'pushable';
  if (interaction === 'solid') return 'solid';
  return null;
}

function buildPalette() {
  var byCategory = {};
  window.AssetCatalog.forEach(function (entry) {
    if (!byCategory[entry.category]) byCategory[entry.category] = [];
    byCategory[entry.category].push(entry);
  });
  var categories = Object.keys(byCategory).sort(function (a, b) {
    if (a === 'core') return -1;
    if (b === 'core') return 1;
    return a.localeCompare(b);
  });
  categories.forEach(function (cat) {
    var entries = byCategory[cat];
    var details = document.createElement('details');
    details.className = 'category';
    details.dataset.category = cat;
    if (cat === 'core') details.open = true;
    var summary = document.createElement('summary');
    summary.textContent = cat.charAt(0).toUpperCase() + cat.slice(1) + ' (' + entries.length + ')';
    details.appendChild(summary);
    entries.forEach(function (entry) {
      var row = document.createElement('div');
      row.className = 'palette-row';
      row.dataset.tool = toolValueForCatalogEntry(entry);
      row.draggable = true;
      row.addEventListener('dragstart', function (e) {
        e.dataTransfer.setData('text/plain', row.dataset.tool);
        e.dataTransfer.effectAllowed = 'copy';
      });
      var img = document.createElement('img');
      img.src = entry.thumbnail;
      img.alt = entry.label;
      var label = document.createElement('span');
      label.className = 'row-label';
      label.textContent = entry.label;
      row.appendChild(img);
      row.appendChild(label);
      var badgeText = badgeTextFor(entry.interaction);
      if (badgeText) {
        var badge = document.createElement('span');
        badge.className = 'row-badge ' + entry.interaction;
        badge.textContent = badgeText;
        row.appendChild(badge);
      }
      row.addEventListener('click', function () { selectTool(row.dataset.tool); });
      details.appendChild(row);
      paletteRows.push({ entry: entry, row: row, details: details });
    });
    paletteScroll.appendChild(details);
  });
}
buildPalette();

paletteSearch.addEventListener('input', function () {
  var q = paletteSearch.value.trim().toLowerCase();
  paletteRows.forEach(function (r) {
    var match = !q || r.entry.label.toLowerCase().indexOf(q) !== -1;
    r.row.style.display = match ? '' : 'none';
  });
  document.querySelectorAll('details.category').forEach(function (d) {
    if (!q) { d.open = d.dataset.category === 'core'; return; }
    var hasMatch = paletteRows.some(function (r) {
      return r.details === d && r.row.style.display !== 'none';
    });
    d.open = hasMatch;
  });
});
```

- [ ] **Step 6: Manually verify the panel renders**

With the dev server running, open `http://localhost:8934/editor.html`. Expected: a search box and a scrollable list of collapsible categories, "Core" expanded showing Wall/Floor/Torch/Item/Start/Exit rows with real thumbnail images (not emoji), all other categories collapsed with a count in each header (e.g. "Barrel (4)"). Typing "candle" in the search box should collapse everything except the Candle category (and any other category containing a match). Clicking "Core"'s Wall row should highlight it and still let you paint walls on the map exactly as before (this part of the pipeline — `applyToolAt` → `EditorGrid.applyTool` → `refreshWallArea` — is untouched).

- [ ] **Step 7: Commit**

```bash
git add editor.html
git commit -m "Redesign editor sidebar into a unified searchable, categorized model panel"
```

---

### Task 9: Editor — decoration placement, drag-move, rotation, and rendering

**Files:**
- Modify: `editor.html`

**Interfaces:**
- Consumes: `EditorGrid.applyTool(data, tool, x, y, rotationY)` and `EditorGrid.rotateDecorationAt` (Task 7).
- Produces: placed decorations render in the editor's 3D view, are draggable, and rotate with `R`.

- [ ] **Step 1: Add decoration state and lazy-loading helpers**

Find:

```js
var wallTemplates, torchTemplate, coinTemplate;
var floorMesh = null;
var gridMesh = null;
var wallMeshes = {}; // "x,y" -> mesh
var torchMeshes = [];
var itemMeshes = [];
var startMarker, exitMarker;
```

Replace with:

```js
var wallTemplates, torchTemplate, coinTemplate;
var floorMesh = null;
var gridMesh = null;
var wallMeshes = {}; // "x,y" -> mesh
var torchMeshes = [];
var itemMeshes = [];
var startMarker, exitMarker;

var decorationTemplates = {}; // catalog id -> THREE.Object3D
var decorationMeshes = {}; // "x,y" -> mesh

function decorationKey(x, y) { return x + ',' + y; }

function catalogEntry(id) {
  for (var i = 0; i < window.AssetCatalog.length; i++) {
    if (window.AssetCatalog[i].id === id) return window.AssetCatalog[i];
  }
  return null;
}

function loadDecorationTemplate(modelId) {
  if (decorationTemplates[modelId]) return Promise.resolve(decorationTemplates[modelId]);
  var entry = catalogEntry(modelId);
  return loadModel(entry.path).then(function (obj) {
    decorationTemplates[modelId] = obj;
    return obj;
  });
}

function findDecorationAt(x, y) {
  for (var i = 0; i < data.decorations.length; i++) {
    if (data.decorations[i].x === x && data.decorations[i].y === y) return data.decorations[i];
  }
  return null;
}

function refreshDecorationAt(x, y) {
  var key = decorationKey(x, y);
  var existing = decorationMeshes[key];
  if (existing) { scene.remove(existing); delete decorationMeshes[key]; }
  var deco = findDecorationAt(x, y);
  if (!deco) return;
  loadDecorationTemplate(deco.model).then(function (template) {
    var stillThere = findDecorationAt(x, y);
    if (!stillThere || stillThere.id !== deco.id) return; // cell changed again before this load finished
    var mesh = template.clone();
    mesh.position.set(x, 0, y);
    mesh.rotation.y = deco.rotationY;
    scene.add(mesh);
    decorationMeshes[key] = mesh;
  });
}

function rebuildDecorations() {
  Object.keys(decorationMeshes).forEach(function (k) { scene.remove(decorationMeshes[k]); });
  decorationMeshes = {};
  data.decorations.forEach(function (d) { refreshDecorationAt(d.x, d.y); });
}
```

- [ ] **Step 2: Call `rebuildDecorations` from `rebuildAll`**

Find:

```js
function rebuildAll() {
  clearValidationOverlay();
  rebuildFloor();
  rebuildGrid();
  rebuildWalls();
  rebuildMarkers();
  frameCamera();
}
```

Replace with:

```js
function rebuildAll() {
  clearValidationOverlay();
  rebuildFloor();
  rebuildGrid();
  rebuildWalls();
  rebuildMarkers();
  rebuildDecorations();
  frameCamera();
}
```

- [ ] **Step 3: Update `applyToolAt` to refresh decoration rendering and pass rotation**

Find:

```js
function applyToolAt(x, y, tool) {
  tool = tool || currentTool;
  clearValidationOverlay();
  window.EditorGrid.applyTool(data, tool, x, y);
  if (tool === window.EditorGrid.TOOLS.WALL || tool === window.EditorGrid.TOOLS.FLOOR) {
    refreshWallArea(x, y);
  } else {
    rebuildMarkers();
  }
}
```

Replace with:

```js
function applyToolAt(x, y, tool) {
  tool = tool || currentTool;
  clearValidationOverlay();
  window.EditorGrid.applyTool(data, tool, x, y, pendingRotation);
  if (tool === window.EditorGrid.TOOLS.WALL || tool === window.EditorGrid.TOOLS.FLOOR) {
    refreshWallArea(x, y);
  } else if (typeof tool === 'string' && tool.indexOf('decoration:') === 0) {
    refreshDecorationAt(x, y);
  } else {
    rebuildMarkers();
  }
}
```

- [ ] **Step 4: Add a `decoration` case to `findEntityAt` and `moveEntity`**

Find:

```js
function findEntityAt(x, y) {
  if (data.start.x === x && data.start.y === y) return { kind: 'start' };
  if (data.exit.x === x && data.exit.y === y) return { kind: 'exit' };
  for (var i = 0; i < data.torches.length; i++) {
    if (data.torches[i].x === x && data.torches[i].y === y) return { kind: 'torch', index: i };
  }
  for (var i = 0; i < data.items.length; i++) {
    if (data.items[i].x === x && data.items[i].y === y) return { kind: 'item', index: i };
  }
  return null;
}
```

Replace with:

```js
function findEntityAt(x, y) {
  if (data.start.x === x && data.start.y === y) return { kind: 'start' };
  if (data.exit.x === x && data.exit.y === y) return { kind: 'exit' };
  for (var i = 0; i < data.torches.length; i++) {
    if (data.torches[i].x === x && data.torches[i].y === y) return { kind: 'torch', index: i };
  }
  for (var i = 0; i < data.items.length; i++) {
    if (data.items[i].x === x && data.items[i].y === y) return { kind: 'item', index: i };
  }
  for (var i = 0; i < data.decorations.length; i++) {
    if (data.decorations[i].x === x && data.decorations[i].y === y) return { kind: 'decoration', index: i };
  }
  return null;
}
```

Find:

```js
  } else if (entity.kind === 'item') {
    data.items[entity.index].x = x; data.items[entity.index].y = y;
    itemMeshes[entity.index].position.set(x, 0.15, y);
  }
}
```

Replace with:

```js
  } else if (entity.kind === 'item') {
    data.items[entity.index].x = x; data.items[entity.index].y = y;
    itemMeshes[entity.index].position.set(x, 0.15, y);
  } else if (entity.kind === 'decoration') {
    var oldX = data.decorations[entity.index].x, oldY = data.decorations[entity.index].y;
    data.decorations[entity.index].x = x; data.decorations[entity.index].y = y;
    refreshDecorationAt(oldX, oldY);
    refreshDecorationAt(x, y);
  }
}
```

- [ ] **Step 5: Add rotation via the `R` key**

Find the existing `window.addEventListener('mousemove', ...)` handler for the renderer canvas (used for painting/dragging), and add hover-cell tracking. Find:

```js
renderer.domElement.addEventListener('mousemove', function (e) {
  if (!wallTemplates) return;
  if (dragState) {
```

Replace with:

```js
var lastHoverCell = null;

renderer.domElement.addEventListener('mousemove', function (e) {
  if (!wallTemplates) return;
  lastHoverCell = cellFromEvent(e);
  if (dragState) {
```

Then add, after the existing `window.addEventListener('resize', ...)` block:

```js
window.addEventListener('keydown', function (e) {
  if (e.key !== 'r' && e.key !== 'R') return;
  if (!lastHoverCell) return;
  if (window.EditorGrid.rotateDecorationAt(data, lastHoverCell.x, lastHoverCell.y)) {
    refreshDecorationAt(lastHoverCell.x, lastHoverCell.y);
  } else {
    pendingRotation = (pendingRotation + Math.PI / 2) % (Math.PI * 2);
  }
});
```

- [ ] **Step 6: Manually verify placement, drag, and rotation**

With the dev server running, open `http://localhost:8934/editor.html`:
1. Search "chest", click the Chest row, click an empty cell on the map. Expected: a chest model appears there (after a brief load).
2. Click the same Chest row again, click the *same* cell. Expected: the chest disappears (toggle-off).
3. Place a chest again, then place a different decoration (e.g. a barrel) on the same cell. Expected: the chest is replaced by the barrel.
4. Drag the placed barrel to a different cell. Expected: it moves.
5. Hover over the barrel and press `R`. Expected: it visibly rotates 90°.
6. Hover an empty cell, press `R` a couple of times, then place a decoration there. Expected: it appears already rotated to match.

- [ ] **Step 7: Commit**

```bash
git add editor.html
git commit -m "Wire decoration placement, drag-move, rotation, and lazy rendering into the editor"
```

---

### Task 10: Game — decoration rendering, collision, and pushable props

**Files:**
- Modify: `game.html`

**Interfaces:**
- Consumes: `window.AssetCatalog` (Task 1), `MazeSchema.isWorldWalkable` (already wired via `resolveCollision` in Task 5), `PlayerController.resolvePush` (Task 6).

- [ ] **Step 1: Add the catalog script tag**

Find:

```html
<script src="shared/maze-schema.js"></script>
<script src="shared/toon-renderer.js"></script>
<script src="shared/player-controller.js"></script>
<script src="shared/level-io.js"></script>
```

Replace with:

```html
<script src="shared/maze-schema.js"></script>
<script src="shared/asset-catalog.js"></script>
<script src="shared/toon-renderer.js"></script>
<script src="shared/player-controller.js"></script>
<script src="shared/level-io.js"></script>
```

- [ ] **Step 2: Load only the decoration models this level actually uses**

Find:

```js
  var idleGltf = await gltfLoader.loadAsync('assets/kaykit-adventurers/animations/Rig_Medium_General.glb');
```

Insert immediately before it:

```js
  function catalogEntryById(id) {
    for (var i = 0; i < window.AssetCatalog.length; i++) {
      if (window.AssetCatalog[i].id === id) return window.AssetCatalog[i];
    }
    return null;
  }

  var usedDecorationModelIds = {};
  mazeData.decorations.forEach(function (d) { usedDecorationModelIds[d.model] = true; });
  var decorationTemplates = {};
  await Promise.all(Object.keys(usedDecorationModelIds).map(function (modelId) {
    var entry = catalogEntryById(modelId);
    return loadModel(entry.path).then(function (obj) {
      collectMaterials(obj).forEach(applyFogOfWar);
      decorationTemplates[modelId] = obj;
    });
  }));

  var decorationMeshes = {}; // decoration id -> mesh
  mazeData.decorations.forEach(function (d) {
    var mesh = decorationTemplates[d.model].clone();
    mesh.position.set(d.x, 0, d.y);
    mesh.rotation.y = d.rotationY;
    scene.add(mesh);
    decorationMeshes[d.id] = mesh;
  });

```

- [ ] **Step 3: Add push resolution to the movement loop**

Find:

```js
    var intended = window.PlayerController.computeMove({ x: playerPos.x, z: playerPos.z }, input, dt, PLAYER_SPEED);
    var resolved = window.PlayerController.resolveCollision({ x: playerPos.x, z: playerPos.z }, intended, PLAYER_RADIUS, mazeData);
```

Replace with:

```js
    var intended = window.PlayerController.computeMove({ x: playerPos.x, z: playerPos.z }, input, dt, PLAYER_SPEED);
    attemptPushes({ x: playerPos.x, z: playerPos.z }, intended);
    var resolved = window.PlayerController.resolveCollision({ x: playerPos.x, z: playerPos.z }, intended, PLAYER_RADIUS, mazeData);
```

- [ ] **Step 4: Implement `attemptPushes`**

Find:

```js
  function animate() {
    requestAnimationFrame(animate);
    var dt = clock.getDelta();
```

Insert immediately before it:

```js
  function decorationAt(decorations, gx, gy) {
    for (var i = 0; i < decorations.length; i++) {
      if (decorations[i].x === gx && decorations[i].y === gy) return decorations[i];
    }
    return null;
  }

  function attemptPushes(prevPos, nextPos) {
    var dxSign = Math.sign(nextPos.x - prevPos.x);
    var dzSign = Math.sign(nextPos.z - prevPos.z);
    var axes = [
      { probeX: nextPos.x + dxSign * PLAYER_RADIUS, probeZ: prevPos.z, dx: dxSign, dy: 0 },
      { probeX: nextPos.x, probeZ: nextPos.z + dzSign * PLAYER_RADIUS, dx: 0, dy: dzSign }
    ];
    axes.forEach(function (axis) {
      if (axis.dx === 0 && axis.dy === 0) return;
      var gx = Math.round(axis.probeX), gy = Math.round(axis.probeZ);
      var deco = decorationAt(mazeData.decorations, gx, gy);
      if (!deco) return;
      var entry = catalogEntryById(deco.model);
      if (!entry || entry.interaction !== 'pushable') return;
      var pushedDecorations = window.PlayerController.resolvePush(
        mazeData.decorations, { x: gx, y: gy }, { dx: axis.dx, dy: axis.dy }, mazeData
      );
      if (pushedDecorations) {
        mazeData.decorations = pushedDecorations;
        var moved = decorationAt(pushedDecorations, gx + axis.dx, gy + axis.dy);
        var mesh = decorationMeshes[moved.id];
        if (mesh) mesh.position.set(moved.x, 0, moved.y);
      }
    });
  }

```

- [ ] **Step 5: Manually verify in-browser**

Requires a level with at least one `solid` and one `pushable` decoration — use the editor (Task 9) to add e.g. a chest (solid) and a barrel (pushable) to `level1`, export it, and replace `levels/level1.json`, or temporarily hand-edit a small test level's JSON. Then open `http://localhost:8934/game.html` with that level and check, via WASD movement:
1. Walking into the solid decoration stops the player, same as a wall.
2. Walking into the pushable decoration shoves it one cell forward, and the player continues into the vacated cell.
3. Pushing it against a wall (or another decoration) blocks further pushing — the player stops there instead.
4. Walking near a corner wall piece, the player can now reach into the previously-blocked diagonal quadrant (visually confirms Task 4/5's fix is live in actual play, not just in the collision math).

- [ ] **Step 6: Commit**

```bash
git add game.html
git commit -m "Render decorations in-game and wire solid/pushable collision into player movement"
```

---

### Task 11: Full regression pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full logic test suite**

Load `http://localhost:8934/tests/logic-tests.html`. Expected: every assertion reads `PASS`, none `FAIL`. This is the full regression check for everything touched in Tasks 1–10 combined (catalog shape, schema, quadrant collision, push resolution, editor-grid decoration support) plus every pre-existing test from before this plan.

- [ ] **Step 2: Editor end-to-end check**

Open `editor.html`. Confirm: the unified panel search/category behavior from Task 8, placement/drag/rotation from Task 9, and — importantly — that the pre-existing **Validate** button and its map overlay (unreachable-cell shading, exit ring) still work correctly on a level that now includes decorations (decorations should have no effect on `validateConnectivity`/`reachableFloorSet`, since those only ever looked at `cells`/`start`/`exit`/`items`, not `decorations` — confirm this is still true by placing a `solid` decoration in the middle of an otherwise-open room and checking Validate still reports it as fully reachable, since decoration blocking is a *movement*-collision concern, not a connectivity-graph concern per the spec's scope).

- [ ] **Step 3: Game end-to-end check**

Open `game.html`, confirm the level picker (existing feature) still works, and play through a level containing decorations end to end: collect items, light torches, push a barrel, walk near a corner wall, reach the exit and see the win state.

- [ ] **Step 4: Confirm no server-side dependency**

```bash
grep -rn "require(" editor.html game.html index.html shared/ || echo "clean — no Node usage in any player-facing file"
```
Expected: `clean — no Node usage in any player-facing file` (only `tools/*.js` should use `require`).

No commit for this task — it's a verification pass. If any step surfaces a bug, fix it as part of the task where it was introduced (amend that task's changes, re-run its tests, re-commit) rather than papering over it here.
