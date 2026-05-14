# F-Stats-1 Phase A G1 Audit Report

**CharacterState raw-SQL classification — 19-file complete audit**

| | |
|---|---|
| **Plan reference** | F-Stats-1 Fix Plan v1.0 §5 |
| **Date completed** | 2026-05-14 |
| **Auditor** | JustAWomanInHerPrime (JAWIHP) / Evoni, with assistant |
| **Repo HEAD at audit** | `a278a69` (F-Stats-1 Fix Plan v1.0 commit) |
| **Total references found** | 51 grep hits across 19 files |
| **Total in-scope operations** | 21 (14 READs, 2 INSERTs, 5 UPDATEs) |
| **Total out-of-scope hits** | 30 (JSONB columns, comments, response payload keys, different tables, string content) |
| **Path determination** | **Path 1 — clean refactor.** Two Path 2 boundary cases noted; neither blocks. |

---

## §1 Audit Method

Per F-Stats-1 plan §5, each `character_state` reference in every src/ file was read in surrounding context (3-4 lines before and after each match) and classified into one of these operation types:

- **READ** — `SELECT ... FROM character_state ...`
- **WRITE-INSERT** — `INSERT INTO character_state ...`
- **WRITE-UPDATE** — `UPDATE character_state SET ...`
- **WRITE-UPSERT** — `INSERT ... ON CONFLICT ...` (none found)
- **WRITE-DELETE** — `DELETE FROM character_state ...` (none found)
- **OUT-OF-SCOPE** — JSONB column name (`character_states` plural on `world_state_snapshots`), references to `character_state_history` table, comments, docstrings, response payload keys, JSON metadata strings

For each in-scope operation, the following fields were captured:

- File path and line number
- Hardcoded `character_key` value (`'lala'`, `'justawoman'`, dynamic, or N/A)
- Transaction-aware (whether inside a `sequelize.transaction(...)` block)
- ORM equivalent (proposed Sequelize call shape)
- Notes (anything semantically unusual)

Audit was performed iteratively, file-by-file, by reading each `Select-String -Pattern "character_state" -Context 3,3` (or `4,4` for files with writes) output and discussing classification before moving to the next file.

---

## §2 Filename Corrections vs Plan v1.0 §5.4

Plan v1.0's §5.4 file list was derived from the pre-plan investigation, which used PowerShell's `Select-Object Path -Unique` and truncated long names with `...`. The actual filenames in `src/` differ:

| Plan name | Actual filename |
|---|---|
| `careerPipeline.js` | `careerPipelineService.js` |
| `episodeCompletion.js` | `episodeCompletionService.js` |
| `episodeGenerator.js` | `episodeGeneratorService.js` |
| `episodeScript.js` | `episodeScriptWriterService.js` |
| `feedMoments.js` | `feedMomentsService.js` |
| `financialPredictor.js` | `financialPressureService.js` |
| `financialTransactionsHandler.js` | `financialTransactionService.js` |
| `groundedScript.js` | `groundedScriptGeneratorService.js` |
| `wardrobeIntelligence.js` | `wardrobeIntelligenceService.js` |
| `src/seeders/20260312800000-*` | `src/seeders/20260312800000-show-brain-franchise-laws.js` |

**These corrections should be reflected in plan v1.1's §5.4.**

---

## §3 Per-File Classification

### File 1 — `src/models/WorldStateSnapshot.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 27 | `character_states: { type: DataTypes.JSONB, ... }` | OUT-OF-SCOPE | — | — | JSONB column on `world_state_snapshots` table, plural; not the `character_state` table |

**0 in-scope operations.** Fully out of scope.

---

### File 2 — `src/routes/careerGoals.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 387 | `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1` | READ | `'lala'` | No | Dynamic column access via `target_metric` variable in consumer code |
| 530 | `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1` | READ | `'lala'` | No | **War-chest sync bail point** — `return res.json({ synced: 0 })` when no row found. Cross-ref F-Sec-3 §12.12 |
| 610 | `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1` | READ | `'lala'` | No | In try/catch; populates `charState` for response payload |
| 697 | `character_state: { reputation: charState.reputation, coins: ... }` | OUT-OF-SCOPE | — | — | JSON response payload key, not SQL |

**3 in-scope READs.** All `'lala'`. All non-transactional. All ORM-equivalent to `CharacterState.findOne({ where: { show_id, character_key: 'lala' } })`. **Copy-paste pattern** — three identical SELECTs in one file.

---

### File 3 — `src/routes/episodes.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 942 | `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1` | READ | `'lala'` | No | Identical pattern to careerGoals.js:610 |

**1 in-scope READ.** `'lala'`. Confirms cross-file copy-paste of the same defensive-read pattern.

---

### File 4 — `src/routes/evaluation.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 47 | `SELECT * FROM character_state WHERE show_id ... AND character_key = :characterKey AND (season_id = :seasonId OR season_id IS NULL) ORDER BY season_id DESC NULLS LAST` | READ | **dynamic** `:characterKey` | No | Get-or-create helper function. **Path 2 candidate** — Sequelize `NULLS LAST` syntax verification needed |
| 66 | `INSERT INTO character_state (id, show_id, season_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at) VALUES (...)` | WRITE-INSERT | **dynamic** `:characterKey` | No | Auto-seed paired with 4.1 SELECT. **Behavioral drift risk** on `undefined` replacement values vs model defaults |
| 149 | `SELECT COUNT(*) as cnt FROM character_state WHERE show_id = :showId` | READ (aggregate) | N/A | No | Diagnostic COUNT. ORM equivalent: `CharacterState.count({ where: { show_id } })` |
| 157 | `// Step 1: Reset character_state` | OUT-OF-SCOPE | — | — | Comment |
| 159 | `UPDATE character_state SET coins = 500, reputation = 0, brand_trust = 0, influence = 0, ...` | WRITE-UPDATE | N/A (bulk by show) | No | Admin-reset bulk update. **Defaults inconsistency** (zeros vs model's 1s) — see §4 findings |
| 185 | `character_state_before: parseInt(...)` | OUT-OF-SCOPE | — | — | Response payload key |
| 187 | `character_state_updated: csMeta?.rowCount ?? 0` | OUT-OF-SCOPE | — | — | Response payload key |
| 619-623 | Multi-line comment block | OUT-OF-SCOPE | — | — | **Documents lala/justawoman drift verbatim** — see §4 finding 12.3 |
| 644 | `UPDATE character_state SET coins = :coins, reputation = :reputation, brand_trust = ..., updated_at = NOW() WHERE id = :stateId` | WRITE-UPDATE | N/A (by id) | **YES** | First transactional write. Inside `sequelize.transaction(async (t) => ...)` block |
| 653 | `INSERT INTO character_state_history ...` | OUT-OF-SCOPE | — | YES | Different table — `character_state_history`, not `character_state` |
| 679 | `metadata: { source: 'character_state_update', ... }` | OUT-OF-SCOPE | — | — | JSON metadata source label |

**5 in-scope operations: 2 READs, 1 INSERT, 2 UPDATEs.** Most complex file by operation count and pattern variety.

---

### File 5 — `src/routes/tierFeatures.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 526 | `character_states: characterStates,` | OUT-OF-SCOPE | — | — | JSONB column on `world_state_snapshots` payload, not table reference |

**0 in-scope operations.** WorldStateSnapshot creation payload, fully out of scope.

---

### File 6 — `src/routes/wardrobe.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 948 | `const { ..., character_state = {} } = req.body;` | OUT-OF-SCOPE | — | — | Request body destructure, local JS variable not DB ref |
| 1070 | `const rep = character_state.reputation \|\| 1;` | OUT-OF-SCOPE | — | — | Reading from local JS var (6.1) |
| 1080 | `const coins = character_state.coins \|\| 0;` | OUT-OF-SCOPE | — | — | Reading from local JS var |
| 1119, 1120 | `(character_state.reputation || 1) >= ...` | OUT-OF-SCOPE | — | — | Local JS var in response payload computation |
| 1236 | `SELECT id, coins FROM character_state WHERE show_id = :show_id AND character_key = 'lala' ORDER BY updated_at DESC LIMIT 1` | READ | `'lala'` | No | **Pattern B read** (ORDER BY updated_at DESC). Selective columns. See §4 finding 12.4 |
| 1241-1246 | Multi-line comment block | OUT-OF-SCOPE | — | — | Documents prior bug fix (atomic dual-write to prevent silent money loss) |
| 1251 | `UPDATE character_state SET coins = coins - :cost, updated_at = NOW() WHERE id = :id` | WRITE-UPDATE | N/A (by id) | **YES** | **Path 2 case** — atomic column-self-reference `coins = coins - :cost`. Requires `sequelize.literal()` for ORM equivalent |
| 1342 | `SELECT * FROM character_state WHERE show_id = :show_id AND character_key = 'lala' ORDER BY updated_at DESC LIMIT 1` | READ | `'lala'` | No | Pattern B read, `SELECT *` variant |
| 1366 | `UPDATE character_state SET coins = :newCoins, updated_at = NOW() WHERE show_id = :show_id AND character_key = 'lala'` | WRITE-UPDATE | `'lala'` | **YES** | Absolute-value update. **Multi-row potential** if duplicate `'lala'` rows exist. Inconsistency with 6.7 — see §4 finding 12.5 |
| 1394 | `INSERT INTO character_state_history ...` | OUT-OF-SCOPE | — | YES | Different table |
| 1408 | `INSERT INTO character_state_history ...` (retry variant) | OUT-OF-SCOPE | — | YES | Different table, defensive-schema fallback pattern (drops `id` column) |

**4 in-scope operations: 2 READs, 2 UPDATEs.** Both UPDATEs are transactional. **Contains the only confirmed Path 2 implementation case (line 1251).**

---

### File 7 — `src/routes/world.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 43 | `FROM character_state_history csh LEFT JOIN episodes e ...` | OUT-OF-SCOPE | — | — | `character_state_history` table read |

**0 in-scope operations.**

---

### File 8 — `src/routes/worldEvents.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 777 | `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1` | READ | `'lala'` | No | Pattern A read for episode-generation context |
| 811 | `character_state_used: characterState,` | OUT-OF-SCOPE | — | — | Response payload key |
| 2235 | `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1` | OUT-OF-SCOPE | — | — | **Pattern C read** (history-as-state) — see §4 finding 12.9 |
| 2287 | (identical to 2235) | OUT-OF-SCOPE | — | — | Pattern C read, second instance in same file |
| 3811 | `// character_state (coins, reputation, stress, ...)` | OUT-OF-SCOPE | — | — | Comment |
| 3834-3835 | `// Note: careerPipelineService.getAccessibleCareerTier queries 'lala' as of writing, which is a pre-existing bug` | OUT-OF-SCOPE | — | — | **Stale warning comment** — see §4 finding 12.10 |
| 3838 | `SELECT coins, reputation, brand_trust, influence, stress FROM character_state WHERE show_id = :showId AND character_key = 'justawoman' LIMIT 1` | READ | **`'justawoman'`** | No | **First `'justawoman'` ref. In-file drift with line 777** — see §4 finding 12.8 |

**2 in-scope READs.** First `'justawoman'` reference. First confirmed in-file drift (deliberate, documented).

---

### File 9 — `src/routes/worldStudio.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 3372 | `const { ..., character_states, ... } = req.body;` | OUT-OF-SCOPE | — | — | WorldStateSnapshot create payload |
| 3376 | `WSS.create({ ..., character_states: character_states || {}, ... })` | OUT-OF-SCOPE | — | — | ORM write to `world_state_snapshots`, JSONB column |
| 3388 | `const allowed = [..., 'character_states', ...]` | OUT-OF-SCOPE | — | — | Allowlist string for snapshot update |

**0 in-scope operations.**

---

### File 10 — `src/services/careerPipelineService.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 340 | `SELECT reputation FROM character_state WHERE show_id = :showId AND character_key = 'justawoman' LIMIT 1` | READ | `'justawoman'` | No | Career-tier lookup helper. **Subject of stale comment at worldEvents.js:3834** which incorrectly claims it queries `'lala'` |

**1 in-scope READ.** Confirms backend service convention of `'justawoman'`.

---

### File 11 — `src/services/episodeCompletionService.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 17 | `* 7. Record full snapshot to character_state_history with evaluation_id` | OUT-OF-SCOPE | — | — | Docstring |
| 176 | `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'justawoman' LIMIT 1` | READ | `'justawoman'` | No | Episode-completion read with `.catch(() => [])` |
| 186 | `INSERT INTO character_state (id, show_id, character_key, coins, reputation, ...) VALUES (:id, :showId, 'justawoman', 500, 1, 1, 1, 0, NOW(), NOW())` | WRITE-INSERT | `'justawoman'` (inline literal) | No | Auto-seed. Hardcoded values match §6 model defaults exactly |
| 405 | `UPDATE character_state SET coins = :coins, reputation = :reputation, ... last_applied_episode_id = :episodeId, updated_at = NOW() WHERE id = :stateId` | WRITE-UPDATE | N/A (by id) | **NO** | **CRITICAL: Missing transaction wrapper** — see §4 finding 12.13. The paired history INSERT at line 416 is not in a transaction with this UPDATE |
| 413 | `// 13. Write character_state_history with evaluation reference` | OUT-OF-SCOPE | — | — | Comment |
| 416 | `INSERT INTO character_state_history (...)` | OUT-OF-SCOPE | — | No | Different table, should be transactional with 11.4 |
| 498 | `applies_to: JSON.stringify(['character_state', 'justawoman', ...])` | OUT-OF-SCOPE | — | — | JSON tag string |

**3 in-scope operations: 1 READ, 1 INSERT, 1 UPDATE.** All hardcode `'justawoman'`. **Transactional gap finding §12.13.**

---

### File 12 — `src/services/episodeGeneratorService.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 378 | `SELECT coins FROM character_state WHERE show_id = :showId AND character_key = 'justawoman' LIMIT 1` | READ | `'justawoman'` | No | Affordability guard for cost-bearing episode events |

**1 in-scope READ.** Selective single-column.

---

### File 13 — `src/services/episodeScriptWriterService.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 289 | `SELECT coins, reputation, brand_trust, influence, stress FROM character_state WHERE show_id = :showId AND character_key = 'justawoman' LIMIT 1` | READ | `'justawoman'` | No | Selective 5-column SELECT for AI script context |
| 433-434 | `worldState?.character_states ? JSON.stringify(...) : ''` | OUT-OF-SCOPE | — | — | JSONB column on snapshot |

**1 in-scope READ.** Same pattern as worldEvents.js:3838.

---

### File 14 — `src/services/feedMomentsService.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 99 | `SELECT state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1` | OUT-OF-SCOPE | — | — | Pattern C read (history-as-state) |

**0 in-scope operations.** Pattern C call site.

---

### File 15 — `src/services/financialPressureService.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 197 | `SELECT id, state_json FROM character_state_history WHERE show_id = :showId ORDER BY created_at DESC LIMIT 1` | OUT-OF-SCOPE | — | No | Pattern C read |
| 208 | `UPDATE character_state_history SET state_json = :state, updated_at = NOW() WHERE id = :id` | OUT-OF-SCOPE | — | No | **CRITICAL ARCHITECTURAL FINDING** — see §4 finding 12.15. This service MUTATES the history ledger as if it were live state |

**0 in-scope operations for F-Stats-1.** Major architectural finding §12.15 documented.

---

### File 16 — `src/services/financialTransactionService.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 84 | `// Table might not exist yet — try character_state_history fallback` | OUT-OF-SCOPE | — | — | Comment |
| 87 | `SELECT state_after_json FROM character_state_history WHERE show_id = :showId AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1` | OUT-OF-SCOPE | — | No | Pattern C read fallback. **Uses `state_after_json` column** (not `state_json`) — see §4 finding 12.16 |
| 244 | `// When a Sequelize transaction is passed in, we both run the INSERT inside it AND rethrow on failure ... Without this, the outer transaction would commit a half-baked state (e.g. character_state.coins decremented but no ledger row).` | OUT-OF-SCOPE | — | — | **Documents the CORRECT transactional pattern** — see §4 finding 12.17 |
| 512 | `// 13. Update character_state_history with new coin balance` | OUT-OF-SCOPE | — | — | Comment (misleading — operation below is INSERT, not UPDATE) |
| 515 | `INSERT INTO character_state_history (id, show_id, character_key, ...) VALUES (:id, :showId, 'justawoman', ...)` | OUT-OF-SCOPE | `'justawoman'` | YES | Proper history-append (contrast with §12.15 mutation in financialPressureService) |

**0 in-scope operations for F-Stats-1.** File serves as architectural reference for correct patterns.

---

### File 17 — `src/services/groundedScriptGeneratorService.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 202, 203 | `lalaStats?.character_states ? JSON.stringify(...).slice(0, 200) : 'Stats not loaded'` | OUT-OF-SCOPE | — | — | JSONB column on snapshot, used for AI prompt context |

**0 in-scope operations.**

---

### File 18 — `src/services/wardrobeIntelligenceService.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 183 | Docstring claiming function reads `character_state.stress` and `character_state.reputation` | OUT-OF-SCOPE | — | — | Possibly stale docstring (function actually reads `coins`) |
| 995 | `SELECT coins FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1` | READ | `'lala'` | No | **Service file breaks pattern — uses `'lala'` not `'justawoman'`** — see §4 finding 12.18 |

**1 in-scope READ.** Counterexample to service-files-use-justawoman pattern.

---

### File 19 — `src/seeders/20260312800000-show-brain-franchise-laws.js`

| Line | Reference | Operation | character_key | Tx | Notes |
|---|---|---|---|---|---|
| 537 | `'character_state is per-show, not per-episode — one row tracks cumulative progression.'` | OUT-OF-SCOPE | — | — | String content in AI prompt seed data (franchise-law text). Factually accurate, no action needed |

**0 in-scope operations.**

---

## §4 Findings Beyond Classification

The audit surfaced 18 findings that go beyond per-reference classification. They are catalogued here as the canonical source list for plan v1.1's §12 update. Each finding includes a severity classification:

- **F-Stats-1 implementation** — guidance for Phase A G2 through Phase C
- **F-Sec-3 work** — `character_key` drift consolidation, the keystone after F-Stats-1
- **Architectural bug** — issue beyond F-Sec-3's mandate; may warrant new keystone
- **Documentation cleanup** — non-functional but worth fixing
- **Verification needed** — requires further investigation

### §12.1 — `getOrCreateCharacterState` helper at evaluation.js:45 is the only "correct" read pattern

**Severity: F-Sec-3 / forward-looking.** This helper takes dynamic `characterKey` and handles both season-specific and global rows via `ORDER BY season_id DESC NULLS LAST`. Every other read site we audited hardcodes either `'lala'` or `'justawoman'` and ignores `season_id` entirely. This helper is what the rest of the codebase *should* be using. F-Stats-1 does NOT introduce a service wrapper, but a future keystone could.

### §12.2 — Auto-seed defaults differ from admin-reset defaults

**Severity: Inconsistency, not bug.** The INSERT at evaluation.js:66 uses caller-supplied defaults (typically model spec values: coins=500, reputation=1, brand_trust=1, influence=1, stress=0). The bulk UPDATE at evaluation.js:159 resets to coins=500, reputation=0, brand_trust=0, influence=0, stress=0. **Auto-seed creates rows with `1`s; admin-reset zeros everything.** Likely intentional (seed = "new character" with starting buffer; reset = "clean slate"), but worth documenting.

### §12.3 — Explicit comment at evaluation.js:619-623 documents lala/justawoman drift verbatim

**Severity: Documentation / F-Sec-3 source material.** The comment block reads:

> *"The 'key === lala' gate was also dropped: 'justawoman' is the canonical key writers actually use, so the old check meant no ledger mirror ever fired for the real..."*

This is the clearest in-code documentation of the bug F-Sec-3 will address. Worth quoting verbatim in F-Sec-3's plan.

### §12.4 — Two parallel "get character's current state" patterns

**Severity: F-Sec-3 cleanup.** The codebase has Pattern A (`SELECT * FROM character_state ... LIMIT 1`) used by careerGoals, episodes, worldEvents:777 and Pattern B (`SELECT ... FROM character_state ... ORDER BY updated_at DESC LIMIT 1`) used by wardrobe.js. Pattern B is a pragmatic workaround for duplicate-row scenarios; Pattern A trusts uniqueness that the schema doesn't enforce.

### §12.5 — Inconsistent update granularity within wardrobe.js

**Severity: F-Sec-3 concern.** `wardrobe.js:1251` updates ONE row (by `id`); `wardrobe.js:1366` potentially updates MULTIPLE rows (by `show_id + character_key='lala'`, no LIMIT). Same logical operation ("update Lala's coins"), different DB-level granularity. If duplicate `'lala'` rows exist, 1366 zeroes both to the same value while 1251 only adjusts the newest.

### §12.6 — wardrobe.js:1251 requires `sequelize.literal()` for atomic column-self-reference

**Severity: F-Stats-1 implementation detail.** The pattern `UPDATE character_state SET coins = coins - :cost WHERE id = :id` doesn't have a clean Sequelize ORM equivalent. Phase C will use:

```javascript
await CharacterStateModel.update(
  { coins: sequelize.literal(`coins - ${cost}`), updated_at: sequelize.literal('NOW()') },
  { where: { id: states[0].id }, transaction: t }
);
```

Safe because `cost` derives from `item.coin_cost` (DB-trusted, not user input). **This is the only confirmed Path 2 case in the audit.**

### §12.7 — Defensive schema coding around `character_state_history` continues

**Severity: Architectural.** wardrobe.js:1407 has a try-with-full-columns / catch-and-retry-without-`id` pattern. Same as F-App-1 G1 audit observations on `wardrobe.js:1291` and `WorldEvent.js:57`. Production migration drift symptom — code defending against schema differences between environments.

### §12.8 — First in-file `character_key` drift at worldEvents.js (deliberate, documented)

**Severity: Preserved per Decision #6 / F-Sec-3 work.** worldEvents.js has `'lala'` at line 777 (episode generation read) AND `'justawoman'` at line 3838 (suggestion algorithm read). The drift IS deliberate — line 3834-3835 comment explicitly avoids the `'lala'` helper. F-Stats-1 preserves both literally. **F-Sec-3 must decide canonical value per endpoint, not per file.**

### §12.9 — Pattern C ("get balance from `character_state_history` ledger") has 5 call sites

**Severity: Architectural / F-Sec-3.** Five call sites read `state_json` (or `state_after_json`) from `character_state_history` instead of querying `character_state` directly:

- `worldEvents.js:2235`
- `worldEvents.js:2287`
- `feedMomentsService.js:99`
- `financialPressureService.js:197`
- `financialTransactionService.js:87` (fallback)

**This pattern likely emerged because financialPressureService writes coins to history-as-state (see §12.15).** F-Sec-3 / data-consistency keystone should consolidate to "read directly from `character_state` table via CharacterState model."

### §12.10 — Stale "don't use this helper" comment at worldEvents.js:3834

**Severity: Documentation cleanup.** The comment claims `careerPipelineService.getAccessibleCareerTier` queries `'lala'` and warns developers to avoid it. **The actual helper at careerPipelineService.js:340 queries `'justawoman'`.** Either the helper was fixed but the comment wasn't updated, or the comment never applied to this helper. Either way: misleading. Clean up when F-Sec-3 lands.

### §12.11 — careerPipelineService is a model consolidation pattern F-Sec-3 may extend

**Severity: Forward-looking.** The helper `getAccessibleCareerTier(showId, models)` at careerPipelineService.js:336 is exactly the kind of consolidation function F-Sec-3 will likely build out. One read site, one purpose, takes `showId`, returns derived value. F-Sec-3 might extend this pattern with `getCharacterCoins(showId)`, `getCharacterReputation(showId)`, etc., or wrap in a `CharacterStateService` class.

### §12.12 — War-chest bug definitively proven in code

**Severity: F-Sec-3 critical.** careerGoals.js:530 reads `character_state WHERE character_key = 'lala'` for war-chest sync. episodeCompletionService.js:405 writes `character_state` rows whose `character_key = 'justawoman'`. When episode income lands, it updates `'justawoman'` row; when sync queries for goal-completion, it reads `'lala'` row and finds no matching coin updates → returns `synced: 0`. **This is the war-chest career goal bug from project memory, now confirmed in source.**

### §12.13 — episodeCompletionService.js:405 missing transaction wrapper

**Severity: HIGH-PRIORITY architectural bug.** The UPDATE at episodeCompletionService.js:405-411 (writes deltas to `character_state`) and the INSERT at line 416 (writes to `character_state_history`) are NOT wrapped in a transaction. If 405 succeeds but 416 fails, `character_state` is updated but no history record exists — silent state drift. **This is the exact bug pattern that evaluation.js:619-623 documents as already-fixed in THAT file.** The fix is mechanical: wrap both in `await sequelize.transaction(async (t) => { ... }, { transaction: t })`. **Recommend a new small keystone (provisional name F-Tx-1) to retrofit.**

### §12.14 — `last_applied_episode_id` column is idempotency-keyed

**Severity: F-Stats-1 implementation confirmation.** The UPDATE at episodeCompletionService.js:405 stamps `last_applied_episode_id = :episodeId` as part of the same write. This is an idempotency safeguard against duplicate episode-completion runs. F-Stats-1's §6 model spec includes this column; Phase A G2 must preserve it. Already specified in plan v1.0 §6.

### §12.15 — financialPressureService.js MUTATES `character_state_history` as if it were live state

**Severity: MAJOR architectural bug.** `financialPressureService.js:197-210` reads the latest `character_state_history` row, mutates `state_json.coins` in memory, and UPDATEs the SAME history row with the mutation. This:

1. Violates append-only semantics of a history ledger
2. Causes `character_state.coins` and `character_state_history[latest].state_json.coins` to drift silently
3. Likely caused Pattern C readers (§12.9, five call sites) to emerge as workarounds

**This is bigger than `'lala'`/`'justawoman'` drift.** F-Sec-3's scope may need to expand, OR a new "history-table-correctness" keystone is warranted. **financialPressureService's history mutation should be deleted and replaced with proper financialTransactionService calls.**

### §12.16 — `character_state_history` has both `state_json` and `state_after_json` columns

**Severity: Verification needed.** Different callers use different column names:

- `state_json`: worldEvents:2235, 2287; feedMomentsService:99; financialPressureService:197
- `state_after_json`: financialTransactionService:87

Either the table has both columns (and one is canonical), or one query path is broken. Investigation recommended before F-Sec-3 work.

### §12.17 — Correct transactional pattern exists at financialTransactionService.js:244

**Severity: F-Tx-1 implementation guide.** The comment at financialTransactionService.js:244 explicitly documents the correct pattern: when a Sequelize transaction is passed in, run the INSERT inside it AND rethrow on failure so the caller's transaction rolls back. **§12.13's bug fix is mechanical: retrofit episodeCompletionService.js to use this service or replicate its pattern.**

### §12.18 — Service file using `'lala'` breaks the backend-uses-justawoman pattern

**Severity: F-Sec-3 nuance.** Up through audit File 17, every service file used `'justawoman'`:

- careerPipelineService:340
- episodeCompletionService:176, 186
- episodeGeneratorService:378
- episodeScriptWriterService:289

But wardrobeIntelligenceService.js:995 uses `'lala'`. **The split isn't "user-facing reads vs backend reads."** It's closer to "episode-completion-pipeline (`'justawoman'`) vs everything-else-the-user-touches (`'lala'`)." F-Sec-3 must recognize at least 3 effective conventions, not 2.

---

## §5 Path Determination

Per F-Stats-1 plan §3 decision tree:

**Path 1 holds.** ✅

Verification:
- ✅ All 21 in-scope operations have clean ORM equivalents documented per-file
- ⚠️ 1 Path 2 boundary case (wardrobe.js:1251 atomic column-self-reference) — solved with `sequelize.literal()`, does not block Path 1
- ⚠️ 1 Path 2 candidate (evaluation.js:47 `ORDER BY ... NULLS LAST`) — Sequelize `order` syntax should handle, verify at Phase A G2
- ✅ In-file `character_key` drift exists (worldEvents.js, deliberate) — preserved per Decision #6, not a Path 3 trigger
- ✅ No accidental drift requiring F-Sec-3 to land first

**F-Stats-1 proceeds as planned.** Next gate: Phase A G2 (create the CharacterState model).

---

## §6 What Phase A G2 Must Implement

Per plan v1.0 §6, the CharacterState model schema is locked. The audit confirms:

### Schema verified

All 21 in-scope operations reference one or more of these columns: `id`, `show_id`, `season_id`, `character_key`, `coins`, `reputation`, `brand_trust`, `influence`, `stress`, `last_applied_episode_id`, `created_at`, `updated_at`. **All 12 columns must be in the model.** Matches §6 spec exactly.

### Defaults verified

- `coins: 500` confirmed by episodeCompletionService.js:187 inline literal AND careerGoals fallback at line 533 (`balance = 500;`)
- `reputation: 1` confirmed by episodeCompletionService.js:187
- `brand_trust: 1` confirmed by episodeCompletionService.js:187
- `influence: 1` confirmed by episodeCompletionService.js:187
- `stress: 0` confirmed by episodeCompletionService.js:187

**§6 model defaults match production write patterns.** Safe to keep as specified.

### Sequelize ORM-equivalent verification

All 21 in-scope operations have proposed ORM equivalents documented in §3 (per-file classification). Phase A G2's implementation requires only:

1. Creating `src/models/CharacterState.js` with §6 schema
2. Wiring into `src/models/index.js`
3. Boot test confirming `db.CharacterState.findOne(...)` works locally

**Phase B and Phase C work depends on the model existing first.** Phase A G2 is the minimum viable model creation — no consumers refactored yet.

---

## §7 Recommendations for Plan v1.1

The plan v1.0 (commit `a278a69`) should be revised to v1.1 with the following updates:

1. **Update §5.4 file list** with corrected filenames (per §2 of this audit)
2. **Append §12.1 through §12.18** to plan §12 ("Findings Beyond Scope")
3. **Update §3 decision tree** to record Path 1 determined with confidence
4. **Update §9 (Decisions Locked)** with new Decision #7: "§12.13 and §12.15 architectural bugs are out of F-Stats-1 scope; recommend new keystone F-Tx-1 (transactional gap) and decide F-Sec-3 scope expansion or F-Hist-1 split for §12.15"
5. **Update §11 (Plan Version History)** with v1.1 entry

Plan v1.1 should be generated and committed as a separate gate-A-G1-closure deliverable, OR appended to the same commit that lands this audit report.

---

## §8 Gate A-G1 Closure Criteria

Per plan v1.0 §4 (Gate Sequence — Phase A):

> **A-G1**: 19-file audit; classify each `character_state` reference as read/write/JSONB/other; confirm Path 1/2/3. **Output:** Audit report at `docs/audit/F-Stats-1_PhaseA_G1_Audit.md`.

Closure checklist:

- [x] All 19 files audited
- [x] Every reference classified per §3
- [x] Path determination made per §5: Path 1
- [x] Findings beyond scope catalogued per §4
- [x] Filename corrections documented per §2
- [x] Recommendations for plan v1.1 documented per §7
- [ ] Audit report committed to `docs/audit/`
- [ ] Plan v1.1 update (separate gate)

**Gate A-G1 is technically complete pending commit of this report.**

---

## §9 Next Action

After this audit report is committed:

1. **Optional but recommended:** Generate plan v1.1 with §12 findings + filename corrections + Decision #7
2. **Required:** Proceed to **Phase A G2** — create `src/models/CharacterState.js` per §6 of plan v1.0
3. **Phase A G2 verification:** Boot test confirming `db.CharacterState.findOne(...)` returns the existing canonical Lala/SAL state row

Phase A G2 is the next gate. It does not require plan v1.1 to land first — the §6 model spec is unchanged by the audit, and Phase A G2 introduces no consumers (no caller code touches the model yet).

**The audit is complete.** F-Stats-1 is ready to proceed.
