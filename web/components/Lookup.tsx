'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ACCOUNT_ID } from '@/lib/explain';
import { Record, RecordSkeleton, type Answer } from './Record';

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
  const [state, setState] = useState<State>({ kind: 'loading', account: initial || EXAMPLE });
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
    setState({ kind: 'loading', account });
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
      if (!r.ok) setState({ kind: 'error', account, message: body.error ?? 'Something went wrong' });
      else setState({ kind: 'done', answer: body });
    } catch {
      if (asked.current === account) setState({ kind: 'error', account, message: 'Your connection dropped before the answer came back' });
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
          <button type="submit" disabled={state.kind === 'loading' && mine}>
            {state.kind === 'loading' && mine ? 'Reading' : 'Check account'}
          </button>
        </form>
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
          {mine ? 'Your check, read from mainnet just now' : 'Example, read from mainnet just now: an account sold on a public marketplace'}
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
