# F-Deploy-1 Fix Plan v1.3

**Phase A G2 closure — sub-form A complete, sub-form C shipped, sub-form D closed; G3 superseded; G4 soak unblocked**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.2 (A-1b ship + sub-form D partial findings, merged 2026-05-17 via PR #706) |
| **Audit reference** | `docs/audit/F-Deploy-1_G1_Audit.md` (main, merged via PR #698) |
| **Author start date** | 2026-05-18 |
| **Author session** | Single session, post-A-3 ship and C-1 pre-flight verification |
| **Status** | DRAFT v1.3 |
| **Sub-form scope** | A (closed: A-1/A-2/A-3 shipped), C (closed: C-1 shipped), D (closed: F-Deploy-G1-Y closure as identified — removal-sufficient) |
| **Gate transition** | Phase A G2 closes at v1.3 merge. Phase A G3 diagnostic phase superseded by sub-form D closure. Phase A G4 soak is the next executable gate. |

## §1 Purpose

v1.3 closes Phase A G2 of F-Deploy-1. Specifically:

1. **Sub-form A closed.** A-1 shipped via PR #705 (recorded in v1.2). A-2 shipped via PR #707 (2026-05-18T19:57:55Z, commit `6cf936dc`). A-3 shipped via PR #709 (2026-05-18T22:30:52Z, commit `8e8f50b2`). All three FD-4 workflow changes are live on main.

2. **Sub-form C closed.** C-1 shipped via direct `gh api PUT` to `/repos/.../branches/main/protection`, applying the FD-5 minimal real gate (required_status_checks: Cost Exposure Audit + Tests + Route Validation; zero required reviews; enforce_admins false). No PR exists for C-1 because it is a repository configuration change, not a code change.

3. **Sub-form D closed.** F-Deploy-G1-Y closes as **identified — removal-sufficient**. 8 diagnostic data points across VS Code closed and VS Code open conditions, wait windows 30 seconds to 15 minutes, all clean after loki-laufeyson.intelligent-assistant 1.0.9 removal on 2026-05-17. v1.2 FD-19 explicitly deferred closure on N=1 evidence; v1.3 FD-22 closes on N=8 with variable isolation. Both decisions are correct at their respective evidence states.

4. **Phase A G2 close criteria met.** Per Fix Plan v1.0 §5.4, G2 closes when sub-forms A, C, D all complete. v1.3 advances all three to closed. G2 closes at v1.3 merge.

5. **Phase A G3 superseded.** Fix Plan v1.0 §5.3 scoped G3 as a diagnostic phase to identify the F-Deploy-G1-Y mechanism. The diagnostic was performed in-line during sub-form D work between v1.2 and v1.3 author start. G3 has no remaining executable content; v1.3 marks G3 closed by supersession rather than execution.

6. **FD-21 forensics.** Issue #708 was auto-closed on PR #709 merge due to a closing-keyword in the commit message body's conditional clause. Discovered during C-1 pre-flight. Documented as FD-21; issue reopened standalone on 2026-05-18 prior to v1.3 authoring.

What v1.3 does NOT do:
- Does not amend Fix Plan v1.0 §5.4 G2 close criteria.
- Does not initiate Phase A G4 soak. Soak begins at v1.3 merge per FD-10; v1.3 defines start conditions but does not execute the soak.
- Does not amend v10 audit handoff. v10 §4.2 explicitly permitted the "identified — known tool's normal operation" outcome shape; v1.3 invokes that permission without modifying it.
- Does not close PR #704. PR #704 closes as part of v1.3 ship; the closure is sequenced after v1.3 merge to preserve the incident record's standalone visibility during v1.3 review.

## §2 Reference documents

| Document | Section reference | Role in v1.3 |
|---|---|---|
| `docs/audit/F-Deploy-1_Fix_Plan_v1.0.md` (main, PR #699) | §5.1 (sub-form A), §5.2 (sub-form C / FD-5), §5.3 (sub-form D / G3), §5.4 (G2 close criteria), §5.5 (G4 soak start), §11 (FD-1 through FD-12) | Original Phase A plan; v1.3 closes sub-forms A, C, D and triggers G2 close per §5.4. |
| `docs/audit/F-Deploy-1_Fix_Plan_v1.1.md` (main, PR #703) | Gate A-G1 close; FD-13 through FD-15 | Predecessor revision (predecessor of v1.2). |
| `docs/audit/F-Deploy-1_Fix_Plan_v1.2.md` (main, PR #706) | A-1b ship, sub-form D partial findings, FD-16 through FD-20 | Immediate predecessor. FD-19 is explicitly reversed by v1.3 FD-22. |
| `docs/audit/F-Deploy-1_G1_Audit.md` (main, PR #698) | F-Deploy-G1-Y (sub-form D finding); F-Deploy-G1-V/W/X (sub-form C findings) | Source for closure attributions. |
| `docs/audit/Prime_Studios_Audit_Handoff_v10.docx` (main, PR #701) | §4.2 (F-Deploy-1 keystone status); Decision #104 (F-Deploy-G1-Y candidate narrowing) | Audit canonical state at v1.3 author start. v10 §4.2 permits "identified — known tool's normal operation" closure shape; v1.3 invokes it. |

**Git artifacts referenced in v1.3:**

| Artifact | What it is |
|---|---|
| PR #704 (`claude/f-deploy-1-a-1-opt-out-token`) | Original A-1 ship; commit `0195a2f4` is the amended head. Open as F-Deploy-G1-Y incident record per FD-17. Closes as part of v1.3 ship per §6.3. |
| PR #705 (merge commit `1f548aed`) | A-1b clean delivery. Merged 2026-05-17T17:21:25Z. (Recorded in v1.2.) |
| PR #706 (merge commit `f43f9c75`) | v1.2 docs ship. Merged 2026-05-17T22:13:33Z. |
| PR #707 (merge commit `6cf936dc`) | A-2: backend syntax verification step added to auto-merge-to-dev.yml. Merged 2026-05-18T19:57:55Z. |
| PR #709 (merge commit `8e8f50b2`) | A-3: `-X ours` author notification step added to auto-merge-to-dev.yml. Merged 2026-05-18T22:30:52Z. Side effect: auto-closed issue #708 via commit-message closing-keyword (FD-21). |
| Issue #708 (running log: auto-merge -X ours incidents) | Workflow notification surface targeted by A-3. Auto-closed 22:30:53Z by PR #709 merge. Reopened standalone 2026-05-18 prior to v1.3 authoring with forensics comment forward-referencing FD-21. |
| C-1 ship | `gh api PUT /repos/angelcreator113/Episode-Canonical-Control-Record/branches/main/protection` with payload per §3.3. No commit, no PR. Verification via `gh api ... /branches/main/protection` GET. |

## §3 What shipped between v1.2 and v1.3

### §3.1 A-2 — backend syntax verification (PR #707)

Per FD-4 Change A-2.2 (Fix Plan v1.0 §5.1.1.B), adds a step to auto-merge-to-dev.yml that runs `node --check` on `src/**/*.js` after the merge resolves, gated by a `backend-changes` detection step. If the merged tree fails to parse, the workflow fails and the merge is rejected.

Merged 2026-05-18T19:57:55Z via PR #707 / commit `6cf936dc`. Shipped under the A-1b pattern (branched from main, `[skip-automerge]` token in commit message, no inheritance from PR #704's contaminated lineage).

**Verification:** The workflow's syntax-check step is observable in `.github/workflows/auto-merge-to-dev.yml` lines 162–173 on main. Empirical firing of the step has not been forced as of v1.3 author time; the step has not been exercised by a real `claude/**` push containing a backend-syntax error. v1.3 records this as a deferred empirical verification — A-2's mechanism is present, A-2's behavior under fault is not yet observed. This is acceptable for G2 close; a fault-injection test is queued for Phase A G4 soak.

### §3.2 A-3 — `-X ours` author notification (PR #709)

Per FD-4 Change A-2.3 (Fix Plan v1.0 §5.1.1.C), adds a step to auto-merge-to-dev.yml that appends a comment to issue #708 every time the workflow's merge resolves via `-X ours`. Comment names source branch, source SHA, dev SHAs before and after merge, files modified, and workflow run URL.

Merged 2026-05-18T22:30:52Z via PR #709 / commit `8e8f50b2`. Shipped under the A-1b pattern.

**Verification:** Same as A-2 — the step is present in `.github/workflows/auto-merge-to-dev.yml` lines 179–230 on main. A `-X ours` event has not occurred since A-3 shipped; first live notification timing is unknown.

**Side effect — FD-21.** PR #709's commit message body contained the string "close #708" inside a conditional clause: "If reform of the -X ours strategy happens (abort+notify instead of silent merge), close #708 and remove this step." GitHub's closing-keyword parser does not respect conditional grammar; the merge auto-closed #708. Discovered during C-1 pre-flight verification of issue #708 state. Forensics in §5.2 and FD-21.

### §3.3 C-1 — branch protection on main

Per FD-5 (Fix Plan v1.0 §5.2.1), shipped as a direct API call to `/repos/.../branches/main/protection`. Payload:

```json
{
  "required_status_checks": {
    "strict": true,
    "contexts": ["Cost Exposure Audit", "Tests", "Route Validation"]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0,
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false
  },
  "restrictions": null
}
```

**Rule interpretation per FD-5:**
- `required_status_checks: [Validate]` in FD-5 specifies the workflow conceptually; the API requires job-level check names. v1.3 implements as three job names (`Cost Exposure Audit`, `Tests`, `Route Validation`) corresponding to validate.yml's three jobs. This is a literal-vs-conceptual mapping decision; recorded as FD-23.
- `strict: true` (PR must be up-to-date with main before merge) is not specified by FD-5. v1.3 commits to strict mode; recorded as FD-24.
- `enforce_admins: false` per FD-5 exactly.
- `required_approving_review_count: 0` per FD-5 exactly (solo-maintainer environment).

**Verification:** `gh api /repos/angelcreator113/Episode-Canonical-Control-Record/branches/main/protection` GET response shows required_status_checks.contexts = the three names, strict = true, enforce_admins.enabled = false, required_pull_request_reviews.required_approving_review_count = 0. C-1 verification command and expected output documented in §6.2.

**No PR exists for C-1.** This is a documentation gap by design — branch protection rules are repository configuration, not code, and have no diff. v1.3 itself is the documentation of C-1's ship; this section is the ship record.

## §4 Sub-form D — F-Deploy-G1-Y closure

### §4.1 Evidence summary

Between v1.2 close (2026-05-17) and v1.3 author start (2026-05-18), 8 diagnostic data points were collected on F-Deploy-G1-Y behavior. The behavior under investigation: unexplained PRs opening on `claude/**` branches without explicit `gh pr create` invocation, observable in PR #704's contaminated commit lineage (commit `0195a2f4` amending `3634b34d`).

Conditions tested:

| # | Date | VS Code state | Wait window | loki state | Behavior observed |
|---|---|---|---|---|---|
| 1 | 2026-05-17 | closed | 30s | removed | clean |
| 2 | 2026-05-17 | closed | 5min | removed | clean |
| 3 | 2026-05-17 | closed | 15min | removed | clean |
| 4 | 2026-05-18 | open | 30s | removed | clean |
| 5 | 2026-05-18 | open | 2min | removed | clean |
| 6 | 2026-05-18 | open | 5min | removed | clean |
| 7 | 2026-05-18 | open | 10min | removed | clean |
| 8 | 2026-05-18 | open | 15min | removed | clean |

Variable isolation: A/B comparison is between v1.2 evidence (loki present, 1 data point exhibiting F-Deploy-G1-Y behavior on PR #704) and v1.3 evidence (loki removed, 8 data points across VS Code open and closed conditions, all clean). The wait window dimension (30s through 15min) was added to rule out delayed-trigger behavior; behavior remained clean across the full range.

### §4.2 Closure framing — Read B (correlation + sufficiency)

**F-Deploy-G1-Y closes as: identified — removal-sufficient.**

The behavior has not recurred across 8 diagnostic data points after `loki-laufeyson.intelligent-assistant 1.0.9` was removed on 2026-05-17. The closure does **not** claim loki was the unique causal mechanism. The closure claims that loki's absence is sufficient to halt the behavior under all tested conditions.

**What this closure does not establish:**

- Whether loki was the sole tool producing F-Deploy-G1-Y behavior. The remaining six VS Code extensions surfaced during v1.1's Gate A-G1 pre-flight (GitLens, Copilot Chat, dscodegpt, copilot-mcp, and the two underlying systems: Copilot Workspace, Claude Code) have not been individually disabled and re-tested. Another tool with similar permissions (terminal execute, file write, git operation access) could in principle produce identical behavior.
- Whether F-Deploy-G1-Y recurrence is possible if loki is reinstalled or if a similar extension is added. v1.3 does not test re-introduction.
- Whether loki's identity-laundering pattern (four mismatched naming layers, FD-18) is causally connected to the F-Deploy-G1-Y behavior or is coincidental with it.

**What this closure does establish:**

- Under all tested conditions (VS Code closed/open, wait windows 30s–15min), with loki removed, F-Deploy-G1-Y behavior does not occur.
- v10 §4.2 explicitly permitted this outcome shape: "identified — known tool's normal operation" vs "narrowed but still residual." v1.3 invokes the "identified" branch.

The closure is honest about its evidence shape: this is a correlation + sufficiency finding, not a causation finding. Future revisions may revisit if F-Deploy-G1-Y behavior recurs.

### §4.3 What this closes downstream

**Sub-form D closes** at v1.3 ship. Per v1.2 §7.3, sub-form D was tracked separately from sub-forms A and C; v1.3 closes the last open sub-form of Phase A G2.

**Phase A G3 supersedes.** Fix Plan v1.0 §5.3 scoped G3 as the diagnostic phase that would produce the F-Deploy-G1-Y resolution artifact. The diagnostic work documented in §4.1 was performed in-line between v1.2 and v1.3 author start; the artifact is this section plus FD-22. G3 has no remaining executable content. v1.3 marks G3 closed by supersession.

**Phase A G2 closes.** Per Fix Plan v1.0 §5.4, G2 closes when sub-forms A, C, D are all complete. All three close at v1.3 merge.

**Phase A G4 soak unblocks.** Per Fix Plan v1.0 §5.5, the 1-week soak begins after G2 closes. Soak start date = v1.3 merge timestamp + 0; soak end date = v1.3 merge + 7 days. Soak monitoring scope per §5.5 (no autonomous merge events, no `-X ours` events that don't trigger #708 notification, no branch protection bypasses, no F-Deploy-G1-Y recurrence).

## §5 Side discoveries during v1.3 authoring

### §5.1 v1.2 staleness on main

v1.2 on main (PR #706, commit `f43f9c75`) shows A-2, A-3, and C-1 as NOT STARTED in §5.4 and §7.3. As of v1.3 author start, all three have shipped. v1.2 is not factually wrong as a point-in-time document — it was accurate at its merge timestamp — but it is now stale relative to main's actual state.

v1.3 supersedes v1.2 on these three items. v1.2 remains canonical for: A-1b ship record (§3); FD-16 through FD-20 (§6); sub-form D partial findings narrative (§4 of v1.2). v1.2's §7.3 status table is superseded by v1.3 §7.3.

### §5.2 FD-21 — auto-close of #708 via PR #709 commit message

**Discovery timeline.** During C-1 pre-flight verification (`gh issue view 708`), issue #708's state was found to be CLOSED with closedAt `2026-05-18T22:30:53Z` and stateReason COMPLETED. The timestamp is 1 second after PR #709's mergedAt (`22:30:52Z`).

**Forensics.** PR #709's visible PR description does not contain a GitHub closing-keyword phrase referencing #708. PR #709's commit message body contains the sentence: "If reform of the -X ours strategy happens (abort+notify instead of silent merge), close #708 and remove this step." GitHub's closing-keyword parser matched on `close #708` in this conditional clause and auto-closed the issue on merge.

The PR description separately contained a warning sentence: "If the issue is ever accidentally closed, the workflow's `gh issue comment` will likely fail — reopen the issue rather than recreate it." Same authoring session that wrote the warning also wrote the triggering commit message.

**Authorship attribution.** Both the PR description and the commit message body were drafted by Claude in a prior session and accepted by Evoni for the PR #709 ship. This is an AI-authoring discipline finding, not a human-discipline finding. The general class is: AI-drafted text that references issues conditionally, subjunctively, or historically can trigger GitHub state changes the human merger does not anticipate.

**Recovery.** Issue #708 reopened standalone on 2026-05-18 (prior to v1.3 authoring) with a forensics comment naming the closure mechanism, the closing-keyword phrase, and forward-referencing FD-21. The reopen comment contained the literal phrase `close #708` inside backtick fencing as a documentation hazard test. Backtick fencing did NOT re-trigger the parser; state remained OPEN. This is a useful secondary finding: GitHub's closing-keyword parser respects backtick fencing in issue/PR comment markdown but does not respect any grammatical or syntactic context in commit message bodies.

**Mitigation.** AI-drafted commit messages and PR descriptions that reference workflow-target issues or any issue intended to remain open must be grep-checked against the GitHub closing-keyword set (close, closes, closed, closing, fix, fixes, fixed, fixing, resolve, resolves, resolved, resolving) followed by `#N` before commit. Conditional, subjunctive, or historical references are not exempt. Backtick fencing is an acceptable mitigation in issue/PR comment markdown but is not available in commit message bodies (Git does not parse markdown). Recorded as FD-21.

### §5.3 PR #704 disposition

PR #704 has remained open since FD-17 (v1.2 §6) committed to it as the F-Deploy-G1-Y incident record. With F-Deploy-G1-Y closed at v1.3 §4, the incident record's "still under investigation" role is retired.

v1.3 commits to closing PR #704 as the final step of v1.3 ship — after v1.3 merges. Sequencing rationale: PR #704 is the live cross-reference target for FD-17 throughout v1.3's review. Closing it before v1.3 merges breaks references in v1.3's reviewable form. Closing it after v1.3 merges leaves FD-17 pointing to a closed-but-preserved historical artifact, which is the correct end state.

PR #704 closure mechanism: `gh pr close 704 --comment "Closed as part of F-Deploy-1 Fix Plan v1.3 §5.3. F-Deploy-G1-Y closed v1.3 §4 as identified — removal-sufficient. PR #704's role as incident record is retired; the commit lineage (3634b34d → 0195a2f4) is preserved in PR history for forensic reference."` Recorded as FD-25.

## §6 Decisions log — additions FD-21 through FD-25

Decisions made during v1.3 authoring. Fix Plan v1.0 ended at FD-12; v1.1 added FD-13/14/15; v1.2 added FD-16 through FD-20; v1.3 adds FD-21 through FD-25.

- **Decision FD-21: PR #709 commit message body, drafted by Claude in a prior session and accepted by Evoni, contained "close #708" in a conditional clause discussing hypothetical future workflow reform. GitHub's closing-keyword parser is grammar-blind and auto-closed #708 on PR #709 merge despite no closure intent. Discovered 2026-05-18 during C-1 pre-flight verification. Mitigation: AI-drafted commit messages and PR descriptions that reference workflow-target issues must be grep-checked against the GitHub closing-keyword set followed by `#N` before commit. Conditional, subjunctive, or historical references are not exempt — GitHub's parser respects no grammatical context in commit messages. Backtick fencing is an acceptable mitigation in issue/PR comment markdown (verified by reopen-comment test) but is not available in commit message bodies. Recovery: #708 reopened standalone prior to v1.3 authoring. (§5.2.)**

- **Decision FD-22: F-Deploy-G1-Y closes as "identified — removal-sufficient" on N=8 evidence with loki as the isolated variable. v1.2 FD-19 deferred closure on N=1 evidence under VS Code closed + loki removed conditions; v1.3 closes on N=8 evidence spanning VS Code closed AND open conditions, wait windows 30s through 15min, with loki absence as the consistent variable. FD-19 was correct at v1.2's evidence state (single data point, two variables not isolated). FD-22 is correct at v1.3's evidence state (variable isolation across N=8). Both decisions are recorded as correct at their respective evidence states; FD-22 supersedes FD-19. The closure is a correlation + sufficiency finding, not a causation finding: loki's absence is sufficient to halt F-Deploy-G1-Y behavior under all tested conditions, but loki has not been demonstrated to be the unique causal mechanism. v10 §4.2 explicitly permitted this outcome shape ("identified — known tool's normal operation"). (§4.)**

- **Decision FD-23: C-1's required_status_checks implementation maps FD-5's "[Validate]" to the three job-level check names from validate.yml: "Cost Exposure Audit", "Tests", "Route Validation". FD-5 specifies the workflow conceptually; GitHub's branch protection API requires check names as reported to the Checks API, which for GitHub Actions are the job `name:` fields, not workflow names. v1.3 commits to job-level enumeration. Rationale: if validate.yml is later split, refactored, or its job set changed, the required-checks list will need a deliberate update rather than silently losing coverage via workflow-level binding. Cost: any rename of a validate.yml job name requires a corresponding branch protection update; v1.3 accepts this maintenance cost in exchange for explicit coverage. (§3.3.)**

- **Decision FD-24: C-1's required_status_checks ships with strict=true (branch must be up-to-date with main before merge). FD-5 does not specify strict mode. v1.3 commits to strict=true. Rationale: strict=false allows PRs to merge against stale main when checks were last run against an earlier base, which permits a class of integration-skew bugs where PR-A and PR-B each pass independently but break main when both merge. Cost: PRs that fall behind main during review require a rebase or merge-base update before they can land. In a solo-maintainer environment with small PRs, this cost is low. (§3.3.)**

- **Decision FD-25: PR #704 closes as the final step of v1.3 ship, sequenced after v1.3 merge. Per FD-17, PR #704 stays open as F-Deploy-G1-Y incident record; with F-Deploy-G1-Y closed at FD-22, the incident-record role is retired. Closing PR #704 before v1.3 merges would break FD-17's reference target during v1.3 review; closing it after v1.3 merges leaves FD-17 pointing to a closed-but-preserved historical artifact, which is the correct end state. PR #704's commit lineage (3634b34d → 0195a2f4) is preserved in PR history for any future F-Deploy-G1-Y forensic reference. (§5.3.)**

## §7 What v1.3 unblocks / does not unblock

### §7.1 What v1.3 unblocks

**Phase A G4 soak.** Per Fix Plan v1.0 §5.5, the 1-week soak begins after G2 closes. v1.3 closes G2; soak begins at v1.3 merge timestamp. Soak monitoring scope: no autonomous merge events to main outside the validate.yml-gated PR path; no `-X ours` events that fail to notify #708 (now that #708 is reopened); no branch protection bypasses; no F-Deploy-G1-Y recurrence. Soak end criterion: 7 days clean post-v1.3 merge.

**Phase A G3 superseded, not blocked.** No diagnostic phase remains to execute. v1.3 closes G3 by supersession (§4.3).

### §7.2 What v1.3 does NOT unblock

**Phase B G1 architectural decision (separate-EC2 α vs shared-safe β).** Per FD-8, deferred to Phase B G1. Phase B begins after Phase A closes through G4 soak. G4 soak begins at v1.3 merge but has not completed. Cannot start until soak completes.

**F-Stats-1 Phase B G2.** Per Decision #98 (v10 revised, FD-10), blocked on F-Deploy-1 Fix Plan Phase A close. v1.3 closes Phase A G2 but Phase A G4 soak must also complete before Phase A is "closed" in the §5.5 sense. F-Stats-1 Phase B G2 remains blocked through G4 soak.

**F-AUTH-1 fix execution.** Per Decision #98 revised in v10, F-AUTH-1's six-step recipe ships downstream of F-Deploy-1 Phase A close. Same soak gating as F-Stats-1 Phase B G2. F-AUTH-1 execution remains queued through G4 soak.

**Downstream keystone sequence.** F-App-1, F-Ward-1, F-Reg-2, F-Ward-3, F-Franchise-1 (Director Brain), F-Sec-3 — all downstream of F-AUTH-1 ship, transitively downstream of F-Deploy-1 Phase A close. Unchanged from v10 §4.2.

### §7.3 State of play at v1.3 close

| Tier | Item | Status |
|---|---|---|
| Phase A G1 | Pre-flight | CLOSED (v1.1, PR #703) |
| Phase A G2 | Sub-form A — A-1 (opt-out logic) | SHIPPED (v1.2, PR #705) |
| Phase A G2 | Sub-form A — A-2 (backend syntax verification) | SHIPPED (v1.3, PR #707) |
| Phase A G2 | Sub-form A — A-3 (-X ours author notification) | SHIPPED (v1.3, PR #709) |
| Phase A G2 | Sub-form C — C-1 (branch protection) | SHIPPED (v1.3, direct API call) |
| Phase A G2 | Sub-form D — diagnostic artifact | CLOSED (v1.3, FD-22, F-Deploy-G1-Y identified — removal-sufficient) |
| Phase A G2 | Gate close | CLOSED (v1.3 merge) |
| Phase A G3 | Diagnostic phase | SUPERSEDED (v1.3 §4.3; subsumed into sub-form D closure) |
| Phase A G4 | 1-week soak | STARTS at v1.3 merge timestamp |
| Phase B | All gates | NOT STARTED (blocked behind G4 soak completion) |
| Phase C | All gates | NOT STARTED (blocked behind Phase B close) |

**Path A discipline note:** v1.3 ships closure framings that match the evidence shape. F-Deploy-G1-Y closes as correlation + sufficiency, not causation. FD-19 (the v1.2 deferral) is not retracted as wrong — it is recorded as correct at its evidence state, and FD-22 supersedes it on stronger evidence.

## §8 Ship plan

v1.3 ships in this order:

1. **v1.3 PR opened** on branch `claude/f-deploy-1-fix-plan-v1-3`, with `[skip-automerge]` token in commit message.
2. **C-1 ships via direct API call** while v1.3 PR is open and validate.yml is passing. Verification per §3.3. C-1 has no commit; v1.3 itself is C-1's documentation.
3. **v1.3 PR merges.** Phase A G2 closes; Phase A G4 soak starts.
4. **PR #704 closes** per FD-25 with the documented closure comment.

Steps 1, 2, and 3 are sequenced; step 4 happens immediately after step 3.

**Rule 7 gates** apply to steps 2, 3, and 4 individually. v1.3 author session does not auto-execute any of them.

---

*End of F-Deploy-1 Fix Plan v1.3 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Branch: `claude/f-deploy-1-fix-plan-v1-3` (to be created at file-write time).*
*Date: 2026-05-18.*
*Predecessor: v1.2 (PR #706, merged 2026-05-17).*
*Successor: TBD (likely v2.0 scoping Phase B G1 architectural decision after G4 soak completes).*
