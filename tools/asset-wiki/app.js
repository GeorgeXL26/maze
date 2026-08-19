// tools/asset-wiki/app.js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

var state = { view: 'pack', search: '', catalog: [], audio: null };
var mainEl = document.getElementById('main');
var searchEl = document.getElementById('search');

function el(tag, attrs, children) {
  var e = document.createElement(tag);
  Object.keys(attrs || {}).forEach(function (k) {
    var v = attrs[k];
    if (v === null || v === undefined) return;
    if (k === 'text') e.textContent = v;
    else e.setAttribute(k, v);
  });
  (children || []).forEach(function (c) { if (c) e.appendChild(c); });
  return e;
}

// ---------------------------------------------------------------------
// three.js: shared model loading + thumbnail snapshots + interactive
// modal viewer. All model paths come straight from each catalog entry's
// existing `path` field — no separate thumbnail data needed, since
// everything renders live in the visitor's own browser (same GLTFLoader
// pattern game.html/editor.html already use).
// ---------------------------------------------------------------------
var gltfLoader = new GLTFLoader();
var gltfCache = {}; // path -> Promise<gltf>

function loadGltf(path) {
  if (!gltfCache[path]) gltfCache[path] = gltfLoader.loadAsync(path);
  return gltfCache[path];
}

// Centers and frames the camera on `obj`'s bounding sphere. Ported from
// the thumbnail-harness approach used for Phase 2's decoration props —
// same fit logic, reused here for both the small list snapshots and the
// larger interactive viewer.
function frameObject(camera, obj, marginFactor) {
  var box = new THREE.Box3().setFromObject(obj);
  var center = box.getCenter(new THREE.Vector3());
  var sphere = box.getBoundingSphere(new THREE.Sphere());
  var radius = Math.max(sphere.radius, 0.05);
  var dir = new THREE.Vector3(1, 1, 1).normalize();
  var distance = radius * (marginFactor || 2.4);
  camera.position.copy(center).addScaledVector(dir, distance);
  camera.near = distance * 0.05;
  camera.far = distance * 10;
  camera.updateProjectionMatrix();
  camera.lookAt(center);
  return center;
}

function addStandardLights(scene) {
  var ambient = new THREE.AmbientLight(0xffffff, 2.0);
  scene.add(ambient);
  var dirLight = new THREE.DirectionalLight(0xffffff, 1.6);
  dirLight.position.set(3, 5, 4);
  scene.add(dirLight);
}

// --- Thumbnail snapshots (list rows) ---------------------------------
var THUMB_SIZE = 96;
var thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
thumbRenderer.setSize(THUMB_SIZE, THUMB_SIZE);
var thumbScene = new THREE.Scene();
var thumbCamera = new THREE.PerspectiveCamera(35, 1, 0.05, 500);
addStandardLights(thumbScene);

var thumbnailCache = {}; // "pack::id" -> data URL (or 'failed')
var thumbInFlight = {};

function snapshotKey(entry) { return entry.pack + '::' + entry.id; }

function renderThumbnailFor(entry, imgEl) {
  var key = snapshotKey(entry);
  if (thumbnailCache[key]) {
    if (thumbnailCache[key] !== 'failed') imgEl.src = thumbnailCache[key];
    else imgEl.classList.add('thumb-missing');
    return;
  }
  if (thumbInFlight[key]) { thumbInFlight[key].push(imgEl); return; }
  thumbInFlight[key] = [imgEl];

  loadGltf(entry.path).then(function (gltf) {
    var model = gltf.scene.clone();
    thumbScene.add(model);
    frameObject(thumbCamera, model, 2.4);
    thumbRenderer.render(thumbScene, thumbCamera);
    var dataUrl = thumbRenderer.domElement.toDataURL('image/png');
    thumbScene.remove(model);
    thumbnailCache[key] = dataUrl;
    thumbInFlight[key].forEach(function (img) { img.src = dataUrl; });
    delete thumbInFlight[key];
  }).catch(function (err) {
    console.warn('Thumbnail failed for', entry.path, err);
    thumbnailCache[key] = 'failed';
    thumbInFlight[key].forEach(function (img) { img.classList.add('thumb-missing'); });
    delete thumbInFlight[key];
  });
}

// Lazily snapshots every row inside a <details> the first time it's
// expanded, rather than rendering all 281 models up front.
function wireLazyThumbnails(detailsEl, entries) {
  var done = false;
  detailsEl.addEventListener('toggle', function () {
    if (!detailsEl.open || done) return;
    done = true;
    entries.forEach(function (e) {
      var img = detailsEl.querySelector('img.thumb[data-key="' + snapshotKey(e) + '"]');
      if (img) renderThumbnailFor(e, img);
    });
  });
}

// --- Interactive modal viewer ------------------------------------------
var viewerModal = document.getElementById('viewerModal');
var viewerCanvasWrap = document.getElementById('viewerCanvasWrap');
var viewerLabel = document.getElementById('viewerLabel');
var viewerCloseBtn = document.getElementById('viewerClose');

var viewerRenderer = null;
var viewerScene = null;
var viewerCamera = null;
var viewerControls = null;
var viewerMixer = null;
var viewerClock = new THREE.Clock();
var viewerRafId = null;
var viewerCurrentModel = null;

function ensureViewer() {
  if (viewerRenderer) return;
  viewerRenderer = new THREE.WebGLRenderer({ antialias: true });
  viewerRenderer.setSize(480, 480);
  viewerCanvasWrap.appendChild(viewerRenderer.domElement);

  viewerScene = new THREE.Scene();
  viewerScene.background = new THREE.Color(0x14141a);
  addStandardLights(viewerScene);

  viewerCamera = new THREE.PerspectiveCamera(40, 1, 0.05, 500);
  viewerControls = new OrbitControls(viewerCamera, viewerRenderer.domElement);
  viewerControls.enableDamping = true;
}

function stopViewerLoop() {
  if (viewerRafId !== null) { cancelAnimationFrame(viewerRafId); viewerRafId = null; }
}

function viewerLoop() {
  viewerRafId = requestAnimationFrame(viewerLoop);
  var delta = viewerClock.getDelta();
  if (viewerMixer) viewerMixer.update(delta);
  viewerControls.update();
  viewerRenderer.render(viewerScene, viewerCamera);
}

function openViewer(entry) {
  ensureViewer();
  viewerLabel.textContent = entry.label + ' (' + entry.pack + '/' + entry.category + ')';
  viewerModal.classList.remove('hidden');

  if (viewerCurrentModel) { viewerScene.remove(viewerCurrentModel); viewerCurrentModel = null; }
  viewerMixer = null;

  loadGltf(entry.path).then(function (gltf) {
    var model = gltf.scene.clone();
    viewerScene.add(model);
    viewerCurrentModel = model;
    var center = frameObject(viewerCamera, model, 2.8);
    viewerControls.target.copy(center);
    viewerControls.update();

    // Animation-clip entries (kaykit-character-animations, plus the two
    // duplicated clips under kaykit-adventurers/animations/) carry a `rig`
    // field — for those, actually play the clip instead of showing a
    // static bind pose, since the interactive viewer has a running render
    // loop to drive it.
    if (entry.rig && gltf.animations && gltf.animations.length > 0) {
      viewerMixer = new THREE.AnimationMixer(model);
      viewerMixer.clipAction(gltf.animations[0]).play();
    }
  }).catch(function (err) {
    console.warn('Viewer load failed for', entry.path, err);
    viewerLabel.textContent = entry.label + ' — failed to load model';
  });

  viewerClock.start();
  stopViewerLoop();
  viewerLoop();
}

function closeViewer() {
  viewerModal.classList.add('hidden');
  stopViewerLoop();
}

viewerCloseBtn.addEventListener('click', closeViewer);
viewerModal.addEventListener('click', function (e) { if (e.target === viewerModal) closeViewer(); });
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape' && !viewerModal.classList.contains('hidden')) closeViewer();
});

// ---------------------------------------------------------------------
// List rendering (by pack / by status / audio)
// ---------------------------------------------------------------------
function matchesSearch(entry) {
  if (!state.search) return true;
  return entry.label.toLowerCase().indexOf(state.search) !== -1;
}

function badgesFor(entry) {
  var badges = [el('span', { class: 'badge ' + entry.status, text: entry.status })];
  if (entry.phaseTag) {
    badges.push(el('span', { class: 'badge phase', text: 'Phase ' + entry.phaseTag.phase + ' — ' + entry.phaseTag.note }));
  }
  return badges;
}

function thumbImgFor(entry) {
  var thumb = el('img', { class: 'thumb', 'data-key': snapshotKey(entry), alt: entry.label });
  thumb.addEventListener('click', function () { openViewer(entry); });
  return thumb;
}

// Used in the By-pack view, where rows already sit inside a pack/category
// <details> — the row itself just needs the item's own label.
function rowFor(entry) {
  return el('div', { class: 'row' }, [
    thumbImgFor(entry),
    el('span', { text: entry.label }),
    el('span', { class: 'path', text: entry.path })
  ].concat(badgesFor(entry)));
}

// Used in the By-status view, which is flat (no pack/category grouping) —
// each row spells out pack/category inline so that context isn't lost.
function rowForStatus(entry) {
  return el('div', { class: 'row' }, [
    thumbImgFor(entry),
    el('span', { text: entry.label + ' — ' + entry.pack + '/' + entry.category }),
    el('span', { class: 'path', text: entry.path })
  ].concat(entry.phaseTag ? [el('span', { class: 'badge phase', text: 'Phase ' + entry.phaseTag.phase + ' — ' + entry.phaseTag.note })] : []));
}

function renderByPack() {
  var byPack = {};
  state.catalog.filter(matchesSearch).forEach(function (e) {
    var packKey = e.pack + (e.rig ? ' / ' + e.rig : '');
    if (!byPack[packKey]) byPack[packKey] = {};
    if (!byPack[packKey][e.category]) byPack[packKey][e.category] = [];
    byPack[packKey][e.category].push(e);
  });
  var frag = document.createDocumentFragment();
  Object.keys(byPack).sort().forEach(function (packKey) {
    var packDetails = el('details', { class: 'pack', open: state.search ? 'true' : null });
    packDetails.appendChild(el('summary', { text: packKey }));
    Object.keys(byPack[packKey]).sort().forEach(function (cat) {
      var entries = byPack[packKey][cat];
      var catDetails = el('details', { class: 'category', open: state.search ? 'true' : null });
      catDetails.appendChild(el('summary', { text: cat + ' (' + entries.length + ')' }));
      entries.forEach(function (e) { catDetails.appendChild(rowFor(e)); });
      packDetails.appendChild(catDetails);
      wireLazyThumbnails(catDetails, entries);
      if (catDetails.open) catDetails.dispatchEvent(new Event('toggle'));
    });
    frag.appendChild(packDetails);
  });
  mainEl.innerHTML = '';
  mainEl.appendChild(frag);
}

function renderByStatus() {
  var groups = { 'wired-in': [], 'unused': [] };
  state.catalog.filter(matchesSearch).forEach(function (e) { groups[e.status].push(e); });
  var frag = document.createDocumentFragment();
  ['wired-in', 'unused'].forEach(function (status) {
    var details = el('details', { class: 'pack', open: 'true' });
    details.appendChild(el('summary', { text: status + ' (' + groups[status].length + ')' }));
    groups[status].forEach(function (e) {
      details.appendChild(rowForStatus(e));
    });
    frag.appendChild(details);
    wireLazyThumbnails(details, groups[status]);
    details.dispatchEvent(new Event('toggle'));
  });
  mainEl.innerHTML = '';
  mainEl.appendChild(frag);
}

function renderAudio() {
  if (!state.audio) { mainEl.textContent = 'Loading…'; return; }
  var frag = document.createDocumentFragment();
  state.audio.packs.forEach(function (p) {
    var details = el('details', { class: 'pack', open: 'true' });
    details.appendChild(el('summary', { text: p.pack + ' (' + p.files.length + ')' }));
    if (p.readmeHtml) {
      var readme = el('div', { class: 'readme' });
      readme.innerHTML = p.readmeHtml;
      details.appendChild(readme);
    }
    p.files.forEach(function (f) {
      var row = el('div', { class: 'row' }, [el('span', { text: f.file })]);
      var audioEl = document.createElement('audio');
      audioEl.controls = true;
      audioEl.src = encodeURI(f.path);
      row.appendChild(audioEl);
      details.appendChild(row);
    });
    frag.appendChild(details);
  });
  Object.keys(state.audio.extra).forEach(function (key) {
    var details = el('details', { class: 'pack', open: 'true' });
    details.appendChild(el('summary', { text: key }));
    var readme = el('div', { class: 'readme' });
    readme.innerHTML = state.audio.extra[key];
    details.appendChild(readme);
    frag.appendChild(details);
  });
  mainEl.innerHTML = '';
  mainEl.appendChild(frag);
}

function render() {
  document.querySelectorAll('.tabs button').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
  searchEl.classList.toggle('hidden', state.view === 'audio');
  if (state.view === 'pack') renderByPack();
  else if (state.view === 'status') renderByStatus();
  else renderAudio();
}

document.querySelectorAll('.tabs button').forEach(function (btn) {
  btn.addEventListener('click', function () { state.view = btn.dataset.view; render(); });
});
searchEl.addEventListener('input', function () {
  state.search = searchEl.value.trim().toLowerCase();
  render();
});

Promise.all([
  fetch('/api/catalog').then(function (r) { return r.json(); }),
  fetch('/api/audio').then(function (r) { return r.json(); })
]).then(function (results) {
  state.catalog = results[0];
  state.audio = results[1];
  render();
});
