'use client';

// Every full-access key as a line from the day it was added to the day it was removed. The hatched band is
// time with no full-access key; the red rule is where control changed. Point anywhere to read that day.
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Report } from '@/lib/epoch';

type Line = { key: string; from: number; to: number | null; now: boolean };
const DAY = 86_400_000;
const date = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortKey = (k: string) => `${k.slice(8, 14)}…${k.slice(-4)}`;

export function lifelinesOf(r: Report): { lines: Line[]; hidden: number; start: number; end: number; era: number | null; gap: [number, number] | null } {
  const v = r.verdict;
  const end = r.checkedAt;
  const current: Line[] = r.keys
    .filter((k) => k.full)
    .map((k) => ({ key: k.publicKey, from: k.added?.time ?? 0, to: null, now: true }));
  let earlier: Line[] = (r.previous ?? []).map((k) => ({ key: k.publicKey, from: k.added ?? 0, to: k.removed, now: false }));
  const era = v.kind === 'changed' ? v.at.time : null;
  const gap: [number, number] | null = v.kind === 'changed' && v.pattern === 'handover' ? [v.oldRemoved.time, v.at.time] : null;
  if (v.kind === 'changed' && !earlier.length) earlier = [{ key: `${v.previousKeys} earlier keys`, from: 0, to: v.oldRemoved.time, now: false }];
  const known = [...earlier, ...current].map((l) => l.from).filter(Boolean);
  // Keys from before dated nonces, or earlier keys with no recorded start, begin at the left edge.
  const start = Math.min(...known, era ?? end, end - 365 * DAY) - 60 * DAY;
  const fix = (l: Line) => ({ ...l, from: l.from || start });
  const MAX_EARLIER = 7;
  const MAX_NOW = 5;
  const shownEarlier = earlier.slice(-MAX_EARLIER).map(fix);
  const shownNow = current.slice(0, MAX_NOW).map(fix);
  const lines = [...shownEarlier, ...shownNow].sort((a, b) => a.from - b.from);
  return { lines, hidden: earlier.length + current.length - lines.length, start, end, era, gap };
}

/** Who could sign for the account at time t. */
export function holderAt(t: number, lines: Line[], era: number | null, gap: [number, number] | null) {
  const earlier = lines.filter((l) => !l.now && l.from <= t && (l.to ?? Infinity) > t).length;
  const now = lines.filter((l) => l.now && l.from <= t).length;
  if (gap && t >= gap[0] && t < gap[1]) return { tone: 'gap', text: 'Nobody held a full-access key' };
  if (now && earlier) return { tone: 'both', text: `Earlier keys and today’s keys could both sign` };
  if (now) return { tone: 'now', text: `Today’s keys held it${era && t >= era ? ', after control changed' : ''}` };
  if (earlier) return { tone: 'before', text: `Earlier keys held it, ${earlier === 1 ? 'one key' : `${earlier} keys`}` };
  return { tone: 'none', text: 'Before the first key on record' };
}

export function Lifelines({ report, cursor, onCursor, animate = true }: { report: Report; cursor?: number | null; onCursor?: (t: number | null) => void; animate?: boolean }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);
  const hatch = useId().replace(/:/g, '');
  const data = useMemo(() => lifelinesOf(report), [report]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { lines, start, end, era, gap, hidden } = data;
  if (!lines.length) return null;
  const top = 34;
  const row = 18;
  const height = top + lines.length * row + 30;
  const x = (t: number) => ((t - start) / (end - start)) * (width - 2) + 1;
  const t = (px: number) => start + ((px - 1) / (width - 2)) * (end - start);
  const shown = cursor !== undefined ? cursor : hover;
  const years: number[] = [];
  for (let y = new Date(start).getUTCFullYear() + 1; y <= new Date(end).getUTCFullYear(); y++) years.push(Date.UTC(y, 0, 1));
  const readout = shown != null ? holderAt(shown, lines, era, gap) : null;

  const move = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    const v = Math.min(end, Math.max(start, t(clientX - r.left)));
    if (onCursor) onCursor(v);
    else setHover(v);
  };

  return (
    <div className={`lifelines${animate ? ' animate' : ''}`} ref={box}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`Timeline of ${lines.length} full-access keys${era ? `, control changed on ${date(era)}` : ''}`}
        onPointerMove={(e) => move(e.clientX)}
        onPointerDown={(e) => move(e.clientX)}
        onPointerLeave={() => (onCursor ? undefined : setHover(null))}
      >
        <defs>
          <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="6" height="6" fill="var(--sheet)" />
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink)" strokeOpacity="0.22" strokeWidth="2" />
          </pattern>
        </defs>

        {years.map((y) => (
          <g key={y} className="tick">
            <line x1={x(y)} x2={x(y)} y1={top - 6} y2={height - 22} />
            <text x={x(y) + 4} y={height - 8}>{new Date(y).getUTCFullYear()}</text>
          </g>
        ))}

        {gap && <rect className="gap" x={x(gap[0])} y={top - 6} width={Math.max(2, x(gap[1]) - x(gap[0]))} height={lines.length * row + 8} fill={`url(#${hatch})`} />}

        {(() => {
          // A small label at the start of each group of lines.
          const firstBefore = lines.findIndex((l) => !l.now);
          const firstNow = lines.findIndex((l) => l.now);
          const label = (i: number, text: string, cls: string) =>
            i < 0 ? null : (
              <text className={`group ${cls}`} x={Math.min(Math.max(x(lines[i].from), 0), width - 90)} y={top + i * row + 1}>
                {text}
              </text>
            );
          return (
            <>
              {label(firstBefore, 'Earlier keys', 'before')}
              {label(firstNow, 'Today’s keys', 'now')}
            </>
          );
        })()}

        {lines.map((l, i) => {
          const y = top + i * row + row / 2 + 4;
          const x1 = x(l.from);
          const x2 = x(l.to ?? end);
          return (
            <g key={l.key + i} className={l.now ? 'line now' : 'line before'}>
              <line x1={x1} x2={Math.max(x1 + 0.5, x2)} y1={y} y2={y} pathLength={1} style={{ animationDelay: `${120 + i * 60}ms` }} />
              <circle cx={x1} cy={y} r={3} style={{ animationDelay: `${120 + i * 60}ms` }} />
              {l.to && <circle cx={x2} cy={y} r={3} className="end" style={{ animationDelay: `${420 + i * 60}ms` }} />}
              <title>{`${l.key.startsWith('ed25519:') ? shortKey(l.key) : l.key}: ${l.from > start ? `added ${date(l.from)}` : 'added earlier'}${l.to ? `, removed ${date(l.to)}` : ', in control today'}`}</title>
            </g>
          );
        })}

        {era && (
          <g className="era-mark">
            <line x1={x(era)} x2={x(era)} y1={4} y2={height - 22} pathLength={1} />
            <text x={Math.min(x(era) + 6, width - 118)} y={14}>Control changed</text>
          </g>
        )}

        {shown != null && (
          <g className="cursor">
            <line x1={x(shown)} x2={x(shown)} y1={top - 10} y2={height - 22} />
            <circle cx={x(shown)} cy={top - 10} r={3} />
          </g>
        )}
      </svg>
      <p className={`readout tone-${readout?.tone ?? 'idle'}`} aria-live="polite">
        {readout ? (
          <>
            <span className="readout-date">{date(shown!)}</span>
            {readout.text}
          </>
        ) : (
          <span className="readout-hint">Point at the timeline to see who held the account on any day</span>
        )}
      </p>
      {hidden > 0 && <p className="lifelines-more">{hidden} more key{hidden === 1 ? '' : 's'} not drawn</p>}
    </div>
  );
}
