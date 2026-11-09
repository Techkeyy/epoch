import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Courier_Prime, Fraunces, JetBrains_Mono, Public_Sans } from 'next/font/google';
import './globals.css';

// A registry's voice: Fraunces for what is set large, Courier Prime for what a clerk would type into the
// record, Public Sans for reading, JetBrains Mono only for code.
const sans = Public_Sans({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-sans' });
const serif = Fraunces({ subsets: ['latin'], axes: ['SOFT', 'WONK', 'opsz'], variable: '--font-serif' });
const typed = Courier_Prime({ subsets: ['latin'], weight: ['400', '700'], variable: '--font-typed' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Epoch: who controls this NEAR account, and since when',
  description: 'NEAR accounts can change hands while their name and history stay the same. Epoch shows when the keys that control an account today took over.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${typed.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
