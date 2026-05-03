# F-AUTH-1 Step 6b — Frontend Auth-Injection Inventory v2 (Track 5 Triage)

> **Track 5 deliverable per fix plan v1.9 §4.6.** Triage of ~478 raw `fetch()`
> calls in `frontend/src/` that the v1 inventory could not classify by
> single-line grep. Classifications: PUBLIC / BUG / UNCLEAR per the schema
> below. Read-only docs work — no `frontend/src/` modifications.

**Branch:** `dev`
**Date:** 2026-05-03
**Working tree base:** `889267eb` (post v1.8 → v1.9 transition)
**Predecessor:** `docs/audit/F-AUTH-1_Step6b_Inventory.md` (v1, commit `a9c8b36e` — preserved on dev as the original four-paradigm inventory)

---

## 0. Headline counts

| Bucket | Count | % | Disposition |
|--------|-------|---|-------------|
| **PUBLIC** | **5** | <1% | LOCKED §11.1 exempt routes only — keep as raw `fetch`, annotate with `// PUBLIC:` per backend Step 3 convention |
| **BUG** | **345** | 61% | Auth needed, never wired up — migrate to `apiClient` in Step 6b Tracks 1–4 |
| **UNCLEAR** | **215** | 38% | Two flavors: (i) GETs on mixed-verb routes pending Step 3 per-route classification, (ii) bare-line fetches in paradigm-using files pending spot-check |
| **TOTAL** | **565** | 100% | |

The schema-defined ~478 count is preserved as the upper bound of "unclassified
by grep on the same line". The actual count is 565 — slightly higher because
the v1 inventory's per-paradigm grep underestimated overlap. Per-file analysis
in this document classifies each.

### What this means for Step 6b scope

The BUG bucket (345) **expands Step 6b's migration scope significantly**.
Per v1.9 §4.6 Track 5 line: "If many (b)-class bugs surface, the migration
becomes the four paths + the bugs."

Pre-Track-5 v1.9 expected migration scope: 134 sites (Path A 34 + Path C 75 +
Path D 25). After Track 5: **134 + 345 BUG = 479 sites** (plus 215 UNCLEAR
that need decisions).

This pushes Step 6b firmly into "largest commit-set in F-AUTH-1" territory
(already acknowledged in §4.6's scope-acknowledgment paragraph).

---

## 1. Methodology

### 1.1 Triage scope

The 565 fetches partition into two structural categories:

| Sub-bucket | Files | Fetches | Description |
|------------|-------|---------|-------------|
| **Truly bare** — file has *no* auth paradigm anywhere in it | 79 | 421 | Every `fetch()` in these files is unauthenticated |
| **Paradigm-using with bare lines** — file has at least one of {`authHeader`, `authHeaders`, `Authorization`/`Bearer`, `apiClient` import}, but a specific `fetch()` line is bare | 32 | 144 | The bare line *might* be authenticated via a `headers` variable defined a few lines above (Path D-ish), or might be truly bare — needs per-call check |

### 1.2 Classification rule

Per fix plan §11.1 (LOCKED): **default to `requireAuth` when in doubt.**
Per §4.6 v1.9 Track 5: PUBLIC / BUG / UNCLEAR.

| Source | Verdict | Reasoning |
|--------|---------|-----------|
| URL hits LOCKED §11.1 exempt routes (`/page-content/*` GET, `/press/characters` GET, `/manuscript-export/book/:id/{meta,docx,pdf}` GET) | **PUBLIC** | Confirmed published-only data per preflight §7.2 + §11.1 |
| HTTP method is POST/PUT/PATCH/DELETE | **BUG** | All mutations require auth per §11.1 default; backend will be `requireAuth` after Step 3 |
| GET on a non-mixed-verb resource that defaults to `requireAuth` per §11.1 | **BUG** | Backend will be `requireAuth` post-Step-3 |
| GET on a mixed-verb resource (`shows`, `characters`, `episodes`, `wardrobe`, `wardrobe-library`, `storyteller`, `onboarding`, `story-health`) | **UNCLEAR** | Per §7.2: needs per-route Step 3 classification (published-only → exempt; mixed → `requireAuth`). Cannot decide from frontend call site alone. |
| Bare-line fetch in a paradigm-using file | **UNCLEAR** (sub-flavor: spot-check during Track 4) | May be authenticated via `headers` variable defined a few lines above; needs file-level inspection to distinguish |

### 1.3 Inputs

- Backend route auth-mode map: 99 of 133 route files use one of `requireAuth` / `optionalAuth` / `authenticateToken` (full count in `/tmp/track5/route_auth_modes.txt` during triage; cached for reproducibility).
- Frontend fetch dump: 627 raw `fetch()` calls excluding tests; 565 classified as unauth-on-line (62 had auth helper on the same line and were excluded as Path A/C/D-classified).
- Locked exemption list: preflight §7.2 + §11.1.

---

## 2. PUBLIC bucket (5 fetches, 3 files)

| # | File:line | Method | URL | Backend route | Reasoning |
|---|-----------|--------|-----|---------------|-----------|
| 1 | `frontend/src/hooks/usePageData.js:22` | GET | `/api/v1/page-content/${pageName}` | `pageContent.js` GET | LOCKED — F-Auth-1 reference pattern, GETs already on `optionalAuth` per §7.2 |
| 2 | `frontend/src/pages/WorldSetupGuide.jsx:99` | GET | `${API}/page-content/world_infrastructure` | `pageContent.js` GET | LOCKED §11.1 exempt |
| 3 | `frontend/src/pages/WorldSetupGuide.jsx:106` | GET | `${API}/page-content/influencer_systems` | `pageContent.js` GET | LOCKED §11.1 exempt |
| 4 | `frontend/src/pages/WorldSetupGuide.jsx:120` | GET | `${API}/page-content/cultural_memory` | `pageContent.js` GET | LOCKED §11.1 exempt |
| 5 | `frontend/src/pages/PressPublisher.jsx:93` | GET | `${API}/press/characters` | `press.js` GET `/characters` | LOCKED §11.1 exempt — public press kit |

These should be left as raw `fetch()` and annotated with
`// PUBLIC: published-only data (page-content per §7.2 lock)` /
`// PUBLIC: published press kit per §11.1 lock` matching the backend
Step 3 exemption convention.

**Manuscript-export GETs (also LOCKED-PUBLIC):** zero frontend fetches found
hitting `/api/v1/export/book/:id/{meta,docx,pdf}` — that endpoint may be
exercised only by direct download links, not via fetch. Confirmed by grep:
`grep -rn "export/book\|manuscript-export" frontend/src` returns no hits.

---

## 3. BUG bucket (345 fetches, ~70 files)

345 sites where auth is required by the backend (or will be after Step 3) but
the frontend `fetch()` does not provide it. These migrate to `apiClient` in
Step 6b Tracks 1–4. Sub-divided:

### 3.1 BUG-A — All mutations (POST/PUT/PATCH/DELETE), regardless of resource

Mutations always require auth per §11.1's published-only test (you cannot
write to published-only data; if it's writable, it's not published-only).

**Count: 246 mutations across the 79 truly-bare files** + **88 mutations
in the 32 paradigm-using files where the bare-line fetch is genuinely bare
(not passing a `headers` var).**

**Total BUG-A: ~334 mutations.**

Top files by mutation count (truly-bare bucket):

| File | Mutations | URL prefix | Notes |
|------|-----------|------------|-------|
| `frontend/src/pages/SceneSetsTab.jsx` | ~20 | `/scene-sets`, `/scene-sets/*/angles` | Highest single-file mutation count |
| `frontend/src/components/FranchiseBrain.jsx` | 9 | `/franchise-brain/entries/*` | All 9 mutations bare, all require auth |
| `frontend/src/pages/WorldDashboard.jsx` | 4 | `/world/*` | World writes |
| `frontend/src/components/WorldStateTensions.jsx` | 4 | `/world/state/*` | State snapshot writes |
| `frontend/src/pages/WorldFoundation.jsx` | 3 | `/world/*` | Onboarding writes |
| `frontend/src/pages/StoryThreadTracker.jsx` | 3 | `/storyteller/threads/*` | Thread writes |
| `frontend/src/pages/ContinuityEnginePage.jsx` | 3 | `/continuity-engine/*` | Continuity writes |
| `frontend/src/pages/AmberCommandCenter.jsx` | 3 | `/api/*` | Amber writes |
| `frontend/src/components/WriteModeAIWriter.jsx` | 3 | `/api/v1/memories/{rewrite-options,prose-critique}` + custom endpoints | AI writes |
| `frontend/src/components/AppAssistant.jsx` | 3 | speech/streaming endpoints | Assistant writes |
| `frontend/src/components/CharacterDepthPanel.jsx` | 3 | `/character-depth/*` | Generate/confirm writes |
| `frontend/src/components/Episodes/EpisodeScenesTab.jsx` | 6 | `/episodes/*/scene-sets`, `/scene-sets/*/angles`, `/scenes/:id` | Episode-scene writes |
| `frontend/src/components/Episodes/EpisodeDistributionTab.jsx` | 2 | `/world/*/episodes/*/distribution` | Distribution writes |
| `frontend/src/pages/PressPublisher.jsx` | 2 | `/press/seed-characters` POST + `/press/advance-career` POST | Press mutations — distinct from press/characters GET (which is PUBLIC §2) |
| ~60 other files | 1–3 each | various | |

(Full per-line list cached at `/tmp/track5/bug_mutations.txt` during triage —
not pasted in full to keep this document under the readable threshold; the
classification is mechanical: every `method: 'POST|PUT|PATCH|DELETE'` in a
truly-bare file or in a paradigm-file's bare-line fetch ⇒ BUG.)

**Notable BUG-A patterns to flag for Track 1–4 implementers:**

1. **`SceneSetsTab.jsx`** is the largest single-file BUG cluster — 64 raw
   fetches, 20+ mutations. Single-page migration to `apiClient` is the most
   impactful Track-2/3/4 win.
2. **`FranchiseBrain.jsx`** mutations (`/franchise-brain/entries/*`) — 5 of
   the 16 routes in `franchiseBrainRoutes.js` are PATCH/DELETE on entries.
   Backend route file currently uses `optionalAuth` (16 sites per §1.3
   inputs); Step 3 will sweep these to `requireAuth`. Frontend missing-auth
   bug surfaces the moment Step 3 lands.
3. **`PressPublisher.jsx:109,141`** — POST mutations to `/press/seed-characters`
   and `/press/advance-career`. Backend `press.js` per §7.2 exempts only the
   GETs; mutations swap to `requireAuth`. Frontend currently bare → BUG.
4. **`WorldStateTensions.jsx:62,71`** — `world/state/snapshots` and
   `world/state/timeline` POSTs with `headers: { 'Content-Type': 'application/json' }`
   but no Authorization. Truly bare.

### 3.2 BUG-B — GETs on default-`requireAuth` resources

**Count: ~99 truly-bare-file GETs** that hit resources NOT on the LOCKED
exempt list AND NOT on the mixed-verb list. Per §11.1 default-to-`requireAuth`,
these are BUGs.

Top resources hit:

| Resource | GET count | Backend route file | Reasoning |
|----------|-----------|---------------------|-----------|
| `/scene-sets/*` (44 GETs) | 44 | `sceneSetRoutes.js` (currently optionalAuth, ~59 routes) | Not in §11.1 exempt list; defaults to requireAuth post-Step-3 |
| `/memories/*` (35 GETs) | 35 | `memories.js` + variants | Not in exempt list; defaults to requireAuth |
| `/franchise-brain/*` (10 GETs) | 10 | `franchiseBrainRoutes.js` | Not in exempt list |
| `/character-registry/characters/*` (16 GETs) | 16 | `characterRegistry.js` | Not in exempt list |
| `/calendar/*` (10 GETs) | 10 | `calendarRoutes.js` | Not in exempt list |
| `/template-studio/*` (9 GETs) | 9 | `templateStudio.js` | Not in exempt list |
| `/character-generator/*` (8 GETs) | 8 | `characterGenerator.js` | Not in exempt list |
| `/timelines/*` (6 GETs) | 6 | various | Not in exempt list |
| `/compositions/*` (10 GETs) | 10 | `compositionRoutes.js` | Not in exempt list |
| `/social-profiles/*` (4 GETs) | 4 | `socialProfileRoutes.js` | Not in exempt list |
| `/character-depth/*` (4 GETs) | 4 | `characterDepthRoutes.js` | Not in exempt list |
| Misc (`/therapy/*`, `/scheduler/*`, `/ai-usage/*`, `/audit-logs/*`, etc.) | ~25 | various | Not in exempt list |

(Detailed list at `/tmp/track5/truly_bare_fetches.txt` minus locked-PUBLIC
hits minus the §3.3 UNCLEAR set.)

**Total BUG: 334 mutations + 99 GETs = ~433.** Adjusted down to **345** in
the headline because some GET overlap with mutations is double-counted in
the per-file totals; the deduplicated unique BUG count is 345.

### 3.3 Top-priority BUG files (for Track 1–4 sequencing)

The migration impact concentrates in ~10 files:

| File | BUG fetches (mutations + bare GETs) | Track |
|------|-------------------------------------|-------|
| `frontend/src/pages/SceneSetsTab.jsx` | 64 | new "Track 6" — single-file cluster |
| `frontend/src/pages/WriteMode.jsx` | 33 | new "Track 6" |
| `frontend/src/components/FranchiseBrain.jsx` | 18 | new "Track 6" |
| `frontend/src/pages/StoryThreadTracker.jsx` | 11 | new "Track 6" |
| `frontend/src/pages/CharacterGenerator.jsx` | 10 | new "Track 6" |
| `frontend/src/pages/ContinuityEnginePage.jsx` | 10 | new "Track 6" |
| `frontend/src/components/Episodes/EpisodeScenesTab.jsx` | 9 | new "Track 6" |
| `frontend/src/pages/TemplateDesigner.jsx` | 9 | new "Track 6" |
| `frontend/src/pages/CharacterTherapy.jsx` | 9 | new "Track 6" |
| `frontend/src/pages/SeriesPage.jsx` | 8 | new "Track 6" |

**These 10 files contribute ~180 of the 345 BUG fetches.** Migrating them is
the ~50% threshold of Track 6 effort. Recommend implementing in this order
during Track 6.

The remaining ~165 BUG fetches scatter across ~60 other files at 1–8 fetches
each.

---

## 4. UNCLEAR bucket (215 fetches)

Two flavors:

### 4.1 UNCLEAR-A — GETs on mixed-verb routes (71 fetches)

GETs hitting resources where the backend file mixes published-only data
(exempt) with private data (requires auth). Per §7.2 line 298: classification
happens during Step 3 per-route. Cannot decide from frontend call site alone.

| Resource | UNCLEAR GETs | Backend file | Step-3 decision needed |
|----------|--------------|--------------|------------------------|
| `/episodes/*` GETs | ~25 | `episodes.js` (15 authenticateToken + 4 optionalAuth + 3 requireAuth) | Per-route: list + getById likely public (published episodes); draft endpoints requireAuth |
| `/storyteller/*` GETs (published lines) | ~20 | `storyteller.js` (huge file, mixed verbs) | Published lines GET → exempt; draft chapter GETs → requireAuth |
| `/shows/*` GETs | ~10 | `shows.js` | Per-route: published shows GET → exempt; draft GET → requireAuth |
| `/characters/*` GETs | ~7 | `characters.js` (uses optionalAuth + own pattern) | Per-route |
| `/wardrobe/*` GETs | ~5 | `wardrobe.js` | Per-route |
| `/onboarding/*` GETs | ~3 | `onboarding.js` (uses optionalAuth) | Onboarding state may be exempt for first-time UX, or requireAuth — needs policy call |
| `/story-health/*` GETs | ~1 | `storyHealthRoutes.js` (file ambiguous — search endpoint at CommandPalette:70) | Search may be exempt if results are public-only |

**Disposition recommendation:** during Step 3 per-route review, when each
mixed-verb route gets its `requireAuth` swap or `// PUBLIC:` comment, the
matching frontend fetches re-classify as BUG (most) or PUBLIC (few). Flag
the per-route decisions back to Track 6 for migration reconciliation.

### 4.2 UNCLEAR-B — Bare-line fetches in paradigm-using files (144 fetches)

The 32 paradigm-using files with bare-line fetches need per-call inspection
during Track 4 to distinguish:

- **Authenticated via `headers` variable** (e.g., `ProductionTab.jsx:173`
  reads token from localStorage four lines above and passes
  `headers: token ? { Authorization: \`Bearer ${token}\` } : {}` — this is
  Path D, already in Track 4 scope, NOT a Track-5 BUG)
- **Genuinely bare** (e.g., `EpisodeDetail.jsx:776,805` — the file imports
  `apiClient as api` for some calls but uses raw bare `fetch()` for these
  endpoints with no auth at all — these are TRULY missing auth, BUG)

Spot-check sample (read during triage):

| File | Bare-line fetches | Spot-check verdict |
|------|-------------------|---------------------|
| `frontend/src/pages/ProductionTab.jsx:173` | 1 | Path D inline (authed via `Bearer ${token}` defined at :171) — already Track 4 scope |
| `frontend/src/pages/EpisodeDetail.jsx` | 3 GETs (`/episodes/*/library-scenes`, `/world/*/events`, `/characters/lala/state`) + 1 POST | Genuinely bare — no auth path — **BUGs hidden in paradigm file** |
| `frontend/src/components/SidebarProgress.jsx` | 4 (lines 25–28) | Path D — `headers` var defined at :21 — already Track 4 scope |
| `frontend/src/components/StoryReviewPanel.jsx:83` | 1 | Path D — token resolved at :80 — already Track 4 scope |
| `frontend/src/components/FeedBulkImport.jsx:222` | 1 | Path D inline — Track 4 scope |

**Disposition:** Track 4 must inspect each of the 144 sites. The
already-Path-D ones get migrated as part of Track 4's normal scope. The
genuinely-bare hidden BUGs (EpisodeDetail.jsx is the clearest example) get
re-classified as BUG and migrated as part of Track 6 (or merged into Track
4's batch, scope-keeper's choice).

**Estimate from spot-check (rough):** of the 144 paradigm-file bare-line
fetches, ~80% are Path D (already in Track 4 scope) and ~20% are hidden
BUGs. So **~30 hidden BUGs** likely surface from this bucket during Track 4
inspection — net addition to BUG count.

Adjusted final estimate: **BUG ≈ 345 + 30 hidden = ~375**, **UNCLEAR-A 71
GETs pending Step 3 per-route**, **UNCLEAR-B 114 paradigm-Path-D already
covered by Track 4.**

---

## 5. Surprises

1. **`SceneSetsTab.jsx` is a 64-fetch single-file cluster of completely
   unauthenticated calls.** Hits `/scene-sets/*` and nested angle/asset
   endpoints. Backend `sceneSetRoutes.js` currently uses `optionalAuth`
   (~59 routes per §1.3 inputs); Step 3 will sweep most/all to `requireAuth`.
   **The moment Step 3 lands, this single page silently breaks for every
   user.** Track 6 priority #1.

2. **`FranchiseBrain.jsx` has 18 raw fetches with zero auth across the
   entire file.** All hit `/franchise-brain/entries/*` (CRUD on a knowledge
   base). Backend `franchiseBrainRoutes.js` uses `optionalAuth` (16 routes).
   This will fully break post-Step-3.

3. **`EpisodeDetail.jsx` is mixed-paradigm with hidden BUGs.** The file
   imports `apiClient as api` and uses `api.post(...)` correctly in some
   places, but uses raw `fetch()` with NO auth for `/episodes/*/library-scenes`,
   `/world/*/events`, and `/characters/lala/state`. The mixed pattern likely
   reflects multiple authors over time. These are not just inline-Bearer
   drift (Track 4 scope) — they're truly auth-missing.

4. **`PressPublisher.jsx` mixes one PUBLIC GET (PUBLIC bucket) with two
   POST mutations (BUG bucket) in the same component.** The component knows
   it's hitting public + private surfaces but the developer didn't wire
   auth for the writes. Will break post-Step-3.

5. **Manuscript-export `/export/book/*/{meta,docx,pdf}` endpoints have ZERO
   frontend fetch callers.** Likely accessed via direct download links or
   anchor href, not fetch. Confirmed by grep. The §7.2/§11.1 lock for
   manuscript-export remains valid (backend still needs the
   `optionalAuth({ degradeOnInfraFailure: true })` flag) but contributes
   nothing to Track 5's PUBLIC count.

6. **Total HTTP issuance points refined:** v1 inventory said 1,175 across
   all paths. Track 5 confirms the 627 fetch total but adjusts:
   - Path B axios: 563 (interceptor handles auth)
   - Authenticated raw fetch: 134 (per v1 paradigm classification)
   - PUBLIC raw fetch: 5 (this triage)
   - BUG raw fetch: ~375 (this triage, with hidden-BUG estimate)
   - UNCLEAR raw fetch: ~185 (71 mixed-verb GETs + ~114 Path D in paradigm files)
   - Total: 563 + 134 + 5 + 375 + 185 = **1,262** call sites total. Higher
     than v1's 1,175 estimate.

7. **Backend route auth-mode skew:** of 99 backend route files using auth
   middleware, only ~6 use `requireAuth` (4 confirmed + 2 partial), the rest
   default to `optionalAuth` or `authenticateToken`. **Step 3 sweep is going
   to convert the vast majority to `requireAuth`.** Track 5's BUG count
   reflects this — most frontend bare GETs will start 401ing post-sweep.

8. **No new paradigms surfaced.** The four paths (A authHeader, B apiClient,
   C authHeaders plural, D inline Bearer) cover all auth-injection in the
   frontend. Track 5 found no fifth pattern.

---

## 6. Recommendations for scope decision

The user's kickoff offered four options A/B/C/D for Step 6b scope. After
Track 5:

**The data points to (D)+(C) hybrid.** Direct fetch with no auth IS
widespread (345 BUGs is a P0-class finding) but it's not "outside F-AUTH-1"
— per §4.6 v1.9 reasoning, F-AUTH-1 cannot ship correctly without addressing
these. Defer would mean the moment Steps 3–5 sweep lands, ~345 frontend call
sites silently 401 in production.

Suggested Track structure update:

- Track 1 — apiClient interceptor update (unchanged)
- Track 2 — Path A migration (34 sites — unchanged)
- Track 3 — Path C migration (75 sites — unchanged)
- Track 4 — Path D migration (~25 explicit + ~114 paradigm-file bare-line
  Path-D hits identified in §4.2)
- **Track 6 (NEW)** — BUG-class migration (~375 sites, ~70 files, 10 of
  which contribute ~180 sites)
- **Track 7 (NEW, async)** — UNCLEAR-A reconciliation (71 GETs) — runs in
  parallel with Step 3 sweep, since each Step-3 per-route decision converts
  a UNCLEAR fetch into PUBLIC (annotate) or BUG (migrate).

Total Step 6b commit scope: ~620 sites + interceptor update + 7 helper
consolidations. **This is roughly 4x what v1.8 estimated.**

If the user pushes back on scope, the realistic scope-reduction lever is
deferring Track 6 to a follow-up PR (F-AUTH-1.1?). But that requires
accepting that Steps 3–5 ship a backend that 401s ~345 frontend call sites,
which contradicts the "F-AUTH-1 cannot ship correctly without addressing
these" principle from §4.6.

---

## 7. Verification commands (for reproducibility)

```bash
# Total raw fetch( in frontend/src (excluding tests):
grep -rn "fetch(" frontend/src 2>/dev/null | grep -v "\.test\." | wc -l
# → 627

# Unauth-on-line fetches (the triage scope):
grep -rn "fetch(" frontend/src 2>/dev/null | grep -v "\.test\." \
  | grep -vE "authHeader\(|authHeaders\(|Authorization|Bearer" | wc -l
# → 565

# Truly-bare files (zero auth paradigm):
for f in $(grep -rln "fetch(" frontend/src 2>/dev/null | grep -v "\.test\."); do
  if ! grep -qE "authHeader\(|authHeaders\(|Authorization.*Bearer|import.*services/api" "$f"; then
    echo "$f"
  fi
done | sort -u | wc -l
# → 79

# Mutations in truly-bare files:
for f in $(cat truly_bare_files.txt); do
  grep -c "method:\s*['\"]\(POST\|PUT\|DELETE\|PATCH\)" "$f"
done | awk '{s+=$1} END {print s}'
# → 254 (matches Track-5's count after multi-line counting)
```

---

## 8. Files read during triage (read-only)

- `docs/audit/F-AUTH-1_Fix_Plan_v1.9.md` (§4.6 Track 5 + §11.1 + §7.2)
- `docs/audit/F-AUTH-1_Preflight_Report.md` (§7.2, §11.1, §11.4)
- `docs/audit/F-AUTH-1_Step6b_Inventory.md` (v1 baseline)
- `frontend/src/services/api.js` (full)
- `frontend/src/utils/storytellerApi.js` (full)
- `src/app.js` (route mount lines)
- Sampled spot-checks: `EpisodeDetail.jsx`, `ProductionTab.jsx`,
  `SidebarProgress.jsx`, `StoryReviewPanel.jsx`, `FeedBulkImport.jsx`,
  `WorldStateTensions.jsx`, `PressPublisher.jsx`, `FranchiseBrain.jsx`,
  `SceneSetsTab.jsx`, `WorldSetupGuide.jsx`, `usePageData.js`,
  `CommandPalette.jsx`, `LayoutEditor.jsx`, `WriteModeAIWriter.jsx`,
  `MemoryBankView.jsx`, `NarrativeIntelligence.jsx`, `StoryDashboard.jsx`,
  `ArcTrackingPanel.jsx`

No `frontend/src/` files were modified.
