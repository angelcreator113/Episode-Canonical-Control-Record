# F-Deploy-1 Fix Plan v1.1

**Gate A-G1 closure — pre-flight walked, evidence documented, three new decisions locked**

| | |
|---|---|
| **Predecessor** | `docs/audit/F-Deploy-1_Fix_Plan_v1.0.md` (main) — canonical for §1-§10; v1.1 additive only |
| **Walk session** | 2026-05-16 evening EDT |
| **Walked by** | JAWIHP + Claude (single session) |
| **Plan reference branch** | `claude/f-deploy-1-fix-plan-v1-1` (proposed) |
| **Status** | DRAFT v1.1 — additive on v1.0 |
| **Scope** | Gate A-G1 closure record + 3 new locked decisions (FD-13, FD-14, FD-15) + 2 registry updates |

---

## §1 What v1.1 does and doesn't do

### §1.1 What v1.1 does

- Records Gate A-G1 pre-flight walk results from 2026-05-16 evening session.
- Locks three new decisions (FD-13, FD-14, FD-15) building on v1.0's FD-1 through FD-12.
- Updates the F-Deploy-G1 findings registry with one line-reference correction and one new candidate (F-Deploy-G1-AB).
- Locks Phase B §6.7 scope narrowing per FD-15.

### §1.2 What v1.1 does not do

- Does not modify v1.0's §1-§10. Those sections remain canonical.
- Does not modify v1.0's Decisions FD-1 through FD-12. Those stay locked at v1.0.
- Does not commit Phase A G2 scope changes — Phase A G2 is the next gate after this revision lands.
- Does not pre-empt the sub-form D diagnostic outcome — captures the inventory only.
- Does not author the F-Deploy-G1-AB finding's full investigation — defers to Phase B G1.

### §1.3 Why v1.1 exists

Per v1.0 §1.3: *"the fix plan author should treat §5 as a starting frame, not as constraints. If the architectural picture clarifies during fix planning and a different phase structure fits better, deviate. Document the deviation in Fix Plan v1.0's Decisions section."* And per v1.0 §4.7: *"If any §4.x step surfaces drift requiring rescoping, address in this plan (revising v1.0 → v1.1 with deviation notes per §1.3) before Phase A G2 begins."*

Pre-flight walk surfaced findings requiring rescoping. v1.1 is the named revision.

---

## §2 Gate A-G1 closure record

The pre-flight gate closes per v1.0 §4.7 criteria: six steps, six evidence artifacts, no drift handling left open.

### §2.1 §4.1 — G1 audit PR state

| Verification | Result |
|---|---|
| G1 audit content on main | ✅ PR #698 merged 2026-05-16, commit `9adab62e` |
| Fix Plan v1.0 on main | ✅ PR #699 merged 2026-05-16, commit `033ac817` (PR title "Claude/f deploy 1 g1 audit" is auto-derived from branch and misleading — actual content is the Fix Plan; filing as housekeeping observation in §5) |
| No rogue `f-deploy-1` branches | ✅ `git branch -r | Select-String "f-deploy-1"` returned empty |
| No open `f-deploy-1` PRs | ✅ `gh pr list --search "f-deploy-1" --state open` returned empty |
| Autonomous-PR-cascade recurrence post-2026-05-15 containment | ✅ None. PR #692 incident bounded by revert `bc50ba81` + `auto-merge.yml` deletion `1b3a02b3`. No recurrence since. |

**Disposition:** closes clean. No drift.

### §2.2 §4.2 — Branch protection current state

`gh api .../branches/main/protection` returned:

| Setting | v1.0 §4.2 expected | Actual | Match |
|---|---|---|---|
| `required_pull_request_reviews.required_approving_review_count` | 0 | 0 | ✅ |
| `required_status_checks` | absent or null | **not present in response** | ✅ |
| `enforce_admins.enabled` | false | false | ✅ |
| `required_signatures.enabled` | false | false | ✅ |
| `allow_force_pushes.enabled` | false | false | ✅ |
| `allow_deletions.enabled` | false | false | ✅ |

**Disposition:** closes clean. No drift. Branch protection state on main is exactly as G1 §3.6.1 documented; **FD-5 has not yet shipped**. The `Validate` workflow runs on PRs but is NOT a `required_status_check` — passing or failing it does not gate merges. v10 handoff memory wording "FD-5 observed functioning in production" is overstated and corrected in §5 housekeeping.

### §2.3 §4.3 — auto-merge-to-dev.yml live state

Full file read. Key sections match v1.0 §4.3 expected state:

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

Plus the merge logic uses `-X ours` strategy with inline rationale comment explaining intentional design. Frontend build verification is present and gated on `frontend/` paths actually changing. Backend build verification is **not** present. PR-comment notification on `merge_type=conflicts-resolved` is **not** present.

**Disposition:** closes clean. **FD-4 Changes A-2.2 (backend build) and A-2.3 (notification) confirmed not-yet-shipped, as expected** — these are Phase A G2 work, not pre-flight expectations.

### §2.4 §4.4 — Local environment snapshot (sub-form D pre-baseline)

Five sub-checks ran:

| Check | Result |
|---|---|
| Git config sources | `user.name=Evoni`, `user.email=evonifoster@yahoo.com`, both from `C:/Users/12483/.gitconfig` (global only, no repo-local override) |
| GIT_AUTHOR_* / GIT_COMMITTER_* env vars | All four unset |
| Local hooks | `.git/hooks/` contains only `.sample` files (no active hooks) |
| VS Code extensions | 80 extensions installed; relevant subset enumerated below |
| Recent commit attribution (last 20) | `evonifoster@yahoo.com` consistent; author names split between `angelcreator113` (GitHub-side squash commits, expected behavior) and `Evoni` (local commits, from gitconfig); legacy `TySteamTest` attribution at `2283fdd6` is the original §2.5 incident commit and not recurrence |

**VS Code extensions — F-Deploy-G1-Y candidate inventory:**

| Extension | Relevance |
|---|---|
| `anthropic.claude-code` (4 version-stamped folders: 2.1.140, .141, .142, .143) | **Direct evidence — Claude Code IS installed as VS Code extension**, not just CLI tool as v10 brief implied. Extension form can interact with Git/GitHub through VS Code APIs. Strong F-Deploy-G1-Y candidate. |
| `github.copilot-chat` 0.48.1 | Copilot Chat (not Copilot Workspace). Less likely to be the autonomous-PR mechanism. |
| `github.vscode-pull-request-github` | **NOT installed.** v10 Decision #104 listed this as one of two leading candidates ("Create on Publish Branch" feature). This candidate is now eliminated. |
| `automatalabs.copilot-mcp` 0.0.92 | MCP integration for Copilot — possibly related to Copilot Workspace mechanics. Candidate. |
| `danielsanmedium.dscodegpt` 3.18.0 + 3.20.6 | Third-party AI assistant (CodeGPT). Two versions installed. Could autonomously interact with Git/GitHub. New candidate not in v10. |
| `loki-laufeyson.intelligent-assistant` 1.0.9 | Third-party "intelligent assistant" extension, unknown publisher. New candidate not in v10. |

The remaining 74 extensions are framework, language, AWS, Azure, and database tooling — none implicated in autonomous-PR opening.

**Notable absence:** No `code-insiders` installation. The regular `code` (Code.exe at `C:\Users\12483\AppData\Local\Programs\Microsoft VS Code\`) is the only VS Code on the system. The CLI `--list-extensions` returned empty because it was invoked against the GUI executable; the disk inventory at `%USERPROFILE%\.vscode\extensions\` is the authoritative source.

**Disposition:** closes with significant reshape of sub-form D candidate space. Locked at FD-14 below. Per v1.0 §4.4 drift handler, no modifications made — diagnostic-phase intact. Phase A G3 diagnostic now has a wider, more specific candidate inventory than v10 documented.

### §2.5 §4.5 — F-Deploy-G1-T resolver

Read `.github/scripts/deploy-production.sh` (full content + targeted grep on `pm2 start|--env`).

**Result:**

```bash
# Line 231-232 (primary production start path):
pm2 start ecosystem.config.js --only episode-api --env production --update-env
pm2 start ecosystem.config.js --only episode-worker --env production --update-env

# Line 242, 244 (fallback when ecosystem.config.js missing):
pm2 start src/server.js --name episode-api --env production
pm2 start app.js --name episode-api --env production
```

All four PM2 start invocations pass `--env production` correctly. Per v1.0 §4.5 disposition table:

> Script passes `--env production` to `pm2 start` → T resolved as "prod-side mechanism is safe; F-Deploy-G1-H is dev-side only" → §6.7 narrows: only the ecosystem.config.js default-port question needs treatment.

**Disposition:** F-Deploy-G1-T resolves as **disposition (a) — clean**. Phase B §6.7 narrows per FD-15 below.

**Additional findings from the read (not in v1.0 scope, filed as observations):**

- **Lines 236-237** — the production deploy script **also starts dev processes** (`episode-api-dev`, `episode-worker-dev`) on the same EC2. This is mechanical confirmation of F-Deploy-G1-G (shared-EC2 design). Comment at line 235: "Also ensure dev processes are running (port 3002 for dev.primepisodes.com)." This is intentional design per the script itself, not accidental shared-hosting. **Strong evidence input for FD-8 sub-form B architectural decision** (separate-EC2 α vs shared-safe β), to be considered at Phase B G1.
- **Lines 240-244** — fallback path if `ecosystem.config.js` is missing only starts `episode-api` (no worker). Silent degradation. Phase B observation, not Phase A blocker.
- **Lines 18-27** — defensive `.env` validation: deploy blocks if required keys missing OR if values match `^REPLACE_WITH` placeholder pattern. Atomic with the deploy. **Positive precedent (P-Pos candidate)** for the fix-plan-build pattern catalog.

### §2.6 §4.6 — G1 file:line reference drift check

Three grep checks:

| Check | Surface | v1.0 §4.6 expected (per G1 narrative) | Actual | Status |
|---|---|---|---|---|
| 1 | `auto-merge-to-dev.yml` trigger block | lines 1-8 | lines 3-8 | ✅ within ±5 |
| 2 | `deploy-dev.yml` migration handling | ~line 290-292 | **lines 411-470** for the `MIGRATION_FAILED`/sequelize-cli block | ⚠️ ~120 lines deeper; **content matches G1 §3.3.3 exactly**; line numbers drift |
| 3 | `ecosystem.config.js` env blocks | per G1 §3.5.1 | lines 83, 89-95 (episode-api dev default + env_production); lines 118, 141, 144 (episode-worker parallel structure) | ✅ no drift |

**New finding surfaced by Check 2:** `deploy-dev.yml` contains **two distinct migration mechanisms**:

- **Path 1 (lines 54-55):** `- name: Run database migrations` / `run: npm run migrate:up` — no explicit error handling in the workflow YAML. Whether failure stops the job depends on `npm run migrate:up` exit code semantics and step-level `continue-on-error`.
- **Path 2 (lines 411-470):** `npx sequelize-cli db:migrate --env development` wrapped in `if !`...`then MIGRATION_FAILED=true; fi`, with conditional reporting at lines 469-470 and a success-claiming summary at line 483 that doesn't gate on `$MIGRATION_FAILED`. This is F-Deploy-G1-C as documented.

G1 documented only Path 2. Path 1 is a separate, previously-undocumented surface. Either:

- Path 1 and Path 2 both fire on every deploy (migrations run twice — efficiency concern)
- One is conditional on workflow input we haven't traced
- Path 1 is the actual primary path and Path 2 is legacy/dev-only

Filed as **F-Deploy-G1-AB candidate** in registry update §3 below.

**Disposition:** closes with two registry updates:
- F-Deploy-G1-C location reference corrected (lines 411-470, not ~290)
- F-Deploy-G1-AB registered as P1 candidate, investigation deferred to Phase B G1

### §2.7 Gate A-G1 closure

Six steps, six evidence artifacts, no drift handling left open. Per v1.0 §4.7 criteria, **Gate A-G1 closes**. Locked at FD-13 below.

Two of the six steps surfaced findings significant enough to merit named decisions:
- §4.4 → FD-14 (candidate space reshape)
- §4.5 → FD-15 (F-Deploy-G1-T disposition + §6.7 narrowing)

§4.6 surfaced a registry update but no architectural decision change.

The remaining three steps (§4.1, §4.2, §4.3) closed clean without findings requiring decisions.

---

## §3 New decisions locked at v1.1

### FD-13 — Gate A-G1 closes

Gate A-G1 (pre-flight inventory) closes per v1.0 §4.7 criteria. Six evidence artifacts documented at §2.1-§2.6. No drift handling left open. Phase A G2 is now the next executable gate.

Phase A G2 scope per v1.0 §5.1-§5.2 unchanged. Decisions FD-1 through FD-12 from v1.0 carry forward. Execution begins after v1.1 lands on main.

### FD-14 — F-Deploy-G1-Y candidate space revised

v10 Audit Handoff Decision #104 narrowed F-Deploy-G1-Y to two confirmed-present tools (Copilot Workspace + Claude Code as CLI). Pre-flight inventory (§2.4) refines this:

**Eliminated candidates:**
- `github.vscode-pull-request-github` — NOT installed on Evoni's local. v10 brief's leading candidate for the "Create on Publish Branch" mechanism is invalid.

**Confirmed candidates with new evidence:**
- **Claude Code as VS Code extension** (`anthropic.claude-code`, four version folders installed). Not just CLI — extension form has direct VS Code Git/GitHub API access. **Stronger candidate than v10 documented.**
- **Copilot Workspace** — local branch `copilot/worktree-2026-03-11T12-57-09` confirms presence, but no dedicated VS Code extension found; mechanism may be web-side or separate-app.

**New candidates added:**
- `automatalabs.copilot-mcp` 0.0.92
- `danielsanmedium.dscodegpt` (two versions installed)
- `loki-laufeyson.intelligent-assistant` 1.0.9

**Phase A G3 diagnostic question** (v1.0 §5.3) updated:
- Previous (v1.0/v10): "Which tool's normal operation produces F-Deploy-G1-Y behavior?"
- Revised (v1.1): "Given the inventoried candidate set — Claude Code extension, Copilot Workspace, copilot-mcp, dscodegpt, intelligent-assistant — which one's normal operation produces PRs without explicit `gh pr create`, and what user action triggers that operation?"

Disposition outcome (close as identified / narrow but residual) remains deferred to Phase A G3 per v1.0 §5.3. v1.1 captures inventory; does not conclude diagnostic.

### FD-15 — F-Deploy-G1-T disposition (a); Phase B §6.7 narrows

Per §2.5 read of `.github/scripts/deploy-production.sh`, F-Deploy-G1-T resolves as disposition (a):

> Prod-side mechanism is safe; F-Deploy-G1-H is dev-side only.

**Phase B §6.7 (Fix Plan v1.0) scope narrows:**

- Previous (v1.0): §6.7 had to address either dev-only or bilateral F-Deploy-G1-H mechanism depending on disposition.
- Locked (v1.1): Only the ecosystem.config.js default-port question (FD-9 Option H-1) needs treatment in §6.7. No edit to `deploy-production.sh` required for the prod-side mechanism.

FD-9's recommendation (flip ecosystem.config.js defaults to prod) remains contingent on Phase B G1's α/β decision per v1.0 §6.1.

**Side observation locked here for §6.7 implementation:** Per §2.5, both `episode-api` and `episode-worker` follow the same dev-default → production-override pattern in ecosystem.config.js (parallel structure at lines 83-95 and 118-144). If FD-9 ships as Option H-1, both apps need the flip — not just episode-api. Worth confirming at Phase B G1 commitment.

---

## §4 Registry updates — F-Deploy-G1 findings

Two updates to v9 Audit Handoff §11.5 / v1.0 §12 Appendix A.

### §4.1 F-Deploy-G1-C — line reference correction

| Field | Previous (v9 §11.5 / G1 §3.3.3) | Corrected (v1.1) |
|---|---|---|
| Subject | Non-fatal migration handling — `MIGRATION_FAILED=true` continues to PM2 restart | unchanged |
| Severity | P0 | unchanged |
| Phase | Phase B / sub-form B | unchanged |
| Location | `deploy-dev.yml` ~line 290 | **`deploy-dev.yml` lines 411-470** |

Content matches G1's narrative exactly. Line numbers drift by ~120 lines. Per v1.0 §4.6 drift handler, re-located the surface; v1.1 documents the new file:line. Phase A G2 commits against deploy-dev.yml should reference the corrected lines.

### §4.2 F-Deploy-G1-AB — new finding candidate

| Field | Value |
|---|---|
| ID | F-Deploy-G1-AB |
| Severity | **P1** (candidate; finalize at Phase B G1) |
| Phase | Phase B / sub-form B (provisional) |
| Surface | `deploy-dev.yml` lines 54-55 |
| Content | `- name: Run database migrations` / `run: npm run migrate:up` — no explicit error handling in workflow YAML |
| Status | New, candidate |
| Disposition | Investigate at Phase B G1: is this duplicate-migration (path runs twice with Path 2 at lines 411-470), conditional, or the actual primary path? If duplicate: efficiency concern, deploy time impact. If primary and Path 2 is legacy: F-Deploy-G1-C may need re-scoping. |

Per v9 §11.5 follow-up note, the registry can extend with F-Deploy-G1-AB and subsequent IDs as findings surface. This is the second post-G1 registry addition (first being the deferred legacy table-creation path note).

---

## §5 Housekeeping observations (non-decisional)

Three observations from the pre-flight session worth filing but not requiring named decisions:

### §5.1 Memory entry #26 correction

The userMemories entry added at v10 session end ("FD-4 + FD-5 observed functioning on PR #701 v10 merge — first live exercise") slightly overstated FD-5. **FD-4 was observed:** `auto-merge-to-dev.yml` ran successfully on PR #701 / #702 and merged the branches to dev as designed. **FD-5 was NOT observed:** the `Validate` workflow ran and passed, but per §2.2 read, `required_status_checks` is absent from main's branch protection — `Validate` is a workflow that runs, not a gate that blocks. FD-5's implementation (adding `Validate` as a required check) is still Phase A G2 work.

Memory correction at session end: revise entry #26 to "FD-4 observed functioning on PR #701/#702 v10 merge; FD-5 not yet shipped (required_status_checks still absent on main per pre-flight §2.2)."

### §5.2 PowerShell + emoji rendering hazard

Two files in scope of Phase A and Phase B contain UTF-8 emoji (✅ ⚠️ ❌ 🔨 🗃️ 🚀 etc.) that break PowerShell's standard rendering. Affected files observed during pre-flight:
- `.github/workflows/auto-merge-to-dev.yml`
- `.github/scripts/deploy-production.sh`

`Get-Content` and `Select-String` will truncate output mid-emoji on PowerShell Core / Windows PowerShell. Workaround: `code <file>` and read in VS Code, OR `[System.IO.File]::ReadAllText($path, [System.Text.Encoding]::UTF8) -replace '[^\x00-\x7F]', '?'`.

Phase B housekeeping consideration: emoji removal from workflow files would eliminate this rendering hazard for terminal-based inspection. Replacement pattern: ASCII status words ("OK", "WARN", "FAIL"). Not a Phase A blocker; not in F-Deploy-G1 finding scope. Low-priority cleanup for whenever Phase B touches these files anyway.

### §5.3 PR #699 title discoverability

PR #699 squash-merged on main as `033ac817` with title "Claude/f deploy 1 g1 audit." Title was auto-derived from branch name `claude/f-deploy-1-g1-audit` and not edited at PR creation. The actual content is Fix Plan v1.0 (`F-Deploy-1_Fix_Plan_v1.0.md`).

Future archaeology searching for "Fix Plan v1.0" in commit history won't find #699 by title. Not fixable now (squash commit titles are immutable post-merge), but worth knowing. For future PR creation, the body of v1.1's PR should explicitly reference v1.0's PR #699 commit `033ac817` so search-by-content finds the link.

---

## §6 What v1.1 unlocks

With Gate A-G1 closed (FD-13), Phase A G2 becomes the next executable gate. Per v1.0 §5.1.2, Phase A G2 is the implementation of sub-form A + sub-form C changes:

- **PR A-1** (~20-40 LOC) — `auto-merge-to-dev.yml` opt-out label/sentinel (FD-4 Change A-2.1). Closes F-Deploy-G1-P.
- **PR A-2** (~15-25 LOC) — `auto-merge-to-dev.yml` backend build verification (FD-4 Change A-2.2). Closes F-Deploy-G1-R.
- **PR A-3** (~20-30 LOC) — `auto-merge-to-dev.yml` `-X ours` notification (FD-4 Change A-2.3). Partial-close on F-Deploy-G1-Q.
- **Branch protection update** — apply FD-5 minimal real gate (`required_status_checks: [Validate]`, zero required reviews, `enforce_admins: false`). Closes F-Deploy-G1-V/W/X.

Per v1.0 §5.1.2 caveat: PR A-1 may not fit the new opt-out rules it introduces; plan accordingly during G2 (probably ship A-1 via manual merge to dev, document in §11 Decisions).

After G2 ships and Phase A G3 (sub-form D diagnostic) completes, Phase A G4 (1-week soak per FD-10) begins. After Phase A G4 soak, Phase B G1 (architectural decision: α vs β per FD-8) becomes available, drawing on inputs from FD-15 evidence (§2.5 — deploy-production.sh starts dev processes intentionally) and FD-14 (sub-form D inventory).

---

## §7 Closure note

v1.1 is a minimal additive revision. v1.0 sections §1-§10 remain canonical and unchanged. v1.1 captures one closed gate (A-G1), three new decisions (FD-13, FD-14, FD-15), two registry updates (F-Deploy-G1-C correction, F-Deploy-G1-AB new), and three housekeeping observations.

Path A discipline holds: gate walked, evidence documented, deviations surfaced as named decisions before any Phase A G2 commit. The pre-flight is the gate; closure is the lock; v1.1 is the record.

Next session: Phase A G2 begins with PR A-1 (auto-merge-to-dev.yml opt-out label/sentinel design + implementation). Per Rule 7, PR A-1 design draft → confirm → implement.

---

*End of Fix Plan v1.1. Authored 2026-05-16 by Claude in session with Evoni, immediately following Gate A-G1 pre-flight walk. v1.0 remains canonical for §1-§10; v1.1 is additive on the deltas above.*
