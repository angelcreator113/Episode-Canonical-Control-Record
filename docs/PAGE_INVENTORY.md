# Page Inventory — Frontend Pages vs. the Event → Episode Flow

## Status of this document

**Living design authority**, same status as `docs/EVENT_EPISODE_FLOW.md` (see
that document's own "Status" section). Not filed under `docs/audit/`, carries
no basis-SHA immutability rule, meant to be edited in place as the frontend
changes. It rules nothing and mints no FD/XK/PE number. Where a claim below
is verified against the code it says so with a file:line; where something
doesn't resolve, it says that instead of guessing.

Basis for the file:line citations below: `origin/main` at
`5da8586faede835ff044dfc0ae3639e16920c865` (2026-09-20). All frontend paths
are relative to `frontend/src/` unless stated otherwise.

This document does not move, rename, or edit any page. It recommends nothing
beyond flagging the duplicates and gaps steps 4 and 5 ask for. It does not
touch host, AWS, database, or Cognito configuration.

---

## 1. Every route declared in `App.jsx`

`frontend/src/App.jsx` declares 117 `<Route>` elements (113 unique paths —
`/`, `/login`, and `*` each appear once in the pre-auth block, lines
271-289, and again in the authenticated block, so they're listed once below
with both contexts noted).

Legend for "Reachable via": **Sidebar** = a `Sidebar.jsx` nav item;
**in-app link** = a genuine `navigate()`/`<Link to=>`/`window.open()` call
found elsewhere in `frontend/src`; **Command Palette** = a Ctrl+K search
result builder in `CommandPalette.jsx`; **URL only** = no in-app caller
found by this inventory (full list with descriptions in §6);
**redirect target** = only reached via another route's own `<Navigate>`,
not via any page's UI.

### Pre-auth / entry (App.jsx:271-289)

| Path | Component | Live/Redirect | Reachable via |
|---|---|---|---|
| `/` | `pages/LandingPage.jsx` (App.jsx:274) | live | entry route, unauthenticated |
| `/login` | `pages/Login.jsx` (App.jsx:275) | live | entry route, unauthenticated |
| `*` | redirect → `/` (App.jsx:286) | redirect | catch-all, unauthenticated |

### Dashboard (App.jsx:322-339)

| Path | Component | Live/Redirect | Reachable via |
|---|---|---|---|
| `/` | `pages/Home.jsx` (App.jsx:323) | live | Sidebar (Home `NavLink`, `components/layout/Sidebar.jsx:201-210`) |
| `/start` | `pages/SessionStart.jsx` (App.jsx:324) | live | Sidebar (brand-mark click, `Sidebar.jsx:172`) |
| `/universe` | `pages/UniversePage.jsx` (App.jsx:327) | live | Sidebar (FRANCHISE zone, `Sidebar.jsx:22`) |
| `/universe/social-import` | `pages/UniverseSocialImportPage.jsx` (App.jsx:328) | live | URL only — no in-app caller found; also the redirect target of `/social-import` (App.jsx:517) |
| `/universe/series` | `pages/SeriesPage.jsx` (App.jsx:329) | live | URL only |
| `/universe/production` | `pages/UniverseProductionPage.jsx` (App.jsx:330) | live | URL only |
| `/universe/assets` | redirect → `/assets` (App.jsx:331) | redirect | — |
| `/universe/world-state` | `pages/UniverseWorldStatePage.jsx` (App.jsx:332) | live | URL only |
| `/universe/tensions` | `pages/UniverseTensionsPage.jsx` (App.jsx:333) | live | URL only |
| `/universe/story-dashboard` | `pages/StoryDashboardPage.jsx` (App.jsx:334) | live | URL only |
| `/show-bible` | `pages/ShowBiblePage.jsx` (App.jsx:335) | live | Sidebar (`Sidebar.jsx:23`) + in-app link (`pages/UniversePage.jsx:112,176`) + redirect target of 3 routes below |
| `/universe/knowledge` | redirect → `/show-bible?tab=knowledge` (App.jsx:336) | redirect | — |
| `/intelligence/franchise-brain` | redirect → `/show-bible?tab=decisions` (App.jsx:337) | redirect | — |
| `/intelligence/show-brain` | redirect → `/show-bible?tab=knowledge` (App.jsx:338) | redirect | — |
| `/universe/writing-rhythm` | `pages/WritingRhythmPage.jsx` (App.jsx:339) | live | URL only |

### Pre-production (App.jsx:341-376)

| Path | Component | Live/Redirect | Reachable via |
|---|---|---|---|
| `/episodes` | redirect → `/shows` (App.jsx:344) | redirect | — |
| `/episodes/create` | `pages/CreateEpisode.jsx` (App.jsx:345) | live | in-app link (`pages/StudioTimelinePage.jsx:66`, `pages/Home.jsx:264`) |
| `/episodes/:episodeId/edit` | `components/QuickEpisodeCreator.jsx` (App.jsx:346) | live | in-app link (`pages/EpisodeDetail.jsx:457,605`) |
| `/episodes/:id/evaluate` | `pages/EvaluateEpisode.jsx` (App.jsx:347) | live | in-app link (`pages/WorldAdmin.jsx:1780`) |
| `/episodes/:episodeId/todo` | `pages/EpisodeTodoPage.jsx` (App.jsx:348) | live | in-app link (`pages/WorldAdmin.jsx:1779`, `pages/EpisodeScriptWriterPage.jsx:293`) |
| `/episodes/:episodeId` | `pages/EpisodeDetail.jsx` (App.jsx:349) | live | in-app link (many, e.g. `components/Show/StudioTab.jsx:114`; also `pages/WorldAdmin.jsx:1328,2204,2448,3270,5111`) |
| `/assets` | `pages/AssetLibrary.jsx` (App.jsx:352) | live | URL only — also the redirect target of `/universe/assets` |
| `/shows` | `pages/ShowManagement.jsx` (App.jsx:355) | live | Sidebar (PRODUCE zone, `Sidebar.jsx:36`) |
| `/shows/create` | `pages/CreateShow.jsx` (App.jsx:356) | live | Sidebar (Shows sub-list "+ New Show", `Sidebar.jsx:374-380`) |
| `/shows/:id` | `pages/ShowDetail.jsx` (App.jsx:357) | live | Sidebar (Shows sub-list per-show links, `Sidebar.jsx:361-371`) + in-app link (`pages/ShowManagement.jsx:328`) |
| `/shows/:id/edit` | `pages/EditShow.jsx` (App.jsx:358) | live | in-app link (`pages/ShowManagement.jsx:335`) |
| `/shows/:id/world` | `pages/WorldAdmin.jsx` (App.jsx:359) | live | Sidebar (Producer Mode item, conditional on a show existing, `Sidebar.jsx:34`) + in-app link (`pages/ShowDetail.jsx:222`, `components/Show/ProductionTab.jsx:282,288,294`) |
| `/shows/:showId/quick-episode` | `components/QuickEpisodeCreator.jsx` (App.jsx:360) | live | in-app link (`pages/ShowDetail.jsx:147,321,351`, `components/Show/ProductionTab.jsx:337`) |
| `/shows/:id/settings` | `pages/ShowSettings.jsx` (App.jsx:361) | live | in-app link (`components/Show/ProductionTab.jsx:222,450`) |
| `/studio/timeline` | `pages/StudioTimelinePage.jsx` (App.jsx:363) | live | Sidebar (STUDIO zone, `Sidebar.jsx:56`) |
| `/studio/scene/:sceneId` | `pages/SceneStudioPage.jsx` (App.jsx:366) | live | in-app link (`components/Episodes/EpisodeScenesTab.jsx:453`) |
| `/studio/scene-set/:sceneSetId` | `pages/SceneStudioPage.jsx` (App.jsx:367) | live | URL only |
| `/scene-library` | `pages/SceneLibrary.jsx` (App.jsx:370) | live | in-app link (`pages/SceneDetail.jsx:75,168,182`, `pages/PropertyManager.jsx:158`) — both callers are themselves URL-only pages (§6); no reachable entry point into this cluster was found |
| `/phone-hub` | `pages/UIOverlaysTab.jsx` (App.jsx:371) | live | in-app link (`pages/Home.jsx:280`) |
| `/episodes/:episodeId/plan` | `pages/ScenePlannerPage.jsx` (App.jsx:372) | live | in-app link (`components/Episodes/EpisodeScenesTab.jsx:401`; also `utils/workflowRouter.js:36`) |
| `/episodes/:episodeId/script-writer` | `pages/EpisodeScriptWriterPage.jsx` (App.jsx:373) | live | in-app link (`components/Episodes/EpisodeOverviewTab.jsx:946`) |
| `/shows/:showId/feed-timeline` | `pages/FeedTimelinePage.jsx` (App.jsx:374) | live | URL only — note: WorldAdmin's `feed-timeline` sub-tab key (§2) is an unrelated internal tab state, not this route |
| `/shows/:showId/feed-dashboard` | `pages/feed/EventFeedDashboard.jsx` (App.jsx:375) | live | in-app link (`pages/FeedTimelinePage.jsx:255`) — but the only known caller is itself URL only |
| `/scene-library/:sceneId` | `pages/SceneDetail.jsx` (App.jsx:376) | live | in-app link (`pages/SceneLibrary.jsx:441`) |

### Animatic system (App.jsx:378-385)

| Path | Component | Live/Redirect | Reachable via |
|---|---|---|---|
| `/episodes/:episodeId/beats` | `pages/BeatGeneration.jsx` (App.jsx:381) | live | URL only |
| `/episodes/:episodeId/timeline` | `pages/TimelineEditor.jsx` (App.jsx:384) | live | in-app link (`pages/ExportPage.jsx:336`, `components/Show/ProductionTab.jsx:430`, `pages/StudioTimelinePage.jsx:22,47`; also `utils/workflowRouter.js:49`) |
| `/episodes/:episodeId/icon-cues` | `pages/IconCueTimeline.jsx` (App.jsx:385) | live | URL only |

### Production (App.jsx:387-403)

| Path | Component | Live/Redirect | Reachable via |
|---|---|---|---|
| `/wardrobe/calendar` | `pages/OutfitCalendar.jsx` (App.jsx:390) | live | in-app link (`pages/WorldAdmin.jsx:5526`, `window.open`) |
| `/episodes/:episodeId/composer` | `pages/TemplateStudio.jsx` (App.jsx:393) | live | URL only — see note below |
| `/template-studio` | `pages/TemplateStudio.jsx` (App.jsx:394) | live | URL only (bare path has no caller; only its designer sub-route is linked) |
| `/template-studio/designer` | `pages/TemplateDesigner.jsx` (App.jsx:395) | live | in-app link (`pages/TemplateStudio.jsx:64`) |
| `/template-studio/designer/:templateId` | `pages/TemplateDesigner.jsx` (App.jsx:396) | live | in-app link (`pages/TemplateStudio.jsx:72`) |
| `/library` | `pages/CompositionLibrary.jsx` (App.jsx:399) | live | Sidebar (STUDIO zone, `Sidebar.jsx:57`) |
| `/compositions/:id` | `pages/CompositionDetail.jsx` (App.jsx:400) | live | URL only |
| `/admin/templates` | `pages/TemplateManagement.jsx` (App.jsx:403) | live | URL only |

> **Flag — likely broken link:** `pages/TemplateStudio.jsx:357` calls
> `navigate(\`/composer?template=${template.id}\`)`. No route named `/composer`
> exists anywhere in `App.jsx` — only `/episodes/:episodeId/composer` and
> `/template-studio` do. That navigation falls through to the authenticated
> catch-all (`App.jsx:561`, redirect to `/`). This reads as a stale link left
> over from a route rename, not an intentional hidden route.

### Post-production (App.jsx:405-414)

| Path | Component | Live/Redirect | Reachable via |
|---|---|---|---|
| `/thumbnails/:episodeId` | `pages/ThumbnailGallery.jsx` (App.jsx:408) | live | URL only — see note below |
| `/episodes/:episodeId/export` | `pages/ExportPage.jsx` (App.jsx:411) | live | in-app link (`components/ExportDropdown/ExportDropdown.jsx:13,17`, `pages/EpisodeReview.jsx:74`) |
| `/episodes/:episodeId/review` | `pages/EpisodeReview.jsx` (App.jsx:414) | live | in-app link (`components/Episodes/EpisodeKanbanBoard.jsx:178` via `utils/workflowRouter.js:64,77`) |

> **Flag — second likely broken link:** `pages/ThumbnailGallery.jsx` itself
> navigates to `/episodes/${id}/thumbnail/${id}` (per this inventory's route
> research), which also matches no declared `App.jsx` route. Recorded here
> rather than re-verified line-by-line since it wasn't this document's
> primary target.

### Management — writing (App.jsx:419-433)

| Path | Component | Live/Redirect | Reachable via |
|---|---|---|---|
| `/stories` | `pages/StoriesPage.jsx` (App.jsx:419) | live | Sidebar (WRITE zone, `Sidebar.jsx:42`) |
| `/storyteller` | redirect → `/stories` (App.jsx:420) | redirect | — |
| `/book/:id` | inline `BookToWriteRedirect` (App.jsx:79,421) | live (resolves internally) | in-app link (`pages/WriteMode.jsx:3503`, `pages/ChapterStructureEditor.jsx:440`) |
| `/books/:bookId/read` | `pages/ReadingMode.jsx` (App.jsx:422) | live | in-app link (`pages/SessionStart.jsx:191`) |
| `/chapter/:bookId/:chapterId` | `pages/ChapterJourney.jsx` (App.jsx:423) | live | in-app link (`components/ChapterSelection.jsx:106,110,175`, `pages/WriteMode.jsx:1629`, `pages/SessionStart.jsx:162`, `pages/ChapterStructureEditor.jsx:453`) |
| `/write/:bookId/:chapterId` | `pages/WriteMode.jsx` (App.jsx:424) | live | URL only |
| `/chapter-structure/:bookId/:chapterId` | `pages/ChapterStructureEditor.jsx` (App.jsx:425) | live | URL only |
| `/character-registry` | `pages/CharacterRegistryPage.jsx` (App.jsx:428) | live | Sidebar (WRITE zone, `?view=world`, `Sidebar.jsx:49`) + Command Palette (`character` result, `components/CommandPalette.jsx:16`) |
| `/character/:id` | `pages/CharacterProfilePage.jsx` (App.jsx:429) | live | in-app link (`pages/CharacterRegistryPage.jsx:124`) |
| `/setup` | `pages/SetupWizard.jsx` (App.jsx:430) | live | URL only |
| `/therapy/:registryId` | `pages/CharacterTherapy.jsx` (App.jsx:433) | live | URL only |

### Management — world & story systems (App.jsx:436-514)

| Path | Component | Live/Redirect | Reachable via |
|---|---|---|---|
| `/continuity` | `pages/ContinuityEnginePage.jsx` (App.jsx:436) | live | in-app link (`pages/Home.jsx:276`) |
| `/relationships` | `pages/RelationshipEngine.jsx` (App.jsx:439) | live | Sidebar (WRITE zone, `Sidebar.jsx:50`) |
| `/cultural-calendar` | `pages/CulturalCalendar.jsx` (App.jsx:442) | live | URL only (named in a `Sidebar.jsx` auto-expand string array, `:123`, but no `buildNav()` item points at it — see §2b-style Sidebar note below) |
| `/world-setup` | `pages/WorldSetupGuide.jsx` (App.jsx:443) | live | URL only |
| `/property-manager` | `pages/PropertyManager.jsx` (App.jsx:444) | live | URL only |
| `/influencer-systems` | `pages/InfluencerSystems.jsx` (App.jsx:447) | live | URL only (same Sidebar auto-expand-only note) |
| `/world-infrastructure` | `pages/WorldInfrastructure.jsx` (App.jsx:450) | live | URL only (same Sidebar auto-expand-only note) |
| `/social-timeline` | `pages/SocialTimeline.jsx` (App.jsx:453) | live | URL only — `components/FranchiseBrain.jsx:88-92` lists this route in a nav array, but `FranchiseBrain.jsx` is never imported/rendered anywhere in `frontend/src` (confirmed by grep; only its own test file references it) — dead code, doesn't count as reachable. Same Sidebar auto-expand-only note. |
| `/social-personality` | `pages/SocialPersonality.jsx` (App.jsx:456) | live | URL only (same `FranchiseBrain.jsx` dead-code note; same Sidebar note) |
| `/character-life-simulation` | `pages/CharacterLifeSimulation.jsx` (App.jsx:459) | live | URL only (same `FranchiseBrain.jsx` dead-code note; same Sidebar note) |
| `/cultural-memory` | `pages/CulturalMemory.jsx` (App.jsx:462) | live | URL only (same Sidebar note) |
| `/character-depth-engine` | `pages/CharacterDepthEngine.jsx` (App.jsx:465) | live | URL only (same `FranchiseBrain.jsx` dead-code note; same Sidebar note) |
| `/world-locations` | `pages/WorldLocations.jsx` (App.jsx:468) | live | URL only — the only hits outside `App.jsx`/`Sidebar.jsx` are `pages/NarrativeControlCenter.jsx:555,564,571`, which are backend API calls (`` fetchJSON(`${API}/tier/world-locations`) ``), not frontend navigation. Same Sidebar note. |
| `/world-dashboard` | `pages/WorldDashboard.jsx` (App.jsx:471) | live | Sidebar (FRANCHISE zone, `Sidebar.jsx:24`) |
| `/world-foundation` | `pages/WorldFoundation.jsx` (App.jsx:472) | live | Sidebar (FRANCHISE zone, `Sidebar.jsx:25`) |
| `/social-systems` | `pages/SocialSystems.jsx` (App.jsx:473) | live | Sidebar (FRANCHISE zone, `Sidebar.jsx:26`) |
| `/culture-events` | `pages/CultureEvents.jsx` (App.jsx:474) | live | Sidebar (FRANCHISE zone, `Sidebar.jsx:27`) |
| `/show-brain` | redirect → `/show-bible?tab=knowledge` (App.jsx:477) | redirect | — |
| `/narrative-control` | `pages/NarrativeControlCenter.jsx` (App.jsx:480) | live | URL only |
| `/story-engine` | redirect → `/stories` (App.jsx:483) | redirect | Sidebar (WRITE > Stories > "Structure" child, `Sidebar.jsx:44`) + Command Palette (`story` result, `CommandPalette.jsx:17`) — both entry points land on a route that immediately redirects |
| `/texture-review/:storyNumber` | `pages/TextureReviewPage.jsx` (App.jsx:486) | live | URL only (`components/Breadcrumbs.jsx:37` is a breadcrumb label lookup for the current path, not a link to it) |
| `/story-evaluation` | `pages/StoryEvaluationEngine.jsx` (App.jsx:489) | live | in-app link (`pages/StoryProposer.jsx:623`, `pages/WorldDashboard.jsx:121`, `components/WorldStateTensions.jsx:102`) |
| `/scene-proposer` | `pages/StoryProposer.jsx` (App.jsx:492) | live | URL only (named in `Sidebar.jsx:137`'s Stories auto-expand array, no matching nav item) |
| `/story-threads` | `pages/StoryThreadTracker.jsx` (App.jsx:495) | live | Sidebar (WRITE > Stories > "Threads" child, `Sidebar.jsx:45`) + Command Palette (`thread` result, `CommandPalette.jsx:19`) |
| `/story-calendar` | `pages/StoryCalendar.jsx` (App.jsx:498) | live | Sidebar (WRITE > Stories > "Calendar" child, `Sidebar.jsx:46`) + Command Palette (`event` result, `CommandPalette.jsx:20`) |
| `/story-health` | `pages/StoryHealthDashboard.jsx` (App.jsx:501) | live | URL only (`CommandPalette.jsx:12-13` exports a `searchStoryHealthApi` helper hitting a *backend* search endpoint — not a frontend link to this route) |
| `/world-studio` | `pages/WorldStudio.jsx` (App.jsx:504) | live | in-app link (`components/CharacterProfile.jsx:625`, `pages/CharacterProfilePage.jsx:844`, `pages/SceneStudio.jsx:163`) + Command Palette (`location` result → `/world-studio?tab=locations`, `CommandPalette.jsx:18`). Sidebar has dead expand logic referencing this route (see note below) but no live nav item for it. |
| `/scene-studio` | `pages/SceneStudio.jsx` (App.jsx:507) | live | URL only (same Sidebar auto-expand-only note) |
| `/feed` | `pages/SocialProfileGenerator.jsx` (App.jsx:510) | live | in-app link (`components/Episodes/EpisodeOverviewTab.jsx:700`) — **duplicate of WorldAdmin's "Lala's Feed" sub-tab, see §4** |

### Management — franchise systems & admin (App.jsx:513-561)

| Path | Component | Live/Redirect | Reachable via |
|---|---|---|---|
| `/pressure` | `pages/NarrativePressureDashboard.jsx` (App.jsx:513) | live | URL only |
| `/feed-relationships` | `pages/FeedRelationshipMap.jsx` (App.jsx:514) | live | URL only |
| `/social-import` | redirect → `/universe/social-import` (App.jsx:517) | redirect | — |
| `/franchise-brain` | redirect → `/show-bible?tab=decisions` (App.jsx:520) | redirect | — |
| `/assembler` | `pages/NovelAssembler.jsx` (App.jsx:523) | live | URL only (only a self-referential header comment, `pages/NovelAssembler.jsx:7`) |
| `/press` | `pages/PressPublisher.jsx` (App.jsx:526) | live | URL only |
| `/search` | `pages/SearchResults.jsx` (App.jsx:529) | live | Sidebar (SYSTEM zone, `Sidebar.jsx:71`) |
| `/analytics/decisions` | `pages/DecisionAnalyticsDashboard.jsx` (App.jsx:532) | live | Sidebar (SYSTEM > CFO Agent > "Analytics" child, `Sidebar.jsx:65`) |
| `/ai-costs` | `pages/AICostTracker.jsx` (App.jsx:533) | live | Sidebar (SYSTEM > CFO Agent > "AI Costs" child, `Sidebar.jsx:66`) |
| `/cfo` | `pages/CFOAgent.jsx` (App.jsx:534) | live | Sidebar (SYSTEM zone, `Sidebar.jsx:63`) |
| `/site-organizer` | `pages/SiteOrganizer.jsx` (App.jsx:535) | live | Sidebar (SYSTEM zone, `Sidebar.jsx:69`) |
| `/design-agent` | `pages/DesignAgent.jsx` (App.jsx:536) | live | Sidebar (SYSTEM zone, `Sidebar.jsx:70`) |
| `/admin` | `pages/AdminPanel.jsx` (App.jsx:539) | live | Sidebar (SYSTEM zone, `Sidebar.jsx:72`) |
| `/admin/audit` | `pages/AuditLog.jsx` (App.jsx:540) | live | URL only |
| `/diagnostics` | `pages/DiagnosticPage.jsx` (App.jsx:543) | live | Sidebar (SYSTEM > Admin > "Diagnostics" child, `Sidebar.jsx:74`) |
| `/amber` | `pages/AmberCommandCenter.jsx` (App.jsx:546) | live | URL only (same Sidebar auto-expand-only note) |
| `/settings` | `pages/SettingsPage.jsx` (App.jsx:549) | live | Sidebar (SYSTEM zone, `Sidebar.jsx:78`; also footer avatar click, `Sidebar.jsx:417`) |
| `/recycle-bin` | `pages/RecycleBin.jsx` (App.jsx:552) | live | Sidebar (SYSTEM zone, `Sidebar.jsx:77`) |
| `/world` | redirect → `/world-dashboard` (App.jsx:555) | redirect | — |
| `/login` | redirect → `/` (App.jsx:558) | redirect | authenticated user hitting the login page |
| `*` | redirect → `/` (App.jsx:561) | redirect | catch-all, authenticated |

### Sidebar staleness note (applies to every "same Sidebar auto-expand-only note" row above)

`Sidebar.jsx:123` has a "Universe" auto-expand effect that sets
`universeOpen` to `true` when the current path starts with any of:
`/universe`, `/intelligence`, `/world-dashboard`, `/world-foundation`,
`/social-systems`, `/culture-events`, `/cultural-calendar`,
`/influencer-systems`, `/world-infrastructure`, `/social-timeline`,
`/social-personality`, `/character-life-simulation`, `/cultural-memory`,
`/character-depth-engine`, `/world-locations`, `/amber`, `/scene-studio`.
But the render logic's grouped-nav branch (`item.groups`, `Sidebar.jsx:229-283`,
which `universeOpen` controls) only fires for a `buildNav()` item that has a
`.groups` field — and **no item in `buildNav()` (`Sidebar.jsx:14-82`) has
one**. The FRANCHISE zone's six items (`Sidebar.jsx:20-28`) are plain,
ungrouped nav entries. So this entire code path is dead: `universeOpen`
toggles a state variable that no rendered element reads. The same pattern
recurs for `/world-studio` and `/character-registry` (`worldOpen`,
`Sidebar.jsx:129-133`, matched against `item.children` at `:287` via
`isWorld = item.route === '/world-studio'`) — no `buildNav()` item has
`route: '/world-studio'` with `children`, so that branch is dead too, while
`/character-registry` itself renders fine as its own plain WRITE-zone item
(`Sidebar.jsx:49`), unaffected by the dead `worldOpen` toggle. Net effect:
none of the routes named only in these auto-expand string arrays gain
Sidebar reachability from them — each is exactly as reachable (or not) as
its own row above says, independent of this dead code. Recorded here as an
observation, per this document's own "does not recommend" scope — not
something this document rules should be fixed.

---

## 2. Producer Mode tabs (`WorldAdmin.jsx`)

`frontend/src/pages/WorldAdmin.jsx` is mounted at `/shows/:id/world`
(App.jsx:359). Its tab structure is a single `TABS` array
(`WorldAdmin.jsx:166-188`); the active leaf is read from `?tab=` on mount
(`:194`) and written back on every click (`:333-339` for a top-level tab,
`:1350` for a sub-tab). Clicking a sub-tab button sets `?tab=<that sub's own
key>` directly (`WorldAdmin.jsx:1350`); clicking a top-level tab with subs
sets `?tab=<its first sub's key>` (`switchTab`, `:333-339`).

| Top-level tab (key) | Label | Sub-tab (key) | Sub-tab label | `?tab=` value |
|---|---|---|---|---|
| `overview` | Overview | — (no subs) | — | `overview` |
| `episodes` | Episodes | `season` | Season Arc | `season` |
| `episodes` | Episodes | `episodes-ledger` | Episode Ledger | `episodes-ledger` |
| `feed` | Feed & Events | `feed-timeline` | Lala's Feed | `feed-timeline` |
| `feed` | Feed & Events | `feed-events` | Feed Events | `feed-events` |
| `feed` | Feed & Events | `events` | Events Library | `events` |
| `wardrobe` | Assets | `scene-sets` | Scene Sets | `scene-sets` |
| `wardrobe` | Assets | `overlays-tab` | Lala's Phone | `overlays-tab` |
| `wardrobe` | Assets | `production-overlays` | UI Overlays | `production-overlays` |
| `wardrobe` | Assets | `wardrobe-items` | Wardrobe | `wardrobe-items` |
| `wardrobe` | Assets | `goals` | Career Goals | `goals` |
| `characters` | Characters | `characters-list` | Character Stats | `characters-list` |
| `characters` | Characters | `decisions` | Decision Log | `decisions` |

(Definitions: `WorldAdmin.jsx:166-188`. Content render conditions:
`overview` `:1365`; `season` `:1467`; `episodes-ledger` `:1472`;
`feed-timeline` `:1800`; `feed-events` `:1807`; `events` `:2096`;
`scene-sets` `:5133`; `overlays-tab` `:5140`; `production-overlays` `:5147`;
`wardrobe-items` `:5154`; `goals` `:4503`; `characters-list` `:7388`;
`decisions` `:7534`.)

**Legacy `?tab=` aliases** (`resolveTab`, `WorldAdmin.jsx:295-322`) still
resolve to the leaves above for backward-compat deep links: `season`,
`episodes` (→`episodes-ledger`), `feed` (→`feed-timeline`), `feed-events`,
`events`, `scene-sets`, `overlays`/`overlays-tab`, `production-overlays`,
`goals`, `wardrobe` (→`scene-sets`), `characters` (→`characters-list`),
`decisions`.

**Orphan tab — not in `TABS` at all:** `activeTab === 'opportunities'`
(`WorldAdmin.jsx:4497`) renders an `OpportunitiesTab` component
(`:8001`). No entry for `'opportunities'` exists in `TABS` (`:166-188`),
no button calls `setActiveTab('opportunities')`/`switchTab('opportunities')`
anywhere in the file, and `resolveTab`'s alias map (`:306-320`) doesn't
mention it either. It is reachable only by manually visiting
`?tab=opportunities` in the URL — `useState(initialTab)` (`:291`) sets
`activeTab` straight to whatever unrecognized string is in the URL. It
renders with no tab-bar highlight and no sub-tab bar.

**Observation — several buttons set a sub-tab key on `activeTab` directly,**
bypassing `switchTab()`, which won't match any `activeTab === 'feed' &&
subTab === X` render condition:
`WorldAdmin.jsx:1409` (`setActiveTab('feed-events')`), `:1410`
(`setActiveTab('events')`), `:4641`, `:4643`, `:4647` (all
`setActiveTab('events')`). By contrast `setActiveTab('wardrobe')` (`:1408`)
and `setActiveTab('episodes')` (`:5112`) use valid top-level keys and work.
This inventory did not run the app to confirm the failure mode; it's a
static-reading observation, not a confirmed bug report.

---

## 2b. Header comment vs. actual tabs — both directions

`WorldAdmin.jsx:1-16`'s own header comment:

```
1  /**
2   * WorldAdmin v2 — Producer Mode Dashboard
3   *
4   * Route: /shows/:id/world
5   *
6   * 7 Tabs:
7   *   1. Overview — Stats, tier distribution, canon timeline
8   *   2. Episode Ledger — All episodes with tier/score/deltas
9   *   3. Events Library — Reusable event catalog (create, edit, inject)
10  *   4. Career Goals — Track progression goals
11  *   5. Wardrobe — Tier cards, filters, item grid with Lala reactions
12  *   6. Characters — View/edit Lala stats, character rules, stat ledger
13  *   7. Decision Log — Training data from creative decisions
14  *
15  * Location: frontend/src/pages/WorldAdmin.jsx
16  */
```

This mismatch was already flagged in passing by `docs/EVENT_EPISODE_FLOW.md`
§3 (cited there, not re-derived here) — this section is the full,
line-numbered diff that document didn't attempt.

**A. Named in the comment (lines 6-13) but not a real top-level tab today:**

| Comment says (line) | Actual location |
|---|---|
| "2. Episode Ledger" (`:8`) | sub-tab `episodes-ledger` under top-level `episodes`/"Episodes" (`:170`) |
| "3. Events Library" (`:9`) | sub-tab `events` under top-level `feed`/"Feed & Events" (`:175`) |
| "4. Career Goals" (`:10`) | sub-tab `goals` under top-level `wardrobe`/"Assets" (`:182`) |
| "5. Wardrobe" (`:11`) | no top-level tab named "Wardrobe" exists; the item-grid content described is now sub-tab `wardrobe-items`/"Wardrobe" (`:181`) under top-level `wardrobe`/"Assets" |
| "7. Decision Log" (`:13`) | sub-tab `decisions` under top-level `characters`/"Characters" (`:186`) |

Comment items "1. Overview" (`:7`) and "6. Characters" (`:12`) do still match
a real top-level tab (`overview` `:167`, `characters` `:184`) — not diff
mismatches, though the comment collapses Characters' two sub-tabs into one
line.

**B. Exists in the real tab set but the comment never mentions it:**

- Top-level `episodes`/"Episodes" (`:168`) — the comment names "Episode
  Ledger" but never an "Episodes" parent.
- Sub-tab `season`/"Season Arc" (`:169`).
- Top-level `feed`/"Feed & Events" (`:172`) — not named at all.
- Sub-tab `feed-timeline`/"Lala's Feed" (`:173`).
- Sub-tab `feed-events`/"Feed Events" (`:174`).
- Top-level `wardrobe`/"Assets" (`:177`) — the label "Assets" itself isn't
  in the comment.
- Sub-tab `scene-sets`/"Scene Sets" (`:178`).
- Sub-tab `overlays-tab`/"Lala's Phone" (`:179`).
- Sub-tab `production-overlays`/"UI Overlays" (`:180`).
- Sub-tab `characters-list`/"Character Stats" (`:185`).
- The orphan `opportunities` panel (`:4497`/`:8001`) — not mentioned, and
  not wired into `TABS` either (see §2).

**Summary:** the comment describes a flat 7-tab model that predates a
restructuring into 5 top-level tabs with 12 nested sub-tab leaves, plus one
tab reachable only by hand-editing the URL. Only 2 of the 7 comment-named
items ("Overview," "Characters") still name a real top-level tab; the other
5 now live one level deeper, under a parent the comment never mentions.

---

## 3. Stage mapping

Stages per `docs/EVENT_EPISODE_FLOW.md` §2 (cited, not re-derived): HOST →
EVENT → [VENUE, GUESTS, INVITATION, REQUIREMENTS, OUTFIT are the Event
Package's five sub-parts, §2 "EVENT PACKAGE"] → GENERATE EPISODE → PRODUCE
→ EVALUATE/ACCEPT → AFTERMATH.

| Stage | Page(s)/tab(s) | Notes |
|---|---|---|
| HOST | Standalone `/feed` (`pages/SocialProfileGenerator.jsx`) **and** WorldAdmin's `feed-timeline` sub-tab, which embeds the same component (`WorldAdmin.jsx:1800-1804`) | Duplicate — see §4 |
| EVENT | WorldAdmin `feed-events` sub-tab (drafts) + `events` sub-tab (Events Library, non-drafts) | One `worldEvents` fetch split by `status`; already documented in `EVENT_EPISODE_FLOW.md` §3 — see §4 |
| VENUE | WorldAdmin `events` sub-tab — event create/edit form field (`venue_location_id`, `WorldAdmin.jsx:2540-2547`) | No dedicated page; edited inline in the Events Library event form |
| GUESTS | WorldAdmin `events` sub-tab — read-only display of the auto-generated guest list (`WorldAdmin.jsx:1681,3116-3118,3528`) | No editable UI found anywhere for guests — see §5 |
| INVITATION | WorldAdmin `events` sub-tab — `InvitationButton`/`InvitationStyleFields` (`pages/InvitationGenerator.jsx`, rendered from `WorldAdmin.jsx:3235,3862,2694,3847`) | Real UI exists — see §5 for endpoint-by-endpoint coverage |
| REQUIREMENTS | WorldAdmin `events` sub-tab — event create/edit form field (`requirements.*`, `WorldAdmin.jsx:3009-3012`) | No dedicated page |
| OUTFIT | WorldAdmin `events` sub-tab — event-detail modal's outfit picker (`GET .../wardrobe-options` calls at `WorldAdmin.jsx:3245,4080`) | No dedicated page. Distinct from the `wardrobe-items` sub-tab (general wardrobe browsing/purchase, a different money-path feature per `EVENT_EPISODE_FLOW.md` §5(b)) — not a duplicate, a genuinely different feature that happens to share the word "wardrobe" |
| GENERATE EPISODE | WorldAdmin `events` sub-tab — "Generate Episode" button on the event card/modal (`WorldAdmin.jsx:3256-3276`, per `EVENT_EPISODE_FLOW.md` §2) | Same sub-tab as EVENT/VENUE/GUESTS/INVITATION/REQUIREMENTS/OUTFIT |
| PRODUCE | `/episodes/:episodeId` (`pages/EpisodeDetail.jsx`), Production tab: Assets / Scenes / Wardrobe / Phone / Production Checklist (`EpisodeDetail.jsx:85-91`, per `EVENT_EPISODE_FLOW.md` §2) | — |
| EVALUATE/ACCEPT | `/episodes/:id/evaluate` (`pages/EvaluateEpisode.jsx`) **and** `EpisodeDetail.jsx`'s own Results/Evaluation tab | Duplicate — see §4 |
| AFTERMATH | No page found | Gap — see §5 |

---

## 4. Duplicates

**Feed Events and Events Library** (WorldAdmin's `feed-events` and `events`
sub-tabs): already recorded in `docs/EVENT_EPISODE_FLOW.md` §3 as one
`worldEvents` fetch (`GET /api/v1/world/:showId/events`,
`src/routes/worldEvents.js:35`, called from `WorldAdmin.jsx:507`) filtered
client-side by `status` — Feed Events shows `status === 'draft'`
(`WorldAdmin.jsx:1818`), Events Library explicitly excludes drafts
(`:3051`). Cited here per the doc's own record, not re-derived.

**HOST is served twice.** `SocialProfileGenerator.jsx` ("The Feed," per its
own header comment) is rendered both as a full page at the standalone route
`/feed` (App.jsx:510) and embedded inside WorldAdmin's `feed-timeline`
sub-tab (`WorldAdmin.jsx:1800-1804`). Same component, same data
(`fetchProfiles`/`listWorldEventsApi`, per `EVENT_EPISODE_FLOW.md` §3), two
separate routes a creator could land on.

**EVALUATE/ACCEPT is served twice.** The standalone route
`/episodes/:id/evaluate` (App.jsx:347, `pages/EvaluateEpisode.jsx`) and
`EpisodeDetail.jsx`'s own Results tab (which `EVENT_EPISODE_FLOW.md` §3
describes as ending "in the Evaluation tab once EVALUATE/ACCEPT has run")
both present evaluate/accept functionality for the same episode. This
inventory did not read `EpisodeDetail.jsx`'s Results-tab implementation
deeply enough to say whether one embeds/wraps the other or whether they are
two independent implementations of the same form — recorded as a duplicate
page-count, with that deeper question left open.

**Culture & Events (`/culture-events`, `pages/CultureEvents.jsx`) is not a
duplicate of Feed Events/Events Library** — it queries a different table.
On initial mount it fires four fetches:

- `usePageData('cultural_calendar', …)` and `usePageData('cultural_memory',
  …)` (`CultureEvents.jsx:43-44`) → `GET /api/v1/page-content/<pageName>`
  (`src/routes/pageContent.js:13-16`) → the generic `PageContent` model,
  table `page_content` (`src/models/PageContent.js:26`) — arbitrary
  per-page config blobs, not an events table.
- `listShowsApi()` (`CultureEvents.jsx:22-23,54`) → `GET /api/v1/shows`
  (`src/routes/shows.js:127`) → `Show` model, table `shows`
  (`src/models/Show.js:142`) — used only to get a `show_id` for later
  "create event" actions, not displayed.
- `listCalendarEventsApi('lalaverse_cultural')`
  (`CultureEvents.jsx:24-27,56-60`) → `GET
  /api/v1/calendar/events?event_type=lalaverse_cultural`
  (`src/routes/calendarRoutes.js:156-180`) → `StoryCalendarEvent` model,
  table `story_calendar_events` (`src/models/StoryCalendarEvent.js:134`),
  filtered `event_type = 'lalaverse_cultural'` — this powers the default
  Events tab.

So Culture & Events' Events tab reads `story_calendar_events`, a table
distinct from both `world_events` (Feed Events/Events Library) and
`feed_posts`. Worth noting for future work: `StoryCalendarEvent` `hasMany`
`WorldEvent` (`src/models/StoryCalendarEvent.js:29-33`, via
`source_calendar_event_id`), and Culture & Events' "Create Event" button
(`CultureEvents.jsx:62-70`) calls `POST
/api/v1/calendar/events/:id/auto-spawn`
(`src/routes/calendarRoutes.js:625`), a write action that spawns rows into
`world_events` — but that's a user-triggered mutation, not part of the
page's initial-mount query set.

---

## 5. Gaps

**AFTERMATH has no page.** Per `docs/EVENT_EPISODE_FLOW.md` §2 "AFTERMATH"
(cited, not re-derived), the stage is three backend mechanisms, none of
which surfaces as a distinct page or tab: (1) character sync + opportunity
generation and (2) feed activity both fire inside
`generateEpisodeFromEvent` at GENERATE EPISODE time, not after
evaluate/accept; (3) the career-pipeline cascade
(`careerPipelineService.onEpisodeCompleted`,
`POST /opportunities/:showId/episode-complete/:episodeId`,
`src/routes/opportunityRoutes.js:302-309`) has **no caller anywhere in
`frontend/src`** — confirmed again by this inventory (grepped
`episode-complete` across `frontend/src`, no hits), matching
`EVENT_EPISODE_FLOW.md`'s own finding. The closest thing to a page a
creator could look at is WorldAdmin's `goals`/"Career Goals" sub-tab, which
would show the *results* of a completed cascade if one ran — but nothing
found in this inventory shows a UI that triggers it, and no page is
labeled or scoped as "Aftermath."

**GUESTS has no editable UI.** The guest list is auto-generated by
`eventAutomationService.assembleGuestList` at event-creation time (per
`EVENT_EPISODE_FLOW.md` §2 "EVENT PACKAGE") and only ever displayed
read-only in WorldAdmin's Events Library (`WorldAdmin.jsx:1681,3116-3118,
3528` — a comma-joined handle list, not a picker). This inventory found no
add/remove/edit control for an event's guest list anywhere in
`frontend/src`.

**INVITATION — not a gap.** `docs/EVENT_EPISODE_FLOW.md` §2 "EVENT
PACKAGE"/"Invitation" documents a four-step backend pipeline in
`src/routes/worldEvents.js`. This inventory searched `frontend/src` for a
UI driving it and found one: `InvitationButton`/`InvitationStyleFields`
(`pages/InvitationGenerator.jsx`), rendered from WorldAdmin's Events
Library sub-tab, both in the event list row (`WorldAdmin.jsx:3235`) and the
event-detail modal (`:3862`, style fields at `:2694,3847`). Coverage by
endpoint:

| Endpoint | Backend route | Frontend caller |
|---|---|---|
| generate-invitation | `src/routes/worldEvents.js:1041` | `InvitationGenerator.jsx:69` (`handleGenerate`) |
| re-render-invitation | `:1093` | `InvitationGenerator.jsx:108` (`handleRerender`) |
| approve-invitation | `:1196` | `InvitationGenerator.jsx:85` (`handleApprove`) |
| reject-invitation | `:1271` | `InvitationGenerator.jsx:99` (`handleReject`) |
| invitation-text (GET) | `:1076` | `InvitationGenerator.jsx:122` |
| invitation-history (GET) | `:1301` | `InvitationGenerator.jsx:166` |
| unlink-invitation | `:1605` | `InvitationGenerator.jsx:134` |
| **edit-invitation-text** | `:1510` | **none found** — the "Edit Text" tab calls `re-render-invitation` with the edited text bundled in in`stead, not this endpoint. Grep for the literal string across `frontend/src` returns zero matches. |
| invitation-pdf (GET) | `:1391` | none found |
| animate-invitation | `:1411` | none found |
| animate-invitation/:jobId (GET) | `:1477` | none found |

So: the invitation pipeline as a whole is wired up and reachable from
Producer Mode; `edit-invitation-text`, `invitation-pdf`, and
`animate-invitation`(+its job-status GET) are the backend-only pieces with
no frontend caller.

---

## 6. URL-only pages

Every page from §1 marked "URL only" (no Sidebar entry, no in-app
`navigate()`/`<Link to=>`/`window.open()` call, no Command Palette result
found pointing at it), with a one-line description read from each
component's own code (header comment or rendered heading, not the route
name):

**Count discrepancy with `PROJECT_CONTEXT.md`:** `PROJECT_CONTEXT.md` §4.6
(`:133`) states "~23 feature pages reachable only by URL." This inventory
found 42 (the table immediately below), plus 2 more reachable only by
chaining through another URL-only page (table after it) — 44 total. This
document does not resolve why the counts differ (a stricter or looser
definition of "URL only," pages added since §4.6 was last written, or an
undercount at the time) — recorded here as a discrepancy for
`PROJECT_CONTEXT.md`'s own maintenance to resolve, not re-derived or ruled
on by this document.

| Route | Component | Description |
|---|---|---|
| `/universe/social-import` | `pages/UniverseSocialImportPage.jsx` | Standalone page wrapper that renders the Social Import view for a universe. |
| `/universe/series` | `pages/SeriesPage.jsx` | Standalone page for managing a universe's series, books, and linked shows (list/create/update/delete). |
| `/universe/production` | `pages/UniverseProductionPage.jsx` | Standalone page wrapper around `ProductionTab`, listing/managing a universe's shows for production. |
| `/universe/world-state` | `pages/UniverseWorldStatePage.jsx` | Standalone page rendering the "world-state" sub-tab of the `WorldStateTensions` component. |
| `/universe/tensions` | `pages/UniverseTensionsPage.jsx` | Standalone page rendering the "tensions" sub-tab of the `WorldStateTensions` component. |
| `/universe/story-dashboard` | `pages/StoryDashboardPage.jsx` | Standalone page wrapper that renders the Story Dashboard component. |
| `/universe/writing-rhythm` | `pages/WritingRhythmPage.jsx` | Standalone page wrapper that renders the Writing Rhythm component. |
| `/assets` | `pages/AssetLibrary.jsx` | Global asset library page for browsing/filtering/uploading show assets (logos, intros, music, wardrobe, etc.) by category and show. |
| `/studio/scene-set/:sceneSetId` | `pages/SceneStudioPage.jsx` | Route-level wrapper for Scene Studio, editing either a single scene or a scene set based on URL params. |
| `/shows/:showId/feed-timeline` | `pages/FeedTimelinePage.jsx` | Displays a social feed timeline of posts (with emotional impact, narrative function, engagement) tied to an episode. |
| `/episodes/:episodeId/beats` | `pages/BeatGeneration.jsx` | Page for viewing an episode's scenes and generating/reviewing AI script beats per scene. |
| `/episodes/:episodeId/icon-cues` | `pages/IconCueTimeline.jsx` | Timeline editor/viewer for AI-generated icon cues, cursor paths, and music cues for an episode. |
| `/episodes/:episodeId/composer`, `/template-studio` | `pages/TemplateStudio.jsx` | Template Management Dashboard: list, filter, clone, publish, lock, and archive thumbnail templates. |
| `/compositions/:id` | `pages/CompositionDetail.jsx` | Detail page for a single composition, with tabs for outputs, layout adjustment, and history; supports generating/deleting outputs. |
| `/admin/templates` | `pages/TemplateManagement.jsx` | Admin page to create, edit, and manage episode templates. |
| `/thumbnails/:episodeId` | `pages/ThumbnailGallery.jsx` | Gallery page listing episode thumbnails across platforms with search/status/platform filters. |
| `/write/:bookId/:chapterId` | `pages/WriteMode.jsx` | Unified writing hub combining a TOC sidebar, prose editor, and context panel for voice-first chapter writing. |
| `/chapter-structure/:bookId/:chapterId` | `pages/ChapterStructureEditor.jsx` | Structured chapter writing editor with visual hierarchy (headings, quotes, reflections), collapsible sections, auto-TOC, and templates. |
| `/setup` | `pages/SetupWizard.jsx` | Conversational onboarding wizard that walks the user through 7 world-building "beats" to build the universe. |
| `/therapy/:registryId` | `pages/CharacterTherapy.jsx` | Psychological narrative engine where a character processes story events via therapy-style sessions driven by wound patterns. |
| `/cultural-calendar` | `pages/CulturalCalendar.jsx` | Displays the LalaVerse cultural/social calendar system (major/micro events, awards, icon birthdays, drama mechanics). |
| `/world-setup` | `pages/WorldSetupGuide.jsx` | Step-by-step checklist guiding the user through world-building setup, with links to each page. |
| `/property-manager` | `pages/PropertyManager.jsx` | Manages character properties (mansions, penthouses, etc.), letting the user create properties and add rooms from style/room templates. |
| `/influencer-systems` | `pages/InfluencerSystems.jsx` | Reference/editor page for the influencer social systems doc: personality archetypes, relationship graph, creator economy, trend engines. |
| `/world-infrastructure` | `pages/WorldInfrastructure.jsx` | Reference/editor page documenting the LalaVerse's cities, universities, corporations, and legendary figures. |
| `/social-timeline` | `pages/SocialTimeline.jsx` | Reference/editor page for how the in-world social feed algorithm works (timeline layers, virality stages, engagement signals, drama triggers, trend cycle). |
| `/social-personality` | `pages/SocialPersonality.jsx` | Reference/editor page defining social-media personality traits, posting archetypes, motivations, and relationship dynamics for characters. |
| `/character-life-simulation` | `pages/CharacterLifeSimulation.jsx` | Reference/editor page simulating a character's life progression: career stages, paths, relationships, friend groups, rivalries, migration. |
| `/cultural-memory` | `pages/CulturalMemory.jsx` | Reference/editor page for the in-world "cultural memory" system: memory types, strength levels, archives, anniversaries, nostalgia waves. |
| `/character-depth-engine` | `pages/CharacterDepthEngine.jsx` | Reference/editor page defining deep character-psychology fields (body relationship, money patterns, time orientation, luck beliefs, self-narrative). |
| `/world-locations` | `pages/WorldLocations.jsx` | Manages the world's location database (cities, districts, venues, properties) with create/edit/delete and infrastructure seeding. |
| `/narrative-control` | `pages/NarrativeControlCenter.jsx` | Unified dashboard hub for narrative-intelligence features: pipeline tracker, continuity checks, character arcs, timelines, locations, snapshots, threads, plot holes, beats. |
| `/texture-review/:storyNumber` | `pages/TextureReviewPage.jsx` | Review/confirm/regenerate page for a character's "texture layers" (inner thought, conflict, body narrator, private moment, post, bleed) for a given story. |
| `/scene-proposer` | `pages/StoryProposer.jsx` | Scene Intelligence Engine UI: the system proposes candidate scenes/character-growth flags for the user to adjust, accept, or dismiss. |
| `/story-health` | `pages/StoryHealthDashboard.jsx` | Dashboard visualizing story quality scores, pacing, character arc %, thread resolution, and content velocity. |
| `/scene-studio` | `pages/SceneStudio.jsx` | Intimate book scene studio: scans relationships for tension triggers, generates/reads/approves scenes into StoryTeller. |
| `/pressure` | `pages/NarrativePressureDashboard.jsx` | Dashboard integrating the "Feed Nervous System" — eight zones answering "where is the tension living right now" across the narrative universe. |
| `/feed-relationships` | `pages/FeedRelationshipMap.jsx` | SVG canvas visualizing influencer-to-influencer relationships (nodes by feed state, edges by relationship type e.g. beef/collab/mentor). |
| `/assembler` | `pages/NovelAssembler.jsx` | Combines a character's approved stories and social imports into an assembled novel structure with emotional-curve visualization, chapters, and export. |
| `/press` | `pages/PressPublisher.jsx` | "The LalaVerse Press" publisher dashboard for tracking in-world journalist characters' careers and generating press content. |
| `/admin/audit` | `pages/AuditLog.jsx` | Admin-only viewer for filtering and paging through system audit logs. |
| `/amber` | `pages/AmberCommandCenter.jsx` | "Amber" command center showing an AI agent's diagnostic findings and proposed fixes, which the user approves and Amber executes. |

**Reachable only by chaining through another URL-only page** (not fully
"URL only" since an in-app link exists, but that link's own page has no
entry point either):

| Route | Component | Description | Only known caller |
|---|---|---|---|
| `/shows/:showId/feed-dashboard` | `pages/feed/EventFeedDashboard.jsx` | Dashboard for an episode's social feed events: viral tiers, trending topics, audience sentiment, and momentum. | `pages/FeedTimelinePage.jsx:255` (itself URL only) |
| `/scene-library` | `pages/SceneLibrary.jsx` | Library page for managing scene sets and UI overlays (upload, search/filter by tags/status/show, tabs for Sets vs Overlays). | `pages/SceneDetail.jsx:75,168,182` and `pages/PropertyManager.jsx:158` — `PropertyManager` is itself URL only, and `SceneDetail` (`/scene-library/:sceneId`) is only linked from `SceneLibrary` itself, so this two-page cluster has no outside entry point found |

---

## 7. Main mapping table

Every page/tab this inventory could place on the HOST → EVENT → VENUE →
GUESTS → INVITATION → REQUIREMENTS → OUTFIT → GENERATE EPISODE → PRODUCE →
EVALUATE/ACCEPT → AFTERMATH sequence, or explicitly "no stage" for pages
outside the flow entirely.

| Stage | Page | Route | Component file | Reachable how |
|---|---|---|---|---|
| HOST | The Feed (standalone) | `/feed` | `pages/SocialProfileGenerator.jsx` | in-app link (`components/Episodes/EpisodeOverviewTab.jsx:700`) |
| HOST | Lala's Feed (Producer Mode) | `/shows/:id/world?tab=feed-timeline` | `pages/WorldAdmin.jsx` (embeds `pages/SocialProfileGenerator.jsx`) | Sidebar → Producer Mode (`Sidebar.jsx:34`) |
| EVENT | Feed Events (Producer Mode) | `/shows/:id/world?tab=feed-events` | `pages/WorldAdmin.jsx` | Sidebar → Producer Mode |
| EVENT | Events Library (Producer Mode) | `/shows/:id/world?tab=events` | `pages/WorldAdmin.jsx` | Sidebar → Producer Mode |
| VENUE | Events Library event form | `/shows/:id/world?tab=events` | `pages/WorldAdmin.jsx:2540-2547` | same as above |
| GUESTS | Events Library event display (read-only) | `/shows/:id/world?tab=events` | `pages/WorldAdmin.jsx:1681,3116-3118,3528` | same as above |
| INVITATION | Events Library `InvitationButton` | `/shows/:id/world?tab=events` | `pages/InvitationGenerator.jsx` (rendered from `pages/WorldAdmin.jsx:3235,3862`) | same as above |
| REQUIREMENTS | Events Library event form | `/shows/:id/world?tab=events` | `pages/WorldAdmin.jsx:3009-3012` | same as above |
| OUTFIT | Events Library outfit picker | `/shows/:id/world?tab=events` | `pages/WorldAdmin.jsx:3245,4080` | same as above |
| GENERATE EPISODE | Events Library "Generate Episode" button | `/shows/:id/world?tab=events` | `pages/WorldAdmin.jsx:3256-3276` | same as above |
| PRODUCE | Episode Detail — Production tab | `/episodes/:episodeId` | `pages/EpisodeDetail.jsx:85-91` | in-app link (many; see §1) |
| EVALUATE/ACCEPT | Evaluate Episode (standalone) | `/episodes/:id/evaluate` | `pages/EvaluateEpisode.jsx` | in-app link (`pages/WorldAdmin.jsx:1780`) |
| EVALUATE/ACCEPT | Episode Detail — Results/Evaluation tab | `/episodes/:episodeId` | `pages/EpisodeDetail.jsx` | in-app link (many; see §1) — does not resolve whether this duplicates or wraps the standalone page, see §4 |
| AFTERMATH | — no page found — | — | — | gap, see §5 |

All other routes in §1 — the majority of the 113 — sit outside this
lifecycle entirely (writing/book tools, franchise/world-building reference
pages, admin/system pages, the composition/template/thumbnail pipeline,
etc.) and are marked "no stage" by omission from this table; §1 is their
complete record.

---

## What this document does not do

- does not move, rename, or edit any page or route;
- does not recommend anything beyond the duplicates (§4) and gaps (§5)
  it was asked to flag, and the two likely-broken-link observations in §1;
- does not edit anything under `docs/audit/`, and is not itself an
  audit-register document;
- mints no FD, XK, or PE number;
- makes no host, AWS, database, or Cognito contact.
