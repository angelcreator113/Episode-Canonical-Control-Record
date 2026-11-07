# Episode worker: activation safeguards (design proposal, #3714 Phase 1)

**Status:** proposal for Evoni's review, 2026-11-07. Nothing here is implemented. Each item needs approval before code is written; each production step stays separately gated (`docs/runbooks/episode-worker-db.md` §6).

**Context:** the read-only audit of 2026-11-07 found the following in `src/workers/sceneGenerationWorker.js` (`claimNextJob`, `processJob`, `recoverStuckJobs`), `src/workers/start.js` and `src/services/sceneGenerationService.js`:
- Switching the worker on runs every queued job of any age.
- Recovery re-queues paid jobs left `processing`.
- Runway and Flux submissions are retried after an unknown outcome.
- Shutdown kills a job in progress.
- A queued cascade does not re-claim its set.
- The spend gate fails open, and Runway adds $0 to it.

The read-only inventory (`scripts/worker/backlog-inventory.js`, Phase 1) shows what any given state of the queue would do.

**Which items are required before activation:**

| # | Safeguard | Before production activation? |
|---|---|---|
| S1 | Explicit per-job approval | **Required:** the allowlist form (S1a). The database form (S1b) can wait until routine use. |
| S2 | Recovery preserves uncertain paid jobs | **Required** |
| S3 | Runway (and Flux) submit once; unknown outcome → reconciliation | **Required** |
| S4 | Separate switches for scene jobs and video exports | **Required** |
| S5 | Graceful shutdown; no duplicate processing | **Required:** shutdown and `kill_timeout`. The heartbeat lease can wait (one instance). |
| S6 | Cascade claim ownership and stale payloads | **Required:** the set re-claim and the age limit. The payload basis check can wait. |
| S7 | Fail-closed spending in the worker | **Required:** fail-closed read, unpriced refusal and run budget. A cross-process reservation can wait. |
| S8 | Bounded activation | **Required** |

**Proposed order:**
- **Phase 2a**, the required items, as one PR. Its only migration is S2's enum value.
- **Phase 2b**, the deferred items.

---

## S1. Explicit per-job approval

**S1a: an allowlist in the worker's configuration (required).**
- **Data model:** none. `GEN_WORKER_JOB_IDS` is a comma-separated list of `generation_jobs.id` values, set in `.env` and passed by `ecosystem.config.js`. Job ids are not secrets.
- **Behaviour:**
  - `claimNextJob` adds `id = ANY(:ids)` to its filter.
  - An empty or missing list claims nothing; the worker logs that it is enabled with nothing approved and waits.
  - An id that is not `queued`, or not a valid UUID, is ignored with a warning naming it.
  - Recovery never claims anything (S2).
- **Migration:** none.
- **Backward compatibility:**
  - The API and its producers are unchanged.
  - The dev box needs the list too. Its worker is off by default anyway; a dev operator sets the ids or `GEN_WORKER_JOB_IDS=*`, which is accepted **only** when `WORKER_DB_REQUIRED` is not true (never in production).
- **Tests:**
  - unit: the filter is built, and empty means no claim;
  - integration: with three queued jobs and one approved, only that one is claimed, and the others stay `queued` untouched;
  - production config: the default list is empty.
- **Operational consequence:** approving a job means editing `.env` and restarting with `--update-env` (the runbook gets a step for it). It is deliberately clumsy: it is meant for the recovery period, not routine work.

**S1b: approval columns (can wait until routine use).**
- **Data model:**
  - `generation_jobs.approved_at TIMESTAMPTZ NULL` and `approved_by TEXT NULL`;
  - the routes set both when a signed-in user creates the job (the click is the approval);
  - existing rows stay NULL, so the backlog is never approved by the migration.
- **Behaviour:** the claim requires `approved_at IS NOT NULL AND approved_at > NOW() - GEN_WORKER_APPROVAL_TTL` (default 24 h), so a forgotten approval does not run weeks later.
- **Hardening:** the worker role's table-wide UPDATE becomes column-level UPDATE on `status, started_at, attempts, result, error, completed_at, updated_at`, so the worker cannot approve its own jobs. That change is to `scripts/worker/sql/episode-worker-role.sql` and `src/workers/workerDbGrants.js`, applied in production as a gated grant change.
- **Migration:** add the two nullable columns, with no backfill. The down migration drops them; it is gated like any down migration.
- **Tests:**
  - unapproved and expired rows are not claimed;
  - the routes set the approval;
  - the restricted role is refused with 42501 when it updates `approved_at`.

## S2. Recovery that preserves uncertain paid jobs (required)

- **Data model:**
  - A new status value: `ALTER TYPE enum_generation_jobs_status ADD VALUE 'needs_reconciliation'`.
  - The reason goes in `error`, with a code prefix such as `UNCERTAIN: worker restarted mid-job` or `UNCERTAIN: Runway submit outcome unknown`.
  - Provider facts go in `result` (JSONB): `{ provider, phase: 'submitting' | 'submitted' | 'polling', provider_task_id, submitted_at }`. So no new columns are needed.
- **Behaviour:**
  - `recoverStuckJobs` moves every `processing` row to `needs_reconciliation`. It never re-queues and never marks one failed, whatever its attempts. This applies only to rows whose `started_at` is older than the shutdown grace (S5), so a job in the middle of finishing is not caught.
  - It leaves the scene set and angle states alone.
  - `needs_reconciliation` is never claimed.
  - The API's existing guards (`refuseWhileVideoRuns`, the job lookups in `sceneSetRoutes.js`) count `needs_reconciliation` as active. So a new paid run for the same angle or set is refused (409 `NEEDS_RECONCILIATION`) until Evoni resolves the job.
- **Reconciliation (operational):**
  - The inventory lists these rows with their provider phase and task id.
  - A separately approved script, Phase 2b, resolves one row at a time. It can attach the result if the provider shows success, which is a provider status read (unbilled, to be confirmed against Runway's documentation before relying on it). Otherwise it marks the row `failed` or re-queues it **only with a new approval**.
  - Until that script exists, resolution is a gated, row-scoped SQL update.
- **Migration:**
  - One enum value. Adding it is safe online on PostgreSQL 15. The new value cannot be used in the same transaction, so the migration does nothing else.
  - The down migration is not practical: removing an enum value means recreating the type. It is documented as forward-only and gated.
- **Backward compatibility:**
  - The frontend treats only `completed` and `failed` as finished (`useGenerationJob.js`; `SceneSetsTab.jsx`, the scene-set job poller). So `GET /scene-sets/jobs/:jobId` reports `needs_reconciliation` to the old UI as `status: 'failed'` with `code: 'NEEDS_RECONCILIATION'` and a plain message. The UI stops polling and shows the error, with no frontend change needed.
  - Old worker code (before 2b) never sees the new value, because only the new recovery writes it.
- **Tests:**
  - recovery moves `processing` rows to `needs_reconciliation`, re-queues none and marks none failed;
  - the claim skips them;
  - the API guard returns 409;
  - the job endpoint maps the status for the old UI;
  - the restricted-role test covers the new transition.

## S3. Runway (and Flux) submission idempotency (required)

- **Facts today:**
  - `startImageToVideo` (`sceneGenerationService.js`) re-submits up to 3 times on a timeout, a connection error, a 429 or a 5xx, all inside one `imageCost.runImageCall`, so there is one usage row however many tasks Runway accepted.
  - `pollTask` waits up to 180 s, then throws.
  - The Flux still path has the same retry-on-no-status loop.
- **Rule: submit once when the outcome is unknown.**
  - Retry only when the provider demonstrably did not accept the request:
    - the connection failed before the request was sent (`ECONNREFUSED`, `ENOTFOUND`, `EAI_AGAIN`);
    - a 4xx validation response;
    - a 429 that says the request was rejected.
  - On a timeout or reset after the request was sent, or a 5xx after it was sent, do not retry.
- **Persist before and after the call.**
  - Before submitting, the job's `result.phase` becomes `submitting`, with a fresh `request_key` (a UUID).
  - On success, `provider_task_id` is written **immediately**, before polling.
  - If Runway's API accepts an idempotency header, `request_key` is sent with it. Whether it does must be confirmed from Runway's documentation before implementation; until then, no idempotency is assumed.
- **On an unknown outcome:**
  - **Submit with no task id:** the job goes to `needs_reconciliation`, `UNCERTAIN: submit outcome unknown`. Evoni checks the Runway dashboard; nothing is resubmitted automatically.
  - **Poll timeout with a task id:** the job goes to `needs_reconciliation`, `UNCERTAIN: still running at Runway`. The reconcile script polls that task id later and attaches the clip if it succeeded. That is a status read, not a new paid task.
- **Spend:**
  - Each submit is logged as its own usage row (S7).
  - An unknown outcome is logged at the estimate, not $0: assume it was billed.
- **Migration:** none (JSONB `result`).
- **Backward compatibility:** API-side callers of the same helpers get the same single-submit behaviour. That is safer, and a user can retry by hand.
- **Tests:**
  - with HTTP stubs (nock or an axios adapter): a timeout after the request is sent submits once and ends in `needs_reconciliation` with the phase recorded;
  - a refused connection retries;
  - the task id is persisted before polling;
  - a poll timeout keeps the task id;
  - one usage row per submit.
- **Operational consequence:** some jobs end needing a manual look instead of silently paying twice. That trade-off is intended.

## S4. Separate switches for scene jobs and video exports (required)

- **Data model:** none.
  - `GENERATION_WORKER_ENABLED` stays the master switch.
  - Two new flags: `SCENE_JOBS_ENABLED` and `VIDEO_EXPORTS_ENABLED`. Each must be exactly `true`, and each defaults to `false` in both ecosystems.
- **Behaviour:**
  - `start.js` loads `videoRenderer` (and so Bull, Redis and FFmpeg) only when the video flag is on.
  - It loads `sceneGenerationWorker` (models, recovery, polling, paid calls) only when the scene flag is on.
  - Master on with both flags off logs "enabled, no subsystem selected" and waits, as when disabled.
  - Video exports queued in Redis wait untouched while the flag is off; the inventory counts them.
- **Migration:** none.
- **Backward compatibility:**
  - Production keeps everything off.
  - The dev box keeps everything off by default. A dev operator now sets two flags instead of one.
  - The disabled-path tests stay as they are.
- **Tests:**
  - the traced module list in a child process shows that each flag loads only its subsystem: no Bull without the video flag, no models without the scene flag;
  - both pm2 configs default both flags to off.
- **Operational consequence:** the video-export backlog (local FFmpeg and S3, no paid AI) can be drained or inspected independently of paid generation.

## S5. Graceful shutdown and duplicate prevention

**Required: graceful shutdown.**
- **Behaviour:**
  - On SIGINT or SIGTERM, `stop()` stops claiming and waits for the job in progress, up to `GEN_WORKER_SHUTDOWN_GRACE_MS` (default 120 s).
  - The renderer calls `videoQueue.close()`, which lets Bull finish its active job.
  - Then the process exits.
  - A job still running at the deadline is left `processing`, and the next start's recovery moves it to `needs_reconciliation` (S2).
  - The misleading comment in `start.js` ("Bull will finish the current job") is replaced by code that does it.
- **pm2:**
  - pm2's default `kill_timeout` is 1.6 s: it sends SIGKILL after that. The worker's `kill_timeout` is set above the grace, for example 150000 ms, in both ecosystems.
  - Deploy and `pm2 stop` then take up to that long for the worker.
- **Migration:** none.
- **Tests:**
  - a child-process test: SIGTERM during a stubbed long job lets it complete before exit;
  - past the grace, the job is left for reconciliation;
  - the ecosystem test checks `kill_timeout`.

**Can wait: a heartbeat lease.**
- **Data model:** `generation_jobs.claimed_by TEXT` (host:pid:boot id) and `heartbeat_at TIMESTAMPTZ`, refreshed every 30 s by the worker running the job.
- **Behaviour:** recovery treats a `processing` row as abandoned only when its heartbeat is older than 5 minutes. So a second worker starting by mistake cannot take over a live job.
- **Why it can wait:**
  - pm2 runs one instance.
  - Only the production box will hold the credential file.
  - `FOR UPDATE SKIP LOCKED` already prevents double claims.
- **Migration:** two nullable columns.

## S6. Cascade claim ownership and stale payloads

**Required: the set re-claim and an age limit.**
- **Data model:** none in 2a. `generation_jobs.result.claim` records whether the claim was taken or inherited.
- **Behaviour:**
  - At the start of a `cascade_regenerate`, the worker claims the set with `generationClaimService.claimRow(sequelize, 'set', id)`.
  - Two cases continue:
    - the set is still `generating` from **this job's own** route claim, and within the 15-minute window (`set.updated_at` within 15 minutes of the job's `created_at`, an approximation without S6b);
    - the claim succeeds afresh.
  - Otherwise, for example the API is regenerating the set now, the job fails **before any paid call** with `SET_BUSY`.
- **Age limit:** `GEN_WORKER_MAX_JOB_AGE_HOURS` (default 24). Older queued jobs are never claimed; the inventory shows them as stale, and they are cleared or re-approved by hand.
- **Tests:**
  - a cascade whose set is under a live API claim fails without calling the image stub;
  - an old job is not claimed;
  - a fresh one runs.

**Can wait: claim tokens and a payload basis check.**
- **Data model:**
  - `scene_sets.generation_claim_job_id UUID NULL`, set by the cascade route together with the claim, so the worker can prove the claim is its own.
  - The payload also stores the `basis` it was created against: the set's `updated_at`, and a hash of `canonical_description` and the base brief.
- **Behaviour:** if the set changed since (edited, approved, its event removed), the job fails with `STALE_PAYLOAD` before any paid call, and must be recreated.
- **Migration:** one nullable column. The basis lives in the existing JSONB.
- **Why it can wait:** with S1a, Evoni approves each job after reading it in the inventory, which lists `force`, overrides and age. `assertBaseReplaceable` already protects approved bases.

## S7. Fail-closed spending in the worker

**Required:**
- **Fail closed in the worker.** `imageCostService.assertImageBudget` and `aiCostTracker` get a fail-closed mode, `AI_BUDGET_FAIL_CLOSED=true`, set only in the worker's pm2 env:
  - spend cannot be read: refuse with 429 `AI_BUDGET_EXCEEDED` / `BUDGET_UNREADABLE`;
  - the API keeps today's fail-open behaviour (its env does not set the flag).
- **No unpriced calls in the worker.** With the same flag, a model with no rate is refused, so Runway is refused until Evoni supplies its price. Once she does, Runway gets a rate in the table (per second of `gen3a_turbo`, from Runway's credit price) and is counted in dollars.
- **A run budget.** `GEN_WORKER_RUN_BUDGET_USD` is required whenever scene jobs are enabled.
  - The worker sums the logged cost of its own calls since start, plus the estimate of the next call, and refuses past the budget.
  - The job then fails before any paid call, with code `RUN_BUDGET_REACHED`, and the worker stops claiming.
  - The budget resets on restart, which is acceptable because it pairs with S1a's explicit list and S8's maximum.
- **Logging:**
  - one usage row per submit attempt (S3);
  - an unknown outcome is logged at the estimate;
  - a budget refusal in the worker does not consume an attempt or re-queue (the job ends `failed` with the code).
- **Migration:** none (the rate table is code).
- **Backward compatibility:** API behaviour is unchanged unless its env sets the flag.
- **Tests:**
  - an unreadable spend means no call (the stub records zero calls);
  - an unpriced model is refused;
  - the run budget stops after the Nth call;
  - API mode stays fail-open.

**Can wait: a cross-process reservation.** An `ai_spend_reservations` row is taken atomically before each paid call, so the API and the worker cannot both pass a nearly full budget at once. It adds a migration and a grant (INSERT, UPDATE on the new table).

## S8. Bounded activation (required)

- **Data model:** none.
  - `GEN_WORKER_MAX_JOBS`, a positive integer, is required when scene jobs are enabled; it is not set by default, which means refuse with exit 78.
  - `GEN_WORKER_JOB_TYPES` is an optional allowlist, for example `generate_angle_video`.
- **Behaviour:**
  - The worker claims at most `MAX_JOBS` jobs, only of the listed types, only from `GEN_WORKER_JOB_IDS` (S1a), within the run budget (S7).
  - Then it logs "activation limit reached" and keeps running idle. It does not exit, so pm2 does not restart it and reset the count.
  - A restart starts a new count. The ids already completed are no longer `queued`, so they cannot run twice.
- **Migration:** none.
- **Tests:** with five approved jobs and `MAX_JOBS=2`, exactly two are claimed, the worker stays up, and three stay `queued`.

**The activation sequence it enables** (each step separately approved):
1. Preflight: `node scripts/worker/check-db-access.js`.
2. Inventory: `node scripts/worker/backlog-inventory.js`.
3. Clean up stale jobs: gated, row-scoped. Rows not to run are marked `failed`, with the reason recorded.
4. Approve the ids, set `MAX_JOBS` and the run budget, and confirm the §7 pm2 credential check reports CLEAN for both files.
5. Enable the scene flag only, and watch the logs.
6. Re-run the inventory.
7. Stop, or raise the limits, by a new approval.

Video exports are enabled on their own, after their own inventory.

---

## Phase 1 (this change): the read-only inventory

`scripts/worker/backlog-inventory.js`. It starts no worker and changes nothing.

**Database:**
- It connects as the worker's own login, from the credential file, with the same settings as the preflight.
- The session is read-only: `default_transaction_read_only`, inside `BEGIN READ ONLY` … `ROLLBACK`, with a 15 s statement timeout.
- Every statement is a SELECT (`INVENTORY_QUERIES`) and takes no row locks.

**Redis:**
- It uses a minimal client that can send only AUTH, PING, LLEN, ZCARD, SCARD and EXISTS. Every other command is refused before anything is written to the socket.
- It reads the Bull keys of `video-export`: `wait`, `active`, `paused`, `delayed`, `priority`, `failed`, `completed`, `stalled`, and `meta-paused`.

**What it reports:**
- **Totals:** by status, type and `max_attempts`, with soft-deleted rows counted separately.
- **What the worker would do:** for each open job:
  - would run;
  - re-queued by recovery, then run;
  - marked failed by recovery;
  - never claimed.
- **Flags:** legacy, uncertain-paid, paid-retries, never-claimable, stale-cascade, force, target-gone, set-claim-live, older-than-24h.
- **Scene state:** for each job, the set and angle state.
- **Failures:** recent failed jobs, with errors shortened and URLs and tokens removed.
- **Spend:** 7 days of spend, including unpriced and Runway call counts and the caps.
- **Redis:** the queue counts.

**What it never prints:** passwords, hosts, payloads or raw errors.

**Exit codes:** 0 complete; 1 a section could not be read; 2 the settings or the connection failed.

**Tests:**
- **`tests/unit/workers/workerBacklogInventory.test.js`:**
  - the SQL is SELECT only;
  - the classifier;
  - redaction;
  - 28 mutating Redis commands refused with nothing written;
  - a fake RESP server receiving only allowed commands;
  - the settings exit codes.
- **`tests/integration/workerBacklogInventory.integration.test.js`:** on the local test database and a throwaway `redis-server`:
  - fixtures of every job shape are classified;
  - every row of the four tables hashes the same before and after;
  - the session refuses a write (25006);
  - the Bull keys' contents are identical before and after;
  - the Redis server's command statistics show only allowed commands;
  - no password appears in the output.

**Running it against production** reads production (no writes). It is a separate, approved step and has not been done.
