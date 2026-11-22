| **PRIME STUDIOS** **F-AUTH-1 — THE SCRIPTS READS ARE AN ADMIN'S (AMENDMENT)** *Corrects the classification of the four `GET` routes of `src/routes/scripts.js`, recorded as Tier 4 public at F-AUTH-1 Step 3 CP9. They answered anyone with every script, a script's text and its edit history. By Evoni's decision of 2026-11-21 they need a sign-in in the admin group and answer with named fields only.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `f4104e523a8ff6bcdc973eaf04161de1cf16f2ee` (2026-11-21), plus branch `claude/sec1-scripts-admin-reads`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-21. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1 and §3, each with its command); INFERRED (marked where used).

---

# §1. What is amended

## The classification as it stood (MEASURED)

- **`F-AUTH-1_Fix_Plan_v2.37.md` line 3801** lists, under "Tier 4 (plain optionalAuth + PUBLIC)": "scripts.js GETs (4: GET / + GET /search + GET /:scriptId + GET /:scriptId/history — 6th cumulative §5.21 instance)".
- **The same file, line 1712**, defines the tier: "Tier 4 — plain optionalAuth (LOCKED PUBLIC where req.user not consumed). Published-only data routes that don't personalize per-user."
- **`F-AUTH-1_Limb1_CP9_Confirmation_2026-09-02.md`** confirms the four `GET`s as "Tier 4 GETs (PUBLIC, no middleware at all)".

On `main` at the basis the four routes carried `optionalAuth`:

```
$ git show origin/main:src/routes/scripts.js | grep -n "^router\.get"
20:router.get('/', optionalAuth, asyncHandler(scriptsController.getAllScripts));
21:router.get('/search', optionalAuth, asyncHandler(scriptsController.searchScripts));
31:router.get('/:scriptId', optionalAuth, asyncHandler(scriptsController.getScriptById));
62:router.get('/:scriptId/history', optionalAuth, asyncHandler(scriptsController.getEditHistory));
```

## Why the classification was wrong

- The four routes were placed in Tier 4 because they do not read `req.user`. That is a statement about the handlers, not about the data.
- The tier's own definition is "published-only data". Nothing in these handlers filters by status, and the repository has no published state for a script: no status value, flag or visibility column (MEASURED: `src/models/EpisodeScript.js`, `src/services/scriptsService.js` and the migrations under `src/migrations/` were read for one, 2026-11-21).
- No ruling that scripts are public was found in the register.
- Evoni's admin-only ruling of 2026-10-29 (`F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md`: "Prime Studios is an admin-only production environment") is later than the classification and contradicts it.

## What the routes answered (MEASURED, from the code at the basis)

To any caller, with or without a sign-in:

- `GET /api/v1/scripts` and `/search`: every latest script that is not deleted, drafts included, with its episode's title and number.
- `GET /api/v1/scripts/:scriptId`: the script's `file_url`, `created_by` and `scene_markers`; with `?includeContent=true`, every column of the row (`SELECT *`, `scriptsService.getScriptById`), its text included.
- `GET /api/v1/scripts/:scriptId/history`: every column of every `script_edits` row for it (`SELECT *`, `scriptsService.getEditHistory`). The canon schema capture of 2026-09-17 records `ip_address` and `user_agent` among those columns, and `changes`, which the service fills with the script before and after an edit.

Not established: whether production's `episode_scripts` and `script_edits` tables hold rows. No database was read for this amendment, and no route was called on any deployed site.

# §2. The decision (RULED)

Evoni, in the session of 2026-11-21:

> "I authorize implementation of SEC-1 in its own focused PR, using the previously reviewed specification."
>
> "Restrict the four GET routes in "src/routes/scripts.js" to authenticated users in the existing admin group."
>
> "Prevent script history responses from exposing IP addresses or user-agent information."

"SEC-1" is the name that session used for this change. It is not the SEC-1 of 2026-10-29 (the asset upload's sign-in order, `tests/unit/routes/sec1-asset-upload-auth.test.js`).

No public contract for scripts is created. If published scripts are to be public later, that needs her ruling and a way to mark a script published; neither exists.

# §3. What the change does (MEASURED on the branch)

```
$ grep -n "^router\.get" src/routes/scripts.js
23:router.get('/', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.getAllScripts));
24:router.get('/search', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.searchScripts));
34:router.get('/:scriptId', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.getScriptById));
65:router.get('/:scriptId/history', requireAuth, authorize(['ADMIN']), asyncHandler(scriptsController.getEditHistory));
```

- **Sign-in and group.** The existing `requireAuth` (401) and `authorize(['ADMIN'])` (403). No new role, group or membership check.
- **Named fields.** `src/services/scriptReadFields.js` names what each read answers with; the controller sends those names and nothing else, so a column is not sent because the row carries it.
- **The edit history.** `ip_address` and `user_agent` are not among its fields, for an admin as for anyone.
- **The six writes** of the file are unchanged.
- **Tests.** `tests/unit/routes/scripts-reads-admin-only.test.js` (behaviour: signed out, not an admin, an admin, a draft, `?includeContent=true`, the history, a column that is not named) and `tests/unit/routes/scripts-mixed-tier-promotion.test.js` (the route declarations; it pinned the four reads as public and now pins them as an ADMIN's).

# §4. What this amendment does not cover

- **The other script reads.** Routes that return script text after a sign-in alone (for example `GET /api/v1/episodes/:episodeId/scripts`) are not changed here. Evoni keeps them as a separate change.
- **Stored history.** No row of `script_edits` is changed or removed. Any `ip_address` or `user_agent` already stored stays stored; it is no longer sent.
- **`file_url`.** The service stores the string a client sent. What a stored value points to, and who can fetch it, is outside this change.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server.

---

**Type:** amendment.
**Rules:** the four `GET` routes of `src/routes/scripts.js` are an ADMIN's, on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** no host, database or Cognito contact. One AWS identity call was attempted in this session for an unrelated read and was rejected; no other AWS call was made.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
