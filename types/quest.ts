export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type QuestStatus = 'active' | 'completed' | 'failed';

export interface Quest {
  id: string;
  title: string;
  description: string;
  npc: string;
  npcRole: string;
  objectives: string[];
  completedObjectives: boolean[];
  memoryContext: string[];
  rarity: Rarity;
  reward: {
    gold: number;
    xp: number;
    item?: string;
  };
  status: QuestStatus;
  createdAt: string;
  completedAt?: string;
  playerId: string;
}
