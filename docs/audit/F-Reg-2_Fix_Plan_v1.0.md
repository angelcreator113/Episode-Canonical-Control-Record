# F-Reg-2 Fix Plan v1.0

**`registry_characters` write contention: scope and first fixes — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.0. F-Reg-2's first Fix Plan. It is named by the register's convention for a keystone's first plan, `<keystone>_Fix_Plan_v1.0.md`, as `F-Ward-1_Fix_Plan_v1.0.md` is. |
| **Date** | 2026-09-27 |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Basis** | `origin/main` at `2c3e4f021e882101871baaf770d8968377ac1de6` |
| **Predecessor keystone** | F-Ward-1, closed: "The locked sequence moves to F-Reg-2" (`F-Ward-1_Fix_Plan_v1.1.md` §5, RULED). |
| **Scoping** | `F-Reg-2_Scoping_2026-09-27.md` (PR #2098) |
| **Audit canon reference** | Audit Handoff v8, `:180`, `:255`, `:426` |
| **Standing** | Each clause is **RULED**, **ATTESTED** or **MEASURED**, and says so. INFERRED is marked where carried from the scoping note. |
| **Task** | #2099 |

---

## H1 — Basis

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
2c3e4f021e882101871baaf770d8968377ac1de6 2026-09-27 docs(audit): open F-Reg-2, scoping [skip-automerge] (#2098)
$ ls docs/audit | grep '^F-Reg-2'
F-Reg-2_Scoping_2026-09-27.md
$ git diff --name-only b470a47c 2c3e4f02
docs/audit/F-Reg-2_Scoping_2026-09-27.md
```

MEASURED. The scoping note is on main, and this is F-Reg-2's first plan. Nothing under `src/` changed since the scoping note's basis, so its line numbers hold here.

---

## §1 RULING — Evoni, 2026-09-27

**RULED**, verbatim, in the review chat:

> F-Reg-2 is Narrow: registry_characters only. The Family and Boundary readings are recorded as owed, with no home yet. First fixes, in order: (1) the writes that are silently not saved: memory confirmations after the first, and generate-section's dilemma and plot threads; also the deep_profile merges, the Story Engine update and any other unsaved-write case the scoping note lists, each once confirmed; and O-e's key-only lookup, since the-almost-mentor exists in two registries. (2) The 27 read-modify-write sites, using atomic SQL where the write can be expressed that way and a transaction with a row lock where it cannot; no version column during the fix cycle. O-a, O-c and O-d are homed to F-Reg-2. Production's duplicate indexes, its production-only partial unique index, and the full unique index that blocks re-creating a soft-deleted key are recorded as observed, not ruled.

**Nothing else is ruled.**

"Narrow", "Family" and "Boundary" are the readings the scoping note lists side by side (§1.1). O-a to O-e are its §3.5 observations. "The 27 read-modify-write sites" are its §3.4 rows classed RMW.

---

## §2 Production's `registry_characters`, 2026-09-27 — ATTESTED

Evoni's read: production, 2026-09-27, `psql` as `postgres`, read-only. These are the scoping note's Q1 and Q2 queries (§4). The output is quoted exactly as she supplied it, with no host or credential.

### §2.1 Constraints — ATTESTED, raw output

```
                   conname                   |                                pg_get_constraintdef                                 
---------------------------------------------+-------------------------------------------------------------------------------------  
 registry_characters_feed_profile_id_fkey    | FOREIGN KEY (feed_profile_id) REFERENCES social_profiles(id) ON DELETE SET NULL  
 registry_characters_pkey                    | PRIMARY KEY (id)  
 registry_characters_registry_id_fkey        | FOREIGN KEY (registry_id) REFERENCES character_registries(id) ON DELETE CASCADE  
 registry_characters_world_character_id_fkey | FOREIGN KEY (world_character_id) REFERENCES world_characters(id) ON DELETE SET NULL  
(4 rows)  
```

### §2.2 Indexes — ATTESTED, raw output

```
                   indexname                   |                                                                 indexdef                                                                  
-----------------------------------------------+-------------------------------------------------------------------------------------------------------------------------------------------  
 idx_rc_registry_key                           | CREATE UNIQUE INDEX idx_rc_registry_key ON public.registry_characters USING btree (registry_id, character_key) WHERE (deleted_at IS NULL)  
 idx_rc_registry_sort                          | CREATE INDEX idx_rc_registry_sort ON public.registry_characters USING btree (registry_id, sort_order)  
 idx_rc_status                                 | CREATE INDEX idx_rc_status ON public.registry_characters USING btree (status)  
 registry_characters_deleted_at_idx            | CREATE INDEX registry_characters_deleted_at_idx ON public.registry_characters USING btree (deleted_at) WHERE (deleted_at IS NULL)  
 registry_characters_depth_level               | CREATE INDEX registry_characters_depth_level ON public.registry_characters USING btree (depth_level)  
 registry_characters_feed_profile_id           | CREATE INDEX registry_characters_feed_profile_id ON public.registry_characters USING btree (feed_profile_id)  
 registry_characters_pkey                      | CREATE UNIQUE INDEX registry_characters_pkey ON public.registry_characters USING btree (id)  
 registry_characters_registry_id_character_key | CREATE UNIQUE INDEX registry_characters_registry_id_character_key ON public.registry_characters USING btree (registry_id, character_key)  
 registry_characters_registry_id_sort_order    | CREATE INDEX registry_characters_registry_id_sort_order ON public.registry_characters USING btree (registry_id, sort_order)  
 registry_characters_social_presence           | CREATE INDEX registry_characters_social_presence ON public.registry_characters USING btree (social_presence)  
 registry_characters_status                    | CREATE INDEX registry_characters_status ON public.registry_characters USING btree (status)  
 registry_characters_time_orientation          | CREATE INDEX registry_characters_time_orientation ON public.registry_characters USING btree (time_orientation)  
(12 rows)  
```

### §2.3 Keys held by more than one live row — ATTESTED, raw output

```
   character_key   | n | registries   
-------------------+---+------------  
 the-almost-mentor | 2 |          2  
(1 row)  
```

**One key, two live rows, two registries.** The unique indexes allow this, since each counts `(registry_id, character_key)`. Within any one registry, no key is held twice by live rows.

---

## §3 Production beside the migration tree — MEASURED (tree) beside ATTESTED (production)

### §3.1 The tree's constraints and indexes — MEASURED

Sequelize names an unnamed `addIndex` as `<table>_<fields joined by _>` (`node_modules/sequelize/lib/utils.js`, `nameIndex`, `:418`). The tree's definitions at the basis:

```
$ git show 2c3e4f02:src/migrations/20260220000004-create-character-registry.js | sed -n 205,207p
    await queryInterface.addIndex('registry_characters', ['registry_id', 'sort_order']);
    await queryInterface.addIndex('registry_characters', ['registry_id', 'character_key'], { unique: true });
    await queryInterface.addIndex('registry_characters', ['status']);
$ git show 2c3e4f02:src/migrations/20260227000001-add-soft-delete-to-storyteller-tables.js | sed -n 39,42p
      await queryInterface.addIndex(table, ['deleted_at'], {
        name: `${table}_deleted_at_idx`,
        where: { deleted_at: null },
      }).catch(() => {}); // ignore if already exists
$ git show 2c3e4f02:src/migrations/20260302210000-add-world-registry-cross-links.js | sed -n '25,28p;45,47p'
      await queryInterface.addColumn('registry_characters', 'world_character_id', {
        type: Sequelize.UUID,
        allowNull: true,
      });
      await queryInterface.addIndex('registry_characters', ['world_character_id'], {
        name: 'idx_rc_world_char',
      });
$ git show 2c3e4f02:src/migrations/20260312100000-character-generation-redesign.js | sed -n '207,213p;256,259p'
    await queryInterface.addColumn('registry_characters', 'feed_profile_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: null,
      comment: 'FK to social_profiles.id — set when social_presence = true and Feed profile is created',
      references: { model: 'social_profiles', key: 'id' },
      onDelete: 'SET NULL',
    await queryInterface.addIndex('registry_characters', ['depth_level']);
    await queryInterface.addIndex('registry_characters', ['social_presence']);
    await queryInterface.addIndex('registry_characters', ['feed_profile_id']);
    await queryInterface.addIndex('registry_characters', ['time_orientation']);
```

### §3.2 Side by side

**Constraints.**

| Constraint | Tree | Production |
|---|---|---|
| `registry_characters_pkey` PRIMARY KEY (id) | `20260220000004` createTable | yes |
| `registry_characters_registry_id_fkey` → `character_registries` ON DELETE CASCADE | `20260220000004` createTable | yes |
| `registry_characters_feed_profile_id_fkey` → `social_profiles` ON DELETE SET NULL | `20260312100000:207–214` addColumn `references` | yes |
| `registry_characters_world_character_id_fkey` → `world_characters` ON DELETE SET NULL | **none**: `20260302210000:25–28` adds the column with no `references` | **production only** |

**Indexes.**

| Index | Tree | Production |
|---|---|---|
| `registry_characters_pkey` | createTable | yes |
| `registry_characters_registry_id_character_key` UNIQUE, full | `20260220000004:206` | yes |
| `registry_characters_registry_id_sort_order` | `20260220000004:205` | yes |
| `registry_characters_status` | `20260220000004:207` | yes |
| `registry_characters_deleted_at_idx` partial, `deleted_at IS NULL` | `20260227000001:39–42` | yes |
| `registry_characters_depth_level` | `20260312100000:256` | yes |
| `registry_characters_social_presence` | `20260312100000:257` | yes |
| `registry_characters_feed_profile_id` | `20260312100000:258` | yes |
| `registry_characters_time_orientation` | `20260312100000:259` | yes |
| `idx_rc_world_char` on `world_character_id` | `20260302210000:45–47`, if absent by name | **absent from production** |
| `idx_rc_registry_key` UNIQUE, partial, `deleted_at IS NULL` | **none** | **production only** |
| `idx_rc_registry_sort` on `(registry_id, sort_order)` | **none** | **production only** |
| `idx_rc_status` on `status` | **none** | **production only** |

The production-only `idx_rc_*` names appear nowhere in the repository (`git grep` exits 1 on no match):

```
$ git grep -c "idx_rc_registry_key\|idx_rc_registry_sort\|idx_rc_status" 2c3e4f02 -- . ; echo "exit=$?"
exit=1
```

### §3.3 What the comparison shows — MEASURED beside ATTESTED

- **Two unique indexes on `(registry_id, character_key)`.**
  - `registry_characters_registry_id_character_key` is full. It is the tree's (`20260220000004:206`), and it counts soft-deleted rows.
  - `idx_rc_registry_key` is partial on `deleted_at IS NULL`. It is production-only, and it counts live rows only.

  Each index alone makes two concurrent same-key creates in one registry end in one success and one unique-violation.
- **The full index blocks re-creating a soft-deleted key.** The model is `paranoid: true` (`src/models/RegistryCharacter.js:647`). INFERRED, carried from the scoping note (§3.2, §3.4): the CHECK-CREATE sites' existence checks skip soft-deleted rows, so a key freed by a soft delete passes the check and then fails at the insert.
  - The sites that check scope by registry are `memories/engine.js:915`, `press.js:400` and `characterRegistry.js:978`, the last through `findOrCreate`.
  - `memories/engine.js:4550` checks by key alone. `characterGenerator.js:1004` and `scripts/update-character-profiles.js:193` check by name.

  **Recorded as observed, not ruled** (§1).
- **Duplicated indexes.** `status` is indexed twice (`registry_characters_status`, `idx_rc_status`). So is `(registry_id, sort_order)` (`registry_characters_registry_id_sort_order`, `idx_rc_registry_sort`). In each pair the second index is production-only. **Recorded as observed, not ruled** (§1).
- **Not named by the ruling, recorded as observed only:**
  - `world_character_id` has a foreign key in production that no migration creates.
  - It lacks the index the tree creates for it (`idx_rc_world_char`).

  The worldStudio re-sync and delete paths look rows up by `world_character_id` (scoping note §3.4, rows 61–67).

---

## §4 Owed, as the ruling orders it

Rows and line numbers are the scoping note's (§3.4, §3.5), at `b470a47c`. "Once confirmed" is the ruling's condition: each case is confirmed by a test that fails before its fix and passes after.

### §4.1 Fix group 1 — first

**Unsaved writes.** Each edits a JSON value in place and then assigns an equal copy, so Sequelize marks nothing changed (scoping note §3.5, O-b).

| # | Case | Site | Standing |
|---|---|---|---|
| 1a | Memory confirmations after the first | `src/routes/memories/core.js:417–421` (row 46) | Confirmed at library level by the scoping note (§3.5, O-b). The route is INFERRED |
| 1b | generate-section's dilemma and plot threads | `src/routes/characterRegistry.js:1619–1621`, `:1638–1640`, saved at `:1698` (row 36) | Pattern re-checked by the scoping note. INFERRED |
| 1c | The `deep_profile` merges | `src/routes/characterRegistry.js:2113–2129` (row 40), `:2211–2218` (row 41) | Reported, not re-checked. **To confirm first** |
| 1d | The Story Engine update | `src/routes/memories/engine.js:5460–5478` (row 49) | Reported, not re-checked. **To confirm first** |
| 1e | Any other unsaved-write case the scoping note lists | none beyond 1a–1d | The note's O-b and its unverified list name no other site |

**O-e, the key-only lookup.** `src/routes/storyEvaluationRoutes.js:1588–1589` finds the row by `character_key` with no `registry_id` (row 57). ATTESTED §2.3: `the-almost-mentor` has live rows in two registries, so the wrong-row update is reachable in production data.

The fixes ship in phone-reviewable PRs, memory confirmations first. How the work is split into PRs is not ruled.

### §4.2 Fix group 2 — second

**The 27 RMW sites.** Per the ruling, each gets atomic SQL where the write can be expressed that way, and a transaction with a row lock where it cannot. No version column during the fix cycle. The draft splits them into phone-reviewable PRs by file:

| File | Rows (scoping note §3.4) | Sites |
|---|---|---|
| `src/routes/characterRegistry.js` | 18, 19, 20, 30, 33, 34, 35, 36, 37, 38, 39, 40, 41 | `:481`, `:513`, `:537`, `:1057`, `:1398`, `:1415`, `:1441`, `:1698`, `:1805`, `:1822`, `:1847`, `:2129`, `:2218` |
| `src/services/registrySync.js` | 70, 71, 72, 73 | `:87`, `:159`, `:255`, `:330` |
| `src/routes/characterGenerationRoutes.js` | 4, 8 | `:141`, `:294` |
| `src/routes/consciousness.js` | 42, 43 | `:345`, `:464` |
| `src/routes/characterGrowthRoute.js` | 12 | `:209` |
| `src/routes/memories/core.js` | 46 | `:421` |
| `src/routes/memories/engine.js` | 49 | `:5478` |
| `src/routes/memories/interview.js` | 50 | `:696` |
| `src/routes/worldStudio.js` | 60 | `:860` |
| `src/services/registrySyncService.js` | 74 | `:145` |

2 + 1 + 13 + 2 + 1 + 1 + 1 + 1 + 4 + 1 = 27. `characterRegistry.js`'s 13 sites may need more than one PR to stay phone-reviewable.

Rows 36, 40, 41, 46 and 49 are also in fix group 1. INFERRED: their group 1 fix (the write is saved at all) comes before their group 2 fix (the write is not lost under concurrency).

### §4.3 Homed to F-Reg-2 — O-a, O-c, O-d

| Item | Site | Scoping note |
|---|---|---|
| O-a | The assistant's delete guard selects `status`, tests `depth_level` | `src/routes/memories/assistant.js:657`, `:660` |
| O-c | The onboarding creates pass no `character_key` and an invalid `appearance_mode` | `src/routes/onboarding.js:284`, `:332` (`:290`, `:338`) |
| O-d | `therapy.js`'s registry write reads an unset `req.app.get('models')` with no fallback | `src/routes/therapy.js:800` |

Homed, not ordered. The ruling places them after neither group.

### §4.4 Owed, no home

- **Family**: `character_state` (F-Stats-2), `career_goals` (F-CP-4, F-Arc-4), `financial_transactions` (F-EpComp-7) (scoping note §1.1, §2).
- **Boundary**: uncoordinated shared-row writing beyond these tables (scoping note §1.1).

### §4.5 Not homed by the ruling

The scoping note's other items reported by the reading pass and not re-checked (§3.5):
- `registrySync.js`'s `line.content` and `c.name`;
- the non-logging catches;
- `writer_notes`' two formats;
- the dropped `metadata`;
- `memories/engine.js:4537`'s scope mismatch;
- the hard delete and unfiltered `world_character_id` lookups in `worldStudio.js`.

The unsaved-write cases among them are fix group 1's (§4.1). The rest stay recorded, unhomed.

---

## What this plan does not do

- **Rules nothing beyond §1's quoted words.** The PR split (§4.1, §4.2) is the draft's, and ordering within each group is not ruled.
- **Edits no filed document**, including the scoping note.
- **Mints no FD, PE or XK number.**
- **Writes no fix, and changes no index or constraint.**
- **Makes no host, AWS, database or Cognito contact.** Every ATTESTED clause is Evoni's own read, taken outside any agent session.

---

## Register hygiene

- **RULES** (§1, Evoni):
  - F-Reg-2 is Narrow; Family and Boundary are owed and unhomed.
  - Fix group 1 (the unsaved writes, each once confirmed, and O-e), then fix group 2 (the 27 RMW sites: atomic SQL, else a transaction with a row lock; no version column).
  - O-a, O-c and O-d are homed to F-Reg-2.
  - Production's duplicate, production-only partial unique, and soft-delete-blocking full unique indexes are observed, not ruled.
- **Owes:** fix groups 1 and 2; O-a, O-c, O-d; Family and Boundary (unhomed).
- **Closes:** nothing. **Discharges:** nothing. **Mints:** nothing.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

The scoping read counted 75 writes to one table, and none of them locks the row. Evoni's read of production showed that the one uniqueness the code relies on holds twice over, and that one key already lives in two registries. The ruling narrows F-Reg-2 to that table and puts the silent losses first: the writes that are never saved at all, and the lookup that can land on the wrong registry. The concurrency fixes follow, one file at a time.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-27. Basis: `origin/main` at `2c3e4f021e882101871baaf770d8968377ac1de6`. Scoping: PR #2098.*
*Ruled (Evoni): F-Reg-2 Narrow; fix group 1 (unsaved writes once confirmed, O-e), then fix group 2 (27 RMW sites); O-a/O-c/O-d homed; indexes observed. Mints nothing. Task: #2099. [skip-automerge]*
