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

// --- TASK 2/3/4 TESTS GET APPENDED ABOVE THIS LINE ---

var failed = results.filter(function (r) { return r.indexOf('FAIL') === 0; });
results.forEach(function (r) { console.log(r); });
console.log('\n' + (results.length - failed.length) + '/' + results.length + ' passed');
if (failed.length > 0) process.exit(1);
