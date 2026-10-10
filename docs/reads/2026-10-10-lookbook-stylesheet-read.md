# Read: data and storage for the Lookbook and style sheet

- **Basis:** `origin/main` at `a1705862e62534cba05126b0edf44d37fd76855d` (all `path:line` below are at this SHA)
- **Date:** 2026-10-10
- **Task:** #2806
- **Spec:** `docs/design/2026-10-landing-and-stylesheet.md` (#2803), Part 2. Not on main at the basis SHA (`git cat-file` reports it "exists on disk, but not in 'a1705862'"). It was read from the working tree of branch `claude/issue-2803-design-specs`.
- No host, AWS, database, or Cognito contact.
- Changes no code.

Markers: **MEASURED** means a `path:line` read at the basis SHA. **INFERRED** means a conclusion drawn from measured code, with the reason given.

---

## §1 Style sheet value → where it lives today

Mounts: episodes at `/api/v1/episodes` (`src/app.js:673`), wardrobe at `/api/v1/wardrobe` (`src/app.js:787`), world events at `/api/v1` (`src/app.js:815`), scene sets at `/api/v1/scene-sets` (`src/app.js:1553`), tier at `/api/v1/tier` (`src/app.js:1396`). **MEASURED**

**The episode's event.** `GET /api/v1/episodes/:id/events` (requireAuth, `src/routes/episodes.js:317`) calls `listEpisodeEvents` (`src/services/episodeEventsService.js:58`). The anchor is `EpisodeBrief.event_id` first (`:64-65`). If that is missing, it falls back to the first event whose `world_events.used_in_episode_id` is this episode (`:69`, `:85-87`). It returns full `WorldEvent` rows. The frontend wrapper is `getEpisodeAnchorEvent` (`frontend/src/services/episodeEventsApi.js:15`). **MEASURED**

| Sheet value | Model/table · field | Route (method path, auth) | Notes |
|---|---|---|---|
| Episode number | `episodes.episode_number` (`src/models/Episode.js:19`) | `GET /api/v1/episodes/:id`, requireAuth (`src/routes/episodes.js:515`) | "EPISODE 0n" is a zero-pad done at render time. **MEASURED** |
| Episode name | `episodes.title` (`Episode.js:46`); `title_card_title` (`:224`) | same | The sheet shows the event name, not the episode title; the title is optional. **INFERRED** from the spec template |
| Event name | `world_events.name` (`src/models/WorldEvent.js:44`) | `GET /api/v1/world/:showId/events/:eventId`, requireAuth (`src/routes/worldEvents.js:161`), or the episode events route above | The single-event route returns `event` as a raw `SELECT *` (`:171`). **MEASURED** |
| Host | `host` (`WorldEvent.js:76`), `host_brand` (`:81`), `source_profile_id` → `social_profiles.display_name/handle` (`:167`) | the single-event route returns `sourceProfile` (`worldEvents.js:195`) and `startedFromProfile` (`:206-212`) | There are two homes for the host: the profile id is also at `canon_consequences.automation.host_profile_id`. `resolveEventOrganizer`-style logic lives in `frontend/src/utils/eventReadiness.js` (after `:60`). Display order: profile display_name → host_brand → host. **MEASURED** (fields); the order is **INFERRED** |
| Type | `format` (`WorldEvent.js:68`) or `category` (`:60`); `event_type` (`:48`) is a game mechanic (`invite \| upgrade \| guest …`, `:52`) | event routes | Use `format` (fallback `category`) for TYPE, not `event_type`. **INFERRED**: `event_type` values are not human event types |
| Dress code | `dress_code` STRING(200) (`:196`); location fallback `world_locations.venue_details.dress_code` | event routes; `venueLocation.dress_code` (`worldEvents.js:230-242`) | The reference "elevated contemporary, smart-casual" fits `dress_code`. **MEASURED** |
| Date / time (WHEN) | `event_date`, `event_time` STRING(50), free text (`:132`, `:137`); fallback `canon_consequences.automation.event_date/time` | event routes; resolution in `resolveEventVenueAndDate` (`frontend/src/utils/eventReadiness.js:28`) | These are free text, not timestamps ("Thu, Nov 12, 6:30 PM" is stored as written). The renderer must not parse them. **MEASURED** |
| Keywords / mood words | `dress_code_keywords` JSONB (`:200`) | event routes | The spec's "Mood words (event keywords)". **MEASURED** field; the mapping is **INFERRED** from the spec |
| Vibe | `mood` STRING(100), `theme` STRING(100) (`:151-152`); also `venue_look.overall` (`:156`); `world_locations.venue_details.vibe_tags`; `scene_sets.mood_tags` (`src/models/SceneSet.js:81`) | event routes; `GET .../events/:eventId/venue-look` (`worldEvents.js:2598`) | The Ep 1 VIBE list matches keyword style. Prefer `mood`, then `dress_code_keywords`. **INFERRED** |
| Palette seed | `color_palette` JSONB (`WorldEvent.js:153`) | event routes | An invitation style field, possibly null. The spec derives the palette from piece images. **MEASURED** |
| Venue name | `venue_name` (`:103`), fallback automation copy; `world_locations.name` | event routes; `venueLocation` (`worldEvents.js:230-242`) | **MEASURED** |
| Venue city / district | `world_locations.city`, `district` STRING(100), free text (`src/models/WorldLocation.js:66`, `:70`); `world_events.venue_address` (`WorldEvent.js:108`) | **No episode/event route returns them.** `venueLocation` is limited to `id, name, venue_type, venue_details` (`worldEvents.js:234`). `GET /api/v1/tier/world-locations` returns full rows, but only as a whole-list scan (`src/routes/tierFeatures.js:398`) | `venue_address` is composed as `street_address, district, city` (`worldEvents.js:2963`, `:583`). The DREAM-city keys (`echo_park` …) are labelled by `CITY_LABELS` (`frontend/src/pages/WorldStudio.jsx:392`; `frontend/src/lib/characterPage.js:25`). That labelling is used for `social_profiles.city` (`frontend/src/pages/CharacterProfilePage.jsx:904`), not for locations. S2 should add `city`/`district` to `venueLocation`. **MEASURED** |
| Venue image (look) | `scene_set_looks.image_url` per (scene_set_id, event_id) (`src/migrations/20261002130000-create-scene-set-looks.js`); `scene_sets.base_still_url` (`SceneSet.js:85`); `world_locations.approved_base_image_url` (`WorldLocation.js:112`) | `GET /api/v1/world/:showId/events/:eventId/look`, requireAuth (`worldEvents.js:2653`) → `eventLook` (`src/services/venueLookImageService.js:263-301`) returns `scene_set`, `approved_base`, `look` | Pre-fill order: dressed look → set base → approved base. **INFERRED** |
| Venue angles | `scene_angles.still_image_url`, `enhanced_still_url`, `thumbnail_url`, `angle_label`, `angle_name`, `sort_order` (`src/models/SceneAngle.js:21-22`, `:45-47`, `:63`, `:73`) | `GET /api/v1/scene-sets/:id`, requireAuth, includes `angles` ordered by `sort_order` (`src/routes/sceneSetRoutes.js:456-471`) | `world_events.scene_set_id` (`WorldEvent.js:124`). **MEASURED** |
| Saved look pieces | `episode_wardrobe` (approved links) ⨝ `wardrobe` | `GET /api/v1/wardrobe/outfit/:episode_id`, requireAuth (`src/routes/wardrobe.js:312`): approved links only (`:336`) | `episodeLook()` (`src/services/episodeLookCharges.js:140-191`) is the one rule: locked → chosen (not rejected) → event `outfit_pieces` → none, with `image_url = thumbnail_url ‖ s3_url_processed ‖ s3_url` (`:151`). It is returned as `episodeLook` by the single-event route (`worldEvents.js:304-308`, `:317`). The sheet should use `episodeLook`, not `/outfit` (which shows nothing until approval). **MEASURED** / **INFERRED** |
| Piece slot | `wardrobe.clothing_category` → slot via `getSlotForCategory` (`src/utils/wardrobeSlots.js`, `SLOT_KEYS` `:17`, `SLOT_DEFS` `:22-28`) | (pure util; frontend twin `frontend/src/lib/wardrobeSlots.js`) | BODY = `outfit` (dress/top/bottom/outerwear). SHOES = `shoes`. JEWELRY = `jewelry`. PERFUME = `fragrance` (`perfume`). BAG = category `bag` only, inside the `accessories` slot (`:26`). The sheet must split `accessories` by raw category. HAIR is an *alias* to `accessory` (`src/utils/wardrobeSlots.js:57`), so closet hair pieces would land in accessories. Per the spec, HAIR and NAILS come from the Lookbook. **MEASURED** |
| Piece name / image | `wardrobe.name` (`src/models/Wardrobe.js:18`), `thumbnail_url` (`:64`), `s3_url_processed` (`:59`), `s3_url` (`:49`), `primary_image_variant` (`:92`) | as above | **MEASURED** |
| Required slots ("Needed") | `shows.metadata.required_slots`, else `SLOT_DEFS[*].required` (outfit, shoes) (`src/services/wardrobeSlotCoverageService.js:22-28`) | `GET /api/v1/wardrobe/slot-coverage?show_id=`, requireAuth (`wardrobe.js:504`); set via `PUT /shows/:id/wardrobe-config` (`src/routes/shows.js:1321`, `:1332`) | slot-coverage measures the show's **inventory**, not the episode's look (`wardrobeSlotCoverageService.js:5-13`). Body "Needed" on the sheet = a required slot with no piece in `episodeLook().pieces`. Compute this with `requiredSlotsFor(show)` + `getSlotForCategory`. **MEASURED** / **INFERRED** |
| Show logo | none: `shows` has `cover_image_url`, `icon` (emoji) only (`src/models/Show.js:111`, `:126`); no logo file under `frontend/public` (only `favicon.svg`, `sw.js`) | — | Needs a committed asset or text lettering. **MEASURED** |
| LalaVerse map | `DreamMap` takes `mapImageUrl` with a default (`frontend/src/components/DreamMap.jsx:12`) | — | Where the default map image lives was not traced. **INFERRED**: open question §6 |
| Lala's coins | — | — | Not needed on the sheet. Note only. |

## §2 Image upload and storage today

- **`uploadPng`** (`src/services/episodeTitleOverlayService.js:376-386`). The bucket is `S3_PRIMARY_BUCKET ‖ AWS_S3_BUCKET`. If neither is set, it returns a `data:<type>;base64,…` URL and stores that string as the URL. With a bucket, it does `PutObjectCommand` with `ContentType` and `CacheControl: max-age=31536000` and returns `https://<bucket>.s3.<region>.amazonaws.com/<key>`. Keys: `overlays/episode-title-text/<episodeId>/<uuid>.<ext>` (`:426`, `:527`) and `overlays/episode-title-flourish/<episodeId>/<uuid>.png` (`:565`). **MEASURED**
- **`uploadToS3`** (`src/services/invitationGeneratorService.js:109-120`). Bucket `S3_PRIMARY_BUCKET ‖ AWS_S3_BUCKET ‖ S3_BUCKET_NAME` (`:52`). Key `invitations/<eventId>/<uuid>-<suffix>.png`, with S3 `Metadata`. No data-URL fallback here. The delete helper returns early without a bucket (`:122-123`). **MEASURED**
- **Wardrobe**: bucket `S3_PRIMARY_BUCKET ‖ AWS_S3_BUCKET ‖ S3_BUCKET_NAME ‖ 'episode-metadata-storage-dev'` (`src/controllers/wardrobeController.js:22-27`). Key `wardrobe/<character>/<uuid>.<ext>` (`:160`) and `-nobg.png` (`:307`). **MEASURED**
- **Episode thumbnail**: a fourth bucket rule, `S3_BUCKET ‖ 'episode-metadata-storage-dev'`, via `S3Service.uploadFile`. Key `thumbnails/<id>/<uuid>.<ext>` (`src/routes/episodes.js:568-575`). **MEASURED** It is inconsistent with the others (see §6).
- **Multer limits** (all memoryStorage, 10 MB):
  - title-overlay upload: PNG/JPEG/WebP only, file field `file`, `LIMIT_FILE_SIZE` mapped to a 400 (`episodes.js:454-466`).
  - thumbnail: any `image/*`, field `thumbnail` (`:539-546`, `:551`).
  - wardrobe: any `image/*` (`src/routes/wardrobe.js:92-104`).

  **MEASURED**
- **Content types**: `UPLOAD_TYPES = { png, jpg, webp }` with a 400 `INVALID_TYPE` otherwise (`episodeTitleOverlayService.js:512`, `:521-523`). **MEASURED**
- **Assets table** (`src/models/Asset.js`, `tableName: 'assets'` `:246`, `paranoid: true` `:252`). The title overlay inserts `id, name, asset_type='UI_OVERLAY', asset_role='UI.OVERLAY.EPISODE_TITLE_TEXT', asset_group='EPISODE', asset_scope='EPISODE', purpose='MAIN', category='overlay', entity_type='prop', s3_url_raw, s3_url_processed, show_id, episode_id, metadata` (`episodeTitleOverlayService.js:44`, `:454-461`). Unused columns available: `content_type`, `width`, `height`, `file_size_bytes`, `file_name`, `s3_key_raw/processed`, `approval_status`, `color_palette`, `mood_tags` (`Asset.js:83-122`, `:209-214`). **MEASURED**
- **Soft delete / replace**: a new overlay soft-deletes earlier rows of the same role with `UPDATE assets SET deleted_at = NOW()` (`:464`), and their `timeline_placements` too (`:477`). S3 objects are not deleted on that path. **MEASURED**
- **Ownership**: none beyond `requireAuth`. The episode routes and the overlay service never read `req.user` (`git grep req.user` on both files is empty), and `Episode`/`Show` carry no owner column. Scoping is "the episode exists and is not deleted" (`episodes.js:322-325`; `loadEpisode` `episodeTitleOverlayService.js:298`). **MEASURED** This matches the solo-operator model. S2 should still check `deleted_at IS NULL` on the episode and that every image row's `episode_id` matches the route param.

## §3 Rendering: node-canvas server-side vs browser

**What exists.** `canvas ^3.2.1` and `sharp ^0.35.5` are dependencies (`package.json:75`, `:102`). They are lazy-required, and compositing is disabled if they are missing (`src/services/invitationCompositingService.js:22-28`). `renderTitleOverlay` draws a 1920×1080 transparent PNG with `createCanvas` (`episodeTitleOverlayService.js:50-51`, `:196-201`). Images are loaded server-side by `axios` → `loadImage`, including `data:` URLs (`:388-394`). Fonts are committed under `src/assets/fonts`:
- `invitation/`: Cormorant Garamond Regular/Bold/Italic and Libre Baskerville Regular/Italic/Bold, registered at `invitationCompositingService.js:69-74`.
- `documents/`: Caveat Regular/SemiBold, registered at `src/services/eventDocumentOverlayService.js:62-67`.

There is a Liberation Serif system fallback (`invitationCompositingService.js:86-100`). **MEASURED**

**Gaps for the sheet.** The UI fonts Lora, DM Mono, DM Sans and Playfair are loaded only from Google Fonts in `frontend/index.html:11`. None is committed as TTF. **MEASURED** The "pink script" and "gold serif" lettering would map to Caveat and Cormorant (committed) or need new OFL files. **INFERRED**

**Browser path.** `html2canvas ^1.4.1` is already in the frontend (`frontend/package.json:20`), used in `frontend/src/utils/wardrobeEnhancements.js:260`. The app knows S3 images are not CORS-safe in a canvas: `StudioCanvas.jsx:75` says "Load without crossOrigin to avoid CORS failures on S3 images", and `ParallaxLayer.jsx:169` says "If CORS loading fails (S3 not configured)". A DOM-to-PNG render of S3 images would therefore taint the canvas and fail `toBlob`, unless the bucket's CORS allows the app origin (unverifiable here: no AWS contact). **MEASURED** (comments) / **INFERRED** (outcome)

**Recommendation: render the PNG server-side with node-canvas** (a new `styleSheetRenderService` modelled on `renderTitleOverlay`), at 1024×1536, upload with an `uploadPng`-style helper, and record it as an `assets` row (e.g. `asset_role = 'EPISODE.STYLE_SHEET'`). Show the live preview in the tab as plain HTML/CSS with the same layout.

Reasons:
1. The server fetches the images with axios, so CORS never applies.
2. The fonts are deterministic (registered TTFs, not whatever the browser has).
3. It reuses the existing pattern: canvas + data-URL fallback + assets row + soft delete.
4. The output is a stored canonical image that Release, the Feed and the site can reference later (the spec's "later wiring").
5. The cost is $0, with no AI call.

Costs of this choice: a second layout implementation (HTML preview vs canvas) that can drift; commit OFL Lora/DM Mono (or accept Cormorant/Caveat/Libre Baskerville); WebP inputs may need `sharp` → PNG before `loadImage`. **INFERRED**: node-canvas WebP support was not verified at this SHA.

## §4 What's missing, and a migration plan (plan only)

Nothing at the basis stores look photos, Lookbook hair/nails/beauty, venue selections, inspo, palette, tagline or sheet status. There is no episode-look table: the "look" is derived from `episode_wardrobe` (`episodeLookCharges.js:140-191`). `models/` has no look/beauty/lookbook model; `hair_library` is a show-level style catalogue (`src/models/HairLibrary.js:29`, `:55`, `paranoid: false` `:111`), not per-episode. **MEASURED** The spec says "Hair, nails and beauty are fields on the episode's look, not closet items". The plan below gives that "look" record its own table, one row per episode.

**Migration A: `episode_lookbooks`** (one live row per episode)
- `id` UUID PK default `gen_random_uuid()`
- `episode_id` UUID NOT NULL, FK `episodes(id)` ON DELETE CASCADE
- `show_id` UUID NULL, FK `shows(id)`
- `hair_name` VARCHAR(120) NULL; `nails_name` VARCHAR(120) NULL
- `beauty_notes` JSONB NOT NULL default `'{}'`: `{ eyes, lips, skin }`, text, each ≤ 600 chars
- `palette` JSONB NULL: `[{ hex, source: 'auto'|'edited' }]`, 5 entries
- `mood_words` JSONB NULL (override; null = read from event keywords)
- `tagline` VARCHAR(200) NULL
- `sheet_status` VARCHAR(20) NOT NULL default `'draft'` CHECK IN (`draft`, `approved`)
- `approved_at` TIMESTAMPTZ NULL; `approved_by` VARCHAR(255) NULL
- `sheet_asset_id` UUID NULL, FK `assets(id)`: the rendered PNG
- `sheet_inputs_hash` VARCHAR(64) NULL, to mark an approved sheet stale when its inputs change
- `created_at`, `updated_at` NOT NULL default NOW(); `deleted_at` TIMESTAMPTZ NULL
- Index: `UNIQUE (episode_id) WHERE deleted_at IS NULL`.

**Migration B: `episode_lookbook_images`**
- `id` UUID PK
- `lookbook_id` UUID NOT NULL, FK `episode_lookbooks(id)`
- `episode_id` UUID NOT NULL, FK `episodes(id)` (denormalised for the scope check)
- `category` VARCHAR(20) NOT NULL CHECK IN (`unsorted`, `front`, `side`, `back`, `hero`, `hair`, `nails`, `eyes`, `lips`, `skin`, `venue`, `inspo`). `unsorted` is the "To sort" tray.
- `source` VARCHAR(20) NOT NULL default `'upload'` CHECK IN (`upload`, `scene_set_look`, `scene_set_base`, `scene_angle`, `texture_auto`)
- `image_url` TEXT NULL (upload or texture). `s3_key` TEXT NULL.
- `scene_set_id` UUID NULL; `scene_angle_id` UUID NULL, FK `scene_angles(id)`; `scene_set_look_id` UUID NULL, FK `scene_set_looks(id)`. These are references for pre-filled venue items, so no copy is stored.
- `wardrobe_id` UUID NULL, FK `wardrobe(id)` (the piece an auto texture was cut from)
- `in_lookbook` BOOLEAN NOT NULL default true (the venue "In lookbook" toggle)
- `sort_order` INTEGER NOT NULL default 0
- `content_type` VARCHAR(50), `width` INT, `height` INT, `file_size_bytes` INT, `file_name` VARCHAR(255)
- `created_at`, `updated_at`, `deleted_at`
- Indexes:
  - `(episode_id, category) WHERE deleted_at IS NULL`
  - `UNIQUE (lookbook_id, category) WHERE deleted_at IS NULL AND category IN ('front','side','back','hero','hair','nails','eyes','lips','skin')` (single-slot categories; a replace soft-deletes the old row, as the title overlay does)
  - `UNIQUE (lookbook_id, scene_angle_id) WHERE deleted_at IS NULL AND scene_angle_id IS NOT NULL`

Alternative considered: storing images as `assets` rows with `asset_role = 'EPISODE.LOOKBOOK.<CATEGORY>'`. It reuses the paranoid table and the role convention, but venue toggles and auto textures need FKs that `assets` lacks. **INFERRED**: the dedicated table is cleaner. The rendered sheet itself still fits `assets`.

Both migrations go under `src/migrations/` only, are guarded with `to_regclass` (like `20261002130000-create-scene-set-looks.js`), with models registered in `src/models/index.js`. Never `sync()`.

**Routes S2 would add** (all `requireAuth`, `validateUUIDParam('id')`, mounted on `/api/v1/episodes`, each verifying the episode is live and that the row's `episode_id` equals `:id`):
- `GET /:id/lookbook`: the row (lazily created), images by category, the venue pre-fill (from `eventLook` + `GET /scene-sets/:id` angles), readiness `{ done, total: 11, missing[] }`
- `PUT /:id/lookbook`: `hair_name, nails_name, beauty_notes, palette, mood_words, tagline` (refused with 409 while `approved` unless reopened)
- `POST /:id/lookbook/images`: multer memoryStorage, 10 MB, PNG/JPEG/WebP, `files[]` (batch, into `unsorted` unless `category` is given)
- `PATCH /:id/lookbook/images/:imageId`: `{ category?, in_lookbook?, sort_order? }` (sort from the tray, venue toggle)
- `DELETE /:id/lookbook/images/:imageId`: soft delete
- `POST /:id/lookbook/venue/:angleId/toggle`: or fold into PATCH with lazy row creation for pre-filled items
- `POST /:id/lookbook/textures`: crop two textures from piece images (sharp, $0)
- `POST /:id/style-sheet/preview` → PNG (data URL, not stored); `POST /:id/style-sheet/approve` → render, upload, `assets` row, `sheet_status='approved'`; `POST /:id/style-sheet/reopen`; `GET /:id/style-sheet` → state + PNG URL for download.

**Readiness "x of 11".** The spec's 11 tray categories are front, side, back, hero, hair, nails, eyes, lips, skin, venue, inspo (spec Part 2, "Batch drop zone"). Proposed counting: one point per category with at least one live image. `venue` needs ≥1 image with `in_lookbook = true` (pre-filled or uploaded). `inspo` needs ≥1 upload; auto textures don't count, because they always exist once pieces have images. Hair/nails names are flagged but not counted. **INFERRED**: the spec does not define the counting, so Evoni should confirm (§6).

## §5 Production checklist and the tab list

- **Checklist.** `CHECKLIST_SECTIONS` (`frontend/src/components/Episodes/EpisodeProductionChecklist.jsx:18`) holds the cards: brief, world, scene, wardrobe (`:57-66`), overlays/Lala's Phone (`:69-75`), onscreen, social, intelligence. `loadProductionChecks(episode, showId)` (`:241`) fills `results[itemId]` by one try/catch per API read, e.g. the locked outfit at `:337-343`. Fix buttons map item ids to hrefs in `checklistFixTarget` (`:178-205`). `allRequired` over every `required: true` item gates Write Script (`:533-536`). **MEASURED**
- **S5 Lookbook card.** Add a section `{ id: 'lookbook', label: 'Lookbook', items: [{ id: 'lookbook_ready', label: 'Style sheet inputs (x of 11)', required: false }, { id: 'style_sheet_approved', label: 'Style sheet approved', required: false }] }` between `wardrobe` and `overlays`. Add a block in `loadProductionChecks` reading `GET /api/v1/episodes/:id/lookbook` and setting `checkNotes.lookbook_ready = '7 of 11 · missing: …'`. Add `checklistFixTarget` entries `{ href: /episodes/:id?tab=lookbook }`. Keep both items `required: false`, so the Lookbook never blocks the script. **INFERRED**
- **Tab list.** The Production sub-tabs are not defined in `EpisodeDetail.jsx`. They are in `EP_TABS` in `frontend/src/utils/episodeTabs.js:11`, with `wardrobe` at `:20` and `phone` at `:21`. S3 inserts `{ key: 'lookbook', label: 'Lookbook' }` between them. **MEASURED** `EpisodeDetail.jsx` renders the pills from `EP_TABS` (`:756-773`) and each body by `tabKey`: `production.wardrobe` at `:843` and `production.phone` at `:920`. S3 adds `{tabKey === 'production.lookbook' && <EpisodeLookbookTab …/>}` between them. `?tab=lookbook` resolves automatically through `findEpisodeTab`; `frontend/src/utils/episodeTabs.test.js` exists and should gain a case. **MEASURED**

## §6 Risks and open questions

1. **City is not served.** No episode/event route returns `world_locations.city/district` (`worldEvents.js:234`). These are free text, while the DREAM-city keys (`echo_park`) live on `social_profiles.city`. Which wins for the chip: the location's city, the location's district, or the host profile's city? The sheet must never invent it, so with nothing set it should leave the chip out.
2. **Look source.** The sheet should use `episodeLook()` (locked → chosen → event), not `/wardrobe/outfit` (approved only). Confirm that an unapproved chosen look may print.
3. **BAG vs accessories.** BAG is a raw-category split of the `accessories` slot. Accessory pieces that are not bags (scarf, belt, hair bow) have no column on the sheet.
4. **"Needed"** depends on `shows.metadata.required_slots` (default outfit + shoes). Bag, jewelry and perfume print "Needed" only if configured as required.
5. **Bucket env drift.** There are four bucket rules (§2): thumbnail uses `S3_BUCKET` with a hard-coded dev default, and the data-URL fallback stores base64 in a TEXT column. Pick `uploadPng`'s rule for Lookbook uploads and decide whether a no-bucket environment should refuse uploads rather than store multi-MB data URLs per image.
6. **Fonts.** Lora and DM Mono are not committed, so the server render needs OFL TTFs added or a font substitution ruling.
7. **Logo and map.** There is no logo field or file, and the default `DreamMap` image source was not traced. The footer and header need committed assets.
8. **Staleness.** An approved sheet can go out of date when the event, look or venue changes. The proposed `sheet_inputs_hash` covers this; alternatively, reuse the place lock (`utils/placeLock`, `worldEvents.js:296`).
9. **Readiness definition** (11 categories, ≥1 each) is proposed, not ruled.
10. **Spec location.** The spec is not on main at the basis SHA. Cite it after #2803 merges.
