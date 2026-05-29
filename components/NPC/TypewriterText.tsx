'use client';
import { useState } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export default function TypewriterText({ text, speed = 30, onComplete, className }: TypewriterTextProps) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  // Reset on text change
  useState(() => {
    setDisplayed('');
    setDone(false);
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayed(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setDone(true);
        onComplete?.();
      }
    }, speed);
    return () => clearInterval(interval);
  });

  return (
    <span className={className}>
      {displayed}
      {!done && <span style={{ animation: 'pulseGoldGlow 1s infinite', color: 'var(--color-arcane-light)' }}>▋</span>}
    </span>
  );
}
