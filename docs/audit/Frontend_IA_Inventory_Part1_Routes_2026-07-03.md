# Frontend IA Inventory — Part 1: Route Table
**Date**: 2026-07-03  
**Commit**: `c92abb56` (origin/main, post-PR #888 merge)  
**Method**: `git grep -n "<Route" origin/main -- frontend/src/App.jsx` + `git show origin/main:frontend/src/App.jsx | Select-String -Pattern "lazy\("` + `BookToWriteRedirect` inline confirmation  
**Author**: GitHub Copilot + operator  
**Scope**: Inventory only. No route changes, no redesign proposals. Path A.

---

## 1. Structural Overview

### 1.1 Routing Architecture

App.jsx is the single authoritative router. No other file declares live routes.

**AmberCommandCenter.jsx classification**: The 1 match in that file is a **comment** (lines 2 and 9: `// Route: /amber ...`). False positive on the pattern. No stray route file.

**Two-block structure** (React Router v6 `<Routes>`, both inside a single `<BrowserRouter>`):

| Block | Lines | Auth state | Routes |
|-------|-------|-----------|--------|
| Unauthenticated | 261–264 | Pre-auth / fallback | 3 |
| Authenticated | 301–550 | Post-auth (layout shell) | 123 |

The `<Router>` itself is at line 669 — it wraps both blocks. The two `<Routes>` blocks (261, 301) are rendered conditionally based on auth state, not nested within each other.

### 1.2 Route Count Reality Check

| Type | Count |
|------|-------|
| Total `<Route path=` declarations | **126** |
| — Unauthenticated block | 3 |
| — Authenticated block | 123 |
| Live-render routes (component rendered) | **105** |
| Navigate redirects (total) | **21** |
| — Wardrobe-killed (→ `/`) | 7 |
| — Semantic path aliases (→ canonical path) | 11 |
| — System guards (catch-all + auth inversion) | 3 |

**129 grep matches** explained: 126 `<Route path=` + 2 `<Routes>` containers (lines 261, 301) + 1 `<Router>` (line 669) = 129. Consistent.

---

## 2. Full Route Table

Columns: `path` | `component` | `group` | `type` | `notes`

### A. Auth Gate (Unauthenticated Block)

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/` | `LandingPage` | auth-gate | live | Pre-auth landing |
| `/login` | `Login` | auth-gate | live | Auth form |
| `*` | Navigate → `/` | auth-gate | guard | Unauthenticated catch-all |

### B. Core (Authenticated)

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/` | `Home` | core | live | Post-auth dashboard |
| `/start` | `SessionStart` | core | live | Session entry screen |

### C. Universe Hub

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/universe` | `UniversePage` | universe | live | |
| `/universe/social-import` | `UniverseSocialImportPage` | universe | live | |
| `/universe/series` | `SeriesPage` | universe | live | |
| `/universe/production` | `UniverseProductionPage` | universe | live | Canonical episodes index |
| `/universe/wardrobe` | Navigate → `/` | universe | killed | Wardrobe removed |
| `/universe/assets` | `UniverseAssetsPage` | universe | live | |
| `/universe/world-state` | `UniverseWorldStatePage` | universe | live | |
| `/universe/tensions` | `UniverseTensionsPage` | universe | live | |
| `/universe/story-dashboard` | `StoryDashboardPage` | universe | live | |
| `/universe/knowledge` | Navigate → `/show-bible` | universe | redirect | Alias |
| `/universe/writing-rhythm` | `WritingRhythmPage` | universe | live | |
| `/show-bible` | `ShowBiblePage` | universe | live | Canonical knowledge hub |
| `/intelligence/franchise-brain` | Navigate → `/show-bible?tab=decisions` | universe | redirect | No live `/intelligence/*` parent |
| `/intelligence/show-brain` | Navigate → `/show-bible?tab=knowledge` | universe | redirect | No live `/intelligence/*` parent |

### D. Episodes

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/episodes` | Navigate → `/universe/production` | episodes | redirect | |
| `/episodes/create` | `CreateEpisode` | episodes | live | |
| `/episodes/:episodeId/edit` | `QuickEpisodeCreator` | episodes | live | Param `:episodeId`; dual-routed component |
| `/episodes/:id/evaluate` | `EvaluateEpisode` | episodes | live | **Param `:id` — inconsistent with sibling `:episodeId`** |
| `/episodes/:episodeId/todo` | `EpisodeTodoPage` | episodes | live | |
| `/episodes/:episodeId` | `EpisodeDetail` | episodes | live | |
| `/episodes/:episodeId/plan` | `ScenePlannerPage` | episodes | live | |
| `/episodes/:episodeId/script-writer` | `EpisodeScriptWriterPage` | episodes | live | |
| `/episodes/:episodeId/beats` | `BeatGeneration` | episodes | live | |
| `/episodes/:episodeId/timeline` | `TimelineEditor` | episodes | live | |
| `/episodes/:episodeId/icon-cues` | `IconCueTimeline` | episodes | live | |
| `/episodes/:episodeId/composer` | `TemplateStudio` | episodes | live | Dual-routed component |
| `/episodes/:episodeId/export` | `ExportPage` | episodes | live | |
| `/episodes/:episodeId/review` | `EpisodeReview` | episodes | live | |

### E. Shows

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/shows` | `ShowManagement` | shows | live | |
| `/shows/create` | `CreateShow` | shows | live | |
| `/shows/:id` | `ShowDetail` | shows | live | |
| `/shows/:id/edit` | `EditShow` | shows | live | |
| `/shows/:id/world` | `WorldAdmin` | shows | live | |
| `/shows/:showId/quick-episode` | `QuickEpisodeCreator` | shows | live | Dual-routed; param `:showId` vs sibling `:id` |
| `/shows/:id/settings` | `ShowSettings` | shows | live | |
| `/shows/:showId/feed-timeline` | `FeedTimelinePage` | shows | live | Param `:showId` |
| `/shows/:showId/feed-dashboard` | `EventFeedDashboard` | shows | live | Param `:showId` |

### F. Studio

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/studio/timeline` | `StudioTimelinePage` | studio | live | |
| `/studio/scene/:sceneId` | `SceneStudioPage` | studio | live | Dual-routed component |
| `/studio/scene-set/:sceneSetId` | `SceneStudioPage` | studio | live | Dual-routed component |

### G. Scene System

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/scene-library` | `SceneLibrary` | scene | live | |
| `/scene-library/:sceneId` | `SceneDetail` | scene | live | |
| `/phone-hub` | `UIOverlaysTab` | scene | live | |
| `/scene-studio` | `SceneStudio` | scene | live | Distinct from `SceneStudioPage` |

### H. Assets

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/assets` | `AssetLibrary` | assets | live | |

### I. Wardrobe (Mostly Dead)

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/wardrobe` | Navigate → `/` | wardrobe | killed | |
| `/wardrobe/analytics` | Navigate → `/` | wardrobe | killed | |
| `/wardrobe/outfits` | Navigate → `/` | wardrobe | killed | |
| `/wardrobe/calendar` | `OutfitCalendar` | wardrobe | live | Only surviving wardrobe route |
| `/wardrobe-library` | Navigate → `/` | wardrobe | killed | |
| `/wardrobe-library/upload` | Navigate → `/` | wardrobe | killed | |
| `/wardrobe-library/:id` | Navigate → `/` | wardrobe | killed | |

### J. Template & Composition

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/template-studio` | `TemplateStudio` | template | live | Dual-routed component |
| `/template-studio/designer` | `TemplateDesigner` | template | live | Dual-routed component |
| `/template-studio/designer/:templateId` | `TemplateDesigner` | template | live | Dual-routed component |
| `/library` | `CompositionLibrary` | template | live | |
| `/compositions/:id` | `CompositionDetail` | template | live | |
| `/admin/templates` | `TemplateManagement` | template | live | Admin sub-path |
| `/thumbnails/:episodeId` | `ThumbnailGallery` | template | live | |

### K. Stories & Writing

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/stories` | `StoriesPage` | stories | live | Canonical story index |
| `/storyteller` | Navigate → `/stories` | stories | redirect | Ghost import: `StorytellerPage` imported, never rendered |
| `/story-engine` | Navigate → `/stories` | stories | redirect | Ghost import: `StoryEngine` imported, never rendered |
| `/book/:id` | `BookToWriteRedirect` | stories | live | **Inline component** (App.jsx:62) — only inline-as-route in file |
| `/books/:bookId/read` | `ReadingMode` | stories | live | |
| `/chapter/:bookId/:chapterId` | `ChapterJourney` | stories | live | |
| `/write/:bookId/:chapterId` | `WriteMode` | stories | live | Primary WriteMode entry |
| `/chapter-structure/:bookId/:chapterId` | `ChapterStructureEditor` | stories | live | |

### L. Character

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/character-registry` | `CharacterRegistryPage` | character | live | |
| `/character/:id` | `CharacterProfile` | character | live | Lazy: `./pages/CharacterProfilePage` (file name differs from const name) |
| `/character-generator` | Navigate → `/world-studio` | character | redirect | Ghost import: `CharacterGenerator` imported, never rendered |
| `/setup` | `SetupWizard` | character | live | |
| `/therapy/:registryId` | `CharacterTherapy` | character | live | |

### M. World-Building

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/world-dashboard` | `WorldDashboard` | world | live | |
| `/world-foundation` | `WorldFoundation` | world | live | |
| `/world-studio` | `WorldStudio` | world | live | Redirect target for `/character-generator` |
| `/world-setup` | `WorldSetupGuide` | world | live | |
| `/world-locations` | `WorldLocations` | world | live | |
| `/world-infrastructure` | `WorldInfrastructure` | world | live | |
| `/world` | Navigate → `/character-registry?view=world` | world | redirect | |
| `/cultural-calendar` | `CulturalCalendar` | world | live | |
| `/cultural-memory` | `CulturalMemory` | world | live | |
| `/culture-events` | `CultureEvents` | world | live | |
| `/social-systems` | `SocialSystemsPage` | world | live | Lazy: `./pages/SocialSystems` (file name differs from const name) |
| `/social-timeline` | `SocialTimeline` | world | live | |
| `/social-personality` | `SocialPersonality` | world | live | |
| `/property-manager` | `PropertyManager` | world | live | |
| `/influencer-systems` | `InfluencerSystems` | world | live | |
| `/character-life-simulation` | `CharacterLifeSimulation` | world | live | |
| `/character-depth-engine` | `CharacterDepthEngine` | world | live | |

### N. Continuity & Relationships

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/continuity` | `ContinuityEnginePage` | continuity | live | |
| `/relationships` | `RelationshipEngine` | continuity | live | **Workspace task scheduled: "Remove old RelationshipEngine"** |

### O. Narrative Tools

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/narrative-control` | `NarrativeControlCenter` | narrative | live | |
| `/texture-review/:storyNumber` | `TextureReviewPage` | narrative | live | |
| `/story-evaluation` | `StoryEvaluationEngine` | narrative | live | |
| `/scene-proposer` | `StoryProposer` | narrative | live | |
| `/story-threads` | `StoryThreadTracker` | narrative | live | |
| `/story-calendar` | `StoryCalendar` | narrative | live | |
| `/story-health` | `StoryHealthDashboard` | narrative | live | |

### P. Feed & Social

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/feed` | `SocialProfileGenerator` | feed | live | |
| `/feed-relationships` | `FeedRelationshipMap` | feed | live | |
| `/pressure` | `NarrativePressureDashboard` | feed | live | |
| `/social-import` | Navigate → `/universe/social-import` | feed | redirect | |

### Q. Publishing

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/assembler` | `NovelAssembler` | publishing | live | |
| `/press` | `PressPublisher` | publishing | live | |

### R. Analytics & Search

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/search` | `SearchResults` | analytics | live | |
| `/analytics/decisions` | `DecisionAnalyticsDashboard` | analytics | live | |
| `/ai-costs` | `AICostTracker` | analytics | live | |
| `/cfo` | `CFOAgent` | analytics | live | |
| `/site-organizer` | `SiteOrganizer` | analytics | live | |
| `/design-agent` | `DesignAgent` | analytics | live | |
| `/franchise-brain` | Navigate → `/intelligence/franchise-brain` | analytics | redirect | Ghost import: `FranchiseBrainPage` imported, never rendered |
| `/show-brain` | Navigate → `/intelligence/show-brain` | analytics | redirect | Ghost import: `ShowBrain` imported, never rendered |

### S. Admin & Diagnostics

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/admin` | `AdminPanel` | admin | live | |
| `/admin/audit` | `AuditLog` | admin | live | |
| `/admin/templates` | `TemplateManagement` | admin | live | *(also listed under template group J)* |
| `/audit-log` | `AuditLogViewer` | admin | live | Separate from `/admin/audit` |
| `/diagnostics` | `DiagnosticPage` | admin | live | |
| `/amber` | `AmberCommandCenter` | admin | live | |

### T. Settings & Misc

| Path | Component | Group | Type | Notes |
|------|-----------|-------|------|-------|
| `/settings` | `SettingsPage` | settings | live | |
| `/recycle-bin` | `RecycleBin` | settings | live | |
| `/login` | Navigate → `/` | settings | guard | Auth-inversion guard (logged-in user hits /login) |
| `*` | Navigate → `/` | settings | guard | Authenticated catch-all |

---

## 3. Findings

### F-1: Five Ghost Lazy Imports
Components are lazily imported — bundled, code-split — but **no live route renders them**. All five have their declared routes redirected away.

| Import | File | Route declared | Route disposition |
|--------|------|----------------|------------------|
| `StorytellerPage` | `./pages/StorytellerPage` | `/storyteller` | Navigate → `/stories` |
| `StoryEngine` | `./pages/StoryEngine` | `/story-engine` | Navigate → `/stories` |
| `FranchiseBrainPage` | `./pages/FranchiseBrainPage` | `/intelligence/franchise-brain`, `/franchise-brain` | Both redirect to `/show-bible` chain |
| `ShowBrain` | `./pages/ShowBrain` | `/show-brain`, `/intelligence/show-brain` | Both redirect to `/show-bible` chain |
| `CharacterGenerator` | `./pages/CharacterGenerator` | `/character-generator` | Navigate → `/world-studio` |

These imports load the chunk resolver into the bundle but can never execute via routing. Cleanup is blocked on confirming no other call site references them (Part 2 / Part 3 open item).

### F-2: Seven Wardrobe-Killed Routes
The wardrobe system is effectively tombstoned. Seven routes navigate to `/`. `OutfitCalendar` at `/wardrobe/calendar` is the only live survivor. The wardrobe routes remain declared rather than removed — path-preserving tombstones.

### F-3: Scheduled Removal — RelationshipEngine
`/relationships` → `RelationshipEngine` is a live route, but a VS Code workspace task (`"Remove old RelationshipEngine"`) exists to delete `frontend/src/pages/RelationshipEngine.jsx`. If the file is removed without deleting the route and import, the app will throw at lazy-load time. **Route and import must be removed together with the file.**

### F-4: Orphaned `/intelligence/*` Namespace
`/intelligence/franchise-brain` and `/intelligence/show-brain` are declared routes (both redirects), but there is no `/intelligence` parent route, no `/intelligence` nav link, and no component at that path. The namespace exists only as a redirect relay layer.

### F-5: Episode Param Name Inconsistency
`/episodes/:episodeId/edit`, `/episodes/:episodeId/todo`, `/episodes/:episodeId` all use `:episodeId`.  
`/episodes/:id/evaluate` uses `:id`.  
Same resource, different param name. `EvaluateEpisode` receives the id as `params.id` while siblings receive it as `params.episodeId`.

### F-6: Inline Component as Route (BookToWriteRedirect)
`BookToWriteRedirect` is defined inline at App.jsx:62 — not a lazy import, not a separate page file. It is the only component-used-as-route that is defined inside App.jsx. Low severity but inconsistent with every other page in the router.

### F-7: Four Dual-Routed Components
| Component | Routes |
|-----------|--------|
| `QuickEpisodeCreator` | `/episodes/:episodeId/edit`, `/shows/:showId/quick-episode` |
| `SceneStudioPage` | `/studio/scene/:sceneId`, `/studio/scene-set/:sceneSetId` |
| `TemplateStudio` | `/episodes/:episodeId/composer`, `/template-studio` |
| `TemplateDesigner` | `/template-studio/designer`, `/template-studio/designer/:templateId` |

These are intentional multi-entry-point patterns; no action implied. Listed for Part 2 component inventory awareness.

### F-8: Two Const/File Name Mismatches
| Const | Lazy import path |
|-------|-----------------|
| `CharacterProfile` | `./pages/CharacterProfilePage` |
| `SocialSystemsPage` | `./pages/SocialSystems` |

Functional — lazy resolves the file, not the const name — but inconsistent with the project's naming convention.

### F-9: `admin/templates` Appears in Two Groups
`/admin/templates` → `TemplateManagement` is listed under both the Template/Composition group (J) and the Admin group (S) in this document. It is a single route; the dual listing is an artifact of grouping. Noted to avoid double-counting in any future route count.

---

## 4. Open Items for Part 2

| ID | Item | Depends on |
|----|------|-----------|
| OI-1 | Confirm ghost imports have no non-route call sites (StorytellerPage, StoryEngine, FranchiseBrainPage, ShowBrain, CharacterGenerator) | Part 2 component existence scan |
| OI-2 | Confirm `RelationshipEngine.jsx` still exists at `c92abb56` — if yes, route+import removal pipeline is ready to plan | Part 2 file existence check |
| OI-3 | Classify `frontend/src/services/` call sites for `evaluation.js` endpoints (inventory open-item #3 from F-Sec-3) | Part 3 services scan |
| OI-4 | Check `frontend/src/constants/` and `frontend/src/data/` for hardcoded `'justawoman'` / `'lala'` canonical copies | Part 3 constants scan |
| OI-5 | Confirm `BookToWriteRedirect` inline component behavior and whether it belongs in a separate file | Part 2 component review |

---

## 5. Summary

| Stat | Value |
|------|-------|
| Total `<Route>` declarations | 126 |
| Live-render routes | 105 |
| Navigate redirects | 21 |
| — Wardrobe-killed (→ `/`) | 7 |
| — Semantic aliases | 11 |
| — System guards | 3 |
| Ghost lazy imports | 5 |
| Scheduled-removal live routes | 1 (`RelationshipEngine`) |
| Dual-routed components | 4 (8 routes) |
| Const/file name mismatches | 2 |

Routing is architecturally clean — single source, flat structure, no createBrowserRouter, no file-based routing. The complexity is in the quantity of routes (126 for a single-operator app) and in the legacy/decommission layer (wardrobe killed routes, ghost imports, scheduled RelationshipEngine removal). No structural rewrites required for any Phase B work.

---

*Grounded at `c92abb56`. Inventory only — no routes changed, no files modified.*
