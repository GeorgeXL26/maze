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

  function isWallCell(data, x, y) {
    if (x < 0 || y < 0 || x >= data.width || y >= data.height) return false;
    return data.cells[y][x] === '#';
  }

  // Bitmask of which cardinal neighbors are also wall cells (N=1, E=2, S=4, W=8).
  function wallNeighborMask(data, x, y) {
    var mask = 0;
    if (isWallCell(data, x, y - 1)) mask |= 1; // N
    if (isWallCell(data, x + 1, y)) mask |= 2; // E
    if (isWallCell(data, x, y + 1)) mask |= 4; // S
    if (isWallCell(data, x - 1, y)) mask |= 8; // W
    return mask;
  }

  // Auto-tiling: the KayKit wall models are directional pieces (straight
  // panel, L corner, T split, 4-way crossing), each with a fixed default
  // orientation. WALL_PIECE_TABLE maps every possible 4-neighbor bitmask to
  // {piece, rotationY}, derived from each model's default connection
  // direction(s) rotated in 90-degree steps. straight/corner/tsplit each
  // cover multiple masks (their possible rotations); crossing only needs
  // one entry since it is rotationally symmetric. 0- and 1-neighbor cells
  // (isolated pillar / dead end) fall back to a straight piece oriented
  // along whichever axis the single connection (if any) sits on.
  var WALL_PIECE_TABLE = {
    0: { piece: 'straight', rotationY: 0 },
    1: { piece: 'straight', rotationY: Math.PI / 2 },  // N only
    2: { piece: 'straight', rotationY: 0 },             // E only
    3: { piece: 'corner', rotationY: Math.PI },         // N+E
    4: { piece: 'straight', rotationY: Math.PI / 2 },   // S only
    5: { piece: 'straight', rotationY: Math.PI / 2 },   // N+S
    6: { piece: 'corner', rotationY: Math.PI / 2 },      // S+E
    7: { piece: 'tsplit', rotationY: Math.PI / 2 },      // N+E+S (missing W)
    8: { piece: 'straight', rotationY: 0 },              // W only
    9: { piece: 'corner', rotationY: 3 * Math.PI / 2 },  // N+W
    10: { piece: 'straight', rotationY: 0 },             // E+W
    11: { piece: 'tsplit', rotationY: Math.PI },          // N+E+W (missing S)
    12: { piece: 'corner', rotationY: 0 },                // S+W
    13: { piece: 'tsplit', rotationY: 3 * Math.PI / 2 },  // N+S+W (missing E)
    14: { piece: 'tsplit', rotationY: 0 },                // E+S+W (missing N)
    15: { piece: 'crossing', rotationY: 0 }               // all four
  };

  function computeWallPiece(data, x, y) {
    return WALL_PIECE_TABLE[wallNeighborMask(data, x, y)];
  }

  // Backward-compatible helper: rotation only, for callers that only need
  // to orient a plain straight panel (e.g. a procedural fallback box).
  function computeWallRotationY(data, x, y) {
    var vertical = (isWallCell(data, x, y - 1) || isWallCell(data, x, y + 1)) &&
                   !(isWallCell(data, x - 1, y) || isWallCell(data, x + 1, y));
    return vertical ? Math.PI / 2 : 0;
  }

  // wallTemplates, when provided, is a map of piece name -> THREE.Object3D
  // template: { straight, corner, tsplit, crossing }. When omitted, walls
  // fall back to a plain procedural box (used by tests and as a last resort).
  function buildMazeMesh(data, THREE, wallTemplates) {
    var group = new THREE.Group();
    var wallGeo = wallTemplates ? null : new THREE.BoxGeometry(1, 1.2, 1);
    for (var y = 0; y < data.height; y++) {
      for (var x = 0; x < data.width; x++) {
        if (data.cells[y][x] === '#') {
          var pieceInfo = computeWallPiece(data, x, y);
          var wall = wallTemplates
            ? wallTemplates[pieceInfo.piece].clone()
            : new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ color: 0x888899 }));
          wall.position.set(x, wallTemplates ? 0 : 0.6, y);
          wall.rotation.y = pieceInfo.rotationY;
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

  // Flood-fills walkable floor from `start` and returns a map of
  // "x,y" -> true for every reachable floor cell. Shared by
  // validateConnectivity (pass/fail summary) and the editor's overlay
  // (needs the full reachable set to shade unreachable cells).
  function reachableFloorSet(data) {
    var visited = {};
    if (!isWalkable(data, data.start.x, data.start.y)) return visited;
    var startKey = data.start.x + ',' + data.start.y;
    visited[startKey] = true;
    var queue = [[data.start.x, data.start.y]];
    var dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (queue.length) {
      var cur = queue.shift();
      for (var i = 0; i < dirs.length; i++) {
        var nx = cur[0] + dirs[i][0], ny = cur[1] + dirs[i][1];
        var key = nx + ',' + ny;
        if (!visited[key] && isWalkable(data, nx, ny)) {
          visited[key] = true;
          queue.push([nx, ny]);
        }
      }
    }
    return visited;
  }

  // Reports whether `exit` is reachable from `start`, plus the ids of any
  // items that are not. Used by the editor's validator; unreachable items
  // are treated as a warning, not an error, since sealed-off pockets can be
  // an intentional part of a level design.
  function validateConnectivity(data) {
    var visited = reachableFloorSet(data);
    var result = { exitReachable: false, unreachableItems: [] };
    result.exitReachable = !!visited[data.exit.x + ',' + data.exit.y];
    result.unreachableItems = data.items
      .filter(function (it) { return !visited[it.x + ',' + it.y]; })
      .map(function (it) { return it.id; });
    return result;
  }

  return {
    parseCells: parseCells,
    validateMazeData: validateMazeData,
    isWalkable: isWalkable,
    buildMazeMesh: buildMazeMesh,
    computeWallRotationY: computeWallRotationY,
    wallNeighborMask: wallNeighborMask,
    computeWallPiece: computeWallPiece,
    validateConnectivity: validateConnectivity,
    reachableFloorSet: reachableFloorSet
  };
})();
