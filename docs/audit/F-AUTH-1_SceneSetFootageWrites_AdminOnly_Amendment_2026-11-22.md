| **PRIME STUDIOS** **F-AUTH-1 — SCENE, SET-LINK AND FOOTAGE WRITES ARE AN ADMIN'S (AMENDMENT, P2a)** *Seventy-four write routes that change shared production scenes, an episode's links to sets, assets and library scenes, Scene Studio's canvas and objects, footage, performance clips and dressed angles answered any signed-in account, in any group or none. By Evoni's decisions of 2026-11-22, seventy-three of them need a sign-in in the admin group, and the seventy-fourth (making a scene set) refuses a non-admin's link to an episode. Scene Studio stays open to read.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `75c579d61b42381940287b1b957a1aae59f85d46` (2026-11-22), plus branch `claude/p2a-scenes-sets-footage-admin`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1 and §3, each with its command or file); INFERRED (marked where used).

---

# §1. What is amended

## The classification as it stood (MEASURED)

At the basis every route in §3 carried `requireAuth` and no group check: a sign-in was enough.

```
$ git show origin/main:src/routes/scenes.js | grep -c "authorize("
0
$ git show origin/main:src/routes/footage.js | grep -c "authorize("
0
$ git show origin/main:src/routes/scenes.js | grep -n "middleware/auth"
7:const { requireAuth } = require('../middleware/auth');
```

- `tests/unit/routes/scene-cluster-tier-promotion.test.js` pins the scene files as the "Step 3 CP4 — Scene cluster pure Tier 1 sweep": Tier 1 is a sign-in. This amendment does not change what that sweep did; it adds the group check on the routes listed here.
- The general write guard (`src/middleware/adminWriteGuard.js`) does nothing unless `ADMIN_WRITE_GUARD` is set. What it is set to on any server is not established, so it is not relied on.

## Why a sign-in is not enough for these

- **They change shared production data.** No row they write has an owner the code checks. `scenes.created_by` and `episode_scenes.added_by` are written and never compared to the caller; scene sets, angles, set links, scene objects, placements and episode asset links have no owner column (searched in `src/models` and `src/migrations`). So a route is either an admin's or anyone's.
- **Some spend.** Thirteen of them call a paid provider (image generation, restyle, inpainting, segmentation, depth, video). INFERRED from the services named in the handlers; which calls pass a spending gate was not established and is a separate, cost-control scope.
- **One path went round another.** `PATCH`, `DELETE` and `POST …/duplicate` on `/api/v1/scene-sets/:id/objects/:objectId` use the Studio's `updateObject`, `deleteObject` and `duplicateObject`. Their lookup, `findOwnedObject` in `src/controllers/sceneStudioController.js`, reads "Try scene_id first, then scene_set_id": called with a scene's id they act on that scene's object. Gating the scene routes alone would have left this open. (MEASURED: the new integration test shows an admin's `PATCH` through the set path changing a scene's object.)
- **Six are declared twice** in `src/routes/episodes.js` (`/:id/…` then `/:episodeId/…`): the three `library-assets` writes and the three `timeline/placements` writes. Express answers with the first; the second is unreachable today. Both now carry the check, so a later reorder cannot reopen one.

# §2. The decisions (RULED)

Evoni, in the session of 2026-11-22.

On Scene Studio and the scope of P2:

> "Scene Studio shared production mutations are ADMIN-only for now. Do not globally restrict the Studio pages until their read-only and legitimate creator-facing behaviors are audited."
>
> "Reject unauthorized episode_ids on scene-set creation with 403. Do not silently ignore them."
>
> "Include performance-clip and dressed-angle mutations in P2."
>
> "Include footage asset-link routes in P2 when they modify shared episode, scene or footage relationships. Trace the exact operations and callers first."

On the paid Studio routes and the library routes:

> "Include generate-object, segment, and animate in P2 as ADMIN-only operations. These paid routes must not be accessible to ordinary signed-in accounts merely because they do not directly update a scene row. Cost limits remain a separate backlog item."
>
> "Include the live library-assets and library-scenes episode relationship mutations in P2."

On the further families:

> "Approve inclusion of the `sequence-items` mutations and the separate `/episodes/:id/assets` mutation family, following exact route verification."
>
> "Trace timeline placements and Scene Set canvas/object mutations as well. If they change the same shared production data and create an alternative path around ADMIN authorization, add them to the final P2 proposal."

On the split and the mechanism:

> "Approve P2a as its own implementation PR, based on the 74 identified routes and 80 declarations."
>
> "These counts are provisional until every route declaration, mount, and duplicate is verified."
>
> "Reuse the existing requireAuth, authorize(['ADMIN']) and established field-level authorization mechanisms. Do not build a new permission system."

On Scene Studio for someone who is not an admin:

> "Approve read-only access for non-admins viewing shared production scenes and Scene Sets."
>
> "Do not make the entire page inaccessible."
>
> "Use the existing role/group information to disable unauthorized editing actions and display a clear "View-only — Admin editing required" notice."
>
> "Do not initiate the automatic suggest-objects paid request for non-admin users."
>
> "Ensure rejected actions return useful permission feedback rather than silent errors."

No ownership rule is created. No public contract is created.

# §3. What the change does (MEASURED on the branch)

## The count, verified

74 routes on 80 declarations, as proposed. Each router is mounted once (`src/app.js`: `/api/v1/episodes`, `/api/v1/scenes`, `/api/footage`, `/api/v1/episode-brief`, `/api/v1/scene-sets`). 79 declarations gain `authorize(['ADMIN'])` directly after `requireAuth`, before `aiRateLimiter`, any upload middleware and the document-presentation rule; the 80th, `POST /api/v1/scene-sets`, keeps `requireAuth` alone and refuses one field.

```
$ git diff origin/main -- src/routes | grep -c "^+.*authorize(\['ADMIN'\])"
79
```

## `src/routes/episodes.js`, mounted `/api/v1/episodes` (26 routes, 32 declarations)

| Routes | What they change |
|---|---|
| `PUT /:episodeId/locations`, `POST /:episodeId/move-removed-sets` | The episode's locations and its plan's sets |
| `POST /:episodeId/scene-sets`, `DELETE /:episodeId/scene-sets/:setId`, `PATCH /:episodeId/scene-sets/reorder` | The episode's links to scene sets |
| `PUT /:episodeId/scenes/reorder`, `POST /:episodeId/scenes`, `POST /:episodeId/scenes/from-angle` | The episode's scenes |
| `POST /scenes/:scene_id/calculate-duration`; `POST /scenes/:scene_id/assets`; `PUT`, `DELETE /scenes/:scene_id/assets/:scene_asset_id` | A scene and its assets |
| `POST /:id/library-scenes`; `PUT`, `DELETE /:id/library-scenes/:sceneId` | The episode's library scenes |
| `POST /:id/library-assets`; `PATCH`, `DELETE /:id/library-assets/:assetId` (each declared twice) | The episode's library assets |
| `PUT /:id/sequence-items/reorder`, `POST /:id/sequence-items/note` | The same rows as the library scenes |
| `POST /:id/assets`; `DELETE`, `PATCH /:id/assets/:assetId` | The episode's asset links |
| `POST /:id/timeline/placements`; `PATCH`, `DELETE /:id/timeline/placements/:placementId` (each declared twice) | The episode's timeline placements |

On `DELETE /:id/assets/:assetId` the check sits before `protectDocumentPresentations`: someone who is not an admin gets the 403; an admin still gets that rule's refusal.

## `src/routes/sceneSetRoutes.js`, mounted `/api/v1/scene-sets` (13)

- `DELETE /:id`; `POST /:id/episodes`; `DELETE /:id/episodes/:episodeId`.
- `PUT /:id/canvas`; `POST /:id/objects`; `PATCH`, `DELETE /:id/objects/:objectId`; `POST /:id/objects/:objectId/duplicate`.
- `POST /:id/generate-object`, `/:id/transform-object`, `/:id/regenerate-background`, `/:id/angles/:angleId/generate-depth` (paid; the check is before the rate limiter).
- **`POST /`** stays `requireAuth`. In the handler, before anything is read or made: a caller for whom `userInGroup(req.user, 'ADMIN')` is false, sending `episode_ids` as anything but absent, `null` or `[]`, gets 403 `{ success: false, code: 'AUTH_GROUP_REQUIRED', error, message, fields: ['episode_ids'] }` with "Only an admin can link a scene set to an episode." No set is made and the link is not dropped in silence.

The other 48 writes of this file are not touched here; they are a separate change (P2b).

## `src/routes/scenes.js`, mounted `/api/v1/scenes` (27: every write in the file)

Scene create, duplicate, status, thumbnail, update, delete; characters add and remove; the four scene-asset writes; the canvas save; the six object and variant writes; and the eight paid routes (`generate-object`, `transform-object`, `regenerate-background`, `suggest-objects`, `inpaint`, `segment`, `animate`, `generate-depth`). No `GET` is changed: the Studio opens and reads for anyone signed in.

## `src/routes/footage.js`, mounted `/api/footage` (4)

`POST /upload` (the check is before the upload is read), `POST /episodes/:episodeId/assets`, `DELETE /episodes/:episodeId/assets/:assetId`, `DELETE /scenes/:sceneId`.

## `src/routes/episodeBriefRoutes.js`, mounted `/api/v1/episode-brief` (4)

`PUT /:episodeId/performance-clips`, `DELETE /:episodeId/performance-clips/:clipId`, `POST /:episodeId/dressed-angles/:angleId/generate`, `POST /:episodeId/dressed-angles/:angleId/upload`. `POST …/dressed-angles/:angleId/brief`, which only reads, stays a sign-in.

## Sign-in and group

The existing `requireAuth` (401), `authorize(['ADMIN'])` (403) and `userInGroup`. No new middleware, role, group, table or helper for authorization. No handler body is edited except the scene-set create's one check. No rate limiter is added or removed.

## The page (display only; the server is the guard)

- Scene Studio (`frontend/src/components/SceneStudio/`), for someone not in the admin group: opens and shows the scene or set; shows "View-only — Admin editing required"; Save is disabled; the editing panels are inert; edits to the page's state do nothing; no write and no paid request is sent, the automatic suggestions among them. For an admin it is as before.
- A 403 with `AUTH_GROUP_REQUIRED` is shown as "Only an admin can change scenes, sets or footage." (or the handler's own sentence) on the Studio, the Scene Sets tab, the dressed angles, the episode's locations, removed-sets banner, set link and library scenes.

## Tests

- `tests/integration/p2aSceneAdmin.integration.test.js` (334 cases, on the migrated test database through the real app): each of the 73 routes signed out (401), as an editor and a viewer (403 with `authorize`'s body, no statement that writes in `tests/helpers/lockTrace.js`, every row as it was, no provider call, nothing sent to storage, no upload read) and as an admin (not answered by `authorize`); the set-object path with a scene's id; both declarations of the six; the episode-asset delete's order; the scene-set create's episode link in eleven shapes; the reads that stay open. With the five route files as on `main`, 167 of the 334 fail.
- `tests/unit/routes/scene-cluster-tier-promotion.test.js`: the four set-level paid routes are pinned with the ADMIN chain; the count of bare `requireAuth, aiRateLimiter` chains in `sceneSetRoutes.js` is 20 (was 24), and the ADMIN chain is on 5.
- Existing suites that drive these routes now ask as an admin (token only): eight integration files and one row of a ninth; `tests/unit/routes/nested-episode-no-script.test.js` now asserts the 403 for the three non-admin readers and the unchanged answer for an admin.
- Frontend: `SceneStudio.viewOnly.test.jsx`, `viewOnly.test.js`, `SmartSuggestions.test.jsx`.

# §4. What this amendment does not cover

- **The other 48 writes of `sceneSetRoutes.js`** (base image, angles, look variants, venue photo, spec, variants): sign-in still. A separate change (P2b).
- **Other writes in `episodes.js`** in no approved scope (episode create and enqueue, wardrobe, platform, titles, lookbook, style sheet, video compositions, `generate-beats`, `suggest-scenes`).
- **Rate and spending limits** on the paid routes.
- **`GET /api/v1/episodes/:episodeId/scenes`**, which still runs the beat-scene sync for any signed-in reader. A separate, held change (S1).
- **Stored rows.** None is changed or removed.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server, and no route was called on one.

---

**Type:** amendment.
**Rules:** the 73 routes of §3 are an ADMIN's, and `POST /api/v1/scene-sets` refuses a non-admin's `episode_ids`, on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL test database in the session's own container. No deployed host, AWS service, production or development database, or Cognito pool was contacted for this change, and no paid provider was called.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
