import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { pickRandomReward } from '@/lib/items';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

// Robust JSON extraction that handles markdown code block wrappers and extra chat text.
function extractJSON(text: string): any {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {}

  const cleaned = trimmed.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {}

  const match = trimmed.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {}
  }

  throw new Error('Invalid JSON format in model response');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { quest, player, stage, choiceHistory, selectedChoice } = body;

    if (!quest || !player) {
      return NextResponse.json({ error: 'Missing quest or player data' }, { status: 400 });
    }

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    // Calculate effective stats with equipped item boosts
    const equippedBoosts = (player.inventory ?? [])
      .filter((item: any) => player.equippedIds?.includes(item.id) && item.statBoost)
      .reduce(
        (acc: any, item: any) => {
          const b = item.statBoost;
          acc.strength += b.strength ?? 0;
          acc.wisdom += b.wisdom ?? 0;
          acc.stealth += b.stealth ?? 0;
          acc.charisma += b.charisma ?? 0;
          return acc;
        },
        { strength: 0, wisdom: 0, stealth: 0, charisma: 0 }
      );

    const effectiveStats = {
      strength: (player.stats.strength ?? 5) + equippedBoosts.strength,
      wisdom: (player.stats.wisdom ?? 5) + equippedBoosts.wisdom,
      stealth: (player.stats.stealth ?? 5) + equippedBoosts.stealth,
      charisma: (player.stats.charisma ?? 5) + equippedBoosts.charisma,
    };

    const statsBlock = `
Player: ${player.name} (${player.archetype}) — Level ${player.stats?.level ?? 1}
Effective Stats (with equipped gear):
- Strength: ${effectiveStats.strength}
- Wisdom: ${effectiveStats.wisdom}
- Stealth: ${effectiveStats.stealth}
- Charisma: ${effectiveStats.charisma}
Memories etched: ${player.memoriesCount ?? 0}
Quests completed: ${player.questsCompleted ?? 0}`;

    const currentStage = stage ?? 0;

    // ===== STAGE 0: Generate opening scenario + 3 choices =====
    if (currentStage === 0) {
      const prompt = `You are a dark fantasy game master for "Synthara", a memory-driven RPG.
${statsBlock}

Quest: "${quest.title}"
Offered by: ${quest.npc} (${quest.npcRole})
Description: ${quest.description}

Write the OPENING SCENARIO of this quest — a vivid atmospheric 3-4 sentence scene describing what the player encounters right as they begin. End with a meaningful decision moment.

Then present exactly 3 choices for the player. Each choice should require a different stat:
- One Strength-based action (physical/combat)
- One Wisdom/Stealth/Charisma-based action (smart/subtle/social)
- One high-risk high-reward "desperate gambit" that tests the player's weakest stat

Respond ONLY with valid JSON (no markdown, no explanation):
{
  "scenario": "The atmospheric opening paragraph(s) ending at a decision point.",
  "choices": [
    { "id": "a", "text": "Action description", "statUsed": "strength", "difficulty": 8, "icon": "⚔️" },
    { "id": "b", "text": "Action description", "statUsed": "wisdom", "difficulty": 7, "icon": "📖" },
    { "id": "c", "text": "Action description", "statUsed": "stealth", "difficulty": 9, "icon": "🌑" }
  ]
}`;

      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const data = extractJSON(text);
        return NextResponse.json({ stage: 0, ...data });
      } catch (err) {
        console.warn('[Quest Resolve Stage 0 AI Error, using fallback]', err);
        const fallback = {
          scenario: `You set out on the quest "${quest.title}". The dark woods of Synthara press in close, the silence heavy as old stone. Your contact, ${quest.npc}, spoke of threats on this path. Suddenly, you hear rustling in the undergrowth ahead.`,
          choices: [
            { id: 'a', text: 'Confront the threat directly with unsheathed steel.', statUsed: 'strength', difficulty: 8, icon: '⚔️' },
            { id: 'b', text: 'Analyze the rustling pattern to recognize the beast.', statUsed: 'wisdom', difficulty: 7, icon: '📖' },
            { id: 'c', text: 'Slip into the shadows and sneak around the noise.', statUsed: 'stealth', difficulty: 9, icon: '🌑' },
          ],
        };
        return NextResponse.json({ stage: 0, ...fallback });
      }
    }

    // ===== STAGE 1: Resolve choice 1, generate midpoint scenario + 3 new choices =====
    if (currentStage === 1) {
      const lastChoice = selectedChoice;
      const statValue = effectiveStats[lastChoice.statUsed as keyof typeof effectiveStats] ?? 5;
      const roll = Math.floor(Math.random() * 12) + 1 + Math.floor(statValue / 2);
      const choiceSuccess = roll >= lastChoice.difficulty;
      const historyText = `[Stage 1 choice: "${lastChoice.text}" — ${choiceSuccess ? 'SUCCESS' : 'PARTIAL SUCCESS'} (rolled ${roll} vs difficulty ${lastChoice.difficulty})]`;

      const prompt = `You are a dark fantasy game master for "Synthara".
${statsBlock}

Quest: "${quest.title}" — Stage 1 Outcome
Previous choice: ${historyText}

Write 3-4 sentences describing the immediate outcome of that choice (${choiceSuccess ? 'it worked well' : 'it partially worked with complications'}). Then describe the next crisis/obstacle they face in the middle of the quest.

Present 3 new choices for this midpoint crisis. Make them feel like natural escalations.

Respond ONLY with valid JSON:
{
  "choiceOutcome": "2-3 sentences about the immediate result of the choice just made.",
  "scenario": "2-3 sentences describing the new mid-quest situation and decision point.",
  "choiceSuccess": ${choiceSuccess},
  "choices": [
    { "id": "a", "text": "Action", "statUsed": "strength", "difficulty": 9, "icon": "⚔️" },
    { "id": "b", "text": "Action", "statUsed": "charisma", "difficulty": 8, "icon": "💬" },
    { "id": "c", "text": "Action", "statUsed": "wisdom", "difficulty": 10, "icon": "📖" }
  ]
}`;

      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const data = extractJSON(text);
        return NextResponse.json({ stage: 1, ...data });
      } catch (err) {
        console.warn('[Quest Resolve Stage 1 AI Error, using fallback]', err);
        const fallback = {
          choiceOutcome: choiceSuccess 
            ? `Your maneuver succeeded! You managed to overcome the obstacle with elegance, proving your mastery of ${lastChoice.statUsed}.`
            : `complications arose during your action, testing your limits, but you managed to push forward regardless.`,
          scenario: `A deeper mystery unfolds. The trail leads to an ancient stone altar covered in forgotten runes. Energy crackles in the air as a guardian shadow rises.`,
          choiceSuccess,
          choices: [
            { id: 'a', text: 'Shatter the altar to disperse the dark energy.', statUsed: 'strength', difficulty: 9, icon: '⚔️' },
            { id: 'b', text: 'Chant words of peace and ward off the shadow.', statUsed: 'charisma', difficulty: 8, icon: '💬' },
            { id: 'c', text: 'Decipher the ruins on the altar to seal the energy.', statUsed: 'wisdom', difficulty: 10, icon: '📖' },
          ],
        };
        return NextResponse.json({ stage: 1, ...fallback });
      }
    }

    // ===== STAGE 2: Final resolution — climax =====
    if (currentStage === 2) {
      const lastChoice = selectedChoice;
      const history = choiceHistory ?? [];
      const statValue = effectiveStats[lastChoice.statUsed as keyof typeof effectiveStats] ?? 5;
      const roll = Math.floor(Math.random() * 12) + 1 + Math.floor(statValue / 2);
      const finalChoiceSuccess = roll >= lastChoice.difficulty;

      // Overall success is weighted: if both choices succeeded = high success
      const totalSuccesses = history.filter((c: any) => c.success).length + (finalChoiceSuccess ? 1 : 0);
      const overallSuccess = totalSuccesses >= 2;

      // Pick item reward
      const itemReward = pickRandomReward(overallSuccess ? 'success' : 'failure');

      const prompt = `You are a dark fantasy game master for "Synthara".
${statsBlock}

Quest: "${quest.title}" — CLIMAX RESOLUTION
History: ${history.map((c: any) => `"${c.choice.text}" (${c.success ? 'succeeded' : 'failed'})`).join(' → ')}
Final choice: "${lastChoice.text}" — ${finalChoiceSuccess ? 'SUCCESS' : 'FAILURE'}
Overall outcome: ${overallSuccess ? 'VICTORY' : 'DARK DEFEAT'}

Write an epic climactic resolution narrative (3-4 vivid paragraphs, ~200 words). Make it atmospheric, personal, and reference the specific choices they made. End with a haunting final sentence that will echo in memory.

Respond ONLY with valid JSON:
{
  "success": ${overallSuccess},
  "finalChoiceSuccess": ${finalChoiceSuccess},
  "narrative": "Three dramatic paragraphs describing the climax and resolution.",
  "outcomeText": "One sentence summary of the final impact.",
  "statChanges": {
    "hp": ${overallSuccess ? -Math.floor(Math.random() * 15) : -Math.floor(Math.random() * 30 + 10)},
    "gold": ${overallSuccess ? quest.reward.gold : Math.floor(quest.reward.gold * 0.2)},
    "xp": ${overallSuccess ? quest.reward.xp : Math.floor(quest.reward.xp * 0.4)}
  },
  "narrativeEvents": ["event 1", "event 2", "event 3"],
  "tags": ["${overallSuccess ? 'victory' : 'defeat'}", "${quest.rarity}", "quest_resolved"]
}`;

      try {
        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const data = extractJSON(text);
        return NextResponse.json({
          stage: 2,
          itemReward,
          ...data,
        });
      } catch (err) {
        console.warn('[Quest Resolve Stage 2 AI Error, using fallback]', err);
        const fallback = {
          success: overallSuccess,
          finalChoiceSuccess,
          narrative: `You take your final stand. Gritting your teeth, you confront the culmination of this dark quest. The shadow surges, but you execute your final decision: "${lastChoice.text}". \n\nThe forces of Synthara clash around you. In a final, desperate burst of energy, the shadows recede, leaving you standing victorious but weary in the quiet ruins.`,
          outcomeText: overallSuccess ? "You stood tall against the darkness, securing absolute victory." : "You survived the encounter, though the mark of failure burns cold.",
          statChanges: {
            hp: overallSuccess ? -5 : -25,
            gold: overallSuccess ? quest.reward.gold : Math.floor(quest.reward.gold * 0.2),
            xp: overallSuccess ? quest.reward.xp : Math.floor(quest.reward.xp * 0.4),
          },
          narrativeEvents: ['quest_resolved', overallSuccess ? 'victory' : 'defeat'],
          tags: [overallSuccess ? 'victory' : 'defeat', quest.rarity, 'quest_resolved'],
        };
        return NextResponse.json({
          stage: 2,
          itemReward,
          ...fallback,
        });
      }
    }

    return NextResponse.json({ error: 'Invalid stage' }, { status: 400 });
  } catch (err) {
    console.error('[Quest Resolve]', err);
    return NextResponse.json({ error: 'Failed to resolve quest' }, { status: 500 });
  }
}
