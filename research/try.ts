import { check } from '../web/lib/epoch.ts';
import { mainnet } from '../web/lib/chain.ts';
let calls = 0;
const counted = { ...mainnet, keys: (a: string, h?: number) => (calls++, mainnet.keys(a, h)), time: (h: number) => (calls++, mainnet.time(h)) };
for (const a of process.argv.slice(2)) {
  calls = 0;
  const t = Date.now();
  try {
    const r = await check(a, counted);
    const v = r.verdict as Record<string, unknown>;
    const d = (m: unknown) => (m && typeof m === 'object' && 'time' in m ? new Date((m as { time: number }).time).toISOString().slice(0, 10) : '-');
    console.log(a.padEnd(22), String(v.kind).padEnd(9), 'at', d(v.at ?? v.since), 'oldRemoved', d(v.oldRemoved), 'pattern', v.pattern ?? '-', 'keyless', v.keylessDays ?? '-', 'prev', v.previousKeys ?? '-', `| ${calls} calls ${((Date.now() - t) / 1000).toFixed(1)}s`);
  } catch (e) {
    console.log(a, 'ERROR', (e as Error).message);
  }
}
