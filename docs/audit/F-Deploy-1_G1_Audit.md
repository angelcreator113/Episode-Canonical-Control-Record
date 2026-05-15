# F-Deploy-1 G1 Audit Report

**Deploy pipeline + autonomous-merge failure-mode audit**

| | |
|---|---|
| **Plan reference** | F-Stats-1 Fix Plan v1.2 Decision #8, Decision #9 (F-Deploy-1 promoted post-Phase-A) |
| **Date started** | 2026-05-15 |
| **Date last updated** | 2026-05-15 (end of day 1) |
| **Auditor** | JustAWomanInHerPrime (JAWIHP) / Evoni, with assistant |
| **Repo HEAD at audit start** | `742c66b6` (F-Stats-1 plan v1.2 §12.20 + Decision #9 commit) |
| **Status** | IN PROGRESS — day 1 complete; 5/7 §3 file-read sections done |
| **Findings filed** | 21 (A through U) |
| **Deferred items** | F-Deploy-G1-T (requires reading `.github/scripts/deploy-production.sh`) |

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

**§3 Progress index** (end of day 1):

| Section | File | Status | Commit | Findings |
|---|---|---|---|---|
| §3.1 | `auto-merge-to-dev.yml` | ✅ Done | `0759513d` | P, Q, R |
| §3.2 | `auto-merge.yml` | ✅ Done | `e4601f87` | K, L, M, N, O |
| §3.3 | `deploy-dev.yml` | ✅ Done | `3195b572` | A, B, C, D, E, F, G |
| §3.4 | `deploy-production.yml` | ✅ Done | `515e6310` | S, T (deferred), U |
| §3.5 | `ecosystem.config.js` | ✅ Done | `f6a850e7` | H, I, J |
| §3.6 | Branch protection state | ⏳ TODO | — | — |
| §3.7 | Local tooling identity | ⏳ TODO | — | — |

Deferred reading: `.github/scripts/deploy-production.sh` (resolves F-Deploy-G1-T → confirms or refutes F-Deploy-G1-H prod-side mechanism).

---

### §3.1 `auto-merge-to-dev.yml`

**File size:** ~125 lines. Lives at `.github/workflows/auto-merge-to-dev.yml`.

**Current canonical state on `main`:** commit `e0c0a0cc` (the bang-syntax surgical fix from 2026-05-14 night, after the broken `branches:` + `branches-ignore:` pair landed via commit `d0a36c6b` and was then corrected). The workflow's role is to merge feature branches (`claude/**`) into `dev` automatically, gated by a build-verification step.

#### §3.1.1 - Trigger conditions

```yaml
on:
	push:
		branches:
			- 'claude/**'
			- '!claude/start-f-stats-1-g2'
			- '!claude/f-stats-1-phase-b-**'
```

Fires on `push` events to any branch matching the pattern. The bang-prefix entries exclude two F-Stats-1-related branch namespaces from triggering - the F-Stats-1 keystone is in flight and its branches should not auto-merge to dev.

**Surgical-fix history:** The current bang-syntax form is the third iteration of this trigger block within the past 24 hours:

1. **Pre-fix:** Triggered on `branches: - 'claude/**'` only. No exclusions. F-Stats-1 G2 branch (`claude/start-f-stats-1-g2`) pushed -> workflow fired -> merged to dev -> triggered `deploy-dev.yml` -> produced the §12.19 incident.
2. **Iteration 1 (commit `d0a36c6b`):** Added `branches-ignore:` block alongside `branches:`. This is **invalid GitHub Actions YAML** - the two filters are mutually exclusive. Workflow parse-failed on every run for ~5 hours. The fail-safe outcome ("workflow doesn't fire") was mistaken for "exclusion working as designed."
3. **Iteration 2 (commit `e0c0a0cc`):** Replaced with bang-syntax entries inside a single `branches:` list. Valid YAML. This is the current canonical form.

**Finding F-Deploy-G1-P - The exclusion list is hardcoded and grows with each F-Stats-1 phase.** When F-Stats-1 Phase B begins, additional branch patterns will need to be added. The list is not maintained by automation; each phase update requires manual edit. No mechanism prevents a forgotten edit from re-introducing the §12.19 incident class.

#### §3.1.2 - Concurrency control

```yaml
concurrency:
	group: auto-merge-dev
	cancel-in-progress: false
```

Single concurrency group, `cancel-in-progress: false`. Multiple workflow runs serialize against each other; in-progress runs are not cancelled when a new push arrives. Good design - prevents two simultaneous merges from racing on `dev`.

#### §3.1.3 - Authentication asymmetry vs `auto-merge.yml`

The first step generates a custom GitHub App token:

```yaml
- name: Generate GitHub App token
	id: app-token
	uses: actions/create-github-app-token@v1
	with:
		app-id: ${{ secrets.APP_ID }}
		private-key: ${{ secrets.APP_PRIVATE_KEY }}
```

The checkout step then uses that token explicitly. The inline comment explains why:

> GitHub App token is required so the push to dev triggers deploy-dev.yml. GITHUB_TOKEN pushes do NOT trigger other workflows (GitHub security rule).

**This is intentional cascading.** The workflow's design depends on its `git push origin dev` at the end triggering `deploy-dev.yml`. With `GITHUB_TOKEN` that wouldn't happen; with the App token it does. The asymmetry with `auto-merge.yml` (which uses `GITHUB_TOKEN` and does not cascade) is now visible as a deliberate design split: PR merges to main should not cascade; feature-branch merges to dev should cascade.

#### §3.1.4 - Merge strategy

The "Merge into dev (local)" step runs locally (no push yet) and tries two merge strategies:

**Strategy 1 - Clean three-way merge:**
```bash
if git merge origin/$BRANCH --no-edit -m "Auto-merge $BRANCH into dev"; then
	echo "merge_type=clean"
	exit 0
fi
```

**Strategy 2 - Conflict resolution with `-X ours`:**
```bash
git merge --abort
if git merge origin/$BRANCH --no-edit -m "Auto-merge $BRANCH into dev (resolved conflicts, dev wins)" -X ours; then
	echo "merge_type=conflicts-resolved"
else
	echo "Merge still failed even with -X ours. Manual resolution needed."
	exit 1
fi
```

The `-X ours` strategy means: on conflict, **dev wins**. The branch loses its conflicting changes in favor of whatever is already on dev.

The inline rationale comment is thoughtful and worth quoting at length:

> dev is the shared truth - if two claude/* sessions touch the same file, the one that reaches dev first is already being validated by CI and possibly running in the environment. Silently overwriting it with an older feature-branch view of the world produces broken half-merges (missing declarations for usages that landed earlier in dev). With `-X ours`, the later branch loses *its own* changes in conflicting hunks - which is visible to its author, easy to fix with a rebase+push, and doesn't corrupt the shared branch.

This is real engineering thinking. The design recognizes that "dev wins" is asymmetric on purpose - protecting the shared branch is more valuable than preserving any single feature branch's view.

**Finding F-Deploy-G1-Q - `-X ours` silently drops branch changes on conflict.** The fail-mode behavior is *correct by design* but has a real cost: a feature branch can push, see "auto-merge succeeded," and not realize its changes were partially dropped during conflict resolution. The author has no notification beyond the merge commit message ("resolved conflicts, dev wins"). For F-Stats-1 Phase B execution where multiple branches modify overlapping files (careerGoals, episodes, worldEvents), this is a real surface - Phase B branches should be exempt from this auto-merge to prevent silent change loss.

The current bang-syntax exclusion (`'!claude/f-stats-1-phase-b-**'`) is what protects Phase B from this. Validates the existence of the exclusion.

#### §3.1.5 - Build verification gate

A "Detect frontend changes" step diffs the post-merge HEAD against `pre_merge_sha` for the `frontend/` path:

```bash
if git diff --quiet "${{ steps.merge.outputs.pre_merge_sha }}" HEAD -- frontend/; then
	echo "frontend_changed=false"
else
	echo "frontend_changed=true"
fi
```

If frontend changed, conditional steps fire: Setup Node.js, then `cd frontend && npm ci --prefer-offline && npx vite build`. The build must succeed for the workflow to proceed.

The inline comment explains the rationale:

> Even a "clean" three-way merge can produce broken code when two branches add non-overlapping usages of an identifier that one branch forgot to declare, or touch the same JSX tree in ways that balance per-branch but not together. A post-merge build catches those silent breakages.

**Finding F-Deploy-G1-R - Build verification is frontend-only.** No equivalent check for backend code. A merge that adds an `require()` to a non-existent module, or invokes a function with a wrong signature, would still push to dev. The `deploy-dev.yml` workflow would then encounter the broken backend at deploy time, with the failure modes documented in §3.3. This gap is the bridge between §3.1 and §3.3 - `auto-merge-to-dev.yml`'s build gate doesn't catch backend issues, leaving them to be caught (or missed) by `deploy-dev.yml`'s health check + route verification.

#### §3.1.6 - Push to dev

Final step:

```bash
git push origin dev
echo "Pushed verified merge to dev."
```

Unconditional. Once the merge succeeded (clean or conflicts-resolved) and the build verification passed (or was skipped because frontend was untouched), the merge commit pushes to `dev`. The push triggers `deploy-dev.yml` (because of the App token from §3.1.3).

#### §3.1.7 Summary - relationship to §2 events and other findings

| §2 Event | Cause from §3.1 |
|---|---|
| §2.1 F-App-1 outage | Triggered by push to a `claude/**` branch -> `auto-merge-to-dev` ran -> pushed to dev -> `deploy-dev.yml` fired -> §3.3 F-Deploy-G1-G `pm2 stop all` stopped prod processes |
| §2.2 F-Stats-1 G2 outage | Same chain. §3.1 was the entry point. The exclusion `'!claude/start-f-stats-1-g2'` was added afterwards to prevent recurrence. |

**Cross-section findings activated by §3.1:**
- F-Deploy-G1-K (auto-merge.yml unconditional) + F-Deploy-G1-Q (auto-merge-to-dev's `-X ours` drops branch changes) together describe the two auto-merge surfaces with different failure modes
- F-Deploy-G1-R (frontend-only build verification) leaves backend merges to be caught downstream in §3.3

### §3.2 `auto-merge.yml`

**File size:** 525 bytes, 19 lines. Extremely small for what it does.

**Trigger:** `pull_request: [opened, synchronize]`. Fires on:
- PR opened (including draft PRs - GitHub fires `opened` for both regular and draft)
- Push to an open PR's source branch (`synchronize` event)

**Permissions:** `contents: write`, `pull-requests: write`.

**Action:** Single command per run:
```yaml
gh pr merge ${{ github.event.pull_request.number }} --squash --auto || echo "Auto-merge already enabled or PR already merged - skipping"
```

No conditions, no filters, no exclusions.

#### §3.2.1 - Findings

**Finding F-Deploy-G1-K - Unconditional auto-merge.** The workflow has no filters: no branch pattern, no label requirement, no author check, no draft check, no path filter. Every PR opened against any branch with any content from any author triggers an auto-merge enablement on that PR.

**Finding F-Deploy-G1-L - Draft PRs are not exempt at the workflow level.** The `pull_request: [opened]` trigger fires for both regular and draft PRs. The workflow doesn't check `github.event.pull_request.draft`. What prevents immediate merge of draft PRs is downstream: `gh pr merge --auto` on a draft PR enables auto-merge in a queued state. The moment a draft PR is flipped to ready (`gh pr ready`), auto-merge fires instantly if checks pass.

This is the subtle danger nearly hit with PR #684 on 2026-05-15 morning. When `gh pr ready 684` ran to flip the draft, the auto-merge that had been queued since PR opening would have fired immediately - and only didn't because the CI checks had `FAILURE` status from §12.19's deploy outage. The manual `gh pr merge 684 --squash` we ran was racing the auto-merge that was already enabled and waiting.

**Finding F-Deploy-G1-M - `--auto` flag means merge happens out-of-band from the workflow run.** `gh pr merge --auto` tells GitHub: "merge this when all required checks pass." The merge can fire seconds, minutes, or hours after the workflow completes. The workflow run records success when auto-merge is enabled, not when the merge actually happens. There is no workflow-run-history record of the actual merge event.

This explains the difficulty pinning down PR #688/#689's merge timing on 2026-05-14: the Auto-merge workflow ran when the PRs were opened (enabling auto-merge); the actual merges happened later, asynchronously, with no workflow record.

**Finding F-Deploy-G1-N - Uses `GITHUB_TOKEN`, not a custom App token.** Asymmetric with `auto-merge-to-dev.yml`, which uses `actions/create-github-app-token@v1` with `APP_ID` + `APP_PRIVATE_KEY` to ensure its pushes trigger downstream workflows. `auto-merge.yml` uses default `GITHUB_TOKEN`. Per GitHub's security rule, `GITHUB_TOKEN`-driven commits do not trigger other workflows - so merges performed by this workflow **do not trigger any workflow watching `main`**. May be a feature (no cascade) or an oversight depending on intent.

**Finding F-Deploy-G1-O - No concurrency control.** No `concurrency:` block. If multiple PRs open in rapid succession (e.g., automation opening PR #688 and #689 within seconds), both workflow runs execute in parallel, both enable auto-merge on their respective PRs, both merges fire when checks pass. No serialization. Last night's backup-branch incident matches this pattern exactly.

#### §3.2.2 - Reconstruction of PR #688/#689 merge sequence

With §3.2's findings, the §2.4 event (PRs #688/#689 from backup branches, 2026-05-14 night) reconstructs as:

1. `git push origin claude/session-pe-roster:claude/session-pe-roster-backup --force` - backup branch pushed to origin
2. **PR #688 opened from `claude/session-pe-roster-backup` to `main`.** *Mechanism still unknown.* `auto-merge.yml` does not open PRs; only merges them. The PR-opening step requires a separate actor: Copilot agent, browser-side automation, manual click via mobile/desktop GitHub UI. This remains the gap for §3.7 investigation.
3. `auto-merge.yml` fires on the `opened` event
4. Workflow runs `gh pr merge 688 --squash --auto`
5. GitHub queues the auto-merge
6. With no required checks on `main` (no branch protection - see §3.6 TODO), auto-merge fires within seconds
7. PR #688 squash-merges to main as `c9acc59c`
8. Same sequence repeats for PR #689 -> `bbca0a87`

The architectural gap is at step 2. Steps 3-8 are mechanical consequences of `auto-merge.yml` once a PR exists.

#### §3.2.3 Summary - relationship to §2 events

| §2 Event | Refined cause |
|---|---|
| §2.3 May 14 evening - PR #685 auto-merge | F-Deploy-G1-K (unconditional fire) |
| §2.4 May 14 night - PRs #688, #689 from backup branches | F-Deploy-G1-K (fire) + F-Deploy-G1-O (parallel runs, no serialization) + unidentified PR-opening mechanism (§3.7) |
| §2.6 May 15 morning - PR #684 near-miss | F-Deploy-G1-L (draft auto-merge queued, fires on ready), F-Deploy-G1-M (out-of-band timing) |

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

**File size:** ~330 lines. Lives at `.github/workflows/deploy-production.yml`. Manual-trigger only.

**Critical architectural finding:** Unlike `deploy-dev.yml`, this workflow does **not** invoke PM2 directly. Instead it SCPs a separate script (`.github/scripts/deploy-production.sh`) to EC2 and executes it. The PM2 start command - including whatever `--env` flag is or is not passed - lives in that external script, which §3.4 does not yet cover.

#### §3.4.1 - Trigger conditions

```yaml
on:
	workflow_dispatch:
		inputs:
			confirm:
				description: 'Type "DEPLOY TO PRODUCTION" to confirm'
				required: true
				default: ''
			reason:
				description: 'Deployment reason/ticket number'
				required: true
```

Manual only. The first job (`validate`) string-matches the `confirm` input against the literal "DEPLOY TO PRODUCTION" and aborts if it doesn't match exactly. The `reason` input is required but not validated for content.

**No `push` trigger.** Production cannot deploy on a commit to main, only via deliberate workflow_dispatch.

#### §3.4.2 - Job sequence

Four sequential jobs with `needs:` dependencies:

1. `validate` - confirms the "DEPLOY TO PRODUCTION" string
2. `test` - Postgres service container + full test suite (same as `deploy-dev.yml` test job)
3. `build` - frontend build + artifact tar (different from dev - see §3.4.4)
4. `deploy` - SSH to EC2, migrate, run deploy script, smoke test

**Difference from deploy-dev.yml:** `build` does NOT use `if: always() && (... 'success' || ... 'failure')`. Build only runs on test success. **Production cannot deploy with broken tests** - a hard improvement over the dev workflow (F-Deploy-G1-A).

#### §3.4.3 - Migration handling: fatal failure

```bash
npx sequelize-cli db:migrate --env production
echo "Migrations completed successfully"
```

No `if !` wrapper. No `MIGRATION_FAILED=true` flag. If migrations fail, the workflow step fails, and the rest of the deploy does not run.

**Cross-reference to F-Deploy-G1-C (dev migration non-fatal):** The dev workflow's "migrations failed but PM2 restarted anyway" pattern is NOT present in production. Production fails hard on migration failure. The §12.19 incident's `column "version" does not exist` failure (PE #48), if it had occurred in production, would have aborted the deploy before the code+schema mismatch reached the runtime. This is a real safety property.

**However:** Migrations run as a separate workflow step *before* the deploy script. If migrations succeed but the deploy script's PM2 restart fails, the database is ahead of the deployed code, but the previous code keeps running until the next successful deploy. Schema-ahead-of-code state is bounded by the deploy script's outcome, not the migration step alone.

#### §3.4.4 - Artifact composition

```bash
mkdir -p deploy
cp -r src deploy/
cp -r src/migrations deploy/
cp -r frontend/dist deploy/frontend-dist
cp package.json deploy/
cp package-lock.json deploy/
cp nginx.conf deploy/ || true
tar -czf episode-metadata-production-${{ github.sha }}.tar.gz deploy/
```

**Key differences from deploy-dev.yml's artifact:**

1. **No `node_modules` bundled.** Dev ships pre-built `node_modules` from CI (F-Deploy-G1-B); prod re-runs `npm ci` on EC2. Slower deploy, but avoids the dependency-resolution-timing surface that made the lunch IPv6 issue boot-blocking.

2. **No `ecosystem.config.js` bundled.** Production uses whatever `ecosystem.config.js` is already on the EC2 instance. If a prior dev deploy modified that file, or if the file is stale, the production deploy runs against an outdated config.

3. **No `scripts/` bundled.** Prod doesn't ship the helper scripts that dev ships (e.g., `bootstrap-sequelize-meta.js`). The deploy script must either skip those or use the already-installed copies on EC2.

**Finding F-Deploy-G1-S - Production uses whatever `ecosystem.config.js` already exists on the EC2 instance.** Since the dev workflow extracts `ecosystem.config.js` from its artifact and overwrites the EC2 copy on every dev deploy, the file on EC2 at production-deploy-time reflects the most recent dev deploy, not the production branch's intended state. Any drift between repo HEAD's `ecosystem.config.js` and what's actually on EC2 silently affects production deploys.

#### §3.4.5 - PM2 logic lives in a separate script

The deploy step's main work:

```bash
scp ... .github/scripts/deploy-production.sh $EC2_USER@$EC2_HOST:/tmp/deploy-prod.sh
ssh ... $EC2_USER@$EC2_HOST "DATABASE_URL='...' chmod +x /tmp/deploy-prod.sh && /tmp/deploy-prod.sh"
```

The actual PM2 commands, env flag handling, port configuration, log writing - all of that happens inside `.github/scripts/deploy-production.sh`, which §3.4 has not yet examined.

**Finding F-Deploy-G1-T - F-Deploy-G1-H verification deferred.** The §3.5 finding that the default `env` block on `episode-api` is dev-shaped (port 3002) is only dangerous to prod IF the production deploy command omits `--env production`. The deploy-production.yml YAML does not contain the PM2 start command. The verification requires reading `.github/scripts/deploy-production.sh`. **Filed as a §3.4 follow-up item; cannot be resolved from the workflow YAML alone.**

#### §3.4.6 - Smoke tests are blocking

Final step before summary:

```bash
for url in https://primepisodes.com/health https://www.primepisodes.com/health; do
	for i in $(seq 1 10); do
		HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$url" || true)
		if [ "$HTTP_CODE" = "200" ]; then
			break
		fi
		if [ "$i" -eq "10" ]; then
			exit 1
		fi
		sleep 6
	done
done
```

10 attempts × 6 seconds = 60 seconds per URL. Both must return 200 within the window. **Workflow fails if either fails.**

**Cross-reference to F-Deploy-G1-F (dev route check non-fatal):** Production's smoke test is the inverse - fatal on failure. A bad deploy that fails health check on primepisodes.com cannot quietly succeed.

**But:** This only catches a `/health` failure. Like dev (F-Deploy-G1-F), it does not verify specific routes like `/api/v1/shows` or `/api/v1/episodes`. A production deploy where `/health` works but specific routes 404 would pass smoke tests and complete "successfully." The §12.19 incident's actual symptom (prod on wrong port -> ALB couldn't route -> `/health` failed) would have been caught here. But a more subtle failure (module load error that breaks `/api/v1/episodes` while leaving `/health` intact) would not.

#### §3.4.7 - Retry logic on the deploy script

```bash
MAX_RETRIES=3
RETRY_DELAY=30

for i in $(seq 1 $MAX_RETRIES); do
	if scp ... .github/scripts/deploy-production.sh ...; then
		if ssh ... "/tmp/deploy-prod.sh"; then
			echo "Deployment successful on attempt $i"
			break
		fi
	fi
	if [ $i -lt $MAX_RETRIES ]; then
		echo "Deployment attempt $i failed, waiting ${RETRY_DELAY}s before retry..."
		sleep $RETRY_DELAY
	else
		exit 1
	fi
done
```

3 attempts. If the deploy script fails, retry after 30s. If all 3 fail, the workflow fails.

**Concern:** A deploy script that *partially succeeds* (e.g., copies files, restarts PM2, but health check fails) - does retry produce idempotent behavior? Without reading the script, this is unknown. A non-idempotent deploy script being retried could pile state changes on each attempt.

**Finding F-Deploy-G1-U - Retry safety depends on deploy script idempotency.** The YAML retries the entire deploy script up to 3 times on failure. If the script is not idempotent (e.g., re-running causes duplicate side effects, or leaves state in an intermediate form), the retry mechanism could compound failures rather than recover from them. Verification requires reading `.github/scripts/deploy-production.sh`.

#### §3.4.8 - `.env` write-loop preserves keys

A small detail worth noting: the workflow writes DB credentials and API keys to `/home/ubuntu/episode-metadata/.env` using a SCP-and-merge pattern that preserves existing keys not in the new set:

```bash
while IFS= read -r line; do
	KEY="${line%%=*}"
	if grep -q "^${KEY}=" "$ENV_FILE"; then
		grep -v "^${KEY}=" "$ENV_FILE" > "${ENV_FILE}.tmp"
		echo "$line" >> "${ENV_FILE}.tmp"
		mv "${ENV_FILE}.tmp" "$ENV_FILE"
	else
		echo "$line" >> "$ENV_FILE"
	fi
done < /tmp/db_creds.env
```

This is careful design - adds or updates specific keys without wiping unrelated keys. Worth noting as positive engineering practice, similar to the network-diagnostic block in §3.3 and the `-X ours` rationale in §3.1.

#### §3.4.9 Summary - relationship to §2 events and other findings

| §2 Event | Cause from §3.4 |
|---|---|
| §2.2 F-Stats-1 G2 outage | F-Deploy-G1-T (cannot verify from YAML alone whether `--env production` is passed; deferred to deploy-production.sh read) |

**Cross-section findings activated by §3.4:**
- F-Deploy-G1-S (stale ecosystem.config.js on EC2 from prior dev deploys) - depends on F-Deploy-G1-J (dev/prod log conflation via shared EC2)
- F-Deploy-G1-T (PM2 start logic deferred to external script) - primary blocker for F-Deploy-G1-H verification
- F-Deploy-G1-U (retry idempotency) - depends on external script reading

**Open items from §3.4:**
- Read `.github/scripts/deploy-production.sh` to resolve F-Deploy-G1-T (the §12.19 root cause confirmation)
- Cross-reference with §3.5 to check if the EC2's `ecosystem.config.js` could be stale relative to the repo

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

**Method:** `gh api repos/angelcreator113/Episode-Canonical-Control-Record/branches/main/protection` returned 200 with a full protection-rule JSON object. The branch IS protected - but in a configuration where nearly every protection setting is opted out.

#### §3.6.1 - Current configuration (2026-05-15)

**Settings that DO restrict pushes to main:**

| Setting | Value | Effect |
|---|---|---|
| `allow_force_pushes` | `false` | Force-push to main is rejected |
| `allow_deletions` | `false` | The `main` branch cannot be deleted |

**Settings that exist but allow everything through:**

| Setting | Value | Effect |
|---|---|---|
| `required_approving_review_count` | `0` | PRs require zero approvals to merge |
| `dismiss_stale_reviews` | `false` | Stale reviews kept (moot at 0 required) |
| `require_code_owner_reviews` | `false` | No CODEOWNERS gate |
| `require_last_push_approval` | `false` | New pushes don't invalidate approval |
| `required_signatures.enabled` | `false` | Unsigned commits accepted |
| `enforce_admins.enabled` | `false` | Admins bypass all rules |
| `required_linear_history.enabled` | `false` | Merge commits allowed |
| `required_conversation_resolution.enabled` | `false` | Unresolved PR comments don't block merge |
| `lock_branch.enabled` | `false` | Branch is writable |

**Notably absent from the response:** `required_status_checks`. No required CI checks are configured. Any merge attempt finds zero blocking conditions.

#### §3.6.2 - Findings

**Finding F-Deploy-G1-V - Branch protection exists but is effectively a no-op.** Every gating setting is opted out: 0 required reviews, no required checks, no signature requirement, no conversation-resolution requirement, no admin enforcement, no linear history. The only enforced rules are "no force pushes" and "no deletion of main" - useful but they don't prevent unwanted merges or pushes via standard merge paths.

The "branch protection: enabled" status this configuration produces is misleading. A user glancing at the repo settings sees branch protection active and assumes there's a gate against unreviewed merges. There isn't.

**Finding F-Deploy-G1-W - Zero required checks is the mechanical cause of the §2.4 auto-merge chain.** When `auto-merge.yml` runs `gh pr merge --squash --auto` on a newly-opened PR (PRs #688, #689 from backup branches), the `--auto` flag queues the merge until "required checks pass." With zero required checks configured, the condition is satisfied immediately - the merge fires within seconds, as observed in §2.4.

**Finding F-Deploy-G1-X - Admin enforcement is disabled.** `enforce_admins: false` means that even if the protection settings were tightened, the repo owner (Evoni, who is the sole admin) would still bypass them. For a single-developer repo this is the pragmatic default - it lets the owner unblock themselves in emergencies. But it also means any tightening of `required_approving_review_count` or `required_status_checks` is ignored for admin merges. The tightening would only affect *non-admin* contributors, of which this repo has none.

#### §3.6.3 - Implications for F-Deploy-1 fix plan

The F-Deploy-1 fix plan (§5 of this audit, still TODO) will need to address the autonomous-merge mechanism. Three architectural options:

**Option A - Tighten branch protection.** Set `required_status_checks` to require specific CI workflows (Validate, tests). Set `required_approving_review_count: 1` if working with anyone else (currently 0 because solo dev). Enable `enforce_admins` if the goal is hard prevention even for the owner. **Trade-off:** raises friction on every PR, including legitimate solo-dev work; might force `--admin` flag usage to bypass for emergencies, defeating the purpose.

**Option B - Disable `auto-merge.yml`.** Remove or restrict the workflow that fires `gh pr merge --auto` on every PR. **Trade-off:** removes the convenience of auto-merge for legitimate draft->ready promotions, requires manual click to merge.

**Option C - Combination.** Add minimal required checks (e.g., `test` workflow must pass) AND filter `auto-merge.yml` to only run on PRs that meet specific criteria (e.g., a label like `auto-merge` applied manually). **Trade-off:** more complexity, but preserves auto-merge as opt-in instead of opt-out.

These options are not decided here; they go to §5 fix-plan structure.

#### §3.6.4 Summary - relationship to §2 events and other findings

| §2 Event | Cause from §3.6 |
|---|---|
| §2.3 May 14 evening - PR #685 auto-merge | F-Deploy-G1-W (zero required checks) |
| §2.4 May 14 night - PRs #688, #689 from backup branches | F-Deploy-G1-W + F-Deploy-G1-V (no real gate against autonomous merges) |

**Cross-section findings:**
- F-Deploy-G1-V + F-Deploy-G1-K (auto-merge.yml unconditional) together create the autonomous-merge mechanism. Both must change for the mechanism to be contained.
- F-Deploy-G1-W (zero required checks) means F-Deploy-G1-M (`--auto` out-of-band timing) fires immediately rather than after CI. This is what made PR #688/#689 merge within seconds rather than waiting for any verification.
- F-Deploy-G1-X (admin enforcement disabled) means *tightening* branch protection alone won't stop admin-driven merges. The owner-as-admin pattern is its own surface.

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

- [ ] All §2 failure events fully reconstructed with file:line references (§2.1, §2.2, §2.3, §2.4, §2.5, §2.6 all still TODO; partial reconstructions exist in §3.x summary tables)
- [⏳] All §3 files read end-to-end and documented (5/7 complete — §3.6, §3.7 TODO)
- [⏳] Deferred external file read: `.github/scripts/deploy-production.sh` (F-Deploy-G1-T resolver)
- [ ] §4 sub-form classification complete
- [ ] §5 fix-plan structure proposed
- [⏳] Audit committed to `docs/audit/F-Deploy-1_G1_Audit.md` (6 commits on `claude/f-deploy-1-g1-audit`; not yet pushed to origin or PR'd)
- [ ] Fix Plan v1.0 authored (separate gate, post-G1-closure)

**Gate A-G1 is incomplete until all checkboxes above are confirmed.** Day 1 progress: 21 findings filed, deploy + auto-merge surfaces fully documented, port and config mechanism documented, deferred items identified. Tomorrow: §3.6 + §3.7 + §2 + §4 + §5.

---

## §7 Next Action

**End of day 1: cleanup checkpoint committed, audit branch not yet pushed.**

Tomorrow's options, in suggested order:

1. **§3.6 — Branch protection state.** Smaller scope than the file-read sections. Run `gh api repos/angelcreator113/Episode-Canonical-Control-Record/branches/main/protection` and document. Confirms or refutes the "no required reviewers / admin-bypass" hypothesis from F-Stats-1 plan v1.2 §12.15. ~15-20 minutes.

2. **§3.7 — Local tooling identity / PR-opening mechanism.** Investigates the unresolved mystery from §3.2: what opens backup-branch PRs autonomously? Requires checking `git config --list`, env vars, VS Code extension state, GitHub repository settings. Larger scope, less predictable. ~45-60 minutes.

3. **Deploy-production.sh read.** Resolves F-Deploy-G1-T. Likely small (the script is presumably ~50-100 lines). Confirms F-Deploy-G1-H prod-side mechanism. ~30 minutes.

4. **§2 failure event narratives.** Mostly summarizable from existing audit knowledge (F-Stats-1 plan v1.2 §12.15, §12.19, Session PE Roster). ~45 minutes for full pass.

5. **§4 sub-form classification + §5 fix-plan structure proposal.** Synthesizes everything before this point. Cannot start until §3 is complete and §2 is at least partially reconstructed.

**Suggested ordering:** 3 (resolves deferred item) → 1 (small, completes §3) → 2 (investigation) → 4 → 5.

Audit branch state at end of day 1: 6 commits, not pushed.

```powershell
# To push when ready:
git push origin claude/f-deploy-1-g1-audit
```
