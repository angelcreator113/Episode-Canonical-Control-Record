# F-Stats-1 Phase B G1 — Planning Doc

**CharacterState raw-SQL consolidation — per-PR execution plan**

| | |
|---|---|
| **Plan reference** | F-Stats-1 Fix Plan v1.2 §4 (Phase B gate sequence), Decision #6 (PR grouping), Decision #8 (F-Deploy-1 priority) |
| **Audit reference** | `docs/audit/F-Stats-1_PhaseA_G1_Audit.md` (committed at `6fe0eab`) |
| **Phase A G2 commit** | `178c9811` (CharacterState model created; PR #684 open as draft) |
| **Phase A G6 soak status** | In progress; 74+ min uptime, 0 restarts at planning-doc draft time |
| **Date** | 2026-05-15 |
| **Author** | JustAWomanInHerPrime (JAWIHP) / Evoni |

---

## §1 Purpose

This planning doc converts the Phase A G1 audit's per-file classification into a per-PR execution checklist for the 4 grouped Phase B PRs locked at Decision #6. Each PR section is self-contained: conversion targets by file:line, test plan, verification approach, and rollback criteria.

Phase B execution is the consumer-refactor phase: rewriting raw-SQL `SELECT` and `UPDATE` calls against `character_state` to use the `CharacterState` Sequelize model created in Phase A G2. **Phase B is read-write conversion; Phase C handles the season_id / multi-row consolidation work that depends on F-Sec-3.**

Phase B does NOT:
- Change any `character_key` value (`'lala'` stays `'lala'`, `'justawoman'` stays `'justawoman'`)
- Add a UNIQUE constraint on `(show_id, character_key, season_id)`
- Consolidate read patterns across files
- Touch `character_state_history` (different table, Phase C/F-Hist-1 scope)
- Fix the §12.13 transactional gap (F-Tx-1 scope)
- Fix the §12.15 history-mutation bug (F-Hist-1 / expanded F-Sec-3 scope)

Phase B exit criteria: every in-scope raw-SQL operation in the audit is converted to a `CharacterState` model call, all tests pass, soak windows complete clean.

---

## §2 PR Grouping Rationale (Decision #6 recap + §3 audit reframe)

Decision #6 locks Strategy C: grouped by risk profile, not by file count. The audit reveals the risk profile is sharper than the handoff framing suggested. Updated risk classification:

| PR | Files | Operations | Risk | Pattern |
|----|-------|-----------|------|---------|
| 1 | `careerGoals.js` + `episodes.js` | 4 READs (3 + 1) | LOW | Pattern A uniform `'lala'` reads |
| 2 | `wardrobe.js` | 2 READs + 2 UPDATEs | **HIGH** | Pattern B reads + Path 2 atomic UPDATE + multi-row UPDATE inconsistency |
| 3 | `evaluation.js` | 2 READs + 1 INSERT + 2 UPDATEs | **HIGH** | Path 2 helper + auto-seed defaults split + transactional UPDATE-by-id |
| 4 | `worldEvents.js` | 2 READs (in-file drift) | LOW | Pattern A with deliberate `'lala'`/`'justawoman'` split (preserved) |

**PR ordering: 1 → 4 → 2 → 3.** Note the swap of 4 ahead of 2/3.

Reasoning:
- PR 1 (LOW) and PR 4 (LOW) ship first — mechanical conversions, deliver visible progress, exercise the model under realistic load via the soak window.
- PR 2 (HIGH) ships third — wardrobe has the Path 2 atomic update which is the only confirmed `sequelize.literal()` case in the audit and deserves dedicated soak attention.
- PR 3 (HIGH) ships fourth — evaluation.js has the most operation variety (5 in-scope) and the most semantic nuance (auto-seed vs admin-reset defaults split, Path 2 helper).

**This deviates from the strict "files-in-the-order-listed" reading of Decision #6 but stays within its risk-profile spirit.** If you'd rather strictly follow Decision #6 ordering (1 → 2 → 3 → 4), the test plan content is unchanged; only the calendar shifts.

---

## §3 PR 1 — `careerGoals.js` + `episodes.js` (LOW)

### §3.1 Conversion inventory

Source: Phase A G1 Audit §3 Files 2 + 3.

| File | Line | Current pattern | New pattern |
|------|------|-----------------|-------------|
| `careerGoals.js` | 387 | `sequelize.query('SELECT * FROM character_state WHERE show_id = :showId AND character_key = ''lala'' LIMIT 1', { replacements: { showId } })` | `CharacterState.findOne({ where: { show_id: showId, character_key: 'lala' } })` |
| `careerGoals.js` | 530 | Same as 387; **war-chest sync bail point** | Same as 387; preserve `synced: 0` bail logic identically |
| `careerGoals.js` | 610 | Same as 387; populates `charState` for response payload | Same as 387 |
| `episodes.js` | 942 | Same pattern as careerGoals lines | Same conversion |

### §3.2 Conversion notes

**All 4 reads are functionally identical.** Same `SELECT *`, same WHERE clause, same `LIMIT 1`, same `'lala'` literal, no transactions, no `season_id` filter. This is the lowest-friction PR in Phase B by design.

**Preserve callsite semantics exactly:**
- Where the SQL returns an array (`results[0]`), the model returns a single row or `null` — adjust the destructuring at each callsite accordingly.
- Where `synced: 0` is returned on missing row (careerGoals.js:530), preserve that exact response shape.
- Where `charState` is populated for the response payload (careerGoals.js:610), the model row's `.toJSON()` should match the raw-SQL row shape — verify column-by-column.

### §3.3 Test plan

Tests to add (per PR 1 scope):

1. **Per-callsite unit test**: For each of the 4 lines, add a test that mocks `CharacterState.findOne` returning a fixture row and asserts the callsite produces the expected response.
2. **War-chest sync bail test** (careerGoals.js:530): Mock `CharacterState.findOne` returning `null`; assert response is `{ synced: 0 }`.
3. **Response payload shape regression test** (careerGoals.js:610 + episodes.js:942): Snapshot the response body before and after the conversion; diff should be empty.

Tests to verify still passing (without modification):
- All existing `careerGoals.js` test suites
- All existing `episodes.js` test suites

### §3.4 Verification approach (per Decision #6: pragmatic for reads)

- Code review by Evoni (self-review per F-AUTH-1 cleanup discipline, since Evoni is the sole reviewer)
- CI passing (lint + tests + cost audit + validate)
- **NO dedicated dev soak window** — PR 1 batches with PR 4 (see §7 cross-PR considerations)

### §3.5 Rollback criteria

Roll back if:
- Any war-chest sync test fails after conversion
- Response payload shape on any of the 4 endpoints diverges from pre-conversion
- Model row column types don't match raw-SQL row types (e.g., `BIGINT` returned as string vs number)

Rollback procedure: `git revert <PR-1-merge-commit>` → push → deploy. Reverts are mechanical because all 4 reads are uniform; no partial-rollback complexity.

---

## §4 PR 4 — `worldEvents.js` (LOW, batched with PR 1)

### §4.1 Conversion inventory

Source: Phase A G1 Audit §3 File 8.

| Line | Current pattern | New pattern |
|------|-----------------|-------------|
| 777 | `SELECT * FROM character_state WHERE show_id = :showId AND character_key = 'lala' LIMIT 1` | `CharacterState.findOne({ where: { show_id: showId, character_key: 'lala' } })` |
| 3838 | `SELECT coins, reputation, brand_trust, influence, stress FROM character_state WHERE show_id = :showId AND character_key = 'justawoman' LIMIT 1` | `CharacterState.findOne({ where: { show_id: showId, character_key: 'justawoman' }, attributes: ['coins', 'reputation', 'brand_trust', 'influence', 'stress'] })` |

### §4.2 Conversion notes

**The in-file `'lala'` / `'justawoman'` drift is deliberate and preserved verbatim** per Decision #6 and audit finding §12.8. F-Sec-3 will adjudicate the canonical value per-endpoint; F-Stats-1 does not touch the key string.

**Line 3838 uses selective columns** (5-column SELECT, not `SELECT *`). The `attributes` option on `findOne` preserves the optimization. Don't switch to `SELECT *` for convenience.

**The stale warning comment at line 3834-3835** (audit finding §12.10 — "careerPipelineService.getAccessibleCareerTier queries 'lala'" — which is wrong, the helper actually queries `'justawoman'`) is out of scope for PR 4. Leave the comment in place; F-Sec-3 sweep cleans it up per Decision #66.

### §4.3 Test plan

1. **Pattern A read at line 777**: Mock the model; assert response matches pre-conversion payload.
2. **Selective-column read at line 3838**: Mock the model with the `attributes` option; assert only the 5 specified fields are present in the model row used downstream.
3. **In-file drift preservation regression test**: Assert that after conversion, both `'lala'` and `'justawoman'` literals still appear in the file at their respective lines (grep test). This is paranoia against well-meaning auto-formatters or future PRs accidentally consolidating.

### §4.4 Verification approach

- Same as PR 1 (code review + CI; no dedicated soak)
- **Additional**: Grep-based regression check — `grep -c "'lala'" src/routes/worldEvents.js` returns 1; `grep -c "'justawoman'" src/routes/worldEvents.js` returns 1.

### §4.5 Rollback criteria

Roll back if:
- Either of the 2 reads breaks (no row returned where row expected, or shape mismatch)
- The selective-column optimization at line 3838 is lost (e.g., model returns all 12 columns and downstream code breaks on the extra fields)

---

## §5 PR 2 — `wardrobe.js` (HIGH)

### §5.1 Conversion inventory

Source: Phase A G1 Audit §3 File 6.

| Line | Operation | Current pattern | New pattern |
|------|-----------|-----------------|-------------|
| 1236 | READ (Pattern B) | `SELECT id, coins FROM character_state WHERE show_id = :show_id AND character_key = 'lala' ORDER BY updated_at DESC LIMIT 1` | `CharacterState.findOne({ where: { show_id, character_key: 'lala' }, attributes: ['id', 'coins'], order: [['updated_at', 'DESC']] })` |
| 1251 | **WRITE-UPDATE (Path 2)** | `UPDATE character_state SET coins = coins - :cost, updated_at = NOW() WHERE id = :id` (transactional) | `CharacterStateModel.update({ coins: sequelize.literal('coins - ' + cost), updated_at: sequelize.literal('NOW()') }, { where: { id: states[0].id }, transaction: t })` |
| 1342 | READ (Pattern B) | `SELECT * FROM character_state WHERE show_id = :show_id AND character_key = 'lala' ORDER BY updated_at DESC LIMIT 1` | `CharacterState.findOne({ where: { show_id, character_key: 'lala' }, order: [['updated_at', 'DESC']] })` |
| 1366 | WRITE-UPDATE | `UPDATE character_state SET coins = :newCoins, updated_at = NOW() WHERE show_id = :show_id AND character_key = 'lala'` (transactional, multi-row potential) | `CharacterStateModel.update({ coins: newCoins, updated_at: sequelize.literal('NOW()') }, { where: { show_id, character_key: 'lala' }, transaction: t })` |

### §5.2 Conversion notes

**§12.6 Path 2 case at line 1251:** This is the only confirmed `sequelize.literal()` case in the audit. The atomic column-self-reference (`coins = coins - :cost`) cannot be expressed via standard Sequelize attribute-value syntax. Justification for `sequelize.literal()`:
- `cost` derives from `item.coin_cost` (DB-trusted, not user input)
- Atomic operation prevents read-modify-write race
- Inside an existing `sequelize.transaction(async (t) => ...)` block, transaction-aware

Build the literal string safely: cast `cost` to number first (`const safeCost = Number(cost); if (!Number.isFinite(safeCost)) throw new Error(...)`), then interpolate. **Do NOT pass `cost` directly into the literal string** even though it's DB-trusted; defense-in-depth.

**§12.5 multi-row inconsistency at line 1366:** The current SQL UPDATE has no `LIMIT 1` and no `ORDER BY`. If duplicate `'lala'` rows exist (which they can, since no UNIQUE constraint exists yet — that's F-Sec-3 + Decision #54's UNIQUE migration), this updates ALL of them to the same value. The model conversion preserves the same multi-row behavior.

**Do NOT add `limit: 1` to the model call at line 1366 to "fix" the multi-row issue.** That would silently change semantics. F-Sec-3 fixes this via the UNIQUE constraint migration; F-Stats-1 preserves current behavior.

**Line 1251 vs 1366 inconsistency is real:** Line 1251 updates by `id` (single row, guaranteed); line 1366 updates by `(show_id, character_key)` (potentially multiple rows). Both fire from the wardrobe purchase flow — line 1251 deducts cost from the newest row, line 1366 (if it fires; conditional flow) zeroes coins across all matching rows. Audit finding §12.5 flags this; F-Stats-1 preserves but documents the inconsistency in the PR description.

### §5.3 Test plan

1. **Pattern B read (lines 1236, 1342)**: Mock the model with multiple matching rows; assert `findOne` with `order: [['updated_at', 'DESC']]` returns the newest.
2. **Path 2 atomic UPDATE (line 1251)**: Test with a starting `coins = 1000`, deduct 200, assert ending `coins = 800`. Critical: test inside a real transaction (use `sequelize.transaction` in test setup), not a mock.
3. **Path 2 atomic UPDATE concurrency test**: Two parallel transactions both deducting from the same row; assert final balance reflects both deductions (no lost update). This is the test that actually exercises the atomic-self-reference value.
4. **Multi-row UPDATE preservation (line 1366)**: Seed 2 rows with same `(show_id, character_key='lala')`, run the update, assert both rows have new `coins` value. Confirms the multi-row semantics are preserved.
5. **Transactional rollback test**: Inside a transaction that subsequently throws, assert neither line 1251 nor line 1366's changes persisted.

Tests to verify still passing:
- All existing `wardrobe.js` test suites, especially purchase flow integration tests
- All existing `wardrobeIntelligenceService.js` test suites (the service at audit File 18 reads from `character_state` via raw SQL still; it's Phase C scope, NOT this PR, but it shouldn't break)

### §5.4 Verification approach

- Code review by Evoni
- CI passing
- **Dedicated dev soak window** — 12 hours minimum on dev before merge to main
- **Dev soak exercise**: Run a real episode-completion against dev that triggers a wardrobe purchase. Verify coins debit correctly and atomically. Check `character_state` directly in dev RDS for the expected row state.
- **Prod soak after main merge**: 24 hours, same exercise on prod (single-user, low-traffic).

### §5.5 Rollback criteria

Roll back if:
- Any coins-deduction test fails after conversion
- Transactional rollback test fails (changes persist when transaction throws)
- Concurrency test produces lost-update behavior (was atomic, now isn't)
- Multi-row UPDATE behavior changes (was multi-row, now single-row, or vice versa)
- Dev soak surfaces any 5xx on the wardrobe purchase endpoint
- Prod soak surfaces any coins-discrepancy report

Rollback procedure: `git revert <PR-2-merge-commit>` → push → deploy. The Path 2 case at line 1251 is the riskiest revert because the literal-string-building helper might also need un-introduction; check the revert diff carefully.

---

## §6 PR 3 — `evaluation.js` (HIGH)

### §6.1 Conversion inventory

Source: Phase A G1 Audit §3 File 4.

| Line | Operation | Current pattern | New pattern |
|------|-----------|-----------------|-------------|
| 47 | READ (Path 2: `NULLS LAST` aggregate) | `SELECT * FROM character_state WHERE show_id = :showId AND character_key = :characterKey AND (season_id = :seasonId OR season_id IS NULL) ORDER BY season_id DESC NULLS LAST` | `CharacterState.findOne({ where: { show_id, character_key, [Op.or]: [{ season_id }, { season_id: null }] }, order: [[sequelize.literal('season_id DESC NULLS LAST')]] })` |
| 66 | WRITE-INSERT (auto-seed) | `INSERT INTO character_state (id, show_id, season_id, character_key, coins, reputation, brand_trust, influence, stress, created_at, updated_at) VALUES (...)` | `CharacterState.create({ id, show_id, season_id, character_key, coins, reputation, brand_trust, influence, stress })` (let model handle timestamps) |
| 149 | READ (aggregate COUNT) | `SELECT COUNT(*) as cnt FROM character_state WHERE show_id = :showId` | `CharacterState.count({ where: { show_id } })` |
| 159 | WRITE-UPDATE (admin reset) | `UPDATE character_state SET coins = 500, reputation = 0, brand_trust = 0, influence = 0, stress = 0, updated_at = NOW() WHERE show_id = :showId` | `CharacterStateModel.update({ coins: 500, reputation: 0, brand_trust: 0, influence: 0, stress: 0 }, { where: { show_id }, transaction: t })` |
| 644 | WRITE-UPDATE (transactional, by id) | `UPDATE character_state SET coins = :coins, reputation = :reputation, brand_trust = ..., updated_at = NOW() WHERE id = :stateId` (transactional) | `CharacterStateModel.update({ coins, reputation, brand_trust, influence, stress }, { where: { id: stateId }, transaction: t })` |

### §6.2 Conversion notes

**§12.1 Path 2 helper at line 47:** This is `getOrCreateCharacterState`, the only "correct" read pattern in the codebase per the audit. The `NULLS LAST` clause needs Sequelize handling. Two options:

(a) `sequelize.literal('season_id DESC NULLS LAST')` in the order clause (chosen above; preserves behavior exactly)
(b) Sequelize's `order: [['season_id', 'DESC NULLS LAST']]` syntax — verify support in your Sequelize version before using; if it works, prefer this for consistency with non-literal patterns

Test both during PR 3 G2 implementation; if (b) produces identical SQL, use (b). Otherwise (a).

**§12.2 auto-seed defaults split:** Line 66 INSERTs with caller-supplied values (typically model spec: coins=500, reputation=1, brand_trust=1, influence=1, stress=0). Line 159 RESETs to caller-fixed values (coins=500, reputation=0, brand_trust=0, influence=0, stress=0). **Preserve this split verbatim.** Auto-seed defaults to "starter" values; admin reset zeroes out. Both behaviors are intentional per audit §12.2.

For the `create` call at line 66: the model's `defaultValue` on each column should match the caller-supplied seed values. Verify by checking the CharacterState model definition (from Phase A G2) and confirming the defaults match. If they match, `CharacterState.create({ id, show_id, season_id, character_key })` (omitting the stats columns) produces the same row. **Decide at G2 implementation time** whether to rely on model defaults or pass explicit values.

**Line 149 COUNT aggregate:** Trivial conversion. `count()` is a direct Sequelize equivalent.

**Lines 159 and 644 transactions:** Line 159 is a bulk reset (no transaction in current code; consider whether to add one — audit doesn't require it but it's defensible). Line 644 is inside an existing `sequelize.transaction(async (t) => ...)` block; pass `t` through.

### §6.3 Test plan

1. **Path 2 helper read (line 47)**: Test all 4 cases of the `(season_id = :seasonId OR season_id IS NULL)` combined with `ORDER BY season_id DESC NULLS LAST`:
   - Row exists with matching season_id only → returns that row
   - Row exists with NULL season_id only → returns that row
   - Both rows exist → returns the matching-season_id row (NULLS LAST puts NULL last)
   - Neither exists → returns null
2. **Auto-seed INSERT (line 66)**: Mock model `create`; assert called with expected values for caller-supplied path. If using model defaults, additionally assert defaults match audit-documented values.
3. **COUNT aggregate (line 149)**: Trivial mock-and-assert test.
4. **Admin reset (line 159)**: Seed 3 rows for one show; run reset; assert all 3 have `coins=500, reputation=0, brand_trust=0, influence=0, stress=0`.
5. **Transactional UPDATE (line 644)**: Same shape as PR 2 transactional tests. Inside transaction, change values; commit; verify persisted. Inside transaction, change values; throw; verify NOT persisted.

Tests to verify still passing:
- All existing `evaluation.js` test suites
- The `getOrCreateCharacterState` helper's existing tests (if any)

### §6.4 Verification approach

- Code review by Evoni
- CI passing
- **Dedicated dev soak window** — 12 hours minimum on dev before merge to main
- **Dev soak exercise**: Run an admin reset on a dev show (verify all stats zero out). Run an episode completion that triggers the line 644 transactional UPDATE. Verify line 47 helper returns the correct row across the 4 cases via integration test.
- **Prod soak after main merge**: 24 hours; per-stats-touchpoint exercise.

### §6.5 Rollback criteria

Roll back if:
- Path 2 helper returns wrong row in any of the 4 cases
- Auto-seed produces row with different default values than pre-conversion
- Admin reset fails to zero out all matching rows
- Transactional UPDATE doesn't roll back on transaction throw
- Any episode-completion regression surfaces during soak

Rollback procedure: `git revert <PR-3-merge-commit>` → push → deploy. The Path 2 helper revert is the riskiest because if any other Phase B PR has already shipped, the consumers of `getOrCreateCharacterState` need to keep working.

---

## §7 Cross-PR Considerations

### §7.1 PR submission order

**Locked: 1 → 4 → 2 → 3** (deviates from Decision #6 letter; preserves Decision #6 spirit per §2).

### §7.2 Soak strategy (Hybrid, per pre-planning decision)

- **PR 1 + PR 4 batched**: Both ship to dev together (or back-to-back same day). Single 12-hour dev soak covers both. Merge to main together (separate commits, same merge window). Single 24-hour prod soak.
- **PR 2 individually soaked**: Dev soak 12h, prod soak 24h. Wait for prod soak clean before queuing PR 3.
- **PR 3 individually soaked**: Dev soak 12h, prod soak 24h. Phase B closes when PR 3 prod soak completes clean.

**Total Phase B duration estimate**: ~5 days under hybrid strategy, assuming no rollback events. Each rollback adds ~2 days (revert + re-fix + re-soak).

### §7.3 What if a PR reveals an audit gap?

If Phase B execution surfaces a `character_state` reference NOT catalogued in the G1 audit:

1. **Stop the current PR.** Do not extend scope mid-flight to include the new finding.
2. **File the new finding** as an addendum to the G1 audit (`F-Stats-1_PhaseA_G1_Audit.md` § appendix), with same classification structure (file:line, operation type, character_key, transaction context, ORM equivalent).
3. **Decide scope**: Is the new finding in the current PR's file(s)? If yes, the current PR is incomplete — extend scope after planning-doc revision, restart the PR. If no, file the new conversion target for a future PR in the appropriate grouping.
4. **Do not silently absorb the finding** into the current PR even if it's "just one more line in the same file." Audit-trail discipline.

### §7.4 What if soak surfaces an issue from a prior PR?

If PR N's prod soak is clean, but PR N+1's prod soak surfaces a regression that bisects to PR N:

1. **Roll back PR N+1** first (don't try to forward-fix during the soak).
2. **Roll back PR N** if the regression is traceable to PR N's changes.
3. **Restart from clean prod state** — wait for the rollback's own soak to complete clean.
4. **Re-author PR N's plan** in the planning doc with the new understanding before re-shipping.

This is the F-AUTH-1 precedent: G6 fail = roll back, do not fix forward in prod.

---

## §8 Phase B Exit Criteria

Phase B closes when ALL of the following are true:

- ✅ All 4 PRs merged to main
- ✅ All in-scope raw-SQL operations from G1 audit §3 converted to `CharacterState` model calls (no raw-SQL `SELECT FROM character_state` or `UPDATE character_state` remains in `src/routes/` or `src/services/` outside of the `character_state_history` table)
- ✅ All PRs' soak windows completed clean (no rollback events lingering)
- ✅ Test suite green: every test added per §3.3, §4.3, §5.3, §6.3 passes; no regressions in pre-existing tests
- ✅ Prod episode-api uptime stable across all 4 prod soaks combined; restart count remains 0 across the Phase B window
- ✅ No new entries in `Session_PE_Roster.md` traceable to Phase B execution

When all 6 conditions hold, declare Phase B closed and move to Phase B-2 / Phase C scoping. Phase C handles `season_id` consolidation work that depends on F-Sec-3.

**Out of Phase B scope (re-confirming):**
- `character_key` canonicalization → F-Sec-3
- UNIQUE constraint on `(show_id, character_key, season_id)` → F-Sec-3 + Decision #54
- `wardrobeIntelligenceService.js:995` (`'lala'` in service file, audit File 18) → Phase C
- `character_state_history` consolidation (5 call sites, audit §12.9) → F-Hist-1 / expanded F-Sec-3
- §12.13 transactional gap in episodeCompletionService.js → F-Tx-1
- §12.15 history-mutation in financialPressureService.js → F-Hist-1 / expanded F-Sec-3

---

## §9 Open Items Surfaced During Planning

These are findings or decisions the planning process raised but did NOT lock. They go to the next session for adjudication:

1. **Sequelize `order: [['season_id', 'DESC NULLS LAST']]` syntax verification** — confirm at PR 3 G2 implementation whether this works or whether `sequelize.literal('season_id DESC NULLS LAST')` is required. Affects line 47 conversion.

2. **Model defaults vs explicit caller values at evaluation.js:66** — decide at PR 3 G2 implementation whether to omit the stats columns from `create()` and rely on model defaults, or pass them explicitly. Either is correct; consistency with rest of codebase is the tiebreaker.

3. **Transaction wrapper for line 159 (admin reset)** — current code is non-transactional bulk UPDATE. Audit doesn't require adding one. Defensible either way; decide at PR 3 G2 implementation.

4. **`wardrobeIntelligenceService.js:995` Phase B or Phase C** — currently Phase C per §8 exclusions, but it's a single read with same Pattern A shape as PR 1's reads. If Phase B is going smoothly, it could fold into PR 1 cleanly. **Recommendation: leave in Phase C** to preserve PR-grouping discipline; revisit at Phase B close if Phase C scope is thin.

---

## §10 Execution Discipline (inline)

The F-AUTH-1 program produced a "cleanup discipline" set of 6 rules that became operational canon for every fix-plan execution session after. Phase B execution adopts the same rules with minor adaptations.

### Rule 1 — One writer at a time touches `claude/start-f-stats-1-g2` and Phase B branches

Phase B work happens on branches named `claude/f-stats-1-phase-b-<pr-shortname>`. Examples:

- `claude/f-stats-1-phase-b-careergoals-episodes` (PR 1)
- `claude/f-stats-1-phase-b-worldevents` (PR 4)
- `claude/f-stats-1-phase-b-wardrobe` (PR 2)
- `claude/f-stats-1-phase-b-evaluation` (PR 3)

If multiple Claude Code or VS Code Copilot sessions are active, only one is the writer per branch. Other sessions are read-only diagnostic. Writer is named at the start of each work block.

### Rule 2 — Every approved commit gets pushed immediately to a backup branch

Backup naming: `claude/f-stats-1-phase-b-<pr-shortname>-backup`. Force-push allowed; that's the point.

```
git push origin claude/f-stats-1-phase-b-wardrobe:claude/f-stats-1-phase-b-wardrobe-backup --force
```

### Rule 3 — Feature branch name stays clean for the eventual PR

The branch the PR opens against (`claude/f-stats-1-phase-b-<pr-shortname>`) stays clean. Backup branches absorb the working state.

### Rule 4 — No PR opened until all conversions for that PR are committed and code-reviewed

Draft PRs allowed (and recommended per integrator-mitigation Option 2 from May 12 session resume §5). Don't mark Ready for Review until you've eyeballed the diff yourself.

### Rule 5 — If a session looks unstable, push backup before logging off

Indicators: fatigue, pager weirdness, integrator surprises, end of work session. When in doubt, push backup.

### Rule 6 — Auto-merge pipeline considerations

`claude/start-f-stats-1-g2` and `claude/f-stats-1-phase-b-**` branches are EXCLUDED from `Auto-merge to Dev` workflow per F-Deploy-1 surgical fix (commit `d0a36c6b` on main, 2026-05-14). Phase B branches do NOT auto-merge to dev. Phase B PRs go through the standard PR review flow.

### Rule 7 (NEW for Phase B) — No pasted "ready-to-run" code blocks in chat

During Phase B execution sessions, planning AI (Claude) describes approach in prose and references conversion targets by file:line. Planning AI does NOT paste complete-and-runnable code blocks for the human (Evoni) to copy-paste. Reasoning: integrator tooling has been observed (May 14 session) executing planning content faster than the human's adjudication. Discipline mitigation: prose-only descriptions force the human to compose the actual code, which gives the integrator nothing to pre-execute.

This rule applies to Phase B G2 implementation work specifically. Test plans, file paths, line numbers, and short snippets (`sequelize.literal('NOW()')`) are acceptable. Full route handlers, full model definitions, full migration files are not.

### Soak verification specifics for Phase B (read-heavy changes)

Per F-AUTH-1 §6.3 framing: without real user traffic, the standard "watch metrics" approach doesn't apply. For Phase B soak windows, watch:

- Boot logs — server starts cleanly. No `CharacterState`-related module-load errors.
- Episode-completion exercise — run a real episode completion in dev. Verify the writes hit the right `character_key` (still `'justawoman'` for backend writes). Verify the reads return expected shapes.
- Stats panel exercise — load the WorldAdmin Stats panel for the Lala/SAL show. Verify all 5 stats (coins, reputation, brand_trust, influence, stress) render with non-zero values from the model row.
- Career goals exercise — verify war-chest sync runs (careerGoals.js:530). The bug from project memory #4 (war-chest goal silently no-ops) is NOT fixed by Phase B (F-Sec-3 territory), but Phase B should not make it worse.
- Wardrobe purchase exercise (PR 2 soak only) — buy a wardrobe item, verify coins debit atomically, verify item locks correctly.
- Admin reset exercise (PR 3 soak only) — run an admin reset, verify all stats zero per audit §12.2.

### What we are NOT watching for

- No 401 rate spike (no traffic to produce one)
- No write-success rate dashboard (no traffic)
- No 503 rate from F-Auth-3 (Cognito-down detection only fires under load we don't have)

---

## §11 Plan Version History

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-15 | Initial Phase B G1 planning doc authored. PR ordering 1→4→2→3 locked. Hybrid soak strategy locked. Execution Discipline §10 inline (Rules 1-6 from F-AUTH-1 + new Rule 7 for Phase B). §9 open items deferred to PR 2/3 G2 implementation. |

---

## §12 Closure

**Gate A-G1 (Phase B G1 = this planning doc) closes when this file is committed to `docs/audit/`.**

Next gate: **Phase B G2 = PR 1 + PR 4 implementation** (the two LOW-risk PRs that batch together). Following G2, soak window opens.

The planning doc represents the maximum-fidelity translation of the G1 audit's per-file findings into per-PR executable scope. If any PR's actual scope deviates from §3-§6 during execution, the planning doc gets a v1.1 revision before PR submission — not after.

— end of Phase B G1 planning doc —
