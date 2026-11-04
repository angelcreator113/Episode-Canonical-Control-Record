# Consolidated implementation roadmap (2026-11-04)

**Status:** a design for approval. Nothing here is implemented. No worker is activated, no image or character is regenerated, no production data changes, no migration runs, and no PR is merged or deployed without Evoni's separate approval.

**Combines:**
- the platform architecture audit (`2026-11-04-platform-architecture-audit.md`, §0–§15);
- the navigation and ownership blueprint (`2026-11-04-navigation-ownership-blueprint.md`, incl. §7a Pulse);
- the Studio by Sable separation plan (`2026-11-04-studio-by-sable-separation-plan.md`);
- the Pulse social simulation audit (`2026-11-04-pulse-social-simulation-audit.md`);
- the open safety PRs #3701–#3708.

**Governing principle:** *Dream Cities creates life. Lala has to afford that life. JustAWoman decides how she navigates it.*

**Goal:** a believable, juicy, socially active Dream Cities that needs much less manual work, while JustAWoman keeps control of Lala's choices and accepted story.

---

## 1. Evoni's rulings on the Pulse audit (2026-11-04)

This message supersedes the earlier Pulse design instructions; they are not separate requests.

| # | Ruling |
|---|---|
| 1 | **Autonomy.** Ordinary, quality-checked posts and comments between non-Lala characters may publish automatically when the relevant engine is explicitly enabled. Review is required for anything involving Lala's decisions, money, contracts, secrets, major accusations or canonical relationship changes. |
| 2 | **Scheduled posts.** Approved and automation-eligible posts may publish when due. Review-required content never bypasses approval. Existing scheduling history and idempotency are preserved. |
| 3 | **Viral ripples.** Improve, do not retire: quality checks, show boundaries, dedupe, posting limits, moderation. Not activated yet. |
| 4 | **Relationship developments.** Closeness may *propose* stage changes for review. It never confirms romances, friendships, rivalries or canonical changes. |
| 5 | **Episode Complete.** Franchise-brain story records created at Complete wait for review. Audit consumers before changing (done here, §9). |
| 6 | **Voice.** Unify approved script lines, learned voice rules, Pulse habits and the Registry speech profile. Preserve hand-edited rules. Major changes need approval; minor variation within the approved voice may be automatic. |
| 7 | **Photography.** Approved: a stable identity reference, separate from a public profile picture. Realistic selfies, candids, outfit, artistic and other character-appropriate avatars are allowed. Existing images and appearance consistency are preserved. |
| 8 | **Brands.** The brand-vs-person model is approved. Brands publish, react to campaigns, speak through authorized representatives, and track their own regard for Lala, distinct from the founder's personal relationship with her. |
| 9 | **Studio by Sable.** Sable's personal relationships are not mirrored onto @studiobysable. **No fake Registry character for the brand.** Records are preserved; a safe separation plan is proposed. |
| 10 | **AI budget.** Propose separate interactive and background budgets. $50/day is a provisional ceiling, not a target. Verify pricing and show monthly estimates first (§10). |
| 11 | **Social Storyline Review.** A **Social Storylines section inside the Season Story tab**, not a new top-level tab. It shows developments, evidence, character awareness, story implications and approval actions. |
| 12 | **Order.** Safety and data integrity first; then authoritative ownership and workflow connections; then voice, photography, brand behaviour and controlled automation. |

**Architecture rules:**
- Use the existing WORLD / SHOWS / SEASON / EPISODE / LALA / SYSTEM blueprint.
- The Pulse belongs to the living world, and its relevant developments flow into Season Storylines and Episode Production.
- **No duplicate** character voice editors, image libraries, relationship ledgers, story generators or brand registries.

**Effect of ruling 9 on earlier plans.** It rules out "D2 (company stand-in character)" in the Sable plan and the "company stand-in" route for brand-to-brand relationships. Brand relationships must therefore attach to the **brand record**, not a character (see S2.4).

---

## 2. Order of work at a glance

```
STAGE 0  Land the open safety PRs (#3702 #3703 #3705 #3706 #3707 #3708; #3701 on hold)
   │
STAGE 1  Safety and data integrity (P0/P1 immediate corrections; small, separate PRs)
   │       ├─ Pulse defects D1–D7 (immediate halves)
   │       ├─ Remaining unguarded sensitive routes (audit §15 High)
   │       ├─ Completion integrity (C1 zero totals; franchise-brain review)
   │       └─ Cost-tracker accuracy (pricing, cache accounting)
   │
STAGE 2  Authoritative ownership and workflow connections
   │       ├─ Brand records as owners (Sable first), person ≠ brand guards
   │       ├─ One Complete workflow (design approved first)
   │       ├─ Single owners: followers, follows, relationships, Lala identity
   │       ├─ Episode Intent / Creative Notes homes
   │       ├─ Pulse → Season Story (Social Storylines section) → Story Record
   │       └─ Portfolio-strength scoring (rules first)
   │
STAGE 3  Voice, photography, brand behaviour, controlled automation
   │       ├─ Voice profile resolver (unify 4 sources)
   │       ├─ Identity reference vs profile picture; photo styles
   │       ├─ Brand behaviour (reps, regard for Lala, campaign reactions)
   │       └─ Event-driven automation with budget lanes, limits, dedupe
   │
STAGE 4  Navigation transition (blueprint §8): workspaces in place, Producer Mode retired last
```

Each box is one or more small PRs, each separately approved. **A worker is never activated by a PR.** Activation is its own decision (gate G6).

---

## 3. Stage 0: the open safety PRs

| PR | What | State (2026-11-04) | Gate to merge |
|---|---|---|---|
| #3702 | Event safe-delete discovers every link; bulk delete is ADMIN only | All checks green on `d7d733c9` after a test fix. A pre-existing flaky test, `seasonRevealPlan` (tied timestamps), is noted on the PR. | Evoni's merge yes |
| #3703 | Explicit offer decision before Start; closed and duplicate-name schedules refused | Main merged in (`053f32ef`); CI running | Green CI + Evoni's merge yes |
| #3705 | Debug and seed routes off by default, ADMIN only | Test fix pushed (`0b25fcf5`); CI running | Green CI + yes |
| #3706 | Recycle Bin and Amber diagnostics ADMIN only; admin pages wrapped | Test fix pushed (`2b2bf990`); full local run 1075/1075 suites | Green CI + yes |
| #3707 | World Studio cannot overwrite Registry fields | All checks green | Evoni's merge yes |
| #3708 | Air Date saved and validated; Intent / Creative Notes read-only notes | Tests red; failure being reproduced locally (unit 654/654 pass) | Fix + green CI + yes |
| #3701 | Goals from the ledger | **On hold** until portfolio and follower measurement are resolved (S2.7) | Ruling on S2.7 |
| #3704 | These documents | Docs only | Evoni's review |

**Recommended merge order:**
1. #3705 and #3706 (route safety, independent);
2. #3702;
3. #3707;
4. #3703;
5. #3708.

Each needs its branch brought up to date with main before merge. They touch disjoint files except the test helpers, so conflicts are unlikely.

---

## 4. Stage 1: safety and data integrity

Each item lists the **immediate correction** (small, narrowing, no migration unless stated) and the **architectural redesign** (later stage), with what it depends on.

### 4.1 Pulse defects (confirmed)

| # | Defect | Immediate correction (Stage 1) | Architectural redesign (later) | Depends on |
|---|---|---|---|---|
| D1 | **Money posts never link to Lala.** `financialFeedService.resolveLalaProfile` queries the nonexistent `social_profiles.show_id`; a silent `catch {}` gives `id: null`. | Use `lalaFeedProfile.lalaProfileId` (the canonical resolver), log instead of swallowing, and add a test. Optional: a one-off read-only report of affected posts. Any back-link of old posts is a separate production-data decision (G3). | Money posts route through the gated drafter (`pulseDrafter`) with Lala's voice and story order, still always in Review (ruling 1). One Lala resolver everywhere. | — |
| D2 | **Viral ripples bypass the gate and show boundaries.** Random reactors from every show and layer; live without the gate; randomised numbers. | Ripples become **drafts only**: reactors scoped to the post's show and feed layer, brand accounts excluded, no random numbers. Not activated (ruling 3). | Ripples are drafted by `pulseDrafter` with the gate, dedupe key (post, reactor, kind), per-character limits and moderation; eligible ones publish under ruling 1 when the engine is on. | S3.4 for full automation |
| D3 | **World-moment jobs accumulate** when `WORLD_MOMENTS_ENABLED` is on and the engine is off. | `worldMoments` enqueues only when the queue consumer runs; otherwise it records "skipped: engine off" (visible on the Engine page). No behaviour change while both are off. | One switch model: producers check a single "consumer available" signal; the Engine page shows producers, consumers and backlog. | — |
| D4 | **Two read endpoints write data:** the event outfit GET writes feed activity (with a silent `catch {}`); the momentum GET writes `world_events.momentum_score`. | Make both GETs read-only. Move the writes to explicit POSTs (or drop the outfit-route write, since `feedActivityService` output never reaches the feed). Fix the silent catch. | `feedActivityService` retired or folded into the gated drafter (no duplicate generator). Momentum computed on read or by event. | — |
| D5 | **Voice rebuild overwrites hand-edited voices.** `pulseVoices.buildVoice` sets `status: 'built'` over `edited`. | The rebuild refuses when the status is `edited` unless explicitly confirmed. Rebuilds save as a **proposal** beside the edited voice. AI posts never touched by Evoni are excluded from rebuild sources. | The voice resolver (S3.1) makes rebuilds additive layers; manual rules are never overwritten (ruling 6). | — |
| D6 | **Business accounts inherit personal behaviour** (romance mirroring, friendship, DMs, closeness, reactor pools, `friendsOfLala`, crossing into a person). | One `isBrandAccount(profile)` helper (`full_profile.account='brand'` or `lalaverse_brand_id`). Guards in: `crossProfile` (refuse), `relationshipTruth.syncStoryPair` / `driftReport` (never mirror personal kinds onto a brand account), `pulseVoices.eligible`, `pickReactors`, ripples, `pulseDms.assertMaySend`, `pulseCloseness`, `friendsOfLala`, `lookAlikes`. Existing rows are untouched; `driftReport` lists "personal tie on a brand account" for review. | Brand records own business relationships, reps and regard for Lala (S2.1, S3.3). | — (marking 447 itself is S2.1, gate G3) |
| D7 | **Complete activates franchise-brain records without review.** | See §9: episode-result rows go to `pending_review`. The character-state snapshot (a mirror of `character_state`) stops being written as canon, and the script reads current state directly. | One review queue for brain records in the Story area; brain = canon rules, not a stats mirror. | §9 consumer audit (done) |

### 4.2 Other Stage 1 items already identified

| Item | Immediate correction | Architectural | Source |
|---|---|---|---|
| Unguarded sensitive routes (High): `franchise-brain/seed` force-wipe, `feed-scheduler/config`, manual coin adjustment (`characters/:key/state/update`), `shows/:id/seed-balance` force, `memories/generate-events` replace | ADMIN on each (and bounds on scheduler config). One PR per cluster. | Money changes only through ledger flows with reasons. | audit §15 |
| Medium routes: financial config, `franchise-brain/activate-all`, jobs (unscoped), wardrobe coin sync, overlay generate-all (no rate limiter), batch-generate (no cap), wardrobe seed clear | ADMIN / caps / `aiRateLimiter` | — | audit §15 |
| **C1: an already-finalized episode writes 0 totals and +2 stress** | Return the stored summary and balance on `already_finalized`. No stress on a repeat. | One Complete workflow (S2.2) | audit §12 |
| `createEpisode` parses `air_date` without validation | Reuse `parseAirDate` | — | #3708 note |
| Flaky `seasonRevealPlan` test (tied `created_at`) | Distinct timestamps in the test, or a tiebreaker in the query | — | #3702 comment |
| **Cost-tracker accuracy** | Haiku 4.5 priced at $1/$5 (not $0.80/$4). Cache accounting fixed: the API's `input_tokens` already excludes cache tokens, so do not subtract them. Undated `claude-haiku-4-5` key added. | Budget lanes (S3.4) | §10 |

**Stage 1 rule:** every item is a separate, small PR with a failing-first test. Each only narrows behaviour; no new feature rides along.

---

## 5. Stage 2: authoritative ownership and workflow connections

| # | Work | Owner after | Reuse (no duplicates) | Gate |
|---|---|---|---|---|
| S2.1 | **Brand records as owners; person ≠ brand.** Create brand rows only on approval (Sable first). Mark brand accounts. Link offers via `linkDeal` on every create path. `host_brand` set on live events. **Sable:** follow the separation plan, minus the company stand-in (ruling 9). @studiobysable stays the brand's account, and Sable's personal ties are not mirrored to it. | `lalaverse_brands` | `brandProfile`, `brandPulse`, `companyRoutes`, `linkDeal` | G3 for each production write; G2 if a founder or brand link column is wanted |
| S2.2 | **One Complete workflow** (design approved first; preserve accepted history, ledger integrity, explicit approval). Fold the evaluation-accept and ledger-complete paths into one service entry. | `episodeCompletionService` | existing `completeEpisode` | design review, then G4 per PR |
| S2.3 | **Single owners for social facts:** `pulse_followers` the only follower count (copies become derived); `pulse_follows` the only named follows (`social_profile_followers` read-only legacy); `character_relationships` the truth (Pulse rows are mirrors); `lalaFeedProfile` the only Lala resolver | as listed | `characterFacts.syncFollowerCopies`, `relationshipTruth` | G3 for any backfill |
| S2.4 | **Brand relationships without stand-in characters** (ruling 9). Business ties attach to the brand record. Proposal: `personality.relationships` (jsonb, no migration) for display, or a small `brand_relationships` table (migration, G2) if they must be queryable and reviewable. | `lalaverse_brands` | brand page | decision + G2 if table |
| S2.5 | **Episode Intent and Creative Notes.** Intent → `episode_briefs.narrative_purpose` (exists; it already feeds the script writer and scene planner, so editing it steers generation; locked briefs refuse edits). Creative Notes → a new `episode_briefs.production_notes` TEXT (no existing episode-level home). | Episode Brief | `PUT /episode-brief/:id` | Intent: approval. Notes: G2 (migration). |
| S2.6 | **Pulse → Season Story → Story Record.** A **Social Storylines section in `SeasonStoryTab`** (ruling 11), spec in §7. `seasonArcProposals.loadFeedSignals` extended with accepted closeness shifts, storylines and ripples. `pulseCloseness.decide` above a threshold calls `seasonArcProposals.proposeLater('closeness_shift')`. Accept goes only to existing gates: `EpisodeStoryRecord.approveRecord`, relationship confirm routes, Opportunities. | existing owners | `SeasonProposals`, `SeasonArcSuggestions`, `SeasonThreads`, `SeasonAttention`, `threadInbox`, `pairStorylines`, `castStoryGaps` | design approval |
| S2.7 | **Portfolio strength vs followers** (unblocks #3701). Propose scoring rules: approved qualifying creative work only, followers separate. Then Step 17 measures from those sources. | career goals | `pulseFollowers`, approved work records | ruling on rules |
| S2.8 | **Episode beat outline sees accepted social developments** (read-only input, never canon) | brief generator | `storyCarryForward`, `scriptPulsePosts` | design approval |

---

## 6. Stage 3: voice, photography, brand behaviour, controlled automation

| # | Work | Key points | Reuse | Gate |
|---|---|---|---|---|
| S3.1 | **Voice resolver** (ruling 6) | Read-only assembly at draft time, in this order: approved lines → learned `voice_rules` → `pulse_voices` habits → Registry `voice_signature` → `posting_voice`. Public/private channels. Address bands from closeness. Recent-post memory and a repetition flag in the gate. One voice per call (or per-speaker rules). Manual rules are never overwritten. Major changes (conflict, flirting, relationship tone, mood) wait for approval; minor variation is automatic. | `characterVoice`, `pulseVoices`, `pulseGate`, `pulseCloseness` | design approval; prompt changes only |
| S3.2 | **Photography** (ruling 7) | Identity reference = the approved headshot (+ angles), internal, the only face source everywhere. Profile picture per account (`full_profile.avatar`, jsonb), candid or artistic allowed, never used as a face reference. `photo_style` per character (jsonb). Explicit photo modes. Brand logo, product and campaign assets. Existing images and avatars untouched until chosen. | `cameraRoll`, `postPictures`, `pictureSuggestions`, `mediaLibrary`, `imageCostService` | G5 for any new image; verify role/purpose columns are free text first |
| S3.3 | **Brand behaviour** (ruling 8) | Official posts; campaign and event reactions (drafts on hosted-event completion); reps with authority from `extra_fields` (signed); **per-brand regard for Lala** (proposal-driven, separate from the founder's tie); offers always `offered` with `company_id`, never auto-accepted, no ledger writes, compensation stays "unspecified" unless set | `brandPulse`, `brandProfile`, `dealTermsDraftService` | design approval; G2 if regard gets its own table |
| S3.4 | **Controlled, event-driven automation** (rulings 1–3) | Wake-on-enqueue for `pulseQueue`. Event-armed release timer. Triggers for storylines, voices, recap and world moments on their real events. Per-kind switches for `dm` and `moment`. Request caps extended to the gate, pair suggestions, `rippleEngine`, `feedScheduler` and completion-time AI. **Budget lanes** (§10). Per-character daily posting limits. Dedupe keys (character, source, kind). Failed jobs parked with reason and Retry. Review-required content never auto-publishes. | `pulseQueue`, `pulseRequests`, `postRelease`, `aiCostTracker` | **G6: each switch turned on only by Evoni** |
| S3.5 | **World events → Pulse without an episode** | Created, changed or happening events enqueue gated reactions | `pulseEventPosting` | G6 |

---

## 7. Social Storylines (inside Season › Story)

- **Placement:** a section in `SeasonStoryTab` next to `SeasonThreads`. A count in `SeasonAttention` (kind `pulse_waiting`). A link from Daily Update.
- **Each development card shows:**
  - **What happened:** the development, for example a closeness shift, rumour, conflict, reputation swing, brand move or suggested storyline.
  - **Evidence:** the posts, comments, DMs, numbers and dates behind it, linked to The Pulse.
  - **Character awareness:** who knows, from `pulseKnowledge` and `relationshipKnowers`. Does Lala know? Who saw it, as of which story moment?
  - **Story implications:** affected slots, threads, relationships, goals, and money exposure (read-only).
  - **Approval actions:**
    - Accept into a slot or thread (the `SeasonArcSuggestions` pattern).
    - Propose a relationship-stage change (goes to the confirm flow; never auto-confirmed, ruling 4).
    - Send to the Story Record for canon.
    - Open the offer in Opportunities.
    - Dismiss, remembered by signals hash.
- **Never from here:**
  - ledger writes;
  - deal status changes;
  - accepted-canon writes;
  - relationship confirmation.

---

## 8. Reusable components (the "no duplicates" list)

| Domain | The one system to extend | Do not build |
|---|---|---|
| Post drafting | `pulseDrafter` + `pulseGate` + `pulseKnowledge` + `postFormatMix` | another generator; fold `feedActivityService`, ripple templates and money templates into it |
| Comments | `pulseDrafter` comments (`feedCommentDrafter` / redrafter brought onto the same voice and knowledge) | a sixth comment path |
| Review | Admin › Pulse › Review + `pulseTrust` | a second review queue |
| Release | `postRelease` (+ history, idempotency) | another scheduler |
| Relationships | `character_relationships` (truth) + `relationshipTruth` mirrors + `pulseCloseness` ledger | another relationship ledger |
| Followers and follows | `pulse_followers`, `pulse_follows` | more count copies |
| Voice | `characterVoice` + `pulse_voices`, read through one resolver | a second voice editor |
| Images | `mediaLibrary` / `media_asset_links`, `cameraRoll`, `postPictures` | a second image library |
| Brands | `lalaverse_brands` + `brandProfile` + `brandPulse` | a brand registry elsewhere, or brand stand-in characters |
| Story | `seasonArcProposals`, `threadInbox`, `storyThreadService`, `episodeStoryRecord`, `storyRipples` | another story generator |
| Cost | `aiCostTracker`, `imageCostService`, `pulseRequests`, `aiRateLimiter` | a parallel budget system |
| Season UI | `SeasonStoryTab`, `SeasonProposals`, `SeasonAttention` | a new top-level tab |

---

## 9. Franchise-brain consumer audit (for ruling 5)

**What Complete writes** (`episodeCompletionService` ~l.615–705):
1. **An episode-result row:** category `narrative`, `always_inject: false`, status `active`.
2. **A "Character State after Episode N" row:** category `character`, **`always_inject: true`**, applies to `current_stats`, status `active`. The previous active snapshot is superseded.

**Who reads active rows.** Every reader goes through `brainRules.selectRules` / `selectInjectedRules`, and `scopedWhere` forces `status: 'active'`:
- **Script writers:** `episodeScriptWriterService` (injected rules + a guard list of up to 100) and `groundedScriptGeneratorService`;
- **Briefs:** `episodeBriefRoutes`;
- **Story evaluation:** `storyEvaluationRoutes`, `postGenerationReview`;
- `tierFeatures`, `memories/engine`, `memories/assistant`;
- **Brain views:** the Franchise Brain page and Amber.

**Consequences of switching to `pending_review`:**
- **Episode-result rows** are context only (not always injected). Holding them for review hides them from rule lists and the evaluation context until approved. **Low risk.**
- **The character-state snapshot** is always injected into every script prompt. If it waits for review, scripts keep injecting the **previous** active snapshot (stale stats) until someone approves, because the supersede runs at insert time.
- **Recommendation:**
  - (a) result rows → `pending_review`, approved from a "Brain records waiting" list in Season › Story;
  - (b) stop storing the stats snapshot as brain canon, and have the script writers read `character_state` / the ledger directly, which already happens for coins and stress, with `loadScriptContext` the place to add the rest;
  - (c) until (b) ships, keep the snapshot `active` but marked as derived, not canon.
- **Watch `franchise-brain/activate-all`:** it bulk-activates every `pending_review` row with sign-in only (audit §15 Medium). It must become ADMIN-only, and ideally per-item, **before** completion rows start waiting. Otherwise one click would bypass the review.

---

## 10. AI budget: verified pricing, estimates, proposal (ruling 10)

**Verified list prices** (Anthropic first-party, per million tokens):

| Model | Input | Output | Cache write (5 min) | Cache read |
|---|---|---|---|---|
| Sonnet 4.6 (`claude-sonnet-4-6`, ~189 uses in code) | $3 | $15 | $3.75 | $0.30 |
| Haiku 4.5 (`claude-haiku-4-5-20251001`, ~60 uses) | **$1** | **$5** | $1.25 | $0.10 |

**Tracker discrepancies** (`aiCostTracker.MODEL_PRICING` / `calculateCost`):
1. Haiku 4.5 is listed at $0.80/$4, so Haiku spend is **under-counted by 20%**.
2. `standardInput = input_tokens − cacheCreation − cacheRead`. The API's `input_tokens` already excludes cached tokens, so uncached input is **under-counted** whenever caching is used.
3. Unknown models fall back to Sonnet prices. Fine for now; add the undated aliases.

Image calls (fal.ai Flux, OpenAI gpt-image) are priced in `imageCostService`. They were not re-verified here; S2 of the query below shows their logged cost.

**Per-unit estimates** (assumptions to check against real logs: drafting prompt ~4k input / 400 output on Sonnet; gate ~2k / 200 on Haiku):

| Unit | Estimate |
|---|---|
| One gated Pulse post (draft + gate) | ≈ $0.012 + $0.006 + $0.003 ≈ **$0.02** |
| One gated comment | ≈ **$0.015** |
| One DM | ≈ **$0.02** |
| One script generation (~30k in / 8k out, Sonnet) | ≈ **$0.21** |
| One feed-scheduler cycle | **$30–50** (the code's own comment). Every 4h, that alone could exceed $50/day; the budget gate would then stop **everything**, interactive work included. |

**Illustrative monthly background cost** (30 days, Sonnet drafting + Haiku gate, excluding images):

| World activity | Posts/day | Comments/day | DMs/day | ≈ $/day | ≈ $/month |
|---|---|---|---|---|---|
| Quiet | 10 | 30 | 5 | 0.75 | **~$23** |
| Lively | 30 | 100 | 15 | 2.40 | **~$72** |
| Very busy | 80 | 300 | 40 | 6.90 | **~$207** |

Post images add up to `PULSE_POST_IMAGES_PER_DAY` (default 20) × the per-image price.

**Proposal (provisional, pending real data):**
- **Two lanes** under the $50/day ceiling:
  - **interactive** (Evoni's clicks: scripts, briefs, tools);
  - **background** (queue, schedulers, completion-time AI).
- The background lane can never consume the interactive lane.
- **Starting point:** background **$8/day** (~$240/month max; "lively" fits well inside), interactive **$30/day**. Both are adjustable.
- **The feed scheduler stays off** until it has its own capped lane.
- Separately, request caps per show and per-character daily posting limits (S3.4).
- **I am not recommending final limits** until the real spend query below has been run.

**Read-only spend query.** `ai-spend.sql`, validated on the test database (5 statements):
- **S1:** daily spend, last 30 days.
- **S2:** by provider and model, logged cost vs list-price cost.
- **S3:** top 40 routes.
- **S4:** by calendar month.

---

## 11. Dependencies

- **Stage 0 → Stage 1.** The route and safe-delete PRs land first, so later fixes build on them.
- **D6 guards → S2.1 → S3.3.**
  - Marking @studiobysable as a brand account is safe only after the guards exist; otherwise nothing changes behaviour.
  - Brand behaviour needs brand records.
- **§9 (b), the script reads state directly → D7 full switch.** `activate-all` is ADMIN-only first.
- **D5 → S3.1.** No resolver work while rebuilds can overwrite edits.
- **D2 (drafts only) → S3.4.** Automated ripples need limits, dedupe and lanes.
- **Cost-tracker accuracy → budget lanes → any worker activation (G6).**
- **S2.3 single owners → S2.6.** Social Storylines must read one truth.
- **S2.7 rules → #3701.**
- **S2.2 one Complete design → C1 full fix and the completion-time AI caps.**
- **Stage 4 navigation moves → after S2.6.** Pages move once their owners are settled.

---

## 12. Risks

| Risk | Mitigation |
|---|---|
| Auto-publishing content that should have been reviewed | Ruling 1 categories enforced in `pulseGate.reviewReasons`. Lala, money, contracts, secrets, accusations and relationship changes are always review. Tests per category. |
| Budget exhaustion blocks interactive work | Lanes; the feed scheduler off; alerts beyond the console log. |
| Stale stats injected while brain rows await review | §9 (b) before the switch. |
| Brand guards hide data Evoni expects to see | Guards filter *new* behaviour only. Existing rows are listed on `driftReport` for review. |
| Voice unification flattens distinct voices further | Per-speaker drafting, real examples, the repetition flag; major changes need approval. |
| Identity drift in photos | One identity source; the reference is never a candid avatar; existing images kept. |
| Two-switch or engine-off confusion | The Engine page shows producers, consumers and backlog (D3). |
| Production-data steps (Sable, back-links) | Snapshot first, one record set per approval, undo listed. |
| Merge conflicts across many small PRs | Merge in the §3 order; rebase each from main before merge. |

---

## 13. Approval gates

| Gate | What needs Evoni's explicit yes |
|---|---|
| G1 | Merging any PR (each separately) |
| G2 | Any migration (new columns or tables), via the Deploy workflow |
| G3 | Any production data write or backfill (Sable records, brand rows, back-linking money posts, follower-copy rebuilds), one at a time, snapshot first |
| G4 | Deploying |
| G5 | Generating or replacing any image, or changing an avatar |
| G6 | Turning on any worker or switch (`PULSE_ENGINE_ENABLED`, `WORLD_MOMENTS_ENABLED`, `FEED_SCHEDULER_ENABLED`, per-show engine switches, ripples) |
| G7 | Any change to a character's approved voice or personality (major voice changes) |
| G8 | Confirming any relationship, accepting canon, accepting or booking a deal: always JustAWoman, never automated |

---

## 14. Open decisions

1. **Stage 1 order.** Proposed:
   1. D1, D4, D5 (pure fixes);
   2. D6 guards;
   3. the §15 High routes;
   4. D2 drafts-only;
   5. D3;
   6. cost-tracker accuracy;
   7. C1;
   8. D7 (after §9 (b)).
2. **D7 design:** approve §9 (a)–(c)?
3. **Brand relationships (ruling 9):** jsonb on the brand (no migration) or a `brand_relationships` table (migration)?
4. **Creative Notes:** approve `episode_briefs.production_notes` (migration)?
5. **Budget:** approve two lanes at $30 interactive / $8 background as a starting point, after reviewing the spend query?
6. **Back-linking old money posts to Lala (D1):** wanted, or leave history as is?
7. **Sable:** D1 of the separation plan (Sable's link to @studiobysable), now that D2 (stand-in) is ruled out.
