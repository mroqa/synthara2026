'use client';
import { useState, useEffect, useCallback } from 'react';
import { auth, db, onAuthStateChanged, doc, getDoc, collection, getDocs, updateDoc } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import type { Player } from '@/types/player';
import type { Quest } from '@/types/quest';
import type { EpisodicMemory } from '@/types/memory';
import { createMemoryEvent } from '@/lib/memory';
import NPCDialogue from '@/components/NPC/NPCDialogue';
import StatusBar from '@/components/Game/StatusBar';

// World map locations with NPCs
const LOCATIONS = [
  { id: 'thornwood', name: 'Thornwood Crossroads', x: 28, y: 45, npc: 'Mira the Wayfinder', npcRole: 'ancient cartographer and oracle', icon: '🗺️', banner: '/banner_thornwood.png', locked: false },
  { id: 'veldrath', name: "Vel'Drath Library", x: 62, y: 22, npc: 'Archivist Soren', npcRole: 'forbidden knowledge keeper', icon: '📚', banner: '/banner_veldrath.png', locked: false },
  { id: 'ashfeld', name: 'Ashfeld Ruins', x: 75, y: 65, npc: 'Ghost of Commander Hael', npcRole: 'fallen warlord spirit', icon: '💀', banner: '/banner_ashfeld.png', locked: false },
  { id: 'veil', name: 'The Veil Market', x: 42, y: 72, npc: "Shade", npcRole: 'black market dealer of stolen memories', icon: '🌑', banner: '/banner_veil.png', locked: false },
  { id: 'citadel', name: 'The Black Citadel', x: 55, y: 38, npc: 'Lord Malachar', npcRole: 'dark overlord who fears your past', icon: '🏰', banner: '/banner_citadel.png', locked: true },
];

const SCENE_NARRATIVES: Record<string, string> = {
  thornwood: 'The crossroads whispers with the wind. Broken signposts point to forgotten kingdoms. Mira stands here, her maps etched with memory-ink.',
  veldrath: 'Charred shelves still hold their forbidden secrets. Archivist Soren never leaves — he cannot. The tomes will not allow it.',
  ashfeld: "Bones of an army litter the field. The air smells of iron and regret. Commander Hael's ghost flickers at the treeline.",
  veil: "Lanterns made of captured souls light the market stalls. Shade doesn't sell goods — they sell other people's memories.",
  citadel: 'The Black Citadel looms over the world like a wound. Lord Malachar watches from his tower, unblinking, waiting for your arrival.',
};

const CITADEL_UNLOCK_THRESHOLD = 3;

export default function GamePage() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [activeLocation, setActiveLocation] = useState('thornwood');
  const [npcDialogueOpen, setNpcDialogueOpen] = useState(false);
  const [activeNPC, setActiveNPC] = useState(LOCATIONS[0]);
  const [loading, setLoading] = useState(true);
  const [recentMemory, setRecentMemory] = useState<EpisodicMemory | null>(null);
  const [lockedTooltip, setLockedTooltip] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/'); return; }
      try {
        const snap = await getDoc(doc(db, 'players', user.uid));
        if (!snap.exists()) { router.push('/create'); return; }
        setPlayer(snap.data() as Player);
        const qSnap = await getDocs(collection(db, 'players', user.uid, 'quests'));
        setQuests(qSnap.docs.map((d: any) => d.data() as Quest));
      } catch (e) { console.error(e); }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const memoriesCount = player?.memoriesCount ?? 0;
  const citadelUnlocked = memoriesCount >= CITADEL_UNLOCK_THRESHOLD;

  const handleLocationClick = (loc: typeof LOCATIONS[0]) => {
    if (loc.id === 'citadel' && !citadelUnlocked) {
      setLockedTooltip(true);
      setTimeout(() => setLockedTooltip(false), 3000);
      return;
    }
    setActiveLocation(loc.id);
    setActiveNPC(loc);
    setLockedTooltip(false);
  };

  const handleTalkToNPC = () => setNpcDialogueOpen(true);

  const handleQuestAccepted = useCallback(async (quest: Quest, memory: EpisodicMemory) => {
    const user = auth.currentUser;
    if (!user || !player) return;
    setQuests(prev => [quest, ...prev]);
    setRecentMemory(memory);
    try {
      await updateDoc(doc(db, 'players', user.uid), {
        memoriesCount: (player.memoriesCount || 0) + 1,
      });
      setPlayer(p => p ? { ...p, memoriesCount: (p.memoriesCount || 0) + 1 } : p);
    } catch (e) { console.error(e); }
  }, [player]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-void)', flexDirection: 'column', gap: '1rem' }}>
        <div className="animate-pulseGlow" style={{ fontSize: '3rem' }}>🔮</div>
        <p style={{ fontFamily: 'var(--font-display)', color: 'var(--color-arcane-light)', letterSpacing: '0.2em', fontSize: '0.85rem' }}>
          LOADING MEMORIES...
        </p>
      </div>
    );
  }

  const activeQuests = quests.filter(q => q.status === 'active');
  const loc = LOCATIONS.find(l => l.id === activeLocation) || LOCATIONS[0];

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--color-void)', overflow: 'hidden' }}>

      {/* Top Nav */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--color-border)',
        background: 'rgba(12,12,20,0.95)', backdropFilter: 'blur(12px)', zIndex: 10,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.2rem' }}>🔮</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.15em', color: 'var(--color-text-primary)' }}>
            SYNTHARA
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a href="/game/memory" className="btn btn-ghost btn-sm">🧠 Memory Log</a>
          <a href="/game/quests" className="btn btn-ghost btn-sm">📜 Quests</a>
          <a href="/game/profile" className="btn btn-ghost btn-sm">⚔ {player?.name || 'Traveler'}</a>
        </div>
      </nav>

      {/* Main Game Area */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '220px 1fr 280px', overflow: 'hidden' }}>

        {/* Left: World Map */}
        <div style={{
          borderRight: '1px solid var(--color-border)',
          background: 'var(--color-abyss)',
          padding: '1rem',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', gap: '0.75rem',
        }}>
          <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', letterSpacing: '0.15em' }}>WORLD MAP</h4>

          {/* Map visual */}
          <div style={{
            position: 'relative', width: '100%', aspectRatio: '1',
            background: 'radial-gradient(ellipse at 50% 50%, rgba(124,58,237,0.08), transparent 70%)',
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
            overflow: 'hidden',
          }}>
            <div style={{ position: 'absolute', inset: 0, background: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(0,0,0,0.1) 10px, rgba(0,0,0,0.1) 11px)' }} />
            {LOCATIONS.map((l) => {
              const isLocked = l.id === 'citadel' && !citadelUnlocked;
              return (
                <button
                  key={l.id}
                  id={`location-${l.id}`}
                  className="map-location"
                  onClick={() => handleLocationClick(l)}
                  title={isLocked ? `Locked — ${CITADEL_UNLOCK_THRESHOLD} memories required` : l.name}
                  style={{
                    left: `${l.x}%`, top: `${l.y}%`,
                    transform: 'translate(-50%, -50%)',
                    background: isLocked
                      ? 'rgba(60,60,80,0.5)'
                      : l.id === activeLocation ? 'var(--color-gold)' : 'var(--color-arcane)',
                    borderColor: isLocked
                      ? 'rgba(100,100,120,0.4)'
                      : l.id === activeLocation ? 'var(--color-gold-light)' : 'var(--color-arcane-light)',
                    boxShadow: l.id === activeLocation && !isLocked ? 'var(--shadow-gold)' : undefined,
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    opacity: isLocked ? 0.5 : 1,
                    fontSize: isLocked ? '0.7rem' : undefined,
                  }}
                >
                  {isLocked ? '🔒' : ''}
                </button>
              );
            })}
          </div>

          {/* Citadel locked tooltip */}
          {lockedTooltip && (
            <div className="animate-fadeIn" style={{
              padding: '0.6rem 0.8rem',
              background: 'rgba(220,38,38,0.1)',
              border: '1px solid rgba(220,38,38,0.3)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.72rem', color: '#f87171', lineHeight: 1.5,
            }}>
              🔒 <strong>The Black Citadel</strong> is sealed. You must inscribe {CITADEL_UNLOCK_THRESHOLD} memories before Malachar acknowledges your existence.
              <span style={{ color: 'var(--color-text-muted)', display: 'block', marginTop: '0.2rem' }}>
                {memoriesCount}/{CITADEL_UNLOCK_THRESHOLD} memories
              </span>
            </div>
          )}

          {/* Location list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
            {LOCATIONS.map((l) => {
              const isLocked = l.id === 'citadel' && !citadelUnlocked;
              return (
                <button
                  key={l.id}
                  onClick={() => handleLocationClick(l)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    padding: '0.4rem 0.6rem', borderRadius: 'var(--radius-sm)',
                    background: l.id === activeLocation && !isLocked ? 'rgba(124,58,237,0.15)' : 'transparent',
                    border: `1px solid ${l.id === activeLocation && !isLocked ? 'rgba(124,58,237,0.4)' : 'transparent'}`,
                    color: isLocked
                      ? 'rgba(100,100,120,0.6)'
                      : l.id === activeLocation ? 'var(--color-arcane-light)' : 'var(--color-text-muted)',
                    fontSize: '0.75rem', textAlign: 'left', width: '100%',
                    cursor: isLocked ? 'not-allowed' : 'pointer',
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <span>{isLocked ? '🔒' : l.icon}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.72rem', lineHeight: 1.2 }}>
                    {l.name}
                    {isLocked && (
                      <span style={{ display: 'block', fontSize: '0.6rem', color: 'rgba(100,100,120,0.5)', fontFamily: 'monospace' }}>
                        {memoriesCount}/{CITADEL_UNLOCK_THRESHOLD} memories
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Main Viewport */}
        <div style={{
          display: 'flex', flexDirection: 'column',
          background: 'radial-gradient(ellipse at 50% 100%, rgba(124,58,237,0.06), transparent 60%)',
          overflow: 'auto',
        }}>
          {/* Location Banner */}
          <div style={{
            height: '180px',
            position: 'relative',
            backgroundImage: `url(${loc.banner})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(12,12,20,0.9) 85%, var(--color-void) 100%)',
            }} />
            <div style={{ position: 'absolute', bottom: '1rem', left: '2rem', right: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.2rem' }}>
                <span style={{ fontSize: '1.5rem' }}>{loc.icon}</span>
                <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
                  {loc.name}
                </h2>
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.78rem', fontFamily: 'var(--font-mono)' }}>
                NPC: <span style={{ color: 'var(--color-arcane-light)' }}>{loc.npc}</span>
                <span style={{ marginLeft: '0.5rem', color: 'rgba(255,255,255,0.4)' }}>— {loc.npcRole}</span>
              </p>
            </div>
          </div>

          {/* Narrative area */}
          <div style={{ flex: 1, padding: '1.5rem 2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {/* Scene description */}
            <div className="glass-panel" style={{ padding: '1.5rem' }}>
              <p style={{ fontStyle: 'italic', color: 'var(--color-text-secondary)', lineHeight: 1.9, fontSize: '0.95rem' }}>
                {SCENE_NARRATIVES[activeLocation]}
              </p>
            </div>

            {/* Citadel locked message in center */}
            {activeLocation === 'citadel' && !citadelUnlocked && (
              <div className="animate-fadeIn" style={{
                padding: '1.25rem 1.5rem',
                background: 'rgba(220,38,38,0.07)',
                border: '1px solid rgba(220,38,38,0.2)',
                borderRadius: 'var(--radius-md)',
              }}>
                <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#f87171', marginBottom: '0.4rem', letterSpacing: '0.08em' }}>
                  🔒 SEALED BY DARK PACT
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', lineHeight: 1.7 }}>
                  Lord Malachar will not entertain you yet. He watches only those whose memories run deep — those who have suffered, triumphed, and been changed by Synthara. Return when you carry more of its history within you.
                </p>
                <div style={{ marginTop: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${Math.min(100, (memoriesCount / CITADEL_UNLOCK_THRESHOLD) * 100)}%`,
                      background: 'linear-gradient(90deg, #dc2626, #f87171)',
                      borderRadius: '2px', transition: 'width 0.5s',
                    }} />
                  </div>
                  <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: '#f87171', whiteSpace: 'nowrap' }}>
                    {memoriesCount} / {CITADEL_UNLOCK_THRESHOLD} memories
                  </span>
                </div>
              </div>
            )}

            {/* Recent memory flash */}
            {recentMemory && (
              <div className="animate-fadeIn" style={{
                padding: '1rem 1.25rem',
                background: 'rgba(124,58,237,0.1)',
                border: '1px solid rgba(124,58,237,0.3)',
                borderRadius: 'var(--radius-md)',
              }}>
                <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-arcane-light)', marginBottom: '0.3rem' }}>
                  🧠 NEW MEMORY WRITTEN TO QDRANT
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                  &ldquo;{recentMemory.outcome}&rdquo;
                </p>
              </div>
            )}

            {/* Talk button — only show if not locked citadel */}
            {!(activeLocation === 'citadel' && !citadelUnlocked) && (
              <button
                id="btn-talk-npc"
                className="btn btn-primary"
                onClick={handleTalkToNPC}
                style={{ alignSelf: 'flex-start', fontSize: '0.85rem' }}
              >
                💬 Approach {loc.npc}
              </button>
            )}
          </div>
        </div>

        {/* Right: Quest Panel */}
        <div style={{
          borderLeft: '1px solid var(--color-border)',
          background: 'var(--color-abyss)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--color-border)' }}>
            <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', letterSpacing: '0.15em' }}>
              ACTIVE QUESTS ({activeQuests.length})
            </h4>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {activeQuests.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📭</div>
                <p>No active quests.<br />Speak to an NPC to begin.</p>
              </div>
            ) : (
              activeQuests.map((q) => (
                <div key={q.id} className={`quest-card rarity-${q.rarity}`} style={{ padding: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--color-text-primary)', lineHeight: 1.3 }}>
                      {q.title}
                    </span>
                    <span className="badge" style={{
                      background: `rgba(var(--rarity-color), 0.15)`,
                      color: `var(--rarity-${q.rarity})`,
                      border: `1px solid var(--rarity-${q.rarity})`,
                      flexShrink: 0, marginLeft: '0.5rem', fontSize: '0.65rem',
                    }}>
                      {q.rarity}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginBottom: '0.5rem', lineHeight: 1.5 }}>
                    {q.npc}
                  </p>
                  <div style={{ display: 'flex', gap: '0.5rem', fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    <span>💰 {q.reward.gold}</span>
                    <span>⭐ {q.reward.xp} XP</span>
                  </div>
                </div>
              ))
            )}
          </div>
          <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
            <a href="/game/quests" className="btn btn-ghost btn-sm w-full" style={{ justifyContent: 'center' }}>
              View All Quests →
            </a>
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <StatusBar player={player} />

      {/* NPC Dialogue */}
      {npcDialogueOpen && player && (
        <NPCDialogue
          npc={activeNPC}
          player={player}
          onClose={() => setNpcDialogueOpen(false)}
          onQuestAccepted={handleQuestAccepted}
        />
      )}
    </div>
  );
}
