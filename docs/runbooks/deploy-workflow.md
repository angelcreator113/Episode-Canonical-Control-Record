# Runbook: the Deploy workflow

`.github/workflows/deploy.yml` (Task #2837) deploys `main` to production and runs its migrations, after Evoni approves each run. It is built on the plan in `docs/reads/2026-10-10-deploy-path-read.md` §6–§9, under Evoni's Rule 7 decision (`docs/audit/F-Deploy-1_Rule7_DeployWorkflow_Ruling_2026-10-10.md`).

**Who does what.** Every step in this runbook that touches AWS, GitHub settings or the box is Evoni's. Agent sessions may change the workflow and its scripts through reviewed PRs, but never dispatch, approve, re-run or enable it. They never touch AWS or the box.

**Status until set up.** The workflow is off. Its job runs only when the repository variable `DEPLOY_ENABLED` is `true`, and Evoni sets that last (§2.4). Until her first approved run, the earlier rule applies in full: deploys stay her manual action (`DEVELOPMENT_WORKFLOW.md` §7.1, `scripts/deploy-prod.sh`).

---

## 1. What a run does

It is triggered by a push to `main` (each merged PR) that changes something other than docs, or by **Run workflow** on the Actions tab (browser). The job waits in the `production` environment until Evoni approves it. A running deploy is never cancelled.

**Which merges queue a run (#2862).** A merge whose changed files are *all* docs (`docs/**`, or any `.md` file anywhere) queues no run, so it needs no approval. A merge that touches anything else queues one: code, a migration, a package file, a script, or the workflow itself, even alongside docs. Docs-only changes reach the box with the next code deploy, because each deploy fast-forwards to its commit. **Queue:**
- At most one run waits for approval.
- At most one, the newest, is pending behind it. A newer push cancels the older pending run.
- The waiting run is not replaced. Approving it deploys its own, older commit, and the pending run then deploys the newest.
- To skip straight to the newest, reject the waiting run on its page; the pending one then waits for approval.

On 2026-10-10, run #22 was waiting, and #23 was cancelled the moment #24 was queued.

| # | Step | Where | If it fails |
|---|---|---|---|
| 1 | Check configuration (the five variables are set) | runner | Nothing changed |
| 2 | OIDC: assume the deploy role (no stored keys) | runner | Nothing changed |
| 3 | Preflight: the instance is `Online` in SSM | runner | Nothing changed |
| 4 | **Plan**, read-only: clean tree; the target is on `origin/main` and a fast-forward; **no package or lock file changes** (else stop: deploy that range by hand); no existing migration file modified; the ledger has nothing pending for the current code | box | Nothing changed |
| 5 | **Snapshot**: `deploy-<sha12>-<run id>-<attempt>` of the RDS instance | runner | Nothing on the box changed |
| 6 | **Wait** until the snapshot is `available` (up to 60 min) | runner | Nothing on the box changed |
| 7 | **Deploy**: back up `frontend/dist` to `~/dist-backup-<UTC>-<sha12>`, `git merge --ff-only`, `vite build` | box | §4, row "Deploy" |
| 8 | **Migrate**, only if files are pending: `NODE_ENV=production npx sequelize-cli db:migrate` as the migration user from `~/.episode-migrate.env`, then re-check (must be 0 pending) | box | §4, row "Migrate" |
| 9 | **Restart**: `pm2 restart episode-api-prod-hotfix`; `localhost:3000/health` healthy with the database connected; then, **only if `episode-worker` was online before the restart**, `pm2 restart episode-worker` (must be online). A stopped or missing worker is left exactly as it was (#2861). The box reports the target SHA | box | §4, row "Restart" |
| 10 | **Public health**: `HEALTH_URL` healthy with the database connected | runner | §4, row "Public health" |
| 11 | **Summary** on the run page: commit, box before, snapshot, migrations run, the worker's state before → after (restarted, or left stopped), results. On failure, the snapshot name and a pointer here | runner | — |

It never rolls back by itself, and it never runs `npm ci`. It never reads or prints `.env`, a password, `pm2 describe`/`pm2 env`, or `/_diag/health`, and it never calls Cognito. Box steps run as `ubuntu` through the `PrimeStudios-Deploy` SSM document, which runs only `scripts/deploy/workflow-deploy.sh` taken from the commit being deployed.

**The worker follows Evoni's choice.** A deploy never starts a worker she has stopped, and keeps restarting one that is running. To turn it on, she starts it herself on the box with `pm2 restart episode-worker` (this also starts a stopped process), and later deploys keep it running. To turn it off, she runs `pm2 stop episode-worker`, and later deploys leave it off. Either way, before a `pm2 save`, follow `DEVELOPMENT_WORKFLOW.md` §7.2. Deploy #21 started a worker that had been stopped since late September (`docs/reads/2026-10-10-deploy-21-verification.md` §3 U2), which is why this rule exists.

**Re-running a stopped run** (Evoni: **Re-run jobs** on the run page) is safe. If the box is already at the commit, the plan says "resuming". The run takes a fresh snapshot, rebuilds, migrates anything still pending, and restarts.

---

## 2. One-time setup (Evoni)

Do these in order. Placeholders: `<ACCOUNT_ID>`, `<REGION>`, `<RDS_INSTANCE_ID>` (the canon instance), `<EC2_INSTANCE_ID>` (the production box).

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
        "rds-db:connect", "rds:Delete*", "rds:Modify*", "rds:Restore*",
        "rds:RebootDBInstance", "rds:StopDBInstance", "iam:*", "ec2:*"
      ],
      "Resource": "*"
    }
  ]
}
```

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

   The two parameters are fixed by `allowedValues` and `allowedPattern`, so nothing else can be passed in. The script always comes from a commit already on `origin/main`, which means a reviewed and merged PR.

2. **Make the box SSM-managed.** Today the production box has **no IAM instance profile**, so SSM cannot reach it. `PROJECT_CONTEXT.md` §7, prod-box row, records "no IAM instance profile (so no SSM)", and F-Deploy-1 finding AD ("no instance profile on prod") is still owed after the keystone's close. Give it one:
   1. **IAM → Roles → Create role**, trusted entity **AWS service → EC2**. Name it, for example, `episode-prod-ssm`. Attach **only** the AWS-managed policy `AmazonSSMManagedInstanceCore`.
   2. **EC2 → the production instance (`<EC2_INSTANCE_ID>`) → Actions → Security → Modify IAM role**, choose that role, and save. No reboot is needed.
   3. On the box, check the SSM agent is running: `sudo snap services amazon-ssm-agent` (Ubuntu images ship it as a snap; INFERRED, so check). If it is missing or stopped, install or start it from the AWS documentation for Ubuntu.
   4. **Systems Manager → Fleet Manager:** the instance shows **Online**. It can take a few minutes after the role is attached.
3. **Keep that role to SSM only.** The deploy runs as `ubuntu` on the box, and anything running there as root can use the instance role. The role holds `AmazonSSMManagedInstanceCore` and nothing else: no Secrets Manager, no Cognito, no S3 or RDS permissions. The app's only Cognito call (`InitiateAuthCommand`) needs no IAM permission.

   *INFERRED: how the app's own AWS access is affected.* The AWS SDK's default credential chain uses environment variables and `~/.aws/credentials` before the instance profile. `ecosystem.config.js` notes that the app's "credentials come from ~/.aws/credentials or env vars". If the app gets its AWS credentials either way today, attaching the role does not change what the app can do. Check which source the app uses without printing any value, for example whether `~/.aws/credentials` exists and whether `.env` has an `AWS_ACCESS_KEY_ID=` line (count it, as `scripts/deploy-prod.sh` counts `ANTHROPIC_API_KEY`). If it has neither, the app would start using the instance role for S3 and similar calls. Then it would get only SSM permissions, and those calls would fail, so decide with that in mind.
4. **The migration credential** (Evoni's ruling for #2837: a `600` file on the box). On the box, as `ubuntu`:

```bash
umask 077
read -r -p 'Migration DB user: ' U
read -r -s -p 'Migration DB password: ' P; echo
printf 'DB_USER=%s\nDB_PASSWORD=%s\n' "$U" "$P" > ~/.episode-migrate.env
unset U P
chmod 600 ~/.episode-migrate.env
stat -c '%a %U' ~/.episode-migrate.env    # must print: 600 ubuntu
```

   Use exactly two lines, `DB_USER=` and `DB_PASSWORD=`, with no quotes and no spaces around `=`. This is the privileged user the deploy records describe ("a separate database user", `F-Deploy-1_Deploy_2026-09-30_CT.md` §0). The app's own credentials stay in `.env` as today. When that password changes, rewrite this file the same way.

### 2.3 GitHub: environment and variables

1. **Settings → Environments → `production`** (create it if it is missing):
   - **Required reviewers:** Evoni.
   - **Prevent self-review:** off. She is the only reviewer, and pushes to `main` come from her merges.
   - **Deployment branches and tags:** selected branches, `main` only.
2. **Settings → Secrets and variables → Actions → Variables** (repository variables; they are not secret):

| Variable | Value |
|---|---|
| `AWS_ROLE_ARN` | the role from §2.1 |
| `AWS_REGION` | the region of the instance and the database |
| `RDS_INSTANCE_ID` | the canon instance's identifier |
| `EC2_INSTANCE_ID` | the production box's instance id |
| `HEALTH_URL` | the public `/health` URL of the site |

### 2.4 Turn it on and approve the first run

1. Add the variable `DEPLOY_ENABLED` = `true`.
2. Start a run: merge a PR, or use Actions → **Deploy** → **Run workflow** on `main` (browser).
3. Approve it (§3) and watch the steps. **Evoni's approval of this first run is when the Rule 7 decision takes effect** (decision item 7).

To turn the workflow off at any time, set `DEPLOY_ENABLED` to anything but `true`, or delete it.

### 2.5 Afterwards: retire the old path

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
| Snapshot or wait | Nothing on the box changed | Look at the snapshot in RDS; re-run |
| Deploy | Tree may be fast-forwarded, `frontend/dist` rebuilt or partly rebuilt; **the API still runs the old code**; database untouched | Re-run (it resumes), or roll back the code (§6) |
| Migrate | **The database may be partly migrated**; the API still runs the old code | Read the migration error. Usually fix forward: a new PR, merged, then a new run. If the data is damaged, restore from the snapshot (§5) |
| Restart | New code, possibly unhealthy; a worker that was online may not be restarted (a stopped one is never started) | Look at `pm2 logs` by hand; roll back the code (§6) or fix forward |
| Public health | On-box `/health` was fine; the public URL is not | Check the load balancer and target group; the box itself is up |

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
- **By hand, on the box** (Evoni), when the site must come back before a revert can be merged:
  1. `git reset --hard <Box before SHA from the run summary>`.
  2. `rm -rf frontend/dist && cp -a ~/dist-backup-<…>-<sha12> frontend/dist` (the `DEPLOY_BACKUP` path in the deploy step's log).
  3. `pm2 restart episode-api-prod-hotfix` (and `episode-worker` only if it is meant to be running, §1), then check `/health`.

  The database stays migrated; down-migrations are never run automatically. `main` still has the bad commit, so the next run will deploy it again until it is reverted. The next run's plan also requires the box to be a fast-forward of the target, which it will be after a revert.

---

## 7. Housekeeping

- **Snapshots:** each run keeps one manual snapshot, and those are billed until deleted. The role cannot delete them. Evoni removes old `deploy-*` snapshots in RDS → Snapshots → Manual. Keep at least the newest few.
- **Frontend backups:** `~/dist-backup-*` and `~/vite-build-*.log` accumulate in the box's home directory. Remove old ones by hand.
- **Changing the workflow:** by PR only. The scripts the box runs come from the commit being deployed. A change to `scripts/deploy/workflow-deploy.sh` therefore takes effect on the first run that deploys it.
