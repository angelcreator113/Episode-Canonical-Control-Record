# F-Deploy-1 — Deploy-to-Development Dispatch Path, MEASURED Read

**Basis:** `origin/main` at `4dbc547c59e5565daf400affafa746c5f2ee88c5`, 2026-09-12.

```
$ git fetch origin main
From https://github.com/angelcreator113/Episode-Canonical-Control-Record
 * branch                main       -> FETCH_HEAD
$ git rev-parse origin/main
4dbc547c59e5565daf400affafa746c5f2ee88c5
```

**Provenance:** Task #1397. Read-only. No dispatch performed. No host, AWS,
database, or Cognito contact made. Nothing ruled, nothing minted. This
document is a MEASURED read of `.github/workflows/deploy-dev.yml` at the
basis SHA above, plus a present/absent check of every file path that
workflow references, plus a pre-dispatch reading aid. It does not state
whether dispatching is safe.

---

## 1. Source

```
$ git show origin/main:.github/workflows/deploy-dev.yml
```
read in full (462 lines). All content below is quoted or paraphrased from
that read, labelled MEASURED unless stated otherwise.

---

## 2. Trigger

**MEASURED.** Lines 67–68:

```yaml
on:
  workflow_dispatch:
```

No `inputs:` sub-key is present under `workflow_dispatch:` — this dispatch
takes **zero inputs** (MEASURED-ABSENT; there is nothing to default).

**MEASURED.** No `push:`, `pull_request:`, `schedule:`, or any other trigger
key exists in this file:

```
$ git show origin/main:.github/workflows/deploy-dev.yml | grep -n "^\s*push:"
$ echo "exit: $?"
exit: 1
```
(empty match, grep exit 1 — no `push:` key at any indent level). The file's
own header comment (lines 34–37) asserts the same and gives this exact
check as its verification instrument; re-run here rather than taken on
trust.

`workflow_dispatch` is the only lever. Nothing else in this repository can
fire this workflow.

---

## 3. Permissions block

**MEASURED.** Lines 74–76:

```yaml
permissions:
  contents: read
  id-token: write   # OIDC federation — see header; no static AWS keys on this path
```

---

## 4. Concurrency

**MEASURED.** Lines 70–72:

```yaml
concurrency:
  group: deploy-dev
  cancel-in-progress: false
```

One `deploy-dev` group; a second dispatch while one is in flight queues
rather than cancels the first.

---

## 5. Top-level `env:`

**MEASURED.** Lines 78–82:

```yaml
env:
  AWS_REGION: us-east-1
  DEPLOY_BUCKET: episode-metadata-storage-dev
  DEPLOY_PREFIX: deploys/dev
  INSTANCE_TAG: episode-dev-backend
```

---

## 6. Jobs and steps, in source order

Three jobs, each depending on the last: `test` → `build` → `deploy`.

### 6.1 Job `test` (lines 85–131)

Runs on `ubuntu-latest` with an ephemeral `postgres:15` service container
(lines 88–101; not the dev RDS instance — a fresh container scoped to this
job).

| # | Step (line) | Command | Standing |
|---|---|---|---|
| 1 | `actions/checkout@v4` (104) | checkout, `token: ${{ github.token }}` | MEASURED |
| 2 | Setup Node.js (108) | `actions/setup-node@v4`, `node-version: '20'`, `cache: 'npm'` | MEASURED |
| 3 | Install dependencies (114) | `npm ci` | MEASURED |
| 4 | Setup test database (117) | `PGPASSWORD=postgres psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS episode_metadata_test;"` then `CREATE DATABASE episode_metadata_test;` | MEASURED |
| 5 | Run database migrations (122) | `npm run migrate:up`, env `DATABASE_URL: postgresql://postgres:postgres@localhost:5432/episode_metadata_test`, `NODE_ENV: test` | MEASURED |
| 6 | Run tests (128) | `npm test -- --coverage`, same `DATABASE_URL` plus `TEST_DATABASE_URL` (identical value) and `JWT_SECRET: test-secret-key-minimum-32-characters-long` | MEASURED |

This job's migration and test run are entirely against the job-local
`postgres:15` service container on the GitHub-hosted runner. No dev-box or
RDS contact in this job.

### 6.2 Job `build` (lines 136–201), `needs: test`

| # | Step (line) | Command | Standing |
|---|---|---|---|
| 1 | `actions/checkout@v4` (141) | checkout, `token: ${{ github.token }}` | MEASURED |
| 2 | Setup Node.js (145) | `actions/setup-node@v4`, `node-version: '20'`, `cache: 'npm'` | MEASURED |
| 3 | Install backend dependencies (151) | `npm ci --production` then `npm install --no-save sequelize-cli` | MEASURED |
| 4 | Prune node_modules for deployment (156) | `find node_modules` deletes doc/map/license/changelog/lint-config files and `__tests__`/`test`/`tests`/`spec`/`docs`/`doc`/`example`/`examples`/`.github` dirs (maxdepth 3); prints before/after `du -sh` | MEASURED |
| 5 | Build frontend (174) | `cd frontend && npm ci && npm run build`, lists `dist/assets/` | MEASURED |
| 6 | Create artifact (182) | `mkdir -p deploy`; `cp -r src deploy/`; `cp -r scripts deploy/`; `cp -r frontend/dist deploy/`; `cp -r nginx deploy/`; `cp package.json deploy/`; `cp package-lock.json deploy/`; `cp ecosystem.dev.config.js deploy/`; `cp .sequelizerc deploy/`; `mv node_modules deploy/`; `tar -czf episode-metadata-${{ github.sha }}.tar.gz deploy/` | MEASURED |
| 7 | Upload artifact (197) | `actions/upload-artifact@v4`, name `episode-metadata-build-dev`, path the tarball from step 6 | MEASURED |

### 6.3 Job `deploy` (lines 203–461), `needs: build`, `timeout-minutes: 25`, `environment: {name: development, url: https://dev.primepisodes.com}`

| # | Step (line) | Command | Standing |
|---|---|---|---|
| 1 | Download artifact (212) | `actions/download-artifact@v4`, name `episode-metadata-build-dev` | MEASURED |
| 2 | Configure AWS credentials (OIDC) (217) | `aws-actions/configure-aws-credentials@v4`, `role-to-assume: arn:aws:iam::637423256673:role/episode-gha-deploy-dev` (comment on this line: `# P2 — does not exist yet`), `aws-region: us-east-1` | MEASURED |
| 3 | Preflight — SSM target Online (226) | `aws ssm describe-instance-information --filters "Key=tag:Name,Values=${INSTANCE_TAG}" --query "InstanceInformationList[?PingStatus=='Online'].[InstanceId,PingStatus,PlatformName]" --output text`; exits 1 with an `::error::` annotation if empty; else captures `instance_id` to `$GITHUB_OUTPUT` | MEASURED |
| 4 | Write on-box deploy script (241) | heredocs a script to `deploy-on-box.sh` and `chmod +x`s it (script contents in §6.4 below) — this step does not execute the script, only writes it | MEASURED |
| 5 | Upload artifact + script to S3, presign (393) | `aws s3 cp` the tarball and `deploy-on-box.sh` to `s3://${DEPLOY_BUCKET}/${DEPLOY_PREFIX}/${{ github.sha }}/...`; `aws s3 presign` both with `--expires-in 1800`; masks both URLs with `::add-mask::` before writing to `$GITHUB_OUTPUT` | MEASURED |
| 6 | Deploy via SSM RunCommand (408) | builds a shell command string that curls the presigned script URL, `chmod +x`, then `sudo -u ubuntu ARTIFACT_URL='<presigned>' DEPLOY_SHA='${{ github.sha }}' bash /tmp/deploy-on-box.sh`; sends it with `aws ssm send-command --document-name "AWS-RunShellScript" --timeout-seconds 900`; polls `aws ssm get-command-invocation` every 15s up to 60 times for terminal status; prints stdout tail (`--query StandardOutputContent`, `tail -80`) always, stderr tail (`tail -40`) and `exit 1` if status ≠ `Success` | MEASURED |
| 7 | Cleanup S3 deploy objects (450) | `if: always()`; `aws s3 rm "s3://${DEPLOY_BUCKET}/${DEPLOY_PREFIX}/${{ github.sha }}/" --recursive \|\| true` | MEASURED |
| 8 | Deployment summary (455) | appends a fixed block to `$GITHUB_STEP_SUMMARY` naming the commit SHA, transport, target tag, "Secrets carried by this workflow: NONE", and the dev site URL | MEASURED |

### 6.4 The on-box script (`deploy-on-box.sh`, written at step 6.3-4, lines 241–391; executed on the target instance at step 6.3-6, not on the runner)

In source order, as written into the heredoc:

| # | Step | Command | Standing |
|---|---|---|---|
| 1 | Setup | `APP_DIR=$HOME/episode-metadata`; `mkdir -p "$APP_DIR/logs"` | MEASURED |
| 2 | Define `restore_pm2()` | `cd "$APP_DIR" 2>/dev/null \|\| return`; `pm2 startOrRestart ecosystem.dev.config.js --only episode-api,episode-worker --update-env 2>&1 \| tail -10 \|\| true`; `pm2 save 2>&1 \| tail -2 \|\| true` — defined here, not yet called | MEASURED |
| 3 | Node/pm2 setup | sources `nvm.sh`; prints `node -v`/`npm -v`; `sudo npm install -g pm2` if `pm2` is not on PATH; prints `pm2 -v` | MEASURED |
| 4 | Disk check | prints free space; if `<500` MB, deletes `$APP_DIR/node_modules`, `$APP_DIR/logs/*.log`, `~/.pm2/logs/*.log`, `/tmp/dev-deploy.tar.gz`; `npm cache clean --force`; `sudo journalctl --vacuum-size=10M`; `sudo apt-get clean` | MEASURED |
| 5 | Fetch artifact | `curl -fsSL "$ARTIFACT_URL" -o /tmp/dev-deploy.tar.gz` (the presigned S3 URL passed in as an env var by step 6.3-6) | MEASURED |
| 6 | Deploy frontend | extracts `deploy/dist deploy/nginx` from the tarball under `/tmp/deploy-tmp`; `sudo rm -rf /var/www/html/*`; `sudo cp -r dist/* /var/www/html/`; `sudo chown -R www-data:www-data /var/www/html`; `sudo chmod 755 /var/www/html /var/www/html/assets`; `sudo cp nginx/episode-dev.conf /etc/nginx/sites-enabled/episode`; `sudo nginx -t`; **`sudo systemctl restart nginx`**; removes the tmp dir | MEASURED |
| 7 | Deploy backend | `rm -rf "$APP_DIR/src" "$APP_DIR/scripts" "$APP_DIR/node_modules"`; extracts `deploy/src deploy/scripts deploy/node_modules deploy/package.json deploy/package-lock.json deploy/ecosystem.dev.config.js deploy/.sequelizerc` from the tarball into `$APP_DIR`; removes the downloaded tarball | MEASURED |
| 8 | Resolve DB env | `eval "$(node scripts/print-db-env.js)"`; then `export DB_SSL=true` (comment: staged here, not part of the loader's "5-export contract", because of a first-dispatch finding on run `29357042127`, a "no encryption" `pg_hba` rejection) | MEASURED |
| 9 | Arm restart trap | `trap restore_pm2 EXIT` — armed only after step 8, per the script's own RF-2 comment | MEASURED |
| 10 | Migration bootstrap | `node scripts/bootstrap-sequelize-meta.js` | MEASURED |
| 11 | **Run migrations** | `npx sequelize-cli db:migrate --env development 2>&1 \| tail -20`; on failure sets `MIGRATION_FAILED=true` and continues rather than exiting (comment: "trap will still restart PM2 so the site stays up") | MEASURED |
| 12 | Explicit restart | echoes "Restarting PM2 (scoped)..."; calls **`restore_pm2`** directly (not waiting for the EXIT trap) | MEASURED |
| 13 | Disarm trap | `trap - EXIT` — comment: the explicit restart in step 12 already happened; leaving the trap armed would fire a second, unverified restart after the health check below | MEASURED |
| 14 | Health check | loops 6× (`sleep 5` each): `curl -sf http://localhost:3002/health`; on failure after 6 attempts, `pm2 logs episode-api --lines 30 --nostream` then `exit 1` | MEASURED |
| 15 | Route verification | `curl -sf http://localhost:3002/api/v1/shows` and `.../api/v1/episodes`, records boolean, does not fail the script either way | MEASURED |
| 16 | Final state | if `MIGRATION_FAILED=true`, `exit 1` (a "deployment completed but migrations failed" message) even though the app was already restarted; else prints "Full deployment complete" | MEASURED |

---

## 7. Migrations — MEASURED, present

**The workflow runs database migrations, twice, in two different places
against two different databases:**

1. Job `test`, step "Run database migrations" (line 122–126), against the
   job's own ephemeral `postgres:15` service container:
   ```yaml
   - name: Run database migrations
     run: npm run migrate:up
     env:
       DATABASE_URL: postgresql://postgres:postgres@localhost:5432/episode_metadata_test
       NODE_ENV: test
   ```
2. The on-box script (§6.4, step 11), against whatever database
   `scripts/print-db-env.js` resolves at deploy time via the instance role
   (per the workflow's own header comment, this reads the Secrets Manager
   secret named `episode-metadata/dev/database` — a name, not a host or
   endpoint this document verifies):
   ```bash
   if ! npx sequelize-cli db:migrate --env development 2>&1 | tail -20; then
     echo '⚠ Migration failed — trap will still restart PM2 so the site stays up'
     MIGRATION_FAILED=true
   fi
   ```

**What this step actually writes schema against is NOT VERIFIABLE FROM
REPO.** `print-db-env.js`'s output is resolved at runtime from that secret;
this document does not read that script's body and has made no Secrets
Manager call (guardrail: no AWS contact). The secret's *name* contains
`dev`, but a name is not a target:

```
$ git show origin/main:CLAUDE.md | grep -n -i "rds\|episode-control-dev\|neon"
19:- Backend: Node 20, Express 5, Sequelize 6, PostgreSQL 15 on **AWS RDS** (canon instance is misleadingly named `episode-control-dev`; not Neon). `src/app.js` composes everything. PM2 on EC2, nginx.
```

`CLAUDE.md` line 19, read at this same basis, records that this project's
one canon PostgreSQL RDS instance carries the name `episode-control-dev`
and calls that naming "misleading." Nothing read here establishes that
`episode-metadata/dev/database` resolves to that instance, and nothing
read here rules it out — the standing is NOT VERIFIABLE FROM REPO, on
both ends of the question. The label `development` (the sequelize `--env`
value) and the word `dev` (in the secret name) are not, by themselves,
evidence of which database receives the schema change.

Not MEASURED-ABSENT — migrations run in both the CI test job and the
on-box deploy step. The CI-job migration target is MEASURED (an ephemeral,
job-local container, §6.1). The on-box migration target is **NOT
VERIFIABLE FROM REPO.**

---

## 8. Start / stop / restart — MEASURED, present

**What restarts, and how, in source order:**

1. **nginx**, on-box script §6.4 step 6:
   ```bash
   sudo cp nginx/episode-dev.conf /etc/nginx/sites-enabled/episode
   sudo nginx -t
   sudo systemctl restart nginx
   ```
2. **PM2-managed processes** (`episode-api`, `episode-worker`), on-box
   script `restore_pm2()` (§6.4 step 2), called explicitly at step 12 and
   available as an EXIT-trap fallback between steps 9 and 13:
   ```bash
   pm2 startOrRestart ecosystem.dev.config.js --only episode-api,episode-worker --update-env 2>&1 | tail -10 || true
   pm2 save 2>&1 | tail -2 || true
   ```
   The `--only episode-api,episode-worker` scoping means only those two
   named PM2 processes are touched by this command, regardless of what
   else `ecosystem.dev.config.js` might define.

No other service is started, stopped, or restarted by this workflow.

---

## 9. Referenced file paths — presence at basis, MEASURED

Every path this workflow reads, writes, copies, or executes, checked
against the basis SHA with `git cat-file -e origin/main:<path>`:

```
$ for p in "scripts" "ecosystem.dev.config.js" "ecosystem.config.js" ".sequelizerc" \
    "nginx" "nginx/episode-dev.conf" "package.json" "package-lock.json" "src" \
    "scripts/print-db-env.js" "scripts/bootstrap-sequelize-meta.js" \
    "frontend/package.json" "frontend" ".github/workflows/deploy-dev.yml"; do
  git cat-file -e "origin/main:$p" 2>/dev/null
  echo "$p -> exit $?"
done
scripts -> exit 0
ecosystem.dev.config.js -> exit 0
ecosystem.config.js -> exit 0
.sequelizerc -> exit 0
nginx -> exit 0
nginx/episode-dev.conf -> exit 0
package.json -> exit 0
package-lock.json -> exit 0
src -> exit 0
scripts/print-db-env.js -> exit 0
scripts/bootstrap-sequelize-meta.js -> exit 0
frontend/package.json -> exit 0
frontend -> exit 0
.github/workflows/deploy-dev.yml -> exit 0
```

| Path | Referenced by | Standing |
|---|---|---|
| `scripts/` | build job "Create artifact" (`cp -r scripts deploy/`) | PRESENT (exit 0) |
| `ecosystem.dev.config.js` | build job "Create artifact" (copied); on-box script (`pm2 startOrRestart ecosystem.dev.config.js ...`) | PRESENT (exit 0) |
| `.sequelizerc` | build job "Create artifact" (copied); read implicitly by `npx sequelize-cli` on-box | PRESENT (exit 0) |
| `nginx/` | build job "Create artifact" (`cp -r nginx deploy/`) | PRESENT (exit 0) |
| `nginx/episode-dev.conf` | on-box script (`sudo cp nginx/episode-dev.conf /etc/nginx/sites-enabled/episode`) | PRESENT (exit 0) |
| `package.json` | build job "Create artifact" (copied); `npm ci` at repo root (test and build jobs) | PRESENT (exit 0) |
| `package-lock.json` | build job "Create artifact" (copied) | PRESENT (exit 0) |
| `src/` | build job "Create artifact" (`cp -r src deploy/`) | PRESENT (exit 0) |
| `scripts/print-db-env.js` | on-box script (`eval "$(node scripts/print-db-env.js)"`) | PRESENT (exit 0) |
| `scripts/bootstrap-sequelize-meta.js` | on-box script (`node scripts/bootstrap-sequelize-meta.js`) | PRESENT (exit 0) |
| `frontend/package.json` | build job "Build frontend" (`cd frontend && npm ci`) | PRESENT (exit 0) |
| `frontend/` (as a directory; `frontend/dist` is a build **output**, not a repo path, and is not itself checked here) | build job "Build frontend", "Create artifact" (`cp -r frontend/dist deploy/`) | PRESENT (exit 0) |
| `.github/workflows/deploy-dev.yml` | the workflow file itself | PRESENT (exit 0) |

**`ecosystem.config.js`** (no `.dev` — the root file) is named only in this
workflow's own header **comment** (lines 51–53: *"the shipped
ecosystem.config.js defines a prod-configured app
(episode-api-prod-hotfix)"*), as the reason the workflow explicitly copies
and runs `ecosystem.dev.config.js` instead. No `run:` step in this workflow
reads, copies, or executes `ecosystem.config.js`. Checked for completeness
since the header names it: PRESENT (exit 0), but **not itself referenced by
any executable step** — recorded to avoid a reader assuming otherwise from
the comment alone.

All fourteen paths checked are PRESENT at the basis SHA. None is
MEASURED-ABSENT.

---

## 10. Secrets, variables, and AWS resources named — NOT VERIFIABLE FROM REPO

**MEASURED absence of repo secret/variable references:**
```
$ git show origin/main:.github/workflows/deploy-dev.yml | grep -n "secrets\.\|vars\."
```
returns no matches. This workflow contains **zero `${{ secrets.* }}` or
`${{ vars.* }}` references.** The only GitHub-provided token used is the
built-in, ephemeral `${{ github.token }}` (lines 106, 143) — not a
repo-configured secret.

**AWS/infrastructure resources named in the file (names only, no repo
mechanism to confirm they exist or are configured as described) — each NOT
VERIFIABLE FROM REPO:**

| Name | Kind | Where named |
|---|---|---|
| `arn:aws:iam::637423256673:role/episode-gha-deploy-dev` | IAM role, OIDC assume-role target | line 220, `role-to-assume:`; the line's own trailing comment reads `# P2 — does not exist yet` |
| `episode-metadata-storage-dev` | S3 bucket | `DEPLOY_BUCKET` env, line 80 |
| `episode-dev-backend` | EC2 instance tag value (`Name`) | `INSTANCE_TAG` env, line 82; used in the SSM preflight filter |
| `episode-metadata/dev/database` | Secrets Manager secret name | named in header comments (lines 32, 61, 248) and read by `scripts/print-db-env.js` on-box, not by any string literal in the workflow's own `run:` steps |
| `us-east-1` | AWS region | `AWS_REGION` env, line 79; also the `aws-region:` input at line 221 |

No parameter, secret, or credential **value** is recorded anywhere in this
document, consistent with the issue's guardrails.

---

## 11. Pre-dispatch reading aid (not a ruling)

**This section is a reading aid — an ordered list of what a dispatch would
depend on, each tied to the step it comes from. It states no opinion on
whether dispatching is safe, discharges no gate, and rules nothing.**

1. **The OIDC role must exist and trust this repo.** §6.3 step 2 assumes
   `arn:aws:iam::637423256673:role/episode-gha-deploy-dev`; the workflow's
   own comment on that line (§10) says it does not exist yet at authoring.
   If it does not exist at dispatch time, the job fails at this step,
   before any artifact reaches S3 or SSM.
2. **The target instance must be SSM-managed and Online.** §6.3 step 3
   queries `aws ssm describe-instance-information` for tag
   `Name=episode-dev-backend`; an empty result is a hard `exit 1` with an
   `::error::` pointing at prerequisite P1 in the file's own header. Nothing
   past this step runs without it.
3. **This dispatch writes schema. The target it writes to is NOT
   VERIFIABLE FROM REPO.** §6.4 step 11 runs `sequelize-cli db:migrate`
   against whatever `scripts/print-db-env.js` resolves from the secret
   `episode-metadata/dev/database` (§6.4 step 8) via the instance role.
   This document has not read that script's body and has made no Secrets
   Manager call — see §7 for the same standing, with `CLAUDE.md` line 19
   quoted there on the canon RDS instance's name. That standing is
   unresolved on both ends: this document neither confirms nor rules out
   that the secret resolves to that instance.
4. **nginx must already be provisioned on the target box.** §6.4 step 6
   copies a site config and runs `nginx -t` / `systemctl restart nginx`;
   the workflow's own header (prerequisite P5) states the frontend leg
   "fails loudly if absent" — by design, per that comment, not verified
   here.
5. **A migration failure does not stop the restart, but does fail the
   run.** §6.4 steps 11–16: a failed `sequelize-cli db:migrate` sets a
   flag, the script still restarts PM2 (step 12) and runs the health check
   (step 14), and only exits non-zero at the very end (step 16) if the
   migration flag was set — so PM2 ends up running whatever code was just
   extracted, with migrations possibly short of it, before the job reports
   failure.
6. **Only `episode-api` and `episode-worker` are touched by the PM2
   restart**, whatever else `ecosystem.dev.config.js` defines (§8) — a
   reader checking that file's process list before dispatch is checking a
   file this document did not itself enumerate.
7. **This job carries no application secret of its own** (§10) — every
   credential-shaped value it produces (the presigned S3 URLs) is
   generated at run time, scoped to the artifact and script objects it
   just uploaded, expires in 1800 seconds, and is masked in logs (§6.3
   step 5).

---

## 12. What this document does not do

Mints no FD, XK, or PE number. Rules nothing. Proposes no remedy. States no
opinion on whether dispatching `deploy-dev.yml` now would be safe. Makes no
host, AWS, database, or Cognito contact — every claim above is either a
`git show`/`git cat-file`/`grep` read against the cloned repository at the
stated basis SHA, or a direct quotation of that read. **Prod FROZEN**,
unaffected by anything in this document (this workflow targets
`episode-dev-backend`/the `development` GitHub environment only; no path in
it touches production).
