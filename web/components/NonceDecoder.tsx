'use client';

// The trick Epoch rests on, with a real key: a key's counter starts at its block height times a million.
import { useEffect, useRef, useState } from 'react';

const KEY = 'ed25519:Fb68DxoknuuNL2k4L5TC24uTMdkUSC6QURcqyE6LY3Mu';
const NONCE = '95702651000001';
const HEIGHT = 95_702_651;
const WHEN = '4 July 2023, 18:45 UTC';

export function NonceDecoder() {
  const ref = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setStep(3);
      return;
    }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      [1, 2, 3].forEach((s, i) => setTimeout(() => setStep(s), 400 + i * 700));
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="decoder" ref={ref} aria-label={`The key's counter ${NONCE} means it was added at block ${HEIGHT}, ${WHEN}`}>
      <div className="decoder-row">
        <span className="decoder-label">A key on ruble.near</span>
        <span className="mono decoder-key">{KEY.slice(0, 20)}…{KEY.slice(-6)}</span>
      </div>
      <div className="decoder-row">
        <span className="decoder-label">Its counter</span>
        <span className="mono decoder-nonce">
          <span className={step >= 1 ? 'hi' : ''}>{NONCE.slice(0, -6)}</span>
          <span className={step >= 1 ? 'lo' : ''}>{NONCE.slice(-6)}</span>
        </span>
      </div>
      <svg className={`decoder-arrow${step >= 2 ? ' on' : ''}`} width="24" height="28" viewBox="0 0 24 28" aria-hidden="true">
        <path d="M12 2 V24 M5 17 L12 24 L19 17" pathLength={1} />
      </svg>
      <div className={`decoder-row decoder-out${step >= 2 ? ' on' : ''}`}>
        <span className="decoder-label">Divide by a million</span>
        <span>Block {HEIGHT.toLocaleString('en-US')}</span>
      </div>
      <div className={`decoder-row decoder-out${step >= 3 ? ' on' : ''}`}>
        <span className="decoder-label">That block was made</span>
        <span className="decoder-when">{WHEN}</span>
      </div>
      <p className="decoder-note">The last digits count how often the key has signed since. This one has signed once.</p>
    </div>
  );
}
