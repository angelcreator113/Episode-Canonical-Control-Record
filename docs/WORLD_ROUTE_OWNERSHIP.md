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
Bible (a deep link to the Bible tab) and Social Media (`/feed`, `pages/SocialMediaPage.jsx`,
2026-10-04: Home, Lala's 2009-style wall of the active show's stored `feed_posts`, by default,
under a purple "lalaverse" banner; Friends, the profile generator unchanged, as a tab that the
old `?layer=` links still open; `docs/FEED_POSTS.md`; the Episode's Lala's Phone tab is
untouched).

The Overview's setup progress (`components/WorldSetupProgress`, 2026-10-04) reads the seven
endpoints' real shapes: `GET /page-content/:name` answers the content object itself (the checks
read a `data` property that was never there, so World Foundation, Social Systems and Cultural
Memory could never be done), and `GET /social-profiles` answers `{ profiles, pagination: { total } }`
(the check read `count`). Each check measures usable records (a section holding something, an
event, a location, a profile, a draft event) and shows the count on its step; an endpoint that
did not answer is "could not check", neither done nor not done (`WorldSetupProgress.test.jsx`).

The State tab's Tensions (2026-10-04) read the scanner's contract, `GET /world/tension-scanner`
→ `{ status: 'ok' | 'scan_failed', pairs, count, characters_scanned, error? }` with each pair's
`char_a` / `char_b` as `{ id, name }`, and send the pair itself to
`POST /world/create-tension-proposal`, whose proposal keeps `character_ids` beside the name
slugs Story Evaluation reads. Before, the page read `char_a_name` (never returned) and sent
`char_a_id` (never read), and a failed scan was an empty list. Three empties are told apart:
scan failed, nothing to scan, nothing simmering (`WorldDashboard.tensions.test.jsx`,
`tests/unit/routes/world-tension-contract.test.js`).

Relationships are kept in one place since 2026-10-08: `character_relationships`, the table
the Relationships page (`/relationships`, `routes/relationships.js`) edits (Evoni's ruling,
wiring map fix-list item 23). The scanner and the context summary's tension count read its
confirmed rows (high: simmering, volatile, fractured, and the older unresolved, high and
explosive; `services/tensionLevels`), so pair ids are registry character ids. World Studio's
relationship form (`POST /world/characters/:id/relationships`) writes a confirmed row between
the two characters' registry twins (`world_characters.registry_character_id`), refusing a
character that has none; its GET lists the table's rows and, marked legacy, the character's
old `relationship_graph` entries, which can be removed but no longer change.
`character_relationships_extended` is no longer written. The State tab's Tensions "+ Add"
opens the Relationships page (`worldStudioTension.integration.test.js`).

The State tab's snapshots store `world_facts` as a list of facts (strings, or `{ fact }`;
`services/worldFacts.js`, migration `20261004140000`, 2026-10-04). The temperature service
used to write an object (`{ worldTemperature, temperatureUpdatedAt }`) into its own
`temperature_update` snapshots, so whenever one of those was the latest snapshot the context
summary, scene proposals and story evaluation saw no facts, and whenever a list snapshot was
the latest the trajectory read a number off an array and stayed STABLE. The temperature now
lives in `metadata.world_temperature` (`{ value, updated_at }`), a temperature snapshot
carries the latest facts and threads forward, the migration moves the old objects into
metadata and adds a check that `world_facts` is a JSON array, and `POST`/`PUT
/world/state/snapshots` refuse a non-list with 400 (`tests/unit/services/worldFacts.test.js`,
`worldTemperatureService.snapshot.test.js`, `tests/unit/migrations/world-state-snapshots-world-facts-list.test.js`,
`tests/unit/routes/world-snapshots-facts-contract.test.js`).

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
| Archetypes, legends and society, social rules, trends | `SocialSystems` (LalaVerse › Society, `/universe?tab=society`) | `archetypes`, `legends`, `rules`, `trends` | page data `influencer_systems` (defaults `data/influencerData.js`) and the society keys of `cultural_calendar` | yes: each sub-tab carries the Brain Update for the data it shows (2026-10-04): the Social Systems button (`brainManifests/socialSystems.js`) on Archetypes and Social Rules, the Calendar button (`culturalCalendar.js`: celebrity tiers, famous characters, gossip outlets, algorithm forces, drama mechanics) on Legends & Society, both on Trends; each sub-tab also says who reads its lists (`READS`). The Feed keeps its own ten archetypes (`social_profiles.archetype`, `services/feedScheduler.js`), and since 2026-10-08 (fix-list item 26) each new LalaVerse Feed profile also gets one of this page's archetypes, the saved list or the defaults (`services/societyArchetypes.js`, `social_profiles.society_archetype`); the Archetypes sub-tab counts them from `/social-profiles/analytics/composition`. |
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
| `/universe/world-state`, `/universe/tensions` (2026-10-08) | `/universe?tab=state&sub=state` · `/universe?tab=state&sub=tensions`. Their page, `WorldStateTensions`, was a second copy of the State tab that still read the tension scanner's pre-2026-10-04 contract (every pair nameless, Propose Scene refused); it is deleted |

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
