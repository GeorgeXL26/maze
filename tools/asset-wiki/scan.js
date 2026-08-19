// tools/asset-wiki/scan.js
// Filesystem-dependent catalog builders. Pure logic lives in lib.js — this
// file just walks assets/ and the game/editor source, and hands filenames
// to that logic.
var fs = require('fs');
var path = require('path');
var lib = require('./lib.js');

function listModelFiles(dir) {
  return fs.readdirSync(dir).filter(function (f) { return /\.(gltf|glb)$/i.test(f); }).sort();
}

function packEntries(rootDir, pack, dir, relPrefix, opts) {
  opts = opts || {};
  var files = listModelFiles(path.join(rootDir, dir));
  return files.map(function (file) {
    var id = file.replace(/\.(gltf|glb)$/i, '');
    var category = lib.categoryForFile(id, opts.stripPrefix);
    return {
      id: id, label: lib.humanize(id), pack: pack, category: category,
      path: relPrefix + '/' + file
    };
  });
}

function animationEntries(rootDir, pack, dir, relPrefix) {
  var files = listModelFiles(path.join(rootDir, dir));
  return files.map(function (file) {
    var id = file.replace(/\.(gltf|glb)$/i, '');
    var rc = lib.animationRigAndClip(id);
    return {
      id: id, label: lib.humanize(id), pack: pack,
      rig: rc ? rc.rig : null,
      category: rc ? rc.category : lib.categoryForFile(id),
      path: relPrefix + '/' + file
    };
  });
}

// Covers all four visual packs, including the "characters" vs. "assets"
// (equipment) subfolder split in kaykit-adventurers/kaykit-skeletons, and
// the two animation clips vendored a second time directly under
// kaykit-adventurers/animations/ (duplicates of files also in
// kaykit-character-animations, referenced by game.html under that separate
// path — both copies are listed, since both are real files on disk).
function buildModelCatalog(rootDir) {
  var entries = [].concat(
    packEntries(rootDir, 'kaykit-dungeon', 'assets/kaykit-dungeon/gltf', 'assets/kaykit-dungeon/gltf'),
    packEntries(rootDir, 'kaykit-adventurers', 'assets/kaykit-adventurers/characters', 'assets/kaykit-adventurers/characters'),
    packEntries(rootDir, 'kaykit-adventurers', 'assets/kaykit-adventurers/assets', 'assets/kaykit-adventurers/assets'),
    animationEntries(rootDir, 'kaykit-adventurers', 'assets/kaykit-adventurers/animations', 'assets/kaykit-adventurers/animations'),
    packEntries(rootDir, 'kaykit-skeletons', 'assets/kaykit-skeletons/characters', 'assets/kaykit-skeletons/characters', { stripPrefix: 'Skeleton' }),
    packEntries(rootDir, 'kaykit-skeletons', 'assets/kaykit-skeletons/assets', 'assets/kaykit-skeletons/assets', { stripPrefix: 'Skeleton' }),
    animationEntries(rootDir, 'kaykit-character-animations', 'assets/kaykit-character-animations/gltf/Rig_Large', 'assets/kaykit-character-animations/gltf/Rig_Large'),
    animationEntries(rootDir, 'kaykit-character-animations', 'assets/kaykit-character-animations/gltf/Rig_Medium', 'assets/kaykit-character-animations/gltf/Rig_Medium')
  );

  var seen = {};
  entries.forEach(function (e) {
    var key = e.pack + '::' + e.path;
    if (seen[key]) throw new Error('Duplicate catalog entry: ' + key);
    seen[key] = true;
  });

  return entries;
}

function readSourceTexts(rootDir) {
  var texts = [
    fs.readFileSync(path.join(rootDir, 'game.html'), 'utf8'),
    fs.readFileSync(path.join(rootDir, 'editor.html'), 'utf8')
  ];
  var sharedDir = path.join(rootDir, 'shared');
  fs.readdirSync(sharedDir).filter(function (f) { return /\.js$/.test(f); }).forEach(function (f) {
    texts.push(fs.readFileSync(path.join(sharedDir, f), 'utf8'));
  });
  return texts;
}

function withStatusAndTags(entries, sourceTexts, phaseTags) {
  return entries.map(function (e) {
    var tag = lib.phaseTagFor(e.pack, e.category, phaseTags);
    return {
      id: e.id, label: e.label, pack: e.pack, category: e.category,
      rig: e.rig || undefined, path: e.path,
      status: lib.isWiredIn(e.path, sourceTexts) ? 'wired-in' : 'unused',
      phaseTag: tag
    };
  });
}

// Some packs (kenney-music-jingles) nest their audio files a level deeper,
// grouped into style subfolders ("Steel jingles/", "Sax jingles/", ...)
// rather than sitting flat in the pack directory — so this walks the whole
// pack subtree instead of assuming a flat list. (Caught during planning:
// a flat readdirSync on kenney-music-jingles returns 0 files.)
function listAudioFilesRecursive(dir, relPrefix) {
  var out = [];
  fs.readdirSync(dir).sort().forEach(function (name) {
    var full = path.join(dir, name);
    var rel = relPrefix + '/' + name;
    if (fs.statSync(full).isDirectory()) {
      out = out.concat(listAudioFilesRecursive(full, rel));
    } else if (/\.(ogg|m4a|mp3|wav)$/i.test(name)) {
      out.push({ file: name, path: rel });
    }
  });
  return out;
}

function buildAudioCatalog(rootDir) {
  var audioDir = path.join(rootDir, 'assets/audio');
  var packDirs = fs.readdirSync(audioDir).filter(function (name) {
    return fs.statSync(path.join(audioDir, name)).isDirectory();
  }).sort();

  var readme = fs.readFileSync(path.join(audioDir, 'README.md'), 'utf8');
  var split = lib.splitReadmeByPack(readme);

  var packs = packDirs.map(function (packName) {
    var dir = path.join(audioDir, packName);
    var files = listAudioFilesRecursive(dir, 'assets/audio/' + packName);
    return {
      pack: packName,
      readmeHtml: split.packs[packName] ? lib.mdLiteToHtml(split.packs[packName]) : null,
      files: files
    };
  });

  var extra = {};
  Object.keys(split.extra).forEach(function (key) {
    extra[key] = lib.mdLiteToHtml(split.extra[key]);
  });

  return { packs: packs, extra: extra };
}

module.exports = {
  buildModelCatalog: buildModelCatalog,
  readSourceTexts: readSourceTexts,
  withStatusAndTags: withStatusAndTags,
  buildAudioCatalog: buildAudioCatalog
};
