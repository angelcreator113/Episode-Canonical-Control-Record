| **PRIME STUDIOS** **F-AUTH-1 — WORLD LOCATION WRITES ARE AN ADMIN'S, AND A LOCATION IN USE IS NOT DELETED (AMENDMENT)** *Two routes hard-deleted a World Location for any signed-in account, in any group or none, whatever still used it. Both are now an ADMIN's and refuse, with nothing changed, while anything live uses the location. The create, update, studio-types and seed routes beside them are an ADMIN's too.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `9d69c06c976865c93b16185ae1c8f8beec8757eb` (2026-11-22), plus branch `claude/world-location-delete-admin`. Every `file:line` below is against that basis unless it says "on the branch".

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's authorization of 2026-11-22, quoted in §2. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (§2, in Evoni's words); MEASURED (the repository reads and the local test runs in §1, §3 and §4, each with its command or file); INFERRED (marked where used).

---

# §1. The gap (MEASURED)

## Two routes delete a World Location

| Route | Declared | Chain at the basis | What the handler did |
|---|---|---|---|
| `DELETE /api/v1/world/locations/:id` | `src/routes/worldStudio.js:3303` | `requireAuth` | `findByPk`, 404 when missing, `loc.destroy()` |
| `DELETE /api/v1/tier/world-locations/:locationId` | `src/routes/tierFeatures.js:439` | `requireAuth` | `WorldLocation.destroy({ where: { id } })`; `{ success: true }` even when there was no such row |

```
$ git show origin/main:src/routes/worldStudio.js | grep -n "router.*world/locations"
3151:router.get('/world/locations', requireAuth, authorize(['ADMIN']), async (req, res) => {
3245:router.post('/world/locations', requireAuth, async (req, res) => {
3284:router.put('/world/locations/:id', requireAuth, async (req, res) => {
3303:router.delete('/world/locations/:id', requireAuth, async (req, res) => {
3321:router.get('/world/locations/studio-types', requireAuth, async (req, res) => {
3331:router.post('/world/locations/studio-types', requireAuth, async (req, res) => {
3343:router.post('/world/locations/seed-infrastructure', requireAuth, async (req, res) => {
$ git show origin/main:src/routes/tierFeatures.js | grep -n "router.*world-locations\|middleware/auth"
40:const { requireAuth } = require('../middleware/auth');
398:router.get('/world-locations', requireAuth, async (req, res) => {
416:router.post('/world-locations', requireAuth, async (req, res) => {
428:router.put('/world-locations/:locationId', requireAuth, async (req, res) => {
439:router.delete('/world-locations/:locationId', requireAuth, async (req, res) => {
```

`WorldLocation` is not a paranoid model (`src/models/WorldLocation.js`: `timestamps: true, underscored: true`, no `paranoid`), so `destroy` is a hard `DELETE`. The table has a `deleted_at` column (`src/migrations/20260309130000-add-deleted-at-to-all-tables.js:14`) that these routes never set.

## What that allowed

1. **Any signed-in account could hard-delete any location.** No group check, no owner column to check.
2. **No check of what uses it.** Four tables point at `world_locations` with a foreign key that is `ON DELETE SET NULL`, so the delete succeeded and unlinked them in silence:

   | Referrer | Migration | Local `\d world_locations` ("Referenced by") |
   |---|---|---|
   | `scene_sets.world_location_id` | `20260704000000-add-world-location-id-to-scene-sets.js:16-18` | `"scene_sets_world_location_id_fkey" FOREIGN KEY (world_location_id) REFERENCES world_locations(id) ON UPDATE CASCADE ON DELETE SET NULL` |
   | `world_events.venue_location_id` | `20260709000000-enrich-locations-and-events.js:59-60` | `"world_events_venue_location_id_fkey" FOREIGN KEY (venue_location_id) REFERENCES world_locations(id) ON DELETE SET NULL` |
   | `story_calendar_events.location_id` | `20260710000000-add-location-id-to-calendar-events.js:10-11` | `"story_calendar_events_location_id_fkey" FOREIGN KEY (location_id) REFERENCES world_locations(id) ON DELETE SET NULL` |
   | `social_profiles.home_location_id` | `20260725000001-add-location-to-social-profiles.js:16-17` | `"social_profiles_home_location_id_fkey" FOREIGN KEY (home_location_id) REFERENCES world_locations(id) ON DELETE SET NULL` |
   | `world_locations.parent_location_id` | `20260309000000-tier-features-all.js:88` | `"world_locations_parent_location_id_fkey" FOREIGN KEY (parent_location_id) REFERENCES world_locations(id)` |

   The last has no `ON DELETE` action: deleting a location with a location inside it failed in the database, and both handlers answered 500 with the database's message (`res.status(500).json({ error: err.message })`).

   Six more references have no foreign key, so the delete left them pointing at nothing: `feed_posts.place_location_id` (`20261013070000-add-place-to-feed-posts.js:20`), `location_look_variants.world_location_id` (`20261015150000-create-location-look-variants.js:35`), `world_timeline_events.location_id` (`20260309000000-tier-features-all.js:69`), the event's automation copy `world_events.canon_consequences->'automation'->>'venue_location_id'` (written in `src/services/eventAutomationService.js`), an event look's `scene_set_looks.brief->>'world_location_id'` (read in `src/services/dressedAngleService.js:62`), and the ids in `social_profiles.frequent_venues` (`src/services/feedHomeLocation.js:128`).
3. **The Place lock was gone round.** An event whose episode is accepted keeps its Place (`src/utils/placeLock.js`); `DELETE /api/v1/scene-sets/:id` refuses for it (`src/routes/sceneSetRoutes.js:1016-1023`). Deleting the venue's location nulled `world_events.venue_location_id` and its sets' `world_location_id` with no such check.
4. **The approved base went with the row.** A location's approved base lives on the location row (`approved_base_scene_set_id`, `approved_base_image_url`, `approved_base_at`; `src/services/approvedBaseService.js`), and regenerate, promote and upload refuse to replace it until it is un-approved. The delete removed it without asking.
5. **The second route did all of this too**, and `POST` and `PUT /api/v1/tier/world-locations` passed the request body straight to `WorldLocation.create` and `location.update` (`src/routes/tierFeatures.js:416-437`), so a signed-in account could set any column the model declares, `approved_base_image_url` and `parent_location_id` among them.

The general write guard (`src/middleware/adminWriteGuard.js`) does nothing unless `ADMIN_WRITE_GUARD` is set. What it is set to on any server is not established, so it is not relied on.

# §2. The decision (RULED)

Evoni, 2026-11-22, "Decision 1 — World Location security correction AUTHORIZED", in her words:

- "Authorize a focused implementation PR to fix the verified World Location authorization and deletion-integrity gaps."
- "Add the existing ADMIN authorization middleware to BOTH: DELETE /api/v1/world/locations/:id [and] DELETE /api/v1/tier/world-locations/:locationId".
- "Inventory the World Location create, update and seed endpoints. Add ADMIN authorization to routes that mutate shared production locations and are currently available to ordinary authenticated users. If a seed endpoint has internal initialization semantics, preserve its legitimate operation while ensuring ordinary signed-in accounts cannot invoke it. Report any ambiguous case before modifying it."
- "Reuse existing dependency and Place-lock mechanisms to refuse deletion where the location has: A Place-locked event reference. Approved-base data. Child locations. Any other active reference that would be nulled, orphaned or damaged by hard deletion. Do not add an orphan override under this PR."
- "Make the dependency check and deletion atomic and concurrency-safe using existing transaction and locking conventions. Verify the relevant foreign-key behavior and lock ordering first. Do not hold unnecessary locks across external work."
- "Preserve the existing successful deletion behavior for an unreferenced location deleted by ADMIN."
- "World Foundation: show useful 403/409 errors. Narrative Control Center: require confirmation and handle errors. Reuse existing error-message helpers."
- "Use existing audit logging if an established applicable deletion audit path exists. Do not introduce a new tracking or history system."
- "Keep the existing hard-delete model for eligible locations. Do not add a soft-delete system or migration."
- "Open one focused PR with full seven-check CI. Do not merge or deploy it without separate authorization."

How this file reads two of those. Routes with internal-initialization semantics, or that a flow outside these pages depends on, are left as they are and listed for her to decide (§5).

On the two tier routes, which were gated before she was asked, and on the Narrative Control Center, her words of the same day:

> "Retain authorize(['ADMIN']) on: POST /api/v1/tier/world-locations, PUT /api/v1/tier/world-locations/:locationId. Do not revert either route to sign-in-only."
>
> "Preserve legitimate access to the page and its unrelated sections. For non-admin users, make restricted location editing unavailable in the existing interface rather than displaying working Add/Delete controls that lead to 403. Reuse the existing auth/group utilities. Do not introduce another permission system or redesign the entire page. The server's ADMIN middleware remains authoritative. Test ADMIN and non-admin rendering and interactions."

No ownership rule is created. No public contract is created.

# §3. What the change does (MEASURED on the branch)

## Routes that are now an ADMIN's (8)

`authorize(['ADMIN'])` sits directly after `requireAuth`. No handler body is edited except the two deletes.

| Route | File | Why |
|---|---|---|
| `DELETE /api/v1/world/locations/:id` | `src/routes/worldStudio.js` | §1 |
| `POST /api/v1/world/locations` | `src/routes/worldStudio.js` | Makes a shared location. Its callers are World Foundation, the Scene Sets location picker (whose next call, `PUT /api/v1/scene-sets/:id`, is an ADMIN's) and the Event Package venue picker (a page inside `<AdminOnly>`, `frontend/src/App.jsx:410`). All three first read `GET /api/v1/world/locations`, an ADMIN's since 2026-11-16. |
| `PUT /api/v1/world/locations/:id` | `src/routes/worldStudio.js` | Changes any of seventeen fields of a shared location, `parent_location_id` among them. Caller: World Foundation. |
| `POST /api/v1/world/locations/studio-types` | `src/routes/worldStudio.js` | Renames and retypes shared locations (`applyStudioRetypes`). Caller: the Studio types panel on World Foundation's Locations tab. The `GET` beside it, which reads and proposes, is unchanged. |
| `POST /api/v1/world/locations/seed-infrastructure` | `src/routes/worldStudio.js` | Adds the DREAM cities' locations and may rename "Lala's Penthouse". Its only caller is World Foundation's Seed Infrastructure button (`frontend/src/pages/WorldFoundation.jsx`, `seedInfra`); no server code and no page load calls it. |
| `DELETE /api/v1/tier/world-locations/:locationId` | `src/routes/tierFeatures.js` | §1 |
| `POST /api/v1/tier/world-locations` | `src/routes/tierFeatures.js` | §1 item 5. Caller: the Locations tab of the Narrative Control Center. |
| `PUT /api/v1/tier/world-locations/:locationId` | `src/routes/tierFeatures.js` | §1 item 5. No caller in `frontend/src`. |

The services these handlers call are not gated: `assignHomeLocation`, `ensureVenueLocation`, `fillLalaHome`, `approveBase` and the rest still write locations from server code as before.

**The two tier routes stay an ADMIN's (RULED, §2).** The Narrative Control Center (`/narrative-control`) and World Foundation (inside `/universe`) are not wrapped in `<AdminOnly>`, so a signed-in account that is not an admin can open them, and `GET /api/v1/tier/world-locations` still answers it. The Narrative Control Center stays open to such an account, with every other tab as it was; its Locations tab shows the list and no Add or delete control ("The pages" below). World Foundation is not changed in that way: what it shows such an account is in §6.

## The delete (`deleteWorldLocation` in `src/services/approvedBaseService.js`)

One function for both routes, in one `sequelize.transaction`:

1. `SET LOCAL lock_timeout` to the existing `LOCK_TIMEOUT` (`src/utils/episodeLocks.js`, 10 s), then `SELECT … FROM world_locations WHERE id = :id FOR UPDATE`. No row: 404 `{ "error": "Not found" }` (new for the tier route, which answered `{ success: true }`). An id that is not a uuid is the same 404, where it was a 500 from a database cast error.
2. **Place lock.** Live events whose `venue_location_id` or automation copy names the location, or that are held at one of its live sets, are each asked `isPlaceLocked` in the transaction. Any locked: 409
   `{ "success": false, "code": "PLACE_LOCKED", "locked_events": [{ "id", "name" }], "error": "<names> is held here and its episode is accepted: the place is locked, so this location stays. Nothing was deleted." }`
3. **Approved base.** `approved_base_scene_set_id` or `approved_base_image_url` set: 409
   `{ "success": false, "error": "<name> has an approved base. Un-approve it in Scene Sets before deleting the location. Nothing was deleted.", "approved_base_of": { "world_location_id", "name" } }`, the shape `baseReplaceRefusal` sends.
4. **Any other use.** Counted by kind; any above zero: 409
   `{ "success": false, "code": "LOCATION_IN_USE", "uses": { "child_locations", "scene_sets", "events", "looks", "look_variants", "calendar_events", "profile_homes", "profile_venues", "feed_posts", "timeline_events" }, "error": "<name> is used by 2 scene sets and 1 event. Nothing was deleted." }`
5. Otherwise `DELETE FROM world_locations WHERE id = :id`, one activity-log entry in the same transaction, and the body each route has always sent: `{ "deleted": true }` and `{ "success": true }`.

There is no override: no query or body parameter is read.

**What counts as a use.** Rows with `deleted_at` set do not block, where the table has the column (`story_calendar_events` has none, so every row counts). An event look counts when it and its scene set are live. Two points differ from "live rows only", on purpose:
- **A location inside this one always blocks, soft-deleted or not.** Its foreign key has no `ON DELETE` action, so the database refuses the delete whatever `deleted_at` says; counting it is what makes this the controlled 409 and never a 500.
- **A soft-deleted scene set, event or profile that still names the location does not block, and the foreign key then clears its link**, as it did before this change.

**Lock waits.** A wait for the row lock that times out, or a deadlock, is the existing 409 `{ "success": false, "code": "RETRY", "error": "Someone else changed this at the same moment. Nothing was saved: try again." }` (`asRetryable`). A foreign-key refusal from a row this code does not count is 409 `LOCATION_IN_USE` with `"uses": {}` and "Something else still refers to this location. Nothing was deleted."; the database's message is logged, not sent. Any other failure is 500 `{ "error": "The location could not be deleted" }`, logged with `console.error`.

**Nothing outside the database.** The function makes no storage or provider call, refused or not. A deleted location's venue photo object is not removed from storage (it was not before either).

## Concurrency (MEASURED locally, both orders, both routes)

The delete holds one row lock, on the location, and reads everything else. Writing a row whose foreign key names the location takes a key-share lock on that location row, which `FOR UPDATE` conflicts with, so that write and the delete take turns. This holds for the five foreign keys of §1 and for nothing else (§6):

- **The attach is first** (its transaction open, not committed): the delete's `FOR UPDATE` waits (seen in `pg_stat_activity`, `wait_event_type = 'Lock'`); after the attach commits the delete counts it and answers 409 `LOCATION_IN_USE`. The location stays and the reference still points at it.
- **The delete is first** (stopped just after its `FOR UPDATE`): the attach waits (seen the same way); the delete commits; the attach fails with `SequelizeForeignKeyConstraintError` (23503). The location is gone and nothing points at it.

Tested for a new scene set at the location (`INSERT INTO scene_sets`) and an event's venue changed to it (`UPDATE world_events SET venue_location_id`). INFERRED for the other three foreign keys of §1, which lock the same way; not tested one by one.

The delete takes no other row lock, so it cannot form a lock-order cycle with the episode, event or acceptance writers: it waits only for the location row, and for at most 10 s.

## The pages (display only; the server is the guard)

- `frontend/src/pages/WorldFoundation.jsx`, `deleteLocation`: the confirmation is kept. A 403 `AUTH_GROUP_REQUIRED` shows "Only an admin can add, change or delete a location."; a 409 shows the server's sentence, which names the events or counts the uses; anything else still shows "Delete failed". The message stays up 9 s instead of 3. Save and Seed show the admin-only sentence on a 403.
- `frontend/src/pages/NarrativeControlCenter.jsx`, `LocationsTab`: deleting now asks first ("Delete the location "…"? This cannot be undone."), and a failed delete or add shows one sentence in the tab instead of an unhandled rejection. For someone who is not in the admin group (`isAdmin(useAuth().user)`, the check `CompaniesPage.jsx` and `AdminOnly.jsx` use; no new mechanism) the tab is read-only: the list, its count, descriptions and sub-locations are shown; "+ Add Location", the form and each location's delete control are not rendered; one muted line says "Only an admin can add or delete locations." No write is sent. The page and its other nine tabs are not changed. The 403 sentence stays for a session whose group changed after the page loaded.
- `frontend/src/utils/locationWrites.js`: the wording, on top of the existing `adminOnlyMessage`. When a 409 carries no sentence, one is made from `uses` or `locked_events`.
- At 375 px: the two messages were rendered in headless Chrome inside a 375 px frame with the styles the pages give them and a long unbroken word; the document's `scrollWidth` stayed 375 (toast 24 to 351 px, the tab's message 16 to 359 px; the read-only line, measured the same way, 20 to 355 px on one line). The pages themselves were not opened in a browser.

## Tests

- `tests/integration/worldLocationAdmin.integration.test.js` (79 cases, on a migrated local test database through the real app): both deletes signed out (401) and as an editor, a viewer and an account in no group (403 `AUTH_GROUP_REQUIRED`, no statement run, every row as it was); an ADMIN deleting an unused location on both routes, with the activity entry; 404s; twenty-one fixtures refused with the same body by both routes, no writing statement, no row changed, no activity entry and no provider or storage call (each Place-lock path, the approved base, a location inside it, and one fixture per other kind of use); the approved base in each state it can be in (the set id alone, the image alone, both), on both routes, with the three `approved_base_*` columns as they were; the order of the three refusals; soft-deleted referrers; no override parameter; the lock-timeout answer; a foreign-key refusal from a table this code does not count (a mocked 23503 on the `DELETE` statement: 409 `LOCATION_IN_USE`, every row as it was, no activity entry); an activity entry that cannot be written (500, the location not deleted); the attach and the delete in both orders on both routes; the six other gated writes refused and still working for an ADMIN; the two reads that stay open. With the two route files as on `main`, 61 of the first 70 failed (measured before the last nine cases were added, and not measured again). Locally, 77 of the 79 were run after the follow-up: the two that call or name `seed-infrastructure` were left to CI, on Evoni's instruction not to run seed operations again in the session's database.
- `tests/unit/routes/world-cluster-tier-promotion.test.js`, `tests/unit/routes/cp12-tierFeatures-tier.test.js`: the eight chains are pinned, the tier file's import, and that each delete handler calls the one function and reads no parameter. No existing count changed (`authorize` is not counted by the `requireAuth` counts).
- `tests/integration/locationDreamCity.integration.test.js` now asks as an ADMIN (token only).
- Frontend: `WorldFoundation.world.test.jsx` (8 new cases), `NarrativeControlCenter.test.jsx` (16 new cases: an admin sees and uses Add and delete, with the confirmation; an editor, a viewer, an account in no group, one with no groups and no user at all see the list, no Add, no delete, the read-only line, and send no write; the page and another tab open for a viewer).

# §4. The activity log

A successful delete writes one entry through `logger.logActionInTransaction` (`src/middleware/auditLog.js`), in the delete's transaction: action `delete`, resource type `world_location`, the location's id, the signed-in user's id, and `changes.before` = `{ name, slug, location_type, city }`. This follows the existing deletes (`logger.logAction(userId, 'delete', 'episode' | 'metadata' | 'processing' | 'file', …)` in `src/controllers/`) and the in-transaction form introduced on 2026-11-12 for operations that must not happen without their entry. If the entry cannot be written the delete rolls back. A refused delete writes no entry.

# §5. Routes left unchanged, for Evoni to decide

Each of these writes `world_locations` and asks for a sign-in only (unless noted). None is changed here.

| Route or writer | Declared | Why it is left |
|---|---|---|
| `POST /api/v1/properties`, `PATCH /api/v1/properties/:id`, `POST /api/v1/properties/:id/rooms`, `PATCH /api/v1/properties/:id/rooms/:roomId`, `POST /api/v1/properties/:id/rooms/:roomId/generate-empty` | `src/routes/propertyRoutes.js:83, 153, 182, 245, 268` | The Property Manager's own family. `POST …/rooms` makes a room location and a scene set in one call, and making a scene set was kept a sign-in on 2026-11-22 (`F-AUTH-1_SceneSetFootageWrites_AdminOnly_Amendment_2026-11-22.md` §3, "`POST /` stays `requireAuth`"); `generate-empty` is a paid scene-set generation. Gating part of the family would split the page between two rules. |
| `POST /api/v1/scene-sets/:id/learn-location` | `src/routes/sceneSetRoutes.js:885` (creates at 910, sets the parent at 966) | One of the 48 scene-set writes the same amendment set aside for a separate change (its §4, "P2b"). |
| `POST` and `DELETE /api/v1/scene-sets/:id/venue-photo` | `src/routes/sceneSetRoutes.js:1082, 1122` | P2b. Writes `world_locations.venue_photo_url` and the object storage. |
| `POST` and `DELETE /api/v1/scene-sets/:id/approve-base` | `src/routes/sceneSetRoutes.js:2630, 2643` | P2b. Writes the three `approved_base_*` columns. |
| `POST /api/v1/world/:showId/events/from-profile` | `src/routes/worldEvents/fromProfile.js:22` (venue at 41-46) | Makes an event; the venue location is a by-product (`ensureVenueLocation`). Event creation is a sign-in today. |
| Calendar-to-event automation | `src/services/eventAutomationService.js:636-640` | Server code. Internal initialization. |
| Profile creation and the feed scheduler | `assignHomeLocation` at `src/routes/socialProfileRoutes.js:508`, `src/routes/socialProfileBulkRoutes.js:290`, `src/services/feedScheduler.js:897` | A new profile's signature venue is made as a by-product, by routes and by the scheduler. Internal initialization. |
| `POST /api/v1/memories/generate-story` | `src/routes/memories/engine.js:2551` (creates at 3087) | A story's new places are saved as locations as a by-product of generation, in the book's writing flow. |

Already an ADMIN's, and unchanged: `POST /api/v1/shows/:id/character-places/fill` (`src/routes/shows.js`, `fillLalaHome`) and the cast routes' places.

`backfillHomeLocations` (`src/services/feedHomeLocation.js:141`) has no route; nothing in `src/routes` calls it.

# §6. What this amendment does not cover

- **No soft delete.** The delete is a hard `DELETE`, as before. `world_locations.deleted_at` is still never set by these routes.
- **No override.** A location in use cannot be deleted through these routes by anyone; its uses are removed or moved first, each by its own route.
- **This is not a guarantee of referential integrity for `world_locations`.** The delete takes turns only with writers of the five foreign-key references of §1. The six references with no foreign key (a feed post's place, a look variant, a timeline event, an event's automation copy, a look's brief, a profile's `frequent_venues`) are counted when the delete is asked, and are **not protected against a write at the same moment**: their writers take no lock on the location and are not changed here, so one written after the delete's count and before its commit is left naming a location that is gone. Nothing in this change detects or repairs that. Making it impossible needs a foreign key or a change to those writers, which is a separate decision.
- **An unknown foreign key could not be tested for real.** The only foreign key to `world_locations` with no `ON DELETE` action is `parent_location_id`, which the delete counts, and a location inside another cannot be attached past the row lock; so no database refusal of the `DELETE` can be produced without changing the schema, which was not done. That path is tested with a mocked 23503.
- **World Foundation's controls are not hidden.** For a signed-in account that is not an admin its Locations tab shows no locations (the list read is an ADMIN's and its failure is only logged), so no Edit or Del; "+ Add Location" and "Seed Infrastructure" are still shown and answer with the admin-only sentence; the Studio types panel still reads its proposals (`GET …/studio-types` is a sign-in) and its apply is refused by the server. Read from the code, not opened in a browser. Evoni's instruction was for the Narrative Control Center only.
- **`ADMIN_WRITE_GUARD`** is neither changed nor relied on.
- **The live schema was not verified.** The foreign keys, columns and tables above are read from `src/migrations` and from a local database built by them. If a table or column the delete reads is absent on a server, the delete fails with a 500 and deletes nothing; it does not skip the check. If a server has a foreign key to `world_locations` that the migrations do not declare, the delete answers 409 `LOCATION_IN_USE` (§3).
- **Stored rows.** None is changed or removed. No migration.
- **Reads.** No `GET` is changed.
- **Storage.** A deleted location's venue photo object stays in the bucket.
- **The other callers of `POST /api/v1/world/locations`** (the Scene Sets and Event Package pickers) still show the server's `error` text on a 403; both are flows only an admin can reach the end of.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server, and no route was called on one.

---

**Type:** amendment.
**Rules:** the eight routes of §3 are an ADMIN's, and a World Location that anything live uses is not deleted, on Evoni's authorization quoted in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
