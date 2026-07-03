# Frontend IA Inventory — Part 2: Component Existence Matrix
**Date**: 2026-07-03  
**Commit**: `c92abb56` (origin/main; frontend/src byte-identical at current main `670f3962` — only docs/audit changed between them). Nav-reference grep for /relationships run at 670f3962.  
**Method**: `git ls-tree --name-only origin/main:frontend/src/pages` + `git ls-tree --name-only origin/main:frontend/src/pages/feed` + lazy-import list from Part 1 + `BookToWriteRedirect` inline confirmation (App.jsx:62)  
**Depends on**: Part 1 (route table, `Frontend_IA_Inventory_Part1_Routes_2026-07-03.md`)  
**Author**: GitHub Copilot + operator  
**Scope**: Inventory only. No files changed, no removals executed. Path A.

---

## 1. Overview

Four-quadrant matrix of route status vs. file existence at `c92abb56`:

| Quadrant | Definition | Count |
|----------|-----------|-------|
| **Q1 — Nominal** | Live route + file exists | **100** |
| **Q2 — Ghost Import** | Imported in App.jsx, route redirects away, file still exists | **5** |
| **Q3 — Broken** | Live route + file missing | **0** — no broken routes |
| **Q4 — Orphan** | File exists, no live route and not a ghost import | **18** in pages/ (SocialImport counted once, in the tab/panel list; prior 19 double-counted it), **4** in feed/ |

Special cases outside the quadrant (handled separately):
- `BookToWriteRedirect` — live route, inline component (App.jsx:62), no pages/ file by design
- `QuickEpisodeCreator` — live route, lives in `./components/` not `./pages/`
- `EventFeedDashboard` — live route, lives in `./pages/feed/` (subdirectory)

---

## 2. Q1 — Nominal (Live Route + File Exists)

All 100 live-routed page components have confirmed files at `c92abb56`. No broken routes.

**Nominal with noted anomaly (from Part 1 F-8 — const/file name mismatch):**

| Route const name | Actual file |
|-----------------|------------|
| `CharacterProfile` | `CharacterProfilePage.jsx` |
| `SocialSystemsPage` | `SocialSystems.jsx` |

Both load correctly at runtime (lazy resolves the file, not the const). Listed for refactor awareness.

**Nominal outside pages/ (not in flat pages/ listing by design):**

| Component | Actual location |
|-----------|----------------|
| `BookToWriteRedirect` | Inline, App.jsx:62 — no pages/ file |
| `QuickEpisodeCreator` | `./components/QuickEpisodeCreator.jsx` |
| `EventFeedDashboard` | `./pages/feed/EventFeedDashboard.jsx` |

---

## 3. Q2 — Ghost Imports (Imported in App.jsx, Route Redirects Away, File Exists)

Five components are lazily imported into App.jsx, code-split onto the bundle, and have files on disk — but every declared route pointing to them has been replaced with a `Navigate` redirect. They can never be rendered through routing.

| Component | File(s) in pages/ | Route declared | Redirects to | Has test? |
|-----------|------------------|----------------|-------------|-----------|
| `StorytellerPage` | `StorytellerPage.jsx`, `StorytellerPage.css` | `/storyteller` | `/stories` | No |
| `StoryEngine` | `StoryEngine.jsx`, `StoryEngine.css`, `StoryEngine.test.jsx` | `/story-engine` | `/stories` | **Yes** |
| `FranchiseBrainPage` | `FranchiseBrainPage.jsx` | `/intelligence/franchise-brain`, `/franchise-brain` | `/show-bible` chain | No |
| `ShowBrain` | `ShowBrain.jsx`, `ShowBrain.css` | `/show-brain`, `/intelligence/show-brain` | `/show-bible` chain | No |
| `CharacterGenerator` | `CharacterGenerator.jsx`, `CharacterGenerator.css`, `CharacterGenerator.test.jsx` | `/character-generator` | `/world-studio` | **Yes** |

`StoryEngine.test.jsx` and `CharacterGenerator.test.jsx` are running against components that cannot be reached via routing. The tests may pass in isolation but exercise unreachable code paths.

---

## 4. Q3 — Broken Routes (Live Route + File Missing)

**None.** Every live-rendered route in Part 1 has a confirmed backing file. No runtime lazy-load failures expected from missing files.

---

## 5. Q4 — Orphan Pages (File Exists, No Live Route)

### 5a. Tab / Panel / Modal Components in pages/ (10 files)

These files exist in `pages/` but are not imported in App.jsx — they are embedded by other page components as tabs, panels, or modals. Their presence in `pages/` rather than `components/` is the **directory-truth drift finding** (F-2-3 below).

| File | Has CSS | Has test | Likely parent |
|------|---------|----------|--------------|
| `ArcGenerationStatus.jsx` | No | No | Unknown — possibly StoryEngine/StoryProposer |
| `InvitationGenerator.jsx` | No | No | Unknown |
| `NewBookModal.jsx` | No | Yes | StoriesPage or similar (modal pattern) |
| `ProductionOverlaysTab.jsx` | Yes | No | UniverseProductionPage (tab) |
| `ProductionTab.jsx` | Yes | No | UniverseProductionPage (tab) |
| `SceneSetsTab.jsx` | Yes | Yes | WorldAdmin (tab — **P0 finding file from F-Sec-3, line refs :2280/:2708**) |
| `ScenesPanel.jsx` | No | Yes | WorldAdmin or SceneLibrary (panel) |
| `StoryInspector.jsx` | No | Yes | StoriesPage or NarrativeControlCenter |
| `StoryNavigator.jsx` | No | No | StoriesPage or ChapterJourney |
| `SocialImport.jsx` | Yes | Yes | Unknown — possible legacy duplicate of `UniverseSocialImportPage` |

**`SocialImport.jsx` note**: The route `/social-import` navigates to `/universe/social-import`, which renders `UniverseSocialImportPage`. `SocialImport.jsx` is a distinct file and may be an older implementation or a tab-embedded variant. Not imported by App.jsx at all. Classify as legacy/orphan pending Part 3 grep.

### 5b. Wardrobe Survivor

The 7 wardrobe-killed routes (Part 1 F-2) navigate to `/`. The `OutfitCalendar` component (the one surviving wardrobe live route) has its file present. No wardrobe page files are missing — the tombstoning was done at the route level, not by file deletion.

### 5c. RelationshipEngine (Scheduled Deletion — Exists Now, Route Live)

`RelationshipEngine.jsx`, `RelationshipEngine.css`, `RelationshipEngine.test.jsx` all exist at `c92abb56`. The route `/relationships` is a live route rendering this component. A VS Code workspace task `"Remove old RelationshipEngine"` is defined.

**This is not a Q4 orphan** — the route is live. It is a **pending-removal** entry: the file exists, the route is live, and a deletion task is queued. Treated separately in Section 7 (Coupled-Removal Plan).

### 5d. Orphan CSS Files (No Matching .jsx)

Two stylesheet files in pages/ have no corresponding component file:

| File | Likely former component |
|------|------------------------|
| `StudioPickerPage.css` | `StudioPickerPage.jsx` — deleted, CSS left behind |
| `Shows.css` | `Shows.jsx` — deleted or never existed; `ShowManagement.jsx` / `ShowDetail.jsx` are the live show pages |

---

## 6. feed/ Subdirectory Analysis

The `feed/` subdirectory contains one routed component and four sub-components:

| File | Type | Routed? | Notes |
|------|------|---------|-------|
| `EventFeedDashboard.jsx` | Page | Yes — `/shows/:showId/feed-dashboard` | Only routed file in feed/ |
| `EventFeedDashboard.css` | Stylesheet | — | Paired with routed component |
| `FeedEnhancements.jsx` | Sub-component | No | Embedded in EventFeedDashboard |
| `FeedViews.jsx` | Sub-component | No | Embedded in EventFeedDashboard |
| `ProfileCard.jsx` | Sub-component | No | Embedded in EventFeedDashboard |
| `ProfileDetailPanel.jsx` | Sub-component | No | Embedded in EventFeedDashboard |
| `ProfileDetailPanel.test.jsx` | Test | — | Tests a non-routed sub-component |
| `FeedEnhancements.test.jsx` | Test | — | Tests a non-routed sub-component |
| `feedConstants.js` | Constants | — | See F-2-5 |

`FeedTimelinePage.jsx` (routed at `/shows/:showId/feed-timeline`) lives in the flat pages/ root, not in feed/ — the sibling feed pages are split across two locations.

---

## 7. Coupled-Removal Plan: RelationshipEngine

**Status**: PLANNED, NOT EXECUTED. File exists at `c92abb56`. Route is live. No removal has occurred.

**OI-2 resolution**: Confirmed. RelationshipEngine.jsx + .css + .test.jsx all exist. The coupled-removal plan is complete and ready to execute as a standalone PR when approved.

**Files to remove in one atomic PR:**

| Action | Target |
|--------|--------|
| Delete file | `frontend/src/pages/RelationshipEngine.jsx` |
| Delete file | `frontend/src/pages/RelationshipEngine.css` |
| Delete file | `frontend/src/pages/RelationshipEngine.test.jsx` |
| Remove import | App.jsx — `const RelationshipEngine = lazy(() => import('./pages/RelationshipEngine'));` |
| Remove route | App.jsx:427 — `<Route path="/relationships" element={<RelationshipEngine />} />` (grep-confirmed) |
| Remove title-map entry | App.jsx:592 — `'/relationships': 'Relationship Engine'` |
| Remove or repoint button | WorldStudio.jsx:1692 — `navigate('/relationships')` (UX decision owed at execution) |

**Execution order**: Delete files first (or simultaneously), then remove import and route declaration from App.jsx in a single edit. No migration, no data change, no backend dependency. Safe to run any session — does not require box access or Phase B gate.

**Risk**: LOW, NOT zero — a live-reference grep (670f3962) found two in-app references beyond the route: WorldStudio.jsx:1692 carries a live button `navigate('/relationships')`, and App.jsx:592 maps '/relationships' in a route-title object. The removal plan therefore has SEVEN artifacts, not five: the three files, the lazy import, the route (App.jsx:427, grep-confirmed), the App.jsx:592 title-map entry, and the WorldStudio.jsx:1692 button (remove or repoint — UX decision owed at execution time). RelationshipEngine.jsx owns 11 API call sites (:27-47); backend route disposition is out of scope here. Test coverage loss is intentional.

---

## 8. Findings

### F-2-1: Zero Broken Routes
No live route in Part 1 references a missing file. Q3 is empty. Bundle will not throw at lazy-load time due to a missing page file.

### F-2-2: Two Ghost Imports with Active Tests
`StoryEngine.test.jsx` and `CharacterGenerator.test.jsx` run against components that are not reachable through routing. Test suite is exercising unreachable code. Five ghost import page files total (CharacterGenerator, FranchiseBrainPage, ShowBrain, StoryEngine, StorytellerPage) occupy bundle chunk slots that can never be loaded.

### F-2-3: Directory-Truth Drift — Tab/Panel/Modal Files in pages/
10 files in pages/ are not page-level components (they are tabs, panels, or modals embedded in parent pages). pages/ is acting as a general component dump. The specific P0-relevant member is `SceneSetsTab.jsx` — the file containing the character_state write sites from F-Sec-3.

### F-2-4: SocialImport — Possible Duplicate Implementation
`SocialImport.jsx` (+ .css, .test.jsx) exists in pages/ and is not imported anywhere in App.jsx. The social import route redirects to `UniverseSocialImportPage`, which is a different component. `SocialImport` may be a legacy or parallel implementation. Requires a grep against all files before classifying as safe to delete (Part 3 open item OI-6).

### F-2-5: Two Constants Files in pages/
`storyEngineConstants.js` (pages/) and `feedConstants.js` (pages/feed/) are non-component files living inside the pages directory. These are prime suspects for hardcoded canonical values (character keys, city names, etc.) and are the OI-4 target for Part 3.

### F-2-6: Two Orphan CSS Files
`StudioPickerPage.css` and `Shows.css` have no matching .jsx. Former components were deleted without removing their stylesheets.

### F-2-7: feed/ Sub-component Scatter
`FeedEnhancements`, `FeedViews`, `ProfileCard`, `ProfileDetailPanel` live in pages/feed/ but are sub-components of EventFeedDashboard, not routable pages. They follow the same directory-truth drift pattern as F-2-3, but within a subdirectory. `feedConstants.js` compounds this by adding a data file to the same location.

### F-2-8: FeedTimelinePage / EventFeedDashboard Split Location
The two primary feed pages are in different locations: `FeedTimelinePage.jsx` is in pages/ root; `EventFeedDashboard.jsx` is in pages/feed/. Both are routed under `/shows/:showId/`. Inconsistent co-location for the same feature cluster.

---

## 9. Open Items for Part 3

| ID | Item | Source |
|----|------|--------|
| OI-3 | Grep `frontend/src/services/` for evaluation.js endpoint call sites | Part 1 open, F-Sec-3 inventory item #3 |
| OI-4 | Scan `storyEngineConstants.js`, `feedConstants.js`, `frontend/src/constants/`, `frontend/src/data/` for hardcoded `'justawoman'`, `'lala'`, DREAM cities, canonical values | Part 1 + Part 2 F-2-5 |
| OI-6 | Grep all files for `SocialImport` import — confirm orphan status before any deletion plan | Part 2 F-2-4 |
| OI-7 | Grep all files for ghost import components (`StorytellerPage`, `StoryEngine`, `FranchiseBrainPage`, `ShowBrain`, `CharacterGenerator`) outside App.jsx — confirm no non-route call sites before any deletion plan | Part 1 OI-1 (half-open) |
| OI-8 | Locate ArcGenerationStatus and InvitationGenerator parent components — determine if they are live-embedded or fully dead | Part 2 F-2-3 |

---

## 10. Summary

| Stat | Value |
|------|-------|
| Total .jsx files in pages/ (flat) | 107 |
| Total .jsx files in pages/feed/ | 6 |
| Live-routed page files (Q1 nominal) | 100 |
| Ghost imports (Q2) | 5 |
| Broken routes (Q3) | **0** |
| Orphan files in pages/ (Q4) | 18 (10 tabs/panels/modals incl. SocialImport + 5 ghost import files + 2 CSS orphans + `storyEngineConstants.js`) |
| Orphan files in pages/feed/ (Q4) | 4 sub-components + `feedConstants.js` |
| Pending coupled-removal (RelationshipEngine) | 5 files/changes, plan complete, not executed |
| Ghost imports with active tests | 2 (StoryEngine, CharacterGenerator) |
| Constants files in pages/ tree | 2 (`storyEngineConstants.js`, `feedConstants.js`) |
| Orphan CSS files | 2 (`StudioPickerPage.css`, `Shows.css`) |

Structural health: routing is clean (Q3 = 0), the main surface area concerns are directory-truth drift (tabs/panels living in pages/) and five ghost imports consuming bundle chunk budget.

---

*Grounded at `c92abb56`. Inventory only — no files changed.*
