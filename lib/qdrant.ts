import { QdrantClient } from '@qdrant/js-client-rest';

const QDRANT_URL = process.env.QDRANT_URL!;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY!;
export const COLLECTION_NAME = process.env.QDRANT_COLLECTION || 'synthara_memories';
export const VECTOR_SIZE = 3072; // gemini-embedding-2 dimension

let _client: QdrantClient | null = null;

export function getQdrantClient(): QdrantClient {
  if (!_client) {
    _client = new QdrantClient({
      url: QDRANT_URL,
      apiKey: QDRANT_API_KEY,
    });
  }
  return _client;
}

export async function ensureCollection(): Promise<void> {
  const client = getQdrantClient();
  try {
    await client.getCollection(COLLECTION_NAME);
  } catch {
    // Collection doesn't exist — create it
    await client.createCollection(COLLECTION_NAME, {
      vectors: {
        size: VECTOR_SIZE,
        distance: 'Cosine',
      },
    });
    console.log(`[Qdrant] Created collection: ${COLLECTION_NAME}`);
  }

  // Ensure 'playerId' has a payload index of type 'keyword' for filtering
  try {
    await client.createPayloadIndex(COLLECTION_NAME, {
      field_name: 'playerId',
      field_schema: 'keyword',
      wait: true,
    });
    console.log(`[Qdrant] Ensured payload index on 'playerId'`);
  } catch (err) {
    console.warn(`[Qdrant] Warning ensuring payload index:`, err);
  }
}

export async function upsertVector(
  id: string,
  vector: number[],
  payload: Record<string, unknown>
): Promise<void> {
  const client = getQdrantClient();
  await ensureCollection();
  await client.upsert(COLLECTION_NAME, {
    wait: true,
    points: [{ id, vector, payload }],
  });
}

export async function searchVectors(
  queryVector: number[],
  limit = 5,
  filter?: Record<string, unknown>
): Promise<Array<{ id: string; score: number; payload: Record<string, unknown> }>> {
  const client = getQdrantClient();
  await ensureCollection();
  const results = await client.search(COLLECTION_NAME, {
    vector: queryVector,
    limit,
    with_payload: true,
    ...(filter ? { filter } : {}),
  });
  return results.map((r) => ({
    id: String(r.id),
    score: r.score,
    payload: (r.payload as Record<string, unknown>) || {},
  }));
}
