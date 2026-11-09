import { Lookup } from '@/components/Lookup';
import { NonceDecoder } from '@/components/NonceDecoder';
import { TimeTravel } from '@/components/TimeTravel';
import type { Report } from '@/lib/epoch';
import saved from '@/lib/example.json';

const REPO = 'https://github.com/Techkeyy/epoch';
const SECONDEYES = 'https://secondeyes-j5ey.onrender.com';

export default async function Home({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const { a } = await searchParams;
  return (
    <>
      <header className="top">
        <a className="brand" href="/" aria-label="Epoch, home">
          <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
            <rect x="2" y="3" width="6" height="14" rx="1" fill="currentColor" opacity="0.35" />
            <rect x="12" y="3" width="6" height="14" rx="1" fill="currentColor" />
            <rect x="9.25" y="1" width="1.5" height="18" fill="var(--era)" />
          </svg>
          Epoch
        </a>
        <nav>
          <a href="#how">How it works</a>
          <a href="#apps">For apps and agents</a>
          <a href={REPO}>Source</a>
        </nav>
      </header>

      <main>
        <Lookup initial={a ?? ''}>
          <h1>Who holds this NEAR account now, and since when</h1>
          <p className="lede">
            A NEAR account can change hands while its name and history stay the same. Before you pay or trust one, see
            when the keys that control it today took over.
          </p>
        </Lookup>

        <section className="band">
          <div className="wrap contrast">
            <h2>An old account can be a new stranger</h2>
            <p className="section-lede">
              Whoever holds an account’s full-access keys controls it. Replace the keys and the account belongs to
              someone else, while its name and its past carry on. Accounts are sold this way and taken over the same way.
            </p>
            <TimeTravel report={saved as unknown as Report} />
            <p className="travel-note">Drag along a real account’s history, read from mainnet on 9 November 2026.</p>
            <div className="proof">
              <p className="proof-figure">
                <span>49</span> of 71
              </p>
              <p>
                accounts sold on near.bet show this handover: old keys removed, a stretch with no key, then new keys.
                Among 70 long-running projects and people, <strong>none</strong> do.{' '}
                <a href="https://github.com/Techkeyy/epoch#does-it-work-the-benchmark">How this was measured</a>
              </p>
            </div>
          </div>
        </section>

        <section className="wrap section" id="how">
          <div className="how">
            <div>
              <h2>How it works</h2>
              <p className="section-lede">
                Every NEAR key carries the date it was added, hidden in plain sight in its counter. Epoch reads it.
              </p>
            </div>
            <NonceDecoder />
          </div>
          <ol className="steps">
            <li>
              <span className="step-n">1</span>
              <h3>Today’s keys</h3>
              <p>Epoch reads the account’s full-access keys from NEAR mainnet.</p>
            </li>
            <li>
              <span className="step-n">2</span>
              <h3>Their dates</h3>
              <p>
                NEAR starts each new key’s counter at the block it was added in, times a million. So every key carries its
                own date, and the oldest of today’s keys is when the current control began.
              </p>
            </li>
            <li>
              <span className="step-n">3</span>
              <h3>What came before</h3>
              <p>
                Epoch finds the keys that ran the account earlier and how they left: kept for a while, swapped at the same
                moment, or removed first with a gap where nobody held a key.
              </p>
            </li>
          </ol>
          <p className="note">
            Epoch says when control changed and how. It does not call anyone a scammer, because owners replace lost keys
            too. It tells you whose history you are looking at.
          </p>
        </section>

        <section className="wrap section apps" id="apps">
          <div>
            <h2>For apps and agents</h2>
            <p>
              Wallets, payment tools and AI agents can ask before they pay. One request, no key, the same answer the page
              shows.
            </p>
            <p>
              A sensible rule: when <code>recent</code> is true, control changed in the last 30 days. Do not pay until a
              person has confirmed the payee another way.
            </p>
          </div>
          <pre>{`curl https://epoch-near.onrender.com/api/check/ruble.near

# the answer on 9 November 2026, shortened
{
  "verdict": {
    "kind": "changed",       // missing | locked | unchanged | changed
    "at": { "height": 95702651, "time": 1688496334059 },
    "daysAgo": 1224,
    "recent": false,
    "pattern": "handover",   // overlap | swap | handover
    "keylessDays": 244,
    "previousKeys": 4
  },
  "explanation": {
    "headline": "New keys took control of ruble.near on 4 July 2023."
  }
}`}</pre>
        </section>

        <section className="wrap section">
          <details className="limits">
            <summary>What it cannot tell you</summary>
            <ul>
              <li>Who holds the keys. Only when they arrived and what happened to the ones before.</li>
              <li>Whether a change was a sale or a theft. An owner replacing a lost key looks like a swap. The pattern is evidence, not a verdict.</li>
              <li>Dates for keys added before about June 2021. If one still controls an account, Epoch says control goes back at least that far.</li>
              <li>Anything about limited keys. They can call specific contracts but cannot change who controls an account.</li>
              <li>Instant answers every time. It runs on free public NEAR servers, so a busy moment can mean a short wait.</li>
            </ul>
          </details>
        </section>
      </main>

      <footer className="wrap foot">
        <span>
          Built at NEAR HACKATHON. MIT licensed, <a href={REPO}>source on GitHub</a>
        </span>
        <span>
          Also from this builder: <a href={SECONDEYES}>SecondEyes</a>, a checked budget for AI agents
        </span>
      </footer>
    </>
  );
}
