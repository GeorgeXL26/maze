# Asset Library Wiki Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dev-only local page listing every vendored asset in `assets/` (dungeon props, adventurer/skeleton characters and equipment, animation clips, audio), cross-referenced against `game.html`/`editor.html`/`shared/*.js` to show wired-in vs. unused status, tagged with which future roadmap phase would plausibly use each unused item — so deciding what to build next doesn't require digging through folders by hand.

**Architecture:** A Node dev server (`tools/asset-wiki/server.js`, built-ins only) live-scans `assets/` and greps the game/editor source on every request — no generated/committed data file. Pure logic (category derivation, wired-in matching, phase-tag lookup, a tiny markdown-lite renderer) lives in a dependency-free module (`lib.js`) so it's unit-testable outside the server; filesystem-walking (`scan.js`) builds on top of it. A static front-end (`index.html` + `app.js`) fetches two JSON endpoints and renders three views (by pack, by status, audio) entirely client-side.

**Tech Stack:** Plain Node.js (built-in `http`/`fs`/`path` only, no dependencies), vanilla ES5-style JS for the browser side (`var`/`function`, matching the rest of this codebase), no build step, no framework.

**Spec:** `docs/superpowers/specs/2026-08-19-asset-wiki-design.md`

## Global Constraints

- **Dev-only tool, never deployed.** Not served from GitHub Pages, not linked from `index.html`. Run locally via `node tools/asset-wiki/server.js`.
- **Live-scanned, not generated.** No committed data file — every request recomputes the catalog from the real `assets/` tree and the real `game.html`/`editor.html`/`shared/*.js`, so it's never stale.
- **Zero dependencies.** `server.js` uses only Node's built-in `http`, `fs`, `path` modules — no `npm install`, no `package.json` needed for this feature.
- **Text/catalog only.** No thumbnails, no 3D preview, in this version.
- **`tests/logic-tests.html` is browser-only** (loads `shared/*.js` via `<script>` tags) and cannot run this feature's Node/CommonJS logic — this feature gets its own Node test script, `tools/asset-wiki/test-logic.js`, run via `node tools/asset-wiki/test-logic.js`.
- **Category derivation** (`shared/kaykit-dungeon`, `kaykit-adventurers`): leading filename token before the first underscore, lowercased. For `kaykit-skeletons`, strip the redundant `Skeleton_` prefix first (every file in that pack has it). For `kaykit-character-animations` (and the two duplicate files under `kaykit-adventurers/animations/`), split into `{ rig, category }` from the `Rig_<Size>_<ClipName>` filename pattern instead.
- **Audio curation is single-sourced** in `assets/audio/README.md` — never re-encoded into a second data structure. The server parses it into per-pack HTML sections via a small hand-rolled markdown-lite converter (headers, bullets, bold, code spans only — no markdown library).

---

### Task 1: Pure catalog-logic module (`lib.js`) + Node test script

**Files:**
- Create: `tools/asset-wiki/lib.js`
- Create: `tools/asset-wiki/test-logic.js`

**Interfaces:**
- Produces: `humanize(id)`, `categoryForFile(id, stripPrefix)`, `animationRigAndClip(id)`, `isWiredIn(assetPath, sourceTexts)`, `phaseTagFor(pack, category, phaseTags)`, `mdLiteToHtml(markdown)`, `splitReadmeByPack(markdown)` — all pure, no `fs`/`http`. Consumed by Task 2 (`scan.js`).

- [ ] **Step 1: Write the failing tests**

Create `tools/asset-wiki/test-logic.js`:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/asset-wiki/test-logic.js`
Expected: `Error: Cannot find module './lib.js'` (it doesn't exist yet).

- [ ] **Step 3: Implement `lib.js`**

Create `tools/asset-wiki/lib.js`:

```js
// tools/asset-wiki/lib.js
// Pure functions (no fs, no network) for the asset wiki. Kept
// dependency-free and side-effect-free so they're unit-testable in
// isolation from the real filesystem — see test-logic.js.

function humanize(id) {
  return id.split('_').map(function (w) {
    return w.charAt(0).toUpperCase() + w.slice(1);
  }).join(' ');
}

// Leading-token category rule (matches shared/asset-catalog.js's convention
// from the decoration-props feature), with an added prefix-strip step for
// packs where every filename repeats the pack's own noun as a prefix
// (kaykit-skeletons: "Skeleton_Mage", "Skeleton_Shield_Large_A", ...) —
// without stripping that, every skeleton file would collapse into one
// useless "skeleton" category.
function categoryForFile(id, stripPrefix) {
  var rest = id;
  if (stripPrefix) {
    var re = new RegExp('^' + stripPrefix + '_', 'i');
    if (re.test(rest)) rest = rest.replace(re, '');
  }
  return rest.split('_')[0].toLowerCase();
}

// kaykit-character-animations (and the two duplicate files vendored
// directly under kaykit-adventurers/animations/) are per-rig animation-clip
// bundles, not standalone props — "Rig_Large_CombatMelee" isn't one item in
// a "rig" category, it's the CombatMelee clip-set for the Large rig.
function animationRigAndClip(id) {
  var m = /^(Rig_(?:Large|Medium))_(.+)$/.exec(id);
  if (!m) return null;
  return { rig: m[1], category: m[2].toLowerCase() };
}

// Verbatim substring match of `assetPath` against a list of source file
// contents (already-read strings) — mirrors the grep-based check used to
// establish this design (see docs/superpowers/specs/2026-08-19-asset-wiki-design.md §3).
function isWiredIn(assetPath, sourceTexts) {
  for (var i = 0; i < sourceTexts.length; i++) {
    if (sourceTexts[i].indexOf(assetPath) !== -1) return true;
  }
  return false;
}

// phaseTags: array of { pack, category, phase, note }. Returns the matching
// tag's { phase, note }, or null if none match this entry's pack+category.
function phaseTagFor(pack, category, phaseTags) {
  for (var i = 0; i < phaseTags.length; i++) {
    if (phaseTags[i].pack === pack && phaseTags[i].category === category) {
      return { phase: phaseTags[i].phase, note: phaseTags[i].note };
    }
  }
  return null;
}

// Minimal markdown -> HTML for the handful of constructs
// assets/audio/README.md actually uses: #/##/### headers, "- " bullet
// lists, **bold**, and `code` spans. Not a general markdown parser —
// deliberately small, see design spec §5.
function mdLiteToHtml(markdown) {
  var lines = markdown.replace(/\r\n/g, '\n').split('\n');
  var html = [];
  var inList = false;
  function closeList() { if (inList) { html.push('</ul>'); inList = false; } }
  function inline(text) {
    return text
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }
  lines.forEach(function (line) {
    var h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      closeList();
      var level = h[1].length;
      html.push('<h' + level + '>' + inline(h[2]) + '</h' + level + '>');
      return;
    }
    var li = /^-\s+(.*)$/.exec(line);
    if (li) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push('<li>' + inline(li[1]) + '</li>');
      return;
    }
    if (line.trim() === '') { closeList(); return; }
    closeList();
    html.push('<p>' + inline(line) + '</p>');
  });
  closeList();
  return html.join('\n');
}

// Splits assets/audio/README.md's markdown into per-pack sections (keyed by
// the pack's folder name, e.g. "kenney-rpg-audio") plus any trailing
// sections that aren't under a pack heading (e.g. "## Known gap"). Depends
// on the README's actual structure: a "## Packs" section containing
// "### `<pack-name>/`" subheadings, followed by sibling "## " sections.
function splitReadmeByPack(markdown) {
  var lines = markdown.replace(/\r\n/g, '\n').split('\n');
  var packs = {};
  var extra = {};
  var currentPackKey = null;
  var currentExtraKey = null;
  var buffer = [];

  function flush() {
    var text = buffer.join('\n').trim();
    if (currentPackKey) packs[currentPackKey] = text;
    else if (currentExtraKey) extra[currentExtraKey] = text;
    buffer = [];
  }

  lines.forEach(function (line) {
    var packHeading = /^###\s+`([^`\/]+)\/?`/.exec(line);
    var topHeading = /^##\s+(.+)$/.exec(line);
    if (packHeading) {
      flush();
      currentPackKey = packHeading[1];
      currentExtraKey = null;
      return;
    }
    if (topHeading && topHeading[1].trim() !== 'Packs') {
      flush();
      currentPackKey = null;
      currentExtraKey = topHeading[1].trim();
      return;
    }
    if (topHeading) {
      // "## Packs" itself — not content, just resets to no-current-section.
      flush();
      currentPackKey = null;
      currentExtraKey = null;
      return;
    }
    buffer.push(line);
  });
  flush();

  return { packs: packs, extra: extra };
}

module.exports = {
  humanize: humanize,
  categoryForFile: categoryForFile,
  animationRigAndClip: animationRigAndClip,
  isWiredIn: isWiredIn,
  phaseTagFor: phaseTagFor,
  mdLiteToHtml: mdLiteToHtml,
  splitReadmeByPack: splitReadmeByPack
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tools/asset-wiki/test-logic.js`
Expected: `18/18 passed`, no `FAIL` lines. (This exact code was hand-verified during planning — it must pass as-is.)

- [ ] **Step 5: Commit**

```bash
git add tools/asset-wiki/lib.js tools/asset-wiki/test-logic.js
git commit -m "Add asset wiki pure logic module (category derivation, wired-in matching, markdown-lite)"
```

---

### Task 2: Model catalog builder (`scan.js`) — the four visual packs

**Files:**
- Create: `tools/asset-wiki/scan.js`
- Modify: `tools/asset-wiki/test-logic.js`

**Interfaces:**
- Consumes: `lib.js` (Task 1).
- Produces: `buildModelCatalog(rootDir)` → array of `{ id, label, pack, category, rig?, path }` covering `kaykit-dungeon`, `kaykit-adventurers` (characters + equipment + the `animations/` duplicate folder), `kaykit-skeletons` (characters + equipment), `kaykit-character-animations` (`Rig_Large`/`Rig_Medium`). `readSourceTexts(rootDir)` → array of file-content strings (`game.html`, `editor.html`, every `shared/*.js`). `withStatusAndTags(entries, sourceTexts, phaseTags)` → same entries with `status: 'wired-in'|'unused'` and `phaseTag` added. Consumed by Task 5 (`server.js`) and Task 3 (phase tags).

- [ ] **Step 1: Write the failing tests**

Add to `tools/asset-wiki/test-logic.js`, replacing the `// --- TASK 2/3/4 TESTS GET APPENDED ABOVE THIS LINE ---` marker with:

```js
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
assertEqual(wiredIn.length, 10,
  'withStatusAndTags: exactly the 10 paths currently referenced in game.html/editor.html are wired-in (investigate before continuing if this differs — game.html/editor.html were likely edited since this plan was written)');
assertTrue(wiredIn.map(function (e) { return e.id; }).indexOf('wall') !== -1, 'withStatusAndTags: the wall model is wired-in');
assertTrue(withStatus.filter(function (e) { return e.id === 'banner_red'; })[0].status === 'unused', 'withStatusAndTags: a never-referenced model (banner_red) is unused');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/asset-wiki/test-logic.js`
Expected: `Error: Cannot find module './scan.js'`.

- [ ] **Step 3: Implement `scan.js`'s model-catalog functions**

Create `tools/asset-wiki/scan.js`:

```js
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

module.exports = {
  buildModelCatalog: buildModelCatalog,
  readSourceTexts: readSourceTexts,
  withStatusAndTags: withStatusAndTags
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tools/asset-wiki/test-logic.js`
Expected: all assertions (Task 1's and Task 2's) read `PASS`.

- [ ] **Step 5: Commit**

```bash
git add tools/asset-wiki/scan.js tools/asset-wiki/test-logic.js
git commit -m "Add model catalog builder covering all 4 vendored visual asset packs"
```

---

### Task 3: Phase-tag curated data (`phase-tags.js`)

**Files:**
- Create: `tools/asset-wiki/phase-tags.js`
- Modify: `tools/asset-wiki/test-logic.js`

**Interfaces:**
- Consumes: nothing (plain data), but its shape (`{ pack, category, phase, note }[]`) must match what `lib.phaseTagFor` (Task 1) and `scan.withStatusAndTags` (Task 2) expect.
- Produces: `module.exports` array, required directly by Task 5 (`server.js`).

- [ ] **Step 1: Write the failing test**

Add to `tools/asset-wiki/test-logic.js`, right after Task 2's block:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/asset-wiki/test-logic.js`
Expected: `Error: Cannot find module './phase-tags.js'`.

- [ ] **Step 3: Create `phase-tags.js`**

Create `tools/asset-wiki/phase-tags.js`:

```js
// Hand-curated: which pack+category a future roadmap phase (docs/ROADMAP.md)
// would plausibly use. Whole categories, not per-file. Unmapped categories
// simply show no tag — this is a curatorial aid, not exhaustive coverage.
module.exports = [
  // Phase 2 — non-combat interactive props (kaykit-dungeon)
  { pack: 'kaykit-dungeon', category: 'chest', phase: 2, note: 'key/chest puzzle chain — chest reveals an item' },
  { pack: 'kaykit-dungeon', category: 'barrel', phase: 2, note: 'pushable prop' },
  { pack: 'kaykit-dungeon', category: 'key', phase: 2, note: 'unlocks a barrier or chest' },
  { pack: 'kaykit-dungeon', category: 'keyring', phase: 2, note: 'decorative key cluster, pairs with the key/chest puzzle' },
  { pack: 'kaykit-dungeon', category: 'barrier', phase: 2, note: 'unlocked by a key, blocks a passage until opened' },
  { pack: 'kaykit-dungeon', category: 'bed', phase: 2, note: 'room-identity flavor (bedroom)' },
  { pack: 'kaykit-dungeon', category: 'stairs', phase: 2, note: 'room-identity flavor, no new mechanic' },
  { pack: 'kaykit-dungeon', category: 'candle', phase: 2, note: 'room-identity flavor' },
  { pack: 'kaykit-dungeon', category: 'coin', phase: 2, note: 'distinct secondary collectible (optional/high-score currency) — the model is already reused as the gem/item placeholder today' },

  // Phase 3 — character equipment & item interaction (kaykit-adventurers equipment)
  { pack: 'kaykit-adventurers', category: 'sword', phase: 3, note: "Knight's starting weapon" },
  { pack: 'kaykit-adventurers', category: 'shield', phase: 3, note: "Knight's starting equipment; also enables the Knight's block ability in Phase 5" },
  { pack: 'kaykit-adventurers', category: 'staff', phase: 3, note: "Mage's starting weapon" },
  { pack: 'kaykit-adventurers', category: 'wand', phase: 3, note: 'alternate Mage-style equippable' },
  { pack: 'kaykit-adventurers', category: 'bow', phase: 3, note: "Ranger's starting weapon" },
  { pack: 'kaykit-adventurers', category: 'arrow', phase: 3, note: "Ranger's ammo, visual only until Phase 5 combat exists" },
  { pack: 'kaykit-adventurers', category: 'quiver', phase: 3, note: "Ranger's equipment" },
  { pack: 'kaykit-adventurers', category: 'axe', phase: 3, note: 'equippable melee weapon' },
  { pack: 'kaykit-adventurers', category: 'dagger', phase: 3, note: "equippable melee weapon, pairs with the Rogue's Phase 5 bonus damage from behind" },
  { pack: 'kaykit-adventurers', category: 'crossbow', phase: 3, note: 'equippable ranged weapon' },

  // Phase 5 — combat, with per-hero powers (kaykit-adventurers characters)
  { pack: 'kaykit-adventurers', category: 'barbarian', phase: 5, note: 'playable hero: high damage, no block' },
  { pack: 'kaykit-adventurers', category: 'mage', phase: 5, note: 'playable hero: ranged spell, can relight distant torches' },
  { pack: 'kaykit-adventurers', category: 'ranger', phase: 5, note: 'playable hero: ranged arrows, brief see-through-walls scout pulse' },
  { pack: 'kaykit-adventurers', category: 'rogue', phase: 5, note: 'playable hero: smaller detection radius while moving, bonus damage from behind' },

  // Phase 4 — enemy spawning, stealth detection (kaykit-skeletons characters)
  { pack: 'kaykit-skeletons', category: 'minion', phase: 4, note: 'enemy roster: base grunt' },
  { pack: 'kaykit-skeletons', category: 'warrior', phase: 4, note: 'enemy roster: slow/wide sight archetype' },
  { pack: 'kaykit-skeletons', category: 'rogue', phase: 4, note: 'enemy roster: fast/narrow sight archetype' },
  { pack: 'kaykit-skeletons', category: 'mage', phase: 4, note: 'enemy roster: attacks at range once it spots you instead of chasing' },

  // Phase 4 — skeleton loadouts (kaykit-skeletons equipment)
  { pack: 'kaykit-skeletons', category: 'shield', phase: 4, note: "skeleton warrior's loadout" },
  { pack: 'kaykit-skeletons', category: 'staff', phase: 4, note: "skeleton mage's loadout" },
  { pack: 'kaykit-skeletons', category: 'blade', phase: 4, note: 'skeleton melee loadout' },
  { pack: 'kaykit-skeletons', category: 'axe', phase: 4, note: 'skeleton melee loadout' },
  { pack: 'kaykit-skeletons', category: 'crossbow', phase: 4, note: "skeleton rogue's loadout" },
  { pack: 'kaykit-skeletons', category: 'arrow', phase: 4, note: "skeleton rogue's ammo, visual only until Phase 5 combat exists" },
  { pack: 'kaykit-skeletons', category: 'quiver', phase: 4, note: "skeleton rogue's loadout" },

  // Phase 5 — combat animation clips (kaykit-character-animations)
  { pack: 'kaykit-character-animations', category: 'combatmelee', phase: 5, note: 'melee attack-animation window' },
  { pack: 'kaykit-character-animations', category: 'combatranged', phase: 5, note: 'ranged attack-animation window' },
  { pack: 'kaykit-character-animations', category: 'special', phase: 5, note: 'per-hero special-ability animation' }
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tools/asset-wiki/test-logic.js`
Expected: all assertions read `PASS`.

- [ ] **Step 5: Commit**

```bash
git add tools/asset-wiki/phase-tags.js tools/asset-wiki/test-logic.js
git commit -m "Add curated phase-tag data mapping unused categories to roadmap phases"
```

---

### Task 4: Audio catalog builder (`scan.js` — `buildAudioCatalog`)

**Files:**
- Modify: `tools/asset-wiki/scan.js`
- Modify: `tools/asset-wiki/test-logic.js`

**Interfaces:**
- Consumes: `lib.mdLiteToHtml`, `lib.splitReadmeByPack` (Task 1).
- Produces: `buildAudioCatalog(rootDir)` → `{ packs: [{ pack, readmeHtml, files: [{file, path}] }], extra: { [heading]: html } }`. Consumed by Task 5 (`server.js`).

- [ ] **Step 1: Write the failing tests**

Add to `tools/asset-wiki/test-logic.js`, right after Task 3's block:

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/asset-wiki/test-logic.js`
Expected: `TypeError: scan.buildAudioCatalog is not a function`.

- [ ] **Step 3: Add `buildAudioCatalog` to `scan.js`**

In `tools/asset-wiki/scan.js`, add before the `module.exports` block:

```js
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
```

And update the `module.exports` block to:

```js
module.exports = {
  buildModelCatalog: buildModelCatalog,
  readSourceTexts: readSourceTexts,
  withStatusAndTags: withStatusAndTags,
  buildAudioCatalog: buildAudioCatalog
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tools/asset-wiki/test-logic.js`
Expected: all assertions read `PASS` (should be 30+ lines by now).

- [ ] **Step 5: Commit**

```bash
git add tools/asset-wiki/scan.js tools/asset-wiki/test-logic.js
git commit -m "Add audio catalog builder with recursive file discovery and per-pack README rendering"
```

---

### Task 5: HTTP server (`server.js`)

**Files:**
- Create: `tools/asset-wiki/server.js`

**Interfaces:**
- Consumes: `scan.buildModelCatalog`, `scan.readSourceTexts`, `scan.withStatusAndTags`, `scan.buildAudioCatalog` (Task 2/4), `phase-tags.js` (Task 3).
- Produces: `GET /api/catalog` → JSON array of tagged model entries. `GET /api/audio` → JSON `{ packs, extra }`. Static file serving for `tools/asset-wiki/index.html`, `tools/asset-wiki/app.js`, and everything under `assets/`. Consumed by Task 6 (front-end, via `fetch`).

No unit test for this task — it's a thin HTTP wrapper around already-tested functions. Verified by actually running it (Step 3).

- [ ] **Step 1: Create `server.js`**

Create `tools/asset-wiki/server.js`:

```js
// tools/asset-wiki/server.js
// Run: node tools/asset-wiki/server.js
// Dev-only local tool -- never deployed, never linked from index.html.
// Serves a live-scanned asset wiki page. See
// docs/superpowers/specs/2026-08-19-asset-wiki-design.md.
var http = require('http');
var fs = require('fs');
var path = require('path');
var scan = require('./scan.js');
var phaseTags = require('./phase-tags.js');

var ROOT = path.join(__dirname, '..', '..');
var PORT = 4173;

var STATIC_MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gltf': 'model/gltf+json',
  '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream',
  '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.wav': 'audio/wav'
};

function sendJson(res, data) {
  var body = JSON.stringify(data);
  res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function serveStatic(res, filePath) {
  fs.readFile(filePath, function (err, data) {
    if (err) { res.writeHead(404); res.end('Not found: ' + filePath); return; }
    var ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': STATIC_MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });
}

var server = http.createServer(function (req, res) {
  // decodeURIComponent matters here: audio filenames under
  // kenney-music-jingles/ contain spaces (e.g. "8-Bit jingles/..."), which
  // arrive as %20 in the raw request URL.
  var urlPath = decodeURIComponent(req.url.split('?')[0]);

  if (urlPath === '/api/catalog') {
    var entries = scan.buildModelCatalog(ROOT);
    var sourceTexts = scan.readSourceTexts(ROOT);
    sendJson(res, scan.withStatusAndTags(entries, sourceTexts, phaseTags));
    return;
  }

  if (urlPath === '/api/audio') {
    sendJson(res, scan.buildAudioCatalog(ROOT));
    return;
  }

  if (urlPath === '/' || urlPath === '/index.html') {
    serveStatic(res, path.join(__dirname, 'index.html'));
    return;
  }

  if (urlPath === '/app.js') {
    serveStatic(res, path.join(__dirname, 'app.js'));
    return;
  }

  if (urlPath.indexOf('/assets/') === 0) {
    serveStatic(res, path.join(ROOT, urlPath));
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, function () {
  console.log('Asset wiki running at http://localhost:' + PORT);
});
```

(This exact code was hand-verified during planning against the real repo — endpoint JSON shapes, counts, and the space-in-filename static-serving edge case all checked out.)

- [ ] **Step 2: Start the server**

Run: `node tools/asset-wiki/server.js`
Expected console output: `Asset wiki running at http://localhost:4173`

- [ ] **Step 3: Verify the endpoints (in a second terminal, server still running)**

```bash
curl -s http://localhost:4173/api/catalog | node -e "var d=JSON.parse(require('fs').readFileSync(0,'utf8')); console.log('total:', d.length); console.log('wired-in:', d.filter(e=>e.status==='wired-in').length);"
```
Expected: `total: 281` and `wired-in: 10`.

```bash
curl -s http://localhost:4173/api/audio | node -e "var d=JSON.parse(require('fs').readFileSync(0,'utf8')); d.packs.forEach(p=>console.log(p.pack, p.files.length));"
```
Expected:
```
16bit-retro-music-collection 13
kenney-music-jingles 85
kenney-rpg-audio 51
spooky-playtime-davidkbd 10
```

```bash
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:4173/assets/audio/kenney-music-jingles/8-Bit%20jingles/jingles_NES00.ogg"
```
Expected: `200` (confirms the space-in-filename decode path works).

Stop the server (`Ctrl+C` or `pkill -f "tools/asset-wiki/server.js"`) once all checks pass.

- [ ] **Step 4: Commit**

```bash
git add tools/asset-wiki/server.js
git commit -m "Add asset wiki HTTP server (catalog/audio endpoints + static file serving)"
```

---

### Task 6: Front-end page (`index.html` + `app.js`)

**Files:**
- Create: `tools/asset-wiki/index.html`
- Create: `tools/asset-wiki/app.js`

**Interfaces:**
- Consumes: `GET /api/catalog`, `GET /api/audio` (Task 5).
- Produces: the actual viewable page — no further tasks depend on this.

No unit test for this task — pure DOM rendering, verified by actually loading the page (Step 3). If a browser with Playwright/similar automation is available in your environment, use it to load the page and check for console errors and rendered content instead of (or in addition to) manual inspection.

- [ ] **Step 1: Create `index.html`**

Create `tools/asset-wiki/index.html`:

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Torch Maze — Asset Wiki</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; background: #1b1b1f; color: #eee; }
  header { padding: 16px 20px; background: #26262c; border-bottom: 1px solid #3a3a42; }
  header h1 { margin: 0 0 10px; font-size: 18px; }
  .tabs { display: flex; gap: 8px; }
  .tabs button { background: #33333b; color: #eee; border: 1px solid #454550; border-radius: 6px; padding: 6px 12px; cursor: pointer; font-size: 13px; }
  .tabs button.active { background: #f2a900; color: #1b1b1f; border-color: #f2a900; }
  #search { margin: 12px 20px 0; padding: 6px 10px; width: 280px; border-radius: 6px; border: 1px solid #454550; background: #26262c; color: #eee; }
  main { padding: 16px 20px 40px; }
  details.pack, details.category { border: 1px solid #3a3a42; border-radius: 6px; margin-bottom: 8px; background: #212127; }
  details.pack > summary, details.category > summary { padding: 8px 12px; cursor: pointer; font-weight: bold; }
  details.category > summary { font-weight: normal; font-size: 13px; color: #ccc; }
  .row { display: flex; align-items: center; gap: 10px; padding: 5px 14px; border-top: 1px solid #2a2a30; font-size: 13px; }
  .row .path { color: #888; font-size: 11px; margin-left: auto; }
  .badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; }
  .badge.wired-in { background: #2d7d46; color: #fff; }
  .badge.unused { background: #555; color: #ddd; }
  .badge.phase { background: #4a3d8f; color: #fff; }
  audio { height: 28px; }
  .readme { padding: 8px 14px; font-size: 12px; color: #ccc; }
  .readme h2, .readme h3 { font-size: 13px; margin: 8px 0 4px; }
  .readme code { background: #33333b; padding: 1px 4px; border-radius: 3px; }
  .hidden { display: none; }
</style>
</head>
<body>
<header>
  <h1>Torch Maze — Asset Wiki</h1>
  <div class="tabs">
    <button data-view="pack" class="active">By pack</button>
    <button data-view="status">By status</button>
    <button data-view="audio">Audio</button>
  </div>
  <input id="search" type="text" placeholder="Search models…">
</header>
<main id="main">Loading…</main>
<script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Create `app.js`**

Create `tools/asset-wiki/app.js`:

```js
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
```

- [ ] **Step 3: Run the full tool and verify manually**

```bash
node tools/asset-wiki/server.js
```

Open `http://localhost:4173/` in a browser. Verify:
- The page loads with no console errors, "By pack" tab active by default.
- Each of the 4 model packs (plus the two `kaykit-character-animations` rig sub-groups) appears as a collapsible section; expanding one shows category sub-sections with entries.
- Typing "banner" in the search box filters to banner-related rows across expanded sections.
- Clicking "By status" shows two groups, **wired-in** (10 entries, including `Wall`, `Torch Lit`, `Knight`) and **unused** (271 entries); several unused entries (e.g. `Chest`, `Skeleton Minion`) show a purple "Phase N — ..." badge.
- Clicking "Audio" shows all 4 packs, each with rendered README prose above a file list, and each file row has a working `<audio controls>` player (click play on at least one file from `kenney-music-jingles` specifically, since its files are the nested-subfolder ones — confirms the URL-encoding path end to end).
- The "Known gap" section appears (mentions the un-sourced torch-ignite effect).

Stop the server once verified.

- [ ] **Step 4: Commit**

```bash
git add tools/asset-wiki/index.html tools/asset-wiki/app.js
git commit -m "Add asset wiki front-end (by-pack/by-status/audio views, search)"
```
