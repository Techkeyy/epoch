// Bet 2, first pass, free data only: when did each account's current full-access keys arrive?
// A key's nonce starts at (block height when added) x 1e6, so floor(nonce / 1e6) dates the key.
import fs from 'node:fs';
const RPC = 'https://archival-rpc.mainnet.fastnear.com';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) {
  for (let i = 0; i < 6; i++) {
    const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
    if (r.ok) return r.json();
    await sleep(1500 * (i + 1));
  }
  throw new Error(`rpc ${method} failed`);
}
const heightTime = new Map();
async function timeOf(h) {
  // Blocks can be skipped, so step forward until one exists.
  for (let x = h; x < h + 50; x++) {
    if (heightTime.has(x)) return heightTime.get(x);
    const b = await rpc('block', { block_id: x });
    if (b.result) { const t = Number(b.result.header.timestamp) / 1e6; heightTime.set(x, t); return t; }
  }
  return null;
}
const day = 86400000;
const sales = JSON.parse(fs.readFileSync('data/sales.json'));
const src = fs.readFileSync('research/dataset.mjs', 'utf8');
const STAYED = JSON.parse(/const STAYED = (\[[^\]]+\])/.exec(src)[1].replace(/'/g, '"'));
const rows = [];
for (const [label, names] of [['sold', [...new Set(sales.map((s) => s.account))]], ['stayed', STAYED]]) {
  for (const account of names) {
    const r = await rpc('query', { request_type: 'view_access_key_list', finality: 'final', account_id: account });
    const full = (r.result?.keys ?? []).filter((k) => k.access_key.permission === 'FullAccess');
    const heights = full.map((k) => Math.floor(Number(k.access_key.nonce) / 1e6));
    // Keys made before nonces carried a height have tiny nonces: they are old, date unknown.
    const dated = heights.filter((h) => h > 9_000_000);
    const undated = heights.length - dated.length;
    const oldest = undated ? null : dated.length ? Math.min(...dated) : null;
    const eraStart = oldest ? await timeOf(oldest) : null;
    const sale = sales.filter((s) => s.account === account).map((s) => s.at / 1e6).sort((a, b) => b - a)[0];
    rows.push({ label, account, fullKeys: full.length, undated, eraStart, sale });
    await sleep(250);
  }
}
fs.writeFileSync('data/nonce-test.json', JSON.stringify(rows, null, 1));
const fmt = (t) => (t ? new Date(t).toISOString().slice(0, 10) : '-');
for (const label of ['sold', 'stayed']) {
  const g = rows.filter((x) => x.label === label);
  const noKeys = g.filter((x) => !x.fullKeys).length;
  const old = g.filter((x) => x.undated).length;
  const dated = g.filter((x) => x.eraStart);
  console.log(`\n${label}: ${g.length} accounts, ${noKeys} with no full-access key, ${old} keep a key older than dated nonces, ${dated.length} dated`);
  if (label === 'sold') {
    const atSale = dated.filter((x) => x.eraStart >= x.sale - 60 * day).length;
    console.log(`  control era starts at or after the sale (60-day window for listing): ${atSale}/${dated.length}`);
  }
  for (const w of [90, 365, 730]) console.log(`  era started in the last ${w} days: ${dated.filter((x) => Date.now() - x.eraStart < w * day).length}`);
  for (const x of g) console.log(`  ${x.account.padEnd(36)} keys ${x.fullKeys} undated ${x.undated} era ${fmt(x.eraStart)} sale ${fmt(x.sale)}`);
}
