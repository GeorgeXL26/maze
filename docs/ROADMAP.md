# Torch Maze — Roadmap

Living list of where the project is headed, phased in rough priority order.
This is ideas and sequencing, not commitments — each phase still needs its
own brainstorm → spec → plan cycle (see `docs/superpowers/`) before any code
gets written.

## Guiding principle: editor parity

**Every player-facing feature below should get a matching editor feature in
the same phase.** If the game can spawn an enemy, place a chest, or trigger a
line of dialog, the editor needs a tool to author that same thing — the
editor is how levels get made, so it can't lag behind what levels are
allowed to contain. Treat "add the editor tool" as part of the phase, not a
follow-up.

## Editor architecture: layered authoring model

As the editor grows to support the phases below, level authoring splits
into three layers, each one building on top of the layer beneath it:

1. **Structure layer — walls.** The fixed maze geometry (today's Wall/Floor
   tools). This is decided first; everything else in the level is placed
   relative to it, and it doesn't change once the other layers start filling
   in.
2. **Decoration/interaction layer** — key, torch, chest, barrel, barrier,
   and the rest of Phase 2's props. Placement is constrained by the
   structure layer (a decoration lives on a floor cell, shaped by the walls
   around it). Beyond position, entries in this layer can carry
   **relationships to each other** — a key linked to the specific barrier or
   chest it unlocks, an item placed inside a specific chest rather than
   loose on the floor. This is a real data-model implication for Phase 2:
   decorations need an optional reference to another decoration, not just a
   standalone `{x, y, model}`.
3. **Character/entity layer** — the player start point, and (from Phase 4
   onward) enemies with a predefined patrol route (a waypoint sequence) and
   a detection range/vision cone, plus (from Phase 6) dialog attached to
   characters. This layer unifies what Phases 3, 4, and 6 each add to the
   editor into one conceptual category — things that move or speak — as
   opposed to Layer 2's static, functional props.

Each layer's editor tools should assume the layer below is already
authored: place walls before decorating, decorate before placing characters
that need to path around both.

## Phase 1: Asset library wiki page

A single reference page listing every vendored model — dungeon props,
characters, weapons/equipment, animation clips — so it's easy to browse
"what do we have" while deciding what to build next, without digging through
`assets/` by hand.

- Two views: **by pack** (dungeon/adventurers/skeletons/animations) and **by
  status** (wired-in vs. available-but-unused) — the status view is probably
  the more useful one day-to-day.
- Tag each item with which later phase would use it (barrel → "pushable,
  Phase 2"; shield → "Phase 3 equipment"; skeleton → "Phase 4 enemy"), so the
  wiki doubles as a "what's next" index, not just a static inventory.
- Text/catalog reference to start. Once Phase 2's thumbnail generation
  exists, reuse those images here instead of a text-only list.

## Phase 2: Non-combat interactive props

Bring the dungeon pack's furniture and clutter into actual levels: bed,
chest, stairs, barrier, key, coin, barrel, and the rest of the ~88 decorative
models sitting unused today.

- **Key + Barrier + Chest** form a natural locked-door puzzle chain: a key
  unlocks a barrier or chest, a chest reveals an item — the first real
  puzzle verb beyond "walk and collect."
- **Barrel**: pushable. ("Breakable to reveal a hidden item" is a tempting
  extension but that's really a Phase 5 combat verb — flag it there instead
  of scope-creeping this phase.)
- **Coin** as a distinct secondary collectible from the existing gem "item"
  — optional/high-score currency rather than required for the exit, so
  levels can reward exploration without gating completion.
- **Stairs/banners/candles/beds**: pure room-identity flavor, no new
  mechanic — let level designers signal "this is a bedroom," "this is a
  boss room," etc.

**Status:** already has a written design spec and implementation plan —
`docs/superpowers/specs/2026-08-19-decoration-props-design.md` and
`docs/superpowers/plans/2026-08-19-decoration-props.md`. Not yet built.

**Editor:** the plan's unified searchable model panel *is* the editor half
of this phase already.

## Phase 3: Character equipment & item interaction

Let a character actually hold a weapon/shield/staff from the 44 vendored
equipment pieces, and interact with the world's items (pick up, use, carry).
Prerequisite for both combat (Phase 5) and any real inventory/equipment
choices.

- Visual-only equip first (mesh parented to the correct hand bone, no
  gameplay effect yet) — the smallest testable slice, decoupled from combat.
- Per-character starting loadout, matching each Adventurer's actual vendored
  equipment: Knight → sword+shield, Mage → staff, Ranger → bow.
- "Pick up to equip" bridges this with Phase 2 — walking onto a dropped
  weapon prop equips it, reusing the same item-pickup pattern that already
  exists for gems.
- A small inventory HUD (icon row) showing what's currently held.

**Editor:** a way to choose which character a level (or level's start point)
uses, and/or which items/equipment a level seeds a character with.

## Phase 4: Enemy spawning — stealth detection

Spawn enemies (skeletons are the obvious first roster — Minion/Warrior/
Rogue/Mage, already vendored) that patrol or guard, in a stealth register:
being spotted is an instant loss condition ("once found, game over"), not a
health bar. **Stealth-only in this phase** — there's no combat system yet
(that's Phase 5), so detection has exactly one outcome: game over.

- Detection is a **vision cone**, not a radius — visually telegraphed
  (could reuse the fog-of-war shader technique, inverted: a cone-shaped "the
  enemy can see you here" mask instead of "you can see here").
- The skeleton roster gives natural archetype variety for free: Warrior =
  slow/wide sight, Rogue = fast/narrow sight, Mage = attacks at range once
  it spots you instead of chasing.
- **Being outside torch light plausibly means hidden**, even inside a cone —
  ties detection directly into the fog-of-war mechanic that's already the
  game's whole identity, rather than bolting on a separate stealth system.
- "Spotted" needs a beat before instant-fail (a brief tell/alert animation)
  so it reads as fair rather than a cheap trap.

**Editor:** enemy placement + patrol path/vision-cone authoring, parallel to
how torches/items/decorations are placed today.

## Phase 5: Combat, with per-hero powers

A combat layer where different heroes fight with distinct
strengths/abilities rather than one shared move-set.

- Concrete asymmetry per hero: **Knight** (tanky, can block), **Barbarian**
  (high damage, no block), **Mage** (ranged spell, can relight distant
  torches — a nice callback to the core mechanic), **Ranger** (ranged
  arrows, brief see-through-walls scout pulse), **Rogue** (smaller
  detection radius while moving, bonus damage from behind).
- Keep resolution simple: existing grid-collision + a short attack-animation
  window + a hit check — no need for real physics/hitboxes. The
  CombatMelee/CombatRanged/Special animation clips already vendored are
  aimed squarely at this.
- **Resolves the Phase 4 game-over rule:** once combat exists, getting
  spotted during stealth no longer means instant game over — it drops the
  player into combat instead. Stealth remains the default, quieter way to
  handle an enemy; combat becomes the fallback when stealth fails, not a
  separate mode you opt into upfront.

**Editor:** hero selection for a level, and whatever per-hero balance knobs
end up existing (if any are level-specific rather than global).

## Phase 6: Story and dialog

A narrative layer tying the maze runs together into something with stakes
beyond "collect items, reach exit." Last in sequence since it likely wants
the other systems (enemies, combat, items) in place first to have something
to narrate.

- Start smallest: per-level intro/outro flavor text in the HUD, sourced from
  the manifest — no new placement tool needed yet.
- Grow into an editor-placed "dialog trigger" tool (same pattern as
  torch/item placement) for mid-level story beats.
- Lore-fragment collectibles (found notes) as a natural extension of the
  existing item-pickup pattern, separate from required exit-items.
- Branching dialog is probably a non-goal for a while — linear flavor text
  carries the maze-crawler tone fine without new UI complexity.

**Editor:** a way to author and place dialog triggers/story beats per level,
same parity principle as every other phase.
