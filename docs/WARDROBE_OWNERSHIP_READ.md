# Wardrobe Ownership — a read, not a ruling

## Status of this document

**Read-only research, not a decision.** This file is not under `docs/audit/`. It carries no basis-SHA
immutability rule and rules nothing. It exists so Evoni can choose which wardrobe store is
authoritative before the wardrobe work starts, with the full picture in front of her. Nothing here
changes code, runs a query, or writes a migration.

Each claim is either verified against the code, with a function or route name and a file:line, or
marked as something a repo read cannot settle. Canon schema claims are read from Evoni's attested
capture `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt` (provenance:
`docs/audit/EvidenceNote_Canon_Capture_2026-09-17_Note.md`). That capture is a snapshot from
2026-09-17. This document made no database connection of its own.

Basis for the file:line citations: `origin/main` at `71db61613fba4786c9370ad41c90676cd1e8847c`
(2026-09-23). Line numbers drift, so the function or route name is the stable citation.

Task: #1741.

---

## 0. The short answer

- **The `wardrobe` table (model `Wardrobe`, UUID primary key) owns every permanent closet item that
  anything in the product uses today.** Every live surface reads it: the closet in WorldAdmin, the
  event outfit picker, the evaluation, the brand matching, the episode gameplay closet, the script
  writers, and the financial views.
- **`wardrobe_library` (model `WardrobeLibrary`, INTEGER primary key) could also claim to own
  items.** It was designed as the catalogue that `wardrobe` rows get copied from, and its
  `DELETE` guard treats it as the parent. No frontend page reads it except the diagnostic page, and
  nothing writes to it from the live closet.
- **"Outfit set" means four different things, and none of them agree** (§1.3).
- **The Event Package's outfit fields and the episode's outfit are separate stores.** Two event
  fields point at nothing that can join.
- **Nothing distinguishes an AI suggestion from a confirmed fact on an item.**
- **An item's brand is free text on `wardrobe.brand`.** It is not linked to the brand registry, and
  the image analysis always replaces its own brand estimate with a generated fictional name.
- **The capture shows canon `episode_wardrobe` is missing columns the code writes and filters on**
  (§4.6). No register document records this yet. It is recorded here as inferred from the capture.
  Its runtime effect is not measured.

---

## 1. Every store that holds wardrobe data

### 1.1 Item stores

**`wardrobe`** is defined by `src/models/Wardrobe.js` (`tableName: 'wardrobe'`, UUID `id`, soft
delete via `deleted_at`).

- **Shape:**
  - Identity: `name` (NOT NULL), `character`, `character_id`, `clothing_category` (NOT NULL),
    `description`, `show_id`.
  - Images: `s3_*` variants (original, processed, regenerated, pink/blue/teal backgrounds),
    `thumbnail_url`, `primary_image_variant`.
  - Shopping: `brand` (STRING, free text), `price`, `purchase_link`, `website`.
  - Metadata: `color`, `size`, `season`, `occasion`, `tags`, `notes`, `outfit_notes`,
    `scene_description`, `is_favorite`, `times_worn`, `last_worn_date`.
  - Set fields: `outfit_set_id` and `outfit_set_name` (free STRING), `parent_item_id`,
    `attachment_type`, `is_set`, `set_name`, and `library_item_id` (INTEGER, pointing at
    `wardrobe_library.id`).
  - Game layer: `tier`, `lock_type`, `unlock_requirement`, `is_owned`, `is_visible`,
    `era_alignment`, `aesthetic_tags`, `event_types`, `outfit_match_weight`, `coin_cost`,
    `acquisition_type`, `rental_price`, `resale_value`, `reputation_required`,
    `influence_required`, `season_unlock_episode`, `lala_reaction_own/locked/reject`.
- **Migrations:**
  - `src/migrations/20260217000001-fix-wardrobe-schema-gaps.js` creates the table if missing.
  - `20260219000006-wardrobe-game-layer.js` adds the game layer.
  - `20260722000000-add-wardrobe-attachment-pieces.js` adds the set fields.
  - `20260803000000`/`…01` add regeneration and the primary variant.
- **Writers,** all mounted at `/api/v1/wardrobe`:
  - `createWardrobeItem` (`src/controllers/wardrobeController.js`, `Wardrobe.create` at `:168`),
    reached through `POST /`. This is the only closet-creation path the UI uses.
  - `updateWardrobeItem` (`wardrobeController.js:594`), reached through `PUT /:id`.
  - `deleteWardrobeItem` (`:752`), a soft delete. `?force=true` also destroys the item's
    `episode_wardrobe` links.
  - Image handlers `processBackgroundRemoval`, `regenerateProductShot`, `aiUpscaleItem`,
    `premiumEnhance`, `addDropShadow`, and the bulk variants. These write image columns only.
  - `analyzeItem` and `bulkAnalyze` (`:1947`, `:2176`). With `autoApply` they write `color`,
    `clothing_category` and `tags`, and `name` when it is empty (§5.2).
  - The seed route `POST /seed` (`src/routes/wardrobe.js:850`).
  - `POST /select` (`:1208`), which sets `is_owned` and bumps `times_worn`.
  - `POST /purchase` (`:1323`), which sets `is_owned`.
  - `POST /:id/pieces` (`:1655`), `PUT /:id/set` (`:1739`) and `POST /bulk/sync-coin-costs`
    (`:261`).
  - `POST /:showId/auto-tag-event-types` (`:1777`), a keyword heuristic that runs raw
    `UPDATE wardrobe SET event_types`.
  - From the library side, `assignToEpisode` and `bulkAssign` (§1.1 below).
- **Readers:** effectively everything that uses wardrobe. §3 maps the named surfaces. Other readers:
  - `getBrandRelationships` (`src/services/wardrobeIntelligenceService.js:855`)
  - `getWardrobeGrowthArc` (`:901`)
  - `loadScriptContext` (`src/services/episodeScriptWriterService.js:147`)
  - `groundedScriptGeneratorService.js:113`
  - `getTodoList` (`src/services/todoListService.js:563`)
  - `/:id/financial-breakdowns` and `/:id/financial-suggestions` (`src/routes/shows.js:963`,
    `:1113`)
  - `GET /api/v1/shows/:id/wardrobe` (`shows.js:1461`)
  - `POST /world/:showId/browse-pool` (`src/routes/world.js:183`)
  - episode financial generation (`src/routes/worldEvents.js:1980`, `:2083`, `:2195`)

**`wardrobe_library`** is defined by `src/models/WardrobeLibrary.js` (`tableName:
'wardrobe_library'`, INTEGER `id`, `paranoid: true`).

- **Shape:**
  - `name`, `description`, `type` (`item` | `set`), `item_type`, `image_url` (NOT NULL),
    `thumbnail_url`, `s3_key`.
  - Defaults: `default_character`, `default_occasion`, `default_season`.
  - `color`, `tags`, `website`, `price`, `vendor` (free text; there is no `brand` column), `show_id`.
  - Usage counters `total_usage_count`, `last_used_at`, `view_count`, `selection_count`.
  - `created_by`, `updated_by`.
- **No creating migration in `src/migrations/`.** The table was made by
  `scripts/migrations/run-wardrobe-library-migration.js`. `20260219000006-wardrobe-game-layer.js`
  adds game-layer columns, and canon has them (tier, aesthetic_tags, event_types, lock_type,
  coin_cost, lala_reaction_*; capture lines ~2499–2536). **The model does not declare them**, so
  Sequelize never reads or writes them.
- **Writers,** all mounted at `/api/v1/wardrobe-library`, controller
  `src/controllers/wardrobeLibraryController.js`:
  - `uploadToLibrary` (`POST /`, `:48`; also writes `wardrobe_library_references`).
  - `updateLibraryItem` (`:441`).
  - `deleteLibraryItem` (`:511`). It refuses with 409 while any `wardrobe` row has
    `library_item_id` equal to its id (`:524`).
  - The counters: `incrementUsage`, `trackView`, `trackSelection`.
- **Readers:**
  - The library's own list, get, stats, search, analytics and duplicates handlers.
  - `GET /for-chapter/:chapterId` (`src/routes/wardrobeLibrary.js:84`). It reads `item.brand`, which
    is not a library attribute.
  - `GET /api/v1/scene-sets/:id/wardrobe-match` (`src/routes/sceneSetRoutes.js:2255`).
  - `/narrative-intelligence` in `src/routes/memories/interview.js:265`, which also reads
    `item.brand`.
  - `groundedScriptGeneratorService.js:103`. It asks for `is_owned`, `slot`, `tier`,
    `aesthetic_tags` and `lala_reaction_equipped`, none of which are model attributes. It runs
    inside a swallowing catch, so it very likely returns nothing.
- **Frontend readers:** only `DiagnosticPage` (`frontend/src/pages/DiagnosticPage.jsx:77-78`).
  `frontend/src/App.jsx` records, above the `OutfitCalendar` import, that every standalone
  WardrobeLibrary page was removed and wardrobe authoring was consolidated into WorldAdmin.

**Copying between the two item stores.** Copies go one way only, library → `wardrobe`:

- `assignToEpisode` (`POST /api/v1/wardrobe-library/:id/assign`, `wardrobeLibraryController.js:578`,
  `Wardrobe.create` at `:603`) creates a **new `wardrobe` row** with `library_item_id` set. It copies
  `name`, `character`, `clothing_category` (from `itemType`, default `'other'`), `description`,
  `s3_url` (from `imageUrl`), `thumbnail_url`, `color` and `season`. It does **not** copy `vendor`
  (so no brand), `tags`, `price`, `occasion` or `show_id`.
- `bulkAssign` (`:1477`, `Wardrobe.create` at `:1520`) does the same, but omits `clothing_category`,
  which is NOT NULL on `wardrobe`. It also passes the camelCase `imageUrl` and `thumbnailUrl`, which
  are not `wardrobe` attributes. On a code read, every per-item create should fail inside its
  try/catch.
- Nothing creates a library row from a `wardrobe` row. The one-off
  `scripts/migrate-wardrobe-to-library.js` is the only other writer of `library_item_id`.

### 1.2 Episode-scoped and event-scoped stores

**`episode_wardrobe`** is defined by `src/models/EpisodeWardrobe.js`. It holds `episode_id`,
`wardrobe_id` (a `wardrobe` UUID), `scene_id`, `scene`, `worn_at`, `notes`, `approval_status`,
`approved_by`, `approved_at`, `rejection_reason`, and has no `deleted_at`. It is the episode's worn
outfit.

- **No creating migration in `src/migrations/`.** The table was made by
  `scripts/migrations/create-episode-wardrobe-table.sql`. The canon columns differ from the model
  (§4.6).
- **Writers:**
  - `linkWardrobeToEpisode` (`POST /api/v1/episodes/:id/wardrobe/:wardrobeId`,
    `wardrobeController.js:871`).
  - `POST /api/v1/wardrobe/select` (raw `INSERT … ON CONFLICT`, `src/routes/wardrobe.js:1288`,
    deliberately limited to "guaranteed columns").
  - `lock-outfit` (`POST /api/v1/wardrobe-events/:episodeId/lock-outfit`,
    `src/routes/wardrobeEventRoutes.js:279`). It destroys all the episode's links, then creates new
    ones with `approval_status: 'approved'`.
  - The episode generator's event-to-episode link (`src/services/episodeGeneratorService.js:839`,
    `EpisodeWardrobe.findOrCreate` from `world_events.outfit_pieces[].id`).
  - `assignToEpisode` and `bulkAssign` (§1.1).
  - The approval handlers in `src/controllers/wardrobeApprovalController.js`, mounted under
    `/api/v1/episodes`. They include `Wardrobe` with `as: 'wardrobe'`, but that alias is only defined
    in `EpisodeWardrobe.associate`, and `src/models/index.js` never calls it. The live alias is
    `wardrobeItem`, so these handlers should throw on the include. No frontend caller exists.
  - `toggleEpisodeFavorite` (`wardrobeController.js:1535`) writes `is_episode_favorite`. Canon has
    that column but the model does not declare it, so Sequelize drops it.
- **Readers:**
  - `getOutfitScore` (`src/routes/wardrobe.js:1487`, the evaluation's loader, §3).
  - `GET /api/v1/wardrobe/outfit/:episode_id` (`:94`).
  - `/outfit-history/:showId` (`:1578`).
  - `getEpisodeWardrobe` (`wardrobeController.js:811`).
  - `completeEpisode` / `computeWardrobeBonuses` (`src/services/episodeCompletionService.js:145`).
  - The script writers, `todoListService.js:565`, `detectRepeats`, `getBrandRelationships`, and
    `routes/world.js:214`.

**`world_events.outfit_pieces` / `outfit_set_id` / `outfit_score`** are the Event Package's outfit
fields (`src/models/WorldEvent.js`, the `// ── Wardrobe ──` block).

- `outfit_pieces` is JSONB. It holds a denormalized **snapshot** of `wardrobe` rows
  (`{id, name, category, brand, tier, price, color, is_owned, acquisition_type, image_url}`), with
  no foreign key.
- `outfit_set_id` is a UUID with no foreign key.
- `outfit_score` exists in canon (migration `20260720000000-add-outfit-pieces-to-world-events.js`)
  but is not declared in the model.
- The picker and its writer are already described in `docs/EVENT_EPISODE_FLOW.md` §2 "Outfit" and
  §5(b), and are cited rather than restated here. That doc's `worldEvents.js` line numbers have since
  drifted. At this basis:
  - `GET …/events/:eventId/outfit` is at `:2950`.
  - `PUT …/events/:eventId/outfit` is at `:2972`. It selects from `wardrobe` at `:2991` and writes
    `outfit_pieces`/`outfit_score` at `:3038`.
  - `GET …/events/:eventId/wardrobe-options` is at `:3051`.
- The generic `PUT /world/:showId/events/:eventId` (`:530`) also lets `outfit_set_id` and
  `outfit_pieces` through its allowlist.

**Other copies and snapshots** hold wardrobe data but are not authorities:

| Store | Where | What it holds |
|---|---|---|
| `episode_briefs.outfit_set_id` | `src/models/EpisodeBrief.js`, copied from the event by `episodeGeneratorService.js:613` | UUID, no foreign key (§4.3) |
| `episode_scripts.wardrobe_locked` | `src/models/EpisodeScript.js`, written by `episodeScriptWriterService.js`, read by `feedPostGeneratorService.js` | JSONB snapshot |
| `episodes.browse_pool_json` | `src/models/Episode.js` | JSONB browse-pool snapshot |
| `opportunities.wardrobe_brief` | `src/models/Opportunity.js` | JSONB |
| `episode_wardrobe_defaults` | `src/models/EpisodeWardrobeDefault.js`, routes at `src/routes/episodes.js:782-882` | Points at **`assets.id`**, not at any wardrobe store; the only frontend helper, `wardrobeDefaultsAPI`, has no component caller |
| `timeline_placements.wardrobe_item_id` | `timelinePlacementsController.js` | UUID pointing at `wardrobe`; the frontend and `timelinePlacementService` only create `asset` placements |
| `wardrobe_usage_history` | `src/models/WardrobeUsageHistory.js` | Keyed on `library_item_id` (INTEGER), so native `wardrobe` items never get history |
| `wardrobe_library_references` | written only by `uploadToLibrary` | Read by nothing |
| `wardrobe_content_assignments` | `src/models/WardrobeContentAssignment.js`, written by `POST /api/v1/wardrobe-library/:id/assign-content` (`src/routes/wardrobeLibrary.js:362`) | Keyed on `library_item_id` (INTEGER). Its `WardrobeUsageHistory.create` uses field names the model lacks and fails silently |
| `wardrobe_brand_tags` | §7 | Brand-coverage bookkeeping |
| `game_wardrobe` | read by `getWardrobePool` in `src/routes/episodeOrchestrationRoute.js:33` | **Not in the canon capture** (0 rows); no model or migration declares it |

### 1.3 Outfit sets: four mechanisms

| # | Mechanism | Ids it holds | Mounted and used? |
|---|---|---|---|
| A | `outfit_sets` (`src/models/OutfitSet.js`, INTEGER `id`, `items` JSON); controller `outfitSetController.js` (singular), `/api/v1/outfit-sets` | `items[].id` are **`wardrobe` UUIDs** stored as snapshots (`WorldAdmin`'s outfit-set builder sends `{id, name, category, image}`) | Yes. Written from WorldAdmin via `createOutfitSetApi`; read by `OutfitCardRenderer` in `ScreenContentRenderer.jsx` and by `OutfitCalendar` |
| B | `wardrobe_library` rows with `type='set'`, joined through `outfit_set_items` (`src/models/OutfitSetItems.js`, both columns INTEGER → `wardrobe_library`) | library INTs | Routes are mounted (`getOutfitItems`, `addItemsToOutfit`, `removeItemFromOutfit`); **no frontend caller** |
| C | `wardrobe.parent_item_id` / `is_set` / `set_name`, plus the free strings `wardrobe.outfit_set_id` / `outfit_set_name` | `wardrobe` UUIDs | Pieces are read by `GET /api/v1/wardrobe/outfit/:episode_id`. `outfit_set_id`/`name` are written by create and update but **read by nothing as a join key** |
| D | `episode_outfits` / `episode_outfit_items` (raw SQL in `src/controllers/outfitSetsController.js`, plural; no model) | `wardrobe` UUIDs, plus `source_outfit_set_id` INTEGER → `outfit_sets` | The episode routes are mounted in `src/routes/episodes.js` (`/:id/outfits`), with no frontend caller. The same file's set routes are **not mounted**, and they assume `outfit_sets.show_id` and a UUID join to `wardrobe`, which contradicts A and B. `createEpisodeOutfit` calls `this.getOutfitSetById` while wrapped unbound, so that path throws |

On the capture, all of these tables exist in canon. `outfit_sets` has a `deleted_at` column that the
model does not declare.

---

## 2. Which store owns a permanent closet item

**`wardrobe` owns it in practice.** When Evoni adds a piece to Lala's closet from the only closet UI
(WorldAdmin → Wardrobe → items), `uploadWardrobeApi` posts to `POST /api/v1/wardrobe`, and
`createWardrobeItem` writes a `wardrobe` row. Every scoring, event, episode, finance and script path
reads that row.

**`wardrobe_library` could also claim ownership, by design.** Its model comment and the
`assignToEpisode` / `bulkAssign` copy direction treat the library as the catalogue and each
`wardrobe` row as a per-episode instance. `deleteLibraryItem`'s 409 guard enforces that parent role.
But no surface a user reaches writes to the library, and nothing reads it except the diagnostic page
and three narrative or scene-set helpers (§1.1).

Every surface except those three helpers uses `wardrobe`. Those three are chapter wardrobe context,
the scene-set wardrobe match, and the grounded script generator's owned-items query, and the last is
probably broken.

---

## 3. Named surfaces, and the store each uses

| Surface | Reads | Writes |
|---|---|---|
| **Wardrobe library page.** No standalone page remains (`App.jsx` comment above the `OutfitCalendar` import). The closet is WorldAdmin's `wardrobe` tab, `wardrobe-items` subtab (`/shows/:id/world`), plus `ShowWardrobeTab` in ShowDetail | `wardrobe`, via `GET /api/v1/wardrobe?show_id=…` (WorldAdmin's initial load; `ShowWardrobeTab`). After bulk ops WorldAdmin reloads through `listShowWardrobeApi` → `GET /api/v1/shows/:id/wardrobe` (`shows.js:1461`), which returns fewer columns | `wardrobe` (`POST /api/v1/wardrobe`, `PUT /api/v1/wardrobe/:id`) |
| **Image analysis endpoint.** `POST /api/v1/wardrobe-library/analyze-image` (`src/routes/wardrobeLibrary.js:140`), which lives on the library router despite its name. Also `POST /api/v1/wardrobe/:id/analyze` and `/bulk/analyze` | `wardrobe` only: resolves `wardrobe_id` → image URL (`:162`), and reads the last 10 `wardrobe` rows as gameplay context (`:205`) | analyze-image: **nothing**, it only returns JSON. analyze / bulk-analyze: `wardrobe` when `autoApply` is set (WorldAdmin's bulk button always sets it) |
| **Outfit sets** | A: `outfit_sets`. B: `wardrobe_library` + `outfit_set_items`. C: `wardrobe`. D: `episode_outfits` (§1.3) | The same, respectively. Only A is written from the UI |
| **Event Package outfit fields** | `world_events.outfit_pieces` / `outfit_score`; the picker reads `wardrobe` (`wardrobe-options`, `PUT …/outfit`) | `world_events.outfit_pieces` / `outfit_score`, as a snapshot of `wardrobe` rows. `outfit_set_id` has no UI writer |
| **Episode wardrobe machinery** | `episode_wardrobe` JOIN `wardrobe` | `episode_wardrobe` (link, select, lock-outfit, the generator's event-to-episode link, library assign). `/select` also writes `wardrobe.times_worn` and `is_owned` |
| **Evaluation scoring outfit against event.** `POST /api/v1/episodes/:id/evaluate` (`src/routes/evaluation.js:238`) → `getOutfitScore` (`src/routes/wardrobe.js:1487`) → `scoreOutfitForEvent` (`wardrobeIntelligenceService.js:682`). Also `completeEpisode` (`episodeCompletionService.js:215`) | `episode_wardrobe` JOIN `wardrobe` (`SELECT w.*`). **Not** `world_events.outfit_pieces`. The event context comes from `world_events` by `used_in_episode_id` | none |
| **Brand matching in wardrobe scoring** | free-text `wardrobe.brand` against free-text `world_events.host_brand` (§7) | none |

The evaluation reads its item columns through `scoreOutfitForEvent` and its helpers: `tier`, `price`,
`brand`, `is_owned`, `acquisition_type`, `color`, `occasion`, `event_types`, `season`,
`era_alignment`, `lock_type`, `outfit_match_weight`, `clothing_category` and `aesthetic_tags`.

---

## 4. Where the stores disagree in code

### 4.1 The event's outfit and the episode's outfit are separate

`PUT …/events/:eventId/outfit` writes only `world_events.outfit_pieces`. The evaluation reads only
`episode_wardrobe`. The two meet in exactly one place: when the episode generator creates an episode
from the event, it copies `outfit_pieces[].id` into `episode_wardrobe`
(`episodeGeneratorService.js:839`).

After that, the two drift:

- Re-picking the event outfit does not update the episode's links.
- `lock-outfit`, `/select`, and linking or unlinking do not update the event's snapshot.

So the Event Package can show one outfit while the evaluation scores another. `completeEpisode`
prefers `episode_wardrobe` and falls back to `outfit_pieces` only when the join returns nothing
(`episodeCompletionService.js:141-158`).

### 4.2 Snapshots go stale

`outfit_pieces`, `outfit_sets.items`, `episode_scripts.wardrobe_locked` and
`episodes.browse_pool_json` each copy item fields at write time. Editing an item's `brand`, `tier`,
`price`, name or image in the closet changes none of them. A reader of a snapshot and a reader of
`wardrobe` show different values for the same item.

### 4.3 Set references that can't point at a set

`world_events.outfit_set_id` and `episode_briefs.outfit_set_id` are UUIDs. The comment on
`20260804000000-add-outfit-to-world-event.js` says "FK to outfit_sets", but both `outfit_sets.id` and
`wardrobe_library.id` are INTEGER (capture confirms `outfit_sets.id | integer`). No set id can ever
be stored in either column. `eventReadiness.js` still treats a non-null `outfit_set_id` as "has
outfit".

### 4.4 Library copies drop fields and never re-sync

A `wardrobe` row made by `assignToEpisode` loses the library row's `vendor`, `tags`, `price`,
`occasion` and `show_id`. After creation, neither side updates the other: `updateLibraryItem` does
not touch copies, and `updateWardrobeItem` does not touch the library. A library-sourced item can
therefore show one name, colour or description in the library and another in the closet.

### 4.5 Usage counters never move together

- `wardrobe.times_worn` is bumped only by `POST /api/v1/wardrobe/select`, and that path does not set
  `last_worn_date`.
- `wardrobe_library.total_usage_count` / `last_used_at` are bumped only by `assignToEpisode` and
  `bulkAssign`.
- `linkWardrobeToEpisode` has its wear-count call commented out (`wardrobeController.js:908`).
- `lock-outfit`, the generator's event-to-episode link and approval bump neither counter.
- The instance method `Wardrobe.prototype.incrementWearCount` is never called.
- Usage history is written only for `wardrobe` rows that carry a `library_item_id`.

### 4.6 The code's `episode_wardrobe` versus canon's (from the capture, not measured at runtime)

Canon `episode_wardrobe` columns per the capture (lines ~661–671): `created_at`, `episode_id`, `id`,
`is_episode_favorite`, `notes`, `scene`, `scene_id`, `times_worn`, `updated_at`, `wardrobe_id`,
`worn_at`. There is **no `approval_status`, `approved_by`, `approved_at`, `rejection_reason` or
`deleted_at`.**

- The model declares `approval_status` with `defaultValue: 'pending'`. Every `EpisodeWardrobe.create`
  or `findOrCreate` would therefore name that column in its INSERT. That includes `lock-outfit`, the
  generator's event-to-episode link, `assignToEpisode` and `linkWardrobeToEpisode`. On the capture's
  schema, Postgres would reject the insert. The generator's link runs inside a non-blocking catch
  that only warns.
- `computeWardrobeBonuses`' query filters on `ew.approval_status = 'approved' AND ew.deleted_at IS
  NULL` (`episodeCompletionService.js:149`). On the capture's schema that query errors, is swallowed,
  and completion falls back to `world_events.outfit_pieces`.
- `POST /api/v1/wardrobe/select` avoids this. Its comment (`src/routes/wardrobe.js:1286`) says the
  RDS table "may have been created from a simpler migration that lacks approval_status, worn_at,
  etc.", and it writes only the base columns.
- The capture also shows canon **`wardrobe.tags` is `ARRAY`**, while the model declares it `JSONB`.
  (`aesthetic_tags` and `event_types` are `jsonb` in both.) Whether writes of `tags` succeed against
  a Postgres array column is not settled by a repo read.

None of this is recorded in `docs/audit/` at this basis. Whether production behaves as inferred is
for Evoni's count (§8, query 8) or a future measured read, not this document.

---

## 5. What an item carries against what the analysis produces

### 5.1 `POST /api/v1/wardrobe-library/analyze-image` (the one the closet's "Auto-fill from image" and "AI Enhance" buttons call)

The model is `claude-sonnet-4-6`, via the base prompt, or the gameplay prompt when a `showId` is sent.
It writes nothing. WorldAdmin's upload modal copies the result into the form, and "Upload Item" posts
the form to `POST /api/v1/wardrobe`.

| Field the issue names | Analysis returns | `wardrobe` column | Survives to the row? |
|---|---|---|---|
| name | `name` | `name` | Yes |
| type | `item_type` | `clothing_category` (via the form's `catMap`) | Yes. Vocabularies differ slightly (analysis has `swimwear`/`activewear`; the form maps only some) |
| color | `color`, plus `colors[]` | `color` | `color` yes. **`colors[]` has no column** |
| description | `description` | `description` | On create, yes. **On edit, no:** `updateWardrobeItem`'s `updateData` has no `description` key, so "AI Enhance" → Save drops it (and so does any hand edit of the description) |
| season | `season` | `season` | Yes |
| occasion | `occasion` (one value) | `occasion` (STRING(100)) | Yes, one value only |
| tags | `aesthetic_tags[]` | the form puts them in **both** `tags` and `aesthetic_tags` | Yes. `tags` is `ARRAY` in canon (§4.6) |
| estimated brand | `brand_guess`, **overwritten server-side by `makeFictionalBrand()`** with `brand_is_fictional: true` added (`src/routes/wardrobeLibrary.js:328-330`) | `brand` | A generated fictional name survives. **The model's actual estimate is discarded before the response.** `brand_is_fictional` has no column; the form uses it only for a "Fictional brand (auto-filled)" label |

The analysis also returns fields beyond the eight the issue names:

- `price_estimate` → `price`. The form floors it at $150.
- `tier` → `tier`.
- `style_notes`: **no column, and the form drops it.**
- In gameplay mode: `coin_cost`, `acquisition_type`, `lock_type`, `era_alignment`, `event_types[]`,
  `outfit_match_weight` and `lala_reaction_*`, each of which has a `wardrobe` column.

**Nowhere to live today:** `colors[]`, `style_notes`, the model's real brand estimate, the fictional
flag, and more than one occasion. Filling every field the issue names also needs `updateWardrobeItem`
to accept `description`. That is a code change, not a schema change.

### 5.2 `analyzeItem` / `bulkAnalyze` (`wardrobeImageService.analyzeImage`, `src/services/wardrobeImageService.js:841`)

This is a second, different vision prompt, using model id `claude-sonnet-4-20250514`. It returns:
`colors[{name,hex,percentage}]`, `category`, `subcategory`, `material`, `style_tags[]`,
`aesthetic_tags[]`, `occasions[]`, `season`, `formality` and `suggested_name`.

With `autoApply`, only `color`, `clothing_category`, `tags` (merged) and, for a single item with an
empty name, `name` are written. `material`, `subcategory`, `formality`, hex values and multiple
occasions have no column. `extractColors` and `suggestTags` in the same service have no callers.

There are two analysis endpoints with different vocabularies. Choosing an authority includes
choosing which analysis fills it.

---

## 6. AI suggestion versus confirmed fact

**Nothing distinguishes the two today.** Neither `wardrobe` nor `wardrobe_library` has a provenance,
source, confidence, verified or analysed-at column (models, `src/migrations/`, and the canon capture).
The AI-related columns on `wardrobe` (`s3_*_regenerated`, `regeneration_*`, `primary_image_variant`)
describe image variants, not metadata.

AI output reaches a row in two ways:

- as ordinary form values that the user saves, where the saved row can't tell a typed value from an
  accepted one;
- as direct writes (`autoApply`).

The only marker anywhere is `brand_is_fictional`, which exists only in the analyze-image response.
`episode_wardrobe.approval_status` is per episode link, not per item attribute, and canon may not
have it (§4.6).

So provenance would need either new columns, or a convention stored in an existing column. The
`notes` column and the `tags` array are the only free-form candidates. Which to use is Evoni's call
(§9).

---

## 7. How an item's brand is stored

- **`wardrobe.brand` is free text** (STRING(255)). `wardrobe_library` has no brand column, only a
  free-text `vendor`. `updateWardrobeItem` maps `vendor` → `brand`, and the library copy paths drop
  it.
- **It does not link to the brand registry.** `lalaverse_brands` (`src/models/LalaverseBrand.js`) is
  linked to items only through `wardrobe_brand_tags` (`wardrobe_item_id` UUID, `brand_id` UUID). That
  table is written only by `POST /api/v1/wardrobe-brands/tag-piece`
  (`src/routes/wardrobeBrands.js:220`), which trusts `wardrobe_item_id` from the body without
  checking it against any store and never reads or writes `wardrobe.brand`. Neither registry table
  is read by any scoring code, and the migration
  (`20260224400000-create-notification-tables.js`) declares no `references`.
- `POST /api/v1/wardrobe-library/:id/assign-content` queries `wardrobe_brand_tags.wardrobe_item_id`
  (UUID) with `String(<integer library id>)` (`src/routes/wardrobeLibrary.js:401-402`). That can
  never match, and Postgres may reject it as invalid UUID input.
- **Brand matching compares strings.** Each match below is free text against free text:
  - `scoreSingleSlot`, `scorePieceForEvent`, `evaluateSocialProfileExpectation` and
    `scoreOutfitForEvent` use exact `===` / `includes` of `wardrobe.brand` against
    `world_events.host_brand` (`wardrobeIntelligenceService.js:286`, `:361`, `:556`, `:733`).
  - `computeWardrobeBonuses` uses a lowercased substring (`episodeCompletionService.js:84`).
  - `browse-pool` matches `host_brand` against **`aesthetic_tags`**, not `brand`
    (`src/routes/wardrobe.js:1007`, `:1051`).
  - `getWardrobePool` compares `brand_alignment` on the nonexistent `game_wardrobe`
    (`episodeOrchestrationRoute.js:68`).
- The analysis never writes a real brand (§5.1). An AI-filled item's brand is a generated fictional
  name, which will match an event's `host_brand` only by coincidence.

The host-brand side is already recorded and is cited here rather than restated. See
`docs/EVENT_EPISODE_FLOW.md` §8(p) "Organizer decisions" (Evoni, 2026-09-22, Task #1676):

- Ruling 2: a brand organizer is a `LalaverseBrand`, which has no association to `WorldEvent`.
- Ruling 6: `host_brand` is interim free-text storage, with its reader inventory.
- Observation 1: brand matching is exact or substring with no normalisation.
- Observation 2: `host_brand` lives in two places, the column and
  `canon_consequences.automation.host_brand`.
- Open question (a): `organizer_type` / `organizer_brand_id` → `lalaverse_brands`.

The deploy note `docs/audit/F-Deploy-1_Deploy_Late_2026-09-22.md` lists the commit that recorded the
two observations (#1679).

---

## 8. What a production count would answer, and the SQL to run it

**What it would answer:**

- How many live items exist in each item store.
- How many `wardrobe` rows came from the library, and how many of those now disagree with their
  source.
- How many library rows have no closet copy.
- How many event outfits disagree with the outfit their episode actually scores.
- How many snapshots point at deleted or missing items.
- How many outfit sets exist per mechanism.
- How many distinct brand strings exist, and how many match a registry name.
- Whether canon `episode_wardrobe` really lacks the columns §4.6 infers.

**Read-only SQL for Evoni to run. This document did not run it.** Column types follow the
2026-09-17 capture: `outfit_sets.items` is `json`, `outfit_pieces` is `jsonb`, and
`episode_wardrobe` has no `deleted_at`.

```sql
-- 1. Items per store
SELECT 'wardrobe' AS store,
       COUNT(*) FILTER (WHERE deleted_at IS NULL) AS live,
       COUNT(*) FILTER (WHERE deleted_at IS NOT NULL) AS soft_deleted
FROM wardrobe
UNION ALL
SELECT 'wardrobe_library (type=item)',
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND type = 'item'),
       COUNT(*) FILTER (WHERE deleted_at IS NOT NULL AND type = 'item')
FROM wardrobe_library
UNION ALL
SELECT 'wardrobe_library (type=set)',
       COUNT(*) FILTER (WHERE deleted_at IS NULL AND type = 'set'),
       COUNT(*) FILTER (WHERE deleted_at IS NOT NULL AND type = 'set')
FROM wardrobe_library;

-- 2. wardrobe rows by origin, and library rows with no live closet copy
SELECT
  COUNT(*) FILTER (WHERE w.library_item_id IS NULL) AS native_wardrobe_rows,
  COUNT(*) FILTER (WHERE w.library_item_id IS NOT NULL) AS library_sourced_rows,
  COUNT(*) FILTER (WHERE w.library_item_id IS NOT NULL AND (l.id IS NULL OR l.deleted_at IS NOT NULL))
    AS library_sourced_with_missing_or_deleted_source
FROM wardrobe w
LEFT JOIN wardrobe_library l ON l.id = w.library_item_id
WHERE w.deleted_at IS NULL;

SELECT COUNT(*) AS library_items_never_copied
FROM wardrobe_library l
WHERE l.deleted_at IS NULL AND l.type = 'item'
  AND NOT EXISTS (SELECT 1 FROM wardrobe w WHERE w.library_item_id = l.id AND w.deleted_at IS NULL);

-- 3. Library-sourced closet rows that disagree with their library source
SELECT
  COUNT(*) AS compared,
  COUNT(*) FILTER (WHERE w.name IS DISTINCT FROM l.name) AS name_differs,
  COUNT(*) FILTER (WHERE w.color IS DISTINCT FROM l.color) AS color_differs,
  COUNT(*) FILTER (WHERE w.description IS DISTINCT FROM l.description) AS description_differs,
  COUNT(*) FILTER (WHERE w.season IS DISTINCT FROM l.default_season) AS season_differs,
  COUNT(*) FILTER (WHERE w.brand IS DISTINCT FROM l.vendor) AS brand_vs_vendor_differs
FROM wardrobe w
JOIN wardrobe_library l ON l.id = w.library_item_id
WHERE w.deleted_at IS NULL AND l.deleted_at IS NULL;

-- 4. Event outfit vs the episode's scored outfit (for events used in an episode)
WITH ev AS (
  SELECT e.id AS event_id, e.used_in_episode_id AS episode_id,
         ARRAY(SELECT p ->> 'id'
               FROM jsonb_array_elements(COALESCE(e.outfit_pieces, '[]'::jsonb)) p
               WHERE jsonb_typeof(p) = 'object' AND p ? 'id'
               ORDER BY 1) AS event_ids
  FROM world_events e
  WHERE e.deleted_at IS NULL AND e.used_in_episode_id IS NOT NULL
), ep AS (
  SELECT ew.episode_id, ARRAY_AGG(ew.wardrobe_id::text ORDER BY ew.wardrobe_id::text) AS episode_ids
  FROM episode_wardrobe ew
  GROUP BY ew.episode_id
)
SELECT
  COUNT(*) AS events_used_in_episodes,
  COUNT(*) FILTER (WHERE cardinality(ev.event_ids) > 0) AS event_has_outfit,
  COUNT(*) FILTER (WHERE ep.episode_ids IS NOT NULL) AS episode_has_links,
  COUNT(*) FILTER (WHERE cardinality(ev.event_ids) > 0 AND ep.episode_ids IS NOT NULL
                   AND ev.event_ids <> ep.episode_ids) AS both_present_and_differ,
  COUNT(*) FILTER (WHERE cardinality(ev.event_ids) > 0 AND ep.episode_ids IS NULL) AS event_only,
  COUNT(*) FILTER (WHERE cardinality(ev.event_ids) = 0 AND ep.episode_ids IS NOT NULL) AS episode_only
FROM ev LEFT JOIN ep ON ep.episode_id = ev.episode_id;

-- 5. Snapshots and links pointing at missing or soft-deleted wardrobe rows
SELECT 'world_events.outfit_pieces' AS source,
       COUNT(*) AS refs,
       COUNT(*) FILTER (WHERE w.id IS NULL) AS missing,
       COUNT(*) FILTER (WHERE w.deleted_at IS NOT NULL) AS soft_deleted,
       COUNT(*) FILTER (WHERE w.id IS NOT NULL AND (p ->> 'brand') IS DISTINCT FROM w.brand) AS brand_snapshot_stale,
       COUNT(*) FILTER (WHERE w.id IS NOT NULL AND (p ->> 'tier') IS DISTINCT FROM w.tier) AS tier_snapshot_stale
FROM world_events e
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(e.outfit_pieces, '[]'::jsonb)) p
LEFT JOIN wardrobe w ON w.id::text = p ->> 'id'
WHERE e.deleted_at IS NULL AND jsonb_typeof(p) = 'object'
UNION ALL
SELECT 'outfit_sets.items', COUNT(*),
       COUNT(*) FILTER (WHERE w.id IS NULL),
       COUNT(*) FILTER (WHERE w.deleted_at IS NOT NULL),
       NULL, NULL
FROM outfit_sets s
CROSS JOIN LATERAL json_array_elements(COALESCE(s.items, '[]'::json)) i
LEFT JOIN wardrobe w ON w.id::text = i ->> 'id'
WHERE s.deleted_at IS NULL AND json_typeof(i) = 'object'
UNION ALL
SELECT 'episode_wardrobe', COUNT(*),
       COUNT(*) FILTER (WHERE w.id IS NULL),
       COUNT(*) FILTER (WHERE w.deleted_at IS NOT NULL),
       NULL, NULL
FROM episode_wardrobe ew
LEFT JOIN wardrobe w ON w.id = ew.wardrobe_id;

-- 6. Outfit sets per mechanism, and set ids that can't join
SELECT
  (SELECT COUNT(*) FROM outfit_sets WHERE deleted_at IS NULL) AS a_outfit_sets,
  (SELECT COUNT(DISTINCT outfit_set_id) FROM outfit_set_items) AS b_library_sets_with_items,
  (SELECT COUNT(*) FROM wardrobe WHERE deleted_at IS NULL AND (is_set OR parent_item_id IS NOT NULL)) AS c_wardrobe_set_or_piece_rows,
  (SELECT COUNT(*) FROM wardrobe WHERE deleted_at IS NULL AND outfit_set_id IS NOT NULL) AS c_wardrobe_free_text_set_id,
  (SELECT COUNT(*) FROM episode_outfits WHERE deleted_at IS NULL) AS d_episode_outfits,
  (SELECT COUNT(*) FROM world_events WHERE deleted_at IS NULL AND outfit_set_id IS NOT NULL) AS events_with_uuid_set_id,
  (SELECT COUNT(*) FROM episode_briefs WHERE outfit_set_id IS NOT NULL) AS briefs_with_uuid_set_id;

-- 7. Brand strings vs the registry
SELECT
  COUNT(DISTINCT w.brand) AS distinct_brand_strings,
  COUNT(DISTINCT w.brand) FILTER (WHERE EXISTS (
    SELECT 1 FROM lalaverse_brands b WHERE lower(b.name) = lower(w.brand))) AS match_a_registry_name,
  COUNT(*) FILTER (WHERE w.brand IS NULL OR w.brand = '') AS items_without_brand,
  COUNT(*) AS live_items
FROM wardrobe w
WHERE w.deleted_at IS NULL;

SELECT
  COUNT(*) AS brand_tags,
  COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM wardrobe w WHERE w.id = t.wardrobe_item_id)) AS tag_points_at_wardrobe_row,
  COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM wardrobe w WHERE w.id = t.wardrobe_item_id)) AS tag_points_at_nothing
FROM wardrobe_brand_tags t
WHERE t.deleted_at IS NULL;

-- 8. Confirm §4.6: the live episode_wardrobe and wardrobe.tags column shapes
SELECT table_name, column_name, data_type, udt_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND ((table_name = 'episode_wardrobe')
    OR (table_name = 'wardrobe' AND column_name IN ('tags', 'aesthetic_tags', 'event_types')))
ORDER BY table_name, column_name;
```

These queries were not run against any database by this document or this agent session. No host,
AWS, database or Cognito contact was made.

---

## 9. Options for Evoni (not a recommendation)

These are listed in no particular order, and this document does not rank them.

### Which store becomes the authority for a permanent item

**(a) `wardrobe` becomes the authority, and `wardrobe_library` is retired.** This matches what every
live surface already does (§2, §3). Retiring the library would mean deciding the fate of:

- its rows (query 2 says how many were never copied);
- its game-layer columns, which exist in canon but not in the model;
- `outfit_set_items`, `wardrobe_usage_history`, `wardrobe_library_references` and
  `wardrobe_content_assignments`, all keyed on library INTs;
- the three narrative and scene-set readers that use it;
- `analyze-image`'s home on the library router.

**(b) `wardrobe_library` becomes the authority, as originally designed, and `wardrobe` becomes a
per-episode instance.** This would reverse the live closet's write path. It would need:

- the model to declare the canon game-layer columns;
- a brand column;
- the copy paths to carry every field (§4.4);
- `bulkAssign`'s NOT NULL gap fixed;
- every scorer and picker in §3 moved to read through the copy's `library_item_id`, or the library
  directly.

**(c) Keep both, with a defined sync.** One side is written, and the other is derived on every write.
This needs a rule for which side wins on conflict (query 3 sizes the current conflicts), and it keeps
two id types (UUID and INTEGER) in every reference.

### What happens to the other stores, whichever wins

**Outfit sets.** Pick one of the four mechanisms (§1.3):

- A is the only one the UI writes.
- B is the only one with relational integrity, but it has no UI.
- C's `outfit_set_id` string is written but read by nothing.
- D is partly mounted and partly broken.

The UUID `outfit_set_id` columns on `world_events` and `episode_briefs` can't reference A or B as
typed. They would need retyping, dropping, or repointing, and each of those is a migration and
therefore Evoni's to run.

**Event outfit vs episode outfit (§4.1).** Choose which one the evaluation scores, and whether the
other becomes a view of it, a snapshot copied once, or a synced copy. Query 4 sizes how often they
disagree today.

**Snapshots (§4.2).** Either accept that they are point-in-time records, or re-read live values by
id.

**`episode_wardrobe` schema (§4.6).** If query 8 confirms the missing columns, there are two choices:

- The model and its writers are brought down to canon, following the pattern `/select` already uses.
- Canon gets the columns the model assumes. That is a migration, and Evoni's to run.

### What the analysis endpoint would need to fill an item completely

- **A code change:** `updateWardrobeItem` accepting `description`, so edits and AI Enhance stop
  dropping it.
- **A choice between** `analyze-image` (Sonnet 4.6, the gameplay-aware prompt the closet uses) **and**
  `wardrobeImageService.analyzeImage` (a different prompt and model id). The other could be retired,
  or they could be merged.
- **Somewhere to put** what has no column today: `colors[]`, `style_notes`, `material` /
  `subcategory` / `formality` (the second endpoint), and multiple occasions. Each could be its own
  column, a JSONB bag, or be discarded.
- **A provenance decision (§6).** Choose between two approaches:
  - per-field provenance, for example a JSONB column mapping each field name to `ai_suggested` or
    `confirmed`;
  - a single per-item flag or timestamp, for example "AI-filled, awaiting review";
  - or a convention in an existing column, with no schema change.

  Any new column is a migration, and Evoni's to run.
- **A brand decision (§7).** One option is to keep the model's real estimate somewhere instead of
  discarding it. The other is to move `wardrobe.brand` to a `lalaverse_brands` id, as §8(p)'s open
  question (a) proposes for `host_brand`, so that brand matching compares ids rather than strings.

---

## 10. What this document does not do

It does not:

- choose an authority, run any query, or write a migration;
- change any route, model, controller or component;
- fix any of the defects it records in passing (the `description` drop, `bulkAssign`'s NOT NULL
  gap, the approval handlers' alias, the `assign-content` UUID query, `createEpisodeOutfit`'s
  unbound `this`, the `game_wardrobe` reader);
- mint an FD, XK or PE number, or rule anything.

The stale `docs/WARDROBE_LIBRARY_API_REFERENCE.md` describes the library-first design and was not
followed.
