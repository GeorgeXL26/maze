// shared/bgm.js
// Looping background music, shared by index.html, levels.html, and
// editor.html (game.html has its own level-specific BGM logic — see
// game.html's playLoopingBGM, which additionally needs to be stoppable on
// win, so it isn't a fit for this shared, page-lifetime-only helper).
window.BGM = (function () {
  function playLooping(relPath, volume) {
    var audio = new Audio(encodeURI('assets/audio/' + relPath));
    audio.loop = true;
    audio.volume = volume;
    var tryPlay = function () { return audio.play(); };
    // If the browser blocks the initial autoplay attempt (no user gesture
    // yet on the page), retry once on the visitor's first interaction.
    tryPlay().catch(function () {
      var retry = function () {
        tryPlay().catch(function () {});
        window.removeEventListener('pointerdown', retry);
        window.removeEventListener('keydown', retry);
      };
      window.addEventListener('pointerdown', retry);
      window.addEventListener('keydown', retry);
    });
    return audio;
  }

  return { playLooping: playLooping };
})();
