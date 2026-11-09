import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { JetBrains_Mono, Public_Sans, Source_Serif_4 } from 'next/font/google';
import './globals.css';

const sans = Public_Sans({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-sans' });
const serif = Source_Serif_4({ subsets: ['latin'], weight: ['400', '500'], variable: '--font-serif' });
const mono = JetBrains_Mono({ subsets: ['latin'], weight: ['400'], variable: '--font-mono' });

export const metadata: Metadata = {
  title: 'Epoch: who controls this NEAR account, and since when',
  description: 'NEAR accounts can change hands while their name and history stay the same. Epoch shows when the keys that control an account today took over.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
