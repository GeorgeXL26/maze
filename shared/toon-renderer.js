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

  return {
    createGradientMap: createGradientMap,
    createToonMaterial: createToonMaterial,
    createOutlineMesh: createOutlineMesh,
    createFollowCamera: createFollowCamera,
    updateFollowCamera: updateFollowCamera
  };
})();
