# Dev environment: local Postgres with a copy of production data

The dev box (`episode-dev-backend`, `i-016395bb5f7a51a0b`) runs its own PostgreSQL holding a restored copy of production's `episode_metadata`. Production and RDS are only ever read. Set up under Task #3715 (2026-11-05).

Task #3716 (2026-11-05) pointed the dev app at this database, removed every stored production credential from the box, and installed current `main`. A one-tap refresh workflow is Task #3717. The dev app runs **local-only** until dev auth is set up: see *Dev app* and *Reopening the dev app* below.

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
| Settings | `/home/ubuntu/episode-metadata/.env` is a symlink to `/home/ubuntu/.config/episode-dev/dev.env` (mode 600), written by `install-dev-app.sh`: the preserved app settings (`app.env`), the local DB login, `DB_SSL=false`, `HOST=127.0.0.1`. |
| Processes | pm2 `episode-api` (port 3002, **bound to 127.0.0.1**) and `episode-worker`, from `ecosystem.dev.config.js`; saved with `pm2 save`. |
| Database | local `episode_metadata` as `episode_dev` over `127.0.0.1` only. The box holds no production database credential. Its only production access is `episode-metadata/dev/refresh-readonly` (read-only `dev_refresh_ro`), used by the refresh. |
| nginx | **stopped and disabled.** The site file `/etc/nginx/sites-enabled/episode` (server `dev.primepisodes.com`, proxy to `localhost:3002`) is unchanged. |
| Memory | 1.9 GiB RAM + 1 GiB swap (`/swapfile`, in `/etc/fstab`). |
| Not configured | Cognito (`COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` empty), `JWT_SECRET`, every AI/media API key, S3 buckets, Redis. Logins fail; `requireAuth` routes refuse; AI features return 503. |

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

## Reopening the dev app (once dev auth works)

Today nothing on the box listens publicly except sshd (22). The security group `episode-dev-backend-sg` also refuses 22/80/443/3002/5432 from outside, as probed from another public IP on 2026-11-05. In order:

1. **Auth first.** Give dev its own Cognito user pool and app client (recommended), or at least its own app client. Set `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID` (and `COGNITO_CLIENT_SECRET` if the client has one) in `~/.config/episode-dev/app.env`, reinstall or restart with `--update-env`, and prove a login and a `requireAuth` call locally (`curl 127.0.0.1:3002/...`). Leave `JWT_SECRET` empty unless dev needs HS256 tokens; if set, use a dev-only value of 32+ characters.
2. **DNS.** `dev.primepisodes.com` currently resolves to the **prod** box (54.163.229.144), where it returns 502. Point it at the dev box's EIP `54.87.253.45`.
3. **nginx.** Change `proxy_pass http://localhost:3002` to `http://127.0.0.1:3002` in `/etc/nginx/sites-enabled/episode` (the app listens on IPv4 loopback only). Then `nginx -t && systemctl enable --now nginx`. Renew the certificate if it has lapsed: `certbot --nginx -d dev.primepisodes.com`.
4. **Security group.** Open 443 (and 80 for the redirect and ACME), first **to your own IP only**, not `0.0.0.0/0`. Never 3002 or 5432.
5. **Check from outside**: `https://dev.primepisodes.com/health` 200 from your IP, a login works, and 3002/5432 still time out.

The app keeps listening on `127.0.0.1` throughout. nginx is the only public entry point.

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

3. **GitHub environment `dev-refresh`** (Settings → Environments). Add yourself as a required reviewer, so every run waits for your approval, and restrict deployment branches to `main`.

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
