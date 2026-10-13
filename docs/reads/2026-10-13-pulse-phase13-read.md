# Read: The Pulse after phase 12 — what is still open, measured and ranked (phase 13)

- **Basis:** a local merge, `7a9932bbec51c6189c4eba2e44c1880990a50590`. Every `path:line` below is at this commit. It is `origin/main` at `93bee304` (#3114) with the open phase 12 branches merged on top:
  - #3117 `7726962b` (merged since, as `561c6d5b`);
  - #3118 `65a3aa4a`;
  - #3129 `dcd8f396`;
  - #3131 `bb1c67f9`;
  - #3132 `8c82ec87`, the spec update.

  The spec quoted is the one #3132 writes.
- **Date:** 2026-10-13
- **Task:** #3133, part 1 of The Pulse phase 13. Evoni, 2026-10-13: "start phase 13 read".
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact. No row was counted, so every statement about data is about code.
  - Covers the spec (`docs/design/2026-10-the-pulse.md` §2–§11) checked against the code, and what phase 12's PRs deferred or left open.
  - Items Evoni kept for later (slang spreading, scene triggers, the Dream Cities map, Stories and Explore, a real-audience dashboard) are not proposed again. §4 lists what each waits on.

**Markers.**
- **MEASURED** means a `path:line` read at the basis.
- **INFERRED** means reasoned from measured code, not observed running.

---

## 1. Leaks: what a logged-out visitor can read

### A. The feed-post read routes need no login, and can return drafts, hidden posts and teaser words

**MEASURED.**
- `app.js` mounts the router with no auth of its own (`src/app.js:1693`). These routes use `optionalAuth`, and none is marked `// PUBLIC:`:
  - `GET /api/v1/feed-posts` (`src/routes/feedPostRoutes.js:112`).
    - `?status=draft|all` is accepted from anyone (`statusWhere`, `src/services/feedPostStatus.js:23-28`).
    - Without `?at`, nothing is filtered by story time or by reveals.
    - With `?at` but only `episode_id`, reveals are skipped: they run only `if (show_id)` (`feedPostRoutes.js:169`).
  - `GET /:showId/timeline` (:380): no story clock, no reveals.
  - `GET /post/:postId` (:422): the whole post, including a teaser's words, plus its live comments and the episode numbers and titles of its beats (:436-443).
  - `GET /:postId/comments?status=draft|all` (:452).
  - `GET /episode/:episodeId` (:581): drafts are included by default (`statusWhere(... 'all')`, :585).

**INFERRED, the consequence:** anyone who has a show, post or episode id can read the following without signing in:
- Lala's held drafts and posts about her (§7 "Always to Review");
- hidden posts and teaser text (§5);
- episode data (§2 rule 5).

These routes predate The Pulse. `GET /post/:postId` came with #2597 (`da57ba79`, 2026-10-04). They are still the routes the Phone zones and the Admin pages read.

**What to decide.** These routes serve the studio and the Phone. The public website has its own routes (`/api/v1/public/*`).
- (a) `requireAuth` on all five (S). Check first that no public page calls them.
- (b) Keep `optionalAuth`, but refuse drafts, hidden posts and teaser words to a request with no user (M).

### B. The public recap sends a stored comment count that can be AI-made

**MEASURED.**
- The episode post generator stores the AI's `comments_count` and `sample_comments` on its drafts (`src/services/feedPostGeneratorService.js:281`, :300).
- Releasing a post through `PUT /feed-posts/:id` does not recount (`feedPostRoutes.js:631`, which still allows `comments_count` and `sample_comments` to be set).
- The public recap selects `fp.comments_count` (`src/services/pulseRecap.js:87`) and returns it (`src/routes/publicRecaps.js:57`).

**INFERRED:** a released generator post can show the public "48 comments" when none exist. Spec §8 says "Comments count equals real drafted comments". The Pulse itself is safe, because the card counts real comments.

**Fix:** the recap counts live comments at the present (S).

### C. A teaser post keeps its place

**MEASURED.** `withPlaces` runs before `applyPostReveal` (`feedPostRoutes.js:216-217`), and `applyPostReveal` (:85) does not clear `place` or `place_city`. A teaser therefore shows its venue and appears in that city's feed (`src/utils/feedCities.js:41`).

**INFERRED:** "a first look at the Velvet Room" gives away where the reveal happens. Minor.

**Fix:** a teaser drops its place (S).

### D. Public polls take no account of reveals

**MEASURED.**
- A poll's default question names the event ("Which look for ${subject.name}?", `src/services/pulsePolls.js:117`).
- Open polls are served with no reveal or story-time check.

**INFERRED:** an event still hidden in The Pulse can be named on the public site. That only happens if Evoni opens a poll for it, so it is a question for her, not a fix.

---

## 2. Review and canon rules the code does not keep

### A. Comments about Lala, or by her, can go live without Review

**MEASURED.**
- `POST /feed-posts/:postId/comments` accepts `status: 'live'` and creates the comment live (`feedPostRoutes.js:483-499`). It runs no Lala or about-Lala check.
- `PATCH /comments/:commentId` sets a draft live with `requireAuth` only (:532-547). Unlike a post's `releaseHold` (:37-41), it has no admin check.

Spec §7: "posts or comments about Lala … only Evoni's Approve in Review puts it live". #3105 covered posts and ripple replies, but not comments.

**Fix:** the same hold and release as posts (S).

### B. The ripple engine makes live replies that skip the posting rules

**MEASURED** (`src/services/feedEngagementService.js`).
- **Who reacts:** 8 random profiles, `order: sequelize.random()` (:169-174). There is no check of reveal, lifecycle stage or approved voice.
- **Numbers:** random likes, comments and shares (:232-234).
- **Status:** `post.status === 'draft' || held ? 'draft' : 'live'` (:245). A reply that isn't about Lala goes live with no gate and no numbers proposal.
- **Reachable from the UI:** `POST /feed-enhanced/post/:postId/ripple` (`src/routes/feedEnhancedRoutes.js:57`), from the Event Feed dashboard.

Spec §7 says only revealed, Active characters with an approved voice post, and the gate scores every draft. Spec §8 says numbers are proposed when a post goes live.

**What to decide:**
- (a) Ripples become drafts that wait in Review (S).
- (b) Ripples go through the posting engine: voice, gate, numbers (M).
- (c) Remove the ripple button (S).

### C. Numbers that wait for Evoni already show on The Pulse

**MEASURED.**
- `numbersAt` shows a proposal not yet decided at its proposed numbers: "a proposal not yet decided shows its proposed numbers on the same curve" (`src/services/pulseNumbers.js:238-249`).
- `applyNumbers` feeds The Pulse, the recap and the Phone.

Spec §8: "Lala's numbers always wait for Evoni … After acceptance numbers lock as canon."

**What to decide:**
- (a) Until she decides, show the post's previous number, or none (S).
- (b) Keep it as is, and the spec says proposed numbers show provisionally.

The code comment shows the current behaviour was a deliberate choice.

### D. Comments are never checked for "reveals story"

**MEASURED.**
- Comment prompts ask only for `{"text"}` (`src/services/pulseDrafter.js:213`, :297).
- `routeComment` calls `reviewReasons(asPost, gate, { lalaProfileId })` (:462) without `revealsStory`. The parameter exists (`src/services/pulseGate.js:162`).

**Fix:** comments report `reveals_story` like posts (S).

### E. Lala's money posts have no story time

**MEASURED.** `financialFeedService` inserts its posts (`src/services/financialFeedService.js:77`) with no `story_order`; the file never mentions it. Once approved, such a post reads as "always" and shows at every scrubbed moment.

**Fix:** stamp the episode's moment, or the present (S).

### F. The older Phone feed zones skip the clock, reveals and Review

**MEASURED.**
- Only the Pulse zones pass a story moment.
- `FeedPostsRenderer` reads `/feed-posts/episode/:id`, which includes drafts, or `/timeline` (`frontend/src/components/ScreenContentRenderer.jsx:245`).
- The notifications, relationship-changes and comments renderers read with no moment.

**INFERRED:** spec §3 Phone sync says "same posts, numbers, reveals". Whether these older zones count as The Pulse on her Phone is Evoni's call. They do draw Pulse data in episodes.

**What to decide:** move them to `?at=` and the Pulse reads (M), or say in the spec that they are outside The Pulse.

### G. Lala's Feed tab can approve outside Review, and shows a stale chip

**MEASURED.**
- Each draft card has **Approve** (`frontend/src/components/Show/LalaFeedTab.jsx:56-57`). For an admin that is the same release as Review's.
- The chip "Goes with the release" (:46) contradicts the 2026-10-13 rule that it goes live when she approves it.

**INFERRED:** spec §7 says "only Evoni's Approve in Review puts it live". Approve here is still hers, but it sits outside the Review queue.

**What to decide:** keep Approve here (and the spec says Review or Lala's Feed), or send it to the queue. The chip is a plain fix (S).

### H. The Profile view shows the free-text estimate as "Followers"

**MEASURED.** `frontend/src/pages/SocialMediaPage.jsx:419` renders `<dt>Followers</dt><dd>{owner.follower_count_approx}</dd>`. That is unmarked and not the count at the moment. The header does it correctly (spec §3).

**Fix:** use the header's count (S).

---

## 3. What phase 12 left open

**MEASURED** unless marked.

### Public images

- **Objects are never deleted from the public bucket.**
  - Each publish writes a new key: recaps at `src/services/pulseRecap.js:143`, looks at `src/services/styleSheetDistributionService.js:249`.
  - Unpublishing a recap only changes its status (`pulseRecap.js:235`).
  - Taking a look down deletes its record, so its object can no longer be found (`styleSheetDistributionService.js:299`).
  - There is no `DeleteObject` anywhere.
  - **INFERRED:** an image taken down stays readable at its old URL, and the bucket only grows.
  - **What to decide:**
    - (a) delete old objects on replace, unpublish and take-down; this needs `s3:DeleteObject` on the app's role, which is her AWS action (M);
    - (b) keep a list of keys for a later sweep (S);
    - (c) accept it.
- **The recap shows only a post's first photo.** `imageAsShown` returns `post.image_url` (`pulseRecap.js:116`). A post has one `post_photo` reveal, so photos 2–4 can't be teased separately.
  - **What to decide:** first photo only, or all of them (S–M).
- **Review shows only the first photo.** `PulseReviewPost.jsx:227` renders `post.image_url`. Evoni approves Lala's posts with up to four photos while seeing one.
  - **Fix:** show all photos with their alt text (S).
- **`PUT /feed-posts/:id` with `image_url` leaves `photos` behind** (`feedPostRoutes.js:631`).
  - **INFERRED:** the card would keep the old photos while the teaser and recap use the new image. Only the API can do this; no page does.
  - **Fix:** S.
- **A stale comment:** `src/routes/publicLooks.js:11`, "Text only until website storage is live".
  - **Fix:** S.

### Followers

- **A teaser's follower change can be lost.** When a teaser post's reveal has no moment yet, `proposeFromPost` returns null (`src/services/pulseFollowers.js:287`). Setting the moment later never proposes it again. Its callers are `pulseNumbers.js:213` and `:338` only.
  - **Fix:** propose it when the reveal gets a moment (S).
- **Posts locked before #3087** never get a post change. Episode rows proposed earlier but not yet decided still include post likes ("Rows proposed earlier still show their old factors", #3087).
  - **INFERRED:** a post that locks after the deploy could then count twice for that episode.
  - **What to decide:** backfill or not; re-propose pending episode rows (S–M).

### Relationships

- **`character_relationships` deletes.**
  - The model is now paranoid (#3129).
  - The routes still hard-delete:
    - `src/routes/relationships.js:611` and `:702`;
    - `src/routes/worldStudio.js:1907`.
  - Their raw reads don't filter `cr.deleted_at`:
    - `relationships.js`;
    - `pulseKnowledge.privateKnowledge`, `src/services/pulseKnowledge.js:170`.
  - **INFERRED:** a soft-deleted row would be invisible to model reads, but would still appear on the Relationships page and still feed private knowledge.
  - **What to decide:** soft or hard deletes. Either way, add `cr.deleted_at IS NULL` to the raw reads (S).
- **The old `feed_profile_relationships`** is no longer written, but its model is still registered (`src/models/index.js:437`). The copy kept `notes` but not `story_position` (`src/migrations/20261013130000-map-relationships-into-pulse.js:52`).
  - **What to decide:** retire the model, then drop the table after Evoni checks the production row count; or keep it as an archive. Also whether `story_position` matters (S to M).
- **Registry relationships proposing Feed kinds** (relationships read §5 (b)) is not built.
  - **What to decide:** build it or not, and approve a Registry→Feed kind map, e.g. sisters → family (M–L).
- **Side effects #3117 named:**
  - copied Orbit and Former friends pairs that aren't hidden now count for event guest lists;
  - more pairs qualify for the Pressure Wave's AI ripples.
  - **What to decide:** accept them, or leave Orbit out of guest choice (S).

### Events and the Phone

- **The episode post generator still reads the old `guest_list`** (`src/services/feedPostGeneratorService.js:96`), against the one attendance rule (#3084).
  - **Fix:** use `eventAttendees` (S).
- **The Engine warning for an event with no guests** (phase 12 read §3 part 2) was not built.
  - **What to decide:** whether she still wants it (S).
- **Episode playback uses During, not the beat pin.** It reads `beatOrder(...)` (`frontend/src/pages/EpisodeDetail.jsx:1033`). Only the Phone tab preview uses `pinnedBeatOrder` (`frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx:210`), as Evoni ruled.
  - **What to decide:** should playback follow the pin too (S–M)?

### Wardrobe and places

- **Order import has no way to dismiss a kept line.** The only write route is `matchLater` (`src/routes/wardrobeOrders.js:74`), and a matched line can't be undone (`src/services/wardrobeOrderImport.js:286`).
  - **INFERRED:** Amazon purchases that aren't wardrobe pile up in "Kept for later".
  - **What to decide:** add Dismiss and Unmatch, or not (S–M).
- **A venue with no Dream City** gives `place_city = null` (`src/utils/feedPlaces.js:51`). Its post then shows in the poster's city feed under the venue's name. The venue's city is also copied once, so it doesn't follow a venue that moves.
  - **What to decide:** hide venues with no city in the picker (S).
- **Poll cap:** `IP_SOFT_CAP = 10` (`src/services/pulsePolls.js:31`).
  - **Decision for Evoni:** confirm the size. It was never answered.

### Other code

- **World Studio has two more raw-fetch path bugs:**
  - `fetch('/api/world/characters/bulk-re-sync'` (`frontend/src/pages/WorldStudio.jsx:1149`);
  - `/api/world/characters/${charDetail.id}/re-sync` (:1742).

  Both lack `/v1` and a token. The tests pin them as "D1 SKIP".
  - **Fix:** through `apiClient`, as #3129 did for Auto-Link (S).

---

## 4. Waiting on Evoni or on something outside the code

- **Deploy.** Migrations `20261013050000` to `20261013130000` reach production only through her approved Deploy run.
  - `110000` and `130000` add enum values outside a transaction.
  - The `down` of `080000` refuses once an IP has two live votes on a poll.
  - The `down` of `130000` refuses once there are Orbit or Former friends rows it did not copy.
- **Scene-level story time** (spec §3, §7; phase 12 read §2 E (b)/(c)).
  - **Decision:** which record holds a beat (`feed_moments`, `scene_plans` or `continuity_beats`), and the clock's shape. **L.**
- **In-episode reveals ("the cursor")** wait on scene-level story time.
  - #3118 found that `cursor_actions` and `icon_cues` are created only by the root `migrations/` tree, which never runs. Evoni should confirm against production.
- **Private knowledge has no story time** (`pulseKnowledge.js:170` reads every confirmed relationship). A draft at Ep 1 can be shaped by what the novel reveals later.
  - **Decision:** give secrets a "known from" moment, or accept knowledge as timeless. **L.**
- **Gmail receipts:** need Google OAuth, a credential she sets up. **L.**
- **A venue page:** none exists. A venue label opens its city's feed. **M.**
- **Kept for later on 2026-10-13:**
  - slang spreading;
  - scene triggers;
  - the Dream Cities map (waits for a map image);
  - Stories and Explore;
  - a real-audience dashboard (waits for an analytics source).

---

## 5. Proposed phase 13

Each part is one phone-reviewable PR. **[decide]** marks the parts that need Evoni's call first.

| # | Part | Area | Size |
|---|---|---|---|
| 1 | **[decide] Feed reads need a login** (§1 A): (a) `requireAuth` on the five routes; (b) keep them open but refuse drafts, hidden posts and teasers to logged-out requests | backend | S–M |
| 2 | **Comments about Lala wait for Review** (§2 A): the posts' hold and release, applied to comments | backend | S |
| 3 | **[decide] The ripple engine** (§2 B): (a) its replies are drafts; (b) through the posting engine; (c) remove it | backend + frontend | S–M |
| 4 | **Teasers and recaps leak less** (§1 B, C): the recap counts real comments; a teaser drops its place | backend | S |
| 5 | **Small canon fixes** (§2 D, E, H; §3): comments report "reveals story"; money posts get story time; the Profile view's follower count; the teaser follower change; the generator uses the attendance rule; `deleted_at` in the raw relationship reads; World Studio's two fetches; the stale comment | backend + frontend | S |
| 6 | **Review shows every photo** (§3), and `PUT image_url` keeps `photos` in step | backend + frontend | S |
| 7 | **[decide] Numbers before Evoni decides** (§2 C): hide them until decided, or say in the spec that they show provisionally | backend | S |
| 8 | **[decide] Lala's Feed tab** (§2 G): keep Approve there or send it to the queue; fix the chip | frontend | S |
| 9 | **[decide] The older Phone zones** (§2 F): read through the story clock, or say they are outside The Pulse | frontend | M |
| 10 | **[decide] Public bucket clean-up** (§3): delete, list, or accept | backend (+ her AWS action) | S–M |
| 11 | **[decide] Phase 12 leftovers**: recap photos (first only or all); order import Dismiss/Unmatch; venues without a city; the poll cap of 10; the Engine no-guests warning; backfilling pre-#3087 posts; playback following the beat pin; Orbit in guest lists | mixed | S each |
| 12 | **[decide] Relationships, next**: retire `feed_profile_relationships`; soft or hard deletes for `character_relationships`; Registry→Feed kind proposals (relationships read §5 b) | backend | S to M–L |
| 13 | **The spec brought up to date** with the rulings above | docs | S |

Parts 2, 4, 5 and 6 need no decision and can start at once. Part 1 closes the widest leak, so it should go first once she rules on it.
