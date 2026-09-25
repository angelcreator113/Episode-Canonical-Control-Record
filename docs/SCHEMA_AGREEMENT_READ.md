# Schema agreement read

Task: #1861. A read, not a change. Basis: `origin/main` at `8b90c0de0` (2026-09-25). Nothing in `src/`, `tests/`, models or migrations was changed.

Standing labels (as in `docs/MIGRATION_DRIFT_READ.md`):
- **MEASURED (M)**: read from this repository at the basis, including the canon schema capture already filed at `docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt` (2,760 column records from `episode-control-dev`, the canon database per FD-31; `PROJECT_CONTEXT.md` §4.5).
- **INFERRED (I)**: reasoned from measured facts; a database read would settle it.

"Production" below means that 09-17 capture. Changes made by hand since then (the 09-22 `world_events.category`/`format` ALTER and the 09-24 `restrictions`/`event_deliverables` run, per the drift read) touch none of the columns named here.

The symptom being counted: **code that disagrees with the schema, hidden by a catch or by a mock.** The instrument is `scripts/check-schema-agreement.js` (added by this PR; no database, no network). Every count below is its output unless marked otherwise.

## Summary

| Failure mode | What was found | Headline |
|---|---|---|
| **1. Query vs model** (#1860's shape) | 200 undeclared attribute names at 92 call sites in `src/`, plus 27 column references in raw SQL at 21 call sites | **55 call sites fail in production**: 40 read a column production lacks, 8 touch a table production lacks, and 7 use an `include` alias that isn't associated. **18 of the 55 are hidden** (14 log and carry on, 4 are silent). Separately, **7 writes silently drop values for columns production has**, and 24 drop keys nothing stores. Raw SQL: 23 of 27 references (18 of 21 sites) name a column production lacks; 8 of those 18 sites are silent. |
| **2. Model vs migrations** (CharacterState / StoryTaskArc shape) | 10 paranoid models whose table no live migration gives `deleted_at`; 49 declared columns no live migration creates; 36 models whose table no live migration creates | **6 paranoid models also lack `deleted_at` in production**: every read and create on them fails, the CharacterState failure again. |
| **3. Model vs the real database** | Covered by `docs/MIGRATION_DRIFT_READ.md` (`assets.role_key`, §3 and §6) | Not redone. Mode 2 turned up 14 more declared columns production lacks (ActivityLog, Thumbnail, HairLibrary, MakeupLibrary): see §2. |
| **4. Mocks** | 69 undeclared keys in hand-built rows (21 distinct file/model/key triples, 10 test files); 9 enum values outside the declared ENUM | 6 of the 9 true-positive files hand the code under test the same names a mode 1 hit uses, so the test passes over the broken query. 1 false positive (an aggregate alias). |

**Positive control: all found.** #1860's `profile_a_id`/`profile_b_id` query (step 1) and its `relationship_type: 'friend'` mocks (step 4) at `8b90c0de0`; `CharacterState` and `StoryTaskArc` as paranoid-without-`deleted_at` at `f9c4dea67` (the parent of #1836's `eba35e985`; #1845's `13c76dc96` descends from it); `role_key` by citation. Output in §7.

**Step 5 answer:** step 1 can run as a ratcheted lint. It found 0 false positives in 200 hits, leaves 4.4% of resolved calls partly unresolved, and runs in about 3 s with no database. The baseline mode is built and demonstrated, but not wired into CI. Step 2 is also reliable enough for a ratchet. Steps 3 and 4 are one-off reads. See §5.

Note: #1860 is being fixed on its own branch concurrently. When it merges, the `eventAutomationService` row and the two `SocialProfileRelationship` mock rows go away. Nothing else here depends on it.

---

## 0. Method

`node scripts/check-schema-agreement.js [--capture <file>] [--json <file>] [--unresolved] [--root <checkout>]`. Parser: `@babel/parser` 7.29.0, already in `node_modules` as a Jest dependency; nothing was added to `package.json`. Models: `require('src/models')` with `DB_HOST=127.0.0.1`, `DB_PORT=1`, and no `DATABASE_URL`. Sequelize does not connect until a query runs, so 152 models load (149 exported, plus `RawFootage`, `BrainDocument` and the auto-built `asset_asset_labels` through-model). A name counts as declared if it is a `rawAttributes` key, any attribute's `field`, or an association alias of the loaded model.

- **Step 1** walks every `.js` file under `src/` except `src/migrations/` (506 files). A receiver resolves to a model when it is the model's name, a member ending in it (`db.X`, `models.X`, `sequelize.models.X`), a destructured alias (`const { X: Y } = …`), or a `const` bound to one of those. Clauses read: `where` (recursing into `Op.or`/`Op.and`/`Op.not`, spreads of local objects, `$nested.col$`, and later `where.key = …` assignments to a local), `attributes` (incl. `include`/`exclude`, `[col, alias]`), `order` (`[col, dir]`, `[assoc, col, dir]`), `group`, `include` (`as`/`association` checked against the parent's associations, then recursing into the target model's `where`/`attributes`), `defaults`, `fields`, and the value objects of `create`/`bulkCreate`/`upsert`/`update`/`increment`. An identifier is followed only to a literal object declared in the same scope. Anything else is counted as unresolved.
- **Step 2** replays each migration's `up` in filename order with a small abstract interpreter. It follows local constants, `for…of` over literal arrays and `Object.entries`, helper closures (`addIfMissing`), transaction callbacks, and DDL inside `queryInterface.sequelize.query` strings (`CREATE TABLE`, `ALTER TABLE … ADD/DROP/RENAME`, `DROP TABLE`). Both branches of every `if` and `try` count, so a column added under a guard counts as created. That choice is the lenient one.
- **Step 3** reads `sequelize.query` first arguments in `src/` (literal strings, templates with `${}` treated as holes, and same-scope `const` SQL). It extracts `INSERT` column lists, `UPDATE … SET` targets, `alias.column` references resolved through `FROM`/`JOIN`, `ON CONFLICT … SET`, and, only for single-table statements with no subquery, bare `WHERE` columns. These are checked against the step 2 tables.
- **Step 4** binds hand-built rows in `tests/` to a model through: an object keyed by a model name (`jest.mock('…/models', () => ({ X: { findAll: … } }))`, `makeModels`); `X.method = jest.fn(…)` and `X.method.mockResolvedValue(…)`/`jest.spyOn(X, 'method')`; local row builders (`rel()`, `cand()`) with their argument and default values; function parameters that feed a mock, followed to every literal property of that name in the file; and `opts.where.key` reads inside a fake method; plus `where` and values in `expect(X.method).toHaveBeenCalledWith(…)`. Only row-returning methods count (`find*`, `create`, `bulkCreate`, `findOrCreate`, `upsert`); custom statics such as `getStats` do not.
- **Per hit**: whether the file is reachable is a static `require` walk from `src/server.js` and `src/workers/start.js`. All 58 hit files are reachable (M); whether the particular function runs on a live request is I. The catch that hides each hit is the nearest `.catch()` on the call or the enclosing `try` in the same function, as found by a second scratch walker. The effect in production is the hit's table and column looked up in the 09-17 capture.

What Sequelize 6 does with an undeclared name (M, generated offline by stubbing `sequelize.query` with a recorder; no database):

```
-- SocialProfileRelationship.findAll where profile_a_id/profile_b_id (eventAutomationService assembleGuestList)
SELECT "id", "source_profile_id", "target_profile_id", … FROM "social_profile_relationships" AS "SocialProfileRelationship" WHERE ("SocialProfileRelationship"."profile_a_id" = 1 OR "SocialProfileRelatio…
-- RegistryCharacter.findAll attributes name (textureLayerRoutes)
SELECT "id", "name" FROM "registry_characters" AS "RegistryCharacter" WHERE ("RegistryCharacter"."deleted_at" IS NULL);
-- StorytellerLine.findAll order line_order (tierFeatures)
SELECT … FROM "storyteller_lines" AS "StorytellerLine" WHERE ("StorytellerLine"."deleted_at" IS NULL) ORDER BY "StorytellerLine"."line_order" ASC;
-- WorldEvent.create with theme/mood (worldEvents.js) — undeclared keys
INSERT INTO "world_events" ("id","show_id","name","event_type",…,"created_at","updated_at") VALUES ($1,…,$28) RETURNING …
-- StorytellerBook.update current_arc_stage (sceneProposeRoute) — undeclared keys only
(no statement issued)
-- EpisodeWardrobe.findAll include as wardrobe (wardrobeApprovalController)
THREW SequelizeEagerLoadingError: Wardrobe is associated to EpisodeWardrobe using an alias. You've included an alias (wardrobe), but it does not match the alias(es) defined in your association (wardrobeItem).
-- CharacterArc.findAll (paranoid, table has no deleted_at in the live tree)
SELECT "id", "character_key", … "deleted_at" AS "deletedAt" FROM "character_arcs" AS "CharacterArc" WHERE ("CharacterArc"."deleted_at" IS NULL) LIMIT 1;
```

So an undeclared name in `where`/`attributes`/`order`/`group` goes into the SQL unchanged, and the query fails exactly when the column is missing from the database. The same name in `create`/`update` values is **dropped with no error**. `theme` and `mood` are absent from the INSERT, and an update that sets only undeclared keys issues no statement at all. An `include` alias the parent doesn't have throws before any SQL runs.

---

## 1. Query vs model (step 1, plus raw SQL from step 3)

Raw counts (M):

```
STEP 1 query vs model: 506 files, 1982 resolved model calls, 7243 names checked
  hits (undeclared names): 200
  resolved calls with an unresolved part: 88 (4.4%)
  unresolved items: 125 (of which unknown receiver on a model-only method: 30)
  create/update/destroy/count/... on a non-model receiver (instance or other object, not checked): 954
```

By effect in production (names / call sites; M against the 09-17 capture):

| Effect | Names | Call sites |
|---|---:|---:|
| Read of a column production lacks → `column … does not exist` on every call | 72 | 40 (2 of them also read present columns) |
| Read on a table production lacks → `relation … does not exist` | 7 | 4 |
| `include` alias not associated → `SequelizeEagerLoadingError` on every call | 8 | 7 |
| **Write drops a value for a column production has** (silent data loss) | 14 | 7 |
| Write drops a key production lacks too (silent; nothing to store it in) | 65 | 24 |
| Write on a table production lacks | 12 | 4 |
| Read of a column production has; only the model is stale (works) | 22 | 6 |

The 55 failing call sites (40 + 4 + 4 + 7), by what hides them (M): 31 log and return a 5xx or rethrow; 6 have no local catch and propagate to the caller or the Express error handler; **18 are hidden**: 14 log and carry on with a fallback value, 3 swallow the error with no log (one of them, `wardrobeApprovalController.js:296`, puts the message into an `errors` array in the response), and 1 is `.catch(() => [])`.

### 1.1 Every hit

`✗` = column absent in the 09-17 capture. `(w)` = a key in a create/update value object. Line numbers are at the basis. Effect and visibility in data are M from the capture and the probe above. "Live" is M at file level (every file below is reachable from `src/server.js`) and I at function level.

| Call site | Model.method | Undeclared names | Effect in production | What hides it |
|---|---|---|---|---|
| `src/controllers/episodeAssetsController.js:27` | EpisodeAsset.findAll | folder✗, folder✗, sort_order✗, added_at✗ | read fails: column does not exist (M) | catch L69: logged + 5xx/throw |
| `src/controllers/episodeAssetsController.js:116` | EpisodeAsset.create | folder✗ (w), tags✗ (w), sort_order✗ (w), added_by✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/controllers/episodeAssetsController.js:242` | EpisodeAsset.findAll | folder✗ | read fails: column does not exist (M) | catch L261: logged + 5xx/throw |
| `src/controllers/episodeController.js:323` | Episode.create | platforms✗ (w), platforms_other✗ (w), content_strategy✗ (w), platform_descriptions✗ (w), content_types✗ (w), primary_audience✗ (w), tones✗ (w), structure✗ (w), visual_requirements✗ (w), owner_creator✗ (w), needs_approval✗ (w), collaborators✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/controllers/jobController.js:53` | ProcessingQueue.create | file_id✗ (w), progress✗ (w), data✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/controllers/metadataController.js:24` | MetadataStorage.findAndCountAll | createdAt✗, episodeTitle✗, showName✗ | read fails: column does not exist (M) | catch L52: logged, continues |
| `src/controllers/metadataController.js:74` | Episode.findByPk | episodeTitle✗, showName✗, seasonNumber✗, episodeNumber✗ | read fails: column does not exist (M) | no local catch: propagates |
| `src/controllers/processingController.js:24` | Episode.findAndCountAll | episodeTitle✗, showName✗, seasonNumber✗, episodeNumber✗ | read fails: column does not exist (M) | no local catch: propagates |
| `src/controllers/processingController.js:68` | Episode.findByPk | episodeTitle✗, showName✗, seasonNumber✗, episodeNumber✗ | read fails: column does not exist (M) | no local catch: propagates |
| `src/controllers/sceneController.js:1508` | SceneAsset.findOne | role✗ | read fails: column does not exist (M) | catch L1537: logged + 5xx/throw |
| `src/controllers/sceneController.js:1519` | SceneAsset.create | role✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/controllers/sceneController.js:1564` | SceneAsset.findAll | role✗, role✗ | read fails: column does not exist (M) | catch L1580: logged + 5xx/throw |
| `src/controllers/sceneStudioController.js:894` | SceneSet.update | canvas_settings (w) | write drops 1 key(s) the table has (M) | none needed: no error |
| `src/controllers/sceneStudioController.js:1161` | Asset.create | type✗ (w), label✗ (w), usage_type✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/controllers/thumbnailController.js:24` | Episode.findAndCountAll | episodeTitle✗, showName✗ | read fails: column does not exist (M) | catch L60: logged + 5xx/throw |
| `src/controllers/thumbnailController.js:76` | Episode.findByPk | episodeTitle✗, showName✗, seasonNumber✗, episodeNumber✗ | read fails: column does not exist (M) | catch L107: logged + 5xx/throw |
| `src/controllers/thumbnailController.js:288` | Episode.findByPk | episodeTitle✗, showName✗, seasonNumber✗, episodeNumber✗ | read fails: column does not exist (M) | no local catch: propagates |
| `src/controllers/wardrobeApprovalController.js:21` | EpisodeWardrobe.findOne | as:'wardrobe' | throws EagerLoadingError every call (M) | catch L98: logged + 5xx/throw |
| `src/controllers/wardrobeApprovalController.js:121` | EpisodeWardrobe.findOne | as:'wardrobe' | throws EagerLoadingError every call (M) | catch L189: logged + 5xx/throw |
| `src/controllers/wardrobeApprovalController.js:213` | EpisodeWardrobe.findAll | as:'wardrobe' | throws EagerLoadingError every call (M) | catch L266: logged + 5xx/throw |
| `src/controllers/wardrobeApprovalController.js:296` | EpisodeWardrobe.findOne | as:'wardrobe' | throws EagerLoadingError every call (M) | catch L354: **silent** |
| `src/controllers/wardrobeLibraryController.js:616` | EpisodeWardrobe.create | override_character✗ (w), override_occasion✗ (w), override_season✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/controllers/wardrobeLibraryController.js:669` | WardrobeUsageHistory.findAll | as:'sceneDetails' | throws EagerLoadingError every call (M) | catch L725: logged + 5xx/throw |
| `src/controllers/wardrobeLibraryController.js:1341` | EpisodeWardrobe.findAll | as:'wardrobe' | throws EagerLoadingError every call (M) | catch L1391: logged + 5xx/throw |
| `src/controllers/wardrobeLibraryController.js:1520` | Wardrobe.create | imageUrl✗ (w), thumbnailUrl✗ (w), created_by✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/amberDiagnosticRoutes.js:58` | FranchiseKnowledge.findAll | source✗ | read fails: column does not exist (M) | catch L85: logged, continues |
| `src/routes/amberDiagnosticRoutes.js:97` | StorytellerMemory.count | status✗ | read fails: column does not exist (M) | catch L116: logged, continues |
| `src/routes/amberDiagnosticRoutes.js:126` | RegistryCharacter.findAll | name✗ | read fails: column does not exist (M) | catch L148: logged, continues |
| `src/routes/amberSessionRoutes.js:106` | StorytellerLine.findAll | content✗ | read fails: column does not exist (M) | catch L189: logged, continues |
| `src/routes/amberSessionRoutes.js:120` | StorytellerMemory.count | status✗ | read fails: column does not exist (M) | catch L189: logged, continues |
| `src/routes/amberSessionRoutes.js:125` | StorytellerLine.findAll | content✗ | read fails: column does not exist (M) | catch L189: logged, continues |
| `src/routes/characterAI.js:115` | CharacterRelationship.findAll | source_name✗, target_name✗ | read fails: column does not exist (M) | catch L123: **silent** |
| `src/routes/characterCrossingRoutes.js:35` | RegistryCharacter.findAll | performing_publicly, dimensions_performed, dimensions_hidden | read works; model stale (M) | none needed: no error |
| `src/routes/characterCrossingRoutes.js:186` | RegistryCharacter.findAll | performing_publicly, dimensions_performed, dimensions_hidden | read works; model stale (M) | none needed: no error |
| `src/routes/characterGenerationRoutes.js:67` | Universe.findByPk | tone✗ | read fails: column does not exist (M) | catch L99: logged + 5xx/throw |
| `src/routes/characterGenerationRoutes.js:79` | RegistryCharacter.findAll | world_exists✗ | read fails: column does not exist (M) | catch L99: logged + 5xx/throw |
| `src/routes/characterGenerationRoutes.js:266` | RegistryCharacter.create | world_exists✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/characterGenerator.js:1052` | RegistryCharacter.update | world_character_id (w) | write drops 1 key(s) the table has (M) | none needed: no error |
| `src/routes/characterRegistry.js:235` | RegistryCharacter.create | sexuality✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/compositions.js:313` | ThumbnailComposition.create | template_studio_id✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/compositions.js:1438` | EpisodeAsset.findOne | role✗ | read fails: column does not exist (M) | catch L1459: logged + 5xx/throw |
| `src/routes/entanglementRoutes.js:56` | SocialProfile.findAll | follower_count✗ | read fails: column does not exist (M) | catch L63: logged + 5xx/throw |
| `src/routes/entanglementRoutes.js:284` | StorytellerLine.create | book_id✗ (w), content✗ (w), source✗ (w), character✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/episodes.js:1178` | SceneSet.findAll | set_type✗ | read fails: column does not exist (M) | no local catch: propagates |
| `src/routes/footage.js:90` | Scene.create | type✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/memories/engine.js:685` | StorytellerChapter.findAll | order_index✗ | read fails: column does not exist (M) | catch L753: logged, continues |
| `src/routes/memories/engine.js:1668` | CharacterRelationship.findAll | as:'characterA', as:'characterB' | throws EagerLoadingError every call (M) | catch L1740: logged, continues |
| `src/routes/memories/engine.js:4537` | RegistryCharacter.create | metadata✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/novelIntelligenceRoutes.js:264` | StorytellerStory.findAll | book_id✗ | read fails: column does not exist (M) | catch L384: logged + 5xx/throw |
| `src/routes/novelIntelligenceRoutes.js:277` | StorytellerLine.findAll | story_id✗, story_id✗, order✗ | read fails: column does not exist (M) | catch L384: logged + 5xx/throw |
| `src/routes/onboarding.js:506` | StorytellerLine.findAll | content✗ | read fails: column does not exist (M) | `.catch`: **silent** [value fallback] |
| `src/routes/onboarding.js:511` | StorytellerChapter.findAll | story_number, story_number, story_phase | read works; model stale (M) | none needed: no error |
| `src/routes/propertyRoutes.js:205` | SceneSet.create | canvas_settings (w) | write drops 1 key(s) the table has (M) | none needed: no error |
| `src/routes/sceneLinks.js:52` | ScriptMetadata.findAll | episode_id | table `script_metadata` absent from 09-17 capture: every call fails (M) | catch L69: logged + 5xx/throw |
| `src/routes/sceneLinks.js:103` | ScriptMetadata.findAll | episode_id, type | table `script_metadata` absent from 09-17 capture: every call fails (M) | catch L194: logged + 5xx/throw |
| `src/routes/sceneLinks.js:156` | SceneFootageLink.create | footage_id (w) | table `scene_footage_links` absent from 09-17 capture: every call fails (M) | catch L194: logged + 5xx/throw |
| `src/routes/sceneProposeRoute.js:81` | StorytellerStory.findAll | book_id✗, arc_stage✗ | read fails: column does not exist (M) | catch L98: logged, continues |
| `src/routes/sceneProposeRoute.js:484` | StorytellerBook.update | current_arc_stage (w), arc_stage_scores (w) | write drops 2 key(s) the table has (M) | none needed: no error |
| `src/routes/sceneSetRoutes.js:198` | SceneSet.create | beat_numbers✗ (w), notes✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/sceneSetRoutes.js:203` | SceneSet.create | beat_numbers✗ (w), notes✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/scriptGenerator.js:18` | ShowConfig.create | target_duration (w), target_scene_count (w), format (w), niche_category (w), content_specs (w) | table `show_configs` absent from 09-17 capture: every call fails (M) | catch L32: logged + 5xx/throw |
| `src/routes/scriptGenerator.js:70` | ScriptTemplate.findOne | show_id, version | table `script_templates` absent from 09-17 capture: every call fails (M) | catch L80: logged + 5xx/throw |
| `src/routes/scriptGenerator.js:95` | ScriptTemplate.create | show_id (w), template_content (w), variables (w), scene_structure (w), version (w) | table `script_templates` absent from 09-17 capture: every call fails (M) | catch L105: logged + 5xx/throw |
| `src/routes/scriptGenerator.js:265` | EpisodeScene.create | episode_script_id✗ (w), scene_number✗ (w), title✗ (w), description✗ (w), content✗ (w), duration_seconds✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/scriptParse.js:265` | Scene.create | status✗ (w), metadata✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/socialProfileRoutes.js:1604` | RegistryCharacter.create | metadata✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/storyEvaluationRoutes.js:1207` | StorytellerStory.create | chapter_id✗ (w), book_id✗ (w), must_include✗ (w), never_include✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/storyteller.js:582` | StorytellerChapter.update | metadata✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/textureLayerRoutes.js:47` | RegistryCharacter.findOne | name✗ | read fails: column does not exist (M) | catch L98: logged + 5xx/throw |
| `src/routes/textureLayerRoutes.js:66` | RegistryCharacter.findAll | name✗ | read fails: column does not exist (M) | catch L98: logged + 5xx/throw |
| `src/routes/tierFeatures.js:748` | StorytellerLine.findAll | line_order✗ | read fails: column does not exist (M) | catch L800: logged + 5xx/throw |
| `src/routes/tierFeatures.js:877` | StorytellerLine.findAll | line_order✗ | read fails: column does not exist (M) | catch L921: logged + 5xx/throw |
| `src/routes/tierFeatures.js:1033` | StorytellerChapter.update | metadata✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/upgradeRoutes.js:57` | StorytellerStory.findAll | book_id✗ | read fails: column does not exist (M) | catch L143: logged + 5xx/throw |
| `src/routes/wardrobeLibrary.js:221` | Episode.findByPk | event_type✗, event_name✗, dress_code✗ | read fails: column does not exist (M) | catch L236: logged, continues |
| `src/routes/wardrobeLibrary.js:391` | WardrobeUsageHistory.create | wardrobe_library_id✗ (w), event_type✗ (w), event_data✗ (w), character_id✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/routes/worldEvents.js:2607` | WorldEvent.create | theme (w), mood (w), color_palette (w), floral_style (w), border_style (w) | write drops 5 key(s) the table has (M) | none needed: no error |
| `src/services/AssetService.js:422` | Asset.create | s3_key✗ (w), url✗ (w), description✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/services/CompositionService.js:89` | ThumbnailComposition.create | include_justawomaninherprime (w), justawomaninherprime_position (w), approval_status (w) | write drops 3 key(s) the table has (M) | none needed: no error |
| `src/services/CompositionService.js:350` | ThumbnailTemplate.findAll | platform | read works; model stale (M) | none needed: no error |
| `src/services/CompositionService.js:380` | ThumbnailComposition.findByPk | template_studio_id✗ | read fails: column does not exist (M) | catch L432: logged + 5xx/throw |
| `src/services/ThumbnailService.js:92` | Thumbnail.findAll | episode_id, episode_id, composition_id✗, url, s3_key, metadata✗, thumbnail_type, created_at, updated_at, created_at | read fails: column does not exist (M) | catch L110: logged + 5xx/throw |
| `src/services/ThumbnailService.js:161` | Thumbnail.count | episode_id | read works; model stale (M) | none needed: no error |
| `src/services/careerPipelineService.js:170` | Opportunity.create | career_goal_id (w) | write drops 1 key(s) the table has (M) | none needed: no error |
| `src/services/eventAutomationService.js:393` | SocialProfileRelationship.findAll | profile_a_id✗, profile_b_id✗ | read fails: column does not exist (M) | catch L429: logged, continues |
| `src/services/groundedScriptGeneratorService.js:103` | WardrobeLibrary.findAll | is_owned✗, slot✗, tier, aesthetic_tags, lala_reaction_equipped✗ | read fails: column does not exist (M) | catch L109: **silent** |
| `src/services/objectGenerationService.js:213` | Asset.create | original_filename✗ (w) | write drops keys; columns absent too (M) | none needed: no error |
| `src/services/registrySync.js:194` | StorytellerLine.findAll | order_index✗ | read fails: column does not exist (M) | catch L264: logged, continues |
| `src/services/worldTemperatureService.js:85` | Character.findAll | universe_id✗ | read fails: column does not exist (M) | catch L106: logged, continues |
| `src/services/worldTemperatureService.js:93` | CharacterRelationship.findAll | deleted_at | read works; model stale (M) | none needed: no error |
| `src/services/youtubeService.js:325` | AITrainingData.create | episode_id (w) | table `ai_training_data` absent from 09-17 capture: every call fails (M) | catch L345: logged + 5xx/throw |
| `src/services/youtubeService.js:533` | AITrainingData.findAll | episode_id, processing_status | table `ai_training_data` absent from 09-17 capture: every call fails (M) | no local catch: propagates |

Notes on individual rows:
- **`eventAutomationService.js:393`** (`assembleGuestList`) is #1860. It is caught at L429 with a `console.warn`, then falls through to the fill stage. Every guest list is therefore built with no relationship guests. Visible in data: no `guest_profiles` entry whose `relationship` came from `social_profile_relationships` (I). It is being fixed under #1860.
- **`worldEvents.js:2607`** (`from-profile`): `theme`, `mood`, `color_palette`, `floral_style` and `border_style` are real `world_events` columns (added by `20260703000000-add-invitation-fields-to-world-events.js` and present in production), but `WorldEvent` doesn't declare them. So `WorldEvent.create` never writes them. The same values are kept in `canon_consequences.automation`, which hides the loss. Visible in data: those columns are NULL on auto-created events whose `canon_consequences->'automation'->>'theme'` is set (I).
- **`sceneProposeRoute.js:484`**: `StorytellerBook.update({ current_arc_stage, arc_stage_scores })`. Both columns exist in production, the model declares neither, and the update issues no SQL (M, probe). The route still returns 200 with the computed stage. Visible in data: `storyteller_books.current_arc_stage` never changes through this route (I).
- **`CompositionService.js:89`** (`include_justawomaninherprime`, `justawomaninherprime_position`, `approval_status`), **`careerPipelineService.js:170`** (`career_goal_id`), **`characterGenerator.js:1052`** (`world_character_id`), and **`sceneStudioController.js:894`** / **`propertyRoutes.js:205`** (`canvas_settings`): the same pattern of a real column the model lacks, so the write is silently dropped.
- **`ThumbnailService.js:92/161`**: `Thumbnail` is declared camelCase with `underscored: false`, but production's `thumbnails` is snake_case (`episode_id`, `s3_key`, `thumbnail_type`). Here the service matches production and the model does not. The `findAll` still fails, on `composition_id` and `metadata`. This is a mode 3 fact the drift read did not cover.
- **`EpisodeWardrobe` includes (`wardrobeApprovalController.js` ×4, `wardrobeLibraryController.js:1341`)**: `EpisodeWardrobe.associate()` in the model file declares `as: 'wardrobe'`, but `src/models/index.js` never calls it and defines the alias `wardrobeItem`. `CharacterRelationship.associate()` (`characterA`/`characterB`, used by `memories/engine.js:1668` `loadCharacterRelationships`) is likewise never called.

### 1.2 Raw SQL (step 3)

```
STEP 3 raw SQL: 730 sequelize.query calls (669 literal, 58 template with interpolation, 3 other); 578 had a checkable column reference; 2997 references checked
  hits: 27; uncheckable calls: 152; tables named but not created by the live tree: 22; other .query receivers (not sequelize): 193
```

Uncheckable (152): 56 name a table the live tree doesn't create (`episode_wardrobe`, `outfit_sets`, `template_studio`, `information_schema`, `pg_*`, …); 68 yielded no column reference the extractor trusts (for example, bare select lists); 25 yielded no table; 3 pass SQL through a variable. `pool.query`/`client.query` (193) were not read.

| Call site | Column (09-17 capture) | What hides it |
|---|---|---|
| `src/controllers/episodeController.js:739` | episode_assets.usage_type [present], episode_assets.display_order [present] | catch L780: logged + 5xx/throw |
| `src/routes/episodeOrchestrationRoute.js:217` | episodes.orchestration_data [ABSENT] | catch L227: logged, continues |
| `src/routes/memories/assistant.js:730` | storyteller_chapters.status [ABSENT] | catch L1579: logged, continues |
| `src/routes/sceneSetRoutes.js:2404` | scene_sets.base_still_url [present] | catch L2432: logged + 5xx/throw |
| `src/routes/storyHealth.js:194` | story_threads.title [ABSENT] | catch L201: **silent** |
| `src/routes/storyHealth.js:513` | registry_characters.world [present] | catch L530: **silent** |
| `src/routes/worldStudio.js:487` | registry_characters.sexuality [ABSENT] | no local catch: propagates |
| `src/routes/worldStudio.js:1159` | registry_characters.sexuality [ABSENT] | catch L1271: logged, continues |
| `src/routes/worldStudio.js:1427` | registry_characters.sexuality [ABSENT] | catch L1539: logged, continues |
| `src/routes/worldStudio.js:1566` | registry_characters.sexuality [ABSENT] | catch L1684: logged + 5xx/throw |
| `src/routes/worldStudio.js:1711` | registry_characters.sexuality [ABSENT] | catch L1822: **silent** |
| `src/routes/worldStudio.js:2199` | storyteller_chapters.order_index [ABSENT] | catch L2302: logged + 5xx/throw |
| `src/routes/worldStudio.js:2216` | storyteller_lines.order_index [ABSENT], storyteller_lines.source_type [ABSENT], storyteller_lines.source_ref [ABSENT] | catch L2302: logged + 5xx/throw |
| `src/routes/worldStudio.js:2400` | storyteller_lines.order_index [ABSENT], storyteller_lines.source_type [ABSENT], storyteller_lines.source_ref [ABSENT] | catch L2414: 5xx, not logged |
| `src/services/episodeScriptWriterService.js:211` | world_state_snapshots.show_id [ABSENT] | catch L216: **silent** |
| `src/services/feedScheduler.js:339` | social_profiles.show_id [ABSENT] | catch L358: **silent** |
| `src/services/financialFeedService.js:58` | social_profiles.show_id [ABSENT] | catch L66: **silent** |
| `src/services/financialPressureService.js:207` | character_state_history.state_json [ABSENT], character_state_history.updated_at [ABSENT] | catch L212: logged, continues |
| `src/services/financialTransactionService.js:86` | character_state_history.deleted_at [ABSENT] | catch L96: **silent** |
| `src/services/groundedScriptGeneratorService.js:129` | world_state_snapshots.show_id [ABSENT] | catch L134: **silent** |
| `src/services/phoneContextBuilder.js:79` | characters.deleted_at [ABSENT] | `.catch`: **silent** |

Of the 27 references, 23 name a column absent in production (M). The four that production has (`episode_assets.usage_type`/`display_order`, `scene_sets.base_still_url`, `registry_characters.world`) are mode 2 gaps (no live migration creates them) that work in production. Several of the absent ones sit behind a silent catch whose comment says the table "may not exist". The table exists; the column doesn't. `feedScheduler.js:339` and `financialFeedService.js:58` (`social_profiles.show_id`) mean the arc-bias and show-scoped feed lookups never run (I).

### 1.3 Unresolved (counted, not guessed)

- 30 calls to a model-only method on a receiver the scan can't name (`this.findAll` in class statics, `Model` parameters, `models[name]`).
- 88 of the 1,982 resolved calls (4.4%) had some part the scan couldn't follow: `where` is a non-local value (31), values object is a parameter or a spread of one (30 + 12), `order`/`attributes`/`defaults` built elsewhere (6 + 6 + 6), computed keys (3), options spread (1).
- Not attempted: 954 `create`/`update`/`destroy`/`increment`/`min`/`max` calls on a receiver that isn't a model, mostly instances (`profile.update(…)` ×21, `job.update` ×16, `wardrobeItem.update` ×16, …) and `Math.min`/`Math.max`. Instance `update(values)` drops undeclared keys the same way `Model.update` does. This is the largest blind spot.

---

## 2. Model vs migrations (step 2)

```
STEP 2 model vs migrations: 215 migration files, 967 ops replayed (87 from SQL), 137 tables rebuilt, 0 unresolved ops
  models whose table no live migration creates: 36
  models whose table the live tree only alters (created elsewhere; columns not compared): 3
  paranoid models whose table has no deleted_at column: 10
  declared columns no migration creates: 49
  migration columns the model does not declare (report only): 106
```

### 2.1 Paranoid models whose table has no `deleted_at` (the CharacterState shape)

The global `define: { paranoid: true }` in `src/config/sequelize.js` makes every model that doesn't set `paranoid: false` (and has timestamps) add `WHERE "deleted_at" IS NULL` to every read and list `deleted_at` in every `INSERT … RETURNING`.

| Model (table) | 09-17 capture | Callers (M) and what hides them | Visible in data |
|---|---|---|---|
| **CharacterTherapyProfile** (`character_therapy_profiles`) | **`deleted_at` ABSENT** | `routes/therapy.js` `upsert` L583 (catch L621: logs, **returns `{ ok: true }`**) and `findOne` L640 (catch L646: logs, **returns `{}`**); `emotionalImpact.js:161` `findOrCreate` (logs, returns `{ skipped }`); `thresholdDetection.js:168` (propagates), `:257` (logs, continues); `memories/engine.js:2165` `loadTherapyProfile` (logs, `null`); `storyEvaluationRoutes.js:568` (logs, `''`); `characterAI.js:128` (**silent**) | No therapy profile row is ever written through the model (I) |
| **CharacterArc** (`character_arcs`) | **ABSENT** | `arcTrackingService.js:55` (no local catch), `:117` (`buildArcContext`: logs "table may not exist", continues) | No `character_arcs` rows created by `arcTrackingService` (I) |
| **WardrobeContentAssignment** (`wardrobe_content_assignments`) | **ABSENT** | `memories/interview.js:252` (**silent**, "never interrupt writing"); `wardrobeLibrary.js:89/380/443` (log + 500) | Assign-content returns 500 (I) |
| **HairLibrary** (`hair_library`) | **ABSENT** | `hairLibraryRoutes.js` GET/POST/seed (log + 500) | Loud |
| **MakeupLibrary** (`makeup_library`) | **ABSENT** | `makeupLibraryRoutes.js` GET/POST/seed (log + 500) | Loud |
| **UniverseCharacter** (`universe_characters`) | **ABSENT** | `characterRegistry.js:1100/1109` promote-to-canon (log + 500) | Loud |
| SceneLibrary (`scene_library`) | present | — | Works in production; a migration-built DB fails |
| EpisodeScene (`episode_scenes`) | present | — | Same |
| EditMap (`edit_maps`) | no table | — | Table absent: a different failure |
| CharacterProfile (`character_profiles`) | no table | — | Same |

The first six are MEASURED absent in the capture, and the callers are MEASURED. That each call fails in production is INFERRED from the capture plus the generated SQL above, the same inference the drift read makes for `character_state`. The register already counts this population on a migration-built database: `docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md` / XK-1 (12 as of `803b0265`). This static read finds 12 before #1836 and 10 after #1836/#1845. Whether they are the same 12 is not checked.

### 2.2 Declared columns no live migration creates (49)

Of the 49, **14 are also absent in production**, so every read without an `attributes` list, and every `create`, fails on these models (M for absence; I for the failure):
- `ActivityLog` (`activity_logs`): `action_type`, `ip_address`, `new_values`, `old_values`, `user_agent`. This is FD-66 Instance A (`GET /api/v1/audit-logs` 500), already in the register.
- `Thumbnail` (`thumbnails`): `isPrimary`, `platformUploadStatus`, `platformUrls`, `publishStatus`, `publishedAt`, `publishedBy`, `unpublishedAt`. FD-66 names `POST /api/v1/thumbnails/:id/publish`. The whole model is camelCase against a snake_case table (§1.1).
- `HairLibrary` / `MakeupLibrary`: `is_just_a_woman_style`. Production has `is_justAWoman_style`, a quoted camelCase spelling, so this is a naming mismatch, not a missing column.

The other 35 are present in production, created outside the live tree: `Asset` ×4, `EpisodeAsset` ×4, `MetadataStorage` ×7, `SceneAngle` ×7, `StorytellerBook` ×6, `StorytellerChapter` ×2, `RegistryCharacter.world`, `SceneSet.base_still_url`. They work in production; a database built by `npm run migrate:up` would not have them (M for both halves).

### 2.3 Tables no live migration creates (36), and three only altered

All from the 09-17 capture. 20 have no table in production either: `FileStorages`, `markers`, `beats`, `character_clips`, `audio_clips`, `ai_edit_plans`, `editing_decisions`, `ai_revisions`, `video_processing_jobs`, `ai_training_data`, `scene_layer_configuration`, `layer_presets`, `layers`, `show_configs`, `script_templates`, `script_learning_profiles`, `script_edit_history`, `script_suggestions`, `brain_documents`, `asset_asset_labels`. The other 16 exist in production from another tree or from `sync()`: `processing_queue` (the live tree creates `processing_queues`, plural: a naming mismatch), `thumbnail_templates`, `composition_assets`, `composition_outputs`, `scene_templates`, `asset_labels`, `show_assets`, `episode_wardrobe`, `outfit_sets`, `outfit_set_items`, `wardrobe_usage_history`, `wardrobe_library_references`, `timeline_placements`, `continuity_timelines`, `continuity_characters`, `continuity_beat_characters`. The live tree only alters `wardrobe_library` and `continuity_beats` (in production) and `layer_assets` (not in production). This matches `PROJECT_CONTEXT.md` §4.5 ("40 model tables are not created by `src/migrations`") and FD-66's 38 no-table models in size. The four-count difference is not reconciled here.

### 2.4 Migration columns the model doesn't declare (106, report only)

These are harmless unless code names them. When code does, they show up as step 1's "write drops a value for a column production has" (`world_events.theme`, `storyteller_books.current_arc_stage`, …). The full list is in `--json` output.

---

## 3. Model vs the real database

Covered by `docs/MIGRATION_DRIFT_READ.md` and cited, not redone: `assets.role_key` is declared in `Asset`, created by the pending `20260902000001-add-role-key-to-assets.js`, and absent in production (MEASURED 09-17, ATTESTED 09-24). Every Asset read without `attributes` and every create/update fails (§6 of that read, and §3 for the unrecorded `asset_roles`). The same read covers `character_state.deleted_at` (fixed since by #1836).

This read adds, from the capture comparison in §1 and §2 (M): the six paranoid models in §2.1; the 14 columns in §2.2; `Thumbnail`'s casing; and `social_profiles.show_id`, `storyteller_lines.order_index`/`source_type`/`source_ref`, `registry_characters.sexuality` and `episodes.orchestration_data` named by raw SQL (§1.2).

---

## 4. Mocks (step 4)

```
STEP 4 mocks: 239 test files, 119 fake models, 220 rows, 650 keys checked, 13 where objects/reads
  undeclared keys: 69; out-of-enum values: 9; unresolved mock returns: 15
```

| Test file | Model: undeclared keys (occurrences) | The mode 1 hit it mirrors |
|---|---|---|
| `tests/unit/services/eventAutomationService.guestSelection.test.js:144` (`rel()`) | SocialProfileRelationship: `profile_a_id`, `profile_b_id` | `eventAutomationService.js:393` (#1860) |
| `tests/unit/services/feedEventPipelineService.scheduleOpportunityAsEvent.test.js:153` | SocialProfileRelationship: `profile_a_id`, `profile_b_id` | same |
| `tests/unit/routes/manuscriptCascadeWhitelist.test.js:20` | StorytellerLine: `story_id`, `content` | `novelIntelligenceRoutes.js:277` (`story_id`, `order`: fails in production) |
| `tests/unit/controllers/episode.test.js` | Episode: `showName` ×6, `episodeTitle` ×5, `processingStatus` ×3, `seasonNumber` ×2, `episodeNumber` ×2 | none in `episodeController` (stale fixture); the same names are queried by `metadataController`/`processingController`/`thumbnailController` |
| `tests/unit/controllers/processing.test.js` | Episode: `episodeTitle` ×5 | `processingController.js:24/68` |
| `tests/unit/controllers/metadata.test.js` | MetadataStorage: `metadataType` ×5, `content` ×2 | none (stale fixture); `metadataController.js:24` fails on `createdAt` and the Episode camelCase names instead |
| `tests/unit/controllers/jobController.test.js` | ProcessingQueue: `progress` ×8, `updated_at` ×6, `file_id` ×4, `error` ×4, `data` ×4 | `jobController.js:53` (`file_id`, `progress`, `data` dropped on create) |
| `tests/unit/controllers/thumbnail.test.js` | Thumbnail: `url` ×6 | `ThumbnailService.js:92` names `url` too; `url` exists in production and the model lacks it (§1.1) |
| `tests/unit/routes/shows-episode-count.test.js:31` | Episode: `episodeCount` | **False positive**: an aggregate alias (`[fn('COUNT', col('id')), 'episodeCount']` in `routes/shows.js`) |

Out-of-enum values (M; the value, then the declared ENUM):
- `eventAutomationService.guestSelection.test.js:144` and `feedEventPipelineService.scheduleOpportunityAsEvent.test.js:153`: `SocialProfileRelationship.relationship_type = 'friend'`, not in `collab|rival|couple|ex|baby_daddy|baby_mama|bestie|mentor|copycat|shade|situationship|family|management|feud|secret_link`.
- `fileController.test.js:424/433`: `FileStorage.indexing_status = 'completed'` (`pending|indexed|failed`); `:430` `file_type = 'subtitle'` (`video|image|script`).
- `jobController.test.js:251`: `ProcessingQueue.job_type = 'indexing'`; `:635` `status = 'cancelled'` (`pending|processing|completed|failed`).
- `thumbnail.test.js:37/217`: `Thumbnail.thumbnailType = 'secondary'` (`primary|cover|poster|frame`).

Unresolved (15): rows returned from a variable the scan can't follow to a literal (`profiles[id]`, `JSON.parse(JSON.stringify(row))`, `.filter(...)` over a local array, destructured results).

Why this mode matters: 6 of the 9 true-positive files hand the code under test the very undeclared names a mode 1 hit uses (the two #1860 files, `manuscriptCascadeWhitelist`, `processing`, `jobController`, `thumbnail`). The test passes over a query that fails in production. #1860 survived six months this way. `episode.test.js` and `metadata.test.js` carry undeclared names (camelCase `Episode` fields, `metadataType`, `content`) that no mode 1 hit in the controller they test uses. They are stale fixtures, not mirrors.

---

## 5. Standing check (step 5)

| Step | Evidence | Verdict |
|---|---|---|
| **1. Query vs model** | 200 hits, **0 false positives** as a check against the model: every receiver was hand-checked (46 distinct receiver → model pairs, all direct model references or include targets); no hit is an aggregate alias or a nested reference; the names are absent from the loaded `rawAttributes` by construction. 22 of the 200 work in production because the table has the column; those are still true disagreements with the model, and the fix is to declare them. Unresolved: 4.4% of resolved calls partly, plus 30 unknown receivers. Runtime about 2.8 s with no database. | **Ratchet: yes.** `--baseline <file>` keys each hit on `file`, `Model.method`, clause and name (no line numbers, so an edit elsewhere doesn't churn it) and fails only on a key the baseline doesn't list, like `scripts/silent-catches.baseline`. Demonstrated below. The blind spot to state in the lint's header is instance `update()`. The dependency is transitive (via Jest), so a CI job should name `@babel/parser` in `devDependencies` first. |
| **2. Model vs migrations** | 0 unresolved ops across 967; the positive control found both known instances. Its "missing" list is exact against the live tree, but the live tree is not production (35 of 49 "missing" columns exist in production). | **Ratchet: yes, for new models and columns.** A new model or column that no live migration creates is what #1836/#1845 fixed after the fact. Not built here: the baseline mode currently covers step 1 only. |
| **3. Raw SQL** | Regex extraction over SQL: 152 of 730 calls uncheckable (21%), 68 of them because no column was extracted. No false positive among the 27 on inspection, but recall is unmeasured. | **One-off read.** Too partial to gate on. |
| **4. Mocks** | 1 false positive in 69 (1.4%); binding depends on the naming of fake-model keys and feed parameters; 15 unresolved. | **One-off read.** Better to make fakes schema-checked at construction (§6.4). |

Ratchet demonstration (scratch baseline; nothing committed):

```
$ node scripts/check-schema-agreement.js --baseline <scratch>/s1.baseline --update-baseline | tail -2
baseline written: <scratch>/s1.baseline (186 entries)
$ node scripts/check-schema-agreement.js --baseline <scratch>/s1.baseline | tail -1
baseline <scratch>/s1.baseline: 186 entries, 0 new, 0 no longer occur
$ node scripts/check-schema-agreement.js --baseline <scratch>/s1-minus1.baseline | tail -2      # the profile_a_id entry removed
baseline <scratch>/s1-minus1.baseline: 185 entries, 1 new, 0 no longer occur
  NEW src/services/eventAutomationService.js	SocialProfileRelationship.findAll	where	profile_a_id
EXIT: 1
```

Nothing is wired into CI in this PR. No baseline file is committed; creating one is the wiring decision.

---

## 6. Proposed fixes, by failure mode (nothing fixed here)

1. **Query vs model.**
   - Reads that fail in production (40 sites): rename to the declared attribute where one exists (`profile_a_id` → `source_profile_id` (#1860); `RegistryCharacter.name` → `display_name`; `StorytellerLine.content` → `text`; `line_order`/`order_index`/`order` → `sort_order`; `Episode` camelCase → the declared snake_case). Otherwise drop the clause.
   - Includes: use `wardrobeItem`, or call `EpisodeWardrobe.associate`/`CharacterRelationship.associate` from `index.js`. One choice, not both.
   - Writes that drop into existing columns (7 sites): declare the columns on the model (`WorldEvent` invitation fields, `StorytellerBook.current_arc_stage`/`arc_stage_scores`, `ThumbnailComposition` ×3, `Opportunity.career_goal_id`, `RegistryCharacter.world_character_id`, `SceneSet.canvas_settings`).
   - Writes of keys nothing stores (24 sites): delete the keys, or decide they need a column.
   - Then add the step 1 ratchet with a baseline.
2. **Model vs migrations.**
   - The six paranoid models absent `deleted_at` in production get either `paranoid: false` (the #1836/#1845 fix) or a migration adding `deleted_at`. Which one is a product call per model; `CharacterTherapyProfile` is the most-used.
   - `ActivityLog`/`Thumbnail` follow FD-66's disposition.
   - `HairLibrary`/`MakeupLibrary.is_just_a_woman_style` get `field: 'is_justAWoman_style'`.
   - `ProcessingQueue` gets `tableName` reconciled with `processing_queues`.
   - Longer term, a step 2 ratchet so a new model can't merge without a migration that creates its table and columns.
3. **Model vs the real database.** As the drift read proposes (its §7 Q3). The confirming read for this read's additions is below; it is for Evoni to run.
4. **Mocks.** Build fake rows through a helper that checks keys against `Model.rawAttributes` and ENUM values (for example `makeRow(SocialProfileRelationship, {...})`, which throws on an undeclared key). Fix the nine enum values. The 21 undeclared-key triples go away once their mode 1 query is fixed and the mock is updated to match.

Read-only SQL to confirm the INFERRED production failures (for Evoni; not run by this session):

```sql
SELECT table_name, column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND column_name = 'deleted_at'
   AND table_name IN ('character_therapy_profiles','character_arcs','wardrobe_content_assignments',
                      'hair_library','makeup_library','universe_characters');           -- expect 0 rows
SELECT count(*) FILTER (WHERE theme IS NULL) AS theme_null, count(*) AS auto_events
  FROM world_events WHERE canon_consequences->'automation'->>'theme' IS NOT NULL;      -- §1.1 worldEvents.js:2607
SELECT count(*) FROM character_therapy_profiles;                                         -- §2.1
```

---

## 7. Positive control

At the basis (`8b90c0de0`), step 1 and step 4 (from the run with `--capture`):

```
  HIT src/services/eventAutomationService.js:396  SocialProfileRelationship.findAll  where  profile_a_id  [cap: ABSENT]
  HIT src/services/eventAutomationService.js:397  SocialProfileRelationship.findAll  where  profile_b_id  [cap: ABSENT]
  HIT tests/unit/services/eventAutomationService.guestSelection.test.js:144  SocialProfileRelationship.profile_a_id  (SocialProfileRelationship mock.findAll via param relationships via rel())
  HIT tests/unit/services/eventAutomationService.guestSelection.test.js:144  SocialProfileRelationship.profile_b_id  (SocialProfileRelationship mock.findAll via param relationships via rel())
  HIT tests/unit/services/feedEventPipelineService.scheduleOpportunityAsEvent.test.js:153  SocialProfileRelationship.profile_a_id  (SocialProfileRelationship mock.findAll via param relationships)
  HIT tests/unit/services/feedEventPipelineService.scheduleOpportunityAsEvent.test.js:153  SocialProfileRelationship.profile_b_id  (SocialProfileRelationship mock.findAll via param relationships)
  ENUM tests/unit/services/eventAutomationService.guestSelection.test.js:144  SocialProfileRelationship.relationship_type = 'friend' (value at line 144; SocialProfileRelationship mock.findAll via param relationships via rel())
  ENUM tests/unit/services/feedEventPipelineService.scheduleOpportunityAsEvent.test.js:153  SocialProfileRelationship.relationship_type = 'friend' (value at line 153; SocialProfileRelationship mock.findAll via param relationships)
```

Step 2 before #1836/#1845: `git worktree add --detach <scratch>/pre1836 eba35e985^` (= `f9c4dea67`, #1835; `git merge-base --is-ancestor eba35e985 13c76dc96` is true, so this checkout predates both), `node_modules` symlinked, then `--root <scratch>/pre1836 --capture …`:

```
STEP 2 model vs migrations: 215 migration files, 967 ops replayed (87 from SQL), 137 tables rebuilt, 0 unresolved ops
  paranoid models whose table has no deleted_at column: 12
  PARANOID StoryTaskArc (story_task_arcs) lacks deleted_at  [cap: ABSENT]
  PARANOID CharacterState (character_state) lacks deleted_at  [cap: ABSENT]
```

At the basis the same list has 10 entries and neither model, which is right: both now set `paranoid: false`.

`role_key`: by citation of `docs/MIGRATION_DRIFT_READ.md` §6. Step 2 does not list `Asset.role_key` as missing, because the live tree has `20260902000001-add-role-key-to-assets.js`. That is the drift read's point: the migration exists and never ran. The capture confirms it: `assets.role_key` is absent from the 09-17 capture.

No known instance was missed, so no step's "nothing found" is unproven by this control. The control does not measure recall beyond the known instances. Step 3's recall in particular is unmeasured (§5).
