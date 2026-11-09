# Epoch

See who controls a NEAR account today, and since when.

**[Live site](https://epoch-near.onrender.com)** · [API example](https://epoch-near.onrender.com/api/check/ruble.near) · [Benchmark results](web/benchmark/results.json)

Type an account name. Epoch tells you when the keys that control it today took over, what happened to the keys before them, and how the switch happened. One page for people, one API call for wallets, payment tools and AI agents.

> *"This account has three years of clean history. Is it still the same person I'm about to pay?"*

Built at NEAR HACKATHON. Reads NEAR mainnet. No wallet, no sign-in, no key.

## Why this exists

On NEAR, whoever holds an account's full-access keys controls it. Replace all the keys and the account belongs to someone else, but its name, balance history and reputation carry on as if nothing happened. Accounts are bought and sold this way on public marketplaces, and taken over the same way.

Explorers show an account's current keys. Safety checks look at how old an account is. Neither answers the question that matters before you pay or trust someone: **how long have the people holding these keys held them?**

```
ruble.near, as Epoch sees it

2021-09  ████████████████████  first owner's keys
2022-11  keys removed  ░░░░░░░░░░░░  244 days with no full-access key (listed on near.bet)
2023-07  ████████  new keys take control  ->  today

The account's history goes back to 2021. Its current control starts on 4 July 2023.
```

## What it does

1. **Reads today's keys.** One ordinary RPC call returns the account's full-access keys.
2. **Dates them.** NEAR starts every new key's nonce at the block height it was added in, times a million, so each key carries its own birth date. The oldest of today's keys marks when the current control began.
3. **Finds what came before.** It lists the full-access keys that ran the account earlier and when they were removed, from NearBlocks' key history, or from archival state when that is unavailable.
4. **Names the switch.**

| Pattern | What happened | Usually means |
|---|---|---|
| **handover** | Old keys removed first, then a stretch with no full-access key, then new keys | A sale through a marketplace contract |
| **swap** | Old keys removed at the same moment the new ones arrived | An owner replacing a lost key, or someone taking over the account |
| **overlap** | Old and new keys worked side by side for a while | The owner moving to new keys |

5. **Answers in plain words**, the same on the page and in the API, and says when an account has no full-access key at all (locked) or is still held by a key from before June 2021, when NEAR began dating keys.

Epoch reports when control changed and how. It never calls an account a scam, because a swap can be an honest owner. It tells you whose history you are looking at.

## Try it

- **Live:** https://epoch-near.onrender.com, then type any mainnet account, or point at a record's timeline to see who held the account on any day.
- **API:** `curl https://epoch-near.onrender.com/api/check/ruble.near`

```json
{
  "account": "ruble.near",
  "verdict": {
    "kind": "changed",
    "at": { "height": 95702651, "time": 1688496334059 },
    "daysAgo": 1224,
    "recent": false,
    "pattern": "handover",
    "keylessDays": 244,
    "previousKeys": 4,
    "oldRemoved": { "time": 1667421857803 }
  },
  "explanation": {
    "tone": "changed",
    "headline": "New keys took control of ruble.near on 4 July 2023.",
    "detail": ["The previous 4 keys were removed on 2 November 2022, and for 244 days nobody held a full-access key. ..."]
  }
}
```

That is the live answer on 9 November 2026, shortened. `daysAgo` grows by one each day.

A simple rule for an agent or payment tool: when `verdict.recent` is true (control changed in the last 30 days), do not pay until a person has confirmed the payee another way.

## Run it yourself

Needs Node 24.

```bash
git clone https://github.com/Techkeyy/epoch && cd epoch/web
npx -y pnpm@11.19.0 install
npx -y pnpm@11.19.0 test     # 26 tests on a fake chain, no network needed
npx -y pnpm@11.19.0 dev      # the site at http://localhost:3000, reading mainnet
```

No configuration is needed: Epoch uses free public NEAR servers. Optional environment variables: `NEARBLOCKS_API_KEY` raises the key-history limit, `EPOCH_RPC` and `EPOCH_ARCHIVAL_RPC` take comma-separated RPC URLs.

## Does it work? The benchmark

`web/benchmark/run.ts` runs the real engine on mainnet over a labelled set:

```bash
cd web
node benchmark/labels.mjs    # optional: rebuilds labels.json from the chain
node benchmark/run.ts        # checks every labelled account, prints the results
```

A fresh run takes a while: NearBlocks' free plan allows a short burst of calls and then a rest, and accounts with long key histories need several pages. Answers are cached in `web/benchmark/cache`, so a rerun is quick.

The labelled set (`web/benchmark/labels.json`):

- **Sold:** every account bought through near.bet's on-chain marketplace (a successful `acquire` on `c.nearbet.near`), 71 accounts. Control certainly changed on the sale date. `labels.mjs` rebuilds this list from all 1,747 marketplace transactions.
- **Stayed:** 80 long-running projects and public figures whose identity carried on in public. I assume, but cannot prove, that they kept control.

Results on 9 November 2026 ([results.json](web/benchmark/results.json)):

| | Sold (71) | Stayed (70 read) |
|---|---|---|
| Control changed | 55 | 12 |
| ... dated on or after the sale | **55 of 55** | n/a |
| Switch was a **handover** | **49** | **0** |
| Switch was a swap | 5 | 5 |
| Switch was an overlap | 1 | 7 |
| No date to compare: same keys since before June 2021 | 8 | 32 unchanged in all |
| No full-access key today (locked) | 8 | 26 |
| Control changed in the 30 days before the check | 0 | 0 |
| Control changed in the 365 days before the check | 0 | 1 |

What this shows:

- **When an account changes hands, Epoch dates it.** All 55 changes found on sold accounts fall on or after the sale date. The 8 sold accounts it could not date were sold before June 2021, and Epoch says exactly that instead of guessing.
- **The handover is the signature of a sale.** It appears in 49 of 71 sold accounts and in none of the 70 that stayed.
- **A key change alone is not proof.** Twelve long-running accounts replaced their keys at some point, all as swaps or overlaps. That is why Epoch reports the pattern and never a "sold" score.
- **"Changed recently" is rare for real organisations.** None of the 70 changed control in the month before the check, so a 30-day rule for agents would not have blocked a payment to any of them.

Not counted: 4 names in my stayed list do not exist on mainnet, and 6 stayed accounts (`near`, `mintbase.near`, `nearweek.near`, `nf-finance.near`, `mike.near`, `zavodil.near`) have between 149 and 36,380 keys in their history. Archival servers refuse to list more than 100 keys, so for them Epoch needs NearBlocks' history, and its free daily allowance ran out during the run.

Read these numbers with their limits: the sold set comes from one marketplace, mostly 2021 and 2022, and the stayed set is my own choice of well-known accounts. Neither is a random sample of NEAR.

## How I tried to break it

| Case | What Epoch does | Checked by |
|---|---|---|
| Account sold through a marketplace contract | handover, with the keyless days and the earlier keys | test, live on `ruble.near` |
| Keyless stretch that reaches back to the account's creation | finds the creation block and the first owner's keys | test |
| Owner adds a new key but keeps an original one | unchanged: control did not fully change | test |
| Owner moves to new keys, keeps old ones a while | overlap, with the date the old keys left | test |
| Old keys removed at the same moment new ones arrive | swap, without guessing which kind | test |
| A full-access key from before June 2021 still present | unchanged, "goes back at least that far" | test |
| No full-access key at all | locked, and says whether a contract controls it | test, live on `wrap.near` |
| Account does not exist | missing | test, live |
| Block dates estimated an hour off | uses NearBlocks' exact key times, so a swap stays a swap | test |
| Key history longer than one page (`sai_1102.near`, 350 records) | reads every page; a partial list is refused, never answered | live, found by the benchmark |
| History too long for free servers (`relay.aurora`, `near`) | says so plainly, no answer | live |
| Invalid names (`ruble.near.`, `a`, `x..near`) and upper case | rejected, or lower-cased | live |

**Invariant: an incomplete key history never produces an answer, and no answer ever calls a key change a sale or a theft.**

Mutation check: I broke the engine on purpose six times (wrong pattern window, skipped creation search, no date filter on keys, and more). The first run let three through; I added the missing cases and all six are now caught.

## How it is built

| Module | Job |
|---|---|
| `web/lib/epoch.ts` | The whole judgement: dates keys, finds earlier control, names the switch |
| `web/lib/chain.ts` | Mainnet access: free RPC pools, NearBlocks key history, caching, limits |
| `web/lib/blocktime.ts` | Dates a block from a table of known block times, no call needed |
| `web/lib/explain.ts` | Plain sentences, shared by the page and the API |
| `web/lib/register.ts` | Turns a report into the record's entries and era line |
| `web/app/api/check/[account]/route.ts` | The API: validation, caching, a 25-second wait cap |
| `web/components/` | The page: record, key lifelines, time slider, key-date decoder, the Registrar |
| `web/benchmark/` | Labelled set, its rebuild script, the benchmark and its results |
| `web/scripts/anchors.mjs` | Builds `lib/blocktimes.json` from archival RPC |

Next.js 16, React 19, TypeScript, Vitest. Hosted on Render. All code was written during the hackathon, with AI coding assistance.

## Building on NEAR: what I hit

- **A key's nonce is a date.** New keys start at block height times a million. This one fact makes Epoch cheap: dating every current key costs a single RPC call.
- **Archival nodes cap key lists at 100.** `view_access_key_list` at a past block fails with `TOO_MANY_ACCESS_KEYS` above that, so busy accounts can only be read through an indexer.
- **`view_access_key_list` on an account that does not exist returns an empty list**, not an error. Epoch checks existence with `view_account` first.
- **NearBlocks pages two ways.** Transaction lists use a cursor and ignore `page`; key lists use `page`, at most 50 per page, and return no cursor. Reading one style the other way silently returns the first page again, and that is how Epoch's first dataset and its first key reader both went wrong.
- **Free archival RPC allows a burst of about six calls, then roughly one every three seconds.** Epoch sends present-state questions to regular nodes and dates blocks from a shipped table, so a normal check needs no archival call.

## Also by me

**[SecondEyes](https://github.com/Techkeyy/secondeyes)**, my other NEAR HACKATHON project: a checked budget for AI agents, where every payment an agent asks for is compared with what you wrote before a contract releases the money. The two are independent projects.

## Licence

[MIT](LICENSE)
