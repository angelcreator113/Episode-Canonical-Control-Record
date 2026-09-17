| **PRIME STUDIOS** **CANON TABLE-EXPECTATION CENSUS** *A new MEASURED census, table by table, of what `origin/main`'s code expects to exist against the 2026-08-29 canon capture. Rules nothing, recommends no canonical schema, mints nothing.* |
| --- |

# Canon Table-Expectation Census

**Date:** 2026-09-17
**Basis:** `origin/main` at `4b173440d34b7bfbce40f2d637caa8e6ec53bd72`
**Type:** Standalone census. Ships no code. Changes no gate, finding, severity, owner, or disposition. Rules nothing, mints nothing.
**Author:** Claude, on Task #1498, for Evoni / Prime Studios.
**Standing labels used throughout:** **MEASURED** (a repository read anyone can reproduce from this basis — command and output pasted), **AS-RECORDED** (a claim about the 2026-08-29 capture's contents, at its own date, not re-verified live), **CITED** (carried from another register document without re-derivation, per issue instruction).

---

# §1. What this census answers

Prep material for Evoni's own schema-fork ruling (the F-Deploy-1 prod-reconciliation session), per Task #1498. It builds the set of tables `origin/main`'s code currently expects, across four independent static sources, and checks each one against the one filed live read of canon's schema. It takes no position on which schema is canonical.

---

# §2. Locating the 2026-08-29 canon capture

**Located.** Two files, both under `docs/audit/`:

```
docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt
docs/audit/EvidenceNote_Canon_pgmigrations_2026-08-29.txt
```

**MEASURED, this session:**

```
$ ls -la docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt docs/audit/EvidenceNote_Canon_pgmigrations_2026-08-29.txt
-rw-r--r-- 1 root root 292067 Sep 15 15:03 docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt
-rw-r--r-- 1 root root   1293 Sep 15 15:03 docs/audit/EvidenceNote_Canon_pgmigrations_2026-08-29.txt
```

**How the register describes the capture — quoted, not paraphrased**, from `v25_Owed_Index_Amd18_2026-08-30.md` (the amendment that recorded the read):

> **The read has since occurred**, over the one established non-host route the route finding itself identified at §R1.1 — **the operator's workstation**, with the operator running the query. **No agent session touched the instance. No host action, no AWS call, no VPN, no bastion, no SSH tunnel, no SSM port forwarding, no endpoint probe.**
>
> **Evidence, two files:**
> ```
> docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt    2764 lines / 2760 rows
> docs/audit/EvidenceNote_Canon_pgmigrations_2026-08-29.txt        18 lines /   14 rows
> ```
>
> **Both sat on `docs/canon-schema-capture-2026-08-29` at `cb693277501182ddf99c252debe65934fe8f4d69`** — `main` plus exactly those two files, +2782 lines, nothing else touched. **Evoni ruled on 2026-08-30 that this branch merges to `main`.**

And on standing (same document, §T2):

> The capture is **2760 rows across 143 tables**, `public` schema only. (The "2764" figure that has circulated is the file's **line** count, not its row count — the difference is the header, rule, and `(2760 rows)` trailer.)

`Prime_Studios_Audit_Handoff_v26.md` §8 and Amendment 29 both carry this same read as **PERFORMED 2026-08-29**, not superseded, and note item 8's read was over the operator-workstation route, not any agent session.

**Whether it records columns or only tables — MEASURED, this session, reading the capture file's own header:**

```
$ head -3 docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt
            table_name            |            column_name            |          data_type          | is_nullable
----------------------------------+-----------------------------------+-----------------------------+-------------
 SequelizeMeta                    | name                              | character varying           | NO
```

**It records columns.** Each row is `table_name | column_name | data_type | is_nullable` — the capture is a per-column enumeration across 143 tables, not a table-name-only list. (`SequelizeMeta`'s row count in the companion file is 14, matching Amendment 18's figure; row content beyond table/column names is not reproduced here, per this issue's instruction not to quote capture row data.)

The companion file (`EvidenceNote_Canon_pgmigrations_2026-08-29.txt`) records the `pgmigrations` ledger's `id | name | run_on` columns, 14 rows — schema shape only, consistent with Amendment 18's "18 lines / 14 rows."

---

# §3. Building the expected-table set — methodology, commands, and output

Static reading only. No database connection, no `src/models/index.js` require, no `src/config/` read. Four independent columns, per the issue's instruction.

## §3(a). `tableName` in each `src/models/*.js` model registered in `src/models/index.js`

**MEASURED.** `src/models/index.js` registers models via `VarName = require('./ModelFile')(sequelize[, DataTypes])` call sites inside one top-level `try` block (verified: all such call sites sit inside the same unconditional `try { ... }` starting after line 156 — no `if` gating any of them, other than one inner `try/catch` noted below).

```
$ grep -cE "^\s*[A-Za-z_]+ = require\('\./" src/models/index.js
150
$ grep -nE "^\s*[A-Za-z_]+ = require\('\./" src/models/index.js | sed -E "s/^([0-9]+):\s*([A-Za-z_]+) = require\('\.\/([A-Za-z_0-9]+)'\).*/\3/" | sort -u | wc -l
150
```

**150 distinct require call sites, no duplicates.** For each, the target file's `tableName:` was read directly:

```
$ while read -r f; do
    file="src/models/${f}.js"
    [ -f "$file" ] || { echo "$f|MISSING_FILE|"; continue; }
    tn=$(grep -oE "tableName:\s*['\"][A-Za-z0-9_]+['\"]" "$file" | head -1 | sed -E "s/tableName:\s*['\"]([A-Za-z0-9_]+)['\"]/\1/")
    echo "$f|$file|${tn:-(none)}"
  done < <(list of 150 names) | grep MISSING_FILE
RawFootage|MISSING_FILE|
```

**One require target, `RawFootage`, has no corresponding file on this checkout.** `src/models/index.js:252-269` wraps it in its own `try/catch`:

```js
let _RawFootage;
try {
  _RawFootage = require('./RawFootage')(sequelize);
} catch (e) {
  console.log('⚠️  RawFootage model not found, creating minimal stub');
  _RawFootage = sequelize.define('RawFootage', {
    ...
  }, { tableName: 'raw_footage', timestamps: false });
}
```

`raw_footage` is therefore included in column (a) with a caveat noted at its row: it comes from a runtime-defined stub inside `index.js`, not a static `tableName:` in a model file.

**Reconciliation with `PROJECT_CONTEXT.md` §4.5's "index.js registers 149" figure — MEASURED, not a contradiction:**

```
$ ls src/models/*.js | wc -l
154
$ grep -n "SocialProfileTemplate\|UiOverlayType" src/models/index.js
(no output)
$ ls src/models/SocialProfileTemplate.js src/models/UiOverlayType.js
src/models/SocialProfileTemplate.js
src/models/UiOverlayType.js
```

154 files under `src/models/` total; `SocialProfileTemplate.js` and `UiOverlayType.js` exist on disk but are never required by `index.js` at all (zero occurrences of either name). Of the 150 require call sites, 149 resolve to a real file and one (`RawFootage`) does not. **149 file-backed requires is exactly `PROJECT_CONTEXT.md`'s figure** — read here as "149 real model files successfully required," with `RawFootage`'s runtime stub as the 150th registration, not as a discrepancy.

**Result: 150 distinct table names, column (a).** Full list (alphabetical): `FileStorages`, `activity_logs`, `ai_edit_plans`, `ai_revisions`, `ai_training_data`, `ai_usage_logs`, `amber_findings`, `amber_scan_runs`, `amber_task_queue`, `asset_labels`, `asset_roles`, `asset_usage_log`, `assets`, `audio_clips`, `author_notes`, `beats`, `book_series`, `brain_documents`, `brain_fingerprints`, `bulk_import_jobs`, `calendar_event_attendees`, `calendar_event_ripples`, `career_goals`, `character_arcs`, `character_clips`, `character_crossings`, `character_entanglements`, `character_follow_profiles`, `character_growth_log`, `character_profiles`, `character_registries`, `character_relationships`, `character_sparks`, `character_state`, `character_therapy_profiles`, `characters`, `composition_assets`, `composition_outputs`, `continuity_beat_characters`, `continuity_beats`, `continuity_characters`, `continuity_timelines`, `decision_logs`, `decision_patterns`, `edit_maps`, `editing_decisions`, `entanglement_events`, `entanglement_unfollows`, `episode_assets`, `episode_briefs`, `episode_scenes`, `episode_scripts`, `episode_templates`, `episode_wardrobe`, `episode_wardrobe_defaults`, `episodes`, `feed_moments`, `feed_posts`, `feed_profile_relationships`, `franchise_knowledge`, `franchise_tech_knowledge`, `generation_jobs`, `hair_library`, `lala_emergence_scenes`, `lalaverse_brands`, `layer_assets`, `layer_presets`, `layers`, `makeup_library`, `manuscript_metadata`, `markers`, `metadata_storage`, `multi_product_content`, `novel_assemblies`, `opportunities`, `outfit_set_items`, `outfit_sets`, `page_content`, `phone_missions`, `phone_playthrough_state`, `pipeline_tracking`, `post_generation_reviews`, `press_careers`, `processing_queue`, `raw_footage`, `registry_characters`, `relationship_events`, `scene_angles`, `scene_assets`, `scene_footage_links`, `scene_layer_configuration`, `scene_library`, `scene_object_variants`, `scene_plans`, `scene_proposals`, `scene_set_episodes`, `scene_sets`, `scene_templates`, `scenes`, `script_edit_history`, `script_learning_profiles`, `script_metadata`, `script_suggestions`, `script_templates`, `session_briefs`, `show_arcs`, `show_assets`, `show_configs`, `shows`, `social_media_imports`, `social_profile_followers`, `social_profile_relationships`, `social_profiles`, `story_calendar_events`, `story_clock_markers`, `story_revisions`, `story_task_arcs`, `story_texture`, `story_threads`, `storyteller_books`, `storyteller_chapters`, `storyteller_echoes`, `storyteller_lines`, `storyteller_memories`, `storyteller_stories`, `therapy_pending_sessions`, `thumbnail_compositions`, `thumbnail_templates`, `thumbnails`, `timeline_data`, `timeline_placements`, `universe_characters`, `universes`, `user_decisions`, `video_processing_jobs`, `voice_rules`, `voice_signals`, `wardrobe`, `wardrobe_brand_tags`, `wardrobe_content_assignments`, `wardrobe_library`, `wardrobe_library_references`, `wardrobe_usage_history`, `world_characters`, `world_events`, `world_locations`, `world_state_snapshots`, `world_timeline_events`, `writing_goals`, `writing_rhythm`.

**Notable irregular entry:** `FileStorage.js` declares `tableName: 'FileStorages'` — the only mixed-case, unpluralized-by-convention table name in column (a); every other entry is lower-snake-case. No migration creates it (§3(b)).

## §3(b). Tables created by `src/migrations/` (the only tree `.sequelizerc` runs)

**MEASURED.**

```
$ ls src/migrations/*.js | wc -l
213
```

(`PROJECT_CONTEXT.md` §4.5 states 211 at its own, earlier basis `433b1f22` — this is a live re-count at the current basis, two files ahead; not treated as a discrepancy, only as drift over time.)

```
$ grep -lE "createTable\(" src/migrations/*.js | wc -l
87
$ grep -hoE "createTable\(" src/migrations/*.js | wc -l
138
```

A single-line quoted-name pattern missed one call site whose table name sits on the following line:

```
$ grep -lE "createTable\(" src/migrations/*.js | while read -r f; do
    n1=$(grep -oE "createTable\(" "$f" | wc -l)
    n2=$(grep -oE "createTable\(\s*['\"][A-Za-z0-9_]+['\"]" "$f" | wc -l)
    [ "$n1" != "$n2" ] && echo "$f: total=$n1 matched=$n2"
  done
src/migrations/20260109132556-create-shows.js: total=1 matched=0
$ cat -A src/migrations/20260109132556-create-shows.js | sed -n '1,6p'
module.exports = {$
  async up(queryInterface, Sequelize) {$
    await queryInterface.createTable($
      'shows',$
      {$
```

Re-extracted allowing the call and its quoted name to span lines:

```
$ perl -0777 -ne 'while (/createTable\(\s*[\x27"]([A-Za-z0-9_]+)[\x27"]/gs) { print "$1\n"; }' src/migrations/*.js | sort -u | wc -l
132
```

**Reversibility check, so `createTable` isn't mistaken for the current net state:**

```
$ grep -lE "dropTable\(|renameTable\(" src/migrations/*.js | wc -l
86
$ perl -0777 -ne 'while (/renameTable\(\s*[\x27"]([A-Za-z0-9_]+)[\x27"]\s*,\s*[\x27"]([A-Za-z0-9_]+)[\x27"]/gs) { print "$1 -> $2\n"; }' src/migrations/*.js | sort -u
(no output — zero renameTable calls found)
```

The `dropTable` name set (checked, not shown in full — it is the same 86 tables as the reversible migrations' own `up()` targets) is each migration's own `down()` undoing its own `up()`, not a later migration dropping an earlier one's table. **No net drops or renames found; `createTable` calls are additive across the tree, as CLAUDE.md's "migrations only add" convention implies.**

**Result: 132 distinct table names, column (b).** Full list (alphabetical): `activity_logs`, `ai_interactions`, `ai_usage_logs`, `amber_findings`, `amber_scan_runs`, `amber_task_queue`, `asset_roles`, `asset_usage_log`, `assets`, `author_notes`, `book_series`, `brain_fingerprints`, `bulk_import_jobs`, `calendar_event_attendees`, `calendar_event_ripples`, `career_goals`, `character_arcs`, `character_crossings`, `character_entanglements`, `character_follow_profiles`, `character_growth_log`, `character_profiles`, `character_registries`, `character_relationships`, `character_sparks`, `character_state`, `character_state_history`, `character_therapy_profiles`, `characters`, `decision_log`, `decision_logs`, `decision_patterns`, `edit_maps`, `entanglement_events`, `entanglement_unfollows`, `episode_briefs`, `episode_phases`, `episode_scenes`, `episode_scripts`, `episode_templates`, `episode_todo_lists`, `episode_wardrobe_defaults`, `episodes`, `feed_moments`, `feed_posts`, `feed_profile_relationships`, `financial_transactions`, `franchise_knowledge`, `franchise_tech_knowledge`, `generation_jobs`, `hair_library`, `interactive_elements`, `intimate_scenes`, `lala_cash_grab_quests`, `lala_emergence_scenes`, `lala_episode_formulas`, `lala_episode_timeline`, `lala_friend_archetypes`, `lala_micro_goals`, `lalaverse_brands`, `layout_templates`, `makeup_library`, `manuscript_metadata`, `metadata_storage`, `multi_product_content`, `novel_assemblies`, `opportunities`, `page_content`, `phone_missions`, `phone_playthrough_state`, `pipeline_tracking`, `post_generation_reviews`, `press_careers`, `processing_queues`, `raw_footage`, `registry_characters`, `relationship_events`, `scene_angles`, `scene_assets`, `scene_continuations`, `scene_footage_links`, `scene_library`, `scene_object_variants`, `scene_plans`, `scene_proposals`, `scene_set_episodes`, `scene_sets`, `scenes`, `script_metadata`, `session_briefs`, `show_arcs`, `shows`, `social_media_imports`, `social_profile_followers`, `social_profile_relationships`, `social_profile_templates`, `social_profiles`, `stories`, `story_calendar_events`, `story_clock_markers`, `story_revisions`, `story_task_arcs`, `story_texture`, `story_threads`, `storyteller_books`, `storyteller_chapters`, `storyteller_echoes`, `storyteller_lines`, `storyteller_memories`, `storyteller_stories`, `therapy_pending_sessions`, `thumbnail_compositions`, `thumbnails`, `timeline_data`, `ui_overlay_types`, `universe_characters`, `universes`, `upload_logs`, `user_decisions`, `users`, `voice_rules`, `voice_signals`, `wardrobe_brand_tags`, `wardrobe_content_assignments`, `world_character_batches`, `world_characters`, `world_events`, `world_locations`, `world_state_snapshots`, `world_timeline_events`, `writing_goals`, `writing_rhythm`.

**Two model/migration name-form mismatches, corroborating an already-carried register finding (§6):**
- `processing_queue` (model, singular) vs `processing_queues` (migration, plural) — same conceptual table, two spellings.
- `decision_logs` (model, plural) vs `decision_log` **and** `decision_logs` (migration creates both spellings) — matches the collision Amendment 18 already describes (§6 below).

## §3(c). Request-path `Model.sync()` calls and inline `CREATE TABLE IF NOT EXISTS` sites

**MEASURED**, searched across all of `src/` (not scope-limited to routes/services, since the issue's instruction for this column carries no such limit):

```
$ grep -rnE "\.sync\(" src/ --include="*.js" | grep -v src/migrations
src/app.js:87:          await db.sequelize.sync(syncOptions);
src/models/index.js:1801:      await sequelize.sync({ ...defaultOptions, ...options });
src/workers/sceneGenerationWorker.js:235:    await GenerationJob.sync();
src/routes/franchiseBrainRoutes.js:66:        await db.FranchiseKnowledge.sync();
src/routes/memories/engine.js:2434:    await db.StoryTaskArc.sync();
src/routes/memories/engine.js:3183:      await db.StoryTaskArc.sync();
src/routes/memories/engine.js:3470:      await db.StoryTaskArc.sync();
src/routes/memories/engine.js:3662:      await db.StoryTaskArc.sync();
src/routes/sceneSetRoutes.js:52:      GenerationJob.sync(),
src/routes/continuityEngine.js:40:      await m.ContinuityTimeline.sync();
src/routes/continuityEngine.js:41:      await m.ContinuityCharacter.sync();
src/routes/continuityEngine.js:42:      await m.ContinuityBeat.sync();
src/routes/continuityEngine.js:43:      if (m.ContinuityBeatCharacter) await m.ContinuityBeatCharacter.sync();
```

**Two are whole-database, startup-path calls, not request-path — disclosed and excluded from the table-specific list.** `src/app.js:87` sits inside a top-level `(async () => { ... })()` IIFE run once at module load, gated behind `process.env.ENABLE_DB_SYNC === 'true'` (default: skipped, per the surrounding `else` branch logging "Skipping model sync"). `src/models/index.js:1801` is the `sync:` method it calls. Neither runs per HTTP request; if triggered, either would sync **all** column-(a) models transitively — recorded as a fact, not counted as a distinct table.

**The remaining eight are model-specific, and each was checked for its calling context:**

```
$ awk -v target=66 'NR<=target && /router\.(get|post|put|delete|patch)\(/{last=NR": "$0} END{print last}' src/routes/franchiseBrainRoutes.js
54: router.post('/franchise-brain/seed', requireAuth, async (req, res) => {
```
→ `db.FranchiseKnowledge.sync()` runs inside an HTTP request handler.

```
$ sed -n '1420,1440p' src/routes/memories/engine.js | grep -n "router\."
1:router.get('/story-engine-tasks/:characterKey', requireAuth, async (req, res) => {
```
→ confirmed request-path for the first `StoryTaskArc.sync()` call site; the other three follow the same file's route-handler pattern.

```
$ sed -n '40,60p' src/routes/sceneSetRoutes.js
// Ensure generation_jobs table exists (safe to call multiple times)
let generationJobsSynced = false;
async function ensureGenerationJobsTable() {
  if (generationJobsSynced || !GenerationJob) return;
  ...
}
$ grep -n "ensureGenerationJobsTable(" src/routes/sceneSetRoutes.js
47:async function ensureGenerationJobsTable() {
982:    await ensureGenerationJobsTable();
1459:    await ensureGenerationJobsTable();
1480:    await ensureGenerationJobsTable();
1504:    await ensureGenerationJobsTable();
```
→ memoized per-process helper, invoked from four call sites inside route handlers.

```
$ sed -n '50,62p' src/routes/continuityEngine.js
router.get('/timelines', requireAuth, async (req, res) => {
  try {
    await ensureTables();
```
→ `ensureTables()` (which performs the four `ContinuityEngine` sync calls) is invoked from inside `router.get('/timelines', ...)`, confirmed request-path.

`src/workers/sceneGenerationWorker.js:235`'s `GenerationJob.sync()` sits in a background-job worker, not an HTTP route — recorded separately as **worker-path**, not request-path, for precision.

**Model-to-table mapping, each `tableName:` read directly:**

```
$ grep -n "tableName" src/models/GenerationJob.js src/models/FranchiseKnowledge.js src/models/StoryTaskArc.js src/models/ContinuityTimeline.js src/models/ContinuityCharacter.js src/models/ContinuityBeat.js src/models/ContinuityBeatCharacter.js
GenerationJob.js:      tableName: 'generation_jobs',
FranchiseKnowledge.js:      tableName:   'franchise_knowledge',
StoryTaskArc.js:      tableName: 'story_task_arcs',
ContinuityTimeline.js:      tableName: 'continuity_timelines',
ContinuityCharacter.js:      tableName: 'continuity_characters',
ContinuityBeat.js:      tableName: 'continuity_beats',
ContinuityBeatCharacter.js:      tableName: 'continuity_beat_characters',
```

**Inline `CREATE TABLE IF NOT EXISTS`, searched across all of `src/`:**

```
$ grep -rniE "CREATE TABLE IF NOT EXISTS" src/ --include="*.js" | grep -v src/migrations
src/controllers/videoCompositionController.js:35:        CREATE TABLE IF NOT EXISTS video_compositions (
src/routes/worldStudio.js:319:    CREATE TABLE IF NOT EXISTS ecosystem_previews (
src/routes/storyHealth.js:244:      CREATE TABLE IF NOT EXISTS chapter_versions (
src/routes/storyHealth.js:276:      CREATE TABLE IF NOT EXISTS chapter_versions (
src/routes/admin.js:53:      CREATE TABLE IF NOT EXISTS video_compositions (
```

**Result: 10 distinct tables, column (c):** `generation_jobs`, `franchise_knowledge`, `story_task_arcs`, `continuity_timelines`, `continuity_characters`, `continuity_beats`, `continuity_beat_characters`, `video_compositions`, `ecosystem_previews`, `chapter_versions`.

## §3(d). Raw SQL table references in `src/routes/` and `src/services/`

**MEASURED**, scope exactly as instructed — `src/routes/` and `src/services/` only, not `src/controllers/` (relevant caveat noted below).

First pass, naive keyword grep, was too noisy (matched English prose — "from the", "and", "first" — not SQL):

```
$ perl -ne 'while (/\b(?:FROM|INTO|UPDATE|JOIN)\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi) { print "$1\n"; }' $(find src/routes src/services -name "*.js") | sort | uniq -c | sort -rn | wc -l
551
```

Restricted to the codebase's own convention of upper-case SQL keywords immediately followed by a lower-case snake_case identifier — a precision pass, not a broadening:

```
$ perl -ne 'while (/\b(?:FROM|INTO|UPDATE|JOIN)\s+"?([a-z_][a-z0-9_]*)"?/g) { print "$1\n"; }' $(find src/routes src/services -name "*.js") | sort | uniq -c | sort -rn | wc -l
87
```

Four entries removed as confirmed non-table noise, spot-checked:

```
$ grep -rnE "\b(FROM|INTO|UPDATE|JOIN)\s+\"?(created_at|first|and)\"?" src/routes src/services
src/services/decisionAnalyticsService.js:197:        EXTRACT(HOUR FROM created_at) as hour_of_day,
```
(`FROM` inside `EXTRACT(HOUR FROM created_at)` — a date-part extraction, not a table reference. The other two, `first`/`and`, were matches inside code comments, not query strings.)

Three entries removed as Postgres system catalogs/schemas, not application tables:

```
$ for t in pg_stat_user_tables pg_stat_activity pg_stat_user_indexes information_schema; do grep -rlE "\b(FROM|INTO|UPDATE|JOIN)\s+\"?$t\"?" src/routes src/services; done
src/services/cfoAgent.js       (pg_stat_user_tables, pg_stat_activity, pg_stat_user_indexes)
src/routes/scenes.js, src/routes/worldStudio.js   (information_schema)
```

Remaining entries spot-checked across the frequency range (high/medium/low counts) to confirm genuine table references, e.g.:

```
$ grep -rnE "\b(FROM|INTO|UPDATE|JOIN)\s+\"?jobs\"?" src/routes src/services
src/services/ErrorRecovery.js:91:        FROM jobs
src/services/ErrorRecovery.js:178:        UPDATE jobs
$ grep -rnE "\b(FROM|INTO|UPDATE|JOIN)\s+\"?event_chain\"?" src/routes src/services
src/services/feedEventPipelineService.js:742:     SELECT * FROM event_chain ORDER BY chain_position ASC, created_at ASC,
$ grep -rnE "\b(FROM|INTO|UPDATE|JOIN)\s+\"?beats\"?" src/routes src/services
src/services/phoneContextBuilder.js:121:       FROM beats b
```

**Result: 80 distinct table names, column (d).** Full list (alphabetical): `activity_logs`, `ai_usage_logs`, `assets`, `beats`, `career_goals`, `character_follow_profiles`, `character_registries`, `character_relationships`, `character_relationships_extended`, `character_state`, `character_state_history`, `character_therapy_profiles`, `characters`, `chapter_versions`, `choice_stats`, `composition_versions`, `continuity_beats`, `continuity_timelines`, `cursor_actions`, `decision_log`, `ecosystem_previews`, `episode_assets`, `episode_briefs`, `episode_scripts`, `episode_todo_lists`, `episode_wardrobe`, `episodes`, `event_chain`, `feed_posts`, `feed_profile_relationships`, `financial_transactions`, `franchise_knowledge`, `game_wardrobe`, `icon_cues`, `icon_slot_mappings`, `intimate_scenes`, `jobs`, `lala_formula_episodes`, `music_cues`, `opportunities`, `page_content`, `phone_missions`, `processing_queues`, `production_packages`, `registry_characters`, `relationship_events`, `scene_angles`, `scene_continuations`, `scene_plans`, `scene_set_episodes`, `scene_sets`, `scenes`, `script_edits`, `search_filter_presets`, `shows`, `show_arcs`, `social_profile_followers`, `social_profiles`, `stories`, `storyteller_books`, `storyteller_chapters`, `storyteller_lines`, `storyteller_memories`, `storyteller_stories`, `story_threads`, `template_studio`, `timeline_data`, `timeline_events`, `ui_overlay_types`, `user_decisions`, `video_scenes`, `wardrobe`, `wardrobe_library`, `world_character_batches`, `world_characters`, `world_events`, `world_locations`, `world_state_snapshots`, `world_tensions`.

**Scope caveat, disclosed rather than smoothed over.** `video_compositions` (column c) is read and written via raw SQL (`SELECT`/`INSERT`/`UPDATE`/`DELETE FROM video_compositions`) in `src/controllers/videoCompositionController.js` — but that file is in `src/controllers/`, outside this column's `src/routes/`+`src/services/` scope as the issue specified it. It therefore shows `d = no` in §4's table despite having genuine raw-SQL usage elsewhere in the tree. This is a scoping artifact of the instruction, not a claim that the table is unused.

---

# §4. The table

**193 distinct expected table names** (union of columns a–d). For each: whether it appears in each source, and whether it appears in the canon capture (schema/table name only, per §2 — no row data quoted).

| table name | a | b | c | d | in canon capture |
|---|---|---|---|---|---|
| `FileStorages` | yes | no | no | no | no |
| `activity_logs` | yes | yes | no | yes | yes |
| `ai_edit_plans` | yes | no | no | no | no |
| `ai_interactions` | no | yes | no | no | no |
| `ai_revisions` | yes | no | no | no | no |
| `ai_training_data` | yes | no | no | no | no |
| `ai_usage_logs` | yes | yes | no | yes | yes |
| `amber_findings` | yes | yes | no | no | yes |
| `amber_scan_runs` | yes | yes | no | no | yes |
| `amber_task_queue` | yes | yes | no | no | yes |
| `asset_labels` | yes | no | no | no | yes |
| `asset_roles` | yes | yes | no | no | yes |
| `asset_usage_log` | yes | yes | no | no | yes |
| `assets` | yes | yes | no | yes | yes |
| `audio_clips` | yes | no | no | no | no |
| `author_notes` | yes | yes | no | no | yes |
| `beats` | yes | no | no | yes | no |
| `book_series` | yes | yes | no | no | yes |
| `brain_documents` | yes | no | no | no | no |
| `brain_fingerprints` | yes | yes | no | no | yes |
| `bulk_import_jobs` | yes | yes | no | no | yes |
| `calendar_event_attendees` | yes | yes | no | no | yes |
| `calendar_event_ripples` | yes | yes | no | no | yes |
| `career_goals` | yes | yes | no | yes | yes |
| `chapter_versions` | no | no | yes | yes | no |
| `character_arcs` | yes | yes | no | no | yes |
| `character_clips` | yes | no | no | no | no |
| `character_crossings` | yes | yes | no | no | yes |
| `character_entanglements` | yes | yes | no | no | yes |
| `character_follow_profiles` | yes | yes | no | yes | yes |
| `character_growth_log` | yes | yes | no | no | yes |
| `character_profiles` | yes | yes | no | no | no |
| `character_registries` | yes | yes | no | yes | yes |
| `character_relationships` | yes | yes | no | yes | yes |
| `character_relationships_extended` | no | no | no | yes | yes |
| `character_sparks` | yes | yes | no | no | yes |
| `character_state` | yes | yes | no | yes | yes |
| `character_state_history` | no | yes | no | yes | yes |
| `character_therapy_profiles` | yes | yes | no | yes | yes |
| `characters` | yes | yes | no | yes | yes |
| `choice_stats` | no | no | no | yes | no |
| `composition_assets` | yes | no | no | no | yes |
| `composition_outputs` | yes | no | no | no | yes |
| `composition_versions` | no | no | no | yes | no |
| `continuity_beat_characters` | yes | no | yes | no | yes |
| `continuity_beats` | yes | no | yes | yes | yes |
| `continuity_characters` | yes | no | yes | no | yes |
| `continuity_timelines` | yes | no | yes | yes | yes |
| `cursor_actions` | no | no | no | yes | no |
| `decision_log` | no | yes | no | yes | yes |
| `decision_logs` | yes | yes | no | no | no |
| `decision_patterns` | yes | yes | no | no | no |
| `ecosystem_previews` | no | no | yes | yes | yes |
| `edit_maps` | yes | yes | no | no | no |
| `editing_decisions` | yes | no | no | no | no |
| `entanglement_events` | yes | yes | no | no | yes |
| `entanglement_unfollows` | yes | yes | no | no | yes |
| `episode_assets` | yes | no | no | yes | yes |
| `episode_briefs` | yes | yes | no | yes | yes |
| `episode_phases` | no | yes | no | no | no |
| `episode_scenes` | yes | yes | no | no | yes |
| `episode_scripts` | yes | yes | no | yes | yes |
| `episode_templates` | yes | yes | no | no | yes |
| `episode_todo_lists` | no | yes | no | yes | yes |
| `episode_wardrobe` | yes | no | no | yes | yes |
| `episode_wardrobe_defaults` | yes | yes | no | no | yes |
| `episodes` | yes | yes | no | yes | yes |
| `event_chain` | no | no | no | yes | no |
| `feed_moments` | yes | yes | no | no | yes |
| `feed_posts` | yes | yes | no | yes | yes |
| `feed_profile_relationships` | yes | yes | no | yes | yes |
| `financial_transactions` | no | yes | no | yes | yes |
| `franchise_knowledge` | yes | yes | yes | yes | yes |
| `franchise_tech_knowledge` | yes | yes | no | no | yes |
| `game_wardrobe` | no | no | no | yes | no |
| `generation_jobs` | yes | yes | yes | no | yes |
| `hair_library` | yes | yes | no | no | yes |
| `icon_cues` | no | no | no | yes | no |
| `icon_slot_mappings` | no | no | no | yes | no |
| `interactive_elements` | no | yes | no | no | no |
| `intimate_scenes` | no | yes | no | yes | yes |
| `jobs` | no | no | no | yes | no |
| `lala_cash_grab_quests` | no | yes | no | no | no |
| `lala_emergence_scenes` | yes | yes | no | no | yes |
| `lala_episode_formulas` | no | yes | no | no | no |
| `lala_episode_timeline` | no | yes | no | no | no |
| `lala_formula_episodes` | no | no | no | yes | no |
| `lala_friend_archetypes` | no | yes | no | no | no |
| `lala_micro_goals` | no | yes | no | no | no |
| `lalaverse_brands` | yes | yes | no | no | yes |
| `layer_assets` | yes | no | no | no | no |
| `layer_presets` | yes | no | no | no | no |
| `layers` | yes | no | no | no | no |
| `layout_templates` | no | yes | no | no | no |
| `makeup_library` | yes | yes | no | no | yes |
| `manuscript_metadata` | yes | yes | no | no | yes |
| `markers` | yes | no | no | no | no |
| `metadata_storage` | yes | yes | no | no | yes |
| `multi_product_content` | yes | yes | no | no | yes |
| `music_cues` | no | no | no | yes | no |
| `novel_assemblies` | yes | yes | no | no | yes |
| `opportunities` | yes | yes | no | yes | yes |
| `outfit_set_items` | yes | no | no | no | yes |
| `outfit_sets` | yes | no | no | no | yes |
| `page_content` | yes | yes | no | yes | yes |
| `phone_missions` | yes | yes | no | yes | yes |
| `phone_playthrough_state` | yes | yes | no | no | yes |
| `pipeline_tracking` | yes | yes | no | no | yes |
| `post_generation_reviews` | yes | yes | no | no | yes |
| `press_careers` | yes | yes | no | no | yes |
| `processing_queue` | yes | no | no | no | yes |
| `processing_queues` | no | yes | no | yes | no |
| `production_packages` | no | no | no | yes | no |
| `raw_footage` | yes | yes | no | no | no |
| `registry_characters` | yes | yes | no | yes | yes |
| `relationship_events` | yes | yes | no | yes | yes |
| `scene_angles` | yes | yes | no | yes | yes |
| `scene_assets` | yes | yes | no | no | yes |
| `scene_continuations` | no | yes | no | yes | yes |
| `scene_footage_links` | yes | yes | no | no | no |
| `scene_layer_configuration` | yes | no | no | no | no |
| `scene_library` | yes | yes | no | no | yes |
| `scene_object_variants` | yes | yes | no | no | yes |
| `scene_plans` | yes | yes | no | yes | yes |
| `scene_proposals` | yes | yes | no | no | yes |
| `scene_set_episodes` | yes | yes | no | yes | yes |
| `scene_sets` | yes | yes | no | yes | yes |
| `scene_templates` | yes | no | no | no | yes |
| `scenes` | yes | yes | no | yes | yes |
| `script_edit_history` | yes | no | no | no | no |
| `script_edits` | no | no | no | yes | yes |
| `script_learning_profiles` | yes | no | no | no | no |
| `script_metadata` | yes | yes | no | no | no |
| `script_suggestions` | yes | no | no | no | no |
| `script_templates` | yes | no | no | no | no |
| `search_filter_presets` | no | no | no | yes | no |
| `session_briefs` | yes | yes | no | no | yes |
| `show_arcs` | yes | yes | no | yes | yes |
| `show_assets` | yes | no | no | no | yes |
| `show_configs` | yes | no | no | no | no |
| `shows` | yes | yes | no | yes | yes |
| `social_media_imports` | yes | yes | no | no | yes |
| `social_profile_followers` | yes | yes | no | yes | yes |
| `social_profile_relationships` | yes | yes | no | no | yes |
| `social_profile_templates` | no | yes | no | no | yes |
| `social_profiles` | yes | yes | no | yes | yes |
| `stories` | no | yes | no | yes | yes |
| `story_calendar_events` | yes | yes | no | no | yes |
| `story_clock_markers` | yes | yes | no | no | yes |
| `story_revisions` | yes | yes | no | no | yes |
| `story_task_arcs` | yes | yes | yes | no | yes |
| `story_texture` | yes | yes | no | no | yes |
| `story_threads` | yes | yes | no | yes | yes |
| `storyteller_books` | yes | yes | no | yes | yes |
| `storyteller_chapters` | yes | yes | no | yes | yes |
| `storyteller_echoes` | yes | yes | no | no | yes |
| `storyteller_lines` | yes | yes | no | yes | yes |
| `storyteller_memories` | yes | yes | no | yes | yes |
| `storyteller_stories` | yes | yes | no | yes | yes |
| `template_studio` | no | no | no | yes | yes |
| `therapy_pending_sessions` | yes | yes | no | no | yes |
| `thumbnail_compositions` | yes | yes | no | yes | yes |
| `thumbnail_templates` | yes | no | no | no | yes |
| `thumbnails` | yes | yes | no | no | yes |
| `timeline_data` | yes | yes | no | yes | yes |
| `timeline_events` | no | no | no | yes | no |
| `timeline_placements` | yes | no | no | no | yes |
| `ui_overlay_types` | no | yes | no | yes | yes |
| `universe_characters` | yes | yes | no | no | yes |
| `universes` | yes | yes | no | no | yes |
| `upload_logs` | no | yes | no | no | no |
| `user_decisions` | yes | yes | no | yes | no |
| `users` | no | yes | no | no | no |
| `video_compositions` | no | no | yes | no | yes |
| `video_processing_jobs` | yes | no | no | no | no |
| `video_scenes` | no | no | no | yes | no |
| `voice_rules` | yes | yes | no | no | yes |
| `voice_signals` | yes | yes | no | no | yes |
| `wardrobe` | yes | no | no | yes | yes |
| `wardrobe_brand_tags` | yes | yes | no | no | yes |
| `wardrobe_content_assignments` | yes | yes | no | no | yes |
| `wardrobe_library` | yes | no | no | yes | yes |
| `wardrobe_library_references` | yes | no | no | no | yes |
| `wardrobe_usage_history` | yes | no | no | no | yes |
| `world_character_batches` | no | yes | no | yes | yes |
| `world_characters` | yes | yes | no | yes | yes |
| `world_events` | yes | yes | no | yes | yes |
| `world_locations` | yes | yes | no | yes | yes |
| `world_state_snapshots` | yes | yes | no | yes | yes |
| `world_tensions` | no | no | no | yes | no |
| `world_timeline_events` | yes | yes | no | no | yes |
| `writing_goals` | yes | yes | no | no | yes |
| `writing_rhythm` | yes | yes | no | no | yes |

## §4.1 Counts

**MEASURED**, counted directly off the table above:

- **Expected total (union of a, b, c, d):** 193
- **Expected but absent in canon:** **56**
- **Both expected and present in canon:** **137** (193 − 56)
- **In canon but unexpected** (present in the capture, matching none of columns a–d): **6** — `SequelizeMeta`, `asset_label_map`, `episode_outfit_items`, `episode_outfits`, `pgmigrations`, `search_history`. (`SequelizeMeta` and `pgmigrations` are the two migration-ledger tables themselves, not application tables — expected to be canon-only by nature.)

```
$ tail -n +3 docs/audit/EvidenceNote_Canon_Schema_Capture_2026-08-29.txt | awk -F'|' '{gsub(/^[ \t]+|[ \t]+$/,"",$1); print $1}' | grep -vE '^\(|^-+$|^$' | sort -u | wc -l
143
```
(Corroborates Amendment 18's "143 tables" figure independently, from the file's own table-name column — not carried on trust.)

**Note on why this count differs from the register's own model-vs-canon comparison.** Amendment 18 §T3 reports **124 present / 30 absent / 19 canon-orphans** for **models alone (column a) against canon** — a different, narrower comparison than this census's 193-table union of all four sources. The two are not in tension: a union of four sources naturally has more absent rows than a single source does. This census does not re-derive or dispute Amendment 18's own model-only figures (carried, not re-walked, per §6 below).

---

# §5. Expected-but-absent rows: referencing route file(s)

For each of the 56 rows scoring `no` in canon, the `src/routes/` file(s) (or, where none, the nearest evidence of use) referencing the table or its backing model. **MEASURED** — each entry below is a grep result, not an inference.

| table | route file(s) referencing it | note |
|---|---|---|
| `FileStorages` | none found | Model `FileStorage` (var/class name) not matched in `src/routes/`; registered in `src/models/index.js` only. |
| `ai_edit_plans` | none found | Model `AIEditPlan` referenced only in `src/services/sqsService.js` and `src/models/index.js`. |
| `ai_interactions` | none found | Migration-only table (column b); no model, no route/service raw-SQL match. |
| `ai_revisions` | none found | Model `AIRevision` referenced only in `src/models/index.js`. |
| `ai_training_data` | `src/routes/youtube.js` | |
| `audio_clips` | `src/routes/animatic.js`, `src/routes/audio-clips.js`, `src/routes/episodes.js`, `src/routes/export.js`, `src/routes/timelineData.js` | |
| `beats` | `src/routes/animatic.js`, `src/routes/beats.js`, `src/routes/characterAI.js`, `src/routes/continuityEngine.js`, `src/routes/episodeBriefRoutes.js`, `src/routes/episodeOrchestrationRoute.js`, `src/routes/episodeScriptWriterRoutes.js`, `src/routes/episodes.js`, `src/routes/export.js`, `src/routes/feedEnhancedRoutes.js`, `src/routes/generate-script-from-book.js`, `src/routes/memories/assistant.js`, `src/routes/memories/engine.js`, `src/routes/memories/extras.js`, `src/routes/memories/helpers.js`, `src/routes/memories/planning.js`, `src/routes/onboarding.js`, `src/routes/phoneAIRoutes.js`, `src/routes/sceneProposeRoute.js`, `src/routes/sceneSetRoutes.js`, `src/routes/sceneStudioEpisodeRoutes.js`, `src/routes/scriptParse.js`, `src/routes/storyEvaluationRoutes.js`, `src/routes/tierFeatures.js`, `src/routes/timelineData.js`, `src/routes/uiOverlayRoutes.js`, `src/routes/wardrobe.js`, `src/routes/worldEvents.js`, `src/routes/worldStudio.js` | 29 files; broad hit set because `beats` is a short token — not manually deduplicated further. |
| `brain_documents` | `src/routes/franchiseBrainRoutes.js` | |
| `chapter_versions` | `src/routes/storyHealth.js` | Also created inline (column c). |
| `character_clips` | `src/routes/animatic.js`, `src/routes/character-clips.js`, `src/routes/episodes.js`, `src/routes/export.js`, `src/routes/timelineData.js` | |
| `character_profiles` | `src/routes/editMaps.js`, `src/routes/memories/engine.js`, `src/routes/socialProfileRoutes.js` | |
| `choice_stats` | none found | Referenced only in `src/services/decisionAnalyticsService.js`. |
| `composition_versions` | none found | Referenced only in `src/services/FilterService.js`, `src/services/VersioningService.js`. |
| `cursor_actions` | none found | Referenced only in `src/services/cursorPathGeneratorService.js`, `src/services/productionPackageService.js`. |
| `decision_logs` | `src/routes/decisionLogs.js`, `src/routes/world.js` | Canon has `decision_log` (singular) instead — see §6. |
| `decision_patterns` | `src/routes/decisions.js` | |
| `edit_maps` | `src/routes/editMaps.js` | |
| `editing_decisions` | none found | Model `EditingDecision`-style file registered in `src/models/index.js`; no route/service match. |
| `episode_phases` | none found | Migration-only table (column b); no model, no route/service raw-SQL match. |
| `event_chain` | none found | Referenced only in `src/services/feedEventPipelineService.js`. |
| `game_wardrobe` | `src/routes/episodeOrchestrationRoute.js` | |
| `icon_cues` | none found | Referenced only in `src/services/cursorPathGeneratorService.js`, `src/services/iconCueGeneratorService.js`, `src/services/productionPackageService.js`. |
| `icon_slot_mappings` | none found | Referenced only in `src/services/cursorPathGeneratorService.js`, `src/services/iconCueGeneratorService.js`. |
| `interactive_elements` | none found | Referenced only in `src/services/iconCueGeneratorService.js`. |
| `jobs` | `src/routes/compositions.js`, `src/routes/export.js`, `src/routes/jobs.js`, `src/routes/memories/engine.js`, `src/routes/processing.js`, `src/routes/queue-monitor.js`, `src/routes/sceneSetRoutes.js`, `src/routes/socialProfileBulkRoutes.js` | Also directly in `src/services/ErrorRecovery.js` (`FROM jobs`/`UPDATE jobs`). |
| `lala_cash_grab_quests` | none found | Migration-only table (column b); no route/service match. |
| `lala_episode_formulas` | none found | Migration-only table (column b); no route/service match. |
| `lala_episode_timeline` | none found | Migration-only table (column b); no route/service match. |
| `lala_formula_episodes` | none found | Referenced only in `src/services/iconCueGeneratorService.js`, `src/services/musicCueGeneratorService.js`, `src/services/productionPackageService.js`. |
| `lala_friend_archetypes` | none found | Migration-only table (column b); no route/service match. |
| `lala_micro_goals` | none found | Migration-only table (column b); no route/service match. |
| `layer_assets` | `src/routes/layers.js` | |
| `layer_presets` | none found | Model `LayerPreset` referenced only in `src/models/index.js`. |
| `layers` | `src/routes/authorNoteRoutes.js`, `src/routes/characterGenerator.js`, `src/routes/characterRegistry.js`, `src/routes/feedSchedulerRoutes.js`, `src/routes/layers.js`, `src/routes/manuscript-export.js`, `src/routes/memories/engine.js`, `src/routes/relationships.js`, `src/routes/socialProfileBulkRoutes.js`, `src/routes/socialProfileRoutes.js`, `src/routes/storyEvaluationRoutes.js`, `src/routes/textureLayerRoutes.js`, `src/routes/undergroundRoutes.js` | Same short-token caveat as `beats`. |
| `layout_templates` | none found | Migration-only table (column b); no route/service match. |
| `markers` | `src/routes/calendarRoutes.js`, `src/routes/characterCrossingRoutes.js`, `src/routes/episodes.js`, `src/routes/export.js`, `src/routes/markers.js`, `src/routes/memories/extras.js`, `src/routes/press.js`, `src/routes/stories.js`, `src/routes/storyEvaluationRoutes.js`, `src/routes/storyteller.js`, `src/routes/timelineData.js` | |
| `music_cues` | none found | Referenced only in `src/services/musicCueGeneratorService.js`, `src/services/productionPackageService.js`. |
| `processing_queues` | none found | Referenced only in `src/services/cfoAgent.js`; canon has `processing_queue` (singular) instead — see §6. |
| `production_packages` | none found | Referenced only in `src/services/productionPackageService.js`. |
| `raw_footage` | `src/routes/editMaps.js`, `src/routes/footage.js` | Model file itself absent — see §3(a). |
| `scene_footage_links` | `src/routes/sceneLinks.js` | |
| `scene_layer_configuration` | none found | Model registered in `src/models/index.js`; no route/service raw-SQL match found. |
| `script_edit_history` | none found | Model registered in `src/models/index.js`; no route/service match. |
| `script_learning_profiles` | none found | Model registered in `src/models/index.js`; no route/service match. |
| `script_metadata` | `src/routes/sceneLinks.js`, `src/routes/scriptAnalysis.js` | |
| `script_suggestions` | none found | Model registered in `src/models/index.js`; no route/service match. |
| `script_templates` | `src/routes/scriptGenerator.js` | |
| `search_filter_presets` | none found | Referenced only in `src/services/FilterService.js`. |
| `show_configs` | `src/routes/scriptGenerator.js` | |
| `timeline_events` | `src/routes/storyHealth.js` | |
| `upload_logs` | none found | Migration-only table (column b); no route/service match. |
| `user_decisions` | `src/routes/decisions.js` | |
| `users` | `src/routes/memories/assistant.js`, `src/routes/memories/interview.js`, `src/routes/memories/planning.js`, `src/routes/wardrobeLibrary.js` | |
| `video_processing_jobs` | none found | Model `VideoProcessingJob` referenced in `src/services/sqsService.js` and `src/models/index.js`; no route match. |
| `video_scenes` | `src/routes/youtube.js` | Also `src/services/youtubeService.js`. |
| `world_tensions` | `src/routes/storyHealth.js` | |

---

# §6. Carried context — cited, not re-derived

Per the issue's instruction, these are quoted from their own sources and no position is taken on them here.

**FD-31 (canon = `-dev`) and the 37/9 prod-dev split.** CITED, `PROJECT_CONTEXT.md` §4.5:

> **Canon vs prod fork (ASSERTED, from pre-freeze live reads):** canon `episode-control-dev` = 143 tables, populated (episodes 72, shows 10, social_profiles 444, franchise_knowledge 605), with both `pgmigrations` (stopped 2026-01-22) and `SequelizeMeta` ledgers; `episode-control-prod` = 171 tables, empty; 37 prod-only, 9 dev-only; neither a superset. `SequelizeMeta` on canon records migrations whose effects are absent (Amd22). Decision FD-31: canon = `-dev`; prod-only tables preserved in `docs/audit/FD31-prod-only-schema-20260601.sql` (DO NOT RUN).

**The `decision_log` vs `decision_logs` collision.** CITED, `v25_Owed_Index_Amd18_2026-08-30.md` §T2.4:

> **`decision_logs` does not exist on canon.** `decision_log` does — 11 columns... literals are present on canon — `world_events`, `character_state`, ... canon-only. F-App-1 closed the write path; canon still carries the schema that... A migration *"add `deleted_at` to `decision_logs`"* run against canon either [creates a table that shadows the real one, or errs] one. **Row counts were not captured**, so whether `decision_log` holds rows is [unestablished].

(This census's own §3(b) and §4 independently corroborate the naming split — `decision_log` exists in the migrations tree and in canon; `decision_logs`, the model's spelling, exists in migrations but not in canon.)

**FD-66 (DRAFT).** CITED, `FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md` header:

> **Status:** **DRAFT.** Mints **FD-66**; FD tail advances **FD-65 → FD-66**. **Priority P0, ruled**... Ships no code. Changes no gate. Authorizes nothing.
>
> ...this finding was surfaced by [F-Auth-5 remediation], not sought by it.

`PROJECT_CONTEXT.md` §4.5 additionally summarizes FD-66 as: *"28 mismatched + 38 no-table models; three routes confirmed 500 (`GET /api/v1/audit-logs`, `POST /api/v1/decision-logs`, `POST /api/v1/thumbnails/:id/publish`)."* Quoted for context; not re-verified by this census.

---

# §7. What this note does not do

- **Does not choose a schema.** It takes no position on whether canon, prod, or the migrations tree should be authoritative.
- **Does not propose any migration, code change, or remedy.**
- **Does not claim canon matches the capture today.** Every canon-side claim in §4 is AS-RECORDED from the 2026-08-29 capture; no live read of canon was performed by this census, and Amendment 18's own caution (a capture eight-plus days old at any later reader's basis) applies here too, now over three weeks old.
- **Does not touch `src/`, `tests/`, or `PROJECT_CONTEXT.md`.** This file is the only change.
- **Mints no FD, XK, or PE number.** Tails re-derived at this basis:

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md
56:### XK-1 — `paranoid` exposure
207:### XK-2 — row-scope not enforced in SQL
288:### XK-3 — no authorization substrate for the tenancy root

$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -3
66
67
68

$ ls docs/audit | grep -E '^F-AUTH-1_Fix_Plan_v[0-9.]+\.md$' | sort -V | tail -1
F-AUTH-1_Fix_Plan_v2.76.md
```

**FD tail: FD-69, retired (duplicate). FD-70 next-available, unminted. XK tail: XK-3. PE tail: PE #68.** Cross-checked against `F-AUTH-1_Fix_Plan_v2.76.md` §0's own same-basis re-derivation, which states the identical figures and explicitly confirms FD-70/XK-4/PE #69 "remain next-available and unminted" — this census does not change that.

- **No host, AWS, database, or Cognito contact.** Every claim above is either MEASURED (a repository read, command and output pasted) or explicitly CITED/AS-RECORDED from a named source, never upgraded in standing.
- **Prod FROZEN**, unaffected by anything in this document.

---

*Type: standalone census. Rules nothing, mints nothing, chooses no schema. Every MEASURED claim is a repository read against `origin/main` at `4b173440d34b7bfbce40f2d637caa8e6ec53bd72`, command and output pasted. No host, AWS, database, or Cognito contact. Prod FROZEN.*
