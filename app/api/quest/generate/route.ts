import { NextRequest, NextResponse } from 'next/server';
import { generateQuest } from '@/lib/gemini';
import { embedText } from '@/lib/gemini';
import { searchVectors } from '@/lib/qdrant';
import { v4 as uuidv4 } from 'uuid';
import type { Quest } from '@/types/quest';
import type { MemorySearchResult } from '@/types/memory';

export async function POST(req: NextRequest) {
  try {
    const { npcName, npcRole, playerId, context } = await req.json();

    if (!npcName || !npcRole || !playerId) {
      return NextResponse.json({ error: 'Missing npcName, npcRole, or playerId' }, { status: 400 });
    }

    // Build the context query for memory retrieval
    const searchQuery = context || `${npcName} ${npcRole} quest adventure`;
    const queryVector = await embedText(searchQuery);

    // Retrieve top 5 relevant memories for this player
    const filter = { must: [{ key: 'playerId', match: { value: playerId } }] };
    const results = await searchVectors(queryVector, 5, filter);

    const memories: MemorySearchResult[] = results.map((r) => ({
      id: r.payload.id as string,
      actor: r.payload.actor as string,
      timestamp: r.payload.timestamp as string,
      location: r.payload.location as string,
      entities: r.payload.entities as string[],
      trigger: r.payload.trigger as string,
      outcome: r.payload.outcome as string,
      emotionalWeight: r.payload.emotionalWeight as number,
      tags: r.payload.tags as string[],
      playerId: r.payload.playerId as string,
      score: r.score,
    }));

    // Generate quest via Gemini
    const generated = await generateQuest(npcName, npcRole, memories);

    // Build full quest object
    const quest: Quest = {
      id: uuidv4(),
      title: generated.title,
      description: generated.description,
      npc: npcName,
      npcRole,
      objectives: generated.objectives,
      completedObjectives: generated.objectives.map(() => false),
      memoryContext: generated.memoryContext,
      rarity: generated.rarity,
      reward: generated.reward,
      status: 'active',
      createdAt: new Date().toISOString(),
      playerId,
    };

    return NextResponse.json({
      quest,
      npcDialogue: generated.npcDialogue,
      memoriesUsed: memories.length,
    });
  } catch (err) {
    console.error('[Quest Generate]', err);
    return NextResponse.json({ error: 'Failed to generate quest' }, { status: 500 });
  }
}
