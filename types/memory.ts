export interface EpisodicMemory {
  id: string;                   // UUID
  actor: string;                // 'player' | NPC name
  timestamp: string;            // ISO 8601
  location: string;             // In-game location name
  entities: string[];           // Affected NPCs, items, factions
  trigger: string;              // What caused this event
  outcome: string;              // What resulted (rich narrative text)
  emotionalWeight: number;      // 0-1, importance score
  tags: string[];               // ['combat', 'betrayal', 'discovery']
  playerId: string;             // Firebase UID
}

export interface MemorySearchResult extends EpisodicMemory {
  score: number;                // Cosine similarity score from Qdrant
}
