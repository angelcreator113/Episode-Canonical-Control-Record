# Read: which owned wardrobe pieces were only auto-owned

Date: 2026-10-14. Basis: `1c0400525feaa6a3451870453e88d8f9da26159b` (origin/main, #3146). Read-only: no code, register, host, AWS, database or Cognito contact. Citations are `file:line` at that SHA. Each claim is **MEASURED** (read in code or git history) or **INFERRED**. Task #3145.

## Why

Evoni's ruling (2026-10-14, bug 8):
- **The ruling:** option (b), and "every wardrobe piece that I upload should need purchased".
- **Existing data:** pieces owned **only** because the old upload rule marked them owned are to be un-owned. Pieces Lala actually bought, gifts and the starter basics stay owned.
- **The code half** shipped in #3146.

This read says how to tell those pieces apart, and what can't be told apart. It also gives the read-only SQL for Evoni to count each group on production before any migration is written.

## Summary

1. **A real purchase leaves a ledger row (MEASURED).** Every coin path that makes a piece Lala's writes a `financial_transactions` row with `category = 'wardrobe_purchase'`, `source_type = 'wardrobe'` and `source_id` = the piece. The paths are `/select`, `/lock-outfit-atomic`, `/purchase` and episode finalize. `source_id` is a UUID, as is `wardrobe.id`, so they join directly.
2. **`acquisition_type` can't tell a bought piece from an auto-owned one (MEASURED).** It defaults to `'purchased'` (`src/models/Wardrobe.js:352-356`), so every upload carries it. A value other than `'purchased'` (gifted, borrowed, rented, custom, vintage) was chosen on purpose.
3. **The auto-ownership has a start date (MEASURED).** The rule "an upload with no lock is Lala's" came in with #2613 (`130daf65`, merged 2026-10-05). It ended on `main` with #3146 (`1c040052`, 2026-10-14) and is still live on production until that deploys. Before #2613, an upload was owned only if the Owned box was ticked.
4. **Two groups cannot be told apart by data alone (MEASURED):**
   - **Bought before the ledger existed.** The `financial_transactions` table was created by `src/migrations/20260724000002-create-financial-transactions.js`; purchases before it reached production left no row.
   - **Owned by hand.** A piece given to Lala with the Wardrobe edit form's Owned box (`src/controllers/wardrobeController.js:784`) leaves no mark of any kind.

   Those are listed for Evoni, never guessed.
5. **The issue's second migration step is no longer needed (MEASURED).** #3145 also proposed setting `lock_type = 'coin'` on unowned priced pieces with no lock. Since #2650 every unowned priced piece is for sale whatever its lock (`src/services/wardrobeReach.js` `isForSale`), and #3146 kept that. Those pieces are already buyable; changing their lock would change nothing Lala can do.

## 1. Every way a piece becomes owned

| # | Path | Where (at basis) | Leaves a mark? |
|---|---|---|---|
| 1 | `/select`: buys an unowned piece for sale when it is chosen | `src/routes/wardrobe.js:1643` (owns); ledger row at `:1620` (`category: 'wardrobe_purchase'`) and `:1629` (`flow: 'select'`) | **Yes**: ledger row, `source_id` = piece |
| 2 | `/lock-outfit-atomic`: buys each unowned piece on Lock | `:1835` (owns); ledger row at `:1819`, `:1828` (`flow: 'lock_outfit'`) | **Yes**: ledger row |
| 3 | `/purchase` | `:1983` (owns); ledger row at `:1959`, `:1968` (`flow: 'purchase'`) | **Yes**: ledger row |
| 4 | Episode finalize: charges and owns the pieces of the look it buys | `src/services/financialTransactionService.js:501-534` (rows at `:515`, owns at `:530`) | **Yes**: ledger row (`wardrobe_purchase`). A rental is charged as `wardrobe_rental` and **not** owned. |
| 5 | Starter basics seed, `POST /wardrobe/seed` | `src/routes/wardrobe.js:1176`; the ten basics at `:630-747`, each `tier: 'basic'`, `lock_type: 'none'`, `is_owned: true` | **By name only**: the ten seed names, tier `basic` |
| 6 | Upload, **2026-10-05 → #3146** (old rule) | was `wardrobeController.js` `is_owned: … : ((!lockType \|\| lockType === 'none') ? true : undefined)` (#2613); now `:302` `is_owned: false` | **No.** Only the dates and the lock: created in that window with lock `none` or null |
| 7 | Upload with the Owned box ticked: Add Piece's "Lala already owns it", default **on** from 2026-10-07; the older WorldAdmin modal's box, default **off** | before #3146 | **No** |
| 8 | Wardrobe edit form, Owned box | `wardrobeController.js:784` (`updateWardrobeItem`) | **No** |

**Not a path (MEASURED):**
- **Deal gifts.** No code makes a gifted piece owned. `gifted`/`borrowed` only make a piece free at finalize (`src/services/episodeLookCharges.js:27`; `financialTransactionService.js:499`), and `invitationCompositingService.js:399` only words the offer.
- **The Amazon order import** (`src/services/wardrobeOrderImport.js` `applyToPiece`) fills real-world fields only.
- **Data migrations.** None sets `is_owned`. The game-layer migration adds the column with default `false` (`src/migrations/20260219000006-wardrobe-game-layer.js:38-42`).

**Upload form history (MEASURED, git):**
- **Before 2026-10-05:** WorldAdmin's upload modal defaulted to `isOwned: false` and sent `isOwned` only when ticked (`frontend/src/pages/WorldAdmin.jsx` at `70eaac26`, lines 328 and 6266). The server saved it as sent, with model default `false`.
- **2026-10-05 (#2613):** the server owned any upload with no lock unless told otherwise.
- **2026-10-07 (Add Piece, `AddPieceDialog`):** the form defaulted to owned, ticked it whenever the lock was `none`, and always sent `isOwned`.
- **#3146:** every upload is unowned; `isOwned` is ignored.

## 2. The groups, and the rule

Each owned, live piece (`is_owned = true AND deleted_at IS NULL`) falls in the **first** group it matches:

| Group | Rule | Ruling says | Proposed |
|---|---|---|---|
| **1. Bought** | a live ledger row with `source_type = 'wardrobe'` and `source_id` = the piece | stays owned | keep |
| **2. Starter basic** | `tier = 'basic'` and name one of the ten seed names | stays owned | keep |
| **3. Acquired another way** | `acquisition_type` set and not `'purchased'` | gifts stay owned; borrowed, rented, custom and vintage are **for Evoni** | keep `gifted`; **ask** for the rest |
| **4. Auto-owned upload** | created on or after 2026-10-05, lock `none` or null | **un-own**: the target | un-own |
| **5. Owned upload with a lock, since 2026-10-05** | created on or after 2026-10-05, any other lock | the old rule didn't own these, so they were ticked by hand at upload or later | **ask** |
| **6. Owned before 2026-10-05, no ledger row** | everything else | ticked by hand, or bought before the ledger existed; can't be told apart | **ask** (default keep) |

**Limits (INFERRED):**
- **The start date is `main`'s, not production's.** 2026-10-05 is #2613's merge date, and production got the rule on a later deploy. Using the merge date can only add pieces to group 4 that were uploaded between the merge and that deploy. Those were saved by the old server, which honoured the form's box, defaulting off. The count query below splits group 4 by week so Evoni can see this.
- **Hand-ticked uploads look the same.** A piece ticked "Lala already owns it" in Add Piece on purpose since 2026-10-07 is indistinguishable from the default. The ruling ("every wardrobe piece that I upload should need purchased") covers it, unless it was marked `gifted`.
- **Hand-owned later looks the same.** A piece owned by the edit form after upload is indistinguishable from group 4 when it has no lock. The listing query below lets Evoni pick any out.

## 3. The SQL for Evoni (read-only)

Run on production with `psql` and paste the output. Both are `SELECT` only, and neither writes anything. The session never runs them.

**Counts per group:**
```sql
WITH owned AS (
  SELECT w.id, w.show_id, w.name, w.tier, w.lock_type, w.coin_cost, w.acquisition_type, w.created_at,
         EXISTS (SELECT 1 FROM financial_transactions ft
                  WHERE ft.source_type = 'wardrobe' AND ft.source_id = w.id AND ft.deleted_at IS NULL) AS has_ledger,
         (w.tier = 'basic' AND w.name IN ('Everyday White Tee', 'High-Rise Black Jeans', 'White Canvas Sneakers',
            'Simple Gold Hoops', 'Floral Midi Skirt', 'Oversized Blazer', 'Basic Black Crossbody', 'Cotton Sundress',
            'Fresh Citrus Eau de Toilette', 'Denim Jacket')) AS is_seed_basic
    FROM wardrobe w
   WHERE w.deleted_at IS NULL AND w.is_owned = true
)
SELECT CASE
         WHEN has_ledger THEN '1 bought'
         WHEN is_seed_basic THEN '2 starter basic'
         WHEN COALESCE(acquisition_type, 'purchased') <> 'purchased' THEN '3 acquired: ' || acquisition_type
         WHEN created_at >= TIMESTAMPTZ '2026-10-05 00:00:00+00' AND COALESCE(lock_type, 'none') = 'none'
           THEN '4 auto-owned upload, week of ' || to_char(date_trunc('week', created_at), 'YYYY-MM-DD')
         WHEN created_at >= TIMESTAMPTZ '2026-10-05 00:00:00+00' THEN '5 owned upload with a lock'
         ELSE '6 owned before 2026-10-05, no ledger row'
       END AS grp,
       COUNT(*) AS pieces
  FROM owned
 GROUP BY 1
 ORDER BY 1;
```

**The pieces in groups 3 (other than gifted), 4, 5 and 6, to look through:**
```sql
SELECT w.name, s.name AS show, w.tier, w.lock_type, w.coin_cost, w.acquisition_type,
       to_char(w.created_at, 'YYYY-MM-DD') AS created
  FROM wardrobe w JOIN shows s ON s.id = w.show_id
 WHERE w.deleted_at IS NULL AND w.is_owned = true
   AND NOT EXISTS (SELECT 1 FROM financial_transactions ft
                    WHERE ft.source_type = 'wardrobe' AND ft.source_id = w.id AND ft.deleted_at IS NULL)
   AND NOT (w.tier = 'basic' AND w.name IN ('Everyday White Tee', 'High-Rise Black Jeans', 'White Canvas Sneakers',
            'Simple Gold Hoops', 'Floral Midi Skirt', 'Oversized Blazer', 'Basic Black Crossbody', 'Cotton Sundress',
            'Fresh Citrus Eau de Toilette', 'Denim Jacket'))
   AND COALESCE(w.acquisition_type, 'purchased') <> 'gifted'
 ORDER BY w.created_at;
```

**Unowned pieces with no price (now "Price required" since #3146), to price them:**
```sql
SELECT COUNT(*) AS unpriced_unowned
  FROM wardrobe
 WHERE deleted_at IS NULL AND is_owned IS NOT TRUE
   AND COALESCE(lock_type, 'none') NOT IN ('brand_exclusive', 'season_drop')
   AND COALESCE(coin_cost, 0) <= 0;
```

## 4. The migration, once Evoni has ruled (plan only)

A new file under `src/migrations/`, run only through the Deploy workflow after Evoni approves the run:
- **`up`:** `UPDATE wardrobe SET is_owned = false, updated_at = NOW()` for group 4, using the same rule as the count query, plus any group Evoni rules in. It respects `deleted_at`, and it records the ids it changed in a small table or JSON so `down` can restore exactly those.
- **`down`:** sets `is_owned = true` on exactly the recorded ids.
- **No lock changes:** see Summary 5.
- **Test:** a migration test against the test database, with one row per group, checking that only group 4 (plus anything ruled in) is un-owned and that `down` restores it.

## 5. Decisions for Evoni

1. **Group 3, other than gifted** (borrowed, rented, custom, vintage, owned): keep or un-own?
2. **Group 5** (uploads since 2026-10-05 that had a lock and are owned): keep or un-own?
3. **Group 6** (owned before 2026-10-05 with no ledger row): keep (the default) or un-own?
4. **Group 4:** confirm un-owning all of it after looking at the list; name any to keep.
5. **Unpriced unowned pieces:** price them in the Wardrobe, or leave them as "Price required".
