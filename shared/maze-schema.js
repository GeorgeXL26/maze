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
