# Lala's Phone phase 4 read: opportunities and brand deals

Date: 2026-10-14. Basis: `a1814a6f6a5f25ebc3b3354886debda3930aec62` (origin/main). Read-only: no code, register, host, AWS, database or Cognito contact. Citations are `file:line` at that SHA. Each claim is **MEASURED** (read in code or migrations) or **INFERRED**.

This is Task #3123, the read for Lala's Phone spec §15 phase 4, **Opportunities** (`docs/design/2026-10-lalas-phone.md:94`): brand deals on the deal model, lifecycle, Mail delivery, Bank payouts, brand characters and per-brand trust. The spec sections are:
- §6, Opportunities and brand deals;
- §3, Mail (event invitations, brand deals, other opportunities) and Bank (coins, spending, pending and paid deal payouts);
- §13, the brand agreement, which replaces the Career plan sticky note.

## 1. Summary

1. **The deal model is built, but tied to an event's host** (MEASURED).
   - Deal types and components, deliverables with fees, and payouts booked at approval and at Complete all exist.
   - A brand exists only as the event's `host_brand` string. Converting a brand-deal opportunity makes the brand the event's host (`src/services/careerPipelineService.js:213-216`).
   - The deal terms lock at Start Episode, so a deal cannot arrive mid-episode.
2. **Opportunities are a separate pipeline that never touches the ledger** (MEASURED). "Paid" is a manual status, with no Bank row.
3. **Bank has no pending payouts** (MEASURED). The ledger has a `pending` status that nothing writes. Every payout is booked straight to `executed`. "Pending" exists only as a display state on the Money page.
4. **Not built at all:**
   - brands as characters (no brand account type on Pulse profiles);
   - per-brand trust (one global `brand_trust` number);
   - rival brands;
   - sponsored `#ad` posts;
   - a Mail inbox;
   - offers arriving at a beat;
   - the brand agreement.
5. **Most of the brand agreement's clauses can be filled from existing deal data** (§2.6). Three things are missing:
   - a brand logo or profile;
   - an accepted state for the OFFER → EXECUTED stamp;
   - a `#ad` disclosure.
6. **Ruled by Evoni (§6), originally recommended as follows (§4):**
   - A brand is a Pulse profile marked as a brand account.
   - A brand deal is an extended Opportunity, the one opportunities record, using the deal model.
   - It arrives mid-episode by a script cue at its beat, as `[WEAR]` does.
   - Per-brand trust is a ledger by story order, like followers.
   - Payouts are pending ledger rows that the balance ignores until they are paid.
   - Evoni ruled on all nine (§6). She added: the offer, the event and the sponsored post stay separate records; a 0–100 trust scale; "Open Deal Package"; and three safeguards (§4).

## 2. What exists

### 2.1 The Event Package deal model

MEASURED:
- **Columns on `world_events`:**
  - `deal_type`, `appearance_fee`, `gifted_value`, `pricing_version` and `bonus_terms` (`src/migrations/20260929200000-add-world-events-deal-terms.js:21-25`);
  - `partnership_base_fee`, `performance_fee` and `appearance_required` (`20260930120000-add-world-events-deal-components.js:26-28`);
  - `deal_components` JSONB: null means a legacy event, `[]` self-funded (`20261001170000-add-world-events-deal-components.js:7-17,49`);
  - `restrictions` `[{ type, description }]` and `requirements` (`reputation_min`, `brand_trust_min`, `coins_min`) (`src/models/WorldEvent.js:306,314`).
  
  Deal types are listed at `WorldEvent.js:21`. The components and their labels are in `src/utils/dealComponents.js:31-67,153-167`; for example, `brand_partnership` is partnership_base plus paid_for_content.
- **Deliverables:** `event_deliverables` (`src/migrations/20260924000000-add-event-terms.js:40-91`):
  - a description, a type, `due_date` as a story date (`:64-66`), required, and an episode;
  - status pending → completed → submitted → approved (`src/models/EventDeliverable.js:32`; `src/services/eventTermsService.js:38,303`);
  - `owed_to` host|brand (`20260929190000-add-event-deliverables-owed-to.js:21-34`);
  - `fee`, paid on approval (`20260929200001-add-event-deliverables-fee.js:12-15`);
  - platform and quantity (`EventDeliverable.js:63-64`).
- **Payout timing is fixed in code; there is no column** (`src/services/dealPayoutService.js:6-33`).
  - The components and the bonus are paid at Complete (`completionPayouts` `:106-137`; `bookCompletionPayouts` `:188-198`, called from `src/services/episodeCompletionService.js:408-415`).
  - The content fee is paid when a deliverable is approved (`bookContentFee` `:206-232`; `src/routes/eventDeliverables.js:375-381`).
  - Each payout is booked once (`:151-158`; unique indexes `20260929200004-add-ledger-deal-payout-unique.js:16-24`, `20260930160000-…:30`).
- **The lock:**
  - The terms lock once an episode starts from the event (`src/utils/eventTermsLock.js:1-60`; `LOCKED_EVENT_FIELDS` `:41-60`).
  - They reopen only while that episode is a draft, with no non-wardrobe ledger rows and every deliverable pending (`src/services/termsReopenService.js:4-27`).
- **Where the host is assumed to be the offerer:**
  - `payerFor` (`dealPayoutService.js:96-100`): the brand is `host_brand`, else the host pays.
  - The content fee's payer is `host_brand || host` (`:211-226`).
  - The Money page labels the payer from `host_brand` (`src/services/episodeMoneyLines.js:77-80,137-145`).
  - Converting an opportunity sets `host = host_brand = brand_or_company` (`careerPipelineService.js:213-216`; `src/services/feedEventPipelineService.js:546-547`).
  - **An event therefore has one offerer, a string, and no second brand.** A brand deal on an event that has already started is blocked by the lock (INFERRED from the lock fields).
- **Stale comments:** `WorldEvent.js:275` ("No code reads them yet") and `EventDeliverable.js:24-25` ("no code reads it yet"). Both fields are read by `dealPayoutService.js:96-144`.

### 2.2 Opportunities

MEASURED:
- **The model** (`src/models/Opportunity.js:14-94`):
  - `opportunity_type`, including `brand_deal`, `pr_gifting` and `casting_call` (`:20-24`);
  - `brand_or_company`, free text (`:39`);
  - calendar dates `offer_date`, `response_deadline`, `shoot_date` and `publish_date`, with **no story time** (`:48-52`);
  - `payment_amount` DECIMAL and `payment_status` pending/partial/paid (`:55-59`);
  - `deliverables` JSONB, `wardrobe_brief` and `exclusivity` TEXT (`:62-65`);
  - `event_id`, `episode_id` and `career_goal_id`.
- **The status flow** is offered → considering → negotiating → booked → preparing → active → completed → paid → archived, plus declined, expired and cancelled (`src/routes/opportunityRoutes.js:26-38`).
  - "Paid" sets only `payment_status` and runs the career-goal cascade (`:185-194`). **It writes no ledger row.**
  - Completion moves a booked opportunity to "completed" (`careerPipelineService.onEpisodeCompleted` `:320-363`, from `episodeCompletionService.js:731-733`). Nothing moves it to "paid".
- **How opportunities are created** (rule-based; no Evoni approval step before "offered"):
  - by hand (`opportunityRoutes.js:87-124`; `frontend/src/pages/WorldAdmin.jsx:3217`);
  - from a Feed scan, where a profile's `brand_partnerships` yields a `brand_deal` (`feedEventPipelineService.generateOpportunitiesFromFeed` `:222-335`, `:281-284`);
  - after an event, by tier with a random brand (`src/services/characterSyncService.js:315-331,392-424`, from `episodeCompletionService.js:757`);
  - from goal unlocks (`careerPipelineService.spawnUnlockOpportunities` `:147-177`).
- **Into an episode:** `convertOpportunityToEvent` (`careerPipelineService.js:198-260`) and `scheduleOpportunityAsEvent` (`feedEventPipelineService.js:388-623`). Both turn the opportunity into a `world_event`.

### 2.3 Mail and invitations

MEASURED:
- **`[MAIL: …]` tags:**
  - The parser reads them into `beat.tags.mail` (`src/utils/scriptBeatParser.js:298-302,361`), but **nothing else reads them**; the only other use is a summary count at `:562`.
  - The skeleton writes `type=invite from=<host_brand>` and `type=reminder` (`src/utils/scriptSkeletonGenerator.js:113,208`).
- **The canonical beats** (`src/constants/canonicalBeats.js`):
  - beat 4 is a mail notification (`:123-128`);
  - beat 5 opens the invitation (`:139-160`);
  - beat 7's purpose is "Second mail arrives. Brand deal, DM, or Side Quest." (`:192-199`), which is prose only.
- **The invitation:** the approved invitation image is the episode's overlay on beat 5 (`src/services/episodeInvitationOverlayService.js:4-36,91-112`). `invitationGeneratorService.findBrandStyleReference` (`:150-162`, keyed on `host_brand`) is unused.
- **The phone:**
  - The only mail-like content type is `event_invite` (`frontend/src/components/ScreenContentRenderer.jsx` `CONTENT_TYPES`). There is no inbox and no offer content type.
  - The show's Mail screen is `messages_page`, in production data only, per the phase 1 read (`docs/reads/2026-10-14-phone-hub-read.md` §11).
- **No offer arrives at a beat or a story time** (Opportunity dates are calendar dates).

### 2.4 Bank

MEASURED:
- **The ledger statuses:** `financial_transactions.status` is pending|executed|reversed, default executed (`src/migrations/20260724000002-create-financial-transactions.js:46-48`).
  - Only executed rows count toward the balance (`src/utils/ledgerBalanceFilter.js:19-23`).
  - **Nothing writes `pending`.**
  - Deal payouts are inserted as `executed` (`dealPayoutService.js:160-166`), in categories appearance_fee, partnership_base_fee, performance_fee, content_fee and deal_bonus (`:37-39`).
- **"Pending" is a Money-page display state:** a content fee shows Pending while its deliverable is submitted, and "Planned and Pending never enter the ledger" (`episodeMoneyLines.js:10-14,37-45,325`).
- **Legacy events:** an `event_payment` row, plus a 10% `content_revenue` "Brand deal content fee" for `event_type === 'brand_deal'` (`src/services/financialTransactionService.js:584-602`).
- **The phone's finance apps** (`POST /shows/:id/seed-finance-apps`, `src/routes/shows.js:876-930`) use `money_balance`, trend, KPIs, bars and goals. **There is no payout content type.**

### 2.5 Brands today

MEASURED:
- **Wardrobe:** an in-world `brand` (`src/models/Wardrobe.js:123`) and real-world `real_brand` (`:140-150`).
- **The brand registry:** `lalaverse_brands` has a name, category, aesthetic, founder, press angle and `partnership_status` (`src/models/LalaverseBrand.js:5-19`; routes `src/routes/wardrobeBrands.js:135-220`). It has **no profile link, no logo field and no trust**.
- **Pulse profiles:**
  - `social_profiles` has **no brand account type** (no account_type, is_brand or kind; MEASURED by grep) and no avatar or logo column.
  - It has `feed_layer`, `archetype` (`src/models/SocialProfile.js:40,131-134`) and `brand_partnerships` (`:81`), which is a creator's partnerships, not a brand's account.
  - STUDIO BY SABLE appears only in frontend test fixtures.
- **Voices** are keyed on a registry character (`src/models/PulseVoice.js:13-14`). Registry roles have no brand role (`src/models/RegistryCharacter.js:51-53`).
- **Trust:** `CharacterState.brand_trust` is one number (`src/models/CharacterState.js:27`). It changes by:
  - the result tier: slay/pass +1, safe 0, fail −1 (`src/utils/evaluationFormula.js:293-315`);
  - a wardrobe bonus: two or more brands, or wearing the host brand (`episodeCompletionService.js:90-95`).
  
  It also gates events (`requirements.brand_trust_min`).
- **Rivals:** only profile-to-profile `rival` relationships exist (`src/models/SocialProfileRelationship.js:27`). There is no rival-brand concept.

### 2.6 The Career plan, and what can fill the brand agreement

MEASURED:
- **The Career plan document:**
  - `canon_consequences.documents.career_plan` (`src/services/eventDocumentsService.js:16-21,30-33`), with the sections "This event" and "Bigger goals" (`:39,94-96`);
  - items drafted by Haiku (`todoListService.generateCareerTasks`) plus active goals (`:159-193`);
  - live deliverables in "Expected of her" (`expectedOfHer` `:208-224`).
- **Its overlay** is a lavender card with no letterhead, parties, signatures or stamp (`src/services/eventDocumentOverlayService.js:195-245`; `frontend/src/components/EventPackage/EventDocuments.jsx` `CareerCard`; `frontend/src/lib/eventDocuments.js` `careerSections`).
- **Lala's personal goals** now have the Career list (#3181, PR #3186), so the agreement can leave them out (spec §13).

| §13 clause | Filled from | Status |
|---|---|---|
| Engagement | `deal_components` and its label (`dealComponents.js:153`), the event name and date | available |
| Deliverables and compensation | `event_deliverables` (description, platform, quantity, due date, fee, owed to) and the component fees, as the Money page already lists them (`episodeMoneyLines.js:88-147`) | available |
| Access | `requirements` and the event's costs covered (`invitationGeneratorService.loadInvitationTerms` `:35-49`) | available |
| Performance bonus | `bonus_terms` `{ slay, pass, safe }` (`dealPayoutService.js:78-93`) | available |
| Restrictions | `restrictions` (exclusivity; `eventTermsService.restrictionsFromOpportunity` `:129-132`) | available; "must be worn at the event" is not a restriction type |
| Disclosure | only the Shop the Look affiliate sentences (`styleSheetDistributionService`) | **not built**: no `#ad` field |
| Brand box and letterhead logo | `host_brand` string | **not built**: no brand profile or logo |
| OFFER → EXECUTED stamp | no accepted state | **not built** |

### 2.7 Results and The Pulse

MEASURED:
- **At completion:**
  - deal payouts (`episodeCompletionService.js:408-415`);
  - social-task bonuses from deliverables move stress and influence, not trust (`:41-75`);
  - global `brand_trust` (`:85-95,361`);
  - the opportunity marked completed (`:731-733`).
  
  **No trust change is made per brand, and a missed deliverable costs nothing.**
- **The Pulse:**
  - `feed_posts` has `opportunity_id` (`src/models/FeedPost.js:15`) and `narrative_function: 'brand_content'` (`:50-53`), but **no sponsored or `#ad` flag**, and no brand repost.
  - An approved deliverable proposes a follower change (`src/services/pulseFollowers.js:318-340`).
  - `sponsor_name` and `sponsor_expectations` sent by `frontend/src/pages/CreateEpisode.jsx:109-439` are read by nothing on the server (INFERRED: dead fields).

### 2.8 Open issues touching this phase

MEASURED, from the open issue list:
- **#3086:** Pulse follower causes through Review, including approved event deliverables. It would carry the "#ad" post's follower effect.
- **#3181** (PR #3186): the Career list, with a hook for executed agreements (`careerListService.executedAgreementBrands`).

No open issue builds brand deals, Mail, Bank payouts or the brand agreement.

## 3. Gap: each spec item

| Spec item | Status | Evidence |
|---|---|---|
| One system for opportunities: event invitations, brand deals, career opportunities | **Partly built**: two systems linked by `opportunity_id` | `Opportunity.js:20-24`; invitations are `world_events` (`WorldEvent.js:48-52`) |
| A brand deal reuses the deal model, offered by a brand, not the host | **Partly built**: the deal model exists; the brand is folded into the host | `dealComponents.js:59-67`; `careerPipelineService.js:213-216`; `dealPayoutService.js:96-100` |
| Can arrive mid-episode | **Not built** | `[MAIL:]` unused (`scriptBeatParser.js:298-361`); beat 7 prose only; the lock at Start (`eventTermsLock.js:41-60`); no story time on opportunities |
| Lifecycle Offered → Accepted/Declined → Active → Delivered → Paid → Counted | **Partly built**: no accepted or delivered state; "paid" is manual with no ledger | `opportunityRoutes.js:26-38,185-194`; deliverables pending → approved |
| Offer contents: brand, ask, coins, story-time deadline, conditions | **Partly built**: no story-time deadline; no "must be worn" condition; pay is DECIMAL money | `Opportunity.js:39-65` |
| Bank: pending, then paid when approved | **Partly built**: the ledger has a pending status that nothing writes; pending is display only | `dealPayoutService.js:160-166`; `episodeMoneyLines.js:325` |
| Results: all delivered raises that brand's trust; a miss lowers it | **Not built** | global `brand_trust` only |
| The Pulse: the sponsored post with an in-world "#ad" | **Not built** | `FeedPost.js` has no flag |
| The Career list records the brand | **Partly built**: past deals are derived by #3181 (PR #3186), with a hook for executed agreements | `careerListService.executedAgreementBrands` |
| Brands are characters: Pulse profiles, voices, posts | **Not built** | no brand account on `social_profiles`; voices need a registry character |
| Per-brand trust shapes the next offer | **Not built** | one number; offers by tier and a random brand |
| Rival brands; real exclusivity choices | **Not built** (exclusivity exists as text) | `SocialProfileRelationship.js:27`; `Opportunity.exclusivity` |
| Offers drafted to fit story and influence tier, approved by Evoni | **Partly built**: rule-drafted, tiered by result, no approval step | `characterSyncService.js:315-331` |
| The brand agreement (§13): letterhead, parties, clauses, signatures, OFFER → EXECUTED | **Not built**: clause data mostly exists (§2.6) | only the Career plan card and overlay |

## 4. Design (ruled by Evoni in §6)

**A brand deal is a business opportunity in Lala's world, an event is somewhere she goes, and a sponsored post is something she delivers. They are connected, but they are not the same record** (Evoni, 2026-10-14). The same separation lets Brand Deals, The Pulse, Events, Career, Prime Bank and episode production work together without duplicating anything.

- **A brand** is a Pulse profile with a brand type, linked **one to one** to its LalaVerse Brand Registry row. There is one brand identity, never two disconnected ones.
- **A brand deal** is an extended Opportunity. The brand owns the offer, and an event keeps its actual host.
  - **An accepted offer never creates an event by itself.**
  - If the deal includes an appearance at an existing event, the deal links that event.
  - If it needs a new brand-hosted event, that event is made separately, with the brand as its host.
- **Arrival:** `[OFFER: id]` introduces an existing offer at its beat, validated against the offer and its episode.
- **Acceptance:** Evoni confirms Lala's yes or no on the offer record. **Script cues portray the decision; they never finalize it.**
- **Money:** amounts move through four distinct stages, so an offer never raises Lala's Prime Bank balance:
  - proposed, the offer;
  - contracted, at acceptance;
  - earned and pending, a pending ledger row;
  - paid, executed.
- **Per-brand trust** runs 0–100 and starts at 50. It is separate from Lala's overall stat (today `character_state.brand_trust`, 0–10, which stays as it is).
- **The Career plan stays, simplified.** Its event objectives link to the canonical Career Goals, with no second plan and no conflicting checklists.
- **Every brand deal has an "Open Deal Package" action from the episode.** It shows the original offer, the brand, the payment terms, the deliverables, deadlines, exclusivity and Lala's decision.

**How a deal flows through an episode** (Evoni, 2026-10-14):
1. **The brand creates an offer**, tied to its Pulse profile, with deliverables, compensation, a deadline and any exclusivity terms.
2. **Prime Studios places it in the episode** with `[OFFER: id]` at the intended beat.
3. **Lala receives it on her phone**, in Mail, with a possible Pulse notification.
4. **Lala responds in the story**, and Evoni confirms the outcome on the offer.
5. **Deliverables are tracked**: a sponsored Pulse post, an event appearance, or other contracted work, attached to the deal.
6. **Payment is recorded**: a pending ledger row when payment becomes owed under the deal's terms, posted to her available balance only when paid.
7. **The world reacts** after the outcome is accepted: brand trust, approved rival-brand consequences, and the relevant Pulse conversations.

**Safeguards** (Evoni, 2026-10-14):
- **Canon authority:** script cues introduce and portray offers. The approved offer record is the source of truth for acceptance, terms, deliverables and payment.
- **Financial integrity:** proposed, contracted, earned/pending and paid amounts stay distinct. Pending money never raises Lala's available Prime Coins (`ledgerBalanceFilter.js:19-23` already counts executed rows only). In-world coins stay separate from real-world records (the `real_*` wardrobe fields, Shop the Look).
- **Sponsorship disclosure:** a sponsored post shows **"#ad" and "Paid partnership with <brand>"**, prominently, not buried in the caption.
- **Compatibility and audit:**
  - existing episodes and opportunities keep working, with every new column nullable or defaulted;
  - canonical ids throughout;
  - an audit history (status history, trust changes as rows);
  - no duplicate payouts (the existing once-only indexes extended);
  - story-world changes only after the relevant production approval.

## 5. Proposed issues, in order (plan only; updated with Evoni's rulings in §6)

Each fits one phone-reviewable PR. Migrations are new files under `src/migrations/` only, every new column nullable or defaulted, so existing records keep working.

1. **feat(pulse): brand accounts, one identity per brand** (ruling 1).
   - Migration: `social_profiles.account_kind` ('person' default | 'brand'), `social_profiles.logo_url`, and `lalaverse_brands.social_profile_id` with a **unique** index (one to one).
   - Files: the models, `socialProfileRoutes` (set and read), the Brand Registry routes (`wardrobeBrands.js`, link and unlink), and the Feed profile editor ("Brand account" plus logo).
   - Tests:
     - linking a second profile to a brand, or a second brand to a profile, is refused;
     - an unmarked profile is a person;
     - vitest for the editor.
2. **feat(deals): a brand deal on the extended Opportunity** (rulings 2 and 4).
   - **Migration on `opportunities`:**
     - `brand_profile_id` (the brand's Pulse profile);
     - `deal_components` JSONB and the fee columns;
     - `conditions` JSONB (exclusivity, must-wear piece ids);
     - `deadline_order` INT (story time);
     - `linked_event_id` (an existing event the deal appears at, its host unchanged);
     - `proposed_amount` and `contracted_amount`;
     - `decision` (null | accepted | declined), `decided_at`, `decided_by`.
   - **Migration on `event_deliverables`:** `opportunity_id`, with `event_id` nullable for a deliverable that belongs to a deal and not an event. Check the existing NOT NULL and the cascade first.
   - **The lifecycle:** Offered → Accepted/Declined (Evoni confirms; `status_history` keeps the audit) → Active → Delivered → Paid → Counted. **Accepting never creates an event.**
   - Files: `Opportunity.js`, `opportunityRoutes.js` (the decision route, Evoni only), `dealComponents.js` reused, `careerPipelineService.convertOpportunityToEvent` (no longer used for brand deals; old ones still read).
   - Tests:
     - the decision recorded once, with an audit row;
     - proposed versus contracted amounts;
     - no event made on accept;
     - existing opportunities unchanged.
3. **feat(script): `[OFFER: <opportunity id>]`, the offer arriving at its beat** (ruling 3).
   - The parser and `scriptMoments.offersAt`, as `[WEAR]` does (PR #3184).
   - It is validated: the id must be an existing offer, and the offer must belong to the episode (or be unplaced). Otherwise it is flagged in the Script tab.
   - The cue portrays only; it never changes the offer's decision.
   - **No migration.**
4. **feat(phone): Mail, the inbox, and "Open Deal Package".**
   - A `mail_inbox` content type: the episode's invitation and the offers that have arrived by the beat, each with its brand, ask, pay and deadline.
   - A possible Pulse notification when an offer arrives (through The Pulse's review).
   - In the episode, **every brand deal has "Open Deal Package"**, showing the original offer, brand, payment terms, deliverables, deadlines, exclusivity and Lala's decision.
   - Files: `ScreenContentRenderer.jsx`, `ContentAreaPicker.jsx`, a read route, and the episode's deal view.
   - **No migration.**
5. **feat(bank): payments pending, then paid** (ruling 5; financial integrity).
   - When payment becomes owed under the deal's terms, write a **pending** ledger row; turn it **executed** when paid, rather than inserting a second row.
   - The once-only guarantee extends to deal rows (the unique indexes in `20260929200004` / `20260930160000`). **A new migration may extend the index; the old ones are not edited.**
   - Pending never enters the available balance (`ledgerBalanceFilter.js`).
   - The Money page and a phone Bank `payouts` content type show pending and paid apart.
   - Tests:
     - the balance ignores pending;
     - pending turning paid books no second row;
     - an offer's proposed amount never reaches the ledger.
6. **feat(documents): the brand agreement, and the Career plan simplified** (rulings 7 and 8).
   - **The brand agreement:** a `brand_agreement` document for a brand deal:
     - letterhead with the brand's logo (issue 1);
     - "Creator Partnership Agreement · <event>";
     - the Brand and Creator boxes;
     - the numbered clauses from §2.6;
     - signature lines;
     - OFFER → EXECUTED when Evoni confirms acceptance.
     
     Its disclosure clause carries "#ad" and "Paid partnership with <brand>".
   - **The Career plan:** keep it for events, simplified. Its "this event" objectives link to canonical Career Goals rather than being a second list. No duplicate fields.
   - Files: `eventDocumentsService.js`, `eventDocumentOverlayService.js`, `EventDocuments.jsx`.
   - **No migration** (`canon_consequences.documents`, as today).
7. **feat(trust): per-brand trust, 0–100** (ruling 6).
   - **Migration:** a `brand_trust_changes` table, one row per change, the audit history. It has the brand profile, the deal, the deliverable (nullable), the kind, the change, the story order, and a **unique key per (deal, deliverable, kind)**, so a retry never counts twice.
   - A brand Lala has never worked with reads 50 (neutral). The value is clamped to 0–100.
   - **The scale:**

     | Outcome | Change |
     |---|---|
     | Deal accepted | 0 |
     | Deliverable completed on time | +5 |
     | Entire deal completed successfully | +10, once |
     | Deliverable submitted late | −5 |
     | Deliverable missed | −15 |
     | Deal broken or abandoned | −25 |
   - **Changes apply only when the outcome is confirmed** (a deliverable approved, or the episode's result accepted), never from a draft.
   - Lala's overall `character_state.brand_trust` is unchanged.
   - Files: a new `brandTrustService.js` (`trustAt(brand, at)`, `recordOutcome`), `episodeCompletionService.js`, `eventDeliverables.js` (on approval).
   - Tests:
     - each change;
     - the clamp;
     - the completion bonus once;
     - a retried approval not double-counted;
     - overall trust untouched.
8. **feat(pulse): the sponsored post** (ruling 8).
   - A post made for a deal's deliverable carries the brand. It shows **"#ad" and "Paid partnership with <brand>"** prominently, above the caption, not inside it.
   - The brand reposts it, and friends react, through The Pulse's existing review.
   - **Migration:** `feed_posts.sponsored_by_profile_id`.
   - Touches #3086's follower causes.
9. **feat(deals): offers drafted to fit, and rival brands as proposals** (ruling 9).
   - Draft offers by influence tier, niche and per-brand trust. They start as drafts until Evoni approves them, then become "offered".
   - Rival brands use a `rival` relationship between brand profiles (`SocialProfileRelationship`). When Lala accepts a rival's deal, the consequences (unfollow, shade, a pulled offer, a trust change) are **proposed for Prime Studios' review and never applied to canon automatically**.
   - **No migration** beyond issues 1, 2 and 7.

Order: 1 and 2 first, in parallel. 3 needs 2; 4 needs 2 and 3; 5 needs 2; 6 needs 1 and 2; 7 needs 1 and 2; 8 needs 1; 9 needs 1, 2 and 7.

## 6. Rulings (Evoni, 2026-10-14)

1. **Brand identity:** a brand is a Pulse profile with a brand type, linked one to one to the canonical Brand Registry. No duplicate brand identities.
2. **Deal ownership:** Opportunities are extended to support brand deals. Deals belong to brands; events keep their actual hosts. An existing event is linked when appropriate. An accepted offer never creates an event automatically; a new brand-hosted event is made separately, with the brand as host.
3. **Script integration:** `[OFFER: id]` introduces an existing offer at a specific episode beat. The offer id and its episode association are validated.
4. **Acceptance authority:** Prime Studios confirms Lala's acceptance or rejection on the offer record. Script cues represent story actions, not final business-state changes.
5. **Payments:** real ledger rows with pending and paid states. Pending money never increases available Prime Coins. In-world currency stays distinct from real-world financial records.
6. **Brand trust:** independent trust per brand, 0–100, starting at 50.
   - on-time deliverable +5;
   - successful deal completion +10;
   - late deliverable −5;
   - missed deliverable −15;
   - broken deal −25.
   
   Lala's existing overall Trust is kept as a separate stat. Changes apply once per approved outcome.
7. **Career planning:** event-specific career objectives are kept but linked to the canonical Career Goals system. No duplicate planning fields or conflicting checklists.
8. **Sponsored content:** both "#ad" and "Paid partnership with <brand>" show on sponsored Pulse posts.
9. **Rival-brand consequences:** proposals for Prime Studios' review. Relationships, trust, opportunities and canon are never altered automatically.

Plus the design rule that every brand deal has **Open Deal Package** from the episode, and the safeguards in §4.

## 7. Open questions for the build issues

- **"Late" needs a story time for delivery.** A deliverable's `due_date` is a story date (§2.1), but `approved_at` and `submitted_at` are wall-clock. Two possible fixes:
  - read the delivery's story time from its `[DELIVER: id]` cue's beat (phase 3, #3191);
  - stamp it when the deliverable is submitted.
  
  Issue 7 must settle which before it can tell on time from late.
- **When payment becomes owed** under each deal component, which decides when the pending row is written: today, components at Complete and the content fee at approval (`dealPayoutService.js:6-33`). Issue 5 keeps that timing unless Evoni rules otherwise.
- **The overall stat's name:** the code calls it `brand_trust`, while the ruling calls it "Trust". Issue 7 leaves it unchanged; renaming it is a separate decision.
