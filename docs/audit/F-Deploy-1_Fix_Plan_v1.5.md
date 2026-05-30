# F-Deploy-1 Fix Plan v1.5

**Phase B G2 in progress — G2 implementation doc on main (v1.1); FD-29/FD-30 registered from the auto-merge-to-dev workflow fix**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.4 (Phase B G1 closure, merged 2026-05-26 via PR #717) |
| **Audit reference** | `docs/audit/F-Deploy-1_G1_Audit.md` (main, merged via PR #698) |
| **Planning doc reference** | `docs/audit/F-Deploy-1_PhaseB_G1_Planning.md` (main, merged 2026-05-26 via PR #716) |
| **G2 implementation doc reference** | `docs/audit/F-Deploy-1_PhaseB_G2_Implementation_v1.1.md` (main, merged 2026-05-28 via PR #719) |
| **Author start date** | 2026-05-28 |
| **Author session** | Single session, post-G2-doc-v1.1-merge, post-FD-29/FD-30 workflow fix |
| **Status** | DRAFT v1.5 |
| **Gate transition** | None. v1.5 is a register-hygiene revision recording decisions made during G2 execution. Phase B G2 remains the active gate; §4.1 provisioning has not started. |

**Naming note:** v1.4's footer reserved v1.5 for "a subsequent revision of the Fix Plan itself if substantive register additions arise during G2 work." That is exactly what v1.5 is: the G2 implementation doc shipped as a separate file (PRs #718/#719, per v1.4's prediction), and two register-worthy decisions (FD-29, FD-30) arose during the doc's v1.1 execution. v1.5 records them. v1.5 does NOT close G2 or advance the implementation; it is decision-register hygiene, not a gate transition.

## §1 Purpose

v1.5 records into the decision register two decisions made during F-Deploy-1 Phase B G2 execution, and adds one audit-checklist guard generalizing the first. Specifically:

1. **G2 implementation doc on main at v1.1.** `docs/audit/F-Deploy-1_PhaseB_G2_Implementation.md` (v1.0) merged via PR #718 (commit `2a410108` lineage); revised to v1.1 via PR #719 (commit `2a410108`, new file `_v1.1.md` alongside v1.0). v1.1 carried three review fixes (§7.3 wording, §4.5 ordering split into §4.5.1/§4.5.2, §4.3 cross-reference removal). No new FD decisions from the v1.1 doc revision itself; the register additions in v1.5 come from the workflow fix that followed.

2. **FD-29 — env: pattern for GitHub Actions context substitution.** During PR #719's pipeline run, the `auto-merge-to-dev.yml` `[skip-automerge]` step failed with `peak vs idle: command not found` (exit 127). Root cause: `${{ github.event.head_commit.message }}` was inlined into the bash `run:` script source, and the v1.1 commit body contained double-quote characters that closed the string literal and caused bash to execute trailing words as commands. Fixed via PR #720. Detail in §6.

3. **FD-30 — exit-78 neutral-exit deprecation.** The same `[skip-automerge]` step used `exit 78`, historically a neutral-exit signal. GitHub Actions YAML v2 deprecated exit-78-as-neutral years ago; the runner treats any non-zero exit as failure. Every prior `[skip-automerge]` PR (#705, #707, #709, #717, #718, #719) surfaced merge-to-dev as a red X failure, not a skip — harmless because merge-to-dev is not a required check, but the workflow's neutral-exit claim was factually wrong. Fixed via PR #720. Detail in §6.

4. **Audit-checklist addition.** FD-29 generalizes into a recurring-pattern guard: workflow `run:` blocks must use `env:` injection for GitHub context values, never inline `${{ ... }}`. Recorded as a new §8. Detail in §8.

What v1.5 does NOT do:
- Does not close Phase B G2. G2 closes at §4.6 of the G2 implementation doc; §4.1 provisioning has not started.
- Does not carry §4.2 memory-profile observations. That data does not exist until §4.2 fires during G2 execution. Deferred to v1.6 (likely at G2 close).
- Does not confirm or revise FD-27 (t3.micro instance class). FD-27 resolution depends on the §4.2 memory profile result, which has not been measured. Deferred to v1.6.
- Does not re-decide any Phase A or Phase B G1 state. Inherits all of it from v1.4.
- Does not advance the §6.5.1 route-table audit. Deferred per Planning doc §13, unchanged.
- Does not delete `docs/audit/F-Deploy-1_PhaseB_G1_Pre-drafted_Amendments.md`. Its disposition remains a Phase B G2 cutover-time call per Planning doc §14. (Noted: that file is stale relative to current project state — its "parent document does not yet exist" header predates the Planning doc's authoring — but cleanup is not in v1.5 scope.)

## §2 Reference documents

| Document | Section reference | Role in v1.5 |
|---|---|---|
| `docs/audit/F-Deploy-1_Fix_Plan_v1.4.md` (main, PR #717) | §6 (FD-26 through FD-28); §7 (unblock table) | Immediate predecessor. v1.5 inherits all Phase A / Phase B G1 closure state and the FD register through FD-28. |
| `docs/audit/F-Deploy-1_PhaseB_G1_Planning.md` (main, PR #716) | §10 (α implementation sequence); §12 (α decision lock) | Planning doc underlying the G2 implementation doc. Cited for continuity. |
| `docs/audit/F-Deploy-1_PhaseB_G2_Implementation.md` (main, PR #718) | Full doc (v1.0) | G2 contract v1.0. Superseded as canonical by v1.1; retained on disk per versioned-retention convention. |
| `docs/audit/F-Deploy-1_PhaseB_G2_Implementation_v1.1.md` (main, PR #719) | §4.5.1/§4.5.2 (ordering split); §7.3 (criterion 1 wording) | G2 contract v1.1. The contract §4.1 provisioning executes against. Its pipeline run surfaced FD-29/FD-30. |
| `docs/audit/F-Deploy-1_G1_Audit.md` (main, PR #698) | F-Deploy-G1 finding set | Source audit. FD-29/FD-30 attach as sub-findings F-Deploy-G1-AB / F-Deploy-G1-AC. |
| `docs/audit/Prime_Studios_Audit_Handoff_v10.docx` (main, PR #701) | §4.2 (F-Deploy-1 keystone status) | Audit canonical state. Unchanged by v1.5. |

**Git artifacts referenced in v1.5:**

| Artifact | What it is |
|---|---|
| PR #718 (G2 implementation doc v1.0) | First G2 contract ship. Merged 2026-05-26. Its commit body had no embedded double-quotes; merge-to-dev surfaced as failure (FD-30 latent) but unobserved at the time. |
| PR #719 (G2 implementation doc v1.1) | G2 contract revision. Merged 2026-05-28 via `--admin` (mergeStateStatus UNSTABLE due to the merge-to-dev job failing on FD-29 quote injection). The failure is what surfaced FD-29. |
| GitHub Actions run `26549506500` | merge-to-dev run on commit `b9c82f6e` (FD-29 fix only, before FD-30 fix). Token check ran clean past the env: fix, then `exit 78` failed the job. Empirical proof FD-29 works and FD-30 is a distinct bug. |
| GitHub Actions run `26578381234` | merge-to-dev run on commit `c30f16db` (FD-29 + FD-30 fixes). Conclusion: success. Step 2 success, steps 3–14 skipped, job green. Acceptance test for both fixes. |
| PR #720 (squash commit `5067b976`) | The FD-29 + FD-30 workflow fix. Merged 2026-05-28 at mergeStateStatus CLEAN — first session merge requiring no `--admin`, itself a signal the FD-30 fix worked. |

## §3 What shipped between v1.4 and v1.5

### §3.1 G2 implementation doc — PRs #718 (v1.0) and #719 (v1.1)

v1.4 merge (PR #717) unblocked G2 implementation doc authoring. The doc shipped as `F-Deploy-1_PhaseB_G2_Implementation.md` (v1.0, PR #718) — six-step sequence, per-step observables, rollback procedures, 7-day burn-in spec, G2 close criteria.

A review pass on v1.0 produced three fixes, shipped as v1.1 (PR #719, new file `_v1.1.md` alongside v1.0 per the Fix Plan versioned-retention convention):

- **§7.3 criterion 1 wording** — "synthetic peak" disambiguated from "idle baseline" (the term "baseline" was overloaded between §5.2 and §7.3).
- **§4.5 split into §4.5.1 (repo-side ecosystem config, FIRST) and §4.5.2 (SSH retirement, SECOND)** with explicit ordering rationale: PR-then-SSH so that `pm2 save` in §4.5.2 locks the on-disk manifest to merged repo state, closing a window where a shared-instance PM2 restart could replay the pre-retirement manifest.
- **§4.3 step 5** — removed a dangling cross-reference to §9.5 that did not cover the cited subject.

The v1.1 doc revision itself produced no register decisions. The register additions in v1.5 come from the workflow fix the v1.1 pipeline run surfaced.

### §3.2 FD-29 / FD-30 surfaced and fixed — PR #720

PR #719's pipeline run exposed two bugs in `auto-merge-to-dev.yml`, both in the `[skip-automerge]` step, both latent since the step was introduced (PR #705 / A-1b). Neither was caused by F-Deploy-1 fix-cycle work; both are CI/CD posture sub-findings of F-Deploy-G1 caught during execution.

- **FD-29 (F-Deploy-G1-AB):** `${{ github.event.head_commit.message }}` inlined into bash `run:` source. Commit bodies with double-quote characters broke the token check via shell string-literal closure. PR #719's v1.1 commit body (containing `"synthetic peak" vs "idle baseline"`) triggered it: `peak vs idle: command not found`, exit 127.

- **FD-30 (F-Deploy-G1-AC):** `exit 78` as a neutral-exit signal, deprecated by GitHub Actions YAML v2. The runner treats non-zero as failure. PRs #705/#707/#709/#717/#718/#719 all surfaced merge-to-dev as red X. The first FD-29 fix push (commit `b9c82f6e`) verified the env: fix worked — the token check ran clean despite quotes — but then hit `exit 78` and the runner marked the job failed, isolating FD-30 as a distinct bug.

Both fixed in PR #720 (squash `5067b976`):
- FD-29: B-strict env: pattern — all `${{ github.* }}` and `${{ steps.*.outputs.* }}` substitutions in `run:` blocks moved to `env:` blocks across five steps. Top-of-file FD-29 policy comment added.
- FD-30: `[skip-automerge]` step now sets a `skip=true` step output and `exit 0`; all 12 downstream steps gate on `if: steps.skip-check.outputs.skip != 'true'` and surface as skipped; job conclusion is success.

Verified live: run `26578381234` on the dual-fix commit concluded success with the expected step pattern (check success, 12 downstream skipped). The PR that shipped the FD-30 fix was the first merge-to-dev job in the repo's history to surface correctly as success.

## §4 Phase B G2 status at v1.5

v1.5 does not change G2's gate position. For completeness, the state inherited from v1.4 §4 plus the v1.1 doc:

- **G2 entry criteria** (v1.4 §4.1): satisfied. v1.4 on main, Planning doc on main, G2 doc on main (v1.1), no open PEs against the architectural decisions.
- **G2 implementation doc**: AUTHORED and on main at v1.1.
- **§4.1 provisioning**: NOT STARTED. The next executable G2 step. A real shared-state change (new EC2 instance); Rule 7 applies; the G2 doc's §4.1 gate (5 checks) must clear before §4.2.
- **§4.2 memory profile (hard gate)**: NOT REACHED. Until it fires, FD-27 (t3.micro) is neither confirmed nor revised, and the memory-profile data that v1.6 will carry does not exist.

No rollback triggers fired (no G2 implementation work has occurred). No F-Deploy-G1-Y recurrence.

## §5 Side discoveries during v1.5 authoring

No side discoveries during v1.5 authoring itself. v1.5 is an in-scope register-hygiene draft. The discoveries it records (FD-29, FD-30) were made during the PR #719/#720 work that preceded v1.5 authoring, not during the drafting of v1.5.

## §6 Decisions log — additions FD-29, FD-30

Decisions made during F-Deploy-1 Phase B G2 execution (the PR #719/#720 workflow fix), recorded into the register by v1.5. v1.4 ended at FD-28; v1.5 adds FD-29 and FD-30. Per the v1.4 convention, v1.5 records decisions made during execution work and cites the PR/commit where they were made, rather than claiming v1.5 originated them.

- **Decision FD-29: All GitHub Actions context substitutions referenced inside workflow `run:` blocks use `env:` injection, never inline `${{ ... }}` template substitution. Sub-finding F-Deploy-G1-AB. Root cause of PR #719's merge-to-dev failure (`peak vs idle: command not found`, exit 127): `${{ github.event.head_commit.message }}` was inlined into the `[skip-automerge]` step's bash `run:` source. GitHub Actions renders `${{ ... }}` literally into the script source before bash parses it, so a commit body containing a double-quote character closes the surrounding string literal and bash executes the trailing words as commands. Fix (B-strict): all `${{ github.* }}` and `${{ steps.*.outputs.* }}` substitutions in `run:` blocks across `auto-merge-to-dev.yml` moved to `env:` blocks (five steps: Check, Merge, Detect frontend, Detect backend, Notify), including values that appear safe today (branch names, SHAs, GitHub-controlled URLs) for defense in depth. A top-of-file policy comment documents the pattern. Verified by self-test: PR #720's own commit body deliberately contained quoted phrases, and run `26578381234`'s token check ran clean. The decision generalizes into the §8 audit-checklist guard. (PR #720, squash commit `5067b976`; verifying run `26578381234`.)**

- **Decision FD-30: The `[skip-automerge]` step signals skip via a step output and `exit 0`, with all downstream steps gated on that output, rather than via `exit 78`. Sub-finding F-Deploy-G1-AC. The `exit 78` neutral-exit pattern (introduced in PR #705 / A-1b, FD-4 Change A-1b) was deprecated by GitHub Actions YAML v2; the v1 HCL neutral-exit-78 behavior no longer applies, and the runner treats any non-zero exit as failure. Every `[skip-automerge]` PR since #705 (#707, #709, #717, #718, #719) surfaced the merge-to-dev job as a red X failure rather than a skip — harmless operationally (merge-to-dev is not a required status check, so it never blocked a merge) but the workflow's documented "neutral exit, surfaces as skipped" claim was factually wrong, and it masked the FD-29 quote-injection failure as just another expected-looking red X. The distinction surfaced when the FD-29 fix push (commit `b9c82f6e`) ran the token check clean and then still failed on `exit 78`. Fix: the step sets `skip=true` as a `$GITHUB_OUTPUT` value and exits 0 (success); all 12 downstream steps gate on `if: steps.skip-check.outputs.skip != 'true'` and surface as `skipped`; overall job conclusion is `success`. Verified by run `26578381234` (step 2 success, steps 3–14 skipped, job green) and by PR #720 itself merging at mergeStateStatus CLEAN. Corollary: the hardened-pipeline "N-for-N" framing may now legitimately include merge-to-dev rather than carrying the prior asterisk, since the job now reports its true status. (PR #720, squash commit `5067b976`; verifying run `26578381234`.)**

## §7 What v1.5 unblocks / does not unblock

### §7.1 What v1.5 unblocks

Nothing downstream. v1.5 is a register-hygiene revision; it does not move any gate. Its practical effect is local to CI/CD posture: future `claude/**` PRs using `[skip-automerge]` surface merge-to-dev correctly as skipped (FD-30), and commit bodies may contain double-quote characters without breaking the token check (FD-29).

### §7.2 What v1.5 does NOT unblock

**Phase B G2 close.** Unchanged. G2 closes at the G2 implementation doc's §4.6 after §4.1–§4.5 execute. §4.1 has not started.

**F-Stats-1 Phase B G2 pilot.** Unchanged from v1.4 §7.2. Blocked on F-Deploy-1 Phase B G2 close.

**F-AUTH-1 fix execution.** Unchanged from v1.4 §7.2. Blocked on F-Deploy-1 Phase B G2 close (F-Deploy-1's full close).

**Downstream keystone sequence.** F-App-1, F-Ward-1, F-Reg-2, F-Ward-3, F-Franchise-1 (Director Brain build), F-Sec-3 — unchanged from v1.4 §7.2 and v10 §4.2.

**§6.5.1 route-table audit + further NAT reduction.** Unchanged. Deferred per Planning doc §13.

### §7.3 State of play at v1.5 close

| Tier | Item | Status |
|---|---|---|
| Phase A | Overall | CLOSED (inherited from v1.4) |
| Phase B G1 | Gate close | CLOSED (v1.4 merge, FD-26/27/28) |
| Phase B G2 | Implementation doc | AUTHORED — on main at v1.1 (PR #718 v1.0, PR #719 v1.1) |
| Phase B G2 | §4.1 provisioning | NOT STARTED (next executable G2 step) |
| Phase B G2 | §4.2 memory profile (hard gate) | NOT REACHED |
| Phase B G2 | α implementation overall | NOT STARTED |
| Phase B G2 | CI/CD posture (FD-29/FD-30) | CLOSED (PR #720, commit `5067b976`) |
| Phase C | All gates | NOT STARTED (blocked behind Phase B close) |
| Register | FD entries | FD-1 through FD-30 (v1.5 adds FD-29, FD-30) |

**Path A discipline note:** v1.5 adds no scope to the fix cycle. FD-29 and FD-30 are CI/CD posture sub-findings of F-Deploy-G1, caught during G2 execution, in the same workflow file (`auto-merge-to-dev.yml`) that FD-4 / FD-13 already touched. v1.5 records decisions made during the PR #720 work and cites that PR rather than originating them — the same recording-not-originating discipline v1.4 applied to FD-26/27/28. The §8 checklist addition generalizes FD-29 into a recurring-pattern guard, consistent with the audit's existing practice of tracking recurring codebase patterns.

## §8 Audit checklist addition — workflow context-substitution guard

FD-29 generalizes beyond the single fixed instance into a recurring-pattern guard, recorded here for the audit checklist (parallel to the audit's existing recurring-pattern tracking, e.g. "hardcoded JS constants masquerading as canon," "defensive schema coding = production migration drift signal").

**Guard:** In any GitHub Actions workflow `run:` block, GitHub context values (`${{ github.* }}`, `${{ steps.*.outputs.* }}`, and any other `${{ ... }}` expression whose value could contain shell-meta characters) MUST be passed via a step-level `env:` block and referenced as shell variables (`$VARNAME`), never inlined directly into the `run:` script source.

**Why it belongs on the checklist:** Inline `${{ ... }}` substitution renders the value into the bash script source before bash parses it. Any value containing `"`, `` ` ``, `$`, `\`, or other shell-meta characters can break the script or, in the worst case, allow command injection from user-influenceable values (commit messages, branch names, PR titles, issue bodies). The `env:` pattern isolates the value into the shell environment, where it is inert. The cost of compliance is near-zero; the cost of a violation is a broken or exploitable workflow.

**Scope of the guard:** Applies to all workflows in `.github/workflows/`. The directory contains exactly four workflows at v1.5 authoring: `auto-merge-to-dev.yml`, `validate.yml`, `deploy-dev.yml`, `deploy-production.yml`. Only `auto-merge-to-dev.yml` was audited and fixed (PR #720). The remaining three (`validate.yml`, `deploy-dev.yml`, `deploy-production.yml`) have NOT been audited against this guard. A sweep of those three is a candidate post-G2 work item — low priority (none has exhibited a failure), but the guard is not fully discharged until all four are checked. Note that `deploy-dev.yml` is independently due for a touch during G2 §4.3 (retargeting); the env: audit of that file could fold into the §4.3 work rather than waiting for a separate sweep.

## §9 Ship plan

v1.5 ships in this order:

1. **v1.5 PR opened** on branch `claude/f-deploy-1-fix-plan-v1-5`, new file `docs/audit/F-Deploy-1_Fix_Plan_v1.5.md` alongside v1.0–v1.4 per the versioned-retention convention, with `[skip-automerge]` token in the commit message body.
2. **Pipeline runs.** FD-5 required checks (Cost Exposure Audit, Tests, Route Validation) plus the FD-4 auto-merge-to-dev workflow — now with FD-29/FD-30 fixes live, so merge-to-dev should surface as a clean skip for the first time on a Fix Plan PR.
3. **v1.5 PR merges to main.** Register updated to FD-1 through FD-30; §8 checklist guard recorded. No gate transition.
4. **§4.1 provisioning** remains the next executable G2 work item, unchanged. Not triggered by v1.5 merge; requires a separate executor session.

Steps 1–3 are this doc's ship sequence. Step 4 is the G2 work itself, operating against the G2 implementation doc v1.1 as its contract.

**Rule 7 gates** apply to the push, PR create, and merge of v1.5 (real shared-state changes), per house pattern. v1.5 is a doc-only change; the merge-to-dev job is expected to surface as a clean skip per the FD-30 fix this register entry documents.

---

*End of F-Deploy-1 Fix Plan v1.5 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Branch: `claude/f-deploy-1-fix-plan-v1-5` (to be created at file-write time).*
*Date: 2026-05-28.*
*Predecessor: v1.4 (PR #717, merged 2026-05-26).*
*Successor: TBD. Likely v1.6 at G2 close, carrying the §4.2 memory-profile observations, the FD-27 confirm-or-revise (t3.micro held, or t3.small under §6.1 fallback), and the G2 close record.*
