# Torch Maze v1.0 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the v1.0 Torch Maze game (torch/fog exploration + item collection) and its companion 2D level editor, as pure HTML/JS with three.js, no build tools.

**Architecture:** Pure-logic code (data validation, collision, torch/item detection, editor tools) lives in `shared/*.js` as classic (non-module) scripts that attach to `window.*` namespaces — this avoids the browser's file:// CORS restriction on local ES-module imports, so `game.html`/`editor.html` can be opened by double-click with no server. three.js itself is loaded via an import map pointing at a CDN inside an inline `<script type="module">`, which is CORS-safe over file:// because the only fetched module is remote (https). Rendering/DOM glue lives directly in `game.html` and `editor.html`.

**Tech Stack:** three.js (via CDN import map, no npm/build step), vanilla JS, HTML5 canvas (editor grid), no framework.

**Spec:** `docs/superpowers/specs/2026-08-18-torch-maze-design.md`

## Global Constraints

- No build tools, no npm, no bundler. `game.html` and `editor.html` must run by double-clicking (file:// protocol).
- three.js loaded from CDN (unpkg or jsdelivr) via `<script type="importmap">` + inline `<script type="module">`.
- Local shared logic in `shared/*.js` must be classic scripts (`<script src="...">`, no `type="module"`) exposing `window.<Namespace>` objects — never use local relative ES `import`/`export`, since that breaks under file://.
- No automated test framework (no Jest/Vitest/Node test runner). Testable pure-logic modules get assertions in `tests/logic-tests.html`, a plain browser page loaded the same double-click way. Rendering/DOM behavior is verified by manual walkthrough steps written into each task.
- Maze data JSON must conform to the schema in spec §4, including the reserved-but-unused `monsters` and `equipment` arrays.
- v1.0 excludes weapons, monsters, and combat — do not implement placeholders for them beyond the reserved JSON fields already in the schema.

---

## File Structure

```
torch-maze/
├── game.html                 Game entry point
├── editor.html                Level editor entry point
├── shared/
│   ├── maze-schema.js          window.MazeSchema — data validation, mesh building, walkability
│   ├── player-controller.js    window.PlayerController — movement/collision/torch/item/win logic
│   ├── toon-renderer.js        window.ToonRenderer — toon material, outline mesh, follow camera
│   ├── level-io.js             window.LevelIO — export/import/default-level JSON helpers
│   └── editor-grid.js          window.EditorGrid — 2D grid math + paint-tool logic
├── levels/
│   └── default.json            Built-in starter level
└── tests/
    └── logic-tests.html        Browser-based assertions for all shared/*.js modules
```

---

### Task 1: Maze schema — data validation + walkability

**Files:**
- Create: `shared/maze-schema.js`
- Create: `levels/default.json`
- Create: `tests/logic-tests.html`

**Interfaces:**
- Produces: `window.MazeSchema.validateMazeData(data) -> {valid: boolean, errors: string[]}`
- Produces: `window.MazeSchema.parseCells(cells: string[]) -> string[][]` (2D char grid)
- Produces: `window.MazeSchema.isWalkable(data, x: number, y: number) -> boolean` (true if in-bounds and cell is `.`)

- [ ] **Step 1: Create `shared/maze-schema.js` with validation and walkability**

```javascript
// shared/maze-schema.js
window.MazeSchema = (function () {
  function parseCells(cells) {
    return cells.map(function (row) { return row.split(''); });
  }

  function validateMazeData(data) {
    var errors = [];
    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['data must be an object'] };
    }
    if (typeof data.width !== 'number' || typeof data.height !== 'number') {
      errors.push('width/height must be numbers');
    }
    if (!Array.isArray(data.cells) || data.cells.length !== data.height) {
      errors.push('cells must be an array with `height` rows');
    } else {
      data.cells.forEach(function (row, i) {
        if (typeof row !== 'string' || row.length !== data.width) {
          errors.push('cells row ' + i + ' must be a string of length `width`');
        } else if (!/^[#.]+$/.test(row)) {
          errors.push('cells row ' + i + ' must only contain # or .');
        }
      });
    }
    if (!Array.isArray(data.torches)) errors.push('torches must be an array');
    if (!Array.isArray(data.items)) errors.push('items must be an array');
    if (!data.start || typeof data.start.x !== 'number' || typeof data.start.y !== 'number') {
      errors.push('start must be {x, y}');
    }
    if (!data.exit || typeof data.exit.x !== 'number' || typeof data.exit.y !== 'number') {
      errors.push('exit must be {x, y}');
    }
    if (!Array.isArray(data.monsters)) errors.push('monsters must be an array (reserved for future use)');
    if (!Array.isArray(data.equipment)) errors.push('equipment must be an array (reserved for future use)');
    return { valid: errors.length === 0, errors: errors };
  }

  function isWalkable(data, x, y) {
    if (x < 0 || y < 0 || x >= data.width || y >= data.height) return false;
    var row = data.cells[y];
    if (!row) return false;
    return row[x] === '.';
  }

  return {
    parseCells: parseCells,
    validateMazeData: validateMazeData,
    isWalkable: isWalkable
  };
})();
```

- [ ] **Step 2: Create `levels/default.json`**

```json
{
  "width": 9,
  "height": 9,
  "cells": [
    "#########",
    "#..#....#",
    "#.#.###.#",
    "#.#...#.#",
    "#.###.#.#",
    "#.....#.#",
    "###.###.#",
    "#.......#",
    "#########"
  ],
  "torches": [{"x": 3, "y": 3}, {"x": 5, "y": 5}, {"x": 7, "y": 7}],
  "items": [{"x": 2, "y": 1, "id": "gem1", "type": "gem"}, {"x": 6, "y": 3, "id": "gem2", "type": "gem"}],
  "start": {"x": 1, "y": 1},
  "exit": {"x": 7, "y": 7},
  "monsters": [],
  "equipment": []
}
```

- [ ] **Step 3: Create `tests/logic-tests.html` with a tiny assertion harness and the first two checks**

```html
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Torch Maze — Logic Tests</title></head>
<body>
<pre id="out"></pre>
<script src="../shared/maze-schema.js"></script>
<script>
  var results = [];
  function assertEqual(actual, expected, label) {
    var pass = JSON.stringify(actual) === JSON.stringify(expected);
    results.push((pass ? 'PASS' : 'FAIL') + ' — ' + label +
      (pass ? '' : ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')'));
  }
  function assertTrue(actual, label) { assertEqual(!!actual, true, label); }

  // maze-schema tests
  var validData = {
    width: 3, height: 2, cells: ['#.#', '...'],
    torches: [], items: [], start: {x:1,y:0}, exit: {x:1,y:1},
    monsters: [], equipment: []
  };
  assertTrue(window.MazeSchema.validateMazeData(validData).valid, 'validateMazeData accepts well-formed data');
  assertTrue(!window.MazeSchema.validateMazeData({}).valid, 'validateMazeData rejects empty object');
  assertTrue(window.MazeSchema.isWalkable(validData, 1, 0), 'isWalkable true on floor cell');
  assertEqual(window.MazeSchema.isWalkable(validData, 0, 0), false, 'isWalkable false on wall cell');
  assertEqual(window.MazeSchema.isWalkable(validData, 99, 0), false, 'isWalkable false out of bounds');

  document.getElementById('out').textContent = results.join('\n');
  results.forEach(function (r) { console.log(r); });
</script>
</body>
</html>
```

- [ ] **Step 4: Open `tests/logic-tests.html` in a browser and verify all 5 lines say PASS**

Open the file directly (double-click or drag into browser). Expected output: 5 lines, all starting with `PASS`.

- [ ] **Step 5: Commit**

```bash
git add shared/maze-schema.js levels/default.json tests/logic-tests.html
git commit -m "$(cat <<'EOF'
Add maze data schema validation and walkability check

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Maze schema — 3D mesh building

**Files:**
- Modify: `shared/maze-schema.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Consumes: `window.MazeSchema.parseCells` (Task 1)
- Produces: `window.MazeSchema.buildMazeMesh(data, THREE) -> THREE.Group` — a group containing one box mesh per wall cell (`userData.type = 'wall'`) and a single floor plane (`userData.type = 'floor'`), sized so grid cell (x,y) maps to world position `(x, 0, y)` with cell size 1.

- [ ] **Step 1: Add `buildMazeMesh` to `shared/maze-schema.js`**

Add inside the IIFE, before `return`:

```javascript
  function buildMazeMesh(data, THREE) {
    var group = new THREE.Group();
    var wallGeo = new THREE.BoxGeometry(1, 1.2, 1);
    for (var y = 0; y < data.height; y++) {
      for (var x = 0; x < data.width; x++) {
        if (data.cells[y][x] === '#') {
          var wall = new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0x888899 }));
          wall.position.set(x, 0.6, y);
          wall.userData.type = 'wall';
          wall.userData.gridX = x;
          wall.userData.gridY = y;
          group.add(wall);
        }
      }
    }
    var floorGeo = new THREE.PlaneGeometry(data.width, data.height);
    var floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: 0x445544 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((data.width - 1) / 2, 0, (data.height - 1) / 2);
    floor.userData.type = 'floor';
    group.add(floor);
    return group;
  }
```

Add `buildMazeMesh: buildMazeMesh` to the returned object.

- [ ] **Step 2: Add mesh-building assertions to `tests/logic-tests.html`**

Add before the `document.getElementById('out')` line, using a minimal stand-in for THREE (no need to load real three.js for structural checks):

```javascript
  function FakeVec3() { this.x=0;this.y=0;this.z=0; this.set=function(x,y,z){this.x=x;this.y=y;this.z=z;return this;}; }
  function FakeGroup() { this.children=[]; this.add=function(o){this.children.push(o);}; }
  function FakeMesh(geo, mat) { this.geometry=geo; this.material=mat; this.position=new FakeVec3(); this.rotation=new FakeVec3(); this.userData={}; }
  var FakeTHREE = {
    Group: FakeGroup, Mesh: FakeMesh,
    BoxGeometry: function(){}, PlaneGeometry: function(){},
    MeshStandardMaterial: function(){}
  };

  var maze3 = { width: 2, height: 1, cells: ['.#'] };
  var mesh = window.MazeSchema.buildMazeMesh(maze3, FakeTHREE);
  var walls = mesh.children.filter(function (c) { return c.userData.type === 'wall'; });
  var floors = mesh.children.filter(function (c) { return c.userData.type === 'floor'; });
  assertEqual(walls.length, 1, 'buildMazeMesh creates one wall mesh per # cell');
  assertEqual(floors.length, 1, 'buildMazeMesh creates exactly one floor mesh');
  assertEqual([walls[0].position.x, walls[0].position.z], [1, 0], 'wall mesh placed at grid (x,y) -> world (x,0,z=y)');
```

- [ ] **Step 3: Reload `tests/logic-tests.html`, verify all lines PASS (now 8 total)**

- [ ] **Step 4: Commit**

```bash
git add shared/maze-schema.js tests/logic-tests.html
git commit -m "$(cat <<'EOF'
Add buildMazeMesh for generating wall/floor geometry from grid data

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Toon renderer — material, outline, gradient map

**Files:**
- Create: `shared/toon-renderer.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Produces: `window.ToonRenderer.createGradientMap(THREE) -> THREE.DataTexture` (4-step grayscale ramp, `NearestFilter`)
- Produces: `window.ToonRenderer.createToonMaterial(color: number, THREE) -> THREE.MeshToonMaterial`
- Produces: `window.ToonRenderer.createOutlineMesh(sourceMesh, THREE, thickness = 0.05) -> THREE.Mesh` (same geometry, `BackSide` black material, scaled up by `1 + thickness`)

- [ ] **Step 1: Create `shared/toon-renderer.js`**

```javascript
// shared/toon-renderer.js
window.ToonRenderer = (function () {
  function createGradientMap(THREE) {
    var colors = new Uint8Array([64, 128, 190, 255]);
    var tex = new THREE.DataTexture(colors, colors.length, 1, THREE.RedFormat);
    tex.needsUpdate = true;
    tex.minFilter = THREE.NearestFilter;
    tex.magFilter = THREE.NearestFilter;
    return tex;
  }

  function createToonMaterial(color, THREE) {
    return new THREE.MeshToonMaterial({
      color: color,
      gradientMap: createGradientMap(THREE)
    });
  }

  function createOutlineMesh(sourceMesh, THREE, thickness) {
    thickness = thickness === undefined ? 0.05 : thickness;
    var outlineMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.BackSide });
    var outline = new THREE.Mesh(sourceMesh.geometry, outlineMat);
    outline.position.copy(sourceMesh.position);
    outline.rotation.copy(sourceMesh.rotation);
    var s = 1 + thickness;
    outline.scale.set(s, s, s);
    return outline;
  }

  return {
    createGradientMap: createGradientMap,
    createToonMaterial: createToonMaterial,
    createOutlineMesh: createOutlineMesh
  };
})();
```

- [ ] **Step 2: Add assertions to `tests/logic-tests.html`**

Extend `FakeTHREE` (add before the maze3 block, reuse for this block too):

```javascript
  FakeTHREE.MeshToonMaterial = function (opts) { this.color = opts.color; this.gradientMap = opts.gradientMap; };
  FakeTHREE.MeshBasicMaterial = function (opts) { this.color = opts.color; this.side = opts.side; };
  FakeTHREE.DataTexture = function (data, w, h, fmt) { this.data=data; this.width=w; this.height=h; this.format=fmt; };
  FakeTHREE.RedFormat = 'red'; FakeTHREE.NearestFilter = 'nearest'; FakeTHREE.BackSide = 'back';

  var toonMat = window.ToonRenderer.createToonMaterial(0xff0000, FakeTHREE);
  assertEqual(toonMat.color, 0xff0000, 'createToonMaterial sets color');
  assertTrue(toonMat.gradientMap instanceof FakeTHREE.DataTexture, 'createToonMaterial attaches a gradient map');

  var srcMesh = new FakeMesh({}, {});
  srcMesh.position.set(2, 0, 3);
  srcMesh.scale = new FakeVec3(); srcMesh.scale.set(1,1,1);
  var outlineMesh = window.ToonRenderer.createOutlineMesh(srcMesh, FakeTHREE, 0.1);
  assertEqual([outlineMesh.position.x, outlineMesh.position.z], [2, 3], 'createOutlineMesh copies source position');
  assertEqual(outlineMesh.material.side, 'back', 'createOutlineMesh uses BackSide material');
```

Note: `FakeMesh` needs a `.scale` property for this to work — update the `FakeMesh` constructor from Task 2 to also set `this.scale = new FakeVec3();`.

- [ ] **Step 3: Reload `tests/logic-tests.html`, verify all lines PASS (now 12 total)**

- [ ] **Step 4: Commit**

```bash
git add shared/toon-renderer.js tests/logic-tests.html
git commit -m "$(cat <<'EOF'
Add toon material, gradient map, and outline mesh helpers

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Toon renderer — fixed-angle follow camera

**Files:**
- Modify: `shared/toon-renderer.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Consumes: nothing new
- Produces: `window.ToonRenderer.createFollowCamera(THREE, aspect) -> THREE.PerspectiveCamera` (fov 35, fixed offset baked in via `userData.offset = {x:0,y:9,z:9}`)
- Produces: `window.ToonRenderer.updateFollowCamera(camera, targetPos: {x,y,z})` — sets `camera.position` to `targetPos + camera.userData.offset` and points `camera.lookAt(targetPos)`

- [ ] **Step 1: Add camera helpers to `shared/toon-renderer.js`**

```javascript
  function createFollowCamera(THREE, aspect) {
    var camera = new THREE.PerspectiveCamera(35, aspect, 0.1, 100);
    camera.userData.offset = { x: 0, y: 9, z: 9 };
    return camera;
  }

  function updateFollowCamera(camera, targetPos) {
    var off = camera.userData.offset;
    camera.position.set(targetPos.x + off.x, targetPos.y + off.y, targetPos.z + off.z);
    camera.lookAt(targetPos.x, targetPos.y, targetPos.z);
  }
```

Add both to the returned object.

- [ ] **Step 2: Add assertions to `tests/logic-tests.html`**

```javascript
  FakeTHREE.PerspectiveCamera = function (fov, aspect) {
    this.fov = fov; this.aspect = aspect; this.userData = {};
    this.position = new FakeVec3();
    this.lookAtCalls = [];
    this.lookAt = function (x, y, z) { this.lookAtCalls.push([x, y, z]); };
  };

  var cam = window.ToonRenderer.createFollowCamera(FakeTHREE, 1.5);
  assertEqual(cam.fov, 35, 'createFollowCamera sets fov 35');
  window.ToonRenderer.updateFollowCamera(cam, { x: 4, y: 0, z: 6 });
  assertEqual([cam.position.x, cam.position.y, cam.position.z], [4, 9, 15], 'updateFollowCamera offsets from target');
  assertEqual(cam.lookAtCalls[0], [4, 0, 6], 'updateFollowCamera looks at target');
```

- [ ] **Step 3: Reload `tests/logic-tests.html`, verify all lines PASS (now 15 total)**

- [ ] **Step 4: Commit**

```bash
git add shared/toon-renderer.js tests/logic-tests.html
git commit -m "$(cat <<'EOF'
Add fixed-angle follow camera for diorama-style view

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Player controller — movement and wall collision

**Files:**
- Create: `shared/player-controller.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Consumes: `window.MazeSchema.isWalkable` (Task 1)
- Produces: `window.PlayerController.computeMove(pos: {x,z}, input: {forward,back,left,right}, dt: number, speed: number) -> {x,z}` (unclamped intended position; forward/back move along -z/+z, left/right along -x/+x)
- Produces: `window.PlayerController.resolveCollision(prevPos, nextPos, radius: number, mazeData) -> {x,z}` (per-axis sliding collision against `MazeSchema.isWalkable`)

- [ ] **Step 1: Create `shared/player-controller.js` with movement + collision**

```javascript
// shared/player-controller.js
window.PlayerController = (function () {
  function computeMove(pos, input, dt, speed) {
    var dx = 0, dz = 0;
    if (input.forward) dz -= 1;
    if (input.back) dz += 1;
    if (input.left) dx -= 1;
    if (input.right) dx += 1;
    var len = Math.sqrt(dx * dx + dz * dz);
    if (len > 0) { dx /= len; dz /= len; }
    return { x: pos.x + dx * speed * dt, z: pos.z + dz * speed * dt };
  }

  function cellBlocked(mazeData, worldX, worldZ) {
    var gx = Math.round(worldX);
    var gy = Math.round(worldZ);
    return !window.MazeSchema.isWalkable(mazeData, gx, gy);
  }

  function resolveCollision(prevPos, nextPos, radius, mazeData) {
    var x = prevPos.x, z = prevPos.z;
    // Try X axis alone
    if (!cellBlocked(mazeData, nextPos.x + Math.sign(nextPos.x - prevPos.x) * radius, prevPos.z)) {
      x = nextPos.x;
    }
    // Try Z axis alone (sliding)
    if (!cellBlocked(mazeData, x, nextPos.z + Math.sign(nextPos.z - prevPos.z) * radius)) {
      z = nextPos.z;
    }
    return { x: x, z: z };
  }

  return { computeMove: computeMove, resolveCollision: resolveCollision };
})();
```

- [ ] **Step 2: Load the new script and add assertions to `tests/logic-tests.html`**

Add `<script src="../shared/player-controller.js"></script>` after the `maze-schema.js` script tag, then add:

```javascript
  var mv = window.PlayerController.computeMove({x:0,z:0}, {forward:true,left:false,right:false,back:false}, 1, 2);
  assertEqual(mv, {x:0,z:-2}, 'computeMove: forward moves -z at given speed');

  var diag = window.PlayerController.computeMove({x:0,z:0}, {forward:true,right:true,left:false,back:false}, 1, 1);
  assertTrue(Math.abs(diag.x - 0.707) < 0.01 && Math.abs(diag.z + 0.707) < 0.01, 'computeMove: diagonal input is normalized');

  var collideMaze = { width: 3, height: 3, cells: ['###', '#.#', '###'] };
  var blockedMove = window.PlayerController.resolveCollision({x:1,z:1}, {x:1.9,z:1}, 0.3, collideMaze);
  assertTrue(blockedMove.x < 1.9, 'resolveCollision stops player before entering wall cell');

  var openMaze = { width: 3, height: 1, cells: ['...'] };
  var freeMove = window.PlayerController.resolveCollision({x:1,z:0}, {x:1.5,z:0}, 0.3, openMaze);
  assertEqual(freeMove, {x:1.5,z:0}, 'resolveCollision allows movement through open floor');
```

- [ ] **Step 3: Reload `tests/logic-tests.html`, verify all lines PASS (now 19 total)**

- [ ] **Step 4: Commit**

```bash
git add shared/player-controller.js tests/logic-tests.html
git commit -m "$(cat <<'EOF'
Add player movement and wall-sliding collision logic

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Player controller — torch proximity, item pickup, win check

**Files:**
- Modify: `shared/player-controller.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Consumes: nothing new
- Produces: `window.PlayerController.findNearbyTorch(pos, torches: {x,y}[], radius) -> number` (index into `torches`, or `-1`)
- Produces: `window.PlayerController.findNearbyItem(pos, items: {x,y,id}[], radius) -> number` (index into `items`, or `-1`)
- Produces: `window.PlayerController.checkWin(pos, exit: {x,y}, collectedCount, totalItems, radius) -> boolean`

- [ ] **Step 1: Add the three functions to `shared/player-controller.js`**

```javascript
  function dist2D(pos, cell) {
    var dx = pos.x - cell.x, dz = pos.z - cell.y;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function findNearbyTorch(pos, torches, radius) {
    for (var i = 0; i < torches.length; i++) {
      if (dist2D(pos, torches[i]) <= radius) return i;
    }
    return -1;
  }

  function findNearbyItem(pos, items, radius) {
    for (var i = 0; i < items.length; i++) {
      if (dist2D(pos, items[i]) <= radius) return i;
    }
    return -1;
  }

  function checkWin(pos, exit, collectedCount, totalItems, radius) {
    return collectedCount >= totalItems && dist2D(pos, exit) <= radius;
  }
```

Add `findNearbyTorch`, `findNearbyItem`, `checkWin` to the returned object.

- [ ] **Step 2: Add assertions to `tests/logic-tests.html`**

```javascript
  var torches = [{x:2,y:2}, {x:5,y:5}];
  assertEqual(window.PlayerController.findNearbyTorch({x:2.1,z:2.1}, torches, 0.5), 0, 'findNearbyTorch finds close torch by index');
  assertEqual(window.PlayerController.findNearbyTorch({x:0,z:0}, torches, 0.5), -1, 'findNearbyTorch returns -1 when none in range');

  var items = [{x:1,y:1,id:'gem1'}];
  assertEqual(window.PlayerController.findNearbyItem({x:1,z:1}, items, 0.4), 0, 'findNearbyItem finds item at same cell');

  assertTrue(!window.PlayerController.checkWin({x:7,z:7}, {x:7,y:7}, 1, 2, 0.5), 'checkWin false when items not all collected');
  assertTrue(window.PlayerController.checkWin({x:7,z:7}, {x:7,y:7}, 2, 2, 0.5), 'checkWin true at exit with all items collected');
```

- [ ] **Step 3: Reload `tests/logic-tests.html`, verify all lines PASS (now 24 total)**

- [ ] **Step 4: Commit**

```bash
git add shared/player-controller.js tests/logic-tests.html
git commit -m "$(cat <<'EOF'
Add torch proximity, item pickup, and win-condition checks

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: game.html — scene skeleton, maze render, static camera

**Files:**
- Create: `game.html`

**Interfaces:**
- Consumes: `window.MazeSchema` (Tasks 1-2), `window.ToonRenderer` (Tasks 3-4), `levels/default.json`
- Produces: nothing consumed by later tasks except the DOM/script structure itself, which Tasks 8-12 extend in place

- [ ] **Step 1: Create `game.html` with import map, classic script includes, and initial scene render**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>Torch Maze</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
  canvas { display: block; }
  #hud { position: fixed; top: 10px; left: 10px; color: #fff; font-family: sans-serif; text-shadow: 0 0 4px #000; }
</style>
<script type="importmap">
{
  "imports": {
    "three": "https://unpkg.com/three@0.160.0/build/three.module.js"
  }
}
</script>
</head>
<body>
<div id="hud">Loading...</div>
<script src="shared/maze-schema.js"></script>
<script src="shared/toon-renderer.js"></script>
<script src="shared/player-controller.js"></script>
<script type="module">
import * as THREE from 'three';

async function loadDefaultLevel() {
  var res = await fetch('levels/default.json');
  return res.json();
}

async function main() {
  var mazeData = await loadDefaultLevel();
  var check = window.MazeSchema.validateMazeData(mazeData);
  if (!check.valid) { console.error('Invalid level:', check.errors); return; }

  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05050a);

  var camera = window.ToonRenderer.createFollowCamera(THREE, window.innerWidth / window.innerHeight);

  var mazeMesh = window.MazeSchema.buildMazeMesh(mazeData, THREE);
  scene.add(mazeMesh);

  var ambient = new THREE.AmbientLight(0x222233, 0.4);
  scene.add(ambient);

  var playerPos = { x: mazeData.start.x, z: mazeData.start.y };
  window.ToonRenderer.updateFollowCamera(camera, { x: playerPos.x, y: 0, z: playerPos.z });

  window.addEventListener('resize', function () {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  document.getElementById('hud').textContent = 'Torch Maze — level loaded';

  function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
  }
  animate();
}

main();
</script>
</body>
</html>
```

- [ ] **Step 2: Manual test — open `game.html` directly in a browser**

Double-click `game.html`. Expected: no console errors, a dark scene renders with grey wall blocks and a dark green floor forming the shape of `levels/default.json`'s maze, viewed from a fixed high angle. HUD text reads "Torch Maze — level loaded".

- [ ] **Step 3: Commit**

```bash
git add game.html
git commit -m "$(cat <<'EOF'
Add game.html skeleton rendering the default maze level

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: game.html — player mesh, WASD movement, collision

**Files:**
- Modify: `game.html`

**Interfaces:**
- Consumes: `window.PlayerController.computeMove`, `window.PlayerController.resolveCollision` (Task 5)

- [ ] **Step 1: Add player mesh, keyboard input state, and per-frame movement to the module script**

Insert after `var playerPos = ...` line, before the `window.addEventListener('resize', ...)` block:

```javascript
  var playerGeo = new THREE.SphereGeometry(0.3, 16, 16);
  var playerMat = window.ToonRenderer.createToonMaterial(0xffcc66, THREE);
  var playerMesh = new THREE.Mesh(playerGeo, playerMat);
  playerMesh.position.set(playerPos.x, 0.3, playerPos.z);
  scene.add(playerMesh);
  var playerOutline = window.ToonRenderer.createOutlineMesh(playerMesh, THREE, 0.08);
  scene.add(playerOutline);

  var input = { forward: false, back: false, left: false, right: false };
  var keyMap = { KeyW: 'forward', KeyS: 'back', KeyA: 'left', KeyD: 'right' };
  window.addEventListener('keydown', function (e) { if (keyMap[e.code]) input[keyMap[e.code]] = true; });
  window.addEventListener('keyup', function (e) { if (keyMap[e.code]) input[keyMap[e.code]] = false; });

  var clock = new THREE.Clock();
  var PLAYER_SPEED = 2.5;
  var PLAYER_RADIUS = 0.3;
```

- [ ] **Step 2: Wire movement into the animate loop**

Replace the `animate` function body:

```javascript
  function animate() {
    requestAnimationFrame(animate);
    var dt = clock.getDelta();

    var intended = window.PlayerController.computeMove({ x: playerPos.x, z: playerPos.z }, input, dt, PLAYER_SPEED);
    var resolved = window.PlayerController.resolveCollision({ x: playerPos.x, z: playerPos.z }, intended, PLAYER_RADIUS, mazeData);
    playerPos.x = resolved.x;
    playerPos.z = resolved.z;

    playerMesh.position.set(playerPos.x, 0.3, playerPos.z);
    playerOutline.position.copy(playerMesh.position);
    window.ToonRenderer.updateFollowCamera(camera, { x: playerPos.x, y: 0, z: playerPos.z });

    renderer.render(scene, camera);
  }
```

- [ ] **Step 3: Manual test — open `game.html`, move with WASD**

Expected: the orange sphere (player) moves smoothly with WASD, camera follows it, and it cannot pass through grey wall blocks (slides along them instead of stopping dead when moving diagonally into a corner).

- [ ] **Step 4: Commit**

```bash
git add game.html
git commit -m "$(cat <<'EOF'
Add player mesh, WASD input, and wall collision to game.html

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: game.html — torch lighting (unlit → lit) and checkpoint tracking

**Files:**
- Modify: `game.html`

**Interfaces:**
- Consumes: `window.PlayerController.findNearbyTorch` (Task 6)

- [ ] **Step 1: Build torch meshes + lights when the maze loads**

Insert after the `scene.add(mazeMesh);` line:

```javascript
  var TORCH_LIGHT_RADIUS = 1.2;
  var torchObjects = mazeData.torches.map(function (t) {
    var flameGeo = new THREE.SphereGeometry(0.15, 8, 8);
    var flameMat = new THREE.MeshBasicMaterial({ color: 0x552200 });
    var flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(t.x, 1.0, t.y);
    scene.add(flame);

    var light = new THREE.PointLight(0xffaa44, 0, 4);
    light.position.set(t.x, 1.0, t.y);
    scene.add(light);

    return { data: t, flame: flame, light: light, lit: false };
  });
  var lastLitTorchIndex = -1;
```

- [ ] **Step 2: Check proximity and light torches each frame**

Insert inside `animate()`, right after the player position/camera update block (before `renderer.render`):

```javascript
    var nearbyIdx = window.PlayerController.findNearbyTorch(
      { x: playerPos.x, z: playerPos.z },
      mazeData.torches,
      TORCH_LIGHT_RADIUS
    );
    if (nearbyIdx !== -1 && !torchObjects[nearbyIdx].lit) {
      torchObjects[nearbyIdx].lit = true;
      torchObjects[nearbyIdx].light.intensity = 1.5;
      torchObjects[nearbyIdx].flame.material.color.set(0xffaa33);
      lastLitTorchIndex = nearbyIdx;
    }
```

- [ ] **Step 3: Manual test — walk toward each torch**

Expected: torches start as dim brown spheres with no light; walking within ~1.2 units of one turns its sphere bright orange and lights up the surrounding area. Previously-lit torches stay lit when you walk away.

- [ ] **Step 4: Commit**

```bash
git add game.html
git commit -m "$(cat <<'EOF'
Add torch lighting: unlit torches ignite on player proximity

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: game.html — fog of war and player light

**Files:**
- Modify: `game.html`

**Interfaces:**
- Consumes: nothing new

- [ ] **Step 1: Add scene fog and lower ambient light**

Replace `var ambient = new THREE.AmbientLight(0x222233, 0.4);` with:

```javascript
  scene.fog = new THREE.FogExp2(0x05050a, 0.18);
  var ambient = new THREE.AmbientLight(0x222233, 0.12);
  scene.add(ambient);
```

- [ ] **Step 2: Add a light that follows the player**

Insert after `scene.add(playerOutline);`:

```javascript
  var playerLight = new THREE.PointLight(0xffddaa, 0.8, 2.5);
  scene.add(playerLight);
```

Insert inside `animate()`, right after `playerOutline.position.copy(playerMesh.position);`:

```javascript
    playerLight.position.set(playerPos.x, 0.6, playerPos.z);
```

- [ ] **Step 3: Manual test — observe visibility falloff**

Expected: areas beyond ~a few units from the player fade into darkness/fog; walls close to the player are dimly visible from the player's own light even before any wall torch is lit; lit torches noticeably brighten their local area beyond the player's own glow.

- [ ] **Step 4: Commit**

```bash
git add game.html
git commit -m "$(cat <<'EOF'
Add fog of war and a light source that follows the player

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: game.html — teleport to last lit torch

**Files:**
- Modify: `game.html`

**Interfaces:**
- Consumes: `lastLitTorchIndex` (Task 9)

- [ ] **Step 1: Add the `E` key handler**

Insert after the existing `keydown`/`keyup` listeners:

```javascript
  window.addEventListener('keydown', function (e) {
    if (e.code === 'KeyE' && lastLitTorchIndex !== -1) {
      var t = mazeData.torches[lastLitTorchIndex];
      playerPos.x = t.x;
      playerPos.z = t.y;
    }
  });
```

- [ ] **Step 2: Manual test — light a torch, walk away, press E**

Expected: pressing `E` after having lit at least one torch instantly moves the player back to that torch's position. Pressing `E` before lighting any torch does nothing (no error in console).

- [ ] **Step 3: Commit**

```bash
git add game.html
git commit -m "$(cat <<'EOF'
Add teleport-to-last-lit-torch on E key

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: game.html — item collection, HUD, win condition

**Files:**
- Modify: `game.html`

**Interfaces:**
- Consumes: `window.PlayerController.findNearbyItem`, `window.PlayerController.checkWin` (Task 6)

- [ ] **Step 1: Build item meshes and collection state**

Insert after the `torchObjects` block:

```javascript
  var ITEM_PICKUP_RADIUS = 0.5;
  var itemGeo = new THREE.OctahedronGeometry(0.2);
  var itemMeshes = mazeData.items.map(function (it) {
    var mesh = new THREE.Mesh(itemGeo, window.ToonRenderer.createToonMaterial(0x66ccff, THREE));
    mesh.position.set(it.x, 0.5, it.y);
    scene.add(mesh);
    return { data: it, mesh: mesh, collected: false };
  });
  var collectedCount = 0;
  var gameWon = false;
```

- [ ] **Step 2: Check pickup and win each frame**

Insert inside `animate()`, after the torch-lighting block:

```javascript
    if (!gameWon) {
      var itemIdx = window.PlayerController.findNearbyItem(
        { x: playerPos.x, z: playerPos.z },
        mazeData.items,
        ITEM_PICKUP_RADIUS
      );
      if (itemIdx !== -1 && !itemMeshes[itemIdx].collected) {
        itemMeshes[itemIdx].collected = true;
        scene.remove(itemMeshes[itemIdx].mesh);
        collectedCount++;
      }

      if (window.PlayerController.checkWin(
        { x: playerPos.x, z: playerPos.z }, mazeData.exit,
        collectedCount, mazeData.items.length, 0.6
      )) {
        gameWon = true;
      }
    }

    document.getElementById('hud').textContent =
      gameWon ? '通关！收集 ' + collectedCount + '/' + mazeData.items.length
              : '道具 ' + collectedCount + '/' + mazeData.items.length + ' — WASD 移动，E 传送回火把';
```

- [ ] **Step 3: Manual test — full playthrough**

Expected: walking over an item makes it disappear and increments the HUD counter; reaching the exit cell before collecting all items does nothing; after collecting all items, reaching the exit cell shows "通关！" in the HUD and the player stops responding further game-state changes (movement can keep working, that's fine — no monsters/combat in v1.0).

- [ ] **Step 4: Commit**

```bash
git add game.html
git commit -m "$(cat <<'EOF'
Add item collection, HUD, and win condition to game.html

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: level-io — export/import/default helpers

**Files:**
- Create: `shared/level-io.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Consumes: `window.MazeSchema.validateMazeData` (Task 1)
- Produces: `window.LevelIO.exportLevelJSON(data) -> string` (pretty-printed JSON)
- Produces: `window.LevelIO.parseLevelJSON(text: string) -> {ok: true, data} | {ok: false, errors: string[]}`
- Produces: `window.LevelIO.createDefaultLevel(width: number, height: number) -> object` (all-wall border, floor interior, no torches/items, start at (1,1), exit at (width-2,height-2))

- [ ] **Step 1: Create `shared/level-io.js`**

```javascript
// shared/level-io.js
window.LevelIO = (function () {
  function exportLevelJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  function parseLevelJSON(text) {
    var data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { ok: false, errors: ['invalid JSON: ' + e.message] };
    }
    var check = window.MazeSchema.validateMazeData(data);
    if (!check.valid) return { ok: false, errors: check.errors };
    return { ok: true, data: data };
  }

  function createDefaultLevel(width, height) {
    var cells = [];
    for (var y = 0; y < height; y++) {
      var row = '';
      for (var x = 0; x < width; x++) {
        var isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
        row += isBorder ? '#' : '.';
      }
      cells.push(row);
    }
    return {
      width: width, height: height, cells: cells,
      torches: [], items: [],
      start: { x: 1, y: 1 },
      exit: { x: width - 2, y: height - 2 },
      monsters: [], equipment: []
    };
  }

  return {
    exportLevelJSON: exportLevelJSON,
    parseLevelJSON: parseLevelJSON,
    createDefaultLevel: createDefaultLevel
  };
})();
```

- [ ] **Step 2: Load the script and add assertions to `tests/logic-tests.html`**

Add `<script src="../shared/level-io.js"></script>` after `maze-schema.js`'s script tag, then add:

```javascript
  var defLevel = window.LevelIO.createDefaultLevel(5, 4);
  assertEqual(defLevel.cells, ['#####', '#...#', '#...#', '#####'], 'createDefaultLevel builds a bordered rectangle');
  assertEqual(defLevel.exit, {x:3,y:2}, 'createDefaultLevel places exit at bottom-right interior corner');

  var roundTrip = window.LevelIO.parseLevelJSON(window.LevelIO.exportLevelJSON(defLevel));
  assertTrue(roundTrip.ok, 'exportLevelJSON -> parseLevelJSON round-trips a valid level');

  var badParse = window.LevelIO.parseLevelJSON('not json');
  assertTrue(!badParse.ok, 'parseLevelJSON rejects invalid JSON text');

  var invalidLevel = window.LevelIO.parseLevelJSON(JSON.stringify({width:1}));
  assertTrue(!invalidLevel.ok, 'parseLevelJSON rejects JSON missing required fields');
```

- [ ] **Step 3: Reload `tests/logic-tests.html`, verify all lines PASS (now 29 total)**

- [ ] **Step 4: Commit**

```bash
git add shared/level-io.js tests/logic-tests.html
git commit -m "$(cat <<'EOF'
Add level JSON export/import/default-level helpers

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: editor-grid — pixel/cell math and paint tools

**Files:**
- Create: `shared/editor-grid.js`
- Modify: `tests/logic-tests.html`

**Interfaces:**
- Consumes: nothing
- Produces: `window.EditorGrid.TOOLS -> {WALL, FLOOR, TORCH, ITEM, START, EXIT}` (string constants)
- Produces: `window.EditorGrid.pixelToCell(px, py, cellSize) -> {x, y}` (floor division)
- Produces: `window.EditorGrid.applyTool(data, tool, x, y) -> data` (mutates and returns `data`; WALL/FLOOR edit `cells`; TORCH/ITEM toggle presence in their arrays at that cell, removing if already present; START/EXIT overwrite `data.start`/`data.exit`)
- Produces: `window.EditorGrid.resizeGrid(data, newWidth, newHeight) -> data` (new object; preserves existing cell content up to the overlapping region, new cells default to `#`; drops torches/items outside new bounds)

- [ ] **Step 1: Create `shared/editor-grid.js`**

```javascript
// shared/editor-grid.js
window.EditorGrid = (function () {
  var TOOLS = { WALL: 'wall', FLOOR: 'floor', TORCH: 'torch', ITEM: 'item', START: 'start', EXIT: 'exit' };

  function pixelToCell(px, py, cellSize) {
    return { x: Math.floor(px / cellSize), y: Math.floor(py / cellSize) };
  }

  function setCellChar(data, x, y, ch) {
    var row = data.cells[y];
    data.cells[y] = row.substring(0, x) + ch + row.substring(x + 1);
  }

  function toggleAt(list, x, y, makeEntry) {
    var idx = -1;
    for (var i = 0; i < list.length; i++) {
      if (list[i].x === x && list[i].y === y) { idx = i; break; }
    }
    if (idx !== -1) { list.splice(idx, 1); }
    else { list.push(makeEntry(x, y)); }
  }

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

  function resizeGrid(data, newWidth, newHeight) {
    var newCells = [];
    for (var y = 0; y < newHeight; y++) {
      var row = '';
      for (var x = 0; x < newWidth; x++) {
        var oldRow = data.cells[y];
        row += (oldRow && x < oldRow.length) ? oldRow[x] : '#';
      }
      newCells.push(row);
    }
    function inBounds(p) { return p.x < newWidth && p.y < newHeight; }
    return {
      width: newWidth, height: newHeight, cells: newCells,
      torches: data.torches.filter(inBounds),
      items: data.items.filter(inBounds),
      start: inBounds(data.start) ? data.start : { x: 1, y: 1 },
      exit: inBounds(data.exit) ? data.exit : { x: newWidth - 2, y: newHeight - 2 },
      monsters: [], equipment: []
    };
  }

  return { TOOLS: TOOLS, pixelToCell: pixelToCell, applyTool: applyTool, resizeGrid: resizeGrid };
})();
```

- [ ] **Step 2: Load the script and add assertions to `tests/logic-tests.html`**

Add `<script src="../shared/editor-grid.js"></script>` after `level-io.js`'s script tag, then add:

```javascript
  assertEqual(window.EditorGrid.pixelToCell(105, 40, 32), {x:3,y:1}, 'pixelToCell floors pixel coords by cell size');

  var edLevel = window.LevelIO.createDefaultLevel(4, 4);
  window.EditorGrid.applyTool(edLevel, window.EditorGrid.TOOLS.WALL, 1, 1);
  assertEqual(edLevel.cells[1], '##.#', 'applyTool WALL writes # into cells');
  window.EditorGrid.applyTool(edLevel, window.EditorGrid.TOOLS.FLOOR, 1, 1);
  assertEqual(edLevel.cells[1], '#...', 'applyTool FLOOR writes . into cells');

  window.EditorGrid.applyTool(edLevel, window.EditorGrid.TOOLS.TORCH, 2, 2);
  assertEqual(edLevel.torches.length, 1, 'applyTool TORCH adds a torch');
  window.EditorGrid.applyTool(edLevel, window.EditorGrid.TOOLS.TORCH, 2, 2);
  assertEqual(edLevel.torches.length, 0, 'applyTool TORCH toggles off when applied again at same cell');

  window.EditorGrid.applyTool(edLevel, window.EditorGrid.TOOLS.START, 2, 2);
  assertEqual(edLevel.start, {x:2,y:2}, 'applyTool START overwrites start position');

  var resized = window.EditorGrid.resizeGrid(edLevel, 3, 3);
  assertEqual(resized.cells.length, 3, 'resizeGrid produces newHeight rows');
  assertEqual(resized.cells[0].length, 3, 'resizeGrid produces newWidth columns');
```

- [ ] **Step 3: Reload `tests/logic-tests.html`, verify all lines PASS (now 37 total)**

- [ ] **Step 4: Commit**

```bash
git add shared/editor-grid.js tests/logic-tests.html
git commit -m "$(cat <<'EOF'
Add editor grid math and paint-tool logic

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 15: editor.html — canvas grid, toolbar, painting

**Files:**
- Create: `editor.html`

**Interfaces:**
- Consumes: `window.LevelIO.createDefaultLevel` (Task 13), `window.EditorGrid` (Task 14)

- [ ] **Step 1: Create `editor.html`**

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>Torch Maze — 地图编辑器</title>
<style>
  body { font-family: sans-serif; margin: 0; display: flex; }
  #toolbar { padding: 12px; display: flex; flex-direction: column; gap: 6px; width: 160px; }
  #toolbar button { padding: 8px; cursor: pointer; }
  #toolbar button.active { background: #ffd966; font-weight: bold; }
  canvas { border: 1px solid #333; image-rendering: pixelated; }
</style>
</head>
<body>
<div id="toolbar">
  <div>工具</div>
  <button data-tool="wall" class="active">墙 (Wall)</button>
  <button data-tool="floor">地板 (Floor)</button>
  <button data-tool="torch">火把 (Torch)</button>
  <button data-tool="item">道具 (Item)</button>
  <button data-tool="start">起点 (Start)</button>
  <button data-tool="exit">终点 (Exit)</button>
</div>
<canvas id="grid" width="480" height="480"></canvas>
<script src="shared/maze-schema.js"></script>
<script src="shared/level-io.js"></script>
<script src="shared/editor-grid.js"></script>
<script>
  var CELL_SIZE = 32;
  var data = window.LevelIO.createDefaultLevel(15, 15);
  var currentTool = window.EditorGrid.TOOLS.WALL;
  var canvas = document.getElementById('grid');
  var ctx = canvas.getContext('2d');

  document.querySelectorAll('#toolbar button').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('#toolbar button').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      currentTool = btn.dataset.tool;
    });
  });

  function paintAt(evt) {
    var rect = canvas.getBoundingClientRect();
    var cell = window.EditorGrid.pixelToCell(evt.clientX - rect.left, evt.clientY - rect.top, CELL_SIZE);
    window.EditorGrid.applyTool(data, currentTool, cell.x, cell.y);
    render();
  }

  var painting = false;
  canvas.addEventListener('mousedown', function (e) { painting = true; paintAt(e); });
  window.addEventListener('mouseup', function () { painting = false; });
  canvas.addEventListener('mousemove', function (e) { if (painting) paintAt(e); });

  function render() {
    canvas.width = data.width * CELL_SIZE;
    canvas.height = data.height * CELL_SIZE;
    for (var y = 0; y < data.height; y++) {
      for (var x = 0; x < data.width; x++) {
        ctx.fillStyle = data.cells[y][x] === '#' ? '#444455' : '#dddde8';
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = '#00000022';
        ctx.strokeRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }
    }
    data.torches.forEach(function (t) {
      ctx.fillStyle = '#ff8800';
      ctx.beginPath();
      ctx.arc(t.x * CELL_SIZE + CELL_SIZE/2, t.y * CELL_SIZE + CELL_SIZE/2, CELL_SIZE*0.25, 0, Math.PI*2);
      ctx.fill();
    });
    data.items.forEach(function (it) {
      ctx.fillStyle = '#3399ff';
      ctx.fillRect(it.x*CELL_SIZE+CELL_SIZE*0.3, it.y*CELL_SIZE+CELL_SIZE*0.3, CELL_SIZE*0.4, CELL_SIZE*0.4);
    });
    ctx.fillStyle = '#22cc55';
    ctx.fillRect(data.start.x*CELL_SIZE+4, data.start.y*CELL_SIZE+4, CELL_SIZE-8, CELL_SIZE-8);
    ctx.fillStyle = '#cc2255';
    ctx.fillRect(data.exit.x*CELL_SIZE+4, data.exit.y*CELL_SIZE+4, CELL_SIZE-8, CELL_SIZE-8);
  }

  render();
</script>
</body>
</html>
```

- [ ] **Step 2: Manual test — open `editor.html` and paint**

Double-click `editor.html`. Expected: a 15×15 grid of wall-colored cells with a green start square and red exit square. Selecting "地板 (Floor)" and dragging across cells carves floor paths; selecting "火把"/"道具" and clicking places orange/blue markers; clicking with "起点"/"终点" selected moves the green/red marker. No console errors.

- [ ] **Step 3: Commit**

```bash
git add editor.html
git commit -m "$(cat <<'EOF'
Add editor.html with paintable grid canvas and tool palette

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 16: editor.html export/import + game.html custom level loading

**Files:**
- Modify: `editor.html`
- Modify: `game.html`

**Interfaces:**
- Consumes: `window.LevelIO.exportLevelJSON`, `window.LevelIO.parseLevelJSON` (Task 13); `window.EditorGrid.resizeGrid` (Task 14)

- [ ] **Step 1: Add export/import/resize controls to `editor.html`**

Add to `#toolbar`, after the tool buttons:

```html
  <hr>
  <div>网格尺寸</div>
  <div style="display:flex; gap:4px;">
    <input id="widthInput" type="number" value="15" min="3" max="60" style="width:50px;">
    <input id="heightInput" type="number" value="15" min="3" max="60" style="width:50px;">
    <button id="resizeBtn">调整</button>
  </div>
  <hr>
  <button id="exportBtn">导出 JSON</button>
  <input id="importInput" type="file" accept="application/json">
```

Add before `render();` at the bottom of the script:

```javascript
  document.getElementById('resizeBtn').addEventListener('click', function () {
    var w = parseInt(document.getElementById('widthInput').value, 10);
    var h = parseInt(document.getElementById('heightInput').value, 10);
    data = window.EditorGrid.resizeGrid(data, w, h);
    render();
  });

  document.getElementById('exportBtn').addEventListener('click', function () {
    var blob = new Blob([window.LevelIO.exportLevelJSON(data)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'level.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.getElementById('importInput').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var result = window.LevelIO.parseLevelJSON(reader.result);
      if (!result.ok) { alert('导入失败：' + result.errors.join(', ')); return; }
      data = result.data;
      document.getElementById('widthInput').value = data.width;
      document.getElementById('heightInput').value = data.height;
      render();
    };
    reader.readAsText(file);
  });
```

- [ ] **Step 2: Add a custom-level file picker to `game.html`**

Add to the `<body>`, before `<div id="hud">`:

```html
<div id="loader" style="position:fixed; top:10px; right:10px; color:#fff; font-family:sans-serif;">
  <input id="customLevelInput" type="file" accept="application/json">
  <div style="font-size:12px;">选择自定义关卡 JSON（不选则加载默认关卡）</div>
</div>
```

Replace the `main()` function's level-loading logic — change:

```javascript
async function loadDefaultLevel() {
  var res = await fetch('levels/default.json');
  return res.json();
}

async function main() {
  var mazeData = await loadDefaultLevel();
  var check = window.MazeSchema.validateMazeData(mazeData);
  if (!check.valid) { console.error('Invalid level:', check.errors); return; }
```

to:

```javascript
async function loadDefaultLevel() {
  var res = await fetch('levels/default.json');
  return res.json();
}

function loadCustomLevel(file) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onload = function () {
      var result = window.LevelIO.parseLevelJSON(reader.result);
      if (!result.ok) reject(new Error(result.errors.join(', ')));
      else resolve(result.data);
    };
    reader.readAsText(file);
  });
}

async function startGame(mazeData) {
  var check = window.MazeSchema.validateMazeData(mazeData);
  if (!check.valid) { console.error('Invalid level:', check.errors); return; }
```

And change the final call from `main();` to:

```javascript
document.getElementById('customLevelInput').addEventListener('change', function (e) {
  var file = e.target.files[0];
  if (!file) return;
  loadCustomLevel(file).then(startGame).catch(function (err) {
    alert('关卡加载失败：' + err.message);
  });
});

loadDefaultLevel().then(startGame);
```

Add `<script src="shared/level-io.js"></script>` next to the other classic script includes in `game.html`.

- [ ] **Step 3: Manual end-to-end test**

1. Open `editor.html`, paint a small new maze, place a torch, an item, move start/exit, click "导出 JSON", save `level.json`.
2. Open `game.html`, use the file picker to select `level.json`.
3. Expected: the custom maze renders and is playable — walls match what was painted, the torch lights on approach, the item can be collected, and reaching the exit after collecting it shows "通关！".

- [ ] **Step 4: Commit**

```bash
git add editor.html game.html
git commit -m "$(cat <<'EOF'
Add level export/import and custom level loading, closing the
editor-to-game loop

Co-authored-by: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Self-Review Notes

- **Spec coverage:** §3 file structure (Tasks 1-16 create every listed file except a package.json — intentionally omitted, no build step needed), §4 data format incl. reserved `monsters`/`equipment` (Task 1, 13), §5 movement/fog/torch/teleport/win (Tasks 8-12), §6 toon rendering (Tasks 3-4, used in 8/12), §7 editor (Tasks 14-16), §8 testing approach (logic-tests.html + manual walkthroughs throughout). §9 (art references) is documentation-only, no task needed.
- **Placeholder scan:** no TBD/TODO; every step has literal code or literal manual-test instructions.
- **Type/name consistency:** verified `MazeSchema`, `PlayerController`, `ToonRenderer`, `LevelIO`, `EditorGrid` function names and signatures match between the task that defines them and every later task that calls them.
