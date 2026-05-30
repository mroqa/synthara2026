'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleAuthProvider } from 'firebase/auth';
import { auth, signInAnonymously, signInWithPopup } from '@/lib/firebase';
import ParticleCanvas from '@/components/Landing/ParticleCanvas';

export default function LandingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      router.push('/create');
    } catch (e) {
      setError('Sign in failed. Try again.');
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await signInAnonymously(auth);
      router.push('/create');
    } catch (e) {
      setError('Could not enter as guest. Try again.');
      setLoading(false);
    }
  };

  return (
    <main style={{ position: 'relative', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
      <ParticleCanvas />

      {/* Ambient background gradients */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 30% 20%, rgba(124,58,237,0.15) 0%, transparent 50%), radial-gradient(ellipse at 70% 80%, rgba(245,158,11,0.08) 0%, transparent 50%)',
      }} />

      {/* Hero Content */}
      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: 'clamp(1rem, 4vw, 2rem)', maxWidth: '700px', width: '100%' }}>

        {/* Rune icon */}
        <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'center' }} className="animate-float">
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(124,58,237,0.4), rgba(124,58,237,0.05))',
            border: '2px solid rgba(124,58,237,0.6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '2.5rem',
          }} className="animate-pulseGlow">
            🔮
          </div>
        </div>

        {/* Title */}
        <h1 className="glow-text" style={{
          fontFamily: 'var(--font-display)',
          letterSpacing: '0.15em',
          marginBottom: '0.5rem',
          background: 'linear-gradient(135deg, #e8e8f0 30%, #a855f7 60%, #f59e0b 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
          SYNTHARA
        </h1>

        {/* Divider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem', margin: '1.2rem 0',
          justifyContent: 'center',
        }}>
          <div style={{ height: '1px', width: '80px', background: 'linear-gradient(90deg, transparent, var(--color-arcane))' }} />
          <span style={{ color: 'var(--color-gold)', fontSize: '1rem', letterSpacing: '0.2em', fontFamily: 'var(--font-display)' }}>✦</span>
          <div style={{ height: '1px', width: '80px', background: 'linear-gradient(90deg, var(--color-arcane), transparent)' }} />
        </div>

        {/* Tagline */}
        <p style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'clamp(1rem, 2vw, 1.3rem)',
          color: 'var(--color-text-secondary)',
          letterSpacing: '0.12em',
          marginBottom: '1rem',
          fontStyle: 'italic',
        }}>
          Your past writes your future.
        </p>

        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', lineHeight: 1.8, marginBottom: '2.5rem', maxWidth: '500px', margin: '0 auto 2.5rem' }}>
          A dark fantasy world where NPCs remember every choice you&apos;ve made.
          Powered by <span style={{ color: 'var(--color-arcane-light)' }}>episodic memory</span> and{' '}
          <span style={{ color: 'var(--color-gold)' }}>AI-synthesized quests</span> that evolve with your story.
        </p>

        {/* Auth buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', width: '100%' }}>
          <button
            id="btn-google-login"
            className="btn btn-primary btn-lg"
            onClick={handleGoogleLogin}
            disabled={loading}
            style={{ width: 'min(280px, 100%)', fontSize: '0.9rem' }}
          >
            {loading ? <div className="spinner" style={{ width: '18px', height: '18px' }} /> : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </>
            )}
          </button>

          <button
            id="btn-guest-login"
            className="btn btn-ghost"
            onClick={handleGuestLogin}
            disabled={loading}
            style={{ width: 'min(280px, 100%)' }}
          >
            ⚔ Enter as Guest
          </button>
        </div>

        {error && (
          <p style={{ marginTop: '1rem', color: '#f87171', fontSize: '0.85rem' }}>{error}</p>
        )}

        {/* Footer memory signature */}
        <div style={{ marginTop: '3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
          {['Qdrant Memory', 'Gemini AI', 'Dark Fantasy'].map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>

        {/* Copyright details */}
        <p style={{ marginTop: '2rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
          All copyrights reserved by{" "}
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
          </a>.
        </p>
      </div>
    </main>
  );
}
