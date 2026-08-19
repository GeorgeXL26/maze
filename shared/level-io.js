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
