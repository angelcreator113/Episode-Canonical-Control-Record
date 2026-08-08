# F-Stats-1 Fix Plan v1.28

| | |
|---|---|
| **Predecessor** | v1.27 (`e4121ed5`, #993). |
| **Basis** | `e4121ed5` (#993 squash-merged). |
| **Author date** | 2026-08-08 |
| **Gate effect** | A local test database is provisioned; §23.1's stated precondition is met in form. **Open item 6 remains blocked** — for a new and better-understood reason. A 49-table schema divergence between canon and a migration-built database is recorded, spanning F-Stats-1, F-Ward-1, and the PE #62 residue. Open item 36 CARRIED. No dispositions, no gate lifted. |

## What changed in v1.28

- **§30 (new):** test-database provisioning record, migration replay result, and the canon-versus-migrations schema divergence.
- **§23.1 MET IN FORM, NOT IN SUBSTANCE.** A local test database exists. It does not contain the tables open item 6's suites require.
- **Open item 6 REMAINS BLOCKED.** Its blocker changes from *no test database* to *the test database cannot host the wardrobe money-path suites*. Its item 40 precondition is also still unmet.
- **NEW FINDING — `src/migrations/` does not reproduce canon.** A full replay yields 132 tables against canon's 143, with **30 tables in canon only and 19 in the replay only**. The two schemas share 113.
- **HYPOTHESIS — likely two migration systems.** Canon carries a `pgmigrations` table; `node-pg-migrate` is a direct dependency alongside `sequelize-cli`. `src/migrations/` replays one migration track, and the second should be checked directly.
- **NEW FINDING — the migration set is not replayable in order.** Five migrations self-skip on a fresh database because their target tables do not yet exist. At least one target is created three months later in the sequence.
- **v1.27's local-to-canon write hazard is PARTIALLY mitigated.** The test path is contained. **The development path is not.**
- **Open item 36 CARRIED.** No new evidence was gathered this session.
- Basis `e4121ed5`. Mints no FD. Tail: FD-61.

---

## §30 — test database provisioning and schema divergence (NEW — derived live at `e4121ed5`)

### What was provisioned

v1.21 §23.1 recorded that `localhost:5432` accepted TCP connections and rejected `postgres` under both `test` and `postgres` passwords.

Re-derived this session: the host carries **three** PostgreSQL services — `postgresql-x64-13`, `-16`, and `-18` — on ports 5433, 5434, and 5432 respectively. Attribution by listener PID to parent service PID, corroborated against each instance's configured `port`. The instance §23.1 could not authenticate against is **PostgreSQL 18** on 5432. None of the three accepted a known credential.

**PostgreSQL 16.13 on port 5434** was selected as the test host: nearest to canon's PostgreSQL 17, and **not** on the port the workstation `.env` addresses.

Its `pg_hba.conf` (data directory confirmed from the service's `-D` argument, not assumed) was amended to `trust` for `host all all 127.0.0.1/32` and `host all all ::1/128`. The four `local` and `replication` rules were left at `scram-sha-256`. A backup was taken first. Database `episode_metadata_test` was created.

**Maintainer ruling: local `trust` is the accepted posture for this instance.** It is a disposable test host on a workstation, reachable only from loopback. This is deliberate, not an oversight.

PostgreSQL 13 was amended identically during selection, then **fully reverted** from backup and its test database dropped. One loosened instance exists, not two.

### The test-config fallback hazard — found and contained

`.sequelizerc` points sequelize-cli at `src/config/sequelize.js` — the same file the application uses at runtime. There is no separate CLI config.

Its `test` block resolves in three tiers:

```
parseDatabaseUrl(TEST_DATABASE_URL) || parseDatabaseUrl(DATABASE_URL) || { discrete DB_* }
```

Before this session, the workstation `.env` set neither `TEST_DATABASE_URL` nor `DATABASE_URL`. **Tier three was live**, and it resolves `host`, `port`, `username`, and `password` from the same `DB_*` variables the development config uses — which, since v1.27, point at canon with a working credential. Only `database` differed: `TEST_DB_NAME || 'episode_metadata_test'`.

**`NODE_ENV=test` would therefore have authenticated against the canon RDS endpoint** and requested a database named `episode_metadata_test`. It fails only because no such database exists there, and because the test block sets `ssl: false` while canon requires SSL. Two accidental guards, neither deliberate.

`TEST_DATABASE_URL` was set in the workstation `.env`, short-circuiting both fallbacks. Resolution was then **proven by execution**, not by reading the source: loading the module under `NODE_ENV=test` returns `host: localhost`, `port: 5434`, `database: episode_metadata_test`, `username: postgres`, `ssl: false`.

### The development path is NOT contained

Every migration script in `package.json` hardcodes `NODE_ENV=development`:

```
"migrate": "cross-env NODE_ENV=development sequelize db:migrate",
"migrate:up": "cross-env NODE_ENV=development sequelize db:migrate",
"migrate:down": "cross-env NODE_ENV=development sequelize db:migrate:undo",
"db:setup:dev": "cross-env NODE_ENV=development sequelize db:migrate",
```

There is no `migrate:test` script. The development config reads the same `DB_*` variables that now point at canon.

**`npm run migrate` on this workstation would run migrations against production canon.** So would `npm run migrate:down`. This is v1.27's hazard in its most acute form, and this revision does not remedy it — a `TEST_DATABASE_URL` equivalent for the development path is a config change, not a register entry.

**Do not run any `npm run migrate*` script from this workstation until the development path is contained.**

### Migration replay result

All migrations in `src/migrations/` were replayed against the empty `episode_metadata_test` on PostgreSQL 16.13. **210 migration files in `src/migrations/`, zero failures during replay.** No PostgreSQL version incompatibility surfaced despite the one-major-version gap from canon's 17.

Five migrations **self-skipped** because their target tables did not exist at the time they ran:

| Migration | Skipped because |
|---|---|
| `20260208110000-add-clip-timing-to-layer-assets` | `layer_assets` does not exist |
| `20260219000006-wardrobe-game-layer` | `wardrobe_library` not found — library columns skipped |
| `20260227000001-add-soft-delete-to-storyteller-tables` | `continuity_beats` does not exist |
| `20260324000000-add-scene-sets-cover-and-episodes` | `scene_sets` does not exist |
| `20260626000001-add-sort-order-to-scene-set-episodes` | `scene_set_episodes` does not exist |

`scene_sets` is created at `20260625000000-create-scene-sets-and-angles` — **three months after** the migration that attempts to add columns to it. On a fresh database the extension migration runs first, finds nothing, and marks itself migrated. The columns are never added, and `SequelizeMeta` records success.

**The migration set is not replayable in order.** It succeeded historically because each migration ran when the tables it touched already existed, in real time as they were written. A rebuild produces a different schema and reports no error.

### Schema divergence — the finding

Table counts, `information_schema.tables` where `table_schema='public'`:

| Database | Tables |
|---|---|
| Canon (`episode-control-dev`, live) | **143** |
| Migration replay (`episode_metadata_test`) | **132** |
| Shared | **113** |

The net difference of 11 conceals a **49-table divergence**.

**In canon only — 30 tables:**

`asset_label_map`, `asset_labels`, `asset_roles`, `character_relationships_extended`, `composition_assets`, `composition_outputs`, `continuity_beat_characters`, `continuity_beats`, `continuity_characters`, `continuity_timelines`, `ecosystem_previews`, `episode_outfit_items`, `episode_outfits`, `episode_wardrobe`, `outfit_set_items`, `outfit_sets`, `pgmigrations`, `processing_queue`, `scene_set_episodes`, `scene_templates`, `script_edits`, `search_history`, `show_assets`, `template_studio`, `thumbnail_templates`, `timeline_placements`, `video_compositions`, `wardrobe_library`, `wardrobe_library_references`, `wardrobe_usage_history`

**In the replay only — 19 tables:**

`ai_interactions`, `character_profiles`, `decision_logs`, `decision_patterns`, `edit_maps`, `episode_phases`, `interactive_elements`, `lala_cash_grab_quests`, `lala_episode_formulas`, `lala_episode_timeline`, `lala_friend_archetypes`, `lala_micro_goals`, `layout_templates`, `processing_queues`, `raw_footage`, `scene_footage_links`, `script_metadata`, `upload_logs`, `user_decisions`

### What the divergence means

**`src/migrations/` is not the authoritative definition of the schema.** Thirty tables exist in production that a complete replay does not create. They were made some other way.

**Three mechanisms are visible in the data.**

**(1) A likely second migration system.** Canon carries `pgmigrations` — `node-pg-migrate`'s tracking table. `node-pg-migrate@^8.0.4` is a direct dependency in `package.json` alongside `sequelize-cli@^6.6.2`. This strongly suggests canon was built by two migration tracks while `src/migrations/` replays one. It is the most economical explanation for a large share of the canon-only list and should be the first thing checked.

**(2) Ordering self-skips.** `scene_set_episodes`, `wardrobe_library`, and `continuity_beats` all appear both in the skip messages and in the canon-only list. They exist in canon; the replay never created them and then skipped the migrations that would have extended them.

**(3) Out-of-band DDL.** `processing_queue` exists in canon; `processing_queues` exists in the replay. Same concept, different name, one in each. Nothing in the replayed set performs that rename. This is the F-App-1 §12.11 residue class — Variant B inline DDL and Variant A `model.sync` sites, tracked as PE #62 — showing up as **load-bearing**, not merely untidy. Some tables appear to exist only because non-migration code created them.

The 19 replay-only tables are the mirror image: migrations that create tables **absent from production**. Either they were dropped from canon later, or canon never ran them. The `lala_*` family and `decision_logs` are the largest groups. Note that F-Stats-1's own audit record describes `DecisionLogger` as dead instrumentation with 11 methods and 1 caller; a `decision_logs` table that does not exist in production is consistent with that.

### Bearing on open item 6 — STILL BLOCKED

§23.1's precondition was *a verifiable test database*. One now exists. **This does not unblock item 6.**

Item 6's outstanding assertions are wardrobe money-path coverage: `POST /select` and `POST /purchase`. Four wardrobe tables are **canon-only** and absent from the test database: `wardrobe_library`, `wardrobe_library_references`, `wardrobe_usage_history`, `episode_wardrobe` — with `outfit_sets`, `outfit_set_items`, `episode_outfits`, and `episode_outfit_items` alongside them.

Running those suites against this database would fail on missing tables, not on defects. **A green run would be meaningless and a red run would be uninformative.**

**Item 6's blocker is restated, not removed:** from *no test database exists* to *no test database can host these suites until the schema divergence is resolved*. Its second precondition — an owner for open item 40 — remains unmet independently.

**CI remains the only environment in which these suites can be verified**, exactly as §23.1 concluded, for a reason §23.1 did not know.

### Bearing on F-Ward-1

F-Ward-1 is next in the locked register order after F-Stats-1 closes. Eight of the thirty canon-only tables are wardrobe and outfit tables. **F-Ward-1 inherits this divergence directly**, and any F-Ward-1 work that assumes a migration-built environment reproduces production will be working against a schema that does not exist there.

Recorded and forward-pointed. F-Stats-1 claims no ownership.

### Bearing on the Paranoid Exposure Inventory

The inventory records that global `paranoid: true` in `src/config/sequelize.js`, combined with a 14-entry `deleted_at` migration, leaves 48 model tables as latent 500s on INSERT **against a migration-built database**.

A migration-built database now exists. **The claim is testable for the first time and was not tested this session.** The replay reported no errors, but migrations perform DDL, not model INSERTs — the exposure is a runtime condition and would surface only when the ORM writes through a paranoid model to a table lacking `deleted_at`.

Recorded as available work, not performed.

### Open item 36 — CARRIED

v1.27 carried item 36 to v1.28 on the grounds that the closure argument was a derivation from the record rather than a fresh read. **No new evidence was gathered this session.** The position is unchanged and item 36 carries again. It should not carry a third time without either the evidence or a ruling that the derivation suffices.

---

## §11 Plan Version History (UPDATED)

| v1.28 | 2026-08-08 | Local test database provisioned — PostgreSQL 16.13, `localhost:5434`, `episode_metadata_test`; local `trust` posture accepted by maintainer ruling. Test-config tier-three fallback to canon found and contained via `TEST_DATABASE_URL`; resolution proven by execution. 210 migration files in `src/migrations/` replayed, zero failures. **NEW: 49-table schema divergence** — canon 143, replay 132, shared 113; 30 canon-only, 19 replay-only. Likely second migration track indicated (`pgmigrations`). Migration set not replayable in order — five self-skips. §23.1 met in form only; **open item 6 remains blocked**. Development migrate path NOT contained. Open item 36 carried. §30 minted. Basis `e4121ed5`. |

v1.28 supersedes v1.27 **on §23.1's status and open item 6's blocker description**. All other v1.27, v1.26, and v1.25 forward direction stands unchanged, including item 32's resolution, §27's dissolution, the item 40 re-homing, and §16 as corrected by v1.26.

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.27. Tail: FD-61.
- Mints: §30.
- Closes: nothing.
- Carries: open item 6 (blocker restated), open item 36 (no new evidence), and all other items carried from v1.27.
- Supersedes: §23.1's status — met in form, not in substance.
- Forward-points: the schema divergence to **F-Ward-1** (wardrobe and outfit tables) and to the **PE #62 residue** (out-of-band DDL). The Paranoid Exposure Inventory claim is recorded as newly testable. No ownership claimed on any.
- Changes no unit disposition, no PR state, no gate.
- Additive-supersede on v1.27; no destructive rewrite.
- **LIVE DATABASE CONTACT — one read-only query against canon** (`information_schema.tables`, no application tables read, no writes). Local test database contact throughout, unrestricted. **No prod-box contact. No dev-box contact.** The prod freeze was not touched and this revision confers no authority to touch it.
- **Workstation configuration changed:** `TEST_DATABASE_URL` added to a gitignored `.env`; `pg_hba.conf` amended on PostgreSQL 16 (backed up), amended and reverted on PostgreSQL 13. No repository file changed by this work.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.28 is the plan-of-record.

**`worldEvents.js` remains the next executable surface**, unblocked, at 112 statements across 50 handlers in 9 groups per §16 as corrected by v1.26. **Open item 23 stands** — seven groups undispositioned plus two Overlays handlers, totals reliable, dispositions absent.

**Two hazards are live on the workstation and neither is remedied here:**

1. `npm run migrate` and its siblings hardcode `NODE_ENV=development` and resolve to canon. Do not run them from this workstation until the development path is contained.
2. Any ad-hoc script under `scripts/` reading `process.env.DB_PASSWORD` reaches canon. Several carry hardcoded password fallbacks and none confirm which database they address.

Two things this revision establishes:

**A precondition can be met without being satisfied.** §23.1 asked for a test database and one now exists — and open item 6 is no closer to verifiable than it was. The precondition was a proxy for *an environment in which these suites can run*, and provisioning the literal thing it named did not produce the thing it meant. The same trap caught v1.27 with §23.1's "or the credential recovered" clause, one revision ago, in the same section.

**The migration set is a partial record, not a definition.** Thirty tables exist in production that a complete replay does not create. Until that is reconciled, no environment built from `src/migrations/` can be assumed to resemble production, and no test result from such an environment can be read as evidence about production behaviour.

After F-Stats-1 closes: **F-Ward-1 next** — which inherits both the §26 inventory's two tables and eight of this divergence's canon-only wardrobe tables.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-08. Main at `e4121ed5` (#993). Predecessor: v1.27.*
*Minted: §30. Closed: nothing. Carried: open items 6 and 36. Superseded: §23.1 status. Mints no FD. Tail: FD-61. [skip-automerge]*
