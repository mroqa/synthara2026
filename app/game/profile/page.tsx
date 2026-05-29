'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, onAuthStateChanged, signOut, doc, getDoc, updateDoc } from '@/lib/firebase';
import type { Player, InventoryItem, StatBoost } from '@/types/player';
import StatusBar from '@/components/Game/StatusBar';

const STAT_COLORS: Record<string, string> = {
  strength: '#ef4444',
  wisdom: '#a855f7',
  stealth: '#f59e0b',
  charisma: '#06b6d4',
  maxHp: '#10b981',
};

const RARITY_COLORS: Record<string, string> = {
  common: 'var(--rarity-common)',
  rare: 'var(--rarity-rare)',
  epic: 'var(--rarity-epic)',
  legendary: 'var(--rarity-legendary)',
};

export default function ProfilePage() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [titles, setTitles] = useState<string[]>([]);
  const [activeTitle, setActiveTitle] = useState<string>('Traveler of Synthara');
  const [togglingItem, setTogglingItem] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/'); return; }
      try {
        const snap = await getDoc(doc(db, 'players', user.uid));
        if (!snap.exists()) { router.push('/create'); return; }
        const pData = snap.data() as Player;
        // Ensure equippedIds exists
        if (!pData.equippedIds) pData.equippedIds = [];
        setPlayer(pData);

        const newTitles: string[] = ['Traveler of Synthara'];
        if (pData.archetype === 'Wanderer') newTitles.push('The Pathless Pilgrim');
        if (pData.archetype === 'Scholar') newTitles.push('Keeper of the Sealed Archive');
        if (pData.archetype === 'Warlord') newTitles.push('Iron Vanguard');
        if (pData.archetype === 'Phantom') newTitles.push('The Nameless Facade');
        if (pData.questsCompleted >= 1) newTitles.push('Rune Carver');
        if (pData.questsCompleted >= 3) newTitles.push('High Pathfinder');
        if (pData.memoriesCount >= 5) newTitles.push('The Chronological Nexus');
        if (pData.stats.level >= 3) newTitles.push('Adept Ascendant');
        if (pData.stats.strength >= 12) newTitles.push('The Indomitable Force');
        if (pData.stats.wisdom >= 12) newTitles.push('Oracle Eyed');
        if ((pData.inventory ?? []).length >= 3) newTitles.push('Collector of Relics');

        setTitles(newTitles);
        setActiveTitle(newTitles[newTitles.length - 1]);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const handleToggleEquip = async (item: InventoryItem) => {
    const user = auth.currentUser;
    if (!user || !player || togglingItem) return;
    setTogglingItem(item.id);

    const currentEquipped = player.equippedIds ?? [];
    const isEquipped = currentEquipped.includes(item.id);
    const newEquippedIds = isEquipped
      ? currentEquipped.filter(id => id !== item.id)
      : [...currentEquipped, item.id];

    // Recalculate stat boosts from equipped items
    const newInventory = player.inventory.map(i => ({
      ...i,
      equipped: newEquippedIds.includes(i.id),
    }));

    // Compute delta boosts
    const computeBoosts = (ids: string[]) =>
      player.inventory
        .filter(i => ids.includes(i.id) && i.statBoost)
        .reduce((acc, i) => {
          const b = i.statBoost as StatBoost;
          acc.strength += b.strength ?? 0;
          acc.wisdom += b.wisdom ?? 0;
          acc.stealth += b.stealth ?? 0;
          acc.charisma += b.charisma ?? 0;
          acc.maxHp += b.maxHp ?? 0;
          return acc;
        }, { strength: 0, wisdom: 0, stealth: 0, charisma: 0, maxHp: 0 });

    const oldBoosts = computeBoosts(currentEquipped);
    const newBoosts = computeBoosts(newEquippedIds);

    // Base stats: current stats minus old boosts (strip equipped bonuses then re-add new)
    const baseStrength = player.stats.strength - oldBoosts.strength;
    const baseWisdom = player.stats.wisdom - oldBoosts.wisdom;
    const baseStealth = player.stats.stealth - oldBoosts.stealth;
    const baseCharisma = player.stats.charisma - oldBoosts.charisma;
    const baseMaxHp = player.stats.maxHp - oldBoosts.maxHp;

    const newStats = {
      ...player.stats,
      strength: baseStrength + newBoosts.strength,
      wisdom: baseWisdom + newBoosts.wisdom,
      stealth: baseStealth + newBoosts.stealth,
      charisma: baseCharisma + newBoosts.charisma,
      maxHp: Math.max(10, baseMaxHp + newBoosts.maxHp),
      hp: Math.min(player.stats.hp, Math.max(10, baseMaxHp + newBoosts.maxHp)),
    };

    try {
      await updateDoc(doc(db, 'players', user.uid), {
        equippedIds: newEquippedIds,
        inventory: newInventory,
        stats: newStats,
      });
      setPlayer(p => p ? { ...p, equippedIds: newEquippedIds, inventory: newInventory, stats: newStats } : null);
    } catch (e) {
      console.error(e);
    }
    setTogglingItem(null);
  };

  const handleSignOut = async () => {
    try { await signOut(auth); router.push('/'); } catch (e) { console.error(e); }
  };

  const handleReset = async () => {
    if (!confirm('Reset your character? This will erase your progress.')) return;
    router.push('/create');
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-void)', flexDirection: 'column', gap: '1rem' }}>
        <div className="animate-pulseGlow" style={{ fontSize: '3rem' }}>🔮</div>
        <p style={{ fontFamily: 'var(--font-display)', color: 'var(--color-arcane-light)', letterSpacing: '0.2em', fontSize: '0.85rem' }}>
          WEAVING SOUL METADATA...
        </p>
      </div>
    );
  }

  if (!player) return null;

  const equippedIds = player.equippedIds ?? [];

  // Compute equipment-derived boosts for display
  const equippedBoosts = (player.inventory ?? [])
    .filter(i => equippedIds.includes(i.id) && i.statBoost)
    .reduce((acc, i) => {
      const b = i.statBoost as StatBoost;
      acc.strength += b.strength ?? 0;
      acc.wisdom += b.wisdom ?? 0;
      acc.stealth += b.stealth ?? 0;
      acc.charisma += b.charisma ?? 0;
      acc.maxHp += b.maxHp ?? 0;
      return acc;
    }, { strength: 0, wisdom: 0, stealth: 0, charisma: 0, maxHp: 0 });

  const xpNeeded = player.stats.level * 100;
  const xpPct = Math.min(100, (player.stats.xp / xpNeeded) * 100);
  const hpPct = Math.min(100, (player.stats.hp / player.stats.maxHp) * 100);

  const archetypeColors: Record<string, string> = {
    Wanderer: '#06b6d4', Scholar: '#a855f7', Warlord: '#dc2626', Phantom: '#f59e0b',
  };
  const archetypeAvatars: Record<string, string> = {
    Wanderer: '🧭', Scholar: '📜', Warlord: '⚔️', Phantom: '🌑',
  };

  const inventory = player.inventory ?? [];

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
          <a href="/game/quests" className="btn btn-ghost btn-sm">📜 Quests</a>
          <a href="/game/profile" className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--color-gold)', color: 'var(--color-gold)' }}>⚔ {player.name}</a>
        </div>
      </nav>

      {/* Profile Grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '2rem', display: 'grid', gridTemplateColumns: '320px 1fr', gap: '2rem', maxWidth: '1300px', margin: '0 auto', width: '100%' }}>

        {/* Left Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

          {/* Character Card */}
          <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center', position: 'relative', overflow: 'hidden', borderTop: `4px solid ${archetypeColors[player.archetype] || 'var(--color-border)'}` }}>
            <div style={{
              width: '80px', height: '80px', borderRadius: '50%',
              background: `radial-gradient(circle, ${archetypeColors[player.archetype]}44, ${archetypeColors[player.archetype]}05)`,
              border: `2px solid ${archetypeColors[player.archetype]}88`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '2.5rem', margin: '0 auto 1rem',
            }} className="animate-float">
              {archetypeAvatars[player.archetype] || '🧙'}
            </div>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', color: 'var(--color-text-primary)', marginBottom: '0.2rem' }}>
              {player.name}
            </h2>
            <p style={{ fontSize: '0.72rem', color: 'var(--color-gold)', letterSpacing: '0.15em', textTransform: 'uppercase', fontStyle: 'italic', fontFamily: 'var(--font-display)', marginBottom: '1.25rem' }}>
              {activeTitle}
            </p>
            <div className="divider" style={{ opacity: 0.3 }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', textAlign: 'left', marginTop: '1rem' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>HP Status</span>
                  <span style={{ color: '#f87171', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{player.stats.hp} / {player.stats.maxHp}</span>
                </div>
                <div className="stat-bar-track"><div className="stat-bar-fill stat-bar-hp" style={{ width: `${hpPct}%` }} /></div>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <span style={{ color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>XP Level {player.stats.level}</span>
                  <span style={{ color: 'var(--color-arcane-light)', fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{player.stats.xp} / {xpNeeded}</span>
                </div>
                <div className="stat-bar-track"><div className="stat-bar-fill stat-bar-xp" style={{ width: `${xpPct}%` }} /></div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 'var(--radius-sm)', marginTop: '0.25rem' }}>
                <span style={{ color: 'var(--color-text-muted)', fontSize: '0.72rem', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Wealth</span>
                <span style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 'bold' }}>💰 {player.stats.gold} Gold</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <button className="btn btn-ghost w-full" onClick={handleReset}>🔄 Reset Character</button>
            <button className="btn btn-danger w-full" onClick={handleSignOut}>🚪 Sign Out of Synthara</button>
          </div>
        </div>

        {/* Right Column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          {/* Character Attributes */}
          <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--color-text-primary)', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🛡️</span> RPG Attributes
              {equippedIds.length > 0 && (
                <span style={{ fontSize: '0.65rem', fontFamily: 'var(--font-mono)', color: 'var(--color-gold)', background: 'rgba(245,158,11,0.1)', padding: '0.1rem 0.5rem', borderRadius: '4px', marginLeft: '0.5rem' }}>
                  +{equippedIds.length} gear equipped
                </span>
              )}
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              {[
                { label: '⚔️ Strength', key: 'strength', desc: 'Physical feats, heavy weapons, martial quest success.' },
                { label: '📖 Wisdom', key: 'wisdom', desc: 'Magical attunement, puzzle resolution, rune reading.' },
                { label: '🌑 Stealth', key: 'stealth', desc: 'Lockpicking, shadow blending, escaping traps.' },
                { label: '💬 Charisma', key: 'charisma', desc: 'Negotiations, persuasion, NPC rapport.' },
              ].map(s => {
                const boost = equippedBoosts[s.key as keyof typeof equippedBoosts] ?? 0;
                const val = (player.stats as any)[s.key];
                return (
                  <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>{s.label}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <span style={{ color: STAT_COLORS[s.key], fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>{val}</span>
                        {boost > 0 && (
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-gold)', fontFamily: 'var(--font-mono)' }}>(+{boost})</span>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ══════════════════════════════════
              INVENTORY & EQUIPMENT
              ══════════════════════════════════ */}
          <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--color-text-primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🎒</span> Inventory & Equipment
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem', marginBottom: '1.25rem' }}>
              Items discovered during your quests. Click an item to inspect it, then equip or unequip.
            </p>

            {inventory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🪣</div>
                <p style={{ fontSize: '0.85rem' }}>No items yet. Complete quests to discover relics and equipment.</p>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem' }}>
                {inventory.map(item => {
                  const isEquipped = equippedIds.includes(item.id);
                  const isSelected = selectedItem?.id === item.id;
                  const rarityColor = RARITY_COLORS[item.rarity] ?? 'var(--color-text-muted)';
                  return (
                    <button
                      key={item.id}
                      id={`item-${item.id}`}
                      onClick={() => setSelectedItem(isSelected ? null : item)}
                      style={{
                        display: 'flex', flexDirection: 'column', alignItems: 'center',
                        padding: '0.85rem 0.75rem', gap: '0.5rem', textAlign: 'center',
                        background: isSelected
                          ? `${rarityColor}15`
                          : isEquipped
                            ? 'rgba(245,158,11,0.06)'
                            : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${isSelected ? rarityColor : isEquipped ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
                        borderRadius: 'var(--radius-md)',
                        cursor: 'pointer', transition: 'all 0.2s',
                        position: 'relative',
                      }}
                    >
                      {isEquipped && (
                        <div style={{
                          position: 'absolute', top: '4px', right: '4px',
                          width: '8px', height: '8px', borderRadius: '50%',
                          background: 'var(--color-gold)',
                          boxShadow: '0 0 6px var(--color-gold)',
                        }} />
                      )}
                      <span style={{ fontSize: '1.6rem' }}>{item.icon}</span>
                      <div>
                        <p style={{ fontSize: '0.7rem', fontFamily: 'var(--font-display)', color: rarityColor, lineHeight: 1.3, marginBottom: '0.15rem' }}>
                          {item.name}
                        </p>
                        <p style={{ fontSize: '0.6rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          {item.type}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Item Detail Drawer */}
            {selectedItem && (
              <div className="animate-fadeIn" style={{
                marginTop: '1rem',
                padding: '1rem 1.25rem',
                background: `${RARITY_COLORS[selectedItem.rarity] ?? 'var(--color-arcane)'}10`,
                border: `1px solid ${RARITY_COLORS[selectedItem.rarity] ?? 'var(--color-border)'}40`,
                borderRadius: 'var(--radius-md)',
                display: 'flex', flexDirection: 'column', gap: '0.75rem',
              }}>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '2.5rem', flexShrink: 0 }}>{selectedItem.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <p style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', color: RARITY_COLORS[selectedItem.rarity] }}>
                        {selectedItem.name}
                      </p>
                      <span style={{ fontSize: '0.6rem', fontFamily: 'var(--font-mono)', color: RARITY_COLORS[selectedItem.rarity], background: `${RARITY_COLORS[selectedItem.rarity]}15`, padding: '0.1rem 0.4rem', borderRadius: '4px', textTransform: 'uppercase' }}>
                        {selectedItem.rarity}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.6, fontStyle: 'italic' }}>
                      {selectedItem.description}
                    </p>
                    {selectedItem.statBoost && (
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexWrap: 'wrap' }}>
                        {Object.entries(selectedItem.statBoost).map(([stat, val]) => (
                          <span key={stat} style={{
                            fontSize: '0.7rem', fontFamily: 'var(--font-mono)',
                            color: STAT_COLORS[stat] ?? 'var(--color-text-secondary)',
                            background: `${STAT_COLORS[stat] ?? 'var(--color-arcane)'}15`,
                            padding: '0.2rem 0.5rem', borderRadius: '4px',
                          }}>
                            +{val} {stat}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button
                    className={equippedIds.includes(selectedItem.id) ? 'btn btn-ghost btn-sm' : 'btn btn-gold btn-sm'}
                    onClick={() => handleToggleEquip(selectedItem)}
                    disabled={togglingItem === selectedItem.id}
                    style={{ flex: 1 }}
                  >
                    {togglingItem === selectedItem.id
                      ? <div className="spinner" style={{ width: '14px', height: '14px' }} />
                      : equippedIds.includes(selectedItem.id)
                        ? '↩ Unequip'
                        : '✦ Equip'}
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setSelectedItem(null)}>✕ Close</button>
                </div>
              </div>
            )}
          </div>

          {/* Titles */}
          <div className="glass-panel" style={{ padding: '1.5rem 2rem' }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', color: 'var(--color-text-primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>🏅</span> Earned Titles
            </h3>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginBottom: '1.25rem' }}>
              Unlocked through episodic memory and historical achievement in Synthara.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {titles.map(t => {
                const isActive = activeTitle === t;
                return (
                  <button key={t} onClick={() => setActiveTitle(t)} className="badge" style={{
                    background: isActive ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.03)',
                    color: isActive ? 'var(--color-gold)' : 'var(--color-text-secondary)',
                    border: `1px solid ${isActive ? 'var(--color-gold)' : 'var(--color-border)'}`,
                    padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)',
                    cursor: 'pointer', fontSize: '0.75rem',
                    fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
                    transition: 'all var(--transition-fast)',
                  }}>
                    {isActive ? '✦ ' : ''}{t}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Stats Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.25rem' }}>📜</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Quests Finished</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--color-gold)', fontWeight: 'bold' }}>
                {player.questsCompleted}
              </span>
            </div>
            <div className="glass-panel" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.25rem' }}>🧠</span>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', display: 'block', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>Qdrant Memories</span>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '1.8rem', color: 'var(--color-arcane-light)', fontWeight: 'bold' }}>
                {player.memoriesCount}
              </span>
            </div>
          </div>

        </div>
      </div>

      <StatusBar player={player} />
    </div>
  );
}
