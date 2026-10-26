# Prime Studios — End-to-End Production System Audit (read)

> **Revised 2026-10-26.** The target-state map (§2), the roadmap (§7) and the owner questions (§8) are superseded by `2026-10-26-production-architecture-decisions.md`, which records Evoni's rulings and the updated implementation sequence. Its conflict tables (§9 and §18) list the affected statements. The current-state findings are unchanged.

**Basis:** `origin/main` at `cb02c6a7` (2026-10-26). **Mode:** read-only. Nothing was implemented, migrated, merged or deployed. No host, database, S3 bucket or AWS API was contacted.
**Scope:** *Styling Adventures with Lala*, from Season Planning to the FFmpeg export.
**Out of scope:** My Little List. Its Phase 1 is open PR #3599 (`claude/my-little-list-phase1`). It is described in §E only where it touches the traced interaction.

**Labels**
- **VERIFIED:** the code path was read end to end at the basis SHA.
- **INFERRED:** reasoned from a partial reading.
- **NEEDS CONFIRMATION (NC):** needs the running app, the production database or server, or a product decision.

**Citation form.** Citations are `path:line` at `cb02c6a7`, always paired with a function or component name. The line numbers will drift; the names will not.

**What this read could not do.** It did not run the app against a database, so the Episode 1 walkthrough (§5) is traced through the code, not executed. Whether Redis, the `ffmpeg` binary and the `episode-worker` process are running on the production box, and whether particular tables exist in canon, are NC. Only Evoni can check those.

---

## 0. Executive summary

1. **Decision 1 (auto-draft episode): partly built.**
   - **VERIFIED.** Start Episode (`episodeGeneratorService.generateEpisodeFromEvent`) already writes a lot of the episode. It writes the episode and its brief, 14 beat plans with scene sets, tasks, wardrobe from the event outfit, overlays, money lines, feed moments, a season-slot snapshot and asset links.
   - **VERIFIED.** It writes **no script, no gameplay, no phone state and no timeline**. Nine script generators exist; two are live. Nothing is chained after Start.
2. **Decision 2 (event sync): one good pattern, not generalized.**
   - **VERIFIED.** Money and deliverable terms are **locked** after Start. Changing them goes through Reopen → Save and relock (`termsReopenService`), which rebuilds what depends on the terms and *offers* to regenerate the rest. That is the only real propagation path.
   - **VERIFIED.** Date, time, venue text, host, dress code and guests are **not locked and not tracked**. Live readers follow those edits. Snapshots (the approved invitation image, task text, the brief, feed posts, host history) silently keep the old values.
   - **VERIFIED.** The event save (`worldEvents/update.js`) writes raw SQL, has no hooks, and leaves no "changed since Start" marker.
3. **Decision 3 (gameplay automation): authored in four disconnected places, never timed, never rendered.**
   - **VERIFIED.** Cursor paths are generated from icon cues into tables that appear to be **absent from canon** (NC live). They leave the system only as JSON inside a ZIP.
   - **VERIFIED.** Phone playthroughs store state flags, not a timed recording.
   - **VERIFIED.** No Prime PIP layer exists anywhere.
   - **VERIFIED.** Lala's "reaction" is a template line that Evoni inserts and performs.
4. **Decision 4 (export parity): the export does not represent the Stage or the Timeline.**
   - **VERIFIED.** The renderer produces a **silent 1920×1080 slideshow of one still per scene**.
   - **VERIFIED.** Because of two payload bugs, keyframes and the chosen platform, quality and format never reach the renderer.
   - **VERIFIED.** The Timeline preview (DOM/CSS) and the export (node-canvas) are two separate implementations that disagree.
   - **VERIFIED.** No page is called "Stage".
5. **Page structure.**
   - **VERIFIED.** The same entity can be edited from several pages: event fields from 4 pages, episode-from-event from 5 entry points, the event-to-episode link 3 ways, and the script from 2 pipelines.
   - **VERIFIED.** There are six timeline-shaped stores and only one is used.
   - **VERIFIED.** The beat plan has five names.
   - **VERIFIED.** Several routes are orphaned.

---

## A. Workflow trace, stage by stage

### A1. Season Planning

| Question | Finding | Label |
|---|---|---|
| Creates | Season/arc: `show_arcs` (`ShowArc.js:16-99`). Its `phases` are JSONB. | VERIFIED |
| Creates | 24 weekly slots: `season_slots` (`SeasonSlot.js:14-49`). Each slot holds `event_id` (pencilled in), `episode_id`, intention fields and `locked_at`. The rows are inserted by `ensureSeasonSlots` (`seasonSlotService.js:205`). | VERIFIED |
| Creates | Specials: `season_specials`, raw SQL with no model (`seasonSpecials.js`). It needs migration `20261026150000`. | VERIFIED; whether the migration has run in production is NC |
| Reads | The event library, when pencilling an event into a slot. | VERIFIED |
| Source of truth | Slot ↔ event: `season_slots.event_id`. | VERIFIED |
| Source of truth | Episode season position: `episodes.season_context`, snapshotted at Start (`snapshotEpisode`, `seasonSlotService.js:370`). | VERIFIED |
| Source of truth | Release dates are computed from `shows.distribution_defaults.release_schedule` (`releaseSchedule.js`). Only a hand-set `air_date` is stored. | VERIFIED |
| Dependents | Start Episode (slot lock and snapshot), the Season page tabs, Producer Mode Overview. | VERIFIED |
| On change | Pencilling an event writes only `season_slots.event_id`, never `world_events.season_id`/`arc_id` (`pencilEventIn`, `seasonSlotService.js:503`). So `brief.season_id`/`arc_id`, copied from the event at Start, are probably always null. | VERIFIED / INFERRED |
| Propagation | The season context is a snapshot taken at Start. Later changes to slot intent do not reach the episode. | INFERRED |
| Duplicate entry | A special's release date is typed by hand. It is only *suggested* from the event date. Its title is copied once from the event name. | VERIFIED |
| Stale risk | A special's title and date drift from the event after a rename or date change. The story date (free text) and the air date are never linked. | VERIFIED |
| Status | **Implemented.** Specials depend on the migration. | VERIFIED |

### A2. Event Package

| Question | Finding | Label |
|---|---|---|
| Creates | `world_events` row (`WorldEvent.js`). It has about 60 columns, plus JSONB fields (`canon_consequences`, `requirements`, `deal_components`, `dress_code_keywords`, `outfit_pieces`, …), `event_deliverables`, `event_costs`, and the invitation `assets` row. | VERIFIED |
| Data quality | `event_date` and `event_time` are free text, `STRING(50)` ("Friday, March 15th"). | VERIFIED |
| Data quality | Attendees live in `canon_consequences.automation.guest_profiles` (`utils/eventAttendees.js:5`). `guest_list` is accepted by the PUT but discarded on create and ignored by every reader. | VERIFIED |
| Reads | Host profiles, World Locations / Scene Sets, wardrobe, the opportunity record. | VERIFIED |
| Source of truth | `world_events`. It is edited on `EventPackagePage` (`/shows/:showId/events/:eventId`) through `PUT /world/:show/events/:id` (`worldEvents/update.js:173`). | VERIFIED |
| Dependents | Start Episode, the script writers (they read live), the style sheet, completion, payouts, Pulse, the feed, invitations, to-do regeneration. | VERIFIED |
| On change | See §C. In short: terms locked; `scene_set_id` synced to draft episodes; everything else unflagged. | VERIFIED |
| Duplicate editors | EventLibrary (Season › Events), QuickEpisodeCreator (`/episodes/:id/edit`), and EpisodeOverviewTab (the link only). | VERIFIED |
| Status | **Implemented.** The readiness gates exist only in the client: the server refuses only "already has an episode" and "missing price" (`startReadinessService.js:38-61`). | VERIFIED |

### A3. Episode Creation (Start Episode)

- **Trigger.** Start Episode (`useStartEpisode.confirmStartEpisode`) calls `POST …/events/:id/generate-episode` (`worldEvents/episodeGenerate.js:29`), which runs `episodeGeneratorService.generateEpisodeFromEvent` (`:428-1207`). VERIFIED
- **One transaction** (`:650-797`) writes:
  - the `episodes` row, with a Haiku title, synopsis and teaser;
  - the `episode_briefs` row (the canonical episode→event link, plus snapshots);
  - `event_costs`;
  - the event stamped `used`;
  - frozen deal prices (`takePriceSnapshot`);
  - the season-slot lock and snapshot.

  VERIFIED
- **Best-effort steps after the transaction:**
  - deliverables get `episode_id`;
  - invitation and offer-letter overlays;
  - required UI overlays placed;
  - **14 `scene_plans`** (`createScenePlanRows`);
  - locations;
  - feed moments (templates and `Math.random`);
  - `episode_todo_lists`;
  - `episode_wardrobe` from `event.outfit_pieces`, auto-approved;
  - asset re-tagging;
  - host and guest history;
  - "post-event" feed posts, **written at Start**, before the episode happens;
  - thread seeds (asynchronous).

  VERIFIED
- **Not written:** script (`draft_script:false` from the UI), phone state, reminders, gameplay, timeline. VERIFIED
- **Copy vs reference** (the key result):

  | Event data | At Start | Afterwards |
  |---|---|---|
  | Name, date, time, venue, dress code, host | Copied only into AI title text and task text | Read **live** by the script writer (`eventContextBlock`, `episodeScriptWriterService.js:820-856`) |
  | Terms, career fields, `dress_code_keywords`, `host_brand`, `canon_consequences`, outfit | Snapshotted into the brief, tasks and wardrobe | The snapshot is not updated |

  VERIFIED
- **Other entry points.** An episode can also be created from an event by `generate-episode-from-many` and `regenerate-episode` (EventLibrary), `NextEventSuggestionsOverlay`, `regenerate-episode` on EpisodeOverviewTab, and NewEpisodeStarter. `generate-episode-from-many` has no `deleted_at` filter and passes no locations (`episodeBatch.js:46-82`). VERIFIED
- **Manual link.** Linking an event from the Overview sets only `used_in_episode_id`: no brief, no snapshot (`EpisodeOverviewTab.jsx:302`). VERIFIED
- **Start Part 2** (`seasonSpecials.js:609-660`) makes only an episode and a thin brief: no beat plans, tasks or wardrobe. VERIFIED
- **Status: partially implemented.**

### A4. Script

- **Nine generators** (`episodeBriefRoutes`, `episodeScriptWriterRoutes`, `episodes.js generate-beats`, `scriptAndBulk`, `episodeGenerate`, `lalaScripts`, `scriptGenerator`, `episodeOrchestrationRoute`, `generate-script-from-book`). Two are live: VERIFIED
  - **G1 grounded:** `POST /episode-brief/:id/generate-script`, from the Script tab (`EpisodeScriptTab.jsx:2648`).
  - **G2 Script Writer:** `POST /episode-scripts/:id/generate`, from `/episodes/:id/script-writer`.
  - **G4 and G5:** deterministic skeletons.
- **Broken or dead generators.** VERIFIED
  - G6 `lalaScripts` returns 500 every time: it calls `db.LalaEpisodeFormula`, and no such model exists.
  - `gameShows` models have no model files.
  - G8 output (`episodes.orchestration_data`) is read by nothing.
- **Reads.** G1/G2 read the brief, scene plans, the event (live), owned wardrobe, the locked look, the season context, the previous episode, story threads, character state, phone overlays and money. VERIFIED
- **Source of truth.** `episodes.script_content`: **free text** with `## BEAT:` headers and inline tags (`[UI:CLICK|OPEN|…]`, `[WEAR:]`, `[STAT:]`, `[MAIL:]`, `[EVENT:]`, `[SCENE:]`, `[FX:]`). Beats have no stable ids. G2 also writes the typed `episode_scripts.script_json`, which only its own page displays. VERIFIED
- **Three separate tag readers.** VERIFIED
  - Backend `scriptBeatParser`.
  - Frontend `parseScriptIntoBeats` and `lib/*`.
  - `utils/*` (scriptCoverage, phonePaths, scriptWear).
- **Edits are preserved by:** locked beats (`scriptKeepingLocks`, `scriptBeatLocks.js:269`), version snapshots (`snapshotScript`) and an overwrite guard. `generate-beats` skips the guard. VERIFIED
- **Downstream.** Nothing invalidates beat plans, cues or the timeline when the script changes. VERIFIED
  - `apply-scene-plan` puts the parse into `scenes.metadata`, which the `Scene` model does not have (VERIFIED: the model has no attribute; whether the value is silently dropped is INFERRED).
  - The parse routes have no frontend caller.
  - The icon-cue generator reads a table name and column that do not exist (`lala_formula_episodes`, `script.content`) (VERIFIED, `iconCueGeneratorService.js:110,332`).
- **Status:** story content is implemented; script-as-executable-instructions is **missing**.

### A5. Gameplay

- **Script tags.** Authored as `[UI:*]` and `[WEAR:]` tags, read only by client-side helpers (`scriptMoments.resolveMoment`, the teleprompter, phone checks). VERIFIED
- **Phone.** Screens and tap zones (percent geometry) are in `assets.metadata.screen_links` (`uiOverlayRoutes.js:598-631`). Playing the phone (`PhonePreviewMode` → `POST /phone-state/tap`) stores only flags, visited screens and the last screen: no timestamps, coordinates or log (`PhonePlaythroughState.js:21-32`). VERIFIED
- **Cursor.** `cursor_actions`, generated from `icon_cues` (`cursorPathGeneratorService.generateFromIconCues`). VERIFIED
  - Positions come from `icon_slot_mappings`, with a hard-coded fallback `{x:850,y:400}`. VERIFIED
  - Timing is fixed (1 s lead, 500 ms move). VERIFIED
  - The three tables exist only in a dead migration tree and are listed as absent from canon (`Canon_AbsentTable_Classification_2026-09-17.md`). Live state: NC.
  - `regenerate` piles up duplicates. VERIFIED
  - The export route is shadowed by `/:pathId`. VERIFIED
- **Wardrobe.** Two systems: VERIFIED
  - `[WEAR:]` script tags.
  - `EpisodeWardrobeGameplay`: in-memory equip plus purchase and lock.

  `timeline/wardrobe/current` has no caller. VERIFIED
- **Lala reaction.** `draftLine` is a template that is never auto-inserted ("Nothing is written without her click"). Evoni then performs it from the teleprompter. VERIFIED (code); that Evoni performs it is INFERRED.
- **Status:** authoring is partial. A timed gameplay track is **missing**. Rendering is **missing**.

### A6. Scene Sets

- **Link to episode.** Episode ↔ set through `scene_set_episodes` (with `role`). Event venue → set through `WorldEvent.scene_set_id` or the venue's World Location (`eventSceneSetLinkService`, which never guesses). VERIFIED
- **Beats to scenes.** `syncBeatScenes` (`beatScenesService.js:40-121`) turns `scene_plans` into `scenes` rows. It copies `background_url` only (angle still → event look → base still), with duration 5 s and empty characters and UI. VERIFIED
- **Runway video.** Angle video (`SceneAngle.video_clip_url`) is never used. VERIFIED
- **Status:** generation is implemented; the hand-off to the episode is stills only.

### A7. Stage

- **No page or route is named Stage.** `ExportPage.jsx:14` says its `ScenePreview` "replaces old Stage from deprecated SceneComposer". VERIFIED
- **Two candidates:** VERIFIED
  - Scene Studio (Konva, `/studio/scene/:id`), which writes `scene_assets` and `canvas_settings`. **Nothing downstream reads them.**
  - The Timeline `PreviewMonitor` (DOM/CSS).
- **Status:** **undefined.** This is owner question Q1.

### A8. Timeline

- **The one live model.** `scenes` rows plus `timeline_data` (beats, markers, audio_clips, character_clips, keyframes) is the Timeline Editor's only model (`TimelineEditor.jsx:350-386`, saved through `POST /episodes/:id/save`). VERIFIED
- **Five unused timeline-shaped stores:** VERIFIED
  - `timeline_placements` (dead-tree migration; UI orphan);
  - sequence items (no caller);
  - `video_compositions` (inline `CREATE TABLE`);
  - `layers` (no migration);
  - the animatic.
- **Gaps:** VERIFIED
  - Audio clips are created with `audioUrl: null`.
  - Keyframes are global, not tied to a scene or element.
  - Preview drag is not saved (`onUpdateElement` is not passed).
  - Nothing writes `scenes.characters` in the `{imageUrl,…}` shape (INFERRED).
- **Status:** partially implemented.

### A9. FFmpeg Export

- **Chain.** `ExportPage` calls `POST /episodes/:id/export` (`export.js:21`), which adds a Bull job on Redis (`addExportJob`). The `videoRenderer` worker (`episode-worker` in PM2) runs `renderSceneFrames`, which draws one PNG per scene, then `renderVideo` concatenates them with libx264 at 30 fps and uploads to S3 `exports/<ep>/<ts>.mp4`. VERIFIED
- **Defects** (all VERIFIED):
  - **Platform:** the route sends `platform` as a string (`export.js:117`), but the worker reads `platform.width` (`videoRenderer.js:274,529`). Every export is 1920×1080; the computed `resolution` is unused.
  - **Keyframes:** the route sends `timelineData` (`export.js:134`), but the worker reads `timeline` (`videoRenderer.js:46`), so keyframes are always undefined. Even if passed, they are evaluated only at `t=0` with a schema mismatch.
  - **Audio:** `// TODO: Add audio mixing` (`:546`).
  - **Format:** `mov`/`webm` are ignored; the output is always `output.mp4`.
  - **Download:** works only while Bull keeps the job (24 h / last 100).
  - **No YouTube upload.**
- **Status:** the pipeline exists; the output is a **silent still-slideshow**. Whether it runs in production is NC (Redis, ffmpeg, worker).

---

## B / 3. Page responsibility matrix

Every page is used by Evoni, the solo producer. The "Primary action" column records what the code does today. "Next step" is a proposal, as is the "Recommendation" column: these are not redesigns.

| Page (route → component, lines) | Why it exists | Should create/edit | Should be read-only (owned elsewhere) | Duplicates / confusing | Primary action today | Recommendation | Next step |
|---|---|---|---|---|---|---|---|
| Producer Mode `/shows/:id/world` → `WorldAdmin` (2,879) | Show hub | Show-level assets (scene sets, phone, cast) | Episode outfits, the event list | Inline Wardrobe closet: LookBuilder `lock-outfit-atomic` duplicates the episode Wardrobe tab. "Lala's Phone" (`overlays-tab`) sits beside "Overlays" (`production-overlays`). | None; Overview has "Continue Episode" | Keep as hub. Move episode-level outfit lock out. Merge Overlays into Phone or rename. | Current episode |
| Season `/shows/:id/season` → `SeasonPage` (602, 10 tabs) | Plan 24 slots and specials | Arc, slots, intentions, specials | Event fields | Events tab = `EventLibrary` (1,236), a **full second event editor** plus 3 episode-generation buttons | Season setup save | Make Events tab a list linking to Event Package. Remove generate/regenerate there. | Event Package |
| Event Package `/shows/:id/events/:eid` → `EventPackagePage` | Ready one event | All event facts, terms, outfit | — | "Edit details" opens the EventLibrary editor instead | **Start Episode**, which completes and goes to the episode | Single owner of event facts. After Start, show "used by Episode N" and per-field lock/changed state. | Episode Overview |
| Episode `/episodes/:id` → `EpisodeDetail` (1,360) | Episode shell | Episode metadata | Event facts | Overview links/unlinks events (an event write); ⋮ "Edit Episode" → QuickEpisodeCreator also edits and creates events. Breadcrumb "Episodes" goes to Producer Mode Overview, not the list. | — | Event link read-only. Fix breadcrumb target. | Script |
| Script tab → `EpisodeScriptTab` (3,417) | Write and approve script | Script, locks | To-do, overlays, money (it writes them too) | Second pipeline `/script-writer` (`EpisodeScriptWriterPage`) | Generate (G1) | One pipeline (Q7). Split gameplay and to-do concerns out. | Plan / Gameplay |
| `/episodes/:id/script-writer` → `EpisodeScriptWriterPage` (350) | Script v2 | — | — | Duplicate; full-page reload to open | Generate/lock (G2); lock overwrites with no guard | Merge into Script tab or retire | — |
| Production › Plan → `EpisodeSceneWorkspace` / `EpisodeScenesTab`; `/plan` → `ScenePlannerPage` | Beats → set/angle | Beat plan | Scene set images | Five names: Plan / Beat Plan / Scene Plan / Scene planner / Beat Plan (full screen) | Lock all; generate-plan | One name, one editor | Timeline |
| Production › Wardrobe → `EpisodeWardrobeGameplay` (1,356) | Episode look and gameplay | Lock outfit, purchase | Closet catalogue | Duplicate lock path in LookBuilder | `lock-outfit-atomic` | Episode outfit only here | Script / Gameplay |
| Production › Phone → `EpisodeLalasPhoneTab` | Preview the phone in the episode | Episode moments | Screens and zones (Phone Hub) | "Preview Phone" saves a playthrough; the embedded pane does not | — | Becomes the episode's Gameplay track view | Stage |
| Production › Overlays → `EpisodeOverlaysTab` | Episode on-screen pieces | Placement | Overlay assets | "New overlay" → tab labelled "Lala's Phone" | — | Merge with Gameplay/Stage layers | — |
| Phone Hub `/phone-hub`, `overlays-tab` → `UIOverlaysTab` (3,643) | Build the phone | Screens, icons, zones, content | — | `ProductionOverlaysTab` (407) writes the same `/ui-overlays` endpoints; `/phone-hub` has no back link | Generate/upload | Single owner of phone assets | Back to episode |
| Scene Sets → `SceneSetsTab` (4,464) | Locations and angles | Sets, angles, stills, video | — | Very large | Generate | Keep; split later | — |
| Scene Studio `/studio/scene/:id` → `SceneStudio` (2,264) | Visual compose | `scene_assets` | — | Output read by nothing downstream; name collides with "Book Scene Studio" `/scene-studio` | Save canvas | Either becomes the Stage or is folded into it (Q1) | — |
| Timeline `/studio/timeline` → `/episodes/:id/timeline` → `TimelineEditor` (1,016) | Arrange scenes | Durations, order, keyframes, audio | Scene content | Four names; Sidebar row reopens last episode with no picker | Save; Export link | Becomes the single production timeline | Export |
| Export `/episodes/:id/export` → `ExportPage` (606) | Render | Render settings | Everything | Platform/quality/format pickers ignored | Start Export → slideshow | Keep once parity exists | Download / publish |
| `/episodes/:id/edit` → `QuickEpisodeCreator` (885) | Legacy edit | Episode metadata | Event fields (it edits and creates them) | Duplicate event path | `PUT /episodes/:id` | Remove event editing | — |
| `/episodes/:id/icon-cues` → `IconCueTimeline` (622) | Cue/cursor lists | — | — | Orphan; raw `axios` without auth (INFERRED 401) | Generate cues | Retire after the gameplay track exists | — |
| `/episodes/:id/todo`, `/evaluate`, `/review`, `/beats` | Run sheet / scoring / placeholder / orphan | — | — | "Todo List" vs "Episode Run Sheet"; `/review` is a placeholder; `/beats` orphan | — | Consolidate into Results | — |

All rows VERIFIED except where marked; the "Recommendation" column is a proposal.

---

## 1. Current-state system map

```
Season (show_arcs, season_slots, season_specials)
   │ pencil: season_slots.event_id (event.season_id never set)
   ▼
Event Package (world_events + canon_consequences JSONB + event_deliverables + event_costs + invitation asset)
   │  edited by: EventPackagePage │ EventLibrary │ QuickEpisodeCreator │ EpisodeOverview(link)
   │  PUT = raw SQL, no hooks; terms locked after Start; scene_set_id → draft-episode sync only
   ▼  Start Episode (generateEpisodeFromEvent) — 5 entry points
Episode ── episode_briefs (SNAPSHOT) ── scene_plans×14 ── episode_todo_lists ── episode_wardrobe
   │        overlays ── feed moments ── event_costs ── season snapshot
   │
   ├─ Script: episodes.script_content (free text + [UI:]/[WEAR:] tags) ← G1 / G2 / G4 / G5 (reads event LIVE)
   │     └─ parsed only client-side (3 parsers); nothing server-side consumes the tags
   │
   ├─ Gameplay (four islands, not joined):
   │     Phone Hub screen_links (zone geometry) → PhonePreviewMode → phone_state flags (no time, no xy)
   │     icon_cues → cursor_actions (tables absent on canon?) → ZIP JSON only
   │     EpisodeWardrobeGameplay (in-memory equip) │ [WEAR:] tags
   │     Lala reaction = template line, inserted by hand, performed live
   │
   ├─ Scenes: scene_plans → syncBeatScenes → scenes.background_url (stills only)
   │     Scene Studio → scene_assets  (read by NOTHING downstream)
   │
   ├─ Timeline: scenes + timeline_data (TimelineEditor)  [+5 unused timeline stores]
   │     preview = PreviewMonitor (DOM/CSS)
   │
   └─ Export: scenes (+timelineData, IGNORED) → Bull/Redis → videoRenderer (node-canvas)
         → 1 PNG per scene → ffmpeg concat → silent 1920×1080 MP4 → S3
```

## 2. Proposed target-state system map (for approval; not designed in detail)

```
Season ──► Event Package (sole owner of event FACTS; real date type)
             │  every save diffs facts against each dependent's recorded fingerprint
             ▼
        Change Router ── auto-apply │ regenerate-keeping-edits │ "Needs your decision" inbox │ frozen
             ▼
Episode Production Record  (one per episode; owns status + approvals per layer)
   1 Brief (references event facts + fingerprint, no silent copies)
   2 Story Script (structured beats, stable beat ids; dialogue + direction)
   3 Gameplay Track (typed, timed actions: phone_open, cursor_move→zone, click, read, close, wear, react)
        generated from script tags + Phone Hub zone geometry + wardrobe; producer edits are marked "custom"
   4 Shot Timeline (ONE model: per beat → layers: set (still/video), Lala, Prime PIP, phone, cursor,
        overlays, captions, audio)
   5 Stage = the preview of (4), drawn by the SAME compositor the export uses
   6 Export = render of (4) → YouTube-ready MP4 (+ optional upload later)
```

Design principles to approve:
- **One owner per fact.** Every other page shows the fact read-only and links to its owner.
- **Every derived artifact records what it was derived from.** That is a fingerprint, as `styleSheetService` already does with `inputs_hash`.
- **Custom edits are marked and never overwritten silently.** This extends the beat locks and `scene_plans.chosen_by_user` everywhere.
- **The preview and the export share one renderer.**

## 4. Source-of-truth and dependency matrix

| Entity / fact | Authoritative store | Copies (snapshots) | Live readers | Propagation today | Label |
|---|---|---|---|---|---|
| Event date/time | `world_events.event_date/time` (free text) | Invitation image text; task text | Script writer, scene brief, Pulse, sidebar, style sheet (hash → stale) | Live readers only; invitation not flagged | VERIFIED |
| Venue / scene set | `world_events.scene_set_id`, `venue_*` | Invitation; social-task text; `scene_plans` set/angle | Script writer, style sheet | `scene_set_id` → draft episodes (`syncEpisodeEventLocation`); refused after acceptance; `venue_*` text unsynced; stills not regenerated | VERIFIED |
| Host | `world_events.host`, `host_brand`, `source_profile_id` | `brief.event_metadata.host_brand`; tasks; feed posts; host history; invitation | Script writer, style sheet | `host_brand` re-drafts deal type only | VERIFIED |
| Invitation | `assets` (versions, approve/supersede) | `brief.invitation_asset_id` | Episode overlay (re-placed on approve) | Overlay swap works; content not flagged when facts change | VERIFIED / INFERRED (no other writer of `invitation_asset_id`) |
| Dress code | `world_events.dress_code`, `dress_code_keywords` | Brief keywords; wardrobe tasks; to-do asset | Outfit scoring (live), style sheet | None; manual `/todo/generate` wipes wardrobe-task edits and ticks | VERIFIED |
| Deal amount | `world_events.payment_amount`, fee columns | Brief terms; `financial_summary`; `episodes.total_income`; `deal_price_snapshots` | Payouts at Complete | **Locked**; Reopen → relock rebuilds and offers regeneration | VERIFIED |
| Deliverables | `event_deliverables` | Brief terms; deliverable tasks | Completion | **Locked** (409); relock keeps completion | VERIFIED |
| Attendees | `canon_consequences.automation.guest_profiles` | Brief `canon_consequences`; feed moments; guest history | Script writer, Pulse, new invitations | None | VERIFIED |
| Script | `episodes.script_content` (+`episode_scripts`) | Version snapshots | Teleprompter, phone checks, post drafts, evaluation | Nothing downstream invalidated | VERIFIED |
| Beat plan | `scene_plans` | `scenes` (via `syncBeatScenes`) | Filmstrip, export (via scenes) | Synced at export time | VERIFIED |
| Phone screens / zones | `assets.metadata.screen_links` | — | PhoneDevice everywhere | Live | VERIFIED |
| Cursor paths | `cursor_actions` (canon presence NC) | ZIP JSON | Nothing | — | VERIFIED / NC |
| Episode outfit | `episode_wardrobe` + lock | — | Script grounded writer, scoring | Two lock paths | VERIFIED |
| Timeline | `scenes` + `timeline_data` | — | PreviewMonitor, export (partly) | Keyframes lost in export | VERIFIED |

## C. Synchronization: change classification

| Change | Safe to auto-update | Regenerate, keeping custom edits | Needs producer approval | Must stay unchanged | Current handling |
|---|---|---|---|---|---|
| Date / time | Live readers (Pulse, scene brief, script context), style-sheet stale flag | Script lines mentioning the date; lighting/time-of-day variants | Approved invitation image | Anything after acceptance/completion; already-posted feed | Live readers follow; invitation silently stale (VERIFIED) |
| Venue / scene set | Draft episode set and unlocked beats (exists) | Angle stills; social-task text | Venue text on approved invitation; locked beats | Accepted episodes (refused today) | `scene_set_id` synced to drafts only; `venue_*` not (VERIFIED) |
| Host | Deal-type re-draft (exists); live readers | Task text; brief `host_brand` | Host/guest history reassignment; invitation | Feed posts already generated | Snapshots stale; history stays with old host (VERIFIED) |
| Invitation | Overlay swap on approve (exists) | — | Content changes after approval | Versions superseded, kept | VERIFIED |
| Dress code | Live outfit scoring before completion; style sheet | Wardrobe tasks (keep ticks and edits) | Locked outfit that no longer fits | Completion score | Tasks stale; regenerate wipes ticks (VERIFIED) |
| Deal amount | — | — | **All** (locked; Reopen flow) | Ledger rows after Complete | Implemented end to end (VERIFIED) |
| Deliverables | — | Tasks (relock keeps completion) | **All** (locked) | Submitted/completed deliverables | Implemented (VERIFIED); PR #3598 changes completion |
| Attendees | Live readers | Script cast lines | Feed moments with removed guests | Guest history, posted feed | No propagation (VERIFIED) |

**Gameplay and render assets, for every field.** Cursor paths, icon cues and phone services read no event fields (VERIFIED). Event changes therefore never reach gameplay, not even indirectly through the script. The export reads `scenes` at export time, so set changes reach the export only through `syncBeatScenes` (VERIFIED).

**Reusable building blocks** (VERIFIED):
- `styleSheetService` `inputs_hash` / `stale`
- `eventDocumentOverlayService.overlayState` → `'outdated'`
- `termsReopenService.planTermsRebuild` / `relockTerms` / `regenerateOffer`
- `scriptBeatLocks.scriptKeepingLocks`
- `scene_plans.locked` / `chosen_by_user`
- `scriptVersions.snapshotScript`
- invitation version history
- `brainSyncService` `source_hash`

## D. Episode generation

- **Inputs present at Start** (VERIFIED): the event (facts, terms, outfit, guests, host), the season slot intent, scene sets, the closet, character state, the previous episode, story threads, phone overlays.
- **Missing inputs** (VERIFIED unless marked):
  - a structured event date;
  - a venue → set mapping when the venue has several sets (it returns `choose`);
  - Lala's equipped-item reactions (`lala_reaction_equipped` "exists nowhere");
  - Prime PIP source (Q2);
  - an audio and music source;
  - phone on-stage placement (needed to convert zone % into stage pixels) (INFERRED).
- **Unsupported decisions:** which script pipeline is canonical; whether reactions are auto-written; what the Stage is. See §8.
- **Disconnected generators** (VERIFIED):
  - G3, G6, G7 and G8 have no caller or are broken.
  - The parse routes have no caller.
  - Icon cues read non-existent sources.
  - Music cues read `scenes.metadata`.
  - `phoneScreenRenderer.renderPhoneScreen` has no callers.
  - The production-package ZIP is cue sheets, not media.
- **Story vs executable.** Today both live interleaved in one text column, with no schema. The target is to keep the **Story Script** (dialogue and beats, owned by the writer) separate from the **Gameplay Track** (typed, timed actions with targets). The track is generated *from* the script's tags plus phone geometry and refers to beats by stable id.
- **Auto-draft feasibility.** A full first draft is feasible with existing generators:

  Start → G1 script → parse tags to a gameplay track → `syncBeatScenes` → one timeline

  This needs (a) the gameplay-track store, (b) the timeline consolidation and (c) chaining with review gates. INFERRED

## E. Gameplay and rendering: one interaction traced

| Hop | Authored | Previewed | In export | Breaks |
|---|---|---|---|---|
| Prime PIP | Not found | No | No | **Not built** |
| Open phone | `[UI:OPEN Phone]`; Phone Hub screens | `PhonePreviewMode` (interactive) | No | Preview-only UI |
| Cursor moves | `cursor_actions` (canon NC) | Text list in orphan `IconCueTimeline` | No (ZIP JSON) | **Stored, never drawn** |
| Cursor image | S3 roles `UI.MOUSE.CURSOR` / `CHROME_CURSOR` (`ui/mouse/…`) | Nothing reads the roles | No | Asset exists, unused, ready to reuse |
| Click My Little List | Tap zone (% geometry); `[UI:CLICK]` → `resolveMoment` | `POST /phone-state/tap` (flags only) | No | **No timed record** |
| Read reminder | Main: `todo` content zone. PR #3599: API only (Phase 2 = UI) | Content zone | No | — |
| Close list | Back zone; last screen stored | Preview | No | No close event |
| Equip item | `[WEAR:]`; `EpisodeWardrobeGameplay` in memory | Wardrobe UI; Script cue | No (export reads `scenes.characters`) | **Not connected** |
| Lala reacts | Template line, inserted by hand | Script/teleprompter text | Only as recorded footage, which never enters a render (Assemble Takes is localStorage text) | **Not automatic; footage not rendered** |
| Stage previews | PreviewMonitor: background, characters, ui_elements | — | — | **No phone/cursor/wardrobe layers** |
| FFmpeg export | — | — | Stills slideshow | **Everything above is lost** |

All rows VERIFIED, except the canon presence of `cursor_actions` (NC).

**Where it breaks first.** Interactions are never stored as a timed track. Everything after that depends on such a track.

**A feasible route.** Every piece it needs already exists:
- Phone Hub zone geometry: `screen_links`, % of screen.
- `[UI:CLICK X]` → icon: `resolveMoment`.
- Path from home: `phoneIcons`. Its geometry is currently dropped.
- Cursor S3 asset.
- `phoneScreenRenderer` (node-canvas).

A generator could therefore emit a timed track and draw it. The one undefined input is the phone's placement on stage. INFERRED

## F. User experience findings

All VERIFIED.

- **Too many responsibilities:**
  - `SceneSetsTab` (4,464 lines), `UIOverlaysTab` (3,643), `EpisodeScriptTab` (3,417; also writes to-do, overlays and money) and `WorldAdmin` (2,879; inline closet and finances).
- **Duplicate editors:**
  - event fields (×4);
  - episode-from-event (×5);
  - event↔episode link (×3, one skips the brief);
  - outfit lock (×2);
  - script (×2);
  - beat plan (×2);
  - UI overlay assets (×2);
  - evaluation (×2, INFERRED).
- **Confusing labels:**
  - The beat plan has five names.
  - The timeline has four names.
  - Run sheet vs Todo List.
  - "Lala's Phone" vs "Overlays".
  - Two different "Scene Studio"s.
  - "Stage" is used for the episode-board column and the Phone Hub pills, but no page carries it.
- **Navigation:**
  - The breadcrumb "Episodes" goes to Producer Mode Overview.
  - After a delete, the app goes to `/episodes` → `/shows`.
  - `/phone-hub` has no back link.
  - The Timeline Sidebar row silently reopens the last episode.
  - After a download, Export has no next step.
- **Orphans:** `/episodes/:id/beats`, `/icon-cues`, `/review` (placeholder), `/studio/scene-set/:id`, `/scene-studio`, `/shows/:id/feed-dashboard` (one link).
- **Controls that appear to work but do not finish the workflow:**
  - the export platform, quality and format pickers;
  - Timeline "+ Audio" (no source);
  - the keyframe editor (lost in export);
  - preview drag (not saved);
  - Scene Studio compositions (never read);
  - `POST /episodes/:id/enqueue` (no consumer);
  - Assemble Takes (text only);
  - cursor-path "Regenerate" (duplicates);
  - G6 (always 500);
  - "Preview Phone" vs the embedded phone (one saves, one does not).
- **Hidden dependencies:**
  - Export needs Redis and the worker (503 otherwise).
  - Specials need their migration.
  - Cursor and icon-cue tables may be absent.
  - Readiness gates are client-only.

**Simpler navigation (proposal, not implemented).**
- **Show** (hub) → **Season** (plan) → **Event Package** (facts).
- From there, the **Episode** has six steps in order: Brief → Script → Gameplay → Stage → Export → Results.
- Each step page shows read-only facts from its owners, a "changed upstream" banner, a single primary action and a "Next: …" link.
- Asset libraries (Scene Sets, Phone Hub, Wardrobe, Cast) stay under the Show and are opened from a step with a return link.

---

## 5. Episode 1 walkthrough (code-traced, not executed)

1. **Season page:** seed the arc; 24 slots appear; pencil the event into slot 1. ✅ But `world_events.season_id` stays null. ⚠️ (VERIFIED)
2. **Event Package:** fill host, venue, date ("Friday…" free text), dress code, deal, deliverables, invitation. ✅ The readiness checklist is client-only. ⚠️ (VERIFIED)
3. **Start Episode.** ✅ The episode, brief, 14 beat plans, tasks, wardrobe, overlays and money are written. ⚠️ Post-event feed posts are written now, before the episode. ❌ No script. (VERIFIED)
4. **Change the event date or host after Start.** ⚠️ The script writer sees the new value. The invitation, tasks and brief keep the old one. Nothing is flagged. (VERIFIED)
5. **Script tab → Generate.** ✅ Grounded script with `[UI:]`/`[WEAR:]` tags. ⚠️ The second pipeline on `/script-writer` can overwrite it on lock with no guard. (VERIFIED)
6. **Gameplay.** ❌ No step consumes the tags. The cursor generator needs icon cues, which read non-existent sources, and its tables may be absent. Phone preview interactions are not recorded with time. (VERIFIED / NC)
7. **Wardrobe tab:** lock outfit, purchase. ✅ Not connected to the timeline or the export. ❌ (VERIFIED)
8. **Plan → scene sets/angles.** ✅ `syncBeatScenes` copies stills to `scenes`. Runway video is unused. ⚠️ (VERIFIED)
9. **"Stage".** ❌ Undefined. Scene Studio edits are not read downstream. (VERIFIED)
10. **Timeline:** arrange, keyframes, "+ Audio". ⚠️ Audio clips have no source; drag is not saved. (VERIFIED)
11. **Export.** ⚠️ 503 if Redis is down (NC). Otherwise a silent 1920×1080 slideshow of stills: no Lala unless `characters[].imageUrl` exists, no PIP, phone, cursor, dialogue or music. ❌ (VERIFIED)
12. **YouTube.** ❌ No upload path; manual download from a presigned URL while the job is retained. (VERIFIED)

## 6. Prioritized problems

| # | Severity | Problem | User impact | Label |
|---|---|---|---|---|
| 1 | **Critical** | Export is a silent still-slideshow; no layers beyond background/characters/ui_elements | Decision 4 impossible; the finished video must be assembled outside the app | VERIFIED |
| 2 | **Critical** | No timed gameplay track; cursor data in tables absent on canon, never rendered | Decision 3 has nothing to build on | VERIFIED / NC |
| 3 | **Critical** | No Prime PIP layer anywhere | Show format cannot be produced in-app | VERIFIED |
| 4 | High | Export payload bugs (`timelineData`/`timeline`, `platform` string); format ignored | Pickers and keyframes silently do nothing | VERIFIED |
| 5 | High | Unlocked event facts (date, venue text, host, dress code, guests) have no change signal; invitation and tasks silently stale | Wrong facts on screen in a finished episode | VERIFIED |
| 6 | High | Script is free text with no stable beat ids and three parsers; script changes invalidate nothing | Gameplay and timeline cannot be derived reliably | VERIFIED |
| 7 | High | "Stage" is undefined; Scene Studio output is not consumed | Work done in Scene Studio is lost to the export | VERIFIED |
| 8 | High | Four event editors, five episode-from-event entry points, three link methods (one skips the brief) | Data entered in the wrong place; episodes without briefs | VERIFIED |
| 9 | Medium | Start Episode drafts no script or gameplay; generators unchained | Many manual button presses across pages | VERIFIED |
| 10 | Medium | Six timeline-shaped stores, one used | Confusion; dead code paths | VERIFIED |
| 11 | Medium | To-do regenerate wipes wardrobe-task edits and ticks | Lost work | VERIFIED |
| 12 | Medium | Host change leaves history with the old host; post-event feed written at Start | Continuity errors | VERIFIED |
| 13 | Medium | Readiness gates are client-only | Incomplete episodes via batch/API | VERIFIED |
| 14 | Medium | Navigation: wrong breadcrumb, five names for the beat plan, Phone/Overlays labels, orphans | Disorientation | VERIFIED |
| 15 | Low | Broken or dead: G6 500, gameShows models, `scenes.metadata` drop, shadowed cursor export, regenerate duplicates, enqueue with no consumer | Buttons or routes that fail if reached | VERIFIED (drop INFERRED) |
| 16 | Low | Timeline: audio clips without source, drag not saved | Controls appear functional | VERIFIED |
| 17 | Low | Silent catches (`episodeGeneratorService.js:264,476`, `create.js:85`, `scriptParse.js:116,206`, `StudioTimelinePage.jsx:40`, `EventLibrary.jsx:1003`) | Hidden failures; violates the repo rule | VERIFIED |

## 7. Phased roadmap (proposal; each phase needs your approval, and each PR its own yes)

- **Phase 0: Honesty and small fixes.** No architecture.
  - Fix the export payload (`timeline`, platform object, format).
  - Label controls that do not finish ("Preview only", "Not in export yet").
  - Fix the breadcrumb.
  - Server-side readiness gates.
  - Log the silent catches.
  - Stop the to-do regenerate from wiping ticks.
- **Phase 1: Single owner plus change detection** (decision 2).
  - Event Package becomes the only event-fact editor. EventLibrary becomes a list; QuickEpisodeCreator and the Overview no longer write events; one link method that always makes a brief.
  - Fact fingerprints on each derived artifact (brief, invitation, tasks, script), reusing the `inputs_hash` pattern.
  - An episode "Changed upstream" panel that routes each change by the §C classes and reuses the Reopen/relock and `regenerateOffer` flow.
- **Phase 2: Structured script and gameplay track** (decision 3).
  - Stable beat ids.
  - One shared tag parser.
  - A `gameplay_actions` store (new migration under `src/migrations/`) generated from tags plus Phone Hub zone geometry plus wardrobe, with `is_custom` preservation.
  - Retire `icon_cues`/`cursor_actions` or migrate them properly.
  - Drafted Lala reactions for approval.
  - My Little List Phase 2 (its UI) fits here but stays in its own agreed scope.
- **Phase 3: One timeline and the Stage.**
  - Pick `scenes` + `timeline_data` or a successor as the single layered model.
  - Retire the five other stores.
  - Define the Stage as its preview.
  - Decide what happens to Scene Studio.
- **Phase 4: Renderer parity** (decision 4).
  - One compositor for preview frames and export.
  - Layers: set still or video, Lala, Prime PIP, phone screens, cursor (S3 `UI.MOUSE.CURSOR`), overlays, captions, audio mix.
  - The ffmpeg filter graph is built from the same layer spec.
  - Production prerequisites (Redis, ffmpeg, worker) are confirmed by Evoni.
- **Phase 5: Auto-drafted episode** (decision 1).
  - Start Episode chains brief → script → gameplay track → timeline → Stage preview, all as drafts with per-layer approve.
- **Phase 6: Navigation consolidation.**
  - The six-step episode flow from §F.
  - Rename, merge and remove pages per §B.

## 8. Questions for the product owner

1. **What is "the Stage"?** Scene Studio (Konva), the Timeline preview, or a new page that previews the full composed episode?
2. **Prime's PIP: what is its source?** Recorded webcam footage of you, a still or animated avatar asset, or something generated? Where does it sit on screen, and does it appear for the whole episode?
3. **Voice and dialogue in the export:** your recorded takes (teleprompter / raw clips), TTS, captions only, or a combination?
4. **Gameplay rendering:** should the cursor and phone be **drawn from data** (recommended; deterministic, editable)? Or should the app capture a real playthrough on screen?
5. **Lala reacts automatically:** should reaction lines be inserted into the script automatically? Today's doctrine says "nothing is written without her click". Or should they be drafted and approved in one pass?
6. **Which script pipeline survives:** the Script tab's grounded generator, or the Script Writer page?
7. **Event dates:** should `event_date` become a real date? Should it drive or suggest the air date?
8. **After acceptance or completion,** should non-term event fields lock the way terms do, or stay editable with the episode frozen?
9. **"Post-event" feed posts:** written at Start (today) or at Complete?
10. **Season › Events (EventLibrary):** keep it as an editor, or make it a read-only list that links to the Event Package?
11. **Export destination:** download from S3 only, or a YouTube upload later?
12. **Production checks only you can run:**
    - Are Redis, `ffmpeg` and `episode-worker` running on the box?
    - Do `cursor_actions`, `icon_cues` and `icon_slot_mappings` exist in canon?
    - Has `20261026150000` (specials) run?
