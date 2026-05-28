import { GoogleGenerativeAI } from '@google/generative-ai';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

let _genAI: GoogleGenerativeAI | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    _genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  }
  return _genAI;
}

// ─── Text Embeddings ────────────────────────────────────────────────────────

export async function embedText(text: string): Promise<number[]> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'text-embedding-004' });
  const result = await model.embedContent(text);
  return result.embedding.values;
}

// ─── Quest Generation ────────────────────────────────────────────────────────

export interface GeneratedQuest {
  title: string;
  description: string;
  objectives: string[];
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  reward: { gold: number; xp: number; item?: string };
  memoryContext: string[];
  npcDialogue: string;
}

export async function generateQuest(
  npcName: string,
  npcRole: string,
  memories: Array<{ id: string; outcome: string; trigger: string; timestamp: string; location: string }>
): Promise<GeneratedQuest> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const memorySummary = memories.length > 0
    ? memories.map((m, i) =>
        `[Memory ${i + 1}] ID:${m.id} | Location: ${m.location} | Trigger: ${m.trigger} | Outcome: ${m.outcome}`
      ).join('\n')
    : 'No prior memories found. This is the player\'s first encounter.';

  const prompt = `You are ${npcName}, a ${npcRole} in the dark fantasy world of Synthara.

You have recalled the following memories about this traveler:
${memorySummary}

Based on these specific events from their past, craft ONE compelling quest that:
1. References at least one past memory by name or event
2. Creates meaningful consequences or continuations of past actions
3. Matches your role and dark fantasy persona
4. Feels personal, not generic

Also write a short in-character dialogue line you would say when offering this quest.

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "title": "Quest title (max 6 words)",
  "description": "2-3 sentence quest description in your NPC voice, referencing past events",
  "objectives": ["objective 1", "objective 2", "objective 3"],
  "rarity": "common|rare|epic|legendary",
  "reward": { "gold": 0, "xp": 0, "item": "optional item name or null" },
  "memoryContext": ["memory_id_1"],
  "npcDialogue": "Short 1-2 sentence NPC opening line when offering the quest"
}`;

  const result = await model.generateContent(prompt);
  const text = result.response.text().trim();

  // Strip markdown code fences if present
  const json = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');

  try {
    return JSON.parse(json) as GeneratedQuest;
  } catch {
    // Fallback quest if parsing fails
    return {
      title: 'Echoes of the Past',
      description: `${npcName} has sensed dark forces tied to your history. Something stirs in the shadows.`,
      objectives: ['Investigate the disturbance', 'Report back to ' + npcName],
      rarity: 'common',
      reward: { gold: 50, xp: 100 },
      memoryContext: memories.map((m) => m.id),
      npcDialogue: `I have heard whispers of your deeds, traveler. The shadows speak your name.`,
    };
  }
}

// ─── NPC Reflection ──────────────────────────────────────────────────────────

export async function generateNPCReflection(
  npcName: string,
  npcRole: string,
  playerName: string,
  memories: Array<{ outcome: string; timestamp: string }>
): Promise<string> {
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const memorySummary = memories
    .slice(0, 3)
    .map((m) => m.outcome)
    .join('. ');

  const prompt = `You are ${npcName}, a ${npcRole} in the dark fantasy world of Synthara.
  
You are greeting the traveler named ${playerName}. You remember these things about them:
${memorySummary}

Write 1-2 sentences of atmospheric, in-character greeting that acknowledges their history. Be cryptic and dark fantasy in tone. No more than 40 words.`;

  const result = await model.generateContent(prompt);
  return result.response.text().trim();
}
