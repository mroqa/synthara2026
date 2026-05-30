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
    <>
      <style>{`
        .status-bar {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          padding: 0.6rem 1.5rem;
          border-top: 1px solid var(--color-border);
          background: rgba(8,8,16,0.95);
          backdrop-filter: blur(12px);
          flex-shrink: 0;
        }
        .status-stat {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          min-width: 120px;
        }
        .status-copyright {
          font-size: 0.72rem;
          color: var(--color-text-muted);
          font-family: var(--font-mono);
          margin-right: 1.5rem;
        }
        @media (max-width: 768px) {
          .status-bar {
            gap: 0.75rem;
            padding: 0.5rem 0.75rem;
            padding-bottom: max(0.5rem, env(safe-area-inset-bottom));
          }
          .status-stat {
            min-width: 0;
            flex: 1;
          }
          .status-copyright { display: none; }
        }
        @media (max-width: 480px) {
          .status-bar-label {
            display: none;
          }
        }
      `}</style>

      <div className="status-bar">
        {/* HP */}
        <div className="status-stat">
          <span style={{ fontSize: '0.75rem', color: '#f87171', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>HP</span>
          <div className="stat-bar-track" style={{ flex: 1 }}>
            <div className="stat-bar-fill stat-bar-hp" style={{ width: `${hpPct}%` }} />
          </div>
          <span className="status-bar-label" style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', whiteSpace: 'nowrap' }}>
            {stats.hp}/{stats.maxHp}
          </span>
        </div>

        {/* XP */}
        <div className="status-stat">
          <span style={{ fontSize: '0.75rem', color: 'var(--color-arcane-light)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>XP</span>
          <div className="stat-bar-track" style={{ flex: 1 }}>
            <div className="stat-bar-fill stat-bar-xp" style={{ width: `${xpPct}%` }} />
          </div>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)', flexShrink: 0 }}>
            Lv {stats.level}
          </span>
        </div>

        {/* Gold */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.85rem' }}>💰</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: 'var(--color-gold)' }}>
            {stats.gold.toLocaleString()}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Copyright — hidden on mobile via CSS */}
        <span className="status-copyright">
          © All copyrights reserved by{' '}
          <a
            href="https://www.linkedin.com/in/mroqa"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--color-gold)', textDecoration: 'none', transition: 'color var(--transition-fast)' }}
            onMouseEnter={e => {
              e.currentTarget.style.textDecoration = 'underline';
              e.currentTarget.style.color = 'var(--color-gold-light)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.textDecoration = 'none';
              e.currentTarget.style.color = 'var(--color-gold)';
            }}
          >
            Mohammed Roqa
          </a>
        </span>

        {/* Player name + archetype */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
            {player.archetype}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: '0.85rem', color: 'var(--color-text-primary)' }}>
            {player.name}
          </span>
        </div>
      </div>
    </>
  );
}
