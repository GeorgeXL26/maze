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

  return {
    computeMove: computeMove,
    resolveCollision: resolveCollision,
    findNearbyTorch: findNearbyTorch,
    findNearbyItem: findNearbyItem,
    checkWin: checkWin
  };
})();
