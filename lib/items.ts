import type { InventoryItem } from '@/types/player';

// Item registry — available as quest rewards
export const ITEM_REGISTRY: InventoryItem[] = [
  // Weapons
  {
    id: 'blade-of-ruin',
    name: 'Blade of Ruin',
    type: 'weapon',
    description: 'A cursed blade that feeds on fallen memories. Grants unnatural strength.',
    rarity: 'rare',
    icon: '⚔️',
    statBoost: { strength: 3 },
  },
  {
    id: 'shadowfang-dagger',
    name: 'Shadowfang Dagger',
    type: 'weapon',
    description: 'Forged in the Veil Market from stolen moonlight. Exceptionally precise.',
    rarity: 'epic',
    icon: '🗡️',
    statBoost: { stealth: 4, strength: 1 },
  },
  {
    id: 'warlord-maul',
    name: "Warlord's Maul",
    type: 'weapon',
    description: "Commander Hael's weapon from the Ashfeld massacre. Heavy and unforgiving.",
    rarity: 'legendary',
    icon: '🔨',
    statBoost: { strength: 6, maxHp: 20 },
  },
  {
    id: 'memory-staff',
    name: 'Staff of Remembered Worlds',
    type: 'weapon',
    description: 'Channels episodic energy into focused arcane bolts.',
    rarity: 'epic',
    icon: '🔮',
    statBoost: { wisdom: 5 },
  },

  // Armor / Accessories
  {
    id: 'veil-cloak',
    name: 'Cloak of the Veil',
    type: 'armor',
    description: 'Woven from shadows sold at the Veil Market. Makes you nearly imperceptible.',
    rarity: 'rare',
    icon: '🧥',
    statBoost: { stealth: 3 },
  },
  {
    id: 'soren-spectacles',
    name: "Archivist's Spectacles",
    type: 'accessory',
    description: "Soren's cracked spectacles that let you read any forbidden text instantly.",
    rarity: 'rare',
    icon: '🔭',
    statBoost: { wisdom: 3 },
  },
  {
    id: 'signet-iron',
    name: 'Iron Vanguard Signet',
    type: 'accessory',
    description: 'A military signet that commands respect from soldiers and warlords.',
    rarity: 'common',
    icon: '💍',
    statBoost: { charisma: 2, strength: 1 },
  },
  {
    id: 'mira-compass',
    name: "Mira's Ley Compass",
    type: 'artifact',
    description: 'Points toward hidden memories. Strengthens your bond to the land.',
    rarity: 'epic',
    icon: '🧭',
    statBoost: { wisdom: 2, charisma: 3 },
  },
  {
    id: 'citadel-seal',
    name: "Malachar's Stolen Seal",
    type: 'artifact',
    description: 'A fragment of the dark lord\'s power, seized in defiance.',
    rarity: 'legendary',
    icon: '🏰',
    statBoost: { strength: 3, wisdom: 3, charisma: 3, maxHp: 30 },
  },
  {
    id: 'rune-amulet',
    name: 'Thornwood Rune Amulet',
    type: 'accessory',
    description: 'Carved from a bark-rune tree. Amplifies presence and force of will.',
    rarity: 'common',
    icon: '📿',
    statBoost: { charisma: 2 },
  },
];

/** Pick a random item weighted by rarity (higher rarity = lower chance) */
export function pickRandomReward(successLevel: 'success' | 'failure'): InventoryItem | null {
  if (successLevel === 'failure') {
    // 30% chance of any item on failure
    if (Math.random() > 0.3) return null;
  }

  const weights: Record<string, number> = {
    common: 50,
    rare: 30,
    epic: 15,
    legendary: 5,
  };

  const pool: InventoryItem[] = [];
  for (const item of ITEM_REGISTRY) {
    const w = weights[item.rarity] ?? 10;
    for (let i = 0; i < w; i++) pool.push(item);
  }

  const picked = pool[Math.floor(Math.random() * pool.length)];
  return { ...picked, equipped: false };
}
