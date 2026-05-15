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

### §3.3 `deploy-dev.yml` - full step-by-step trace

**File size:** 20,588 bytes (per `ls .github/workflows/`).
**Trigger conditions:** Two - `push` to `dev` branch, and manual `workflow_dispatch`.
**Concurrency:** `group: deploy-dev`, `cancel-in-progress: false` - runs are serialized, not interrupted.
**Permissions:** `contents: read`.
**Jobs:** Three sequential jobs - `test` -> `build` -> `deploy`.

#### §3.3.1 `test` job (lines 18-66)

Spins up a Postgres 15 service container, runs the test suite. Standard CI shape.

- Drops and recreates `episode_metadata_test` database
- Runs `npm run migrate:up` against the test DB
- Runs `npm test -- --coverage`

**Failure mode:** None identified specific to §2.1/§2.2/§2.6. Test job is well-isolated.

#### §3.3.2 `build` job (lines 68-130)

Runs after `test` (with `if: always() && (... 'success' || ... 'failure')` - meaning **build runs even when tests fail**). Builds the deployable artifact:

1. `npm ci --production` + `npm install --no-save sequelize-cli`
2. Prunes `node_modules` (removes `.md`, `.d.ts`, `LICENSE*`, test/doc directories) - significant disk-space optimization
3. `cd frontend && npm ci && npm run build`
4. Bundles `src/`, `scripts/`, `frontend/dist/`, `nginx/`, `package.json`, `package-lock.json`, `ecosystem.config.js`, `.sequelizerc`, and the pre-built `node_modules/` into `deploy/`
5. Tars to `episode-metadata-${{ github.sha }}.tar.gz`
6. Uploads as workflow artifact

**Finding F-Deploy-G1-A:** Build runs on test failure. Implies a broken-test commit can still produce a deployable artifact and progress to the `deploy` job. The `deploy` job has no gate against this - it just downloads whatever artifact `build` produced.

**Finding F-Deploy-G1-B:** Pre-built `node_modules` from CI is shipped to EC2 (line 124-125: `mv node_modules deploy/`). This is the source of the lunch incident's IPv6 failure (PE #41). The CI runner installs whatever `express-rate-limit` version `package.json` resolves to *at CI time*. The prod EC2 had been running an older locally-installed `node_modules` that pre-dated the stricter `express-rate-limit` version. The CI-shipped `node_modules` brought in the newer version, which now boot-blocks. This is environment drift via dependency resolution timing, not just config.

#### §3.3.3 `deploy` job (lines 132-end)

Runs after `build`. Two-step structure: Preflight + Deploy to EC2. Targets the `development` environment (`https://dev.primepisodes.com`).

##### Preflight step

Validates SSH reachability and disk space before spending build time on the real deploy. Skips when `EC2_HOST` or `EC2_SSH_KEY` secrets are unset (early exit).

The Preflight step also includes a runner-network diagnostic block (curl to api.ipify.org for runner IP, raw TCP probe to port 22) before the SSH retry loop. That's defensive instrumentation added by a previous editor - not in scope as a finding, but worth noting the workflow has thoughtful operational care alongside the structural problems §3.3 identifies.

##### Deploy to EC2 step

The main work block. Single SSH session that:

1. Cleans up disk on EC2 (`pm2 stop all`, remove old node_modules/src/scripts, npm cache clean, journal vacuum, apt-get clean)
2. SCPs the artifact tarball to `/tmp/dev-deploy.tar.gz`
3. SSHs in and runs `set -eo pipefail`, sources `.nvm`, installs `pm2` if not present
4. Extracts frontend (dist + nginx config), updates `/var/www/html`, reloads nginx
5. Extracts backend (src + scripts + node_modules + package files + ecosystem.config.js + .sequelizerc) into `~/episode-metadata`
6. Exports DB env vars and API keys
7. Persists API keys to `~/episode-metadata/.env` for PM2 resurrect survival
8. Runs `node scripts/bootstrap-sequelize-meta.js` (bootstraps SequelizeMeta for databases created by `sequelize.sync()`)
9. Runs `npx sequelize-cli db:migrate --env development` - **migration failure is captured into `MIGRATION_FAILED=true` but does NOT exit the script**
10. `pm2 delete all`, `sleep 2`, `fuser -k 3002/tcp` (kill anything on port 3002), `sleep 1`
11. `pm2 start ecosystem.config.js --only episode-api,episode-worker --env development`
12. `pm2 save`
13. Health check on `http://localhost:3002/health` - retries 6 times with 5s sleep
14. Route verification on `/api/v1/shows` and `/api/v1/episodes` - logs status but does NOT exit on failure
15. Cleanup tarball, final exit logic checks `MIGRATION_FAILED` and presumably exits 1

**Finding F-Deploy-G1-C - Migration failure is non-fatal mid-deploy.** Line ~290-292:

```bash
if ! npx sequelize-cli db:migrate --env development 2>&1 | tail -20; then
	echo '⚠️ Migration failed - will still restart PM2 so site stays up'
	MIGRATION_FAILED=true
fi
```

The comment "will still restart PM2 so site stays up" is a deliberate design choice. The intent is to avoid a complete site outage when one migration fails - the previous version of the app keeps running. But in practice this produces the **worst-of-both-worlds** outcome we saw at lunch: schema is half-migrated, new code is deployed expecting the new schema, PM2 boots the new code, routes fail because the schema mismatch breaks ORM queries. The "site stays up" goal is not achieved when the code/schema drift is the actual failure source.

This is the §2.6 lunch incident's primary cause.

**Finding F-Deploy-G1-D - Port 3002 collision recovery via `fuser -k`.** Line ~298:

```bash
fuser -k 3002/tcp 2>/dev/null || true
```

This kills whatever holds port 3002 before PM2 starts. It implies there's been an observed pattern of stuck-port issues - likely the §2.2 / §12.19 incident class where PM2 came up on the wrong port.

**Finding F-Deploy-G1-E - Hardcoded port 3002 throughout.** The dev workflow targets port 3002 (`http://localhost:3002/health`, `fuser -k 3002/tcp`, `/api/v1/shows` etc on `:3002`). Prod targets port 3000 (per F-Stats-1 plan v1.2 §12.19 and morning soak verification). This is the port-collision risk surface: prod runs on `:3000`, dev runs on `:3002`, both on the *same EC2 instance*. If PM2 starts a dev process under the prod ecosystem config (or vice versa), the port assumption inverts and `fuser -k` may kill the wrong process.

**Finding F-Deploy-G1-F - Backend health check passes before route verification.** Line ~310-322:

The health endpoint check (`/health`) passes as long as the app boots and responds. **The actual route verification** (`/api/v1/shows`, `/api/v1/episodes`) is logged but **does not gate deploy success** - it just dumps PM2 error logs if routes fail. The workflow continues to cleanup and final exit regardless.

This means: a deploy can "succeed" with PM2 online and `/health` returning 200, while the actual API routes are 404 because of module-load failures (PE #40 Template Studio, PE #41 aiRateLimiter). The dev-deploy workflow's notion of "success" is weaker than "the app actually works."

**Finding F-Deploy-G1-G - Same EC2 instance for dev and prod.** Cross-cutting observation. The `Free disk space on EC2 before uploading` step runs `pm2 stop all` - which stops BOTH dev and prod PM2 processes on this instance. This is the §2.1 / §12.15 root cause: a dev-deploy stopped the prod processes, then the deploy failed before restarting them, leaving prod down for 50 minutes.

The architectural assumption underlying the entire workflow is "this EC2 instance only runs one app." That assumption is violated in practice - prod and dev share the instance.

#### §3.3.4 Summary of failure-mode findings

The findings A-H above map to the §2 failure events as follows:

| §2 Event | Primary file:line cause |
|---|---|
| §2.1 F-App-1 outage | F-Deploy-G1-G (pm2 stop all on shared EC2) |
| §2.2 F-Stats-1 G2 outage | F-Deploy-G1-E (port collision dev:3002 vs prod:3000), F-Deploy-G1-D (`fuser -k` band-aid) |
| §2.6 Dev deploy lunch | F-Deploy-G1-C (migration non-fatal), F-Deploy-G1-B (CI-shipped node_modules brings new express-rate-limit), F-Deploy-G1-F (route check non-fatal) |

§2.3, §2.4, §2.5 (auto-merge mechanism, TySteamTest identity) are not caused by `deploy-dev.yml` and trace to other files (§3.2 `auto-merge.yml`, §3.7 local-tooling identity).

### §3.4 `deploy-production.yml`

**TODO** - manual-trigger-only (verified earlier). 16,926 bytes. Document the trigger conditions and the deploy steps. Identify whether the PM2 wrong-port / missing `--env production` patterns from §2.2 also exist in this workflow.

### §3.5 PM2 ecosystem config (`ecosystem.config.js`)

**File size:** ~150 lines. Lives at repo root, copied into `deploy/` artifact, deployed to `/home/ubuntu/episode-metadata/ecosystem.config.js` on EC2.

**Structure:** Module exports an `apps` array with **four PM2 application definitions**:

1. `episode-api` - production HTTP API (port 3000 in `env_production`, port 3002 in default `env`)
2. `episode-worker` - production background worker (fork mode, no port)
3. `episode-api-dev` - dev HTTP API (port 3002, no `env_production` block)
4. `episode-worker-dev` - dev background worker (fork mode, no `env_production` block)

**Shared:** A `sharedEnv` object spread into every app's `env` block - contains 30+ environment variables for DB, AWS, Cognito, JWT, Redis, Anthropic, ElevenLabs, RunwayML, Replicate, fal.ai, remove.bg. All sourced from `process.env` with empty-string defaults.

#### §3.5.1 - The PORT defaults are inverted

The default `env` block on `episode-api` sets:

```javascript
env: {
	...sharedEnv,
	PORT: 3002,    // <-- dev's port
	HOST: '0.0.0.0',
	APP_NAME: 'Episode Metadata API (Development)',
	ALLOWED_ORIGINS: 'https://dev.episodes.primestudios.dev,...,https://dev.primepisodes.com',
}
```

And `env_production` overrides with:

```javascript
env_production: {
	...sharedEnv,
	PORT: 3000,    // <-- prod's port
	HOST: '0.0.0.0',
	NODE_ENV: 'production',
	APP_NAME: 'Episode Metadata API (Production)',
	ALLOWED_ORIGINS: 'https://primepisodes.com,https://www.primepisodes.com',
}
```

**Finding F-Deploy-G1-H - The default env block on `episode-api` configures it as DEV.** Port 3002, app name says "Development," CORS origins include `localhost` and `dev.primepisodes.com`. The `env_production` override is required to get production port and CORS.

**Consequence:** When PM2 starts `episode-api` without `--env production`, the app comes up:
- Bound to port 3002 instead of port 3000 (the ALB cannot route to it)
- Identifying itself as "Episode Metadata API (Development)"
- Accepting CORS from dev origins but not from `primepisodes.com`

This is the §12.19 incident's mechanical root cause. The deploy command missed `--env production`, PM2 started the prod app with the default `env` block (which is dev-shaped), and the prod API came up on port 3002. The ALB health checks failed because nothing was listening on port 3000.

#### §3.5.2 - The dev-named apps are unused

`episode-api-dev` and `episode-worker-dev` are defined in the config but **never started by any workflow**:

- `deploy-dev.yml` starts `episode-api` and `episode-worker` with `--env development`
- `deploy-production.yml` starts `episode-api` and `episode-worker` with `--env production` (presumably; needs §3.4 verification)

The `*-dev` named apps appear to be a leftover from an earlier architectural attempt (side-by-side dev and prod processes on the same EC2 instance). They're dead config: defined but unreferenced.

**Finding F-Deploy-G1-I - Dead PM2 app definitions.** `episode-api-dev` and `episode-worker-dev` are not started by any workflow but remain in `ecosystem.config.js`. They take up no resources (PM2 doesn't auto-start unreferenced apps) but they create cognitive overhead for future readers and the false impression that prod/dev are isolated. Either remove them or wire the deploy workflows to use them.

#### §3.5.3 - Single-instance both processes

Both `episode-api` and `episode-worker` use `instances: 1` and no explicit `exec_mode` for the API (worker is explicitly `exec_mode: 'fork'`). The PM2 default for `exec_mode` when omitted is `fork`, not `cluster`.

**However**, the morning soak output showed `episode-api` in `cluster` mode with `mode: cluster`. That means either:
- PM2 was started with a runtime override that promoted episode-api to cluster mode
- A prior version of the config used cluster mode and PM2 retained that setting via `pm2 save` / `pm2 resurrect`
- PM2 cluster mode interprets `instances: 1` differently than I'm assuming

Worth verification but not a finding-level concern - single-instance cluster mode is functionally equivalent to fork mode for our purposes.

#### §3.5.4 - Logs colocate dev and prod on shared EC2

Log file paths on the prod-named apps:
- `episode-api`: `/home/ubuntu/episode-metadata/logs/error.log` and `out.log`
- `episode-worker`: `/home/ubuntu/episode-metadata/logs/worker-error.log` and `worker-out.log`

On the dev-named apps:
- `episode-api-dev`: `/home/ubuntu/episode-metadata/logs/dev-error.log` and `dev-out.log`
- `episode-worker-dev`: `/home/ubuntu/episode-metadata/logs/dev-worker-error.log` and `dev-worker-out.log`

**Implication:** If both prod and dev are ever run side-by-side (using the proper dev-named apps), the logs are separated by filename prefix. But because deploy-dev.yml uses the prod-named apps, **dev deploys write to prod's log files**. The morning soak verification's `error-0.log` content with 16 thumbnail-column errors may include both prod usage AND any dev API hits that happened in the soak window - they share the same log file.

**Finding F-Deploy-G1-J - Dev and prod share log files.** Because deploy-dev.yml reuses prod's PM2 app name, dev deploys write to prod's log files. This conflates two workloads and complicates incident analysis. Any error in `/home/ubuntu/episode-metadata/logs/error.log` could be either deploy's origin.

#### §3.5.5 Summary - relationship to §2 events

The findings H-J above sharpen the §2.2 / §12.19 picture and add context to §2.6:

| §2 Event | Refined cause |
|---|---|
| §2.2 F-Stats-1 G2 outage | F-Deploy-G1-H (default env block has dev port; missing `--env production` puts prod on dev's port) |
| §2.6 Dev deploy lunch | F-Deploy-G1-J (logs conflated, harder to triage; the IPv6 ValidationError surfaced in shared error log) |

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
