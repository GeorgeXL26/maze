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
