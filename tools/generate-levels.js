// tools/generate-levels.js
// Run: node tools/generate-levels.js
// One-time content generation, matching this repo's existing tools/
// convention (Puppeteer thumbnail generator, asset wiki) — this script's
// OUTPUT (levels/random-NN.json + the updated manifest) is what actually
// ships; the script itself never runs at play time.
var fs = require('fs');
var path = require('path');
var EditorGrid = require('../shared/editor-grid.js');

var ROOT = path.join(__dirname, '..');
var LEVELS_DIR = path.join(ROOT, 'levels');
var SIZE = 30;
var TORCH_COUNT = 6;
var ITEM_COUNT = 12;
var MAP_COUNT = 10;

function floorCells(cells) {
  var out = [];
  for (var y = 0; y < cells.length; y++) {
    for (var x = 0; x < cells[y].length; x++) {
      if (cells[y][x] === '.') out.push([x, y]);
    }
  }
  return out;
}

function pickRandomDistinct(pool, count, exclude) {
  var excludeKeys = {};
  exclude.forEach(function (c) { excludeKeys[c[0] + ',' + c[1]] = true; });
  var candidates = pool.filter(function (c) { return !excludeKeys[c[0] + ',' + c[1]]; });
  var picked = [];
  for (var i = 0; i < count && candidates.length > 0; i++) {
    var idx = Math.floor(Math.random() * candidates.length);
    picked.push(candidates[idx]);
    candidates.splice(idx, 1);
  }
  return picked;
}

// generateMaze's lattice sits at odd coordinates (1, 3, 5, ...) — for an
// even width/height, that sequence stops one short of the true (width-2,
// height-2) corner, so the raw output leaves it unreachable. Walk inward
// from the corner (decreasing x, then y) until landing on the lattice,
// carving every cell passed through — at most one step per axis, and the
// lattice cell it lands on is always already-connected floor (the
// recursive backtracker visits every lattice cell), so this always
// reconnects the true corner to the rest of the maze.
function carveCornerToLattice(cells, cx, cy) {
  function setChar(row, x, ch) { return row.substring(0, x) + ch + row.substring(x + 1); }
  var x = cx, y = cy;
  cells[y] = setChar(cells[y], x, '.');
  while (x % 2 === 0) { x -= 1; cells[y] = setChar(cells[y], x, '.'); }
  while (y % 2 === 0) { y -= 1; cells[y] = setChar(cells[y], x, '.'); }
}

function generateLevel() {
  var cells = EditorGrid.generateMaze(SIZE, SIZE);
  var start = [1, 1]; // always a lattice cell for any size >= 3, per generateMaze
  var exit = [SIZE - 2, SIZE - 2]; // always the bottom-right corner
  carveCornerToLattice(cells, exit[0], exit[1]);

  var floors = floorCells(cells);
  var torchCells = pickRandomDistinct(floors, TORCH_COUNT, [start, exit]);
  var itemCells = pickRandomDistinct(floors, ITEM_COUNT, [start, exit].concat(torchCells));

  return {
    width: SIZE, height: SIZE, cells: cells,
    torches: torchCells.map(function (c) { return { x: c[0], y: c[1] }; }),
    items: itemCells.map(function (c) {
      return { x: c[0], y: c[1], id: 'item-' + c[0] + '-' + c[1], type: 'gem' };
    }),
    start: { x: start[0], y: start[1] },
    exit: { x: exit[0], y: exit[1] },
    monsters: [], equipment: []
  };
}

var manifestPath = path.join(LEVELS_DIR, 'manifest.json');
var manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
// Re-running this script replaces only its own previously-generated
// entries/files — hand-authored levels (level1.json) and
// their manifest entries are left alone.
manifest = manifest.filter(function (e) { return e.id.indexOf('random-') !== 0; });

for (var i = 1; i <= MAP_COUNT; i++) {
  var id = 'random-' + (i < 10 ? '0' + i : i);
  var file = id + '.json';
  var level = generateLevel();
  fs.writeFileSync(path.join(LEVELS_DIR, file), JSON.stringify(level, null, 2));
  manifest.push({ id: id, name: 'Random Maze ' + i, file: file });
  console.log('Wrote ' + file + ' (' + level.torches.length + ' torches, ' + level.items.length + ' coins)');
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('Updated ' + path.relative(ROOT, manifestPath) + ' — ' + manifest.length + ' total levels');
