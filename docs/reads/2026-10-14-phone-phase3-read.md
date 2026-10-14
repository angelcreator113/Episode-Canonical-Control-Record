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
   - Evoni ruled on all six decisions (§6).

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

## 4. Design direction (ruled in §6)

- **"From the beat" comes from the script.** It is where Lala picks each piece, it already has line order (`beatOnScreen`), and it needs no migration. The alternative is a beat stamp saved with each equip: a new `episode_wardrobe` column, a migration, and the Wardrobe routes would need to know the beat, which they don't.
  - **A wear cue linked to the piece.** For example `[WEAR: <piece id or exact name>]`, or the existing `[UI:SELECT Item <name>]` resolved by name. The parser records it, and `scriptMoments` gains "worn so far" line by line, like `beatOnScreen`.
  - **Crossing off at a beat:** the lines whose slot is filled by pieces worn at or before that line. The rest of the look follows decision 2.
- **Spent so far** is the sum of the worn pieces' `episodeLook` charges up to that line. It is the Shopping list's own cost rule (§2.3), so the note and the Money page agree.
- **One to-do content area** on the phone picks its mode by the beat:
  - Shopping before or during the closet beat;
  - the deal checklist at an event with locked terms, labelled with the location;
  - otherwise the Career list.
  
  It is drawn as her handwritten note (§13), reusing the Event Package paper's look.

## 5. Proposed issues, in order (plan only; updated with Evoni's rulings in §6)

Each fits one phone-reviewable PR. **Issues 1, 2 and 7 open now and run in parallel. Issues 3–6 follow once 2 merges. Issue 8 waits for the phase 5 read (#3124).**

1. **feat(phone): the Shopping list on Lala's Phone, as her handwritten note.**
   - A `shopping_list` content type reads `GET /episodes/:id/todo` (the wardrobe tasks, crossed off from the current look as today) and draws the Event Package paper's look: Caveat, lined pink, tape.
   - Added to the content picker.
   - Files: `ScreenContentRenderer.jsx`, `ContentAreaPicker.jsx`, and a shared note style, reusing the `EventDocuments` paper.
   - Tests: vitest for the render, a strike per completed line, and the picker kind.
   - **No migration.**
2. **feat(script): `[WEAR: <piece id>]`, and "worn so far" by line** (ruling 1).
   - The parser reads `[WEAR: <wardrobe id>]` into a `wear` action with the piece's id and line.
   - Older scripts keep working: `[UI:SELECT Item <name>]` is read by name against the episode's look. **A name that doesn't match exactly one piece is flagged** (no match, or several), never guessed.
   - `scriptMoments.wornAt(beats, beatIndex, lineIndex)` gives the pieces worn up to a line, following the `beatOnScreen` precedent.
   - The skeleton writes `[WEAR: id]` for each segment when the look is known.
   - The Script tab shows the flags.
   - Files: `src/utils/scriptBeatParser.js`, `scriptSkeletonGenerator.js`, `frontend/src/lib/scriptMoments.js`, `EpisodeScriptTab.jsx`.
   - Tests: parser (WEAR, legacy SELECT, ambiguous and unknown names), `wornAt`, and skeleton output.
   - **No migration.**
3. **feat(phone): the Shopping list crosses off from the beat** (after 2; ruling 2).
   - A line is crossed off from the line where a worn piece fills it.
   - **A piece in the look with no cue is crossed off at the last getting-ready beat and flagged "in the look, never equipped on screen".**
   - "The last getting-ready beat" is the script's closet beat (`scriptMoments.closetBeat`), or the last beat with a wear cue if later. This is INFERRED and confirmed in the build issue.
   - Server: `GET /episodes/:id/todo?beat=&line=` computes from the script's cues; `todoListService.filledAt`.
   - The phone area and the Script tab's beat card agree.
   - Tests: `filledAt`, the uncued piece and its flag, and vitest for crossing off at the beat.
   - **No migration.**
4. **feat(phone): spent so far on the Shopping list** (after 3).
   - The worn pieces' `episodeLook` charges up to the beat (owned, already bought, gifted or borrowed free; a rental its fee), on the note and the beat card.
   - Files: `episodeLookCharges` (a per-piece charge map), `todoListService`, the note and `beatState.js`.
   - Tests: unit and vitest.
   - **No migration.**
5. **feat(script): a Lala line slot after each `[WEAR]`, drafted from a free template** (after 2; ruling 5).
   - After each wear cue, the Script tab offers a `Lala: "…"` slot. It is drafted from a template using the piece's name, in-world price and the dress code. Evoni edits it.
   - **An AI draft comes later, behind a button, under the daily cap**: a separate issue with `aiRateLimiter` and the cost tracker.
   - Files: `EpisodeScriptTab.jsx` and `frontend/src/lib/lalaLineDraft.js`.
   - Tests: unit tests for the template, and vitest for the slot.
   - **No migration.**
6. **feat(phone): the deal checklist mode, labelled with the location, and the mode switch** (after 2; rulings 3 and 6).
   - At an episode whose event has locked terms (`findTermsLockEpisode`), the to-do area shows its deliverable tasks under "At <host_brand or host>'s <venue>".
   - **Each item ticks at its own `[DELIVER: <deliverable id>]` cue.** Ticking does **not** change the deliverable's status. A ticked item may show "ready to approve", and approval stays manual in Money.
   - **The mode is automatic by beat:**
     - Shopping through the getting-ready beats;
     - the deal checklist at an event with locked terms;
     - otherwise the Career list.
   - **There is a manual override per beat**, as a script cue in that beat (`[TODO_MODE: shopping|deal|career]`), with no migration. The cue's form is to be confirmed in the build issue.
   - Files: `scriptBeatParser.js` (DELIVER and TODO_MODE), `scriptMoments.js` (`deliveredAt`, `todoModeAt`), `ScreenContentRenderer.jsx`, `socialTaskSource.js` (the label).
   - Tests: the label, ticks by cue, that the status is unchanged, and the mode by beat with its override.
   - **No migration.**
7. **feat(career): the Career list, with brands worked with** (parallel; ruling 4).
   - Active and completed `CareerGoal`s and milestones, as of the episode.
   - **Brands worked with are derived from executed agreements and past deals**: events whose terms locked in a completed episode, by `host_brand`. When the brand agreement's EXECUTED state exists (phase 4, #3123), it is read too.
   - **A per-brand hide option**, with no separate list. Hidden brands are stored in show settings (`shows.metadata.career_hidden_brands`), with no migration.
   - A new `src/services/careerListService.js`, `GET /shows/:id/career-list?episode_id=`, `PUT …/career-list/hidden-brands`, and a `career_list` phone content area drawn as her note.
   - Tests: unit tests (derivation, hide, as of the episode) and vitest.
   - **No migration.**
8. **(After the phase 5 read, #3124) The audience sees the Career list only at the career moment.**
   - The mode switch uses the skeleton's career-moment beat. Blocked until #3124.

## 6. Rulings (Evoni, 2026-10-14)

1. **Beat source:** a script cue, no migration.
   - A new `[WEAR: piece]` cue references the piece **by id**.
   - Existing `[UI:SELECT Item …]` lines are still read by name for old scripts. Any name that doesn't match exactly one piece is flagged.
2. **A piece in the look with no cue** is crossed off at the last getting-ready beat and flagged "in the look, never equipped on screen".
3. **Deal items** tick each at its own cue.
   - Ticking does not change the deliverable's status.
   - It may show "ready to approve", but approval stays manual in Money.
4. **Brands worked with** are derived from executed agreements and past deals, with a per-brand hide option. There is no separate list.
5. **Lala's line after each piece** is a free template from the piece's name, in-world price and the dress code. An AI draft comes later, behind a button, under the daily cap.
6. **To-do mode** is automatic by beat, with a manual override per beat.
