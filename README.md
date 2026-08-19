# 🔥 Torch Maze

A fog-of-war maze exploration game built with [three.js](https://threejs.org/). Fog blankets everything — only your torchlight (and any torches you light along the way) reveals the path.

**▶ Play now: [georgexl26.github.io/maze](https://georgexl26.github.io/maze/)**

## Features

- **Torch-lit fog of war** — visibility is a soft-edged circle around the player, widened by any torch you've lit
- **40 generated mazes across 4 difficulty tiers**, plus a hand-built level:

  | Tier | Size | Torches | Coins |
  |---|---|---|---|
  | Easy | 30×30 | 6 | 12 |
  | Medium | 50×50 | 16 | 32 |
  | Hard | 80×80 | 42 | 84 |
  | Nightmare | 100×100 | 66 | 132 |

- **3-star scoring** — reach the exit for 1★, collect every coin for a 2nd, light every torch for a 3rd, with your time-to-escape shown on the win screen
- **Level editor** — paint walls/floors by hand, or one-click "Generate Maze" a fresh random layout, then place torches/coins/start/exit and export the level as JSON
- **Load your own level** — export a level from the editor and load it back in from the level-select screen

## Controls

`WASD` to move · `E` near a lit torch to teleport back to it

## Running locally

Everything is static files — no build step, no server-side code. Serve the repo root with any static file server and open it:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## Project structure

```
index.html       landing page
levels.html      level select (difficulty tiers + custom level upload)
game.html        the game itself
editor.html      level editor
shared/          core logic shared across pages (maze schema, player
                 controller, level I/O, editor grid, BGM helper)
levels/          level JSON files + manifest.json (the level list)
assets/          vendored 3D models, animations, and audio
tools/           dev-only tooling (level generator; see tools/asset-wiki/
                 for a local-only asset browser, not part of the deployed site)
tests/           browser-based logic tests (open tests/logic-tests.html)
docs/            roadmap and design/planning docs
```

## Tech stack

Vanilla JS (ES5-style, no framework, no bundler) + [three.js](https://threejs.org/) loaded via CDN import map. No dependencies to install for the game itself.

## Credits

- **3D models & animations** — [KayKit](https://kaylousberg.itch.io/) dungeon, adventurer, skeleton, and animation packs by Kay Lousberg (CC0)
- **SFX & jingles** — [Kenney](https://kenney.nl/) RPG audio and music jingles (CC0)
- **Menu/level BGM** ("Pixel Triumph") — 16-Bit Retro Music Collection
- **In-game level BGM** ("Haunted Mansion") — *Spooky Playtime* by [David KBD](https://davidkbd.itch.io/spooky-playtime-spooky-and-crazy-music-pack) (CC BY 4.0 — attribution required, credited here)

## License

Code is licensed under Apache License 2.0 (see [LICENSE](LICENSE)). Vendored assets under `assets/` keep their own licenses — see each pack's `License.txt`/`LICENSE.txt`, and `assets/audio/README.md` for the audio packs specifically.
