// tools/generate-levels.js
// Run: node tools/generate-levels.js
// One-time content generation, matching this repo's existing tools/
// convention (Puppeteer thumbnail generator, asset wiki) — this script's
// OUTPUT (levels/<difficulty>-NN.json + the updated manifest) is what
// actually ships; the script itself never runs at play time.
var fs = require('fs');
var path = require('path');
var EditorGrid = require('../shared/editor-grid.js');

var ROOT = path.join(__dirname, '..');
var LEVELS_DIR = path.join(ROOT, 'levels');
var MAPS_PER_TIER = 10;

// Torch/coin counts are scaled roughly proportional to area, anchored on
// 30x30 -> 6 torches/12 coins (matching the original Easy-only batch), so
// Nightmare doesn't feel emptier than Easy despite being ~11x the area.
var TIERS = [
  { key: 'easy', label: 'Easy', size: 30, torches: 6, items: 12 },
  { key: 'medium', label: 'Medium', size: 50, torches: 16, items: 32 },
  { key: 'hard', label: 'Hard', size: 80, torches: 42, items: 84 },
  { key: 'nightmare', label: 'Nightmare', size: 100, torches: 66, items: 132 }
];

function floorCells(cells) {
  var out = [];
  for (var y = 0; y < cells.length; y++) {
    for (var x = 0; x < cells[y].length; x++) {
      if (cells[y][x] === '.') out.push([x, y]);
    }
  }
  return out;
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

function generateLevel(tier) {
  var size = tier.size;
  var cells = EditorGrid.generateMaze(size, size);
  var start = [1, 1]; // always a lattice cell for any size >= 3, per generateMaze
  var exit = [size - 2, size - 2]; // always the bottom-right corner
  carveCornerToLattice(cells, exit[0], exit[1]);

  var floors = floorCells(cells);
  var torchCells = pickRandomDistinct(floors, tier.torches, [start, exit]);
  var itemCells = pickRandomDistinct(floors, tier.items, [start, exit].concat(torchCells));

  return {
    width: size, height: size, cells: cells,
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
// entries/files (any tier key from TIERS) — hand-authored levels
// (level1.json) and their manifest entries are left alone. Also drops any
// entry whose file no longer exists on disk — catches leftovers from a
// prior naming scheme (e.g. the old flat "random-NN" batch this replaced),
// which wouldn't match today's tier keys but still shouldn't linger as a
// dangling link to a deleted file.
var tierKeys = TIERS.map(function (t) { return t.key; });
manifest = manifest.filter(function (e) {
  if (tierKeys.indexOf(e.id.split('-')[0]) !== -1) return false;
  return fs.existsSync(path.join(LEVELS_DIR, e.file));
});

TIERS.forEach(function (tier) {
  for (var i = 1; i <= MAPS_PER_TIER; i++) {
    var num = i < 10 ? '0' + i : '' + i;
    var id = tier.key + '-' + num;
    var file = id + '.json';
    var level = generateLevel(tier);
    fs.writeFileSync(path.join(LEVELS_DIR, file), JSON.stringify(level, null, 2));
    manifest.push({ id: id, name: tier.label + ' ' + i, file: file, difficulty: tier.key });
    console.log('Wrote ' + file + ' (' + level.torches.length + ' torches, ' + level.items.length + ' coins)');
  }
});

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('Updated ' + path.relative(ROOT, manifestPath) + ' — ' + manifest.length + ' total levels');
