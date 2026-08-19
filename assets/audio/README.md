# Audio

Vendored music/SFX for Torch Maze. Nothing here is wired into `game.html`
yet — this is source material, not yet integrated.

## Packs

### `16bit-retro-music-collection/`
13 full music tracks (BGM candidates). See `LICENSE.txt` in that folder —
free for any use, credit only required if the game is monetized.

- **BGM candidates:** `Pixel Soundscape.m4a`, `Pixel Fantasy.m4a` (ambient-
  leaning names — pick by ear)
- **Win candidates:** `Victory Arc.m4a`, `Pixel Triumph.m4a`

### `kenney-music-jingles/`
85 short jingles across 5 instrument styles (8-Bit, Hit, Pizzicato, Sax,
Steel), CC0, no attribution required. Filenames are just numbered
(`jingles_HIT03.ogg` etc.) with no mood/purpose label.

- **Needed:** a failure/game-over stinger. **Not yet picked** — nobody has
  listened through these to find one that actually sounds like defeat.
  Needs a human ear-pick before use.

### `kenney-rpg-audio/`
56 RPG foley sounds (footsteps, doors, cloth, coins, etc.), CC0, no
attribution required.

- **Collect item:** `handleCoins.ogg`, `handleCoins2.ogg`

### `spooky-playtime-davidkbd/`
10 full music tracks, eerie-but-playful tone (spooky, not genuinely
frightening — chosen to match the game's dark/creepy atmosphere while
staying appropriate for a ~12-year-old audience). See `LICENSE.txt` in
that folder — **CC BY 4.0, attribution to David KBD is required** if used
(credit somewhere in the game, e.g. a credits screen or README).

- **BGM strongest fits:** `Ghostly Grooves`, `Whispers of Darkness`,
  `Labyrinth` — atmospheric/exploration-paced rather than combat-intense
- **Higher-intensity options** (for tenser moments, if wanted later):
  `Confronting the Nightmare`, `Shadows Fury`
- This is the pack actually intended for the game's BGM — the earlier
  "Dark Dungeon Ambient Music" pack considered for this slot was rejected
  as too intense/frightening for the target age and was not vendored.

## Known gap

**Torch-ignite sound effect — not sourced yet.** The best match found
(freesound.org, "Torch - Ignite flame on soft" by ldezem, CC0) requires a
Freesound account to download, which wasn't available. A directly-
downloadable alternative existed (`Torch Lighter.mp3` from itch.io) but its
page states no license terms at all, so it wasn't vendored. Still needs
resolving — either a Freesound login, or a different clearly-licensed
source.
