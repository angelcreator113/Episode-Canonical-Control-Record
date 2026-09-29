# D1 design: `character_state.coins` as a cached copy of the ledger

## Status of this document

**A design note for Evoni's approval (Task #2242).** It proposes code but
changes none, and writes no migration. No database was queried, and no host,
AWS, database or Cognito contact was made. §8 holds SQL for Evoni to run;
the session did not run it against any shared database.

The ruling it implements is `docs/EVENT_EPISODE_FLOW.md` §8(x):

> **D1.** Yes. The transaction ledger is the authoritative balance;
> character_state.coins is a cached copy, always recomputed from the ledger.

It builds on D2 (Finalize and Complete run in one transaction and are
idempotent, #2236) and D3 (the outfit lock never makes finalize skip money,
#2235). The register's note on D1–D3 is
`docs/audit/F-Stats-1_MoneyPath_Rulings_Note_2026-09-29.md`. Its §3.3 records
the gap D2 left, and its §4 records D1's implementation as owed.

Claims are marked:
- **MEASURED**: read from this repository and cited by name, with a line
  number at the basis below.
- **PROPOSED**: the design, for approval.
- **QUESTION**: a decision that is Evoni's (§7).

**Basis:** `origin/main` at `1d57bf2c485c2874d683438a885f7f0891190e1b`
(2026-09-29, #2241).

**Abbreviations:**
- **FTS**: `src/services/financialTransactionService.js`
- **ECS**: `src/services/episodeCompletionService.js`
- **CBG**: `src/services/coinBalanceGuard.js`

---

## 1. Summary

Today two stores hold Lala's balance, and they are written separately:
- **The ledger**, `financial_transactions`. It is read through
  `getCurrentBalance` (FTS).
- **The cache**, `character_state.coins`. It is moved by deltas (CBG
  `changeCoins`/`spendCoins`), set outright (the manual edit, the admin
  reset), or seeded at 500.

§5 lists nine ways the two drift apart.

**PROPOSED:**
1. **One function** writes `character_state.coins`: `syncCoinsFromLedger`.
   - It computes the ledger balance inside the caller's transaction.
   - It writes that number to the show's `lala` row or rows.
   - It returns the number.
   - No code adds to or subtracts from `coins` any more.
2. **Every ledger writer calls it**, in the same transaction, after its last
   ledger row:
   - Complete (inside D2's transaction), and a standalone Finalize;
   - the three wardrobe spends;
   - the manual edit.

   The admin reset and the seed paths either stop writing coins or write the
   synced value.
3. **The spend check moves to the ledger.** "Can Lala afford this?" is
   answered from the ledger balance, under a lock on the `lala` row, not from
   `coins`.
4. **The one-time reconciliation is read first.** Evoni runs the read-only
   SQL in §8 in production and pastes the output. The fix for existing rows
   (§8.3) is designed only after that, and only on her ruling.
5. **Readers do not change.** A cache that is always synced is correct to
   read. Only the choice of row needs to be the same everywhere (§4.2).

---

## 2. The two stores today (MEASURED)

| | Ledger: `financial_transactions` | Cache: `character_state.coins` |
|---|---|---|
| Created by | `src/migrations/20260724000002-create-financial-transactions.js` | `src/migrations/20260218100000-evaluation-system.js` (`coins` INTEGER, default 500) |
| Scope | `show_id` only. No `character_key`, no `season_id`. | `show_id` + `season_id` + `character_key` |
| Uniqueness | none needed | `idx_character_state_unique` on (show, season, key) **only where `season_id IS NOT NULL`**, so a show can hold more than one `lala` row with a null season |
| Amount type | `DECIMAL(10,2)` | `INTEGER` |
| Starting balance | `getStartingBalance`: `shows.metadata.starting_balance`, else `DEFAULT_STARTING_BALANCE` = **1900** (`src/utils/financialRates.js`) | **500**: model default, `DEFAULT_LALA_STATE` (`src/services/outfitScoreContext.js`), `DEFAULT_STATS` (`src/utils/evaluationFormula.js`) |
| Soft delete | `deleted_at` | none (`CharacterState` is not paranoid) |

The canon schema capture agrees on each column used here
(`docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`):
- `character_state.coins integer`;
- `financial_transactions.amount numeric`;
- `shows.metadata jsonb`;
- `character_state_history` has no `deleted_at`.

**`getCurrentBalance` (FTS, `:60`).** This is the ledger balance every
ledger reader uses:
- It sums rows with `status = 'executed' AND deleted_at IS NULL` for the
  show: `income` and `reward` add, `expense` and `deduction` subtract.
  `refund` is counted in neither.
- **An empty ledger** (`tx_count = 0`) returns the starting balance, not 0.
- **A ledger with rows but no `seed` row** returns the plain sum. The starting
  balance is then missing from the sum.
- `seedStartingBalance` (FTS, `:109`) writes the `seed` row. Only
  `POST /shows/:id/seed-balance` and the manual edit call it.
- The `catch` fallback reads `character_state_history ... AND deleted_at IS
  NULL`. That table has no `deleted_at`, so the fallback query itself fails.
  It then falls through to the starting balance.

---

## 3. Every writer of `character_state.coins`

| # | Writer | How it writes today (MEASURED) | Ledger row in the same transaction? | PROPOSED under D1 |
|---|---|---|---|---|
| W1 | ECS `completeEpisode`, step 12 | `changeCoins` by `mergedDeltas.coins` = `coinDeltaFrom(financialResult)` (income − expenses + tier reward + paid bonus), inside D2's transaction | Yes: finalize's rows, `tier_reward`, `tier_paid_bonus`, `event_reward` | Keep `extraSet` for the other stats. Replace the coin delta with `syncCoinsFromLedger` after the last ledger insert (§6.3). |
| W2 | ECS `completeEpisode`, step 4 (auto-seed) | `INSERT INTO character_state ... coins = 500`, **before** the transaction | No | Seed coins from the ledger (`syncCoinsFromLedger` sets it inside the transaction). The INSERT's own value no longer matters (§6.6). |
| W3 | `POST /wardrobe/select` (`routes/wardrobe.js`) | `spendCoins(cost)` in a transaction | Yes: `wardrobe_purchase`, `flow: 'select'` | Lock, check against the ledger, write the ledger row, sync (§6.4) |
| W4 | `POST /wardrobe/lock-outfit-atomic` | `spendCoins(totalCost)` in a transaction | Yes: one row per piece, `flow: 'lock_outfit'` | Same as W3 |
| W5 | `POST /wardrobe/purchase` | `spendCoins(cost)` in a transaction | Yes: `flow: 'purchase'` | Same as W3 |
| W6 | `POST /characters/:key/state/update` (manual edit, `routes/evaluation.js`) | Absolute `UPDATE character_state SET coins = :coins` in a transaction. The ledger `manual_adjustment` is computed **before** the transaction, from `getCurrentBalance`. | Yes: `manual_adjustment`, if the adjustment is not 0 | Compute the adjustment inside the transaction, under the lock. Write the ledger row, then sync. The absolute SET goes. (QUESTION Q3 for non-`lala` keys.) |
| W7 | `POST /admin/reset-character-stats` (ADMIN) | `CharacterState.update({ coins: 500, ... }, { where: { show_id } })`, every row of the show | **No** | QUESTION Q5 |
| W8 | `getOrCreateCharacterState` (`routes/evaluation.js`) | `CharacterState.create({ ...DEFAULT_STATS })`, coins 500. Reached from `GET /characters/:key/state`, so a read can create a row. | No | Create with coins from the ledger, or sync right after creating (§6.6) |

**Not writers (MEASURED):**
- FTS never writes `character_state`, including `finalizeEpisodeFinancials`
  and `checkMilestones`.
- `careerPipelineService`, `careerGoals.js`, `worldEvents.js`, `world.js`,
  `worldStudio.js`, `tierFeatures.js`, the seeders and `scripts/` do not
  write it either.
- `WorldStateSnapshot.character_states` is a separate JSONB for storyteller
  characters. It is not this column.

### 3.1 Other money writers that move the ledger but not the cache

These are the drift sources in §5. Under D1 each of them calls
`syncCoinsFromLedger`.
- **The standalone Finalize** (`POST /world/:showId/episodes/:episodeId/finalize-financials`,
  `finalizeEpisodeFinancials`): writes ledger rows and a
  `character_state_history` row carrying the ledger balance. It does not touch
  `coins`.
- **`checkMilestones`** (FTS): writes `reward` rows. It is reached from
  finalize, after `summary` is computed, so `coinDeltaFrom` never counts it.
- **ECS `event_reward`**: a ledger row. `coinDeltaFrom` does not include it.
- **`POST /shows/:id/seed-balance`**: writes the `seed` row. With
  `force: true` it first soft-deletes the old `seed` rows.

---

## 4. Every reader of `character_state.coins`

### 4.1 The readers (MEASURED)

| Reader | Route or caller | What it does with coins |
|---|---|---|
| ECS `completeEpisode` step 4 (`LALA_STATE_SQL`) | `POST /world/:showId/episodes/:episodeId/complete`, `POST /episodes/:id/accept` | `currentStats.coins`: feeds `evaluate` and the step-10c refusal check. It is read **outside** the transaction. |
| `routes/wardrobe.js` `/select`, `/lock-outfit-atomic`, `/purchase` | same | Fast refusal before the transaction. `coins_after` in the response is what `EpisodeWardrobeGameplay` shows. |
| `loadDisplayCharacterState` (`outfitScoreContext.js`) | `/wardrobe/outfit-score/:episodeId` | Passed to the scorer, which reads stress and reputation. Its comment says coins is unused; not read in full. |
| `GET /characters/:key/state` (`routes/evaluation.js`) | EpisodeDetail → EpisodeWardrobeGameplay, WorldAdmin, EvaluateEpisode, ProductionTab, QuickEpisodeCreator | The displayed "coins" |
| `POST /episodes/:id/evaluate` (deprecated) | EvaluateEpisode | Evaluation input |
| `POST /episodes/:id/generate-beats` (`routes/episodes.js`) | scriptSkeletonGenerator | `isBroke` and narration text |
| `POST /world/:showId/events/:eventId/generate-script` (`worldEvents.js`) | | Script context |
| `GET /world/:showId/events/next-suggestions` (`worldEvents.js`) | NextEventSuggestionsOverlay | `affordable`, and the COINS_CRITICAL/COINS_PRESSURE boosts |
| `POST /world/:showId/goals`, `/goals/sync` (`careerGoals.js`) | | Coin goals' `current_value` |
| `GET /world/:showId/suggest-events` (`careerGoals.js`) | WorldAdmin | `coins_min` requirement check, and the response |
| `generateEpisodeFromEvent` (`episodeGeneratorService.js`) | generate/regenerate episode | Affordability warning |
| `loadScriptContext` (`episodeScriptWriterService.js`) | script writer | Prompt text ("use the exact coin number") |
| `getWardrobeIntelligence` (`wardrobeIntelligenceService.js`) | script writer | `financialPressure.balance` |
| CBG `changeCoins` (failure path) | | `have` in `InsufficientCoinsError` |

**The ledger readers** (`getCurrentBalance` or their own sum) are listed for
completeness. D1 leaves them as they are:
- `/world/:showId/balance`, `/affordability`, `/financial-pressure`,
  `/financial-forecast` and `/financial-ledger`;
- `shows.js` `/financial-config`, `/financial-summary`,
  `/financial-breakdowns` and `/financial-suggestions`.

The UI shows both stores. StudioTab and ShowInsightsTab read the ledger. The
EpisodeDetail wardrobe game, WorldAdmin and EvaluateEpisode read the cache.
That is why a gap shows up to a person as "two different numbers".

### 4.2 Which `lala` row a reader gets

MEASURED. The readers pick the row three ways:
- `LIMIT 1` with no `ORDER BY`: `LALA_STATE_SQL`, `worldEvents.js`,
  `episodeGeneratorService`, the script writer, `wardrobeIntelligenceService`,
  and the `findOne` calls in `episodes.js` and `careerGoals.js`;
- `ORDER BY updated_at DESC`: the wardrobe routes;
- `season_id DESC NULLS LAST`: `getOrCreateCharacterState`.

Where a show has more than one `lala` row, these can disagree.

**PROPOSED:** `syncCoinsFromLedger` writes the same ledger balance to **every**
`lala` row of the show. The ledger has no season, so there is no other number
to give them. Readers then agree on coins whichever row they pick. §8's Q-D
counts the shows this affects. Unifying the row choice for the other stats is
outside D1.

---

## 5. Why the two drift today

Each item is MEASURED from the code. Whether it has happened in production is
what §8 reads.

| # | Source | Ledger | Cache |
|---|---|---|---|
| a | **Starting balance.** A new show's cache row starts at 500. The ledger starts at 1900 (or the show's `starting_balance`). | 1900 | 500 |
| b | **No `seed` row.** The wardrobe spends write into an unseeded ledger, whose sum then starts at `−cost` and not at the starting balance. | starting balance missing | unaffected |
| c | **`event_reward`** (ECS) is in the ledger, not in `coinDeltaFrom`. | + reward | nothing |
| d | **Milestone payouts** (`checkMilestones`) are in the ledger, not in `coinDeltaFrom`. | + payout | nothing |
| e | **A standalone Finalize before Complete** (the register note §3.3). Complete then sees `already_finalized` with no `summary`. | + finalize net | tier reward and paid bonus only |
| f | **The admin reset** sets the cache to 500 and leaves the ledger alone. | unchanged | 500 |
| g | **A manual edit of a non-`lala` key** moves the show-wide ledger by that key's difference. | moves | the `lala` row does not |
| h | **Rounding.** A fractional ledger amount has no integer home. | `DECIMAL` | `INTEGER` |
| i | **History before the dual writes.** Coins written before the ledger existed (the probe's third case, register note §2.2). | absent | present |

---

## 6. The design (PROPOSED)

### 6.1 `syncCoinsFromLedger(sequelize, showId, { transaction })`

A new function in a new file, `src/services/coinLedgerSync.js`. It is kept out
of FTS so unit tests that mock FTS still get the real function, the same
reason `withTransaction` has its own file. It requires a transaction and
throws without one.

1. **Lock.**
   `SELECT id FROM character_state WHERE show_id = :showId AND character_key = 'lala' ORDER BY id FOR UPDATE`.
   The `ORDER BY id` gives every caller the same lock order across a show's
   rows.
2. **Ensure the seed.** If the show's ledger has no executed, live `seed` row,
   insert one for `getStartingBalance`, in this transaction. The seed is part
   of the balance, so it must commit or roll back with the rows it balances.
   `seedStartingBalance` gains a `transaction` option for this. It stays
   idempotent.
3. **Sum the ledger.** Use `getCurrentBalance`'s exact SQL, in the
   transaction, with no fallbacks: an error throws and rolls back, and never
   falls back to a guessed number.
4. **Write.**
   `UPDATE character_state SET coins = :balance, updated_at = NOW() WHERE show_id = :showId AND character_key = 'lala'`.
   The value is `ROUND(balance)` (QUESTION Q7).
5. **Return** `{ balance, rows_updated }`.

If the show has no `lala` row, step 4 updates nothing. The seed paths (§6.6)
create the row first, so this only happens for a show that never had one.

**Lock order.** D2 locks the episode row, then (under this design) the `lala`
rows. The wardrobe routes lock only the `lala` rows. Nothing locks `lala`
before an episode, so the order cannot cycle. The implementation PR checks
this against every caller.

### 6.2 The spend check moves to the ledger

Today CBG `changeCoins` refuses a spend with
`WHERE coins + :delta >= 0` on the cache.

**PROPOSED:** `spendFromLedger(sequelize, { showId, cost, transaction, action })`,
in the same new file:
1. `syncCoinsFromLedger` steps 1–3: lock, seed, sum.
2. If `balance − cost < 0`, throw `InsufficientCoinsError` with
   `have: balance`, keeping today's 400 body (`insufficientCoinsBody`), and
   write nothing.
3. The caller writes its ledger row or rows.
4. The caller calls `syncCoinsFromLedger`. The second lock is a no-op in the
   same transaction.

The lock on the `lala` rows serializes two spends on one show. That is the
job `coins + :delta >= 0` does today. It now protects the ledger, which D1
makes the balance. `changeCoins` and `spendCoins` are then unused for coins.
The implementation PR removes them, or keeps `changeCoins` only for the other
stats' `extraSet`.

### 6.3 The recompute point inside D2's transaction (Complete and Finalize)

**Complete** (ECS, the "10c–15" transaction):
- **10c, the refusal.** Today it compares the dry-run delta with
  `currentStats.coins`, read before the transaction. **PROPOSED:** drop the
  preview comparison. After step 11's ledger rows (finalize, `tier_reward`,
  `tier_paid_bonus`, `event_reward`), call `syncCoinsFromLedger`. If the
  balance it returns is below zero, throw `InsufficientCoinsError`, and the
  transaction rolls back every row. The check is then exact: it covers the
  milestones and the event reward, which the preview does not see, and it
  reads the balance under the lock.
- **Step 12.** `changeCoins` keeps writing reputation, brand trust,
  influence, stress and `last_applied_episode_id` through `extraSet`, with
  delta 0. `newState.coins` is the synced balance.
- **Step 13's history row.** `state_after_json.coins` is the synced balance.
  `deltas_json.coins` is that balance minus the balance before step 11, read
  under the lock at the start of the transaction. That is the true coin
  movement of the completion, including a standalone finalize's net if it
  ran first (§5e).
- **`currentStats.coins` for `evaluate`** stays as read in step 4. It is an
  input to scoring, not the balance written.

**Finalize** (`finalizeEpisodeFinancials`, when it is not a dry run):
- After its last ledger row, including the milestones, it calls
  `syncCoinsFromLedger` in its transaction.
- When Complete calls it, Complete syncs again after its own rows. Both run
  in one transaction, so the second sync supersedes the first.
- When it runs alone, the cache now moves with the ledger. That closes §5e,
  the gap the register note §3.3 recorded.
- **Its history row** (`{ coins: netProfit }` / `{ coins: <balance> }`) then
  agrees with the cache.

**Idempotency (D2).** A retry of Complete finds `accepted` under the episode
lock and writes nothing. A retry of Finalize finds the episode already
finalized and books nothing. Syncing again after nothing is booked writes the
same number. Syncing is idempotent by construction: a recompute, not a delta.

### 6.4 The wardrobe spends (W3–W5)

Each one:
1. opens its transaction;
2. calls `spendFromLedger` with the full cost;
3. writes its ledger row or rows (unchanged);
4. calls `syncCoinsFromLedger` and returns its balance as `coins_after`.

The early refusal before the transaction can stay as a fast path. It is
advisory, and the check under the lock decides.

`logTransaction`'s `balance_before`/`balance_after` are computed today from
`getCurrentBalance` read **outside** the transaction. They move inside, from
the locked sum. They are display fields on the row and are not summed.

### 6.5 The manual edit (W6) and the admin reset (W7)

**Manual edit, `lala`.** In one transaction:
1. lock and seed (§6.1 steps 1–2);
2. read the ledger balance;
3. write `manual_adjustment` for `requested − balance`;
4. sync.

The absolute SET of coins goes. The other stats keep their SET. The history
row keeps its shape. The coins it records are the synced balance, which
equals the requested value.

**Manual edit, another key** and **the admin reset**: QUESTIONS Q3 and Q5.

### 6.6 Seeding a new `lala` row (W2, W8)

Both seed paths create the row and then call `syncCoinsFromLedger` in the
same transaction, so a new row starts at the ledger balance and not at 500.
- W8 is reached from `GET /characters/:key/state`, so a read can create a
  row. This makes that read also write the seed. QUESTION Q1 settles which
  starting balance the ledger seeds.
- W2 runs before D2's transaction today. It moves inside it.

### 6.7 What stays as it is

- Every reader in §4.1.
- The ledger's schema. **No migration is needed for the steady state.**
- `getCurrentBalance` and its callers.
- `evaluate` and `applyDeltas`'s coin arithmetic. `applyDeltas`'s coin result
  is overwritten, as it is today.

---

## 7. Decisions for Evoni (QUESTION)

| # | Question | Why it matters | Session's recommendation |
|---|---|---|---|
| Q1 | **Lala's starting balance: 1900 or 500?** | The ledger seeds 1900 (or `shows.metadata.starting_balance`). The cache seeds 500. Under D1 the ledger's number wins for every new show. | 1900 through `getStartingBalance`: it is already the ledger's number, and it can be set per show. Change the 500 defaults to match, or leave them, since the sync overwrites them. |
| Q2 | **In the one-time reconciliation, do unseeded ledgers get a `seed` row?** | Without one, D1 sets such a show's coins to the plain sum, which leaves out the starting balance (§5b). | Yes: seed first, then sync. The same rule applies from then on (§6.1 step 2). |
| Q3 | **Coins for keys other than `lala`?** | The ledger is show-wide. A coin edit on another key moves Lala's ledger (§5g). | Coins are Lala's only. The manual edit refuses a coin change for any other key (400), and its other stats are still editable. |
| Q4 | **Several `lala` rows per show** | They can hold different coins today (§4.2). | Sync writes the same balance to all of them (§4.2). |
| Q5 | **The admin reset** (`/admin/reset-character-stats`) | It sets the cache to 500 and leaves the ledger alone (§5f). Under D1 the next sync undoes it. | Either it stops touching coins, or it resets the ledger too (soft-delete the show's ledger rows, re-seed, sync). The second is a larger, destructive action. Recommended: **stop touching coins**, and name a separate ledger reset if one is wanted. |
| Q6 | **Should a standalone Finalize refuse to go below zero,** as Complete does? | Today it floors its logged `balance_after` at 0 and books anyway. | Yes, the same refusal and 400 as Complete, so no path leaves the ledger negative. |
| Q7 | **Rounding** | The ledger is `DECIMAL(10,2)`; coins is `INTEGER`. | `ROUND` (half away from zero). §8's Q-E shows whether any fractional amounts exist. |

---

## 8. The one-time reconciliation

### 8.1 Step 1: Evoni runs a read-only query in production

**For Evoni to run herself.** The session does not connect to RDS. The block
opens a `READ ONLY` transaction and ends with `ROLLBACK`, so no statement in
it can write. Paste the five results back. Hostnames, users and credentials
are not needed in the paste.

```sql
BEGIN TRANSACTION READ ONLY;

-- Q-A. Per 'lala' row: the cache against the ledger balance, largest gap first.
-- ledger_balance follows getCurrentBalance: an empty ledger reports the
-- starting balance; otherwise the plain sum of executed, live rows.
-- starting_balance follows getStartingBalance approximately: a numeric
-- shows.metadata.starting_balance >= 0, else 1900.
SELECT * FROM (
  WITH ledger AS (
    SELECT show_id,
           COUNT(*)                                                           AS tx_count,
           COUNT(*) FILTER (WHERE category = 'seed')                          AS seed_rows,
           COUNT(*) FILTER (WHERE type NOT IN ('income','reward','expense','deduction')) AS uncounted_rows,
           COALESCE(SUM(amount) FILTER (WHERE type IN ('income','reward')), 0)
         - COALESCE(SUM(amount) FILTER (WHERE type IN ('expense','deduction')), 0) AS ledger_sum
      FROM financial_transactions
     WHERE status = 'executed' AND deleted_at IS NULL
     GROUP BY show_id
  ),
  start AS (
    SELECT id AS show_id,
           deleted_at IS NOT NULL AS show_deleted,
           CASE WHEN (metadata->>'starting_balance') ~ '^\s*[0-9]+(\.[0-9]+)?\s*$'
                THEN (metadata->>'starting_balance')::numeric
                ELSE 1900 END AS starting_balance
      FROM shows
  )
  SELECT cs.show_id,
         s.show_deleted,
         cs.id              AS state_id,
         cs.season_id,
         cs.updated_at,
         cs.coins           AS cache_coins,
         COALESCE(l.tx_count, 0)       AS tx_count,
         COALESCE(l.seed_rows, 0)      AS seed_rows,
         COALESCE(l.uncounted_rows, 0) AS uncounted_rows,
         s.starting_balance,
         CASE WHEN COALESCE(l.tx_count, 0) = 0 THEN s.starting_balance ELSE l.ledger_sum END AS ledger_balance,
         cs.coins - CASE WHEN COALESCE(l.tx_count, 0) = 0 THEN s.starting_balance ELSE l.ledger_sum END AS gap
    FROM character_state cs
    LEFT JOIN ledger l ON l.show_id = cs.show_id
    LEFT JOIN start  s ON s.show_id = cs.show_id
   WHERE cs.character_key = 'lala'
) q
ORDER BY ABS(gap) DESC NULLS FIRST, show_id;

-- Q-B. The ledger by category, to attribute each gap (§5).
SELECT show_id, category, type, COUNT(*) AS n, SUM(amount) AS total
  FROM financial_transactions
 WHERE status = 'executed' AND deleted_at IS NULL
 GROUP BY show_id, category, type
 ORDER BY show_id, category, type;

-- Q-C. Episodes with ledger money but not completed (§5e): finalized alone.
-- The outfit lock's rows are left out; the lock moved the cache as well.
SELECT e.show_id, e.id AS episode_id, e.episode_number, e.evaluation_status,
       COUNT(*) AS ledger_rows,
       COALESCE(SUM(ft.amount) FILTER (WHERE ft.type IN ('income','reward')), 0)
     - COALESCE(SUM(ft.amount) FILTER (WHERE ft.type IN ('expense','deduction')), 0) AS ledger_net
  FROM episodes e
  JOIN financial_transactions ft
    ON ft.episode_id = e.id AND ft.status = 'executed' AND ft.deleted_at IS NULL
   AND COALESCE(ft.metadata->>'flow', '') <> 'lock_outfit'
 WHERE e.deleted_at IS NULL
   AND e.evaluation_status IS DISTINCT FROM 'accepted'
 GROUP BY e.show_id, e.id, e.episode_number, e.evaluation_status
 ORDER BY e.show_id, e.episode_number;

-- Q-D. Shows with more than one 'lala' row, and any other key holding coins (Q3, Q4).
SELECT show_id, character_key, COUNT(*) AS state_rows, MIN(coins) AS min_coins, MAX(coins) AS max_coins
  FROM character_state
 GROUP BY show_id, character_key
HAVING character_key <> 'lala' OR COUNT(*) > 1
 ORDER BY show_id, character_key;

-- Q-E. Fractional ledger amounts (Q7).
SELECT show_id, COUNT(*) AS fractional_rows, SUM(amount - TRUNC(amount)) AS fractional_total
  FROM financial_transactions
 WHERE status = 'executed' AND deleted_at IS NULL AND amount <> TRUNC(amount)
 GROUP BY show_id;

ROLLBACK;
```

**What each result settles:**
- **Q-A:** where the stores disagree, and by how much. A row with
  `tx_count = 0` is the §5a case. A row with `tx_count > 0` and
  `seed_rows = 0` is the §5b case (Q2).
- **Q-B:** splits each gap into seed, `event_reward`, milestone and
  `manual_adjustment` amounts (§5c, §5d, §5g).
- **Q-C:** the §5e episodes.
- **Q-D:** answers Q3 and Q4 against real data.
- **Q-E:** answers Q7.

### 8.2 Step 2: the gap is recorded

The session records the pasted output as a register note, with the output
verbatim and ATTESTED, before any fix is designed.

### 8.3 Step 3: the fix for existing rows (outline only; designed after 8.2)

The expected shape, subject to Evoni's rulings on Q1, Q2 and Q5:
1. Seed the unseeded ledgers (Q2).
2. Set every `lala` row's coins to its show's ledger balance, which is the
   same statement as `syncCoinsFromLedger` step 4.

It is a write, so it ships as a migration or an admin-only action. The choice
is made with the design, and Evoni deploys it. It must run **after** the D1
code is live, or a spend in between can open the gap again. Its test is Q-A
run again showing `gap = 0` on every row.

---

## 9. Tests

All run against the local test database only (`episode_metadata_test`).

**A shared assertion.** `expectCoinsMatchLedger(showId)`: every `lala` row's
coins equals `ROUND(getCurrentBalance)`. Every integration test below ends
with it.

**Unit** (`tests/unit/services/coinLedgerSync.test.js`):
- Sync with no transaction throws.
- Sync writes `ROUND(sum)` to every `lala` row of the show and to no other
  key.
- An unseeded ledger gets one `seed` row. A second sync adds none.
- A sum error throws and never falls back.
- `spendFromLedger` refuses at `balance − cost < 0` with the existing 400
  body, and writes nothing.

**Integration** (`tests/integration/coinLedgerSync.integration.test.js`, plus
additions to the existing money tests):

| Case | Expectation |
|---|---|
| Complete, slay, with an `event_reward` and a milestone crossed | coins = ledger; both credits reach the cache (§5c, §5d) |
| Finalize alone, then Complete (§5e) | after Finalize, coins = ledger; after Complete, coins = ledger; no double booking (D2's tests still pass) |
| Finalize twice, Complete twice | ledger rows booked once; coins move once; this is the post-deploy money check, in code |
| Complete that would go below zero | 400 `INSUFFICIENT_COINS`; no ledger row, no history row, `accepted` not set, coins unchanged |
| Complete fails after the ledger rows (injected error) | everything rolls back; coins = ledger = before |
| Each wardrobe spend: select, lock-outfit, purchase | coins = ledger; `coins_after` = ledger |
| Two concurrent purchases that together exceed the balance | exactly one succeeds; coins = ledger ≥ 0 |
| A purchase concurrent with a Complete on the same show | both serialize on the `lala` lock; coins = ledger |
| Manual edit of `lala` coins | ledger has one `manual_adjustment` for the difference; coins = requested = ledger |
| Manual edit of another key's coins (per Q3) | 400; ledger unchanged |
| Admin reset (per Q5) | per the ruling; coins = ledger |
| `GET /characters/lala/state` on a show with no row | row created; coins = ledger balance, seeded per Q1 |
| A show with two `lala` rows (null season) | both rows hold the ledger balance after any writer |
| Fractional ledger amount (per Q7) | coins = the ruled rounding |

**Tests that change** (they pin today's delta behaviour):
- `tests/unit/routes/coin-spend-guard.test.js`
- `tests/unit/services/episodeCompletionService.coins.test.js`
- `tests/integration/wardrobe-money.integration.test.js`
- `tests/integration/finalizeCompleteTransaction.integration.test.js`
- `tests/integration/lockOutfitFinalize.integration.test.js`
- `tests/integration/financialBalance.integration.test.js`

Each is rewritten to the D1 expectation in the PR that changes its writer,
and the PR says so. No test is skipped or removed to get green.

---

## 10. Proposed build order (after approval)

One PR each, stopping before each push:
1. `coinLedgerSync.js` (`syncCoinsFromLedger`, `spendFromLedger`), the
   `transaction` option on `seedStartingBalance`, and the unit tests. Nothing
   calls them yet.
2. Complete and Finalize (§6.3). This is the D2 transaction.
3. The three wardrobe spends (§6.4).
4. The manual edit, the admin reset and the seed paths (§6.5, §6.6), per Q3,
   Q5 and Q1.
5. The one-time fix for existing rows (§8.3), designed after Evoni's paste
   and rulings.

Evoni deploys items 2–4 together, or in order. Item 5 comes after them.

---

## What this note does not do

- It changes no code, and writes no migration and no test.
- It runs no query against any shared database. §8's SQL is for Evoni.
- It rules nothing. §7 holds the decisions, with recommendations only.
- It edits nothing under `docs/audit/`.
