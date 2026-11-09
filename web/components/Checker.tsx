'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Report } from '@/lib/epoch';
import { ACCOUNT_ID, type Explanation } from '@/lib/explain';
import { Result } from './Result';

type Answer = Report & { explanation: Explanation };
type State = { kind: 'idle' } | { kind: 'loading'; account: string } | { kind: 'done'; answer: Answer } | { kind: 'error'; account: string; message: string };

const EXAMPLES = ['ruble.near', 'wrap.near', 'near-foundation.near'];

export function Checker({ initial }: { initial: string }) {
  const [value, setValue] = useState(initial);
  const [hint, setHint] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const asked = useRef('');

  const run = useCallback(async (raw: string) => {
    const account = raw.trim().toLowerCase();
    if (!ACCOUNT_ID.test(account)) {
      setHint('That is not a NEAR account name. Names look like alice.near or app.tg.');
      return;
    }
    setHint('');
    setValue(account);
    asked.current = account;
    setState({ kind: 'loading', account });
    const url = new URL(window.location.href);
    url.searchParams.set('a', account);
    window.history.replaceState(null, '', url);
    try {
      const r = await fetch(`/api/check/${encodeURIComponent(account)}`);
      const body = await r.json();
      if (asked.current !== account) return;
      if (!r.ok) setState({ kind: 'error', account, message: body.error ?? 'Something went wrong.' });
      else setState({ kind: 'done', answer: body });
    } catch {
      if (asked.current === account) setState({ kind: 'error', account, message: 'Your connection dropped before the answer came back.' });
    }
  }, []);

  useEffect(() => {
    if (initial) void run(initial);
  }, [initial, run]);

  const busy = state.kind === 'loading';
  return (
    <>
      <form
        className="ask"
        onSubmit={(e) => {
          e.preventDefault();
          void run(value);
        }}
      >
        <label htmlFor="account" className="sr-only" style={{ position: 'absolute', left: -9999 }}>
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
          inputMode="url"
        />
        <button type="submit" disabled={busy}>
          {busy ? 'Checking…' : 'Check account'}
        </button>
      </form>
      {hint && <p className="hint">{hint}</p>}
      <p className="tries">
        Try:
        {EXAMPLES.map((x) => (
          <button key={x} type="button" onClick={() => void run(x)}>
            {x}
          </button>
        ))}
      </p>

      {state.kind === 'loading' && (
        <div className="result" aria-busy="true" aria-live="polite">
          <span className="pulse" />
          Reading the keys of <strong>{state.account}</strong> and the dates NEAR stamped on them…
        </div>
      )}
      {state.kind === 'error' && (
        <div className="error" role="alert">
          <p>{state.message}</p>
          <button type="button" onClick={() => void run(state.account)}>
            Try again
          </button>
        </div>
      )}
      {state.kind === 'done' && <Result answer={state.answer} />}
    </>
  );
}
