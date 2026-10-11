# Read: what is true at each beat

- **Basis:** `origin/main` at `2fb9f45738380436a1020a81f1c86b1560b679e9` (all `path:line` below are at this SHA)
- **Date:** 2026-10-11
- **Task:** #2882 (SC3)
- **Question:** the Script tab's "True at beat N" card would show six values: coins, stress, what Lala is wearing, where she is, who is in the room, and story time. Where would each come from, can it be known per beat or only per episode, and what is missing? Building it waits on Evoni's decision.
- No host, AWS, database, or Cognito contact.
- Changes no code.

Markers: **MEASURED** means a `path:line` read at the basis SHA. **INFERRED** means a conclusion drawn from measured code, with the reason given.

Real data only (Evoni, 2026-10-10): the card shows the episode's own values or an honest empty state. Every source below is a real one; where none exists, it says so.

---

## §1 Each value: where it lives today

| Card value | Where it lives today | Per beat or per episode | Notes |
|---|---|---|---|
| **Coins** | Lala's ledger balance: `GET /api/v1/world/:showId/balance` (`src/routes/worldEvents.js:4904`, requireAuth). It returns `getCurrentBalance` (`src/services/financialTransactionService.js:53`): the sum of income/reward rows minus expense/deduction rows in `financial_transactions` (`:57-64`). The episode header reads the same route (`frontend/src/pages/EpisodeDetail.jsx:65`, `:142`). **MEASURED** | **Per episode today.** The ledger is the balance now, not the balance at a beat. **INFERRED** from the query, which has no beat or time filter (`:57-64`). | The script carries per-beat coin changes as `[STAT: coins +X]` tags. The writer is asked for them (`src/services/episodeScriptWriterService.js:773`; `src/services/groundedScriptGeneratorService.js:352`), and the server parser reads them per beat into `beat.tags.stats` (`src/utils/scriptBeatParser.js:303-305`, `:359`). **MEASURED.** Those tags are story beats; no code adds them to the ledger. **INFERRED**: the only reader found writes them into a summary string (`scriptBeatParser.js:550-551`). |
| **Stress** | `character_state.stress` (`src/models/CharacterState.js:29`, default 0). It is written when an episode is completed: `episodeCompletionService` adds the deltas from tasks, the outfit and money (`src/services/episodeCompletionService.js:61-63`, `:102-114`, `:433-462`) and saves them (`:488`). **MEASURED** | **Per episode.** Stress changes only at completion, all at once. **INFERRED** from the single write at `:488`. | No per-beat stress exists. A `[STAT: stress +1]` tag would be read by the parser's general `(\w+)` key (`scriptBeatParser.js:303`), but neither writer prompt asks for one. **MEASURED** (the regex) and **INFERRED** (from the prompts quoted above). |
| **What Lala is wearing** | The look locked on the Wardrobe tab: `GET /api/v1/wardrobe/outfit/:episode_id` (`src/routes/wardrobe.js:312`). The saved look the style sheet and Finalize read: `episodeLook` (`src/services/episodeLookCharges.js:140`), locked, else chosen, else the event's `outfit_pieces`. **MEASURED** | **Per episode**, with one beat boundary. The script's closet beat is where she gets dressed: `closetBeat` in `frontend/src/lib/scriptMoments.js:275`, from the beat with `[UI:OPEN Closet…]`, else canonical beat 8 (`src/constants/canonicalBeats.js:212`). **MEASURED.** Before that beat she is not yet in the look; from it on she is. **INFERRED** from the canonical description of beat 8 ("Outfit is chosen", `canonicalBeats.js:211`). | What she wears before the closet beat is not recorded anywhere. The card should say "Getting dressed at Beat n" before that beat, not invent an outfit. |
| **Where** | The scene plan, one row per beat: `scene_plans` (`src/models/ScenePlan.js:45`), `beat_number` (`:14`) and `scene_set_id` (`:16`), unique per episode and beat (`:53`). It is read by `GET /api/v1/episode-brief/:episodeId/plan` (`src/routes/episodeBriefRoutes.js:139`), which joins the scene set's `name` (`:151-157`). The Script tab already maps that to `scene_set_name` per beat. **MEASURED** | **Per beat.** **MEASURED** (the unique key on episode and beat). | A beat with no plan row has no place: show "No scene set", as the SC1 chip does. |
| **Who is in the room** | Two real sources. (1) **Who speaks in the beat**, from the script's dialogue lines: the Script tab's `parseLine` reads `Speaker: line` (`frontend/src/components/Episodes/EpisodeScriptTab.jsx:95`). SC1 (PR #2890) added `beatSpeakers` for this (`frontend/src/lib/scriptMoments.js`, after `closetBeat`). (2) **The event's guests**, `canon_consequences.automation.guest_profiles`, with `featured` marking the cast (`frontend/src/utils/episodePlanning.js:49-51`). **MEASURED** | (1) **Per beat.** (2) **Per episode.** **INFERRED**: the guest list belongs to the event, not to a beat. | Being in the room is not the same as speaking; no source says who is present but silent at a beat. The honest per-beat value is "Speaking: Prime, Lala"; the featured guests are an episode-level line. |
| **Story time** | The story clock (`src/services/storyClock.js`): story time is the episode number and a phase, `order = episode_number * 10 + phase` (`:24-35`). A beat is "During Ep n" (`beatOrder`, `:34`). The feed uses it to keep a post from appearing at a beat before it was written (`checkAtBeat`, `:68-73`; `src/services/feedMomentLink.js:32`, `:41`). **MEASURED** | **Per episode.** Every beat of an episode has the same story time ("During Ep n"). **INFERRED** from `beatOrder` taking only the episode number (`:34`). | Within an episode there is no clock. The event's date and time are free text (`storyClock.js:5-7`). "During Ep 1 · Thu, Nov 12, 6:30 PM" is the most the card can say truthfully, and the time is the event's, not the beat's. |

---

## §2 What can be known per beat

| Value | Per beat today? | Smallest honest source |
|---|---|---|
| Coins | No (the ledger is "now") | The balance **before the episode**, plus the running total of the script's `[STAT: coins …]` tags up to this beat. A pure frontend helper over `script_content`. |
| Stress | No | Episode-level only: `character_state.stress` as it stands. Per-beat stress would need `[STAT: stress …]` tags that the writer does not produce today. |
| Wearing | Half: before or after the closet beat | `closetBeat(script)` plus the locked outfit: "Getting dressed at Beat n" before, the locked pieces from that beat on. |
| Where | Yes | The scene plan row for the beat (`scene_set_name`). |
| Who is in the room | Yes (who speaks) | The beat's speakers from its lines; the featured guests as an episode-level line. |
| Story time | No (the same for every beat) | `storyClock` label "During Ep n", plus the event's free-text date and time. |

---

## §3 Build proposal

**A pure frontend helper, no migration, no new route.** **INFERRED**: every input is already loaded by the Script tab (the script, the scene plan, the locked outfit; SC1 adds the balance).

`beatState(beats, index, { balanceBefore, outfit, scenePlan, event, episodeNumber })` returns, for the beat at `index`:

1. **Coins:** `balanceBefore + Σ [STAT: coins ±n]` over beats `0..index`, with `{ value, fromScript: n }` so the card can say "420, +50 in the script so far". When there is no starting balance it shows "Coins not read".
2. **Stress:** the episode's `character_state.stress`, labelled "this episode" (not per beat). Hidden if Evoni prefers no episode-level values on a per-beat card.
3. **Wearing:** before `closetBeat(script)`: "Getting dressed at Beat n". From it on: the locked pieces' names. With no closet beat: the locked pieces, or "Not dressed yet".
4. **Where:** the plan row's `scene_set_name`, or "No scene set".
5. **In the room:** the beat's speakers, or "No one speaks yet"; then "Cast: …featured guests…" as a second line.
6. **Story time:** `During Ep n` from the episode number, plus the event's `event_date`/`event_time` text when set.

**The one open data question: the balance before the episode.** The ledger has no "as of the start of this episode" read. **INFERRED** from `getCurrentBalance` (`:57-64`), which has no cut-off. Two honest options:

- **(a) Use the balance now** and label it "Lala has n now; +x in the script by this beat". No new data. It is exact before the episode is completed and double-counts after it.
- **(b) The balance before the episode:** the current balance minus this episode's posted ledger rows. This is a read-only query on `financial_transactions` for the episode's rows. It needs a small new read (a service function, plus a field on an existing route or a new GET), but **no migration**: the ledger already has `financial_transactions.episode_id` with an index (`src/migrations/20260724000002-create-financial-transactions.js:16`, `:58`). **MEASURED.** Rows written by the Wardrobe purchase and lock carry it, since both send `episode_id` (`frontend/src/components/EpisodeWardrobeGameplay.jsx`, `purchaseItem` and `lockOutfit`). **MEASURED** (the request bodies); that every episode charge is written with it is **INFERRED**.

**No migration either way.** Per-beat stress is the only value with no source. Adding it would mean asking the writer for `[STAT: stress …]` tags, a prompt change, not a schema change.

---

## §4 Decisions for Evoni

1. **Coins:** (a) the balance now with the script's changes, or (b) the balance before the episode (a new read-only query, no migration)?
2. **Stress:** show the episode's stress on the per-beat card, labelled "this episode", or leave it off until the script carries per-beat stress?
3. **In the room:** is "who speaks in the beat" right, or should the featured guests count as in the room at every beat at the venue?
4. **Story time:** is "During Ep n" plus the event's date and time enough, or does she want a time per beat (which would need a new field)?
