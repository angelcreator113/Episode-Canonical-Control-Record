# F-Reg-2 — Scoping: `registry_characters` write contention

*Standalone note. Measurement only. Opens F-Reg-2. Mints nothing, rules nothing, closes nothing, fixes nothing.*

| | |
|---|---|
| **Basis** | `origin/main` at `b470a47c53d0d6754d3e2360abfd687056b0f499` (#2097), 2026-09-27. The writer census was first run at `03b9276c` (#2094) and re-run at this basis with identical output (H1). |
| **Standing** | **MEASURED**: a command and its raw output, reproducible from a clone. **ATTESTED**: Evoni's own account of production, as a filed record carries it; cited, never upgraded. **INFERRED**, marked where used. |
| **Why now** | `F-Ward-1_Fix_Plan_v1.1.md` §5 (RULED, 2026-09-27): "The locked sequence moves to F-Reg-2." F-Reg-2's first step is not ruled. |
| **Task** | #2096 |

## Purpose

F-Reg-2 has had no document of its own. This note sets out three things, each with its source, so Evoni can rule F-Reg-2's first step:
- what the register has said F-Reg-2 covers;
- what already bears on it;
- what remains.

It does not reconcile differing definitions. It lists them side by side.

## H1 — Basis

```
$ git fetch origin --prune
$ git log -1 --format='%H %ad %s' --date=short origin/main
b470a47c53d0d6754d3e2360abfd687056b0f499 2026-09-27 docs(context): Phase B and F-Ward-1 complete; sequence at F-Reg-2 [skip-automerge] (#2097)
$ git diff --name-only 03b9276c b470a47c
PROJECT_CONTEXT.md
$ ls docs/audit | grep -c '^F-Reg-2'
0
```

MEASURED. Nothing under `src/` changed between the census's first run and this basis. No `F-Reg-2*` document exists before this one.

---

## §1. What the register says F-Reg-2 covers — MEASURED (quoted)

**D1 — the keystone, as the audit defined it.** `Prime_Studios_Audit_Handoff_v8.md:180–185`:

> **F-Reg-2** (architectural keystone, v6) --- registry_characters write-contention without locking. 8+ writers, no transactions, no row-level locks. v7 added Pattern 41 sub-form on character_state (F-Stats-2). v8 confirms Pattern 41 instances on career_goals (F-CP-4) and on episodeCompletionService's three-INSERT coin pipeline (F-EpComp-7). Four confirmed instances.

**D2 — the boundary it measures.** `Prime_Studios_Audit_Handoff_v8.md:254–256`:

> **F-Reg-2** measures it at the concurrency boundary --- multiple writers share rows because no orchestration consumer ever coordinated them.

**D3 — the keystone list.** `Prime_Studios_Audit_Handoff_v8.md:426–430`:

> **F-Reg-2 (v6 KEYSTONE) --- registry_characters write-contention without locking.** Pattern 41 master. Four confirmed instances after v8: registry_characters, character_state auto-seed (F-Stats-2), career_goals (F-CP-4), episodeCompletionService coin INSERTs (F-EpComp-7).

**D4 — Pattern 41.** `Prime_Studios_Audit_Handoff_v8.md:592–593`: "Pattern 41 (write-contention without locking) is the F-Reg-2 keystone master." The pattern table, `:2856–2862`: "**Pattern 41** (write-contention without locking) | 4 instances | F-Reg-2 keystone --- registry_characters, character_state, career_goals, episodeCompletion coin INSERTs".

**D5 — the family members, at their findings.**
- F-Stats-2, `:807–809`: "`evaluation.js:71--83` (`getOrCreateCharacterState`) | SELECT-then-INSERT race produces duplicate rows under WorldAdmin parallel-load. Pattern 44 canonical instance. F-Reg-2 keystone family."
- F-Arc-4, `:1040–1044`: "Phase advance forcibly demotes active goals to 'failed'. … Concurrent execution causes silent goal un-updates. F-Reg-2 keystone --- third confirmed instance. CZ-20."
- F-EpComp-7, `:1868–1872`: "three separate INSERT INTO financial_transactions, each in its own try/catch, all silent-fail. No transaction wraps the three INSERTs. Pattern 41 sub-form --- F-Reg-2 keystone family fourth instance."
- CZ-8, `:2400`: "F-Reg-2 keystone instance count." CZ-20, `:2404–2405`: "careerPipelineService and arcProgressionService share career_goals with no coordination. F-Reg-2 keystone family instance."
- The v9 handoff (`Prime_Studios_Audit_Handoff_v9.docx`) repeats these rows (`:437`, `:557`, `:882`, `:1136`, `:1140`).

**D6 — the fix sequence.** `Prime_Studios_Audit_Handoff_v8.md:2681`: "5. F-Reg-2 (write-contention fixes)".

**D7 — the living summary.** `PROJECT_CONTEXT.md` §6.1 (`:318`): "Registry write contention (`registry_characters`) | **Current in the locked sequence** … Its first step is not ruled." §10 item 31 (`:630`) suggests this scoping read.

**D8 — XK-2's extent.** `Cross_Keystone_Register.md:273–274` (XK-2, row scope): "F-Ward-1, F-Ward-3, F-Reg-2, F-Franchise-1 and F-Sec-3 surfaces are unexamined." No XK entry names `registry_characters`:

```
$ grep -c "registry_characters" docs/audit/Cross_Keystone_Register.md docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md docs/audit/Session_PE_Roster.md
docs/audit/Cross_Keystone_Register.md:0
docs/audit/Paranoid_Exposure_Inventory_2026-08-07.md:0
docs/audit/Session_PE_Roster.md:0
```

**Other mentions.** `grep -rl "F-Reg-2" docs/audit` returns 44 files at this basis. Apart from D1–D8 they name F-Reg-2 as a place in the sequence, with no further definition.

### §1.1 The definitions side by side (not reconciled)

| Reading | Scope | Source |
|---|---|---|
| **Narrow** | `registry_characters` writers only | D1's first sentence; D7's row title |
| **Family** | Pattern 41 across four tables: `registry_characters`, `character_state`, `career_goals`, `financial_transactions` | D1's remainder, D3, D4 |
| **Boundary** | Any shared-row writing that no orchestrator coordinates | D2 |

**Where the register differs from itself — MEASURED:**
- **The third instance.** D1 names F-CP-4 (career_goals). D5 names F-Arc-4 at `:1043` as "third confirmed instance". CZ-20 cites both.
- **F-Stats-2's pattern.** Its finding row says "Pattern 44 canonical instance" (`:808`). D1 and D3 count it as a Pattern 41 sub-form.
- **"8+ writers, no transactions."** At this basis the census (§3) finds 75 write sites in 21 files. Two of them run in a transaction.

---

## §2. What already bears on it — MEASURED, with ATTESTED production accounts

**PR #2071 (`073e57f8`, F-Stats-1 Fix Plan v1.62 §65.6-F): the world-character delete is one transaction.** `DELETE /world/characters/:id` now runs its deletes, `registry_characters` included, inside `sequelize.transaction`:

```
$ git show b470a47c:src/routes/worldStudio.js | grep -n "sequelize.transaction(async (transaction)\|DELETE FROM registry_characters"
1843:    await sequelize.transaction(async (transaction) => {
1855:      await del(`DELETE FROM registry_characters WHERE world_character_id = :id`, { id: req.params.id });
```

Deploy BB took it to production (ATTESTED, `F-Deploy-1_Deploy_2026-09-27_BB.md`). It makes the delete all-or-nothing. It takes no lock, and it was ruled for atomicity, not contention.

**The story write-back: a transaction, and a lock on the story row.** It predates the audit: `git log -S"char.save({ transaction })"` over the file names `9ac19f536` (2026-03-13) first. `POST /write-back` in `storyEvaluationRoutes.js` locks the `StorytellerStory` row, then writes registry fields inside the same transaction:

```
$ git show b470a47c:src/routes/storyEvaluationRoutes.js | grep -n "lock: true\|char.save({ transaction })"
1531:    const story = await db.StorytellerStory.findByPk(story_id, { transaction, lock: true });
1594:          await char.save({ transaction });
```

INFERRED: two write-backs of the *same story* are serialised by the story lock. Nothing serialises a write-back against any other writer of the same `registry_characters` row.

**No other fix touches `registry_characters` writes.** `git log --first-parent origin/main` shows no commit subject naming registry write contention. No XK entry, PE entry or deploy record names the table (§1, D8).

**The family members, at this basis — MEASURED, not assessed:**
- F-Stats-2: `getOrCreateCharacterState` is now at `src/routes/evaluation.js:45`. It still does `findAll … limit 1`, then `CharacterState.create` with no transaction (`:48–70`).
- F-EpComp-7: `src/services/episodeCompletionService.js` still issues three separate `INSERT INTO financial_transactions` (`:375`, `:391`, `:410`).
- F-CP-4 and F-Arc-4 (career_goals): not re-read here.

---

## §3. The code — MEASURED census, INFERRED risk

### §3.1 How the census was taken

A scratch probe (not committed) parsed every `.js` file under `src/` except `src/migrations/` with acorn at the basis. It reports three kinds of site:
- static `RegistryCharacter.{create,bulkCreate,update,upsert,destroy,findOrCreate,increment,decrement,restore}` calls;
- instance `.update/.save/.destroy/.increment/.decrement/.restore` on a variable assigned from a `RegistryCharacter` loader;
- raw SQL literals `INSERT INTO`/`UPDATE`/`DELETE FROM registry_characters`.

For each site it reports:
- **tx=yes** when the call sits inside a `.transaction(` callback or its own text names `transaction`;
- **lock=yes** when its text has `lock:` or `FOR UPDATE`.

```
$ NODE_PATH=$PWD/node_modules node regprobe.js b470a47c > reg-b470.txt
$ diff reg.txt reg-b470.txt && echo identical     # reg.txt: the run at 03b9276c
identical
$ grep -c "tx=yes" reg-b470.txt; grep -c "lock=yes" reg-b470.txt
2
0
$ tail -1 reg-b470.txt
--- sites=75
```

**Two checks on what the probe misses:**
- **Instance writes it could have missed.** A grep for `.save/.update/.destroy/.increment` on any `*char*`/`rc` identifier, in files that mention the model or the table, finds four sites the probe did not list. All four write other models: `CharacterEntanglement.update` (`entanglementRoutes.js:343`, `rippleEngine.js:60`, `:196`) and `CharacterRelationship.update` (`tierFeatures.js:219`).
- **Writers outside `src/`.** The only file under the root `scripts/` naming the table is `scripts/reseed-all.js`, and it only counts rows (`:268`).

**Locking and versioning anywhere in `src/`:**

```
$ grep -rnE "isolationLevel|ISOLATION|FOR UPDATE|lock: *(true|t\.|transaction\.LOCK|Transaction\.LOCK)|optimisticLock|version: *true" src --include=*.js | grep -v migrations
src/workers/sceneGenerationWorker.js:44:      lock: t.LOCK.UPDATE,
src/routes/storyEvaluationRoutes.js:1531:    const story = await db.StorytellerStory.findByPk(story_id, { transaction, lock: true });
src/routes/calendarRoutes.js:130:      const marker = await StoryClockMarker.findByPk(req.params.id, { transaction, lock: true });
src/routes/worldEvents.js:812:            `SELECT canon_consequences${expected.present ? ', updated_at' : ''} FROM world_events WHERE id = :eventId AND show_id = :showId FOR UPDATE`,
```

MEASURED. The codebase locks rows in four places, and none of them is a `registry_characters` row. No isolation level is set anywhere, so Postgres's default, READ COMMITTED, applies. The model declares no `version`.

### §3.2 Constraints and indexes

**The migration tree — MEASURED.** `20260220000004-create-character-registry.js` creates the table. `id` is a UUID primary key; `registry_id` is NOT NULL and references `character_registries` ON DELETE CASCADE; `character_key` is NOT NULL. Its indexes:

```
$ git show b470a47c:src/migrations/20260220000004-create-character-registry.js | sed -n 205,207p
    await queryInterface.addIndex('registry_characters', ['registry_id', 'sort_order']);
    await queryInterface.addIndex('registry_characters', ['registry_id', 'character_key'], { unique: true });
    await queryInterface.addIndex('registry_characters', ['status']);
$ git show b470a47c:src/migrations/20260312100000-character-generation-redesign.js | sed -n 256,259p
    await queryInterface.addIndex('registry_characters', ['depth_level']);
    await queryInterface.addIndex('registry_characters', ['social_presence']);
    await queryInterface.addIndex('registry_characters', ['feed_profile_id']);
    await queryInterface.addIndex('registry_characters', ['time_orientation']);
```

`20260302210000-add-world-registry-cross-links.js:45` adds `idx_rc_world_char` on `world_character_id`, if absent. No live migration drops an index on this table. Its `removeIndex` calls sit in `down` functions.

**The one uniqueness guarantee** is `UNIQUE (registry_id, character_key)`. It is a plain index, not a partial one. INFERRED: soft-deleted rows (the model is `paranoid: true`, `src/models/RegistryCharacter.js:647`) still hold their key.

**The model — MEASURED.** `RegistryCharacter` declares no `indexes`, no `version`, and `paranoid: true` (`:644–648`).

**The 2026-09-17 canon capture — MEASURED, capture dated 2026-09-17.** `EvidenceNote_Canon_Schema_Capture_2026-09-17.txt` lists columns only: 201 `registry_characters` rows, no constraints, no indexes. Relevant columns: `character_key` NOT NULL (`:1202`), `registry_id` uuid NOT NULL (`:1342`), `deleted_at` nullable (`:1271`), `updated_at` NOT NULL (`:1370`). It has no column that could serve as a version counter.

```
$ grep -cE "^ ?registry_characters +\|" docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
201
```

**Production's constraints and indexes are not in the repository** (§4, Q1).

### §3.3 Classes (INFERRED)

Each site's class was assigned by reading its enclosing handler at `03b9276c`. A delegated reading pass did the reading, and this session spot-checked it; `src/` is identical at this basis. **Every class is INFERRED**, and none was tested.

- **RMW (27):** the value written is derived from a value read earlier from the same row: an append, a push, a spread merge, a delta, or a fill-if-empty. Two concurrent calls on one row can lose one call's change.
- **BLIND (24):** the value is not derived from the row. Concurrent calls are last-write-wins.
- **CREATE (10) / CHECK-CREATE (6):** a new row, without or with a prior existence check.
  - Where the key is deterministic, the unique index turns a concurrent duplicate into a unique-violation error, not a second row.
  - Where the key embeds `Date.now()`, nothing stops a duplicate.
- **BULK (5):** a multi-row update or delete by a non-PK `WHERE`.
- **DELETE (3).**

**Judgement calls:**
- The fill-if-empty sites (`characterRegistry.js:1057`, `:1398`, `:1805`) and the AI-mediated one (`characterGrowthRoute.js:209`) are counted RMW.
- `worldStudio.js:1712` is BLIND: it loops, but each UPDATE is keyed by `id`.

**Why a transaction alone would not close RMW — INFERRED.** Under READ COMMITTED, a read and a later write in one transaction still let another transaction's committed write land between them. That is why D1 names locking, not transactions alone.

### §3.4 The 75 sites

`tx`/`lock` are MEASURED (§3.1). Class and "at stake" are INFERRED (§3.3).

| # | Site | Write | Route / function | tx | lock | Class | At stake |
|---|---|---|---|---|---|---|---|
| 1 | `characterCrossingRoutes.js:177` | instance `.save` | PUT /:id/confirm-gap | no | no | BLIND | `performing_publicly`, `dimensions_*` |
| 2 | `characterDepthRoutes.js:268` | instance `.update` | PUT /:charId | no | no | BLIND | `de_*` from body |
| 3 | `characterDepthRoutes.js:416` | instance `.update` | POST /:charId/confirm | no | no | BLIND | `de_*` from body |
| 4 | `characterGenerationRoutes.js:141` | instance `.update` | POST /confirm | no | no | RMW | `depth_level` from `{...character, ...proposed}` (`:139`) |
| 5 | `characterGenerationRoutes.js:162` | `create` | POST /confirm | no | no | CREATE | key only if client sends one |
| 6 | `characterGenerationRoutes.js:230` | instance `.update` | POST /confirm-feed | no | no | BLIND | `feed_profile_id`, constants |
| 7 | `characterGenerationRoutes.js:277` | `create` | POST /promote-ghost/:characterId | no | no | CREATE | deterministic key (ghost name) |
| 8 | `characterGenerationRoutes.js:294` | instance `.update` | POST /promote-ghost/:characterId | no | no | RMW | `ghost_characters` array |
| 9 | `characterGenerationRoutes.js:359` | instance `.update` | PATCH /depth/:id | no | no | BLIND | `depth_level` |
| 10 | `characterGenerator.js:1004` | `create` | POST /commit | no | no | CHECK-CREATE | check by name (`:892`); key has `Date.now()` |
| 11 | `characterGenerator.js:1052` | `update` | POST /commit | no | no | BLIND | `world_character_id` |
| 12 | `characterGrowthRoute.js:209` | instance `.update` | POST /character-growth | no | no | RMW | AI-evolved text from current values |
| 13 | `characterGrowthRoute.js:343` | instance `.update` | POST /character-growth/:id/review | no | no | BLIND | logged new value |
| 14 | `characterGrowthRoute.js:346` | instance `.update` | POST /character-growth/:id/review | no | no | BLIND | body value |
| 15 | `characterRegistry.js:114` | `bulkCreate` | POST /registries | no | no | CREATE | new registry; body keys or `char-${idx}` |
| 16 | `characterRegistry.js:235` | `create` | POST /registries/:id/characters | no | no | CREATE | key body or `char-${Date.now()}`; `sort_order` from `count()` |
| 17 | `characterRegistry.js:309` | instance `.update` | POST /registries/:id/characters | no | no | BLIND | `feed_profile_id` |
| 18 | `characterRegistry.js:481` | instance `.save` | POST /characters/:id/plot-threads | no | no | RMW | `extra_fields.plot_threads` push |
| 19 | `characterRegistry.js:513` | instance `.save` | PUT /characters/:id/plot-threads/:threadId | no | no | RMW | `extra_fields.plot_threads` edit |
| 20 | `characterRegistry.js:537` | instance `.save` | DELETE /characters/:id/plot-threads/:threadId | no | no | RMW | `extra_fields.plot_threads` filter |
| 21 | `characterRegistry.js:656` | instance `.save` | PUT /characters/:id | no | no | BLIND | any allowed column, whole value |
| 22 | `characterRegistry.js:674` | instance `.destroy` | DELETE /characters/:id | no | no | DELETE | soft |
| 23 | `characterRegistry.js:697` | `destroy` | POST /characters/bulk-delete | no | no | BULK | soft, `id IN` |
| 24 | `characterRegistry.js:723` | `update` | POST /characters/bulk-status | no | no | BULK | `status` |
| 25 | `characterRegistry.js:750` | `update` | POST /characters/bulk-move | no | no | BULK | `registry_id` |
| 26 | `characterRegistry.js:787` | `create` | POST /characters/:id/clone | no | no | CREATE | key `-copy-${Date.now()}` |
| 27 | `characterRegistry.js:810` | instance `.save` | POST /characters/:id/select-name | no | no | BLIND | names |
| 28 | `characterRegistry.js:837` | instance `.save` | POST /characters/:id/set-status | no | no | BLIND | `status` |
| 29 | `characterRegistry.js:978` | `findOrCreate` | POST /registries/:id/seed-book1 | no | no | CHECK-CREATE | fixed seed keys |
| 30 | `characterRegistry.js:1057` | `update` | POST /registries/:id/backfill-sections | no | no | RMW | fill-if-null JSONB sections |
| 31 | `characterRegistry.js:1182` | instance `.save` | POST /characters/:id/portrait | no | no | BLIND | `portrait_url` |
| 32 | `characterRegistry.js:1208` | instance `.save` | DELETE /characters/:id/portrait | no | no | BLIND | `portrait_url` |
| 33 | `characterRegistry.js:1398` | instance `.save` | POST /characters/:id/backfill-sections | no | no | RMW | fill-if-empty, after an AI call |
| 34 | `characterRegistry.js:1415` | instance `.save` | POST /characters/:id/backfill-sections | no | no | RMW | `relationships_map` |
| 35 | `characterRegistry.js:1441` | instance `.save` | POST /characters/:id/backfill-sections | no | no | RMW | `extra_fields`, across an AI call |
| 36 | `characterRegistry.js:1698` | instance `.save` | POST /characters/:id/generate-section | no | no | RMW | `extra_fields` (dilemma, plot_threads) |
| 37 | `characterRegistry.js:1805` | `update` | POST /registries/:registryId/backfill-all | no | no | RMW | fill-if-empty, after an AI call |
| 38 | `characterRegistry.js:1822` | `update` | POST /registries/:registryId/backfill-all | no | no | RMW | `relationships_map` |
| 39 | `characterRegistry.js:1847` | `update` | POST /registries/:registryId/backfill-all | no | no | RMW | `extra_fields`, across an AI call |
| 40 | `characterRegistry.js:2129` | instance `.save` | POST /characters/:id/deep-profile/accept | no | no | RMW | `deep_profile` merge and append |
| 41 | `characterRegistry.js:2218` | instance `.save` | POST /characters/bulk-deep-profile | no | no | RMW | `deep_profile`, across an AI call |
| 42 | `consciousness.js:345` | instance `.update` | POST /save | no | no | RMW | `writer_notes` as a JSON blob |
| 43 | `consciousness.js:464` | instance `.update` | POST /dilemma-triggers | no | no | RMW | `writer_notes` as a JSON blob |
| 44 | `memories/assistant.js:665` | SQL UPDATE | function executeAssistantAction | no | no | DELETE | soft, via `deleted_at` |
| 45 | `memories/assistant.js:689` | SQL UPDATE | function executeAssistantAction | no | no | BLIND | `status` |
| 46 | `memories/core.js:421` | instance `.update` | POST /memories/:memoryId/confirm | no | no | RMW | `extra_fields.memories` push |
| 47 | `memories/engine.js:915` | `create` | POST /story-engine-add-character | no | no | CHECK-CREATE | deterministic slug, same scope |
| 48 | `memories/engine.js:4550` | `create` | POST /generate-story | no | no | CHECK-CREATE | check by key across all registries |
| 49 | `memories/engine.js:5478` | instance `.update` | POST /story-engine-update-registry | no | no | RMW | `relationships_map`, `evolution_tracking`, `personality_matrix` |
| 50 | `memories/interview.js:696` | instance `.save` | POST /character-interview-save-progress | no | no | RMW | `extra_fields` spread |
| 51 | `memories/interview.js:1077` | `create` | POST /character-interview-create-character | no | no | CREATE | deterministic slug, no check |
| 52 | `memories/stories.js:935` | `update` | POST /character-dilemma | no | no | BLIND | `belief_pressured`, `writer_notes` |
| 53 | `onboarding.js:284` | `create` | POST /confirm | no | no | CREATE | no key passed (§3.5) |
| 54 | `onboarding.js:332` | `create` | POST /confirm | no | no | CREATE | no key passed (§3.5) |
| 55 | `press.js:400` | `create` | POST /seed-characters | no | no | CHECK-CREATE | deterministic slug, same scope |
| 56 | `socialProfileRoutes.js:1688` | `create` | POST /:id/cross | no | no | CREATE | key from handle |
| 57 | `storyEvaluationRoutes.js:1594` | instance `.save` | POST /write-back | **yes** | no | BLIND | one whitelisted field |
| 58 | `therapy.js:805` | instance `.update` | POST /dilemma-profile | no | no | BLIND | therapy fields, `writer_notes` |
| 59 | `worldStudio.js:488` | SQL INSERT | function syncToRegistry | no | no | CREATE | key `slug + id[0:8]` |
| 60 | `worldStudio.js:860` | SQL UPDATE | function backfillRelationshipsMap | no | no | RMW | `relationships_map` union |
| 61 | `worldStudio.js:1160` | SQL UPDATE | PUT /world/characters/:id | no | no | BLIND | ~30 columns incl. whole `extra_fields` |
| 62 | `worldStudio.js:1287` | SQL UPDATE | POST /world/characters/:id/activate | no | no | BULK | `status` by `world_character_id` |
| 63 | `worldStudio.js:1300` | SQL UPDATE | POST /world/characters/:id/archive | no | no | BULK | `status` by `world_character_id` |
| 64 | `worldStudio.js:1428` | SQL UPDATE | POST /world/characters/:id/deepen | no | no | BLIND | ~30 columns |
| 65 | `worldStudio.js:1567` | SQL UPDATE | POST /world/characters/:id/re-sync | no | no | BLIND | ~30 columns |
| 66 | `worldStudio.js:1712` | SQL UPDATE | POST /world/characters/bulk-re-sync | no | no | BLIND | ~30 columns, per row |
| 67 | `worldStudio.js:1855` | SQL DELETE | DELETE /world/characters/:id | **yes** | no | DELETE | **hard** delete (#2071) |
| 68 | `scripts/update-character-profiles.js:188` | instance `.update` | function run | no | no | BLIND | script constants |
| 69 | `scripts/update-character-profiles.js:193` | `create` | function run | no | no | CHECK-CREATE | check by `display_name` |
| 70 | `services/registrySync.js:87` | `update` | (therapy close) | no | no | RMW | `writer_notes` append, `wound_depth + 1` |
| 71 | `services/registrySync.js:159` | `update` | (memory confirmed) | no | no | RMW | `writer_notes` append |
| 72 | `services/registrySync.js:255` | `update` | (line approved) | no | no | RMW | `writer_notes` append |
| 73 | `services/registrySync.js:330` | `update` | (pain point) | no | no | RMW | `wound_depth + 0.5`, `personality_matrix` delta |
| 74 | `services/registrySyncService.js:145` | instance `.update` | function syncProfileToRegistry | no | no | RMW | `aesthetic_dna` merge |
| 75 | `services/registrySyncService.js:156` | instance `.update` | function syncProfileToRegistry | no | no | BLIND | feed fields |

Paths are under `src/routes/` unless they begin `scripts/` or `services/` (those are under `src/`). The probe prints `?` as the function name for rows 70–73. The event names in brackets come from `registrySync.js`'s own comments and log lines.

**Counts (INFERRED):** RMW 27, BLIND 24, CREATE 10, CHECK-CREATE 6, BULK 5, DELETE 3. Total 75.

### §3.5 Observed in passing — not F-Reg-2's by any definition, not ruled

The reading pass surfaced defects that are not concurrency defects. They are recorded here so they are not lost. **None is assigned to F-Reg-2 or to any other keystone.**

**This session checked each of these against the code at the basis (MEASURED where marked):**

- **O-a. The assistant's delete guard never fires.** `memories/assistant.js:657` selects only `status`, and `:660` tests `char?.depth_level === 'alive'`. MEASURED:
  ```
  $ git show b470a47c:src/routes/memories/assistant.js | grep -n "SELECT status FROM registry_characters\|char?.depth_level === 'alive'"
  657:          `SELECT status FROM registry_characters WHERE id = :charId AND deleted_at IS NULL`,
  660:        if (char?.depth_level === 'alive') {
  ```
- **O-b. In-place JSON edits are not saved.** Several handlers edit a JSONB value in place, then assign an equal copy:
  - `memories/core.js:417–421` (`existingMemories.push`);
  - `characterRegistry.js:1619–1621` and `:1638–1640` (`ef.dilemma = …`, `ef.plot_threads = …`, then `{ ...ef }`).

  Sequelize 6.37.8 compares non-DATE values with `_.isEqual` against the current value (`node_modules/sequelize/lib/model.js:2288`). The value was already mutated, so the attribute is not marked changed and the save omits it.

  MEASURED at the library level, with `Model.build(…, { raw: true })` (how a loaded row is built) and no database:
  ```
  fresh changed(): false
  existing array, in-place push → changed: false | changed(): false
  no array yet → changed: true
  ```
  INFERRED for the routes: once `extra_fields.memories` exists, later confirmed memories are not written. `generate-section`'s dilemma and plot threads are not written when `extra_fields` was non-null.
- **O-c. The onboarding creates cannot succeed.** `onboarding.js:284` and `:332` pass no `character_key`, which the model declares `allowNull: false`. They also pass `appearance_mode: 'On-Page'` (`:290`, `:338`), which is not a member of the model's `ENUM('on_page', 'composite', 'observed', 'invisible', 'brief')` (`RegistryCharacter.js:59–61`). INFERRED: both fail validation every time, and the catch logs it.
- **O-d. `therapy.js`'s registry write cannot run.** `:800` reads `req.app.get('models')`, and nothing in `src/` calls `app.set('models', …)`:
  ```
  $ git grep -nE "set\(['\"]models|locals\.models" b470a47c -- src | wc -l
  0
  ```
  Only tests set it. Other files that read it fall back (`req.app.get('models') || require('../models')`, e.g. `characterCrossingRoutes.js:24`); `therapy.js:800` does not. INFERRED: `char` is null in the running app, so site 58 never executes.
- **O-e. The write-back finds its row by key alone.** `storyEvaluationRoutes.js:1588–1589` finds the row with `where: { character_key: upd.character_key }` and no `registry_id`. The key is unique only per registry (§3.2). INFERRED: with the same key in two registries, the update can reach the wrong row.

**Reported by the reading pass, not re-checked by this session (INFERRED):**
- the `deep_profile` merges (`characterRegistry.js:2113–2129`, `:2211–2218`) and `memories/engine.js:5460–5478` show O-b's in-place pattern;
- `characterGenerationRoutes.js:162` probably meets O-c's missing-key failure;
- `registrySync.js:180`'s `onLineApproved` expects `line.content` where its single-line caller passes a `text`-bearing row, and `:250` reads `c.name`, which is not a model attribute;
- `registrySync.js:243` and `registrySyncService.js:157` hold catches that do not log;
- `writer_notes` is written as plain text (`therapy.js:805`, `stories.js:935`, `registrySync.js`) and parsed as JSON (`consciousness.js:337`, `:462`), so a JSON parse failure can overwrite the text;
- `metadata` is not a model attribute, so `memories/engine.js:4558` and `socialProfileRoutes.js:1699` drop it silently;
- `memories/engine.js:4537` checks by key across all registries but creates in one;
- `worldStudio.js:1855` is the table's one hard delete, and its `world_character_id` lookups (`:1154`, `:1418`, `:1530`) do not filter `deleted_at`.

---

## §4. Open questions — recorded, not answered

**Q1. Production's constraints and indexes on `registry_characters`.** The repository has only the migration tree's (§3.2). Whether production has `UNIQUE (registry_id, character_key)` decides whether a concurrent duplicate is an error or a row. **Read-only queries:**

```sql
SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
 WHERE conrelid = 'public.registry_characters'::regclass ORDER BY conname;
SELECT indexname, indexdef FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'registry_characters' ORDER BY indexname;
```

**Q2. Has contention left a trace?** The code cannot say whether a lost update or a duplicate has ever happened. Two traces a read can show:
- a key held by more than one live row across registries, which matters for O-e and site 48;
- more live rows than expected under one registry.

**Read-only query:**

```sql
SELECT character_key, count(*) AS n, count(DISTINCT registry_id) AS registries
  FROM registry_characters WHERE deleted_at IS NULL
 GROUP BY character_key HAVING count(*) > 1 ORDER BY n DESC;
```

A lost update leaves no row-level trace. This question can find duplicates only.

**Q3. How concurrent is the app in practice?** It is a solo-operator app. INFERRED sources of overlap:
- long AI calls between a read and a write (sites 33, 35, 37, 39, 41, 12);
- the `registrySync` hooks running after other handlers (70–73);
- two tabs or the frontend's parallel loads (D5's "WorldAdmin parallel-load").

No read settles this. It is Evoni's judgement of how the app is used.

**Q4. Scope.** Does F-Reg-2 cover `registry_characters` only (Narrow), the four-table Pattern 41 family (Family), or every uncoordinated shared-row writer (Boundary)? The register says all three (§1.1).

**Q5. The §3.5 observations.** Where, if anywhere, do they belong? None is a concurrency defect, and the standing rule forbids feature work during the fix cycle. Not answered here.

---

## §5. What remains owed

| # | Item | Standing |
|---|---|---|
| — | 27 RMW sites with no lock (§3.4) | Open. INFERRED lost-update risk |
| — | 16 CREATE/CHECK-CREATE sites, none locked: deterministic keys lean on the unique index alone; sites 10 and 26 (and site 16's fallback) embed `Date.now()`, so nothing stops a duplicate there | Open. INFERRED |
| — | Production's constraints and indexes (Q1) | Unread |
| — | The family's other three tables (§2) | Unchanged since v8, not re-assessed here |
| — | §3.5 O-a to O-e and the unverified list | Recorded, unhomed |

**Fix shapes the code suggests — INFERRED, listed without preference:**
- **(a)** a transaction plus `SELECT … FOR UPDATE` (`lock: true`) around each RMW handler;
- **(b)** atomic SQL for the appends and merges (`jsonb ||`, `jsonb_set`, `col = col + n`), which removes the read;
- **(c)** an optimistic `version` column. That is a migration, and it touches the standing rule against schema redesign during the fix cycle.

**The decision the first ruling needs, as questions:**
1. Which reading of F-Reg-2 is in scope: Narrow, Family or Boundary (Q4)?
2. Is Q1's production read wanted before any fix is planned?
3. Which RMW sites, if not all 27, does the first fix cover, and in which shape (a, b or c)?
4. Where do §3.5's observations go (Q5)?

---

## What this document does not do

- **Rules nothing.** Every definition is quoted and not reconciled (§1.1). Every class and risk is INFERRED and marked.
- **Closes nothing, discharges nothing,** and mints no FD, PE or XK number.
- **Changes no code.** The census probe and the library check ran from the session's scratchpad and are not committed.
- **Edits no filed document.** That includes the v8 and v9 handoffs, `Cross_Keystone_Register.md` and `PROJECT_CONTEXT.md`.
- **Makes no host, AWS, database or Cognito contact.** Q1 and Q2 are queries for Evoni to run, not run here. Every ATTESTED clause cites a filed deploy record.

---

## Register hygiene

- **RULES:** nothing.
- **Opens:** F-Reg-2's first document.
- **Owes:** nothing new by ruling. §5 lists what is open.
- **Mints:** nothing. FD, XK and PE tails are unchanged.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `b470a47c53d0d6754d3e2360abfd687056b0f499`. Rules nothing. Mints nothing. Task: #2096. [skip-automerge]*
