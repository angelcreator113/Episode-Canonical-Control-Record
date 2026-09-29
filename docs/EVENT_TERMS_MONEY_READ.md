# Event terms, deals and the money path — a read, not a ruling

## Status of this document

**Read-only research** for the event deal rework (Task #2223). It recommends
nothing and rules nothing. It covers:
- the four kinds of event term and the Start Episode lock;
- `EventDeliverable`;
- the money path (`is_paid`, `payment_amount`, `cost_coins`);
- the career inputs a deal proposal could use;
- existing code that proposes terms or pay;
- where the audit register already touches this path.

It changes no code, runs no query and writes no migration. No database was
queried, and no host, AWS, database or Cognito contact was made.

Every claim is marked one of two ways:
- **MEASURED**: read from this repository, with a file:line.
- **CANNOT-TELL**: the repository does not settle it.

Where a finding comes from reading the code's structure rather than from
running it, it says so.

Basis for the file:line citations: `origin/main` at
`06b645644c913a3c321d65c9176a2565b90f3e83` (2026-09-29, #2222). Each citation
is paired with a function, route or component name, which outlasts the line
number.

Abbreviations: **FTS** = `src/services/financialTransactionService.js`,
**ECS** = `src/services/episodeCompletionService.js`, **ETS** =
`src/services/eventTermsService.js`.

---

## 1. Terms — MEASURED

### 1.1 The four kinds of term

The set is fixed in three places, and they agree:
- the header of `src/migrations/20260924000000-add-event-terms.js` (`:8–13`);
- `ETS:8–11`;
- `frontend/src/utils/eventTerms.js:5–8`.

`buildTermsSnapshot` (`ETS:168`) keys them `access_requirements`,
`deliverables`, `restrictions` and `compensation` (`:174–184`).

`cost_coins` is **not** a term. It is a scoring field (`WorldEvent.js:169`),
and it is not in the snapshot.

| Term | Storage | UI | Client validation | Server validation |
|---|---|---|---|---|
| **Access requirements** | `world_events.requirements` JSONB, default `{}` (`WorldEvent.js:271`); added by `20260219000004-world-events-career-fields.js:34`. Shape: `*_min` integers (`reputation_min`, `brand_trust_min`, `coins_min`; model comment `:267–268`). | `EventTermsSection` "Access requirements" (`EventTermsSection.jsx:222`, inputs `:240–243`; note at `:246`: "Checked by the next-event suggester; not a gate on Start Episode"). Older editor in `WorldAdmin.jsx:2674–2676`. | `buildRequirementsUpdate` (`eventTerms.js:102–118`): whole number ≥ 0, 0 or empty removes the key, unknown stored keys are kept. | **None on shape.** The event PUT lists `requirements` only in `jsonFields` (`worldEvents.js:721`) and stringifies it (`:781–782`); any JSON is accepted. |
| **Compensation** | `world_events.is_paid` BOOLEAN default false (`WorldEvent.js:257`); `payment_amount` INTEGER default 0 (`:262`); added by `20260219000004…:20,27`. | `EventTermsSection` "Compensation" (`:431`, save `:463`). WorldAdmin paid select `:2384`, "Payment (if paid)" `:2392`, modal `:3742–3760`. | `buildCompensationUpdate` (`eventTerms.js:175–194`): a paid event needs an integer > 0; setting unpaid keeps the stored amount. | `payment_amount` is in `integerFields` (`worldEvents.js:705`); a non-finite value returns 400 and the value is truncated (`:757–766`). **`is_paid` is in no type set** (`:703–723`), so any value reaches SQL. |
| **Restrictions** | `world_events.restrictions` JSONB default `[]`, entries `{ type, description }`; added by `20260924000000…:29–33`; model `WorldEvent.js:280`. | `EventTermsSection` "Restrictions" (`:388`, remove `:398–400`, add `:409–419`). | `buildRestrictionAdd` (`eventTerms.js:135–140`): non-empty, ≤ 2000 characters, type always `'other'`. | `normalizeRestrictions` (`ETS:196–212`), called by the event PUT (`worldEvents.js:773–779`, 400 on error). |
| **Deliverables** | Table `event_deliverables` (§2). | `EventTermsSection` "Deliverables" (`:264`). Edit and remove show only when unlocked (`:316–321`); "advance" shows only when locked (`:279`). | `buildDeliverableBody` (`eventTerms.js:200–216`). | `readDeliverableBody` (`src/routes/eventDeliverables.js:78–101`); status and timestamps are refused on edit (`:175–182`). |

When an event comes from an opportunity, the conversion helpers carry its
terms over:
- `deliverablesFromOpportunity` (`ETS:69`);
- `restrictionsFromOpportunity` (`:91`), which writes one `exclusivity` entry;
- `compensationFromOpportunity` (`:107`), which **always sets `is_paid:
  false`** (`:110`).

The comment at `ETS:102–105` records why: whether opportunity events pay out is
"the money slice's decision".

### 1.2 How the next-event suggesters read access requirements

There are two suggesters. **Only one of them reads `requirements`.**

**`GET /world/:showId/events/next-suggestions`** (`worldEvents.js:4375`)
- Used by `NextEventSuggestionsOverlay` (`NextEventSuggestionsOverlay.jsx:38–39`).
- **It does not read `requirements` or `restrictions`.** Its `attributes` list
  (`:4430–4434`) leaves both out.
- Candidates are `status` draft or ready, `used_in_episode_id` null, and not
  deleted (`:4420–4426`).
- It scores on:
  - affordability: `cost_coins` against `character_state.coins` (`:4444–4447`);
  - a paid bonus, when `is_paid && payment_amount > 0` (`:4452–4466`);
  - prestige against reputation (`:4493–4494`);
  - career tier: `min(5, floor(reputation/2)+1)` (`:4394`), with −20 when the
    event's `career_tier` is higher (`:4504–4506`).

**`GET /world/:showId/suggest-events`** (`src/routes/careerGoals.js:563`)
- Used by WorldAdmin (`WorldAdmin.jsx:1377`).
- **It reads `requirements`** (`:615–622`):
  - `reputation_min`, `brand_trust_min` and `coins_min` are each compared with
    `character_state`.
  - Any unmet key costs 5 points and adds "requirements not met".
  - The event is still returned, with `requirements_met` (`:654`). **It is a
    score, not a gate.**
- It gates on tier in SQL, `career_tier IS NULL OR career_tier <= :careerTier`
  (`:593–595`, tier from `getAccessibleCareerTier`).
- That query filters only `status IN ('draft','ready')`. It has **no
  `used_in_episode_id IS NULL` and no `deleted_at IS NULL`**.
- `JSON.parse` of `requirements` (`:615`) is not wrapped in its own try.

`frontend/src/utils/eventTerms.js:22–24` and `WorldAdmin.jsx:144–149` both
name `suggest-events` as "the next-event suggester". The Start Episode path
does not read `requirements`.

A third function, `suggestNextEvents` (`src/services/feedEventPipelineService.js:620`),
suggests from opportunities, goals and arcs. It does not read
`world_events.requirements`.

### 1.3 The lock at Start Episode

**No lock is stored.** It is derived from `world_events.used_in_episode_id`,
as `docs/EPISODE_PRODUCTION_READ.md` §1.3 records.

That document's line numbers have drifted at this basis:
- the UI prop is `EventPackagePage.jsx:1190` (`locked={used}`), and
  `used = !!event.used_in_episode_id` is at `:377`;
- the event PUT allowlist is `worldEvents.js:662–698`.

**Every route that writes a term field or source-event linkage, and whether it
honours the lock** (for §8(w) P9 of `docs/EVENT_EPISODE_FLOW.md`):

| Route | Term / linkage fields it writes | Lock check |
|---|---|---|
| PUT `/world/:showId/events/:eventId` (`worldEvents.js:627`) | allowlist `:662–698`: `cost_coins`, `is_paid`, `payment_amount`, `requirements`, `restrictions`, **and `used_in_episode_id`** (set or cleared; UUID-string check only, `:709`, `:785–791`) | **None.** Nothing in the handler reads `used_in_episode_id` to refuse. The optional stale-version check (`:646–659`) is not a lock. |
| same PUT, core-only retry (`:937–945`) | `coreFields` (`:895–904`): `cost_coins`, `is_paid`, `payment_amount` | None |
| POST `…/events/:eventId/inject` (`:1014`) | `used_in_episode_id`, status `'used'`, `times_used + 1` (`:1085`, fallback `:1090`) | **None.** It overwrites an existing link. WorldAdmin uses it to reassign (`WorldAdmin.jsx:934`, `:1041`). |
| POST `…/events/:eventId/generate-episode` (`:2132`) → `generateEpisodeFromEvent` | `stampEventUsed` (`episodeGeneratorService.js:413–421`, `:726`); brief `event_id` and `event_metadata.terms` (`:648–651`, `:705`); deliverables `episode_id` (`:734`) | Live-episode guard `findLiveLinkedEpisode` (`:449`, conflict `:454–455`, 409 at `worldEvents.js:2214–2216`) |
| POST `…/events/generate-episode-from-many` (`:2233`) | anchor: through the generator (`:2273`); extras: `used_in_episode_id` UPDATE (`:2287`) | anchor: the generator guard; extras are skipped when already linked (`:2281–2283`) |
| POST `…/events/:eventId/regenerate-episode` (`:2347`) | through the generator with `replacingEpisodeId` (`:2385`) | bypasses the guard for its own episode, by design (`episodeGeneratorService.js:454`) |
| POST `/world/:showId/episodes/:episodeId/generate-title-overlay` (`:3867`) | clears `used_in_episode_id` where it points at a missing episode (`:3885–3888`) | None; the catch at `:3889` does not log |
| POST / PUT / DELETE `…/deliverables` (`eventDeliverables.js:130`, `:169`, `:217`) | deliverable rows | **Yes:** 409 `EVENT_TERMS_LOCKED` (`:141`, `:193`, `:225`) |
| POST `…/deliverables/:id/status` (`eventDeliverables.js:249`) | status and one timestamp | Inverse: allowed **only** after Start (`:275–281`) |
| PUT `/api/v1/episode-brief/:episodeId` (`src/routes/episodeBriefRoutes.js:46`) | allowlist includes **`event_id`** (`:57–61`) | No `used_in_episode_id` check; it refuses only when `brief.status === 'locked'` (`:53–55`) |

New-row writers are not affected by the lock. They are:
- POST `/world/:showId/events` (`worldEvents.js:416`);
- bulk-seed (`:1266`);
- `scheduleOpportunityAsEvent` (`feedEventPipelineService.js:382`);
- `convertOpportunityToEvent` (`careerPipelineService.js:195`).

**Client side:**
- The lock is enforced only in `EventTermsSection`: `locked` guards at
  `:90`, `:98`, `:141` and `:163`, and controls are hidden when locked.
- Other clients write the same fields through the unlocked event PUT:
  - WorldAdmin's editor and modal send `cost_coins`, `is_paid` and
    `payment_amount` (`WorldAdmin.jsx:693`, `:3495–3504`, `:3846`).
  - `EpisodeOverviewTab.jsx` sets `used_in_episode_id` (`:236`) and clears it
    (`:252`).

**CANNOT-TELL:** whether production already holds events whose terms were
edited after Start. That needs a query.

---

## 2. `EventDeliverable` — MEASURED

### 2.1 Model and table

`src/models/EventDeliverable.js`: the table is `event_deliverables`,
paranoid, underscored (`:45–51`).

| Column | Definition |
|---|---|
| `id` | UUID |
| `event_id` | UUID, not null |
| `description` | TEXT, not null |
| `deliverable_type` | STRING(50) |
| `due_date` | STRING(50), a story date |
| `required` | BOOLEAN, default true |
| `status` | STRING(20), default `'pending'`, `isIn` the four statuses (`:33–39`) |
| `completed_at`, `submitted_at`, `approved_at` | DATE |
| `episode_id` | UUID, nullable (`:43`) |

- **Associations:** `belongsTo` WorldEvent and Episode (`:55–56`).
- **Migration:** `20260924000000-add-event-terms.js:40–92`.
  - `event_id` has `onDelete: 'CASCADE'` (`:51`); `episode_id` has
    `onDelete: 'SET NULL'` (`:86`).
  - Two indexes (`:94–99`).
- **Registration:** `src/models/index.js` (`:413`, associations `:832–833`).
- **Mount:** `src/app.js:815–821`.
- **Status is a plain string, not a database enum.** Every write is raw SQL,
  so the model's `isIn` check never runs. The route's transition check is the
  only guard.

### 2.2 Lifecycle: pending → completed → submitted → approved

The flow is `DELIVERABLE_STATUS_FLOW` (`ETS:35`), mirrored at
`frontend/src/utils/eventTerms.js:229`. There is no rejected, cancelled or
overdue state.

**Every forward move goes through one route:**
- **Route:** POST `/world/:showId/events/:eventId/deliverables/:deliverableId/status`
  (`eventDeliverables.js:249`).
- **Auth:** `requireAuth` only, with no admin check. The event is scoped to
  its show (`loadEvent`, `:57–63`).
- **Checks:**
  - a status outside the flow → 400 (`:255`);
  - neither the event nor the row linked to an episode → 409
    `DELIVERABLE_NOT_STARTED` (`:275`);
  - `validateDeliverableTransition` (`ETS:229–256`) refuses unknown, unchanged,
    backward and skipped moves.
- **Write:** a compare-and-set UPDATE (`AND status = :from`) that stamps the
  matching `*_at` column (`:290–295`; mapping at `ETS:36–40`). No row updated
  → 409 (`:296–301`).
- **Not checked:** whether the linked episode is live, completed or published.
- **Who moves it: a person, manually.** The advance button is in
  `EventTermsSection` (`advanceDeliverable`, `:119–135`; button `:304–308`).
  It always sends the next status and is hidden at `approved`.
- **Automatic transitions: none.** Only two things write `status`:
  - the `'pending'` insert (`ETS:127`, `eventDeliverables.js:146`);
  - the status route (`:291`).

  The comments at `eventDeliverables.js:23–24` and `ETS:23–24` state that
  completing an episode never moves a deliverable.

**Row creation:**
- `insertEventDeliverables` (`ETS:118–135`), called from:
  - `scheduleOpportunityAsEvent` (`feedEventPipelineService.js:595`);
  - `convertOpportunityToEvent` (`careerPipelineService.js:272`).

  Neither caller passes a transaction.
- The manual add route (`eventDeliverables.js:130`).

### 2.3 How rows are stamped to the episode

**The only writer is `stampDeliverablesEpisode` (`ETS:155–162`):**
- It sets `episode_id` on every live row of the event.
- It takes no transaction and applies no status filter.

**It is called by `generateEpisodeFromEvent`** (`episodeGeneratorService.js:731–737`):
- The call comes **after the generation transaction commits**.
- A failure is only logged ("non-blocking", `:736`).

**Before the transaction**, the generator also reads the event's
deliverables (`:616`) and snapshots their current status into
`episode_briefs.event_metadata.terms` (`:620`, `:705`). The comment at
`:703–704` says completion readers still read the event, not the snapshot.

**Per path:**
- **generate-episode:** the event's rows are stamped.
- **generate-episode-from-many:**
  - Only the anchor's rows are stamped.
  - Extra events are linked by a bare UPDATE (`worldEvents.js:2286–2288`), so
    **their deliverables keep `episode_id` null**.
  - Their terms still lock, and their status route opens through
    `event.used_in_episode_id`.
- **regenerate-episode:**
  - The rows are re-stamped to the new episode.
  - **Status and the `*_at` timestamps are not reset.**
  - If the post-commit stamp fails, the rows keep pointing at the soft-deleted
    old episode. `SET NULL` fires only on a hard delete.
- **inject:** does not touch `event_deliverables`. `episode_id` stays null and
  no snapshot is written.

**Deletes:** a hard delete of an event, for example bulk-delete's
`DELETE FROM world_events` (`worldEvents.js:2415`), cascades to its rows.

### 2.4 Deliverables and money or career stats

**None found.** Nothing in `src/` or `frontend/src` reads deliverable status
for pay, penalties or stats. The writers are only `ETS` and
`routes/eventDeliverables.js`, and the readers are only the generator and that
route.

---

## 3. Money — MEASURED

### 3.1 The two balances

- **The ledger: `financial_transactions`.**
  - Created by migration `20260724000002`; it has **no Sequelize model**, so
    all access is raw SQL.
  - Types: income, expense, reward, deduction.
  - `status` defaults to `'executed'`.
  - It has plain indexes only, **no unique constraint** (`:57–61`).
  - `getCurrentBalance` (`FTS:59–99`) sums income and rewards minus expenses
    and deductions. With no rows it returns the starting balance. If the query
    fails, it falls back to the latest `character_state_history`, then to the
    starting balance.
- **The state row: `character_state.coins`.**
  - Model `CharacterState.js:22`, default 500.
  - Migration `20260218100000-evaluation-system.js:36`.
  - It sits beside `character_state_history` (same migration, `:92`, no model).

**Who reads which:**
- **The ledger:** `GET /world/:showId/balance` (`worldEvents.js:4280`), the
  financial ledger (`:4260`), affordability (`:2779`), financial-pressure
  (`:2828`), the financial forecast (`:3056`), and the `shows.js` financial
  config and summary (`:417`, `:576`).
- **`character_state.coins`:**
  - `GET /characters/:key/state` (`evaluation.js:189`);
  - next-suggestions (`worldEvents.js:4444`);
  - `generateEpisodeFromEvent` (`episodeGeneratorService.js:484`);
  - every wardrobe spend guard;
  - completion's negative-balance guard.

**CANNOT-TELL: which is the balance of record for gameplay.** No code or doc
names one. The register's §66.3-F ruling moved two handlers to
`getCurrentBalance` (§6).

### 3.2 `is_paid`, `payment_amount`, `cost_coins`: readers and writers

**Model and migrations:**

| Field | Definition | Migration |
|---|---|---|
| `cost_coins` | INTEGER, not null, default 100 (`WorldEvent.js:169`) | `20260219000003-world-events.js:61` |
| `is_paid` | BOOLEAN, default false (`:257`) | `20260219000004-world-events-career-fields.js:19–31` |
| `payment_amount` | INTEGER, default 0 (`:262`) | `20260219000004-world-events-career-fields.js:19–31` |

**`is_free` is not a column.** It is in no model or migration:
- WorldAdmin's form sets it (`WorldAdmin.jsx:646`, `:3744`), and the event
  PUT's allowlist drops it.
- The financial forecast's query falls back when it errors
  (`worldEvents.js:2915–2925`).

**Writers:**

| Kind | Where |
|---|---|
| Routes | event POST (`worldEvents.js:416`; defaults `:421`, `:431`); event PUT (`:627`); bulk-seed (`:1287–1299`, `:1322–1323`); from-profile, `cost_coins` only (`:2628`, `:2663`, `:2714`); the AI generator, `cost_coins` only (`eventGeneratorRoute.js:104`, `:126`) |
| Services | `careerPipelineService.js:221–222` (through `compensationFromOpportunity`); `feedEventPipelineService.js:542` (`cost_coins` on a prestige ladder: 500 / 300 / 150 / 50) and `:566–567`; `eventAutomationService.js:729`, `:777`, `:802`, `:821`, `:830` (`cost_coins`) |
| Frontend | `WorldAdmin.jsx` (`:634`, `:645–647`, `:2384–2392`, `:3742–3760`, ai-fix `:1082`); `EventTermsSection.jsx:443–454`; `QuickEpisodeCreator.jsx:327`, `:345–346` (`is_paid: false`) |

**Readers that move money:**
- `normalizePaidFreeFlags` (`FTS:308–314`), which feeds finalize (§3.3).
- `completeEpisode`'s event context (`ECS:289`, `cost: parseFloat(event.cost_coins)`).

**Readers that don't move money:**
- `checkAffordability` (`financialPressureService.js:26`) uses raw
  `cost_coins`, whatever `is_paid` says.
- `episodeGeneratorService.js:296–297` counts `payment_amount` as income with
  no `is_paid` check. It is stored only in
  `episode_todo_lists.financial_summary`.
- Scripts, overlays, prompts and distribution:
  - `episodeScriptWriterService.js:138–140`
  - `todoListService.js:620`
  - `invitationCompositingService.js:278–283`, which compares string values
    `'yes'` and `'free'`
  - `uiOverlayService.js:153–154`
  - `distributionService.js:88`, `:151`
- The suggesters (§1.2).

**Tests:** no test exercises an `is_paid = true` payout. `grep -rn
event_payment tests` returns nothing.

### 3.3 When Lala is paid or charged

**1. Finalize** — `finalizeEpisodeFinancials` (`FTS:333`).

It is reached from:
- POST `/world/:showId/episodes/:episodeId/finalize-financials`
  (`worldEvents.js:4238`), WorldAdmin's "Finalize Financials" button;
- completion (event 2 below).

How it finds the event and guards against repeats:
- **Event:** `SELECT * FROM world_events WHERE used_in_episode_id = :episodeId
  LIMIT 1` (`FTS:360`), with no ORDER BY. Completion picks the
  highest-prestige event instead (`src/services/outfitScoreContext.js:21–22`).
- **Repeat guard:** it counts executed ledger rows with this `episode_id`
  (`FTS:335–341`). Any row counts as "already finalized". This is
  check-then-act with no constraint behind it.

Ledger rows, written through `logTransaction` (`FTS:248`):

| Row | Written when | Where |
|---|---|---|
| `event_entry` expense | `cost_coins`, when the event is neither paid nor free | `FTS:417` |
| `wardrobe_rental` / `wardrobe_purchase` | from `event.outfit_pieces`; a purchase when `!piece.is_owned` | `FTS:426–447` |
| `styling_extras` | drinks + valet + **photo booth** | `FTS:450–470` |
| `event_payment` income | only `isPaid && eventPayment > 0` | `FTS:473` |
| `content_revenue` | 10% of the payment on `brand_deal` | `FTS:482–490` |
| `social_task_reward` | per completed social task | `FTS:495–503` |

The photo booth is charged when:
- the format or event type is gala, premiere, launch or brand deal;
- or the dress code contains "red carpet" or "photo".

It costs `30 + prestige × 15` at prestige 4 or more
(`src/utils/financialRates.js:40`).

Other writes:
- `episodes.total_income`, `total_expenses` and `financial_score` (`FTS:521`);
- a `character_state_history` row (`:536`);
- milestone `reward` rows and `shows.metadata`, through `checkMilestones`
  (`:200–235`, called at `:569`);
- feed posts (`:575–588`).

What it does not do:
- **It does not write `character_state.coins`.**
- **Transaction: none.** Without an outer transaction, `logTransaction`
  swallows its own error and returns null (`FTS:277–280`).

**2. Complete** — `completeEpisode` (`ECS:192`).

It is reached from:
- POST `…/episodes/:episodeId/complete` (`worldEvents.js:4207`);
- the deprecated POST `/api/v1/episodes/:id/accept` (`evaluation.js:524`).

Evaluate (`evaluation.js:242`) moves no money.

In order:
1. The guard returns early if `evaluation_status === 'accepted'` (`ECS:202`).
2. It may seed `character_state` with 500 coins (`:244`).
3. A dry-run finalize throws `InsufficientCoinsError` if `coins + delta < 0`
   (`:362–366`).
4. The real finalize (`:369`).
5. Raw ledger INSERTs:
   - `tier_reward`: slay +150, pass +75, safe +25, fail −25 (`:348`, `:375`);
   - `tier_paid_bonus`: slay 50, pass 25, **gated on raw `cost_coins > 0`**
     (`:350`, `:391`);
   - `event_reward`, from `rewards.coins` (`:406–410`).

   Each INSERT sits in a try/catch that swallows errors.
6. `changeCoins` updates `character_state` (`:477`,
   `src/services/coinBalanceGuard.js:65–67`). The update is conditional: it
   never takes the balance below zero.
7. A history row (`:493`).
8. `evaluation_status = 'accepted'` (`:519`).
9. The event status becomes `'filmed'` (`:537`).

**Transaction: none across these steps** (`grep "transaction(" ECS` returns
nothing). The only repeat guard is `accepted`, which is set near the end.

**3. Wardrobe spends**, each in a `sequelize.transaction`:
- **`/wardrobe/select`** (`wardrobe.js:1377`, transaction `:1425`).
  - It spends `coin_cost` and writes a `wardrobe_purchase` row with no
    `episode_id`.
  - `is_owned` is set **outside** the transaction (`:1451`).
- **`/wardrobe/purchase`** (`:1680`, transaction `:1733`).
  - It returns early when the item is already owned (`:1697`).
  - `is_owned` is set outside the transaction (`:1760`).
- **`/wardrobe/lock-outfit-atomic`** (`:1534`, transaction `:1597`).
  - It writes one ledger row per purchase, **carrying `episode_id`** (`:1613`).

**4. Admin and seed:**
- **Manual state edit:** `/characters/:key/state/update` (`evaluation.js:568`,
  transaction `:643`). It writes the state row, a history row and a
  `manual_adjustment` ledger row.
- **Admin reset:** `/admin/reset-character-stats` (`evaluation.js:122`).
  - It sets coins to 500 (`:148`).
  - **The ledger is untouched.**
- **Seed balance:** `/shows/:id/seed-balance` (`shows.js:1191`), through
  `seedStartingBalance` (`FTS:108`).
  - It is check-then-insert.
  - The default is 1900 (`src/utils/financialRates.js:20`).

**Not charges:**
- decline (`worldEvents.js:2792`);
- an opportunity's `'paid'` status (`opportunityRoutes.js:185–194`).

No rent or shop charge exists.

### 3.4 Consequences visible from the code's structure (not run)

- **Wardrobe rows can block finalize:**
  - `lock-outfit-atomic` writes ledger rows carrying the episode's id.
  - Once it has bought anything for an episode, finalize's guard counts those
    rows and returns `already_finalized`.
  - The entry cost, extras, payment and social rewards are then not booked.
- **The two balances can diverge:**
  - A standalone Finalize never moves `character_state.coins`.
  - If it runs before Complete, Complete's coin delta excludes the finalize
    net, while the ledger already holds it.
- **Rows can double on retry:**
  - If Complete fails after finalize but before `accepted` is set, a retry
    finds `already_finalized`.
  - It then INSERTs the tier, bonus and reward rows again.

---

## 4. Career inputs a deal proposal could use — MEASURED

| Input | Where it lives | Writers |
|---|---|---|
| **Reputation, brand trust, influence** | `character_state.reputation` / `brand_trust` / `influence` (`CharacterState.js:23`, `:27`, `:28`; migration `20260218100000…:40`, `:45`, `:50`, each "0-10 scale"). One scalar each per show, season and character; no `deleted_at`. | Completion's `changeCoins` `extraSet` (`ECS:477`, `:481`; deltas from social tasks `:47`, `:51`, wardrobe brands `:84`, and underdressing at a prestige event `:102`); the manual edit (`evaluation.js:644`, clamped 0–10); the admin reset to 0 (`:148`); create-on-read (`:64`). |
| **Career tier (Lala's)** | **Not stored.** Derived from reputation: `getAccessibleCareerTier` (`careerPipelineService.js:362`) = `min(5, floor(rep/2)+1)`; duplicated inline at `worldEvents.js:4394`. Its catch returns tier 1 and does not log (`careerPipelineService.js:376`). | none (derived) |
| **Career tier (the event's)** | `world_events.career_tier` (`WorldEvent.js:285`; migration `20260219000004…:41`, "1=Emerging … 5=Elite") | event POST (default 1, `worldEvents.js:432`), PUT, bulk-seed (`:1325`) |
| **Prestige** | `world_events.prestige` 1–10, default 5 (`WorldEvent.js:163`); `opportunities.prestige` (`Opportunity.js:68`) | caller-chosen on POST, PUT and bulk-seed; follower-tier-derived on from-profile (`worldEvents.js:2459`); severity plus random on calendar spawn (`eventAutomationService.js:696`); `opp.prestige` or a default on opportunity conversion (`feedEventPipelineService.js:410`, `careerPipelineService.js:214`); from AI output in the generator (`eventGeneratorRoute.js:103`) |
| **Organizer / host** | `world_events.host` (`WorldEvent.js:72`), `host_brand` (`:77`), `source_profile_id` (`:160`); resolved by `eventCreatorOrganizer` (`src/utils/eventOrganizer.js:50`), which returns null for a brand-organized event | event create and edit routes; the host's `lala_relevance_score` (`SocialProfile.js:55`) rises by `min(1, prestige/10)` in `applyEventOutcome` (`characterSyncService.js:247`, `:269–270`), called from completion (`ECS:693`) |
| **Brand relationship** | **No per-brand trust or relationship table.** `brand_trust` is one scalar. Related: `social_profiles.brand_partnerships` JSONB (`SocialProfile.js:74`); `lalaverse_brands.partnership_status`, a free string (`LalaverseBrand.js:17`); `opportunities.brand_or_company` (`Opportunity.js:39`) | `partnership_status`: only POST `/brands` (`wardrobeBrands.js:206`) |

**Organizer and sponsor schema:**
- `docs/EVENT_EPISODE_FLOW.md` §8(r) (`:2003–2014`) records an organizer and
  sponsor schema "as intended and not built":
  - `organizer_type`, `organizer_profile_id`, `organizer_brand_id`;
  - `host_face_profile_id`, `sponsor_brand_id`.
- A grep of `src` for those names returns nothing.

**`opportunities.career_tier`:**
- It is added by `20260719000000-career-pipeline-links.js:25`.
- It is not declared on `Opportunity.js`.

---

## 5. Existing code that proposes terms or pay — MEASURED

**No AI prompt outputs payment, compensation, deliverables or requirements.**
- **Search:** a `grep` for those keys as output fields in `src/services` and
  `src/routes`, plus a scan of every file that calls `messages.create` or
  `messages.stream`.
- **Result:** the only match was `engagement_rate`
  (`feedScheduler.js:608`, `socialProfileRoutes.js:147`).

**What proposes pay or terms today, none of it AI:**
- **Opportunity templates:** `OPPORTUNITY_TEMPLATES`
  (`characterSyncService.js:315–331`).
  - Pay is a random value within a per-tier range, for example
    `ambassador: payment: [5000, 15000]` (`:319`).
  - Fail tiers produce nothing (`:330`).
  - `generatePostEventOpportunities` (`:369`) sets `payment_amount` (`:419`).
  - It runs from completion (`ECS:701`).
- **Default deliverables by opportunity type:** `opportunityRoutes.js:42–50`.
  - They are applied on POST `/opportunities/:showId` (`:96–97`).
  - `net_value = payment − expenses` is set there too (`:101`).
- **Opportunity → event conversion:** `ETS:69`, `:91`, `:107`, as in §1.1.
  - Compensation is always unpaid.

**AI that touches event economics without proposing pay:**
- **The 24-event generator:** POST `/api/v1/memories/generate-events`
  (`src/routes/eventGeneratorRoute.js:25`).
  - `MODELS = ['claude-sonnet-4-6']` (`:23`), `max_tokens: 8000` (`:62`).
  - It asks for `prestige` (`:219`), `cost_coins` 0–500 (`:220`) and
    `host_brand` (`:224`), with no pay, requirements or deliverables.
  - Its prompt mentions "a reputation gate" (`:64`), but no requirements field
    is requested or inserted.
- **ai-fix:** `worldEvents.js:1343`.
  - It suggests `change_cost` or `change_prestige` only (`:1422`).
  - It returns JSON and writes nothing (`:1452`).
- **Prompt readers:**
  - `todoListService.js:620` puts the payment into a Haiku prompt for tasks.
  - `eventConceptDraftService.js:384` drafts concept and styling, with no
    terms.

**Budget path:**
- `src/app.js:19` loads `aiCostTracker` before the routes.
- It patches `Messages.prototype.create` (`aiCostTracker.js:261`, `:295`) and
  gates on a daily budget (`:124`, 429 at `:310`).
- A direct `new Anthropic()` client is covered too.

---

## 6. Overlap with the register — cited, not ruled

- **§66.3-F, the `state_json` read** (`docs/audit/F-Stats-1_Fix_Plan_v1.63.md`).
  - The defect is ruled at `:67`, the fix shape (`getCurrentBalance`) at
    `:81`, and it is marked owed at `:128`.
  - `PROJECT_CONTEXT.md:493` records it **done and deployed** (PR #2079,
    Deploy BC).
  - A MEASURED check at this basis agrees: `grep -rn state_json src | grep -v
    state_after_json` returns nothing.
  - `PROJECT_CONTEXT.md:493` also records as still open which of
    financial-pressure's catches the ruling means.
- **Class 4, "parallel balance readers, none authoritative"** (priority at
  `F-Stats-1_Fix_Plan_v1.62.md:112`).
  - The reach probe `docs/audit/F-Stats-1_S355_ReachProbe_2026-09-27.md` §3
    has the reader table and the INFERRED finding that
    `character_state.coins` and the ledger can differ.
  - §3.1 and §3.4 here are the same ground, measured again at this basis.
  - The probe's open question, whether completion writes the ledger, is
    answered by `ECS:369`: it does, through finalize.
- **Cross-Keystone Register:** XK-1 to XK-4 (`Cross_Keystone_Register.md:50–53`).
  - None is about money as such.
  - XK-1 (`paranoid` with no `deleted_at`) names `character_state` among its
    reach tables.
  - XK-2 (row scope dropped at writes) cites `worldEvents.js` sites.
  - XK-3 and XK-4 are tenancy.
- **The event-difficulty decision:**
  `docs/audit/F-Stats-1_EventDifficulty_ProjectedVsCanonical_Decision_2026-09-24.md`
  §6 records that `cost_coins` is still derived from prestige on several paths
  and flows into evaluation. Settling cost is tied there to strictness and
  deadline type.
- **FD files:** none concerns money.
- **CANNOT-TELL:** whether opportunity events pay out. No register document
  rules it. The only statements are the code comment at `ETS:102–105` and
  `docs/EVENT_EPISODE_FLOW.md` §8(t) (`:2187`).

---

## What this document does not do

- It recommends nothing and rules nothing.
- It changes no code, doc or migration, and edits nothing under `docs/audit/`.
- It runs no query.
- It makes no host, AWS, database or Cognito contact.
