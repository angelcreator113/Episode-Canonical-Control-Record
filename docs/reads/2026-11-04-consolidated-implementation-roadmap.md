# Consolidated implementation roadmap (2026-11-04)

**Update, second set of rulings (Evoni, 2026-11-04):** see §15–§21. They supersede earlier text where they conflict:
- §9 (b) "scripts read live state" is withdrawn (§17).
- §10's $30/$8 split is not activated (§20).
- S2.4 is replaced by the relationship model (§18).

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


---

## 15. Second set of rulings (Evoni, 2026-11-04)

1. **Stage 1 priorities, in order:**
   1. security, authorization and destructive-operation safety;
   2. Pulse identity integrity, cross-show isolation, quality gates and unsafe autonomous publishing;
   3. episode completion, authoritative state and story continuity;
   4. character voice protection and accurate AI cost accounting.

   Open PRs keep moving through their review process. **No new merges or deployments are authorized.**
2. **Complete and the franchise brain.**
   - Mechanical outcomes and story interpretations have different approval requirements.
   - Approved outcomes are recorded through the authoritative state and financial systems, **exactly once**.
   - Franchise-brain narrative interpretations and story notes wait for review.
   - **Historical episode scripts must not read unrestricted live character state.**
   - Design two views:
     - **current Dream Cities state**;
     - **episode-specific continuity state**, reconstructed from accepted canonical history up to the right story-time boundary. It must be reproducible and must not silently change when later world activity occurs.
   - Audit state history, `seasonStoryOrder`, acceptance rules and consumers first.
   - Bulk franchise-brain activation becomes ADMIN-only.
3. **Relationships.**
   - A proper model for person–person, person–brand and brand–brand.
   - **No fake Registry characters for businesses.**
   - Table design, compatibility plan, historical mapping, migration and rollback are for separate approval. No production rewrite.
4. **Creative Notes.**
   - A dedicated field on the existing Episode Brief.
   - Intent uses `narrative_purpose`.
   - The smallest migration and compatibility plan, for review; not run.
5. **AI budgets.**
   - The $30/$8 split is **not** activated.
   - First collect actual spend, reconcile logged costs against current pricing and caching, and find expensive scheduler paths.
   - Then propose separate hard limits; background can never consume the interactive reserve.
   - No workers; no scheduled AI.
6. **Historical money posts.** A read-only preview of exact, ambiguous and unmatched links to Lala, with consequences. No backfill.
7. **Sable's Pulse identity.**
   - @studiobysable is the business account; Sable Okonkwo-Reyes is a separate person in the Registry.
   - No mirroring of her romances, friendships or personal ties onto the studio account.
   - Posts and history are preserved; the separation is prepared for review before any production change.
8. **Existing PRs.**
   - #3708: keep investigating CI and verifying the internal-field protection.
   - #3701 stays on hold.
   - #3702, #3703, #3705, #3706 and #3707 each need a separate final review and merge approval.
   - #3704 stays documentation-only.
   - **Record:** #3706 was merged (`2ebacc78`) under the earlier instruction "Merge #3706 and #3707", before this message arrived. #3707 was updated with main but **not** merged, and will not be merged without a new approval.

---

## 16. Stage 1 PR sequence (proposed)

Every PR is small, has a failing-first test, and only narrows behaviour. None has a migration unless marked. None activates a worker. Each needs its own review and merge approval (G1).

### Priority 1: security, authorization, destructive operations

| PR | Scope | Depends on | Tests |
|---|---|---|---|
| **1.1 franchise-brain guards** | ADMIN on `POST /franchise-brain/seed` (its `force` hard-deletes all canon) and `POST /franchise-brain/activate-all` | — | Route tests: a non-admin gets 403 on both; an admin passes; no other franchise-brain route changes. The new tests fail against main. |
| **1.2 money-changing routes** | ADMIN on `POST /characters/:key/state/update` (manual coin adjustment), `POST /shows/:id/seed-balance`, `PUT /shows/:id/financial-config` | — | 403 non-admin, 200 admin, and no ledger row written on a 403 (integration). |
| **1.3 destructive replace and bulk** | ADMIN for `generate-events` with `replace_existing`; ADMIN for `wardrobe/seed` with `clear_existing`; `wardrobe/bulk/sync-coin-costs` refuses without `show_id` unless admin | #3702 merged (link-safe replace) | Integration: a non-admin replace is refused and no events are deleted; an admin replace keeps used and linked events (the #3702 rule). |
| **1.4 scheduler config and AI fan-out** | ADMIN + value bounds on `PUT /feed-scheduler/config`; `aiRateLimiter` + ADMIN on overlay `generate-all`; a cap (e.g. 10) on `memories/batch-generate*`; `jobs` list/retry/cancel scoped to the owner or ADMIN | — | Unit route tests per rule; the scheduler config rejects out-of-range values; a batch above the cap gets 400. |
| (open) | #3705 debug/seed opt-in, #3702 safe delete, #3707 Registry guard | review + approval | as in their PRs |

### Priority 2: Pulse identity, isolation, gates, unsafe publishing

| PR | Scope | Depends on | Tests |
|---|---|---|---|
| **2.1 brand-account guards (D6)** | `isBrandAccount` helper. Guards in `crossProfile`, `syncStoryPair` / `linkStoryAndPulse` / `driftReport` (personal kinds never mirrored onto a brand account; existing rows listed as "personal tie on a brand account"), voice eligibility, `pickReactors`, ripples, `pulseDms.assertMaySend`, `pulseCloseness`, `friendsOfLala`, `lookAlikes`. No data change. | — | Unit tests per guard with a brand-marked fixture. **Integration:** a confirmed romance on a person whose `feed_profile_id` is a brand account creates no Pulse row; crossing a brand account gets 409; a person account is unchanged (regression). |
| **2.2 viral ripples to safe drafts (D2)** | Reactors scoped to the post's show and feed layer, brand accounts excluded; ripples saved as **drafts**; no randomised numbers; a dedupe key (post, reactor, kind). Not activated. | 2.1 (brand filter) | Integration: no reactor from another show; nothing goes live; a repeat call creates no duplicates; numbers stay at zero. |
| **2.3 money posts link to Lala (D1)** | `financialFeedService` uses `lalaFeedProfile`; no silent catch; the post carries Lala's profile id. **New posts only;** history is untouched (§19). | — | Integration with a show that has Lala's registry link: the new money post's `social_profile_id` equals her profile. Without a profile: a logged warning, the post is still a draft, and no crash. Fails on main (`show_id` error swallowed). |
| **2.4 reads never write (D4)** | The event outfit GET and the momentum GET become read-only; their writes move to explicit POSTs or are dropped; the silent catch is fixed | — | A GET leaves `world_events` and `canon_consequences` unchanged (row hash before and after); `lint-silent-catches` count drops. |
| **2.5 world-moment producer/consumer (D3)** | `worldMoments` enqueues only when the queue consumer runs; otherwise it records "skipped: engine off" on the Engine page | — | Unit: with the engine off, no jobs are inserted and a skip is recorded; with it on, unchanged. |
| **2.6 autonomy categories (ruling 1)** | `pulseGate.reviewReasons` adds always-review for money, contracts or deals, secrets, major accusations and canonical relationship changes, on top of Lala. Release honours it (ruling 2: review-required content never releases on schedule without approval). Existing release history and idempotency are kept. | 2.1 | Category fixtures each land in Review; an ordinary non-Lala post still auto-publishes when the engine is on; a scheduled review-required post is not released by `releaseDue`. |

### Priority 3: completion, authoritative state, continuity

| PR | Scope | Depends on | Tests |
|---|---|---|---|
| **3.1 exactly-once completion (C1)** | `already_finalized` returns the stored summary and balance; no repeated stress or stat deltas | — | Integration: complete twice gives the same totals, one ledger set, and stress applied once. |
| **3.2 brain records wait for review (D7, ruling 2)** | Completion's narrative-result rows are written `pending_review`; a "Brain records waiting" list with per-item approve (ADMIN). The **character-state snapshot row stays as today** until the continuity view (§17) replaces it, so no consumer loses state. | 1.1 (activate-all ADMIN) | Integration: after Complete, the result row is `pending_review` and is not injected; after approve it is injected; the stats snapshot behaviour is unchanged. |
| **3.3 continuity view (design approval first)** | Implements §17 after Evoni approves the design | §17 approval; 3.1 | defined with the design |
| **3.4 `createEpisode` air date validation** | Reuse `parseAirDate` | #3708 | Integration: a bad date gets 400 and no row. |
| **3.5 admin reset leaves a trail** | `POST /admin/reset-character-stats` writes a reversing history row and lists what it leaves behind (design first; ADMIN already) | — | Integration: after reset, a history row exists and the ledger is unchanged unless explicitly voided. |
| **3.6 balance fallback** | `getCurrentBalance` stops querying the nonexistent `character_state_history.deleted_at` | — | Unit/integration: the fallback returns the latest `state_after_json` coins with no SQL error. |

### Priority 4: voice protection, cost accuracy

| PR | Scope | Depends on | Tests |
|---|---|---|---|
| **4.1 voice rebuild never overwrites edits (D5)** | `buildVoice` refuses an `edited` voice unless confirmed; the rebuild is saved as a proposal; untouched AI posts are excluded from rebuild sources | — | Integration: an edited voice is unchanged after a rebuild and a proposal row exists; a built voice still rebuilds. |
| **4.2 cost-tracker accuracy** | Haiku 4.5 at $1/$5; undated aliases; the cache accounting fix (`input_tokens` already excludes cache); the 80% warning surfaced (Daily Update / CFO page) | — | Unit: `calculateCost` against hand-computed fixtures (with and without cache; each model). |
| **4.3 test hygiene** | `seasonRevealPlan` tie-break | — | The test is stable over 20 repeated runs. |

**Merge order:** 1.1 → 1.2 → 1.3 → 1.4 → 2.1 → 2.3 → 2.4 → 2.2 → 2.5 → 2.6 → 3.1 → 3.6 → 3.2 → 3.4 → 3.5 → 4.1 → 4.2 → 4.3. Then 3.3 (continuity view, §17) after its design and migration are approved.

---

## 17. Two state views: current state vs episode continuity state

Read-only audit at origin/main `2ebacc78`, with a design for approval. *(verified)* marks claims I re-read myself.

### 17.1 Findings

**Bottom line.** No store today can rebuild "state as of episode N" by story order. Every script-context reader pulls the **present**, so regenerating an old episode's script today uses later state.

**State stores:**
- **`character_state`.** One live row per show for Lala, updated in place, with no history or story position.
  - **Writers:** Complete, the ledger coin sync, `changeCoins`, the manual state edit, and the admin reset.
  - **The admin reset** zeroes stats and sets episodes back to draft, but writes no history row and leaves ledger, history and brain rows in place.
- **`character_state_history`.** Append-only in practice. Rows: `computed` (Complete), a second `computed` coins-only row (finalize), `override` (followers), `manual` (no episode), `wardrobe_purchase` (no episode).
  - **`state_after_json` is the live state at completion time,** so episodes completed out of story order build on each other in completion order.
  - It has **no `deleted_at`**, yet `financialTransactionService.getCurrentBalance`'s fallback filters on it *(verified: the column does not exist; CI database logs show the error)*.
- **Ledger (`financial_transactions`).** Has `episode_id` and balance before/after.
  - **Balance** = counted rows, else the seed.
  - **Not strictly append-only:** voiding and reseed soft-delete are recorded on the row.
  - **Exactly once:** `finalizeEpisodeFinancials` returns `already_finalized` with no summary or balances, so Complete then computes 0/0 and adds stress (C1). This is the reset-then-recomplete path.
  - **Wardrobe purchases** book ledger rows during setup, before Complete.
- **Overwritten in place:**
  - `wardrobe.is_owned` (no episode or time);
  - `character_relationships` (`approveRecord` updates in place, but `relationship_events` keeps an event per pair per episode with `metadata.episode_id`);
  - secrets and twists (current state with episode provenance).
- **`episode_story_records`.** Draft or approved, with an `applied` record so each item is written once.
- **`franchise_knowledge`.** No `episode_id`; Complete writes both rows `active`.

**Story time is defined three ways:**
1. `episode_number` via `storyClock.orderOf` (`n*10+phase`), used by `lalaStats`, `scriptPulsePosts`, `pulseKnowledge.knowsAt`, `pulseReveals`, `factHistory`, `pulseFollowers.countAt`;
2. `episode_number <` in `storyCarryForward`;
3. **`seasonStoryOrder`** (season → arc → slot, bonus after its slot, two-parts in their own slots, `precedingEpisodes` returning accepted canonical predecessors). **It has no callers** *(verified)*.

**Acceptance.** The marker is `episodes.evaluation_status='accepted'`, set by Complete.
- Two-parters complete Part 1 with all state, and Part 2 gets no history row.
- **Unaccepted episodes still write state:** wardrobe purchases (ledger, coins, ownership) and the Story Record Save (no acceptance check).

**Consumers reading live state when working on a specific episode:**
- `episodeScriptWriterService.loadScriptContext`: live balance, live `character_state`, injected brain rules incl. the state snapshot row, the newest world snapshot, carry-forward by number;
- `groundedScriptGeneratorService`;
- `scriptMoneyContext.balanceBefore` ("now minus this episode", so it includes later episodes);
- `episodeBriefRoutes.herGoalForEpisode`;
- the event script skeleton;
- `episodePitchService`;
- Complete's own evaluation input.

**Frozen at Start today:** only `season_context` and `money_plan` (`{taken_at, balance, lines}`). `episode_briefs.lala_state_snapshot` exists but **nothing captures it** (client PUT only) and nothing reads it.

**Reusable:**
- `seasonStoryOrder` / `precedingEpisodes`;
- ledger rows by episode;
- per-episode `deltas_json`;
- `relationship_events` by episode;
- `money_plan`, `season_context`;
- the story-ordered ledgers `pulse_followers`, `pulse_closeness`, `character_fact_changes` (pattern);
- `lalaStats` (template).

### 17.2 Proposal: two views

**(a) Current Dream Cities state.**
- **Owners stay:** `character_state` (cache), the ledger (coins), ownership, relationships, secrets, latest followers.
- **One read helper** `currentState(showId)` replaces raw SELECTs.
- **Readers:** world and character dashboards, the Pulse "now", pitching, and planning a future episode before Start.

**(b) Episode continuity state, `continuityState(episodeId)`.**
- **Boundary:** P = `precedingEpisodes(seasonStoryOrder(show), E)`, meaning accepted, canonical, unambiguous episodes before E in **story order**. State = baseline + the effects of P, applied in story order.

| Part of state | How it is rebuilt |
|---|---|
| Coins | seed + episode-less rows dated before E's Start + counted rows of P. E's own and later or unaccepted episodes' rows are excluded. |
| Stats | baseline + Σ P's `computed` **deltas**, clamped per step. **Replayed from deltas, not `state_after_json`,** which carries completion-order contamination. Manual adjustments count only with an explicit effective point (to decide). |
| Relationships | latest `relationship_events` stage per pair within P |
| Ownership | baseline basics + P's `wardrobe_purchase` rows + episode-less purchases before E's Start |
| Secrets and twists | provenance within P |
| Followers | accepted `pulse_followers` up to P's last After |
| Story records | approved records of P only |
| Two-parters | one unit (Part 2's boundary = P(Part 1), sharing Part 1's Start snapshot) |
| Bonus episodes | by slot |
| Specials marked `needs_review` | excluded and reported |
| E's own planned spending | from `money_plan`, not inherited |

**Reproducible, never silently changing:**
- **At Start Episode,** `continuityState` is computed and **stored** with its inputs (episode ids and positions, ledger and history row ids, story-order version) and an `inputs_hash`.
- **Writers for that episode read the stored snapshot.**
- **Recompute only on an explicit request.** If the hash differs (an earlier episode re-accepted or reset, or order data changed), the UI shows "continuity changed since Start" with a diff. Nothing updates silently. Later episodes' snapshots are flagged **stale**, not rewritten.
- **Previews** of unaccepted predecessors are stored as `simulated`, never canonical.

**Storage (migration, G2):** a new append-only table `episode_continuity_snapshots`:
- columns: id, show_id, episode_id, kind (`start` | `recomputed` | `preview`), state_json, inputs_json, inputs_hash, simulated, created_at, created_by, deleted_at;
- a unique index on (episode_id, kind, inputs_hash).

The unused `lala_state_snapshot` is left alone until formally retired.

**Consumers that switch to (b):**
- `loadScriptContext` (balance, stats, carry-forward → P's last approved record, secrecy, world snapshot → none or snapshot);
- `groundedScriptGeneratorService` and `scriptMoneyContext.balanceBefore`;
- `herGoalForEpisode`;
- the script skeleton;
- **Complete's evaluation input** (the Start snapshot; the outcome is still applied once to the live row and ledger);
- `statsPanelService` / `lalaStats` (story order instead of `episode_number`);
- the Phone "as of beat";
- Pulse drafting for an episode;
- `storyCarryForward`.

Pitching and dashboards stay on (a).

**Mechanical outcomes vs interpretations (ruling 2):**
- **Mechanical outcomes** (ledger rows, stat deltas, follower decisions, ownership) are applied once at Complete through their owners. Exactly once: C1 is fixed in PR 3.1.
- **Interpretations** (the franchise-brain episode-result row, story notes) are written `pending_review` (the enum value already exists, no migration) and approved per item (PR 3.2).

**Retiring the brain "Character State after Episode N" row**, in order:
1. Writers read the continuity snapshot (this design).
2. **Stop inserting** the always-inject snapshot.
3. **Fix `frontend/src/lib/cultureYear.js`,** which reads `episode-completion` rows only when `active`. Point it at `episodes.evaluation_json` and the ledger, or at reviewed rows, or Culture Year loses its entries.
4. Archive existing `active` snapshot rows **only with Evoni's yes** (a data change, G3). This changes `selectInjectedRules` output for the script writers and briefs.

**Related fixes:**
- **The admin reset:** writes a reversing history row and voids its own derived rows explicitly (design first).
- **The balance fallback:** stop querying a nonexistent `character_state_history.deleted_at`.

These join Stage 1 priority 3 as PR 3.5 (reset audit trail) and PR 3.6 (balance fallback).

### 17.3 Decisions

1. Approve the boundary (accepted, canonical predecessors in `seasonStoryOrder`) and replay-from-deltas.
2. Do manual adjustments count in continuity: only with an explicit effective episode, or by date before Start?
3. Approve the `episode_continuity_snapshots` migration design (G2) and freezing at Start.
4. Should unaccepted episodes keep writing state during setup (wardrobe purchases)? Or should setup spending stay in `money_plan` until Complete?


---

## 18. Relationship model (person–person, person–brand, brand–brand)

For separate approval. Nothing is migrated or rewritten. This is a read-only design against origin/main `2ebacc78`.

### 18.1 Where `character_relationships` is used today

**Schema.**
- `character_id_a/b` are NOT NULL, FK `registry_characters`, ON DELETE CASCADE (migration `20260223100000`).
- The unique index `idx_char_rel_unique_pair_type` (a, b, type) deliberately ignores `deleted_at`. Four writers revive soft-deleted rows with `ON CONFLICT … DO UPDATE SET deleted_at = NULL`: `episodeStoryRecord`, `familyTies`, `relationshipSeeds`, `relationships.js`.
- `relationship_events` cascades from it.
- `social_profile_relationships.character_relationship_id` is set NULL on delete.

**Readers and writers by purpose:**
- **Story truth:** `relationships.js` CRUD, `episodeStoryRecord.applyRelationship`, `familyTies`, `relationshipSeeds`, `relationshipTypeTidy`, `relationshipTruth.applyDriftFix`, `relationshipKnowers`, `familyHeritage`, World Studio relationship CRUD and seeding, the character generator, `memories/engine`, `tierFeatures`, `families.js`, the cast merge.
- **Pulse mirror:** `relationshipTruth` (`linkStoryAndPulse`, `syncStoryPair`, `driftReport`…), `familyTies.linkPulseFamily`, `pulseKnowledge`, `storyRipples`.
- **Season planning:** `seasonCast`, `seasonNeeds`, `relationshipSeeds` context, `episodeStoryRecord.relationshipsOf`, `worldTemperatureService`, `sceneEligibilityService`.
- **Script and prompts:** `episodeScriptWriterService` (incl. `lalaRomances`), `relationshipTruth.confirmedBetween`, `relationshipKnowers`, `characterFile`, `characterAI`, `memories/*`, story evaluation, scene proposal, `tierFeatures`, `characterRegistry`.
- **UI:** the `relationships.js` GETs, World Studio, `families`, `personPage`, the frontend `RelationshipEngine/*`, `WorldStudio.jsx`, `RelationshipDrift`, `SeasonNeeds`.

**Every one assumes both parties are characters.**
- **Readers that inner-join both sides drop brand rows safely** (no change needed).
- **Readers that would see NULL on one side and need a people-only filter:** `characterAI`, `memories/engine` (~l.1578), `sceneProposeRoute`, `worldTemperatureService`, `amberSessionRoutes` counts, `relationships.js GET /`, and frontend `pairKey` callers.

### 18.2 Existing company stand-ins (`extra_fields.company_id`), to be frozen

| Code | Under the new model |
|---|---|
| `companyCharacters` (`linkCharacter`, `refusePair`, `lookAlikes`…) | `linkCharacter` refuses **new** stand-ins (ruling). `refusePair` becomes "pair kind refuses this type". `lookAlikes` feeds remap proposals. |
| `relationships.js` company fields / `refusePair` | brand party fields + `relationshipTypes.validateForPair` |
| `relationshipTypeTidy` | decided by party kind; stand-in pairs go to remap, not tidy |
| `relationshipTruth` `company_pair` | still skipped; brand parties get their own Pulse mapping |
| `familyHeritage`, `familyTies` | unchanged (family is person–person only, now also enforced in the database) |
| `relationshipSeeds` | pair kind; never offers a stand-in as a party |
| `brandProfile.peopleOf` / `characterOf` | also reads person–brand rows (represents, employee, founder, ambassador), with `extra_fields` as fallback until remapped. A stand-in is shown as "legacy". |
| `seasonNeeds.companyFacts`, `characterTalk.brandBlock` | brand parties from `brand_id_*`, reps from person–brand rows (later) |

### 18.3 Table design (recommended: option A, extend `character_relationships`)

**Why option A:**
- Real FKs on both party kinds.
- The four `ON CONFLICT` writers, `relationship_events`, Pulse mirror ids, `known_by` / `public_state`, seeds and drift keeps all keep working.
- Brand rows drop out of most readers automatically.

**Rejected options:**
- **B** (polymorphic table + compatibility view): no real FK, `ON CONFLICT` breaks against a view, events must be re-pointed.
- **C** (separate `brand_relationships`): splits a person's ties across stores and duplicates event and secrecy history.

**Columns** (all additive, no row rewrite):
- `party_a_kind`, `party_b_kind`: `VARCHAR(10) NOT NULL DEFAULT 'character'` (`'character'` | `'brand'`).
- `brand_id_a`, `brand_id_b`: `UUID NULL` FK `lalaverse_brands(id)` **ON DELETE RESTRICT** (brands are soft-deleted; history must never vanish on a hard delete).
- `character_id_a/b`: drop NOT NULL.
- `remapped_from_id`: `UUID NULL` FK self, ON DELETE SET NULL (remap provenance).
- `created_by`: `VARCHAR(255) NULL`.
- `seed_*` apply to every pair kind.

**Checks:**

| Check | Rule |
|---|---|
| one id per side | `character_id` xor `brand_id`, matching the side's kind |
| order | person–brand rows always put the person on side A (types read "A is B's ___") |
| no brand self-pair | the two brand ids differ |
| romance and family are person–person only | `is_romantic`, family fields and blood relation are allowed only when both sides are characters |

**Uniqueness:**
- The existing index stays.
- New partial unique indexes: (character_id_a, brand_id_b, type) for person→brand; (brand_id_a, brand_id_b, type) for brand→brand.
- Like today's index, they ignore `deleted_at`, so revive still works.

**Types**, in `relationshipTypes.js` (`pairKind(row)`, `TYPES_BY_PAIR`, `validateForPair`; checked in the app, so the list can grow without migrations):

| Pair | Types |
|---|---|
| person–person | today's types and family roles, unchanged |
| person–brand (the person's view) | founder, owner, employee, represents, ambassador, client, sponsored_by, collaborator, press, critic, fan, former_employee |
| brand–brand | client_partner, sponsor (A sponsors B), rival_brand, collab, owns, stockist, press |

**How the flags apply:**
- `confirmed`, `public_state` and `known_by` apply to all pairs (a secret sponsorship is real story).
- `lala_connection` describes the person side; it stays `none` for brand–brand.

**A brand's regard for Lala (ruling 8):**
- The brand's **standing attitude** stays in `personality.how_treats_lala` (identity, read by prompts).
- A **real, changing tie** (client, sponsor, ambassador, critic) is a person–brand row with **Lala on side A**. Its tension, situation and events carry the change.
- This is separate from the founder's personal row with Lala.
- No automatic row per brand.

### 18.4 Compatibility

- **Writers:** unchanged (they insert character ids; kinds default to `character`).
- **Model:** `allowNull` on `character_id_*`, the new attributes, and a model `validate` mirroring the checks.
- **People-only filters:** added to the readers listed in 18.1.
- **API:** responses only gain fields (`party_a_kind`, `party_b_kind`, `brand_id_a/b`, and later `party_a` / `party_b` = `{kind, id, name, slug}`).
- **Pulse mirroring** (`syncStoryPair`):
  - A brand party maps to its account (`full_profile.lalaverse_brand_id`).
  - **Only business kinds mirror for brand pairs.**
  - **Personal kinds (romance, ex, family, friend) never mirror if either profile is a brand account.** This keeps Sable's ties off @studiobysable (ruling 7).
  - Stand-in pairs are still skipped; nothing mirrors while a remap is open.

### 18.5 Historical mapping (proposals only; nothing rewritten)

`relationshipRemap.proposals(db)` is computed, read-only and deterministic. It reads live rows where a side is a stand-in or a **merged person/brand**. A merged person is one whose display name matches a brand, looks like a company, or whose feed profile is a brand account.

**Rules:**
1. Both sides plain people: keep.
2. Stand-in + company type: re-point the stand-in side to its brand.
3. Stand-in + romance or family: **flag** (invalid for a brand).
4. Merged person + personal type: **keep on the person; never touch `confirmed`.**
5. Merged person + brand-pair type: propose brand–brand.
6. Merged person + represents, employee or founder: propose person–brand.
7. Contradictory business types for the same pair: **flag both**.
8. No brand row exists: flag "create or pick a company". Never created automatically.
9. Unconfirmed seeds: same rules, low priority. Deleted rows are ignored.

**Applying one proposal** (later; one at a time; each with Evoni's yes; one transaction):
1. Insert the brand-party row with `remapped_from_id`.
2. Add a `remapped` event on both rows.
3. Soft-delete the original as `Superseded` (its events stay on it).

**Undo:** restore the original (`POST /:relId/restore`) and soft-delete the new row.

**Studio by Sable** (all 10 registry rows from Evoni's production read; @studiobysable is the business account per ruling 7):

| # | Row (Sable, person, `c4931651`) | Proposal |
|---|---|---|
| 1 | love_interest slowsift | **keep** person–person; stays unconfirmed (R5); never mirrored to @studiobysable |
| 2 | love_interest velvetcore | **keep**, as #1 |
| 3 | friend velvetcore | **keep** person–person; not mirrored |
| 4 | rival thriftveil (Declan Ferris, a person) | **keep** person–person (her professional view) |
| 5 | collaborator Lala | **keep** person–person (a later option: a person–brand row with Lala as the studio's collaborator) |
| 6 | rival_brand First Light Studio | **propose** brand–brand Studio by Sable vs First Light Studio; needs the Studio by Sable brand row (else flag, rule 8) |
| 7 | client_partner Velour Atelier | **propose** brand–brand client_partner (or person–brand "client"; Evoni chooses) |
| 8 | rival SHOWROOM.LUX | **flag**: business or personal rival, depending on whether SHOWROOM.LUX is a brand account (follow-up Q4) |
| 9 | represents Ori Beauty | **flag** with #10 (rule 7); unresolved per R6 |
| 10 | rival_brand Ori Beauty | **flag** with #9 |

### 18.6 Migration (schema only) and rollback

- **File:** proposed `src/migrations/<timestamp>-add-relationship-parties.js`.
- **Shape:** one transaction, guarded so it can run twice.
  - It adds the six columns, drops NOT NULL on `character_id_a/b`, and adds the seven checks and four indexes.
  - **No data step.** Every existing row reads `character`/`character`.
- **Down:**
  - It **refuses while any row uses a brand party or a remap**, so rollback cannot destroy brand relationships silently.
  - Otherwise it drops the indexes, checks and columns and restores NOT NULL.
- The full proposed code is kept with the design notes for review; nothing is in `src/migrations` yet.

**Deploy order:**
1. The migration (Deploy workflow, snapshot first; no behaviour change).
2. The model, people-only filters, pair validation, `syncStoryPair` brand mapping and the brand-account guard.
3. Brand-party API and UI writers.
4. `linkCharacter` stops accepting new stand-ins.
5. The read-only remap proposals page.
6. Per-item applies, each approved.

**Read-only verification, before and after:**
- `count(*)` plus an md5 of `id||updated_at` over `character_relationships` must be identical (no row rewritten).
- The kinds group-by returns only character/character.
- The new constraints are present, and `idx_char_rel_unique_pair_type` is still there.

### 18.7 Tests and risks

**Tests:**
- Migration up, up again, down, then up; down refuses with a brand row.
- Each check rejects its case.
- The four `ON CONFLICT` writers still insert and revive.
- `validateForPair` per pair kind.
- `syncStoryPair`: business kinds land on the brand account, personal kinds never do, stand-ins are skipped.
- The six people-only readers survive a NULL `character_id_b`.
- A Sable fixture gives the table in 18.5.
- Frontend `RelationshipEngine` tests with a brand row.

**Risks:**
- `pairKey` / `Set` code keyed on `character_id_*` colliding on NULL.
- `SELECT cr.*` responses gain columns (additive).
- Person–brand ties live in two places until remap: `extra_fields` reps vs new rows; `founder` text vs founder rows. `peopleOf` must merge them without double counting.
- Brand FKs are RESTRICT while character FKs are CASCADE (deliberate).
- The drift report and `linkStoryAndPulse` need extending for brand pairs.
- The cast merge must leave `brand_id_*` alone.


---

## 19. Historical money posts: read-only preview

**How money posts are identified.** `financialFeedService.writeFeedPost` writes:
- `social_profile_id` NULL (its lookup always fails, see D1);
- poster `lala` / `Lala`;
- `ai_generated` true;
- `narrative_function` `flex` or `bts`;
- one of nine fixed template texts.

**How Lala is resolved.** As `lalaFeedProfile` does: her registry character's `feed_profile_id` (per show, via `character_registries.show_id`); otherwise the one LalaVerse profile whose handle is exactly `lala`.

**Query:** `money-posts-preview.sql`. It is read-only and has no temp objects; it was validated on the test database with `default_transaction_read_only = on` (5 statements).

| Section | What it shows |
|---|---|
| P1 | Lala's profile resolution per show that has money posts: linked profiles, `@lala` profiles |
| P2 | Counts by class (**exact: her registry link / exact: the one @lala profile / ambiguous / unmatched / not a money template**) × status × deleted, with first and last dates |
| P3 | Every candidate post with the profile it **would** link to, and its text |
| P4 | **Consequences** per show: posts on that profile now, and how many live and draft money posts would join its timeline |

**Consequences of a backfill** (not authorised):
- Live money posts would appear on Lala's profile timeline and count toward her profile's post totals.
- They become eligible for `pulseNumbers` / `pulseCloseness` proposals only if those run on link (they run on release, not on link, so no automatic numbers).
- Drafts would show under her profile in Review.
- Deleted posts stay deleted.
- Any backfill is G3: snapshot, one show at a time, with an undo list of post ids.

---

## 20. AI budgets: collect, reconcile, then propose (ruling 5)

1. **Collect.** Evoni runs `ai-spend.sql` (read-only).
   - **S1:** daily spend over 30 days.
   - **S2:** by provider and model, **logged cost vs list-price cost recomputed with correct cache accounting**.
   - **S3:** top 40 routes.
   - **S4:** monthly totals.
2. **Reconcile.**
   - The S2 gap shows the Haiku under-count and the cache under-count in dollars.
   - S3 separates interactive routes (named route handlers) from background ones (queue, scheduler, completion-time AI) and finds the expensive scheduler paths. `feedScheduler` is expected to dominate if it has ever been on.
3. **Propose limits.**
   - Two hard limits sized from the real numbers: an **interactive reserve** and a **background ceiling**.
   - Enforced in `aiCostTracker` by a lane tag on each call. A background call is refused when the background lane is spent, **or when spending would cut into the interactive reserve**.
   - No worker or scheduled AI is turned on (G6).

---

## 21. Creative Notes: smallest migration and compatibility plan (not run)

**Migration** (proposed file `src/migrations/<timestamp>-add-episode-brief-production-notes.js`, following the `describeTable` + guarded `addColumn` pattern in `20260806000000-episode-brief-event-snapshot-fields.js`):

```js
'use strict';
// Creative Notes on the Episode Brief (Evoni, 2026-11-04): tone, direction,
// things to remember for production. Not story canon; never sent to the
// script writer unless a later ruling says so.
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const cols = await queryInterface.describeTable('episode_briefs').catch(() => ({}));
    if (!cols.creative_notes) {
      await queryInterface.addColumn('episode_briefs', 'creative_notes', {
        type: Sequelize.TEXT, allowNull: true,
        comment: 'Creative Notes from the episode Overview (production, not canon)',
      });
    }
  },
  down: async (queryInterface) => {
    const cols = await queryInterface.describeTable('episode_briefs').catch(() => ({}));
    if (cols.creative_notes) await queryInterface.removeColumn('episode_briefs', 'creative_notes');
  },
};
```

**Design notes:**
- The column is named `creative_notes`, after the field Evoni named (the earlier proposal said `production_notes`).
- It is nullable with no default; existing briefs read null.
- `episode_briefs` already has `deleted_at`.

**Compatibility:**
- **Model:** `EpisodeBrief` gains `creative_notes` (TEXT, nullable). Code deployed **before** the migration must not select it. Read it with `describeTable` guarding, or deploy migration then code through the Deploy workflow, which runs migrations first.
- **API:** `PUT /api/v1/episode-brief/:episodeId` adds `creative_notes` to `updatable`.
  - **Proposal:** Creative Notes stay editable while the brief is locked, as cover-marks already are, because they are production notes, not story. This needs Evoni's yes; otherwise the lock applies.
- **Intent:** the Overview's Intent reads and writes `narrative_purpose` through the same route (locked briefs refuse edits, as today). The UI says that editing it steers script generation.
- **Overview:** the two "Not saved yet" notes from #3708 become real fields once the column exists and the route accepts them. The form sends them to the brief route, not the episode route.
- **No backfill:** nothing was ever saved, so there is no history to migrate.
- **Rollback:** `down` drops the column (data in it is lost; G2 makes that explicit) and the code reverts.
- **Tests:**
  - Integration: the PUT writes and returns `creative_notes`; Intent writes `narrative_purpose`; locked-brief behaviour as ruled.
  - Migration up/down on the test database.
  - Overview vitest: it saves through the brief route.

---

## 22. Third set of rulings and the Episodes 1–2 continuity preview (Evoni, 2026-11-04)

### 22.1 Rulings

1. **Continuity boundary.**
   - Canonical **story order**, not production or completion order.
   - An episode's opening state reflects accepted, story-effective events before it in the canonical timeline.
   - Use `seasonStoryOrder` where appropriate, after verifying its integration and rules.
   - A frozen snapshot never silently changes when later episodes complete or Dream Cities keeps running.
   - **A read-only preview for Episodes 1 and 2 comes before any migration request.**
2. **Manual stat adjustments.**
   - Administrative adjustments never enter continuity automatically.
   - Only **approved, story-effective** adjustments count. Each carries:
     - a reason and source;
     - the affected character;
     - the effective story position;
     - before/after values;
     - an audit record;
     - protection against duplicate application.
   - Administrative corrections and test activity are kept distinct from canonical gameplay.
3. **Continuity snapshot migration.**
   - The architecture direction is approved; **the migration is not**.
   - Before implementation, show: the replay algorithm, the source records, integration points (script writer, scene planner, state readers, every other consumer), handling of missing history, tests and rollback.
4. **Episode spending.**
   - Hypothetical purchases and expenses stay in the episode **money plan**.
   - **Actual confirmed purchases enter Prime Bank immediately and exactly once, with a story-effective position.**
   - Genuine purchases are not deferred to Complete; **planning an outfit deducts nothing**.
   - Brand income distinguishes **offered, earned, pending approval and actually paid**.
   - Cancelling an episode never erases legitimate financial history.
5. **Creative Notes.**
   - Editable while the brief is locked: production notes, not canon.
   - Separate permissions and audit history.
   - They never silently change narrative purpose, approved dialogue or locked outcomes.
   - The column migration still needs separate approval.
6. **Relationship model.**
   - Approved in principle (§18).
   - Before migration: authoritative columns, reader compatibility, constraints, historical mapping and rollback.
   - No fake Registry characters for brands.
   - **No automatic move or rewrite of Sable's history.** Ambiguous relationships stay pending Evoni's individual review.

**Also:**
- The safety PRs stay separate from these designs.
- **#3706's merge authorizes nothing else.**
- #3701 stays on hold pending portfolio scoring.
- **#3707 and every other PR need fresh approval.**
- No continuity migration, no financial rewrite, no production relationship change, no workers, no deploys.

### 22.2 `seasonStoryOrder`: verification of rules and integration

| Rule (from the code) | Verified |
|---|---|
| Order: seasons by number; arcs by `arc_number`; slots by `slot_number`; a bonus or special right after `after_slot_number` (0 = before the first); two-part halves are their own slots | read, and exercised on fixtures by the preview |
| A slot whose arc is missing sorts **last** in its season and is reported `arc_missing` | read |
| Two specials after the same slot are ordered by release date/time, then creation, and **both** marked `order_ambiguous` (never carried) | read |
| Bonus = canonical (N2). Special = `needs_review` (excluded from carry-over until the G2 continuity-class migration) | read |
| Accepted = `episodes.evaluation_status = 'accepted'` only | read |
| Deleted arcs, slots, specials and episodes are ignored | read |
| An episode in two places is reported `episode_in_two_places` | read |

**Integration gaps:**
1. **Nothing calls it yet.**
2. An **unslotted** episode returns `found: false`: it has no continuity at all, and the preview reports such episodes.
3. A two-parter's Part 2 is accepted with no history row of its own; its effects live on Part 1.
4. The rest of the app still uses `storyClock` (`episode_number × 10 + phase`), so the two orders can disagree. Disagreements are to be **reported, not fixed** (G1).

### 22.3 The preview (read-only)

1. **Export.** `continuity-export.sql` reads every source record for the show into one JSON line per section:
   - show, arcs, slots, specials, episodes (with money plan and season context);
   - the full ledger;
   - stat history, current state;
   - relationship events by episode, follower changes, story records;
   - a wardrobe ownership summary, brief snapshot flags.

   It writes nothing. It was validated on the test database under `default_transaction_read_only`.
2. **Replay.** `continuity-preview.js` runs **locally on the exported file** (it never touches a database). It uses the repo's own `orderEntries` and `precedingEpisodes`, `applyDeltas` (`evaluationFormula`), `DEFAULT_LALA_STATE` and `DEFAULT_STARTING_BALANCE`, so the rules cannot drift from production code.

   **Output:** the story order (positions, accepted, continuity, ambiguity, unslotted and other issues), then for **Episode 1 and Episode 2** (the first two weekly slots, even if a slot has no episode yet):
   - carried and excluded predecessors, with reasons;
   - a table of opening coins and stats, relationship changes, follower changes and approved story records, in three columns:
     - **canonical** (accepted only);
     - **simulated** (as if unaccepted predecessors were accepted; never canonical);
     - **live state now** (what scripts read today);
   - every ledger row with its treatment (counted / excluded / **flag**) and reason;
   - stat history used and not used.

   **Tested on fixtures:**
   - Episode 1 unaccepted: Episode 2 opens at the 1,900 baseline; simulated it would open at 2,050, reputation 3, stress 3.
   - Episode 1 accepted: Episode 2 opens at 1,900 − 250 + 400 = 2,050, reputation 3, stress 3.
   - In both, the manual adjustment and a later episode's rows are excluded, and an episode-less purchase is flagged.
3. **Why it can't drift.** The opening state depends only on: story-order rows, earlier episodes' acceptance, their counted ledger rows, their `computed` deltas, their relationship events, accepted follower changes before the boundary, and their approved records. Completing a later episode or Dream Cities activity with no story position changes none of these inputs.

### 22.4 Replay algorithm (proposed for the continuity view)

For target episode E (or an empty slot boundary):

1. `order = seasonStoryOrder(show)`. P = `precedingEpisodes(order, E)`: canonical, unambiguous, accepted entries before E. Excluded entries are kept with their reason. If E is unslotted, return "no continuity" (no fallback to `episode_number`).
2. **Coins.**
   - Start from the seed row (`seed` / `show_init`), else the show's `starting_balance`, else `DEFAULT_STARTING_BALANCE`.
   - Add counted ledger rows (executed, not deleted, episode live) whose episode is in P.
   - **Episode-less rows:**
     - seed: counted;
     - **administrative** (`manual`, `manual_adjustment`): excluded (ruling 2);
     - any other episode-less row: **flagged as "needs a story-effective position"** and excluded until it has one (ruling 4).
   - E's own rows belong to E's money plan and its own confirmed purchases, not its opening state.
3. **Stats.** `DEFAULT_LALA_STATE` (non-coin) → for each e in P in story order, apply e's `computed` history `deltas_json` (coins removed) with `applyDeltas` (same caps and diminishing returns as Complete).
   - `manual`, `override`, `wardrobe_purchase` and `financial` sources are not stat changes for continuity unless approved as story-effective (ruling 2).
   - **Replay from deltas, never copy `state_after_json`** (it carries completion-order contamination).
4. **Relationships:** the latest `relationship_events` stage per relationship whose `metadata.episode_id` ∈ P.
5. **Followers:** accepted `pulse_followers` with `story_order` before E's boundary.
6. **Story records:** approved records of P.
7. **Ownership:** baseline owned items, plus purchase rows of P, plus positioned episode-less purchases before the boundary.
8. **Snapshot.** The result plus inputs (P ids and positions, ledger row ids, history ids, story-order rows hash, code version) and an `inputs_hash`, stored at Start (once migrated). Recompute only on request; show a diff if the hash changed.

### 22.5 Source records

| Source | Used for | Notes |
|---|---|---|
| `show_arcs`, `season_slots`, `season_specials`, `episodes` | order, acceptance | via `seasonStoryOrder` |
| `financial_transactions` | coins | `countedLedgerRows` semantics + the classification above |
| `character_state_history` (`computed`) | stats | deltas only |
| `relationship_events` (`metadata.episode_id`) | relationships | current `character_relationships` is **not** used for past episodes |
| `pulse_followers` (accepted, `story_order`) | followers | |
| `episode_story_records` (approved) | story facts | |
| `wardrobe` + purchase rows | ownership | items owned with no purchase row are baseline basics |
| `episodes.money_plan` | E's own plan (not opening state) | already frozen at Start |

### 22.6 Integration points (consumers)

| Consumer | Today | Under the design |
|---|---|---|
| `episodeScriptWriterService.loadScriptContext` | live balance, live stats, injected brain rows incl. the state snapshot, the newest world snapshot, carry-forward by number | **E's snapshot**: balance, stats, relationships, carry-forward = P's last approved record; no live world snapshot |
| `groundedScriptGeneratorService` | same family | E's snapshot |
| `scriptMoneyContext.balanceBefore` | "now minus E's rows" (includes later episodes) | snapshot coins |
| `episodeBriefRoutes.herGoalForEpisode` | live state + current balance | snapshot |
| `worldEvents/scriptAndBulk` skeleton | live state | snapshot |
| **Scene planner** (`scenePlannerService`) | **reads no character state** (brief fields only) | no change; it inherits continuity only through the brief |
| `episodeCompletionService` evaluation input | live state | **E's Start snapshot** for evaluation; the outcome is still applied once to the live state and ledger |
| `statsPanelService` / `lalaStats` | story-bounded by `episode_number` | story order (`seasonStoryOrder`) |
| Phone "as of beat", Pulse drafting for an episode, `storyCarryForward` | `storyClock` / number | story order and E's snapshot |
| **Stay on current state:** pitching (`episodePitchService`), career goals, affordability, next suggestions, deal pricing, financial pressure, wardrobe purchase guard, season arc proposals, dashboards | live | `currentState(showId)` (planning the future, not replaying the past) |

### 22.7 Missing history

| Case | Handling |
|---|---|
| An accepted predecessor with no `computed` row (legacy, two-part Part 2) | zero stat deltas, **flagged** |
| An unslotted episode | no continuity; flagged; never placed by number |
| A special (`needs_review`) or ambiguous order | excluded, listed |
| Episode-less ledger rows without a story position | excluded, **flagged** for positioning (ruling 4) |
| Administrative or test adjustments | excluded (ruling 2) |
| Deleted episodes | excluded (as the balance already does) |
| No seed row | show `starting_balance`, else the code default; the report says which |
| An earlier episode reset or re-completed | later snapshots are marked stale by hash, never rewritten |

### 22.8 Story-effective adjustments (ruling 2), for the migration request

Proposal: extend `character_state_history`, and give ledger rows the same marking through `metadata` or new columns:
- `kind`: `gameplay` | `administrative` | `test` | `story_effective_adjustment`;
- `reason`;
- `source`;
- `effective_episode_id` and `effective_story_position`;
- `before_json` / `after_json`;
- `approved_by` / `approved_at`;
- `idempotency_key` (UNIQUE).

Only `gameplay` (from Complete) and approved `story_effective_adjustment` rows enter continuity. Existing `manual` rows are read as `administrative`.

### 22.9 Spending (ruling 4): current behaviour to correct (finding)

- `POST /wardrobe/select` **auto-buys an unowned piece when it is selected** for an episode, and `POST /wardrobe/lock-outfit-atomic` also books a purchase.
- Under ruling 4, **choosing an outfit is planning and must not deduct coins**. Only a confirmed purchase books a ledger row (once, with a story-effective position).
- **Decision for Evoni:** which action is "confirmed purchase": the explicit `/purchase`, the outfit lock, or both?
- Brand income states (offered / earned / pending approval / paid) map onto the existing opportunity status flow, deal deliverables and `dealPayoutService` (paid = ledger row). They are to be confirmed in the continuity design.

### 22.10 Tests and rollback (for the later migration request)

**Tests:**
- **Replay:**
  - accepted vs unaccepted predecessors;
  - a bonus after a slot;
  - a special excluded;
  - ambiguous specials excluded;
  - an unslotted target;
  - a two-parter;
  - deleted episode rows;
  - administrative rows excluded;
  - episode-less purchases flagged;
  - diminishing returns at high stats.
- **Stability:**
  - completing a later episode leaves E's snapshot hash unchanged;
  - accepting an earlier one marks it stale.
- **Consumers:** the script context for an old episode reads its snapshot, not live state.
- **Migration:** up / down / up.

**Rollback:**
- The snapshot table is append-only and additive; `down` drops it only when empty, or after export.
- Consumers fall back to today's reads behind a switch, so turning the switch off restores current behaviour.

### 22.11 What Evoni runs

`continuity-export.sql` (read-only, same SSH and getv pattern) → copy back `~/continuity-export.txt` → I run the local replay and publish the Episodes 1–2 preview here. Nothing is migrated.

### 22.12 Episodes 1–2 continuity preview: results (production export, 2026-11-04)

The export was read-only (14 sections, `default_transaction_read_only`, no errors). The replay ran locally with the repo's own `orderEntries`, `precedingEpisodes`, `applyDeltas` and defaults. Nothing was written anywhere.

**Story order** (`seasonStoryOrder` on production rows): one arc ("Soft Luxury Ascension", S1), 24 weekly slots, three bonus specials after slot 3.

| Pos | Entry | Episode | Accepted | Continuity |
|---|---|---|---|---|
| 1 | S1 · slot 1 | "I Designed My Outfit for a Fashion Studio Experiment" (8b9301a6) | **no** | canonical |
| 2 | S1 · slot 2 | none yet (event a5b66dca pencilled) | — | canonical |
| 3 | S1 · slot 3 | none yet | — | canonical |
| 4–6 | three bonuses after slot 3 | none | — | **order ambiguous** (`same_slot`) |
| 7… | slots 4–24 | none | — | canonical |

- **No unslotted live episodes.** The only order issue is `same_slot`: three bonus rows after slot 3, all for the same release (2026-12-02 10:00), created within 45 seconds on 2026-10-26. **Correction (continuity-readiness report §5): they are three distinct bonus candidates with different titles and events, not duplicates.** They are ambiguous only because they share a suggested release time. Excluded from carry-over pending Evoni's individual review.

**Opening states:**

| | Episode 1: canonical | Episode 2: canonical | Episode 2: simulated (if Episode 1 were accepted) | Live state today (what scripts read) |
|---|---|---|---|---|
| Coins | **1,900** | **1,900** | 768 | 768 |
| Reputation | 1 | 1 | 1 | **8** |
| Brand trust | 1 | 1 | 1 | **7** |
| Influence | 1 | 1 | 1 | **7** |
| Stress | 0 | 0 | 0 | **2** |
| Relationship changes carried | 0 | 0 | 0 | all current rows |
| Approved story records carried | 0 | 0 | 0 | — |

### 22.13 Findings from the preview

1. **Live stats are contaminated by deleted test episodes.** Today's reputation 8 / brand trust 7 / influence 7 / stress 2 come from February test episodes, all deleted on 2026-09-21. The live row's `last_applied_episode_id` is "The Velour Throne" (4d54e35d), deleted. The live stats were never reset.
   - The canonical opening state for Episode 1 is the baseline (1 / 1 / 1 / 0), because nothing before it in story order is accepted.
   - **Any script generated today for Episode 1 or 2 reads stats Lala has not earned in the canonical story.** This confirms the Episode 1 integrity audit and is the strongest argument for the continuity view.
2. **Coins are correct in the ledger.** Live 768 = 1,900 seed − Episode 1's own five confirmed purchases (120 + 85 + 32 + 95 + 800 = 1,132).
   - Excluded correctly: four earlier purchase rows are `voided` (three with no episode, one on a deleted episode).
   - Under ruling 4 these five are Episode 1's own confirmed purchases. They belong to Episode 1, not to its opening state, so Episode 1 opens at 1,900.
   - **Episode 2 opens at 1,900 while Episode 1 is unaccepted, and at 768 once it is accepted** (the simulated column).
3. **No stat history is carried.** All 21 `computed` rows belong to deleted test episodes or the undated "The Comeback Garden". Three `manual` World Admin edits and two `wardrobe_purchase` history rows are administrative (ruling 2).
   - Episode 1 has no `computed` row because it hasn't been completed.
4. **Episode 1 has no frozen money plan** (`money_plan` null). Only `season_context` was snapshotted at Start (2026-10-02). The episode's creation time stood in as its Start time.
   - Its `season_context.story_purpose` still says "Lala discovers her authentic design voice…", which conflicts with Evoni's correction that Lala is not becoming a designer. That is a known Episode 1 integrity item and is not changed here.
5. **Wardrobe ownership likely disagrees with the ledger.** 13 owned items; 9 have a purchase row. 9 = Episode 1's 5 executed purchases + the 4 **voided** ones, which suggests up to four items are still marked owned although their purchases were voided.
   - A read-only follow-up (owned items vs executed purchase rows) would confirm it. Not changed.
6. **Nothing else carries.** No relationship events are tied to any episode. There are no `pulse_followers` rows. Episode 1's story record is still a draft.
7. **`seasonStoryOrder` works on real data.** It placed every slot, found no unslotted live episode, and flagged the duplicate bonuses as ambiguous rather than ordering them silently.

**Readiness for the migration request (G2):** the replay, sources and exclusions behave as designed on production data. Requesting the `episode_continuity_snapshots` migration still waits on:
- Evoni's review of this preview;
- the "confirmed purchase" decision (§22.9);
- the story-effective adjustment fields (§22.8);
- the review of the three same-time bonus specials.

See `2026-11-04-continuity-readiness-report.md` for the purchase-path audit, wardrobe reconciliation, Episode 1 wording proposal, gates and tests.


---

## 23. Answered decisions (Evoni, 2026-11-04): design approval vs production authorization

"Design approved" means the approach may be specified, prepared and tested. "Production change authorized" means a specific write may run. **No production write, migration, merge, deployment or historical correction is authorized by this table.** Each one still needs its own explicit yes.

| # | Decision | Answer (Evoni, 2026-11-04) | Design approved? | Production change authorized? |
|---|---|---|---|---|
| D1 | Episode 1 Lock charges (1,012 coins) | Keep as valid historical purchases, classified **legacy Lock-origin purchases**. No refunds, no duplicate charges. | yes | **not needed** (no data change; classification is read from `metadata.flow`) |
| D2 | Four test-voided items still owned | Remove ownership that exists **only** because of voided test purchases | yes | **YES ("YES TO B", 2026-11-04)**: these four items only, via the tested procedure (prepared-corrections §7); runs after the procedure is confirmed |
| D3 | Necklace, pumps, blouse | **Provisionally pre-owned** for continuity planning, pending acquisition-history verification. Not charged; not marked verified. | yes | **no** (no data change; a continuity rule) |
| D4 | Plaid vest dress | Ownership **unresolved**; excluded from canonical wardrobe availability pending verification | yes | **no** (no data change; a continuity rule) |
| D5 | Three bonus specials | Preserved as **distinct stories**; order and release times pending review; no delete, merge or auto-reschedule | yes | **no** (nothing to change) |
| D6 | Episode 1 narrative purpose, dilemma, lesson | Wording approved; edits 1 and 2 prepared | yes | **YES ("YES TO A", 2026-11-04)**: slot 1 purpose + brief Intent only, via the tested procedure (prepared-corrections §7); runs after the procedure is confirmed |
| D7 | Frozen Start snapshot | Preserve the original; an append-only correction note is prepared, not written | yes (prepared-corrections §3) | **no** |
| D8 | Narrative purpose ownership | **Ruled (Evoni, 2026-11-04):** before Start the Season Roadmap owns the *proposed* purpose; after Start the **Episode Brief owns the authoritative purpose**; the Roadmap **displays the linked brief purpose** rather than keeping a competing editable copy | yes (for the later workflow implementation) | n/a (later PR) |
| D9 | Purchases (earlier ruling) | Only an authoritative Purchase charges; Lock finalizes and never charges | yes | code PR not yet written (gate G-P2) |

Prepared changes, existing values, undo and the read-only dependency query: `2026-11-04-prepared-corrections.md`.
