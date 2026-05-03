# F-AUTH-1 Fix-Planning Document

> **PRIME STUDIOS — F-AUTH-1 FIX-PLANNING DOCUMENT**
> First fix after audit close. Tier 0 keystone.
> Six-step coordinated single-PR plan.

**Document version:** v2.1 — Single-PR plan. Track 1 surfaced two new sub-tracks: 1.5 (frontend test scaffolding) + 1.6 (backend requireAuth split).

**Author:** JAWIHP / Evoni — Prime Studios

**Status:** G2 IN PROGRESS — Step 6a + Step 2 + Track 5 + Track 1 complete. Tracks 1.5 + 1.6 added per Track 1 surfaces.

> **Note:** This file is the markdown source-of-truth for tooling that cannot read `.docx`. The companion file `F-AUTH-1_Fix_Plan_v1.3.docx` in the same folder is the visual canon. If they diverge, the `.docx` is authoritative and the `.md` should be regenerated from it.

---

## 1. Executive Summary

F-AUTH-1 is a codebase-wide auth bypass on writes. It is the Tier 0 keystone in audit handoff v8 §4.1. Every other P0 fix re-deploys mutation routes; re-deploying mutation routes without auth ships the bug fix and the unauth surface together. v8 is explicit: **partial execution is worse than no change.** This plan ships all six steps in one coordinated PR.

> **Why this fix is one PR — not six**
>
> Steps 1–2 (F-Auth-2, F-Auth-3) harden the auth module itself. Steps 3–5 are the mechanical sweep across three sub-forms. Step 6 is the frontend coordination (sendBeacon + interceptor strings) that prevents silent 401s the moment the sweep lands. If sub-form (a) ships before sub-form (c), every episode-mutation surface still bypasses auth. If the sweep ships before CZ-5, BookEditor.jsx silently 401s on every beforeunload save. If the sweep ships before F-Auth-4 reconciliation, mid-session token refresh stops working. The six steps interlock.

### Scope summary

- Fix the codebase-wide auth bypass on writes by closing all three F-AUTH-1 sub-forms.
- Harden `middleware/auth.js` so misconfiguration is loud (boot-fail) and Cognito outages are distinguishable from anonymous traffic.
- Coordinate the frontend so requireAuth landing does not silently break mid-session refresh or beforeunload saves.
- Close F34 automatically (it is sub-form a inside `franchiseBrainRoutes.js`).
- Close F-Auth-5 (`req.user.sub` vs `req.user.id` drift) as a folded-in sub-step of Step 6.

### Out of scope (deferred)

- F-Auth-6 — `tokenUse` (access vs ID token) gating. Informs but does not block. Deferred to follow-up.
- Director Brain build (F-Franchise-1 resolution). Sequenced after F-AUTH-1 + structural prerequisites per Decision #94.
- Any of the 269 P0 correctness findings outside auth. Sequenced after Tier 0.

---

## 2. Keystone Precedence (why this is the first fix)

Prime Studios Audit Handoff v8 locks F-AUTH-1 as Tier 0. The reasoning, restated from §4.1 and §12 of v8: every other P0 fix touches mutation routes. Shipping a P0 fix to a route that still accepts unauthenticated writes ships the security exposure with the correctness fix. Therefore: **every correctness fix is blocked on auth.**

v8 also makes the partial-execution warning explicit (§4.1, end of recipe). Closing optionalAuth without fixing F-Auth-2 ships a server that silently 401s every authenticated request when env vars are missing. Closing the sweep without F-Auth-3 means a Cognito outage looks identical to anonymous traffic. Closing the sweep without CZ-5 means `BookEditor.jsx` beforeunload saves silently 401 on every page navigation. Closing the sweep without F-Auth-4 reconciliation means the frontend interceptor cannot distinguish `AUTH_REQUIRED` from `AUTH_INVALID_TOKEN` and mid-session refresh degrades silently.

> **F34 disposition**
>
> F34 (unauthenticated destructive writes on `/franchise-brain/*`) was hotfix-offered May 1, 2026 and DECLINED to maintain audit discipline (Decision #34). v8 reaffirms: F34 closes automatically inside Step 3 (sub-form a) of this plan. No separate F34 hotfix ships. The exposure window is being closed, not patched around.

---

## 3. The Six Steps

All six steps land in a single PR. Each step has its own §4.x detail section below. The steps are listed here in dependency order; the implementation order is given in §5.

| # | Finding | What it does | Surface |
|---|---|---|---|
| **1** | **F-Auth-2** | Throw at module load if Cognito env vars are absent. Boot-fail beats silent 401s on every authenticated request. | `middleware/auth.js:13–22, :44–46` |
| **2** | **F-Auth-3** | Distinguish "Cognito down" from "anonymous user" in optionalAuth. Stop swallowing all errors. Add an alarm signal. | `middleware/auth.js:164–168` |
| **3** | **Sweep (a)** | Replace optionalAuth → requireAuth on every write route currently using optionalAuth. F34 closes here. | `app.js:364` + per-route |
| **4** | **Sweep (b)** | Add requireAuth to write routes with NO auth middleware declaration at all. | `outfitSets.js` + `episodes.js:101/109/117` |
| **5** | **Sweep (c)** | Replace optionalAuth → requireAuth on episode-mutation routes that explicitly declare optionalAuth. | `episodeOrchestrationRoute.js:135` |
| **6** | **CZ-5 + F-Auth-4 + F-Auth-5** | Migrate sendBeacon → fetch+keepalive. Reconcile requireAuth/authenticateToken duplication with frontend interceptor. Close `req.user.sub`/`req.user.id` drift. | `BookEditor.jsx:173–186` + `middleware/auth.js:256–293` + `decisionLogs.js:22` |

---

## 4. Step Details

### 4.1 Step 1 — F-Auth-2: Boot-fail on missing Cognito env vars

#### Current behavior

`middleware/auth.js:13–22` constructs Cognito ID-token and access-token verifier objects at `require()` time using `process.env.COGNITO_USER_POOL_ID || 'us-east-1_XXXXXXXXX'` and `process.env.COGNITO_CLIENT_ID || 'xxxxxxxxxxxxxxxxxxxxxxxxxx'`. The runtime check at lines 44–46 only fires *inside* `verifyToken` — it does not fire at boot. A misconfigured deploy with missing env vars produces a server that boots cleanly and 401s every authenticated request with a generic "Token verification failed" error and no diagnostic hint that env vars are absent.

#### Why it must ship before the sweep

- Once Steps 3–5 land, every write route requires a valid token. If a deploy is missing Cognito env vars, those routes 401 silently with no operator-visible cause.
- The placeholder verifier objects make the failure mode look like a token problem, not an env-var problem. Triage gets pointed at the wrong layer.

#### Fix

- Add a top-of-module check in `middleware/auth.js` that throws if either `COGNITO_USER_POOL_ID` or `COGNITO_CLIENT_ID` is undefined or matches the placeholder string.
- The throw must happen at `require()` time, before the verifier objects are constructed.
- Throw text must name the missing variable explicitly so deploy logs make the cause obvious.
- Remove the placeholder fallback strings entirely once the throw is in place — they exist only to defer the failure to runtime.

#### Verification

1. Boot the app locally with both env vars unset → expect immediate startup failure with a named error.
2. Boot with one env var set, one unset → expect immediate startup failure naming the missing variable.
3. Boot with both env vars set to real values → expect normal startup.

#### Risk

- A dev or prod environment that was running on placeholder values breaks immediately on first deploy of this PR. Mitigation: env vars confirmed in pre-flight (§5.1) — dev and prod both verified at G1.

---

### 4.2 Step 2 — F-Auth-3: Distinguish Cognito-down from anonymous

#### Current behavior

`middleware/auth.js:164–168` — optionalAuth swallows **all** errors and sets `req.user = null` with a `console.warn`. Routes that gate behavior on `req.user` (`characterDepthRoutes:88` isAuthor, characterRegistry author-only field gate `~600`) silently degrade to the unauthenticated path during a Cognito outage. No alarm fires. Response codes are identical to legitimate anonymous traffic. This is a service-availability finding, not just security.

#### Why it must ship with the sweep

- Once requireAuth replaces optionalAuth on writes, the failure mode for those routes becomes 401-on-Cognito-outage instead of silent-degradation. That is correct.
- But routes that legitimately remain on optionalAuth (genuine read-where-auth-is-optional) still need to differentiate "no token" from "Cognito broken" so the gating logic does not silently flip during outages.

#### Fix

- In `optionalAuth`, catch token-verification errors separately from "no Authorization header" and "header but verifier rejected as invalid token".
- Preserve the underlying verifier error via `Error.cause` when `verifyToken` rethrows. Without this preservation, the inner aws-jwt-verify error class is lost and `optionalAuth` cannot classify the failure mode. Detection in the classifier should match by `error.name` and `error.code` (not `instanceof`) to survive bundler/module-loading edge cases. (Confirmed during Step 2 implementation; recorded here so Step 6b reconciliation does not undo it.)
- On verifier-throws-unexpected-error (Cognito timeout, DNS failure, JWKS unreachable): log at error level with a structured grep-friendly format, and return 503 with code `AUTH_SERVICE_UNAVAILABLE` — do **NOT** silently degrade to `req.user = null`. **EXCEPTION:** the `degradeOnInfraFailure` flag (see below).
- On no-Authorization-header: `req.user = null` is correct, no log needed.
- On invalid-token: `req.user = null` with a quiet log (use `console.log("[F-Auth-3] optionalAuth: token rejected", …)` — codebase ESLint config forbids `console.debug`; do not add lint suppressions or new dep).

#### `degradeOnInfraFailure` flag (v1.6 amendment)

Step 2 implementation surfaced a real edge case: a few `optionalAuth` routes are genuine public reads (`manuscript-export.js`, `press.js` per pre-flight §7.2 exemption list) that do NOT read `req.user` at all. For those routes, returning 503 during a Cognito outage is a regression — anonymous users would no longer be able to read the press kit or download a published manuscript just because the auth service is degraded. Public-read availability should not be coupled to auth-service health.

**Resolution: `optionalAuth` accepts an options object with a `degradeOnInfraFailure` boolean.**

- **Default: `false`.** Preserves the strict §4.2 behavior — Cognito outage returns 503 instead of silently degrading to anonymous. This is correct for routes that gate on `req.user` (most current optionalAuth users) because silent degradation hides the failure.
- **When `degradeOnInfraFailure: true`:** Cognito outage falls back to `req.user = null` and continues. The structured error log still fires (visibility preserved); only the 503 response is suppressed.
- **Usage:** routes pass the option at mount time, e.g., `router.get('/path', optionalAuth({ degradeOnInfraFailure: true }), handler)`.
- Step 3 sweep applies this option to the genuine-public-read exemption list (the routes pre-flight §7.2 tagged for `// PUBLIC:` comments). All other optionalAuth-using routes get the default behavior (503 on outage).
- Pre-flight §7.2 exemption list maps directly: `pageContent.js` GETs (already correct under default), `manuscript-export.js` GETs (need `degradeOnInfraFailure: true`), `press.js` GETs (need `degradeOnInfraFailure: true`). Other routes pre-flight surfaced as candidates remain default (strict 503) unless their route file explicitly justifies the flag with a `// PUBLIC:` comment.

#### Metric mechanism — DECIDED

Pre-flight confirmed Prime Studios has **no metrics library** in the codebase (no prom-client, statsd, opentelemetry, or in-house helper). Adding one mid-PR is scope creep. **Decision:** use a stable, grep-friendly structured log line in the format:

```js
console.error("[F-Auth-3] cognito_unreachable", { name, code, message, path, method, degraded })
```

The `degraded` field is boolean: `true` when the request fell through to anonymous via `degradeOnInfraFailure`, `false` when 503 was returned. Operators can wire this to a CloudWatch Logs metric filter, ELK/Loki count query, or PM2 log-monitor to derive the alarm signal §4.2 calls for. Real metric library is filed as P1 follow-up if/when needed; the call site is a single line so the swap is trivial.

#### Implementation note — wrapper vs. cause (LOCKED, do not regress)

The structured log payload's `name` and `code` fields come from the matching cause via a classifier helper (`findCognitoInfraCause(err)`), **NOT** from the wrapper error directly. Reasoning: `verifyToken` wraps verifier errors via `Error.cause` to preserve information across the rethrow boundary. The wrapper itself has `name='Error'` and `code=undefined`, which would render the log payload useless if logged directly. The classifier walks the cause chain matching on `name` (set: `FetchError`, `NonRetryableFetchError`, `JwksNotAvailableInCacheError`, `WaitPeriodNotYetEndedJwkError`) or `code` (set: `ECONNREFUSED`, `ETIMEDOUT`, `ENOTFOUND`, `EAI_AGAIN`, `ECONNRESET`, `EHOSTUNREACH`, `ENETUNREACH`) and returns the matching error. The wrapper's `message` is preserved separately because it carries the readable "Token verification failed: ..." prefix.

Future maintainers may be tempted to log `error.name` directly because the wrapper is the immediate object in scope. **Do not.** The first draft of Step 2 hit this and the test suite caught it. Lock as canon.

#### Tests (G3 prerequisite — added in Step 2)

Unit tests added at `tests/unit/middleware/auth-gaps.test.js` (or equivalent) covering four cases:

- **Case 1** — no Authorization header → `req.user = null`, no 503, no log spam
- **Case 2** — token rejected (verifier throws JwtInvalidClaimError or similar) → `req.user = null`, single `console.log`, no 503
- **Case 3** — Cognito infra error (FetchError, ECONNREFUSED, etc.) with default options → 503 with code `AUTH_SERVICE_UNAVAILABLE`, structured `console.error` fired
- **Case 4** — Cognito infra error with `degradeOnInfraFailure: true` → `req.user = null`, structured `console.error` still fired (visibility), no 503

Tests run as part of CI before G2 closes. G3 self-review confirms all four pass.

#### Verification (G4)

1. Hit a route under optionalAuth (default options) with no Authorization header → `req.user = null`, no log spam.
2. Hit it with a malformed token → `req.user = null`, single quiet log only.
3. Simulate Cognito unavailability (e.g., point JWKS URI at an invalid host) → expect 503 with `AUTH_SERVICE_UNAVAILABLE`, structured error log fired.
4. Hit a route configured with `degradeOnInfraFailure: true` under simulated Cognito unavailability → expect 200 (or whatever the public route returns), structured error log still fired, no 503.

#### Risk

- Step 3 sweep must correctly apply `degradeOnInfraFailure: true` to the exemption list. If applied wrongly (e.g., to a route that does gate on `req.user`), that route silently degrades during outages — exactly the bug F-Auth-3 was meant to prevent. Mitigation: every route receiving the flag gets a `// PUBLIC:` comment in Step 3 with the reasoning.
- `Error.cause` requires Node ≥ 16.9. `package.json` specifies `"node": ">=20.0.0"` — fine. Note here so a future Node downgrade triggers a check.

---

### 4.3 Step 3 — Sweep sub-form (a): optionalAuth → requireAuth on writes

#### Current behavior

`app.js:364` applies `app.use(optionalAuth)` globally. Individual write routes either redundantly re-apply optionalAuth (`storyteller.js`, `careerGoals.js`, `uiOverlayRoutes.js`, `calendarRoutes.js`, `characterRegistry.js`, `evaluation.js`, `wardrobe.js` — and many more confirmed across Zones 18–26) or do nothing — meaning the global mount IS the bypass on those routes.

#### Confirmed surfaces (from v8 audit)

| File | Lines / count | Audit zone |
|---|---|---|
| `app.js` | `:364` (global mount) | Zone 21 (cross-zone root) |
| `storyteller.js` | `:38–43` (require), `:53, :113, :192, :213, :241, :263, :312, :333, :354, :553, :615, :636, :663, :738, :769, :790, :826, :856, :880, :910` | Zone 20 |
| `characterRegistry.js` | ~1700 lines; requireAuth applied to ONE legacy route (`/deep-profile/generate`); every other write under optionalAuth — set-status, promote-to-canon, bulk-delete, bulk-status, bulk-move, JSONB PUTs, AI generation endpoints | Zone 21 |
| `evaluation.js` | `:587` (Stats save) | Zone 22 |
| `careerGoals.js` | every mutation route | Security Batch / Zone 22 |
| `uiOverlayRoutes.js` | every mutation route | Security Batch |
| `calendarRoutes.js` | event CRUD, auto-spawn, world-event spawn | Security Batch |
| `franchiseBrainRoutes.js` | 10 mutation routes (entries POST/PATCH/DELETE, activate, activate-all, archive/unarchive, ingest-document, guard, seed) | F34 root |
| `wardrobe.js` | `:895` (`/select`), `:970` (`/purchase`) and others | Zone 23 |

**Notes:**

- The list above is the audit-confirmed inventory. Pre-flight (§5.1) requires a fresh codebase grep to catch any optionalAuth uses added since v8 closed (May 1, 2026).
- `characterRegistry.js` has a no-op fallback in its require block (lines 12–22) if the auth module fails to load. The fallback must be removed as part of this step — it is the same anti-pattern as F-Auth-2.

#### Fix

- For every confirmed surface above and every match found in pre-flight grep: replace optionalAuth with requireAuth.
- Where optionalAuth is applied at `app.js:364` globally and individual routes do NOT re-declare it, add explicit requireAuth at the route level.
- After the per-route requireAuth is in place, remove the global optionalAuth mount at `app.js:364` — leaving it creates two passes through auth and confuses error handling.
- Remove no-op fallback require blocks (`characterRegistry.js:12–22` and any twin instances).
- For routes confirmed during pre-flight as genuinely public (read-only, no `req.user` gating downstream), document the exemption in a comment with the audit reasoning. Do not leave bare optionalAuth without a justifying comment.
- For each genuine-public-read exemption, also pass `optionalAuth({ degradeOnInfraFailure: true })` instead of bare `optionalAuth` (per §4.2 amendment). This preserves availability of public reads during Cognito outages. The `// PUBLIC:` comment justifying the exemption should also reference the flag, e.g., `// PUBLIC: published canon, no req.user gating; degradeOnInfraFailure preserves availability during Cognito outages`.

#### F34 absorbed here

All 10 mutation routes on `franchiseBrainRoutes.js` close in this step. Decision #33 / #34 are honored: F34 closes as part of the sweep, not as a separate hotfix. The push-from-page route (already requireAuth) is the model the rest of the file conforms to.

#### Verification

1. Pre-flight grep result list (§5.1 deliverable) is fully addressed — every entry either swapped to requireAuth or commented as a justified exemption.
2. Zero matches for optionalAuth on a write route with no comment. Run:
   ```bash
   grep -rE "optionalAuth" src/routes/ src/app.js | grep -E "(post|put|patch|delete)" | grep -v "// PUBLIC:"
   ```
3. Authenticated request to a previously-unauth route returns 200 with `req.user` populated.
4. Unauthenticated request to the same route returns 401 with `AUTH_REQUIRED`.

---

### 4.4 Step 4 — Sweep sub-form (b): write routes with NO auth declaration

#### Current behavior

Zone 23 confirmed `routes/outfitSets.js` declares no auth middleware on any of its 5 routes. `routes/episodes.js` mounts the plural outfit-set controller at lines 101, 109, 117 with no auth declaration. Same blast radius as sub-form (a) — different starting state.

#### Confirmed surfaces

- `routes/outfitSets.js` — all 5 routes (no auth middleware declared anywhere in file).
- `routes/episodes.js:101` — mounts plural outfit-set controller without auth.
- `routes/episodes.js:109` — same pattern.
- `routes/episodes.js:117` — same pattern.
- Pre-flight (§5.1) requires a sweep for any other route file that does not import auth middleware at all.

#### Fix

- Add requireAuth import at the top of `routes/outfitSets.js`.
- Apply requireAuth to all 5 outfitSets routes.
- Apply requireAuth at `routes/episodes.js:101, :109, :117`.
- Note: F-Ward-3 keystone (Decision #60) calls for *deleting* the plural outfit-set controller — it is dead code wired to live URLs (Pattern 47, the `this.` binding bug crashes every create). The F-AUTH-1 PR should still apply requireAuth to these routes; deletion is a separate post-AUTH PR. Reasoning: leaving them open during the AUTH PR window is a security exposure; deleting them is a structural change that warrants its own review.

#### Verification

1. grep for `router\.(post|put|patch|delete)` in `routes/outfitSets.js` → every match has requireAuth.
2. Pre-flight grep produces no untouched routes.

---

### 4.5 Step 5 — Sweep sub-form (c): episode-mutation routes that declare optionalAuth

#### Current behavior

Zone 26 confirmed a third sub-form: `episodeOrchestrationRoute.js:135` explicitly declares optionalAuth on its mutation handler. The handler at line 220 writes orchestration_data to the episodes table. This is distinct from sub-form (a) because the route file has its own optionalAuth declaration — sweeping the global `app.js` mount alone does not touch it.

#### Confirmed surfaces

- `episodeOrchestrationRoute.js:135` — declares optionalAuth on episode-mutation handler.
- Pre-flight (§5.1) requires a sweep for any other route file that explicitly declares optionalAuth on a mutation route. v8 named only the orchestration route, but the audit closed before a comprehensive grep of this sub-form across the full codebase.

#### Fix

- Replace optionalAuth with requireAuth at `episodeOrchestrationRoute.js:135`.
- Apply same fix to any additional sub-form (c) instances pre-flight grep identifies.

#### Verification

1. Authenticated POST/PUT to the orchestration route returns 200 with `req.user` populated and writes to `episodes.orchestration_data` succeed.
2. Unauthenticated POST/PUT returns 401 with `AUTH_REQUIRED`.

---

### 4.6 Step 6 — CZ-5 (sendBeacon) + F-Auth-4 (interceptor reconciliation) + F-Auth-5 (user-id drift)

#### CZ-5 — sendBeacon current behavior

`BookEditor.jsx:173–186` uses `navigator.sendBeacon` for the beforeunload save. sendBeacon cannot carry Authorization headers. The moment Steps 3–5 land, every BookEditor beforeunload save silently 401s — and silently fails to save the user's last edits before navigation. This is a data-loss path, not just an auth-noise path.

#### CZ-5 — fix

- Replace `navigator.sendBeacon` with `fetch(url, { method: ..., headers, body, keepalive: true })`. The `keepalive` flag preserves the request through page navigation, the same property sendBeacon was used for.
- Confirm the Authorization header is added by the existing api service interceptor — sendBeacon was bypassing the interceptor entirely.
- Test: trigger beforeunload → confirm request fires with Authorization header → confirm 200 response in network log → confirm save persisted on next page load.

#### F-Auth-4 — current behavior

`middleware/auth.js:256–293` reimplements `authenticateToken` with one differing string: `AUTH_REQUIRED` instead of `AUTH_INVALID_TOKEN`. The frontend interceptor differentiates on these strings to decide whether to wipe credentials and redirect (per the comment at lines 250–255). Two parallel auth-checking code paths must be kept in sync.

#### F-Auth-4 — fix (Path 1 LOCKED, Maximum scope locked v1.9)

**v1.9 amendment: the Step 6b prep inventory (commit `a9c8b36e` on dev, `F-AUTH-1_Step6b_Inventory.md`) revealed that "the frontend interceptor" referenced in v1.8 is actually FOUR parallel auth-injection paths, not one.** v1.8 §4.6 was written assuming a single interceptor; reality is more complex. v1.9 expands Step 6b scope to Maximum: collapse all four paths into one (axios apiClient).

##### Backend changes (unchanged from v1.8)

- Delete the duplicate `authenticateToken` implementation at `middleware/auth.js:256–293`.
- Have requireAuth emit two distinct error codes: `AUTH_REQUIRED` when no Authorization header is present, `AUTH_INVALID_TOKEN` when a header is present but verifier rejects the token.
- **Migrate every existing `authenticateToken` call site to `requireAuth`.** Pre-flight inventory found **103 mount sites across 17 files**. Top-volume files (must not be missed):
  - `episodes.js` (14 sites — including the **D17** special case at `:307–315` which currently uses optionalAuth as a workaround for the very contract problem Path 1 fixes; swap to requireAuth)
  - `stories.js` (9), `search.js` (9), `notificationController.js` (9)
  - `thumbnails.js` (7), `socketController.js` (7), `activityController.js` (7)
  - Plus 10 additional files. Pre-flight report §14.1 carries the full inventory.
- Touch the **lazy-import fallbacks** too: `characterRegistry.js:17` and `worldEvents.js:28` use `authenticateToken` as a defensive fallback. Update both to fall back to `requireAuth` instead.
- **Drop the dead alias** at `middleware/auth.js:237` (`exports.authenticate = authenticateToken`). Pre-flight confirmed zero callers (Decision **D21**). One-line cleanup in the same commit as the duplicate removal.

##### Frontend changes (Maximum scope — v1.9)

The frontend has **four** parallel auth-injection paths per the inventory:

- **Path A** — `authHeader()` (singular) from `frontend/src/utils/storytellerApi.js`. ~34 call sites across 7 files.
- **Path B** — axios `apiClient` from `src/services/api.js` with response interceptor at lines 41–73. ~563 call sites across 53 files. The de facto standard.
- **Path C** — `authHeaders()` (plural) — local helper functions duplicated across 7 files plus a shared one in `pages/feed/feedConstants.js`. ~75 call sites.
- **Path D** — inline `Bearer ${token}` construction. ~25+ call sites across ~17 files.

Plus ~478 raw `fetch()` calls without auth-header injection — see Track 5 below for triage.

Step 6b implementation runs as four tracks in sequence. Track 5 (raw-fetch triage) runs **before** the migration tracks so any auth-required-but-missing-bug findings can adjust scope before code lands.

##### Track 5 — Raw fetch() triage (FIRST, sequential before migration)

- Audit ~478 raw `fetch()` calls in `frontend/src/`. Classify each as:
  - **(a) Intentionally public** — read-only published data, no auth needed. Annotate with `// PUBLIC:` comment matching backend Step 3 exemption convention.
  - **(b) Auth-required-but-missing** — bug. Auth was needed but never wired up. These get migrated to `apiClient` as part of Step 6b.
  - **(c) Unclear** — cannot determine intent from the call site. Surface for review; default to `apiClient` migration if uncertain.
- Triage produces an updated inventory file with classifications. Commit on dev (docs work), not `feature/f-auth-1`.
- Triage findings can adjust the migration scope. If many (b)-class bugs surface, the migration becomes "the four paths + the bugs." If almost all are (a), the migration is just the four paths.

##### Track 1 — apiClient interceptor update (Path B, 563 sites covered automatically)

- Update the response interceptor in `src/services/api.js` to handle the unified F-Auth-4 contract:
  - `AUTH_REQUIRED` (no header) → redirect to login.
  - `AUTH_INVALID_TOKEN` (header rejected) → attempt token refresh once via the existing refresh path; on refresh failure, redirect to login.
  - **Pass-through (LOCKED):** `AUTH_INVALID_FORMAT`, `AUTH_GROUP_REQUIRED`, and `AUTH_ROLE_REQUIRED` MUST NOT trigger session-redirect logic. Display inline as user-facing errors. Reasoning preserved from v1.8. (`AUTH_ROLE_REQUIRED` added in v2.1 per Track 1 surface §3.3 — `jwtAuth.js` emits it, code-before-status check covers it correctly.)
- Implementation note (v2.1, locked from Track 1 commit `da604ed2`): check `error.response.data.code` BEFORE `error.response.status`. Pass-through codes can be 400 or 403, not just 401 — code-first dispatch handles them correctly regardless of status.
- Single-retry guard: `AUTH_INVALID_TOKEN` retries refresh once (`originalConfig._retried` flag). If retry still fails, wipe + redirect. Refresh-endpoint URL itself excluded from retry to prevent recursion.
- Refresh helper uses bare `axios.post()`, NOT `apiClient` — this bypasses the interceptor for refresh requests, avoiding circular auth.

##### Track 1.5 — Frontend test scaffolding (NEW v2.1)

Track 1 surfaced (§3.1) that **the frontend has never run a test**. vitest is in package.json but no `vitest.config.js`, no jsdom, no `.test` files exist. ESLint v9 is broken because `.eslintrc.js` is the v8 format and not auto-detected. G3 gate ("test coverage minimum") is unenforceable on the frontend until this is fixed.

- Establish frontend test scaffolding before Tracks 2/3/4/6/7 land. Each later migration commit then includes tests for the migrated call sites in the same commit — that is how G3 becomes enforceable for the ~556-site migration.
- Deliverables for Track 1.5:
  - Add `vitest.config.js` with `environment: jsdom` (or happy-dom — pick whichever has cleaner DOM emulation for our use case).
  - Add `jsdom` (or happy-dom) to devDependencies.
  - Write `frontend/src/services/api.test.js` covering the 5 interceptor cases:
    - **Case A** — `AUTH_REQUIRED` triggers `wipeSessionAndRedirect`, no retry.
    - **Case B** — `AUTH_INVALID_TOKEN` first hit triggers refresh, request retries with new token.
    - **Case C** — `AUTH_INVALID_TOKEN` on retry triggers `wipeSessionAndRedirect` (no infinite loop).
    - **Case D** — `AUTH_INVALID_FORMAT` / `AUTH_GROUP_REQUIRED` / `AUTH_ROLE_REQUIRED` do NOT trigger redirect, pass through as caller errors.
    - **Case E** — non-auth errors (500, network, etc.) pass through unchanged.
  - Mock `localStorage`, `window.location.href`, and `axios.post` (for refresh path).
- ESLint v9 migration is OUT of scope for Track 1.5. `.eslintrc.js` → `eslint.config.js` is a separate concern; pre-flight or post-F-AUTH-1 follow-up. Track 1.5 only adds test runner scaffolding; lint config stays as-is.
- Estimated: ~10 lines vitest config + 1 devDep + ~150 lines test file = single commit. Reviewed and approved before Track 1.6 begins.

##### Track 1.6 — Backend requireAuth split (NEW v2.1)

Track 1 surfaced (§3.2) that **backend `requireAuth` currently emits `AUTH_REQUIRED` for both no-header AND verifier-rejected cases** — never `AUTH_INVALID_TOKEN`. The Track 1 interceptor's refresh-on-`AUTH_INVALID_TOKEN` branch is wired correctly but fires for nothing on requireAuth routes today (only `authenticateToken` legacy middleware emits `AUTH_INVALID_TOKEN`, at `auth.js:126`).

- Track 1.6 closes the contract end-to-end before migration tracks land. Without it, Tracks 2/3/4/6/7 migrate call sites that depend on the new contract working correctly — and they would silently log users out on token expiry instead of refreshing.
- Deliverables for Track 1.6 (backend, `src/middleware/auth.js`):
  - In `requireAuth`: branch on whether the Authorization header was present. No header → 401 with code `AUTH_REQUIRED` (current behavior). Header present, verifier rejected → 401 with code `AUTH_INVALID_TOKEN` (new).
  - Use the same Cognito-vs-rejected classifier landed in Step 2: `findCognitoInfraCause(err)` → if matches, this is an infra failure (already handled by F-Auth-3 path); else this is a token-rejection (emit `AUTH_INVALID_TOKEN`).
- Add unit tests for the split:
  - No header → 401 + `AUTH_REQUIRED`
  - Header + valid token → 200 + `req.user` populated
  - Header + verifier-rejected token → 401 + `AUTH_INVALID_TOKEN` (new)
  - Header + Cognito infra failure → 503 (already covered by Step 2 tests; verify no regression)
- Once Track 1.6 lands, the F-Auth-4 Path 1 contract is complete on requireAuth routes: frontend interceptor + backend codes both speak the new vocabulary. Mid-session token expiry now triggers refresh, not logout.
- Track 1.6 does NOT touch `authenticateToken` (which already emits `AUTH_INVALID_TOKEN`). `authenticateToken` is removed entirely later in Step 6b backend cleanup per §4.6 backend changes (LOCKED v1.8) — the duplicate at `middleware/auth.js:256–293` is deleted.
- Estimated: middleware change + tests = single commit. Reviewed and approved before Track 2 begins.

##### Track 2 — Migrate Path A (authHeader) to apiClient

- 34 call sites across 7 files. Replace `fetch + ...authHeader()` spread with `apiClient` method calls.
- Tested change. Each migration must preserve: HTTP method, URL, payload shape, response shape consumption. Add tests for any migrated path that did not have them.
- Once migration is complete: delete `authHeader()` export from `frontend/src/utils/storytellerApi.js`. Confirm zero remaining imports before deletion.

##### Track 3 — Migrate Path C (authHeaders plural duplicates) to apiClient

- 75 call sites across 9 files. Seven files define their own local `authHeaders()` helper; one shared in `feedConstants.js` used by `SocialProfileGenerator.jsx` (~40 sites alone) and `ProfileDetailPanel.jsx`.
- Migration consolidates the seven duplicate helpers AND migrates call sites to `apiClient`. Two-stage:
  - Stage 1: replace each local `authHeaders()` helper with `apiClient` calls at the call site. Delete the local helper.
  - Stage 2: migrate the shared `authHeaders()` in `feedConstants.js` + its consumers (`SocialProfileGenerator.jsx`, `ProfileDetailPanel.jsx`) to `apiClient`. Delete the shared helper.
- Pre-flight inventory noted subtle drift between copies (`useStoryEngine.js` accepts an extra param; others do not). The migration eliminates this drift surface.

##### Track 4 — Migrate Path D (inline Bearer) to apiClient

- 25+ call sites across ~17 files. Replace inline `Bearer ${token}` construction with `apiClient` method calls.
- Cohabiting files (apiClient + inline Bearer in the same file): `ProductionTab.jsx`, `WorldAdmin.jsx`. The inline Bearer sites in these files are accidental drift, not intentional dual-paradigm. Convert all to `apiClient`.
- Special case: `FeedBulkImport.jsx` mixes Path C local helper + Path D inline. Track 3 + Track 4 work converges in this file.

##### Track 6 — Migrate BUG-class raw fetches to apiClient (NEW v2.0)

**v2.0 amendment:** Track 5 triage (commit `a929ce29` on dev, `F-AUTH-1_Step6b_Inventory_v2.md`) reclassified ~478 raw fetch() calls. Found **345 BUG-class sites** — auth-required-but-missing. These would silently 401 the moment Step 3 sweep lands. Track 6 closes them by migrating to apiClient.

Why this is in F-AUTH-1 (not deferred): Step 3 sweep transforms backend `optionalAuth` → `requireAuth`. The 345 BUG-class fetches today get unauth'd responses (which the routes serve under `optionalAuth`). The moment Step 3 lands, those routes return 401. Every user hitting these features sees broken writes, blank pages, silent failures. **Shipping Step 3 without Track 6 actively breaks the product.** That is worse than not shipping F-AUTH-1.

###### Track 6 — priority order (10 high-density files first, ~180 of 345 sites)

1. `SceneSetsTab.jsx` (64 sites). Single-file cluster. `sceneSetRoutes.js` will Step-3-sweep to `requireAuth`; this page would silently break for every user. **Migrate first.**
2. `WriteMode.jsx` (33 sites). `/storyteller/*` writes.
3. `FranchiseBrain.jsx` (18 sites). All 9 franchise-brain mutations bare. F34 closure depends on this file.
4. `StoryThreadTracker.jsx` (11 sites). Thread writes.
5. `CharacterGenerator.jsx` (10 sites).
6. `ContinuityEnginePage.jsx` (10 sites).
7. `Episodes/EpisodeScenesTab.jsx` (9 sites).
8. `TemplateDesigner.jsx` (9 sites).
9. `CharacterTherapy.jsx` (9 sites).
10. `SeriesPage.jsx` (8 sites).

Remaining ~165 sites distributed across ~60 other files at 1-8 sites each. Track 6 continues file-by-file in priority order (highest count first) until 0 BUG sites remain.

Each file becomes its own commit per Pace 2 batched checkpoints. `SceneSetsTab.jsx` alone is ~64 sites in one file — that single file is one commit and gets reviewed before the next file starts.

##### Track 7 — UNCLEAR-A reconciliation (NEW v2.0, runs in parallel with Step 3)

71 UNCLEAR-A sites: GETs on mixed-verb routes (`episodes`, `storyteller`, `shows`, `characters`, `wardrobe`, `onboarding`, `story-health`). Each one's correct disposition (PUBLIC vs BUG) depends on which Step 3 per-route classification gets applied to the corresponding backend route.

- Step 3 sweep classifies each backend mixed-verb route as either: (a) PUBLIC published-only data (gets `// PUBLIC:` comment + `degradeOnInfraFailure` flag), or (b) auth-required (gets `requireAuth`).
- Track 7 mirrors that classification on the frontend: for each Step 3 (a) classification, the corresponding frontend GET stays as raw fetch with no auth (PUBLIC); for each (b), the GET migrates to `apiClient`.
- Track 7 does not run independently — it runs in parallel with Step 3, file-by-file, as Step 3 classifies each route. This avoids re-doing Track 7 work if Step 3 reclassifies later.

UNCLEAR-B (144 sites in 32 files): per Track 5's spot-check, ~80% are Path D (already covered by Track 4) and ~20% are hidden BUGs (covered by Track 6). **No separate Track 8.** UNCLEAR-B resolves naturally as Tracks 4 and 6 land. `EpisodeDetail.jsx` is the clearest example: mixed-paradigm with hidden bare-fetch BUGs; treated as a Track 6 file when its turn comes.

##### Verification (G3 + G4)

After all six implementation tracks (1, 2, 3, 4, 6, 7): zero imports of `authHeader` (Path A), zero local `authHeaders()` helpers (Path C), zero inline `Bearer ${token}` (Path D), zero BUG-class raw fetches (Track 6), zero unresolved UNCLEAR-A (Track 7). Verification greps confirm.

```bash
grep -rn "authHeader\|Bearer \${" frontend/src/ | grep -v "src/services/api.js"
```

Expected output: zero matches outside `src/services/api.js` (the interceptor itself).

```bash
grep -rn "fetch(" frontend/src/ | wc -l
```

Expected: drops from 627 (current) to count of intentionally-public reads only (PUBLIC class — currently 5 confirmed, may grow as Track 7 reclassifies UNCLEAR-A).

- Authenticated request via `apiClient` succeeds and `req.user` populated server-side.
- Mid-session token expiry: `apiClient` interceptor sees `AUTH_INVALID_TOKEN`, refreshes silently, request continues. User does not see a logout.
- Token deletion: `apiClient` interceptor sees `AUTH_REQUIRED`, redirects to login.
- `AUTH_INVALID_FORMAT` and `AUTH_GROUP_REQUIRED` responses do NOT trigger session-redirect logic; surfaced inline.
- `SceneSetsTab.jsx` full exercise on dev: every CRUD operation succeeds authenticated, 401s unauthenticated. (Single-file regression check given the 64-site density.)
- `FranchiseBrain.jsx` full exercise: every entry mutation succeeds authenticated, 401s unauthenticated. F34 closes at this checkpoint.

##### Scope acknowledgment — Track 5 changed the math (v2.0)

Pre-Track-5 v1.9 scope: ~134 site migrations. Post-Track-5 v2.0 scope: **~556 sites total** (~134 paradigm + ~345 BUG + ~71 UNCLEAR-A + ~140 UNCLEAR-B Path-D resolutions absorbed by Track 4). Roughly 4× the v1.8 estimate. Track 5 was the data we should have had before locking scope at v1.9; v1.9's number was incomplete because the four-path inventory found four paradigms but did not catalog raw fetches against backend routes. v2.0 corrects.

This is multi-week work, not multi-day. Locked at v2.0: **multi-week timeline acknowledged.** If F-AUTH-1 needs to ship by a specific date, the timeline must shape the pace; otherwise Pace 2 batched checkpoints (see below) is the locked working model.

##### Pace 2 — Batched with checkpoints (LOCKED v2.0)

Each track lands as multiple commits, with explicit checkpoints between commits. The pace is *not "sprint through 556 sites,"* it's "land a commit, observe, approve, push backup, repeat."

- Track 1 (apiClient interceptor update): 1 commit. Reviewed and approved before Track 1.5 begins.
- Track 1.5 (frontend test scaffolding): 1 commit. Vitest config + jsdom + 5 interceptor tests. Reviewed and approved before Track 1.6 begins.
- Track 1.6 (backend requireAuth split): 1 commit. Middleware change + tests. Reviewed and approved before Track 2 begins.
- Track 2 (Path A migration): 1-2 commits. Reviewed and approved before Track 3.
- Track 3 (Path C consolidation + migration): 2-3 commits. Each stage of consolidation reviewed.
- Track 4 (Path D inline cleanup): 1-2 commits. Reviewed.
- Track 6 (BUG migration): file-by-file in priority order. `SceneSetsTab.jsx` is one commit. `FranchiseBrain.jsx` is one commit. Each high-density file reviewed and approved before the next file starts. Lower-density files may batch (e.g., 5-10 small files per commit) but only after the high-density tracks have established the migration pattern.
- Track 7 (UNCLEAR-A reconciliation): runs in parallel with Step 3, classification by classification.
- Estimated commit count for Step 6b alone: 12-20. Each commit gets backup-pushed per §9.13 Rule 2 after my approval.

Failure mode Pace 2 prevents: a regression introduced at site #347 that doesn't surface until G4 dev exercise, by which point 200 sites have changed and the bisection is hard. Pace 2 means a regression surfaces at the file that introduced it.

##### What happens if Track 6 (or any later track) reveals new scope

Locked discipline (matches v1.7 §9.13 framing): **surface the finding, lock the scope decision, amend the fix plan, then proceed.**

- Example: Track 6 file-by-file work reveals a fifth auth paradigm not seen in inventories — surface immediately, lock scope, amend §4.6, proceed.
- Example: a BUG-class fetch can't cleanly migrate to `apiClient` (different request signature, special response handling) — surface, decide whether to migrate-anyway-with-adapter or document-as-exemption, amend, proceed.
- Example: regression in dev exercise — roll back, surface, fix at source, re-do affected commit(s), proceed.
- What does NOT happen: silent scope expansion, surprise bug-fixes mid-track, "while we're here" cleanups outside the locked spec.

#### F-Auth-4 — out-of-scope (LOCKED, unchanged from v1.8)

- **Decision D20** — `src/middleware/jwtAuth.js` is a separate verification path (custom JWT via TokenService, not Cognito). Different `req.user` shape (adds `role`, `tokenType`, `source`, `expiresAt`). Different helpers (`requireRole` has no equivalent in `auth.js`). 9 production mounts: `routes/auth.js:10` (`/logout`, `/me`) and `routes/compositions.js:20` (composition CRUD + admin gates).
- `jwtAuth.js` stays as-is in F-AUTH-1. Folding it into Step 6b means rewriting two architecturally distinct auth systems in one PR — scope explosion, not consolidation.
- Frontend changes apply to all auth-injection paths regardless of which backend module the responses came from. apiClient interceptor handles `AUTH_REQUIRED` and `AUTH_INVALID_TOKEN` regardless of source.
- Architectural follow-up (out of F-AUTH-1 scope): does Prime Studios want two auth modules long-term? `jwtAuth.js` looks like a legacy or special-case path predating the Cognito migration. Worth a separate audit after F-AUTH-1 ships.

#### F-Auth-5 — current behavior

`decisionLogs.js:22` reads `req.user.sub` directly. Other call sites read `req.user.id` — the value the auth middleware maps from `sub` onto the user object. Both resolve to the same Cognito subject identifier today, but the contract has drifted: one file consumes a raw claim, the rest consume the middleware-mapped field. The moment the middleware mapping changes (e.g., to a numeric internal ID, or to a UUID indirection layer for a multi-tenant change), `decisionLogs.js` silently writes the wrong value with no test failure.

#### F-Auth-5 — why fold in here

- Step 6 is already the auth-contract reconciliation step. F-Auth-4 Path 1 is unifying requireAuth and authenticateToken; F-Auth-5 is unifying user-object access. Same conceptual fix.
- The change is one line. PR-scope cost is negligible.
- Deferring it as a one-line follow-up PR has higher operational cost than fixing it now (the follow-up tends to never get scheduled).

#### F-Auth-5 — fix

- At `decisionLogs.js:22`, replace `req.user.sub` (or `req.user?.sub`) with `req.user?.id` to preserve the optional-chaining style the rest of the codebase uses.
- Pre-flight (§5.1) requires a fresh grep for any other call site reading `req.user.sub` directly. Codebase uses optional chaining; the literal-form grep returns 0 hits and is incorrect. Use the regex form:
  ```bash
  grep -rnE "req\.user\??\.sub" src/
  ```
- Pre-flight inventory (preserved here as canonical scope) found **6 sites**:
  - `src/controllers/cursorPathController.js:22`
  - `src/controllers/iconCueController.js:22`
  - `src/controllers/musicCueController.js:20`
  - `src/controllers/productionPackageController.js:22`
  - `src/routes/decisionLogs.js:22`
  - `src/routes/thumbnails.js:80`
- Replace `req.user?.sub` with `req.user?.id` at all 6.
- **Special case — `thumbnails.js:80`** currently reads `const userId = req.user?.sub || req.user?.id || 'system';` inside a route gated by `authenticateToken` at `:76`. The fallback chain is dead code (`req.user` is guaranteed non-null when `:80` executes). Replace the entire line with `const userId = req.user.id;` — drop the fallback per Decision §11 #2.
- For each match outside test files: replace `req.user?.sub` with `req.user?.id`. Document any intentional `req.user.sub` use with a `// PUBLIC:` justifying comment if one exists (none expected from pre-flight).

#### F-Auth-5 — verification

1. Authenticated POST to a `/decision-logs` route succeeds and the persisted user_id field matches the value other authenticated routes write for the same user.
2. Authenticated POST to `/thumbnails/:id/publish` succeeds and persists user_id (not "system").
3. Verification grep returns zero matches for `req.user?.sub` or `req.user.sub` outside test fixtures and `middleware/auth.js` itself:
   ```bash
   grep -rnE "req\.user\??\.sub" src/
   ```

#### Step 6 — overall verification

1. Open BookEditor, edit content, navigate away → save fires via fetch+keepalive, 200 response, edits persist.
2. Open authenticated session, manually delete token from storage, attempt write → interceptor sees `AUTH_REQUIRED`, redirects to login.
3. Open authenticated session, manually corrupt token, attempt write → interceptor sees `AUTH_INVALID_TOKEN`, attempts refresh.

---

## 5. Execution Sequence

All six steps land in one PR. Within the PR, the work order matters because it minimizes the time the codebase spends in a half-fixed state during local development and review.

### 5.1 Pre-flight verification (before writing any code)

Pre-flight produces a complete, current inventory. v8 closed May 1, 2026 — any code added since then is not in the audit. Pre-flight catches it.

#### Pre-flight checklist

1. Spot-check 3 v8 file:line references to confirm the codebase still matches the audit:
   - `middleware/auth.js:13–22, :44–46, :164–168, :256–293`
   - `app.js:364`
   - `episodeOrchestrationRoute.js:135` (and confirm the write at `:220`)

2. Run the master grep for sub-form (a). Capture full output. This is the inventory step 3 must address.
   ```bash
   grep -rn "optionalAuth" src/routes/ src/app.js src/middleware/ | sort
   ```

3. Run the sub-form (b) grep — files in `src/routes/` that do NOT import auth middleware:
   ```bash
   for f in src/routes/*.js; do grep -l "require.*middleware/auth" "$f" >/dev/null || echo "NO AUTH IMPORT: $f"; done
   ```

4. Run the sub-form (c) grep — explicit optionalAuth on mutation routes:
   ```bash
   grep -rnE "router\.(post|put|patch|delete).*optionalAuth" src/routes/
   ```

5. Confirm Cognito env vars are set in dev and prod environments via PM2 runtime env (not interactive shell). Step 1 (F-Auth-2) WILL boot-fail any environment missing them. **CONFIRMED at G1: dev and prod both have real Cognito identifiers; see Decision §9.10 re: pool unification.**

6. Identify the frontend interceptor file. Confirm the strings it differentiates on. Save this as the contract Step 6 reconciles against.

7. Pull a list of all routes currently using optionalAuth that are genuinely public reads. Pre-tag them as exemptions so step 3 does not blanket-swap them.

#### Pre-flight deliverables

- Inventory file: `src/routes/` optionalAuth surface count + file:line list.
- Sub-form (b) file list (routes with no auth import).
- Sub-form (c) file:line list (explicit optionalAuth on mutations).
- Genuine-public-route exemption list with reasoning per route.
- Frontend interceptor contract reference (file:line + string list).
- Env-var confirmation per environment.

### 5.2 Implementation order within the PR

1. **Step 6a (CZ-5 only)** — migrate sendBeacon → fetch+keepalive in `BookEditor.jsx`. This change is independent and can be merged to the working branch first; it does not break anything when sendBeacon is no longer the path.
2. **Step 2 (F-Auth-3)** — refine optionalAuth error handling. Independent of route changes; safer to land before the sweep so any remaining optionalAuth routes get the better error semantics during the brief overlap window.
3. **Step 6b (F-Auth-4 Path 1)** — reconcile the requireAuth/authenticateToken duplication. Land before the sweep so the frontend interceptor contract is stable when sweep traffic shifts.
4. **Step 6c (F-Auth-5)** — replace `req.user.sub` with `req.user.id` at `decisionLogs.js:22` and any other call sites pre-flight identifies. Independent of route changes; safe to land any time during Step 6.
5. **Step 3 (Sweep a)** — biggest mechanical change. Land in dependency order: per-route requireAuth additions FIRST, then remove the global optionalAuth at `app.js:364`. This avoids a brief window where neither layer guards the routes.
6. **Step 4 (Sweep b)** — add requireAuth to `outfitSets.js` + `episodes.js:101/109/117`.
7. **Step 5 (Sweep c)** — replace optionalAuth at `episodeOrchestrationRoute.js:135`.
8. **Step 1 (F-Auth-2)** — boot-fail on missing env vars. LAST. Reasoning: this change is the most disruptive in environments where env vars may be misconfigured. Landing it last means every other change in the PR is already exercised against working auth before the boot-fail check is added.

> **Why F-Auth-2 lands last**
>
> F-Auth-2 boot-fails any environment with missing or placeholder Cognito env vars. If it lands first, every step after it depends on those env vars being set in every dev/test environment. By landing last, the rest of the PR has already been exercised in those environments under real auth. Pre-flight (§5.1) confirms env vars are set; F-Auth-2 last is belt-and-suspenders.

### 5.3 PR mechanics

- Single PR title: `"F-AUTH-1: codebase-wide auth bypass on writes — six-step coordinated fix"`
- PR description references audit handoff v8 §4.1 and §12.
- PR description includes the pre-flight inventory as collapsed sections.
- Each commit corresponds to one step (or substep). Bisectability matters if a regression surfaces.
- Branch coordination: confirm with the second developer (VS Code collaborator) before opening the PR. F-AUTH-1 touches `middleware/auth.js`, `app.js`, and a wide swath of `src/routes/` — merge conflicts are likely if other branches are in flight.
- CI must pass before merge. If the test suite does not currently exercise auth on the swept routes, add tests as part of the PR — at minimum, one authenticated + one unauthenticated test per sub-form.

---

## 6. Deployment Plan — Gate-Driven Sequence

primepisodes.com has no real-user traffic at the time this plan locks. The deploy plan therefore does not use a calendar window — it uses a gate sequence. Each gate must pass before the next begins. There is no pressure to ship by a date; there is pressure to not skip a gate.

> **Why gates instead of a calendar**
>
> A calendar deploy window is a tool for minimizing user impact during a risky change. With no real users, there is no user impact to minimize — the calendar window solves a problem you don't have. What you DO have: a codebase that has accumulated months of untested assumptions (the audit found 269 P0 bugs) and a fix that touches authentication on every write route. The gates exist to prevent the temptation to skip discipline because "no one will see it." The gates are not theater. F-AUTH-1 is the first fix; how it ships sets the precedent for every fix that follows.

### 6.1 The Seven Gates

| Gate | Name | What must be true before proceeding |
|---|---|---|
| **G1** | **Pre-flight complete** | All §5.1 inventory deliverables produced and reviewed: optionalAuth surface inventory, sub-form (b) file list, sub-form (c) file:line list, exemption list with reasoning, frontend interceptor contract reference, env-var confirmation, `req.user.sub` grep results (F-Auth-5). Drift from v8 file:line references documented or absent. **CLOSED at v1.5.** |
| **G2** | **Implementation complete** | **PREREQUISITE (G1 verified):** Cognito runtime env vars confirmed by Evoni via PM2 runtime env on dev and prod EC2 boxes. Both `COGNITO_USER_POOL_ID` and `COGNITO_CLIENT_ID` set to real (non-placeholder) values, in PM2 process env (not interactive shell). Note: dev and prod currently share one Cognito pool — see Decision §9.10. Then: all six steps coded per §5.2 order. Each commit corresponds to one step or substep (bisectability). CI passing. PR opened. PR description references audit handoff v8 §4.1 + this fix plan and includes the pre-flight inventory in collapsed sections. |
| **G3** | **Self-review passed** | Every commit in the PR read end-to-end. Test coverage minimum: one authenticated + one unauthenticated test per sub-form. F-Auth-5 has its specific test (decisionLogs write persists matching user_id). Frontend interceptor handles `AUTH_REQUIRED` and `AUTH_INVALID_TOKEN` as distinct paths. |
| **G4** | **Dev verified + soak** | Backend deployed to dev. Boot tested with valid env vars (succeeds), missing env var (boot-fails with named error), placeholder env var values (boot-fails). Frontend deployed to dev (interceptor contract update). Full §7 verification checklist run end-to-end on dev. Every checkbox confirmed. Boot/restart cycle exercised (kill the process, confirm clean restart, confirm auth still works). **2-hour soak on dev** — server stays up, no error log spam, no unexpected restarts. You are reachable for alerts during the soak window. *Note: G4 absorbs the staging-soak responsibility from the original three-environment plan; Prime Studios infra is intentionally dev + prod only (Decision §9.9).* |
| **G5** | **Prod cutover** | Frontend deployed to prod, then backend. You spend 30 focused minutes exercising the app: log in, write to a Stats route, write to a wardrobe route, write to a franchise-brain route (this is where F34 closes), write something in BookEditor and navigate away (CZ-5 path), write to a `/decision-logs` route (F-Auth-5 path). Confirm boot logs are clean. No errors visible in app or server logs. |
| **G6** | **Post-deploy soak** | Server stays up overnight. Next morning, exercise the app again — same surfaces as G5. If clean, declare F-AUTH-1 closed. Tier 1 fix queue (F-App-1, F-Stats-1, F-Ward-1, F-Reg-2, F-Ward-3, F-Sec-3, F-Franchise-1) is now unblocked. |

### 6.2 Pre-G5 readiness check

Before opening the prod cutover at G5, run this short list. If any item fails, do not proceed to G5. Return to the appropriate earlier gate.

1. Cognito env vars confirmed set in prod (verified once during pre-flight; re-confirmed here because Step 1 / F-Auth-2 boot-fails any env without them).
2. Second developer confirmed not mid-deploy. No conflicting branch in flight.
3. Frontend build deployed to prod is using the updated interceptor contract from Step 6b. Hard requirement — backend cutover before frontend cutover ships `AUTH_REQUIRED` responses to a frontend that does not know how to handle them.
4. Rollback procedure (§8) read and understood. Revert path is one command, not a discovery exercise.
5. You have a clear 30 minutes. Phone on do-not-disturb. No meetings. No "I can do this between calls."

### 6.3 What to watch during deploy

Without real-user traffic, the standard "watch the metrics" framing does not apply. There is no 401-rate-spike to investigate. There is no user-write-success-rate dashboard. What you watch instead:

- **Boot logs** — server starts cleanly. No exceptions during module load. F-Auth-2 emits no warnings (because env vars are set). No "Token verification failed" loops in the first minute.
- **App exercise** — every surface listed in G5 returns 200 under your own authenticated session. Every unauthenticated test (open an incognito window, attempt a write) returns 401 with `AUTH_REQUIRED`.
- **BookEditor exercise** — write content, navigate away, return. Edits persist. Network log shows fetch with `keepalive: true` (not sendBeacon) carrying the Authorization header.
- **Frontend interceptor exercise** — manually delete the auth token from browser storage, attempt a write. Interceptor sees `AUTH_REQUIRED`, redirects to login. Manually corrupt the token, attempt a write. Interceptor sees `AUTH_INVALID_TOKEN`, attempts refresh.
- **Server logs during exercise** — no error-level entries from `middleware/auth.js`. F-Auth-3 503 path is not firing (Cognito is reachable). No `console.warn` floods.
- **Overnight (G6)** — server uptime metric matches deploy time the next morning. No unexpected restarts. No memory growth visible in process metrics.

> **What you are NOT watching for**
>
> - No 401 rate spike to investigate (no traffic to produce one).
> - No write success rate dashboard (no traffic).
> - No 503 rate from F-Auth-3 (Cognito-down detection only fires under load that you do not have).

### 6.4 If a gate fails

- **G1 fails** — pre-flight surfaced drift, missing env vars, or branch conflict. Resolve before G2. Drift may require updating this fix plan to v1.6+.
- **G2 fails** — implementation incomplete or CI red. Stay at G2. Do not let "I can fix this in dev soak" pressure push you forward.
- **G3 fails** — self-review found a bug or a missing test. Return to G2. Add the test, fix the bug, re-run CI.
- **G4 fails** — boot-fail when it should succeed, unexpected §7 checklist behavior, server unstable during 2-hour soak, or memory growth during soak. Diagnose. If code, return to G2. If env-specific, fix in place. **Re-run all of G4 (including a fresh 2-hour soak)** before proceeding to G5 — do not partial-credit a soak that was interrupted by a code change.
- **G5 fails** — prod cutover surfaces an issue. Roll back per §8. Do not try to fix forward in prod. Return to G2 or G4 depending on cause.
- **G6 fails** — overnight soak revealed instability. Roll back. Same rule: do not fix forward in prod.

---

## 7. Post-Deploy Verification Checklist

Run this checklist on dev (during G4) and again on prod after G5 cutover.

### 7.1 Auth module integrity

- [ ] Server boot with valid Cognito env vars — succeeds.
- [ ] Server boot with missing `COGNITO_USER_POOL_ID` — fails immediately with named error.
- [ ] Server boot with missing `COGNITO_CLIENT_ID` — fails immediately with named error.
- [ ] Server boot with placeholder env var values — fails immediately with named error.

### 7.2 optionalAuth error semantics (F-Auth-3)

- [ ] optionalAuth route (default options), no Authorization header — `req.user = null`, no log spam.
- [ ] optionalAuth route, malformed token — `req.user = null`, single quiet log only.
- [ ] optionalAuth route (default options), simulated Cognito unavailability — 503 response with code `AUTH_SERVICE_UNAVAILABLE`, structured error log fired (`[F-Auth-3] cognito_unreachable`).
- [ ] optionalAuth route configured with `degradeOnInfraFailure: true` (manuscript-export.js GETs, press.js GETs), simulated Cognito unavailability — request still returns the public content (not 503), structured error log STILL fires.
- [ ] Step 2 unit tests pass (4 cases per §4.2): no header / token rejected / infra error default / infra error with flag.

### 7.3 Sweep (a) — optionalAuth → requireAuth

- [ ] `storyteller.js` write routes: authenticated request 200, unauth 401.
- [ ] `characterRegistry.js` writes: authenticated request 200, unauth 401.
- [ ] `characterRegistry.js` author-only fields: authenticated request as author succeeds; previously-broken because `req.user` was null is now functional.
- [ ] `evaluation.js:587` (Stats save): authenticated 200, unauth 401.
- [ ] `careerGoals.js` mutation routes: authenticated 200, unauth 401.
- [ ] `uiOverlayRoutes.js` mutation routes: authenticated 200, unauth 401.
- [ ] `calendarRoutes.js` mutation routes: authenticated 200, unauth 401.
- [ ] `franchiseBrainRoutes.js` all 10 mutation routes: authenticated 200, unauth 401. F34 closed.
- [ ] `wardrobe.js:895` (`/select`), `:970` (`/purchase`): authenticated 200, unauth 401.

### 7.4 Sweep (b) — no-auth-declaration routes

- [ ] `outfitSets.js` all 5 routes: authenticated 200, unauth 401.
- [ ] `episodes.js:101, :109, :117`: authenticated 200, unauth 401.

### 7.5 Sweep (c) — explicit optionalAuth on mutations

- [ ] `episodeOrchestrationRoute.js:135`: authenticated 200 (writes orchestration_data at `:220`), unauth 401.

### 7.6 Step 6 — CZ-5 + F-Auth-4 + F-Auth-5

- [ ] `BookEditor.jsx` beforeunload save: triggers fetch+keepalive (not sendBeacon), Authorization header present, 200 response, edits persisted on next load.
- [ ] Frontend interceptor sees `AUTH_REQUIRED` → redirects to login.
- [ ] Frontend interceptor sees `AUTH_INVALID_TOKEN` → attempts refresh, then redirects on failure.
- [ ] Mid-session token expiry: refresh path works, user is not silently logged out.
- [ ] Authenticated POST to `/decision-logs` persists `user_id` matching the value other authenticated routes write for the same user (F-Auth-5).
- [ ] grep `req\.user\.sub` `src/` returns zero matches outside `middleware/auth.js` itself and test fixtures (F-Auth-5).

### 7.7 Regression checks

- [ ] `app.js` no longer applies global optionalAuth (line 364 confirmed removed).
- [ ] `characterRegistry.js` no-op fallback at lines 12–22 confirmed removed.
- [ ] No bare optionalAuth on a write route without a `// PUBLIC:` justifying comment.
- [ ] Pre-existing read-only routes still work for unauthenticated users (where applicable per exemption list).

---

## 8. Rollback Plan

Rollback is a single revert of the merge commit. Because all six steps land in one PR, rollback restores the entire pre-fix state — including the F34 exposure. This is acceptable because the alternative (partial rollback) leaves the codebase in a half-fixed state v8 §4.1 explicitly warns against.

### 8.1 Rollback triggers

- Production write success rate drops more than 2% on any route within 30 minutes of deploy and the cause is auth-related.
- BookEditor beforeunload save failure rate measurably increases.
- Boot failure on any production instance not caused by missing env vars (i.e., a code bug).
- Frontend interceptor regression — users being silently logged out, mid-session refresh broken.

### 8.2 Rollback procedure

1. Revert the merge commit on the deploy branch.
2. Redeploy backend to prod.
3. Redeploy frontend to prod (the old frontend works against the rolled-back backend; the new frontend will work against either, but rolling back both is cleaner).
4. Confirm metrics return to pre-deploy baseline.
5. Open an incident review. Identify which of the six steps caused the regression. Re-plan the next attempt.

### 8.3 What rollback restores

- F-AUTH-1 sweep undone — all sub-forms back to optionalAuth or no-auth.
- F34 exposure restored. Mitigation: rollback should be brief; do not soak in the rolled-back state.
- F-Auth-2 boot-fail removed.
- F-Auth-3 error semantics reverted.
- CZ-5 sendBeacon restored. BookEditor data-loss path reopened.
- F-Auth-4 reconciliation/documentation undone.

---

## 9. Decisions Log (all locked at G1 closure)

### 9.1 F-Auth-4 path — LOCKED

Path 1 (reconcile, delete `authenticateToken` duplicate) — **LOCKED.** Decision recorded. Implementation per Step 6b.

### 9.2 Genuine-public-route exemption list

Pre-flight (§5.1) produces this list. Each entry needs explicit confirmation: "this route is genuinely public; optionalAuth is correct." If any entry is uncertain, default to requireAuth — public-by-default is a worse failure mode than auth-by-default for a luxury franchise OS.

### 9.3 F-Auth-5 — LOCKED. F-Auth-6 — deferred.

F-Auth-5 — **LOCKED to fold in.** Implementation as Step 6c (see §4.6). F-Auth-6 (`tokenUse` not gated for access vs ID tokens) — **deferred to follow-up PR** per v8 framing. Larger change, real scope, not coupled to the auth-contract reconciliation Step 6 is doing.

### 9.4 Deploy window — LOCKED (gate-driven, no calendar)

Locked: **no calendar deploy window.** Gate-driven sequence per §6. Reasoning: primepisodes.com has no real-user traffic at the time of this fix. The standard deploy-window framing (low-traffic prod window, 24-hour soak) optimizes for user-impact minimization, which does not apply here. Discipline comes from the gates, not the clock. Quality-over-speed locked as the binding constraint. Note: Prime Studios infra is dev + prod only — see Decision §9.9.

### 9.5 Branch coordination — LOCKED (solo PR)

Evoni is solo on this PR. No collaborator coordination required. Section retained as standing guidance for future fix PRs where the second developer (VS Code collaborator) may be active.

### 9.6 Genuine-public-route exemption rule — LOCKED

Locked at G1: **default to requireAuth if uncertain.** Specific per-route classifications produced during pre-flight:

- `decisionAnalytics.js` GETs — **NOT exempt** regardless. The caller-supplied `user_id` filter is a data-leak vector. Apply requireAuth.
- `manuscript-export.js` GET (download book) — exempt only if it serves published canon. Pre-flight to confirm. Default to requireAuth if scope is mixed.
- `press.js` GET `/characters` and `/characters/:slug` — exempt only if it serves public-press-kit data (what a journalist would see). Default to requireAuth if it returns full character canon.
- Mixed-verb files (`shows.js`, `characters.js`, `episodes.js`, `wardrobe.js`, `storyteller.js` published reads, `onboarding.js`, `storyHealth.js`): per-route classification. GETs serving published-only data → exempt with `// PUBLIC:` comment. GETs serving draft/private data → requireAuth. Writes always → requireAuth.
- Public-by-default is a worse failure mode than auth-by-default for a luxury franchise OS. When in doubt, requireAuth.

### 9.7 New findings absorbed at G1 — D17, D18, D19

Pre-flight surfaced three production exposures not present in v8 (Zone 26 closed before this granularity). All three are absorbed into the existing F-AUTH-1 plan — no scope expansion, just explicit naming so the implementation does not skip them.

**D17** — `episodes.js:307–315` PUT `/:id` uses optionalAuth with an in-code comment explaining: *"the previous strict authenticateToken caused a hard redirect to /login every time a creator's token expired."* This is the exact contract problem F-Auth-4 Path 1 solves. **Resolution:** once Step 6b lands (AUTH_REQUIRED vs AUTH_INVALID_TOKEN distinction with frontend refresh path), this route swaps to requireAuth. Captured in Step 3 sweep AND validated in §7 verification (route returns 200 authenticated, 401 unauth, mid-session expiry triggers refresh not logout).

**D18** — Two mutation routes have `authenticateToken` commented out for "TESTING": `episodes.js:400` (PUT `/:episodeId/scenes/reorder`) and `episodes.js:473` (POST `/:episodeId/scripts`). Currently shipping unauth in production. **This is more severe than F34** (F34 is unauth on franchise-brain; D18 is unauth on episode content — anyone can write scripts and reorder scenes on any episode). **Resolution:** Step 4 (sub-form b sweep) closes both. Uncomment authenticateToken (replaced by requireAuth as part of Step 6b migration). Add to §7.4 verification checklist.

**D19** — `episodes.js` POST `/` (CREATE) requires auth at `:302`, but PUT `/:id` (UPDATE) at `:313` tolerates missing token. Anyone with an episode ID can update without auth. **Resolution:** Same swap as D17 (Step 3 + Step 6b). Note: D17 and D19 reference the same route at the same lines — D19 is the user-visible consequence (anyone can edit episodes), D17 is the code-level cause (optionalAuth with workaround comment). One fix closes both.

### 9.8 Out-of-scope follow-ups (filed for post-F-AUTH-1)

Items surfaced during pre-flight but explicitly out of F-AUTH-1 scope. Filed for follow-up after F-AUTH-1 ships.

- **D20 cont.** — `jwtAuth.js` architectural disposition. Two parallel auth modules long-term? Separate audit needed.
- **`|| 'system'` fallback audit.** 8 sites beyond `thumbnails.js:80` use the pattern (`scriptsController.js` × 6, `sceneController.js:218`, `compositions.js:1126`). Reachability audit needed — same dead-code-vs-real-fallback question.
- **`arcTrackingRoutes.js`** references `optionalAuth` without importing it. Likely runtime error on first request. P1 follow-up: add the import and apply requireAuth.
- **`episodes.js:101/109/117` discrepancy** — v8 cataloged unauth; current code has `authenticateToken` on POST `:108` and DELETE `:116`. Was this fixed post-v8 or did v8 catalog wrong? No code action; surface for awareness.

### 9.9 Deploy infrastructure — LOCKED (dev + prod, no staging)

Locked at G1: **Prime Studios infrastructure is intentionally dev + prod only.** No staging environment exists or is planned for this audit cycle. The fix plan was originally written assuming dev/staging/prod three-environment topology; gates G4–G7 in v1.4 reflected that assumption. v1.5 collapses to two environments:

- **G4 (Dev verified + soak)** absorbs the staging-soak responsibility from former G5. The 2-hour soak now happens on dev before G5 prod cutover.
- **Former G5** (staging verified) is removed entirely.
- **Former G6** (prod cutover) is renumbered to G5.
- **Former G7** (post-deploy soak) is renumbered to G6.

Discipline implication: **dev does double duty.** G4 is a longer-running gate than the original plan implied because it now carries both verification and soak responsibilities. Do not partial-credit a soak that was interrupted by a code change — re-run the full 2-hour soak on the corrected build before proceeding to G5.

### 9.10 Cognito pool unification — discovered at G1, deferred

Pre-flight env-var verification surfaced an unintentional finding: dev and prod share the same Cognito User Pool and Client ID (`us-east-1_mFVU52978` / `lgtf3odnar8c456iehqfck1au`). This was not a deliberate single-tenant choice — discovered during PM2 runtime env check, intent confirmed as "did not realize they were the same."

- Implication: any user signed up via dev exists in prod. Any auth state created in dev affects prod. Token issued by dev validates against prod (same User Pool).
- F-AUTH-1 impact: **zero.** Both environments authenticate against real (non-placeholder) Cognito identifiers. F-Auth-2 boot-fail logic passes for both. Step 6b interceptor logic is pool-agnostic.
- **Out of F-AUTH-1 scope.** Filed as P1 architectural follow-up: split Cognito pools — separate dev pool with separate Client ID, prod pool retained as canonical user store, env config updated per environment. **Trigger condition: schedule before any beta tester or external user signs up.** Once a non-Evoni user exists in the shared pool, the split becomes a data-migration problem rather than a config change.

### 9.11 G2 progress log

Recorded as the F-AUTH-1 PR builds. Each entry is a commit on `feature/f-auth-1`. Backup of approved commits at `claude/f-auth-1-backup` on origin (§9.13 Rule 2).

- **Step 6a — APPROVED** (commit `9fa2e7bb`, re-implementation after lost original `23c9ffd`). BookEditor.jsx sendBeacon → fetch+keepalive migration. Authorization header flows via `authHeader()` helper.
- **Step 2 (F-Auth-3) — APPROVED** (commit `e80c711d`, re-implementation after lost originals `54d4d09` + `ab2ce44`). Three-case classifier + `degradeOnInfraFailure` flag + `Error.cause` preservation + four-case tests + bare-reference backward-compat test. 5 new tests, 431 total green.
- **Step 6b — IN PROGRESS.** Track 5 raw-fetch triage COMPLETE (commit `a929ce29` on dev). Track 1 apiClient interceptor update COMPLETE (commit `da604ed2` on `feature/f-auth-1`, backed up to `claude/f-auth-1-backup`). Track 1.5 + Track 1.6 added in v2.1 per Track 1 surfaces; both NOT STARTED. Track 1.5 (frontend test scaffolding) is next, then Track 1.6 (backend requireAuth split), then Track 2.
- **Steps 3, 4, 5, 1 — NOT STARTED.** Per §5.2 implementation order.

#### Surfaces for Step 6b reconciliation (preserved across two implementation rounds)

- Frontend has TWO auth-injection paths: axios `apiClient` interceptor at `src/services/api.js` + `authHeader()` direct-fetch helper at `frontend/src/utils/storytellerApi.js`. `BookEditor.jsx` uses `authHeader()`. Both must be reconciled in Step 6b. Inventory of `authHeader()` callers required before Step 6b implementation begins — this is a Step 6b prep deliverable.
- `jest.spyOn` cannot intercept calls from inside the same module on CommonJS const-bound exports (closure binding, not export reference). Use `jest.mock('<dependency-module>')` with the factory form. Worth knowing for future test additions.
- Polymorphic `optionalAuth` detection (middleware vs factory shape) means `optionalAuth.toString()` introspection is no longer reliable. No consumer in codebase does this; flagged in case Step 6b interceptor work hits it.
- `verifyToken` has TWO paths that wrap verifier errors with `Error.cause`: the test path (`NODE_ENV=test` → `tokenService.verifyToken`) and the prod path (aws-jwt-verify direct). Both were updated in Step 2; do not regress either if Step 6b reconciliation touches `verifyToken`.
- **Track 1 surfaces (preserved for sequencing):** (1) frontend has no test scaffolding — vitest in package.json but no config, no jsdom, no `.test` files; addressed by Track 1.5. (2) Backend `requireAuth` emits `AUTH_REQUIRED` for both no-header and verifier-rejected; new contract requires the split; addressed by Track 1.6. (3) `AUTH_GROUP_REQUIRED` returns 403 (not 401); code-before-status check in Track 1 interceptor handles this correctly. (4) `authService.refreshToken()` duplicates the new `refreshAccessToken` helper — kept separate in Track 1 to avoid circular auth; cleanup in §9.12.

### 9.12 Deferred cleanups (post-F-AUTH-1)

Note: the outer try/catch entry that was deferred in v1.6/v1.7 was **cleaned up during Step 2 implementation** (commit `e80c711d`). The defense-in-depth shell was hiding bugs (synchronous throws in console calls, `req.headers` access edge cases) that the new three-case structure handles explicitly. Removed entry from this list as resolved.

- Real metrics library — Step 2 ships with structured-log-derived metrics. If Prime Studios adds prom-client / opentelemetry / similar later, the F-Auth-3 call site is one line and trivially swappable.
- `console.debug` enablement — current ESLint config blocks it; Step 2 uses `console.log` as the quietest allowed level. If the project later wires up the `debug` package or adjusts ESLint, the F-Auth-3 quiet-log call site can move to `console.debug`.
- **`authService.refreshToken()` duplication** (surfaced in Track 1 §3.4) — `frontend/src/services/authService.js:125–147` has a `refreshToken()` method that nearly duplicates the new bare-axios `refreshAccessToken` helper in `src/services/api.js`. Track 1 kept them separate to avoid circular auth (authService imports api). Cleanup candidate when authService is touched in a Track 6 file: migrate `authService.refreshToken()` callers (login flow primarily) to use the bare-axios helper, then delete the apiClient-based duplicate.
- **Parallel-request refresh storm** (surfaced in Track 1 §3.7) — N simultaneous `AUTH_INVALID_TOKEN` responses trigger N parallel refresh calls. Backend rate-limiter (10/min) keeps it from being catastrophic but it is wasteful. Optimal solution: refresh-promise singleton — first request starts refresh, others await the same promise. Real complexity for marginal gain; deferred until evidence of operational impact.
- **ESLint v9 migration** — `.eslintrc.js` is the v8 format and ESLint v9 (installed) does not auto-detect it. Frontend lint has been broken for some time. Out of F-AUTH-1 scope; separate config-modernization PR.
- **Refresh-via-cookie hardening** — login endpoint sets a refreshToken httpOnly cookie (`src/routes/auth.js:75`), but the refresh endpoint at `:112` reads from request body only, ignoring the cookie. The Track 1 helper passes from localStorage (matching the body path). Cookie-based refresh would be a hardening follow-up; out of F-AUTH-1 scope.

### 9.13 Lost-work incident (May 2, 2026) + cleanup discipline

#### What happened

Three approved F-AUTH-1 implementation commits were lost when the Claude Code container holding them was reset before the work was pushed to origin:

- `23c9ffd` — Step 6a: BookEditor.jsx sendBeacon → fetch+keepalive
- `54d4d09` — Step 2 initial: F-Auth-3 three-case classifier + Error.cause preservation
- `ab2ce44` — Step 2 amendment: degradeOnInfraFailure flag + four-case unit tests

All three commits were verified real (not generated text) in their original session via `git show --stat`. They lived only in the local container's `.git` object store. Per the standing constraint "do NOT push to a PR yet," no push was made. The constraint was meant to prevent premature PR opening; it was incorrectly extended to mean no push at all. When the container was replaced before the F-AUTH-1 PR was ready, the three commits became unrecoverable — not present in any ref of any clone with origin access.

#### Recovery

- Original SHAs are documented in §9.11 as historical-only references. They will not appear in the eventual F-AUTH-1 PR commit graph.
- All implementation decisions reached during the lost work are preserved in this fix plan: §4.2 (Step 2 spec including `degradeOnInfraFailure` flag, `Error.cause` preservation, structured log schema with `degraded` field, four-case test requirement) and §4.6 (Step 6a CZ-5 spec).
- Re-implementation runs against the locked v1.7 spec, not from the original transcripts. If the new implementation diverges from the locked spec, fix plan amendment is the correct path — not "the original commit did it differently."

#### Cleanup discipline (LOCKED at v1.7, applies to all future F-AUTH-1 implementation work and all post-F-AUTH-1 fix work)

**Rule 1 — One Claude Code session at a time touches dev.**

If multiple Claude Code sessions are open, only one is the "writer" — the others are read-only. Writer is named at the start of each work block and stays the writer for the duration. Other sessions can read and diagnose but do not commit.

**Rule 2 — Every approved commit on `feature/f-auth-1` (or any feature branch) gets pushed immediately to a backup branch.**

- Backup branch name: `claude/f-auth-1-backup` (single, not date-stamped). Force-push is allowed; that is its purpose. Always points at the latest approved state.
- The push happens **the same turn as approval**, not "at the end of G2," not "next session," not "before opening the PR." Same turn.
- Command: `git push origin feature/f-auth-1:claude/f-auth-1-backup --force`

**Rule 3 — The canonical feature branch name stays clean for the eventual PR.**

`feature/f-auth-1` (or future `feature/f-app-1`, `feature/f-stats-1`, etc.) is pushed to origin only when the PR opens. Until then, all backups go to `claude/<feature>-backup`.

**Rule 4 — No PR opened until all steps are committed and approved.**

Push-to-backup is not a PR. The "do NOT open a PR yet" constraint stays. The "do NOT push" misinterpretation is rejected.

**Rule 5 — If a session container looks unstable, push backup before logging off.**

Indicators: container about to reset (rare warnings), switching machines, end of work session, network instability. When in doubt, push backup.

#### Why this is in the canon document

The audit principle from v8 §0 holds: **the audit trail is the audit trail.** Future Claude Code sessions reading this fix plan will see the lost-work incident and the discipline that followed it. Future sessions will be less likely to repeat the same failure mode because they read about it before starting work. This is operational learning made durable — exactly the use case "documentation as a living system" exists for.

---

## 10. What This Unblocks

Per v8 §4.1: every other P0 fix touches mutation routes. With F-AUTH-1 closed, the next-fix queue opens. The audit-locked sequence (§4 of v8) is:

| Tier | Keystone | Why it can ship after F-AUTH-1 |
|---|---|---|
| 1 | **F-App-1** | Schema-as-JS auto-repair removed from `app.js:262–328`. Structural prerequisite for F-Sec-3 and any character_state UNIQUE migration. Decision #47. |
| 1 | **F-Stats-1** | Build the missing CharacterState Sequelize model. Prerequisite for any F-Sec-3 cleanup. Decision #54. |
| 1 | **F-Ward-1** | Write the migration that captures `episode_wardrobe` canonical schema. Decision #59. |
| 1 | **F-Reg-2** | Address `registry_characters` write-contention. Pattern 41 master. |
| 1 | **F-Ward-3** | Delete the plural outfit-set controller (the routes the F-AUTH-1 sweep just protected). Decision #60. |
| 1 | **F-Sec-3** | Canonical-key consolidation. Subordinate to F-Franchise-1 per Decision #94. Blocked on F-App-1, F-Stats-1, F-Ward-1, AND F-Franchise-1. |
| 1 | **F-Franchise-1** | Director Brain build. The keystone fix for the disconnection between franchise tier and show tier. Decision #94. Builds the consumer wiring that routes `Universe.pnos_beliefs`, `world_rules`, `narrative_economy`, and `core_themes` into the production pipeline that currently runs on six private JS-literal copies. |

> **Director Brain framing**
>
> Director Brain is not a feature being built late. Per v8 §1.2 and Decision #94, Director Brain is the audit-recommended fix for F-Franchise-1. Its scope is now defined precisely: build the consumer wiring that the franchise tier was scaffolded for. The seeded spec at `seeders/20260312800000-show-brain-franchise-laws.js:335` already names its capabilities. The audit names its input contract. F-AUTH-1 is the foundation that makes shipping any of this safe.

---

## 11. Appendix A — File:line Reference Card

All references derived from Prime Studios Audit Handoff v8. Pre-flight (§5.1) confirmed each at G1 closure. **Drift from v8 noted inline below.** v8 closed May 1, 2026; codebase has shifted slightly. Sweep regex still works because patterns hold; specific line numbers do not.

> **Drift summary (G1 pre-flight)**
>
> - `app.js:364` (v8) → `src/app.js:330` (current). −34 lines.
> - `episodeOrchestrationRoute.js:135` (v8) → `:131` (current). −4 lines.
> - `wardrobe.js:895, :970` (v8) → `:1215, :1325` (current). +320, +355 lines.
> - `storyteller.js` individual lines drifted across the whole file. Pattern holds via grep regex.
> - All other audit references match within ±5 lines or exactly.

### Auth module (`middleware/auth.js`)

- `:13–22` — Cognito verifier construction with placeholder fallback (F-Auth-2 surface)
- `:44–46` — runtime env-var check inside `verifyToken` (the check that fires too late)
- `:164–168` — optionalAuth swallows all errors (F-Auth-3 surface)
- `:256–293` — duplicate `authenticateToken` implementation (F-Auth-4 surface)

### Global mount

- `app.js:364` — global `app.use(optionalAuth)` (sub-form a root)

### Sub-form (a) — confirmed surfaces

- `storyteller.js:38–43, 53, 113, 192, 213, 241, 263, 312, 333, 354, 553, 615, 636, 663, 738, 769, 790, 826, 856, 880, 910`
- `characterRegistry.js:12–22` (require-with-fallback), `~600` (isAuthor gate), `~1700`-line file with requireAuth on one route only
- `evaluation.js:587` (Stats save)
- `careerGoals.js` — every mutation route
- `uiOverlayRoutes.js` — every mutation route
- `calendarRoutes.js` — event CRUD, auto-spawn, world-event spawn
- `franchiseBrainRoutes.js` — 10 mutation routes (entries CRUD, activate, activate-all, archive/unarchive, ingest-document, guard, seed)
- `wardrobe.js:895` (`/select`), `:970` (`/purchase`)

### Sub-form (b) — confirmed surfaces

- `routes/outfitSets.js` — all 5 routes, no auth import
- `routes/episodes.js:101, :109, :117` — plural outfit-set controller mounts

### Sub-form (c) — confirmed surfaces

- `episodeOrchestrationRoute.js:135` (declares optionalAuth) → `:220` (writes orchestration_data)

### CZ-5

- `BookEditor.jsx:173–186` — sendBeacon beforeunload save

### F-Auth-5 — sites to swap (Step 6c)

- `decisionLogs.js:22` — `req.user?.sub` → `req.user?.id`
- `cursorPathController.js:22` — same pattern
- `iconCueController.js:22` — same pattern
- `musicCueController.js:20` — same pattern
- `productionPackageController.js:22` — same pattern
- `thumbnails.js:80` — drop fallback chain entirely; replace with `const userId = req.user.id;`

### F-Auth-4 — call sites to migrate (Step 6b)

- 103 mount sites across 17 files (full inventory in pre-flight report §14.1)
- Top-volume: `episodes.js` (14), `stories.js` (9), `search.js` (9), `notificationController.js` (9), `thumbnails.js` (7), `socketController.js` (7), `activityController.js` (7)
- Lazy-import fallbacks to update: `characterRegistry.js:17`, `worldEvents.js:28`
- Dead alias to drop: `middleware/auth.js:237` (Decision D21)

### Absorbed findings (G1) — closed by existing steps

- **D17 / D19** — `episodes.js:307–315` PUT `/:id` (closes via Step 3 + Step 6b)
- **D18** — `episodes.js:400` PUT `/:episodeId/scenes/reorder`, `:473` POST `/:episodeId/scripts` (`authenticateToken` commented out for "TESTING"; closes via Step 4)

### Out-of-scope — LOCKED, do not touch

- `jwtAuth.js` + its 9 callers at `routes/auth.js:10` and `routes/compositions.js:20` (Decision D20). Separate verification path; folding it into Step 6b is scope explosion, not consolidation.

---

---

## 12. Appendix B — Glossary

- **F-AUTH-1** — Tier 0 keystone in v8. Codebase-wide auth bypass on writes. Three sub-forms.
- **F-Auth-2** — `middleware/auth.js` module-load placeholder fallback (Step 1).
- **F-Auth-3** — optionalAuth cannot distinguish "Cognito down" from "anonymous user" (Step 2).
- **F-Auth-4** — requireAuth and `authenticateToken` are duplicate logic with one differing string (Step 6b).
- **F-Auth-5** — `req.user.id` vs `req.user.sub` split-brain, 6 sites total (decisionLogs.js:22, cursorPathController.js:22, iconCueController.js:22, musicCueController.js:20, productionPackageController.js:22, thumbnails.js:80). Folded into the F-AUTH-1 PR as Step 6c.
- **F-Auth-6** — `tokenUse` captured but not gated. Non-blocking; informs the recipe.
- **F34** — unauthenticated destructive writes on `/franchise-brain/*`. Subset of sub-form (a). Closes automatically in Step 3.
- **CZ-5** — sendBeacon cannot carry Authorization headers. BookEditor beforeunload save data-loss risk (Step 6a).
- **Sub-form (a)** — write routes currently using optionalAuth. The v6 keystone form.
- **Sub-form (b)** — write routes with NO auth middleware declared. Zone 23 finding.
- **Sub-form (c)** — write routes that explicitly declare optionalAuth on mutation paths. Zone 26 finding.
- **F-Franchise-1** — 7th keystone in v8. Director Brain build resolves it. Sequenced after F-AUTH-1.
- **`jwtAuth.js`** — separate verification path (custom JWT via TokenService, not Cognito). 9 production mounts. **Out of F-AUTH-1 scope per Decision D20.**
- **D17** — `episodes.js:307–315` PUT `/:id` uses optionalAuth as a workaround for the F-Auth-4 contract problem. Closed by Step 6b.
- **D18** — `episodes.js:400` + `:473` have `authenticateToken` commented out for "TESTING" in production. Currently shipping unauth. Closed by Step 4.
- **D19** — `episodes.js` PUT `/:id` at `:313` tolerates missing token. Same root cause as D17; one fix closes both.
- **D20** — `jwtAuth.js` disposition. LOCKED out of F-AUTH-1 scope. Architectural follow-up filed.
- **D21** — `middleware/auth.js:237` exports an unused `authenticate` alias. LOCKED to drop in Step 6b cleanup.
- **§9.9** — Deploy infrastructure: dev + prod only, no staging. G4 absorbs former G5 soak responsibility. Locked at G1.
- **§9.10** — Cognito pool unification: dev and prod share one Cognito User Pool/Client ID. Discovered at G1, deferred to post-F-AUTH-1. Trigger: split before any beta tester signs up.

---

*— end of document —*
