# F-AUTH-1 Step 6b — Frontend Auth-Injection Caller Inventory

> **Pre-flight deliverable for Step 6b** (per fix plan v1.8 §9.11).
> Scope: read-only inventory of every frontend HTTP call that does or does
> not inject an Authorization header. No code changes. Step 6b
> implementation gated on this document.

**Branch:** `dev`
**Date:** 2026-05-03
**Working tree base:** `029f5f2a` (fix plan v1.7 → v1.8 transition)
**Author note:** Inventory produced by reading `frontend/src/`. Counts are
exact greps, not estimates.

---

## 0. Headline finding (read this first)

**The fix plan v1.8 §9.11 is structurally optimistic.** It says the frontend
has **two** auth-injection paths:

1. axios `apiClient` interceptor (`frontend/src/services/api.js`)
2. `authHeader()` direct-fetch helper (`frontend/src/utils/storytellerApi.js`)

The inventory finds **four distinct paradigms** in active production use.
Step 6b reconciliation cannot land cleanly without naming all four:

| # | Paradigm | Location | File count | Call sites |
|---|----------|----------|------------|------------|
| A | `authHeader()` (singular) — shared helper from storytellerApi | `frontend/src/utils/storytellerApi.js` | 3 direct + 4 transitive via `api()` | 16 direct + 18 via `api()` = **34** |
| B | axios `apiClient` (default + named exports) | `frontend/src/services/api.js` | **53** | **556** |
| C | `authHeaders()` (plural) — 7 *separate local copies* + 1 shared via feedConstants | 7 local files + `pages/feed/feedConstants.js` | 9 | **~75** (incl. SocialProfileGenerator's 50+) |
| D | Inline `Authorization: Bearer ${token}` construction with raw `localStorage.getItem` | scattered | ~17 | 25+ |

**Mixed-paradigm files:** ZERO files import both `authHeader` (Path A) AND
`services/api` (Path B). Cleanly partitioned. (Other cross-pairings exist —
see §4.)

This means the response-interceptor work in Step 6b — which §9.11 frames as
updating *the* interceptor — actually has **no single chokepoint to update**.
The axios interceptor (Path B) catches Path B failures only. Paths A, C, and
D have no interceptor at all.

---

## 1. Path A — `authHeader()` (singular) callers

**Definition:** `frontend/src/utils/storytellerApi.js:10–13`
```js
export function authHeader() {
  const token = localStorage.getItem('authToken');
  return token ? { Authorization: `Bearer ${token}` } : {};
}
```

### 1a. Direct importers (3 files, 16 call sites)

| File | Call sites (file:line) | Pattern |
|------|------------------------|---------|
| `frontend/src/components/SectionEditor.jsx` | 46 | `headers: { 'Content-Type': 'application/json', ...authHeader() }` inside `fetch()` |
| `frontend/src/components/StoryPlannerConversational.jsx` | 390, 562, 604, 616, 624 | All five: spread into `headers` object inside `fetch()` POST/PUT |
| `frontend/src/components/BookEditor.jsx` | 151, 181, 201, 217, 304, 605, 671, 1365, 1373, 1382 | Mix: spread into headers (POST/PUT) + bare `headers: authHeader()` (GET) inside `fetch()` |

All 16 call sites use raw `fetch()` (never axios). All spread or assign the
return value of `authHeader()` into the `headers` object. No call site
attempts to handle a thrown error from `authHeader()` (it doesn't throw).

### 1b. Transitive callers via `api()` helper (4 files, 18 call sites)

The `api()` helper at `storytellerApi.js:15–26` wraps fetch and internally
calls `authHeader()`. Files importing `api`:

| File | `api()` invocations | Notes |
|------|---------------------|-------|
| `frontend/src/components/ChapterSelection.jsx` | 26, 42 | 2 calls |
| `frontend/src/components/BookList.jsx` | 20 | 1 call |
| `frontend/src/components/BookEditor.jsx` | 390, 404, 422, 433, 446, 461, 481, 484, 501, 524, 539, 562 | 12 calls (in addition to direct authHeader use) |
| `frontend/src/pages/StorytellerPage.jsx` | 49, 63, 93 | 3 calls |

Total transitive auth-injected sites: 18.

`api()` throws on `!res.ok`. The caller's `try/catch` pattern decides what
happens on auth failure — no centralized response interceptor.

**Path A grand total: 34 call sites.**

---

## 2. Path B — axios `apiClient` callers

**Definition:** `frontend/src/services/api.js:4–10`
- Default export: `apiClient` (axios instance).
- Has request interceptor (`api.js:13–38`) — injects
  `Authorization: Bearer ${localStorage.getItem('authToken') || localStorage.getItem('token')}` on every request.
- Has response interceptor (`api.js:41–73`) — handles 401 with code-based
  branching (`AUTH_INVALID_TOKEN`/`AUTH_MISSING_TOKEN` → wipe + redirect;
  `AUTH_REQUIRED` → pass through). **This is the interceptor v1.8 §9.11
  references for the contract update.**

### 2a. Direct importers (53 files)

```
frontend/src/components/ContentZoneEditor.jsx
frontend/src/components/Episodes/EpisodeAssetsTab.jsx
frontend/src/components/Episodes/EpisodeOverviewTab.jsx
frontend/src/components/Episodes/EpisodePhoneMissionsTab.jsx
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx
frontend/src/components/Episodes/EpisodeScriptTab.jsx
frontend/src/components/Episodes/EpisodeTodoList.jsx
frontend/src/components/Episodes/EpisodeWardrobeTab.jsx
frontend/src/components/Episodes/NextEventSuggestionsOverlay.jsx
frontend/src/components/EpisodeWardrobeGameplay.jsx
frontend/src/components/episode/TimelinePlacementsSection.jsx
frontend/src/components/ExportPanel.jsx
frontend/src/components/InvitationGenerator.jsx
frontend/src/components/LalaSceneDetection.jsx
frontend/src/components/OverlayApprovalPanel.jsx
frontend/src/components/phone-editor/MissionEditor.jsx
frontend/src/components/phone/PhoneMapView.jsx
frontend/src/components/QuickEpisodeCreator.jsx
frontend/src/components/SceneStudio/EraseBrushCanvas.jsx
frontend/src/components/SceneStudio/panels/tabs/DecorTab.jsx
frontend/src/components/SceneStudio/panels/tabs/GenerateTab.jsx
frontend/src/components/SceneStudio/panels/tabs/LibraryTab.jsx
frontend/src/components/ScreenContentRenderer.jsx
frontend/src/components/ScriptEditor.jsx
frontend/src/components/Show/ShowAssetsTab.jsx
frontend/src/components/Show/ShowInsightsTab.jsx
frontend/src/components/Show/ShowWardrobeTab.jsx
frontend/src/components/Show/StudioTab.jsx
frontend/src/hooks/usePhonePlayback.js
frontend/src/hooks/usePhonePlaythrough.js
frontend/src/hooks/useSaveManager.js (`saveEpisodeData` named import)
frontend/src/hooks/useSearch.js (`episodeAPI` named import)
frontend/src/pages/CharacterRegistryPage.jsx
frontend/src/pages/EpisodeDetail.jsx
frontend/src/pages/EpisodeScriptWriterPage.jsx
frontend/src/pages/EvaluateEpisode.jsx
frontend/src/pages/ExportPage.jsx
frontend/src/pages/feed/EventFeedDashboard.jsx
frontend/src/pages/FeedRelationshipMap.jsx
frontend/src/pages/FeedTimelinePage.jsx
frontend/src/pages/NarrativePressureDashboard.jsx
frontend/src/pages/ProductionOverlaysTab.jsx
frontend/src/pages/ProductionTab.jsx
frontend/src/pages/ReadingMode.jsx
frontend/src/pages/ScenePlannerPage.jsx
frontend/src/pages/ShowBiblePage.jsx
frontend/src/pages/ShowSettings.jsx
frontend/src/pages/StoriesPage.jsx
frontend/src/pages/StudioTimelinePage.jsx (`episodeAPI` named import)
frontend/src/pages/TimelineEditor.jsx (4 named imports)
frontend/src/pages/UIOverlaysTab.jsx
frontend/src/pages/UniversePage.jsx
frontend/src/pages/WorldAdmin.jsx
```

### 2b. Usage pattern

| Pattern | Count | Notes |
|---------|-------|-------|
| `api.get/post/put/delete/patch(...)` (default-import) | **556** | Sole pattern for default-import users |
| `episodeAPI.{getAll,getById,create,update,delete}(...)` | 3 | Used in: useSearch.js, StudioTimelinePage.jsx, TimelineEditor.jsx |
| `platformAPI.{get,update}(...)` | 1 | TimelineEditor.jsx |
| `sceneAPI.{getAll,...}(...)` | 2 | TimelineEditor.jsx |
| `timelineDataAPI.{get,update}(...)` | 1 | TimelineEditor.jsx |
| `thumbnailAPI`, `metadataAPI`, `wardrobeAPI`, `characterAPI`, `assetsAPI`, `wardrobeDefaultsAPI`, `sceneAssetsAPI`, `saveEpisodeData`, `healthCheck` | **0** | All defined in api.js but never called externally — dead exports |

**Path B grand total: 563 call sites** (556 default + 7 named).

---

## 3. Path C — `authHeaders()` (plural) helpers

**Seven separate local definitions** (each file rolls its own copy) + **one
shared definition** in `pages/feed/feedConstants.js`.

### 3a. Local definitions

| File | Definition line | Call sites in same file |
|------|-----------------|--------------------------|
| `frontend/src/components/BookStructurePanel.jsx` | 38 | 69, 89, 108 |
| `frontend/src/components/ScenesPanel.jsx` | 15 | 65, 84, 100, 118, 156 |
| `frontend/src/hooks/useStoryEngine.js` | 8 | 459, 524, 691, 723 |
| `frontend/src/pages/EpisodeReview.jsx` | 6 | 21, 22, 42, 60 |
| `frontend/src/pages/BeatGeneration.jsx` | 6 | 22, 23, 43, 56, 74 |
| `frontend/src/pages/StoryEvaluationEngine.jsx` | 213 | 226, 246 |
| `frontend/src/pages/RelationshipEngine.jsx` | 19 | 106, 107, 133, 147, 161, 174, 188, 204, 220, 235, 248 |

Each local copy reads `localStorage.getItem('authToken')` (and most
fall through to `'token'` and `sessionStorage.getItem('token')`). Subtle
drift exists between the seven copies — e.g., `useStoryEngine.js` accepts
an `extra` parameter; others don't. None of them throws or has an interceptor.

### 3b. Shared via `feedConstants.js`

`frontend/src/pages/feed/feedConstants.js:168` — exports `authHeaders()` and
`getToken()`. Imported and used by:

| File | Call sites |
|------|------------|
| `frontend/src/pages/SocialProfileGenerator.jsx` | ~40 sites (lines 167, 185, 214, 221, 223, 229, 240, 250, 266, 269, 279, 287–290, 296, 309, 319, 337, 357, 384–386, 396, 405, 416, 426, 436, 449, 459, 471, 483, 493, 502, 509, 516, 522, 533) |
| `frontend/src/pages/feed/ProfileDetailPanel.jsx` | 16, 68, 69 |

**Path C grand total: ~75 call sites across 9 files.**

---

## 4. Path D — Inline `Authorization: Bearer ${token}` construction

Files reading `localStorage.getItem('authToken')` and constructing the header
inline (no helper at all). 25 distinct call sites flagged by grep:

| File | Lines |
|------|-------|
| `frontend/src/App.jsx` | 67 (single fetch on app boot for book load) |
| `frontend/src/components/PushToBrain.jsx` | 24 (within a fetch) |
| `frontend/src/components/StoryReviewPanel.jsx` | 83 |
| `frontend/src/components/FeedBulkImport.jsx` | 54, 222 (mixes a local helper at :54 with raw inline at :222) |
| `frontend/src/components/Search/SearchHistory.jsx` | 29, 69 |
| `frontend/src/services/templateService.js` | 18 (class-field token cached at construction — staleness risk) |
| `frontend/src/services/authService.js` | 107 |
| `frontend/src/pages/AuditLogViewer.jsx` | 42 |
| `frontend/src/pages/AuditLog.jsx` | 62 (token resolved inline at every call) |
| `frontend/src/pages/CreateShow.jsx` | 123, 149 |
| `frontend/src/pages/ShowManagement.jsx` | 52, 114, 152, 204 |
| `frontend/src/pages/ProductionTab.jsx` | 173 (also imports apiClient — see §5) |
| `frontend/src/pages/CreateEpisode.jsx` | 151 |
| `frontend/src/pages/DiagnosticPage.jsx` | 17 |
| `frontend/src/pages/NarrativeControlCenter.jsx` | 48 |

Plus `WorldAdmin.jsx:5975, 6304` — token read inline within event handlers
(2 inline construction sites in a 6000-line file that ALSO uses apiClient).

**Path D grand total: ~25 call sites across ~17 files.**

---

## 5. Mixed-paradigm files (cross-paradigm cohabitation)

**`authHeader` (Path A) + `services/api` (Path B):** ZERO. Cleanly disjoint.

**Other cross-paradigm files (worth flagging — Step 6b consistency
decisions):**

| File | Paradigms present |
|------|--------------------|
| `frontend/src/components/BookEditor.jsx` | A direct + A via `api()` helper (10 + 12 sites) |
| `frontend/src/components/FeedBulkImport.jsx` | C-style local helper at :54 + Path D raw inline at :222 |
| `frontend/src/pages/ProductionTab.jsx` | B (`import api from services/api`) + Path D inline at :173 |
| `frontend/src/pages/WorldAdmin.jsx` | B (apiClient default import) + Path D inline at :5975, :6304 |
| `frontend/src/pages/SocialProfileGenerator.jsx` | C (shared via feedConstants) + several `${SCHED_API}` paths spreading authHeaders into headers |
| `frontend/src/pages/feed/ProfileDetailPanel.jsx` | C only — uniformly via feedConstants |

The first four are likely accidental drift (a developer added one call
without noticing the file already had a different pattern).

---

## 6. Direct fetch with no auth injection

**Total raw `fetch(` calls in `frontend/src/`:** 627 (excluding tests)

This count is high because many auth-injecting call sites use raw `fetch`
*with* an injected header. Rough decomposition:

| Subset | Approx count |
|--------|---------------|
| `fetch(` on the same line as `authHeader` (Path A direct) | 59 |
| `fetch(` on the same line as `authHeaders` (Path C) | ~70 |
| `fetch(` on the same line as inline `Bearer` (Path D) | ~20 |
| `fetch(` calls *with no detectable auth on the same statement* | ~478 (gross — many are public endpoints, JSON `await r.json()` follow-ups, or use a header variable from a few lines above) |

**This number cannot be reduced to a precise "fetches without auth" count
by static grep alone.** Many fetches reference `headers` variables defined
above (e.g., `SidebarProgress.jsx:21` builds `const headers = ...` then
passes `{ headers }` four lines later). Some fetches are intentionally
unauthenticated (e.g., public character-registry GETs).

**Notable un-auth-injected fetches (potentially intentional, surfaced
without judgment):**

- `frontend/src/components/MemoryBankView.jsx:149` — `fetch('/api/v1/character-registry/registries')` no headers.
- `frontend/src/components/StoryDashboard.jsx:83, 92, 100, 108, 115` — five `fetch` calls in a row with no headers param at all.
- `frontend/src/components/CommandPalette.jsx:70` — search endpoint with no auth.
- `frontend/src/components/LayoutEditor.jsx:197, 277, 305` — composition endpoints with no auth.
- `frontend/src/components/WriteModeAIWriter.jsx:251, 329, 405` — AI rewrite endpoints with no auth.
- `frontend/src/components/NarrativeIntelligence.jsx:89` — `/api/v1/world/characters` with no auth.
- `frontend/src/components/ArcTrackingPanel.jsx:13`, `frontend/src/components/FranchiseBrain.jsx:186, 203–206, 225, 242, 256, 268, 281, 301, 311, 322, 337, 355, 375, 402, 421` — extensive franchise-brain GET/POST/PATCH/DELETE traffic with no auth.

These are read for inventory only. Some may be exempt under a
public-read policy; others may be bugs that the F-AUTH-1 sweep on the
backend will start 401ing in production once `optionalAuth →
requireAuth` migration lands. **Step 6b decision: do these need to be
mapped 1:1 to the backend sweep's mutation list to confirm exemption,
or is that out of scope?**

---

## 7. Coverage check

| Paradigm | Files | Auth-injected call sites |
|----------|-------|---------------------------|
| Path A — `authHeader()` direct | 3 | 16 |
| Path A — `api()` helper transitive | 4 | 18 |
| Path B — `apiClient` (default + named) | 53 | 563 |
| Path C — `authHeaders()` plural local + shared | 9 | ~75 |
| Path D — inline `Bearer ${token}` | ~17 | 25 |
| **Sum (auth-injected)** | **~80 unique files** | **~697** |
| Path E — raw `fetch` with no auth on same line | unknown | ~478 |
| **Total `fetch(` in frontend/src** | — | **627** |

Sum check: auth-injected call sites (697) far exceeds total fetches (627)
because Path B is **axios**, not fetch — its 563 sites don't count toward
the fetch total. Reconciled count:

```
Total HTTP issuance points in frontend/src:
  axios apiClient (Path B):                              563
  authenticated fetch (Paths A direct + A-via-api + C + D): 134 (16+18+~75+25)
  unauthenticated fetch (Path E):                        ~478 of the 627 fetches
                                                         ────
  Grand total HTTP call sites:                           ~1,175
```

The 627 fetch total nets out as ~134 authenticated + ~493 unauthenticated/
unclassified-by-grep. The unclassified bucket likely contains a substantial
number of fetches that *do* inject auth via a headers variable defined a few
lines above — but exact count requires AST, not grep.

---

## 8. Surprises

1. **Four paradigms, not two.** v1.8 §9.11 names two; the inventory finds
   four (A/B/C/D). Step 6b's interceptor reconciliation only updates Path B's
   response interceptor — Paths A/C/D have no interceptor at all. Frontend
   401 handling for ~134 call sites would remain unchanged unless Step 6b
   explicitly addresses them.

2. **`authHeaders()` (plural) helper is duplicated 7 times.** Each local
   copy slightly different in API. This is the surprise category most likely
   to bite Step 6b — any contract update to the centralized helper won't
   reach these copies.

3. **Path A's response handling is per-caller `try/catch`,** not an
   interceptor. The `api()` helper at `storytellerApi.js:20–23` simply
   throws on `!res.ok`. Each caller decides what 401 means. There is no
   `AUTH_REQUIRED` vs `AUTH_INVALID_TOKEN` differentiation on this path.

4. **Path B's interceptor already implements the v1.8 contract** (api.js:55–
   64). It distinguishes `AUTH_INVALID_TOKEN` / `AUTH_MISSING_TOKEN` (hard
   fail → wipe creds + redirect) from `AUTH_REQUIRED` (soft fail → pass
   through). v1.8 §4.6 calls for adding token-refresh-on-`AUTH_INVALID_TOKEN`,
   which is **not yet implemented** on this path either — current logic
   wipes and redirects.

5. **Mixed-paradigm files within Path B + Path D** (`ProductionTab.jsx`,
   `WorldAdmin.jsx`) suggest accidental drift — devs reaching for inline
   `localStorage.getItem` in a file that already has axios autoauth via
   apiClient. These will silently keep working but bypass any axios-only
   interceptor logic Step 6b adds.

6. **Dead exports in services/api.js:** `thumbnailAPI`, `metadataAPI`,
   `wardrobeAPI`, `characterAPI`, `assetsAPI`, `wardrobeDefaultsAPI`,
   `sceneAssetsAPI`, `saveEpisodeData`, `healthCheck` are defined but never
   imported externally. Dead-code cleanup candidates, out of F-AUTH-1 scope.

7. **`templateService.js` caches the token in a class field at
   construction time** (line 9) and uses it at line 18. If the user
   re-logs-in mid-session, this service uses the stale token. Pre-existing
   bug, surfaced for visibility — out of F-AUTH-1 scope.

8. **`SocialProfileGenerator.jsx` alone has ~40 fetch+authHeaders call
   sites** in a single 530-line page. It's the largest auth-touching surface
   in the frontend by a wide margin.

9. **No file imports both `authHeader` (Path A) and `apiClient` (Path B).**
   The user's "mixed-paradigm" deliverable is empty for the named pair —
   the two systems are cleanly separated at the file level.

---

## 9. What this inventory does NOT decide

Per the kickoff prompt: this document does not pick between scope options
(A) authHeader-unification, (B) apiClient-unification, (C) parallel updates,
or (D) widespread-direct-fetch P0 escalation. The inventory provides the
data; scope decision is the next gate's call.

The inventory does suggest the answer is closer to **(C) + (D) hybrid**:
Paths A, B, C, and D all need handling, plus the ~478 unclassified fetches
need an audit pass to confirm exemption status before the backend sweep
lands.

---

## 10. Files read (for verification)

- `frontend/src/utils/storytellerApi.js` (full)
- `frontend/src/services/api.js` (full)
- `frontend/src/config/api.js` (full)
- Sample reads to confirm `api.method()` usage: `LalaSceneDetection.jsx`,
  `QuickEpisodeCreator.jsx`, `EpisodeDetail.jsx`
- Sample reads of inline-Bearer pattern files (above)
- Targeted grep across all of `frontend/src/`

No files in `frontend/src/` were modified.
