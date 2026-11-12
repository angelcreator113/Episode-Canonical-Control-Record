# Episode worker: activation safeguards (design proposal, #3714)

**Status:** revision 4, 2026-11-09 (documentation only). **Revision 4, at the end of this file, supersedes revisions 1 to 3 wherever they conflict.** It reuses the AI egress gateway's G2 ledger and the Scene Sets attempt record (#3757) instead of building a worker ledger, pause or reconciliation of its own (Evoni's decisions 1–5, 2026-11-09). Read revision 4 first; the earlier sections remain as the reasoning it builds on.

**Earlier status (revision 3, 2026-11-07):** Evoni accepted revision 2 as the working design, not as authorization to implement. Revision 3 answers her final questions A–D (the section "Revision 3" below), and supersedes revision 2 where they conflict. Revision 2 came after her review of revision 1. This is a design direction only; nothing here is implemented. Every production step stays separately gated (`docs/runbooks/episode-worker-db.md` §6). The read-only inventory (`scripts/worker/backlog-inventory.js`) is the only code in this change.

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

## Revision 3: the final design questions (A–D)

**What it supersedes in revision 2.**
- The API pause is a database control acknowledged by the API, not an environment flag (C).
- The worker's mutations go through fixed `SECURITY DEFINER` functions instead of column-level UPDATE grants (D).
- The ledger states are the ones defined in A.

### A. The paid-call lifecycle

Every paid provider call the worker makes has one `worker_paid_calls` row. Its `phase` moves only along the arrows below. Each move is a committed database transaction, made by a fixed function (D).

| Phase | Meaning | Committed when | Request sent? |
|---|---|---|---|
| `reserved` | Budget reserved; request key generated | T1: the reservation transaction (B) commits, **before** any network activity | No: the send is reached only after T2 commits |
| `submitting` | About to send | T2: committed immediately before the request is written to the socket. If T2 fails, nothing is sent | Maybe |
| `accepted` | The provider returned a task id (Runway, fal queue) | T3: as soon as the response is parsed | Yes |
| `provider_succeeded` | The provider reports success; the output reference (URL) is recorded | T4: before the asset is downloaded or stored | Yes |
| `succeeded` | Confirmed success: the asset is stored in S3 and the job or scene row points to it | T5: the same transaction as the job or scene update, after the S3 write | Yes |
| `not_sent` | Provably never sent | Set by recovery for a row still `reserved`, or by the worker for a pre-send error (below) | No |
| `failed_confirmed` | The provider definitively reported failure, or rejected the request (4xx validation) | When the response is received | Yes |
| `unknown` | Sent, or possibly sent, with no definitive answer: timeout, reset, 5xx, crash | Set by the worker on such an error, or by recovery for any row left in `submitting`, `accepted` or `provider_succeeded` | Maybe |
| `abandoned` | Reconciled, but the outcome could not be established | Only by reconciliation | Maybe |

Synchronous providers, such as the Flux sync endpoint, go straight from `submitting` to `provider_succeeded` or `failed_confirmed`.

**The rule that makes A work.** The code path that sends the request can be reached only after T2 has committed and returned. This is tested by killing the process at every boundary (SIGKILL injection) and checking the provider stub's request count.

**The four cases asked about:**
1. **A crash between reservation and submission.**
   - The row is `reserved` with no `submitting` commit.
   - Recovery moves it to `not_sent` and releases its reservation.
   - The job still goes to `needs_reconciliation`, because an earlier call of the same job (for example, a cascade's base) may have been paid. The row itself is clean evidence that **this** call was not sent.
2. **A successful submission whose task id was not persisted.**
   - The row is `submitting`. Recovery moves it to `unknown`, and **the reservation stays**.
   - Reconciliation looks it up by the request key, if the provider supports idempotency keys (Q1), or in the provider's task list for that time window (Q2). Otherwise Evoni checks the provider dashboard or billing.
   - Found: the task id is recorded, and the row continues to `accepted` and then to asset recovery.
   - Not found: the row becomes `abandoned` with billed `unknown`, and the estimate stays counted as spent.
3. **A completed provider task whose asset was not saved.**
   - The row is `accepted` (task id known) or `provider_succeeded` (output URL known).
   - Recovery leaves the phase as it is, marks it `unknown` only if it was `submitting`, and sends the job to `needs_reconciliation`.
   - `reconcile.js recover-asset` reads the task status by id and downloads the output. Both are GET requests on an allowlist; neither is a paid request (Q2, Q8). It then stores the asset and commits `succeeded` with the job or scene update.
   - If the output has expired (Q8), the row becomes `failed_confirmed` with billed `yes`.
4. **What evidence allows a retry.** A new paid request for the same work is allowed only on one of these:
   - the row is `not_sent`;
   - a pre-send error class was recorded: DNS failure (`ENOTFOUND` / `EAI_AGAIN`), `ECONNREFUSED`, or a TLS handshake failure. These are raised by the HTTP client before any request bytes are written, classified by error code and covered by tests;
   - the provider definitively states that no task exists for this request key. This is possible only once Q1 or Q2 confirms such a lookup.

   **Only the first two allow an automatic retry, within the same call.** Anything else needs an explicit resolution, then a new job and a new activation approval.

**How reconciliation moves states without paying.**
- `scripts/worker/reconcile.js` imports no submit function. Its provider client is a GET-only allowlist (task status, output download), like the inventory's Redis client.
- A test traces its requires and its HTTP methods: no model service, no `imageCostService`, no SDK, no POST.
- Every `--apply` calls one function, `reconcile_paid_call(call_id, new_phase, billed, actual_usd, evidence)`, which:
  - permits only these moves: `unknown` → `accepted`, `succeeded`, `failed_confirmed` or `abandoned`; `accepted` or `provider_succeeded` → `succeeded` or `failed_confirmed`; and a billing settlement on a terminal row;
  - never inserts a ledger row;
  - writes the `worker_reconciliations` audit row in the same transaction.

**Tests:**
- SIGKILL at T1/T2, T2/send, send/T3, T3/T4 and T4/T5. Each leaves the stated phase, gives zero second requests at the stub, and recovers to the stated state.
- Pre-send errors retry; post-send errors never do.
- `reconcile_paid_call` rejects every move not listed above.

### B. Budget reservations

- **Uncertain calls keep consuming their estimated maximum.** A row in `reserved`, `submitting`, `accepted`, `provider_succeeded` or `unknown` keeps its `estimate_usd` in the activation's `reserved_usd` until reconciled. An `abandoned` row's estimate moves to `spent_usd` permanently.
- **The estimate is an upper bound, by rule:**
  - images: the per-image price at the requested size and quality;
  - Runway: duration × price per second;
  - Claude: `max_tokens` at the output price, plus the prompt's token count (counted locally) at the input price.

  A model without a price cannot form an estimate, so it is refused.
- **Actual cost replaces the estimate.** On a terminal outcome, one transaction moves `estimate_usd` out of `reserved_usd` and adds `actual_usd` to `spent_usd`.
  - `actual_usd` is the provider-reported or rate-table cost. When it is not known, the estimate is used.
  - Should an actual exceed its estimate, which means the estimate rule is wrong and a test should have caught it, the true figure is recorded and the activation becomes `exhausted`. The overshoot is bounded by that one call's difference.
- **Releases:**
  - `not_sent`: the full estimate is released.
  - `failed_confirmed` with billed `no`, on evidence (a provider status or a refund record): released.
  - Billed `unknown`: the estimate moves to `spent_usd`.
  - A later refund: `reconcile_paid_call` with evidence lowers `spent_usd`, audited and never below 0. It does **not** reopen an exhausted activation; more work needs a new activation.
- **Concurrency.**
  - Every reservation runs in `worker_reserve_call(...)`: `SELECT … FROM worker_activations WHERE id = $1 FOR UPDATE`, then a check that `spent_usd + reserved_usd + estimate <= budget_usd`, then the ledger insert and the counter update, then commit.
  - The row lock serializes every reserver: any number of worker processes, and reconciliation.
  - `CHECK (reserved_usd >= 0 AND spent_usd >= 0)` is a backstop.
  - Isolation is READ COMMITTED; the row lock gives the ordering.
  - **Test:** 20 parallel reservations against a budget that fits 7 commit exactly 7.

### C. The paid API pause

**Mechanism.** A singleton row in `paid_generation_controls`:
- `version` and `api_paused`, with `changed_at`, `changed_by` and `note`;
- acknowledgement columns written by the API: `api_ack_version`, `api_ack_paused`, `api_ack_at`, `api_in_flight`, `api_tracker_patched`.

Rules:
- Only an admin script changes `api_paused`.
- Each API process re-reads the row at most every 5 s, and writes its acknowledgement every 5 s.
- The guard refuses when the row says paused, or when the row cannot be read (fail closed while paused). The last value read stays in force for at most 5 s.

**Where it is enforced.** The two choke points, plus each path that bypasses them:

| Path | How |
|---|---|
| Every `imageCost.runImageCall` and `trackReplicate` call. This covers the image, video and background-removal routes in the appendix below: the Flux and OpenAI stills, the Runway angle video, remove.bg, Replicate, and `mediaVariations` (camera roll, post media, feed-post pictures) | A guard at the top of `runImageCall`: refuse with `PAID_GENERATION_PAUSED` before the provider is called |
| Every Anthropic SDK call: 50 route files that use the SDK directly, the services they reach, and `messages.stream` | A guard in the `aiCostTracker` `Messages.create` patch. The patch can fail to install (it logs and continues), so the acknowledgement carries `api_tracker_patched`, and verification refuses when it is false |
| **Bypass:** `POST /api/v1/scenes/:id/animate` (`sceneStudioController.animateScene`, a direct Runway `startImageToVideo`) | An explicit guard. **Separately, this route has no budget gate today: a live defect, reported below** |
| **Bypass:** `POST /api/v1/amber/speak` and `POST /api/v1/amber/read-story` (ElevenLabs) | An explicit guard |
| **Bypass:** `POST /api/v1/amber/diagnostic/findings/:id/execute` (the `claude` CLI in a child process) | An explicit guard |
| **Bypass:** `POST /api/v1/assets/:id/enhance` and `POST /api/v1/scene-sets/:id/angles/:angleId/post-process` (Cloudinary) | An explicit guard |
| Background: `postRelease` (every minute, **with no on/off switch today**), `postPictures.afterRelease` / `runWaiting`, the Pulse schedulers (`PULSE_ENGINE_ENABLED`), `feedScheduler` (`FEED_SCHEDULER_ENABLED`) and its HTTP run-now routes, `worldMoments`, and work started with `setImmediate` (`postPictures.afterApproval`, the `episodePoseMedia` queue, `sceneModelComparison`) | Their paid calls hit the choke-point guards. Each must treat `PAID_GENERATION_PAUSED` as **"wait and retry on a later tick"**, never as a permanent failure. The implementation checks this per path, with a test that runs each tick under the pause and finds its items still waiting |
| The refinement queue (`sceneRefinementQueue`) | No processor is registered anywhere, so nothing runs. Jobs added by `auto-refine` wait in Redis. The inventory should count them (a later addition) |

The exact route list for the choke-point paths is in the appendix. Enforcement does not depend on that list being complete: the guard sits at the calls themselves. The acceptance test drives every route in the appendix, plus the bypasses, under the pause and asserts 503 with zero provider-stub calls.

**What users see.**
- Paid actions return **503 `PAID_GENERATION_PAUSED`**: "Paid generation is paused while maintenance runs. Nothing was charged; try again later." The existing pages already show the API's error message (the `sendFail` pattern).
- Read, edit, upload and every non-paid route work normally.
- Scheduled and background items stay queued, or keep waiting.
- No new UI is needed. A Diagnostics banner can come later.

**Paid requests already running.**
- The guard runs at the start of each paid call. A call already past it finishes; it is spend already committed.
- The choke points and the bypass guards keep an in-process `api_in_flight` count (incremented before the provider call, decremented in `finally`), published in the acknowledgement.

**Verifying the pause before activation.** `activation.js create` refuses unless all of the following hold, checked by reading the database:
- `api_paused = true`;
- every API process has acknowledged the current version (`api_ack_version = version`, `api_ack_paused = true`) within the last 15 s, with `api_in_flight = 0` and `api_tracker_patched = true`;
- the pause has been in force for at least the longest paid call's duration (10 minutes; the Runway poll alone is up to 180 s);
- no `ai_usage_logs` row from the API has been written since `changed_at` + 10 minutes.

Recommended, but not required: Evoni tries one paid action in the UI and sees the 503.

The worker re-checks the pause and the acknowledgement's freshness inside `worker_reserve_call`. **If the pause is lifted, or the API stops acknowledging, the worker's next reservation is refused.**

**Restoring the API.** `paid_generation_controls.js resume` refuses unless:
- no activation is `active`;
- no worker ledger row is in `reserved`, `submitting`, `accepted` or `provider_succeeded`. Rows in `unknown` are reconciliation, not in-flight work, and do not block.

It then sets `api_paused = false` (a new version) and waits until the API acknowledges `api_ack_paused = false`. Background items resume on their next tick.

**Why lifting the pause cannot enable the worker.**
- The pause grants nothing; it is only a precondition.
- To process anything, the worker separately needs all three of:
  1. its master switch and the scene-jobs switch, set in `.env` and applied by a pm2 restart;
  2. an `active` activation, created only by `activation.js create`, which refuses unless the pause is verified;
  3. a successful `worker_reserve_call`, which itself requires the pause to be in force.
- Lifting the pause removes (2)'s and (3)'s precondition. The worker then fails closed and makes no further paid calls.

### D. Activation ownership

- **The worker cannot write the control tables directly.** `episode_worker` gets SELECT on `worker_activations`, `worker_paid_calls` and `paid_generation_controls`, and no INSERT, UPDATE or DELETE on any of them.
- **Fixed functions do all of its writes.** It gets EXECUTE on: `worker_claim_job`, `worker_reserve_call`, `worker_mark_submitting`, `worker_record_response` and `worker_settle_call`.
  - They are `SECURITY DEFINER`, owned by a `NOLOGIN` role (`episode_worker_ledger_owner`), with `SET search_path = pg_catalog, pg_temp` and fully qualified names, as the repo's migrations already do.
  - They perform only the transitions in A and B. None can change `job_ids`, `job_types`, `max_jobs`, `budget_usd`, `expires_at` or `basis`, or set a status back to `active`.
- **Activations are immutable.** A trigger on `worker_activations` rejects, for **every** role including admin:
  - any UPDATE of those columns, or of `approved_by` and `approved_at`;
  - any status move other than `active` → `exhausted`, `expired` or `revoked`.

  There is no widen and no renew: a change is a revoke plus a new activation.
- **Only an admin creates one.** `activation.js create` is the only INSERT path. Evoni runs it with an admin login, never `episode_worker`, as a separately approved step. It refuses unless the pause is verified (C), no job from an earlier activation is unresolved, and every listed job is `queued` with its basis captured (S6).
- **At most one active activation**, enforced by a partial unique index on `(status) WHERE status = 'active'`.
- **The role setup is gated DDL.** `episode_worker` is not a member of the owner or admin roles, and stays `NOINHERIT`. Creating the owner role and the grants is role DDL, so it goes in the gated role SQL file (as `episode_worker` does), not in an automatic migration.
- **Tests, as `episode_worker`:**
  - INSERT or UPDATE on `worker_activations` or `worker_paid_calls` is refused (42501);
  - `worker_claim_job` beyond `max_jobs`, after `expires_at`, or for an id that isn't listed is refused;
  - `worker_reserve_call` past the budget, or without the pause, is refused;
  - the trigger blocks an admin widening (`job_ids`, budget, expiry) and blocks reactivation;
  - the preflight is extended to check that none of these privileges is present.

### Migration and setup list (not implemented)

**Migrations** (each needs its own approval, applied through the Deploy workflow):
- the tables `worker_activations`, `worker_paid_calls`, `worker_reconciliations` and `paid_generation_controls`, each with `deleted_at`;
- the `needs_reconciliation` enum value (forward-only);
- `generation_jobs.claim_token` and `activation_id`;
- `scene_sets.generation_claim_job_id`;
- the definer functions, the immutability trigger and the partial unique index.

**Gated role SQL:** the `NOLOGIN` owner role, its ownership of the functions, and the new grants.

### Live defects found (outside the worker; not fixed here)

- **`POST /api/v1/scenes/:id/animate`** calls Runway `image_to_video` directly. It skips `runImageCall`, so it has **no budget gate and no usage log row**, and it re-submits on timeouts (the S3 rule). This affects the API today, whether or not the worker runs.
- **`postRelease`** (`app.js` starts it every minute outside tests) has no environment switch. Its picture step makes OpenAI image edits, budget-gated through `runImageCall`.
- **ElevenLabs** (`/amber/speak`, `/amber/read-story`), **Cloudinary** (`/assets/:id/enhance`, `post-process`) and the **`claude` CLI** route are untracked by cost logging. This was already known for ElevenLabs and Cloudinary (`PROJECT_CONTEXT.md`).

### More provider questions

| # | Provider | Question |
|---|---|---|
| Q8 | Runway, fal | How long does a task's output URL stay downloadable? This decides how long asset recovery (A, case 3) remains possible |
| Q9 | Runway | Does a task cancelled after submission still bill? |

### Appendix: API routes that reach a paid image, video or background call, all through `runImageCall`

Under the pause, every one of these returns 503 with zero provider calls. The list was traced from the code on 2026-11-07; the acceptance test is the authority.

- **`/api/v1/scene-sets`:**
  - `POST /:id/generate-base`
  - `/:id/angles/:angleId/generate`
  - `/:id/generate-all-angles`
  - `/:id/angles/:angleId/regenerate`
  - `/model-comparison`
  - `/:id/look-variants/:kind/:value/generate`
  - `/:id/generate-object`
  - `/:id/transform-object`
  - `/:id/regenerate-background`
  - `/:id/angles/:angleId/generate-depth`

  Two more only queue work: `/:id/angles/:angleId/generate-video` and `/:id/cascade-regenerate` create `generation_jobs` rows for the worker, and `/:id/angles/:angleId/auto-refine` adds a refinement-queue job that nothing processes.
- **`/api/v1/scenes`:** `POST /:id/generate-object`, `/:id/transform-object`, `/:id/regenerate-background`, `/:id/inpaint`, `/:id/segment` and `/:id/generate-depth`. (Also `/:id/animate`, the bypass in C.)
- **`/api/v1/world`:**
  - `POST /:showId/events/:eventId/generate-venue`
  - `…/events/:eventId/look/generate`
  - `…/events/:eventId/generate-invitation`
  - `…/reroll-invitation-background`
  - `…/reroll-invitation-text`
  - `/:showId/events/batch-generate-invitations`
  - `/:showId/events/:eventId/animate-invitation`
  - `/:showId/episodes/:episodeId/generate-title-overlay`
- **`/api/v1/episode-brief`:** `POST /:episodeId/dressed-angles/:angleId/generate`
- **`/api/v1/media`:** `POST /:id/variations`
- **Camera roll:** `POST /moments/:id/make` and `/characters/:id/make-kept`.
- **Post media:** `POST /posts/:postId/suggestions/run` and `/posts/:postId/picture`.
- **Feed posts:** `PUT /:postId`, `POST /release-plan` and `PUT /:postId/release-time`, through `postPictures.afterApproval`.
- **`/api/v1/ui-overlays`:** `POST /:showId/generate-all`, `/:showId/generate/:overlayType` and `/:showId/remove-bg/:assetId`.
- **`/api/v1/wardrobe`:**
  - `POST /`
  - `/:id/process-background`
  - `/:id/regenerate-product-shot`
  - `/:id/upscale`
  - `/bulk/upscale`
- **`/api/v1/wardrobe-library`:** `POST /`
- **`/api/v1/assets`:**
  - `POST /:id/remove-background`
  - `/bulk/process-background`
  - `PUT /:id/process`
  - `POST /:id/process-background`
  - `/process`
- **`/api/v1/episode-poses`:** `POST /:episodeId`, `/:episodeId/from-lookbook` and `/:episodeId/:poseId/reprocess`.
- **`/api/v1/youtube-thumbnails`:** `POST /episodes/:episodeId/pictures/cut-out` and `/episodes/:episodeId/backgrounds/ai`.
- **`/api/v1/cast`:** `POST /characters/:id/appearance/portrait`
- **`/api/v1/episodes`:** `POST /:id/title-card` and `/:id/title-overlay/flourish`.
- **`/api/v1/shows`:** `POST /:id/seed-finance-apps` and `/:id/redecorate-finance-app`.

**Claude routes are not listed one by one.** 50 route files import the SDK directly, and up to 37 more reach SDK-using services. The guard sits in the SDK patch, so it covers them without a list, and the acceptance test enumerates them by driving each route with the SDK stubbed.

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

---

## Revision 4: reuse the gateway ledger and the Scene Sets protections (2026-11-09)

**Documentation only.** Nothing here is implemented, migrated or switched on. It applies Evoni's decisions of 2026-11-09:
1. **One financial ledger.** The AI egress gateway's G2 ledger (`aigw_permits`, migration `20261108120000-create-aigw-ledger`, #3746, merged, not wired) is the only authoritative record of paid generation. No `worker_paid_calls`, no second pause or control table, no separate financial reconciliation. `scene_generation_attempts` (#3757) stays the domain record for scene sets and angles.
2. **Activations integrate with the gateway.** Worker-specific records only where genuinely needed; nothing that duplicates permits, controls or reconciliation.
3. **M0 is preserved.** The worker receives no provider key and never bypasses the gateway. Paid worker generation waits for G3 and G4, implemented and verified.
4. **This revision** (step 1) is approved; the worker-safety implementation (step 3) is designed in R4.10 and not approved.
5. **#3737** is reviewed read-only in R4.11.

### R4.0 What revision 4 supersedes

| Revision 2 / 3 | Revision 4 |
|---|---|
| `worker_paid_calls` and its phases (A) | `aigw_permits`, whose phases are the same set: `authorized`, `dispatching`, `accepted`, `provider_succeeded`, `succeeded`, `failed_confirmed`, `unknown`, `abandoned`, `not_sent` |
| Budget reservations on the activation row (B, S7) | Gateway exposure (reserved + confirmed + uncertain) under the gateway's day lock, plus an activation budget in the gateway (R4.3) |
| `paid_generation_controls` and the API pause (C) | `aigw_control`: Stop, per-category pause, caps, acknowledgement |
| `worker_reconciliations`, `reconcile_paid_call` | `aigw_reconciliations` and `aigw_reconcile` (evidence and the admin role required) |
| The worker's own definer functions for the ledger (D) | The gateway's functions and roles (`aigwDbGrants.js`); the worker would be caller class `worker` |
| The worker calling providers itself | Every paid call through the gateway (M0); the worker holds no key |
| A Runway "live" budget bypass on `POST /scenes/:id/animate` | **Latent, not live:** `startImageToVideo` is not exported on `main`, so the route fails before any request (#3737's finding, checked on `152893c5`). Still high priority: see R4.11 |

Unchanged and still required: per-job approval (S1), stale-basis checks (S6), the bounded job count (S8), separate switches (S4), fencing and the single-session check (S5), and the provider questions Q1–Q9.

### R4.1 Who owns which state

| State | Owner (single source of truth) | Never stored elsewhere as truth |
|---|---|---|
| Money: estimate, reservation, billed, exposure, caps, Stop, pause, provider task id, financial reconciliation | **Gateway** (`aigw_permits`, `aigw_control`, `aigw_reconciliations`, `aigw_permit_events`) | `scene_generation_attempts.estimate_usd` and `usage_log_id` become informational copies (or stay NULL) once the gateway is wired; `ai_usage_logs` stays the reporting log |
| A scene set's or angle's still: in flight, stored, uncertain, confirmation to regenerate, the provider image URL kept for a failed store | **`scene_generation_attempts`** plus `scene_sets` / `scene_angles` (`generation_status`, `current_attempt_id`) and their guards | — |
| A worker job: queued, claimed, done, failed, needs reconciliation; its claim token | **`generation_jobs`** | — |
| An angle video's result | `generation_jobs` (the job) and the angle's video fields; its money in the gateway | Not a `scene_generation_attempts` row (R4.6) |
| What Evoni approved: job ids, job count, expiry, basis | **`worker_activations`** (worker-specific, non-financial; R4.3) | Its budget lives in the gateway |

### R4.2 Logical keys and permit associations

The gateway's `logical_key` plus `attempt` is unique (`aigw_permits_attempt_once`), and a new attempt of a key is refused unless every earlier one is `not_sent` or `failed_confirmed` (`PRIOR_ATTEMPT_UNKNOWN`, `PRIOR_ATTEMPT_NOT_RETRYABLE`, `ATTEMPT_EXISTS`). So **the logical key is what makes "the same operation" impossible to charge twice.** Keys:

| Paid operation | `logical_key` | Other permit fields |
|---|---|---|
| A set or angle still (route or worker) | `sga:<scene_generation_attempts.id>` | `job_id` = the `generation_jobs` id when the worker runs it, else NULL; `job_type`; `activation_id` for worker work |
| An angle video (worker) | `gjob:<generation_jobs.id>:video` | `job_id`, `job_type = generate_angle_video`, `activation_id` |
| A Claude call inside a worker job | `gjob:<generation_jobs.id>:claude:<step>` (step fixed by the job's code path, not a counter) | `job_id`, `activation_id` |
| `POST /scenes/:id/animate` (if ever enabled) | `scene-animate:<scene id>:<request id>` | caller class `api` |

- **One domain attempt, at most one sent permit.** A still's permits all share `sga:<attempt id>`, so a pre-send retry is `attempt` 2 of the same key, and a third permit after an unknown outcome is refused by the gateway itself.
- **The association needs no new column on `scene_generation_attempts`.** The key is derived from the attempt id; a permit is found from the attempt by key, and from the job by `job_id`. A link column (`aigw_permit_id`) is optional; if it is added later it must be write-once in the attempt guard (R4.9).
- **A user's confirmed regenerate** after an uncertain still is a **new** `scene_generation_attempts` row (it supersedes the old one, #3757 G1/G3), so it gets a new key. The old key's permit stays `unknown` until reconciled; the gateway never sees the second request as a retry of the first.

### R4.3 Activation budgets and limits

- **`worker_activations` (worker-specific, non-financial):** `id`, `job_ids`, `job_types`, `max_jobs`, `jobs_started`, `expires_at`, `basis` (S6), `status` (`active`, `exhausted`, `expired`, `revoked`), `approved_by`, `approved_at`, `deleted_at`. Immutable except the counter and status, by trigger (revision 3, D). At most one active row (partial unique index). **No money columns.**
- **The budget is a gateway object:** a gateway activation budget keyed by the same `activation_id` (budget in micro-dollars, expiry, status), created and closed only by `aigw_admin`. `aigw_authorize` refuses a `worker` caller unless `activation_id` names an open activation, and refuses when the activation's exposure (the sum over its permits: reserved + confirmed + uncertain) plus the estimate would pass its budget. M0 §10 already lists "activation budget" among the exposure limits; G2 stores `activation_id` on every permit but enforces nothing yet.
- **Existing gateway rules do the rest:** daily caps and the image cap (`CAP_UNAVAILABLE` when unset), Stop and pause, and **strict work needs a verified price** (`PRICE_NOT_VERIFIED`). Worker work is strict (M0 §10), so **Runway and every unpriced model stay refused** until a verified price exists (Q3). No price is invented.
- **Creation:** one admin step (`scripts/worker/activation.js create`, gated) writes the `worker_activations` row and opens the gateway budget under the same id, in that order. If the second step fails, the activation row is revoked by the same script; the worker refuses an activation whose gateway budget is not open, so a half-created activation can never run anything.
- **No API pause is needed for the first activation.** Revision 2's operational pause existed because the API and worker shared a non-atomic daily cap. With both going through the gateway, the daily cap is atomic under the day lock. (The gateway's pause stays available if Evoni wants one.)

### R4.4 Claim, fencing and crash recovery (the worker side)

- **Claim:** one transaction on the active `worker_activations` row (`FOR UPDATE`): status, expiry, `jobs_started < max_jobs`, the job id listed, the type allowed; then `jobs_started + 1` and the job claimed with `status = 'processing'`, `claim_token = gen_random_uuid()`, `activation_id`, with the existing `FOR UPDATE SKIP LOCKED` on the job.
- **Fencing:** every later job write is `WHERE id = :id AND claim_token = :mine AND status = 'processing'`; 0 rows means another process took over, and the worker stops that job without writing.
- **Single session:** the worker sets `application_name = 'episode-worker:<boot id>'`; recovery and claiming refuse while another live `episode-worker:*` session of the same role exists (`pg_stat_activity`, no extra grant).
- **Recovery never re-queues:** every `processing` job becomes `needs_reconciliation`, with a reason. Nothing is sent. Money state is recovered by the **gateway's** sweep (`aigw_sweep`: stale `dispatching` → `unknown`, expired `authorized` → `not_sent`), not by the worker.
- **A finished job is not re-run:** a job is never set back to `queued` by the worker, for any error. A pre-send failure of the whole job (nothing authorized) ends `failed`; anything after a permit was dispatched ends `needs_reconciliation` unless the gateway recorded a terminal outcome for every permit of the job.

### R4.5 Uncertain outcomes and reconciliation

1. **The gateway decides the money.** An `unknown` permit leaves that state only through `aigw_reconcile` (admin, evidence, reason). Its estimate stays counted as uncertain exposure until then (M0 §10), so it keeps consuming the daily cap and the activation budget.
2. **The domain follows the money, never the reverse:**
   - a still's attempt goes `dispatch_started` → `uncertain` (Scene Sets guards keep the set or angle out of `failed` and `pending`); a person regenerates only through the single-use confirmation (#3748 PR C), which creates a new attempt and a new key (R4.2);
   - a reconciled `succeeded` permit with the output known lets the asset be recovered (download only, no paid call) and the attempt end `stored`;
   - `failed_confirmed` with evidence ends the attempt `refused`, or lets a confirmed new attempt follow.
3. **The job follows both:** `scripts/worker/reconcile.js` (read-mostly, gated `--apply`) reads the job's permits (by `job_id`) and its scene attempts, and moves the job from `needs_reconciliation` to `completed` or `failed` only when every permit is terminal and every attempt is out of flight. It writes no money and calls no paid endpoint; a reconciliation of money is `aigw_reconcile`, done first.
4. **Retry evidence** is the gateway's alone: a permit `not_sent` (expiry, or the dispatching instance's `aigw_mark_not_forwarded` after a pre-send error class), or `failed_confirmed`. The worker's own classifier (`providerSubmitOutcome.classifySubmitError`) only decides what to report; it is never evidence by itself.

### R4.6 Why the angle video gets no Scene Sets attempt (and no new table)

- `scene_generation_attempts_one_in_flight` allows **one** attempt in flight per `(target_kind, target_id)`. A video attempt on target `angle` would block regenerating that angle's still for as long as the video runs (up to the 180 s poll), and an uncertain video would hold the angle's still workflow hostage.
- The target guard ties `complete` to a newly stored **image** column (G1), and the status guards (G2, G7) act on `generation_status`, which describes the still. The angle stays `complete` while its video is made (`generateAngleVideo`).
- `target_kind` is checked to `('set', 'angle')`; widening it means editing guard functions that already protect live rows.
- **The gateway already models the money of a video:** `runway.image_to_video` is in `aigw_operations`; `accepted` and `provider_succeeded` cover the asynchronous task; `aigw_find_by_task` finds it by Runway task id.

So the video's domain state stays on `generation_jobs` plus the angle's video fields, and its money in the gateway. **A separate video-attempt table is not necessary.** It would become necessary only if a video ever needed its own user-facing confirmation flow on the angle (as stills have); that is not proposed.

### R4.7 Partially completed database operations

Each step is its own short transaction (the gateway's rule R1: no transaction is held across a provider call). The order below makes every crash point recoverable without guessing:

| # | Step (one commit each) | If the process dies right after it |
|---|---|---|
| 1 | Domain: insert the still's attempt (`claimed`) and switch the target to it (`generating`) | An attempt `claimed` with no permit for its key. Recovery: `claimed` → `abandoned_unsent` (nothing can have been sent: no permit exists) |
| 2 | Gateway: `aigw_authorize` (key `sga:<id>`, attempt 1), budget reserved | The permit expires `authorized` → `not_sent` (sweep); the attempt goes `abandoned_unsent`; the reservation is released by the gateway |
| 3 | Domain: attempt `claimed` → `dispatch_started` | Permit still `authorized`, so nothing sent: it expires `not_sent`, and the attempt follows to `not_sent` |
| 4 | Gateway: `aigw_dispatch` (`authorized` → `dispatching`) | Possibly sent. The sweep makes the permit `unknown`; the attempt goes `uncertain`; the job `needs_reconciliation` |
| 5 | Send once; then `aigw_record_outcome` | Same as 4 until the outcome is recorded |
| 6 | Store the asset; attempt `stored` (or `stored_failed` with the provider URL kept); target `complete` | `stored_failed`: only the store is retried, never the generation (#3748) |
| 7 | Job: `completed`, under its claim token | A job `processing` with all permits terminal and its attempt `stored`. Recovery: `needs_reconciliation`, which reconciles to `completed` with no paid call |

- **The domain write always precedes the gateway authorization,** so a permit never exists without a domain record that names its key.
- **A refusal at step 2** (`STOPPED`, `SERVICE_PAUSED`, `CAP_UNAVAILABLE`, `PRICE_NOT_VERIFIED`, budget) ends the attempt `not_sent` and the job `failed` with the gateway's code. Nothing was sent.
- **For a video (or a Claude step)** there is no step 1, 3 or 6 on Scene Sets: the job's claim stands in for step 1, and the result is written to the job and the angle at step 7.

### R4.8 Stale-job approval checks

Unchanged from S6 in substance. `activation.js create` records each job's basis (set `updated_at`, a hash of the canonical description, the base still and its approval, the angle's `updated_at` and still, the event's existence). At claim time the worker recomputes it; any difference fails the job `STALE_BASIS` **before step 1 of R4.7**, so no attempt and no permit exist. A set busy with an attempt in flight is refused by the Scene Sets one-in-flight index and status guards themselves (`SET_BUSY`), which replaces revision 2's `generation_claim_job_id` column: **that column is dropped from the plan.**

### R4.9 Dependencies, migrations and rollback

**Order of dependencies:**
1. **#3737** (merged and corrected, R4.11): no blind Runway resubmits in either caller.
2. **Worker safety, step 3 (R4.10):** independent of the gateway; makes the stopped worker safe to start in a later phase.
3. **#3748 PR B, wired at the service level** (`generateBaseScene`, `generateAngle`, the variation path), so worker jobs and routes both write attempts and both pass the guards. Wired only in routes, a worker cascade would be refused by guard G7 while an attempt is in flight.
4. **Gateway G3** (server, sockets, forwarding, A1–A16) and **G4** (application and worker wiring, caller class `worker`), each verified.
5. **The gateway activation budget** (a gateway migration and conformance update), then **`worker_activations`** and `activation.js`.
6. **A verified price** for each model a first activation would use (gateway price catalogue); until then strict worker work is refused.
7. **Production facts, read-only, by Evoni:** disk free space, `generation_jobs` by status, the deployed commit, the pm2 cleanliness check (runbook §7).

**Migrations (each separately approved; all forward-only and additive):**
- `generation_jobs`: enum value `needs_reconciliation` (its own file, as #3757 did for `uncertain`); `claim_token UUID NULL`, `activation_id UUID NULL`. Rollback: the columns can be dropped by a down that refuses while any job is `needs_reconciliation`; the enum value cannot be dropped (it stays unused).
- `worker_activations` with `deleted_at`, its trigger and partial unique index. Rollback: down refuses while any row exists.
- **Gateway activation budget:** a new gateway table plus a replaced `aigw_authorize` (a SECURITY DEFINER function owned by the migration login). The in-memory reference ledger (`memoryLedger.js`) and the shared conformance contract must change in the same PR. Rollback: restoring the previous function body; down refuses while any open activation budget exists.
- **Not needed:** `worker_paid_calls`, `paid_generation_controls`, `worker_reconciliations`, `scene_sets.generation_claim_job_id`. An optional `scene_generation_attempts.aigw_permit_id` is not needed (R4.2); if ever added, the attempt guard must make it write-once in the same migration, or it would be the only unguarded evidence column.

**Compatibility risks to existing Scene Sets behaviour:**
- **Video guards read only `queued` and `processing`:** `refuseWhileVideoRuns` and the duplicate-click check in the angle video route (`sceneSetRoutes.js`) would let a new paid video start while an earlier job sits in `needs_reconciliation`. Step 3 must add `needs_reconciliation` to both (and to the set's job list, `GET /jobs/set/:setId`).
- **Readers of job status** must map `needs_reconciliation` to a "check before retrying" state, never to `failed` with a Regenerate button.
- **The Scene Sets guards stay inert** until #3748 PR B sets `current_attempt_id`; nothing above changes that.
- **Deployment state is unknown** for #3735, #3746 and #3757; none of them is active until wired, so this ordering holds whichever are live.

### R4.10 Step 3 (designed, not approved): worker safety with no money involved

Purpose: remove the activation blocker named in M0 §13, #3737 and #3748 (the worker re-queues unknown outcomes), while the worker stays off and calls nothing.

1. **Migration:** `generation_jobs.status` gains `needs_reconciliation`; `claim_token`, `activation_id` (NULL until R4.3 exists).
2. **`recoverStuckJobs`:** `processing` → `needs_reconciliation` with the reason; never `queued`, never `failed`. Refuses (and the poll loop does not start) while another `episode-worker:*` session is live.
3. **`claimNextJob`:** sets the claim token and `application_name`; later writes are fenced on it.
4. **`processJob` error path:** never `queued`. `ProviderOutcomeUnknownError` (or any error after a paid call may have started) → `needs_reconciliation`; an error before any paid call → `failed`. The cascade and angle clean-up that today runs only on a final failure moves accordingly.
5. **Routes:** the two video guards and the job list treat `needs_reconciliation` as blocking and visible.
6. **Tests (stubs only, the worker module loaded but not started):** recovery moves `processing` to `needs_reconciliation` with zero provider-stub calls; a second session refuses; a fenced write with a wrong token updates 0 rows; no error path re-queues; a `needs_reconciliation` video job blocks a new video request (409); the restricted-role test covers the new columns and the enum.
7. **Not in step 3:** activations, the gateway, any paid call, any switch change. `GENERATION_WORKER_ENABLED` stays off.

### R4.11 #3737 review (read-only, 2026-11-09, head `cde74e9e`)

**What it protects, confirmed from its diff:**
- **The latent animate endpoint:** behind `SCENE_ANIMATE_ENABLED` (exactly `true`, default off; 503 `ANIMATE_DISABLED` before anything is read), `aiRateLimiter`, sources limited to images recorded on the scene, validated inputs, `runImageCall` (budget gate and one usage row), and no resubmit after an ambiguous send. It also **exports `startImageToVideo`**, which makes the route reachable for the first time; the default-off switch is what keeps it inert, so the two must ship together.
- **The worker's Runway path** (`generateAngleVideo`): one send after a timeout, reset, 429 or 5xx (today up to three); `pollTask` reports `UNKNOWN` instead of `FAILED`; a poll that ends unknown throws `PROVIDER_OUTCOME_UNKNOWN` with the task id. **Not covered** (as #3737 says): the worker still re-queues that error; step 3 closes it.

**Compatibility with the gateway:** compatible in direction. Its "send again only on `ENOTFOUND`, `EAI_AGAIN`, `ECONNREFUSED`" rule is the gateway's pre-send rule (`aigw_mark_not_forwarded`), and the task id it carries is what `aigw_find_by_task` needs. Once G4 routes Runway through the gateway, the retry decision moves to the permit; `startImageToVideo`'s own loop then sees only the gateway's answer.

**Blockers found before it can merge (not fixed; #3737 is not modified):**
1. **A divergent copy of the outcome rules.** `main` now has `src/services/providerSubmitOutcome.js` (#3742), the shared classifier, which treats **408 and 429** as unknown (`AMBIGUOUS_4XX`, Evoni 2026-11-08). #3737 defines its own `classifySubmitError`, `ProviderOutcomeUnknownError` and `NOT_SENT_ERROR_CODES` inside `sceneGenerationService.js`, in which **a Runway 408 is a definitive failure.** Merged as it stands, the file would hold two classifiers with different rules and two error classes. #3737 should use the shared module (extended with an optional `taskId`), not a copy.
2. **Merge conflicts** in `.env.example` and `.env.production.template` (both sides added lines). `sceneGenerationService.js` merges cleanly and parses.
3. **Unpriced Runway:** with animate switched on, `runImageCall` logs Runway unpriced, so the daily cap counts nothing for it; the rate limiter is the only bound. That is a reason to keep the switch off until a verified price exists, not a code defect in #3737.

### R4.12 Open decisions

1. **Where the activation budget lives:** a new gateway table (recommended, R4.3), or `activation_id` budgets inside `aigw_control`'s caps.
2. **Whether a pause is wanted during first activations** anyway (the gateway's pause), although the atomic daily cap no longer requires it.
3. **#3737:** approve a narrow correction to use `providerSubmitOutcome` (with `taskId`) and resolve the `.env` conflicts, then review for merge with the switch off.
4. **Job-status presentation:** how the Scene Sets UI shows `needs_reconciliation` (a "check before retrying" state).
5. **Who reconciles, with what evidence:** the gateway's G2 dependency 4 (admin-only provider status reads), shared by API and worker.
