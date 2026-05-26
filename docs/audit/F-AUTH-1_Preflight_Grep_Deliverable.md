# F-AUTH-1 §5.1 Pre-Flight Grep Deliverable (v2)

**Status:** Drafted 2026-05-21 during F-Deploy-1 Phase A G4 soak day 2. v2 supersedes v1 (drafted earlier same day) following the 2026-05-21 PE #51 / PE #52 verification amendments. Local-state only, not committed to main during G4 soak. Lands as F-AUTH-1 §5.1 pre-flight infrastructure at F-AUTH-1 execution time (post-Phase-A-close).

**Purpose:** Provide the runnable grep methodology and classification scaffolding that F-AUTH-1 execution's six-step coordinated recipe needs to apply against the current state of the routes directory. PE #51 and PE #52 (Session_PE_Roster.md, both filed 2026-05-20, both amended 2026-05-21) are the inputs; this deliverable turns them into an executable workflow.

**Predecessor:** F-AUTH-1 plan v2.37 §5.1 (on main via commit `1265d8c3`, 2026-05-09).

**v2 changes from v1:**

- Pre-flight script now performs five passes (v1 had three): added Pass 4 (conservative per-route auth detection) and Pass 5 (aggressive per-route auth detection).
- Three-tier classification methodology introduced: Tier 1 confirmed / Tier 2 probable / Tier 3 needs-inspection.
- Tier 3 work surface (~48 routes across 8 files) replaces the v1 outer-bound table (54 routes across 9 files) as the prioritized F-AUTH-1 execution target.
- Scope corrections folded in: `src/app.js:236` (not `app.js:236`), second mount at `src/app.js:1168`, three additional iconSlots writes (with Pattern 5/6 line-number convention).
- PE #52's outer bound corrected: 120 candidate files / 853 candidate routes (was 9 / ~53 in v1, an undercount due to partial grep).
- Codebase auth-consistency finding documented: Tier 2 = 0 routes indicates strong auth-style consistency (either explicit inline auth or no auth, very few mixed-mode declarations).

**Scope:**

- PE #51 inventory verification (corrected — write routes with `optionalAuth`)
- PE #52 outer-bound verification (corrected — 120 candidate files / 853 candidate routes)
- Three-tier classification of PE #52 candidate routes via Pass 4 + Pass 5
- `src/app.js:236` and `src/app.js:1168` mount verification
- PE #55 read-surface sibling inventory (referenced but not refined here — read-surface classification is its own pre-flight work)

**Out of scope:**

- Sub-form (c) inventory (F-Auth-2 through F-Auth-6 supporting findings — separate pre-flight work)
- Per-route fix execution (F-AUTH-1 six-step recipe applies post-classification)
- v2.37 §4.3 line-number update to `src/app.js:236` (folds into v2.37 next revision, or captured as v2.37-stale in v11)

---

## §1 Why this deliverable exists

F-AUTH-1 plan v2.37 §5.1 names the pre-flight inventory step that must run before F-AUTH-1 execution starts. v2.37 was authored 2026-05-09. Between then and 2026-05-21, the routes directory has continued to drift — new routes added, existing routes refactored, line numbers shifted. PE #51's original `app.js:236` claim was the first sign of this drift; the 2026-05-21 verification revealed three deeper issues:

1. **File-path drift:** the actual global mount lives at `src/app.js:236`, not at root-level `app.js`. v2.37 §4.3's `:364` reference is line drift in `src/app.js`.
2. **Missed second mount:** `src/app.js:1168` has a path-prefixed admin queue mount (`app.use('/admin/queues', requireAuth, authorize(['ADMIN']), ...)`) that PE #51 didn't capture.
3. **Inventory undercount:** PE #52's 9-file / ~53-route framing was a sample; the full-coverage grep produces 120 files / 853 routes.

Running F-AUTH-1 execution against v2.37's pre-flight inventory would mean executing against stale evidence. The classification calls F-AUTH-1's six-step recipe must make for each route depend on the route's current state, not its 2026-05-09 state, and not the 2026-05-20 partial inventory.

This deliverable produces a *fresh* pre-flight inventory at F-AUTH-1 execution time. It's not a revision of v2.37 — it's the executable methodology that v2.37 §5.1 prescribes.

---

## §2 Methodology

Five grep passes, run in sequence, against the current state of `src/routes/` + `src/app.js`:

**Pass 1 — `optionalAuth` inventory on writes (PE #51 verification):**
- Find all `optionalAuth` usages on write routes: explicit per-route declarations + file-level mounts.
- Pass 1's same-line regex catches Pattern 1 (single-line declarations). Pattern 5/6 multi-line declarations (e.g., iconSlots) are caught by Pass 4 instead.
- Compare against PE #51's corrected 4-route Pattern-1 inventory.

**Pass 2 — File-level auth mount inventory (PE #52 outer-bound verification):**
- Find all `router.use(...)` calls invoking auth middleware (`requireAuth`, `authenticateJWT`, `optionalAuth`, `authMiddleware`).
- The complement of this set — route files with write routes but no file-level auth mount — is the PE #52 candidate outer bound.
- Compare against PE #52's corrected 120-file inventory.

**Pass 3 — `src/app.js` global mount verification:**
- Detect both bare `app.use(optionalAuth)` and path-prefixed `app.use('/path', requireAuth, ...)` patterns.
- Confirm bare mount at line 236 and path-prefixed admin mount at line 1168.

**Pass 4 — Per-route auth detection (conservative):**
- For each PE #52 candidate file, scan 5 lines after each write route declaration for auth middleware names.
- Catches Patterns 1, 5, 6 (inline and immediately-following-line declarations).
- Routes that match: Tier 1 (confirmed auth).

**Pass 5 — Per-route auth detection (aggressive):**
- For routes Pass 4 didn't catch, extend the scan window to 15 lines (stopping at next route declaration).
- Catches Patterns 2, 3 (array middleware and indirected name patterns).
- Routes that match: Tier 2 (probable auth, needs verification).
- Routes that don't match either pass: Tier 3 (needs per-route inspection).

Output of all five passes goes into the classification scaffolding in §4 and the Tier 3 work surface table in §6.

---

## §3 Runnable script

The companion PowerShell script `f-auth-1_preflight_grep.ps1` (in this deliverable's bundle) runs all five passes and emits structured output.

The script is *read-only* — it greps the repository at the current `git ls-files` state. It does not modify files, does not commit, does not push. Safe to run during G4 soak (passive monitoring posture is preserved).

Invocation:

```powershell
powershell -ExecutionPolicy Bypass -File .\docs\audit\f-auth-1_preflight_grep.ps1
```

To capture output for later analysis:

```powershell
powershell -ExecutionPolicy Bypass -File .\docs\audit\f-auth-1_preflight_grep.ps1 | Out-File -FilePath f-auth-1_preflight_$(Get-Date -Format yyyy-MM-dd).txt
```

---

## §4 Classification scaffolding

Each write route in scope receives one of five classification outcomes. Four outcomes for PE #52 candidates plus a fifth for PE #51 routes.

### §4.1 Outcomes for PE #52 candidates (write routes with no file-level auth mount)

**Outcome 1 — Sub-form (b) true positive.**
- Route has no auth middleware at file level *and* no auth middleware in its handler chain.
- F-AUTH-1 six-step recipe applies in full.
- Fix shape: add `requireAuth` middleware to the route's handler chain, or add file-level `router.use(requireAuth)` if the entire file should be auth-gated.

**Outcome 2 — Justified-public-read false positive.**
- Route is intentionally unauthenticated.
- Examples: webhook receivers, public submission endpoints, OAuth callback URLs, content negotiation endpoints, robots.txt-equivalent routes.
- F-AUTH-1 recipe *skips* with documented rationale captured in the route's comment header or in a justification file (`docs/auth/justified-public-routes.md` or equivalent).
- This outcome should be rare for write routes — most write routes touching application state should require auth. Webhooks and public-submission endpoints are the legitimate exceptions; everything else needs a stronger justification than "we didn't think about it."

**Outcome 3 — Per-route auth false positive.**
- Route appears in PE #52 candidate inventory because file-level grep missed it, but actually has `requireAuth` middleware in its handler chain *between* the path and the handler function.
- Example pattern: `router.post('/path', requireAuth, async (req, res) => {...})`.
- F-AUTH-1 recipe *skips* — the route is already auth-gated.
- Classification correction: PE #52 entry for this route is filed as false-positive; the inventory count for the file decrements.

**Outcome 4 — Multi-line auth declaration false positive.**
- Route has auth middleware applied via `app.use()` in `src/app.js` at mount time, not via `router.use()` in the route file.
- Example pattern: `app.use('/api/something', requireAuth, somethingRoutes)` in `src/app.js`, where `somethingRoutes` is the imported router from a file with no internal `router.use(requireAuth)`.
- File-level grep within `src/routes/` won't find this; the auth declaration is in `src/app.js`, not in the route file.
- F-AUTH-1 recipe *skips* — the route is already auth-gated, just at the mount layer rather than the router layer.
- Classification correction: PE #52 entry for this route is filed as false-positive; F-AUTH-1 execution should add a comment to the route file noting the external auth declaration to prevent future false positives.

### §4.2 Outcomes for PE #51 routes (write routes with `optionalAuth`)

**Outcome 5 — Sub-form (a) true positive.**
- Route has `optionalAuth` middleware (explicit per-route or file-level mount).
- `optionalAuth` permits writes from unauthenticated requests — this is the F-AUTH-1 sub-form (a) defect class.
- F-AUTH-1 six-step recipe applies in full.
- Fix shape: replace `optionalAuth` with `requireAuth` for write routes; keep `optionalAuth` only where the route is justified-public-read (Outcome 2 reasoning applies).

A PE #51 route can sometimes turn out to be Outcome 2 (justified-public-read) — `luxuryFilterRoutes.js:11` and `:32` are likely candidates given the file name suggests filter/search endpoints rather than state mutations. Per-route review at F-AUTH-1 execution time confirms.

### §4.3 Three-tier classification (Pass 4 + Pass 5 output)

The script's Pass 4 + Pass 5 output produces a three-tier classification for the PE #52 candidate population:

- **Tier 1 — Confirmed auth.** Pass 4 detected auth middleware within 5 lines of route declaration. High confidence the route is auth-gated. F-AUTH-1 execution should still verify (because a comment mentioning auth would also match), but the per-route classification work can deprioritize Tier 1.

- **Tier 2 — Probable auth.** Pass 4 didn't detect, but Pass 5 did within 15 lines. Probable auth via array middleware (Pattern 2) or indirected name (Pattern 3). F-AUTH-1 execution should verify each Tier 2 route — the detection signal is weaker than Tier 1.

- **Tier 3 — Needs per-route inspection.** Neither Pass 4 nor Pass 5 detected auth middleware. This is the prioritized F-AUTH-1 sub-form (b) work surface — routes that look like genuine sub-form (b) true positives at script-detection level, pending per-route inspection.

Tier 3 work surface as of 2026-05-21 script run: **48 routes across 8 files**. See §6.

---

## §5 Codebase auth-style consistency finding (NEW)

The 2026-05-21 script run produced a notable secondary finding: **Tier 2 = 0 routes** across the entire 853-route PE #52 candidate population.

This means: every PE #52 candidate route either has auth detectable within 5 lines of declaration (Tier 1: 805 routes) or has no auth detection signal at all within 15 lines (Tier 3: 48 routes). Zero routes use Pattern 2/3 (array middleware, indirected names) in detectable form.

**Methodological reading:** the codebase uses a consistent auth-middleware style across nearly all routes. Either explicit inline auth (Pattern 1 / 5 / 6) or no auth, with very few mixed-mode declarations. This is a positive finding — auth declarations are simple enough that grep-based detection is reliable for Tier 1 classification.

**Implications for F-AUTH-1 execution:**

- The 805 Tier 1 routes can be deprioritized for individual inspection — the script-detection signal is strong enough that they're presumptively auth-gated.
- The 48 Tier 3 routes are the actual sub-form (b) work surface. F-AUTH-1 execution can focus per-route inspection here without burning effort on routes that are clearly auth-gated.
- Future audit cycles can re-run the script as a regression check: any Tier 2 > 0 result would indicate codebase has shifted toward array/indirected auth patterns, which would warrant a methodology update.

**Caveat:** Tier 1 = "auth detected within 5 lines of declaration" doesn't guarantee the auth is *correct*. A route with `requireAuth` middleware that should have `requireAuth + authorize(['ADMIN'])` is Tier 1 by the script's binary detection but is a sub-form (a)-adjacent defect at audit level. F-AUTH-1 execution should still spot-check Tier 1 routes for missing-authorize patterns, especially admin-touching routes.

---

## §6 Tier 3 work surface — prioritized F-AUTH-1 sub-form (b) targets

The 48-route Tier 3 surface as of 2026-05-21 script run. F-AUTH-1 execution applies per-route classification to each entry; each gets one of Outcomes 1–4 per §4.1.

| File | Tier 3 routes | Notes |
|---|---|---|
| `compositions.js` | 12 | Largest single-file Tier 3 count; also has 7 Tier 1 routes (mixed-auth file) |
| `continuityEngine.js` | 11 | All 11 routes in file are Tier 3 (no auth detection signal) |
| `templateStudio.js` | 7 | All 7 routes in file are Tier 3 |
| `roles.js` | 5 | All 5 routes in file are Tier 3 |
| `animatic.js` | 4 | All 4 routes in file are Tier 3 |
| `auth.js` | 4 | 4 of 5 routes Tier 3 (login/refresh/test-token/validate likely justified-public — Outcome 2) |
| `footage.js` | 4 | All 4 routes in file are Tier 3 |
| `decisions.js` | 1 | Single route in file is Tier 3 |
| **Total** | **48** | |

### §6.1 Per-route Tier 3 classification table

To be filled in at F-AUTH-1 execution time. The script's drift summary identifies the files; the F-AUTH-1 execution session inspects each route in its handler chain.

| File | Line | Route Method/Path | Outcome | Per-Route Fix | Rationale |
|---|---|---|---|---|---|
| compositions.js | TBD | TBD | TBD | TBD | TBD |
| continuityEngine.js | TBD | TBD | TBD | TBD | TBD |
| templateStudio.js | TBD | TBD | TBD | TBD | TBD |
| roles.js | TBD | TBD | TBD | TBD | TBD |
| animatic.js | TBD | TBD | TBD | TBD | TBD |
| auth.js | TBD | TBD | TBD | TBD | TBD |
| footage.js | TBD | TBD | TBD | TBD | TBD |
| decisions.js | TBD | TBD | TBD | TBD | TBD |

(48 rows total when filled in. Run the script for current line numbers — Tier 3 file list is stable but per-route line numbers may drift between this deliverable's authoring and F-AUTH-1 execution.)

Outcome column accepts: `1` (sub-form-b true positive), `2` (justified-public-read), `3` (per-route auth false positive — Pass 4 missed it), `4` (multi-line auth false positive — Pass 4 missed because auth declared in `src/app.js` at mount time).

### §6.2 PE #51 routes (write routes with `optionalAuth`)

| File | Line | Route | Outcome | Per-Route Fix | Rationale |
|---|---|---|---|---|---|
| luxuryFilterRoutes.js | 11 | POST `/validate` | TBD | TBD | TBD |
| luxuryFilterRoutes.js | 32 | POST `/quick-check` | TBD | TBD | TBD |
| seasonRhythmRoutes.js | 16 | POST `/validate` | TBD | TBD | TBD |
| worldStudio.js | 2483 | POST `/world/generate-ecosystem-preview` | TBD | TBD | TBD |
| iconSlots.js | 49 (mw:51) | POST | TBD | TBD | TBD |
| iconSlots.js | 59 (mw:61) | PUT | TBD | TBD | TBD |
| iconSlots.js | 69 (mw:71) | DELETE | TBD | TBD | TBD |
| authorNoteRoutes.js | 60 | POST `/` (via file-level mount :18) | TBD | TBD | TBD |
| authorNoteRoutes.js | 84 | PUT `/:id` (via file-level mount :18) | TBD | TBD | TBD |
| authorNoteRoutes.js | 108 | DELETE `/:id` (via file-level mount :18) | TBD | TBD | TBD |
| entanglementRoutes.js | 88 | POST `/characters/:characterId/entanglements` (via file-level mount :40) | TBD | TBD | TBD |
| entanglementRoutes.js | 124 | PATCH `/entanglements/:id` (via file-level mount :40) | TBD | TBD | TBD |
| entanglementRoutes.js | 145 | DELETE `/entanglements/:id` (via file-level mount :40) | TBD | TBD | TBD |
| entanglementRoutes.js | 166 | PATCH `/profiles/:profileId/state` (via file-level mount :40) | TBD | TBD | TBD |
| entanglementRoutes.js | 252 | POST `/events/:id/resolve` (via file-level mount :40) | TBD | TBD | TBD |
| entanglementRoutes.js | 265 | POST `/events/:eventId/proposals/:characterId/approve` (via file-level mount :40) | TBD | TBD | TBD |
| entanglementRoutes.js | 325 | POST `/characters/:characterId/unfollows` (via file-level mount :40) | TBD | TBD | TBD |
| entanglementRoutes.js | 360 | PATCH `/unfollows/:id/confirm` (via file-level mount :40) | TBD | TBD | TBD |
| src/app.js | 236 | (bare global mount `app.use(optionalAuth)`) | TBD | TBD | TBD |
| src/app.js | 1168 | (path-prefixed mount `app.use('/admin/queues', requireAuth, ...)`) | TBD | TBD | TBD |

(20 rows: 18 individual write routes + 2 `src/app.js` mounts. The `src/app.js:1168` mount uses `requireAuth`, not `optionalAuth`, but is included in PE #51's surface because it's a global auth mount that F-AUTH-1 execution should be aware of when reasoning about which routes are auth-gated by mount-time middleware.)

Outcome column accepts: `2` (justified-public-read), `5` (sub-form-a true positive).

### §6.3 iconSlots.js line-number convention

`iconSlots.js` uses **Pattern 5/6** (multi-line route declarations). Route declarations live at lines 49/59/69 (the `router.post(...)` / `router.put(...)` / `router.delete(...)` calls); `optionalAuth` middleware references live at lines 51/61/71 (two lines below each declaration). PE #51 references the route-declaration lines as the canonical PE entries; middleware-line references are preserved as cross-reference annotations.

This convention applies generally: when a route uses Pattern 5/6, the route-declaration line is the canonical reference. When a route uses Pattern 1 (single-line `router.post('/x', requireAuth, ...)`), the declaration and middleware are the same line and the distinction doesn't matter.

The pre-flight grep script's Pass 1 catches only Pattern 1 (single-line). Pass 4 catches Pattern 5/6 by scanning the 5-line window after declaration. iconSlots writes don't appear in Pass 1 output for this reason; they appear correctly in Pass 4 as Tier 1 confirmed auth.

---

## §7 What this deliverable does NOT do

- Does not execute the per-route classification (F-AUTH-1 execution work, post-Phase-A-close).
- Does not modify any route files.
- Does not commit to main during G4 soak.
- Does not update v2.37 §4.3's `app.js:364` reference (folds into v2.37 next revision; corrected reference is `src/app.js:236`).
- Does not address F-AUTH-1 sub-form (c) supporting findings (F-Auth-2 through F-Auth-6 — separate pre-flight work).
- Does not address the F-AUTH-1 six-step recipe itself — the recipe lives in v2.37, this deliverable feeds the recipe's pre-flight input slot.
- Does not refine the read-surface classification (PE #55) — read-route classification is its own pre-flight work, sibling to this one.

---

## §8 Sequencing

Per v10 Decision #98 revised + v1.3 §7.2, F-AUTH-1 execution is queued behind F-Deploy-1 Phase A close. Phase A G4 soak ends 2026-05-26. F-AUTH-1 execution begins post-soak-close.

The grep deliverable's intended run schedule:

1. **At soak close (2026-05-26 or after)** — run the script to verify PE #51 / PE #52 inventories are still accurate. Flag any drift.
2. **At F-AUTH-1 execution start** — fill in the §6.1 Tier 3 classification table based on per-route inspection of the 48-route surface. Fill in the §6.2 PE #51 classification table.
3. **During F-AUTH-1 execution** — six-step recipe applies route-by-route per the filled-in tables. Focus on Tier 3 + PE #51 Outcome 5 candidates; Tier 1 routes get spot-check only.
4. **At F-AUTH-1 execution close** — re-run the script as a regression check. All PE #51 / PE #52 routes should now be classified and either fixed (Outcomes 1, 5) or documented as justified-skip (Outcomes 2, 3, 4).

The script is idempotent and read-only. Running it multiple times across the F-AUTH-1 execution window is safe and recommended.

---

## §9 Methodological pattern surfaced — evidence-state-revision (cross-reference)

v1 of this deliverable was authored 2026-05-21 morning against PE #51 / PE #52 inventories that turned out to be incomplete (PE #51 missed 3 iconSlots write routes and the `src/app.js:1168` second mount; PE #52 captured 9 of 120 candidate files as a sample). The pre-flight grep script's first run surfaced these gaps.

This is the closure-semantic pattern documented in v11 §3.3.4 (closure-semantic vocabulary expansion, drafted earlier 2026-05-21): **evidence-state-revision**. The original PE entries were correct at their evidence state (the partial grep output they were built from); new evidence (full-coverage grep) shows the original evidence was a sample. The roster amendments preserve the original entries and document the corrections.

v2 of this deliverable folds in the corrections without retroactively rewriting v1. v1 is preserved in git history at the local-state snapshot taken before this rewrite; v2 is authoritative going forward.

The pattern is reusable: if F-AUTH-1 execution surfaces additional drift between the v2 inventory and the live repo state, the next correction follows the same shape — preserve v2 as evidence-state snapshot, draft v3 with corrections folded in.

---

## §10 Local-state status

This deliverable v2 is local-state, not committed to main during G4 soak. Lives alongside:

- F-Stats-1 Phase B G1 Planning artifact four-amendment revision + §6.5 NAT sub-amendment (drafted 2026-05-19, sub-amendment folded in 2026-05-21).
- Session_PE_Roster.md update with PE #43 amendment + PE #50 / #51 / #52 / #53 / #54 / #55 (drafted 2026-05-20–21, with PE #51 / #52 verification amendments folded in 2026-05-21).
- v11 session brief outline `.md` and `.docx` from 2026-05-20.
- v11 §3.3 closure-semantic vocabulary expansion (drafted 2026-05-21).
- This file + `f-auth-1_preflight_grep.ps1` v2 (drafted 2026-05-21).

All ship together at v11 authoring session post-soak-close (~2026-05-26), or earlier if soak-close criteria permit and F-AUTH-1 execution can begin.

---

*End of F-AUTH-1 §5.1 Pre-Flight Grep Deliverable v2. Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni. Date: 2026-05-21 (F-Deploy-1 Phase A G4 soak day 2 of 7). Supersedes v1.*
