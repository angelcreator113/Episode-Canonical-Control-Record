# Episode production workspace — a read, not a ruling

## Status of this document

**Read-only research.** This document recommends nothing and rules nothing.
It covers the Start Episode handoff, how an episode finds its event, the two
wardrobe surfaces, the Phone sub-tab and the 14 beats, and the Production
sub-tabs.

It changes no code, runs no query and writes no migration. No database was
queried, and no host, AWS, database or Cognito contact was made.

Every claim is marked one of two ways:
- **MEASURED**: read from this repository, with a file:line.
- **CANNOT-TELL**: the repository does not settle it.

Production schema facts cite the filed canon capture,
`docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt`, called the
*canon capture* below.

Basis for the file:line citations: `origin/main` at
`5090ee59d332290197d301ea93410908a7148657` (2026-09-28, #2199). Each citation
is paired with a function, route, component or `TABS` key, which outlasts the
line number.

---

## 1. Start Episode: every write — MEASURED

### 1.1 Where it starts

- **The "Start Episode" button** is in `EventPackagePage`
  (`frontend/src/pages/EventPackagePage.jsx:1369–1375`,
  `data-testid="start-episode"`).
  - It renders only while the event is not used: `used =
    !!event.used_in_episode_id` (`:377`), checked at `:1362`.
  - `requestStartEpisode` (`:813`) opens a confirm when there are warnings.
    `handleStartEpisode` (`:819`) then posts to
    `/api/v1/world/${showId}/events/${eventId}/generate-episode` with
    `{ draft_script: false }` (`:824`).
- **The route** is `router.post('/world/:showId/events/:eventId/generate-episode'`
  (`src/routes/worldEvents.js:2132`).
  - It reads the event, then calls `episodeGenerator.generateEpisodeFromEvent`
    (`:2171`).
  - A conflict code maps to 409 (`:2213–2216`). Anything else is 500.
- **Two other routes call the same generator:**
  - `generate-episode-from-many` (`worldEvents.js:2233`, call at `:2273`). It
    is posted by WorldAdmin's "Generate from N events" (`WorldAdmin.jsx:2087`)
    and by `NextEventSuggestionsOverlay` (`:58`).
  - `regenerate-episode` (`worldEvents.js:2347`, call at `:2389`).
- **A separate path, `inject`:** `router.post('/world/:showId/events/:eventId/inject'`
  (`worldEvents.js:1014`) does not use the generator. It is used by
  `QuickEpisodeCreator` and by WorldAdmin.

### 1.2 `generateEpisodeFromEvent` (`src/services/episodeGeneratorService.js:431`)

**Before any write:**
- **Live-episode guard:** `findLiveLinkedEpisode` (`:444`,
  `src/utils/eventEpisodeLink.js:23`). If the check query throws, the guard is
  skipped with a warning (`:446–448`).
- **Deliverables read:** `listEventDeliverables` (`:610`). On failure the
  snapshot carries no deliverables (`:611–612`).
- **Terms snapshot:** `buildTermsSnapshot` (`:614`) builds it in memory.

**Inside one transaction** (`models.sequelize.transaction(async (transaction) => {`
at `:623`; comment at `:616–622`: "commit together or not at all"):

1. **`Episode.create`** (`:624–633`, `{ transaction }`). Columns written:
   `show_id`, `title`, `description`, `episode_number`, `status: 'draft'`,
   `categories`, and zero income and expenses. **No event column exists on
   `episodes`, so none is written** (§2.1).
2. **`EpisodeBrief.create`** (`:642–710`, `{ transaction }`), only
   `if (EpisodeBrief)` (`:636`). It writes:
   - `event_id: event.id` (`:645`);
   - `narrative_chain` (`:659`) and `canon_consequences` (`:667`);
   - `career_context` (`:669`) and `event_difficulty` (`:676`);
   - `event_metadata` (`:685`), which includes `terms: termsSnapshot`
     (`:699`). **This is the snapshot.**
3. **`stampEventUsed`** (`:713`; defined at `:413–421`). It runs
   `UPDATE world_events SET status = 'used', used_in_episode_id = :episodeId,
   times_used = COALESCE(times_used, 0) + 1, updated_at = NOW() WHERE id =
   :eventId RETURNING id` inside the transaction. It throws if no row is
   updated (`:418–419`).

**After the commit.** Each of these is non-fatal: it logs its own failure and
the Start still succeeds.

4. **Deliverable stamping:** `stampDeliverablesEpisode` (`:721`;
   `src/services/eventTermsService.js:155–162`) runs `UPDATE
   event_deliverables SET episode_id = :episodeId … WHERE event_id = :eventId
   AND deleted_at IS NULL`. It runs only when deliverables were read (`:719`),
   and a failure is logged (`:722–723`).
5. **Overlays:** `autoPlaceRequiredOverlays` (`:737`), logged on failure
   (`:747`).
6. **Scene plan (14 beats):** `createScenePlanRows` (`:754`) runs a raw
   `INSERT INTO scene_plans` (`:387`).
   - It is called outside any try in the generator. Its own per-beat try/catch
     is at `:384`/`:396`.
   - **CANNOT-TELL** whether it can throw past those catches. If it did, the
     committed episode, brief and stamp would remain while the route returns
     500.
7. **`SceneSetEpisode.findOrCreate` / `update`** (`:770–775`), with a per-row
   catch.
8. **Feed moments:** `row.update(...)` on scene-plan rows (`:796–808`). See
   §4.3: `scenePlanRows` holds plain objects (`:395`), so `row.update` throws,
   and the error is logged as non-blocking at `:807`.
9. **`INSERT INTO episode_todo_lists … event_id … ON CONFLICT (episode_id) DO
   UPDATE`** (`:864`). This is a second episode→event link (§2.1). It has a
   catch at `:882`.
10. **Later writes, each with its own catch:**
    - `episode.update` of financials (`:888`);
    - `linkEpisodeWardrobe` (`:908`);
    - `UPDATE assets SET episode_id` (`:956`);
    - `characterSync.recordEventHistory` (`:977`);
    - `feedActivity.generatePostEventActivity` (`:987`).

### 1.3 The terms lock — MEASURED

No lock is written. Neither events nor deliverables have a `locked_at` or
`terms_locked` column. **The lock is derived from
`world_events.used_in_episode_id`:**
- `src/routes/eventDeliverables.js` returns 409 when `event.used_in_episode_id`
  is set (`:141`, `:193`, `:225`) and reports `locked:
  !!event.used_in_episode_id` (`:118`).
- The event PUT (`router.put('/world/:showId/events/:eventId'`,
  `worldEvents.js:627`) does not check `used_in_episode_id`. Its allowlist
  (`:670–684`) accepts `is_paid`, `payment_amount` and `requirements`, and also
  `used_in_episode_id` itself.
- For a used event, those term fields are held only by the UI hiding its edit
  controls (`EventPackagePage.jsx:1362`).

### 1.4 If a write fails — MEASURED from the code's structure

- **Writes 1–3** roll back together. That leaves no episode, no brief and no
  stamp; the route returns 500, or 409 for a conflict.
- **If `EpisodeBrief` is not loaded,** the episode commits with no brief and no
  `event_id` snapshot. Only the stamp links it.
- **If deliverable stamping fails,** the episode and stamp stay committed and
  `event_deliverables.episode_id` stays NULL. The failure is only logged.
- **`generate-episode-from-many`** stamps the extra events after the generator
  returns, each with its own `UPDATE world_events SET used_in_episode_id …,
  status = 'used'` (`worldEvents.js:2287`).
  - This happens outside the transaction.
  - It does not increment `times_used` or stamp deliverables.
  - Failures are collected in `skipped_extras`.
- **`regenerate-episode`** runs two writes before the generator, outside any
  transaction:
  - `UPDATE world_events SET used_in_episode_id = NULL` (`:2368`);
  - `UPDATE episodes SET deleted_at = NOW()` (`:2369`).

  If the generator then fails, the old episode stays soft-deleted and the
  event stays unlinked.
- **`inject`** (`worldEvents.js:1014`) makes separate writes with no
  transaction and no live-episode guard:
  - `episode.update({ script_content })` (`:1081`);
  - `UPDATE world_events SET used_in_episode_id, times_used + 1, status =
    'used'` (`:1085`, fallback `:1090`);
  - the invitation's `assets.episode_id`.

  It writes no brief, deliverable stamp or terms snapshot.

---

## 2. How an episode finds its event — MEASURED

### 2.1 Columns

| Link | Where | Canon capture | Notes |
|---|---|---|---|
| `world_events.used_in_episode_id` | model `WorldEvent.js:310`; `belongsTo(Episode, { as: 'usedInEpisode' })` `:382–385`; migration `20260219000003-world-events.js:155` | uuid (line 2682) | Partial unique index `world_events_used_in_episode_unique` in `20260805000000-episode-brief-outfit-set-and-event-uniqueness.js:43–45`, created inside a try/catch. **CANNOT-TELL** whether it exists in production. |
| `episode_briefs.event_id` | model `EpisodeBrief.js:24` (paranoid, `:60`); migration `20260629000000-create-episode-briefs-scene-plans.js:32` | uuid, nullable (line 542) | No FK. Written only by the generator (§1.2 step 2). |
| `episode_briefs.event_metadata` | model `:46` | jsonb | The terms snapshot (§1.2). |
| `episode_todo_lists.event_id` | migration `20260705000000-create-episode-todo-lists.js:32` | uuid, nullable (line 652) | Written at `episodeGeneratorService.js:864` and `worldEvents.js:3666`/`:3673`. No dedicated reader found (**CANNOT-TELL**). |
| `event_deliverables.episode_id` | migration `20260924000000-add-event-terms.js:82` | not in the 09-17 capture (table created later) | Stamped after the commit (§1.2 step 4). |

`episodes` has no event column in the model (`src/models/Episode.js`) or in
the canon capture (lines 678–719). No `source_event_id` or `world_event_id`
column exists.

### 2.2 Readers

- **The canonical reader** is `listEpisodeEvents`
  (`src/services/episodeEventsService.js:57`). It reads the brief's `event_id`
  first (`EpisodeBrief.findOne`, `:64–65`), then `WorldEvent.findAll({ where:
  { used_in_episode_id } })` (`:69`).
  - It is served by GET `/api/v1/episodes/:id/events` (`src/routes/episodes.js:305`).
  - The frontend reads it through `getEpisodeEvents` / `getEpisodeAnchorEvent`
    (`frontend/src/services/episodeEventsApi.js:11`, `:16`), used by:
    `EpisodeDetail.jsx:320`, `EpisodeOverviewTab.jsx:121`,
    `EpisodeAssetsTab`, `EpisodeProductionChecklist`.
  - It is the only reader of `episode_briefs.event_id`.
- **Backend readers that match `used_in_episode_id = episodeId` only** (they
  ignore the brief):
  - `loadScriptContext` (`episodeScriptWriterService.js:109`);
  - `loadScoringEvent` (`outfitScoreContext.js:88`, `ORDER BY prestige DESC
    LIMIT 1`);
  - `generateGroundedScript` (`groundedScriptGeneratorService.js:92`);
  - `finalizeEpisodeFinancials` (`financialTransactionService.js:360`);
  - `generateScenePlan` (`scenePlannerService.js:94`);
  - `gatherEpisodeContext` (`distributionService.js:89`);
  - `generateEpisodeFeedPosts` (`feedPostGeneratorService.js:42`);
  - `generateEpisodeTodoList` / `generateCareerList` (`todoListService.js:443`,
    `:678`);
  - `generateEpisodeStory` (`storyGenerationService.js:70`);
  - `onEpisodeCompleted` (`careerPipelineService.js:318`);
  - `loadEventContext` (`sceneGenerationService.js:664`);
  - `detectRepeats` (`wardrobeIntelligenceService.js:835`);
  - POST `/wardrobe/browse-pool` (`wardrobe.js:1110`);
  - GET `/wardrobe/outfit-history/:showId` (`wardrobe.js:2004`);
  - POST `/episodes/:id/generate-beats` (`episodes.js:954`);
  - POST `/episodes/:id/evaluate` (`evaluation.js:285`);
  - `next-suggestions` (`worldEvents.js:4409`).
- **Frontend readers that scan the show's whole event list for
  `used_in_episode_id`:**
  - `EpisodeWardrobeTab.jsx:43`;
  - `QuickEpisodeCreator.jsx:218` (falls back to `events[0]`);
  - `WorldAdmin.jsx:806`, `:1226`, `:1241`, `:1832`, `:2737`, `:3362`, `:3421`,
    `:3434`, `:7806`;
  - `eventReadinessSections.js:335`, `EventPackagePage.jsx:377`.
- **`EpisodeOverviewTab.jsx:236`/`:252`** sets or clears the link through the
  event PUT.
- **`generate-title-overlay`** clears a stale link (`worldEvents.js:3889`).

---

## 3. Wardrobe — MEASURED

### 3.1 `EpisodeDetail` → Production → Wardrobe (mounted)

- **Mounting:**
  - `EP_TABS` (`frontend/src/pages/EpisodeDetail.jsx:83`) includes `production`
    → `{ key: 'wardrobe', label: 'Wardrobe' }` (`:89`).
  - The legacy key `'wardrobe'` resolves to `['production', 'wardrobe']`
    (`resolveEpTab`, `:105`).
  - When `tabKey === 'production.wardrobe'` (`:724–775`), it renders an event
    `<select>` if there is more than one event (`:729–752`), then the lazy
    `EpisodeWardrobeGameplay` (import `:22`, mount `:754`) with
    `event={selectedEvent}`.
- **Loads:** only while that tab is open (the `useEffect` at `:311–341`).
  - `getEpisodeEvents(episodeId)` → GET `/api/v1/episodes/:id/events` (`:320`,
    §2.2).
  - `getCharacterStateApi('lala', showId)` → GET
    `/api/v1/characters/:key/state` (`:332`; `src/routes/evaluation.js:189`).
  - The child `EpisodeWardrobeGameplay`
    (`frontend/src/components/EpisodeWardrobeGameplay.jsx`) calls these
    `src/routes/wardrobe.js` routes:
    - `/wardrobe/browse-pool` (`:205` → `:1093`);
    - `/wardrobe/outfit/:episodeId` (`:234` → `:127`);
    - `/wardrobe?show_id=&limit=200` (`:286`, `loadCloset` → `:312`);
    - `/wardrobe/outfit-history/:showId` (`:325` → `:1989`);
    - `/wardrobe/outfit-score/:episodeId` (`:372`/`:373` → `:264`/`:283`);
    - `/wardrobe/purchase` (`:483` → `:1680`);
    - `/wardrobe/lock-outfit-atomic` (`:518` → `:1534`).

    It also calls `/episodes/:id/todo` (`:317`).
- **"No events linked to this episode"** (`:768`) is the else branch of
  `episodeEvents.length > 0` (`:727`). `episodeEvents` starts as `[]` (`:188`),
  so the text shows in four cases:
  - when `/episodes/:id/events` returns no events;
  - while the fetch is pending;
  - if the fetch fails (the catch at `:324–326` only logs);
  - when there is no `showId` (early return at `:314`).
- **Show-wardrobe fallback as the outfit:** none. `loadCloset` fills
  `closetItems` from the show wardrobe (`EpisodeWardrobeGameplay.jsx:282–298`),
  and they are used by the browse modes (`:306`, `:722`). Restoring the outfit
  uses the locked outfit (`/wardrobe/outfit/:episodeId`), then a localStorage
  draft `wardrobe_draft_${episodeId}` (`:230–270`).
- **"Pick Outfit":** the text is not present in `EpisodeDetail.jsx` or
  `EpisodeWardrobeGameplay.jsx`. Picking happens inline in the gameplay
  component.
- **Outfit-set controller:** none. There is no `outfit-set` / `outfitSet` /
  `outfit_set` reference in either file.

### 3.2 `components/Episodes/EpisodeWardrobeTab.jsx` (not mounted)

- **Nothing imports it.** The only other mention in code is a comment at
  `src/routes/wardrobe.js:1881`.
- **Loads** (`loadData`, `:32–58`):
  - GET `/api/v1/wardrobe?show_id=${showId}&limit=200` (`:37`);
  - GET `/api/v1/world/${showId}/events` (`:38`; `worldEvents.js:46`).
  - It then scans that event list for `e.used_in_episode_id === episodeId`
    (`:43`).
- **"No events linked":** not present. The empty state is "No outfit selected"
  (`:126`), shown when `items.length === 0` (`:123`).
- **Show-wardrobe fallback as the outfit: yes** (`:49–55`). When the linked
  event has no `outfit_pieces`, it runs `setItems(allWardrobe.slice(0, 10))`
  from the show wardrobe. Those items render under "Episode Outfit" (`:76`),
  with a piece count and total (`:78`) and in the grid (`:142–195`).
- **"Pick Outfit"** (`👗 Pick Outfit →`, `:83–88`) navigates to
  `/shows/${showId}/world?tab=events`, which is `WorldAdmin` (`App.jsx:377`).
  The empty state's "Go to Producer Mode" (`:131`) goes to the same place.
- **Outfit-set controller:** none. It reads `outfit_pieces` from the event
  (`:46`).

### 3.3 F-Ward-3 overlap

- **Two outfit-set controllers exist:**
  - The singular `src/controllers/outfitSetController.js` is served by
    `src/routes/outfitSets.js` at `/api/v1/outfit-sets` (`src/app.js:846`).
  - The plural `src/controllers/outfitSetsController.js` is required by
    `src/routes/episodes.js:10`, at `/:id/outfits` (GET `:104`, POST `:112`,
    DELETE `:120`).
- **F-Ward-3** is the keystone to delete the plural controller: "dead code
  wired to live URLs" with a `this.` binding bug that crashes every create
  (`docs/audit/F-AUTH-1_Fix_Plan_v2.37.md:274`, `:5282`).
- **Overlap: none measured.** Neither wardrobe surface calls either
  controller.

---

## 4. Phone — MEASURED

### 4.1 `production.phone`

- **The mount:** `EP_TABS` → `{ key: 'phone', label: 'Phone' }`
  (`EpisodeDetail.jsx:90`; legacy key `'phone'` → `resolveEpTab` `:106`).
  - `tabKey === 'production.phone'` mounts `<EpisodeLalasPhoneTab
    episode={episode} onPreview={phone.start} />` (`:840–841`; lazy `:19`;
    component `frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx:89`).
- **What it contains:**
  - An embedded `PhonePreviewMode` with `playthrough={null}`, which saves
    nothing (`:189–199`).
  - The screens and icons from GET `/api/v1/ui-overlays/:showId?episode_id=`
    (`:42–47`).
  - Feed moments from GET `/api/v1/feed-enhanced/:showId/moments/:episodeId`
    (`:52–55`).
  - A deferred notice, "Requirements appear once beats exist" (`:301–310`).
  - `EpisodePhoneMissionsTab` (`:314`).
  - A link to the Phone Hub tab, `/shows/${showId}/world?tab=overlays-tab`
    (`:148`).

### 4.2 Phone playback

- **Hook and overlay:** `EpisodeDetail` holds `const phone =
  usePhonePlayback(episode)` (`:78`) and renders the Preview overlay at
  `:1000–1014`: `<PhonePreviewMode screens={phone.overlays} …
  playthrough={phone.playthrough} missions={phone.missions}>` (lazy `:25`;
  component `frontend/src/components/PhonePreviewMode.jsx:36`).
- **`usePhonePlayback`** (`frontend/src/hooks/usePhonePlayback.js:31`):
  `start()` (`:43`) loads the overlays (`:50`), the frame (`:56`) and missions
  (`:64`), and wires `usePhonePlaythrough` (`:41`).
- **`usePhonePlaythrough`** calls GET, then POST `/tap` and `/reset`, on
  `/api/v1/episodes/:id/phone-state` (`frontend/src/hooks/usePhonePlaythrough.js:22`,
  `:35`, `:49`).
- **Backend:** mounted at `src/app.js:1569–1570`; routes in
  `src/routes/phonePlaythroughRoutes.js`.
  - GET `/` (`:99`) goes through `loadOrCreateState` (`:26`), which creates a
    `PhonePlaythroughState` row on read.
  - POST `/tap` (`:115`), `/reset` (`:220`) and `/complete` (`:243`).
  - Rules are evaluated by `src/services/phoneRuntime.js` (`evaluate` `:79`,
    `applyActions` `:99`, `evaluateMission` `:189`).
- **The Phone Hub** is `UIOverlaysTab`, at `/phone-hub` (`App.jsx:391`) and as
  WorldAdmin sub-tab `overlays-tab` "Lala's Phone" (`WorldAdmin.jsx:203`,
  mount `:5195–5197`). The episode tab does not mount it; it reads the same
  `ui-overlays` data filtered by episode.

### 4.3 The 14 beats

- **The template:** `CANONICAL_BEATS` (`src/constants/canonicalBeats.js:77`,
  exported `:329`) holds 14 beats.
  - Fields per beat: `number`, `name`, `typical_location`, `description`,
    `narrative_purpose`, `screen_action`, `actor`, `surface`, `diegetic`,
    `phase`, `emotional_intent` (documented at `:14–62`).
  - `surface` is `'Host Environment' | 'Full Screen' | "Lala's Phone" |
    "Lala's Environment" | 'none'`, or `{ start, end }`.
  - `surface: "Lala's Phone"` is set on beats 4 (`:133`), 7 (`:201`), 8
    (`:220`), 9 (`:238`), 10 (`:259`) and 12 (`:290`). Beat 5 is `{ start:
    "Lala's Phone", end: 'Full Screen' }` (`:167`).
  - It is a constant, not stored per episode.
- **Per-episode beat rows:** `ScenePlan` (`src/models/ScenePlan.js`, table
  `scene_plans`, unique on `(episode_id, beat_number)`, `:50`).
  - Declared fields (`:11–33`): `beat_number`, `beat_name`, `scene_set_id`,
    `angle_label`, `shot_type`, `emotional_intent`, `transition_in`,
    `scene_context`, `director_note`, `locked`, `sort_order`, `ai_suggested`,
    `ai_confidence`. **There is no `surface` and no beat-type field.**
  - `feed_moment` and `script_lines` appear only as comments (`:34–35`). Their
    columns come from migration `20260716000000-scene-plan-feed-moments.js:7–16`.
  - Both writers leave out `surface`:
    - the generator's raw INSERT (`episodeGeneratorService.js:387`);
    - `ScenePlan.bulkCreate` (`scenePlannerService.js:239`).

    The generator maps the template to `{ beat, label, phase, emotional_intent,
    description }` only (`episodeGeneratorService.js:263–269`).
  - **The feed-moment attach never persists.** It calls `row.update(...)` on
    `scenePlanRows` (`:796–808`), but those rows are plain objects pushed at
    `:395`. So `row.update` throws, and the error is logged as non-blocking
    (`:807`).
- **Per-episode phone-typed rows:** `FeedMoment` (`src/models/FeedMoment.js`;
  migration `20260723000001-create-feed-moments.js:10–46`) stores
  `beat_number` and `phone_screen_type` (model `:25`: "notification | post |
  story | dm | live | ui_interaction").
  - Writer: `persistFeedMoments` (`src/services/feedPostGeneratorService.js:318`,
    `FeedMoment.create` `:334`, `phone_screen_type: m.on_screen?.type` `:342`),
    called from `src/routes/feedEnhancedRoutes.js:139–140`.
  - The beat-to-type map is `BEAT_PHONE_MOMENTS`
    (`src/services/feedMomentsService.js:113–127`). Its own comment
    (`:55–70`) says it predates the persistent-phone ruling.
- **Could phone moments be derived from the beats?**
  - **MEASURED:** the static template marks phone beats by `surface` (beats 4,
    5 (start), 7, 8, 9, 10, 12).
  - **MEASURED:** per-episode `scene_plans` rows carry no `surface` or type.
  - **MEASURED:** per-episode `feed_moments` rows carry `beat_number` and
    `phone_screen_type`.
  - **CANNOT-TELL** whether a given episode has `feed_moments` rows (§6).
- **Not the 14 beats:** the `Beat` model (`src/models/Beat.js`) is per-scene
  animatic timing (`beat_type` ENUM `dialogue | ui_action | sfx | music | cta
  | transition`, `:29–30`).

---

## 5. Production sub-tabs as mounted — MEASURED

`EP_TABS` → `production` (`EpisodeDetail.jsx:86–92`):

| Sub-tab key | Label | Mounts (when `tabKey === 'production.<key>'`) |
|---|---|---|
| `assets` | Assets | `EpisodeAssetsTab` (lazy `:18`, `:692`); an inline placeholder when the episode has no show |
| `scenes` | Scenes | `EpisodeScenesTab` (lazy `:24`, `:716`) |
| `wardrobe` | Wardrobe | `EpisodeWardrobeGameplay` with an event picker (§3.1) |
| `phone` | Phone | `EpisodeLalasPhoneTab` (§4.1) |
| `checklist` | Production Checklist | `EpisodeProductionChecklist` (lazy `:23`, `:845`) |

**Character Clips:**
- **Backend:** model `src/models/CharacterClip.js` (`character_clips`, `:112`),
  controller `src/controllers/characterClipController.js`, and routes
  `src/routes/character-clips.js`:
  - GET/POST `/scenes/:sceneId/character-clips` (`:18–19`);
  - GET/PATCH/DELETE `/character-clips/:id` (`:22–24`);
  - mounted at `/api/v1` (`src/app.js:774–778`).

  `beatService.bulkCreateCharacterClips` (`:290`) also writes the model.
- **No frontend caller of `/character-clips` was found.** There is no
  Character Clips component or tab key.
- **The only UI is "Track 3: Character Clips"** in `Timeline`
  (`frontend/src/components/Timeline/Timeline.jsx:520–526`). It is fed by
  `TimelineEditor` from `/api/v1/episodes/:id/timeline-data`: the
  `TimelineData.character_clips` JSONB (`src/models/TimelineData.js:48–52`),
  not the `CharacterClip` model. The route is `/episodes/:episodeId/timeline`
  (`App.jsx:404`).
- **Reachability from EpisodeDetail:** indirect.
  - `EpisodeDetail.jsx` has no "timeline" reference.
  - Production → Scenes (`EpisodeScenesTab`) has a "Timeline Editor" button
    (`:407`) that navigates to `/studio/timeline?episode_id=…`.
  - `StudioTimelinePage` (`App.jsx:383`) does not read `episode_id`. It
    redirects to `/episodes/${localStorage 'working-episode-id'}/timeline`, or
    shows a list (`StudioTimelinePage.jsx:16–22`, `:47`). So it can open a
    different episode's timeline.

---

## 6. SQL for Evoni — CANNOT-TELL from the repository

**EVONI-ONLY.** Run these yourself, as the app user, against the database the
API uses. No agent session runs them. All are read-only `SELECT`s. Replace
`:episode_id` with the episode's id. Column names are checked against the
canon capture (lines 537–545, 651–652, 684–712, 2638–2682);
`event_deliverables` post-dates it (`20260924000000-add-event-terms.js`).

```sql
-- 1. The episode and its brief's event (the snapshot link)
SELECT e.id, e.title, e.deleted_at,
       b.id AS brief_id, b.event_id AS brief_event_id, b.deleted_at AS brief_deleted_at
FROM episodes e
LEFT JOIN episode_briefs b ON b.episode_id = e.id
WHERE e.id = :episode_id;

-- 2. That event's used_in_episode_id, and whether it points back at this episode
SELECT we.id, we.name, we.status, we.times_used, we.deleted_at,
       we.used_in_episode_id,
       (we.used_in_episode_id = :episode_id) AS points_back
FROM world_events we
WHERE we.id IN (SELECT event_id FROM episode_briefs WHERE episode_id = :episode_id);

-- 3. Every event that points at this episode (the stamp link)
SELECT id, name, status, times_used, deleted_at
FROM world_events
WHERE used_in_episode_id = :episode_id
ORDER BY created_at;

-- 4. The other two episode→event links
SELECT event_id FROM episode_todo_lists WHERE episode_id = :episode_id;
SELECT id, event_id, deleted_at FROM event_deliverables WHERE episode_id = :episode_id;
```

Reading them together:
- If query 1 returns a `brief_event_id` but query 3 returns no row, the brief
  and the stamp disagree.
- If query 3 returns more than one row, more than one event is stamped with
  this episode (for example through `generate-episode-from-many`, §1.4).

---

## What this document does not do

- It recommends nothing and rules nothing.
- It changes no code, doc or migration, and edits nothing under `docs/audit/`.
- It runs no query. §6 is for Evoni to run herself.
- It makes no host, AWS, database or Cognito contact.
