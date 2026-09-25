# Wardrobe Starting Closet — a read, not a ruling

Task #1932. Basis: `origin/main` at `5a60f3278`. This is a living doc. It cites code by name, with line numbers at that basis as a convenience only.

It answers one question: the design gives Lala 10 owned BASIC items (`SEED_WARDROBE`), so why does this show have none? It lists what the code settles, what only production can settle (with the read-only SQL to settle it), and the options. **Nothing here is ruled.** The item rows, `is_owned` and coins are unchanged. Nobody ran a query.

Related reads: `docs/WARDROBE_OWNERSHIP_READ.md` (the stores and their writers) and `docs/EVENT_EPISODE_FLOW.md` §7.

## 1. Production facts this starts from (ATTESTED, Evoni)

- 2026-09-25: the styling game renders, but no item can be locked. All 45 wardrobe items have `is_owned = false`. The Sage Corset Lace-Up Halter Midi shows "Need 385 coins", and the show has 350 coins. `episode_wardrobe` has 0 rows.
- 2026-09-23 (`PROJECT_CONTEXT.md` §6.5): "all 40 items were seeded in one batch on 2026-02-19"; `episode_wardrobe` has 21 rows.

The two reads disagree: 40 items became 45, and 21 `episode_wardrobe` rows became 0. The code doesn't explain either change. Queries Q2 and Q6 reconcile them.

## 2. What `POST /api/v1/wardrobe/seed` does

The handler is `router.post('/seed')` in `src/routes/wardrobe.js` (line 851), with data from `SEED_WARDROBE` (lines 305–846). It takes `{ show_id, clear_existing = false }` and requires auth.

- **It creates up to 40 rows** for `show_id`. It fills tier, lock_type, is_owned, is_visible, coin_cost, reputation_required, aesthetic/event tags and the Lala reactions. It does not fill `character`, `brand`, `price` or any image.
- **Exactly 10 are `is_owned: true`.** They are the BASIC tier, all `lock_type 'none'`, `coin_cost 0`:
  1. Everyday White Tee
  2. High-Rise Black Jeans
  3. White Canvas Sneakers
  4. Simple Gold Hoops
  5. Floral Midi Skirt
  6. Oversized Blazer
  7. Basic Black Crossbody
  8. Cotton Sundress
  9. Fresh Citrus Eau de Toilette
  10. Denim Jacket
- **The other 30 are unowned:**
  - MID: 9 coin items at 80–250 coins, plus A-Line Trench Coat (reputation 3).
  - LUXURY: 12 items. Seven are coin items at 200–800 coins. Five need reputation 5–6.
  - ELITE: 8 items (brand exclusive, reputation 7–10, a season drop, one coin item at 2000). Two of them are hidden.
- **It skips existing names.** A name is skipped when a live row (`deleted_at IS NULL`) of that `show_id` has it. A soft-deleted row doesn't block, so the seed would create that name again.
- **`clear_existing: true` hard-deletes.** It runs `Wardrobe.destroy({ show_id, name IN seed names })`. The `Wardrobe` model has `timestamps: false`, so Sequelize doesn't treat it as paranoid, even though `src/config/sequelize.js` defaults `paranoid: true`. The destroy is therefore a SQL `DELETE`. No `deleted_at` trace is left. The original version (`6e0caf79e`, 2026-02-18) also ran a raw `DELETE`.
- **Re-running it without `clear_existing` is safe for rows that exist.** It never updates an existing row, so it won't flip `is_owned` back. There is no transaction, so a failure part-way leaves a partial seed.
- **It has one caller.** `ShowSettings` → Advanced → "🌱 Seed All" (`seedAll`) posts `{ show_id }` only, so it never sends `clear_existing`. It runs inside `Promise.allSettled` and always toasts "Seeded goals + wardrobe", even when the seed failed.
  - The page is `/shows/:id/settings`. Its only in-app link is `ProductionTab` "Show Settings", under `/universe/production`.
  - No script, migration or seeder calls `/seed`. `tests/integration/wardrobe-money.integration.test.js` does, inside a `describe.skip`.
  - Until `e7718e5a1` (2026-05-07) the route was `optionalAuth`.

## 3. Every writer of `wardrobe.is_owned`

| Writer | Value | Could it have run in production? |
|---|---|---|
| Migration `20260219000006-wardrobe-game-layer.js` (line 38), which adds the column with `defaultValue: false` | false, for every row that existed when it ran | Yes. The column exists. |
| `Wardrobe` model default (`src/models/Wardrobe.js`, `is_owned`, line 262) | false on any create that omits it | Yes |
| `createWardrobeItem` (`wardrobeController.js` line 251), the upload | from `isOwned`. The WorldAdmin upload form defaults `isOwned: false` and sends it only when ticked (`WorldAdmin.jsx` line 6719). The form also defaults `lockType 'none'`, and `tier` is stored `NULL` unless picked. | Yes. Q2 tells. |
| `updateWardrobeItem` (`wardrobeController.js` line 723, saved at 768), the edit | from `is_owned`. WorldAdmin's edit form (`openEditItem` / `saveWardrobeItem`, checkbox at line 6033) **always sends it** | Yes. See the hazard below. |
| `POST /seed` (`wardrobe.js` line 892) | true for the 10 BASIC, false for 30 | Q1 tells |
| `POST /select` auto-purchase (`wardrobe.js` lines 1271–1274) | true, coin items only | Q3 tells (ledger `metadata.flow = 'select'`) |
| `POST /purchase` (`wardrobe.js` lines 1403–1406) | true, coin items only | Q3 tells (`flow = 'purchase'`) |
| `assignToEpisode` / `bulkAssign` (`wardrobeLibraryController.js` lines 603, 1520) | model default false, with `show_id NULL` | No UI caller remains |
| `POST /:id/pieces` (`wardrobe.js` line 1729) | model default false | No UI caller |

No reward, unlock or evaluation path writes `is_owned`. A reputation unlock makes an item selectable but never owned.

**Hazard (code-proven, production unknown): the edit form can write `is_owned = false`.** After a WorldAdmin bulk operation, the grid reloads from `listShowWardrobeApi` → `GET /api/v1/shows/:id/wardrobe` (`shows.js` line 1457). That endpoint selects no game-layer column. If an item is then opened and saved, the form sends:

- `is_owned: false`, because the form sets `!!undefined`;
- `lock_type: 'none'`;
- `tier: ''`.

`updateWardrobeItem` writes all three. The signature is `tier = ''` (Q3c).

## 4. The rule that decides "within reach"

- **The pool route** (`POST /browse-pool`, `wardrobe.js` lines 1119–1120). Coins and reputation come from the request body (`character_state`):
  ```js
  can_select: item.is_owned || (item.lock_type === 'reputation' && (character_state.reputation || 1) >= (item.reputation_required || 0)) || (item.lock_type === 'coin' && (character_state.coins || 0) >= (item.coin_cost || 0)),
  can_purchase: !item.is_owned && item.lock_type === 'coin' && (character_state.coins || 0) >= (item.coin_cost || 0),
  ```
- **`POST /select`** (lines 1227–1285). It reads coins from the newest `character_state` row by `updated_at` for (`show_id`, `'lala'`). It reads reputation from `req.body.reputation || 0`. It auto-purchases a coin item when coins ≥ `coin_cost || 0`, and otherwise returns 400 "Not enough coins — need X, have Y". It refuses any other unowned item unless `repOk`.
- **`EpisodeWardrobeGameplay`**, on the "Full Closet" and "Search" tabs (`loadCloset`, line 289), sets `can_select: i.is_owned !== false` and never sets `can_purchase`. `lockOutfit` sends only slots with `can_select` to `/select`.

Where they disagree:

1. **Closet and Search tabs versus the backend.** Closet ignores the lock type. An affordable coin item reads "🪙 Need N coins" there and can't be equipped, although the pool and `/select` would accept it. A row with `is_owned IS NULL` reads "Tap to equip", but `/select` refuses it.
2. **Reputation 0.** The pool treats 0 as 1 (`|| 1`), but `/select` gets `characterState.reputation ?? 0`. A `reputation_required = 1` item is selectable in the pool and refused at lock.
3. **Coins come from different rows.** The pool uses the coins the page loaded through `GET /characters/lala/state`, which runs `getOrCreateCharacterState` and orders by `season_id DESC NULLS LAST`. `/select` uses the newest row by `updated_at`. With more than one `character_state` row for the show, they can differ.
4. **Only a curated few reach the pool.** The pool route keeps about 6–10 items, chosen by match score, not price. At prestige under 7 that is 2 "stretch" items. An affordable item can be missing from the Pool tab, and the Closet tab then shows it as locked. So "within reach" in the data may not be reachable in the UI.
5. **Free coin items.** A coin-locked item with `coin_cost` NULL or 0 passes both checks, and `/select` "buys" it for 0 coins.
6. **Unowned `lock_type 'none'` (or NULL) items are unreachable everywhere.** The pool, `/select` and `/purchase` all refuse them. Uploads default to exactly that.
7. **One item in reach is not enough to lock.** `canLock` needs a body (`dress`, or `top` + `bottom`) and `shoes`. `SLOT_DEFS` matches `clothing_category` exactly, so a value like `dresses` or `heels` fits no slot.
8. **A lock can half-succeed.** `lockOutfit` calls `/select` one piece at a time. If the second coin piece is unaffordable, the first has already been bought and linked when the error shows.

## 5. Read-only SQL for Evoni

Run it in `psql` against canon. Each block runs inside `BEGIN READ ONLY … ROLLBACK`, so it can't write. Set the show first.

```sql
-- Q0: find the show id, then set it
SELECT id, name, created_at FROM shows WHERE deleted_at IS NULL ORDER BY created_at;
\set show_id '<paste the show uuid>'
```

The seed-name list is shared by Q1 and Q3. It is `SEED_WARDROBE` at `5a60f3278` (names unchanged since `6e0caf79e`).

```sql
-- Q1a: did the seed run? Every seed name against every wardrobe row with that name, any show, live or soft-deleted
BEGIN READ ONLY;
WITH seed(ord, name, tier, lock_type, is_owned, coin_cost, reputation_required) AS (VALUES
    (1, 'Everyday White Tee', 'basic', 'none', true, 0, 0),
    (2, 'High-Rise Black Jeans', 'basic', 'none', true, 0, 0),
    (3, 'White Canvas Sneakers', 'basic', 'none', true, 0, 0),
    (4, 'Simple Gold Hoops', 'basic', 'none', true, 0, 0),
    (5, 'Floral Midi Skirt', 'basic', 'none', true, 0, 0),
    (6, 'Oversized Blazer', 'basic', 'none', true, 0, 0),
    (7, 'Basic Black Crossbody', 'basic', 'none', true, 0, 0),
    (8, 'Cotton Sundress', 'basic', 'none', true, 0, 0),
    (9, 'Fresh Citrus Eau de Toilette', 'basic', 'none', true, 0, 0),
    (10, 'Denim Jacket', 'basic', 'none', true, 0, 0),
    (11, 'Satin Wrap Blouse', 'mid', 'coin', false, 150, 0),
    (12, 'Pleated Midi Dress', 'mid', 'coin', false, 200, 0),
    (13, 'Pointed-Toe Mules', 'mid', 'coin', false, 120, 0),
    (14, 'Pearl Drop Earrings', 'mid', 'coin', false, 100, 0),
    (15, 'Structured Leather Tote', 'mid', 'coin', false, 180, 0),
    (16, 'Corset Top', 'mid', 'coin', false, 160, 0),
    (17, 'A-Line Trench Coat', 'mid', 'reputation', false, 0, 3),
    (18, 'Block Heel Sandals', 'mid', 'coin', false, 100, 0),
    (19, 'Rose & Vanilla Body Mist', 'mid', 'coin', false, 80, 0),
    (20, 'Fitted Blazer Dress', 'mid', 'coin', false, 250, 0),
    (21, 'Silk Column Gown', 'luxury', 'reputation', false, 500, 5),
    (22, 'Diamond Tennis Bracelet', 'luxury', 'coin', false, 800, 0),
    (23, 'Patent Leather Stilettos', 'luxury', 'coin', false, 600, 0),
    (24, 'Vintage Silk Clutch', 'luxury', 'reputation', false, 400, 5),
    (25, 'Oud & Amber Parfum', 'luxury', 'coin', false, 350, 0),
    (26, 'Embroidered Cape Blazer', 'luxury', 'reputation', false, 700, 6),
    (27, 'Cashmere Wrap Cardigan', 'luxury', 'coin', false, 450, 0),
    (28, 'High-Slit Satin Skirt', 'luxury', 'coin', false, 500, 0),
    (29, 'Architectural Gold Cuff', 'luxury', 'reputation', false, 300, 5),
    (30, 'Crystal-Embellished Pumps', 'luxury', 'coin', false, 750, 0),
    (31, 'Velvet Corset Gown', 'luxury', 'reputation', false, 900, 6),
    (32, 'Rose Gold Chain Belt', 'luxury', 'coin', false, 200, 0),
    (33, 'Maison Belle Signature Gown', 'elite', 'brand_exclusive', false, 0, 8),
    (34, 'Couture Feather Cape', 'elite', 'reputation', false, 1500, 8),
    (35, 'Diamond Choker Necklace', 'elite', 'coin', false, 2000, 0),
    (36, 'Custom Crystal Heels', 'elite', 'brand_exclusive', false, 0, 9),
    (37, 'Noir Exclusive Clutch', 'elite', 'reputation', false, 1200, 7),
    (38, 'Legacy Parfum — "Prime"', 'elite', 'season_drop', false, 0, 0),
    (39, 'Celestial Ball Gown', 'elite', 'brand_exclusive', false, 0, 10),
    (40, 'Crown Headpiece', 'elite', 'reputation', false, 0, 10)
)
SELECT s.ord, s.name AS seed_name, s.tier AS seed_tier, s.is_owned AS seed_owned,
       w.id, w.show_id, (w.show_id = :'show_id') AS this_show,
       w.is_owned, w.tier, w.lock_type, w.coin_cost, w.character,
       w.created_at, w.updated_at, w.deleted_at
FROM seed s
LEFT JOIN wardrobe w ON lower(btrim(w.name)) = lower(btrim(s.name))
ORDER BY s.ord, w.created_at;
ROLLBACK;
```

- **Reading Q1a.** If every row has `w.id` NULL, the seed never ran on this database under these names.
- If rows exist with `this_show = true` and BASIC `is_owned = false`, the seed ran here and something flipped them. See the Q3c signature.
- If `this_show` is false or NULL, the seed ran for another show, or for `show_id NULL`.
- A name with `deleted_at` set was soft-deleted (`deleteWardrobeItem`).
- The per-row output shows the counts, but Q1b gives a one-line summary.

```sql
-- Q1b: the Q1a verdict in one row (the first 10 names are the BASIC tier)
BEGIN READ ONLY;
WITH seed AS (
  SELECT n AS name, ord, ord <= 10 AS basic FROM unnest(ARRAY[
    'Everyday White Tee', 'High-Rise Black Jeans', 'White Canvas Sneakers', 'Simple Gold Hoops',
    'Floral Midi Skirt', 'Oversized Blazer', 'Basic Black Crossbody', 'Cotton Sundress',
    'Fresh Citrus Eau de Toilette', 'Denim Jacket', 'Satin Wrap Blouse', 'Pleated Midi Dress',
    'Pointed-Toe Mules', 'Pearl Drop Earrings', 'Structured Leather Tote', 'Corset Top',
    'A-Line Trench Coat', 'Block Heel Sandals', 'Rose & Vanilla Body Mist', 'Fitted Blazer Dress',
    'Silk Column Gown', 'Diamond Tennis Bracelet', 'Patent Leather Stilettos', 'Vintage Silk Clutch',
    'Oud & Amber Parfum', 'Embroidered Cape Blazer', 'Cashmere Wrap Cardigan', 'High-Slit Satin Skirt',
    'Architectural Gold Cuff', 'Crystal-Embellished Pumps', 'Velvet Corset Gown', 'Rose Gold Chain Belt',
    'Maison Belle Signature Gown', 'Couture Feather Cape', 'Diamond Choker Necklace', 'Custom Crystal Heels',
    'Noir Exclusive Clutch', 'Legacy Parfum — "Prime"', 'Celestial Ball Gown', 'Crown Headpiece'
  ]) WITH ORDINALITY AS t(n, ord)
)
SELECT
  count(DISTINCT s.name) FILTER (WHERE w.id IS NOT NULL)                                 AS seed_names_found_anywhere,
  count(*) FILTER (WHERE w.show_id = :'show_id' AND w.deleted_at IS NULL)                AS live_this_show,
  count(*) FILTER (WHERE w.show_id = :'show_id' AND w.deleted_at IS NOT NULL)            AS soft_deleted_this_show,
  count(*) FILTER (WHERE w.id IS NOT NULL AND w.show_id IS NULL)                         AS unscoped,
  count(*) FILTER (WHERE w.show_id <> :'show_id')                                        AS other_shows,
  count(*) FILTER (WHERE w.show_id = :'show_id' AND s.basic AND w.is_owned)              AS basic_owned_this_show,
  (SELECT count(*) FROM wardrobe x WHERE x.show_id = :'show_id' AND x.deleted_at IS NULL) AS all_live_this_show
FROM seed s LEFT JOIN wardrobe w ON lower(btrim(w.name)) = lower(btrim(s.name));
ROLLBACK;
```

```sql
-- Q1c: deletions. The first query is soft deletes for this show; the second is hard-delete evidence
BEGIN READ ONLY;
SELECT id, name, tier, is_owned, created_at, updated_at, deleted_at
FROM wardrobe WHERE show_id = :'show_id' AND deleted_at IS NOT NULL ORDER BY deleted_at;
-- Postgres counts every physical DELETE since the stats were last reset (clear_existing leaves no row behind)
SELECT s.relname, s.n_tup_ins, s.n_tup_upd, s.n_tup_del, s.n_live_tup, d.stats_reset
FROM pg_stat_user_tables s CROSS JOIN pg_stat_database d
WHERE s.relname = 'wardrobe' AND d.datname = current_database();
-- ledger and link rows that name a wardrobe id which no longer exists
SELECT 'financial_transactions' AS src, ft.source_id::text AS wardrobe_id, ft.source_name, ft.created_at
FROM financial_transactions ft
WHERE ft.show_id = :'show_id' AND ft.source_type = 'wardrobe'
  AND NOT EXISTS (SELECT 1 FROM wardrobe w WHERE w.id::text = ft.source_id::text)
UNION ALL
SELECT 'episode_wardrobe', ew.wardrobe_id::text, NULL, ew.created_at
FROM episode_wardrobe ew
WHERE NOT EXISTS (SELECT 1 FROM wardrobe w WHERE w.id = ew.wardrobe_id);
ROLLBACK;
```

```sql
-- Q2: origin of the 45. There is no source/origin column, so each row is classified by its signature
BEGIN READ ONLY;
SELECT w.id, w.name, w.show_id, w.character, w.clothing_category, w.tier, w.lock_type,
       w.is_owned, w.is_visible, w.coin_cost, w.price, w.brand, w.reputation_required,
       w.library_item_id, w.parent_item_id, (w.s3_url IS NOT NULL) AS has_image,
       w.created_at, w.updated_at, w.deleted_at,
       CASE
         WHEN w.parent_item_id IS NOT NULL  THEN 'piece (POST /:id/pieces)'
         WHEN w.library_item_id IS NOT NULL THEN 'library copy (assign / bulk-assign)'
         WHEN w.character IS NULL AND w.s3_url IS NULL AND w.lala_reaction_own IS NOT NULL THEN 'seed-shaped (POST /seed)'
         WHEN w.character IS NOT NULL THEN 'upload-shaped (POST /, createWardrobeItem)'
         ELSE 'unknown'
       END AS likely_origin
FROM wardrobe w
WHERE (w.show_id = :'show_id' OR w.show_id IS NULL)
ORDER BY w.created_at;
-- creation batches
SELECT date_trunc('minute', created_at) AS minute, count(*) AS rows, bool_and(show_id IS NOT NULL) AS all_scoped
FROM wardrobe WHERE (show_id = :'show_id' OR show_id IS NULL) GROUP BY 1 ORDER BY 1;
ROLLBACK;
```

`browse-pool` reads `show_id = :show_id` only. The WorldAdmin grid and the Closet tab add `show_id IS NULL`. Q2's `show_id` column says which of the 45 the pool can see.

```sql
-- Q3: evidence of each is_owned writer
BEGIN READ ONLY;
-- (a) purchases (/select auto-purchase and /purchase both log here)
SELECT created_at, category, amount, source_id, source_name, metadata->>'flow' AS flow, balance_before, balance_after
FROM financial_transactions
WHERE show_id = :'show_id' AND category = 'wardrobe_purchase' ORDER BY created_at;
-- (b) purchase history rows
SELECT created_at, source, deltas_json, notes FROM character_state_history
WHERE show_id = :'show_id' AND (source = 'wardrobe_purchase' OR notes LIKE 'Purchased:%') ORDER BY created_at;
-- (c) the stale-edit signature: tier '' is written only by WorldAdmin's edit form after a bulk-op reload
SELECT id, name, tier, lock_type, is_owned, created_at, updated_at
FROM wardrobe WHERE (show_id = :'show_id' OR show_id IS NULL) AND deleted_at IS NULL
  AND (tier = '' OR updated_at > created_at + interval '1 minute')
ORDER BY updated_at DESC;
ROLLBACK;
```

```sql
-- Q4a: this show's character_state (every row: /select and the page may read different ones)
BEGIN READ ONLY;
SELECT id, season_id, character_key, coins, reputation, brand_trust, influence, stress,
       last_applied_episode_id, created_at, updated_at
FROM character_state WHERE show_id = :'show_id' ORDER BY character_key, updated_at DESC;
-- the ledger's balance, which is a second coin store (getCurrentBalance)
SELECT count(*) AS tx_count,
       COALESCE(SUM(CASE WHEN type IN ('income','reward') THEN amount ELSE 0 END)
              - SUM(CASE WHEN type IN ('expense','deduction') THEN amount ELSE 0 END), 0) AS ledger_balance
FROM financial_transactions WHERE show_id = :'show_id' AND status = 'executed' AND deleted_at IS NULL;
ROLLBACK;
```

```sql
-- Q4b: every live item, its lock, and whether the backend would let her lock it now
BEGIN READ ONLY;
WITH st AS (
  SELECT coins, reputation FROM character_state
  WHERE show_id = :'show_id' AND character_key = 'lala'
  ORDER BY updated_at DESC LIMIT 1          -- the row /select reads
)
SELECT w.name, w.clothing_category, w.tier, w.lock_type, w.coin_cost, w.reputation_required,
       w.is_owned, w.is_visible, (w.show_id IS NULL) AS unscoped,
       st.coins, st.reputation,
       CASE
         WHEN w.is_owned THEN 'owned'
         WHEN w.lock_type = 'coin' AND COALESCE(w.coin_cost, 0) <= st.coins THEN 'buyable now (select auto-purchases)'
         WHEN w.lock_type = 'coin' THEN 'short ' || (w.coin_cost - st.coins) || ' coins'
         WHEN w.lock_type = 'reputation' AND COALESCE(st.reputation, 0) >= COALESCE(w.reputation_required, 0) THEN 'reputation-unlocked'
         WHEN w.lock_type = 'reputation' THEN 'needs reputation ' || w.reputation_required
         ELSE 'unreachable (' || COALESCE(w.lock_type, 'NULL') || ', unowned)'
       END AS reach,
       -- pool rule (reputation 0 counts as 1) vs /select rule (reputation as sent)
       (w.is_owned OR (w.lock_type = 'reputation' AND COALESCE(NULLIF(st.reputation, 0), 1) >= COALESCE(w.reputation_required, 0))
                   OR (w.lock_type = 'coin' AND COALESCE(st.coins, 0) >= COALESCE(w.coin_cost, 0))) AS pool_can_select,
       (w.is_owned OR (w.lock_type = 'reputation' AND COALESCE(st.reputation, 0) >= COALESCE(w.reputation_required, 0))
                   OR (w.lock_type = 'coin' AND COALESCE(st.coins, 0) >= COALESCE(w.coin_cost, 0))) AS select_accepts,
       (w.show_id = :'show_id' AND (w.is_visible OR w.is_owned)) AS pool_can_see_it
FROM wardrobe w CROSS JOIN st
WHERE (w.show_id = :'show_id' OR w.show_id IS NULL) AND w.deleted_at IS NULL
ORDER BY reach, w.coin_cost NULLS LAST, w.name;
-- the summary
WITH st AS (SELECT coins, reputation FROM character_state WHERE show_id = :'show_id' AND character_key = 'lala' ORDER BY updated_at DESC LIMIT 1)
SELECT w.lock_type, count(*) AS items,
       count(*) FILTER (WHERE w.lock_type = 'coin' AND COALESCE(w.coin_cost,0) <= st.coins) AS coin_affordable,
       count(*) FILTER (WHERE w.lock_type = 'reputation' AND COALESCE(st.reputation,0) >= COALESCE(w.reputation_required,0)) AS rep_ok,
       min(w.coin_cost) FILTER (WHERE w.lock_type = 'coin') AS cheapest_coin_item
FROM wardrobe w CROSS JOIN st
WHERE w.show_id = :'show_id' AND w.deleted_at IS NULL AND NOT COALESCE(w.is_owned, false)
GROUP BY w.lock_type ORDER BY w.lock_type;
ROLLBACK;
```

A single item in reach isn't enough. "Lock Outfit" (`canLock`) needs a `dress`, or a `top` and a `bottom`, plus `shoes`. Slots match `clothing_category` exactly after lowercasing. `lockOutfit` then calls `/select` once per piece, and each coin piece is paid for in turn. So the cheapest lockable look has to fit inside her coins. Q4c checks that.

```sql
-- Q4c: can she lock ANY outfit today? The cheapest body plus the cheapest shoes, among items the backend accepts
BEGIN READ ONLY;
WITH st AS (SELECT coins, reputation FROM character_state WHERE show_id = :'show_id' AND character_key = 'lala' ORDER BY updated_at DESC LIMIT 1),
ok AS (
  SELECT lower(w.clothing_category) AS cat, w.name,
         CASE WHEN w.is_owned THEN 0 ELSE COALESCE(w.coin_cost, 0) END AS cost_now
  FROM wardrobe w CROSS JOIN st
  WHERE w.show_id = :'show_id' AND w.deleted_at IS NULL AND (w.is_visible OR w.is_owned)
    AND (w.is_owned
         OR (w.lock_type = 'coin' AND COALESCE(w.coin_cost, 0) <= st.coins)
         OR (w.lock_type = 'reputation' AND COALESCE(st.reputation, 0) >= COALESCE(w.reputation_required, 0)))
)
SELECT (SELECT coins FROM st) AS coins,
       (SELECT min(cost_now) FROM ok WHERE cat = 'dress')  AS cheapest_dress,
       (SELECT min(cost_now) FROM ok WHERE cat = 'top')    AS cheapest_top,
       (SELECT min(cost_now) FROM ok WHERE cat = 'bottom') AS cheapest_bottom,
       (SELECT min(cost_now) FROM ok WHERE cat = 'shoes')  AS cheapest_shoes,
       LEAST((SELECT min(cost_now) FROM ok WHERE cat = 'dress'),
             (SELECT min(cost_now) FROM ok WHERE cat = 'top') + (SELECT min(cost_now) FROM ok WHERE cat = 'bottom'))
         + (SELECT min(cost_now) FROM ok WHERE cat = 'shoes') AS cheapest_lockable_look;
-- categories that no slot accepts (these items can never be equipped)
SELECT clothing_category, count(*) FROM wardrobe
WHERE show_id = :'show_id' AND deleted_at IS NULL
  AND lower(COALESCE(clothing_category, '')) NOT IN ('dress','top','bottom','shoes','accessories','jewelry','perfume')
GROUP BY 1;
ROLLBACK;
```

- **Reading Q4c.** The game is usable today only if `cheapest_lockable_look` is not NULL and is ≤ `coins`.
- The check ignores the pool's curation (see the curated-pool item in §4). The pieces must also appear in the Pool tab, because the Closet tab won't equip unowned items.

```sql
-- Q5: could the seed insert today? (NOT NULL columns, unique indexes, FKs into wardrobe)
BEGIN READ ONLY;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'wardrobe' AND is_nullable = 'NO' ORDER BY ordinal_position;
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'wardrobe';
SELECT conname, conrelid::regclass AS from_table, confdeltype AS on_delete
FROM pg_constraint WHERE confrelid = 'wardrobe'::regclass;
ROLLBACK;
```

```sql
-- Q6: reconcile episode_wardrobe (21 on 2026-09-23 vs 0 on 2026-09-25) and the event outfits
BEGIN READ ONLY;
SELECT count(*) AS all_rows,
       count(*) FILTER (WHERE e.show_id = :'show_id') AS this_show_rows,
       count(*) FILTER (WHERE e.id IS NULL) AS orphaned_episode
FROM episode_wardrobe ew LEFT JOIN episodes e ON e.id = ew.episode_id;
SELECT count(*) AS events,
       count(*) FILTER (WHERE outfit_set_id IS NOT NULL
                           OR CASE WHEN jsonb_typeof(outfit_pieces::jsonb) = 'array'
                                   THEN jsonb_array_length(outfit_pieces::jsonb) ELSE 0 END > 0) AS with_outfit
FROM world_events WHERE show_id = :'show_id';
ROLLBACK;
```

## 6. What the Event Package, the budget and the evaluation assume

- **The Event Package** (`EventPackagePage`, `computeEventPackageReadiness`) never reads `is_owned` or `episode_wardrobe`. Its Outfit item is `event.outfit_set_id` or `event.outfit_pieces`, and it doesn't gate: "Beat 8 needs an outfit". Its Money item says the stored `cost_coins` (column default 100) is charged at finalize.
- **The budget.** `/select` and `/purchase` spend `character_state.coins`. `finalizeEpisodeFinancials` then charges the event's `cost_coins`, and also charges any unowned `event.outfit_pieces` at `coin_cost || price`. `checkAffordability` counts owned pieces as free. With no pieces passed, which is how its `worldEvents` callers call it, it estimates 50/120/250/400 coins of outfit by prestige. The ledger (`financial_transactions`, default start 1,900) and `character_state.coins` (default 500) are separate stores.
- **The evaluation.** `completeEpisode` → `loadEpisodeLook` scores the approved `episode_wardrobe` rows. If there are none, it scores the event's pieces. If there are none of those, it scores nothing: `outfit_match` and `accessory_match` are 0, which forfeits up to 50 of 100 points (PASS is 65). `getWardrobeGrowthArc` sets `arc_stage` from luxury and elite rows **regardless of ownership**. One elite row makes it `'prime'`, and that loosens `evaluateAuthenticityFit`.

## 7. Options for Evoni (none ruled)

| Option | What it does | What it assumes, or changes |
|---|---|---|
| (a) Run the seed for this show | Creates the 10 owned BASIC items and 30 locked items, skipping names that already exist. Call `POST /api/v1/wardrobe/seed {show_id}` without `clear_existing`. The "Seed All" button also seeds 24 goals. | Ownership comes from the design itself, not invented. The rows have no images, brand, price or `character`. Luxury and elite rows move `arc_stage` (evaluation) even though they are unowned. BASIC pieces score low at prestige 6+. |
| (b) Mark a chosen subset of the 45 as owned | The WorldAdmin edit checkbox, on items Evoni picks | Only Evoni can choose the subset. No ledger row records the ownership. Avoid the edit form right after a bulk op (§3 hazard). |
| (c) Grant starting coins | `POST /characters/lala/state/update`, or ShowSettings "Reset stats", which sets 500 | Makes coin items buyable, one purchase per episode. It does nothing for unowned `lock_type 'none'` items. `state/update` writes `character_state`, writes a history row and mirrors the coin change into the ledger, all in one transaction. |
| (d) A combination | For example, a small owned floor from (a) or (b) plus the current coins | Combines the assumptions of the parts |

The PR for Task #1932 carries the recommendation. Which option fits depends on Q1–Q4c.
