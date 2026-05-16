# F-Deploy-1 Fix Plan v1.0

**Deploy pipeline + autonomous-merge keystone fix — phase structure, gate sequence, sub-form ordering, closure criteria**

| | |
|---|---|
| **Audit reference** | `docs/audit/F-Deploy-1_G1_Audit.md` (this branch, content-complete as of 2026-05-16) |
| **v9 reference** | `docs/audit/Prime_Studios_Audit_Handoff_v9.docx` §4.2 (fix sequence), §7.3 Decision #97/#98, §11.5 (G1 findings registry) |
| **Plan author start date** | 2026-05-16 |
| **Plan reference branch** | `claude/f-deploy-1-g1-audit` (co-authoring with G1 audit; single PR to main) |
| **Predecessor keystone** | F-AUTH-1 (per v9 §4.2 fix sequence — F-AUTH-1 ships first; F-Deploy-1 second) |
| **Successor keystone (blocked)** | F-Stats-1 Phase B G2 (per Decision #9 — blocked on F-Deploy-1 G1 close + Fix Plan v1.0 + Phase A complete) |
| **Status** | DRAFT v1.0 |
| **Findings in scope** | F-Deploy-G1-A through F-Deploy-G1-AA (27 findings; 18 P0, 8 P1, 1 P2) |
| **Sub-forms in scope** | A (auto-merge), B (deploy-dev safety), C (branch protection), D (local tooling) |

---

## §1 Purpose and Scope

### §1.1 What this plan does

Authors the F-Deploy-1 keystone fix sequence based on the G1 audit's 27 findings and 4 sub-form classification. Commits to:

- A three-phase structure (Phase A containment + safety; Phase B deploy-dev architectural correction; Phase C soak + verification)
- A gate sequence (estimated 12-14 gates across phases) following the F-AUTH-1 / F-Stats-1 precedent
- Sub-form ordering rationale (A and C in parallel; D-diagnostic alongside; B second; soak last)
- Closure criteria for full keystone close per G1 §5.4
- Per-PR scope sketches for Phase A and architectural decision gating for Phase B

### §1.2 What this plan does not do

The G1 audit §5.5 explicitly defers five items to "the fix plan author." This plan commits to the *first four* and parks the fifth at a named gate:

| §5.5 deferral | Disposition in this plan |
|---|---|
| Sub-form A scope — restore filtered auto-merge-to-main? retire? | Decided at §5.1 of this plan (Phase A G2 work) |
| Sub-form C — branch protection strictness | Decided at §5.2 (Phase A G2 work) |
| Sub-form D — action plan | Decided at §5.3 (Phase A G3 diagnostic) |
| Per-gate verification protocols | Decided per-gate at §8 |
| Sub-form B — separate-EC2 vs shared-safe architectural choice | **Deferred to Phase B G1** (architecture decision gate, post-Phase-A) |

The sub-form B architectural choice is intentionally pushed to a Phase B gate, not Fix Plan v1.0 authoring, because Phase A's stability outcomes (especially sub-form D's diagnostic findings) may reshape the trade-off. Committing to "separate EC2" or "shared-safe" now would lock in a decision before the inputs are complete.

### §1.3 What this plan is not

- **Not an execution log.** Fix Plan v1.0 is the planning document. Phase A execution will produce commits, PR numbers, verification outputs; those land in revisions (v1.1, v1.2 ...) following F-Stats-1 precedent.
- **Not a substitute for the G1 audit.** Every claim about failure modes, sub-forms, or finding mechanics references the audit by §-number, not by paraphrase.
- **Not committed to immutability.** Per G1 §5.5: "the fix plan author should treat §5 as a starting frame, not as constraints. If the architectural picture clarifies during fix planning and a different phase structure fits better, deviate. Document the deviation in Fix Plan v1.0's Decisions section." Same rule applies recursively — if Phase A reshapes Phase B's scope, document the deviation at §11.

### §1.4 Why F-Deploy-1 is upstream of structural fixes

Per v9 §7.3 Decision #97: F-Deploy-1 is the 8th keystone because every other structural fix ships through the deploy pipeline. Per Decision #98: F-Deploy-1 G1 close must precede F-Stats-1 Phase B G2 because shipping nine sequential structural changes (Phase B migrates 9+ raw-SQL writers to the CharacterState model) through a pipeline that today silently treats `MIGRATION_FAILED=true` as non-fatal, restarts PM2 on broken schema, and passes `/health` while routes return 500, is a guaranteed multi-incident sequence.

The fix sequence in v9 §4.2 places F-Deploy-1 second (after F-AUTH-1). Both must ship before F-Stats-1 Phase B can begin. After F-Deploy-1, the queue opens: F-App-1, F-Stats-1 Phase B, F-Ward-1, F-Reg-2, F-Ward-3, F-Franchise-1 (Director Brain build), F-Sec-3.

---

## §2 Reference Documents

| Document | Section reference | Role in this plan |
|---|---|---|
| `docs/audit/F-Deploy-1_G1_Audit.md` (this branch) | §2 (failure events), §3 (file analyses), §4 (sub-form classification), §5 (recommended structure), §6 (closure criteria) | Primary source — all findings, all mechanisms |
| `docs/audit/Prime_Studios_Audit_Handoff_v9.docx` (main) | §4.2 (fix sequence), §7.3 Decisions #97/#98, §11.5 (G1 findings registry) | Sequencing authority — locks F-Deploy-1 as 8th keystone, locks ordering with F-Stats-1 Phase B |
| `docs/audit/Prime_Studios_Audit_Handoff_v8.docx` (main) | §4.1 (F-AUTH-1), §4.2 (Tier 1 keystones) | Predecessor keystone reference — F-AUTH-1 fix sequence and pre-flight pattern |
| `docs/audit/F-Stats-1_Fix_Plan_v1.2.md` (main) | §9 (Decisions #8, #9), §12 (incident reconstruction) | Sequencing — F-Stats-1 Phase B blocked on this plan's Phase A close; Decision #9 is the lock |
| `docs/audit/F-Stats-1_PhaseB_G1_Planning.md` (main) | Whole doc | Downstream blocker — Phase B G1 planning awaits F-Deploy-1 readiness |
| `docs/audit/F-AUTH-1_Fix_Plan_v2_37.docx` (main) | §5.1 (pre-flight), §6 (gate sequence), §7 (verification), §8 (rollback), §9 (decisions) | Structural reference — the Prime Studios fix-plan pattern |
| `docs/audit/Session_PE_Roster.md` (main) | PE #41, PE #48 (resolved); PE #43-47 (F-Ward-1 territory) | Cross-keystone PE tracking |

**Code surfaces referenced (per G1 audit §3):**

| Surface | G1 §3 section | Findings |
|---|---|---|
| `.github/workflows/auto-merge.yml` (DELETED 2026-05-15) | §3.2 | K, L, M, N, O |
| `.github/workflows/auto-merge-to-dev.yml` | §3.1 | P, Q, R |
| `.github/workflows/deploy-dev.yml` | §3.3 | A, B, C, D, E, F, G |
| `.github/workflows/deploy-production.yml` | §3.4 | S, T (deferred), U |
| `.github/scripts/deploy-production.sh` | §3.4 (deferred read; G1 §6 confirms deferral to this plan) | T (resolver) |
| `ecosystem.config.js` | §3.5 | H, I, J |
| GitHub branch protection on main | §3.6 | V, W, X |
| Evoni's local working environment | §3.7 | Y, Z, AA |

---

## §3 Sub-form Summary

Per G1 §4. The four sub-forms cluster the 27 findings into fixable units. Sub-forms A and C share two findings (V, W) — the same architectural defect viewed from two angles.

### §3.1 Sub-form A — Auto-merge mechanism

`auto-merge.yml` (now deleted) ran `gh pr merge --squash --auto` unconditionally on every PR. With main's branch protection configured as a no-op (zero required checks), `--auto` merged immediately. `auto-merge-to-dev.yml` does the same for dev with a hardcoded exclusion list.

**Findings:** K, L, M, N, O (auto-merge.yml), P, Q, R (auto-merge-to-dev.yml). Shared with sub-form C: V, W.

**Events caused:** §2.3 PR #685, §2.4 PRs #688/#689. Three PRs that would not have auto-merged with any meaningful filter.

**Containment shipped 2026-05-15:** `auto-merge.yml` deleted on main as commit `1b3a02b3`. Mechanism is broken for main. `auto-merge-to-dev.yml` still active for `claude/**` branches.

### §3.2 Sub-form B — Deploy-dev workflow safety

`deploy-dev.yml` runs PM2 lifecycle commands (`pm2 stop all`, `pm2 start`, `fuser -k 3002/tcp`) against the shared dev/prod EC2 instance with no isolation. Migration failures are non-fatal. Health check is route-blind. The `ecosystem.config.js` default `env` block points at dev port 3002, so PM2 restarts without `--env production` flag land the prod-serving process on the wrong port.

**Findings:** A, B, C, D, E, F, G (deploy-dev.yml), H, I, J (ecosystem.config.js), S, T, U (deploy-production.yml).

**Events caused:** §2.1 F-App-1 morning outage (50 min), §2.2 F-Stats-1 G2 evening outage (10 min), §2.6 May 15 dev deploy lunch failure. Three incidents — same architectural defect, different surface failures.

**Containment shipped:** PR #694 / commit `139bbd7a` — point fixes for PE #41 (IPv6 keygen) and PE #48 (migration version-column drift via defensive `describeTable + addColumn-if-missing`). Architectural correction remains open.

### §3.3 Sub-form C — Branch protection on main + admin-bypass policy

Branch protection on main is enabled but every gating setting is opted out — zero required approvals, zero required checks, admin enforcement disabled, signed-commits not required, conversation resolution not required, linear history not enforced. Only force-push protection and deletion protection enforce.

**Findings:** V, W, X. Shared with sub-form A: V, W.

**Events caused:** §2.3, §2.4 — all merged within seconds because zero required checks meant `--auto` had no conditions to wait on.

**Containment shipped:** None. Branch protection remains in current state. Sub-form A's `auto-merge.yml` deletion makes the gap less acute but doesn't close it.

### §3.4 Sub-form D — Local-tooling identity + autonomous PR-opening

Two surfaces from the local working environment. (1) PR-opening: PRs #685, #688, #689, #692 opened from `claude/**` branches against main without `gh pr create` being run by the user. Actor authenticates as `angelcreator113`, `is_bot: false`. Mechanism unidentified. (2) Commit identity drift: TySteamTest attribution despite `git config --global user.email` correction. Resolved via per-commit `--author` flag; mechanism unidentified.

**Findings:** Y, Z, AA.

**Events caused:** §2.5 TySteamTest drift; PR-opening side contributed to §2.3 and §2.4.

**Containment shipped:** F-Deploy-G1-Z (identity drift) operationally contained via per-commit `--author` flag. F-Deploy-G1-Y (PR-opening) indirectly contained via sub-form A's `auto-merge.yml` deletion — autonomous PRs can still open but no longer auto-merge to main; they still auto-merge to dev.

### §3.5 Sub-form crossover

| Crossover | Detail |
|---|---|
| A ↔ C | F-Deploy-G1-V (branch protection no-op) and F-Deploy-G1-W (zero required checks) — same finding viewed from two angles. Fix lands once, scoped within sub-form C (it's a settings change, not a workflow change), satisfies both. |
| A ← D | The PR-opening mechanism (sub-form D's Y finding) supplies the PRs that sub-form A's auto-merge mechanism then merges. Sub-form A's containment is effective against PRs from any source; sub-form D's containment is independent. |
| B ↔ D | The TySteamTest identity drift surface (F-Deploy-G1-Z) and the autonomous PR-opening surface (F-Deploy-G1-Y) are likely the same wrapper layer. Diagnostic work for D may incidentally surface env-var or hook configuration relevant to B's "shared EC2 environment" picture. |

---

## §4 Pre-flight Inventory (Gate A-G1)

Per F-AUTH-1 §5.1 precedent. The pre-flight produces verifiable evidence that the state assumed by the plan matches the state in the repo and the live environment **at the moment Phase A begins**. Three of the seven §3 surfaces in G1 have state that can drift between Fix Plan authoring (now) and Phase A execution. Pre-flight captures that state and surfaces any drift before Phase A G2 commits run.

### §4.1 G1 audit PR state

**What to verify:**
- `claude/f-deploy-1-g1-audit` is pushed to origin with all local commits.
- Single PR open against `main` containing both G1 audit content AND this Fix Plan v1.0.
- PR description references G1 audit closure (§6) + this plan as the Phase A entry point.

**Verification command (PowerShell):**

```powershell
git log origin/claude/f-deploy-1-g1-audit --oneline | Select-Object -First 20
gh pr list --head claude/f-deploy-1-g1-audit --json number,title,state,baseRefName
```

**Expected state:**
- Audit branch HEAD includes commits for §2.1-§2.6, §3.1-§3.7, §4, §5, §6, §7 (G1 doc) + this Fix Plan v1.0.
- One PR open, draft or ready, `baseRefName: main`.
- No other PRs from this branch (would indicate autonomous PR-opening recurrence — see §4.4).

**Drift handling:**
- If autonomous PR recurrence is detected (multiple PRs from the same branch): pause Phase A, escalate to sub-form D diagnostic immediately, do not proceed until the duplicate PRs are resolved.

### §4.2 Branch protection current state

**What to verify:**
- The protection settings documented in G1 §3.6.1 are still current.
- No unexpected tightening or loosening since G1 authoring (2026-05-15 / 2026-05-16).
- The presence/absence of `required_status_checks` matches G1's "notably absent" finding.

**Verification command (PowerShell):**

```powershell
gh api repos/angelcreator113/Episode-Canonical-Control-Record/branches/main/protection | ConvertFrom-Json | ConvertTo-Json -Depth 10
```

**Expected state:**
- `required_pull_request_reviews.required_approving_review_count: 0`
- `required_status_checks` absent or null
- `enforce_admins.enabled: false`
- `required_signatures.enabled: false`
- `allow_force_pushes.enabled: false`
- `allow_deletions.enabled: false`

**Drift handling:**
- If any setting has changed: investigate when and by whom (commit/audit log on the GitHub-side settings change is API-accessible). Reconcile with §5.2's planned change.

### §4.3 Auto-merge-to-dev.yml live state

**What to verify:**
- The current `branches:` exclusion list in `auto-merge-to-dev.yml` matches the audit's documentation of the bang-syntax form (G1 §3.1.1, iteration 2 / commit `e0c0a0cc`).
- No additional bang-prefix exclusions have been added since (would indicate new F-Stats-1-class incident requiring workaround).
- The `-X ours` strategy at the conflict-resolution step is unchanged (G1 §3.1.4).
- The `concurrency:` block is present (G1 §3.1.2).

**Verification command (PowerShell):**

```powershell
Get-Content .github/workflows/auto-merge-to-dev.yml
```

**Expected state (key sections):**

```yaml
on:
  push:
    branches:
      - 'claude/**'
      - '!claude/start-f-stats-1-g2'
      - '!claude/f-stats-1-phase-b-**'

concurrency:
  group: auto-merge-dev
  cancel-in-progress: false
```

**Drift handling:**
- New bang-prefix exclusions: each one indicates a new F-Stats-1-class incident class. Add the incident to sub-form D's diagnostic scope (it's evidence of how the exclusion-list-as-policy pattern is failing). Phase A §5.1 should still address F-Deploy-G1-P (the hardcoded-exclusion pattern itself).
- Conflict-resolution strategy changed: investigate why before proceeding. The `-X ours` design (G1 §3.1.4 inline rationale) is intentional; a change would represent a different working principle.

### §4.4 Local environment snapshot (sub-form D pre-baseline)

**What to verify:**
- Current state of suspected autonomous-PR-opening mechanisms before Phase A's diagnostic work (§5.3) begins.
- Baseline so post-diagnostic changes are measurable.

**Verification steps (Evoni's local machine, PowerShell):**

```powershell
# Git config sources
git config --list --show-origin | Select-String "user"

# Environment variables that could override commit identity
$env:GIT_AUTHOR_NAME
$env:GIT_AUTHOR_EMAIL
$env:GIT_COMMITTER_NAME
$env:GIT_COMMITTER_EMAIL

# Local git hooks
Get-ChildItem .git/hooks/ -Exclude *.sample

# VS Code GitHub Pull Requests extension state
# Inspect VS Code Settings → search for "githubPullRequests"
# Note specifically: githubPullRequests.createOnPublishBranch
code --list-extensions | Select-String -Pattern "github|copilot"

# Recent commits and their attribution
git log --format="%h %an <%ae>" -20
```

**Expected state:**
- `git config user.email` should resolve to `evonifoster@yahoo.com`.
- `GIT_AUTHOR_*` and `GIT_COMMITTER_*` env vars should be unset.
- `.git/hooks/` should contain only `.sample` files (or hooks Evoni explicitly recognizes).
- VS Code extensions list will show installed extensions; record the list for §5.3 diagnostic reference.
- Last 20 commits should all show `Evoni <evonifoster@yahoo.com>` (post-§2.5 correction).

**Drift handling:**
- Any env var set: capture value, document in §11 Decisions, do not modify yet — diagnostic phase needs the artifact intact.
- Hooks present beyond samples: capture content, do not modify yet.
- Attribution drift detected in recent commits: re-engage §2.5 recovery procedure (per-commit `--author` flag) before Phase A begins.

### §4.5 F-Deploy-G1-T resolver — read `.github/scripts/deploy-production.sh`

Per G1 §3.4.5 and §6: F-Deploy-G1-T verification was deferred. The deploy-production.yml workflow's PM2 start logic lives in the external script, which the audit did not read. F-Deploy-G1-H's prod-side mechanism (whether `--env production` is correctly passed in production) cannot be confirmed or refuted without that read.

**This step is pre-flight, not Phase B work.** Reading the script is diagnostic only; no edits in pre-flight. The diagnostic outcome shapes Phase B's scope and §6.7 work.

**Verification steps:**

```powershell
# Read the production deploy script
Get-Content .github/scripts/deploy-production.sh

# Search specifically for PM2 start invocations
Select-String -Path .github/scripts/deploy-production.sh -Pattern "pm2 start|--env"
```

**Disposition by finding:**

| Script behavior found | F-Deploy-G1-T resolution | Phase B §6.7 impact |
|---|---|---|
| Script passes `--env production` to `pm2 start` | T resolved as "prod-side mechanism is safe; F-Deploy-G1-H is dev-side only" | §6.7 narrows: only the ecosystem.config.js default-port question needs treatment |
| Script omits `--env production` or passes wrong env | T resolved as "prod-side mechanism also vulnerable; F-Deploy-G1-H is bilateral" | §6.7 expands: deploy-production.sh edit required as part of Phase B |
| Script behavior is conditional or unclear | T resolved as "requires careful Phase B G1 architectural decision before fix" | §6.1 architectural decision must address; possibly blocks until decision lands |

**Drift handling:**
- Document the read outcome in §11 Decisions before Phase A begins. The Phase B scope assumed below (§6) depends on this resolution.

### §4.6 G1 file:line reference drift check

Per F-AUTH-1 §11 Appendix A pattern: codebase shifts between audit close and fix execution. Pre-flight spot-checks a sample of G1 file:line references against the current branch state.

**Verification steps:**

```powershell
# auto-merge-to-dev.yml — verify trigger block at expected line range
Select-String -Path .github/workflows/auto-merge-to-dev.yml -Pattern "^on:|branches:|claude/" | Select-Object Line,LineNumber

# deploy-dev.yml — verify migration handling block (G1 §3.3.3 around line ~290-292)
Select-String -Path .github/workflows/deploy-dev.yml -Pattern "MIGRATION_FAILED|sequelize-cli db:migrate" | Select-Object Line,LineNumber

# ecosystem.config.js — verify default env block configures dev port (G1 §3.5.1)
Select-String -Path ecosystem.config.js -Pattern "PORT:|env_production|APP_NAME" | Select-Object Line,LineNumber
```

**Expected:** content matches G1 audit narratives within ±5 lines. Line numbers may drift; content patterns hold.

**Drift handling:**
- If content has shifted substantially (file restructured, blocks moved): re-locate the surface before Phase A commit runs against it. Update §11 Decisions with the new file:line for the affected finding.
- If content is gone (block removed, finding inadvertently fixed): mark the finding "RESOLVED via incidental change" in §11, do not re-introduce.

### §4.7 Pre-flight closure

Gate A-G1 closes when §4.1 through §4.6 each produce a documented evidence artifact (in §11 Decisions, in commit messages, or in this plan's revision history) and no drift handling is left open.

If any §4.x step surfaces drift requiring rescoping, address in this plan (revising v1.0 → v1.1 with deviation notes per §1.3) before Phase A G2 begins. Drift handling is not a Phase A activity; it is a planning-revision activity.

---

## §5 Phase A — Containment + Safety

**Scope:** Sub-forms A (auto-merge), C (branch protection), D-diagnostic. Sub-form B is explicitly NOT in Phase A.

**Phase A objective:** Eliminate the autonomous-merge-to-main mechanism in a form that survives recurrence. Tighten branch protection to provide a real gate. Identify the autonomous-PR-opening mechanism (sub-form D diagnostic). Low-risk, low-LOC changes. Most of the architectural work is workflow YAML and GitHub settings; no application code touched.

**Estimated gates:** G1 (pre-flight, §4 above), G2 (sub-form A + C implementation), G3 (sub-form D diagnostic phase), G4 (Phase A soak — 1 week, no recurrence in F-Deploy-G1 finding classes).

### §5.1 Sub-form A — `auto-merge-to-dev.yml` refactor + `auto-merge.yml` policy lock

#### §5.1.1 Decisions committed at planning

**Decision A-1: `auto-merge.yml` (main path) stays deleted.**

Rationale: the workflow ran `gh pr merge --squash --auto` unconditionally on every PR (G1 F-Deploy-G1-K). Restoring it with filters introduces complexity for marginal value — main is a single-developer integration branch where every PR has a real human author who can click merge. The two surfaces this workflow served (draft-to-ready convenience, queued auto-merge after CI) are not worth the architectural risk of "fire on every PR" being re-introduced.

Trade-off accepted: manual click required on every PR to main. For a solo-dev repo this is the right cost.

**Decision A-2: `auto-merge-to-dev.yml` (dev path) stays active, with three changes.**

Rationale: the dev integration path is high-volume by design — feature branches merge to dev for integration testing. Manual merge of every `claude/**` branch is friction without safety benefit (dev is already disposable). The workflow is also intentionally cascading: its push to dev triggers `deploy-dev.yml` (via the GitHub App token, G1 §3.1.3), which is the design intent.

The three changes:

- **Change A-2.1: Replace the hardcoded `branches:` exclusion list with an opt-out label.** The current bang-syntax form (G1 §3.1.1) requires manual edit on each new F-Stats-1-class incident. Replace with a workflow-level check on PR labels (or a branch label, since this is a push trigger not a PR trigger — the mechanism is to be designed in Phase A G2; possible approaches: a `[skip-automerge]` token in the latest commit message, a branch-naming convention `claude/no-automerge-**`, or a sentinel file in the branch). Closes F-Deploy-G1-P.
- **Change A-2.2: Add backend build verification alongside the frontend build gate (G1 §3.1.5).** Current build verification runs only when frontend changed; backend merges go to dev without `node` compile/lint check. Add a node-side syntax-check or lint pass before the push-to-dev step. Closes F-Deploy-G1-R.
- **Change A-2.3: Document the `-X ours` strategy and add an author notification.** Current behavior silently drops branch changes on conflict (G1 §3.1.4 / F-Deploy-G1-Q). The design is intentional ("dev wins"), but the silence is the bug. Add a workflow step that posts a comment on the originating branch's most-recent PR (or opens an issue if no PR exists) when `merge_type=conflicts-resolved`. Author gets a notification; design intent preserved. Partial-close on F-Deploy-G1-Q.

#### §5.1.2 PR scope sketch

| PR | Sub-form A change | Files touched | Estimated LOC | Bisectability |
|---|---|---|---|---|
| PR A-1 | A-2.1 — opt-out label/sentinel for auto-merge-to-dev | `.github/workflows/auto-merge-to-dev.yml` | ~20-40 added, ~5-10 removed | One PR — the trigger logic + the opt-out check land together |
| PR A-2 | A-2.2 — backend build verification | `.github/workflows/auto-merge-to-dev.yml` | ~15-25 added | Independent of A-1; can ship before or after |
| PR A-3 | A-2.3 — `-X ours` author notification | `.github/workflows/auto-merge-to-dev.yml` | ~20-30 added | Independent; can ship last (requires deciding comment-vs-issue mechanism) |

**PR sequencing:** A-1 first (it's the biggest scope and most independent), then A-2, then A-3. Each PR small enough to review in one sitting. Each PR runs through the auto-merge-to-dev path it modifies — recursive deploy of the deploy mechanism. **Caveat at G2:** if PR A-1 changes the trigger logic of `auto-merge-to-dev.yml`, that PR itself may or may not fit the new opt-out rules. Plan accordingly during G2 (probably ship A-1 via manual merge to dev, document in §11 Decisions).

#### §5.1.3 Closure criteria for sub-form A

- `auto-merge.yml` confirmed absent on main (already true; verify at gate close).
- `auto-merge-to-dev.yml` no longer requires per-incident edits to its exclusion list.
- Backend build verification fires on backend changes.
- Conflict-resolution events produce visible author notifications.
- No F-Deploy-G1-K/L/M/N/O recurrence patterns observed during Phase A G4 soak.

### §5.2 Sub-form C — Branch protection settings change

#### §5.2.1 Decisions committed at planning

**Decision C-1: Tighten branch protection on main with minimal gating.**

The current state (G1 §3.6.1) is "branch protection enabled but every gate opted out." That's worse than honest "no branch protection" because it produces the illusion of a gate. Three options were proposed in G1 §3.6.3:

| Option | Gate | Trade-off |
|---|---|---|
| A — tight | Required reviews + required checks + admin enforcement | Forces every change through review including admin's own; defeats solo-dev working pattern |
| B — workflow-only containment | Rely on `auto-merge.yml` deletion (sub-form A) as the practical containment | Tightening is cosmetic if no enforcement path exists |
| C — minimal real gate | Required CI checks, but admin enforcement off, zero required reviews | Real gate against unverified merges; admin-as-owner can still unblock |

This plan commits to **Option C — minimal real gate**:

- `required_status_checks` enabled, requiring `Validate` workflow (matches the existing CI job, runs tests + lint + route validation + cost audit).
- `required_approving_review_count` stays at `0` (solo-dev pattern preserved).
- `enforce_admins` stays at `false` (admin bypass available for emergencies).
- All other settings unchanged.

Rationale: a required CI check is the gate the §2.4 cascade lacked. With `Validate` required, even an autonomous PR opened against main cannot auto-merge before `Validate` passes — and `Validate` includes the test suite, which would surface most code-quality issues. Admin bypass remains so Evoni can ship emergency fixes without ceremony. The mechanism is "required for autonomous merges, bypassable for human emergency."

**Decision C-2: Document the admin-bypass-as-escape-hatch policy.**

Per G1 §3.6.2 (F-Deploy-G1-X) and G1 §3.6.3: `enforce_admins: false` is the pragmatic default for a single-developer repo. The policy needs explicit documentation so future contributors (or future-Evoni reading old commits) understand: admin bypass is intentional, used sparingly, logged in Decisions when invoked.

Documentation lives in `docs/audit/policies/branch-protection.md` (new file, Phase A scope).

#### §5.2.2 PR scope sketch

| PR | Sub-form C change | Files touched | Estimated LOC | Bisectability |
|---|---|---|---|---|
| PR C-1 | C-1 — branch protection settings change | GitHub repo settings (no file commit) + `docs/audit/policies/branch-protection.md` (new) | ~30-50 doc lines | Settings change happens via `gh api`; documentation lands as commit |

**Note:** the actual branch protection change is a GitHub API call, not a code commit. Per Rule 7, the API call is a draft → confirm → execute moment. The plan commits to the API call as part of PR C-1's verification step; the call itself runs at PR C-1 merge time.

#### §5.2.3 Closure criteria for sub-form C

- `gh api repos/.../branches/main/protection` returns `required_status_checks.contexts` including `Validate`.
- `enforce_admins.enabled: false` confirmed (intentional preservation).
- `docs/audit/policies/branch-protection.md` committed on main.
- One test PR to main confirms the gate fires (autonomous merge waits for Validate to pass, then proceeds; or fails if Validate fails).

### §5.3 Sub-form D — Diagnostic phase (no containment yet)

#### §5.3.1 What this phase is and isn't

**Is:** A patient investigation of Evoni's local working environment to identify the wrapper layer responsible for (a) autonomous PR-opening (F-Deploy-G1-Y) and (b) commit identity drift (F-Deploy-G1-Z). The two surfaces are likely the same mechanism (per G1 §3.7 and §4 sub-form D cross-finding analysis).

**Isn't:** A containment phase. Per G1 §5.3 recommendation, sub-form D goes last in Phase A. No environment changes are made until the mechanism is identified — modifying the environment before diagnosis erases the evidence.

The diagnostic phase's output is a documented identification of the mechanism, OR a documented "investigated and unable to identify" with documented accepted residual risk.

#### §5.3.2 Diagnostic steps

Per G1 §3.7.5 recommendations:

**Step D-1: VS Code GitHub Pull Requests extension settings.**

```powershell
# Open VS Code, then:
# Settings → search "githubPullRequests"
# Document every non-default setting
# Specifically note: githubPullRequests.createOnPublishBranch
```

If `createOnPublishBranch` is enabled (default may vary by VS Code version): this is the leading candidate per G1 §3.7.3 candidate 1. Disable it; document the change in §11 Decisions; verify by pushing a fresh `claude/test-no-autopr` branch and confirming no PR opens.

**Step D-2: Copilot Workspace agent state.**

```powershell
# In VS Code, check if Copilot Workspace is enabled
# Check Settings → search "copilot"
# Document agent-mode configuration if present
```

If Copilot Workspace has push-event handlers configured: this is candidate 2. Disable or constrain per Copilot's available controls.

**Step D-3: Local git hooks audit.**

```powershell
Get-ChildItem .git/hooks/ -Exclude *.sample | ForEach-Object {
    Write-Host "=== $($_.Name) ==="
    Get-Content $_.FullName
}
```

If non-sample hooks are present: read each. Anything that invokes `gh pr create`, posts to the GitHub API, or rewrites commit author metadata is in candidate-4 territory (G1 §3.7.3 candidate 4).

**Step D-4: Environment variable audit.**

```powershell
# Current shell session
Get-ChildItem env: | Where-Object { $_.Name -match "GIT_|GITHUB_" }

# PowerShell profile (could be setting them on session start)
Get-Content $PROFILE -ErrorAction SilentlyContinue
Get-Content $PROFILE.AllUsersAllHosts -ErrorAction SilentlyContinue

# System environment variables (Windows registry)
[Environment]::GetEnvironmentVariables('User') | Format-Table
[Environment]::GetEnvironmentVariables('Machine') | Where-Object { $_.Name -match "GIT|GITHUB" }
```

Any `GIT_AUTHOR_*`, `GIT_COMMITTER_*`, or `GITHUB_TOKEN`-overriding variable: capture value, do not modify yet. Document in §11 Decisions.

**Step D-5: GH CLI auth state.**

```powershell
gh auth status
gh auth token | Out-String   # verify which token is currently active
```

If `gh` is authenticated with a token Evoni doesn't recognize, that's a finding. Document.

**Step D-6: Cross-correlation.**

Run all five preceding steps and produce a single artifact (a markdown document committed alongside the Phase A G3 close commit). The artifact answers: "What is the mechanism responsible for the F-Deploy-G1-Y events on May 14-15? Is it the same mechanism as F-Deploy-G1-Z?"

Three possible outcomes:

| Outcome | Phase A response | Phase A G4 soak interpretation |
|---|---|---|
| Mechanism identified, single source | Disable/constrain per D-1 through D-5 findings | Soak verifies no Y or Z recurrence |
| Mechanism identified, multi-source | Disable/constrain each; document complexity in §11 | Soak verifies; expect partial Y recurrence if any source missed |
| Mechanism not identifiable from available diagnostics | Document accepted residual risk; rely on sub-form A containment | Soak runs anyway; G4 soak window may need to extend |

#### §5.3.3 PR scope sketch

| PR | Sub-form D change | Files touched | Estimated LOC | Bisectability |
|---|---|---|---|---|
| PR D-1 | Diagnostic artifact + any local-config changes | `docs/audit/F-Deploy-1_Subform_D_Diagnostic.md` (new) | ~200-400 doc lines, depending on findings | Single PR — the diagnostic IS the deliverable |

No `auto-merge-to-dev.yml` change required for PR D-1 (it's a docs-only commit + local-environment changes that don't surface in the repo). However, the act of pushing PR D-1 itself becomes the test of sub-form A's recent changes (PR A-1 through A-3) — if the autonomous-PR mechanism is still active, PR D-1's push will trigger it. **That's a deliberate test, not a bug.** Whatever happens at PR D-1 push goes in §11 Decisions.

#### §5.3.4 Closure criteria for sub-form D (Phase A scope)

- Diagnostic artifact committed on main.
- F-Deploy-G1-Y mechanism identified OR documented as "investigated and unidentifiable, accepted residual risk."
- F-Deploy-G1-Z mechanism identified (very likely same as Y, but possibly distinct).
- Local environment changes (if any) documented with before/after state.
- Phase A G4 soak window can begin.

### §5.4 Phase A commit/PR sequence (bisectability)

```
Pre-flight (§4 complete, evidence artifacts in §11)
 │
 ├── PR A-1 — auto-merge-to-dev opt-out label/sentinel (§5.1)
 │   merges to main
 │
 ├── PR A-2 — backend build verification (§5.1)
 │   merges to main
 │
 ├── PR A-3 — -X ours author notification (§5.1)
 │   merges to main
 │
 ├── PR C-1 — branch protection + policy doc (§5.2)
 │   merges to main, settings API call runs at merge
 │
 ├── PR D-1 — sub-form D diagnostic artifact (§5.3)
 │   merges to main (test of sub-form A simultaneously)
 │
 └── Phase A G4 — 1-week soak begins
```

Sub-form A PRs (A-1, A-2, A-3) can ship in parallel after PR A-1 (which contains the trigger-logic change) lands. A-2 and A-3 are independent of each other. PR C-1 can ship in parallel with any A-x PR. PR D-1 ships last in Phase A — its push is also a containment test.

### §5.5 Phase A G4 soak

**Duration:** 1 week minimum (7 days).

**Criteria:**
- Zero recurrence of F-Deploy-G1-K, L, M, N, O events (no autonomous merges to main, regardless of PR opens).
- Zero recurrence of F-Deploy-G1-P (no need to add a new bang-prefix exclusion).
- Zero recurrence of F-Deploy-G1-Y if sub-form D containment is in place — OR documented Y events with documented expected behavior if sub-form D outcome is "accepted residual risk."
- Zero recurrence of F-Deploy-G1-Z (commit identity drift).
- At least one non-trivial PR ships through the hardened auto-merge-to-dev path (sub-form A regression test). Sub-form B's pre-flight reading of `.github/scripts/deploy-production.sh` (§4.5) is a candidate for this — it's a low-stakes commit that exercises the path.

**If criteria are met:** Phase A closes. Phase B G1 (architectural decision gate, §6.1) can begin.

**If criteria are not met:** Identify the recurrence pattern, revise Fix Plan v1.0 → v1.1 with new disposition for the failing sub-form, re-soak before Phase B.

---

## §6 Phase B — Deploy-dev Architectural Correction

**Scope:** Sub-form B (all 13 findings: A-G in deploy-dev.yml, H-J in ecosystem.config.js, S-U in deploy-production.yml).

**Phase B objective:** Resolve the deploy-dev workflow's three architectural defects: (1) shared dev/prod EC2 instance with no isolation, (2) non-fatal migration handling, (3) health check that doesn't imply route correctness. After Phase B, a failed dev deploy cannot disrupt prod under any documented failure mode; migration failures abort the deploy; route-level verification gates deploy success.

**Estimated gates:** G1 (architecture decision), G2-G5 (implementation PRs, one per sub-cluster), G6 (Phase B soak — 2 weeks, F-Stats-1 Phase B G2 pilot as canonical test).

### §6.1 Phase B G1 — Architectural decision gate

**The decision (deferred from Fix Plan v1.0 authoring per §1.2):** separate-EC2 vs shared-safe.

#### §6.1.1 Option B-α: Separate dev EC2 from prod EC2

**What it means:** Provision a second EC2 instance for dev workloads. `deploy-dev.yml` targets the dev EC2; `deploy-production.yml` targets the prod EC2. Each instance runs its own PM2 process group with no cross-traffic.

**Pros:**
- Eliminates F-Deploy-G1-G entirely (shared-instance assumption is gone).
- F-Deploy-G1-H's "prod ends up on dev port" failure mode is impossible (different instance, different process group).
- F-Deploy-G1-J's log conflation resolves (separate filesystems).
- Architecturally honest: "dev and prod are separate environments" matches the workflow's existing assumption.

**Cons:**
- ~$15-30/month additional AWS cost (one more `t3.small` or `t3.medium`).
- Provisioning effort: new EC2, new security group, new DNS (`dev.primepisodes.com` exists per G1 §3.3.3 `Deploy to Development` URL but currently points at the shared instance), updated CI secrets (`EC2_HOST` becomes per-environment), updated nginx config.
- Operational ongoing cost: two instances to maintain (security patches, OS updates, disk usage monitoring).
- Backup/snapshot strategy needs duplication.

**Findings closed:** A, B, D, E, F, G, H, I, J (most of sub-form B's findings dissolve if the shared-instance assumption is removed).

#### §6.1.2 Option B-β: Make shared EC2 safe

**What it means:** Keep the single EC2 instance. Modify `deploy-dev.yml` and the PM2 configuration so a dev deploy cannot stop, port-collide with, or otherwise disrupt the prod processes. Mechanisms: per-app PM2 namespacing (dev processes use `episode-api-dev` names; G1 F-Deploy-G1-I already names them in ecosystem.config.js but no workflow uses them); strict `--only episode-api-dev,episode-worker-dev` flags on PM2 commands; remove `pm2 stop all` from any dev path; route-level health verification on the deployed process specifically (not the shared instance).

**Pros:**
- No AWS cost increase.
- No new infrastructure to maintain.
- Forces the workflow to be explicit about which app it's managing — improves clarity even ignoring the architectural concern.
- Activates the dead `episode-api-dev` / `episode-worker-dev` config (G1 F-Deploy-G1-I) as live.

**Cons:**
- Single instance is a single failure domain — if the EC2 itself goes down, both dev and prod go.
- Resource contention on `t3.small` (per onboarding doc tech-stack table) is real if dev runs heavy operations during prod traffic.
- Discipline-dependent: a future workflow edit that re-introduces `pm2 stop all` re-introduces the §2.1 outage class. The architectural defense is procedural, not structural.
- F-Deploy-G1-G doesn't fully close; it transforms into "shared-instance but explicitly safe per workflow conventions." Audit traceability becomes "this finding closes contingent on workflow discipline."

**Findings closed:** A, B, D, E, F (with route-level verification), I (`*-dev` apps wired up), J (separate log paths used). Findings G, H remain partially open (architecturally; closed only by procedural discipline).

#### §6.1.3 Decision input — sub-form D diagnostic outcome

Sub-form D's diagnostic (Phase A §5.3) may surface evidence that affects this decision. If the diagnostic finds Copilot Workspace agent or a similar autonomous tool with access to the local dev environment AND a path to push directly to `origin/dev`, option B-α (separate EC2) gains weight — autonomous tooling reaching dev shouldn't be able to reach prod through any path, and a separate-instance architecture enforces that structurally.

If the diagnostic finds the autonomous-PR-opening is purely cosmetic (e.g., a VS Code extension setting that opens PRs but cannot reach prod through any other mechanism), option B-β (shared-safe) is sufficient.

**Decision deadline:** Phase B G1, after Phase A G4 soak closes. Diagnostic outcome is part of the input.

#### §6.1.4 What §6.2 through §6.7 commit to

The work items below are written to be option-agnostic where possible. Where option-α vs option-β creates a different work item, both are listed and the choice at G1 selects.

### §6.2 Implementation — Migration failure becomes fatal (F-Deploy-G1-C)

**Surface:** `.github/workflows/deploy-dev.yml`, line ~290-292 per G1 §3.3.3.

**Current:**
```bash
if ! npx sequelize-cli db:migrate --env development 2>&1 | tail -20; then
    echo '⚠️ Migration failed - will still restart PM2 so site stays up'
    MIGRATION_FAILED=true
fi
```

**Target:**
```bash
if ! npx sequelize-cli db:migrate --env development 2>&1 | tail -20; then
    echo '🚨 Migration failed - aborting deploy to prevent code/schema drift'
    exit 1
fi
```

**Rationale:** The "site stays up" goal is not achieved when code/schema drift is the actual failure source (G1 §2.6). Fail-fast is more honest.

**Equivalent change for production:** `.github/workflows/deploy-production.yml` is already fail-fast on migrations per G1 §3.4.3. No change needed there. F-Deploy-G1-U (retry idempotency concern) remains — this fix doesn't address retry behavior, just the non-fatal flag.

**Option-α addendum:** If separate dev EC2, this change applies to the new dev workflow file or environment.

**Option-β addendum:** If shared-safe, this change is necessary AND insufficient — the workflow must also avoid `pm2 stop all` on the shared process group (§6.5).

**Closes:** F-Deploy-G1-C (primary).

### §6.3 Implementation — Route-level health verification (F-Deploy-G1-F)

**Surface:** `.github/workflows/deploy-dev.yml`, post-PM2-start health check section (G1 §3.3.3 step 13-14).

**Current:** Health check on `http://localhost:3002/health` retries 6 times. Route verification on `/api/v1/shows` and `/api/v1/episodes` logs status but does NOT exit on failure (G1 F-Deploy-G1-F).

**Target:** Replace the boolean `/health` gate with a multi-route verification that includes route-level functional checks. Specifically: `/health` returns 200, AND `/api/v1/shows` returns 200 (or expected auth 401, but NOT 500 or module-load-error), AND `/api/v1/episodes` returns 200 or expected auth 401. All three must satisfy within the retry window OR the workflow exits non-zero.

**Equivalent change for production:** `.github/workflows/deploy-production.yml` already runs blocking smoke tests on `/health` (G1 §3.4.6); needs the same route-level extension. The dev change is the template; once verified in dev, port to prod with the appropriate base URL (`https://primepisodes.com`).

**Closes:** F-Deploy-G1-F (primary). Partial coverage on F-Deploy-G1-A (build-on-test-failure is a different surface but the route check would catch the consequence: broken code reaches the route, route check fails, workflow exits).

### §6.4 Implementation — `ecosystem.config.js` port-default policy (F-Deploy-G1-H)

**Surface:** `ecosystem.config.js`, default `env` block on `episode-api` per G1 §3.5.1.

**Current:** Default `env` block configures dev port 3002, dev CORS, "Episode Metadata API (Development)" app name. `env_production` override exists.

**Target options:**

| Option | Default `env` block | Trade-off |
|---|---|---|
| H-1 | Defaults flip to prod port 3000, CORS for prod, "Production" app name. `env_development` override for dev. | Missing `--env development` causes dev failures, not prod failures. Safer asymmetry. |
| H-2 | Default `env` block becomes intentionally invalid (e.g., `PORT: 0` or omitted). Forces explicit `--env` always. | Errors loudly on every PM2 command that omits the flag. May break local dev tooling that uses `pm2 start ecosystem.config.js` without flags. |
| H-3 | Keep current. Rely entirely on workflows passing the correct `--env` flag. | Status quo; this finding stays open. |

**Recommendation in this plan:** Option H-1. The asymmetry it creates (forgotten flag breaks dev, not prod) is the right asymmetry — production is the failure case that hurts users; dev is the failure case that hurts only the developer.

**Decision committed at Phase B G1:** depends on Option α vs β.
- Option α (separate EC2): H-1 or H-3 — the choice matters less because separate instances don't cross-port-collide. H-1 still recommended for clarity.
- Option β (shared-safe): H-1 mandatory. The H-3 status quo IS the F-Deploy-G1-H surface.

**Closes:** F-Deploy-G1-H (under H-1 or H-2).

### §6.5 Implementation — `fuser -k 3002/tcp` band-aid retirement (F-Deploy-G1-D)

**Surface:** `.github/workflows/deploy-dev.yml`, line ~298 per G1 §3.3.3.

**Current:** `fuser -k 3002/tcp 2>/dev/null || true` — band-aid that kills whatever holds port 3002 before PM2 starts. Per G1 F-Deploy-G1-D: implies observed pattern of stuck-port issues.

**Target:** Remove the line. The original justification was port collision recovery (G1 F-Deploy-G1-D rationale). With F-Deploy-G1-H closed (§6.4), port collisions of the §2.2 / §12.19 class are structurally prevented. The remaining "stuck port" cases should be diagnosed, not paved over.

**Dependency:** Cannot retire this until §6.4 ships and Phase B G4 soak shows no port-collision events.

**Closes:** F-Deploy-G1-D.

### §6.6 Implementation — Dead app definitions disposition (F-Deploy-G1-I)

**Surface:** `ecosystem.config.js`, `episode-api-dev` and `episode-worker-dev` app definitions per G1 §3.5.2.

**Decision committed at Phase B G1:** depends on Option α vs β.

- **Option α (separate EC2):** Remove `episode-api-dev` and `episode-worker-dev` from `ecosystem.config.js`. They're truly dead — the dev EC2's own config will define its own apps with prod-style names (different file or different instance, same config shape).
- **Option β (shared-safe):** Wire them up. `deploy-dev.yml` starts `--only episode-api-dev,episode-worker-dev` instead of the prod-named apps. The `*-dev` configurations get the dev port and dev log paths already defined (G1 §3.5.4). Dev and prod processes coexist on the instance, named distinctly.

**Closes:** F-Deploy-G1-I (under either option).

### §6.7 Implementation — F-Deploy-G1-T integration

**Surface:** `.github/scripts/deploy-production.sh` per G1 §3.4.5 and pre-flight §4.5 of this plan.

**Action:** Resolve F-Deploy-G1-T per the disposition table in §4.5 of this plan. The pre-flight read happens before Phase A. The action item is:

- If §4.5 read found `--env production` correctly passed: F-Deploy-G1-T resolved as audit closes for the prod side. No Phase B work item.
- If §4.5 read found the flag missing or wrong: add the flag in `deploy-production.sh`. Ships as a Phase B PR — relatively low-LOC but high-stakes (touches production). Verify in dev first (if shared-safe path) or in the new dev EC2 (if separate-EC2 path).

**Dependency on §6.4:** If H-1 ships (prod becomes the default), the `--env production` flag becomes redundant — prod port 3000 is the default. The script can either remove the flag (and rely on default-as-prod) or keep it for explicit-intent clarity. Recommendation: keep the flag; explicit > implicit in deploy code.

**Closes:** F-Deploy-G1-T (resolver-then-fix).

### §6.8 Phase B PR sequence

```
Phase B G1 — Architectural decision gate
 │
 ├── (decision: α or β)
 │
 ├── PR B-1 — §6.2 migration-failure-fatal
 │   merges to main (target: dev workflow)
 │
 ├── PR B-2 — §6.3 route-level health verification (dev)
 │   merges to main
 │
 ├── PR B-3 — §6.3 route-level health verification (prod)
 │   merges to main, gated on PR B-2 dev verification
 │
 ├── PR B-4 — §6.4 ecosystem.config.js port-default flip (H-1)
 │   merges to main
 │
 ├── PR B-5 — §6.5 fuser -k retirement (depends on B-4 soak)
 │   merges to main
 │
 ├── PR B-6 — §6.6 dead apps disposition (depends on α/β decision)
 │   merges to main
 │
 ├── (conditional on §4.5 outcome)
 │   PR B-7 — §6.7 deploy-production.sh --env fix
 │   merges to main
 │
 └── Phase B G6 — 2-week soak with F-Stats-1 Phase B G2 pilot
```

**Sequencing notes:**
- B-1 ships first because migration-failure-fatal is the highest-priority safety change.
- B-2 ships before B-3 because dev is the lower-risk verification target.
- B-4 before B-5 because the band-aid retirement depends on the underlying defect being fixed.
- B-7 is conditional — may not exist if §4.5 found the prod-side script already correct.

### §6.9 Phase B G6 soak (2 weeks)

Per G1 §5.4 closure criteria item 5: "2 weeks with active development through the pipeline (Phase B G2 of F-Stats-1 being the canonical test), zero new incidents in the F-Deploy-G1 finding classes."

**Soak criteria:**

- No F-Deploy-G1-C recurrence (no migration-failure-but-PM2-restarted events).
- No F-Deploy-G1-F recurrence (no /health-200-with-route-500 events).
- No F-Deploy-G1-H recurrence (no port-wrong-env events).
- No F-Deploy-G1-G recurrence (no dev-deploy-disrupts-prod events; under option α structural, under option β procedural).
- F-Stats-1 Phase B G2 pilots through the hardened pipeline: at least 2-3 sequential structural-fix PRs ship through the deploy pipeline without incident. Per Decision #9 (v9 §7.3): F-Stats-1 Phase B's writer migrations are *the* canonical test of F-Deploy-1's hardening.

**If F-Stats-1 Phase B G2 surfaces a new F-Deploy-G1-* class finding during soak:** the finding gets a letter (F-Deploy-G1-AB onward), feeds back to Fix Plan v1.x revision, and Phase C extends. This is not a Phase B failure; it's the canonical test working as designed.

---

## §7 Phase C — Soak + Verification

**Scope:** Cross-phase verification that F-Deploy-1 hardening holds under sustained downstream work. Phase B G6's 2-week soak with F-Stats-1 Phase B G2 pilot is the canonical test. Phase C is the formal close of F-Deploy-1 as a keystone.

### §7.1 What Phase C does

Phase C runs no new code. It verifies:

1. Phase A G4 soak observations held through Phase B execution (sub-form A, C, D containment doesn't degrade as Phase B's higher-volume deploys exercise the pipeline).
2. Phase B G6 soak observations hold (no new F-Deploy-G1-* class findings during F-Stats-1 Phase B G2 pilot).
3. The Decision #9 condition is met: F-Stats-1 Phase B G2 can ship its writer migrations through the F-Deploy-1-hardened pipeline without producing the multi-incident-sequence pattern that motivated the dependency.

### §7.2 Phase C exit criteria

F-Deploy-1 keystone closes when:

- Phase A G4 soak closed clean (1 week, §5.5 criteria met).
- Phase B G6 soak closed clean (2 weeks, §6.9 criteria met).
- F-Stats-1 Phase B G2 has shipped at least 2-3 PRs through the deploy pipeline cleanly during Phase B G6 soak.
- All 27 G1 findings either CLOSED, RESOLVED-INCIDENTALLY, or DOCUMENTED-AS-ACCEPTED-RESIDUAL-RISK with rationale.
- Fix Plan v1.0 → v1.x revision committed documenting closure with per-finding disposition.

### §7.3 If Phase C surfaces new findings

New F-Deploy-G1-* class findings during Phase C soak feed back to a Fix Plan v1.x revision. The keystone does NOT close until the new finding is resolved per the same gate sequence.

If the new finding represents a sub-form not previously identified: open a Phase D scope (sub-form E) and treat as Phase A/B-equivalent work.

### §7.4 What Phase C unblocks

Per v9 §4.2 and Decision #98:

- **F-Stats-1 Phase B (the rest of it).** Phase B G2 is the pilot during Phase C; the remaining writer migrations (9+ raw-SQL writers per v9 §4.2 F-Stats-1 line) ship after F-Deploy-1 close.
- **F-App-1.** Schema-as-JS auto-repair removal can begin once F-Deploy-1 close confirms the deploy pipeline doesn't propagate schema-state-on-restart anti-patterns.
- **The rest of the v9 §4.2 fix sequence:** F-Ward-1, F-Reg-2, F-Ward-3, F-Franchise-1 (Director Brain build), F-Sec-3.

Phase C close is the structural keystone gate — once it passes, the seven downstream keystones can ship in audit-sequence order.

---

## §8 Gate Sequence

| Phase | Gate | Name | Closure criteria |
|---|---|---|---|
| Pre | — | Audit PR open | G1 audit + this Fix Plan v1.0 co-shipped on `claude/f-deploy-1-g1-audit` → PR'd to main → merged. |
| A | G1 | Pre-flight complete | §4.1-§4.6 evidence artifacts captured. §4.5 F-Deploy-G1-T resolver read produces disposition. No unaddressed drift. |
| A | G2 | Sub-form A + C implementation | PR A-1, A-2, A-3, C-1 merged. Branch protection settings applied via `gh api`. Documentation committed. |
| A | G3 | Sub-form D diagnostic complete | PR D-1 merged. Diagnostic artifact documents mechanism identification OR accepted residual risk. |
| A | G4 | Phase A soak | 1 week clean. Soak criteria per §5.5. No F-Deploy-G1-K/L/M/N/O/P/Y/Z recurrence. |
| B | G1 | Architectural decision | Option α (separate EC2) or β (shared-safe) committed in §11 Decisions. Decision references sub-form D diagnostic outcome (Phase A G3) as input. |
| B | G2 | Migration-failure-fatal | PR B-1 merged. Migration failures now abort deploy. |
| B | G3 | Route-level health verification (dev) | PR B-2 merged. Dev deploy now verifies route-level correctness, not just `/health`. |
| B | G4 | Route-level health verification (prod) | PR B-3 merged. Prod deploy now verifies route-level correctness. |
| B | G5 | Ecosystem + scripts disposition | PR B-4, B-5, B-6 merged (and B-7 if §4.5 found prod-side mechanism vulnerable). Port-default flipped, dead apps disposed of, deploy-production.sh fixed if needed. |
| B | G6 | Phase B soak | 2 weeks. F-Stats-1 Phase B G2 pilots through the pipeline. No F-Deploy-G1-A through J recurrence. |
| C | G1 | Cross-phase verification | All 27 findings disposed (CLOSED / RESOLVED-INCIDENTALLY / ACCEPTED-RESIDUAL). |
| C | G2 | F-Deploy-1 close | Fix Plan v1.x revision committed with closure documentation. Keystone marked CLOSED in v9 followup or v10 handoff. |

**Total gates:** 12 (4 Phase A + 6 Phase B + 2 Phase C).

**Gate ordering notes:**

- Phase A G2, G3 can run in parallel (sub-form A + C settings are independent of sub-form D diagnostic).
- Phase A G4 cannot start until G2 AND G3 close (soak verifies both).
- Phase B G1 (architectural decision) is the strict serializer between Phase A and Phase B implementation.
- Phase B G2, G3, G4 can run in parallel after G1.
- Phase B G5 partially depends on G2-G4 outcomes (specifically G3 dev-side ships before G4 prod-side per §6.8 sequencing).
- Phase B G6 cannot start until G2-G5 close.

---

## §9 Rollback Plan

### §9.1 Phase A rollback

Each Phase A PR is independently revertible.

| PR | Rollback approach | Risk if unrolled |
|---|---|---|
| PR A-1 (auto-merge-to-dev opt-out) | `gh pr revert <number>` then merge | Reverts to bang-syntax exclusion list. F-Deploy-G1-P stays open. No service impact. |
| PR A-2 (backend build verification) | `gh pr revert <number>` then merge | Reverts to frontend-only verification. F-Deploy-G1-R stays open. No service impact. |
| PR A-3 (-X ours notification) | `gh pr revert <number>` then merge | Reverts to silent conflict resolution. F-Deploy-G1-Q stays open. No service impact. |
| PR C-1 (branch protection change) | `gh api -X PUT repos/.../branches/main/protection ...` with prior protection JSON | Reverts to no-required-checks state. F-Deploy-G1-V/W stay open. No service impact. **Caveat:** the prior state must be captured before C-1 ships — capture in §4.2 pre-flight artifact. |
| PR D-1 (diagnostic artifact) | `gh pr revert <number>` then merge; restore local env changes | Reverts diagnostic-only commits. If local-env changes were applied as part of D-1, restore the prior config. |

**Phase A rollback as a whole:** Revert all five PRs + restore branch protection state from pre-flight artifact. Re-soak from scratch.

### §9.2 Phase B rollback

Phase B is higher-stakes because it touches the deploy pipeline itself.

**Critical caveat:** Phase B PRs ship through the deploy pipeline they modify. A bad PR B-2 (route-level health verification) could fail to deploy itself, requiring manual recovery (the §2.1 / §2.2 recovery procedures apply: SSH to EC2, `pm2 start ecosystem.config.js --env production`, etc.).

| PR | Rollback approach | Recovery risk |
|---|---|---|
| PR B-1 (migration-failure-fatal) | Revert PR. Revert to `MIGRATION_FAILED=true` non-fatal path. | Low — the prior behavior is well-understood (it's the §2.6 failure pattern, but it doesn't cause additional damage during a revert). |
| PR B-2 (route-level health dev) | Revert PR. | Low — dev only. |
| PR B-3 (route-level health prod) | Revert PR. | **Medium** — if the route-level check is failing during a real production deploy, revert frees the deploy to succeed on `/health`-only. But if the route-level check was correct and the deploy is genuinely broken, reverting masks the failure. |
| PR B-4 (ecosystem.config.js port flip) | Revert PR. Manually `pm2 restart` with explicit `--env production`. | **Medium-High** — at the time of revert, PM2 may be running with prod settings via default `env_production`. Reverting changes the default `env` block back to dev port; subsequent restarts without `--env production` go back to producing the §12.19 failure pattern. Coordinate revert with explicit PM2 commands. |
| PR B-5 (fuser -k retirement) | Revert PR. | Low — re-adds the band-aid. |
| PR B-6 (dead apps disposition) | Revert PR. | Varies by option (α: minimal; β: dev processes need re-disposition manually). |
| PR B-7 (deploy-production.sh fix) | Revert PR. | **Medium** — restores the broken state. If prod has been deploying successfully with the fix, reverting could re-introduce the F-Deploy-G1-H prod-side failure pattern at the next prod deploy. |

**Phase B rollback as a whole:** Decompose into per-PR reverts, but acknowledge that PR B-4 and B-7 require coordinated manual PM2 operations beyond just git revert. Document the recovery procedure in §11 Decisions before either PR ships.

### §9.3 Phase C rollback

Phase C runs no new code. There's nothing to roll back.

If Phase C surfaces a new finding that requires un-shipping a Phase A or Phase B PR, use the per-PR rollback above. The keystone closure stays deferred until the new finding is dispositioned.

### §9.4 Emergency rollback — entire keystone fix

Unlikely. Documented for completeness.

If the deploy pipeline becomes unreachable to a degree that even the Phase A containment fails (e.g., branch protection misconfiguration prevents any merge from landing): use admin bypass (F-Deploy-G1-X — `enforce_admins: false` is intentional for exactly this case). Document the admin bypass in §11 Decisions and revise branch protection settings in a follow-up PR.

If the deploy pipeline becomes structurally broken (e.g., the route-level health check has a bug that prevents any deploy from succeeding): admin-merge a revert directly to main, deploy via the prior path, then re-author the broken check in a new PR.

---

## §10 What This Unblocks

Per v9 §4.2 fix sequence:

| Keystone | Becomes shippable after | Why |
|---|---|---|
| **F-Stats-1 Phase B** (full) | F-Deploy-1 close | Per Decision #98 (v9 §7.3): writer migrations ship through the hardened pipeline. Phase B G2 pilot during Phase C; the rest after. |
| **F-App-1** | F-Deploy-1 close | Schema-as-JS auto-repair removal needs migration-failure-fatal (§6.2) and route-level health (§6.3) to be in place. Otherwise removing the auto-repair surface fails silently. |
| **F-Ward-1** | F-App-1 close | Per v9 §4.2 sequencing. |
| **F-Reg-2** | F-Ward-1 close | Per v9 §4.2 sequencing. |
| **F-Ward-3** | F-Reg-2 close | Per v9 §4.2 sequencing. |
| **F-Franchise-1** (Director Brain build) | F-Ward-3 close | Per v9 §4.2 sequencing. The structural prerequisites must land before Director Brain's consumer wiring lands. |
| **F-Sec-3** (character_key consolidation) | F-Franchise-1 close | Per v9 §4.2 / Decision #94 — subordinate to F-Franchise-1. |

**Specific to F-Deploy-1's role:** the keystone doesn't directly unblock any application-level behavior. What it unblocks is *safe shipping of subsequent fixes*. After Phase C, the deploy pipeline can absorb the 9+ writer migrations of F-Stats-1 Phase B without producing the §2.6 failure pattern; the auto-repair removal of F-App-1 without producing the §2.1 failure pattern; the structural changes of F-Ward-1 through F-Franchise-1 without producing new F-Deploy-G1-* class incidents.

---

## §11 Decisions Log

Decisions made during plan authoring (locked at v1.0). Add to this section as Phase A, B, C execute.

### Locked at v1.0 authoring (2026-05-16)

- **Decision FD-1: Three-phase structure.** Phase A (containment + safety) → Phase B (deploy-dev architectural correction) → Phase C (soak + verification + close). Matches G1 §5.2 starting frame.
- **Decision FD-2: Sub-form ordering A/C/D-diagnostic in parallel during Phase A; B serialized after Phase A.** Matches G1 §5.3 recommendation.
- **Decision FD-3: `auto-merge.yml` (main path) stays deleted permanently.** No filtered restoration. Manual merge for every PR to main. (§5.1.1 Decision A-1.)
- **Decision FD-4: `auto-merge-to-dev.yml` (dev path) stays active, with three changes (opt-out label, backend build verification, `-X ours` notification).** (§5.1.1 Decision A-2.)
- **Decision FD-5: Branch protection on main adopts minimal real gate — `required_status_checks: [Validate]`, zero required reviews, `enforce_admins: false`.** (§5.2.1 Decision C-1.)
- **Decision FD-6: Admin-bypass-as-emergency-escape-hatch policy documented at `docs/audit/policies/branch-protection.md`.** (§5.2.1 Decision C-2.)
- **Decision FD-7: Sub-form D diagnostic phase produces an artifact (not a containment).** Containment decisions defer to diagnostic outcome. Three possible outcomes documented at §5.3.2.
- **Decision FD-8: Sub-form B architectural choice (option α separate EC2 vs option β shared-safe) deferred to Phase B G1.** Sub-form D diagnostic outcome is part of the decision input. (§1.2, §6.1.)
- **Decision FD-9: Recommendation in plan for ecosystem.config.js port-default policy is Option H-1 (flip defaults to prod). Final commitment at Phase B G1 contingent on α/β.** (§6.4.)
- **Decision FD-10: Phase A G4 soak duration 1 week; Phase B G6 soak duration 2 weeks; F-Stats-1 Phase B G2 pilot is the canonical Phase B G6 test.** Matches G1 §5.4 closure item 5 and Decision #98.
- **Decision FD-11: Fix Plan v1.0 ships on the same branch as G1 audit (`claude/f-deploy-1-g1-audit`), in the same PR to main, citing G1 audit at branch HEAD.** Reflects user election at planning gate.
- **Decision FD-12: Document format is markdown for v1.0 working draft, .docx generated at lock (v1.x revision marking keystone close).** Reflects user election at planning gate.

### To be added during execution

- Decisions surfaced during §4 pre-flight (drift handling, F-Deploy-G1-T resolution outcome).
- Decision at Phase B G1 (α vs β architectural choice).
- Decisions on individual PR scope refinements during Phase A G2, A G3, B G2-G5.
- Any deviation from this plan's structure (per §1.3 — deviations are documented, not forbidden).

---

## §12 Appendix A — Findings → Phase Mapping

All 27 F-Deploy-G1-* findings with their assigned sub-form, phase, and primary work-item reference.

| Finding | Sev | Sub-form | Phase | Primary work-item | Closure approach |
|---|---|---|---|---|---|
| F-Deploy-G1-A | P0 | B | B-G3/G4 | §6.3 | Route-level health verification catches build-on-test-failure consequences |
| F-Deploy-G1-B | P0 | B | B-G2 + B-G5 | §6.2 + §6.4 | Migration-fatal + port-policy reduce dependency-resolution-timing surface |
| F-Deploy-G1-C | P0 | B | B-G2 | §6.2 | Migration failure becomes fatal |
| F-Deploy-G1-D | P1 | B | B-G5 | §6.5 | Band-aid retirement after §6.4 closes underlying defect |
| F-Deploy-G1-E | P1 | B | B-G1 (decision) | §6.1 + §6.4 | Resolved by α (separate instances) or β (port-default flip + dev-named apps) |
| F-Deploy-G1-F | P0 | B | B-G3/G4 | §6.3 | Route-level health verification |
| F-Deploy-G1-G | P0 | B | B-G1 (decision) | §6.1 | Architecturally closed under α; procedurally closed under β |
| F-Deploy-G1-H | P0 | B | B-G5 | §6.4 | Ecosystem default port flip (H-1) |
| F-Deploy-G1-I | P1 | B | B-G5 | §6.6 | Remove (α) or wire up (β) |
| F-Deploy-G1-J | P1 | B | B-G1 (decision) | §6.1 | Resolved by α (separate filesystems) or β (separate log paths in *-dev configs) |
| F-Deploy-G1-K | P0 | A | A-G2 | §5.1 (Decision A-1) | `auto-merge.yml` stays deleted |
| F-Deploy-G1-L | P0 | A | A-G2 | §5.1 (Decision A-1) | Eliminated by Decision A-1 |
| F-Deploy-G1-M | P0 | A | A-G2 | §5.1 (Decision A-1) + §5.2 | Eliminated by A-1; remaining `--auto` timing concern moot under C-1's required-checks gate |
| F-Deploy-G1-N | P1 | A | A-G2 | §5.1 (Decision A-1) | Eliminated by A-1 |
| F-Deploy-G1-O | P1 | A | A-G2 | §5.1 (Decision A-1) | Eliminated by A-1 |
| F-Deploy-G1-P | P0 | A | A-G2 | §5.1 (Decision A-2.1) | Hardcoded exclusion replaced with opt-out label/sentinel |
| F-Deploy-G1-Q | P0 | A | A-G2 | §5.1 (Decision A-2.3) | Silent drop becomes notified drop |
| F-Deploy-G1-R | P1 | A | A-G2 | §5.1 (Decision A-2.2) | Backend build verification added |
| F-Deploy-G1-S | P1 | B | B-G1 (decision) | §6.1 | Resolved by α (no shared file state) or β (deploy-production.yml ships its own ecosystem.config.js) |
| F-Deploy-G1-T | DEFERRED | B | Pre-flight §4.5 + B-G5 conditional | §6.7 | Pre-flight read produces disposition; conditional PR B-7 if read finds prod vulnerable |
| F-Deploy-G1-U | P1 | B | B-G2 (related, separate work) | §6.2 (related) | Migration-fatal change eliminates the retry-idempotency surface on the dev side; prod side requires deploy-production.sh review |
| F-Deploy-G1-V | P0 | A + C | A-G2 | §5.2 (Decision C-1) | Required-status-checks add provides real gate |
| F-Deploy-G1-W | P0 | A + C | A-G2 | §5.2 (Decision C-1) | Required-status-checks add eliminates immediate-merge condition |
| F-Deploy-G1-X | P0 | C | A-G2 | §5.2 (Decision C-2) | Documented as intentional-policy with rationale |
| F-Deploy-G1-Y | P0 | D | A-G3 | §5.3 | Diagnostic phase identifies or accepts residual |
| F-Deploy-G1-Z | P2 | D | A-G3 | §5.3 | Diagnostic phase identifies; per-commit `--author` already contains |
| F-Deploy-G1-AA | P1 | D (containment status) | A-G2 (sub-form A closes the K-W-V chain; AA observation tracks containment) | §5.1 + §5.2 | Closed as combined-containment status once A-G2 ships |

**Severity totals (per G1 §11.5):** 18 P0, 8 P1, 1 P2 (Z). G1's count of 27 (A-AA) preserved.

**Phase totals:**
- Phase A closes 13 findings (K, L, M, N, O, P, Q, R, V, W, X, Y, Z) + tracks AA.
- Phase B closes 13 findings (A, B, C, D, E, F, G, H, I, J, S, T, U).
- Phase C produces zero new closures; verifies the Phase A + B closures hold.

---

## §13 Closing Note

This plan exists because F-Deploy-1 surfaced as the 8th keystone — not in the original audit (v8 closed at 7 keystones), but in the post-audit fix-cycle when F-Stats-1 Phase A's G2 commit hit the deploy pipeline and triggered the §12.19 outage 24 hours after F-App-1 had triggered its own §12.15 outage. Per Decision #97 (v9 §7.3): F-Deploy-1 is upstream of every structural fix because every fix ships through the deploy pipeline.

The G1 audit (this branch) traced 27 file:line findings across 4 sub-forms with full chronological reconstruction of the six failure events that motivated the keystone. This Fix Plan v1.0 takes G1's §5 starting frame and commits to specific work — three phases, twelve gates, twelve locked decisions, finding-by-finding closure approach.

Two things this plan does not yet contain:
1. The sub-form B architectural decision (separate EC2 vs shared-safe). Deferred to Phase B G1 by design.
2. Sub-form D diagnostic outcome. Surfaced during Phase A G3 execution.

Both are inputs to the plan, not outputs of authoring. The plan ships with them open; v1.x revisions close them.

Per G1 §7 next action: this plan and the G1 audit co-ship on `claude/f-deploy-1-g1-audit` as a single PR to main. After merge, Phase A G1 (pre-flight, §4) begins. Per Decision #98: F-Stats-1 Phase B G2 stays blocked until F-Deploy-1 closes — through Phase C.

The path is visible end-to-end. F-Deploy-1 close unblocks F-Stats-1 Phase B; Phase B unblocks F-App-1; F-App-1 unblocks the structural prerequisites; the prerequisites unblock F-Franchise-1; F-Franchise-1 is the Director Brain build. The franchise tier / show tier disconnection that motivated the audit gets its wire.

Not today. But the path is visible.

---

*End of F-Deploy-1 Fix Plan v1.0 (draft).*
*Author: Claude, co-authoring with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Branch: `claude/f-deploy-1-g1-audit` — co-shipped with G1 audit.*
*Date: 2026-05-16.*
