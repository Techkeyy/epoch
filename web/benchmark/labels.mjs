// Rebuilds labels.json from mainnet: node benchmark/labels.mjs
//   Sold:   every account bought on near.bet's marketplace (a successful acquire() on c.nearbet.near), with
//           the date of its latest sale.
//   Stayed: long-running projects and public figures whose identity carried on in public. This list is a
//           judgement, not chain data, and assuming they kept control is exactly that: an assumption.
// NearBlocks answers are cached in benchmark/cache/nearblocks so a rerun does not spend the free allowance.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const API = 'https://api.nearblocks.io/v1';
const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
const CACHE = path.join(DIR, 'cache', 'nearblocks');
fs.mkdirSync(CACHE, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function get(p) {
  const file = path.join(CACHE, createHash('sha1').update(p).digest('hex') + '.json');
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let wait = 3000; ; wait = Math.min(wait * 2, 60000)) {
    await sleep(1600);
    const r = await fetch(API + p, { headers: { accept: 'application/json' } }).catch(() => null);
    if (r?.ok) {
      const j = await r.json();
      fs.writeFileSync(file, JSON.stringify(j));
      return j;
    }
    if (r && r.status !== 429 && r.status < 500) throw new Error(`${r.status} on ${p}`);
    console.log(`  waiting ${wait / 1000}s for NearBlocks`);
    await sleep(wait);
  }
}

const STAYED = ['aurora', 'near', 'wrap.near', 'v2.ref-finance.near', 'ref-finance.near', 'token.v2.ref-finance.near', 'linear-protocol.near', 'meta-pool.near', 'meta-token.near', 'x.paras.near', 'paras.near', 'mintbase1.near', 'mintbase.near', 'sputnik-dao.near', 'social.near', 'contract.main.burrow.near', 'burrow.near', 'token.burrow.near', 'token.sweat', 'sweat.near', 'hot.tg', 'game.hot.tg', 'intents.near', 'v1.signer', 'tkn.near', 'app.nearcrowd.near', 'nearcrowd.near', 'octopus-registry.near', 'nearx.stader-labs.near', 'stader-labs.near', 'asset-manager.orderly-network.near', 'orderly-network.near', 'pulse.near', 'nearweek.near', 'near-foundation.near', 'nf-finance.near', 'foundation.near', 'pagoda.near', 'nearpay.near', 'flux-dao.near', 'skyward.near', 'token.skyward.near', 'berryclub.ek.near', 'farm.berryclub.ek.near', 'tenk.near', 'nearnames.near', 'ilblackdragon.near', 'root.near', 'illia.near', 'erik.near', 'mike.near', 'vgrichina.near', 'cameron.near', 'chadoh.near', 'evgenykuzyakov.near', 'kendall.near', 'pinkpanda.near', 'zavodil.near', 'calimero.near', 'proximity.near', 'lockup.near', 'nearkat.near', 'nearlend.near', 'bridge.near', 'factory.bridge.near', 'client.bridge.near', 'nearnauts.near', 'rainbowbridge.near', 'staking-farm.near', 'astro-stakers.poolv1.near', 'zavodil.poolv1.near', 'figment.poolv1.near', 'epic.poolv1.near', 'binancenode1.poolv1.near', 'blockdaemon.poolv1.near', 'kiln.poolv1.near', 'allnodes.poolv1.near', 'staked.poolv1.near', 'p2p-org.poolv1.near', 'dokiacapital.poolv1.near'];

// NearBlocks pages this list with a cursor; the page number is ignored.
const total = Number((await get('/account/c.nearbet.near/txns-only/count'))?.txns?.[0]?.count ?? 0);
const latest = new Map();
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
    if (!args.bid_id) continue;
    const at = Number(t.block_timestamp);
    if (!latest.has(args.bid_id) || latest.get(args.bid_id).at < at) latest.set(args.bid_id, { at, tx: t.transaction_hash });
  }
  if (!j.cursor || j.cursor === cursor) break;
  cursor = j.cursor;
}
if (seen.size < total * 0.95) throw new Error(`read ${seen.size} of ${total} marketplace transactions, refusing to write a partial set`);
const sold = [...latest].map(([account, s]) => ({ account, soldAt: new Date(s.at / 1e6).toISOString(), tx: s.tx }));
fs.writeFileSync(
  path.join(DIR, 'labels.json'),
  JSON.stringify({ source: 'Sold: every successful acquire() on c.nearbet.near (near.bet), read from mainnet. Stayed: long-running projects and public figures whose identity carried on in public; assumed, not proven, to have kept control.', sold, stayed: STAYED }, null, 1),
);
console.log(`read ${seen.size} of ${total} marketplace transactions: ${sold.length} sold accounts, ${STAYED.length} stayed`);
