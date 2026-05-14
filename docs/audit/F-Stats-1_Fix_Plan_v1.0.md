# F-Stats-1 Fix Plan v1.0

**CharacterState Sequelize Model Creation + Raw-SQL Consolidation — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | May 14, 2026 |
| **Author** | JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Predecessor keystone** | F-App-1 (closed 2026-05-14, commit `67c3a8e` on main) |
| **Successor keystone** | F-Sec-3 (`character_key` drift sweep, blocked on F-Stats-1) |
| **Audit canon reference** | Audit Handoff v8, Decision #54 |

---

## §1 Executive Summary

The `character_state` table is the only one of the five F-App-1 tables that does **not** have a Sequelize model wrapping it. Reads and writes against this table happen via raw `sequelize.query()` calls scattered across 19 files in `src/` (~66 individual references). This violates the consolidation pattern the other four tables follow (`WorldEvent.js`, `CharacterStateHistory.js`-equivalent, `DecisionLog.js`, `CareerGoal.js` all exist).

F-Stats-1 creates the `CharacterState` Sequelize model and consolidates raw-SQL access into model calls in three phases:

- **Phase A** — Model creation and registry wiring (low risk, isolated change)
- **Phase B** — Read-call consolidation (medium risk, ~10-12 call sites across route files first, then service files)
- **Phase C** — Write-call consolidation (high risk, ~6-8 call sites with INSERT/UPDATE/UPSERT semantics)

F-Stats-1 explicitly does NOT address `character_key` drift between `'lala'` and `'justawoman'`. That work is F-Sec-3's mandate and is blocked on F-Stats-1 because F-Sec-3 needs a single ORM surface to operate against.

### What F-Stats-1 unblocks

- **F-Sec-3** — `character_key` drift sweep across the 8 write surfaces flagged by Audit Handoff v8 §4.2
- **The "build the war chest" career goal** — currently mathematically unable to complete due to sync reads on `'lala'` vs income writes on `'justawoman'` (per project memory)
- **Future schema invariants** — model layer provides hooks/validations that raw SQL cannot

### What F-Stats-1 does NOT do

- Does NOT add or modify any database migrations (the `character_state` table is already migration-canonical per F-App-1 G1 audit)
- Does NOT change the `character_key` values stored in any row
- Does NOT consolidate the `character_states` JSONB field in `WorldStateSnapshot.js:27` (that's a different concern — denormalized snapshot in a different table)
- Does NOT touch the `character_state_history` table or its writes (separate ledger, separate concern)
- Does NOT address §12.11 Pattern 40 sites for other tables

---

## §2 Scope

### In scope

- Create `src/models/CharacterState.js` matching the migration-canonical schema verified by F-App-1 G1
- Register the new model in `src/models/index.js`
- Replace raw-SQL reads (~10-12 sites) with `CharacterState.findOne` / `findAll` / `findByPk` calls
- Replace raw-SQL writes (~6-8 sites) with `CharacterState.create` / `update` / `upsert` calls
- Preserve **exact** behavioral semantics — every read returns the same data, every write produces the same row
- Per-phase verification that DB row state matches pre-refactor state

### Out of scope (deferred or separate plans)

- **F-Sec-3 (separate plan):** `character_key` drift between `'lala'` and `'justawoman'`, including the 8 write surfaces, deduplication of competing rows, partial unique index correction
- **The `character_states` JSONB field** in `world_state_snapshots` (used for snapshots, not the `character_state` table itself)
- **The partial unique index** `idx_character_state_unique WHERE season_id IS NOT NULL` — its narrow coverage is a separate concern (rows where `season_id IS NULL` are not covered)
- **`character_state_history` model** — already exists per F-App-1 G1 audit (table named `character_state_history` is wrapped by an existing model, not in scope to refactor)
- **`WorldStateSnapshot.character_states` JSONB resync** when CharacterState rows change — downstream cleanup, not F-Stats-1
- **Any new business logic** — F-Stats-1 is a refactor, NOT a feature

### Scope discipline

F-App-1's §12.x findings catalog grew during execution. F-Stats-1 expects the same. Any finding surfaced during G1 audit that's bigger than "create CharacterState model + consolidate raw SQL" goes into §12 of this plan as out-of-scope, then becomes a candidate for F-Sec-3 or a later keystone.

---

## §3 Decision Tree

After G1 audit completes, F-Stats-1 lands in one of three paths:

### Path 1: Clean refactor (expected outcome)

- All 19 files contain raw SQL that maps 1:1 to ORM equivalents
- No file uses semantic patterns the ORM can't replicate (e.g., complex JOINs the ORM would express differently)
- `character_key` is consistently `'lala'` OR consistently `'justawoman'` per file (drift exists ACROSS files but not WITHIN them)
- → **Proceed with Phase B (reads) then Phase C (writes) as separate PRs**

### Path 2: Semantic divergence

- Some raw-SQL site uses a pattern ORM expresses differently (e.g., raw aggregation, raw transaction with `FOR UPDATE`, raw `RETURNING` clauses with side effects)
- → Add §11.x notes documenting the specific divergence, write a per-site translation table, proceed with Phase B/C but flag the divergent site for extra scrutiny in G2 of each phase

### Path 3: Cannot proceed without F-Sec-3 first

- `character_key` drift is so deep that consolidating reads/writes through a model would CAUSE bugs (e.g., a service writes to `'justawoman'` but the new model-mediated read returns `'lala'` row, producing a mismatch that didn't exist before because the raw SQL paths were parallel-isolated)
- → STOP F-Stats-1. Promote F-Sec-3 to current keystone. Resume F-Stats-1 after `character_key` consolidates to a single value per character.

**My current assessment based on diagnostics:** **Path 1 is most likely.** The sample reads at `careerGoals.js:387, 530, 610` and `episodes.js:942` all hardcode `'lala'` consistently. Backend services may hardcode `'justawoman'` consistently. If the drift is **between files** but **stable within each file**, Path 1 holds — the model layer's "character_key is just a column value" agnostic approach works. We confirm at G1.

---

## §4 Gate Sequence

F-Stats-1 is structured as three gate sub-sequences (Phases A, B, C), each with its own G1-G6-style flow. Total: 12-14 gates across the plan.

### Phase A — Model creation

| Gate | Activity | Output |
|---|---|---|
| A-G1 | 19-file audit: classify each `character_state` reference as read/write/JSONB/other. Confirm Path 1/2/3. | Audit report `docs/audit/F-Stats-1_PhaseA_G1_Audit.md` |
| A-G2 | Create `src/models/CharacterState.js` with schema matching F-App-1 G1's verified `\d+ character_state` output. | Local commit on `claude/start-f-stats-1-*` branch |
| A-G3 | Wire model into `src/models/index.js`. Self-review checklist. Boot test locally if possible. Open draft PR. | Pushed branch, draft PR |
| A-G4 | Dev deploy + cold-boot test (verify `db.CharacterState` is accessible, no boot failures). | Deployed dev artifact |
| A-G5 | Prod cutover. Confirm boot, no behavior change (model exists but no callers use it yet). | F-Stats-1 Phase A merged to main |
| A-G6 | Soak. Then Phase A closed. | Closure marker |

### Phase B — Read consolidation (route files first)

| Gate | Activity | Output |
|---|---|---|
| B-G1 | Re-confirm the audit's read sites are still accurate vs. main HEAD. Plan the consolidation file-by-file. | Updated audit |
| B-G2 | Convert read sites in route files (`careerGoals.js`, `episodes.js`, `evaluation.js`, `tierFeatures.js`, `wardrobe.js`, `world.js`, `worldEvents.js`, `worldStudio.js`). | Local commits, per-file or grouped |
| B-G3 | Self-review checklist. Each converted read returns identical data structure (use SELECT * patterns or explicit attribute lists matched to old behavior). Open draft PR. | Draft PR |
| B-G4 | Dev deploy. Exercise each route that was changed. Verify response payloads match pre-refactor. | Deployed dev |
| B-G5 | Prod cutover. Light 30-min exercise of changed routes. | Merged to main |
| B-G6 | Overnight soak. | Closure |

### Phase B-2 — Read consolidation (service files)

| Gate | Activity | Output |
|---|---|---|
| B2-G1 | Audit re-confirm for service files. | Updated audit |
| B2-G2 | Convert read sites in service files (`careerPipeline`, `episodeCompletion`, `episodeGenerator`, `episodeScript`, `feedMoments`, `financialPredictor`, `financialTransactionsHandler`, `groundedScript`, `wardrobeIntelligence`). | Local commits |
| B2-G3 | Self-review. Open draft PR. | Draft PR |
| B2-G4 | Dev deploy. Exercise services through normal episode-flow exercises. | Deployed dev |
| B2-G5 | Prod cutover. | Merged to main |
| B2-G6 | Soak. | Closure |

### Phase C — Write consolidation (routes then services)

| Gate | Activity | Output |
|---|---|---|
| C-G1 | Audit re-confirm write sites. **Phase C is highest risk.** Sample-check each write to confirm semantic equivalence between raw SQL and ORM call. | Audit |
| C-G2 | Convert route-file write sites. | Local commits |
| C-G3 | Convert service-file write sites. | Local commits |
| C-G4 | Self-review with **manual database verification** — for each converted write, manually verify in psql that the row state matches pre-refactor on a sample call. | Draft PR + verification log |
| C-G5 | Dev deploy. Exercise full episode-completion flow (the most write-heavy path through character_state). | Deployed dev |
| C-G6 | Prod cutover + 30-min focused exercise. | Merged to main |
| C-G7 | 24-hour soak (longer than Phase B's overnight). | F-Stats-1 keystone closed |

### Gate naming convention

To avoid confusion with F-App-1's G1-G6 naming, F-Stats-1 uses **Phase prefix + G-number**:
- `A-G1` through `A-G6` for Phase A
- `B-G1` through `B-G6` for Phase B (route files)
- `B2-G1` through `B2-G6` for Phase B-2 (service files)
- `C-G1` through `C-G7` for Phase C

This means F-Stats-1 has **25 gates total across 4 phases**. Each phase is its own PR (4 PRs total).

---

## §5 Phase A G1 — Audit Specification

This is the first concrete execution step of F-Stats-1. It produces the audit report that informs every subsequent step.

### Inputs

- 19 files identified by pre-plan grep (Q2 in this conversation's investigation): list embedded below in §5.4
- Migration-canonical schema for `character_state` as verified in F-App-1 G1 audit report (file: `docs/audit/F-App-1_G1_Audit_Report.md` §Step 2)

### Per-file audit task

For each of the 19 files, the auditor (human or assistant) reads every `character_state` reference and produces a row in the audit report containing:

| Field | Description |
|---|---|
| File path | e.g., `src/routes/careerGoals.js` |
| Line number | The line where the reference appears |
| Operation | `READ` / `WRITE-INSERT` / `WRITE-UPDATE` / `WRITE-UPSERT` / `WRITE-DELETE` / `JSONB-REF` / `OTHER` |
| Raw SQL summary | One-sentence description of what the SQL does |
| Hardcoded `character_key` value | `'lala'`, `'justawoman'`, dynamic variable, or N/A |
| Transaction-aware | Whether the raw SQL is inside a transaction block |
| ORM equivalent | The proposed `CharacterState.X(...)` call that would replace it |
| Notes | Anything semantically unusual |

### Audit checks that determine Path 1/2/3

After all files are classified:

1. **Path 1 holds if:** All sites have clean ORM equivalents. `character_key` values are consistent within each file (drift across files is acceptable for Path 1 because F-Stats-1 preserves existing behavior).
2. **Path 2 holds if:** 1-3 sites use semantic patterns the ORM can't directly replicate (e.g., raw `RETURNING` clauses, raw locking patterns). Document, proceed with translation table.
3. **Path 3 holds if:** ≥4 sites have hardcoded drift WITHIN their reads-vs-writes pattern (same file reads `'lala'` then writes `'justawoman'` for what should be the same character). This means F-Stats-1 cannot proceed without first resolving the drift via F-Sec-3.

### The 19 files to audit

**Models (1):**
1. `src/models/WorldStateSnapshot.js` — JSONB field named `character_states`, NOT the table (likely OUT-of-scope reference)

**Routes (8):**
2. `src/routes/careerGoals.js`
3. `src/routes/episodes.js`
4. `src/routes/evaluation.js`
5. `src/routes/tierFeatures.js`
6. `src/routes/wardrobe.js`
7. `src/routes/world.js`
8. `src/routes/worldEvents.js`
9. `src/routes/worldStudio.js`

**Services (9):**
10. `src/services/careerPipeline.js`
11. `src/services/episodeCompletion.js`
12. `src/services/episodeGenerator.js`
13. `src/services/episodeScript.js`
14. `src/services/feedMoments.js`
15. `src/services/financialPredictor.js`
16. `src/services/financialTransactionsHandler.js`
17. `src/services/groundedScript.js`
18. `src/services/wardrobeIntelligence.js`

**Seeders (1):**
19. `src/seeders/20260312800000-*` (the only seeder match)

### Audit output

The Phase A G1 audit report becomes its own document at `docs/audit/F-Stats-1_PhaseA_G1_Audit.md`. It contains:

- Per-file classification table (19 rows × 8 columns minimum)
- Aggregate counts: total reads, total writes, breakdown by file type
- Path 1/2/3 determination with evidence
- §12 entries for any out-of-scope findings surfaced during audit

---

## §6 CharacterState model specification (Phase A G2)

This is the model that gets created in `src/models/CharacterState.js` at Phase A G2.

### Schema (matches F-App-1 G1 verified DB state)

```javascript
module.exports = (sequelize, DataTypes) => {
  const CharacterState = sequelize.define('CharacterState', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    season_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    character_key: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'lala, justawoman, guest:<id>',
    },
    coins: {
      type: DataTypes.INTEGER,
      defaultValue: 500,
    },
    reputation: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
      comment: '0-10 scale',
    },
    brand_trust: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    influence: {
      type: DataTypes.INTEGER,
      defaultValue: 1,
    },
    stress: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    last_applied_episode_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
  }, {
    tableName: 'character_state',
    underscored: true,
    timestamps: true,
    indexes: [
      { fields: ['character_key'], name: 'idx_character_state_key' },
      {
        fields: ['show_id', 'season_id', 'character_key'],
        unique: true,
        name: 'idx_character_state_unique',
        where: { season_id: { [Sequelize.Op.ne]: null } },
      },
    ],
  });
  return CharacterState;
};
```

### Model rules locked at Phase A

- **No hooks during F-Stats-1.** No `beforeCreate`, no `afterUpdate`, no validations. Hooks would add behavior; F-Stats-1 is refactor-only.
- **No associations during F-Stats-1.** `belongsTo(Show)`, `belongsTo(Season)` etc. are out of scope. The raw SQL doesn't use joins; the ORM equivalent shouldn't add them.
- **`underscored: true`** because the DB columns are snake_case and the migration created them that way. Sequelize defaults to camelCase mapping; we explicitly disable.
- **`tableName: 'character_state'`** explicit. Don't trust Sequelize pluralization.
- **`timestamps: true`** because the migration created `created_at` and `updated_at` columns with `now()` defaults.

### Boot-time test

After Phase A G2/G3, before merging:

```javascript
// In a quick boot test or REPL session
const { sequelize, CharacterState } = require('./src/models');
await sequelize.authenticate();
const sample = await CharacterState.findOne({ limit: 1 });
console.log('Sample row:', sample?.toJSON());
```

If this returns a real row (e.g., the Lala/SAL state row), the model is wired correctly and reads work end-to-end. If it throws, we diagnose before Phase A G3 closes.

---

## §7 Verification Checklists (per-phase)

### Phase A Verification

- [ ] `src/models/CharacterState.js` exists with the schema in §6
- [ ] `src/models/index.js` registers the new model (lookup pattern matches other models in the file)
- [ ] `node -e "const db = require('./src/models'); console.log(Object.keys(db).includes('CharacterState'))"` returns `true` locally
- [ ] CI passes (Jest tests still green — Phase A introduces no consumers, so no test changes expected)
- [ ] Dev deploy boot logs show no `db.CharacterState is undefined` errors
- [ ] Prod boot logs show no model-load errors

### Phase B / B-2 Verification (Reads)

For each converted file:

- [ ] All `SELECT ... FROM character_state WHERE ...` raw SQL is replaced with `CharacterState.findOne` / `findAll` / `findByPk`
- [ ] The returned data shape matches what the consumer code expects (e.g., if the old code accessed `result[0].coins`, the new code accesses `result.coins` — verify the access pattern is updated)
- [ ] `character_key` values stay the same as before (no drift introduced — `'lala'` reads stay `'lala'` reads)
- [ ] No new database round-trips introduced (one `findOne` per original SELECT)
- [ ] Test coverage for routes/services that touched character_state still passes

### Phase C Verification (Writes)

For each converted write:

- [ ] `INSERT INTO character_state ...` becomes `CharacterState.create(...)`
- [ ] `UPDATE character_state SET ... WHERE ...` becomes `instance.update(...)` or `CharacterState.update(..., { where })`
- [ ] `INSERT ... ON CONFLICT ...` (upsert) becomes `CharacterState.upsert(...)`
- [ ] `character_key` values stay the same as before
- [ ] **Per-write manual DB verification** in psql: capture row state before and after a sample call, confirm identical except `updated_at`
- [ ] Transaction boundaries preserved (if old raw SQL was inside a `t.commit()` block, new ORM call uses the same `t` via `{ transaction: t }`)

---

## §8 Risk Profile and Mitigations

### Risk 1: Behavioral drift between raw SQL and ORM call

**Risk:** Sequelize ORM applies defaults, hooks (we'll have none), and type coercion that raw SQL might bypass. A row that the raw SQL stored with `coins = null` might get `coins = 500` (the default) via the ORM, silently changing data.

**Mitigation:**
- Phase A model definition explicitly has NO hooks
- Phase C manual DB verification (sample row state before/after)
- Default values in the model match defaults in the migration (verified at Phase A G2)

### Risk 2: Hardcoded `character_key = 'lala'` mass replacement creates bugs

**Risk:** The user-facing `'lala'` and the backend `'justawoman'` distinction (per project memory) means that if F-Stats-1 mechanically swaps every raw `character_key = 'lala'` to a `CharacterState.findOne` with the same WHERE, we preserve the bug pattern but in a different form.

**Mitigation:**
- F-Stats-1 explicitly preserves `character_key` values as-is. The drift remains, but it's now visible at the ORM layer where F-Sec-3 can fix it
- Audit at Phase A G1 documents every `character_key` value per call site so F-Sec-3 has a complete map

### Risk 3: Phase B (reads only) leaves a half-state where reads use ORM but writes still use raw SQL

**Risk:** Between Phase B closure and Phase C closure, the codebase has reads through the model and writes through raw SQL. If a write race condition exists, it could surface differently.

**Mitigation:**
- Phase B closure includes overnight soak — if a race condition manifests, we catch it before Phase C
- Phase C plans for a 24-hour soak (longer than Phase B's overnight) precisely because of write risk

### Risk 4: Deploy pipeline issues (F-App-1's §12.15 incident)

**Risk:** The unauthorized agent push to `origin/dev` that caused F-App-1's 50-minute outage could happen again on a longer plan with more PRs.

**Mitigation (preventive):**
- Pre-flight check at the start of each phase: `git fetch origin && git log origin/dev..origin/main --oneline` should show ZERO commits (meaning `dev` is at or behind `main`). If `dev` has unexpected commits, STOP and investigate before starting the phase.
- Stop hook adjustment (out of F-Stats-1 scope; was identified as F-App-1 follow-up #4)

### Risk 5: PowerShell encoding (F-App-1 documentation friction)

**Risk:** The encoding issues that blocked the F-App-1 audit report postscript append could re-surface during F-Stats-1 documentation work.

**Mitigation (preventive):**
- Set PowerShell to UTF-8 output before starting Phase A G1 audit:
  ```powershell
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
  $OutputEncoding = [System.Text.Encoding]::UTF8
  ```
- Add this to PowerShell profile for permanent fix

---

## §9 Decisions Locked

### Decision #1 — Phases A-C in scope; Phase D out

F-Stats-1 v1.0 covers Phase A (model), Phase B (read consolidation), Phase C (write consolidation). The `character_key` drift consolidation (originally framed as "Phase D") is explicitly out-of-scope and becomes the F-Sec-3 keystone.

**Locked: 2026-05-14, conversation with assistant.**

### Decision #2 — Route files refactored before service files

Within Phases B and C, route-file changes ship in earlier PRs than service-file changes. Rationale: route changes have visible HTTP failure modes (5xx responses, missing fields in JSON payloads), while service changes have invisible background failure modes (silent calculation errors). Visible failures = faster feedback during soak.

**Locked: 2026-05-14.**

### Decision #3 — Audit-then-plan pattern, same as F-App-1

Phase A G1's audit IS the determinative input to the rest of Phase A. The plan v1.0 you're reading is the strategic frame; per-file implementation details get added in Phase A G1's audit output.

**Locked: 2026-05-14.**

### Decision #4 — No hooks in CharacterState model

The CharacterState model has zero lifecycle hooks (no `beforeCreate`, no `afterUpdate`, etc.) for F-Stats-1's duration. Hooks are a future enhancement, not a refactor concern.

**Locked: 2026-05-14, per §6 model rules.**

### Decision #5 — No associations in CharacterState model

`belongsTo`, `hasMany`, etc. relationships are explicitly out of scope. The raw SQL doesn't use joins; the ORM equivalent shouldn't introduce them. Future model enhancement, not a refactor concern.

**Locked: 2026-05-14.**

### Decision #6 — `character_key` preserved as-is

F-Stats-1 does NOT change any `character_key` value in any code site. `'lala'` stays `'lala'`, `'justawoman'` stays `'justawoman'`. The drift is preserved at the ORM layer for F-Sec-3 to address.

**Locked: 2026-05-14.**

---

## §10 What This Unblocks (Forward-Looking)

After F-Stats-1 closure:

1. **F-Sec-3** can proceed against a single ORM surface to address `character_key` drift
2. **Future schema invariants** (e.g., a validator that enforces `coins >= 0`) can live in the model
3. **The "build the war chest" career goal** sync read/write mismatch becomes a single-layer problem (both reads and writes go through CharacterState model, so the only remaining issue is which `character_key` value each side uses — that's F-Sec-3)
4. **WorldStateSnapshot.character_states** JSONB resync logic can be rewritten to use the model rather than re-querying with raw SQL

---

## §11 Plan Version History

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-14 | Initial plan authored. Phases A/B/B-2/C structure. 25 gates total. Path 1/2/3 decision tree. §12 findings catalog initialized empty. |

---

## §12 Findings Beyond Scope (Empty at v1.0)

Findings discovered during Phase A G1 audit or subsequent gate execution that are out of F-Stats-1 scope will be appended here. v1.0 starts empty; each subsequent plan revision (v1.1, v1.2, ...) appends new findings.

*No findings yet. Phase A G1 audit will populate this section.*

---

## Appendix: Pre-plan investigation summary (informational)

Investigation queries run 2026-05-14 against repo HEAD `67c3a8e` confirmed:

- 66 raw-SQL `character_state` references across 19 files
- NO existing `CharacterState.js` model file (only models for `CareerGoal`, `WorldEvent`, `DecisionLog`, `CharacterStateHistory` — F-App-1's other four tables)
- 27 other Character/World/Decision/Career model files exist (naming pattern: PascalCase, one file per model)
- No dedicated `*-create-character-state.js` migration (character_state was created by `20260218100000-evaluation-system.js`)
- Sample reads at `careerGoals.js:387, 530, 610` and `episodes.js:942` consistently hardcode `character_key = 'lala'`
- Writes at `evaluation.js:66` are full-column INSERTs (no DEFAULT reliance)

This investigation does NOT replace Phase A G1's full 19-file audit; it's the diagnostic baseline that establishes Path 1 is the *expected* outcome.
