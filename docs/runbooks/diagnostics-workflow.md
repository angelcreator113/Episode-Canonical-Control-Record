# Runbook: the Diagnostics workflow (read-only production checks)

`.github/workflows/diagnostics.yml` lets a Claude session check production on request, from a message on Evoni's phone. It reads and reports; it changes nothing. It is Level 1 of the three access levels in `docs/audit/F-Tools-2_ReadOnlyProdVisibility_Ruling_2026-10-29.md`: standing read-only, with no approval per run, in effect only after the self-test in §5 has passed.

## 1. How it works

```
Evoni (phone): "is production OK?"
  │
  ▼
Claude session ── starts Diagnostics (GitHub tool, check = overview) ──► GitHub Actions, this repo (public)
                                                                         │ environment prod-readonly (main only)
                                                                         │ OIDC → PrimeStudios-ReadOnly-GHA (15 min)
                                                                         │
                       ┌─────────────────────────────────────────────────┤
                       │ AWS reads from the runner                       │ server reads through SSM
                       │ EC2/RDS/SSM/SQS status, S3 settings,            │ PrimeStudios-Diagnostics document
                       │ Cognito settings                                │ → on-box.sh <check>, as ubuntu
                       │                                                 │   pm2/nginx/logs/disk (no API needed)
                       │                                                 │   db-check.js as prime_readonly
                       └───────────────────────┬─────────────────────────┘
                                               ▼
                         everything → a file → redact.js → publish.sh
                                               │  (refuses unless the output repo answers 404 to a signed-out visitor)
                                               ▼
                       PRIVATE repo prime-diagnostics: runs/<date>/<run>-<check>.md, latest-<check>.md
                                               │
Claude session ◄── reads the report (add_repo, read access) ──┘
  │
  ▼
Evoni (phone): what's happening / what was verified / cause or uncertainty / recommendation / approval needed?
```

The public run log shows only step names, "Collected N bytes; checks exit X", and "Published to the private repository: <path> (N bytes, sha256 <16 hex>…)". The checksum lets Claude confirm that the private file it reads is the one this run wrote.

### The checks (fixed list)

| Check | Where | What it reads |
|---|---|---|
| `overview` | both | public `/health`, EC2/RDS/SSM/SQS/alarms, box health, deployed commit, database connectivity |
| `health` | both | public `/health`; box load, memory, disk, pm2 processes (name, status, restarts, uptime, memory only), nginx and SSM agent state, `/health` on the box |
| `deploy-state` | box | deployed commit against `origin/main`, modified tracked files, the unfinished-deploy marker, frontend build time |
| `app-logs`, `worker-logs` | box | last 120/60 (API) and 100/40 (worker) lines of the PM2 log files, masked |
| `nginx-logs` | box | nginx error-log tail; status-code counts and top 5xx paths from the last 5,000 requests (no IPs, no query strings) |
| `db` | box | connected, round trip, user, read-only, size, connections, migrations applied/pending |
| `db-schema` | box | table names and column counts |
| `db-counts` | box | exact counts for a fixed table list, estimated rows for the 25 largest |
| `aws-infra` | runner | instance state and status checks, database status, free storage, events, snapshots, SSM agent, queue depths, alarms |
| `s3-config` | runner | per bucket: block-public-access, policy and policy status, ownership, versioning, encryption, CORS/lifecycle counts, object counts and sizes per top folder (no key names, no contents) |
| `cognito-config` | runner | pool settings, app client names, groups (no users, no client secret) |
| `self-test` | both | §5 |
| `db-snapshot` | box | **schedule only, never dispatched.** The daily database snapshot: full schema, exact counts for every table, allowlisted content samples. See `docs/runbooks/prod-db-snapshot.md` (F-Tools-2 Amendment 1). |

Adding or changing a check is a reviewed PR: the workflow's `options`, `runner.sh`, `on-box.sh`, and (for a box check) the SSM document's `allowedValues` must agree, which `tests/unit/scripts/diagnostics.test.js` enforces. A new box check also needs Evoni to update the SSM document (§3 step 7).

## 2. Permission boundaries

| Layer | Allows | Refuses |
|---|---|---|
| **GitHub** | `workflow_dispatch` on `main`, and one daily `schedule` (always `db-snapshot`), in environment `prod-readonly` (deployment branches: `main` only) | push/PR triggers; other branches; forks (no environment secrets); `db-snapshot` from any event but the schedule |
| **AWS role** `PrimeStudios-ReadOnly-GHA` (`scripts/diagnostics/iam/`) | assumed only by `repo:…:environment:prod-readonly`; Describe/List/Get on EC2, RDS, SSM, SQS, CloudWatch, S3 bucket settings and listings, Cognito pool/clients/groups; `ssm:SendCommand` for **one document on one instance** | an explicit **Deny** (wins over any later Allow): object reads (`s3:GetObject*`, which also covers `HeadObject`), every S3/EC2/RDS/SQS write family, SSM parameters and shell sessions, Secrets Manager, KMS decrypt, IAM, `sts:AssumeRole`, Lambda (its config carries environment variables), the instance's start-up script, Cognito users and app-client details (which carry the client secret) |
| **SSM document** `PrimeStudios-Diagnostics` | one `check` from `allowedValues`, one 40-hex `sha` that is on `origin/main`, and (for `db-snapshot` only) a `page` and `run` number; runs `on-box.sh` from that commit, as `ubuntu`, 120 s | anything else; root; `AWS-RunShellScript` is not in the role |
| **Box script** `on-box.sh` | reads files, `pm2 jlist` filtered to five fields, `systemctl is-active`, `curl localhost` | refuses root, `CLAUDECODE`, unknown checks; never `pm2 restart`, `git checkout`, `.env` printing, `pm2 env`/`describe` |
| **Database role** `prime_readonly` (`sql/readonly-role.sql`) | `SELECT` on `public` tables; read-only session by default; 30 s statement timeout; 2 connections | `INSERT`/`UPDATE`/`DELETE` refused by **grants** (42501) even with read-only switched off; server file reads (42501); not a superuser |
| **SQL** `db-check.js` | fixed statements in the file | any SQL from input: there is no input path |
| **Output** `publish.sh` | write to the private repo with a deploy key for that repo only; pinned GitHub host key | publishing when the repo is not confirmed private (a signed-out request must get 404); publishing to this repo |
| **Sessions** | start Diagnostics through the GitHub tool; read the private report | the guard and deny list are unchanged for `aws`, `ssh`, `pm2`, `psql` to RDS, `gh workflow run`; the guard now also blocks running `runner.sh`/`publish.sh` from a session |

**Residual, stated plainly.** PostgreSQL lets any role create temporary tables and large objects; with the read-only default switched off, `prime_readonly` could create those (they are not production tables). `db-check.js` never does, and its statements are fixed, so this would need a reviewed code change. SSM returns at most 24,000 characters per command: `on-box.sh` caps its output at 22,000 bytes, so very long logs are cut, not lost silently. The snapshot is the exception: it is returned in checksummed pages (`docs/runbooks/prod-db-snapshot.md` §2).

## 3. One-time setup (Evoni)

Do these in order. Nothing runs until step 9. Each is browser-only (phone or desktop) except step 8, which is on the box through Session Manager like the migration credential.

1. **Private output repository.** github.com → New repository → name `prime-diagnostics`, **Private**, no template. It can stay empty.
2. **Give Claude read access to it.** github.com → Settings → Applications → Installed GitHub Apps → **Claude** → Configure → Repository access → add `prime-diagnostics` → Save. Then tell the session; it verifies access (§5, V1) before anything else.
3. **Deploy key (write, that repository only).** Generate a key pair where you can copy text: AWS CloudShell (console, top bar) works from a phone browser:
   ```
   ssh-keygen -t ed25519 -N '' -C prime-diagnostics -f dk && cat dk.pub
   ```
   - `prime-diagnostics` → Settings → Deploy keys → Add → title `diagnostics-writer`, paste `dk.pub`, tick **Allow write access**.
   - `cat dk`, copy the whole private key for step 4, then `shred -u dk dk.pub`.
4. **Environment.** This repository → Settings → Environments → New environment `prod-readonly`:
   - Deployment branches and tags → **Selected branches** → add `main`. No required reviewers (Level 1 is standing).
   - Environment secret `DIAG_OUTPUT_DEPLOY_KEY` = the private key from step 3.
   - Environment secret `AWS_READONLY_ROLE_ARN` = the role ARN from step 6 (come back to it).
5. **Variables.** Settings → Secrets and variables → Actions → Variables (repository): `DIAG_OUTPUT_REPO` = `angelcreator113/prime-diagnostics`; `DIAG_S3_BUCKETS` = the studio bucket name(s), space-separated; `DIAG_COGNITO_POOL_ID` = the user pool id. `AWS_REGION`, `EC2_INSTANCE_ID`, `RDS_INSTANCE_ID`, `HEALTH_URL` already exist for Deploy. Leave `DIAG_ENABLED` unset for now.
6. **AWS role.** IAM → Roles → Create role → **Web identity** → provider `token.actions.githubusercontent.com` (already there for Deploy), audience `sts.amazonaws.com` → skip permissions → name `PrimeStudios-ReadOnly-GHA` → create. Then:
   - Trust relationships → Edit → paste `scripts/diagnostics/iam/readonly-trust-policy.json`.
   - Permissions → Add permissions → Create inline policy → JSON → paste `scripts/diagnostics/iam/readonly-permissions-policy.json`, with `<EC2_INSTANCE_ID>` replaced by the production instance id → name `diagnostics-read-only`.
   - Maximum session duration: 1 hour. Copy the role ARN into step 4's `AWS_READONLY_ROLE_ARN`.
7. **SSM document.** Systems Manager → Documents → Create document → **Command or Session** → name `PrimeStudios-Diagnostics`, type Command, JSON → paste `scripts/diagnostics/ssm-document.json`. If the document already exists, create a new version from the file instead and set it as the default (Actions → Create new version, then Set default version): `docs/runbooks/prod-db-snapshot.md` §3.
8. **Read-only database role** (once, on the box, through Session Manager, as you set up the migration credential):
   ```
   sudo -iu ubuntu
   cd /home/ubuntu/episode-metadata && git fetch -q origin main
   git show origin/main:scripts/diagnostics/sql/readonly-role.sql > /tmp/ro.sql
   psql "host=<RDS endpoint> dbname=<database> user=<admin user> sslmode=require" \
        -v dbname=<database> -v migrate_user=<migration user> -f /tmp/ro.sql
   psql "host=<RDS endpoint> dbname=<database> user=<admin user> sslmode=require" -c '\password prime_readonly'
   rm /tmp/ro.sql
   umask 077
   read -r -s -p 'prime_readonly password: ' P; echo
   printf 'DB_USER=prime_readonly\nDB_PASSWORD=%s\n' "$P" > /home/ubuntu/.episode-readonly.env; unset P
   chmod 600 /home/ubuntu/.episode-readonly.env; stat -c '%a %U' /home/ubuntu/.episode-readonly.env   # 600 ubuntu
   ```
   - If `psql` is missing: `sudo apt-get install -y postgresql-client`.
   - If the `migrate_user` line errors with "must be member of role", run it as that user or skip it; then, after migrations that add tables, re-run `GRANT SELECT ON ALL TABLES IN SCHEMA public TO prime_readonly;`.
9. **Merge the Diagnostics PR, then turn it on:** variable `DIAG_ENABLED` = `true`. Tell the session; it runs the §5 verification.

## 4. Using it from the phone

Ask in words ("is production up?", "why did uploads fail?", "is the database reachable?", "what's deployed?"). The session:

1. reads GitHub first (recent Deploy runs, what is on `main`);
2. starts the fitting check(s) through the GitHub tool, without asking (Level 1);
3. reads the private report and checks its sha256 against the public log line;
4. replies in five parts: **what is happening**; **what was verified**; **cause, or what is uncertain**; **recommendation**; **whether a production change needs approval** (Level 3: the one action, its risk, its rollback).

It never asks Evoni to run a read-only command a check can run.

### When the app is down

The checks do not go through the app. The runner reads AWS directly, and the server checks go through the SSM agent, a separate service on the box. With the API crashed, stopped or hung, `health` still reports pm2's view of it, `/health` on the box, memory and disk; `app-logs` still reads the PM2 log files. If the box itself is unreachable, `aws-infra` (or `overview`) still reports the instance's state and EC2 status checks, the database status, and the SSM agent's last ping, which tells "the app is down" apart from "the box is down" or "the agent is down".

### How this differs from Deploy

| | Deploy | Diagnostics |
|---|---|---|
| Purpose | change production (snapshot, migrate, deploy, restart) | read production |
| Started by | Evoni | a session (or Evoni) |
| Approval | every run, in `production` | none per run (standing Level 1), in `prod-readonly` |
| AWS role | the deploy role (`secrets.AWS_ROLE_ARN`): snapshot, deploy document | `PrimeStudios-ReadOnly-GHA`: reads, diagnostics document only |
| SSM document | `PrimeStudios-Deploy` (phases) | `PrimeStudios-Diagnostics` (checks) |
| Database user | the migration user | `prime_readonly` |
| Needs a healthy app | restart step checks `/health` | no |
| Output | public run log and summary | private repository only |

## 5. Verification (after setup; before Level 1 is in effect)

| # | What it proves | How | Pass |
|---|---|---|---|
| V1 | Claude can reach the private repo | the session attaches `prime-diagnostics` (`add_repo`, read) and lists it | listed as private; readable |
| V2 | the privacy gate works | `self-test` run: step "Confirm the output repository is private" | "is private (… 404)" |
| V3 | short-lived, right role | report: `PASS short-lived session of PrimeStudios-ReadOnly-GHA` | PASS |
| V4 | approved reads work | report: the "reads that must work" section | all PASS |
| V5 | writes, secrets, object reads, shell commands refused | report: the "must be refused" section (put/get/head/delete object, SSM parameter, secret, `AWS-RunShellScript`, stop instance (dry run), start-up script, snapshot, modify DB, IAM, Lambda, Cognito users and client) | all PASS |
| V6 | database writes refused | report: box self-test (`prime_readonly`, read-only default, not superuser, update/insert/delete refused with read-only off, server file read refused) | all PASS |
| V7 | nothing leaked publicly | the public run log: only the fixed lines; no artifacts | Claude reads the log and confirms; so can you |
| V8 | Claude retrieved the right file | the sha256 in the public log matches the private file Claude read | match |

Any FAIL: Level 1 stays off; the session reports which line failed and the fix. Re-run `self-test` after any change to the role, the document or the workflow.

The S3 object-read refusal probes in `runner.sh` select one existing key with
`--max-keys 1 --no-paginate`. CLI `--max-items` with a text query can produce
multiple lines, which must not be passed as one object key. Failed listings,
empty buckets and multiline selections fail the self-test explicitly rather
than silently skipping these probes. `NoSuchKey` is not evidence of IAM denial.

## 6. Costs

- **GitHub:** Actions minutes are free and unlimited for public repositories on standard runners; a run takes about a minute. Environments, environment secrets and branch rules are free on public repositories. The private repository runs no Actions and holds small text files (about 5–20 KB per run).
- **AWS:** STS, SSM Run Command (standard) and the describe/list APIs cost nothing. S3 listings are $0.005 per 1,000 requests (an `s3-config` run makes a few dozen). CloudWatch metric reads are about $0.01 per 1,000 requests after the free tier. Expected total: under $0.10 a month.

## 7. Limits to know

- **If this repository is made private later**, GitHub's Free plan does not provide environments for private repositories, so both `production` (Deploy's approval gate) and `prod-readonly` would stop working. That needs a paid plan first (check GitHub's current plan page).
- **Starting the workflow from a session** uses the GitHub tool's workflow-dispatch, which needs the Claude GitHub App to have Actions write access on this repository. Unverified until the first run after merge (V2). If it is refused, the fix is the App's permissions, and meanwhile Evoni can start it from the phone's browser (GitHub Mobile cannot start a manual workflow).
- **Each new session** attaches `prime-diagnostics` itself (`add_repo`) before reading a report; the App installation in step 2 is what makes that possible.
- **History:** reports stay in the private repository's history. To purge, delete and recreate the repository (and its deploy key).
- **Logs:** application logs are files on the box (PM2, nginx), not CloudWatch, so log checks need the box and its SSM agent.

## 8. Rollback and revoking access

Each is independent and immediate; none affects the app or Deploy.

| To stop | Do |
|---|---|
| all runs | set `DIAG_ENABLED` to anything but `true` (phone browser) |
| AWS access | IAM → `PrimeStudios-ReadOnly-GHA` → delete the inline policy, or delete the role |
| server checks | Systems Manager → Documents → `PrimeStudios-Diagnostics` → delete |
| database access | `DROP OWNED BY prime_readonly; DROP ROLE prime_readonly;` and `rm /home/ubuntu/.episode-readonly.env` |
| output writes | `prime-diagnostics` → Settings → Deploy keys → delete; delete the environment secret |
| Claude's reads of reports | remove `prime-diagnostics` from the Claude App's repository access |
| the code | revert the PR |
