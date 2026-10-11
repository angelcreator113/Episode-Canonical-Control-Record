# Read: wiring of the LalaVerse social page (the Feed page)

- **Basis:** `origin/main` at `f16f90f4c845c2a7aa92d25f9f552267bdbd7990`. Every `path:line` below is at this SHA.
- **Date:** 2026-10-11
- **Task:** #2746. It is the first of the Feed series: #2746, #2747, #2748, #2749, #2750 and #2761.
- **Waiver:** Evoni waived the series in this session ("start the feed series", 2026-10-11). That is decision D2 of `docs/reads/2026-10-10-open-task-triage.md` §5.
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact.
  - Reads only, under `src/` and `frontend/src/`.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means a conclusion drawn from measured code, with the reason given.
- Nothing here was read from a database. Row counts, such as how many Feed profiles exist, are therefore not measured.

**Real data only** (Evoni, 2026-10-10). Every "should read from" below names a real source. Where none exists, it says so.

The page is `frontend/src/pages/SocialMediaPage.jsx`, mounted at `/feed` (`frontend/src/App.jsx:514`). Its posts tab is the `Wall` component (`SocialMediaPage.jsx:294`). Everything on it loads in two calls:
- **`loadPosts`** (`:313-327`) loads the wall itself.
- **`loadSides`** (`:329-351`) makes five calls in parallel: the owner, the friends, the events, the draft count and the pending comments.

---

## §1 Each element: what it shows, where it comes from today, what it should read

### Profile (left column)

| Element | Today | Should read from |
|---|---|---|
| **Whose profile** | The first of five `lalaverse` profiles whose handle or name matches "lala" (`:333`, `:342`), found by a text search. If none matches, `candidates[0]`. Falls back to the name "Lala" and handle `lala` (`:356-357`). **MEASURED** | Lala's own Feed profile through her registry link. `registry_characters.feed_profile_id` is the one link (`src/utils/registryLink.js:1-20`), read with `linkedCharacter` (`:62`). **INFERRED**: the text search can pick another profile whose name starts with "Lala". |
| **Current City** "[City]" | The profile's `city` enum through `CITY_NAMES` (`:41`), else its `geographic_base`, else the literal `[City]` (`:394`). **MEASURED** | The show's `lala_home.city`: `shows.metadata.lala_home`, served by `GET /api/v1/shows/:id/lala-home` (`src/routes/shows.js:475-481`, `readLalaHome` in `src/utils/lalaHome.js:60`). Show Settings writes it (`PUT`, `shows.js:469`). `loadSides` never calls it. **MEASURED** |
| **Relationship Status** "[Status]" | Her newest live relationship-status post on the loaded page (`latestStatus`, `frontend/src/lib/feedRelationship.js:49-57`). Else the profile's `relationship_status` (`src/models/SocialProfile.js:77`). Else the literal `[Status]` (`:395`). **MEASURED** | The relationship-status post stays the record, as `docs/FEED_POSTS.md` rule 8 makes a relationship change a post. But `latestStatus` reads only the posts already loaded: the first page (`PAGE = 50`, `:40`), of the tab shown. **INFERRED**: an older status post, or the Drafts tab, gives the fallback instead. It should read her newest relationship post by query: `GET /feed-posts?show_id&post_type=relationship&status=live&limit=…`, which the route supports (`src/routes/feedPostRoutes.js:41-44`). |
| **Works at** "Styling, everywhere" | The profile's `content_category` with underscores turned to spaces, else the literal `Styling, everywhere` (`:396`). **MEASURED** | Lala's career tier, which is what the show tracks as her standing. `careerTierFromReputation` (`src/utils/careerTiers.js:33`) over her reputation, with its label from `CAREER_TIERS` (`:16-22`). **INFERRED**: no "employer" field exists for Lala, so the tier is the honest value. Otherwise, show nothing. |
| **Profile picture** (the "L" block) | `Tile` with her name's initial (`:390`). No image is read. **MEASURED** | Her registry character's `portrait_url` (`src/models/RegistryCharacter.js:113`), through the registry link. `SocialProfile` has no image column (**MEASURED**: no photo, image or URL field in `src/models/SocialProfile.js`). Keep the initial when there is no portrait. |
| **Friends** "[13] friends" and the six tiles | The first 12 `lalaverse` profiles (`:334`), without the JustAWoman record (`:343`). The count is that query's total (`:344`), so it means "profiles in the LalaVerse", not her friends. The tiles are entries 1-6 after removing Lala (`:383`). The literal brackets in `[{friends.total}]` are kept (`:401`). **MEASURED** | The profiles Lala is linked to. Two real sources exist: `social_profiles.lala_relationship` (`src/models/SocialProfile.js:142-145`), whose `direct` value means she knows them; and `social_profile_followers` with `character_key = 'lala'` (`src/models/SocialProfileFollower.js:19`), meaning who she follows. **INFERRED**: which one means "friend" is Evoni's call for #2747 (§4). |

### Composer (centre)

| Element | Today | Should |
|---|---|---|
| **Share** | Posts `status: 'live'` at once (`:368-372`). The route stamps `posted_at` now and the wall post's story time, `story_order` (`feedPostRoutes.js:103`, `:106`). **MEASURED** | Save a draft, as #2748 asks. The route already takes `status: 'draft'` (`feedPostRoutes.js:91-92`) and stamps `story_order` either way (`:106`). **INFERRED**: #2748 is a frontend change plus a wording change ("Posts as Lala, live on the feed", `:446`). |
| **Status / Relationship / Friends** options | **Status**: the text as typed. **Relationship**: a relationship-status post, `relationshipText({kind:'status'})`, with `post_type = 'relationship'` (`:362`, `:371`; `RELATIONSHIP_POST_TYPE`, `frontend/src/lib/feedRelationship.js:15`). **Friends**: a "now friends with X" post of the same type (`:363`). The friend list is the 12 profiles above (`:432`). Nothing is written to a profile or a link: each one is only a post. **MEASURED** | Stay posts (`docs/FEED_POSTS.md` rule 8). The Friends picker should list real candidates (§1 Friends). **INFERRED**: a "now friends with" post does not make them friends anywhere else, so #2747 has to decide whether it should. |

### Wall

| Element | Today | Note |
|---|---|---|
| **Posts** | `GET /api/v1/feed-posts?show_id&status=live|draft&with=comments` (`:317-318`). The route (`feedPostRoutes.js:23-79`) filters `deleted_at: null` and the status. It orders by `posted_at DESC` (`:48`), not by story time. **MEASURED** | Posts have a status: `draft` or `live` (`src/models/FeedPost.js:77-80`, `src/services/feedPostStatus.js:3-12`). Deleted is `deleted_at` (`feedPostRoutes.js:451`, restore `:486`). A story-time stamp exists: `story_order` (`FeedPost.js:84`), or the episode number plus `timeline_position` (`src/services/storyClock.js:36-40`). **INFERRED**: ordering by `posted_at` puts a generated draft at its generation time, because the generator stamps `posted_at: new Date()` (`src/services/feedPostGeneratorService.js:296`), not at its story time. |
| **Status line** under her name | Her newest post on the loaded page (`:358`). **MEASURED** | Fine once the owner is found by the registry link. |

### Requests (right column)

| Count | Today | Note |
|---|---|---|
| **"n draft posts"** | The `total` of `GET /feed-posts?show_id&status=draft&limit=1` (`:336`, `:349`): every draft post of the show, of every episode. **MEASURED** | It counts every episode's drafts, including script drafts (#2894). **INFERRED**: #2749 puts the episode-complete posts here. |
| **"n reactions to approve"** | `GET /feed-posts/comments/pending` (`:337`): the show's draft comments, at most 100 (`feedPostRoutes.js:148-162`). **MEASURED** | "Reactions" means draft comments here. The triage's D3 asks what the Requests label should be. |

### Upcoming Events ("None planned")

**Today.** `GET /api/v1/calendar/events?series_id=<show id>` (`:335`).
- That route reads `story_calendar_events` (`src/routes/calendarRoutes.js:158-176`, model `StoryCalendarEvent`, `tableName` at `src/models/StoryCalendarEvent.js:134`).
- It is filtered by `series_id` (`:162`) and ordered by `start_datetime` (`:175`).
- The page keeps the events from yesterday on, else all of them, and takes three (`:345-348`).
- The route has no `requireAuth`, unlike the rest of the page (`calendarRoutes.js:158`).

**MEASURED.**

**Should read** the show's own events: `world_events` (`GET /api/v1/world/:showId/events`, `src/routes/worldEvents.js:66`, requireAuth). These are the events episodes are made from. Each has a `status` (`draft | ready | used | archived`, `src/models/WorldEvent.js:338-342`) and its `event_date`/`event_time` as text (`:132`, `:137`).

**INFERRED:**
- The calendar events are the cultural calendar, not Lala's plans.
- "Upcoming" is an event not yet used by a published episode. That is `status` `ready`, or `draft` with a date, and not `used`. #2750 should confirm the rule with Evoni.

### People You May Know ("Everyone here already knows Lala")

**Today:** entries 7-8 of the same 12 profiles (`:384`). The empty message shows when the LalaVerse has 7 or fewer profiles besides Lala (`:491`). Nothing is actually checked against Lala. **MEASURED.**

**Should read:** `lalaverse` profiles Lala is not yet linked to. That is the complement of §1 Friends: `lala_relationship` other than `direct`, or no `social_profile_followers` row for `lala`. **INFERRED**: it must use the same rule Evoni picks for Friends.

### Footer links

- **People** goes to `/feed?tab=people&layer=lalaverse` (`:530`). That is the People tab, with `SocialProfileGenerator` embedded (`:526`, lazy at `:10`).
- **Timeline & generation** goes to `/shows/:id/feed-timeline` (`:530`; route `frontend/src/App.jsx:388`).

**MEASURED.**

---

## §2 The five questions

**a. Does a story-time field exist on posts, events or episodes?**

Yes.
- **Posts:** `feed_posts.story_order` (`src/models/FeedPost.js:84`; migration `20261004180000`). A post written on the wall is stamped with it, after the latest published episode (`storyClock.presentOrder`, `feedPostRoutes.js:106`). A post of an episode uses `episode_number * 10 + phase`, the phase coming from `timeline_position` (`storyClock.js:24-40`; `FeedPost.js:38-41`).
- **Episodes:** `episode_number` is the clock.
- **Events:** `world_events.event_date`/`event_time` are free text (`WorldEvent.js:132-137`), not a story order (`storyClock.js:4-7`).

**MEASURED.**

**b. Does the episode-complete post generator write drafts or live posts, and where do they show?**

- **Drafts.** `generateEpisodeFeedPosts` creates each post with `status: 'draft'` (`src/services/feedPostGeneratorService.js:280`, `:306`). It is called by `POST /feed-posts/:episodeId/generate` (`feedPostRoutes.js:168-192`).
- **When they go live:** when the episode's status changes to `published`. `episodeController` calls `publishEpisodePosts` (`src/controllers/episodeController.js:563-572`), which sets the episode's drafts live (`feedPostStatus.js:30-38`).
- **Until then** they show:
  - on the wall's **Drafts** tab (`SocialMediaPage.jsx:35-39`, `:313`);
  - in the Requests count (`:336`);
  - in the episode's own feed views (`GET /feed-posts/episode/:episodeId`, `feedPostRoutes.js:381`).

**MEASURED.**

**c. Are the Feed profiles linked to Character Registry characters? By what key?**

- **Yes, by `registry_characters.feed_profile_id`.** The link lives on the registry entry (`RegistryCharacter.js:364-367`). It is read through `src/utils/registryLink.js`: `linkedCharacter`, `withRegistryLinks`, and the raw SQL `LINKED_CHARACTER_JOIN` at `:26-30`.
- **`social_profiles.registry_character_id` is not the link.** Its type never matched, and the model no longer declares it (`registryLink.js:8-12`).

**MEASURED.** How many of the profiles are linked needs a database read. That is **not measured**, and agent sessions make no database contact.

**d. Where is Lala's relationship status stored, if anywhere?**

Three places:
1. Her relationship-status posts (`post_type = 'relationship'`, read by `latestStatus`). This is the record under `docs/FEED_POSTS.md` rule 8.
2. `social_profiles.relationship_status` (`SocialProfile.js:77`).
3. `registry_characters.relationship_status` (`RegistryCharacter.js:602`).

**MEASURED.** `src/routes/characterRegistry.js` is F-Reg-2 territory, so nothing in this series writes the registry field. **INFERRED**: the post stays the source of truth, and the profile field stays the fallback.

**e. Where is Lala's home-base city stored?**

`shows.metadata.lala_home` (`{ address, neighbourhood, city }`). It is read and written through `GET`/`PUT /api/v1/shows/:id/lala-home` (`src/routes/shows.js:468-483`), and validated by `src/utils/lalaHome.js:60-77`. A city is required (`:75`). **MEASURED.** The Feed page does not read it (§1).

---

## §3 What each fix task needs, by file

**#2747 Lala's profile reads real data**
- `frontend/src/pages/SocialMediaPage.jsx` `Wall` and `loadSides`:
  - find the owner through her registry link;
  - read `/shows/:id/lala-home` for Current City;
  - Relationship Status from a `post_type=relationship` query;
  - Works at from her career tier;
  - the picture from `portrait_url`;
  - Friends from the rule Evoni picks (§4), with the brackets dropped.
- Backend:
  - a read that returns Lala's profile with its linked character. `withRegistryLinks` already exists (`registryLink.js:62`).
  - `GET /social-profiles` may need a filter for Lala's friends (`src/routes/socialProfileRoutes.js:1139`).
- Must not touch `src/routes/characterRegistry.js`.
- Tests: `SocialMediaPage` tests.

**#2761 one home for making Feed profiles** (split in two, per the triage)
- (a) `SocialProfileGenerator.jsx` and its three mounts:
  - `SocialMediaPage.jsx:526`;
  - `WorldStudio.jsx:1201`, layer `real_world`;
  - `NewEpisodeStarter.jsx:360`, `chooseHost`.
- (b) The Feed page only shows profiles. Its generator moves to one home.
- Do together with #2747, since both change where friends and profile links point.

**#2748 Share saves a draft stamped with story time**
- Backend done: `POST /feed-posts` takes `status: 'draft'` and stamps `story_order` (`feedPostRoutes.js:85-118`).
- Left to do:
  - `SocialMediaPage.jsx` `share` (`:364-378`) sends `status: 'draft'`;
  - the wording at `:446`;
  - after sharing, the Drafts tab.
- Making a draft live from the page needs `PUT /feed-posts/:postId` with `status: 'live'` (`feedPostRoutes.js:419-428`) and a button on `PostCard`.

**#2749 episode-complete posts land in Requests for approval**
- `SocialMediaPage.jsx` Requests: list the drafts per episode, with an approve action.
- `feedPostStatus.js` / `episodeController.js:563-572`:
  - only if Evoni's D3 says drafts wait for approval instead of going live on publish;
  - and the Requests label (D3).

**#2750 Upcoming Events and People You May Know read real data**
- `SocialMediaPage.jsx:335`, `:345-348`: read `GET /world/:showId/events` instead of the calendar, with the "upcoming" rule.
- `:384`: People You May Know from the complement of the Friends rule.

---

## §4 Decisions for Evoni

1. **Friends (#2747, #2750):** which profiles are Lala's friends?
   - (a) `lala_relationship = 'direct'`;
   - (b) profiles Lala follows (`social_profile_followers`, `character_key = 'lala'`);
   - (c) both.
   - People You May Know is then the rest of the LalaVerse.
2. **"Now friends with" posts (#2747):** should sharing one also make them friends, by setting the link in 1? Or does it stay a post only?
3. **Upcoming Events (#2750):** is "upcoming" the show's events with status `ready` (and `draft` with a date), skipping `used` and `archived`?
4. **D3, from the triage (#2749):** do an episode's drafted posts still go live when it is published, or wait for approval in Requests? And what is the Requests label?
