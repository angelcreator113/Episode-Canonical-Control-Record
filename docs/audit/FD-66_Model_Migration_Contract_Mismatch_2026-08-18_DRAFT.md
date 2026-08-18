| **PRIME STUDIOS** **FINDING — FD-66** *Mints FD-66. Ships no code. Changes no gate.* |
| --- |

# Finding — FD-66: Models Declare Schema Behaviour Their Migrations Do Not Provide

**Date:** 2026-08-18
**Status:** **DRAFT.** Mints **FD-66**; FD tail advances **FD-65 → FD-66**. **Priority P0, ruled** — see §0.1. Ships no code. Changes no gate. Authorizes nothing.
**Session:** F-Auth-5 remediation (PR #1049, merged at `77fc5fb0`). This finding was surfaced by that work, not sought by it.
**Derived from:** git against `origin/main` at `77fc5fb0`, plus the CI log for Validate run `32149440997`.
**Environment contact — stated in full:**
- **A local test database was contacted** (`localhost:5434`, the `TEST_DATABASE_URL` target) for the probes at §2.2 and §3.2.
- **A local scratch database was created, migrated, read, and dropped** — `fd66_migrations_only` on the same local instance — for the measurement at §6. 210 migrations were applied to it. Its removal is confirmed.
- **One command connected to a database other than its intended target.** `npx sequelize db:migrate` was first run with `DATABASE_URL` exported but `NODE_ENV` unset; `.env` sets `NODE_ENV=production`, and the production config block **deliberately ignores `DATABASE_URL`** (`src/config/sequelize.js:141-145`), resolving instead to discrete `DB_*` vars. On this machine those resolve to `127.0.0.1` / `episode_metadata_test`, so the connection was local and the command executed no DDL — it reported *"schema already up to date"*. **On a machine where `DB_HOST` pointed at RDS, that command would have reached it.** Recorded because the near-miss is the reportable part, not the outcome.
- **No request was issued to any deployed host.** Prod remains FROZEN and untouched.
**Additive on:** F-AUTH-1 Fix Plan v2.53. Supersedes nothing. Corrections owed forward are stated at §5.

---

## §0. One-line

**Of 146 Sequelize models checked against a database built by migrations alone, 28 name a column or a table that database does not have, and a further 38 have no table under any spelling.** The 27 split across three axes with three different remedies — **19** missing `deleted_at` under `paranoid: true`, **4** naming mismatches, **10** naming columns that exist in no spelling (§6.3.1). Three of the 27 are confirmed by probe to make an HTTP route return 500 unconditionally — the route Gate G3 clause 3 depends on, the route v2.49 §2.4 named as the control that would evidence an intrusion, and one of the six sites remediated at `ed3461c5`.

## §0.1 Priority — P0, and why not P1

**Ruled P0.** The grounds are not the count of broken models but the identity of one of them.

**A P0 already stands against the authentication surface.** FD-65 is OPEN: `POST /api/v1/auth/login` issues signed tokens to unauthenticated callers, and v2.53 closed only the privilege half — the issuance half remains open by name.

**`GET /api/v1/audit-logs` is the control v2.49 §2.4 named as the one that would evidence an intrusion.** It returns 500, has never returned anything else (§2.3), and on the deploy path as written it is broken in the deployed environments too (§6.4.1).

**Those two facts are worse together than either is alone.** An open issuance defect means a credential can be obtained; a dead audit route means obtaining one leaves no retrievable trace. **P1 would rank this as schema hygiene affecting several routes. It is not — it is the absence of the control that would show the standing P0 being exploited.**

Secondary, and sufficient on its own for P1 but not the reason for P0: FD-66 gates the schema baseline (§7.1), so it blocks a strategy decision rather than sitting behind one.

## §1. What is minted, and at what scope

**The finding is the class, and the class is measured.** A model declares attributes or behaviour that determine the columns Sequelize names in SQL; the migrations that build its table do not supply them; nothing reconciles the two; and no test observes the result.

Two instances were investigated in depth before the population was measured — `activity_logs` (§2) and `decision_logs` (§3) — because each was independently observed breaking a route this session needed. They remain written up individually, as the worked examples and as the validation of the measurement method (§6.2). **They are no longer the finding's extent.**

**The remedy is one decision applied per table** — correct the migration to match the model, or correct the model to match the table — which is why this is one FD and not 27. See §7.

---

## §2. Instance A — `activity_logs`

### §2.1 The mismatch

`src/migrations/20240101000005-create-activity-logs.js:5` creates `activity_logs` with **camelCase columns**: `userId`, `actionType`, `resourceType`, `resourceId`, `oldValues`, `newValues`, `ipAddress`, `userAgent`.

`src/models/ActivityLog.js:101` declares **`underscored: true`**, so every query the model issues names `user_id`, `action_type`, `resource_type`, and so on.

**No later migration renames the columns.** `activity_logs` is named in exactly one file under `src/migrations/`.

### §2.2 Evidence — observed, both environments

`GET /api/v1/audit-logs` (`src/routes/auditLogs.js:18`, mounted at `src/app.js:892`) returns **500**:

```
Failed to fetch audit logs: Error:
  parent: error: column "user_id" does not exist
  hint: Perhaps you meant to reference the column "ActivityLog.userId".
  sql: SELECT "id", "user_id" AS "userId", … FROM "activity_logs" AS "ActivityLog" …
```

- **Observed locally**, 2026-08-18, against the local test database.
- **Observed in CI**, Validate run `32149440997`, job `95751314122` — a database built by `npm run migrate:up` alone.

### §2.3 Dating — the route has never worked

- `src/migrations/20240101000005-create-activity-logs.js` added at `ee9d3719`, **2026-01-01**.
- `underscored: true` added to `src/models/ActivityLog.js` at `9329b2b5`, **2026-01-09**.
- `src/routes/auditLogs.js` **added in that same commit `9329b2b5`**, 2026-01-09.

**The route was created in the commit that broke the mapping.** `GET /api/v1/audit-logs` has never returned 200 in its lifetime.

---

## §3. Instance B — `decision_logs`

### §3.1 The mismatch

`src/config/sequelize.js:63` sets **`paranoid: true`** as a global `define` default. `src/models/DecisionLog.js:62–68` sets `tableName`, `timestamps`, `createdAt`, `updatedAt: false`, `underscored` and `indexes` — and **does not opt out**, so the model expects a `deleted_at` column.

`src/migrations/20260208110001-create-decision-logs-table.js` creates **no `deleted_at`**. No later migration adds one; `decision_logs` is named in exactly one file under `src/migrations/`.

### §3.2 Evidence — observed locally; CI derived, not run

Authenticated `POST /api/v1/decision-logs` returns **500**:

```
POST /api/v1/decision-logs -> 500
  {"success":false,"error":"column \"deleted_at\" does not exist"}
  sql: INSERT INTO "decision_logs" (…) VALUES (…)
       RETURNING "id",…,"created_at","deleted_at";
```

- **Observed locally**, 2026-08-18. `GET /api/v1/auth/me` with the same token returned 200, so the failure is at persistence, not authentication.
- **Not observed in CI.** No test exercises this route, so no CI run has produced the result. **Derived, and labelled as derived:** the migration creates no `deleted_at`, no later migration adds one, therefore a migrations-only database lacks the column and the same INSERT fails. This half should be converted to an observation before the finding is closed.

### §3.3 Dating — the route has never worked

- Global `paranoid: true` added at `9329b2b5`, **2026-01-09**.
- `src/migrations/20260208110001-create-decision-logs-table.js` added at `7ae309f2`, **2026-02-08** — one month later.

**The table was created into a codebase where the model already required `deleted_at`.** `POST /api/v1/decision-logs` has never persisted a row.

---

## §4. The common mechanism

Both defects originate in **`9329b2b5` (2026-01-09)**, which added `underscored: true` to `ActivityLog` and `paranoid: true` to the global `define` block in the same commit. Neither change was accompanied by a migration reconciling existing or subsequent tables.

The class is: **a model-level declaration that changes the SQL Sequelize generates, landed without the migration that makes the schema satisfy it.** It is invisible to `node --check`, to `eslint`, to `scripts/validate-routes.js`, and to the test suite, and it surfaces only as a runtime 500 on a route nothing exercises.

---

## §5. What this blocks, and the corrections owed forward

### §5.1 Gate G3 clause 3 is unmeetable, and was unmeetable when specified

**F-AUTH-1 Fix Plan v2.53 §4 states:** *"Executing §1 makes Gate G3 clause 3 meetable. The test at §1.1 fails today and passes after."*

**That is false.** v2.53 §1.1's assertions 1 and 2 require a persisted `user_id` on `decision_logs`. No row is ever persisted. The specified test fails **before and after** `ed3461c5`, for a reason unrelated to F-Auth-5. Assertion 3 — that an anonymous POST persists no row — is meetable today, and passes for the wrong reason: the route persists nothing for anyone.

**v2.53 §1.1 was written on 2026-08-18 against a route that had not functioned since 2026-02-08, and the route was not exercised before the specification was written.** This is a specification wrong about what is practical rather than wrong about the world, and it is the register's first recorded instance of that shape.

### §5.2 v2.53 §2's characterisation of the `decisionLogs.js:22` site

v2.53 §2 corrects v1.5 §4.6 forward, holding that the site had been *"silently writing the wrong value"* since `7ae309f2`. **For this site the stronger and more accurate statement is that it was writing nothing at all** — `req.user?.sub` never reached a successful INSERT. The F-Auth-5 change at `:22`, landed at `ed3461c5`, is correct and is currently unreachable.

**What does not change:** F-Auth-5's direction, and the other five sites. Those persist through routes not known to share this defect, and none was checked for it.

### §5.3 v2.52 §1.2's middleware enumeration

Incidental to this finding and recorded so it is not lost: v2.52 §1.2 refers to *"the three middlewares"*. There are **five** `req.user = {…}` assignment sites — three in `src/middleware/auth.js` (`:235`, `:339`, `:510`) and two in `src/middleware/jwtAuth.js` (`:40`, `:92`). **The substantive claim holds** — `grep -rn "sub:" src/middleware/` returns zero, so no site sets a `sub` key — **but the enumeration is scoped to one file and is a floor.**

---

## §6. Population — measured

**The measurement was run. 146 models were checked against a database built by migrations alone. 27 declare columns that database does not have.**

### §6.1 How the first two were found, and why that mattered

**Neither of the first two instances was found by a search for this defect class.** `activity_logs` surfaced while correcting a false claim in a test comment; `decision_logs` surfaced while attempting to write the Gate G3 clause 3 test. That was a **sample of convenience, not a search** — it found exactly the two models the session happened to touch, and would have found no others no matter how many existed.

**Two was never a floor. It was the count of models examined.** This section exists because reporting it as a population would have been the v2.52 §4.1 error committed inside the document that records the rule. The measurement below replaces it.

### §6.2 Method — ground truth on both sides, not grep on either

| Side | Instrument | What it removes |
|---|---|---|
| Models | Loaded via `src/models/index.js`; read `Model.getTableName()`, `Model.rawAttributes[*].field`, `Model.options.paranoid` | Sequelize resolves the effective options, so declarations inherited from the global `define` block (`src/config/sequelize.js:56-66`), a base class, or a spread are all included. Grepping `underscored: true` would miss every one of those. |
| Schema | A scratch database built by `sequelize db:migrate` alone, read via `information_schema.columns` | No migration-file parsing. Conditional creates, inline DDL inside a migration, and later `ALTER`s are reflected exactly as they land. **210 migrations applied, 0 pending.** |

A model is **mismatched** when it names a column the migrated schema does not contain.

**Method validation.** Both independently-observed instances reproduce exactly: `ActivityLog` → missing `user_id, action_type, …`, matching the CI error at Validate run `32149440997`; `DecisionLog` → missing `deleted_at`, matching the local 500 at §3.2. The measurement was not tuned to produce them.

### §6.3 Result — three buckets

| Bucket | Count | Meaning |
|---|---:|---|
| 1 — matched and consistent | **80** | every column the model names exists |
| 2 — matched and **MISMATCHED** | **27** | model names columns the migrated schema lacks |
| 3 — no table of that name | **39** | no table matching `tableName` after all migrations |
| | **146** | models resolved (of 154 files in `src/models/`) |

**These are the first-pass figures and they sum to 146.** §6.3.2 re-files one model — `ProcessingQueue`, whose table exists under a different spelling — from bucket 3 to broken, giving the **28 / 38** used at §0 and in the closing line. Both sets are recorded rather than one silently replacing the other, so a reader reproducing the run sees 27/39 from the script and knows why the mint says 28/38.

**The core entities are clean.** `Episode` → `episodes` and `Show` → `shows` are both bucket 1 with zero missing columns. **Migrations are authoritative for the system's primary tables**, so the defect is not that `src/migrations/` is bypassed wholesale — it is that specific models drifted from it. Bucket 3's membership is peripheral: `layer_presets`, `markers`, `outfit_sets`, `script_templates`, `wardrobe_usage_history` and similar.

**Bucket 2 in full**, model → table → missing columns:

| Model | Table | Missing |
|---|---|---|
| `ActivityLog` | `activity_logs` | `user_id, action_type, resource_type, resource_id, old_values, new_values, ip_address, user_agent, deleted_at` |
| `EpisodeScript` | `episode_scripts` | 20 columns incl. `show_id, script_text, script_json, word_count, edited_by` |
| `SceneAngle` | `scene_angles` | 15 columns incl. `angle_description, camera_direction, quality_score` |
| `Thumbnail` | `thumbnails` | `publishStatus, isPrimary, publishedAt, publishedBy, unpublishedAt, platformUploadStatus, platformUrls, deletedAt` |
| `MetadataStorage` | `metadata_storage` | `episode_id, extracted_text, scenes_detected, sentiment_analysis, visual_objects, extraction_timestamp, processing_duration_seconds, deleted_at` |
| `StorytellerBook` | `storyteller_books` | `theme, pov, tone, setting, conflict, stakes` |
| `SceneSet` | `scene_sets` | `base_still_url, style_reference_url, negative_prompt, variation_count, cover_angle_id` |
| `Asset` | `assets` | `s3_url_no_bg, s3_url_enhanced, processing_status, processing_metadata` |
| `EpisodeAsset` | `episode_assets` | `usage_type, scene_number, display_order, metadata` |
| `EpisodeScene` | `episode_scenes` | `clip_status, display_title, effective_duration, deleted_at` |
| `HairLibrary` / `MakeupLibrary` | `hair_library` / `makeup_library` | `is_just_a_woman_style, deleted_at` |
| `StorytellerChapter` | `storyteller_chapters` | `sections, chapter_template` |
| `RegistryCharacter` | `registry_characters` | `world` |
| `DecisionLog` | `decision_logs` | `deleted_at` |
| `AIUsageLog`, `AssetUsageLog`, `CharacterArc`, `CharacterProfile`, `CharacterState`, `CharacterTherapyProfile`, `EditMap`, `EpisodeWardrobeDefault`, `SceneLibrary`, `StoryTaskArc`, `UniverseCharacter`, `WardrobeContentAssignment` | — | `deleted_at` only |

### §6.3.1 Three defect axes, counted separately

**A single "mismatched" count blurs three different defects with three different remedies.** Each missing column was classified by comparing against the columns the table actually has, so *"the model asks for `user_id` and the table has `userId`"* is separated from *"the model asks for `script_text` and the table has nothing resembling it"*.

| Axis | Meaning | Models |
|---|---|---:|
| **P** | `deleted_at` absent under `paranoid: true` | **19** |
| **N** | naming mismatch — a case-variant of the column exists | **4** |
| **A** | column absent entirely — no variant of any spelling | **10** |

Sums to 33 against 27 mismatched models because **6 models fail more than one axis**: `metadata_storage`, `activity_logs`, `hair_library`, `makeup_library` (P + N); `thumbnails`, `episode_scenes` (P + A).

**Declaration counts, for scale:** **110 of 146** models declare `paranoid: true`; **145 of 146** declare `underscored: true`. The axes are near-universal declarations; what varies is whether the migration honoured them.

**Axis P (19)** is one mechanical decision — add `deleted_at`, or opt the model out. Includes `decision_logs`, the Gate G3 clause 3 blocker.

**Axis N (4)** is a rename, and one member is not a plain snake/camel split: `hair_library` and `makeup_library` declare `is_just_a_woman_style` against an actual column `is_justAWoman_style`. `activity_logs` and `metadata_storage` are the straightforward cases.

**Axis A (10)** is not a mismatch to reconcile at all — **it is migrations that were never written.** `episode_scripts` (20 columns), `scene_angles` (15), `thumbnails` (8), `storyteller_books` (6), `scene_sets` (5). These models describe schema that has no migration anywhere, which is a different failure from the two worked examples and plausibly a different owner.

### §6.3.2 Bucket 3 re-examined — the table-name false negative

**Bucket 3 membership is decided by whether the table exists after all 210 migrations run, not by migration filenames.** A table created by any means — `createTable`, raw SQL, inside a conditional — exists and removes the model from bucket 3. **The residual false negative is at the other end: a model whose `tableName` does not match what the migrations actually built.** That was checked by comparing each bucket-3 table name against every table in the migrated schema, ignoring case, underscores and trailing `s`.

| Sub-bucket | Count | |
|---|---:|---|
| **3a** — table exists under a different spelling | **1** | a real mismatch, mis-filed by the first pass |
| **3b** — no table under any spelling | **38** | |

**3a, in full:** `ProcessingQueue` declares `tableName: 'processing_queue'`; the migrations build **`processing_queues`**. Every query this model issues names a relation that does not exist. **It is a 28th broken model, not a model without a migration**, and the first pass would have reported it as the latter.

**Within 3b, four tables are named in migration source but never created:** `wardrobe_library`, `layer_assets`, `continuity_beats`, `scene_set_episodes`. Those migrations `ALTER` a table they expect to already exist and skip when it does not — visible in CI as *"layer_assets table does not exist, skipping migration"*. **Something other than a migration is expected to create them.** Six request-path `.sync()` calls exist (§6.5) and `ContinuityBeat` is among the models they sync. **Whether these four are the same tables is not checked here** — see §9 on the `PE #62` overlap, which this finding names and does not resolve.

### §6.3.3 The `underscored` axis has one dissenter, and it is informative

**145 of 146 models declare `underscored: true`. The single exception is `Thumbnail`** — and `thumbnails` is correspondingly built with camelCase columns (`episodeId`, `s3Bucket`, …), so the model and its table agree on naming. Its 8 missing columns are Axis A, not Axis N: attributes with no migration at all.

**36 of 146 do not declare `paranoid: true`.** For those, an absent `deleted_at` is not a defect, which is why Axis P counts 19 and not the whole of bucket 2.

### §6.4 A third confirmed route failure, and it is one of F-Auth-5's own sites

`Thumbnail.findByPk(…)` against the migrated schema fails with **`column "publishStatus" does not exist`** — verified by probe, 2026-08-18.

`src/services/ThumbnailService.js:13` calls `findByPk` before its stubbed publish logic, so **`POST /api/v1/thumbnails/:id/publish` — site 6 of the six remediated at `ed3461c5` — also returns 500 on a migrations-built database.** The F-Auth-5 change at that site is correct and, like `decisionLogs.js:22`, currently unreachable.

**Three route failures are now confirmed by probe: `audit-logs`, `decision-logs`, `thumbnails/:id/publish`. The other 24 bucket-2 models were not probed.**

### §6.4.1 Which path builds a deployed database — narrowed from the repository

**The question that decides this finding's severity is whether a deployed database is built by migrations or by `sequelize.sync()`.** If sync runs, the model's declaration wins and these mismatches are invisible there. If migrations run, a deployed database has the same gaps the measured schema has.

**What the repository establishes:**

- **`sync()` requires `ENABLE_DB_SYNC === 'true'`** (`src/app.js:70`), and `alter` requires a second flag, `DB_SYNC_ALTER === 'true'` (`src/app.js:82`). **There is no `NODE_ENV` gate.**
- **Nothing in the repository sets either flag.** Not `.env`, `.env.production`, `.env.production.template`, `.env.example`, `ecosystem.config.js`, any workflow, or any deploy script. The only occurrences are two diagnostic scripts that print them and one migration comment.
- **Both deploy paths run migrations:** `.github/workflows/deploy-production.yml:70` and `:267`; `.github/workflows/deploy-dev.yml:123` and `:341`.

**Therefore, on the deploy path as written, a deployed database is built by migrations — the same path as the measured schema.** That makes `GET /api/v1/audit-logs` and `POST /api/v1/decision-logs` likely broken in the deployed environments in exactly the way they are broken in CI.

**What the repository also establishes, and it cuts the other way:** **sync has been used historically.** `scripts/fix-missing-tables.js:3` describes itself as fixing *"missing tables after DB_SYNC_FORCE incident"*, and `src/migrations/20260323100000-add-scene-sets-generation-status.js:7` records a column that *"was never added via migration — only present when ENABLE_DB_SYNC + alter"*. **Some database has been shaped by sync at some point.** A deployed schema may therefore carry columns the migrations never created.

**What remains unestablished, and is not repository-answerable:** the actual column state of any deployed database. Prod is FROZEN and no host was contacted. **This section narrows the question from "which provisioning system" to "migrations by the deploy path, with evidenced historical sync of unknown extent" — it does not close it.** Closing it is an infrastructure read and is owed.

### §6.5 What this measurement cannot see

Stated per v2.51 §4.1, because the number above will otherwise become the next "36 gates":

- **It describes a migrations-only database, not any real one.** Deployed databases may carry columns added by `sequelize.sync()` — `src/app.js:87` under `ENABLE_DB_SYNC`, and **six request-path `.sync()` calls** at `src/routes/continuityEngine.js:40-43`, `src/routes/franchiseBrainRoutes.js:66`, and `src/routes/memories/engine.js:2434,3183,3470`. **Whether dev or prod match this schema is unmeasured; no deployed host was contacted.**
- **Bucket 2 counts models, not broken routes.** A missing column breaks any query naming it, and for `paranoid` models that is every query — but only three were confirmed against an actual route. The other 24 are unprobed.
- **Bucket 3 is not classified.** 39 models have no migration-created table. Some are created at runtime by the `.sync()` calls above — a different disposition that overlaps the `PE #62` residue item — and some may be unused. **This finding does not sort them, and does not claim they are defects.**
- **146 of 154 model files resolved.** Models not exported by `src/models/index.js` are invisible to this method. `RawFootage` was stubbed at load time and may be misrepresented.
- **Extra columns are not flagged.** Only columns the model names and the schema lacks. A table with columns no model declares would read as consistent.

---

## §7. Remedy — not authorized, not performed

**The remedy is per-table and the choice is real, not a formality.** For the two worked examples:

| Table | Option A — correct the schema | Option B — correct the model |
|---|---|---|
| `activity_logs` | migration renaming eight columns to snake_case | remove `underscored: true` from `ActivityLog` |
| `decision_logs` | migration adding `deleted_at` | set `paranoid: false` on `DecisionLog` |

**The same choice exists for the other 25**, and the three sub-shapes at §6.3 do not all take the same answer. The 14 `deleted_at`-only models are a single mechanical decision. The camelCase/snake_case case is a rename. The *model-newer-than-migration* group (`EpisodeScript` missing 20 columns, `SceneAngle` 15, `Thumbnail` 8) is not a mismatch to reconcile but **migrations that were never written**, and may indicate features shipped in models without their schema.

**Option A is more consistent with stated project convention** — `CLAUDE.md` records global paranoid mode and requires `deleted_at` in migrations — **and Option A is the more dangerous**, because renames and column adds touch tables that may hold rows on databases this finding has not inspected. **No database beyond the local test instance and the scratch instance was examined; row counts and column contents anywhere else are unmeasured.**

**Sequencing note.** Remediating all 27 is a program, not a change. Gate G3 clause 3 needs only `decision_logs`, and that is the smallest of the three sub-shapes — one added column. **Authorizing that one table's migration would unblock the clause 3 test without waiting on the rest**, and is the narrowest thing that moves the gate.

**Nothing here is authorized and nothing has been changed.** A revision must authorize any migration before it is written.

### §7.1 Direction ruled in session — migrations as the single source of schema truth

**Recorded as a ruling given in the course of this work, with no written basis in the register. It is not an authorization and this document cannot make it one.**

The direction is **migrations only**. The stated grounds: `sync({ alter: true })` ships a schema change as a side effect of editing a model file — no separate artifact, no review gate, no down path, and the ability to drop columns when a model narrows. **In a repository whose premise is that every change is authorized, shipped and closed against a register, a schema that cannot be reconstructed from version control is the one artifact with no provenance.**

**The sequence, and the order matters because the first step gates the rest:**

1. **Establish what a deployed schema actually is.** Prod is FROZEN; this is the infrastructure read already owed at §6.4.1 and is not repository-answerable.
2. **Generate a baseline migration reproducing it exactly.**
3. **Verify equivalence** — dump both schemas and diff.
4. **Decide the disposition of the sync code path.** Note this is not "disable sync": `ENABLE_DB_SYNC` is set nowhere in the repository (§6.4.1), so the path is already unreachable as configured. The open item is whether to delete it, which is a code change requiring authorization.

**Steps 2–3 are where this finding's 28 broken models and 38 no-table models get resolved**, because a baseline has to account for every one of them. **That makes FD-66 a precondition of the baseline, not an independent cleanup.**

### §7.1.1 Sequencing ruled — `decision_logs` first, as the pilot

**Ruled: the `decision_logs` migration goes first, ahead of the baseline and ahead of the infrastructure read.** It is one added column — the smallest item in Axis P — and it unblocks Gate G3 clause 3, which is blocked on nothing else.

**The grounds are not expedience.** It is the **first schema change under the migrations-only ruling**, so it exercises authorize → ship → close on a *migration* rather than a code edit, and produces a worked example of that cycle before the baseline has to produce one accounting for 66 models. **If the discipline is wrong somewhere, one column is a cheaper place to discover it than a baseline.**

**Order relative to the owed infrastructure read (§6.4.1):** the read stays the highest-leverage owed item, and steps 2–4 above wait on it. But it is blocked on a frozen environment and a deliberate window, whereas this is blocked only on an authorization. **They are not competing; one is gated on access and the other is not.**

**Still requires authorizing.** This document does not authorize the migration. It records that the sequencing question has been ruled.

**Caveat on the ruling's basis.** It was given against a report of the sync call site and deploy path rather than a first-hand reading of them, and the reporting party flagged that. The underlying facts have since been verified and are cited at §6.4.1 — the ruling's grounds hold, but **a ratifying revision should restate them from the citations rather than inherit them from here**, which is the v2.47 §4.1 failure this register has already recorded five times.

---

## §8. Provenance

**This finding was produced by the correction of an error, not by a search for defects.**

A comment shipped at `4573d253` claimed no migration creates `activity_logs`. The claim was wrong: the search ran against `migrations/` at the repository root, while `.sequelizerc` points `migrations-path` at `./src/migrations/`. **The repository has two migration directories and only `src/migrations/` is read by Sequelize.** Correcting that at `b321cb74` established the real mechanism for `activity_logs`; applying the corrected search path to `decision_logs`, while attempting to write the Gate G3 clause 3 test, produced Instance B.

**Neither instance was found by a check the system runs.** Both were found by re-reading a claim that had already been made.

### §8.1 Sourcing rule applied to this document

**Every factual claim in this finding is traced to an observation made during the session that produced it** — a file read, a command run, a CI log, or a git query — and claims that could not be so traced were cut rather than softened. Where a claim is reasoned from the repository rather than observed, it is labelled as derived at the point it is made (§3.2 is the only such claim).

**This rule exists because it was needed.** During this session, summaries of the work — including a commit SHA and a test result — were asserted and turned out to have no referent. Structural reasoning survived that; factual assertion did not. **A mint is the wrong place to discover the difference**, so the separation is made explicit here: this document's framing may be argued with, and its facts should be re-derivable from the citations without trusting any summary, including its own §0.

---

## §9. What this finding does not establish

- **It establishes the population against a migrations-only database and against nothing else.** 27 of 146 models mismatch that schema (§6.3). Whether any deployed database matches that schema is **unmeasured** — `sequelize.sync()` at `src/app.js:87` and six request-path `.sync()` calls may have added columns there (§6.5).
- **It does not establish 27 broken routes.** Three were probed (§6.4). The other 24 are models with missing columns and no route observation.
- **It classifies bucket 3 only by name, not by disposition.** Of 39, one (`ProcessingQueue`) is a table-name mismatch and is a defect (§6.3.2); 38 have no table under any spelling, and **this finding does not sort them.** Four are named in migration source but created elsewhere; six request-path `.sync()` calls exist and could account for some. **The rest may be unused, may be dead, or may be broken — not established, and not claimed as defects.**
- **It names the `PE #62` overlap and does not reconcile it.** `PE #62` is recorded as F-App-1 residue, filed and unowned (v2.43, v2.45). **This finding did not read what `PE #62` documents and makes no claim about its contents** — only that runtime-created tables are territory the two items may share. Reconciling them is separate work against an unowned item.
- **It does not establish CI behaviour for `decision_logs`.** §3.2 is observed locally and derived for CI.
- **It does not establish the state of any deployed database.** No deployed host was contacted; prod is FROZEN. Whether `activity_logs` or `decision_logs` on dev or prod match their migrations is unmeasured.
- **It does not establish that the two instances share a cause beyond `9329b2b5`.** Both trace to that commit; whether any process failure explains it is not investigated here.
- **It mints no XK.** The defect class spans beyond F-AUTH-1's artifact, which may make it cross-keystone-shaped; XK admission requires a ratifying revision and is not claimed here.
- **It changes no gate and discharges nothing.** Gate G3 remains NOT DISCHARGED, clause 3 unmet. FD-65 remains OPEN and P0 and is untouched by this finding.

---

## §10. Vehicle — ruled, with one residual

**Ruled: FD-66 is minted in its own revision and is NOT folded into the F-Auth-5 closure.** The grounds: the closure revision's job is reporting what `ed3461c5` did against v2.53 §1. Bundling a P0 with a different remedy, which additionally gates a strategy decision, into a report about six line edits would make that document the register's largest and bury the P0 inside it.

**This document is that vehicle**, on the `F-Deploy-1_Finding_*_DRAFT` precedent of standalone findings filed in `docs/audit/`.

**Residual, not settled.** FD-65 was minted inside a *versioned* Fix Plan revision (v2.49). Whether a standalone finding document is itself sufficient to mint, or whether a versioned revision must ratify it and this document is the evidence that revision cites, is a register convention this document cannot decide. **It is filed as DRAFT for that reason, and the numeral FD-66 should be treated as claimed-not-confirmed until a ratifying instrument says otherwise.**

---

*Type: Finding. **Mints FD-66, P0 (ruled, §0.1)**. FD tail: **FD-65 → FD-66**. XK tail unchanged at **XK-3**. **Population measured: 28 of 146 models broken against a migrations-only schema — 19 on the `paranoid`/`deleted_at` axis, 4 on column naming, 10 on columns absent in every spelling, 1 on table naming, 6 on more than one axis. 38 further models have no table under any spelling and are not classified. 3 route failures confirmed by probe; 25 broken models unprobed.** Ships no code. Changes no gate. Authorizes nothing. Local test and scratch databases contacted; scratch created and dropped three times, removal confirmed each time; no request issued to any deployed host. Prod FROZEN.*
