# Thumbnail system — census

## Status of this document

**Living design authority.** Not filed under `docs/audit/`, carries no basis-SHA
immutability rule, meant to be edited in place as the code changes. Mints
nothing, rules nothing — issue #1603 asked for an inventory, not a fix or a
design. New citations added to this document cite by stable name (component,
function, `TABS`/role key) with any line number paired alongside it, not by
line number alone, per `CLAUDE.md` Conventions.

Basis: `origin/main` at `4117b86ca19754144e039932310803a4a8e9f636` (2026-09-21,
after PR #1602).

---

## 1. Component inventory

| Component | Classification | Basis |
|---|---|---|
| `src/routes/compositions.js` | **Live.** Mounted, handles composition CRUD, asset assignment, generation triggers, versioning, search. | Route file itself; see §2 for what its handlers actually do. |
| `src/services/ThumbnailGeneratorService.js` | **Live**, but reachable only from one branch. Uses `sharp` for real image compositing (`ThumbnailGeneratorService.js:6,134,196,424,521` — `sharp(...)` calls, not stubs). Only invoked when `CompositionService.generateThumbnails` takes its "legacy generator" branch (`composition.template_studio_id` falsy) — see §2g. |
| `thumbnail_compositions` table (`ThumbnailComposition` model) | **Live, migrated in this repo.** `src/migrations/20260125000000-create-thumbnail-compositions.js` creates it; `20260127000001-add-thumbnail-compositions-deleted-at.js` follows on it. Modeled (`src/models/ThumbnailComposition.js`), actively read and written by `compositions.js`. |
| `composition_assets` table (`CompositionAsset` model) | **Live on canon, absent from this repo's migration tree — same schema-gap shape as `template_studio` below.** `grep -rln "composition_assets" src/migrations/` returns nothing; `20260125000000-create-thumbnail-compositions.js` (the migration a name-based guess would point to) creates only `thumbnail_compositions`, no junction table. `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt:422-429` shows `composition_assets` exists on canon with 8 columns, including a `deleted_at` the Sequelize model doesn't use (no `paranoid: true`, no `deleted_at` field in `src/models/CompositionAsset.js`). A fresh/local database migrated only from this repo's tree would have `thumbnail_compositions` but not `composition_assets` — meaning §2a's role-based asset-assignment path (`CompositionAsset.bulkCreate`) would fail on `relation "composition_assets" does not exist` outside canon. Whether canon has it *today*, re-verified live, is the same Evoni-gated question the cited census leaves open for `template_studio` — not re-checked here either. `src/models/CompositionAsset.js` itself: a junction table, `composition_id` → `thumbnail_compositions`, `asset_id` → `assets`, `asset_role` a free-text string, unique per `(composition_id, asset_role)`. |
| `TemplateStudio.jsx` | **Live page, dead onward path.** Fetches real templates from `/api/v1/template-studio` (`listTemplatesApi`) and lists them. Every action button (Edit → `/template-studio/designer/:id`, Clone/Publish/Lock/Archive/Delete → real API calls) works **except** `handleCreateNew`'s "+ New Template" navigates to `/template-studio/designer` (real — see `TemplateDesigner.jsx` below) and each **PUBLISHED** template's "Use Template" button navigates to `/composer?template=:id` (`TemplateStudio.jsx:357`) — **dead**, no matching route anywhere in `App.jsx` (verified: `grep -n "\"/composer\"" frontend/src/App.jsx` returns nothing). See §4. |
| `TemplateDesigner.jsx` (not named in the issue, but is where Template Studio's actual layout editing happens — `TemplateStudio.jsx` is only the list) | **Live.** Builds/edits `role_slots` and `canvas_config` on a `template_studio` row via drag-and-drop; imports the same `CANONICAL_ROLES` taxonomy as the backend (`TemplateDesigner.jsx:5`, `import { CANONICAL_ROLES } from '../constants/canonicalRoles'`). Does not itself select per-episode assets — it positions role slots, not asset instances. |
| `template_studio` table | **Live on canon, absent from this repo's migration tree.** Cited, not re-derived: `docs/audit/TemplateStudio_SchemaGap_Census_2026-09-06.md` §2 (MEASURED: zero hits for `template_studio` in `src/migrations/` or `src/models/`) and §4 (the table exists on canon RDS per a 2026-08-29 schema capture, all 18 columns matching what the code queries/inserts). That census's own caveat still applies: whether canon has it *today*, re-verified live, is Evoni-gated and not re-checked by this document. |
| `ThumbnailGallery.jsx` | **Mock.** `loadThumbnails()` sets a hard-coded three-item array (`ThumbnailGallery.jsx:26-60`) — no API call anywhere in the file. `handleDuplicate`/`handleDelete` (`:94-114`) call only `alert(...)`, no backend request. `handleEdit` (`:90-92`) navigates to `/episodes/:episodeId/thumbnail/:id` — **dead**, no matching route (verified against `App.jsx`). "+ New Thumbnail"/"Create Thumbnail" (`:153,203`) navigate to `/episodes` — not dead, but not a creation flow either, just the episode list. |
| `ThumbnailComposer.jsx` | **Missing.** Does not exist anywhere in the repo (`find . -iname "*ThumbnailComposer*"` — zero results, checked at both `frontend/src/` and repo root). No page lets a creator pick actual asset instances (an uploaded image, a specific Lala render, a wardrobe photo) for a specific episode's composition roles — see §2. |

---

## 2. The eight questions

### a. Can composition roles accept arbitrary episode Assets?

**Yes, at the data layer — no role-name allowlist and no visible ownership
check.** `compositions.js`'s `POST /` handler (`compositions.js:149`), role-based
branch (`isRoleBasedFormat`, `:177-333`): `assetData` is `req.body.asset_map`
or `req.body.assets`, an object whose keys become `asset_role` and whose
values become `asset_id` directly:

```js
// compositions.js:324-330
const compositionAssetRecords = Object.entries(assetData)
  .filter(([_role, assetId]) => assetId && typeof assetId === 'string')
  .map(([role, assetId]) => ({
    composition_id: composition.id,
    asset_id: assetId,
    asset_role: role,
  }));
```

No check against `CANONICAL_ROLES`/`isValidRole()` (`src/constants/canonicalRoles.js`)
runs in this handler — any string key is accepted as a role. No check that
`assetId` belongs to the episode being composed, or exists at all, is visible
in this code path (the DB foreign key on `composition_assets.asset_id` — see
`CompositionAsset.js:27-33` — enforces that the asset *exists*, not that it
belongs to this episode). The one enforced constraint is DB-level: one asset
per `(composition_id, asset_role)` pair (`CompositionAsset.js:67-71`, a
unique index).

**This whole path depends on `composition_assets` existing, and that table
has no migration in this repo's tree** (§1) — on a database migrated only
from `src/migrations/`, `CompositionAsset.bulkCreate(...)` (`compositions.js:333`)
would fail outright. Canon reportedly has the table (§1, citing the same
prior census as `template_studio`), so this path may work in the one
environment this repo's own tooling cannot reproduce locally.

### b–e. Uploaded episode image / Lala character asset / wardrobe visual / Phone screenshot — selectable?

**Yes at the data layer, for all four — no at the UI layer, for all four.**
`composition_assets.asset_id` references the generic `assets` table
(`CompositionAsset.js:30-33`), the same table `EpisodeAssetsTab.jsx` reads
per-episode assets from (`api.get('/api/v1/assets?episode_id=...')`, per
this file's own basis in issue #1601's work). Nothing in `compositions.js`
restricts which `asset_role` an asset with a given origin can be assigned to
— a wardrobe photo, an uploaded episode image, and a Lala render are all
just rows in `assets` with no role-type enforcement at write time.

**But no frontend surface exists to make that selection for a real episode.**
`ThumbnailComposer.jsx` is missing (§1). `TemplateDesigner.jsx` positions role
*slots* on a template canvas, not asset *instances* for one episode.
`TemplateStudio.jsx`'s only path toward using a template on an episode is the
dead `/composer` route (§1, §4). So: technically possible in the schema and
in what `POST /compositions` will accept, not reachable through any working
page today.

Whether wardrobe/outfit visuals must first become `assets` rows before they
could be selected this way — **does not resolve** from this census; the
wardrobe-to-asset pipeline (if one exists) wasn't traced, since no UI reaches
that selection step regardless.

### f. Which text fields does Template Studio expose?

**Four, all in `src/constants/canonicalRoles.js`'s `TEXT` category** (mirrored
byte-for-byte in content, reordered only, in `frontend/src/constants/canonicalRoles.js`
— verified: both files list the same 29 role keys; a raw line-diff shows
384 differing lines, all attributable to declaration order and trailing-comma
style, not content — spot-checked `TEXT.SHOW.TITLE`'s full block in both
files, identical):

- `TEXT.SHOW.TITLE` — "Show Title," default font size 48, bold
- `TEXT.CUSTOM.1` / `TEXT.CUSTOM.2` / `TEXT.CUSTOM.3` — "Custom Text 1/2/3,"
  default font size 36, normal weight

All four carry `isTextField: true` and a `defaultStyle` (font family, size,
weight, color, alignment, stroke). None is `required: true`. `TemplateDesigner.jsx`
reads `CANONICAL_ROLES` directly (`TemplateDesigner.jsx:5,532,609,754,948,997,1075,1111`)
so these four are available in its role palette like any other role — nothing
in the file singles text roles out for different handling that this census
found.

### g. Does the generator produce 1280×720 YouTube output today?

**Not as the default or the only YouTube option — 1280×720 exists as a
separate, distinctly-named format that no frontend surface offers.**

Three independent format tables exist, not obviously kept in sync:

| Source | YouTube-labelled entries |
|---|---|
| `TemplateDesigner.jsx:44-51` (`THUMBNAIL_FORMATS.YOUTUBE`) | 1920×1080 only |
| `ThumbnailGeneratorService.js:12-29` (`THUMBNAIL_FORMATS`, its own MVP-scoped constant) | 1920×1080 (`YOUTUBE`) — no 1280×720 entry at all |
| `CompositionService.js:401-410` (`allFormats`, inside `generateThumbnails`) | `YOUTUBE` 1920×1080 **and** `YOUTUBE_MOBILE` 1280×720, as two separate named formats |

`CompositionService.generateThumbnails`'s legacy-generator branch (the one
taken when `composition.template_studio_id` is falsy, per §1's
`ThumbnailGeneratorService.js` row) filters `allFormats` by whatever
`selectedFormats` the caller passed
(`CompositionService.js:413`) and calls
`ThumbnailGeneratorService.generateThumbnail(composition, format)` per match
— so the *backend* can produce 1280×720 output if a caller's
`selected_formats` includes the literal string `'YOUTUBE_MOBILE'`. No
frontend format picker found in this census (`TemplateDesigner.jsx`'s own
`THUMBNAIL_FORMATS`) lists `YOUTUBE_MOBILE` as an option — it isn't offered
anywhere a creator would see it.

### h. What does "set primary thumbnail" actually update?

`CompositionService.setPrimary` (`CompositionService.js:231-286`), called
from `PUT /:id/primary` (`compositions.js:530`):

1. Unsets `is_primary` on every other `ThumbnailComposition` row for the same
   `episode_id` (`:254-262`).
2. Sets `is_primary: true` on this one (`:265`).
3. If this composition has a `CompositionOutput` with `status: 'READY'`, takes
   the first one and attempts to write its `image_url` onto the episode's
   `thumbnail_url` (`:268-277`).

**Step 3's write looks broken, on a plain read of the code — not
independently reproduced against a running database by this session:**

```js
// CompositionService.js:270-273
if (composition.episode) {
  await composition.models.Episode.update({
    thumbnail_url: primaryOutput.image_url,
  });
```

`composition` is a `ThumbnailComposition` Sequelize instance. Standard
Sequelize instances expose the model registry at `instance.sequelize.models`,
not `instance.models` — this census found no code in the repo that attaches a
`.models` property to model instances. If that reading holds, this call
throws (`Cannot read properties of undefined (reading 'Episode')`) whenever
step 3 is reached (a READY output exists), meaning the visible, checkable
half of "set primary" (`is_primary` flipping) succeeds, but the half a
creator would actually notice — the episode's thumbnail changing — does not.
**INFERRED from the code's own shape, not MEASURED by running it** — this
session has no database to execute against.

---

## 3. `/episodes/:id/scene-composer` call sites

No route named `scene-composer` exists anywhere in `frontend/src/App.jsx`, at
any path — not episode-scoped, not studio-scoped. The feature that plays that
role today is `SceneStudioPage`, at `/studio/scene/:sceneId` and
`/studio/scene-set/:sceneSetId` (`App.jsx:366-367`). Every call site below is
therefore dead regardless of which meaning it carries.

| File:line | Meaning | Live or dead code | Notes |
|---|---|---|---|
| `EpisodeAssetsTab.jsx:181` | Thumbnails | **Live** (reachable button) | Added by #1601, preserving the pre-#1601 target verbatim — see PR #1602. |
| `EpisodeDetail.jsx:441` | Thumbnails ("Create a thumbnail") | **Dead code** | Inside `getPrimaryNextAction` (`EpisodeDetail.jsx:428-462`), which is never called anywhere else in the file — confirmed via `grep -n "getPrimaryNextAction\|getOtherSteps" EpisodeDetail.jsx`, zero call sites beyond the functions' own definitions and their one mutual reference. |
| `EpisodeDetail.jsx:470` | **Scene Composer** ("Add Scenes") | **Dead code** | Inside `getOtherSteps` (`:465-491`), same dead-function finding as above. |
| `EpisodeDetail.jsx:476` | Thumbnails ("Create Thumbnail") | **Dead code** | Same function, same finding. |
| `ProductionTab.jsx:425` | **Scene Composer**, explicit `title="Scene Composer"` | Live | `ProductionTab` is rendered by `UniverseProductionPage.jsx`, a URL-only page (`/universe/production`) per `docs/PAGE_INVENTORY.md` §6 — reachable, not linked from navigation. |
| `Home.jsx:268` | **Scene Composer** (studio-level, `/studio/scene-composer` — a different path from the other five, not episode-scoped) | Live (Home is the landing page) | Already named in `PROJECT_CONTEXT.md` §4.6's "Known debt" line as a stale nav target — this census reconfirms it independently rather than citing that line as the only evidence. |

Three of six call sites (all three inside `EpisodeDetail.jsx`) are inside
functions no render path invokes — a real user cannot reach them regardless
of where the route points. The three live sites split 2 Scene Composer / 1
thumbnails; the three dead-code sites split 2 thumbnails / 1 Scene Composer.
Fixing the route target therefore has to answer two separate questions
(where should "create a thumbnail" go, where should "add scenes" go), not
one.

---

## 4. Dead links in the thumbnail frontend

| Component | Action | Target | Status |
|---|---|---|---|
| `ThumbnailGallery.jsx:91` | Edit (per-thumbnail) | `/episodes/:episodeId/thumbnail/:id` | **Dead** — no matching route in `App.jsx`. |
| `ThumbnailGallery.jsx:153,203` | "+ New Thumbnail" / "Create Thumbnail" (empty state) | `/episodes` | Not dead, but not a creation flow — lands on the episode list with no thumbnail-specific context. |
| `TemplateStudio.jsx:357` | "Use Template" (PUBLISHED templates only) | `/composer?template=:id` | **Dead** — no matching route in `App.jsx`. This is the only path `TemplateStudio.jsx` itself offers from "I have a published template" to "apply it to something." |

`TemplateStudio.jsx`'s other targets (`/template-studio/designer`,
`/template-studio/designer/:templateId`) are real routes to `TemplateDesigner.jsx`
and are not dead.

---

## 5. What this leaves unresolved

This census answers what the code does today; it does not choose a remedy,
per the issue's own scope. Left open, named rather than silently skipped:

- Whether canon RDS still has `template_studio` right now — Evoni-gated,
  cited not re-derived (§1).
- Whether the wardrobe-to-`assets` pipeline exists, and if so where (§2b–e).
- Whether `CompositionService.setPrimary`'s apparent `.models` bug (§2h) has
  ever actually thrown in production, or whether some other code path
  compensates for it — this census read the code, it did not run it.
- Which of the two live-but-misdirected `/scene-composer` meanings (Scene
  Composer vs. thumbnails) each of the three dead-code call sites in
  `EpisodeDetail.jsx` was meant to serve, if that dead code is ever revived
  rather than deleted.
