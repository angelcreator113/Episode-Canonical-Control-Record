# Dev environment: local Postgres with a copy of production data

The dev box (`episode-dev-backend`, `i-016395bb5f7a51a0b`) runs its own PostgreSQL holding a restored copy of production's `episode_metadata`. Production and RDS are only ever read. Set up under Task #3715 (2026-11-05).

Pointing the dev app at this database, and removing the production credentials from the box, is Task #3716. A one-tap refresh workflow is Task #3717. Until #3716 lands, the dev app (`episode-api`, `episode-worker`) stays **stopped**, and saved stopped in pm2, because its pm2 env still points at production RDS.

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
