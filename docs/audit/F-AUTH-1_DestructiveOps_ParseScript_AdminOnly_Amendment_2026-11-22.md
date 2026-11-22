| **PRIME STUDIOS** **F-AUTH-1 — IRREVERSIBLE SCENE, BEAT AND PRODUCTION-PACKAGE OPERATIONS, AND THE PARSE-SCRIPT READ, ARE AN ADMIN'S** *Follows `F-AUTH-1_ScriptReads_AdminOnly_Amendment2_2026-11-22.md`, which made fifteen script `GET` routes an ADMIN's and changed no write. Five operations in four route files hard-deleted scenes, beats, character clips or production packages, or built a package from an episode's script, for any signed-in account; a sixth, `POST /:id/parse-script`, answered any signed-in account with a scene plan read from an episode's script. By Evoni's decision of 2026-11-22 all six need a sign-in in the admin group.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `7c5ebf93c72f769ac29eac5c79b9b95cf37a3948` (2026-11-22), plus branch `claude/pra-destructive-ops-admin`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1 and §3, each with its command or its `file:line` at the basis); INFERRED (marked where used).

---

# §1. What is amended

## The classification as it stood (MEASURED)

Each of the six routes carried `requireAuth` and no group check: a sign-in in any group, or in none, was enough. At the basis (`git show origin/main:<file> | grep -n requireAuth`, and for the mounts `git show origin/main:src/app.js | grep -n "scriptParseRoutes\|productionPackageRoutes)\|beatRoutes)\|animaticRoutes)"`):

| Route | `file:line` at the basis | Middleware at the basis |
| --- | --- | --- |
| `POST /api/v1/episodes/:id/apply-scene-plan` and `POST /api/v1/scripts/:id/apply-scene-plan` | `src/routes/scriptParse.js:174` | `requireAuth` |
| `POST /api/v1/episodes/:episodeId/production-package/generate` | `src/routes/productionPackage.js:23-27` | `requireAuth` |
| `DELETE /api/v1/episodes/:episodeId/production-package/:packageId` | `src/routes/productionPackage.js:73-77` | `requireAuth` |
| `DELETE /api/v1/scenes/:sceneId/beats/clear` | `src/routes/animatic.js:99` | `requireAuth` |
| `DELETE /api/v1/beats/:id` | `src/routes/beats.js:23` | `requireAuth` |
| `POST /api/v1/episodes/:id/parse-script` and `POST /api/v1/scripts/:id/parse-script` | `src/routes/scriptParse.js:82` | `requireAuth` |

The first and the last answer on two paths each because `src/app.js` mounts the one router of `src/routes/scriptParse.js` twice (`src/app.js:1078` on `/api/v1/scripts`, `:1079` on `/api/v1/episodes`). The beats and animatic routers are mounted on `/api/v1` (`src/app.js:867`, `:870`), the production package router on `/api/v1/episodes` (`:1226`).

Four tests pinned that standing and are changed with the routes (§3): `tests/unit/routes/productionPackage-reads-admin-only.test.js` (a signed-in non-admin's generate "is not refused for the group"), `tests/unit/routes/episodes-cluster-tier-promotion.test.js` ("the POST and the DELETE carry requireAuth alone"), `tests/unit/routes/cp11-beats-tier.test.js` and `tests/unit/routes/f-auth-1-fd63-shape3-multiline-tier.test.js` (the exact `{ requireAuth }` import of `beats.js` and of `animatic.js`).

## What the routes did (MEASURED, from the code at the basis)

For any signed-in account:

- **apply-scene-plan** (`scriptParse.js:174`). Reads the episode's script (`episode.script_content`, `:195`, else the newest `EpisodeScript`, `:200`), or the text posted as `content`, and creates one scene row per beat. With `clearExisting: true` it first runs `Scene.destroy({ where: { episode_id: id }, force: true })` (`:231-234`). `Scene` is a paranoid model (`src/models/Scene.js:403`), so `force: true` is a `DELETE`, not a soft delete: every scene row of the episode is removed, rows already soft-deleted included. The delete and the creates are not in one transaction. Its answer carries the scene plan and the created scenes.
- **production-package/generate** (`productionPackage.js:23`, `src/controllers/productionPackageController.js:21`). Calls `productionPackageService.generatePackage`, which builds a package from the episode's script and uploads a ZIP, and answers with the package row and the ZIP's URL.
- **production-package DELETE** (`productionPackage.js:73`, `productionPackageController.js:212`). `DELETE FROM production_packages WHERE id = $1 AND episode_id = $2 RETURNING id`. The ZIP in S3 is left where it is (`:223`, `// TODO: Delete S3 ZIP file`).
- **beats/clear** (`animatic.js:99`, `src/services/beatService.js:539-559`). `CharacterClip.destroy({ where: { scene_id } })`, then `Beat.destroy({ where: { scene_id } })`. Neither model is paranoid (`src/models/CharacterClip.js:114`, `src/models/Beat.js:91`), so both are `DELETE`s. No transaction.
- **beats/:id DELETE** (`beats.js:23`, `src/controllers/beatController.js:216`). `beat.destroy()` on a non-paranoid model: a `DELETE`.
- **parse-script** (`scriptParse.js:82`). Reads the episode's script (`episode.script_content`, `:101`, else the newest `EpisodeScript`, `:108`) and answers with `episodeTitle` and a `scenePlan` built from it by `src/utils/scriptBeatParser.js`: each beat's title, its tags (the `[EVENT: …]`, `[MAIL: …]` and `[LOCATION_HINT: …]` contents), each `[UI:…]` action's target, the speakers and the counts. It writes nothing.

## Why a sign-in alone was not enough

- **A sign-in was the only check.** No group, role or ownership test stood between a signed-in account and any of the six handlers.
- **The write guard is not relied on.** `src/middleware/adminWriteGuard.js` refuses a non-admin's write before any router runs, but only when `ADMIN_WRITE_GUARD` is set: unset, empty or `off` it does nothing (`adminWriteGuard.js:21-28`). Each route now carries its own check, whatever that setting is.
- **The deletes have no restore.** Four of the five operations end in a `DELETE`: no `deleted_at` is set, and no route restores a removed scene, beat, character clip or package row. The fifth, generate, builds and uploads a package and answers with script-derived material, which `F-AUTH-1_ScriptReads_AdminOnly_Amendment2_2026-11-22.md` already made an ADMIN's on the four package reads.
- **parse-script is a script-derived read reached by `POST`.** Amendment 2 swept the `GET` routes that answer with script text or material made from it; a `POST` was outside that sweep, so this read stayed behind a sign-in alone. Evoni's words of that amendment's §2 ("Non-admin accounts must not receive internal script text at any status.") cover it.
- Evoni's admin-only ruling of 2026-10-29 (`F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md`: "Prime Studios is an admin-only production environment") covers all six.

# §2. The decision (RULED)

Evoni, in the session of 2026-11-22:

> "Approve implementation of the five identified operations with explicit ADMIN authorization. Also include the script-derived read exposure through `parse-script`, with appropriate ADMIN authorization and separate disclosure regression tests. Preserve existing ADMIN behavior and avoid deleting legacy endpoints."

"The five identified operations" are the first five rows of the table in §1. "PR A" is the name that session used for this change; "PR B" and "PR C" are separate changes, not described here (§4).

# §3. What the change does (MEASURED on the branch)

- **Sign-in and group.** Each of the six routes carries the existing `requireAuth` (401) and `authorize(['ADMIN'])` (403), inline on the route. No new role, group, middleware or membership check. Because the `scriptParse.js` router is mounted twice, its two changes cover all four paths.
- **Refused before the handler.** A signed-out or non-admin request does not reach the handler: no episode, script or scene is read, nothing is deleted or created, no package is built or uploaded, and the answer is the middleware's own (`AUTH_GROUP_REQUIRED` for a 403).
- **Unchanged for an admin.** No handler, controller, service or model is changed. An admin's apply-scene-plan still hard-deletes on `clearExisting`, the package delete still leaves its ZIP, and no transaction is added.
- **No endpoint is removed.** All six routes, and both mounts, remain.
- **`POST /api/v1/scripts/parse` is as it was** (`requireAuth`): it reads only the text its caller posts.
- **The other beat and animatic routes are as they were** (`requireAuth`).
- **Tests.** New:
  - `tests/integration/scenePlanAdminOnly.integration.test.js`, against the test database's real `scenes` table, on both mounts. apply-scene-plan with `{}`, `{ clearExisting: true }` and `{ content }`: signed out 401, three non-admin sign-ins 403, and after each refusal every scene row of the episode (soft-deleted included, every column) equals what it was and the answer carries none of the script's markers; an admin appends, replaces or uses the posted text as before. parse-script: 401 and 403 answers carry no beat title, UI, MAIL or EVENT tag content or location hint; an admin's 200 carries them. `POST /api/v1/scripts/parse` answers a non-admin 200 and reads no episode.
  - `tests/unit/routes/productionPackage-writes-admin-only.test.js` and `tests/unit/routes/beats-destructive-admin-only.test.js`: the real routers and auth middleware over stand-in models, pool and package service (their tables are not in the migrated test database, below). Signed out 401; five non-admin group sets 403 with `generatePackage`, the pool's `query`, `beat.destroy`, `Beat.destroy`, `CharacterClip.destroy` and `clearSceneBeats` never called, and no package field or ZIP link in a refused generate; an admin reaches each handler with the same arguments and answer as before.
  - Changed: the four pin tests named in §1.
  - `tests/integration/legacyCueRoutesSharedPool.integration.test.js` calls the two package writes with an ADMIN token and is not changed.

## The tables behind the package and beat routes (MEASURED)

`grep -rln "production_packages\|character_clips\|'beats'" src/migrations` names three files; none creates `production_packages`, `beats` or `character_clips` (their `createTable` calls are for `timeline_data` and the performance clips table). In the migrated test database `to_regclass` is null for all three. So the package and beat cases are tested at the route with stand-ins, and the scene cases against the real table.

# §4. What this amendment does not cover

- **Handler behaviour.** The hard delete of apply-scene-plan's `clearExisting` (and its reach to soft-deleted rows), the missing transactions, and the S3 object a package delete leaves behind are as they were. This change decides who may call the routes, not what they do.
- **The other beat and animatic writes.** Creating, editing and generating beats, the dialogue clips, and the composition and timeline reads still ask for a sign-in only.
- **PR B and PR C.** The routes of `src/routes/scripts.js` and `src/routes/episodes.js`, and whatever that session named PR C, are separate changes.
- **Whether production has the package and beat tables.** Not established. No database other than the local test database was read for this amendment.
- **A non-admin on these pages.** A signed-in account outside the admin group now gets a 403 from these six routes (`frontend/src/services/scriptParseService.js` calls parse-script and apply-scene-plan; `frontend/src/pages/IconCueTimeline.jsx` calls generate). No frontend file is changed.
- **Stored data.** No row is changed or removed by this change.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server.

---

**Type:** amendment.
**Rules:** the six routes of §1 are an ADMIN's, on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** one read-only Cognito call was attempted for an account inventory Evoni asked for and was refused (UnrecognizedClientException); no other AWS call; no host or database contact.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
