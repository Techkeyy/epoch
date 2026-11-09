// Epoch's whole judgement: when did the keys that control this account today arrive, and what happened to
// the keys before them. Everything comes from public chain state, read through the Chain interface.

export type Key = { publicKey: string; full: boolean; nonce: bigint };
/** A key's life from an indexer. Times are milliseconds since 1970; removed is null while the key exists. */
export type KeyLife = { publicKey: string; full: boolean; added: number | null; removed: number | null };

export interface Chain {
  head(): Promise<number>;
  /** Whether the account exists at a height, or at the latest final block. */
  exists(account: string, height?: number): Promise<boolean>;
  /** Keys at a height, or at the latest final block (empty when the account does not exist). */
  keys(account: string, height?: number): Promise<Key[]>;
  /** Whether the account has contract code deployed now. */
  hasContract(account: string): Promise<boolean>;
  /** Milliseconds since 1970 for a block height (the next existing block if that height was skipped). */
  time(height: number): Promise<number>;
  /** Every key the account ever had, from an indexer. Null when the indexer cannot answer. */
  history?(account: string): Promise<KeyLife[] | null>;
}

// A key's nonce starts at (height when it was added) x 1e6. Keys added before that rule have small nonces.
// Mainnet genesis is 9,820,210, so a smaller quotient means the key carries no date.
const NONCE_STEP = 1_000_000n;
const GENESIS = 9_820_210;
export const addedAt = (k: Key): number | null => {
  const h = Number(k.nonce / NONCE_STEP);
  return h >= GENESIS ? h : null;
};

export const DAY = 86_400_000;
export const RECENT_DAYS = 30;
/** Old keys removed within this long of the new ones arriving count as one swap. */
const SAME_MOMENT = 10 * 60_000;

export type Moment = { height?: number; time: number };
export type Pattern = 'overlap' | 'swap' | 'handover';
export type Verdict =
  | { kind: 'missing' }
  | { kind: 'locked'; contract: boolean }
  | { kind: 'unchanged'; since: Moment | null; fromCreation: boolean }
  | {
      kind: 'changed';
      at: Moment;
      daysAgo: number;
      recent: boolean;
      previousKeys: number;
      /** When the last of the previous full-access keys was removed. */
      oldRemoved: Moment;
      /** How the switch happened: old keys kept for a while, removed at the same moment, or removed first. */
      pattern: Pattern;
      /** Days with no full-access key before the current ones arrived (the account was held by a contract). */
      keylessDays: number;
    };

export type Report = {
  account: string;
  checkedAt: number;
  head: number;
  keys: { publicKey: string; full: boolean; added: Moment | null }[];
  /** Full-access keys that are gone, oldest first, when an indexer could list them. */
  previous: { publicKey: string; added: number | null; removed: number }[] | null;
  verdict: Verdict;
};

const fullKeys = (ks: Key[]) => ks.filter((k) => k.full);

/** Last height in [lo, hi] where test is true, given test(lo) is true and the answer is a single switch.
 *  Gallops out from lo first, because the switch is usually close to it. */
async function lastTrue(lo: number, hi: number, test: (h: number) => Promise<boolean>): Promise<number> {
  for (let step = 1; lo + step <= hi; step *= 4) {
    if (!(await test(lo + step))) {
      hi = lo + step - 1;
      break;
    }
    lo += step;
  }
  while (lo < hi) {
    const mid = lo + Math.ceil((hi - lo) / 2);
    if (await test(mid)) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export const patternOf = (at: number, oldRemoved: number): Pattern =>
  oldRemoved < at - SAME_MOMENT ? 'handover' : oldRemoved > at + SAME_MOMENT ? 'overlap' : 'swap';

/** Without an indexer: walk archival state to find the previous key set and when it went. Slow on free RPC. */
async function previousFromState(account: string, chain: Chain, start: number, head: number) {
  const hasFull = async (h: number) => fullKeys(await chain.keys(account, h)).length > 0;
  let previous = fullKeys(await chain.keys(account, start - 1));
  let lastWithOld = start - 1;
  if (!previous.length) {
    // A sale through a contract leaves a stretch with no full-access key: step back until one appears.
    let hi = start - 1;
    let lo = hi;
    for (let step = 1_000; ; step *= 4) {
      lo = Math.max(GENESIS, hi - step);
      if (!(await chain.exists(account, lo))) {
        // The keyless stretch reaches back past the account's creation: start from the creation block.
        lo = (await lastTrue(lo, hi, async (h) => !(await chain.exists(account, h)))) + 1;
        break;
      }
      if ((await hasFull(lo)) || lo === GENESIS) break;
      hi = lo;
    }
    if (!(await hasFull(lo))) return null;
    lastWithOld = await lastTrue(lo, hi, hasFull);
    previous = fullKeys(await chain.keys(account, lastWithOld));
  } else {
    const old = new Set(previous.map((k) => k.publicKey));
    lastWithOld = await lastTrue(start - 1, head, async (h) => fullKeys(await chain.keys(account, h)).some((k) => old.has(k.publicKey)));
  }
  return { count: previous.length, removed: { height: lastWithOld + 1, time: await chain.time(lastWithOld + 1) } };
}

export async function check(account: string, chain: Chain, now = Date.now()): Promise<Report> {
  const moment = async (height: number): Promise<Moment> => ({ height, time: await chain.time(height) });
  const base = { account, checkedAt: now, head: 0, previous: null };
  if (!(await chain.exists(account))) return { ...base, keys: [], verdict: { kind: 'missing' } };

  const raw = (await chain.keys(account)).map((k) => ({ publicKey: k.publicKey, full: k.full, height: addedAt(k) }));
  const full = raw.filter((k) => k.full);
  const dated = full.every((k) => k.height) && full.length > 0;
  const start = dated ? Math.min(...full.map((k) => k.height!)) : 0;
  const at = dated ? await moment(start) : null;
  // Only the key that marks the switch gets an exact time; one block call per key would exhaust a free
  // RPC on accounts with dozens of keys. The rest are placed by block rate between that key and now.
  const head = await chain.head();
  const perBlock = at && head > start ? (now - at.time) / (head - start) : 1000;
  const keys = raw.map((k) => ({
    publicKey: k.publicKey,
    full: k.full,
    added: !k.height ? null : at && k.height === start ? at : at ? { height: k.height, time: Math.round(at.time + (k.height - start) * perBlock) } : null,
  }));
  if (!full.length) return { ...base, head, keys, verdict: { kind: 'locked', contract: await chain.hasContract(account) } };

  // One full-access key from before dated nonces means control has not fully changed since then.
  if (!dated || !at) return { ...base, head, keys, verdict: { kind: 'unchanged', since: null, fromCreation: false } };
  const unchanged = { ...base, head, keys, verdict: { kind: 'unchanged' as const, since: at, fromCreation: true } };
  // Previous full-access keys: added before the current ones arrived, and gone now. Without an indexer,
  // an account that did not exist just before its oldest key was created with these keys.
  const life = (await chain.history?.(account)) ?? null;
  if (!life && !(await chain.exists(account, start - 1))) return unchanged;
  // Block dates are estimates; the indexer's record of when the switch key was added is exact.
  const startKey = full.find((k) => k.height === start)!;
  const exact = life?.find((k) => k.publicKey === startKey.publicKey && k.removed === null)?.added;
  if (exact) at.time = exact;
  for (const k of keys) {
    const t = life?.find((l) => l.publicKey === k.publicKey && l.removed === null)?.added;
    if (t && k.added && k.added !== at) k.added = { ...k.added, time: t };
  }
  const gone = life
    ?.filter((k) => k.full && k.removed !== null && (k.added ?? 0) < at.time - 1000)
    .map((k) => ({ publicKey: k.publicKey, added: k.added, removed: k.removed! }))
    .sort((a, b) => (a.added ?? 0) - (b.added ?? 0));
  let previousKeys: number;
  let oldRemoved: Moment;
  if (gone) {
    // The indexer saw no earlier full-access key, so the account got its first one with the current set.
    if (!gone.length) return unchanged;
    previousKeys = gone.length;
    oldRemoved = { time: Math.max(...gone.map((k) => k.removed)) };
  } else {
    const found = await previousFromState(account, chain, start, head);
    if (!found) return unchanged;
    previousKeys = found.count;
    oldRemoved = found.removed;
  }
  const pattern = patternOf(at.time, oldRemoved.time);
  const daysAgo = Math.floor((now - at.time) / DAY);
  return {
    ...base,
    head,
    keys,
    previous: gone ?? null,
    verdict: {
      kind: 'changed',
      at,
      daysAgo,
      recent: daysAgo < RECENT_DAYS,
      previousKeys,
      oldRemoved,
      pattern,
      keylessDays: pattern === 'handover' ? Math.round((at.time - oldRemoved.time) / DAY) : 0,
    },
  };
}
