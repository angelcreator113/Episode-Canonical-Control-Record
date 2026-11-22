| **PRIME STUDIOS** **F-AUTH-1 — THE REMAINING SCRIPT-SPECIFIC READS ARE AN ADMIN'S (AMENDMENT 2)** *Follows `F-AUTH-1_ScriptsReads_AdminOnly_Amendment_2026-11-21.md`, whose §4 left "the other script reads" as a separate change. Fifteen `GET` routes in six route files answered any signed-in account with script text, or with material made from it, at any status. By Evoni's decision of 2026-11-22 they need a sign-in in the admin group; the scripts reads under an episode answer with named fields only, and their fallback query no longer reads soft-deleted scripts.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `6bd60d84386836fe5aa72dde2212ed58be17b1b0` (2026-11-22), plus branch `claude/sec2a-script-reads-admin`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1 and §3, each with its command or its `file:line` at the basis); INFERRED (marked where used).

---

# §1. What is amended

## The classification as it stood (MEASURED)

Each of the fifteen routes carried `requireAuth` and no group check: a sign-in in any group, or in none, was enough. At the basis (`git grep -n` against `6bd60d84`):

| Route | `file:line` at the basis | Middleware at the basis |
| --- | --- | --- |
| `GET /api/v1/episodes/:id/script-versions` | `src/routes/episodes.js:831` | `validateUUIDParam('id'), requireAuth` |
| `GET /api/v1/episodes/:id/script-versions/:versionId` | `src/routes/episodes.js:842` | `validateUUIDParam('id'), validateUUIDParam('versionId'), requireAuth` |
| `GET /api/v1/episodes/:episodeId/scripts` | `src/routes/episodes.js:970-975` | `validateUUIDParam('episodeId'), requireAuth` |
| `GET /api/v1/episodes/:episodeId/scripts/:scriptType/versions` | `src/routes/episodes.js:986-991` | `validateUUIDParam('episodeId'), requireAuth` |
| `GET /api/v1/episode-scripts/:episodeId` | `src/routes/episodeScriptWriterRoutes.js:84` | `requireAuth` |
| `GET /api/v1/episode-scripts/:episodeId/version/:version` | `src/routes/episodeScriptWriterRoutes.js:103` | `requireAuth` |
| `GET /api/v1/episode-scripts/:episodeId/latest` | `src/routes/episodeScriptWriterRoutes.js:122` | `requireAuth` |
| `GET /api/v1/episode-scripts/:episodeId/context` | `src/routes/episodeScriptWriterRoutes.js:223` | `requireAuth` |
| `GET /api/v1/search/scripts` | `src/routes/search.js:68` | `requireAuth` |
| `GET /api/v1/script-voice-clips/:episodeId` | `src/routes/scriptVoiceClipRoutes.js:78` | `requireAuth` |
| `GET /api/v1/episodes/:episodeId/production-package/latest` | `src/routes/productionPackage.js:29-33` | `requireAuth` |
| `GET /api/v1/episodes/:episodeId/production-package/versions` | `src/routes/productionPackage.js:39-43` | `requireAuth` |
| `GET /api/v1/episodes/:episodeId/production-package/:packageId` | `src/routes/productionPackage.js:49-53` | `requireAuth` |
| `GET /api/v1/episodes/:episodeId/production-package/:packageId/download` | `src/routes/productionPackage.js:59-63` | `requireAuth` |
| `GET /api/scripts/:scriptId/metadata` | `src/routes/scriptAnalysis.js:127` | `requireAuth` |

Three tests pinned that standing as "Tier 1" and are changed with the routes (§3): `tests/unit/routes/cp12-episodeScriptWriterRoutes-tier.test.js`, `tests/unit/routes/cp10-search-tier.test.js` and `tests/unit/routes/script-analysis-tier-promotion.test.js`.

## Why a sign-in alone was not enough

- `F-AUTH-1_ScriptsReads_AdminOnly_Amendment_2026-11-21.md` §1 established that the repository has no published state for a script, and §4 of that file named these reads as not yet changed: "Routes that return script text after a sign-in alone (for example `GET /api/v1/episodes/:episodeId/scripts`) are not changed here."
- Evoni's admin-only ruling of 2026-10-29 (`F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md`: "Prime Studios is an admin-only production environment") covers them as it covered the four reads of `src/routes/scripts.js`.

## What the routes answered (MEASURED, from the code at the basis)

To any signed-in account:

- **The Script tab's kept versions** (`episodes.js:831`, `:842`): the list of an episode's kept script versions, and one version with its whole text (`script_content`, `src/services/scriptVersions.js` `getVersion`).
- **An episode's scripts** (`episodes.js:970`, `src/controllers/scriptsController.js:17-32`): the rows `scriptsService.getScriptsByEpisode` returned, as returned. Its first query names `script_type` and `version_number`, and reads every column (`SELECT *`) for `?includeContent=true` (`src/services/scriptsService.js:48-49`).
- **The fallback of that read** (`src/services/scriptsService.js:79-84`): when the first query failed, `SELECT * FROM episode_scripts WHERE episode_id = $1 ORDER BY created_at DESC`. No `deleted_at` filter, every column, the text whether asked for or not; the options were not read.
- **The Script Writer's versions** (`episodeScriptWriterRoutes.js:84`, `:103`, `:122`): the list of versions, and a whole version (`script_text`, `script_json`, `context_snapshot`, `financial_context`, `author_notes`) at any status; and what will feed a generation (`:223`).
- **The script search** (`search.js:68`, `src/controllers/searchController.js:628`): for each match, the first 200 characters of the script's text (`content_preview`), drafts included.
- **The voice clips** (`scriptVoiceClipRoutes.js:78`): each clip's script line (`line_text`) and audio URL.
- **The production packages** (`productionPackage.js:29-63`): every column of a package row (`SELECT *`, `src/controllers/productionPackageController.js`), and a redirect to its ZIP.
- **A script's analysis** (`scriptAnalysis.js:127`): the `script_metadata` rows of a script.

## The `episode_scripts` table, as the migrations make it (MEASURED)

`git grep -l episode_scripts -- src/migrations` names three files; two create the table:

- `src/migrations/20240101000007-create-episode-scripts.js`: `id` (integer), `episode_id`, `version`, `content`, `status`, `is_current`, `created_by`, `notes`, `created_at`, `updated_at`, `deleted_at`.
- `src/migrations/20260718000000-create-episode-scripts-and-feed-posts.js`: `id` (UUID), `episode_id`, `show_id`, `episode_brief_id`, `version`, `status`, `title`, `script_text`, `script_json`, the generation, context and metrics columns of `src/models/EpisodeScript.js`, `created_at`, `updated_at`, `deleted_at`.

Both give the table `deleted_at`. Neither gives it `script_type`, `version_number`, `version_label` or `is_latest`, and no migration under `src/migrations/` adds them (`git grep -n "addColumn('episode_scripts'" -- src/migrations` finds only the self-heal of `version`). INFERRED: on a database built by these migrations alone, the first query of `getScriptsByEpisode` fails and the fallback is the query that answers. Not established: which columns production's table has. No database was read for this amendment.

# §2. The decision (RULED)

Evoni, in the session of 2026-11-22:

> "Non-admin accounts must not receive internal script text at any status."
>
> "Approve SEC-2a and SEC-2b as separate PRs. SEC-2a protects direct script-specific reads."

"SEC-2a" is the name that session used for this change. "SEC-2b" is a separate change, not described here (§4).

No public contract for scripts is created, as in the amendment of 2026-11-21.

# §3. What the change does (MEASURED on the branch)

- **Sign-in and group.** Each of the fifteen routes carries the existing `requireAuth` (401) and `authorize(['ADMIN'])` (403), inline on the route, after any validator it had. No new role, group, middleware or membership check.
- **An episode's scripts, named fields.** `scriptsController.getScriptsByEpisode` sends `singleScript` rows of `src/services/scriptReadFields.js`: the script's facts, and its text only for `?includeContent=true`, whatever the rows carry. `getScriptVersions` sends the names of `SCRIPT_VERSION_FIELDS`.
- **The fallback.** It reads `WHERE episode_id = $1 AND deleted_at IS NULL`, and returns the same named fields (the text only when asked for). It still reads every column of the row it then cuts, because the two schemas above share no text column to name. When it fails too, both failures are logged.
- **The Script Writer's versions.** The version reads ask for the model's columns by name (`WRITER_SCRIPT_FIELDS`), so a column the model gains later is not sent because it is there. For an admin the answer is what it was, less `deleted_at` (always null on a live row).
- **Every `catch` of the four Script Writer reads now logs.**
- **Unchanged for an admin:** the kept versions, the script search, the voice clips, the production packages and the analysis answer as they did.
- **Writes.** No write route is changed.
- **Tests.** New: `tests/unit/routes/episodes-script-reads-admin-only.test.js`, `episodeScriptWriter-reads-admin-only.test.js`, `search-scripts-admin-only.test.js`, `scriptVoiceClips-read-admin-only.test.js`, `productionPackage-reads-admin-only.test.js`, `scriptAnalysis-metadata-admin-only.test.js` (each: signed out 401, signed in and not an admin 403, an admin 200 and its answer) and `tests/unit/services/scriptsService-episode-scripts.test.js` (the fallback). Changed: the three tier tests named in §1, `episodes-cluster-tier-promotion.test.js`, the header comment of `scriptVoiceClipRoutes.test.js`, and the three integration tests that read the kept versions with a non-admin token (`scriptVersions`, `scriptHistoryWriters` and `scriptLineKeysStorage`, under `tests/integration/`). The integration tests need a database and were not run for this amendment.

# §4. What this amendment does not cover

- **SEC-2b.** `GET /api/v1/episodes` and `GET /api/v1/episodes/:id` (which carry `script_content`), and the compositions, decisions, scenes and footage reads, are a separate change on Evoni's words in §2.
- **The production package reads' columns.** `getLatestPackage` and `getPackage` still read `SELECT *`. No migration under `src/migrations/` creates `production_packages` (`git grep -l production_packages -- src/migrations` finds none), so its columns were not named from the repository.
- **The analysis read's columns.** `GET /api/scripts/:scriptId/metadata` answers the model's attributes, as it did.
- **The Episode Overview's word count.** `frontend/src/components/Episodes/EpisodeOverviewTab.jsx` asks for an episode's scripts without `includeContent` and reads `content` from the first; it then stores a count that nothing on the page shows. The read no longer sends `content` unasked. No frontend file is changed.
- **A non-admin on these pages.** A signed-in account that is not in the admin group now gets a 403 from these reads (the Script tab's History, the Script Writer page, the Teleprompter's clips). The pages are not changed here.
- **Stored data.** No row is changed or removed.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server.

---

**Type:** amendment.
**Rules:** the fifteen script-specific `GET` routes of §1 are an ADMIN's, on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** none.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
