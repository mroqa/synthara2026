'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, doc, setDoc } from '@/lib/firebase';
import { ARCHETYPE_SEED_MEMORIES, createMemoryEvent } from '@/lib/memory';
import type { Archetype } from '@/types/player';

const ARCHETYPES: { id: Archetype; icon: string; title: string; desc: string; color: string }[] = [
  { id: 'Wanderer', icon: '🧭', title: 'The Wanderer', desc: 'No home, no allegiance. You carry only scars and instinct.', color: '#06b6d4' },
  { id: 'Scholar', icon: '📜', title: 'The Scholar', desc: 'Forbidden knowledge burns in your mind. Truth is worth any price.', color: '#a855f7' },
  { id: 'Warlord', icon: '⚔️', title: 'The Warlord', desc: 'You built an empire and watched it fall. Now you rebuild in shadow.', color: '#dc2626' },
  { id: 'Phantom', icon: '🌑', title: 'The Phantom', desc: 'Your name is stolen. Your face is borrowed. You are no one.', color: '#f59e0b' },
];

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Archetype | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleBegin = async () => {
    if (!name.trim()) return setError('Your name echoes in the void... but you must speak it.');
    if (!selected) return setError('Choose your archetype, traveler.');

    const user = auth.currentUser;
    if (!user) { router.push('/'); return; }

    setLoading(true);
    setError('');

    try {
      // Create player profile in Firestore
      const player = {
        uid: user.uid,
        name: name.trim(),
        archetype: selected,
        stats: { hp: 100, maxHp: 100, xp: 0, level: 1, gold: 100, strength: 10, wisdom: 10, stealth: 10, charisma: 10 },
        inventory: [],
        equippedIds: [],
        questsCompleted: 0,
        memoriesCount: 1,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'players', user.uid), player);

      // Write seed episodic memory
      const seedData = ARCHETYPE_SEED_MEMORIES[selected];
      const seedMemory = createMemoryEvent({ ...seedData, playerId: user.uid });

      await fetch('/api/memory/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(seedMemory),
      });

      router.push('/game');
    } catch (e) {
      console.error(e);
      setError('The fates resist. Try again.');
      setLoading(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem',
      background: 'radial-gradient(ellipse at 50% 0%, rgba(124,58,237,0.15), transparent 60%), var(--color-void)' }}>

      <div style={{ width: '100%', maxWidth: '800px' }} className="animate-fadeInUp">
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <p style={{ color: 'var(--color-arcane-light)', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', letterSpacing: '0.2em', marginBottom: '0.5rem' }}>
            STEP 1 OF 1
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 2.8rem)', color: 'var(--color-text-primary)' }}>
            Who Are You?
          </h1>
          <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
            Your name and archetype seed your first memory in Synthara.
          </p>
        </div>

        {/* Name Input */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '0.8rem', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', marginBottom: '0.5rem', textTransform: 'uppercase' }}>
            Your Name
          </label>
          <input
            id="input-player-name"
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Speak your name into the void..."
            maxLength={30}
            style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', padding: '0.85rem 1.2rem', textAlign: 'center', letterSpacing: '0.05em' }}
          />
        </div>

        {/* Archetype Selection */}
        <div style={{ marginBottom: '2rem' }}>
          <label style={{ display: 'block', fontFamily: 'var(--font-display)', fontSize: '0.8rem', letterSpacing: '0.1em', color: 'var(--color-text-secondary)', marginBottom: '1rem', textTransform: 'uppercase' }}>
            Choose Your Archetype
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem' }}>
            {ARCHETYPES.map((a) => (
              <div
                key={a.id}
                id={`archetype-${a.id.toLowerCase()}`}
                className={`archetype-card ${selected === a.id ? 'selected' : ''}`}
                onClick={() => setSelected(a.id)}
                style={selected === a.id ? { borderColor: a.color, boxShadow: `0 0 20px ${a.color}55` } : {}}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>{a.icon}</div>
                <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: selected === a.id ? a.color : 'var(--color-text-primary)', marginBottom: '0.5rem' }}>
                  {a.title}
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{a.desc}</p>
                {selected === a.id && (
                  <div style={{ marginTop: '0.75rem' }}>
                    <span className="badge badge-arcane" style={{ borderColor: a.color, color: a.color }}>Selected</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Seed Memory Preview */}
        {selected && (
          <div className="glass-panel animate-fadeIn" style={{ padding: '1rem 1.25rem', marginBottom: '2rem', borderColor: 'rgba(124,58,237,0.3)' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-arcane-light)', fontFamily: 'var(--font-mono)', marginBottom: '0.4rem' }}>
              🧠 FIRST MEMORY — Will be embedded into Qdrant
            </p>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
              &ldquo;{ARCHETYPE_SEED_MEMORIES[selected].outcome}&rdquo;
            </p>
          </div>
        )}

        {error && (
          <p style={{ color: '#f87171', fontSize: '0.85rem', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>
        )}

        <button
          id="btn-begin-journey"
          className="btn btn-gold btn-lg w-full"
          onClick={handleBegin}
          disabled={loading}
          style={{ fontSize: '0.95rem', letterSpacing: '0.15em' }}
        >
          {loading
            ? <><div className="spinner" style={{ width: '18px', height: '18px' }} /> Weaving your memory...</>
            : '✦ Begin Your Journey'}
        </button>
      </div>
    </main>
  );
}
