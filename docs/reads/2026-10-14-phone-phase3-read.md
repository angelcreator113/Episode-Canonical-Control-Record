# Lala's Phone phase 3 read: to-do modes

Date: 2026-10-14. Basis: `6b6ae038c4ae6f406d46879bb4e9cb37d9dd4afd` (origin/main). Read-only: no code, register, host, AWS, database or Cognito contact. Citations are `file:line` at that SHA. Each claim is **MEASURED** (read in code or migrations) or **INFERRED**.

This is Task #3122, the read for Lala's Phone spec §15 phase 3, **To-do modes** (`docs/design/2026-10-lalas-phone.md:93`). It covers the Shopping list crossing from Wardrobe, spent so far, the deal checklist, and the Career list. The spec sections are §5 (To-do modes), §7 item 2 (Getting ready) and §13 (the Shopping list stays her handwritten note).

## 1. Summary

1. **The data the modes need mostly exists. None of it carries a beat** (MEASURED).
   - Crossing off the Shopping list, deal ticks and Career goal status are all worked out from the episode's **current** state.
   - Equips, purchases and deliverables carry wall-clock times only.
   - The only within-episode order is the script itself: `## BEAT: n` headers and line positions.
2. **The script already says when a piece is picked** (MEASURED), in text cues the skeleton writes: `[UI:SELECT Item <name>]` then `[UI:CHECK ToDoList "<item>"]`. Nothing links those cues to wardrobe rows or ticks anything.
3. **The phone shows no Shopping list today** (MEASURED). Its `task_list` content type reads the social tasks (deals and goals), not the Shopping list. It ignores the beat and draws plain text, not her handwritten note.
4. **Recommended direction, no migration for the core:**
   - "From the beat" comes from the script: a wear cue linked to the piece.
   - Spent so far sums the worn pieces' look charges up to that line.
   - The phone gets one to-do content area that picks its mode (Shopping, deal, Career) by the beat.
   - Five decisions are listed in §6.

## 2. What exists

### 2.1 The Shopping list

- **Where it is stored** (MEASURED): `world_events.canon_consequences.documents.shopping_list`, as `{ status: draft|approved, version, items: [{ slot, label, description, required }], history }` (`src/services/eventDocumentsService.js:16-21`).
  - The workflow is draft (`:243-251`), edit (`:254-263`) and approve (`:289-307`, which draws its overlay, `:272-283`).
  - `shoppingListTasks` (`:331-341`) turns the lines into episode tasks.
- **How it becomes the episode's list** (MEASURED):
  - At Start Episode, the approved list is used, else five standard slots (`src/services/episodeGeneratorService.js:984-992`). It is written to `episode_todo_lists.tasks` (`:997-1018`); the table is `src/migrations/20260705000000-create-episode-todo-lists.js`, one row per episode.
  - "Use in episode" keeps any completed flags (`eventDocumentsService.js:375-427`; route `src/routes/todoListRoutes.js:65`).
- **How crossing off works today** (MEASURED):
  - `getTodoList` recomputes each wardrobe line's `completed` on every read, from the episode's live `episode_wardrobe` links (`src/services/todoListService.js:648-668`; `listSlotsFilled` `:88-93`, `taskFilled` `:100-103`, `listSlotOf` `:71-85`).
  - A manual toggle of a wardrobe line is refused with a 409 (`todoListRoutes.js:116-128`).
  - The styling game ticks from the slots on screen (`frontend/src/components/EpisodeWardrobeGameplay.jsx:377-393`).
  - **It is the look now, not as of a beat.**
- **Her handwritten note** (MEASURED):
  - The Event Package paper and its overlay are Caveat on lined pink paper with tape (`src/services/eventDocumentOverlayService.js:151-193`; `frontend/src/components/EventPackage/EventDocuments.jsx:41-63`).
  - Neither ticks a line: "she crosses lines off in the show" (`EventDocuments.jsx:38-40`; `eventDocumentOverlayService.js:171-173`).
  - The older episode overlay `renderTodoAsset` is a serif checkbox card (`todoListService.js:318-495`). Locking it places it on the first scene (`todoListRoutes.js:260-279`).

### 2.2 How an equip or purchase is recorded

None of these has a beat (MEASURED):
- **`POST /wardrobe/select`** (`src/routes/wardrobe.js:1578-1700`) approves an `episode_wardrobe` link with `approved_at = NOW()` (`:1663-1673`). If it auto-buys, it writes a ledger row (`:1618-1631`).
- **`POST /wardrobe/lock-outfit-atomic`** (`:1730-1895`):
  - one `wardrobe_purchase` row per bought piece, with `metadata.flow: 'lock_outfit'` (`:1817-1830`);
  - the links upserted (`:1841-1853`), and other approved links soft-deleted (`:1855-1860`).
- **`POST /wardrobe/purchase`** (`:1902-2031`): a ledger row with an optional `episode_id` (`:1957-1970`).
- **The tables:**
  - `episode_wardrobe` has `scene`, `scene_id` and `worn_at` (wall clock), with no beat (`src/migrations/20260927000000-create-episode-wardrobe.js:35-52`). The select and lock routes set none of the three (MEASURED).
  - `financial_transactions` has `episode_id`, `category`, `metadata` and `created_at`, with no beat or story order (`src/migrations/20260724000002-create-financial-transactions.js:14-53`).

**The script's cues for picking a piece** (MEASURED):
- **The skeleton** writes, per Transformation segment:
  - `[UI:OPEN ClosetCategory X]`
  - `[UI:SELECT Item <name>]`
  - `[FX:SPARKLE Small]`
  - `[UI:CHECK ToDoList "<item>"]`
  
  It also writes one fixed Lala line after the first segment (`src/utils/scriptSkeletonGenerator.js:166-195`). The item names are text, not wardrobe ids.
- **The parser** reads `[UI:CHECK …]` / `[UI:CHECK_ITEM …]` into `check_item` actions with a line number (`src/utils/scriptBeatParser.js:40`, `:263-274`, `:476-477`). Nothing consumes them. It has no wear or equip tag; unknown tags are skipped (`:348-350`).
- **Per piece, Lala's reactions are stored**, `lala_reaction_own`, `lala_reaction_locked` and `lala_reaction_reject` (`src/models/Wardrobe.js:383-396`), but nothing writes them into the script.

### 2.3 Spent so far

Every source is per episode, except script coin tags (MEASURED):
- **The look's charge, per piece:** `episodeLook()` (`src/services/episodeLookCharges.js:140-195`) gives each piece's `charge` / `free_because` and a `total` (`:171`), using the Finalize rule: owned, already bought, gifted or borrowed costs nothing; a rental costs its fee.
  - The Shopping list's costs already use it (`eventDocumentOverlayService.shoppingLines` `:115-130`; `frontend/src/lib/eventDocuments.js` `pieceCost`/`shoppingLines` `:67-96`).
- **The ledger:** `wardrobe_purchase` / `wardrobe_rental` rows by episode, ordered only by wall clock.
- **Balance before the episode:** `getBalanceBeforeEpisode` (`src/services/financialTransactionService.js:111-128`).
- **Per beat:** the only per-beat coin figure is `frontend/src/lib/beatState.js:56-66`. It sums the script's `[STAT: coins ±n]` tags up to the beat, on top of the balance before the episode. Its "Wearing" is all or nothing: nothing before the closet beat, the whole locked look from it on (`:68-74`).
- **Story order:** `lalaStats.coinsAt` counts an episode's rows only at `n×10+7` (`src/services/lalaStats.js:42`), so mid-episode spending is invisible there.
- No "spent so far" exists anywhere (MEASURED by grep).

### 2.4 Deal checklists

MEASURED:
- **Deliverables:** `event_deliverables` (`src/migrations/20260924000000-add-event-terms.js:41-88`):
  - status pending → completed → submitted → approved, with wall-clock `*_at` stamps;
  - stamped with the episode at Start (`src/services/eventTermsService.js:226-233`);
  - moved one step at a time by `src/routes/eventDeliverables.js:322-385`.
- **As episode tasks:** `deliverableTask` (`src/utils/socialTaskSource.js:51-66`) gives `{ slot: 'deliverable_<id>', task_source, owed_to, deliverable_id, timing: 'during', completed: false }`, saved on `episode_todo_lists.social_tasks` at Start (`episodeGeneratorService.js:964`).
  - They tick by manual toggles (`todoListRoutes.js:94-152`, `:314-350`), which **do not** move `event_deliverables.status`.
  - Episode completion reads the flags for bonuses (`src/services/episodeCompletionService.js:38-68`).
- **"Accepted deal":** there is no accepted or declined state. Accepted terms means the terms locked by Start Episode (`src/utils/eventTermsLock.js:77-89`; reopen at `src/services/termsReopenService.js:3-27`).
  - `Opportunity.status` / `status_history` exist (`src/models/Opportunity.js:31,36`) but are not wired to deliverables (INFERRED).
  - The brand agreement (OFFER/EXECUTED) is not built.
- **The location label:**
  - `world_events` has `host`, `host_brand`, `venue_name` and `venue_location_id` (`src/models/WorldEvent.js:76-123`).
  - The only byline is `documentByline`, "for <host_brand|host|name> · date" (`frontend/src/lib/eventDocuments.js:108-116`).
  - No "At STUDIO BY SABLE's Studio" label exists.

### 2.5 The Career list

MEASURED:
- **`CareerGoal`** (`src/models/CareerGoal.js:11-46`): `title`, `type`, the target and current value, `status` (active, completed, failed, paused or abandoned), `completed_at`.
  - It is updated only at episode completion (`episodeCompletionService.js:646-690`). Unlocks are spawned by `careerPipelineService.spawnGoalUnlocks` (`src/services/careerPipelineService.js:135`).
  - It keeps no history in story order.
- **The career plan document** has "This event" and "Bigger goals" sections (`eventDocumentsService.js:39`, `:94-97`, `:159-192`). Its overlay is the Career Checklist (`todoListService.js:800-920`).
- **Brands worked with:** not built.
  - `CharacterState.brand_trust` is one number (`src/models/CharacterState.js:27`).
  - `Opportunity.brand_or_company` exists (`Opportunity.js:39`).
  - Each event's `host_brand` names its brand (INFERRED to be the best source).
- **Milestones:** only `Opportunity.career_milestone` (`:70`) and goal completion.

### 2.6 Beats

MEASURED:
- **The story clock gives one order per episode phase:** `beatOrder` is always `n×10+5` (`src/services/storyClock.js:44`). Every beat in an episode shares it.
- **Within an episode:**
  - The order is the script's `## BEAT: n` headers (`frontend/src/components/Episodes/EpisodeScriptTab.jsx:55-75`) and line positions (`scriptBeatParser.js:338-352`).
  - `scriptMoments.beatOnScreen` (`frontend/src/lib/scriptMoments.js:223-268`) already tracks what is on screen line by line and carries it from beat to beat. **That is the precedent for "from this line on".**
  - `closetBeat` (`:305-325`) finds the closet beat.
- **Canonical beats** (`frontend/src/lib/canonicalBeats.js:8-23`):
  - 8, Transformation Loop (`CLOSET_OPEN`);
  - 9, Reminder/Deadline (`TODO_LIST`, on Lala's Phone);
  - 12, Deliverable Creation.
  
  There is no career-moment beat; the skeleton is phase 5 (#3124).
- **Per-beat data:** `feed_moments` pins a beat number (`src/services/feedMomentLink.js:83`). The phone's `storyAt` is the episode-phase order, not a beat (`frontend/src/components/Episodes/EpisodeLalasPhoneTab.jsx:9,210,245`).

### 2.7 The phone today

MEASURED:
- **`task_list`** (`frontend/src/components/ScreenContentRenderer.jsx:61-65`, `:203-204`; `TaskListRenderer` `:557-591`):
  - reads `GET /episodes/:id/todo/social`, the deals and goals, **not the Shopping list**;
  - strikes through `completed`;
  - ignores `storyAt`;
  - draws plain monospace text.
- **The content picker** offers no Shopping list or Career kind (`frontend/src/components/phone/ContentAreaPicker.jsx:7-8`, `:16-21`).
- **Production:** `to_do_list` → `to_do_list_page`, from the phase 1 read's §11 (`docs/reads/2026-10-14-phone-hub-read.md`). There is no code reference to the screen key.
- **The producer's To-Do tab** shows both lists (`frontend/src/components/Episodes/EpisodeTodoList.jsx:13-59`).

### 2.8 Open issues touching this phase

MEASURED, from the open issue list:
- **#3124** (phase 5 read, the episode skeleton and script language): the career moment and the skeleton's beats belong there.
- **#3123** (phase 4 read, opportunities and brand deals): the accepted deal and the brand agreement.
- **#3111** (Pulse beat pinning): a per-beat story moment.

No open issue builds any To-do mode.

## 3. Gap: each spec item

| Spec item | Status | Evidence |
|---|---|---|
| Shopping list opened many times while she gets ready (§5, §7.2) | **Partly built**: the list exists; the phone doesn't show it | `todoListService.getTodoList` `:638-681`; phone `task_list` reads social tasks only (`ScreenContentRenderer.jsx:559`) |
| An item crossed out **from the beat** where its piece is equipped or bought | **Not built**: crossing off follows the current look | `todoListService.js:648-668`; no beat on `episode_wardrobe` or the ledger (§2.2); `[UI:CHECK ToDoList]` never consumed (`scriptBeatParser.js:476-477`) |
| A running "spent so far" | **Partly built**: per-piece charges and an episode total exist; nothing sums to a beat | `episodeLookCharges.js:140-195`; `beatState.js:56-66` sums only `[STAT: coins]` tags |
| At an event with an accepted deal: its checklist, labelled with the location | **Partly built**: deliverable tasks exist; no location label, no accepted state | `socialTaskSource.js:51-66`; `documentByline` only (`eventDocuments.js:108-116`); `eventTermsLock.js:77-89` |
| Deal items tick at the beats where they happen | **Not built**: manual booleans and wall-clock status | `todoListRoutes.js:314-350`; `eventDeliverables.js:322-385` |
| Otherwise the Career list: goals, brands worked with, milestones | **Partly built**: goals and the career plan exist; no brands-worked-with list; milestones thin | `CareerGoal.js`; `eventDocumentsService.js:159-192`; `CharacterState.brand_trust` one number |
| The audience sees the Career list only at the career moment before travel | **Not built**: no career-moment beat (phase 5) | canonical beats have none (`canonicalBeats.js:8-23`) |
| A Lala line slot after each equip, drafted from the piece (§7.2) | **Not built** | no equip cue (`scriptBeatParser.js:348-350`); the skeleton's one fixed line (`scriptSkeletonGenerator.js:190-195`); `Wardrobe.lala_reaction_*` unused there |
| The Shopping list stays her handwritten note (§13) | **Built** for the Event Package and its overlay; **not built** on the phone | `eventDocumentOverlayService.js:151-193`; phone `task_list` plain text (`ScreenContentRenderer.jsx:570-590`) |

## 4. Design direction (for the rulings in §6)

- **"From the beat" comes from the script.** It is where Lala picks each piece, it already has line order (`beatOnScreen`), and it needs no migration. The alternative is a beat stamp saved with each equip: a new `episode_wardrobe` column, a migration, and the Wardrobe routes would need to know the beat, which they don't.
  - **A wear cue linked to the piece.** For example `[WEAR: <piece id or exact name>]`, or the existing `[UI:SELECT Item <name>]` resolved by name. The parser records it, and `scriptMoments` gains "worn so far" line by line, like `beatOnScreen`.
  - **Crossing off at a beat:** the lines whose slot is filled by pieces worn at or before that line. The rest of the look follows decision 2.
- **Spent so far** is the sum of the worn pieces' `episodeLook` charges up to that line. It is the Shopping list's own cost rule (§2.3), so the note and the Money page agree.
- **One to-do content area** on the phone picks its mode by the beat:
  - Shopping before or during the closet beat;
  - the deal checklist at an event with locked terms, labelled with the location;
  - otherwise the Career list.
  
  It is drawn as her handwritten note (§13), reusing the Event Package paper's look.

## 5. Proposed issues, in order (plan only; none opened)

Each fits one phone-reviewable PR.

1. **feat(phone): the Shopping list on Lala's Phone, as her handwritten note.**
   - A `shopping_list` content type reads `GET /episodes/:id/todo` (the wardrobe tasks, crossed off from the current look as today) and draws the Event Package paper's look: Caveat, lined pink, tape.
   - Added to the content picker.
   - Files: `ScreenContentRenderer.jsx`, `ContentAreaPicker.jsx`, a shared note style (a CSS module, or reusing `EventDocuments.css` classes).
   - Tests: vitest for the render, a strike per completed line, and the picker kind.
   - **No migration.**
2. **feat(script): a wear cue linked to the piece, and "worn so far" by line.**
   - The parser reads the wear cue (form per decision 1) into a `wear` action with the piece's id.
   - The Script tab resolves names to the episode's look; `scriptMoments.wornAt(beats, beatIndex, lineIndex)`.
   - The skeleton writes the cue for each segment in place of the text-only `[UI:SELECT Item]`.
   - Files: `src/utils/scriptBeatParser.js`, `scriptSkeletonGenerator.js`, `frontend/src/lib/scriptMoments.js`, `EpisodeScriptTab.jsx`.
   - Tests: parser and `scriptMoments` unit tests, and skeleton output.
   - **No migration.**
3. **feat(phone): the Shopping list crosses off from the beat.**
   - The `shopping_list` area (issue 1) takes the beat and line from the episode playback, `beatState`-style. A line is crossed off when a worn piece fills it at or before that point.
   - The Script tab's beat card shows the same.
   - Server: `GET /episodes/:id/todo?beat=&line=` computes from the script's wear cues; `todoListService` gains `filledAt`.
   - Tests: unit tests for `filledAt`, and vitest that a line crosses off at its beat and not before.
   - **No migration.**
4. **feat(phone): spent so far on the Shopping list.**
   - The worn pieces' look charges up to the beat (`episodeLook` per piece), shown on the note ("spent so far: 1,240 coins") and on the beat card.
   - Files: `todoListService`/`episodeLookCharges` (a per-piece charge map), the note and `beatState.js`.
   - Tests: unit tests (owned, bought, rental) and vitest.
   - **No migration.**
5. **feat(script): a Lala line slot after each wear cue, drafted from the piece (§7.2).**
   - After each wear cue, the Script tab offers an empty `Lala: ""` slot. Its draft comes from the piece's name, in-world price and fit with the dress code, plus `lala_reaction_own` when set (per decision 5). Evoni edits it.
   - Files: `EpisodeScriptTab.jsx` and a small `lib/lalaLineDraft.js`. If AI drafting is ruled in, a Haiku route with `aiRateLimiter` and the cost tracker.
   - Tests: unit tests for the draft text, and vitest for the slot.
   - **No migration.**
6. **feat(phone): the deal checklist mode, labelled with the location.**
   - The to-do area shows the event's deliverable tasks with "At <host_brand or host>'s <venue>", when the episode's event has locked terms (`findTermsLockEpisode`). Items tick at the beats per decision 3.
   - Files: `ScreenContentRenderer.jsx`, `socialTaskSource.js` (the label), and a `deliver` cue in the parser if ruled.
   - Tests: the label, and ticks by beat.
   - **No migration.**
7. **feat(phone): the Career list mode, with brands worked with.**
   - The active and completed `CareerGoal`s, milestones, and brands worked with, derived from completed events' `host_brand` (decision 4), as of the episode.
   - Files: a new `src/services/careerListService.js`, a route, and the content area.
   - Tests: unit and vitest.
   - **No migration** if derived; a migration only if Evoni wants a stored brands list.
8. **(After phase 5, #3124) The audience sees the Career list only at the career moment.**
   - The mode choice uses the skeleton's career-moment beat.
   - Blocked on the phase 5 read.

Issues 1, 2 and 7 can start in parallel. 3 needs 1 and 2; 4 needs 3; 5 needs 2; 6 needs 1.

## 6. Decisions for Evoni ([decide])

1. **[decide] Where "from the beat" comes from:**
   - the script's wear cue (recommended, no migration); or
   - a beat saved with each equip in Wardrobe (a migration, and Wardrobe would need to know the beat).
   
   And the cue's form: a new `[WEAR: piece]`, or the existing `[UI:SELECT Item <name>]` matched by name?
2. **[decide] A piece in the look with no wear cue:**
   - crossed off from the closet beat on, as the beat card's "Wearing" does today; or
   - never crossed off until a cue is written?
3. **[decide] Deal items tick:**
   - each at its own script cue (`[DELIVER: …]`); or
   - all at canonical beat 12, Deliverable Creation?
   
   And should a tick also move the deliverable's status (pending → completed), or stay display only?
4. **[decide] "Brands worked with":**
   - derived from completed events' `host_brand` (recommended, no migration); or
   - a list she keeps herself (a migration)?
5. **[decide] Lala's line after each equip:**
   - a template from the piece's fields and `lala_reaction_own` (free); or
   - an AI draft in her voice (Haiku, costed and budget-gated)?

And one for the mode switch: **the phone's to-do area picks its mode by the beat automatically** (recommended), or Evoni picks the mode per screen area?
