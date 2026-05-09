# F-AUTH-1 Fix-Planning Document

> **PRIME STUDIOS — F-AUTH-1 FIX-PLANNING DOCUMENT**
> First fix after audit close. Tier 0 keystone.
> Six-step coordinated single-PR plan.

**Document version:** v2.23 — Step 3 backend sweep fix plan locked. 11-CP cadence (10 domain CPs + 1 cleanup CP). ~803-handler sweep surface (writes on optionalAuth or no-auth). Step 3 disposition tier matrix (NEW architectural lock): Tier 1 requireAuth (default), Tier 2 requireAuth + authorize(["ADMIN"]) (admin tooling), Tier 3 optionalAuth({degradeOnInfraFailure:true}) (LOCKED PUBLIC with req.user consumption), Tier 4 plain optionalAuth (LOCKED PUBLIC without req.user), Tier 5 env-gated mount (development-only). All 17 planning-phase adjudication items locked. Track 7 timing Option C (hybrid — shared planning + separate execution). F-AUTH-2 lazy-init refactor + F-AUTH-3 9-handler degradeOnInfraFailure migration in CP1. F-AUTH-5 6/6 sites resolved naturally as F-AUTH-1 byproducts. Step 3 estimate ~20-22 sessions across 11 CPs.

**Author:** JAWIHP / Evoni — Prime Studios

**Status:** **TRACK 6 IMPLEMENTATION CLOSED.** Tracks 1, 1.5, 1.6, 2 (A+B), 2.5, 3 (Stage 1 + Stage 2), 4 complete. Track 6 CP2-CP15 COMPLETE (`04777edd`). 466 sites migrated across 70 files; 813/813 frontend tests across 102 test files; 100% of migratable scope. Pattern G locked: 6 sites (UNCHANGED). Backed up at `04777edd` on `claude/f-auth-1-backup`. **Step 3 backend sweep planning phase COMPLETE.** v2.23 locks 11-CP cadence + 5-tier disposition matrix + all 17 adjudication items. Step 3 CP1 (F-AUTH-2 lazy-init + F-AUTH-3 exemption list) kicks off next, fresh session.

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
  - In `requireAuth`: emit four distinct error codes based on what was wrong with the request:
    - No Authorization header → 401 with code `AUTH_REQUIRED` (current behavior; preserved)
    - Authorization header present but malformed (not 2 parts or not "Bearer ...") → 401 with code `AUTH_INVALID_FORMAT` (v2.3 amendment — see below)
    - Header valid format, verifier rejected token → 401 with code `AUTH_INVALID_TOKEN` (NEW)
    - Header valid format, Cognito infra failure → 503 with code `AUTH_SERVICE_UNAVAILABLE` (existing F-Auth-3 path; preserved)
  - Use the same Cognito-vs-rejected classifier landed in Step 2: `findCognitoInfraCause(err)` → if matches, this is an infra failure; else this is a token-rejection (emit `AUTH_INVALID_TOKEN`).
- Add unit tests for the split:
  - No header → 401 + `AUTH_REQUIRED`
  - Malformed header → 401 + `AUTH_INVALID_FORMAT` (v2.3 amendment — matches authenticateToken; Track 1 interceptor pass-throughs)
  - Header + valid token → 200 + `req.user` populated
  - Header + verifier-rejected token → 401 + `AUTH_INVALID_TOKEN` (NEW)
  - Header + Cognito infra failure → 503 (already covered by Step 2 tests; verify no regression)
- Once Track 1.6 lands, the F-Auth-4 Path 1 contract is complete on requireAuth routes: frontend interceptor + backend codes both speak the new vocabulary. Mid-session token expiry now triggers refresh, not logout.

##### Track 1.6 — AUTH_INVALID_FORMAT amendment (v2.3, locked from commit `e0b03d18`)

Track 1.6 was originally specced (v2.1) with three outcomes: `AUTH_REQUIRED` / `AUTH_INVALID_TOKEN` / `AUTH_SERVICE_UNAVAILABLE`. The malformed-header case (header present but not in "Bearer <token>" 2-part format) was inherited as `AUTH_REQUIRED` from prior code. Track 1.6 implementation review surfaced this as a contract mismatch:

- A logged-in user whose code accidentally sends a malformed Authorization header receives 401 `AUTH_REQUIRED`.
- Track 1 frontend interceptor reads `AUTH_REQUIRED` → wipes session and redirects to `/login`.
- Net effect: a client-side integration bug punts the user to login. The user IS logged in (the header is set); they should see an inline error, not a session redirect.

Resolution: **`requireAuth` emits `AUTH_INVALID_FORMAT` for the malformed-header case** (matches `authenticateToken`'s existing behavior at `auth.js:98`). The Track 1 interceptor already pass-throughs `AUTH_INVALID_FORMAT` per LOCKED §4.6 (the user sees the error inline, no redirect). The contract is now end-to-end consistent across all four codes:

- `AUTH_REQUIRED` → frontend redirects to login (correct: user is not logged in)
- `AUTH_INVALID_FORMAT` → frontend pass-through, inline error (correct: user IS logged in, integration bug)
- `AUTH_INVALID_TOKEN` → frontend refreshes-then-redirects (correct: user was logged in, token expired, auto-recover or escalate)
- `AUTH_SERVICE_UNAVAILABLE` → frontend caller decides UX (correct: not a session issue)

Implementation note: response message and error label aligned to `authenticateToken`'s existing `AUTH_INVALID_FORMAT` response for cross-middleware consistency. A 4-line comment at the malformed-header branch in `auth.js` documents the WHY, preventing future maintainers from "fixing" it back to `AUTH_REQUIRED`.

- Track 1.6 does NOT touch `authenticateToken` (which already emits `AUTH_INVALID_TOKEN` and `AUTH_INVALID_FORMAT`). `authenticateToken` is removed entirely later in Step 6b backend cleanup per §4.6 backend changes (LOCKED v1.8) — the duplicate at `middleware/auth.js:256–293` is deleted.
- Estimated: middleware change + tests = single commit. Reviewed and approved before Track 2 begins.

##### Pre-existing message-leak fix (silently closed in Track 1.6)

Pre-Track-1.6 `requireAuth`'s catch block returned `message: error.message` to clients — the wrapped verifier error message ("Token verification failed: JwtExpiredError: ..." etc.) leaked verifier internals. Track 1.6's refactor hardened this to a generic "The provided token is invalid or expired." message. Verifier internals stay in server-side logs only via the structured `[F-Auth-4] requireAuth: token rejected` log line. Net effect: small information-leak surface closed as a side effect of the spec'd work. Documented here so future readers see the fix was intentional, not silent.

##### Track 2 — Migrate Path A (authHeader) to apiClient (LOCKED v2.5, COMPLETE)

- 34 call sites across 7 files. Replace `fetch + ...authHeader()` spread with `apiClient` method calls.
- Tested change. Each migration must preserve: HTTP method, URL, payload shape, response shape consumption. Add tests for any migrated path that did not have them.
- Once migration is complete: delete `authHeader()` export from `frontend/src/utils/storytellerApi.js`. Confirm zero remaining imports before deletion.

**Track 2 implementation pattern (LOCKED v2.5 from commits `501cd737` + `59f9868a` + `a079a04b`) — helper-internal migration covers transitive call sites with zero touches:** if a Path A site is reached via a wrapping helper (e.g., `api()` in `storytellerApi.js`), migrate the helper's internals to call `apiClient` while preserving the helper's external contract (return shape, error throw shape). All transitive call sites are migrated by changing one helper. Use this pattern wherever Tracks 3/4/6/7 encounter wrapping helpers — saves linear-scan migration work.

**Track 2.5 amendment (v2.5):** for direct call sites that aren't reached via a wrapping helper, **extract small module-scope const helpers** from inline `apiClient.X(url, payload)` invocations into 1-4 line `export const helperName = (args) => apiClient.method(url, payload)` definitions. Tests import the helpers directly and verify call shape. This avoids full RTL component-render setup. Pattern proven across 8 helpers in 3 files (SectionEditor, StoryPlannerConversational, BookEditor) with zero RTL setup required. Apply pattern to Tracks 3/4/6/7 when migrated sites need behavioral test coverage.

- **Track 2 keepalive exception (LOCKED v2.5)** — `BookEditor.jsx:181` (the beforeunload save established by Step 6a per CZ-5) **cannot migrate to apiClient**. axios does not support `keepalive: true`; the request must survive page unload to satisfy CZ-5's data-loss-prevention contract. Migration converts this site from Path A (`...authHeader` spread) to Path D (inline `Bearer ${token}`) with a 6-line in-code comment explaining the exception. This is the only Path D site that has a documented engineering reason to remain after Track 4 lands. Track 4 verification grep must allowlist this site.

##### Track 3 — Migrate Path C (authHeaders plural duplicates) to apiClient (LOCKED v2.6, COMPLETE)

- 75 call sites across 9 files. Seven files define their own local `authHeaders()` helper; one shared in `feedConstants.js` used by `SocialProfileGenerator.jsx` (~40 sites alone) and `ProfileDetailPanel.jsx`.
- Migration consolidates the seven duplicate helpers AND migrates call sites to `apiClient`. Two-stage:
  - Stage 1: replace each local `authHeaders()` helper with `apiClient` calls at the call site. Delete the local helper.
  - Stage 2: migrate the shared `authHeaders()` in `feedConstants.js` + its consumers (`SocialProfileGenerator.jsx`, `ProfileDetailPanel.jsx`) to `apiClient`. Delete the shared helper.
- Pre-flight inventory noted subtle drift between copies (`useStoryEngine.js` accepts an extra param; others do not). The migration eliminates this drift surface.

**Track 3 architectural findings (v2.6, locked from commits `c6047c46` Stage 1 + `69f0a926` Stage 2):**

- **Five subtly different `authHeaders()` implementations dissolved into one apiClient interceptor contract.** Pre-migration shapes: A (Content-Type + optional Auth + 3-fallback), B (A + dead `extra=` param), C (Content-Type + always-Auth + no token guard), D (Content-Type + optional Auth + 2-fallback), E (Auth-only, relied on Express default JSON parse). Post-migration: uniform via apiClient. Drift surface eliminated.
- **SessionStorage fallback was unreachable code.** 5 of 7 helpers fell back through `localStorage.authToken || localStorage.token || sessionStorage.token`. Stage 1 §5 investigation found **zero** write sites for `sessionStorage.token` anywhere in the codebase — the third fallback was never reachable. apiClient's 2-fallback (`localStorage.authToken || localStorage.token`) covers every reachable token path. No interceptor change needed. The `sessionStorage.getItem('token')` pattern persists in 7 Path D files (App.jsx, SidebarProgress.jsx, FeedBulkImport.jsx ×2, NarrativeControlCenter.jsx, ProductionTab.jsx, WorldStudio.jsx) plus `feedConstants.js getToken()`; Track 4 will scrub these as it migrates the dependents.
- **Helper-name shadow conflicts when extracting Track 2.5-style helpers — Pattern F locked in §9.11.** SocialProfileGenerator.jsx had 11 component-local handlers whose names matched proposed module-scope exports. Resolution: `Api` suffix on the network helpers (finalizeProfileApi, crossProfileApi, etc.). Component handlers stay unchanged — they wrap the network helper plus UI state updates. Convention applies wherever Tracks 4/6 encounter files where component handler names mirror endpoint operation names.

##### Track 4 — Migrate Path D (inline Bearer) to apiClient (LOCKED v2.7, COMPLETE)

- 25+ call sites across ~17 files. Replace inline `Bearer ${token}` construction with `apiClient` method calls.
- Cohabiting files (apiClient + inline Bearer in the same file): `ProductionTab.jsx`, `WorldAdmin.jsx`. The inline Bearer sites in these files are accidental drift, not intentional dual-paradigm. Convert all to `apiClient`.
- Special case: `FeedBulkImport.jsx` mixes Path C local helper + Path D inline. Track 3 + Track 4 work converges in this file.
- **LOCKED EXCEPTION (v2.5 — Track 2 surfaced)** — `BookEditor.jsx:181` is the **only Path D site that survives Track 4**. The beforeunload save (Step 6a / CZ-5) requires `keepalive: true`; axios does not support keepalive, so apiClient cannot replace it without breaking CZ-5's data-loss-prevention contract. The site has a 6-line in-code comment documenting the exception, and a regression-lock test (Track 2.5) that asserts `apiClient.post/put/request` are NOT called when the keepalive helper fires. Track 4 must preserve this site, allowlist it in the verification grep, and not "fix" it.
- **getToken() handoff from Track 3 (LOCKED v2.6)** — `pages/feed/feedConstants.js` exports a `getToken()` function that reads the same 3-fallback chain (with the unreachable sessionStorage). Track 3 Stage 2 deleted the shared `authHeaders()` but kept `getToken()` because **seven Path D files import it**: App.jsx, SidebarProgress.jsx, FeedBulkImport.jsx (×2 sites), NarrativeControlCenter.jsx, ProductionTab.jsx, WorldStudio.jsx. Track 4 migrates these seven files to apiClient (which doesn't need `getToken` because the request interceptor reads localStorage directly). Once all seven importers are migrated, `getToken()` has zero callers and gets deleted from `feedConstants.js` as Track 4's final cleanup commit. After that deletion, the unreachable sessionStorage code path is fully eliminated from frontend production code.
- **Pattern F applies (LOCKED v2.6 §9.11)** — when extracting Track 2.5-style helpers from Track 4 files where component handler names mirror endpoint operation names, suffix the module-scope helper with `Api`. Track 3 Stage 2 surfaced this in SocialProfileGenerator.jsx (11 shadow conflicts resolved with the suffix). Tracks 4 and 6 will hit similar patterns in larger files — apply the convention from the start.

**Track 4 architectural findings (v2.7, locked from commits `08a24fec` migration + `06beb1d1` getToken deletion):**

- 25 active sites migrated across 19 files (1 site preserved per locked exception). **The only inline-Bearer construction in frontend production code is now BookEditor.jsx:55** — the CZ-5 keepalive helper, with 3 protective regression-lock tests (Track 2.5 lock). All other auth injection now flows through the apiClient request interceptor.
- **Inventory v2 scope correction — WorldStudio `headers()` helper covered 3 sites, not 32.** Track 4 surface re-read found the helper is scoped to the `CharacterFollowsTab` sub-component (line 468) with 3 callers, not module-scope wrapping all 32 file fetches. The other 29 fetches in WorldStudio.jsx are unrelated unauth Path E candidates (filed in §9.12). Surface-before-execute discipline caught the misclassification before any code changes.
- **BookEditor keepalive line corrected — inline-Bearer literal is at line 55, not line 181.** Track 2.5's extraction of `sendKeepaliveBeforeUnload` to module scope moved the literal from inline component-body (pre-2.5 line 181) to the helper definition (post-2.5 line 55). v2.5/v2.6 references to `BookEditor.jsx:181` are stale. v2.7 verification grep allowlist updated to `BookEditor.jsx:55`. Track 2.5 regression-lock tests (3 tests in `BookEditor.test.jsx`) cover the corrected line.
- **templateService stale-token bug self-resolved — inadvertent fix as side effect of the migration.** `templateService.js` cached `this.token = localStorage.getItem('authToken')` at construction time; re-login mid-session left the service using the stale token (inventory v2 §8.7 surfaced). Migration to apiClient eliminates the bug because the request interceptor reads localStorage fresh on every call. Same pattern as Track 1.6's pre-existing message-leak silent-fix: surface explicitly so it's not "silent."
- **NarrativeControlCenter.fetchJSON contract change — shipped behavioral change worth flagging.** Pre-Track-4 `fetchJSON` returned `res.json()` unconditionally including on non-2xx responses (callers received error bodies as if successful). Post-Track-4 `fetchJSON` throws on non-2xx via apiClient. All 17 callers verified to follow the happy-path `await fetchJSON(...).then(data => check shape)` pattern; none rely on receiving error bodies. Net effect: silent error-body returns eliminated; error handling now consistently flows through try/catch. Documented in `fetchJSON`'s docblock.
- **getToken() handoff was unnecessary — dead code, not dependent code.** v2.6 §4.6 Track 4 spec assumed seven Path D files imported `getToken` from feedConstants.js; Track 4 surface grep found **zero importers anywhere in the codebase**. The seven Path D files reimplemented the 3-fallback chain inline rather than importing the helper. feedConstants.getToken() was dead code through the entire F-AUTH-1 work and likely through prior history. Deleted in commit `06beb1d1` as the final Track 4 cleanup. The unreachable sessionStorage code path is now fully eliminated from frontend production code.
- **Pattern F applied prophylactically — did not trigger.** Track 4 surface flagged WorldAdmin.jsx (6000+ lines, not read end-to-end) as a Pattern F candidate. During migration, no shadow conflicts surfaced in WorldAdmin, ProductionTab, or WorldStudio. Conservative-application discipline correct: the cost of preparation was zero (naming convention from the start), the cost of mid-flow discovery would have been a refactor. Pattern F stays as canon for Track 6.

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

###### Track 6 multi-session pacing model (NEW v2.8)

CP2 (SceneSetsTab.jsx) execution surfaced that **high-density files cannot complete in one conversation session**. The 64 sites in SceneSetsTab.jsx are not 64 simple inline migrations — they are 64 fetch+state-update+toast+callback chains, each embedded in different surrounding state-management contexts. Per-site migration cost (read 15-30 lines of context, write a state-preserving Edit, sometimes trace downstream consumers) consumes meaningfully more conversation budget than a single-session checkpoint can absorb.

Pacing model amended (LOCKED v2.8): **a checkpoint spans sessions for high-density files**. The model is:

- **Session 1** through **Session N**: Claude Code migrates as far as available budget allows. Each session lands WIP commits on `feature/f-auth-1`. WIP commits are NOT pushed to backup — they are private progress markers across sessions.
- **Final session**: when the file is fully migrated (all sites + tests + verification grep), Claude Code squashes the WIP commits into a single coherent CP commit. Sends report. I review. Approve. Backup push.

This preserves the original review-once-per-checkpoint discipline. It just acknowledges that "checkpoint" does not mean "single conversation turn" for high-density files.

Estimated session counts: CP2 (SceneSetsTab, 64 sites) — 3-4 sessions. CP3 (WriteMode, 33 sites + 3,721 lines + Pattern F max density) — 2-3 sessions. CP4 (FranchiseBrain, 18 sites) — likely 1 session. CP5/CP6/CP7 mid-tier — 1 session each. CP8 long-tail — 1 session if the simpler-site hypothesis holds (1-3 sites per file, less surrounding state-management); multi-session if not. **Total Track 6 session estimate: 8-12 sessions.** Total commit count when squashed: 7-10 (unchanged from CP1 plan; squashing preserves clean history).

WIP commit discipline: each WIP commit must leave the working tree in a **clean state** — file compiles, no half-edits in the middle of a function, no dangling syntax errors. WIP commits are private to `feature/f-auth-1` and never go to backup until the checkpoint is complete. Pre-push hook should still pass on each WIP commit (it does today; existing async-handler warnings are informational and stay informational).

###### Per-site cost estimation in surface reports (NEW v2.8)

CP1 surface report estimated structural shape (uniform vs clustered, wrapping helpers vs direct, Pattern F risk) but **did not estimate per-site migration cost**. The 64-vs-64 site count match was correct as raw fetch count; the cost-per-site was 5-10x higher than expected because each site is embedded in a state-management chain. Surface reports for future high-density files (CP3+) must include per-site cost estimation.

- Surface report deliverable for high-density files (>20 sites): in addition to site count and structural shape, sample 3-5 representative sites and estimate per-site migration cost. Cost factors: (a) lines of context required to migrate safely, (b) presence of state-update chains, (c) downstream consumer tracing requirements, (d) Pattern F suffix-resolution overhead. The estimate informs session-count planning per the multi-session pacing model.
- Inventory v2 (Track 5 commit `a929ce29`) counted raw fetch literals only. It is correct as a count but undersells migration cost on dense files. Future tracks should treat inventory site counts as a lower bound on work, not a complete estimate.

###### Track 6 CP2 architectural findings (LOCKED v2.9, COMPLETE — SceneSetsTab.jsx)

CP2 completed at commit `30a15d05` (squashed from 4 WIP commits across multiple sessions per the v2.8 pacing model). 64/64 sites migrated, 39 module-scope helpers added with Pattern F Api suffix. 45 new behavioral tests added; full frontend suite at 180/180 passing. Backed up at `30a15d05` on `claude/f-auth-1-backup`.

**3 HTTP method corrections caught mid-flow — shipping bugs, not migration choices.** CP2 surfaced three sites where the original fetch used the wrong HTTP method against the backend route. The migration documented the correct method in the helper definition; the original wrong method has been shipping to production. Filed in §9.12 for Step 3 sweep awareness.

- `setCoverAngleApi` — backend route is PATCH; original code used GET. Backend tolerated it (or the path wasn't reaching execution) — the migration uses PATCH per backend contract.
- `reorderAnglesApi` — backend route is PATCH; original code used POST. Same disposition.
- `getAiCameraDirectionApi` — backend route is POST; original code used GET. Same disposition.

**Pattern: BUG-class migrations surface pre-existing HTTP method mismatches.** The migration writer should **use the correct method per backend contract** (it is a regression to preserve a wrong method) and surface the original wrong method in the report. Don't analyze why the original was wrong — the migration's job is correctness, not forensics. Step 3 sweep will further audit each route's contract.

- Pattern F prophylactic discipline confirmed correct. CP2 surfaced 8 component-handler shadow-conflict prone names (`handleCreate`, `handleDeleteSet`, `handleSetCoverAngle`, `handleAddAngle`, `handlePreviewPrompt`, `handleUploadAngleImage`, `handleCascadeRegenerate`, `handleReorderAngle`); the Api suffix on every helper from the start avoided 8 mid-flow refactors. Future high-density files (CP3 WriteMode, CP4 FranchiseBrain) apply Pattern F prophylactically from the first extraction per same discipline.
- Multi-session pacing model worked as designed. WIP commits across sessions, squash before approval, single CP2 commit at the end. Each session was a clean handoff via WIP commit hash. The `96cc3341 → 97808e97 → b328226b → 30a15d05` progression preserved progress without polluting the eventual squashed commit's history.

###### Track 6 CP3 architectural findings (LOCKED v2.10, COMPLETE — WriteMode.jsx)

CP3 completed at commit `b0127817` (squashed from 3 WIP commits across 3 sessions per the v2.8 pacing model). 31/33 sites migrated to apiClient via 17 module-scope helpers with Pattern F Api suffix. 2 sites retained as locked exceptions (streaming SSE — see Pattern G below). 25 new behavioral tests added; full frontend suite at 205/205 passing across 19 test files. Backed up at `b0127817` on `claude/f-auth-1-backup`.

- **Pacing model validated against two data points.** CP2 (SceneSetsTab, 64 sites) completed in 4 sessions (~16 sites/session). CP3 (WriteMode, 33 sites + 2 streaming exceptions) completed in 3 sessions (~11 sites/session — slightly slower per-site cadence due to higher state-management complexity per site, plus the streaming exception adjudication in Session 2). The v2.9 §4.6 forecast of "2-3 sessions" for CP3 held at the upper bound. The model holds for high-density files; CP4 (FranchiseBrain, 18 sites, lower density) is forecast at 1 session per same model.
- **Pattern F prophylactic discipline confirmed correct (second data point).** CP3 surfaced ~20 component-handler shadow-conflict prone names (saveDraft, generateSynopsis, generateTransition, generateProse, loadReferenceChapter, loadReviewLines, approveLine, rejectLine, saveLineEdit, saveTocSections, deleteTocSection, approveAll, handleContinue, handleDeepen, handleNudge, handleParagraphAction, handleChapterInstruction, commitAddChapter, commitTocRename, syncLinesToDraft); Pattern F suffix on every helper from the start avoided ~20 mid-flow refactors. The discipline is now validated across two files (CP2 + CP3); apply prophylactically to all high-density files going forward.
- **Streaming SSE exception class surfaced (Session 2) — Pattern G locked in §9.11.** WriteMode.jsx had two sites that use Server-Sent Events (SSE) to stream Claude AI generation incrementally: `WriteMode.jsx:980` (voice-to-story) and `WriteMode.jsx:1145` (story-continue in handleContinue). Both use `fetch() + res.body.getReader()` for incremental response-body reads. axios cannot stream response bodies in browsers (only in Node), so these sites cannot migrate to apiClient. Both retained as locked exceptions per the BookEditor.jsx:55 keepalive precedent: raw fetch + inline Bearer auth from localStorage + 9-line documenting comment + verification-grep allowlist.
- Implementation byte-identical across both streaming sites; only the endpoint path and payload differ. The 9-line comment template explains the SSE streaming requirement, the axios constraint, the inline-auth approach, and points at the v2.10 §4.6 + §9.11 canon. Future maintainers see the comment, do not "fix" by attempting apiClient migration.
- No HTTP method mismatches surfaced in CP3 (CP2 caught 3; CP3 caught 0). No Path E candidates surfaced. No bugs surfaced. Multi-session pacing handoffs (`2a021cf2 → 22ab7a4e → b0127817` squashed) were clean.
- CP3 squashed commit message follows the canonical Track 6 closing format: file name, sites migrated count, exceptions count and rationale, helpers added, test count, "Closes Track 6 CP3" marker. Future CPs follow same template.

###### Track 6 CP4 architectural findings (LOCKED v2.11, COMPLETE — FranchiseBrain.jsx; F34 CLOSED at call site)

CP4 completed at commit `11a82876` (single commit, single session — 1-session forecast held exactly per v2.10 §4.6). 18/18 sites migrated to apiClient via 11 module-scope helpers with Pattern F Api suffix. 20 new behavioral tests added; full frontend suite at 225/225 passing across 20 test files. Backed up at `11a82876` on `claude/f-auth-1-backup`.

**F34 from audit handoff v8 — CLOSED at the call site** by this commit. Server-side enforcement closes via Step 3 backend sweep on `franchiseBrainRoutes.js` (`optionalAuth → requireAuth` swap). The push-from-page route was already `requireAuth` and is the model the rest of the file conforms to per v2.10 §4.4. F34 marked closed in §9.12.

- Pattern F prophylactic discipline confirmed correct (third data point). 4 direct shadow conflicts (`unarchiveEntry`, `activateEntry`, `archiveEntry`, `deleteEntry` handlers ↔ same-named `*Api` helpers) cleanly avoided. ~7 indirect operation-name overlaps prevented from surfacing mid-flow. Discipline now validated across three files (CP2 + CP3 + CP4); apply prophylactically to all high-density and operation-named files going forward.
- Pattern G NOT triggered — verified zero SSE / keepalive / streaming markers in FranchiseBrain.jsx. Three Pattern G sites total in F-AUTH-1 scope (BookEditor.jsx:55, WriteMode.jsx:980, WriteMode.jsx:1145). No new Pattern G sites added.
- Throw-on-error idiom cleanup applied at every site. apiClient request interceptor handles non-2xx; the surrounding component-level try/catch already routed errors to `showToast`. Net: -2 LOC per site typical, -85 deletions total against +79 insertions in source file.
- Two-reload pattern (`load()` + `loadCounts()` after every entry mutation) preserved verbatim across `unarchiveEntry`, `handleCreate`, `activateEntry`, `archiveEntry`, `deleteEntry`, `bulkActivate`. UI-state-refresh discipline outside Track 6 scope.
- Promise.all parallelism preserved in `loadCounts` (4 GETs) and `bulkActivate` (filtered list). `loadCounts` collapsed from two-stage `Promise.all` (fetches + `.json()` parses) to one stage because axios returns parsed `data` directly — net cleanup.
- Error message fallback strengthened: `showToast(e.message || 'Failed to <op>', 'error')` preserves caller-thrown text when present and provides operation-named fallback when apiClient errors don't carry a message.
- Path E candidates surfaced: 8 GET sites on `/franchise-brain/*` (entries listing ×6 + documents + amber-activity) filed for §9.12 Step 3 sweep awareness. CP4 read suggests all are auth-required (LalaVerse internal knowledge); Step 3 backend audit will adjudicate per-route disposition.
- No HTTP method mismatches surfaced (CP2 caught 3, CP3 caught 0, CP4 caught 0). File-level variation expected per v2.9 §9.12 finding pattern.

###### Pacing model validated against three data points (UPDATED v2.11)

Three checkpoints across Track 6 high-density / mid-density work:

- **CP2** (SceneSetsTab.jsx, 64 sites): 4 sessions, ~16 sites/session. Highest density file. Per-site state-management complexity (fetch+state+toast+callback chains) drove session-count up.
- **CP3** (WriteMode.jsx, 33 sites + 2 Pattern G exceptions): 3 sessions, ~11 sites/session. State-management complexity per site higher than CP2; two-stage saveDraft, fire-and-forget patterns, closure captures, thenable rewrites, plus mid-flow Pattern G surface adjudication.
- **CP4** (FranchiseBrain.jsx, 18 sites): 1 session, 18 sites/session. Lower-density file with no state-management chains, no fire-and-forget, no closures, no Pattern G triggers. Throughput at the upper end of the band.

Throughput band: **11-18 sites/session**, modulated by file's state-management complexity. The cost-class predictor (simple/medium/complex distribution from surface report) is now a reliable input to session-count forecasting. CP5+ uses this band for forecasting:

- Files with state-management chains, fire-and-forget, closure captures: forecast 11-13 sites/session (CP3 zone)
- Files with simple shape (mostly direct fetch + setState + reload): forecast 15-18 sites/session (CP4 zone)
- Files with combined density and complexity: forecast 14-16 sites/session (CP2 zone)

CP5 mid-tier targets per v2.10 CP1 priority order: `StoryThreadTracker.jsx` (~10 sites), `EpisodeScenesTab.jsx` (~10 sites), `SeriesPage.jsx` (~8 sites). Three files at 8-10 sites each. CP5 surface report will adjudicate whether they cluster into one CP commit (if Pattern F surfaces are similar across them) or split into CP5/CP6/CP7 (if files are independent in their migration shape).

###### Track 6 CP5 architectural findings (LOCKED v2.12, COMPLETE — mid-tier batch)

CP5 completed at commit `c306ad4d` (single squashed commit, 3 file-boundary WIPs collapsed; single session). 28/28 sites migrated across three files via 27 module-scope helpers with Pattern F Api suffix (helpers duplicated locally per file, 4 cross-file overlaps with CP2 SceneSetsTab handlers preserved as duplicates per file-local convention). 37 new behavioral tests added; full frontend suite at 262/262 passing across 23 test files. Backed up at `c306ad4d` on `claude/f-auth-1-backup`.

Per-file breakdown:

- `frontend/src/pages/StoryThreadTracker.jsx` — 11 sites, 11 helpers, 14 tests. Idiom: `if (res.ok) { ... }` collapsed (apiClient interceptor handles failure via thrown error caught by component-level catch).
- `frontend/src/components/Episodes/EpisodeScenesTab.jsx` — 9 sites, 9 helpers (3 duplicated from CP2), 11 tests. Idiom: success-envelope `{ success, data, error }` preserved verbatim via `res.data?.success`.
- `frontend/src/pages/SeriesPage.jsx` — 8 sites, 7 helpers (1 duplicated from CP2), 12 tests. Idiom: `if (!res.ok) throw` removed (apiClient interceptor throws). Error path strengthened to read `err.response?.data?.error || err.message` preserving pre-migration 4xx body exposure.

**File-local helper convention LOCKED v2.12. Helper modules are file-local; cross-file imports are not used in F-AUTH-1 even when endpoints overlap.** Validated against 4 cross-file duplications in CP5 (3 in EpisodeScenesTab: `listSceneSetsApi`, `suggestAnglesApi`, `createAngleApi` + 1 in SeriesPage: `listShowsApi`). Each duplicated helper is ~3 LOC; total drift surface ~12 LOC. Rationale: each CP commit's helper module is self-contained per CP2/CP3/CP4 precedent; cross-file imports would break test-per-file isolation; bounded duplication is cheaper than coupling.

- Pattern F prophylactic discipline confirmed correct (fourth data point). All three CP5 files had LOW direct-shadow density (zero direct conflicts; ~15 indirect operation-name overlaps total). Suffix from first extraction kept the migration mechanical. Discipline now validated across four files (CP2 + CP3 + CP4 + CP5 batch); apply prophylactically to all Track 6 files going forward.
- Pattern G NOT triggered — verified zero SSE / keepalive / streaming markers across all three files. Three Pattern G sites total in F-AUTH-1 scope remain (BookEditor.jsx:55, WriteMode.jsx:980, WriteMode.jsx:1145). No new Pattern G sites added.
- Throw-on-error idiom cleanup applied where applicable (StoryThreadTracker, SeriesPage). Success-envelope preservation applied where applicable (EpisodeScenesTab). Three different idioms migrated cleanly per file with no cross-contamination.
- Promise.all parallelism preserved in StoryThreadTracker (`fetchThreads`, `fetchVoice`) and SeriesPage (`load`). Sequential POST loop in EpisodeScenesTab.`generateAngles` preserves await semantics inside `for...of`.
- Path E candidates surfaced from CP5: ~10 GET sites filed for §9.12 Step 3 sweep awareness.
- No HTTP method mismatches surfaced (CP2 caught 3, CP3-CP5 caught 0). The three method-correction findings remain a CP2-specific finding pattern; later CPs running cleanly on this dimension.
- CP5 squashed commit message follows the canonical Track 6 closing format with the mid-tier-batch variant: per-file site count breakdown, helpers added, tests added, "Closes Track 6 CP5" marker.

###### Pacing model — 4 data points validated, multi-file batch effect (NEW v2.12, supersedes v2.11 §4.6 3-data-point band)

Four checkpoints across Track 6 high-density / mid-density work:

- **CP2** (SceneSetsTab.jsx, 64 sites): 4 sessions, ~16 sites/session. Highest density single file with state-management complexity.
- **CP3** (WriteMode.jsx, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session. Single file with state-management chains, fire-and-forget, closure captures, mid-flow Pattern G adjudication.
- **CP4** (FranchiseBrain.jsx, 18 sites): 1 session, 18 sites/session. Single lower-density file with simple shape.
- **CP5** (StoryThreadTracker + EpisodeScenesTab + SeriesPage, 28 sites): 1 session, **28 sites/session** — exceeded the v2.11 throughput band's upper bound. Multi-file batch of simple-shape files stacked higher than predicted.

Updated throughput model — **multi-file batch effect locked** as a fifth predictor:

- **Single high-density file** with state-management chains, fire-and-forget, closure captures: 11-13 sites/session (CP3 zone)
- **Single mid-density file** with combined density: 14-16 sites/session (CP2 zone)
- **Single lower-density simple file**: 15-18 sites/session (CP4 zone)
- **Multi-file batch of simple-shape files** (each <600 LOC, 8-12 sites each): 25-30 sites/session (CP5 zone) — NEW

Why CP5 exceeded the single-file throughput band: (a) all three files were simple-shape (verified pre-execution via surface report), (b) per-site cost averaged 4.7 min/site (CP4 was 5.1, CP3 was 10.7), (c) sites distributed across 3 smaller files vs concentrated in one larger file, (d) file-boundary WIP discipline gave clean per-file checkpoints, (e) no mid-flow surprises (no Pattern G, no HTTP method corrections, no architectural decisions to adjudicate during execution).

CP6 mid-tier batch 2 targets per v2.10 CP1 priority order: `CharacterGenerator.jsx`, `ContinuityEnginePage.jsx`, `TemplateDesigner.jsx`, `CharacterTherapy.jsx`. Total estimated ~30 sites across 4 files. CP6 surface report will adjudicate whether the multi-file batch effect applies (single CP6 commit) or whether file-specific complexity argues for splitting. If shapes are similar to CP5 (all simple), single-session execution at ~25-30 sites/session is achievable. If any file has CP3-zone state-management complexity, the batch may split.

**Track 6 progress as of CP5: 141 sites migrated** across 5 files (SceneSetsTab 64 + WriteMode 31 + FranchiseBrain 18 + StoryThreadTracker 11 + EpisodeScenesTab 9 + SeriesPage 8). 3 Pattern G locked exceptions (BookEditor:55 + WriteMode:980,1145). Tests grew from 135 (Track 6 start) to 262 (+127). Track 6 projected total ~345 sites; current progress ~41% by site count. Remaining: CP6 mid-tier batch 2 (~30 sites across 4 files), then CP7-CP8 long-tail (~165 sites distributed across ~50 files at 1-8 each).

###### Track 6 CP6 architectural findings (LOCKED v2.13, COMPLETE — mid-tier batch 2; heterogeneous-complexity batch effect validated)

CP6 completed at commit `2e3db223` (single squashed commit, 4 file-boundary WIPs collapsed; single session despite 38 sites + heterogeneous complexity). 38/38 sites migrated across four files via 35 module-scope helpers with Pattern F Api suffix (helpers duplicated locally per file; 2 cross-CP overlaps with CP3 WriteMode handlers preserved as duplicates per file-local convention). 51 new behavioral tests added; full frontend suite at 313/313 passing across 27 test files. Backed up at `2e3db223` on `claude/f-auth-1-backup`.

Per-file breakdown:

- `frontend/src/pages/CharacterGenerator.jsx` — 10 sites, 8 helpers, 12 tests. MEDIUM-HIGH cost class (CP3 zone, ~80 min) — held within 90-min hard cap. Mixed idioms (success-property checks for POSTs, `if (res.ok)` for GETs); preserved verbatim, no idiom cleanup. 2 distinctive patterns: nested Promise.all over batch entries (handleProposeSeeds + handleGenerateBatch), manual commit loop with double-click guard (handleCommitAll).
- `frontend/src/pages/CharacterTherapy.jsx` — 9 sites, 9 helpers (2 duplicated from CP3), 12 tests. Idiom: `if (data.success)` lowercase boolean — preserved via `res.data?.success`. File-local duplication of `listRegistriesApi` + `getRegistryApi` (~6 LOC).
- `frontend/src/pages/ContinuityEnginePage.jsx` — 10 sites, 10 helpers, 14 tests. Idiom: `if (!res.ok) return` collapsed (CP4 zone). Cascade pattern preserved (`await loadConflicts` after each beat mutation).
- `frontend/src/pages/TemplateDesigner.jsx` — 9 sites, 8 helpers, 13 tests. Idiom: `status === 'SUCCESS'` uppercase-string envelope — preserved verbatim. Method-branching split: `handleSave`'s POST/PUT branching cleanly split into `createTemplateApi` + `updateTemplateApi` with call-site conditional. setInterval polling site cleanly migrated (apiClient call inside interval callback; clearInterval semantics unchanged).

**Inline-anonymous-onClick handling pattern LOCKED v2.13.** When fetch sites are inline anonymous async arrow inside JSX onClick handlers, extract to module-scope helper, call from named handler function. Validated against 2 sites in CP6 (CharacterGenerator:312 + CharacterTherapy:625). Rationale: inline anonymous async arrows are anti-Pattern-D — hard to test, hard to refactor, harder to debug. Cost ~2 LOC per extraction; produces testable handler functions matching CP2/CP3/CP4/CP5 discipline.

**Hardest-first execution discipline LOCKED v2.13.** In multi-file batches with heterogeneous cost-class distribution, migrate the highest-complexity file first. Combined with explicit hard-cap on the hardest file (CP6 used 90-min cap on CharacterGenerator; not triggered, but available as a fail-fast diagnostic). Rationale: complexity surprises in the hardest file are most likely to force WIP-and-resume; surfacing them first preserves clean checkpoint discipline. CP6 validated this — CharacterGenerator completed within cap, the simple files batched cleanly afterward.

- Pattern F prophylactic discipline confirmed correct (fifth data point). All four CP6 files had LOW direct-shadow density. Suffix from first extraction kept the migration mechanical across heterogeneous complexity.
- Pattern G NOT triggered — verified zero SSE / keepalive / streaming markers across all four files. Three Pattern G sites total in F-AUTH-1 scope remain.
- Four different success-shape idioms across four files all migrated cleanly: mixed (CG), boolean success (CT), throw-on-error collapse (CE), uppercase SUCCESS envelope (TD). Idiom heterogeneity in a single batch is now validated as manageable.
- Path E candidates surfaced from CP6: ~13 GET sites filed for §9.12 Step 3 sweep awareness.
- No HTTP method mismatches surfaced (CP2 caught 3, CP3-CP6 caught 0). Pattern established: CP2 was the outlier; later CPs run cleanly on this dimension.

###### Pacing model — 5 data points validated, heterogeneous-batch effect (NEW v2.13, supersedes v2.12 §4.6 4-data-point band)

Five checkpoints across Track 6 high-density / mid-density / multi-file work:

- **CP2** (SceneSetsTab.jsx, 64 sites): 4 sessions, ~16 sites/session.
- **CP3** (WriteMode.jsx, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session.
- **CP4** (FranchiseBrain.jsx, 18 sites): 1 session, 18 sites/session.
- **CP5** (3-file uniform-simple batch, 28 sites): 1 session, 28 sites/session.
- **CP6** (4-file heterogeneous batch — 1 medium-high + 3 simple, 38 sites): 1 session, **38 sites/session**. Hardest-first ordering with 90-min cap on hardest file kept it single-session.

Updated throughput model — **heterogeneous-batch effect locked** as a sixth predictor:

- **Single high-density file** with state-management chains: 11-13 sites/session (CP3 zone)
- **Single mid-density file** with combined density: 14-16 sites/session (CP2 zone)
- **Single lower-density simple file**: 15-18 sites/session (CP4 zone)
- **Multi-file batch of uniform simple-shape files**: 25-30 sites/session (CP5 zone)
- **Multi-file batch with heterogeneous complexity** (mostly simple + 1 medium-high): 35-40 sites/session (CP6 zone) — NEW

Why CP6 worked at 38 sites/session despite heterogeneous complexity: (a) hardest-first execution surfaced no surprises in CharacterGenerator (cost class held within forecast), (b) 90-min hard cap was a guardrail that didn't need to fire — diagnostic confirmation of accurate forecasting, (c) file-boundary WIP discipline gave clean checkpoints throughout, (d) file-local helper duplication kept each file self-contained, (e) idiom heterogeneity (4 different success-shape idioms across 4 files) didn't cause cross-contamination because each file's migration is structurally isolated.

Long-tail forecast (CP7+): ~165 sites distributed across ~50 files at 1-8 sites each. Average ~3.3 sites/file. Most files will have <5 sites and migrate trivially; the challenge becomes volume and per-file overhead (read context, extract helpers, write tests, verify) rather than per-site complexity. Forecast: CP7+ uses long-tail batching (10-15 files per CP commit). Per-CP throughput: ~30-40 sites covering ~10-15 files. Total CP7+ commits estimated: 4-6 commits to clear remaining ~165 sites.

**Track 6 progress as of CP6: 179 sites migrated** across 9 files (SceneSetsTab 64 + WriteMode 31 + FranchiseBrain 18 + StoryThreadTracker 11 + EpisodeScenesTab 9 + SeriesPage 8 + CharacterGenerator 10 + CharacterTherapy 9 + ContinuityEnginePage 10 + TemplateDesigner 9). 3 Pattern G locked exceptions. Tests grew from 135 (Track 6 start) to 313 (+178). Track 6 projected total ~345 sites; **current progress ~52% by site count** — past the halfway mark. Remaining: CP7+ long-tail (~165 sites distributed across ~50 files at 1-8 each).

###### Track 6 CP7 architectural findings (LOCKED v2.14, COMPLETE — long-tail batch 1; multipart-upload + internal-helper-refactor patterns surfaced)

CP7 completed at commit `75c804e4` (single squashed commit, 10 file-boundary WIPs collapsed; single session). 39/39 sites migrated across ten files via 37 module-scope helpers with Pattern F Api suffix (1 cross-CP overlap with CP3 + CP6 handlers preserved as duplicate per file-local convention). 55 new behavioral tests added; full frontend suite at 368/368 passing across 37 test files. Backed up at `75c804e4` on `claude/f-auth-1-backup`. Simplest-first execution order validated for long-tail batches.

Per-file breakdown:

- `Home.jsx` (1 site), `SessionStart.jsx` (1), `StoryHealthDashboard.jsx` (1), `CommandPalette.jsx` (1), `PdfIngestZone.jsx` (1, multipart) — 5 warm-up files cleared cadence in first ~15 min
- `AICostTracker.jsx` (6 sites), `EpisodeTodoPage.jsx` (6), `AmberCommandCenter.jsx` (6), `CFOAgent.jsx` (8), `WorldDashboard.jsx` (8) — 5 anchors covering 34 sites across diverse idioms

**Multipart upload pattern LOCKED v2.14 (NEW — first F-AUTH-1 multipart site).** `PdfIngestZone.jsx` uses FormData for PDF upload; pattern: pass FormData directly as second argument to `apiClient.post(url, formData)`. **Do NOT manually set Content-Type header.** axios detects FormData payload and sets the multipart Content-Type with the correct boundary automatically. The pre-migration code's comment "No Content-Type header — browser sets it with boundary automatically" is preserved verbatim by axios behavior. Future Track 6 multipart sites follow the same pattern.

**Internal-helper-refactor pattern LOCKED v2.14 (NEW — surfaced in WorldDashboard).** `WorldDashboard.jsx` had its own internal `safeFetch(url)` wrapper used by 8 callers. Pattern: **refactor the wrapper internally to use apiClient rather than migrating each caller individually.** Caller-side simplicity preserved (8 callers unchanged); the migration is a single edit inside `safeFetch`. Future tracks encountering similar internal-fetch-wrapper patterns follow the same approach. Avoids unnecessary call-site churn.

**Method-correction discovery — surface-time vs mid-flow (NEW v2.14).** CFOAgent's setBudget endpoint was identified as PUT (not POST) **during the surface report's sample-site analysis, NOT mid-flow during execution.** This is the first method correction caught at surface time across F-AUTH-1. CP2 caught 3 mid-flow; CP3-CP6 caught 0 mid-flow; CP7 caught 1 at surface. With surface-with-cost-estimation discipline (locked v2.8 §4.6), method-correction discovery moves earlier in the workflow. The CP2 finding pattern of "BUG-class migrations surface pre-existing HTTP method mismatches mid-flow" gets an addendum: surface-report rigor catches them at surface time when achievable. Both discovery modes remain valid; surface-time is preferred.

- Pattern F prophylactic discipline confirmed correct (sixth data point). All 10 CP7 files had LOW direct-shadow density. Suffix from first extraction kept the migration mechanical even at long-tail batch composition with 10 files.
- Pattern G NOT triggered — verified zero SSE / keepalive / streaming markers across all 10 files. Three Pattern G sites total in F-AUTH-1 scope remain.
- Five distinct idioms across 10 files all migrated cleanly: thenable + .catch (Home, StoryHealthDashboard), Promise.all thenable (AICostTracker, EpisodeTodoPage), async + if(!res.ok) throw (AmberCommandCenter, parts of CFOAgent), mixed thenable + async (CFOAgent), internal helper refactor (WorldDashboard).
- Helper reuse within a file: CP7 surfaced one example (CFOAgent.`getQuickStatsApi` covers 2 sites — mount + post-budget refresh).
- Promise.all parallelism preserved: AICostTracker (5 parallel GETs), EpisodeTodoPage (3 parallel GETs). With apiClient returning parsed `res.data` directly, the typical two-stage Promise.all (fetches + `.json()` parses) collapses to one stage — net cleanup.
- Path E candidates surfaced from CP7: ~12 GET sites filed for §9.12 Step 3 sweep awareness.
- CP7 squashed commit message follows the canonical Track 6 long-tail format with per-file site count breakdown, helpers added, tests added, and the new patterns surfaced (multipart, internal-helper-refactor) noted.

###### Pacing model — 6 data points, long-tail batch effect at 10 files (NEW v2.14, supersedes v2.13 §4.6 5-data-point band)

Six checkpoints across Track 6:

- **CP2** (1 file, 64 sites): 4 sessions, ~16 sites/session.
- **CP3** (1 file, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session.
- **CP4** (1 file, 18 sites): 1 session, 18 sites/session.
- **CP5** (3 files uniform-simple, 28 sites): 1 session, 28 sites/session.
- **CP6** (4 files heterogeneous, 38 sites): 1 session, 38 sites/session.
- **CP7** (10 files long-tail simplest-first, 39 sites): 1 session, **39 sites/session**. Long-tail batch effect at higher file count held throughput band.

Updated throughput model (CP7-zone added; CP6-zone broadened):

- **Single high-density file** (state-management chains): 11-13 sites/session (CP3 zone)
- **Single mid-density file** (combined density): 14-16 sites/session (CP2 zone)
- **Single lower-density simple file**: 15-18 sites/session (CP4 zone)
- **Multi-file batch uniform-simple shape** (3-4 files): 25-30 sites/session (CP5 zone)
- **Multi-file batch heterogeneous** (1 medium-high + simples, 4 files): 35-40 sites/session (CP6 zone)
- **Long-tail batch simplest-first** (~10 files, mostly small site counts): 35-40 sites/session (CP7 zone) — NEW

Why CP7 worked at 39 sites/session despite 10 files: (a) simplest-first execution built migration cadence in the first ~15 min via 5 single-site warm-ups, (b) anchor files were structurally simple (mostly thenable or async with throw-on-error or success-envelope idioms), (c) per-file overhead — read context, extract helpers, write tests, verify — was the dominant cost as v2.13 §4.6 forecast predicted, but didn't exceed budget at 10-file scale, (d) zero Pattern G triggers, (e) the one method correction was caught at surface, not mid-flow.

###### Long-tail forecast updated to actuals (NEW v2.14, supersedes v2.13 §4.6 estimate)

CP7 inventory reconciliation against branch tip surfaced more accurate long-tail counts than v2.13's projection:

- Pre-CP7 actuals: **84 files with bare fetch sites, 325 total sites** (vs v2.13 estimate of 50 files / 165 sites)
- Post-CP7 actuals: 74 files with bare fetch sites, 286 total sites
- Pattern G locked exceptions: 3 (BookEditor:55, WriteMode:980, WriteMode:1145)
- Path E cluster: 35 sites (WorldStudio.jsx 29 + locked PUBLIC 5 + UIOverlaysTab external-blob 1, all deferred to Step 3)
- Estimated BUG-class remaining for Track 6 migration: **~248 sites across ~70 files**

Updated CP forecast: **6-8 more CPs total to close Track 6** (down from v2.13's 8-10 estimate, but up from v2.13's 4-6 because actual remaining sites are higher than v2.13 projected). At ~35-40 sites per CP at the CP7 throughput zone, ~248 remaining sites = 6-7 more CPs by raw arithmetic; high-density deferrals (useStoryEngine 14, WorldAdmin 11, EpisodeDetail 10) likely warrant dedicated CPs at lower throughput, balancing out to 4-5 long-tail CPs + 2-3 dedicated single-file CPs. Trajectory remains coherent.

**Track 6 progress as of CP7: 218 sites migrated** across 19 files. 3 Pattern G locked exceptions. Tests grew from 135 (Track 6 start) to 368 (+233). **Current progress ~63% by site count** (218 / ~345). Remaining: CP8+ long-tail (~248 sites across ~70 files). CP8 candidate batch composition: world/* cluster (WorldFoundation, WorldStateTensions, SceneStudio, NovelAssembler, StoryProposer) + small filler files = ~30-35 sites. Defer high-density deferrals (useStoryEngine, WorldAdmin, EpisodeDetail) to dedicated CPs in CP9+ since each is potentially CP3-zone complexity.

###### Track 6 CP8 architectural findings (LOCKED v2.15, COMPLETE — long-tail batch 2; cross-CP duplication scaling + pattern composability validated)

CP8 completed at commit `e5d4355f` (single squashed commit, 10 file-boundary WIPs collapsed; single session). 38/38 sites migrated across ten files via 46 module-scope helpers with Pattern F Api suffix (11 cross-CP duplications across 5 files — highest cross-CP density of any CP yet). 56 new behavioral tests added; full frontend suite at 424/424 passing across 46 test files. Backed up at `e5d4355f` on `claude/f-auth-1-backup`.

Per-file breakdown (simplest-first execution order):

- `ArcTrackingPanel.jsx` (1 site, thenable warm-up), `NarrativeControlCenter.jsx` (1, joins existing Track 4 fetchJSON), `RelationshipEngine.jsx` (1, registries duplicate from CP3+CP6+CP7), `ChapterBrief.jsx` (1, updateChapter duplicate from CP3), `ImportDraftModal.jsx` (1, importChapter duplicate from CP3) — 5 single-site warm-ups
- `SceneStudio.jsx` (6 sites, clean /world/*), `NovelAssembler.jsx` (6, clean /stories/*), `WorldStateTensions.jsx` (7, full CP7 helper duplication ×7), `StoryProposer.jsx` (7, registries duplicate + /memories/*), `WorldFoundation.jsx` (7, multipart + method-branching + 4 idiom sub-shapes — last per simplest-first)

**Pattern reuse confirmed (second instances for both): multipart upload + method-branching split now validated against 2 files each.** WorldFoundation.uploadMapApi is the second F-AUTH-1 multipart site (PdfIngestZone was first); pattern held with `apiClient.post(url, formData)` and no manual Content-Type. WorldFoundation.saveLocation's editId-conditional split into `createLocationApi` + `updateLocationApi` reused CP6 TemplateDesigner pattern, with call site doing the conditional ternary.

**Existing-test-file amendment convention LOCKED v2.15 (NEW). When amending a file with existing helpers and tests, append new helpers/tests to existing files rather than creating duplicate test files.** Validated against `RelationshipEngine.jsx` in CP8 — file already had 11 helpers (presumably from earlier track work), CP8 appended +1 helper (`listRegistriesApi`) and +1 test rather than creating a duplicate test file. Relevant for CP9+ — `StoryEvaluationEngine.jsx` and `NarrativeIntelligence.jsx` have existing test files from earlier tracks; same append-not-overwrite discipline applies.

**Cross-CP duplication scaling validated (NEW v2.15 note). v2.12 §9.11 file-local convention scales without coupling concerns at 11 cross-CP duplications in a single CP.** CP5 had 4 dups, CP6 had 2 dups, CP7 had 1 dup, CP8 had 11 dups across 5 files (~33 LOC). The test-isolation benefit dominates the LOC cost. WorldStateTensions duplicating 7 helpers from CP7 WorldDashboard is the largest single-file cross-CP duplication in F-AUTH-1; the file-local module block kept the migration mechanical.

**Pattern composability validated (NEW v2.15 note). First file applying three locked patterns simultaneously: WorldFoundation.jsx applied multipart upload (v2.14) + method-branching split (v2.13) + idiom mix (mixed thenable/async/multipart) in one file.** Migrated cleanly. Pattern composability was implicit in the convention library; CP8 explicitly validates that locked patterns can stack within a single file without cross-contamination.

- Pattern F prophylactic discipline confirmed correct (seventh data point). All 10 CP8 files had LOW direct-shadow density.
- Pattern G NOT triggered. One false-positive ruled out at surface (ChapterBrief comment text "downstream"). Three Pattern G sites total in F-AUTH-1 scope remain.
- Five distinct idioms across 10 files all migrated cleanly: thenable + .catch (ArcTrackingPanel, NarrativeControlCenter), simple async (RelationshipEngine, ChapterBrief, ImportDraftModal), success-property check (SceneStudio), if-res-ok throw collapse (NovelAssembler, StoryProposer), dense one-liners mirroring CP7 (WorldStateTensions), 4-shape mix (WorldFoundation: async + thenable + multipart + method-branching).
- No HTTP method mismatches surfaced (CP3-CP6+CP8 all clean; CP7 caught 1 at surface; CP2 caught 3 mid-flow). Method-correction discovery rate: 4/8 CPs caught zero, 1/8 caught at surface, 1/8 caught mid-flow. Pattern: surface-time discovery preferred when achievable.
- Path E candidates surfaced from CP8: ~16 GET sites filed for §9.12 Step 3 sweep awareness (with deduplication note: 3 GETs already filed by CP7 for /world/state/* family).

###### Pacing model — 7 data points, long-tail simplest-first reproducibility validated (NEW v2.15)

Seven checkpoints across Track 6:

- **CP2** (1 file, 64 sites): 4 sessions, ~16 sites/session.
- **CP3** (1 file, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session.
- **CP4** (1 file, 18 sites): 1 session, 18 sites/session.
- **CP5** (3 files uniform-simple, 28 sites): 1 session, 28 sites/session.
- **CP6** (4 files heterogeneous, 38 sites): 1 session, 38 sites/session.
- **CP7** (10 files long-tail simplest-first, 39 sites): 1 session, 39 sites/session.
- **CP8** (10 files long-tail simplest-first, 38 sites): 1 session, **38 sites/session**. CP7 zone reproducibility validated.

CP7 + CP8 establish the long-tail simplest-first pattern as **reliably reproducible at the 35-40 sites/session band** for 10-file batches with idiom diversity and bounded cross-CP duplication. Two consecutive single-session executions at near-identical site counts and file counts confirm the throughput band is not a fluke. CP9+ uses this band for forecast.

Throughput model unchanged from v2.14 — six predictors. v2.15 broadens the CP7 zone applicability via the CP8 second data point but does not introduce a new zone.

###### Long-tail forecast updated to actuals — post-CP8 (UPDATED v2.15)

CP8 inventory reconciliation:

- Pre-CP8: 74 files / 286 sites (matched CP7 close exactly; no external work touched implementation files)
- Post-CP8: **64 files / 248 sites**
- Path E cluster (deferred to Step 3): WorldStudio.jsx 29 + LOCKED PUBLIC 5 + UIOverlaysTab external blob 1 = 35 sites
- Pattern G locked exceptions: 3 (BookEditor:55, WriteMode:980, WriteMode:1145)
- Estimated BUG-class remaining for Track 6 migration: **~210 sites across ~58 files**

Updated CP forecast: **3-4 more long-tail CPs to clear ~140 long-tail sites at CP7-zone throughput** + 2-3 dedicated CPs for the remaining high-density files (useStoryEngine 14, WorldAdmin 11, EpisodeDetail 10) at CP3/CP4-zone throughput. Total: 5-7 more CPs to close Track 6. Trajectory remains coherent.

**Track 6 progress as of CP8: 256 sites migrated** across 29 files. 3 Pattern G locked exceptions. Tests grew from 135 (Track 6 start) to 424 (+289). **Current progress ~74% by site count** (256 / ~345). Remaining: CP9+ long-tail (~210 sites across ~58 files). CP9 candidate batch composition: mid-density anchors mix — TextureReviewPage (5), SocialImport (5), StoryEvaluationEngine (5, existing test file — append), StoryEngine (5), CharacterProfilePage (5), WritingRhythm (5), NarrativeIntelligence (5, existing test file from CP3 mocks — append) + small filler = ~35-40 sites. Defer high-density deferrals (useStoryEngine, WorldAdmin, EpisodeDetail) to dedicated CPs in CP10+.

###### Track 6 CP9 architectural findings (LOCKED v2.16, COMPLETE — long-tail batch 3; binary-response + service-module + hook patterns surfaced)

CP9 completed at commit `1830605e` (single squashed commit, 8 file-boundary WIPs collapsed; single session). 40/40 sites migrated across eight files via 41 module-scope helpers with Pattern F Api suffix (1 cross-CP duplication: `SocialImport.listCharacterSocialApi` from CP8 NovelAssembler). 67 new behavioral tests added; full frontend suite at 491/491 passing across 54 test files. Backed up at `1830605e` on `claude/f-auth-1-backup`. StoryEvaluationEngine deferred to CP10 at surface time (cross-cluster + 2 cross-CP duplicates + existing structural-test-file warrants its own focused commit).

Per-file breakdown (simplest-first execution order):

- `services/showService.js` (5 sites, service-method internal refactor — precedence inversion), `SocialImport.jsx` (5, clean cluster + 1 cross-CP dup), `StoryEngine.jsx` (5, multi-cluster — first binary-response site at `readStoryApi` for ElevenLabs TTS audio), `TextureReviewPage.jsx` (5, texture-layer cluster — 2 helpers cover 4 sites)
- `CharacterProfilePage.jsx` (5, 3-way Promise.all + nested-loop fetch), `useGenerationJob.js` (5, hook + polling preserved), `NarrativeIntelligence.jsx` (5, multi-cluster — WriteMode mock conflict empirically cleared), `WritingRhythm.jsx` (5, URL composition concern preserved verbatim + PATCH method verified at surface)

**Binary-response pattern LOCKED v2.16 (NEW — first F-AUTH-1 binary-response site).** `StoryEngine.readStoryApi` for ElevenLabs TTS audio uses `apiClient.post(url, payload, { responseType: 'blob' })`. **Pre-migration code did `await res.blob()` after fetch; axios with responseType:'blob' returns the blob directly as response.data.** Future Track 6 binary-response sites (PDFs, audio, images) follow the same pattern. Joins multipart upload (v2.14) as the second non-JSON apiClient interaction pattern.

**Service-module internal-refactor pattern LOCKED v2.16 (NEW — validated by showService.js).** When a service module exposes the canonical accessor for an endpoint family, **refactor each method's internals to use apiClient while preserving the service contract (method signatures + return shapes) unchanged for consumers.** Tests use `vi.mock` for apiClient and call service methods directly (e.g. `showService.getAllShows()`). Different from page-level helper extraction.

**Hook module-scope helper pattern LOCKED v2.16 (NEW — validated by useGenerationJob.js). Helpers exported from hook module-scope as `export const`; consumers of the hook unchanged.** Polling lifecycle preserved when applicable. Different from page/component shape; same Pattern D test approach via direct named imports. Joins the page (CP2-CP8) and service module (CP9 showService) shapes as a third structural class for helper extraction in F-AUTH-1.

**Service-module precedence inversion (NEW v2.16 note — observed at showService.js).** When a service module is the canonical accessor for an endpoint family, file-local duplicates in earlier CPs are downstream copies of the service contract, not parallel copies. showService.js is the canonical /shows accessor; CP2 SceneSetsTab + CP5 SeriesPage + CP7 (via listShowsApi) file-local duplicates exist downstream of this contract. v2.12 file-local convention still applies; this is a clarifying observation about precedence, not a new rule.

**URL composition preserved-verbatim discipline (NEW v2.16 — validated by CP9 WritingRhythm.jsx).** When surface-time analysis reveals an unusual URL composition pattern (e.g., empty API base, missing /api/v1/ prefix), preserve verbatim during migration. Don't fix. Don't investigate. Surface for Step 3 audit. WritingRhythm uses `const API = import.meta.env.VITE_API_URL || ''` empty default + `${API}/writing-rhythm/...` = relative paths without /api/v1/ prefix. Migration preserved this composition verbatim. apiClient.baseURL is also empty string. NOT corrected at the migration layer.

- Pattern F prophylactic discipline confirmed correct (eighth data point). All 8 CP9 files had LOW direct-shadow density.
- Pattern G NOT triggered. Three false-positives ruled out at surface ("downstream" comment/JSX text). Three Pattern G sites total in F-AUTH-1 scope remain.
- NarrativeIntelligence mock conflict empirically cleared (validated at execution). CP3 WriteMode.test.jsx mock factory returns only `{ default: () => null }`; new CP9 named exports coexist without conflict. Verified: 491/491 tests pass including WriteMode (180 helper tests preserved) + NarrativeIntelligence (8 new tests).
- Method-correction discipline: 1 verified at surface (WritingRhythm /multi-product/:id/status PATCH confirmed against source line 192). CP7 surface-time precedent applied. Total method-correction discoveries: 5 across 9 CPs (CP2 caught 3 mid-flow, CP7 caught 1 at surface, CP9 verified 1 at surface).
- Path E candidates surfaced from CP9: ~10 GET sites filed for §9.12 Step 3 sweep awareness (some dedup-noted from CP2/CP5/CP8).

###### Pacing model — 8 data points, CP7-9 zone validated as 3-consecutive-reproducible (NEW v2.16, supersedes v2.15)

Eight checkpoints across Track 6:

- **CP2** (1 file, 64 sites): 4 sessions, ~16 sites/session.
- **CP3** (1 file, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session.
- **CP4** (1 file, 18 sites): 1 session, 18 sites/session.
- **CP5** (3 files uniform-simple, 28 sites): 1 session, 28 sites/session.
- **CP6** (4 files heterogeneous, 38 sites): 1 session, 38 sites/session.
- **CP7** (10 files long-tail simplest-first, 39 sites): 1 session, 39 sites/session.
- **CP8** (10 files long-tail simplest-first, 38 sites): 1 session, 38 sites/session.
- **CP9** (8 files long-tail simplest-first, 40 sites): 1 session, **40 sites/session**. CP7-9 zone validated as 3-consecutive-reproducible.

CP7 + CP8 + CP9 establish the long-tail simplest-first pattern as **robust across file-count variation 8-10 files at the 35-40 sites/session band.** Three consecutive single-session executions at near-identical site counts confirm the throughput band is reliable for forecast. v2.16 broadens the CP7-9 zone applicability: **site count is the dominant predictor; file count modulates per-file overhead within the 8-10 file empirical envelope.**

Throughput model unchanged — six predictor zones. v2.16 strengthens the CP7-9 zone confidence via three data points but does not introduce a new zone.

###### Long-tail forecast updated to actuals — post-CP9 (UPDATED v2.16)

CP9 inventory reconciliation:

- Pre-CP9: 64 files / 248 sites (matched CP8 close exactly)
- Post-CP9: **56 files / 208 sites**
- Path E cluster (deferred to Step 3): WorldStudio.jsx 29 + LOCKED PUBLIC 5 + UIOverlaysTab external blob 1 = 35 sites
- Pattern G locked exceptions: 3 (BookEditor:55, WriteMode:980, WriteMode:1145)
- Estimated BUG-class remaining for Track 6 migration: **~170 sites across ~50 files**

Updated CP forecast: **3-4 more CPs to close Track 6**. CP10 long-tail mid-density batch (StoryEvaluationEngine deferred-from-CP9 + StoryDashboard with API='' verification + 2-3 of TemplateStudio/CompositionDetail/StoryPlanner + 4-5 small filler = ~35-40 sites in 8-10 files). CP11 second long-tail batch with remaining mid-density + filler. CP12-13 dedicated CPs for high-density singles (useStoryEngine 14, WorldAdmin 11, EpisodeDetail 10) at CP3/CP4-zone throughput. WorldSetupGuide (8 mixed PUBLIC+BUG) likely folds into a long-tail CP. Trajectory remains coherent.

**Track 6 progress as of CP9: 296 sites migrated** across 37 files. 3 Pattern G locked exceptions. Tests grew from 135 (Track 6 start) to 491 (+356). **Current progress ~86% by site count** (296 / ~345). Remaining: CP10+ (~170 sites across ~50 files). Track 6 is in the home stretch.

###### Track 6 CP10 architectural findings (LOCKED v2.17, COMPLETE — long-tail batch 4; multi-pattern existing-test-file amendment + variable-URL split + 6-fold cross-CP existence)

CP10 completed at commit `85095a80` (single squashed commit, 8 file-boundary WIPs collapsed; single session). 42/42 sites migrated across eight files via 39 module-scope helpers with Pattern F Api suffix (9 cross-CP duplications across 6 files). 65 new behavioral tests added; full frontend suite at 556/556 passing across 61 test files. Backed up at `85095a80` on `claude/f-auth-1-backup`.

Per-file breakdown (simplest-first execution order):

- `CharacterDepthPanel.jsx` (4 sites, clean cluster), `CulturalCalendar.jsx` (4, listShowsApi 4-fold dup), `NewBookModal.jsx` (4, mixed clusters — getUniverseApi covers 2), `CompositionDetail.jsx` (6, 1 CP6 dup — generateOutputsApi covers 2)
- `TemplateStudio.jsx` (6, 1 CP6 dup), `StoryPlanner.jsx` (7, 2 CP3 dups — updateChapterApi reused 5×; highest helper-reuse), `StoryDashboard.jsx` (6, URL composition verbatim — second instance), `StoryEvaluationEngine.jsx` (5, 3 cross-CP dups + variable-URL split + structural-test-file amendment — last per simplest-first)

**StoryEvaluationEngine — first multi-pattern existing-test-file amendment LOCKED v2.17.** Three locked patterns applied simultaneously to one file: (1) v2.13 method-branching split applied to URL-branching variant (line 1243 conditional URL split into `getBookApi` + `listAllChaptersApi` with caller doing ternary); (2) v2.15 existing-test-file amendment applied to a STRUCTURAL test file (`fs.readFileSync` against source); (3) v2.16 cross-CP duplication scaling at 6-fold (`listRegistriesApi` reaches highest cross-CP existence in F-AUTH-1). Existing structural assertions remain valid post-migration (apiClient import preserved, no authHeaders, internal apiPost/apiGet wrappers unchanged). vi.mock hoisted to top so it applies to dynamic imports inside the new describe block. Final: 16 tests in single file (6 Track 3 structural + 10 new CP10 helper tests), all passing.

**Branching-split generalization LOCKED v2.17 (NEW). v2.13 §9.11 method-branching split (PUT vs POST conditional) generalizes to any conditional shape at the call site — method, URL, or both.** Helper extraction handles each branch as a separate helper; call site does the ternary. Validated at CP6 TemplateDesigner (method-branching: PUT/POST same URL) and CP10 StoryEvaluationEngine line 1243 (URL-branching: GET different URLs based on bookId). Future tracks encountering branching at any axis follow the same convention.

**Structural-test-file amendment validation LOCKED v2.17 (NEW). v2.15 §9.11 existing-test-file amendment scales to both behavioral test files (CP8 RelationshipEngine) and structural test files (CP10 StoryEvaluationEngine).** For structural tests (`fs.readFileSync` against source asserting on shape/imports), existing assertions remain valid post-migration when migration preserves apiClient import + absence of authHeaders + internal wrappers. vi.mock hoisting required if dynamic imports are added in new describe blocks.

**Cross-CP existence high-water mark (NEW v2.17 note). `listRegistriesApi` reaches 6-fold cross-CP existence at CP10** (CP3 + CP6 + CP7 + CP8 RelationshipEngine + CP8 StoryProposer + CP10 StoryEvaluationEngine). Empirical ceiling for cross-CP duplication density. v2.12 file-local convention scales without coupling concerns up to and including 6-fold existence. Each duplicate is ~3 LOC; ~18 LOC total across all 6 files. Test isolation per file dominates LOC cost.

**Pattern composability — second instance (NEW v2.17 note). CP6 WorldFoundation was first triple-pattern file (multipart + method-branching + idiom mix); CP10 StoryEvaluationEngine is the second triple-pattern file (URL-branching + existing-test-file amendment + 6-fold cross-CP duplication).** Pattern composability is now validated at 2 data points across diverse pattern combinations. Patterns compose cleanly within a single file without cross-contamination, regardless of which 3 (or more) locked patterns apply.

- Pattern F prophylactic discipline confirmed correct (ninth data point). All 8 CP10 files had LOW direct-shadow density.
- Pattern G NOT triggered — verified zero across all 8 files.
- StoryDashboard URL composition preserved verbatim — second instance after CP9 WritingRhythm. v2.16 §9.11 pattern lock validated against 2 instances. Step 3 audit should adjudicate both observations together.
- No HTTP method mismatches surfaced (CP3-CP6+CP8-CP10 all clean mid-flow). Total method-correction discoveries: 5 (CP2 caught 3 mid-flow, CP7 caught 1 at surface, CP9 verified 1 at surface).
- 9 cross-CP duplications across 6 files in CP10. CP8 had 11 (largest single-CP); CP10 is second-largest.
- Path E candidates surfaced from CP10: ~10 GET sites filed for §9.12 Step 3 sweep awareness (many dedup-noted from CP3+/CP5/CP6/CP8).

###### Track 6 denominator correction — actual scope ~469 sites vs ~345 projected (NEW v2.17, supersedes prior projections)

Self-flagged at CP10 reconciliation: the "% of Track 6 by site count" framing has been using ~345 as the denominator since v2.13. CP10 inventory reconciliation surfaces the actual Track 6 BUG-class scope is closer to ~469 sites.

Arithmetic:

- Cumulative migrated post-CP10: 338 sites (CP2 64 + CP3 33 + CP4 18 + CP5 28 + CP6 38 + CP7 39 + CP8 38 + CP9 40 + CP10 42)
- Inventory remaining at branch tip post-CP10: 48 files / 166 sites total
- Minus deferred Path E cluster: 35 sites (WorldStudio.jsx 29 + LOCKED PUBLIC 5 + UIOverlaysTab external blob 1)
- BUG-class remaining: 166 − 35 = **~131 sites**
- Total Track 6 BUG-class scope: 338 + 131 = **~469 sites**

Pattern observed across the project: each inventory reconciliation surfaced higher actuals than the prior projection. v2.13 estimated 50 files / 165 sites; CP7 reconciliation surfaced 84 files / 325 sites (post-CP7); v2.16 used ~345 as Track 6 denominator; CP10 reconciliation confirms ~469 actual. The projection error is acknowledged, not corrective — it does not change the tracked migration count or the per-CP actuals.

Reframed Track 6 progress: **338 / 469 = ~72% by site count after CP10** (not 98% as the ~345 denominator implied). Remaining ~131 sites across ~42 files. **5-7 more CPs to close Track 6:** 3-4 long-tail CPs (CP11+ at CP7-10 zone throughput 35-42 sites/session) + 2-3 dedicated high-density singles (useStoryEngine 14, WorldAdmin 11, EpisodeDetail 10 at CP3/CP4-zone throughput) + WorldSetupGuide 8 mixed PUBLIC+BUG (likely folds into a long-tail CP since per-site adjudication is bounded).

###### Pacing model — 9 data points, CP7-10 zone validated as 4-consecutive-reproducible (NEW v2.17, supersedes v2.16)

Nine checkpoints across Track 6:

- **CP2** (1 file, 64 sites): 4 sessions, ~16 sites/session.
- **CP3** (1 file, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session.
- **CP4** (1 file, 18 sites): 1 session, 18 sites/session.
- **CP5** (3 files uniform-simple, 28 sites): 1 session, 28 sites/session.
- **CP6** (4 files heterogeneous, 38 sites): 1 session, 38 sites/session.
- **CP7** (10 files long-tail simplest-first, 39 sites): 1 session, 39 sites/session.
- **CP8** (10 files long-tail simplest-first, 38 sites): 1 session, 38 sites/session.
- **CP9** (8 files long-tail simplest-first, 40 sites): 1 session, 40 sites/session.
- **CP10** (8 files long-tail simplest-first, 42 sites): 1 session, **42 sites/session**. CP7-10 zone validated as 4-consecutive-reproducible.

CP7 + CP8 + CP9 + CP10 establish the long-tail simplest-first pattern as **thoroughly reproducible across 4 consecutive checkpoints** at the 35-42 sites/session band in 8-10 file batches. The throughput band is not a fluke; it is the empirical baseline for forecast at long-tail batch composition.

Throughput model unchanged — six predictor zones. v2.17 broadens the CP7-10 zone confidence via four data points but does not introduce a new zone.

###### Long-tail forecast updated to actuals — post-CP10 (UPDATED v2.17)

CP10 inventory reconciliation:

- Pre-CP10: 56 files / 208 sites (matched CP9 close exactly)
- Post-CP10: **48 files / 166 sites**
- Path E cluster (deferred to Step 3): WorldStudio.jsx 29 + LOCKED PUBLIC 5 + UIOverlaysTab external blob 1 = 35 sites
- Pattern G locked exceptions: 3 (BookEditor:55, WriteMode:980, WriteMode:1145)
- Estimated BUG-class remaining for Track 6 migration: **~131 sites across ~42 files**

Updated CP forecast: **5-7 more CPs to close Track 6**. CP11 cleanup-overlap batch (PressPublisher 4 mixed PUBLIC+BUG + CultureEvents 4 pairs with CulturalCalendar + WorldLocations 4 heavy CP8 overlap + ~6-8 small filler files = ~30-40 sites in 8-10 files). CP12 second long-tail batch with remaining mid-density + filler. CP13-15 dedicated CPs for high-density singles (useStoryEngine 14, WorldAdmin 11, EpisodeDetail 10) at CP3/CP4-zone throughput. WorldSetupGuide (8 mixed PUBLIC+BUG) likely folds into a long-tail CP. Trajectory remains coherent.

**Track 6 progress as of CP10: 338 sites migrated** across 45 files. 3 Pattern G locked exceptions. Tests grew from 135 (Track 6 start) to 556 (+421). **Current progress ~72% by site count** (338 / ~469 corrected denominator). Remaining: CP11+ (~131 sites across ~42 files). Past the two-thirds mark; well into the home stretch but more substantial work remaining than prior projections suggested.

###### Track 6 CP11 architectural findings (LOCKED v2.18, COMPLETE — cleanup-overlap batch; new throughput high-water mark + mixed PUBLIC+BUG convention + combined-axis branching)

CP11 completed at commit `87460600` (single squashed commit, 17 file-boundary WIPs collapsed; single session). 51 BUG-class fetch sites migrated across seventeen files via ~37 module-scope helpers with Pattern F Api suffix. 3 sites retained per discipline: PressPublisher:119 LOCKED PUBLIC + WriteModeAIWriter:281 + AppAssistant:239 (latter two new Pattern G locked sites). 14 cross-CP duplications across 6 files — largest single-CP cross-CP duplication count in F-AUTH-1. 127 new behavioral tests added; full frontend suite at 683/683 passing across 78 test files. Backed up at `87460600` on `claude/f-auth-1-backup`. CP11 surface arithmetic projected 45 migrated; actual was 51 (surface understated by 6). Outcome exceeded projection; quality maintained.

Per-file breakdown (simplest-first execution, 17 files):

- Filler tier (8 fresh-helper files at 3 sites each = 24 sites): `RecycleBin`, `PropertyManager`, `SiteOrganizer`, `SetupWizard`, `StoryCalendar` (storyteller-scoped distinct from /calendar/* per surface correction), `usePageData` (hook), `EpisodeDistributionTab`, `ContinuityGuard`.
- Mid-tier with cross-CP duplications (5 files at 3 sites each = 15 sites): `CharacterProfile` (3 CP9 dups), `LayoutEditor` (1 CP6 dup), `SceneInterview` (1 CP3 dup, updateChapterApi 3-fold), `StoryReviewPanel` (1 CP9 dup).
- Anchor tier (3 files at 4 sites each = 12 sites): `WorldLocations` (4 CP8 dups + combined-axis branching at line 141), `CultureEvents` (4 CP10 dups, listShowsApi 5-fold), `PressPublisher` (4 sites: 1 LOCKED PUBLIC retained + 3 BUG migrated incl. URL-branching split at line 124).
- Pattern G tier (2 files at 3 sites each = 6 sites; 4 migrated + 2 locked): `WriteModeAIWriter` (line 281 streaming locked, lines 329 + 405 migrated), `AppAssistant` (line 239 streaming locked, lines 69 + 205 migrated).

**Mixed PUBLIC+BUG convention LOCKED v2.18 (NEW — first F-AUTH-1 instance at PressPublisher.jsx). When a single file contains a mix of LOCKED PUBLIC and BUG-class fetch sites, apply per-site adjudication during surface analysis.** LOCKED PUBLIC sites retain raw fetch with a 9-line PUBLIC comment block referencing inventory v2 §4.2 + F-Auth-3 degradeOnInfraFailure exemption list (parallel to BookEditor:55 / WriteMode:980 Pattern G locked-comment template, but for PUBLIC disposition rather than streaming). BUG-class sites in the same file migrate to apiClient with module-scope helpers per the standard Path A discipline. The file's test scaffolding includes a structural assertion that the LOCKED PUBLIC site's raw fetch is preserved post-migration (parallel to v2.17 §9.11 structural-test-file amendment shape applied to CP10 StoryEvaluationEngine). Validated against PressPublisher line 119 in CP11 (1 LOCKED PUBLIC + 3 BUG migrated). Future tracks encountering mixed-disposition files (WorldSetupGuide deferred to CP15 with 3 LOCKED PUBLIC + 5 BUG) follow the same convention.

**Combined-axis branching split — stacking validated (NEW v2.18 note, NOT a new convention). v2.13 §9.11 method-branching split + v2.17 §9.11 URL-branching generalize natively to combined axes — a single conditional may switch BOTH method AND URL simultaneously, handled by the existing convention without extension.** Validated at CP11 WorldLocations:141 — saveLocation's editId conditional selects PUT /world/locations/:id when editing OR POST /world/locations when creating, on the same line. Convention application: extract `updateLocationApi(id, payload)` + `createLocationApi(payload)` as separate helpers covering both branches; call site does single ternary covering combined axes (`editId ? updateLocationApi(...) : createLocationApi(...)`). No new lock language required; v2.18 documents this as "stacking validated" — the convention library handles combined-axis branching natively.

**Pattern G allowlist update LOCKED v2.18 (3 → 5 locked sites). First Pattern G additions since CP3.** Two new streaming-response-body locked sites added in CP11: WriteModeAIWriter:281 (res.body.getReader() preceded by line 273 streaming kickoff fetch with AbortController.signal) + AppAssistant:239 (res.body.getReader() preceded by line 215 streaming kickoff fetch). 9-line locked comment template scales unchanged. Total Pattern G locked sites in F-AUTH-1: 5 (BookEditor:58 keepalive, WriteMode:1000 streaming, WriteMode:1191 streaming, WriteModeAIWriter:281 streaming, AppAssistant:239 streaming). Verification-grep allowlist updated for all 5 sites. Note: useStoryEngine:356 has res.body.getReader() — surface analysis at CP12 will adjudicate as Pattern G or NodeFetch migration.

**URL-string-shape disambiguation note (NEW v2.18 §9.12). Surface analysis must inspect API base composition, not just URL fragments.** CP11 surface initially flagged StoryCalendar's `${API}/calendar/events` as a CP10 CulturalCalendar duplicate. Migration revealed StoryCalendar imports `API` from a constants module where `API = '/api/v1/storyteller'`; full URL resolves to `/api/v1/storyteller/calendar/events`, distinct from CP10's global `/api/v1/calendar/events`. Helpers were FRESH, not duplicates. Discipline: at surface time, read the import statement for the API base constant; resolve the full URL; only then decide if a cross-CP duplicate exists. CP11 caught this mid-flow; future surface reports should catch it before lock to avoid subsequent surface-correction notes.

- Pattern F prophylactic discipline confirmed correct (tenth data point). All 17 CP11 files had LOW direct-shadow density.
- Heaviest cross-CP duplication CP yet — 14 cross-CP duplications across 6 files (was 11 across 5 files in CP8). v2.12 §9.11 file-local convention scales unbroken. listShowsApi reaches 5-fold cross-CP existence (under v2.17 §9.11 6-fold ceiling). updateChapterApi reaches 3-fold.
- No HTTP method mismatches surfaced (CP3-CP11 cumulative still at 0 mid-flow + 1 caught at surface in CP7 + 1 verified at surface in CP9). Total method-correction discoveries: 5 across 11 CPs.
- Path E candidates surfaced from CP11: ~14 GET sites filed for §9.12 Step 3 sweep awareness (many dedup-noted from CP2/CP3/CP5/CP6/CP9/CP10).
- Pattern composability stacked at 5+ patterns within CP11. No file invokes more than 3 patterns simultaneously (CP6 WorldFoundation + CP10 SEE remain the per-file high-water marks at 3 patterns each); CP-level density is higher in CP11 because of more files.

###### Pacing model — 10 data points, CP11 zone identified (long-tail + heavy duplication, 45-55 sites/session) (NEW v2.18, supersedes v2.17)

Ten checkpoints across Track 6:

- **CP2** (1 file, 64 sites): 4 sessions, ~16 sites/session.
- **CP3** (1 file, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session.
- **CP4** (1 file, 18 sites): 1 session, 18 sites/session.
- **CP5** (3 files uniform-simple, 28 sites): 1 session, 28 sites/session.
- **CP6** (4 files heterogeneous, 38 sites): 1 session, 38 sites/session.
- **CP7** (10 files long-tail simplest-first, 39 sites): 1 session, 39 sites/session.
- **CP8** (10 files long-tail simplest-first, 38 sites): 1 session, 38 sites/session.
- **CP9** (8 files long-tail simplest-first, 40 sites): 1 session, 40 sites/session.
- **CP10** (8 files long-tail simplest-first, 42 sites): 1 session, 42 sites/session.
- **CP11** (17 files cleanup-overlap, 51 BUG-class migrated): 1 session, **51 sites/session**. New throughput high-water mark.

**CP11 zone IDENTIFIED v2.18 (NEW): long-tail batches with heavy file-local cross-CP duplication can scale to 45-55 sites/session at 15-17 files.** Conditions for the CP11 zone:

- Most files are 3-site clean clusters (cheapest possible migrations)
- Cross-CP duplications are mechanical translation (no novel work)
- 1-2 anchor files apply locked patterns (no new convention work)
- Pattern G additions are bounded (9-line template applies)

CP11 zone is an **extension of the CP7-10 zone, not a replacement**. Future CPs at similar shape (long-tail + heavy duplication + many small files) can target this throughput. CPs with novel pattern work (e.g., new convention design) or high-density single files (CP3-zone complexity) revert to the lower zones.

Updated throughput model — seven predictor zones now:

- Single high-density file: 11-13 sites/session (CP3 zone)
- Single mid-density file: 14-16 sites/session (CP2 zone)
- Single lower-density simple file: 15-18 sites/session (CP4 zone)
- Multi-file batch uniform-simple (3-4 files): 25-30 sites/session (CP5 zone)
- Multi-file batch heterogeneous (4 files): 35-40 sites/session (CP6 zone)
- Long-tail simplest-first (8-10 files): 35-42 sites/session (CP7-10 zone)
- **Long-tail + heavy duplication (15-17 files): 45-55 sites/session (CP11 zone) — NEW**

###### Long-tail forecast updated to actuals — post-CP11 (UPDATED v2.18)

CP11 inventory reconciliation:

- Pre-CP11: 48 files / 166 sites (matched CP10 close exactly)
- Post-CP11: **31 files / 115 sites**
- Path E cluster (deferred to Step 3): WorldStudio.jsx 29 + LOCKED PUBLIC 5 + UIOverlaysTab external blob 1 = 35 sites
- Pattern G locked exceptions: 5 (BookEditor:58, WriteMode:1000, WriteMode:1191, WriteModeAIWriter:281, AppAssistant:239)
- Estimated BUG-class remaining for Track 6 migration: **~80 sites across ~26 files**

Updated CP forecast: **4 more CPs to close Track 6 implementation (CP12-CP15)**. CP12 useStoryEngine.js (14 sites; CP3-zone single-file dedicated; line 356 streaming pair adjudication). CP13 WorldAdmin.jsx (11 sites; CP3-zone; FormData uploads + variable-URL `op.endpoint`). CP14 EpisodeDetail.jsx (10 sites; UNCLEAR-B mixed-paradigm spot-check). CP15 WorldSetupGuide.jsx (8 mixed PUBLIC+BUG; second F-AUTH-1 mixed instance — applies CP11 PressPublisher convention) + tail residual filler. After CP15: **Track 6 implementation closes**; remaining 35 Path E sites are deferred to Step 3 backend audit (never migrated). Trajectory remains coherent.

**Track 6 progress as of CP11: 389 sites migrated** across 62 files. 5 Pattern G locked exceptions (was 3). Tests grew from 135 (Track 6 start) to 683 (+548). **Current progress ~83% by site count** (389 / ~469 corrected denominator). Remaining: CP12-CP15 (~80 sites across ~26 files). Track 6 implementation closure projected at CP15.

###### File-count arithmetic correction post-CP11 (NEW v2.19 §4.6 note)

CP12 surface re-reconciliation surfaced an arithmetic error in v2.18 §4.6 + the CP11 closure report. v2.18 listed *"31 files / 115 sites"* post-CP11; actual grep at branch tip 87460600 returned **34 files / 115 sites**. The discrepancy: CP11 touched 17 files but only 14 were fully cleared. The 3 sites retained per discipline (PressPublisher:119 LOCKED PUBLIC + WriteModeAIWriter:281 Pattern G + AppAssistant:239 Pattern G) keep their files in the inventory with 1 fetch site each. 48 − 14 fully-cleared = 34 residual, not 31. **Site count (115) was correct; file count (31) was wrong.** Doesn't change any execution; corrects the counting going forward. The discipline that caught this: re-reconciling at branch tip during surface analysis.

###### Track 6 CP12 architectural findings (LOCKED v2.19, COMPLETE — useStoryEngine.js dedicated high-density single; 11th consecutive zero method-mismatch CP)

CP12 completed at commit `7eec2a21` (single squashed commit, 5 file-boundary WIPs collapsed; single session, ~105 min actual against 200-220 min forecast). 13 BUG-class fetch sites migrated in useStoryEngine.js + 1 Pattern G locked at line 358 (post-comment-block insertion shifted from line 356 surface-time projection). 12 module-scope helpers with Pattern F Api suffix (11 fresh + 1 cross-CP duplication: `listStoriesForCharacterApi` reaches 3-fold cross-CP existence — CP9 + CP11 + CP12). 28 new tests added (19 CP12 behavioral + 9 Pattern G structural; pre-existing 3 Track 3 tests preserved unchanged); full frontend suite at 711/711 passing across 78 test files. Backed up at `7eec2a21` on `claude/f-auth-1-backup`. First dedicated high-density single-file CP since CP4 (DraftFusion 18 sites). CP12 is the 11th consecutive CP with zero HTTP method mismatches.

Per-site execution (within-file simplest-first):

- **Step 1 (Pattern G first):** line 348/356 → line 376 streaming kickoff + line 358 res.body.getReader() — locked per matching-precedent (shape matches WriteMode:1000/1191 + WriteModeAIWriter:281 exactly). 9-line comment template applied. Verification-grep allowlist 5 → 6 sites (useStoryEngine.js:358 added).
- **Step 2 (Loaders):** sites 1-3 — `getStoryEngineCharactersApi` (line 197), `listStoriesForCharacterApi` (line 261, 3-fold cross-CP dup), `getStoryEngineTasksApi` (line 303).
- **Step 3 (Single-shot writers):** sites 5, 12, 13 — `generateNextChapterApi` (line 412, also covers site 11 reuse), `checkStoryConsistencyApi` (line 740), `addStoryEngineCharacterApi` (line 762).
- **Step 4 (handleApprove cluster):** sites 6-11 — 6 sites in single 156-line callback. `extractStoryMemoriesApi` (line 522, Promise.all member must complete; Path E dedup from Track 3 v2.18 §9.12), `updateStoryEngineRegistryApi` (line 544, fire-and-forget), `generateTextureLayerApi` (line 560, fire-and-forget), `updateArcTrackingApi` (line 580, .catch only — helper omits .then for no-body-read), `checkSceneEligibilityApi` (line 593, fire-and-forget conditional on story.db_id), generateNextChapterApi reuse (line 619, success-path branching DIFFERENT from site 5).
- **Step 5 (site 14):** line 776 — getStoryEngineCharactersApi reuse on registry refresh.

**Pattern G default-on-matching-precedent discipline LOCKED v2.19 (NEW). When a streaming-shape candidate is surfaced, default disposition is Pattern G lock if shape matches existing locked precedent.** NodeFetch migration is a NEW policy decision distinct from Pattern G — requires explicit Evoni approval, not a default. Validated at CP12 useStoryEngine:358 (matched WriteMode:1000/1191 + WriteModeAIWriter:281 shape exactly: POST + JSON.stringify body + res.body.getReader, no AbortController). Pattern G lock applied without policy escalation. Future tracks encountering streaming-shape candidates: surface report compares shape against existing locked precedents; if match, propose Pattern G lock as default; if genuine deviation, surface for policy discussion before committing.

**Pattern G line-number shift on comment insertion (NEW v2.19 note). The 9-line locked-comment block insertion shifts the locked-site line number downward by ~9-10 lines.** Surface report line numbers are pre-insertion approximations; final allowlist line numbers are post-insertion. Validated at CP12: surface predicted line 356 for Pattern G site; actual is line 358 post-migration (kickoff fetch shifted from line 348 → line 376 due to comment-block insertion above). Not a problem; just observed mechanic. Verification-grep allowlist references the post-insertion line numbers throughout.

**Hook module-scope helper pattern — third validation (UPDATED v2.19, supersedes v2.16 single-instance lock). v2.16 §9.11 hook module-scope helper convention validated across three hooks of varying complexity:** CP9 useGenerationJob.js (5 sites, simple polling shape), CP11 usePageData.js (3 sites, mid-density), CP12 useStoryEngine.js (13 sites + 1 Pattern G, high-density 14-site dedicated CP). Convention scales unchanged across the complexity range. Helpers exported as `export const` at module scope; consumers of the hook unchanged; tests use direct named imports.

**Existing-test-file amendment — third validation (UPDATED v2.19, supersedes v2.17 dual-instance lock). v2.15 §9.11 existing-test-file amendment convention validated across three distinct test-file shapes:** CP8 RelationshipEngine (behavioral-only append), CP10 StoryEvaluationEngine (structural-with-behavioral-append, vi.mock hoisting required), CP12 useStoryEngine (hook-with-helper-append + Pattern G structural tests; pre-existing 3 Track 3 tests preserved unchanged). Three distinct test-file shapes; convention scales unchanged across all observed structures.

**Callback-cluster preservation pattern (NEW v2.19 observation, NOT a new convention). When a single callback contains multiple fetch sites with varied semantic roles (must-complete vs fire-and-forget vs conditional vs no-body-read), file-local helpers replace each fetch call site individually; surrounding Promise.all/Promise.allSettled/conditional wrappers stay verbatim; semantic preservation comes from the helper-replaces-fetch shape, not from explicit cluster orchestration.** Validated at CP12 handleApprove (6 sites in 156-line callback, 5 distinct semantic shapes). All 6 semantic invariants preserved without flattening. The convention library naturally handles callback clusters; no new lock language needed.

- Pattern F prophylactic discipline confirmed correct (eleventh data point). 17 component-internal handlers use handle* prefix; 12 new helpers use *Api suffix. No direct shadow conflicts.
- handleApprove cluster came in well under estimate (25 min actual vs 75 min forecast) because helper-extraction-then-replace-call pattern was mechanical once helpers were defined. Promise.all + Promise.allSettled wrappers stayed verbatim. WIP-and-resume checkpoint not needed.
- Cross-CP duplication: `listStoriesForCharacterApi` reaches 3-fold cross-CP existence. All other 11 CP12 helpers are FRESH.
- Path E dedup: `/memories/extract-story-memories` was already filed in v2.18 §9.12 line 1488 from Track 3 surface. CP12 migration applies apiClient (auth-required default) — site is now covered by `extractStoryMemoriesApi` helper.
- No HTTP method mismatches surfaced (CP3-CP12 cumulative still at 0 mid-flow + 1 caught at surface in CP7 + 1 verified at surface in CP9). CP12 is the 11th consecutive CP with zero method mismatches. Total method-correction discoveries: 5 across 12 CPs.

###### Pacing model — 11 data points, CP3 zone reproducibility validated for high-density singles (NEW v2.19, supersedes v2.18)

Eleven checkpoints across Track 6:

- **CP2** (1 file, 64 sites): 4 sessions, ~16 sites/session.
- **CP3** (1 file, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session.
- **CP4** (1 file, 18 sites): 1 session, 18 sites/session.
- **CP5** (3 files uniform-simple, 28 sites): 1 session, 28 sites/session.
- **CP6** (4 files heterogeneous, 38 sites): 1 session, 38 sites/session.
- **CP7** (10 files long-tail simplest-first, 39 sites): 1 session, 39 sites/session.
- **CP8** (10 files long-tail simplest-first, 38 sites): 1 session, 38 sites/session.
- **CP9** (8 files long-tail simplest-first, 40 sites): 1 session, 40 sites/session.
- **CP10** (8 files long-tail simplest-first, 42 sites): 1 session, 42 sites/session.
- **CP11** (17 files cleanup-overlap, 51 BUG-class migrated): 1 session, 51 sites/session.
- **CP12** (1 file dedicated high-density, 13 sites + 1 Pattern G locked): 1 session, **13 sites/session**. CP3 zone (11-13 sites/session) reproducibility validated for high-density singles.

CP12 confirms CP3 zone applicability for high-density single files: **11-13 sites/session is the empirical band for dedicated single-file CPs at high density (>10 sites).** Surface-with-cost-estimation discipline forecast 1 session probable / 2 sessions possible at 60% confidence; actual was 1 session at 105 min against 200-220 min estimate. Conservative forecasting validated. CP13 WorldAdmin (11 sites) + CP14 EpisodeDetail (10 sites) carry similar conservative forecasts in this band.

Throughput model unchanged — seven predictor zones. v2.19 strengthens CP3 zone confidence via CP12 second data point at high-density single shape (CP3 was first at 33 sites + 2 Pattern G in 3 sessions; CP12 was second at 13 sites + 1 Pattern G in 1 session; both within 11-13 sites/session band).

###### Long-tail forecast updated to actuals — post-CP12 (UPDATED v2.19)

CP12 inventory reconciliation:

- Pre-CP12: 34 files / 115 sites (corrected from v2.18's 31 files figure)
- Post-CP12: **34 files / 102 sites** (useStoryEngine retains 1 entry for Pattern G locked site)
- Path E cluster (deferred to Step 3): WorldStudio.jsx 29 + LOCKED PUBLIC 5 + UIOverlaysTab external blob 1 = 35 sites
- Pattern G locked exceptions: 6 (BookEditor:58, WriteMode:1000, WriteMode:1191, WriteModeAIWriter:281, AppAssistant:239, useStoryEngine:358)
- Estimated BUG-class remaining for Track 6 migration: **~67 sites across ~30 files**

Updated CP forecast: **3 more CPs to close Track 6 implementation (CP13-CP15)**. CP13 WorldAdmin.jsx (11 sites; CP3-zone single; FormData uploads + variable-URL `op.endpoint`; multipart pattern v2.14 + URL-branching v2.17 likely composable). CP14 EpisodeDetail.jsx (10 sites; CP3-zone single; UNCLEAR-B mixed-paradigm spot-check). CP15 WorldSetupGuide.jsx (8 mixed PUBLIC+BUG; second F-AUTH-1 mixed instance applies CP11 PressPublisher convention) + tail residual filler. After CP15: **Track 6 implementation closes**; remaining 35 Path E sites are deferred to Step 3 backend audit (never migrated). Trajectory remains coherent.

**Track 6 progress as of CP12: 402 sites migrated** across 46 files. 6 Pattern G locked exceptions (was 5). Tests grew from 135 (Track 6 start) to 711 (+576). **Current progress ~86% by site count** (402 / ~469 corrected denominator). Remaining: CP13-CP15 (~67 sites across ~30 files). Track 6 implementation closure projected at CP15.

###### Track 6 CP13 architectural findings (LOCKED v2.20, COMPLETE — WorldAdmin.jsx dedicated high-density single; second consecutive high-density single; first formal lock of Data-driven URL pass-through pattern)

CP13 completed at commit `bdd6b6df` (single squashed commit, 4 file-boundary WIPs collapsed; single session, ~75 min actual against 120-145 min forecast). 11 BUG-class fetch sites migrated in WorldAdmin.jsx + 0 Pattern G locked (zero CP13-zone triggers). 11 module-scope helpers with Pattern F Api suffix (7 fresh + 4 cross-CP duplications, 3 of which are service-module precedence inversions). 22 new tests added (4 cross-CP dup + 4 fresh + 1 outfit-sets + 4 Option B parameterized variants + 1 Option B unwrap + 2 multipart + 6 error propagation); full frontend suite at 733/733 passing across 79 test files. Backed up at `bdd6b6df` on `claude/f-auth-1-backup`. **Second dedicated high-density single-file CP in a row** (after CP12 useStoryEngine). WorldAdmin.jsx fully cleared from inventory (file count 34 → 33). CP13 is the 12th consecutive CP with zero HTTP method mismatches.

Per-site execution (within-file simplest-first):

- **Step 1 (Cross-CP dups, 4 sites):** `listEpisodeTodoSocialApi` (line 1635, CP9 dup, 2-fold), `listWorldEventsApi` (line 1636, service-module precedence inversion — first file-local capture from 7+ component consumers), `listShowWardrobeApi` (line 5563, wardrobeService.js + 7-component precedence inversion), `updateWardrobeItemApi` (line 6088, wardrobeService.js precedence inversion).
- **Step 2 (Fresh wardrobe-detail helpers, 4 sites):** `promoteWardrobePrimaryVariantApi` (line 5251, PATCH), `sendWardrobeToPhoneApi` (line 5291, POST), `regenerateWardrobeProductShotApi` (line 5331, POST), `getWardrobeUsageApi` (line 6013, GET).
- **Step 3 (Site 11):** `createOutfitSetApi` (line 7174, POST).
- **Step 4 (Site 6 Option B Data-driven URL pass-through):** `bulkWardrobeOpApi(endpoint, payload)` (line 5550). Config array at lines 5538-5542 preserved verbatim. Call site replaced fetch with helper invocation. test.each parameterization deployed over 4 endpoint variants + 5th test for r.data unwrap.
- **Step 5 (Site 10 multipart):** `uploadWardrobeApi(formData)` (line 6599, FormData direct to api.post; no manual Content-Type; outer try/catch at line 6582 cleanup). 2 specific multipart tests verify FormData passed as second arg + no third-arg config.

**Data-driven URL pass-through pattern — formally LOCKED v2.20 §9.11 (NEW, validated at WorldAdmin:5550). When N variant URLs are dispatched via config-array.map (or other data-driven enumeration in source) AND method, payload shape, and headers are uniform across variants, a single pass-through helper is canonical.** Helper signature: `export const verbNounOpApi = (endpoint, payload) => api.post(endpoint, payload).then(r => r.data)`. Distinct from v2.17 URL-branching split (which assumes call-site ternary/switch with hard-coded URLs at each branch), v2.13 method-branching split, and v2.18 combined-axis stacking. Structural conditions for applicability (ALL required): (1) method uniform across variants, (2) payload shape + headers uniform across variants, (3) variants enumerated in source as data (config array, lookup table, registry) — not as control flow, (4) URLs originate from inside the file (no external input — closes the SSRF surface). If any condition fails, fall back to v2.17 / v2.13 / v2.18 per shape. Helper naming: use a verb-noun-Op pattern (e.g., `bulkWardrobeOpApi`, not just `bulkOpApi`) — preserve domain context per Pattern F. Validated execution at CP13: all 4 structural conditions verified post-execution; config array preserved verbatim; 4-variant test.each parameterization passes; 1 helper covers 4 sites.

**Service-module precedence inversion — three-data-point validation (UPDATED v2.20, supersedes v2.16 single-instance lock). v2.16 §9.11 service-module precedence inversion convention validated across three data points:** CP9 showService.js (first instance), CP13 WorldAdmin:5563 wardrobeService.js + 7 component consumers (highest consumer count observed in F-AUTH-1), CP13 WorldAdmin:6088 wardrobeService.js line 39. Convention scales unbroken at 7-component-consumer density. v2.16 lock language stands without modification; v2.20 records the data points.

**Partial-migration extension pattern (NEW v2.20 §9.11 observation). When a file has pre-existing apiClient adoption (from independent earlier migration, not from a prior Track 6 CP), new helpers preserve the file-local idiom.** Validated at CP13: WorldAdmin had pre-existing `api.post()` at line 6306 (NOT in CP13 zone). CP13 extended with 11 new helpers all using the same `api` import (not the global `apiClient` style). Test scaffolding uses `vi.mock('../services/api', () => ({ default: { ... } }))` consistent with file-local convention. Verification grep treats the file as partially-migrated rather than virgin: pre-existing apiClient site is NOT a CP deliverable; do not touch.

**Outer try/catch cleanup observation (NEW v2.20 §9.11 note, NOT a new convention). When migrating from raw fetch with if(res.ok)/if(!res.ok) idioms to apiClient throws-on-non-2xx, an outer try/catch wrapping only the payload-construction-then-fetch block may become unmatched if the inner block was the only try consumer.** Resolution: remove the outer try since payload construction is pure JS that doesn't throw; inner try/catch on the network call handles all error paths. Validated at CP13 WorldAdmin:6582. Filed as observation; no new lock language needed (recognizable cleanup, not a convention).

**Pattern G zero-trigger admin-page heuristic (NEW v2.20 §9.11 observation). Admin-page CPs default to zero Pattern G expectation; chat/AI-writer CPs default to high Pattern G expectation.** Two consecutive admin-page instances confirm: CP11 PressPublisher BUG-only sites (zero Pattern G), CP13 WorldAdmin (zero Pattern G). Streaming-shape candidates concentrate in chat/AI-writer files (BookEditor, WriteMode, WriteModeAIWriter, AppAssistant, useStoryEngine — all 6 Pattern G locked sites). Heuristic, not lock — surface check still required per file regardless.

- Pattern F prophylactic discipline confirmed correct (twelfth data point). All 11 helpers use *Api suffix; component-internal handlers use handle*/verb prefixes. No direct shadow conflicts.
- Cross-CP duplication: 4 sites in CP13. listEpisodeTodoSocialApi reaches 2-fold cross-CP existence (CP9 + CP13). All other 7 helpers are FRESH.
- Path E candidates: 4 GET sites filed (1 fresh + 3 dedup-noted from prior CPs).
- No HTTP method mismatches surfaced. CP13 is the 12th consecutive CP with zero method mismatches (CP3-CP13 cumulative). Total method-correction discoveries remain at 5 across 13 CPs.
- Pattern G allowlist UNCHANGED at 6 sites. Verification grep allowlist not updated in v2.20.

###### Pacing model — 12 data points, CP3 zone validated at three data points (NEW v2.20, supersedes v2.19)

Twelve checkpoints across Track 6:

- **CP2** (1 file, 64 sites): 4 sessions, ~16 sites/session.
- **CP3** (1 file, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session.
- **CP4** (1 file, 18 sites): 1 session, 18 sites/session.
- **CP5** (3 files uniform-simple, 28 sites): 1 session, 28 sites/session.
- **CP6** (4 files heterogeneous, 38 sites): 1 session, 38 sites/session.
- **CP7** (10 files long-tail simplest-first, 39 sites): 1 session, 39 sites/session.
- **CP8** (10 files long-tail simplest-first, 38 sites): 1 session, 38 sites/session.
- **CP9** (8 files long-tail simplest-first, 40 sites): 1 session, 40 sites/session.
- **CP10** (8 files long-tail simplest-first, 42 sites): 1 session, 42 sites/session.
- **CP11** (17 files cleanup-overlap, 51 BUG-class migrated): 1 session, 51 sites/session.
- **CP12** (1 file dedicated high-density, 13 sites + 1 Pattern G locked): 1 session, 13 sites/session.
- **CP13** (1 file dedicated high-density, 11 sites + 0 Pattern G): 1 session, **11 sites/session**. Lower edge of CP3 zone.

CP3 zone band 11-13 sites/session validated at three data points: **CP3 (33 sites + 2 G locked over 3 sessions, 11 sites/session); CP12 (13 sites + 1 G locked in 1 session, 13 sites/session); CP13 (11 sites + 0 G locked in 1 session, 11 sites/session).** Band is empirically stable. Future high-density single CPs (CP14 EpisodeDetail at 10 sites) carry similar conservative forecasts in this band.

Conservative forecasting bias confirmed across 12 CPs: **CP12 forecast 200-220 min, actual 105 min. CP13 forecast 120-145 min, actual 75 min.** Surface-with-cost-estimation discipline accepts the conservative bias — better to under-promise than over-commit.

Throughput model unchanged — seven predictor zones. v2.20 strengthens CP3 zone confidence via three data points all within 11-13 sites/session band.

###### Long-tail forecast updated to actuals — post-CP13 (UPDATED v2.20)

CP13 inventory reconciliation:

- Pre-CP13: 34 files / 102 sites
- Post-CP13: **33 files / 91 sites** (WorldAdmin fully cleared from inventory)
- Path E cluster (deferred to Step 3): WorldStudio.jsx 29 + LOCKED PUBLIC 5 + UIOverlaysTab external blob 1 = 35 sites
- Pattern G locked exceptions: 6 (UNCHANGED)
- Estimated BUG-class remaining for Track 6 migration: **~56 sites across ~26 files**

Updated CP forecast: **2 more CPs to close Track 6 implementation (CP14-CP15)**. CP14 EpisodeDetail.jsx (10 sites; CP3-zone single; UNCLEAR-B mixed-paradigm spot-check). CP15 WorldSetupGuide.jsx (8 mixed PUBLIC+BUG; second F-AUTH-1 mixed instance applies CP11 PressPublisher convention) + tail residual filler (~7 small files). After CP15: **Track 6 implementation closes**; remaining 35 Path E sites are deferred to Step 3 backend audit (never migrated). Trajectory remains coherent.

**Track 6 progress as of CP13: 413 sites migrated** across 47 files. 6 Pattern G locked exceptions (UNCHANGED). Tests grew from 135 (Track 6 start) to 733 (+598). **Current progress ~88% by site count** (413 / ~469 corrected denominator). Remaining: CP14-CP15 (~56 sites across ~26 files). Track 6 implementation closure projected at CP15.

###### Track 6 CP14 architectural findings (LOCKED v2.21, COMPLETE — EpisodeDetail.jsx dedicated high-density single; third consecutive high-density single; partial-migration extension graduates to two-data-point pattern; admin-page heuristic graduates to three-data-point validation; helper-reuse density observed)

CP14 completed at commit `d2645cf9` (single squashed commit, 4 file-boundary WIPs collapsed; single session, ~50 min actual against 85-100 min forecast). 10 BUG-class fetch sites migrated in EpisodeDetail.jsx + 0 Pattern G locked (zero CP14-zone triggers, third consecutive admin-page CP confirming v2.20 admin-page heuristic). 6 module-scope helpers with Pattern F Api suffix (5 fresh + 1 cross-CP duplication: `listWorldEventsApi` reaches 2-fold cross-CP existence — CP13 + CP14). **Helper-reuse density of 40%** (6 helpers covering 10 sites — highest reuse density observed in F-AUTH-1 dedicated singles). 14 new tests added (6 helper-coverage + 2 helper-reuse coverage + 6 error propagation); full frontend suite at 747/747 passing across 80 test files. Backed up at `d2645cf9` on `claude/f-auth-1-backup`. **Third dedicated high-density single-file CP in a row** (after CP12 useStoryEngine + CP13 WorldAdmin). EpisodeDetail.jsx fully cleared from inventory (file count 33 → 32). CP14 is the 13th consecutive CP with zero HTTP method mismatches.

UNCLEAR-B adjudication outcome: **(A) PARTIAL-MIGRATION EXTENSION** per v2.20 §9.11. Surface report adjudicated against the 5 candidate explanations with concrete evidence: file imports `api` from `../services/api` at line 26; 2 pre-existing `api.post()` sites at lines 776 + 805 (both `/world/:sid/episodes/:id/generate-story` POST); 0 LOCKED PUBLIC sites; 0 Pattern G triggers; intra-BUG-class idiom variation only. Same shape as CP13 WorldAdmin (which had pre-existing `api.post` at line 6306). Migration zone bounded to 10 BUG-class raw fetch sites; pre-existing `api.post` sites verified UNTOUCHED post-execution.

Per-site execution (within-file simplest-first, helper-reuse-aware):

- **Step 1 (Helper definitions block + Loaders, sites 1-3):** all 6 helpers defined at top of file after imports. `listEpisodeLibraryScenesApi` (line 233 site 1), `listWorldEventsApi` (line 254 site 2, cross-CP dup CP13), `getCharacterStateApi` (line 268 site 3).
- **Step 2 (handleSceneSelect cluster, sites 4-5):** `addEpisodeLibrarySceneApi` (line 283 POST) + reload via listEpisodeLibraryScenesApi reuse (line 295 site 5).
- **Step 3 (handleReorderScene cluster, sites 6-8):** Promise.all parallel-execution of `reorderEpisodeLibrarySceneApi` twice (lines 318, 323 sites 6-7) + reload via listEpisodeLibraryScenesApi reuse (line 331 site 8).
- **Step 4 (handleRemoveScene cluster, sites 9-10):** `removeEpisodeLibrarySceneApi` (line 345 DELETE) + reload via listEpisodeLibraryScenesApi reuse (line 351 site 10).

**Partial-migration extension pattern — graduates from observation to two-data-point pattern (UPDATED v2.21, supersedes v2.20 single-instance observation). v2.20 §9.11 partial-migration extension was first instance at CP13 WorldAdmin. CP14 EpisodeDetail is second instance with the same shape:** file imports `api` from `../services/api`; has 1-2 pre-existing `api.post()` sites from independent earlier migration (not from prior Track 6 CP); BUG-class fetch sites are the migration zone. Pattern graduates to two-data-point pattern in v2.21. Discipline locked: when surface report encounters UNCLEAR-B file, partial-migration extension hypothesis is the default test. Adjudication takes ~30 seconds (read top-of-file imports + grep for `api.` calls + grep for raw `fetch` calls). New helpers preserve file-local idiom (NOT global `apiClient.` style). Test scaffolding uses `vi.mock('../services/api', () => ({ default: { ... } }))` consistent with file-local convention. Verification grep at end-of-CP: pre-existing apiClient sites must NOT appear in diff. Validated at CP13 WorldAdmin (1 pre-existing apiClient site at line 6306) + CP14 EpisodeDetail (2 pre-existing apiClient sites at lines 776 + 805).

**Pattern G zero-trigger admin-page heuristic — graduates to three-data-point validation (UPDATED v2.21, supersedes v2.20 dual-instance observation). v2.20 §9.11 admin-page heuristic was first observed at CP11 PressPublisher BUG-only sites + CP13 WorldAdmin.** CP14 EpisodeDetail is third consecutive admin-page CP with zero Pattern G triggers. Heuristic graduates to three-data-point validation in v2.21. Validated across page-shape variations: PressPublisher (domain-content admin), WorldAdmin (show-management admin), EpisodeDetail (episode-management admin). Streaming-shape candidates remain concentrated in 5 chat/AI-writer files (all 6 Pattern G locked sites). Heuristic, not lock — surface check still required per file regardless.

**Helper-reuse density forecasting heuristic (NEW v2.21 §9.11 observation, NOT a new convention). When surface analysis identifies CRUD + reload-after-mutation cluster pattern (single resource family with mount + create + update + delete + reload-after-each-mutation), helper count is 30-40% lower than site count.** The loader gets called once at mount + once after each mutation = N+1 invocations from M+1 distinct call sites where M is the mutation count. Validated at CP14 EpisodeDetail (40% reduction; 6 helpers / 10 sites — 4× reuse on `listEpisodeLibraryScenesApi` across mount + 3 reload-after-mutation paths; 2× reuse on `reorderEpisodeLibrarySceneApi` in single Promise.all parallel-execution wrapper). Forecasting heuristic, NOT a new convention — file-local helper convention v2.12 already handles helper reuse natively. Surface analysis discipline: when CRUD + reload pattern detected, session-time-per-site forecast can be reduced ~30% from CP3-zone baseline; helper-count forecast reduced 30-40% from site count. Tests cover the helper once per behavioral assertion + 1-2 explicit reuse-coverage tests; do NOT duplicate per-call-site coverage.

**Decreasing-cost trend across CP12-CP14 (NEW v2.21 §4.6 pacing observation). Cost per site decreases monotonically across the three consecutive dedicated high-density singles:** CP12 (14 sites + 1 Pattern G locked, 105 min, 7.5 min/site); CP13 (11 sites, 75 min, 6.8 min/site); CP14 (10 sites, 50 min, 5.0 min/site). Trend reflects three coupled factors: (a) decreasing site count per CP, (b) decreasing pattern composability complexity (CP12: 5 patterns including Pattern G adjudication + callback-cluster preservation; CP13: 4 patterns + 1 new lock for Data-driven URL pass-through; CP14: 3 patterns, no new locks), (c) increasing helper-reuse density (CP12: 8% reduction, CP13: 0%, CP14: 40%). Conservative forecasting bias holds steady (CP12 ~2.0x, CP13 ~1.7x, CP14 ~1.7x). Forecasts continue honest, not optimistic.

- Pattern F prophylactic discipline confirmed correct (thirteenth data point). All 6 helpers use *Api suffix; component-internal handlers use handle*/fetch* prefixes. No direct shadow conflicts.
- Cross-CP duplication: 1 site in CP14 (site 2). `listWorldEventsApi` reaches 2-fold cross-CP existence (CP13 + CP14). All other 5 helpers are FRESH.
- Path E candidates: 3 GET sites filed (2 fresh: `/episodes/:id/library-scenes` + `/characters/:char/state`; 1 dedup-noted: `/world/:show/events` from CP13).
- No HTTP method mismatches surfaced. CP14 is the 13th consecutive CP with zero method mismatches (CP3-CP14 cumulative). Total method-correction discoveries remain at 5 across 14 CPs.
- Pattern G allowlist UNCHANGED at 6 sites. Verification grep allowlist not updated in v2.21.
- Pre-existing `api.post()` sites at lines 776 + 805 verified UNTOUCHED post-execution. Verification grep at end-of-CP returned 0 raw-fetch matches in EpisodeDetail.jsx; pre-existing sites do not appear in CP14 diff. Partial-migration extension discipline maintained.

###### Pacing model — 14 data points, CP3 zone reframes to 10-13 sites/session (NEW v2.21, supersedes v2.20)

Fourteen checkpoints across Track 6:

- **CP2** (1 file, 64 sites): 4 sessions, ~16 sites/session.
- **CP3** (1 file, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session.
- **CP4** (1 file, 18 sites): 1 session, 18 sites/session.
- **CP5** (3 files uniform-simple, 28 sites): 1 session, 28 sites/session.
- **CP6** (4 files heterogeneous, 38 sites): 1 session, 38 sites/session.
- **CP7** (10 files long-tail simplest-first, 39 sites): 1 session, 39 sites/session.
- **CP8** (10 files long-tail simplest-first, 38 sites): 1 session, 38 sites/session.
- **CP9** (8 files long-tail simplest-first, 40 sites): 1 session, 40 sites/session.
- **CP10** (8 files long-tail simplest-first, 42 sites): 1 session, 42 sites/session.
- **CP11** (17 files cleanup-overlap, 51 BUG-class migrated): 1 session, 51 sites/session.
- **CP12** (1 file dedicated high-density, 13 sites + 1 Pattern G locked): 1 session, 13 sites/session, 7.5 min/site.
- **CP13** (1 file dedicated high-density, 11 sites + 0 Pattern G): 1 session, 11 sites/session, 6.8 min/site.
- **CP14** (1 file dedicated high-density, 10 sites + 0 Pattern G): 1 session, **10 sites/session**, 5.0 min/site. CP3 zone lower edge with high helper-reuse density (40%).

CP3 zone reframes to 10-13 sites/session band (UPDATED v2.21, supersedes v2.20 11-13 framing). **Three high-density single data points (CP12, CP13, CP14) span 10-13 sites/session.** Lower edge (10 sites/session at CP14) is achieved with high helper-reuse density (≥30%); upper edge (13 sites/session at CP12) is achieved at moderate reuse density (~8%) with composability stack of 5 patterns. Band reframing: 10-13 sites/session for high-density single CPs, with helper-reuse density as the primary lower-edge enabler. Future high-density single CPs (CP15 has multi-file shape, not single) carry forecasts in this band conditional on file shape.

Conservative forecasting bias confirmed across 14 CPs: **CP12 forecast 200-220 min, actual 105 min (~2.0x overestimate). CP13 forecast 120-145 min, actual 75 min (~1.7x). CP14 forecast 85-100 min, actual 50 min (~1.7x).** Surface-with-cost-estimation discipline accepts the conservative bias as design feature.

Throughput model unchanged — seven predictor zones. v2.21 widens CP3 zone to 10-13 sites/session via four data points spanning the full band (CP3, CP12, CP13, CP14).

###### Long-tail forecast updated to actuals — post-CP14 (UPDATED v2.21)

CP14 inventory reconciliation:

- Pre-CP14: 33 files / 91 sites
- Post-CP14: **32 files / 81 sites** (EpisodeDetail fully cleared from inventory — third consecutive file fully cleared by dedicated single CP)
- Path E cluster (deferred to Step 3): WorldStudio.jsx 29 + LOCKED PUBLIC 5 + UIOverlaysTab external blob 1 = 35 sites
- Pattern G locked exceptions: 6 (UNCHANGED)
- Estimated BUG-class remaining for Track 6 migration: **~46 sites across ~25 files**

Updated CP forecast: **1 more CP to close Track 6 implementation (CP15 — FINAL CP)**. CP15 = WorldSetupGuide.jsx (8 mixed PUBLIC+BUG; second F-AUTH-1 mixed-disposition instance after CP11 PressPublisher; applies CP11 convention) + tail residual filler (~7 small files, ~38 sites). Multi-file shape, CP7-10 zone throughput (35-55 sites/session). Forecast: 1 session, 60-90 min. Mixed PUBLIC+BUG convention v2.18 applies to WorldSetupGuide. After CP15: **Track 6 implementation closes**. Remaining ~35 Path E sites are deferred to Step 3 backend audit (never migrated).

**Track 6 progress as of CP14: 423 sites migrated** across 47 files. 6 Pattern G locked exceptions (UNCHANGED). Tests grew from 135 (Track 6 start) to 747 (+612). **Current progress ~90% by site count** (423 / ~469 corrected denominator). Remaining: CP15 ONLY (~46 sites across ~25 files). **Track 6 implementation closure imminent at CP15.**

###### Track 6 CP15 architectural findings (LOCKED v2.22, COMPLETE — TRACK 6 IMPLEMENTATION CLOSURE; multi-file long-tail batch — 43 sites across 23 files)

CP15 completed at commit `04777edd` (single squashed commit, 23 file-boundary WIPs collapsed; single session, ~120 min actual within 110-150 min forecast). 43 BUG-class fetch sites migrated across 23 files via ~30 module-scope helpers with Pattern F Api suffix. **Final CP for Track 6 implementation closure.** 0 Pattern G locked (zero CP15-zone triggers across all 23 files — admin-page heuristic v2.21 confirmed for fourth consecutive multi-file batch). 66 new tests added (+22 test files + 1 existing-test-file amendment); full frontend suite at 813/813 passing across 102 test files. Backed up at `04777edd` on `claude/f-auth-1-backup`. Five architectural decisions executed cleanly: WorldSetupGuide all-BUG reclassification; Path A cross-CP ceiling discipline (8-fold listRegistriesApi); ProductionOverlaysTab:108 external blob deferral; Decision 4 variable-URL adjudication (3 sites: 2 → v2.14 internal-helper-refactor, 1 → standard helper); batch composition simplest-first multi-file long-tail per CP7+ precedent. CP15 is the 14th consecutive CP with zero HTTP method mismatches, closing the Track 6 streak intact (CP3-CP15 cumulative).

Per-tier execution (simplest-first multi-file long-tail per CP7+ discipline):

- **Tier 1 (1-site files, 9 files, warm-up cadence):** useRegistries (hook, listRegistriesApi 7-fold), FeedEnhancements, UniverseProductionPage (listShowsApi 5-fold), ScriptIntelligencePanel, ScriptBridgePanel, SceneLibraryPicker, RelationshipEngine/WebView, MemoryConfirmation (v2.14 internal-helper-refactor — apiFetch wrapper preserved), DecisionEchoPanel (standard helper extraction).
- **Tier 2 (2-site fresh files, 8 files):** StoryInspector (helper-reuse 2×), DesignAgent, DreamMap (helper-reuse: 1 GET + 1 PUT), ShowDistributionTab, CharacterDilemmaEngine, ScenesPanel, OutfitCalendar, ChapterJourney.
- **Tier 3 (2-site partial-migration files, 3 files — context-switch overhead):** SocialProfileGenerator (3rd partial-migration instance — 9+ pre-existing helpers), FeedBulkImport (4th instance — apiClient line 7), EpisodeScriptTab (5th instance — 5 pre-existing api.* sites).
- **Tier 4 (2-site cross-CP-heavy files, 2 files):** ChapterStructureEditor (CP3 dup), MemoryBankView (listRegistriesApi reaches 8-fold cross-CP existence + v2.14 internal-helper-refactor at line 57).
- **Tier 5 (Anchor — WorldSetupGuide.jsx 8 sites):** all 8 migrated to apiClient per Decision 1 reclassification. 6 helpers covering 8 sites with 3-way reuse on `getPageContentApi` (sites 1, 2, 4) — second helper-reuse-density data point after CP14 EpisodeDetail. listShowsApi reaches 6-fold cross-CP existence.

**WorldSetupGuide reclassification — Decision 1 outcome (LOCKED v2.22 §4.2 amendment). The "mixed PUBLIC+BUG" label in inventory v2 §4.2 was provisional, predating the cross-CP evidence accumulated through CP14.** CP15 surface adjudicated all 8 sites with concrete cross-CP evidence: `/page-content/*` (CP11 usePageData uses apiClient), `/calendar/events` (CP10/CP11 use apiClient), `/world/locations` (CP8/CP11 use apiClient), `/social-profiles` (CP9 uses apiClient), `/shows` (CP2/CP5/CP10/CP11 — 4-fold), `/world/:show/events` (CP13/CP14 use apiClient). Every endpoint is auth-required across the codebase. CP15 migrated all 8 sites to apiClient — no LOCKED PUBLIC retention, no CP11 PressPublisher convention applied. **The second F-AUTH-1 mixed-disposition instance does not exist — CP11 PressPublisher remains the only mixed-disposition file in F-AUTH-1.** Discipline locked: when surface report encounters a "mixed PUBLIC+BUG" inventory label, treat as provisional pending cross-CP cross-reference; the inventory label may be superseded by cross-CP evidence.

**ProductionOverlaysTab:108 reclassification — Decision 3 outcome (LOCKED v2.22 §4.2 amendment). Site fetches user-content URL (S3-hosted overlay PNG) for client-side download via resp.blob() — application-controlled URL pointing at external blob storage, NOT a backend API call.** Same structural shape as UIOverlaysTab.jsx external blob deferral. CP15 reclassified ProductionOverlaysTab:108 as deferred external blob; site UNTOUCHED in CP15 zone. Deferred external blob cluster grows to 2 sites (UIOverlaysTab + ProductionOverlaysTab). v2.22 §4.2 records the reclassification.

**Cross-CP duplication ceiling exceeded — Decision 2 outcome (NEW v2.22 §9.11 ceiling-semantics clarification). Path A (continue v2.12 §9.11 file-local convention regardless of count) applied through CP15.** Final cross-CP duplication counts: `listRegistriesApi` reaches 8-fold cross-CP existence (StoryEvaluationEngine + WriteMode + RelationshipEngine + CharacterTherapy + StoryProposer + Home + MemoryBankView + useRegistries) — exceeds v2.17 §9.11 6-fold "ceiling" by 2; `listShowsApi` reaches 6-fold (SceneSetsTab + SeriesPage + CulturalCalendar + CultureEvents + UniverseProductionPage + WorldSetupGuide) — meets ceiling exactly. v2.22 §9.11 ceiling semantics clarified: **the 6-fold "ceiling" was always a soft observation about scaling pressure, not a hard cap.** CP15 confirms operationally — file-local convention scales unbroken at 8-fold density without coupling concerns. v2.22 records the new high-water marks; ceiling-revisit (Path B cross-file import precedent) deferred to v2.23+ topic conditional on Step 3 backend sweep findings.

**Variable-URL adjudication outcomes — Decision 4 (NEW v2.22 §9.11 lock for surface-time discipline). Three sites flagged for sample-time adjudication during CP15 execution. Outcomes:**

- `MemoryConfirmation.jsx:51` (apiFetch wrapper called 5× with varying methods GET/POST/DELETE) — v2.20 condition (1) FAILS (methods vary) → **v2.14 internal-helper-refactor pattern applied**: wrapper preserved, internal fetch swapped for apiClient.request. Fourth v2.14 data point.
- `DecisionEchoPanel.jsx:31` (single ECHOES_API URL, single POST method) — v2.20 N/A (single URL, not data-driven dispatch) → standard helper extraction (plantEchoApi).
- `MemoryBankView.jsx:57` (apiFetch wrapper, 6× call sites with varying methods) — v2.20 condition (1) FAILS (methods vary) → **v2.14 internal-helper-refactor pattern applied**. Fifth v2.14 data point.

Surface-time discipline LOCKED v2.22 §9.11: when surface report flags variable-URL sites as v2.20 candidates, sample-time inspection MUST verify all four structural conditions before applying v2.20. If condition (1) method uniformity fails (which is the most common failure mode for apiFetch-wrapper shapes), fallback is v2.14 internal-helper-refactor (wrapper preserved, internal fetch swapped). v2.20 stays at 1 implementation data point (CP13 WorldAdmin only); v2.14 reaches 5 data points (CP3 + CP6 + CP15 × 2). The discipline is: surface flags candidates; execution adjudicates per site; fallback patterns apply when conditions fail.

**Partial-migration extension pattern — graduates to FIVE-data-point pattern (UPDATED v2.22, supersedes v2.21 two-data-point validation). v2.21 §9.11 partial-migration extension was validated at two data points (CP13 WorldAdmin + CP14 EpisodeDetail). CP15 contributes three new instances:** SocialProfileGenerator.jsx (9+ pre-existing exported helpers at lines 30-41 + downstream callers; CP15 zone added 2 BUG-class sites at lines 1213, 1229), FeedBulkImport.jsx (apiClient imported line 7 + downstream usage; CP15 zone added 2 sites at lines 177, 210), EpisodeScriptTab.jsx (5 pre-existing api.* sites at lines 152/161/177/191/194; CP15 zone added 2 sites at lines 143, 144). All three pre-existing apiClient zones verified UNTOUCHED post-execution. Pattern graduates to **five-data-point validation** in v2.22. Robust across page (CP13/CP14), partially-migrated-page (CP15 SocialProfileGenerator at 9+ pre-existing helpers — highest pre-existing density observed), and component (CP15 FeedBulkImport, EpisodeScriptTab) shapes.

**Pattern G zero-trigger admin-page heuristic — graduates to FOUR-data-point validation (UPDATED v2.22, supersedes v2.21 three-data-point). CP15 23-file zone surfaced ZERO Pattern G triggers across all 23 in-scope files** (admin pages, production pages, components, hooks all clean). Heuristic graduates to four-data-point validation: CP11 PressPublisher BUG-only sites + CP13 WorldAdmin + CP14 EpisodeDetail + CP15 (entire 23-file zone). Streaming-shape candidates remain concentrated in 5 chat/AI-writer files (BookEditor:58, WriteMode:1000, WriteMode:1191, WriteModeAIWriter:281, AppAssistant:239, useStoryEngine:358 — all 6 Pattern G locked sites are in chat/AI-writer files).

**Helper-reuse density pattern — graduates to two-data-point pattern (UPDATED v2.22, supersedes v2.21 single-instance observation). v2.21 §9.11 helper-reuse density observation was first instance at CP14 EpisodeDetail (4× reuse on listEpisodeLibraryScenesApi across mount + 3 reload-after-mutation paths; 40% reduction).** CP15 WorldSetupGuide is second instance: 3-way reuse on `getPageContentApi` across sites 1, 2, 4 (multi-tab status-check shape; 25% reduction at the 3-of-8 sites covered by reuse, with 6 helpers/8 sites = 25% file-level reduction). Pattern graduates to two-data-point pattern in v2.22. Two distinct underlying shapes: CRUD + reload-after-mutation (CP14) and multi-tab status-check (CP15) — both produce helper-count reduction via single loader covering multiple call sites. Forecasting heuristic, NOT a new convention — file-local helper convention v2.12 already handles helper reuse natively.

**v2.14 internal-helper-refactor pattern — five-data-point validation (UPDATED v2.22). Pattern reaches five data points**: CP3 (first instance), CP6 (second), CP15 MemoryConfirmation:51 (fourth — apiFetch wrapper, 5 call sites with varying methods), CP15 MemoryBankView:57 (fifth — apiFetch wrapper, 6 call sites with varying methods). Pattern application: when a file has a wrapper function that calls fetch internally and the wrapper is invoked from multiple call sites with varying methods/payloads, preserve the wrapper signature externally and swap the internal fetch for apiClient.request. Wrapper external API unchanged; auth bypass closed.

- Pattern F prophylactic discipline confirmed correct (fourteenth data point). All ~30 helpers use *Api suffix; component-internal handlers use file-local prefixes. No direct shadow conflicts.
- Cross-CP duplication: heavy density across CP15 (largest single-CP cross-CP duplication zone in F-AUTH-1). listRegistriesApi reaches 8-fold (3 new instances in CP15: MemoryBankView + useRegistries + Home pre-CP15 6th); listShowsApi reaches 6-fold (2 new instances: WorldSetupGuide + UniverseProductionPage). All applied per v2.12 file-local convention.
- Path E candidates: ~15 fresh + ~10 dedup-noted GET sites filed for §9.12 Step 3 sweep awareness. Track 6 Path E running list final state recorded for backend audit phase.
- No HTTP method mismatches surfaced. CP15 is the 14th consecutive CP with zero method mismatches (CP3-CP15 cumulative). Total method-correction discoveries remain at 5 across 15 CPs. Track 6 implementation closes with the streak intact.
- Pattern G allowlist UNCHANGED at 6 sites. Verification grep allowlist unchanged in v2.22.

###### TRACK 6 IMPLEMENTATION CLOSURE DECLARATION (NEW v2.22 §4.6 marker)

**Track 6 implementation phase is COMPLETE.**

Backbone state at closure: feature/f-auth-1 HEAD `04777edd`; backup at `04777edd`; v2.22 fix plan on `origin/dev`. 466 sites migrated across 15 checkpoints. 813 frontend tests passing across 102 test files (Track 6 grew tests from 135 baseline to 813, +678 new tests). 6 Pattern G locked sites maintained throughout. 22 fix plan revisions (v1.7 → v2.22) without a single corrupted state.

Final inventory state (38 sites across 9 files — **all deferred-by-discipline, NOT migratable**):

- `WorldStudio.jsx` (29 sites) — Path E LOCKED PUBLIC cluster, deferred to Step 3 backend audit
- 6 Pattern G locked sites: `BookEditor.jsx:58` (keepalive), `WriteMode.jsx:1000` (streaming SSE), `WriteMode.jsx:1191` (streaming SSE), `WriteModeAIWriter.jsx:281` (streaming), `AppAssistant.jsx:239` (streaming), `useStoryEngine.js:358` (streaming) — cannot migrate to axios per Pattern G locked-exception class
- `PressPublisher.jsx:119` (1 site) — CP11 LOCKED PUBLIC retained (intentionally unauthenticated; F-Auth-3 degradeOnInfraFailure exemption)
- External blob fetches (2 sites): `UIOverlaysTab.jsx` + `ProductionOverlaysTab.jsx:108` — S3 user-content URL fetches, not backend API; same disposition class

Track 6 final progress: **466/469 by site count = 99.4%** = **100% of migratable scope complete**. The 38 deferred sites are all ineligible for migration by structural class (LOCKED PUBLIC, Pattern G locked, external blob).

Pattern library locked across CP2-CP15:

- Patterns A/B/C/D/E (Track 5 era — auth disposition classes)
- Pattern F (v2.6) — Api suffix prophylactic
- Pattern G (v2.10/v2.19) — "can't-migrate-to-axios" exception class with default-on-matching-precedent discipline
- File-local duplication (v2.12) — duplicate locally rather than import; ceiling semantics clarified at v2.22 (8-fold operational, no hard cap)
- Method-branching split (v2.13)
- Multipart upload pattern (v2.14)
- Internal-helper-refactor (v2.14, 5-data-point validation at v2.22)
- Existing-test-file amendment (v2.15/v2.17/v2.19)
- Hook module-scope helper (v2.16/v2.19, 3-data-point validation)
- Service-module precedence inversion (v2.16/v2.20, 3-data-point validation)
- URL-branching split (v2.17)
- Mixed PUBLIC+BUG within file (v2.18) — CP11 PressPublisher only F-AUTH-1 instance
- Combined-axis branching split — stacking validated (v2.18)
- Callback-cluster preservation (v2.19 observation)
- Data-driven URL pass-through (v2.20 formal lock, 1 implementation at CP13 — distinct from internal-helper-refactor)
- Outer try/catch cleanup (v2.20 observation)
- Pattern G zero-trigger admin-page heuristic (v2.20/v2.21/v2.22 — 4-data-point validation)
- Partial-migration extension (v2.20/v2.21/v2.22 — 5-data-point validation)
- Helper-reuse density forecasting heuristic (v2.21/v2.22 — 2-data-point validation)

Disciplines validated across 15 checkpoints: **§9.13 Rule 2 backup-push discipline (15 same-turn pushes after each CP approval); Rule 6 integrator main-sync auto-merge benign (multiple force-overwrites across the arc); surface-with-cost-estimation (locked v2.8, conservative bias 1.4-2.0x across CP12-CP15 actuals); two-tier branch separation (feature/f-auth-1 implementation vs origin/dev docs); fix-plan revision atomicity (one revision per CP closure, integrator-side commits with explicit version bump).**

HTTP method mismatch streak: **14 consecutive zero CPs (CP3-CP15)**. Total method-correction discoveries: 5 across 15 CPs (3 from CP2 mid-flow + 1 from CP7 surface + 1 from CP9 surface verification). Pattern remains: file-level variation, not systemic. Track 6 implementation closes with the streak intact.

**Next phase: Step 3 backend sweep.** Different scope and shape than Track 6 implementation. Step 3 work includes per-route backend disposition adjudication (PUBLIC vs requireAuth), Path E candidate classification (running list of GET sites filed across CP2-CP15 for backend-side adjudication), HTTP method correction backend-side, security review, and reconciliation of the WorldSetupGuide reclassification + ProductionOverlaysTab reclassification into the canonical inventory. The pattern library locked across CP2-CP15 carries forward as documentation but does not drive Step 3 architectural decisions in the same way; the discipline that does carry forward is surface-with-cost-estimation, §9.13 backup-push discipline, and the conservative-forecasting bias.

###### Pacing model — 15 data points, Track 6 final state (NEW v2.22, supersedes v2.21)

Fifteen checkpoints across Track 6:

- **CP2** (1 file, 64 sites): 4 sessions, ~16 sites/session.
- **CP3** (1 file, 33 sites + 2 Pattern G): 3 sessions, ~11 sites/session.
- **CP4** (1 file, 18 sites): 1 session, 18 sites/session.
- **CP5** (3 files uniform-simple, 28 sites): 1 session, 28 sites/session.
- **CP6** (4 files heterogeneous, 38 sites): 1 session, 38 sites/session.
- **CP7** (10 files long-tail simplest-first, 39 sites): 1 session, 39 sites/session.
- **CP8** (10 files long-tail simplest-first, 38 sites): 1 session, 38 sites/session.
- **CP9** (8 files long-tail simplest-first, 40 sites): 1 session, 40 sites/session.
- **CP10** (8 files long-tail simplest-first, 42 sites): 1 session, 42 sites/session.
- **CP11** (17 files cleanup-overlap, 51 BUG-class migrated): 1 session, 51 sites/session.
- **CP12** (1 file dedicated high-density, 13 sites + 1 Pattern G locked): 1 session, 13 sites/session, 7.5 min/site.
- **CP13** (1 file dedicated high-density, 11 sites + 0 Pattern G): 1 session, 11 sites/session, 6.8 min/site.
- **CP14** (1 file dedicated high-density, 10 sites + 0 Pattern G): 1 session, 10 sites/session, 5.0 min/site.
- **CP15** (23 files multi-file long-tail, 43 sites): 1 session, **43 sites/session**, 2.8 min/site. Lowest cost-per-site observed in F-AUTH-1.

Track 6 final pacing characteristics:

- Total session count across 15 CPs: 22 sessions (CP2 4-session + CP3 3-session + 13 single-session). Implementation phase elapsed time: distributed across multiple Evoni work sessions over the development period.
- CP3 zone (high-density single, 10-13 sites/session): 4 data points (CP3, CP12, CP13, CP14). CP15 closes the dedicated-single shape.
- CP11 zone reframes (long-tail multi-file with heavy duplication, 43-55 sites/session): 2 data points (CP11 51 sites/session at 17 files; CP15 43 sites/session at 23 files). Lower edge of band achieved by larger file count + smaller average file site count.
- Conservative forecasting bias confirmed across 15 CPs: CP12 ~2.0x; CP13 ~1.7x; CP14 ~1.7x; CP15 ~1.0x (within forecast range, lower estimate). Average forecast/actual ratio: 1.5-2.0x. Surface-with-cost-estimation discipline accepts this bias as design feature throughout Track 6.
- Decreasing-cost trend across CP12-CP14 (7.5 → 6.8 → 5.0 min/site) for dedicated-single shape; CP15 at 2.8 min/site is heaviest cross-CP duplication density (mechanical translation drives per-site cost lowest).

###### Long-tail forecast — Track 6 implementation FINAL state (LOCKED v2.22)

Track 6 implementation phase complete. Final inventory state:

- Pre-Track 6 (start): ~603 sites flagged BUG-class via Track 5 raw-fetch triage
- Corrected denominator (post-CP3 reconciliation): ~469 actual
- Sites migrated across CP2-CP15: **466 sites**
- Sites deferred-by-discipline (post-CP15 inventory): **38 sites across 9 files** (29 WorldStudio Path E + 6 Pattern G + 1 PressPublisher LOCKED PUBLIC + 2 external blob)
- Track 6 progress final: **466/469 = 99.4% by site count = 100% of migratable scope**
- Pattern G locked exceptions: 6 (UNCHANGED throughout CP12-CP15 — last addition at CP12 useStoryEngine:358)
- Frontend test suite: **813/813 passing across 102 test files** (Track 6 grew tests +678 from baseline 135)
- Backbone state: HEAD `04777edd` on `feature/f-auth-1`; backup `04777edd` on `claude/f-auth-1-backup`; fix plan v2.22 on `origin/dev`.

No remaining migration work for Track 6 implementation phase. **All migratable scope is complete.** The 38 deferred sites do not migrate by structural class (LOCKED PUBLIC, Pattern G locked, external blob) — they require Step 3 backend sweep adjudication (Path E classification, mixed-disposition reconciliation) and/or remain as locked exceptions indefinitely.

#### §5 — Step 3 Backend Sweep Fix Plan (NEW v2.23, locks Step 3 implementation phase)

Step 3 backend sweep closes the F-AUTH-1 keystone (codebase-wide auth bypass at middleware/auth.js per Audit Handoff v8 §4.1). Track 6 closed the frontend side — every BUG-class fetch site migrated to apiClient with Bearer token. Step 3 closes the backend side — every write handler currently on optionalAuth or no-auth gets requireAuth (or admin-tier middleware where appropriate). Without Step 3, the F-AUTH-1 keystone remains open: optionalAuth lets unauth requests through to handlers that consume req.user via the silent-null fallback pattern (req.user?.sub).

Step 3 planning phase COMPLETE. Backend route surface inventory + Path E reconciliation matrix + scope adjudication + CP structure proposal + inventory amendments folded — all locked in Step_3_Planning_Inventory.md (generated on feature/f-auth-1, summarized in v2.23). 17 adjudication items locked. Step 3 fix plan section folds the planning output into canonical fix-plan structure.

##### §5.1 — Step 3 sweep surface (NEW v2.23, derived from Step 3 planning inventory)

Backend route surface inventory:

- **142 backend route files** under src/routes/ (including 9 in memories/ subdir)
- **~135 distinct mount points** in src/app.js
- **1,397 total handlers** across all route files
- **894 write handlers** (POST/PUT/PATCH/DELETE)
- ~16 writes already on requireAuth + ~75 on authenticateToken (Cognito strict)
- F-AUTH-1 sweep surface (writes on optionalAuth or no-auth): **~803 handlers**
- **22 mixed-middleware files** + **29 no-auth files** (handlers > 0, all middleware counts 0 — wide-open auth bypass at file level)
- Path E candidates filed across CP2-CP15: ~106 distinct endpoints (~120 with CP15 fresh additions)
- F-AUTH-3 degradeOnInfraFailure consumers TODAY: **0** (factory built, no routes opt in; press.js + manuscript-export.js are the 9 expected consumers per CP11 PressPublisher precedent)
- F-AUTH-5 sites verified: 6/6 confirmed in current codebase (decisionLogs:22, cursorPathController:22, iconCueController:22, musicCueController:20, productionPackageController:22, thumbnails:80) — all resolve naturally as F-AUTH-1 byproducts
- HTTP method corrections from Track 6: 5 (CP2 ×3 mid-flow + CP7 ×1 surface + CP9 ×1 surface) — backend route declarations need verification + correction

Concentrated sweep zones (top 10 by write-handler count): `sceneSetRoutes.js` 51, `worldEvents.js` 38, `worldStudio.js` 35 (Path E LOCKED PUBLIC), `characterRegistry.js` 31, `episodes.js` 46-mixed (15 authenticateToken + 4 optionalAuth + 3 requireAuth + ~55 no-auth + 2 commented-out — **highest-risk file**), `storyteller.js` 24, `tierFeatures.js` 24, `socialProfileRoutes.js` 24, `wardrobe.js` 25 (mixed; controller-bound routes have no auth), `memories/* aggregator` 52 across 6 sub-routers.

##### §5.2 — Step 3 disposition tier matrix (NEW v2.23 architectural lock)

Step 3 sweep applies one of **5 disposition tiers** per handler. Tier assignment is the central architectural decision per route. The matrix is the canonical reference for which middleware applies where; per-CP surface reports enumerate handlers by tier.

- **Tier 1 — requireAuth (default).** Per-user data, mutations, AI generation, all routes that consume req.user as authenticated identity. The bulk of the ~803-handler sweep surface. Migration shape: replace optionalAuth (or add to no-auth handlers) with requireAuth from middleware/auth.js. Test impact: route-health tests gain requireAuth assertion (401 without token, 200/201 with valid token).
- **Tier 2 — requireAuth + authorize(['ADMIN']).** Admin tooling, internal infrastructure, audit logs, internal financial/system data. Pattern is mature in codebase already (middleware/auth.js:300 authorize() helper, in production use across admin.js + auditLogs.js + templates.js + assets.js). Routes locked to Tier 2: site-organizer, design-agent, auditLogs, templates (5 handlers — partial-migration target), seed.js (in non-prod), queue-monitor (Bull-board UI), cfoAgentRoutes, aiUsageRoutes. Migration shape: `authenticate, authorize(['ADMIN'])` applied at handler or router-mount level.
- **Tier 3 — optionalAuth({ degradeOnInfraFailure: true }).** LOCKED PUBLIC routes that consume req.user (e.g., for personalization-when-authenticated, audience-growth scenarios). Frontend retains raw fetch with PUBLIC marking. Per CP11 PressPublisher precedent. Routes locked to Tier 3: press.js (6 GETs), manuscript-export.js (3 GETs) — F-AUTH-3 expected consumers; WorldStudio cluster subset (where req.user consumption surfaces). Migration shape: replace plain `optionalAuth` with `optionalAuth({ degradeOnInfraFailure: true })` factory invocation. F-AUTH-3 consumer count goes from 0 to 9+ in CP1.
- **Tier 4 — plain optionalAuth** (LOCKED PUBLIC where req.user not consumed). Published-only data routes that don't personalize per-user. Routes locked to Tier 4: WorldStudio cluster subset (the 29-site Path E LOCKED PUBLIC cluster, split between Tier 3 and Tier 4 per req.user consumption analysis at CP3 surface). Migration shape: leave optionalAuth as-is, ADD `// PUBLIC: published-only data — see Audit Handoff §4.1` comment with brief rationale (so future audits don't re-classify as bugs).
- **Tier 5 — env-gated mount (development-only).** Routes that should not be reachable in production. Routes locked to Tier 5: seed.js (3 handlers — DB seed endpoints). Migration shape: app.js mount expression becomes `if (process.env.NODE_ENV !== 'production') app.use(...)`; non-prod still requires Tier 2 (admin-role). Belt-and-suspenders.

**Two-tier sweep, not single-tier.** Step 3 isn't just optionalAuth → requireAuth. Each handler gets per-route adjudication into one of the 5 tiers. Per-CP surface reports must enumerate handlers by tier; per-CP closure reports verify no handlers fell through unclassified.

##### §5.3 — Adjudication items locked (17 items from planning phase)

17 adjudication items locked from planning phase (Step_3_Planning_Inventory.md). Listed in adjudication-item order for traceability:

- **Item 1 (Step 3 scope IN/OUT): LOCKED.** F-AUTH-1 sweep IN, Path E disposition IN, F-AUTH-2 boot-fail IN parallel (CP1 must land before CP2-CP10), F-AUTH-3 exemption list IN (CP1), F-AUTH-5 IN as F-AUTH-1 byproduct, HTTP method corrections IN (CP11 cleanup), inventory v2 reconciliation IN as prerequisite. jwtAuth path OUT per Decision D20 (compositions.js JWT subset stays as-is; the 22 no-auth subset within compositions.js is IN at CP7).
- **Item 2 (Track 7 timing): LOCKED Option C (hybrid).** Step 3 + Track 7 share planning + classification matrix; execute as separate CP series. After each Step 3 CP locks PUBLIC routes, a follow-up Track 7 mini-CP reverts the corresponding frontend sites. Path E classification is the work product both phases consume — sharing avoids redoing analysis.
- **Items 3 + 4 (site-organizer + design-agent GETs): LOCKED Tier 2 (requireAuth + authorize(['ADMIN'])).** Public-internet-reachable per Evoni empirical inspection (mounted at /api/v1/site-organizer + /api/v1/design-agent unconditionally; nginx /api proxies without IP allowlist or basic auth). Route exposes runFullScan / runFullAudit output (route map, file structure, design-token compliance) — sensitive surface even for authenticated non-admin. CP10 scope.
- **Items 5 + 6 (auditLogs + templates): LOCKED Tier 2 (requireAuth + authorize(['ADMIN'])).** Both files are partial-migration targets — auditLogs.js lines 64+128 already use authenticate + authorize(['ADMIN']); templates.js partial 3-of-5. Apply existing pattern uniformly across all handlers in each file. CP10 scope. Existing partial-migration shape collapses item 6 into item 5 disposition.
- **Item 7 (seed.js): LOCKED Tier 5 + Tier 2.** Env-gated mount expression: `if (process.env.NODE_ENV !== 'production') app.use('/api/v1/seed', authenticate, authorize(['ADMIN']), seedRoutes);`. Combined gate: prod skip + non-prod still requires admin-role. CP10 scope.
- **Item 8 (queue-monitor): LOCKED Tier 2 at mount line.** Bull-board sub-router (router.use('/', serverAdapter.getRouter())) bypasses Express-route-level auth; auth must apply at mount line in app.js. Mount expression: `app.use('/admin/queues', authenticate, authorize(['ADMIN']), queueMonitorRoutes);`. Production keeps Bull-board available for ops; admin-role is the access gate. NOT disabled in prod. CP10 scope.
- **Item 9 (thumbnails GETs): LOCKED Tier 1 (requireAuth).** Per-user content; no admin-role required. CP9 scope.
- **Item 10 (compositions 22 no-auth handlers): LOCKED Tier 1 (requireAuth)** on the 22 no-auth subset. The 7 jwtAuth handlers stay as-is per D20 (out of F-AUTH-1 scope). Mixed-middleware shape acceptable — auth.js itself has the same shape (login/refresh public + /me/logout JWT). CP7 scope.
- **Item 11 (Cadence option lock): LOCKED Hybrid 10 domain CPs + 1 cleanup CP.** Per-route-file (~132 CPs) too granular; per-disposition-class (3 CPs) too coarse; per-domain (10-15) matches Track 6 cadence. Hybrid threads the needle.
- **Item 12 (CP1 scoping): LOCKED combined F-AUTH-2 + F-AUTH-3 in single CP1.** F-AUTH-2 lazy-init refactor (~30 LOC change at middleware/auth.js) + F-AUTH-3 9-handler degradeOnInfraFailure migration share dependency (F-AUTH-3 depends on F-AUTH-2 being production-safe). Both touch auth middleware infrastructure. No CP0 split.
- **Item 13 (CP boundaries): LOCKED with re-cluster.** Files moved per Q13 redistribution: franchiseBrainRoutes + pdfIngestRoute → CP7; onboarding + shows + uiOverlayRoutes + todoListRoutes → CP2; universe → CP6; layers → CP9; authorNoteRoutes → CP7. Drafted CP10 duplicates removed (tierFeaturesRoutes, wantFieldRoutes, wardrobeEventRoutes, manuscript-export, press, episodeScriptWriterRoutes, feedPipelineRoutes, feedEnhancedRoutes). Final CP file/handler counts: CP2 21/170, CP6 18/118, CP7 28/160, CP9 19/84, CP10 20/75. Total Step 3 estimate ~20-22 sessions unchanged.
- **Item 14 (Episodes.js commented-out auth): LOCKED handle in CP2.** Lines 400 + 473 with // ✅ COMMENTED OUT FOR TESTING markers resolved when episodes.js is on the operating table at CP2. No deferral to CP11 cleanup.
- **Item 15 (WorldStudio backend marking pattern): LOCKED two-tier within Tier 3/Tier 4 split.** Routes consuming req.user → Tier 3 (`optionalAuth({ degradeOnInfraFailure: true })` + PUBLIC comment with rationale). Routes NOT consuming req.user → Tier 4 (plain optionalAuth + PUBLIC comment with rationale). Per-route adjudication at CP3 surface report. Brief rationale required on every PUBLIC marking so future audits don't re-classify as bugs.
- **Item 16 (wardrobeLibrary.js:18 env-conditional middleware): LOCKED fix in CP5 wardrobe cluster.** Replace `const authMiddleware = isDevelopment ? <noop> : authenticate` with uniform `authenticate` everywhere; remove the conditional. Same domain, same CP.
- **Item 17 (press.js + manuscript-export.js lazy-noop fallback removal): LOCKED tied to CP1 F-AUTH-2 fix.** The lazy-noop fallback IS the auth bypass mechanism that fires if F-AUTH-2 boot-fail triggers. Remove try/catch require pattern; fail-fast on auth import. Once F-AUTH-2 lazy-init makes auth.js boot-safe, the defensive try/catch becomes unnecessary AND a security liability. CP1 closes both halves of F-AUTH-2/3 double-jeopardy; partial fix is worse than no fix because it creates false sense of safety.

##### §5.4 — Step 3 CP structure (LOCKED v2.23, 11 CPs)

Domain partitions per Item 13 lock. Each CP = 1 commit, 1-2 sessions (CP10 forecast holds at 2 sessions post-recluster):

- **CP1 — F-AUTH-2 + F-AUTH-3 (small, focused).** middleware/auth.js lazy-init refactor (~30 LOC) + press.js 6 handlers + manuscript-export.js 3 handlers Tier 3 migration + lazy-noop fallback removal in both files. ~9 handlers + lazy-init. 1 session.
- **CP2 — Episodes cluster.** episodes.js (highest-risk file — landmines at lines 400+473 + 55 no-auth writes), episodeBriefRoutes.js (reference model), episodeOrchestrationRoute.js, episodeScriptWriterRoutes.js, gameShows.js, iconCues.js, cursorPaths.js, musicCues.js, productionPackage.js, lalaScripts.js, scriptParse.js, timelineData.js, wardrobeApproval.js, phonePlaythroughRoutes.js, phoneAIRoutes.js, phoneMissionRoutes.js, sceneStudioEpisodeRoutes.js, **+ onboarding.js, shows.js, uiOverlayRoutes.js, todoListRoutes.js (Q13 redistribution)**. 21 files / ~170 handlers (upper edge of session budget). Mount-collision on /api/v1/episodes (9 routers share prefix) — surface report enumerates all 9 routers explicitly. Episodes.js commented-out auth resolved at CP2 (Item 14). 2 sessions.
- **CP3 — World cluster.** world.js, worldEvents.js (5 AI-cost POSTs already on requireAuth — reference model), worldStudio.js (29-site Path E LOCKED PUBLIC cluster — Tier 3/Tier 4 split per Item 15), worldTemperatureRoutes.js (zero handlers, no sweep). 4 files / ~85 handlers. Per-route Tier 3 vs Tier 4 adjudication at surface. 2 sessions.
- **CP4 — Scene cluster.** sceneSetRoutes.js (largest single-file sweep zone, 51 writes), scenes.js (5 dev/test no-auth — remove or promote), sceneTemplates.js, sceneLibrary.js, sceneLinks.js, sceneProposeRoute.js. 6 files / ~85 handlers. 2 sessions.
- **CP5 — Wardrobe cluster.** wardrobe.js (controller-bound routes have no auth — full per-handler audit), wardrobeLibrary.js (env-conditional authMiddleware removal — Item 16), wardrobeBrands.js, wardrobeEventRoutes.js, outfitSets.js (audit §4.1(b) sub-form closure), hairLibraryRoutes.js, makeupLibraryRoutes.js. 7 files / ~80 handlers. 2 sessions.
- **CP6 — Character cluster.** characterRegistry.js (largest no-auth-write surface, ~26 no-auth writes), characterAI.js, characterCrossingRoutes.js, characterDepthRoutes.js, characterFollowRoutes.js, characterGenerationRoutes.js, characterGenerator.js, characterGrowthRoute.js, characterSparkRoute.js, characters.js, entanglementRoutes.js, relationships.js, therapy.js, consciousness.js, mirrorFieldRoutes.js, wantFieldRoutes.js, feedRelationshipRoutes.js, **+ universe.js (Q13 redistribution — universe upstream of character generation)**. 18 files / ~118 handlers. 2 sessions.
- **CP7 — Storyteller + memories cluster.** storyteller.js, memories/* × 7 (assistant, core, engine, extras, interview, planning, stories, voice — sweep must touch each sub-router individually since memories/index.js is an aggregator), stories.js, storyEvaluationRoutes.js, storyHealth.js, markers.js, beats.js, decisions.js, decisionLogs.js (F-AUTH-5 site), decisionAnalytics.js, arcRoutes.js, arcTrackingRoutes.js, evaluation.js, continuityEngine.js, novelIntelligenceRoutes.js, eventGeneratorRoute.js, templateStudio.js, compositions.js no-auth subset (Item 10 — Tier 1 on 22 handlers; jwtAuth subset stays as-is per D20), **+ franchiseBrainRoutes.js, pdfIngestRoute.js, authorNoteRoutes.js (Q13 redistribution)**. 28 files / ~160 handlers. 2 sessions, upper edge.
- **CP8 — Social-profiles + feed cluster.** socialProfileRoutes.js, socialProfileBulkRoutes.js, feedSchedulerRoutes.js, feedPostRoutes.js, feedPipelineRoutes.js, feedEnhancedRoutes.js, undergroundRoutes.js, tierFeatures.js, pageContent.js (resolve duplicate import — Anomaly #9), calendarRoutes.js. 10 files / ~115 handlers. 2 sessions.
- **CP9 — Production tooling cluster.** thumbnails.js (Item 9 — Tier 1 on 6 GETs; F-AUTH-5 site at line 80), thumbnailTemplates.js, metadata.js, assets.js, imageProcessing.js, roles.js, editMaps.js, footage.js, animatic.js, audio-clips.js, character-clips.js, scriptGenerator.js, scriptAnalysis.js, scripts.js, lala-scene-detection.js, youtube.js, texture-layer, season-rhythm, **+ layers.js (Q13 redistribution)**. 19 files / ~84 handlers. 2 sessions.
- **CP10 — Admin/internal cluster.** admin.js, aiUsageRoutes.js (Tier 2), cfoAgentRoutes.js (Tier 2), siteOrganizerRoutes.js (Tier 2 — Item 3), designAgentRoutes.js (Tier 2 — Item 4), auditLogs.js (Tier 2 — Item 5), seed.js (Tier 5 + Tier 2 — Item 7), session.js, propertyRoutes.js, auth.js /me-/logout review, jobs.js, files.js, search.js, processing.js, queue-monitor.js (Tier 2 at mount line — Item 8), amberSessionRoutes.js, amberDiagnosticRoutes.js, upgradeRoutes.js, opportunityRoutes.js, feedRelationshipRoutes.js. 20 files / ~75 handlers. Re-clustered per Q13 (drafted duplicates removed; 8 files relocated to CP2/CP6/CP7/CP9). All admin/system/internal-tooling — coherent domain. 2 sessions.
- **CP11 — Cleanup CP.** HTTP method corrections (5 routes from CP2/CP7/CP9 frontend surfaces — verify backend route declarations match) + cross-domain edge cases + verification grep + post-sweep audit. Small, focused. 1 session.

Total Step 3 estimate: **11 CPs / ~20-22 sessions**. Conservative bias applied (1.5-2.0x per CP12-CP15 trajectory). Backend sweep CPs may run faster than frontend (mechanical middleware swap is ~5 LOC per handler vs ~15-30 LOC per frontend migration), but per-route adjudication overhead is higher (each route needs Tier 1-5 classification check).

##### §5.5 — Step 3 anomalies (NEW v2.23, requires explicit handling per CP)

9 critical anomalies surfaced during planning phase — each requires explicit handling at the CP that touches the relevant file:

- **Anomaly 1: memories/index.js aggregator** composes 6 sub-routers; sweep must touch each file individually (~72 handlers in memories/*). CP7 surface report enumerates per sub-router.
- **Anomaly 2: wardrobeLibrary.js:18 env-conditional middleware.** Item 16 lock applies — fix in CP5.
- **Anomaly 3: episodes.js lines 400+473 commented-out auth.** Item 14 lock applies — resolve in CP2.
- **Anomaly 4: press.js + manuscript-export.js lazy-noop fallback** (F-AUTH-2 double-jeopardy). Item 17 lock applies — fix in CP1.
- **Anomaly 5: scaffolded route files** (luxuryFilterRoutes, seasonRhythmRoutes, worldTemperatureRoutes — registered in app.js but ZERO handlers). NO sweep action. Filed in CP3 (worldTemperature) + CP9 (seasonRhythm) for documentation.
- **Anomaly 6: queue-monitor.js Bull-board sub-router bypass.** Item 8 lock applies — auth at mount line in CP10.
- **Anomaly 7: pdfIngestRoute.js:257 Express error handler** (NOT auth middleware — counted as no-auth in inventory). Document in CP7 closure.
- **Anomaly 8: /api/v1/episodes mount overlap** (9 routers share the prefix; app.use order disambiguates). Surface report at CP2 enumerates all 9 routers with per-router handler counts and middleware classes; silent shadowing risk if path patterns conflict.
- **Anomaly 9: pageContent.js duplicate import** (router.use(optionalAuth) AND imports authenticateToken — redundant). Resolve in CP8.

Critical callout: **outfitSets.js confirms audit §4.1(b) sub-form**. CP5 sweep makes the audit finding closure-quality.

##### §5.6 — Step 3 readiness checklist

- State verified: HEAD 04777edd (Track 6 closure), backup matches, working tree clean
- v2.23 fix plan landed on origin/dev with Step 3 plan + adjudications recorded
- All 17 planning-phase adjudication items locked
- Step 3 disposition tier matrix locked (5 tiers; per-CP surface reports enumerate handlers by tier)
- Backend test suite baseline captured (pre-Step-3 pass count for delta tracking)
- Per-route route-health test stubs reviewed (existing tests at tests/unit/routes/* and npm run validate)
- Step 3 CP1 surface report kickoff message ready (covers F-AUTH-2 lazy-init + F-AUTH-3 exemption list + lazy-noop fallback removal)
- Track 7 timing locked Option C (hybrid) — Track 7 mini-CPs follow each Step 3 CP with PUBLIC route classifications

After v2.23 lands on origin/dev, Step 3 CP1 kicks off in fresh Claude Code session on feature/f-auth-1. CP1 is small + focused (F-AUTH-2 lazy-init refactor + F-AUTH-3 9-handler migration + lazy-noop removal); 1 session forecast.

##### Track 7 — UNCLEAR-A reconciliation (NEW v2.0, runs in parallel with Step 3)

71 UNCLEAR-A sites: GETs on mixed-verb routes (`episodes`, `storyteller`, `shows`, `characters`, `wardrobe`, `onboarding`, `story-health`). Each one's correct disposition (PUBLIC vs BUG) depends on which Step 3 per-route classification gets applied to the corresponding backend route.

- Step 3 sweep classifies each backend mixed-verb route as either: (a) PUBLIC published-only data (gets `// PUBLIC:` comment + `degradeOnInfraFailure` flag), or (b) auth-required (gets `requireAuth`).
- Track 7 mirrors that classification on the frontend: for each Step 3 (a) classification, the corresponding frontend GET stays as raw fetch with no auth (PUBLIC); for each (b), the GET migrates to `apiClient`.
- Track 7 does not run independently — it runs in parallel with Step 3, file-by-file, as Step 3 classifies each route. This avoids re-doing Track 7 work if Step 3 reclassifies later.

UNCLEAR-B (144 sites in 32 files): per Track 5's spot-check, ~80% are Path D (already covered by Track 4) and ~20% are hidden BUGs (covered by Track 6). **No separate Track 8.** UNCLEAR-B resolves naturally as Tracks 4 and 6 land. `EpisodeDetail.jsx` is the clearest example: mixed-paradigm with hidden bare-fetch BUGs; treated as a Track 6 file when its turn comes.

##### Verification (G3 + G4)

After all six implementation tracks (1, 2, 3, 4, 6, 7): zero imports of `authHeader` (Path A), zero local `authHeaders()` helpers (Path C), zero inline `Bearer ${token}` (Path D) — except the locked `BookEditor:181` keepalive exception, zero BUG-class raw fetches (Track 6), zero unresolved UNCLEAR-A (Track 7). Verification greps confirm.

```bash
grep -rn "authHeader\b" frontend/src/ | grep -v "authHeaders" | grep -v "test\.\|\.test\."
```

Expected output: zero matches. (Production code; test files may contain "authHeader" in test descriptions and are excluded.)

```bash
grep -rn "Bearer \${" frontend/src/ | grep -v "src/services/api.js" | grep -v "BookEditor.jsx:55" | grep -v "WriteMode.jsx:980" | grep -v "WriteMode.jsx:1145" | grep -v "test\."
```

Expected output: zero matches. The four allowlisted locations are: (a) `src/services/api.js` — the apiClient request interceptor itself; (b) `BookEditor.jsx:55` — the locked CZ-5 keepalive exception; (c) `WriteMode.jsx:980` — locked streaming SSE exception (voice-to-story, v2.10); (d) `WriteMode.jsx:1145` — locked streaming SSE exception (story-continue, v2.10).

```bash
grep -rn "fetch(" frontend/src/ | wc -l
```

Expected: drops from 627 (current) to count of intentionally-public reads only (PUBLIC class — currently 5 confirmed, may grow as Track 7 reclassifies UNCLEAR-A) PLUS the three locked exceptions (BookEditor.jsx:55 keepalive + WriteMode.jsx:980 + WriteMode.jsx:1145 streaming SSE) = 8 minimum.

Sharper file-scoped variant (locked v2.10 from CP3 verification): `grep -nE '^\s*[^/]*\bfetch\(' <file>` — anchors to start-of-line plus excludes comment-prefixed matches. The default `grep -cE 'fetch\('` counts comment hits too; the sharper form is more precise for per-file verification during CP execution. Use the sharper form in CP reports.

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
- **Step 6b — TRACK 6 IMPLEMENTATION CLOSED.** Track 5 raw-fetch triage COMPLETE (commit `a929ce29` on dev). Track 1 apiClient interceptor update COMPLETE (commit `da604ed2`). Track 1.5 frontend test scaffolding COMPLETE (commit `94f6cce6`). Track 1.6 backend requireAuth split COMPLETE (commit `e0b03d18`). Track 2 Path A migration COMPLETE (commits `501cd737` + `59f9868a`). Track 2.5 behavioral tests COMPLETE (commit `a079a04b`). Track 3 Path C migration COMPLETE both stages (commits `c6047c46` + `69f0a926`). Track 4 Path D migration COMPLETE (commits `08a24fec` + `06beb1d1`). Track 6 CP2-CP15 COMPLETE through commit `04777edd`; **466 sites migrated across 70 files; 813/813 frontend tests across 102 test files; 466/469 = 99.4% by site count = 100% of migratable scope** (38 deferred-by-discipline sites remain). Pattern G locked: 6 sites (UNCHANGED throughout CP12-CP15). Backed up at `04777edd` on `claude/f-auth-1-backup`. **Step 3 backend sweep planning phase COMPLETE**; v2.23 fix plan locks 11-CP cadence + 5-tier disposition matrix + all 17 adjudication items. Step 3 CP1 (F-AUTH-2 lazy-init + F-AUTH-3 exemption list) kicks off next, fresh session after v2.23 lands on dev.
- **Steps 3, 4, 5, 1 — NOT STARTED.** Per §5.2 implementation order.

#### Surfaces for Step 6b reconciliation (preserved across two implementation rounds)

- Frontend has TWO auth-injection paths: axios `apiClient` interceptor at `src/services/api.js` + `authHeader()` direct-fetch helper at `frontend/src/utils/storytellerApi.js`. `BookEditor.jsx` uses `authHeader()`. Both must be reconciled in Step 6b. Inventory of `authHeader()` callers required before Step 6b implementation begins — this is a Step 6b prep deliverable.
- `jest.spyOn` cannot intercept calls from inside the same module on CommonJS const-bound exports (closure binding, not export reference). Use `jest.mock('<dependency-module>')` with the factory form. Worth knowing for future test additions.
- Polymorphic `optionalAuth` detection (middleware vs factory shape) means `optionalAuth.toString()` introspection is no longer reliable. No consumer in codebase does this; flagged in case Step 6b interceptor work hits it.
- `verifyToken` has TWO paths that wrap verifier errors with `Error.cause`: the test path (`NODE_ENV=test` → `tokenService.verifyToken`) and the prod path (aws-jwt-verify direct). Both were updated in Step 2; do not regress either if Step 6b reconciliation touches `verifyToken`.
- **Track 1 surfaces (preserved for sequencing):** (1) frontend has no test scaffolding — vitest in package.json but no config, no jsdom, no `.test` files; addressed by Track 1.5. (2) Backend `requireAuth` emits `AUTH_REQUIRED` for both no-header and verifier-rejected; new contract requires the split; addressed by Track 1.6. (3) `AUTH_GROUP_REQUIRED` returns 403 (not 401); code-before-status check in Track 1 interceptor handles this correctly. (4) `authService.refreshToken()` duplicates the new `refreshAccessToken` helper — kept separate in Track 1 to avoid circular auth; cleanup in §9.12.

#### Track 1.5 — frontend test patterns (LOCKED v2.2 for reuse in Tracks 2/3/4/6/7)

Three reusable test patterns established by Track 1.5 (commit `94f6cce6`). Future migration tracks should adopt these rather than re-deriving them.

**Pattern A — `vi.stubEnv` for DEV-gated code:** `import.meta.env.DEV` is **truthy by default in vitest** (vitest 0.34 derives DEV from `NODE_ENV ≠ 'production'`; `MODE='test'` does not flip it). Vite's `define` config does not apply because vitest evaluates `import.meta.env.DEV` at runtime via its env proxy. Use `vi.stubEnv('DEV', '')` in `beforeEach` + `vi.unstubAllEnvs()` in `afterEach`. Empty string is falsy → DEV-guarded early-returns are bypassed → real logic runs.

**Pattern B — partial axios mock that preserves `axios.create`:** `apiClient` is constructed via `axios.create({...})` at module load. Mocking the entire axios default export would break that construction. Use `Object.assign` to copy real `axios.default` properties onto a callable function shell, then override only the methods you want to mock:

```js
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal();
  const mockedDefault = function axiosFn(config) { return actual.default(config); };
  Object.assign(mockedDefault, actual.default);
  mockedDefault.post = vi.fn();
  return { default: mockedDefault };
});
```

**Pattern C — `apiClient.defaults.adapter` swap for retry verification:** To prove that an interceptor retry actually fires apiClient a second time without making real network calls, swap `apiClient.defaults.adapter` to a `vi.fn().mockResolvedValue(...)` for the duration of the test. After the interceptor handler resolves, `expect(adapterMock).toHaveBeenCalledTimes(1)` confirms the retry happened. Restore in `finally` so test isolation holds. The retry exercises real interceptor logic end-to-end, not a mock chain.

Note: pattern A applies to any DEV-gated code in any module. Patterns B and C are specific to apiClient testing but the techniques generalize: partial mocks preserving constructor methods, adapter swapping to test retry/redirect/interceptor behavior end-to-end without network.

**Pattern D — `vi.mock` + static imports for module-scope helpers that capture apiClient at load time:** Track 2.5 (commit `a079a04b`) extracted small const helpers like `export const saveDraftProse = (chapterId, proseText) => apiClient.post(...)` to make migrated call sites testable. The helper captures `apiClient` at module load. To test the helper with a mocked apiClient, declare `vi.mock('@/services/api', () => ({ default: { post: vi.fn(), ... } }))` BEFORE the static `import { saveDraftProse } from '@/components/BookEditor.jsx'`. vi.mock is hoisted by vitest, so the mock is in place when the helper module evaluates. The helper sees the mocked `apiClient`; tests verify call shape with `expect(apiClient.post).toHaveBeenCalledWith(...)`. This pattern lets module-scope helper extractions be tested without full RTL component rendering.

**Pattern E — multi-method mock reset for apiClient mocks:** When the apiClient mock has multiple `vi.fn()` properties (post, put, get, delete, request, etc.), reset all of them between tests with `Object.values(apiClient).forEach((fn) => fn?.mockReset?.())` in `beforeEach`. The optional-chain on `mockReset` handles the case where some properties of the mock object are not `vi.fn()` (defensive against future changes to the mock factory). Track 2.5 established this pattern; reuse for all later tracks that mock apiClient.

Patterns D and E together enable the **module-scope-extraction** approach Tracks 3, 4, 6, and 7 should use for behavioral test coverage of migrated call sites: extract inline `apiClient.X(...)` invocations to 1-4 line const helpers, mock apiClient with vi.mock at module top, import the helpers statically, reset all methods in beforeEach. No full RTL setup required. Validated across 8 helpers in 3 files (Track 2.5) with zero genuine "cannot test without RTL" cases surfaced.

**Pattern F — Api-suffix convention for shadow-conflict resolution:** When extracting Track 2.5-style module-scope helpers from a file where component-local handler names mirror the endpoint operation names (e.g., a component with `finalizeProfile` handler whose body wraps a network call to `/profiles/finalize`), naming the extracted helper `finalizeProfile` shadows the component handler. Resolution: suffix the network helper with `Api` (`finalizeProfileApi`). Component handler stays unchanged — it imports and wraps the API helper plus UI state updates. Track 3 Stage 2 (commit `69f0a926`) established this pattern across 11 conflicts in SocialProfileGenerator.jsx; document the convention in a module-scope comment when applied so future contributors understand the suffix.

Pattern F applies wherever Tracks 4 and 6 encounter files with component-handler names matching endpoint operation names. Two notable Track 6 files where this is likely: `SceneSetsTab.jsx` (64 sites) and `FranchiseBrain.jsx` (18 sites). Apply the suffix convention from the start of each file's migration rather than discovering shadow conflicts mid-flow.

**File-local helper convention (LOCKED v2.12, validated by CP5 cross-file overlaps): helper modules are file-local; cross-file imports are not used in F-AUTH-1 even when endpoints overlap.** When a Track 6 file hits an endpoint already covered by another Track 6 file's helper, the helper is duplicated locally rather than imported. Each CP commit's helper module is self-contained per CP2/CP3/CP4/CP5 precedent. Duplication cost is bounded (~3 LOC per helper) and discoverable; cross-file imports would break test-per-file isolation. Validated against 4 cross-file duplications in CP5 (3 in EpisodeScenesTab: `listSceneSetsApi`, `suggestAnglesApi`, `createAngleApi` + 1 in SeriesPage: `listShowsApi`). Total drift surface ~12 LOC across CP5; benign.

**Inline-anonymous-onClick handling (LOCKED v2.13, validated by CP6 — 2 sites): when a fetch site is an inline anonymous async arrow inside a JSX onClick handler, extract to a module-scope helper, then call from a named handler function.** Do not migrate inline fetch inside JSX onClick — the structural pattern is anti-Pattern-D (hard to test, hard to refactor, harder to debug). Cost ~2 LOC per extraction; produces testable handler functions matching CP2-CP5 discipline. Validated against CharacterGenerator:312 + CharacterTherapy:625 in CP6.

**setInterval polling sites (LOCKED v2.13, validated by CP6 — 1 site): when a fetch site is inside a setInterval callback, replace the inner fetch with the apiClient helper call.** setInterval / clearInterval semantics are unchanged. Validated against TemplateDesigner.startPolling in CP6.

**Method-branching split (LOCKED v2.13, validated by CP6 — 1 site): when a single handler conditionally chooses POST vs PUT based on whether an entity exists, split into two helpers (createXApi + updateXApi) and let the call site do the conditional.** Cleaner than parameterizing method on a single helper. Validated against TemplateDesigner.handleSave in CP6.

**Hardest-first execution discipline (LOCKED v2.13, validated by CP6): in multi-file batches with heterogeneous cost-class distribution, migrate the highest-complexity file first.** Combined with explicit hard-cap on the hardest file (CP6 used 90-min cap on CharacterGenerator). Rationale: complexity surprises in the hardest file are most likely to force WIP-and-resume; surfacing them first preserves clean checkpoint discipline. The hard cap is a guardrail; if not triggered, it confirms the cost-class predictor was accurate.

**Simplest-first execution for long-tail batches (LOCKED v2.14, validated by CP7): in long-tail batches with many small files, migrate simplest files first.** Builds migration cadence in the first ~15 minutes via single-site warm-up files; defers anchors (6-8 sites each) to second half when discipline is internalized. Opposite of hardest-first because long-tail files are bounded — no real cost-class outlier; momentum matters more than fail-fast. Validated against CP7's 10-file batch (5 single-site warm-ups + 5 anchor files).

**Multipart upload pattern (LOCKED v2.14, validated by CP7 — 1 site at PdfIngestZone): when a fetch site uses FormData payload for multipart upload, pass FormData directly as second argument to `apiClient.post(url, formData)`.** Do NOT manually set Content-Type header — axios detects FormData and sets the multipart Content-Type with the correct boundary automatically. Helper signature: `uploadXxxApi(formData) → apiClient.post(url, formData)`. Future Track 6 multipart sites follow same pattern.

**Internal-helper-refactor pattern (LOCKED v2.14, validated by CP7 — WorldDashboard.safeFetch): when a file has its own internal fetch wrapper used by multiple callers, refactor the wrapper internally to use apiClient rather than migrating each caller individually.** Caller-side simplicity preserved (callers unchanged). The migration is a single edit inside the wrapper. Avoids unnecessary call-site churn. Future tracks encountering similar internal-fetch-wrapper patterns follow the same approach.

**Method-correction discovery — surface-time vs mid-flow (NEW v2.14): with surface-with-cost-estimation discipline (locked v2.8), method-correction discovery moves earlier in the workflow.** CP2 caught 3 mid-flow; CP3-CP6 caught 0 mid-flow; CP7 caught 1 at surface (CFOAgent setBudget PUT-not-POST). Surface-time is preferred because corrections are cheaper to handle before any code changes. Both modes remain valid; the CP2 finding pattern of "BUG-class migrations surface pre-existing HTTP method mismatches" applies whether discovered at surface or mid-flow.

**Existing-test-file amendment convention (LOCKED v2.15, validated by CP8 RelationshipEngine.jsx): when amending a file with existing helpers and tests, append new helpers/tests to existing files rather than creating duplicate test files.** RelationshipEngine.jsx already had 11 helpers (presumably from earlier track work); CP8 appended +1 helper (`listRegistriesApi`) and +1 test rather than creating a duplicate test file. Relevant for files with existing test coverage from prior tracks (e.g., StoryEvaluationEngine.jsx, NarrativeIntelligence.jsx). Append-not-overwrite preserves existing coverage and avoids duplicate test file proliferation.

**Cross-CP duplication scaling note (NEW v2.15): v2.12 §9.11 file-local convention scales without coupling concerns at 11 cross-CP duplications in a single CP.** CP5 had 4 dups, CP6 had 2 dups, CP7 had 1 dup, CP8 had 11 dups across 5 files (~33 LOC). The test-isolation benefit dominates the LOC cost. WorldStateTensions duplicating 7 helpers from CP7 WorldDashboard is the largest single-file cross-CP duplication in F-AUTH-1; the file-local module block kept the migration mechanical. The convention's "duplicate locally rather than import" rule scales cleanly to high cross-CP density.

**Pattern composability note (NEW v2.15): locked patterns can stack within a single file without cross-contamination.** WorldFoundation.jsx in CP8 was the first file to apply three locked patterns simultaneously: multipart upload (v2.14) + method-branching split (v2.13) + idiom mix (4 sub-shapes within one file: async + thenable + multipart + method-branching). Migrated cleanly. Pattern composability was implicit in the convention library; CP8 explicitly validates the stacking. Future high-pattern-density files apply the same composability.

**Binary-response pattern (LOCKED v2.16, validated by CP9 — 1 site at StoryEngine.readStoryApi for ElevenLabs TTS audio): when a fetch site expects a binary response (audio, PDF, image), pass `{ responseType: 'blob' }` as the third argument to `apiClient.post` (or get/put/etc.).** axios returns the blob directly as response.data. Helper signature: `readStoryApi(payload) → apiClient.post(url, payload, { responseType: 'blob' })`. Pre-migration code's `await res.blob()` after fetch translates cleanly. Joins multipart upload (v2.14) as the second non-JSON apiClient interaction pattern. Future tracks adding binary-response sites follow the same pattern.

**Service-module internal-refactor pattern (LOCKED v2.16, validated by CP9 — services/showService.js): when a service module exposes the canonical accessor for an endpoint family, refactor each method's internals to use apiClient while preserving the service contract (method signatures + return shapes) unchanged for consumers.** Tests use `vi.mock` for apiClient and call service methods directly (e.g. `showService.getAllShows()`). Different from page-level helper extraction (which creates new module-scope helpers and updates call sites). Service-module refactor preserves the service's contract; only the internals change.

**Hook module-scope helper pattern (LOCKED v2.16, validated by CP9 — hooks/useGenerationJob.js): helpers exported from hook module-scope as `export const`; consumers of the hook unchanged.** Polling lifecycle preserved when applicable. Different from page/component shape; same Pattern D test approach via direct named imports. Joins the page (CP2-CP8) and service module (CP9 showService) shapes as a third structural class for helper extraction in F-AUTH-1.

**Service-module precedence inversion (NEW v2.16 note — observed at showService.js): when a service module is the canonical accessor for an endpoint family, file-local duplicates in earlier CPs are downstream copies of the service contract, not parallel copies.** showService.js is the canonical /shows accessor; CP2 SceneSetsTab + CP5 SeriesPage + CP7 (via listShowsApi) file-local duplicates exist downstream of this contract. v2.12 file-local convention still applies; this is a clarifying observation about precedence, not a new rule.

**URL composition preserved-verbatim discipline (NEW v2.16 — validated by CP9 WritingRhythm.jsx, second instance CP10 StoryDashboard.jsx): when surface-time analysis reveals an unusual URL composition pattern (e.g., empty API base, missing /api/v1/ prefix), preserve verbatim during migration. Don't fix. Don't investigate. Surface for Step 3 audit.** WritingRhythm and StoryDashboard both use `const API = import.meta.env.VITE_API_URL || ''` empty default + `${API}/...` = relative paths without /api/v1/ prefix. Migration preserved both compositions verbatim; apiClient.baseURL is also empty string. Pattern lock validated against 2 instances. Step 3 audit should adjudicate both observations together.

**Branching-split generalization (LOCKED v2.17, validated by CP10 StoryEvaluationEngine.jsx — URL-branching variant). v2.13 §9.11 method-branching split (PUT vs POST conditional, same URL) generalizes to any conditional shape at the call site — method, URL, or both.** Helper extraction handles each branch as a separate helper; call site does the ternary. Validated at CP6 TemplateDesigner (method-branching: `editId ? PUT : POST` with same URL → `createTemplateApi` + `updateTemplateApi`) and CP10 StoryEvaluationEngine line 1243 (URL-branching: `bookId ? GET /storyteller/books/:id : GET /storyteller/chapters` → `getBookApi` + `listAllChaptersApi`). Future tracks encountering branching at any axis follow the same convention.

**Structural-test-file amendment validation (LOCKED v2.17, validated by CP10 StoryEvaluationEngine.test.jsx). v2.15 §9.11 existing-test-file amendment scales to both behavioral test files (CP8 RelationshipEngine — first instance) and structural test files (CP10 StoryEvaluationEngine — first structural instance).** For structural tests (`fs.readFileSync` against source asserting on shape/imports), existing assertions remain valid post-migration when migration preserves apiClient import + absence of authHeaders + internal wrappers. vi.mock hoisting is required if dynamic imports are added in new describe blocks. CP10 StoryEvaluationEngine outcome: 16 tests in single file (6 Track 3 structural assertions all pass + 10 new CP10 helper tests) — first F-AUTH-1 multi-pattern existing-test-file amendment.

**Cross-CP existence high-water mark (NEW v2.17 note). `listRegistriesApi` reaches 6-fold cross-CP existence at CP10** (CP3 WriteMode + CP6 CharacterTherapy + CP7 Home + CP8 RelationshipEngine + CP8 StoryProposer + CP10 StoryEvaluationEngine). Empirical ceiling for cross-CP duplication density observed in F-AUTH-1. v2.12 file-local convention scales without coupling concerns up to and including 6-fold existence. Each duplicate is ~3 LOC; ~18 LOC total across all 6 files. Test isolation per file dominates the LOC cost.

**Pattern composability — second instance (NEW v2.17 note). CP6 WorldFoundation was first triple-pattern file (multipart upload + method-branching split + idiom mix). CP10 StoryEvaluationEngine is the second triple-pattern file (URL-branching split + existing-test-file amendment + 6-fold cross-CP duplication).** Pattern composability is now validated at 2 data points across diverse pattern combinations. Patterns compose cleanly within a single file without cross-contamination, regardless of which combination of locked patterns applies. The convention library is robust to high-pattern-density files.

**Mixed PUBLIC+BUG within single file (LOCKED v2.18, validated by CP11 PressPublisher.jsx — first F-AUTH-1 instance). When a single file contains a mix of LOCKED PUBLIC and BUG-class fetch sites, apply per-site adjudication during surface analysis.** LOCKED PUBLIC sites retain raw fetch with a 9-line PUBLIC comment block referencing inventory v2 §4.2 + F-Auth-3 degradeOnInfraFailure exemption list (parallel to BookEditor:55 / WriteMode:980 Pattern G locked-comment template, but for PUBLIC disposition rather than streaming). BUG-class sites in the same file migrate to apiClient with module-scope helpers per the standard Path A discipline. The file's test scaffolding includes a structural assertion that the LOCKED PUBLIC site's raw fetch is preserved post-migration. Validated against PressPublisher line 119 in CP11. Future tracks encountering mixed-disposition files (WorldSetupGuide deferred to CP15) follow the same convention.

**Combined-axis branching split — stacking validated (NEW v2.18 note, NOT a new convention). v2.13 §9.11 method-branching split + v2.17 §9.11 URL-branching generalize natively to combined axes — a single conditional may switch BOTH method AND URL simultaneously, handled by the existing convention without extension.** Validated at CP11 WorldLocations:141. Convention application: extract `updateLocationApi(id, payload)` + `createLocationApi(payload)` as separate helpers covering both branches; call site does single ternary (`editId ? updateLocationApi(...) : createLocationApi(...)`). No new lock language required; v2.18 documents this as "stacking validated".

**Pattern G default-on-matching-precedent discipline (LOCKED v2.19, validated by CP12 useStoryEngine:358). When a streaming-shape candidate is surfaced, default disposition is Pattern G lock if shape matches existing locked precedent. NodeFetch migration is a NEW policy decision distinct from Pattern G — requires explicit Evoni approval, not a default.** Surface report compares the candidate's shape against existing locked precedents (BookEditor:58 keepalive, WriteMode:1000/1191 streaming SSE, WriteModeAIWriter:281, AppAssistant:239). If match (POST + JSON.stringify body + res.body.getReader pattern, or keepalive: true), propose Pattern G lock as default. If genuine deviation, surface for policy discussion before committing. Validated at CP12 useStoryEngine.js:358 — shape matched WriteMode:1000/1191 + WriteModeAIWriter:281 exactly; Pattern G lock applied without policy escalation. Future tracks encountering streaming-shape candidates follow the same default-on-matching-precedent discipline.

**Pattern G line-number shift on comment insertion (NEW v2.19 note). The 9-line locked-comment block insertion shifts the locked-site line number downward by ~9-10 lines.** Surface report line numbers are pre-insertion approximations; final allowlist line numbers are post-insertion. Validated at CP12: surface predicted line 356 for Pattern G site; actual is line 358 post-migration. Not a problem; just observed mechanic. Verification-grep allowlist references the post-insertion line numbers throughout.

**Hook module-scope helper pattern — third validation (UPDATED v2.19, supersedes v2.16 single-instance lock). v2.16 §9.11 hook module-scope helper convention validated across three hooks of varying complexity:** CP9 useGenerationJob.js (5 sites, simple polling shape), CP11 usePageData.js (3 sites, mid-density), CP12 useStoryEngine.js (13 sites + 1 Pattern G, high-density 14-site dedicated CP). Convention scales unchanged. Helpers exported as `export const`; consumers of the hook unchanged; tests use direct named imports.

**Existing-test-file amendment — third validation (UPDATED v2.19, supersedes v2.17 dual-instance lock). v2.15 §9.11 existing-test-file amendment convention validated across three distinct test-file shapes:** CP8 RelationshipEngine (behavioral-only append), CP10 StoryEvaluationEngine (structural-with-behavioral-append, vi.mock hoisting required for dynamic imports), CP12 useStoryEngine (hook-with-helper-append + Pattern G structural tests). Three distinct test-file shapes; convention scales unchanged.

**Callback-cluster preservation pattern (NEW v2.19 observation, NOT a new convention). When a single callback contains multiple fetch sites with varied semantic roles (must-complete vs fire-and-forget vs conditional vs no-body-read), file-local helpers replace each fetch call site individually; surrounding Promise.all/Promise.allSettled/conditional wrappers stay verbatim; semantic preservation comes from the helper-replaces-fetch shape, not from explicit cluster orchestration.** Validated at CP12 handleApprove (6 sites in 156-line callback, 5 distinct semantic shapes). All 6 semantic invariants preserved without flattening. The convention library naturally handles callback clusters; no new lock language needed.

**Data-driven URL pass-through pattern (LOCKED v2.20 §9.11, validated execution at CP13 WorldAdmin:5550). When N variant URLs are dispatched via config-array.map (or other data-driven enumeration in source) AND method, payload shape, and headers are uniform across variants, a single pass-through helper is canonical.** Helper signature: `export const verbNounOpApi = (endpoint, payload) => api.post(endpoint, payload).then(r => r.data)`. Distinct from v2.17 URL-branching split, v2.13 method-branching split, and v2.18 combined-axis stacking. Structural conditions for applicability (ALL required): (1) method uniform across variants, (2) payload shape + headers uniform across variants, (3) variants enumerated in source as data (config array, lookup table, registry) — not as control flow, (4) URLs originate from inside the file (no external input — closes the SSRF surface). If any condition fails, fall back to v2.17 / v2.13 / v2.18 per shape. Helper naming: use a verb-noun-Op pattern (e.g., `bulkWardrobeOpApi`, not just `bulkOpApi`) — preserve domain context per Pattern F. Test parameterization via test.each (or describe.each) over the variants verifies dispatch correctness.

**Service-module precedence inversion — three-data-point validation (UPDATED v2.20, supersedes v2.16 single-instance lock). v2.16 §9.11 service-module precedence inversion convention validated across three data points:** CP9 showService.js (first instance), CP13 WorldAdmin:5563 wardrobeService.js + 7 component consumers (highest consumer count observed in F-AUTH-1), CP13 WorldAdmin:6088 wardrobeService.js line 39. Convention scales unbroken at 7-component-consumer density. v2.16 lock language stands without modification; v2.20 records the data points.

**Partial-migration extension pattern (NEW v2.20 §9.11 observation). When a file has pre-existing apiClient adoption (from independent earlier migration, not from a prior Track 6 CP), new helpers preserve the file-local idiom.** Validated at CP13: WorldAdmin had pre-existing `api.post()` at line 6306 (NOT in CP13 zone). CP13 extended with 11 new helpers all using the same `api` import. Test scaffolding uses `vi.mock('../services/api', () => ({ default: { ... } }))` consistent with file-local convention. Verification grep treats the file as partially-migrated rather than virgin.

**Outer try/catch cleanup observation (NEW v2.20 §9.11 note, NOT a new convention). When migrating from raw fetch with if(res.ok)/if(!res.ok) idioms to apiClient throws-on-non-2xx, an outer try/catch wrapping only the payload-construction-then-fetch block may become unmatched if the inner block was the only try consumer.** Resolution: remove the outer try since payload construction is pure JS that doesn't throw; inner try/catch on the network call handles all error paths. Validated at CP13 WorldAdmin:6582.

**Pattern G zero-trigger admin-page heuristic (NEW v2.20 §9.11 observation). Admin-page CPs default to zero Pattern G expectation; chat/AI-writer CPs default to high Pattern G expectation.** Two consecutive admin-page instances confirm: CP11 PressPublisher BUG-only sites, CP13 WorldAdmin. Streaming-shape candidates concentrate in chat/AI-writer files (all 6 Pattern G locked sites are in chat/AI-writer files). Heuristic, not lock — surface check still required per file regardless.

**Partial-migration extension pattern — graduates to two-data-point pattern (UPDATED v2.21, supersedes v2.20 single-instance observation). v2.20 §9.11 partial-migration extension was first instance at CP13 WorldAdmin. CP14 EpisodeDetail is second instance with the same shape:** file imports `api` from `../services/api`; has 1-2 pre-existing `api.post()` sites from independent earlier migration (not from prior Track 6 CP); BUG-class fetch sites are the migration zone. Pattern graduates to two-data-point pattern in v2.21. Discipline locked: when surface report encounters UNCLEAR-B file, partial-migration extension hypothesis is the default test. Adjudication takes ~30 seconds (read top-of-file imports + grep for `api.` calls + grep for raw `fetch` calls). New helpers preserve file-local idiom (NOT global `apiClient.` style). Validated at CP13 WorldAdmin (1 pre-existing apiClient site at line 6306) + CP14 EpisodeDetail (2 pre-existing apiClient sites at lines 776 + 805).

**Pattern G zero-trigger admin-page heuristic — graduates to three-data-point validation (UPDATED v2.21, supersedes v2.20 dual-instance observation). v2.20 §9.11 admin-page heuristic was first observed at CP11 PressPublisher BUG-only sites + CP13 WorldAdmin.** CP14 EpisodeDetail is third consecutive admin-page CP with zero Pattern G triggers. Heuristic graduates to three-data-point validation in v2.21. Validated across page-shape variations: PressPublisher (domain-content admin), WorldAdmin (show-management admin), EpisodeDetail (episode-management admin). Streaming-shape candidates remain concentrated in 5 chat/AI-writer files (all 6 Pattern G locked sites). Heuristic, not lock — surface check still required per file regardless.

**Helper-reuse density forecasting heuristic (NEW v2.21 §9.11 observation, NOT a new convention). When surface analysis identifies CRUD + reload-after-mutation cluster pattern (single resource family with mount + create + update + delete + reload-after-each-mutation), helper count is 30-40% lower than site count.** The loader gets called once at mount + once after each mutation = N+1 invocations from M+1 distinct call sites where M is the mutation count. Validated at CP14 EpisodeDetail (40% reduction; 6 helpers / 10 sites — 4× reuse on `listEpisodeLibraryScenesApi` across mount + 3 reload-after-mutation paths; 2× reuse on `reorderEpisodeLibrarySceneApi` in single Promise.all parallel-execution wrapper). Forecasting heuristic, NOT a new convention — file-local helper convention v2.12 already handles helper reuse natively. Surface analysis discipline: when CRUD + reload pattern detected, session-time-per-site forecast can be reduced ~30% from CP3-zone baseline; helper-count forecast reduced 30-40% from site count.

**Pattern G — "can't-migrate-to-axios" exception class:** When a fetch site uses an underlying HTTP feature that axios does not support in browsers (response-body streaming via SSE, `keepalive: true`, or other browser-only features), the site cannot migrate to apiClient without breaking functionality. These sites are retained as raw `fetch()` calls with inline auth header injection from localStorage, structurally identical to Path D (inline Bearer construction). Pattern G is the locked-exception class for these cases.

Implementation pattern (3 known sites today):

- Keep raw `fetch()` call (do NOT migrate to apiClient).
- Inject inline auth header: `const token = localStorage.getItem('authToken') || localStorage.getItem('token');` then `...(token ? { Authorization: \`Bearer ${token}\` } : {})` inside the headers object.
- Add a 6-9 line documenting comment immediately above the fetch call. Comment must explain: (a) what underlying HTTP feature is being used, (b) why axios does not support it, (c) the inline-auth approach, (d) reference to fix plan v2.10 §4.6 + §9.11 Pattern G.
- Allowlist the file:line in the verification grep. Future contributors see the comment, do not "fix" by attempting apiClient migration.

Three known Pattern G sites (all locked, all documented):

- `frontend/src/components/BookEditor.jsx:55` — `keepalive: true` for beforeunload draft save (CZ-5 contract). Locked in v2.5; line corrected to `:55` in v2.7.
- `frontend/src/pages/WriteMode.jsx:980` — SSE streaming for voice-to-story Claude AI generation. Locked in v2.10 from CP3 commit `b0127817`.
- `frontend/src/pages/WriteMode.jsx:1145` — SSE streaming for story-continue Claude AI generation in handleContinue. Locked in v2.10 from CP3 commit `b0127817`.

Threshold for revisiting Pattern G: if Track 6 long-tail or future feature work surfaces 4+ Pattern G sites, evaluate adding a streaming-fetch helper to apiClient (a Track 1 amendment that would handle auth injection + response-body access without requiring inline construction). Today's 3 sites do not justify the scope; they are documented as locked exceptions instead.

### 9.12 Deferred cleanups (post-F-AUTH-1)

Note: the outer try/catch entry that was deferred in v1.6/v1.7 was **cleaned up during Step 2 implementation** (commit `e80c711d`). The defense-in-depth shell was hiding bugs (synchronous throws in console calls, `req.headers` access edge cases) that the new three-case structure handles explicitly. Removed entry from this list as resolved.

**F34 status: CLOSED at the call site** (Track 6 CP4 commit `11a82876`). Server-side enforcement closes via Step 3 backend sweep on `franchiseBrainRoutes.js` (`optionalAuth → requireAuth` swap on all 10 mutation routes). Both halves required for full F34 closure: frontend now sends auth on every `/franchise-brain/*` mutation; backend will reject unauth attempts post-Step-3. Audit handoff v8 Decision #34 honored: F34 closes inside this PR's scope, not as a separate hotfix.

- Real metrics library — Step 2 ships with structured-log-derived metrics. If Prime Studios adds prom-client / opentelemetry / similar later, the F-Auth-3 call site is one line and trivially swappable.
- `console.debug` enablement — current ESLint config blocks it; Step 2 uses `console.log` as the quietest allowed level. If the project later wires up the `debug` package or adjusts ESLint, the F-Auth-3 quiet-log call site can move to `console.debug`.
- **`authService.refreshToken()` duplication** (surfaced in Track 1 §3.4) — `frontend/src/services/authService.js:125–147` has a `refreshToken()` method that nearly duplicates the new bare-axios `refreshAccessToken` helper in `src/services/api.js`. Track 1 kept them separate to avoid circular auth (authService imports api). Cleanup candidate when authService is touched in a Track 6 file: migrate `authService.refreshToken()` callers (login flow primarily) to use the bare-axios helper, then delete the apiClient-based duplicate.
- **Parallel-request refresh storm** (surfaced in Track 1 §3.7) — N simultaneous `AUTH_INVALID_TOKEN` responses trigger N parallel refresh calls. Backend rate-limiter (10/min) keeps it from being catastrophic but it is wasteful. Optimal solution: refresh-promise singleton — first request starts refresh, others await the same promise. Real complexity for marginal gain; deferred until evidence of operational impact.
- **ESLint v9 migration** — `.eslintrc.js` is the v8 format and ESLint v9 (installed) does not auto-detect it. Frontend lint has been broken for some time. Out of F-AUTH-1 scope; separate config-modernization PR.
- **Refresh-via-cookie hardening** — login endpoint sets a refreshToken httpOnly cookie (`src/routes/auth.js:75`), but the refresh endpoint at `:112` reads from request body only, ignoring the cookie. The Track 1 helper passes from localStorage (matching the body path). Cookie-based refresh would be a hardening follow-up; out of F-AUTH-1 scope.
- **npm audit follow-up** — Track 1.5 install reported 24 vulnerabilities (3 low, 13 moderate, 7 high, 1 critical) in the existing frontend dep tree. None new from jsdom; ambient state of the codebase pre-F-AUTH-1. Run `npm audit fix` and review the manual cases after F-AUTH-1 ships.

**Path E candidates surfaced during Tracks 3 and 4 (~37 sites across 8 files) — reclassify during Step 3 sweep:**

From Track 3 (4 sites, 3 files):

- `frontend/src/hooks/useStoryEngine.js:527` — POST to `/api/v1/memories/extract-story-memories` with no auth header. Inline `headers: { 'Content-Type': 'application/json' }` only.
- `frontend/src/pages/RelationshipEngine.jsx:111` — bare `fetch(url)` GET `/api/v1/character-registry/registries` with no auth at all.
- `frontend/src/pages/SocialProfileGenerator.jsx:1213, 1229` — bare `fetch` to `/api/v1/world/<showId>/events` and `/api/v1/world/<showId>/events/from-profile` with no auth helper.

From Track 4 (~33 additional sites):

- `frontend/src/components/FeedBulkImport.jsx:164` — GET `/bulk/jobs` with no auth. `:197` — parseCsv POST has Content-Type only, no auth.
- `frontend/src/pages/WorldStudio.jsx` — ~29 unauth fetches across multiple sites (lines 231, 248, 259, 271, 714, 722, 744, and others) hitting `/character-depth`, `/world/*`, `/api/v1/character-registry/registries`. Most likely intentional PUBLIC reads (world data is presumably visible to non-authenticated users) but Step 3 must classify each backend route.
- `frontend/src/pages/StoryReviewPanel.jsx` — 3 fetch sites besides the migrated Path D site need Path E spot-check during Step 3 sweep.
- `frontend/src/components/AuditLogViewer.jsx` — mockLogs fallback. *Intentional dev-mode fallback, not a bug*. No action needed.

Disposition pattern (unchanged from v2.6): each is either intentionally PUBLIC (backend route serves unauth-safe data) or a BUG (backend route requires auth and the frontend silently sends none). Step 3 sweep classifies each backend route as PUBLIC or requireAuth; Path E sites whose backend is PUBLIC stay as raw fetch (correct), Path E sites whose backend is requireAuth get migrated to apiClient (Track 6-equivalent fix). No action until Step 3 reaches the corresponding routes. The WorldStudio.jsx cluster (29 sites) is the largest and warrants priority attention during Step 3 sweep — if the backend routes are PUBLIC, no work; if any are requireAuth, that one file becomes a meaningful Track-6-equivalent surface.

**Path E running list growth from CP4: FranchiseBrain.jsx GET sites (8 total) filed for Step 3 sweep awareness.** CP4 migration applied apiClient (auth-required disposition) under the read that LalaVerse internal knowledge — laws, characters, locked decisions — is canonical-knowledge-class. Step 3 backend audit on `franchiseBrainRoutes.js` will adjudicate per-route disposition; if any GET is classified PUBLIC, that specific call site can be reverted in a follow-up commit.

- `GET /franchise-brain/entries` with query-string filters (×6 sites: load, loadCounts ×4, loadSourceCounts)
- `GET /franchise-brain/documents` (loadBrainDocs)
- `GET /franchise-brain/amber-activity` (loadAmberActivity)

**Path E running list growth from CP5: ~10 GET sites across three mid-tier files filed for Step 3 sweep awareness.** CP5 migration applied apiClient (auth-required disposition default) under the read that per-user storyteller / episode / universe data is auth-required. Step 3 backend audit will adjudicate per-route disposition; if any GET is classified PUBLIC, that specific call site can be reverted in a follow-up commit.

- StoryThreadTracker (6 GETs): `/storyteller/threads`, `/storyteller/threads/dangling`, `/storyteller/memories/pending`, `/storyteller/continuity/issues`, `/storyteller/voice-signals`, `/storyteller/voice-rules`
- EpisodeScenesTab (3 GETs): `/episodes/:id/scene-sets`, `/episodes/:id/scenes`, `/scene-sets`
- SeriesPage (3 GETs): `/universe/series`, `/storyteller/books`, `/shows` — the `/shows` GET is consistent with CP2's migration disposition (already auth-required).

**Path E running list growth from CP6: ~13 GET sites across four mid-tier-batch-2 files filed for Step 3 sweep awareness.** Distribution: 1 in CharacterGenerator, 4 in CharacterTherapy, 3 in ContinuityEnginePage, 5 in TemplateDesigner. CP6 migration applied apiClient (auth-required disposition default) under the read that per-user character / continuity / template data is auth-required. Step 3 backend audit will adjudicate per-route disposition.

- CharacterGenerator (1 GET): `/character-generator/ecosystem`
- CharacterTherapy (4 GETs): `/character-registry/registries`, `/character-registry/registries/:id`, `/therapy/waiting`, `/therapy/profile/:charId`
- ContinuityEnginePage (3 GETs): `/continuity/timelines`, `/continuity/timelines/:id`, `/continuity/timelines/:id/conflicts`
- TemplateDesigner (5 GETs): `/episodes`, `/episodes/:id/assets`, `/template-studio/:id`, `/compositions/:id`, `/thumbnail-templates/:id`

**Path E running list growth from CP7: ~12 GET sites across ten long-tail batch 1 files filed for Step 3 sweep awareness.** Distribution: CFO cluster (5: `/cfo/quick`, `/cfo/scheduler`, `/cfo/audit`, `/cfo/agent/:name`, `/cfo/history`); AI usage cluster (6: `/ai-usage/summary`, `/ai-usage/by-model`, `/ai-usage/by-route`, `/ai-usage/daily`, `/ai-usage/optimizations`, `/ai-usage/recent`); world state cluster (3: `/world/state/snapshots`, `/world/state/timeline`, `/world/tension-scanner`); amber diagnostic (2: `/amber/diagnostic/findings`, `/amber/diagnostic/queue`); episode todo (2: `/episodes/:id/todo`, `/episodes/:id/todo/social`); story health (2: `/story-health/dashboard`, `/story-health/search`); session brief (1: `/session/brief`); character registry (1: `/character-registry/registries` — already filed by CP3+CP6; same disposition expected). CP7 migration applied apiClient (auth-required disposition default). Step 3 backend audit will adjudicate per-route disposition.

**Path E running list growth from CP8: ~13 NEW GET sites filed for Step 3 sweep awareness (3 already filed by CP7 deduplicated).** Distribution: arc-tracking (1: `/arc-tracking/:key`); narrative pipeline (1: `/tier/pipeline`); world scenes (3: `/world/characters`, `/world/scenes`, `/world/tension-check`); stories character (3: `/stories/character/:char`, `/stories/assemblies/character/:char`, `/stories/social/character/:char`); world locations (3: `/world/locations`, `/world/map`, `/social-profiles/analytics/composition`); memories growth (1: `/memories/character-growth/flagged`); character-registry: `/character-registry/registries` — already filed by CP3+CP6+CP7. CP8 migration applied apiClient (auth-required disposition default). Step 3 backend audit will adjudicate per-route disposition.

**Path E running list growth from CP9: ~10 NEW GET sites filed for Step 3 sweep awareness (some dedup-noted from CP2/CP5/CP8).** Distribution: texture-layer (2: `/texture-layer/:char/:story` load + refetch); social character (1: `/stories/social/character/:char` — already CP8); story-health + memories (3: `/story-health/therapy-suggestions/:char`, `/memories/eval-stories/:id`, `/story-health/threads-for-story/:num`); character-registry-by-id (3: `/character-registry/characters/:id`, `/character-registry/characters/:id/relationships`, `/entanglements/character/:id`, `/social-profiles/:id`); writing-rhythm (2: `/writing-rhythm/stats`, `/multi-product/all`); world characters by book (1: `/world/characters?book_id=:id`); memory-job-status (3: `/memories/pipeline-generate-status/:jobId`, `/memories/batch-generate-status/:jobId`, `/memories/batch-generate-story/:jobId/:num`); shows (2: `/shows`, `/shows/:id` — already CP2/CP5). CP9 migration applied apiClient (auth-required disposition default). Step 3 backend audit will adjudicate per-route disposition.

**WritingRhythm URL composition observation (NEW v2.16 — separate from Path E; UPDATED v2.17 to note second instance):** WritingRhythm.jsx (CP9) and StoryDashboard.jsx (CP10) both use `const API = import.meta.env.VITE_API_URL || ''` empty default; URLs compose to relative paths without /api/v1/ prefix. apiClient.baseURL is also empty string. CP9 + CP10 migrations preserved both compositions verbatim per v2.16 §9.11 URL composition preserved-verbatim discipline. **Step 3 audit should investigate whether the relative-path resolution is intentional (Vite proxy config, server-side rewrite, /api/v1 fall-through) or a pre-existing routing bug. Both files should be adjudicated together (likely the same resolution applies).**

**Path E running list growth from CP10: ~10 NEW GET sites filed for Step 3 sweep awareness (many dedup-noted from CP3+/CP5/CP6/CP8).** Distribution: world (1: `/world/context-summary` new); character-registry-by-id (2: `/character-registry/characters/scene-context/:char` new, `/character-registry/:registryId/characters` new); storyteller chapters (1: `/storyteller/chapters` new — variable-URL no-bookId branch); scene-proposals + reviews (2: `/memories/scene-proposals?:qs` new, `/reviews/unacknowledged` new); template-studio (1: `/template-studio?:params` new); compositions (1: `/compositions/:id/outputs` new); character-depth (1: `/character-depth/:id` new); universe (2: `/universe/series` new no-query variant, `/universe/:id` new). Already filed: `/character-registry/registries` (CP3+CP6+CP7+CP8 — now CP10 6-fold), `/storyteller/books` (CP5), `/memories/character-growth/flagged` (CP8), `/compositions/:id` (CP6), `/shows` (CP2/CP5/CP7/CP9). CP10 migration applied apiClient (auth-required disposition default). Step 3 backend audit will adjudicate per-route disposition.

**Path E running list growth from CP11: ~14 NEW GET sites filed for Step 3 sweep awareness (many dedup-noted from prior CPs).** Fresh CP11 first-time candidates: `/properties` (PropertyManager), `/recycle-bin` (RecycleBin), `/storyteller/calendar/events` + `/storyteller/calendar/markers` (StoryCalendar — storyteller-scoped, distinct from /calendar/* per CP11 surface-correction), `/site-organizer/quick` + `/scan` + `/agent/:name` (SiteOrganizer — admin-tooling, may be intentionally PUBLIC), `/world/:show/episodes/:ep/distribution` (EpisodeDistributionTab), `/page-content/:name` (usePageData hook). Dedup-noted: `/character-registry/characters/:id` + `…/relationships` (CP9 — CharacterProfile re-files), `/social-profiles/:id` (CP9 — re-files), `/compositions/:id` (CP6 — LayoutEditor re-files), `/stories/character/:char` (CP9 — StoryReviewPanel re-files), `/shows` (CP2/CP5/CP7/CP9/CP10 — now 5-fold via CultureEvents). CP11 migration applied apiClient (auth-required disposition default). Step 3 backend audit will adjudicate per-route disposition.

**URL-string-shape disambiguation note (NEW v2.18 §9.12 — CP11 surface-correction). Surface analysis must inspect API base composition, not just URL fragments.** CP11 surface initially flagged StoryCalendar's `${API}/calendar/events` as a CP10 CulturalCalendar duplicate based on URL-string shape similarity. Migration revealed StoryCalendar imports `API` from a constants module where `API = '/api/v1/storyteller'`; full URL resolves to `/api/v1/storyteller/calendar/events`, distinct from CP10's global `/api/v1/calendar/events`. Helpers were FRESH, not duplicates. Discipline: at surface time, read the import statement for the API base constant; resolve the full URL; only then decide if a cross-CP duplicate exists. CP11 caught this mid-flow; future surface reports should catch it before lock.

**CP12 Path E dedup outcome (NEW v2.19 §9.12). `/memories/extract-story-memories` POST was already filed in v2.18 §9.12 from Track 3 surface (long before CP12). CP12 migration applied apiClient at this site (auth-required default) — site is now covered by `extractStoryMemoriesApi` helper in useStoryEngine.js.** Dedup-noted from Track 3 filing; same disposition expected. Step 3 backend audit will adjudicate per-route disposition. No new Path E candidates from CP12 (all 14 sites have either unique paths covered by 12 fresh helpers OR are covered by the Track 3 prior filing; the 1 cross-CP duplicate `listStoriesForCharacterApi` was already filed via CP9/CP11).

**Path E running list growth from CP13 (NEW v2.20 §9.12). ~4 NEW GET sites filed for Step 3 sweep awareness (3 dedup-noted from prior CPs).** Fresh CP13 first-time candidate: `/wardrobe/:id/usage` GET (WorldAdmin getWardrobeUsageApi). Dedup-noted from prior CPs: `/episodes/:id/todo/social` GET (CP9 EpisodeTodoPage — now CP9+CP13 2-fold), `/world/:show/events` GET (service-module precedence inversion — multiple downstream component consumers, no single CP origin), `/shows/:show/wardrobe` GET (wardrobeService.js + 7 component consumers — service-module precedence inversion). CP13 migration applied apiClient (auth-required disposition default). Step 3 backend audit will adjudicate per-route disposition.

**Path E running list growth from CP14 (NEW v2.21 §9.12). ~3 NEW GET sites filed for Step 3 sweep awareness (1 dedup-noted from prior CPs).** Fresh CP14 first-time candidates: `/episodes/:id/library-scenes` GET (EpisodeDetail listEpisodeLibraryScenesApi — 4× call-site reuse), `/characters/:char/state` GET (EpisodeDetail getCharacterStateApi). Dedup-noted from prior CPs: `/world/:show/events` GET (CP13 WorldAdmin file-local capture — now CP13+CP14 2-fold cross-CP existence). CP14 migration applied apiClient (auth-required disposition default). Step 3 backend audit will adjudicate per-route disposition.

**HTTP method mismatch tally as of CP14 (UPDATED v2.21). CP14 is the 13th consecutive CP with zero method mismatches (CP3-CP14 cumulative).** Total method-correction discoveries remain at **5 across 14 CPs**: 3 from CP2 mid-flow (`setCoverAngleApi` GET → PATCH, `reorderAnglesApi` POST → PATCH, `getAiCameraDirectionApi` GET → POST), 1 from CP7 surface (`CFOAgent setBudget` POST → PUT), 1 from CP9 surface verification. Pattern remains: file-level variation, not systemic.

**HTTP method mismatches surfaced during Track 6 CP2 (3 sites in SceneSetsTab.jsx) — Step 3 sweep awareness items:**

- `setCoverAngleApi` — backend route is PATCH; frontend was using GET. Migration uses correct PATCH per backend contract. Step 3 should verify the backend route's expected method matches what other consumers (if any) send.
- `reorderAnglesApi` — backend route is PATCH; frontend was using POST. Migration uses correct PATCH.
- `getAiCameraDirectionApi` — backend route is POST; frontend was using GET. Migration uses correct POST.

These are pre-existing wrong-method sites that were either tolerated by the backend (e.g., Express router accepting both methods, or the backend's body-parser silently doing the right thing on POST-with-no-body) or never hit execution in the path the frontend was reaching. Migration to apiClient documents and uses the correct method. The original wrong methods have been shipping; verifying via Step 3 sweep that no other callers depend on the wrong method behavior is sound discipline. Surface, do not fix the original — apiClient migration is itself the fix at the call site.

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

**Rule 6 — Auto-merge pipeline documented (added v2.4).**

Prime Studios runs an automation pipeline that integrates implementation work into `dev` continuously. Future Claude Code sessions need to understand this so backup-branch advancement and dev's `docs/audit/` state are not mistaken for discipline slips. The pipeline has four parallel writers:

- **Implementation track** (this writer): commits to `feature/f-auth-1`, force-pushes to `claude/f-auth-1-backup` after each track approval per Rule 2.
- **Auto-merge track** (automation): commits like `Auto-merge claude/f-auth-1-backup into dev` fire on every backup-branch push, replaying implementation commits onto `dev`.
- **Fix-plan revision track** (integrator, TySteamTest): commits like `docs(audit): F-AUTH-1 fix plan vX.Y` go directly to `dev` after each fix-plan version locks. These flow to `main` via standard PR.
- **Main-sync track** (integrator): periodic `Merge origin/main into claude/f-auth-1-backup` commits keep backup's docs view consistent with main's preserved version history. Touches only `docs/audit/` files; no implementation conflict.

Implications for the implementation writer (this session):

- Force-pushing backup overwrites the integrator's main-sync merge commits. This is safe because the docs they brought in already exist on main and (via the auto-merge chain) on dev. No data loss.
- Dev's `docs/audit/` directory is the union of: dev-tip cleanup state + main's preserved version history (via merge chain). When v1.5 or v2.2 reappear in `git ls-tree origin/dev` it is the merge chain working as designed, not a regression. Each individual fix-plan revision commit on dev still does its `git rm` of the prior version (cleanup discipline at the commit level); the merges from main re-introduce older versions as historical record.
- Rule 1 (one writer at a time) still holds for implementation work on `feature/f-auth-1`. The auto-merge / main-sync / fix-plan-revision writers operate on different branches or different paths and do not conflict with implementation commits. If a future session is uncertain whether something is "another writer touching my work" vs "the pipeline doing its thing," check whether the surprising commit touched any implementation file (`frontend/src/`, `src/middleware/`, `tests/`). If only `docs/audit/` files are touched, it is the pipeline.
- When in doubt, run `git log <branch> --oneline` and look for the four commit-message patterns above. They identify the writer and confirm the work is benign.

#### Why this is in the canon document

The audit principle from v8 §0 holds: **the audit trail is the audit trail.** Future Claude Code sessions reading this fix plan will see the lost-work incident and the discipline that followed it. Future sessions will be less likely to repeat the same failure mode because they read about it before starting work. This is operational learning made durable — exactly the use case "documentation as a living system" exists for.

The Rule 6 addition (v2.4) is a second instance of this principle. The auto-merge pipeline was not visible to this session's author until commit `a8877a19` surfaced as backup-branch advancement; without diagnostics we could have mistaken it for a session-coordination failure and force-overwritten benign integrator work. Documenting the pipeline now means future sessions read v2.4 and understand the data flow before they have to diagnose it.

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
