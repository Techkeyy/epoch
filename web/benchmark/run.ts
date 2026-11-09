// One command: node benchmark/run.ts
// Runs the real engine on mainnet over the labelled accounts and prints what it found. Answers are cached in
// benchmark/cache so a rerun is fast and a free RPC is not hammered; delete that folder for a fresh run.
import fs from 'node:fs';
import { check, DAY, type Report } from '../lib/epoch.ts';
import { mainnet } from '../lib/chain.ts';

const dir = new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const labels = JSON.parse(fs.readFileSync(`${dir}labels.json`, 'utf8')) as { sold: { account: string; soldAt: string }[]; stayed: string[] };
fs.mkdirSync(`${dir}cache`, { recursive: true });

async function report(account: string): Promise<Report | { account: string; error: string }> {
  const file = `${dir}cache/${account}.json`;
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  try {
    const r = await check(account, mainnet);
    fs.writeFileSync(file, JSON.stringify(r, (_k, v) => (typeof v === 'bigint' ? v.toString() : v)));
    return r;
  } catch (e) {
    return { account, error: (e as Error).message };
  }
}

const day = (t: number) => new Date(t).toISOString().slice(0, 10);
const count = <T>(xs: T[], f: (x: T) => boolean) => xs.filter(f).length;

console.log('SOLD: accounts bought on near.bet. Does Epoch place the start of current control at or after the sale?');
const sold: { account: string; soldAt: number; r: Report | { error: string } }[] = [];
for (const s of labels.sold) sold.push({ account: s.account, soldAt: Date.parse(s.soldAt), r: await report(s.account) });
const soldOk = sold.filter((x) => !('error' in x.r)) as { account: string; soldAt: number; r: Report }[];
const soldChanged = soldOk.filter((x) => x.r.verdict.kind === 'changed');
// near.bet removes the seller's keys when an account is listed, before the sale. 60 days covers that.
const atSale = soldChanged.filter((x) => x.r.verdict.kind === 'changed' && x.r.verdict.at.time >= x.soldAt - 60 * DAY);
const byKind = (xs: { r: Report }[]) => Object.entries(xs.reduce<Record<string, number>>((m, x) => ((m[x.r.verdict.kind] = (m[x.r.verdict.kind] ?? 0) + 1), m), {}));
const byPattern = (xs: { r: Report }[]) => Object.entries(xs.reduce<Record<string, number>>((m, x) => (x.r.verdict.kind === 'changed' ? ((m[x.r.verdict.pattern] = (m[x.r.verdict.pattern] ?? 0) + 1), m) : m), {}));
console.log(`  checked ${soldOk.length}/${sold.length}  ${count(sold, (x) => 'error' in x.r)} errors`);
console.log(`  verdicts: ${byKind(soldOk).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`  control change found and dated at or after the sale: ${atSale.length}/${soldChanged.length} of those found changed`);
console.log(`  how the switch happened: ${byPattern(soldChanged).map(([k, n]) => `${k} ${n}`).join(', ')}`);
for (const x of soldOk.filter((x) => x.r.verdict.kind !== 'changed' || !atSale.includes(x)))
  console.log(`    not matched: ${x.account} sold ${day(x.soldAt)} -> ${x.r.verdict.kind}${x.r.verdict.kind === 'changed' ? ` at ${day(x.r.verdict.at.time)}` : ''}`);

console.log('\nSTAYED: long-running projects and people. How often would Epoch raise an alarm?');
const stayed: { account: string; r: Report | { error: string } }[] = [];
for (const a of labels.stayed) stayed.push({ account: a, r: await report(a) });
const stayedOk = stayed.filter((x) => !('error' in x.r)) as { account: string; r: Report }[];
const stayedChanged = stayedOk.filter((x) => x.r.verdict.kind === 'changed');
console.log(`  checked ${stayedOk.length}/${stayed.length}  ${count(stayed, (x) => 'error' in x.r)} errors`);
console.log(`  verdicts: ${byKind(stayedOk).map(([k, n]) => `${k} ${n}`).join(', ')}`);
console.log(`  how the switch happened (changed only): ${byPattern(stayedChanged).map(([k, n]) => `${k} ${n}`).join(', ')}`);
for (const days of [30, 90, 365])
  console.log(`  control changed in the ${days} days before the check: ${count(stayedChanged, (x) => x.r.verdict.kind === 'changed' && x.r.verdict.daysAgo < days)}/${stayedOk.length}`);
const handover = (xs: { r: Report }[]) => count(xs, (x) => x.r.verdict.kind === 'changed' && x.r.verdict.pattern === 'handover');
console.log(`\nKEYLESS HANDOVER (keys removed, then new keys after a gap): sold ${handover(soldOk)}/${soldOk.length}, stayed ${handover(stayedOk)}/${stayedOk.length}`);
fs.writeFileSync(`${dir}results.json`, JSON.stringify({ ranAt: new Date().toISOString(), sold: sold.map((x) => ({ account: x.account, soldAt: day(x.soldAt), verdict: 'error' in x.r ? x.r : x.r.verdict })), stayed: stayed.map((x) => ({ account: x.account, verdict: 'error' in x.r ? x.r : x.r.verdict })) }, null, 1));
