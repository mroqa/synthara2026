import { NextRequest, NextResponse } from 'next/server';
import { embedText } from '@/lib/gemini';
import { searchVectors } from '@/lib/qdrant';
import type { MemorySearchResult } from '@/types/memory';

export async function POST(req: NextRequest) {
  try {
    const { query, limit = 5, playerId } = await req.json();

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 });
    }

    // Embed the search query
    const vector = await embedText(query);

    // Search Qdrant — optionally filter by playerId
    const filter = playerId
      ? { must: [{ key: 'playerId', match: { value: playerId } }] }
      : undefined;

    const results = await searchVectors(vector, limit, filter);

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

    return NextResponse.json({ memories });
  } catch (err) {
    console.error('[Memory Search]', err);
    return NextResponse.json({ error: 'Failed to search memories' }, { status: 500 });
  }
}
