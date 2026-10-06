# Read: why Locked pieces won't unlock with enough coins

Date: 2026-10-06. Basis: `f5a7cea527d059fed5cedb72421a8390b58b95fc` (origin/main, #2648). Read-only: no code, register, host, AWS, database or Cognito contact. Citations are `file:line` at that SHA.

## What was seen

Episode → Production → Wardrobe. A piece that is not owned opens the item modal with the box **🔒 Locked** and no button. Lala's balance covers the piece's coin figure. The modal also shows **Match Score 0/60** and an empty **LALA SAYS ""**.

## Summary

1. **Lala's coins are not the problem.** The game and `/purchase` both read the same ledger balance.
2. **The bare "Locked" box means the piece is unowned and *not coin-locked*.** Its `lock_type` is `none` or null, or a value the game doesn't know. Those pieces have no route to Lala at all:
   - the modal offers no button;
   - `/purchase` refuses any lock that isn't `coin`.
   They still carry a coin figure, because the server sets `coin_cost` from `price` on every upload and edit, whatever the lock. So the piece reads as "costs N, Lala has more than N" and still can't be bought.
3. **0/60 and the empty quote mean the piece came from the Full Closet or Search tab, not For This Event.** Only `browse-pool` scores items and writes Lala's line. The closet loader sets `match_score: 0` and no `lala_reaction`.

## 1. The Locked state

**Server reach rule.** `src/services/wardrobeReach.js:42-57` (`itemReach`) decides whether a piece is within Lala's reach. It is, when it is:
- owned (`is_owned === true`; null is not owned), or
- coin-locked (`lock_type === 'coin'`) and `coins >= coin_cost`, or
- reputation-locked and `reputation >= reputation_required`.

Anything else is out of reach with `can_purchase: false`. That covers an unowned `lock_type 'none'` piece, `brand_exclusive`, `season_drop`, and the `dream_fund` and `influence` values the game-layer migration lists (`src/migrations/20260219000006-wardrobe-game-layer.js:31`).

**Frontend mirror.** `frontend/src/utils/wardrobeReach.js:22-44` (`itemReach`, `withReach`) mirrors the rule for the Closet and Search tabs. It is applied in `EpisodeWardrobeGameplay.jsx:308` (`closetWithReach`).

**The modal** is the INSPECT MODAL in `frontend/src/components/EpisodeWardrobeGameplay.jsx:1024-1070`:
- `:1052` shows ✨ Equip only when `can_select` is true.
- `:1055` shows 🪙 Buy only when `can_purchase` is true.
- `:1061-1066` shows the 🔒 box otherwise. It reads `Rep N+`, `Brand Exclusive`, `Drops Ep N`, `Need N coins` (coin-locked but short), or a bare **`Locked`** (`:1066`) when `lock_type` is none of those four.

So a bare "Locked" with enough coins is never a balance problem. It means `lock_type` is not `coin`.

**How pieces end up unowned and not coin-locked:**
- **Old rows.** The game-layer migration added `lock_type` defaulting to `'none'` and `is_owned` defaulting to `false` (`20260219000006-wardrobe-game-layer.js:28-42`; the model has the same defaults in `src/models/Wardrobe.js:250-267`). Every row from before it became unowned with no lock.
- **Uploads before #2613.** Before #2613 (2026-10-05), an upload with no lock was saved unowned. `wardrobeController.createWardrobeItem` now makes a lock-free upload owned (`src/controllers/wardrobeController.js:252-256`), but nothing backfilled the rows saved before the fix.
- **Edits.** `wardrobeController.updateWardrobeItem` passes `lock_type` and `is_owned` through independently (`wardrobeController.js:730-732`). An edit can therefore leave `lock_type 'none'` with Owned unticked. The WorldAdmin edit form's Lock Type select doesn't touch Owned (the `wf.lock_type` select in `WorldAdmin.jsx`); the upload form's select does.

**Where the "enough coins" impression comes from:**
- `createWardrobeItem` sets `coin_cost = price × USD_TO_COINS` when no coin cost is given (`wardrobeController.js:226-231`), whatever the lock type.
- `updateWardrobeItem` does the same when the price changes (`:750-759`).
- `POST /wardrobe/bulk/sync-coin-costs` backfills every priced row the same way (`src/routes/wardrobe.js:585-618`).

A `none`-locked, unowned piece therefore shows a coin figure Lala can afford, but no path uses it.

## 2. Purchase

`POST /api/v1/wardrobe/purchase`, `src/routes/wardrobe.js:1909-2034`. The game calls it from `purchaseItem` (`EpisodeWardrobeGameplay.jsx:527-531`) with `{ wardrobe_id, show_id, episode_id }`.

1. `:1928` returns already-owned if `is_owned`.
2. `:1929` refuses with **400 `Cannot purchase — lock type is <x>`** unless `lock_type === 'coin'`. This is the server half of the bug: even with a Buy button, a `none`-locked piece could not be bought.
3. `:1934` reads Lala's coins as the **ledger balance**, via `getCurrentBalance(models.sequelize, show_id)` (`src/services/financialTransactionService.js:53-79`). It does not read `character_state.coins`. `:1937` compares it with `item.coin_cost || 0`.
4. `:1958` re-checks under the show lock with `spendFromLedger` (`src/services/coinLedgerSync.js:102-107`). It writes the ledger row, then `syncCoinsFromLedger` copies the balance into `character_state.coins` for `character_key = 'lala'` (`coinLedgerSync.js:82-92`).

**The game's coins come from the same balance.**
- `EpisodeDetail.fetchCharState` loads `GET /characters/lala/state` (`EpisodeDetail.jsx:325-330`).
- That route replaces `character_state.coins` with `getCurrentBalance` for `lala` (`src/routes/evaluation.js:229-234`).
- The game uses `characterState.coins` (`EpisodeWardrobeGameplay.jsx:115`).

So the pool, the closet's reach and `/purchase` agree on Lala's balance. No coins mismatch is involved.

**Register names, by name only:**
- **F-Stats-1 D1 (PR 4 era).** The ledger-as-truth read above is the D1 rule ("Lala's coins are the ledger balance"). `/purchase`'s item read is a hand-written `deleted_at IS NULL` query (`:1922-1925`), the predicate shape the F-Stats-1 inventories track. Neither causes this bug.
- **F-Sec-3 (character_state / characterKey surface).** `/purchase`'s history write uses a literal `'lala'` key. It falls back to `source 'manual'` when the first insert fails (`:1990-2020`), which is a drift candidate on that surface. It runs after the sale and does not affect it.

## 3. Match Score 0/60 and the empty "Lala says"

- The modal shows `inspecting.match_score/60` (`:1039`), the `match_reasons` pills, and `"{inspecting.lala_reaction}"` (`:1050`).
- Only **`POST /wardrobe/browse-pool`** fills those fields (`src/routes/wardrobe.js:1302-1579`). It scores each row (dress code, event type, tier, weight, brand, ownership; `:1375-1455`), writes `lala_reaction` (`:1460-1470`; an unowned piece gets `lala_reaction_locked` or "I can't have this yet..."), and returns `match_score`, `match_reasons`, `can_select` and `can_purchase` (`:1471-1483`).
- The **Full Closet** and **Search** tabs list `GET /api/v1/wardrobe` through `fetchClosetWithTotal`. The loader keeps the row as it is, adds `match_score: 0` (`EpisodeWardrobeGameplay.jsx:278-283`), and adds no `match_reasons` or `lala_reaction`. `withReach` adds only `can_select` and `can_purchase`.
- A closet piece that isn't within reach opens the modal on tap (`:920`), which therefore reads **0/60, no pills, and `""`**.
- The **For This Event** pool only holds the best few pieces plus one locked tease (`wardrobe.js:1486-1545`). Most pieces are only reachable through the Closet tab, so most modals look like this.
- A smaller oddity: the denominator `/60` is fixed. browse-pool scores can go above 60 (30 + 20 + 15 + weight up to 10 + 10 + 5). The bar is capped at 100% (`:1042`), but the number can read e.g. "72/60".

## 4. Proposed fixes, smallest first

1. **Modal copy (frontend, one line).** For an unowned piece with `lock_type 'none'`/null, replace the bare "Locked" with something that says what's wrong, e.g. "Not Lala's yet — set it Owned or give it a coin lock in the Wardrobe". This changes no behaviour, but explains the dead end.
2. **Modal score and line for closet pieces (frontend).** When `match_reasons` is absent, hide the Match Score block. Show `lala_reaction_locked`/`_own` from the row when present, else hide LALA SAYS. Better still, take the score from the pool's entry when the piece is also in `pool`. Alternatively, use the pool's maximum, not 60, as the denominator.
3. **One rule for "no lock" (server, small).** Decide what an unowned `lock_type 'none'` piece is (Evoni's ruling):
   - **(a) Lala's**, matching #2613's upload rule. `itemReach` treats `!owned && (lock_type == null || 'none')` as selectable, in both the server and frontend copies, with the shared test cases.
   - **(b) Buyable**, treating a priced `none` piece like a coin lock. `itemReach` and `/purchase:1929` both accept `none` with `coin_cost > 0`.

   (a) is smaller and matches the upload form's own words, "None (always available)".
4. **Heal the existing rows (data; Evoni runs it).** A new migration under `src/migrations/` (with `deleted_at` respected) sets `is_owned = true` where `lock_type IS NULL OR lock_type = 'none'` and `is_owned IS NOT TRUE`. Or it sets `lock_type = 'coin'` for priced rows, if (b) is chosen. Only one of these is needed with fix 3. Without fix 3, it heals today's rows but not future edits.
5. **Keep the edit form consistent (frontend).** The WorldAdmin edit form's Lock Type select should set Owned when it becomes `none`, as the upload form's select already does. `updateWardrobeItem` could apply the same default as `createWardrobeItem`.
6. **Unknown lock types (server and frontend).** `dream_fund` and `influence` (named in the migration comment) fall through to a bare "Locked" with no rule. Either map them or reject them at save time.

Fix 3(a) with fix 4 resolves what was reported. Fixes 1, 2 and 5 are the UI half.
