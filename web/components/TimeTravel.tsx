'use client';

// Drag through one account's real history. What the account shows never changes; who can sign for it does.
import { useMemo, useState } from 'react';
import type { Report } from '@/lib/epoch';
import { holderAt, Lifelines, lifelinesOf } from './Lifelines';

const date = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

export function TimeTravel({ report }: { report: Report }) {
  const data = useMemo(() => lifelinesOf(report), [report]);
  const firstKey = data.lines.find((l) => !l.now)?.from ?? data.start;
  const [at, setAt] = useState(firstKey + 120 * 86_400_000);
  const holder = holderAt(at, data.lines, data.era, data.gap);
  const who = { before: 'The first owner’s keys', gap: 'Nobody. Listed for sale', now: 'The new owner’s keys', both: 'Old and new keys', none: 'Nobody yet' }[holder.tone] ?? holder.text;

  return (
    <div className="travel">
      <div className="travel-panels">
        <div className="travel-panel">
          <span className="travel-label">What the account shows on {date(at)}</span>
          <span className="travel-big mono">{report.account}</span>
          <span className="travel-sub">Same name, same history, same reputation</span>
        </div>
        <div className={`travel-panel travel-who tone-${holder.tone}`}>
          <span className="travel-label">Who can sign for it</span>
          <span className="travel-big" key={holder.tone}>{who}</span>
          <span className="travel-sub">{holder.text}</span>
        </div>
      </div>
      <Lifelines report={report} cursor={at} onCursor={(t) => t && setAt(t)} animate={false} />
      <label className="travel-slider">
        <span className="visually-hidden">Date</span>
        <input type="range" min={data.start} max={data.end} step={86_400_000} value={at} onChange={(e) => setAt(Number(e.target.value))} />
      </label>
    </div>
  );
}
