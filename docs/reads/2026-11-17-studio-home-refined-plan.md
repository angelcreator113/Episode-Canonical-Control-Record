# Studio Home refined plan — concerns A–F, slot track, Phases 0–3 (2026-11-17)

**Status.** A dated, point-in-time read, preserved as returned to Evoni on 2026-11-17. Nothing in it is implemented. **The authoritative plan is `docs/design/2026-11-studio-home-episode-command-center.md`.** This file is kept for its detail: the per-phase files, the tests each change touches, and the acceptance criteria.

**Basis.** `origin/main` at `8ca49577f544b3e593ae47ff88b7df64068239ab`. Read-only: no code, branch, PR, migration, deploy, database write or AI call was made to produce it.

**Superseded by the plan** (the text below is otherwise as returned):

1. **S4.** This file has S4 create the episode unplaced on a slot mismatch. Evoni's adjustment of 2026-11-17 replaces that: a changed slot **rejects the Start before any episode is created**. The governing behaviour is the plan's §5.3–5.6.
2. **Requests.** The "about 16" and "about 7" additions and the "roughly 33" total are replaced by the plan's §7: goals of ≤ 6 at first paint and ≤ 21 fully loaded, reached by reuse, de-duplication and lazy loading. The Episode Overview's "at most two requests" stands as the added cost of the step bar.
3. **S5.** "A way to move an unfilmed draft episode to another slot" is Move/Swap as already specified in `docs/design/2026-11-season-planning.md`; nothing new is asked.
4. **Numbering.** This file's "Phase 0–3" and item numbers (0.1–0.6) map to the plan's releases R1–R5 and pull requests 00–22 (plan §9).
5. **Sidebar.** The structure in §7 Phase 3 conflicts with the workspace headings of `docs/reads/2026-11-04-navigation-ownership-blueprint.md`; the plan's §3.1 records the conflict and what needs Evoni's confirmation.
6. **"What I need from you" (§8).** Answered on 2026-11-17; the answers are recorded in the plan's §2.

**Evidence.** Five further read-only source traces, one per concern. I re-read these load-bearing points myself: `getEpisode` returns soft-deleted episodes; the "next open slot" queries ignore pencils; `placeEpisodeIn` refuses an already-placed episode; the episode list rows carry `script_content`; a board drop writes the column's status. Nothing was run in a browser. `F/` means `frontend/src/`. ASSUMPTION marks anything not read directly.

**Your seven decisions are taken as fixed** and are built in below.

---

## 1. What changed since the first audit

Four findings that alter the plan:

1. **A wrong slot cannot be undone.** Once an episode starts in a weekly slot, no route moves it. That makes slot choice the one irreversible step in planning, so the slot work moves ahead of Studio Home.
2. **The app names one "next open slot" and Start uses another.** Three places show the earliest slot with no episode; Start skips slots pencilled for other events. The Event Package can say "next open slot is E2" and Start takes E3.
3. **`published` is audience-facing.** It sets The Pulse's "present" for about 30 callers and gates the public Shop the Look pages. Nothing sets it automatically; dragging a card to "Released" on the board does, with no check.
4. **A deleted episode still opens by URL.** The single-episode read does not filter soft-deleted rows, so a saved resume pointer could reopen one. Resume must validate against the list, which does filter.

---

## 2. Concern A — one active-episode and resume behaviour

### Today

Five things each claim to know the current episode, and they disagree when two episodes are in progress:

| Picker | Rule |
|---|---|
| Home `continueEpisode` | latest `updated_at` among unreleased |
| Shows `showActivity().current` | same, no fallback |
| Producer Mode `defaultEpisode` | lowest episode number in production |
| localStorage `working-episode-id` | last episode opened; read only by the Editor hub; never cleared; not per show |
| `currentEpisodeId` in `App.jsx` | last `/episodes/:id` path; passed only to the assistant |

Nothing stores a tab. There is no per-user store on the server (no user, preferences or settings table).

### Proposed rule

One pure function, `activeEpisode({ showId, episodes, pathname })`, in a new `F/utils/activeEpisode.js` shaped like the existing `activeShow.js`. Order:

1. The episode in the URL, if the page is an episode route.
2. The episode remembered **for this show**, if it is still in the show's live list and unfinished.
3. Otherwise the unfinished episode with the latest `updated_at` (today's Home rule), ties broken by lowest episode number.
4. Otherwise none — Home shows "Plan next episode" as the primary card.

"Unfinished" means not archived, not completed (`evaluation_status` accepted) and not `published`. Home, Shows, Producer Mode's default, the sidebar pin and the Editor hub all call this one function.

### Resume

- **What is stored:** for each episode, the last app path visited while working on it, with a timestamp. Stored in localStorage as `primeStudios.episodeLast.<episodeId>`; the per-show pointer is `primeStudios.episode.<showId>`. The old `working-episode-id` keeps being written so nothing that reads it breaks.
- **What counts as a location:** an episode tab (`/episodes/:id?tab=…`), an episode sub-route with the id in the path (`/editor`, `/plan`, `/todo`, `/evaluate`), and `/teleprompter?episode=:id`. Recorded in one place, from the URL, so a tab change the unsaved-script prompt cancelled is never recorded.
- **What is not stored:** scroll, selected beat, the Files Photos/Footage choice, the Overview phone column, editor playhead. These are not in the URL today. Phase 2 accepts losing them.
- **Buttons:** "Resume: <place> · <when>" appears only when a stored location exists and is not the Overview itself. "Next: <action>" (from `primaryAction`) is always shown. Nothing redirects automatically.

### The four cases you named

| Case | Behaviour |
|---|---|
| **Multiple shows** | Pointers are per show. Opening an episode also remembers its show (it does not today), and the Season page remembers its show (it does not today), so the show follows the work. |
| **Multiple browser tabs** | Last write wins. A `storage` listener plus a window event (the pattern `character-places-changed` already uses) updates Home and the sidebar without reload. |
| **Multiple devices** | Independent: each browser has its own memory. A new device falls back to rule 3, so it still names a sensible episode but has no stored tab. Following you across devices needs a server-side store, which means a new table — your decision, not in Phases 0–3. |
| **Missing or deleted episode** | The remembered id is checked against the show's episode list, which excludes deleted rows. If absent, the pointer is forgotten and rule 3 applies. Resume never calls the single-episode read to validate. |
| **Stale saved location** | The stored path must be an app path that belongs to that episode. The tab is passed through the existing `resolveEpisodeTab`, so an unknown or retired tab becomes Overview. A flag-gated tab (Voice) that is now off falls back to Overview. Extra parameters are dropped except `beat` and `line` on the Voice tab. If nothing valid remains, only "Next:" is shown. |

### Fixes this exposes (Phase 0)

- The episode page should treat a soft-deleted episode as not found and clear its pointers. ASSUMPTION: the read returns `deleted_at` to the page; check first.
- Home should use the same show rule as every other page (the show chooser when ambiguous) and fetch episodes for that show only.

### Respected constraints

No server write, so `updated_at` is not disturbed. No page-view logging, in line with your 2026-11-11 ruling.

---

## 3. Concern B — slot-aware planning

### How a slot survives today

| Step | Slot carried? |
|---|---|
| Roadmap "+ Add Episode" → starter | No |
| Starter → new event | No. The event is unplaced. |
| Event Package | Shows its slot if pencilled. If not: "Not placed in the season yet; the next open slot is S1 · E*n*" with a link out. No chooser. |
| Start Episode request | Carries no slot field. |
| After commit, `assignOnStart` | Own pencilled slot → else earliest empty un-pencilled slot → else a bonus special if the season is full → else no slot. |
| Response | Says which slot was taken. The page ignores it and opens the episode. |

**Guaranteed today (tested):** a pencilled event starts in its slot; Start never takes a slot pencilled for a different event; Regenerate keeps its slot.

**Not guaranteed:** you are told the slot before Start; the slot named equals the slot taken; an un-pencilled event's slot is your choice; a wrong slot can be undone.

### Proposed slot track (S1–S5)

| # | Change | Where | Size |
|---|---|---|---|
| **S1** | One definition of "where an unplaced event will land". Make the Event Package's `next_open` and the What's-next "For S1 · E*n*" use Start's own rule (skip slots pencilled for other events). | two server read queries (`eventSeasonContext`, `loadSeasonInputs`) | small, read-only |
| **S2** | Carry the slot. An empty slot's panel gains "Create a new event for this slot" → `/shows/:id/new-episode?slot=N`. The starter keeps the parameter through all five doors and, once the event exists, pencils it into that slot with the existing pencil route, then opens the package. If the slot was taken meanwhile, it says so and leaves the event unplaced. | `SeasonPlan.jsx` slot panel, `SeasonPageRoadmap.jsx`, `NewEpisodeStarter.jsx` | frontend only |
| **S3** | Never start silently. When a season is active and the event is not placed, the existing Start dialog adds a required choice: "Place it first" or "Start in S1 · E*n*". Same line on the Event Library generate and the What's-next overlay. | `useStartEpisode.js`, `eventActions.js`, `EventLibrary.jsx`, `NextEventSuggestionsOverlay.jsx` | frontend only |
| **S4** | Server guarantee. Start accepts an optional expected slot. If the slot it would take differs, it writes no slot and reports it; the episode is then placed by hand from the Roadmap (that explicit route already exists). Callers that send nothing behave exactly as today. After Start the page shows "Placed in S1 · E*n*" or "Not placed — choose a slot". | both Start routes, `generateEpisodeFromEvent`, `assignOnStart` | small backend; no new lock, no migration |
| **S5** | Later, needs a ruling: a way to move an unfilmed draft episode to another slot; pencilling over another event should ask first; a pencil in a non-active season should be honoured or refused. | — | not in this plan |

S4 fails toward "unplaced", which is recoverable, instead of "wrong slot", which is not.

### What Studio Home needs before it launches

Studio Home's "Plan next episode" card names a slot and sends you into planning for it. It must not ship ahead of:

- **S1** — otherwise the card and the package can name different slots.
- **S2** — otherwise the card's promise ("plan E2") is dropped at the starter.
- **S3** — otherwise an unplaced event still starts in a slot nobody chose.

**S4 is strongly recommended in the same release**, because S3 alone is a prompt, not a guarantee: a second tab or a race can still change the pick between the prompt and the write.

If S2–S4 are not approved, the fallback is a Home card that only links to the Roadmap and makes no per-slot promise; S1 and S3 are still required.

**Tests that pin today's slot behaviour** (must be updated deliberately): `seasonPencil.integration` (:187, :204, :267, :282), `lockOrderMatrix` T5–T6, `seasonContext.integration:96`, `seasonFullSpecials.integration` (:142, :517), `episodeGeneratorService.startTransaction` (:239, :254), `seasonTwoReadiness.integration:123`, `EventPackagePage.seasonContext.test.jsx:80`.

---

## 4. Concern C — story state, production progress, release status

### Rule for Phases 0–3

**No stored field changes. No change to who writes `status` or what `published` does.** `stageOf`, the board columns and the status dropdown are left exactly as they are.

### Three meanings, shown separately

The Episode Command Center shows three labelled lines, each derived from fields that already exist:

| Concept | Values | Derived from |
|---|---|---|
| **Story** | Planned · Started · Completed | Planned = a slot with no episode. Started = an episode exists and is not accepted. Completed = `evaluation_status` accepted. |
| **Production** | Brief → Script → Scenes → Filmed → Edited → Thumbnail | The existing seven-step bar (`productionSteps`), unchanged. |
| **Release** | Not released · Released | Released = `status` is `published`, the one value The Pulse and the public pages read. |

### Consumers of `status` (condensed)

| Consumer | Reads | Effect |
|---|---|---|
| `storyClock.presentOrder` (~30 callers) | `published` | The Pulse's "present": which posts, reveals, fits and recap content exist now |
| `styleSheetDistributionService.releasedOn` | `published` | **Public** Shop the Look pages show a look only if its episode is published |
| `pulseFits` | `published` | Fit-of-the-moment images |
| `feedSidebar` | not published / not archived | "Upcoming events" |
| `releaseSchedule` | published, archived | Release Board due and moving rows |
| `seasonFullSpecials` | published | Slot counts as "out" |
| `termsReopenService` | anything but `draft` | Refuses to reopen event terms |
| List, search and query validators | three different stale value sets | `?status=scripted` etc. returns 400 |
| Frontend `stageOf` and its callers | all values | Board, Home, Shows, step bars, release board |

**Writers:** the header dropdown, "Mark Ready", the board drag, creation (always `draft`), a show-wide evaluation reset, and a legacy enqueue that writes `processing`. The server validates none of them. Completing an episode does not write `status`.

`evaluation_status` gates nothing public. It locks place, locations, spending lines, the venue look, the season slot and beat 14.

### Risks of even a relabel (why Phases 0–3 do not touch it)

1. `stageOf` shows a completed draft as "Released" while The Pulse and the public pages treat it as unreleased. Separating them moves cards between columns and changes Home's counts.
2. The board writes what it displays. Renaming "Released" without changing what a drop writes hides the side effect; changing what it writes changes publication.
3. `scheduled` reads as released on the frontend and as unreleased everywhere on the server.
4. The step bar marks Script done from status alone; decoupling makes real episodes regress.
5. Un-publishing is silent and moves the present backwards, leaving later-stamped posts "in the future".
6. Label maps disagree across five files; a relabel must touch all of them.

### One thing to decide separately

A confirmation before any hand action sets `published` ("this moves The Pulse's present and can show a public look"). It changes no meaning, only adds a prompt. Not in Phases 0–3 unless you ask for it.

**Phase 2 consequence:** the seven-step bar comes to the Overview **without** its "Mark Ready" control, so the redesign adds no new place that writes `status`.

---

## 5. Concern D — Start readiness

### Today

| Item | Event Package | Start API | Bulk / What's-next | Regenerate |
|---|---|---|---|---|
| Organizer, category, format, date, invitation | blocks | not checked | not checked | — |
| Name | blocks | cannot be empty (column) | same | — |
| Venue | blocks | warning only | not checked | — |
| Deal prices | blocks | **refuses (409)** | **refuses** | skipped |
| Event already has an episode | hidden | **refuses** | **refuses** | own episode exempt |
| Episode frozen (filmed) | — | **refuses** | **refuses** | separate check |
| Offer decision | dialog | **refuses until decided** | **refuses** | skipped |
| Time, guests, scene set, outfit, dress code, stakes, money | "Start Anyway" dialog | outfit warned; rest not checked | not checked | — |

There are two separate definitions: the client's gate list and the server's readiness service. The package's Start button uses only the client one.

### What actually breaks without each client gate

Nothing hard-fails. Organizer, category, format, date, venue and invitation are editorial: the generator copes (a "Host: Unknown" prompt, a null invitation that can be approved later). The truly load-bearing items are deal prices, "already has an episode" and "frozen" — and the server already refuses on all three. One oddity: the gated venue link is less load-bearing than the ungated scene set, which is what the 14 beats actually need.

### Recommendation

One definition on the server, three tiers, applied identically to every Start caller:

| Tier | Items | Behaviour |
|---|---|---|
| **Block** | already has an episode; frozen; deal prices | Refused, no override. Unchanged from today. |
| **Confirm** | organizer, category, format, date, venue, invitation | Refused once with a list of what is missing; proceeds when the request names the items it accepts. This reuses the existing "needs confirmation" pattern the season placement already has. |
| **Info** | time, guests, scene set, outfit, dress code, stakes, money, unapproved documents | Shown, never refused. |

- **Early planning is not affected.** Creating an event, pencilling it, editing sections, pitches, looks and guests never consult readiness. Only Start does.
- **Existing episodes are not affected.** Regenerate, Part 2, reopening terms and completing never re-run readiness; the new check sits behind the same exemption Regenerate already uses.
- **Why Confirm and not Block for the six:** a hard block is stricter than the code needs, and the integration fixtures start events that carry only a name; they would fail en masse.
- **Rollout without a migration:** report-only first (log what would be asked, refuse nothing), then teach the two shortcut callers to show the confirmation, then enforce.
- **Permissions:** every Start route is sign-in only today. Draft PR #3840's write guard would make them ADMIN-only when enforced. The readiness tiers add no role check of their own.

**This is Phase 5, not Phases 0–3.** The constraint on Phases 0–3 is that they add no new way to start an episode: the Home card links into the Roadmap and the Event Package, and never calls Start.

---

## 6. Concern E — what is preserved

- **Routes:** none removed, none repurposed. `/shows/:id` keeps redirecting to Producer Mode with its old-tab mapping, so saved links and the Asset Library's `?tab=assets` links keep working. Only link targets change.
- **Permissions:** every `AdminOnly` wrapper stays. The Admin row stays admin-filtered. No new authorization. Phase 3 hides two rows from non-admins that already refuse them on arrival.
- **Data:** Phases 0–3 write nothing to the server. The slot track writes only what the existing pencil and Start routes already write.
- **Unfinished work:** the script draft, wardrobe draft, upload-resume and take-pick keys are untouched. `working-episode-id` keeps being written.
- **Pages:** no orphaned page is deleted in Phases 0–3. Consolidation stays a later phase.
- **Episode 1, Season 1, Spring Capsule, Bloom & Brew:** not touched by any phase.

---

## 7. Concern F — implementation-ready proposal

### Order

```
Phase 0  foundations (invisible)
   └─ Slot track S1 → S2 → S3 → S4        ← launch gate for Phase 1
        └─ Phase 1  Studio Home
Phase 2  Episode Command Center            (after Phase 0; independent of the slot track)
Phase 3  Sidebar and show navigation       (after Phases 0 and 2)
```

Each phase is one or more small PRs. None has a migration or a server setting.

### Rollback (all phases)

- Revert the PR and run the Deploy workflow, which snapshots first. Because nothing is migrated and nothing is stored on the server, a revert is complete.
- localStorage keys left behind are inert: the old code never reads them.
- S4 is the only backend change; with no expected slot sent it behaves as today, so reverting the frontend alone also disables it.
- There is no runtime feature switch on the frontend today. I recommend not adding one: it would mean keeping two render paths. Small PRs give the same safety.

---

### Phase 0 — foundations

| # | Change | Files | Tests to update |
|---|---|---|---|
| 0.1 | New `utils/activeEpisode.js` (rule in §2) and a small hook. Home, Shows, Producer Mode's default and the Editor hub call it. | `F/utils/activeEpisode.js` (new), `Home.jsx`, `ShowManagement.jsx`, `Show/ShowOverview.jsx`, `EditorHub.jsx` | `Home.layout.test.jsx:35`, `ShowManagement.test.jsx:129`, `ShowOverview.test.jsx:41` |
| 0.2 | Move `primaryAction` and `checklistSummary` to `F/lib/episodeNextAction.js`; re-export from `ShowOverview.jsx` so existing imports hold. Move `useNextSlot` to its own file. | `ShowOverview.jsx`, new lib file | none expected |
| 0.3 | Record the last location per episode from the URL; remember the show when an episode or the Season page opens. | `App.jsx` (the existing episode-path effect), `EpisodeDetail.jsx` (beside the working-episode effect), `SeasonPage.jsx` | new tests |
| 0.4 | Return to the tab you came from. | see table below | see table below |
| 0.5 | Home uses the shared show rule and fetches episodes for that show only. | `Home.jsx` | `Home.layout.test.jsx:53`, `Home.fixtures.js` |
| 0.6 | A soft-deleted episode is treated as not found; pointers cleared on not-found. | `EpisodeDetail.jsx` | new test |

**Return paths (0.4)**

| Destination | Today | Change |
|---|---|---|
| Overview event links (three) | bare package URL; Back goes to Season › Events | use the existing `packageHref` with the episode as origin, as the page header already does |
| Teleprompter | no way back | callers pass the origin; default back to the episode's Script tab when an episode is in the URL |
| Run Sheet (`/todo`) | back to Overview | honour an origin; default Checklist |
| Evaluate | back to Overview | honour an origin; default Checklist |
| Thumbnail Studio | back to Overview or Scenes | optional origin in `thumbnailStudioHref` |
| Edit details (`/edit`) | back to Overview | honour an origin |

The generic pattern already exists for Scene Sets (`from` + `fromLabel`, guarded by `isAppPath`); these reuse it.

Tests: `EpisodeOverviewTab.summary.test.jsx` (:69, :75, :102), `.termsLock.test.jsx:74`, `YouTubeThumbnailStudio.test.jsx` (:463, :1190), `EvaluateEpisode.complete.test.jsx`. Note: fixtures use ids like `ep-1`, which the origin parser rejects as non-UUID, so new tests need UUID fixtures.

**Acceptance**
- With two unfinished episodes, Home, Shows, Producer Mode and the Editor hub name the same one.
- From each of the six destinations above, one click returns to the tab it was opened from.
- A remembered episode that has been deleted is never offered.
- Home with two shows and nothing remembered asks which show.

**Risk:** low. No visible layout change.

---

### Slot track — S1 to S4

Scope and files are in §3.

**Acceptance**
- The slot named on the Event Package, on What's-next and in the Start dialog equals the slot Start takes, including when earlier slots are pencilled for other events.
- "Create a new event for this slot" from slot N, through any of the five starter doors, ends with the event pencilled in slot N.
- Starting an unplaced event always shows the slot it will take and requires a choice.
- With S4: if the expected slot is taken between the prompt and the write, the episode is created unplaced and the page says so. It is never placed in a different slot.
- A pencilled event still starts in its slot; Regenerate still keeps its slot.

**Risk:** medium. S4 touches the Start service; it adds no lock and is inert unless a slot is sent. The pinned tests in §3 change deliberately.

---

### Phase 1 — Studio Home (reuses `Home.jsx`)

**Layout, top to bottom**

| # | Section | Built from |
|---|---|---|
| 1 | **Show header** — show name, "Season 1 · *n* of 24 planned", links "Season Roadmap" and "Producer Mode" | existing hero; `seasonStats`; `useActiveShow` |
| 2 | **Now producing** — episode code and title, the three state lines (§4), "*n* of *m* checks", **Resume** and **Next: <action>**, "Open episode" | `NowProducing` extracted from `ShowOverview.jsx` into its own file; `primaryAction`; `activeEpisode` |
| 3 | **Plan next episode** — next slot, its story purpose, its pencilled event if any → Roadmap with that slot open | `useNextSlot`; `seasonPageHref(showId, 'roadmap', { slot })` (the Season page already opens a slot from the URL) |
| 4 | **Needs attention** — season attention items, then the existing To-Do card | `SeasonAttentionDigest` fed by `update.seasons`, which Home already loads; existing `Todo` |
| 5 | **Coming up** — the upcoming event card | existing |
| 6 | **Studio numbers** — AI budget | existing `Numbers`, AI card |
| 7 | **In the LalaVerse** (secondary) — tiles The Cast, Map, Lala's Bank, Shop, The Pulse; Trending; Lala's Journey; Shop the Look; the show's money | existing sections, moved; all eight tile test ids kept |

Production tiles (Episodes, Closet, Style Page) stay near the top.

**Empty and failure states**
- No show → "Create your first show".
- No season → "Set up Season 1" (links to the Season page, which already shows the setup form).
- No episode → "Plan next episode" becomes the primary card.
- A failed read says it failed and offers Retry.

**Navigation behaviour**
- "Resume" → the stored location, validated per §2.
- "Next:" → the `primaryAction` target. First paint uses the light form (script or no script, from the list row, which carries `script_content`); the checklist-based target fills in after.
- "Plan next episode" → Roadmap with the slot open. It never calls Start.

**Cost to be aware of:** Home makes 10 requests today. The full next action adds about 16 for the one active episode, and season attention about 7. Both load after first paint. A single server summary would remove this, but that is a new endpoint and is not proposed here.

**Tests:** `Home.layout.test.jsx` pins test ids, link names and strings, not section order, so moving sections is mostly safe. `Home.fixtures.js` needs the new URLs. `ShowOverview.nowProducing.test.jsx` pins the extracted card's ids and must keep passing. CSS: `.hp-trio` and `.hp-pair` grid rules change; new CSS uses tokens only.

**Acceptance**
- At 375px, without scrolling past the second card: the show, the current episode, Resume or Next, and the next slot.
- Resume opens the last tab used on that episode in this browser; on a fresh browser only Next is shown.
- Every game-facing card is still reachable, in the secondary section.
- A non-admin sees no attention block and no errors.
- No new request fires an AI call.

**Risk:** medium (visual, test updates). **Depends on:** Phase 0 and S1–S3.

---

### Phase 2 — Episode Command Center (enhances the Overview tab)

Route unchanged: `/episodes/:id?tab=overview`.

**Layout**

| # | Section | Built from |
|---|---|---|
| 1 | **Identity and the three state lines** | existing header; §4 derivations |
| 2 | **Progress** — the seven-step bar, without "Mark Ready" | `EpisodeProductionHeader`, already loaded data; one condition change in `EpisodeDetail.jsx` plus a prop to hide the control |
| 3 | **Resume and Next action** | `NextStepBanner` fed by `primaryAction` (so it names the section, e.g. "Continue: Wardrobe") plus the Resume button; stays inside `.eov-top` with the tiles |
| 4 | **What's ready** — complete · missing · optional · blocked | the checklist sections the page shell already loads. "Blocked" = setup steps that did not finish, Voice or Edit switched off, render not built |
| 5 | **Connected** — event package, place, cast, look, season slot | existing `FromEventCard`, Events card, Season position; links now return to the episode |
| 6 | **Reference** — brief, teaser, stakes, money, style board | existing, below |

**From earlier episodes:** the slot's story purpose is already on the page. Showing open follow-ups and the last approved story record depends on whether a read endpoint exposes them to the page — ASSUMPTION, to check at the start of this phase. If not, it is omitted; no endpoint is added.

**Constraints from existing tests**
- `EpisodeOverviewTab.layout.test.jsx` requires the next-step banner's parent to be exactly `eov-top` and to contain the tiles, and requires the text "Producer Mode" to be **absent** from the Overview. So the route to Producer Mode lives in the sidebar and Home, not here.
- The same test pins the 768px phone-column CSS rule.
- `EpisodeOverviewTab.summary.test.jsx` pins the next-step text and tab; it changes with the banner.

**Acceptance**
- Opening Episode 1 shows three separate lines for story, production and release, and one named next action.
- Home, Producer Mode and the episode show the same next action for the same episode.
- Resume returns to the last tab; a cancelled unsaved-script prompt is not recorded.
- The Overview adds no control that writes `status`.
- Overview adds at most two requests (clips and thumbnail for the bar).

**Risk:** medium. **Depends on:** Phase 0.

---

### Phase 3 — sidebar and show navigation

**Structure**

```
Home
▸ Current Episode   S1 · E1 · title        → Resume target; hidden when none
PRODUCE
  Season Roadmap                            → Season page, Roadmap   (active show)
  Episodes                                  → Season page, Episodes
  Events & Opportunities                    → Season page, Events
  Editor                                    → /studio/editor
  Teleprompter                              → /teleprompter?episode=<current>
FRANCHISE
  Shows                                     → /shows
     <show>                                 → /shows/:id/season
     + New Show
  LalaVerse                                 → /universe
  Characters                                (hidden for non-admins)
  Relationships                             (hidden for non-admins)
  The Pulse                                 → /pulse
WRITE
  Stories  (Threads · Story Calendar · Story Evaluation)
  Writing desk                              → /start
STUDIO
  Assets · Scene Sets · Wardrobe · Templates
Search · Settings · Admin
```

**Show navigation (your decision 7)**
- Sidebar show rows and "Open Show" on the Shows page go to `/shows/:id/season`. The Shows card gains a second link, "Producer Mode".
- The Season page already has a link to Producer Mode (`szn-back`); it is relabelled from a back link to a peer link. Producer Mode already has a "Season" entry.
- Breadcrumbs stop nesting Season under Producer Mode.
- Other links that still land in Producer Mode are pointed at the Season page too: the episode's show pill, Create Show, Edit Show back, Show Settings back, the editor crumb.
- The `/shows/:id` redirect itself is left alone (§6).
- The sidebar's active row is computed from the current show id, since the link no longer prefixes Producer Mode or event URLs.
- The Season page with no season is a safe landing: it already shows the setup form.

**Show-scoped rows** are built from the active show; with none, they go to the show chooser, as `/universe/production` already does.

**The Pulse and LalaVerse naming**
- Change four leftover "feed" strings to The Pulse wording (Season overview, Season threads, "Feed tone", the event dashboard).
- Breadcrumb "Universe" → "LalaVerse".
- Keep "Lala's posts" (her own posts inside a show), "JustAWoman's Feed" (the real-world layer) and "Phone" as they are: they are different things.

**Also:** the Stories group expands on its own children.

**Tests:** `Sidebar.worldZone.test.jsx` pins LalaVerse → Characters → Relationships → The Pulse in one zone, in that order; the structure above keeps it. `Sidebar.activeShow.test.jsx:41`, `ShowManagement.test.jsx:96`, `EpisodeDetail.studio.test.jsx:137` pin `/shows/:id` and change. `Sidebar.adminRow`, `.loadFailed`, `.theme` are unaffected.

**Acceptance**
- Season Roadmap, Episodes, Events, Scene Sets and Wardrobe are each one click from the sidebar.
- Clicking a show opens its Season page; Producer Mode is one further click from there, from Home and from the Shows card.
- The Current Episode row matches Home, updates when another tab opens a different episode, and disappears when there is none.
- No sidebar row leads a non-admin to a refusal.
- An old `/shows/:id?tab=assets` link still lands on Scene Sets.
- The drawer works at 375px.

**Risk:** low to medium. **Depends on:** Phases 0 and 2.

---

## 8. What I need from you

**Approve or adjust**

1. **Resume memory lives in this browser only.** Following you across devices needs a new table. Recommendation: browser-only for Phases 0–3.
2. **The slot track (S1–S4) ships before Studio Home.** Recommendation: yes, all four. S4 is the only backend change in this plan.
3. **Phases 0–3 leave `status` and the board exactly as they are,** and show the three meanings as separate lines. Recommendation: yes.
4. **Start readiness tiers (Block / Confirm / Info) are Phase 5,** rolled out report-only first. Recommendation: yes; nothing in Phases 0–3 depends on it.
5. **Links that open a show go to the Season page, and the `/shows/:id` redirect stays as it is.** Recommendation: yes.

**Decide separately, not blocking**

6. A confirmation before any hand action sets `published`.
7. A way to move an unfilmed draft episode to another slot (S5).

## 9. Still to verify at the start of implementation

- Whether the single-episode read returns `deleted_at` to the page (0.6).
- Whether a read endpoint exposes follow-ups and the last story record to the episode page (Phase 2).
- Whether WorldAdmin tests pin the "Lala's posts" label (not being changed, but check).
- Behaviour of the teleprompter reader when the saved beat no longer exists.
- The contents of draft PR #3840 beyond its guard and manifest files.
