# Read: The Pulse against its spec, and what was set aside (phase 11)

- **Basis:** `origin/main` at `1adcab3f51704c579223aaf2c8ac2fe3484b54e1`. Every `path:line` below is at this SHA.
- **Date:** 2026-10-13
- **Task:** #3044, part 1 of The Pulse phase 11. Evoni, 2026-10-13: "Gap read first".
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact. No row was counted, so every statement about data is about code.
  - #3041 (PR #3043) merged after this basis, as `9f1c784a`. It changes how The Pulse reads the Dream Cities: Lala's view reads them through `GET /pulse-reveals/cities` and never the catalog. Where that matters, it is noted.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means reasoned from measured code, not observed running.

**Where the build stands.** The spec's build order (`docs/design/2026-10-the-pulse.md` §12) is done:
- phases 1–8;
- Shop the Look (phase 9);
- Evoni's 2026-10-12 decisions (phase 10: #3028–#3034, plus #3041).

This read checks every promise in spec §1–§11 against the code, collects what the reads and PRs set aside, and proposes phase 11.

---

## 1. Spec against code

Most of the spec is built as written. Only the rows that are partial, missing, or say something the code does not do are listed. Each has its evidence. Everything else in §1–§11 was checked and found built. **MEASURED** unless marked.

### §1–§2 What it is, and the rules

| Spec | Status | Evidence |
|---|---|---|
| §1 Admin tabs "The Pulse, Website, Show settings" | Built, plus one | A fourth tab, `tools`, exists (`frontend/src/pages/AdminPanel.jsx:30`, Evoni 2026-10-11). The spec text is out of date. |
| §2 rule 2 "Every post, comment, … carries a story-time stamp" | Partial | Comments have no story time: `FeedComment` has only `posted_at` and `sort_order` (`src/models/FeedComment.js:20-21`), and every live comment on a shown post is sent at any moment. Posts, fits and trending treat an unknown story time as "always" (`src/routes/feedPostRoutes.js:140`; `src/routes/pulseFits.js:120`; `src/services/feedEngagementService.js:380`). The stories row picks recent posters by real time (`frontend/src/components/Pulse/PulseStories.jsx`, `recentPosters`). |
| §2 rule 7 "Real audience numbers … a separate dashboard" | Missing | Nothing mixes real and in-world numbers, but there is no real-audience dashboard. |

### §3 The Pulse (Lala's view)

| Spec | Status | Evidence |
|---|---|---|
| Header "Lala's … follower count" | Contradicts §8 | The header shows the free-text estimate `follower_count_approx` (`frontend/src/pages/SocialMediaPage.jsx:119`, via `src/services/lalaFeedProfile.js:50`), not her canon count at the story moment. `pulseFollowers.countAt` (`src/services/pulseFollowers.js:84`) is read only in Admin. |
| Left nav "Stories"; "Explore (…)" | Placeholder | Stories is not in `TABS` (`SocialMediaPage.jsx:54-61`) and renders "Coming to The Pulse" (:150). Every Explore entry is disabled (:157). On mobile, Explore opens Events (:413). |
| Composer | Partial | Photo and Location are disabled (`SocialMediaPage.jsx:227-228`). |
| Right "Explore the Dream Cities (map + five cities)" | Partial | No map: `frontend/src/components/Pulse/PulseSides.jsx:6`, "No map: there is no map image yet." |
| Right "Trending … from approved, live, tagged posts" | Leaks | Trending counts teaser posts: only hidden posts and unmet characters are left out (`src/services/feedEngagementService.js:385-389`). A teaser's hashtag and words reach Trending even though the teaser itself is sent without them (`applyPostReveal`, `feedPostRoutes.js`). It reads only the latest 200 posts (:398). |
| Phone sync "as of that beat's story time" | Episode only | The Phone reads The Pulse at the episode's During moment, `beatOrder(episode_number)` (`src/services/storyClock.js:44`). Beats have no time of their own (world-depth read :217). |

### §4 Social Director

| Spec | Status | Evidence |
|---|---|---|
| Growth "… and Influence" | Missing | Deferred by the numbers read (`docs/reads/2026-10-12-pulse-numbers-read.md:20`, :101) and noted at `src/services/pulseGrowth.js:8-9` and `src/routes/pulseFollowers.js:115`. `character_state.influence` exists (`src/models/CharacterState.js:28`), but no Pulse code reads it. |
| The sub-tab list | Out of date | The spec omits the built Voices, Engine, Polls and Recaps tabs (`frontend/src/pages/AdminPulse.jsx:43-54`). |

### §5–§6 Reveals; who knows what

Built as written, including the 2026-10-12 crop-by-default teasers (#3034). One limit: knowledge covers events only (`src/services/pulseKnowledge.js`); secrets and other facts are not modelled.

### §7 Posting engine

| Spec | Status | Evidence |
|---|---|---|
| Voice Profiles "generate automatically when a character reaches Active … regenerate when the profile or Living State changes" | Contradicts | Building is manual (`POST /api/v1/pulse-voices/:characterId/build`, `src/routes/pulseVoices.js:107`). A changed public face sets `needs_rebuild` (`src/services/pulseVoices.js:242`). Living State is kept out of voices by design (`pulseVoices.js:26-28`). |
| "Evoni's edits … become voice examples" | Partial | Pinned posts become examples. Edits do not: an edit example is typed by hand in Voices (`frontend/src/components/Admin/PulseVoices.jsx:138`). |
| "when an event **or scene** happens" | Partial | Only episode completion triggers posting (`src/services/episodeCompletionService.js:782`). |
| "Relationship-shaped reactions" | Partial | The engine picks commenters by closeness to Lala (`pulseEventPosting.whoPosts`), not by their relationship to the poster. Hand-drafted reactions (`feedCommentDrafter.pickReactors`) do use the poster's relationships. |
| "Slang spreads through relationships over time" | Missing | No code propagates phrasing. The only related text is the `signature_phrases` habit in the voice prompt (`pulseVoices.js:160`). |
| "Always to Review: Lala's posts" | Not enforced | Only the UI sends a draft (`SocialMediaPage.jsx:196`). `POST /api/v1/feed-posts` defaults to `live` and does not check the poster (`feedPostRoutes.js:204-216`), so any signed-in caller can publish a Lala post with no Review. |
| Cost control: 20 a day | Partial | (a) `POST /api/v1/feed-posts/:episodeId/generate` drafts posts with AI and takes no request: `feedPostGeneratorService.js` has no `pulseRequests` (`messages.create` :239; route `feedPostRoutes.js:293`). (b) 5 and 15 are defaults, each editable up to 100 (`pulseQueue.js` `MAX_CAP`), as ruled in #3031. (c) Manual work runs in the request, under `aiRateLimiter`; only DMs are queued. |

### §8 Numbers

| Spec | Status | Evidence |
|---|---|---|
| "Each post's likes, comments and shares are proposed" | Spec contradicts itself | Comments are never proposed (`src/services/pulseNumbers.js` header). The spec's own later bullet, "comment count is the real comments", matches the code. |
| "grow over about two days of story time" | Different unit | The curve runs over two story moments, `CURVE = [0.55, 0.85, 1]` (`pulseNumbers.js:57`). Story time has no hours (:50-56). |
| Followers change only with a cause | Partial | `CAUSES` lists `post` and `event` (`pulseFollowers.js:29`), but nothing writes them. Characters other than Lala move only by override. |
| Starting counts "confirmed by Evoni" | Contradicts the numbers read | Other characters' starts are accepted at once; only Lala's waits (`pulseFollowers.js:11-13`; numbers read :18). |

### §9 Relationships respond

| Spec | Status | Evidence |
|---|---|---|
| "adjust Relationship Map closeness" | Different by design | Changes go to a separate `pulse_closeness` ledger (world-depth read :78-82). The Relationship Map does not show it (`/pulse-closeness` is read only by `PulseReview` and `PulseClosenessWaiting`). Since #3030 it covers only Alive characters and Lala, so Feed profiles with no registry character never move. This was not written down. |

### §10–§11 Shop the Look; public extras

Built. Public pages are text only until website storage is set up: `SITE_PUBLIC_BUCKET`, `src/services/websiteSlotService.js:8-10`. The recap has no newsletter ("no email", `src/services/pulseRecap.js:8`; public-extras read :19). §11's "after website storage is live" no longer describes what happened: these shipped text-only first.

---

## 2. Problems found that no read or ruling covers

These need no decision, only a fix. **MEASURED** unless marked.

1. **Event posts are lost when the automated lane is used up.**
   - A refused job is `skipped` and not retried (`src/services/pulseQueue.js:175-179`).
   - `enqueueForEpisode` stops if any event job exists for the episode, skipped ones included (`src/services/pulseEventPosting.js:135-139`).
   - It also returns nothing when the engine is off at completion (:134), and nothing fills that in later.
   - INFERRED: with 5 automated requests a day, an episode completed late in a busy day never gets its posts.
2. **Storyline beats waiting on the cap are re-queued every hour.**
   - A refused beat goes back to `planned` (`src/services/pulseStorylines.js:130`), and the hourly `tick` (`TICK_MS`, :33) queues it again.
   - Each new job is refused before any AI call until midnight UTC, so it costs nothing. INFERRED: about one skipped job row per beat per hour.
3. **Lala's posts can go live without Review** through the API (§7 above).
4. **Trending counts teaser posts' hidden words and hashtags** (§3 above).
5. **The episode post generator drafts outside the request cap** (§7 above).
6. **A teaser is not cut again when its image changes.**
   - `makeTeaser` runs only when a reveal is saved (`src/routes/pulseReveals.js:194-199`).
   - Replacing a post, fit, cover or city image leaves the old teaser in place.
   - A reveal saved before its item had an image shows no image until it is saved again.
7. **A refused first DM leaves an empty thread.**
   - `openThread` saves the thread before `enqueueMessage` refuses the sender (`src/routes/pulseDms.js:91-92`).
   - The empty thread shows in Admin, and a later attempt reuses its old moment and topic.
8. **The engine switch is missing from `.env.example`.** `PULSE_ENGINE_ENABLED` is checked at `src/app.js:719`, but `.env.example` has no line for it. `POLL_HASH_SALT` is there (:114); `SITE_PUBLIC_BUCKET` is not.
9. **Stale comments.** These still say teasers are blurred, or that a phase is coming:
   - `src/services/pulseReveals.js:8`;
   - `frontend/src/components/Pulse/PulseSides.jsx:14-16`;
   - `frontend/src/components/Pulse/PulseStories.jsx:8-9`;
   - `frontend/src/components/Admin/PulseStoryClock.jsx:8`;
   - `frontend/src/components/Admin/PulseReview.jsx:25`;
   - `frontend/src/components/Admin/PulseReviewPost.jsx:4`;
   - `frontend/src/pages/AdminPulse.jsx:10`.
10. **A latent bug, noted earlier and still there.** `src/routes/entanglementRoutes.js:59` asks for a `follower_count` attribute that no model declares (numbers read :37).

## 3. Work set aside by earlier reads, still open

Each was deferred on purpose and is still true at the basis. **MEASURED.**

- **Influence:** waits for real data (numbers read :20, :101; `pulseGrowth.js:8`).
- **The stored 4-tier `follower_tier`:**
  - It stays for generation and scoring (#3033; `src/services/pulseAudience.js:12-14`).
  - Its maps are `TIER_MIDDLE` (`pulseFollowers.js:27`), `TIER_PRESTIGE` (`src/services/eventAutomationService.js:100`) and `follower_tier_affinity` (`src/models/CharacterFollowProfile.js:32`, `src/services/characterFollowService.js:104`, `src/routes/socialProfileRoutes.js:741`).
  - INFERRED: a "micro" starting count of 5,000 is Nano in the six tiers.
- **Which relationship table is canon for "the kind of relationship"** (world-depth read :215). The Pulse reads `social_profile_relationships`; the map page edits `feed_profile_relationships`.
- **Beat-level story time** for the Phone (world-depth read :217).
- **The Relationship Map showing the ledger's closeness** (world-depth read :81).
- **The registry's "knows" text as drafting context** (world-depth read :43).
- **Event guests are optional.** An event with none has only Lala as a witness (world-depth read :216).
- **In-episode reveals with the Overlays cursor** (story clock read :22).
- **Public images wait for website storage** (public-extras read :17; `src/routes/publicRecaps.js:8`; `src/routes/publicLooks.js:11`).
- **Shop the Look:** importing orders comes later (shop read :21). Add piece has no Real world section (shop read :44).
- **Votes:** one per voter and one per IP; Evoni may relax this to the cookie alone (public-extras read :83).
- **`GET /pulse-reveals/state`:** since #3041 (`9f1c784a`), nothing in the frontend calls it. It is kept and tested.

## 4. Proposed phase 11

Each part is one phone-reviewable PR. Parts 1–7 fix the problems in §2 and need no decision. Parts 8 onwards need Evoni's call, marked **[decide]** with the options. Nothing is built until she rules.

| # | Part | Area |
|---|---|---|
| 1 | **Lala's posts always go to Review:** the API refuses `live` for Lala's posts and anything about her (§2 item 3) | backend |
| 2 | **Trending leaves teasers out** at a moment: no hidden words or tags (item 4) | backend |
| 3 | **Event posts survive a used-up lane:** a cap-skipped event job is queued again after midnight UTC, and an episode completed while the engine was off can be queued from Engine (item 1) | backend + frontend |
| 4 | **Storyline beats wait quietly:** a beat refused by the cap is not queued again until the lane resets (item 2) | backend |
| 5 | **Every Pulse drafting call counts:** the episode post generator takes a manual request (item 5) | backend |
| 6 | **Teasers follow their image:** replacing an item's image cuts its teaser again; a reveal with no teaser image gets one when its image arrives (item 6) | backend |
| 7 | **Housekeeping:** a refused first DM opens no thread (item 7); `.env.example` lines for `PULSE_ENGINE_ENABLED` and `SITE_PUBLIC_BUCKET` (item 8); the stale comments (item 9); `entanglementRoutes` `follower_count` (item 10) | backend + docs |
| 8 | **[decide] The header's follower count.** (a) Lala's canon count at the moment, with her tier. (b) Keep the free-text estimate. | frontend + backend |
| 9 | **[decide] Comment story time.** (a) Comments get a story order (migration) and wait until their moment. (b) Comments show whenever their post does, and the spec says so. | backend |
| 10 | **[decide] Influence.** (a) Show `character_state.influence` on Growth, read only. (b) Define how The Pulse moves Influence: what causes, proposed and approved like followers. (c) Leave it out of The Pulse and drop it from the spec. | backend + frontend |
| 11 | **[decide] The stored tiers.** (a) Move generation, prestige and follow odds to the six count tiers (migration of the maps). (b) Keep both, and fix only `TIER_MIDDLE` so a tier's starting count lands in the matching count tier. (c) Leave as is. | backend |
| 12 | **[decide] Voices.** (a) Build a character's voice automatically when they reach Active; it still waits for her approval. (b) Keep building manual, and the spec says so. Either way, her edits could also become examples automatically. | backend |
| 13 | **[decide] Relationships.** Which table is canon for the kind of relationship (world-depth read :215). Then either (a) automatic commenters shaped by their relationship to the poster, and the Relationship Map showing the ledger's closeness, or (b) keep closeness to Lala, and the spec says so. | backend + frontend |
| 14 | **[decide] What the spec drops or keeps for later:** slang spreading; scene triggers; the map; Stories and Explore (build, or remove the placeholders); a real-audience dashboard; the newsletter | docs, then any parts she keeps |
| 15 | **The spec brought up to date** with the rulings above, and with what was built differently (§1) | docs |

Parts 1–7 can start at once, in any order. Part 15 comes last, after her rulings.
