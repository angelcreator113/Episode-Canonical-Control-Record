| **PRIME STUDIOS** **F-AUTH-1 — SCENE-SET PRODUCTION WRITES, THEIR PAID ROUTES AND GENERATE-VENUE ARE AN ADMIN'S (AMENDMENT, P2b)** *Forty-six routes of the scene-set file that change a set's base image, angles, look variants, venue photo, description, spec and variants, or that call a paid provider and write nothing, answered any signed-in account, in any group or none; so did venue generation for an event. By Evoni's decisions of 2026-11-22 all forty-seven need a sign-in in the admin group, and venue generation keeps the Place lock: no new venue for an event whose episode is accepted, for an admin too, `force` or not. Reads, the brief and the estimate stay a sign-in.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `558b440953373264b6d9e353c0f371f8716f01bf` (2026-11-22; P2a merged), plus branch `claude/p2b-scene-set-writes-admin`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1 and §3, each with its command or file); INFERRED (marked where used).

**Follows:** `F-AUTH-1_SceneSetFootageWrites_AdminOnly_Amendment_2026-11-22.md` (P2a), whose §4 left "the other 48 writes of `sceneSetRoutes.js`" for this change. Forty-six of the 48 are gated here; two stay a sign-in (§3).

---

# §1. What is amended

## The classification as it stood (MEASURED)

At the basis each route in §3 carried `requireAuth` and no group check.

```
$ git show origin/main:src/routes/sceneSetRoutes.js | grep -cE "^router\.(post|put|patch|delete)\("
64
$ git show origin/main:src/routes/sceneSetRoutes.js | grep -E "^router\.(post|put|patch|delete)\(" | grep -c "authorize(\['ADMIN'\])"
15
$ git show origin/main:src/routes/worldEvents/venue.js | grep -n "generate-venue', "
84:router.post('/world/:showId/events/:eventId/generate-venue', requireAuth, aiRateLimiter, async (req, res) => {
```

Of the 64 write declarations of the scene-set file, 15 were already an admin's (the twelve P2a gated, `PUT /:id` and `PUT /:id/version`, and `POST /model-comparison`), and 49 were a sign-in.

## Why a sign-in is not enough for these

- **They change shared production data.** A scene set, its angles, its look variants and its World Location's venue photo have no owner the code checks (P2a §1). A route is an admin's or anyone's.
- **Many spend, and five spend without writing.** `ai-describe`, `refine-description`, `suggest-angles`, `ai-camera-direction` and `spec/validate-angle` call a paid provider and change no row; a group check on writes alone would have left them open. INFERRED from the services the handlers name; which calls pass a spending gate is a separate, cost-control scope.
- **Venue generation is paid, stores images, makes a scene set and moves the event to it.** `generateVenueImages` (`src/services/venueGenerationService.js`) calls the image provider twice, stores the results, creates a `scene_sets` row and two `scene_angles` rows, and sets `world_events.scene_set_id`.
- **Venue generation went round the Place lock.** The event edit (`src/routes/worldEvents/update.js`), the scene-set link (`src/routes/worldEvents/inject.js`) and the look generation (`startLook`, `src/services/venueLookImageService.js`) refuse a change of Place on an event whose episode is accepted, through `isPlaceLocked` (`src/utils/placeLock.js`). `generate-venue` did not ask: with `force: true`, or with no live set attached, it replaced such an event's scene set. (MEASURED: with the lock check disabled on the branch, five cases of the new suite fail; an admin's `force: true` on an accepted episode's event, and a request for an accepted episode's event with no set, answer 200 where 409 is expected.)

# §2. The decisions (RULED)

Evoni, in the session of 2026-11-22.

On the scope:

> "Once #3923 is confirmed merged, you may begin implementing P2b in its own branch under the previously approved scope: The 41 Scene Set production mutations. The five paid read-only AI routes. ADMIN authorization on generate-venue. The existing Place-lock protection for force:true on accepted episodes. The proposed total is 47 routes, subject to final declaration-by-declaration verification."

On the mechanism:

> "Use existing authorization infrastructure. Preserve existing read-only access and established ADMIN workflows. Authorization must happen before paid calls, uploads, storage writes or mutations. No new permission service, database table, migration or alternative production workflow."

On venue generation and the Place lock:

> "Reuse the existing Place-lock service and refusal behavior. Check the restriction before any AI generation, storage write, Scene Set creation or event-location mutation. An ADMIN cannot bypass an accepted episode's locked event location through force:true. Keep existing valid behavior for unprotected events. Test accepted, draft, filmed-only, linked and unlinked cases, including force:true. Test that a refusal produces no paid provider call, storage write, new Scene Set, event update or plan mutation. Do not introduce another locking or authorization system."
>
> "Retain the existing implementation rather than creating another venue-generation pathway"

On the PR:

> "Open P2b as a separate PR, with tests and complete CI. Do not merge it automatically."

No ownership rule is created. No public contract is created.

# §3. What the change does (MEASURED on the branch)

## The count, verified

47 routes on 47 declarations, as proposed: 46 in `src/routes/sceneSetRoutes.js` (41 that write and 5 that are paid and write nothing) and 1 in `src/routes/worldEvents/venue.js`. No route is declared twice. Each router is mounted once (`src/app.js`: `/api/v1/scene-sets`; the world-events router at `/api/v1`, whose `index.js` mounts `./venue` once).

```
$ git diff origin/main -- src/routes | grep -c "^+.*authorize(\['ADMIN'\])"
47
$ grep -E "^router\.(post|put|patch|delete)\(" src/routes/sceneSetRoutes.js | grep -vc "authorize(\['ADMIN'\])"
3
```

Each gains `authorize(['ADMIN'])` directly after `requireAuth`: before `aiRateLimiter`, before the upload middleware (`uploadSceneSetImages`, `uploadVenuePhoto`, `variantUploadOr400`) and before the handler.

## `src/routes/sceneSetRoutes.js`, mounted `/api/v1/scene-sets` (46)

| Routes | What they do |
|---|---|
| `POST /ai-describe`, `/:id/refine-description`, `/:id/suggest-angles`, `/:id/ai-camera-direction`, `/:id/spec/validate-angle` | Paid; write nothing (5) |
| `POST /:id/upload-base`, `/:id/generate-base`, `/:id/cascade-regenerate`, `/:id/promote-to-base`; `POST`, `DELETE /:id/approve-base` | The set's base image and its approval (6) |
| `POST /:id/angles`; `PATCH`, `DELETE /:id/angles/:angleId`; `PATCH /:id/angles/reorder`; `DELETE /:id/angles`; `POST /:id/angles/:angleId/upload`, `/generate`, `/regenerate`, `/generate-video`, `/post-process`, `/auto-refine`, `/review`, `/analyze`; `PATCH /:id/angles/:angleId/favorite`, `/reject`; `POST /:id/generate-all-angles` | The set's angles (16) |
| `POST /:id/look-variants/:kind/:value/generate`, `/upload`; `DELETE /:id/look-variants/:kind/:value`; `POST`, `DELETE /:id/venue-photo` | Look variants and the venue photo (5) |
| `POST /:id/description-review`, `/:id/learn-location`, `/:id/analyze-image`, `/:id/suggest-angles-from-image`, `/:id/lock-style`, `/:id/spec/generate`, `/:id/spec/create-angles`; `PUT`, `PATCH /:id/spec`; `POST /:id/time-variants`, `/:id/season-variants`, `/:id/mood-variants`, `/:id/apply-template`; `PATCH /:id/cover-angle` | Description, location, spec, variants, cover (14) |

No handler body in this file is edited.

**What stays any signed-in account's in this file** (3 of the 64 write declarations): `POST /` (with P2a's refusal of a non-admin's `episode_ids`), `POST /:id/brief` and `POST /:id/look-variants/:kind/:value/estimate`, which read and answer and neither write nor call a provider. Every `GET` is unchanged.

## `src/routes/worldEvents/venue.js`, mounted `/api/v1` (1)

`POST /world/:showId/events/:eventId/generate-venue`:

- **The group check.** `requireAuth, authorize(['ADMIN']), aiRateLimiter`.
- **The Place lock**, in the handler, with the existing helper and the existing answer:

  ```js
  const { isPlaceLocked, PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE } = require('../../utils/placeLock');
  if (await isPlaceLocked(models.sequelize, event.id)) {
    return res.status(409).json({ success: false, code: PLACE_LOCKED_CODE, error: PLACE_LOCKED_MESSAGE });
  }
  ```

  It sits where the handler has decided a new venue will be made (with `force: true`, or with no live set attached), and before the provider key is looked for, before `generateVenueImages`, so before any provider call, stored image, new scene set, new angle or change to the event. The body is the one `inject.js` answers with. `force` is `req.body.force === true` as before; any other value is not force.
- **What is as before.** An event whose episode is not accepted (no episode, a draft, one with footage and not accepted): unchanged. An event with a live set attached and no `force`: the answer "already available", or the generation of that set's missing base, as before, on an accepted episode too, since neither changes which set the event has.
- **A judgment to note.** `startLook` refuses the whole look generation on a locked event, its base step included. Here the missing base of the set the event already has is still generated on an accepted episode, because the ruling names the event's location and `force: true`, and that branch changes neither. If the base should be refused too, it is a one-line move of the check above the attached-set branch.
- **No transaction or row lock** is taken for the check, as in `inject.js`: an episode accepted between the check and the generation is not caught. Not changed here.

`POST …/venue-brief` (reads, answers) and `POST …/generate-social-checklist` in the same file are not changed.

## Sign-in and group

The existing `requireAuth` (401), `authorize(['ADMIN'])` (403, `AUTH_GROUP_REQUIRED`) and `isPlaceLocked` (409, `PLACE_LOCKED`). No new middleware, role, group, lock, table, migration, service or route.

## The page (display only; the server is the guard)

- A 403 with `AUTH_GROUP_REQUIRED` from these routes is shown as "Only an admin can change scenes, sets or footage." (`sceneAdminOnlyMessage`, `frontend/src/utils/authGroups.js`, from P2a) in place of the server's "Forbidden": on the Scene Sets tab (`SceneSetsTab.jsx`), the look variants (`LookVariants.jsx`), the venue photo (`VenuePhoto.jsx`), the place description (`PlaceDescription.jsx`) and the spec build (`useSpecBuild.js`). Any other error keeps its own words.
- No control is hidden or disabled by this change.
- No page calls `generate-venue` (searched `frontend/src`: only two test assertions that it is not called), so there is nothing to show for it.

## Tests

- `tests/integration/p2bSceneSetAdmin.integration.test.js` (231 cases, on a migrated test database through the real app and the real auth middleware; providers, storage and the refinement queue are doubles):
  - each of the 47 routes signed out (401), as an editor and as a viewer (403 with `authorize`'s exact body; no statement that writes, by `tests/helpers/lockTrace.js`; sets, angles, look variants, the World Location, looks, set links, events, episodes, plans and scenes as they were; no new generation job, knowledge row or location; no provider call, nothing sent to storage, no upload read, no refinement job) and as an admin (not answered by `authorize`);
  - the routes that remove or replace angles leave both angles as they were when refused;
  - the source of the scene-set file: 64 write declarations, each on one line and once; the only three without the ADMIN chain are the three named above; on the other 61 `authorize` is directly after `requireAuth` and before any rate limiter or upload;
  - nineteen reads, the brief and the estimate answer an editor and a viewer as they answer an admin;
  - venue generation: accepted episode with `force: true`, with no provider key, and with no set attached (409 with the exact body; no provider call, no storage call, no statement that writes, every row as it was, `updated_at` included); `force` sent as `"true"`, `1`, an object or an array is not force; accepted with its set and its image, no force ("already available"); accepted with a set that has no image (not the lock's answer; the event keeps its set); an editor and a viewer on the accepted event with force (403, not 409); no episode, no episode with force, a draft with force, a filmed and not accepted episode with force (generated, as before); a draft with no force ("already available").
- `tests/unit/routes/scene-cluster-tier-promotion.test.js`: the nine remaining paid set routes are pinned with the ADMIN chain; bare `requireAuth, aiRateLimiter` chains in the file: 0 (was 20); ADMIN chains: 25 (was 5). All 25 are still rate limited.
- `tests/unit/routes/world-cluster-tier-promotion.test.js`: `generate-venue` is pinned with the ADMIN chain; of the 23 AI handlers of the world-events files, 5 carry `authorize` (was 4).
- Existing integration suites that drive these routes now ask as an admin (token only, no assertion changed): nine files whole; four (`sceneBriefShown`, `sceneEventChoice`, `venueBrief`, `venueAttachedSet`) keep the editor's token for the brief and use an admin's for the rest.
- Frontend: two cases added to `VenuePhoto.test.jsx`.

# §4. What this amendment does not cover

- **Rate and spending limits** on the paid routes. Her words: cost limits are separate.
- **Footage as a lock.** An episode with footage and not accepted does not lock the Place today, and does not here.
- **The race** between the lock's read and an episode's acceptance (§3).
- **The base of an attached set on an accepted episode** (§3, the judgment).
- **Controls for someone who is not an admin** on the Scene Sets tab: they are still shown and enabled; the server refuses and the page says why.
- **`CharacterPlaces/setPhotos.js` and `SetAngles.jsx`**, which call some of these routes and show their own fixed sentences on failure: not changed.
- **Stored rows.** None is changed or removed. No migration.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server, and no route was called on one.

---

**Type:** amendment.
**Rules:** the 47 routes of §3 are an ADMIN's, and `generate-venue` makes no new venue for an event whose episode is accepted, on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** the P2b item of `F-AUTH-1_SceneSetFootageWrites_AdminOnly_Amendment_2026-11-22.md` §4, for 46 of its 48 routes; the other two stay a sign-in by her scope.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
