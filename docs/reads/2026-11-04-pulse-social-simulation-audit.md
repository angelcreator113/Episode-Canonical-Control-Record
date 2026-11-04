# The Pulse as a living social simulation: audit and design (2026-11-04)

**Status:** a read-only audit and a design proposal. Nothing is implemented. No worker was started, nothing was regenerated, and no production record was read or changed for this document.
**Basis:** code at origin/main `d465cb4a`, read by five parallel read-only audits (system map; voice; photography; brands; event→canon chain with workers and cost). I then re-read the strongest claims myself; each is marked *(verified)*. Claims that depend on production data or env settings are marked *(code only)*.
**Governing principle** (Evoni, 2026-11-04): *Dream Cities creates life. Lala has to afford that life. JustAWoman decides how she navigates it.* For The Pulse this means:
- the world may talk on its own;
- money, accepted canon, approved relationships and brand deals move only when JustAWoman decides.

**Status words** used throughout:
- **WORKING**: wired end to end and something triggers it.
- **MANUAL**: works only when Evoni clicks.
- **DISCONNECTED**: built, but nothing calls it or it has no UI.
- **INCOMPLETE**: partial.
- **UNUSED**: dead or superseded.

---

## 1. Current Pulse Architecture Map

### 1.1 What decides whether anything runs on its own

| Switch | Turns on | Default |
|---|---|---|
| `PULSE_ENGINE_ENABLED` | the `pulseQueue` worker (polls every 15s) and every queue handler (event, comment, ambient, storyline, voice, dm, moment); the hourly schedulers in `pulseAmbient`, `pulseStorylines`, `pulseVoices`, `pulseRecap` | off |
| `WORLD_MOMENTS_ENABLED` | the `worldMoments` scheduler (every 6h) | off |
| `FEED_SCHEDULER_ENABLED` | the `feedScheduler` six-agent cycle (every 4h): profiles, finalize, relate, follow, cross, discover | off |
| *(no switch)* | `postRelease.startScheduler`, every 60s: releases scheduled posts and makes waiting post pictures | **always on** |
| per show, `shows.metadata.pulse_engine` | `events_enabled`, `ambient_enabled` (off), `storylines_enabled` (on), `voices_enabled`, plus daily request caps (`pulseRequests`) | mixed |

Which env switches are on in production is not readable from code *(code only)*.

### 1.2 Layers

```
INPUTS
  episode completion ─(engine on)→ pulseEventPosting.enqueueForEpisode ; pulseFollowers.proposeEpisodeChange ; episodeStoryRecord.draftLater
  Start Episode → feedMomentsService (Lala's phone) ; feedActivityService (template JSON, never reaches the feed)
  money ledger → financialFeedService (Lala drafts, templates)
  world calendar → worldMoments (world_events drafts; press/trend jobs)
  story "What changed" Save → relationshipTruth.afterStorySave ; storyRipples
  buttons → characterPosts, brandPulse, pairStorylines, pulseDms, feedCommentDrafter, feedPostRedrafter, scriptPostDrafts, generateRippleEffects
  feedScheduler (env) → social_profiles / social_profile_relationships / social_profile_followers
GENERATION
  pulseQueue (caps: pulseRequests) → handlers → pulseDrafter (+ postFormatMix, posterWorld, pulseKnowledge)
  outside the gate: feedEngagementService ripples, feedActivityService, financialFeedService
GATE / REVIEW
  pulseGate.check + reviewReasons → pulseTrust.trustedReview → publish, or Admin › Pulse › Review
RELEASE
  publish now | postRelease schedule / hold (60s timer) ; pulseReveals / pulseTeasers filter visibility by story moment
ENGAGEMENT (on live)
  pulseNumbers.propose → pulseFollowers.proposeFromPost ; pulseCloseness.proposeFromPost ; postPictures
READ SURFACES
  /pulse (SocialMediaPage), Lala's Phone (ScreenContentRenderer), Admin › Pulse tabs, public recap and polls
RELATIONSHIPS / STATS
  pulse_closeness → pulseKnowledge + who posts (a closed loop inside the Pulse)
  pulse_followers → character_state_history (followers only) + seasonArcProposals ; never reputation, influence or brand_trust
STORY
  scriptPulsePosts → script ; pulseStorylines ↔ show_story_threads (read) ; episodeStoryRecord → storyRipples → Review
```

### 1.3 Capability status

| Capability | Main code | Trigger | UI | Status |
|---|---|---|---|---|
| Voiced, gated post drafting | `pulseDrafter.draftPost` / `draftAndRoute` / `draftBatch` | used by 8 services | — | WORKING (library) |
| Event reaction posts and comments | `pulseEventPosting.enqueueForEpisode` / `handleEvent` / `handleComment` | auto at episode completion (engine on); manual "draft early" | Admin › Pulse › Engine | WORKING, gated; manual jobs wait forever if the engine is off |
| Ambient everyday posts | `pulseAmbient` | hourly + show switch (off) | Engine | WORKING, off by default |
| Character "Generate posts" | `characterPosts.generatePosts` | manual | Character profile | MANUAL |
| Brand posts, replies, deal announcements | `brandPulse` | manual (ADMIN) | PulseBrands, Brand profile | MANUAL |
| World moments (press, trends, city events, awards) | `worldMoments` | 6h + show switch | World Moments tab | INCOMPLETE: enqueues under `WORLD_MOMENTS_ENABLED`, but the handlers drain only under `PULSE_ENGINE_ENABLED` |
| Planned storylines | `pulseStorylines` | hourly (engine); `suggestBeats` manual | PulseStorylines | WORKING / MANUAL |
| Pair storyline seed | `pairStorylines.seedStoryline` | manual; nothing saved | PairStoryline | MANUAL |
| Story ripples (story change → posts) | `storyRipples.proposeLater` | after the manual "What changed" Save | Review | WORKING |
| Script `[UI:POST]` → Lala drafts | `scriptPostDrafts` | manual | Script tab | MANUAL |
| Posts → script context | `scriptPulsePosts` | auto in the script writer | — | WORKING (event-tied posts only) |
| Money posts | `financialFeedService` | auto from `financialTransactionService` | Review | **WORKING but broken** (§7, M1) |
| Post-event "activity" | `feedActivityService.generatePostEventActivity` | auto at Start Episode; also written by a GET | blueprint modal list only | DISCONNECTED (never reaches the feed) |
| Viral ripples | `feedEngagementService.generateRippleEffects` | manual button (EventFeedDashboard) | EventFeedDashboard | MANUAL, **bypasses every rule** (§7, M2) |
| Momentum / chain events | `computeFeedMomentum`, `chainEventFromMomentum` | manual; the momentum GET writes `world_events` | EventFeedDashboard | MANUAL |
| Feed → opportunities | `feedEventPipelineService.generateOpportunitiesFromFeed` | manual | EventIdeasDrawer, Opportunities | MANUAL; `/suggestions` has no caller (DISCONNECTED) |
| Phone feed moments | `feedMomentsService`, `persistFeedMoments` | auto at Start Episode; persisted manually | Lala's Phone tab | WORKING; `generateBStoryActivity` UNUSED |
| Old episode post generator | `feedPostGeneratorService` | — | — | UNUSED (retired) |
| Quality gate, knowledge | `pulseGate`, `pulseKnowledge` | every drafter | Review | WORKING |
| Review trust per profile | `pulseTrust` | drafters; manual settings | PulseTrust | WORKING (review permission, not reputation) |
| Release, schedule, hold | `postRelease`, `postingSchedule`, `feedPostStatus` | 60s timer; manual | Review post, Release calendar, Schedule all | WORKING |
| Comment reactions | `feedCommentDrafter.draftReactions` | manual | Review post | MANUAL |
| Redraft | `feedPostRedrafter` | manual | Lala feed tab | MANUAL |
| Post numbers | `pulseNumbers` | auto on release | Numbers waiting | WORKING |
| Follower ledger | `pulseFollowers` | auto on numbers, completion, deliverables | Episode followers, Review | WORKING |
| Growth, audience tier | `pulseGrowth`, `pulseAudience` | read | PulseGrowth | WORKING |
| Named follows | `pulseFollows` | manual; auto on Cross | PulsePerson | WORKING |
| Character follow engine | `feedScheduler.autoFollowAgent`, `autoAssignAllFollowers` | env / profile generation | Profile generator | WORKING (legacy third store) |
| Lala's profile | `lalaFeedProfile` | used by ~30 services | Lala feed, /pulse | WORKING (the canonical resolver) |
| Lala reactions (AI) | `socialProfileRoutes /:id/lala-reactions` | manual; nothing saved | FeedEnhancements | DISCONNECTED |
| DMs | `pulseDms` | manual enqueue; worker drafts | Messages, Phone | MANUAL; needs the engine |
| Polls, reveals, teasers, recap, calendar | `pulsePolls`, `pulseReveals`, `pulseTeasers`, `pulseRecap`, `pulseCalendar` | manual / hourly (recap needs the engine but uses no AI) | Pulse tabs | WORKING |
| Closeness | `pulseCloseness` | auto on any post or comment going live | Closeness waiting, Relationship map | WORKING, but never reaches story relationships |
| Relationship truth | `relationshipTruth.afterStorySave` / `driftReport` | auto on story-pair save | relationship pages | WORKING, one way (story → Pulse) |
| Entanglement ripples | `rippleEngine.fireRipple` | manual | FeedRelationshipMap | MANUAL |

**Lala's participation:**
- She posts only as drafts: from script lines, money events, story ripples' soft launches and event attendance. Her posts always go to Review (`pulseTrust` ALWAYS_REVIEW).
- She "sees" The Pulse on her Phone as of a beat, and the script reads other people's posts.
- Her awareness of a post never changes her state. Only accepted episode follower changes reach her (a `character_state_history` row).
- Likes, virality and closeness never move reputation, influence or brand_trust. That is by ruling (`pulseAudience` header).

---

## 2. Character Voice and Dialogue Audit

### 2.1 Where voice lives

| Store | Written by | Read by |
|---|---|---|
| `social_profiles.posting_voice`, `vibe_sentence`, `public_persona`, `content_persona`, `posting_schedule` | the profile generator, `feedScheduler` | voice build, comment drafter, redrafter, script writer (guest voice), frequency |
| `registry_characters.voice_signature` (speech_pattern, vocabulary_tone, catchphrases, tell, emotional_reactivity…) | Registry, character generator | `characterVoice` (**scripts only**), `pulseVoices.voiceSource` |
| Registry persona and inner-life fields (mask, signature_trait, emotional_baseline, therapy state, living_state, wound/want, typology) | Registry, generator | `pulseDrafter` (living_state as private mood), `characterPosts` (wound), the script writer |
| `pulse_voices.habits_json` (case, punctuation, emoji, sentence length, temperament, topics, never_says, signature_phrases), `examples_json` (max 20) | `pulseVoices.buildVoice` (Haiku, falls back to Sonnet); Evoni's edits; `learnFromEdit` | `pulseDrafter`, `characterPosts`, `pulseDms`, `pulseGate.voiceScore` |
| `character_voice_lines`, `voice_signals`, `voice_rules` | `characterVoice.captureOnLock` (locked script beats), `learnVoice` | `characterVoice.voicePromptBlock`: **scripts and briefs only** |
| `world_characters` speech fields | World Studio | no Pulse or script voice block |

Three things that are not voice systems, despite their names:
- `voiceStudioService` handles recorded audio takes.
- `pulseVisibility` explains why someone's posts are missing.
- `contentTypeHistory` records content type by story moment.

### 2.2 Generator by generator

No generator sets `temperature` (the API default applies).

| Generator | Model | Voice used | Tone by relationship | Knowledge bounded | Mood | Own examples |
|---|---|---|---|---|---|---|
| `pulseDrafter` posts | Sonnet | habits + examples ×8 | no | yes | living_state (private) | yes, often "(none yet)" |
| `pulseDrafter` comments | Sonnet | habits + ×6 | **no** (poster handle only) | yes | yes | yes |
| `feedCommentDrafter` | Sonnet | posting_voice, persona; **no pulse_voices** | type label only | **no** | no | no |
| `feedPostRedrafter` | Sonnet | posting_voice; **no habits or examples** | — | no | no | no |
| `pulseDms` | Sonnet | **public** habits and public examples | **no** | yes | yes | public only |
| `characterPosts` | Sonnet | habits, typology, mask, facts | no | yes | living_state + wound | yes; **the only one that avoids repeating her last 6 posts** |
| `brandPulse` | Sonnet | static brand personality, rep's speech pattern | brand relationships | canon only | no | one sample line |
| `financialFeedService` | none | three fixed templates | — | — | — | — |
| Script writers | Sonnet | `JAWIHP_VOICE_DNA`, approved locked lines, learned rules | yes | yes (who-knows) | therapy state, baseline | approved lines |
| `characterTalk` | Sonnet | character file only | from file | file-bounded | inner life | session notes |

### 2.3 Why characters sound alike, polished or repetitive (most important first)

1. **Two voice systems that never meet.** Approved script lines and learned rules (`character_voice_lines`, `voice_rules`) never reach a Pulse prompt. Pulse edits never reach scripts. Pulse voices are an eight-field template from one Haiku call.
2. **Few real examples.** `examples_json` grows only from Evoni's edits or pins. A draft approved unchanged teaches nothing. Prompts often print "(none yet)" or the same 6–8 lines, so the model falls back to its house style.
3. **One call writes many voices.** Batch posts, batch comments and `feedCommentDrafter` write every speaker in one completion under one rule list, so rhythm and length converge.
4. **Shared flattening rules.**
   - Every comment prompt says "short".
   - About 70 banned phrases are pasted into every prompt.
   - Sparse habits default to the same values (`normalizeHabits`: sentence, rarely, short, regular).
   - Lala's script DNA fixes "bestie" and "always positive".
5. **Almost no memory of what was already said.** Only `characterPosts` sends recent posts. The gate checks conformity, not repetition. Money posts cycle three templates.
6. **No private voice and no relationship tone.** DMs reuse the public voice. Comment and DM prompts never see closeness, although `pulseCloseness.closenessAt` exists. Conflict and flirting styles exist nowhere.
7. **Mood is static.** `living_state` is set at generation and edited by hand. `character_state` holds stats, not feelings.
8. **The gate rewards sameness.** `voiceScore` passes drafts that match the template; variety is flagged and repetition is not.
9. **Some drafters drop the voice entirely.** The redrafter and `feedCommentDrafter` ignore `pulse_voices`. `feedCommentDrafter` also ignores knowledge limits.
10. **A rebuild overwrites hand edits.** `pulseVoices.buildVoice` writes status `built` over an `edited` voice with no server guard *(verified: the update sets `status: 'built'`)*. Rebuilds can also learn from AI posts released on trust that Evoni never touched.

### 2.4 Proposed Character Voice & Behavior Profile

**Design:**
- One **read-only resolver** (e.g. `voiceProfile.resolve(character, { channel, addressee, at })`) assembles the profile at draft time from existing stores, in this order:
  1. approved lines;
  2. active `voice_rules`;
  3. `pulse_voices` habits;
  4. `voice_signature`;
  5. `posting_voice`.
- The Registry owns identity. Nothing writes back into canon, and approved or locked dialogue is never edited.

| Field | Home (existing first) | Derived from (never overwriting) | Readers |
|---|---|---|---|
| Vocabulary and sentence structure | `pulse_voices.habits_json` + `voice_signature.speech_pattern` / `vocabulary_tone` | active `voice_rules` (word choice, catchphrase, line length, banned word, punctuation), shown alongside | every drafter |
| Humour and emotional expression | new keys `habits_json.humor`, `habits_json.under_stress` (no migration; `normalizeHabits` must keep them) | `voice_signature.emotional_reactivity` / `tell`, `emotional_baseline` | posts, DMs, scripts |
| Public vs private voice | `habits_json.public` (today's keys) + `habits_json.private`; `examples_json[].channel` (post / comment / dm) | DM approvals, character-talk tone; private material never enters public builds | `pulseDms` (private), others (public) |
| Conflict and flirting style | `habits_json.conflict`, `habits_json.flirting` | **major** `voice_rules` (attitude, relationship), which need Evoni's Approve | comments, DMs, scripts |
| Social habits and frequency | `temperament` + `social_profiles.posting_schedule` + `habits_json.reply_habits` | `pulseAmbient` chance, `postingSchedule` | ambient, reactor choice |
| Relationship-dependent tone | computed band (cold / acquaintance / close / intimate / rival) from `pulseCloseness.closenessAt` + `relationship_type` (no migration). A stored per-pair tone needs a migration. | the ledger and relationship type | comment and DM drafters |
| Current emotional state | read `living_state` and therapy state as they are. A dated mood line needs a migration. | approved storyline beats and closeness changes, proposed into Review | every drafter, as private context |
| Motivations and secrets | wound / want / hidden_want, `character_secrets`, `relationshipKnowers` | read only | private block (gated by `pulseGate.privateLeaks`) |
| Knowledge boundaries | `pulseKnowledge`, `secretsKnownBy` | — | add to `feedCommentDrafter` and the redrafter, which lack them |
| Voice examples | `examples_json` + `character_voice_lines`, merged per channel at read time; optionally sample live posts Evoni wrote or edited | never unchanged AI posts | every drafter and `voiceScore` |

**Generator changes this implies (none made):**
- one voice per call, or per-speaker rules in batches;
- the speaker's last posts and comments passed everywhere;
- drop the blanket "short";
- a repetition flag in the gate (`characterVoice.similarity` exists);
- the address band in comment and DM prompts;
- `buildVoice` refuses to overwrite an `edited` voice without an explicit choice.

**Approval:** small habit additions apply with Undo. Conflict, flirting, relationship tone and mood are **major** and wait for Evoni's Approve, mirroring `characterVoice` SMALL vs MAJOR types.

---

## 3. Character Photography and Avatar Audit

### 3.1 Current state

| Concern | Where | Status | Problem |
|---|---|---|---|
| Identity reference (headshot) | `cameraRoll.setHeadshot` → `media_asset_links.role='headshot'` | WORKING, MANUAL | It is suggested from `portrait_url`, the avatar, so reference and avatar blur from the start. |
| Pulse avatar | `registry_characters.portrait_url`, read by `feedPostRoutes.withAuthorPortraits` | WORKING, MANUAL | `social_profiles` has **no avatar of its own**; the account shows its character's portrait. |
| Portrait generation | `characterAppearance.generatePortrait` → fal.ai Flux Pro 1.1 | WORKING | Text only, no reference, seed not stored. Prompt: "editorial portrait photograph … looking at the camera, soft natural light". Right for a reference, wrong for a social avatar. |
| Camera roll photos | `cameraRoll.make` → OpenAI `gpt-image-1.5` image edits | WORKING | Uses the headshot (plus up to 2 people) as reference. Its prompt is already candid ("ordinary phone-camera quality, not a studio"). **The most realistic path.** |
| Post pictures | `postPictures` (`feed_posts.photos`, `image_url`, `picture_job`) | WORKING | Reuse before making; daily cap `PULSE_POST_IMAGES_PER_DAY` (20). |
| Picture suggestions | `pictureSuggestions` | WORKING | Takes faces from `portrait_url` and portrait assets, **not** the official headshot. Its "create" prompt lacks the phone-camera wording. |
| Library and dedupe | `mediaLibrary` (md5 of URL) | WORKING | URL-only dedupe; a person's photo is used on one post only. |
| Cost | `imageCostService.runImageCall` | WORKING | Portrait generation passes no route name. |
| Identity consistency | reference image only | INCOMPLETE | Flux makes the reference and gpt-image re-renders it (two models). No seed, LoRA or face check. |
| Per-character photo style | none | MISSING | Everyone gets the same ≤1/3 faces rule, the same taker looks and the same albums. |
| Brand visual identity | `postPictures.brandShot` (product, no faces) | INCOMPLETE | `lalaverse_brands` has no logo. A brand account with no character shows initials. |

**Existing photo modes:**
- **Takers:** selfie, mirror, friend, timer, photographer.
- **Albums:** everyday, work, travel, events, social, fashion, objects.
- **Purposes:** posted, private, sent, work, memory, screenshot.
- **Gaps:** OOTD is inferred from caption words; behind-the-scenes has no mode of its own.

### 3.2 Why photos can look staged or inconsistent

- **Three identity sources:**
  - the headshot link (camera roll);
  - `portrait_url` plus portrait assets (suggestions, variations);
  - `portrait_url` (avatar).
- **Two models** (Flux, then gpt-image), plus JPEG re-encoding of every image.
- **Different tie-breaks when two characters share a profile:** the avatar picks the newest character, while photo paths pick the oldest. The face on the avatar and in the photos can then belong to different people.

### 3.3 Brand and character image sharing

- **A candid avatar becomes a face reference.** Whatever `portrait_url` holds becomes a portrait asset and a face reference, and is offered as the headshot.
- **Company stand-in characters are not refused** a personal camera roll or face shots (`cameraRoll.refusalFor`, `postMedia.posterOf`).
- **The avatar ignores brand identity.** A brand account linked to a founder-like character shows the founder's face.
- **Studio by Sable** (code reading; production images not checked):
  - @studiobysable shows character c4931651's portrait, a person's face if one is set.
  - Without `lalaverse_brand_id` on the profile, its post pictures treat it as the person: "camera roll of Sable Okonkwo-Reyes", with selfies and OOTD.
  - **Likely result:** a studio account posting a person's selfies.

### 3.4 Proposed photography system

Nothing is regenerated. Today's avatars stay until Evoni approves a change, and every new image is a draft until approved.

- **A. Identity reference** (Registry-owned, approved, internal only):
  - **Home:** `media_asset_links.role='headshot'`, plus optional extra angles `role='identity'`.
  - **One source for every path:** suggestions and variations switch from `portrait_url` to the headshot.
  - **Provenance:** seed and prompt stored in `media_assets.generation`.
- **B. Profile picture** (per account; may be candid):
  - **Home:** `social_profiles.full_profile.avatar = { asset_id, url, chosen_at, chosen_by }`, jsonb, no migration.
  - **Fallback:** the avatar renderer reads it first and falls back to `portrait_url`, so nothing changes until a choice is made.
  - **Choosing:** from approved assets, or a camera-roll moment with purpose `avatar`.
  - **Rule:** a profile picture is never used as a face reference.
- **C. Photo style preferences per character:**
  - **Home:** `registry_characters.extra_fields.photo_style`, jsonb, holding:
    - `face_ratio`;
    - `taker_weights` (selfie / mirror / friend / timer / photographer);
    - `framing`, `filter`, `settings` (favourite places);
    - `photographed_by` (whose headshots join);
    - `never`.
  - **Readers:** camera-roll planning, post pictures, the photo prompt.
  - **Approval:** proposed by AI, saved only by Evoni.
  - **Style modes to add as explicit choices:** selfie, OOTD, candid by a friend, event, travel, behind-the-scenes, product.
- **D. Brand visual identity:**
  - **Home:** asset links on `entity_type='brand'` with roles logo, product, campaign, founder.
  - **Avatar:** the brand account's own avatar, normally its logo.
  - **Routing:** every picture path treats a brand account, or a company stand-in, as a brand; faces never.
  - **Founder face:** only through an explicit founder link to a separate person.
- **Cost:**
  - keep the daily cap, image budget, caption-hash cache and one-post-per-person-photo rule;
  - add a per-character monthly image count from `ai_usage_logs`.

**Migrations:** none, if the values above stay in jsonb and the role/purpose columns are free text (to verify). A real avatar column or a brand logo column would each need a migration.

---

## 4. Brand Social Behavior Audit

### 4.1 What brands can do today

| Capability | Code | Status |
|---|---|---|
| Brand account | `brandPulse.ensureAccounts` creates accounts for `kind='brand'` rows and marks `full_profile.lalaverse_brand_id` / `account:'brand'` | WORKING for seeded brands; an existing account (447) is never recognised |
| Official posts | `brandPulse.draftBrandPost` / `draftWeek` → gate → trust | WORKING, MANUAL |
| Distinct voice | `lalaverse_brands.personality` or `BRAND_PERSONALITIES`; `brandVoiceBlock` separates canon, beliefs and a rep's own views, and bans new facts and money | WORKING |
| Representatives | `REPRESENTATIVES` constant; `repFor`; `signature()`; `canAnnounce` (founder-level reps only) | INCOMPLETE: reps linked in `extra_fields` show on the profile but cannot sign |
| Reply to creators | `brandPulse.replyCandidates` → `draftReply` (draft comment) | WORKING, MANUAL |
| Announce events and campaigns | `world_events.host_brand` (text). Event posting never picks brand accounts. | DISCONNECTED (no event → brand post path); deal announcements WORKING (booked deals only, always reviewed) |
| Offer partnerships | `generateOpportunitiesFromFeed` (any profile with relevance ≥5 → `offered`, no `company_id`); `linkDeal` only on create/PUT; status advances by ADMIN only | INCOMPLETE: offers are proposals (good) but unlinked to companies |
| React to reputation | `brand_trust` is one global Lala stat; per-brand trust does not exist; brand hints in ripple JSON are never read | UNUSED |
| Brand pages | `/brands`, `/brands/:slug`, PulseBrands | WORKING; Studio by Sable absent (no brand row) |

### 4.2 Where person behaviour leaks onto brand accounts

Today's only guard is `families.js GET /people`, which excludes brand accounts and company characters. It is the template for the rest. The leak points:

1. **`relationshipTruth.syncStoryPair` / `driftReport`.** They check only `extra_fields.company_id`, never the linked profile's account kind. A person whose `feed_profile_id` is a brand account gets every confirmed story pair mirrored onto it, romances included.
   - **Production already shows six "From the story: …" rows on @studiobysable,** two of them `couple`.
   - `syncStoryPair` mirrors only confirmed pairs, so either those romances were confirmed at some point or another path wrote them. Q2/Q3 of `sable-followup.sql` answer this.
2. **`crossProfile`.** No brand check. It turns a brand account into a person character (display name from the account, selected name from the creator), which is the Sable shape.
3. **`pulseVoices.eligible` / alive profiles.** Any character with a `feed_profile_id` can post in a personal voice, DM and gain closeness through that account.
4. **`feedCommentDrafter.pickReactors`.** No account-kind filter, so a brand can be drafted reacting like a person.
5. **`feedEngagementService.generateRippleEffects`.** 8 random profiles from **all** shows and layers, brand accounts included, post templated gossip **live** with no gate *(verified)*.
6. **`pulseFollows.friendsOfLala`.** A mutual follow with a brand counts as Lala's "friend".
7. **`generateOpportunitiesFromFeed`.** A brand account becomes a "connector" person with no `company_id`.
8. **`companyCharacters.lookAlikes`.** It would suggest making c4931651 (a person with romances) "a company" because of the word "studio".

### 4.3 Proposed brand social behavior model

**Who's who:**
- **Brand record:** `lalaverse_brands`. `personality` is the only source of the official voice; canon columns stay protected.
- **Brand account:** a `social_profiles` row with `full_profile.account='brand'` (+ `lalaverse_brand_id` once the brand row exists).
- **Representatives:** registry characters with `extra_fields.brand_id`, `title`, `authority {creative, negotiate, spend, finalize}`. `repFor` / `canAnnounce` must honour these, not only the constant. Rep posts are signed; a rep's own views are labelled hers.
- **Founder:** a person with her own character, her own personal account (if any) and her own relationships. Linked by `extra_fields.founder_of` and read on the brand page. `lalaverse_brands.founder` stays as prose. A founder FK column is optional and needs a migration.

| A brand account may | A brand account may never |
|---|---|
| post official content in its personality | hold romance, family or friendship rows |
| reply, notice and thank (drafts first) | DM flirtatiously; business DMs only via a rep, after a ruling |
| announce booked deals and events it hosts (always in Review) | be crossed into a person, be "Alive" or carry a person's voice |
| hold business ties: client_partner, sponsor, represents, press, rival_brand, fan | name money or terms |
| follow and be followed (audience, not friendship) | count as Lala's friend |

**Reactions to events and reputation:**
- When an event whose host is a brand completes, the brand **drafts** a thank-you or recap post into Review.
- The outcome shapes its tone, never canon.
- Per-brand regard for Lala is a proposal kept in `personality.relationship_to_lala` (jsonb), or a later table.

**Partnership offers:**
- Always `offered`, with `company_id` set by `linkDeal` everywhere offers are created.
- Advancing an offer is JustAWoman's explicit action.
- No offer path writes compensation or ledger rows. "Unspecified" stays unspecified.

**Guards** (one PR each, on approval):
- an `isBrandAccount(profile)` helper;
- `crossProfile` refuses brand accounts;
- `syncStoryPair` / `driftReport` never mirror personal kinds onto a brand account;
- brand accounts filtered out of voice eligibility, reactor picks, ripples, DMs, closeness and `friendsOfLala`;
- `lookAlikes` suggests "founder of" instead of "make a company" for a person.

### 4.4 Studio by Sable under this model

This extends `2026-11-04-studio-by-sable-separation-plan.md`. Nothing has been done.

- **@studiobysable (447):** the official account, marked `account:'brand'` on approval. Its posts are kept. With the guards in place it leaves the ripple, reactor, DM and closeness pools. Its existing personal rows are kept but flagged on `driftReport` as "personal tie on a brand account" for Evoni.
- **Sable (c4931651):** stays the person; she is never made "the company". Her link to 447 (D1 in the plan) is the root of every leak. The model's answer is to clear it or give her a personal account, and to record `founder_of` once the brand exists.
- **Brand record:** proposed only. When created, link 447 to it explicitly, or `ensureAccounts` would create a second `@studiobysable…official`. Personality stays empty until Evoni writes it.
- **Romances:** unconfirmed and untouched. If confirmed later, they mirror only to her personal account.
- **Business ties (First Light, Velour Atelier):** move to brand ↔ brand when the brand exists. The originals are kept.
- **Ori Beauty:** unresolved; no mirror, and no rep authority granted.
- **Spring Capsule:** stays as recorded. `company_id` is set via `linkDeal` after the brand exists. Compensation is unspecified. It can be announced only once booked, from 447 or a signed rep, through Review.

---

## 5. Pulse-to-Episode-to-Story Workflow Map

| Stage | Services / routes | Trigger | UI | Status | Where it breaks |
|---|---|---|---|---|---|
| **World event → posts** | `pulseEventPosting.enqueueForEpisode` → `pulseDrafter`; `worldMoments` city events (no AI) | auto only at episode completion (engine on); manual "draft early" | Admin › Pulse › Engine | conditional | Creating or changing an event drafts nothing. A world event with no episode never gets posts. |
| **Posts → reactions** | `handleEvent` → comment jobs; `pulseDms`; `pulseStorylines`; `pulseAmbient` | auto after event jobs; DMs manual; storylines and ambient hourly | Review, Storylines | WORKING (engine on) | Only engine-drafted posts get reactions. |
| **Reactions → relationships / reputation** | `pulseCloseness.proposeFromPost`, `pulseNumbers`, `pulseFollowers`; stats only at completion | auto proposals on live; small non-Lala changes auto-accepted | Closeness waiting, Relationship map | INCOMPLETE | **The Pulse never reaches `character_relationships`.** Comments and DMs never change `character_state`. |
| **→ story suggestions** | `seasonArcProposals` (reads state, followers, storylines, profiles); `pairStorylines`; `pulseStorylines.suggestBeats`; `threadInbox`; `storyThreadService` | arc proposals on episode accepted, storyline paid off, follower jump; the rest manual | Season › Overview proposals; PairStoryline; Season threads | INCOMPLETE | Proposals ignore closeness, comments, DMs and ripples. |
| **→ episode beats** | `episodeGeneratorService` (beat outline: **no Pulse data**); `scriptPulsePosts` (script reads event-tied posts); `feedMomentsService` | manual (Start Episode, script) | Script tab, Scenes | WORKING for event-tied posts; DISCONNECTED for storylines and closeness | The beat outline cannot see The Pulse. |
| **→ accepted canon** | `episodeStoryRecord.draftLater` → **`approveRecord` (explicit Save)** writes secrets, threads, confirmed relationships, follow-ups, twists → `storyRipples`; `storyCanon` accept; `completeEpisode` | explicit | Story Record, Canon card | WORKING / MANUAL | — |

### 5.1 What can change protected things without its own approval today

- **Accepted canon, confirmed relationships, brand deals:** no unapproved path.
  - Story pairs are confirmed only through ADMIN routes or the Story Record Save.
  - Deals are booked only through the explicit schedule route.
- **Ledger:** written only by the explicit Complete action (deduplicated) and explicit ledger routes.
- **Writes that happen without anyone deciding on them individually:**
  1. **Engine posts and comments go live on their own** when the gate passes (`pulseDrafter.draftAndRoute`). This needs the engine on. Lala's posts, reveals and deal posts never auto-publish.
  2. **Engine-scheduled posts publish with nobody clicking.** `worldMoments` and `brandPulse.routeEveryday` set release times, and the always-on 60s release timer publishes them. Its header says "Evoni chose each time herself", which is not true for these.
  3. **Closeness and post numbers** auto-accept small changes between non-Lala characters (a Pulse ledger, not story relationships).
  4. **The feed scheduler** (off by default) writes Pulse relationships with no review (`autoLinkRelationships`, `auto_generated:true`), finalizes profiles and sets trajectories. `autoLinkRelationships` also runs on every single profile generation.
  5. **Story threads open themselves** after an AI check, with Undo. This was ruled by Evoni on 2026-10-26.
  6. **The single Complete click cascades into:**
     - the ledger and stats;
     - `franchise_knowledge` rows created **active with no review**;
     - goals set to completed;
     - new `offered` opportunities;
     - the linked opportunity set to `completed`;
     - host and guest profile state changes.
  7. **Viral ripples publish live** gossip with no gate *(verified)*.

---

## 6. Existing Systems to Reuse

| Need | Reuse | Notes |
|---|---|---|
| One gated drafter | `pulseDrafter` + `pulseGate` + `pulseKnowledge` + `postFormatMix` | Every new generator goes through it. |
| Queue, caps, retries | `pulseQueue` (SKIP LOCKED, backoff 1/4/9 min, 3 attempts, stale requeue), `pulseRequests` | Add wake-on-enqueue. |
| Review and trust | `pulseTrust`, Admin › Pulse › Review | The approval surface already exists. |
| Release control | `postRelease`, `postingSchedule`, release calendar | Event-armed timer instead of 60s polling. |
| Closeness, numbers, followers | `pulseCloseness`, `pulseNumbers`, `pulseFollowers` | Ledgers with proposals and decisions. |
| Voice | `pulse_voices`, `characterVoice` (lines, rules, signals, `similarity`) | Merge at read time. |
| Story bridge | `episodeStoryRecord.approveRecord`, `storyRipples`, `relationshipTruth`, `seasonArcProposals`, `threadInbox`, `storyThreadService` | The approval gates exist. |
| Brands | `brandPulse`, `brandProfile`, `companyCharacters`, `dealTermsDraftService` | Guards needed. |
| Photos | `cameraRoll`, `postPictures`, `mediaLibrary`, `imageCostService` | Camera roll is the realistic path. |
| Season planning UI | `SeasonProposals`, `SeasonArcSuggestions`, `SeasonCast`, `SeasonNeeds`, `SeasonThreads`, `SeasonAttention`, `SEASON_TABS` | Home of the review in §8. |
| Cost | `aiCostTracker` (patches every SDK call; daily budget), `imageCostService`, `aiRateLimiter` | Gaps listed in §7. |

---

## 7. Missing Connections and Duplicate Systems

### 7.1 Defects found (each a separate fix on approval)

| # | Defect | Evidence |
|---|---|---|
| M1 | **Money posts are never linked to Lala's profile.** `financialFeedService.resolveLalaProfile` queries `social_profiles.show_id`, which does not exist. Every call errors, a silent `catch {}` swallows it, and the post gets `id: null`. It also uses the name search that `lalaFeedProfile` replaced. | *(verified)*: no `show_id` column in the schema or migrations; CI database logs show the error. |
| M2 | **Viral ripples bypass every rule.** They go live without the gate, voice, story order, numbers or closeness proposals. The 8 random reactors come from every show and layer. Likes, comments and shares are randomised onto the new rows, breaking `pulseNumbers` ownership. | *(verified)* `feedEngagementService.generateRippleEffects` |
| M3 | **World moments enqueue under one switch and drain under another.** With `WORLD_MOMENTS_ENABLED` on and the engine off, jobs pile up. | app.js switch wiring |
| M4 | **Manual "queue" buttons need the engine.** With it off, jobs sit queued forever. The Engine page reports whether the worker runs. | `pulseEngine` routes |
| M5 | **A GET writes data:** the event outfit route writes feed activity, and the momentum GET writes `world_events`. The outfit route also has a silent `catch {}`. | `worldEvents/outfit.js`, `computeFeedMomentum` |
| M6 | **Voice rebuild overwrites hand-edited voices.** | *(verified)* `pulseVoices.buildVoice` |
| M7 | **Completion writes `franchise_knowledge` as active with no review.** | *(verified)* `episodeCompletionService` inserts with `status: 'active'` (~l.650, 673, 692) |

### 7.2 Duplicates

- **Event reaction posts, 3 live ways + 1 retired:** `pulseEventPosting` (voiced, gated), `feedActivityService` (templates in JSON), `generateRippleEffects` (templates, live), `feedPostGeneratorService` (retired).
- **Comments and replies, 5 ways:** `pulseDrafter` comments, `feedCommentDrafter`, `storyRipples`, `brandPulse.draftReply`, ripple reply *posts*.
- **Everyday posts, 3 ways:** `characterPosts`, `pulseAmbient`, `pulseDrafter.draftAndRoute`.
- **Lala reactions, 2 ways:** the ephemeral `/lala-reactions` route and drafted Lala posts.
- **Three things called "ripple":** `feedEngagementService`, `storyRipples`, `rippleEngine`.
- **Two Lala-profile resolvers** (see M1).

### 7.3 Data ownership problems

- **Follower counts in 5+ places:** `pulse_followers` (canon), `social_profiles.follower_count_approx` / `follower_tier`, `full_profile`, `platform_presences`, `character_state_history`. The scheduler and generators write the copies directly.
- **Follows in 4 places:** `pulse_follows`, `social_profile_followers`, `pulse_followers` (audience size), the legacy `lala_relationship='direct'`.
- **Relationships in 5+ places:** `character_relationships` (truth), `social_profile_relationships`, `pulse_closeness`, `lala_relationship`, the registry map, ripple `relationship_shifts` (written, never applied). Closeness never flows back to story pairs.
- **Feed moments in two stores:** `scene_plans.feed_moment` and the `feed_moments` table.
- **"Trust" means two things:** review permission (`pulseTrust`) and a Lala stat (`brand_trust`).
- **Person vs brand** is held only in jsonb and enforced in one route (§4.2).

### 7.4 Missing triggers

- Creating or changing a world event drafts no Pulse activity. World events with no episode get none.
- Brands and characters never post on their own (no scheduler, unlike ambient).
- Closeness, comments and DMs never propose a story development.
- The beat outline cannot see The Pulse.
- No caller: `feedMomentsService.generateBStoryActivity`, the pipeline `/suggestions` route, `/feed-activity` (no UI), the `lala-reactions` output (never saved).
- The recap needs no AI but runs only under the engine switch.

### 7.5 Automation and cost-control gaps

- **The budget (`aiCostTracker`):**
  - It patches every Anthropic SDK call: logged to `ai_usage_logs`, refused once today's spend plus a worst-case estimate passes `AI_DAILY_BUDGET_USD` (default $50).
  - No direct HTTP calls bypass it.
  - **Gaps:**
    - the estimate ignores input tokens;
    - it fails open if the spend read fails;
    - the 80% warning only goes to the log;
    - there is one global budget, so a feed-scheduler cycle (its own estimate: $30–50) could exhaust the day and block interactive work;
    - the Haiku price in `MODEL_PRICING` ($0.80/$4) should be checked against the current price sheet.
- **Per-show request caps (`pulseRequests`)** do not cover:
  - the `pulseGate` Haiku call on every draft;
  - `pairSuggestions` (Sonnet);
  - `rippleEngine` (Haiku);
  - all of `feedScheduler`;
  - the completion-time AI calls: record draft, thread inbox, next-slot draft, arc proposals.
- **The queue has no per-kind switch for `dm` or `moment`.**
- **`feedScheduler` config and history are in memory** and lost on restart; it runs with `AI_MAX_RETRIES=0`.

---

## 8. Proposed Social Storyline Review (Season Planning)

**Purpose:** one place where JustAWoman sees what the world has been doing socially and decides what, if anything, becomes story. The Pulse may act on its own within permitted social activity. Anything that would touch canon, money, approved relationships or deals arrives here as a proposal.

**Where:**
- a new `SEASON_TABS` key `social` ("Social"), or a card in the Story tab beside `SeasonThreads`;
- a count in `SeasonAttention` (new kind `pulse_waiting`) and on the tab badge;
- a link from Daily Update.

**What it lists**, grouped by part or slot, newest first, each with its sources (posts, comments, DMs, ledger entries):

| Item | Source | Possible decisions |
|---|---|---|
| Relationship drift | accepted `pulse_closeness` changes past a threshold; ripple `relationship_shifts` | propose a story-pair stage change (goes to the existing confirm flow), dismiss, or hold |
| Rumours and conflicts | storyline beats, comment threads with conflict tone, ripple chains | open a thread (`threadInbox`), plant for a slot, dismiss |
| Reputation signals | follower jumps (existing `seasonArcProposals`), brand reactions | note on the slot, propose a goal tweak (explicit) |
| Brand moves | brand reactions, offers drafted from the feed | open the offer in Opportunities (decision there; never auto-accepted) |
| Story suggestions | `seasonArcProposals` (extended with closeness, storylines, ripples), `pairStorylines` seeds, `pulseStorylines.suggestBeats`, `castStoryGaps` | accept into a slot (`SeasonArcSuggestions` pattern), dismiss |
| Canon candidates | anything that would become a secret, relationship, follow-up or twist | **always** through `EpisodeStoryRecord.approveRecord` or the confirm routes; never written from here directly |

**Rules:**
- Accept / Dismiss / "Decided · N" behave as in `SeasonProposals`.
- Every accept is an explicit click and lands in the existing owner flow.
- Every dismiss is remembered (no re-proposal unless the evidence changes; signals hash, as `seasonArcProposals` already does).
- Nothing here writes the ledger, deal status or accepted episode canon.

---

## 9. Phased Implementation Plan (proposal; each phase separately approved)

| Phase | Scope | Touches production behaviour? | Migration |
|---|---|---|---|
| **0. Safety fixes** (small PRs) | M1 money-post Lala link; M2 ripples through the gate and drafts only, scoped to the show and layer; M5 no writes on GET; M6 voice rebuild refuses to overwrite `edited`; brand guards (crossing, mirroring, pools, `friendsOfLala`) | yes, narrowing only | none |
| **1. One generator family** | Retire or route `feedActivityService` and the ripple templates into `pulseDrafter`. One comment path (`pulseDrafter`), with `feedCommentDrafter` and the redrafter given voice and knowledge. Name the three "ripples" apart. | yes | none |
| **2. Voice profile** | the read-only resolver; habits keys; per-speaker drafting; recent-post memory; repetition flag; address bands from closeness; private DM voice | prompts only | none (jsonb) |
| **3. Photography** | single identity source; `full_profile.avatar`; `photo_style`; brand assets and routing; candid "create" prompt | new images only, as drafts | none (jsonb), to verify |
| **4. Brand behaviour** | rep authority from `extra_fields`; `linkDeal` on every offer path; brand drafts on hosted-event completion (Review); per-brand regard (jsonb) | drafts only | optional founder FK |
| **5. Event-driven automation** | wake-on-enqueue for `pulseQueue`; event-armed release timer; storyline, voice, recap and world-moment triggers on their real events; per-kind switches for `dm` and `moment`; caps for gate, pairs, ripple engine and completion-time AI; separate budget lanes (interactive vs background); per-character posting limits; dedupe keys per (character, source event, kind) | yes, behind switches | maybe a jobs index |
| **6. Social Storyline Review** | Season tab, attention count, `seasonArcProposals` extended with closeness, storylines and ripples; links into the existing canon gates | read and propose | none |
| **7. Event → Pulse without an episode** | world events (created, changed, happening) enqueue reactions through the gate; beat outline reads accepted social developments | yes, behind switches | none |

**Moderation and recovery in every phase:**
- **Gate first, Review for anything about Lala, money, deals or secrets:** `pulseGate`, `privateLeaks`, `pulseTrust` ALWAYS_REVIEW.
- **Idempotency:** dedupe keys per (character, source, kind).
- **Failed jobs:** retry with backoff, then park as `failed` with the reason, shown on the Engine tab with Retry. Never retried forever.
- **Undo** on everything that auto-applies.
- **Workers:** none is turned on or restarted without Evoni's explicit yes.

---

## 10. Decisions for Evoni

1. **Autonomy level.**
   - **Option a:** with the engine on, gated posts and comments between non-Lala characters may publish on their own (today's behaviour).
   - **Option b:** everything waits in Review.
   - Lala, deals, secrets and money always wait in either case.
2. **Release timer.** Posts scheduled by the engine (world moments, brand weeks) publish with nobody clicking. Keep that, or make each one need Evoni's release?
3. **Viral ripples (M2):** fix them into the gated drafter, or retire them?
4. **Pulse → story.** May accepted closeness changes *propose* story-pair stage changes in the Social Storyline Review? They would always need confirmation.
5. **Completion cascade.** Should `franchise_knowledge` rows from completion wait for review instead of going active (M7)?
6. **Voice.** May drafters read approved script lines and learned rules as Pulse examples (and the reverse)? Is the major/small approval split right for conflict, flirting, relationship tone and mood?
7. **Photography.** Approve the identity-reference vs profile-picture split. May profile pictures be candid? Which photo modes to add first?
8. **Brands.**
   - Approve the may / may-never table.
   - Business DMs through reps: allowed, or none for now?
   - Per-brand regard for Lala: yes or no?
9. **Studio by Sable.** D1 (Sable's link to @studiobysable) and D2 (company stand-in) from the separation plan. The six "From the story" rows on 447 also wait for the follow-up query's Q2/Q3 before any action.
10. **Budget.** Split interactive and background budgets? Keep the $50 default? Check the Haiku price?
11. **Where the review lives.** A new Season "Social" tab, or a card in the Story tab?
12. **Phase order.** Phase 0 first, as separate PRs? Which of phases 1–7 come next?
