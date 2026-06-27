# Session Handoff — 2026-06-27

**Status:** Incident contained. P0 mitigated. DO NOT start work without reading this.

---

## CRITICAL: CI STATE DIVERGENCE

`auto-merge-to-dev.yml` and `deploy-dev.yml` are **DISABLED** via GitHub Actions UI
(2026-06-27). The workflow *files* on disk look intact and unchanged — do not trust
them as evidence the pipeline is live. Before any session, verify:

    gh workflow list --all

Must show both as `disabled_manually`. If either shows `active`, stop and assess
before pushing anything to a `claude/**` branch.

**Re-enable preconditions (ALL must be met before re-enabling):**
1. Fix deploy-dev.yml structural flaw: `bootstrap-sequelize-meta.js` has no error
   handler; a bootstrap failure exits under `set -eo pipefail` after `pm2 stop all`
   already ran, leaving production stopped. Migration step has a soft-fail handler
   (`MIGRATION_FAILED=true`); bootstrap needs equivalent, or PM2 restart must be
   wrapped in `trap ... EXIT` so it runs unconditionally.
2. Evaluate `DEV_DB_PASSWORD` GitHub Secret independently. Do NOT update it simply
   to make the deploy work — that writes the current canon credential into CI, which
   is wrong during an active freeze. Evaluate at re-enable time when continuous
   deploy is actually wanted.
3. Freeze must have lifted and continuous-deploy must be explicitly intended.

---

## Box State (confirmed at session close, 2026-06-27 ~13:01 UTC)

| id | name                    | mode    | port | status  | notes                                        |
|----|-------------------------|---------|------|---------|----------------------------------------------|
| 0  | episode-api             | cluster | 3002 | online  | DB connected (fixed this session — see trap) |
| 1  | episode-worker          | fork    | —    | online  | DB connected (fixed this session — see trap) |
| 3  | episode-api-prod-hotfix | fork    | 3000 | online  | DB connected, healthy — LIVE SERVE           |
| 4  | episode-api-parallel    | fork    | 3003 | stopped | --no-autorestart; tree intact                |

**PM2-stored-env rotation trap (root cause not fixed):** id 0 and id 1 had been
database-disconnected since a prior password rotation. PM2 caches `DB_PASSWORD` in
its stored-env snapshot at first start; `dotenv.config()` will not override an
already-set env var, so any `pm2 restart` reloads the cached stale password silently.
Fixed this session via `pm2 startOrRestart ecosystem.config.js --only <name>`, which
re-parses the ecosystem config (calls `dotenv.config()` before `sharedEnv` builds)
and injects the current `.env` password. **The structural trap is not fixed: any
future DB password rotation will silently disconnect any PM2 process not subsequently
restarted via `startOrRestart ecosystem.config.js`. This will recur on every rotation
unless PM2 startup is changed to always re-read `.env` at restart.**

id 4 (parallel): parallel tree `/home/ubuntu/episode-metadata-parallel/` is intact
on disk (P1-P5 executed, `.env` symlinked to serving tree, node_modules present).
Process is stopped and held — `--no-autorestart`. Phase 2A construction is complete;
the process was stopped by the CI/CD incident this session and not restarted.

---

## P0 — Deploy Automation (mitigated, deferred fix)

**What happened:** Any push to a `claude/**` branch triggered `auto-merge-to-dev.yml`,
which merged the branch into `dev`. That triggered `deploy-dev.yml`, which:
1. Ran `pm2 stop all || true` unconditionally before uploading the tarball
2. Deployed code
3. Ran `node scripts/bootstrap-sequelize-meta.js` (no error handler) — FAILED with
   `password authentication failed` because GitHub Secret `DEV_DB_PASSWORD` is stale
   (never updated post-FD-40 rotation)
4. `set -eo pipefail` exited the SSH session before reaching PM2 restart
5. Production stayed stopped

Triggered twice this session: once for the AG-gate finding branch, once for the
construction spec branch. Both deploys failed at bootstrap; both left all processes
stopped. id 3 was recovered first (canon-confirmed before proceeding to id 0/id 1).

**Mitigation:** Both workflows disabled via `gh workflow disable` on 2026-06-27.
Chain is dead. `claude/**` pushes arm nothing.

**Also discovered:** `auto-merge-to-dev.yml` resolves conflicts via `git merge -X ours`
(dev wins, feature branch conflicting hunks silently discarded). Notification only
via comment on issue #708. Check #708 for new comments after any future `claude/**`
push to confirm no content was discarded on dev. This session's two merges were clean
(#708 had no new comments, confirmed by live read).

---

## Security Finding (POINTER ONLY — do not restate value here)

A production DB credential (pre-FD-40 rotation value) was exposed in cleartext during
incident diagnosis on 2026-06-27. Appears in this session's transcript and SSH tool
log chain. Bash history on box was cleared (partial mitigation only — transcript/logs
persist; clearing bash history is not the remediation).

**Evidence of deprecation (partial, not confirmed):** The RDS actively rejected id 0's
stale stored-env password. By timeline reasoning that stored value is likely the same
pre-rotation credential as the leaked transcript value — but this is inference from
timestamps, not a direct test of the leaked value itself. Treat as
*likely-deprecated, not confirmed-deprecated*.

**Open check — explicitly not closed:** SSM parameter history, version 1 (pre-FD-40
snapshot, written 2026-06-14). Has not been verified live. The leaked value may or may
not appear in SSM v1. Method: read SSM parameter version list with timestamps and
dates only — no value output needed. Do not treat the finding as closed until this is
run and (if any doubt remains) a direct auth probe confirms rejection.

**Action if any doubt:** treat as compromised, rotate again.

---

## Open Items (prioritized)

**[BLOCKED until P0 fix]**
- Construction spec PR: commit `880c8dd7` on remote branch
  `claude/f-deploy-1-phase2a-construction-spec-2026-06-27`, no PR opened.
  *(SHA as of this session — verify live: `git log origin/claude/f-deploy-1-phase2a-construction-spec-2026-06-27 --oneline -1`)*
  Do NOT open PR until workflows are re-enabled safely.
- Sec5 evidence note: `docs/audit/F-Deploy-1_2026-06-26_Sec5_ReVerify_Evidence.md`
  — untracked locally, never committed. Safe from `git checkout`; will not survive
  `git clean -fd`.
- PR #871 (AG-gate finding): OPEN, not merged. Commit `52360a2e` on remote branch
  `claude/f-deploy-1-ag-gate-quiescence-finding-2026-06-27`.
  *(SHA as of this session — verify live before relying on it.)*
  Leave open; do not merge until pipeline is safe and P0 is resolved.

**[SECURITY]**
- SSM v1 credential check: explicitly open (see above).

**[POST-FREEZE]**
- Fix deploy-dev.yml: bootstrap error handling + trap-based PM2 restart.
- Fix PM2-stored-env rotation trap: permanent fix requires changing PM2 startup to
  always re-read `.env` at restart (e.g., always use `startOrRestart ecosystem.config.js`
  after any rotation, or remove `DB_PASSWORD` from `sharedEnv` so it is never cached).
- id 4 (parallel process): re-start when [3] window approaches; tree is intact.
- [3] combined-restart window: NOT primed, NOT executed this session. Opens in its
  own cold, deliberately-primed session. This session is disqualified from priming
  it (too warm, too much state). The AG-gate finding (PR #871) and the construction
  spec (`880c8dd7`) must both be in main before [3] is primed.
- ANTHROPIC_API_KEY rotation: separate, timing TBD.

---

## Phase 2A Status (complete as of 2026-06-27)

- P1-P5 executed and verified live on box.
- Parallel tree at `/home/ubuntu/episode-metadata-parallel/`, code at origin/main
  HEAD `13002465` *(verify live on box: `git -C /home/ubuntu/episode-metadata rev-parse origin/main`)*.
- P6 (delete staging node_modules) HELD until parallel tree's cutover role completes.
- Runbook Steps 4-5 complete: parallel process stood up, FD-38 fingerprint confirmed,
  zero-delta vs 2026-06-26 confirmed baseline (itself consistent with 2026-05-31 dump;
  three samples, not continuous monitoring), identity: episode_metadata / 10.0.20.224.

---

## Findings That Live Here (no separate artifact)

The following findings have no separate committed artifact. **This document is their
only durable record until they are filed into the Fix Plan:**

- **P0 deploy automation analysis** — full mechanism documented in P0 section above:
  bootstrap-before-restart, `set -eo pipefail`, `DEV_DB_PASSWORD` stale, `-X ours`
  data-loss behavior, two-session trigger history.
- **Security finding** — credential exposure, timeline reasoning, open SSM v1 check.
- **PM2-stored-env rotation trap** — structural issue documented in Box State section.
- **Process finding** — treating PR-open as inert documentation action in a
  frozen-prod repo; any automation-triggering action needs the same pre-flight
  discipline as box mutations.

---

## Process Finding

Treating PR-open as a documentation action (not a gated mutation) was the discipline
gap. In this repo, pushing a `claude/**` branch triggers the auto-merge pipeline
(now disabled, but the principle holds for any future automation). The same pre-flight
discipline applied to box mutations — "what does this actually trigger?" — applies
to any action in a frozen-prod repo. The pipeline being disabled fixes the immediate
hazard; the process lesson is to verify automation consequences before acting, not
just for box writes.