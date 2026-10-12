# Read: Shop the Look and the wardrobe's real-world layer (phase 9)

- **Basis:** `origin/main` at `818f2b4c79c7e5898da387e31e4848a13087c435`. Every `path:line` below is at this SHA.
- **Date:** 2026-10-12
- **Task:** #3018, part 1 of 5 of The Pulse phase 9. The parts are #3018 to #3022.
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact.
  - Reads only, under `src/`, `frontend/src/` and `docs/`.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means reasoned from measured code, not observed running.

**Why phase 9.** The spec's build order (`docs/design/2026-10-the-pulse.md` §12) ends at phase 8. Evoni, 2026-10-12: phase 9 is §10, the one section not in the build order. §10 says:
- Wardrobe items carry `real_*` fields, kept apart from their in-world fields. In-world posts never show real brands or prices.
- Shop the Look links appear only in Distribution posts and on the public website, never in The Pulse. Affiliate links always carry the required disclosure.

**Evoni's decisions, 2026-10-12.**
- A look is on the website only when she publishes it, and she can take it down.
- She types the real-world fields in for now. Importing orders comes later.

---

## 1. The real-world fields exist; no screen shows them

- **The columns** (#2873, Task #2872). `src/migrations/20261010200000-add-real-fields-to-wardrobe.js:27-39` adds eleven nullable columns to `wardrobe`. **MEASURED**
  - Text: `real_brand`, `real_retailer`, `real_product_name`, `real_color`, `real_size`, `real_source`.
  - Prices: `real_price_paid`, `real_list_price`, as DECIMAL(10,2).
  - Links: `real_product_url`, `affiliate_url`, as TEXT.
  - Date: `real_order_date`, as DATEONLY.

  Its header (`:14-18`) explains why they are not twins of `brand`, `price`, `purchase_link`, `website`, `color` and `size`. Those are the piece's in-world fields: `price` is the look's coin-cost fallback, and `brand` is written into scripts and feed posts. The model declares the eleven at `src/models/Wardrobe.js:143-187`. **MEASURED**
- **The allow-list.** `realFieldsFrom` (`src/controllers/wardrobeController.js:38-65`) reads the fields by snake_case name. **MEASURED**
  - Text is trimmed, and empty clears the field.
  - A price must be a number of zero or more.
  - A date must round-trip as YYYY-MM-DD.
  - An absent key is left alone.

  Both writes use it: create at `:158` (in `createWardrobeItem`, `:109`) and update at `:703`. **MEASURED**
- **No screen.** Under `frontend/src`, no file outside tests names `real_brand`, `affiliate_url` or `real_product_url`. Measured by `grep -rln` at the basis. **MEASURED**
  - Producer Mode's piece editor is WorldAdmin's `openEditItem`. It builds `wardrobeForm` from the in-world fields only (`frontend/src/pages/WorldAdmin.jsx:4945-4983`) and saves with `PUT /api/v1/wardrobe/:id` (`:5117`). **MEASURED**
  - Add piece is `components/Wardrobe/AddPieceDialog`. It posts `POST /api/v1/wardrobe` (`:117`). **MEASURED**
  - Create takes the real fields too (`wardrobeController.js:158`), so Add piece could carry the same section. **MEASURED**
- **No importer.** `real_source` values `gmail` and `amazon_export` are named only in the migration's comment and the model. No code writes them. **MEASURED**

**Part 2 (#3019):** a folded "Real world" section in the piece editor, saving only changed fields. It changes no in-world field.

## 2. Distribution already has Shop the Look (#2878)

`src/services/styleSheetDistributionService.js` keeps the approved style sheet as `episodes.distribution_metadata.style_sheet`. There is no new table (`:4-18`). **MEASURED**
- **`shopLinks`** (`:82-101`) reads the saved look's pieces. It selects only `id, name, real_brand, real_product_name, real_retailer, real_product_url, affiliate_url` (`:86`). For each piece it takes the affiliate link if there is one, else the product page (`:94-95`). The label is real brand and product name, falling back to the piece's name (`:97`). **MEASURED**
- **The disclosure** is a constant, "Some links are affiliate links; I may earn a commission." (`:23`). `view` (`:118-140`) sets it whenever an included link is an affiliate link (`:123`) and marks it `disclosure_locked` (`:138`). `postText` puts it first (`:104-110`). Links are read live on every view, so the disclosure cannot be edited away. **MEASURED**
- **Send and remove.**
  - Sending again replaces the entry, keeping only an edited caption (`:155-177`).
  - `updateStyleSheetDistribution` edits the caption and `include_shop_links` (`:180-193`).
  - Remove deletes the entry (`:196-204`).

  All of it is behind `requireAuth` at `src/routes/episodes.js:642-679`. **MEASURED**
- **The card** is `frontend/src/components/Episodes/StyleSheetDistributionCard.jsx`. It shows the links and the locked disclosure, and copies the post text. Nothing is posted anywhere (`:6-11`). **MEASURED**

So §10's Distribution half is done. The website half is not.

## 3. Nothing in-world reads `real_*`; some game responses carry them

This section traces every wardrobe read in `src/services`, `src/routes` and `src/controllers`.
- **No AI prompt** gets a `real_*` value.
  - The script writer and the grounded generator select their columns, for example `src/services/episodeScriptWriterService.js:198`.
  - The event stylist reads whole rows (`src/routes/wardrobeEventRoutes.js:207`), but its prompt uses only name, category, tier, in-world price, `is_owned` and tags. **MEASURED**
- **No in-world renderer** reads them.
  - The look overlays select image fields only (`src/services/episodeOverlaysService.js:275`).
  - The Phone's brand and price come from the in-world `item.brand` and `item.price` (`src/controllers/wardrobeController.js:1589-1590`). **MEASURED**
- **No public route** returns wardrobe rows. The `// PUBLIC:` routes are `publicPolls`, `publicRecaps` and `publicSite`; none reads `wardrobe`. **MEASURED**
- **Game responses that carry them.** These `requireAuth` routes read every column and return the row, or save it. **MEASURED**

| Route | Read | Out |
|---|---|---|
| `GET /api/v1/wardrobe/outfit/:episode_id` (`src/routes/wardrobe.js:312`) | `SELECT w.*` (`:327`), attachments `findAll` (`:346`) | `...item` (`:365`) |
| `POST /api/v1/wardrobe/browse-pool` (`:1302`) | `findAll` (`:1345`) | `...item` into the pool (`:1463`, `:1488`) |
| `POST /api/v1/wardrobe/purchase` (`:1899`) | `SELECT *` (`:1912`) | `item` (`:1918`), `{ ...item, is_owned }` (`:2018`) |
| `GET /api/v1/wardrobe/:id/pieces` (`:2269`) | `findAll` (`:2273`) | the rows |
| `src/routes/wardrobeEventRoutes.js` filter (`:42`) | `findAll` (`:88`) | spread rows (`:145`, `:167`) |
| `src/routes/wardrobeEventRoutes.js` lock-outfit (`:283`) | `findByPk` (`:306`) | the item |
| `POST /api/v1/world/:showId/browse-pool` (`src/routes/world.js:174`) | `SELECT *` (`:195`, `:202`) | `browsePoolGenerator` spreads `...item` (`src/utils/browsePoolGenerator.js:88`); saved to `episodes.browse_pool_json`, JSONB (`world.js:250-256`; `src/models/Episode.js:186-190`) |

INFERRED: no game screen draws a `real_*` key today. But these responses feed the game UI, and the stored pool keeps them inside an episode row. Any route that returns a whole episode carries them on.

The Studio management reads in `wardrobeController` (list, get, staging) return them too. That is expected: it is where they are edited.

**Part 3 (#3020):**
- one helper that drops the eleven keys, applied to the rows above;
- a migration that strips them from stored `browse_pool_json`;
- a test that fails if a new `real_*` column is not stripped.

## 4. The website half: what is needed

- The public site today is `/`, `/pulse-recap` and `/pulse-recap/:id` (`frontend/src/App.jsx:298-300`). Its public reads are slots, polls and recaps. **MEASURED**
- There is no public look or shop page. **MEASURED**
- The style sheet entry has no "published to the site" state. Sending again replaces the entry (`styleSheetDistributionService.js:166-176`), so a publish record must be carried over explicitly. **MEASURED**

**Part 4 (#3021, backend):**
- a `site` record on the entry: `published_at`, `published_by`, and a random public `key`. Re-send keeps it; remove takes it down.
- publish (needs links included and at least one link) and take down, ADMIN only;
- `GET /api/v1/public/looks` and `/:key` (`// PUBLIC:`), carrying the title, caption, links (label, retailer, URL) and the locked disclosure. Links are read live. No ids, no prices, no drafts.

**Part 5 (#3022, frontend):**
- a "Show on the website" switch on the Distribution card;
- `pages/PublicShopLook.jsx` at `/shop-the-look` and `/shop-the-look/:key`. The disclosure comes first; affiliate links get `rel="sponsored noopener"`. Text only until website storage is live.

## 5. The parts

| # | Part | Area |
|---|---|---|
| #3018 | This read | docs |
| #3019 | "Real world" section in the piece editor | frontend |
| #3020 | Keep `real_*` out of game responses and the stored browse pool | backend |
| #3021 | Publish to the website: publish, take down, public read | backend |
| #3022 | The public Shop the Look page and the switch (merge after #3021) | frontend |

#3019, #3020 and #3021 touch different files and can go in any order.
