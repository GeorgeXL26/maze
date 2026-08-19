// tools/asset-wiki/app.js
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

function rowFor(entry) {
  return el('div', { class: 'row' }, [
    el('span', { text: entry.label }),
    el('span', { class: 'path', text: entry.path })
  ].concat(badgesFor(entry)));
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
      var children = [
        el('span', { text: e.label + ' — ' + e.pack + '/' + e.category }),
        el('span', { class: 'path', text: e.path })
      ];
      if (e.phaseTag) {
        children.push(el('span', { class: 'badge phase', text: 'Phase ' + e.phaseTag.phase + ' — ' + e.phaseTag.note }));
      }
      details.appendChild(el('div', { class: 'row' }, children));
    });
    frag.appendChild(details);
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
