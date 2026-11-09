import { Checker } from '@/components/Checker';

const REPO = 'https://github.com/Techkeyy/epoch';
const SECONDEYES = 'https://secondeyes-j5ey.onrender.com';

export default async function Home({ searchParams }: { searchParams: Promise<{ a?: string }> }) {
  const { a } = await searchParams;
  return (
    <main className="page">
      <header className="top">
        <a className="brand" href="/">Epoch</a>
        <nav>
          <a href="#apps">For apps and agents</a>
          <a href={REPO}>Source</a>
        </nav>
      </header>

      <section className="lead">
        <h1>Who controls this NEAR account, and since when?</h1>
        <p>
          A NEAR account can change hands while its name and history stay the same. Before you pay or trust one, see
          when the keys that control it today took over.
        </p>
        <Checker initial={a ?? ''} />
      </section>

      <section className="section">
        <h2>Why an old account can be a new stranger</h2>
        <p>
          On NEAR, whoever holds an account’s full-access keys controls it. Swap all the keys and the account belongs to
          someone else, but its name, its balance history and its reputation carry on as if nothing happened. Accounts
          are bought and sold this way, and taken over the same way.
        </p>
        <p>
          So an account’s age tells you little. What matters is how long the people holding its keys today have held
          them. Epoch answers exactly that, from public chain data, in a couple of seconds.
        </p>
      </section>

      <section className="section">
        <h2>How it works</h2>
        <ol>
          <li>
            <strong>Today’s keys.</strong> Epoch reads the account’s full-access keys from NEAR mainnet.
          </li>
          <li>
            <strong>Their dates.</strong> NEAR stamps every new key with the block it was added in, so each key carries
            its own birth date. The oldest of today’s keys marks when the current control began.
          </li>
          <li>
            <strong>What came before.</strong> If the account existed before that, Epoch finds the keys that ran it
            earlier, when they were removed, and how the switch happened: old keys kept for a while, swapped at the
            same moment, or removed first with a gap where nobody held a key, which is how marketplace sales work.
          </li>
        </ol>
        <p>
          Epoch reports when control changed and how. It does not call anyone a scammer: owners replace lost keys
          too. What it tells you is whose history you are looking at.
        </p>
      </section>

      <section className="section" id="apps">
        <h2>For apps and agents</h2>
        <p>
          Wallets, payment tools and AI agents can ask before they pay. One request, no key needed, the same answer
          the page shows:
        </p>
        <pre>{`curl https://epoch-near.onrender.com/api/check/ruble.near

# the answer on 9 November 2026, shortened

{
  "verdict": {
    "kind": "changed",          // missing | locked | unchanged | changed
    "at": { "height": 95702651, "time": 1688496334059 },
    "daysAgo": 1224,
    "recent": false,            // true when control changed in the last 30 days
    "pattern": "handover",      // overlap | swap | handover
    "keylessDays": 244,
    "previousKeys": 4
  },
  "explanation": { "headline": "New keys took control of ruble.near on 4 July 2023.", ... }
}`}</pre>
        <p>
          A sensible rule for an agent: if <code>recent</code> is true, do not pay until a person has confirmed the
          payee through another channel.
        </p>
      </section>

      <section className="section">
        <h2>What it cannot tell you</h2>
        <details>
          <summary>Limits, stated plainly</summary>
          <ul>
            <li>It cannot say who holds the keys, only when they arrived and what happened to the ones before.</li>
            <li>
              A change of keys is not proof of a sale or a theft. An owner replacing a lost key looks like a swap. The
              pattern is evidence, not a verdict.
            </li>
            <li>
              Keys added before about June 2021 carry no date. If one of those still controls an account, Epoch says the
              control goes back at least that far.
            </li>
            <li>
              It looks at full-access keys only. Limited keys can call specific contracts but cannot change who controls
              the account.
            </li>
            <li>
              Answers come from free public NEAR servers. When they are busy a check can take longer or ask you to try
              again.
            </li>
          </ul>
        </details>
      </section>

      <footer>
        <span>
          Built for the NEAR Hackathon. Open source under the MIT licence: <a href={REPO}>source code</a>.
        </span>
        <span>
          Also from this builder: <a href={SECONDEYES}>SecondEyes</a>, a checked budget for AI agents.
        </span>
      </footer>
    </main>
  );
}
