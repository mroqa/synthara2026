import { NextRequest, NextResponse } from 'next/server';
import { embedText } from '@/lib/gemini';
import { upsertVector } from '@/lib/qdrant';
import { memoryToEmbeddingText, memoryToPayload } from '@/lib/memory';
import type { EpisodicMemory } from '@/types/memory';

export async function POST(req: NextRequest) {
  try {
    const memory: EpisodicMemory = await req.json();

    if (!memory.id || !memory.outcome || !memory.playerId) {
      return NextResponse.json({ error: 'Missing required memory fields' }, { status: 400 });
    }

    // Embed the memory's narrative text
    const embeddingText = memoryToEmbeddingText(memory);
    const vector = await embedText(embeddingText);

    // Store in Qdrant
    await upsertVector(memory.id, vector, memoryToPayload(memory));

    return NextResponse.json({ id: memory.id, embedded: true });
  } catch (err) {
    console.error('[Memory Write]', err);
    return NextResponse.json({ error: 'Failed to write memory' }, { status: 500 });
  }
}
