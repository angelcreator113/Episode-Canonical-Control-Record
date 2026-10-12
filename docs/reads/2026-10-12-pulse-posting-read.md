# Read: The Pulse posting engine (phase 6)

- **Basis:** `origin/main` at `d559a77bf25785dceeeddeefefd59d8ccb7c517a`. Every `path:line` below is at this SHA.
- **Date:** 2026-10-12
- **Task:** #2966. This is part 1 of 7 of The Pulse spec phase 6 (`docs/design/2026-10-the-pulse.md` §7 Posting engine, §12 step 6). The parts are #2966 to #2972.
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact.
  - Reads only, under `src/`.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means a conclusion drawn from measured code, with the reason given.
- Nothing here was read from a database, so how many characters sit at each stage is not measured.

**Evoni's phase 6 rulings (2026-10-12, this session):**
1. **Who posts:** revealed characters whose `depth_level` is `active` or `alive`.
2. **Voice Profiles** live in a **new table**, not on `registry_characters` or `social_profiles`.
3. **The daily cap** counts **drafts per day** for The Pulse, set in Admin, on top of the overall AI budget.
4. **The ambient worker** ships **off**; Evoni turns it on in Admin.

---

## §1 Who may post

**The stage.** `registry_characters.depth_level` is `ENUM('sparked','breathing','active','alive')`, nullable (`src/models/RegistryCharacter.js:308-311`). **MEASURED.**

**How a character reaches each stage.** `calculateDepthLevel` (`src/services/characterGenerationService.js:447`) decides it. It is applied on generation and on depth edits (`src/routes/characterGenerationRoutes.js:148`, `:172`). **MEASURED.**
- **alive:** all of `want_architecture`, `wound`, `the_mask`, `triggers`, `blind_spot`, `dilemma`, `deep_profile` and `prose_overview` are filled (`:457-459`).
- **active:** the character has a `feed_profile_id` **or** a `living_state` (`:462`).
- **breathing:** `deep_profile`, `wound` or `want_architecture` (`:465`).
- **sparked:** otherwise.

**INFERRED: ruling 1 in practice is close to "every character linked to a Feed profile".** A character with a Feed profile is at least `active`, so it is eligible once revealed. #2967's `eligible()` should still read `depth_level`, so a later change to the rule moves with it, and it must also require a Feed profile, since a post needs a poster.

**Revealed.** The Pulse's reveal rules already decide who Lala has met at a story moment:
- `revealsAt(...).hiddenProfiles` (`src/services/pulseReveals.js:176`, `:200`) gives the Feed profiles that are still hidden;
- `metLala` (`:98`) gives the episode each profile meets her in.

**INFERRED:** "revealed" for posting means "not in `hiddenProfiles` at the post's story order". This uses the same rule the reads apply, so a hidden character never posts into The Pulse.

## §2 Voice sources (for #2967)

**There is no voice table.** **MEASURED.** What exists:
- **`registry_characters.voice_signature`:** JSONB, "Section 7: Voice & Dialogue Signature" (`src/models/RegistryCharacter.js:246`). Defaults to `{}` (`:672`).
- **`registry_characters.demographic_voice_signature`:** TEXT, distinct from `voice_signature` (`:621-622`).
- **`registry_characters.deep_profile`:** marked **DEPRECATED** (`:262-271`). The canonical depth is the `de_*` columns, through `/api/v1/character-depth`.
- **`registry_characters.living_state`** (`:325`) and **`living_context`** (`:258`).
- **`social_profiles.posting_voice`:** TEXT (`src/models/SocialProfile.js:44`). It is the only voice the feed generators read today:
  - `feedPostGeneratorService.js:71`, `:107`, `:224`;
  - `feedCommentDrafter.js:22` (`VOICE_ATTRIBUTES`) and `:84`.
- **`world_characters`:** `speech_pattern`, `vocabulary_tone`, `catchphrases`, `internal_monologue_style` (`src/models/WorldCharacter.js:239-251`).

**INFERRED: a new table (ruling 2) avoids F-Reg-2's write contention on `registry_characters`.** It also leaves `posting_voice` as a source the build reads, not a field it rewrites. The build should read:
- the `de_*` depth;
- `voice_signature`;
- `demographic_voice_signature`;
- `posting_voice`;
- Living State, as private context only, never as a stated habit (spec §7, "Living State vs public persona").

**There is no banned-phrase list anywhere** (repo-wide search for banned / AI-sounding phrase lists: none). **MEASURED.** It is new in #2967.

## §3 Generators today

| What | Model | Writes | Trigger | Gate |
|---|---|---|---|---|
| `feedPostGeneratorService.generateEpisodeFeedPosts` | `claude-sonnet-4-6` (`src/services/feedPostGeneratorService.js:20`, `:240`) | `feed_posts` drafts (`:307`) | `POST /feed-posts/:episodeId/generate` (`src/routes/feedPostRoutes.js:271`) | `aiRateLimiter` |
| `feedCommentDrafter.draftReactions` | `MODELS = ['claude-sonnet-4-6']` with fallback (`src/services/feedCommentDrafter.js:20`, `:124-130`) | `feed_comments` drafts (`:161`) | `POST /feed-posts/:postId/comments/draft` (`feedPostRoutes.js:427`) | `aiRateLimiter` |
| `feedPostRedrafter.redraftPost` | Sonnet (`src/services/feedPostRedrafter.js:19`) | a draft, rewritten | `POST /feed-posts/:postId/redraft` (`feedPostRoutes.js:613`) | `aiRateLimiter` |
| `feedEngagementService.generateRippleEffects` | none: templates and `Math.random` (`src/services/feedEngagementService.js:205`, `:226-235`) | replies, draft if the parent is (`:239`) | `src/routes/feedEnhancedRoutes.js:49-50` | — |
| `scriptPostDrafts.draftScriptPosts` | none: the script's `[UI:POST]` text, word for word | drafts (`src/services/scriptPostDrafts.js:113`) | `feedPostRoutes.js:241-242` | — |
| `financialFeedService` (milestones, big spends) | none: templates | draft with an episode, else live (`src/services/financialFeedService.js:72`, `:89`) | `financialTransactionService.js:689`, `:693` | — |
| `feedScheduler` | Haiku and Sonnet | **profiles**, not posts | every few hours from `src/app.js:710` | runs only if `FEED_SCHEDULER_ENABLED === 'true'` (`src/services/feedScheduler.js:1224`) |

All of this is **MEASURED**. **INFERRED:** every AI-written post today is drafted on demand in a live request. Nothing drafts on its own, and nothing scores a draft. Phase 6's drafter (#2969) is the first to run unattended, which is why it runs only in the queue (#2968).

**Statuses.** A post is `draft` or `live` only (`src/services/feedPostStatus.js:17`). **MEASURED.** **INFERRED:** "goes to Review" means it stays a draft, which Review already lists. "Auto-publish" means release through the existing path (`PUT /feed-posts/:id`, status `live`), so #2953's number proposal runs (`proposeLater`, `src/services/pulseNumbers.js:211`).

## §4 Cost

- **Every Anthropic SDK call is checked and logged automatically.** `src/services/aiCostTracker.js` patches the client globally and is loaded first (`src/app.js:19`). **MEASURED.**
  - `DAILY_BUDGET` is `AI_DAILY_BUDGET_USD`, default $50 (`aiCostTracker.js:124`).
  - `checkBudget` (`:200`) rejects a call that would pass the budget with a 429 (`:321`).
  - The exports are at `:399`.
- **There is no per-feature cap.** **MEASURED.** Calls only carry a `routeName` tag for the logs.

**INFERRED:** ruling 3's draft cap is a count kept by the Pulse queue (#2968) and checked before a job runs. It sits inside the global dollar budget and never replaces it. A drafting job tags its calls (for example `routeName: 'pulse-engine'`), so the spend can be read back.

## §5 Queues

- **Bull** is used for video only (`src/queues/videoQueue.js:3`, `:7`). **MEASURED.**
- **SQS jobs** (`JobQueueService`, `routes/jobs.js`, `routes/queue-monitor.js`) belong to the processing pipeline. **MEASURED** by name.
- **A database-polling worker:**
  - `src/workers/sceneGenerationWorker.js` claims a `generation_jobs` row in a transaction with `lock: UPDATE, skipLocked: true` (`:30-47`);
  - it sleeps `POLL_INTERVAL_MS` between polls (`:22`, `:199`);
  - it requeues stale jobs (`:215`);
  - `src/server.js:213-218` starts it embedded only outside production; in production a separate PM2 process runs it.
  - **MEASURED.**

**INFERRED:** #2968's Pulse queue follows the `generation_jobs` worker: a `pulse_jobs` table, claim with `skipLocked`, poll, retry. It needs no Redis or SQS. Starting it from `src/app.js` behind `PULSE_ENGINE_ENABLED`, off by default and off in tests, keeps it from running anywhere Evoni hasn't switched it on. In production, turning it on is a server `.env` change, which is Evoni's own action.

## §6 Where "an event happens"

- **Episode completion:** `completeEpisode` runs its post-commit steps after the transaction. **MEASURED.**
  - Step 11 posts financial milestones (`src/services/episodeCompletionService.js:405`).
  - Step 19 is the event outcome for host and guests (`:738`).
  - Step 20 is the follower-change proposal (`:764`, #2956).
- **World events:** `world_events.status` is `draft | ready | used | archived` (`src/models/WorldEvent.js:338-342`). `used` means made into an episode. There is no "happened" status. **MEASURED.**
- **INFERRED: an event "happens" when its episode is completed.** #2970 therefore hooks a step 21 into `completeEpisode`, non-blocking like step 20, which **enqueues** jobs and never calls AI in the request. The guests come from the event's `canon_consequences.automation.guest_profiles`, as `metLala` reads them (`src/services/pulseReveals.js:98`).
- **Relationships:** four relationship tables exist:
  - `character_relationships` (`src/models/CharacterRelationship.js:56`);
  - `social_profile_relationships` (`src/models/SocialProfileRelationship.js:57`);
  - `feed_profile_relationships` (`src/models/FeedProfileRelationship.js:56`);
  - `relationship_events`.
  - **MEASURED** by name. Which one carries "closeness to Lala" for #2970's pick is **not measured here**. #2970 reads them before it scores.

## §7 Story time

- Drafts are stamped with a story order: `storyClock.orderOf` / `PHASES` (`src/services/storyClock.js:28`). Ambient posts use the present (`presentOrder`, `:63`). **MEASURED.**
- **INFERRED:** the gate's story-clock check (#2969) is that a draft mentions nothing after its own order. Its reveals check uses `revealsAt` at that order (§1).

## §8 What the build issues take from this

| Issue | Takes |
|---|---|
| #2967 Voice Profiles | §1 eligibility (`depth_level` plus a Feed profile, not hidden); §2 sources; the new banned-phrase list |
| #2968 Queue and cap | §4 cap as a draft count inside the dollar budget; §5 the `generation_jobs` worker pattern, behind `PULSE_ENGINE_ENABLED` |
| #2969 Drafts and gate | §3 statuses (Review means draft; publish means release); §7 story time; reveals from §1 |
| #2970 Event-triggered | §6 step 21 enqueue on completion; the guests; relationship tables read first |
| #2971 Ambient | §5 worker timer; §7 present order; off by default (ruling 4) |
| #2972 Voices in Admin | §2 the voice and its examples |
