# Episode worker: activation safeguards (design proposal, #3714)

**Status:** revision 2, 2026-11-07, after Evoni's review of revision 1. This is a design direction only; nothing here is implemented. Every production step stays separately gated (`docs/runbooks/episode-worker-db.md` §6). The read-only inventory (`scripts/worker/backlog-inventory.js`) is the only code in this change.

**What changed from revision 1.** Revision 1 leaned on a single pm2 worker, a shutdown grace period and in-memory counters. None of those is a financial safety boundary: a process can crash or be killed at any instant, pm2 can restart it, and a second process can start by mistake. Revision 2 moves every limit and every paid-call fact into the database, written **before** the money is committed.

---

## The model in one page

Two new tables, both written **before** anything is spent, carry every guarantee below.

1. **`worker_activations`: one row per authorization Evoni gives.**
   - It holds:
     - the approved job ids;
     - optionally, the job types;
     - the maximum number of jobs;
     - the dollar budget;
     - the expiry;
     - the basis each job was approved against (S6).
   - The worker can read it and can **only** advance its counters and status. It cannot create a row, widen one or extend one; column-level grants enforce that.
   - A gated admin script creates the row from an inventory Evoni has read.
2. **`worker_paid_calls`: a write-ahead ledger of every paid provider call the worker makes.**
   - A row is inserted and **committed before** the request leaves the process. It records the estimated cost and a request key, and it reserves budget in the activation.
   - It is then updated with what is known: the provider's task id, the outcome, and the actual cost.
   - A row left at `intent` or `submitted` with no known outcome is, by definition, an **unknown outcome**.

**The consequences:**
- **Durable limits.** A restart cannot reset a limit. The counts and the reserved dollars live in the activation row, and the worker takes that row's lock before claiming a job or reserving money.
- **No blind resubmits.** A crash at any point leaves a ledger row that recovery can see. Recovery never resubmits; unknown outcomes go to reconciliation.
- **Concurrent workers are contained.** A second worker cannot over-claim or over-spend, because claims and reservations are serialized on the same activation row.

**Fail closed by construction.**
- Before any paid call, a transaction must succeed. It locks the activation, checks it, inserts the reservation and commits.
- If the activation can't be read, the ledger can't be written, the price is unknown or the spend is unreadable, the call is not made.

---

## S1. Per-job approval (approved direction)

- **Required for first activation:**
  - The worker claims a job only when its id is in the **active** `worker_activations` row's `job_ids`, the activation has not expired, and fewer than `max_jobs` have been started.
  - **An empty list, no active activation, or more than one active activation: nothing runs.** The worker logs which it is and waits.
  - The claim also requires the job type to be in `job_types`, when set.
- **Safe to defer:** the approval columns on `generation_jobs` for routine use (`approved_at` / `approved_by` from the user's own click). These are revision 1's S1b.
- **Migration / operational change:**
  - Migration: create `worker_activations` with `deleted_at`, per the repo convention.
  - Grants: `SELECT`, plus `UPDATE (jobs_started, reserved_usd, settled_usd, status, updated_at)` for `episode_worker`.
  - A new gated script, `scripts/worker/activation.js`, with `create`, `show` and `revoke`. `create` refuses ids that are not `queued` and records the basis (S6).
- **Acceptance tests:**
  - an empty list, an expired activation, a revoked one, or two active ones mean no claim;
  - only listed ids are claimed;
  - the restricted role cannot INSERT an activation or UPDATE `job_ids`, `max_jobs`, `budget_usd` or `expires_at` (42501).

## S2. Recovery and reconciliation (approved direction; the procedure is now required)

- **Required for first activation:**
  - **New status `needs_reconciliation`.**
    - Recovery moves every `processing` job to it, with the ledger state attached. It never re-queues and never fails such a job automatically.
    - The worker never claims a job in this status.
    - The API refuses new paid runs on the same set or angle (409 `NEEDS_RECONCILIATION`) until the job is resolved.
    - Existing UIs see it as `failed`, with that code (see revision 1's compatibility note).
  - **A safe, audited reconciliation procedure:** `scripts/worker/reconcile.js`.
    - `show <jobId>` (read-only): the job, its ledger rows, provider task ids, phases, reserved and settled dollars, and the set and angle state.
    - `check <jobId>`: for each ledger row with a provider task id, the provider's status, read once. **This depends on provider answers (Q2, Q5).** Until a status read is confirmed unbilled, `check` makes no provider call and prints what to look up in the provider's dashboard.
    - `resolve <jobId> --outcome succeeded|failed|unknown --billed yes|no|unknown --evidence "<text>"`: dry-run by default; `--apply` executes. One transaction:
      - updates the job: `completed` with the recorded result, `failed`, or `needs_reconciliation` kept with a note;
      - settles the ledger rows: billed `yes` or `unknown` keeps the reservation counted, `no` releases it;
      - releases the set and angle claims if they are still `generating`;
      - inserts an audit row in `worker_reconciliations` (who, when, outcome, billed, evidence, before and after state).
    - **It never resubmits.** "Run it again" means a new approval in a new activation, with the old job resolved first.
  - **The inventory lists `needs_reconciliation` jobs**, so nothing sits unresolved unseen.
  - **Activation is refused while any job from a previous activation is unresolved**, unless Evoni names it in the new activation as accepted-unresolved.
- **Safe to defer:** a Diagnostics UI for reconciliation (the "Activation Preview" idea); automated provider polling.
- **Migration / operational change:**
  - Migrations:
    - an enum value, forward-only;
    - `worker_reconciliations`, with `deleted_at`;
    - `worker_paid_calls` (S3).
  - Grants: INSERT on `worker_reconciliations` for the login that runs `resolve`.
  - Every `resolve --apply` in production is a separately approved, row-scoped change.
- **Acceptance tests:**
  - recovery moves `processing` jobs to `needs_reconciliation`, with no re-queue and no failure;
  - `show` and `check` write nothing (table hashes compared, as the inventory test does);
  - `resolve` without `--apply` writes nothing;
  - `resolve --apply` makes exactly one audit row and the stated transitions;
  - the claim and the API both refuse while the job is unresolved;
  - activation creation is refused while an older job is unresolved.

## S3. Duplicate charges and the crash window (needs stronger guarantees: revised)

**The window.** Revision 1 recorded the provider task id after the submit returned. If the process dies after the request leaves and before that write commits, nothing in the database says a paid request may exist. Revision 2 closes it with an intent written **before** sending.

**Required for first activation:**
1. **Intent.** In a committed transaction, on the locked activation row:
   - insert `worker_paid_calls (id, activation_id, job_id, seq, provider, model, request_key, phase='intent', estimate_usd, created_at)`;
   - add `estimate_usd` to `reserved_usd`.

   If this transaction fails, no request is sent.
2. **Send** the request once, carrying `request_key` as the provider's idempotency key **if** the provider supports one (Q1, Q4, Q6). Nothing assumes that it does.
3. **Record the response.** As soon as one arrives, update `phase='submitted'` and set `provider_task_id`, then `accepted`, `succeeded` or `failed`, with `actual_usd` where it is known.
4. **No automatic resend on an unknown outcome.**
   - A timeout, a reset, a 5xx, or no response at all after the request may have left: the row stays `intent` or `submitted`, the job goes to `needs_reconciliation`, and the reservation stays counted.
   - A retry happens only when the request **provably never left**: a DNS failure, `ECONNREFUSED`, or a TLS failure before sending, detected by the HTTP client's own error classification and tested.
5. **Recovery after any crash.**
   - Any ledger row in `intent` or `submitted` with no terminal phase is an unknown outcome. Its job goes to `needs_reconciliation` (S2).
   - A `processing` job with **no** ledger row past `intent` for its current step is still treated as unknown. The safe default is reconciliation, not a retry.
6. **The same rule applies to every paid call the worker can reach,** not only Runway:
   - Flux / fal stills;
   - OpenAI images;
   - the Claude analysis and consistency calls, inside `aiCostTracker`'s wrapper when called from the worker;
   - the angle consistency re-generation.

   The ledger write sits in the two existing choke points: `imageCost.runImageCall` and the `aiCostTracker` patch. It is active when the worker's ledger mode is on.
7. **Cost logging.** Each ledger row gives one `ai_usage_logs` row. An unknown outcome is logged at its estimate.

- **Safe to defer:**
  - Runway idempotency keys and status polling, until the provider answers arrive (Q1, Q2). Until then an unknown outcome is resolved by a person reading the provider dashboard.
- **Migration / operational change:**
  - `worker_paid_calls`, with `deleted_at`;
  - grants: INSERT, plus UPDATE (`phase, provider_task_id, actual_usd, outcome_at, error_code, updated_at`), SELECT.
- **Acceptance tests** (all with provider stubs, never a real provider):
  - the intent row is committed before the stub sees the request (the stub checks the database);
  - killing the process (SIGKILL) at each of three points (after intent, after send, after response) always leaves a ledger row and, after restart, a `needs_reconciliation` job with **zero** second requests at the stub;
  - a timeout after send means one request and reconciliation;
  - a refused connection means a retry is allowed;
  - a failed intent transaction means zero requests.

## S4. Separate switches (approved)

Unchanged from revision 1.
- `GENERATION_WORKER_ENABLED` is the master switch.
- `SCENE_JOBS_ENABLED` and `VIDEO_EXPORTS_ENABLED` both default to off in both ecosystems.
- Each loads only its own subsystem. The traced-module test proves it.
- Video exports make no paid AI call, but get their own inventory and their own approval before they are switched on.

## S5. Shutdown and duplicate processing (revised)

**Why a grace period alone is insufficient.** It runs only when the process is asked to stop politely. These skip it, or cut it short:
- SIGKILL;
- the out-of-memory killer;
- `max_memory_restart` (2G);
- a host reboot or instance stop;
- a container being reclaimed;
- `kill_timeout` expiring;
- a job longer than the grace, such as a cascade, or a Runway poll of up to 180 s.

At that point a paid request may be in flight. Correctness therefore cannot depend on shutdown, only on the ledger (S3) and on fencing.

- **Required for first activation:**
  - **Fencing token.**
    - The claim sets `generation_jobs.claim_token = gen_random_uuid()` and `activation_id`.
    - Every later write by that worker uses `WHERE id = :id AND claim_token = :mine AND status = 'processing'`.
    - A worker whose job was moved to `needs_reconciliation` by another process's recovery cannot overwrite it. Its result is still recorded on its ledger rows, so reconciliation can use it.
  - **Recovery runs only when no other live worker holds a claim.** The worker registers its session (`application_name = 'episode-worker:<boot id>'`). Recovery first checks `pg_stat_activity` for another `episode-worker:*` session of the same role, and **refuses to run recovery and refuses to claim** if one exists.
    - Reading other sessions of the same role from `pg_stat_activity` needs no extra grant.
    - Together with the fencing token, this means a second process neither steals a job nor double-processes one.
  - **Graceful shutdown is kept, as a convenience** (fewer reconciliations), not as a guarantee: stop claiming, wait up to the grace, then exit. `kill_timeout` is set above the grace.
- **Safe to defer:** a heartbeat lease. With fencing and the single-session check, it would only speed up the detection of dead workers.
- **Migration / operational change:**
  - migration: `generation_jobs.claim_token UUID NULL` and `activation_id UUID NULL`;
  - pm2: `kill_timeout` raised in both ecosystems.
- **Acceptance tests:**
  - a second worker started while one holds a claim neither recovers nor claims;
  - a stale write with the wrong token updates 0 rows;
  - SIGKILL mid-job, then restart, gives zero second provider requests (shared with S3).

## S6. Cascade claims and stale payloads (stale checks now required)

**Reassessment.** For the first activation every candidate is an **old** job: its payload (overrides, event, `force: true`) records an intent from when it was queued, possibly months ago. Approval from the inventory happens at time T and the run at T+Δ, and the set can change in between. Evoni can edit it, approve its base, or delete the event. So stale checks are **required**, not deferred.

- **Required for first activation:**
  - **Set claim ownership.**
    - Before any paid call, the worker claims the set with `claimRow`.
    - It proceeds only if the claim is fresh, or held by this job (`scene_sets.generation_claim_job_id = job.id`, written with the claim).
    - Otherwise the job fails with `SET_BUSY`. No ledger intent has been written, so nothing is spent.
  - **Basis recorded at approval.** `activation.js create` records, for each approved job, the basis it read at approval time:
    - the set's `updated_at`;
    - a hash of `canonical_description`;
    - the base still and its approval state;
    - for angle jobs, the angle's `updated_at` and still;
    - for an `event_id` payload, whether the event exists.
  - **Basis checked at claim.** The worker recomputes the basis. Any difference fails the job with `STALE_BASIS` before any paid call, naming what changed. Evoni re-approves if she still wants it.
  - **Age limit:** `max_job_age_hours` is stored in the activation row (no environment default to forget).
- **Safe to defer:** routes recording a basis on new jobs at creation time. Steady state only; new jobs run soon after creation.
- **Migration / operational change:**
  - migration: `scene_sets.generation_claim_job_id UUID NULL`;
  - the basis lives in `worker_activations.basis` (JSONB);
  - the cascade route sets `generation_claim_job_id`.
- **Acceptance tests:**
  - a changed description, base approval, still, or deleted event fails the job with `STALE_BASIS` and zero stub calls;
  - a live API claim fails it with `SET_BUSY` and zero stub calls;
  - an unchanged basis runs.

## S7. Spending limits (revised)

- **Required for first activation:**
  - **A durable activation budget.**
    - `worker_activations.budget_usd` is set by Evoni.
    - `reserved_usd` grows at every intent (S3), on the locked activation row.
    - A call whose estimate would take `reserved_usd` past `budget_usd` is refused before sending: the job fails `RUN_BUDGET_REACHED`, and the activation becomes `exhausted`.
    - Reservations are released only by an outcome that is known not billed (provider-confirmed failure, or `resolve --billed no`). An unknown outcome stays reserved. **A restart changes nothing:** the numbers are in the row.
  - **Unknown price fails closed.**
    - A model without a rate cannot form an estimate, so it cannot write an intent, so it is not called.
    - This blocks Runway until Evoni supplies its price (Q3).
    - Claude calls reserve the worst case: `max_tokens` at the output price plus a prompt-size estimate at the input price.
  - **Unreadable spend fails closed.**
    - In ledger mode the worker also checks the daily caps (`AI_DAILY_BUDGET_USD`, `AI_DAILY_IMAGE_BUDGET_USD`), counting today's `ai_usage_logs` plus its own open reservations.
    - If that read fails, the call is refused. That is the opposite of today's fail-open (`imageCostService.readTodaySpend`), and it applies in the worker only.
  - **Concurrent API spending:**
    - **The worker's own spend** is strictly bounded by `budget_usd`, whatever the API does, because the reservation is atomic and durable.
    - **The combined daily cap** is not atomic with the API today. The API checks `ai_usage_logs` before each call (fail-open), so simultaneous API and worker calls can each pass a nearly full cap. The overshoot is bounded by the estimates of the calls in flight at that moment: one worker call, plus the API calls open at the same time.
    - **For the first activation this is closed operationally,** with a check in code: `activation.js create` refuses unless `PAID_GENERATION_API_PAUSED=true` is set for the API. That is a new switch that makes the API's paid routes return 503 `PAID_GENERATION_PAUSED` while an activation is active.
- **Safe to defer:** the API joining the ledger (reservations from `runImageCall` and `aiCostTracker` in the API process too). That makes the daily cap atomic across processes and lets the API pause be lifted during activations.
- **Migration / operational change:**
  - the columns on `worker_activations` and `worker_paid_calls` above;
  - a rate for Runway in the rate table, once priced;
  - the new API switch `PAID_GENERATION_API_PAUSED`, default false, set by Evoni for the activation window.
- **Acceptance tests:**
  - two worker processes against one activation never reserve past `budget_usd` (racing test);
  - after a restart, `reserved_usd` is unchanged and the next call is refused at the boundary;
  - an unpriced model means no call;
  - an unreadable spend read means no call;
  - with the API pause on, the paid routes return 503 and the read routes are unchanged;
  - activation creation is refused without the pause.

## S8. Bounded activation (approved; durable)

- **Required for first activation:**
  - **The job count.**
    - `max_jobs` and `jobs_started` live in the activation row.
    - The claim is one transaction: lock the activation, check status, expiry, `jobs_started < max_jobs`, the id in `job_ids` and the basis; increment `jobs_started`; claim the job with its fencing token.
    - A started job counts whether it succeeds or fails, so failures cannot be used to loop.
  - **Restarts do not reset it.** A pm2 restart continues the **same** activation with its remaining count and budget, never a fresh one. When the count or budget is used up, or the expiry passes, the status becomes `exhausted` or `expired` and the worker idles.
  - **Revoking.** `activation.js revoke` sets `revoked`; the next claim or reservation sees it.
  - **No configuration in pm2's environment.** Nothing about the authorization is held in env vars, so nothing in pm2's saved state can widen or renew it.
- **Safe to defer:** activations for video exports (no paid AI; the S4 switch is enough at first).
- **Migration / operational change:** none beyond `worker_activations`.
- **Acceptance tests:**
  - with `max_jobs=2` and 5 approved: exactly 2 are claimed, the worker survives a SIGKILL plus restart, and no third is claimed;
  - expiry and revocation stop the next claim;
  - two workers racing claim at most `max_jobs` between them.

---

## Summary: what the first activation needs

| Item | Code | Migration | Grants | Operational |
|---|---|---|---|---|
| Activation row (S1, S7, S8) | `activation.js`; claim and reservation transactions | `worker_activations` | SELECT; UPDATE (counters, status) | Evoni creates each activation (gated) |
| Paid-call ledger (S3, S7) | intent before send; outcome after; at the two choke points | `worker_paid_calls` | INSERT, SELECT; UPDATE (phase, task id, cost) | — |
| Reconciliation (S2) | recovery → `needs_reconciliation`; `reconcile.js`; API guard and status mapping | enum value; `worker_reconciliations` | INSERT for the resolving login | each `resolve --apply` gated |
| Fencing and single session (S5) | claim token; `pg_stat_activity` check | `generation_jobs.claim_token`, `activation_id` | none | pm2 `kill_timeout` |
| Stale basis and set claim (S6) | basis at approval and at claim; `claimRow` ownership | `scene_sets.generation_claim_job_id` | (existing UPDATE) | — |
| Fail-closed spend (S7) | worker ledger mode; unpriced refusal; API pause switch | — | — | Runway price from Evoni; API pause during activation |
| Switches (S4) | three flags | — | — | — |

**Migrations:** five changes, all forward-only and additive. The enum value can't be dropped; the tables and columns can be dropped by gated down-migrations. The role grants change accordingly, applied in production as a gated grant change: `scripts/worker/sql/episode-worker-role.sql` and `src/workers/workerDbGrants.js`, with the restricted-role test extended to each new grant and its refusals.

**Suggested PR order** (each its own approval):
1. migrations and grants;
2. the ledger and the activation transactions in the worker;
3. reconciliation;
4. stale basis and the API pause;
5. switches and shutdown.

None of these switches the worker on.

## Provider questions that remain open

These must be answered from each provider's documentation, or by Evoni from her accounts. **The design assumes the unfavourable answer until they are.**

| # | Provider | Question | Why it matters |
|---|---|---|---|
| Q1 | Runway | Does `POST /v1/image_to_video` accept an idempotency key, and for how long is it honoured? | Lets a retry after an unknown outcome be safe (S3) |
| Q2 | Runway | Is `GET /v1/tasks/{id}` free? How long are tasks kept? Is there a way to list recent tasks (to find a submission whose id was never stored)? | Lets reconciliation `check` (S2) |
| Q3 | Runway | The USD price per second (or per credit) of `gen3a_turbo`, and whether failed or cancelled tasks are billed or refunded | Without it Runway stays refused (S7) |
| Q4 | fal (Flux / Kontext) | Idempotency for the queue and sync endpoints; is a request that times out on our side still run and billed? | S3 for stills |
| Q5 | fal | Is the request-status endpoint free, and how long are results kept? | S2 `check` for stills |
| Q6 | OpenAI images | `Idempotency-Key` support on image generation, and billing of client-timed-out requests | S3 if the OpenAI base model is used |
| Q7 | Anthropic | Billing when the client times out, and whether a duplicate request can be detected | Claude reservation and settlement (S3, S7) |

---

## Phase 1 (this change): the read-only inventory

`scripts/worker/backlog-inventory.js` and its tests, as described in the PR.

**What it guarantees by itself:**
- The SQL is SELECT-only.
- The session is read-only (`default_transaction_read_only`, `BEGIN READ ONLY`, `ROLLBACK`), which PostgreSQL enforces **whatever the role's grants are**.
- Redis is limited to AUTH, PING, LLEN, ZCARD, SCARD and EXISTS on the client side, whatever the server allows.
- Importing it loads no worker, model, queue library, service or AI SDK (tested).
- An unread section makes the report INCOMPLETE, with a banner, never zeros.
- Counts are computed over every open job, not the listed ones.
- Error text is redacted, including unusual formats.

**What depends on the production configuration and is not yet verified:**
- **The role.** The `episode_worker` role and its credential file don't exist in production yet (§6 steps 2–3). Until they do, the tool cannot run there. If the grants differ, a query fails and the report is INCOMPLETE; it does not write.
- **A non-default database.** The tool assumes the Bull prefix `bull`, the queue `video-export` and Redis database 0, as the code uses. A different prefix or database in production shows as "no Bull keys found" (INCOMPLETE), not as a confirmed zero.
- **Redis on the box.** Whether Redis runs there, and its password, are unknown.
- **The production `.env`.** The database settings come from it; the preflight checks the same settings.
- **A superuser login.** If the credential file named a superuser despite the loader's refusal of `postgres` and `rdsadmin`, the session would still be read-only. Only the preflight's role-attribute check proves the role is the restricted one.
