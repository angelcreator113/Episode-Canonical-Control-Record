# Season Arc: what the code does today

A read-only trace, 2026-10-01, at `origin/main` `9df565d0`, against Evoni's
Season Arc rulings A1–A8 (`docs/EVENT_EPISODE_FLOW.md` §8(ff)). No fixes.
Every claim is **MEASURED** (the code, cited by function, route or
component name, with its line at `9df565d0` where it helps) unless marked
**INFERRED**. No production data was read.

No earlier Season Arc read exists in the repository: no file, and no branch
carrying one, at this basis. This read replaces nothing.

## Short answer

- **What exists.** One `show_arcs` row per show, seeded by hand ("Seed
  Season 1"). It holds three phases as JSON: Foundation 1–8, Ascension
  9–16, Legacy 17–24. Each phase is phase-level only: title, tagline,
  emotional arc, feed tone, goal summary.
- **No slots.** No table or JSON holds a per-episode slot, an intention or
  a planned outcome. The nearest thing, `EpisodeBrief`, is keyed to an
  episode that already exists, so it cannot plan a future slot.
- **The season never moves on its own.** Accepting an episode does not
  touch `show_arcs`. `checkPhaseTransition` is never called. Phases advance
  only from the Season Arc page's buttons.
- **Season context reaches only the Feed.** `getArcContext` is called by
  the feed services and its own `/arc/context` route, nothing else. Start Episode stores no season
  context; the Overview's "Season Position" is a count of episodes; the
  script writer's season query names columns that do not exist.
- **Next-event suggestions** use Lala's stats, the ledger balance and the
  previous episode's chain. They read no goals, no season phase and no
  history of formats, and nothing penalises repetition.
- **Season money.** Nothing on the Season Arc page shows money. The
  Episode Ledger sub-tab reads income and expenses from the ledger, but
  still shows each event's `cost_coins`.

## 1. The Season Arc page today

`WorldAdmin.jsx` → Episodes tab → sub-tab `season` "Season Arc" →
`SeasonTab` (`:7192`).

- **Loads:** `GET /api/v1/world/:showId/arc`, `GET
  /api/v1/world/:showId/goals?status=active`, and `GET
  /api/v1/season-rhythm/season-health/:showId`.
- **No arc:** a card, "No Season Set Up Yet", and **Seed Season 1**
  (`POST /arc/seed`).
- **With an arc:**
  - A header, hardcoded "Season 1: <title>", with the emotional
    temperature and "Ep <current_episode> / <episode_end>".
  - Four counts: episodes done (accepted or published), goals hit,
    narrative debt, current phase.
  - One card per phase, with its goals (those whose `episode_range` starts
    inside the phase).
  - Phase Controls: Advance (`POST /arc/advance`, which may answer with a
    warning, then `/arc/advance/confirm`) and Extend (`POST /arc/extend`,
    `extend_by: 2`).
  - Narrative debt and the progression log.
- **Not on the page:** episode slots, events, intentions, money.
- **Auto-Reorder is gone** (#2369, §8 "Later (Evoni, 2026-09-30)").

**Extend conflicts with A2.** `/arc/extend` adds episodes to the current
phase and shifts every later phase, so a season grows past 24
(`arcRoutes.js`, the extend handler, `:169`).

## 2. Where the season is stored

`show_arcs` (migration `20260723000003-create-show-arcs`, model
`ShowArc`): `arc_number`, `title`, `tagline`, `description`,
`season_number`, `episode_start`, `episode_end`, `phases` (JSONB),
`current_phase`, `current_episode`, `status`, `narrative_debt` (JSONB),
`progression_log` (JSONB), `emotional_temperature`, `icon`, `color`, and
timestamps with `deleted_at`. One row per (show, arc number).

- `seedArc` (`arcProgressionService.js:43`) writes arc 1 only: "Soft
  Luxury Ascension", season 1, episodes 1–24.
- `PUT /arc/phase/:phase` edits a phase's tagline, emotional arc and feed
  behaviour, nothing else.

**The 3 × 8 structure is written in three places**, kept in step by hand:
- `seedArc`'s phases;
- `seasonRhythmValidator`'s `ARC_SIZE = 8` (`:20`), with the season-health
  route's own arc names, "The Rise", "The Pressure" and "The Legacy Move";
- the career-goal seed's `episode_range` values (`careerGoals.js`, the seed
  route).

**Episodes and events carry no slot.**
- `Episode.season_number` exists, nullable, and nothing sets it at Start
  Episode.
- `episode_number` is assigned at Start Episode as the show's highest live
  number + 1 (`episodeGeneratorService.generateEpisodeFromEvent`,
  `:341-351`). INFERRED: numbering runs across the whole show and does not
  reset per season.
- An event has no episode number before an episode starts. It carries
  `season_id` and `arc_id`, plain UUIDs with no foreign key.

**The closest per-episode intention: `EpisodeBrief`.** "Pre-production
creative intent per episode", keyed by a unique `episode_id`. It holds
`arc_number`, `position_in_arc`, an archetype, `narrative_purpose`,
`designed_intent` (slay/pass/safe/fail), `allowed_outcomes`,
`forward_hook`, `lala_state_snapshot`, `season_id` and `arc_id`.
- Start Episode fills the archetype, intent, purpose, hook and
  `season_id`/`arc_id` (copied from the event), but **not** `arc_number`
  or `position_in_arc`.
- `arc_number` and `position_in_arc` are edited by hand in
  `ScenePlannerPage`.

## 3. Start Episode, the Overview and the script (A5)

- **Start Episode:** `EventPackagePage`'s `handleStartEpisode` → `POST
  /world/:showId/events/:eventId/generate-episode` →
  `generateEpisodeFromEvent`. `Episode.create` (`:509-522`) sets show,
  title, description, teaser, `episode_number`, status, categories and
  zero money. **No season, phase or slot is snapshotted.**
- **Overview:** `EpisodeOverviewTab`'s "Season Position" card shows
  "Episode N of T", where T is the number of the show's episodes returned
  by `GET /api/v1/episodes?limit=100`. It reads no season, phase or arc.
- **Scripts.** Three generators:
  - The grounded script (`groundedScriptGeneratorService`) puts the
    brief's `arc_number` and `position_in_arc` in its prompt. They are "?"
    unless set by hand.
  - The script writer (`episodeScriptWriterService.loadScriptContext`,
    step 13, `:315-324`) queries `SELECT name, current_phase, phase_title,
    emotional_temperature FROM show_arcs`. **`show_arcs` has no `name` and
    no `phase_title` column**, so the query fails; the empty `catch {}`
    swallows it and the "SEASON ARC" prompt block never has data. INFERRED
    (not run): this has always been null.
  - The script skeleton (`scriptSkeletonGenerator`) uses event data only.
- **`getArcContext`** says it is "Used by script writer, feed generator,
  and event pipeline". Besides its own route, `GET /arc/context`, it is
  called only by `feedScheduler`, `feedEventPipelineService` and
  `feedPostGeneratorService`.

```
$ git grep -n "getArcContext(" -- src | grep -v arcProgressionService
src/routes/arcRoutes.js:125:    const context = await getArcContext(req.params.showId, models);
src/services/feedEventPipelineService.js:183:      const arc = await getArcContext(showId, { sequelize: require('../models').sequelize });
src/services/feedEventPipelineService.js:703:    const arc = await getArcContext(showId, { sequelize });
src/services/feedPostGeneratorService.js:148:    const arc = await getArcContext(showId, { sequelize: models.sequelize });
src/services/feedScheduler.js:344:        const arc = await getArcContext(showId, { sequelize: db.sequelize });
```

## 4. Next-event suggestions and the Event Package (A4)

`GET /world/:showId/events/next-suggestions?from_episode_id=`
(`worldEvents.js:4672`), a fixed rubric, no AI. It opens as "What's next"
(`NextEventSuggestionsOverlay`) once an episode is accepted, and on demand.

- **Reads:** reputation, brand trust, influence and stress from
  `character_state`; the balance from the ledger (`getCurrentBalance`);
  the previous brief's `narrative_chain.seeds_future_events` and the
  previous event's host brand.
- **Candidates:** up to 50 unused draft or ready events, in no set order.
- **Scores:** unaffordable −50; a paid event when coins are low; low
  strictness when stress is high; a direct chain +30; a seed match +18;
  prestige near reputation; the same host brand **+8**; a locked career
  tier −20. Top five returned.
- **Does not read:** goals, narrative debt, the season or phase, past event
  types or formats, people or places used. The only repetition guard is
  "not already used"; the same-brand bonus rewards repeating a brand.

A second suggester, `GET /world/:showId/suggest-events`
(`careerGoals.js:563`), scores events against goals and still reads
`cost_coins` (`:657`).

**The Event Package** (`EventPackagePage`) shows no season, phase or slot.

## 5. Accepting an episode (A6)

Both accept routes, `POST /episodes/:id/accept` (`evaluation.js`, used by
`EvaluateEpisode`) and `POST /world/:showId/episodes/:episodeId/complete`
(`worldEvents.js:4474`, used by World Admin), run
`episodeCompletionService.completeEpisode` (`:199`).

- **In one transaction:** the ledger rows and payouts, the coin cache from
  the ledger, mood and stats, a `character_state_history` row, the
  episode's evaluation fields and status, and the event to `filmed`.
- **After it, best effort:** franchise knowledge; career goals; the linked
  opportunity; host and guest state and new opportunities.
- **Career goals:** only on slay or pass, and only when the brief's
  `career_context.success_unlock` is set, **every active goal gets +1**,
  whatever it measures (`:625-675`). INFERRED: +1 means nothing for "Save
  2,000 coins". `POST /goals/sync` sets goals from `character_state`, by
  hand only; for coins it reads the cached `character_state.coins`.
- **Not written:** anything in `show_arcs`. No `current_episode`, no phase
  check, no narrative debt.

```
$ grep -c "show_arcs\|narrative_debt\|checkPhaseTransition" src/services/episodeCompletionService.js
0
$ git grep -n "checkPhaseTransition" -- src frontend/src
src/services/arcProgressionService.js:142:async function checkPhaseTransition(showId, episodeNumber, models) {
src/services/arcProgressionService.js:486:  checkPhaseTransition,
```

- **Narrative debt** is written only by `advancePhase` (manual Advance):
  each goal still active at the boundary is set to `failed` and becomes a
  debt entry with a fixed sentence per metric (`buildNarrativeWeight`).
  The writes are not in a transaction.
- **Story threads.** The only thread table, `story_threads`
  (`StoryThread`), is the novel's: keyed by book and chapter. Lala's show
  has no story-thread model.
- `show_arcs.current_episode` is written only by `advancePhase` and
  `completeArc` (from the manual routes) and by `checkPhaseTransition`
  (never called). INFERRED: on a show that never advanced by hand it stays
  null, and the header reads "Ep 0 / 24".

## 6. Locks and reordering (A7)

- No slots exist, so nothing can be reordered or locked.
- The event-level lock exists: an event that has started an episode cannot
  be re-linked (§8(x) D4); one live episode per event
  (`generateEpisodeFromEvent`'s guard).

## 7. Pressure, results and money (A8)

- **Season health** (`GET /season-rhythm/season-health/:showId`) measures
  outcome-tier rhythm only: per 8-episode arc, the slay/pass/safe/fail mix
  of accepted episodes against a fixed target (1/4/2/1), as a score and a
  grade. No money, no planned pressure, no formats.
- `validateRhythm` accepts a proposed intent per request and stores
  nothing.
- **The ledger** is `financial_transactions`, raw SQL in
  `financialTransactionService` (no model). `getCurrentBalance` sums the
  counted rows; `character_state.coins` is its cache (§8(x) D1).
- **Episode Ledger sub-tab:** income and expenses per episode from `GET
  /shows/:showId/financial-summary` (ledger-based). Each row's event is
  matched by its name appearing in the script, not by a link, and the
  expanded row shows the event's `cost_coins` ("🪙 N", or "Difficulty N"
  for a deal).
- **`cost_coins` still read as money** elsewhere: `financialPressureService`
  (affordability), `paidFreeFlags` (legacy events), `eventCostsService`
  (the drafted entry cost), the shows route's "cover the next 3 events"
  goal suggestion, and `suggest-events`. None of these is on the Season
  Arc page today.
