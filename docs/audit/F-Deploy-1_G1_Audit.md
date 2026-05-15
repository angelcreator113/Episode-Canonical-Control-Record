# F-Deploy-1 G1 Audit Report

**Deploy pipeline + autonomous-merge failure-mode audit**

| | |
|---|---|
| **Plan reference** | F-Stats-1 Fix Plan v1.2 Decision #8, Decision #9 (F-Deploy-1 promoted post-Phase-A) |
| **Date started** | 2026-05-15 |
| **Auditor** | JustAWomanInHerPrime (JAWIHP) / Evoni, with assistant |
| **Repo HEAD at audit start** | `742c66b6` (F-Stats-1 plan v1.2 §12.20 + Decision #9 commit) |
| **Status** | IN PROGRESS |

---

## §1 Audit Method

**TODO** - describe the failure-mode-first investigative approach (vs F-AUTH-1/F-Stats-1/F-App-1's per-file enumeration approach). Explain why F-Deploy-1 doesn't have a single "surface" to enumerate - instead we trace failure events to their sources, then group sources into sub-forms.

---

## §2 Failure Events (chronological)

Each event is a real production-affecting incident that surfaced over the past week. Trace each to its source files and configuration.

### §2.1 F-App-1 May 14 ~06:00 UTC outage - PM2 stopped, ~50min

**TODO** - full event reconstruction from F-Stats-1 plan v1.2 §12.15. Workflow that fired, step that failed, recovery path, root cause class.

### §2.2 F-Stats-1 G2 May 14 ~17:30 UTC outage - PM2 wrong-port, ~10min

**TODO** - full event reconstruction from F-Stats-1 plan v1.2 §12.19. Same incident class as §2.1 but different failure mode. The `--env production` flag was missing.

### §2.3 May 14 evening - PR #685 auto-merge

**TODO** - when did PR #685 (the original Session PE Roster PR) merge to main, and what triggered the auto-merge? Was this a workflow firing or a manual click? Needs investigation.

### §2.4 May 14 night - PRs #688, #689 from backup branches

**TODO** - backup branches `claude/session-pe-roster-backup` and `claude/f-stats-1-phase-b-g1-planning-backup` were pushed, then PRs auto-opened, then auto-merged via `gh pr merge --squash --auto`. The PR-opening mechanism is unknown.

### §2.5 May 14-15 - TySteamTest identity attribution

**TODO** - commits made by local tooling were attributed to `TySteamTest <130309211+TySteamTest@users.noreply.github.com>` despite global `git config user.email` being set to Evoni's email. Suggests env var or wrapper layer beyond `git config`.

### §2.6 May 15 ~12:30 UTC - Dev deploy failure

**TODO** - Deploy-to-Development workflow failed with two distinct errors: (a) migration `20260718000000-create-episode-scripts-and-feed-posts` failed with `ERROR: column "version" does not exist`; (b) `episode-api` boot threw `ERR_ERL_KEY_GEN_IPV6` ValidationError from `express-rate-limit`. PM2 status showed "online" but route verification failed. PE #41 reclassified P2->P0, PE #48 filed.

---

## §3 Per-File Analysis

### §3.1 `auto-merge-to-dev.yml`

**TODO** - what does this workflow do, what triggers it, what's its full step list, what failure modes are documented or observed. Reference the surgical-fix history (commit `d0a36c6b` then `e0c0a0cc`).

### §3.2 `auto-merge.yml`

**TODO** - the 525-byte workflow that fires on `pull_request: [opened, synchronize]` and runs `gh pr merge --squash --auto`. Suspected source of the auto-merge behavior in §2.3 and §2.4. Verify trigger conditions.

### §3.3 `deploy-dev.yml`

**TODO** - the 20,588-byte deploy workflow that runs on push to `dev`. Full step-by-step trace. Identify the steps that failed in §2.1, §2.2, §2.6.

### §3.4 `deploy-production.yml`

**TODO** - manual-trigger-only (verified earlier). 16,926 bytes. Document the trigger conditions and the deploy steps. Identify whether the PM2 wrong-port / missing `--env production` patterns from §2.2 also exist in this workflow.

### §3.5 PM2 ecosystem config (`ecosystem.config.js`)

**TODO** - read the ecosystem file. Document the `env_*` blocks, the port configuration (3000 vs 3002), the cluster vs fork modes, and any per-environment differences.

### §3.6 Branch protection state on `main`

**TODO** - current state per `gh api repos/...`. Per May 12 session resume: "0 required reviewers on main per gh api inspection" - meaning admin-bypass is implicit, no PR review required. Confirm current state and document.

### §3.7 Local git/tooling identity environment

**TODO** - investigate the TySteamTest attribution mystery from §2.5. Check `GIT_AUTHOR_EMAIL`, `GIT_COMMITTER_EMAIL` env vars, VS Code extension settings, Copilot agent configuration. Determine why local tooling commits don't inherit the global `git config` identity.

---

## §4 Sub-form Classification

Group findings from §2-§3 into fixable units. Each sub-form is a coherent piece of work that could be a Phase B PR or its own keystone.

**TODO** - draft sub-forms after §2-§3 are filled in. Initial expectation based on Decision #9:

- **Sub-form A** - Auto-merge mechanism (workflows + PR-opening behavior)
- **Sub-form B** - Deploy-dev workflow safety (PM2, migrations, error handling)
- **Sub-form C** - Branch protection on main + admin-bypass policy
- **Sub-form D** - Local-tooling identity drift

---

## §5 Recommended Fix-Plan v1.0 Structure

**TODO** - propose the F-Deploy-1 fix plan shape. Likely structure:

- Phase A: Audit (this doc) + immediate safety fixes
- Phase B: Per-sub-form execution PRs (analogous to F-Stats-1 Phase B)
- Phase C: Soak + verification

Estimate gates per phase. Identify what unblocks Phase B (per F-Stats-1's gate sequence pattern).

---

## §6 Gate A-G1 Closure Criteria

Per F-AUTH-1 / F-Stats-1 G1 closure precedent:

- [ ] All §2 failure events fully reconstructed with file:line references
- [ ] All §3 files read end-to-end and documented
- [ ] §4 sub-form classification complete
- [ ] §5 fix-plan structure proposed
- [ ] Audit committed to `docs/audit/F-Deploy-1_G1_Audit.md`
- [ ] Fix Plan v1.0 authored (separate gate)

**Gate A-G1 is incomplete until all checkboxes above are confirmed.**

---

## §7 Next Action

After this stub commits: begin **§3.3 `deploy-dev.yml` full trace.** This file is the highest-value entry point - §2.1, §2.2, and §2.6 all originated from it. Reading it carefully should surface concrete sub-form B scope and reveal whether the PM2 wrong-port pattern (§2.2) is fixed in the post-incident code or still present.

- end of stub -
