# Read: The Pulse world depth (phase 7)

- **Basis:** `origin/main` at `c14de496831adcb24c9f27df64d741d442e2a6f6`. Every `path:line` below is at this SHA.
- **Date:** 2026-10-12
- **Task:** #2981, part 1 of 9 of The Pulse spec phase 7 (`docs/design/2026-10-the-pulse.md` §3, §4, §6, §9, §12 step 7 "World depth"). The parts are #2981 to #2989.
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact.
  - Reads only, under `src/` and `frontend/src/`.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means a conclusion drawn from measured code, with the reason given.
- Nothing here was read from a database, so row counts (how many relationships, events or guests exist) are not measured.

**Evoni's phase 7 rulings (2026-10-12, this session):**
1. **"Told" is automatic.** Anyone with a close relationship to someone who was there knows it from the next story moment. Otherwise a character knows something only if they were there or it is live on The Pulse.
2. **DMs:** both sides are drafted in voice, Lala's included, and every message waits in Review, approved like posts.
3. **Relationship consequences are handled like numbers.** Small changes between other characters auto-accept. Anything involving Lala, or a large change, waits in Review.
4. **Scope:** all seven features, in order: who knows what → relationship consequences → DMs → Phone sync → city feeds → Calendar → Storylines.

---

## §1 Who knows what (for #2982)

**Who was there.** An event's guests are `world_events.canon_consequences.automation.guest_profiles`. It is written by `eventAutomationService.js:733` and `feedEventPipelineService.js:567`, and read by at least six services (for example `characterSyncService.js:141`, `feedActivityService.js:93`). **MEASURED.** Phase 6 already reads it for posting: `pulseEventPosting.js:82` turns it into a set of Feed profile ids, and Lala counts as attending (`:101`). **MEASURED.**

**INFERRED: "there" = the event's `guest_profiles`, plus Lala.** No other attendance record exists for world events.
- The novel's `calendar_event_attendees` (§6) is a separate world, so it is not a source.
- An event with no `automation.guest_profiles` has only Lala as a witness. #2982 must treat an empty list that way, not as "everyone was there".

**Close ties.** Phase 6 measures closeness to Lala from `social_profile_relationships` (`pulseEventPosting.js:86-92`), through a fixed map by type, `CLOSENESS` (`:36-39`). The map runs from 1 for bestie and couple down to 0.3 for secret_link, with 0.3 for a type it does not know. **MEASURED.**

**INFERRED: "close" = a `CLOSENESS` value of 0.7 or more**, which covers bestie, couple, family, situationship, feud, collab, rival, baby_daddy and baby_mama.
- feud and rival count because they watch each other; mentor, ex and shade (0.6) do not.
- #2982 should make the line one named constant, so Evoni can move it.
- From #2983 onward, closeness comes from the ledger where a pair has one, falling back to the type map.

**Told, at the next story moment.** Story orders are `episode_number*10 + phase` (`storyClock.js:28-30`, `:38-43`). **MEASURED.** "The next story moment" after an event during episode N (`orderOf(N,'during_episode')` = N·10+5) is therefore its After, N·10+7. **INFERRED.** A close tie of a guest knows the event at any order of N·10+7 or later.

**Posted publicly.** A live post (`feed_posts.status = 'live'`) at or before the moment names the event. Its `event_id` is set, or it mentions the event's name. `GET /feed-posts?at=` already resolves "at or before" (`feedPostRoutes.js:117`), and the gate already names events by text with `mentions()` (`pulseGate.js:55-60`). **MEASURED.**

**What is already in the registry.** `character_relationships` holds novel-side "knows" text: `source_knows`, `target_knows`, `reader_knows`, plus the boolean `knows_about_connection` (`src/models/CharacterRelationship.js:43-50`). These describe what one registry character knows about another, not about events. **MEASURED.** **INFERRED:** they are not a source for #2982, though they could later feed the drafter as private context.

**Where it joins.**
- **The gate:**
  - `pulseGate.canonFlags` (`pulseGate.js:63`) reads the show's events (`:83-85`);
  - it already flags `unrevealed_event` and `future_event` (`:90-91`). **MEASURED.**

  A `doesnt_know` flag fits beside them. A flagged draft already goes to Review (`reviewReasons`, `:153`).
- **Comments:** they are gated "as a post at its post's story order" (`pulseDrafter.js:206-215`). **MEASURED.** So `doesnt_know` covers comments with no extra code.
- **The drafter's prompt:** it says what happened (`pulseDrafter.js:69`) but not what the poster knows (`:58-82`). **MEASURED.** #2982 adds that, so fewer drafts are flagged in the first place.

**The gate's event read.** It reads `used_in_episode_id` directly (`pulseGate.js:84`), which is a list read with no episode named. `tests/unit/services/episodeEventOneRule.readers.test.js` enforces one rule for reading *the* event of an episode (`utils/episodeEventSql`). **MEASURED.** **INFERRED:** #2982's knowledge reads list events the same way. Only a read of "this episode's event" must use `EPISODE_EVENT_ID_SQL`, as `pulseEventPosting.js:77-81` does.

## §2 Relationship consequences (for #2983)

**There are four relationship tables, and none holds a closeness number.** **MEASURED.**

| Table | Between | Kind | Numeric | Notes |
|---|---|---|---|---|
| `social_profile_relationships` (`SocialProfileRelationship.js:57`) | two Feed profiles (`source_profile_id`, `target_profile_id`) | `relationship_type`, an ENUM of 15 values from collab to secret_link (`:24-44`); `direction` | `drama_level` INTEGER 0–10 (`:48`) | `public_visibility` public/rumored/hidden (`:49`); `timeline_notes` free text (`:51`) |
| `feed_profile_relationships` (`FeedProfileRelationship.js:56`) | two Feed profiles (`influencer_a_id`, `influencer_b_id`, both to `SocialProfile`, `:6-12`) | `relationship_type`, a **different** ENUM of 9 values: collab, beef, copy_cat … orbit (`:34-40`) | none | `is_public` (`:41`); a `StoryClockMarker` link (`:14-16`) |
| `character_relationships` (`CharacterRelationship.js:56`) | two registry characters | `relationship_type` STRING (`:21`) | none; `tension_state` STRING(80) (`:27`) | the novel's |
| `relationship_events` (`RelationshipEvent.js:58`) | a `character_relationships` row (`relationship_id`, `:11`) | — | `tension_before` / `tension_after` (`:40`, `:44`) | the only ledger; read and written only by `tierFeatures.js:204-245` |

**Which one is "the Relationship Map".**
- **The map page** (`FeedRelationshipMap.jsx`) reads and writes **`feed_profile_relationships`**, through `/api/v1/feed-relationships`:
  - reads: canvas `:138`, profiles `:179`;
  - writes: create `:192`, auto-generate `:210`, ripples `:252`;
  - the routes are `feedRelationshipRoutes.js:64-300`, under `router.use(requireAuth)` (`:22`), mounted at `app.js:1499`.
- **The Pulse** (phase 6) reads **`social_profile_relationships`**:
  - `pulseEventPosting.js:86-88`;
  - `feedCommentDrafter.js:10`, for who reacts.

**MEASURED.**

**INFERRED: the spec's "Relationship Map closeness" has two candidate tables, with different type lists.** #2983 should therefore not add a column to either one.
- A **ledger of its own, keyed on the pair of Feed profiles**, works whichever table describes the pair.
- It starts each pair from its type's `CLOSENESS` value, falling back to `social_profile_relationships`, the table The Pulse already reads, then to 0 (no relationship).
- The map page can show the ledger's closeness later without a schema change to its table.
- This also matches spec rule 3 ("one owner"): the ledger owns closeness, and the type tables keep owning the kind of relationship.

**Signals available today.**
- **Comments:** `feed_comments.social_profile_id` names the commenter (`FeedComment.js:15`), under a post whose poster is `feed_posts.social_profile_id`. **MEASURED.**
- **Mentions:** a post's text naming another profile, the same `mentions()` test as §1. **INFERRED.**
- **Ignored:** a close tie's live post with no comment from the other profile within a few story moments. This is derived from the same two tables with no new data. **INFERRED.**

**The line for "large".** The numbers precedent auto-accepts the everyday case and flags spikes over 3× the poster's median (`pulseNumbers`, phase 5). **MEASURED** in #2953. **INFERRED** for #2983:
- a nudge of ±0.02 to ±0.05 per signal;
- auto-accept for non-Lala pairs while the step is ≤ 0.05 and the pair's closeness moves less than 0.15 in one story moment;
- anything with Lala, and anything over the line, waits.

These are #2983's named constants, not rulings.

## §3 DMs (for #2984, #2985)

**No DM storage exists.** No model, table or route holds messages between Feed profiles or characters. **MEASURED** (searched `src/models`, `src/routes` for dm, direct_message, conversation, thread). The only traces:
- `feed_moments.phone_screen_type` lists `dm` among the kinds of phone moment (`FeedMoment.js:24-27`);
- `ScenePlan`'s `phone_screen` comment (`ScenePlan.js:40`).

Both describe what a Phone screen shows at a beat, not stored messages. **MEASURED.**

**The Pulse's Messages is a disabled entry.** `SocialMediaPage` lists it in `NAV` (`:128`). Only keys in `TABS` (`:50`) are live; every other entry renders as a disabled span, "Coming to The Pulse" (`:144`). **MEASURED.**

**The Phone's DMs is a designer screen.** In the Phone Hub tests, `dms` is a screen (`PhoneHub.cards.pinned.test.jsx:37`) that a zone's `screen_links` target with `'dms'` (`PhonePreviewMode.device.test.jsx:30`). It is an image the designer made, not data. **MEASURED.**

**The queue and gate DMs ride on.**
- `pulseQueue.KINDS` is `['event','ambient','comment']`, and an unknown kind throws (`pulseQueue.js:29`, `:44`). **MEASURED.** #2984 adds `dm`, so DMs count toward the same daily cap.
- The gate takes any object shaped like a post. Comments already pass through it that way (`pulseDrafter.js:210-215`). **MEASURED.** A DM message can be gated the same way, at its own `story_order`.

**INFERRED: two tables** (threads, messages), with no copy of the poster's handle or name: both are read from `social_profiles` at render time (spec rule 3). Every message is a draft until Evoni approves it (ruling 2), so no message reaches The Pulse or the Phone unseen.

## §4 Phone sync (for #2986)

**The Phone does not read The Pulse today.**
- **Its screens** are designer-made images with zones (`PhoneHub`, `UIOverlaysTab`).
- **`phoneRuntime.filterContentItems`** filters items by their `conditions` (`phoneRuntime.js:140-147`). The items are "feed posts, messages, wardrobe pieces" (`:141`), but nothing feeds it from `feed_posts`.
- **`buildPhoneContext`** (`phoneContextBuilder.js:18`) pulls an episode's recent beats only as AI prompt context (`:118-120`).

**MEASURED.**

**One link exists: a beat points at a post.**
- `feed_moments` rows are per episode beat (`FeedMoment.js:13-16`, `beat_number`). Each has an optional `feed_post_id` (`:57`), the post that beat's phone moment shows.
- `feedMomentLink.js` draws "that post live, so the beat and the feed can never disagree" (`:3-7`), and checks the story clock: "a post can be shown at a beat only when it exists by then in story time". It does this with `checkAtBeat(postOrder(post, …), episode_number)` (`:25-41`).

**MEASURED.**

**The clock already has a beat's story time.**
- `storyClock.beatOrder(episodeNumber)` is `orderOf(n,'during_episode')` (`storyClock.js:44`).
- `checkAtBeat` (`:78-82`) uses it.
- Exports are at `:132`.

**MEASURED.**

**INFERRED: #2986 adds no new clock.** A Phone Pulse screen in an episode takes `at = beatOrder(episode_number)` and reads the same `GET /feed-posts?at=` that The Pulse and the scrubber read (`feedPostRoutes.js:79`, `:117`), plus `GET /pulse-dms?at=` from #2984. So the posts, numbers (`pulseNumbers.applyNumbers`, phase 5) and reveals are identical to The Pulse at that moment.

All beats of an episode share one order (During), so the Phone's Pulse is the same for every beat of an episode. **INFERRED** from `beatOrder` taking no beat number. If Evoni later wants beat-level time, it is a change to `storyClock`, not to the Phone.

## §5 City feeds (for #2987)

**There is no Dream Cities table.** **MEASURED.**
- **A profile's city** is `social_profiles.city`, an ENUM that keeps 5 legacy values next to the five Dream City keys: dazzle_district, radiance_row, echo_park, ascent_tower, maverick_harbor (`SocialProfile.js:135-140`).
- **The city keys and culture** are constants: `DREAM_CITY_KEYS` and `DREAM_CITY_CULTURE` (`src/utils/feedCities.js:20-22`), and the display names `DREAM_CITIES` (`src/utils/lalaHome.js:44`).
- **The city's look** (names, palettes, images) is page-content: `frontend/src/lib/pulseCities.js` `loadCities()` reads `/api/v1/page-content/<PAGE>` (`:54-55`), with palettes in `SPEC_PALETTES` (`:21`).

**A post has no city of its own.** `feed_posts` has no city column, and `GET /feed-posts` includes the poster's profile `city` (`feedPostRoutes.js:151`). **MEASURED.** **INFERRED:** a post's city is its poster's city, with no copy column (spec rule 3). A city feed is a join on `social_profiles.city`. Legacy city values belong to no Dream City feed.

**Nothing filters by city today.**
- The Pulse's "Dream Cities" nav entry is disabled (`SocialMediaPage.jsx:124`, `:144`).
- `CityStrip` and `CitiesCard` display cities only.

**MEASURED.**

**Trends do not honour the story clock.**
- **The trending card** reads `GET /api/v1/feed-enhanced/:showId/trending` (`SocialMediaPage.jsx:465`, `feedEnhancedRoutes.js:18`), which calls `feedEngagementService.getTrendingTopics` (`:368`).
- **That count** takes the last 200 live posts of the show (`:372-375`), keyed on `trending_topic` (`:381-384`).
- **It has no `at` and no city.**

**MEASURED.** **INFERRED:** #2987's local trends should be counted the same way but at the page's `at`, and the show-wide card should take the same `at`. Without it, a trend from a later episode shows in an earlier moment, against spec rule 2. This is a small fix #2987 carries.

## §6 Calendar (for #2988)

**A story calendar exists, for the novel's world.**
- `story_calendar_events` (`StoryCalendarEvent.js:134`) has `start_datetime` (`:50`) and `lalaverse_district` (`:78`).
- `story_clock_markers` (`StoryClockMarker.js:46`) has `calendar_date` (`:26`) and `is_present` (`:35`).
- Routes are in `calendarRoutes.js`, which has `dreamCityFromEvent` (`:61`); the page is `StoryCalendar.jsx`.

**MEASURED.** It is dated in calendar time, while The Pulse is ordered by `story_order`. **INFERRED:** #2988 neither reads nor writes it.

**World events' dates are free text.** `world_events.event_date` is STRING(50), "Friday, March 15th" or "Tonight at 9pm" (`WorldEvent.js:132-135`), and `event_time` likewise (`:137-140`). The story clock notes this (`storyClock.js:6`). **MEASURED.** **INFERRED:** the Pulse Calendar is keyed on `story_order`. An event sits at its episode's orders (Announced to After), and its free-text date is shown as written, never parsed.

**What it collects, all already keyed on story order:**
- posts: `feed_posts.story_order` and `storyClock.postOrder`;
- reveals: `pulseReveals.revealsAt` (`pulseReveals.js:176`);
- events, through their episode;
- DMs (#2984) and closeness changes (#2983), once they exist.

`storyClock.label(order)` (`:54`) names each row. **MEASURED.**

**The tab is waiting.** `AdminPulse.jsx` `PULSE_TABS` (`:39`) has `calendar` with `comingIn` "Phase 7 brings Calendar…" (`:47`), shown as a placeholder (`:227`). **MEASURED.**

## §7 Storylines (for #2989)

**Thread and arc tables exist, none for The Pulse.** **MEASURED.**
- **`show_story_threads`** (migration `20261001250000-create-show-story-threads.js`):
  - `status` open/advanced/closed and `source` evoni/seed (`:19-20`, `:51-52`);
  - `opened_episode_id` (`:54`).
  - Its service, `storyThreadService.js`, covers list, seed, create, update, close, reopen and choosable (`:51-164`), and `advanceSlotThreads` per episode (`:177`). These are the show's threads, advanced by episodes.
- **`show_arcs`** (`20260723000003-create-show-arcs.js`, `ShowArc.js`): season phases.
- **`story_threads`** (`StoryThread.js`): the novel's, keyed by book and chapter.
- **`character_arcs`** and **`story_task_arcs`**.

**The tab is waiting.** `PULSE_TABS` has `storylines` with its `comingIn` note (`AdminPulse.jsx:46`). **MEASURED.**

**INFERRED: a Pulse storyline is a plan of posts across story moments, not a new kind of show thread.** So #2989:
- links to a `show_story_threads` row when it follows one (nullable), never copying its title or status;
- keeps its own beats (plant, build, payoff), each with a story moment and a poster;
- drafts each beat through the phase 6 queue and gate when its moment becomes the present. Reveals and payoffs always go to Review (spec §7, "anything that reveals story").

## §8 What each later issue takes

| Issue | Takes from this read | New schema |
|---|---|---|
| #2982 who knows what | §1: `guest_profiles` + Lala; close = `CLOSENESS` ≥ 0.7 (named constant); told from the next moment (After, N·10+7); public = live post at or before `at` with `event_id` or a name mention; a `doesnt_know` gate flag; the drafter is told what the poster knows | none |
| #2983 closeness | §2: a ledger keyed on the Feed-profile pair, starting from the type map; signals from comments, mentions, ignored posts; numbers-style auto-accept line; `pulseEventPosting` reads it | `pulse_closeness` (ledger) |
| #2984 DMs (backend) | §3: two tables; a `dm` queue kind under the cap; gated like a comment; every message a draft until approved; `?at=` | `pulse_dm_threads`, `pulse_dm_messages` |
| #2985 Messages UI | §3: the disabled Messages nav entry becomes a tab; a Review section | none |
| #2986 Phone sync | §4: `beatOrder` → the same `?at=` reads; one clock; `feed_moments.feed_post_id` stays as is | none |
| #2987 city feeds | §5: city = the poster's `social_profiles.city` (join, no copy); `?city=`; local and show-wide trends at `at` | none |
| #2988 Calendar | §6: keyed on `story_order`; free-text dates shown as written; separate from `story_calendar_events` | none |
| #2989 Storylines | §7: storylines + beats; optional link to `show_story_threads`; beats drafted through the queue and gate at their moment | `pulse_storylines`, `pulse_storyline_beats` |

**Gaps this read leaves open, for Evoni:**
1. **Two relationship tables with different type lists.** The map edits `feed_profile_relationships`; The Pulse reads `social_profile_relationships`. #2983's ledger works with either, but which one is canon for "the kind of relationship" is her call.
2. **Event guests are optional.** An event with no `guest_profiles` has only Lala as a witness (§1).
3. **The Phone's Pulse is per episode, not per beat** (§4), until the story clock gains beat-level time.
