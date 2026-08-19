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
