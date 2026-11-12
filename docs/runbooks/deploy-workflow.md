# Runbook: the Deploy workflow

`.github/workflows/deploy.yml` (Task #2837) deploys `main` to production and runs its migrations, after Evoni approves each run. It is built on the plan in `docs/reads/2026-10-10-deploy-path-read.md` §6–§9, under Evoni's Rule 7 decision (`docs/audit/F-Deploy-1_Rule7_DeployWorkflow_Ruling_2026-10-10.md`).

**Who does what.** Every step in this runbook that touches AWS, GitHub settings or the box is Evoni's. Agent sessions may change the workflow and its scripts through reviewed PRs, but never dispatch, approve, re-run or enable it. They never touch AWS or the box.

**Status until set up.** The workflow is off. Its job runs only when the repository variable `DEPLOY_ENABLED` is `true`, and Evoni sets that last (§2.4). Until her first approved run, the earlier rule applies in full: deploys stay her manual action (`DEVELOPMENT_WORKFLOW.md` §7.1, `scripts/deploy-prod.sh`).

---

## 1. What a run does

It runs only when Evoni starts it: **Run workflow** on the Actions tab, on `main` (browser; GitHub Mobile cannot start it). A merge no longer queues a run (Evoni, 2026-10-12): before that, each merge queued one, and a newer merge cancelled the one waiting for approval. A run deploys the head of `main` at the moment it starts. The job waits in the `production` environment until Evoni approves it. A running deploy is never cancelled.

**Pinned to a commit (D-21, Evoni 2026-11-06).** Run workflow asks for **`expected_sha`**: the full 40-character commit from the deploy preparation note. The run stops before building anything, and again before taking any production credential, if `main` is anywhere else. That is what happened in Deploy #198, where a PR merged after preparation shipped too. An optional **`expected_prs`** (for example `3727,3730`) makes it stop if the range holds any other PR, or misses one. Before approval, the build job's **release summary** on the run page lists every commit and PR since the last successful deploy, plus the new migrations and whether the frontend changed. After approval, the run checks that production is at the commit that summary started from, before any snapshot is touched. Both checks **fail closed** (D-21 review, 2026-11-06): a baseline the run cannot find stops it before building (§4, "Baseline unknown"), and a box already at the target passes only when its own deploy record says a Deploy run from that baseline put it there (§4, "Box at the target without a record"). The box keeps two one-line records for this: `~/.episode-deploy-unfinished` ("<from> <to>": the tree moved, the restart has not succeeded; `<from>` is the commit the API still runs) and `~/.episode-deploy-finished` ("<from> <to>": a restart on `<to>` succeeded). The plan reports them as `PLAN_BOX_STAGE` and `PLAN_BOX_FROM`. A third input, **`baseline_sha`**, stays empty except in that one recovery.

**Which merges queue a run (#2862).** A merge whose changed files are *all* docs (`docs/**`, or any `.md` file anywhere) queues no run, so it needs no approval. A merge that touches anything else queues one: code, a migration, a package file, a script, or the workflow itself, even alongside docs. Docs-only changes reach the box with the next code deploy, because each deploy fast-forwards to its commit. **Queue:**
- At most one run waits for approval.
- At most one, the newest, is pending behind it. A newer push cancels the older pending run.
- The waiting run is not replaced. Approving it deploys its own, older commit, and the pending run then deploys the newest.
- To skip straight to the newest, reject the waiting run on its page; the pending one then waits for approval.

On 2026-10-10, run #22 was waiting, and #23 was cancelled the moment #24 was queued.

| # | Step | Where | If it fails |
|---|---|---|---|
| 0 | **Build** (its own job, before the approval; no AWS credentials): `npm ci` and `vite build` of the commit, packed as `frontend-dist.tgz` with its sha256 and kept as a run artifact for a day | runner | Nothing changed |
| 1 | Check configuration (the `AWS_ROLE_ARN` environment secret and the four variables are set; no value is printed) | runner | Nothing changed |
| 2 | OIDC: assume the deploy role (no stored keys) | runner | Nothing changed |
| 3 | Preflight: the instance is `Online` in SSM | runner | Nothing changed |
| 4 | **Plan**, read-only: **no green removal running on the box** (else stop: the API restart at the end would kill it; start the run again once the Files page shows it finished, or press Stop on that clip; Evoni, 2026-10-31); clean tree; the target is on `origin/main` and a fast-forward; **no package or lock file changes** (else stop: deploy that range by hand); no existing migration file modified; the ledger has nothing pending for the current code, unless an earlier deploy that did not finish left them (they are carried into this run; see below) | box | Nothing changed |
| 5 | **Snapshot**: `deploy-<sha12>-<run id>-<attempt>` of the RDS instance. If RDS already holds its 100 manual snapshots (`SnapshotQuotaExceeded`, runs #145 and #146 on 2026-10-22), it stops and says so | runner | Nothing on the box changed |
| 6 | **Wait** until the snapshot is `available` (up to 60 min) | runner | Nothing on the box changed |
| 7 | **Migrate**, from a staged copy of the commit, before anything on the live tree changes (Evoni, 2026-10-26; see "Migrate before Deploy" below): repeat the plan's checks for the target; stage it in `/home/ubuntu/.episode-stage/<sha>`; if files are pending, `sequelize-cli db:migrate` from there as the migration user from `/home/ubuntu/.episode-migrate.env`, then re-check (must be 0 pending). `db:migrate` waits at most 30 s for any one lock (`lock_timeout`, set by `MIGRATE_LOCK_TIMEOUT`; Deploy run 176, 2026-10-28). Every migration connection is pinned to `search_path=public` (`MIGRATE_SEARCH_PATH`, through the same `PGOPTIONS`), and `scripts/deploy/migration-trust-check.js` runs first: the migration does not run unless only trusted roles can create or own objects on that path (Evoni, 2026-11-04; `docs/reads/2026-11-04-deploy-migration-trusted-path.md`). Only a success records the target in `/home/ubuntu/.episode-deploy-migrated` | box | §4, row "Migrate" |
| 7a | **Hand over the build**, only when `DEPLOY_ARTIFACT_BUCKET` is set (§2.5), after Migrate so the link is not spent on the migration: check the pack's sha256 against the build job's, upload it to `s3://<bucket>/deploy-builds/`, and make a link to it that expires in 15 minutes (masked in the log) | runner | Nothing on the box changed |
| 8 | **Deploy**, only after Migrate succeeded for this commit; first the box re-checks the record, the staged copy and the ledger, and refuses otherwise. With the runner's build (§2.5): download the pack through the link and check its sha256 and that it holds only `dist/`, all before anything changes; back up `frontend/dist`, `git merge --ff-only`, mark the deploy unfinished, put the pack's `dist/` in place of `frontend/dist`. No build on the box | box | §4, row "Deploy" |
| 8 | **Deploy**, only after Migrate succeeded for this commit, without the runner's build (as before): back up `frontend/dist` to `/home/ubuntu/dist-backup-<UTC>-<sha12>`, `git merge --ff-only`, mark the deploy unfinished (`/home/ubuntu/.episode-deploy-unfinished`), `vite build` with an explicit heap (about 60% of RAM, 1536–3072 MB; the log names it) for at most 1200 s, after printing the box's memory; it stops first, changing nothing, if another vite build is still running | box | §4, row "Deploy" |
| 9 | **Restart**, under the same re-checks as Deploy, before any `pm2` call: `pm2 restart episode-api-prod-hotfix`; `localhost:3000/health` healthy with the database connected; then, **only if `episode-worker` was online before the restart**, `pm2 restart episode-worker` (must be online). A stopped or missing worker is left exactly as it was (#2861). The isolated voice worker `episode-voice-worker` follows the same rule: restarted only if it was online, never started (Evoni, Issue #3650, 2026-10-30). The box reports the target SHA; a successful restart clears the migrate record, the unfinished mark and the staged copy, then removes all but the newest 3 frontend backups (§7) | box | §4, row "Restart" |
| 10 | **Public health**: `HEALTH_URL` healthy with the database connected | runner | §4, row "Public health" |
| 10a | **Remove older deploy snapshots**, last: only when every step above succeeded, the public health check included (`scripts/deploy/prune-snapshots.sh`, 2026-10-22; safeguards 2026-10-28; moved here 2026-11-12, so an older recovery point is never removed before the new one exists, and never by a release that failed at Migrate, Deploy, Restart or health). It removes nothing unless the new snapshot is in the listing of available ones; the new snapshot is never removed and does not count toward `DEPLOY_SNAPSHOTS_KEEP`, so as many older ones stay as before. It names every snapshot it selects, with its creation time, before removing any. A **dry run** unless `DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN` is `0` (it names what it would remove and removes nothing). Otherwise it keeps the newest `DEPLOY_SNAPSHOTS_KEEP` (default 10, never fewer than 3) and removes at most `DEPLOY_SNAPSHOTS_MAX_DELETE` (default 5) older ones per run, oldest first, none newer than `DEPLOY_SNAPSHOTS_MIN_AGE_DAYS` (default 7). Never removed: snapshots tagged `keep=true`, names not exactly `deploy-<12 hex>-<run id>-<attempt>`, this run's new snapshot and its other attempts, automated and other manual snapshots, any not yet available. A listing that looks wrong removes nothing; three failed removals stop it. Without the delete permission (§2.1), or if a listing or delete fails, it warns and the run goes on. The summary says how many it removed, or would remove | runner | Never fails the run. A problem here is a **retention warning** on a successful deploy, not a deployment failure (§7) |
| 11 | **Summary** on the run page: commit, box before, snapshot, migrations run, the worker's state before → after (restarted, or left stopped), results. On failure, the snapshot name and a pointer here | runner | — |

It never rolls back by itself, and it never runs `npm ci` on the box (only the runner's build job does, for the frontend). It never reads or prints `.env`, a password, `pm2 describe`/`pm2 env`, or `/_diag/health`, and it never calls Cognito. Box steps run as `ubuntu` through the `PrimeStudios-Deploy` SSM document, which runs only `scripts/deploy/workflow-deploy.sh` taken from the commit being deployed.

**Migrate before Deploy (Evoni, 2026-10-26).** Until this change, Deploy fast-forwarded the live tree before Migrate ran, so for the whole build and migration the code on disk expected columns the database did not have yet. Any API or worker restart in that window (a crash, `max_memory_restart`, the OOM killer during a build) would have loaded those models. Now the migration runs first, from a staged copy of the commit, while the live tree and the running API stay on the old code:
- **What is staged.** `/home/ubuntu/.episode-stage/<sha>` holds the commit's `.sequelizerc`, `package.json`, `src/` and `scripts/check-pending-migrations.js`, exported with `git archive` (the repository is only read). Each file is hashed and compared with the commit's own blob, and the phase stops on any difference. The copy is then made read-only. The same check runs again right before and right after `db:migrate`, and again in Deploy and Restart. A file changed, added or removed at any point stops the phase without recording anything.
- **What is shared, not copied.** `.env` and `node_modules` in the staged copy are links to the live ones, so no secret is copied. dotenv and `.sequelizerc` resolve from the current directory, so started there, the migration reads the live `.env` and the staged config and migrations. The log prints the four paths it checked (`STAGE_CONFIG`, `STAGE_MIGRATIONS`, `STAGE_DOTENV`, `STAGE_SEQUELIZE`). Sharing `node_modules` is safe only because a range that changes a package file is refused, by the plan and again by Migrate.
- **One commit throughout.** Every phase gets the run's one `TARGET_SHA`. Migrate repeats the plan's checks for it: on `origin/main`, a fast-forward of the live tree, no package change, no existing migration file changed. Deploy and Restart each refuse, before changing anything, unless all three hold:
  - `/home/ubuntu/.episode-deploy-migrated` holds exactly that commit;
  - its staged copy still matches the commit;
  - the ledger, read again, has every migration of that commit.

  A record therefore cannot carry over to another commit, to an unrelated attempt, or to a database restored since. Migrate removes the record first thing and writes it whole (a temporary file, then a rename) only after its re-check passes, so a failed or interrupted migration never leaves one.
- **Cleanup.** The staged copy stays until a successful Restart removes it, together with the record. A failed run keeps it for diagnosis, and the next Migrate removes it. Only directories named after a commit SHA (or `.incoming.*`) under `/home/ubuntu/.episode-stage` are ever removed. Removal never follows a link: `rm -rf` removes the `.env` and `node_modules` links, never what they point to, and restoring write permission for removal touches only real directories inside the copy. A staged copy that a process is still using (its working directory or an open file, such as a `db:migrate` a stopped run left running) is never removed; Migrate stops instead. Nothing under `uploads/`, `logs/`, `frontend/dist` or the PM2 configuration is touched by Migrate.
- **The price.** From Migrate to Restart, the *old* code runs against the *new* schema. Additive migrations (a new nullable column, a new table) are safe that way. A migration that drops, renames or tightens something the running code still uses is not. Ship it in two deploys: first stop using it, then remove it.

**The worker follows Evoni's choice.** A deploy never starts a worker she has stopped, and keeps restarting one that is running. To turn it on, she starts it herself on the box with `pm2 restart episode-worker` (this also starts a stopped process), and later deploys keep it running. To turn it off, she runs `pm2 stop episode-worker`, and later deploys leave it off. Either way, before a `pm2 save`, follow `DEVELOPMENT_WORKFLOW.md` §7.2. Deploy #21 started a worker that had been stopped since late September (`docs/reads/2026-10-10-deploy-21-verification.md` §3 U2), which is why this rule exists.

**Re-running a stopped run** (Evoni: **Re-run jobs** on the run page) is safe. If the box is already at the commit, the plan says "resuming". The run takes a fresh snapshot, migrates anything still pending, rebuilds, and restarts.

**A newer run after one that stopped in Deploy (#2948).** Before Migrate moved ahead of Deploy (2026-10-26), a deploy that stopped after its fast-forward left the box's tree at its commit with that commit's migrations not run, and the API on the old code. Since then Deploy only runs after its migrations succeeded, so this is for a box an older run left that way. A later run for a newer commit then finds files pending on the box's current tree:
- It carries them into its own run when a workflow deploy put the box there and did not finish. The evidence is the unfinished-deploy mark the Deploy step writes and a successful Restart removes, or, for a box stopped before the mark existed, that deploy's own `/home/ubuntu/dist-backup-…-<sha12>` for the current commit.
- The plan prints "put at … by a deploy that did not finish" and `PLAN_CARRIED=` lines. The run summary lists them under "Carried from a deploy that did not finish".
- The snapshot is taken first as always, and the Migrate step applies the carried files with the range's own.
- Anything else still stops in Plan: an unreadable ledger, or files pending with no such evidence, such as code moved by hand.
- First case: Deploy run 64 (`d0850184`, 2026-10-11) ran out of heap in `vite build`, and runs 65–69 stopped in Plan until this change.

---

## 2. One-time setup (Evoni)

Do these in order. Placeholders: `<ACCOUNT_ID>`, `<REGION>`, `<RDS_INSTANCE_ID>` (the canon instance), `<EC2_INSTANCE_ID>` (the production box).

**On the box, paths are full.** Session Manager logs in as `ssm-user`, whose `~` is `/home/ssm-user`. The app, its backups and the migration file belong to `ubuntu` under `/home/ubuntu` (the app is `/home/ubuntu/episode-metadata`). This runbook writes box paths in full. Anything that changes the app (`git`, `pm2`, files in `/home/ubuntu`) runs as `ubuntu`: start with `sudo -iu ubuntu`, which also makes `~` mean `/home/ubuntu` (Evoni, 2026-10-13).

### 2.1 AWS: identity provider and role

1. **IAM → Identity providers.** If there is no `token.actions.githubusercontent.com` provider, add one: OpenID Connect, URL `https://token.actions.githubusercontent.com`, audience `sts.amazonaws.com`.
2. **IAM → Roles → Create role → Custom trust policy.** Name it, for example, `episode-gha-deploy-prod`. Trust policy:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": { "Federated": "arn:aws:iam::<ACCOUNT_ID>:oidc-provider/token.actions.githubusercontent.com" },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
          "token.actions.githubusercontent.com:sub": "repo:angelcreator113/Episode-Canonical-Control-Record:environment:production"
        }
      }
    }
  ]
}
```

   Only a job running in the `production` environment, which means after Evoni's approval, can assume it. Keep the maximum session duration at 1 hour.

3. **Permissions**: add this as an inline policy, and attach nothing else:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "CreateDeploySnapshot",
      "Effect": "Allow",
      "Action": ["rds:CreateDBSnapshot", "rds:AddTagsToResource"],
      "Resource": [
        "arn:aws:rds:<REGION>:<ACCOUNT_ID>:db:<RDS_INSTANCE_ID>",
        "arn:aws:rds:<REGION>:<ACCOUNT_ID>:snapshot:deploy-*"
      ]
    },
    {
      "Sid": "DescribeDeploySnapshot",
      "Effect": "Allow",
      "Action": "rds:DescribeDBSnapshots",
      "Resource": [
        "arn:aws:rds:<REGION>:<ACCOUNT_ID>:db:<RDS_INSTANCE_ID>",
        "arn:aws:rds:<REGION>:<ACCOUNT_ID>:snapshot:deploy-*"
      ]
    },
    {
      "Sid": "DeleteOldDeploySnapshots",
      "Effect": "Allow",
      "Action": "rds:DeleteDBSnapshot",
      "Resource": "arn:aws:rds:<REGION>:<ACCOUNT_ID>:snapshot:deploy-*"
    },
    {
      "Sid": "SendOnlyTheDeployDocument",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ssm:<REGION>:<ACCOUNT_ID>:document/PrimeStudios-Deploy",
        "arn:aws:ec2:<REGION>:<ACCOUNT_ID>:instance/<EC2_INSTANCE_ID>"
      ]
    },
    {
      "Sid": "ReadCommandResults",
      "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation", "ssm:DescribeInstanceInformation"],
      "Resource": "*"
    },
    {
      "Sid": "NeverThese",
      "Effect": "Deny",
      "Action": [
        "cognito-idp:*", "cognito-identity:*", "secretsmanager:*",
        "ssm:GetParameter*", "ssm:PutParameter", "ssm:StartSession", "kms:Decrypt",
        "rds-db:connect", "rds:Modify*", "rds:Restore*",
        "rds:RebootDBInstance", "rds:StopDBInstance", "iam:*", "ec2:*"
      ],
      "Resource": "*"
    },
    {
      "Sid": "NeverDeleteAnythingElse",
      "Effect": "Deny",
      "Action": "rds:Delete*",
      "NotResource": "arn:aws:rds:<REGION>:<ACCOUNT_ID>:snapshot:deploy-*"
    }
  ]
}
```

   **Adding the delete permission to an existing role (once; Evoni, 2026-10-22).** IAM → Roles → the deploy role → its inline policy → **Edit** → JSON:
   1. Add the `DeleteOldDeploySnapshots` statement above.
   2. In `NeverThese`, remove `"rds:Delete*"` from the list. An explicit deny always wins, so with it there the role still could not delete anything.
   3. Add the `NeverDeleteAnythingElse` statement above. It denies every other RDS delete (the instance, clusters, other snapshots) everywhere except `deploy-*` snapshots.
   4. **Save.** The next run removes the older `deploy-*` snapshots itself. Until then, it warns and goes on, and old snapshots are removed by hand (§7).

   When the frontend is built on the runner (§2.5), add one more statement to the `Statement` list, with your bucket's name:

```json
    {
      "Sid": "HandFrontendBuildToTheBox",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::<ARTIFACT_BUCKET>/deploy-builds/*"
    }
```

   `s3:GetObject` is what the 15-minute link the box downloads with is signed with; `s3:PutObject` is the upload. Nothing else in the bucket, and no other bucket.

   `rds:AddTagsToResource` is there because RDS asks for it when the instance copies its tags to snapshots. `ssm:GetCommandInvocation` and `ssm:DescribeInstanceInformation` do not support resource-level scoping, hence `*`. The role can run **only** `PrimeStudios-Deploy`, never `AWS-RunShellScript`, so it cannot run arbitrary commands as root.

### 2.2 AWS: the SSM document and the box

1. **Systems Manager → Documents → Create document → Command or Session.** Name `PrimeStudios-Deploy`, type Command, format JSON. Content:

```json
{
  "schemaVersion": "2.2",
  "description": "Prime Studios production deploy: runs one phase of scripts/deploy/workflow-deploy.sh, taken from a commit on origin/main, as ubuntu.",
  "parameters": {
    "phase": {
      "type": "String",
      "description": "plan, deploy, migrate or restart",
      "allowedValues": ["plan", "deploy", "migrate", "restart"]
    },
    "sha": {
      "type": "String",
      "description": "Full commit SHA on origin/main",
      "allowedPattern": "^[0-9a-f]{40}$"
    }
  },
  "mainSteps": [
    {
      "action": "aws:runShellScript",
      "name": "runPhase",
      "inputs": {
        "timeoutSeconds": "1800",
        "runCommand": [
          "sudo -u ubuntu -H bash -c 'set -euo pipefail; cd /home/ubuntu/episode-metadata; git fetch --quiet origin main; git merge-base --is-ancestor {{ sha }} origin/main; f=$(mktemp); trap \"rm -f $f\" EXIT; git show {{ sha }}:scripts/deploy/workflow-deploy.sh >\"$f\"; bash \"$f\" {{ phase }} {{ sha }}'"
        ]
      }
    }
  ]
}
```

   This is the document without the runner's build. §2.5 replaces it with one that has two more parameters.

   The two parameters are fixed by `allowedValues` and `allowedPattern`, so nothing else can be passed in. The script always comes from a commit already on `origin/main`, which means a reviewed and merged PR.

2. **Make the box SSM-managed.** Today the production box has **no IAM instance profile**, so SSM cannot reach it. `PROJECT_CONTEXT.md` §7, prod-box row, records "no IAM instance profile (so no SSM)", and F-Deploy-1 finding AD ("no instance profile on prod") is still owed after the keystone's close. Give it one:
   1. **IAM → Roles → Create role**, trusted entity **AWS service → EC2**. Name it, for example, `episode-prod-ssm`. Attach **only** the AWS-managed policy `AmazonSSMManagedInstanceCore`.
   2. **EC2 → the production instance (`<EC2_INSTANCE_ID>`) → Actions → Security → Modify IAM role**, choose that role, and save. No reboot is needed.
   3. On the box, check the SSM agent is running: `sudo snap services amazon-ssm-agent` (Ubuntu images ship it as a snap; INFERRED, so check). If it is missing or stopped, install or start it from the AWS documentation for Ubuntu.
   4. **Systems Manager → Fleet Manager:** the instance shows **Online**. It can take a few minutes after the role is attached.
3. **Keep that role to SSM only.** The deploy runs as `ubuntu` on the box, and anything running there as root can use the instance role. The role holds `AmazonSSMManagedInstanceCore` and nothing else: no Secrets Manager, no Cognito, no S3 or RDS permissions. The app's only Cognito call (`InitiateAuthCommand`) needs no IAM permission.

   *INFERRED: how the app's own AWS access is affected.* The AWS SDK's default credential chain uses environment variables and `~/.aws/credentials` before the instance profile. `ecosystem.config.js` notes that the app's "credentials come from ~/.aws/credentials or env vars". If the app gets its AWS credentials either way today, attaching the role does not change what the app can do. Check which source the app uses without printing any value, for example whether `/home/ubuntu/.aws/credentials` exists and whether `/home/ubuntu/episode-metadata/.env` has an `AWS_ACCESS_KEY_ID=` line (count it, as `scripts/deploy-prod.sh` counts `ANTHROPIC_API_KEY`). If it has neither, the app would start using the instance role for S3 and similar calls. Then it would get only SSM permissions, and those calls would fail, so decide with that in mind.
4. **The migration credential** (Evoni's ruling for #2837: a `600` file on the box). On the box, as `ubuntu` (from Session Manager, `sudo -iu ubuntu` first):

```bash
umask 077
read -r -p 'Migration DB user: ' U
read -r -s -p 'Migration DB password: ' P; echo
printf 'DB_USER=%s\nDB_PASSWORD=%s\n' "$U" "$P" > /home/ubuntu/.episode-migrate.env
unset U P
chmod 600 /home/ubuntu/.episode-migrate.env
stat -c '%a %U' /home/ubuntu/.episode-migrate.env    # must print: 600 ubuntu
```

   Use exactly two lines, `DB_USER=` and `DB_PASSWORD=`, with no quotes and no spaces around `=`. This is the privileged user the deploy records describe ("a separate database user", `F-Deploy-1_Deploy_2026-09-30_CT.md` §0). The app's own credentials stay in `.env` as today. When that password changes, rewrite this file the same way.

### 2.3 GitHub: environment and variables

1. **Settings → Environments → `production`** (create it if it is missing):
   - **Required reviewers:** Evoni.
   - **Prevent self-review:** off. She is the only reviewer, and pushes to `main` come from her merges.
   - **Deployment branches and tags:** selected branches, `main` only.
2. **Settings → Environments → `production` → Environment secrets → Add environment secret:** `AWS_ROLE_ARN` = the role from §2.1. A secret, not a variable, so the public job log shows `***` in its place (#2863). The workflow reads `secrets.AWS_ROLE_ARN`, and a run with it missing stops at **Check configuration**, changing nothing.
3. **Settings → Secrets and variables → Actions → Variables** (repository variables; they are not secret):

| Variable | Value |
|---|---|
| `AWS_REGION` | the region of the instance and the database |
| `RDS_INSTANCE_ID` | the canon instance's identifier |
| `EC2_INSTANCE_ID` | the production box's instance id |
| `HEALTH_URL` | the public `/health` URL of the site |
| `DEPLOY_SNAPSHOTS_KEEP` | optional: how many `deploy-*` snapshots a run keeps before taking its own (default 10, never fewer than 3) |
| `DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN` | optional: `0` lets the run remove older snapshots; anything else, or unset, is a dry run that only lists them (default: dry run) |
| `DEPLOY_SNAPSHOTS_MAX_DELETE` | optional: the most snapshots one run removes (default 5, 1 to 20) |
| `DEPLOY_SNAPSHOTS_MIN_AGE_DAYS` | optional: snapshots newer than this many days are never removed (default 7, at least 1) |

**Moving `AWS_ROLE_ARN` from a variable to a secret (once; Evoni, in the browser).** Step 1 can be done before #2863 merges, since an unused secret changes nothing; that way no run ever stops for it. Step 2 comes after the merge.
1. **Settings → Environments → `production` → Environment secrets → Add environment secret.** Name `AWS_ROLE_ARN`; value: copy it from the existing repository variable (Settings → Secrets and variables → Actions → Variables → `AWS_ROLE_ARN`), unchanged.
2. **Settings → Secrets and variables → Actions → Variables:** delete the repository variable `AWS_ROLE_ARN`.
3. Nothing in AWS changes: the role, its trust policy and its permissions stay as they are.

If a run starts after #2863 merges but before step 1, it stops at **Check configuration** ("The production environment secret AWS_ROLE_ARN is not set"), with nothing changed. Do step 1, then **Re-run jobs** on that run, or approve the next one. Doing step 2 before step 1 has the same effect. Logs of runs before the change (Deploy #21 and earlier) still show the account number; deleting those run logs (the run page's ⋯ menu → **Delete all logs**) is optional.

### 2.4 Turn it on and approve the first run

1. Add the variable `DEPLOY_ENABLED` = `true`.
2. Start a run: Actions → **Deploy** → **Run workflow** on `main` (browser). Paste the full commit SHA into **expected_sha** (and, if wanted, the PR numbers into **expected_prs**). Leave **baseline_sha** empty (§4, "Baseline unknown"). Merging a PR does not start one.
3. Approve it (§3) and watch the steps. **Evoni's approval of this first run is when the Rule 7 decision takes effect** (decision item 7).

To turn the workflow off at any time, set `DEPLOY_ENABLED` to anything but `true`, or delete it.

### 2.5 Build the frontend on the runner, not the box

The box has about 1.9 GB of memory and no swap. Deploy runs 93–94 (2026-10-12) stopped while `vite build` ran out of room there: run 93's build was stopped at 1200 s, and the box then dropped out of SSM (`ConnectionLost`). With this set up, GitHub's runner builds the frontend (step 0) and the box only unpacks it. Without it, the box builds as before, so nothing changes until Evoni does all of the following, **in this order**:

1. **S3 → Create bucket** (for example `episode-deploy-builds-<ACCOUNT_ID>`), in the same region. Keep **Block all public access** on, default encryption on, versioning off.
   - **Management → Create lifecycle rule:** prefix `deploy-builds/`, **Expire current versions of objects** after 1 day. Builds are only needed for the 15 minutes the link lasts.
2. **The deploy role** (§2.1): add the `HandFrontendBuildToTheBox` statement with this bucket's name. The box's own role stays SSM-only (§2.2 step 3); the box downloads through the link and needs no S3 permission and no `aws` CLI.
3. **Systems Manager → Documents → `PrimeStudios-Deploy` → Actions → Create new version.** Paste the content below, with your bucket name and region in `artifact`'s `allowedPattern`, then **set the new version as the default**. The old workflow still works with it: both new parameters default to `none`.

```json
{
  "schemaVersion": "2.2",
  "description": "Prime Studios production deploy: runs one phase of scripts/deploy/workflow-deploy.sh, taken from a commit on origin/main, as ubuntu.",
  "parameters": {
    "phase": {
      "type": "String",
      "description": "plan, deploy, migrate or restart",
      "allowedValues": ["plan", "deploy", "migrate", "restart"]
    },
    "sha": {
      "type": "String",
      "description": "Full commit SHA on origin/main",
      "allowedPattern": "^[0-9a-f]{40}$"
    },
    "artifact": {
      "type": "String",
      "description": "none, or a presigned link to the runner's frontend build in the deploy bucket",
      "default": "none",
      "allowedPattern": "^(none|https://<ARTIFACT_BUCKET>\\.s3(\\.<REGION>)?\\.amazonaws\\.com/deploy-builds/[0-9a-f]{40}-[0-9]+-[0-9]+\\.tgz\\?[A-Za-z0-9%&=._~-]+)$"
    },
    "artifactSha256": {
      "type": "String",
      "description": "none, or the sha256 of the runner's frontend build",
      "default": "none",
      "allowedPattern": "^(none|[0-9a-f]{64})$"
    }
  },
  "mainSteps": [
    {
      "action": "aws:runShellScript",
      "name": "runPhase",
      "inputs": {
        "timeoutSeconds": "1800",
        "runCommand": [
          "sudo -u ubuntu -H bash -c 'set -euo pipefail; cd /home/ubuntu/episode-metadata; git fetch --quiet origin main; git merge-base --is-ancestor {{ sha }} origin/main; f=$(mktemp); trap \"rm -f $f\" EXIT; git show {{ sha }}:scripts/deploy/workflow-deploy.sh >\"$f\"; bash \"$f\" {{ phase }} {{ sha }} \"{{ artifact }}\" {{ artifactSha256 }}'"
        ]
      }
    }
  ]
}
```

   SSM parameter names are letters and digits only (the console refuses `artifact_sha256` with `InvalidDocumentContent: … is not alpha-numeric`, 2026-10-13), hence `artifactSha256`.

   The link is in double quotes because it holds `&` and `?`. Its pattern allows no quote, space, `$` or backtick, so it cannot break out of them. The script on the box checks the link and the sha256 again before it downloads anything.
4. **Check the box has no untracked frontend settings.** The runner builds from the repository alone. On the box, `ls -a /home/ubuntu/episode-metadata/frontend | grep '^\.env'` (the full path: Session Manager's `~` is `/home/ssm-user`) should list only `.env.example` and `.env.production`, which are both in the repository. A `.env.local` or `.env.production.local` there means the box's builds used settings the runner's will not: tell the session which variable names it holds (not the values) before going on.
5. **Settings → Secrets and variables → Actions → Variables:** add `DEPLOY_ARTIFACT_BUCKET` = the bucket's name. The next run uses it.

To go back to building on the box, delete `DEPLOY_ARTIFACT_BUCKET`. The document and the role can stay as they are.

If the variable is set before the document has the new parameters, the Deploy step stops at `send-command` (`InvalidParameters`) with nothing on the box changed: finish step 3, then re-run.

### 2.6 Afterwards: retire the old path

`deploy-production.yml` and `.github/scripts/deploy-production.sh` were removed with this workflow. Once a run has succeeded, Evoni deletes the repository secrets only they used:
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `EC2_SSH_KEY`, `EC2_HOST`, `EC2_USER`
- `PRODUCTION_DATABASE_URL`, `PROD_DB_HOST`, `PROD_DB_NAME`, `PROD_DB_USER`, `PROD_DB_PASSWORD`
- `FAL_KEY`, `REMOVEBG_API_KEY`

She also deactivates and then deletes the IAM access key behind the first two.

---

## 3. Approving a run (phone)

Each run waits at **Deploy to production** with "Waiting for review". GitHub notifies the required reviewer.

1. Open the run: from the notification, or from **Actions → Deploy** in GitHub Mobile, or github.com in the phone's browser.
2. Tap **Review deployments**, tick **production**, then **Approve and deploy** (or **Reject**).
3. If GitHub Mobile does not show the review button, use the browser. The page and buttons are the same.

Before approving, open the run's **Release summary** (the build job's summary): the target is the commit you pinned, and the list of commits, PRs and migrations is exactly what you mean to ship. If anything is unexpected, **Reject**. A run left waiting expires after 30 days. A newer push replaces a waiting run.

---

## 4. When a run stops

Read the step's log: the on-box output says where it stopped and what had already changed. The summary names the snapshot.

| Stopped at | State | What to do |
|---|---|---|
| Configuration, OIDC, preflight, plan | Nothing changed | Fix the cause (variables, role, SSM, the plan's message), then re-run. A plan that stops on **package files** means: deploy that range by hand (`DEVELOPMENT_WORKFLOW.md` §7.1), then later runs resume normally |
| Snapshot or wait | Nothing on the box changed, and **no older snapshot was removed** (removal runs only at the end of a healthy deploy; a run that stops anywhere removes none) | Look at the snapshot in RDS; re-run. "RDS already holds its limit of manual snapshots" (`SnapshotQuotaExceeded`): the run can no longer make room for itself, so remove old `deploy-*` snapshots by hand in RDS → Snapshots → Manual, then start a new run |
| Deploy | Tree may be fast-forwarded, `frontend/dist` rebuilt or partly rebuilt; **the API still runs the old code**; database untouched | Re-run (it resumes), approve the next run (it carries the stopped deploy's migrations, §1), or roll back the code (§6). "the vite build failed" with an out-of-memory abort in its last lines: the heap the log names was too small for the box. "the vite build ran past 1200 s" (or, before that limit existed, SSM status `TimedOut` right after the "vite build with a … MB heap" line, as in runs 80–81): the box was short of memory; the log prints `Memory:` and `Swap:` lines before and after. "a vite build is still running on the box": a build left by a timed-out deploy; nothing was changed. On the box, `pgrep -af 'vite(\.js)? build'` lists it and `sudo kill <pid>` stops it (it runs as `ubuntu`); then approve a new run. With the runner's build (§2.5): "could not be downloaded (the link may have expired)", "sha256 is …, not …", "is not a readable archive", "holds something other than dist/" or "has no dist/index.html" all stop before the backup, with nothing changed: start a new run |
| Build (step 0) | Nothing changed | Read the build log; it is the same `vite build` a contributor runs. Fix forward by PR |
| Migrate | **The database may be partly migrated**; the live tree, `frontend/dist` and the running API are **unchanged** (old code); no migrate record, so Deploy and Restart refuse. The staged copy is kept at `/home/ubuntu/.episode-stage/<sha>` | Nothing is undone or restored automatically. Read the migration error. Usually fix forward: a new PR, merged, then a new run. If the data is damaged, restore from the snapshot (§5). Messages that stop before any migration, with nothing changed: "package files change…" (deploy that range by hand), "not on origin/main", "not a fast-forward", "does not hold exactly … files", ".env or node_modules is not the live one", "would not load the staged config…". "an earlier staged release is still in use": on the box, `ps -o pid,args -p <pid>` names the process; if it is a `db:migrate` from a stopped run, let it finish or ask why it is still running before a new run. "a migration waited more than 30s for a lock" (`canceling statement due to lock timeout`): another connection held the table the migration alters. The waiting statement was cancelled, so nothing queues behind it. Find the holder in the database: `SELECT pid, usename, state, now() - xact_start AS open_for, left(query, 120) FROM pg_stat_activity WHERE pid IN (SELECT pid FROM pg_locks WHERE relation = '<table>'::regclass) OR state = 'idle in transaction' ORDER BY xact_start;`. End a stuck one with `SELECT pg_terminate_backend(<pid>);` (or restart the API, which drops its connections), then start a new run. Before this limit (run 176), the same wait ran to SSM status `TimedOut` after 1800 s, right after the "Running sequelize-cli db:migrate" line, holding every query on that table behind it; on the box, `pgrep -af 'db:migrate'` lists one still waiting |
| Deploy, after Migrate succeeded | Database migrated; the live tree is old or fast-forwarded and the API still runs the old code | See "Migrate succeeded, Deploy or Restart did not" below |
| Restart | New code, possibly unhealthy; a worker that was online may not be restarted (a stopped one is never started); the database is migrated | Look at `pm2 logs` by hand; roll back the code (§6) or fix forward. See "Migrate succeeded, Deploy or Restart did not" below. "the migrate phase has not succeeded for …", "the staged release of … is gone", "does not hold exactly … files" or "the ledger check for … exited …": Deploy or Restart refused before changing anything, or before any `pm2` call. Start a new run; its Migrate applies anything missing |
| Public health | On-box `/health` was fine; the public URL is not | Check the load balancer and target group; the box itself is up |
| Nowhere: the run is green, with a **retention warning** in the summary | The deployment succeeded and is healthy. Older `deploy-*` snapshots were not all removed (no permission, a listing or delete failed, the new snapshot was not confirmed, or the step stopped unexpectedly) | Nothing to undo and nothing to re-run. Read the step's log; if needed remove old `deploy-*` snapshots by hand in RDS → Snapshots → Manual (§7). The next healthy deploy tries again |

**Baseline unknown (D-21).** The build job's release summary step stops with "Production's baseline is unknown" when the GitHub API lookup of the last successful Deploy run failed or found none. Nothing was built and nothing on the box changed. It never guesses.
- **Lookup failed** (a GitHub outage, or the `actions: read` permission missing): start a new run later, unchanged.
- **No successful run found**, or the lookup keeps failing: read the commit production runs, read-only. Use the last Deploy record, or on the box `git -C /home/ubuntu/episode-metadata rev-parse HEAD`. Then start a new run with that full commit as **`baseline_sha`**. The release summary labels it as given by you, not as the last successful deploy. Approve only if the list is what you mean to ship. The deploy job still stops before any snapshot if the box is not at that commit.
- `baseline_sha` is refused when it contradicts a successful run the lookup did find. It cannot override a known baseline.

**Box at the target without a record (D-21).** "The box is already at …, but no Deploy record on it says a deploy put it there": the box is at the commit this run would deploy, and neither record names it. Nothing was changed. An equal commit is not proof: the box may have been moved by hand, and the API may not run that code, or may run it without its migrations.
1. Find out how the box got there: the Deploy run logs, and on the box `git reflog -5` and `pm2 status` (read-only).
2. If a Deploy run did it, the record should be there. Do not go on until you know why it is not.
3. If it was a hand deploy you mean to keep: finish it by hand (`DEVELOPMENT_WORKFLOW.md` §7.1: the migrations, a restart, `/health`). Then record it on the box, as one line: `printf '%s %s\n' <baseline> <target> > ~/.episode-deploy-finished`, where `<baseline>` is the commit the release summary started from. That is an explicit owner action; note it in the deploy record. A new run then passes as "finished" and verifies the deploy again (migrate check, restart, health).
4. Otherwise roll the box back to the baseline by hand (§6). The next run then passes normally.

The same message with "coming from …, not from the release summary's base" means the record names a different starting point than the summary. Work out which is right in the same way.

**Migrate succeeded, Deploy or Restart did not.** The database already has the new schema. The old code keeps running on it, which is safe for the additive migrations this order assumes (§1, "Migrate before Deploy").
- **Nothing needs undoing.** Never run the migration's `down` because of this, and do not restore the snapshot. Neither is a fix for a code failure, and both lose data once the new columns are in use.
- **To finish:** fix the cause, then re-run or start a new run. The plan ignores ledger rows that have no file in the live tree, Migrate finds nothing pending and records the commit, and Deploy and Restart complete.
- **To go back instead:** roll back the code only (§6). The schema stays as it is.

---

## 5. Restoring from a snapshot (Evoni)

Do this only if a migration damaged data. A restore creates a **new** RDS instance; it does not overwrite the existing one.

1. RDS → Snapshots → **Manual** → the run's `deploy-…` snapshot → **Actions → Restore snapshot**.
2. Give it a new identifier, and use the same instance class, subnet group, security group and parameter group as the canon instance. Wait for **Available**.
3. Point production at it, by either:
   - **Swap names (keeps `DB_HOST`):** rename the current instance (for example to `<id>-broken-<date>`), wait, then rename the restored one to the original identifier. Its endpoint becomes the old one, so `.env` does not change. Then run `pm2 restart episode-api-prod-hotfix` (and `episode-worker` only if it is meant to be running, §1) and check `/health`.
   - **Or change `DB_HOST`** in the server `.env` to the restored endpoint, then `pm2 restart … --update-env` and `pm2 save` (`DEVELOPMENT_WORKFLOW.md` §7.2).
4. Keep the old instance until the restored one is verified. The restored database has the ledger from before the migration. Roll the code back (§6) to match it, or the next run will migrate again.

---

## 6. Rolling back the code

- **Preferred:** revert the PR on GitHub, merge the revert, and approve the new run. This works when the bad change needs no schema rollback. The run deploys the revert like any other commit.
- **By hand, on the box** (Evoni), when the site must come back before a revert can be merged. As `ubuntu`, in the app: `sudo -iu ubuntu`, then `cd /home/ubuntu/episode-metadata` (`pm2` lists only the processes of the user running it, so `ssm-user` would see none):
  1. `git reset --hard <Box before SHA from the run summary>`.
  2. `rm -rf frontend/dist && cp -a /home/ubuntu/dist-backup-<…>-<sha12> frontend/dist` (the `DEPLOY_BACKUP` path in the deploy step's log).
  3. `pm2 restart episode-api-prod-hotfix` (and `episode-worker` only if it is meant to be running, §1), then check `/health`.

  The database stays migrated; down-migrations are never run automatically. `main` still has the bad commit, so the next run will deploy it again until it is reverted. The next run's plan also requires the box to be a fast-forward of the target, which it will be after a revert.

  **Before either path, check §6.1:** a rollback to code from before the Camera Roll make-safety release (#3739) needs its containment steps first.

- **A code-only rollback keeps the schema.** Since Migrate runs first (§1, "Migrate before Deploy"), the old code has already been running against the new schema, so going back to it needs no schema change. Never run the migration's `down` as part of a rollback: for example, `20261026190000-add-script-line-keys` drops both `script_line_keys` columns, and every line identity in them once A1c writes them. A revert must also keep every migration file: a range that deletes or changes one stops in Plan. So revert the code, not the migration (a PR that removes the model or route changes and leaves `src/migrations/` as it is). Restore the snapshot (§5) only for damaged data, knowing it loses every write since the snapshot.

### 6.1 Rolling back past the Camera Roll make-safety release (#3739)

**When this applies:** production runs #3739 or later (it has migration `20261107150000-camera-roll-make-claims`), and the rollback target is code from before #3739. The default is not to do this: fix forward instead. A rollback from #3740 to #3739 alone needs none of this.

**Why:** code from before #3739 sends the paid image request before writing anything, does not know `making` or `uncertain`, and lets Keep revive an abandoned photo. After a rollback it could pay again for a photo that may already be paid for: an `uncertain` photo (direct Make), a photo that was `making`, a photo with an attempt marker, or an abandoned one (Keep, then make-kept). No database rule can stop that, because the payment comes before any write. That code does skip every photo whose `deleted_at` is set, so containment soft-deletes exactly those photos, records each one, and restores them exactly afterwards.

**Rules that always hold:**
- **Never run the Camera Roll down migration.** It refuses while any photo is `making` or `uncertain`; otherwise it drops the claim columns and every recorded attempt, which cannot be undone. The revert keeps `src/migrations/` as it is (above).
- **An unknown outcome stays potentially chargeable.** An `uncertain` photo, or one with an attempt marker, is never retried, by hand or by any tool, until it is resolved on #3739 or later code (acknowledge, a one-time authorization, or attach a stored image with #3740).
- **Waiting is not proof.** No length of wait shows that a paid request has settled; a request the provider accepted may still be charged later. What makes the at-risk set complete is step 1 below: after the stop, no process can send a new request, and every photo that ever sent one carries the attempt marker, so containment covers it.
- **Containment is mandatory on every path.** No rollback past #3739 starts, by the Deploy workflow or by hand, until steps 1–3 are done and `status` shows `atRisk: 0` and, when anything is contained, `guardComplete: true` and `unsafe: false`. Every potentially charged photo is in the at-risk set: `making`, `uncertain` (an acknowledged or authorized photo stays `uncertain`), abandoned, and any other photo with an attempt marker that is not `made`. An at-risk count of 0 before step 1 proves nothing; only the count after the stop does.
- Every production step below is a production action with Evoni's yes in the session; `contain --apply` and `restore --apply` change data and need their own yes.

**The command:** `scripts/maintenance/camera-roll-containment.js` (library `scripts/maintenance/cameraRollContainment.js`). It is maintenance only: no deploy phase, pm2 app, npm script or application module runs it. `contain` and `restore` are dry runs unless `--apply` is given, and `--apply` refuses without `--by` and `--approval-ref`. `status` is always read-only. It prints JSON (photo ids, statuses, counts, privilege booleans), never a credential or host. Writes go to `data_correction_log`, which the application role cannot use, so it runs with the migration login, as `ubuntu` in `/home/ubuntu/episode-metadata`, the same way the migrate phase does:

```bash
set +x
mig_user="$(sed -n 's/^DB_USER=//p' ~/.episode-migrate.env | head -1)"
mig_pass="$(sed -n 's/^DB_PASSWORD=//p' ~/.episode-migrate.env | head -1)"
DB_USER="$mig_user" DB_PASSWORD="$mig_pass" NODE_ENV=production DEBUG_CONFIG=false SQL_LOGGING=false \
  PGOPTIONS="-c lock_timeout=30s -c search_path=public" \
  node scripts/maintenance/camera-roll-containment.js status
unset mig_user mig_pass
```

**Procedure** (the order matters):
1. **Stop paid image generation, and prove it.** Use the primary stop the AI Operations Center review settles on; until it exists, remove `OPENAI_API_KEY` from where the API reads it (`.env` or pm2's stored environment: a names-only check says which; if it is pm2's, the restart needs `--update-env`), then `pm2 restart episode-api-prod-hotfix`. Do not use `AI_DAILY_IMAGE_BUDGET_USD=0`: older code reads 0 as $10. This stops every OpenAI feature, not only Camera Roll. The verification has two parts, and both are required; the first alone is not enough:
   - **(a) A locally rejected test request,** which shows only that the one path tested is refused: one image request (for example a media variation on a test asset, not a camera-roll photo) answers 503 "The image tool is not set up (OPENAI_API_KEY)". `mediaVariations.editImage` refuses before the budget gate and before any outbound call, and a read-only count of `ai_usage_logs` rows for image routes created since the restart is 0.
   - **(b) Proof that every submission path is stopped and every in-flight request is accounted for:**
     - **Every process that could submit is stopped or has no key.** `pm2 jlist` lists every process on the box; each one that loads this code (the API, and the episode worker or voice worker if present) is stopped, or a names-only check of its live environment and of `.env` (CURRENT and NEXT_RESTART, as in the switch check) shows `OPENAI_API_KEY` ABSENT. The key is read at call time from the process environment, so a process started before the removal still has it until it restarts. Nothing else on the box runs this code: `crontab -l` for `ubuntu` and root lists no job that does.
     - **No process from before the stop can send again.** The API's pm2 restart count went up by one and its start time is after the removal, so the process that may have sent a request no longer exists: it cannot send more, retry, or record late results. **This says nothing about the provider:** a request it had already sent may still be running, finish, or be charged at the provider after the restart. The restart is not proof that any provider request has finished; the next point is what accounts for those requests.
     - **Every request sent before the stop is on record.** #3739 commits a photo's attempt marker before the paid request is sent, so every photo that may have been charged is `making`, `uncertain` or carries the marker, and step 3 contains it. A request the provider accepted may still be charged later; that is why such photos stay contained and are never retried, whatever the logs show.
2. **Check the state and the permissions:** `status`. Every value under `privileges` must be `true` and `unsafe` must be `false`. Record `atRisk`.
3. **Contain:** `contain --op-id <cr-rollback-YYYYMMDD>` (a dry run) lists every at-risk photo and any whose character, event, episode or post is already gone. Review it, then with Evoni's yes: `contain --op-id <same> --apply --by <name> --approval-ref "<her yes, with date>"`. In one transaction it locks the four parent tables, installs the deletion guard on all of them, verifies it, then hides and logs the photos; a failure rolls all of it back. Run `status` again: `contained` equals the number fenced, `atRisk` is 0, `guardComplete` is `true`.
4. **Roll the code back** by the preferred path above (a revert that keeps `src/migrations/`), only once the gate under "Containment is mandatory on every path" holds. Neither path enforces it: the Deploy workflow does not check it yet, and the by-hand path skips the workflow entirely.
5. **While rolled back:** paid images stay stopped. Check `status` before any later step; `unsafe: true` (a guard missing or disabled on any of the four tables while photos are contained) is a hard stop: re-run step 3's `--apply` with the same op id, which puts the guard back and hides nothing new. A character, event, episode or post that a contained photo uses cannot be deleted until restore; the refusal names the containment.
6. **Roll forward and restore:** deploy #3739 or later again. Then `restore --op-id <same>` (a dry run), review, and with Evoni's yes `restore --op-id <same> --apply --by <name> --approval-ref "<…>"`. It restores a photo only while its `deleted_at` is still the operation's exact fence time, so a photo deleted again by anyone stays deleted (`deletedAgain`). A photo whose character, event, episode or post is gone stays contained and is reported (`blocked`) for a decision. The guard is removed only when no photo from any operation is contained. Turn paid generation back on last. Restored photos keep their status: an `uncertain` photo is still uncertain and is resolved by hand, never retried.

**Limitations (outside the automatically enforced protection):**
- **Privileged SQL:** a superuser, `session_replication_role = replica`, `ALTER TABLE … DISABLE TRIGGER`, `DROP TRIGGER`, or a direct `DELETE` or `UPDATE` of `camera_roll_moments` bypasses the guard and the containment. `status` reports a missing or disabled guard; it cannot see the rest.
- **The by-hand rollback path** (§6) is only as safe as the operator following steps 1–3 first. The Deploy workflow does not yet refuse a target that drops this safety (a Tier 2 capability check, designed but not built).
- **Coverage:** Camera Roll photos only. Post pictures (#3738) and other paid paths have their own switches and are not contained here; while rolled back, step 1's stop is what covers them.
- **The stop is coarse:** removing the key stops every OpenAI feature until it is put back.
- **Blocked photos** (a parent gone) stay hidden until someone decides; they are listed by `restore`.

**Permissions the migration login needs** (`status` checks each one, without writing): `SELECT, UPDATE` on `camera_roll_moments`; `SELECT, INSERT, UPDATE` on `data_correction_log` (its trigger allows only inserts and the undo transition); `SELECT` on `character_registries`; `SELECT, UPDATE, TRIGGER` on `registry_characters`, `world_events`, `episodes` and `feed_posts` (`UPDATE` is what `LOCK … SHARE ROW EXCLUSIVE` needs), **and membership in the role that owns each of those four tables** (PostgreSQL lets only the owner drop a trigger, and contain re-installs and restore removes the guard); `CREATE` on schema `public` (the guard function). It does not need superuser, DDL on any other table, or any delete. Who owns those four tables in production has not been checked; it is a read-only check (`status` shows `<table>.OWNER`) for a separate approval before this is relied on.

---

## 7. Housekeeping

- **Snapshots:** each run takes one manual snapshot, and those are billed until deleted. RDS allows 100 manual snapshots in all (the account quota; Evoni reads the used count and the maximum with the read-only `rds describe-account-attributes`, quota `ManualSnapshots`), and a run stops at its snapshot once the quota is reached (runs #145 and #146, 2026-10-22). With the delete permission (§2.1) and `DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN=0`, each run, as its last step and only after a successful deployment and public health check (since 2026-11-12; a failed release removes nothing), removes up to `DEPLOY_SNAPSHOTS_MAX_DELETE` of the older `deploy-*` snapshots and keeps the newest `DEPLOY_SNAPSHOTS_KEEP` (default 10), so they no longer pile up. Without it, Evoni removes old `deploy-*` snapshots in RDS → Snapshots → Manual and keeps at least the newest few. Manual snapshots with other names are never removed by a run.
  - **Protecting one snapshot:** tag it `keep` = `true` (RDS → Snapshots → the snapshot → Tags). A run never removes it, and it does not count toward `DEPLOY_SNAPSHOTS_KEEP`.
  - **Turning removal on (once, in this order):** (1) leave `DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN` unset; (2) add the §2.1 permission and check it with the IAM policy simulator (`DeleteDBSnapshot` on a `deploy-*` snapshot ARN allowed; on any other snapshot, and `DeleteDBInstance` on the instance, `explicitDeny`); (3) approve one run and compare its "Would remove" lines with RDS → Snapshots → Manual; (4) set `DEPLOY_SNAPSHOTS_MAX_DELETE=5` and `DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN=0`; the next runs remove at most 5 each, oldest first, until only the newest `DEPLOY_SNAPSHOTS_KEEP` remain. To stop removals, set `DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN=1` or remove the permission; the run then only reports. A removed snapshot cannot be brought back.
- **Frontend backups:** each deploy copies `frontend/dist` to `/home/ubuntu/dist-backup-<time>-<sha12>`.
  - **What is removed:** after a finished deploy, the Restart step removes all but the newest 3 (`BACKUP_KEEP` in `scripts/deploy/workflow-deploy.sh`).
  - **What is never removed:** the backup of the commit being deployed, links, and anything that isn't a directory.
  - **A failed removal** is reported in the run's summary and doesn't fail the deploy.
  - **Why:** on 2026-10-30, 230 backups (1.5 GB) had filled the 7.6 GB disk.
  - **By hand:** `/home/ubuntu/vite-build-*.log` and `dist-backup-*.log` still accumulate. They are small; remove old ones by hand.
- **Runner builds (§2.5):** the bucket's lifecycle rule deletes `deploy-builds/` objects after a day, and the run artifact expires after a day. The box deletes its downloaded copy once it is unpacked.
- **Changing the workflow:** by PR only. The scripts the box runs come from the commit being deployed. A change to `scripts/deploy/workflow-deploy.sh` therefore takes effect on the first run that deploys it.
