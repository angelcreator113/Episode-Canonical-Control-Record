| **PRIME STUDIOS** **F-AUTH-1 — FEED GENERATION AND THE SCHEDULER'S SETTINGS ARE AN ADMIN'S (AMENDMENT)** *Two routes that generate Feed creators with paid AI calls, and the route that sets the Feed scheduler's interval, batch size and switches, answered any signed-in account. By Evoni's decision of 2026-11-22 they need a sign-in in the admin group, checked before the rate limiter. The settings route also refuses an interval or batch size outside stated limits, whole. The spark preview stays any signed-in account's.* |
| --- |

**Document version**

v1.0. This is an additive amendment, written as a new file because the register is append-only. **Mints nothing.**
- The FD tail, XK tail and PE tail are unchanged.
- No earlier register file is edited, and no banner is added to one.

**Basis:** `origin/main` at `9d69c06c976865c93b16185ae1c8f8beec8757eb` (2026-11-22), plus branch `claude/feed-scheduler-admin`.

**Author:** Claude, with Evoni (JustAWomanInHerPrime), Prime Studios.

**Status:** amendment, on Evoni's word in the session of 2026-11-22. Merging this file with the change it describes is her approval of the text.

**Standings used:** RULED (her words in §2); MEASURED (the repository reads in §1 and §3, each with its command or its `file:line` at the basis); JUDGEMENT (a number the evidence did not settle, marked where used and put to Evoni).

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

| Key | Allowed | Evidence | Standing |
| --- | --- | --- | --- |
| `batch_size` | a whole number, 1 to 20 | The Automation panel's select offers `[1,2,3,5,8,10,15,20]` and nothing else (`frontend/src/pages/feed/FeedViews.jsx:616`); the three routes that take a count cap it at 20 (`src/routes/feedSchedulerRoutes.js:177`, `:234`, `:414`, "max 20 per request"); the default is 5 (`src/services/feedScheduler.js:193`). No caller, test or document uses a value above 20 or a fraction. | MEASURED |
| `interval_hours`, lower | 1 | The default is 4 (`:192`); the server starts the scheduler at 4 (`src/app.js:770`); the code's comment and the reads name four hours and "6 cycles/day" (`:1237`; `docs/reads/2026-11-04-pulse-social-simulation-audit.md:26`). **No page sets the interval**: the panel only shows it (`FeedViews.jsx:544`), and no document names a valid range. The existing unit tests set 1 and 2 (`tests/unit/services/feedScheduler.test.js`, "should recalculate interval", "should restart interval timer"). One hour is the smallest value anything in the repository uses. | **JUDGEMENT** |
| `interval_hours`, upper | 168 (one week) | Her words ask for a minimum. An upper bound is needed for the minimum to hold: Node's `setInterval` treats a delay above 2^31-1 ms (about 596.5 hours) as 1 ms, so a very large interval would run cycles continuously. Any bound at or under 596 closes that; one week is the choice. | **JUDGEMENT** |

**Put to Evoni:** the lower bound of one hour is the conservative reading that breaks no existing caller or test. Nothing in the repository shows an intended interval under four hours outside those two unit tests, so four may be what she wants. Raising the bound is a one-number change (`CONFIG_LIMITS.interval_hours.min`) and two unit tests' values.

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

# §4. What this amendment does not cover

- **The generation-cap check's order.** `auto-generate-job` checks the Feed cap and the provider before making a job; `auto-generate` checks the cap inside the batch. Reordering these is separate, by Evoni's word in §2. Not changed.
- **`preview-sparks`.** Unchanged, by her ruling. It makes two provider calls a request (a pre-flight check and the sparks), behind `aiRateLimiter` and the budget gate, for any signed-in account. Where `ADMIN_WRITE_GUARD` is enforcing, that guard refuses a non-admin's `POST` before the route; this amendment does not change the guard or rely on it.
- **What an over-budget request answers.** The budget gate refuses each provider call. `auto-generate` then answers 200 with `created: 0` and one error a profile; `auto-generate-job` answers 503 from its pre-flight check. Neither answers 429. That is as it was, and is not changed.
- **`POST /start`'s interval.** It takes `interval_hours` from the request (`src/routes/feedSchedulerRoutes.js:95` at the basis) and `startScheduler` uses it unchecked. It is an ADMIN's already and works only where `FEED_SCHEDULER_ENABLED` is `true`. The page sends no body. Recorded for a separate decision; not changed.
- **The settings' other keys.** `finalize_threshold` and `cross_threshold` are still set through `Number(v)` with no bounds, and the six `auto_*_enabled` switches take whatever is sent. They are an ADMIN's now. Not bounded here.
- **The other scheduler agents' calls.** Which of the six agents make paid calls beyond auto-fill's sparks and profiles (through `autoAssignAllFollowers`, `autoLinkRelationships` or otherwise) was not traced.
- **Server values.** `AI_DAILY_BUDGET_USD`, `FEED_SCHEDULER_ENABLED` and `ADMIN_WRITE_GUARD` on any server are not known and not relied on. `FEED_SCHEDULER_ENABLED`'s handling is not changed.
- **The settings are in process memory only.** They are not stored and are lost on a restart. Not changed.
- **Indirect location creation.** Places made through events and stories are unchanged, and recorded for separate review: the case-insensitive dedupe of story locations; whether the AI rate limit covers draft-event generation; high-volume draft-event creation and its effect on the World Location deletion rule.
- **The scheduler, the queue, the limiter, the budget.** No new permission, budget, queue or scheduler system. The cycle, the job implementation, `aiCostTracker` and `aiRateLimiter` are as they were.
- **Reads.** No `GET` is changed: status, events, history, config and layer-status stay any signed-in account's.
- **Stored data.** No row is changed or removed. No migration.
- **Deployment.** This amendment records a change to the repository. It says nothing about what is running on any server.

---

**Type:** amendment.
**Rules:** `POST /feed-scheduler/auto-generate`, `POST /feed-scheduler/auto-generate-job` and `PUT /feed-scheduler/config` are an ADMIN's, the check ahead of the rate limiter; `PUT /config` refuses `interval_hours` outside 1 to 168 and `batch_size` outside the whole numbers 1 to 20, whole; `POST /feed-scheduler/preview-sparks` stays a signed-in account's; on Evoni's words in §2. **Mints:** nothing (no FD, XK or PE number). **Discharges:** nothing.
**Host/AWS/DB/Cognito contact (this session):** the tests ran against a local PostgreSQL scratch database in the session's own container. No deployed host or database was contacted, no provider was called, and no scheduler was started.
**Production standing:** as the newest Fix Plan revision states it (`F-Deploy-1_Fix_Plan_v1.56.md`, footer). What an agent session may do in production is set by `CLAUDE.md` and `F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`.
