# Deploy #21 verification note (2026-10-10)

> **COLD-SESSION NOTE:** This file contains values derived from production: the box's git SHAs, pm2 process states and restart counts, the snapshot name, and /health bodies. A session that has to establish production state for itself must re-derive these values, not take them from here. The note is a record of one run, not a baseline.

> **Session scope:** read-only, from GitHub only (Actions API and the job log). No host, AWS account, database or Cognito was contacted. No workflow run was dispatched, approved, re-run or cancelled. The AWS account number and the deploy role's ARN appear in the job log, but are not copied here (§3, finding U1).

Task: #2857. Basis: `origin/main` at `58a0918c39a79d015fe6f5929430777f56009275`.

## Execution metadata

| Field | Value | Source |
|---|---|---|
| Workflow | `Deploy` (`.github/workflows/deploy.yml`) | Actions API, list runs |
| Run | #21, id `38061969068`, attempt 1 | Actions API |
| Event | `workflow_dispatch` on `main`, actor `angelcreator113` | Actions API |
| Target commit | `4b6087488ebfee8db2c091430ce37cb91a4b1485` (#2848) | Actions API `head_sha` |
| Created → job started | 15:01:55Z → 15:06:59Z (about 5 min waiting on the `production` environment's approval) | Actions API (`created_at`), job (`started_at`) |
| Job | `Deploy to production`, id `114241883701`, conclusion `success`, 15:06:59Z → 15:11:55Z | Actions API, list jobs |
| Log read | the whole job log (one job; every step, including the plan step), fetched through the GitHub MCP `get_job_logs` | this session |

The step summary (`$GITHUB_STEP_SUMMARY`) has no read endpoint in the API this session can reach. §2.8 records the summary step's script and the exact env values it rendered from, both of which are in the log. The rendered page itself was NOT READ.

## §1 Steps (MEASURED, Actions API list jobs)

| # | Step | Conclusion | Started → completed (UTC) |
|---|---|---|---|
| 2 | Check configuration | success | 15:07:00 → 15:07:00 |
| 3 | Check out the deploy helpers | success | 15:07:00 → 15:07:01 |
| 4 | Configure AWS credentials (OIDC) | success | 15:07:01 → 15:07:01 |
| 5 | Preflight — instance is SSM-managed and online | success | 15:07:01 → 15:07:05 |
| 6 | Plan (read-only, on the box) | success | 15:07:05 → 15:07:13 |
| 7 | Snapshot the database | success | 15:07:13 → 15:07:13 |
| 8 | Wait for the snapshot to be available | success | 15:07:13 → 15:10:18 |
| 9 | Deploy (fast-forward and build, on the box) | success | 15:10:18 → 15:11:16 |
| 10 | Migrate (on the box, if pending) | success | 15:11:16 → 15:11:29 |
| 11 | Restart and health check (on the box) | success | 15:11:29 → 15:11:53 |
| 12 | Public health check | success | 15:11:53 → 15:11:53 |
| 13 | Summary | success | 15:11:53 → 15:11:53 |
| 14 | Point to the snapshot and the runbook | **skipped** (expected: `if: failure()`) | — |

## §2 What the run did (MEASURED, log lines quoted with their timestamps)

### 2.1 Configuration and identity

```
2026-10-10T15:07:00.5458224Z Deploying 4b6087488ebfee8db2c091430ce37cb91a4b1485 to production.
2026-10-10T15:07:01.3242351Z 4b6087488ebfee8db2c091430ce37cb91a4b1485
2026-10-10T15:07:01.5507506Z Assuming role with OIDC
2026-10-10T15:07:01.6205165Z Authenticated as assumedRoleId <role id redacted>:deploy-38061969068
2026-10-10T15:07:05.4524508Z SSM ping status: Online
```

The checkout was sparse (`sparse-checkout: scripts/deploy`), at the target SHA, with `persist-credentials: false`. `GITHUB_TOKEN` permissions were `Contents: read` and `Metadata: read` (log lines 15:06:59.7879789Z–.7880548Z). The env carried `RDS_INSTANCE_ID: episode-control-dev`, `EC2_INSTANCE_ID: i-02ae7608c531db485`, `HEALTH_URL: https://primepisodes.com/health` and `SSM_DOCUMENT: PrimeStudios-Deploy`. The instance id matches `PROJECT_CONTEXT.md` §7's prod-box row.

### 2.2 Plan (the step's full on-box output)

```
2026-10-10T15:07:06.2664015Z SSM command ceed14df-ae86-4ed7-b2e3-46b6b893d12f (plan) sent.
2026-10-10T15:07:13.0516509Z ─── plan: on-box output ───
2026-10-10T15:07:13.0525797Z PLAN_OLD_SHA=97d3a4938544e38622eaed17bf0c87e7aa72c02d
2026-10-10T15:07:13.0526431Z PLAN_COMMITS=17
2026-10-10T15:07:13.0526692Z PLAN_MIGRATIONS=2
2026-10-10T15:07:13.0527079Z PLAN_MIGRATION=20261010120000-create-episode-lookbooks.js
2026-10-10T15:07:13.0527574Z PLAN_MIGRATION=20261010150000-create-website-slots.js
2026-10-10T15:07:13.0527923Z Ledger before the deploy (the box's current tree):
2026-10-10T15:07:13.0528261Z [pending-migrations] OK: 0 pending of 274 migration files checked.
2026-10-10T15:07:13.0528560Z pending-check exit 0
2026-10-10T15:07:13.0528750Z PLAN_OK=1
2026-10-10T15:07:13.0531911Z ─── plan: Success ───
```

No `PLAN_RESUME` line was printed, and the Summary step's env shows `RESUME:` empty (15:11:53.7234043Z). The box was behind the target, so this was not a resume.

### 2.3 Commit range: 17 commits (MEASURED twice)

The box reported 17 (`PLAN_COMMITS=17`, above). A local re-derivation in this session agrees:

```
$ git rev-list --count 97d3a49..4b60874
17
$ git diff --name-only 97d3a49 4b60874 | wc -l
90
$ git diff --name-only 97d3a49 4b60874 -- src/migrations
src/migrations/20261010120000-create-episode-lookbooks.js
src/migrations/20261010150000-create-website-slots.js
```

The 90 files match the deploy step's `(90 files)` (§2.5). Box before: `97d3a493` (#2826, 2026-10-09). The range, oldest first:

| SHA | Subject |
|---|---|
| `c87109a4` | feat(episodes): Lookbook data and routes (#2827) |
| `333ec900` | test(site): landing page QA fixes (#2828) |
| `677a6ae2` | feat(episodes): Lookbook tab (#2829) |
| `f9655720` | feat(episodes): style sheet template and panel (#2830) |
| `36fcd023` | feat(episodes): Lookbook in the Production checklist (#2831) |
| `557452b6` | docs(reads): Website content security and storage plan (#2832) |
| `63e101ce` | audit: file Rule 7 decision on deploy workflow (#2839) |
| `154b0218` | feat(site): Website slots and public content endpoint (#2833) |
| `e4d79692` | feat(site): Website admin page and published media (#2838) |
| `648eb469` | docs(tooling): agent rules for the deploy workflow (#2841) |
| `05965951` | docs: Website media go-live checklist (#2842) |
| `dbdeb11e` | docs(reads): current deploy and migration path (#2840) |
| `cf81423f` | feat(ci): Deploy workflow with snapshot and approval (#2843) |
| `67b8620a` | docs(design): amend landing spec for lavender and the site-content read (#2846) |
| `b55ac045` | feat(shows): a logo field in Show Settings, printed on the style sheet (#2851) |
| `2c40fe3b` | chore(tooling): guard the Deploy workflow scripts (#2847) |
| `4b608748` | docs: point living docs at the Deploy workflow (#2848) |

### 2.4 Snapshot

```
2026-10-10T15:07:13.8968592Z deploy-4b6087488ebf-38061969068-1	creating
2026-10-10T15:07:13.9713384Z Snapshot deploy-4b6087488ebf-38061969068-1 requested.
2026-10-10T15:07:14.5410625Z 15:07:14 deploy-4b6087488ebf-38061969068-1: creating 0%
2026-10-10T15:08:46.5038630Z 15:08:46 deploy-4b6087488ebf-38061969068-1: creating 1%
2026-10-10T15:10:18.5304575Z 15:10:18 deploy-4b6087488ebf-38061969068-1: available 100%
```

The snapshot `deploy-4b6087488ebf-38061969068-1` was `available` 3 min 5 s after it was requested. It was available before the deploy phase began (15:10:18.6057623Z), so before any migration. The name follows the workflow's pattern `deploy-<sha:12>-<run id>-<attempt>`.

### 2.5 Deploy (fast-forward and build)

```
2026-10-10T15:10:19.2514869Z SSM command bf04bb48-2185-4d62-98ef-cf1f4c135c49 (deploy) sent.
2026-10-10T15:11:16.1643388Z DEPLOY_BACKUP=~/dist-backup-20261010T151020Z-4b6087488ebf
2026-10-10T15:11:16.1643970Z DEPLOY_FROM=97d3a4938544e38622eaed17bf0c87e7aa72c02d
2026-10-10T15:11:16.1644656Z Fast-forwarded 97d3a4938544e38622eaed17bf0c87e7aa72c02d -> 4b6087488ebfee8db2c091430ce37cb91a4b1485 (90 files).
2026-10-10T15:11:16.1647030Z ✓ built in 47.27s
2026-10-10T15:11:16.1647299Z DEPLOY_OK=1
```

The previous `dist` was backed up before the build. The phase prints only the last 3 lines of the build log (by design, `scripts/deploy/workflow-deploy.sh` `tail -3`), so the two other build lines in the log are the two largest chunks (`WorldAdmin` 426.43 kB, `canvas-vendor` 485.68 kB). No package change stopped the run.

### 2.6 Migrate: both files applied

```
2026-10-10T15:11:29.2725420Z [pending-migrations] 2 pending of 276 migration files checked (run order):
2026-10-10T15:11:29.2725847Z   pending: 20261010120000-create-episode-lookbooks.js
2026-10-10T15:11:29.2726131Z   pending: 20261010150000-create-website-slots.js
2026-10-10T15:11:29.2726467Z pending-check exit 1
2026-10-10T15:11:29.2726975Z Running sequelize-cli db:migrate (NODE_ENV=production, the migration user from /home/ubuntu/.episode-migrate.env)...
2026-10-10T15:11:29.2729271Z == 20261010120000-create-episode-lookbooks: migrating =======
2026-10-10T15:11:29.2729783Z == 20261010120000-create-episode-lookbooks: migrated (0.068s)
2026-10-10T15:11:29.2730282Z == 20261010150000-create-website-slots: migrating =======
2026-10-10T15:11:29.2730759Z == 20261010150000-create-website-slots: migrated (0.032s)
2026-10-10T15:11:29.2731127Z db:migrate exit 0
2026-10-10T15:11:29.2731584Z [pending-migrations] OK: 0 pending of 276 migration files checked.
2026-10-10T15:11:29.2732048Z MIGRATE_RAN=1
```

The ledger went from 274 checked / 0 pending before the fast-forward, to 276 / 2 pending after it, to 276 / 0 pending after `db:migrate`. Both files ran, in timestamp order. At the basis, `20261010120000-create-episode-lookbooks.js` creates `episode_lookbooks` and `episode_lookbook_images`, and `20261010150000-create-website-slots.js` creates `website_slots`. All three tables have `deleted_at` (MEASURED by reading the files; the database itself was not read).

### 2.7 Restart and the two health checks

```
2026-10-10T15:11:29.9303429Z SSM command 3be3002f-ff40-4a7b-8911-bbd04520e932 (restart) sent.
2026-10-10T15:11:53.5401261Z Before: episode-api-prod-hotfix online restarts=153; episode-worker stopped restarts=4
2026-10-10T15:11:53.5402015Z RESTART_HEALTH={"status":"healthy","timestamp":"2026-10-10T15:11:41.588Z","uptime":9.250843975,"version":"v1","environment":"production","database":"connected"}
2026-10-10T15:11:53.5402992Z After: episode-api-prod-hotfix online restarts=154; episode-worker online restarts=4
2026-10-10T15:11:53.5403784Z RESTART_HEAD=4b6087488ebfee8db2c091430ce37cb91a4b1485
2026-10-10T15:11:53.5404179Z RESTART_OK=1
2026-10-10T15:11:53.7117540Z Healthy: {"status":"healthy","timestamp":"2026-10-10T15:11:53.696Z","uptime":21.358223813,"version":"v1","environment":"production","database":"connected"}
```

- **On-box /health:** `healthy`, `database: connected`, `environment: production`, uptime 9.25 s.
- **Public health check (`https://primepisodes.com/health`):** `healthy`, `database: connected`, on its first try.
- **Same process:** the two bodies come from the same restarted process. Their timestamps are 12.108 s apart (15:11:41.588 → 15:11:53.696), and the uptimes are 12.107 s apart (9.251 → 21.358).
- **Box head after the restart:** it reports the target (`RESTART_HEAD` = `TARGET_SHA`). The step's own check against `TARGET_SHA` passed.

### 2.8 Summary step inputs

The Summary step rendered from this env (15:11:53.7233602Z–.7235168Z):

```
JOB_STATUS: success
OLD_SHA: 97d3a4938544e38622eaed17bf0c87e7aa72c02d
RESUME: 
COMMITS: 17
MIGRATIONS: 2
SNAP: deploy-4b6087488ebf-38061969068-1
MIGRATE_RAN: 1
RESTART_OUTCOME: success
HEALTH_OUTCOME: success
```

By the step's script, the summary read "Deploy success" with:
- Commit `4b608748…`;
- Box before `97d3a493…`;
- Commits in range 17;
- Snapshot `deploy-4b6087488ebf-38061969068-1`;
- New migration files 2;
- Migrations run yes;
- Restart and on-box /health success;
- Public health success;
- the two migration files listed.

This is INFERRED from the script and env, not read from the rendered page.

**Verdict: Deploy #21 did what the workflow says, in order.** It snapshotted before migrating, applied both migrations, restarted the API and the worker, and finished healthy on the box and in public. The box is at `4b608748`.

## §3 Wrong or unexpected

| # | Finding | Evidence | Weight |
|---|---|---|---|
| U1 | **The public job log prints the AWS account number and the deploy role's full ARN.** The repository is public (MEASURED, `list_repos`: `"visibility":"public"`), so anyone can read the Actions logs. `AWS_ROLE_ARN` is a repository variable, not a secret, so it is not masked. It appears in the `Check configuration` env block and the `configure-aws-credentials` inputs. The assumed-role id is also printed. Not a credential (OIDC trust still governs who can assume the role, and the instance id and RDS name are already public in `PROJECT_CONTEXT.md`), but it conflicts with F-Deploy-1's recording rule ("No account number, ARN … appears"). | `15:07:00.5308286Z AWS_ROLE_ARN: arn:aws:iam::<redacted>:role/prime-studios-deploy`; `15:07:01.4185370Z role-to-assume: …`; `15:07:01.6205165Z Authenticated as assumedRoleId …` | Low; Evoni's call. The option is to store `AWS_ROLE_ARN` as a secret, so it is masked. The role's OIDC trust condition is unaffected either way. |
| U2 | **The worker had been stopped, and this run started it.** `episode-worker` was `stopped` going in, and the restart phase brought it `online` with its restart count unchanged at 4. `PROJECT_CONTEXT.md` §7 (prod-box row, Deploys BH to BL, 2026-09-27/28, ATTESTED) records that "`episode-worker` stayed stopped throughout". So it had been off since at least late September, and Deploy #21 is the first time it has run since. Whatever it runs (queued jobs, background processing) is live again from 15:11:53Z. | `15:11:53.5401261Z Before: … episode-worker stopped restarts=4`; `15:11:53.5402992Z After: … episode-worker online restarts=4` | **The one finding worth Evoni's decision now:** was the worker off on purpose? If so, it should be stopped again, and `workflow-deploy.sh` should restart it only if it was online before (a small PR). Task #2837's answer was "restart the worker too"; that answer didn't weigh a worker that was deliberately off. |
| U3 | **The API's restart count went from 13 to 153 in about 12 days.** The last filed count is 13, after Deploy BL on 2026-09-28 (`PROJECT_CONTEXT.md` §7, ATTESTED); this run found 153. pm2 counts crash-restarts as well as deploys. Roughly a dozen deploys can't account for 140 restarts, so most were probably crash or memory restarts (INFERRED). The log can't say which. | `15:11:53.5401261Z Before: episode-api-prod-hotfix online restarts=153` | INFERRED concern; Evoni's read of the pm2 logs would answer it. |
| U4 | **The API's process name is still `episode-api-prod-hotfix`.** That is the split-brain era's name (`docs/audit/F-Deploy-1_2026-06-26_Sec5_ReVerify_Evidence.md` lists `episode-api`, `episode-worker` and `episode-api-prod-hotfix`). The log shows only the two apps the script asks about, so it can't say whether `episode-api` still exists. | `15:11:53.5401261Z` | Information; matches `workflow-deploy.sh`'s configured `API_APP`. |
| U5 | **`db:migrate` also loaded the app's `.env`.** `src/config/sequelize.js` calls `require('dotenv').config()`, which injected 29 variables from `.env`. The migration user was passed in the environment first, and dotenv doesn't override variables already set by default, so the migration user should have won. INFERRED: the log redacts the user name, so the run cannot show which user connected. | `15:11:29.2728019Z [dotenv@17.3.1] injecting env (29) from .env` | Low. A future check could print a redacted marker of which source supplied `DB_USER`. |
| U6 | **About 25 s of mixed versions.** The deploy phase rebuilt `frontend/dist` in place at 15:11:16Z, while the API kept running the old code until its restart (on-box /health at 15:11:41Z showed uptime 9.25 s, so it restarted at about 15:11:32Z). For about 16–25 s the new frontend was served by the old API, with the two new tables migrated from 15:11:29Z. | §2.5, §2.6, §2.7 timestamps | INFERRED, low: the new routes only exist in the new code, and the window is short. |
| U7 | **Every push to `main` now queues a Deploy run that waits for approval.** The workflow triggers on `push` to `main` as well as `workflow_dispatch`, and `DEPLOY_ENABLED` is now `true`. Outside run #21: run #22 (`babd933f`, push) is `waiting`, run #23 (`4816a6ef`, push) is `cancelled` (at 16:08:22Z, the second #24 was created; INFERRED, superseded in the concurrency queue), and run #24 (`58a0918c`, push) is `pending`. #20 (push, before `DEPLOY_ENABLED`) was `skipped`. | Actions API list runs for `deploy.yml` | Expected by design. Noted because approving any queued run deploys everything on `main` up to that run's SHA. Rejecting stale ones keeps the queue honest. No session approves or cancels them. |
| U8 | **Node 20 deprecation warning** for `actions/checkout@v4` and `aws-actions/configure-aws-credentials@v4`, forced onto Node 24 by the runner. | `15:11:53.9987306Z ##[warning]Node.js 20 is deprecated…` | Low; a later bump of those action pins. |

Nothing in the log shows a failed check, a retry, a non-zero exit outside the designed `pending-check exit 1`, or an unredacted credential.

## §4 What this note does not establish

- That the snapshot still exists, or its size: only the run's own `describe-db-snapshots` lines were read.
- The rows or columns of the new tables: no database was read.
- The rendered step-summary page: §2.8 reconstructs it.
- Why the worker was stopped (U2), or what the API restarts were (U3).
