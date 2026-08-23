// tools/asset-wiki/test-logic.js
// Run: node tools/asset-wiki/test-logic.js
// Node-side equivalent of tests/logic-tests.html's assert pattern, for this
// feature's pure logic (plain Node/CommonJS — can't run through that
// browser-only harness, see design spec Global Constraints).
var lib = require('./lib.js');

var results = [];
function assertEqual(actual, expected, label) {
  var pass = JSON.stringify(actual) === JSON.stringify(expected);
  results.push((pass ? 'PASS' : 'FAIL') + ' — ' + label +
    (pass ? '' : ' (expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual) + ')'));
}
function assertTrue(actual, label) { assertEqual(!!actual, true, label); }

// humanize
assertEqual(lib.humanize('banner_red'), 'Banner Red', 'humanize: underscores become spaces, each word capitalized');
assertEqual(lib.humanize('wall'), 'Wall', 'humanize: single word');

// categoryForFile
assertEqual(lib.categoryForFile('banner_red'), 'banner', 'categoryForFile: leading token before first underscore');
assertEqual(lib.categoryForFile('sword_2handed'), 'sword', 'categoryForFile: leading token, no prefix strip needed');
assertEqual(lib.categoryForFile('Skeleton_Mage', 'Skeleton'), 'mage', 'categoryForFile: strips redundant pack-noun prefix before taking leading token');
assertEqual(lib.categoryForFile('Skeleton_Shield_Large_A', 'Skeleton'), 'shield', 'categoryForFile: prefix-strip then leading token on a multi-word remainder');
assertEqual(lib.categoryForFile('Knight'), 'knight', 'categoryForFile: filename with no underscore becomes its own category');

// animationRigAndClip
assertEqual(lib.animationRigAndClip('Rig_Large_CombatMelee'), { rig: 'Rig_Large', category: 'combatmelee' }, 'animationRigAndClip: splits rig from clip name');
assertEqual(lib.animationRigAndClip('Rig_Medium_MovementBasic'), { rig: 'Rig_Medium', category: 'movementbasic' }, 'animationRigAndClip: works for the Medium rig too');
assertEqual(lib.animationRigAndClip('banner_red'), null, 'animationRigAndClip: returns null for non-Rig filenames');

// isWiredIn
var sources = ['<script src="assets/kaykit-dungeon/gltf/wall.gltf"></script>', 'some other text'];
assertTrue(lib.isWiredIn('assets/kaykit-dungeon/gltf/wall.gltf', sources), 'isWiredIn: true when the path appears verbatim in a source text');
assertEqual(lib.isWiredIn('assets/kaykit-dungeon/gltf/banner_red.gltf', sources), false, 'isWiredIn: false when the path appears in none of the source texts');

// phaseTagFor
var tags = [{ pack: 'kaykit-dungeon', category: 'chest', phase: 2, note: 'key/chest puzzle chain' }];
assertEqual(lib.phaseTagFor('kaykit-dungeon', 'chest', tags), { phase: 2, note: 'key/chest puzzle chain' }, 'phaseTagFor: returns the matching tag');
assertEqual(lib.phaseTagFor('kaykit-dungeon', 'banner', tags), null, 'phaseTagFor: returns null when pack+category has no tag');

// mdLiteToHtml
assertEqual(lib.mdLiteToHtml('## Title\n- one\n- two\n\n**bold** and `code`'),
  '<h2>Title</h2>\n<ul>\n<li>one</li>\n<li>two</li>\n</ul>\n<p><strong>bold</strong> and <code>code</code></p>',
  'mdLiteToHtml: headers, bullet lists, bold, and code spans');

// splitReadmeByPack
var fixtureReadme = [
  '# Audio',
  '',
  'Intro text, ignored (not under any heading).',
  '',
  '## Packs',
  '',
  '### `kenney-rpg-audio/`',
  '56 RPG foley sounds, CC0.',
  '',
  '- **Collect item:** `handleCoins.ogg`',
  '',
  '### `spooky-playtime-davidkbd/`',
  '10 full music tracks. **CC BY 4.0, attribution required.**',
  '',
  '## Known gap',
  '',
  'Torch-ignite sound effect not sourced yet.'
].join('\n');
var split = lib.splitReadmeByPack(fixtureReadme);
assertTrue(split.packs['kenney-rpg-audio'].indexOf('CC0') !== -1, 'splitReadmeByPack: captures the kenney-rpg-audio section');
assertTrue(split.packs['spooky-playtime-davidkbd'].indexOf('CC BY 4.0') !== -1, 'splitReadmeByPack: captures the spooky-playtime-davidkbd section');
assertTrue(split.extra['Known gap'].indexOf('Torch-ignite') !== -1, 'splitReadmeByPack: captures the trailing Known gap section separately from any pack');

// scan.js: buildModelCatalog / readSourceTexts / withStatusAndTags
var path = require('path');
var scan = require('./scan.js');
var REPO_ROOT = path.join(__dirname, '..', '..');

var modelEntries = scan.buildModelCatalog(REPO_ROOT);
assertEqual(modelEntries.length, 281,
  'buildModelCatalog: total entries across all 4 packs (investigate before continuing if this differs — a file was likely added/removed from assets/ since this plan was written)');

var byPack = {};
modelEntries.forEach(function (e) { byPack[e.pack] = (byPack[e.pack] || 0) + 1; });
assertEqual(byPack['kaykit-dungeon'], 211, 'buildModelCatalog: kaykit-dungeon count');
assertEqual(byPack['kaykit-adventurers'], 39, 'buildModelCatalog: kaykit-adventurers count (6 characters + 31 equipment + 2 duplicated animation clips)');
assertEqual(byPack['kaykit-skeletons'], 17, 'buildModelCatalog: kaykit-skeletons count (4 characters + 13 equipment)');
assertEqual(byPack['kaykit-character-animations'], 14, 'buildModelCatalog: kaykit-character-animations count (6 Rig_Large + 8 Rig_Medium clips)');

var skeletonCategories = modelEntries.filter(function (e) { return e.pack === 'kaykit-skeletons'; }).map(function (e) { return e.category; });
assertTrue(skeletonCategories.indexOf('skeleton') === -1, 'buildModelCatalog: skeleton pack-noun prefix is stripped — no entry falls into a generic "skeleton" category');
assertTrue(skeletonCategories.indexOf('mage') !== -1, 'buildModelCatalog: Skeleton_Mage.glb becomes category "mage"');

var animEntry = modelEntries.filter(function (e) { return e.id === 'Rig_Large_CombatMelee'; })[0];
assertEqual(animEntry.rig, 'Rig_Large', 'buildModelCatalog: animation clip entries carry a rig field');
assertEqual(animEntry.category, 'combatmelee', 'buildModelCatalog: animation clip entries derive category from the clip name');

var sourceTexts = scan.readSourceTexts(REPO_ROOT);
var withStatus = scan.withStatusAndTags(modelEntries, sourceTexts, []);
var wiredIn = withStatus.filter(function (e) { return e.status === 'wired-in'; });
assertEqual(wiredIn.length, 22,
  'withStatusAndTags: exactly the 22 paths currently referenced in game.html/editor.html are wired-in (investigate before continuing if this differs — game.html/editor.html were likely edited since this plan was written)');
assertTrue(wiredIn.map(function (e) { return e.id; }).indexOf('wall') !== -1, 'withStatusAndTags: the wall model is wired-in');
assertTrue(wiredIn.map(function (e) { return e.id; }).indexOf('banner_red') !== -1, 'withStatusAndTags: banner_red is wired-in (used as the exit flag in game.html)');
['Knight', 'Barbarian', 'Mage', 'Ranger', 'Rogue'].forEach(function (id) {
  assertTrue(wiredIn.map(function (e) { return e.id; }).indexOf(id) !== -1, 'withStatusAndTags: ' + id + ' is wired-in (selectable hero in game.html)');
});
assertTrue(withStatus.filter(function (e) { return e.id === 'chest'; })[0].status === 'unused', 'withStatusAndTags: a never-referenced model (chest) is unused');

// phase-tags.js: curated data sanity checks
var phaseTags = require('./phase-tags.js');
assertTrue(phaseTags.length >= 30, 'phase-tags.js: has a substantial number of curated entries');
var badPhaseTag = phaseTags.filter(function (t) { return t.phase < 2 || t.phase > 6 || !t.note; })[0];
assertEqual(badPhaseTag, undefined, 'phase-tags.js: every entry has a phase in 2..6 and a non-empty note');

var taggedEntries = scan.withStatusAndTags(modelEntries, sourceTexts, phaseTags);
var chest = taggedEntries.filter(function (e) { return e.id === 'chest'; })[0];
assertEqual(chest.phaseTag, { phase: 2, note: 'key/chest puzzle chain — chest reveals an item' }, 'phase-tags.js: kaykit-dungeon/chest is tagged Phase 2');
var skeletonMinion = taggedEntries.filter(function (e) { return e.id === 'Skeleton_Minion'; })[0];
assertEqual(skeletonMinion.phaseTag.phase, 4, 'phase-tags.js: the skeleton minion character is tagged Phase 4');
var untaggedCategoryCount = taggedEntries.filter(function (e) { return e.category === 'mug'; }).filter(function (e) { return e.phaseTag !== null; }).length;
assertEqual(untaggedCategoryCount, 0, 'phase-tags.js: categories with no curated entry (e.g. mug) stay untagged rather than guessing');

// scan.js: buildAudioCatalog
var audioCatalog = scan.buildAudioCatalog(REPO_ROOT);
var audioByPack = {};
audioCatalog.packs.forEach(function (p) { audioByPack[p.pack] = p.files.length; });
assertEqual(audioByPack['16bit-retro-music-collection'], 13, 'buildAudioCatalog: 16bit-retro-music-collection file count');
assertEqual(audioByPack['kenney-rpg-audio'], 51, 'buildAudioCatalog: kenney-rpg-audio file count');
assertEqual(audioByPack['spooky-playtime-davidkbd'], 10, 'buildAudioCatalog: spooky-playtime-davidkbd file count');
assertEqual(audioByPack['kenney-music-jingles'], 85,
  'buildAudioCatalog: kenney-music-jingles file count — this pack nests files one level deeper in style subfolders (e.g. "8-Bit jingles/"), so a flat (non-recursive) directory read would wrongly return 0');

var kenneyPack = audioCatalog.packs.filter(function (p) { return p.pack === 'kenney-rpg-audio'; })[0];
assertTrue(kenneyPack.readmeHtml.indexOf('CC0') !== -1, 'buildAudioCatalog: readmeHtml is populated from the real README.md, per pack');
assertTrue(audioCatalog.extra['Known gap'].indexOf('Torch-ignite') !== -1, 'buildAudioCatalog: the trailing "Known gap" section is captured separately from any pack');

var jingleFile = audioCatalog.packs.filter(function (p) { return p.pack === 'kenney-music-jingles'; })[0].files[0];
assertTrue(jingleFile.path.indexOf('assets/audio/kenney-music-jingles/') === 0, 'buildAudioCatalog: nested jingle file paths still start with the pack path');

// --- TASK 2/3/4 TESTS GET APPENDED ABOVE THIS LINE ---

var failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; });
results.forEach(function (r) { console.log(r); });
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
if (failed.length > 0) process.exit(1);
