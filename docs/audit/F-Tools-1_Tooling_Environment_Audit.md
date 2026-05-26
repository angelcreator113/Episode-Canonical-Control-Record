# F-Tools-1 — Tooling Environment Audit

**Status:** Drafted 2026-05-21 during F-Deploy-1 Phase A G4 soak day 2. Local-state only, not committed to main during G4 soak.

**Document shape:** One-time audit deliverable, not a keystone. Survey-and-close.

**Purpose:** Establish a point-in-time baseline of the tooling-environment-integrity surface on the Prime Studios development environment. Catalog findings whether closed or open. Provide future-Claude with a single reference document for "what does the tooling environment look like as of 2026-05-21, and which concerns have been addressed by which actions."

**Why this is not a keystone:** Most findings in this cluster are already closed (F-Deploy-G1-V/W/X via FD-5, F-Deploy-G1-Y via FD-22, loki extension via removal 2026-05-17, PE #58 via 2026-05-21 squash-merge-workflow framing). The remaining open items are individual fixes (stop hook adjustment, deploy hook noise) not a recurring class. Keystone infrastructure would be premature; a one-time audit captures the state and lets future findings be filed against this baseline.

**Future-revisit condition:** If the tooling-environment-integrity surface grows new findings post-survey (multiple new PE entries in the next 30-90 days that fit this cluster), promote to keystone. F-Tools-1 as keystone would absorb this audit document as its §1 (Audit Baseline) and add Phase A/B/C structure for ongoing fixes.

**Cross-references:**

- F-Deploy-1 Fix Plan v1.0 / v1.1 / v1.3 (FD-5 branch protection, FD-22 F-Deploy-G1-Y closure)
- F-Deploy-1 G1 Audit (F-Deploy-G1-V, G1-W, G1-X, G1-Y findings)
- F-Deploy-G1-Y Postmortem (loki investigation and closure semantics)
- F-App-1 v1.1 §12.15 (stop hook + deploy hook noise origins)
- Session_PE_Roster.md PE #57 (enforce_admins decision-archaeology), PE #58 (local-tooling identity drift, CLOSED)
- v11 §3.3 closure-semantic vocabulary (closure types referenced throughout)

---

## §1 — Scope statement

**The tooling-environment-integrity surface** covers the configuration, behavior, and trustworthiness of the tools, extensions, hooks, workflows, and repository configuration that interact with the Prime Studios development environment.

**In scope:**

- VS Code extensions (trust, behavior, permissions)
- Git hooks and shell hooks (configuration, side effects, noise patterns)
- GitHub repository configuration (branch protection, workflow permissions, app permissions)
- Local Git tooling (identity attribution, wrapper layers, environment-variable influences)
- Autonomous tools with PR/commit creation capability (Copilot Workspace, Claude Code, GitHub Apps)
- CI/CD workflow configuration (auto-merge behavior, deploy hooks, notification configuration)

**Out of scope:**

- AWS infrastructure configuration (covered by F-Deploy-1 and separate cost-monitoring tracking)
- Database schema and migration tooling (covered by F-Ward-1 and F-Stats-1)
- Application-layer auth and authorization (covered by F-AUTH-1)
- Production runtime tooling (PM2, nginx, etc — covered by F-App-1 and F-Deploy-1 deploy-pipeline scope)

The boundary: F-Tools-1 covers tools that affect the *development environment's integrity* before code reaches production. Tools that affect production runtime are in other keystones.

---

## §2 — Methodology

This survey reads the current state of the tooling environment and catalogs findings under four categories. For each finding, the survey records:

1. **Surface** — where the concern lives (file path, configuration name, tool name)
2. **State** — current behavior or configuration
3. **Status** — open, closed, deferred, or not-yet-investigated
4. **Disposition** — what action was taken or is owed, with cross-references to fix plans / PE entries / postmortems

Survey methodology was *reading the existing audit history* (F-Deploy-1 Fix Plan v1.0/v1.1/v1.3, G1 Audit, F-App-1 v1.1, Session_PE_Roster.md) rather than fresh investigation. The point of this document is to consolidate findings already scattered across the audit history into a single tooling-environment-integrity baseline.

If new investigation surfaces during this drafting session, it is filed as a new PE entry in `Session_PE_Roster.md` and cross-referenced here, not investigated inline.

---

## §3 — Findings by category

### §3.1 — VS Code extension trust and behavior

**Concern class:** Extensions installed in the local VS Code environment have varying levels of trust and varying capabilities to act on the repository, the git tooling, or the GitHub account. Some extensions can produce PRs, commits, or branch operations without explicit user action.

**Findings:**

#### §3.1.1 — loki-laufeyson.intelligent-assistant extension (CLOSED 2026-05-17)

**Surface:** VS Code extension marketplace publisher `loki-laufeyson`, display name `intelligent-assistant`. Internal `package.json` name differs from both. Bundled code contained undisclosed reference to "Herm-Studio."

**State (before removal):** Installed on dev environment. Four-layer identity mismatch across publisher / display name / internal name / bundled-code attribution.

**Status:** CLOSED 2026-05-17 via removal from local environment.

**Disposition:** Per FD-18 in F-Deploy-1 Fix Plan v1.2 §6 — extension removed as containment after identity-laundering pattern surfaced. Not causally linked to F-Deploy-G1-Y by FD-22 evidence (which is closure-by-removal-sufficiency, not causation). FD-18 stands as separate trustworthiness concern independent of F-Deploy-G1-Y.

**Future-revisit conditions:**

- If loki is reinstalled (publisher name or display name), re-trigger investigation
- If any new extension with similar four-layer identity mismatch pattern is installed, file as new PE entry

#### §3.1.2 — Extensions surveyed during F-Deploy-1 v1.1 pre-flight (DOCUMENTED, status varies)

**Surface:** Six VS Code extensions identified during F-Deploy-1 Fix Plan v1.1 pre-flight inventory as having permissions consistent with autonomous-PR behavior:

- GitLens — Git workflow assistance, no known PR-creation behavior
- Copilot Chat — chat-based code suggestions, no known PR-creation behavior
- dscodegpt — code suggestions, no known PR-creation behavior
- copilot-mcp — MCP integration, no known PR-creation behavior
- loki-laufeyson.intelligent-assistant — CLOSED via removal (see §3.1.1)
- Plus underlying tools: Copilot Workspace (PR-creation capability), Claude Code (PR-creation capability)

**State:** All except loki remain installed. None investigated further after F-Deploy-G1-Y closed via removal-sufficient finding (FD-22).

**Status:** Documented, not actively investigated. F-Deploy-G1-Y closure removed the *symptom* (no autonomous PRs), but the *capability* survey was paused at the loki finding.

**Disposition:** No action owed. If F-Deploy-G1-Y recurs, the survey resumes with the remaining five extensions as the next candidate set. Current capability inventory documented in v1.1 pre-flight notes.

#### §3.1.3 — Extension trust framework (NOT-YET-INVESTIGATED)

**Surface:** VS Code extension marketplace itself — what publisher-verification, code-review, or security-scanning processes exist for extensions before they reach the marketplace.

**State:** Unknown. Loki extension was downloaded from the marketplace; the four-layer identity-laundering pattern bypassed whatever marketplace controls exist.

**Status:** NOT-YET-INVESTIGATED. Survey records the question without answering it.

**Disposition:** Open question for v11 author session or future tooling-environment work. The question is not actionable on Prime Studios's side (you can't audit Microsoft's marketplace controls) but informs trust assumptions when installing new extensions.

**Workaround pattern:** Per FD-18 implications — for any new extension, manually verify publisher / display name / internal name / bundled code attribution coherence before installing. Four-layer mismatch is the canary.

---

### §3.2 — Git hooks and shell hooks

**Concern class:** Pre-commit, post-commit, pre-push hooks and shell-wrapper hooks (like `.claude/stop-hook-git-check.sh`) that fire automatically during dev workflow. These can: produce side effects, output noise to logs, block commits unexpectedly, or interact with autonomous tools in non-obvious ways.

**Findings:**

#### §3.2.1 — `.claude/stop-hook-git-check.sh` deploy hook noise (OPEN)

**Surface:** Shell hook at `.claude/stop-hook-git-check.sh`, intended to check repository state during deploy operations.

**State:** Hook fires on dirty trees (uncommitted changes present) and emits noise to deploy logs. Per F-App-1 v1.1 §12.15.5 the hook's firing pattern was documented as noise but not addressed.

**Status:** OPEN. Stop hook adjustment owed. F-App-1 §12.15.5 named this but didn't fix it.

**Disposition:** Fix is bounded — either gate the hook on commit state (skip if dirty tree), gate on operation type (skip during certain operations), or replace the hook entirely. Low effort (~30 min), but unscoped — no fix plan currently owns this. Either F-App-1 v2.0 (if F-App-1 gets a follow-up revision) or filed standalone.

**Recommendation:** File as PE entry when surveyed for execution. Could close as part of the next F-App-1 revision or as a standalone deploy-hook hardening task.

#### §3.2.2 — Deploy hook noise pattern (DOCUMENTED, root cause known)

**Surface:** Same as §3.2.1 — the stop-hook noise on dirty trees produces visible failures in deploy logs even when the underlying operation succeeds.

**State:** Cosmetic. Deploy operations succeed; logs show hook failure output.

**Status:** DOCUMENTED in F-App-1 v1.1 §12.15.5. Root cause understood. Fix not scoped.

**Disposition:** Same as §3.2.1 — bundle with the stop hook adjustment when that lands.

#### §3.2.3 — Other git hooks (NOT-YET-INVESTIGATED)

**Surface:** `.git/hooks/` directory contents on local repo. Standard hooks (pre-commit, post-commit, pre-push, etc.) plus any added by tooling (husky, lint-staged, etc.).

**State:** Unknown. Survey did not enumerate hooks in `.git/hooks/`.

**Status:** NOT-YET-INVESTIGATED. Out-of-scope for this audit's "reading existing audit history" methodology.

**Disposition:** Could be added to F-Tools-1 future-revisit scope. Quick to enumerate (`ls .git/hooks/`) if desired. Low priority — `.git/hooks/` is local-only and doesn't affect what reaches main.

---

### §3.3 — GitHub repository configuration

**Concern class:** Branch protection settings, workflow permissions, GitHub App permissions, repository-level configuration that affects what can land on protected branches and who can push.

**Findings:**

#### §3.3.1 — Branch protection on main: required status checks (CLOSED via FD-23/FD-24)

**Surface:** GitHub branch protection rule on `origin/main`.

**State:**

- `required_status_checks.strict: true`
- `required_status_checks.contexts: ["Cost Exposure Audit", "Tests", "Route Validation"]`
- `enforce_admins.enabled: false`
- `required_pull_request_reviews.required_approving_review_count: 0`
- `allow_force_pushes: false`
- `allow_deletions: false`

**Status:** CLOSED via FD-5 (decision locked v1.0), FD-23 (initial ship), FD-24 (status-checks list update). Verified 2026-05-21 soak day 2 observable sweep — settings match FD-5 specification exactly.

**Disposition:** FD-5's "minimal real gate" framing accepted as the operational policy. Non-admin contributors are gated by the three required status checks (with `strict=true` requiring up-to-date branches); admins retain bypass capability for emergency unblock per FD-5 rationale.

**Cross-reference:** PE #57 originally framed this as drift from F-Stats-1 v1.2 Decision #9's "with admin enforcement" requirement; 2026-05-21 decision-archaeology found Decision #9's phrasing was generic and was deliberately narrowed by FD-5. No drift between Fix Plan and shipped state; documentation reconciliation in v11 §3.5 covers the Decision #9 phrasing question.

#### §3.3.2 — `enforce_admins=false` policy (DOCUMENTED, deliberate)

**Surface:** Branch protection rule `enforce_admins.enabled: false`.

**State:** Admin (sole admin: JAWIHP / Evoni) can push directly to main bypassing the three required status checks.

**Status:** DOCUMENTED as deliberate policy in F-Deploy-1 Fix Plan v1.0 lines 387 / 394 / 918, reaffirmed in v1.1 line 304, verified at ship in v1.3 §6.2. Rationale: solo-developer emergency-bypass capability (F-Deploy-G1-X framing from G1 audit §3.6.3).

**Disposition:** Policy stands. v11 should reconcile F-Stats-1 v1.2 Decision #9's generic "with admin enforcement" phrasing to match FD-5's actual scope.

**Compensating control:** Admin bypass is intentional but should be "used sparingly, logged in Decisions when invoked" per v1.0 line 394. No audit trail mechanism currently enforces this — relies on JAWIHP's discipline. If admin bypasses become frequent, that signals the FD-5 policy needs revisiting.

#### §3.3.3 — `required_approving_review_count=0` policy (DOCUMENTED, deliberate)

**Surface:** Branch protection rule `required_pull_request_reviews.required_approving_review_count: 0`.

**State:** PRs can self-merge once status checks pass, with no human-reviewer gate.

**Status:** DOCUMENTED as deliberate policy in FD-5 ("zero required reviews," v1.0 line 918). Rationale: solo-developer pattern — no second contributor to review PRs.

**Disposition:** Policy stands. Same v11 reconciliation as §3.3.2 (Decision #9 phrasing covers both `enforce_admins` and `required_approving_review_count`).

**Future-revisit condition:** If additional contributors join Prime Studios, this policy needs to be flipped to require at least one approving review. The solo-dev rationale no longer holds with multiple contributors.

#### §3.3.4 — Workflow permissions and GitHub App permissions (PARTIALLY INVESTIGATED 2026-05-22)

**Surface:** GitHub Actions workflow permissions (`GITHUB_TOKEN` scope per workflow), GitHub App installations on the repo and their granted permissions.

**State (2026-05-22 partial investigation):**

Repo-wide default workflow permissions enumerated via `gh api .../actions/permissions/workflow`:

```json
{
  "default_workflow_permissions": "read",
  "can_approve_pull_request_reviews": false
}
```

Per-workflow permissions declarations enumerated via grep of `.github/workflows/*.yml`:

| Workflow | Permissions |
|---|---|
| `auto-merge-to-dev.yml` | No explicit block (uses default `read`) |
| `deploy-dev.yml` | `contents: read` |
| `deploy-production.yml` | `contents: read` |
| `validate.yml` | `contents: read` |

GitHub App installations on the repo NOT enumerated — `gh api .../installation` returned HTTP 401 (JWT auth not available in current CLI context).

**Status:** PARTIALLY INVESTIGATED 2026-05-22. Workflow permissions side fully enumerated; GitHub App side partially enumerated via inference (see §3.5.4 amendment for the App-token finding).

**Disposition:** Web-UI inventory of GitHub App installations owed post-soak-close. Filed as PE #59 cross-reference.

**Investigation command (post-soak-close, for App identity + permissions):** Navigate `Settings → Integrations → GitHub Apps` in the repo web UI; not gh-CLI-accessible from current auth context.

---

### §3.4 — Local Git tooling and identity attribution

**Concern class:** Git configuration, identity attribution, wrapper layers, environment variables that affect what identity appears on local commits before they reach main.

**Findings:**

#### §3.4.1 — Local-tooling identity drift (CLOSED 2026-05-22 afternoon with corrected mechanism; was never actually local-tooling drift)

**Surface:** Per PE #58 (re-closed 2026-05-22 afternoon with corrected mechanism) — main-branch commits 2026-05-06 through 2026-05-14 attributed to `TySteamTest`. Originally framed as local-tooling drift; investigation 2026-05-22 afternoon identified actual mechanism as GitHub App attribution on workflow-performed squash-merges.

**State:** Pre-2026-05-15 squash-merge artifacts on main attribute to `TySteamTest` (a GitHub App identity, email format `130309211+TySteamTest@users.noreply.github.com`). The `auto-merge.yml` workflow (deleted 2026-05-15 via commit `1b3a02b3`) performed automated squash-merges using the App token; GitHub attributes workflow-performed squash-merges to the workflow's authentication identity, not to the human PR author. Same App as referenced in PE #59 (current `auto-merge-to-dev.yml` uses the same `secrets.APP_ID` / `secrets.APP_PRIVATE_KEY` pair).

**Status:** CLOSED 2026-05-22 afternoon. The "drift" framing was never accurate — the attribution was expected GitHub App behavior on workflow-performed squash-merges. The 2026-05-15 transition was caused by deleting the workflow (`auto-merge.yml`) that was producing the surfacing, not by fixing any local-tooling configuration.

**Disposition:** No action owed. Audit-trail forensics now treats pre-2026-05-15 main-branch author attribution as a *path signal* (which entity performed the squash-merge), not as authorship evidence. Decision-authorship lives in PR descriptions and commit message bodies. PE #60 documents the corrected understanding for v11.

**v11 §3.3.5 implication (revised):** v11 §3.3.5 (compensating-control closure type, drafted 2026-05-21) cited this finding as a canonical example. The citation should be removed — this was never a compensating-control closure; it was a misclassification corrected by investigation. The two remaining examples in F-Tools-1 §4.3 (`enforce_admins=false`, `required_approving_review_count=0`) are still valid compensating-control closures.

**Historical attribution closure narrative:**

1. 2026-05-21 first closure — wrong mechanism (squash-merge as compensating control)
2. 2026-05-22 morning reopening — correct identification of original closure as wrong, but wrong about the alternative (assumed drift mechanism existed and was unknown)
3. 2026-05-22 afternoon re-closure — correct mechanism identified (GitHub App workflow attribution, not drift)

**Future-revisit conditions (revised):**

- If PE #59's post-soak-close web-UI App inventory reveals the App identity is NOT `TySteamTest` (would mean two separate Apps were/are involved)
- If post-2026-05-15 commits on main start showing App-identity attribution unexpectedly (would mean a new App-using workflow has been introduced)
- If GitHub changes how workflow-performed squash-merges attribute (low probability; GitHub behavior is stable)

#### §3.4.2 — `.gitconfig` and `git config` scope hierarchy (CLOSED 2026-05-22 by §3.4.1 closure)

**Surface:** Local `.gitconfig` files at three scopes — system (`/etc/gitconfig`), global (`~/.gitconfig`), and local (`.git/config`).

**State (verified 2026-05-22 afternoon):** `git config --show-origin user.email` returned `file:C:/Users/12483/.gitconfig  evonifoster@yahoo.com`. Global config is correct. No `TySteamTest` anywhere in local git environment.

**Status:** CLOSED 2026-05-22 afternoon — was never the source of the `TySteamTest` attribution. The §3.4.1 closure (corrected mechanism: GitHub App workflow attribution, not local-tooling drift) makes this investigation moot. The local git environment was never drifting.

**Disposition:** No action owed. Local config is correct and was correct throughout. The `TySteamTest` attribution on pre-2026-05-15 main commits came from server-side GitHub workflow attribution, not from any local config.

#### §3.4.3 — Environment-variable wrapper layers (CLOSED 2026-05-22 by §3.4.1 closure)

**Surface:** Environment variables `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_NAME`, `GIT_COMMITTER_EMAIL` and any wrapper scripts that set them.

**State:** No investigation needed. PE #58's original hypothesis (env-var wrapper layer producing `TySteamTest`) was incorrect — the attribution mechanism was server-side GitHub workflow attribution, not local env vars.

**Status:** CLOSED 2026-05-22 afternoon — moot. The §3.4.1 closure identifies the actual mechanism; this hypothesized cause is no longer relevant.

**Disposition:** No action owed. If a future finding suggests local-tooling drift again, run `Get-ChildItem Env:GIT_*` to verify env vars are clean.

---

### §3.5 — Autonomous tools with PR/commit creation capability

**Concern class:** Tools that can create PRs, commits, or branch operations without explicit user action. Closely related to §3.1 (extension trust) but the surface is broader — includes command-line tools, GitHub Apps, MCP integrations, and ChatOps tools.

**Findings:**

#### §3.5.1 — F-Deploy-G1-Y (autonomous PR mechanism) (CLOSED via FD-22)

**Surface:** Observed pattern of PRs opening on `claude/**` branches without explicit `gh pr create` invocation. Surfaced April 2026 during F-AUTH-1 work cycle.

**State (at investigation):** Behavior was inconsistent — would fire sometimes, not others. Candidate set: Copilot Workspace, Claude Code, plus six VS Code extensions surfaced during v1.1 pre-flight inventory (see §3.1.2).

**Status:** CLOSED via FD-22 (F-Deploy-1 Fix Plan v1.3 §4.2). Closure framing: "identified — removal-sufficient." loki extension removed 2026-05-17; N=8 diagnostic data points across VS Code closed/open and wait windows 30s–15min confirmed behavior does not recur.

**Disposition:** See F-Deploy-G1-Y Postmortem (drafted 2026-05-21, local-state) for full forensics and methodological lessons. Closure was correlation + sufficiency, not causation. Recurrence under conditions matching the N=8 evidence would re-open.

**Cross-reference:** Postmortem documents five methodological lessons including FD-19's N=1 deferral discipline, closure-semantic precision, and the identity-laundering finding as separate from causation.

#### §3.5.2 — Copilot Workspace (DOCUMENTED, no action)

**Surface:** Local installation. Branch `copilot/worktree-2026-03-11` confirmed on local checkout.

**State:** Installed, not investigated further after F-Deploy-G1-Y closed via loki removal. Capability to produce PRs without explicit `gh pr create` exists.

**Status:** DOCUMENTED. No action owed unless F-Deploy-G1-Y recurs.

**Disposition:** Standing capability inventory.

#### §3.5.3 — Claude Code (DOCUMENTED, deliberately installed)

**Surface:** Claude Code is deliberately installed and used. Random-suffix `claude/**-XXXXX` branches are the canonical signature.

**State:** Active. Used for branch creation, commit authoring, and PR creation in normal workflow.

**Status:** DOCUMENTED. Not a concern — deliberate use.

**Disposition:** F-Deploy-G1-Y investigation question initially included Claude Code as a candidate; FD-22's removal-sufficient closure (loki removed, behavior halted) leaves Claude Code's normal operation unaffected.

#### §3.5.4 — Other PR-capable tools (PARTIALLY INVESTIGATED 2026-05-22)

**Surface:** GitHub Apps with `pull_requests: write` permission, MCP servers with PR-creation capability, other tools the F-Deploy-G1-Y investigation didn't enumerate.

**State (2026-05-22 partial investigation):**

One specific PR-capable tool identified: a **GitHub App** referenced via `secrets.APP_ID` + `secrets.APP_PRIVATE_KEY` in `.github/workflows/auto-merge-to-dev.yml`. The workflow uses `actions/create-github-app-token@v1` to generate a runtime token from the App credentials and uses that token for merge + push operations.

The workflow's inline comment documents the rationale: `# GITHUB_TOKEN pushes do NOT trigger other workflows (GitHub security rule).` The App-token mechanism bypasses this GitHub-enforced restriction legitimately, allowing the auto-merge-to-dev push to trigger `deploy-dev.yml` downstream.

**What's known:**

- App has permissions sufficient to merge PRs and push to `dev`.
- App credentials are stored in repo secrets vault.
- App-token mechanism is deliberate, documented in workflow code, uses standard tooling (Microsoft-published action).

**What's NOT known (web-UI inventory owed):**

- App identity (which specific GitHub App?)
- Full permission surface (PR write, contents write, actions, etc.)
- App installation scope (this repo only, or broader)
- Private key rotation policy (long-lived static key, or rotated regularly?)

**Status:** PARTIALLY INVESTIGATED 2026-05-22. One specific App-token tool identified; App identity + permissions enumeration owed.

**Disposition:** Filed as PE #59 (P2, informational baseline). Post-soak-close: navigate `Settings → Integrations → GitHub Apps` in the repo web UI to enumerate App identity + permissions, then update this §3.5.4 with full close + any follow-up PE entries (rotation hygiene, scope, etc.).

**Cross-reference:** Distinct from F-Deploy-G1-Y class (loki extension, closed via FD-22 removal-sufficient). The App-token mechanism here is a *different* PR-capable surface and is not causally linked to F-Deploy-G1-Y per FD-22 evidence.

**Investigation command (re-enumeration if state changes):**

```powershell
Get-Content .github/workflows/auto-merge-to-dev.yml | Select-String -Pattern "permissions|token|secrets\." -Context 1,1
```

---

### §3.6 — CI/CD workflow configuration

**Concern class:** GitHub Actions workflow definitions, auto-merge behavior, deploy hooks, notification configuration. Workflows can produce or accept changes to protected branches; misconfiguration is a class of tooling-environment defect.

**Findings:**

#### §3.6.1 — `auto-merge.yml` workflow (CLOSED via deletion)

**Surface:** GitHub Actions workflow that auto-merged PRs from `dev` to `main` once status checks passed.

**State (before deletion):** Active. Combined with `auto-merge-to-dev.yml` (which auto-merges `claude/**` PRs into `dev`), created a full pipeline from "branch pushed" to "code on main" without explicit human approval at any step. Two production-outage incidents (F-App-1 §12.15 PM2-stopped, F-Stats-1 §12.19 PM2-wrong-port) traced to this workflow's behavior.

**Status:** CLOSED via deletion on 2026-05-15 per FD-2 containment action. Commit `1b3a02b3` removed `auto-merge.yml` from `.github/workflows/`.

**Disposition:** Containment-only closure. The capability to auto-merge dev → main is gone; the underlying class of "autonomous merge cascade" is addressed by the broader F-Deploy-1 scope.

#### §3.6.2 — `auto-merge-to-dev.yml` workflow (ACTIVE, modified per FD-22 et al)

**Surface:** GitHub Actions workflow at `.github/workflows/auto-merge-to-dev.yml`.

**State:** Active for `claude/**` branches. Modified via FD-20 (opt-out token `[skip-automerge]`), FD-21 (backend syntax verification, sub-form A-2 per PR #707), and FD-22 (notification on `-X ours` per sub-form A-3, PR #709). Currently runs validate.yml suite + opt-out grep + syntax check + notify before merge.

**Status:** ACTIVE, hardened. Per FD-21/FD-22 ship plan, the workflow is now considered acceptable for continued operation.

**Disposition:** No action owed. Future revisions in F-Deploy-1 Phase B/C if soak surfaces new issues.

#### §3.6.3 — `deploy-production.yml` workflow (PARTIALLY ADDRESSED)

**Surface:** GitHub Actions workflow at `.github/workflows/deploy-production.yml`.

**State:** Active. F-App-1 §12.15 and F-Stats-1 §12.19 documented two production-outage incidents traced to this workflow's interaction with prod EC2 PM2 state.

**Status:** PARTIALLY ADDRESSED. PM2 startup hardening (FD-9 H-1 recommendation to flip defaults to prod) was named in F-Deploy-1 Fix Plan but commitment-to-ship is contingent on Phase B G1 α/β decision. As of 2026-05-21, the workflow still has the unhardened PM2 restart logic.

**Disposition:** F-Deploy-1 Phase B/C territory. Not closed yet. PE #27 (smoke test accepts 502/503) also lives here — same workflow, separate finding.

#### §3.6.4 — Workflow notification and audit-trail mechanisms (PARTIAL)

**Surface:** Issue #708 — "Auto-merge -X ours incidents (running log)" — used as the notification target when `auto-merge-to-dev.yml` performs an `-X ours` merge.

**State:** Active. Issue #708 OPEN. Last updated 2026-05-18 (reopen comment). No incidents since reopening (soak day 1 / day 2 observable checks both clean).

**Status:** PARTIAL. The `-X ours` notification works (per FD-22 ship verification); other workflow-failure notification paths are not similarly instrumented.

**Disposition:** Future-revisit scope. If workflow failures or unexpected merges happen and aren't surfaced via existing notifications, the audit-trail surface needs expansion. Currently low priority — soak observable sweeps are the substitute audit-trail for now.

---

## §4 — Cross-category observations

### §4.1 — Distribution of finding states

Of the findings catalogued in §3 (2026-05-21 initial survey + 2026-05-22 follow-ups):

- **Closed:** 4 findings (loki removal §3.1.1; branch protection §3.3.1/2/3; F-Deploy-G1-Y §3.5.1; auto-merge.yml deletion §3.6.1)
- **Documented but no action owed:** 4 findings (extensions §3.1.2; Copilot Workspace §3.5.2; Claude Code §3.5.3; auto-merge-to-dev hardening §3.6.2)
- **Open (action owed):** 3 findings (stop hook §3.2.1; deploy hook noise §3.2.2; deploy-production hardening §3.6.3)
- **Partially investigated (2026-05-22):** 2 findings (workflow permissions §3.3.4; other PR-capable tools §3.5.4 — App identity inventory owed post-soak-close, filed as PE #59)
- **Reopened (2026-05-22):** 1 finding (§3.4.1 local-tooling identity drift — original 2026-05-21 closure invalidated; investigation of actual fix mechanism owed)
- **Not-yet-investigated:** 4 findings (extension trust framework §3.1.3; other git hooks §3.2.3; .gitconfig scope §3.4.2; env-var wrapper §3.4.3)

The cluster is **dominantly closed, documented-without-action, or partially-investigated.** Only 3 items have outstanding immediate action; 2 have post-soak-close action owed (web-UI App inventory); 1 has been reopened with investigation owed.

**2026-05-22 amendment:** Two items moved from not-yet-investigated to partially-investigated via PE #59 follow-up. **2026-05-22 reopening:** §3.4.1 reopened after full-history search invalidated the 2026-05-21 closure framing — squash-merge does NOT flatten local-tooling identity drift; the actual compensating mechanism is unidentified. The audit's future-revisit clause (§6.3 item 2 — "compensating control breaks") triggered for §3.4.1 itself; v11 §3.3.5 (compensating-control closure type) needs correction at v11 author session since its canonical example was based on the same invalid framing.

### §4.2 — Closure-semantic patterns observed

Findings in this cluster demonstrate three of the four closure types from v11 §3.3:

- **Gate closure:** §3.3.1 (branch protection FD-5 → FD-23 → FD-24)
- **Removal-sufficient:** §3.1.1 (loki extension), §3.5.1 (F-Deploy-G1-Y), §3.6.1 (auto-merge.yml)
- **Incident-driven (Path A):** §3.6.3 partially (PM2-startup defect was incident-driven via §12.15 and §12.19)

Supersession (§3.3.2 closure type) doesn't appear in this cluster — none of the tooling-environment work happened inline before a planned gate could execute.

### §4.3 — Compensating-control patterns

Two findings rely on *compensating controls* rather than direct fixes:

- §3.3.2 — `enforce_admins=false` compensated by JAWIHP's discipline + FD-5's "log admin bypasses in Decisions when invoked" policy
- §3.3.3 — `required_approving_review_count=0` compensated by status-checks coverage (Cost Exposure Audit + Tests + Route Validation)

Compensating-control closure is methodologically distinct from removal-sufficient or gate closure. The defect *capability* still exists; what's controlled is the *path to consequence*. If the compensating control breaks (the policy is violated, status checks become non-binding, etc.), the original defect re-emerges.

This pattern is worth flagging for v11 §3.3 vocabulary: **compensating-control closure** as a fifth closure type? Or fold into "removal-sufficient" with a note that the underlying capability isn't removed, just the path to consequence?

**2026-05-22 amendment (revised twice within the same day):** §3.4.1 (local-tooling identity drift) was originally listed here as a third compensating-control example with "squash-merge workflow flattening attribution" as the mechanism. 2026-05-22 morning amendment removed §3.4.1 from this list after full-history search showed `TySteamTest` attribution persists on squash-merge commits pre-2026-05-15. 2026-05-22 afternoon investigation re-closed §3.4.1 with the actual mechanism identified: the "TySteamTest" identity is a **GitHub App** performing workflow-driven squash-merges via the `auto-merge.yml` workflow (deleted 2026-05-15). The attribution is expected GitHub behavior, not drift, and was never a compensating-control closure. §3.4.1 stays removed from this list. The remaining two examples (§3.3.2, §3.3.3) are unaffected.

**Methodological implication (sharpened):** The §3.4.1 misclassification surfaces two discipline questions for compensating-control closure:

1. **How do you verify the compensating mechanism actually works before declaring closure?** §3.3.2 and §3.3.3 are verifiable by reading branch protection settings. §3.4.1's "compensating mechanism" was assumed (squash-merge flattening) and not verified — turned out to be wrong (squash-merge produces the attribution, doesn't mask it).
2. **How do you distinguish "compensating-control closure" from "miscategorized phenomenon"?** §3.4.1 was treated as a defect with a compensating control, when actually it was expected behavior misread as a defect. The discipline test: does the underlying capability actually produce a *harmful* consequence absent the control? If yes, compensating-control closure is correct. If no, the framing is wrong from start — the "defect" should be reclassified as "not a defect."

Future compensating-control closures should require: (a) verification step sampling the relevant surface across enough range, (b) explicit statement of what consequence the control prevents, and (c) confirmation that the consequence is actually harmful, not just unfamiliar behavior.

### §4.4 — Not-yet-investigated items by priority

The 3 remaining not-yet-investigated items have varying urgency (down from 5 — §3.4.2 and §3.4.3 closed 2026-05-22 by §3.4.1 closure):

| Item | Surface | Priority |
|---|---|---|
| §3.2.3 other git hooks in .git/hooks/ | One command to enumerate | Low — local-only |
| §3.1.3 extension trust framework | External (Microsoft marketplace controls) | Low — not actionable |
| §3.3.4 / §3.5.4 GitHub App + workflow permissions | One or two commands to enumerate | Medium — relevant to PR-capable-tool inventory; partially investigated 2026-05-22 |

The highest-priority not-yet-investigated item is **§3.3.4 / §3.5.4 — GitHub App and workflow permissions enumeration.** Partially investigated 2026-05-22 (PE #59 filed); App identity inventory owed post-soak-close via web-UI navigation. The §3.4.1 closure (corrected mechanism: GitHub App workflow attribution) makes this a higher-priority item than originally classified — confirming the App's identity matches `TySteamTest` would close out the remaining PE #58/#60 cross-reference uncertainty.

---

## §5 — What this audit does NOT do

- Does not fix any open items. §3.2.1 stop hook adjustment, §3.2.2 deploy hook noise, §3.6.3 deploy-production hardening remain owed.
- Does not investigate the 5 not-yet-investigated items. Survey methodology was "read existing audit history," not "run fresh investigation."
- Does not promote F-Tools-1 to keystone status. Future-revisit condition for promotion documented in front matter.
- Does not modify any existing audit documents (F-Deploy-1 Fix Plans, F-App-1, G1 Audit, etc.). Cross-references only.
- Does not address production runtime tooling (PM2, nginx, application code). Out of scope per §1.

---

## §6 — Disposition and ship plan

### §6.1 — Local-state status

This audit document is local-state, queued for ship at v11 author session post-soak-close (~2026-05-26). Lives alongside:

- F-Stats-1 Phase B G1 Planning four-amendment revision + §6.5 NAT sub-amendment
- Session_PE_Roster.md with PE #50–#58 (PE #57 with two same-day amendments; PE #58 closed)
- v11 §3.3 closure-semantic vocabulary expansion
- v11 session brief outline `.md` and `.docx` with §3.4–§3.7 additions
- F-AUTH-1 §5.1 pre-flight grep script v2 + deliverable v2
- F-Deploy-G1-Y Postmortem
- This document (`F-Tools-1_Tooling_Environment_Audit.md`)

### §6.2 — Cross-references owed during v11 authoring

When v11 ships, it should:

- Reference this audit document in §3 (What v10 got wrong/missed) — as the comprehensive baseline for tooling-environment-integrity that v10 didn't establish.
- Reference §4.3 (compensating-control patterns) in §3.3 closure-semantic vocabulary expansion — consider whether to add "compensating-control closure" as fifth closure type.
- Reference §3.3.2 / §3.3.3 in the Decision #9 reconciliation (v11 §3.5) — corroborates the corrected PE #57 framing.
- Reference §3.4.1 in §3.6 (local-tooling identity drift) — the PE #58 closure narrative is captured in detail here.

### §6.3 — Future-revisit triggers

This document should be revisited if any of the following:

1. **Multiple new tooling-environment findings filed within 30-90 days** — promote to keystone, this doc becomes §1 of the keystone scope.
2. **Compensating control breaks** — squash-merge workflow change, GitHub permissions model change, etc. Re-survey affected categories.
3. **New contributors join the repo** — solo-dev rationale for §3.3.2 / §3.3.3 needs revisiting.
4. **F-Deploy-G1-Y recurrence** — re-open §3.5 PR-capable-tool inventory.
5. **GitHub Actions or branch protection model changes** — re-survey §3.3 / §3.6.

---

*End of F-Tools-1 Tooling Environment Audit. Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni. Date: 2026-05-21 (F-Deploy-1 Phase A G4 soak day 2 of 7). One-time survey deliverable. Local-state until v11 ship at soak close. Future-revisit triggers documented in §6.3.*
