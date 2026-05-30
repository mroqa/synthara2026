import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Synthara — Your Past Writes Your Future',
  description: 'Experience a dark fantasy narrative game where NPCs craft personalized quests based on your episodic memories. Powered by Qdrant and Gemini AI.',
  keywords: ['synthara', 'rpg', 'quest', 'ai', 'memory', 'narrative game'],
  openGraph: {
    title: 'Synthara',
    description: 'Your past writes your future.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#080810',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
