import { describe, expect, it } from 'vitest';
import { check, DAY, patternOf, type Chain, type Key, type KeyLife } from './epoch';

// A fake account whose key history is a list of events. One block per second from T0, so a height
// is easy to turn into a date.
const T0 = Date.UTC(2021, 0, 1);
const H0 = 30_000_000;
const time = (h: number) => T0 + (h - H0) * 1000;
const heightAt = (iso: string) => H0 + Math.round((Date.parse(iso) - T0) / 1000);
type Event = { at: string; add?: { key: string; full?: boolean; undated?: boolean }[]; remove?: string[] };

function fakeChain(created: string | null, events: Event[], opts: { indexer?: boolean; contract?: boolean; now?: string; drift?: number } = {}) {
  const head = heightAt(opts.now ?? '2026-11-09');
  const createdAt = created ? heightAt(created) : null;
  const keysAt = (h: number): Key[] => {
    const live = new Map<string, Key>();
    for (const e of events) {
      const eh = heightAt(e.at);
      if (eh > h) continue;
      for (const a of e.add ?? []) live.set(a.key, { publicKey: a.key, full: a.full ?? true, nonce: a.undated ? 5_000_007n : BigInt(eh) * 1_000_000n });
      for (const r of e.remove ?? []) live.delete(r);
    }
    return [...live.values()];
  };
  const exists = (h: number) => createdAt !== null && h >= createdAt;
  let calls = 0;
  const chain: Chain & { calls: () => number } = {
    calls: () => calls,
    head: async () => head,
    exists: async (_a, h = head) => (calls++, exists(h)),
    keys: async (_a, h = head) => (calls++, exists(h) ? keysAt(h) : []),
    hasContract: async () => !!opts.contract,
    time: async (h) => (calls++, time(h) + (opts.drift ?? 0)),
  };
  if (opts.indexer) {
    chain.history = async () => {
      const life: KeyLife[] = [];
      for (const e of events) {
        for (const a of e.add ?? []) life.push({ publicKey: a.key, full: a.full ?? true, added: Date.parse(e.at), removed: null });
        for (const r of e.remove ?? []) {
          const k = life.find((x) => x.publicKey === r && x.removed === null);
          if (k) k.removed = Date.parse(e.at);
        }
      }
      return life;
    };
  }
  return chain;
}
const NOW = Date.parse('2026-11-09');

describe('check', () => {
  it('says an account that does not exist is missing', async () => {
    const r = await check('nobody.near', fakeChain(null, []), NOW);
    expect(r.verdict.kind).toBe('missing');
  });

  it('calls an account with no full-access key locked', async () => {
    const r = await check('c.near', fakeChain('2021-02-01', [{ at: '2021-02-01', add: [{ key: 'fc', full: false }] }], { contract: true }), NOW);
    expect(r.verdict).toEqual({ kind: 'locked', contract: true });
  });

  it('treats a full-access key from before dated nonces as continuity', async () => {
    const r = await check('old.near', fakeChain('2021-01-02', [{ at: '2021-01-02', add: [{ key: 'a', undated: true }] }, { at: '2024-01-01', add: [{ key: 'b' }] }]), NOW);
    expect(r.verdict).toEqual({ kind: 'unchanged', since: null, fromCreation: false });
  });

  it('keeps the original keys as unchanged since creation', async () => {
    const r = await check('new.near', fakeChain('2023-03-03', [{ at: '2023-03-03', add: [{ key: 'a' }] }]), NOW);
    expect(r.verdict.kind).toBe('unchanged');
    if (r.verdict.kind === 'unchanged') expect(r.verdict.fromCreation).toBe(true);
  });

  it('is not fooled by an added key while an original one remains', async () => {
    const chain = fakeChain('2022-01-01', [{ at: '2022-01-01', add: [{ key: 'a' }] }, { at: '2026-11-01', add: [{ key: 'b' }] }], { indexer: true });
    const r = await check('x.near', chain, NOW);
    expect(r.verdict.kind).toBe('unchanged');
  });

  const sale: Event[] = [
    { at: '2021-06-01', add: [{ key: 'seller1' }, { key: 'seller2' }] },
    { at: '2022-11-02', remove: ['seller1', 'seller2'], add: [{ key: 'locker', full: false }] },
    { at: '2023-07-04', remove: ['locker'], add: [{ key: 'buyer' }] },
    // The new owner's own short-lived key is not a previous owner's key.
    { at: '2023-08-01', add: [{ key: 'temp' }] },
    { at: '2023-08-02', remove: ['temp'] },
  ];

  for (const indexer of [true, false]) {
    const via = indexer ? 'from the indexer' : 'from archival state alone';

    it(`finds a sale through a contract (handover with a keyless gap) ${via}`, async () => {
      const r = await check('sold.near', fakeChain('2021-06-01', sale, { indexer }), NOW);
      expect(r.verdict.kind).toBe('changed');
      if (r.verdict.kind !== 'changed') return;
      expect(r.verdict.pattern).toBe('handover');
      expect(r.verdict.at.time).toBe(Date.parse('2023-07-04'));
      expect(r.verdict.oldRemoved.time).toBe(Date.parse('2022-11-02'));
      expect(r.verdict.keylessDays).toBe(244);
      expect(r.verdict.previousKeys).toBe(2);
      expect(r.verdict.recent).toBe(false);
    });

    it(`finds a keyless gap that reaches back to creation ${via}`, async () => {
      const events: Event[] = [
        { at: '2021-03-01', add: [{ key: 'first' }] },
        { at: '2021-03-25', remove: ['first'] },
        { at: '2023-07-04', add: [{ key: 'buyer' }] },
      ];
      const r = await check('covid.near', fakeChain('2021-03-01', events, { indexer }), NOW);
      expect(r.verdict.kind === 'changed' && r.verdict.pattern).toBe('handover');
      if (r.verdict.kind === 'changed') expect(r.verdict.keylessDays).toBe(831);
    });

    it(`tells a swap from an overlap ${via}`, async () => {
      const swap = await check('s.near', fakeChain('2021-06-01', [
        { at: '2021-06-01', add: [{ key: 'a' }] },
        { at: '2026-11-01', add: [{ key: 'b' }], remove: ['a'] },
      ], { indexer }), NOW);
      expect(swap.verdict.kind === 'changed' && swap.verdict.pattern).toBe('swap');
      if (swap.verdict.kind === 'changed') expect(swap.verdict.recent).toBe(true);

      const overlap = await check('o.near', fakeChain('2021-06-01', [
        { at: '2021-06-01', add: [{ key: 'a' }] },
        { at: '2023-01-01', add: [{ key: 'b' }] },
        { at: '2023-03-01', remove: ['a'] },
      ], { indexer }), NOW);
      expect(overlap.verdict.kind === 'changed' && overlap.verdict.pattern).toBe('overlap');
      if (overlap.verdict.kind === 'changed') expect(overlap.verdict.oldRemoved.time).toBe(Date.parse('2023-03-01'));
    });
  }

  it('calls an account that got its first full-access key late unchanged', async () => {
    const chain = fakeChain('2021-06-01', [{ at: '2021-06-01', add: [{ key: 'fc', full: false }] }, { at: '2024-05-05', add: [{ key: 'a' }] }], { indexer: true });
    const r = await check('factory-made.near', chain, NOW);
    expect(r.verdict.kind).toBe('unchanged');
  });

  it('uses the indexer’s exact time when block dates are an hour off', async () => {
    const events: Event[] = [{ at: '2021-06-01', add: [{ key: 'a' }] }, { at: '2025-07-12', add: [{ key: 'b' }], remove: ['a'] }];
    const r = await check('g.near', fakeChain('2021-06-01', events, { indexer: true, drift: 66 * 60_000 }), NOW);
    expect(r.verdict.kind === 'changed' && r.verdict.pattern).toBe('swap');
    if (r.verdict.kind === 'changed') expect(r.verdict.at.time).toBe(Date.parse('2025-07-12'));
  });

  it('lists the previous keys when the indexer has them', async () => {
    const r = await check('sold.near', fakeChain('2021-06-01', sale, { indexer: true }), NOW);
    expect(r.previous?.map((k) => k.publicKey)).toEqual(['seller1', 'seller2']);
  });

  it('dates every current key without one block call each', async () => {
    const many: Event[] = [{ at: '2021-06-01', add: [{ key: 'a' }] }, { at: '2024-01-01', remove: ['a'] }];
    for (let i = 0; i < 40; i++) many.push({ at: `2024-01-01T00:${String(i).padStart(2, '0')}:00Z`, add: [{ key: `k${i}` }] });
    const chain = fakeChain('2021-06-01', many, { indexer: true });
    const r = await check('busy.near', chain, NOW);
    expect(r.keys).toHaveLength(40);
    expect(chain.calls()).toBeLessThan(10);
    const k10 = r.keys.find((k) => k.publicKey === 'k10')!;
    expect(Math.abs(k10.added!.time - Date.parse('2024-01-01T00:10:00Z'))).toBeLessThan(DAY);
  });
});

describe('patternOf', () => {
  it('allows ten minutes either side for one swap', () => {
    expect(patternOf(1_000_000_000, 1_000_000_000 - 9 * 60_000)).toBe('swap');
    expect(patternOf(1_000_000_000, 1_000_000_000 - 11 * 60_000)).toBe('handover');
    expect(patternOf(1_000_000_000, 1_000_000_000 + 11 * 60_000)).toBe('overlap');
  });
});
