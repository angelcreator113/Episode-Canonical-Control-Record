# Canon Absent-Table Classification

**Basis:** `origin/main` at `938216c3b31176f19b140b991e282e9182209ac9` (2026-09-17).

**What this answers.** `docs/audit/Canon_TableExpectation_Census_2026-09-17.md` §5 recorded, for each of
193 code-expected tables absent from the 2026-08-29 canon capture (56 rows), which `src/routes/`
file(s) a grep hit. That grep was coarse — a "hit" could be a short-token false positive (`beats`,
`layers`, `markers`, `jobs`, `users` are also English words) or a column/comment/string match rather
than real table access. This note re-derives each of the 56 to REAL (code would error against canon
today if the table doesn't exist) or FALSE POSITIVE, with file:line evidence, and separately searches
canon's 143 captured table names for near-name variants of each of the 56. It is prep for Evoni's
forthcoming schema-fork ruling — the exact list that ruling will act on, not itself. **It does not
choose a schema, rule anything, or mint anything** (§7).

Issue: #1508. Filed as the prep work Evoni's forthcoming schema-fork ruling is waiting on; that
ruling has not been filed and is not recorded anywhere in this note.

---

## §1. Input: the 56 rows

Taken from `Canon_TableExpectation_Census_2026-09-17.md` §5 (the full "route file(s) referencing it"
column is carried there, not re-quoted here):

```
FileStorages, ai_edit_plans, ai_interactions, ai_revisions, ai_training_data, audio_clips, beats,
brain_documents, chapter_versions, character_clips, character_profiles, choice_stats,
composition_versions, cursor_actions, decision_logs, decision_patterns, edit_maps, editing_decisions,
episode_phases, event_chain, game_wardrobe, icon_cues, icon_slot_mappings, interactive_elements, jobs,
lala_cash_grab_quests, lala_episode_formulas, lala_episode_timeline, lala_formula_episodes,
lala_friend_archetypes, lala_micro_goals, layer_assets, layer_presets, layers, layout_templates,
markers, music_cues, processing_queues, production_packages, raw_footage, scene_footage_links,
scene_layer_configuration, script_edit_history, script_learning_profiles, script_metadata,
script_suggestions, script_templates, search_filter_presets, show_configs, timeline_events,
upload_logs, user_decisions, users, video_processing_jobs, video_scenes, world_tensions
```

**MEASURED** — 56 names, `wc -l` against a file holding one per line confirms the count matches the
census's own §4.1 figure.

---

## §2. Methodology

**Scope, corrected this pass.** The first two passes of this note searched only `src/routes/`,
`src/services/`, `src/workers/` — the census's own scope for locating a "reference." That scope is
wrong for *this* note's question (would code error against canon today), because this codebase
routes almost every handler through `src/controllers/`: a route file typically does
`router.get('/x', requireAuth, asyncHandler(someController.getX))` with no model or SQL access of its
own, and the actual database call is one layer down, in the controller. Searching only routes made
every one of those routes look like "no real access" — which is backwards; the controller a mounted
route delegates to is the same request path as if the route called the model directly. **`src/controllers/`
is now included in scope, and so is `src/middleware/`** (checked, zero hits for any of the 56 — see
below). `src/queues/` and `src/sockets/` were also spot-checked informationally (zero hits for any of
the 56) but are not claimed as swept with the same rigor as the four directories above.

For each of the 56, searched `src/routes/`, `src/services/`, `src/workers/`, `src/controllers/`,
`src/middleware/` for:
- the resolved Sequelize model class (where `src/models/<Class>.js` exists — resolved from its
  `sequelize.define('<Class>', ...)` registration or `tableName:` property), for calls of the shape
  `<Class>.<method>(` or `db.<Class>` (`.findAll`, `.create`, `.update`, `.destroy`, `.findOne`,
  `.findByPk`, `.bulkCreate`, `.findAndCountAll`);
- non-Sequelize custom model classes (`static tableName = '<table>'`, found for exactly two tables
  codebase-wide — `src/models/file.js` and `src/models/job.js` — the latter matches one of the 56);
- the raw table name, word-bounded, in `FROM|INTO|UPDATE|JOIN` position (case-insensitive, covers
  raw SQL, CTEs, and — separately checked — `${this.tableName}`-style dynamic interpolation, which a
  literal-string grep cannot match; `grep -rnE "(FROM|INTO|UPDATE|JOIN)\s+\$\{" src/` found exactly the
  two files above, nothing else).

**Classes:**
- **REAL-ROUTE** — at least one genuine hit in `src/routes/` **or `src/controllers/`** (a controller
  a mounted route delegates to is part of the same request path).
- **REAL-SERVICE** — genuine hits only in `src/services/` or `src/workers/`, with no route or
  controller access.
- **FALSE POSITIVE** — every hit found is not real table access (variable name, comment, JSDoc,
  string literal, JSON-object property, a column name on a different table, or a different table
  entirely) — shown per row.
- **UNUSED** — no access found anywhere in `src/routes/`, `src/controllers/`, `src/services/`,
  `src/middleware/`, or `src/workers/` (model or migration only).

A table classified REAL-ROUTE via a controller is only counted that way once the controller's route
file is confirmed **required and mounted** in `src/app.js` — cited per row in §3, not assumed from the
controller's existence alone.

`beats`, `layers`, `markers`, `jobs`, `users` were done first and checked hit-by-hit, per the census's
own short-token flag.

**Provenance and independent re-verification.** A first pass delegated the mechanical sweep (routes/
services/workers only, before the scope correction above) to a subagent. Before trusting any of it, 7
rows spanning all four outcome classes were re-run by hand — all 7 reproduced exactly, and one spot
check already found a hit the subagent had missed. That partial check was not enough on its own, so
every one of the 56 was then re-run fresh, in one batch, still routes/services/workers only. Both of
those passes are superseded by this one: once controllers were added to scope and re-swept — plus a
separate, targeted search for non-Sequelize custom models and `${...}`-interpolated raw SQL — 11 more
tables changed class (`FileStorages`, `beats`, `character_clips`, `cursor_actions`, `icon_cues`,
`icon_slot_mappings`, `jobs`, `markers`, `music_cues`, `production_packages`, `users`, all now
REAL-ROUTE), and one (`audio_clips`) gained a second, independent real path with no class change.
Every citation in §3 and §6 below traces to a command run in this session against the current
`src/controllers/`/`src/middleware/`-inclusive tree, not to either earlier pass.

---

## §3. Classification — all 56

| table | class | evidence (file:line) | note |
|---|---|---|---|
| `FileStorages` | REAL-ROUTE | `src/controllers/fileController.js:52` `FileStorage.create`, `:155,:216,:318` `.findOne`, `:283` `.findAll` | **Corrected this pass.** `src/routes/files.js` requires `fileController` and is required at `src/app.js:443` and mounted `app.js:679` (`app.use('/api/v1/files', filesRoutes)`). `FileStorage.js:114` sets `tableName: 'FileStorages'`. Route → controller → model, fully wired; not UNUSED. |
| `ai_edit_plans` | FALSE POSITIVE | `src/services/sqsService.js:24` | JSDoc `@param jobData.editPlanId - AIEditPlan UUID` — comment, not code. **MEASURED**, re-verified: `sed -n '15,30p' src/services/sqsService.js` shows only the JSDoc block, no model/SQL call. |
| `ai_interactions` | UNUSED | none | Migration-only, confirmed zero hits. |
| `ai_revisions` | UNUSED | none | `AIRevision` model never called outside `src/models/`. |
| `ai_training_data` | REAL-ROUTE | `src/routes/youtube.js:237` `AITrainingData.findByPk(videoId)`; also `src/services/youtubeService.js:325,533,540,544` | Route-level model call makes this REAL-ROUTE. |
| `audio_clips` | REAL-ROUTE | `src/routes/animatic.js:175,236` `AudioClip.findAll(...)`; also `src/controllers/audioClipController.js:52` `.findAll`, `:82,:180,:213` `.findByPk`, `:145` `.create` | Already REAL-ROUTE via `animatic.js` directly; controllers now also searched, and `src/routes/audio-clips.js` (required `app.js:737`, mounted `app.js:741`: `app.use('/api/v1', audioClipRoutes)`) gives a second, independent real path through `audioClipController`. No class change, added for completeness. |
| `beats` | REAL-ROUTE | `src/controllers/beatController.js:52` `Beat.findAll`, `:82,:175,:208` `.findByPk`, `:140` `.create`. Also service-level: `src/services/beatService.js:122` `.bulkCreate` etc.; raw SQL `src/services/phoneContextBuilder.js:121` `FROM beats b`. | **Corrected this pass — was wrongly FALSE-POSITIVE-for-routes/REAL-SERVICE.** `src/routes/beats.js` delegates every handler to `beatController` (`router.get('/beats/:id', requireAuth, asyncHandler(beatController.getBeat))` etc.), and `beatController.js` itself calls `Beat.findAll`/`.findByPk`/`.create` directly. `beats.js` is required at `src/app.js:735` and mounted `app.js:739` (`app.use('/api/v1', beatRoutes)`). `Beat.js:89` sets `tableName: 'beats'`. Controllers are the actual handler layer a mounted route delegates to — real access there counts as REAL-ROUTE, same as if the route file called the model directly. Every other census-flagged route file's "beats" hit is still prose (`episodeScriptWriterRoutes.js:7`, `memories/extras.js:241`, comments) or a **column name** selected `FROM timeline_data` (`export.js:87-93`: `SELECT keyframes, beats, markers, audio_clips, character_clips FROM timeline_data WHERE episode_id = $1`) — not the `beats` table. |
| `brain_documents` | REAL-ROUTE | `src/routes/franchiseBrainRoutes.js:427` `db.BrainDocument.create`, `:457` `.findAll`, `:473` `.findByPk` | |
| `chapter_versions` | REAL-ROUTE | `src/routes/storyHealth.js:257,292` (FROM), `:299` (INSERT INTO), `:318` (SELECT FROM) | Raw SQL. |
| `character_clips` | REAL-ROUTE | `src/controllers/characterClipController.js:62` `CharacterClip.findAll`, `:92,:204,:237` `.findByPk`, `:166` `.create`. Also service-level: `src/services/beatService.js:293` `.bulkCreate` etc. | **Corrected this pass — was wrongly REAL-SERVICE-only.** `src/routes/character-clips.js` delegates every handler to `characterClipController` (`router.get('/character-clips/:id', requireAuth, asyncHandler(characterClipController.getCharacterClip))` etc.), and `characterClipController.js` calls `CharacterClip.findAll`/`.findByPk`/`.create` directly. `character-clips.js` is required at `src/app.js:736` and mounted `app.js:740` (`app.use('/api/v1', characterClipRoutes)`). `CharacterClip.js:112` sets `tableName: 'character_clips'`. `animatic.js`, `episodes.js`, `export.js`, `timelineData.js` still reference `character_clips` only as a column of `timeline_data` (same `export.js:87-93` query) or a plain JS variable/object key — not table access on their own, but the controller path above is genuine and real, so the table as a whole is REAL-ROUTE. |
| `character_profiles` | REAL-ROUTE | `src/routes/editMaps.js:122` `db.CharacterProfile.findAll`, `:147` `.create` | |
| `choice_stats` | REAL-SERVICE | `src/services/decisionAnalyticsService.js:221` (`WITH choice_stats AS`), `:236` (FROM choice_stats) | |
| `composition_versions` | REAL-SERVICE | `src/services/FilterService.js:169,173`; `src/services/VersioningService.js:33,64,195,247,270,288` | INSERT/SELECT/JOIN/DELETE, all genuine. |
| `cursor_actions` | REAL-ROUTE | `src/controllers/cursorPathController.js:65,119,457` (SELECT), `:183` (INSERT), `:268,:344,:384,:423` (UPDATE), `:308` (DELETE); also `src/services/cursorPathGeneratorService.js:89,209`, `productionPackageService.js:131` | **Corrected this pass.** No dedicated model — raw SQL throughout. `src/routes/cursorPaths.js` requires `cursorPathController` (required `app.js:598`, mounted `app.js:940`: `app.use('/api/v1/episodes', cursorPathRoutes)`). Ten call sites in the controller alone, full CRUD — this table is more heavily used at the controller layer than the service layer the first pass checked. |
| `decision_logs` | REAL-ROUTE | `src/routes/decisionLogs.js:19` `DecisionLog.create`, `:52,:76` `.findAll` | **MEASURED**, re-verified. `DecisionLog.js:63` sets `tableName: 'decision_logs'` (plural) — the code targets the plural name; canon has `decision_log` (singular) instead — genuine naming ambiguity, see §4. |
| `decision_patterns` | REAL-ROUTE | `src/routes/decisions.js:150` `DecisionPattern.findAll` | |
| `edit_maps` | REAL-ROUTE | `src/routes/editMaps.js:26` `db.EditMap.create`, `:72` `.findOne`, `:99,:171` `.findByPk` | |
| `editing_decisions` | UNUSED | none | `EditingDecision` model never referenced outside `src/models/`. |
| `episode_phases` | UNUSED | none | Migration-only, confirmed. |
| `event_chain` | REAL-SERVICE | `src/services/feedEventPipelineService.js:731` (`WITH RECURSIVE event_chain AS`), `:739,:742` | Line 641's `source: 'event_chain'` is a string literal, not table access — the CTE lines are genuine. |
| `game_wardrobe` | REAL-ROUTE | `src/routes/episodeOrchestrationRoute.js:33` `SELECT * FROM game_wardrobe WHERE show_id = :show_id` | |
| `icon_cues` | REAL-ROUTE | `src/controllers/iconCueController.js:65,478,597` (SELECT), `:178` (INSERT), `:257,:333,:373,:412,:445,:518,:557` (UPDATE), `:297` (DELETE); also `src/services/cursorPathGeneratorService.js:100`, `iconCueGeneratorService.js:78,485`, `productionPackageService.js:124` | **Corrected this pass.** No dedicated model — raw SQL throughout. `src/routes/iconCues.js` requires `iconCueController` (required `app.js:588`, mounted `app.js:939`: `app.use('/api/v1/episodes', iconCueRoutes)`). `productionPackageService.js`'s other `icon_cues.*` hits are markdown filename strings (`"cues/icon_cues.md"`), not table access, as noted before — irrelevant now that the controller path is confirmed real. |
| `icon_slot_mappings` | REAL-ROUTE | `src/controllers/iconSlotController.js:14,45,81` (SELECT), `:135` (INSERT), `:217` (UPDATE), `:257` (DELETE); also `src/services/cursorPathGeneratorService.js:195`, `iconCueGeneratorService.js:522` | **Corrected this pass.** No dedicated model — raw SQL throughout. `src/routes/iconSlots.js` requires `iconSlotController` (required `app.js:628`, mounted `app.js:943`: `app.use('/api/v1/icon-slots', iconSlotRoutes)`). |
| `interactive_elements` | FALSE POSITIVE | `src/services/iconCueGeneratorService.js:157-158` | **MEASURED**. `sceneMetadata.interactive_elements` is a JSON-object property access, not a table/column reference — no `FROM/INTO/UPDATE/JOIN` found anywhere in scope. |
| `jobs` | REAL-ROUTE | `src/models/job.js:29` `static tableName = 'jobs'`; `:41` `INSERT INTO ${this.tableName}`, `:72` `SELECT * FROM ${this.tableName}` (and 8 more sites in the same file); called from `src/controllers/jobController.js:38` `Job.create(...)`. Also `src/services/ErrorRecovery.js:91,121,150,178,229` (literal `FROM/UPDATE jobs`). | **Corrected this pass, and not just for controllers.** `src/models/job.js` is a **non-Sequelize custom class** (`static tableName = 'jobs'`, hand-written `db.query()` calls) that builds its SQL with `${this.tableName}` — a dynamic table-name interpolation my literal-string grep (`FROM jobs`) could not match; found only by grepping for `static tableName` and `${...}` interpolation directly. `POST /api/v1/jobs` (`src/routes/jobs.js:15`, required `app.js:447`, mounted `app.js:681`) → `jobController.createJob` (`jobController.js:38`) → `Job.create()` → real `INSERT INTO jobs`. Note the same controller's `GET /:jobId` and `GET /` (`getJobStatus`/`listJobs`) instead query the **Sequelize** `ProcessingQueue` model (table `processing_queue`, singular, already in canon) — a genuine split design: creation writes to `jobs` via the custom `Job` class, status/listing reads from `processing_queue` via Sequelize. Both are real; only `jobs` (plural) is one of the 56. The other 7 census-flagged route files remain false positives in isolation, as before, but that no longer matters — the table itself is REAL-ROUTE via `jobController.js`. |
| `lala_cash_grab_quests` | UNUSED | none | Migration-only, confirmed. |
| `lala_episode_formulas` | UNUSED | none | Migration-only, confirmed. |
| `lala_episode_timeline` | UNUSED | none | Migration-only, confirmed. |
| `lala_formula_episodes` | REAL-SERVICE | `src/services/iconCueGeneratorService.js:110`; `musicCueGeneratorService.js:90`; `productionPackageService.js:145` | All three: `SELECT * FROM lala_formula_episodes WHERE episode_id = $1`. |
| `lala_friend_archetypes` | UNUSED | none | Migration-only, confirmed. |
| `lala_micro_goals` | UNUSED | none | Migration-only, confirmed. |
| `layer_assets` | REAL-ROUTE | `src/routes/layers.js:287` `LayerAsset.create`, `:305,:347,:371,:399` `.findByPk` | |
| `layer_presets` | UNUSED | none | `LayerPreset` model (`tableName: 'layer_presets'`) never referenced in scope. |
| `layers` | REAL-ROUTE | `src/routes/layers.js:34` `Layer.findAll`, `:61,:174,:215,:270` `.findByPk`, `:129` `.create`, `:452` `.bulkCreate` | Genuine throughout; no false positives found for this one. |
| `layout_templates` | UNUSED | none | Migration-only, confirmed. |
| `markers` | REAL-ROUTE | `src/controllers/markerController.js:55` `Marker.findAll`, `:102,:257,:337,:370` `.findByPk`, `:197` `.create`, `:417` `.getByType` | **Corrected this pass — was wrongly FALSE POSITIVE.** `src/routes/markers.js` delegates every handler to `markerController` (`router.get('/markers/:id', requireAuth, asyncHandler(markerController.getMarker))` etc.), and `markerController.js:55` calls `Marker.findAll` directly. `markers.js` is required at `src/app.js:717` and mounted `app.js:718` (`app.use('/api/v1', markerRoutes)`). `Marker.js:136` sets `tableName: 'markers'`. The original pass treated the route file's own delegation as "no real access" because it searched `src/routes/`, `src/services/`, `src/workers/` only — the actual access is one layer down, in the controller the route calls, which is squarely in the request path. `calendarRoutes.js`/`storyteller.js`'s hits are still a different model, `StoryClockMarker` (table `story_clock_markers`, already present in canon — not one of the 56); `timelineData.js:29,42,51` and `export.js:92` still reference `markers` only as a column of `timeline_data`, not the table — but neither of those matters now that the controller path is confirmed real. |
| `music_cues` | REAL-ROUTE | `src/controllers/musicCueController.js:52,378` (SELECT), `:103` (SELECT by id), `:160` (INSERT), `:230,:306,:345` (UPDATE), `:270` (DELETE); also `src/services/musicCueGeneratorService.js:376`, `productionPackageService.js:138` | **Corrected this pass.** No dedicated model — raw SQL throughout. `src/routes/musicCues.js` requires `musicCueController` (required `app.js:608`, mounted `app.js:941`: `app.use('/api/v1/episodes', musicCueRoutes)`). |
| `processing_queues` | REAL-SERVICE | `src/services/cfoAgent.js:384` `WHERE relname IN ('activity_logs', 'ai_usage_logs', 'processing_queues', 'amber_findings')`; `:542` `SELECT COUNT(*)::int AS cnt FROM processing_queues WHERE status = 'failed'` | **MEASURED**, re-verified directly, twice. `ProcessingQueue.js:110` sets `tableName: 'processing_queue'` (singular) — the model's own table name already equals canon's. The plural `'processing_queues'` appears only in these two `cfoAgent.js` sites: `:384` checks Postgres catalog stats with `relname IN (...)`, which does not error on a name with no matching relation; `:542` is a direct `FROM processing_queues` reference, inside a `try { ... } catch { // Table might not exist }` (lines 539–550) — the code already anticipates this failure and swallows it silently. Not a naming question for the ruling; see §4. |
| `production_packages` | REAL-ROUTE | `src/controllers/productionPackageController.js:58,98,133,169` (SELECT), `:212` (DELETE); also `src/services/productionPackageService.js:447` (SELECT), `:531` (UPDATE), `:537` (INSERT) | **Corrected this pass.** No dedicated model — raw SQL throughout. `src/routes/productionPackage.js` requires `productionPackageController` (required `app.js:618`, mounted `app.js:942`: `app.use('/api/v1/episodes', productionPackageRoutes)`). |
| `raw_footage` | FALSE POSITIVE | `src/routes/editMaps.js:28,37,73` (`raw_footage_id`, a foreign-key column name); `src/routes/footage.js:94,108,144,301,304,306,307` (`raw_footage_s3_key` column, and one S3 bucket-name string `'episode-metadata-raw-footage-dev'`) | **MEASURED**, re-verified directly: zero `FROM/INTO/UPDATE/JOIN raw_footage` hits anywhere in scope. Every hit is a column name on a different table, or a bucket-name string literal. Census already noted "Model file itself absent" (§3(a)); this confirms no route/service access to a `raw_footage` table exists either. |
| `scene_footage_links` | REAL-ROUTE | `src/routes/sceneLinks.js:16,131` `.findOne`, `:24,:156` `.create`, `:33,:80` `.findByPk`, `:52` `.findAll` (all `SceneFootageLink.*`) | |
| `scene_layer_configuration` | UNUSED | none | `SceneLayerConfiguration` model never referenced in scope, confirming the census. |
| `script_edit_history` | UNUSED | none | `ScriptEditHistory` model never referenced. **Not to be conflated** with canon's `script_edits` (a genuinely distinct table, real use in `src/services/scriptsService.js:621,640`) — different table, different purpose, only a naming resemblance. |
| `script_learning_profiles` | UNUSED | none | `ScriptLearningProfile` model never referenced. |
| `script_metadata` | REAL-ROUTE | `src/routes/sceneLinks.js:103` `ScriptMetadata.findAll`; `src/routes/scriptAnalysis.js:73` `.destroy`, `:80` `.create`, `:131` `.findAll` | |
| `script_suggestions` | UNUSED | none | `ScriptSuggestion` model never referenced. |
| `script_templates` | REAL-ROUTE | `src/routes/scriptGenerator.js:70` `db.ScriptTemplate.findOne`, `:95` `.create`, `:136,:211` `.findByPk` | |
| `search_filter_presets` | REAL-SERVICE | `src/services/FilterService.js:301` (INSERT INTO), `:329` (FROM), `:349` (DELETE FROM) | |
| `show_configs` | REAL-ROUTE | `src/routes/scriptGenerator.js:14` `db.ShowConfig.findOne`, `:18` `.create`, `:47,:50` | |
| `timeline_events` | REAL-ROUTE | `src/routes/storyHealth.js:207,553` (FROM) | |
| `upload_logs` | UNUSED | none | Migration-only, confirmed. |
| `user_decisions` | REAL-ROUTE | `src/routes/decisions.js:37` `UserDecision.create`, `:91` `.findAndCountAll`, `:174` `.findAll`, `:242` `.findByPk` | |
| `users` | REAL-ROUTE | `src/controllers/searchController.js:489` `db.query('SELECT name, email FROM users WHERE id = $1 LIMIT 1', [activity.user_id])` | **Corrected this pass — was wrongly FALSE POSITIVE.** Found only once controllers were searched. `src/routes/search.js` requires `searchController` and is required at `src/app.js:445`, mounted `app.js:680` (`app.use('/api/v1/search', searchRoutes)`). The query sits inside an audit-trail enrichment step (`GET`-path search results), wrapped in `.catch(() => ({ rows: [] }))` — the author's own comment reads "Note: Adjust query based on your user table structure," suggesting they weren't confident of the schema either. No dedicated `User`/`Users` Sequelize model exists — auth in this codebase is Cognito-backed — so this one raw query is the entire `users`-table surface: real, but narrow and already defensively wrapped. The 4 hits the census originally flagged (`memories/assistant.js:1806`, `interview.js:647`, `planning.js:722`, `wardrobeLibrary.js:245`) are still prose, not SQL — they don't change; what changes is that a 5th, real hit existed in a file none of those four passes searched. |
| `video_processing_jobs` | FALSE POSITIVE | `src/services/sqsService.js:22` | JSDoc `@param jobData.jobId - VideoProcessingJob UUID` — comment, not code, same file/pattern as `ai_edit_plans` above. |
| `video_scenes` | REAL-ROUTE | `src/routes/youtube.js:152` (FROM video_scenes); `src/services/youtubeService.js:406` (INSERT INTO) | Route-level hit makes this REAL-ROUTE. |
| `world_tensions` | REAL-ROUTE | `src/routes/storyHealth.js:379,536` (FROM) | |

---

## §4. Near-name variants

**Method.** Normalized all 56 absent names and all 143 canon-captured names (lowercase, strip
underscores/camelCase boundaries) and compared for exact match, singular/plural match (simple
suffix rule: `-ies→-y`, `-s→∅`), and substring overlap ≥5 characters. **MEASURED**, script and
full output kept in this session's scratchpad, reproducible with the same normalization rule.

**One confirmed naming ambiguity** — same-looking concept, different name, unresolved which (if
either) canon's table corresponds to:

| absent (code) | canon variant | code's columns (`src/models/DecisionLog.js`) | canon's columns (2026-08-29 capture) |
|---|---|---|---|
| `decision_logs` | `decision_log` | `id, episode_id, scene_id, user_id, action_type, entity_type, entity_id, action_data, context_data, timestamp` | `id, type, episode_id, show_id, user_id, context_json, decision_json, alternatives_json, confidence, source, created_at` |

**Not a clean rename.** `DecisionLog.js:63` sets `tableName: 'decision_logs'` (plural) — the code
targets the plural name; canon has only `decision_log` (singular). But the column sets also diverge
beyond naming: canon's (`type`, `decision_json`, `alternatives_json`, `confidence`, `source`) don't
correspond to the model's (`action_type`, `entity_type`, `entity_id`, `action_data`, `context_data`)
beyond `id`/`episode_id`/`user_id` — canon's table may be an older or unrelated design that happens to
share a name, not simply the same table under a different plural. **Flagged for the ruling; not
resolved here** — whether it's "the same table, needs migration" or "two different things" is not
decidable from a schema-only capture (no row data was read, per this note's own scope).

**One case that is *not* a naming collision, corrected from an earlier pass of this note:**
`processing_queues` was initially flagged alongside `decision_logs`/`decision_log` above. It isn't the
same kind of question. `ProcessingQueue.js:110` sets `tableName: 'processing_queue'` — **singular,
already identical to canon's actual table name.** There is no ambiguity about which name is correct;
the model already targets the table canon has. What exists instead is a **column-shape delta on that
same, identified table**: canon's `processing_queue` has `id, episode_id, task, status, created_at,
updated_at`; the model expects `id, episodeId, jobType, status, sqsMessageId, sqsReceiptHandle,
jobConfig, errorMessage, retryCount, maxRetries, createdAt, startedAt, completedAt`. Canon's columns
are a strict subset of the model's — consistent with canon holding an older, simpler shape of the same
table, predating the SQS-based retry fields; not two different tables in question the way
`decision_log`/`decision_logs` might be. The plural `'processing_queues'` that produced this table's
entry in the census's 56 comes from two unrelated raw-SQL sites in `cfoAgent.js` (§3, §6) referencing
a table name that doesn't exist under either spelling's normal meaning — that's a separate,
already-diagnosed fact about `cfoAgent.js`, not a second item for this ruling to decide between names.

**No other genuine near-name variant found.** The substring pass surfaced coincidental shared-root
matches only (e.g. `character_clips`/`character_profiles` sharing "character" with `characters`;
`scene_footage_links`/`scene_layer_configuration`/`video_scenes` sharing "scene" with `scenes`;
`game_wardrobe` sharing "wardrobe" with `wardrobe`) — none of these name a plausible identity match,
just shared domain vocabulary in a schema with many `character_*`/`scene_*` tables. One borderline
case worth naming: `script_edit_history` shares the prefix `script_edit` with canon's real,
separately-used `script_edits` — flagged as a **family resemblance, not an identity match** (already
noted in §3's `script_edit_history` row); no column comparison performed since nothing here indicates
they're the same table.

---

## §5. Runtime-creation cross-check

Census §3(c) records **two** runtime table-creation mechanisms that could have added a table to canon
after the 2026-08-29 capture, not only `Model.sync()`:

1. **`Model.sync()`**, seven models across four request-path sites (`franchiseBrainRoutes.js` —
   `FranchiseKnowledge`; `memories/engine.js` — `StoryTaskArc`, four call sites; `continuityEngine.js`
   — `ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat`, `ContinuityBeatCharacter`) plus
   one worker-path site (`sceneGenerationWorker.js` — `GenerationJob`).
2. **Inline `CREATE TABLE IF NOT EXISTS`**, three sites: `videoCompositionController.js:35` and
   `admin.js:53` (both `video_compositions`), `worldStudio.js:319` (`ecosystem_previews`), and
   `storyHealth.js:244,276` (`chapter_versions`, two sites, same table).

**Ten distinct tables total** across both mechanisms: `generation_jobs`, `franchise_knowledge`,
`story_task_arcs`, `continuity_timelines`, `continuity_characters`, `continuity_beats`,
`continuity_beat_characters`, `video_compositions`, `ecosystem_previews`, `chapter_versions`.

**MEASURED, re-checked this session against all 56, both mechanisms together** (`runtime_targets.txt`
holds the 10 names above, one per line; `absent56.txt` holds the 56 from §1, one per line):

```
$ comm -12 <(sort runtime_targets.txt) <(sort absent56.txt)
chapter_versions
```

**One match, not zero.** `chapter_versions` is created inline, request-path, in `src/routes/storyHealth.js`:

```
$ sed -n '236,254p' src/routes/storyHealth.js
 router.get('/versions/chapter/:chapterId', requireAuth, async (req, res) => {
    ...
    // Ensure version table exists
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS chapter_versions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        chapter_id UUID NOT NULL,
        version_number INT NOT NULL DEFAULT 1,
        content TEXT,
        word_count INT DEFAULT 0,
        snapshot_reason VARCHAR(100) DEFAULT 'manual',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const [versions] = await sequelize.query(`
      SELECT id, version_number, word_count, snapshot_reason, created_at
      FROM chapter_versions
      WHERE chapter_id = $1
      ...
```

`GET /versions/chapter/:chapterId` runs this `CREATE TABLE IF NOT EXISTS` on **every call**, before its
own `SELECT`. `chapter_versions` is already classified REAL-ROUTE above (§3) on this same evidence —
what §5 adds is the runtime-creation implication: **any single production request to this endpoint,
at any time, would have created `chapter_versions` in canon**, independent of the census's 2026-08-29
capture date. The capture's absence of `chapter_versions` only shows the endpoint hadn't been hit
against canon as of 2026-08-29 (or the table was dropped since); it does not show the table is absent
from canon *today*. **This is the one table among the 56 where the "capture may be stale" caveat has
a concrete, named mechanism, not just a general one.**

The other nine runtime-creation targets — `generation_jobs`, `franchise_knowledge`,
`story_task_arcs`, `continuity_timelines`, `continuity_characters`, `continuity_beats`,
`continuity_beat_characters`, `video_compositions`, `ecosystem_previews` — all already appear in the
2026-08-29 capture (`grep -E '^(generation_jobs|franchise_knowledge|story_task_arcs|continuity_timelines|continuity_characters|continuity_beats|continuity_beat_characters|video_compositions|ecosystem_previews) '
docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt` — all nine present, MEASURED), so this
mechanism doesn't apply to them. The capture's general staleness (now over three weeks old at this
note's own basis) still applies for any other reason canon's live schema could have changed; this
cross-check narrows two specific, named mechanisms, not staleness generally.

---

## §6. Summary — one row per table

Per the issue's own spec: `table | class | evidence | canon variant`. "Evidence" here is the shortest
pointer into §3 (file:line only — full quotes and explanation are in §3's table). "Canon variant" is
the name/none from §4.

| table | class | evidence | canon variant |
|---|---|---|---|
| `FileStorages` | REAL-ROUTE | `fileController.js:52` (via `files.js`, mounted `app.js:679`) | none |
| `ai_edit_plans` | FALSE POSITIVE | `sqsService.js:24` (comment) | none |
| `ai_interactions` | UNUSED | — | none |
| `ai_revisions` | UNUSED | — | none |
| `ai_training_data` | REAL-ROUTE | `youtube.js:237` | none |
| `audio_clips` | REAL-ROUTE | `animatic.js:175,236`; also `audioClipController.js:52` (via `audio-clips.js`, mounted `app.js:741`) | none |
| `beats` | REAL-ROUTE | `beatController.js:52` (via `beats.js`, mounted `app.js:739`); also `beatService.js:122`, `phoneContextBuilder.js:121` | none |
| `brain_documents` | REAL-ROUTE | `franchiseBrainRoutes.js:427` | none |
| `chapter_versions` | REAL-ROUTE | `storyHealth.js:257,292,299,318` (also creates it inline, §5) | none |
| `character_clips` | REAL-ROUTE | `characterClipController.js:62` (via `character-clips.js`, mounted `app.js:740`); also `beatService.js:293` | none |
| `character_profiles` | REAL-ROUTE | `editMaps.js:122` | none |
| `choice_stats` | REAL-SERVICE | `decisionAnalyticsService.js:236` | none |
| `composition_versions` | REAL-SERVICE | `VersioningService.js:33` | none |
| `cursor_actions` | REAL-ROUTE | `cursorPathController.js:65` (via `cursorPaths.js`, mounted `app.js:940`); also `cursorPathGeneratorService.js:89` | none |
| `decision_logs` | REAL-ROUTE | `decisionLogs.js:19` | `decision_log` (§4 — not a clean rename) |
| `decision_patterns` | REAL-ROUTE | `decisions.js:150` | none |
| `edit_maps` | REAL-ROUTE | `editMaps.js:26` | none |
| `editing_decisions` | UNUSED | — | none |
| `episode_phases` | UNUSED | — | none |
| `event_chain` | REAL-SERVICE | `feedEventPipelineService.js:739` | none |
| `game_wardrobe` | REAL-ROUTE | `episodeOrchestrationRoute.js:33` | none |
| `icon_cues` | REAL-ROUTE | `iconCueController.js:65` (via `iconCues.js`, mounted `app.js:939`); also `iconCueGeneratorService.js:78` | none |
| `icon_slot_mappings` | REAL-ROUTE | `iconSlotController.js:14` (via `iconSlots.js`, mounted `app.js:943`); also `cursorPathGeneratorService.js:195` | none |
| `interactive_elements` | FALSE POSITIVE | `iconCueGeneratorService.js:157-158` (JSON key) | none |
| `jobs` | REAL-ROUTE | `models/job.js:29,41` `static tableName = 'jobs'` + `${this.tableName}` SQL, via `jobController.js:38` (`jobs.js`, mounted `app.js:681`); also `ErrorRecovery.js:91` | none |
| `lala_cash_grab_quests` | UNUSED | — | none |
| `lala_episode_formulas` | UNUSED | — | none |
| `lala_episode_timeline` | UNUSED | — | none |
| `lala_formula_episodes` | REAL-SERVICE | `iconCueGeneratorService.js:110` | none |
| `lala_friend_archetypes` | UNUSED | — | none |
| `lala_micro_goals` | UNUSED | — | none |
| `layer_assets` | REAL-ROUTE | `layers.js:287` | none |
| `layer_presets` | UNUSED | — | none |
| `layers` | REAL-ROUTE | `layers.js:34` | none |
| `layout_templates` | UNUSED | — | none |
| `markers` | REAL-ROUTE | `markerController.js:55` (via `markers.js`, mounted `app.js:718`) | none |
| `music_cues` | REAL-ROUTE | `musicCueController.js:52` (via `musicCues.js`, mounted `app.js:941`); also `musicCueGeneratorService.js:376` | none |
| `processing_queues` | REAL-SERVICE | `cfoAgent.js:384,542` | `processing_queue` (§4 — same table, tableName already matches; column-shape delta, not a naming question) |
| `production_packages` | REAL-ROUTE | `productionPackageController.js:58` (via `productionPackage.js`, mounted `app.js:942`); also `productionPackageService.js:447` | none |
| `raw_footage` | FALSE POSITIVE | `editMaps.js:28` (column name) | none |
| `scene_footage_links` | REAL-ROUTE | `sceneLinks.js:16` | none |
| `scene_layer_configuration` | UNUSED | — | none |
| `script_edit_history` | UNUSED | — | `script_edits` (§4 — family resemblance only, not an identity match; no column comparison performed) |
| `script_learning_profiles` | UNUSED | — | none |
| `script_metadata` | REAL-ROUTE | `sceneLinks.js:103` | none |
| `script_suggestions` | UNUSED | — | none |
| `script_templates` | REAL-ROUTE | `scriptGenerator.js:70` | none |
| `search_filter_presets` | REAL-SERVICE | `FilterService.js:301` | none |
| `show_configs` | REAL-ROUTE | `scriptGenerator.js:14` | none |
| `timeline_events` | REAL-ROUTE | `storyHealth.js:207,553` | none |
| `upload_logs` | UNUSED | — | none |
| `user_decisions` | REAL-ROUTE | `decisions.js:37` | none |
| `users` | REAL-ROUTE | `searchController.js:489` (via `search.js`, mounted `app.js:680`) | none |
| `video_processing_jobs` | FALSE POSITIVE | `sqsService.js:22` (comment) | none |
| `video_scenes` | REAL-ROUTE | `youtube.js:152` | none |
| `world_tensions` | REAL-ROUTE | `storyHealth.js:379,536` | none |

**Counts per class:** REAL-ROUTE 30, REAL-SERVICE 6, FALSE POSITIVE 4, UNUSED 16. **30 + 6 + 4 + 16
= 56.** REAL total (route + service) = 36 — up from the 33 this note's own prior pass reported, before
controllers were in scope. 11 tables moved to REAL-ROUTE this pass: `FileStorages` (was UNUSED),
`markers` and `users` (were FALSE POSITIVE), and `beats`, `character_clips`, `cursor_actions`,
`icon_cues`, `icon_slot_mappings`, `jobs`, `music_cues`, `production_packages` (were REAL-SERVICE —
each had a controller-level access path the routes/services/workers-only sweep couldn't see).
`audio_clips` gained a second, independent controller-level path with no class change (it was already
REAL-ROUTE via a direct route-level call). This is close to, but not identical to, the census's own
"25 route-referenced (ceiling, not firm)" figure — that figure predates controllers being considered
at all, so no clean reconciliation between the two is attempted here. Only 2 of the 56 have any canon
variant at all (§4); one of those two (`processing_queues`) is not a naming question, leaving exactly
1 (`decision_logs`) as a genuine naming ambiguity for the ruling, plus 1 soft family-resemblance case
(`script_edit_history`) noted for completeness.

---

## §7. What this note does not do

- **Does not choose a schema, propose a migration, or rule which direction (1/2/3) applies.**
  Evoni's schema-fork ruling has not been filed anywhere; this note is prep for it, supplying its
  input, not its conclusion.
- **Does not resolve the `decision_logs`/`decision_log` naming ambiguity** — handed to the ruling
  as-is, with column evidence attached, per §4. `processing_queues`/`processing_queue` is not a
  naming ambiguity (§4) — the model's own table name already matches canon's.
- **Does not claim canon matches the capture today.** Every canon-side claim is AS-RECORDED from the
  2026-08-29 capture, now over three weeks old at this basis; §5 found one table (`chapter_versions`)
  where the capture's absence doesn't mean canon lacks it today, and rules out the same runtime-creation
  mechanism (`Model.sync()`/inline `CREATE TABLE`) for the other 55, but does not otherwise re-verify
  canon live.
- **Does not touch `src/`, `tests/`, `PROJECT_CONTEXT.md`, or any existing `docs/audit/` file.** This
  file is the only change.
- **Scope now includes `src/controllers/` and `src/middleware/`, corrected this pass (§2).** The
  first two passes searched only `src/routes/`, `src/services/`, `src/workers/`, which wrongly scored
  11 tables as FALSE POSITIVE or REAL-SERVICE when their real access lived in a controller a mounted
  route delegates to. `src/middleware/` was checked and is clean (zero hits for any of the 56).
  `src/queues/` and `src/sockets/` were spot-checked informationally, also zero hits, but are not
  claimed as swept with the same rigor as the four directories that are in scope — a future pass
  should sweep them properly before treating their absence of hits as conclusive.
- **Mints no FD, XK, or PE number.** Tails re-derived fresh at this basis:

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from the census's own tail check (FD-66/FD-69, XK-2, PE #68) — nothing minted since.

---

**Type:** MEASURED classification note, prep material for the v25 item 8 disposition / Evoni's
forthcoming schema-fork ruling. **Rules:** nothing. **Mints:** nothing (see §7). **Host/AWS/DB
contact:** none — repo-only, against the existing 2026-08-29 capture file. **Prod FROZEN.**
