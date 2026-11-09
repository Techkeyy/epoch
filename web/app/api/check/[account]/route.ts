// GET /api/check/{account}: the report plus the same plain sentences the page shows.
import { check, type Report } from '@/lib/epoch';
import { mainnet } from '@/lib/chain';
import { ACCOUNT_ID, explain } from '@/lib/explain';
import { overGlobalLimit } from '@/lib/limit';

export const dynamic = 'force-dynamic';

// The same account asked twice within a few minutes gets the same answer; key changes are rare.
const recent = new Map<string, { at: number; report: Report }>();
const FRESH = 5 * 60_000;
const inFlight = new Map<string, Promise<Report>>();
// Free servers can stall. A visitor waits this long at most; the check keeps going and is ready on retry.
const PATIENCE = 25_000;

export async function GET(_req: Request, ctx: { params: Promise<{ account: string }> }) {
  const account = decodeURIComponent((await ctx.params).account).trim().toLowerCase();
  if (!ACCOUNT_ID.test(account)) return Response.json({ error: 'That is not a valid NEAR account name.' }, { status: 400 });

  const hit = recent.get(account);
  if (hit && Date.now() - hit.at < FRESH) return answer(hit.report);
  if (!inFlight.has(account) && overGlobalLimit('check'))
    return Response.json({ error: 'Epoch is busy right now. Please try again in a minute.' }, { status: 429, headers: { 'retry-after': '60' } });

  try {
    let pending = inFlight.get(account);
    if (!pending) {
      pending = check(account, mainnet)
        .then((report) => {
          recent.set(account, { at: Date.now(), report });
          if (recent.size > 2_000) recent.delete(recent.keys().next().value!);
          return report;
        })
        .finally(() => inFlight.delete(account));
      pending.catch(() => {});
      inFlight.set(account, pending);
    }
    const report = await Promise.race([pending, new Promise<null>((done) => setTimeout(() => done(null), PATIENCE))]);
    if (!report)
      return Response.json(
        { error: 'NEAR’s free public servers are slow right now. Epoch is still reading; try again in a minute and the answer will be ready.' },
        { status: 503, headers: { 'retry-after': '30' } },
      );
    return answer(report);
  } catch {
    return Response.json({ error: 'NEAR’s public servers did not answer in time. Nothing is wrong with the account; please try again.' }, { status: 503 });
  }
}

const answer = (report: Report) =>
  Response.json({ ...report, explanation: explain(report) }, { headers: { 'cache-control': 'public, max-age=60', 'access-control-allow-origin': '*' } });
