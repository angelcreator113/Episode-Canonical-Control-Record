# F-Deploy-1 Fix Plan v1.4

**Phase B G1 closure — α decision locked; FD-26/27/28 registered; G2 entry criteria specified**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.3 (Phase A G2 close + G4 soak start, merged 2026-05-19 via PR #712) |
| **Audit reference** | `docs/audit/F-Deploy-1_G1_Audit.md` (main, merged via PR #698) |
| **Planning doc reference** | `docs/audit/F-Deploy-1_PhaseB_G1_Planning.md` (main, merged 2026-05-26 via PR #716) |
| **Author start date** | 2026-05-26 |
| **Author session** | Single session, post-Phase-A-G4-soak-close, post-Planning-doc-merge |
| **Status** | DRAFT v1.4 |
| **Gate transition** | Phase B G1 closes at v1.4 merge. Phase B G2 (α implementation) becomes the next executable gate. |

**Naming note:** v1.3's footer anticipated `v2.0 scoping Phase B G1 architectural decision after G4 soak completes`. This revision lands as v1.4 rather than v2.0 because Phase B G1 closed within the v1.x family — the architectural decision was substantive but did not introduce a structural break warranting a major-version bump. A future reader auditing the version sequence should not interpret the v1.3→v1.4 transition as a skipped v2.0; the v2.0 framing in v1.3's footer was anticipatory, not a commitment.

## §1 Purpose

v1.4 closes Phase B G1 of F-Deploy-1. Specifically:

1. **Phase A G4 soak closed clean.** 8-day soak (2026-05-19 through 2026-05-26) completed with zero incidents. 4-for-4 PR pipeline performance through the hardened FD-5/FD-20/FD-23/FD-24/FD-25 stack (PRs #712–#715). Closed via PR #712 (Fix Plan v1.3 + soak-window PE filings) and downstream merges. Phase A is fully closed as of v1.3 + soak completion; v1.4 inherits that state and does not re-decide it.

2. **Phase B G1 planning doc on main.** `docs/audit/F-Deploy-1_PhaseB_G1_Planning.md` merged via PR #716 (commit `4bb001ea`, 2026-05-26). The Planning doc closes the α/β architectural decision in its §12 and names the implementation sequence in its §10. v1.4 cites the Planning doc rather than re-deciding.

3. **Decision register lock — FD-26, FD-27, FD-28.** v1.4 records three new decisions in the register, each citing a section of the Planning doc rather than re-litigating the underlying choice. FD-26 = α selection. FD-27 = t3.micro instance class. FD-28 = retire `*-dev` PM2 app definitions. Detail in §6.

4. **Phase B G2 entry criteria.** Planning doc §11 punted post-cutover verification scope to "Fix Plan v1.4 (Phase B G2 entry criteria) and/or the Phase B G2 implementation doc when authored." v1.4 closes the entry-criteria half of that punt: what must be true before G2 work begins, what observables G2 will watch, what triggers rollback. The full verification plan (exact smoke test commands, exact soak window length, exact alert thresholds) remains owned by the G2 implementation doc when authored. Detail in §4.

5. **Phase B G2 unblocks.** Per Planning doc §10 and v1.4 §4, G2 is the implementation gate. v1.4 merge is the last predecessor; G2 starts at v1.4 merge timestamp.

What v1.4 does NOT do:
- Does not implement α. Implementation owned by Phase B G2.
- Does not delete `docs/audit/F-Deploy-1_PhaseB_G1_Pre-drafted_Amendments.md`. Its disposition is a Phase B G2 cutover-time call per Planning doc §14, not a v1.4 call.
- Does not re-decide Phase A closure. Phase A closed across v1.3 + G4 soak; v1.4 inherits.
- Does not amend Fix Plan v1.0 §6 framing. v1.0 §6 framed the α/β choice; the Planning doc closed it; v1.4 records the close. No upstream framing change.
- Does not address §6.5.1 route-table audit (retained 2 NAT Gateways idle status). Deferred per Planning doc §13. v1.4 does not move that destination forward.
- Does not specify exact G2 cutover commands, exact soak window length post-cutover, or exact alert thresholds. Owned by the G2 implementation doc when authored.

## §2 Reference documents

| Document | Section reference | Role in v1.4 |
|---|---|---|
| `docs/audit/F-Deploy-1_Fix_Plan_v1.0.md` (main, PR #699) | §6 (α/β framing); §11 (FD-1 through FD-12) | Original α/β framing. Planning doc §6.2 confirms framing match; v1.4 inherits without amendment. |
| `docs/audit/F-Deploy-1_Fix_Plan_v1.1.md` (main, PR #703) | Gate A-G1 close; FD-13 through FD-15 | Predecessor of predecessor of predecessor; cited for FD numbering continuity. |
| `docs/audit/F-Deploy-1_Fix_Plan_v1.2.md` (main, PR #706) | A-1b ship, sub-form D partial findings, FD-16 through FD-20 | Cited for FD numbering continuity. |
| `docs/audit/F-Deploy-1_Fix_Plan_v1.3.md` (main, PR #712) | Phase A G2 close, FD-21 through FD-25, G4 soak start | Immediate predecessor. v1.4 inherits Phase A closure state from v1.3 + soak. |
| `docs/audit/F-Deploy-1_PhaseB_G1_Planning.md` (main, PR #716) | §6.3 close (dev can run minimal); §10 (α implementation sequence); §10.3 (FD-28 home); §11 (verification stub); §12 (α decision lock); §13 (deferred items) | Planning doc whose decisions v1.4 records. FD-26/27/28 each cite a section. |
| `docs/audit/F-Deploy-1_G1_Audit.md` (main, PR #698) | Phase B G1 scope reference | Source audit; cited for keystone framing continuity. |
| `docs/audit/Prime_Studios_Audit_Handoff_v10.docx` (main, PR #701) | §4.2 (F-Deploy-1 keystone status) | Audit canonical state at v1.4 author start. v10 §4.2 named Phase B G1 as gated by Phase A close; v1.4 records that gate transition. |

**Git artifacts referenced in v1.4:**

| Artifact | What it is |
|---|---|
| PR #712 (merge commit per v1.3 ship plan) | v1.3 ship + Phase A G4 soak start. Soak completed clean. |
| PRs #713, #714, #715 | Audit-backlog PRs landed during/after G4 soak (F-Deploy-G1-Y postmortem, F-Tools-1 tooling audit, F-AUTH-1 §5.1 pre-flight grep). All clean through the hardened pipeline. |
| PR #716 (merge commit `4bb001ea`) | Phase B G1 Planning doc ship. Merged 2026-05-26T22:0X:00Z. 5th clean run through the hardened pipeline (4 soak + 1 post-soak). |

## §3 What shipped between v1.3 and v1.4

### §3.1 Phase A G4 soak — 8-day clean

Soak window: 2026-05-19 (v1.3 merge timestamp) through 2026-05-26 (v1.4 author start). Soak monitoring per Fix Plan v1.0 §5.5: no autonomous merge events to main outside the validate.yml-gated PR path; no `-X ours` events that failed to notify #708; no branch protection bypasses; no F-Deploy-G1-Y recurrence.

**Observables across the soak:**

- 4 PRs through the hardened pipeline (#712, #713, #714, #715), all completed without incident. FD-4 (auto-merge-to-dev opt-out), FD-5 (branch protection on main), FD-20 (loki removal), FD-23 (job-level required check names), FD-24 (strict-mode required_status_checks), FD-25 (PR #704 closure) all held without exception.
- Zero `-X ours` events on auto-merge-to-dev workflow. Issue #708 received no new notifications; the A-3 notification mechanism's first live exercise remains unobserved (acceptable per v1.3 §3.2 deferred empirical verification).
- Zero F-Deploy-G1-Y recurrences. 8 diagnostic data points at v1.3 author time + ~8 days of additional live operation = closure remains supported by accumulated evidence.
- Zero branch protection bypasses observed via audit-log spot-checks.

**External soak-window events folded in via PE filings:** any PE filings landed during the soak that affected v1.4's framing are cited inline at the relevant section.

**Conclusion:** Phase A closes via the v1.3 + soak combination. v1.4 inherits this closure state.

### §3.2 Phase B G1 Planning doc — PR #716

Planning doc authored 2026-05-26 and merged same day via PR #716 (commit `4bb001ea`, single file `docs/audit/F-Deploy-1_PhaseB_G1_Planning.md`, 399 insertions). Pipeline run: 4 of 4 checks green (Cost Exposure Audit, Tests, Route Validation, Auto-merge to Dev), fast-forward merge to main.

The Planning doc:
- Locks α/β as α (§12).
- Names instance: `episode-dev-backend` (§12).
- Names instance class: t3.micro (§12, citing §6.3 close).
- Names AZ: us-east-1d (§12, parity with prod per soak-day-4 live topology check).
- Specifies cost adder: ~$10–15/month at the compute layer (§4.4 revised, §12).
- Documents the α implementation sequence at the planning level (§10).
- Carries deferred items with destinations (§13).
- Records the sub-amendment trail (§14).

v1.4 cites the Planning doc rather than re-stating its content. The substantive citations are FD-26 → §12, FD-27 → §12 + §6.3 close, FD-28 → §10.3.

### §3.3 Audit-backlog PRs during soak — #713, #714, #715

These PRs are out of F-Deploy-1's direct scope but landed during the soak window and contributed observable data to the soak's clean-pipeline finding:

- **PR #713** — F-Deploy-G1-Y postmortem (removal-sufficient closure documentation).
- **PR #714** — F-Tools-1 tooling environment audit (one-time survey deliverable). Confirmed which automated tools have write paths to the codebase. Cited by Planning doc §2 as input to G2 implementation sequencing.
- **PR #715** — F-AUTH-1 §5.1 pre-flight grep deliverable + runnable script. Sequenced ahead of F-AUTH-1 fix execution per the v9 fix sequence.

None of these alter v1.4's decisions; they establish that the hardened pipeline performed across multiple PR shapes during the soak, not just on the v1.4-shaped PR class.

## §4 Phase B G2 entry criteria

Closes the Planning doc §11 stub at the entry-criteria level. The full G2 verification plan (exact commands, exact thresholds, exact soak length post-cutover) belongs to the G2 implementation doc when authored.

### §4.1 What must be true before G2 work begins

1. **v1.4 on main.** This document merged. Decision register entries FD-26/27/28 visible in v1.4 §6.
2. **Planning doc on main.** PR #716 merged (already true at v1.4 author time; commit `4bb001ea`).
3. **No open PEs against v1.0 §6 framing, Planning doc §12, or Planning doc §10.** A PE filed against any of these would indicate the architectural decision needs revisiting before implementation, not during.
4. **AWS credentials and console access verified.** G2 involves EC2 provisioning, security group / IAM configuration, and `deploy-dev.yml` edits. The solo-maintainer must have working AWS console + CLI access at G2 start.
5. **Existing `episode-backend` instance health confirmed.** G2 introduces a new instance alongside the existing one; G2 must not start during a state where the existing prod instance is degraded.

### §4.2 Observables G2 will watch

The G2 implementation doc will specify exact thresholds. v1.4 names the categories at the entry-criteria level:

- **New instance health.** CPU, memory, disk, network on `episode-dev-backend` post-provisioning and post-first-deploy. Specifically: memory usage during the video-render path, given the §9.1 risk in the Planning doc that t3.micro's 1 GiB ceiling may be insufficient.
- **Existing instance unaffected.** Prod `episode-backend` CPU, memory, error rates, request latency should be unchanged from pre-G2 baseline. Any regression on the prod instance during G2 is a strong rollback signal.
- **Workflow execution.** `deploy-dev.yml` runs target the new instance correctly post-retarget. `deploy.yml` runs continue targeting prod correctly. No cross-workflow targeting errors.
- **PM2 process tree state.** Both instances: confirm process count, namespace assignment, restart behavior. On the shared `episode-backend` instance: confirm `*-dev` PM2 apps remain present until §10.3 retirement and are then absent post-retirement.

### §4.3 Rollback triggers

Per Planning doc §10.5, the rollback path is sequenced. v1.4 names the rollback *triggers* at the entry-criteria level:

- **Memory ceiling exceeded on t3.micro during video-render.** Per Planning doc §9.1, the fallback is in-place class change to t3.small, not α/β re-open.
- **Deploy targeting error on `deploy-dev.yml` retarget.** If the retargeted workflow fails to land a deploy or lands it on the wrong instance, revert `deploy-dev.yml` to its prior targeting before further G2 work.
- **Prod instance regression.** If `episode-backend` CPU, memory, or error rates regress measurably during G2 work, stop G2 and investigate before continuing. The regression is unlikely to be caused by G2 (the two instances are physically separate under α), but the rollback discipline treats correlation as worth investigating regardless.
- **F-Deploy-G1-Y recurrence.** Per FD-22 (correlation + sufficiency closure), F-Deploy-G1-Y is closed but not causally resolved. Any recurrence during G2 is a stop-G2-and-investigate trigger.

### §4.4 Sequencing within G2

Planning doc §10 names six implementation steps. v1.4 §4 does not re-state them; the entry criteria above apply across all six steps. The G2 implementation doc will specify which steps require which observables to be green before proceeding to the next step. v1.4 records that the gating exists; the gating thresholds belong to the G2 doc.

### §4.5 G2 close criterion

G2 closes when:
- `episode-dev-backend` is provisioned, healthy, and serving dev workload.
- `deploy-dev.yml` deploys to it cleanly across at least one successful end-to-end deploy.
- `*-dev` PM2 app definitions on the shared `episode-backend` instance are retired per Planning doc §10.3.
- Post-cutover burn-in window completes clean (window length owned by G2 doc).

At G2 close, F-Deploy-1 Phase B is fully closed, and the F-Stats-1 Phase B G2 pilot can begin against the now-isolated dev instance.

## §5 Side discoveries during v1.4 authoring

No side discoveries. v1.4 authoring was a single-session, in-scope draft against the v1.3 house style and the Planning doc on main. The PR #716 pipeline run during planning-doc ship surfaced no anomalies. No FD-21-class incidents to record.

## §6 Decisions log — additions FD-26, FD-27, FD-28

Decisions made during v1.4 authoring. v1.3 ended at FD-25; v1.4 adds FD-26 through FD-28.

- **Decision FD-26: Phase B G1 deploy-tier architecture = α (separate dev EC2). The new instance is `episode-dev-backend`, located in us-east-1d for parity with prod `episode-backend` (per Planning doc §12 rationale: matching prod AZ eliminates AZ-pinned confounds during F-Stats-1 Phase B G2 pilot work). The decision rests on Planning doc §8.1 (architectural isolation), §8.2 (operational simplicity for solo-maintainer), and §8.3 (cost is a supporting input, not dispositive — compute delta under α is ~$10–15/month at t3.micro, dwarfed by α/β-independent NAT topology cost). FD-26 records the decision; the decision itself was made in the Planning doc §12 and is not re-litigated here. (Planning doc §12.)**

- **Decision FD-27: Dev instance class = t3.micro. Per Planning doc §6.3 close on 2026-05-20: "dev can run minimal." Rationale: dev serves double duty as development environment and pre-prod staging for solo-developer workflow; functional parity (env vars, schema, S3 bucket structure, dependency versions) is the operational requirement, not resource parity. Current single-shared-instance evidence at 0.74% average CPU validates that dev's resource ceiling is well below t3.small. Worker video-render memory profile check for potential future t3.nano optimization is deferred to post-G2 work per Planning doc §13 and is not gated by FD-27. If post-cutover observation reveals that t3.micro's 1 GiB memory ceiling is insufficient for the video-render path, the fallback per Planning doc §9.1 is in-place class change to t3.small, not re-opening the α/β decision. (Planning doc §12; Planning doc §6.3.)**

- **Decision FD-28: Retire `*-dev` PM2 app definitions in `deploy-dev.yml` and the PM2 ecosystem config. Per Planning doc §10.3: under α, dev runs on a separate instance with its own PM2 process tree; the `*-dev` PM2 app definitions on the shared `episode-backend` instance are vestigial. Retirement steps (planning level, not implementation level): confirm `deploy-dev.yml` retargeting is live and the new dev instance is healthy, then stop and delete `*-dev` PM2 app definitions on the shared instance, remove `*-dev` app definitions from any committed PM2 ecosystem config in the repo, verify shared-instance PM2 process tree contains only prod apps post-retirement. FD-28 is registered as a separate decision rather than absorbed into FD-26/FD-27 because it affects a workflow file with its own ship gate (after `deploy-dev.yml` retargeting is verified live) and could in principle ship at a different time than EC2 provisioning. Treating it as a separate FD lets v1.4 lock the EC2-side decisions (FD-26/FD-27) and the workflow-side decision (FD-28) with independent register entries rather than collapsing them into one decision that would have to ship atomically. (Planning doc §10.3.)**

## §7 What v1.4 unblocks / does not unblock

### §7.1 What v1.4 unblocks

**Phase B G2 (α implementation).** Per Planning doc §10 and v1.4 §4, G2 is the implementation gate. v1.4 closes G1 by locking FD-26/27/28 and specifying G2 entry criteria. G2 starts at v1.4 merge timestamp + 0; G2 first-step gating per v1.4 §4.1.

**Phase B G2 implementation doc authoring.** v1.4 §4 punted exact verification specifics to the G2 implementation doc. That doc can now be authored against v1.4's entry-criteria spec and the Planning doc's §10 step sequence.

### §7.2 What v1.4 does NOT unblock

**F-Stats-1 Phase B G2 pilot.** Per Decision #98 (v10 revised, FD-10), blocked on F-Deploy-1 Phase A close + the structural isolation that α provides. Phase A is closed, but α implementation (F-Deploy-1 Phase B G2) has not landed. F-Stats-1 Phase B G2 unblocks at F-Deploy-1 Phase B G2 close, not at v1.4 merge.

**F-AUTH-1 fix execution.** Per the v9 fix sequence, F-AUTH-1 is the first keystone after F-Deploy-1 closes. F-Deploy-1 closes at Phase B G2 close, not at v1.4 merge. F-AUTH-1 §5.1 pre-flight is on main (PR #715); F-AUTH-1 §5.2 through §5.6 execution remains queued.

**Downstream keystone sequence.** F-App-1, F-Ward-1, F-Reg-2, F-Ward-3, F-Franchise-1 (Director Brain build), F-Sec-3 — all downstream of F-AUTH-1, transitively downstream of F-Deploy-1 Phase B G2 close. Unchanged from v10 §4.2 and v1.3 §7.2.

**§6.5.1 route-table audit + further NAT reduction.** Per Planning doc §13, deferred destinations are post-G2 work. v1.4 does not move them forward.

### §7.3 State of play at v1.4 close

| Tier | Item | Status |
|---|---|---|
| Phase A G1 | Pre-flight | CLOSED (v1.1, PR #703) |
| Phase A G2 | Sub-forms A, C, D | CLOSED (v1.3, PRs #707/#709/C-1 API call) |
| Phase A G2 | Gate close | CLOSED (v1.3 merge) |
| Phase A G3 | Diagnostic phase | SUPERSEDED (v1.3 §4.3) |
| Phase A G4 | 1-week soak | CLOSED CLEAN (2026-05-19 through 2026-05-26) |
| Phase A | Overall | CLOSED |
| Phase B G1 | Planning doc | MERGED (PR #716, commit `4bb001ea`) |
| Phase B G1 | Decision register lock | CLOSED at v1.4 merge (FD-26, FD-27, FD-28) |
| Phase B G1 | Gate close | CLOSED at v1.4 merge |
| Phase B G2 | Implementation doc | NOT AUTHORED (authoring unblocks at v1.4 merge) |
| Phase B G2 | α implementation | NOT STARTED (gated by entry criteria in v1.4 §4.1) |
| Phase C | All gates | NOT STARTED (blocked behind Phase B close) |

**Path A discipline note:** v1.4 ships no scope additions to existing audit findings. FD-26/27/28 each cite a Planning doc section that pre-dates v1.4's authoring; v1.4 records the decisions rather than originating them. The Planning doc §11 stub close in v1.4 §4 is the only authoring-time substantive content, and §11 explicitly named v1.4 as its destination — no scope drift.

## §8 Ship plan

v1.4 ships in this order:

1. **v1.4 PR opened** on branch `claude/f-deploy-1-fix-plan-v1-4`, with `[skip-automerge]` token in commit message body.
2. **Pipeline runs.** FD-5 required checks (Cost Exposure Audit, Tests, Route Validation) plus the FD-4 auto-merge-to-dev workflow. Same hardened-pipeline stack that ran clean across the G4 soak and PR #716.
3. **v1.4 PR merges to main.** Phase B G1 closes; Phase B G2 unblocks.
4. **Phase B G2 implementation doc authoring** opens as the next executable work item. Not auto-triggered by v1.4 merge; requires explicit author session.

Steps 1, 2, 3 are sequenced. Step 4 is a downstream work item that does not happen automatically.

**Rule 7 gates** apply to steps 2 and 3 in the sense that the pipeline's outcome is observed before any manual merge action. v1.4 author session does not auto-execute the merge; the human merger (Evoni) confirms pipeline state and then merges via `gh pr merge` per house pattern (squash, delete branch).

---

*End of F-Deploy-1 Fix Plan v1.4 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Branch: `claude/f-deploy-1-fix-plan-v1-4` (to be created at file-write time).*
*Date: 2026-05-26.*
*Predecessor: v1.3 (PR #712, merged 2026-05-19).*
*Successor: TBD. Likely Phase B G2 implementation doc (separate file, not v1.5) as the next executable artifact; v1.5 would be reserved for a subsequent revision of the Fix Plan itself if substantive register additions arise during G2 work.*
