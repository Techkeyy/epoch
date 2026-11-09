'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ACCOUNT_ID } from '@/lib/explain';
import { Record, RecordSkeleton, type Answer } from './Record';
import saved from '@/lib/example.json';

type State =
  | { kind: 'loading'; account: string }
  | { kind: 'done'; answer: Answer }
  | { kind: 'error'; account: string; message: string };

export const EXAMPLE = 'ruble.near';
const TRIES = ['ruble.near', 'near-foundation.near', 'wrap.near'];

/** The first screen: the question and the box on one side, a record of control on the other. The record
 *  starts as a live example and becomes the visitor's own answer in the same place. */
export function Lookup({ initial, children }: { initial: string; children: ReactNode }) {
  const [value, setValue] = useState(initial);
  const [hint, setHint] = useState('');
  // The first screen never waits: a saved read of the example shows at once, then a live read replaces it.
  const [state, setState] = useState<State>(initial ? { kind: 'loading', account: initial } : { kind: 'done', answer: saved as unknown as Answer });
  const [live, setLive] = useState(false);
  const [mine, setMine] = useState(!!initial);
  const asked = useRef('');
  const panel = useRef<HTMLDivElement>(null);

  const run = useCallback(async (raw: string, own: boolean) => {
    const account = raw.trim().toLowerCase();
    if (!ACCOUNT_ID.test(account)) {
      setHint('That is not a NEAR account name. Names look like alice.near or app.tg');
      return;
    }
    setHint('');
    asked.current = account;
    setMine(own);
    setLive(false);
    // Refreshing the example keeps the saved read on screen instead of flashing a skeleton.
    if (own) setState({ kind: 'loading', account });
    if (own) {
      setValue(account);
      const url = new URL(window.location.href);
      url.searchParams.set('a', account);
      window.history.replaceState(null, '', url);
      // On a phone the record sits below the box, so bring it into view.
      if (window.matchMedia('(max-width: 899px)').matches) panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    try {
      const r = await fetch(`/api/check/${encodeURIComponent(account)}`);
      const body = await r.json();
      if (asked.current !== account) return;
      if (!r.ok) {
        if (own) setState({ kind: 'error', account, message: body.error ?? 'Something went wrong' });
      } else {
        setState({ kind: 'done', answer: body });
        setLive(true);
      }
    } catch {
      if (asked.current === account && own) setState({ kind: 'error', account, message: 'Your connection dropped before the answer came back' });
    }
  }, []);

  useEffect(() => {
    void run(initial || EXAMPLE, !!initial);
  }, [initial, run]);

  return (
    <section className="hero">
      <div className="hero-text">
        {children}
        <form
          className="ask"
          onSubmit={(e) => {
            e.preventDefault();
            void run(value, true);
          }}
        >
          <label htmlFor="account" className="visually-hidden">
            NEAR account name
          </label>
          <span className={`field${ACCOUNT_ID.test(value.trim().toLowerCase()) ? ' ok' : ''}`}>
          <input
            id="account"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="account.near"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="off"
          />
          <svg className="field-tick" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path d="M4 9.5 L7.5 13 L14 5.5" pathLength={1} />
          </svg>
          </span>
          <button type="submit" disabled={state.kind === 'loading' && mine}>
            {state.kind === 'loading' && mine ? 'Reading' : 'Check account'}
          </button>
        </form>
        <Feedback value={value} onPick={(v) => void run(v, true)} />
        {hint && <p className="hint">{hint}</p>}
        <p className="tries">
          <span>Try</span>
          {TRIES.map((x) => (
            <button key={x} type="button" onClick={() => void run(x, true)}>
              {x}
            </button>
          ))}
        </p>
        <p className="quiet">No wallet, no sign-in. Read from NEAR mainnet as you ask.</p>
      </div>

      <div className="hero-record" ref={panel}>
        <p className="panel-label">
          {mine ? 'Your check, read from mainnet just now' : `Example: an account sold on a public marketplace${live ? ', read from mainnet just now' : ''}`}
        </p>
        {state.kind === 'loading' && <RecordSkeleton account={state.account} />}
        {state.kind === 'done' && <Record key={state.answer.account + state.answer.checkedAt} answer={state.answer} />}
        {state.kind === 'error' && (
          <div className="record record-error" role="alert">
            <h2 className="record-account">{state.account}</h2>
            <p>{state.message}</p>
            <button type="button" onClick={() => void run(state.account, mine)}>
              Try again
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/** While typing: a bare name is almost always missing its ending, so offer the two common ones. */
function Feedback({ value, onPick }: { value: string; onPick: (v: string) => void }) {
  const v = value.trim().toLowerCase();
  if (!v || v.includes('.') || v.length === 64 || !/^[a-zd_-]+$/.test(v)) return null;
  return (
    <p className="suggest">
      <span>Did you mean</span>
      {['near', 'tg'].map((end) => (
        <button key={end} type="button" onClick={() => onPick(`${v}.${end}`)}>
          {v}.{end}
        </button>
      ))}
    </p>
  );
}
