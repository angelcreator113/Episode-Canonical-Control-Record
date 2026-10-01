# Episode Money, Phase B: design note

Evoni's rulings MB1–MB6 (2026-10-01) are recorded verbatim in
`docs/EVENT_EPISODE_FLOW.md` §8(gg). This note reads today's code against
them and asks what the build needs settled. **Nothing is built yet.** Code
is cited by function name; read at `origin/main` `8a23d8e1`.

Phase B is the second of M5's three phases (§8(aa)): "financial plan,
pending and receivables, itemised event budget". Phase A (Task #2278) and
event spending (§8(cc)) are built.

## 1. What exists today

**The Money tab** (`EpisodeMoneyTab`, Production → Money) reads
`GET /world/:showId/episodes/:episodeId/money` (`episodeMoneyService.getEpisodeMoney`).
It returns, and the tab shows:
- `balance`: Lala's actual balance (`getCurrentBalance`).
- `rows` and `net`: the episode's posted ledger rows (counted rows only,
  M6) and their sum.
- `expected`: lines from the source event's accepted terms
  (`expectedLines`), never summed:
  - event payment, entry cost;
  - each deal component paid at Complete (`completionPayouts(event, null)`);
  - each deliverable's content fee (`contentFeeFor`);
  - each terms cost Lala pays (`chargeableCosts`: `paid_by === 'lala'`;
    comped costs are left out).
- `spending`: the event spending lines (`episodeSpendingService`), with
  their total and whether they can still be edited.

There are no states. A line is either a posted row or an expected line,
in two separate lists, and nothing links one to the other.

**How each kind of line reaches the ledger.** Every posted row names its
source (Law 13), so a plan line can be matched to its posted row:

| Line | Trigger today | Ledger row: category, source | Payer / cover |
|---|---|---|---|
| Deal component (appearance, partnership base, performance) | Complete accepted (`bookCompletionPayouts`) | `appearance_fee` / `partnership_base_fee` / `performance_fee`, source `event` + event id | `metadata.payer` (`payerFor`: brand or host) |
| Deal bonus | Complete accepted, only for a tier its `bonus_terms` names | `deal_bonus`, source `event` + event id; `metadata.tier` | as appearance |
| Content fee | Deliverable approved (`bookContentFee`, from the deliverable status route) | `content_fee`, source `deliverable` + deliverable id | `metadata.owed_to` |
| Terms cost Lala pays | Complete (`finalizeEpisodeFinancials`) | `event_cost`, source `event_cost` + cost id | `paid_by: 'lala'`; comped costs (`host`/`brand`) are never charged |
| Entry cost (legacy and self-funded) | Complete | `event_entry`, source `event` + event id | Lala |
| Event spending line | Complete | `event_spending`, source `event_spending` + line id | Lala |
| Legacy event payment, content revenue, styling extras | Complete (Finalize) | `event_payment` / `content_revenue` / `styling_extras`, source `event` | payment and revenue from the host, extras by Lala (INFERRED; no payer recorded) |
| Wardrobe rental and purchase | Complete (Finalize) | `wardrobe_rental` / `wardrobe_purchase`, source `wardrobe` + piece id | Lala |

**Deliverable statuses** (`eventTermsService`): `pending → completed →
submitted → approved`. Only `approved` books the fee.

**Warnings and refusals today:**
- Start Episode stores `affordability_warning` on the brief
  (`episodeGeneratorService.affordabilityWarningFor`). It compares the
  event's `cost_coins` with `character_state.coins`, the cached copy, not
  the ledger. It ignores itemised terms costs and spending, and never
  blocks.
- Finalize run alone refuses (`InsufficientCoinsError`) when its rows take
  Lala below zero.
- `completeEpisode` refuses a completion that spends and ends below zero
  (step 12a). MB4 keeps both refusals.

**Other surfaces:**
- The episode header chip is the actual balance from `/balance`. It opens
  Money, and MB3 keeps it.
- The Overview (`EpisodeOverviewTab`) lists the episode's ledger rows from
  `/financial-ledger?episode_id=`. It has no Money card yet (MB5).

## 2. What the rulings need that the code lacks

1. **A line list with states (MB1, MB2).** One list in place of the two:
   each terms line, possible bonus and spending line, with its trigger,
   payer or cover, amount and state. The state is derived, not stored:
   - **Posted** when a counted row matches the line's category and source;
   - **Pending** when its trigger is reached and no row exists;
   - **Planned** otherwise.
2. **Projection (MB3):**
   - projected net = posted + pending + planned;
   - projected balance = actual balance + this episode's pending and
     planned.

   The ledger and the balance are untouched (M2).
3. **Early warnings (MB4)** on the Money tab, at Start Episode and at
   Complete, from the ledger balance and the full plan, not `cost_coins`
   and the cached coins.
4. **An Overview Money card (MB5)** from the same endpoint.
5. **Reconciliation (MB6).** After Complete, compare planned with posted
   per line. This needs to know what was planned (question 7).

Recommended: one service builds the line list for the tab, the card, the
warnings and the reconciliation, so they cannot disagree. It extends
`getEpisodeMoney` and reuses `completionPayouts`, `contentFeeFor` and
`chargeableCosts` as they are.

## 3. Questions for Evoni

Each has a recommendation; nothing is ruled until she answers.

1. **Which lines are in scope?**
   - MB1 names deal payouts, deliverable fees, the bonus, terms costs and
     event spending. Today Complete also posts the entry cost, a legacy
     event's payment, content revenue and styling extras, and wardrobe
     rentals and purchases.
   - *Recommendation:* include the entry cost and the legacy terms lines
     (they come from accepted terms); leave wardrobe to Phase C
     (M5: "wardrobe-driven projections").
   - A posted row with no plan line (wardrobe, a milestone) is listed as
     "Posted, not planned".
2. **Matching a line to its posted row.**
   - *Recommendation:* by ledger category and source (the table in §1):
     a component or bonus by `event` + event id plus its category; a
     content fee by deliverable id; a terms cost by cost id; a spending
     line by line id.
   - No new column is needed.
3. **The bonus in the projection.**
   - A bonus pays only at the tier reached ("if SLAY"), unknown until
     Complete. Today's expected lines leave it out.
   - *Recommendation:*
     - list every tier the deal names as its own Planned line ("if SLAY",
       "if PASS");
     - count in the projected net only the tier the brief's
       `designed_intent` names (Season Arc Q10), or none when the brief
       has none;
     - after Complete, the unearned tiers show as "not earned".
4. **When is a line Pending?**
   - *Recommendation:*
     - a content fee is Pending when its deliverable is `submitted`, and
       Planned while `pending` or `completed`;
     - Complete's lines (components, bonus, costs, spending) post in
       Complete's own transaction, so they go straight from Planned to
       Posted and are never Pending.
   - Is "completed but not submitted" Planned?
5. **Projected balance: this episode only?**
   - *Recommendation:* actual balance + this episode's pending and planned
     lines, not other open episodes'. Say so on the card: "after this
     episode".
6. **What does MB4 warn on?**
   - Spending happens at the event, before Complete's income posts.
   - *Recommendation:* warn when either goes below zero, showing the
     shortfall:
     - (a) the projected balance (MB3);
     - (b) the actual balance minus this episode's planned costs and
       spending, without its income ("if the income does not arrive").
   - "Event spending exceeds what Lala has" reads as (b) for spending
     alone.
   - Warnings never block; Complete's existing refusals stay.
   - Should Start Episode's `affordability_warning` move to this same
     check, using the ledger balance and the itemised plan, replacing the
     `cost_coins` comparison? *Recommendation:* yes.
7. **What does the reconciliation compare against?**
   - Terms lock at Start Episode but can be reopened. Spending stays
     editable until Complete, and each line keeps its drafted quantity and
     unit price.
   - *Recommendation:*
     - snapshot the line list at Start Episode, with amounts and states,
       on the episode, the way `season_context` is;
     - the reconciliation compares that snapshot with what posted, and
       marks a bonus not earned, a cost or spending line changed, added or
       removed, and a fee still pending;
     - a spending line also shows its change from its draft.
   - The other choice is comparing with the terms as they stand at
     Complete, which loses any change made through a reopen.
8. **Covered lines.**
   - MB2's "who pays or covers it": a comped terms cost (`paid_by` host
     or brand) is never charged and is left out today.
   - *Recommendation:* list it as "covered by <host/brand>" at 0 to Lala,
     outside the totals.
9. **Lines after Complete.**
   - A content fee approved after Complete posts later.
   - *Recommendation:* such lines stay Pending, the reconciliation
     counts them as outstanding, and the Overview card's "still planned
     or pending" includes them.
10. **The Overview card and the existing ledger list.**
    - *Recommendation:* the Money card (MB5) sits at the top of the
      Overview's money area and opens Production → Money.
    - The Overview's ledger list stays below it unchanged. The other
      choice is removing the list, since the Money tab has the rows.

## 4. Suggested build order (one PR each)

1. The line list with states and the projection: the service and the Money
   tab (MB1–MB3).
2. Early warnings on the Money tab, Start Episode and Complete (MB4),
   including the Start Episode warning's move to the ledger.
3. The Overview Money card (MB5).
4. The Start Episode plan snapshot and the reconciliation view (MB6).
