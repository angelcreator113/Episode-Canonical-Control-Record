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
6. **Recommendation (§4):**
   - A brand is a Pulse profile marked as a brand account.
   - A brand deal is an extended Opportunity, the one opportunities record, using the deal model.
   - It arrives mid-episode by a script cue at its beat, as `[WEAR]` does.
   - Per-brand trust is a ledger by story order, like followers.
   - Payouts are pending ledger rows that the balance ignores until they are paid.
   - Nine decisions are listed in §6.

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

## 4. Design direction (for the rulings in §6)

- **A brand is a Pulse profile marked as a brand account.**
  - It is a character with a handle, voice and posts (spec §6), linked to its `lalaverse_brands` row when there is one.
  - It gets a logo for the agreement's letterhead.
  - It takes **one migration**: `social_profiles.account_kind` ('person' | 'brand'), plus `lalaverse_brands.social_profile_id` and a logo.
- **A brand deal is an Opportunity**, the one opportunities record (spec §6, "one system"), with the deal model added. The brand is the offerer and the event stays the host's.
  - It gets the brand profile, `deal_components` and fees, `conditions` (exclusivity, must-wear piece ids), a story-time deadline, and an accepted or declined state with when.
  - Its deliverables are `event_deliverables` rows with `owed_to: 'brand'` and an `opportunity_id`, so the payout and approval code is reused.
  - It takes **one migration.**
- **Mid-episode arrival comes from a script cue**, `[OFFER: <opportunity id>]`, at its beat (the `[WEAR]` precedent, PR #3184). Mail shows it from that line. It needs no migration.
- **Bank pending → paid:**
  - When a deal is accepted, its fees are written as `pending` ledger rows, which the balance already ignores (`ledgerBalanceFilter.js:19-23`).
  - On approval and at Complete, they turn `executed`, rather than a new row being inserted.
  - The phone's Bank gets a "payouts" content type.
- **Per-brand trust:** a `brand_trust` ledger by story order, as `pulse_followers` is (`src/services/pulseFollowers.js`). One migration.
  - Results adds a change per brand: all delivered raises it; a miss lowers it.
  - The offer drafter reads it.
- **The brand agreement** is a third document type, `brand_agreement`, for a deal with a brand. It replaces `career_plan` there (spec §13).
  - Its clauses are filled from §2.6.
  - It shows the OFFER stamp until the deal is accepted, then EXECUTED with Lala's signature.

## 5. Proposed issues, in order (plan only; none opened)

Each fits one phone-reviewable PR. Migrations are new files under `src/migrations/` only.

1. **feat(pulse): brand accounts.**
   - What: a Pulse profile marked as a brand, with a logo, linked to its LalaVerse brand row.
   - Migration: `social_profiles.account_kind` ('person' default | 'brand'), `social_profiles.logo_url`, `lalaverse_brands.social_profile_id`.
   - Files: the models, `socialProfileRoutes` (set and read), and the Feed profile editor (a "Brand account" toggle and logo upload).
   - Tests: model, route and vitest.
2. **feat(deals): a brand deal on the deal model** (the Opportunity extended).
   - What: the offering brand's profile, `deal_components` and fees, `conditions`, a story-time deadline, and an accepted or declined state.
   - Migration: on `opportunities`, `brand_profile_id`, `deal_components` JSONB, the fee columns, `conditions` JSONB, `deadline_order` INT, `accepted_at`, `declined_at`; on `event_deliverables`, an `opportunity_id` (with `event_id` kept for the host's event).
   - Files: `Opportunity.js`, `opportunityRoutes.js` (the lifecycle Offered → Accepted/Declined → Active → Delivered → Paid), and `dealComponents.js` reused.
   - Tests: unit and integration.
3. **feat(script): `[OFFER: <opportunity id>]`, the offer arriving at its beat.**
   - The parser and `scriptMoments.offersAt`, as `[WEAR]` does, with flags for unknown ids.
   - Files: `scriptBeatParser.js`, `scriptMoments.js`, `EpisodeScriptTab.jsx`.
   - **No migration.**
4. **feat(phone): Mail, the inbox.**
   - A `mail_inbox` content type: the episode's invitation, plus offers that have arrived by the beat (from issue 3), each with its brand, ask, pay and deadline.
   - Files: `ScreenContentRenderer.jsx`, `ContentAreaPicker.jsx`, and a read route.
   - **No migration.**
5. **feat(bank): payouts pending, then paid.**
   - Accepting a deal writes its fees as `pending` ledger rows. Approval and Complete turn them `executed`, keeping the once-only guarantee.
   - The Money page reads them.
   - A `payouts` content type for the phone's Bank.
   - Files: `dealPayoutService.js`, `episodeMoneyLines.js`, `ScreenContentRenderer.jsx`.
   - Tests: the balance ignores pending; flipping to paid books no double payment.
   - **No migration** (the status exists).
6. **feat(documents): the brand agreement.**
   - A `brand_agreement` document type for a brand deal:
     - letterhead with the brand's logo;
     - "Creator Partnership Agreement · <event>";
     - the Brand and Creator boxes;
     - the numbered clauses from §2.6;
     - signature lines;
     - OFFER → EXECUTED with Lala's signature when she accepts.
   - Its overlay is drawn on the server.
   - Files: `eventDocumentsService.js`, `eventDocumentOverlayService.js`, `EventDocuments.jsx`.
   - **No migration** (stored in `canon_consequences.documents`, as today).
7. **feat(trust): per-brand trust.**
   - A `brand_trust` ledger by story order.
   - Results: all delivered raises that brand's trust and a miss lowers it (amounts per decision 6).
   - `trustAt(brand, at)`.
   - Files: a new service, `episodeCompletionService.js`, and a migration for the table.
8. **feat(pulse): the sponsored post.**
   - A post made for a deliverable carries its brand and shows the in-world "#ad". The brand reposts it, and friends react, through The Pulse's existing review.
   - Migration: `feed_posts.sponsored_by_profile_id`.
   - Touches #3086's follower causes.
9. **feat(deals): offers drafted to fit, approved by Evoni.**
   - Draft offers by influence tier, niche and per-brand trust. They start as "draft" until approved, then become "offered".
   - Rival brands: a `rival` relationship between brand profiles (`SocialProfileRelationship`), with proposed consequences when Lala accepts a rival's deal (unfollow, shade, a pulled offer), approved like other Pulse content.
   - Files: `characterSyncService.js` / `feedEventPipelineService.js`, `opportunityRoutes.js`.
   - **No migration** beyond issue 2.

Order: 1 and 2 first, in parallel. 3 needs 2; 4 needs 3; 5 needs 2; 6 needs 1 and 2; 7 needs 2; 8 needs 1; 9 needs 1, 2 and 7.

## 6. Decisions for Evoni ([decide])

1. **[decide] What a brand is:**
   - a Pulse profile marked as a brand account, linked to its LalaVerse brand (recommended); or
   - the LalaVerse brand row alone, with no Pulse presence; or
   - a new brand table?
2. **[decide] Where a brand deal lives:**
   - the Opportunity, extended with the deal model, so the brand offers and the event stays the host's (recommended); or
   - a world event as today, with the brand as host, which can't arrive mid-episode because the terms lock?
3. **[decide] How it arrives mid-episode:**
   - a script cue `[OFFER: id]` at its beat (recommended, like `[WEAR]`); or
   - a beat saved on the offer?
4. **[decide] Who accepts or declines:**
   - Evoni records Lala's choice on the offer, and the script shows it at the beat; or
   - a script cue (`[ACCEPT: id]` / `[DECLINE: id]`) is the record?
5. **[decide] Bank pending:**
   - pending ledger rows that turn paid (recommended; the balance already ignores them); or
   - keep pending as a Money-page display only?
6. **[decide] Brand trust:**
   - Is its scale 0–10, like Lala's stats?
   - What does all-delivered add and a miss take away (for example +1 and −1)?
   - Does the global `brand_trust` stay, as the average or the latest, or retire?
7. **[decide] The Career plan:**
   - The brand agreement replaces it for brand deals (spec §13). For an event with no brand deal, keep the Career plan, or drop it now that the Career list holds her goals?
8. **[decide] The sponsored post's disclosure:**
   - exactly "#ad"; or
   - "#ad" plus "Paid partnership with <brand>"?
9. **[decide] Rival consequences:**
   - proposed for Evoni's approval (recommended); or
   - applied automatically when Lala accepts a rival's deal?
