export type Archetype = 'Wanderer' | 'Scholar' | 'Warlord' | 'Phantom';

export interface PlayerStats {
  hp: number;
  maxHp: number;
  xp: number;
  level: number;
  gold: number;
  strength: number;
  wisdom: number;
  stealth: number;
  charisma: number;
}

export interface StatBoost {
  strength?: number;
  wisdom?: number;
  stealth?: number;
  charisma?: number;
  maxHp?: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  type: 'weapon' | 'armor' | 'consumable' | 'quest' | 'artifact' | 'accessory';
  description: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  icon: string;
  statBoost?: StatBoost;
  equipped?: boolean;
}

export interface Player {
  uid: string;
  name: string;
  archetype: Archetype;
  stats: PlayerStats;
  inventory: InventoryItem[];
  equippedIds: string[];
  questsCompleted: number;
  memoriesCount: number;
  createdAt: string;
}
