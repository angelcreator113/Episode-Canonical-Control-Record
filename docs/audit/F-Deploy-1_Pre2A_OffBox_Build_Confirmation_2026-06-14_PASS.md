# F-Deploy-1 - Pre-2A Off-Box Build Confirmation (PASS)

**Date:** 2026-06-14
**Session Type:** Off-box build confirmation only
**Status:** PASS FILED
**Scope:** Pre-2A only. Zero production box touch.

---

## 0. One-line

Strategy B off-box build viability is confirmed PASS end-to-end against the pinned target commit, with rebuild-at-priming selected (no artifact persisted).

## 1. Verdict

**PASS** for pre-2A off-box build confirmation.

This session closed the remaining pre-window viability check under the pinned tuple and confirmed the built tree starts off-box under parity conditions.

## 2. What was executed

All execution was container-local and off-box.

- Build target: detached worktree at `f8253262616458be3184e4f96ed6b1908300178f` (origin/main tip at execution time; PR #792 merge tip).
- Parity container base: ubuntu:22.04 (glibc lane) with Node 20 / npm 10 via NodeSource `setup_20.x` (resolved versions in Sec 3.1).
- P-4: `npm ci` run against committed lockfile on parity host.
- P-5: start verification performed off-box against the built tree entrypoint.

## 3. Evidence summary

### 3.1 Parity tuple match (B3)

All four dimensions matched expectation:

- arch: x86_64
- libc: glibc 2.35 (Ubuntu 22.04 lane)
- Node: v20.20.2
- npm: 10.8.2

### 3.2 P-4 result

`npm ci` completed successfully from committed lockfile (946 packages, 31s), with no native-module ABI/build failure signal.

### 3.3 P-5 result

The tree loaded and began executing, including model and route registration, and reached DB-connect attempt.

Classification rule applied:

- MODULE_NOT_FOUND or early native-ABI load crash before app logic = FAIL.
- Runtime reachability with downstream DB/JWT environment gaps off-box = PASS for start viability.

Observed DB/JWT configuration gaps were expected in this isolated container context and were not treated as P-5 failures.

## 4. Policy and boundary checks

- No production SSH mutation.
- No credential extraction.
- No canon secret material in container.
- No restart actions.
- No [3] priming.

## 5. Rebuild-at-priming policy (selected)

No artifact was persisted. Rebuild-at-priming is selected to preserve freshness against the then-current origin/main pin at [3] window open.

Rationale:

- Avoids stale artifact risk across gated sessions.
- Keeps evidence tied to the live pin at execution time.
- Avoids persisted tar lifecycle concerns in constrained-window handling.

## 6. Conditional notes

- FD-39 bridge remains OPEN as an adequacy basis record and is not re-closed here.
- Window-time G2A-1 and G2A-2 remain mandatory at [3] session open.

## 7. Chain position

Current chain state:

1. Pre-2A off-box build confirmation: PASS (this artifact)
2. put-parameter (SSM SecureString): next gated session
3. [3] window execution: later gated session with live window-open checks

## 8. Session-close state

- Box changes: none
- Process changes: none
- Credential changes: none
- Artifact persistence: none (recipe retained only)

## 9. Source documents

- `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md`
- `docs/audit/F-Deploy-1_Phase2A_ExecutionSpec_2026-06-12_DRAFT.md`
- `docs/audit/F-Deploy-1_P1_Parity_Sequencing_2026-06-10_DRAFT.md`
- `docs/audit/F-Deploy-1_B_Install_Method_2026-06-10_DRAFT.md`
- `docs/audit/F-Deploy-1_FD39_Box_Repo_Reconciliation_Bridge_DRAFT.md`
