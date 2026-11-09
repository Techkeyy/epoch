'use client';

import { useEffect, useRef, useState } from 'react';

// The Registrar: the clerk behind the counter. Watches you type, reads the ledger while Epoch checks, and
// stamps the answer. Pure SVG and CSS; every state is driven by what the page is actually doing.
export type Mood = 'idle' | 'typing' | 'valid' | 'checking' | 'changed' | 'same' | 'locked' | 'missing' | 'error';

const STAMP: Partial<Record<Mood, string>> = { changed: 'CHANGED', same: 'SAME', locked: 'LOCKED' };
const SAY: Record<Mood, string> = {
  idle: 'Name an account and I will look it up',
  typing: 'Go on',
  valid: 'That looks like a real name',
  checking: 'Reading the ledger',
  changed: 'Control changed hands',
  same: 'Same keys all along',
  locked: 'Nobody can take this one',
  missing: 'No such account in the register',
  error: 'The public servers are slow. Try again',
};

export function Clerk({ mood, look = 0 }: { mood: Mood; look?: number }) {
  const stamp = STAMP[mood];
  const box = useRef<HTMLElement>(null);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  // Between tasks the Registrar watches your pointer.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const r = box.current?.querySelector('svg')?.getBoundingClientRect();
      if (!r) return;
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height * 0.42);
      const d = Math.hypot(dx, dy) || 1;
      const reach = Math.min(1, d / 260);
      setGaze({ x: (dx / d) * 3 * reach, y: (dy / d) * 2.6 * reach });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  const typing = mood === 'typing' || mood === 'valid';
  const lx = typing ? Math.max(-1, Math.min(1, look)) * 3 : mood === 'checking' ? 0 : gaze.x;
  const ly = typing ? -2.5 : mood === 'checking' ? 2.5 : gaze.y;
  return (
    <figure className={`clerk mood-${mood}`} aria-live="polite" ref={box}>
      <svg viewBox="0 0 200 160" width="260" height="208" role="img" aria-label={`The registrar: ${SAY[mood]}`}>
        {/* desk and open ledger */}
        <rect className="c-desk" x="6" y="128" width="188" height="30" rx="4" />
        <g className="c-ledger">
          <path className="c-page" d="M48 132 L98 124 L98 142 L48 150 Z" />
          <path className="c-page" d="M98 124 L148 132 L148 150 L98 142 Z" />
          <path className="c-flip" d="M98 124 L148 132 L148 150 L98 142 Z" />
          <g className="c-lines">
            <line x1="56" y1="136" x2="90" y2="131" />
            <line x1="56" y1="141" x2="90" y2="136" />
            <line x1="106" y1="131" x2="140" y2="136" />
            <line x1="106" y1="136" x2="140" y2="141" />
          </g>
          {stamp && (
            <g className="c-ink" transform="translate(123 138) rotate(-9)">
              <rect x="-24" y="-7" width="48" height="14" rx="2" />
              <text x="0" y="3.6" textAnchor="middle">{stamp}</text>
            </g>
          )}
        </g>

        {/* body */}
        <path className="c-body" d="M54 128 C56 104 72 96 100 96 C128 96 144 104 146 128 Z" />
        <path className="c-collar" d="M88 97 L100 110 L112 97" />

        {/* head */}
        <g className="c-head">
          <ellipse className="c-ear" cx="72" cy="66" rx="5" ry="7" />
          <ellipse className="c-ear" cx="128" cy="66" rx="5" ry="7" />
          <circle className="c-face" cx="100" cy="64" r="28" />
          <path className="c-hair" d="M74 56 C76 40 90 34 100 34 C112 34 124 40 126 56 C118 48 108 46 100 46 C92 46 82 48 74 56 Z" />
          {/* eyeshade */}
          <path className="c-visor-band" d="M73 52 C84 44 116 44 127 52 L127 57 C116 50 84 50 73 57 Z" />
          <path className="c-visor" d="M70 56 C84 47 116 47 130 56 C122 64 78 64 70 56 Z" />
          {/* brows */}
          <g className="c-brows">
            <line x1="84" y1="60" x2="94" y2="59" />
            <line x1="106" y1="59" x2="116" y2="60" />
          </g>
          {/* glasses */}
          <g className="c-glasses">
            <circle cx="89" cy="68" r="8" />
            <circle cx="111" cy="68" r="8" />
            <line x1="97" y1="68" x2="103" y2="68" />
          </g>
          <g className="c-eyes" style={{ transform: `translate(${lx}px, ${ly}px)` }}>
            <circle cx="89" cy="68" r="2.4" />
            <circle cx="111" cy="68" r="2.4" />
          </g>
          {/* mouth */}
          <path className="c-mouth c-mouth-flat" d="M93 82 L107 82" />
          <path className="c-mouth c-mouth-smile" d="M92 80 Q100 87 108 80" />
          <ellipse className="c-mouth c-mouth-o" cx="100" cy="82" rx="3" ry="3.5" />
          <path className="c-mouth c-mouth-down" d="M93 84 Q100 79 107 84" />
          <circle className="c-sweat" cx="128" cy="52" r="3" />
        </g>

        {/* arm holding the stamp over the ledger */}
        <path className="c-sleeve" d="M141 120 C140 110 134 104 128 101" />
        <g className="c-stamp">
          <circle className="c-knob" cx="123" cy="88" r="6" />
          <rect className="c-handle" x="120" y="92" width="6" height="12" />
          <circle className="c-hand" cx="127" cy="100" r="4.5" />
          <rect className="c-block" x="112" y="104" width="22" height="9" rx="1.5" />
          <rect className="c-rubber" x="113" y="113" width="20" height="3" />
        </g>
      </svg>
      <figcaption>{SAY[mood]}</figcaption>
    </figure>
  );
}
