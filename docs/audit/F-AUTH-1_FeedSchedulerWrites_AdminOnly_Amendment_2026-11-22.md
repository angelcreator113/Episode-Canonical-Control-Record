| **PRIME STUDIOS** **F-AUTH-1 — FEED GENERATION AND THE SCHEDULER'S SETTINGS ARE AN ADMIN'S (AMENDMENT)** *Two routes that generate Feed creators with paid AI calls, and the route that sets the Feed scheduler's interval, batch size and switches, answered any signed-in account. By Evoni's decision of 2026-11-22 they need a sign-in in the admin group, checked before the rate limiter. The settings route also refuses an interval or batch size outside stated limits, whole, and the start route refuses an interval outside the same limits. The spark preview stays any signed-in account's.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `9d69c06c976865c93b16185ae1c8f8beec8757eb` (2026-11-22) for the reads of §1, plus branch `claude/feed-scheduler-admin`, into which `origin/main` at `006002c6a1ba34988de776863d190bff04d57c6c` is merged. Where a line number is given "on the branch" it is the branch's.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1, §3 and §4, each with its command or its `file:line`). The three limits were first put to her as judgements and are now RULED.

---

# §1. What is amended

## The routes as they stood (MEASURED)

```
$ git show origin/main:src/routes/feedSchedulerRoutes.js | grep -n "^router\.\|^const admin"
45:router.get('/status', requireAuth, (req, res) => {
51:router.get('/events', requireAuth, (req, res) => {
64:router.get('/history', requireAuth, (req, res) => {
71:router.get('/config', requireAuth, (req, res) => {
76:router.put('/config', requireAuth, (req, res) => {
84:const admin = [requireAuth, authorize(['ADMIN'])];
89:router.post('/start', ...admin, aiRateLimiter, (req, res) => {
101:router.post('/stop', ...admin, (req, res) => {
107:router.post('/run-now', ...admin, aiRateLimiter, async (req, res) => {
122:router.post('/fill-one', ...admin, aiRateLimiter, async (req, res) => {
145:router.get('/layer-status', requireAuth, async (req, res) => {
174:router.post('/auto-generate', requireAuth, aiRateLimiter, async (req, res) => {
231:router.post('/auto-generate-job', requireAuth, aiRateLimiter, async (req, res) => {
411:router.post('/preview-sparks', requireAuth, aiRateLimiter, async (req, res) => {
```

The router is mounted at `/api/v1/feed-scheduler` (`src/app.js:766`). `start`, `stop`, `run-now` and `fill-one` have carried the file's `admin` guard since SEC-4 (2026-10-29). Three writes did not:

| Route | `file:line` at the basis | Middleware at the basis | What a signed-in account in any group, or none, could do |
| --- | --- | --- | --- |
| `POST /auto-generate` | `src/routes/feedSchedulerRoutes.js:174` | `requireAuth, aiRateLimiter` | up to 20 creators a request (`:177`): one AI call for the sparks and one per profile, each profile written to `social_profiles` |
| `POST /auto-generate-job` | `:231` | `requireAuth, aiRateLimiter` | the same, as a background job: a `bulk_import_jobs` row, then the batch |
| `PUT /config` | `:76` | `requireAuth` | set any key of the scheduler's settings |

## The settings as they stood (MEASURED)

`updateConfig` (`src/services/feedScheduler.js:219-234` at the basis) set each known key to what was sent, a number key through `Number(v)`, with no bounds, and when `interval_hours` was sent it recalculated the interval and, if a timer was running, cleared it and made a new one on the new interval. So one request could:

- set `interval_hours` to any number, a fraction of a second included, and restart a running scheduler on it. A full cycle is the code's own estimate of $30-50 (`:1237`);
- set `batch_size` to any number. The auto-fill agent creates `Math.min(remaining, schedulerConfig.batch_size)` profiles a layer a cycle (`:254`); two other agents work through `batch_size * 2` and `batch_size * 3` rows.

The settings are an object in the server process's memory (`schedulerConfig`, `:190-202`). They are not stored: a restart returns them to the defaults.

## Why a sign-in alone was not enough

- Evoni's admin-only ruling of 2026-10-29 (`F-AUTH-1_RolesJs_XK-3_HoldLifted_Amendment_2026-10-29.md`: "Prime Studios is an admin-only production environment"), and SEC-4 of the same day for this router's other controls.
- The two generation routes spend money on every request and write shared profiles.
- **The write guard is not relied on.** `src/middleware/adminWriteGuard.js` refuses a non-admin's write only where `ADMIN_WRITE_GUARD` is set to do so. Not established: what that variable is set to on any server. A route that must be an ADMIN's carries the check itself.

# §2. The decisions (RULED)

Evoni, in the session of 2026-11-22:

> "Decision 1 — Feed Scheduler security PR AUTHORIZED. Create a separate, focused PR using the existing ADMIN middleware. Protect these three routes: POST /feed-scheduler/auto-generate; POST /feed-scheduler/auto-generate-job; PUT /feed-scheduler/config. Place the ADMIN check after authentication and before rate limiting, paid generation, job enqueueing or any mutation. Preserve the existing scheduler, AI budget gate, rate limiter, queue implementation and automation controls. Do not create another permission, budget, queue or scheduler system."

> "Configuration hardening — INCLUDE. Add server-side minimum interval and maximum batch-size validation. Before choosing the numerical boundaries, inspect the existing scheduler defaults, callers, constraints and documented valid settings. Use the narrowest limits compatible with intended ADMIN operations. Refuse invalid values without changing persisted configuration, in-memory configuration, timer state or scheduled jobs. Preserve valid ADMIN configuration updates and the existing timer-restart behavior. Do not change FEED_SCHEDULER_ENABLED or deploy configuration changes."

> "Generation-cap precheck — SEPARATE. Do not include the proposed cap-check reordering in this security PR."

> "APPROVED: Minimum interval: 1 hour. Maximum interval: 168 hours. Batch size: 1–20."

> "Before requesting #3929 merge approval, inspect POST /feed-scheduler/start and confirm whether it can bypass these limits. If it can, reuse the existing configuration validator to enforce the same interval bounds without changing legitimate start behavior. A rejected start must leave timer and configuration state unchanged. Add focused tests, update the PR head and rerun all seven checks. Do not create another scheduler service or validation system. Keep preview-sparks access unchanged."

> "Correct the documentation: the current after-generation count/check/insert sequence does NOT guarantee the cap under concurrency."

> "Record the auto-generate-job cancellation defect as separate future work. Do not implement cancellation under #3929 or the cap proposal."

> "Decision 2 — preview-sparks. Keep POST /feed-scheduler/preview-sparks sign-in accessible. Preserve its existing AI rate limit and budget protection. Verify in tests that it does not write shared profiles or scheduling configuration. If any guard is absent, report that before changing the route."

# §3. What the change does (MEASURED on the branch)

## The three routes

Each spreads the file's existing guard, `const admin = [requireAuth, authorize(['ADMIN'])];`, ahead of everything else in its chain, as `fill-one` and `run-now` do. The guard's definition is moved above `PUT /config` so that route can use it; its text is unchanged. No new role, group, middleware or membership check.

```
$ grep -n "^router\.\(post\|put\)\|^const admin" src/routes/feedSchedulerRoutes.js
```

| Route | Chain on the branch |
| --- | --- |
| `PUT /config` | `...admin, (req, res)` |
| `POST /auto-generate` | `...admin, aiRateLimiter, async (req, res)` |
| `POST /auto-generate-job` | `...admin, aiRateLimiter, async (req, res)` |
| `POST /preview-sparks` | `requireAuth, aiRateLimiter, async (req, res)` (unchanged) |

- **What a refusal carries.** No token: `requireAuth`'s 401. A signed-in account outside the admin group: `authorize`'s own 403, `{ error: 'Forbidden', message: 'User must be in one of these groups: ADMIN', code: 'AUTH_GROUP_REQUIRED' }`. It is sent before `aiRateLimiter` and before the handler, so the request is not counted against the AI rate limit, no AI call is made, no job is made, nothing is read or written, and the settings and the timer are untouched.
- **Unchanged for an admin.** The two generation handlers' bodies are not changed. `aiRateLimiter` is still in both chains, after the guard. `src/services/aiCostTracker.js` and `src/middleware/aiRateLimiter.js` are not changed.

## The settings' limits

`src/services/feedScheduler.js` gains `CONFIG_LIMITS`, `configRefusal(updates)` and a check at the top of `updateConfig`.

| Key | Allowed | What the repository shows | Standing |
| --- | --- | --- | --- |
| `batch_size` | a whole number, 1 to 20 | The Automation panel's select offers `[1,2,3,5,8,10,15,20]` and nothing else (`frontend/src/pages/feed/FeedViews.jsx:616`); the three routes that take a count cap it at 20; the default is 5. | RULED: "Batch size: 1–20." |
| `interval_hours`, lower | 1 | The default is 4; the server starts the scheduler at 4 (`src/app.js:770`); no page sets the interval and no document names a valid range; the existing unit tests set 1 and 2. | RULED: "Minimum interval: 1 hour." |
| `interval_hours`, upper | 168 (one week) | Node's `setInterval` treats a delay above 2^31-1 ms (about 596.5 hours) as 1 ms, so a very large interval would run cycles continuously. | RULED: "Maximum interval: 168 hours." |

The two interval bounds were put to Evoni as judgements, the repository not settling them; she approved all three limits (§2).

**How a value is read.** A JSON number, or text that is only digits with an optional decimal part (at the basis the settings coerced `'15'` to 15, and a unit test holds that). Anything else is refused: other text (`'abc'`, `''`, `'NaN'`, `'Infinity'`, `'-4'`, `'1e3'`, `'0x10'`), `true` and `false`, arrays, objects, `NaN`, `Infinity`, zero, negatives, and for `batch_size` a fraction. A key sent as `null`, or not sent, is left as it is, as before; so is an unknown key.

**The refusal.** `configRefusal` reads the whole request and changes nothing. `PUT /config` asks it first and answers 400:

```
{ "success": false, "code": "INVALID_SCHEDULER_CONFIG",
  "error":   "interval_hours must be a number from 1 to 168. Nothing was changed.",
  "message": "interval_hours must be a number from 1 to 168. Nothing was changed.",
  "fields":  ["interval_hours"] }
```

(`batch_size must be a whole number from 1 to 20`; both sentences joined with `; ` when both are wrong.) The shape is the field refusal's of `src/routes/worldEvents/update.js`. `updateConfig` makes the same check before its first assignment and throws (`code`, `status: 400`, `fields`), so a caller that does not go through the route is refused too. On a refusal no key is set, the good keys of a mixed request included; `schedulerIntervalMs` is not recalculated; `clearInterval` and `setInterval` are not called, so a running timer keeps its handle and its next run.

**A valid update** is applied as before, including the restart of a running timer when `interval_hours` is sent.

## POST /start

**Could it pass the limits? Yes (MEASURED at the basis).** The route read `const intervalHours = req.body.interval_hours || null;` and passed it to `startScheduler` (`src/routes/feedSchedulerRoutes.js:95-96`), which, where `FEED_SCHEDULER_ENABLED` is `true`, set `schedulerConfig.interval_hours = intervalHours` and `schedulerIntervalMs = intervalHours * 60 * 60 * 1000` and made the timer on it (`src/services/feedScheduler.js:1246-1251`), with no check. An ADMIN's `POST /start` with `interval_hours: 0.001` would have run a cycle every 3.6 seconds. The route was an ADMIN's already (SEC-4).

What sets the interval or makes the timer, in all of `src/`: `updateConfig` (bounded above); `startScheduler`, called from `POST /start` and from the server's startup with the constant 4 (`src/app.js:770`, not in tests); nothing else. `runManualCycle` runs one cycle and touches neither.

**The change.** The same validator, no second one:

- `POST /start` (`...admin, aiRateLimiter`, unchanged) first asks `configRefusal({ interval_hours: req.body?.interval_hours })`. A value outside the limits is a 400 with the body of `PUT /config`'s refusal (`code: 'INVALID_SCHEDULER_CONFIG'`, `fields: ['interval_hours']`), before the `FEED_SCHEDULER_ENABLED` answer and before `startScheduler`.
- `startScheduler` makes the same check as its first statement (`assertConfigAllowed`, which `updateConfig` now calls too) and throws as `updateConfig` does, so a caller that does not go through the route is refused too. Nothing is set, no timer is cleared or made, and no first run is scheduled.
- **The order of answers on `POST /start`:** 401, 403, the rate limiter's 429, the 400 for an interval outside the limits, the 409 when the scheduler is switched off, then the start. A request with a valid interval, or none, is answered exactly as before, the 409 included.
- **Values.** As `PUT /config` reads them. No interval (absent or `null`) starts on the current one, as before. `0`, `''` and `false` were read as "no interval" (`|| null`) and are now refused as out of bounds. Digits-only text was passed through and stored as text; it is now stored as its number.

## The frontend (display only)

`frontend/src/pages/SocialProfileGenerator.jsx`: the auto-generate start (`runAutoGenerate`) and the settings save (`updateAutoConfig`) show "Only an admin can generate Feed creators or change the Feed automation settings." on a 403 with `AUTH_GROUP_REQUIRED` (`adminOnlyMessage` of `frontend/src/utils/authGroups.js`) in place of "Forbidden". A 400 shows the server's sentence, as the handler already showed `error`. The page does not know the user's groups (it has no `useAuth` or `isAdmin`), so no control is hidden: a signed-in account that is not an admin sees the same buttons and the sentence when it uses one. `POST /auto-generate` has no caller in the frontend.

## Tests

- New: `tests/integration/feedSchedulerAdmin.integration.test.js`, through the real app. The provider is doubled at the transport (global `fetch`), so the real SDK and the real cost tracker run and no request can leave the process; the scheduler's timers are doubled, so no cycle is scheduled or run.
  - The three routes, and `start`, `stop`, `run-now`, `fill-one`: signed out 401; a viewer, an editor and an account in no group 403 `AUTH_GROUP_REQUIRED`; no provider call, no model read or write, every counted table (`social_profiles`, `world_locations`, `bulk_import_jobs`, `social_profile_followers`, `social_profile_relationships`, `ai_usage_logs`) as it was, the settings and status equal before and after, no timer made or cleared. The refused answers carry the app write limiter's `RateLimit-Limit`, not `aiRateLimiter`'s, and a viewer past the AI limit is still answered 403, never 429.
  - An ADMIN: `auto-generate` and `auto-generate-job` answer as before, the profiles are written from the doubled provider's output, the job row is made and completes.
  - Budget and rate limit for an ADMIN: over the daily budget no provider call is made and no profile or job is written; past the AI rate limit the answer is 429 `AI_RATE_LIMITED`.
  - Settings: valid updates saved and shown by `GET /config`; the timer restart on an interval change; each kind of invalid value, and mixed requests, 400 with the settings, the timer and the tables as they were; the service refusing `NaN` and `Infinity` directly.
  - `preview-sparks`: a viewer, an editor and an account in no group get sparks; no profile, place, job, follower or relationship row is written and the settings are unchanged; over budget it makes no provider call.
- Changed, pins: `tests/unit/routes/feed-scheduler-tier-promotion.test.js` (the two generation routes and `PUT /config` now pinned to `...admin`; `preview-sparks` still pinned to `requireAuth, aiRateLimiter`; every `aiRateLimiter` after a sign-in or the guard). `tests/unit/routes/sec4-feed-scheduler-admin.test.js` (the three routes added to the 401/403 cases; an admin's `PUT /config`, and its 400).
- Added to: `tests/unit/services/feedScheduler.test.js` (the limits, without a database).
- New: `frontend/src/pages/SocialProfileGenerator.adminOnly.test.jsx`.
- `POST /start`, in the same integration file and in `tests/unit/services/feedScheduler.test.js`: for an ADMIN, each kind of invalid interval, with the scheduler stopped and running and with the server switch on and off, is a 400 with the settings and status as they were and no timer made or cleared; a valid interval and no interval start as before; the 409 when switched off is as before; `startScheduler` called directly refuses the same values; the startup call with 4 still starts.

# §4. What this amendment does not cover

- **The generation-cap check's order.** `auto-generate-job` checks the Feed cap and the provider before making a job; `auto-generate` checks the cap inside the batch. Reordering these is separate, by Evoni's word in §2. Not changed.
- **The Feed cap is not guaranteed under concurrency.** The cap is checked once before a batch (`autoGenerateBatch`, `src/services/feedScheduler.js:560` on the branch) and again for each profile after its paid call and before its insert (`generateAndSaveProfile`: the call at `:781`, the count at `:810`, the insert at `:921`). That count and that insert are separate statements, with no lock and no transaction. Two requests, jobs or cycles running together can each pass the count and insert, taking a layer past its cap; and a profile whose count finds the cap reached is discarded after its AI call was paid for. This change does not alter that. A separate design covers it and is not yet authorized. The code comment at the second check said it was there "to prevent race conditions between concurrent jobs"; its wording is corrected on this branch to say what the check does and does not do. No behaviour is changed by that.
- **`preview-sparks`.** Unchanged, by her ruling. It makes two provider calls a request (a pre-flight check and the sparks), behind `aiRateLimiter` and the budget gate, for any signed-in account. Where `ADMIN_WRITE_GUARD` is enforcing, that guard refuses a non-admin's `POST` before the route; this amendment does not change the guard or rely on it.
- **What an over-budget request answers.** The budget gate refuses each provider call. `auto-generate` then answers 200 with `created: 0` and one error a profile; `auto-generate-job` answers 503 from its pre-flight check. Neither answers 429. That is as it was, and is not changed.
- **`POST /start`'s other behaviour.** Only its interval is checked (§3). It still works only where `FEED_SCHEDULER_ENABLED` is `true`, and a start while running still replaces the timer and schedules a first run.
- **The settings' other keys.** `finalize_threshold` and `cross_threshold` are still set through `Number(v)` with no bounds, and the six `auto_*_enabled` switches take whatever is sent. They are an ADMIN's now. Not bounded here.
- **The other scheduler agents' calls.** Which of the six agents make paid calls beyond auto-fill's sparks and profiles (through `autoAssignAllFollowers`, `autoLinkRelationships` or otherwise) was not traced.
- **Server values.** `AI_DAILY_BUDGET_USD`, `FEED_SCHEDULER_ENABLED` and `ADMIN_WRITE_GUARD` on any server are not known and not relied on. `FEED_SCHEDULER_ENABLED`'s handling is not changed.
- **The settings are in process memory only.** They are not stored and are lost on a restart. Not changed.
- **Indirect location creation.** Places made through events and stories are unchanged, and recorded for separate review: the case-insensitive dedupe of story locations; whether the AI rate limit covers draft-event generation; high-volume draft-event creation and its effect on the World Location deletion rule.
- **Future work: cancelling an auto-generate job.** Recorded, not changed here, by Evoni's word in §2. `POST /api/v1/social-profiles/bulk/jobs/:id/cancel` (an ADMIN's, `src/routes/socialProfileBulkRoutes.js:813`) adds the job to that file's in-memory `cancelledJobs` set and sets the row's status to `cancelled` (`:826-827`). The auto-generate job's loop (`processAutoGenInBackground`, `src/routes/feedSchedulerRoutes.js:315` on the branch) reads the row's status once, before it starts (`:334`), never reads `cancelledJobs` or the status again, runs the whole batch, and then sets the status to `completed` (`:395-396`), over the `cancelled`. So a cancelled auto-generate job keeps generating and ends as completed. Likewise the streamed form of `POST /auto-generate` (`:200-222`) has no handler for the client going away: the batch runs to its end after a disconnect.
- **The scheduler, the queue, the limiter, the budget.** No new permission, budget, queue or scheduler system. The cycle, the job implementation, `aiCostTracker` and `aiRateLimiter` are as they were.
- **Reads.** No `GET` is changed: status, events, history, config and layer-status stay any signed-in account's.
- **Stored data.** No row is changed or removed. No migration.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server.

---

**Type:** amendment.
**Rules:** `POST /feed-scheduler/auto-generate`, `POST /feed-scheduler/auto-generate-job` and `PUT /feed-scheduler/config` are an ADMIN's, the check ahead of the rate limiter; `PUT /config` refuses `interval_hours` outside 1 to 168 and `batch_size` outside the whole numbers 1 to 20, whole; `POST /feed-scheduler/start` and `startScheduler` refuse an interval outside 1 to 168; `POST /feed-scheduler/preview-sparks` stays a signed-in account's; on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL scratch database in the session's own container. No deployed host or database was contacted, no provider was called, and no scheduler was started.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer). What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
