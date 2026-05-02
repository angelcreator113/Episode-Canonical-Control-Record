# F-AUTH-1 Pre-flight Report

**Status:** Pre-flight executed. **GATE G1 — NOT YET PASSED.** Awaiting user
sign-off on drift findings, exemption list, and the open scope decisions
listed in §11.

**Date:** 2026-05-02
**Branch:** `claude/prime-studios-setup-h7x21` (see §12 — branch may need
re-targeting)
**Scope:** Read-only inventory only. No fix code written.
**Corresponds to:** §5.1 of `F-AUTH-1_Fix_Plan_v1.3.docx`, Gate G1 of §6.

---

## §0. CRITICAL BLOCKER — Source-of-truth documents missing

Both reference documents named in the task brief are **not present on the
filesystem**:

| Document | Expected path | Found? |
| --- | --- | --- |
| `Prime_Studios_Audit_Handoff_v8.docx` | `docs/audit/` | ❌ no |
| `F-AUTH-1_Fix_Plan_v1.3.docx` | `docs/audit/` | ❌ no |

Searches performed: `find / -maxdepth 8 -iname "Prime_Studios_Audit*" -o -iname
"F-AUTH-1*"` — zero hits outside `node_modules/mammoth` test fixtures. The
`docs/audit/` directory did not exist; this report created it.

**Implications for this report:**

- Items (b) (c) (d) (e) (f) (h) are mechanical; executed and reported as-is.
- Item (a) **drift detection** is reported by inspecting the codebase at the
  v8-cited file:line references and comparing against what the prompt
  summarises. If v8 contains additional context I cannot see (e.g.,
  expected code shapes, severity classifications), I cannot reconcile.
- Item (g) **exemption list** is built from scratch by inspection of the
  codebase. If v8 already pre-tagged exemptions, my list may disagree
  silently — please reconcile against v8 before locking.
- The F-Auth-2 / F-Auth-4 Path 1 / F-Auth-5 contract details I rely on are
  the prompt's summary, not the plan itself. **Surface any divergence.**

**Action requested:** Drop both `.docx` files into `docs/audit/` (or paste
the relevant sections inline) before locking the exemption list and
proceeding to Step 6a.

---

## §1. Spot-check — v8 file:line references (item a)

### 1.1 `src/middleware/auth.js`

| v8 reference | Current location | Status |
| --- | --- | --- |
| `:13–22` Cognito verifier creation | `:12–23` (idTokenVerifier 12–16, accessTokenVerifier 18–23) | **MINOR DRIFT (±1 line on each end).** Content matches: two `CognitoJwtVerifier.create()` calls with `userPoolId` / `clientId` from env, both falling back to placeholder strings (`'us-east-1_XXXXXXXXX'` / `'xxxxxxxxxxxxxxxxxxxxxxxxxx'`). |
| `:44–46` `if (!userPoolId) throw…` | `:42–46` | **EXACT MATCH.** Inside `verifyToken`. Note: this is the runtime check that backstops the placeholder fallback. |
| `:164–168` optionalAuth swallow | `:164–168` | **EXACT MATCH.** `console.warn('Optional auth token invalid:', error.message); req.user = null;` |
| `:256–293` `requireAuth` | `:256–293` | **EXACT MATCH.** Implementation present, exported on line 256. Returns `code: 'AUTH_REQUIRED'` on every failure path (matches frontend contract — see §6). |

**Notable additional finding:** `src/middleware/auth.js:250–255` contains an
explanatory comment block describing the `requireAuth` ↔ frontend interceptor
contract (the soft-fail vs hard-fail distinction). This comment is not
referenced by v8 in the prompt summary but reads as the canonical statement
of the contract Step 6b reconciles against.

### 1.2 `app.js:364`

- Root `app.js` is a 39-byte stub: `module.exports = require('./src/app');`.
  v8's "app.js:364" therefore must mean `src/app.js:364`.
- `src/app.js:364` currently reads `legacyHeaders: false,` — it is inside
  the `writeLimiter` rate-limit config (lines 360–366), unrelated to auth.
- The two `optionalAuth` references in `src/app.js` are at:
  - `:326` — `const { optionalAuth } = require('./middleware/auth');`
  - `:330` — `app.use(optionalAuth);` (the global gate)
- **DRIFT (significant):** v8's `app.js:364` does not point at any
  optionalAuth surface today. If v8 meant the global gate, the line moved
  from somewhere ≥364 to `:330` (≥34 lines up). If v8 meant something else
  at `:364`, I can't confirm without v8.
- **Action:** confirm what v8 cited at `app.js:364`. If it was the global
  `app.use(optionalAuth)`, the new location is `src/app.js:330`.

### 1.3 `src/routes/episodeOrchestrationRoute.js`

| v8 reference | Current location | Status |
| --- | --- | --- |
| `:135` route handler | `:131` `router.post('/generate-episode-orchestration', optionalAuth, async (req, res) => {` | **MINOR DRIFT (−4 lines).** Same handler. |
| `:220` write | `:216–225` (UPDATE statement; line 220 lands on `replacements: {`) | **EFFECTIVELY EXACT.** The UPDATE block exists in the same place; v8's `:220` lands inside the write block. The `episode_id` save is gated only by `if (episode_id && db.Episode)` — no `req.user` check. |

---

## §2. Sub-form (b) — master grep: `optionalAuth` surfaces

**Command:**

```bash
grep -rn "optionalAuth" src/routes/ src/app.js src/middleware/ | sort
```

**Totals:**

- **1059 matches** across **98 distinct files** in `src/routes/` plus
  `src/app.js` and `src/middleware/auth.js`.
- Full output saved at `/tmp/preflight_b.txt` during execution. Reproduce
  with the command above (output is too large to inline here in full;
  per-file totals in §4).

**Top-level summary:**

- `src/app.js:326` — import of `optionalAuth`
- `src/app.js:330` — global `app.use(optionalAuth)` (the keystone surface)
- `src/middleware/auth.js:134` — definition (`const optionalAuth = …`)
- `src/middleware/auth.js:249` — module export
- `src/routes/*.js` — 98 route files contain at least one explicit
  `optionalAuth` reference (import or per-route attachment)

**Distinct route files containing `optionalAuth`:**

```
amberDiagnosticRoutes.js, amberSessionRoutes.js, arcRoutes.js,
arcTrackingRoutes.js, assets.js, authorNoteRoutes.js, calendarRoutes.js,
careerGoals.js, characterAI.js, characterCrossingRoutes.js,
characterDepthRoutes.js, characterFollowRoutes.js,
characterGenerationRoutes.js, characterGenerator.js, characterGrowthRoute.js,
characterRegistry.js, characterSparkRoute.js, consciousness.js,
cursorPaths.js, decisionAnalytics.js, decisionLogs.js, editMaps.js,
entanglementRoutes.js, episodeBriefRoutes.js, episodeOrchestrationRoute.js,
episodeScriptWriterRoutes.js, episodes.js, evaluation.js,
eventGeneratorRoute.js, export.js, feedEnhancedRoutes.js,
feedPipelineRoutes.js, feedPostRoutes.js, feedRelationshipRoutes.js,
feedSchedulerRoutes.js, franchiseBrainRoutes.js, gameShows.js,
generate-script-from-book.js, hairLibraryRoutes.js, iconCues.js,
iconSlots.js, imageProcessing.js, lala-scene-detection.js, lalaScripts.js,
layers.js, luxuryFilterRoutes.js, makeupLibraryRoutes.js,
manuscript-export.js, memories/{assistant,core,engine,extras,interview,
planning,stories,voice}.js, mirrorFieldRoutes.js, musicCues.js,
novelIntelligenceRoutes.js, onboarding.js, opportunityRoutes.js,
pageContent.js, pdfIngestRoute.js, phoneAIRoutes.js, phoneMissionRoutes.js,
press.js, productionPackage.js, relationships.js, sceneProposeRoute.js,
sceneSetRoutes.js, sceneStudioEpisodeRoutes.js, scenes.js,
scriptGenerator.js, scriptParse.js, seasonRhythmRoutes.js,
socialProfileBulkRoutes.js, socialProfileRoutes.js, stories.js,
storyEvaluationRoutes.js, storyHealth.js, storyteller.js, therapy.js,
tierFeatures.js, todoListRoutes.js, uiOverlayRoutes.js,
undergroundRoutes.js, universe.js, upgradeRoutes.js, wantFieldRoutes.js,
wardrobe.js, wardrobeBrands.js, wardrobeEventRoutes.js, wardrobeLibrary.js,
world.js, worldEvents.js, worldStudio.js, worldTemperatureRoutes.js,
youtube.js
```

**Pre-existing `requireAuth` usage (drift-relevant):**

`requireAuth` already exists in `src/middleware/auth.js:256–293` and is
already used in production by:

- `src/routes/episodes.js` — import `:14`, usage `:876`, `:1115`
- `src/routes/episodeBriefRoutes.js` — import `:10`, usage `:91`, `:202`,
  `:245`
- `src/routes/characterRegistry.js` — defensive lazy import `:13–20`,
  usage `:1896`
- `src/routes/worldEvents.js` — defensive lazy import `:24–31`, usage
  `:762`, `:1793`

These four files demonstrate that the contract is already wired and live;
F-Auth-1 is *expanding* `requireAuth` adoption, not introducing it. The
defensive lazy-import pattern (try/catch around `require('../middleware/
auth')`, falling back to a no-op middleware) appears here and in `press.js`
/ `manuscript-export.js` for `optionalAuth` — flag for the sweep
(see §11.3).

---

## §3. Sub-form (b sub-form) — files in `src/routes/` with no auth import (item c)

**Command:**

```bash
for f in src/routes/*.js; do
  grep -l "require.*middleware/auth" "$f" >/dev/null || echo "NO AUTH IMPORT: $f"
done
```

**30 files, no `require('../middleware/auth')` import:**

```
aiUsageRoutes.js
animatic.js
arcTrackingRoutes.js
audio-clips.js
auth.js
beats.js
cfoAgentRoutes.js
character-clips.js
characters.js
compositions.js
continuityEngine.js
decisions.js
designAgentRoutes.js
footage.js
markers.js
outfitSets.js
propertyRoutes.js
queue-monitor.js
roles.js
sceneLinks.js
sceneTemplates.js
scriptAnalysis.js
seed.js
session.js
shows.js
siteOrganizerRoutes.js
templateStudio.js
textureLayerRoutes.js
thumbnailTemplates.js
timelineData.js
```

**Interpretation:** All 30 files are mounted under the global
`app.use(optionalAuth)` at `src/app.js:330`, so they receive `req.user`
gating implicitly. They have no per-route auth gate. This is the silent
attack surface F-Auth-1 must address — these files will not be touched by
a "swap optionalAuth → requireAuth" string replacement, because they
contain no string `optionalAuth` to swap.

`auth.js` (route file) is in this list — that's the Cognito sign-in route
itself, which is correctly auth-less by definition.

**`arcTrackingRoutes.js` appears in this list AND in the §2 list of files
containing `optionalAuth`** — meaning it references the symbol but does
not import it. Likely a bug; worth grepping.

```bash
grep -n "optionalAuth\|require.*auth" src/routes/arcTrackingRoutes.js
```

(Not run as part of pre-flight — flagged for follow-up.)

---

## §4. Sub-form (c) — explicit `optionalAuth` on mutation routes (item d)

**Command:**

```bash
grep -rnE "router\.(post|put|patch|delete).*optionalAuth" src/routes/
```

**Totals:**

- **516 mutation routes** (POST/PUT/PATCH/DELETE) currently attached to
  `optionalAuth` across **75 distinct route files**.
- Verb breakdown: `POST 384`, `PUT 60`, `DELETE 49`, `PATCH 23`.

**Top files by mutation-on-optionalAuth count (≥10):**

| File | Count |
| --- | --- |
| `sceneSetRoutes.js` | 51 |
| `worldEvents.js` | 37 |
| `worldStudio.js` | 35 |
| `tierFeatures.js` | 24 |
| `storyteller.js` | 24 |
| `socialProfileRoutes.js` | 24 |
| `uiOverlayRoutes.js` | 17 |
| `memories/engine.js` | 16 |
| `calendarRoutes.js` | 13 |
| `upgradeRoutes.js` | 10 |
| `franchiseBrainRoutes.js` | 10 |

Full per-file count saved at `/tmp/preflight_d.txt`. Reproduce with:

```bash
grep -rnE "router\.(post|put|patch|delete).*optionalAuth" src/routes/ \
  | awk -F: '{print $1}' | sort | uniq -c | sort -rn
```

**Scope implication:** A regex-only sweep on
`router\.(post|put|patch|delete).*optionalAuth` → `requireAuth` is
mechanically straightforward but touches **516 lines across 75 files**.
PR diff size will be ~516 changed lines plus the import-statement updates
in any file that needs to add `requireAuth` to its destructure.

---

## §5. Sub-form (e) — Cognito env vars per environment

**Source-of-truth checks performed:**

| File | Finding |
| --- | --- |
| `.env.example:37–38` | `COGNITO_USER_POOL_ID=us-east-1_XXXXXXXXX` and `COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx` (placeholder values, dev-defaults pattern) |
| `.env.production.template:52–53` | `COGNITO_USER_POOL_ID=REPLACE_WITH_COGNITO_POOL_ID` and `COGNITO_CLIENT_ID=REPLACE_WITH_COGNITO_CLIENT_ID` |
| `ecosystem.config.js:33–34` | `COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID \|\| ''` and `COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID \|\| ''` (passthrough; defaults to empty string) |

**Runtime confirmation per environment:**

| Environment | Confirmed set? | Source |
| --- | --- | --- |
| dev (`dev.primepisodes.com`, EC2/PM2) | **NOT CONFIRMED** | I cannot reach EC2 from this sandbox. |
| staging | **NOT CONFIRMED** | Same as above. |
| prod | **NOT CONFIRMED** | Same as above. |

**Drift / risk flags relevant to F-Auth-2:**

1. `src/middleware/auth.js:13` and `:20` use placeholder fallbacks
   (`'us-east-1_XXXXXXXXX'` / `'xxxxxxxxxxxxxxxxxxxxxxxxxx'`) at
   `CognitoJwtVerifier.create()` time. If `COGNITO_USER_POOL_ID` is unset,
   the verifier is **constructed with a non-existent pool**. JWKS fetch
   will fail at first verify, but the boot will succeed. F-Auth-2 (boot-
   fail on missing) will need to act *before* the verifier is created,
   not just inside `verifyToken`.
2. `verifyToken` at `:42–46` *does* throw if `COGNITO_USER_POOL_ID` is
   missing — but only on the first request, not at boot.
3. `ecosystem.config.js:33–34` defaults to empty string — same hazard.

**Action requested:** confirm out-of-band that all three environments have
both vars actually set. If F-Auth-2 lands without that, it will hard-fail
boot in any environment where they're not.

---

## §6. Sub-form (f) — frontend interceptor contract

**File:** `frontend/src/services/api.js`

**Contract (from `:40–73`):**

```js
// :44–63 — response interceptor 401 handling
if (error.response?.status === 401 && !import.meta.env.DEV) {
  const code = error.response?.data?.code;
  const isHardFail = code === 'AUTH_INVALID_TOKEN'
                  || code === 'AUTH_MISSING_TOKEN'
                  || !code;
  if (isHardFail && code !== 'AUTH_REQUIRED') {
    localStorage.removeItem('authToken');
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
  // AUTH_REQUIRED: leave creds alone, let the caller handle UX.
}
```

**Exact strings the interceptor differentiates on:**

| Code | Behavior |
| --- | --- |
| `AUTH_REQUIRED` | **Soft fail.** Leave creds, no redirect. Caller handles UX (toast etc). |
| `AUTH_INVALID_TOKEN` | **Hard fail.** Wipe `authToken` + `token`, redirect to `/login`. |
| `AUTH_MISSING_TOKEN` | **Hard fail.** Same as above. |
| (no `code` field) | **Hard fail.** Same as above (`!code` branch). |
| Any other code | **Hard fail.** Falls through to the `!code` branch — wait, see flag below. |

**FLAG — interceptor logic anomaly:** the `isHardFail` calculation only
treats `AUTH_INVALID_TOKEN`, `AUTH_MISSING_TOKEN`, or *missing* code as
hard-fail. **Any other value** (e.g., `AUTH_GROUP_REQUIRED`, `AUTH_ERROR`)
sets `isHardFail = false` → no redirect, no creds wipe — but the caller
also gets no specific UX path. This is probably fine but worth confirming
against §6b of the fix plan.

**Backend codes currently emitted (from `src/middleware/auth.js`):**

- `AUTH_MISSING_TOKEN` — strict middleware, missing header (`:80`)
- `AUTH_INVALID_FORMAT` — strict middleware, malformed `Bearer` (`:90`)
  — **NOT in the interceptor's hard-fail list**. Soft-fails today.
- `AUTH_INVALID_TOKEN` — strict middleware, verify failed (`:118`)
- `AUTH_ERROR` — strict middleware, internal error (`:125`)
- `AUTH_REQUIRED` — `requireAuth` (`:262`, `:270`, `:290`)
- `AUTH_GROUP_REQUIRED` — `verifyGroup` / `authorize` (`:196`, `:226`)

**Action requested:** confirm the §6b reconciliation in the fix plan
covers `AUTH_INVALID_FORMAT` (soft-fails today, may need to be added to
the hard-fail list) and `AUTH_GROUP_REQUIRED` (currently soft-fails;
correct or not?). I default to "leave it alone" until you say.

**DEV bypass:** `:55` — the entire interceptor 401 handling is gated by
`!import.meta.env.DEV`. In dev, *no* 401 triggers a redirect or creds
wipe. F-Auth-1 likely needs this to remain so. Flagging because it's a
contract-shaping line.

---

## §7. Sub-form (g) — public-read exemption candidates

**Methodology:** identified files where every `optionalAuth`-attached
route is a `GET` (no mutations), then inspected for `req.user`-gating
logic downstream. Routes with no `req.user` reads are candidates for
keeping `optionalAuth`. **Per task instruction: default to `requireAuth`
if uncertain.**

### 7.1 GET-only files with optionalAuth

Two files have only `GET` endpoints attached to `optionalAuth`:

| File | GET count | `req.user` reads? | Recommendation |
| --- | --- | --- | --- |
| `src/routes/manuscript-export.js` | 3 (`/book/:bookId/meta`, `/book/:bookId/docx`, `/book/:bookId/pdf`) | none | **CANDIDATE EXEMPT** — public manuscript download endpoints. Returns binary doc; whole-book exports of approved/edited lines only. No personalisation. **VERIFY:** is the manuscript intended to be public? If yes → keep `optionalAuth`. If no (e.g., gated to subscribers) → swap to `requireAuth`. |
| `src/routes/decisionAnalytics.js` | 7 (`/stats`, `/by-type`, …) | reads `req.query.user_id` not `req.user` (`:13`) | **CANDIDATE EXEMPT IF PUBLIC**, but risky: the `user_id` filter is taken from query string (caller-supplied), so anyone can query anyone else's analytics. If decision analytics is admin-only or owner-only, this needs `requireAuth` *plus* enforcement that `req.user.id === req.query.user_id`. **DEFAULT: `requireAuth`.** |

### 7.2 Mixed-verb files with high public-read likelihood

Files I spot-inspected where the GETs read like public catalog browsing
and the mutations read like admin/creator operations:

| File | Public-read GETs | Recommendation |
| --- | --- | --- |
| `src/routes/press.js` | `/characters` (`:456`), `/characters/:slug` (`:502`) — public press kit | **GETs CANDIDATE EXEMPT.** Mutations (`/seed-characters` `:362`, `/advance-career` `:532`, `/generate-post` `:608`, `/generate-scene` `:697`) → swap to `requireAuth`. |
| `src/routes/pageContent.js` | `/:pageName` (`:13`) — already public-by-design (uses `router.use(optionalAuth)` for GETs, `authenticateToken` for PUT/DELETE at `:29` and `:51`) | **ALREADY CORRECT pattern.** Use this as the F-Auth-1 reference target. |

### 7.3 Files I cannot classify without spec input

The remaining 95 route files mix GETs and mutations in ways where I'd
have to guess at the product intent. I have **not** pre-tagged them. They
default to `requireAuth` per the brief. Files where I would suggest you
specifically eyeball before the sweep:

- `src/routes/shows.js` — show browse may need to be public
- `src/routes/characters.js` — character browse may need to be public
- `src/routes/episodes.js` — episode browse may need to be public
- `src/routes/wardrobe.js` — wardrobe catalog may need public read
- `src/routes/wardrobeLibrary.js` — same as above
- `src/routes/storyteller.js` — published-line read may need to be public
- `src/routes/onboarding.js` — onboarding flow may need partial public
- `src/routes/auth.js` — sign-in/sign-up routes (file already in §3 "no
  auth import" list — correctly auth-less)
- `src/routes/health` / `src/routes/storyHealth.js` — likely public

**Action requested:** you (or v8 if it pre-tagged) tell me which files in
this list belong on the exemption list. I will not make this call.

---

## §8. Sub-form (h) — F-Auth-5 grep: `req.user.sub` sites

**Command (literal as specified):**

```bash
grep -rn "req\.user\.sub" src/
```

Returns **zero matches** because the codebase uses optional chaining
(`req.user?.sub`). The literal grep would miss every site.

**Corrected grep:**

```bash
grep -rnE "req\.user\??\.sub" src/
```

Returns **6 sites:**

| File:line | Code | Notes |
| --- | --- | --- |
| `src/routes/decisionLogs.js:22` | `user_id: req.user?.sub,` | **The only site v8 named.** |
| `src/controllers/cursorPathController.js:22` | `userId: req.user?.sub,` | NEW |
| `src/controllers/productionPackageController.js:22` | `userId: req.user?.sub,` | NEW |
| `src/controllers/iconCueController.js:22` | `userId: req.user?.sub,` | NEW |
| `src/controllers/musicCueController.js:20` | `userId: req.user?.sub,` | NEW |
| `src/routes/thumbnails.js:80` | `const userId = req.user?.sub \|\| req.user?.id \|\| 'system';` | NEW. Also fallback to `'system'`. |

**MAJOR DRIFT vs v8:** v8 named only `decisionLogs.js:22`. Pre-flight
finds **5 additional sites**, all writing `req.user?.sub` to a `user_id` /
`userId` field that downstream code presumably expects to be the Cognito
subject. F-Auth-5 (Step 6c per the prompt summary) needs to either:

- **(a)** expand scope to include all 6 sites, *or*
- **(b)** explicitly defer the 5 new ones (and document why), *or*
- **(c)** the 5 new ones are pre-existing intentional uses with
  different semantics — verify and tag accordingly.

**Note on `thumbnails.js:80`:** the `|| 'system'` fallback means this
file is currently *tolerant* of unauthenticated requests writing
"system" as the user id — meaningfully different behaviour from the
other 5. This is a behaviour change risk if F-Auth-5 swaps it.

**Surface for your decision — do not silently fold or defer.**

---

## §9. Cross-cutting drift findings (consolidated)

| # | Finding | Severity |
| --- | --- | --- |
| D1 | `src/app.js:364` cited by v8 does not point at any optionalAuth surface today. Global gate is at `:330`. | **HIGH — clarify what v8 cited.** |
| D2 | `episodeOrchestrationRoute.js:135` shifted to `:131` (−4 lines). Same handler. | LOW |
| D3 | `middleware/auth.js:13–22` is now `:12–23` (±1 line). | LOW |
| D4 | F-Auth-5 site count: v8 said 1, actual is 6. | **HIGH — scope decision needed.** |
| D5 | `requireAuth` already used in 4 production files (episodes.js, episodeBriefRoutes.js, characterRegistry.js, worldEvents.js). Sweep must not re-add imports where they exist. | MEDIUM |
| D6 | `pageContent.js` is already implementing the F-Auth-1 target pattern (router.use(optionalAuth) for GETs + authenticateToken for mutations). Use as reference. | INFO |
| D7 | Defensive lazy-import pattern (`try/catch` around `require('../middleware/auth')`) appears in `press.js`, `manuscript-export.js`, `characterRegistry.js`, `worldEvents.js`. The sweep regex may not catch these — they don't destructure on a single line. | MEDIUM |
| D8 | `arcTrackingRoutes.js` references `optionalAuth` but is in the "no auth import" list of §3. Likely an undefined-symbol bug. | MEDIUM |
| D9 | Cognito verifiers (`auth.js:12–23`) construct with placeholder fallbacks if env vars unset. F-Auth-2 boot-fail must run *before* verifier construction, not inside `verifyToken`. | MEDIUM |
| D10 | Frontend interceptor does not hard-fail on `AUTH_INVALID_FORMAT` or `AUTH_GROUP_REQUIRED`. May be intentional, but §6b should explicitly cover. | LOW |

---

## §10. Inventory totals (at a glance)

- **Total `optionalAuth` matches** (b grep): **1059** across 98 files
- **Mutation routes on optionalAuth** (d grep): **516** across 75 files
- **GET routes on optionalAuth**: **254** across (subset of) 98 files
- **Files in `src/routes/` with no auth import** (c grep): **30**
- **`req.user?.sub` sites** (h grep): **6** (v8 named 1)
- **`requireAuth` already in use**: **4 files**
- **Cognito env vars in templates**: **YES** (3 files: `.env.example`,
  `.env.production.template`, `ecosystem.config.js`)
- **Cognito env vars confirmed at runtime in dev/staging/prod**:
  **NOT CONFIRMED — out of sandbox reach**

---

## §11. Open scope decisions (need your call before Step 6a)

1. **F-Auth-5 scope:** v8 named 1 site, pre-flight finds 6. Fold all 6
   in, or fold only `decisionLogs.js:22` and defer the rest as a separate
   ticket?
2. **Public-read exemption list:** §7 lists candidates I'd be willing to
   stand behind (`pageContent.js` already correct;
   `manuscript-export.js`, `decisionAnalytics.js`, `press.js` GETs,
   public catalog browse routes). Lock the list. Anything not on the
   locked list defaults to `requireAuth`.
3. **Lazy-import pattern (D7):** sweep regex needs an extra pass for
   files using try/catch import. Should I plan for a manual review of
   the 4 affected files in Step 6a, or is a second-pass regex acceptable?
4. **arcTrackingRoutes.js (D8):** investigate the undefined-symbol
   reference now (read-only) or treat as out-of-scope for F-Auth-1?
5. **`app.js:364` (D1):** what did v8 cite? If the global gate, the new
   line is `:330`.
6. **Frontend interceptor (§6 anomaly):** should `AUTH_INVALID_FORMAT`
   and/or `AUTH_GROUP_REQUIRED` be added to the hard-fail list as part
   of §6b, or left as soft-fails?
7. **Runtime env confirmation:** can you confirm `COGNITO_USER_POOL_ID`
   and `COGNITO_CLIENT_ID` are set on EC2 dev / staging / prod before
   F-Auth-2 lands? F-Auth-2's boot-fail behaviour will block boot in any
   environment missing them.

---

## §12. Branch decision needed

- Current branch: `claude/prime-studios-setup-h7x21` (no upstream set).
- The harness's durable instructions name `claude/prime-studios-setup-h7x21`
  as the designated dev branch for this session.
- Your prompt said "I'm currently on origin/dev" and offered me the
  choice of writing the report to `dev` directly or branching off.
  `origin/dev` is not present in the local refs (would require a fetch).
- **What I did:** wrote the report on `claude/prime-studios-setup-h7x21`.
  This is consistent with the harness instruction and avoids touching
  `dev` without a fetch + explicit confirmation.

**If you want this on `dev` instead**, tell me and I'll fetch + cherry-pick
or replay the commit. No code changes are involved, so there's no merge
risk either way.

---

## §13. What's next

1. You review this report.
2. Lock the §11 decisions.
3. Drop the v8 + fix plan `.docx` files into `docs/audit/` (or paste the
   relevant sections inline) so I can reconcile any silent disagreement
   before code changes.
4. On your go, I begin Step 6a per §5.2 of the fix plan.

— end of pre-flight —
