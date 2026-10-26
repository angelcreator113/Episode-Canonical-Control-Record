# My Little List ♡

Lala's own list on her phone. It replaces how the Shopping List / To-Do overlay is shown to the player. Rulings: Evoni, 2026-10-26 (redesign brief, then the Phase 1 rulings).

**Phase 1** (this doc) is the reader, the knowledge rules, the safe wording and the API. Nothing on screen calls it yet.
**Phase 2** is the phone screen. **Phase 3** is AI-written wording that Evoni approves.

## It is a view, not a task engine

| Item | Comes from | Done when | Ticked by hand |
|---|---|---|---|
| One wardrobe item | `episode_todo_lists.tasks` | She has put the pieces on by that line (`scriptWear.wornByBeat`, the rule `getTodoList` uses) | No |
| One deal item | The event's `event_deliverables` | The script's `[DELIVER]` lines have delivered them (`scriptTodo.deliveredAt`); approval and payment stay in Money | No |
| A goal or idea | `social_tasks` without a deliverable | As stored, and not before the beat a Script tab tick names | Yes, through `social_tasks` |
| Her reminders | `episode_todo_lists.personal_list.reminders` | She ticks them | Yes |

Her reminders live outside `social_tasks`, so no score, stat, deliverable or payout reads them.

The deal is **one** item:
- From `deal_discovered` it reads like "Look into that video offer". This consideration reminder is not required and is not scored.
- From `deal_accepted` it reads like "Film my video".

The wording changes; the item doesn't.

## What she knows (`src/utils/lalaKnowledge.js`)

States: `invitation_received`, `deal_discovered`, `deal_accepted`, `opportunity_discovered <id>`, `opportunity_accepted <id>`.

Each state has one source. The first of these that applies wins:
1. **A game action.** The `[UI:DISPLAY|OPEN|SHOW …]` line that shows the invitation or the offer letter.
2. **An earlier episode.** An opportunity offered in one is known from the start, and accepted from the start once it is booked or further along.
3. **`[LEARNS: <state> [id]]`** on its own line, for a discovery no game action records.
4. **The beat**, for compatibility:
   - the invitation at the start of beat 5;
   - the offer at the end of beat 5;
   - yes to the deal at the start of beat 7, when the terms are locked to this episode.

   Opportunities have no beat default.

Rules that hold throughout:
- Knowledge works to the line, so it can change within a beat.
- Accepting implies knowing.
- A state none of these sources gives is not known, and an item that depends on it stays hidden.
- `[LEARNS]` lines that do nothing go to the review's `issues` and to the Script tab's health check (`scriptMoments.learnsCueFlags`). That covers an unknown state, an opportunity with no record, a deal on an event that has none, and a state a game action already gives.

`[LEARNS]` is a cue, never a line. The backend parser, `scriptRuntime` (no screen time), `scriptImport` (an app tag) and the teleprompter (any tag left out) all skip it.

## Wording and spoilers (`src/services/myLittleListService.js`, `src/utils/spoilerTerms.js`)

- **Words come from approved wording or fixed wording.** Approved wording lives in `personal_list.words[<item ref>]`. Fixed wording is chosen by the kind of task and never built from a label, a name or a plot note ("Meet some interesting people", "Find something to wear", "Film my video"). A goal that no fixed wording fits is hidden and flagged `needs_wording`.
- **Spoiler check.** Wording that names, or paraphrases, something she hasn't learned hides the item and flags it `spoiler`. That covers the event before the invitation, and an opportunity before she discovers it.
- **Duplicates.** Two items with the same wording: the second is flagged `duplicate_wording`.
- **Counts** are of the items she sees.

## API (`src/routes/myLittleListRoutes.js`)

Every route needs a login (`requireAuth`), under `/api/v1/episodes/:episodeId/my-little-list`:
- `GET ?beat=&line=` returns `{ app, items: [{ key, title, note, done, can_check, can_edit, can_remove }], progress }`. With no beat it reads as of the start of the episode.
- `GET /review` is **the producer's view**: hidden items with their production labels and the reason. Never for the phone.
- `POST /items` adds her reminder: `{ title, note?, reveal?: { when, ref? } }`.
- `PATCH /items/:key` takes `{ title?, note?, done?, beat?, line? }`.
  - Words go to the item's wording; a task's label is never overwritten.
  - `done` works on her reminders, goals and ideas.
  - The wardrobe and the deal answer 403 `COMPLETION_FROM_GAMEPLAY`.
- `DELETE /items/:key` removes her reminders only.

The `key` is `mll_` plus a hash of the episode and the item. A key she can't see at that position is a 404, the same answer as a key that doesn't exist.

## The migration

`20261026170000-add-personal-list-to-episode-todo-lists` adds `personal_list JSONB NOT NULL DEFAULT '{}'`.

**Until it has run** (`hasPersonalList`):
- The list reads without the column, so it has no reminders and no approved wording.
- Every write answers 503 `PERSONAL_LIST_MIGRATION_PENDING`.

Both behaviours are tested in `tests/unit/services/myLittleListService.test.js`.

## Tests

- `tests/unit/utils/lalaKnowledge.test.js`
- `tests/unit/utils/spoilerTerms.test.js`
- `tests/unit/services/myLittleListService.test.js`: Episode 1 A/B/C, leaks, paraphrases, permissions, before the migration.
- `tests/unit/routes/myLittleListRoutes.test.js`
- `frontend/src/lib/learnsCue.test.js`
- `tests/integration/myLittleList.integration.test.js`: Postgres, migration applied.
- Fixture: `tests/fixtures/myLittleListEpisode1.js`.
