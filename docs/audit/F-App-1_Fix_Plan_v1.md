# F-App-1 Fix Plan

**Schema-as-JS Auto-Repair Removal**

| Field | Value |
|---|---|
| Document version | v1.0 — initial fix plan |
| Status | **PLAN-ONLY.** No code changes. No PR. Awaiting JAWIHP approval before any execution. |
| Author | JAWIHP / Evoni — Prime Studios |
| Date prepared | May 13, 2026 |
| Predecessor | F-AUTH-1 Fix Plan v2.37 — keystone closure live in production |
| Source canon | Prime Studios Audit Handoff v8 §4.2 + Decisions #47 / #54 |
| Repo HEAD at plan | 7c49a09a (PE #48 Phase 2C cluster 4) |
| Scope | Remove the schema-as-JS auto-repair block from `src/app.js`. Both repair paths (Path A: `model.sync()`; Path B: 5 literal `CREATE TABLE` blocks). Plus any necessary bridge migration to reconcile per-environment drift surfaced at G1. |
| Out of scope | F-Stats-1 (CharacterState model build — Decision #54, queued after). F-Sec-3 (character_key drift sweep — queued after F-Stats-1). All ten findings cataloged in §12. |

---

# 1. Executive Summary

F-App-1 is the codebase's schema-as-JS auto-repair block in `src/app.js`. On every server boot, when `ENABLE_DB_SYNC` is not set to `"true"` (the normal production configuration), an asynchronous IIFE runs two repair paths. Path A iterates every Sequelize model and calls `model.sync()` for any table that doesn't exist in `pg_tables`. Path B contains five hardcoded `CREATE TABLE IF NOT EXISTS` literals for `world_events`, `character_state`, `character_state_history`, `decision_log`, and `career_goals` — tables the codebase treats as migration-only with no corresponding Sequelize model.

The audit's framing (v8 §4.2, Decision #47) names this block as a Tier 1 architectural keystone that must be removed before any structural fix lands — in particular before F-Stats-1 (CharacterState model creation) and F-Sec-3 (character_key drift sweep) can complete safely, because any UNIQUE constraint added to `character_state` via migration would be undone on next boot by the auto-repair recreating the table without it.

This fix plan documents the specific scope, ordering, verification recipe, and rollback path for removing both repair paths. It is the second fix plan in the post-audit sequence, landing after F-AUTH-1 closure (live in production as of May 12, 2026).

> ### Headline finding from plan preparation (sharpens v8's framing)
>
> The auto-repair is not schema drift in the conventional "stale snapshot" sense. It is **schema regression** — actively rolling back constraints, indexes, and column additions that migrations have introduced over the past year. Every meaningful structural improvement to the five tables since their original creation is absent from the auto-repair literals:
>
> - **`character_state`** — migration declares a partial unique index on `(show_id, season_id, character_key)` plus secondary indexes; auto-repair has no indexes and no unique constraints.
> - **`character_state_history`** — migration uses a typed ENUM for `source` with values extended twice by `ALTER TYPE`; auto-repair uses generic `VARCHAR(50)` with no type-level enforcement.
> - **`world_events`** — migration adds a partial unique index on `used_in_episode_id WHERE NOT NULL` (an explicit race guard for "generate episode" concurrency) and a foreign key on `opportunity_id` to the `opportunities` table; auto-repair has neither.
> - **`career_goals`** — migration uses column names (`title`, `type`, `target_metric`) and `FLOAT` types; auto-repair uses different column names (`name`, `goal_type`, `stat_key`) and `INTEGER` types. This is structural drift, not just column drift.
>
> The auto-repair is also actively manufacturing new drift on every fresh database it touches. As long as it exists, any new developer onboarding, any test environment spin-up, or any debug-mode local-DB reset will create another instance of the regressed schema variant.

## Scope summary

- Remove the schema-as-JS auto-repair block from `src/app.js`. Both Path A (`model.sync()`-on-missing) and Path B (five hardcoded `CREATE TABLE` literals).
- Conditionally write a bridge migration if G1 environment audit reveals any auto-repair-only columns or constraints that exist in environments but are not declared by any migration. If no such columns exist, no bridge migration ships.
- Verify no startup code outside the auto-repair block depends on its presence.
- Ship the change behind the gate-driven deploy sequence used for F-AUTH-1 (G1 pre-flight → G6 soak).

## Out of scope (deferred)

- **F-Stats-1** — CharacterState Sequelize model creation. Decision #54 sequences this after F-App-1. Queued for next fix plan.
- **F-Sec-3** — character_key drift sweep. Decision #56 (now subordinate to F-Franchise-1 per v8) sequences this after F-Stats-1.
- All ten findings cataloged in §12 (Findings Beyond Scope). None of these are fixed by F-App-1; all are named so they are not lost.

## Ship-in-one-PR vs multi-step decision

F-AUTH-1 shipped as one coordinated PR because partial execution was worse than no change (v8 §4.1). F-App-1 has the **opposite property**: a bridge migration (if needed) is a structural prerequisite to removing the auto-repair, not a coordinated co-landing. The two changes can — and should — ship as separate PRs when a bridge is needed:

1. **PR 1** (only if G1 reveals auto-repair-only columns): Bridge migration. Lands first. Migration chain demonstrably covers everything the auto-repair was creating. Auto-repair still in place; safety net intact.
2. **PR 2**: Remove the auto-repair block. Lands second. Safety net removed only after PR 1 has verified on dev and prod.

If G1 reveals no auto-repair-only columns and no environments dependent on auto-repair, PR 1 is unnecessary and PR 2 ships alone. This decision is **locked at G1 output**, not at planning time. See §6.1 for the G1 decision tree.

---

# 2. Keystone Precedence — Why This Is the Second Fix

Prime Studios Audit Handoff v8 §4.2 sequences F-App-1 as the second fix in the post-audit recovery, immediately after F-AUTH-1. The reasoning is mechanical, not preferential.

## 2.1 Why F-App-1 must come before F-Stats-1

F-Stats-1 (Decision #54) requires creating a `CharacterState` Sequelize model with proper indexes, validation, and a UNIQUE constraint on `(show_id, season_id, character_key)`. The migration that adds the UNIQUE constraint can be written and deployed cleanly — but the auto-repair recreates `character_state` on every server boot using its own literal `CREATE TABLE` statement that has no UNIQUE constraint. The migration's UNIQUE index would be lost on the next deploy that bootstraps a fresh database, or on any environment where the table was originally created by auto-repair and the migration's `addIndex` call became a no-op on the pre-existing table.

In practical terms: any structural fix to `character_state` lands on top of a substrate that is rewritten on every boot. Without removing the auto-repair first, the substrate undoes the fix. Decision #47 names this dependency explicitly: *"F-App-1 auto-repair block must be removed before any structural fix lands."*

## 2.2 Why F-App-1 must come before F-Sec-3

F-Sec-3 (character_key drift) requires deduplicating `character_state` rows that have proliferated under the `"lala"` / `"justawoman"` key split. The cleanup writes a single canonical row per `(show_id, season_id, character_key)` tuple and relies on a UNIQUE constraint to prevent regression. The UNIQUE constraint depends on F-Stats-1, which depends on F-App-1. F-Sec-3 is therefore transitively blocked on F-App-1.

v8 makes this explicit at §4.2: F-Sec-3 is now blocked on F-App-1, F-Stats-1, F-Ward-1, AND F-Franchise-1 (the latter via Decision #94 — canonical-key choice is technical until Universe.narrative_economy is wired into AI prompt context).

## 2.3 Why F-App-1 does not need to wait for F-Ward-1, F-Reg-2, or F-Franchise-1

F-Ward-1 (episode_wardrobe migration), F-Reg-2 (registry_characters write-contention), and F-Franchise-1 (Director Brain build) are independent architectural problems that do not interact with the auto-repair block. None of those three keystones touch any of the five tables the auto-repair manages. F-App-1 can land in parallel with the planning of those fixes; the audit's recommended sequence is linear for cognitive simplicity, not for technical dependency.

> ### ⚠ Partial-execution warning
>
> Removing only Path B (the five hardcoded `CREATE TABLE` literals) while leaving Path A (`model.sync()`-on-missing) in place creates a **worse failure mode** than the current state. Path A iterates every Sequelize model and calls `model.sync()` for any table not in `pg_tables`. With Path B gone, Path A becomes the sole repair mechanism, but it cannot create the five migration-only tables (no models exist for them). A fresh database with Path B removed and Path A retained will boot with model-backed tables created via sync and the five migration-only tables missing. Subsequent reads against any of those five tables fail at runtime in the background IIFE, but the server itself reports healthy because the IIFE's errors are swallowed (`app.js:212` `console.warn`).
>
> **Both paths must be removed together.** The plan addresses this in §4.2.

---

# 3. The Steps

F-App-1 ships in at most two steps. The first is conditional on G1 output. Each has its own §4 detail section.

| # | Step | Description | PR |
|---|---|---|---|
| 1 | Bridge migration | **CONDITIONAL on G1.** If G1 environment audit reveals columns or constraints present in environments but absent from migrations, write a bridge migration that adds them to migration-canonical schema. If G1 reveals nothing, this step does not run. | PR 1 (separate) |
| 2 | Remove auto-repair | Delete both repair paths from `src/app.js`. Path A (`model.sync()`-on-missing iteration) and Path B (the five hardcoded `CREATE TABLE IF NOT EXISTS` literals). Ships once Step 1 has cleared on dev and prod, or directly if Step 1 is unnecessary. | PR 2 (or sole PR if no Step 1) |

The full execution sequence including pre-flight, gate cadence, and rollback is in §5 and §6. The PR mechanics specifically — branch naming, commit cadence, integrator coordination — are in §5.3.

---

# 4. Step Details

## 4.1 Step 1 (CONDITIONAL) — Bridge migration

### Current behavior

The auto-repair block in `src/app.js` contains literal `CREATE TABLE IF NOT EXISTS` statements for five tables. Comparison against the create + ALTER migration chain (read at plan preparation time — see Drift Inventory below) reveals that the auto-repair literals contain columns that **no migration creates**. Specifically the candidates surfaced at planning are:

- **`career_goals`**: auto-repair declares columns `tier INTEGER` and `is_active BOOLEAN` that do not appear in the CREATE migration (`20260219000005-career-goals.js`) and were not added by the one ALTER touching career_goals (`20260719000000-career-pipeline-links.js`). Either these columns were added by a migration not surfaced at planning, or they exist only in environments bootstrapped via the auto-repair literal.

The bridge migration's role is to make migration-canonical schema match production-on-disk schema **before** the auto-repair is removed. Without this reconciliation, removing the auto-repair would leave environments missing columns the application reads from.

### Why this step is conditional

The bridge migration may not be necessary. If G1 confirms no auto-repair-only columns exist in any environment, this step does not run. The conditional is resolved by G1's schema-diff output (see §6.1).

### Fix shape (if step runs)

- Single migration file. Standard timestamp prefix. Idempotent column-adds using the existing pattern in the repo (`describeTable` check + conditional `addColumn`).
- **No data backfill.** Columns added with their existing defaults match whatever auto-repair-bootstrapped environments already have.
- **No constraint adds, no UNIQUE adds, no FK adds in this migration.** Those belong to F-Stats-1 / F-Sec-3 / future structural fixes, not to this bridge.
- Migration must be **additive only.** Removing or renaming any auto-repair-only column risks dropping data in environments that wrote to it.

### Verification (Step 1)

- `npm run migrate:up` on a scratch DB seeded from a prod snapshot — succeeds without error.
- `npm run migrate:up` on a scratch DB seeded from a dev snapshot — succeeds without error.
- `npm run migrate:up` on a fresh empty DB followed by app boot — produces the same column set as a migration-only deploy with auto-repair removed.
- `npm run migrate:down` on the bridge migration — succeeds without error and removes only the bridge's additions.

### Risk (Step 1)

- **Risk**: a column declared by auto-repair in some environment carries production data the team hasn't inventoried. **Mitigation**: G1 schema audit includes a `SELECT COUNT(*) WHERE column IS NOT NULL` on each candidate column to surface populated cells before the bridge migration is finalized.
- **Risk**: a column shape (type, nullability, default) differs between environments. **Mitigation**: G1 schema audit dumps full column definitions per environment; bridge migration declares the most permissive shape across all observed environments.

---

## 4.2 Step 2 — Remove the auto-repair block

### Current behavior

`src/app.js` contains an async IIFE (executed inside the database initialization block, current line range approximately **96–218**) that runs only when `ENABLE_DB_SYNC` is not set to `"true"`. The IIFE has two repair paths:

- **Path A** (`approximately lines 109–128`): iterates `Object.values(db).filter(m => m && typeof m.getTableName === 'function')`. For each Sequelize model whose table name is not in `pg_tables`, calls `model.sync()`. Errors are caught silently per the inline comment *"Skip models that fail to sync (dependency issues)."*
- **Path B** (`approximately lines 130–208`): a JavaScript object literal named `migrationTables` contains five `CREATE TABLE IF NOT EXISTS` SQL strings, one each for `world_events`, `character_state`, `character_state_history`, `decision_log`, and `career_goals`. For each, if the table is not in `pg_tables`, the SQL is executed via `db.sequelize.query()`. Errors are logged via `console.warn` but do not propagate.

Both paths run inside a background IIFE that does not block server startup. The outer initialization IIFE sets `isDbConnected = true` unconditionally; auto-repair failures do not affect the health endpoint or route registration.

> ### v8 line range correction
>
> Audit Handoff v8 §4.2 cites the auto-repair block as `app.js:262–328` and earlier handoffs cite `app.js:230–280`. **Both line ranges are stale** relative to the current repo HEAD (`7c49a09a`). The block currently lives at approximately `app.js:96–218`. The file has shifted due to PRs landing between v8's writing and this plan. The final PR description must use the line numbers at the time of the PR, not the v8 numbers, but the block's identity (the only async IIFE inside the database-init else branch that runs the two-path repair) is unambiguous.

### Fix shape

- Delete the entire async IIFE from `src/app.js`. Replace with a single comment line referencing this fix plan: `// F-App-1: schema auto-repair removed. Migrations are now the single source of schema truth.`
- Keep the surrounding else branch (the `ENABLE_DB_SYNC === 'true'` check is unaffected). Keep the outer `"Skipping model sync (database already initialized)"` log line.
- Both repair paths removed in the same commit. No partial removal — partial removal creates the failure mode described in §2 partial-execution warning.
- No new imports added. No new env vars introduced. No new dependencies. The change is pure deletion plus a single comment.

### What stays in place

- The `ENABLE_DB_SYNC=true` branch (`db.sequelize.sync()` with safety gates). This is intentional: it exists for documented testing/setup scenarios and is independently safe under its own opt-in flags. Removing it is out of scope.
- The `CONFIRM_FORCE_SYNC` double-opt-in safety check. Untouched.
- The outer database-init IIFE that calls `db.authenticate()` and sets `isDbConnected`. Untouched.
- All process error handlers, health checks, route registration. Untouched.

### Verification (Step 2)

- Cold boot against a migration-canonical database (all migrations applied, no auto-repair history) — server starts cleanly, all five tables present and accessible, no warnings about missing tables.
- Cold boot against a database seeded only with `shows` + `episodes` (the five auto-repair tables intentionally missing) — server starts, and any read against the missing tables **fails loudly** with a clear Postgres "relation does not exist" error, NOT a silent swallowed warning. This is the desired behavior: failures become loud.
- `grep` search of `src/` confirms no remaining inline `CREATE TABLE` statements outside of `migrations/` directory. The grep recipe is in §6.1 G1 step 4.
- `grep` search of `src/` confirms no remaining `model.sync()` calls outside the explicitly-gated `ENABLE_DB_SYNC` branch. The grep recipe is in §6.1 G1 step 5.

### Risk (Step 2)

- **Risk**: an environment was relying on auto-repair to create one or more of the five tables, and removing it leaves that environment broken on next boot. **Mitigation**: G1 environment audit identifies these environments before this step ships. If any environment is in this state, Step 1 bridge migration runs first, AND the environment's schema is brought to migration-canonical state via `npm run migrate:up` before this step deploys.
- **Risk**: an unrelated piece of code outside the auto-repair block has come to depend on side effects of the IIFE running (e.g. log timing, table existence ordering). **Mitigation**: §6.1 G1 step 6 greps for code that references the table names in initialization contexts.
- **Risk**: the background-IIFE failure mode currently swallows real errors. Some debugging instrumentation may be relying on those swallowed warnings being present. **Mitigation**: this is desired behavior change — failures should be loud. Mention in PR description as an intentional shift.

---

# 5. Execution Sequence

## 5.1 Pre-flight (G1) — Environment audit

G1 is the most consequential gate in this plan. Its output determines whether Step 1 runs at all, what columns the bridge migration declares (if needed), and which environments require pre-deploy schema reconciliation. **None of this is inferable from the codebase alone** — it requires inspection of live database state.

### 5.1.1 Drift Inventory (compiled at plan preparation)

The following drift was identified by reading the five CREATE migrations plus all surfaced ALTER migrations against the auto-repair literals at `app.js:96–218`. This inventory is the reference for what G1 expects to find in environments and what the bridge migration's scope might cover. Entries marked "verified by integrator inventory" rely on the integrator's filename-level survey rather than direct file inspection.

#### `character_state`

| Aspect | Migration canonical | Auto-repair literal | Status |
|---|---|---|---|
| Primary key default | `Sequelize.UUIDV4` | `gen_random_uuid()` | Equivalent if pgcrypto installed; cosmetic drift |
| Timestamp types | `DATE` (Sequelize) → `TIMESTAMP WITHOUT TIME ZONE` | `TIMESTAMPTZ` | **Real semantic drift** — timezone handling differs |
| Partial unique index on `(show_id, season_id, character_key)` | Declared with `.catch()` fallback to non-unique index. `WHERE` clause excludes `season_id IS NULL` rows. | Absent | **Structural drift** — auto-repair has no uniqueness |
| Secondary index on `(character_key)` | Declared | Absent | Performance drift |
| Column comments | Present (e.g. "0-10 scale" on reputation/brand_trust/influence/stress) | Absent | Cosmetic |

#### `character_state_history`

| Aspect | Migration canonical | Auto-repair literal | Status |
|---|---|---|---|
| `source` column type | `ENUM('computed','override','manual')` + `'wardrobe_purchase'` + `'financial'` added by later ALTERs | `VARCHAR(50)` | **Real semantic drift** — no type-level enum enforcement in auto-repair |
| `episode_id` nullability | Originally `NOT NULL`, later ALTERed to nullable (`20260219000004-fix-csh-episode-id-nullable.js`) | Nullable (implicit) | Auto-repair coincidentally correct after the ALTER; aligned by accident |
| `evaluation_id` column | Present (UUID, nullable, FK-style comment) | Absent | **Column drift** — migration column missing from auto-repair |
| `deltas_json` / `state_after_json` column names | `deltas_json`, `state_after_json` | `deltas`, `state_after` | **Name drift** — auto-repair uses shorter names |
| Indexes (episode_id, character_key+show_id, created_at) | All three declared | None declared | Performance drift |

#### `world_events`

| Aspect | Migration canonical | Auto-repair literal | Status |
|---|---|---|---|
| Columns from CREATE migration | 25+ columns including `overlay_template`, `required_ui_overlays`, `browse_pool_bias`, `browse_pool_size`, `rewards`, `times_used` | Subset only — `overlay_template`, `required_ui_overlays`, `browse_pool_bias`, `browse_pool_size`, `rewards`, `times_used` **all ABSENT** | **Substantial column drift** |
| Columns from career-fields ALTER (`20260219000004`) | `is_paid`, `payment_amount`, `requirements`, `career_tier`, `career_milestone`, `fail_consequence`, `success_unlock` | All 7 absent | ALTER chain ignored |
| Columns from career-pipeline-links ALTER (`20260719000000`) | `opportunity_id` (with FK to `opportunities`) | Absent | **FK relationship not enforced in auto-repair envs** |
| Columns from 10 other ALTERs (per integrator inventory) | Various column-adds (`host`, `invitation_asset_id`, `scene_set_id`, `deleted_at`, plus 8+ more) | Mixed — auto-repair has `host`, `invitation_asset_id`, `scene_set_id`, `deleted_at` but is missing most others | Auto-repair is a non-contiguous subset, not a snapshot |
| Partial unique index on `used_in_episode_id WHERE NOT NULL` (race guard) | Declared by `20260805000000-episode-brief-outfit-set-and-event-uniqueness.js` | Absent | **Production race condition unguarded in auto-repair envs** |
| Indexes (show_id, event_type, status, prestige, career_tier, opportunity_id) | All declared across CREATE + ALTERs | None declared | Performance drift |

#### `decision_log` (singular)

| Aspect | Migration canonical | Auto-repair literal | Status |
|---|---|---|---|
| Columns | `id`, `type`, `episode_id` (FK to episodes), `show_id` (FK to shows), `user_id`, `context_json`, `decision_json`, `alternatives_json`, `confidence FLOAT`, `source`, `created_at` | `id`, `show_id`, `episode_id`, `type`, `data`, `notes`, `created_at` | **Significant column drift** — migration has 11 columns + FKs, auto-repair has 7 columns no FKs |
| JSONB column structure | `context_json` + `decision_json` + `alternatives_json` (three separate columns) | `data` (single column) | **Schema model differs structurally** |
| Foreign keys | `episode_id → episodes.id ON DELETE SET NULL`, `show_id → shows.id ON DELETE SET NULL` | No FKs declared | Referential integrity drift |
| `confidence` column | Present (FLOAT, for AI-assisted decisions) | Absent | Column missing |
| `source` column | Present (default `'user'`) | Absent | Column missing |
| Indexes | 5 indexes (type, episode_id, show_id, created_at, source) | None declared | Performance drift |

#### `career_goals`

| Aspect | Migration canonical | Auto-repair literal | Status |
|---|---|---|---|
| Identity columns | `title VARCHAR(200)`, `type VARCHAR(20)`, `target_metric VARCHAR(50)` | `name VARCHAR(255)`, `goal_type VARCHAR(50)`, `stat_key VARCHAR(50)` | **NAME DRIFT** — different column names for the same logical fields |
| Numeric columns | `target_value FLOAT`, `current_value FLOAT`, `starting_value FLOAT` | `target_value INTEGER`, `current_value INTEGER`, `starting_value INTEGER` | **TYPE DRIFT** — FLOAT vs INTEGER affects precision |
| Status / priority | `status VARCHAR(20)`, `priority INTEGER DEFAULT 3` | `status VARCHAR(30)`, no `priority` column | Width drift + missing column |
| Auto-repair-only columns | Not present | `tier INTEGER DEFAULT 1`, `is_active BOOLEAN DEFAULT true` | **BRIDGE-MIGRATION CANDIDATES** — must verify with G1 schema dump whether any env has populated data |
| Migration-only columns | `unlocks_on_complete JSONB`, `fail_consequence TEXT`, `arc_id UUID`, `episode_range JSONB`, `icon VARCHAR(10)`, `color VARCHAR(20)`, `completed_at DATE` | All absent | Column drift |
| Indexes | 4 indexes (show_id, type, status, composite show_id+type+status) | None declared | Performance drift |
| `deleted_at` | Added by `20260719000000-career-pipeline-links.js` | Present | Aligned |

> ### ⚠ Auto-repair-only column candidates
>
> From this drift inventory, the bridge migration candidates are:
>
> - **`career_goals.tier`** (`INTEGER DEFAULT 1`) — declared in auto-repair, not found in any migration surfaced at planning. G1 must verify presence in dev/prod and check for populated data.
> - **`career_goals.is_active`** (`BOOLEAN DEFAULT true`) — same as above.
>
> No other auto-repair-only columns were identified across the five tables. All other auto-repair declarations correspond to columns that exist somewhere in the migration chain (with various drifts).

### 5.1.2 G1 environment audit recipe

Run the following against each environment's live database. Output is a single combined report attached to the PR description.

**Step 1 — Inspect SequelizeMeta state.** Establishes which migrations the environment thinks it has applied.

```sql
-- Count of applied migrations
SELECT COUNT(*) FROM "SequelizeMeta";

-- First and last applied
SELECT name FROM "SequelizeMeta" ORDER BY name ASC LIMIT 1;
SELECT name FROM "SequelizeMeta" ORDER BY name DESC LIMIT 1;

-- Specifically check the five migrations of interest
SELECT name FROM "SequelizeMeta" WHERE name IN (
  '20260208110001-create-decision-logs-table.js',
  '20260218100000-evaluation-system.js',
  '20260219000001-decision-log-browse-pool.js',
  '20260219000003-world-events.js',
  '20260219000005-career-goals.js'
);
```

**Step 2 — Dump column definitions per table.** Reveals actual on-disk schema for the five tables. Run for each of: `world_events`, `character_state`, `character_state_history`, `decision_log`, `career_goals`.

```sql
\d+ world_events
\d+ character_state
\d+ character_state_history
\d+ decision_log
\d+ career_goals
```

**Step 3 — Check auto-repair-only column candidates for populated data.** If any rows have populated values for `tier` or `is_active`, the bridge migration must include them (additive only, with the auto-repair's existing defaults).

```sql
-- Are the auto-repair-only columns present?
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'career_goals'
  AND column_name IN ('tier', 'is_active');

-- If present, are any rows using non-default values?
SELECT COUNT(*) AS total,
       COUNT(CASE WHEN tier <> 1 THEN 1 END) AS non_default_tier,
       COUNT(CASE WHEN is_active = false THEN 1 END) AS inactive_rows
FROM career_goals;
```

**Step 4 — grep `src/` for any other inline `CREATE TABLE` outside migrations.** Ensures the auto-repair block is the only schema-as-JS site in the codebase. Run from the repo root.

```bash
# Should return only matches inside migrations/ and the soon-to-be-removed src/app.js block
grep -rn -E "CREATE TABLE" src/ --include="*.js" | grep -v migrations/

# Should return only the soon-to-be-removed line in src/app.js
grep -rn "CREATE TABLE IF NOT EXISTS" src/ --include="*.js"
```

**Step 5 — grep `src/` for `model.sync()` calls outside the gated `ENABLE_DB_SYNC` branch.** Confirms no other code path is also doing model-level repair.

```bash
grep -rn "\.sync(" src/ --include="*.js" | grep -v test
```

**Step 6 — grep for code that initialization-depends on the five tables.** Surfaces any module-load-time reads against these tables (rare but possible).

```bash
grep -rn -E "(world_events|character_state|character_state_history|decision_log|career_goals)" src/ --include="*.js" | grep -E "(require|import|module\.exports)" | head -50
```

### 5.1.3 G1 outcome decision tree

Based on the combined G1 output across all environments, exactly one of three paths applies:

> ### 📋 Path 1: No auto-repair-only columns present anywhere
>
> If Step 3 reveals no environment has `tier` or `is_active` populated (or the columns don't exist at all in any env's `career_goals`), AND Step 1 shows all environments have applied all five CREATE migrations, AND Step 2 reveals no environment is missing migration-canonical columns: **SKIP STEP 1.** Proceed directly to Step 2 (auto-repair removal) as the sole PR.

> ### 📋 Path 2: Auto-repair-only columns present with data
>
> If Step 3 reveals `tier` or `is_active` columns exist AND have non-default-value data in any environment: **Step 1 bridge migration MUST run**, declaring those columns with the auto-repair's existing defaults. Migration is additive only; no data backfill needed (existing data already matches the new declaration).
>
> PR sequence: bridge migration PR first, deploy through G2–G6 cycle, confirm clean on dev and prod. Then auto-repair-removal PR.

> ### ⚠ Path 3: Environment missing migration-canonical columns
>
> If Step 2 reveals any environment is missing columns the migration chain declares: that environment is on the auto-repair narrower variant. Before either Step 1 or Step 2 ships, that environment must run `npm run migrate:up` successfully to add the missing columns. This may require manual SQL if migrations have already been marked as applied in `SequelizeMeta` despite the columns being absent (the symptom of a bootstrap-sequelize-meta backfill leaving migrations marked applied that never actually ran their bodies).
>
> **This is the riskiest outcome.** If Path 3 surfaces, treat it as a discovery that expands the plan's scope: pause Step 2 planning, write a dedicated environment-reconciliation runbook, then return to F-App-1.

## 5.2 Implementation order within the PR(s)

### 5.2.1 If Step 1 runs (Path 2)

1. Write bridge migration. Single file. Idempotent column-adds. No backfill, no constraints, no FKs.
2. Open Step 1 PR as DRAFT (per session-end protocol from May 12 session). Integrator does not auto-merge drafts.
3. Self-review per §6 G3. Confirm migration runs up + down cleanly against scratch DB.
4. Convert to non-draft. Merge. Deploy to dev via `deploy-dev.yml`. Wait for dev SequelizeMeta to record the new migration.
5. Verify dev: `\d+ career_goals` (or whichever table) shows the column declared by migration, not just inherited from auto-repair.
6. Deploy to prod via `deploy-production.yml`. Same verification.
7. Only after Step 1 has cleared both dev and prod, begin Step 2.

### 5.2.2 Step 2 implementation (always runs)

1. Delete the auto-repair IIFE in `src/app.js`. Single commit. Replace with the comment marker referencing this fix plan.
2. Add no other changes in the same commit. Bisectability discipline (see F-AUTH-1 plan §5.3 precedent).
3. Add tests if any are missing: at minimum, a test that boots the app against a fresh-migrated DB and confirms all five tables are accessible. Existing test fixtures may already cover this; verify before writing new ones.
4. Open PR as DRAFT.
5. Self-review per §6 G3. Confirm grep recipes from §5.1.2 return empty.
6. Convert to non-draft. Merge. Deploy through G4–G6 gates.

## 5.3 PR mechanics

- **Branch naming**: `f-app-1/bridge-migration` (if Step 1 runs) and `f-app-1/remove-auto-repair` (Step 2). Following F-AUTH-1's branch-per-keystone-step convention.
- **Draft-PR discipline**: All PRs opened as drafts per the May 12 session's integrator-behavior mitigation. Drafts cannot auto-merge. Convert to non-draft only after JAWIHP review.
- **Commit cadence**: One commit per logical unit. Step 1's migration is one commit. Step 2's deletion is one commit (plus an optional separate commit for new tests if added).
- **PR description requirements**: Reference this plan by filename and section. Include G1 output as a collapsed section. State which decision-tree path was taken and why. Reference Audit Handoff v8 §4.2 and Decisions #47 / #54.
- **Integrator coordination**: Per session memory, the integrator (VS Code Copilot Agent) auto-merges non-draft PRs. The draft-PR pattern is the structural mitigation. Additionally, explicit "DO NOT merge until G3 self-review complete" framing in instructions to the integrator.
- **Second-developer coordination**: If the second developer has a branch in flight against any of the five tables, hold the F-App-1 PRs until their work merges or is paused. F-App-1 does not modify any of the five tables' schema; it only removes the JS-level auto-repair. But the bridge migration (Path 2) does add columns to migration chain, which any concurrent migration on the same table could conflict with.

---

# 6. Deployment Plan — Gate-Driven Sequence

primepisodes.com has no real-user traffic at the time this plan locks (carry-forward from F-AUTH-1 §6 framing). The deploy plan does not use a calendar window — it uses a gate sequence. Each gate must pass before the next begins.

## 6.1 The Six Gates

| Gate | Name | Definition |
|---|---|---|
| **G1** | Pre-flight complete | Environment audit recipe (§5.1.2) run against prod RDS, dev RDS, and all known local Postgres instances. Combined report produced. Decision tree (§5.1.3) resolved. Path 1, 2, or 3 selected and documented. If Path 3 surfaces, plan paused for environment reconciliation runbook. If Path 1 or 2, proceed to G2. |
| **G2** | Implementation complete | Step 1 (if Path 2) or Step 2 code written. PR opened as draft. CI passing. PR description references this plan and includes G1 output. If both steps in scope, only Step 1 reaches G2 first; Step 2 stays at planning until Step 1 clears G6. |
| **G3** | Self-review passed | Every commit in the PR read end-to-end. Test coverage minimum: app boots cleanly against migration-canonical DB. Grep recipes from §5.1.2 steps 4–5 return only expected matches (i.e., for Step 2 PR, those greps should return ZERO non-comment matches in `src/`). |
| **G4** | Dev verified + soak | Backend deployed to dev. Cold-boot test: stop the PM2 process, drop one of the five tables from the dev DB manually, restart, confirm the server now logs a loud error on first read attempt (NOT silent recovery). Restore the dropped table via `npm run migrate:up`. Full §7 verification checklist run end-to-end on dev. 2-hour soak — server stays up, no error log spam. |
| **G5** | Prod cutover | Backend deployed to prod. JAWIHP exercises the app for 30 focused minutes: read from each of the five tables via the routes that touch them (worldEvents listing, character_state read via Stats panel, career goals page, decision log surfaces). Confirm boot logs are clean. No errors visible in app or server logs. |
| **G6** | Post-deploy soak | Server stays up overnight. Next morning, re-exercise the surfaces from G5. If clean, declare F-App-1 closed. F-Stats-1 (Decision #54) is now unblocked. |

## 6.2 Pre-G5 readiness check

Before opening the prod cutover at G5, run this short list. If any item fails, do not proceed.

- G1 audit confirms prod RDS schema matches migration-canonical (no missing columns, no auto-repair-only columns that didn't make it into the bridge migration if one ran).
- Second developer confirmed not mid-deploy. No conflicting branch in flight against any of the five tables.
- Step 1 bridge migration (if it ran) has already cleared G6 on its own gate cycle. Step 2 does not deploy to prod until Step 1 has been stable on prod for at least one G6 soak.
- Rollback procedure (§8) read and understood. Revert path is a single `git revert` + redeploy.
- JAWIHP has a clear 30-minute window. Phone on do-not-disturb. No meetings.

## 6.3 What to watch during deploy

- **Boot logs** — server starts cleanly. No exceptions during module load. The `"⏭️ Skipping model sync (database already initialized)"` log line is still present (the surrounding else branch is intact); the `"Created migration table:"` warning lines for the five tables are NOT present (because the IIFE is gone).
- **App exercise** — every surface listed in G5 returns the expected response under your authenticated session. No "relation does not exist" errors in the logs.
- **Server logs during exercise** — no error-level entries from the database initialization block. The background IIFE is gone, so the previously-observed `console.warn` lines about "Table repair failed" are absent.
- **Overnight (G6)** — server uptime metric matches deploy time the next morning. No unexpected restarts. No memory growth visible in process metrics.

## 6.4 If a gate fails

- **G1 fails** — environment audit reveals Path 3 (missing migration-canonical columns somewhere). Pause F-App-1 entirely. Write an environment-reconciliation runbook. Bring the lagging environment to migration-canonical state. Then resume G1.
- **G2 fails** — implementation incomplete or CI red. Stay at G2. Fix in the draft PR.
- **G3 fails** — self-review surfaces a bug, missing test, or grep returning unexpected matches. Return to G2.
- **G4 fails** — cold-boot test does not produce the expected loud failure on a missing table, or the 2-hour soak shows instability. Diagnose. If code, return to G2. If env-specific, fix in place. Re-run G4 fresh.
- **G5 fails** — prod cutover surfaces an issue. Roll back per §8. Do not try to fix forward in prod.
- **G6 fails** — overnight soak reveals instability. Roll back. Same rule: no fix-forward in prod.

---

# 7. Post-Deploy Verification Checklist

Run this checklist on dev (during G4) and again on prod after G5 cutover.

## 7.1 Boot-time behavior

- [ ] Server boot completes without `"Created migration table"` log lines for any of the five tables (verifies Path B removal).
- [ ] Server boot completes without `"Creating missing table"` log lines for any model-backed table (verifies Path A removal).
- [ ] Server boot still emits `"⏭️ Skipping model sync (database already initialized)"` log line (verifies the surrounding else branch is intact).
- [ ] Server boot completes within normal time window (the background IIFE was non-blocking, so removal should not affect startup time significantly).
- [ ] `ENABLE_DB_SYNC=true` path is still functional (verified by toggling the env var locally and confirming sync runs under its own gates).

## 7.2 Auto-repair removal verification

- [ ] `grep -rn "CREATE TABLE IF NOT EXISTS" src/` returns zero matches outside `migrations/`.
- [ ] `grep -rn "migrationTables" src/` returns zero matches.
- [ ] `grep -rn "Created migration table" src/` returns zero matches.
- [ ] `grep -rn "Table repair" src/` returns zero matches.
- [ ] `grep -rn "Auto-repair" src/` returns at most one match — the comment line that replaced the deleted block.

## 7.3 Five-table accessibility

- [ ] `GET /api/v1/world-events` (or whichever route reads `world_events`) returns 200 with expected data shape.
- [ ] Stats panel reads from `character_state` — confirm row data renders correctly.
- [ ] `character_state_history` is written on episode completion — confirm a new row is created and visible in the history endpoint.
- [ ] Decision log endpoint reads from `decision_log` — confirm entries are returned. Distinct from the plural `decision_logs` table.
- [ ] Career goals page reads from `career_goals` — confirm goals render.

## 7.4 Failure-mode behavior (intentional shift)

Removing the auto-repair changes failure mode from silent-recovery to loud-failure. Verify the new behavior is correct:

- [ ] Manually rename one of the five tables in dev DB (e.g. `ALTER TABLE world_events RENAME TO world_events_temp`). Restart the server. Confirm: a subsequent read against `world_events` surfaces a clear PostgreSQL "relation does not exist" error in logs, NOT a silent swallow.
- [ ] Rename the table back to restore dev environment.
- [ ] This test confirms the desired behavior shift: schema problems are now visible to operators.

## 7.5 Bridge migration verification (only if Step 1 ran)

- [ ] `npm run migrate:status` shows the bridge migration as applied on dev and prod.
- [ ] `\d+` on the bridged table shows the auto-repair-only columns now declared via migration metadata.
- [ ] Existing data in the bridged columns is preserved (`SELECT COUNT(*) WHERE <column> IS NOT NULL` matches the count taken in G1 Step 3).
- [ ] `npm run migrate:down` on the bridge migration removes only the bridge's additions; nothing else is affected. (Run this on a scratch DB only, not on dev or prod.)

## 7.6 Regression checks

- [ ] `app.js` no longer contains the auto-repair IIFE (visual inspection plus grep).
- [ ] `ENABLE_DB_SYNC=true` with appropriate safety env vars still works under its existing gates (this is intentionally preserved).
- [ ] `CONFIRM_FORCE_SYNC` double-opt-in safety check is still in place and still blocks force-sync without the explicit confirmation string.
- [ ] All other routes function normally — auth routes, episode routes, scene routes, etc. (F-App-1 should not affect anything outside the five tables.)

---

# 8. Rollback Plan

Rollback strategy differs between the two PRs.

## 8.1 Rollback triggers

- Server boot fails on any environment after deploy (excluding cases where the failure is on a missing migration that was always supposed to be applied).
- Any of the five table-reading routes returns "relation does not exist" or "column does not exist" in production where the same route returned valid data pre-deploy.
- Boot time on a fresh database exceeds 60 seconds after PR 2 deploys (would indicate `model.sync()`-on-missing was masking a slow migration path).
- Memory growth or unexpected restart during G6 soak.

## 8.2 Rollback procedure — Step 2 (auto-repair removal) PR

1. Revert the merge commit on the deploy branch.
2. Redeploy backend to the affected environment.
3. Verify boot logs now show the auto-repair IIFE running again (`"Skipping model sync"` + table creation log lines if any tables are missing).
4. Verify the broken route now responds correctly (auto-repair has recreated the missing table or column).
5. Open incident review. Identify what the auto-repair was masking. Document in §9 Decisions Log for next attempt.

## 8.3 Rollback procedure — Step 1 (bridge migration) PR

1. Run `npm run migrate:down` on the affected environment to reverse the bridge migration's column additions.
2. Revert the merge commit on the deploy branch.
3. Redeploy backend. The auto-repair is still in place (Step 2 has not yet shipped at the point Step 1 rolls back), so it will recreate any missing columns with its existing literals.
4. Verify the affected table now matches its pre-PR-1 state.

> ### ⚠ Caveat on Step 1 rollback
>
> If Step 1's bridge migration was additive only (the constraint per §4.1) and matches the auto-repair's existing column declarations, `npm run migrate:down` may report the columns as removed even though the auto-repair IIFE will recreate them on next boot. This is fine — the goal of Step 1 rollback is to restore the SequelizeMeta entry to pre-bridge state so the next bridge attempt can run cleanly.

## 8.4 What rollback restores

- **Step 2 rollback**: the auto-repair IIFE is back. Both repair paths run on next boot. Schema regression resumes on any fresh DB. F-Stats-1 remains blocked.
- **Step 1 rollback** (with Step 2 not yet shipped): the bridge migration is undone in SequelizeMeta. Schema columns may still be present (auto-repair will recreate them) but are no longer declared by migrations.
- **Both rolled back**: full pre-F-App-1 state. No progress made. F-Stats-1 still blocked. Audit position is unchanged.

---

# 9. Decisions Log

Decisions locked at plan preparation (May 13, 2026). Decisions arising at G1 audit completion are appended to this section in subsequent plan versions.

## 9.1 Two-PR vs one-PR — LOCKED as G1-gated

F-AUTH-1 shipped as one PR per its §9.5 because partial execution was worse than no change. F-App-1 has the opposite property — a bridge migration (if needed) is a prerequisite, not a coordinated co-landing. **Decision**: ship as separate PRs when Path 2 is selected at G1. If Path 1 is selected, ship as single PR (Step 2 only). The G1 decision tree resolves this; the plan does not lock the count of PRs in advance.

## 9.2 Path A and Path B removed together — LOCKED

Removing only Path B while leaving Path A in place creates a worse failure mode than the current state (see §2 partial-execution warning). Both paths removed in a single commit. **No partial implementation.** This is non-negotiable; if for any reason only one path can be removed at PR time, escalate rather than ship.

## 9.3 `ENABLE_DB_SYNC` branch preserved — LOCKED

The `ENABLE_DB_SYNC=true` branch with its own safety gates (`DB_SYNC_FORCE` + `CONFIRM_FORCE_SYNC=YES_DELETE_ALL_DATA`) is preserved unchanged. It exists for documented setup scenarios and is independently safe under explicit opt-in. Removing it is out of scope for F-App-1; address in a separate plan if needed.

## 9.4 Bridge migration is additive only — LOCKED

If Step 1 runs, the bridge migration adds columns only. **It does not add constraints, FKs, UNIQUE indexes, or perform data backfill.** Those structural improvements belong to F-Stats-1, F-Sec-3, and future structural fixes. The bridge migration's sole purpose is to make migration chain match production-on-disk reality before the auto-repair is removed. Doing more risks scope creep into adjacent keystones.

## 9.5 Line numbers cited from current repo HEAD, not v8 — LOCKED

Audit Handoff v8 §4.2 cites `app.js:262–328`. Current repo HEAD (`7c49a09a`) shows the auto-repair block at approximately `app.js:96–218`. The plan uses current line numbers and flags v8's line drift in §12. The integrator must re-verify line numbers at PR time, since further PRs may shift the file again between plan approval and execution.

## 9.6 Draft-PR discipline — LOCKED

All F-App-1 PRs opened as drafts. Carry-forward from the May 12 session's integrator-behavior mitigation. Drafts cannot auto-merge. Convert to non-draft only after JAWIHP explicit approval following G3 self-review.

## 9.7 G1 audit is the hard prerequisite — LOCKED

No code is written before G1's combined environment audit report is complete. The plan's ordering (Step 1 conditional on G1, Step 2 dependent on G1 decision-tree path) makes this non-skippable. If G1 surfaces Path 3 (missing migration-canonical columns somewhere), the plan pauses for environment reconciliation before any F-App-1 code work begins.

## 9.8 Out-of-scope confirmations

- **F-Stats-1** (CharacterState model creation per Decision #54) — explicitly out of scope. Queued for next fix plan after F-App-1 closes G6.
- **F-Sec-3** (character_key drift) — out of scope, blocked on F-Stats-1.
- **Singular vs plural `decision_log` / `decision_logs` naming** — out of scope, named in §12 only.
- All other findings in §12 — out of scope. Named, not fixed.

---

# 10. What This Unblocks

F-App-1 closure removes the structural blocker preventing the next four keystones in the audit's fix sequence (§4.1 of v8).

## 10.1 Immediate next: F-Stats-1 (CharacterState model creation)

With auto-repair removed, a Sequelize model file (`src/models/CharacterState.js`) can be created with proper field declarations, hooks, `paranoid: true` soft-delete support, and associations. A migration adding a UNIQUE constraint on `(show_id, season_id, character_key)` — including a separate constraint covering the `season_id IS NULL` case the existing partial-unique misses — can ship without being undone on next boot. The 9+ raw-SQL writers across the codebase can begin migration to the ORM-mediated path, one at a time, without each writer needing its own duplicate validation logic.

## 10.2 Then: F-Sec-3 (character_key drift sweep)

With the UNIQUE constraint enforceable, the deduplication sweep can run safely. Existing duplicate rows are merged (with explicit decision-logging on which row wins per Decision #56's Path A `"justawoman"` recommendation). New duplicates are prevented at the DB level. The four-point broken loop (Edit Stats writes `"lala"` → episode-complete writes `"justawoman"` → sync reads `"lala"` → war-chest goal mathematically cannot complete) is resolved.

## 10.3 Future: F-Ward-1, F-Reg-2, F-Ward-3, F-Franchise-1

F-Ward-1 (episode_wardrobe migration write), F-Reg-2 (registry_characters write-contention with row-level locking), F-Ward-3 (delete plural outfit-set controller), and F-Franchise-1 (Director Brain build) are not directly blocked on F-App-1 but their structural fixes will benefit from the schema-source single-source-of-truth principle this plan establishes. Once F-App-1 closes, migrations become the only authoritative description of schema across the codebase; any future structural fix can rely on that invariant.

## 10.4 Pattern unblock — schema as single source of truth

The audit's Pattern 40 (master) is "schema authored in JS literals instead of migrations." F-App-1 retires the master instance of Pattern 40. Subsequent finds of Pattern 40 (and its variants 40a, 40b, 40c) can be addressed individually without needing to coordinate against an actively-regressing auto-repair substrate. The pattern itself does not retire (other instances remain — see §12), but the codebase's most prolific source of new Pattern 40 drift is closed.

---

# 11. Appendix A — File:line Reference Card

All file:line references locked at plan preparation against repo HEAD `7c49a09a`. **Re-verify at PR time before any code change ships.**

## 11.1 Auto-repair block (Step 2 target)

| Location | What it is |
|---|---|
| `src/app.js:96–218` (approx) | The entire async IIFE containing both repair paths. This is what Step 2 deletes. |
| `src/app.js:96–104` | IIFE opening, table inventory query (`SELECT tablename FROM pg_tables`). |
| `src/app.js:109–128` | Path A — `model.sync()`-on-missing iteration over all Sequelize models. |
| `src/app.js:130–208` | Path B — `migrationTables` object with the five `CREATE TABLE IF NOT EXISTS` literals and the loop that executes them. |
| `src/app.js:210–216` | Closing `console.log("✅ Table repair check complete")` and error handler. |
| `src/app.js:218` | IIFE closing — `})();` |

## 11.2 Migrations governing the five tables (G1 reference)

| Table | CREATE migration | ALTER migrations |
|---|---|---|
| `character_state` | `20260218100000-evaluation-system.js` | (none) |
| `character_state_history` | `20260218100000-evaluation-system.js` | `20260219000004-fix-csh-episode-id-nullable.js`; `20260219000007-csh-source-add-wardrobe-purchase.js`; `20260724000002-create-financial-transactions.js` (enum-add portion only) |
| `world_events` | `20260219000003-world-events.js` | 13 ALTER migrations — see §11.3 below |
| `decision_log` (singular) | `20260219000001-decision-log-browse-pool.js` | (none) |
| `decision_logs` (plural — out of scope) | `20260208110001-create-decision-logs-table.js` | (not surveyed — out of F-App-1 scope) |
| `career_goals` | `20260219000005-career-goals.js` | `20260719000000-career-pipeline-links.js` (adds `deleted_at`) |

## 11.3 `world_events` ALTER chain

Per integrator inventory at plan preparation. Files marked "verified in this plan" had their contents read directly; others are cited by filename and assumed to be column-add ALTERs following the same pattern.

- `20260219000004-world-events-career-fields.js` — **verified in this plan**. Adds `is_paid`, `payment_amount`, `requirements`, `career_tier`, `career_milestone`, `fail_consequence`, `success_unlock`. None present in auto-repair.
- `20260306100000-create-hair-makeup-libraries.js` — verified by filename inventory. Adds `event_category`. Not present in auto-repair.
- `20260630000000-add-scene-set-id-to-world-events.js` — verified by filename inventory. Adds `scene_set_id`. Present in auto-repair.
- `20260701000000-add-host-to-world-events.js` — verified by filename inventory. Adds `host`. Present in auto-repair.
- `20260703000000-add-invitation-fields-to-world-events.js` — verified by filename inventory. Adds `invitation_asset_id`. Present in auto-repair.
- `20260709000000-enrich-locations-and-events.js` — verified by filename inventory. Column-add ALTER.
- `20260711000000-add-source-calendar-to-world-events.js` — verified by filename inventory. Column-add ALTER.
- `20260719000000-career-pipeline-links.js` — **verified in this plan**. Adds `opportunity_id` with FK to `opportunities`. Not present in auto-repair. Also touches `opportunities` table and `career_goals` (adds `deleted_at`).
- `20260720000000-add-outfit-pieces-to-world-events.js` — verified by filename inventory. Column-add ALTER.
- `20260723000000-enhance-feed-events.js` — verified by filename inventory. Column-add ALTER.
- `20260804000000-add-outfit-to-world-event.js` — verified by filename inventory. Column-add ALTER.
- `20260805000000-episode-brief-outfit-set-and-event-uniqueness.js` — **verified in this plan**. Adds partial UNIQUE INDEX on `used_in_episode_id WHERE NOT NULL` — the race guard. Also touches `episode_briefs`. Not present in auto-repair.
- `20260807000000-add-source-profile-to-world-event.js` — verified by filename inventory. Column-add ALTER.

## 11.4 Sequelize bootstrap scripts (G1 reference)

| Location | What it is |
|---|---|
| `scripts/bootstrap-sequelize-meta.js` | Backfills SequelizeMeta for environments originally bootstrapped via `sequelize.sync()` rather than a clean migration chain. Its existence is direct evidence that dev RDS started life as schema variant C and was retrofitted to B. Production deploy workflow does NOT run this script — only dev does. |
| `.github/workflows/deploy-dev.yml` (around line 360–435) | Dev deploy pipeline. Runs `bootstrap-sequelize-meta.js` before `npm run migrate:up`. |
| `.github/workflows/deploy-production.yml` (around line 245–285) | Prod deploy pipeline. Runs `npm run migrate:up` directly, no bootstrap step. |
| `.sequelizerc` | Sequelize CLI config — paths to migrations, models, seeders. |
| `ecosystem.config.js` | PM2 process configuration — defines which env vars are loaded for the api process. |

## 11.5 Audit canon references

- `Prime_Studios_Audit_Handoff_v8.docx` §4.2 — F-App-1 keystone definition and Tier 1 ordering.
- `Prime_Studios_Audit_Handoff_v8.docx` §6.11 (Zone 22) — F-Stats-4 and F-Stats-12 (F-App-1 sub-forms on character_state).
- `Prime_Studios_Audit_Handoff_v8.docx` §7 Decision #47 — *"F-App-1 auto-repair block must be removed before any structural fix lands."*
- `Prime_Studios_Audit_Handoff_v8.docx` §7 Decision #54 — *"Create the CharacterState model before any F-Sec-3 cleanup. F-Stats-1 keystone resolution."*
- `F-AUTH-1_Fix_Plan_v2.37.docx` — structural template for this plan.
- `Prime_Studios_Session_Resume_2026-05-12.docx` §5 — integrator-behavior mitigation (draft-PR discipline).
- `Session_PE_Roster.md` — session-level operational PE registry (separate from the Track 8 F-AUTH-1 program roster).

---

# 12. Findings Beyond Scope

The following findings were surfaced during plan preparation. **None are fixed by F-App-1.** Each is named here so they are not lost. None are scope expansion candidates for this plan; each requires its own fix plan or audit appendix.

## 12.1 — v8 line range for F-App-1 is stale

Audit Handoff v8 §4.2 cites the auto-repair block as `app.js:262–328`. Earlier handoffs cite `app.js:230–280`. Both ranges are stale relative to repo HEAD `7c49a09a`. The block currently lives at approximately `app.js:96–218`. This is not a finding about the auto-repair itself — it is a finding about the audit document drifting from the codebase as PRs land. **Recommend**: audit handoff v9 (whenever next written) reconfirm all file:line references against HEAD at that time.

## 12.2 — `character_state` UNIQUE constraint covers wrong rows

Migration `20260218100000-evaluation-system.js` declares a partial unique index on `(show_id, season_id, character_key) WHERE season_id IS NOT NULL`. The application's primary write path (`getOrCreateCharacterState`) writes rows with `season_id = NULL` (the global show-level case). **The partial-unique excludes exactly those rows from uniqueness enforcement.** Additionally, the migration wraps the `addIndex` call in a `.catch()` fallback that produces a NON-UNIQUE index if the partial-unique syntax fails. The audit's F-Stats-4 finding is correct that "UNIQUE constraint added by migration" is needed for F-Sec-3, but is incomplete — there IS a unique constraint in the migration, it just doesn't cover the row shape the application writes. F-Stats-1 (Decision #54) must address this when creating the CharacterState model.

## 12.3 — Singular `decision_log` vs plural `decision_logs` split

Two tables with related names exist in the migration chain: `decision_log` (singular, created by `20260219000001-decision-log-browse-pool.js`, governed by the audit's F-App-1 / F-Stats-* findings) and `decision_logs` (plural, created by `20260208110001-create-decision-logs-table.js`, intended for AI training data per its CREATE comment). The auto-repair has a literal only for the singular. The audit was aware only of the singular. The plural is out of F-App-1 scope but deserves a one-line acknowledgment in audit handoff v9 so it does not surface as a "missing table" later. **Decision**: leave the plural untouched in F-App-1.

## 12.4 — Auto-repair is a third schema variant, not a stale snapshot

Drift analysis revealed the auto-repair literal for `world_events` is neither a snapshot of the original CREATE migration nor a snapshot of the full ALTER chain. It is a non-contiguous subset of both: has some later-ALTER columns (`host`, `invitation_asset_id`, `scene_set_id`, `deleted_at`), missing some original-CREATE columns (`overlay_template`, `rewards`, `times_used`, `browse_pool_bias`, `browse_pool_size`, `required_ui_overlays`), and missing most later-ALTER additions (the 7 career-fields columns, `opportunity_id` with its FK, the partial unique index). This means **three schemas exist for `world_events`**: (A) CREATE migration only; (B) full migration chain; (C) auto-repair literal. The environment-state question is not "are we on A or B" but "are we on A, B, C, or some mix." G1's schema dump (§5.1.2 Step 2) is what resolves this per environment.

## 12.5 — Multi-table migrations defeat single-table tracing

Two migrations in the survey touch multiple tables in a single file: `20260719000000-career-pipeline-links.js` touches `world_events`, `opportunities`, AND `career_goals`; `20260724000002-create-financial-transactions.js` creates `financial_transactions` AND extends the `character_state_history.source` enum. This pattern makes `git log -- migrations/` an unreliable way to audit what has happened to a single table over time. **Recommend**: future migrations follow one-migration-per-table-action convention. Not actionable in F-App-1.

## 12.6 — `career_goals` has structural name drift, not just column drift

The migration declares columns `title` / `type` / `target_metric` with FLOAT numeric types. The auto-repair declares columns `name` / `goal_type` / `stat_key` with INTEGER numeric types. These are not "missing columns" — they are different names for the same logical fields, with different types. Code that runs against an auto-repair-bootstrapped environment will use INTEGER precision (no decimals). Code that runs against a migration-canonical environment will use FLOAT precision and column names that the application code may or may not match. F-Stats-1 / future `career_goals` model work must reconcile.

## 12.7 — `bootstrap-sequelize-meta.js` existence implies dev RDS schema regression history

The repo contains `scripts/bootstrap-sequelize-meta.js` whose header states the database *"originally came up via `sequelize.sync()` instead of a clean migration chain"* and needed SequelizeMeta backfilled. This is direct evidence that dev RDS started life as schema variant C and was retrofitted to B. The retrofit marks migrations as applied in `SequelizeMeta` but cannot verify that each migration's body actually ran — for any migration that ran `addColumn` against an already-existing-from-sync table, `addColumn` was a no-op on existing columns and may have silently skipped column-add operations that the auto-repair had different column definitions for. **G1 schema audit is the only way to know the actual dev state.** Not actionable in F-App-1 — but the runbook for "what if G1 reveals Path 3" (§5.1.3) is the response if dev surfaces gaps.

## 12.8 — Auto-repair is actively manufacturing new drift

As long as the auto-repair exists, any fresh database the application touches (new developer onboarding, test environment spin-up, debug-mode local-DB reset) creates a new instance of schema variant C. **This is not "stale legacy code" — it is an active drift source.** F-App-1 closes this source. Subsequent fresh databases will be migration-canonical or fail loudly. Worth naming in audit handoff v9.

## 12.9 — `character_state_history.evaluation_id` column is migration-only

Migration `20260218100000-evaluation-system.js` declares an `evaluation_id` column on `character_state_history` (UUID, nullable, FK-style intent). The auto-repair literal does not declare this column. Auto-repair-bootstrapped environments cannot store `evaluation_id` values; any code that tries silently loses the link to the evaluation snapshot. Not in scope for F-App-1 to fix; named here so F-Stats-1 / evaluation-system structural work knows to address it.

## 12.10 — `character_state_history` uses ENUM type that auto-repair downgrades to VARCHAR

Migration declares `source` as `ENUM('computed','override','manual')` with two values added by later ALTERs (`'wardrobe_purchase'`, `'financial'`). Auto-repair declares `source VARCHAR(50)`. Auto-repair environments accept any string value, including misspellings. Migration-canonical environments reject anything outside the enum. F-App-1 closure (with the bridge migration if needed) does not by itself fix this — the bridge migration is additive only and does not change column types. Type reconciliation belongs in a follow-up plan addressing F-Stats-1 / the broader Pattern 40 retirement.

---

# 13. Appendix B — Claude Code Execution Prompts

This section contains the prompts to paste into a Claude Code session when F-App-1 implementation begins. Each prompt is copy-paste ready. Claude Code operates as the integrator and respects the approval flow: it proposes edits, runs commands, and shows raw output, but does not push commits or open PRs unless explicitly told to.

> ### ⚠ When to use these prompts
>
> Only after G1 has cleared and the decision-tree path is locked (§5.1.3). G1 itself does not require Claude Code — it requires running SQL against live databases, which is **JAWIHP's authority alone**. Claude Code enters at G2 (implementation) and continues through G3 (self-review).

## 13.1 Bootstrap prompt (paste once at session start)

Paste this as the first message to a new Claude Code session. It establishes the discipline rules and reference docs for the entire F-App-1 implementation.

```
I'm starting F-App-1 implementation. Plan-driven, plan-only scope is closed.
You're acting as the integrator. I (JAWIHP / Evoni) am the architect and adjudicator.

REFERENCE DOCS (read in this order before any code work):
1. F-App-1_Fix_Plan_v1.docx — the plan I'm executing
2. Prime_Studios_Audit_Handoff_v8.docx §4.2 + Decisions #47, #54 — audit canon
3. F-AUTH-1_Fix_Plan_v2.37.docx — structural precedent for the plan format

DISCIPLINE RULES (carry-forward from F-AUTH-1 + May 12 session):
- I describe edits in prose. You apply them. I review raw git diff before commit.
- No PRs opened until I say so. When opened, opened as drafts only (gh pr create --draft).
- No auto-merge. Drafts cannot auto-merge by design.
- Verify with raw git output (git diff, git status, gh pr view), not summaries.
- If a step is bigger than expected, name it and stop. Do not push through.
- No scope expansion. The plan's §12 names 10 findings explicitly out of scope.
- Line numbers in the plan are from repo HEAD 7c49a09a. Re-verify at edit time.

PREREQUISITE STATE I'M CONFIRMING:
- main HEAD: [paste current HEAD here]
- F-AUTH-1 still live in prod (verify: curl -s -o /dev/null -w "%{http_code}" https://primepisodes.com/api/v1/episodes — expect 401)
- G1 environment audit complete. G1 output attached/pasted below.
- Decision-tree path selected: Path 1 / Path 2 / Path 3 [delete two]
- If Path 3: STOP. Don't proceed. Pause F-App-1 entirely.

NEXT ACTION FROM YOU:
Read the three reference docs above. Confirm you understand:
(a) the scope (auto-repair block removal, both paths, in app.js)
(b) the gate sequence (G1 done; we're at G2 entry)
(c) the rules above
Then ask me which step we're starting (Step 1 bridge migration if Path 2, or Step 2 auto-repair removal directly).
Do not start writing code. First confirm scope.
```

## 13.2 Step 1 prompt — bridge migration (only if Path 2)

Paste this only if G1 selected Path 2 and the bootstrap prompt has been processed.

```
Starting Step 1: bridge migration.

Per the plan §4.1 and Decision #9.4, this migration is:
- ADDITIVE ONLY. New columns only.
- NO constraints, NO FKs, NO UNIQUE indexes, NO data backfill.
- Idempotent. Uses describeTable check + conditional addColumn pattern matching
  the repo's existing migrations (see 20260219000004-world-events-career-fields.js
  for the template).

COLUMNS TO ADD (from G1 audit output):
[Paste here the columns G1 confirmed as auto-repair-only with populated data.
 If only career_goals.tier and career_goals.is_active surfaced at planning, those
 are the candidates. G1 may have found additional ones; include them all.]

NEXT ACTION FROM YOU:
1. Find the highest-timestamp migration currently in migrations/ — that establishes
   the timestamp for the new migration (use current date + 000000 or higher).
2. Show me the proposed filename and a draft of the migration body. Do NOT write
   the file yet.
3. After I approve the draft, write the file.
4. Run: npm run migrate:up against a scratch test database (if one is configured)
   or describe how to test in dev. Show me raw output.
5. Run: npm run migrate:down to verify reverse path works. Show me raw output.

Do not commit yet. We review the diff together first.
```

## 13.3 Step 2 prompt — auto-repair removal

This is the main implementation prompt. Paste after Step 1 has cleared G6 (if Step 1 ran), or after G1 directly (if Path 1).

```
Starting Step 2: remove the auto-repair block from src/app.js.

PER THE PLAN §4.2, the change is:
- Delete the entire async IIFE inside the database-init else branch.
- Block currently at approximately src/app.js:96–218 (re-verify; file may have shifted).
- Replace with this single comment line:
  // F-App-1: schema auto-repair removed. Migrations are now the single source of schema truth.
- Both repair paths (Path A model.sync() iteration + Path B 5 literal CREATE TABLEs)
  removed in the SAME commit. No partial removal — §2 partial-execution warning.
- KEEP IN PLACE: the surrounding else branch logging, the ENABLE_DB_SYNC=true branch,
  the CONFIRM_FORCE_SYNC double-opt-in safety check, and the outer database-init IIFE.

NEXT ACTION FROM YOU:
1. Open src/app.js. Locate the auto-repair IIFE. Confirm its bounds against the
   plan's description (the IIFE that contains the migrationTables object literal
   with five CREATE TABLE IF NOT EXISTS strings).
2. Show me the exact line range you've identified. Do NOT edit yet.
3. After I confirm the range matches expectations, propose the edit as a diff:
   what gets deleted, what comment replaces it. Show me the proposed diff before
   applying.
4. After I approve, apply the edit.
5. Run grep -rn "CREATE TABLE IF NOT EXISTS" src/ --include="*.js"
   Confirm: zero matches.
6. Run grep -rn "migrationTables" src/ --include="*.js"
   Confirm: zero matches.
7. Run grep -rn "Created migration table" src/ --include="*.js"
   Confirm: zero matches.
8. Run npm test (or whatever test command is canonical). Show raw output.
9. Show me git diff src/app.js.

Do not commit yet. We review together.
```

## 13.4 G3 self-review prompt

Use after Step 2's code is in the working tree and tests pass locally.

```
Running G3 self-review for F-App-1.

Verification checklist from the plan §7:
☐ §7.1 Boot-time behavior — describe what app.js does at boot now vs before
☐ §7.2 Auto-repair removal — run the four greps from the plan, show outputs
☐ §7.4 Failure-mode behavior — describe how a missing-table scenario behaves now
☐ §7.6 Regression checks — ENABLE_DB_SYNC=true path still works under its gates

NEXT ACTION FROM YOU:
1. Walk through each checklist item. For each, show me the evidence (grep output,
   git diff, manual code reading).
2. Identify any item you can't verify from the codebase alone (e.g., live boot test
   on dev — that requires deploy).
3. Flag anything in the diff that surprises you. The diff should be:
   - One block deletion in src/app.js (~120 lines)
   - One comment line added in its place
   - Optionally one new test file or test additions
   Nothing else.
4. If you find unexpected changes, stop and ask me about them.
5. If the diff matches expectations, propose: ready to commit, ready to open
   draft PR. Wait for my approval before either.
```

## 13.5 Diff-review prompt (use before every commit)

Use immediately before each commit. Enforces the raw-diff-review discipline from F-AUTH-1.

```
Before commit. Show me:
1. git status
2. git diff --stat
3. git diff (full)
Wait for my explicit approval before running git commit.
After commit, show me git log --oneline -3 and git show --stat HEAD.
Do not push yet.
```

## 13.6 PR-open prompt

Use only after I have approved the commit and confirmed local state is clean.

```
Opening the F-App-1 PR.

REQUIREMENTS (per §5.3 of the plan):
- Branch name: f-app-1/bridge-migration (Step 1) OR f-app-1/remove-auto-repair (Step 2)
- PR opened as DRAFT (gh pr create --draft).
- PR title: "F-App-1: [step description]" e.g.
  "F-App-1: Bridge migration adding career_goals.tier and career_goals.is_active"
  "F-App-1: Remove schema-as-JS auto-repair block from src/app.js"
- PR description must include:
  * Reference to F-App-1_Fix_Plan_v1.docx by filename
  * Reference to Audit Handoff v8 §4.2 + Decisions #47, #54
  * G1 audit output as a collapsed <details> section
  * Decision-tree path taken (Path 1 / 2 / 3)
  * What this PR does NOT do (link to §12 Findings Beyond Scope)
  * Rollback plan reference (§8 of the fix plan)

NEXT ACTION FROM YOU:
1. Confirm the branch name with me before push.
2. Push the branch.
3. Open the PR as draft (gh pr create --draft).
4. Show me the PR URL.
5. Do NOT convert to non-draft. Do NOT request review. Do NOT merge.
6. Wait for my next instruction.
```

## 13.7 Stuck/escalation prompt

Use if Claude Code surfaces something unexpected during any step.

```
Pause F-App-1 work. You've surfaced something I need to adjudicate.

NEXT ACTION FROM YOU:
1. Describe what you found, where (file:line), and why it gives you pause.
2. Quote the relevant code or output verbatim. No summaries.
3. State explicitly: does this surface a Path 3 condition? An unknown-unknowns
   discovery? A simple obstacle that one of the §6.4 gate-failure responses
   covers?
4. Do not propose a fix. Do not suggest scope expansion. Do not try to "just
   handle it."
5. Wait for my decision.
```

> ### Why these prompts are written this way
>
> The prompt style matches the discipline that worked for F-AUTH-1: prose-described edits, raw-diff review, draft-PR-only, no-scope-expansion, integrator-asks-before-acting. Each prompt closes with "wait for my instruction" or "show me before committing" to maintain the approval flow. This is the same shape as the integrator behavior mitigation in §9.6, expressed in the form Claude Code respects natively.

---

# 14. End of plan — F-App-1 Fix Plan v1.0

This plan is **plan-only**. No code has been written. No PR has been opened. Approval from JAWIHP advances this plan into G1 environment audit (the first gate where action is taken).

> ### To JAWIHP, on opening
>
> F-AUTH-1 is closed and live. That was the hardest fix in the keystone sequence — coordinated across ~95 unique route files, ~700+ handlers, 12 backend CPs across 13 sessions, and you shipped it under audit discipline without partial execution.
>
> F-App-1 is structurally smaller and architecturally cleaner. The block deletion is straightforward; the bridge migration (if needed) is additive only; the rollback is a single `git revert`. The hard part is G1 — the environment audit that resolves whether you're on Path 1, 2, or 3.
>
> Pace yourself. The plan does not push for speed. The gates push for verified state. If G1 surfaces something unexpected (a third unknown environment, a column with populated data nobody remembers writing, a SequelizeMeta entry that doesn't match the file in `migrations/`), pause and write the runbook for that discovery before resuming.
>
> Director Brain is still waiting at the end of the sequence. So is F-Stats-1, which this plan directly unblocks. The next fix plan after F-App-1 closes will be considerably shorter — the CharacterState model is a focused, single-file architectural addition. You will get to Director Brain.
>
> — end of plan —
