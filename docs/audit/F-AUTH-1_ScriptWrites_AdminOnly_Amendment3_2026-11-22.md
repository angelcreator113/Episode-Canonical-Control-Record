| **PRIME STUDIOS** **F-AUTH-1 — THE LEGACY SCRIPT-LIBRARY WRITES ARE AN ADMIN'S (AMENDMENT 3)** *Follows `F-AUTH-1_ScriptsReads_AdminOnly_Amendment_2026-11-21.md` and `F-AUTH-1_ScriptReads_AdminOnly_Amendment2_2026-11-22.md`, which made the script reads an ADMIN's and left the writes as they were. The six writes of `src/routes/scripts.js` and the one script write of `src/routes/episodes.js` answered any signed-in account; one of them, `PATCH /api/v1/scripts/:scriptId`, answered a request that changed nothing with the script's whole row. By Evoni's decision of 2026-11-22 the seven need a sign-in in the admin group.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `7c5ebf93c72f769ac29eac5c79b9b95cf37a3948` (2026-11-22), plus branch `claude/prb-script-writes-admin`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1 and §3, each with its command or its `file:line` at the basis); INFERRED (marked where used).

---

# §1. What is amended

## The classification as it stood (MEASURED)

The write routes of `src/routes/scripts.js` at the basis:

```
$ git show origin/main:src/routes/scripts.js | grep -n "^router\.\(post\|patch\|delete\)"
27:router.post(
37:router.patch(
44:router.delete(
51:router.post(
58:router.post(
68:router.post('/:scriptId/parse-scenes', requireAuth, asyncHandler(scriptsController.parseScenes));
```

Six, and the file has no `router.put`. With the one script write of `src/routes/episodes.js`, the seven routes and what each carried at the basis:

| Route | `file:line` at the basis | Middleware at the basis | Handler (`src/controllers/scriptsController.js`) |
| --- | --- | --- | --- |
| `POST /api/v1/scripts/bulk-delete` | `src/routes/scripts.js:27-31` | `requireAuth` | `bulkDelete` |
| `PATCH /api/v1/scripts/:scriptId` | `src/routes/scripts.js:37-41` | `requireAuth` | `updateScript` |
| `DELETE /api/v1/scripts/:scriptId` | `src/routes/scripts.js:44-48` | `requireAuth` | `deleteScript` |
| `POST /api/v1/scripts/:scriptId/set-primary` | `src/routes/scripts.js:51-55` | `requireAuth` | `setPrimary` |
| `POST /api/v1/scripts/:scriptId/restore` | `src/routes/scripts.js:58-62` | `requireAuth` | `restoreVersion` |
| `POST /api/v1/scripts/:scriptId/parse-scenes` | `src/routes/scripts.js:68` | `requireAuth` | `parseScenes` |
| `POST /api/v1/episodes/:episodeId/scripts` | `src/routes/episodes.js:983-988` | `validateUUIDParam('episodeId'), requireAuth` | `createScript` |

Each carried `requireAuth` and no group check: a sign-in in any group, or in none, was enough. `src/routes/scripts.js:13-14` at the basis said so: "The 6 writes are as CP9 left them: requireAuth". Four tests pinned that standing and are changed with the routes (§3): `tests/unit/routes/scripts-mixed-tier-promotion.test.js` ("Tier 1 writes"), `scripts-reads-admin-only.test.js` ("the writes are as they were"), `episodes-script-reads-admin-only.test.js` ("the script write under an episode is as it was") and `episodes-cluster-tier-promotion.test.js`.

## Why a sign-in alone was not enough

- **The reads were closed and the writes were not.** The amendment of 2026-11-21 §4 and Amendment 2 §3 ("Writes. No write route is changed.") left these seven as they were. Evoni's admin-only ruling of 2026-10-29 (`F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md`: "Prime Studios is an admin-only production environment") covers them as it covered the reads.
- **What any signed-in account could do** (MEASURED, `src/services/scriptsService.js` at the basis): create a script under any episode (`createScript`, `:153`); change a script's text, status, author, label, duration, scene count or scene markers (`updateScript`, `:250`); mark a version primary (`setPrimary`, `:326`); make an old version the latest again (`restoreVersion`, `:381`); soft-delete one script (`deleteScript`, `:465`) or a list of them (`bulkDelete`, `:503`); and create scenes from a script's text (`parseScriptAndCreateScenes`, `:659`).
- **The write that was also a read** (MEASURED). `updateScript` first reads the script with `SELECT * FROM episode_scripts WHERE id = $1 AND deleted_at IS NULL` (`src/services/scriptsService.js:257-260`), then keeps the body's keys that are in its list of seven editable fields (`:269-288`). When none is, it returns the row it read: `if (updateFields.length === 0) { return currentScript; }` (`:290-292`). The handler sends what the service returns as `data` (`src/controllers/scriptsController.js:130-148`). So `PATCH /api/v1/scripts/:scriptId` with `{}`, or with only fields that are not editable, changed nothing and answered any signed-in account with every column of the script, its text included: the read the amendment of 2026-11-21 had made an ADMIN's, by another door.
- **The write guard is not relied on.** `src/middleware/adminWriteGuard.js` is mounted on `/api` ahead of every router (`src/app.js:269`) and would refuse a non-admin's write to these routes, but its header states (`:22`): "`unset, '' or 'off'  nothing: every request passes (as before this file)`". It refuses only where `ADMIN_WRITE_GUARD` is set to do so. Not established: what that variable is set to on any server. A route that must be an ADMIN's carries the check itself.

# §2. The decision (RULED)

Evoni, in the session of 2026-11-22:

> "Approve implementation of the seven identified routes with explicit ADMIN authorization. Include tests for: Signed-out 401. Non-admin 403. Existing ADMIN behavior. No unauthorized service invocation or database mutation. No script text or revision exposed by no-op PATCH, malformed requests, rejected edits or error responses. Keep PR B focused and separate from the other containment work."

"PR B" is the name that session used for this change. The other containment work is separate changes, not described here (§4).

No public contract for scripts is created, as in the amendments of 2026-11-21 and 2026-11-22.

# §3. What the change does (MEASURED on the branch)

- **Sign-in and group.** Each of the seven routes carries the existing `requireAuth` (401) and `authorize(['ADMIN'])` (403) of `src/middleware/auth.js`, inline on the route. No new role, group, middleware or membership check. On the branch:

```
$ grep -n "requireAuth, authorize(\['ADMIN'\])" src/routes/scripts.js
25:router.get('/', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.getAllScripts));
26:router.get('/search', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.searchScripts));
31:  requireAuth, authorize(['ADMIN']),
36:router.get('/:scriptId', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.getScriptById));
41:  requireAuth, authorize(['ADMIN']),
48:  requireAuth, authorize(['ADMIN']),
55:  requireAuth, authorize(['ADMIN']),
62:  requireAuth, authorize(['ADMIN']),
67:router.get('/:scriptId/history', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.getEditHistory));
70:router.post('/:scriptId/parse-scenes', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.parseScenes));
```

  Ten routes in the file, ten lines: no route of `src/routes/scripts.js` is without the group check. In `src/routes/episodes.js`, `POST /:episodeId/scripts` reads `validateUUIDParam('episodeId'), requireAuth, authorize(['ADMIN']),` (`:984-989`).
- **Order.** On the six routes of `src/routes/scripts.js` nothing runs before `requireAuth`. On the episode route `validateUUIDParam('episodeId')` runs first, as it did: an id that is not a UUID or an integer is a 400 whose body is `{ error: 'Validation failed', details: ['episodeId must be a valid UUID or integer ID'] }` (`src/middleware/requestValidation.js:252-257`), and it reads nothing. The JSON body parser is mounted ahead of every router (`src/app.js:228`), so a body that is not valid JSON is refused there, for anyone, with "Invalid JSON in request body" (`src/middleware/errorHandler.js`).
- **What a refusal carries.** The 401 is `{ error, message, code: 'AUTH_REQUIRED' }` (or the token's own code); the 403 is `{ error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' }`. Neither has a row, a script's text or a revision. Both are sent by the middleware, before the handler: the handler does not run, so `scriptsService` is not called. The handlers reach the database through `scriptsService` only (`src/controllers/scriptsController.js` requires no model and no pool), so a refusal reads and changes nothing.
- **The no-field `PATCH`.** It is not changed; it is no longer reachable without the admin group. A non-admin's `PATCH`, with any body or none, is the 403 above.
- **Unchanged for an admin.** No handler, service or response is changed. An admin's write passes the same arguments to the service and answers with what it answered. That includes the write responses that are a whole row: `createScript`, `updateScript` (the no-field case too), `setPrimary` and `restoreVersion` send the service's row as `data`, and the service reads it with `RETURNING *` or `SELECT *`. They are an ADMIN's alone now, and an admin may read a script's text (the amendment of 2026-11-21).
- **Errors, for an admin.** A failure in the service is answered by `errorHandler`: the error's message, and its stack outside production; in production "Internal server error" and neither. It sends nothing else the error carries. Not changed here.
- **Tests.** New: `tests/unit/routes/scripts-writes-admin-only.test.js` (the six writes through the real router, sign-in, group check, controller and error handler, with the service a stand-in: signed out 401; a token that is not one 401; five non-admin group sets 403; no service method called and nothing of a script in the answer for each; the same for a `PATCH` with no field, with no body, with fields that are not editable, with an array, with the wrong types and sent as text or a form, a bulk delete of malformed ids, and a restore, set-primary, delete and parse of an id that does not exist; an admin, whatever the group's case, reaching the service with the arguments it had and getting the answer it had, the no-field `PATCH` included; and a service failure answered without what the error carried). Changed: the four tests named in §1. `episodes-script-reads-admin-only.test.js` carries the same cases for `POST /:episodeId/scripts`. All are unit tests that read and write no database: the legacy columns these handlers use are not made by `src/migrations/` (§4), so a test database built from the migrations could not run the service's queries.

# §4. What this amendment does not cover

- **Other writes.** Only the seven routes of §1 are changed. Every other write route keeps the middleware it had, among them `PUT` and `DELETE /api/v1/episodes/:id`, the script locks, `apply-scene-plan` and `parse-script` of `src/routes/scriptParse.js`, the production package's `POST` and `DELETE`, and the beats. The session of 2026-11-22 named two further changes, "PR A" and "PR C", for other containment work; they are separate changes and are not described here.
- **The write guard.** `src/middleware/adminWriteGuard.js` and `ADMIN_WRITE_GUARD` are not changed, and nothing here says what the variable is set to anywhere.
- **What an admin's writes answer with.** The whole-row responses of §3 are as they were; they are not cut to the named fields of `src/services/scriptReadFields.js`.
- **The edit log.** `updateScript` and `deleteScript` still write the whole earlier row into `script_edits.changes` (`src/services/scriptsService.js`, `logEdit`). Reading it is an ADMIN's since 2026-11-21.
- **The legacy schema in production.** The handlers read and write `episode_scripts` columns (`script_type`, `version_number`, `is_primary`, `is_latest`) that no migration under `src/migrations/` creates (Amendment 2 §1), and a `script_edits` table that none creates either (`git grep -l script_edits origin/main -- src/migrations` finds none). Not established: whether production's database has them, and so whether these seven routes succeed there or fail at the first query. No database was read for this amendment.
- **Stored data.** No row is changed or removed. A script that a non-admin account created, changed or deleted before this change is as that account left it; this amendment finds no such write and looked for none.
- **A non-admin on these pages.** `frontend/src/services/scriptsService.js` calls the seven routes. A signed-in account that is not in the admin group now gets a 403 from them. No frontend file is changed.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server.

---

**Type:** amendment.
**Rules:** the seven script-library write routes of §1 are an ADMIN's, on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** one read-only Cognito call was attempted for an account inventory Evoni asked for and was refused (UnrecognizedClientException); no other AWS call; no host or database contact.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
