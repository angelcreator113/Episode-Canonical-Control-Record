# Deal components, drafted Terms and real deliverable formats (D13–D15)

**Status:** DESIGN. Nothing here is built. It follows Evoni's rulings D13,
D14 and D15 (2026-09-30), recorded verbatim in
`docs/EVENT_EPISODE_FLOW.md` §8(cc). The decisions it proposes are marked
PROPOSED. Where the rulings leave something open, the numbered questions in
§8 ask Evoni.

It builds on `docs/DEAL_DESIGN.md` (the deal build, PRs 1–5) and on the
event cost split ruling of 2026-09-30 (§8(cc)), which moves the extras
(drinks, valet, photo booth) out of the Terms into the episode's Money tab.
Code is cited by stable name (service, function or constant), as living docs
do.

## 1. The rulings in one paragraph each

- **D13 — the whole Terms section is drafted.** Choosing the deal terms
  drafts the following, all Auto-drafted and editable until the lock:
  - the deliverables, sized to the job (D12);
  - their prices, from the rate anchors;
  - the costs and who covers them;
  - a suggested bonus, where the deal usually has one.

  The deliverable drafts also suggest Lala's relationship goals (for
  example, a co-styled moment, or a follow-up with a guest brand). These
  are filed as goals, not deliverables.
- **D14 — a deal is a set of components.** Evoni ticks what the deal
  includes:
  - paid to appear;
  - paid for content;
  - partnership base;
  - performance fee;
  - gifted items;
  - entry covered.

  The deal's label is derived from the combination. It replaces the single
  `deal_type`.
- **D15 — real influencer formats.** Each deliverable is a format with a
  platform, a quantity and a plain one-line description. The formats are:
  - Instagram Reel;
  - TikTok video;
  - GRWM video;
  - Instagram Stories (×N);
  - carousel post;
  - Go Live;
  - link in bio (days);
  - try-on/haul video;
  - content for the brand (UGC).

  Labels read naturally, e.g. "1 TikTok GRWM, 3 Instagram Stories". "Story
  Set (3)" becomes "Instagram Stories (×3)". The new formats' rate anchors
  start as proportions of the Reel anchor, for Evoni's approval. The Tasks
  list uses the same format names.

## 2. What exists today

**`world_events.deal_type`.** A string with eight values:
- `self_funded`
- `invited_comped`
- `gifted`
- `paid_appearance`
- `paid_deliverables`
- `appearance_plus_deliverables`
- `performance_booking`
- `brand_partnership`

It is validated by `WorldEvent.DEAL_TYPES`, not by a Postgres enum. `null`
means a legacy event (D8), and every branch below treats null that way.

**The per-type switch is `dealPricingService.DEAL_PLANS`.** It records which
components each type pays (`EVENT_COMPONENTS`: appearance, partnership_base,
performance), whether deliverables are paid, and whether the deal is cash.
`appearance_required` adds the appearance component to a brand partnership.
The frontend mirror is `frontend/src/constants/dealPlans.json`.

**Everything else branches on `deal_type`:**
- `dealTypeDraftService.draftDealType` drafts the type from the
  opportunity type, the brand-owed rule and the comped event types.
- `dealPricingService.draftedDeliverableTypes`, `draftDeliverablesForDeal`
  and `proposeTerms` size and price the deliverables (D12).
- `dealPayoutService.completionPayouts` and `contentFeeFor` pay out at
  Complete and on approval.
- `eventCostsService.ENTRY_PAYER_BY_DEAL` drafts the entry line: paid by
  Lala for self-funded, comped by the host for invited/comped.
- `invitationCompositingService.describeInvitationMoney` writes the
  invitation wording: "our guest", "our gifted guest", "We will pay you
  …", or "Entry is N coins, paid by you".
- The UI: the deal-type select in `EventTermsSection`, the chip and filter
  in `eventCardSummary`, `eventStakes.describeEventMoney`, and the
  "Difficulty" label for `cost_coins`.
- The lock: `eventTermsLock.LOCKED_EVENT_FIELDS`.

**Deliverables (`event_deliverables`).**
- `deliverable_type` is one of `reel`, `story_set_3`, `post`, `photo_set`,
  `other` (`eventTermsService.DELIVERABLE_TYPES`), labelled "Reel", "Story
  Set (3)", "Post", "Photo Set", "Other".
- There is no platform and no quantity column; the quantity is baked into
  `story_set_3`.
- Only `reel` and `story_set_3` have anchors, in the `deal_rate_anchors`
  table (v1): Reel 75/125/225/325/450 and stories_3 35/60/110/160/225 for
  tiers 1–5.
- `socialTaskSource.deliverableTask` puts the type key in the task's
  `platform` field.

**Bonus.** `bonus_terms` holds `{ slay, pass, safe }`. It exists only when
entered by hand, and pays at Complete on cash deals only.

**Relationship goals.** There is no such notion yet. The nearest are the
`host_moment`, `brand_moment` and `network` goal slots in
`goalTasks.specificGoals`.

## 3. D14: replacing `deal_type` with components

### 3.1 The components (PROPOSED keys)

| Key | Ticked means | Money it carries |
|---|---|---|
| `paid_to_appear` | Lala is paid to show up | `appearance_fee` |
| `paid_for_content` | the deliverables are paid | each deliverable's `fee` |
| `partnership_base` | a brand partnership's guaranteed base | `partnership_base_fee` |
| `performance_fee` | she performs, speaks or hosts | `performance_fee` |
| `gifted_items` | she receives product | `gifted_value` (non-cash) |
| `entry_covered` | her entry or ticket is paid by the host or brand | the entry cost line, comped |

- **Storage (PROPOSED).** A new column,
  `world_events.deal_components JSONB`, holds an array of keys.
- **Null means legacy.**
  - `null` is a legacy event: no deal, D8 unchanged.
  - `[]` is a deal where Lala pays her own way (today's self-funded).
- **The cash test.** A deal is cash if any of `paid_to_appear`,
  `paid_for_content`, `partnership_base` or `performance_fee` is ticked.
  Bonus and content fees require cash, as they do now.
- **`appearance_required` is folded in.** A brand partnership that also
  requires an appearance simply ticks `paid_to_appear`.

### 3.2 The derived label (PROPOSED)

`dealLabel(components)` is pure and shared by server and client, as
`dealPlans.json` is today. Today's names are kept wherever a combination
matches one of them:

| Components | Label |
|---|---|
| none | Self-funded |
| `entry_covered` | Invited, comped |
| `gifted_items` (± `entry_covered`) | Gifted |
| `paid_to_appear` (± `entry_covered`) | Paid appearance |
| `paid_for_content` | Paid content |
| `paid_to_appear` + `paid_for_content` | Appearance plus content |
| `performance_fee` (± `paid_for_content`) | Performance booking |
| `partnership_base` (+ anything) | Brand partnership |

Any other combination joins its parts in a fixed order, e.g. "Paid
appearance + content + gifted".

Two things are not part of the label:
- `entry_covered` is only named on its own (Invited, comped).
- `gifted_items` alongside a cash component adds "+ gifted".

### 3.3 Migration and existing events (PROPOSED)

One migration adds `deal_components` and backfills it from `deal_type`,
under a fixed mapping. It keeps today's behaviour exactly:

| `deal_type` | `deal_components` |
|---|---|
| null | null (legacy, untouched) |
| `self_funded` | `[]` |
| `invited_comped` | `['entry_covered']` |
| `gifted` | `['gifted_items']` |
| `paid_appearance` | `['paid_to_appear']` |
| `paid_deliverables` | `['paid_for_content']` |
| `appearance_plus_deliverables` | `['paid_to_appear','paid_for_content']` |
| `performance_booking` | `['performance_fee','paid_for_content']` |
| `brand_partnership` | `['partnership_base','paid_for_content']`, plus `paid_to_appear` when `appearance_required` |

- **Locked events are backfilled the same way.** The mapping changes no
  money, so a started episode's terms read the same after the migration.
- **The Auto-drafted record moves with it.** `canon_consequences.automation`
  gets `drafted_values.deal_components` from `drafted_values.deal_type`,
  and `auto_drafted.deal_components` from `auto_drafted.deal_type`.
- **`deal_type` stays for one release as a derived copy.** It is written
  from the components on every save, so a rollback still works. A later
  migration drops `deal_type` and `appearance_required` once nothing reads
  them.

### 3.4 What each consumer changes to (PROPOSED)

- **Plan.** `DEAL_PLANS[deal_type]` becomes `dealPlan(components)`:
  - the fee components come from the ticked money components;
  - `deliverables` is `paid_for_content`;
  - `cash` is the cash test in §3.1;
  - `giftedValue` is `gifted_items`.

  `dealComponents`, `proposeTerms` and `missingPrices` keep their shape and
  read the plan.
- **Drafting.** `draftDealType` becomes `draftDealComponents`, with the same
  rules mapped through the §3.3 table:
  - opportunity type → components;
  - brand-owed → `partnership_base` + `paid_for_content`;
  - comped event types → `entry_covered`;
  - otherwise `[]`.

  It still re-drafts only while the value is Auto-drafted and the terms are
  unlocked.
- **Payouts.** `completionPayouts` and `contentFeeFor` read the plan, so they
  are unchanged in effect.
  - `payerFor` is unchanged: the base is paid by the brand; the others by
    the brand if there is a `host_brand`, else by the host.
  - A combination that is new today pays each ticked money component once,
    e.g. appearance + performance fee, which is not possible now.
- **Costs.** The entry line is drafted when `cost_coins > 0`:
  - comped by the host when `entry_covered` is ticked;
  - paid by Lala when the deal has no components at all (self-funded);
  - with any other combination, the entry line depends on Question 3.
- **Invitation wording.** `describeInvitationMoney` is built from sentences,
  one per ticked component, in a fixed order:
  1. "You attend as our guest, with our compliments." when `entry_covered`
     is ticked and the deal is not cash.
  2. "We will also send you {gifted}." for `gifted_items`.
  3. The existing "We will pay you {fee names} of N coins." for the fee
     components (`FEE_NAMES` already names each component).
  4. The deliverables line; each deliverable shows its fee when
     `paid_for_content` is ticked.
  5. "Entry is N coins, paid by you." when no component covers entry.

  The covered-cost and bonus sentences follow, as now. Invitations already
  composited keep their image; only a new design or redesign uses the new
  wording.
- **UI.** The deal-type select becomes six checkboxes, with the derived
  label shown above them ("Brand partnership · Auto-drafted"). The event
  card's chip and filter use the derived label; the filter becomes "has
  component X".

## 4. D13: drafting the whole Terms section (PROPOSED)

When the components are first set, the Terms draft does all of the
following in one step (Propose terms today does part of it). Every drafted
value is recorded under `canon_consequences.automation` (doctrine rule 14)
and reads Auto-drafted until edited.

1. **Deliverables.** D12's sizing, generalised from deal types to
   components. The career tier sets the size, as D12 does now, and the
   formats come from D15 (§5).
   - `paid_for_content` alone sizes like today's paid deliverables.
   - With `paid_to_appear` or `performance_fee`, it gives one piece fewer,
     like today's appearance-plus and performance bookings.
   - With `partnership_base`, it gives the partnership package.
   - Unpaid deliverables (for example, a paid appearance's optional
     Stories) are drafted `required: false` with no fee, as now.
2. **Prices.** Each fee comes from the anchor for its format, platform,
   quantity and tier (§5.3). Each component fee (appearance, base,
   performance) comes from its anchor, as `proposeTerms` does now.
3. **Costs and who covers them.** The entry line follows §3.4. Travel and
   accommodation are drafted only if the event has them; today nothing
   drafts them (Question 7).
   - Extras are no longer drafted in the Terms; they are event spending,
     per the cost split ruling.
4. **Suggested bonus.** Drafted only "where the deal usually has one":
   - **When (PROPOSED):** `partnership_base` or `performance_fee` is
     ticked.
   - **How much:** slay 20% and pass 10% of the deal's cash total, rounded
     to 5; safe 0.
   - It is a suggestion like the other drafts: editable and removable.
     Whether and how much is Question 5.
5. **Relationship goals.** Drafted with the deliverables:
   - Each is written from the event's own fields (host, `host_brand`, guest
     brands, guests), e.g. "Co-style a moment with {guest brand}" or
     "Follow up with {host} after the event".
   - They are stored on the event as suggested goals, not as deliverables
     (PROPOSED: `canon_consequences.automation.relationship_goals`, a list
     of `{ slot, label, description }`).
   - They are shown under the deliverables as "Lala's goals (not owed)".
   - Start Episode writes them onto the episode's list as `task_source:
     'goal'`, never required (T1), and counted in T9's combined limit
     (Question 6).

**Re-drafting.** Changing the components before the lock re-drafts only the
values that are still Auto-drafted. Anything Evoni edited or deleted stays
as she left it, as D12's once-only drafting does for deliverables today.

## 5. D15: real influencer formats

### 5.1 The formats (PROPOSED keys)

| Key | Label | Platform(s) | Quantity means |
|---|---|---|---|
| `instagram_reel` | Instagram Reel | instagram | reels |
| `tiktok_video` | TikTok video | tiktok | videos |
| `grwm_video` | GRWM video | tiktok or instagram | videos |
| `instagram_stories` | Instagram Stories | instagram | stories |
| `carousel_post` | Carousel post | instagram (or tiktok photo mode) | posts |
| `go_live` | Go Live | instagram or tiktok | lives |
| `link_in_bio` | Link in bio | instagram or tiktok | days |
| `try_on_haul` | Try-on/haul video | tiktok, instagram or youtube | videos |
| `ugc` | Content for the brand (UGC) | none (delivered to the brand) | pieces |
| `other` | Other | any | — |

**Schema (PROPOSED).** `event_deliverables` gains `platform STRING(20) NULL`
and `quantity INTEGER NOT NULL DEFAULT 1`. `description` stays as the plain
one-line description.

**Labels** are built as "{quantity} {platform} {format}":
- "1 TikTok GRWM" and "3 Instagram Stories";
- "Instagram Stories (×3)" in the Terms row;
- "Link in bio (7 days)".

The Tasks list uses the same label (`socialTaskSource.deliverableTask`), and
its task `platform` becomes the real platform instead of the type key.

### 5.2 Existing deliverables (PROPOSED migration)

| Today | Becomes |
|---|---|
| `reel` | `instagram_reel`, instagram, ×1 |
| `story_set_3` | `instagram_stories`, instagram, ×3 |
| `post` | Question 8 (there is no single-image post in D15) |
| `photo_set` | `carousel_post`, instagram, ×1 |
| `other` / null | `other`, platform null, ×1 |

Fees are not touched, so locked episodes pay exactly what they agreed.
Only labels and task names change.

### 5.3 Rate anchors (PROPOSED, for Evoni's approval)

The anchors are a new version (v2) of `deal_rate_anchors`. Priced terms keep
their `pricing_version`, so nothing already priced changes. The table uses
the Reel anchor (75/125/225/325/450) times D15's proportions, rounded to the
nearest 5 with halves rounding up (Question 9):

| Format | × Reel | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|---|
| Instagram Reel | 1.0 | 75 | 125 | 225 | 325 | 450 |
| TikTok video | 1.0 | 75 | 125 | 225 | 325 | 450 |
| GRWM video | 1.2 | 90 | 150 | 270 | 390 | 540 |
| Carousel post | 0.6 | 45 | 75 | 135 | 195 | 270 |
| Go Live | 1.5 | 115 | 190 | 340 | 490 | 675 |
| Try-on/haul video | 1.0 | 75 | 125 | 225 | 325 | 450 |
| UGC (before usage) | 0.8 | 60 | 100 | 180 | 260 | 360 |
| Link in bio, per 7 days | 0.3 | 25 | 40 | 70 | 100 | 135 |

- **Instagram Stories** keep today's anchor: 3 stories are 35/60/110/160/
  225. A different N is priced per story at a third of that, rounded to 5
  (Question 10).
- **UGC usage** is priced on top from the existing usage premiums: 30 days
  +15%, 90 days +25% (`deal_rate_premiums`).
- **Link in bio** is priced per started 7 days, so 10 days counts as 2
  weeks (Question 11).
- **Quantity.** The fee is the anchor × quantity for every format except
  Stories and Link in bio, whose rules are above.

## 6. Build order (PROPOSED, each its own PR, stopping before push)

1. **D15 schema and names.**
   - Add `platform` and `quantity`, and migrate the type keys.
   - Seed the v2 anchors (after Evoni approves §5.3).
   - Labels on the server and client, and the task names.
   - The Terms editor gains format, platform and quantity pickers.
2. **D14 schema.**
   - Add `deal_components` with the backfill.
   - `dealPlan(components)` and `dealLabel(components)`.
   - Drafting, payouts and costs read the components; `deal_type` is
     written as a derived copy.
3. **D14 UI and wording.**
   - The checkbox editor.
   - The derived label on cards and filters.
   - Invitation wording built from sentences.
4. **D13 drafting.** Draft the whole Terms section on choosing components:
   the suggested bonus and the relationship goals (with Start Episode
   writing the goals).
5. **Cleanup.** Drop `deal_type` and `appearance_required`, after one deploy
   with the derived copy.

The event cost split (extras as event spending) is built before PR 4, so
D13's cost drafting never drafts extras into the Terms.

## 7. Risks

- **Two sources of truth during PRs 2–4.** They are kept safe by writing
  `deal_type` only from the components, never the other way round.
- **A combination that is new today** (e.g. appearance + performance fee)
  can pay more than any single deal type does now. The payout test matrix
  must cover every combination the UI allows (6 checkboxes, 64 sets).
- **Invitations already composited** keep the old wording. That is harmless,
  but a redesign changes them.

## 8. Questions for Evoni

1. Are the six component keys and the one-to-one backfill mapping in §3.3
   right? In particular: does `gifted` also mean entry covered, and does a
   performance booking always include paid content, as today's plan
   assumes?
2. Are the derived labels in §3.2 right? For a combination that isn't
   listed, is "Paid appearance + content + gifted" the style you want?
3. Entry: when a deal is cash but `entry_covered` is not ticked, is there an
   entry line at all? If so, who pays it: Lala, or is being paid to come
   implicitly entry-covered?
4. Can `partnership_base` be ticked without `paid_for_content`, i.e. a
   partnership with no content?
5. Suggested bonus: which deals "usually have one"? Is it partnership and
   performance, as proposed? And what amounts: slay 20% and pass 10% of the
   cash total, as proposed, or fixed per tier?
6. Relationship goals: do they count toward T9's combined limit (2–3 /
   4–6)? And how many at most per event: one or two, as proposed?
7. Travel and accommodation: should the Terms draft them? And from what: a
   distance or venue field that doesn't exist yet, or only by hand?
8. The existing `post` type is not in D15's list. Should it become a
   carousel post, a new "Instagram post", or stay as "Other"?
9. Are the rounding rule (to the nearest 5, halves up) and the v2 anchors in
   §5.3 approved as listed?
10. Instagram Stories for N other than 3: a third of the 3-story anchor per
    story, as proposed? Or a separate per-story anchor?
11. Link in bio: price per started 7 days (10 days = 2 weeks), as proposed,
    or pro rata?
12. GRWM, Go Live and try-on/haul can go on more than one platform. Should
    the same format on TikTok and Instagram cost the same, as proposed?
13. When the components change after Evoni has edited some drafted values,
    should the re-draft only fill what is still Auto-drafted, as proposed?
    Or ask first?

## What this note does not do

It changes no code and no schema. It rules nothing and mints nothing. The
filing session made no host, AWS, database or Cognito contact.
