# F-Stats-1 Fix Plan v1.1

**CharacterState Sequelize Model Creation + Raw-SQL Consolidation — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.1 |
| **Date** | May 14, 2026 |
| **Author** | JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Supersedes** | v1.0 (committed at HEAD `a278a69`) |
| **Predecessor keystone** | F-App-1 (closed 2026-05-14, commit `67c3a8e` on main) |
| **Successor keystone** | F-Sec-3 (`character_key` drift sweep, blocked on F-Stats-1) |
| **Audit canon reference** | Audit Handoff v8, Decision #54 |
| **Phase A G1 audit reference** | `docs/audit/F-Stats-1_PhaseA_G1_Audit.md` (committed at `6fe0eab`) |

---

## What changed in v1.1

This is a revision of plan v1.0 incorporating findings and decisions from the Phase A G1 audit (commit `6fe0eab`). The substantive plan content (problem statement, scope, phase structure, gate sequence, model spec, risk profile) is unchanged from v1.0. Updates in v1.1:

- **§3 Decision Tree:** Updated to record Path 1 confirmed by G1 audit
- **§5.4 file list:** Corrected 10 truncated filenames per audit §2
- **§9 Decisions Locked:** Added Decision #7 documenting §12.13 and §12.15 architectural findings as out-of-scope
- **§11 Plan Version History:** Added v1.1 entry
- **§12 Findings Beyond Scope:** Populated with §12.1 through §12.18 from G1 audit (was empty placeholder in v1.0)

The original §1, §2, §4, §6, §7, §8, §10, Appendix content is unchanged in v1.1 and is not duplicated here. Consult plan v1.0 (committed at HEAD `a278a69`) for the original Executive Summary, Scope definition, Gate Sequence detail, CharacterState model specification, Verification Checklists, Risk Profile, and What This Unblocks discussion.

---

## §3 Decision Tree (UPDATED)

After Phase A G1 audit completed (commit `6fe0eab`, May 14 2026), F-Stats-1 path is **confirmed as Path 1.**

**Path 1 verification:**
- ✅ All 21 in-scope operations have clean ORM equivalents (verified per-file in audit §3)
- ⚠️ 1 Path 2 boundary case: `wardrobe.js:1251` atomic column-self-reference (`coins = coins - :cost`). Solved with `sequelize.literal()` — does NOT block Path 1 progression.
- ⚠️ 1 Path 2 candidate: `evaluation.js:47` `ORDER BY ... NULLS LAST`. Sequelize `order` syntax should handle. Verify at Phase A G2.
- ✅ In-file `character_key` drift exists at `worldEvents.js` (`'lala'` line 777, `'justawoman'` line 3838). Drift is deliberate and documented in code comments. Preserved per Decision #6.
- ✅ No accidental in-file drift detected.
- ✅ Path 3 not triggered. F-Sec-3 can wait until after F-Stats-1 closes.

**F-Stats-1 proceeds as planned through Phases A, B, B-2, C.**

The original §3 decision-tree content (Path 1 / Path 2 / Path 3 definitions and conditions) is preserved from v1.0 — see plan v1.0 for the full tree.

---

## §5.4 File List (CORRECTED)

Plan v1.0's §5.4 file list was derived from pre-plan investigation output that truncated long filenames with `...`. The Phase A G1 audit (commit `6fe0eab`) used PowerShell `Get-ChildItem` lookups to identify the actual filenames. The corrected list:

### Models (1)

1. `src/models/WorldStateSnapshot.js` — JSONB field named `character_states`; OUT-OF-SCOPE (confirmed by audit)

### Routes (8)

2. `src/routes/careerGoals.js`
3. `src/routes/episodes.js`
4. `src/routes/evaluation.js`
5. `src/routes/tierFeatures.js`
6. `src/routes/wardrobe.js`
7. `src/routes/world.js`
8. `src/routes/worldEvents.js`
9. `src/routes/worldStudio.js`

### Services (9) — ALL HAD `Service` SUFFIX TRUNCATED IN V1.0

10. `src/services/careerPipelineService.js` (was `careerPipeline.js`)
11. `src/services/episodeCompletionService.js` (was `episodeCompletion.js`)
12. `src/services/episodeGeneratorService.js` (was `episodeGenerator.js`)
13. `src/services/episodeScriptWriterService.js` (was `episodeScript.js`)
14. `src/services/feedMomentsService.js` (was `feedMoments.js`)
15. `src/services/financialPressureService.js` (was `financialPredictor.js`)
16. `src/services/financialTransactionService.js` (was `financialTransactionsHandler.js`)
17. `src/services/groundedScriptGeneratorService.js` (was `groundedScript.js`)
18. `src/services/wardrobeIntelligenceService.js` (was `wardrobeIntelligence.js`)

### Seeders (1)

19. `src/seeders/20260312800000-show-brain-franchise-laws.js` (was truncated as `*`)

**Total: 19 files. Audit complete; all in-scope operations classified.** See `docs/audit/F-Stats-1_PhaseA_G1_Audit.md` §3 for per-file detail.

---

## §9 Decisions Locked (UPDATED — Decision #7 ADDED)

Decisions #1 through #6 are unchanged from v1.0. New decision added at v1.1:

### Decision #7 — §12.13 and §12.15 architectural findings out of F-Stats-1 scope

The Phase A G1 audit surfaced two architectural bugs that exceed F-Stats-1's mandate:

1. **§12.13: `episodeCompletionService.js:405` missing transaction wrapper.** The UPDATE writing deltas to `character_state` (line 405-411) and the paired INSERT to `character_state_history` (line 416) are not transactional. Same bug pattern evaluation.js:619-623 documents as already-fixed in that file. Risk: silent state/history desync if either write fails.

2. **§12.15: `financialPressureService.js:197-210` mutates history ledger as live state.** Reads latest `character_state_history` row, mutates `state_json.coins` in memory, UPDATEs the same history row. Violates append-only ledger semantics. Causes `character_state.coins` and `character_state_history[latest].state_json.coins` to drift silently. Likely caused the 5-call-site Pattern C workaround (§12.9).

**F-Stats-1 does NOT address either bug.** F-Stats-1's mandate is creating the CharacterState model and consolidating raw-SQL access. Modifying transaction boundaries or deleting service mutation logic are out of scope.

**Recommended successor keystones (decision deferred to F-Stats-1 closure):**

- **F-Tx-1 (provisional):** Mechanical retrofit of `episodeCompletionService.js:405` to use `financialTransactionService`'s correct transactional pattern (§12.17). Small, focused, mechanical.
- **§12.15 disposition:** Either expand F-Sec-3's scope to address history-mutation alongside `character_key` drift, OR split into a separate F-Hist-1 keystone for history-table-correctness. **Decision to be made at F-Stats-1 closure**, informed by what the model layer reveals.

**Locked: 2026-05-14.** F-Stats-1 proceeds with current scope. F-Tx-1 / F-Hist-1 / F-Sec-3 scope decisions revisited at F-Stats-1 closure.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-14 | Initial plan authored. Phases A/B/B-2/C structure. 25 gates total. Path 1/2/3 decision tree. §12 findings catalog initialized empty. Committed at HEAD `a278a69`. |
| v1.1 | 2026-05-14 | Path 1 confirmed by Phase A G1 audit (commit `6fe0eab`). §5.4 file list corrected with actual filenames. §12 findings populated (§12.1-§12.18). Decision #7 added for §12.13/§12.15 disposition. |

v1.1 supersedes v1.0 for all forward references. v1.0 remains the canonical pre-audit plan and is preserved in git history at HEAD `a278a69`.

---

## §12 Findings Beyond Scope (POPULATED FROM PHASE A G1 AUDIT)

The Phase A G1 audit (commit `6fe0eab`) surfaced 18 findings beyond per-reference classification. They are catalogued here as the canonical plan reference. Full text and per-finding evidence in `docs/audit/F-Stats-1_PhaseA_G1_Audit.md` §4.

Each finding includes a severity classification:

- **F-Stats-1 implementation** — guidance for Phase A G2 through Phase C
- **F-Sec-3 work** — `character_key` drift consolidation
- **Architectural bug** — issue beyond F-Sec-3's mandate; warrants new keystone
- **Documentation cleanup** — non-functional but worth fixing
- **Verification needed** — requires further investigation

### §12.1 — `getOrCreateCharacterState` helper at evaluation.js:45 is the only correct read pattern

**Severity: F-Sec-3 / forward-looking.**

This helper takes dynamic `characterKey` and handles both season-specific and global rows via `ORDER BY season_id DESC NULLS LAST`. Every other read site we audited hardcodes either `'lala'` or `'justawoman'` and ignores `season_id` entirely. This helper is what the rest of the codebase *should* be using. F-Stats-1 does NOT introduce a service wrapper, but a future keystone could.

### §12.2 — Auto-seed defaults differ from admin-reset defaults

**Severity: Inconsistency, not bug.**

The INSERT at `evaluation.js:66` uses caller-supplied defaults (typically model spec values: coins=500, reputation=1, brand_trust=1, influence=1, stress=0). The bulk UPDATE at `evaluation.js:159` resets to coins=500, reputation=0, brand_trust=0, influence=0, stress=0. **Auto-seed creates rows with `1`s; admin-reset zeros everything.** Likely intentional (seed = "new character" with starting buffer; reset = "clean slate"), but worth documenting.

### §12.3 — Explicit comment at evaluation.js:619-623 documents lala/justawoman drift verbatim

**Severity: Documentation / F-Sec-3 source material.**

The comment block reads (paraphrased):

> "The 'key === lala' gate was also dropped: 'justawoman' is the canonical key writers actually use, so the old check meant no ledger mirror ever fired for the real..."

This is the clearest in-code documentation of the bug F-Sec-3 will address. Worth quoting verbatim in F-Sec-3's plan.

### §12.4 — Two parallel "get character's current state" patterns

**Severity: F-Sec-3 cleanup.**

The codebase has Pattern A (`SELECT * FROM character_state ... LIMIT 1`) used by `careerGoals.js`, `episodes.js`, `worldEvents.js:777` and Pattern B (`SELECT ... FROM character_state ... ORDER BY updated_at DESC LIMIT 1`) used by `wardrobe.js`. Pattern B is a pragmatic workaround for duplicate-row scenarios; Pattern A trusts uniqueness that the schema doesn't enforce.

### §12.5 — Inconsistent update granularity within wardrobe.js

**Severity: F-Sec-3 concern.**

`wardrobe.js:1251` updates ONE row (by `id`); `wardrobe.js:1366` potentially updates MULTIPLE rows (by `show_id + character_key='lala'`, no LIMIT). Same logical operation ("update Lala's coins"), different DB-level granularity. If duplicate `'lala'` rows exist, 1366 zeroes both to the same value while 1251 only adjusts the newest.

### §12.6 — wardrobe.js:1251 requires `sequelize.literal()` for atomic column-self-reference

**Severity: F-Stats-1 implementation detail.**

The pattern `UPDATE character_state SET coins = coins - :cost WHERE id = :id` doesn't have a clean Sequelize ORM equivalent. Phase C will use:

```javascript
await CharacterStateModel.update(
  { coins: sequelize.literal(`coins - ${cost}`), updated_at: sequelize.literal('NOW()') },
  { where: { id: states[0].id }, transaction: t }
);
```

Safe because `cost` derives from `item.coin_cost` (DB-trusted, not user input). **This is the only confirmed Path 2 case in the audit.**

### §12.7 — Defensive schema coding around character_state_history continues

**Severity: Architectural.**

`wardrobe.js:1407` has a try-with-full-columns / catch-and-retry-without-`id` pattern. Same as F-App-1 G1 audit observations on `wardrobe.js:1291` and `WorldEvent.js:57`. Production migration drift symptom — code defending against schema differences between environments.

### §12.8 — First in-file character_key drift at worldEvents.js (deliberate, documented)

**Severity: Preserved per Decision #6 / F-Sec-3 work.**

`worldEvents.js` has `'lala'` at line 777 (episode generation read) AND `'justawoman'` at line 3838 (suggestion algorithm read). The drift IS deliberate — line 3834-3835 comment explicitly avoids the `'lala'` helper. F-Stats-1 preserves both literally. **F-Sec-3 must decide canonical value per endpoint, not per file.**

### §12.9 — Pattern C ("get balance from character_state_history ledger") has 5 call sites

**Severity: Architectural / F-Sec-3.**

Five call sites read `state_json` (or `state_after_json`) from `character_state_history` instead of querying `character_state` directly:

- `worldEvents.js:2235`
- `worldEvents.js:2287`
- `feedMomentsService.js:99`
- `financialPressureService.js:197`
- `financialTransactionService.js:87` (fallback)

**This pattern likely emerged because financialPressureService writes coins to history-as-state (see §12.15).** F-Sec-3 / data-consistency keystone should consolidate to "read directly from `character_state` table via CharacterState model."

### §12.10 — Stale "don't use this helper" comment at worldEvents.js:3834

**Severity: Documentation cleanup.**

The comment claims `careerPipelineService.getAccessibleCareerTier` queries `'lala'` and warns developers to avoid it. **The actual helper at `careerPipelineService.js:340` queries `'justawoman'`.** Either the helper was fixed but the comment wasn't updated, or the comment never applied to this helper. Either way: misleading. Clean up when F-Sec-3 lands.

### §12.11 — careerPipelineService is a model consolidation pattern F-Sec-3 may extend

**Severity: Forward-looking.**

The helper `getAccessibleCareerTier(showId, models)` at `careerPipelineService.js:336` is exactly the kind of consolidation function F-Sec-3 will likely build out. One read site, one purpose, takes `showId`, returns derived value. F-Sec-3 might extend this pattern with `getCharacterCoins(showId)`, `getCharacterReputation(showId)`, etc., or wrap in a `CharacterStateService` class.

### §12.12 — War-chest bug definitively proven in code

**Severity: F-Sec-3 critical.**

`careerGoals.js:530` reads `character_state WHERE character_key = 'lala'` for war-chest sync. `episodeCompletionService.js:405` writes `character_state` rows whose `character_key = 'justawoman'`. When episode income lands, it updates `'justawoman'` row; when sync queries for goal-completion, it reads `'lala'` row and finds no matching coin updates → returns `synced: 0`. **This is the war-chest career goal bug from project memory, now confirmed in source.**

### §12.13 — episodeCompletionService.js:405 missing transaction wrapper

**Severity: HIGH-PRIORITY architectural bug.**

The UPDATE at `episodeCompletionService.js:405-411` (writes deltas to `character_state`) and the INSERT at line 416 (writes to `character_state_history`) are NOT wrapped in a transaction. If 405 succeeds but 416 fails, `character_state` is updated but no history record exists — silent state drift. **This is the exact bug pattern that `evaluation.js:619-623` documents as already-fixed in THAT file.** The fix is mechanical: wrap both in `await sequelize.transaction(async (t) => { ... }, { transaction: t })`. **Recommend a new small keystone (provisional name F-Tx-1) to retrofit.** See Decision #7.

### §12.14 — `last_applied_episode_id` column is idempotency-keyed

**Severity: F-Stats-1 implementation confirmation.**

The UPDATE at `episodeCompletionService.js:405` stamps `last_applied_episode_id = :episodeId` as part of the same write. This is an idempotency safeguard against duplicate episode-completion runs. F-Stats-1's §6 model spec includes this column; Phase A G2 must preserve it. Already specified in plan v1.0 §6.

### §12.15 — financialPressureService MUTATES character_state_history as if it were live state

**Severity: MAJOR architectural bug.**

`financialPressureService.js:197-210` reads the latest `character_state_history` row, mutates `state_json.coins` in memory, and UPDATEs the SAME history row with the mutation. This:

1. Violates append-only semantics of a history ledger
2. Causes `character_state.coins` and `character_state_history[latest].state_json.coins` to drift silently
3. Likely caused Pattern C readers (§12.9, five call sites) to emerge as workarounds

**This is bigger than `'lala'`/`'justawoman'` drift.** F-Sec-3's scope may need to expand, OR a new "history-table-correctness" keystone is warranted. **financialPressureService's history mutation should be deleted and replaced with proper financialTransactionService calls.** See Decision #7.

### §12.16 — character_state_history has both state_json and state_after_json columns

**Severity: Verification needed.**

Different callers use different column names:

- `state_json`: worldEvents:2235, 2287; feedMomentsService:99; financialPressureService:197
- `state_after_json`: financialTransactionService:87

Either the table has both columns (and one is canonical), or one query path is broken. Investigation recommended before F-Sec-3 work.

### §12.17 — Correct transactional pattern exists at financialTransactionService.js:244

**Severity: F-Tx-1 implementation guide.**

The comment at `financialTransactionService.js:244` explicitly documents the correct pattern: when a Sequelize transaction is passed in, run the INSERT inside it AND rethrow on failure so the caller's transaction rolls back. **§12.13's bug fix is mechanical: retrofit episodeCompletionService.js to use this service or replicate its pattern.**

### §12.18 — Service file using 'lala' breaks the backend-uses-justawoman pattern

**Severity: F-Sec-3 nuance.**

Up through audit File 17, every service file used `'justawoman'`:

- careerPipelineService:340
- episodeCompletionService:176, 186
- episodeGeneratorService:378
- episodeScriptWriterService:289

But `wardrobeIntelligenceService.js:995` uses `'lala'`. **The split isn't "user-facing reads vs backend reads."** It's closer to "episode-completion-pipeline (`'justawoman'`) vs everything-else-the-user-touches (`'lala'`)." F-Sec-3 must recognize at least 3 effective conventions, not 2.

---

## §12 Findings Distribution

| Severity class | Count | Findings |
|---|---|---|
| F-Stats-1 implementation guidance | 3 | §12.6, §12.14, §12.17 (plus §12.11 forward-looking) |
| F-Sec-3 / character_key drift work | 8 | §12.1, §12.3, §12.4, §12.5, §12.8, §12.10, §12.12, §12.18 |
| Architectural bugs beyond drift | 2 | §12.13 (transactional gap), §12.15 (history mutation) |
| Documentation / cleanup | 4 | §12.2, §12.7, §12.9, §12.10 |
| Verification needed | 1 | §12.16 (column-name divergence) |

---

## Forward Statement

Plan v1.1 supersedes v1.0. F-Stats-1 proceeds to **Phase A G2** — create `src/models/CharacterState.js` per §6 of plan v1.0 (model spec unchanged).

Plan v1.0 (commit `a278a69`) is preserved in git history as the canonical pre-audit plan. The Phase A G1 audit (commit `6fe0eab`) is the canonical pre-implementation audit. Plan v1.1 (this document) is the canonical plan-of-record going forward.

The original v1.0 sections §1, §2, §4 (Gate Sequence), §6 (Model Spec), §7 (Verification Checklists), §8 (Risk Profile), §10 (What This Unblocks), and Appendix are unchanged. Consult plan v1.0 for those.

Next gate: **Phase A G2.** No blocking dependencies on this v1.1 commit — G2 can begin immediately after v1.1 lands or be deferred while v1.1 ships separately.
