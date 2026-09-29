> **BANNER 1 — D1 RULED CLOSED (added 2026-09-29, after `d667f89c`,
> additive).**
>
> This note's body is preserved exactly as merged at `d667f89c` (#2283) and is
> not edited. Evoni's ruling that D1 is closed, and her CA app check, are
> recorded in `F-Stats-1_D1_Closed_Ruling_2026-09-29.md`.

| **PRIME STUDIOS** **F-STATS-1 REGISTER NOTE** *D1 is built and deployed, and the balance authority is settled in code: what shipped and where it went live, the two register items it answers, and what is still owed. A note, not a Fix Plan revision.* |
| --- |

**Document version**

This is a new register note. It is not a Fix Plan revision, and it amends no
filed document. It edits no file under `docs/audit/`.

Basis: `origin/main` at `784a2edad1370d444ccb66ac8d083ecfa1652f37` (#2281),
read 2026-09-29. File:line citations are at this basis.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

NOTE. The standings used here:
- **MEASURED**: this repository, with the command and output or a file:line.
- **ATTESTED**: production output as Evoni pasted it, recorded in the notes
  cited.
- **RULED**: Evoni's decisions, cited to where they are recorded. None is
  re-ruled here.
- **INFERRED**: marked where used.

The filing session made no host, AWS, database or Cognito contact.

Task: #2282.

---

## §1. What shipped — MEASURED

D1 is Evoni's ruling §8(x) D1 in `docs/EVENT_EPISODE_FLOW.md`: the ledger
(`financial_transactions`) is Lala's balance, and `character_state.coins` is
a cached copy of it. Its detail is §8(y) Q1–Q9 and §8(aa) M6; its design is
`docs/COINS_LEDGER_CACHE_DESIGN.md`.

"Live at" is the deploy whose range contains the merge commit: the commit is
an ancestor of the deploy's end tree and not of its start tree. The trees are
read from each deploy record's §0 `Tree:` line.

```
$ for c in e78643304 ff38e0c9f 6bc934deb 9f1abfd9d 8257ed538 33fedf27c 27fe77916 4e8a94bbd; do for L in BU BV BW BX BY BZ CA; do f=$(ls docs/audit/F-Deploy-1_Deploy_*_$L.md); to=$(grep -m1 -oE "^Tree: [0-9a-f]{40} -> [0-9a-f]{40}" "$f" | awk '{print $4}'); from=$(grep -m1 -oE "^Tree: [0-9a-f]{40}" "$f" | awk '{print $2}'); if git merge-base --is-ancestor $c $to && ! git merge-base --is-ancestor $c $from; then echo "$c live at $L"; fi; done; done
e78643304 live at BW
ff38e0c9f live at BW
6bc934deb live at BY
9f1abfd9d live at BY
8257ed538 live at BZ
33fedf27c live at CA
27fe77916 live at CA
4e8a94bbd live at CA
```

| What | Task | PR | Merge SHA | Live at |
|---|---|---|---|---|
| D1 PR 1: `coinLedgerSync` (lock, sync, spend), not yet called | #2246 | #2251 | `e786433046fada8562befd1691fff70917d322c4` | BW (`F-Deploy-1_Deploy_2026-09-29_BW.md`) |
| Milestone payouts book; feed posts no longer abort finalize's transaction | #2252 | #2254 | `ff38e0c9fd9722ff69132374be3848109c09c449` | BW |
| M6: a deleted episode's rows leave the balance | #2267 | #2268 | `6bc934deb232b79734b366d609e478d2a285c776` | BY (`…_BY.md`) |
| D1 PR 5: the reconciliation apply action | #2250 | #2269 | `9f1abfd9d86eedfe998ec5436e415900028f5827` | BY |
| D1 PR 2: Complete and Finalize sync inside D2's transaction; Q6 refusal | #2247 | #2255 | `8257ed538d0690433e2167c63c6aeef7cd5423ca` | BZ (`…_BZ.md`) |
| Every balance display reads the ledger | #2273 | #2277 | `33fedf27c6a05a76785099378bcfcc9f8871f448` | CA (`…_CA.md`) |
| D1 PR 3: the wardrobe spends; M3; Law 4 | #2248 | #2279 | `27fe779163622be028e19c4775cc22f5c5481362` | CA |
| D1 PR 4: the manual edit, admin reset and seeding; Q1, Q3, Q5 | #2249 | #2280 | `4e8a94bbdf0ca8db70968d7fc1517188d812e2d5` | CA |

**Production is at `4e8a94bb`** (CA record §8). `origin/main` is one commit
ahead: #2281, the CA record, which is docs only.

**The reconciliation** is recorded in two notes, cited, not restated:
- `F-Stats-1_D1_ReconciliationRead_2026-09-29.md`: what production held, and
  Evoni's per-show decisions (RULED there).
- `F-Stats-1_D1_ReconciliationApplied_2026-09-29.md`: the dry run and the
  apply (ATTESTED there). Show `9bd0655f-…` went from 560 to 1900; four rows
  were voided; nothing was refused.

## §2. Against the register

Both items are cited, not re-ruled. Each is answered in code at this basis.

### §2.1 Class 4, "Parallel balance readers, none authoritative"

**Where it stands in the register.**
- RULED at `F-Stats-1_Fix_Plan_v1.62.md:112`: homed to F-Stats-1 and flagged
  the priority.
- `F-Stats-1_MoneyPath_Rulings_Note_2026-09-29.md` §2.2 recorded that D1
  rules the ledger authoritative, and left open that "No code recomputes
  `character_state.coins` from the ledger at this basis."

**MEASURED: the ledger is the authority, and one function writes its value
to the cache.**
- `syncCoinsFromLedger` (`src/services/coinLedgerSync.js:82`) locks the show
  row (`:47`, `FOR NO KEY UPDATE`), sums the counted ledger
  (`LEDGER_BALANCE_SQL`, `:28`), and writes the sum to every `lala` row
  (`:86`).
- Every writer of Lala's coins calls it in the writer's own transaction:
  - completion: `src/services/episodeCompletionService.js:444`;
  - a Finalize run alone: `src/services/financialTransactionService.js:358`;
  - the wardrobe spends: `src/routes/wardrobe.js:1452` (`/select`), `:1660`
    (`/lock-outfit-atomic`), `:1765` (`/purchase`);
  - the manual edit: `src/routes/evaluation.js:675`;
  - the reconciliation: `src/services/coinReconciliation.js:87`.

**MEASURED: every other statement that touches `character_state.coins`.**
Raw SQL (`UPDATE character_state` / `INSERT INTO character_state`) and ORM
writes (`CharacterState.update|create|…`), grepped across `src/`:

| Site | What it writes to coins |
|---|---|
| `episodeCompletionService.js:504`, `changeCoins` with `delta: 0` | `coins = coins + 0`: the value is unchanged; the statement carries the other stats (comment at `:501`) |
| `episodeCompletionService.js:250`, the auto-seed INSERT | a default, overwritten by `syncCoinsFromLedger` in the same transaction (`:254`) |
| `evaluation.js:83`, `getOrCreateCharacterState` for `lala` | a default, overwritten by the sync in the same transaction (`:84`) |
| `evaluation.js:89`, the same for any other key | that key's default; not Lala's balance (§8(y) Q3: coins are Lala's only) |
| `evaluation.js:166`, the admin reset; `evaluation.js:683`, the manual edit | coins are not in the SET |

`changeCoins` and `spendCoins` (`src/services/coinBalanceGuard.js:57`, `:89`)
have one caller, the delta-0 statement above.

**MEASURED: every display reads the ledger.** The endpoints the displays call
read `getCurrentBalance` (`src/services/financialTransactionService.js:53`,
counted rows at `:66`):
- `GET /world/:showId/balance` (`src/routes/worldEvents.js:4310`): the
  Dashboard and Insights;
- `GET /characters/lala/state` (`src/routes/evaluation.js:231–233`): Producer
  Mode, the wardrobe game, Production and Evaluate;
- the next-event suggestions (`src/routes/worldEvents.js:4424`).

`tests/integration/balanceDisplays.integration.test.js` asserts one balance
across every display endpoint.

**MEASURED: readers that still read the cache.** These are not displays of
the balance. They are story and scoring context:
- `episodeScriptWriterService.js:313`;
- `wardrobeIntelligenceService.js:1005`;
- `episodeGeneratorService.js:485`;
- `outfitScoreContext.js:26`;
- `worldEvents.js:1247`, the skeleton generator;
- `episodes.js`, `generate-beats` (the `CharacterState.findOne` at `:963`).

**INFERRED: where the cache can still lag the ledger.** Since every writer
syncs, the cache equals the ledger after any write. One path changes the
balance without a write: deleting an episode. Under M6 that drops the
episode's rows from the sum, and nothing syncs the cache when it happens:

```
$ grep -c syncCoinsFromLedger src/routes/episodes.js src/controllers/episodeController.js
src/routes/episodes.js:0
src/controllers/episodeController.js:0
```

The cache catches up at the next write. The context readers
above can see the older value until then. This is recorded, not ruled; no
item is minted.

### §2.2 The D2 gap: a standalone Finalize before Complete

**Where it stands in the register.**
`F-Stats-1_MoneyPath_Rulings_Note_2026-09-29.md` §3.3: a Finalize run alone
booked the ledger without moving `character_state.coins`, and the later
Complete moved coins by the tier reward only, so the two stores ended apart
by the finalize net.

**MEASURED: closed by PR 2 (#2255).**
- The standalone route (`src/routes/worldEvents.js:4262`) calls
  `finalizeEpisodeFinancials`. Run alone and not as a dry run, that function
  opens its own transaction, books its rows, and syncs the cache from the
  ledger (`src/services/financialTransactionService.js:352–358`).
- `completeEpisode` locks and reads the ledger before booking
  (`episodeCompletionService.js:388–389`). It syncs after its last row
  (`:444`), and takes the coin movement as the ledger's difference (`:445`).
  A Finalize that ran earlier is already in `ledgerBefore`.
- `tests/integration/completeFinalizeCoinSync.integration.test.js:94`: "a
  Finalize run alone moves coins with the ledger, and the later Complete
  keeps them equal".

## §3. Still owed, unsequenced

These are listed in no order. None is sequenced or ruled here.
- **Q4's duplicate-row investigation.** §8(y) Q4 says: "Longer term,
  investigate why multiple Lala rows can exist". ATTESTED: Q-D found no show
  with two `lala` rows on production
  (`F-Stats-1_D1_ReconciliationRead_2026-09-29.md:75`).
- **Q5's optional Reset Career Economy action.** §8(y) Q5: "If needed, create
  a separate, explicit Reset Career Economy action with a strong
  confirmation". Not built.
- **The orphan cleanup, #2266:** `character_state` row `ae018fad-…`, with no
  show.
- **The Episode Ledger's figures, #2278** (Episode Money Phase A, M4): its
  totals and per-episode P&L still read `episodes.total_*`.
- **The CA app-check banner.** CA was filed with "App check: not supplied";
  Evoni's check in production is owed, then a banner on the CA record.

## §4. Tails — re-derived, not carried

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -1
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md | tail -1
410:### XK-4 — tenancy absent from the route contract
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
```

The tails are FD-69, XK-4 and PE 68. Nothing is minted here.

---

## What this note does not do

- It rules nothing. It does not close Class 4, D1 or any issue; §2 records
  what the code shows, against items cited as they stand.
- It edits no filed document.
- It sequences nothing in §3.
- It mints, discharges and reopens nothing.
- The filing session made no host, AWS, database or Cognito contact.

*Type: register note. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2282.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
