# Runbook: the episode worker's database login

The production `episode-worker` (pm2; `src/workers/start.js`) runs scene generation (`generation_jobs`) and video export (Bull `video-export`). Issue #3714 moves it off `postgres`, the master login, onto its own least-privilege role, `episode_worker`, and makes it do nothing unless it is switched on.

**Who does what.** Every step that touches the production database, `.env`, pm2 or Secrets Manager is Evoni's, and each is a separate approval. Agent sessions prepare and review the code only. They never create the role, set or read the password, start the worker or run the preflight in production without Evoni's explicit yes in that session.

**Status.** Code only (this runbook's PR). The worker is **stopped and saved stopped** in production, as before. Nothing below has been done in production yet. The role, the credential file, the preflight and an enabled worker were proved on the dev box on 2026-11-10 (§10).

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

`GENERATION_WORKER_ENABLED` must be exactly `true` (case and surrounding spaces ignored) for the worker to do anything. Both pm2 configs pass `false` unless `.env` says `true`: the production config (`ecosystem.config.js`) and the dev box's (`ecosystem.dev.config.js`, `docs/runbooks/dev-environment.md`).

In production (`WORKER_DB_REQUIRED=true`, set by the production config, or `NODE_ENV=production`):

| State | What happens |
|---|---|
| A database password in its environment (`DB_PASSWORD`, `WORKER_DB_PASSWORD`, `DATABASE_URL` or `PGPASSWORD` non-empty), **enabled or not** | It refuses before loading anything and exits with code 78. This is what a stale pm2 saved env (§7) or a password line in `.env` produces. |
| Disabled (the default) | It prints one line and waits for a signal. It loads no model, no Bull consumer and no AI SDK, so it runs no boot recovery, polls nothing, opens no database session and makes no paid call. It does not read the credential file. pm2 shows it online. |
| Enabled, but the credential file is missing, unsafe (§5), incomplete or names `postgres` | It refuses before loading anything and exits with code 78. |
| Enabled, with a good credential file | It runs as before, connected as `episode_worker`. |

Exit 78 is listed in `stop_exit_codes` in both configs, so pm2 marks the worker stopped and does not restart it in a loop (checked with pm2 6.0.14, the version in production).

**Starting it is never a no-op once enabled.** On every start it first runs `recoverStuckJobs`, which re-queues or fails any job left `processing`. It then claims queued jobs, and each one makes paid image calls (capped daily by `AI_DAILY_IMAGE_BUDGET_USD`).

**Deploys keep it as it is.** The Deploy workflow restarts `episode-worker` only if it was online before the deploy; a stopped or missing one is left alone (`docs/runbooks/deploy-workflow.md` §1, row 9). A reboot restores pm2's saved list, where it is saved stopped.

**Manual commands that would start it:**
- `pm2 start ecosystem.config.js` without `--only`;
- `pm2 restart all`;
- `pm2 restart episode-worker`.

Even then, it stays disabled until `GENERATION_WORKER_ENABLED=true`. In production today, `pm2 restart episode-worker` without `--update-env` would start it with its stale saved env, which still holds the old `postgres` password. With this PR deployed, it then refuses with exit 78 and stays stopped (§7).

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

- **Settings:**
  - The login comes only from the credential file (`WORKER_DB_CREDENTIALS_FILE`, default `/home/ubuntu/.episode-worker-db.env`). It is read with the worker's own loader and checked the same way (§5).
  - `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_SSL` and `DB_SSL_REJECT_UNAUTHORIZED` come from the environment, else from the repo's `.env`. The `.env` is parsed, not loaded into the environment.
  - It never uses `DB_USER` / `DB_PASSWORD`.
  - A `WORKER_DB_PASSWORD` in the environment or `.env` is a stale copy and fails the settings.
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

## 5. Where the password lives (Option B, chosen 2026-11-07)

**The file.** The password is in `/home/ubuntu/.episode-worker-db.env` and nowhere else on the box. The file holds two lines:

```
WORKER_DB_USER=episode_worker
WORKER_DB_PASSWORD=<the password>
```

The production pm2 config gives the worker only the file's path (`WORKER_DB_CREDENTIALS_FILE`). It blanks `DB_USER` / `DB_PASSWORD`, so the API's login never reaches the worker, and it passes no `WORKER_DB_USER` / `WORKER_DB_PASSWORD`.

**How it is loaded.**
1. `src/workers/start.js` → `workerStartup.decideStartup` → `workerCredentials.readCredentialFile` reads the file at start, and only when the worker is enabled.
2. It holds the login in memory (`src/config/dbCredentials.js`).
3. `config/sequelize.js` reads it from there when the models connect.

The password is never written to `process.env`. FFmpeg, through `execFile` and fluent-ffmpeg's `spawn`, and any other child process therefore inherit none.

**What the loader requires** (checked on the opened file descriptor, so the path cannot be swapped between the check and the read):
- not a symlink (it uses `lstat`, then opens with `O_NOFOLLOW`);
- a regular file;
- the same device and inode as the path named;
- owned by the user the worker runs as (`ubuntu`);
- permission bits exactly `600`;
- no larger than 4 KiB;
- both keys present, and not `postgres` / `rdsadmin`.

Errors name the rule that failed, never the contents.

**Creating it (Evoni, gated; step 3 of §6).** Use an editor, so the password never appears in a command line or shell history:

```
sudo -u ubuntu -H bash -lc 'install -m 600 /dev/null ~/.episode-worker-db.env && ${EDITOR:-nano} ~/.episode-worker-db.env'
sudo -u ubuntu -H stat -c '%a %U %F' /home/ubuntu/.episode-worker-db.env   # expect: 600 ubuntu regular file
```

**The source of truth** is a Secrets Manager entry (for example `episode-metadata/prod/worker-db`), from which Evoni copies the value into the file. Do **not** put `WORKER_DB_PASSWORD` in `.env`. The worker and the preflight both refuse it there.

**Rotation:**
1. Set the new password with `\password episode_worker` (psql as the admin user).
2. Update Secrets Manager, then edit `/home/ubuntu/.episode-worker-db.env` in place with the editor. Check `stat` still shows `600 ubuntu`.
3. If the worker is online, `pm2 restart episode-worker`. No `--update-env` or `pm2 save` is needed: pm2 holds only the path.
4. Run the preflight (§4).

Polls fail for the few seconds between steps 1 and 3 and retry; no job is lost.

**Where the password still exists (remaining exposure paths):**
- **The file itself**, mode 600, owned by `ubuntu`. Anything running as `ubuntu` or root on the box can read it: the API, the voice worker, an SSH session. The same holds for `.env` and `~/.episode-migrate.env` today.
- **The worker's memory** while it runs: the held login and the `pg` connection settings. A root or same-user `ptrace` or core dump could read it.
- **Box-level backups:** EBS snapshots and AMIs of the instance's volume contain the file. The Deploy workflow's backups contain `frontend/dist` only, and its diagnostics print filtered `pm2 jlist` fields, not env values.
- **Secrets Manager**, as the source of truth.
- **Stale copies from before Option B:** the worker's pm2 saved entry still holds the old `postgres` password (§7). That predates this PR and is removed by the gated procedure in §7.

**Not in:**
- `.env`;
- the worker's pm2 env;
- `~/.pm2/dump.pm2` or `dump.pm2.bak`;
- `pm2 jlist` / `pm2 env`;
- `/proc/<pid>/environ`;
- any child process's environment;
- the worker's logs or pm2's own log.

All of these were verified on a local pm2 6.0.14 sandbox with a marker password, alongside an Option A control that the same check did detect. The integration test covers the same ground (§9).

The other options considered (A: `.env` → pm2 env; C: Secrets Manager read at start; D: RDS IAM authentication) were set aside. A kept the password in pm2's saved list, which caused the 2026-09-26 outage and #3714. C and D need IAM changes and can follow later.

## 6. Switching over (each step a separate approval)

1. Merge and deploy this PR. The worker stays stopped; the deploy leaves it so.
2. Run the role SQL as the admin user, then `\password`.
3. Store the password in Secrets Manager, then create the credential file (§5).
4. Run the preflight; expect `RESULT: PASS`.
5. Remove the stale pm2 saved entry (§7). This also leaves the worker saved stopped with the new config.
6. **Optional:** start the worker still disabled (`pm2 start ecosystem.config.js --only episode-worker --env production`, then `pm2 save`). It should print "Generation worker is disabled" and open no session.
7. **Later, and only after a read-only count of `generation_jobs` by status:**
   - **Mandatory precondition:** Do not enable episode-worker job processing until the §7 credential-cleanliness check reports CLEAN for both dump.pm2 and dump.pm2.bak. If either check fails, stop the rollout and complete the separately approved cleanup procedure before continuing.
   - set `GENERATION_WORKER_ENABLED=true` in `.env`;
   - `pm2 restart episode-worker --update-env`, then `pm2 save`;
   - watch `pm2 logs episode-worker` for 5 minutes.

   Expect "Database login: the worker's own (credential file)", no `password authentication failed` and no `permission denied`.

## 7. Stale worker credentials in pm2's saved state (gated; not done)

**Why.** pm2's saved entry for `episode-worker` (`~/.pm2/dump.pm2`, its `.bak`, and the env pm2 reloads it with) still holds the env from before #3714, including the old `postgres` password. `pm2 restart --update-env` does **not** clear it: pm2 merges the new env into the saved one, and keeps any key the new config no longer sets. That was checked on pm2 6.0.14. Only deleting the entry and starting it fresh from the new config does. Each step below is Evoni's, run as `ubuntu` on the box. **Nothing here has been done.**

**Detect: the credential-cleanliness check.** It prints exactly one line per file, `dump.pm2: CLEAN` or `dump.pm2: STALE`, then the same for `dump.pm2.bak`. It never prints a credential value, a key name or any other env content. STALE means the worker's saved entry has a non-empty `DB_PASSWORD`, `WORKER_DB_PASSWORD`, `DATABASE_URL` or `PGPASSWORD`, or that the file is missing or unreadable (it fails closed).

```
cd ~ && node -e 'const fs=require("fs");const bad=["DB_PASSWORD","WORKER_DB_PASSWORD","DATABASE_URL","PGPASSWORD"];for(const n of [process.argv[1],process.argv[1]+".bak"]){let ok=false;try{const d=JSON.parse(fs.readFileSync(n,"utf8"));ok=Array.isArray(d)&&d.filter(p=>p&&p.name==="episode-worker").every(p=>{const e=Object.assign({},p.env||{},p);return bad.every(k=>e[k]===undefined||e[k]===null||e[k]==="")})}catch(e){ok=false}console.log(require("path").basename(n)+": "+(ok?"CLEAN":"STALE"))}' ~/.pm2/dump.pm2
```

Expect `dump.pm2: STALE` today. Do not inspect the dump any other way (`cat`, `grep` for values, `pm2 env`): those print credentials.

**Remove (only with Evoni's yes, after §6 steps 1–4):**
1. `pm2 describe episode-worker | grep -E 'status|restarts'`. It must be `stopped`; if it is online, stop here and ask.
2. `pm2 delete episode-worker`. This removes the stale entry from the live list. It is undone by step 3.
3. `pm2 start ecosystem.config.js --only episode-worker --env production`. This starts it fresh from the new config: disabled, no password in its env, so it does nothing.
4. `pm2 stop episode-worker`.
5. `pm2 save`, then `pm2 save` again. The second save overwrites `dump.pm2.bak`, which otherwise keeps the stale copy.
6. Run the credential-cleanliness check again. It must report `dump.pm2: CLEAN` and `dump.pm2.bak: CLEAN`. If either is `STALE`, stop the rollout here (§6 step 7 must not proceed).

**If step 3 refuses** (exit 78, "a database password is in the worker's environment"), the password is coming from `.env` or the shell, not from pm2. Find the key named in the message, remove that line from `.env`, then repeat from step 3.

**Rollback:** the worker stays stopped either way. Before step 2, nothing has changed.

**Then rotate the old `postgres` password** (a separate, gated decision): it sat in plain text in pm2's saved list.

## 8. Rolling back

- **Any failure at steps 4–7:** `pm2 stop episode-worker && pm2 save`. That is the state production is in today. The API is not affected at any step: its login, pool and config are unchanged.
- **Do not** put the old `postgres` values back, and do not put a password in `.env`.
- **The role** can stay unused, or be removed with the undo in the SQL file (gated).
- **The credential file** can be removed (`shred -u`) once the role is removed.
- **Jobs the worker processed** keep their results. The pre-deploy RDS snapshot is the backstop.

## 9. Tests

- **`tests/integration/workerRestrictedRole.integration.test.js`:** on the migrated local test database only (it skips unless the URL names `episode_metadata_test` and is not RDS), as a role with exactly these grants:
  - boot recovery, the claim, job completion and failure, the cascade with its angle claims;
  - the service statements, and the image-cost budget read and usage row, with providers stubbed;
  - 15 prohibited operations refused (42501);
  - the preflight passing, and failing for an extra privilege or the admin login;
  - the pool under the limit;
  - a disabled process loading no model, pg, Bull, renderer or AI SDK and opening no session;
  - a refused process exiting 78: a password in the env (enabled or disabled), no file, mode 644, `postgres`;
  - **an enabled worker process** reading a mode-600 file. Every non-loopback connection is refused (`tests/helpers/workerEnvProbe.js`) and Redis points at `127.0.0.1:1`, so no image provider, AI SDK, S3 or queue is reachable. It checks that the worker connects as the role. It checks that `/proc/<pid>/environ`, `process.env`, every child process it starts, and the environment FFmpeg actually receives through `execFile` and fluent-ffmpeg carry no password; nor does its log. It asserts booleans only and deletes every file it made.

  Removing any one grant from the list fails the test that uses it. Writing the password into `process.env` fails the enabled-worker test.
- **`tests/unit/workers/workerCredentials.test.js`:** the file loader:
  - modes 644/640/660/400/700/604/601;
  - a symlink, a directory, another owner, a missing file;
  - a path swapped after `lstat` (inode check) and a symlink planted after `lstat` (`O_NOFOLLOW`);
  - over 4 KiB, missing keys, `postgres` / `rdsadmin`;
  - no contents in any error.
- **`tests/unit/workers/workerStartup.test.js`:**
  - the switch;
  - the env-password refusal, enabled or not;
  - the file refusals;
  - the in-memory login reaching no env key;
  - the `config/sequelize.js` fallback to `DB_USER` / `DB_PASSWORD` for the API and migrations.
- **`tests/unit/workers/workerDbGrants.test.js`:** the SQL file grants exactly the list, and nothing broader.
- **`tests/unit/workers/workerProcessConfig.test.js`:**
  - the production worker carries only the file path, with no password (not even from a `.env` `WORKER_DB_PASSWORD`);
  - the dev worker is off by default;
  - `stop_exit_codes: [78]` in both;
  - the API unchanged;
  - the deploy script still restarting only a worker that was online;
  - the pool size.
- **`tests/unit/workers/workerCheckDbAccess.test.js`:** the preflight's settings: the file loader, a stale `WORKER_DB_PASSWORD` refused, `.env` parsed without loading.

## 10. Proved on the dev box (2026-11-10)

Done on `episode-dev-backend` against its local PostgreSQL, a copy of production's `episode_metadata` (`docs/runbooks/dev-environment.md`), at commit `91fbf65`. Nothing was done in production.

**What was set up, and stays on the dev box:**
- the role, from `scripts/worker/sql/episode-worker-role.sql`, unchanged;
- a random password generated on the box and never printed, set on the role and written to `/home/ubuntu/.episode-worker-db.env` (`600 ubuntu regular file`).

**The preflight** (`node scripts/worker/check-db-access.js`): `RESULT: PASS (nothing was written)`. Every line was PASS except one WARN, "TEMP on the database: granted (normally through PUBLIC)".

**An enabled worker, run by hand as production runs it.** `NODE_ENV=production`, `WORKER_DB_REQUIRED=true`, `GENERATION_WORKER_ENABLED=true`, the credential file's path, `DB_POOL_MAX=4`; started from an empty folder with a clean environment, so no `.env` and no provider key reached it, and with Redis pointed at a closed port. The pm2 `episode-worker` on the dev box was left as it is (development mode, disabled).

One test job was queued first (`generate_base` for an existing scene set, `max_attempts` 1). The worker's log:

```
   Environment: production
   Database login: the worker's own (credential file)
 [GenWorker] Started  polling every 3000ms, concurrency 1
 [GenWorker] No stuck jobs found
 [GenWorker] Processing job 2433a277-...  generate_base
[SceneGen] Starting base still for: The honey Table (flux-dev, 1024x576)
 [GenWorker] Job 2433a277-... failed: FAL_KEY not configured
```

| Checked | Result |
|---|---|
| Sessions in `pg_stat_activity` while it ran | 2 as `episode_worker` from `127.0.0.1` |
| The job afterwards | `failed`, attempts 1, `started_at` and `completed_at` set, error `FAL_KEY not configured` |
| The scene set afterwards | `generation_status` `failed`, `base_runway_prompt` written |
| `ai_usage_logs` rows | 1072 before and after: no call was made, nothing was spent |
| `password authentication failed`, `permission denied`, `Poll error` in the log | 0, 0, 0 |
| Password-like keys in the worker's `/proc/<pid>/environ` | 0 |
| A second run, 75 seconds with nothing queued | polled with 0 errors and processed nothing |

**What that covers.** As `episode_worker` the worker ran boot recovery, claimed the job (`SELECT … FOR UPDATE SKIP LOCKED` and the update to `processing`), read the scene set and its brief, wrote the set's status and prompt, read today's image spend, and wrote the job's failure. **What it does not cover:** a job that completes. The dev box has no provider key, so the picture was never made; the completed path's writes (the result, the angle rows, the `ai_usage_logs` row) are covered by `tests/integration/workerRestrictedRole.integration.test.js` with the providers stubbed (§9).

**Dev's data was put back:** the test job was deleted and the scene set's three changed fields were restored from a copy taken before the run. `generation_jobs` is `completed` 94, `failed` 47, as before.

**After a dev data refresh the grants are gone.** `scripts/dev-db/refresh-dev-db.sh` drops and recreates the database and restores without ACLs, so `episode_worker` keeps its login but loses every table grant, and the preflight fails until the `GRANT` lines of the role file are run again on the dev box. The role file as a whole cannot be re-run: it fails on `CREATE ROLE` when the role exists.

