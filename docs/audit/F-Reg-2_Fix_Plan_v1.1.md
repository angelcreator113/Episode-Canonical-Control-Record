# F-Reg-2 Fix Plan v1.1

**`registry_characters.world` homed; fix group 1 progress — Prime Studios audit canon**

> **BANNER** (added 2026-09-28, additive; `F-Reg-2_Fix_Plan_v1.2.md` §3, Task #2174). See `F-Reg-2_OwedScoping_2026-09-28.md` §2.2 (PR #2173) for a repository finding bearing on §3.

| | |
|---|---|
| **Version** | 1.1. Additive-supersede on `F-Reg-2_Fix_Plan_v1.0.md`. |
| **Date** | 2026-09-27 |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Basis** | `origin/main` at `acdb6c7dc520ec548cd6ad8f6aa02c2a2f0bbdaf` (#2107) |
| **Predecessor** | v1.0 (`be8b93f2`, #2100) |
| **Standing** | Each clause is **RULED**, **ATTESTED** or **MEASURED**, and says so. INFERRED is marked where carried. |
| **Task** | #2109 |

---

## H1 — Basis

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
acdb6c7dc520ec548cd6ad8f6aa02c2a2f0bbdaf 2026-09-27 fix(registry): deep-profile and Story Engine updates save every change [skip-automerge] (#2107)
$ ls docs/audit | grep '^F-Reg-2'
F-Reg-2_Fix_Plan_v1.0.md
F-Reg-2_Scoping_2026-09-27.md
```

MEASURED. v1.0 is the newest F-Reg-2 plan.

---

## §1 RULINGS — Evoni, 2026-09-27

**RULED (1)**, verbatim, as recorded on Task #2101:

> The registry_characters.world column, which the model declares and production has but no migration creates, is homed to F-Reg-2 and owed as a migration that adds it only where missing, matching production exactly.

**RULED (2)**, verbatim, in the review chat:

> The four other sites that read registry_dossiers_used[0].registry_id, a field that is never saved (storyEvaluationRoutes.js :1307, :1396, :1469 and :1558), are homed to F-Reg-2 as owed, to be fixed the same way as O-e. The columns production has but no migration creates on storyteller_chapters (sections, chapter_template) and storyteller_books (theme, pov, tone, setting, conflict, stakes) are recorded as owed, with no home yet.

**Nothing else is ruled.**

---

## §2 Production's `world`, 2026-09-27 — ATTESTED, raw output

Evoni's read: production, 2026-09-27, `psql` as `postgres`, read-only. It is quoted exactly as she supplied it, with no host or credential.

```
 column_name |  data_type   |            udt_name            | is_nullable | column_default   
-------------+--------------+--------------------------------+-------------+----------------  
 world       | USER-DEFINED | enum_registry_characters_world | YES         |   
(1 row)  
 
            typname             | enumlabel | enumsortorder   
--------------------------------+-----------+---------------  
 enum_registry_characters_world | book-1    |             1  
 enum_registry_characters_world | lalaverse |             2  
 enum_registry_characters_world | series-2  |             3  
(3 rows)  
```

The column is `USER-DEFINED`, of type `enum_registry_characters_world`. It is nullable and has no default. The type has three labels, in order: `book-1`, `lalaverse`, `series-2`.

---

## §3 The model, the migration tree and the tests — MEASURED

**The model's declaration matches production.**

```
$ git show acdb6c7d:src/models/RegistryCharacter.js | sed -n 46,50p
    world: {
      type: DataTypes.ENUM('book-1', 'lalaverse', 'series-2'),
      allowNull: true,
      comment: 'Which world this character belongs to.',
    },
```

- **Values:** the same three, in the same order.
- **Nullability:** `allowNull: true`.
- **Default:** none.
- Sequelize names a model ENUM's type `enum_<table>_<column>`, which is `enum_registry_characters_world` here, production's type name.

**No migration creates the type or the column.**

```
$ git grep -c "enum_registry_characters_world" acdb6c7d -- src/migrations; echo "exit=$?"
exit=1
$ git grep -nE "addColumn\('registry_characters', 'world'|world: \{" acdb6c7d -- src/migrations; echo "exit=$?"
acdb6c7d:src/migrations/20260624000000-create-story-task-arcs.js:20:      world: {
exit=0
$ git show acdb6c7d:src/migrations/20260624000000-create-story-task-arcs.js | grep -n "createTable"
5:    await queryInterface.createTable('story_task_arcs', {
```

The only hit is a `world` column on `story_task_arcs`, a different table.

**The 2026-09-17 canon capture has the column:** `EvidenceNote_Canon_Schema_Capture_2026-09-17.txt:1373`, `registry_characters | world | USER-DEFINED | YES`.

**The schema-agreement ratchet records the gap:** `scripts/schema-agreement-step2.baseline:64`, `RegistryCharacter	world	missing-column`.

**The tests stood in for the migration.** A migration-built database lacks the column, so every `RegistryCharacter` load there failed with `column "world" does not exist`. #2102's and #2107's integration tests each add it in a test-only fixture:

```
$ git grep -n "ADD COLUMN world enum_registry_characters_world" acdb6c7d -- tests
acdb6c7d:tests/integration/registryJsonWrites.integration.test.js:120:      await run(`ALTER TABLE registry_characters ADD COLUMN world enum_registry_characters_world`);
acdb6c7d:tests/integration/registryJsonWrites2.integration.test.js:92:      await run(`ALTER TABLE registry_characters ADD COLUMN world enum_registry_characters_world`);
```

**The migration, in review.** PR #2114 (Task #2111) adds `20260927210000-add-registry-characters-world.js`:
- it creates the type only if `pg_type` lacks it, and stops if an existing type's labels differ;
- it adds the column only if missing;
- it removes both fixtures and the baseline entry.

It is open at this plan's basis.

---

## §4 Fix group 1 — progress

### §4.1 O-b, the unsaved writes (v1.0 §4.1) — MEASURED (merged), ATTESTED (deployed)

| # | Case | Fixed by | Deployed |
|---|---|---|---|
| 1a | Memory confirmations after the first (`memories/core.js`) | #2102 (`2063168c`, Task #2101) | Deploy BF (`F-Deploy-1_Deploy_2026-09-27_BF.md`, #2106) |
| 1b | generate-section's dilemma and plot threads (`characterRegistry.js`) | #2102 | Deploy BF |
| 1c | The `deep_profile` merges, accept and bulk (`characterRegistry.js`), confirmed first | #2107 (`acdb6c7d`, Task #2105) | Deploy BG (record in review, #2112, Task #2108) |
| 1d | The Story Engine update (`memories/engine.js`), confirmed first | #2107 | Deploy BG |
| 1e | Any other unsaved-write case the scoping note lists | none | — |

**How each fix was done.**
- **#2102** writes in one `UPDATE` built from the column (`jsonb_set`, `||`), the ruling's first shape.
- **#2107** uses a transaction and a row lock (`SELECT … FOR UPDATE`), then merges into a copy of the current value. This is the ruling's second shape, used because these merges are not one plain SQL statement.
- **Tests:** each PR's tests failed on main before the fix, and include a concurrency test per site.

**The deploy accounts** are ATTESTED as those records quote Evoni. BF: restart 6 → 7. BG: restart 7 → 8. Both were `/health` healthy and connected.

### §4.2 O-e, the key-only lookup — in review

PR #2113 (Task #2110) scopes the write-back's registry update to the story's own registry. It resolves the registry from the dossier rows' own ids, and writes nothing for a key when the registry does not resolve. Its test failed on main: the other registry's copy was updated. It is open at this plan's basis.

### §4.3 The four other `registry_dossiers_used[0].registry_id` sites — homed, owed (RULED (2))

```
$ git show acdb6c7d:src/routes/storyEvaluationRoutes.js | grep -n "registry_dossiers_used"
1222:      registry_dossiers_used: dossiers,
1293:    if (story.registry_dossiers_used?.length) {
1294:      const akLines = story.registry_dossiers_used
1307:    const regId = story.registry_dossiers_used?.[0]?.registry_id || null;
1396:    const regId = story.registry_dossiers_used?.[0]?.registry_id || null;
1469:    const regId = story.registry_dossiers_used?.[0]?.registry_id || null;
1558:        const regId = story.registry_dossiers_used?.[0]?.registry_id || null;
```

MEASURED. The dossiers stored at `:1222` are `fetchSceneContext`'s rows, and its attribute list names no `registry_id`. So each `regId` at `:1307`, `:1396`, `:1469` and `:1558` is null. The trace is in #2113's body.

What follows from a null `regId` — INFERRED from the code, not tested:
- `:1307` passes it to the evaluation's context loaders.
- `:1396` never looks up the story's `character_id`.
- `:1469`, `propose-registry-update`, loads no character profiles.
- `:1558`, the write-back's memory step, falls back to a key-only lookup.

Owed to F-Reg-2, to be fixed the same way as O-e.

---

## §5 Owed

| # | Item | Standing |
|---|---|---|
| — | The `world` migration | **Owed to F-Reg-2** (RULED (1)). In review, #2114. |
| — | O-e | Fix group 1 (v1.0 §1). In review, #2113. |
| — | The four other `registry_dossiers_used[0].registry_id` sites (`storyEvaluationRoutes.js:1307`, `:1396`, `:1469`, `:1558`) | **Owed to F-Reg-2** (RULED (2)), to be fixed the same way as O-e. |
| — | Fix group 2: the 27 RMW sites (v1.0 §4.2). Rows 36, 40, 41, 46 and 49 were already made atomic or locked by #2102 and #2107 | Owed (v1.0 §1). |
| O-a, O-c, O-d | v1.0 §4.3 | Homed to F-Reg-2 (v1.0 §1), unordered. |
| — | Family and Boundary | Owed, no home (v1.0 §1). |
| — | `storyteller_chapters.sections`, `chapter_template`; `storyteller_books.theme`, `pov`, `tone`, `setting`, `conflict`, `stakes`: production has them, no migration creates them | **Owed, no home** (RULED (2)). |
| — | v1.0 §4.5's unhomed, unverified items | Unchanged. |

**The story-table columns — MEASURED:**

```
$ grep -nE "^ ?storyteller_(chapters|books) +\| (sections|chapter_template|theme|pov|tone|setting|conflict|stakes) " docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt
2039: storyteller_books                | conflict                          | text                        | YES
2048: storyteller_books                | pov                               | text                        | YES
2052: storyteller_books                | setting                           | text                        | YES
2054: storyteller_books                | stakes                            | text                        | YES
2057: storyteller_books                | theme                             | text                        | YES
2060: storyteller_books                | tone                              | text                        | YES
2068: storyteller_chapters             | chapter_template                  | character varying           | YES
2071: storyteller_chapters             | conflict                          | text                        | YES
2088: storyteller_chapters             | pov                               | character varying           | YES
2092: storyteller_chapters             | sections                          | jsonb                       | YES
2093: storyteller_chapters             | setting                           | text                        | YES
2095: storyteller_chapters             | stakes                            | text                        | YES
2100: storyteller_chapters             | theme                             | character varying           | YES
2102: storyteller_chapters             | tone                              | text                        | YES
$ grep -nP "^(StorytellerChapter|StorytellerBook)\t" scripts/schema-agreement-step2.baseline
83:StorytellerBook	conflict	missing-column
84:StorytellerBook	pov	missing-column
85:StorytellerBook	setting	missing-column
86:StorytellerBook	stakes	missing-column
87:StorytellerBook	theme	missing-column
88:StorytellerBook	tone	missing-column
89:StorytellerChapter	chapter_template	missing-column
90:StorytellerChapter	sections	missing-column
```

- **In the capture:** the eight ruled columns, as rows at the lines above.
- **In the ratchet baseline:** the same eight are already listed as `missing-column`.
- **Not ruled:** the capture's other `storyteller_chapters` rows (`conflict`, `pov`, `setting`, `stakes`, `theme`, `tone`) are also shown, and nothing is ruled on them.
- **In tests:** #2113's test adds `storyteller_chapters.sections` and `chapter_template` in a test-only fixture, because the write-back loads `StorytellerChapter`.

---

## What this plan does not do

- **Rules nothing beyond §1's quoted words.**
- **Edits no filed document**, including v1.0, the scoping note and the deploy records.
- **Mints no FD, PE or XK number.**
- **Writes no fix, and changes no schema.** The migration and O-e are their own PRs.
- **Makes no host, AWS, database or Cognito contact.** Every ATTESTED clause is Evoni's own read or account, taken outside any agent session.

---

## Register hygiene

- **RULES** (§1, Evoni):
  - `registry_characters.world` is homed to F-Reg-2, owed as a migration that adds it only where missing, matching production exactly.
  - The four other `registry_dossiers_used[0].registry_id` sites are homed to F-Reg-2, owed, to be fixed as O-e is.
  - The eight story-table columns are owed with no home.
- **Records:** fix group 1's O-b sites as fixed (#2102, #2107) and deployed (BF, BG). O-e and the `world` migration are in review (#2113, #2114).
- **Closes:** nothing. **Discharges:** nothing. **Mints:** nothing.
- Additive-supersede on v1.0; no destructive rewrite.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `acdb6c7dc520ec548cd6ad8f6aa02c2a2f0bbdaf`. Predecessor: v1.0.*
*Ruled (Evoni): world homed to F-Reg-2 as a where-missing migration; the four other registry_dossiers_used sites homed to F-Reg-2; the story-table columns owed, no home. Mints nothing. Task: #2109. [skip-automerge]*
