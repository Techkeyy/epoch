import { describe, expect, it } from 'vitest';
import type { Report, Verdict } from './epoch';
import { register } from './register';

const report = (verdict: Verdict, extra: Partial<Report> = {}): Report => ({
  account: 'x.near',
  checkedAt: 0,
  head: 1,
  keys: [
    { publicKey: 'a', full: true, added: null },
    { publicKey: 'b', full: true, added: null },
    { publicKey: 'c', full: false, added: null },
  ],
  previous: null,
  verdict,
  ...extra,
});
const changed = (pattern: 'handover' | 'swap' | 'overlap', oldRemoved: number) =>
  ({ kind: 'changed', at: { time: 100 }, daysAgo: 1, recent: false, previousKeys: 4, oldRemoved: { time: oldRemoved }, pattern, keylessDays: pattern === 'handover' ? 2 : 0 }) as Verdict;

describe('register', () => {
  it('puts a keyless stretch before the era line for a handover', () => {
    const r = register(report(changed('handover', 40), { previous: [{ publicKey: 'p', added: 10, removed: 40 }] }));
    expect(r.map((e) => e.kind)).toEqual(['earlier', 'keyless', 'era', 'current']);
    expect(r[0]).toEqual({ kind: 'earlier', from: 10, to: 40, keys: 4 });
    expect(r[1]).toEqual({ kind: 'keyless', from: 40, to: 100, days: 2 });
    expect(r[3]).toEqual({ kind: 'current', from: 100, keys: 2 });
  });

  it('ends earlier keys at the switch for a swap', () => {
    const r = register(report(changed('swap', 100)));
    expect(r.map((e) => e.kind)).toEqual(['earlier', 'era', 'current']);
    expect(r[0]).toEqual({ kind: 'earlier', from: null, to: 100, keys: 4 });
  });

  it('notes how long old keys were kept for an overlap', () => {
    const r = register(report(changed('overlap', 300)));
    expect(r[0]).toEqual({ kind: 'earlier', from: null, to: 300, keys: 4 });
    expect(r[2]).toEqual({ kind: 'current', from: 100, keys: 2, oldKeptUntil: 300 });
  });

  it('has no era line when control never changed', () => {
    const r = register(report({ kind: 'unchanged', since: { time: 5 }, fromCreation: true }));
    expect(r).toEqual([{ kind: 'current', from: 5, keys: 2, fromCreation: true }]);
  });

  it('describes locked and missing accounts', () => {
    expect(register(report({ kind: 'locked', contract: true }))).toEqual([{ kind: 'locked', contract: true }]);
    expect(register(report({ kind: 'missing' }))).toEqual([]);
  });
});
