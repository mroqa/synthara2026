'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, onAuthStateChanged, doc, getDoc, collection, getDocs, updateDoc, setDoc } from '@/lib/firebase';
import type { Player, InventoryItem } from '@/types/player';
import type { Quest } from '@/types/quest';
import { createMemoryEvent } from '@/lib/memory';
import StatusBar from '@/components/Game/StatusBar';

type Tab = 'active' | 'completed' | 'failed';

interface QuestChoice {
  id: string;
  text: string;
  statUsed: string;
  difficulty: number;
  icon: string;
}

interface StageData {
  stage: number;
  scenario?: string;
  choiceOutcome?: string;
  choiceSuccess?: boolean;
  choices?: QuestChoice[];
  // Final stage
  success?: boolean;
  finalChoiceSuccess?: boolean;
  narrative?: string;
  outcomeText?: string;
  statChanges?: { hp: number; gold: number; xp: number };
  narrativeEvents?: string[];
  tags?: string[];
  itemReward?: InventoryItem | null;
}

interface ChoiceHistoryEntry {
  choice: QuestChoice;
  success: boolean;
}

const STAT_COLORS: Record<string, string> = {
  strength: '#ef4444',
  wisdom: '#a855f7',
  stealth: '#f59e0b',
  charisma: '#06b6d4',
};

const LOCATION_BANNERS: Record<string, string> = {
  thornwood: '/banner_thornwood.png',
  veldrath: '/banner_veldrath.png',
  ashfeld: '/banner_ashfeld.png',
  veil: '/banner_veil.png',
  citadel: '/banner_citadel.png',
};

function getBanner(quest: Quest): string {
  const role = (quest.npcRole ?? '').toLowerCase();
  const title = (quest.title ?? '').toLowerCase();
  if (role.includes('citadel') || title.includes('citadel') || quest.npc === 'Lord Malachar') return LOCATION_BANNERS.citadel;
  if (role.includes('library') || role.includes('archivist') || quest.npc?.includes('Soren')) return LOCATION_BANNERS.veldrath;
  if (role.includes('ruins') || role.includes('ghost') || role.includes('warlord')) return LOCATION_BANNERS.ashfeld;
  if (role.includes('market') || role.includes('shade') || role.includes('memory')) return LOCATION_BANNERS.veil;
  return LOCATION_BANNERS.thornwood;
}

export default function QuestsPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('active');
  const [loading, setLoading] = useState(true);
  const [selectedQuest, setSelectedQuest] = useState<Quest | null>(null);

  // CYA Adventure State
  const [adventureOpen, setAdventureOpen] = useState(false);
  const [adventureStage, setAdventureStage] = useState<0 | 1 | 2 | 3>(0); // 3 = done
  const [stageData, setStageData] = useState<StageData | null>(null);
  const [choiceHistory, setChoiceHistory] = useState<ChoiceHistoryEntry[]>([]);
  const [loadingStage, setLoadingStage] = useState(false);
  const [adventureError, setAdventureError] = useState('');
  const [writingMemory, setWritingMemory] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<QuestChoice | null>(null);
  const [choiceAnimating, setChoiceAnimating] = useState(false);

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

  const callResolve = async (stage: number, choice?: QuestChoice, history?: ChoiceHistoryEntry[]) => {
    setLoadingStage(true);
    setAdventureError('');
    try {
      const res = await fetch('/api/quest/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quest: selectedQuest,
          player,
          stage,
          selectedChoice: choice,
          choiceHistory: history,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setAdventureError(data.error);
        return null;
      }
      return data as StageData;
    } catch {
      setAdventureError('Lost connection to the Synthara oracle...');
      return null;
    } finally {
      setLoadingStage(false);
    }
  };

  const handleEmbark = async (quest: Quest) => {
    setSelectedQuest(quest);
    setAdventureStage(0);
    setStageData(null);
    setChoiceHistory([]);
    setPendingChoice(null);
    setAdventureError('');
    setAdventureOpen(true);
    setLoadingStage(true);

    const data = await callResolve(0);
    if (data) setStageData(data);
  };

  const handleChoice = async (choice: QuestChoice) => {
    if (choiceAnimating) return;
    setChoiceAnimating(true);
    setPendingChoice(choice);

    // Brief delay for animation
    await new Promise(r => setTimeout(r, 600));
    setChoiceAnimating(false);

    const currentStage = adventureStage;

    if (currentStage === 0) {
      const data = await callResolve(1, choice, choiceHistory);
      if (data) {
        const entrySuccess = data.choiceSuccess ?? false;
        setChoiceHistory(prev => [...prev, { choice, success: entrySuccess }]);
        setStageData(data);
        setAdventureStage(1);
      }
    } else if (currentStage === 1) {
      const data = await callResolve(2, choice, choiceHistory);
      if (data) {
        const finalChoiceSuccess = data.finalChoiceSuccess ?? false;
        setChoiceHistory(prev => [...prev, { choice, success: finalChoiceSuccess }]);
        setStageData(data);
        setAdventureStage(3);
      }
    }
    setPendingChoice(null);
  };

  const handleClaimRewards = async () => {
    const user = auth.currentUser;
    if (!user || !player || !selectedQuest || !stageData) return;
    setWritingMemory(true);

    try {
      const { success, outcomeText, statChanges, tags, itemReward } = stageData;
      const newStatus = success ? 'completed' : 'failed';

      // 1. Update Quest
      const updatedQuest: Quest = {
        ...selectedQuest,
        status: newStatus,
        completedAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'players', user.uid, 'quests', selectedQuest.id), updatedQuest);

      // 2. Write episodic memory
      const memory = createMemoryEvent({
        actor: 'player',
        location: selectedQuest.npcRole?.includes('citadel') ? 'The Black Citadel' : 'Synthara Ruins',
        entities: [selectedQuest.npc, selectedQuest.title],
        trigger: `quest_${newStatus}_${selectedQuest.id}`,
        outcome: `${player.name} completed quest "${selectedQuest.title}". ${outcomeText} Choices made: ${choiceHistory.map(h => h.choice.text).join('; ')}.`,
        emotionalWeight: success ? 0.7 : 0.9,
        tags: [...(tags ?? []), newStatus, player.archetype.toLowerCase()],
        playerId: user.uid,
      });

      await fetch('/api/memory/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(memory),
      });

      // 3. Build updated player stats
      const sc = statChanges ?? { hp: 0, gold: 0, xp: 0 };
      const newGold = Math.max(0, player.stats.gold + (success ? selectedQuest.reward.gold : Math.floor(selectedQuest.reward.gold * 0.2)));
      const newHp = Math.max(0, Math.min(player.stats.maxHp, player.stats.hp + sc.hp));
      const xpEarned = success ? selectedQuest.reward.xp : Math.floor(selectedQuest.reward.xp * 0.4);
      let newXp = player.stats.xp + xpEarned;
      let newLevel = player.stats.level;
      const xpNeeded = newLevel * 100;
      let levelUp = false;
      if (newXp >= xpNeeded) { newXp -= xpNeeded; newLevel += 1; levelUp = true; }

      const updatedStats = {
        ...player.stats,
        hp: newHp, gold: newGold, xp: newXp, level: newLevel,
        strength: player.stats.strength + (levelUp ? 2 : 0),
        wisdom: player.stats.wisdom + (levelUp ? 2 : 0),
        stealth: player.stats.stealth + (levelUp ? 2 : 0),
        charisma: player.stats.charisma + (levelUp ? 2 : 0),
      };

      // 4. Add item to inventory if rewarded
      const newInventory = [...(player.inventory ?? [])];
      if (itemReward && !newInventory.find(i => i.id === itemReward.id)) {
        newInventory.push({ ...itemReward, equipped: false });
      }

      await updateDoc(doc(db, 'players', user.uid), {
        stats: updatedStats,
        questsCompleted: player.questsCompleted + (success ? 1 : 0),
        memoriesCount: player.memoriesCount + 1,
        inventory: newInventory,
      });

      setPlayer(p => p ? {
        ...p,
        stats: updatedStats,
        questsCompleted: p.questsCompleted + (success ? 1 : 0),
        memoriesCount: p.memoriesCount + 1,
        inventory: newInventory,
      } : null);

      setQuests(prev => prev.map(q => q.id === selectedQuest.id ? updatedQuest : q));
      setAdventureStage(3);
    } catch (e) {
      console.error(e);
    }
    setWritingMemory(false);
  };

  const closeAdventure = () => {
    setAdventureOpen(false);
    setSelectedQuest(null);
    setStageData(null);
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-void)', flexDirection: 'column', gap: '1rem' }}>
        <div className="animate-pulseGlow" style={{ fontSize: '3rem' }}>🔮</div>
        <p style={{ fontFamily: 'var(--font-display)', color: 'var(--color-arcane-light)', letterSpacing: '0.2em', fontSize: '0.85rem' }}>
          LOADING QUESTS...
        </p>
      </div>
    );
  }

  const filteredQuests = quests.filter(q => q.status === activeTab);
  const rarityColor: Record<string, string> = {
    common: 'var(--rarity-common)',
    rare: 'var(--rarity-rare)',
    epic: 'var(--rarity-epic)',
    legendary: 'var(--rarity-legendary)',
  };

  const statColor = (stat: string) => STAT_COLORS[stat] ?? 'var(--color-text-secondary)';

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
          <a href="/game" style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.15em', color: 'var(--color-text-primary)' }}>SYNTHARA</a>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a href="/game/memory" className="btn btn-ghost btn-sm">🧠 Memory Log</a>
          <a href="/game/quests" className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--color-gold)', color: 'var(--color-gold)' }}>📜 Quests</a>
          <a href="/game/profile" className="btn btn-ghost btn-sm">⚔ {player?.name || 'Traveler'}</a>
        </div>
      </nav>

      {/* Quests Main */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        <div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
            <span style={{ fontSize: '1.8rem' }}>📜</span>
            <h1 style={{ fontSize: '1.8rem', letterSpacing: '0.05em', color: 'var(--color-text-primary)' }}>Quest Board</h1>
          </div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
            Choose your path wisely — each decision shapes your legend.
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', gap: '0.5rem' }}>
          {(['active', 'completed', 'failed'] as Tab[]).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '0.75rem 1.5rem', fontSize: '0.8rem', fontFamily: 'var(--font-display)',
              letterSpacing: '0.1em', textTransform: 'uppercase',
              borderBottom: `2px solid ${activeTab === tab ? 'var(--color-gold)' : 'transparent'}`,
              color: activeTab === tab ? 'var(--color-gold)' : 'var(--color-text-muted)',
              cursor: 'pointer', transition: 'all var(--transition-fast)',
            }}>
              {tab} ({quests.filter(q => q.status === tab).length})
            </button>
          ))}
        </div>

        {/* Quest Grid */}
        {filteredQuests.length === 0 ? (
          <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'var(--color-text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📭</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--color-text-secondary)' }}>No Quests Found</h3>
            <p style={{ fontSize: '0.85rem' }}>
              {activeTab === 'active'
                ? 'Speak to NPCs on the World Map to acquire new quests crafted from your memories.'
                : `No quests are currently marked as ${activeTab}.`}
            </p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {filteredQuests.map((q) => (
              <div key={q.id} className={`quest-card rarity-${q.rarity}`} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '260px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                    <span className="badge" style={{ background: `${rarityColor[q.rarity]}22`, color: rarityColor[q.rarity], border: `1px solid ${rarityColor[q.rarity]}55` }}>
                      {q.rarity}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(q.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: 'var(--color-text-primary)', marginBottom: '0.5rem', lineHeight: 1.4 }}>
                    {q.title}
                  </h3>
                  <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-arcane-light)', marginBottom: '0.75rem' }}>
                    ✦ From: {q.npc} <span style={{ color: 'var(--color-text-muted)' }}>({q.npcRole})</span>
                  </p>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.82rem', lineHeight: 1.6, marginBottom: '1rem' }}>
                    {q.description}
                  </p>
                  <div style={{ marginBottom: '1.25rem' }}>
                    <p style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                      Objectives
                    </p>
                    {q.objectives.map((obj, i) => (
                      <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                        <span style={{ color: q.status === 'completed' ? 'var(--color-emerald)' : 'var(--color-arcane-light)', fontSize: '0.75rem' }}>
                          {q.status === 'completed' ? '✔' : '◆'}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: q.status === 'completed' ? 'var(--color-text-muted)' : 'var(--color-text-secondary)', textDecoration: q.status === 'completed' ? 'line-through' : 'none' }}>
                          {obj}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', fontSize: '0.75rem' }}>
                      <span style={{ color: 'var(--color-gold)' }}>💰 {q.reward.gold}</span>
                      <span style={{ color: 'var(--color-arcane-light)' }}>⭐ {q.reward.xp} XP</span>
                    </div>
                    {q.status === 'active' && (
                      <button className="btn btn-gold btn-sm" onClick={() => handleEmbark(q)} style={{ padding: '0.35rem 0.75rem' }}>
                        ⚔ Embark
                      </button>
                    )}
                    {q.status === 'completed' && <span className="badge badge-green">Completed</span>}
                    {q.status === 'failed' && <span className="badge badge-red">Failed</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════
          CHOOSE-YOUR-OWN-ADVENTURE OVERLAY
          ═══════════════════════════════════════════ */}
      {adventureOpen && selectedQuest && (
        <div className="dialogue-overlay" style={{ zIndex: 100 }}>
          <div style={{
            width: '100%', maxWidth: '680px',
            background: 'var(--color-abyss)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            maxHeight: '90vh',
            boxShadow: '0 0 60px rgba(124,58,237,0.2)',
          }}>

            {/* Banner */}
            <div style={{
              height: '160px', position: 'relative', overflow: 'hidden',
              backgroundImage: `url(${getBanner(selectedQuest)})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              flexShrink: 0,
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                background: 'linear-gradient(to bottom, rgba(0,0,0,0.3) 0%, rgba(12,12,20,0.95) 100%)',
              }} />
              {/* Stage indicator */}
              <div style={{ position: 'absolute', top: '1rem', right: '1rem', display: 'flex', gap: '0.5rem' }}>
                {[0, 1, 2].map(s => (
                  <div key={s} style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: s < adventureStage || adventureStage === 3
                      ? 'var(--color-gold)'
                      : s === adventureStage
                        ? 'rgba(245,158,11,0.5)'
                        : 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    transition: 'all 0.3s',
                  }} />
                ))}
              </div>
              <div style={{ position: 'absolute', bottom: '1rem', left: '1.5rem', right: '1.5rem' }}>
                <p style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--color-gold)', letterSpacing: '0.12em', marginBottom: '0.2rem' }}>
                  {adventureStage === 3 ? 'ADVENTURE COMPLETE' : `STAGE ${adventureStage + 1} OF 3`}
                </p>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: '#fff', lineHeight: 1.2 }}>
                  ⚔ {selectedQuest.title}
                </h3>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Loading */}
              {loadingStage && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '3rem 1rem', gap: '1rem' }}>
                  <div className="spinner" style={{ width: '36px', height: '36px', borderTopColor: 'var(--color-gold)' }} />
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: '0.8rem', color: 'var(--color-text-secondary)', letterSpacing: '0.1em', textAlign: 'center' }}>
                    {adventureStage === 0 ? 'THE ORACLE WEAVES YOUR FATE...' : 'RESOLVING YOUR CHOICE...'}
                  </p>
                </div>
              )}

              {/* Error */}
              {!loadingStage && adventureError && (
                <div style={{ textAlign: 'center', padding: '1rem' }}>
                  <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem' }}>{adventureError}</p>
                  <button className="btn btn-ghost" onClick={closeAdventure}>Close</button>
                </div>
              )}

              {/* Stage 0 & 1: Scenario + Choices */}
              {!loadingStage && !adventureError && stageData && adventureStage < 2 && (
                <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  {/* Previous choice outcome (stage 1) */}
                  {stageData.choiceOutcome && (
                    <div style={{
                      padding: '0.85rem 1rem',
                      background: stageData.choiceSuccess ? 'rgba(16,185,129,0.08)' : 'rgba(220,38,38,0.08)',
                      border: `1px solid ${stageData.choiceSuccess ? 'rgba(16,185,129,0.25)' : 'rgba(220,38,38,0.25)'}`,
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <p style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: stageData.choiceSuccess ? 'var(--color-emerald)' : '#f87171', marginBottom: '0.3rem', letterSpacing: '0.08em' }}>
                        {stageData.choiceSuccess ? '✦ CHOICE SUCCEEDED' : '✦ COMPLICATIONS AROSE'}
                      </p>
                      <p style={{ fontSize: '0.83rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', lineHeight: 1.7 }}>
                        {stageData.choiceOutcome}
                      </p>
                    </div>
                  )}

                  {/* Scenario */}
                  <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <p style={{ color: 'var(--color-text-primary)', fontStyle: 'italic', fontSize: '0.9rem', lineHeight: 1.85 }}>
                      {stageData.scenario}
                    </p>
                  </div>

                  {/* Choice prompt */}
                  <p style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                    ◆ Choose your path
                  </p>

                  {/* Choices */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(stageData.choices ?? []).map(choice => {
                      const playerStat = (player?.stats as any)?.[choice.statUsed] ?? 5;
                      const bonus = (player?.equippedIds ?? []).reduce((acc, id) => {
                        const item = player?.inventory?.find(i => i.id === id);
                        return acc + ((item?.statBoost as any)?.[choice.statUsed] ?? 0);
                      }, 0);
                      const effectiveStat = playerStat + bonus;
                      const successChance = Math.min(95, Math.max(10, Math.round(((effectiveStat / 2 + 6) / choice.difficulty) * 100)));
                      const isSelected = pendingChoice?.id === choice.id;

                      return (
                        <button
                          key={choice.id}
                          id={`choice-${choice.id}`}
                          onClick={() => handleChoice(choice)}
                          disabled={loadingStage || choiceAnimating}
                          style={{
                            display: 'flex', flexDirection: 'column', gap: '0.4rem',
                            padding: '1rem 1.25rem', textAlign: 'left', width: '100%',
                            background: isSelected ? `${statColor(choice.statUsed)}15` : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isSelected ? statColor(choice.statUsed) : 'rgba(255,255,255,0.08)'}`,
                            borderRadius: 'var(--radius-md)',
                            cursor: 'pointer', transition: 'all 0.2s',
                            transform: isSelected ? 'scale(0.98)' : 'scale(1)',
                          }}
                          onMouseEnter={e => {
                            if (!isSelected) (e.currentTarget as HTMLElement).style.background = `${statColor(choice.statUsed)}10`;
                          }}
                          onMouseLeave={e => {
                            if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>{choice.icon}</span>
                            <span style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)', lineHeight: 1.4, flex: 1 }}>
                              {choice.text}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingLeft: '2.05rem' }}>
                            <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: statColor(choice.statUsed), letterSpacing: '0.08em' }}>
                              [{choice.statUsed.toUpperCase()} {effectiveStat}]
                            </span>
                            <div style={{ flex: 1, height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${successChance}%`, background: statColor(choice.statUsed), borderRadius: '2px', transition: 'width 0.5s' }} />
                            </div>
                            <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                              ~{successChance}%
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Stage 2 (adventureStage === 2): Awaiting final climax load — show last choice outcome */}
              {!loadingStage && !adventureError && stageData && adventureStage === 2 && stageData.choiceOutcome && !stageData.narrative && (
                <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  <div style={{
                    padding: '0.85rem 1rem',
                    background: stageData.choiceSuccess ? 'rgba(16,185,129,0.08)' : 'rgba(220,38,38,0.08)',
                    border: `1px solid ${stageData.choiceSuccess ? 'rgba(16,185,129,0.25)' : 'rgba(220,38,38,0.25)'}`,
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <p style={{ fontSize: '0.83rem', color: 'var(--color-text-secondary)', fontStyle: 'italic', lineHeight: 1.7 }}>
                      {stageData.choiceOutcome}
                    </p>
                  </div>
                  <div className="glass-panel" style={{ padding: '1.25rem' }}>
                    <p style={{ color: 'var(--color-text-primary)', fontStyle: 'italic', fontSize: '0.9rem', lineHeight: 1.85 }}>
                      {stageData.scenario}
                    </p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {(stageData.choices ?? []).map(choice => (
                      <button key={choice.id} id={`final-choice-${choice.id}`} onClick={() => handleChoice(choice)} disabled={loadingStage || choiceAnimating}
                        style={{
                          display: 'flex', flexDirection: 'column', gap: '0.4rem', padding: '1rem 1.25rem', textAlign: 'left', width: '100%',
                          background: pendingChoice?.id === choice.id ? `${statColor(choice.statUsed)}15` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${pendingChoice?.id === choice.id ? statColor(choice.statUsed) : 'rgba(255,255,255,0.08)'}`,
                          borderRadius: 'var(--radius-md)', cursor: 'pointer', transition: 'all 0.2s',
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <span style={{ fontSize: '1.3rem' }}>{choice.icon}</span>
                          <span style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)', lineHeight: 1.4 }}>{choice.text}</span>
                        </div>
                        <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: statColor(choice.statUsed), paddingLeft: '2.05rem' }}>
                          [{choice.statUsed.toUpperCase()}] — FINAL STAND
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Stage 3: Final Result */}
              {!loadingStage && adventureStage === 3 && stageData?.narrative && (
                <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

                  {/* Outcome badge */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.85rem 1rem',
                    background: stageData.success ? 'rgba(16,185,129,0.1)' : 'rgba(220,38,38,0.1)',
                    border: `1px solid ${stageData.success ? 'rgba(16,185,129,0.3)' : 'rgba(220,38,38,0.3)'}`,
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <span style={{ fontSize: '2rem' }}>{stageData.success ? '🏆' : '💀'}</span>
                    <div>
                      <h4 style={{ color: stageData.success ? 'var(--color-emerald)' : '#f87171', fontSize: '0.85rem', marginBottom: '0.1rem' }}>
                        {stageData.success ? 'VICTORY IN THE DARKNESS' : 'SHADOW DEFEAT'}
                      </h4>
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>{stageData.outcomeText}</p>
                    </div>
                  </div>

                  {/* Narrative */}
                  <div className="glass-panel" style={{ padding: '1.25rem', maxHeight: '220px', overflowY: 'auto' }}>
                    <p style={{ color: 'var(--color-text-primary)', fontStyle: 'italic', fontSize: '0.88rem', lineHeight: 1.85, whiteSpace: 'pre-line' }}>
                      {stageData.narrative}
                    </p>
                  </div>

                  {/* Item Reward */}
                  {stageData.itemReward && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1rem',
                      background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <span style={{ fontSize: '1.8rem' }}>{stageData.itemReward.icon}</span>
                      <div>
                        <p style={{ fontSize: '0.65rem', color: 'var(--color-gold)', fontFamily: 'var(--font-mono)', letterSpacing: '0.08em', marginBottom: '0.1rem' }}>
                          ITEM DISCOVERED — {stageData.itemReward.rarity.toUpperCase()}
                        </p>
                        <p style={{ fontSize: '0.88rem', color: 'var(--color-text-primary)', fontFamily: 'var(--font-display)' }}>{stageData.itemReward.name}</p>
                        <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '0.1rem' }}>{stageData.itemReward.description}</p>
                        {stageData.itemReward.statBoost && (
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                            {Object.entries(stageData.itemReward.statBoost).map(([stat, val]) => (
                              <span key={stat} style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: statColor(stat), background: `${statColor(stat)}15`, padding: '0.1rem 0.4rem', borderRadius: '4px' }}>
                                +{val} {stat}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Rewards row */}
                  <div style={{
                    display: 'flex', gap: '1.5rem', background: 'rgba(255,255,255,0.03)',
                    border: '1px solid var(--color-border)', padding: '0.75rem 2rem',
                    borderRadius: 'var(--radius-lg)', justifyContent: 'center',
                  }}>
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Gold</span>
                      <span style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 'bold' }}>
                        +{stageData.success ? selectedQuest.reward.gold : Math.floor(selectedQuest.reward.gold * 0.2)}
                      </span>
                    </div>
                    <div style={{ borderRight: '1px solid var(--color-border)' }} />
                    <div style={{ textAlign: 'center' }}>
                      <span style={{ fontSize: '0.65rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>XP</span>
                      <span style={{ color: 'var(--color-arcane-light)', fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 'bold' }}>
                        +{stageData.success ? selectedQuest.reward.xp : Math.floor(selectedQuest.reward.xp * 0.4)}
                      </span>
                    </div>
                  </div>

                  <button className="btn btn-gold w-full" onClick={handleClaimRewards} disabled={writingMemory}>
                    {writingMemory ? <div className="spinner" style={{ width: '18px', height: '18px' }} /> : '✦ Claim Rewards & Record Memory'}
                  </button>
                </div>
              )}

              {/* Claimed / Done */}
              {!loadingStage && adventureStage === 3 && !stageData?.narrative && (
                <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '1rem' }}>
                  <div style={{ fontSize: '3rem' }} className="animate-float">🎁</div>
                  <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--color-gold)', fontSize: '1.1rem' }}>REWARDS SECURED</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', textAlign: 'center' }}>
                    The memory of your actions is now carved in the stone of Synthara.
                  </p>
                  <p style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-emerald)' }}>
                    🧠 Memory recorded in Qdrant
                  </p>
                  <button className="btn btn-ghost w-full" onClick={closeAdventure}>Close Viewport</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <StatusBar player={player} />
    </div>
  );
}
