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

  // Randomized recursive-backtracker maze generation. The outer border
  // always stays solid; carvable "lattice" cells sit at odd (x, y) within
  // the interior, one cell apart, with the even cell between two adjacent
  // lattice cells acting as the wall that may get carved to join them —
  // the standard technique for generating a "perfect maze" (a spanning
  // tree over the lattice: exactly one path between any two cells, no
  // loops). For even width/height, the lattice can't quite reach the far
  // interior edge (an odd sequence starting at 1 skips the last even
  // column/row before the border) — that strip stays permanently walled
  // off rather than joined into the maze; a minor cosmetic quirk on
  // non-default sizes, not a connectivity bug.
  function generateMaze(width, height) {
    var grid = [];
    for (var y = 0; y < height; y++) {
      var row = [];
      for (var x = 0; x < width; x++) row.push('#');
      grid.push(row);
    }

    function isLattice(x, y) {
      return x > 0 && y > 0 && x < width - 1 && y < height - 1 && x % 2 === 1 && y % 2 === 1;
    }
    function key(x, y) { return x + ',' + y; }

    var latticeCells = [];
    for (var ly = 1; ly < height - 1; ly += 2) {
      for (var lx = 1; lx < width - 1; lx += 2) {
        latticeCells.push([lx, ly]);
      }
    }
    if (latticeCells.length === 0) {
      return grid.map(function (r) { return r.join(''); });
    }

    var visited = {};
    var start = latticeCells[Math.floor(Math.random() * latticeCells.length)];
    var stack = [start];
    visited[key(start[0], start[1])] = true;
    grid[start[1]][start[0]] = '.';

    var DIRS = [[0, -2], [2, 0], [0, 2], [-2, 0]];

    while (stack.length > 0) {
      var cur = stack[stack.length - 1];
      var cx = cur[0], cy = cur[1];
      var neighbors = [];
      DIRS.forEach(function (d) {
        var nx = cx + d[0], ny = cy + d[1];
        if (isLattice(nx, ny) && !visited[key(nx, ny)]) neighbors.push([nx, ny, d]);
      });
      if (neighbors.length === 0) {
        stack.pop();
        continue;
      }
      var pick = neighbors[Math.floor(Math.random() * neighbors.length)];
      var nx = pick[0], ny = pick[1], d = pick[2];
      var wx = cx + d[0] / 2, wy = cy + d[1] / 2;
      grid[wy][wx] = '.';
      grid[ny][nx] = '.';
      visited[key(nx, ny)] = true;
      stack.push([nx, ny]);
    }

    return grid.map(function (r) { return r.join(''); });
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

  return {
    TOOLS: TOOLS, pixelToCell: pixelToCell, applyTool: applyTool, resizeGrid: resizeGrid,
    generateMaze: generateMaze
  };
})();
