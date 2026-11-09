import type { Report } from '@/lib/epoch';
import type { Explanation } from '@/lib/explain';

const BADGE: Record<Explanation['tone'], string> = {
  steady: 'Same control',
  changed: 'Control changed',
  recent: 'Changed recently',
  neutral: 'Not found',
};
const short = (t: number) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const key = (k: string) => (k.length > 24 ? `${k.slice(0, 16)}…${k.slice(-6)}` : k);

/** The account's life as one bar: earlier keys, any stretch with no full-access key, then today's keys. */
function Timeline({ report, now }: { report: Report; now: number }) {
  const v = report.verdict;
  if (v.kind === 'unchanged' && v.since) {
    return (
      <div className="line">
        <div className="bar" role="img" aria-label={`Same keys from ${short(v.since.time)} until today`}>
          <span className="now" style={{ flex: 1 }} />
        </div>
        <div className="marks">
          <span>{short(v.since.time)}</span>
          <span>today</span>
        </div>
      </div>
    );
  }
  if (v.kind !== 'changed') return null;
  const first = report.previous?.[0]?.added ?? null;
  const from = first ?? v.at.time - Math.max(now - v.at.time, 365 * 86_400_000);
  const oldEnd = v.pattern === 'handover' ? v.oldRemoved.time : v.at.time;
  const part = (a: number, b: number) => Math.max(b - a, 0);
  return (
    <div className="line">
      <div className="bar" role="img" aria-label={`Earlier keys until ${short(oldEnd)}, today's keys from ${short(v.at.time)}`}>
        <span className="before" style={{ flex: part(from, oldEnd) }} />
        {v.pattern === 'handover' && <span className="keyless" style={{ flex: part(v.oldRemoved.time, v.at.time) }} />}
        <span className="now" style={{ flex: Math.max(part(v.at.time, now), (now - from) * 0.02) }} />
      </div>
      <div className="marks">
        <span>{first ? short(first) : 'earlier'}</span>
        {v.pattern === 'handover' && <span>keys removed {short(v.oldRemoved.time)}</span>}
        <span>new keys {short(v.at.time)}</span>
        <span>today</span>
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--old)' }} />earlier keys</span>
        {v.pattern === 'handover' && <span><i style={{ background: 'var(--gap)' }} />no full-access key</span>}
        <span><i style={{ background: v.recent ? 'var(--recent)' : 'var(--action)' }} />keys in control today</span>
      </div>
    </div>
  );
}

export function Result({ answer }: { answer: Report & { explanation: Explanation } }) {
  const { explanation: e } = answer;
  const full = answer.keys.filter((k) => k.full).sort((a, b) => (b.added?.time ?? 0) - (a.added?.time ?? 0));
  const limited = answer.keys.length - full.length;
  return (
    <section className={`result tone-${e.tone}`} aria-live="polite">
      <span className="badge">{answer.verdict.kind === 'locked' ? 'Locked' : BADGE[e.tone]}</span>
      <h2>{e.headline}</h2>
      <div className="detail">
        {e.detail.map((d) => (
          <p key={d}>{d}</p>
        ))}
      </div>
      <Timeline report={answer} now={answer.checkedAt} />

      {full.length > 0 && (
        <div className="keys">
          <h3>Full-access keys today</h3>
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Added</th>
                <th>Block</th>
              </tr>
            </thead>
            <tbody>
              {full.slice(0, 8).map((k) => (
                <tr key={k.publicKey}>
                  <td className="mono" title={k.publicKey}>{key(k.publicKey)}</td>
                  <td>{k.added ? short(k.added.time) : 'before June 2021'}</td>
                  <td className="mono">{k.added?.height?.toLocaleString('en-US') ?? '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {full.length > 8 && <p className="more">and {full.length - 8} more.</p>}
          {limited > 0 && (
            <p className="more">
              Also {limited} limited key{limited === 1 ? '' : 's'} that can only call specific contracts, so they cannot change who controls the account.
            </p>
          )}
        </div>
      )}

      {answer.previous && answer.previous.length > 0 && (
        <details className="keys">
          <summary>Earlier full-access keys ({answer.previous.length}), now removed</summary>
          <table>
            <thead>
              <tr>
                <th>Key</th>
                <th>Added</th>
                <th>Removed</th>
              </tr>
            </thead>
            <tbody>
              {answer.previous.slice(-12).map((k) => (
                <tr key={`${k.publicKey}${k.added}`}>
                  <td className="mono" title={k.publicKey}>{key(k.publicKey)}</td>
                  <td>{k.added ? short(k.added) : '-'}</td>
                  <td>{short(k.removed)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <p className="more" style={{ marginTop: 18, fontSize: 15, color: 'var(--ink-2)' }}>
        Read from NEAR mainnet at block {answer.head.toLocaleString('en-US')}.{' '}
        <a href={`https://nearblocks.io/address/${answer.account}?tab=accesskeys`} target="_blank" rel="noreferrer">
          See the keys on NearBlocks
        </a>
      </p>
    </section>
  );
}
