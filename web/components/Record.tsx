'use client';

import { useState } from 'react';
import type { Report } from '@/lib/epoch';
import type { Explanation } from '@/lib/explain';
import { register, type Entry } from '@/lib/register';
import { Lifelines } from './Lifelines';
import { Tally } from './Tally';

export type Answer = Report & { explanation: Explanation };

const BADGE: Record<Explanation['tone'], string> = {
  steady: 'Same control',
  changed: 'Control changed',
  recent: 'Changed recently',
  neutral: 'Not found',
};
const date = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const days = (n: number) => `${n.toLocaleString('en-US')} day${n === 1 ? '' : 's'}`;
const keys = (n: number) => `${n} full-access key${n === 1 ? '' : 's'}`;
const shortKey = (k: string) => (k.length > 26 ? `${k.slice(0, 16)}…${k.slice(-6)}` : k);

function Row({ e, now }: { e: Entry; now: number }) {
  switch (e.kind) {
    case 'earlier':
      return (
        <li className="entry">
          <span className="margin">{e.from ? date(e.from) : 'Earlier'}</span>
          <div>
            <strong>Earlier keys</strong>
            <p>{keys(e.keys)}, all removed by {date(e.to)}</p>
          </div>
        </li>
      );
    case 'keyless':
      return (
        <li className="entry keyless">
          <span className="margin">{date(e.from)}</span>
          <div>
            <strong>No full-access key for {days(e.days)}</strong>
            <p>Nobody could sign for the account</p>
          </div>
        </li>
      );
    case 'era':
      return (
        <li className="era" aria-label={`Control changed on ${date(e.at)}`}>
          <span className="margin">{date(e.at)}</span>
          <span className="era-label">Control changed</span>
        </li>
      );
    case 'current':
      return (
        <li className="entry current">
          <span className="margin">{e.from ? date(e.from) : 'Before June 2021'}</span>
          <div>
            <strong>Keys in control today</strong>
            <p>
              {keys(e.keys)}
              {e.from ? `, held for ${days(Math.floor((now - e.from) / 86_400_000))}` : ', dated before NEAR stamped keys'}
              {e.fromCreation ? ', since the account got its first key' : ''}
            </p>
            {e.oldKeptUntil && <p>The earlier keys kept working beside them until {date(e.oldKeptUntil)}</p>}
          </div>
        </li>
      );
    case 'locked':
      return (
        <li className="entry">
          <span className="margin">Today</span>
          <div>
            <strong>No full-access key</strong>
            <p>{e.contract ? 'Only the contract deployed on it can change who controls it' : 'Its keys can only call specific contracts'}</p>
          </div>
        </li>
      );
  }
}

export function Record({ answer }: { answer: Answer }) {
  const e = answer.explanation;
  const entries = register(answer);
  const full = answer.keys.filter((k) => k.full).sort((a, b) => (b.added?.time ?? 0) - (a.added?.time ?? 0));
  const limited = answer.keys.length - full.length;
  return (
    <article className={`record tone-${e.tone}`}>
      <header className="record-head">
        <span className="kicker">Record of control</span>
        <span className="stamp" aria-label={answer.verdict.kind === 'locked' ? 'Locked' : BADGE[e.tone]}>{answer.verdict.kind === 'locked' ? 'Locked' : BADGE[e.tone]}</span>
      </header>
      <h2 className="record-account">{answer.account}</h2>
      <p className="record-headline">{e.headline}</p>

      <Tally report={answer} />
      <Lifelines report={answer} />

      {entries.length > 0 && (
        <ol className="register">
          {entries.map((x, i) => (
            <Row key={i} e={x} now={answer.checkedAt} />
          ))}
        </ol>
      )}

      <div className="record-detail">
        {e.detail.map((d) => (
          <p key={d}>{d}</p>
        ))}
      </div>

      {(full.length > 0 || (answer.previous?.length ?? 0) > 0) && (
        <details className="record-keys">
          <summary>The keys themselves</summary>
          {full.length > 0 && (
            <table>
              <caption>In control today</caption>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {full.slice(0, 8).map((k) => (
                  <tr key={k.publicKey}>
                    <td className="mono" title={k.publicKey}>{shortKey(k.publicKey)}</td>
                    <td>{k.added ? date(k.added.time) : 'Before June 2021'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {full.length > 8 && <p>And {full.length - 8} more</p>}
          {limited > 0 && <p>Also {limited} limited key{limited === 1 ? '' : 's'}, which can call specific contracts but cannot change who controls the account</p>}
          {answer.previous && answer.previous.length > 0 && (
            <table>
              <caption>Earlier, now removed</caption>
              <thead>
                <tr>
                  <th>Key</th>
                  <th>Removed</th>
                </tr>
              </thead>
              <tbody>
                {answer.previous.slice(-8).map((k) => (
                  <tr key={`${k.publicKey}${k.added}`}>
                    <td className="mono" title={k.publicKey}>{shortKey(k.publicKey)}</td>
                    <td>{date(k.removed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </details>
      )}

      <footer className="record-foot">
        <span className="mono">Mainnet block {answer.head.toLocaleString('en-US')}</span>
        <CopyLink account={answer.account} />
        <a href={`https://nearblocks.io/address/${answer.account}?tab=accesskeys`} target="_blank" rel="noreferrer">
          Keys on NearBlocks
        </a>
      </footer>
    </article>
  );
}

/** Someone about to pay often wants to show the record to someone else first. */
function CopyLink({ account }: { account: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="copy"
      onClick={async () => {
        const url = new URL(window.location.href);
        url.search = new URLSearchParams({ a: account }).toString();
        url.hash = '';
        try {
          await navigator.clipboard.writeText(url.toString());
          setDone(true);
          setTimeout(() => setDone(false), 1800);
        } catch {
          window.prompt('Copy this link', url.toString());
        }
      }}
    >
      {done ? 'Link copied' : 'Copy link'}
    </button>
  );
}

export function RecordSkeleton({ account }: { account: string }) {
  return (
    <article className="record record-loading" aria-busy="true" aria-live="polite">
      <header className="record-head">
        <span className="kicker">Record of control</span>
      </header>
      <h2 className="record-account">{account}</h2>
      <p className="record-headline">Reading its keys and the dates NEAR stamped on them</p>
      <svg className="scan" viewBox="0 0 520 96" preserveAspectRatio="none" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="0" x2="520" y1={22 + i * 16} y2={22 + i * 16} />
        ))}
        <rect className="scan-beam" x="0" y="8" width="56" height="80" />
      </svg>
      <ol className="register">
        {[0, 1, 2].map((i) => (
          <li key={i} className="entry">
            <span className="margin"><i className="bone" style={{ width: 72 }} /></span>
            <div>
              <i className="bone" style={{ width: '46%' }} />
              <i className="bone" style={{ width: '70%' }} />
            </div>
          </li>
        ))}
      </ol>
    </article>
  );
}
