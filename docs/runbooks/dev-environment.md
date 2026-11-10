# Dev environment: local Postgres with a copy of production data

The dev box (`episode-dev-backend`, `i-016395bb5f7a51a0b`) runs its own PostgreSQL holding a restored copy of production's `episode_metadata`. Production and RDS are only ever read. Set up under Task #3715 (2026-11-05).

Task #3716 (2026-11-05) pointed the dev app at this database, removed every stored production credential from the box, and installed current `main`. A one-tap refresh workflow is Task #3717. Task #3781 (2026-11-10) reopened the app at `https://dev.primepisodes.com` behind nginx and TLS, signing in against production's Cognito pool: see *Dev app* and *The public dev site* below.

## What is on the box

| Thing | Where |
|---|---|
| PostgreSQL 17 (PGDG build, same major as RDS 17.x) | cluster `17/main`, port 5432, `listen_addresses = 'localhost'` (bound to `127.0.0.1` only) |
| Box-specific settings | `/etc/postgresql/17/main/conf.d/10-dev-box.conf` (written by `install-local-postgres.sh`) |
| Apt source | `/etc/apt/sources.list.d/pgdg.list`, key `/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc` (fingerprint `B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8`) |
| Local database | `episode_metadata`, owned by local role `episode_dev` |
| Local credentials | `/home/ubuntu/.config/episode-dev/local-db.env` (mode 600, owner `ubuntu`): `LOCAL_DB_HOST`, `LOCAL_DB_PORT`, `LOCAL_DB_NAME`, `LOCAL_DB_USER`, `LOCAL_DB_PASSWORD`. The password is random, generated on the box, and never printed. |
| Scripts | `/home/ubuntu/dev-db/bin/` (copies of `scripts/dev-db/*.sh`), plus `/home/ubuntu/dev-db/migrations/20261104170000-create-data-correction-log.js` |

Nothing listens on a public interface. `ss -ltnp` shows `127.0.0.1:5432` only, and `ufw` is inactive, so the bind address is the protection. The security group was not changed.

## Scripts

### `scripts/dev-db/install-local-postgres.sh` (root, idempotent)

Adds the PGDG apt source, installs `postgresql-17` and `postgresql-client-17`, writes the localhost-only config, and creates the `episode_dev` role and the credential file. The password reaches `psql` as a variable on stdin, never on a command line.

```bash
sudo bash /home/ubuntu/dev-db/bin/install-local-postgres.sh
```

### `scripts/dev-db/refresh-dev-db.sh` (root)

1. Refuses to run if `episode-api` or `episode-worker` is online in pm2.
2. Reads the RDS connection from Secrets Manager `episode-metadata/dev/refresh-readonly` (override with `DB_SECRET_ID`) through the app's own loader, `scripts/print-db-env.js`, into the process environment only. That secret holds the read-only role `dev_refresh_ro` (`scripts/dev-db/sql/dev-refresh-ro-role.sql`, Task #3716). It has SELECT on every table and sequence except `data_correction_log`, no write privilege, read-only sessions and a connection limit of 2. The dev box role reads it through the inline policy `dev-refresh-readonly-secret-read`. Until 2026-11-05 the refresh used the application's login (`episode-metadata/dev/database`, `episode_app_dev`).
3. Runs `pg_dump -Fc --no-owner --no-acl`, which reads in a read-only transaction, excluding `public.data_correction_log`. The application role has no SELECT on that table by design (#3709). It is recreated **empty** from its own migration, and its `SequelizeMeta` row comes across in the dump.
4. Restores into a fresh `episode_metadata_restore`, as `episode_dev`.
5. Clears the session/token tables in `CLEAR_TABLES`. That is `teleprompter_remote_sessions` today: it has `token_hash` and is cleared on every restore. Auth is Cognito, so the database has no user, session or refresh-token tables. The other name matches (`session_briefs`, `therapy_pending_sessions`, `character_secrets`, the `*secret_connections` columns, the `ai_usage_logs.*_tokens` counts) are story or app data and are kept (Evoni, 2026-11-05).
6. Compares exact per-table row counts against RDS, counted right after the dump, and exits non-zero on any difference.
7. Only then drops the old local `episode_metadata` and renames the restore into place. A failure at any earlier step leaves the existing local copy untouched.

The dump file lives in a `mktemp -d` directory (mode 750, group `postgres`) and is deleted right after the restore. The script prints step names, sizes, counts and table names only, never a credential, hostname or row of data.

```bash
sudo bash /home/ubuntu/dev-db/bin/refresh-dev-db.sh
```

Over SSM, run it with `bash -c '…'` if you add pipes, because `AWS-RunShellScript` runs `sh`.

## First run (2026-11-05)

| Step | Result |
|---|---|
| RDS | 17.9, `episode_metadata` 42 MB, 236 public tables |
| Dump | 3.6 MB, 1 s |
| Restore | 4 s |
| Row counts | 235 of 235 tables match (the 236th is `data_correction_log`, recreated empty); 5814 rows on both sides |
| Cleared | `teleprompter_remote_sessions`: 0 → 0 |
| Local database | `episode_metadata`, 37 MB, owner `episode_dev` |

## Dev app

| Thing | Where / value |
|---|---|
| App tree | `/home/ubuntu/episode-metadata`, a git checkout of the installed commit (`git -C … rev-parse HEAD`). The July tarball tree is kept as `/home/ubuntu/episode-metadata.prev` for rollback. |
| Settings | `/home/ubuntu/episode-metadata/.env` is a symlink to `/home/ubuntu/.config/episode-dev/dev.env` (mode 600), written by `install-dev-app.sh`: the preserved app settings (`app.env`), the local DB login, `DB_SSL=false`, `HOST=127.0.0.1` and `NODE_ENV=production`. `ecosystem.dev.config.js` also pins the API to `NODE_ENV=production` with `DB_POOL_MAX=10`, and the worker to `development`. |
| Processes | pm2 `episode-api` (port 3002, **bound to 127.0.0.1**) and `episode-worker`, from `ecosystem.dev.config.js`; saved with `pm2 save`. **The dev worker is off by default** (issue #3714): it prints "Generation worker is disabled" and does nothing unless the dev `.env` sets `GENERATION_WORKER_ENABLED=true` (exactly `true`) and it is restarted with `pm2 restart episode-worker --update-env`. Switched on, it uses the local `episode_dev` login; the production worker's credential file is not used on the dev box. |
| Database | local `episode_metadata` as `episode_dev` over `127.0.0.1` only. The box holds no production database credential. Its only production access is `episode-metadata/dev/refresh-readonly` (read-only `dev_refresh_ro`), used by the refresh. |
| nginx | **enabled.** Sites `dev-site-http.conf` (80: certificate challenge and redirect) and `dev-site-https.conf` (443: `frontend/dist`, and `/api/` and `/health` proxied to `127.0.0.1:3002`), installed from `scripts/dev-db/nginx/` by `scripts/dev-db/setup-dev-nginx.sh`. The July site file is kept, out of use, as `/etc/nginx/sites-available/episode.retired-20261110T204009Z`. |
| Memory | 1.9 GiB RAM + 1 GiB swap (`/swapfile`, in `/etc/fstab`). |
| Cognito | `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` and `COGNITO_REGION` in `app.env` are **production's** pool and app client (Evoni, 2026-11-10; no dev pool). The client has no secret, so the box holds none. Login is server-side `InitiateAuth` (`USER_PASSWORD_AUTH`): there are no callback URLs to register. |
| Not configured | Every AI/media API key, S3 bucket names, email. AI features return 503. `JWT_SECRET` is a dev-only value. |
| AWS access | The box role `episode-dev-backend-role` can read (`s3:GetObject`, `s3:ListBucket`) the five `-dev` buckets and cannot write or delete in them (Evoni, 2026-11-10). Production keeps its media in `episode-metadata-storage-dev` and `episode-metadata-thumbnails-dev`, so uploads, generated thumbnails and media deletes fail on dev with `AccessDenied`; reading existing media works. |

### Installing a commit

The frontend is **built off the box**. Building it on the box hung the 2 GB instance on 2026-11-05.

```bash
# off the box, at the commit to install
cd frontend && npm ci && npx vite build && tar -C dist -czf ../dist.tar.gz . && sha256sum ../dist.tar.gz
```

Copy the tarball to the box (e.g. `/home/ubuntu/dev-db/dist-<sha>.tar.gz`, owned by `ubuntu`), then:

```bash
sudo REF=<full sha> DIST_TARBALL=/home/ubuntu/dev-db/dist-<sha>.tar.gz DIST_SHA256=<sha256> \
  bash /home/ubuntu/dev-db/bin/install-dev-app.sh
```

The installer refuses while the app is online or with under 2.8 GiB RAM+swap. It applies pending migrations to the local database only, then swaps trees. Start afterwards:

```bash
sudo -u ubuntu -H bash -lc 'cd ~/episode-metadata && pm2 start ecosystem.dev.config.js --only episode-api,episode-worker && pm2 save'
ss -ltn | grep 3002   # expect 127.0.0.1:3002 only
```

Rollback: stop both, `mv episode-metadata episode-metadata.bad && mv episode-metadata.prev episode-metadata`, start.

## The public dev site (Task #3781, 2026-11-10)

`https://dev.primepisodes.com` is the dev box. nginx is the only public way in; the app keeps listening on `127.0.0.1:3002`.

| Thing | Value |
|---|---|
| DNS | Route 53 zone `primepisodes.com`: `dev.primepisodes.com` A record to the dev box's Elastic IP (TTL 300). Before 2026-11-10 it pointed at the prod box and returned 502. |
| Security group | `episode-dev-backend-sg`: inbound 80 and 443 from `0.0.0.0/0`, 22 from Evoni's IP. **Never 3002 or 5432.** |
| Certificate | Let's Encrypt, HTTP-01 through `/var/www/certbot`, account registered without an email address. `certbot.timer` renews it; `/etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh` reloads nginx afterwards. The self-signed certificate from July is kept at `/etc/letsencrypt/not-certbot-dev.primepisodes.com-20261110T205050Z`. |
| Reachable paths | `/` and `/assets/` from `frontend/dist`; `/api/` and `/health` from the app. Every other path gets `index.html`: the app's `/uploads`, `/ping`, `/_diag/health` and `/admin/queues` are not proxied. |
| Who can sign in | Every user of production's Cognito pool (self sign-up is off). |

### Why the API must run as production

With any other `NODE_ENV` the app returns stack traces in error responses to anyone, skips the login and refresh rate limits (`loginLimiter`, `refreshLimiter` in `src/routes/auth.js`), and sets cookies without `Secure`. Three things keep it at production:

1. `install-dev-app.sh` writes `NODE_ENV=production` into `dev.env`. The value in pm2's env is not enough by itself: the box has no `ANTHROPIC_API_KEY`, and `src/routes/memories/*.js` call dotenv with `override` when that key is unset, so `.env` replaces pm2's value during startup.
2. `ecosystem.dev.config.js` pins `NODE_ENV: 'production'` for `episode-api`.
3. `deploy-dev-box.sh` fails a deploy, and `setup-dev-nginx.sh` refuses to run, unless `/health` reports `"environment":"production"`.

The worker stays `development`: as production it refuses to start with a database password in its environment (`src/workers/workerStartup.js`).

As production the API uses the production database config. `DB_POOL_MAX=10` keeps its pool under the local PostgreSQL's 30 connections, `DB_SSL=false` keeps the main pool off TLS, and `scriptsService` connects with TLS to the same local server.

### Setting it up again

```bash
# on the box, as root, from a checkout or copy of scripts/dev-db/
bash setup-dev-nginx.sh                                    # port 80 only, or 80 + 443 when the certificate exists
ISSUE_CERT=1 CERTBOT_AGREE_TOS=yes bash setup-dev-nginx.sh # first certificate on a box with no Let's Encrypt account
```

The first certificate needs DNS pointing at the box and port 80 open. `CERTBOT_AGREE_TOS=yes` agrees to Let's Encrypt's Subscriber Agreement, which is Evoni's decision.

### Checks

```bash
# from another public address
curl -s https://dev.primepisodes.com/health                # 200, "environment":"production"
curl -s -o /dev/null -w '%{http_code}\n' https://dev.primepisodes.com/api/v1/shows   # 401 without a token
timeout 6 bash -c 'echo > /dev/tcp/<dev box address>/3002' # must fail; the same for 5432
# on the box
ss -ltn | grep -E ':(3002|5432) '                          # 127.0.0.1 only
certbot renew --dry-run --cert-name dev.primepisodes.com
```

### Closing it again

`systemctl disable --now nginx` on the box stops the public site and leaves the app running on loopback. Removing the 80 and 443 rules from the security group closes it at the network.

### The prod box's old dev site (retired 2026-11-10)

The prod box's nginx had a `dev.primepisodes.com` site in `/etc/nginx/sites-enabled/episode`. Evoni had it retired on 2026-11-10: the file was moved, whole, to `/etc/nginx/sites-available/episode.retired-dev-20261110T212130Z`, and nginx there no longer listens on 443.

That file also held the port 80 catch-all that answers 404 to any other host name. It is kept as `/etc/nginx/sites-enabled/default-404`. Keep it: without the catch-all, `episode-prod` would become the default site and answer every host name from `/var/www/html`, a frontend build from September 2026.

When the file was retired, the load balancer still had a `primepisodes-frontend` target group pointing at this port, unhealthy because of that 404. Evoni removed the group the same day and made the load balancer's port 80 listener redirect to HTTPS (`docs/reads/2026-11-10-load-balancer-targets.md`), so the load balancer no longer sends anything to the prod box's port 80. She also removed the prod box security group's inbound rules for 80 and 443 (22:02 UTC): the box accepts only 3000 from the load balancer's security group and 22 from her address, so its nginx is not reachable from outside at all.

## Refresh workflow (Task #3717)

`.github/workflows/refresh-dev-data.yml` (Actions → *Refresh dev data* → Run workflow) refreshes the local database from production in one tap. It runs the SSM document `EpisodeDevRefresh`, which takes no parameters and runs `scripts/dev-db/refresh-dev-box.sh` from the deployed tree:

1. Stop the dev app.
2. Run `refresh-dev-db.sh` (dump as `dev_refresh_ro`, restore, clear, compare, swap).
3. Start the app and verify loopback-only and healthy.
4. `pm2 save`.

**Public logs.** The repository is public. The runner never sees a credential (the box reads `episode-metadata/dev/refresh-readonly` itself), and no artifacts are uploaded. The workflow log shows only the on-box summary: step names, exit code, *tables match* / *rows match* yes/no, and how many session/token tables were cleared. The full refresh output stays on the box in `/var/log/dev-refresh/` (root, mode 600, last 10 kept).

The refresh script must be in the **deployed** tree. It ships once this lands on `main` and the dev box is redeployed.

### One-time AWS / GitHub setup (Evoni; gated)

1. **SSM document** (us-east-1), from this repository's file:

```bash
aws ssm create-document --name EpisodeDevRefresh --document-type Command --document-format JSON --content file://scripts/dev-db/ssm/EpisodeDevRefresh.json
```

   Later changes: `aws ssm update-document … --document-version '$LATEST'`, then `aws ssm update-document-default-version`.

2. **IAM role `episode-gha-refresh-dev`.** Trust: GitHub OIDC, this repository's `dev-refresh` environment only.

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::637423256673:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": { "StringEquals": {
      "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
      "token.actions.githubusercontent.com:sub": "repo:angelcreator113/Episode-Canonical-Control-Record:environment:dev-refresh"
    } }
  }]
}
```

   Inline permissions. It can run **only** `EpisodeDevRefresh`, **only** on the dev box. It has no S3, no secrets and no `AWS-RunShellScript`.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "RunOnlyTheRefreshDocumentOnTheDevBox",
      "Effect": "Allow",
      "Action": "ssm:SendCommand",
      "Resource": [
        "arn:aws:ec2:us-east-1:637423256673:instance/i-016395bb5f7a51a0b",
        "arn:aws:ssm:us-east-1:637423256673:document/EpisodeDevRefresh"
      ]
    },
    {
      "Sid": "ReadCommandResultsAndFindTheBox",
      "Effect": "Allow",
      "Action": ["ssm:GetCommandInvocation", "ssm:ListCommandInvocations", "ssm:DescribeInstanceInformation"],
      "Resource": "*"
    }
  ]
}
```

3. **GitHub environment `dev-refresh`** (Settings → Environments). Deployment branches: **`main` only**. **No required reviewers** (Evoni's choice, 2026-11-05): anyone who can dispatch workflows on `main` can start a refresh, and the refresh is read-only against production.

Undo: delete the role, the SSM document (`aws ssm delete-document --name EpisodeDevRefresh`) and the environment. Nothing else depends on them.

## Checks

```bash
ss -ltnp | grep 5432                       # expect 127.0.0.1:5432 only
sudo -u postgres psql -XAtc "show listen_addresses"
sudo -u ubuntu -H bash -lc 'pm2 jlist' | python3 -c 'import json,sys;[print(p["name"],p["pm2_env"]["status"]) for p in json.load(sys.stdin)]'
```

## Undo / removal

The local database holds production data, so removing it is a delete. Local-only, it does not touch RDS.

```bash
sudo -u postgres dropdb episode_metadata
```

To remove PostgreSQL entirely: `sudo apt-get purge postgresql-17 postgresql-client-17`, `sudo rm /etc/apt/sources.list.d/pgdg.list`, then delete `/home/ubuntu/.config/episode-dev/` and `/home/ubuntu/dev-db/`.
