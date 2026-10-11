# Read: The Pulse story clock and reveals (phase 4)

- **Basis:** `origin/main` at `27cb3c28f546dfea9f6496bc01a1069af0b17ad4`. Every `path:line` below is at this SHA.
- **Date:** 2026-10-11
- **Task:** #2936. This is part 1 of 6 of The Pulse spec phase 4 (`docs/design/2026-10-the-pulse.md` §4, §5, §12 step 4). The parts are #2936, #2937, #2938, #2939, #2940 and #2941.
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact.
  - Reads only, under `src/` and `frontend/src/`.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means a conclusion drawn from measured code, with the reason given.
- Nothing here was read from a database, so row counts are not measured.

**Evoni's rulings for phase 4 (2026-10-11, this session):**
1. Reveals live in **one new table**, not as columns on each item's table.
2. A teaser is **blurred** and labelled "first look".
3. A character counts as **met** from a derived episode that Evoni can override.
4. The scrubber is a new **Admin › The Pulse › Story clock** sub-tab.

Her idea of revealing items in-episode with the game-style cursor in the Overlays tab is recorded as a later follow-up (#2938). It is not part of phase 4.

---

## §1 The story clock today

**What exists.** `src/services/storyClock.js` is the clock. **MEASURED.**
- A point in story time is `episode_number * 10 + phase` (`:3-19`, `orderOf` `:26-31`).
- Phases are before_episode 1, during_episode 5, after_episode 7, next_day 8 and week_later 9 (`:24`).
- `postOrder` (`:37-41`): a post's order is its stamped `story_order`, else its episode's number plus its `timeline_position`, else null (unknown).
- `presentOrder` (`:53-62`): the present is after the show's highest published episode, or 7 when none is published.
- `checkAtBeat` (`:68-73`): a post may sit at a beat when its order is no later than `episode_number * 10 + 5`. An unknown order passes as `check: 'unknown'`.

**Where it runs.** Only two code paths call it. **MEASURED.**
1. **`POST /api/v1/feed-posts`** stamps a wall post (no episode) with `story_order = presentOrder(...)` (`src/routes/feedPostRoutes.js:148-149`).
2. **`storyCheck`** in `src/services/feedMomentLink.js:30-41` refuses, with 409, to link a post to a beat that comes before it in story time (`:62-63`, `:89-90`). It is reached from:
   - `PUT /api/v1/feed-enhanced/:showId/moments/:momentId/post` (`src/routes/feedEnhancedRoutes.js:133-134`)
   - `POST /api/v1/feed-enhanced/:showId/moments/:episodeId/beat` (`:149-150`)

**Mentions only.**
- `src/services/scriptPostDrafts.js:12`.
- `src/routes/pulseFits.js:88-96`: `/latest` restates the published-episode rule in raw SQL (`:110`). Its comment calls the `createdAt` comparison "Interim rule until phase 4's story clock".

**Frontend mirror.** `frontend/src/lib/storyClock.js` exports `PHASES` (`:7`), `postOrder` (`:11`) and `storyLabel` (`:19`). It has no present, no filter and no beat check. It is used only for the label on Review cards (`frontend/src/components/Admin/PulseReviewPost.jsx:19`). **MEASURED.**

**No read filters by story time.** **MEASURED:**

| Read | Location | Ordering |
|---|---|---|
| `GET /api/v1/feed-posts` (filters: show, episode, status, source, profile, narrative function, post type) | `src/routes/feedPostRoutes.js:56` | `posted_at DESC, sort_order ASC` (`:87`) |
| `GET /:showId/timeline` | `:240` | same ordering (`:255`) |
| `GET /episode/:episodeId` | `:424` | — |

The phone zones in `frontend/src/components/ScreenContentRenderer.jsx` fetch these reads with no story moment (`:234`, `:541-542`, `:571-572`, `:1131-1132`). `src/services/phoneRuntime.js` does not reference the story clock (no `storyClock` or `checkAtBeat` in the file).

**INFERRED.** The Pulse today shows every live post whatever its story time. A post stamped after a later episode, or a generated post of an unpublished episode set live by hand, shows in Lala's view. #2937 adds the `at=` read.

## §2 Event moments

**world_events** (**MEASURED**)
- `status` is a free `STRING(20)`, default 'draft', documented `draft | ready | used | archived` (`src/models/WorldEvent.js:338-343`).
- 'used' is set together with `used_in_episode_id` and `times_used + 1` (`src/services/episodeGeneratorService.js:400`).
- A fifth value, 'declined', is written in raw SQL (`src/services/financialPressureService.js:120`).
- `event_date` and `event_time` are free text (`WorldEvent.js:132-141`). `guest_list` is hedged as possibly missing (`:142`). The invitation is an asset (`invitation_asset_id`, `:145`).

**episode_briefs.** An episode's brief can name its event (`event_id`, `src/models/EpisodeBrief.js:24`) and its beats (`beat_outline`, `:54`). **MEASURED.**

**Nothing records the spec's moments** (Announced, Invitation sent, Lala arrives, During, After the episode). No field stores when an invitation was sent or when Lala arrived. **MEASURED** by the model reads above.

**INFERRED.** The moments can only be points on the existing clock relative to the event's episode, which is `used_in_episode_id` or the brief's `event_id`. They cannot be recorded timestamps.

## §3 Reveal fields

**None exist.** **MEASURED.** The closest fields:

| Table | Field | What it is |
|---|---|---|
| `feed_posts` | `status` draft or live (`src/models/FeedPost.js:77`) | Not a reveal. |
| `feed_posts` | `timeline_position` (`:38-41`) | The phase of the post's own episode, not a reveal. |
| `feed_posts` | `story_order` (`:84`) | The post's story time, not a reveal. |
| `feed_posts` | `event_id` (`:14`) | A post can name its event. |
| `pulse_fits` | `story_date` (`src/models/PulseFit.js:18`) | A calendar date, not a story order. |
| `episode_lookbook_images` | `in_lookbook` (`src/models/EpisodeLookbookImage.js:23`) | Whether the image is in the lookbook only. |
| `registry_characters` | `first_appearance` (`src/models/RegistryCharacter.js:128`) | Free text, not an episode. |

**`registry_characters` is F-Reg-2 territory.** F-Reg-2 is current in the locked sequence (`PROJECT_CONTEXT.md:328`, `:336`), and the fix cycle forbids feature additions and schema redesigns there (`:336`). **INFERRED.** This is why reveals, including a character's "met Lala" episode, live in their own table (ruling 1).

## §4 Where "met Lala" can be derived

There is no cast or character-episode join table. **MEASURED** by a search of `src/models/`. The derivable sources, best first:
1. **The episode's event guests.** `world_events.canon_consequences.automation.guest_profiles` holds `{ profile_id, ... }` entries. They are read by the sidebar (`src/services/feedSidebar.js:55`) and the script writer (`src/services/episodeScriptWriterService.js:264`). The event reaches its episode through `used_in_episode_id` or `episode_briefs.event_id` (the same join as `feedSidebar.js:33-45`). **MEASURED.**
2. **`world_events.guest_list`**, read raw at `src/services/feedPostGeneratorService.js:94-97`. It is hedged as possibly missing (`WorldEvent.js:142`). **MEASURED.**
3. **The profile's earliest episode post:** `feed_posts.social_profile_id` with `episode_id`, joined to the episode number. **INFERRED** from the columns.
4. **`feed_moments.trigger_profile_id`** with its episode (`src/models/FeedMoment.js:20`). **MEASURED.**

The link to a Character Registry character is `registry_characters.feed_profile_id` (`RegistryCharacter.js:369`). It is read through `src/utils/registryLink.js`, per the feed wiring read's §2c. **MEASURED.** A reveal row keyed by the profile id needs no registry write.

## §5 The moment orders

The proposal, on the existing `episode_number * 10 + phase` clock:

| Moment | Order in the event's episode n | Status |
|---|---|---|
| Before the episode | n·10 + 1 | existing `before_episode` |
| Announced | n·10 + 2 | new |
| Invitation sent | n·10 + 3 | new |
| Lala arrives | n·10 + 4 | new |
| During | n·10 + 5 | existing `during_episode` |
| After the episode | n·10 + 7 | existing `after_episode` |
| The day after | n·10 + 8 | existing `next_day` |
| A week after | n·10 + 9 | existing `week_later` |

**No collision.** Digits 2, 3 and 4 are unused in `PHASES` (`storyClock.js:24`), and 6 stays free. **MEASURED.**

Stored `story_order` values only use digits 1, 5, 7, 8 and 9. A stamped wall post is `presentOrder`, which is n·10 + 7 (`:61`). **INFERRED:** adding the three phases changes no existing order.

`checkAtBeat` compares against n·10 + 5. A post revealed at Lala arrives (n·10 + 4) can therefore sit at a beat of episode n, and one revealed After (n·10 + 7) cannot. **INFERRED** from `:68-73`. This matches the spec's "a beat happens during its episode".

## §6 What the build issues take from this

- **#2937:**
  - The new phases and `parseAt`.
  - An optional `at=` on `GET /feed-posts`, `/pulse-fits/latest` and the sidebar. Without it, reads are unchanged (§1).
  - The latest fit by story clock, replacing the interim rule (`pulseFits.js:88-96`).
- **#2938:** the `pulse_reveals` table. Item type and id; an event or episode; a moment from §5 or a set story order; hidden or teaser; set or derived. "Met Lala" is derived from §4's sources in that order.
- **#2939:** reveals applied server-side, so hidden content never reaches the browser. Teasers are blurred (ruling 2).
- **#2940:** the picker on Review, Uploads, events and characters.
- **#2941:** the Story clock sub-tab. `AdminPulse.jsx` `PULSE_TABS` has review, uploads, growth, storylines and calendar today (`frontend/src/pages/AdminPulse.jsx:28-34`).
