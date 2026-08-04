# F-Stats-1 Fix Plan v1.17

## What changed in v1.17

- **§19 RESTATED COMPLETE:** **PR 4 CLOSED at 6 of 6.** v1.16 recorded 3 of 6.
  All six PRs merged in the §15 order without deviation.
- **§15 AMENDED again:** **unit 19 WITHDRAWN.** Reconciliation re-cut to
  **23 of 25 allocated**. 4d drops from 3 units to 2.
- **Open item 19 RESOLVED** at 4c execution, as §15 required. `.increment()`
  is unsafe on `times_worn`; `sequelize.literal` with `COALESCE` is required.
- **§12.39 EXTENDED to four handlers.** v1.16 recorded three.
- **§20 (new):** two register overstatements found by execution. §15's unit 34
  gate and Decision #22's placement of units 23 and 24 both describe
  transaction coupling that the code does not carry.
- **Open item 29 CLOSED** by withdrawal, not by conversion.
- **Open item 6 is nine merges old** and unchanged.
- **Open items 31, 32, 33** — three pre-existing defects surfaced by
  derivation and preserved verbatim through conversion.
- **§11:** v1.17 row added.
- Basis: `9f57b1fe`. Mints no FD.

Written **after** PR 4 closed. §19 records outcomes, not predictions.

---

## §19 RESTATED — PR 4 execution record, CLOSED

Per §15's six-way split and Decision #26. Ordering constraint
**4a -> 4b -> 4e -> 4f -> 4c -> 4d** held without deviation. Currency paths
shipped last as designed; `/purchase` shipped alone and last.

| PR | Handlers | Units | Merged at |
|---|---|---|---|
| **4a** | `POST /seed` | 8, 9, 10 | `7eb81b77` (#971) |
| **4b** | `GET /:id/pieces`, `POST /:id/pieces`, `DELETE /:id/pieces/:pieceId`, `PUT /:id/set` | 27-33 | `467f94cd` (#974) |
| **4e** | `POST /browse-pool`, `GET /outfit/:episode_id` | 4, 11, 12 | `d5746ca7` (#975) |
| **4f** | `GET /categories-audit`, `POST /bulk/sync-coin-costs`, `POST /:showId/auto-tag-event-types` | 1, 6, 7, 34 | `b630fed7` (#977) |
| **4c** | `POST /select` | 13, 14, 16, 18 | `ac80a5ce` (#978) |
| **4d** | `POST /purchase` | 20, 22 | `9f57b1fe` (#979) |

**Shipped: 23 units across 6 PRs. Withdrawn from allocation: units 25 and 19.**

### Gate outcomes

- **4a / 4b** — Decision #25's two §12.34 shapes verified verbatim. `.destroy()`
  on unit 8, `.update({ deleted_at })` on unit 32. Not reviewed as one
  operation.
- **4e** — both §12.38 directions live in one PR. Unit 11 converted and
  reviewed in isolation from units 4, 12. `WorldEvent` verified as carrying
  `paranoid: true` and no other scope, so `.unscoped()` strips only the
  soft-delete predicate.
- **4f** — unit 34's gate resolved by reading: it carries no `transaction: t`
  and sits before the dry-run block entirely. Did not withdraw. See §20.
- **4c** — open item 19 resolved. See below.
- **4d** — unit 19 withdrawn. See §15 amendment below.

### The `.unscoped()` question was answered twice, oppositely

Unit 11 (4e) and units 14 and 20 (4c, 4d) present the same surface shape: a
raw `character_state` or `world_events` read with no `deleted_at` predicate.

- **`WorldEvent` is paranoid** -> a plain `findOne` appends a predicate that
  the raw query did not carry -> **`.unscoped()` mandatory.**
- **`CharacterState` is not paranoid** -> it declares `tableName`,
  `underscored`, `timestamps` and no `paranoid` -> **plain `findOne`
  correct, `.unscoped()` would be wrong.**

Recorded because the two look identical at the call site and diverge only at
the model declaration. The check is per-model, never by pattern.

---

## Open item 19 RESOLVED — `literal`, not `.increment()`

§15 assigned this to 4c at execution and required verification rather than
assumption. Resolved by reading `models/Wardrobe.js` on `origin/main`.

`times_worn` is declared `allowNull: true` with `defaultValue: 0`. The default
applies **only on insert through Sequelize**. Rows created by raw SQL or by a
migration backfill can hold NULL.

On a NULL row, `.increment()` computes `NULL + 1 = NULL` and **silently
destroys the wear count**. `COALESCE(times_worn, 0) + 1` yields 1.

**Shipped shape:**

```js
{ times_worn: models.sequelize.literal('COALESCE(times_worn, 0) + 1') }
```

`.increment()` is unsafe on any nullable integer column. This generalizes
beyond unit 18 and applies to `worldEvents.js` conversion.

**Open item 31 (new):** `Wardrobe.prototype.incrementWearCount` performs
`this.times_worn += 1`, which survives NULL only because JS coerces
`null + 1` to `1`. It works by accident and would produce `NaN` on
`undefined`. Not a §14 unit and not touched by PR 4.

---

## §15 AMENDED — unit 19 withdrawn

Unit 19 (`POST /purchase`, `wardrobe.js:1333`) is **WITHDRAWN**. Its §14
disposition read *Convert - explicit `deleted_at`*.

It is `SELECT * FROM wardrobe` and its result is spread into the response
body at `item: { ...item, is_owned: true }`. Converting to `findOne` narrows
the projection to model-declared attributes, so **any table column the model
does not declare would silently vanish from the API response on the purchase
path**.

Closing that risk requires the real column list. It is **not derivable from
committed files with confidence**:

- Sixteen files touch `wardrobe` columns, across **three** migration
directories: `migrations/`, `src/migrations/`, `scripts/migrations/`.
- Four are dated **2026-08-03**. One of those,
`20260803000003-wardrobe-drop-tap-zones-display-price`, **drops** columns.
- There is no single authoritative migration path and no guarantee which
files actually ran.
- Per §12.40 and open item 21, no runtime coverage would catch a dropped
response field.

`20260220000001-add-wardrobe-missing-columns` establishes that the historical
drift ran **model ahead of table** — its docstring states the model defined
columns the DB lacked, and it added 16 columns to close the gap. That
direction is the safe one for narrowing. But it is evidence about one
migration, not proof about the current table.

Withdrawn rather than deferred, on the same reasoning as unit 25 at v1.16:
the finding is determinate, and a deferral leaves a unit with no disposition
for a future session to rediscover.

**Open item 32 (new):** unit 19 converts against a live `information_schema`
read when database access is restored. A local connection attempt during 4f
failed on `password authentication failed for user "postgres"`; local `.env`
credentials are stale.

### Reconciliation re-cut (mandatory per §15)

**3 + 7 + 4 + 4 + 3 + 2 = 23 of 25 allocated.**

Units 25 and 19 withdrawn. No unit in two PRs.

### Open item 29 CLOSED

Raised at v1.16 as the `SELECT *` -> `findAll()` narrowing risk. Disposition
across PR 4:

- Unit 12 (4e) — six consumed columns verified declared. Converted.
- Units 6, 34 (4f) — explicit column lists, not `SELECT *`. No risk.
- Unit 19 (4d) — **withdrawn.** The risk could not be closed.

Closed by withdrawal, not by conversion. It re-opens for `worldEvents.js`.

---

## §12.39 EXTENDED — four mixed handlers

v1.16 recorded three. There are four.

| Handler | Converted | Stays raw | Why |
|---|---|---|---|
| `/select` | 13, 14, 16, 18 | 15, 17 | Decision #22, #23 |
| `/purchase` | 20, 22 | **19**, 21, 23, 24 | Decision #22, §12.37, **unit 19 withdrawal** |
| `GET /outfit/:episode_id` | 4 | 2, 3 | Decision #23 |
| **`POST /:showId/auto-tag-event-types`** | **34** | **35** | **Decision #22** |

`/purchase`'s row is updated: unit 19 joins its raw column by withdrawal, so
the handler is more mixed than v1.13 anticipated.

### Unit 15's binding bridge

4c produced the first case where a **withdrawn unit's line was modified
without being converted**. Unit 14's conversion stopped returning an array,
so unit 15's raw query changed `states[0].id` to `state.id`. The statement
stayed raw SQL inside its transaction.

4d did **not** require this: unit 21 keys its `UPDATE` on `show_id` and
`character_key` rather than on the read's `id`, so unit 20's conversion
touched nothing downstream.

**Recorded because the withdrawal boundary is not the same as the edit
boundary.** A withdrawn unit can still need its line touched.

---

## §20 — register overstatements found by execution (NEW)

Two locked register statements describe transaction coupling that the code
does not carry. Both were found by reading the code at execution, and in both
cases the disposition survived on other grounds.

**§15's unit 34 gate.** §15 states unit 34 *sits inside a transaction block
whose sibling (unit 35) is withdrawn*, and required confirming it does not
carry `transaction: t`. The read found unit 34 sits **before** the
`if (!dryRun && changed.length > 0)` block entirely — not inside the
transaction at any point. It did not withdraw. 4f stayed at 4 units.

**Decision #22's placement of units 23 and 24.** Decision #22 states units
15, 21, 35 carry `transaction: t` inside transaction blocks, and that units
23 and 24 *sit in the same blocks and also target a modelless table*. The
read found the transaction closes at `wardrobe.js:1386`; units 23 and 24 sit
below it in a separate non-fatal `try`, with 24 nested in 23's `catch` as a
retry. **The withdrawal stands** — §12.37's modelless-table reasoning is
sufficient on its own and does not depend on transaction placement.

**Neither correction changes a disposition.** Both are recorded so a future
session reading the register does not inherit a false structural picture of
`wardrobe.js`. Mints no decision and reverses none.

**Pattern:** a register statement written at inventory time can describe
structure more strongly than the code supports. Inventory reads for
*disposition*; execution reads for *shape*. Where they disagree, the code
wins and the register is corrected additively.

---

## Open items 31-33 (NEW) — pre-existing defects preserved

All three predate PR 4, were surfaced by conversion derivation, and behave
identically before and after. None was introduced and none was fixed —
fixing them was out of scope for a conversion PR.

**31.** `Wardrobe.prototype.incrementWearCount` does `this.times_worn += 1`.
See open item 19's resolution above.

**32.** Unit 19's live column read. See §15 amendment above.

**33.** Two defects on the currency paths:

- **`/select` zero-cost 500.** When `lock_type` is `'coin'` and `coin_cost`
is 0 or null, `cost` is 0. With no `character_state` row, `currentCoins`
is 0, the guard `0 >= 0` passes, and `state.id` throws into the outer
catch as a 500. `states[0].id` threw identically before conversion.
- **`/purchase` read-one, write-many.** Unit 20 reads
`ORDER BY updated_at DESC LIMIT 1` — the newest row only. Unit 21 updates
**every** row matching `show_id` and `character_key`. `character_state`
has no unique constraint, so where duplicates exist the read sees one row
and the write sets all of them to the same `newCoins`. This is the P0
`character_key` drift surfacing on the purchase path.

The second is the more serious. It is F-Stats-2's and F-Sec-3's territory,
not a `wardrobe.js` conversion concern, and is forward-pointed rather than
owned here.

---

## Open item 6 — nine merges old

Unchanged and worth restating plainly. Nothing exercises a request against
any converted handler or compares response bodies. PRs 1, 2, 3, #965, and all
six PR 4 merges have shipped under that condition.

Every conversion in PR 4 was verified by **reading** — model attributes,
scope declarations, association directions, migration history. The reading
caught real problems: unit 25's un-traversable join, unit 19's narrowing
risk, open item 19's NULL divergence, §20's two overstatements. It is not a
weak method.

But 4c and 4d converted money paths, and CI green means only that nothing
broke at load time. It does not mean `POST /select` or `POST /purchase` was
exercised. v1.12 stated open item 6 *should not still be open when F-Stats-1
closes*. It is now the largest unaddressed risk in the keystone.

---

## §11 Plan Version History (UPDATED)

| v1.15 | 2026-08-03 | §17 canon-write scan, clean; §18 infrastructure forward-pointers; open items 25-28. Basis `7eb81b77`. |
| v1.16 | 2026-08-03 | §19 PR 4 execution record (4a, 4b, 4e merged); §15 amended, unit 25 withdrawn, re-cut to 24; §12.39 extended to three handlers; §12.40 corroborated; open items 29, 30. Basis `d5746ca7`. |
| v1.17 | 2026-08-04 | §19 restated complete, PR 4 CLOSED at 6 of 6; §15 amended, unit 19 withdrawn, re-cut to 23; open item 19 RESOLVED; §12.39 extended to four handlers; §20 register overstatements; open item 29 CLOSED; open items 31-33. Basis `9f57b1fe`. |

v1.17 supersedes v1.16 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1-v1.16.
- Mints: §20, open items 31, 32, 33.
- Amends: §15 allocation and reconciliation (unit 19 withdrawn); §19
restated complete.
- Extends: §12.39 to a fourth handler.
- Resolves: open item 19.
- Closes: open item 29 (by withdrawal).
- Corrects: §15's unit 34 gate wording; Decision #22's placement of units
23 and 24. Neither reverses a disposition.
- Forward-points: open item 33's `/purchase` read-one/write-many to F-Stats-2
and F-Sec-3.
- Restates: open item 6, unchanged, now nine merges old.
- No live-database contact. No prod-box contact. No dev-box contact. One
local connection was attempted during 4f and failed on authentication;
no query executed. All conclusions derive from committed files read via
`git show origin/main:`, from `git grep`, and from CI results.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.17 is the plan-of-record. **PR 4 is CLOSED.** `wardrobe.js` is converted
at 23 of 25 allocated units, with units 19 and 25 withdrawn and dispositioned.

**`worldEvents.js` is the next executable surface** and the largest remaining
in F-Stats-1: **112 statements across 48 handlers in 9 groups** per §16, with
§12.42 requiring group-level splitting and §12.38 **inverted** there —
`.unscoped()` is the majority case, not the exception. §16.1 and §16.2 hold
dispositions for Core CRUD and Overlays; seven groups carry forward
un-dispositioned.

Per the standing rule, **no file is inventoried in the same session as its
execution**. §16's inventory exists; execution is a separate session.

Before `worldEvents.js` execution, two items deserve resolution rather than
carry: **open item 6** (no runtime coverage, nine merges old) and **open item
32** (unit 19's live column read, blocked on database credentials).

After F-Stats-1 closes: the fix-cycle continues per the locked register
order, **F-Ward-1 next**.

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-04. Main at `9f57b1fe` (#979). Predecessor: v1.16.*
*Minted: §20, open items 31-33. Amended: §15, §19. Extended: §12.39. Resolved: open item 19. Closed: open item 29. No FD numbers. [skip-automerge]*