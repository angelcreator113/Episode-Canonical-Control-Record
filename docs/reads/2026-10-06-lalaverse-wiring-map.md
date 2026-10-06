# Read: LalaVerse wiring map — who writes and who reads each kind of world data

Date: 2026-10-06. Task: #2680. Basis: `13b508021f4ba8955ea043d1e46fb0bebb701a9f` (origin/main, #2679). Read-only: no code change, no migration, no register edit, no host, AWS, database or Cognito contact. Citations are `file:line` at that SHA.

Every finding is marked **MEASURED** (seen in the code at the cited line) or **INFERRED** (reasoned from measured code, not seen directly, e.g. the state of production data). No database was read, so nothing here states what rows production actually holds.

## Summary

1. **Two archetype lists, no link.** The Society tab shows 15 archetypes (frontend constant plus `page_content`). The Feed uses its own 10 snake_case archetypes, copied in 7+ places down to a DB ENUM. Claim (a) is MEASURED.
2. **A location's DREAM city is a free-text `city` field matched exactly.** Properties, rooms, scene sets, story extraction and event venue auto-create write no city or a legacy one ('Nova Prime'). The five cities are defined in six places. Claim (b) is consistent with the code (mechanism MEASURED, row counts INFERRED).
3. **World Setup counts other tables than the Events library.** "Culture & Events" counts cultural calendar rows (`story_calendar_events`), "World Foundation" counts saved `page_content` sections, and the library counts `world_events`. The strings quoted in claim (c) are from an earlier build. MEASURED.
4. **Planning → Location ignores the event's saved automation copy of the venue**, which the Event Package's Place uses. Claim (d) is MEASURED.
5. **"from 0 documents" counts `brain_documents` rows, and that table's only migration is in the dead root `migrations/` tree.** Only one of eight writers ever writes a document row. Claim (e) is MEASURED, except that the table is missing in production, which is INFERRED.
6. **Brain Update writes active cards that no generator reads**: `always_inject=false`, severity `important`, and the shared loader takes `always_inject=true` only. Page copy says the script writers and Amber read them. MEASURED.
7. **The State tab has three dead links.** The script writers read snapshots by a column that doesn't exist. Nothing ever records the world temperature. A relationship added in World Studio is stored without the fields the tension scanner reads. MEASURED.

## 1. Society tab — Archetypes, Legends & Society, Social Rules, Trends

| Data | Owner | Writers | Readers | Duplicate sources | Broken / missing links |
|---|---|---|---|---|---|
| Society archetypes (15) | Social Systems page (`frontend/src/pages/SocialSystems.jsx`) → frontend constant `frontend/src/data/influencerData.js:12-27`, overrides in `page_content` page `influencer_systems` key `ARCHETYPES` (`SocialSystems.jsx:71,113`; `src/models/PageContent.js:26`) | PUT `/page-content/:page/:key` exists (`src/routes/pageContent.js:29`), but nothing on the page calls it (below) | Brain Update manifest → Show Bible "Social Archetype" cards (`src/services/brainManifests/socialSystems.js:26-27,47-48`); Amber `read_world_page` (`src/routes/memories/assistant.js:984`) | The Feed's 10 archetypes, see 1a | The page can't edit, though it says "Edit them here" (`SocialSystems.jsx:91`). The synced cards are never injected (§8) |
| Feed archetypes (10) | `social_profiles.archetype` ENUM (`src/models/SocialProfile.js:37`) | Feed scheduler random pick (`src/services/feedScheduler.js:177-181,272`); profile generate/regenerate (`src/routes/socialProfileRoutes.js:159,401,1910`); bulk (`src/routes/socialProfileBulkRoutes.js:153`) | Society front page "Archetypes in the Feed" via `/social-profiles/analytics/composition` (`frontend/src/components/Society/SocietySummary.jsx:35`; `socialProfileRoutes.js:2522-2535`) | `feedScheduler.js:177-181,385,614`; `src/utils/fitToModel.js:16-20`; `src/services/characterFollowService.js:16-19`; `src/utils/feedProfileUtils.js:8-16`; `frontend/src/pages/feed/feedConstants.js:41-52`; the ENUM | Shares no key with the Society list. One tab shows both lists, one above the other |
| Legends (50 roles, 10 groups) | Frontend constant only, `frontend/src/data/legendaryGroups.js:7`, rendered directly (`SocialSystems.jsx:143,149`) | None | The page only | Possibly a `LEGENDARY_GROUPS` key in `page_content` `world_infrastructure` from the older page (`src/services/brainManifests/worldFoundation.js:8-9`) | The copy says names are "assigned through the Character Registry" (`SocialSystems.jsx:43,141`; `SocietySummary.jsx:124`). No code links a role to a registry character |
| Social Rules (relationship types, economy, influence, legacy) | `influencerData.js` defaults + `page_content` `influencer_systems` (`SocialSystems.jsx:202,217,230,243`) | None from the UI (same dead edit wiring) | Brain manifest only (`socialSystems.js:28-43`) | — | The page says script writers and the event generator read these (`SocialSystems.jsx:44`); no generator does (§8) |
| Trends (engine stages, waves) | `page_content` `influencer_systems` / `cultural_calendar` (`SocialSystems.jsx:258-290`) | None from the UI | The page; Brain manifests | — | Not connected to the live trends below |
| Trending now | `feed_posts.trending_topic` + hashtags | Feed generators | `GET /feed-enhanced/:showId/trending` (`src/routes/feedEnhancedRoutes.js:18-23`) → `getTrendingTopics` (`src/services/feedEngagementService.js:366-405`); Society front page; hub Overview | — | — |

Findings:

- **1a — claim (a), MEASURED.** The Social Systems page says: "…The Feed generator picks archetypes from its own built-in list, not from here." (`SocialSystems.jsx:42`; the header comment at `:11-12` says the same). The Feed generator's list is `feedScheduler.js:177-181`, picked at random at `:272`, and is the 10-key ENUM. The Society list is the 15 display names in `influencerData.js:12-27`. They share no keys.
- **MEASURED.** `setEditItem` appears only at its declaration, the context provider and the modal (`SocialSystems.jsx:70,81,304`). Nothing on the page opens the editor, so no archetype, rule or trend can be edited there.
- **MEASURED.** `src/services/brainManifests/socialSystems.js:9-10` still names `InfluencerSystems.jsx` as an editor; that page no longer exists in `frontend/src/pages`.

## 2. World tab — DREAM cities, locations, venues, properties and rooms, scene sets

| Data | Owner | Writers | Readers | Duplicate sources | Broken / missing links |
|---|---|---|---|---|---|
| DREAM cities (5) | `frontend/src/data/dreamCities.js:7` (Dazzle District, Radiance Row, Echo Park, Ascent Tower, Maverick Harbor; Echo Park is the "E", `:30-39`) | WorldFoundation can override the list from `page_content` `world_infrastructure` (`frontend/src/pages/WorldFoundation.jsx:45,77,188`) | DreamCityExplorer (`frontend/src/lib/dreamCityExplorer.js`); DreamMap; Culture EventsTab | `frontend/src/components/DreamMap.jsx:25` (own copy with coordinates); `src/utils/lalaHome.js:44`; seeded `world_locations` rows of type `city` (`src/routes/worldStudio.js:3309-3346`); `social_profiles` enum (`src/migrations/20260725000000-unify-dream-cities.js:19`); `frontend/src/components/Culture/EventsTab.jsx:25-27`; `brainManifests/worldFoundation.js:21` | Legacy names live on in always-inject AI law (2c) |
| Locations / venues | World tab Locations (`WorldFoundation.jsx:48-49`) → `world_locations` (`src/models/WorldLocation.js:115`; `city` nullable `:66-68`) | `POST /world/locations` (`worldStudio.js:3237,3248`); seed (`:3303-3360`); creator home venues (`socialProfileRoutes.js:485,506-513`); event venue auto-create (`src/services/eventAutomationService.js:291-325`); scene-set learn-location (`src/routes/sceneSetRoutes.js:673-682`); story auto-extract (`src/routes/memories/engine.js:4425-4433`); `src/routes/tierFeatures.js:420` | `GET /world/locations` (`worldStudio.js:3156-3231`, events include capped at 5 `:3186`); explorer/map; event generator prompt (`src/routes/eventGeneratorRoute.js:172`, no city); `src/services/scenePlannerService.js:42,338`; `src/routes/calendarRoutes.js:513` | — | The city is free text, matched exactly (2b) |
| Properties and rooms | `world_locations` rows: `property`, and `interior` with `parent_location_id` (`src/routes/propertyRoutes.js:98,195-207`) | `propertyRoutes.js:98-107,195-202` | Explorer (`venueLine`, `dreamCityExplorer.js:28`) | — | No city is written. A room is never counted under its parent's city. `property_type` is kept in `metadata`, which `venueLine` doesn't read (INFERRED) |
| Scene sets | `scene_sets.world_location_id` (`src/models/SceneSet.js:71,121`) | `sceneSetRoutes.js:425`; promote-to-location `:657-683`; also writes an active Show Bible "Location: …" entry (`sceneSetRoutes.js:706-722`) | Locations include `sceneSets` (`worldStudio.js:3156-3231`); episode planning | — | A promoted location gets no city |

Findings:

- **2b — claim (b).** How the map picks a city:
  - MEASURED: the map places a location under a city only when `world_locations.city`, normalised for case, `_` and `-`, equals the city's name or key (`dreamCityExplorer.js:13-18`, `cityPlaces` `:36-38`, `placeCounts` `:45-47`; legacy map `DreamMap.jsx:173-184`). It ignores `parent_location_id`, district and type.
  - MEASURED: `POST /world/locations` stores `city: city || null` and requires only `name` (`worldStudio.js:3237,3248`). Its raw-SQL fallback drops `city` altogether (`:3260-3263`).
  - MEASURED: the Locations form's city is a free-text input (`WorldFoundation.jsx:372`). Only the explorer's "+ Add" pre-fills it (`:138-140`).
  - MEASURED: property, room, scene-set, story-extract and minimal venue writers set no city. Event venue auto-create defaults to `'Nova Prime'`, which is not a DREAM city (`eventAutomationService.js:313`).
  - INFERRED: so 11 of 12 locations with an empty, legacy or misspelled city would show 1 under Echo Park and none elsewhere. That is consistent with the claim, but not measured against data.
- **2c — Pulse City, Horizon City, Glow District, Creator Harbor.** MEASURED: these are legacy city names, not districts. The unify migration maps Velvet City→Dazzle District, Glow District→Radiance Row, Pulse City→Echo Park, Creator Harbor→Maverick Harbor and Horizon City→Ascent Tower in `world_locations.city` and city-row names (`20260725000000-unify-dream-cities.js:53-69`). It does not touch `franchise_knowledge`. The always-inject world-infrastructure law still names the old cities (`src/seeders/20260312200000-world-infrastructure-franchise-laws.js:27-59,86-107`), as do `src/seeders/20260312500000-character-life-simulation-franchise-laws.js:54-58,198-202`, `src/seeders/20260312600000-cultural-memory-franchise-laws.js:78-80` and `src/seeders/lalaverse-cultural-calendar.js:193`. Whether a given production row is a location, a city row or neither can't be read without the database (INFERRED).

## 3. Culture tab — cultural calendar events, awards, micro events, cultural memory

| Data | Owner | Writers | Readers | Duplicate sources | Broken / missing links |
|---|---|---|---|---|---|
| Cultural events + micro events | `story_calendar_events`, `event_type 'lalaverse_cultural'`, `is_micro_event` (`src/models/StoryCalendarEvent.js:47,127,134`) | Seeder (`src/seeders/lalaverse-cultural-calendar.js:18-48`); `POST /calendar/events` (`calendarRoutes.js:185-208`); `seasonalEventService` (`src/services/seasonalEventService.js:144-161`, always `is_micro_event: false`) | Culture page (`frontend/src/pages/CultureEvents.jsx:42-45,76`); hub Overview (`frontend/src/pages/UniversePage.jsx:127`); World Setup step 3 (`WorldSetupProgress.jsx:86`); auto-spawn / spawn-world-event → `world_events.source_calendar_event_id` (`calendarRoutes.js:505,566,587,646`) | The world timeline POST also writes calendar rows, but as `world_event`/`story_event`/`character_event`, never cultural (`worldStudio.js:3454-3459`) | No series/show filter on any read (`calendarRoutes.js:162`). The seasonal service builds local-time dates that the UI reads as UTC (INFERRED one-day drift) |
| Award shows | Constant `AWARD_SHOWS` (`frontend/src/data/calendarData.js:51-56`) + `page_content` `cultural_calendar` | None from the UI: CultureEvents takes only `data, saving, loaded` from `usePageData` (`CultureEvents.jsx:62-63`), as does SocialSystems (`SocialSystems.jsx:72`) | AwardsMediaTab; CultureYear by month (`frontend/src/lib/cultureYear.js:62-66`); Brain manifest (`brainManifests/culturalCalendar.js:15,23`); Amber `read_world_page` | Starlight Awards is also a seeded calendar event (`lalaverse-cultural-calendar.js:482-483`); `frontend/src/pages/SocialTimeline.jsx:45`; franchise-law seeders | Edits are read but never written. Starlight can show twice in November (INFERRED) |
| Cultural memory (reference) | `MEMORY_DEFAULTS` (`frontend/src/data/memoryData.js:81`) + `page_content` `cultural_memory` | None from the UI | HistoryTab; Brain manifest (`brainManifests/culturalMemory.js:15`) | Seeder copy (`src/seeders/20260312600000-cultural-memory-franchise-laws.js:79,215,235`) | Same: no save wiring |
| Cultural memory (moments) | `franchise_knowledge`, `category 'narrative'`, `source_document 'episode-completion'` | `episodeCompletionService` raw INSERT, status active (`src/services/episodeCompletionService.js:555-566,604-612`) | CultureYear `GET /franchise-brain/entries?category=narrative&status=active`, no `show_id` (`frontend/src/components/Culture/CultureYear.jsx:42`; `cultureYear.js:80-96`) | — | Written without `show_id` (`episodeCompletionService.js:604`), so every show sees every show's moments (INFERRED) |

## 4. State tab — world snapshots, timeline, tensions

| Data | Owner | Writers | Readers | Duplicate sources | Broken / missing links |
|---|---|---|---|---|---|
| Snapshots | `world_state_snapshots`: `universe_id`, `book_id`, `chapter_id`, label, states, threads, facts, position, metadata, **no `show_id`** (`src/migrations/20260309000000-tier-features-all.js:100-114`) | `POST /world/state/snapshots` (`worldStudio.js:3383-3394`, no `universe_id`); `snapshotTemperature` (`src/services/worldTemperatureService.js:343-368`); `POST /world-snapshots` and `/generate` (`tierFeatures.js:468,478`) | State tab (`worldStudio.js:3373-3379`); context-summary (`:3601-3606`); `src/routes/storyEvaluationRoutes.js:933`; `src/routes/sceneProposeRoute.js:221`; `tierFeatures.js:451-458`; temperature service by `universe_id` (`worldTemperatureService.js:113`); script writers (broken, right) | — | `src/services/episodeScriptWriterService.js:233` and `src/services/groundedScriptGeneratorService.js:137` query `WHERE show_id = :showId`; the error is swallowed by `catch {}`, so the snapshot never reaches a script prompt |
| World temperature | `world_state_snapshots` rows labelled `temperature_update`, `metadata.world_temperature` | `POST /world-temperature/:universeId/snapshot` only (`src/routes/worldTemperatureRoutes.js:29-43`, mounted `src/app.js:1517`) | State tab front page (`frontend/src/components/State/StateSummary.jsx`) and World State footnote (`frontend/src/pages/WorldDashboard.jsx`) | — | **No caller.** Nothing in `src/` or `frontend/src/` calls `snapshotTemperature` or the route (grep, MEASURED). The #2679 comment "one per accepted episode" (`frontend/src/lib/stateSummary.js:14-17`) and the WorldDashboard footnote are wrong |
| Timeline events | `world_timeline_events` (`src/models/WorldTimelineEvent.js:11,75`) | `worldStudio.js:3448-3449` (no `universe_id`, also writes a calendar row); `src/services/storyEnrichmentService.js:396`; `socialProfileRoutes.js:1731`; `memories/engine.js:4440`; `tierFeatures.js:366` | State tab (`worldStudio.js:3433-3437`); `storyEvaluationRoutes.js:945`; `memories/engine.js:1864,2278`; `tierFeatures.js:88,354` | — | — |
| Tensions | `world_characters.relationship_graph` JSONB, read by the scanner (`worldStudio.js:3506-3537`) and context-summary (`:3631`) | World Studio relationship POST (`worldStudio.js:3004-3066`, from `frontend/src/pages/WorldStudio.jsx:853`); PUT merges the body (`:3108-3110`); AI graph writers (`:1041,2762`, keys not checked) | Scanner → State tab, hub Overview idea; `create-tension-proposal` (`:3576-3594`, saves nothing) | `character_relationships_extended` (written with the graph, `worldStudio.js:3023,3101,3134`); `character_relationships`, edited by the Relationships page (`src/routes/relationships.js`) and read by the temperature service (`worldTemperatureService.js:94`), never by the scanner | See 4a |
| Character state ledger | `character_state_history` | `episodeCompletionService.js:499`; `src/routes/evaluation.js:695`; `src/services/financialTransactionService.js:609`; `src/routes/wardrobe.js:1986,2000` | `GET /world/:showId/history` (`src/routes/world.js:34-48`, default limit 50) → StateSummary | — | StateSummary passes no `limit`, so after 50 rows the earliest episodes drop out of "after each episode" (INFERRED) |

Findings:

- **4a — MEASURED.** The World Studio POST reads `tension_state` from the body (`worldStudio.js:3012-3016`). But the graph entry it pushes has `character_id`, `character_name` and no `tension_state` (`:3056-3066`). The scanner reads `related_character_id`, `related_character_name` and `tension_state`, and defaults to 'Stable' (`:3517-3524`). So a relationship added through World Studio's form never shows as a tension, and the pair's second name is undefined. The State tab's "+ Add" (#2679) points there.
- **MEASURED.** The scanner's high-tension list is `['Simmering','Explosive','Unresolved','High','high','simmering','explosive']` (`worldStudio.js:3519`). Lowercase `unresolved` is missing.

## 5. Show Bible — franchise vs show, "in every prompt", critical, Documents, Guard

| Data | Owner | Writers | Readers | Duplicate sources | Broken / missing links |
|---|---|---|---|---|---|
| Entries | Show Bible page (`frontend/src/pages/ShowBiblePage.jsx`) → `franchise_knowledge` (`src/models/FranchiseKnowledge.js:63`): `severity` critical/important/context (`:23-26`), `always_inject` (`:28`), `source_document` string (`:29`), `scope` default franchise (`:38-43`), `show_id` (`:44`), `status` default pending_review (`:51-54`) | Manual POST (`src/routes/franchiseBrainRoutes.js:163-187`); ingest-document (`:387-491`); ingest-pdf (`src/routes/pdfIngestRoute.js:221-232`); seed (`src/seeders/2026031*-franchise-laws.js`); episode completion (`episodeCompletionService.js:564-611`); Brain Update apply (`src/services/brainSyncService.js:136-166`); scene sets (`sceneSetRoutes.js:706-722`); Amber `push_page_to_brain` (`memories/assistant.js:1150-1158,1285`) | `selectInjectedRules` (`src/services/brainRules.js:37-56`) → script writer, grounded generator, the nine Feed/event generators (`loadBrainContext`); **direct readers that skip the shared loader and show scope**: `episodeScriptWriterService.js:842-846`, `storyEvaluationRoutes.js:611`, `src/routes/episodeBriefRoutes.js:576-578`, `memories/engine.js:2252-2256`, `tierFeatures.js:559-560`, `src/routes/upgradeRoutes.js:177-178`, the guard (`franchiseBrainRoutes.js:555-560`), Amber (`memories/assistant.js:1030,1205,1226`) | `FranchiseTechKnowledge` (`pdfIngestRoute.js:207-218`); seeded laws vs synced cards cover the same ground (`docs/BRAIN_OWNERSHIP.md:222`) | See 5a–5c |
| Documents | `brain_documents` (`src/models/BrainDocument.js:14-23`) | ingest-document only (`franchiseBrainRoutes.js:467-479`, failure only logged) | `GET /franchise-brain/documents` (`:494-503`) → Show Bible Documents and "from N documents" | — | Claim (e) |
| Scope | `show_id` null = franchise in the loader (`brainRules.js:41`); the list route uses `scope='franchise' OR show_id` (`franchiseBrainRoutes.js:59-62`) | Ingest, episode completion and Brain Update write no scope/show_id | — | — | The loader and the list key on different columns |

Findings:

- **5a — claim (e), MEASURED.** "from N documents" is `` `from ${plural(docs.length, 'document')}` `` (`ShowBiblePage.jsx:262`). Here `docs = documentCards(documents, entries)` (`:190`) maps over the `brain_documents` rows only (`frontend/src/lib/showBibleKnowledge.js:106`), so entries' `source_document` strings never add to N. N is 0 because:
  1. Only ingest-document writes a `brain_documents` row. Seeders, PDF ingest, episode completion, Brain Update, scene sets and Amber write only a `source_document` string (MEASURED).
  2. The only migration that creates `brain_documents` is `migrations/20260315100000-create-brain-documents.js`, in the root tree. `.sequelizerc` runs `./src/migrations` only, and no file there creates the table (grep, MEASURED). `db.BrainDocument` is always defined (`src/models/index.js:342`), so the "model not available" guard (`franchiseBrainRoutes.js:496`) never fires. `findAll` on a missing table would throw, and the page falls back to `[]` (`ShowBiblePage.jsx:80-82`). That the table is missing in production is INFERRED.
- **5b — MEASURED.** Amber's `push_page_to_brain` inserts `id = gen_random_uuid()` (`memories/assistant.js:1154`). `franchise_knowledge.id` is an INTEGER autoincrement (`src/migrations/20260307210000-create-franchise-knowledge.js:6`). INFERRED: those inserts fail on the type mismatch.
- **5c — MEASURED.** The PDF ingest UI (`PdfIngestZone`) is only used by `frontend/src/components/FranchiseBrain.jsx:789`, which nothing imports.

## 6. Feed profiles / creators vs Character Registry characters

| Data | Owner | Writers | Readers | Duplicate sources | Broken / missing links |
|---|---|---|---|---|---|
| Feed profiles | `social_profiles` (`SocialProfile.js:223`, INTEGER id `:26`) | Feed scheduler, generate/regenerate, bulk, confirm-feed (below) | Feed pages; World Setup step 6; Society front page | — | — |
| Registry characters | `registry_characters` (`src/models/RegistryCharacter.js:644`) | Registry routes (`src/routes/characterRegistry.js`); `/social-profiles/:id/cross` | Hub Overview "Characters" tile; generators | `world_characters` (World Studio, `src/models/WorldCharacter.js:268`); `characters`, `universe_characters`, `character_follow_profiles` | Four "character" stores |
| Links | Profile → registry `social_profiles.registry_character_id` (`SocialProfile.js:62`); registry → profile `registry_characters.feed_profile_id` (`RegistryCharacter.js:364-366`); world → registry `world_characters.registry_character_id` (`WorldCharacter.js:22`) | `autoCreateFeedProfile` writes both (`src/services/feedAutoGeneration.js:60`; `characterRegistry.js:303,309`); `/cross` (`socialProfileRoutes.js:1687-1727`); `src/services/registrySyncService.js:113,150`; confirm-feed (`src/routes/characterGenerationRoutes.js:213-241`) | `src/services/feedPostGeneratorService.js:72,77,99`; `storyEvaluationRoutes.js:537-538`; `characterRegistry.js:1188-1189,2553-2557`; `characterGenerationRoutes.js:342`; `socialProfileRoutes.js:1742,1799,1846` | No `world_characters` ↔ `social_profiles` link | See 6a, 6b |

Findings:

- **6a — MEASURED.** confirm-feed creates a `SocialProfile` without `registry_character_id` or `feed_layer` (`characterGenerationRoutes.js:213-221`), then sets only `registry_characters.feed_profile_id` (`:237-241`). The profile has no back-pointer.
- **6b — MEASURED.** `/cross` guards with `if (registry_id && !profile.registry_character_id)` (`socialProfileRoutes.js:1689`), so its "latest registry" fallback (`:1691`) is dead code. Without `registry_id` in the body, no registry character is made, yet the profile is still marked crossed (`:1722-1727`).

## 7. Universe Overview counters and World Setup steps

No backend setup-status route exists. The seven checks run in the frontend, in `checkSetup` (`frontend/src/components/WorldSetupProgress.jsx:75-112`) (MEASURED).

| Counter / step | Request | Counts | DONE | Links to | Mismatch |
|---|---|---|---|---|---|
| Episodes tile | `fetchAllEpisodes` (`UniversePage.jsx:125`) | every episode of the show (`:150`) | — | Season Plan (`:180`) | — |
| Events tile | `GET /world/:showId/events` (`:122`) | `world_events` of the show, any status (`:151`) | — | Events library (`:181`), same endpoint | — |
| Characters tile | `GET /character-registry/registries?limit=50` (`:126`) | characters across every registry, every show (`:152`) | — | `/character-registry` (`:182`) | Not show-scoped; stops at 50 registries |
| Wardrobe tile | `fetchClosetWithTotal` (`:124`) | the show's pieces (`:153`) | — | Wardrobe (`:183`) | — |
| 1 World Foundation | `/page-content/world_infrastructure` (`WorldSetupProgress.jsx:84`) | saved non-empty sections (`:51-53`) + Brain cards for `world_foundation` (`:97-110`) | cards > 0 or sections > 0 | `/universe?tab=world` | — |
| 2 Social Systems | `/page-content/influencer_systems` (`:85`) | same, for `social_systems` | same | `?tab=society` | — |
| 3 Culture & Events | `/calendar/events?event_type=lalaverse_cultural` (`:86`) | cultural calendar rows, no series filter | > 0 | `?tab=culture` | — |
| 4 Cultural Memory | `/page-content/cultural_memory` (`:87`) | same as 1, for `cultural_memory` | same | `?tab=culture&sub=history` | — |
| 5 Locations & Venues | `/world/locations` (`:88`) | all locations | > 0 | `?tab=world&sub=locations` | — |
| 6 Generate Feed | `/social-profiles?feed_layer=lalaverse&limit=1` (`:89`) | `pagination.total`: lalaverse profiles plus real-world profiles Lala follows, any status (`socialProfileRoutes.js:1262-1294,1390`) | > 0 | `/feed?tab=people&layer=lalaverse` | — |
| 7 Create World Events | `/world/:showId/events?status=draft` (`:90`) | draft `world_events` only | > 0 | `?tab=culture&sub=events` (`:39`) | Counts the show's events, but links to the cultural calendar list (`CultureEvents.jsx:76`) |

Findings:

- **7a — claim (c), MEASURED.**
  - **The quoted strings are from an earlier build.** At the basis the labels are `COUNT_LABELS = { … calendar: 'cultural calendar events', … events: 'draft events' }` (`WorldSetupProgress.jsx:56`). Steps 1, 2 and 4 show `brainDetail` text ("In the Brain · N cards", "Saved · N sections", or "Starter content only, not in the Brain yet", `:64-69`), never a bare "0 sections" (`:102-109`). Which commit changed them is INFERRED, not measured.
  - **Why both read 0 while the library holds 40:**
    - *Culture & Events* counts `story_calendar_events` rows of type `lalaverse_cultural` (`calendarRoutes.js:158-176`). The library counts `world_events` (`worldEvents.js:65-77`). A world event made in the library (`WorldAdmin.jsx:887`) creates no calendar row.
    - *World Foundation* counts saved `page_content` sections. The page opens on built-in starter content (`WorldFoundation.jsx:77`) and has nothing to do with events.
    - *Create World Events* counts drafts only, so 40 events marked ready, used or archived read 0.

## 8. "Brain Update" and "Connect to Brain"

- **MEASURED — one component, three labels.** `frontend/src/components/BrainUpdate.jsx` shows "Connect to Brain" when the preview state is `not_connected` (`:48`), "N Brain Update(s)" (`:50`), or "Brain Up to Date ✓". It is mounted on `CharacterLifeSimulation.jsx:420`, `CharacterDepthEngine.jsx:499`, `SocialPersonality.jsx:444`, `SocialTimeline.jsx:687`, `SocialSystems.jsx:96-97`, `CultureEvents.jsx:131-132` and `WorldFoundation.jsx:200`.
- **MEASURED — what it sends.**
  - `POST /api/v1/franchise-brain/sync/:source/preview` with `{ page_data }`, sent automatically on a 400 ms debounce (`BrainUpdate.jsx:33-36,79-83`).
  - On click, `POST /api/v1/franchise-brain/sync/:source/apply` with `{ page_data, fingerprint }` (`:99-108`).
  - Routes: `src/routes/brainSyncRoutes.js:36,45`, mounted at `src/app.js:1323-1324`.
- **MEASURED — "Connect to Brain" means** no active row carries this source's `source_key` prefix yet (`brainSyncService.js:56-60,95,102`).
- **MEASURED — what apply writes.**
  - New and changed cards are INSERTed into `franchise_knowledge` straight as `status 'active'` (no review queue), with `always_inject=false`, `extracted_by 'system'`, the manifest's `source_document` and `source_key`/`source_hash`, and no scope or show_id (`brainSyncService.js:136-166`).
  - Changed rows become superseded; retired rows become archived.
- **MEASURED — who reads the synced cards: none of the generators.**
  - The shared loader takes `always_inject: true` only (`brainRules.js:40`).
  - The manifests use severity `important`, so the critical-or-always-inject readers (guard, Amber, story evaluation, post-generation review) skip them too.
  - The only incidental readers are the memories engine (`memories/engine.js:2252-2256`, active, limit 15) and the script-writer guard (`episodeScriptWriterService.js:842-846`, active, limit 100).
  - `docs/BRAIN_OWNERSHIP.md:175-177,288` agrees.
  - The Social Systems copy says the script writers and Amber see these cards (`SocialSystems.jsx:42,44`); that does not match the code.
- **MEASURED — stale copy.** "Push to Brain" (`POST /franchise-brain/push-from-page`) is retired (`docs/BRAIN_OWNERSHIP.md:284-286`), but `frontend/src/pages/WorldSetupGuide.jsx:44,55,77` still says "Push to Brain".
- **MEASURED — pending entries.** Pending entries come from manual create, ingest-document, ingest-pdf and Amber. They become active only via `PATCH /entries/:id/activate` (`franchiseBrainRoutes.js:197`) or `POST /activate-all` (`:213`), from the Show Bible (`ShowBiblePage.jsx:108,117`).

## 9. Claims a–e

| Claim | Result |
|---|---|
| a. Feed picks archetypes from its own list | **MEASURED, reproduced.** `feedScheduler.js:177-181,272` vs `influencerData.js:12-27`; page text `SocialSystems.jsx:42` |
| b. Most locations have no DREAM city; Echo Park 1, others empty | **Mechanism MEASURED** (`dreamCityExplorer.js:13-18`; writers with no or legacy city). Row counts **INFERRED** (no database read). The five cities are defined at `frontend/src/data/dreamCities.js:7`, plus five copies (§2). Pulse City, Horizon City, Glow District and Creator Harbor are legacy *city* names, remapped by `20260725000000-unify-dream-cities.js:53-69`; they are not districts, and still appear in franchise-law seeders |
| c. "Culture & Events · 0 events", "World Foundation · 0 sections" vs 40 events | **MEASURED.** Different tables (§7a). The quoted labels are **not reproduced** at the basis: the strings belong to an earlier build |
| d. Planning → Location "No venue" though the Place has a venue | **MEASURED, reproduced.** Planning reads only top-level `venue_location_id` / `venue_name` (`frontend/src/utils/episodePlanning.js:31-33`; venue lookup `src/routes/worldEvents.js:221-234`). The Place falls back to `canon_consequences.automation` (`frontend/src/utils/eventReadiness.js:28-51`). Automated events put `venue_location_id` only in `automation` (`eventAutomationService.js:721` vs top-level payload `:770-797`; raw-SQL fallbacks `:803-807,823-826`). "STUDIO BY SABLE's Studio" fits the creator home-venue name `${displayName}'s ${label}` (`socialProfileRoutes.js:507`, INFERRED) |
| e. "from 0 documents" | **MEASURED, reproduced in code** (§5a). The missing production table is **INFERRED** |

## 10. Fix list (smallest first)

Each line is one broken link: the single owner it should read from, and the files a fix would touch. These become separate tasks; nothing is fixed here.

1. **The temperature copy says "one per accepted episode"; nothing writes it.** Owner: `worldTemperatureRoutes` (no caller). Fix the copy. Files: `frontend/src/lib/stateSummary.js`, `frontend/src/pages/WorldDashboard.jsx`.
2. **"Push to Brain" copy is stale.** Owner: `BrainUpdate`. Files: `frontend/src/pages/WorldSetupGuide.jsx`.
3. **Social Systems copy claims script writers and Amber read the cards, and "Edit them here".** Owner: `brainRules.selectInjectedRules`. Correct the copy. Files: `frontend/src/pages/SocialSystems.jsx`.
4. **Legends copy promises Character Registry naming; no link exists.** Owner: `frontend/src/data/legendaryGroups.js`. Correct the copy, or open a design task. Files: `SocialSystems.jsx`, `frontend/src/components/Society/SocietySummary.jsx`.
5. **The scanner misses lowercase `unresolved`.** Owner: the scanner. Files: `src/routes/worldStudio.js` (tension list).
6. **World Setup step 7 links to the cultural list but counts the show's draft events.** Owner: the Events library (`/shows/:id/world?tab=events`). Files: `frontend/src/components/WorldSetupProgress.jsx`.
7. **`/cross` guard makes the registry fallback dead.** Owner: `registry_characters`. Files: `src/routes/socialProfileRoutes.js`.
8. **confirm-feed profile has no `registry_character_id` or `feed_layer`.** Owner: `social_profiles.registry_character_id`. Files: `src/routes/characterGenerationRoutes.js`.
9. **Amber `push_page_to_brain` inserts a UUID into an INTEGER id.** Owner: `franchise_knowledge`. Files: `src/routes/memories/assistant.js`.
10. **The World Studio relationship POST drops `tension_state` and uses keys the scanner doesn't read.** Owner: `world_characters.relationship_graph`, in the scanner's keys. Files: `src/routes/worldStudio.js`.
11. **Planning → Location ignores the automation copy of the venue.** Owner: `resolveEventVenueAndDate` (`frontend/src/utils/eventReadiness.js`). Files: `frontend/src/utils/episodePlanning.js`, `frontend/src/components/Episodes/EpisodeOverviewTab.jsx`, `src/routes/worldEvents.js` (venue lookup).
12. **Automated events write `venue_location_id` only into `automation`.** Owner: `world_events.venue_location_id`. Files: `src/services/eventAutomationService.js`.
13. **Event venue auto-create defaults the city to 'Nova Prime'.** Owner: `frontend/src/data/dreamCities.js` / `src/utils/lalaHome.js`. Files: `src/services/eventAutomationService.js`.
14. **StateSummary history stops at 50 rows.** Owner: `GET /world/:showId/history`. Files: `frontend/src/components/State/StateSummary.jsx`.
15. **Episode-completion memory entries have no `show_id`, so Cultural memory is not per show.** Owner: `franchise_knowledge.show_id`. Files: `src/services/episodeCompletionService.js`, `frontend/src/components/Culture/CultureYear.jsx`.
16. **Characters tile counts every registry, not the show's.** Owner: the show's registry (`characterRegistry` route). Files: `frontend/src/pages/UniversePage.jsx`.
17. **Script writers read snapshots by a non-existent `show_id`.** Owner: `world_state_snapshots` (scoping is Evoni's call: world-level, `universe_id`, or a new `show_id` column). Files: `src/services/episodeScriptWriterService.js`, `src/services/groundedScriptGeneratorService.js`, possibly a new `src/migrations/` file.
18. **Locations get no DREAM city from properties, rooms, scene sets or story extraction, and the form takes free text.** Owner: `dreamCities` (a select), with rooms inheriting the parent's city. Files: `frontend/src/pages/WorldFoundation.jsx`, `frontend/src/lib/dreamCityExplorer.js`, `src/routes/propertyRoutes.js`, `src/routes/sceneSetRoutes.js`, `src/routes/memories/engine.js`.
19. **The `brain_documents` table is only created by a dead-tree migration.** Owner: `BrainDocument`. Files: a new `src/migrations/` file (with `deleted_at`). Production is Evoni's to migrate.
20. **Legacy city names in the always-inject franchise laws.** Owner: `dreamCities`. Files: a new `src/migrations/` (or seeder) update for the `franchise_knowledge` rows, the seeders listed in §2c.
21. **Culture and Society read `page_content` edits but have no save wiring.** Owner: `page_content` via `usePageData`. Files: `frontend/src/pages/CultureEvents.jsx`, `frontend/src/pages/SocialSystems.jsx`, `frontend/src/components/Culture/*`.
22. **Nothing records the world temperature.** Owner: `snapshotTemperature`. Call it on episode accept, or remove the temperature UI. Files: `src/services/episodeCompletionService.js` or `src/routes/worldTemperatureRoutes.js` callers, State tab files.
23. **The tension scanner reads one of three relationship stores; the Relationships page edits another.** Owner: one store (Evoni's call). Files: `src/routes/worldStudio.js`, `src/routes/relationships.js`, `src/services/worldTemperatureService.js`.
24. **Brain Update cards are never injected into any generator.** Owner: `brainRules.selectInjectedRules` (rule: which cards count). Files: `src/services/brainRules.js`, `src/services/brainSyncService.js`, `docs/BRAIN_OWNERSHIP.md`.
25. **Direct `franchise_knowledge` readers bypass the shared loader and show scope.** Owner: `brainRules`. Files: `episodeScriptWriterService.js`, `storyEvaluationRoutes.js`, `episodeBriefRoutes.js`, `memories/engine.js`, `tierFeatures.js`, `upgradeRoutes.js`, `franchiseBrainRoutes.js`, `memories/assistant.js`.
26. **Two archetype lists.** Owner: one list (Evoni's call: the 10 Feed ENUM keys or the 15 Society names). Files: `frontend/src/data/influencerData.js`, `src/models/SocialProfile.js` (ENUM, a migration), `src/services/feedScheduler.js`, `src/utils/fitToModel.js`, `src/utils/feedProfileUtils.js`, `src/services/characterFollowService.js`, `frontend/src/pages/feed/feedConstants.js`.
