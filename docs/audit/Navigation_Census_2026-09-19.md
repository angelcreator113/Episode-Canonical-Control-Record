# Navigation Census — 2026-09-19

**Basis:** `origin/main` at `7001e31f5d8ff5879d4ff5545ee183d175abdf42`, 2026-09-18 ("feat(frontend): four-state Production Checklist sections [skip-automerge] (#1533)").

**Type:** measurement only. This note records what `frontend/src/App.jsx` and
`frontend/src/components/layout/Sidebar.jsx` contain, cross-references the two, and flags four
conditions with file:line evidence. **It proposes no site map, renames nothing, rules nothing,
recommends no structure, and changes no code.** Every claim below is re-derived from these two
files (and, for the four flags, from a bounded `grep` sweep of `frontend/src` for inbound
navigation to specific paths — cited per finding). Nothing is carried from a prior chat or
document as fact.

---

## 1. Routes — `frontend/src/App.jsx`

### 1.1 Method

```
grep -n '<Route path=' frontend/src/App.jsx | wc -l          # 126 (single-line matches)
grep -n '<Route path=' frontend/src/App.jsx                  # line numbers + paths (below)
grep -c '<Route$\|<Route ' frontend/src/App.jsx              # 127 (includes one multi-line Route)
sed -n '278,287p' frontend/src/App.jsx                        # confirms the multi-line one
```

`App.jsx` renders **two separate `<Routes>` trees**, chosen by `isAuthenticated` (`App.jsx:273`,
`App.jsx:306`):

- An **unauthenticated router** (`App.jsx:275-289`), used only when `!isAuthenticated`. The
  Sidebar is never rendered in this state (`Sidebar` is only mounted inside the authenticated
  branch, `App.jsx:309-311`), so none of these 4 routes can have a Sidebar path by construction.
- An **authenticated router** (`App.jsx:323-573`), used once logged in. This is the one the
  Sidebar (also mounted at `App.jsx:310`) sits alongside, and is the subject of the
  cross-reference in §3.

**Total `<Route>` elements in `App.jsx`: 127** (4 unauthenticated + 123 authenticated).

### 1.2 Unauthenticated router (4 routes)

| # | Path | Component | Import (file:line) |
|---|---|---|---|
| 1 | `App.jsx:276` `/` | `LandingPage` | `App.jsx:12` `import LandingPage from './pages/LandingPage';` |
| 2 | `App.jsx:277` `/login` | `Login` | `App.jsx:11` `import Login from './pages/Login';` |
| 3 | `App.jsx:279-287` `/__dev-token-carrier` (dev-only, gated by `import.meta.env.DEV`, `App.jsx:278`) | `DevTokenCarrier` | `App.jsx:23-25` `const DevTokenCarrier = import.meta.env.DEV ? lazy(() => import('./pages/DevTokenCarrier')) : null;` |
| 4 | `App.jsx:288` `*` | `Navigate to="/"` | n/a — redirect, no component |

### 1.3 Authenticated router (123 routes)

Listed in file order, with component and import file:line. Grouped only by `App.jsx`'s own
`{/* ===== ... ===== */}` section comments — no new grouping invented.

**Dashboard / Universe** (`App.jsx:324-342`)

| Path | Component | Import |
|---|---|---|
| `/` (325) | `Home` | `App.jsx:13` |
| `/start` (326) | `SessionStart` | `App.jsx:116` |
| `/universe` (329) | `UniversePage` | `App.jsx:104` |
| `/universe/social-import` (330) | `UniverseSocialImportPage` | `App.jsx:107` |
| `/universe/series` (331) | `SeriesPage` | `App.jsx:105` |
| `/universe/production` (332) | `UniverseProductionPage` | `App.jsx:106` |
| `/universe/wardrobe` (333) | `Navigate to="/"` | redirect |
| `/universe/assets` (334) | `UniverseAssetsPage` | `App.jsx:108` |
| `/universe/world-state` (335) | `UniverseWorldStatePage` | `App.jsx:109` |
| `/universe/tensions` (336) | `UniverseTensionsPage` | `App.jsx:110` |
| `/universe/story-dashboard` (337) | `StoryDashboardPage` | `App.jsx:111` |
| `/show-bible` (338) | `ShowBiblePage` | `App.jsx:157` |
| `/universe/knowledge` (339) | `Navigate to="/show-bible"` | redirect |
| `/intelligence/franchise-brain` (340) | `Navigate to="/show-bible?tab=decisions"` | redirect |
| `/intelligence/show-brain` (341) | `Navigate to="/show-bible?tab=knowledge"` | redirect |
| `/universe/writing-rhythm` (342) | `WritingRhythmPage` | `App.jsx:112` |

**Pre-production** (`App.jsx:344-379`)

| Path | Component | Import |
|---|---|---|
| `/episodes` (347) | `Navigate to="/universe/production"` | redirect |
| `/episodes/create` (348) | `CreateEpisode` | `App.jsx:36` |
| `/episodes/:episodeId/edit` (349) | `QuickEpisodeCreator` | `App.jsx:131` |
| `/episodes/:id/evaluate` (350) | `EvaluateEpisode` | `App.jsx:66` |
| `/episodes/:episodeId/todo` (351) | `EpisodeTodoPage` | `App.jsx:67` |
| `/episodes/:episodeId` (352) | `EpisodeDetail` | `App.jsx:35` |
| `/assets` (355) | `AssetLibrary` | `App.jsx:78` |
| `/shows` (358) | `ShowManagement` | `App.jsx:49` |
| `/shows/create` (359) | `CreateShow` | `App.jsx:51` |
| `/shows/:id` (360) | `ShowDetail` | `App.jsx:50` |
| `/shows/:id/edit` (361) | `EditShow` | `App.jsx:52` |
| `/shows/:id/world` (362) | `WorldAdmin` | `App.jsx:68` |
| `/shows/:showId/quick-episode` (363) | `QuickEpisodeCreator` | `App.jsx:131` |
| `/shows/:id/settings` (364) | `ShowSettings` | `App.jsx:76` |
| `/studio/timeline` (366) | `StudioTimelinePage` | `App.jsx:132` |
| `/studio/scene/:sceneId` (369) | `SceneStudioPage` | `App.jsx:71` |
| `/studio/scene-set/:sceneSetId` (370) | `SceneStudioPage` | `App.jsx:71` |
| `/scene-library` (373) | `SceneLibrary` | `App.jsx:42` |
| `/phone-hub` (374) | `UIOverlaysTab` | `App.jsx:44` |
| `/episodes/:episodeId/plan` (375) | `ScenePlannerPage` | `App.jsx:72` |
| `/episodes/:episodeId/script-writer` (376) | `EpisodeScriptWriterPage` | `App.jsx:73` |
| `/shows/:showId/feed-timeline` (377) | `FeedTimelinePage` | `App.jsx:74` |
| `/shows/:showId/feed-dashboard` (378) | `EventFeedDashboard` | `App.jsx:75` |
| `/scene-library/:sceneId` (379) | `SceneDetail` | `App.jsx:43` |

**Animatic system** (`App.jsx:381-388`)

| Path | Component | Import |
|---|---|---|
| `/episodes/:episodeId/beats` (384) | `BeatGeneration` | `App.jsx:64` |
| `/episodes/:episodeId/timeline` (387) | `TimelineEditor` | `App.jsx:63` |
| `/episodes/:episodeId/icon-cues` (388) | `IconCueTimeline` | `App.jsx:37` |

**Production** (`App.jsx:390-412`)

| Path | Component | Import |
|---|---|---|
| `/wardrobe` (393) | `Navigate to="/"` | redirect |
| `/wardrobe/analytics` (394) | `Navigate to="/"` | redirect |
| `/wardrobe/outfits` (395) | `Navigate to="/"` | redirect |
| `/wardrobe/calendar` (396) | `OutfitCalendar` | `App.jsx:58` |
| `/wardrobe-library` (397) | `Navigate to="/"` | redirect |
| `/wardrobe-library/upload` (398) | `Navigate to="/"` | redirect |
| `/wardrobe-library/:id` (399) | `Navigate to="/"` | redirect |
| `/episodes/:episodeId/composer` (402) | `TemplateStudio` | `App.jsx:59` |
| `/template-studio` (403) | `TemplateStudio` | `App.jsx:59` |
| `/template-studio/designer` (404) | `TemplateDesigner` | `App.jsx:60` |
| `/template-studio/designer/:templateId` (405) | `TemplateDesigner` | `App.jsx:60` |
| `/library` (408) | `CompositionLibrary` | `App.jsx:40` |
| `/compositions/:id` (409) | `CompositionDetail` | `App.jsx:41` |
| `/admin/templates` (412) | `TemplateManagement` | `App.jsx:46` |

**Post-production** (`App.jsx:414-423`)

| Path | Component | Import |
|---|---|---|
| `/thumbnails/:episodeId` (417) | `ThumbnailGallery` | `App.jsx:39` |
| `/episodes/:episodeId/export` (420) | `ExportPage` | `App.jsx:77` |
| `/episodes/:episodeId/review` (423) | `EpisodeReview` | `App.jsx:65` |

**Management** (`App.jsx:425-572`)

| Path | Component | Import |
|---|---|---|
| `/stories` (428) | `StoriesPage` | `App.jsx:158` |
| `/storyteller` (429) | `Navigate to="/stories"` | redirect |
| `/book/:id` (430) | `BookToWriteRedirect` | defined inline, `App.jsx:80-101` (not a separate file) |
| `/books/:bookId/read` (431) | `ReadingMode` | `App.jsx:113` |
| `/chapter/:bookId/:chapterId` (432) | `ChapterJourney` | `App.jsx:129` |
| `/write/:bookId/:chapterId` (433) | `WriteMode` | `App.jsx:114` |
| `/chapter-structure/:bookId/:chapterId` (434) | `ChapterStructureEditor` | `App.jsx:130` |
| `/character-registry` (437) | `CharacterRegistryPage` | `App.jsx:102` |
| `/character/:id` (438) | `CharacterProfile` | `App.jsx:125` (`const CharacterProfile = lazy(() => import('./pages/CharacterProfilePage'));`) |
| `/character-generator` (439) | `Navigate to="/world-studio"` | redirect |
| `/setup` (440) | `SetupWizard` | `App.jsx:126` |
| `/therapy/:registryId` (443) | `CharacterTherapy` | `App.jsx:117` |
| `/continuity` (446) | `ContinuityEnginePage` | `App.jsx:103` |
| `/relationships` (449) | `RelationshipEngine` | `App.jsx:115` |
| `/cultural-calendar` (452) | `CulturalCalendar` | `App.jsx:142` |
| `/world-setup` (453) | `WorldSetupGuide` | `App.jsx:143` |
| `/property-manager` (454) | `PropertyManager` | `App.jsx:144` |
| `/influencer-systems` (457) | `InfluencerSystems` | `App.jsx:145` |
| `/world-infrastructure` (460) | `WorldInfrastructure` | `App.jsx:146` |
| `/social-timeline` (463) | `SocialTimeline` | `App.jsx:147` |
| `/social-personality` (466) | `SocialPersonality` | `App.jsx:148` |
| `/character-life-simulation` (469) | `CharacterLifeSimulation` | `App.jsx:149` |
| `/cultural-memory` (472) | `CulturalMemory` | `App.jsx:150` |
| `/character-depth-engine` (475) | `CharacterDepthEngine` | `App.jsx:151` |
| `/world-locations` (478) | `WorldLocations` | `App.jsx:152` |
| `/world-dashboard` (481) | `WorldDashboard` | `App.jsx:156` |
| `/world-foundation` (482) | `WorldFoundation` | `App.jsx:153` |
| `/social-systems` (483) | `SocialSystemsPage` | `App.jsx:154` |
| `/culture-events` (484) | `CultureEvents` | `App.jsx:155` |
| `/show-brain` (487) | `Navigate to="/intelligence/show-brain"` | redirect |
| `/narrative-control` (490) | `NarrativeControlCenter` | `App.jsx:134` |
| `/story-engine` (493) | `Navigate to="/stories"` | redirect |
| `/texture-review/:storyNumber` (496) | `TextureReviewPage` | `App.jsx:159` |
| `/story-evaluation` (499) | `StoryEvaluationEngine` | `App.jsx:119` |
| `/scene-proposer` (502) | `StoryProposer` | `App.jsx:120` |
| `/story-threads` (505) | `StoryThreadTracker` | `App.jsx:122` |
| `/story-calendar` (508) | `StoryCalendar` | `App.jsx:123` |
| `/story-health` (511) | `StoryHealthDashboard` | `App.jsx:124` |
| `/world-studio` (514) | `WorldStudio` | `App.jsx:69` |
| `/scene-studio` (517) | `SceneStudio` | `App.jsx:70` |
| `/feed` (520) | `SocialProfileGenerator` | `App.jsx:133` |
| `/pressure` (523) | `NarrativePressureDashboard` | `App.jsx:140` |
| `/feed-relationships` (524) | `FeedRelationshipMap` | `App.jsx:141` |
| `/social-import` (527) | `Navigate to="/universe/social-import"` | redirect |
| `/franchise-brain` (530) | `Navigate to="/intelligence/franchise-brain"` | redirect |
| `/assembler` (533) | `NovelAssembler` | `App.jsx:121` |
| `/press` (536) | `PressPublisher` | `App.jsx:118` |
| `/search` (539) | `SearchResults` | `App.jsx:38` |
| `/analytics/decisions` (542) | `DecisionAnalyticsDashboard` | `App.jsx:62` |
| `/ai-costs` (543) | `AICostTracker` | `App.jsx:136` |
| `/cfo` (544) | `CFOAgent` | `App.jsx:137` |
| `/site-organizer` (545) | `SiteOrganizer` | `App.jsx:138` |
| `/design-agent` (546) | `DesignAgent` | `App.jsx:139` |
| `/admin` (549) | `AdminPanel` | `App.jsx:45` |
| `/admin/audit` (550) | `AuditLog` | `App.jsx:48` |
| `/audit-log` (551) | `AuditLogViewer` | `App.jsx:47` |
| `/diagnostics` (554) | `DiagnosticPage` | `App.jsx:61` |
| `/amber` (557) | `AmberCommandCenter` | `App.jsx:135` |
| `/settings` (560) | `SettingsPage` | `App.jsx:127` |
| `/recycle-bin` (563) | `RecycleBin` | `App.jsx:128` |
| `/world` (566) | `Navigate to="/character-registry?view=world"` | redirect |
| `/login` (569) | `Navigate to="/"` | redirect (authenticated user hitting `/login`) |
| `*` (572) | `Navigate to="/"` | redirect (fallback) |

Count check: Dashboard/Universe 16 + Pre-production 24 + Animatic 3 + Production 14 + Post-production
3 + Management 63 = **123**, matching §1.1's total. All imported page/component files were
confirmed present on disk (no missing file among the 96 distinct import targets — see §4.4).

---

## 2. Sidebar — `frontend/src/components/layout/Sidebar.jsx`

### 2.1 Source (`buildNav`, `Sidebar.jsx:14-77`)

```js
function buildNav(shows) {
  const showId = shows[0]?.id;
  const showName = shows[0]?.name || 'Show';

  return [
    {
      zone: 'FRANCHISE',
      items: [
        { icon: '◈', label: 'LalaVerse', route: '/universe' },
        { icon: '📖', label: 'Show Bible', route: '/show-bible' },
        { icon: '🌍', label: 'World Dashboard', route: '/world-dashboard', hint: 'Setup progress & state' },
        { icon: '🏗️', label: 'World Foundation', route: '/world-foundation', hint: 'DREAM map, cities, locations' },
        { icon: '⭐', label: 'Social Systems', route: '/social-systems', hint: 'Archetypes, legends, trends' },
        { icon: '📅', label: 'Culture & Events', route: '/culture-events', hint: 'Calendar, memory, legacy' },
      ],
    },
    {
      zone: 'CREATE SHOW',
      items: [
        ...(showId ? [
          { icon: '📅', label: 'Producer Mode', route: `/shows/${showId}/world?tab=overview` },
        ] : []),
        { icon: '🎬', label: 'Shows', route: '/shows', expandable: true },
      ],
    },
    {
      zone: 'WRITE',
      items: [
        { icon: '✍️', label: 'Stories', route: '/stories' },
        { icon: '👥', label: 'Characters', route: '/character-registry?view=world' },
        { icon: '🔗', label: 'Relationships', route: '/world-studio?tab=relationships' },
      ],
    },
    {
      zone: 'STUDIO',
      items: [
        { icon: '⏱️', label: 'Timeline Editor', route: '/studio/timeline' },
        { icon: '📦', label: 'Compositions', route: '/library' },
      ],
    },
    {
      zone: 'MANAGE',
      items: [
        { icon: '💵', label: 'CFO Agent', route: '/cfo',
          children: [
            { icon: '📊', label: 'Analytics', route: '/analytics/decisions' },
            { icon: '💰', label: 'AI Costs', route: '/ai-costs' },
          ],
        },
        { icon: '🗺️', label: 'Site Organizer', route: '/site-organizer' },
        { icon: '🎨', label: 'Design Agent', route: '/design-agent' },
        { icon: '🔍', label: 'Search', route: '/search' },
        { icon: '🛡️', label: 'Admin', route: '/admin',
          children: [
            { icon: '📋', label: 'Audit Log', route: '/audit-log' },
            { icon: '🩺', label: 'Diagnostics', route: '/diagnostics' },
          ],
        },
        { icon: '🗑️', label: 'Recycle Bin', route: '/recycle-bin' },
        { icon: '⚙️', label: 'Settings', route: '/settings' },
      ],
    },
  ];
}
```

Plus one hardcoded item outside `buildNav`, rendered first (`Sidebar.jsx:196-205`): a `NavLink` to
`/` labeled "Home" (icon 🏠).

Plus one non-nav-item click target, the brand mark (`Sidebar.jsx:166-169`):
```js
<span className="ps-brand-mark" onClick={() => go('/start')}>
  PRIME<span className="ps-brand-diamond">◈</span>
</span>
```
This is a logo click, not a `buildNav` entry, so it is listed separately in §3 rather than folded
into "in sidebar: yes".

**Behavioral note (quoted, per instruction 6):** `Sidebar.jsx:15` — `const showId = shows[0]?.id;`.
The "Producer Mode" item (and `SidebarProgress` at `Sidebar.jsx:409`) is therefore always built from
the first show in whatever order `useShows()` (`Sidebar.jsx:81-93`) returns them, not a
"current"/selected show — there is no selection state in this file.

### 2.2 Entries in order, grouped by zone

| Order | Zone | Label | Route | Notes |
|---|---|---|---|---|
| 0 | *(none — precedes zones)* | Home | `/` | Hardcoded `NavLink`, `Sidebar.jsx:196-205` |
| 1 | FRANCHISE | LalaVerse | `/universe` | |
| 2 | FRANCHISE | Show Bible | `/show-bible` | |
| 3 | FRANCHISE | World Dashboard | `/world-dashboard` | hint: "Setup progress & state" |
| 4 | FRANCHISE | World Foundation | `/world-foundation` | hint: "DREAM map, cities, locations" |
| 5 | FRANCHISE | Social Systems | `/social-systems` | hint: "Archetypes, legends, trends" |
| 6 | FRANCHISE | Culture & Events | `/culture-events` | hint: "Calendar, memory, legacy" |
| 7 | CREATE SHOW | Producer Mode | `/shows/${showId}/world?tab=overview` | only rendered if a show exists (`shows[0]`) |
| 8 | CREATE SHOW | Shows | `/shows` | expandable; sub-list is `shows.map(...)` → `/shows/${show.id}` (`Sidebar.jsx:357-368`), plus a "+ New Show" link → `/shows/create` (`Sidebar.jsx:370-376`) |
| 9 | WRITE | Stories | `/stories` | |
| 10 | WRITE | Characters | `/character-registry?view=world` | |
| 11 | WRITE | Relationships | `/world-studio?tab=relationships` | |
| 12 | STUDIO | Timeline Editor | `/studio/timeline` | |
| 13 | STUDIO | Compositions | `/library` | |
| 14 | MANAGE | CFO Agent | `/cfo` | children below |
| 14a | MANAGE › CFO Agent | Analytics | `/analytics/decisions` | |
| 14b | MANAGE › CFO Agent | AI Costs | `/ai-costs` | |
| 15 | MANAGE | Site Organizer | `/site-organizer` | |
| 16 | MANAGE | Design Agent | `/design-agent` | |
| 17 | MANAGE | Search | `/search` | |
| 18 | MANAGE | Admin | `/admin` | children below |
| 18a | MANAGE › Admin | Audit Log | `/audit-log` | |
| 18b | MANAGE › Admin | Diagnostics | `/diagnostics` | |
| 19 | MANAGE | Recycle Bin | `/recycle-bin` | |
| 20 | MANAGE | Settings | `/settings` | |

That is **21 distinct route targets** reachable directly by clicking a Sidebar nav entry (Home +
6 FRANCHISE + 2 CREATE SHOW [base patterns; the "Shows" sub-list and "+ New Show" fold into
`/shows/:id` and `/shows/create`, already counted as their own row-equivalents in §3] + 3 WRITE +
2 STUDIO + 7 MANAGE, counting CFO Agent/Admin once each plus their two children apiece), plus the
brand-mark's `/start` and the dynamic `/shows/:id` sub-list, both called out separately as they are
not `buildNav` entries.

---

## 3. Cross-reference

"In sidebar" = a Sidebar entry's `route` (§2.2, ignoring query strings) resolves to this exact
path. The brand-mark's `/start` (§2.1) and the "Shows" sub-list's per-show `/shows/:id` links
(§2.2 row 8) are real Sidebar-rendered links but are not `buildNav` items, so they are marked
"yes (see note)" rather than a plain yes, to keep the distinction visible.

Only the 123 authenticated routes are cross-referenced — the Sidebar is never rendered for the 4
unauthenticated routes (§1.2), so "in sidebar" is inapplicable there by construction, not "no".

| Route | Component | In sidebar? | Sidebar label | Notes |
|---|---|---|---|---|
| `/` | Home | yes | Home | |
| `/start` | SessionStart | yes (see note) | — | reachable via brand-mark click, `Sidebar.jsx:167`, not a `buildNav` entry |
| `/universe` | UniversePage | yes | LalaVerse | see §4.3 mislabel |
| `/universe/social-import` | UniverseSocialImportPage | no | | |
| `/universe/series` | SeriesPage | no | | |
| `/universe/production` | UniverseProductionPage | no | | |
| `/universe/wardrobe` | (redirect → `/`) | no | | see §4.4 dead |
| `/universe/assets` | UniverseAssetsPage | no | | see §4.2 duplicate |
| `/universe/world-state` | UniverseWorldStatePage | no | | |
| `/universe/tensions` | UniverseTensionsPage | no | | |
| `/universe/story-dashboard` | StoryDashboardPage | no | | |
| `/show-bible` | ShowBiblePage | yes | Show Bible | |
| `/universe/knowledge` | (redirect → `/show-bible`) | no | | see §4.4 dead |
| `/intelligence/franchise-brain` | (redirect → `/show-bible?tab=decisions`) | no | | see §4.4 dead |
| `/intelligence/show-brain` | (redirect → `/show-bible?tab=knowledge`) | no | | see §4.4 dead |
| `/universe/writing-rhythm` | WritingRhythmPage | no | | |
| `/episodes` | (redirect → `/universe/production`) | no | | see §4.4 dead |
| `/episodes/create` | CreateEpisode | no | | |
| `/episodes/:episodeId/edit` | QuickEpisodeCreator | no | | |
| `/episodes/:id/evaluate` | EvaluateEpisode | no | | |
| `/episodes/:episodeId/todo` | EpisodeTodoPage | no | | |
| `/episodes/:episodeId` | EpisodeDetail | no | | |
| `/assets` | AssetLibrary | no | | see §4.2 duplicate |
| `/shows` | ShowManagement | yes | Shows | |
| `/shows/create` | CreateShow | yes | (Shows sub-list "+ New Show") | |
| `/shows/:id` | ShowDetail | yes (see note) | (Shows sub-list, per-show link) | `Sidebar.jsx:357-368` |
| `/shows/:id/edit` | EditShow | no | | |
| `/shows/:id/world` | WorldAdmin | yes | Producer Mode | also linked from many other pages, §4.3 |
| `/shows/:showId/quick-episode` | QuickEpisodeCreator | no | | |
| `/shows/:id/settings` | ShowSettings | no | | |
| `/studio/timeline` | StudioTimelinePage | yes | Timeline Editor | |
| `/studio/scene/:sceneId` | SceneStudioPage | no | | |
| `/studio/scene-set/:sceneSetId` | SceneStudioPage | no | | see §4.1 unreachable |
| `/scene-library` | SceneLibrary | no | | |
| `/phone-hub` | UIOverlaysTab | no | | |
| `/episodes/:episodeId/plan` | ScenePlannerPage | no | | |
| `/episodes/:episodeId/script-writer` | EpisodeScriptWriterPage | no | | |
| `/shows/:showId/feed-timeline` | FeedTimelinePage | no | | see §4.1 unreachable |
| `/shows/:showId/feed-dashboard` | EventFeedDashboard | no | | see §4.1 unreachable |
| `/scene-library/:sceneId` | SceneDetail | no | | |
| `/episodes/:episodeId/beats` | BeatGeneration | no | | see §4.1 unreachable |
| `/episodes/:episodeId/timeline` | TimelineEditor | no | | |
| `/episodes/:episodeId/icon-cues` | IconCueTimeline | no | | see §4.1 unreachable |
| `/wardrobe` | (redirect → `/`) | no | | see §4.4 dead |
| `/wardrobe/analytics` | (redirect → `/`) | no | | see §4.4 dead |
| `/wardrobe/outfits` | (redirect → `/`) | no | | see §4.4 dead |
| `/wardrobe/calendar` | OutfitCalendar | no | | |
| `/wardrobe-library` | (redirect → `/`) | no | | see §4.4 dead |
| `/wardrobe-library/upload` | (redirect → `/`) | no | | see §4.4 dead |
| `/wardrobe-library/:id` | (redirect → `/`) | no | | see §4.4 dead |
| `/episodes/:episodeId/composer` | TemplateStudio | no | | see §4.1 unreachable |
| `/template-studio` | TemplateStudio | no | | |
| `/template-studio/designer` | TemplateDesigner | no | | |
| `/template-studio/designer/:templateId` | TemplateDesigner | no | | |
| `/library` | CompositionLibrary | yes | Compositions | |
| `/compositions/:id` | CompositionDetail | no | | see §4.1 unreachable |
| `/admin/templates` | TemplateManagement | no | | |
| `/thumbnails/:episodeId` | ThumbnailGallery | no | | see §4.1 unreachable |
| `/episodes/:episodeId/export` | ExportPage | no | | |
| `/episodes/:episodeId/review` | EpisodeReview | no | | |
| `/stories` | StoriesPage | yes | Stories | |
| `/storyteller` | (redirect → `/stories`) | no | | see §4.4 dead |
| `/book/:id` | BookToWriteRedirect | no | | itself redirects onward, see §4.4 |
| `/books/:bookId/read` | ReadingMode | no | | |
| `/chapter/:bookId/:chapterId` | ChapterJourney | no | | |
| `/write/:bookId/:chapterId` | WriteMode | no | | |
| `/chapter-structure/:bookId/:chapterId` | ChapterStructureEditor | no | | |
| `/character-registry` | CharacterRegistryPage | yes | Characters | |
| `/character/:id` | CharacterProfile | no | | |
| `/character-generator` | (redirect → `/world-studio`) | no | | see §4.4 dead |
| `/setup` | SetupWizard | no | | |
| `/therapy/:registryId` | CharacterTherapy | no | | see §4.1 unreachable |
| `/continuity` | ContinuityEnginePage | no | | |
| `/relationships` | RelationshipEngine | no | | see §4.2 duplicate |
| `/cultural-calendar` | CulturalCalendar | no | | |
| `/world-setup` | WorldSetupGuide | no | | |
| `/property-manager` | PropertyManager | no | | |
| `/influencer-systems` | InfluencerSystems | no | | see §4.1 unreachable |
| `/world-infrastructure` | WorldInfrastructure | no | | see §4.1 unreachable |
| `/social-timeline` | SocialTimeline | no | | see §4.1 unreachable |
| `/social-personality` | SocialPersonality | no | | see §4.1 unreachable |
| `/character-life-simulation` | CharacterLifeSimulation | no | | see §4.1 unreachable |
| `/cultural-memory` | CulturalMemory | no | | see §4.1 unreachable |
| `/character-depth-engine` | CharacterDepthEngine | no | | see §4.1 unreachable |
| `/world-locations` | WorldLocations | no | | see §4.1 unreachable |
| `/world-dashboard` | WorldDashboard | yes | World Dashboard | |
| `/world-foundation` | WorldFoundation | yes | World Foundation | |
| `/social-systems` | SocialSystemsPage | yes | Social Systems | |
| `/culture-events` | CultureEvents | yes | Culture & Events | |
| `/show-brain` | (redirect → `/intelligence/show-brain`) | no | | see §4.4 dead |
| `/narrative-control` | NarrativeControlCenter | no | | see §4.1 unreachable |
| `/story-engine` | (redirect → `/stories`) | no | | reachable via global Command Palette, see §4.1; also §4.4 dead |
| `/texture-review/:storyNumber` | TextureReviewPage | no | | see §4.1 unreachable |
| `/story-evaluation` | StoryEvaluationEngine | no | | |
| `/scene-proposer` | StoryProposer | no | | see §4.1 unreachable |
| `/story-threads` | StoryThreadTracker | no | | reachable via global Command Palette, see §4.1 |
| `/story-calendar` | StoryCalendar | no | | reachable via global Command Palette, see §4.1 |
| `/story-health` | StoryHealthDashboard | no | | see §4.1 unreachable |
| `/world-studio` | WorldStudio | yes | Relationships | see §4.3 mislabel |
| `/scene-studio` | SceneStudio | no | | see §4.1 unreachable |
| `/feed` | SocialProfileGenerator | no | | |
| `/pressure` | NarrativePressureDashboard | no | | see §4.1 unreachable |
| `/feed-relationships` | FeedRelationshipMap | no | | see §4.1 unreachable |
| `/social-import` | (redirect → `/universe/social-import`) | no | | see §4.4 dead |
| `/franchise-brain` | (redirect → `/intelligence/franchise-brain`) | no | | see §4.4 dead |
| `/assembler` | NovelAssembler | no | | see §4.1 unreachable |
| `/press` | PressPublisher | no | | see §4.1 unreachable |
| `/search` | SearchResults | yes | Search | |
| `/analytics/decisions` | DecisionAnalyticsDashboard | yes | Analytics (CFO Agent child) | |
| `/ai-costs` | AICostTracker | yes | AI Costs (CFO Agent child) | |
| `/cfo` | CFOAgent | yes | CFO Agent | |
| `/site-organizer` | SiteOrganizer | yes | Site Organizer | |
| `/design-agent` | DesignAgent | yes | Design Agent | |
| `/admin` | AdminPanel | yes | Admin | |
| `/admin/audit` | AuditLog | no | | see §4.2 duplicate |
| `/audit-log` | AuditLogViewer | yes | Audit Log (Admin child) | see §4.2 duplicate |
| `/diagnostics` | DiagnosticPage | yes | Diagnostics (Admin child) | |
| `/amber` | AmberCommandCenter | no | | see §4.1 unreachable |
| `/settings` | SettingsPage | yes | Settings | |
| `/recycle-bin` | RecycleBin | yes | Recycle Bin | |
| `/world` | (redirect → `/character-registry?view=world`) | no | | see §4.1 unreachable, §4.4 dead |
| `/login` (authenticated) | (redirect → `/`) | no | | see §4.4 dead |
| `*` (authenticated) | (redirect → `/`) | no | | see §4.4 dead |

---

## 4. Flags

### 4.1 Unreachable

Rule applied: no Sidebar path (§3 "no"), and — for dynamic `:id`-shaped routes — no evidence found
of any in-app `navigate(...)`, `<Link to=...>`, or `window.location.href =` construction of that
path anywhere under `frontend/src`, checked with targeted `grep` (patterns and matches below). A
static route with no Sidebar path and no such evidence is flagged the same way. Where a route is
built only inside a component that is itself not imported/rendered anywhere in the app, that is
stated explicitly rather than credited as a working path.

- **`/studio/scene-set/:sceneSetId`** (`App.jsx:370`, `SceneStudioPage`). `grep -rn "/studio/scene-set" frontend/src` finds only the route declaration itself and a doc-comment in
  `pages/SceneStudioPage.jsx:10` ("`/studio/scene-set/:sceneSetId` — edit a scene set"); no
  `navigate`/`Link`/`href` builds this path anywhere.
- **`/shows/:showId/feed-timeline`** (`App.jsx:377`, `FeedTimelinePage`). `grep -rn 'shows/\${[a-zA-Z0-9_.]+}/feed-timeline' frontend/src` returns no matches.
- **`/shows/:showId/feed-dashboard`** (`App.jsx:378`, `EventFeedDashboard`). Its only inbound
  construction is `pages/FeedTimelinePage.jsx:255` (`navigate(\`/shows/${showId}/feed-dashboard\`)`)
  — i.e. it is reachable only from `/shows/:showId/feed-timeline`, which is itself unreachable
  per the line above.
- **`/episodes/:episodeId/beats`** (`App.jsx:384`, `BeatGeneration`). `grep -rn "episodes/\${[a-zA-Z0-9_.]+}/beats" frontend/src` returns no matches (only API calls to a differently-shaped
  backend path, e.g. `pages/BeatGeneration.jsx:18` `${API}/scenes/${sceneId}/beats/generate`).
- **`/episodes/:episodeId/icon-cues`** (`App.jsx:388`, `IconCueTimeline`). No `navigate`/`Link` to
  this frontend path found; the only matches for `icon-cues` are backend API calls inside
  `pages/IconCueTimeline.jsx` itself (e.g. line 48, `/api/v1/episodes/${episodeId}/icon-cues`).
- **`/episodes/:episodeId/composer`** (`App.jsx:402`, `TemplateStudio`). No in-app construction of
  this exact path found. The one navigation call that looks related,
  `pages/TemplateStudio.jsx:357` (`navigate(\`/composer?template=${template.id}\`)`), targets
  `/composer`, which is not a route declared anywhere in `App.jsx` — a separate mismatch, not
  evidence of reachability for this route.
- **`/compositions/:id`** (`App.jsx:409`, `CompositionDetail`). `grep -rn "compositions/\${" frontend/src/pages/CompositionLibrary.jsx` (the one page that lists compositions) returns no
  matches; all other `compositions/${` hits across `frontend/src` are backend `apiClient` calls,
  not frontend navigation.
- **`/thumbnails/:episodeId`** (`App.jsx:417`, `ThumbnailGallery`). `grep -rn "thumbnails/\${" frontend/src` matches only `services/thumbnailService.js` and `services/api.js`, both backend
  API calls to `/api/v1/thumbnails/:id`, not a frontend route construction.
- **`/therapy/:registryId`** (`App.jsx:443`, `CharacterTherapy`). `grep -rn "therapy/\${" frontend/src` (and a broader `/therapy|CharacterTherapy` sweep) finds only the API base string
  `pages/CharacterTherapy.jsx:16` (`const API = '/api/v1/therapy';`), backend calls, and test
  files — no in-app `navigate`/`Link` to `/therapy/:registryId`.
- **`/texture-review/:storyNumber`** (`App.jsx:496`, `TextureReviewPage`). `grep -rn "texture-review" frontend/src` finds only the route, its lazy import, its own file header, a test file, and
  a label lookup in `components/Breadcrumbs.jsx:37` (`'texture-review': 'Texture Review'` — a
  breadcrumb label table, not a navigation source). No construction of this path found.
- **`/narrative-control`** (`App.jsx:490`, `NarrativeControlCenter`). No `navigate`/`Link` builds
  `/narrative-control`; the only other hits are `Sidebar.jsx:132`'s auto-expand path-prefix array
  and the `AppAssistant` page-name lookup (`App.jsx:638`), neither of which is a link.
- **`/scene-proposer`** (`App.jsx:502`, `StoryProposer`). Same pattern: only the route, its
  import, `Sidebar.jsx:132`'s auto-expand array, and the page-name lookup (`App.jsx:639`); no
  `navigate`/`Link`.
- **`/story-health`** (`App.jsx:511`, `StoryHealthDashboard`). No construction found anywhere in
  `frontend/src` outside the route declaration and its own file.
- **`/scene-studio`** (`App.jsx:517`, `SceneStudio`). Only the route, its import,
  `Sidebar.jsx:118`'s auto-expand array, and the page-name lookup (`App.jsx:620`); no navigation
  source.
- **`/pressure`** (`App.jsx:523`, `NarrativePressureDashboard`). Only the route, its import, and
  the page-name lookup (`App.jsx:640`).
- **`/feed-relationships`** (`App.jsx:524`, `FeedRelationshipMap`). Only the route, its import,
  and the page-name lookup (`App.jsx:624`).
- **`/assembler`** (`App.jsx:533`, `NovelAssembler`). Only the route, its import,
  `Sidebar.jsx:132`'s auto-expand array, and the page-name lookup (`App.jsx:641`).
- **`/press`** (`App.jsx:536`, `PressPublisher`). Only the route, its import, and the page-name
  lookup (`App.jsx:642`).
- **`/amber`** (`App.jsx:557`, `AmberCommandCenter`). Only the route, its import,
  `Sidebar.jsx:118`'s auto-expand array, and the page-name lookup (`App.jsx:645`).
- **`/admin/audit`** (`App.jsx:550`, `AuditLog`) — no in-app construction found (see also §4.2,
  duplicate concept with `/audit-log`).
- **`/admin/templates`** (`App.jsx:412`, `TemplateManagement`) — no in-app construction found.
- **`/assets`** (`App.jsx:355`, `AssetLibrary`) — no in-app construction found (see also §4.2).
- **`/universe/production`**, **`/universe/social-import`**, **`/universe/series`**,
  **`/universe/assets`**, **`/universe/world-state`**, **`/universe/tensions`**,
  **`/universe/story-dashboard`**, **`/universe/writing-rhythm`** (`App.jsx:330-342`) — `pages/UniversePage.jsx` (the only page at `/universe`, the FRANCHISE-zone Sidebar target for
  these paths' common ancestor) contains exactly two `navigate(...)` calls
  (`pages/UniversePage.jsx:110-111`), to `/shows/${showId}/world?tab=overview` and
  `/shows/${showId}`. Neither targets any `/universe/*` sub-route. No other file constructs these
  eight paths either. **Exception:** `/universe/production` is reachable — not via the Sidebar, but
  via `pages/Home.jsx:339` (`navigate('/episodes')`) → `App.jsx:347` (`<Route path="/episodes"
  element={<Navigate to="/universe/production" replace />} />`); recorded here because it has no
  Sidebar path, per the rule stated above, with the alternate path disclosed rather than hidden.
- **`/world-infrastructure`**, **`/world-locations`**, **`/world-setup`**,
  **`/character-life-simulation`**, **`/character-depth-engine`**, **`/social-timeline`**,
  **`/social-personality`**, **`/cultural-calendar`**, **`/cultural-memory`**,
  **`/influencer-systems`** — no in-app construction found by direct grep of each literal path.
  Four of these (`/character-life-simulation`, `/character-depth-engine`, `/social-timeline`,
  `/social-personality`) do appear in a route table inside `components/FranchiseBrain.jsx:88-92`,
  but `grep -rln "FranchiseBrain" frontend/src` shows that file is imported only by its own test
  (`components/FranchiseBrain.test.jsx`) — `FranchiseBrain.jsx` is not imported by any page or by
  `App.jsx`, so its route table is not wired into the running app and is not counted as
  reachability evidence.
- **`/world`** (`App.jsx:566`, redirect to `/character-registry?view=world`). `grep -n "['\"\`]/world['\"\`)]" frontend/src -r` matches only the route declaration itself; no
  page links to `/world`. (Also flagged Dead, §4.4, since its element is an immediate redirect.)

**Reachable via the global Command Palette, not the Sidebar** (`components/CommandPalette.jsx:15-21`,
mounted unconditionally at `App.jsx:592`, so available on every authenticated page):
```js
const RESULT_ROUTES = {
  character: (r) => `/character-registry?search=${encodeURIComponent(r.display_name || r.character_key)}`,
  story:     (r) => `/story-engine`,
  location:  (r) => `/world-studio?tab=locations`,
  thread:    (r) => `/story-threads`,
  event:     (r) => `/story-calendar`,
  book:      (r) => `/storyteller?book=${r.id}`,
};
```
This gives `/story-engine`, `/story-threads`, and `/story-calendar` a real, always-available
navigation path that is not the Sidebar — recorded here rather than folded silently into "in
sidebar: no", since it materially changes what "unreachable" would otherwise imply for those three.

**Dynamic `:id` routes reachable via a parent list (not unreachable):**

| Route | Reachable via | Evidence |
|---|---|---|
| `/episodes/:episodeId` | Home (episode list), ShowDetail, WorldAdmin, CreateEpisode, others | `pages/Home.jsx:360`; `pages/ShowDetail.jsx:129`; `pages/WorldAdmin.jsx:2204` |
| `/episodes/:episodeId/edit` | EpisodeDetail | `pages/EpisodeDetail.jsx:423,454,567`; `utils/workflowRouter.js:25` |
| `/episodes/:episodeId/plan` | EpisodeDetail, EpisodeScenesTab | `pages/EpisodeDetail.jsx:587`; `components/Episodes/EpisodeScenesTab.jsx:401` |
| `/episodes/:episodeId/script-writer` | EpisodeOverviewTab, WorldAdmin | `components/Episodes/EpisodeOverviewTab.jsx:946`; `pages/WorldAdmin.jsx:5118` |
| `/episodes/:episodeId/todo` | EpisodeDetail, WorldAdmin | `pages/EpisodeDetail.jsx:544`; `pages/WorldAdmin.jsx:1779` |
| `/episodes/:id/evaluate` | EpisodeDetail, WorldAdmin | `pages/EpisodeDetail.jsx:550`; `pages/WorldAdmin.jsx:1780` |
| `/episodes/:episodeId/timeline` | ExportPage, ProductionTab, StudioTimelinePage | `pages/ExportPage.jsx:336`; `pages/ProductionTab.jsx:430` |
| `/episodes/:episodeId/export` | EpisodeReview, ExportDropdown | `pages/EpisodeReview.jsx:74`; `components/ExportDropdown/ExportDropdown.jsx:13` |
| `/episodes/:episodeId/review` | EpisodeKanbanBoard (in ShowDetail), conditionally by episode status | `components/Episodes/EpisodeKanbanBoard.jsx:178` calling `config.route(episode.id)` from `utils/workflowRouter.js:64,77` |
| `/shows/:id` | Sidebar "Shows" sub-list | `Sidebar.jsx:357-368` (a `buildNav`-adjacent list, not a `buildNav` item itself, §2.1) |
| `/shows/:id/edit` | ShowManagement, ShowDetail | `pages/ShowManagement.jsx:335`; `pages/ShowDetail.jsx:219` |
| `/shows/:id/world` | Sidebar "Producer Mode" (for `shows[0]` only), UniversePage, ShowDetail, ProductionTab, and others | `Sidebar.jsx:34`; `pages/UniversePage.jsx:110`; `pages/ShowDetail.jsx:222` |
| `/shows/:showId/quick-episode` | ShowDetail, ProductionTab | `pages/ShowDetail.jsx:147,321`; `pages/ProductionTab.jsx:337` |
| `/shows/:id/settings` | ProductionTab "Show Settings" studio tool | `pages/ProductionTab.jsx:222,446` |
| `/studio/scene/:sceneId` | EpisodeScenesTab | `components/Episodes/EpisodeScenesTab.jsx:453` |
| `/scene-library/:sceneId` | SceneLibrary | `pages/SceneLibrary.jsx:441` |
| `/character/:id` | CharacterRegistryPage | `pages/CharacterRegistryPage.jsx:124` |
| `/chapter/:bookId/:chapterId` | ChapterStructureEditor, WriteMode, SessionStart, ChapterSelection, App.jsx's own `BookToWriteRedirect` | `pages/ChapterStructureEditor.jsx:453`; `pages/WriteMode.jsx:1629`; `App.jsx:91` |
| `/books/:bookId/read` | SessionStart | `pages/SessionStart.jsx:191` |
| `/book/:id` | ChapterStructureEditor, WriteMode (back-navigation) | `pages/ChapterStructureEditor.jsx:440`; `pages/WriteMode.jsx:3503` |

### 4.2 Duplicate concept

- **Two "Assets" pages.** `App.jsx:355` (`/assets` → `AssetLibrary`) and `App.jsx:334`
  (`/universe/assets` → `UniverseAssetsPage`). `pages/UniverseAssetsPage.jsx:1-10` in full:
  ```js
  /**
   * UniverseAssetsPage.jsx
   * Standalone page for Asset Library under Universe
   * Route: /universe/assets
   */
  import AssetLibrary from './AssetLibrary';

  export default function UniverseAssetsPage() {
    return <AssetLibrary embedded={false} />;
  }
  ```
  `UniverseAssetsPage` is a thin wrapper that renders the same `AssetLibrary` component
  (`pages/AssetLibrary.jsx:200`, `<h1>📁 Asset Library</h1>`) under a second route. This is the
  exact pattern named in the issue prompt's own example.

- **Two independent audit-log viewers.** `App.jsx:550` (`/admin/audit` → `AuditLog`) and
  `App.jsx:551` (`/audit-log` → `AuditLogViewer`) are two separate component files, each with its
  own state and its own fetch logic, both gated on the authenticated user and both titled "Audit
  Log Viewer Page" in their own header comment:
  ```
  pages/AuditLog.jsx:2:       * Audit Log Viewer Page
  pages/AuditLog.jsx:124:     <h1>📋 Audit Log Viewer</h1>
  pages/AuditLogViewer.jsx:2: * Audit Log Viewer Page
  pages/AuditLogViewer.jsx:154: <h1>Audit Log</h1>
  ```
  `AuditLog.jsx` additionally gates on `user?.role !== 'ADMIN'` (`pages/AuditLog.jsx:38`);
  `AuditLogViewer.jsx` does not check role, only `isAuthenticated` (`pages/AuditLogViewer.jsx:14`).
  Which one is canonical is not ruled here — only that both exist and both render the same concept
  (list/filter audit log entries) under different routes, and only `/audit-log` has a Sidebar
  entry ("Audit Log", `Sidebar.jsx:68`).

- **Two destinations for "Relationships."** `App.jsx:449` (`/relationships` →
  `RelationshipEngine`) is a standalone route with no Sidebar entry, while the Sidebar's
  "Relationships" label (`Sidebar.jsx:44`) points at `/world-studio?tab=relationships`
  (`WorldStudio`) — a different component. `pages/WorldStudio.jsx:1692` contains its own button
  navigating to `/relationships` (`onClick={() => navigate('/relationships')}`), i.e. `WorldStudio`
  itself treats `RelationshipEngine` as a separate destination for the same concept rather than the
  same page. Which one is canonical is not ruled here.

### 4.3 Mislabel

- **Sidebar "Relationships" → `WorldStudio`, whose own heading is "World Studio."**
  `Sidebar.jsx:44`: `{ icon: '🔗', label: 'Relationships', route: '/world-studio?tab=relationships' }`.
  `pages/WorldStudio.jsx:1054`: `<h1 className="ws4-page-title">World Studio</h1>` — the
  component's own page title does not change with the `tab` query parameter; it reads "World
  Studio" regardless of which tab is active.

- **Sidebar "LalaVerse" → `UniversePage`, whose main heading renders the show's title, not
  "LalaVerse."** `Sidebar.jsx:22`: `{ icon: '◈', label: 'LalaVerse', route: '/universe' }`.
  `pages/UniversePage.jsx:100-105`:
  ```jsx
  <div style={{ ... }}>
    {universe?.name || 'The LalaVerse'}
  </div>
  <h1 style={{ ... }}>
    {show?.name || 'Styling Adventures with Lala'}
  </h1>
  ```
  The small kicker line above the heading falls back to "The LalaVerse," but the `<h1>` itself —
  the component's own primary heading — renders the current show's name (falling back to "Styling
  Adventures with Lala"), not "LalaVerse."

### 4.4 Dead

All of the following routes' `element` is an immediate `<Navigate>` (no intermediate render):

| Route | Redirect target | File:line |
|---|---|---|
| `/universe/wardrobe` | `/` | `App.jsx:333` |
| `/universe/knowledge` | `/show-bible` | `App.jsx:339` |
| `/intelligence/franchise-brain` | `/show-bible?tab=decisions` | `App.jsx:340` |
| `/intelligence/show-brain` | `/show-bible?tab=knowledge` | `App.jsx:341` |
| `/episodes` | `/universe/production` | `App.jsx:347` |
| `/wardrobe` | `/` | `App.jsx:393` |
| `/wardrobe/analytics` | `/` | `App.jsx:394` |
| `/wardrobe/outfits` | `/` | `App.jsx:395` |
| `/wardrobe-library` | `/` | `App.jsx:397` |
| `/wardrobe-library/upload` | `/` | `App.jsx:398` |
| `/wardrobe-library/:id` | `/` | `App.jsx:399` |
| `/storyteller` | `/stories` | `App.jsx:429` |
| `/character-generator` | `/world-studio` | `App.jsx:439` |
| `/show-brain` | `/intelligence/show-brain` (itself a redirect, see above — a double redirect to `/show-bible?tab=knowledge`) | `App.jsx:487` |
| `/story-engine` | `/stories` | `App.jsx:493` |
| `/social-import` | `/universe/social-import` | `App.jsx:527` |
| `/franchise-brain` | `/intelligence/franchise-brain` (itself a redirect, double redirect to `/show-bible?tab=decisions`) | `App.jsx:530` |
| `/world` | `/character-registry?view=world` | `App.jsx:566` |
| `/login` (authenticated) | `/` | `App.jsx:569` |
| `*` (authenticated) | `/` | `App.jsx:572` |
| `*` (unauthenticated) | `/` | `App.jsx:288` |

No route's component file is missing: every one of the 96 distinct import targets in §1 (eager and
lazy `pages/`/`components/` imports listed in `App.jsx:1-171`) was confirmed present on disk with
`.jsx`/`.js` extension by direct file check; none were absent.

---

## 5. What this note does not do

- Proposes no site map, no reorganization, no renamed labels or routes.
- Rules nothing: does not decide which of the "Assets" pages, audit-log viewers, or Relationships
  destinations (§4.2) is canonical, and does not decide whether any flagged item should be fixed,
  merged, or removed.
- Mints no FD/XK/PE number and opens no register tail.
- Changes no code, in `src/`, `frontend/`, `tests/`, or elsewhere.
- Does not run the app; every claim above is static (`grep`/`Read` against files at the basis SHA)
  except where explicitly marked "not determinable statically" — no such case arose in this pass,
  since every route and Sidebar entry resolved to a file on disk and every reachability claim
  either found a citable `grep` match or is stated as absent.
- Does not attempt full-application reachability (e.g. every page-to-page click across ~100
  component files); §4.1's "unreachable" and "reachable via `<parent>`" findings are bounded to
  what a targeted `grep` for each specific path found under `frontend/src`, cited per line above.
