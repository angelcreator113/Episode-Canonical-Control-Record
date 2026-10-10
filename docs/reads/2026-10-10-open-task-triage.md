# Read: triage of the open claude-task issues

- **Basis:** `origin/main` at `babd933fbf9c35d5e5daf012d4b10a79da6cca15` (#2850). Code citations name the file and function; line numbers, where given, are at this SHA.
- **Date:** 2026-10-10
- **Task:** #2853
- **Scope:** the 24 open `claude-task` issues with no merged PR, from the 2026-10-10 close-loop sweep. At this basis the open `claude-task` set is these 24, plus #2396 (kept open for the gpt-image-1.5 size check) and #2853 (this task). The set is unchanged.
- **Method:** each issue's body and comments were read, then the code and docs it names were checked at the basis, and merged PRs were searched by key terms. The claims below were re-checked by hand at the basis before filing (spot checks: §5).
- **What this read does not do:** it closes, comments on or edits no issue, changes no code, and touches nothing under `docs/audit/`. It makes no host, AWS, database or Cognito contact.

Markers: **MEASURED** means read in the repo at the basis, or read from GitHub. **INFERRED** means concluded from measured facts, with the reason given.

**Locked sequence (Path A)** (`PROJECT_CONTEXT.md` §6.1): F-AUTH-1 → F-Deploy-1 → F-App-1 → F-Stats-1 Phase B → F-Ward-1 → **F-Reg-2** → F-Ward-3 → F-Franchise-1 → F-Sec-3. The current position is F-Reg-2. `docs/audit/F-Reg-2_Fix_Plan_v1.3.md` R2 makes O-a, O-c and O-d next. **None of the 24 issues is that next step.** A waiver is recorded on each issue's own Guardrails box ("explicitly waived by Evoni"), or as a ruling Evoni made; where an issue relies on a ruling instead of a ticked box, it says so.

---

## §0 Summary

| # | Issue | Status | Sequence | Size |
|---|---|---|---|---|
| 1316 | re-verify route-shadowing six (FD-70) | **Superseded** (#1406) | Inside (F-AUTH-1), ticked | none |
| 1347 | `check-root-junk.js` untracked scope | **Superseded** (#1349) | Tooling, outside, ticked | none |
| 1453 | read: unreachable exports, shadowed routes | **Superseded** (#1454's sweep) | Outside, **unticked** | none |
| 1777 | read: what goes if the old event editor goes | **Superseded** (#1779) | Outside, waived (ticked) | none |
| 1927 | extract `PhoneShell` | **Superseded** (rule 16, #1985/#1991/#1995) | Doctrine rule 16 | none |
| 1928 | Episode Phone tab two-pane | **Superseded in core** (#1995); small residue | Doctrine rules 10, 16 | residue: 1 small PR |
| 1907 | Episode Wardrobe workspace | **Largely superseded** (#2219, #2648, #2717); small residue | No box | residue: 1 small PR |
| 1536 | file 2026-09-17/18 session-conduct record | Still needed | Inside / waived 2026-09-18 (ticked) | 1 PR, 1 file |
| 1916 | editing an episode overwrites an arbitrary event | Still needed | No box: needs a waiver | 1 PR |
| 1919 | Net P&L counts the whole closet | Still needed (spread to a 3rd caller) | No box: needs a waiver | split in 2 |
| 1917 | interface and engine read the same event | Still needed, ruled (§8(w) P2), partly done | P2 ruling (no box) | split in 3 |
| 1902 | raw streams renew an expired token | Still needed | No sequence line: needs a waiver | split in 2 |
| 2295 | phone shows the one task list (beat 9) | Still needed | No box: needs a waiver | 1 PR |
| 2746 | read: Feed page wiring | Still needed (gates the feed series) | Box **unticked** | 1 PR (doc) |
| 2747 | Lala's profile reads real data | Still needed | Box unticked | 1 PR |
| 2748 | Share saves a draft with story time | Partly superseded (backend done) | Box unticked | 1 PR |
| 2750 | Upcoming Events / People You May Know | Still needed | Box unticked | 1 PR, may split |
| 2761 | one home for making feed profiles | Still needed | Box unticked | split in 2 |
| 2749 | episode-complete posts in Requests | Partly superseded; **blocked** | Box unticked | 1 PR |
| 1921 | `generate-thumbnails` 500s every call | Still needed; **blocked** after the report | No box | 1 PR |
| 1918 | decide: multi-event episodes | Still needed; **blocked** | No box | 1 PR |
| 2266 | orphan `character_state` row cleanup | Still needed; **blocked** after the read | No box (D1 follow-on) | read 1 PR; cleanup 1 PR |
| 2200 | F-Reg-2 group 2: `characterGrowthRoute.js` | **Blocked** (moot as asked) | Inside, ticked; parked by v1.3 | depends on ruling |
| 2208 | F-Reg-2 group 2: `registrySyncService.js` | **Blocked** on the registry build | Inside, ticked; parked by v1.3 | 1 PR once unblocked |

Counts: 7 superseded or largely superseded; 11 still needed and agent-doable (some only after a waiver); 6 blocked.

---

## §1 Superseded: candidates to close

**#1316 re-verify the route-shadowing survey's six dead declarations.** **Superseded (MEASURED)** by `docs/audit/F-AUTH-1_RouteShadowing_Reverification_2026-09-13.md` (commit `7259857f`, PR #1406, `Task: #1405`), filed under a different number than the issue specified.
- It re-reads all six, with each pair's auth middleware pasted.
- Its §5 confirms the FD tail is still FD-69 and that minting FD-70 is Evoni's.
- **Gap (MEASURED):** it doesn't name the three dispositions (mint, decline, defer). The FD-70 decision is still open (decision D8).

Sequence: inside (F-AUTH-1, item 10-B), ticked. Dependencies: feeds FD-70; related to #1453.

**#1347 `check-root-junk.js` scope for untracked files.** **Superseded (MEASURED)** by PR #1349 (`0a0ff3ed`, issue #1348). It chose an opt-in `--untracked` mode instead of widening the default scan; the header comment of `scripts/check-root-junk.js` records why. `.githooks/pre-push` runs `--untracked`; `.githooks/pre-commit` and `/validate` run the default. Sequence: tooling, outside the sequence, ticked. Dependencies: none.

**#1453 read for unreachable exports and shadowed route registrations.** **Superseded (MEASURED)** by `docs/audit/F-Tools-1_UnreachedExportsSweep_2026-09-15.md` (commit `e01d6faf`, Task #1454). The sweep covers:
- §2: the five known cases.
- §3–§7: the export tiers.
- §8: the duplicate registrations (`compositions.js` `PUT /:id`; `thumbnails.js` `GET /episode/:episodeId`).
- §9: counts.
- §10: says #1453's own session produced no report.

The duplicates are still in code, which is expected: it was a read. Sequence: outside the sequence, box **unticked**. Dependencies: none.

**#1777 read what would be lost if the old event editor went.** **Superseded (MEASURED).** `docs/EVENT_EDITOR_REMOVAL_READ.md` exists. It was merged by PR #1779 (commit `1dde24d2`, `Task: #1778`, a duplicate issue) and covers every acceptance item. Sequence: outside the sequence, waived (ticked). Dependencies: none open.

**#1927 extract `PhoneShell` from `PhonePreviewMode`.** **Superseded (MEASURED).** Doctrine rule 16 (`docs/DESIGN_DOCTRINE.md`, Evoni, 2026-09-26) chose option C of `docs/PHONE_RENDERER_READ.md` §6 instead:
- #1985: `PhoneDevice` extracted.
- #1991: `PhonePreviewMode` draws through `components/phone/PhoneDevice.jsx`, which mounts `PhoneFrame` and `ScreenContentRenderer`.
- #1995: the embedded mode.

No `PhoneShell` exists, and none is needed. Sequence: covered by rule 16. Dependencies: none outstanding.

**#1928 Episode Phone tab as a two-pane workspace.** **Superseded in core (MEASURED)** by #1995. `EpisodeLalasPhoneTab` shows the embedded `PhonePreviewMode` beside a rail whose rows set the shown screen (`setShownId`). It keeps the "Requirements appear once beats exist" notice, the missions section and the stacking at 375px.
- **Residue (MEASURED):** feed-moment rows don't navigate to their `phone_screen_type`, and "Generate" opens a generic studio path.
- **INFERRED:** the by-beat rail now belongs to §8(w) P8 and the beat-level phone work (#2790, #2801), so a fresh, smaller issue fits better than this one.

Sequence: doctrine rules 10 and 16. Size of the residue: one PR, 2 files or fewer.

**#1907 Episode Wardrobe as a workspace.** **Largely superseded (MEASURED each piece; "largely" is INFERRED):**
- `EpisodeWardrobeTab.jsx` is deleted (#2219).
- The event's look card with "Start from the event's look" is in `EpisodeWardrobeGameplay.jsx` (#2717).
- Slot rows, empty slots, the dress-code pool and an open closet were added (#2648; also #2652, #2716, #2775, #2792).
- The hold (#1924) is done (#1929).

**Not done (MEASURED):**
- no "not chosen" label;
- no `PUT /episodes/:id/wardrobe-slots/:slot` route;
- the step-1 canonical-home report.

The local branch `claude/issue-1907-episode-wardrobe-workspace` is stale against all of this. Sequence: no box. Residue: one small PR, if still wanted.

---

## §2 Still needed, agent-doable

**#1536 file the 2026-09-17/18 session-conduct record.** **Still needed (MEASURED).** `docs/audit/` has session-conduct notes for 09-06, 09-11, 09-12, 09-13, 09-17 and 09-19, but none for 09-18. The 09-19 note covers other items. All 15 excerpts the record needs are in the issue's 2026-09-19 comments. Sequence: inside / waived 2026-09-18 (register hygiene), ticked; the same waiver is cited in `F-AUTH-1_SessionConduct_2026-09-19.md`. Dependencies: none. Size: one PR, one new file under `docs/audit/` (through `/audit-file`).

**#1916 editing an episode picks, then overwrites, an arbitrary event.** **Still needed (MEASURED).** In `QuickEpisodeCreator.jsx` (mounted at `/episodes/:episodeId/edit`), the edit-load effect still falls back to `events[0]`. On save it `PUT`s that event inside `catch { /* event update failed — not fatal */ }`. The episode→event route it needs exists (`episodes.js` `GET /:id/events`, from #1906/#1913).
- **INFERRED:** this is the riskiest open item. It silently edits an unrelated event, and the swallowed error hides it.

Sequence: no box. A bug fix outside Path A, so it needs a waiver unless decision D1 exempts fixes. Dependencies: #1913 (done); related to #1917. Size: one PR (component, tests).

**#1919 an episode's Net P&L counts the whole closet as its outfit cost.** **Still needed, and spread (MEASURED).**
- `episodeGeneratorService.js` `loadFinancialWardrobeItems` still selects the whole show's wardrobe, and `calculateFinancials` sums it.
- `worldEvents.js` repeats the query inline, followed by an empty `catch {}`.
- `termsReopenService.planTermsRebuild` (#2383) now also calls `calculateFinancials`.
- The Money tab is already honest: `episodeMoneyService.lookPlan` prices the chosen look (#2662). The Overview isn't: `EpisodeOverviewTab` uses `episode.total_expenses` for "Coins after episode". `EpisodeCard`, `ShowInsightsTab`, the WorldAdmin blueprint and `EpisodeTodoPage` read the same column.

Sequence: no box; needs a waiver. Dependencies: the chosen look (#2775/#2780). No backfill (Evoni's call). Size: split in two.
- **PR 1, backend:** the generator helper, the `worldEvents` route and `termsReopenService` price the chosen look, plus a test.
- **PR 2, frontend:** the Overview reads the Money plan, plus a test.

**#1917 the interface and the story engine read the same event.** **Still needed, partly done, no longer blocked (MEASURED).** The ruling the issue waited for exists: §8(w) P2 (`docs/EVENT_EPISODE_FLOW.md`, PR #2209) makes `episode_briefs.event_id` canonical, which is option (a).
- **Done:** frontend readers in #2539. `episodeScriptWriterService`, `episodeLookbookService` and `styleSheetService` use `episodeEventsService`.
- **Not done:** 26 backend sites still run `WHERE used_in_episode_id = :episodeId` (count MEASURED by grep). They include `evaluation.js`, `careerPipelineService`, `groundedScriptGeneratorService`, `financialTransactionService`, `scenePlannerService`, `todoListService`, `storyGenerationService` and `distributionService`. The WorldAdmin reassign paths don't update the brief.

Sequence: covered by the §8(w) P2 ruling (INFERRED as a waiver; the issue has no box). Dependencies: #1913 (done); #1918's ruling decides how extra events are handled. Size: split in three.
- **PR 1:** evaluation, completion, career and finance.
- **PR 2:** script, story, scene, distribution and feed.
- **PR 3:** todo and wardrobe, WorldAdmin reassign updating the brief, and the service-list test.

**#1902 raw stream requests renew an expired token once.** **Still needed (MEASURED).**
- There is no `authedFetch` (`frontend/src/utils/` has only `authToken.js` and `authedEventStream.js`).
- `api.js` `refreshAccessToken` and `wipeSessionAndRedirect` are module-private, with no single-flight promise.
- Raw `fetch` remains in `AppAssistant`, `WriteModeAIWriter` and `WriteMode` (two sites).
- `authedEventStream` treats 401/403 as terminal.

Evoni's design ruling (a) is in the body. Sequence: no sequence line; needs a waiver. Dependencies: builds on #1896/#1900. Size: about 8 files plus tests, so split in two.
- **PR 1:** `authedFetch`, the single-flight refresh and exported wipe in `api.js`, `authedEventStream`, and the core tests.
- **PR 2:** move the callers, add the `BookEditor` keepalive comment, and update the #1896/#1900 tests.

**#2295 the phone shows the episode's one task list (beat 9).** **Still needed (MEASURED).** `ScreenContentRenderer.jsx` has no task-list content type. `TODO_LIST` appears only in `canonicalBeats.js`, `todoListService.js` and `iconCueGeneratorService.js`. Its prerequisite #2294 shipped (#2297). Sequence: no box; `EVENT_EPISODE_FLOW.md` §8(bb) calls it "a later slice", which isn't a waiver. Dependencies: #2294 (done). Size: one PR (renderer case, beat-9 placement, test). If the phone needs a new episode-scoped read route, split it out first.

### The feed series (#2746–#2750, #2761)

All six have the same Guardrails box, "Inside the locked sequence / explicitly waived by Evoni", **unticked** (MEASURED). No waiver was found in comments (there are none), `docs/FEED_POSTS.md`, `DESIGN_DOCTRINE.md` or `PROJECT_CONTEXT.md`. The Feed project PRs Evoni merged on 2026-10-04 (#2595–#2604) are precedent, not a cited waiver (INFERRED). No merged PR since 2026-10-07 covers any of the six asks (MEASURED, search).

**#2746 read: wiring of the Feed page.** **Still needed (MEASURED):** no feed read exists in `docs/reads/`. The issue's five questions (a–e) were answered from the code during this triage, so the read can be short:
- (a) `feed_posts.story_order` exists, migration `20261004180000-feed-posts-story-order`.
- (b) `feedPostGeneratorService` writes drafts tagged with `episode_id`, and `feedPostStatus.publishEpisodePosts` sets them live.
- (c) The link is `registry_characters.feed_profile_id`, read via `utils/registryLink.js` (#2744).
- (d) `relationship_status` exists on `SocialProfile` and `RegistryCharacter`.
- (e) The home city is `shows.metadata.lala_home`, served by `GET /shows/:id/lala-home`.

Dependencies: none; the other five depend on it. Size: one PR, one doc.

**#2747 Lala's profile reads real data.** **Still needed (MEASURED)** in `SocialMediaPage.jsx` `Wall`:
- the placeholders come from the social profile (`owner.city`, `owner.content_category`);
- `loadSides` never calls `/shows/:id/lala-home`;
- friends are the first 12 lalaverse profiles, not linked ones (already clickable via `peopleLink`).

The career-level source is `utils/careerTiers.js` `careerTierFromReputation` (INFERRED). Dependencies: #2746; must not touch `characterRegistry.js` (F-Reg-2). Size: one PR.

**#2748 Share saves a draft stamped with story time.** **Partly superseded (MEASURED).** The backend is done:
- draft/live status (#2596, `feedPostStatus.js`);
- `story_order` stamped on `POST /feed-posts` (#2604);
- soft delete with `/deleted` and `/:id/restore`;
- Release via `PUT { status: 'live' }`;
- the Drafts tab and the Requests count exist.

**Still needed, frontend only:**
- `Wall.share` sends `status: 'live'`;
- the hint text;
- Edit/Release/Delete on draft cards;
- showing deleted posts.

`FEED_POSTS.md` rule 1 ("posts as Lala, live") must be amended. INFERRED: the new issue overrides it. Dependencies: #2746. #2749 depends on this one. Size: one PR.

**#2749 episode-complete posts land in Requests for approval.** **Partly superseded, blocked (MEASURED).** The generator already writes drafts with `episode_id`. The Requests box reads `/feed-posts/comments/pending` (comment drafts, not posts) and has no per-draft Approve/Edit/Discard.
- **Blocked:** `publishEpisodePosts` (called from `episodeController.updateEpisode`) sets every draft live when the episode is published. That contradicts "nothing reaches the Wall until approved" (decision D3).
- **Also blocked:** "reactions" already means comment drafts, so the naming needs a ruling.

Dependencies: #2746, #2748 and D3. Size: one PR.

**#2750 Upcoming Events and People You May Know read real data.** **Still needed (MEASURED).** Upcoming Events reads the cultural calendar (`calendarRoutes.js` `GET /events`, `StoryCalendarEvent`), not the `world_events` tied to Lala's episodes. People You May Know is `friends.slice(6, 8)`. Guest profiles live in the automation's `guest_profiles`. Dependencies: #2746, and #2747's definition of "friends". Size: about 400 lines, so it may split.
- **(a)** A read route plus Upcoming Events.
- **(b)** People You May Know from guest lists.

**#2761 one home for making feed profiles.** **Still needed (MEASURED).** The generator is mounted in three places: `SocialMediaPage.jsx`, `WorldStudio.jsx` (layer locked to `real_world`, so the switcher is hidden) and `NewEpisodeStarter.jsx`. There's no "Profile name" label; the default name comes via `registryLink.linkedCharacter` (#2744). Dependencies: #2746; it interacts with #2747, since both change where friends and profile links point. Size: borderline (`WorldStudio.jsx` and `SocialProfileGenerator.jsx` are large), so split in two.
- **(a)** Mounts, the layer switch and the Friends empty state.
- **(b)** The "Profile name" label and default, and `@handle`.

---

## §3 Blocked

**#1921 `POST /compositions/:id/generate-thumbnails` 500s on every call.** **Still needed (MEASURED).** In `compositions.js`, `s3Client` starts `null` and is set only inside `getS3Client()`. The handler checks `if (!s3Client)` and returns 500 before anything calls `getS3Client()`. No merged PR touches it. The report step is agent-doable; the fix is **blocked** on Evoni's choice between (a) fixing it with `await getS3Client()` and (b) retiring it in favour of `/:id/outputs/generate` (decision D4). Sequence: no box; a fix outside Path A. Size: one PR (route and test).

**#1918 decide: are multi-event episodes wanted?** **Still needed (MEASURED).**
- The unique index `world_events_used_in_episode_unique` is still in migration `20260805000000`.
- `worldEvents.js` still collects extras into `skipped_extras`.
- The UI shows a brief "(N skipped)" toast, then navigates away.
- `EpisodeOverviewTab` still offers "+ Link an event…".
- No ruling on multi-event was found; §8(w) P2 rules only on the anchor.

The report and the visibility notice are agent-doable; the substance is **blocked** on D5. Dependencies: the ruling feeds #1917's handling of extras. Size: one PR.

**#2266 clean up the orphan `character_state` row `ae018fad`.** **Still needed (MEASURED).**
- No PR or migration touches the row; it is recorded in `docs/audit/F-Stats-1_D1_ReconciliationRead_2026-09-29.md`.
- `evaluation.js` now refuses to create a lala row for a missing show, which is how such rows were made.
- `CharacterState` isn't paranoid, so the cleanup options must be explicit.

The read and option proposal are agent work. The delete or update itself is a database action: Evoni's own, or a migration run through the Deploy workflow. **Blocked** on her choice (D7). Sequence: no box. INFERRED: sanctioned as a D1 follow-on by her 2026-09-29 ruling ("file a separate cleanup issue"); confirm. Size: read, one PR; cleanup, one PR.

**#2200 F-Reg-2 fix group 2: `characterGrowthRoute.js` (row 12).** **Blocked; the asked fix is moot (MEASURED).** Labels: `claude-task, blocked`. The route 500s on an invalid enum status, and `SILENT_FIELDS` maps to no column, so no SQL runs. Evoni, 2026-09-28: row 12 is moot and conflicts with doctrine rule 14, so it "waits for a product decision (retire the route, or rebuild it as suggestions)". `F-Reg-2_Fix_Plan_v1.3.md` R1 records it as moot. **Blocked** on D6.
- Retiring it reaches `GET /character-growth/flagged` (StoryDashboard, StoryProposer) and `POST /:id/review`.

Sequence: inside (F-Reg-2 v1.2 R2), ticked; parked by v1.3. Size: a retire PR is about 3–4 files; a rebuild should be split backend/frontend.

**#2208 F-Reg-2 fix group 2: `registrySyncService.js` (row 74).** **Blocked on the registry build (MEASURED).** Labels: `claude-task, blocked`. The write site is unreachable: `social_profiles.registry_character_id` is an integer, but `findByPk` takes a UUID. Evoni, 2026-09-28: it unblocks when the sync is re-pointed to `registry_characters.feed_profile_id` (Character Registry ruling C3, #2190). `v1.3` R1 records it as blocked. INFERRED: that re-point belongs to the registry build, later in the sequence. Nothing for Evoni to decide now. Size: one PR once unblocked (1 file and a test).

---

## §4 Proposed order

0. **Close what's done** (decision D10): #1316, #1347, #1453, #1777, #1927. Optionally also #1907 and #1928, each replaced by a small residue issue if you still want the residue.
1. **The locked sequence comes first.** Path A's next work is F-Reg-2 O-a, O-c and O-d (`F-Reg-2_Fix_Plan_v1.3.md` R2). None of these 24 is that work, so everything below runs beside it or after it, under a waiver.
2. **#1536.** Already waived; one register file.
3. **Data-correctness fixes**, once D1 allows them:
   1. **#1916** first: a silent overwrite of an unrelated event.
   2. **#1919**, two PRs: money shown wrong.
   3. **#1917**, three PRs: ruled; makes every reader use the canonical event.
   4. **#1902**, two PRs: session expiry in long AI streams.
4. **The feed series**, once D2 is given:
   1. #2746, the read.
   2. #2761(a) and #2747. Do them together or one after the other: same friends and links.
   3. #2761(b).
   4. #2748.
   5. #2750.
   6. #2749 after D3.
5. **#2295** (phone task list), after D9.
6. **Decision-gated items**, as each decision lands:
   - #1921 (D4), #1918 (D5), #2266 (D7), #2200 (D6).
   - #2208 waits on the registry build.

Reports that need no decision first (the step-1 reads of #1921, #1918 and #2266) can go any time they're waived.

---

## §5 Decisions only Evoni can make

| ID | Decision | Unblocks |
|---|---|---|
| D1 | Are bug fixes outside Path A allowed without a per-issue waiver, or does each need its box ticked? | #1916, #1919, #1902, #1921; #1917 if P2 isn't taken as one |
| D2 | Waive the feed series: tick the box on #2746, #2747, #2748, #2749, #2750 and #2761 | the feed series |
| D3 | Does publishing an episode still release its drafted posts automatically (`publishEpisodePosts`), or do they wait for approval? And what is the Requests label, since "reactions" already means comment drafts? | #2749 |
| D4 | `generate-thumbnails`: (a) fix, or (b) retire in favour of `/:id/outputs/generate` | #1921 |
| D5 | Multi-event episodes: (a) drop the index, (b) add an `episode_events` join table, (c) retire multi-event | #1918, and #1917's extras |
| D6 | `/character-growth`: retire the route, or rebuild it as suggestions | #2200 |
| D7 | The orphan `character_state` row: which cleanup option (after the read), and done by you or by a migration through the Deploy workflow | #2266 |
| D8 | FD-70: mint, decline or defer | #1316's open end |
| D9 | Waive #2295 (phone task list) | #2295 |
| D10 | Close the superseded issues listed in §4 step 0 | 5 to 7 issues |

---

## §6 Spot checks at the basis (MEASURED)

These re-check the load-bearing claims above.

```
$ git rev-parse --short HEAD
babd933f
exists: docs/EVENT_EDITOR_REMOVAL_READ.md                         (#1777)
exists: docs/audit/F-Tools-1_UnreachedExportsSweep_2026-09-15.md  (#1453)
exists: docs/audit/F-AUTH-1_RouteShadowing_Reverification_2026-09-13.md  (#1316)
F-AUTH-1_SessionConduct_2026-09-{06,11,12,13,17,19}.md — no 09-18 (#1536)
scripts/check-root-junk.js:35: const untrackedMode = process.argv.includes("--untracked");   (#1347)
.githooks/pre-push:9: if ! node scripts/check-root-junk.js --untracked; then
src/routes/compositions.js:27: let s3Client = null;          (#1921)
src/routes/compositions.js:576:     if (!s3Client) {
frontend/src/components/QuickEpisodeCreator.jsx:220: … || events[0] : null;      (#1916)
frontend/src/components/QuickEpisodeCreator.jsx:333: } catch { /* event update failed — not fatal */ }
src/services/episodeGeneratorService.js:158: async function loadFinancialWardrobeItems(…)   (#1919)
src/services/episodeGeneratorService.js:161: SELECT … FROM wardrobe WHERE show_id = :showId …
frontend/src/pages/SocialMediaPage.jsx:370: … status: 'live',      (#2748)
PhoneShell in frontend/src: none; components/phone/PhoneDevice.jsx exists   (#1927)
EpisodeLalasPhoneTab: imports PhonePreviewMode; useState shownId    (#1928)
ScreenContentRenderer.jsx: no todo / social_tasks / checklist type   (#2295)
frontend/src/utils: authedEventStream.js only, no authedFetch   (#1902)
grep "used_in_episode_id = :episodeId" src → 26 sites   (#1917)
```
