# Runbook: the Deploy workflow

`.github/workflows/deploy.yml` (Task #2837) deploys `main` to production and runs its migrations, after Evoni approves each run. It is built on the plan in `docs/reads/2026-10-10-deploy-path-read.md` §6–§9, under Evoni's Rule 7 decision (`docs/audit/F-Deploy-1_Rule7_DeployWorkflow_Ruling_2026-10-10.md`).

**Who does what.** Every step in this runbook that touches AWS, GitHub settings or the box is Evoni's. Agent sessions may change the workflow and its scripts through reviewed PRs, but never dispatch, approve, re-run or enable it. They never touch AWS or the box.

**Status until set up.** The workflow is off. Its job runs only when the repository variable `DEPLOY_ENABLED` is `true`, and Evoni sets that last (§2.4). Until her first approved run, the earlier rule applies in full: deploys stay her manual action (`DEVELOPMENT_WORKFLOW.md` §7.1, `scripts/deploy-prod.sh`).

---

## 1. What a run does

It runs only when Evoni starts it: **Run workflow** on the Actions tab, on `main` (browser; GitHub Mobile cannot start it). A merge no longer queues a run (Evoni, 2026-10-12): before that, each merge queued one, and a newer merge cancelled the one waiting for approval. A run deploys the head of `main` at the moment it starts. The job waits in the `production` environment until Evoni approves it. A running deploy is never cancelled.

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
| 4 | **Plan**, read-only: clean tree; the target is on `origin/main` and a fast-forward; **no package or lock file changes** (else stop: deploy that range by hand); no existing migration file modified; the ledger has nothing pending for the current code, unless an earlier deploy that did not finish left them (they are carried into this run; see below) | box | Nothing changed |
| 4a | **Remove older deploy snapshots** (`scripts/deploy/prune-snapshots.sh`, 2026-10-22; safeguards 2026-10-28): a **dry run** unless `DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN` is `0` (it names what it would remove and removes nothing). Otherwise it keeps the newest `DEPLOY_SNAPSHOTS_KEEP` (default 10, never fewer than 3) and removes at most `DEPLOY_SNAPSHOTS_MAX_DELETE` (default 5) older ones per run, oldest first, none newer than `DEPLOY_SNAPSHOTS_MIN_AGE_DAYS` (default 7). Never removed: snapshots tagged `keep=true`, names not exactly `deploy-<12 hex>-<run id>-<attempt>`, this run's own, automated and other manual snapshots, any not yet available. A listing that looks wrong removes nothing; three failed removals stop it. Without the delete permission (§2.1), or if a listing or delete fails, it warns and the run goes on. The summary says how many it removed, or would remove | runner | Never stops the run |
| 5 | **Snapshot**: `deploy-<sha12>-<run id>-<attempt>` of the RDS instance. If RDS already holds its 100 manual snapshots (`SnapshotQuotaExceeded`, runs #145 and #146 on 2026-10-22), it stops and says so | runner | Nothing on the box changed |
| 6 | **Wait** until the snapshot is `available` (up to 60 min) | runner | Nothing on the box changed |
| 7 | **Migrate**, from a staged copy of the commit, before anything on the live tree changes (Evoni, 2026-10-26; see "Migrate before Deploy" below): repeat the plan's checks for the target; stage it in `/home/ubuntu/.episode-stage/<sha>`; if files are pending, `sequelize-cli db:migrate` from there as the migration user from `/home/ubuntu/.episode-migrate.env`, then re-check (must be 0 pending). `db:migrate` waits at most 30 s for any one lock (`lock_timeout`, set by `MIGRATE_LOCK_TIMEOUT`; Deploy run 176, 2026-10-28). Only a success records the target in `/home/ubuntu/.episode-deploy-migrated` | box | §4, row "Migrate" |
| 7a | **Hand over the build**, only when `DEPLOY_ARTIFACT_BUCKET` is set (§2.5), after Migrate so the link is not spent on the migration: check the pack's sha256 against the build job's, upload it to `s3://<bucket>/deploy-builds/`, and make a link to it that expires in 15 minutes (masked in the log) | runner | Nothing on the box changed |
| 8 | **Deploy**, only after Migrate succeeded for this commit; first the box re-checks the record, the staged copy and the ledger, and refuses otherwise. With the runner's build (§2.5): download the pack through the link and check its sha256 and that it holds only `dist/`, all before anything changes; back up `frontend/dist`, `git merge --ff-only`, mark the deploy unfinished, put the pack's `dist/` in place of `frontend/dist`. No build on the box | box | §4, row "Deploy" |
| 8 | **Deploy**, only after Migrate succeeded for this commit, without the runner's build (as before): back up `frontend/dist` to `/home/ubuntu/dist-backup-<UTC>-<sha12>`, `git merge --ff-only`, mark the deploy unfinished (`/home/ubuntu/.episode-deploy-unfinished`), `vite build` with an explicit heap (about 60% of RAM, 1536–3072 MB; the log names it) for at most 1200 s, after printing the box's memory; it stops first, changing nothing, if another vite build is still running | box | §4, row "Deploy" |
| 9 | **Restart**, under the same re-checks as Deploy, before any `pm2` call: `pm2 restart episode-api-prod-hotfix`; `localhost:3000/health` healthy with the database connected; then, **only if `episode-worker` was online before the restart**, `pm2 restart episode-worker` (must be online). A stopped or missing worker is left exactly as it was (#2861). The isolated voice worker `episode-voice-worker` follows the same rule: restarted only if it was online, never started (Evoni, Issue #3650, 2026-10-30). The box reports the target SHA; a successful restart clears the migrate record, the unfinished mark and the staged copy, then removes all but the newest 3 frontend backups (§7) | box | §4, row "Restart" |
| 10 | **Public health**: `HEALTH_URL` healthy with the database connected | runner | §4, row "Public health" |
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
2. Start a run: Actions → **Deploy** → **Run workflow** on `main` (browser). Merging a PR does not start one.
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

Before approving, check the run's commit: it is the one you merged. A run left waiting expires after 30 days. A newer push replaces a waiting run.

---

## 4. When a run stops

Read the step's log: the on-box output says where it stopped and what had already changed. The summary names the snapshot.

| Stopped at | State | What to do |
|---|---|---|
| Configuration, OIDC, preflight, plan | Nothing changed | Fix the cause (variables, role, SSM, the plan's message), then re-run. A plan that stops on **package files** means: deploy that range by hand (`DEVELOPMENT_WORKFLOW.md` §7.1), then later runs resume normally |
| Snapshot or wait | Nothing on the box changed | Look at the snapshot in RDS; re-run. "RDS already holds its limit of manual snapshots" (`SnapshotQuotaExceeded`): remove old `deploy-*` snapshots in RDS → Snapshots → Manual, or add the delete permission (§2.1), then start a new run |
| Deploy | Tree may be fast-forwarded, `frontend/dist` rebuilt or partly rebuilt; **the API still runs the old code**; database untouched | Re-run (it resumes), approve the next run (it carries the stopped deploy's migrations, §1), or roll back the code (§6). "the vite build failed" with an out-of-memory abort in its last lines: the heap the log names was too small for the box. "the vite build ran past 1200 s" (or, before that limit existed, SSM status `TimedOut` right after the "vite build with a … MB heap" line, as in runs 80–81): the box was short of memory; the log prints `Memory:` and `Swap:` lines before and after. "a vite build is still running on the box": a build left by a timed-out deploy; nothing was changed. On the box, `pgrep -af 'vite(\.js)? build'` lists it and `sudo kill <pid>` stops it (it runs as `ubuntu`); then approve a new run. With the runner's build (§2.5): "could not be downloaded (the link may have expired)", "sha256 is …, not …", "is not a readable archive", "holds something other than dist/" or "has no dist/index.html" all stop before the backup, with nothing changed: start a new run |
| Build (step 0) | Nothing changed | Read the build log; it is the same `vite build` a contributor runs. Fix forward by PR |
| Migrate | **The database may be partly migrated**; the live tree, `frontend/dist` and the running API are **unchanged** (old code); no migrate record, so Deploy and Restart refuse. The staged copy is kept at `/home/ubuntu/.episode-stage/<sha>` | Nothing is undone or restored automatically. Read the migration error. Usually fix forward: a new PR, merged, then a new run. If the data is damaged, restore from the snapshot (§5). Messages that stop before any migration, with nothing changed: "package files change…" (deploy that range by hand), "not on origin/main", "not a fast-forward", "does not hold exactly … files", ".env or node_modules is not the live one", "would not load the staged config…". "an earlier staged release is still in use": on the box, `ps -o pid,args -p <pid>` names the process; if it is a `db:migrate` from a stopped run, let it finish or ask why it is still running before a new run. "a migration waited more than 30s for a lock" (`canceling statement due to lock timeout`): another connection held the table the migration alters. The waiting statement was cancelled, so nothing queues behind it. Find the holder in the database: `SELECT pid, usename, state, now() - xact_start AS open_for, left(query, 120) FROM pg_stat_activity WHERE pid IN (SELECT pid FROM pg_locks WHERE relation = '<table>'::regclass) OR state = 'idle in transaction' ORDER BY xact_start;`. End a stuck one with `SELECT pg_terminate_backend(<pid>);` (or restart the API, which drops its connections), then start a new run. Before this limit (run 176), the same wait ran to SSM status `TimedOut` after 1800 s, right after the "Running sequelize-cli db:migrate" line, holding every query on that table behind it; on the box, `pgrep -af 'db:migrate'` lists one still waiting |
| Deploy, after Migrate succeeded | Database migrated; the live tree is old or fast-forwarded and the API still runs the old code | See "Migrate succeeded, Deploy or Restart did not" below |
| Restart | New code, possibly unhealthy; a worker that was online may not be restarted (a stopped one is never started); the database is migrated | Look at `pm2 logs` by hand; roll back the code (§6) or fix forward. See "Migrate succeeded, Deploy or Restart did not" below. "the migrate phase has not succeeded for …", "the staged release of … is gone", "does not hold exactly … files" or "the ledger check for … exited …": Deploy or Restart refused before changing anything, or before any `pm2` call. Start a new run; its Migrate applies anything missing |
| Public health | On-box `/health` was fine; the public URL is not | Check the load balancer and target group; the box itself is up |

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

- **A code-only rollback keeps the schema.** Since Migrate runs first (§1, "Migrate before Deploy"), the old code has already been running against the new schema, so going back to it needs no schema change. Never run the migration's `down` as part of a rollback: for example, `20261026190000-add-script-line-keys` drops both `script_line_keys` columns, and every line identity in them once A1c writes them. A revert must also keep every migration file: a range that deletes or changes one stops in Plan. So revert the code, not the migration (a PR that removes the model or route changes and leaves `src/migrations/` as it is). Restore the snapshot (§5) only for damaged data, knowing it loses every write since the snapshot.

---

## 7. Housekeeping

- **Snapshots:** each run takes one manual snapshot, and those are billed until deleted. RDS allows 100 manual snapshots in all (the account quota; Evoni reads the used count and the maximum with the read-only `rds describe-account-attributes`, quota `ManualSnapshots`), and a run stops at its snapshot once the quota is reached (runs #145 and #146, 2026-10-22). With the delete permission (§2.1) and `DEPLOY_SNAPSHOTS_PRUNE_DRY_RUN=0`, each run first removes up to `DEPLOY_SNAPSHOTS_MAX_DELETE` of the older `deploy-*` snapshots and keeps the newest `DEPLOY_SNAPSHOTS_KEEP` (default 10), so they no longer pile up. Without it, Evoni removes old `deploy-*` snapshots in RDS → Snapshots → Manual and keeps at least the newest few. Manual snapshots with other names are never removed by a run.
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
