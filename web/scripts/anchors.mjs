// Builds lib/blocktimes.json: the time of every millionth mainnet block, so the app can date any block by
// interpolation instead of an archival call. Resumable; rerun to extend it to the current head.
import fs from 'node:fs';
const OUT = new URL('../lib/blocktimes.json', import.meta.url);
const RPC = ['https://archival-rpc.mainnet.fastnear.com', 'https://archival-rpc.mainnet.near.org'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const have = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : [];
const known = new Set(have.map(([h]) => h));
let turn = 0;
async function blockTime(h) {
  for (let tries = 0; tries < 40; tries++) {
    const url = RPC[turn++ % RPC.length];
    try {
      const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'block', params: { block_id: h } }) });
      if (r.ok) {
        const j = await r.json();
        if (j.result) return [j.result.header.height, Number(BigInt(j.result.header.timestamp_nanosec) / 1_000_000n)];
        if (/UNKNOWN_BLOCK/.test(JSON.stringify(j.error))) { h++; continue; }
      }
    } catch {}
    await sleep(1600);
  }
  throw new Error(`block ${h}`);
}
const head = (await (await fetch('https://rpc.mainnet.fastnear.com', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'status', params: [] }) })).json()).result.sync_info.latest_block_height;
const wanted = [9_820_210];
for (let h = 10_000_000; h < head - 200_000; h += 1_000_000) wanted.push(h);
for (const h of wanted) {
  if ([...known].some((k) => k >= h && k < h + 50)) continue;
  have.push(await blockTime(h));
  have.sort((a, b) => a[0] - b[0]);
  fs.writeFileSync(OUT, JSON.stringify(have));
  if (have.length % 20 === 0) console.log(have.length, 'of', wanted.length);
}
console.log('done', have.length);
