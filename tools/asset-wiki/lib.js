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
