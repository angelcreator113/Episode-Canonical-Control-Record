# Studio Home and Episode Command Center — the authoritative plan

**Status.** The one authoritative plan for the Studio Home, Episode Command Center, resume, slot-aware planning and sidebar work. Compiled on 2026-11-17 from Evoni's decisions of that day (§2). It is a roadmap, not execution authorization: each pull request needs its own approval (§2.4).

**Progress, as of 2026-11-18.** Most of the plan is not implemented.

| State | Pull requests |
|---|---|
| Merged to `main` | PR-00 (#3872, these documents), PR-01 (#3873, request-count pins), PR-02 (#3874, shared next action and next slot), PR-03 (#3875, the production episode and the episode to resume), PR-04 (#3876, the resume location, the show, a deleted episode) |
| Open, awaiting Evoni's review; not merged | PR-05 (#3877, return paths A) |
| Planned, not started | PR-06 to PR-09 (the rest of R1); PR-10 to PR-13 (R2, slot-aware planning); PR-14 to PR-16 (R3, Studio Home); PR-17 and PR-18 (R4, Episode Command Center); PR-19 to PR-22 (R5, sidebar and show navigation) |

Merged means merged to `main`; nothing here says any of it is deployed to production. Studio Home, the Episode Command Center, slot-aware planning and the sidebar changes do not exist yet. Where what was built differs from the design below, §4's clarification says how; known limits are in §13.

**Basis.** `origin/main` at `8ca49577f544b3e593ae47ff88b7df64068239ab`.

**Citation style.** Code is cited by stable name (component, function, route), per the living-doc convention in `CLAUDE.md`. The dated reads listed below carry the line-level evidence against the basis SHA.

**Evidence standard.** Everything about current behaviour was read from source. Nothing was run in a browser, and no test was executed for this plan. Statements that still need a check are listed in §12.

**Where the evidence lives.**

| Document | What it is |
|---|---|
| `docs/reads/2026-11-17-episode-workflow-navigation-audit.md` | The full read-only audit (login, creation, existing episode, 18-system journey, sidebar, walkthroughs) |
| `docs/reads/2026-11-17-studio-home-refined-plan.md` | The refined plan as first returned (concerns A–F). Superseded by this document where they differ |
| `docs/design/2026-11-publication-confirmation-safeguard.md` | A separate proposal. Not part of this sequence |

---

## 1. Product goal

> An Episode Command Center that immediately tells me what I am producing, where I left off, what I should do next, and what is blocking me. Prioritize that experience over adding new systems. — Evoni, 2026-11-17

Two experiences:

- **Studio Home** — the production headquarters an ADMIN lands on. It reuses the existing `Home` page.
- **Episode Command Center** — the episode workspace. It enhances the existing Episode Overview tab (`EpisodeOverviewTab`) at the existing route.

No new page, table, service, dashboard, wizard or AI agent is introduced by this plan.

---

## 2. Decisions on record (Evoni, 2026-11-17)

### 2.1 Direction

1. Studio Home reuses the existing Home page.
2. The Episode Command Center enhances the existing Episode Overview.
3. "Resume where I left off" is a core requirement.
4. Reuse Producer Mode's `primaryAction` mechanism where appropriate.
5. Keep LalaVerse hub access; use "The Pulse" consistently.
6. Game-facing homepage links stay, in a secondary section, initially.
7. Show navigation opens the Season page, with a clear route to Producer Mode. Legacy redirects and links are preserved.

### 2.2 Constraints

- Resume memory is **browser-only** for now. Existing saved work and state keep working.
- **Slot track S1–S4 ships before Studio Home.** A changed slot rejects the Start **before any episode is created** (§5). No silently unplaced episode unless separately approved.
- This sequence does **not** change the episode `status` field, any control that writes it, publication behaviour, or Start readiness.
- Start readiness tiers (Block / Confirm / Info) are a **separate Phase 5**, report-only first. No enforcement change now.
- **Performance is a requirement** (§7): Home first paint ≤ 6 requests, full load ≤ 21, with no new endpoint initially. Success is declared only after browser timings are measured on development.
- The publication-confirmation safeguard is proposed **separately** and is not part of the visual redesign.
- Preserve all existing episodes, seasons, event packages, opportunities, The Pulse content, voice work, scripts, media, production data and permissions.

### 2.3 What is approved

| Item | Standing |
|---|---|
| PR-00 (these documents) | Approved to create. Merge needs separate approval |
| R1–R5 (§9) | Approved **as a roadmap**, not as blanket execution authorization |
| Refined S4 behaviour (§5.3) | Intended behaviour approved; to be verified by integration tests |
| Request targets (§7) | Approved as performance goals |
| Development preview routine (§8) | Approved, with the limits in §8.2 stated on every preview |

### 2.4 Execution rule

After a pull request passes CI, its exact scope, head SHA and checks are returned to Evoni for a separate merge approval. No session proceeds automatically from one pull request to the next, merges, deploys, or modifies production.

---

## 3. Relationship to earlier documents

One plan governs. Earlier documents are preserved, unedited, and linked here.

### 3.1 `docs/reads/2026-11-04-navigation-ownership-blueprint.md`

That blueprint is a design proposal following Evoni's rulings of 2026-11-04 (recorded in `docs/reads/2026-11-04-platform-architecture-audit.md` §11). Read in full on 2026-11-17. Standing of each part:

| Blueprint guidance | Standing under this plan |
|---|---|
| **Governing principle** ("Dream Cities creates life, Lala has to afford that life, JustAWoman decides") and "nothing is accepted, paid, completed or reassigned automatically" | **Stands.** The slot track (no silently assigned slot) and the publication safeguard apply it |
| **Ownership model** — owner record per page, "context, not copies" | **Stands.** This plan adds no copy of any record |
| **Rulings 2 and 7** — Producer Mode stays as a transitional hub; no page deleted or hidden without dependency checks | **Stands.** This plan retires nothing and deletes no page |
| **Ruling 3** — one Complete workflow; the proposed EPISODE "Complete" tab with `/evaluate` folding in (blueprint §4, §8 step 4) | **Stands, outside this sequence.** R1–R5 leave the episode's tabs as they are. The audit's own consolidation list (its Part 7 I) is **not** authoritative; ruling 3 and the blueprint govern completion |
| **Sidebar** — "introduce the five workspace headings" WORLD, SHOWS, SEASON, EPISODE, LALA (blueprint §8 step 2; ruling 1 names these as target workspaces) | **Conflict; superseded for the sidebar by §6.3 of this plan.** R5 groups the sidebar as PRODUCE, FRANCHISE, WRITE, STUDIO, SYSTEM with a pinned Current Episode row. The workspaces remain the ownership vocabulary: FRANCHISE holds what the blueprint calls WORLD; PRODUCE holds SHOWS, SEASON and EPISODE destinations. **This needs Evoni's confirmation at R5**, because it departs from the wording of ruling 1 |
| **LALA workspace** (Lala home, Money, Stats, Closet, Goals, Relationships, Phone) | **Deferred, not cancelled.** Not built in R1–R5. Until then the "Lala's journey" material stays on Home in the secondary section (decision 6) |
| **Show home** as the landing for a show (`ShowOverview`), then Season home | **Superseded for navigation** by decision 7: a show opens its Season page; Producer Mode's Overview stays one click away |
| **SEASON › Event Board** (ranked candidates for a slot, as a new page) | **Stands as a later proposal.** S2 (§5.2) offers "use an existing event" and "create a new event for this slot" inside the existing slot panel and must not block an Event Board |
| **Event Package** "readiness (enforced on the server)" | **Refined.** How and when is Phase 5: tiers Block / Confirm / Info, report-only first (§2.2). No enforcement change in this sequence |
| **Journey** "Start Episode (uses the pencilled slot)" | **Stands and is strengthened** by S1–S4 |
| **Breadcrumbs** "Workspace › Record › Tab" and the sidebar workspace switcher and attention count | **Not adopted in R5.** R5 makes the smaller breadcrumb changes in §6.3. The scheme stays a proposal |
| **One state badge vocabulary** "draft · ready · approved · completed" | **Stands as a proposal for record badges.** The three state lines in §6.2 are display-only labels on the episode page and change no stored value |
| **Episode Overview** "see what this episode is and what's missing" | **Extended** by §6.2 (resume, named next action, progress, blockers) |
| **Open question 3** (The Pulse: WORLD or its own workspace) | Answered for the sidebar: The Pulse stays with LalaVerse, Characters and Relationships |
| **Open question 4** (Assets & Wardrobe: SHOWS page or a separate library) | Answered for the sidebar: a separate STUDIO group. The merged "Assets & Wardrobe" page stays a proposal |
| **Open questions 1 and 2** (LALA per show; World home before the world clock) | Untouched |
| **Transition plan step 1** ("P0 fixes A–D land, then #3702 and #3703") | Not verified for this plan |

### 3.2 `docs/design/2026-11-season-planning.md` (accepted specification)

It stands in full. Two of its rulings bear on the slot track:

- **C5** — "Automatic empty-slot selection follows story order, not release order", with the note that "the display shown before Start is a prediction". S1 makes that prediction match what Start does. S3 and S4 turn it into a choice the ADMIN confirms and the server honours. The default offered is still the earliest slot in story order, so C5's ordering is kept.
- **Move/Swap** (its §4, §10, not built) is the specified way to move an episode after Start. This plan asks for nothing beyond it; where the refined plan lists "S5: a way to move an unfilmed episode", read "Move/Swap as specified there".

### 3.3 `docs/reads/2026-11-06-episode-lock-order.md`

It stands. S4 follows its order (existing episodes → world events → specials → slots) and delivers, for the chosen-slot case, what that document names as outstanding: "Start is not atomic until A1.3b".

---

## 4. One active episode, and resume

> **Clarification, 2026-11-18: what was built differs from §4.2 to §4.4 below, by Evoni's rulings.** The text below is the design as approved on 2026-11-17 and is kept unchanged. PR-03 (#3875) and PR-04 (#3876) were built to her rulings of 2026-11-17 and 2026-11-18, which take precedence where they differ:
>
> - **Four things, kept apart.** The *official production episode*; the *resume episode*; the *resume location*; and the *next production task* (the existing checklist-driven recommendation, `primaryAction`). There is no single `activeEpisode` function.
> - **Official production episode** (`productionEpisode`): the first unfinished episode in story order. It is worked out from the show's episodes alone, so opening another episode never changes it. It is not the episode with the latest `updated_at` (§4.2 rule 3).
> - **Resume episode** (`resumeEpisode`): the episode last opened in this browser while it is an unfinished episode in that show's list; otherwise the official production episode.
> - **Unfinished** is Producer Mode's existing rule: status `draft`, `scripted`, `in_build` or `in_review`, and `evaluation_status` not `accepted`. A season slot with no episode record is never eligible.
> - **"Last opened"** is the browser's existing `working-episode-id`, with one reader and one writer (`utils/activeEpisode.js`). There are no per-show pointers (§4.4, "Multiple shows").
> - **Producer Mode's card** still opens on the official production episode as "Now producing"; when a later unfinished episode was opened last, it offers "Resume … (last opened)". Home and the Shows page continue the resume episode and name the production episode when it differs.
> - **Resume location:** one browser key, `working-episode-locations`, holding the last working tab and a time for each of the 20 most recently visited episodes. It records tabs only (Script, and the views of Production and Results), not a path (§4.3): the editor, plan, run sheet, evaluate and teleprompter pages are not recorded. The Overview is never recorded. Voice is recorded and read back only while it is open to this admin; a saved Voice location is passed over while it is not, and is not deleted.
> - **The address decides.** A saved location never changes an address. No control reads it yet; the "Resume" controls are PR-16 and PR-18.
> - **The show** is remembered in its existing key (`primeStudios.activeShowId`) once the episode, or the Season page's own show read, has answered.
> - **A deleted episode:** the single-episode read does return a soft-deleted episode, marked `deleted_at`, and the Episode page uses that (§4.4 said it would never be used): it shows "not found", and forgets that episode's location and "last opened". It forgets only on a confirmed answer (the mark, or the server's 404), never on a network error, a server failure, a refusal or a timeout.
> - **Not built:** the `storage` listener and window event of §4.4 ("Multiple tabs").
>
> Known limits of what was built are in §13.

### 4.1 Today

Five things each claim the current episode and can disagree: `continueEpisode` on Home, `showActivity` on the Shows page, `defaultEpisode` in `ShowOverview`, the browser key `working-episode-id` written by `EpisodeDetail` (read only by `EditorHub`), and `currentEpisodeId` in `App.jsx` (passed only to the assistant). Nothing stores a tab. There is no per-user store on the server.

### 4.2 The rule

One pure function, `activeEpisode({ showId, episodes, pathname })`, in a new util shaped like `utils/activeShow.js`:

1. the episode in the URL, on an episode route;
2. the episode remembered **for this show**, if it is still in the show's live list and unfinished;
3. the unfinished episode with the latest `updated_at`, ties broken by lowest episode number;
4. none — Home leads with "Plan next episode".

"Unfinished" means not archived, not completed (`evaluation_status` accepted) and not `published`. Home, the Shows page, Producer Mode's default, the sidebar pin and the Editor hub all call it.

### 4.3 Resume

- **Stored, in this browser only:** the last app path visited while working on an episode, with a time. `working-episode-id` keeps being written, so existing readers keep working.
- **A location is:** an episode tab; an episode sub-route with the id in its path (editor, plan, run sheet, evaluate); the teleprompter opened for that episode.
- **Recorded from the URL,** so a tab change cancelled by the unsaved-script prompt is never recorded.
- **Not stored:** scroll, selected beat, the Files inner tab, the Overview phone column, the editor playhead. These are not in the URL today.
- **Buttons:** "Resume: <place> · <when>" only when a stored location exists and is not the Overview itself. "Next: <action>" always. Nothing redirects automatically.

### 4.4 Edge cases

| Case | Behaviour |
|---|---|
| Multiple shows | Pointers are per show. Opening an episode, or the Season page, remembers that show |
| Multiple tabs | Last write wins; a `storage` listener and a window event update Home and the sidebar |
| Multiple devices | Independent. A new device falls back to rule 3 and has no stored tab |
| Missing or deleted episode | Validated against the show's episode list, which excludes deleted rows. If absent, the pointer is forgotten. The single-episode read is never used to validate, because it returns soft-deleted episodes |
| Stale location | Must be an app path belonging to that episode. The tab goes through `resolveEpisodeTab`; unknown or switched-off tabs become Overview. Extra parameters are dropped, except beat and line on the Voice tab |

No server write is made, so `updated_at` is undisturbed and no page view is logged (Evoni's ruling of 2026-11-11).

---

## 5. Slot-aware planning (S1–S4)

### 5.1 Today

- A wrong weekly slot cannot be undone: `placeEpisodeIn` refuses an already-placed episode, and Move/Swap is not built.
- The Roadmap's "+ Add Episode" carries no slot. The Start request carries no slot.
- `assignOnStart` runs after the Start commits: the event's own pencilled slot, else the earliest empty un-pencilled slot, else a bonus special on a full season, else no slot.
- The slot named beforehand (`eventSeasonContext`, the What's-next suggestions) is the earliest slot with no episode, **including** slots pencilled for other events. Start skips those. The two can differ.
- Guaranteed and tested today: a pencilled event starts in its slot; Start never takes another event's pencil; Regenerate keeps its slot.

### 5.2 The four steps

| # | Change |
|---|---|
| **S1** | The "where an unplaced event will land" slot on the Event Package and What's-next uses Start's own rule |
| **S2** | An empty slot offers "Create a new event for this slot". The starter (`NewEpisodeStarter`) carries the slot through all five doors and pencils the new event into it with the existing pencil route. If the slot was taken meanwhile it says so and leaves the event unplaced |
| **S3** | The Start dialog always shows the slot and requires a choice. Same on the Event Library generate and the What's-next overlay |
| **S4** | Start accepts the chosen slot and rejects, before creating anything, if it changed (§5.3) |

### 5.3 S4 behaviour

The request carries the slot the ADMIN chose.

| Step | What happens | If the slot no longer matches |
|---|---|---|
| 1 | A retried request that already succeeded returns that episode (unchanged) | — |
| 2 | Existing refusals: event already has an episode, frozen, deal prices, offer decision (unchanged) | — |
| 3 | **New, no lock:** a plain read checks the chosen slot is still available to this event | 409 `START_SLOT_CHANGED`. No AI call is made |
| 4 | The AI drafts the title and brief (unchanged, outside the transaction) | — |
| 5 | The transaction opens; the event is locked and re-checked (unchanged) | — |
| 6 | **New:** the chosen slot row is locked and checked again | 409 `START_SLOT_CHANGED`. The transaction rolls back **before the episode is created** |
| 7 | Episode, brief, spending draft, event-used stamp, price snapshot, offer decision (unchanged) | — |
| 8 | **New:** the slot takes the episode and the season snapshot is written, in the same transaction, on the row locked at step 6 | — |
| 9 | Commit: the episode and its slot exist together, or neither does | — |
| 10 | The post-commit slot step is skipped; the rest of post-commit setup is unchanged | — |

**The check** passes only when the slot belongs to this show's active season, is not deleted, has no episode, is not locked, its pencil is empty or is this event, this event is not pencilled in a different slot, and this event is not in an unstarted special.

**The conflict answer** names the chosen slot, why it is unavailable, and the slot an unplaced Start would take now. **On screen:** "S1 · E2 is no longer available: <reason>. Nothing was created." with *Choose the next slot*, *Open the Roadmap*, *Cancel*.

**Unchanged when no slot is sent:** Regenerate (never sends one), specials, a full season's existing choice dialog, a show with no season, and existing tests.

### 5.4 Why this is atomic without a new locking system

- `generateEpisodeFromEvent` already rejects this way: it locks the event, re-checks under the lock, and throws a 409 before `Episode.create`.
- Locking one slot after the event follows the documented order, the same order `pencilEventIn` and `applyPlacement` use.
- `assignOnStart` already accepts a caller's transaction.

**This is read from source, not proven.** S4 is not done until the tests below pass on CI's database.

### 5.5 Verification S4 must pass

**Lock order and atomicity (integration):**

- two Starts choosing the same slot: one succeeds, the other gets 409;
- a Start against a pencil of a different event into the chosen slot, in both orders;
- a Start against a season placement Save, and against placing an existing episode, in both orders;
- no deadlock in the lock-order matrix; the static lock-order guard updated with a matching trace test.

**A conflict leaves nothing behind.** After a 409 at step 3 or step 6, each of these is asserted unchanged:

| Must not exist or change | Why it is at risk |
|---|---|
| `episodes` row | created at step 7 |
| `episode_briefs` row | created at step 7 |
| `scene_plans` rows (the 14 beats) | created in post-commit setup |
| `season_slots` — the chosen slot and every other slot | step 8 |
| `world_events.status`, `used_in_episode_id`, `times_used` | the event-used stamp at step 7 |
| episode spending lines and the price snapshot | step 7 |
| `opportunities` (offer decision) | step 7 |
| `financial_transactions`, `character_state`, episode totals | must never move at Start |
| to-do list, feed moments, scene-set links, wardrobe links, asset relinks | post-commit setup |
| the idempotency record for that key | a later retry must not replay a Start that never happened |

**Also asserted:** a pencilled event with no slot sent still starts in its slot; Regenerate keeps its slot; a conflict at step 3 makes no AI call.

### 5.6 Residual risks (documented separately, as required)

1. **AI-cost race.** If the slot is taken in the gap between step 3 and step 6, the draft from step 4 has already been paid for (one Haiku call) and is discarded. The episode is still not created. Bounded: one call per conflicting Start, only inside that gap. Not eliminated by this design; moving the AI call after the lock would hold row locks across a network call, which the existing design avoids.
2. **Writes made before Start is sent.** The "Who's new" step can add cast before the Start request; those additions persist if the Start is then refused. This is existing behaviour for any Start refusal. Mitigation in the Start-dialog PR: show and check the slot before the Locations and Who's-new steps. Whether to go further is a separate decision.
3. **API calls with no slot.** A direct call that sends no slot keeps today's behaviour, including the existing non-fatal "not placed" setup step on a lock timeout. After the Start-dialog PR every screen sends a slot. Making it mandatory at the API is a later decision, best taken with Phase 5.

### 5.7 What Studio Home needs

Its "Plan next episode" card names a slot. It ships only after S1–S4 are live (R2 before R3).

---

## 6. The three surfaces

### 6.1 Studio Home (`Home`)

Top to bottom:

| # | Section | Built from |
|---|---|---|
| 1 | Show header: name, season position, links to Season Roadmap and Producer Mode | existing hero; `seasonStats`; `useActiveShow` |
| 2 | **Now producing**: what, where I left off (**Resume**), what next (**Next**), "Open episode" | the `NowProducing` card extracted from `ShowOverview`; `primaryAction`; `activeEpisode` |
| 3 | **Plan next episode**: next slot, its story purpose, its pencilled event → the Roadmap with that slot open | `useNextSlot`; `seasonPageHref` |
| 4 | **Needs attention**: what is blocking | `attentionItems`; the existing To-Do card |
| 5 | Coming up | existing event card |
| 6 | Studio numbers | existing AI budget card |
| 7 | **In the LalaVerse** (secondary): The Cast, Map, Lala's Bank, Shop, The Pulse tiles; Trending; Lala's Journey; Shop the Look; the show's money | existing sections, moved; all eight tile test ids kept |

- Empty states: no show → create one; no season → set one up; no episode → "Plan next episode" leads; a failed read says so and offers Retry.
- The Plan card links into the Roadmap. **Home never starts an episode.**

### 6.2 Episode Command Center (the Overview tab)

Same route. Order:

| # | Section | Answers | Built from |
|---|---|---|---|
| 1 | Identity and three state lines | What am I producing? | existing header; fields below |
| 2 | **Resume** and **Next action** | Where did I leave off? What next? | `NextStepBanner` fed by `primaryAction`; §4.3 |
| 3 | Progress: the seven-step bar, **without** "Mark Ready" | How far along? | `EpisodeProductionHeader`, data the page already loads |
| 4 | **What's ready**: complete · missing · optional · blocked | What is blocking me? | the checklist sections the page already loads |
| 5 | Connected: event package, place, cast, look, season slot | | `FromEventCard`, the Events card, Season position |
| 6 | Reference: brief, teaser, stakes, money, style board | | existing |

**Three meanings, shown separately, derived only from existing fields:**

| Line | Values | From |
|---|---|---|
| Story | Planned · Started · Completed | a slot with no episode; an episode not yet accepted; `evaluation_status` accepted |
| Production | Brief → Script → Scenes → Filmed → Edited → Thumbnail | `productionSteps`, unchanged |
| Release | Not released · Released | `status` is `published` |

**Blocked** means what truly blocks today: a setup step that did not finish, Voice or Edit switched off, and render not being built.

**Not changed:** `stageOf`, the board columns, the status dropdown, and what `published` does. The step bar arrives without "Mark Ready" so the Overview adds no control that writes `status`.

An existing test requires the text "Producer Mode" to be absent from the Overview; the route to Producer Mode lives on Home and in the sidebar.

### 6.3 Sidebar and show navigation

```
Home
▸ Current Episode                          → the Resume target; hidden when none
PRODUCE     Season Roadmap · Episodes · Events & Opportunities · Editor · Teleprompter
FRANCHISE   Shows (each show → its Season page) · LalaVerse · Characters · Relationships · The Pulse
WRITE       Stories (Threads · Story Calendar · Story Evaluation) · Writing desk
STUDIO      Assets · Scene Sets · Wardrobe · Templates
Search · Settings · Admin
```

- Show-scoped rows are links built from the active show; with none, they open the show chooser.
- Characters and Relationships are hidden for non-admins; both already refuse them on arrival.
- Show links open the Season page. "Producer Mode" is linked from Home, the Shows card and the Season page. Breadcrumbs stop nesting Season under Producer Mode.
- **The `/shows/:id` redirect and its old-tab mapping are untouched,** so saved links keep working.
- Naming: four leftover "feed" strings become The Pulse wording; the breadcrumb "Universe" becomes "LalaVerse". "Lala's posts", "JustAWoman's Feed" and "Phone" are different things and keep their names.
- See §3.1 for the conflict with the blueprint's workspace headings.

---

## 7. Performance

**Goals (approved):** Home first paint ≤ 6 requests; Home full load ≤ 21; no new endpoint initially.

**Counted from source at the basis SHA (not timed):**

| Page | Requests today |
|---|---|
| Home | 10, plus the sidebar's second `/shows` read |
| Episode Overview | about 28–33; seven URLs are fetched two or three times |
| Studio Home if built naively | 35 |

`loadProductionChecks` makes 16 requests, awaited one after another. Home's episode list is the newest 100 across all shows and includes each episode's full script text.

**Order of work (reuse → de-duplicate → lazy-load → trim):**

1. **Reuse.** Compute attention with the pure `attentionItems` from data Home already holds plus one roadmap read; feed the same roadmap to the Plan card; pass Home's Lala state into the checklist; skip the checklist when the episode has no script.
2. **De-duplicate.** One `/shows` read shared by the sidebar and Home. On the episode page, pass the events, brief and scene sets already loaded into the Overview tab and the checklist.
3. **Lazy-load.** Run the checklist's reads in parallel. Load it after first paint, required sections first. Defer the below-the-fold reads.
4. **Trim.** Home asks for its own show's episodes only. A light list mode without script text is held until measured.

**How success is judged:**

- A tests-only pull request pins today's request counts first. Later pull requests may lower the pinned numbers, never raise them.
- **Browser timings are measured on development, before and after.** The goals are not declared met from request counts alone.
- A new endpoint (the one candidate is a server-side checklist summary) is proposed only if those timings show the parallelised checklist is still the slowest part of the page.

---

## 8. Preview on development

### 8.1 Routine

| Stage | What happens |
|---|---|
| 1 | Pull request: CI green; request-budget tests pass; for visual changes, screenshots at 375px and desktop |
| 2 | Deploy to Development for that commit, when Evoni asks. One box, so one preview at a time |
| 3 | Evoni walks the pull request's acceptance checklist on the development site |
| 4 | Production only at a release point (§9), on her explicit go-ahead, through the Deploy workflow |

Merging to `main` does not deploy to production. No pull request in this sequence has a migration. Whether development may run a branch before merge is not documented; if not, visual changes are previewed after merge and before any production deploy.

### 8.2 What development can and cannot verify

Development has its own database (a restored copy), no AI keys, and read-only media storage.

| Can be verified on development | Cannot be verified there |
|---|---|
| Navigation, sidebar, show links, breadcrumbs | AI-drafted title, brief and beat outline at Start |
| Resume, the active-episode rule, back links | Script generation, per-beat regeneration, line rewrites |
| Home and Overview layout at phone and desktop width | "Surprise Me" pitches; AI season drafts |
| Request counts and browser timings | Footage, photo and thumbnail uploads |
| Pencilling, the slot named before Start, the Start dialog | Teleprompter take saves |
| The slot conflict: rejected, nothing created | Voice Studio work that needs footage or the worker |
| Empty and failure states | Anything behind a switched-off feature flag |

- **Start Episode on development** is expected to complete with the fallback title, since no AI draft is made. This is to be confirmed on the first preview, not assumed.
- **Full end-to-end episode generation is not verified by a development preview.** It may be claimed only after a real test where AI and uploads work, which needs Evoni's separate go-ahead.

---

## 9. Sequence and release points

Every pull request follows the repo's loop (`DEVELOPMENT_WORKFLOW.md`) and the execution rule in §2.4. None has a migration.

### Track 0

| PR | Change |
|---|---|
| 00 | These documents |
| 01 | Tests only: pin today's request counts for Home (with the sidebar) and the Episode Overview |

### R1 — shared episode selection, resume, navigation foundations, request optimization

| PR | Change | Depends on |
|---|---|---|
| 02 | Move `primaryAction`, `checklistSummary`, `useNextSlot` into shared modules; no behaviour change | — |
| 03 | The `activeEpisode` rule, used by Home, Shows, Producer Mode's default, the Editor hub | 02 |
| 04 | Record the last location per episode; remember the show from an episode or the Season page; a soft-deleted episode is treated as not found | 03 |
| 05 | Return to the origin tab from the Overview's event links, the run sheet, Evaluate, Edit details | — |
| 06 | A way back from the Teleprompter; Thumbnail Studio returns to its origin | — |
| 07 | `loadProductionChecks`: parallel reads, accepts data already loaded, returns what it read; identical results | 01 |
| 08 | The episode page shares events, brief and scene sets with the Overview tab and the checklist | 07 |
| 09 | Home uses the shared show rule, asks for its own show's episodes, shares the `/shows` read | 01, 03 |

### R2 — slot-aware planning

| PR | Change | Depends on |
|---|---|---|
| 10 | S1 | — |
| 11 | S4 on the server (§5.3–5.5); inert unless a slot is sent | — |
| 12 | S2 | 10 |
| 13 | S3 and S4 on screen | 10, 11 |

### R3 — Studio Home (only after R2 is live)

| PR | Change | Depends on |
|---|---|---|
| 14 | Extract `NowProducing`; Producer Mode unchanged | 02 |
| 15 | Home layout: header links, secondary section, empty and failure states; no new data | 09 |
| 16 | Home data: Now producing with Resume and Next; Plan next episode; Needs attention | 03, 04, 08, 13, 14, 15 |

### R4 — Episode Command Center

| PR | Change | Depends on |
|---|---|---|
| 17 | Three state lines; the step bar without "Mark Ready" | 08 |
| 18 | Named next action; Resume; "What's ready" | 03, 04, 17 |

### R5 — sidebar and show navigation

| PR | Change | Depends on |
|---|---|---|
| 19 | Sidebar regrouped; show-scoped links; admin-only rows hidden for non-admins | 09 |
| 20 | Current Episode row; the sidebar Teleprompter opens on it | 03, 04, 19 |
| 21 | Show links open the Season page; Producer Mode links; breadcrumbs | 04, 19 |
| 22 | Naming | — |

**Acceptance tests per pull request** are in `docs/reads/2026-11-17-studio-home-refined-plan.md` (Phases 0–3) and §5.5 and §7 here; each pull request restates its own before work starts.

**Rollback:** revert the pull request and deploy again. Nothing is migrated and nothing new is stored on the server, so a revert is complete. Browser keys left behind are inert.

**Priority.** R4 answers the product goal most directly and depends only on R1. It may be brought ahead of R3 if Evoni chooses; R3 is the one that must wait for R2.

---

## 10. Not in this sequence

- Any change to `status`, the controls that write it, or publication.
- Start readiness enforcement (Phase 5, report-only first).
- The publication-confirmation safeguard (its own proposal).
- Retiring or deleting any page; the Complete tab; the LALA workspace; the Event Board; Move/Swap.
- A server-side store for resume; a new endpoint.

## 11. What is preserved

- Existing episodes, seasons, event packages, opportunities, The Pulse content, voice work, scripts and media: no pull request here writes to them. The slot track writes only what pencilling and Start already write, on the ADMIN's action.
- Every ADMIN-only wrapper; no new authorization.
- Every route and legacy redirect.
- Unsaved-work keys in the browser (script draft, wardrobe draft, upload resume, take picks) and `working-episode-id`.

## 12. Still to verify

- Nothing in this plan was run. S4's atomicity is read from `generateEpisodeFromEvent`, `assignOnStart` and the lock-order document.
- Whether the single-episode read returns `deleted_at` to the page (PR 04).
  - **Resolved, 2026-11-18 (PR-04, #3876):** it does. The Episode page treats an episode the read returns marked `deleted_at` as not found; the page's tests cover it.
- Whether a read exposes follow-ups and the last approved story record to the episode page (R4). If not, that part is omitted; no endpoint is added.
- Whether Start on development completes with the fallback title (§8.2).
- Whether the development environment may run a branch before merge.
- Whether responses are compressed by the web server.
- Request counts are exact from source; durations are unmeasured.
- The standing of the blueprint's transition step 1 fixes.

---

## 13. Follow-ups recorded from merged pull requests

Recorded on 2026-11-18. Each item is in the words of its pull request's merge commit. None is scheduled by being listed here; each needs its own approval.

### 13.1 PR-02 (#3874) — shared next action and next slot

- "useNextSlot does not guard against an answer that arrives after its page was left, or an older answer after a newer one (before Studio Home uses it, PR-16)."
- "lib/episodeNextAction imports the checklist component file; check the Episode page's bundle when the Overview uses it (PR-18)."
- "the hook's error log still begins [ShowOverview]."

### 13.2 PR-03 (#3875) — the production episode and the episode to resume

- "the Shows card counts treat an unrecognised status as in production, while Continue does not;"
- "story order uses the episode number alone and ignores the season number;"
- "Home's "In production" line borrows the class of the card's "No episode yet" sentence."

### 13.3 PR-04 (#3876) — the resume location, the show, a deleted episode

- "two windows writing the locations key at once can lose one update (one stale location; nothing else is affected);"
- "the separate episode pages (editor, scene planner, run sheet, evaluate, edit details) still open a deleted episode; the fix is a server change;"
- "a deleted episode's other per-episode keys are left;"
- "nothing uses the saved location yet;"
- "the show is remembered after its read answers, not when the page opens."

### 13.4 Navigation gaps found in PR-05's scope audit

Found on 2026-11-18 while auditing return paths for PR-05. Evoni's ruling of that day: deferred, and not to be included in PR-05.

- Event Package links from the Money, Checklist and Scenes tabs carry no origin, so the package's way back is Season › Events, not the episode.
- The Season Overview's results links ("Episode results") open the Run Sheet and Evaluate, whose way back is the episode, not the Season page.
- The Episodes board and the editor open Edit details, which returns to the Episode Overview, not to where it was opened.
- The script writer's link to the Run Sheet has the same way back.
