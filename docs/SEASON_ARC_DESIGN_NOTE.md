# Season Arc: design note

2026-10-01, at `origin/main` `9df565d0`. A proposal for building Evoni's
rulings A1–A8 (`docs/EVENT_EPISODE_FLOW.md` §8(ff)), on top of what the
code does today (`docs/SEASON_ARC_READ.md`). **Nothing is built and
nothing here is ruled.** Where a choice is open it is a numbered question
in §3; the proposal states a default only so the questions have something
to answer.

## 1. The shape

**One new table, `season_slots`**: one row per (show, season, slot 1–24),
created when the season is seeded. A slot row holds:

- `phase` (1–3, from the slot number) and `state`, computed on read
  (A2): **done** (its episode accepted), **in production** (episode
  started), **event ready** (an event assigned and ready), **needs an
  event**.
- `event_id`, `episode_id` (nullable).
- The intention (A3): `story_purpose`, `career_focus`,
  `desired_pressure`, `story_thread_id`, `outcome_range`, and
  `intention_source` ("auto-drafted" / "edited"), shown as a label, the
  same way other drafts read "Auto-drafted" (doctrine rule 14).
- The result (A6, A8): `actual_outcome` (the tier), `actual_pressure`,
  and `accepted_at`.
- `locked_at` (A7), set at Start Episode.

`show_arcs` stays the season header (title, phases, narrative debt,
log). The slot rows replace nothing in it.

**One new table, `show_story_threads`** (A3, A6), since the only thread
table is the novel's (`story_threads`): title, status (open, advanced,
resolved), the slot that opened it and the slot that last moved it.

### How the rulings land

- **A1, A2: the page.** The Season Arc sub-tab becomes the 24-slot
  roadmap: three phase bands, eight slot cards each, each card showing
  its state, its event or episode, and its intention's purpose. The
  current phase cards, goals, debt and log move below the roadmap.
- **A3: drafting intentions.** A Haiku side call, through
  `aiCostTracker`, drafts an intention for each empty future slot from
  the phase (`seedArc`'s emotional arc and feed tone), the accepted
  slots' outcomes, open threads, goals and debt. Drafts are labelled and
  editable; an edit is never overwritten by a redraft.
- **A4: suggestions and the Event Package.**
  - `next-suggestions` gains the next open slot's intention and the
    missing inputs: active goals, narrative debt, and the last few
    episodes' event types, formats, hosts and venues. A recent repeat is
    penalised; the same-brand bonus is reconsidered (Q8).
  - The Event Package gets a read-only **Season Context** block:
    season, phase, slot, purpose. Its facts stay its own.
- **A5: Start Episode.** `generateEpisodeFromEvent` locks the slot,
  sets `Episode.season_number`, and snapshots the slot's context (season,
  phase, slot, purpose, pressure, thread, outcome range) onto the
  episode's brief. The Overview's "Season Position" reads the snapshot
  instead of counting episodes. The script writer and the grounded
  script read the snapshot; the script writer's broken `show_arcs`
  query is replaced, not repaired.
- **A6: acceptance.** `completeEpisode`, after its transaction, records
  the slot's actual outcome; moves the slot's thread; updates goals by
  what they measure (Q11) instead of +1 each; calls
  `checkPhaseTransition`; and readies the next slot (its intention
  re-drafted if still auto-drafted). A failure here is logged and never
  undoes the acceptance, as with the steps already after the transaction.
- **A7: locks.** Reorder and re-plan act only on slots with no started
  episode. `/arc/extend` goes, or changes meaning (Q2).
- **A8: Planning Insights.** A view under Season Arc: per slot, planned
  pressure and outcome range beside the actual outcome and pressure; and
  season money (spend, income, balance trend) from
  `financial_transactions` by episode, as the Episode Ledger already does.
  No `cost_coins` anywhere in it.

### Suggested build order (one PR each)

1. `season_slots` migration and model; seeding fills 24 slots;
   backfill from existing episodes in `episode_number` order (Q4).
2. The roadmap view, read-only.
3. Start Episode locks and snapshots; Overview and scripts read it.
4. Acceptance updates the slot and calls `checkPhaseTransition`.
5. Intentions: drafting and editing.
6. Suggestions and the Event Package block.
7. Story threads.
8. Planning Insights.

## 2. Things the read found that the build has to settle

- `checkPhaseTransition` returns `auto_advance: true` but advances
  nothing; whatever calls it decides what happens (Q6).
- The 3 × 8 structure is written in three places (`seedArc`,
  `seasonRhythmValidator`'s `ARC_SIZE` with its own arc names, the
  goal seed). The slot table should be the one source.
- `episode_number` runs across the whole show and never resets (Q3).
- Goals' +1 on acceptance ignores what the goal measures; `/goals/sync`
  reads cached coins rather than the ledger.
- Narrative debt is written without a transaction.
- The Episode Ledger links an episode to its event by name-in-script and
  shows `cost_coins`.

## 3. Questions for Evoni

1. **Which season?** Is the existing "Soft Luxury Ascension" row Season
   1, with its 24 slots filled from the episodes already made? Or does
   the roadmap start fresh?
2. **Extend.** A2 fixes 24 slots, but the page's "Extend phase by 2"
   pushes the season past 24. Remove Extend, or keep it as "move the
   phase boundary" inside the 24?
3. **Episode numbers.** Should `episode_number` stay show-wide (Season 2
   starts at 25), or restart each season, with the slot number as the
   in-season position?
4. **Existing episodes.** If Season 1 is backfilled, are episodes placed
   in `episode_number` order? What happens to episodes beyond 24, or to a
   deleted one's gap?
5. **"Event ready" and assignment.** Does an event get assigned to a
   slot before Start Episode (planned on the roadmap), or does a slot
   only ever take the next event started? If assigned ahead, can one
   event sit in a slot while still a draft?
6. **Phase boundary.** When `checkPhaseTransition` finds the boundary
   reached on acceptance, should the phase advance at once, or should
   Season Arc ask you first (as manual Advance does when goals are
   unmet)?
7. **Pressure.** What is "desired pressure": a scale (low, medium, high),
   a number, or named kinds (money, social, time, reputation)? And what
   is the "actual" pressure Planning Insights compares it with: the
   outcome tier, the money result, stress change, or something you set
   at acceptance?
8. **Repetition.** What counts as a repeat for A4: the same event type,
   format, host, venue, or guest, within how many episodes? Should the
   same-brand bonus stay?
9. **Story threads.** Are threads new records you create and name, or
   drafted from the season (and from `seeds_future_events`)? Who closes
   one: you, or acceptance when the outcome says so?
10. **Outcome range.** Is it a range over the tiers (for example "pass to
    slay") that `designed_intent` and `allowed_outcomes` on the brief
    should then follow, or something separate?
11. **Career goals on acceptance.** Replace the +1-to-every-goal step
    with: each goal set from what it measures (coins from the ledger,
    reputation and others from Lala's stats after the episode)? Goals
    with no measure (custom) unchanged?
12. **Drafting cost.** Drafting intentions is an AI call. Draft all
    future slots at seeding and on each acceptance, or only the next
    slot plus on demand?
13. **Planning Insights' money.** Per slot, per phase, or both? Should
    the balance trend count only accepted episodes, or every ledger row
    (deals, purchases between episodes)?
14. **cost_coins elsewhere.** A8 rules the Season Arc's money only. The
    Episode Ledger's "🪙 cost_coins" tag and the "cover the next 3 events
    by cost_coins" goal suggestion are outside it. Leave them, or take
    them out in the same work?
15. **The season-health score.** Keep the outcome-rhythm grade
    (slay/pass/safe/fail against 1/4/2/1 per phase) on the page, fold it
    into Planning Insights, or drop it?
