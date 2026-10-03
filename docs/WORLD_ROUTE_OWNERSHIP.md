# World-building route ownership

**Living doc** (outside `docs/audit/`, edited in place; cites code by stable name, line
numbers optional). Audit IA-04 (2026-10-03): "Similar labels conceal different stores,
scopes and purposes. Removing links alone does not define ownership." This is the map:
one canonical editor per domain, what it stores, and where the older routes go.

## 1. Owners

| Domain | Canonical editor (Sidebar) | Tab | Store | Brain sync |
|---|---|---|---|---|
| The map: DREAM cities, universities, corporations, the Loop | `WorldFoundation` (`/world-foundation`) | `map`, `loop` | page data `world_infrastructure` (`usePageData`, defaults `data/dreamCities.js`) | yes (`brainManifests/worldFoundation.js`) |
| Locations: the places scenes happen in | `WorldFoundation` | `locations` | `world_locations` table via `GET/POST/PUT/DELETE /api/v1/world/locations` (`listLocationsApi` … `deleteLocationApi`) | no (records, not knowledge) |
| Archetypes, legends and society, social rules, trends | `SocialSystems` (`/social-systems`) | `archetypes`, `legends`, `rules`, `trends` | page data `influencer_systems` (defaults `data/influencerData.js`) and the society keys of `cultural_calendar` | yes (`brainManifests/socialSystems.js`) |
| The cultural calendar: planned world events, spawned into a show | `CultureEvents` (`/culture-events`) | `events` | `calendar_events` via `/api/v1/calendar/events` (`listCalendarEventsApi`, `autoSpawnEventApi`, `deleteCalendarEventApi`) plus page data `cultural_calendar` | yes (`brainManifests/culturalCalendar.js`) |
| Awards and media: who covers and amplifies | `CultureEvents` | `awards` | page data `cultural_calendar` (`AWARD_SHOWS`, `GOSSIP_MEDIA`, hierarchies) | yes |
| History: what the world remembers | `CultureEvents` | `history` | page data `cultural_memory` (defaults `data/memoryData.js`) | yes (`brainManifests/culturalMemory.js`) |

A page opens on the tab its URL names (`?tab=`, `utils/worldRedirects.js` `tabFromSearch`).

## 2. Older routes, now redirects

Each of these was a second editor of the same store with its own, different defaults
(`docs/BRAIN_OWNERSHIP.md` §3 and ruling R4), so the two pages could show different
values for the same thing. The route stays, so links and bookmarks keep working; the page
is deleted (`utils/worldRedirects.js` `WORLD_REDIRECTS`, rendered by `App`).

| Route | Opens |
|---|---|
| `/influencer-systems` | `/social-systems?tab=archetypes` |
| `/world-infrastructure` | `/world-foundation?tab=map` |
| `/world-locations` | `/world-foundation?tab=locations` |
| `/cultural-calendar` | `/culture-events?tab=events` |
| `/cultural-memory` | `/culture-events?tab=history` |

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
