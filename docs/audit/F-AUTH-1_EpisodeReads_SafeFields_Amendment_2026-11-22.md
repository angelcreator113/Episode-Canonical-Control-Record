| **PRIME STUDIOS** **F-AUTH-1 — EPISODE READS SEND A NON-ADMIN NAMED SAFE FIELDS (AMENDMENT)** *Adds a rule about what two signed-in reads answer. `GET /api/v1/episodes` and `GET /api/v1/episodes/:id` sent every signed-in account the episode's script, its approved beats, its internal synopsis, its evaluation and, on the single read, every column of the row. Four other answers carried a whole episode row inside them. By Evoni's decision of 2026-11-22 a reader who is not an admin gets named safe fields, and no nested episode carries the script.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `6bd60d84386836fe5aa72dde2212ed58be17b1b0` (committed 2026-11-21 23:25 -0500), plus branch `claude/sec2b-episode-safe-fields`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1 and §3, each with its command or its `file:line`); INFERRED (marked where used).

---

# §1. What is amended

## The two reads as they stood (MEASURED)

Both routes need a sign-in and nothing more. That is unchanged by this amendment.

```
$ git show origin/main:src/routes/episodes.js | grep -n "^router.get('/', \|^router.get('/:id', "
26:router.get('/', validateEpisodeQuery, requireAuth, asyncHandler(episodeController.listEpisodes));
810:router.get('/:id', validateUUIDParam('id'), requireAuth, asyncHandler(episodeController.getEpisode));
```

At the basis, to any signed-in account whatever its group:

- **The list** (`src/controllers/episodeController.js:80-101`, and the same names again in its retry at `:118-123`) selected and sent `description`, `evaluation_json`, `evaluation_status`, `script_content` and `script_locked_beats` beside the episode's name, number, status and thumbnail.
- **The single read** (`src/controllers/episodeController.js:154-162`) was `Episode.findByPk(id, { include: [show] })` with no attribute list, so it sent every column of the row but one. The model's default scope leaves out only `script_line_keys` (`src/models/Episode.js:6`, `:280-282`). Sent with the rest: `script_content`, `script_locked_beats`, `description`, `money_plan`, `total_income`, `total_expenses`, `financial_score`, `setup_status`, `evaluation_json`, `distribution_metadata`, `browse_pool_json`, `teaser_drafted` and the title card and overlay columns.
- **The single read also sent `script_revision`** (`:173-181`), the fingerprint a script write names.
- **The single read answered a deleted episode.** The model is not paranoid (`src/models/Episode.js:268`) and the read had no `deleted_at` test, so a soft-deleted episode was sent with `deleted_at` set. The episode page already treated that answer as not found (`frontend/src/pages/EpisodeDetail.jsx:485`).

The model's own comment says the synopsis is not viewer copy (`src/models/Episode.js:54-55`): "The internal synopsis of what happens (P13, Task #2386). Not viewer copy: the viewer-facing copy is `teaser`."

## The four nested answers as they stood (MEASURED)

Each included an Episode with no attribute list, so the whole row, script included, rode inside another answer, for any signed-in account:

| Route | Where | The include at the basis |
| --- | --- | --- |
| `GET /api/v1/compositions/:id` | `src/services/CompositionService.js:20` (`getComposition`; called at `src/routes/compositions.js:419`) | `{ model: models.Episode, as: 'episode', required: false }` |
| (no route calls it) | `src/services/CompositionService.js:118` (`setPrimary`) | `{ model: models.Episode, as: 'episode' }` |
| `GET /api/v1/decisions/:id` | `src/routes/decisions.js:244` | `{ model: Episode, as: 'episode' }` |
| `PUT /api/v1/scenes/:id` | `src/controllers/sceneController.js:271`; the scene's `toJSON` emits `episode` (`src/models/Scene.js:521`) | `include: 'episode'` |
| `POST /api/footage/episodes/:episodeId/assets` | `src/routes/footage.js:206-216` | `Episode.findByPk(episodeId, { include: [assets] })`, answered as `episode` |

`setPrimary` has no caller in `src/` (MEASURED: `grep -rn "setPrimary(" src --include=*.js` finds only its definition and the scripts service's own `setPrimary`). It is given the same list so it does not become a way back.

Not established: whether any account outside the admin group exists in production, or has called these routes. No database was read for this amendment, and no route was called on any deployed site.

# §2. The decision (RULED)

Evoni, in the session of 2026-11-22:

> "Non-admin accounts must not receive internal script text at any status."
>
> "Remove the internal episode "description" synopsis from non-admin responses. Use an existing approved public teaser or synopsis where available. Do not invent public copy or expose private production notes as a substitute. Keep the episode list and detail accessible under their existing permission rules, returning only approved safe fields."
>
> "SEC-2b protects episode responses and nested script-bearing data. Use existing authorization and explicit field allowlists. Preserve non-admin access to legitimate episode information without exposing private scripts, locked beats, internal synopses, financial data or production notes. Verify all relevant frontend consumers and update their tests."

"SEC-2b" is the name that session used for this change.

# §3. What the change does (MEASURED on the branch)

## The middleware is the same

```
$ grep -n "^router.get('/', \|^router.get('/:id', " src/routes/episodes.js
26:router.get('/', validateEpisodeQuery, requireAuth, asyncHandler(episodeController.listEpisodes));
810:router.get('/:id', validateUUIDParam('id'), requireAuth, asyncHandler(episodeController.getEpisode));
```

No new role, group or membership check. The admin test is the existing `userInGroup(user, 'ADMIN')` (`src/middleware/auth.js`), the one `authorize()` uses.

## The safe fields

`src/services/episodeReadFields.js` names what a reader who is not an admin is sent (`EPISODE_SAFE_FIELDS`, `:34-38`):

`id`, `episode_number`, `season_number`, `title`, `air_date`, `status`, `categories`, `show_id`, `thumbnail_url`, `platform`, `width`, `height`, `aspect_ratio`, `teaser`, `season_context`, `created_at`, `updated_at`

with the episode's `show` as both reads already included it (`id`, `name`, `icon`, `color`), and three facts worked out on the server from the row:

- `has_script`: there is script text that is more than white space.
- `script_approved_beat_count`: the approved beats, counted as `frontend/src/lib/productionSteps.js` `approvedBeats` counts them (beats 1 to 14, once each).
- `script_line_count`: the script's lines, as Producer Mode's ledger counted them.

Nothing else of the row is sent, so a column the table gains later is not sent because it is there.

- **The synopsis.** `description` is not among the safe fields. `teaser`, the model's viewer copy, is. Nothing is written in the synopsis's place, and an episode with no teaser has none.
- **`season_context`.** The snapshot holds the season's planning text beside where the episode sits (`src/services/seasonSlotService.js:446` on: `arc_title`, `arc_tagline`, `arc_logline`, `arc_description`, the phase's `title`, `tagline` and `emotional_arc`, `story_purpose`, `career_focus`, `desired_pressure`, `outcome_range`, `story_thread`, `story_purposes`). A non-admin is sent only where the episode sits: `label`, `season_number`, `slot_number`, `arc_id`, `phase_count`, `position_in_phase`, `snapshotted_at`; the phase's `number`, `episode_start`, `episode_end`; a two-parter's `part`, `of`, `other_slot_number`, `label`; a special's `id`, `kind`, `special_type`, `after_slot_number`, `label`, `counts_toward_parts`. The phase's title and the special's title are not sent. INFERRED: those two titles are planning text; a ruling that they are fit for a non-admin would add them to the lists at `:65` and `:67`.

## The two reads

- **The list** (`src/controllers/episodeController.js:103`, `:136`). An ADMIN is read and sent the same columns as before. Anyone else is read the safe fields and the two columns the facts come from, and sent the safe fields and the facts. Both the first query and its retry use the same list.
- **The single read** (`:185-187`). Anyone who is not an admin is sent `{ data }` built from the safe fields, and no `script_revision`; the revision is not read for them. An ADMIN is sent the row and `script_revision` as before (`:194-197`).
- **A deleted episode is not found** (`:173`), for an admin too. Nothing reads a deleted episode through this route: the only page that looked at `deleted_at` in this answer is the episode page, which treated it as not found (`frontend/src/pages/EpisodeDetail.jsx:485`), and its own handling of a 404 does the same. The Recycle Bin page reads `/api/v1/memories` (MEASURED: `grep -n "/api/" frontend/src/pages/RecycleBin.jsx`).

## The four nested answers

Each Episode include now names `EPISODE_NESTED_FIELDS` (`id`, `title`, `episode_number`, `season_number`, `status`, `show_id`), for every reader, admins too:

```
$ grep -n "EPISODE_NESTED_FIELDS\]" src/services/CompositionService.js src/routes/decisions.js src/controllers/sceneController.js src/routes/footage.js
src/services/CompositionService.js:25:            attributes: [...EPISODE_NESTED_FIELDS],
src/services/CompositionService.js:124:            attributes: [...EPISODE_NESTED_FIELDS],
src/routes/decisions.js:246:        { model: Episode, as: 'episode', attributes: [...EPISODE_NESTED_FIELDS] },
src/controllers/sceneController.js:274:      include: [{ model: Episode, as: 'episode', attributes: [...EPISODE_NESTED_FIELDS] }],
src/routes/footage.js:209:      attributes: [...EPISODE_NESTED_FIELDS],
```

No page reads more of the nested episode than that (MEASURED: `frontend/src/pages/TemplateDesigner.jsx` reads the composition's `outputs`; `frontend/src/services/decisionService.js` `getDecision` has no caller; `frontend/src/services/sceneService.js` `updateScene`'s two callers discard the answer, and `sceneAPI.update` in `frontend/src/services/api.js` has no caller; `linkAssetsToEpisode` in `frontend/src/services/footageService.js` and `assetService.js` has no caller outside those files). These routes' middleware is unchanged.

## The pages

A page that only asked whether there is a script, or counted its beats or lines, now reads the fact when the episode comes without the text (`frontend/src/lib/episodeScriptFacts.js`; `approvedBeatCount` in `frontend/src/lib/productionSteps.js`). When the episode carries the text, the text decides, by the rule each page already used, so an admin's page reads as before. Touched: `lib/episodePipeline.js` (`cardLine`), `lib/productionSteps.js` (`productionSteps`), `lib/episodeNextAction.js` (`primaryAction`), `utils/workflowRouter.js` (`suggestStatusAdvance`), `utils/episodePlanning.js` (`episodePlanning`), `components/Show/ShowEpisodesBoard.jsx`, `components/Show/EpisodeLedger.jsx`, `components/Episodes/EpisodeOverviewTab.jsx`.

## Tests

- `tests/unit/services/episodeReadFields.test.js`: the lists, the facts, an ADMIN's row unchanged, a column that is not named, the synopsis absent, `season_context`.
- `tests/unit/routes/episodes-reads-safe-fields.test.js`: the real router, auth middleware and controller over stand-in models. Signed out is a 401; a non-admin's list and single read carry no script, locked beats, revision, synopsis, evaluation or money columns and carry `has_script`; an ADMIN's carry the script and the revision; the list's retry; a deleted episode.
- `tests/unit/routes/nested-episode-no-script.test.js`: the four nested answers, for a non-admin and an admin.
- `tests/unit/controllers/episode.test.js`: its user is an admin as `auth.js` builds one (`groups`), and non-admin cases are added.
- Seven integration files read the script revision or the locked beats from the single read with an editor's token; that read is now made with an admin's token, and the editor's writes are as they were: `scriptBeatLocks`, `scriptVersions`, `scriptHistoryWriters`, `scriptWriters`, `eventFromLink`, `activityLog`, `readinessGates` (each `tests/integration/<name>.integration.test.js`). Not run in the session that wrote them: it had no PostgreSQL.
- Frontend: `lib/episodeScriptFacts.test.js` and `utils/workflowRouter.test.js` are new; the tests beside each touched page or function gained non-admin cases.

# §4. What this amendment does not cover

- **Writes.** No write route's middleware or answer is changed. `PUT /api/v1/episodes/:id` still answers a signed-in writer with the whole episode row (`src/controllers/episodeController.js:670-672` on the branch), script included, and a script save sent without a revision is refused with the current one (`src/services/scriptSave.js:176`). So an account that may write can still read the script through a write's answer. Closing that is a separate change and needs Evoni's ruling on who may write.
- **The script-specific reads.** Routes that return script text by name (for example `GET /api/v1/episodes/:episodeId/scripts` and the script versions) are a separate change, SEC-2a, written on its own branch.
- **Group C.** The remaining reads of that session's list are separate.
- **Other nested episodes.** `src/controllers/wardrobeApprovalController.js:50`, `:150` and `:322` include an Episode with no attribute list. They were found while reading for this change, are outside the scope Evoni approved, and are not changed. INFERRED: their answers carry the whole row; they were not called.
- **Stored data.** No row is changed. No migration.
- **Living documents.** A document outside `docs/audit/` that describes these answers is not edited here.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server.

---

**Type:** amendment.
**Rules:** `GET /api/v1/episodes` and `GET /api/v1/episodes/:id` send a reader who is not an admin the named safe fields; no episode nested in the four answers of §1 carries more than its name; on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** none. No host, AWS, database or Cognito call was made.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer): "Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1)". What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
