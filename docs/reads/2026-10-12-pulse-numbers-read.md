# Read: The Pulse numbers (phase 5)

- **Basis:** `origin/main` at `e38018d37aa35ad25bd697099f6c24366714c8bb`. Every `path:line` below is at this SHA.
- **Date:** 2026-10-12
- **Task:** #2951. This is part 1 of 7 of The Pulse spec phase 5 (`docs/design/2026-10-the-pulse.md` §8 Numbers, §4 Growth, §12 step 5). The parts are #2951, #2952, #2953, #2954, #2955, #2956 and #2957.
- **Scope:**
  - Changes no code and nothing under `docs/audit/`.
  - Makes no host, AWS, database or Cognito contact.
  - Reads only, under `src/` and `frontend/src/`.

**Markers.**
- **MEASURED** means a `path:line` read at the basis SHA.
- **INFERRED** means a conclusion drawn from measured code, with the reason given.
- Nothing here was read from a database, so row counts and real follower figures are not measured.

**Evoni's phase 5 rulings (2026-10-12, this session):**
1. Follower counts live in a **new follower ledger**: one row per change, each with a cause. They are not a column on `character_state` or `registry_characters`.
2. **Starting counts** are read from each profile's estimate, or the tier's middle, and **confirmed** by Evoni. Lala's start waits for her.
3. An approved **episode follower change** is written to the ledger **and** as a `character_state_history` row, so the existing Decision Log card shows it.
4. **Influence** cut-offs wait until real data exists. Phase 5 shows the count and the tier only.

---

## §1 Followers

**No numeric follower count is stored anywhere.** **MEASURED.**

**`social_profiles`**
- `follower_tier` is an ENUM of micro, mid, macro and mega (`src/models/SocialProfile.js:36`).
- `follower_count_approx` is free text such as "47k" (`:37`).
- These are written by the AI profile generator, by `registrySync` (`SYNCABLE_TO_FEED = ['follower_tier', 'current_state']`, `src/services/registrySync.js:442`), and by the profile edit routes.

**`registry_characters`**
- `follower_tier` is a STRING (`src/models/RegistryCharacter.js:626`).
- It syncs to the profile (above). **INFERRED:** writing it would put phase 5 in F-Reg-2's write-contention territory.

**Latent bug.** `src/routes/entanglementRoutes.js:59` asks for a `follower_count` attribute that no model declares. It is outside phase 5's scope and noted only.

**Lala's stats.**
- `character_state` holds coins, reputation, brand_trust, influence and stress, and no followers (`src/models/CharacterState.js:6`, `:22-28`).
- Its header forbids hooks and associations (`:10`).
- F-Stats-1, which covers "`character_state` model + raw-SQL writers", is complete, but its shape is protected (`PROJECT_CONTEXT.md:326`).

**No follower history exists.** **MEASURED.** **INFERRED:** a ledger of its own (ruling 1) gives every count a cause without changing either protected table.

**Starting counts (ruling 2).**
- They parse `follower_count_approx` ("47k", "1.2M", "3,400").
- Otherwise they fall back to the tier's middle.
- **INFERRED:** these are proposals to confirm, not facts. No real figure exists to check them against.

## §2 Post numbers

- **Columns.** `feed_posts.likes`, `comments_count` and `shares` are integers defaulting to 0 (`src/models/FeedPost.js:32-34`). `is_viral` and `viral_reach` follow (`:59-60`). There is no proposal, lock or growth column. **MEASURED.**
- **Who writes `likes` and `shares` today.**
  - The episode post generator asks Claude for numbers "realistic for each character's follower_tier" (`src/services/feedPostGeneratorService.js:229`) and saves them.
  - Ripple replies use `Math.random` (`src/services/feedEngagementService.js:226-227`).
  - A hand-written wall post starts at 0 (`src/routes/feedPostRoutes.js:203`).
  - **MEASURED.** Nothing is proposed from followers or locked.
- **`comments_count` is already the real live comments.** `recountComments` (`src/services/feedCommentDrafter.js:172`) runs when a live comment is added (`src/routes/feedPostRoutes.js:415`). **MEASURED.** Spec §8's "Comments count equals real drafted comments" already holds, so phase 5 never proposes comments.
- **"Goes live".** A post becomes live through `PUT /api/v1/feed-posts/:postId` (`src/routes/feedPostRoutes.js:519`) setting `status: 'live'`, or by being created live (`:203`). A live post's numbers cannot be edited there. **MEASURED.** **INFERRED:** that release is where a proposal hooks in (#2953).
- **Viral.**
  - `VIRAL_THRESHOLDS` (`src/services/feedEngagementService.js:21`) and `detectViralTier` (`:57`) work on likes or velocity.
  - `calculateVelocity` (`:48`) divides by wall-clock hours since `posted_at`. **MEASURED.**
  - **INFERRED:** on the story clock, phase 5 recomputes viral from the numbers shown at a story moment (#2955), not from wall-clock velocity.
  - No "flop" concept exists.

## §3 Episode results

- **Completion.** An episode completes through `POST /world/:showId/episodes/:episodeId/complete` (`src/routes/worldEvents.js:4777`), which calls `completeEpisode` (`src/services/episodeCompletionService.js:199`).
  - It returns early if the episode is already accepted (`:209`).
  - It locks the episode `FOR UPDATE` (`:389`).
  - It writes a `character_state_history` row (`:499`).
  - It commits, then runs non-blocking post-commit steps. **MEASURED.**
- **Tiers.** slay at 85 or more, pass at 65 or more, safe at 45 or more, fail below (`src/utils/evaluationFormula.js:29-32`). **MEASURED.**
- **INFERRED:** the episode follower change (#2956) is a further post-commit step. It writes a *proposal* only, never followers directly, because Evoni approves it, and it must never fail completion.

## §4 The Decision Log

- **What Evoni sees.** The Decision Log card (`frontend/src/components/Show/CastContinuity.jsx`) shows `decisionEntries` (`frontend/src/lib/castContinuity.js:72`), built from `character_state_history` through `GET /api/v1/world/:showId/history`. **MEASURED.**
- **A `followers` delta will show with no frontend change.**
  - `rowDeltas` keeps every numeric key in `deltas_json` (`frontend/src/lib/castContinuity.js:29-31`).
  - The card prints an unknown key as its name (`CastContinuity.jsx:120`, `STAT_SHORT[k] || k.replace(/_/g, ' ')`), so `{ "followers": 1200 }` reads "+1200 followers".
  - **MEASURED.**
- **`source`.**
  - `character_state_history.source` is a Postgres enum. Values were added by migration before (`src/migrations/20260219000007-csh-source-add-wardrobe-purchase.js:18`).
  - The history read accepts `computed`, `override`, `manual` and `wardrobe_purchase` as a filter (`src/routes/world.js:38`), and lists every row when unfiltered.
  - **MEASURED.** **INFERRED:** an approved follower change can use the existing `override` source (Evoni's decision), so no enum change is needed (ruling 3).
- **A separate table.** `decision_log`, the AI-training log written by `src/utils/decisionLogger.js`, is a different thing and is not used here.

## §5 Story-time granularity and the growth curve

The story clock has moments, not hours: after the episode 7, the day after 8, a week after 9, then the next episode (`src/services/storyClock.js:28-31`). **MEASURED.**

**INFERRED:** "grows over about two days of story time" (spec §8) becomes a step function of how many story moments have passed since the post's own moment. #2955 proposes:
- about 55% at its moment;
- 85% one moment later;
- 100% from two moments on.

## §6 Influence and charts

- **Influence.** `character_state.influence` is 0–10 (`src/models/CharacterState.js:28`), moved by episode rewards and manual edits. Nothing derives it from followers. Career tiers come from reputation. **MEASURED.** Ruling 4 leaves the follower-based Influence cut-offs to a later issue.
- **Growth tab.** It is a placeholder: "Phase 5 brings Growth …" (`frontend/src/pages/AdminPulse.jsx:34`). `recharts` (`frontend/package.json:33`) is already a dependency for its follower line. **MEASURED.**

## §7 What the build issues take from this

| Issue | Takes |
|---|---|
| #2952 | The ledger (ruling 1), starting counts (ruling 2) and `countAt` at a story moment (§1). |
| #2953 | Proposals on release (§2): factors from the ledger, post type, trend, episode tier and a fixed seed. Comments never proposed. |
| #2954 | Review's Accept, Adjust, Make it viral and Make it flop (§2). |
| #2955 | The step curve (§5) and viral at story time (§2). |
| #2956 | The post-commit proposal (§3), plus the ledger and an `override` history row (§4, ruling 3). |
| #2957 | The Growth tab (§6): count and tier, no Influence (ruling 4). |
