# Read: The Pulse after phase 11 — what is still open, measured and ranked (phase 12)

- **Basis:** `origin/main` at `b7822bff8fd1fba5ff7601493b81925c0c95b214`. Every `path:line` below is at this SHA. #3077 (the spec update, docs only) merged after it, as `fa1bf7b9`.
- **Date:** 2026-10-13
- **Task:** #3078, part 1 of The Pulse phase 12. Evoni, 2026-10-13: "start the phase 12 read".
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact. No row was counted, so every statement about data is about code.
  - Covers what phase 11 left open: the gaps the spec now states (`docs/design/2026-10-the-pulse.md` §2–§14), the work earlier reads set aside (`docs/reads/2026-10-13-pulse-gap-read.md` §3), and the recap teaser leak found during phase 11.
  - Items Evoni kept for later on 2026-10-13 (slang spreading, the Dream Cities map, Stories and Explore, a real-audience dashboard) are not proposed. They appear here only where an item below depends on them.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means reasoned from measured code, not observed running.

**Line drift since the gap read:**
- `pulseFollowers.CAUSES` is now `src/services/pulseFollowers.js:32` (it was :29).
- The composer's Photo and Location are now `frontend/src/pages/SocialMediaPage.jsx:219-220` (they were :227-228).
- `SITE_PUBLIC_BUCKET` is now documented in `.env.example:121-124`, commented out. The gap read said it was missing.

---

## 1. A public leak: teaser posts in the weekly recap

**What happens.** **MEASURED** unless marked.
- `pulseRecap.visiblePosts` drops hidden posts and posts by hidden profiles, but keeps **teaser** posts (`src/services/pulseRecap.js:86-89`).
  - It selects `fp.content_text` (:78-79).
- The public, unauthenticated `GET /api/v1/public/recaps/:id` returns each post's `content_text` (`src/routes/publicRecaps.js:52-55`).
- The Pulse sends a teaser with no words (`applyPostReveal`, `src/routes/feedPostRoutes.js:94-99`).
- Trending leaves teasers out: `[...reveals.hiddenIds('post'), ...reveals.teaserIds('post')]` (`src/services/feedEngagementService.js:388`, Task #3048).

**The path to the leak.** INFERRED from the measured code:
1. A live post is set at During Ep 3 (story order 35).
2. Evoni gives it a teaser reveal at a later moment.
3. At the present (After Ep 3, 37) The Pulse shows it as a "first look", with no words.
4. A recap that ranks it publishes its full text to logged-out visitors.
5. `postsOf` reads at each request's present, so the leak lasts until the reveal moment passes.

**Scope of the leak.**
- Only the words leak. Images, `trending_topic` and `image_description` are not selected (:78-79).
- The recap test covers only a hidden post (`tests/integration/pulseRecap.integration.test.js:64-65`).

**Fix.**
- Exclude `teaserIds('post')` in `visiblePosts`, as Trending does. Add a teaser case to the test.
- **S**, no migration, no AI call.
- This needs no decision unless Evoni wants teaser posts shown as a "first look" in recaps (§3 item E).

## 2. What is open, by area

### A. Follower causes `post` and `event`

**Today.** **MEASURED** unless marked.
- `CAUSES = ['start','episode','post','event','override']` (`pulseFollowers.js:32`). `cause` is a free `STRING(20)` (`src/models/PulseFollower.js:19`), and nothing checks it against the list.
- The writers are:
  - `proposeStarts`: Lala's start waits; others are accepted at once (:55-82).
  - `override`: accepted, with a reason (:159-170).
  - `proposeEpisodeChange`: Lala only, always proposed (:196-232). It is called at episode completion (`src/services/episodeCompletionService.js:769`).
- Nothing writes `post` or `event`, so characters other than Lala move only by override.
- The episode change already folds in Lala's post likes: `from_posts` is `SUM(final_likes) × POST_LIKES_TO_FOLLOWERS` (0.02) (`pulseFollowers.js:176,187,208-212`).
- Two places would mishandle a new cause:
  - Review lists only `cause === 'episode'` (`frontend/src/components/Admin/PulseReview.jsx:43`).
  - `decide` refuses a row with no accepted count only for `episode` (`pulseFollowers.js:123`). A `post` or `event` row would count from 0.
- Growth already has labels for "A post" and "An event" (`frontend/src/components/Admin/PulseGrowth.jsx:78-79`).
- A model to copy already exists: `pulseCloseness` proposes from live posts and comments, with an auto-accept line (`src/services/pulseCloseness.js:22-41`). It is hooked via `proposeLater` (`feedPostRoutes.js:264,477,529,643`).

**Smallest change.**
- Add `proposeFromPost`, triggered when a post's numbers lock (`pulseNumbers.decide`, `src/services/pulseNumbers.js:307-335`, and its auto-accept at :193-208).
- Optionally add `proposeFromEvent` for guests, beside `proposeEpisodeChange`.
- Widen the guard at :123 and the Review filter at :43.
- Add a unique partial index per `(show, profile, cause, cause_id)`. This is a migration (index only).
- No AI. **M**; with both causes, **M–L**.
- INFERRED: Lala's post likes must not count twice, once through `post` and once through `episode.from_posts`.

### B. What characters know beyond events

**Today.** **MEASURED.**
- `pulseKnowledge` covers world events only (`src/services/pulseKnowledge.js:46-57,107-147`).
- The drafter adds one "Events they know about" line (`src/services/pulseDrafter.js:96-99`), and the gate flags `doesnt_know` from it (`src/services/pulseGate.js:85-96`).
- The "knows" text is on **`character_relationships`**, not on the registry character: `knows_about_connection`, `source_knows`, `target_knows`, `reader_knows` (`src/models/CharacterRelationship.js:44-50`).
- Secret-like fields exist, but no Pulse drafter reads any of them:
  - `registry_characters`: `hidden_want`, `private_reality`, `secret_connections` (`src/models/RegistryCharacter.js:181,631-642`);
  - `social_profiles`: `private_reality`, `secret_connections` (`src/models/SocialProfile.js:167-190`);
  - `story_calendar_events`: `what_only_we_know` (`src/models/StoryCalendarEvent.js:86-93`).
- `pulseVoices` takes only the public face by design (`src/services/pulseVoices.js:38,79-82`).
- Three non-Pulse prompts already format the knows text: `src/routes/storyEvaluationRoutes.js:324-327,403-420`, `src/routes/memories/engine.js:1738-1746` and `src/routes/characterAI.js:279-281`.

**Smallest change.**
- Add `privateKnowledge(db, characterId)`. It reads the poster's `character_relationships`, takes `source_knows` or `target_knows` according to which side the poster is on, and never `reader_knows`.
- Pass it into the drafter's PRIVATE block ("shapes, never state") for posts, comments, batches and DMs (`src/services/pulseDms.js:158`).
- No migration; longer prompts, no new AI calls. **S**.
- With a gate check that flags a draft quoting it: **M**.
- If secrets get a story time ("known from Ep 3"): **L**.

### C. Events with no guests

**Today.** **MEASURED.**
- Knowledge and posting read guests only from `canon_consequences.automation.guest_profiles` (`pulseKnowledge.js:41-43,55`; `src/services/pulseEventPosting.js:94-96,131`).
- With none, only Lala is "there" (`pulseKnowledge.js:117`; `pulseEventPosting.js:144`).
- The event's host is never counted (`src/utils/eventOrganizer.js:7-16,52`).
- `pulseReveals.metLala` reads `world_events.guest_list` and the `episode_briefs.event_id` link (`src/services/pulseReveals.js:108-118`), but knowledge and posting do not. **The three services disagree on who attended.**
- `calendar_event_attendees` keys a UUID `feed_profile_id` to `story_calendar_events`, not to `world_events` (`src/models/CalendarEventAttendee.js`). INFERRED: it cannot join without a mapping.

**Smallest change.**
- Add one shared `eventAttendees(ev)` helper: `guest_profiles`, plus `guest_list`, plus the host. Use it in all three services, and let knowledge read the brief link too.
- Optionally warn in Engine when an event has no guests.
- No migration, no AI. **S**.

### D. `GET /pulse-reveals/state`, unused

**Today.** **MEASURED.**
- The route is `src/routes/pulseReveals.js:116-142`.
- No frontend caller; #3041 replaced it with `/cities`. Its only test is `tests/integration/pulseRevealsApplied.integration.test.js:181-185`.
- It returns reveal states and teaser URLs, never full image URLs (:128-137). INFERRED: dead code, not a leak.

**Change:** remove it and its test, or keep it as a documented API. **S**.

### E. Beat-level story time and scene triggers (kept for later on 2026-10-13)

**Today.** **MEASURED.**
- Story order is `episode_number × 10 + phase` (`src/services/storyClock.js:28-42`). During is a single point (`beatOrder`, :44). Only digit 6 is free between During and After.
- The Phone passes `beatOrder(episode_number)` to every beat (`frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx:203`; `frontend/src/pages/EpisodeDetail.jsx:993`). A screen zone may pin its own `config.at` (`ScreenContentRenderer.jsx:291-293,337-338`).
- Only episode completion triggers posting (`episodeCompletionService.js:782`). There is no `scene` queue kind (`src/services/pulseQueue.js:33`).
- Integer `story_order` is stored on about ten tables, and the ×10 arithmetic is repeated outside `storyClock`: `pulseNumbers.momentIndex` (`pulseNumbers.js:230-234`), `routes/pulseReveals.js:106`, `PulseGrowth.jsx:50` and others.
- Candidate carriers for a beat: `feed_moments` (`beat_number`, `sort_order`, `trigger_profile_id`; `src/models/FeedMoment.js:13-57`), `scene_plans` (`src/models/ScenePlan.js:12-34`) and `continuity_beats`.

**Options, smallest first:**
- **(a) Pin a phase per Phone beat** (one nullable column on `feed_moments`, or reuse of zone `config.at`). **S–M**.
- **(b) A secondary `story_beat` key** on posts and comments, read by every `<= :at` filter. **L**.
- **(c) Re-encode the clock as ×100.** A data migration on about ten tables and every ×10 site. **L+**, risky.
- Scene triggers on top add a `scene` queue kind and new automated AI spend under the cap. **M–L**.

### F. In-episode reveals with "the cursor"

**Today.** **MEASURED.**
- The story clock read deferred "revealing items in-episode with the game-style cursor in the Overlays tab" (`docs/reads/2026-10-11-pulse-story-clock-read.md:22`).
- There are two candidate meanings of "cursor":
  - **The production cursor timeline.**
    - `src/routes/cursorPaths.js`, with `cursor_actions` and `icon_cues`, created by the root `migrations/` tree, which does not run.
    - The audit register lists both tables as absent from the 2026-08-29 canon capture (`docs/audit/Canon_AbsentTable_Classification_2026-09-17.md:28,120`). INFERRED: they likely do not exist in the deployed database.
  - **The Phone's playthrough taps.**
    - `src/services/phoneRuntime.js`; `src/routes/phonePlaythroughRoutes.js:189-246`.
    - Tap state is per user (:197-200), but Pulse reveals are per show.
- The Overlays tab is "kept off beats for now" (`frontend/src/components/Episodes/EpisodeOverlaysTab.jsx:22-24`).
- Reveals compare integer orders (`pulseReveals.js:65-82`). A beat-level reveal needs E first.

**Sizes.**
- A beat picker in the reveal and scrubber tools, after E (a): **M**.
- A reveal on a Phone tap (per player): **L**.
- Reviving the production cursor tables: **L+**.

### G. The composer's Photo and Location

**Today.** **MEASURED.**
- Photo and Location are inert (`SocialMediaPage.jsx:219-220`).
- `share` posts JSON with `status: 'draft'` (:185-190).
- `POST /api/v1/feed-posts` reads no image or place (`feedPostRoutes.js:230`).
- On a draft, `PUT /:postId` accepts `image_url` and re-cuts teasers (:606,634-636).
- `FeedPost` has `image_url` but no place field (`src/models/FeedPost.js:29-30`).
- A post's city is its poster's, "never copied onto the post" (`src/utils/feedCities.js:31-41`).
- The upload path to reuse is `storePulseImage` (`src/services/pulseImageService.js:27-55`), as `POST /pulse-fits` uses it (`src/routes/pulseFits.js:30-35,161-188`). It goes to the studio bucket, which needs no new credential.
- Review already shows a draft's photo and offers a post-photo reveal (`frontend/src/components/Admin/PulseReviewPost.jsx:227,270`).

**Changes.**
- **Photo:** a draft-only `POST /feed-posts/:postId/photo`, plus a file input in the composer. No migration. **M**.
- **Location:** a nullable `feed_posts.place_city` (migration), the card, and possibly the city feed. **M**.
  - INFERRED: matching a post's own city in the city feed reverses "a post's city is its poster's".

### H. Public images (recaps, looks)

**Today.** **MEASURED.**
- Without `SITE_PUBLIC_BUCKET`, `requireStorage` throws 503 `SITE_STORAGE_NOT_CONFIGURED` (`src/services/websiteSlotService.js:49-64`). There is no data-URL fallback (:7-11).
- Recaps select no image (`pulseRecap.js:78-79`).
- Looks return no image (`src/services/styleSheetDistributionService.js:308-322`). Style-sheet images are drawn per request behind `requireAuth` (`src/routes/episodes.js:614`).
- `useShowLogo` already copies a studio image into the public bucket (`websiteSlotService.js:242-258`).

**What waits on Evoni:** create the bucket with public read, grant the app's role `PutObject`, and set `SITE_PUBLIC_BUCKET` on the server. These are infrastructure actions, hers alone.

**Code possible now, inert until the bucket exists:**
- Copy at publish: a recap post's image, or its teaser while it is one, and nothing for a hidden post.
- Store the key, then return `publicUrl`.
- Recaps need a JSONB column (migration). Looks can use `distribution_metadata`.
- **M** per surface.

### I. Shop the Look: order import, and Add piece's Real world section

**Today.** **MEASURED.**
- There are no order, click or sale tables.
- `wardrobe.real_source` names `gmail` and `amazon_export`, but nothing writes them (`src/models/Wardrobe.js:183-186`).
- The Real world section exists only in Producer Mode's piece editor: `RealWorldFields` (`frontend/src/components/Wardrobe/RealWorldFields.jsx:14-37`), used in WorldAdmin.
- `AddPieceDialog` has no Real world section (`frontend/src/components/Wardrobe/AddPieceDialog.jsx`, "In the story" :232, "More" :267).
- The server already accepts real fields on create (`realFieldsFrom`, `src/controllers/wardrobeController.js:38-65,158,305`).

**Changes.**
- **Add piece's Real world section:** frontend only. **S**.
- **Order import:**
  - an Amazon CSV upload, matched to pieces and confirmed by Evoni: **M–L**;
  - Gmail receipts: needs Google OAuth, a new credential, **L**.
- **Affiliate sales:** a separate store, kept out of every in-world read (spec rule 7). **L**.

### J. Poll votes: one per voter and one per IP

**Today.** **MEASURED.**
- Two partial unique indexes: one per voter and one per IP (`src/migrations/20261012100000-create-pulse-polls.js:77-80`).
- `castVote` stores salted hashes of both (`src/services/pulsePolls.js:224-244`). The voter is an HttpOnly cookie (`src/routes/publicPolls.js:40-74`).
- A test asserts that "another browser from the same IP" is refused (`tests/integration/pulsePolls.integration.test.js:127`).

**Cookie alone.** A migration drops the IP index. The salted IP hash stays stored for audit. **S**.
- INFERRED tradeoff: households, offices and carrier NAT can each vote, but a cleared cookie votes again. Results are advisory (phase 8), so the risk is small.

---

## 3. Proposed phase 12

Each part is one phone-reviewable PR. Parts marked **[decide]** need Evoni's call first. The others are fixes or small additions that need none.

| # | Part | Area | Size |
|---|---|---|---|
| 1 | **Recap leaves teaser posts out** (§1): matches Trending; a teaser case in the recap test. | backend | S |
| 2 | **One attendance rule for events** (C): a shared helper of `guest_profiles`, `guest_list` and the host, used by knowledge, posting and `metLala`; knowledge reads the brief link too; Engine warns when an event has no guests. | backend + frontend | S |
| 3 | **Add piece's Real world section** (I): the editor's `RealWorldFields`, folded under More. | frontend | S |
| 4 | **[decide] Follower causes** (A). Which posts move followers: (a) every locked post, by a small share of likes; (b) only posts Evoni makes viral or a flop; (c) none, and drop `post` from `CAUSES` and the spec. Events: (a) guests gain by the event's prestige; (b) drop `event`. Non-Lala changes: (a) auto-accept under a line, like closeness; (b) always wait. The Review filter and the `decide` guard are fixed either way. | backend + frontend | M |
| 5 | **[decide] What characters know** (B). (a) The relationship "knows" text as private drafting context; (b) also `private_reality` and `secret_connections`; (c) keep events only. A gate check that flags a draft quoting it: yes or no. | backend | S–M |
| 6 | **[decide] The composer's Photo** (G): one photo per draft (no migration), or up to four (migration). | backend + frontend | M |
| 7 | **[decide] The composer's Location** (G): a Dream City or a venue; a label only, or also the city's feed and trends. | backend + frontend | M |
| 8 | **[decide] Poll votes** (J): (a) keep cookie and IP; (b) cookie alone, IP hash kept for audit; (c) cookie plus a soft cap per IP. | backend | S |
| 9 | **[decide] `GET /pulse-reveals/state`** (D): remove it, or keep it as a documented API. | backend | S |
| 10 | **[decide] Public images** (H): (a) Evoni sets up the bucket first, then build; (b) build the inert code now, switched on by the env var; (c) keep the pages text-only. | backend + frontend | M per surface |
| 11 | **[decide] Order import** (I): (a) an Amazon CSV upload; (b) Gmail receipts (new credential); (c) keep typing by hand. | backend + frontend | M–L |

Parts 1–3 can start at once, in any order. Part 1 closes a leak on a public page, so it should go first.

**Kept for later, and what they wait on:**
- **Beat-level story time and scene triggers (E)** wait on choosing the beat's record (`feed_moments`, `scene_plans` or `continuity_beats`) and the clock's shape. The smallest step is pinning a phase per Phone beat (E a, S–M). The full form is L.
- **In-episode reveals (F)** wait on E, and on what "the cursor" means. The production cursor tables are likely absent from the deployed database.
- Slang spreading, the Dream Cities map, Stories and Explore, and a real-audience dashboard stay later by the 2026-10-13 rulings.
