# Lala's Phone phase 7 read: growth

Date: 2026-11-04. Basis: `9f7ab26bddd070797f5f2de13a4133fb7b2428da` (origin/main). Read-only: no code, register, host, AWS, database or Cognito contact. Citations are `file:line` at that SHA. Each claim is **MEASURED** (read in code or migrations) or **INFERRED**.

This is Task #3125, the read for Lala's Phone spec §15 phase 7, **Growth** (`docs/design/2026-10-lalas-phone.md:97`): career unlocks, rival brands, phone states and the lock screen. The spec sections are:
- §9, Career unlocks (`:69-70`): as followers and Influence grow, abilities open (counter-offers, choosing between offers, an agent or manager who brings bigger deals, exclusive deals), with thresholds to be decided after real data;
- §6, Rival brands (`:50`): accepting one brand can annoy its rival (unfollow, shade, a pulled offer), and exclusivity clauses are real choices;
- §10, Phone states (`:72-73`): low battery, Do Not Disturb, cracked screen, new wallpaper as her arc changes, per beat;
- §2, Lock screen (`:17`): story-clock time, wallpaper, notification previews, usable as an episode opener;
- §16, Open decisions (`:100-103`).

It builds on the phase 4 read (`docs/reads/2026-10-14-phone-phase4-read.md`) and Evoni's rulings there (§6 of that read, `:333-351`), which this read does not reopen.

## 1. Summary

1. **The inputs to career unlocks exist** (MEASURED).
   - Followers can be read as of any story moment from the follower ledger.
   - Six audience tiers are worked out from the count.
   - Influence is a 0–10 stat, read per episode.
   - What does not exist is anything those inputs unlock.
2. **None of the four abilities is built** (MEASURED).
   - Counter-offers are a status label only (`negotiating`).
   - Several offers can be open at once, but nothing models choosing between them.
   - There is no agent or manager.
   - Exclusivity is free text copied into an event's restrictions and priced, but never enforced.
3. **Rival brands are partly built as data, not behaviour** (MEASURED).
   - Brands are Pulse accounts now (built since the phase 4 read).
   - One rivalry is written down (Velour Atelier ↔ Carte Blanche).
   - `rival` and `shade` are relationship kinds.
   - Nothing reacts when Lala accepts a rival's deal. There is no "pulled" offer, and per-brand trust (phase 4 ruling 6) is not built.
4. **Phone states and the lock screen are not built** (MEASURED).
   - The phone's status bar is fixed ("9:41", a full battery).
   - Story time has no time of day, so a lock-screen clock has nothing to show yet.
   - Notification previews exist as content areas. The lock screen's `style` is asked of the AI but never rendered.
5. **Nothing here needs a migration to start** (MEASURED for content types, INFERRED for the plan in §5).
   - Screens, content areas and opportunity statuses are STRING or JSONB.
   - Migrations are needed only for counter-offer rounds and per-brand trust, which belongs to phase 4.
6. **Order matters** (INFERRED). Rival-brand consequences depend on phase 4's per-brand trust and brand deals (phase 4 issues 7 and 9). Career unlocks wait on Evoni's thresholds. The device-side items (lock screen, phone states) depend on nothing and can go first.

## 2. What exists

### 2.1 Followers, the first input to unlocks
- **The ledger:** `PulseFollower` on table `pulse_followers` (`src/models/PulseFollower.js:12-30`; migration `src/migrations/20261012010000-create-pulse-followers.js`). Each row holds `story_order`, `change`, `count_after`, `cause` (start, episode, post, event, override) and `status` (proposed, accepted, rejected). MEASURED.
- **As of a moment:** `countAt` / `countsAt` return the latest accepted row at or before the story order (`src/services/pulseFollowers.js:100-121`, `atWhere` `:97`). `lalaStats.followersAt` / `statsAt` feed the home screen's stats panel (`src/services/lalaStats.js:81-105`). MEASURED.
- **Tiers:** `TIERS` / `tierFor` (`src/services/pulseAudience.js:19-38`): Emerging 0, Nano 1k, Micro 10k, Mid-tier 50k, Macro 250k, Mega 1M. The frontend has a copy at `frontend/src/lib/pulseAudience.js`. MEASURED.
- **Growth:** `growthOf` (`src/services/pulseGrowth.js:59-124`). MEASURED.

### 2.2 Influence, the second input
- **The stat:** `character_state` holds coins, reputation, `brand_trust`, influence and stress, all INTEGER (`src/models/CharacterState.js:22-29`), on a 0–10 scale (the comment at `:25`; migration `src/migrations/20260218100000-evaluation-system.js:36-60`). MEASURED.
- **How it moves:** `computeStatDeltas` gives influence +1 on slay or pass, 0 on safe, −1 on fail (`src/utils/evaluationFormula.js:280-335`). `applyDeltas` slows gains near the top (`:386-400`). MEASURED.
- **When it can be read:** per episode only, changing at the episode's "after" moment (order n×10+7; `src/services/lalaStats.js:9-12`). `pulseGrowth.influenceOf` reads it from the state history (`src/services/pulseGrowth.js:37-57`, Task #3066). MEASURED.
- **A season caveat:** `character_state` rows are per show, season and character, but `lalaStats.standingAt` (`src/services/lalaStats.js:62`) and `influenceOf` (`src/services/pulseGrowth.js:40`) read with `LIMIT 1` and no season. INFERRED: with two seasons' rows, which one is read is not defined. An unlock gate should read the current season's.
- **The one gate that exists:** `getAccessibleCareerTier` picks a career tier from **reputation** (`src/services/careerPipelineService.js:373-388`). Events can require `reputation_min` / `brand_trust_min` (`src/models/WorldEvent.js:314`). Nothing gates on followers or influence. MEASURED.

### 2.3 Offers, negotiation, agents and exclusivity
- **Negotiation:** `opportunities.status` is STRING(30) with `negotiating` in its flow (`src/models/Opportunity.js:31-35`; `STATUS_FLOW`, `src/routes/opportunityRoutes.js:32-44`). It is only a label: no counter terms, revised pay or rounds (grep `counter_offer|counterOffer|counter-offer`: none). MEASURED.
- **Brand-side authority:** `NEGOTIATE_LEVELS`, `SPEND_LEVELS`, `FINALIZE_LEVELS` (`src/constants/brandPersonalities.js:51-64`) describe what a brand's representative may do. They are used in prompts and as a gate on deal announcements ("Nothing here spends, negotiates or signs", `src/services/brandPulse.js:24-30`). MEASURED.
- **Several offers:** several opportunities can be open at once (`OPEN_STATUSES`, `src/services/beat14Opportunity.js:37`, `src/services/eventFlowService.js:26`). Nothing compares them or declines one because another was taken. MEASURED.
- **Unlocks today unlock goals, not abilities:** `Opportunity.unlocks` (JSONB, `src/models/Opportunity.js:73`). `CareerGoal.unlocks_on_complete` (`src/models/CareerGoal.js:36`) spawns opportunities (`spawnUnlockOpportunities`, `src/services/careerPipelineService.js:147-188`). MEASURED.
- **Agent or manager:** nothing. The only related data is the `management` relationship kind (`src/models/SocialProfileRelationship.js:38`). MEASURED.
- **Exclusivity:**
  - `Opportunity.exclusivity` is free TEXT (`src/models/Opportunity.js:67`).
  - It is copied to `world_events.restrictions` as `{ type: 'exclusivity' }` (`restrictionsFromOpportunity`, `src/services/eventTermsService.js:131-137`).
  - It has a price premium kind (`src/models/DealRatePremium.js:13`).
  - No service checks a conflict against it. MEASURED.

### 2.4 Rival brands
- **Brands are Pulse accounts** (built since the phase 4 read): `brandPulse.ensureAccounts` makes a `social_profiles` row per brand, linked by `full_profile.lalaverse_brand_id` (`src/services/brandPulse.js:9-12, 77-79`). Migration `20261018140000-brand-personalities.js` adds six draft representative characters (`:98-130`). MEASURED.
- **Rivalries are written down:**
  - `BRAND_RELATIONSHIPS` (`src/constants/brandPersonalities.js:153-156`) has Velour Atelier ↔ Carte Blanche as `rivals`, copied into `lalaverse_brands.personality.relationships` (migration `20261018140000`, `:41-49`).
  - It is read only into prompts: `brandVoiceBlock`, "HOW IT SEES THE OTHER HOUSES" (`src/services/brandPulse.js:156-175`), and `src/services/brandProfile.js:286`. MEASURED.
- **Profile relationships:** `social_profile_relationships.relationship_type` is a Postgres ENUM that includes `rival` and `shade` (`src/models/SocialProfileRelationship.js:24-42`). MEASURED.
- **Trust is one number, not per brand:** `character_state.brand_trust`, 0–10 (`src/models/CharacterState.js:27`). Phase 4 ruling 6 (0–100 per brand, starting at 50; `docs/reads/2026-10-14-phone-phase4-read.md:340-347`) has no code yet. `social_profiles.pulse_trust` (migration `20261019110000-add-pulse-trust.js`) is posting trust (review_all, trusted, full), not brand trust. MEASURED.
- **No pulled offer:** the statuses are offered, considering, negotiating, booked, preparing, active, completed, paid, archived, declined, expired, cancelled, plus `held` for beat 14 (`src/routes/opportunityRoutes.js:32-44`; migration `20261019140000-opportunity-offered-in-episode.js`). Grep `withdraw|rescind|pulled`: none in this sense. MEASURED.
- **Unfollow:** `pulseFollows.unfollow` soft-deletes the follow (`src/services/pulseFollows.js:49`). The follows table has no story time (`src/models/PulseFollow.js:11-17`), so "unfollowed at this beat" cannot be read. INFERRED from the model.
- **Phase 4 ruling 9:** rival consequences are proposals for Prime Studios' review, never applied automatically (`docs/reads/2026-10-14-phone-phase4-read.md:349`). Phase 4's proposed issue 9 already plans them (`:326-328`).

### 2.5 Phone states
- **Not present:** grep for battery, dnd, do_not_disturb, cracked, wallpaper and statusBar across `src/` and `frontend/src` finds nothing for the phone. The only hits are user presence (`presenceController.js:93`) and set walls (`sceneSpecService.js:267`). MEASURED.
- **The status bar is fixed:**
  - `PhonePreviewMode.jsx:406-418` draws "9:41" and lucide `BatteryFull`.
  - The server canvas draws the wall-clock time and "5G 🔋" (`src/services/phoneScreenRenderer.js:62-68`). MEASURED.
- **Per-beat hooks that exist:**
  - `phoneRuntime` conditions on `state`, `beatNumber` and `visitedScreens` (`src/services/phoneRuntime.js:29-40`), with `set_state` in the action allowlist (`src/utils/phoneConditionSchema.js:48-69`).
  - The `[UI:set_background]` cue is parsed (`src/utils/scriptBeatParser.js:541`).
  - Overlay types carry a `lifecycle` (permanent, per_episode, variant; migration `20260723000002-overlay-lifecycle.js:11-23`). MEASURED.
- **Device chrome:** the status bar and Back live in `frontend/src/components/PhonePreviewMode.jsx:404-418` and `frontend/src/components/phone/PhoneDevice.jsx:220-245`. MEASURED. That is where battery, DND and cracked-glass layers would go. INFERRED.

### 2.6 Lock screen
- **No screen, template or content type** (MEASURED).
  - The only hit is the AI fill prompt's `notifications → { style: 'lockscreen' | 'drawer' }` (`src/routes/phoneAIRoutes.js:230`).
  - `NotificationsRenderer` ignores `style` and reads only `max_items` and `bg` (`frontend/src/components/ScreenContentRenderer.jsx:705-735`).
- **Notification previews have data** (MEASURED):
  - The `notifications` content area reads `feed_moments` with `phone_screen_type === 'notification'` (`ScreenContentRenderer.jsx:713-715`; `src/models/FeedMoment.js:25-28`, STRING(30)).
  - `feed_notifications` derives "X commented on your status" lines from feed records (`notificationsFrom`, `ScreenContentRenderer.jsx:740` on).
  - `[UI:NOTIFY Sender: text]` is parsed (`src/utils/scriptBeatParser.js:546-566`).
- **The story clock has no time of day** (MEASURED). Story time is `episode_number * 10 + phase` (`src/services/storyClock.js:5-35`; `frontend/src/lib/storyClock.js:7-26`), labelled e.g. "During Ep 3". A lock-screen clock needs either a new source or the beat's scene set `time_of_day` (`src/models/SceneSet.js:108`). INFERRED.
- **Where story time reaches the phone:** `storyAt` reaches `PhoneDevice` (`:148, 192`) and `ScreenContentRenderer` (`:92, 123`). Only the Pulse renderers use it (`:393, 438`). MEASURED.

### 2.7 How a new phone piece is added (MEASURED)
- **Screen types:** rows in `ui_overlay_types`, `type_key` STRING(100) and `category` STRING(50) (`src/migrations/20260721000000-create-ui-overlay-types.js:16-32`).
- **Screens:** `assets` rows (`asset_type` STRING(100), `src/models/Asset.js:18`), with tap zones in `metadata.screen_links` and content areas in `metadata.content_zones` (`{ id, x, y, w, h, content_type, content_config, conditions }`).
- **Content areas:** saved by `PUT /:showId/content-zones/:assetId` (`src/routes/uiOverlayRoutes.js:749-776`). `contentZonesProblem` accepts any `content_type` string up to 60 characters (`:728-746`).
- **A new content type** touches:
  - the `CONTENT_TYPES` registry and `CONTENT_TYPE_MAP` (`frontend/src/components/ScreenContentRenderer.jsx:31-87`);
  - a `case` in `ContentZoneRenderer` (`:141-242`);
  - `CONTENT_AREA_KINDS` in `frontend/src/components/phone/ContentAreaPicker.jsx:17-26`, for the picker.
- **Runtime:** `src/services/phoneRuntime.js`, mirrored in `frontend/src/lib/phoneRuntime.js`.
- **ENUMs:** none blocks a new content type, screen or opportunity status. The one ENUM in reach is `social_profile_relationships.relationship_type`. Its existing `rival` needs no migration; a new kind would need `ALTER TYPE`.

### 2.8 Open decisions and earlier references
- **§16 "Career unlock thresholds" is still open** (`docs/design/2026-10-lalas-phone.md:101`; §9 at `:70`). No ruling doc settles it (grep `career unlock`, `unlock threshold` in `docs/`). The only other mention is `docs/design/2026-10-snippets-season-story.md:65`, which uses "career unlocks" as reward beats. MEASURED.
- **Earlier references to phase 7 items:**
  - `grep -rn "phase 7"` matches only The Pulse spec's phase 7 (`docs/reads/2026-10-12-pulse-world-depth-read.md`), not this one.
  - The phone phase 4 read covers rival brands in its gap table (`:194`), its issue 9 (`:326-328`) and ruling 9 (`:349`).
  - No code TODO mentions the lock screen, battery, DND or rivals. MEASURED.
- **Open GitHub issues:** this read had no GitHub access while measuring. The session that opened it found no open `claude-task` issue on phone phase 7 among the 19 open on 2026-11-03 (the `/close-loop` sweep). INFERRED from that list.

## 3. Gap: each spec item

| Spec item | Status | Evidence |
|---|---|---|
| **§9** Inputs to unlocks (followers, Influence as of a moment) | Built | §2.1, §2.2 |
| §9 Counter-offers | Not built | `negotiating` is a label only (`src/routes/opportunityRoutes.js:32-44`) |
| §9 Choosing between multiple offers | Not built | several open at once, no choice (`src/services/beat14Opportunity.js:37`) |
| §9 An agent or manager who brings bigger deals | Not built | only the `management` relationship kind (`src/models/SocialProfileRelationship.js:38`) |
| §9 Exclusive deals | Partly built | free-text exclusivity copied to restrictions and priced, never enforced (`src/services/eventTermsService.js:131-137`, `src/models/DealRatePremium.js:13`) |
| §9 Abilities opening as followers and Influence grow | Not built | the only gate is reputation → career tier (`src/services/careerPipelineService.js:373-388`) |
| **§6** Rival annoyed: unfollow, shade, pulled offer | Partly built | the rivalry is data (`src/constants/brandPersonalities.js:153-156`); `rival` / `shade` kinds (`src/models/SocialProfileRelationship.js:24-42`); `unfollow` (`src/services/pulseFollows.js:49`); no trigger, no `pulled` status, no per-brand trust |
| §6 Exclusivity clauses as real choices | Not built | nothing checks a conflict (§2.3) |
| **§10** Low battery, Do Not Disturb, cracked screen | Not built | fixed status bar (`frontend/src/components/PhonePreviewMode.jsx:406-418`, `src/services/phoneScreenRenderer.js:62-68`) |
| §10 New wallpaper as her arc changes | Not built | no wallpaper anywhere (§2.5); `[UI:set_background]` is parsed (`src/utils/scriptBeatParser.js:541`) |
| **§2** Lock screen: story-clock time | Not built | story time has no time of day (`src/services/storyClock.js:5-35`) |
| §2 Lock screen: wallpaper | Not built | §2.5 |
| §2 Lock screen: notification previews | Partly built | `notifications` / `feed_notifications` content areas (`frontend/src/components/ScreenContentRenderer.jsx:705-740`); `style: 'lockscreen'` never rendered |
| §2 Lock screen: usable as an episode opener | Not built | INFERRED: possible today only as an ordinary screen with a notifications area |

## 4. Design notes (INFERRED, for the issues in §5)

- **Phone states belong to the device, not to a screen.** They are chrome over every screen: battery and DND in the status bar, cracked glass over the glass. The script already carries per-beat phone cues, so a `[PHONE: battery=12 dnd=on cracked=on]` cue read at each beat fits the spec's "one phone; the world as of the beat" (§1 rules 1, 2 and 4), with no stored per-episode copy. Rule 4 (no timings) holds, because a state lasts until the next cue changes it.
- **The lock screen is a screen, with a time it can actually show.** Story time has no hour, so the lock screen's clock should show what exists: the beat's scene set `time_of_day` when there is one, else no time (the date line can carry the story label). An hour would be a new story field, Evoni's call ([decide] D2).
- **Wallpaper "as her arc changes"** fits the show's existing JSONB metadata: a list of `{ from_episode, asset_id }` used by the lock screen and home screen, chosen in the Phone Hub. No migration (INFERRED: `shows.metadata` is JSONB, as `careerListService` uses it for `career_hidden_brands`).
- **Unlocks are a read, not a store.** An `unlocksAt(show, at)` service can compute which abilities are open from followers (tier) and Influence at a moment, against thresholds kept in show metadata. Each ability then checks it. Until Evoni sets thresholds (§16), every ability can stay closed, or open as she chooses ([decide] D1).
- **Rival brands wait for phase 4.** The consequences need per-brand trust (phase 4 ruling 6, its issue 7), brand deals on opportunities (its issues 1–3) and the proposals review (its issue 9). Phase 7 adds only:
  - the trigger, when a rival's deal is accepted;
  - the `pulled` offer state, a new string status needing no migration;
  - exclusivity checked as a real conflict.

## 5. Proposed issues, in order (plan only; none opened)

Each is sized for one phone-reviewable PR. "No migration" means every column touched is STRING or JSONB (§2.7).

1. **Phone states, part 1: the cue and the state at a beat** (backend). No migration.
   - Add `[PHONE: battery=<0-100> dnd=<on|off> cracked=<on|off>]` to the script cue vocabulary, in `src/utils/scriptBeatParser.js` and its validation list.
   - Add `phoneStateAt(script, beat)` in a new `src/services/phoneStates.js`: each state holds from its cue until changed, with defaults of full battery, DND off and no crack.
   - Expose it beside the phone's existing per-beat data.
   - Tests: unit tests for the parser and for `phoneStateAt` (carry-over, reset, defaults).
2. **Phone states, part 2: the chrome** (frontend and the server canvas). No migration.
   - The status bar shows the beat's battery level (low below 20%) and a DND moon; a cracked-glass layer sits over the screen.
   - Files: `frontend/src/components/phone/PhoneDevice.jsx`, `frontend/src/components/PhonePreviewMode.jsx`, `src/services/phoneScreenRenderer.js` (the "5G 🔋" bar), plus one CSS file.
   - Tests: vitest for the chrome at each state; a render test for the canvas bar. Test at 375px.
3. **Wallpaper by arc** (both). No migration.
   - Add `shows.metadata.phone_wallpapers: [{ from_episode, asset_id }]`, with a picker in the Phone Hub (`UIOverlaysTab`).
   - Add `wallpaperAt(show, episodeNumber)` and use it behind the home and lock screens.
   - Tests: unit tests for `wallpaperAt`; vitest for the picker.
4. **The lock screen** (frontend, small backend). No migration. Depends on issues 2 and 3.
   - Add a `lock_screen` content type: the time (the beat's scene set `time_of_day`, or none; see D2), the story label, the wallpaper, and notification previews from the existing `notifications` / `feed_notifications` sources.
   - Render the `style: 'lockscreen'` the AI fill already asks for.
   - Files: `frontend/src/components/ScreenContentRenderer.jsx` (registry and `ContentZoneRenderer`), `frontend/src/components/phone/ContentAreaPicker.jsx`.
   - Tests: vitest for the renderer and as an episode opener (first beat).
5. **Career unlocks, the gate** (backend). No migration. **Blocked on D1** (thresholds).
   - Add `unlocksAt(models, showId, at)` in a new `src/services/careerUnlocks.js`: abilities `counter_offer`, `choose_offers`, `agent`, `exclusive_deals`, opened by follower tier and/or Influence as of the moment.
   - Thresholds live in `shows.metadata.career_unlocks`, all closed until set.
   - Read the current season's `character_state`, not `LIMIT 1` (§2.2).
   - Shown read-only on the Career list.
   - Tests: unit tests for thresholds, closed by default, and as of a moment.
6. **Exclusivity as a real choice** (backend and the opportunity UI). No migration if the structured terms live in the deal's existing JSON restrictions (INFERRED; confirm at build).
   - Replace free-text exclusivity with `{ category, until }`.
   - On accepting an offer, list the open offers it would conflict with, and refuse an accept that breaks an active exclusivity unless overridden with a reason.
   - Files: `src/services/eventTermsService.js` (`restrictionsFromOpportunity`), `src/routes/opportunityRoutes.js`.
   - Tests: unit tests for the conflict check; an integration test for accept.
7. **Choosing between offers** (backend and UI). No migration. Depends on issue 5.
   - Offers in the same choice set (`opportunities` JSONB, e.g. `unlocks.choice_set`; INFERRED) are shown side by side. Accepting one declines the others with a reason.
   - Tests: unit and vitest.
8. **Counter-offers** (backend and UI). **Needs a migration**: a new `opportunity_negotiations` table (`id, opportunity_id, round, offered_terms JSONB, countered_terms JSONB, outcome, story_order, deleted_at`) under `src/migrations/`. Depends on issue 5.
   - Rounds while `negotiating`; the brand side's answer is drafted for Evoni's approval, within the brand's `NEGOTIATE_LEVELS` (`src/constants/brandPersonalities.js:51-64`).
   - Tests: integration tests for rounds and the accepted terms becoming the deal's.
9. **An agent or manager** (both). No migration (a registry character with a role label, linked to Lala by a `management` relationship). Depends on issues 5 and 8, and on phase 4's offer drafting.
   - Once unlocked, offers can be drafted through the agent, larger and from bigger brands, for Evoni's approval.
   - Tests: unit tests for drafting through the agent.
10. **Rival brands: the trigger and the pulled offer** (backend). No migration. Depends on phase 4 issues 1–3, 7 and 9.
    - When a deal with a brand is accepted, for each `BRAND_RELATIONSHIPS` / `rival` brand, create a **proposal** (phase 4 ruling 9): an unfollow, a shade post or comment drafted in its voice, a `pulled` status on its open offer, or a trust change.
    - Nothing is applied until Evoni approves.
    - Tests: unit tests that proposals are made and nothing changes until approved.

## 6. Decisions for Evoni [decide]

- **D1. Career unlock thresholds** (spec §16). Which follower tier and/or Influence level opens each ability: counter-offers, choosing between offers, an agent, exclusive deals. Until set, should they all stay closed, or all open? Issue 5 builds the gate; the numbers are hers.
- **D2. The lock screen's time.** Story time has no hour. Options:
  - show the beat's scene set time of day ("Evening");
  - add a story-time hour per beat (a new field, likely a script cue);
  - show no time, only the story label.
- **D3. Phone states as script cues.** Is `[PHONE: battery=… dnd=… cracked=…]` the right way to set them per beat, or should they be set in the Phone Hub per episode?
- **D4. Wallpaper by arc.** Keyed by episode number (from episode N on), or by season arc?
- **D5. Does exclusivity block or warn?** Should accepting an offer that breaks an active exclusivity be refused (with an override), or only warned?
- **D6. The agent or manager.** One recurring character, or chosen when unlocked? Does the agent take a cut of the pay (a Bank row)?
- **D7. Order against phase 4.** Rival brands (issue 10) waits on phase 4's per-brand trust and brand deals, which are not built yet. Should phase 7 start with the device items (issues 1–4) while phase 4 is built?

## 7. Rulings (Evoni, 2026-11-04)

Recorded as given. Approving these rules does not approve merging, deploying, migrating or starting all ten issues.

- **D1. Career unlocks.** Use the existing six audience tiers plus Influence:
  - choose between offers: Tier 2 + Influence 2;
  - counter-offers: Tier 3 + Influence 3;
  - exclusive partnerships: Tier 4 + Influence 5;
  - talent agent: Tier 5 + Influence 7.
  
  All start locked. Once earned, an unlock stays available for the season. Use the existing audience-tier definitions and do not invent follower counts. Check whether the existing Influence scale and historical state support these thresholds before implementation.
- **D2. Lock-screen time.** An optional story-time cue with an actual hour and minute, carried forward until changed. Never the viewer's device clock. The scene set's time of day is supporting context, not the authoritative clock.
- **D3. Phone states.** Script cues are the canonical source; the Phone Hub provides a visual authoring interface. Battery, DND and cracked glass persist until changed or explicitly reset. Define episode carryover and reset behaviour before coding.
- **D4. Wallpaper.** Defaults by season arc, with optional episode-specific overrides. Reuse existing approved wallpaper assets.
- **D5. Exclusivity.** Block acceptance of conflicting deals while enforceable exclusivity is active. Show the conflict, its duration and the affected brands. A resolution, or an explicitly authorized and recorded override, is required. Never silently accept a conflicting deal.
- **D6. Agent.** One recurring talent-agent character.
  - Proposed commission: 10% of eligible negotiated deal payments, recorded as a separate Prime Bank ledger entry.
  - No commission on ordinary gameplay rewards.
  - Agent recommendations and negotiated offers need Evoni's approval.
  - The agent's identity and personality are not invented yet: character options come to Evoni before the character is created.
- **D7. Order.** Phase 7 starts with device issues 1–4 while phase 4 continues. Rival-brand consequences (issue 10) stay blocked until their phase 4 dependencies are complete.

## 8. The rulings against the code (checked 2026-11-04, same basis)

**Fits as ruled (MEASURED):**
- **D1, Influence can reach every threshold.**
  - `applyDeltas` rounds diminished gains up (`Math.ceil`, `src/utils/evaluationFormula.js:386-400`), so +1 stays +1 at 5–7 and 8–9, and gains stop only at 10.
  - Influence moves at most about one step per episode (`computeStatDeltas`, `:280-335`) and starts at 1 (`src/models/CharacterState.js:28`).
  - So Influence 5 takes at least 4 net successful episodes and Influence 7 at least 6. INFERRED: the agent unlock is an end-of-season goal on the current formula.
- **D1, the history supports "earned".** Followers are a ledger with story order (`pulse_followers`), and Influence has per-episode history (`character_state_history`, read by `pulseGrowth.influenceOf`, `src/services/pulseGrowth.js:37-57`). So "earned at any point this season" can be computed from history, with nothing new stored. INFERRED.
- **D4, season arcs exist.** `ShowArc` has `season_number`, `episode_start` and `episode_end` (`src/models/ShowArc.js:21-36`), so an episode's arc is the one whose range contains its number.
- **D6, the ledger needs no migration.** `financial_transactions` has string `type`, `category`, `source_type` and `status` and a JSONB `metadata` (read from the migrated test schema). An `agent_commission` row fits. Phase 4 ruling 5's pending and paid states apply to it.

**Conflicts with existing code or canon:**
- **C1. The tiers are not numbered anywhere** (`src/services/pulseAudience.js:19-26` has keys and labels only). Two tier systems exist:
  - the six computed tiers (Emerging, Nano, Micro, Mid-tier, Macro, Mega);
  - the stored four-value `social_profiles.follower_tier` ENUM (micro, mid, macro, mega; `docs/reads/2026-10-12-pulse-decisions-read.md:50`).
  
  "Tier 2" is Nano if Emerging is Tier 1, or Micro if Emerging is Tier 0, and the agent's "Tier 5" is Macro or Mega accordingly. See Q1.
- **C2. Every opportunity must pass through `negotiating` to be booked** (`STATUS_FLOW`, `src/routes/opportunityRoutes.js:32-44`: considering → negotiating → booked). With counter-offers locked until Tier 3, every accepted offer still "negotiates" today. See Q2.
- **C3. Influence is not per season today.** Evaluation passes `seasonId = null` (`src/routes/evaluation.js:318`, a standing TODO), so `character_state` has one row per show, and `standingAt` / `influenceOf` read it with `LIMIT 1`. "For the season" therefore has to come from the episodes' arc (`ShowArc`), not from `character_state.season_id`. See Q3.
- **C4. There are no wallpaper assets.** No asset type, tag or screen uses "wallpaper" (grep over models, routes, services, constants and the phone components). `[UI:set_background]` is only a parser alias with no reader (`src/utils/scriptBeatParser.js:541`). Assets carry an `approval_status` (`src/models/Asset.js:115`). "Existing approved wallpaper assets" therefore has no pool yet. See Q4.
- **C5. Exclusivity is free text** (`Opportunity.exclusivity`, `src/models/Opportunity.js:67`), with no brands, category or duration, so nothing is "enforceable" yet. Event-hosted deals are accepted at Start Episode (the terms lock), not through an opportunity. See Q5.

## 9. Implementation decisions still open (before building)

- **Q1 (D1) — tier numbering.** Is Emerging Tier 1, making Tier 2 = Nano (1k) and the agent's Tier 5 = Macro (250k)? Or is it Tier 0, making Tier 2 = Micro (10k) and Tier 5 = Mega (1M)?
- **Q2 (D1, C2) — the negotiating step.** While counter-offers are locked, should an offer go considering → booked directly, with `negotiating` reachable only once unlocked? Or should `negotiating` stay as a plain "discussing" step and counter-offer rounds be gated separately?
- **Q3 (D1, C3) — what "the season" is.** Is it `ShowArc.season_number`, with the episodes in that season's arcs? And should a new season start every unlock locked again?
- **Q4 (D4, C4) — which assets can be wallpaper.** With no wallpaper assets: should any approved image asset be choosable, with "wallpaper" recorded as a tag in its metadata? Or should a wallpaper asset type be added (a string, no migration)?
- **Q5 (D5, C5) — enforceable exclusivity.**
  - Its shape: the brands or category it excludes, and its duration in story time (episodes) or by date.
  - Where the block applies: accepting an opportunity (`advance` to booked), Start Episode for an event-hosted deal, or both.
  - Who may override, and where the record lives (the opportunity's JSON with the reason, the time and who).
- **Q6 (D2) — the time cue.** Its form (e.g. `[TIME: 21:40]`), and whether it carries across episodes or resets at each episode's start.
- **Q7 (D3) — carryover and reset.** The ruling asks for this before coding. For example:
  - battery and DND reset to full and off at each episode start, while a cracked screen carries until a `[PHONE: repaired]` cue;
  - or everything carries until changed;
  - plus the explicit reset cue's form.
  
  Does the Phone Hub's visual authoring write the cue into the script (so the script stays canonical)?
- **Q8 (D6) — eligible payments.** Which payments are "negotiated": the deals the agent negotiated (counter-offer rounds), or every brand deal once the agent is unlocked? Is commission booked when the deal is paid (the pending → paid ledger state), and is it refunded if the deal is reversed?

## 10. Rulings on §9, round two (Evoni, 2026-11-04)

Recorded as given. They answer Q1–Q8. No implementation, migration, merge, deployment or production write is approved by them.

- **R1. Audience tiers.**
  - Emerging is Tier 1, Nano 2, Micro 3, Mid-tier 4, Macro 5, Mega 6.
  - The six-tier follower scale (`pulseAudience.tierFor`) is authoritative, not the older four-tier `follower_tier` field.
  - Each ability needs both its tier and its Influence:

    | Ability | Tier | Influence |
    |---|---|---|
    | Choose offers | 2 (Nano) | 2 |
    | Counter-offers | 3 (Micro) | 3 |
    | Exclusive partnerships | 4 (Mid-tier) | 5 |
    | Talent-agent services | 5 (Macro) | 7 |

  - An agent character may appear earlier in the story without providing representation services.
- **R2. Negotiation.**
  - considering → booked is allowed when Lala accepts an offer's existing terms.
  - `negotiating` is required only when terms are changed or countered.
  - Every acceptance path still enforces permissions, deal conflicts and required approval.
- **R3. Seasons.**
  - The season is `ShowArc.season_number`.
  - Unlocks are earned from qualifying follower and Influence history and stay available once earned, into later seasons. They never reset at a season boundary.
  - Global Influence is not confused with a season-specific record.
- **R4. Wallpaper.**
  - Existing approved image assets can be tagged for phone-wallpaper use, with no duplicate files and no new asset type unless a technical constraint forces one.
  - Defaults by season arc, with episode overrides.
- **R5. Exclusivity.**
  - Structured terms:
    - brand or category scope;
    - named competitors where they apply;
    - a story start and end;
    - optional real-world dates;
    - the source agreement;
    - approved exceptions.
  - Validated at opportunity acceptance and at Start Episode for event-hosted deals.
  - Only Admin/Prime approves an override, with an explicit reason and an auditable record.
  - Legacy free-text restrictions are kept as **Needs Terms Review** until reviewed, never silently converted or ignored.
- **R6. Story time.**
  - `[TIME: HH:MM]` is in-world local story time.
  - It carries across beats and resets to the episode's configured opening time at each episode.
  - With none, the lock screen shows an unset state; no time is invented.
  - Explicit day changes are supported.
- **R7. Phone state.**
  - `[PHONE: battery=12 dnd=on cracked=on]`, with explicit reset cues.
  - Battery and DND persist within the episode, then return to the next episode's configured defaults.
  - A cracked screen persists across episodes until repaired or explicitly cleared.
  - Wallpaper follows arc defaults with episode overrides.
  - The Phone Hub visually authors and validates the same canonical script cues. It is not a second state source, and it respects script versioning and the approval rules.
- **R8. Agent commission.**
  - 10% of eligible brand-partnership payments, on agreements where the agent was assigned before finalization.
  - Includes eligible appearance fees and paid deliverables. Excludes gameplay rewards, gifts and unrelated earnings.
  - Recorded only when payment is received.
  - Partial payments are handled proportionally.
  - A reversal posts a compensating ledger entry; history is never deleted.
  - Duplicate charges are prevented.

## 11. Round two against the code and the phase 4 rulings (checked 2026-11-04)

**Consistent (MEASURED unless marked):**
- **R1.** `tierFor` (`src/services/pulseAudience.js:28-36`) already returns the six tiers in order. The tier number is the index + 1, with nothing stored.
- **R1/R3, Influence.** Influence reaches 2, 3, 5 and 7 under the current formula (§8): at least 1, 2, 4 and 6 net successful episodes from the default of 1. INFERRED: at about one step per episode, the agent's Influence 7 is mid-to-late season at the earliest.
- **R1/R3, "earned".** Followers (`pulse_followers`, by story order) and Influence (`character_state_history`, per episode) are both history, so "first reached tier T and Influence I" is computed, and "never resets" needs nothing stored. INFERRED.
- **R2.** Matches phase 4 ruling 4 (Prime confirms acceptance on the offer record). The change is one edge in `STATUS_FLOW` (`src/routes/opportunityRoutes.js:32-44`) plus a check on the `advance` route (`:235`).
- **R4.** `assets.metadata` is JSONB (`src/models/Asset.js:126`) and `approval_status` is a string (`:115`). A `metadata.phone_wallpaper` tag needs no new type and no migration. `ShowArc` gives the arc by episode range (`src/models/ShowArc.js:21-36`).
- **R8, coin rounding.** Prime Coins are whole, rounded half away from zero (`src/utils/wholeCoins.js`), so 10% of 25 is 3.
- **R8, de-duplication.** Payouts already de-duplicate by `category` + `source_id` (`src/services/dealPayoutService.js:153`). A commission can do the same against the payment row it is charged on.

**Contradictions and gaps:**
- **K1. Chronology: clock time and day are not story order.**
  - Story order is `episode × 10 + phase` (`src/services/storyClock.js:5-35`). Everything that is "as of" (followers, reveals, comments) and R5's story start and end sit on that order.
  - `[TIME: HH:MM]` and day changes (R6) would be a second, finer clock that orders nothing.
  - INFERRED: keep them as display (the lock screen) and never as an ordering key. Exclusivity's story start and end are story orders (episode and phase), not clock times.
  - Otherwise a TIME cue earlier in the day, later in the script, would contradict the story order. Recommended rule: the clock never orders events; the story order does.
- **K2. "Configured" opening time and phone defaults have no home.**
  - Episodes have no settings field for them. The JSON fields are snapshots or other things: `season_context`, `money_plan`, `setup_status`, `script_locked_beats`, `script_line_keys`, `evaluation_json`, `distribution_metadata`, `browse_pool_json`, `title_overlay_style` (`src/models/Episode.js`).
  - R7 also says the script cues are canonical.
  - INFERRED, recommended: the configured value *is* a cue on the episode's opening beat (`[TIME: 08:30]`, `[PHONE: battery=100 dnd=off]`), with a show-wide default in `shows.metadata` for episodes without one. No migration, and a single source. See T1.
- **K3. "When payment is received" needs phase 4's pending and paid rows.**
  - Today every payout is booked straight to `executed` at approval or at Complete (`src/services/dealPayoutService.js:154-164`). Nothing writes `pending` (phase 4 read §2.4).
  - Phase 4 ruling 5 (real pending and paid rows) is unbuilt.
  - Until it is, "received" can only mean "booked". The commission issue therefore depends on phase 4 issue 5.
- **K4. Reversals have no mechanism.** The ledger has no reversal or compensating-entry path today: grep `revers|refund|compensat` in `financialTransactionService` / `dealPayoutService` finds none. The commission's compensating entry would be the first. It should follow a shape phase 4 issue 5 sets for payment reversals, not invent its own. See T5.
- **K5. Partial payments and rounding drift.** Each fee and deliverable payout is its own ledger row, so a deal is "paid" in parts. Rounding 10% per row can drift from 10% of the whole: three rows of 5 coins give 1+1+1 = 3, not 2. See T6.
- **K6. Structured exclusivity and the agent assignment have no field.**
  - `Opportunity.exclusivity` is TEXT (`src/models/Opportunity.js:67`).
  - The model's JSONB columns all have other meanings: `status_history`, `deliverables`, `wardrobe_brief`, `content_requirements`, `unlocks`, `feed_reactions`, `content_generated` (`:36-100`).
  - The event side keeps `world_events.restrictions` (JSON).
  - R5's structured terms, its exceptions and overrides, and R8's "agent assigned before finalization" need a home on the agreement. See T2.
- **K7. The source agreement.**
  - R5's "source agreement" is either the opportunity, or the event's offer letter / partnership agreement (`canon_consequences.documents.offer_letter`, #3695).
  - Phase 4 ruling 2 says deals belong to brands and events keep their hosts. But the current `to-event` route makes the brand the event's host (`careerPipelineService.js:213-216`, phase 4 read §1).
  - Exclusivity validation at Start Episode reads the event's deal as it is today. Phase 4 issues 1–3 will change where a brand deal lives, so the event-side check may need revisiting then.
- **K8. Unlocks at a beat.** Influence changes only at an episode's "after" moment (order n×10+7, `src/services/lalaStats.js:9-12`). An ability can open mid-episode on followers, but its Influence half only between episodes. This is consistent with R1, noted so the phone shows it right.

## 12. Two tracks and their order (plan; nothing started)

**Device track** (phase 7 issues 1–4). No phase 4 dependency, and no migration on the recommendations below.
1. **Cues and story state.** `[PHONE: …]` with reset and repair cues, and `[TIME: HH:MM]` with a day change, parsed and validated. Then `phoneStateAt` / `storyTimeAt`:
   - battery and DND per episode, from the opening-beat cue or the show default (T1);
   - cracked carried across episodes in episode order until repaired or cleared;
   - time carried across beats, reset per episode, unset when none.
   - Tests: carry-over, reset, the episode boundary, unset.
2. **The chrome.** Battery, DND and cracked glass on `PhoneDevice` / `PhonePreviewMode` and the server canvas, read from item 1. Never the device clock.
3. **Wallpaper.** Approved image assets tagged `metadata.phone_wallpaper`. Arc defaults keyed to `ShowArc` and episode overrides (where they are stored is T3). A picker in the Phone Hub.
4. **The lock screen.** A `lock_screen` content type: the story time (or unset), the wallpaper, and notification previews.
5. **Phone Hub authoring** of the item 1 cues, writing into the script through the existing script save, so it respects versions, locks and approval. Ordered last because it writes scripts.

**Deal track** (phase 7 issues 5–9).
1. **The unlock read** (`unlocksAt`): R1 thresholds on tier number and Influence history. No migration. Can start once approved; it changes nothing by itself.
2. **considering → booked (R2)** with the permission check on `advance`. No migration. Needs item 1 for the "choose offers" gate.
3. **Structured exclusivity (R5)**: terms, Needs Terms Review for legacy text, the block at acceptance and at Start Episode, the Admin override record. **Needs a migration** under T2. After item 1, and alongside phase 4 issues 1–3 (K7).
4. **Choosing between offers.** After items 1–2.
5. **Counter-offers.** The `opportunity_negotiations` table: **migration**. After item 2.
6. **The agent.** Character options brought to Evoni first; nothing created before she chooses. Assignment on the agreement (T2). **Commission waits for phase 4 issue 5** (pending and paid rows, K3) and the reversal shape (K4).
7. **Rival brands (issue 10).** Blocked until phase 4 issues 1–3, 7 and 9 are done (D7).

## 13. Technical decisions still open

- **T1. Episode defaults (K2).** Is the "configured" opening time and phone default the opening beat's cue, with a show-wide default in `shows.metadata` (recommended; no migration, script canonical)? Or a per-episode settings field (a migration)?
- **T2. Where deal terms live (K6).** One new JSONB column on `opportunities`, e.g. `deal_terms`, holding the structured exclusivity, approved exceptions, overrides and the agent assignment. The TEXT `exclusivity` stays as the legacy value marked Needs Terms Review. This is a migration (recommended), versus overloading an existing JSONB column (not recommended). Event-hosted deals keep `world_events.restrictions`, extended to the same shape.
- **T3. Where wallpaper defaults live.** `shows.metadata.phone_wallpapers` (arc id → asset, and episode number → asset), recommended, no migration. Or a field on `ShowArc` and on episodes (migrations).
- **T4. Chronology (K1).** Confirm the rule: story order orders everything; `[TIME]` and day changes are display only. Exclusivity's start and end are story orders, with real-world dates kept as information.
- **T5. Reversal shape (K4).** The compensating commission entry follows the payment-reversal shape phase 4 issue 5 sets. Should phase 4 issue 5 define reversals for all deal payments first?
- **T6. Commission rounding (K5).** Charge cumulatively, so that on each payment the commission is 10% of everything received so far minus commission already charged (no drift; recommended)? Or round per payment row?

## 14. Rulings on §13 (Evoni, 2026-11-04)

Recorded as given. They approve the **device track's read and display stages only** (§16 stages 1–4). Phone Hub script-writing is a separate, later gate. The deal track, migrations, production writes, feature-flag and worker changes are not approved.

- **T1, episode defaults (approved with refinement).**
  - Show-wide phone defaults are the fallback. Explicit opening-beat script cues are episode overrides, and later cues change things within the episode.
  - Persistent physical conditions (cracked glass) carry over from the previous episode unless explicitly repaired or reset. Temporary conditions (battery, DND) reset to the episode defaults.
  - No time is invented when none is configured.
  - The script is the canonical source for story-time and phone-state changes, with no conflicting second editor.
- **T2, structured deal terms (approved provisionally).**
  - A validated, versioned structured schema for exclusivity, exceptions and agent assignment.
  - The original contracting brand is kept separately from the event host.
  - Contractual overrides have an auditable, append-only history. If the existing audit infrastructure cannot support that, the smallest additional storage is proposed before overrides are built.
  - Legacy free-text terms are kept and marked Needs Terms Review.
  - No migration yet.
- **T3, wallpaper (approved).** Existing show settings hold the arc defaults and the episode overrides. They reference approved asset ids, never duplicated files. Unavailable or revoked assets are handled safely.
- **T4, chronology (approved).** Episode and beat order are authoritative for story chronology. Phone clock time is display only and never decides deal, payment or career-event order.
- **T5, reversals (approved).** Wait for phase 4 to establish payment states and reversible ledger accounting. Agent commissions use those same rules, with no separate commission-only reversal mechanism.
- **T6, commission rounding (approved).**
  - Commission due = round_half_up(10% × cumulative eligible paid amount) − commission already charged, per eligible agreement.
  - Partial payments, reversals and idempotency use stable payment identities and the existing Prime Bank rounding (`wholeCoins`).

## 15. The device stages: verified code boundaries (origin/main `3bb080aa`, 2026-11-04)

All MEASURED at `3bb080aa` unless marked.

- **Cues are parsed in one place.** `parseScript` matches each own-line tag with its own regex branch and collects the cues: `[WEAR:]`, `[DELIVER:]`, `[TODO_MODE:]`, `[LEARNS:]` (`src/utils/scriptBeatParser.js:343-367`). `[PHONE:]` and `[TIME:]` follow the same pattern.
- **The frontend keeps its own list of app tags.**
  - `APP_TAG` in `frontend/src/lib/scriptImport.js:187` lists every app cue (`UI|WEAR|STAT|…|TODO_MODE|LEARNS|…`). A cue missing from it is treated as script text on import.
  - `frontend/src/lib/scriptHealth.js:139` flags cues that do nothing.
  - `frontend/src/lib/scriptMoments.js:620-628` reads cues for the Script tab.
  
  New cues are registered in all three.
- **State at a position already has a pattern.**
  - `lalaKnowledge.knowledgeTimeline` (`src/utils/lalaKnowledge.js:95-140`) turns cues into state at a `{ beat, line }` position, with `comparePositions` (`:60`) and an `issues` list for invalid cues.
  - The script is split by `scriptBeats` (`src/utils/scriptWear.js:44`).
  - `getTodoAt` (`src/services/dealChecklistService.js:62`) serves state at a beat and line, behind `GET /episodes/:episodeId/todo/at?beat=&line=` (`src/routes/todoListRoutes.js:47`).
- **The phone already knows the beat.** `PhoneDevice` takes `episodeId`, `storyAt` and `beat` (`frontend/src/components/phone/PhoneDevice.jsx:19-20, 147-148, 191-193`).
- **The status bar.**
  - `PhonePreviewMode.jsx:404-418` draws "9:41" and a fixed `BatteryFull`.
  - `PhoneDevice.jsx` draws no status bar: its built-in frame has the Dynamic Island, and a custom frame image carries its own chrome (`:215-245`).
- **The server canvas uses the real clock, but nothing calls it.** `src/services/phoneScreenRenderer.js:62-68` draws the server's wall-clock time and "5G 🔋". No file in `src/`, `frontend/src` or `tests/` references `phoneScreenRenderer`. Stage 2 therefore leaves it alone. Removing or fixing a dead module is a separate cleanup (B3).
- **Screens are flat images.** `PhoneDevice` draws the screen as one `<img src={phoneScreen.url}>` (`:166-185`), with content areas over it. There is no background layer for a wallpaper to sit in (B1).
- **Approval.** `assets.approval_status` takes `approved`, `pending` or `rejected`, and rejection also soft-deletes (`deleted_at = NOW()`). `assets.metadata` is JSONB (`src/models/Asset.js:115, 126`). "Revoked or unavailable" therefore means not `approved`, or `deleted_at` set, or missing.
- **Arcs.** `ShowArc` has `season_number`, `episode_start` and `episode_end` (`src/models/ShowArc.js:21-36`).
- **Event times are not the device clock.** `ScreenContentRenderer.jsx:1408` formats an event's own `start_datetime`, so it is not affected.

**Regression tests in reach:**
- Parser: `tests/unit/utils/scriptParser.test.js`, `scriptBeatParser.phoneMessages.test.js`, `scriptBeatParser.boldSpeakers.test.js`, `scriptChecks.test.js`, `scriptTodo.test.js`, `scriptWearCue.test.js`.
- Timelines: `tests/unit/utils/lalaKnowledge.test.js`.
- Frontend script libraries: `frontend/src/lib/scriptExport.test.js`, `scriptMoments.deal.test.js`.
- Phone: `frontend/src/components/phone/PhoneDevice.test.jsx`, `PhoneDevice.contentProps.test.jsx`, `ContentAreaPicker.test.jsx`, the eight `PhonePreviewMode.*.test.jsx`, and the `ScreenContentRenderer.*.test.jsx` files (16 phone and renderer tests in all).
- Runtime: `tests/unit/services/phoneRuntime*.test.js`, `storyClock.test.js`.

## 16. Proposed PRs (device track, read and display only; none started)

Each PR is one issue, branched from `origin/main`, with no migration, no production write, no feature flag or worker change, and no script writes. Each is opened for review and never merged by the session.

- **PR 1. Cues and state at a beat** (backend and the frontend cue libraries).
  - `[PHONE: battery=<0-100> dnd=on|off cracked=on|off]`, with `[PHONE: reset]` (battery and DND back to the episode defaults) and `[PHONE: repaired]` (cracked off).
  - `[TIME: HH:MM]`, with an optional day change `[TIME: HH:MM day=+1]` (B5). In-world local time, display only (T4).
  - Parsed in `scriptBeatParser` and registered in `APP_TAG`, `scriptHealth` and `scriptMoments`.
  - A new pure `src/utils/phoneStateTimeline.js`, after `knowledgeTimeline`: cues, episode defaults and the carried cracked state give the state at `{ beat, line }`, plus `issues`.
  - A new `src/services/phoneStateService.js`:
    - the episode's script;
    - `shows.metadata.phone_defaults` (B2);
    - the cracked state carried from earlier episodes in `episode_number` order (B4);
    - time unset when nothing is configured.
  - A read-only `GET /episodes/:episodeId/phone-state/at?beat=&line=` (`requireAuth`), registered so `validate-routes` sees it.
  - Tests: unit tests for the parser and the timeline (carry-over, reset, repair, episode boundary, day change, unset time, invalid cues), and an integration test for cracked carry across two episodes (Postgres). The parser, `lalaKnowledge` and script-library tests above are the regression set.
- **PR 2. The status bar, battery and DND, cracked glass** (frontend). Depends on PR 1.
  - A `usePhoneStateAt(episodeId, beat)` hook.
  - `PhonePreviewMode`: the status bar shows the beat's story time, or a blank unset slot, never the device clock; the battery level (low below 20%); and a DND moon.
  - `PhoneDevice`: a cracked-glass layer over the screen, on both frames.
  - One new CSS file, no device clock, tested at 375px.
  - Tests: new `PhoneDevice.chrome.test.jsx` and `PhonePreviewMode.statusBar.test.jsx`. The eight `PhonePreviewMode.*` and two `PhoneDevice.*` tests are the regression set.
  - The dead server canvas is not touched (B3).
- **PR 3. Wallpaper resolution** (backend, plus a display area). Depends on B1.
  - `wallpaperAt(models, showId, episodeNumber)` in a new `src/services/phoneWallpaper.js`:
    - the episode override, else the arc default (`ShowArc` by episode range), from `shows.metadata.phone_wallpapers` `{ arcs: { <arcId>: <assetId> }, episodes: { <n>: <assetId> } }`;
    - only an approved, live, image asset tagged `metadata.phone_wallpaper`;
    - otherwise the next fallback, else none, with the reason.
  - Read-only `GET /shows/:showId/phone-wallpaper?episode=`.
  - Display as B1 decides.
  - Tests: unit tests for resolution (override over arc, revoked, deleted, untagged and missing assets fall back), and vitest for the display.
  - Setting defaults and tagging assets are writes, so they are not in this PR (B2).
- **PR 4. The lock screen** (frontend). Depends on PRs 1 and 3.
  - A `lock_screen` content type in `ScreenContentRenderer` (registry and `ContentZoneRenderer`) and `ContentAreaPicker`.
  - It shows the story time from PR 1 (or the unset state), the day if it changed, the story label, the wallpaper from PR 3, and notification previews from the existing `notifications` / `feed_notifications` sources. It renders the `style: 'lockscreen'` the AI fill already asks for.
  - Tests: new `ScreenContentRenderer.lockScreen.test.jsx`, `ContentAreaPicker.test.jsx`, and an episode-opener case (beat 1). The `ScreenContentRenderer.*` tests are the regression set.

## 17. Blockers and decisions before the device PRs

- **B1. How a wallpaper shows on flat screens** (blocks PR 3's display and PR 4's wallpaper). Screens are single images with no background layer. Options:
  - (a) a `wallpaper` content area a designer places on a screen, full-bleed under its other areas (recommended: no change to existing screens, and opt-in per screen);
  - (b) the wallpaper drawn behind every screen, which only shows through transparent screen art;
  - (c) only the lock screen shows it.
- **B2. Who sets the show-wide defaults and the wallpaper tags.**
  - The device stages only read `shows.metadata.phone_defaults` / `phone_wallpapers` and `assets.metadata.phone_wallpaper`. Today nothing writes them, so the stages will show "unset" (time) and today's look (full battery, DND off, no crack, no wallpaper) until something does.
  - A small settings editor is a write. Should it be a separate approval, alongside the Phone Hub gate, or be included in PR 1 and PR 3?
- **B3. The unused server canvas.** `src/services/phoneScreenRenderer.js` draws the real clock but has no callers. Leave it, delete it, or fix it in a separate cleanup?
- **B4. Which earlier episodes carry the cracked state.** Recommended: every live episode of the show with a lower `episode_number`, in number order, whatever its status. Or only completed or published ones?
- **B5. The day-change form.** Recommended: `[TIME: HH:MM day=+1]`, with `+n` days from the episode's opening day, display only. Or a separate `[DAY: next]` cue?
- **B6. Battery and DND with no configured default.** Recommended: full battery and DND off, as today, so nothing visible changes until defaults are set. Or hide the battery entirely? The time follows R6 and shows unset.
