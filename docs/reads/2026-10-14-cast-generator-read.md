# Cast read: the one-click character generator, feed profiles and character records

Date: 2026-10-14. Basis: `074249e415cfa9aaf4bedc51a38a555f0a64119f` (origin/main). Read-only: no code, register, host, AWS, database or Cognito contact. Citations are `file:line` at that SHA. Each claim is **MEASURED** (read in code, migrations or git history) or **INFERRED**. What the database holds is never measured here; where a claim depends on the data, it says so.

This is Task #3197: before "Add character" becomes "Generate who the story needs", how characters are made today, why every feed person shows "No character yet", Lala's "Special" role, and where Create Episode could ask "Who's new in Lala's life this episode?". It ends with a plan of PR-sized issues (§8), not opened yet.

## 1. Summary

1. **The one-click generator still exists, but it is not on The Pulse** (MEASURED).
   - It is **Auto-Generate** ("+ Generate 5" / "Generate N Creators") in `SocialProfileGenerator`.
   - It fills gaps in the feed's *composition*: platform, archetype, category, tier and the least-used Society archetypes.
   - It reads no events, storylines, threads or character records.
   - It creates a **feed profile only**: no character record and no Voice Profile.
2. **A feed person and a character are linked only by `registry_characters.feed_profile_id`** (MEASURED).
   - Three actions write that link: Confirm-feed, Cross and Match.
   - Generating a feed profile writes none, so every generated person shows "No character yet" until one of those actions runs (INFERRED for the data, MEASURED for the code).
3. **"1 character across 2 registries" counts live `registry_characters` rows across `character_registries` rows** (MEASURED). Those are the old character system's registries, not The Pulse's people.
4. **Lala is `role_type: 'special'`, set by a seed route** (MEASURED). The Cast page's Protagonist count and warning look for `'protagonist'`. `'special'` also drives four backend rules, so the safe fix is the **filter**, not the data (§5).
5. **Create Episode is now New Episode → Event Package → Start Episode** (MEASURED). The question "Who's new in Lala's life?" fits as a step in Start Episode, between the locations step and generating the episode.
6. **Plan:** five issues, **none needs a migration** (§8).

## 2. The old one-click generator (item 1)

### 2.1 Where it is
- **The button** (MEASURED):
  - `frontend/src/pages/SocialProfileGenerator.jsx:969-975`: "+ Generate 5" on the collapsed bar, `setAutoGenCount(5); runAutoGenerate()`.
  - The expanded bar's "Generate {N} Creators" (`:997-1005`, N from 1/3/5/10/15/20 at `:986`).
  - The empty state at `:1331`.
  - `runAutoGenerate` is at `:642-652` and calls `triggerAutoGenerateJob` (`:100-101`).
- **Where it is shown** (MEASURED):
  - Commit `a3d6dc01` (#2898, 2026-10-11, "one home for making feed profiles") took the generator out of the old Feed page (`SocialMediaPage`, now The Pulse at `/pulse`, `frontend/src/App.jsx:539`).
  - It now lives in World Studio's Feed tab (`frontend/src/pages/WorldStudio.jsx:1208`) and New Episode's choose-a-host (`frontend/src/pages/NewEpisodeStarter.jsx:356-366`).
  - No string like "the story needs" was ever in a feed page (`git log -S` on several phrasings; MEASURED). The "story needs" behaviour is this button's gap-filling prompt (§2.3).
- **A second no-typing button, "+ Fill One"** (MEASURED):
  - It is at `frontend/src/pages/feed/FeedViews.jsx:576-578`. It calls `fillOneProfile` (`SocialProfileGenerator.jsx:623`), which posts to `/feed-scheduler/fill-one`.
  - It uses a random template spark, not the gaps.

### 2.2 Route and service (MEASURED)
- **Route:** `POST /api/v1/feed-scheduler/auto-generate-job`, `src/routes/feedSchedulerRoutes.js:220`, with `requireAuth, aiRateLimiter`.
  - It checks the layer's cap, creates a `BulkImportJob` (`:255`) and runs `processAutoGenInBackground` (`:267`, `:284`).
  - The synchronous `POST /auto-generate` is at `:163`.
- **Service** (`src/services/feedScheduler.js`):
  - `autoGenerateBatch` `:482`.
  - `generateSmartSparks` `:310`, with fallback `generateCreatorSpark` `:510`.
  - `generateAndSaveProfile` `:581`.
- **Side finding:** `POST /feed-scheduler/fill-one` (`feedSchedulerRoutes.js:111`) has `requireAuth` but **no `aiRateLimiter`**. CLAUDE.md's convention is that AI handlers add it.

### 2.3 The prompts (MEASURED)
- **Sparks** use Haiku 4.5 (`feedScheduler.js:434`). The prompt is built at `:382-428`. Its key lines:
  - `:382`: "You are designing the social media feed for a novel. Generate exactly ${count} unique creator sparks".
  - The existing feed composition by archetype, platform, category and tier.
  - `:404`: "Fill GAPS in the existing distribution".
  - `:407`: "Each creator should have parasocial potential — why would the protagonist keep watching?"
  - The season directive (`:358-363`), the Show Bible block and the Society archetype block (`:386`).
- **The full profile** uses Sonnet 4.6 (`:718`). The prompt is at `:636-716`, with the protagonist's wound and goal hard-coded at `:590-606`, then the creator, city, Lala relationship and career pressure.

### 2.4 What it reads and what it does not (MEASURED)
| Input | Read? | Where |
|---|---|---|
| Existing cast | Counts only: the newest 80 `social_profiles` in the layer, by handle, platform, archetype, category, tier, place and age; no names or stories | `feedScheduler.js:312-317` |
| Society archetypes | Yes: the saved list, least-used first | `src/services/societyArchetypes.js:73`, `:87`, `:109`; `feedScheduler.js:378-379`, `:627-628` |
| Dream Cities | A constant only, no data read | `feedScheduler.js:21`, `:175-176`, `:333`; `src/utils/feedCities.js:20-27` |
| Season arc | Yes, `show_arcs`, for the first show found in `social_profiles` | `feedScheduler.js:343-353`, `:347` |
| Show Bible rules | Yes | `src/services/brainRules.js:152` |
| Events, storylines, threads, episodes, character records, relationships | **No** | none |

### 2.5 What it creates (MEASURED)
- **One `social_profiles` row** with status `'generated'` (`feedScheduler.js:850`). After it, the service:
  - updates its current state (`:862`);
  - assigns followers (`:869`);
  - links relationships (`:877`);
  - for LalaVerse, adds a home venue (`src/services/feedHomeLocation.js:39`).
- **No `registry_characters` row and no Voice Profile.** A character is made later only by Cross (§3.2).

### 2.6 The other generators (MEASURED, one line each)
- `POST /api/v1/character-generation/generate` (`src/routes/characterGenerationRoutes.js:57`): proposes a character from a spark and writes nothing.
  - `/confirm` (`:114`) creates a `registry_characters` row.
  - `/confirm-feed` (`:192`) creates a feed profile and links it (`:249-254`).
- `src/routes/characterGenerator.js`: `/propose-seeds` (`:631`) and `/generate-batch` (`:740`) propose; `/commit` (`:873`) creates registry and world characters.
  - `GET /ecosystem` (`:545`) reports empty and saturated `role_type`s.
- `src/routes/worldStudio.js`: `/world/generate-ecosystem` (`:912`), and the preview and confirm pair (`:2588`, `:2759`), which writes registries and characters.
- `POST /api/v1/social-profiles/generate` (`src/routes/socialProfileRoutes.js:318`): one profile from a typed handle and vibe.
- `src/routes/socialProfileBulkRoutes.js:617`, `:672`: bulk profile generation.

## 3. Feed profiles and character records (item 2)

### 3.1 The tables (MEASURED)
- **Feed (Pulse) people:** `social_profiles` (`src/models/SocialProfile.js:230`), with an INTEGER `id` (`:29`).
- **Character records:** `registry_characters` (`src/models/RegistryCharacter.js`), with a UUID `id` (`:21`), `registry_id` (`:26`), `character_key` (`:30`), `icon` (`:34`), `display_name` (`:38`) and `role_type` (`:51-53`). It is paranoid, so soft-deleted rows are hidden.
- **Registries:** `character_registries` (`src/models/CharacterRegistry.js:43`), with `show_id` (`:18`) and `title` (`:22`).
- **The link:** `registry_characters.feed_profile_id`, INTEGER (`RegistryCharacter.js:369-372`; migration `src/migrations/20260312100000-character-generation-redesign.js:207`). `SocialProfile.hasOne(RegistryCharacter, { foreignKey: 'feed_profile_id' })` is at `SocialProfile.js:7-13`.
- **A dead column:** `social_profiles.registry_character_id` (INTEGER, `src/migrations/20260308500000-create-social-profiles.js:81`) is no longer declared (`SocialProfile.js:67-68`). Its writers stored UUIDs in an INTEGER column, so no write ever held (`src/utils/registryLink.js:8-12`).

### 3.2 Why every feed person shows "No character yet"
- **The chip:** `frontend/src/pages/CharacterRegistryPage.jsx:288` shows it when `!p.characterId` (MEASURED).
- **Where `characterId` comes from** (MEASURED):
  - It is `p.registry_character_id` (`frontend/src/lib/theCast.js:31`), from `GET /api/v1/social-profiles?feed_layer=lalaverse&limit=100` (page `:99`).
  - The route (`src/routes/socialProfileRoutes.js:1139`, returning at `:1301`) fills `registry_character_id` through `withRegistryLinks` (`src/utils/registryLink.js:52-70`): the newest live `registry_characters` row whose `feed_profile_id` is the profile's id.
- **The read path is right; the links are missing** (MEASURED for the code, INFERRED for the data). Only three actions write `feed_profile_id`:
  1. Confirm-feed, `POST /api/v1/characters/confirm-feed` (`src/routes/characterGenerationRoutes.js:192`, write `:250-254`).
  2. **Cross**, `POST /api/v1/social-profiles/:id/cross` (`socialProfileRoutes.js:1594`; updates `:1631`, creates `:1632-1635`). It makes the character in the named registry, else the show's newest, else the newest. It also exists in bulk (`SocialProfileGenerator.jsx:1272`).
  3. Match to feed person, `PUT /api/v1/cast/characters/:id/feed-profile` (`src/routes/castRoutes.js:148`, write `:164`).
- **Nothing else writes the link:**
  - Auto-Generate and every other feed generator write none (§2.5).
  - Plain character create writes none ("Only by proposal", `src/routes/characterRegistry.js:318-322`).
  - No migration backfilled the dead column's intended links.
  - So a person shows the chip unless one of the three actions ran for them. A character archived later also hides its link, because the model is paranoid.

### 3.3 "1 character across 2 registries" (MEASURED)
- `CharacterRegistryPage.jsx:230`: `` `${characters.length} character(s)` `` then `` ` across ${registries.length} registries` ``.
  - The "across" wording appears only when no registry is chosen and there are several.
  - The Cast page is the `/character-registry` route (`frontend/src/App.jsx:467`).
- `characters` (`:133`) is every live `registry_characters` row from `GET /api/v1/character-registry/registries?limit=50` (page `:88`, flattened `:91`). The route is `src/routes/characterRegistry.js:59`, using `findAndCountAll` with its characters at `:71-78`.
- **What it means:** one live character record in total, across two `character_registries` rows. The view is "All" because `chooseRegistry` (`theCast.js:84-91`) found no registry in the URL and none matching the active show.
- **It does not count feed people** (MEASURED). The page's own lede says so (`:228`): "The people in Lala's world are her feed profiles. Everyone else here is from the old system".

## 4. The "New Character" modal (item 3) (MEASURED)
- **Where:** inline in `CharacterRegistryPage.jsx:391-447`.
  - Registry select `:397-406`; Name `:407-415`.
  - Role `:416-427`, from `ROLE_CONFIG` (`:23-30`) with `protagonist` filtered out (`:419`).
  - Icon picker `:428-439`.
  - The form defaults are `role_type: 'pressure'`, `icon: '👤'` (`:71`).
- **Submit:** `handleCreate` (`:138-154`) posts `{ display_name, role_type, icon, character_key }` (the key from `characterKeyFor`, `:40`) to `POST /api/v1/character-registry/registries/:id/characters`.
- **What it writes:** the route (`src/routes/characterRegistry.js:232-345`) writes one `registry_characters` row (`:255-316`):
  - the registry, key, icon, name and `role_type` (default `'pressure'`, `:262`);
  - `world` `'book-1'`, `status` `'draft'`, `appearance_mode` `'on_page'`, and empty sections.
  - It writes no feed profile and no `feed_profile_id`, so a character made here also has no Pulse presence and never gets a voice (§5.3).

## 5. Lala's "Special" role and the Protagonist filter (item 4)

### 5.1 Where it is stored (MEASURED)
- `registry_characters.role_type`. Lala gets `'special'` from the seed route `POST /registries/:id/seed-book1` (`src/routes/characterRegistry.js:915`, Lala at `:1009-1013`; JustAWoman is `'protagonist'` at `:928`).
- The same values are set by `src/scripts/update-character-profiles.js:135-139` (Lala) and `:64` (JustAWoman).
- No migration sets her role.
- `'protagonist'` is already a valid value everywhere:
  - the model enum, `RegistryCharacter.js:52`;
  - the migration enum, `src/migrations/20260220000004-create-character-registry.js:17`, `:123`;
  - `PUT /characters/:id` validation, `characterRegistry.js:682`;
  - `frontend/src/constants/characterConstants.js:45`.

### 5.2 How the Protagonist filter decides (MEASURED)
- **Count:** `CharacterRegistryPage.jsx:160`, `characters.filter((c) => c.role_type === 'protagonist').length`.
- **Kicker and warning:** the Lala card always shows the "Protagonist" kicker (`:254`). The warning shows when `lala.role_type !== 'protagonist'` (`:258`).
- **Finding Lala:** by `character_key === 'lala'`, else by name (`frontend/src/lib/theCast.js:16-19`).

### 5.3 Data change or UI edit?
Either works, but **changing the data has side effects** (MEASURED). `'special'` is what these backend rules look for:
- `src/routes/onboarding.js:539`: "has a protagonist" means a `'special'` character, accepted.
- `onboarding.js:541`: the cast count is everyone not `'special'`, so Lala would count as cast.
- `src/routes/characterRegistry.js:1168`: promote to canon gives `core_canon` only to `'special'`, so Lala would drop to `minor_canon`.
- `src/routes/relationships.js:198`, `:204`: Lala would move from the `'series-2'` layer to `'real-world'`.

**Recommendation (INFERRED):** fix the **filter**. The Cast page treats the character found by `findLala` (and any `'protagonist'`) as the protagonist at `:160` and `:258`. That is a UI-only change, with no data change and no migration. Changing her row to `'protagonist'` would need those four rules changed in the same PR.

One more consequence of the link (MEASURED): Voice Profiles are queued hourly only for a `registry_characters` row with `depth_level` active or alive **and a `feed_profile_id`** (`src/services/pulseVoices.js:360-366`). A feed person with no character record therefore never gets a voice.

## 6. Create Episode (item 5) (MEASURED)
- **The routes:** `CreateEpisode.jsx` is no longer routed. `/episodes/create` and `/shows/:showId/quick-episode` go through `NewEpisodeRedirect` (`frontend/src/App.jsx:381`, `:396`) to `/shows/:showId/new-episode`.
- **Step A, New Episode** (`frontend/src/pages/NewEpisodeStarter.jsx`, route `App.jsx:397`):
  - The six starting points are in `STARTING_POINTS` (`:35-42`).
  - Each one creates the **event** only, then opens its Event Package (`openPackage`, `:350`).
- **Step B, Event Package** (`frontend/src/pages/EventPackagePage.jsx`, route `App.jsx:398`):
  - The sections run The Event (`:1385`), People (`:1521`, with Featured Attendees `:1598` and `EventGuestRecommendations` `:1643-1651`), Place, Look, Deal & Money, Story Stakes and Documents.
  - Start Episode runs in this order:
    1. `requestStartEpisode` (`:1136`);
    2. `handleStartEpisode` (`:1145`), which loads the episode's locations;
    3. the `EpisodeLocationsStep` modal (`:2141-2153`);
    4. `confirmStartEpisode` (`:1160`), which posts `generate-episode` (`:1164`; route `src/routes/worldEvents.js:2461`, which calls `generateEpisodeFromEvent` at `:2492`).
- **Where to ask "Who's new in Lala's life this episode?"** (INFERRED):
  - **As a step after the locations step, before `generate-episode`.** `confirmStartEpisode` (`:1160`) holds the chosen locations, shows the new step (shaped like the locations modal, `:2141`), then posts.
  - Available there: `showId`, `eventId`, the whole event (host, `host_brand`, `source_profile_id`, venue, `canon_consequences.automation.guest_profiles`, `narrative_stakes`, prestige), the guest list and featured guests (`:603-604`), and the loaded profiles (`:452`, `:488`).
  - **The alternative** is a panel in People next to `EventGuestRecommendations` (`:1643`). The step is better because it is asked once, at the moment the episode is made.

## 7. What a "who the story needs" generator can read (MEASURED)
| Gap | Source | Reader |
|---|---|---|
| Society archetypes not filled | the saved list plus counts on `social_profiles.society_archetype` | `src/services/societyArchetypes.js:73`, `:87`; `pickSocietyArchetypes` `:109` already picks the least used |
| Cities with no one | `DREAM_CITIES` (a constant, `src/utils/lalaHome.js:44`) against `social_profiles.city` counts | `socialProfileRoutes.js:2538-2543` (the composition route, `:2466`) |
| Unpaid promises | `show_story_threads` (open or closed) | `src/services/storyThreadService.js:51` |
| Storylines needing a face | `pulse_storylines` with no `pulse_storyline_beats` (each beat needs a `poster_profile_id`) | `src/routes/pulseStorylines.js:60`; poster rules `src/services/pulseStorylines.js:51-61` |
| The next event's needs | `world_events` (host, `host_brand`, `source_profile_id`, prestige, guests); no explicit "guest needs" field | `src/utils/eventAttendees.js:33`; `src/services/feedSidebar.js:41` |
| Revealed in this episode | `pulse_reveals` (`item_type` character, `episode_id`) | `src/routes/pulseReveals.js:176` (PUT) |
| Friends to feature | closeness ledger and `social_profile_relationships` | `src/services/pulseCloseness.js:70`, `:89`; `src/services/pulseKnowledge.js:65` |

## 8. Plan: PR-sized issues (not opened)
**None of these needs a migration** (INFERRED from §3–§7: every column and table they write already exists).

**a. Lala is the Protagonist** (frontend; no migration).
- The Cast page counts and labels the character `findLala` finds as the protagonist, as well as any `'protagonist'` row (`CharacterRegistryPage.jsx:160`, `:258`).
- Her `role_type` stays `'special'`, because four backend rules read it (§5.3).
- Tests: the count and no warning for a `'special'` Lala.

**b. "Add character" opens "Generate who the story needs"** (backend and frontend; no migration). Possibly two PRs: the service, then the UI.
- **A new `POST /api/v1/cast/generate-needed`**, with `requireAuth` and `aiRateLimiter`, under the cost tracker's daily cap. One click with no typing.
- **It reads the gaps in §7:** unfilled Society archetypes, empty Dream Cities, open threads, storylines with no poster, the next event's host and guests.
- **It returns a draft and its reason** ("No one in Maverick Harbor; the Storyline 'X' has no face"). Nothing is saved until approval.
- **The page offers Approve, Regenerate or Tweak** (edit the draft's fields).
- **Approve creates three things together:**
  - the Pulse profile (the `generateAndSaveProfile` path);
  - the character record, linked by `feed_profile_id` (the Cross path, §3.2);
  - its `depth_level` at Active, so the hourly voice queue builds the Voice Profile (`pulseVoices.js:360`). That voice still waits for Evoni's approval (The Pulse spec §7).
- **The manual "New character" form stays, as a secondary option.**

**c. "Create character" on each feed person card with "No character yet"** (frontend; no migration).
- The card's chip becomes a button that calls the existing Cross, `POST /api/v1/social-profiles/:id/cross` with the show id (`socialProfileRoutes.js:1594`). It already creates the character in the show's registry and writes the link.
- Tests: the button shows only without a link, and the chip clears after a successful call.

**d. Create Episode asks "Who's new in Lala's life this episode?"** (frontend, and a small backend change; no migration). This is a step in Start Episode between the locations step and `generate-episode` (`EventPackagePage.jsx:1160`), with three answers:
- **Introduce a new friend:** generator b, seeded by this event. On approval it is added to the event's guests and revealed in this episode (`pulse_reveals`, `item_type` character, `episode_id` once the episode exists, so after `generate-episode` returns).
- **Feature existing friends:** suggested from Pulse evidence (closeness and relationships with Lala, §7), and added as featured guests within `MAX_FEATURED_GUESTS` (`EventPackagePage.jsx:116`).
- **No one new.**

Depends on b.

**e. Retire the old modal and the five roles from the UI** (frontend; no migration, no column dropped).
- Remove the inline New Character modal (`CharacterRegistryPage.jsx:391-447`) once b is in.
- Stop showing Pressure, Mirror, Support, Shadow and Special as choices.
- `role_type` stays in the data, because the backend reads it (§5.3), and so do the display-only readers (the Relationship Engine, Write Mode and character profiles). The pickers go; any display is relabelled or left.
- Depends on b. One check first: which of the display readers Evoni still uses.

**Order:** a and c (small, independent), then b, then d and e.

**Side finding, separate from the plan:** `POST /feed-scheduler/fill-one` has no `aiRateLimiter` (§2.2).
