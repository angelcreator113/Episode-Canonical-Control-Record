# F-Reg-2 — What Fix Plan v1.1 Still Owes (scoping read)

**Each item `F-Reg-2_Fix_Plan_v1.1.md` owes, with its standing at basis — Prime Studios audit canon**

| | |
|---|---|
| **Type** | Scoping read. Not a Fix Plan revision, not an amendment. |
| **Date** | 2026-09-28 |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Basis** | `origin/main` at `649a14c4663faed00bc2ee963ea18971b4158b9a` (#2171) |
| **Reads** | `F-Reg-2_Fix_Plan_v1.1.md` (`b00b8fc8`, #2115), and `F-Reg-2_Fix_Plan_v1.0.md` (`be8b93f2`, #2100) where v1.1 points to it |
| **Standing** | Every clause is **MEASURED** unless marked. **ATTESTED** is used only where a filed deploy record quotes Evoni. **CANNOT-TELL** says what read would settle it. Nothing is RULED here. |
| **Task** | #2172 |

---

## H1 — Basis

```
$ git fetch origin --prune
$ git log -1 --format='%H %ad %s' --date=short origin/main
649a14c4663faed00bc2ee963ea18971b4158b9a 2026-09-28 docs(context): refresh for event workstream and deploys BH–BL [skip-automerge] (#2171)
$ git rev-parse --is-shallow-repository
false
$ ls docs/audit | grep -E '^F-Reg-2'
F-Reg-2_Fix_Plan_v1.0.md
F-Reg-2_Fix_Plan_v1.1.md
F-Reg-2_Scoping_2026-09-27.md
```

MEASURED. v1.1 is the newest F-Reg-2 plan. GitHub MCP `list_pull_requests` (state open) returned `[]`.

---

## §1 The owed items, in v1.1's order, with their standing

v1.1's owed list is its §5 table (`F-Reg-2_Fix_Plan_v1.1.md:168–179`). Each row is quoted verbatim, in the plan's order, with its line.

### §1.1 The `world` migration — **DONE**, deployed

> | — | The `world` migration | **Owed to F-Reg-2** (RULED (1)). In review, #2114. |

`F-Reg-2_Fix_Plan_v1.1.md:172`.

**Standing: DONE.** Merged as #2114:

```
$ git log -1 --format='%H %cs %s' 0386bb97
0386bb97cda965ec33ee4cbbcc2a5bf64f406adf 2026-09-27 feat(db): a migration that adds registry_characters.world as production has it [skip-automerge] (#2114)
$ git ls-tree --name-only 649a14c4 src/migrations/ | grep registry-characters-world
src/migrations/20260927210000-add-registry-characters-world.js
$ git grep -nP 'RegistryCharacter\tworld' 649a14c4 -- scripts/schema-agreement-step2.baseline; echo "exit=$?"
exit=1
```

The migration is in the tree, and the ratchet baseline no longer lists `RegistryCharacter world missing-column` (v1.1 §3 cited it at `scripts/schema-agreement-step2.baseline:64`).

**Deployed: yes, Deploy BH.** ATTESTED per `F-Deploy-1_Deploy_2026-09-27_BH.md` §0 and §7. The migration ran and reported the type and the column already present and unchanged; the pending check then read 0 of 220.

### §1.2 O-e — **DONE**, deployed

> | — | O-e | Fix group 1 (v1.0 §1). In review, #2113. |

`F-Reg-2_Fix_Plan_v1.1.md:173`.

**Standing: DONE.** Merged as #2113:

```
$ git log -1 --format='%H %cs %s' f8c8509a
f8c8509a6bd8795d62f5aa8b5c9489776140b7c4 2026-09-27 fix(stories): write-back updates only its own registry's character [skip-automerge] (#2113)
```

**Deployed: yes, Deploy BH.** `F-Deploy-1_Deploy_2026-09-27_BH.md` §2 lists #2113 (`f8c8509a`) and #2114 (`0386bb97`) in the range, and §5 describes #2113's change.

### §1.3 The four other `registry_dossiers_used[0].registry_id` sites — **OPEN**

> | — | The four other `registry_dossiers_used[0].registry_id` sites (`storyEvaluationRoutes.js:1307`, `:1396`, `:1469`, `:1558`) | **Owed to F-Reg-2** (RULED (2)), to be fixed the same way as O-e. |

`F-Reg-2_Fix_Plan_v1.1.md:174`.

**Standing: OPEN.** All four reads are still in the file:

```
$ git grep -n 'registry_dossiers_used?.\[0\]?.registry_id' 649a14c4 -- src/
649a14c4:src/routes/storyEvaluationRoutes.js:1307:    const regId = story.registry_dossiers_used?.[0]?.registry_id || null;
649a14c4:src/routes/storyEvaluationRoutes.js:1396:    const regId = story.registry_dossiers_used?.[0]?.registry_id || null;
649a14c4:src/routes/storyEvaluationRoutes.js:1469:    const regId = story.registry_dossiers_used?.[0]?.registry_id || null;
649a14c4:src/routes/storyEvaluationRoutes.js:1575:        const regId = story.registry_dossiers_used?.[0]?.registry_id || null;
$ git log --format='%h %cs %s' acdb6c7d..649a14c4 -- src/routes/storyEvaluationRoutes.js
f8c8509a6 2026-09-27 fix(stories): write-back updates only its own registry's character [skip-automerge] (#2113)
```

v1.1's `:1558` is now `:1575`. #2113, the only commit to touch the file since v1.1's basis, moved it; the line's text is unchanged.

**Deployed:** no fix exists to deploy.

### §1.4 Fix group 2, the 27 RMW sites — **OPEN** (22); 5 already covered

> | — | Fix group 2: the 27 RMW sites (v1.0 §4.2). Rows 36, 40, 41, 46 and 49 were already made atomic or locked by #2102 and #2107 | Owed (v1.0 §1). |

`F-Reg-2_Fix_Plan_v1.1.md:175`. The sites are listed by file in `F-Reg-2_Fix_Plan_v1.0.md:214–227`.

**Rows 36, 40, 41, 46 and 49:** v1.1 records them as made atomic or locked by #2102 (`2063168c`) and #2107 (`acdb6c7d`). v1.1 §4.1 (`:122–137`) records them deployed in BF and BG (ATTESTED as those records quote Evoni).

**The other 22: OPEN.** None of the ten files that hold the 27 sites has changed since v1.1's basis:

```
$ git log --format='%h %cs %s' acdb6c7d..649a14c4 -- src/routes/characterRegistry.js src/services/registrySync.js src/routes/characterGenerationRoutes.js src/routes/consciousness.js src/routes/characterGrowthRoute.js src/routes/memories/core.js src/routes/memories/engine.js src/routes/memories/interview.js src/routes/worldStudio.js src/services/registrySyncService.js; echo "exit=$?"
exit=0
```

No output: the code at those sites is what v1.1 recorded as owed.

**Deployed:** no fix exists to deploy for the 22.

### §1.5 O-a, O-c, O-d — **OPEN**

> | O-a, O-c, O-d | v1.0 §4.3 | Homed to F-Reg-2 (v1.0 §1), unordered. |

`F-Reg-2_Fix_Plan_v1.1.md:176`. The sites are in `F-Reg-2_Fix_Plan_v1.0.md:233–237`:
- `memories/assistant.js:657`, `:660`;
- `onboarding.js:284`, `:332`;
- `therapy.js:800`.

**Standing: OPEN.** None of the three files has changed since v1.0's basis:

```
$ git log --format='%h %cs %s' 2c3e4f02..649a14c4 -- src/routes/memories/assistant.js src/routes/onboarding.js src/routes/therapy.js; echo "exit=$?"
exit=0
```

**Deployed:** no fix exists to deploy.

### §1.6 Family and Boundary — **OPEN**, no home

> | — | Family and Boundary | Owed, no home (v1.0 §1). |

`F-Reg-2_Fix_Plan_v1.1.md:177`. The two readings are defined at `F-Reg-2_Fix_Plan_v1.0.md:241–244`.

**Standing: OPEN, unhomed.** No register document merged after v1.1 names F-Reg-2, Family or Boundary. The only documents with the phrase are the two plans themselves:

```
$ git log --format='%h %cs %s' b00b8fc8..649a14c4 -- docs/audit | grep -iE 'F-Reg|family|boundary'; echo "exit=$?"
exit=1
$ git grep -lE 'Family and Boundary' 649a14c4 -- docs/audit
649a14c4:docs/audit/F-Reg-2_Fix_Plan_v1.0.md
649a14c4:docs/audit/F-Reg-2_Fix_Plan_v1.1.md
```

### §1.7 The eight story-table columns — **OPEN**, no home

> | — | `storyteller_chapters.sections`, `chapter_template`; `storyteller_books.theme`, `pov`, `tone`, `setting`, `conflict`, `stakes`: production has them, no migration creates them | **Owed, no home** (RULED (2)). |

`F-Reg-2_Fix_Plan_v1.1.md:178`.

**Standing: OPEN.** No migration in the running tree creates them, and the ratchet baseline still lists all eight:

```
$ git grep -nE "'(sections|chapter_template)'" 649a14c4 -- src/migrations | grep -i storyteller_chapters; echo "exit=$?"
exit=1
$ git grep -nE "addColumn\('storyteller_books', '(theme|pov|tone|setting|conflict|stakes)'" 649a14c4 -- src/migrations; echo "exit=$?"
exit=1
$ git grep -nP '^(StorytellerChapter|StorytellerBook)\t(sections|chapter_template|theme|pov|tone|setting|conflict|stakes)\t' 649a14c4 -- scripts/schema-agreement-step2.baseline
649a14c4:scripts/schema-agreement-step2.baseline:82:StorytellerBook	conflict	missing-column
649a14c4:scripts/schema-agreement-step2.baseline:83:StorytellerBook	pov	missing-column
649a14c4:scripts/schema-agreement-step2.baseline:84:StorytellerBook	setting	missing-column
649a14c4:scripts/schema-agreement-step2.baseline:85:StorytellerBook	stakes	missing-column
649a14c4:scripts/schema-agreement-step2.baseline:86:StorytellerBook	theme	missing-column
649a14c4:scripts/schema-agreement-step2.baseline:87:StorytellerBook	tone	missing-column
649a14c4:scripts/schema-agreement-step2.baseline:88:StorytellerChapter	chapter_template	missing-column
649a14c4:scripts/schema-agreement-step2.baseline:89:StorytellerChapter	sections	missing-column
```

The baseline lines moved up by one (v1.1 cited `:83–90`) when #2114 removed the `world` entry above them.

### §1.8 v1.0 §4.5's unhomed, unverified items — **CANNOT-TELL**

> | — | v1.0 §4.5's unhomed, unverified items | Unchanged. |

`F-Reg-2_Fix_Plan_v1.1.md:179`. The items are listed at `F-Reg-2_Fix_Plan_v1.0.md:246–256`:
- `registrySync.js`'s `line.content` and `c.name`;
- the non-logging catches;
- `writer_notes`' two formats;
- the dropped `metadata`;
- `memories/engine.js:4537`'s scope mismatch;
- `worldStudio.js`'s hard delete and unfiltered `world_character_id` lookups.

**Standing: CANNOT-TELL.** The scoping note reported them without re-checking (v1.0 §4.5), and they are unhomed. Two files that hold some of them, `registrySync.js` and `worldStudio.js`, have not changed since v1.1's basis (§1.4). That shows only that nothing fixed them, not that each still holds.

**What would settle it:** a code read of each item at a named SHA, confirming or dismissing it.

---

## §2 `registry_characters.world` before #2114

### §2.1 What v1.1 §2 records about production

> Evoni's read: production, 2026-09-27, `psql` as `postgres`, read-only. It is quoted exactly as she supplied it, with no host or credential.

> The column is `USER-DEFINED`, of type `enum_registry_characters_world`. It is nullable and has no default. The type has three labels, in order: `book-1`, `lalaverse`, `series-2`.

`F-Reg-2_Fix_Plan_v1.1.md:47` and `:63` (ATTESTED there).

`F-Deploy-1_Deploy_2026-09-27_BH.md` §7 records who applied the type and the column on production, and when, as **NOT ESTABLISHED**.

### §2.2 The whole-history search

**Search 1: every commit, every branch, for the type name.**

```
$ git log --all --format="%h %cs %s" -S enum_registry_characters_world
1c0282941 2026-09-27 docs(audit): file deploy record BH [skip-automerge] (#2131)
27af76a74 2026-09-28 docs(audit): file deploy record BH [skip-automerge]
0386bb97c 2026-09-27 feat(db): a migration that adds registry_characters.world as production has it [skip-automerge] (#2114)
a14917f48 2026-09-27 test(stories): drop the write-back test's world fixture now the migration adds it [skip-automerge]
f8c8509a6 2026-09-27 fix(stories): write-back updates only its own registry's character [skip-automerge] (#2113)
b00b8fc83 2026-09-27 docs(audit): F-Reg-2 Fix Plan v1.1, world column homed [skip-automerge] (#2115)
0e857926b 2026-09-27 docs(audit): F-Reg-2 Fix Plan v1.1, world column homed [skip-automerge]
c568fcd7b 2026-09-27 feat(db): a migration that adds registry_characters.world as production has it [skip-automerge]
b6cc88ac4 2026-09-27 test(stories): write-back updates another registry's character [skip-automerge]
acdb6c7dc 2026-09-27 fix(registry): deep-profile and Story Engine updates save every change [skip-automerge] (#2107)
2063168c3 2026-09-27 fix(registry): memory confirmations and generate-section save every change [skip-automerge] (#2102)
152a09251 2026-03-16 Claude/fix feed generation v eo br (#254)
3412a235c 2026-03-16 Fix story pages rendering outside Prime Studios shell, add world column, remove redundant StoryHubNav
```

Everything from 2026-09-27 on is F-Reg-2's own work: the test fixtures, the two plans, #2114 and the BH record. **The two 2026-03-16 commits are the hits that predate it.**

**Search 2: an `addColumn` for this table and column.**

```
$ git log --all --format="%h %cs %s" -S "addColumn('registry_characters', 'world'"
152a09251 2026-03-16 Claude/fix feed generation v eo br (#254)
3412a235c 2026-03-16 Fix story pages rendering outside Prime Studios shell, add world column, remove redundant StoryHubNav
```

**The hit: a migration in the root `migrations/` directory.** `3412a235c` (on `main`; merged by #254, `152a0925`) adds `migrations/20260316100000-registry-character-world.js`. It is still in the tree at basis:

```
$ git merge-base --is-ancestor 3412a235c origin/main && echo "3412a235c on main: yes"
3412a235c on main: yes
$ git ls-tree 649a14c4 migrations/20260316100000-registry-character-world.js
100644 blob c153621cd441f91ec6c9f85b6f239e2232f16371	migrations/20260316100000-registry-character-world.js
$ git show 152a0925:migrations/20260316100000-registry-character-world.js | sed -n 8,13p
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('registry_characters', 'world', {
      type: Sequelize.ENUM('book-1', 'lalaverse', 'series-2'),
      allowNull: true,
      comment: 'Which world this character belongs to. Drives layer assignment, Feed pipeline, story engine grouping.',
    });
```

What the file does:
- **The column:** the same three labels in the same order, nullable, no default. This matches v1.1 §2's production read.
- **The type:** Sequelize would name it `enum_registry_characters_world` (v1.1 §3, `:83`). The file names that type explicitly in its backfill: lines 18–26 set `world` from `universe`/`layer`, defaulting to `book-1`.
- **The model:** the same commit adds the `world` field to `src/models/RegistryCharacter.js`, and no other commit in history adds it:

```
$ git log --all --format="%h %cs %s" -S "world: {" -- src/models/RegistryCharacter.js
152a09251 2026-03-16 Claude/fix feed generation v eo br (#254)
```

**The CLI's configured tree, then and now, is `src/migrations/`, not `migrations/`:**

```
$ git show 152a0925:.sequelizerc | grep -n migrations-path
7:  'migrations-path': path.resolve('./src/migrations'),
$ git show origin/main:.sequelizerc | grep -n migrations-path
7:  'migrations-path': path.resolve('./src/migrations'),
$ git log --format="%h %cs %s" -- .sequelizerc
ee9d37190 2026-01-01 Initial commit: Phase 2 complete implementation with AWS services, file management, search, and job queue
```

So `sequelize-cli db:migrate` as configured would not have run the March file. v1.1 §3's `git grep` (`:88–92`) and BH §7 searched `src/migrations` only, which is why neither shows this file.

**A second path in the code of the time: `sync` behind an env flag.** At `152a0925`, `src/app.js:64–76` calls `db.sequelize.sync({ force, alter })` when `ENABLE_DB_SYNC === 'true'` (`alter` when `DB_SYNC_ALTER === 'true'`). Otherwise it logs "Skipping model sync". A sync of a model with a `world` ENUM field is another way the type and the column could have been made.

**Search 3: raw SQL or scripts.**

```
$ git log --all --format="%h %cs %s" -i -G 'ADD COLUMN (IF NOT EXISTS )?"?world"?'
(the 2026-09-27 F-Reg-2 commits listed in search 1, plus:)
3f4fa7ae1 2026-03-21 Dev (#300)
dac4d75aa 2026-03-21 chore: clean up 216 temp files, scripts, archives, and stale directories
b48653e07 2026-03-19 Dev (#278)
f28e28767 2026-03-18 1
```

The four March commits are about a different table. They add and then delete `_check_world_col.js`, whose line is `ALTER TABLE characters ADD COLUMN world VARCHAR(100)`: table `characters`, type `VARCHAR`. They are not hits for `registry_characters.world`.

```
$ git ls-tree -r --name-only 649a14c4 | grep -iE "migrations/.*world" | grep -v "^src/migrations/"
migrations/20260316100000-registry-character-world.js
```

No other migration tree (`scripts/migrations/`, `migrations/sequelize-migrations/`) holds a `registry_characters` world file.

### §2.3 What stays unknowable here

**Production is not established by the repository.** The repository shows two things:
- a 2026-03-16 migration file that creates exactly production's column and type, in a directory the configured CLI does not run;
- in the code of the time, an env-gated `sync` path.

It does not show whether either ever ran against production, who ran it, or when. BH §7's **NOT ESTABLISHED** stands. This read infers nothing beyond the repository.

**Not in scope here:** v1.1 §3 says "No migration creates the type or the column" and BH §7 says "no migration in the tree created them before #2114". Both are measured against `src/migrations` only, which neither changes. Whether either filed document takes a banner pointing to §2.2 is Evoni's to decide; this read edits neither.

---

## §3 The plan's own next item

v1.1 rules no order of its own. Its §5 marks O-a, O-c and O-d "unordered" (`:176`), and gives the four other sites no position (`:174`). The order is v1.0 §1's ruling, verbatim (`F-Reg-2_Fix_Plan_v1.0.md:38`):

> First fixes, in order: (1) the writes that are silently not saved: memory confirmations after the first, and generate-section's dilemma and plot threads; also the deep_profile merges, the Story Engine update and any other unsaved-write case the scoping note lists, each once confirmed; and O-e's key-only lookup, since the-almost-mentor exists in two registries. (2) The 27 read-modify-write sites, using atomic SQL where the write can be expressed that way and a transaction with a row lock where it cannot; no version column during the fix cycle.

v1.0's register hygiene restates it (`:274`):

> Fix group 1 (the unsaved writes, each once confirmed, and O-e), then fix group 2 (the 27 RMW sites: atomic SQL, else a transaction with a row lock; no version column).

MEASURED against §1: fix group 1's items are DONE, namely 1a–1d by #2102 and #2107 (v1.1 §4.1) and O-e by #2113 (§1.2). Item (2), fix group 2, is the next item in the ruling's words.

The four other sites carry v1.1's own words, "to be fixed the same way as O-e" (`:174`), and no position in that order.

This read makes no recommendation and no ruling.

---

## §4 Tails — re-derived, not carried

The commands are the register's own, as `PROJECT_CONTEXT.md` §6.3 records them (Task #2076's re-derivation).

**FD tail: FD-69.**

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
```

**XK tail: XK-4.** Two derivations give different answers:

```
$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md
57:### XK-1 — `paranoid` exposure
208:### XK-2 — row-scope not enforced in SQL
289:### XK-3 — no authorization substrate for the tenancy root
410:### XK-4 — tenancy absent from the route contract
```

The register treats the second as the tail. XK numbers are entries in `Cross_Keystone_Register.md`, admitted only when "A Fix Plan revision ratifies its admission" (`Cross_Keystone_Register.md:30`). The same file says it "mints nothing on its own" and that "Entries acquire ownership only when a Fix Plan revision ratifies them" (`:9`). The `/audit-file` rule is "XK by the Cross-Keystone Register via a ratifying revision" (`.claude/skills/audit-file/SKILL.md:14`).

XK-4 was ratified by `F-Stats-1_Fix_Plan_v1.62.md` §65.4 (`:9`, "**XK-4 is ratified** … It is admitted to `Cross_Keystone_Register.md` by this revision"; PR #2069). `PROJECT_CONTEXT.md` §6.3 records XK-4 as the tail, re-derived by Task #2076 with the second command.

The filename scan finds only standalone notes named `XK-<n>_…`. The one such file, `XK-2_Extent_Census_2026-09-05.md` (#1271), is an extent census of an existing entry, not a mint. XK-1, XK-3 and XK-4 have no standalone file, so that scan cannot give the tail.

**PE tail: PE #68.**

```
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
```

Nothing minted here.

---

## What this read does not do

- **Rules nothing**, and recommends no next fix (§3).
- **Edits no filed document**, including v1.0, v1.1, the scoping note and the BH record. §2.3 names a gap in two of them without correcting it.
- **Discharges nothing and mints no FD, XK or PE number.**
- **Changes no code or schema.**
- **Makes no host, AWS, database or Cognito contact.** The one production fact used (§2.1) is Evoni's own read, as v1.1 records it.

---

## Register hygiene

- **Records:**
  - DONE (§1.1, §1.2): the `world` migration (#2114, `0386bb97`) and O-e (#2113, `f8c8509a`), both deployed in BH.
  - OPEN (§1.3–§1.7): the four other sites; 22 of fix group 2's 27 sites; O-a, O-c, O-d; Family and Boundary; the eight story-table columns.
  - CANNOT-TELL (§1.8): v1.0 §4.5's items.
- **Measures (§2.2):** a 2026-03-16 migration, `migrations/20260316100000-registry-character-world.js`, that adds `registry_characters.world` with production's labels. It sits outside the CLI's configured tree. Production's history stays NOT ESTABLISHED.
- **Rules / closes / discharges / mints:** nothing.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-28. Basis: `origin/main` at `649a14c4663faed00bc2ee963ea18971b4158b9a`.*
*Type: scoping read. Rules: nothing. Mints: nothing. Discharges: nothing. Host/AWS/DB/Cognito contact by the filing session: none. Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`). Task: #2172. [skip-automerge]*
