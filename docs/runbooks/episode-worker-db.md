# Runbook: the episode worker's database login

The production `episode-worker` (pm2; `src/workers/start.js`) runs scene generation (`generation_jobs`) and video export (Bull `video-export`). Issue #3714 moves it off `postgres`, the master login, onto its own least-privilege role, `episode_worker`, and makes it do nothing unless it is switched on.

**Who does what.** Every step that touches the production database, `.env`, pm2 or Secrets Manager is Evoni's, and each is a separate approval. Agent sessions prepare and review the code only. They never create the role, set or read the password, start the worker or run the preflight in production without Evoni's explicit yes in that session.

**Status.** Code only (this runbook's PR). The worker is **stopped and saved stopped** in production, as before. Nothing below has been done in production yet.

The voice worker (`episode-voice-worker`, `docs/runbooks/voice-footage-worker.md`) is a separate process and is not affected.

---

## 1. What the worker needs, and nothing more

Traced from `src/workers/start.js` through every processor and helper it can reach. The same list is `src/workers/workerDbGrants.js`; the SQL file and the tests are checked against it.

| Table | Privileges | Used for |
|---|---|---|
| `generation_jobs` | SELECT, UPDATE | boot recovery (`recoverStuckJobs`), the claim (`SELECT … FOR UPDATE SKIP LOCKED`), job results |
| `scene_sets` | SELECT, UPDATE | job reads and updates, cost, visual language, the spec; boot recovery of a cascade |
| `scene_angles` | SELECT, UPDATE | job reads and updates, the angle claim (`generationClaimService.claimRow`) |
| `world_locations` | SELECT | the scene brief, the approved-base check |
| `world_events` | SELECT | the scene brief |
| `ai_usage_logs` | SELECT, INSERT | today's spend (`aiCostTracker` when it loads; `imageCostService` before each image call) and one row per call |
| `ai_usage_logs_id_seq` | USAGE | the usage row's serial id |

- **Never used:** DELETE, TRUNCATE, DDL, other tables, temp tables, advisory locks, LISTEN/NOTIFY, other schemas.
- **The video renderer makes no database call.** It needs Redis only.
- **No default privileges:** a table added later is not reachable until it is granted on purpose. The restricted-role integration test fails in the PR that makes the worker touch a new table.

## 2. Switching it on, and why it stays off

`GENERATION_WORKER_ENABLED` must be exactly `true` (case and surrounding spaces ignored) for the worker to do anything. The production config passes `false` unless `.env` says `true`.

| State | What happens |
|---|---|
| Disabled (the default) | It prints one line and waits for a signal. It loads no model, no Bull consumer and no AI SDK, so it runs no boot recovery, polls nothing, opens no database session and makes no paid call. pm2 shows it online. |
| Enabled, but no worker login (`WORKER_DB_USER` / `WORKER_DB_PASSWORD` missing, or `postgres`) | It refuses before loading anything and exits with code 78. The production config lists 78 in `stop_exit_codes`, so pm2 does not restart it in a loop. |
| Enabled, with the worker login | It runs as before, connected as `episode_worker`. |

**Starting it is never a no-op once enabled.** On every start it first runs `recoverStuckJobs`, which re-queues or fails any job left `processing`. It then claims queued jobs, and each one makes paid image calls (capped daily by `AI_DAILY_IMAGE_BUDGET_USD`).

**Deploys keep it as it is.** The Deploy workflow restarts `episode-worker` only if it was online before the deploy; a stopped or missing one is left alone (`docs/runbooks/deploy-workflow.md` §1, row 9). A reboot restores pm2's saved list, where it is saved stopped.

**Manual commands that would start it:**
- `pm2 start ecosystem.config.js` without `--only`;
- `pm2 restart all`;
- `pm2 restart episode-worker`.

Even then, it stays disabled until `GENERATION_WORKER_ENABLED=true`.

## 3. The role (Evoni, gated)

`scripts/worker/sql/episode-worker-role.sql` creates `episode_worker` with those grants:
- `NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`;
- `CONNECTION LIMIT 5`;
- `idle_in_transaction_session_timeout = 60s`.

Run it once, as the admin database user:

```
psql "<admin connection>" -v dbname=episode_metadata -f scripts/worker/sql/episode-worker-role.sql
then, in psql:  \password episode_worker
```

`\password` asks for the password without echoing it and sends only its hash, so it never appears in a statement, the database log or shell history. The file's comment block has the undo.

**The pool.** The production database config keeps 30 / 10 connections for the API. The worker's config sets `DB_POOL_MAX=4`, so its pool stays under the role's limit of 5, leaving room for one preflight or admin session. The integration test runs 16 concurrent queries through a pool of 4 under the limit, and shows a sixth session is refused (`53300`).

## 4. The preflight (read-only, no worker start)

```
node scripts/worker/check-db-access.js
```

- **Settings:** it reads `WORKER_DB_USER`, `WORKER_DB_PASSWORD`, `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SSL` and `DB_SSL_REJECT_UNAUTHORIZED`, from the environment or the repo's `.env`. It never uses `DB_USER` / `DB_PASSWORD`.
- **The session:** it connects once in a read-only session (`default_transaction_read_only`, inside a `READ ONLY` transaction that it rolls back).
- **What it checks:**
  - who it is;
  - that the role has no superuser, CREATEROLE, CREATEDB, REPLICATION or BYPASSRLS;
  - the connection limit;
  - no role memberships;
  - no CREATE on the schema or database;
  - every required privilege present, and every other privilege on those tables absent;
  - no other table, view or sequence reachable;
  - a `SELECT … LIMIT 0` on each readable table.
- **Output:** PASS / FAIL / WARN lines, never the password or the host. Exit 0 means all passed; 1 means a check failed; 2 means the settings or the connection failed.
- **In production it is still a production query** (catalog reads only), so it runs with Evoni's approval.

## 5. Where the password lives, and how it is loaded

**Today's shape (this PR):**
- `WORKER_DB_USER` / `WORKER_DB_PASSWORD` live in the box's `.env`.
- `ecosystem.config.js` passes them into the worker's pm2 environment. It blanks `DB_USER` / `DB_PASSWORD` for the worker, so the API's login never reaches it.
- `src/workers/start.js` maps them to the database settings before anything loads.

**The source of truth** should be a Secrets Manager entry (for example `episode-metadata/prod/worker-db`), from which Evoni copies the value into `.env` (mode 600).

**Open decision: how the worker gets the password at run time.** Not selected in this PR.

| Option | Password at rest | Rotation | Changes needed | Risks |
|---|---|---|---|---|
| A. `.env` → pm2 env (as built) | `.env` (600) **and** pm2's saved list `~/.pm2/dump.pm2` (plain text; keep it 600) and the live process env (`pm2 env`) | change `.env` → `pm2 restart episode-worker --update-env` → `pm2 save` → §7.2 SAME/DIFFERENT check | none | a stale saved password after a reboot (the 2026-09-26 outage; the worker's current stale `postgres` password is the same failure) |
| B. A separate file the worker reads at start (like `~/.episode-migrate.env`, mode 600), pm2 holding only its path | that one file only; not in pm2's saved list | edit the file → restart (no `--update-env` or save needed) | a few lines in `start.js` and the preflight to read the file | the file's permissions and backup; a restart is still needed |
| C. Secrets Manager read at start (instance role) | Secrets Manager only; in memory while running | rotate in Secrets Manager → restart | the SDK call at start, plus an IAM grant `secretsmanager:GetSecretValue` on that one secret to the box's role (an IAM change) | the start depends on AWS; any process on the box with the instance role can read it |
| D. RDS IAM authentication (15-minute tokens) | no password | none | the role `rds_iam`, `rds-db:connect` IAM, a token-refreshing pool | the biggest change; the pool must refresh tokens |

**Recommendation for the next step:** B. It takes the password out of pm2's saved list (the failure behind the 2026-09-26 outage and #3714 itself) with no AWS or IAM change. C or D can follow later.

**Rotation under any option:**
1. Set the new password with `\password episode_worker`.
2. Update the store (Secrets Manager, then `.env` or the file).
3. Restart the worker (with `--update-env` and `pm2 save` under option A).
4. Run the preflight.

Polls fail for the few seconds between steps 1 and 3 and retry; no job is lost.

## 6. Switching over (each step a separate approval)

1. Merge and deploy this PR. The worker stays stopped; the deploy leaves it so.
2. Run the role SQL as the admin user, then `\password`.
3. Store the password, then write `WORKER_DB_USER=episode_worker` and `WORKER_DB_PASSWORD` (or the chosen option in §5).
4. Run the preflight; expect `RESULT: PASS`.
5. **Optional:** start the worker still disabled (`pm2 restart episode-worker --update-env`, `pm2 save`). It should print "Generation worker is disabled" and open no session.
6. **Later, and only after a read-only count of `generation_jobs` by status:** set `GENERATION_WORKER_ENABLED=true`, restart with `--update-env`, `pm2 save`, and watch `pm2 logs episode-worker` for 5 minutes. Expect no `password authentication failed` and no `permission denied`.

## 7. Rolling back

- **Any failure at steps 4–6:** `pm2 stop episode-worker && pm2 save`. That is the state production is in today. The API is not affected at any step: its login, pool and config are unchanged.
- **Do not** put the old `postgres` values back.
- **The role** can stay unused, or be removed with the undo in the SQL file (gated).
- **Jobs the worker processed** keep their results. The pre-deploy RDS snapshot is the backstop.

## 8. Tests

- **`tests/integration/workerRestrictedRole.integration.test.js`:** on the migrated test database, as a role with exactly these grants:
  - boot recovery, the claim, job completion and failure, the cascade with its angle claims;
  - the service statements, and the image-cost budget read and usage row, with providers stubbed;
  - 15 prohibited operations refused (42501);
  - the preflight passing, and failing for an extra privilege or the admin login;
  - the pool under the limit;
  - a disabled process loading no model, pg, Bull, renderer or AI SDK and opening no session;
  - a refused process exiting 78.

  Removing any one grant from the list fails the test that uses it.
- **`tests/unit/workers/workerStartup.test.js`:** the switch and the fail-closed login rule.
- **`tests/unit/workers/workerDbGrants.test.js`:** the SQL file grants exactly the list, and nothing broader.
- **`tests/unit/workers/workerProcessConfig.test.js`:**
  - both pm2 configs;
  - the API unchanged;
  - the deploy script still restarting only a worker that was online;
  - the pool size.
- **`tests/unit/workers/workerCheckDbAccess.test.js`:** the preflight's settings.
