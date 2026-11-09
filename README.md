# Epoch

See who controls a NEAR account today, and since when.

**[Live site](https://epoch-near.onrender.com)** · [API example](https://epoch-near.onrender.com/api/check/ruble.near) · [Benchmark results](web/benchmark/results.json)

Type an account name. Epoch tells you when the keys that control it today took over, what happened to the keys before them, and how the switch happened. One page for people, one API call for wallets, payment tools and AI agents.

> *"This account has three years of clean history. Is it still the same person I'm about to pay?"*

Built at NEAR HACKATHON. Reads NEAR mainnet. No wallet, no sign-in, no key.

## Why this exists

On NEAR, whoever holds an account's full-access keys controls it. Replace all the keys and the account belongs to someone else, but its name, balance history and reputation carry on as if nothing happened. Accounts are bought and sold like this on public marketplaces, and taken over the same way.

So the usual trust signal, "this account is old and active", says little. Explorers show an account's keys, and safety tools check an account's age. Neither answers the question that matters before you pay or trust someone: **how long have the people holding these keys held them?**

```
ruble.near, as Epoch sees it

2021-09  ████████████████████  first owner's keys
2022-11  keys removed  ░░░░░░░░░░░░  244 days with no full-access key (listed on a marketplace)
2023-07  ████████  new keys take control  ->  today

History since 2021.  Current control: since 4 July 2023.
```

## What it does

1. **Today's keys.** Epoch reads the account's full-access keys from NEAR mainnet.
2. **Their dates.** NEAR starts every new key's nonce at the block height it was added in, times a million. So each key carries its own birth date, and the oldest of today's keys marks when the current control began. This costs one ordinary RPC call.
3. **What came before.** If the account existed before that block, Epoch lists the keys that ran it earlier, when they were removed, and names the pattern of the switch:

| Pattern | What happened | Usually means |
|---|---|---|
| **handover** | Old keys removed first, then a stretch with no full-access key, then new keys | A sale through a marketplace contract |
| **swap** | Old keys removed at the same moment the new ones arrived | An owner replacing a lost key, or someone taking over the account |
| **overlap** | Old and new keys worked side by side for a while | The owner moving to new keys |

It also says when an account has **no full-access key at all** (locked, usually a contract) and when control goes back to a key from before June 2021, when NEAR began dating keys.

Epoch reports when control changed and how. It never calls an account a scam: a swap can be an honest owner. It tells you whose history you are looking at.

## Try it

- Live: https://epoch-near.onrender.com, then type any mainnet account.
- API: `curl https://epoch-near.onrender.com/api/check/ruble.near`

```json
{
  "account": "ruble.near",
  "verdict": {
    "kind": "changed",
    "at": { "height": 95702651, "time": 1688496334058 },
    "daysAgo": 1224,
    "recent": false,
    "pattern": "handover",
    "keylessDays": 244,
    "previousKeys": 4,
    "oldRemoved": { "time": 1667421857802 }
  },
  "explanation": {
    "tone": "changed",
    "headline": "New keys took control of ruble.near on 4 July 2023.",
    "detail": ["The previous 4 keys were removed on 2 November 2022, and for 244 days nobody held a full-access key. ..."]
  }
}
```

A simple rule for an agent or payment tool: if `verdict.recent` is true (control changed in the last 30 days), do not pay until a person has confirmed the payee another way.

## Does it work? The benchmark

`web/benchmark/run.ts` runs the real engine on mainnet over a labelled set and prints the results. Anyone can rerun it:

```bash
cd web && pnpm install && node benchmark/run.ts
```

The labelled set (`web/benchmark/labels.json`):

- **Sold:** every account bought through near.bet's on-chain marketplace (`acquire` succeeded on `c.nearbet.near`), 71 accounts. Control certainly changed on the sale date.
- **Stayed:** 80 long-running projects and public figures whose identity carried on in public. I assume, but cannot prove, that they kept control.

First result, from current keys and their dates alone (`research/nonce-test.mjs`, run on 9 November 2026):

| | Sold (71) | Stayed (80) |
|---|---|---|
| No full-access key (locked) | 8 | 36 |
| Controlled by a key from before June 2021 | 8 | 16 |
| Keys carry dates | 55 | 28 |
| Current control starts at or after the sale (60-day window, because near.bet removes the seller's keys at listing) | **55 of 55** | n/a |
| Current control started in the last 90 days | 0 | 0 |
| Current control started in the last 365 days | 0 | 1 |

What this shows: when an account is sold, Epoch dates the new control to the sale every time. It also shows why Epoch does not give a "sold" score: many long-running projects have fully replaced their keys at some point (one in the last year), and a key replacement on its own looks the same. That is why Epoch reports the pattern of each switch instead of a verdict.

Read these numbers with their limits: the sold set comes from one marketplace, mostly 2021 and 2022. The stayed set is my own choice of well-known accounts. Neither is a random sample of NEAR.

## How it is built

```
web/lib/epoch.ts       the whole judgement, pure logic over a small Chain interface
web/lib/chain.ts       NEAR mainnet: free public RPC, NearBlocks key history, caching
web/lib/blocktime.ts   dates a block from a table of known block times (no call needed)
web/lib/explain.ts     plain sentences, shared by the page and the API
web/app/               the page and GET /api/check/{account}
web/benchmark/         labelled set, one-command benchmark, results
research/              the scripts behind the findings above
```

- **Free data only.** Present state comes from regular public RPC nodes. Earlier keys come from NearBlocks' key history (one cached call per account). If that is unavailable, Epoch walks archival state instead, which is slower on free servers.
- **Dates without archival calls.** `web/lib/blocktimes.json` holds the time of every millionth mainnet block, read once from archival RPC by `web/scripts/anchors.mjs`. Any block between two of them is dated by interpolation, within minutes.
- Next.js 16 and React 19. Tests with Vitest: `cd web && pnpm test` (20 tests).

## Limits

- Epoch cannot say who holds the keys, only when they arrived and what happened to the earlier ones.
- A key change is not proof of a sale or a theft. The pattern is evidence, not a verdict.
- Keys added before about June 2021 carry no date. If one still controls an account, Epoch says control goes back at least that far.
- Only full-access keys count. Limited keys can call specific contracts but cannot change who controls an account.
- It runs on free public servers. When they are busy, a check can be slow or ask you to try again. The site caps requests per minute to protect them.

## Also by me

**[SecondEyes](https://github.com/Techkeyy/secondeyes)**, my other NEAR HACKATHON project: a checked budget for AI agents, where every payment an agent asks for is compared with what you wrote before a contract releases the money. The two are independent projects.

## Licence

MIT. See [LICENSE](LICENSE).
