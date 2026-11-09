// Reads NEAR mainnet through a free archival RPC. Past state never changes, so answers about a past
// height are cached for good; answers about "now" only for a short while.
import type { Chain, Key, KeyLife } from './epoch';
import anchors from './blocktimes.json' with { type: 'json' };
import { timeOf as interpolate } from './blocktime.ts';

// Dating a block from a table of known block times costs no call. Past the table's end, the current
// head (seen on every answer about the present) and the clock are the last anchor.
const timeOf = (height: number, head: number, now: number) => interpolate(anchors as [number, number][], height, head, now);

// Free providers only, each with its own limit. Questions about the present go to regular nodes; only
// questions about the past need archival ones, which allow short bursts and then about one call in three seconds.
const ARCHIVAL = (process.env.EPOCH_ARCHIVAL_RPC ?? 'https://archival-rpc.mainnet.fastnear.com,https://archival-rpc.mainnet.near.org').split(',');
const CURRENT = (process.env.EPOCH_RPC ?? 'https://rpc.mainnet.fastnear.com,https://free.rpc.fastnear.com,https://rpc.mainnet.near.org').split(',');
const INDEXER = 'https://api.nearblocks.io/v1';
// NearBlocks' free plan allows about 330 calls a day. Keep some back, then fall back to archival state.
const INDEXER_DAILY = Number(process.env.EPOCH_INDEXER_DAILY ?? 280);
const HISTORY_TTL = 60 * 60_000;
const PER_PAGE = 50;
const MAX_PAGES = 20;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type RpcError = { name?: string; cause?: { name?: string } };

// Each provider rests after refusing us, so the next call goes to whichever is free soonest.
const restUntil = new Map<string, number>();
let lastHead = 0;

async function call<T>(method: string, params: Record<string, unknown> | []): Promise<{ result?: T; error?: RpcError }> {
  const pool = method === 'block' || 'block_id' in params ? ARCHIVAL : CURRENT;
  for (let attempt = 0; attempt < 8; attempt++) {
    const url = pool.reduce((best, u) => ((restUntil.get(u) ?? 0) < (restUntil.get(best) ?? 0) ? u : best));
    const wait = (restUntil.get(url) ?? 0) - Date.now();
    if (wait > 0) await sleep(wait);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'epoch', method, params }),
        signal: AbortSignal.timeout(8_000),
      });
      if (r.ok) {
        const j = (await r.json()) as { result?: T & { block_height?: number }; error?: RpcError };
        if (!j.error || !/TIMEOUT|INTERNAL/i.test(j.error.cause?.name ?? j.error.name ?? '')) {
          if (j.result?.block_height && j.result.block_height > lastHead) lastHead = j.result.block_height;
          return j;
        }
      }
      restUntil.set(url, Date.now() + (r.status === 429 ? 3_500 : 1_000));
    } catch {
      restUntil.set(url, Date.now() + 2_000);
    }
  }
  throw new Error(`NEAR RPC is not answering (${method})`);
}

type IndexedKey = { public_key: string; permission_kind: string; created?: { block_timestamp?: number | string | null }; deleted?: { block_timestamp?: number | string | null } };
const recent = new Map<string, { at: number; value: KeyLife[] }>();
const budget = { day: '', used: 0 };

const past = new Map<string, unknown>();
const MAX_PAST = 50_000;
const remember = <T>(key: string, value: T): T => {
  if (past.size > MAX_PAST) past.delete(past.keys().next().value!);
  past.set(key, value);
  return value;
};

type KeyView = { keys: { public_key: string; access_key: { nonce: number | string; permission: unknown } }[] };
const toKeys = (v: KeyView): Key[] =>
  v.keys.map((k) => ({ publicKey: k.public_key, full: k.access_key.permission === 'FullAccess', nonce: BigInt(k.access_key.nonce) }));
const missing = (e?: RpcError) => /UNKNOWN_ACCOUNT/.test(e?.cause?.name ?? '');
const skipped = (e?: RpcError) => /UNKNOWN_BLOCK|GARBAGE_COLLECTED/.test(e?.cause?.name ?? e?.name ?? '');

export const mainnet: Chain = {
  async head() {
    if (lastHead) return lastHead;
    const { result } = await call<{ sync_info: { latest_block_height: number } }>('status', []);
    if (!result) throw new Error('NEAR RPC gave no status');
    return result.sync_info.latest_block_height;
  },

  async exists(account, height) {
    const cacheKey = `a:${account}:${height}`;
    if (height !== undefined && past.has(cacheKey)) return past.get(cacheKey) as boolean;
    for (let h = height; ; h = (h as number) + 1) {
      const at = h === undefined ? { finality: 'final' } : { block_id: h };
      const { result, error } = await call<object>('query', { request_type: 'view_account', account_id: account, ...at });
      if (result || missing(error)) return height === undefined ? !!result : remember(cacheKey, !!result);
      if (h === undefined || !skipped(error) || h - height! > 50) throw new Error(`Could not read account ${account}`);
    }
  },

  async keys(account, height) {
    const cacheKey = `k:${account}:${height}`;
    if (height !== undefined && past.has(cacheKey)) return past.get(cacheKey) as Key[];
    // Missing heights are skipped blocks: the state is the same at the next block that exists.
    for (let h = height; ; h = (h as number) + 1) {
      const at = h === undefined ? { finality: 'final' } : { block_id: h };
      const { result, error } = await call<KeyView>('query', { request_type: 'view_access_key_list', account_id: account, ...at });
      if (result) return height === undefined ? toKeys(result) : remember(cacheKey, toKeys(result));
      if (missing(error)) return height === undefined ? [] : remember(cacheKey, []);
      // Archival nodes will not list more than 100 keys; only the indexer can answer for such an account.
      if (/TOO_MANY_ACCESS_KEYS/.test(error?.cause?.name ?? '')) throw new Error(`${account} had too many keys to read from archival state`);
      if (h === undefined || !skipped(error) || h - height! > 50) throw new Error(`Could not read keys of ${account}`);
    }
  },

  async hasContract(account) {
    const { result } = await call<{ code_hash: string }>('query', { request_type: 'view_account', account_id: account, finality: 'final' });
    return !!result && result.code_hash !== '11111111111111111111111111111111';
  },

  async time(height) {
    return timeOf(height, lastHead || (await this.head()), Date.now());
  },

  async history(account) {
    const hit = recent.get(account);
    if (hit && Date.now() - hit.at < HISTORY_TTL) return hit.value;
    const today = new Date().toISOString().slice(0, 10);
    if (budget.day !== today) Object.assign(budget, { day: today, used: 0 });
    const headers: Record<string, string> = { accept: 'application/json' };
    if (process.env.NEARBLOCKS_API_KEY) headers.authorization = `Bearer ${process.env.NEARBLOCKS_API_KEY}`;
    const base = `${INDEXER}/account/${encodeURIComponent(account)}/keys`;
    // The free plan allows a burst of about six calls, then wants up to a minute of rest.
    const ask = async <T>(url: string): Promise<T | null> => {
      for (const wait of [3_000, 6_000, 12_000, 24_000, 30_000, 30_000, 30_000]) {
        if (budget.used >= INDEXER_DAILY) return null;
        budget.used++;
        try {
          const r = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
          if (r.ok) return (await r.json()) as T;
          if (r.status !== 429) return null;
        } catch {
          return null;
        }
        await sleep(wait);
      }
      return null;
    };
    // This endpoint pages by number, 50 at most, and an incomplete list would hide earlier keys, so read the
    // count first and every page after it. Accounts with very long histories use archival state instead.
    const counted = await ask<{ keys?: { count?: string }[] }>(`${base}/count`);
    const total = Number(counted?.keys?.[0]?.count);
    if (!Number.isFinite(total)) return null;
    const pages = Math.ceil(total / PER_PAGE);
    if (pages > MAX_PAGES) throw new Error(`${account} had too many keys to read (${total.toLocaleString('en-US')} in its history)`);
    const found = new Map<string, KeyLife>();
    const ms = (t?: { block_timestamp?: number | string | null }) => (t?.block_timestamp ? Math.round(Number(t.block_timestamp) / 1e6) : null);
    for (let page = 1; page <= pages; page++) {
      if (page > 1) await sleep(1_000);
      const j = await ask<{ keys?: IndexedKey[] }>(`${base}?per_page=${PER_PAGE}&page=${page}`);
      if (!j) return null;
      for (const k of j.keys ?? []) found.set(`${k.public_key}|${ms(k.created)}`, { publicKey: k.public_key, full: k.permission_kind === 'FULL_ACCESS', added: ms(k.created), removed: ms(k.deleted) });
    }
    if (found.size < total) return null;
    const value = [...found.values()];
    recent.set(account, { at: Date.now(), value });
    if (recent.size > 5_000) recent.delete(recent.keys().next().value!);
    return value;
  },
};
