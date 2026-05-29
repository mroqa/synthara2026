'use client';
import type { Player } from '@/types/player';

interface StatusBarProps {
  player: Player | null;
}

export default function StatusBar({ player }: StatusBarProps) {
  if (!player) return null;
  const { stats } = player;
  const hpPct = (stats.hp / stats.maxHp) * 100;
  const xpPct = Math.min(((stats.xp % 1000) / 1000) * 100, 100);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '1.5rem',
      padding: '0.6rem 1.5rem',
      borderTop: '1px solid var(--color-border)',
      background: 'rgba(8,8,16,0.95)',
      backdropFilter: 'blur(12px)',
      flexShrink: 0,
    }}>
      {/* HP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '120px' }}>
        <span style={{ fontSize: '0.75rem', color: '#f87171', fontFamily: 'var(--font-mono)' }}>HP</span>
        <div className="stat-bar-track" style={{ flex: 1 }}>
          <div className="stat-bar-fill stat-bar-hp" style={{ width: `${hpPct}%` }} />
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
          {stats.hp}/{stats.maxHp}
        </span>
      </div>

      {/* XP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '120px' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-arcane-light)', fontFamily: 'var(--font-mono)' }}>XP</span>
        <div className="stat-bar-track" style={{ flex: 1 }}>
          <div className="stat-bar-fill stat-bar-xp" style={{ width: `${xpPct}%` }} />
        </div>
        <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          Lv {stats.level}
        </span>
      </div>

      {/* Gold */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <span style={{ fontSize: '0.85rem' }}>💰</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-gold)' }}>
          {stats.gold.toLocaleString()}
        </span>
      </div>

      <div style={{ flex: 1 }} />

      {/* Player name + archetype */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          {player.archetype}
        </span>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
          {player.name}
        </span>
      </div>
    </div>
  );
}
