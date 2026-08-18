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

  return {
    parseCells: parseCells,
    validateMazeData: validateMazeData,
    isWalkable: isWalkable,
    buildMazeMesh: buildMazeMesh
  };
})();
