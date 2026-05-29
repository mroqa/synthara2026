import { v4 as uuidv4 } from 'uuid';
import type { EpisodicMemory } from '@/types/memory';

export function createMemoryEvent(
  partial: Omit<EpisodicMemory, 'id' | 'timestamp'>
): EpisodicMemory {
  return {
    id: uuidv4(),
    timestamp: new Date().toISOString(),
    ...partial,
  };
}

export function memoryToEmbeddingText(memory: EpisodicMemory): string {
  return `
    Actor: ${memory.actor}.
    Location: ${memory.location}.
    Trigger: ${memory.trigger}.
    Entities involved: ${memory.entities.join(', ')}.
    Outcome: ${memory.outcome}.
    Tags: ${memory.tags.join(', ')}.
  `.trim();
}

export function memoryToPayload(memory: EpisodicMemory): Record<string, unknown> {
  return {
    id: memory.id,
    actor: memory.actor,
    timestamp: memory.timestamp,
    location: memory.location,
    entities: memory.entities,
    trigger: memory.trigger,
    outcome: memory.outcome,
    emotionalWeight: memory.emotionalWeight,
    tags: memory.tags,
    playerId: memory.playerId,
  };
}

export const ARCHETYPE_SEED_MEMORIES: Record<string, Omit<EpisodicMemory, 'id' | 'timestamp' | 'playerId'>> = {
  Wanderer: {
    actor: 'player',
    location: 'Thornwood Crossroads',
    entities: ['Synthara world', 'nameless village', 'wandering road'],
    trigger: 'character_creation',
    outcome: 'A wanderer with no home arrived at the crossroads of Synthara, carrying only scars and a broken compass.',
    emotionalWeight: 0.6,
    tags: ['arrival', 'origin', 'wanderer', 'solitude'],
  },
  Scholar: {
    actor: 'player',
    location: 'Arcane Library of Vel\'Drath',
    entities: ['Synthara world', 'ancient tomes', 'forbidden knowledge'],
    trigger: 'character_creation',
    outcome: 'A scholar fled the burning library, clutching forbidden texts that whisper of the world\'s first sin.',
    emotionalWeight: 0.8,
    tags: ['arrival', 'origin', 'scholar', 'forbidden knowledge'],
  },
  Warlord: {
    actor: 'player',
    location: 'Ashfeld Battlefield',
    entities: ['Synthara world', 'fallen army', 'betrayed banner'],
    trigger: 'character_creation',
    outcome: 'A warlord stood alone on a battlefield of their own making — the last survivor of a war they started and lost.',
    emotionalWeight: 0.9,
    tags: ['arrival', 'origin', 'warlord', 'betrayal', 'war'],
  },
  Phantom: {
    actor: 'player',
    location: 'The Veil Between Worlds',
    entities: ['Synthara world', 'shadow realm', 'stolen identity'],
    trigger: 'character_creation',
    outcome: 'A phantom slipped through the veil with a stolen face, arriving in Synthara with no memory of what they truly are.',
    emotionalWeight: 0.7,
    tags: ['arrival', 'origin', 'phantom', 'mystery', 'identity'],
  },
};
