'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db, onAuthStateChanged, doc, getDoc, collection, getDocs, query, orderBy } from '@/lib/firebase';
import type { Player } from '@/types/player';
import type { EpisodicMemory } from '@/types/memory';
import StatusBar from '@/components/Game/StatusBar';

interface MemoryWithScore extends EpisodicMemory {
  score?: number;
}

export default function MemoryLogPage() {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [memories, setMemories] = useState<MemoryWithScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMemory, setSelectedMemory] = useState<MemoryWithScore | null>(null);

  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<MemoryWithScore[] | null>(null);
  const [searchError, setSearchError] = useState('');

  // Fetch memories and player state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) { router.push('/'); return; }
      try {
        // Player Profile
        const snap = await getDoc(doc(db, 'players', user.uid));
        if (!snap.exists()) { router.push('/create'); return; }
        setPlayer(snap.data() as Player);

        // Load memories from Firestore in reverse chronological order
        const memSnap = await getDocs(
          query(collection(db, 'players', user.uid, 'memories'), orderBy('timestamp', 'desc'))
        );
        const mems = memSnap.docs.map((d: any) => d.data() as EpisodicMemory);

        // If firestore subcollection is empty (rare since we write seed memory), load seed memory
        setMemories(mems);
      } catch (e) {
        console.error('Failed to load memories:', e);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [router]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      setSearchError('');
      return;
    }

    const user = auth.currentUser;
    if (!user) return;

    setIsSearching(true);
    setSearchError('');
    try {
      const res = await fetch('/api/memory/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: searchQuery.trim(),
          playerId: user.uid,
          limit: 10,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setSearchError(data.error);
      } else if (data.memories) {
        setSearchResults(data.memories);
      }
    } catch (err) {
      setSearchError('Search failed due to veil interference...');
    }
    setIsSearching(false);
  };

  const handleClearSearch = () => {
    setSearchQuery('');
    setSearchResults(null);
    setSearchError('');
  };

  const formatJson = (mem: EpisodicMemory) => {
    // Return structured memory payload formatted as syntax-highlighted elements
    const payload = {
      id: mem.id,
      actor: mem.actor,
      timestamp: mem.timestamp,
      location: mem.location,
      entities: mem.entities,
      trigger: mem.trigger,
      outcome: mem.outcome,
      emotionalWeight: mem.emotionalWeight,
      tags: mem.tags,
      playerId: mem.playerId,
    };

    return JSON.stringify(payload, null, 2);
  };

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-void)', flexDirection: 'column', gap: '1rem' }}>
        <div className="animate-pulseGlow" style={{ fontSize: '3rem' }}>🔮</div>
        <p style={{ fontFamily: 'var(--font-display)', color: 'var(--color-arcane-light)', letterSpacing: '0.2em', fontSize: '0.85rem' }}>
          TUNING MEMORY FREQUENCIES...
        </p>
      </div>
    );
  }

  const displayedMemories = searchResults !== null ? searchResults : memories;

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
          <a href="/game" style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', letterSpacing: '0.15em', color: 'var(--color-text-primary)' }}>
            SYNTHARA
          </a>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <a href="/game/memory" className="btn btn-ghost btn-sm" style={{ borderColor: 'var(--color-gold)', color: 'var(--color-gold)' }}>🧠 Memory Log</a>
          <a href="/game/quests" className="btn btn-ghost btn-sm">📜 Quests</a>
          <a href="/game/profile" className="btn btn-ghost btn-sm">⚔ {player?.name || 'Traveler'}</a>
        </div>
      </nav>

      {/* Container */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 360px', overflow: 'hidden' }}>

        {/* Left: Memory List & Search */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.5rem' }}>

          {/* Header & Search */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '1.25rem', marginBottom: '1.25rem', flexShrink: 0 }}>
            <div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '1.8rem' }}>🧠</span>
                <h1 style={{ fontSize: '1.8rem', letterSpacing: '0.05em', color: 'var(--color-text-primary)' }}>
                  Episodic Memory Bank
                </h1>
              </div>
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                Search and explore your history in Synthara. Powered by <span style={{ color: 'var(--color-arcane-light)' }}>Qdrant Vector DB</span> cosine similarity retrieval.
              </p>
            </div>

            {/* Semantic Search bar */}
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.75rem' }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  type="text"
                  className="input"
                  placeholder="Query memories semantically (e.g. 'Mira and the dragon', 'betrayal', 'crossroads')..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ paddingLeft: '2.5rem', fontSize: '0.85rem' }}
                />
                <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }}>🔍</span>
                {searchQuery && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    style={{ position: 'absolute', right: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', fontSize: '1.1rem' }}
                  >
                    ✕
                  </button>
                )}
              </div>
              <button type="submit" className="btn btn-primary" style={{ fontSize: '0.8rem' }} disabled={isSearching}>
                {isSearching ? <div className="spinner" style={{ width: '16px', height: '16px' }} /> : 'Vector Search'}
              </button>
            </form>
          </div>

          {/* Scrollable list */}
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem', paddingRight: '0.5rem' }}>
            {searchError && (
              <div style={{ color: '#f87171', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>{searchError}</div>
            )}

            {searchResults !== null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(124,58,237,0.05)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--color-border)', flexShrink: 0 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--color-arcane-light)', fontFamily: 'var(--font-mono)' }}>
                  🔍 SEMANTIC VECTOR SEARCH RESULTS ({displayedMemories.length})
                </span>
                <button onClick={handleClearSearch} style={{ fontSize: '0.72rem', color: 'var(--color-text-gold)', textDecoration: 'underline' }}>Clear Search</button>
              </div>
            )}

            {displayedMemories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--color-text-muted)' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📭</div>
                <p>No episodic memories found matching your request.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {displayedMemories.map((mem) => {
                  const isSelected = selectedMemory?.id === mem.id;
                  return (
                    <div
                      key={mem.id}
                      onClick={() => setSelectedMemory(mem)}
                      className="glass-panel"
                      style={{
                        padding: '1.25rem',
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--color-gold)' : 'var(--color-border)',
                        boxShadow: isSelected ? 'var(--shadow-gold)' : 'none',
                        transition: 'all var(--transition-base)',
                        display: 'flex', flexDirection: 'column', gap: '0.5rem',
                      }}
                    >
                      {/* Meta information row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--color-arcane-light)' }}>
                            ✦ {mem.trigger.toUpperCase()}
                          </span>
                          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.65rem' }}>•</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
                            📍 {mem.location}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                          {mem.score !== undefined && (
                            <span className="badge" style={{ background: 'rgba(6,182,212,0.15)', color: 'var(--color-ice)', border: '1px solid rgba(6,182,212,0.3)', fontSize: '0.65rem' }}>
                              Sim: {(mem.score * 100).toFixed(1)}%
                            </span>
                          )}
                          <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                            {new Date(mem.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {/* Outcome (Narrative text) */}
                      <p style={{ color: 'var(--color-text-primary)', fontStyle: 'italic', fontSize: '0.88rem', lineHeight: 1.6 }}>
                        &ldquo;{mem.outcome}&rdquo;
                      </p>

                      {/* Tags list */}
                      <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                        {mem.tags.map((t) => (
                          <span key={t} className="tag" style={{ fontSize: '0.65rem', padding: '1px 8px' }}>#{t}</span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Memory Inspector Console */}
        <div style={{
          borderLeft: '1px solid var(--color-border)',
          background: 'var(--color-abyss)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '1.2rem' }}>💻</span>
            <h4 style={{ color: 'var(--color-text-primary)', fontSize: '0.8rem', letterSpacing: '0.1em' }}>
              Memory Inspector
            </h4>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {selectedMemory ? (
              <div className="animate-fadeIn" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '0.95rem', color: 'var(--color-gold)', marginBottom: '0.25rem' }}>
                    Structured JSON Log
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    Here is the 5-property structured episodic entry recorded for similarity vectors.
                  </p>
                </div>

                {/* Structured attributes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.85rem', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)', fontSize: '0.78rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Actor:</span>
                    <span style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedMemory.actor}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Timestamp:</span>
                    <span style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{new Date(selectedMemory.timestamp).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Location:</span>
                    <span style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedMemory.location}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Entities:</span>
                    <span style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedMemory.entities.join(', ')}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Trigger:</span>
                    <span style={{ color: 'var(--color-text-primary)', fontFamily: 'var(--font-mono)' }}>{selectedMemory.trigger}</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr' }}>
                    <span style={{ color: 'var(--color-text-muted)' }}>Emotional Weight:</span>
                    <span style={{ color: 'var(--color-gold)', fontFamily: 'var(--font-mono)' }}>{selectedMemory.emotionalWeight} / 1.0</span>
                  </div>
                </div>

                {/* Raw JSON Code Block */}
                <div>
                  <h4 style={{ color: 'var(--color-text-muted)', fontSize: '0.7rem', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
                    RAW QDRANT PAYLOAD
                  </h4>
                  <pre className="json-block" style={{ fontSize: '0.72rem', maxHeight: '250px' }}>
                    <code>
                      {formatJson(selectedMemory)}
                    </code>
                  </pre>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '5rem 0', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem', opacity: 0.5 }}>↖</div>
                <p>Select any memory entry from the bank to inspect its structured properties.</p>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Status Bar */}
      <StatusBar player={player} />
    </div>
  );
}
