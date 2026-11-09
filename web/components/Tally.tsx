'use client';

// The contrast in two numbers: days under today's keys against the days of history before them.
import { useEffect, useState } from 'react';
import type { Report } from '@/lib/epoch';

const DAY = 86_400_000;

function useCount(target: number, ms = 900) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms);
      setN(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return n;
}

export function Tally({ report }: { report: Report }) {
  const v = report.verdict;
  const firstEarlier = report.previous?.[0]?.added ?? null;
  const since = v.kind === 'changed' ? v.at.time : v.kind === 'unchanged' ? v.since?.time ?? null : null;
  const held = since ? Math.floor((report.checkedAt - since) / DAY) : 0;
  const before = v.kind === 'changed' && firstEarlier ? Math.floor((v.at.time - firstEarlier) / DAY) : 0;
  const a = useCount(held);
  const b = useCount(before);
  if (!since) return null;
  return (
    <div className="tally">
      <div>
        <span className="tally-n">{a.toLocaleString('en-US')}</span>
        <span className="tally-l">days under today’s keys</span>
      </div>
      {before > 0 && (
        <div className="tally-before">
          <span className="tally-n">{b.toLocaleString('en-US')}</span>
          <span className="tally-l">days of history before, under other keys</span>
        </div>
      )}
    </div>
  );
}
