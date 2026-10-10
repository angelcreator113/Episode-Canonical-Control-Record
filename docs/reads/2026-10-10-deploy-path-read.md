# Read: how production is deployed and migrated today

- **Basis:** `origin/main` at `557452b626593fcaf41bbac2d3da49316a8b78ba` (#2832). Every `path:line` below is at this SHA.
- **Date:** 2026-10-10
- **Task:** #2836. It feeds #2837 (the Deploy workflow), under Evoni's Rule 7 decision filed by #2834 (PR #2839, unmerged at this basis).
- No host, AWS, database, or Cognito contact. No code or register change.

Markers: **MEASURED** means a `path:line` read at the basis SHA. **ATTESTED** means Evoni's own account, as a filed deploy record states it. **INFERRED** means a conclusion drawn from measured code or records, with the reason given.

Recording rule: no account number, ARN, host name, IP address, database user name or credential is written here, even where a file at the basis carries one.

---

## §0 Summary

1. **Production is deployed by hand today, by Evoni on the box.** The path is `scripts/deploy-prod.sh` (fast-forward, `frontend/dist` backup, `vite build`, pending-migration check, `pm2 restart`, `/health` poll). When a migration is pending, the script stops, and Evoni runs `npx sequelize-cli db:migrate` by hand as a privileged database user whose password she types at a hidden prompt (§3). No workflow deploys production. **MEASURED** + **ATTESTED**
2. **None of the five workflows is usable as the Deploy workflow.** `deploy-production.yml` is disabled and uses SSH, long-lived AWS keys and database secrets stored in GitHub, which the decision rules out (§1.3). `deploy-dev.yml` already has the right shape (OIDC and SSM Run Command, no SSH, no stored secrets), but it targets the dev app, port 3002 and the `development` config (§1.2). **MEASURED**
3. **The proposed workflow (§6)** reuses `deploy-prod.sh`'s checks and `deploy-dev.yml`'s OIDC + SSM mechanics. It adds an RDS snapshot before migrations and runs the migration on the box with a credential that never leaves it. **INFERRED**
4. **Two things Evoni must decide before #2837 can be finished:** where the migration credential lives on the box (today it lives nowhere: §3.3), and whether the workflow may run `npm ci` when package files change (today the script refuses: §2.1).
5. **The biggest exposure to close (§9):** SSM's stock `AWS-RunShellScript` document runs any command as root. A role allowed to send it can read the server `.env`, pm2's saved dump and the instance role's credentials. A custom SSM document that runs one fixed script closes this. **INFERRED**

---

## §1 Workflows under `.github/workflows/`

Five files. **MEASURED** throughout.

| File | `name:` | Trigger | Reaches a server? | Status at basis |
|---|---|---|---|---|
| `auto-merge-to-dev.yml` | Auto-merge to Dev (`:1`) | `push` to `claude/**` (`:23-26`) | No; pushes to `dev` (`:228`) | `disabled_manually` per `DEVELOPMENT_WORKFLOW.md` §7 table (row "Enabling `Deploy to Production` or `Auto-merge to Dev`") |
| `deploy-dev.yml` | Deploy to Development (`:1`) | `workflow_dispatch` only (`:67-68`) | Yes, SSM Run Command (`:438-444`) | Runtime-disabled (header `:37-47`; `F-Deploy-1_Fix_Plan_v1.50.md` §2, §5) |
| `deploy-production.yml` | Deploy to Production (`:32`) | `workflow_dispatch` with `confirm`/`reason` inputs (`:34-43`) | Yes, SSH and scp (`:205-395`) | `disabled_manually` (header `:1-30`; `F-Deploy-1_Fix_Plan_v1.54.md` §5) |
| `pr-validation-block-check.yml` | PR Validation Block Check (`:1`) | `pull_request` opened/edited/synchronize/reopened (`:13-15`) | No | Active |
| `validate.yml` | Validate (`:1`) | `pull_request` and `push` on `main`/`dev`, plus `workflow_dispatch` (`:3-8`) | No | Active |

### §1.1 `auto-merge-to-dev.yml`

On a push to any `claude/**` branch, it skips if the commit message carries `[skip-automerge]` (`:59`). Otherwise it merges the branch into `dev`, preferring `dev` on conflict (`:104`), builds the frontend if it changed (`:180`), runs `node --check` on `src/**/*.js` (`:221`), pushes `dev` (`:228`) and comments on issue #708 when a conflict was resolved (`:242-289`). Its secrets are a GitHub App id and private key (`:82-83`). It has no AWS, SSH or database access. The push to `dev` does not trigger `deploy-dev.yml`, which has no push trigger (§1.2). This is the workflow behind the 2026-05-30 incident (`F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md`, repository root), when it did chain into a deploy.

### §1.2 `deploy-dev.yml`: the shape to reuse

The header (`:3-65`) records the 2026-07-10 rewrite (`F-Deploy-1_Fix_Plan_v1.30.md` §5, FD-57) that replaced SSH with SSM. Prerequisites P1–P5 are "all gated" (`:49-64`).
- Settings:
  - `concurrency: deploy-dev`, `cancel-in-progress: false` (`:70-72`)
  - `permissions: contents: read, id-token: write` (`:74-76`)
  - `environment: development` (`:207-209`)
- Job `test` (`:85`): a Postgres service; `npm run migrate:up` against the test database (`:122`); `npm test` (`:128`).
- Job `build` (`:136`): `npm ci --production` plus `sequelize-cli` (`:151`), the frontend build (`:174`), and a tarball that includes `node_modules` (`:182`).
- Job `deploy` (`:203`):
  - **OIDC** via `aws-actions/configure-aws-credentials@v4` with a role ARN written into the file (`:217-221`; the comment says the role "does not exist yet").
  - Preflight: `aws ssm describe-instance-information` by tag (`:226-232`).
  - The artifact and an on-box script are uploaded to S3 and presigned (`:417-428`).
  - `aws ssm send-command --document-name "AWS-RunShellScript"` (`:438-444`) runs `curl … && sudo -u ubuntu … bash /tmp/deploy-on-box.sh` (`:437`).
  - It polls `get-command-invocation` (`:451`) and prints the full on-box stdout into the job log (`:460-465`).
- The on-box script (`:243-414`):
  - It reads DB settings from Secrets Manager through the instance role: `eval "$(node scripts/print-db-env.js)"` (`:321`; `scripts/print-db-env.js:5-8`, `:50`).
  - It runs `node scripts/bootstrap-sequelize-meta.js` (`:328`), then `npx sequelize-cli db:migrate --env development` (`:332`).
  - It copies the frontend to `/var/www/html` and restarts nginx (`:342-349`).
  - It runs `pm2 startOrRestart ecosystem.dev.config.js --only episode-api,episode-worker --update-env` and `pm2 save` (`:267-271`).
  - It checks `/health` on port 3002 (`:390-398`).
- Secrets: it references no `secrets.*` or `vars.*`.

### §1.3 `deploy-production.yml`: not reusable

The header says it is disabled and that "THE CODE ON PRODUCTION DID NOT COME FROM THIS WORKFLOW" (`:1-30`). What conflicts with the decision:
- **Long-lived AWS keys:** `secrets.AWS_ACCESS_KEY_ID`, `secrets.AWS_SECRET_ACCESS_KEY` (`:179-184`).
- **SSH:** `secrets.EC2_SSH_KEY`, `EC2_HOST`, `EC2_USER` (`:191-193`). The key is written to a runner file (`:205`, `:315`), and `StrictHostKeyChecking=no` is used (`:382`).
- **Database credentials in GitHub:** `secrets.PRODUCTION_DATABASE_URL` (`:293`, `:382`) and `PROD_DB_HOST/NAME/USER/PASSWORD` (`:329-332`).
- **It writes the production `.env`:** DB credentials plus `FAL_KEY` and `REMOVEBG_API_KEY` are scp'd to the box and merged into it (`:323-367`).
- **It migrates from the runner:** `npx sequelize-cli db:migrate --env production` with `DATABASE_URL` from secrets (`:291-299`). `src/config/sequelize.js`'s production block ignores `DATABASE_URL` (`:140-153`), so this step would read empty `DB_*` values.
- **Its backup only echoes:** the snapshot command is commented out (`:284-289`).
- **Its health check accepts 503 as a pass** on the box (`.github/scripts/deploy-production.sh:261-282`). Externally it polls `https://primepisodes.com/health` and `https://www.primepisodes.com/health`, expecting 200 (`:404-419`).
- **Workflow inputs are inlined** into `run:` via `${{ }}` (`:54`, `:59`, `:307`, `:431`), against the FD-29 rule stated at `auto-merge-to-dev.yml:3-21`.

`DEVELOPMENT_WORKFLOW.md` §7 (table, "Enabling `Deploy to Production`…") already records three of these defects.

### §1.4 `pr-validation-block-check.yml` and `validate.yml`

These are CI only. `pr-validation-block-check.yml` runs `node scripts/check-pr-validation-block.js` on the PR body passed through `env:` (`:32-35`). `validate.yml` runs four jobs, `cost-audit` (`:14`), `route-validation` (`:23-57`), `eslint` (`:62-78`) and `tests` with a Postgres service (`:80-128`), plus `frontend-tests` (`:130-147`). Neither touches a server or a secret. `validate.yml` also runs on `push` to `main` (`:6-7`), so a push to `main` will start it alongside the Deploy workflow.

---

## §2 Deploy scripts and PM2

### §2.1 `scripts/deploy-prod.sh`: Evoni's current deploy (Task #2161)

**MEASURED.** It is run by Evoni on the box from the repo root (`:14-15`) and refuses inside a Claude Code session (`:121-123`). Default app: `episode-api-prod-hotfix` (`:26`). Health URL: `http://localhost:3000/health` (`:28`). In order:

| Step | Lines | What it does |
|---|---|---|
| a | `:135-143` | Records `HEAD`; stops if tracked files are modified |
| b | `:146-155` | `git fetch origin`; target is `origin/main`; exits 0 if nothing to deploy |
| c | `:158-172` | **Stops if any `src/migrations/` file or any `package*.json`/lock file changes in the range.** It never runs migrations or `npm ci` (`:11-12`) |
| d | `:175-208` | `cp -a frontend/dist ~/dist-backup-<UTC>`; `git merge --ff-only`; `cd frontend && npx vite build` (log to a file) |
| e | `:211-229` | `NODE_ENV=production node scripts/check-pending-migrations.js`; prints the redacted target line; stops unless exit 0; asks "Is that the database the API uses?" |
| f | `:232-240` | Counts `ANTHROPIC_API_KEY` lines in `.env` (value not read) |
| g | `:243-259` | Asks, then `pm2 restart <app>` (or `--update-env` + `pm2 save`) |
| h | `:262-279` | Polls `/health` every 3 s up to 60 s, requiring `"status":"healthy"` **and** `"database":"connected"` |
| i | `:282-319` | Reads restart count from `pm2 jlist` (only `restart_time` is extracted), the "Ready" log line, and `[CFO]` audit lines |
| — | `:326-352` | Prints a summary for the deploy record, passed through `redact()` (`:65-70`, IPs and AWS host names) |

On failure after the fast-forward, it prints rollback steps as text and runs none (`:73-111`).

The script restarts **only** the API app. `episode-worker` runs the same tree (`ecosystem.config.js:103-128`) and is not restarted by this path. **INFERRED**: the worker keeps running old code after a deploy until its own restart. #2837 should decide whether the workflow restarts it.

### §2.2 `.github/scripts/deploy-production.sh`: legacy, called only by `deploy-production.yml`

**MEASURED.**
- It runs with `set -x` (`:3`). Under it, `.env` values are grepped out for `DB_HOST DB_NAME DB_USER DB_PASSWORD COGNITO_USER_POOL_ID COGNITO_CLIENT_ID JWT_SECRET` (`:12-17`). **INFERRED**: xtrace prints each value into the job log.
- It runs `git fetch` + `git reset --hard origin/main` + `git clean -fd` (`:106-108`), then `npm ci` (`:119`).
- It migrates with `NODE_ENV=production npm run migrate:up` (`:126-128`). Note that `package.json:28` pins `NODE_ENV=development` inside that script, so the effective env is `development`.
- It runs `pm2 delete` and then `pm2 start ecosystem.config.js --only episode-api-prod-hotfix --env production` (`:231-239`).

### §2.3 `scripts/deploy/` (29 files): legacy, not on the current path

**MEASURED.** These are PowerShell and shell helpers from before the freeze. They carry hard-coded IPs and local key paths and use `ssh`/`scp`: `deploy-backend-ec2.ps1`, `deploy-dev-site.ps1`, `deploy-frontend-fix.ps1`, `diagnose-backend.ps1`, `diagnose-ec2.ps1`. The rest are RDS/Route 53 describe helpers, nginx configs, and `run-migration-remote.sh` (raw SQL from `.env` DB_* values, not sequelize). `verify-database.ps1` reads `DB_PASSWORD` from a local `.env` and writes it into `verify-db-temp.js` (`:25-33`, `:55`, `:111-113`). None is called by a workflow. None calls Cognito, `ssm get-parameter` or `secretsmanager get-secret-value`.

### §2.4 PM2 ecosystem files

**MEASURED.**
- **`ecosystem.config.js`** (production):
  - It loads `.env` when pm2 evaluates it (`:2`) and copies into every app's env:
    - DB_* (`:12-20`)
    - Cognito pool and client ids (`:33-35`)
    - `JWT_SECRET` (`:38`)
    - `ANTHROPIC_API_KEY` and other API keys (`:46-62`)
  - App `episode-api-prod-hotfix`: `/home/ubuntu/episode-metadata/src/server.js`, port 3000, `NODE_ENV=production` (`:70-101`). App `episode-worker`: `src/workers/start.js` (`:103-128`).
  - Because pm2 holds this env, `pm2 jlist` and `~/.pm2/dump.pm2` carry `DB_PASSWORD` in clear. `DEVELOPMENT_WORKFLOW.md` §7.2's check compares that field from both.
- **`ecosystem.dev.config.js`**: apps `episode-api` (port 3002) and `episode-worker`, in the same directory (`:51-65`, `:74-90`).
- **`start.sh`**: local development launcher (port 3002); not a deploy script.

---

## §3 How migrations are run

### §3.1 Tool and config — MEASURED

- Tool: `sequelize-cli` (`package.json:116`). `.sequelizerc:4-7` points it at the config `src/config/sequelize.js` and the migrations folder `src/migrations/`.
- `src/config/sequelize.js` loads `.env` with `dotenv` (`:10`) and exports one block per `NODE_ENV` (`:198-202`).
  - **`production`** uses discrete `DB_USER`/`DB_PASSWORD`/`DB_NAME`/`DB_HOST`/`DB_PORT` only. It never reads `DATABASE_URL` (`:140-153`). SSL is on unless `DB_SSL=false` (`:161-169`), and there is a 30 s `statement_timeout` (`:171`).
  - **`development`** prefers `DATABASE_URL` over DB_* (`:84-92`).
- `dotenv` does not overwrite a variable already set in the environment, so `DB_USER=… DB_PASSWORD=… npx sequelize-cli db:migrate` overrides the `.env` user for that one command. **INFERRED** from dotenv's default behaviour. This is how the deploy records below supply a different user.
- npm scripts: `migrate` and `migrate:up` pin `NODE_ENV=development` (`package.json:27-28`); `db:setup:production` pins `NODE_ENV=production` (`:38`). `deploy:production` is a stub that prints the freeze message and exits 1 (`:42`).

### §3.2 The read-only check — MEASURED

`scripts/check-pending-migrations.js` sends only `SELECT name FROM "SequelizeMeta"` (`:20-24`, `:32`). It lists `src/migrations/*.js` files with no ledger row in sequelize-cli's run order (`:35-40`). Exit codes: 0 nothing pending, 1 pending, 2 ledger unreadable (`:13-18`). It must be run with `NODE_ENV=production` (`DEVELOPMENT_WORKFLOW.md` §7.1 step 2).

### §3.3 What Evoni actually runs — ATTESTED

From the deploy records, newest first:
- `F-Deploy-1_Deploy_2026-09-30_CT.md` §0 items 1–3: `deploy-prod.sh` stopped on the pending migration. By hand: fast-forward, check (1 pending of 230), then "`npx sequelize-cli db:migrate` as a separate database user (name left out). Its password was entered at a hidden prompt and unset afterwards." Re-check: 0 pending.
- `F-Deploy-1_Deploy_2026-09-30_CN.md` §0 item 3: the same, "with `NODE_ENV=production`, run as a privileged database user".
- `F-Deploy-1_Deploy_2026-09-27_BH.md` §0: "with `NODE_ENV=production`", the check run as the app's user, the migration as a different, privileged user.
- `F-Deploy-1_Deploy_2026-09-26_AJ.md` (preamble): the first deploy whose migrations went in through `sequelize-cli db:migrate` rather than by hand.

So today's migration command is, in shape: `NODE_ENV=production DB_USER=<privileged user> DB_PASSWORD=<typed at a hidden prompt> npx sequelize-cli db:migrate`, run on the box from the repo root after the fast-forward and before the restart.

**INFERRED, needs Evoni:** the app's own database user is not used for migrations, which suggests it lacks the DDL rights they need. **The privileged credential is not stored on the box today.** It exists only when Evoni types it. Decision item 5 says database credentials "stay on the server", so the workflow needs a server-side home for this credential that does not exist yet (§8).

---

## §4 Health endpoint — MEASURED

- `GET /health` (`src/app.js:360-367`) returns `collectHealth()` (`:301-358`) reduced to `PUBLIC_HEALTH_FIELDS` = `status, timestamp, uptime, version, environment, database` (`:293`). `database` is `connected` after `sequelize.authenticate()` succeeds (`:318-320`). The status is 200, or 503 with `database: disconnected` and `status: degraded` when `authenticate()` throws (`:344-352`, `:357`). The load balancer expects 200 (`DEVELOPMENT_WORKFLOW.md` §7.1, last paragraph, citing `F-Deploy-1_Fix_Plan_v1.56.md` §1).
- `GET /_diag/health` (`:370-376`) returns the full object, including `config.DB_HOST`/`DB_NAME`, but only to a loopback request (`isLocalDiagnosticRequest`). The workflow should not call it.
- `GET /api/v1/health` redirects to `/health` (`:379`).
- Traffic path: load balancer → the box's app on port 3000, which also serves `frontend/dist` (`src/app.js:1694`; `DEVELOPMENT_WORKFLOW.md` §7.3). A public `HEALTH_URL` therefore tests the same process as the on-box `localhost:3000/health`.

---

## §5 What F-Deploy-1 established about cold-session verification — citation

- `F-Deploy-1_Fix_Plan_v1.13.md` Sec 3: the session that produced evidence is "WARM and disqualified" from priming the next step. "A cold session opening [3] inherits nothing from the warm session that produced this record."
- `F-Deploy-1_Fix_Plan_v1.15.md` (FD-42, precondition finding): a cold off-box session could not verify the canon database, because "the working canon credential exists only on-box" (`.env` and pm2's in-memory pool). Off-box verification aborted at credential and identity on every attempt.
- `F-Deploy-1_Fix_Plan_v1.23.md` §2–§3 (FD-46): a phase-position error propagated through two documents until "live reads broke it". Cold sessions treat live reads over inherited claims.

**INFERRED, for #2837:**
- **Verify each run live.** A run should prove its own preconditions in the run itself: the pending check before and after, `/health` with the database connected, and the deployed SHA read back from the box. It should not trust an earlier deploy record.
- **Verify on the box.** FD-42's lesson matches decision item 5. The database is reachable with working credentials only from the box, so database verification belongs in the on-box script, not on the runner.

---

## §6 Proposed Deploy workflow, in order — INFERRED

Assumes the variables named in #2837: `AWS_ROLE_ARN`, `AWS_REGION`, `RDS_INSTANCE_ID`, `EC2_INSTANCE_ID`, `HEALTH_URL`.

**Workflow settings**
- `on: push: branches: [main]` plus `workflow_dispatch`.
- `permissions: { contents: read, id-token: write }`.
- `concurrency: { group: deploy-production, cancel-in-progress: false }`. With `false`, a running deploy is never cancelled mid-migration, and GitHub keeps only the newest *pending* run in the group, which replaces older pending ones (the behaviour #2837 asks for).
- One job with `environment: production`, so every run waits for Evoni's approval before any step runs.
- No `secrets.*` anywhere. Inputs, if any, go through `env:` (FD-29).

**Steps**

| # | Where | Step | Stops the run on |
|---|---|---|---|
| 1 | runner | Checkout at `github.sha`; record the SHA | — |
| 2 | runner | OIDC: `aws-actions/configure-aws-credentials` with `role-to-assume: ${{ vars.AWS_ROLE_ARN }}` | role not assumable |
| 3 | runner → SSM | Preflight: the instance is SSM-managed and `Online` (`ssm describe-instance-information` filtered to `EC2_INSTANCE_ID`, as `deploy-dev.yml:226-232` does by tag) | offline |
| 4 | box via SSM | **Plan (read-only):** tree clean (as `deploy-prod.sh:140`); `git fetch`; target SHA is on `origin/main` and a fast-forward of `HEAD`; list migration and package files in the range (as `:159-160`); `check-pending-migrations.js` before (expect exit 0). Prints the plan | dirty tree; not a fast-forward; check exit ≠ 0 |
| 5 | runner → RDS | **Snapshot:** `rds create-db-snapshot --db-instance-identifier $RDS_INSTANCE_ID --db-snapshot-identifier deploy-<sha12>-<run_id>` | create fails |
| 6 | runner → RDS | **Wait:** `rds wait db-snapshot-available` (the default waiter gives up after about 30 minutes; loop it if the instance's snapshots run longer). Check `Status == available` with `describe-db-snapshots` | not available |
| 7 | box via SSM | **Deploy:** back up `frontend/dist` (`deploy-prod.sh:180-190`); `git merge --ff-only <sha>`; `npm ci` only if package files changed (see §8 decision 2); `cd frontend && npx vite build` | any non-zero exit |
| 8 | box via SSM | **Migrate:** only if step 4 listed pending files: load the privileged credential from the server-side file (§8) into this one process's environment; run `NODE_ENV=production npx sequelize-cli db:migrate`; re-run the pending check and expect exit 0 | migrate or re-check ≠ 0 |
| 9 | box via SSM | **Restart:** `pm2 restart episode-api-prod-hotfix` (plain, as `deploy-prod.sh:257`). Whether to also restart `episode-worker` is #2837's decision (§2.1) | non-zero |
| 10 | box via SSM | **On-box health:** poll `localhost:3000/health` until healthy and database connected (as `deploy-prod.sh:262-277`); print `git rev-parse HEAD` | not healthy in 60 s |
| 11 | runner | **Public health:** poll `${{ vars.HEALTH_URL }}`, expecting 200 with `"database":"connected"` | not healthy |
| 12 | runner | **Report:** `$GITHUB_STEP_SUMMARY`: SHA before and after, snapshot id, migrations run (names from step 4), pending count after, health body, restart count | — |
| on failure | runner | Print the snapshot id and the runbook path; no automatic rollback (#2837 item 4) | — |

**How the box runs it.** All box steps run through **SSM Run Command** (no SSH), as `deploy-dev.yml:432-470` does. Two changes from `deploy-dev.yml`:
- **(a) A custom SSM document instead of `AWS-RunShellScript`.** The document accepts only a commit SHA (regex `^[0-9a-f]{40}$`) and a phase name from a fixed list (`plan`, `deploy`, `migrate`, `restart`). It runs one script as `ubuntu`: `sudo -u ubuntu -H bash -lc` (a login shell, so nvm's Node 20 is on `PATH`, as `deploy-dev.yml:437` relies on). This is what keeps the role from being "run anything as root" (§9 item 1).
- **(b) The script's content comes from the reviewed commit, not from S3.** The document runs `git fetch` and then `git show <sha>:scripts/deploy/<script>` from the box's own clone. Nothing is presigned, and no artifact is built on the runner. The box builds in place, as Evoni does today.

**What the on-box script must never do:** `set -x`; print `.env`; run `pm2 describe`, `pm2 env`, `pm2 prettylist` or an unfiltered `pm2 jlist`; call `/_diag/health`; call `aws`. Every line it prints goes through `deploy-prod.sh`'s `redact()` (`:65-70`). SSM returns at most 24,000 characters of stdout to the job log (`deploy-dev.yml:460-461`).

---

## §7 Permissions the workflow role needs — INFERRED

The role is assumed only by GitHub OIDC. Trust conditions:
- `token.actions.githubusercontent.com:aud` = `sts.amazonaws.com`
- `token.actions.githubusercontent.com:sub` = `repo:angelcreator113/Episode-Canonical-Control-Record:environment:production`

Pinning to the environment means only a job that has passed Evoni's approval can assume it. Session duration: the 1-hour default.

| Purpose | Actions | Resource |
|---|---|---|
| Take the snapshot | `rds:CreateDBSnapshot` | the canon DB instance ARN, and snapshot ARNs `deploy-*` |
| Tag it (only if tags are passed on create) | `rds:AddTagsToResource` | snapshot ARNs `deploy-*` |
| Wait for and describe it | `rds:DescribeDBSnapshots` | snapshot ARNs `deploy-*` (and the instance ARN, for a filter by instance) |
| Run the on-box phases | `ssm:SendCommand` | the custom document's ARN **and** the one instance ARN; never `AWS-RunShellScript` |
| Read the result | `ssm:GetCommandInvocation`, `ssm:ListCommandInvocations` | `*` (*INFERRED*: these do not take resource-level scoping; confirm against the IAM service reference at setup) |
| Preflight | `ssm:DescribeInstanceInformation` | `*` (same caveat) |

**Not granted, with an explicit deny to make it visible:**
- `cognito-idp:*`, `secretsmanager:*`, `ssm:GetParameter*`, `kms:Decrypt`, `rds-db:connect`.
- Any `rds:Delete*`, `rds:Modify*`, `rds:Restore*`, `ec2:*`, `iam:*`.

**Restoring stays Evoni's action, by hand, from the runbook.**

---

## §8 What Evoni must set up — checklist

Evoni's actions only. No agent session performs any of these.

**AWS**
- [ ] IAM OIDC identity provider for `token.actions.githubusercontent.com`, if the account does not already have one (`deploy-dev.yml:220` notes its own role "does not exist yet"; whether the provider exists is not known from the repository).
- [ ] The production deploy role, with the §7 trust policy and permissions policy (the policy text is drafted in #2837's PR).
- [ ] The custom SSM document (§6(a)), its content taken from #2837's PR.
- [ ] Confirm the production instance is SSM-managed and `Online`: SSM agent running, and its instance profile includes the SSM managed-instance policy.
- [ ] Read the instance profile's attached policies and remove anything the app does not use. In particular, check for Secrets Manager or Cognito admin access. The app's only Cognito call is `InitiateAuthCommand` (`src/services/cognitoPasswordAuthService.js`), which needs no IAM permission. Anything an SSM command runs as root can use the instance role (§9 item 1).
- [ ] **Decision 1: the migration credential's home on the box.** Options: (a) a file such as `/home/ubuntu/.episode-migrate.env`, owned by `ubuntu`, mode `600`, holding only the privileged user's `DB_USER`/`DB_PASSWORD`, read by the migrate phase into that one process; (b) grant the app's own user the DDL rights migrations need, so no second credential exists; (c) another option of her choosing. Without one, step 8 cannot run unattended.
- [ ] Decide snapshot retention. Manual snapshots are kept until deleted and are billed. The role cannot delete, so cleanup is Evoni's.

**GitHub**
- [ ] The `production` environment: Evoni as the required reviewer; "prevent self-review" **off** (she is the only reviewer); deployment branches limited to `main`. (`deploy-production.yml:159-161` names an environment `production`; whether it exists with these rules is not known from the repository.)
- [ ] Variables, preferably scoped to the `production` environment, as variables not secrets: `AWS_ROLE_ARN`, `AWS_REGION`, `RDS_INSTANCE_ID`, `EC2_INSTANCE_ID`, `HEALTH_URL`.
- [ ] **Decision 2: `npm ci` on package changes.** Today the script refuses package changes (`deploy-prod.sh:166-171`). Should the workflow run `npm ci` in the live tree (*INFERRED* risk: the running process loses files under `node_modules` until restart), or stop and leave such deploys to her?
- [ ] Once the new workflow has run successfully: delete the repository secrets only `deploy-production.yml` uses (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `EC2_SSH_KEY`, `EC2_HOST`, `EC2_USER`, `PRODUCTION_DATABASE_URL`, `PROD_DB_HOST`, `PROD_DB_NAME`, `PROD_DB_USER`, `PROD_DB_PASSWORD`, `FAL_KEY`, `REMOVEBG_API_KEY`), and deactivate the IAM access key behind the first two. Whether they still exist is not known from the repository.
- [ ] Keep `Deploy to Development` and `Auto-merge to Dev` disabled. Decide whether `deploy-production.yml` is deleted in #2837 or separately.
- [ ] Approve the first run (decision item 7). Until then, the earlier rule and `DEVELOPMENT_WORKFLOW.md` §7.1 stay in force.

**Docs (agent work, by PR)**
- [ ] After the decision takes effect, `DEVELOPMENT_WORKFLOW.md` §7.1 and `scripts/deploy-prod.sh`'s header describe a manual path that decision item 2 retires for deploys and migrations. #2835 covers `CLAUDE.md` and the templates, not these.

---

## §9 Paths that could reach Cognito or read secrets — to close

1. **SSM `AWS-RunShellScript` is arbitrary root.** `deploy-dev.yml:438-444` uses it. A role allowed `ssm:SendCommand` on it can read:
   - the server `.env` (DB password, `JWT_SECRET`, Cognito ids, API keys: `ecosystem.config.js:12-62`)
   - `~/.pm2/dump.pm2` (`DEVELOPMENT_WORKFLOW.md` §7.2)
   - the instance role's credentials from instance metadata

   **Close:** the custom document of §6(a), and a role that may send only that one.
2. **The instance role can read Secrets Manager.** `scripts/print-db-env.js:5-8`, `:50` reads `episode-metadata/dev/database` "via the instance role". The hazard doc records that dev and prod shared compute. *INFERRED:* if the production box's instance role still carries that permission, any root command on it can read a database secret. **Close:** check and narrow the instance role (§8).
3. **`deploy-production.yml` holds production credentials in GitHub**: long-lived AWS keys, an SSH key, DB credentials and two API keys (§1.3). It writes them into the production `.env` (`:323-367`). It is disabled, but the secrets may still be stored. **Close:** delete the workflow or rewrite it as #2837's, then delete the secrets and deactivate the key (§8).
4. **`.github/scripts/deploy-production.sh` runs `set -x`** (`:3`) while reading `DB_PASSWORD`, `JWT_SECRET` and the Cognito ids out of `.env` (`:12-17`). *INFERRED:* it would print them into the job log. **Close:** delete it with its workflow; the new script never uses `set -x`.
5. **The pm2 commands that print env.** `pm2 jlist` carries `DB_PASSWORD` (§2.4). *INFERRED* from pm2's behaviour: `pm2 describe`, `pm2 env` and `pm2 prettylist` show the process env too. `deploy-prod.sh:283-288` extracts only `restart_time`. **Close:** the on-box script uses only that filtered form.
6. **Full on-box stdout goes to the job log** (`deploy-dev.yml:460-465`). **Close:** the script prints only redacted lines (§6, last paragraph). Job logs are readable by anyone with read access to the repository's Actions.
7. **`/_diag/health` returns DB host and name** to loopback callers (`src/app.js:370-376`). **Close:** the workflow uses `/health` only.
8. **`scripts/deploy/verify-database.ps1` writes `DB_PASSWORD` into a file** (`:111-113`). It is not on any workflow path; a workstation-side leak only. It, and the SSH helpers in §2.3, can be deleted in a separate cleanup task.

No file at the basis calls `aws cognito-idp`, `ssm get-parameter` or `secretsmanager get-secret-value` in `.github/`, `scripts/` or root `*.sh`. The one `ssm send-command` is `deploy-dev.yml:438`.

---

## What this read does not do

- It changes no code, workflow, script or register document.
- It dispatches, enables, approves or re-runs no workflow.
- It makes no host, AWS, database or Cognito contact. Everything about the live system is ATTESTED from filed deploy records or marked unknown.
- It decides nothing. §6 and §7 are proposals for #2837; §8's two decisions are Evoni's.
