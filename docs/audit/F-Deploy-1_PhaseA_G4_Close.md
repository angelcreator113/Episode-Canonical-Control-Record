# F-Deploy-1 Phase A G4 Soak — Closure Record

**Closed:** 2026-05-26T13:21Z (Day 7 final check, 27 min post-window-close)
**Window:** 2026-05-19T12:54:47Z → 2026-05-26T12:54:47Z (7 days, full duration)
**Status:** CLOSED CLEAN

---

## Criteria observations

All four soak criteria held byte-for-byte between Day 4 mid-cycle check (2026-05-23) and Day 7 final check (2026-05-26).

### Criterion 1 — No autonomous merges to main outside the validate.yml-gated PR path

Two merges in window:

| PR | Commit | Merged at | Validate checks |
|---|---|---|---|
| #710 | `c4304bed` | 2026-05-19T12:54:48Z | Cost Exposure Audit ✅ · Route Validation ✅ · Tests ✅ |
| #711 | `7971a492` | 2026-05-19T13:58:04Z | Cost Exposure Audit ✅ · Route Validation ✅ · Tests ✅ |

Both authored by `angelcreator113`, `is_bot: false`. Both through the gated PR path. Zero merges in days 5–7.

### Criterion 2 — No `-X ours` events failing to notify Issue #708

Zero `-X ours` events fired in window. Both `auto-merge-to-dev.yml` runs were neutral-exit (FD-20 `[skip-automerge]` opt-out grep firing correctly at ~6-10 second elapsed time on the PR push commits), not merge-step runs. Issue #708 received no new notification comments in window; the only soak-window comment is the FD-21 reopen note dated 2026-05-19, which is administrative cleanup from the pre-window `close #708` keyword incident, not a soak event.

### Criterion 3 — No branch protection bypasses

Branch protection state on main matches FD-5 / FD-23 / FD-24 lock byte-for-byte across Day 4 and Day 7 snapshots:

- `required_status_checks.contexts`: `["Cost Exposure Audit", "Tests", "Route Validation"]`
- `required_status_checks.strict`: `true`
- `enforce_admins.enabled`: `false`
- `required_approving_review_count`: `0`
- `allow_force_pushes.enabled`: `false`
- `allow_deletions.enabled`: `false`

No drift.

### Criterion 4 — No F-Deploy-G1-Y recurrence

Closed by prior decision (FD-22, removal-sufficient on N=8). Not actively monitored during soak; no signal in criteria 1–3 suggesting recurrence.

---

## Positive observations from the window

1. Two real PRs shipped through the FD-5 / FD-20 / FD-23 / FD-24 / FD-25 hardening stack with zero incidents. The hardened pipeline has earned its keep under live use.
2. The `[skip-automerge]` opt-out grep (FD-20) fired correctly twice (neutral-exit at ~6-10 second elapsed time on both PR pushes), confirming field behavior matches design.
3. Six-plus consecutive days of zero in-window activity. Quiet soak is the right kind of soak.

---

## What this closes

- **Phase A** of F-Deploy-1 keystone fix. Sub-forms A (auto-merge), C (branch protection), and D (local-tooling diagnostic) are dispositioned. Sub-form B (deploy-dev architectural correction) is Phase B work.
- **Gate A-G4** per Fix Plan v1.0 §5.5. Criteria met: no F-Deploy-G1-K/L/M/N/O/P/Y/Z recurrence; one non-trivial PR shipped through the hardened auto-merge-to-dev path (PR #711 onboarding refactor, verified via gated Validate checks).

## What this unblocks

- **Phase B G1** — the architectural decision gate (α vs β) is now eligible to fire. All Phase B G1 inputs (§6.1 cost + workload, §6.2 v1.0 §6 framing cross-reference, §6.3 dev workload mirror) are closed locally. The decision itself is held local pending Fix Plan v1.4 authoring.

## What this does NOT do

- Does not close F-Deploy-1 as a keystone. Phase B (implementation of sub-form B fixes) and Phase C (cross-phase verification soak) remain. Per Fix Plan v1.0 §7, F-Deploy-1 closes at Phase C.
- Does not advance any downstream keystone (F-App-1, F-Stats-1 Phase B, F-Ward-1, etc.). Those remain blocked behind F-Deploy-1's full closure per Decision #98.
- Does not modify Fix Plan v1.0-v1.3 content. This document is an event record, not an amendment.

---

*Authored 2026-05-26 post Phase A G4 soak close. Co-authored with JustAWomanInHerPrime / Evoni.*