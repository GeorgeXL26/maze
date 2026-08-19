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
