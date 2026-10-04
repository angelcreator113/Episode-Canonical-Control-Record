# World-building route ownership

**Living doc** (outside `docs/audit/`, edited in place; cites code by stable name, line
numbers optional). Audit IA-04 (2026-10-03): "Similar labels conceal different stores,
scopes and purposes. Removing links alone does not define ownership." This is the map:
one canonical editor per domain, what it stores, and where the older routes go.

**2026-10-04: the world pages are the LalaVerse hub's tabs.** `UniversePage` (`/universe`)
holds `ShowBiblePage` (tab `bible`, the canon), `WorldFoundation` (tab `world`),
`SocialSystems` (`society`), `CultureEvents` (`culture`) and `WorldDashboard` (`state`: snapshots,
timeline, tensions; its Setup Progress is the Overview's `components/WorldSetupProgress`) in
embedded mode; the hub's `?tab=` names the
tab and `?sub=` the page's own tab (`tabFromSearch(tabs, fallback, search, 'sub')`). The
four pages keep their files and their owner rows below; only their doorway moved. Their
former routes are redirects (§2, `HUB_TABS` and `hubTarget` in `utils/worldRedirects.js`,
rendered by `App`'s `WorldHubRedirect`), and the Sidebar's WORLD zone is LalaVerse, Show
Bible (a deep link to the Bible tab) and Lala's Feed.

Every hub tab opens with a three-line orientation strip (`components/TabOrientation`, copy
in `pages/lalaverseOrientation.js`): what the tab holds, what reads it, what to do here. The
copy follows `docs/BRAIN_OWNERSHIP.md`: the generators read the Show Bible; the World,
Society and Culture page data reaches the AI only through Push to Brain; locations, calendar
events, snapshots and the timeline are read directly. A dismissal is remembered per tab in
the browser and a "Guide" link brings the strip back.

## 1. Owners

| Domain | Canonical editor (Sidebar) | Tab | Store | Brain sync |
|---|---|---|---|---|
| The map: DREAM cities, universities, corporations, the Loop (a fold-out intro above the map since 2026-10-04; `?sub=loop` lands on the map) | `WorldFoundation` (LalaVerse › World, `/universe?tab=world`) | `map` | page data `world_infrastructure` (`usePageData`, defaults `data/dreamCities.js`) | yes (`brainManifests/worldFoundation.js`) |
| Locations: the places scenes happen in (and the doorway to `/property-manager`, properties and rooms) | `WorldFoundation` | `locations` | `world_locations` table via `GET/POST/PUT/DELETE /api/v1/world/locations` (`listLocationsApi` … `deleteLocationApi`) | no (records, not knowledge) |
| Archetypes, legends and society, social rules, trends | `SocialSystems` (LalaVerse › Society, `/universe?tab=society`) | `archetypes`, `legends`, `rules`, `trends` | page data `influencer_systems` (defaults `data/influencerData.js`) and the society keys of `cultural_calendar` | yes (`brainManifests/socialSystems.js`) |
| The cultural calendar: planned world events, spawned into a show (the Events sub-tab shows which show a new event goes to when there are several, 2026-10-04) | `CultureEvents` (LalaVerse › Culture, `/universe?tab=culture`) | `events` | `calendar_events` via `/api/v1/calendar/events` (`listCalendarEventsApi`, `autoSpawnEventApi`, `deleteCalendarEventApi`) plus page data `cultural_calendar` | yes (`brainManifests/culturalCalendar.js`) |
| Awards and media: who covers and amplifies | `CultureEvents` | `awards` | page data `cultural_calendar` (`AWARD_SHOWS`, `GOSSIP_MEDIA`, hierarchies) | yes: the sub-tab's own Brain Update button (`BrainUpdate`, source `cultural_calendar`; the page-level "Push to Brain" button, which clicked two hidden buttons that no longer existed, is gone, 2026-10-04) |
| History: what the world remembers | `CultureEvents` | `history` | page data `cultural_memory` (defaults `data/memoryData.js`) | yes: the sub-tab's own Brain Update button (`brainManifests/culturalMemory.js`) |

A page opens on the tab its URL names (`?sub=` inside the hub, `utils/worldRedirects.js` `tabFromSearch`).

## 2. Older routes, now redirects

Each of these was a second editor of the same store with its own, different defaults
(`docs/BRAIN_OWNERSHIP.md` §3 and ruling R4), so the two pages could show different
values for the same thing. The route stays, so links and bookmarks keep working; the page
is deleted (`utils/worldRedirects.js` `WORLD_REDIRECTS`, rendered by `App`).

| Route | Opens |
|---|---|
| `/influencer-systems` | `/universe?tab=society&sub=archetypes` |
| `/world-infrastructure` | `/universe?tab=world&sub=map` |
| `/world-locations` | `/universe?tab=world&sub=locations` |
| `/cultural-calendar` | `/universe?tab=culture&sub=events` |
| `/cultural-memory` | `/universe?tab=culture&sub=history` |
| `/show-bible`, `/world-foundation`, `/social-systems`, `/culture-events`, `/world-dashboard` (2026-10-04) | the hub tab (`bible`, `world`, `society`, `culture`, `state`), carrying the route's old `?tab=` as `&sub=` |
| `/universe/knowledge`, `/intelligence/show-brain`, `/show-brain` · `/intelligence/franchise-brain`, `/franchise-brain` | `/universe?tab=bible&sub=knowledge` · `/universe?tab=bible&sub=decisions` |
| `/world` | `/universe?tab=state` |

## 3. Three calendars, named distinctly

| Name | Where | What it holds |
|---|---|---|
| **Story Calendar** (Sidebar: Stories → Story Calendar, `/story-calendar`) | `StoryCalendar` | the novel's dates: when chapters and story events happen |
| **Cultural calendar** (Culture & Events → Events) | `CultureEvents` | the LalaVerse's planned world events, spawned into a show's Events |
| **Production schedule** (Producer Mode → Episodes → Season Plan) | `WorldAdmin` `season` sub-tab (`SeasonTab`) | the show's episodes in order, the arc and Career Goals |

## 4. Still separate, still routed (owner to decide)

Each is a single editor of its own page-data key, with no duplicate, reachable by URL
only (`docs/PAGE_INVENTORY.md`). They are not redirected: nothing else holds their work.

| Route | Page | Store |
|---|---|---|
| `/social-timeline` | `SocialTimeline` | page data `social_timeline` |
| `/social-personality` | `SocialPersonality` | page data `social_personality` |
| `/character-life-simulation` | `CharacterLifeSimulation` | page data `character_life_simulation` (its defaults still name the old cities; `BRAIN_OWNERSHIP.md` §3) |
| `/character-depth-engine` | `CharacterDepthEngine` | page data `character_depth_engine` |
| `/world-dashboard` | `WorldDashboard` | reads only |
| `/world-setup` | `WorldSetupGuide` | a checklist that links to the pages above |

Relationship surfaces (`/relationships`, the Feed's relationship map) and character
surfaces (`/character-registry`, `WorldStudio`, the Feed) are audit IA-05's, not mapped here.
