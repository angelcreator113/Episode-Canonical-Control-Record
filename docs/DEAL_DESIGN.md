# Deal design: deal types, pricing, payout timing and planned money

## Status of this document

**A design note for Evoni's approval.** It proposes code but changes none,
and writes no migration and no test. No database was queried, and no host,
AWS, database or Cognito contact was made. Nothing here is built until Evoni
answers §10 and approves.

It implements the rulings below. They are cited, not restated:
- `docs/EVENT_EPISODE_FLOW.md` §8(x) **D6–D11**: deals, payout timing,
  pricing and opportunity events;
- §8(y) **Q1–Q9** and the Prime Coins doctrine;
- §8(z) **Laws 0–14**;
- §8(aa) **M1–M6**, whose Phase B is "financial plan, pending and
  receivables, itemised event budget" (M5);
- §8(bb) **T1–T8**: deliverables, `owed_to`, and no coins for ticking a
  task (T3).

It builds on two notes:
- `docs/EVENT_TERMS_MONEY_READ.md` (the money-path read);
- `docs/COINS_LEDGER_CACHE_DESIGN.md` (D1: the ledger is the balance, and
  `character_state.coins` is its cache).

Claims are marked:
- **MEASURED**: read from this repository and cited by name, with a line
  number at the basis below.
- **PROPOSED**: the design, for approval.
- **QUESTION**: a decision that is Evoni's (§10).

**Basis:** `origin/main` at `31e6e5d9b6b4e7e6a1f5834a0830d8b6687e5992`
(2026-09-29, #2308). `EVENT_TERMS_MONEY_READ.md` was read at an older basis;
where this note cites a line, it is re-measured here.

**Abbreviations:**
- **FTS**: `src/services/financialTransactionService.js`
- **ECS**: `src/services/episodeCompletionService.js`
- **EGS**: `src/services/episodeGeneratorService.js`
- **ETS**: `src/services/eventTermsService.js`
- **WE**: `src/routes/worldEvents.js`
- **WEM**: `src/models/WorldEvent.js`

---

## 0. Summary (PROPOSED)

- **Deal type:** a new `world_events.deal_type`, one of D7's eight types.
  - It is null for every existing event. A null deal type keeps today's
    payout exactly (D8, "existing events keep today's behaviour").
  - A new event's deal type is auto-drafted by a fixed rule, not by the AI
    (R1, rule 14), stays editable, and locks with the terms.
- **Pricing:** a `deal_pricing` table Evoni tunes (D9).
  - A proposal reads it once and writes the resulting numbers onto the event.
  - So a later price change never moves a deal already made.
- **Payouts,** each through D2's transaction and `syncCoinsFromLedger`:
  - the appearance fee at Complete ("attendance");
  - the content fee when a deliverable is approved;
  - the bonus at Complete, by evaluation tier;
  - gifted value is recorded, never paid in coins.
- **Planned and pending money** never enter the ledger (M2, Law 9).
  - Planned is the deal's terms. Pending is a term whose trigger has
    started but not finished.
  - Both are computed from the terms and statuses, with no new money table.
  - The Money tab shows planned, pending and posted.
- **Itemised costs:** an `event_costs` table replaces the single
  `cost_coins` charge for deal events (Law 7). `cost_coins` stays as
  difficulty only for those events (Law 0).
- **Opportunity events** get a deal type from their opportunity type and pay
  by it (D10).
- **Goal completion and stats:** four options are given (§7).
- **The build:** five guarded migrations, then seven PRs (§8). There are 16
  open questions, each with a recommendation (§10).

---

## 1. Today (MEASURED)

### 1.1 How event money moves

**Finalize** is `finalizeEpisodeFinancials` (FTS:340).
- **Transaction:** when no caller transaction is given, it runs in its own
  (FTS:352–353), then syncs the cache (FTS:358). It refuses to leave the
  balance below zero (FTS:360–361).
- **Locks and guard:** it locks the episode row (FTS:369) and the show's
  ledger (FTS:375). Its repeat guard counts executed non-wardrobe rows for
  the episode (FTS:380–383) and returns `already_finalized`.
- **Paid and free flags:** `normalizePaidFreeFlags` (FTS:299–306) derives
  them. A paid event is never charged its entry cost (FTS:303). Payment is
  counted only when `is_paid` (FTS:304).
- **Rows:**
  - `event_entry` expense (FTS:472);
  - wardrobe purchase and rental;
  - `styling_extras`, from `EVENT_EXTRAS` (`src/utils/financialRates.js:37`);
  - `event_payment` income, only when `isPaid && eventPayment > 0`
    (FTS:525–531);
  - `content_revenue`, a flat 10% of the payment on `event_type ===
    'brand_deal'` (FTS:535–536), with nothing delivered or checked;
  - milestone rewards.
- **Tasks pay nothing:** "Coins never come from ticking a task" (FTS:27–29,
  §8(bb) T3). `calculateSocialTaskRewards` was removed in #2265.

**Complete** is `completeEpisode` (ECS).
- It runs in one transaction (ECS:377), guarded on `accepted` (ECS:385).
- It calls finalize in that transaction (ECS:399).
- **Rows:**
  - `tier_reward`: slay 150, pass 75, safe 25, fail −25 (ECS:363, :406);
  - `tier_paid_bonus` (ECS:365, :420);
  - `event_reward` from `rewards.coins` (ECS:437).
- Then it syncs (ECS:451) and refuses a negative result (ECS:457).
- **Discrepancy:**
  - Complete gates `tier_paid_bonus` on raw `cost_coins > 0` (ECS:365,
    with `eventContext.cost` from ECS:304).
  - The forecast (WE:2933) gates it on the normalised cost, which is 0 for a
    paid event.
  - For a paid event with `cost_coins > 0`, the two disagree.

**Deliverables** follow `pending → completed → submitted → approved`
(ETS:35).
- Each moves one step forward through the status POST
  (`src/routes/eventDeliverables.js:255`), a compare-and-set (`:297`).
- The route writes no ledger row.
- Each row has `owed_to` host or brand (`src/models/EventDeliverable.js:50–56`).

### 1.2 The fields a deal would use

| Field | What it is | Where |
|---|---|---|
| `event_type` | STRING(30), default `'invite'`, comment-only values `invite \| upgrade \| guest \| fail_test \| deliverable \| brand_deal`, no `isIn` | WEM:44–49 |
| `is_paid`, `payment_amount` | BOOLEAN default false; INTEGER default 0 | WEM:257–266 |
| `cost_coins` | INTEGER not null, default 100 | WEM:169–173 |
| `career_tier` | INTEGER default 1, "1=Emerging … 5=Elite" | WEM:285–289 |
| `prestige` | INTEGER 1–10, default 5 | WEM:163–168 |
| `rewards` | JSONB; Complete reads a flat `rewards.coins` | WEM:250–254 |
| `restrictions` | JSONB `[{type, description}]` | WEM:276–284 |
| `opportunity_id` | UUID, nullable | WEM:114–118 |
| `deal_type` | **Not present.** `grep -rn "deal_type" src frontend/src` returns nothing. | — |

- **Lala's tier** is derived from reputation, not stored:
  `min(5, floor(rep/2)+1)` (`src/services/careerPipelineService.js:371`,
  duplicated at WE:4476).
- **The terms lock** covers `requirements`, `is_paid`, `payment_amount`,
  `restrictions` and `used_in_episode_id` (`src/utils/eventTermsLock.js:25–31`).
  It does not cover `event_type`, `cost_coins` or `rewards`.
- **The concept draft** (`src/services/eventConceptDraftService.js`, R1)
  drafts:
  - concept, activity, description, category, format, event time, styling
    and name (its schema at `:205`, return shape at `:367`);
  - no event type, pay, cost or prestige.
- **No pricing table exists.** The nearest things are:
  - the economy constants in `src/utils/financialRates.js`: `USD_TO_COINS`
    `:14`, `DEFAULT_STARTING_BALANCE` `:20`, `EVENT_EXTRAS` `:37`, and
    `CONTENT_REVENUE_PER_PRESTIGE` `:52`, which is unused;
  - hard-coded ranges in `OPPORTUNITY_TEMPLATES`
    (`src/services/characterSyncService.js:323`);
  - the `cost_coins` prestige ladder
    (`src/services/feedEventPipelineService.js:542`, `:804`).
- **The ledger** is `financial_transactions`. It has no model file; its
  schema is migration `20260724000002-create-financial-transactions.js`:
  - `type` income, expense, reward, deduction or refund (`:20–22`);
  - `status` defaults to `'executed'`; its comment says "pending | executed |
    reversed" (`:45–49`), but no code writes `pending`;
  - no unique constraint.
- **No table holds planned money.** Episode Money Phase A shows expected
  lines computed from the terms (`src/services/episodeMoneyService.js:45–57`),
  and its header says "Phase A has no planned or pending states (Phase B)"
  (`:14`).

### 1.3 Opportunity events today

Both conversion paths set `is_paid: false` through
`compensationFromOpportunity` (ETS:111–115, rationale ETS:106–109). The pay
is recorded but never paid.

**`scheduleOpportunityAsEvent`** (`src/services/feedEventPipelineService.js:382`):
- sets `event_type` from `EVENT_TYPE_CONFIGS` (`:537`);
- sets a prestige-scaled `cost_coins` (`:542`);
- sets `is_paid: false` (`:566`);
- does **not** write `opportunity_id` (the id goes only into
  `canon_consequences.automation`);
- so finalize charges an entry cost and pays nothing.

**`convertOpportunityToEvent`** (`src/services/careerPipelineService.js:195`):
- sets `event_type` `brand_deal` or `invite` (`:211`);
- writes `opportunity_id` (`:219`);
- leaves `cost_coins` at the default 100.

---

## 2. Deal types (D7) — PROPOSED

### 2.1 Storage

- **The column:** `world_events.deal_type`, STRING(30), nullable. The model
  validates it with `isIn` against the eight values below.
- **Null** means a legacy event, paid exactly as today (§1.1). No existing
  row is backfilled (D8).
- **The terms that come with a deal,** new and nullable:
  - `world_events.appearance_fee` INTEGER;
  - `world_events.bonus_terms` JSONB `{slay, pass, safe}` (Prime Coins);
  - `world_events.gifted_value` INTEGER;
  - `world_events.pricing_version` INTEGER;
  - `event_deliverables.fee` INTEGER (the content fee for that deliverable).
- **Why not reuse `payment_amount`:** for a deal event, the fees above
  replace `payment_amount` and `is_paid`, which stay for legacy events only.
  The alternative is reusing them and would blur today's meaning, which D8
  protects.

### 2.2 Who sets it

- **Auto-drafted when the event is created** (R1, `DESIGN_DOCTRINE.md` rule
  14).
  - The deal type is labelled "Auto-drafted · <source>" until Evoni changes
    it.
  - It is drafted by a **fixed rule, not the AI**, because it decides money:
    - from the opportunity type when there is one (§6);
    - `brand_partnership` when `host_brand` is set and a deliverable is owed
      to a brand;
    - `invited_comped` for `invite`, `guest` and `upgrade`;
    - otherwise `self_funded`.
  - QUESTION 2.
- **Editable** in the Event Package's Terms area until the terms lock.
- **Locked with the terms:** `deal_type`, `appearance_fee`, `bonus_terms`,
  `gifted_value` and each deliverable's `fee` join `LOCKED_EVENT_FIELDS`
  (`src/utils/eventTermsLock.js:25`) under "compensation". The deliverable
  routes already hold their own lock.

### 2.3 How each type maps to money

"From" is who pays Lala. For a content fee, it is the deliverable's
`owed_to` (T2). For an appearance fee or bonus, it is the organiser: the
brand when `host_brand` is set, otherwise the host.

| Deal type | Lala pays | Lala earns (when) | From | Gifted value |
|---|---|---|---|---|
| `self_funded` | Her itemised costs (§5) | Nothing contracted | — | — |
| `invited_comped` | Only costs not comped | Nothing contracted | — | Comped costs recorded as comped, not charged (Law 6) |
| `gifted` | Costs not comped | Nothing in coins | — | `gifted_value` recorded, never paid (D8, Law 10) |
| `paid_appearance` | Costs not comped | `appearance_fee` at Complete (§3.1) | Organiser | — |
| `paid_deliverables` | Costs not comped | Each deliverable's `fee` when it is approved | Its `owed_to` | — |
| `appearance_plus_deliverables` | Costs not comped | Both of the above | Organiser; each `owed_to` | — |
| `performance_booking` | Costs not comped | `appearance_fee` (the booking fee) at Complete, plus `bonus_terms` by tier | Organiser | — |
| `brand_partnership` | Costs not comped | Each deliverable's `fee` when approved, plus `bonus_terms` by tier | The brand | Optional `gifted_value` (product) |

**Bonus terms:**
- Any deal type may carry `bonus_terms`. The table shows where pricing
  proposes them.
- The bonus is **the deal's**. It is separate from `tier_reward` (ECS:363),
  which is Lala's career reward and stays for every event (QUESTION 12).

---

## 3. Pricing (D9) — PROPOSED

### 3.1 The table Evoni tunes

**`deal_pricing`** has one row per deal type × career tier (1–5):
- `id`, `version` (integer), `deal_type`, `career_tier`;
- `base_appearance_fee` (INTEGER, may be 0);
- `base_content_fee` (INTEGER per deliverable);
- `bonus_slay`, `bonus_pass`, `bonus_safe` (INTEGER);
- `created_at`, `updated_at`, `deleted_at`.

**`deal_pricing_modifiers`** has one row per modifier:
- `id`, `version`;
- `kind`, one of:
  - `prestige` (key 1–10);
  - `deliverable_type` (key `post`, `story`, `reel`, `appearance` …);
  - `rights` (key `usage_30d`, `usage_perpetual` …);
  - `restriction` (key `exclusivity` …);
  - `urgency` (key = `deadline_type`: `low` / `medium` / `urgent`);
- `key`;
- `multiplier` (DECIMAL, default 1);
- `premium` (INTEGER, default 0);
- `deleted_at`.

**A proposal:**

    appearance = base_appearance_fee[type][tier] × prestige_mult × urgency_mult
    content fee (each deliverable) = (base_content_fee[type][tier]
                                      + deliverable_type premium) × prestige_mult
    rights and restrictions = Σ their premiums, added to the appearance fee
                              (or to the first content fee when there is none)
    bonus[tier] = bonus_<tier>[type][tier] × prestige_mult
    all amounts rounded to whole Prime Coins (§8(y) Q7)

- The event's `career_tier` (WEM:285) is the tier.
- A deliverable with no `deliverable_type`, or an unknown one, takes no
  premium.

### 3.2 How a proposal reads it

- **"Propose terms"** in the Event Package calls a pricing function (a new
  service, `dealPricingService.proposeTerms(event, deliverables)`).
- It **writes the resulting numbers** into `appearance_fee`, `bonus_terms`,
  each deliverable's `fee`, and `pricing_version`.
  - The fields show "Auto-drafted · pricing v<N>" (rule 14).
  - Evoni can edit any number until the lock.
- **A price change applies only to new deals:**
  - a change is a new `version`;
  - payouts read the event's stored numbers, never the table;
  - so no event, drafted or accepted, moves when the table changes.
- **With no pricing rows** for a type and tier, "Propose terms" says so and
  leaves the fields empty for Evoni to fill (QUESTION 4).

### 3.3 Scope

- The table is global, one economy for the LalaVerse.
- A per-show override can come later (QUESTION 3).
- Evoni edits it on a Show Settings economy page, admin only
  (`requireAuth + authorize(['ADMIN'])`), in a later PR.

---

## 4. Payout timing (D8, Law 8, Law 9) — PROPOSED

**Common rules:**
- Every payout below is one ledger row with:
  - `episode_id` (M3);
  - `source_type` / `source_id` pointing at what caused it (Law 13);
  - `metadata.payer` (`host` or `brand`) and the organiser or brand name.
- It is written inside a transaction that locks the show's ledger
  (`lockLedgerBalance`, `src/services/coinLedgerSync.js:71`) and ends with
  `syncCoinsFromLedger` (`:82`), the D1 pattern.
- **Existing events** (`deal_type` null) keep today's rows exactly:
  `event_payment`, `content_revenue`, `tier_paid_bonus` (§1.1).
- A deal event books none of those three.

| Trigger | Row | Where | Idempotency |
|---|---|---|---|
| **Attendance = Complete accepted** (QUESTION 1) | income `appearance_fee`, `source_type 'event'` | Finalize, inside Complete's transaction (ECS:399), replacing `event_payment` for deal events | Finalize's existing guard (FTS:380–387), plus the unique index below |
| **Deliverable approved** | income `content_fee`, `source_type 'deliverable'`, `source_id` = deliverable id, `metadata.owed_to` | The deliverable status POST (`src/routes/eventDeliverables.js:255`), in a new transaction around its compare-and-set (`:297`) | The compare-and-set moves a row to `approved` once; the unique index below backs it |
| **Evaluation = Complete accepted** | income `deal_bonus`, amount `bonus_terms[tier]` | Complete (ECS), beside `tier_reward` | Complete's `accepted` guard (ECS:385), plus the unique index below |
| **Gifted** | none | — | `gifted_value` stays on the event (planned, §4.1); the item itself belongs to the wardrobe economy (Law 10) |

**The unique index (new):** a partial unique index on `financial_transactions
(category, source_id)` where `category IN ('appearance_fee', 'content_fee',
'deal_bonus') AND status = 'executed' AND deleted_at IS NULL`. The ledger has
no unique constraint today (§1.2), so this is the first.

**A deliverable approved before its episode completes** is paid at approval,
with its `episode_id`.
- If that episode is later deleted, M6 drops the row from the balance, as
  for every other row.
- D6 keeps advancement manual, so approval is Evoni's act.

**`tier_paid_bonus`'s raw-cost gate** (ECS:365) is left as it is for legacy
events. D8 keeps their behaviour. QUESTION 8 asks whether to fix it anyway.

### 4.1 Planned and pending money (M2, Law 9, Phase B), task item 4

**Neither enters the ledger** (M2). Neither is counted by
`getCurrentBalance` or `syncCoinsFromLedger`, so neither can be spent
(Law 9).

**Planned** is the deal's terms, stored where they already live. No money
table is needed:
- `appearance_fee`, `bonus_terms`, `gifted_value` on the event;
- `fee` on each deliverable;
- the event's itemised costs (§5);
- the brief's terms snapshot (`buildTermsSnapshot`, ETS), extended with
  these fields at Start Episode, so the episode keeps what was agreed.

**Pending** is a planned amount whose trigger has started but not finished.
It is **derived, never stored**:
- a content fee whose deliverable is `completed` or `submitted` but not
  `approved`;
- the appearance fee and bonus after Start Episode and before Complete.

**Posted** is the ledger rows (M4), as Phase A shows now.

**When earned, planned becomes posted** through the triggers in §4. Nothing
converts pending to posted except those triggers. There is no "mark paid".

**The Money tab (M1, M2):**
- Phase A's "Expected" section (`EpisodeMoneyTab.jsx:87–109`) becomes three
  sections: **Planned**, **Pending** and **Posted**.
- Each line names its payer (host or brand), its trigger and, for a content
  fee, its deliverable and status.
- The balance chip and the episode net read only Posted, as now.
- **Gifted value** shows under Planned as "Gifted — value, not coins" (Law 0,
  Law 10) and never moves to Posted.

**A receivables table** (for "the brand pays 30 story-days later") is not
proposed. Pending is derived. QUESTION 6 asks whether delayed payment is
wanted.

---

## 5. Itemised event costs (Law 7) — PROPOSED

- **The table:** `event_costs`, with one row per cost:
  - `id`, `event_id`;
  - `kind`: `entry`, `travel`, `glam`, `styling`, `accommodation`, `extras`,
    `other`;
  - `label`, `amount` (INTEGER);
  - `paid_by`: `lala`, `host` or `brand` (comped);
  - `created_at`, `updated_at`, `deleted_at`.
- **For a deal event, Finalize charges each `paid_by = 'lala'` row** as its
  own expense:
  - category `event_cost`;
  - `metadata.kind`;
  - `source_type 'event_cost'` and `source_id` = the cost row (Law 13).
  - Rows paid by the host or brand are recorded as comped and never charged
    (Law 6). The Money tab shows them under Planned as "Comped by <payer>".
- **Drafting:** `EVENT_EXTRAS` (drinks, valet, photo booth,
  `financialRates.js:37`) no longer charges a deal event as a hidden
  `styling_extras` row. Instead:
  - Propose terms drafts them as `extras` cost rows, which Evoni can edit or
    delete;
  - so every cost Lala pays is visible before it is charged.
- **`cost_coins` for deal events:**
  - it is **not charged**, and is kept only as difficulty (Law 0);
  - today it feeds the evaluation context (ECS:304), affordability
    (`financialPressureService.js:26`), the suggesters (WE:4526–4529), the
    script writer's `can_afford` (`episodeScriptWriterService.js:153–155`) and
    prompt text;
  - its UI label becomes "Difficulty" wherever it shows as "🪙";
  - renaming the column is a larger change across about 20 readers and is
    not proposed now (QUESTION 7);
  - legacy events keep `cost_coins` as their entry charge (D8).
- **The lock:** itemised costs lock with the terms (Law 7, D4).

---

## 6. Opportunity events (D10) — PROPOSED

- **The deal type at conversion:** both conversion paths set `deal_type`
  from the opportunity:
  - `scheduleOpportunityAsEvent` (`feedEventPipelineService.js:382`);
  - `convertOpportunityToEvent` (`careerPipelineService.js:195`).

  The mapping, for approval (QUESTION 9):

| Opportunity type (`Opportunity.js:20–23` comment) | Deal type |
|---|---|
| `modeling`, `runway`, `casting_call` | `paid_appearance` |
| `editorial`, `campaign` | `paid_deliverables` |
| `brand_deal` | `appearance_plus_deliverables` |
| `ambassador` | `brand_partnership` |
| `podcast`, `interview`, `panel` | `performance_booking` |
| `award_show` | `invited_comped` |
| `pr_gifting` | `gifted` |

- **The pay:** the opportunity's `payment_amount` becomes the deal's terms,
  by `payment_type` (`Opportunity.js:56`):
  - `flat_fee` → `appearance_fee` (or split evenly across deliverable fees
    for a deliverables-only type);
  - `per_post` → each deliverable's `fee`;
  - `retainer` → deliverable fees plus `bonus_terms` from pricing;
  - `trade` → `gifted_value`;
  - `unpaid` → nothing.
- **`is_paid: false` stays** in `compensationFromOpportunity` (ETS:111–115)
  for legacy semantics. A deal event does not read it.
- **`scheduleOpportunityAsEvent` gains `opportunity_id`** on its insert. It
  is missing today (§1.3).
- **The opportunity's `payment_status`** (`Opportunity.js:57`) stays a
  pipeline label. The Money tab and the pipeline can show "paid" derived from
  the deal's posted rows. The status route writes no ledger row
  (QUESTION 10).

---

## 7. Goal completion and stats (the question T3 and T8 left open)

**Today** (`computeSocialTaskBonuses`, ECS:35–76):
- completion rate ≥ 80% → reputation +1; < 30% (with more than 3 tasks) →
  −1 (`:54–55`);
- every required task done → influence +1; completion rate ≥ 90% →
  influence +1 more (`:58–59`);
- stress follows required tasks only, which since T8 means deliverables only
  (`:62–63`).

**The rate counts every task,** including optional ideas. So skipping ideas
the Career Checklist suggested can cost reputation.

| Option | What moves stats | Consequence |
|---|---|---|
| **A. Keep today's rule** | Completion rate over all tasks | Unchanged. Optional ideas count, so skipping them costs reputation. |
| **B. Goals and deliverables only** | The rate over goals and deliverables; optional ideas never count | Lala's own intentions and her obligations shape reputation and influence; ideas are free to skip. The smallest change. |
| **C. Deliverables only** | Approved deliverables move reputation and influence; goals move nothing | Consistent with T8's "canonical obligation" test. Goals become story texture only. |
| **D. No task-driven stats** | Nothing from tasks; stats come from evaluation and deliverable approval | Simplest to reason about. It drops a feedback loop Evoni may want. |

**Recommendation: B,** with stress unchanged (T8). QUESTION 13.

---

## 8. Migrations and PR order — PROPOSED

**Every migration:**
- is new, under `src/migrations/`;
- is guarded: `describeTable` before `addColumn`, `showAllTables` before
  `createTable`, `IF NOT EXISTS` on indexes;
- has `deleted_at` on every new table;
- has a `down` that removes only what it added.

Evoni runs each one before the restart that needs it (the §7.1 path).

| # | Migration | Down |
|---|---|---|
| M-1 | `world_events`: `deal_type` STRING(30), `appearance_fee` INTEGER, `bonus_terms` JSONB, `gifted_value` INTEGER, `pricing_version` INTEGER (all nullable) | remove the five columns |
| M-2 | `event_deliverables.fee` INTEGER nullable | remove the column |
| M-3 | `deal_pricing`, `deal_pricing_modifiers` (empty; Evoni supplies the numbers, QUESTION 4) | drop both tables |
| M-4 | `event_costs` | drop the table |
| M-5 | the partial unique index on `financial_transactions (category, source_id)` for `appearance_fee`, `content_fee`, `deal_bonus` | drop the index |

**PRs,** one each, stopping before each push:
1. **Schema:** M-1 to M-5, with model fields and `isIn`. No behaviour
   changes: `deal_type` is null everywhere.
2. **Deal type on the event:**
   - the auto-draft rule (§2.2);
   - the Event Package field, labelled per rule 14;
   - the lock additions.
3. **Pricing:** `proposeTerms`, "Propose terms" in the Event Package, and the
   admin pricing page.
4. **Itemised costs:**
   - the `event_costs` editor;
   - Finalize charging them for deal events;
   - `EVENT_EXTRAS` as drafted rows;
   - the "Difficulty" label for `cost_coins`.
5. **Payouts:**
   - the appearance fee and deal bonus at Complete;
   - the content fee on deliverable approval;
   - each in the D1/D2 transaction pattern, with integration tests for
     retry and idempotency;
   - legacy events proven unchanged.
6. **Money tab Phase B:** planned, pending and posted, from the terms
   snapshot and the statuses.
7. **Opportunity events (D10):** the mapping, and `opportunity_id` on
   `scheduleOpportunityAsEvent`.

**Then the goal-stat rule, per QUESTION 13.**

PR 1 carries the only migrations. PRs 2–7 need no further schema.

---

## 9. What stays as it is

- **Every legacy event** (`deal_type` null) keeps finalize and Complete as
  today:
  - `is_paid` / `payment_amount`;
  - the 10% `content_revenue`;
  - `tier_paid_bonus` with its raw-cost gate;
  - `cost_coins` as the entry charge;
  - `styling_extras`.
- **`tier_reward`** stays for every event (QUESTION 12).
- **Deliverable advancement stays manual** (D6).
- **Brand trust stays one number** (D11).
- **No coins come from ticking a task** (T3).

---

## 10. Open questions for Evoni

| # | Question | Recommendation |
|---|---|---|
| 1 | What counts as **attendance** for the appearance fee: Start Episode, or Complete accepted? | **Complete accepted.** It is when the event has happened in canon, and it is already one transaction (ECS:377). |
| 2 | Is the deal type drafted by a **fixed rule** or by the AI? | **A fixed rule** (§2.2). Money should not depend on a model's guess; the AI can still suggest. |
| 3 | Is pricing **global** or **per show**? | **Global** now; a per-show override later if a second show needs its own economy. |
| 4 | Who supplies the **first pricing numbers**? | **Evoni**, as a table pasted into the PR 3 task. Until then, "Propose terms" leaves fields empty. No invented numbers are seeded. |
| 5 | Can a **host** owe a content fee (a deliverable with `owed_to` host and a `fee`)? | **Yes.** The payer is `owed_to`; a host commissioning content pays for it. |
| 6 | Is **delayed payment** (a receivable paid days later in story time) wanted? | **Not now.** Pending is derived (§4.1). A receivables table can come later without changing the posted rows. |
| 7 | Is **`cost_coins` renamed** now or kept as difficulty? | **Kept** as difficulty for deal events, relabelled in the UI. A rename touches about 20 readers and is its own task. |
| 8 | Is the legacy **`tier_paid_bonus` raw-cost gate** (ECS:365) fixed to match the forecast? | **No,** under D8. If Evoni wants it fixed, it is a separate one-line PR with a test. |
| 9 | Is the **opportunity type → deal type mapping** (§6) approved? | **Yes as drafted,** with `brand_deal` → `appearance_plus_deliverables`. |
| 10 | Does the opportunity's **`payment_status`** follow the ledger? | **Derived for display,** no writes. The ledger stays the only money record (D1). |
| 11 | Where does **gifted value** live? | **On the event** (`gifted_value`) as a planned, never-paid term. The gifted item's own value belongs to the wardrobe economy (Law 10). |
| 12 | Does **`tier_reward`** (150/75/25/−25) stay beside the deal bonus? | **Yes.** It is Lala's career reward for how the episode went; the deal bonus is the counterparty's. |
| 13 | **Goal completion and stats:** option A, B, C or D (§7)? | **B:** goals and deliverables count, and optional ideas never do. |
| 14 | Do **fees lock** at Start Episode with the other terms? | **Yes:** `deal_type`, `appearance_fee`, `bonus_terms`, `gifted_value`, deliverable `fee` and `event_costs` join the terms lock. |
| 15 | Is a **rights/usage** term a restriction or its own kind? | **Its own modifier kind** in pricing (`rights`), stored as a restriction entry `{type: 'usage_rights', description}` on the event, so there is still one home per term (§8(t) item 1). |
| 16 | Does the stale **`social_task_reward` reader** in `shows.js:518` go? | **Yes,** in PR 5. Since #2265 no row has that category, so it always reads 0. |

### 10.1 Evoni's answers (2026-09-29)

These are recorded verbatim in `docs/EVENT_EPISODE_FLOW.md` §8(cc).

| # | Answer |
|---|---|
| 1, 2, 3, 5, 6, 7, 9, 10, 11, 14, 15, 16 | "take the recommendations as written" |
| 8 | "done by #2313" (PR #2315): Complete's paid-bonus gate uses the normalised entry cost |
| 4 | Five Career Rate Anchors; the starting anchors and premiums are in §8(cc). "Rates are baselines, not fixed payouts." |
| 12 | **Changed.** "A SLAY does not automatically create Prime Coins. A performance bonus is paid only when the accepted deal explicitly contains one … The generic tier reward (+150/+75/+25/−25) is retired for all completions from this ruling on." |
| 13 | "B, with aggregation … Deliverables contribute to an episode/event outcome rather than granting a stat point independently for every completed task." |

---

## 11. What the answers change (PROPOSED, following §10.1)

### 11.1 Pricing (Q4) replaces §3's table

**The anchor table replaces `deal_pricing` and `deal_pricing_modifiers`.**
- **`deal_rate_anchors`** has one row per component × career tier:
  - `id`, `version`, `component`, `career_tier` (1–5), `amount` (INTEGER,
    null where there is no anchor);
  - `created_at`, `updated_at`, `deleted_at`.
- **Components:** `paid_appearance`, `reel`, `stories_3`,
  `brand_partnership_base` and `performance_booking`.
- **Version 1 holds Evoni's starting anchors,** Emerging → Elite:

| Component | 1 | 2 | 3 | 4 | 5 |
|---|---|---|---|---|---|
| `paid_appearance` | 150 | 250 | 450 | 650 | 900 |
| `reel` | 75 | 125 | 225 | 325 | 450 |
| `stories_3` | 35 | 60 | 110 | 160 | 225 |
| `brand_partnership_base` | — (null) | 500 | 900 | 1,300 | 1,800 |
| `performance_booking` | 100 | 200 | 400 | 600 | 850 |

- **`deal_rate_premiums`** has one row per premium:
  - `id`, `version`;
  - `kind`: `rush`, `usage`, `exclusivity` or `paid_ad`;
  - `key`: `48h`, `24h`, `30d`, `90d`, `7d` …;
  - `percent` (DECIMAL, null when not set);
  - `created_at`, `updated_at`, `deleted_at`.
- **Version 1 holds Evoni's premiums:**
  - rush: 48h +10%, 24h +20%;
  - usage: 30d +15%, 90d +25%;
  - exclusivity: 7d +10%, 30d +25%, 90d +40%;
  - `paid_ad` / whitelisting: "a separate premium", with no percent given, so
    it is stored with `percent` null and shown as "set before use".
- **Assembling a proposal** ("Rates are baselines, not fixed payouts"):
  - each component of the deal takes its anchor for the event's tier;
  - a premium applies **only to the component it affects**, for example a
    rush on the reel raises the reel, not the appearance;
  - the result is written onto the deal (§3.2), and Evoni edits any number
    before the lock.
- **No prestige multiplier:** Q4 names none, so there is none.
- **An anchor that is null** (Brand partnership at Emerging) means the
  component is not offered at that tier, and "Propose terms" says so.
- **No cash income from self-funded, comped or gifted deals** (Q4):
  - they take no anchors;
  - their value is recorded separately: comped costs in `event_costs` with
    `paid_by` host or brand, and gifted value in `gifted_value`.
- **Travel is reimbursement, not income** (Q4): an `event_costs` row with
  `kind 'travel'` and `paid_by` host or brand, never an income row.
- **Seeding:** because Evoni supplied the numbers, PR 1 seeds version 1 in
  its migration. The insert is guarded to run only when version 1 has no
  rows.

### 11.2 Bonus and tier reward (Q12) change §4

- **The deal bonus exists only when the accepted deal contains one**
  (`bonus_terms` set on the event).
  - "Propose terms" never adds a bonus on its own.
  - SLAY (or the tier the deal names) triggers the contractual bonus at
    Complete.
- **The generic tier reward is retired** for all completions (Evoni: "no
  episode has been completed, so no balance has included it"). In the payout
  PR (§8 PR 5):
  - Complete stops writing `tier_reward` rows;
  - the same table is removed from `evaluationFormula.computeStatDeltas`'
    coin preview and from the forecast's `tierBonuses`;
  - the paid bonus (`tier_paid_bonus`) goes with it. **RULED** (Evoni,
    2026-09-29): "tier_paid_bonus retires too (Q12)."
  - the event reward (`event_reward`, Complete's booking of an event's
    `rewards.coins` on SLAY or PASS, ECS:437) goes with it. **RULED**
    (Evoni, 2026-09-29): "event_reward retires with the tier reward (Law 8:
    money only from accepted terms; legacy events keep payment_amount)."
- **QUESTION 12 is answered;** §10's recommendation for it no longer
  applies.

### 11.3 Goals and stats (Q13) change §7

- **B with aggregation:**
  - only canonical career goals and accepted deliverables count;
  - optional ideas never do;
  - the result is one outcome per episode, not a stat point per completed
    task.
- `computeSocialTaskBonuses` (ECS:35–76) already aggregates by completion
  rate. The change is that its rate is taken over goals and deliverables
  only.
- It is built after the payouts (§8), as planned.

### 11.4 PR 1, the schema, as it now stands

- **M-1, M-2, M-4 and M-5** are as in §8.
- **M-3 is replaced by** `deal_rate_anchors` and `deal_rate_premiums`, with
  version 1 seeded from §11.1. Its `down` drops both tables.

---

## What this note does not do

- It changes no code, and writes no migration and no test.
- It runs no query against any shared database.
- It rules nothing. §10 holds the decisions, with recommendations only.
- It edits nothing under `docs/audit/`.
- It makes no host, AWS, database or Cognito contact.
