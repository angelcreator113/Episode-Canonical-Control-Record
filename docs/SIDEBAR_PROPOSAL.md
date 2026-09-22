# Sidebar Proposal — Every Route, Sorted

## Status of this document

**A proposal for Evoni to approve, reject, or amend.** Not filed under
`docs/audit/`; rules nothing and mints no FD/XK/PE number. It changes no
code: `Sidebar.jsx`, `App.jsx`, and every route are untouched by the task
that wrote it. A second task, after approval, makes the navigation change.

Basis: `origin/main` at `6bf43c87c31cbb7d3a5b677c2154eff938e92d65`
(2026-09-22). Paths are relative to `frontend/src/`. Citations name the
component, function, or constant first; line numbers are paired with the
name and read against this basis only.

Sources: `docs/DESIGN_DOCTRINE.md` (rule 1, the three questions; rule 6,
libraries versus workflows; "Not decided here") and `docs/PAGE_INVENTORY.md`
(basis `6a3bdd9d`). Every route, Sidebar entry, and doorway below was
re-derived at this document's own basis, not copied from the inventory.

Legend used throughout:

- **E** — everyday sidebar entry
- **C** — child surface of a named parent (reached from inside the parent)
- **T** — contextual tool opened from a named place
- **A** — admin or diagnostic tool (out of everyday navigation)
- **R** — retirement or redirect candidate (route kept working; see §7)
- **doorway needed** — no live in-app way in exists at this basis; the
  proposal names where one should go. These are findings, collected in §5.

A doorway counts only if its caller is itself rendered. Three components
that hold route links have no live importer at this basis and so provide no
doorway: `EpisodeProductionChecklist` (imported only by its own test),
`ChapterSelection` (no importer), and `FranchiseBrain` (imported only by its
own test). `ProductionTab` (`pages/ProductionTab.jsx`) is rendered only by
`UniverseProductionPage` at `/universe/production`, which is itself URL-only,
so its links are a chain with no entry.

---

## 1. Where the inventory is now stale

Re-derived from `App.jsx` at basis: **120 `<Route>` elements, 117 unique
paths** (inventory: 117 elements, 113 paths). Differences:

| Change | Detail |
|---|---|
| New route | `/shows/:showId/new-episode` → `NewEpisodeChooseHost` (inline in `App.jsx`, Task #1628). Reached from `ShowDetail` (`handleCreateEpisode`, :147; empty-state button :321) and `WorldAdmin` (:1905). |
| New route | `/shows/:showId/events/:eventId` → `EventPackagePage` (Task #1642). The inventory's §3/§7 mention the page but §1's route table has no row for it. Reached from the `WorldAdmin` events card (`openPackage`, :3123) and `SocialProfileGenerator` choose-host flow (:372). |
| Uncounted route | `/__dev-token-carrier` → `DevTokenCarrier`, pre-auth block, mounted only when `import.meta.env.DEV`. Not a production route; out of scope for the sidebar. |
| Line numbers | Every `App.jsx` line the inventory cites has shifted (e.g. `/` is :341, not :323). `Sidebar.jsx`'s `buildNav` items shifted by one after "Lala's Feed" was added. |
| File moved | `ProductionTab` is `pages/ProductionTab.jsx`, not `components/Show/ProductionTab.jsx` as §1 cites. |
| Doorway overcounted | `/scene-library`, `/episodes/:episodeId/plan`, `…/script-writer`, `…/todo`, `…/evaluate` gained links in `EpisodeProductionChecklist` — but that component isn't rendered, so none of those links count. `/scene-library` is still unreachable (§5). |
| Doorway overcounted | `/shows/:id/settings` and `/shows/:showId/quick-episode`: the inventory cites `ProductionTab` as a caller. It's a chain through a URL-only page. `/quick-episode` is still reached from `ShowDetail` (:351). `/settings` has **no** live doorway (§5). |
| Doorway gained | `/studio/timeline` is also linked from `EpisodeScenesTab` (:407). `/character-registry` from `Home`, `SessionStart`, `UniversePage`, `WorldStudio`, `RelationshipEngine/WebView`. `/relationships` from `WorldStudio` (:1692). `/feed` from `CharacterProfilePage` (:483) and `WorldAdmin`'s legacy-tab redirect (:336). `/show-bible` and `/world-studio` from `UniversePage` (:214–215). `/template-studio` from `TemplateDesigner` (:732, :778) — but the designer is reachable only from `TemplateStudio`, so the pair is a closed loop. |
| Command Palette | `RESULT_ROUTES.location` sends to `/world-studio?tab=locations`; `WorldStudio` v5 removed its Locations tab (header comment), so it opens on Characters instead. Not a recorded fault, noted in §6. |

---

## 2. The Sidebar at basis

`buildNav()` in `components/layout/Sidebar.jsx` (:14–82), plus fixed
entries:

| Zone | Entry → route |
|---|---|
| (fixed) | brand mark → `/start` (:173); Home → `/` (`NavLink`, :202); footer avatar → `/settings` (:418) |
| FRANCHISE | LalaVerse `/universe` · Show Bible `/show-bible` · World Dashboard `/world-dashboard` · World Foundation `/world-foundation` · Social Systems `/social-systems` · Culture & Events `/culture-events` · Lala's Feed `/feed?layer=lalaverse` |
| PRODUCE | Producer Mode `/shows/:id/world?tab=overview` (only when a show exists) · Shows `/shows`, expandable to each `/shows/:id` and `+ New Show` `/shows/create` |
| WRITE | Stories `/stories` (children: Structure `/story-engine`, Threads `/story-threads`, Calendar `/story-calendar`) · Characters `/character-registry?view=world` · Relationships `/relationships` |
| STUDIO | Timeline Editor `/studio/timeline` · Compositions `/library` |
| SYSTEM | CFO Agent `/cfo` (children: Analytics `/analytics/decisions`, AI Costs `/ai-costs`) · Site Organizer · Design Agent · Search · Admin `/admin` (child: Diagnostics) · Recycle Bin · Settings |
| (below nav) | `SidebarProgress` — a "next step" card whose steps link into Producer Mode, and one dead link (§6) |

Observations: the file's header comment says "4 zones: WRITE · WORLD ·
PRODUCE · MANAGE" while `buildNav` renders five different ones. The
Structure child points at `/story-engine`, which redirects to `/stories` —
its own parent. The `universeOpen` and `worldOpen` auto-expand effects are
still dead code (no `buildNav` item has `groups`, and none has
`route: '/world-studio'` with children), as the inventory recorded.

---

## 3. Every live route, classified

103 live authenticated routes. The 13 redirect routes and the pre-auth
entries are listed after the table; they need no sidebar decision.
"Doorway at basis" is what exists now; "Reached from" is the proposal.

### World — what exists

| Route | Page | Class | Reached from (proposed) | Doorway at basis | Reason |
|---|---|---|---|---|---|
| `/universe` | `UniversePage` | E | World | Sidebar | The LalaVerse overview; the world's front door. |
| `/show-bible` | `ShowBiblePage` | E | World | Sidebar | Canon reference for the show; answers "what exists". |
| `/world-dashboard` | `WorldDashboard` | C of LalaVerse | link on `UniversePage` | Sidebar | Setup progress is a second world overview beside LalaVerse; one overview per question. **doorway needed** before the entry moves. |
| `/world-foundation` | `WorldFoundation` | E | World | Sidebar | DREAM map, cities, locations. |
| `/social-systems` | `SocialSystems` | E | World | Sidebar | Archetypes, legends, rules, trends. |
| `/culture-events` | `CultureEvents` | E | World | Sidebar | The calendar and cultural memory. |
| `/feed` | `FeedEntry` → `SocialProfileGenerator` | E | World | Sidebar, `EpisodeOverviewTab`, `CharacterProfilePage` | Who exists in Lala's social world (EVENT_EPISODE_FLOW §8(k)). |
| `/world-studio` | `WorldStudio` | C of LalaVerse | `UniversePage`, character pages | `UniversePage`, `CharacterProfilePage`, `CharacterProfile`, `SceneStudio`, Command Palette | Its three tabs (Characters · Feed · Relationships) overlap three everyday entries; kept as a child, not promoted. |
| `/world-locations` | `WorldLocations` | R → `/world-foundation` | — | URL only | `WorldFoundation`'s header: "Merges: WorldInfrastructure + WorldLocations". |
| `/world-infrastructure` | `WorldInfrastructure` | R → `/world-foundation` | — | URL only | Same merge. |
| `/influencer-systems` | `InfluencerSystems` | R → `/social-systems` | — | URL only | `SocialSystems`' header: "Merges: InfluencerSystems + …". |
| `/cultural-calendar` | `CulturalCalendar` | R → `/culture-events` | — | URL only | Culture & Events' Events tab is the calendar. |
| `/cultural-memory` | `CulturalMemory` | R → `/culture-events` | — | URL only | Culture & Events' History tab is the memory system. |
| `/social-timeline` | `SocialTimeline` | C of Social Systems | link in `SocialSystems` | URL only | Feed-algorithm reference not covered by the merge. **doorway needed.** |
| `/social-personality` | `SocialPersonality` | C of Social Systems | link in `SocialSystems` | URL only | Posting-archetype reference not covered by the merge. **doorway needed.** |
| `/character-life-simulation` | `CharacterLifeSimulation` | C of Characters | link in `CharacterRegistryPage` | URL only | Character life-path reference. **doorway needed.** |
| `/character-depth-engine` | `CharacterDepthEngine` | C of Characters | link in `CharacterRegistryPage` | URL only | Character psychology reference. **doorway needed.** |
| `/property-manager` | `PropertyManager` | C of World Foundation | Locations tab | URL only | Properties and rooms belong with locations. **doorway needed.** |
| `/pressure` | `NarrativePressureDashboard` | C of LalaVerse | link on `UniversePage` | URL only | "Where is the tension living right now": world state. **doorway needed.** |
| `/feed-relationships` | `FeedRelationshipMap` | C of Lala's Feed | link in the Feed | URL only | A map of the same influencers the Feed lists. **doorway needed.** |
| `/press` | `PressPublisher` | C of Culture & Events | Awards & Media tab | URL only | In-world journalists belong with media coverage. **doorway needed.** |
| `/universe/world-state` | `UniverseWorldStatePage` | C of LalaVerse | link on `UniversePage` | URL only | Only home of `WorldStateTensions`' world-state view. **doorway needed.** |
| `/universe/tensions` | `UniverseTensionsPage` | C of LalaVerse | link on `UniversePage` | URL only | Only home of the tensions view. **doorway needed.** |
| `/universe/series` | `SeriesPage` | C of LalaVerse | link on `UniversePage` | URL only | Series, books, and linked shows; `UniversePage` already describes series in its header. **doorway needed.** |
| `/universe/social-import` | `UniverseSocialImportPage` | C of Lala's Feed | link in the Feed | URL only (and `/social-import` redirect) | Only home of `SocialImport`. `App.jsx` comments that Social Import "is now embedded in Universe page as a tab"; `UniversePage` at basis doesn't import it. **doorway needed.** |
| `/world-setup` | `WorldSetupGuide` | R → `/world-dashboard` | — | URL only | Its step list duplicates `WorldDashboard`'s `STEPS` (same routes, same order). |
| `/setup` | `SetupWizard` | T from World Dashboard | an empty-world prompt | URL only | Conversational onboarding: a one-off tool, not a place. **doorway needed.** |
| `/story-evaluation` | `StoryEvaluationEngine` | T from World Dashboard | tension proposals | `WorldDashboard` (:121), `WorldStateTensions`, `StoryProposer` | Opened with a proposal in hand; not a destination. |

### Produce — what am I making now

| Route | Page | Class | Reached from (proposed) | Doorway at basis | Reason |
|---|---|---|---|---|---|
| `/shows/:id/world` | `WorldAdmin` (Producer Mode) | E | Produce | Sidebar, `ShowDetail`, `StudioTab`, `UniversePage` | Production status for the show. |
| `/shows` | `ShowManagement` | E | Produce | Sidebar, `Home`, many | Show list; keeps its expander. |
| `/shows/create` | `CreateShow` | C of Shows | Shows expander | Sidebar, `ShowManagement` | Unchanged. |
| `/shows/:id` | `ShowDetail` | C of Shows | Shows expander | Sidebar, `ShowManagement`, `EpisodeDetail` | Unchanged. |
| `/shows/:id/edit` | `EditShow` | C of Show Detail | — | `ShowDetail` (:219), `ShowManagement` | Unchanged. |
| `/shows/:id/settings` | `ShowSettings` | C of Show Detail | link beside Edit in `ShowDetail` | chain only (`ProductionTab`) | **doorway needed.** |
| `/shows/:showId/new-episode` | `NewEpisodeChooseHost` | T from Show Detail / Producer Mode | — | `ShowDetail`, `WorldAdmin` | New Episode begins with choosing a host. |
| `/shows/:showId/quick-episode` | `QuickEpisodeCreator` | T from Show Detail | — | `ShowDetail` (:351) | Kanban's create action. |
| `/shows/:showId/events/:eventId` | `EventPackagePage` | C of Producer Mode › Events | — | `WorldAdmin` (:3123), `SocialProfileGenerator` | An event package is opened from its card. |
| `/wardrobe/calendar` | `OutfitCalendar` | T from Producer Mode › Wardrobe | — | `WorldAdmin` (:5400, `window.open`) | Unchanged. |
| `/studio/timeline` | `StudioTimelinePage` | E | Produce (Studio) | Sidebar, `EpisodeScenesTab` | Evoni: Timeline Editor stays an everyday production surface. |
| `/library` | `CompositionLibrary` | E | Produce (Studio) | Sidebar, `CompositionDetail` | Evoni: Compositions stays an everyday production surface. Library-shaped by doctrine rule 6 — see §4 note. |
| `/compositions/:id` | `CompositionDetail` | C of Compositions | click on a composition card | URL only | `CompositionLibrary` never navigates to a detail. **doorway needed.** |
| `/episodes/create` | `CreateEpisode` | T from Home / Timeline Editor | — | `Home` (:264), `StudioTimelinePage` (:66) | Unchanged. |
| `/episodes/:episodeId` | `EpisodeDetail` | C of Producer Mode / Show Detail | — | many | Unchanged. |
| `/episodes/:episodeId/edit` | `QuickEpisodeCreator` | T from Episode Detail | — | `EpisodeDetail`, `ShowDetail`, `workflowRouter` | Unchanged. |
| `/episodes/:episodeId/plan` | `ScenePlannerPage` | C of Episode Detail | — | `EpisodeScenesTab`, `EpisodeOverviewTab`, `workflowRouter` | Unchanged. |
| `/episodes/:episodeId/script-writer` | `EpisodeScriptWriterPage` | C of Episode Detail | — | `EpisodeOverviewTab`, `WorldAdmin` (:4992) | Unchanged. |
| `/episodes/:episodeId/todo` | `EpisodeTodoPage` | C of Episode Detail | — | `WorldAdmin` (:1824), `EpisodeScriptWriterPage` | Unchanged. |
| `/episodes/:id/evaluate` | `EvaluateEpisode` | C of Episode Detail | — | `WorldAdmin` (:1825) | Duplicate of Episode Detail's evaluation tab, per inventory §4 — unresolved, not this proposal's question. |
| `/episodes/:episodeId/timeline` | `TimelineEditor` | C of Timeline Editor | Studio picker | `StudioTimelinePage`, `ExportPage`, `workflowRouter` | Unchanged. |
| `/episodes/:episodeId/export` | `ExportPage` | T from Timeline Editor | — | `ExportDropdown` (in `TimelineEditor`), `EpisodeReview` | Unchanged. |
| `/episodes/:episodeId/review` | `EpisodeReview` | T from the episode Kanban | — | `workflowRouter` via `EpisodeKanbanBoard` | Unchanged. |
| `/episodes/:episodeId/beats` | `BeatGeneration` | C of Episode Detail | Scenes tab | URL only | **doorway needed** (or retire if Script Writer superseded it — Evoni's call). |
| `/episodes/:episodeId/icon-cues` | `IconCueTimeline` | C of Timeline Editor | editor toolbar | URL only | **doorway needed.** |
| `/thumbnails/:episodeId` | `ThumbnailGallery` | C of Episode Detail | a Thumbnails action | URL only | **doorway needed**; its own outbound link is also dead (§6). |
| `/shows/:showId/feed-timeline` | `FeedTimelinePage` | C of Episode Detail | episode feed action | URL only | Episode-scoped feed activity. **doorway needed.** |
| `/shows/:showId/feed-dashboard` | `EventFeedDashboard` | C of the episode feed timeline | — | `FeedTimelinePage` (:255), itself URL only | Chain; fixed when its parent gets a doorway. |
| `/studio/scene/:sceneId` | `SceneStudioPage` | T from Episode Scenes tab | — | `EpisodeScenesTab` (:453) | Unchanged. |
| `/studio/scene-set/:sceneSetId` | `SceneStudioPage` | T from Scene Sets | Producer Mode › Scene Sets and Scene Library | URL only | **doorway needed.** |
| `/phone-hub` | `UIOverlaysTab` | C of Producer Mode | Assets › Lala's Phone | `Home` (:280) | Producer Mode already embeds the same component as its `overlays-tab`; keep Home's link. |
| `/universe/production` | `UniverseProductionPage` → `ProductionTab` | R → `/shows` | — | URL only | A second show list for production beside Shows. It's the only renderer of `ProductionTab`, whose links are a chain with no entry; confirm nothing unique before redirecting. |
| `/episodes/:episodeId/composer` | `TemplateStudio` | R → `/template-studio` | — | URL only | Same component as `/template-studio`, mounted on an episode path nothing links to. |

### Library — what reusable things do I have

| Route | Page | Class | Reached from (proposed) | Doorway at basis | Reason |
|---|---|---|---|---|---|
| `/assets` | `AssetLibrary` | E | Library | URL only (+ `/universe/assets` redirect) | Reusable show assets; search/filter/browse. |
| `/scene-library` | `SceneLibrary` | E | Library | chain only (`PropertyManager`, `SceneDetail`; `EpisodeProductionChecklist` unrendered) | Reusable scene sets and overlays. `StudioTab` and `SidebarProgress` both *try* to link here and miss (§6). |
| `/scene-library/:sceneId` | `SceneDetail` | C of Scene Library | — | `SceneLibrary` (:441) | Unchanged. |
| `/template-studio` | `TemplateStudio` | E | Library | closed loop with `TemplateDesigner` | Reusable thumbnail templates. |
| `/template-studio/designer` | `TemplateDesigner` | C of Templates | — | `TemplateStudio` (:64) | Unchanged. |
| `/template-studio/designer/:templateId` | `TemplateDesigner` | C of Templates | — | `TemplateStudio` (:72) | Unchanged. |

### Write — stories, characters, relationships (placement open, §4)

| Route | Page | Class | Reached from (proposed) | Doorway at basis | Reason |
|---|---|---|---|---|---|
| `/stories` | `StoriesPage` | E | Write | Sidebar, `EpisodeDetail` | The book side's front door. |
| `/story-threads` | `StoryThreadTracker` | C of Stories | Stories children | Sidebar child, Command Palette | Keeps its sidebar child. |
| `/story-calendar` | `StoryCalendar` | C of Stories | Stories children | Sidebar child, Command Palette | Keeps its sidebar child. |
| `/character-registry` | `CharacterRegistryPage` | E | Write (or World) | Sidebar, many | Characters. |
| `/character/:id` | `CharacterProfilePage` | C of Characters | — | `CharacterRegistryPage` (:124) | Unchanged. |
| `/relationships` | `RelationshipEngine` | E | Write (or World) | Sidebar, `WorldStudio` | Relationships. |
| `/continuity` | `ContinuityEnginePage` | C of Stories | Stories children | `Home` (:276) | Story continuity; keep Home's link, add a child. |
| `/narrative-control` | `NarrativeControlCenter` | C of Stories | Stories children | URL only | Hub for narrative intelligence. **doorway needed.** |
| `/story-health` | `StoryHealthDashboard` | C of Stories | Stories children | URL only | **doorway needed.** |
| `/scene-proposer` | `StoryProposer` | T from Stories | a "Propose scenes" action | URL only | **doorway needed.** |
| `/assembler` | `NovelAssembler` | C of Stories | a book action | URL only | **doorway needed.** |
| `/scene-studio` | `SceneStudio` (book scenes) | T from Relationships | tension triggers | URL only | Scans relationships for scene triggers. **doorway needed.** |
| `/therapy/:registryId` | `CharacterTherapy` | T from Character profile | profile action | URL only | Needs a character in hand. **doorway needed.** |
| `/texture-review/:storyNumber` | `TextureReviewPage` | T from a story | story action | URL only | Needs a story in hand. **doorway needed.** |
| `/universe/story-dashboard` | `StoryDashboardPage` | C of Stories | Stories children | URL only | Only home of `StoryDashboard`. **doorway needed.** |
| `/universe/writing-rhythm` | `WritingRhythmPage` | C of Stories | Stories children | URL only | Only home of `WritingRhythm`. **doorway needed.** |
| `/chapter/:bookId/:chapterId` | `ChapterJourney` | C of Stories | — | `SessionStart` (:162), `WriteMode`, `ChapterStructureEditor` | Embeds `WriteMode`. |
| `/books/:bookId/read` | `ReadingMode` | T from Session Start | — | `SessionStart` (:191) | Unchanged. |
| `/book/:id` | `BookToWriteRedirect` (inline) | T from Write Mode | — | `WriteMode`, `ChapterStructureEditor` | Resolves to a book's first chapter. |
| `/chapter-structure/:bookId/:chapterId` | `ChapterStructureEditor` | T from Chapter Journey | chapter toolbar | URL only | **doorway needed.** |
| `/write/:bookId/:chapterId` | `WriteMode` | R → `/chapter/:bookId/:chapterId` | — | URL only | `ChapterJourney` already embeds `WriteMode`; confirm the standalone mount adds nothing before redirecting. |

### Everywhere — not one of the three questions

| Route | Page | Class | Reached from (proposed) | Doorway at basis | Reason |
|---|---|---|---|---|---|
| `/` | `Home` | E (top, ungrouped) | brand row | Sidebar, many | Landing. Home vs Producer Mode is a separate open question (doctrine). |
| `/start` | `SessionStart` | T from the brand mark | — | brand mark, `ChapterJourney` | Resume-where-you-left-off. |
| `/search` | `SearchResults` | E (top utility, ungrouped) | above the groups | Sidebar | Search crosses all three questions. |
| `/settings` | `SettingsPage` | E (footer) | footer avatar | Sidebar, avatar | Keeps the avatar; drops the SYSTEM row. |

### Admin — out of everyday navigation

| Route | Page | Class | Reached from (proposed) | Doorway at basis |
|---|---|---|---|---|
| `/admin` | `AdminPanel` | A — the admin index | one footer link, "Admin tools" | Sidebar |
| `/diagnostics` | `DiagnosticPage` | A | Admin index | Sidebar child |
| `/admin/audit` | `AuditLog` | A | Admin index | URL only |
| `/admin/templates` | `TemplateManagement` | A | Admin index | URL only |
| `/cfo` | `CFOAgent` | A | Admin index | Sidebar |
| `/analytics/decisions` | `DecisionAnalyticsDashboard` | A | Admin index (under CFO) | Sidebar child |
| `/ai-costs` | `AICostTracker` | A | Admin index (under CFO) | Sidebar child |
| `/site-organizer` | `SiteOrganizer` | A | Admin index | Sidebar |
| `/design-agent` | `DesignAgent` | A | Admin index | Sidebar |
| `/amber` | `AmberCommandCenter` | A | Admin index | URL only |
| `/recycle-bin` | `RecycleBin` | A | Admin index | Sidebar |

All eleven are tooling for running the system, not for making the show or
the book — doctrine rule 1.

### Redirect routes and pre-auth entries

The 13 authenticated redirects stay exactly as they are: `/universe/assets`,
`/universe/knowledge`, `/intelligence/franchise-brain`,
`/intelligence/show-brain`, `/episodes`, `/storyteller`, `/show-brain`,
`/story-engine`, `/social-import`, `/franchise-brain`, `/world`, `/login`,
`*`. Several are still link targets (`Home` sends to `/storyteller` and
`/episodes`; Command Palette to `/story-engine`); they work through the
redirect and aren't navigation faults. Pre-auth `/` (`LandingPage`),
`/login`, `*`, and the DEV-only `/__dev-token-carrier` are outside the
sidebar.

---

## 4. The proposed sidebar

```
Home                              /
Search                            /search

WORLD — what exists
  LalaVerse                       /universe
  Show Bible                      /show-bible
  World Foundation                /world-foundation
  Social Systems                  /social-systems
  Culture & Events                /culture-events
  Lala's Feed                     /feed?layer=lalaverse

PRODUCE — what am I making now
  Producer Mode                   /shows/:id/world?tab=overview   (when a show exists)
  Shows ▸                         /shows  (per-show links, + New Show)
  Timeline Editor                 /studio/timeline
  Compositions                    /library

LIBRARY — what reusable things do I have
  Assets                          /assets
  Scene Library                   /scene-library
  Templates                       /template-studio

WRITE — open question for Evoni (see below)
  Stories ▸                       /stories
      Threads · Calendar · Continuity · Story Health
      Narrative Control · Story Dashboard · Writing Rhythm
  Characters                      /character-registry?view=world
  Relationships                   /relationships

──────────
[SidebarProgress card]
Admin tools                       /admin
(avatar) Settings                 /settings
```

How it meets the rulings:

- **Three questions as the grouping.** World, Produce, and Library are the
  three groups; FRANCHISE becomes World, STUDIO folds into Produce, SYSTEM
  dissolves.
- **Studio stays visible.** Timeline Editor and Compositions stay everyday
  Produce entries, not tucked behind an admin or advanced area. Note:
  Compositions is library-shaped by doctrine rule 6 (browse and filter
  compositions). Moving it to Library would still keep it visible. It's
  under Produce here because the ruling names it a production surface.
- **Admin out.** SYSTEM's ten rows (children included) become one
  footer link, "Admin tools", except Search and Settings, which stay
  because they're everyday utilities, not admin.
- **Library is new.** Assets, Scene Library, and Templates are three
  reusable-thing libraries that are URL-only or a closed loop today, so
  this group adds doorways rather than moving them.

**Open — for Evoni: does Write stay its own group or fold into World?**
The two shapes:

- **A. Write stays.** As drawn above: the book side (Before Lala) keeps its
  own group, and Characters and Relationships sit with Stories because the
  memoir is where they're written.
- **B. Write folds into World.** Characters and Relationships move under
  World (they answer "what exists"; the Feed and Show Bible already sit
  there). Stories and its children become the last World entry, or a
  Produce entry for the book. World grows to nine rows.

This proposal doesn't choose. Either shape uses the same classification;
only the heading changes.

---

## 5. Routes that lose a sidebar entry, and where they go

| Route | Current entry | Reached instead | Doorway exists at basis? |
|---|---|---|---|
| `/world-dashboard` | FRANCHISE › World Dashboard | link on `UniversePage` | **No — finding.** `UniversePage` doesn't link to it. |
| `/story-engine` (redirect) | WRITE › Stories › Structure | `/stories` itself (it redirects there) | Yes — the entry was a self-link. The route stays. |
| `/cfo` | SYSTEM › CFO Agent | Admin index | **No — finding.** `AdminPanel` doesn't link to it. |
| `/analytics/decisions` | SYSTEM › CFO › Analytics | Admin index | **No — finding.** |
| `/ai-costs` | SYSTEM › CFO › AI Costs | Admin index | **No — finding.** |
| `/site-organizer` | SYSTEM › Site Organizer | Admin index | **No — finding.** |
| `/design-agent` | SYSTEM › Design Agent | Admin index | **No — finding.** |
| `/diagnostics` | SYSTEM › Admin › Diagnostics | Admin index | **No — finding.** |
| `/recycle-bin` | SYSTEM › Recycle Bin | Admin index | **No — finding.** |
| `/admin` | SYSTEM › Admin | footer "Admin tools" | Moves, doesn't lose. |
| `/settings` | SYSTEM › Settings | footer avatar | Yes — `Sidebar` (:418). |

**Nine routes would have no way in if the sidebar changed first.** Every one
depends on a doorway that doesn't exist yet: one link on `UniversePage` and
an Admin tools index on `AdminPanel` (listing CFO, Analytics, AI Costs,
Site Organizer, Design Agent, Diagnostics, Recycle Bin, plus the URL-only
Audit Log, Template Management, and Amber). §7 builds both before any entry
is removed.

**Routes with no doorway today, sidebar or not** (37 routes: the 30 §3
rows marked "doorway needed" other than World Dashboard, the chained
`/feed-dashboard`, three Library routes, and three URL-only admin routes). The proposal names a parent for each. Until the parent
links to it, the route stays URL-only:

- World: `/social-timeline`, `/social-personality`,
  `/character-life-simulation`, `/character-depth-engine`,
  `/property-manager`, `/pressure`, `/feed-relationships`, `/press`,
  `/universe/world-state`, `/universe/tensions`, `/universe/series`,
  `/universe/social-import`, `/setup`
- Produce: `/shows/:id/settings`, `/compositions/:id`,
  `/episodes/:episodeId/beats`, `/episodes/:episodeId/icon-cues`,
  `/thumbnails/:episodeId`, `/shows/:showId/feed-timeline` (and its chained
  `/feed-dashboard`), `/studio/scene-set/:sceneSetId`
- Library: `/assets`, `/scene-library`, `/template-studio` (gains a
  sidebar entry)
- Write: `/narrative-control`, `/story-health`, `/scene-proposer`,
  `/assembler`, `/scene-studio`, `/therapy/:registryId`,
  `/texture-review/:storyNumber`, `/universe/story-dashboard`,
  `/universe/writing-rhythm`, `/chapter-structure/:bookId/:chapterId`
- Admin: `/admin/audit`, `/admin/templates`, `/amber`

The nine R-class routes (`/world-locations`, `/world-infrastructure`,
`/influencer-systems`, `/cultural-calendar`, `/cultural-memory`,
`/world-setup`, `/universe/production`, `/episodes/:episodeId/composer`,
`/write/:bookId/:chapterId`), all URL-only, get no doorway: they're candidates to redirect
to the page that replaced them, which is a separate decision (§7).

---

## 6. Recorded navigation faults, re-checked at basis

| Fault (source) | Holds at basis? | Evidence |
|---|---|---|
| `TemplateStudio`'s dead `/composer` link (inventory §1) | **Yes** | `TemplateStudio.jsx:357`: `navigate(\`/composer?template=${template.id}\`)`. No `/composer` route; falls to the authenticated catch-all → `/`. |
| `ThumbnailGallery`'s dead thumbnail link (inventory §1) | **Yes** | `ThumbnailGallery.jsx:91`: `navigate(\`/episodes/${thumbnail.episode_id}/thumbnail/${thumbnail.id}\`)`. `App.jsx` has no route containing `thumbnail/`. |
| Orphan `opportunities` tab (inventory §2) | **Yes** | `WorldAdmin.jsx:4371` renders `OpportunitiesTab` when `activeTab === 'opportunities'`; `TABS` (:170–189) has no such key and no button switches to it. |
| `WorldAdmin`'s stale header comment (inventory §2b) | **Yes** | `WorldAdmin.jsx:1–16` still lists "7 Tabs" (Overview, Episode Ledger, Events Library, Career Goals, Wardrobe, Characters, Decision Log); `TABS` has five top-level tabs with nine sub-tabs. |

Found by this read, not previously recorded:

| Fault | Evidence |
|---|---|
| `SidebarProgress` "Lala's Phone" step is a dead link — **inside the sidebar itself** | `SidebarProgress.jsx:74`: `/shows/${showId}/scene-library?tab=overlays`. No `/shows/:id/scene-library` route; `window.location.href` lands on the catch-all → `/`. |
| `StudioTab`'s "Scene Library" quick link is dead | `components/Show/StudioTab.jsx:176`: `/shows/${showId}/scene-library` — same missing route. `StudioTab` is rendered by `ShowDetail`. |
| `StudioTab`'s "Lala's Feed" quick link goes the long way | `StudioTab.jsx:175`: `/shows/${showId}/world?tab=feed`. Works only through `WorldAdmin`'s legacy redirect to `/feed?layer=lalaverse` (:336). |
| `Home`'s blue action card is dead | `Home.jsx:268`: `navigate('/studio/scene-composer')`. No such route. |
| `EpisodeDetail`'s workflow steps are dead | `EpisodeDetail.jsx:441, :470, :476`: `/episodes/${id}/scene-composer`. No such route. |
| `CompositionLibrary`'s create buttons are dead | `CompositionLibrary.jsx:112, :118, :172, :236`: `/episodes/new/thumbnail/new`. No such route. |
| Command Palette location results miss their tab | `CommandPalette.jsx` `RESULT_ROUTES.location` → `/world-studio?tab=locations`; `WorldStudio` has no Locations tab. Lands on Characters, not a redirect. |
| `WorldDashboard`'s Locations step doesn't open Locations | `WorldDashboard` `STEPS` (:34) → `/world-foundation?tab=locations`; `WorldFoundation` keeps its tab in local state and never reads `?tab=`, so it opens on the map. `CultureEvents` doesn't read `?tab=` either, which matters if any redirect in §7 wants to target a tab. |
| `Sidebar.jsx` header comment is stale | Says "4 zones: WRITE · WORLD · PRODUCE · MANAGE"; `buildNav` renders FRANCHISE, PRODUCE, WRITE, STUDIO, SYSTEM. |

None of these is fixed by this document.

---

## 7. The smallest safe order of changes

**Standing rule: no route is removed.** Every path in `App.jsx` keeps
working throughout. A sidebar change only adds or moves links; retiring or
redirecting a route is a separate, later decision that needs its own
approval. Old bookmarks and deep links keep resolving.

1. **Build the doorways that entries will move to — before any entry
   moves.** An Admin tools index on `AdminPanel` linking all eleven admin
   routes, and a World Dashboard link on `UniversePage`. Nothing is
   removed. After this step, §5's nine "no" rows have a way in.
2. **Fix the dead links that point into navigation.** `SidebarProgress`
   (:74) and `StudioTab` (:176) → `/scene-library`; `StudioTab` (:175) →
   `/feed?layer=lalaverse`; `Home` (:268); `TemplateStudio` (:357). Each is
   a one-line link change with no route change. (The `EpisodeDetail`,
   `CompositionLibrary`, and `ThumbnailGallery` dead links need a decision
   about their target first, so they belong to their own task.)
3. **Add the Library group** (Assets, Scene Library, Templates). Purely
   additive: three URL-only routes gain an entry.
4. **Regroup the sidebar**, once Evoni answers the Write question: rename
   FRANCHISE → World, fold STUDIO into Produce, move World Dashboard out,
   drop the Structure self-link, replace SYSTEM with the footer Admin tools
   link. Update `Sidebar.jsx`'s header comment and remove the dead
   `universeOpen`/`worldOpen` effects in the same change.
5. **Add child doorways** from each named parent for the §5 "no doorway
   today" list — one parent page per task, so each is small and testable
   at 375px.
6. **Only then, and only with a separate approval, consider the R-class
   redirects** (§3). Each redirect keeps its path alive as a
   `<Navigate replace>`, the way `/storyteller` and `/show-brain` already
   do; none deletes a path.

Steps 1–3 can ship in any order among themselves; step 4 must wait for
steps 1 and 3 and for the Write answer.

---

## What this document does not do

- doesn't change `Sidebar.jsx`, `App.jsx`, or any route, page, or link;
- doesn't retire or redirect anything;
- doesn't answer the Write question, or the Home vs Producer Mode question;
- doesn't edit anything under `docs/audit/`, and is not a register document;
- mints no FD, XK, or PE number;
- made no host, AWS, database, or Cognito contact.
