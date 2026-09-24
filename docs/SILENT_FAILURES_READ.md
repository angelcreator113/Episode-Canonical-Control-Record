# Silent failures — a read, not a ruling

## Status of this document

**Read-only research, not a decision.** This file is not under `docs/audit/` and rules nothing. It
explains why four failures this week left Evoni without a usable log line, counts the patterns
behind them, and says why the project's two guards (`scripts/lint-silent-catches.sh` and ESLint)
did not flag them. The goal is that any widening of the guards rests on evidence. This read changes
no code, lint script or ESLint config. It contacts no host and reads no server log.

Every claim is **MEASURED** (a repository read anyone can repeat, with a file:line) unless it is
marked **INFERRED** or **ATTESTED** (Evoni's report). Nothing is RULED.

Basis for the file:line citations: `origin/main` at `eddf0d1ac21e2166349954afd803411e40f02f1a`
(2026-09-24). Line numbers drift. The function and route names are the stable part.

Task: #1809.

---

## 0. Summary: class (e) first

**Class (e) is not the cause. A logging global handler exists.**

- **A logging global error handler exists.** `errorHandler` (`src/middleware/errorHandler.js:101`)
  is mounted last (`src/app.js:1741`). Its first act is `logError(err, req)` (line 103).
  - `logError` (lines 257-283) writes `console.warn('API Error:', …)` below 500 and
    `console.error('Internal Error:', …)` otherwise, with method, path, userId, name, message and
    code. In production the stack is dropped (271-274).
  - Express is 5.2.1 (`package.json` `"express": "^5.2.1"`, installed 5.2.1, router 2.2.0), so a
    rejected promise in an async handler reaches `errorHandler`.
  - **MEASURED:** a route handler without try/catch that throws is logged to PM2's `error.log`
    and answered with a 500.
- **Class (e) count:** 28 of 1089 inline route handlers have no try/catch. Only 2 of the 28 are
  async. Another 215 of 224 `asyncHandler(...)`-wrapped handlers have no try/catch, and
  `asyncHandler` forwards to `errorHandler`. All of these are logged. (92 handlers that point to a
  controller method were not scanned; see §5.)
- **The real cause has two parts.**
  1. **Handlers that catch the error themselves and answer without logging.** There are 309 route
     catches that send an error response and log nothing (class d). There are also 213
     comment-only catches (a), 212 silent fallbacks (b), and 2 catches that log the wrong error (c).
  2. **Production has no request logger.** The only per-request logger is dev-only
     (`src/app.js:209`, `if (process.env.NODE_ENV !== 'production')`). winston is a dependency but is
     never required in `src/`. So a request whose handler answers 500 without logging leaves
     **nothing** in `error.log` or `out.log`.
- **Reframing the question in #1809 (INFERRED).** The fix is not "add the missing logger" in the
  sense of a missing global error handler, because that handler exists and logs. Most catches
  simply never reach it: they answer the request themselves. Two framings remain open for Evoni
  (§7): "find the bad catches", or "add a per-request log line", so that every 5xx leaves at least
  a method, path and status whoever answered it.

---

## 1. `POST /social-profiles/:id/regenerate`: 500 with no log line

**ATTESTED (Evoni)** in `docs/audit/F-Deploy-1_Deploy_Afternoon_Evening_2026-09-24.md` §13: the
route returned 500 in the browser for profile 444, and neither the error log nor the out log
recorded it.

The route is `src/routes/socialProfileRoutes.js:1540`:
`router.post('/:id/regenerate', requireAuth, aiRateLimiter, guardJustAWomanRecord, async (req, res) => {`.

### 1.1 Every path that returns an error, and whether it logs (MEASURED)

**Middleware:**

| Path | Status | Logged? |
|---|---|---|
| `requireAuth` (`src/middleware/auth.js:566`): no header or bad format (569, 581) | 401 | No |
| `requireAuth`: auth config missing (`respondToAuthConfigError`, 355) | 500 | Yes, `console.error` `[F-Auth-2]` |
| `requireAuth`: Cognito unreachable (610) | 503 | Yes, `console.error` |
| `requireAuth`: token rejected (627) | 401 | `console.log` only (out.log) |
| `aiRateLimiter` (`src/middleware/aiRateLimiter.js`, express-rate-limit) | 429 | No |
| `guardJustAWomanRecord` (`socialProfileRoutes.js:60-71`): locked record | 403 | No |
| `guardJustAWomanRecord`: DB error, `.catch(next)` | via `errorHandler` | Yes |

**Handler:**

| Path | Line | Status | Logged? |
|---|---|---|---|
| `checkRateLimit` (defined at 273-289) | 1541 | 429 | No |
| Profile not found | 1545 | 404 | No |
| `if (!rawText) return res.status(500).json({ error: 'AI returned empty response. Try again.' })` | 1570-1571 | **500** | **No** |
| `JSON.parse(rawText.replace(/```json\|```/g, '').trim())` fails → `catch { return res.status(500).json({ error: 'Regeneration failed to parse. Try again.' }); }` | 1575-1578 | **500** | **No** |
| Anthropic API error, budget block (`aiCostTracker`), `profile.update`, or the final `findByPk` → outer `catch (err) { console.error('Social profile regeneration error:', err); … }` | 1639-1641 | 500 | Yes |
| `db` resolution throwing before the `try` (1542) | — | via `errorHandler` | Yes |

Only two paths return 500 without logging: the empty-response branch (1571) and the parse-failure
catch (1577).

### 1.2 The most likely path (INFERRED)

The parse-failure catch at **1577** is the most likely path. For it to be the one, a reply had to
come back with text that `JSON.parse` could not read. The likeliest way that happens here:

- **Truncation at `max_tokens`.** The call sets `max_tokens: 6000` (1565) for a JSON profile of
  40+ fields with arrays. The reply's `stop_reason` is never checked: `stop_reason` appears
  0 times in `socialProfileRoutes.js`. A reply cut off at 6000 tokens is unterminated JSON, which
  reaches `JSON.parse`, throws, and is answered with an unlogged 500. (MEASURED that nothing
  checks; INFERRED that truncation occurred. Neither the reply nor its length was recorded.)
- **Other ways to reach 1577:** prose before or after the JSON, or a fence other than
  ```` ```json ````. The regex strips only the fences, not surrounding text.
- **Why "no log line" rules out the other 500s:** each of them logs (1.1), and production writes
  no per-request line (§0), so an unlogged 500 can only be 1571 or 1577. 1571 needs a reply with
  no text in its first content block, which is unlikely for a plain text request (INFERRED).

**A retry can replay the same failure (INFERRED, conditional).**
- `src/services/aiResponseCache.js` patches `Messages.prototype.create` (loaded at `src/app.js:21`),
  so it applies to the route's plain `new Anthropic(...)` client (`socialProfileRoutes.js:27`).
- It caches any call without `temperature > 0.3` (`shouldCache`, 67-75). This call sets no
  temperature.
- It stores any reply that has content, including its `stop_reason`, whether or not the reply was
  truncated (161-170).
- The key is model, system, messages and max_tokens (`buildCacheKey`, 50-61), and the TTL is 1 hour
  for `max_tokens` above 2000 (`getTTL`, 42-48).
- **So, if Redis is reachable in production** (not read here), retrying regenerate with the same
  handle, platform, vibe and context gets the same cached text back, and the same unlogged 500,
  for up to an hour. If Redis is not reachable, the cache is skipped silently (its read and write
  catches log nothing).

### 1.3 What one log line would have told Evoni (INFERRED)

A line such as `console.error('[regenerate] parse failed', profileId, response.stop_reason,
rawText.length, response.usage?.output_tokens, response._fromCache)` would have shown:
- whether the reply was truncated (`stop_reason: 'max_tokens'`, output tokens at 6000);
- whether it was a cache replay;
- which profile it was.

That separates "raise max_tokens" from "the model wrapped the JSON" from "clear the cache key" in
one read.

---

## 2. `ensureVenueLocation`: a catch that logs the wrong error

`src/services/eventAutomationService.js`, `ensureVenueLocation`, lines 301-328 (MEASURED):

```js
  } catch (err) {                       // 315: first create failed
    // Try minimal create if some columns don't exist
    try {
      … await WorldLocation.create({ id, name: venueName, location_type: 'venue' });
      return location;
    } catch {                           // 325: second create failed; no binding
      console.warn('[EventAutomation] Failed to auto-create venue:', err.message);  // outer err
      return null;
    }
  }
```

- **Confirmed.** `err` is bound by the outer catch (315), so it is in scope. There is no
  ReferenceError, and `no-undef` was right not to fire. (Corrects my earlier report; corrections
  were posted on #1799 and #1796.)
- When both creates fail, the log shows the **first** failure. The second failure, which is the
  one that decided the outcome, is discarded.
- **The pattern (class c): a catch that logs, but logs the wrong thing.** It is worse than silence
  in one respect: the log line looks complete, so it is believed. If the minimal create failed for
  a different reason (a constraint, a connection), the log points at the wrong cause.
- The census found one other instance: `src/services/scriptsService.js:85`. The inner `catch {`
  logs the outer `error.message` and returns `[]`, so the fallback query's error is lost.

## 3. The cross route: `WorldTimelineEvent` create

`src/routes/socialProfileRoutes.js`, `POST /:id/cross` (route at 1360), lines 1411-1419 (MEASURED):

```js
    try {
      await db.WorldTimelineEvent.create({ … });
    } catch { /* WorldTimelineEvent table may not exist yet */ }
```

- **Confirmed silent.** Any failure (missing table, a validation error, a connection error) is
  discarded, and the crossing reports success without a timeline event.
- **Why `lint-silent-catches.sh` does not see it:** its empty-catch pattern is
  `grep -rn 'catch\s*{}'`, which needs `{` followed directly by `}`. A comment sits between them.
  None of the script's other patterns (`\.catch(() => {})`, `catch\s*\([_e]\)\s*\{\}`) apply. The
  exclusions (`JSON.parse`, `fs\.`, `unlinkSync`, `res\.write`, `client\.end`, and the file
  `VideoProcessingService.js`) play no part: the line fails the pattern before any exclusion runs.
- **Why ESLint does not see it:** see §6. `no-empty` treats a comment-only block as non-empty.

## 4. The relationship stage in `assembleGuestList`

- **Before #1801** (`git show b0274fd61^:src/services/eventAutomationService.js`, around line 411):
  `} catch { /* relationships table may not exist */ }`. It was introduced in `7b26f40e7` (#453)
  and replaced in `b0274fd61` (#1801).
- **What it swallowed (MEASURED from the code; INFERRED as to what failed in practice):** any
  error from the `SocialProfileRelationship.findAll` and related-profile `SocialProfile.findAll`
  lookups — a missing table, a bad column, a connection error. The event was then created with no
  related guests and no sign that the relationship stage had failed.
- **Now** (`eventAutomationService.js:429-432`): `catch (err) { … console.warn('[EventAutomation]
  Relationship-stage guest lookup failed:', err.message); }`.
- **Why neither guard flagged it:** the same reason as §3. It was comment-only, so the shell
  lint's `catch\s*{}` did not match and ESLint's `no-empty` skipped it.
- A side note for anyone searching history: `git log -S "relationships table may not exist"` does
  not list `b0274fd61`, because the new comment still contains that phrase (so the count of the
  string did not change). `git log -S "catch { /* relationships table may not exist */ }"` or
  `git log -G` finds it.

---

## 5. Census (MEASURED)

**Method.** Every `.js` file under `src/routes/` and `src/services/` was parsed with espree (the
parser ESLint uses), and the syntax tree was walked. There are 1642 catch clauses in routes and
501 in services. "Logs" means the catch contains a call to `console.*`, `logger.*`, `Logger.*`,
any `.error(…)` or `.warn(…)`, or a function whose name contains log, warn or report. The classes
below are not exclusive of each other. Counts are exact at the basis; the lists are the instances
cited, with the full per-line output reproducible from the method above.

### (e) Route handlers with no try/catch: 28 inline + 215 wrapped, all logged

| Handler type | Scanned | No try/catch | Where the error goes |
|---|---|---|---|
| Inline function | 1089 | 28 (2 async) | `errorHandler`: logged |
| `asyncHandler(...)`-wrapped | 224 | 215 | `asyncHandler` → `errorHandler` (`errorHandler.js:182-186`): logged |
| Controller reference (`ctrl.method`) | 92 | not scanned | — |

- **All 28 inline handlers:** `calendarRoutes.js:740`; `cfoAgentRoutes.js:104, 109, 114, 122, 128,
  133`; `feedSchedulerRoutes.js:45, 51, 64, 71, 76, 82, 90`; `jobs.js:15, 21, 27, 33, 39`;
  `memories/engine.js:4816 (async), 4860, 5058, 5085`; `propertyRoutes.js:38, 45`;
  `sceneSetRoutes.js:141, 2139 (async)`; `scenes.js:30`.
- **The 215 wrapped handlers by file:** episodes.js 71, scenes.js 33, wardrobe.js 20, processing.js
  11, metadata.js 10, scripts.js 10, thumbnails.js 10, sceneSetRoutes.js 10, others fewer (e.g.
  `animatic.js:24, 71, 99, 124, 156, 218`; `audio-clips.js:18, 19, 22`; `beats.js:17`).
- **Related:** 8 async inline handlers have an `await` outside any try block. Those awaits also
  fall to `errorHandler` and are logged: `amberDiagnosticRoutes.js:475`, `compositions.js:614`,
  `memories/engine.js:3029, 3211, 3862`, `socialProfileRoutes.js:2500`,
  `storyEvaluationRoutes.js:1522`, `worldStudio.js:2660`.
- **Other global handling:** `pdfIngestRoute.js:259` is a router-local error handler that returns
  413/400/415 **without logging** (otherwise `next(err)`). `notFoundHandler` (`app.js:1738`)
  returns 404 without logging. Unhandled rejections are logged twice (`app.js:112` and
  `server.js:101`), with Redis `ECONNREFUSED …6379` and "stopped reconnecting" suppressed in both.

### (d) Catch answers with an error response and logs nothing: 309, all in routes

- 304 are 5xx (or a computed status), 4 are 4xx, 1 is other.
- **By file:** socialProfileRoutes.js 36, worldStudio.js 33, worldEvents.js 26, tierFeatures.js 24,
  uiOverlayRoutes.js 23, upgradeRoutes.js 16, novelIntelligenceRoutes.js 10, others fewer.
- **All 36 in socialProfileRoutes.js:** 353, 1155, 1179, 1203, 1227, 1249, 1281, 1299, 1325, 1340,
  1353, 1440, 1487, 1533, **1577 ← hit this week (regenerate)**, 1680, 1694, 1712, 1787, 1834,
  1898, 1991, 2054, 2071, 2093, 2120, 2164, 2179, 2294, 2326, 2350, 2414, 2493, 2640, 2670, 2689.
- **Other examples:** `admin.js:42` (`catch (err) { res.status(500).json({ error: err.message }); }`),
  `aiUsageRoutes.js:302`, `amberDiagnosticRoutes.js:383, 409, 437, 469, 523, 539, 552, 568`,
  `arcRoutes.js:52, 77, 96, 115, 127, 163, 222`, `assets.js:845, 1347`, `auth.js:344`,
  `calendarRoutes.js:630`, `characterFollowRoutes.js:23, 36, 68, 138, 170, 185`,
  `characterGrowthRoute.js:166, 277, 364, 380`, `consciousness.js:277, 310, 452`.
- **Not in the class but the same effect:** unlogged 500s outside any catch, such as
  `socialProfileRoutes.js:347` and **1571 ← regenerate's empty-response branch**.
- Note (INFERRED): `err.message` sent to the client is often the only record of the error, and it
  lives only in the browser.

### (a) Empty or comment-only catch: 213 (routes 125, services 88)

- No literally empty `catch {}` remains. All 213 contain only a comment. 8 of them span several
  lines (e.g. `memories/assistant.js:963-965`, `scriptParse.js:116-118`).
- Promise form `.catch(() => {})`: 4, all in `src/services/VideoProcessingService.js:86, 110, 155,
  157`, a file the shell lint excludes.
- **By file:** worldEvents.js 23, storyHealth.js 16, episodeScriptWriterService.js 13,
  socialProfileRoutes.js 9, episodeCompletionService.js 8, others fewer.
- **Hit this week:** `socialProfileRoutes.js:1419` (cross route, §3); the old `assembleGuestList`
  relationship stage (§4, fixed by #1801).
- **Other examples:** `amberSessionRoutes.js:168, 179, 187` (`catch { /* silent */ }`),
  `characterAI.js:95, 109, 123, 131, 143, 157, 167`, `characterRegistry.js:20, 1204, 1527`,
  `episodes.js:936, 955`, `memories/engine.js:88, 3023, 3233, 3915, 4651`,
  `opportunityRoutes.js:197`, `sceneSetRoutes.js:501, 1605`, `aiCostTracker.js:351`,
  `aiResponseCache.js:172`, `episodeCompletionService.js:153, 170, 214, 221, 315`,
  `episodeGeneratorService.js:360, 473, 750, 774, 876`.

### (b) Logs nothing and returns a fallback: 212

- 152 catch blocks (routes 88, services 64) such as `catch { return null; }`, plus 60 promise
  `.catch(() => null | [] | {…})` (routes 30, services 30).
- A further 31 catches log nothing but do other work (push to a results array, retry a query).
  They are not counted here.
- **Catch examples:** `admin.js:14` (`catch { return null; }`), `characterAI.js:312, 614, 702,
  782`, `evaluation.js:39, 290`, `memories/engine.js:17, 22, 27, 131, 246, 1445, 2134, 4222, 4275`,
  `memories/stories.js:17, 928, 999, 1093`, `onboarding.js:149, 214`, `storyteller.js:34, 39`.
- **Promise examples:** `socialProfileRoutes.js:461, 473, 483`, `worldEvents.js:165, 184, 211, 219,
  275, 288`, `worldStudio.js:369, 1838, 3347`, `tierFeatures.js:74, 88, 275`,
  `episodeCompletionService.js:137, 174, 540, 548`, `distributionService.js:79, 87`.
- None of these is on a path Evoni reported this week (MEASURED against §§1-4).

### (c) Logs a different error than the one it caught: 2, both in services

- `src/services/eventAutomationService.js:325` (`ensureVenueLocation`) ← **on a path hit this week**
  (§2).
- `src/services/scriptsService.js:85` (§2).

---

## 6. Why the guards missed each class (MEASURED)

**`scripts/lint-silent-catches.sh`** scans `src/routes/ src/services/`, excluding the file
`VideoProcessingService.js`, with three greps:
1. `grep -rn '\.catch(() => {})'`
2. `grep -rn 'catch\s*{}' --include='*.js'`, then drops lines containing `JSON.parse`, `fs\.`,
   `unlinkSync`, `res\.write` or `client\.end`.
3. `grep -rn -P 'catch\s*\([_e]\)\s*\{\}'`, then drops `res\.write`.

It runs in CI (`.github/workflows/validate.yml:42`) and currently prints "No silent error handlers
found." Its header says it catches `.catch(() => null)`, but no pattern matches that.

**ESLint** (`.eslintrc.js`): `extends: ['eslint:recommended', 'prettier']` and
`'no-empty': ['error', { allowEmptyCatch: false }]` (line 30), relaxed for `src/migrations/**`
(line 51). Two gaps:
- `no-empty` returns early when the block contains a comment
  (`node_modules/eslint/lib/rules/no-empty.js:72`:
  `if (sourceCode.getCommentsInside(node).length > 0) return;`). A comment-only catch counts as
  non-empty by design.
- **ESLint does not run in CI.** `validate.yml` has no ESLint step. It runs only through
  `npm run lint`.

| Class | Shell lint | ESLint `no-empty` | What either would need (not proposed as a change here) |
|---|---|---|---|
| (a) comment-only | Misses: a comment sits between `{` and `}`; a named binding (`catch (err) {}`) or multi-line body also misses | Misses: comments make the block "non-empty"; also not in CI | A pattern that allows a comment between the braces (shell), or a syntax-tree rule that ignores comments; plus running it in CI |
| (b) silent fallback | Misses: looks only at empty bodies and `.catch(() => {})`, not `.catch(() => null)` | Misses: the body is non-empty | A rule that every catch body (and promise `.catch` callback) contains a log call or a rethrow |
| (c) wrong error | Misses: the body logs | Misses: the body is non-empty; `no-undef` correctly sees `err` as bound | A syntax-tree check that a nested catch logs its own binding, not an outer one |
| (d) error response without log | Misses: the body is non-empty | Misses | The "log or rethrow" rule above, or a per-request logger that makes it moot |
| (e) no try/catch | Not applicable | Not applicable | Nothing: `errorHandler` logs these |

A shell grep can reach (a) with a wider pattern, and `.catch(() => null|[]|{})` in (b). Classes (b)
in general, (c) and (d) need to know what a catch body contains, which a line-based grep cannot
do reliably (INFERRED). ESLint has no core rule that requires a catch to log. It would need a
custom rule, a plugin, or `no-restricted-syntax` selectors (INFERRED).

---

## 7. Open questions for Evoni

1. **Which classes to forbid?**
   - (A) (a) only: no comment-only catches; every catch logs.
   - (B) (a) + (c) + (d): every catch that swallows or answers an error logs it.
   - (C) All of (a)-(d), including silent fallbacks, with an allow-list comment for intentional
     ones (for example `// silent-ok: <reason>`).
   - (D) None by rule; fix the paths Evoni actually hits, as they are found.
2. **Which guard to widen?**
   - (A) The shell lint only: widen `catch\s*{}` to allow a comment, and add `.catch(() => null|[]|
     {…})`. This stays line-based and cannot see (c) or (d).
   - (B) ESLint: add a syntax-tree rule (custom or `no-restricted-syntax`) **and** add an ESLint step
     to CI, which it does not have today.
   - (C) Both, with the shell lint as the fast check.
3. **Should production log one line per request, or at least per 5xx?**
   - (A) Yes: a minimal `res.on('finish')` line for every status ≥ 500 (method, path, status, user,
     duration). Every unlogged 500 in (d) becomes visible without touching 309 catches.
   - (B) Yes, for every request (more volume in `out.log`).
   - (C) No: fix the catches instead.
   - Note: a logging global error *handler* already exists (§0), so the question is a per-request
     line, not the handler.
4. **Regenerate specifically:** check `stop_reason` (log it and fail clearly on `max_tokens`),
   raise `max_tokens`, and/or bypass the response cache (`_noCache`) for regenerate. One, some, or
   none?
5. **The two (c) instances** (`ensureVenueLocation`, `scriptsService.js:85`): fix now as a small
   issue, or fold into whichever rule question 1 picks?
6. **The shell lint's header** claims it catches `.catch(() => null)` and it does not. Correct the
   header, the pattern, or both, as part of question 2?

---

## Standing

MEASURED unless marked. INFERRED where marked (the likely regenerate path, truncation, cache
replay in production, what a log line would show, what each guard would need). ATTESTED: the
regenerate 500 with no log line (Evoni, deploy record §13). Nothing is RULED. This read changes no
code, lint script or ESLint config, contacts no host, database, AWS or Cognito, and reads no
server log.
