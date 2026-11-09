// Builds the labelled set from public mainnet history, caching every response so it can be resumed and re-run.
//   SOLD:   accounts bought through near.bet's on-chain marketplace (acquire succeeded), so control certainly changed.
//   STAYED: long-running projects and public figures whose identity carried on publicly, so control very likely did not.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const API = 'https://api.nearblocks.io/v1';
const ROOT = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const CACHE = path.join(ROOT, '..', 'data', 'cache');
fs.mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
async function get(p) {
  const file = path.join(CACHE, createHash('sha1').update(p).digest('hex') + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let wait = 2000; ; wait = Math.min(wait * 2, 900000)) {
    await sleep(1600);
    try {
      const r = await fetch(API + p, { headers: { accept: 'application/json' } });
      if (r.ok) {
        const j = await r.json();
        fs.writeFileSync(file, JSON.stringify(j));
        if (++calls % 25 === 0) console.log(`calls ${calls}`);
        return j;
      }
      if (r.status !== 429 && r.status < 500) return null;
      console.log(`  ${r.status} on ${p.slice(0, 60)}, waiting ${wait / 1000}s`);
    } catch (e) {
      console.log(`  network: ${e.message}, waiting ${wait / 1000}s`);
    }
    await sleep(wait);
  }
}

const STAYED = ['aurora', 'near', 'wrap.near', 'v2.ref-finance.near', 'ref-finance.near', 'token.v2.ref-finance.near', 'linear-protocol.near', 'meta-pool.near', 'meta-token.near', 'x.paras.near', 'paras.near', 'mintbase1.near', 'mintbase.near', 'sputnik-dao.near', 'social.near', 'contract.main.burrow.near', 'burrow.near', 'token.burrow.near', 'token.sweat', 'sweat.near', 'hot.tg', 'game.hot.tg', 'intents.near', 'v1.signer', 'tkn.near', 'app.nearcrowd.near', 'nearcrowd.near', 'octopus-registry.near', 'nearx.stader-labs.near', 'stader-labs.near', 'asset-manager.orderly-network.near', 'orderly-network.near', 'pulse.near', 'nearweek.near', 'near-foundation.near', 'nf-finance.near', 'foundation.near', 'pagoda.near', 'nearpay.near', 'flux-dao.near', 'skyward.near', 'token.skyward.near', 'berryclub.ek.near', 'farm.berryclub.ek.near', 'tenk.near', 'nearnames.near', 'ilblackdragon.near', 'root.near', 'illia.near', 'erik.near', 'mike.near', 'vgrichina.near', 'cameron.near', 'chadoh.near', 'evgenykuzyakov.near', 'kendall.near', 'pinkpanda.near', 'zavodil.near', 'calimero.near', 'proximity.near', 'lockup.near', 'nearkat.near', 'nearlend.near', 'bridge.near', 'factory.bridge.near', 'client.bridge.near', 'nearnauts.near', 'rainbowbridge.near', 'staking-farm.near', 'astro-stakers.poolv1.near', 'zavodil.poolv1.near', 'figment.poolv1.near', 'epic.poolv1.near', 'binancenode1.poolv1.near', 'blockdaemon.poolv1.near', 'kiln.poolv1.near', 'allnodes.poolv1.near', 'staked.poolv1.near', 'p2p-org.poolv1.near', 'dokiacapital.poolv1.near'];

// 1. Every successful sale on the marketplace.
const total = Number((await get('/account/c.nearbet.near/txns-only/count'))?.txns?.[0]?.count ?? 0);
console.log('marketplace transactions', total);
const sales = [];
const seen = new Set();
for (let cursor = ''; ;) {
  const j = await get(`/account/c.nearbet.near/txns-only?per_page=25&order=asc${cursor ? `&cursor=${cursor}` : ''}`);
  if (!j?.txns?.length) break;
  for (const t of j.txns) {
    seen.add(t.transaction_hash);
    const a = t.actions?.find((x) => x.method === 'acquire');
    if (!a || !t.outcomes?.status) continue;
    let args = {};
    try { args = typeof a.args === 'string' ? JSON.parse(a.args) : a.args ?? {}; } catch {}
    if (args.bid_id) sales.push({ account: args.bid_id, buyer: t.signer_account_id, buyerKey: args.new_public_key, at: Number(t.block_timestamp), tx: t.transaction_hash });
  }
  if (!j.cursor || j.cursor === cursor) break;
  cursor = j.cursor;
}
console.log('transactions read', seen.size, 'of', total);
console.log('sales found', sales.length, 'unique', new Set(sales.map((s) => s.account)).size);
if (seen.size < total * 0.95 || !sales.length) throw new Error('marketplace history is incomplete, refusing to build on it');
fs.writeFileSync(path.join(ROOT, '..', 'data', 'sales.json'), JSON.stringify(sales, null, 1));

// 2. Key history and activity around each change.
const ymd = (ns) => new Date(ns / 1e6).toISOString().slice(0, 10);
const history = {};
const lastCut = (keys) => {
  const full = keys.filter((k) => k.permission_kind === 'FULL_ACCESS');
  return full.map((k) => k.deleted?.block_timestamp).filter(Boolean).sort((a, b) => b - a)[0];
};
// Stayed first: it is the missing half of the test, and the free plan allows about 330 calls a day.
for (const [label, names] of [['stayed', STAYED], ['sold', [...new Set(sales.map((s) => s.account))]]]) {
  for (const account of names) {
    const found = new Map();
    let cursor = '';
    for (let round = 0; round < 8; round++) {
      const j = await get(`/account/${account}/keys?per_page=50${cursor ? `&cursor=${cursor}` : ''}`);
      for (const k of j?.keys ?? []) found.set(`${k.public_key}|${k.created?.block_timestamp}`, k);
      if (!j?.cursor || j.cursor === cursor || (j?.keys?.length ?? 0) < 50) break;
      cursor = j.cursor;
    }
    const keys = [...found.values()];
    if (!keys.length) { history[account] = { label, keys: [] }; continue; }
    const saleAt = sales.find((s) => s.account === account)?.at;
    // An account that never removed a full-access key has no change to examine, so it spends no further calls.
    const pivot = saleAt ?? lastCut(keys);
    let before = [];
    let after = [];
    if (pivot) {
      before = (await get(`/account/${account}/txns-only?per_page=50&order=desc&before_date=${ymd(pivot)}`))?.txns ?? [];
      after = (await get(`/account/${account}/txns-only?per_page=50&order=asc&after_date=${ymd(pivot)}`))?.txns ?? [];
    }
    const slim = (t) => ({ at: Number(t.block_timestamp), from: t.signer_account_id, to: t.receiver_account_id, ok: t.outcomes?.status, action: t.actions?.[0]?.action, method: t.actions?.[0]?.method });
    history[account] = { label, saleAt, keys, before: before.map(slim), after: after.map(slim) };
    fs.writeFileSync(path.join(ROOT, '..', 'data', 'history.json'), JSON.stringify(history));
  }
  console.log(label, 'done');
}
console.log('finished, calls', calls);
