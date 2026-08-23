// shared/bgm.js
// Background music + a shared settings picker (gear icon, top-right) used
// by every page. The chosen track is a sitewide preference (localStorage),
// not per-page — once you pick one anywhere, it plays everywhere until you
// change it again. Each page still owns its own <audio> instance (mount()
// returns it) since game.html needs to pause it on win; this module only
// owns the track list, the picker UI, and which track is "selected".
window.BGM = (function () {
  var STORAGE_KEY = 'torch-maze-bgm-track';

  // Curated per assets/audio/README.md's own noted BGM picks — not the
  // full 85+-file library, just the tracks already vetted as good fits.
  var TRACKS = [
    { id: 'pixel-triumph', label: 'Pixel Triumph', path: '16bit-retro-music-collection/Pixel Triumph.m4a' },
    { id: 'victory-arc', label: 'Victory Arc', path: '16bit-retro-music-collection/Victory Arc.m4a' },
    { id: 'ghostly-grooves', label: 'Ghostly Grooves', path: 'spooky-playtime-davidkbd/DavidKBD---Spooky-Pack---Spooky-Playtime-01---Ghostly-Grooves.ogg' },
    { id: 'whispers-of-darkness', label: 'Whispers of Darkness', path: 'spooky-playtime-davidkbd/DavidKBD---Spooky-Pack---Spooky-Playtime-08---Whispers-of-Darkness.ogg' },
    { id: 'labyrinth', label: 'Labyrinth', path: 'spooky-playtime-davidkbd/DavidKBD---Spooky-Pack---Spooky-Playtime-10---Labyrinth.ogg' },
    { id: 'haunted-mansion', label: 'Haunted Mansion', path: 'spooky-playtime-davidkbd/DavidKBD---Spooky-Pack---Spooky-Playtime-03---Haunted-Mansion.ogg' }
  ];

  function trackById(id) {
    for (var i = 0; i < TRACKS.length; i++) if (TRACKS[i].id === id) return TRACKS[i];
    return null;
  }

  function getSelectedTrack(defaultId) {
    var saved = trackById(localStorage.getItem(STORAGE_KEY));
    return saved || trackById(defaultId) || TRACKS[0];
  }

  function setSelectedTrackId(id) {
    localStorage.setItem(STORAGE_KEY, id);
  }

  function playPath(audio, relPath) {
    audio.src = encodeURI('assets/audio/' + relPath);
    var tryPlay = function () { return audio.play(); };
    tryPlay().catch(function () {
      var retry = function () {
        tryPlay().catch(function () {});
        window.removeEventListener('pointerdown', retry);
        window.removeEventListener('keydown', retry);
      };
      window.addEventListener('pointerdown', retry);
      window.addEventListener('keydown', retry);
    });
  }

  function injectStyles() {
    if (document.getElementById('bgm-settings-style')) return;
    var style = document.createElement('style');
    style.id = 'bgm-settings-style';
    style.textContent =
      '#bgmSettingsBtn { position: fixed; top: 14px; right: 14px; z-index: 20;' +
      '  width: 38px; height: 38px; border-radius: 50%; font-size: 17px; line-height: 1;' +
      '  display: flex; align-items: center; justify-content: center; cursor: pointer;' +
      '  color: #ece1c8; background: linear-gradient(180deg, rgba(30,26,20,0.85), rgba(14,12,9,0.9));' +
      '  border: 1px solid rgba(236,225,200,0.22);' +
      '  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease; }' +
      '#bgmSettingsBtn:hover { border-color: #ffab52; box-shadow: 0 0 16px -2px #ffab52; transform: translateY(-1px); }' +
      '#bgmSettingsPanel { position: fixed; top: 58px; right: 14px; z-index: 20; min-width: 200px;' +
      '  background: linear-gradient(180deg, rgba(30,26,20,0.95), rgba(14,12,9,0.97));' +
      '  border: 1px solid rgba(236,225,200,0.22); border-radius: 10px; padding: 10px;' +
      '  font-family: "Manrope", sans-serif; }' +
      '#bgmSettingsPanel.hidden { display: none; }' +
      '#bgmSettingsPanel .bgm-title { font-size: 11px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;' +
      '  color: #ffab52; margin: 2px 8px 8px; }' +
      '#bgmSettingsPanel .bgm-track { display: block; width: 100%; text-align: left; background: none; border: none;' +
      '  color: #ece1c8; font-family: inherit; font-size: 13px; padding: 7px 8px; border-radius: 6px; cursor: pointer; }' +
      '#bgmSettingsPanel .bgm-track:hover { background: rgba(236,225,200,0.08); }' +
      '#bgmSettingsPanel .bgm-track.active { background: rgba(255,171,82,0.16); color: #ffd08a; font-weight: 600; }';
    document.head.appendChild(style);
  }

  function buildUI(audio) {
    injectStyles();

    var btn = document.createElement('button');
    btn.id = 'bgmSettingsBtn';
    btn.type = 'button';
    btn.title = 'Music settings';
    btn.textContent = '⚙️';
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.id = 'bgmSettingsPanel';
    panel.className = 'hidden';
    var title = document.createElement('div');
    title.className = 'bgm-title';
    title.textContent = 'Music';
    panel.appendChild(title);

    var rows = {};
    TRACKS.forEach(function (track) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'bgm-track';
      row.textContent = track.label;
      row.addEventListener('click', function () {
        setSelectedTrackId(track.id);
        Object.keys(rows).forEach(function (id) { rows[id].classList.toggle('active', id === track.id); });
        playPath(audio, track.path);
      });
      rows[track.id] = row;
      panel.appendChild(row);
    });
    document.body.appendChild(panel);

    btn.addEventListener('click', function () { panel.classList.toggle('hidden'); });
    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && e.target !== btn) panel.classList.add('hidden');
    });

    return rows;
  }

  // Starts the shared-preference track looping (or `defaultId` if nothing
  // has been chosen yet on this site before), and mounts the gear icon +
  // picker. Returns the <audio> element so the caller can control it
  // further (game.html pauses it on win).
  function mount(defaultId, volume) {
    var audio = new Audio();
    audio.loop = true;
    audio.volume = volume === undefined ? 0.5 : volume;

    var selected = getSelectedTrack(defaultId);
    playPath(audio, selected.path);

    var rows = buildUI(audio);
    if (rows[selected.id]) rows[selected.id].classList.add('active');

    return audio;
  }

  return { TRACKS: TRACKS, getSelectedTrack: getSelectedTrack, mount: mount };
})();
