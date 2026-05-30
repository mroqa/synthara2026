'use client';
import { useState, useEffect } from 'react';
import { auth, db, doc, setDoc, collection } from '@/lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { createMemoryEvent } from '@/lib/memory';
import type { Player } from '@/types/player';
import type { Quest } from '@/types/quest';
import type { EpisodicMemory } from '@/types/memory';

interface NPCLocation {
  id: string;
  name: string;
  npc: string;
  npcRole: string;
  icon: string;
}

interface NPCDialogueProps {
  npc: NPCLocation;
  player: Player;
  onClose: () => void;
  onQuestAccepted: (quest: Quest, memory: EpisodicMemory) => void;
}

type Phase = 'greeting' | 'generating' | 'quest' | 'accepted' | 'declined';

const NPC_AVATARS: Record<string, string> = {
  'Mira the Wayfinder': '🧙‍♀️',
  'Archivist Soren': '📖',
  'Ghost of Commander Hael': '👻',
  'Shade': '🕶️',
  'Lord Malachar': '👁️',
};

export default function NPCDialogue({ npc, player, onClose, onQuestAccepted }: NPCDialogueProps) {
  const [phase, setPhase] = useState<Phase>('greeting');
  const [greeting, setGreeting] = useState('');
  const [quest, setQuest] = useState<Quest | null>(null);
  const [npcDialogueLine, setNpcDialogueLine] = useState('');
  const [memoriesUsed, setMemoriesUsed] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState('');

  const avatar = NPC_AVATARS[npc.npc] || '🗡️';

  // Typewriter effect
  const typeText = (text: string, onDone?: () => void) => {
    setDisplayedText('');
    setIsTyping(true);
    let i = 0;
    const speed = 25;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
        onDone?.();
      }
    }, speed);
    return () => clearInterval(interval);
  };

  useEffect(() => {
    // Generate greeting + quest simultaneously
    const init = async () => {
      const user = auth.currentUser;
      if (!user) return;

      // Quick atmospheric greeting while generating quest
      const greetings: Record<string, string> = {
        'Mira the Wayfinder': `${player.name}... the crossroads have been expecting you. My maps traced your path long before you walked it.`,
        'Archivist Soren': `Ah. Another who smells of smoke and secrets. I remember what you did, ${player.name}. The tomes remember everything.`,
        'Ghost of Commander Hael': `You stand on the bones of my army, ${player.name}. I have watched you since the beginning. We need to talk.`,
        'Shade': `*whispers* I've been selling your memories, ${player.name}. Don't be angry. Come. I have something to offer you in return.`,
        'Lord Malachar': `So. You finally arrive. I have been watching your every memory, ${player.name}. Every single one.`,
      };
      const g = greetings[npc.npc] || `${player.name}. I have been waiting for you.`;
      setGreeting(g);
      typeText(g);

      // Generate quest in background
      setPhase('generating');
      try {
        const res = await fetch('/api/quest/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            npcName: npc.npc,
            npcRole: npc.npcRole,
            playerId: user.uid,
            context: `${npc.name} ${npc.npcRole} quest for ${player.archetype} ${player.name}`,
          }),
        });
        const data = await res.json();
        if (data.quest) {
          setQuest(data.quest);
          setNpcDialogueLine(data.npcDialogue || '');
          setMemoriesUsed(data.memoriesUsed || 0);
          // Wait for typing to finish then show quest
          setTimeout(() => setPhase('quest'), 2500);
        } else {
          setError('The spirits are silent. Try again later.');
        }
      } catch (e) {
        setError('The veil interferes. Could not summon a quest.');
      }
    };
    init();
  }, []); // eslint-disable-line

  const handleAccept = async () => {
    if (!quest) return;
    const user = auth.currentUser;
    if (!user) return;
    setPhase('accepted');

    // Save quest to Firestore
    await setDoc(doc(db, 'players', user.uid, 'quests', quest.id), quest);

    // Write new memory event
    const memory = createMemoryEvent({
      actor: 'player',
      location: npc.name,
      entities: [npc.npc, quest.title],
      trigger: `quest_accepted_from_${npc.npc.replace(/\s+/g, '_').toLowerCase()}`,
      outcome: `Accepted quest "${quest.title}" from ${npc.npc}. Objectives: ${quest.objectives.slice(0, 2).join('; ')}.`,
      emotionalWeight: quest.rarity === 'legendary' ? 1.0 : quest.rarity === 'epic' ? 0.85 : quest.rarity === 'rare' ? 0.7 : 0.5,
      tags: ['quest_accepted', quest.rarity, npc.id, player.archetype.toLowerCase()],
      playerId: user.uid,
    });

    await fetch('/api/memory/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory),
    });

    onQuestAccepted(quest, memory);
  };

  const handleDecline = async () => {
    const user = auth.currentUser;
    if (!user || !quest) { onClose(); return; }
    setPhase('declined');

    // Write decline memory
    const memory = createMemoryEvent({
      actor: 'player',
      location: npc.name,
      entities: [npc.npc],
      trigger: `quest_declined_from_${npc.npc.replace(/\s+/g, '_').toLowerCase()}`,
      outcome: `Refused quest "${quest?.title || 'unknown'}" offered by ${npc.npc}. The NPC did not take it well.`,
      emotionalWeight: 0.4,
      tags: ['quest_declined', npc.id, player.archetype.toLowerCase()],
      playerId: user.uid,
    });
    await fetch('/api/memory/write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(memory),
    });
    setTimeout(onClose, 1500);
  };

  const rarityColor: Record<string, string> = {
    common: 'var(--rarity-common)', rare: 'var(--rarity-rare)',
    epic: 'var(--rarity-epic)', legendary: 'var(--rarity-legendary)',
  };

  return (
    <div className="dialogue-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="dialogue-box">

        {/* NPC Header */}
        <div style={{
          padding: 'clamp(1rem, 3vw, 1.5rem) clamp(1rem, 3vw, 1.5rem) 1rem',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
          background: 'linear-gradient(180deg, rgba(124,58,237,0.1), transparent)',
        }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.3), rgba(124,58,237,0.05))',
            border: '2px solid var(--color-border-bright)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.8rem', flexShrink: 0,
          }} className="animate-pulseGlow">
            {avatar}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--color-text-primary)', marginBottom: '0.2rem' }}>
              {npc.npc}
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontStyle: 'italic' }}>{npc.npcRole}</p>
          </div>
          {/* Memory recall indicator */}
          {phase === 'generating' && (
            <div className="memory-recall" style={{ flexShrink: 0 }}>
              <div className="memory-recall-dot" />
              <span style={{ display: 'inline' }}>Recalling...</span>
            </div>
          )}
          {(phase === 'quest' || phase === 'accepted') && memoriesUsed > 0 && (
            <div className="memory-recall" style={{ background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#34d399', flexShrink: 0 }}>
              <span>🧠</span>
              <span>{memoriesUsed}</span>
            </div>
          )}
          <button onClick={onClose} style={{ color: 'var(--color-text-muted)', fontSize: '1.2rem', padding: '0.25rem', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
        </div>

        {/* Dialogue Content */}
        <div style={{ padding: 'clamp(1rem, 3vw, 1.5rem)' }}>

          {/* NPC Greeting */}
          <div style={{
            background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)',
            borderRadius: 'var(--radius-md)', padding: '1rem 1.25rem', marginBottom: '1.25rem',
          }}>
            <p style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)', lineHeight: 1.8, fontSize: '0.9rem' }}>
              {phase === 'greeting' ? displayedText : greeting}
              {isTyping && phase === 'greeting' && (
                <span style={{ color: 'var(--color-arcane-light)', animation: 'memoryPulse 1s infinite' }}>▋</span>
              )}
            </p>
          </div>

          {/* Quest Offer */}
          {(phase === 'quest' || phase === 'accepted' || phase === 'declined') && quest && (
            <div className="animate-fadeInUp">
              {/* NPC quest dialogue line */}
              {npcDialogueLine && (
                <p style={{ color: 'var(--color-text-secondary)', fontStyle: 'italic', marginBottom: '1rem', fontSize: '0.875rem', lineHeight: 1.7 }}>
                  &ldquo;{npcDialogueLine}&rdquo;
                </p>
              )}

              {/* Quest scroll */}
              <div style={{
                background: 'var(--color-surface-2)',
                border: `1px solid ${rarityColor[quest.rarity] || 'var(--color-border)'}`,
                borderRadius: 'var(--radius-lg)', padding: '1.25rem',
                boxShadow: `0 4px 20px ${rarityColor[quest.rarity]}33`,
                marginBottom: '1.25rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-text-primary)', fontSize: '1rem', flex: 1 }}>
                    {quest.title}
                  </h3>
                  <span className="badge" style={{
                    background: `${rarityColor[quest.rarity]}22`,
                    color: rarityColor[quest.rarity],
                    border: `1px solid ${rarityColor[quest.rarity]}66`,
                    marginLeft: '0.5rem', flexShrink: 0,
                  }}>
                    {quest.rarity.toUpperCase()}
                  </span>
                </div>

                <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', lineHeight: 1.7, marginBottom: '1rem' }}>
                  {quest.description}
                </p>

                {/* Objectives */}
                <div style={{ marginBottom: '1rem' }}>
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '0.4rem' }}>
                    OBJECTIVES
                  </p>
                  {quest.objectives.map((obj, i) => (
                    <div key={i} style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', marginBottom: '0.3rem' }}>
                      <span style={{ color: 'var(--color-arcane-light)', fontSize: '0.8rem', flexShrink: 0, marginTop: '2px' }}>◆</span>
                      <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{obj}</span>
                    </div>
                  ))}
                </div>

                {/* Rewards */}
                <div style={{ display: 'flex', gap: '1rem', padding: '0.6rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-gold)' }}>💰 {quest.reward.gold} gold</span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--color-arcane-light)' }}>⭐ {quest.reward.xp} XP</span>
                  {quest.reward.item && <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>🗡️ {quest.reward.item}</span>}
                </div>
              </div>

              {/* Action buttons */}
              {phase === 'quest' && (
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button id="btn-accept-quest" className="btn btn-gold" onClick={handleAccept} style={{ flex: 1 }}>
                    ✦ Accept Quest
                  </button>
                  <button id="btn-decline-quest" className="btn btn-danger" onClick={handleDecline}>
                    Decline
                  </button>
                </div>
              )}

              {phase === 'accepted' && (
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ color: '#34d399', fontFamily: 'var(--font-display)', letterSpacing: '0.08em', fontSize: '0.9rem' }}>
                    ✦ Quest Accepted — Memory Written
                  </p>
                  <button className="btn btn-ghost btn-sm" onClick={onClose} style={{ marginTop: '0.5rem' }}>
                    Continue →
                  </button>
                </div>
              )}

              {phase === 'declined' && (
                <div style={{ textAlign: 'center', padding: '0.75rem', background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ color: '#f87171', fontSize: '0.85rem', fontStyle: 'italic' }}>
                    The NPC watches you leave. This refusal will be remembered.
                  </p>
                </div>
              )}
            </div>
          )}

          {error && (
            <p style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center', padding: '0.75rem' }}>{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
