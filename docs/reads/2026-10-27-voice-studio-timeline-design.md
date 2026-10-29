# Voice Studio and Timeline Editor: one episode-production workflow (read, design proposal)

**Status:** design. A1c (#3615), B1 (#3616) and C1 (#3619) are merged; C1 is in the production code (`a1908523`), and whether its migration has run there and whether `EPISODE_EDIT` is on are unconfirmed. **Revision 8 (2026-10-29) is the editor and render architecture, approved for documentation only (Gate 1):** it authorises no code, migration, infrastructure or deploy. Each later gate needs Evoni's own approval, and its own approval to push, open a PR, merge or deploy.

**Basis:** `origin/main` `7ac13358`. Code citations are `path:line` at that commit, each paired with a function or component name.

**Labels:**
- **VERIFIED:** read in code. Each was confirmed by the audit that found it, and the load-bearing ones were re-read by hand.
- **INFERRED:** follows from the code, but not run.
- **RULING:** decided by Evoni, and cited.
- **PROPOSED:** this document's design.
- **DECISION:** needs Evoni (§9).

**Builds on, does not repeat:**
- `docs/GAMEPLAY_DIRECTOR_SPEC.md` Rev 5 (the "spec");
- `docs/reads/2026-10-26-architecture-vs-gameplay-director-rev5.md` Revisions 2 and 3 (the "review");
- `docs/reads/2026-10-26-production-architecture-decisions.md` (the "decisions");
- `docs/STAGE_PIP_VOICE_PLAN.md` (SPV);
- `docs/reads/2026-10-27-a1c-design-audit.md` and `-a1c-r1-spec.md` (A1c).

Where they conflict, the order they set applies: rulings, spec Rev 5 and review Revision 3 first, then Revision 2, then decisions, then SPV. Where this document disagrees with an approved item, it says so and asks (§9).

**The show, as the design assumes it:** Prime (Evoni, `performer = 'justawoman'` in code) is the streamer playing the game, seen in a corner picture-in-picture. Lala is the in-game character. Guests are NPCs. An episode is 14 canonical beats.

---

# Read this first: the authoritative design (Revision 8)

**Implementation follows only:**
- Revision 8 (R8.x), the in-app editor, composition, render and approval architecture (Evoni's rulings 2026-10-29); where it disagrees with an earlier revision, it wins;
- Revision 7 (R7.x), which records what Timeline C1 was built to: the stored beat clock, manual dialogue placement, `edit_start`, and the findings and their severity;
- Revision 6 (R6.x), which records what B1 and the A1c prerequisite were built to;
- Revision 5 (R5.x), as amended by R6;
- Revision 4 §R4.1–R4.3, as amended by R5 and R6;
- Revision 3 §R3.2–R3.5;
- Revision 2 §R2.2, §R2.3 (as amended by R4.0), §R2.4 and §R2.6 (as amended by R6.3).

Everything else is background. Superseded passages carry a **SUPERSEDED** banner naming what replaces them.

| Topic | Authoritative | Superseded (do not build) |
|---|---|---|
| Voice tables | R4.3 B1, with R5.3 and R6.4 | §4.1, §4.2 (`voice_recordings`, the import that associates), R2.1's table list; R4.3's approval index on `occurrence` and unique re-confirmation per revision |
| Approval validity | R4.1 E1 as amended by R6.1, R3.2, R5.2 as amended by R6.2 | R2.1's history walk (R3.1: not sound); a pin on the revision hash alone; the episode `updated_at` pin and the script-version-id pin (both tried in B1 and withdrawn, R6.1) |
| Script save order | R6.1 (`episodes.script_seq`, A1c) | version-row times (`created_at`) as an order |
| Approval states and actions | R6.2 | R5.2's state table (`valid`, `needs_reconfirm`, and `moved` as unbound) |
| Script-version retention | R6.5 | any reference provider for Voice Studio |
| Timeline tables | R4.3 C1, with R5.1, R5.3 and R7.8 | §4.3 (`edit_projects`, `edit_items`), R2.5's resolution column |
| Scene duration | R3.4, R4.3 `episode_scene_clips` | R2.5 "scene timing stays on `scenes`" |
| The edit clock (beat timing) | R7.1, R7.2 | a beat that always lasts as long as its scene clips, once timing is locked |
| Dialogue timing and placement | R7.3, R7.4 | §5.3 "placed at `line_start` anchors" and "estimated" timing; R2.5's "placement is derived from `line_start` anchors (no row needed)"; R4.3's `audio_offset` nudge as the way dialogue is timed |
| Findings and their severity | R7.6 | §5.3's warnings-panel names `take_overruns_scene`, `line_overruns_gap`; R2.3's `take_overruns_scene` |
| C2 first assembly | R7.7 | §7 T2 and R5.4 C2 "approved dialogue at its lines" |
| Missing Prime footage | R4.0, R5.1 | §2 ruling 5's fallback, §5.2 "fallback", R2.3 "accepted fallback", spec G-5 / decisions §14 fallback (spec amended in its Rev 6, 2026-10-29) |
| Prime-required designation | R4.2, as amended by R5.1 | R4.2's "covered where the PIP is visible" |
| Render process | R8.9 and R8.10; R2.4's job rules where R8.9 keeps them | §9 Q7's "green-removal queue"; R2.4's process on the production box |
| The editor (views, page, journey) | R8.1 | §5.2's single multitrack page as the default; R5.4 C2's minimum as the whole editor |
| Visual modes (gameplay, cinematic) | R8.2 | a mode only per beat; `prime_mode` read as a composition mode |
| Layers, gameplay and overlays | R8.3, R8.5 | §5.2 "Overlays… later (T7)"; §7 T7's open drawer choice; overlays timed by `timeline_placements` |
| Beat status, beat approval, episode approval | R8.6, R8.7 | a status checklist kept by hand |
| Music and SFX library and licences | R8.8 | §9 Q9's open library location; R5.4's "not needed for the first MP4: music and SFX" |
| Render jobs and the render host | R8.9, R8.10 | R2.4's `episode-render` PM2 app on the production box, and R3.3/Q16/Q20's start on that box; the D1 limits checked against the production box (R5.8) |
| Preview and render parity | R8.11 | — |
| Phases and sequence | R8.14 (gates), with R5.4 and R6.6 as history | R5.4's single D1 step; R5.4's "not needed for the first MP4" list |

---

# Revision 8 (the in-app editor, composition, render and approval; Evoni's rulings 2026-10-29)

**Where Revision 8 disagrees with earlier text, Revision 8 wins.**

**Scope.** Revision 8 records the architecture Evoni approved in her Editor Audit Rulings and her Gate 1 approval (both 2026-10-29). **It is approved as documentation only.** It authorises no code, migration, infrastructure, feature flag, worker or deploy. Each gate in R8.14 needs her own approval.

**Sources:**
- the Editor and Render Audit (2026-10-29);
- the revised architecture and vertical-slice plan (2026-10-29), which Evoni reviewed.

**Code basis:** cited by name at `origin/main` `0139d384`:
- `src/utils/editTimeline.js`;
- `src/services/episodeEditService.js`;
- `src/routes/episodeEditRoutes.js`;
- migration `20261028100000-create-episode-edit-tables`.

**Goal.** Every step of making an episode happens inside Prime Studios:
- script and gameplay planning;
- scene and wardrobe selection;
- voice recording;
- Prime's PIP recording;
- phone and gameplay overlays;
- composition and editing;
- music and SFX;
- preview of a beat and of the full episode;
- the final MP4 render and export.

The producer never operates FFmpeg or an external editor. FFmpeg and a headless browser run only inside the render service.

## R8.0 Rulings and the decision register

### R8.0.1 Rulings (Evoni, 2026-10-29, RULING)

1. **Editor model.** One editor at `/episodes/:id/edit`, on the existing C1 model. Nothing duplicates it.
2. **In-app only.** Editing, previewing, rendering and approval all happen inside Prime Studios.
3. **Render host.** A separate render host renders video, not the production API server.
4. **Game UI frames.** Video states of the phone and gameplay UI come from the existing React components.
5. **Timing.** Timed overlays and gameplay actions are `timeline_items` rows.
6. **Sync.** Prime's video, her commentary and the gameplay stay synchronised.
7. **Audio library.** An in-app music and SFX library, with source and licence records.
8. **My Little List.** Full phone screens, and an optional compact My Little List overlay.
9. **Runway deal.** The original 439-coin Pulse Reel agreement is preserved when the separate runway opportunity is added.
10. **Money.** One source of truth for financial displays.
11. **Outfit.** The final outfit is saved as a permanent episode continuity snapshot.
12. **Transitions.** The first transitions are cut, crossfade and dip-to-black.
13. **Dialogue placement.** Manual placement is acceptable for the proof of concept.
14. **Legacy.** The legacy editor (`/episodes/:id/timeline`) and the legacy export stay available until the new workflow passes testing.

**Required design improvements:**
- **A.** Each beat has a default visual mode, and timed mode changes can happen within a beat. A camera change between gameplay and cinematic never forces a new beat.
- **B.** Two editing experiences on the same C1 data. The **Guided Production View** is the default. The **Advanced Timeline** is optional.
- **C.** Each beat shows a production status, derived from real production state wherever possible.
- **D.** A 60–90-second proof of concept from Episode One, made entirely in the app (R8.15.2).

**Gate 1 additions** (Evoni, 2026-10-29):
- The Guided view stays the default, and the Advanced Timeline stays planned after the PoC (R8.1).
- Gameplay actions, PIP footage and commentary share one edit clock (R8.4).
- Gameplay supports both discrete UI state changes and continuous video (R8.3).
- An approval goes stale when any material input changes, including media revisions (R8.6).
- Render jobs support cancellation, timeouts, cleanup, visible errors and safe retry (R8.9).
- The host has a verified idle stop and an explicit cost ceiling (R8.10).
- Final episode approval is separate from beat approval (R8.7).
- **A successful PoC does not authorise full production rollout** (R8.14).
- **No system may silently replace the original 439-coin Pulse Reel terms** (R8.12).

### R8.0.2 Decision register

| # | Decision | Status (Evoni, 2026-10-29) |
|---|---|---|
| R1 | Revision 8 is the authoritative design | **RULED: approved**, for documentation (Gate 1) |
| R2 | An append-only `episode_beat_reviews` record holds beat approvals and change requests, bound to a content hash | **RULED: approved** |
| R3 | Timed modes: a beat-default column plus `timeline_items` kind `visual_mode` | **RULED: approved** |
| R4 | The PoC's fashion-game screen is the phone's wardrobe screen, full-screen, with the closet angle behind it | **RULED: approved for the PoC only.** Future gameplay is not limited to static phone states. The design must support recorded gameplay video and timed interactive state changes (R8.3) |
| R5 | The compact My Little List overlay is a small React component reading the same list state, placed as an `overlay` item | **RULED: approved** |
| R6 | Licence records live in validated asset metadata at first | **RULED: approved**, with permission scope, evidence, expiry, and checks before final approval (R8.8) |
| R7 | The render host authenticates with a worker token held in SSM SecureString | **RULED: approved** |
| R8 | A separate render host, on demand, stopping itself when idle | **RULED: approved in principle.** Nothing is provisioned until pricing, capacity, security and running costs are verified (R8.10) |
| R9 | The outfit scoring weight (×0.25 in `evaluation.js`, ×0.35 in `episodeCompletionService.js`) | **DEFERRED.** First an audit of the intended formula, what each multiplier means, and its effect on historical results; then a recommended correction with regression tests. No number is chosen arbitrarily (R8.12) |
| R10 | Parity thresholds (R8.11) | **RULED: approved** |
| R11 | P-track sequencing | **RULED:** the financial consistency work starts early. The separate runway opportunity is complete before full Episode One production. Neither overwrites approved deal terms (R8.14) |

### R8.0.3 Earlier questions this revision closes

| Earlier question | Answer |
|---|---|
| Q5: where the Sidebar's editor entry points | An **Editor** entry for `/episodes/:id/edit`. The legacy Timeline entry stays until the new workflow passes testing (ruling 14) |
| Q6: desktop-first editing | The Advanced Timeline is desktop-only. The Guided view must work at 375 px for review and approval |
| Q16, Q20, R3.3, R5.8: how the D1 render process starts, and its limits on the production box | **No render process runs on the production box.** The render host is separate (R8.10). Its worker is installed and started only by a reviewed Deploy-workflow job that Evoni approves, or by her by hand |
| §7 T7 drawer choice (SPV R1/Q11, decisions G1) | Headless Chromium running the existing React components, as state frames (R8.3) |
| §9 Q9: where music and SFX live | An in-app library of `assets` rows with licence records (R8.8) |
| Owed spec amendment for Q-F1/Q-F2 (spec G-5, §14) | Made in the spec's Rev 6 (2026-10-29) |

## R8.1 One editor, two views (ruling B)

- **Route.** `/episodes/:id/edit`, with an in-app link from the episode page and a Sidebar "Editor" entry.
- **Both views read and write only the C1 routes** (`/api/v1/episodes/:episodeId/edit/*`). Every write goes through the same `edit_revision` lock, so a change made in one view is seen by the other and a stale write gets a 409.
- **Neither view writes the legacy `timeline_data`** (guarded today by `episodeEditGuard`).

### R8.1.1 The Guided Production View (default)

The Guided view works one beat at a time. The producer:
1. **Opens a beat.** Beat chips across the top show each beat's status (R8.6).
2. **Sees the script and the gameplay actions.**
   - The beat's lines and their audio state come from `voiceLineContext.lineContexts` and Voice Studio's `summary`.
   - Each `[UI:<VERB> <target>]` line, read by the parser in `phonePaths` / `voiceLineContext` (`UI_LINE`), is shown as a gameplay action, marked proposed, accepted or placed.
3. **Reviews an assembled draft.** **Assemble draft** shows a dry run of what it would write before it writes anything (the same pattern as `setBeatDuration`'s dry run and `timingChanges`).
4. **Identifies missing assets.** Each finding of the beat (every C1 finding carries `beat`) and each input check (R8.6) links to the page that fixes it: Voice Studio, raw takes and the Teleprompter, Scene Sets, or the audio library.
5. **Previews the beat.** An instant in-browser loop, or **Render beat** for the server's exact MP4 (R8.9).
6. **Adjusts the composition**, with a small set of controls:
   - the mode, plus a timed mode switch;
   - the PIP preset and its visibility;
   - dialogue placement on a strip of the beat;
   - the music bed and SFX choices;
   - the transition at a cut or a mode change.
7. **Approves the beat, or requests changes with a note** (R8.7).

At 375 px the page stacks vertically: preview, status, missing items, actions, decision.

### R8.1.2 The Advanced Timeline (optional; after the PoC)

- A tab on the same page, desktop only. Built only after the PoC passes (R8.14).
- **Lanes:** MODE, SCENE, PRIME PIP, PRIME VO (linked commentary), GAMEPLAY, PHONE, OVERLAYS, DIALOGUE, MUSIC, SFX, TRANSITIONS.
- **What it reuses.** Its parts are adapted from the legacy components, not their data model:
  - `Timeline.jsx` (lanes, playhead, scrub, drag, zoom);
  - `AudioWaveform` (wavesurfer, WebAudio);
  - `KeyframeTrack`;
  - `TimelineEditor`'s transport and undo shell.
- **What it does not reuse:** `PreviewMonitor`, the `timeline_data` model, `IconCueTimeline`, and the cursor, icon and music cue services.

## R8.2 Visual modes and timed mode changes (ruling A)

- **The beat default.** `episode_beat_production.visual_mode` is `gameplay` or `cinematic` (PROPOSED schema, R8.5).
  - It is written only by the existing beat writer (`writeBeatProduction`, through `setBeatMode`), which keeps the row history.
  - No row means `gameplay`. The default is Evoni's to change (R8.16 Q3).
- **A timed change.** A `timeline_items` row of kind `visual_mode` carries `{ mode }`, placed by `beat_start` + offset or `edit_start` + offset.
  - It switches the mode at that instant. It changes no timing, and needs no new beat.
  - It holds until the next change or the end of its beat. The next beat then starts in its own default.
- **The pure answer.** `modeAt(edit, t)` is part of `editTimeline`, so the preview and the render share it.
- **What a mode controls: composition defaults only.**
  - the PIP preset (layout, frame) and its default visibility, from `episode_pip_settings.mode_presets`;
  - whether the gameplay layers (phone, cursor, toasts, stats) are drawn by default.

  An explicit PIP visibility rule or a segment's own layout always overrides the preset.
- **What a mode never controls:**
  - it never mutes or trims commentary (R5.1: hiding never mutes);
  - it never changes `prime_mode`;
  - it never moves any time.
- **Mode is not coverage.** `prime_mode` (required | gameplay_only) remains the Prime-coverage rule. A cinematic beat where Prime must be absent is `gameplay_only` for coverage *and* `cinematic` for composition. The two are set separately, and the Guided view shows both.
- **A transition at a mode change.** A crossfade or dip-to-black blends the two compositions over its window, centred on the change (R8.5).

## R8.3 Layers and the gameplay architecture

### R8.3.1 Layer order

`layoutAt(edit, t)` returns an ordered list of layers. The order follows spec §6.6, as amended in spec Rev 6:
1. Scene (an angle still or video, or a recorded gameplay video, R8.3.3)
2. Prime's PIP
3. Phone
4. Overlays (`overlay` items: static assets and widgets such as the compact My Little List)
5. Toasts
6. Cursor
7. Audience stats panel

Each layer carries:
- its kind;
- its source, either a media id or a game-UI state id;
- geometry in pixels at 1920×1080;
- opacity;
- a blend factor inside a transition.

### R8.3.2 Discrete UI state changes

- **State changes are actions.** Opening or closing a screen, ticking or unticking a list item, a toast, and a stats change are each a `gameplay_action` or `phone_screen` item at an anchored instant.
- **The state at time t** is the frozen starting state (R8.9.1), plus every action up to t, in order. The pure function `gameStateAt(edit, t)` computes it.
- **Drawing the state.** The existing React components draw it: `PhoneHub` / `ScreenContentRenderer` screens, My Little List, the compact My Little List overlay (R5), and the stats panel.
  - In the preview they are mounted live.
  - In the render, headless Chromium loads a render-only page from the same frontend build (`/render/stage`). The page reads the state only from injected JSON. It makes no network calls and holds no token.
  - The render saves **one transparent PNG per distinct state, not one per frame**.
- **Motion is drawn by FFmpeg.** Cursor movement and presses, phone slide-in and slide-out, and fades between states are FFmpeg overlay expressions over those PNGs. They are exact to the frame.
- **Cursor movement** follows spec G-1 (natural streamer-style, resting during Lala and NPC dialogue). A cursor needs a hotspot on its asset (architecture A7).

### R8.3.3 Continuous video footage

- The design does not limit gameplay to static phone states (R4 qualification).
- **Recorded gameplay video** is a first-class scene source. An `episode_scene_clips` row with a new `source_kind` `gameplay_recording` plays a recorded screen video on the edit clock, with in and out points, exactly like `angle_video`. Its own audio is muted by default, and can be enabled as its own mix event.
- **Combining footage and states.** A recorded gameplay clip can carry state actions on top of it, for example a toast or a My Little List tick drawn over the recording.
- **Sync with Prime.** When a gameplay recording was captured together with one of Prime's takes, it is placed against that take's clock with a fixed sync offset (`item_start` on the Prime segment, plus an offset). Moving the segment moves the recording, and trimming the segment never slides one against the other.
- **Capture.** How a gameplay recording is captured inside Prime Studios is an open question (R8.16 Q1). It is not needed for the PoC (R4).

## R8.4 One synchronised edit clock (Gate 1 addition 3)

These invariants are stated here and tested by R8.11:
1. **Prime's video and commentary share one source clock.** This is unchanged from R2.2 and R7.5. There is no audio-offset column.
2. **Gameplay actions use the edit clock.** Every `gameplay_action`, `phone_screen`, `overlay` and `visual_mode` item resolves through the same anchors as everything else (`beat_start`, `edit_start`, `item_start`; and `line_start` once marks are mapped).
   - An action meant to follow Prime's words is anchored to her Prime segment (`item_start`) plus an offset. Moving or trimming the segment then carries the action with it.
3. **An action's sound moves with it.** An SFX tied to an action is either the action's `sfx_slot` value or an audio item anchored `item_start` to the action.
4. **These never shift an audio event:** a mode change, hiding the PIP, a transition, or switching between state frames.
5. **Frame snapping.** Times are integer milliseconds. The render snaps them to frames at 30 fps with one shared function, which the preview also uses.

## R8.5 `timeline_items` kinds and their values (PROPOSED; built at Gate 2)

**C1b migration (one file, through the Deploy workflow).** All of these are column additions or CHECK changes. There is no new timing table.
- **`timeline_items`:**
  - widen the `kind` CHECK with `visual_mode`, `gameplay_action`, `phone_screen` and `overlay`;
  - add `duration_ms INT NULL CHECK (duration_ms > 0)`. Items are single instants today, and an overlay or a timed screen needs a length.
- **`episode_beat_production`:** add `visual_mode VARCHAR(16) NULL CHECK (visual_mode IN ('gameplay','cinematic'))`.
- **`episode_pip_settings`:** add `mode_presets JSONB NULL`.
- **`episode_scene_clips`:** widen the `source_kind` CHECK with `gameplay_recording`. This can wait until recorded gameplay is built.
- **`episode_beat_reviews`:** a new table (R2, R8.7).
- **`render_jobs`:** its own migration file (R8.9).

**Per-kind `values`, validated by the service.** Today `values` is free JSON. After C1b, a write with an unknown key or a value out of range is refused.

| Kind | `values` | Needs `duration_ms` |
|---|---|---|
| `visual_mode` | `{ mode: 'gameplay' \| 'cinematic' }` | no |
| `gameplay_action` | `{ action: 'open' \| 'close' \| 'tick' \| 'untick' \| 'press' \| 'move' \| 'toast' \| 'stat', target, cursor_to?: {x,y}, sfx_slot? }` | no (`move` may carry it) |
| `phone_screen` | `{ screen_key, content_ref? }` | yes |
| `overlay` | `{ asset_id }` or `{ widget: 'mll_compact' \| 'stats' }`, `layout: {x,y,w,h}`, `layer` | yes |
| `transition` (the kind exists) | `{ type: 'cut' \| 'crossfade' \| 'dip_to_black', duration_ms }`. It is placed at a scene-clip cut or at a `visual_mode` change. Half the window falls on each side; a source that runs out holds its last frame, with the existing `scene_clip_holds_last_frame` warning. **The clock never moves.** | no |

**Proposals and acceptance.** The `timeline_items` columns `origin` (`auto`, `user`, `director`), `approval` (`pending`, `approved`, `rejected`) and `proposal_id` already exist and are unused.
- **Proposed** actions from the script's `[UI:]` tags, and later from the Gameplay Director, are written with `origin` `auto` or `director` and `approval` `pending`.
- **A pending item plays in working previews** with a "proposed" mark, and is a blocking finding for review-ready and final output.
- **Accepting** a proposal sets it to `approved`. **Rejecting** it soft-deletes it, so it is not proposed again for the same anchor (spec §6.3).

**New findings** (all severities are the Revision 7 pattern):
- **`gameplay_proposal_pending`** (blocking for review-ready and final; a warning in working previews);
- **`overlay_asset_missing`** (blocking);
- **`audio_asset_missing`** (blocking);
- **`audio_item_beyond_source`** (blocking): an item longer than its probed file;
- **`audio_licence_missing`**, **`audio_licence_expired`** and **`audio_licence_scope`** (all blocking before final approval, R8.8);
- **`transition_not_at_cut`** (blocking);
- **`game_state_unknown`** (blocking): an action whose target is not in the frozen state, for example a list item that does not exist.

## R8.6 Beat production status and staleness (ruling C; Gate 1 addition 5)

`beatStatus(edit, findings, inputs, reviews, renders)` is pure and runs on the server. **The first row that matches wins:**

| Status | Derived from |
|---|---|
| **Rendered** | The beat is Approved, **and** a `render_jobs` row in state `done` covers the beat with a manifest whose hash for this beat equals the current beat content hash |
| **Approved** | The latest `episode_beat_reviews` row for the beat is `approved`, **and** its `content_hash` equals the current beat content hash |
| **Needs review** | Assembled, with no blocking finding for the beat, and no current approval. This includes a stale approval, and changes requested, which is shown with its note |
| **Draft assembled** | The beat has C1 rows, and a blocking finding remains |
| **Ready to assemble** | All inputs exist, and the beat has no C1 rows |
| **Missing assets** | An input check fails, or a beat finding of the source family is present (`scene_source_missing`, `prime_source_missing`, `line_audio_unapproved`, `overlay_asset_missing`, `audio_asset_missing`, `game_state_unknown`) |
| **Not started** | No scene plan, no take, no line context and no C1 rows for the beat |

**Input checks** (all read existing tables):
- the beat's `scene_plans` row names an angle that has media;
- a `justawoman` raw clip covers the beat when `prime_mode` is `required` (`beat_number`, `end_beat_number`, `beat_marks`);
- each spoken line of the beat has a playable approval (Voice Studio's state rule, R6.2);
- each overlay and audio item points at a live asset.

**The beat content hash** is the sha256 of the stable JSON (`stableJson`, as `edit_versions` uses) of every material input to the beat:
- **The beat's edit rows:** its live C1 rows. That means its beat-production row, its scene clips, the segments and items placed over it, its audio items (an item spanning several beats is in each), its visibility rules, and the PIP settings.
- **Media identity, not only row ids:**
  - for a raw clip, its storage key and its cutout's key;
  - for an angle, its still and video URLs;
  - for an asset, its storage key and `updated_at`.

  A revised upload, a new cutout or a regenerated angle therefore changes the hash.
- **Voice:** each placed approval's revision (trim, gain, fades, normalise, its `settings_hash`) and its source asset's sha256.
- **Script:** the beat's script lines (`script_seq` and the lines' text).
- **Game and money:** the frozen game state the beat reads (the My Little List and wardrobe state, and the money values from the one money service, R8.12).
- **Licences:** each audio asset's licence record.

**Staleness.** Any change to a material input changes the hash. A beat that was Approved then reads **Needs review**, with the changed inputs listed. Nothing re-approves automatically.

## R8.7 Beat approval and final episode approval (Gate 1 addition 8)

- **The beat review record.** `episode_beat_reviews` is append-only and never updated (removal is a soft delete through `deleted_at`). Its columns:
  - `id`, `episode_id`, `beat_number` (1–14);
  - `decision`: `approved` or `changes_requested`;
  - `note`;
  - `content_hash`, `edit_revision`;
  - `reviewed_by`, `reviewed_at`;
  - `deleted_at`.
- **Who may record a review.** Approving or requesting changes is ADMIN-only.
- **When approval is allowed.** Approval is refused while the beat has a blocking finding. The approval is bound to the beat content hash at that moment.
- **Final episode approval is a separate act.** It is not the sum of the beat approvals. It requires:
  - all 14 beats Approved (current hashes);
  - a full-episode review-ready render, in state `done`, of exactly those hashes, which Evoni has watched in the app;
  - the episode-level checks: zero blocking findings; total duration; loudness; every audio licence valid for the release, by scope and by expiry on the approval date (R8.8);
  - Evoni's explicit "Approve episode" action.

  It writes a frozen production manifest (A10: content-addressed media, resolved takes, `prime_mode` and `visual_mode` frozen, with who approved and when). **The final MP4 is rendered only from that manifest.** The manifest's table and flow are built after the PoC (R8.14 Stage 5). The PoC's approval is beat-level plus Evoni's sign-off on the PoC render.

## R8.8 The music and SFX library and its licences (ruling 7; R6)

- **Storage.** Each music and SFX file is an `assets` row. The category enum already includes `music` and `sfx`.
  - On upload, the file is probed for length and channels and hashed (sha256).
  - The spec §9 slot names (`click`, `hover`, `select`, `open`, `close`, `notify`, `dramatic`, `error`, `tick`, `voice_on`, `whoosh`) map to chosen assets.
- **The licence record** is in `assets.metadata.licence`, validated by the service on every write. Required fields:
  - `source` (where it came from) and `licensor`;
  - `licence_type`;
  - **`permission_scope`**: the platforms (for example YouTube, social clips); monetisation allowed or not; the uses (background, theme, SFX); the territory; whether attribution is required;
  - **`evidence`**: a stored proof file (an asset id) and/or a licence or order reference;
  - `acquired_at`;
  - **`expires_at`** (`null` means perpetual, stated explicitly);
  - `attribution_text` when attribution is required.
- **Checks:**
  - A working preview may use an asset with an incomplete record, and shows a warning.
  - A review-ready render and **final approval refuse** an asset whose record is missing (`audio_licence_missing`), expired on the approval date (`audio_licence_expired`), or whose scope does not cover the release platform and monetisation (`audio_licence_scope`).
  - An expiry within 30 days of approval is a warning. The number of days is Evoni's to set.
- **No sound is ever invented** (spec G-2). An empty slot plays silence and gives a finding.
- **Later.** A dedicated licence table with history can replace the metadata if Evoni wants one. The validated fields carry over unchanged.

## R8.9 Render jobs (amends R2.4; Gate 1 addition 6)

`render_jobs` (PROPOSED migration). Its columns:
- `id`, `episode_id`;
- `kind`: `beat`, `range`, `working`, `review` or `final` (`final` is reserved until A10);
- `range_start_ms`, `range_end_ms`;
- `status`: `queued`, `claimed`, `running`, `done`, `failed`, `cancelled` or `expired`;
- `attempt`, `retry_of`;
- `inputs_hash`, `manifest` (JSONB, or an S3 key when large);
- `claimed_at`, `heartbeat_at`, `started_at`, `finished_at`;
- `cancel_requested`;
- `error_code`, `error_message`;
- `output_s3_key`, `output_sha256`, `output_probe` (JSONB);
- `runtime_ms`;
- `created_by`, timestamps, `deleted_at`.

### R8.9.1 The frozen manifest

When a job is created (ADMIN, in the app), the API resolves everything the render needs into one manifest:
- the layers and the mix events for the range;
- every media storage key, with its size and sha256 where known;
- each voice revision's trim, gain, fades and normalise;
- the starting game state and every action;
- the fonts and the render settings.

The API hashes the manifest (`inputs_hash`). The render host renders only what the manifest says.

### R8.9.2 Lifecycle

| Concern | Rule |
|---|---|
| **Claiming** | The host claims one job at a time. The claim is an atomic update from `queued` to `claimed`, and only one claimant can win. It receives the manifest, short-lived presigned GET URLs for the inputs, and one presigned PUT URL for a temporary output key |
| **Heartbeat** | Every 15 s while running. With no heartbeat for 2 minutes, the job is `failed` (`heartbeat_lost`). A job is never resumed half-written |
| **Timeouts** | Wall clock: 3× the range length plus 10 minutes. A job past it is `failed` (`timeout`), and the host kills ffmpeg and Chromium. A queued job not claimed within a set time (default 2 h) becomes `expired`, with a visible reason (for example, host not running) |
| **Cancellation** | The editor sets `cancel_requested`. The host checks it between chunks and at every heartbeat, kills its child processes, deletes its temporary files and reports `cancelled`. A heartbeat reply tells the host when a job was cancelled |
| **Cleanup** | The host deletes its job directory on every outcome, and sweeps leftover job directories when it starts. Temporary output keys live under `renders/tmp/`, which has an S3 lifecycle rule that expires them. A job's output is copied to its final key only after the ffprobe gate passes |
| **Output gate** | ffprobe must confirm: H.264, yuv420p, 1920×1080, SAR 1:1, constant 30 fps, AAC 48 kHz stereo, the duration within ±1 frame, faststart, and loudness within its target (R8.11). Otherwise the job is `failed` (`output_check_failed`) with the measured values |
| **Visible errors** | Every failure has an `error_code` from a fixed list and a plain message. The editor's job list shows both, with the job's runtime and its findings. No error is swallowed (every catch logs) |
| **Safe retry** | **There is no automatic retry.** "Render again" creates a new job with `attempt + 1`, `retry_of`, and a newly frozen manifest (the same `inputs_hash` if nothing changed). Failed jobs are kept for diagnosis. A late "complete" from a job that is `failed`, `cancelled` or `expired` is refused, so a stale output never becomes current |
| **Limits** | One job at a time per host. At most one queued job per episode. A daily cap on jobs. Jobs are refused when the monthly cost ceiling is reached (R8.10) |

## R8.10 The render host (ruling 3; R7, R8; Gate 1 addition 7)

### R8.10.1 Design

1. **Stateless.** The host holds no database credentials ("Database credentials stay on the server"), no Cognito access, and opens no inbound ports. It is managed through SSM only.
2. **No S3 permissions.** Its instance role can only use SSM and read its own worker token. Every input and output is a presigned URL for one job.
3. **Locked-down egress.** Network egress is limited to S3 (through a VPC endpoint), the API's HTTPS endpoint and the SSM endpoints.
4. **Worker token (R7).** A worker token stored as an SSM SecureString that only the host's role may read. Evoni creates it and can rotate it.
   - It is valid only for the claim, heartbeat, complete and fail routes. It cannot read or write editor data.
   - The API compares it in constant time.
5. **Pinned software.** ffmpeg (libx264, the libvpx-vp9 decoder for alpha, libopus, aac), Chromium and the fonts (Lora, DM Mono) are installed at pinned versions. A reviewed script in the repository does it, and Evoni runs it. No session fetches and runs an installer from a URL.
6. **Worker code delivery.** The worker code arrives through a render-host job in the Deploy workflow (a reviewed PR; Evoni approves each run). The frontend's `/render/stage` page is built on the GitHub runner, not on the host.

### R8.10.2 Idle stop

- **Primary.** The worker shuts the instance down after 15 idle minutes (no job claimed or running). The instance's shutdown behaviour is set to *stop*, never *terminate*.
- **Backstop.** A CloudWatch alarm on low CPU over 30 minutes stops the instance through an EC2 alarm action. It needs no Lambda.
- **Verified before relying on it.** At Gate 6, Evoni starts the host, leaves it idle, and confirms in the console or through Diagnostics that it stopped by itself within the window. **Both mechanisms are tested**, the backstop with the worker stopped.

### R8.10.3 Cost ceiling

- **Explicit.** Evoni sets a monthly ceiling (R8.16 Q2).
- **Enforced twice:**
  - **In the app.** The API totals `render_jobs.runtime_ms` for the month, multiplied by the configured hourly rate. It refuses new jobs once the ceiling is reached, and shows the month's spend and the ceiling on the render panel.
  - **In AWS.** An AWS Budget alerts Evoni at 50 %, 80 % and 100 % of the ceiling.

### R8.10.4 Verified before anything is provisioned (R8 qualification)

| Check | What must be verified | By whom |
|---|---|---|
| **Pricing** | Current on-demand (and spot, if considered) rates for the candidate types in the account's region; the EBS, VPC endpoint (interface endpoints for SSM have an hourly cost; the S3 gateway endpoint is free), CloudWatch and data-transfer costs, from the AWS pricing pages or the account's billing console | a session reading public pricing pages, and Evoni in her console |
| **Capacity** | Measured render speed for the PoC manifest on the candidate type (a local measurement on fixture media first, Gate 3); peak memory with Chromium and ffmpeg together; disk for a full episode's inputs, intermediate chunks and output | the Gate 3 local proof, then a measured first run |
| **Security** | The role policy (SSM-only plus one parameter), the security group (no inbound), the egress rules, the token's scope, the presigned URL lifetimes; reviewed as files in a PR | the PR review, then Evoni |
| **Running costs** | A monthly estimate at the expected render hours, the idle-stop behaviour, and the budget alerts in place | the PR, then Evoni |

**Planning figures (unverified):** on-demand c7i.large is about $0.09 an hour, and c7i.xlarge about $0.18 an hour. At about 20 render-hours a month, the compute is roughly $2–4, plus about $2.40 a month for 30 GB of gp3 disk. These are **not** decisions. They are replaced by the verified figures above.

## R8.11 Preview and render parity (R10)

1. **One pure core.** `editTimeline` (the clock, `layoutAt` and its layers, `modeAt`, `gameStateAt`, `mixPlan`, the findings, `beatStatus` and the content hash) has a byte-identical frontend copy. A CI test fails if the copies differ, as for the shared line-context rule.
2. **One set of components.** The preview and `/render/stage` mount the same layer components.
3. **A golden fixture edit.** A fixture episode in the repository uses only generated media:
   - an ffmpeg `lavfi` colour-bar scene;
   - a "clap" take with a flash frame and a beep;
   - tone-burst dialogue;
   - a click SFX;
   - a test cutout WebM with alpha;
   - test overlay PNGs.
4. **Picture.** Frames are extracted from the render and compared with Playwright captures of the preview at the same times (before and after a mode change, mid-crossfade, during a tick, PIP shown and hidden).
   - Scene and video layers: SSIM ≥ 0.97.
   - Phone, overlay, cursor and stats layers: **identical pixels**, measured on the state PNGs against the preview's layer canvas.
5. **Timing.** Every audio event's onset in the rendered file is within ±1 frame (33 ms) of its `mixPlan` start. The clap's flash and beep coincide within ±1 frame. A mode change and an action's SFX land on their anchor frames.
6. **The file.** The R8.9.2 output gate. Loudness is measured with `ebur128`: integrated −14 LUFS ±1 and true peak ≤ −1 dBTP.
7. **Determinism.** The same manifest gives the same `inputs_hash`. Two renders with fixed thread settings give identical per-frame hashes, or SSIM 1.0 where the encoder is not bit-exact.
8. **CI.** A job with pinned ffmpeg and Playwright Chromium runs on the fixture media. It is a workflow-file PR, never dispatched by a session.

## R8.12 Money, the runway agreement, the outfit snapshot and the scoring audit (rulings 9–11; R9; R11; Gate 1 addition 10)

### R8.12.1 One money service (ruling 10)

One deal-aware service supplies every financial figure the app or an episode shows:
- the Start Episode estimate (`calculateFinancials` in `episodeGeneratorService`, which today counts `cost_coins` and `payment_amount`);
- the script prompts (`groundedScriptGeneratorService`'s stat-line instruction and beat rules);
- the invitation's money text (`describeInvitationMoney`);
- the stats panel;
- the phone's finance screen;
- the render's game state.

On a deal event with the entry covered, every display shows the entry fee **waived** (never a −50 cost), and the 439-coin Pulse Reel fee as income.

### R8.12.2 The runway opportunity alongside the 439-coin terms (ruling 9; addition 10)

- **The runway is a separate opportunity.** It is an `opportunities` row of type `runway`, linked to the event and the episode, with its own offered amount, its own fee'd deliverable (`opportunity_id`) and its own letter key.
- **It is never folded into the original deal.** It is excluded from the original deal's terms snapshot (`buildTermsSnapshot` in `eventTermsService`), its letter, and the letter's `terms_key` fingerprint (`eventDocumentsService`).
- **Invariant:** no code path may change, replace or re-derive the original approved terms when the runway is added, and none may silently. A write that would alter an approved deal's terms is refused with a visible error.
- **Tests:**
  - the original 439-coin terms, the letter and `terms_key` are byte-identical before and after the runway is added;
  - the runway is paid once, at its own approval;
  - the money service lists the two agreements separately.

### R8.12.3 The outfit continuity snapshot (ruling 11)

- At episode completion, the final outfit (its items, their scores, and the formula and weight version used) is written to an **immutable** continuity snapshot. Later wardrobe edits never change it.
- It is the source for continuity in later episodes and for any outfit display in the render.
- Its table is PROPOSED with the P-track work (R8.14), as its own migration.

### R8.12.4 The scoring audit (R9: deferred)

Before any weight changes, an audit records:
- the intended outfit-scoring formula, from the specs and Evoni's earlier rulings;
- what ×0.25 (`evaluation.js`) and ×0.35 (`episodeCompletionService.js`) each mean, and where each applies;
- the breakdown signal-name mismatch (`wardrobe.js`);
- the effect of each choice on **historical results**, recomputed read-only from stored data where it exists.

It then recommends one correction, with regression tests that pin:
- the agreed formula;
- the historical results it keeps or changes, each listed.

**No number is chosen arbitrarily.** The snapshot (R8.12.3) records which formula version produced a score.

## R8.13 Security assumptions

1. **Sessions.** No session holds credentials, contacts a host, AWS, the database or Cognito, or dispatches or approves a workflow (CLAUDE.md). Production checks go through the app, or through the Diagnostics workflow once Evoni has set it up.
2. **The production API.**
   - It keeps its database credentials. They never leave it.
   - Render, review, approval and library writes are `requireAuth + authorize(['ADMIN'])`.
   - The worker routes accept only the worker token and expose no editor data.
3. **The render host** is stateless and limited as described in R8.10.1. A compromised host exposes one job's media for the lifetime of its presigned URLs, not the studio.
4. **No user text reaches an FFmpeg filter.** All text (names, captions, list items, money) is drawn as PNG by the React components, so there is no `drawtext` injection. FFmpeg arguments are built only from validated numbers and the presigned URLs.
5. **Chromium** runs as a non-root user, with its sandbox on. It loads only the bundled `/render/stage` page, with no token, cookies or API access. Network is blocked except to the job's presigned media.
6. **Outputs** go to a private prefix (`renders/…`) and are downloaded only through a signed link. This deliberately departs from today's public-style media URLs, which stay on the security backlog.
7. **Licences** are checked before final approval (R8.8).
8. **Supply chain.** All tools are at pinned versions, installed by a reviewed script that Evoni runs.

## R8.14 Dependencies and implementation sequence

**Each gate needs Evoni's own approval before it starts**, and each PR needs her yes to push, open, merge and deploy (Rule 7). Nothing in a gate authorises the next gate.

| Gate | Work | Production impact |
|---|---|---|
| **1** | **This revision and the spec's Rev 6** (documentation PR) | none |
| **2** | The C1b schema and service writes, with per-kind validation; the `editTimeline` layers, `modeAt`, `gameStateAt`, transitions, `beatStatus` and the content hash; the byte-identical frontend copy; `episode_beat_reviews`; the library's licence validation. **Alongside: P1, the one money service** (R11: early) | migrations written, not deployed |
| **3** | The Guided view for a beat (status, script, actions, missing items, adjust, approve or request changes) and the preview player; assembly (dry run and apply, `[UI:]` tags become pending proposals); the render pipeline as code (`render_jobs`, the manifest, the worker routes, the worker, `/render/stage`, the graph builder, the output gate). **A local proof** on fixture media: an MP4, screenshots at 375 px and desktop, and the parity results, delivered to Evoni | none |
| **4** | Evoni approves the Deploy run for the migrations and switches `EPISODE_EDIT` on | Deploy run, flag |
| **5** | The render-host runbook and its policies as reviewed files; the Deploy workflow's render-host job; the pinned install script; idle stop and the cost ceiling. **The R8.10.4 verification** | none until Evoni acts |
| **6** | Evoni provisions the host and the token, and approves the run that installs and starts the worker. **The idle stop is verified** | infrastructure |
| **7** | **The production PoC** on Episode One (R8.15.2), made in the app | in-app only |

**After the PoC: Stage 5, each part separately approved.**
- **A passing PoC does not authorise full production.**
- Full rollout needs Evoni's own approval of a Stage 5 plan:
  - the Advanced Timeline;
  - all 14 beats of gameplay;
  - line-mark mapping;
  - Gameplay Director proposals;
  - recorded gameplay capture (R8.16 Q1);
  - the A10 manifest and final episode approval;
  - retiring the legacy editor and export.
- **Before full Episode One production: P2**, the runway opportunity (R11).

**The P-track** (each its own PR, sequenced by Evoni):

| Item | When | Notes |
|---|---|---|
| P1 one money service | with Gate 2 | — |
| P2 the runway opportunity | before full Episode One production | — |
| P3 the outfit continuity snapshot | — | the scoring weight only after the R9 audit |
| P4 the offer letter as a screen on Lala's phone | — | today the phone reads only `UI_OVERLAY` assets (`phoneOverlays`), so the `DOCUMENT_OVERLAY` offer letter does not appear |

**What does not change:**
- the legacy editor and export, until the new workflow passes testing;
- `episode-worker`;
- the Deploy workflow's existing jobs.

## R8.15 Acceptance criteria

### R8.15.1 Per gate

| Gate | Accepted when |
|---|---|
| 2 | Every C1 test still passes. Golden unit tests cover each new kind, `modeAt` (a mid-beat change moves no time, checked with `timingChanges`), transitions, `gameStateAt`, `beatStatus` (each of the seven statuses from fixture state) and staleness (each class of material input in R8.6 changes the hash). The frontend copy is byte-identical. Validation refuses unknown values. P1 shows the waived entry and the 439 income in every display, with a test per display |
| 3 | The local proof plays and renders the PoC shape on fixture media and meets R8.11. A cancelled job leaves nothing behind. A killed worker's job is `failed` (`heartbeat_lost`). A late complete is refused. A second claim cannot win |
| 4 | The migrations apply through the Deploy workflow with its snapshot. `EPISODE_EDIT` is on. The Guided view opens Episode One |
| 5–6 | The R8.10.4 checks are on record. The host has no inbound ports, an SSM-only role and a scoped token. Idle stop and the backstop are both observed to work. The budget alerts exist. The in-app ceiling refuses a job when reached (tested) |
| 7 | R8.15.2 |

### R8.15.2 The proof of concept (ruling D)

**The sequence.** 60–90 seconds of Episode One containing:
- JustAWoman actively playing the fashion game (R4: the phone's wardrobe screen);
- her synchronised PIP commentary;
- a real phone interaction (for example the invitation, or the offer letter once P4 lands);
- a visible My Little List update, on the full screen or the compact overlay;
- at least one approved character dialogue take, placed by hand;
- music and an SFX (licensed, with complete records);
- a transition between gameplay and cinematic visuals, at a timed mode change.

**The file and sync.** Generated, previewed and approved entirely inside Prime Studios, and meeting:
- the output gate (R8.9.2) and the R8.11 thresholds;
- Prime's commentary in sync within ±1 frame;
- each dialogue line and the SFX within ±1 frame of their anchors;
- the mode change on its frame;
- the money shown, from the money service.

**The process:**
- The beats move through Ready → Draft → Needs review → Approved → Rendered from real actions. A changed input makes an approval stale.
- The API stays healthy throughout.
- The render cost is recorded against the ceiling.

**Evoni's sign-off on the MP4 is the final gate.**

## R8.16 Open design questions

| # | Question | Needed by |
|---|---|---|
| Q1 | **How is recorded gameplay video captured inside Prime Studios?** For example, screen capture in the Teleprompter while Prime plays, recorded with her take on one clock. And how is the recording's sync to her take measured? A clap or flash marker, or manual alignment | Stage 5 (not the PoC) |
| Q2 | **The monthly render cost ceiling**, and the warning threshold before licence expiry (30 days proposed) | Gate 5 |
| Q3 | **The default visual mode** for a beat with no row: gameplay (proposed), or per beat by its script (a beat with `[UI:]` lines is gameplay, otherwise cinematic) | Gate 2 |
| Q4 | **The compact My Little List overlay:** its default position and size, and whether it shows throughout gameplay or only when the list changes | Gate 3 |
| Q5 | **After the PoC**, may the API start the render host itself (a narrowly scoped `ec2:StartInstances` on that one instance, an IAM change Evoni makes), or does Evoni always start it? | Stage 5 |
| Q6 | **Licence expiry after release:** when a music licence expires after an episode is published, what is required? Nothing; a re-check; or a re-render without that track | before final approval is built |
| Q7 | **Is ×0.25 or ×0.35 (or neither) the intended outfit weight?** This is answered by the R9 audit, not here | P3 |

---

# Revision 7 (as built: Timeline C1; Evoni's rulings 2026-10-28)

**Where Revision 7 disagrees with earlier text, Revision 7 wins.** It records what Timeline C1 was built to after Evoni's review of the measured clock drift and her final C1 rulings (2026-10-28). Code is cited by name: `src/utils/editTimeline.js` (the pure clock, layout, mix and findings), `src/services/episodeEditService.js`, `src/routes/episodeEditRoutes.js`, migration `20261028100000-create-episode-edit-tables`.

## R7.1 The edit clock: stored beat durations

**Finding (C1, measured 2026-10-28):** with each beat as long as its scene clips, replacing beat 3's 10 s clip with a 6 s one moved beat 5 from 40 s to 36 s. A whole-episode Prime take then showed its 36 s moment where its 40 s moment had played, music anchored to beat 5 moved 4 s, and an SFX at an absolute 43 s moved from 3 s to 7 s into beat 5. The only finding was a warning.

**Ruling (Evoni, 2026-10-28): stable beat timing.**
- `episode_beat_production.duration_ms INTEGER NULL CHECK (duration_ms > 0)`.
- **NULL is draft timing:** the beat lasts as long as its scene clips (each clip's own `duration_ms`, in position order).
- **A stored length is authoritative.** The beat lasts exactly that, whatever its clips. Clips fill it in position order and are cut at its end; a clip wholly past the end plays nothing. Replacing, trimming, splitting or removing a scene clip never changes the length and never moves anything after the beat.
- **Gaps and overruns never change the clock.** Clips short of the length leave `scene_gap`; clips past it are cut, `scene_overruns_beat`. Both block review-ready and final output (R7.6). The working preview shows the beat with no scene where no clip covers it (`layoutAt` gives `scene: null`, `scene_gap: true`), with the finding as a warning on screen.
- A beat with no clip is `scene_missing` (blocking); a locked one keeps its length.
- The beat-production row keeps its history: every change of mode or length soft-deletes the current row and writes a new one carrying forward what was not changed. No row means Prime required, draft timing.

## R7.2 Locking timing and changing a locked beat

- **`lockBeatTiming`** stores the length of all 14 beats in **one transaction, all or none**. A beat already locked keeps its length (changing it this way is refused, `BEAT_ALREADY_LOCKED`). An unlocked beat gets the length given for it, else its draft length now. A beat that would have no length refuses the whole lock (`BEAT_HAS_NO_LENGTH`); with every beat already locked it is `TIMING_ALREADY_LOCKED`.
- **C2's first assembly locks all 14 beat durations in that one operation** (R7.7), so no one locks 14 beats by hand.
- **`setBeatDuration(beat, ms | null)`** is the only write that changes a locked beat's length (or clears it to draft timing). It is explicit, never a side effect of a scene-clip edit (guarded by a test: only `setBeatMode`, `setBeatDuration` and `lockBeatTiming` write the beat-production row).
- **Dry run first.** `dry_run: true` writes nothing and needs no `edit_revision`. It answers with every downstream time that would change (beats, Prime segments, dialogue placements, music, SFX, timeline items, visibility ranges: `timingOf` / `timingChanges`), the edit's length before and after, the findings it adds and clears, and `for_edit_revision`. The write sends that revision: if the edit changed in between it is a 409 and nothing is written, so what was previewed is what is applied.
- Routes: `POST /beats/:beat/duration` (`{ duration_ms, dry_run }`), `POST /beats/lock` (`{ durations? }`), both ADMIN.

## R7.3 Anchors, and no estimated line timing

Everything other than scene clips is placed by an anchor plus `offset_ms`:

| Anchor | Resolves to |
|---|---|
| `beat_start` | the beat's start (`anchor_beat`) |
| `edit_start` | **new:** the edit's start; an absolute timeline position |
| `line_start` | a line's recorded time (teleprompter marks), when mapped |
| `item_start` | a timeline item's own resolved time |

**Ruling (Evoni, 2026-10-28): no fabricated line timing.** The instruction to estimate missing line times (§5.3, spec §3) is **superseded**. A `line_start` anchor without an actual recorded mark stays unresolved and is `line_timing_unknown`, **blocking**, wherever it is used (Prime segments, timeline items, music and SFX, visibility ranges). No automatic estimate may stand in for a recorded mark. In C1 no marks are mapped (`lineTimes` is empty, guarded), so `line_start` never resolves yet.

## R7.4 Manual dialogue placement

**Ruling (Evoni, 2026-10-28):** dialogue is placed explicitly, as a `timeline_items` row of kind **`dialogue_placement`**.
- **Identity.** Each placement names the exact line association (`voice_association_id`) and approval (`voice_approval_id`), both foreign keys to the Voice Studio tables, and the line (`line_beat`, `line_index`: the line as B1 approves it, R6.3).
- **Position.** Beat-relative (`beat_start` + offset) or absolute (`edit_start` + offset) only. A database CHECK refuses a line mark (`line_start`) or an item anchor for a placement, and refuses those four columns on any other kind.
- **One live placement per script line**, enforced by the service (`LINE_ALREADY_PLACED`, naming the existing one) and by a partial unique index on `(episode_id, line_beat, line_index)` of live placements. Two placements sent from one view: the edit-revision lock refuses the second; the index is the backstop.
- **Placing** (`placeDialogue`): the approval must be current and playable (Voice Studio's state rule, R6.2) for exactly that association, checked before the edit is locked and again inside it. **Moving** (`moveDialogue`) changes the position only, never the take. Removing is a soft delete.
- **Playback.** A placement plays only while its named approval is the current one for that association and line. Its length is the approved revision's trim (`in_ms` to `out_ms`), never past the source's measured `duration_ms`; gain, fades and normalise come from the same revision. `mixPlan` emits one dialogue event per playable placement.
- **No substitution.** A new approval for the line, a re-trim (`outdated_take`), a re-tied take (`invalid`), a script save (`needs_review`), a revoke: the placement stays, plays nothing, and is `dialogue_take_not_current` (**blocking**), naming the line's current approval when there is one. Nothing switches it to another take. After a person re-confirms (R6.2), the same placement plays again.
- **Stale placements are kept, protected.** A placement whose approval is no longer current is never removed or re-pointed automatically. Re-placing the line is explicit: remove or move the stale one first. **C2 provides a Resolve Placement workflow** to review each stale placement and move, keep or remove it.
- **Crossing a beat boundary is permitted:** the dialogue plays in full; while it stays inside the edit and its approval is current, `dialogue_outside_beat` is a warning only.
- **Overlap is allowed:** overlapping placements both play, at their own gain; neither is muted or ducked automatically. `dialogue_overlap` is a warning.
- **Beyond the edit** (starting before 0 or ending after the edit's end): `dialogue_beyond_edit`, **blocking**; the mix cuts it at the edit's edges.
- **Unplaced:** an approved spoken line (a playable approval) with no placement is `dialogue_unplaced`, **blocking**. A spoken line with no approved take is `line_audio_unapproved` (blocking), as before.
- Routes: `POST /dialogue` (`{ approval_id, association_id, anchor_kind, anchor_beat, offset_ms }`), `POST /dialogue/:itemId/move`, `DELETE /dialogue/:id`, ADMIN.
- `audio_offset` (R4.3's dialogue nudge) is reserved and unused; dialogue timing is the placement.

## R7.5 Prime segments, as built (amends R2.2 and R4.3)

- A take may span many beats (a whole-episode recording). What is checked is the segment's **placed interval** on the edit (`segment_before_edit_start`, `segment_beyond_edit_end`, both blocking), never the source's length against a beat. Coverage of each Prime-required beat is unchanged: a gap longer than one frame (33 ms) is `prime_footage_missing`.
- **No commentary is NULL:** `audio_in_ms` and `audio_out_ms` are both NULL with zero fades (a split half the commentary was not in). It is never audible, whatever its mute; the database CHECK states each NULL branch.
- **Video trim is non-ripple:** the frames kept keep their edit time; nothing else moves. A trim that would cut away all of the commentary is refused (`COMMENTARY_OUTSIDE_TRIM`), never a silent mute.

## R7.6 Findings and severity (replaces §5.3's warnings list and R2.3's `take_overruns_scene`)

**Blocking** findings refuse a review-ready preview and the final render. **Warnings** are shown. A working preview is always available, with every finding marked on it.

| Code | Severity | Meaning |
|---|---|---|
| `scene_missing` | blocking | a beat has no scene clip |
| `scene_gap` | blocking | a locked beat's clips are shorter than its length |
| `scene_overruns_beat` | blocking | a locked beat's clips run past its length (cut) |
| `scene_clip_holds_last_frame` | warning | a video clip is longer than its source range (last frame held) |
| `scene_source_missing` | blocking | a scene source was deleted, unlinked or lost its media |
| `prime_footage_missing` | blocking | a Prime-required beat has a gap longer than one frame |
| `prime_source_missing` | blocking | a segment's take was deleted |
| `source_performer_changed` | blocking | a take's performer no longer fits its use |
| `segment_before_edit_start` | blocking | a Prime segment is placed before 0 |
| `segment_beyond_edit_end` | blocking | a Prime segment runs past the edit's end |
| `prime_segments_overlap` | warning | two Prime segments overlap (the later one is drawn) |
| `line_timing_unknown` | blocking | a `line_start` anchor has no recorded mark |
| `anchor_unresolved` | blocking for a segment or dialogue; warning for an item, music/SFX or visibility rule | an anchor's item is missing, a cycle, or no such beat |
| `line_audio_unapproved` | blocking | a spoken line has no current approved take |
| `dialogue_unplaced` | blocking | an approved spoken line has no placement |
| `dialogue_take_not_current` | blocking | a placement's approval is not current (silent) |
| `dialogue_take_bad_range` | blocking | the approved trim is outside the source's measured length |
| `dialogue_beyond_edit` | blocking | a placement starts before 0 or ends after the edit |
| `dialogue_outside_beat` | warning | a placement crosses its line's beat boundary (it plays in full) |
| `dialogue_overlap` | warning | two placements overlap (both play) |

## R7.7 C2 first assembly (amends R5.4 C2 and §7 T2)

- Scene clips per beat and the starred Prime take(s) as segments, as before.
- **Then all 14 beat durations are locked in one `lockBeatTiming` call**, with the lengths the assembly has (for example from Prime's `beat_marks`), the rest their draft lengths.
- **Dialogue is placed automatically only where actual, usable timing marks exist** for the line. Otherwise the approved line stays **visibly unplaced** (`dialogue_unplaced`, blocking) for a person to place. No estimate is made.

## R7.8 C1 schema, as built (amends R4.3)

- `episode_beat_production`: plus `duration_ms` (R7.1).
- Anchors everywhere: plus `edit_start` (needs neither `anchor_beat` nor `anchor_ref`).
- `episode_prime_segments`: `audio_in_ms`, `audio_out_ms` NULL-able, both or neither (R7.5).
- `episode_pip_visibility`: plus `anchor_beat`, `end_anchor_beat`.
- `timeline_items`: kind `dialogue_placement`; plus `voice_association_id`, `voice_approval_id` (FK RESTRICT), `line_beat`, `line_index`; CHECK `timeline_items_dialogue`; unique index `timeline_items_dialogue_line`.
- **Order:** the C1 migration needs the B1 tables (it sorts after B1). A rollback of B1 needs C1 rolled back first (the normal reverse order); C1's `down()` refuses while any of its tables has a row.
- Versions snapshot these columns with the rest; a restored placement whose approval has since changed stays silent and blocking.

## R7.9 Order of changes

1. A1c (#3615) and B1 (#3616): merged.
2. **C1** (`claude/c1-episode-edit`): migration `20261028100000-create-episode-edit-tables`, `editTimeline`, `episodeEditService`, routes off unless `EPISODE_EDIT=on`. Its own PR.
3. `rawClipMedia.uploadFile` stream fix (#3617): independent.

Deploys still run only through the Deploy workflow, with its snapshot; R5.7 stands. B2, C2 and D1 each need Evoni's approval first.

---

# Revision 6 (as built: the script save number, approval states, retention; Evoni's rulings 2026-10-27/28)

**Where Revision 6 disagrees with earlier text, Revision 6 wins.** It records what was decided while B1 was built and reviewed. Implemented locally only: A1c `claude/a1c-script-seq`, B1 `claude/voice-studio-b1`; nothing merged or deployed.

## R6.1 Condition 3: the script revision **and** the script save number

**Finding (B1, 2026-10-27):** the `sr1-` revision is a hash of the text, so A → B → A returns the approved revision. Version rows could not stand in for a save counter either:
- `snapshotScript` keeps no version when the replaced script is empty, and returns the last version instead of a new one when the replaced text equals it. After one A → empty → A round trip, a second one keeps no version at all.
- Versions are ordered by `created_at`, set by the app's clock: two saves in one millisecond, or a clock going back, misorder them. UUIDs are not ordered.

**Ruling (Evoni, 2026-10-28): `episodes.script_seq` is the authoritative per-episode script save sequence.**
- A1c change (its own PR, before B1): `episodes.script_seq BIGINT NOT NULL DEFAULT 0`. `scriptSave` adds one under the episode row lock, inside the save's transaction, whenever the text changes (clearing and restoring included). A lock-only save, a refused save and a rolled-back save take none. Only `scriptSave` writes it (guard).
- It is read and compared as a **decimal string** (`::text`), never as a JavaScript number.
- `snapshotScript` is **unchanged**: its shortcut stays (removing it passes every A1c suite but only duplicates History rows).

**Condition 3, as built:** the episode's current `(script_revision, script_seq)` equals the pair pinned by the approval, or by the latest re-confirmation of it. **Both** are required; existing episodes start at 0 and are pinned at 0.

**Withdrawn while building (do not reintroduce):**
- pinning the episode's `updated_at` (every title, air date or coin edit sent approvals to review);
- pinning the newest script-version id (relied on `created_at` order; missed the empty round trip).

**Unchanged:** conditions 1, 2 and 4; re-confirmation is a person's action; nothing approves or re-confirms by itself.

## R6.2 Approval states (replaces R5.2's state table)

Each approval not superseded is in exactly one state. **Only `current` may be played or exported** (`playableApprovals` is the one list a player or export reads).

| State | Meaning | Action |
|---|---|---|
| `current` | conditions 1–4 hold | none |
| `needs_review` | bound, but the script was saved since (`script_saved`), or only its neighbours changed (`neighbours_changed`) | **Re-confirm**, shown with the line's context now |
| `moved` | the only identical line in the beat is elsewhere | **Confirm the line** (resolve) or withdraw |
| `ambiguous` | identical lines (`ambiguous_duplicate`), or edited with an identical twin elsewhere (`moved_or_edited`) | **Pick the line** (resolve) or withdraw |
| `unbound` | the line is gone: `speaker_changed`, `note_changed`, `words_changed`, `line_removed`, `beat_changed`, `beat_missing`, `duplicate_beat` | recorded `invalid` when a write sees it; approve a new take |
| `outdated_take` | the take was re-trimmed or re-gained | approve the new version |
| `invalid` | recorded: never current again | approve a new take |
| `revoked` | a person withdrew it | approve afresh |

- **Not invalidated by themselves:** `needs_review`, `moved`, `ambiguous`. A neighbour edit never invalidates an unchanged line.
- **Approve** sends `expected_approval_id` (the approval the page saw at the line, or null). Another one there now is a 409 `APPROVAL_CHANGED`; two approvals sent from one view give one success and one 409 (per-line advisory lock).
- **Resolve** re-ties the take to the chosen candidate line and approves it there with the same take revision; the old approval is superseded, kept.
- **History:** superseded, invalid and revoked approvals stay (`approvals/history`).

## R6.3 Approval identity and `occurrence` (amends R2.6 and R4.3)

- An approval's line is `(episode, beat_number, line_index)` in the script it was approved against. Within one script, `(beat, index)` and `(beat, row, occurrence)` name the same line, so `occurrence` adds nothing to identity; it is stored as context and shown.
- At most one approval in force per line, and per take (partial unique indexes). A line whose approval moved or is ambiguous is resolved or withdrawn before another take is approved there.

## R6.4 B1 schema, as built (amends R4.3)

- Approvals: `pinned_script_revision`, `pinned_script_seq BIGINT`, `revoked_at`, `revoked_by`; no `approved_script_revision`, no version id.
- Re-confirmations: `pinned_script_revision`, `pinned_script_seq`, `context_hash` (the line's context when confirmed). Not unique per revision: a revision can come back.
- Routes are at `/api/v1/voice-studio` (`/api/v1/voice` is Lala's written voice), off unless `VOICE_STUDIO=on`. Raw SQL services, no Sequelize models (accepted).
- The B1 migration checks for `episodes.script_seq` first and creates nothing without it (one transaction).

## R6.5 Script-version retention (amends R4.3 Retention)

- **No row in any Voice Studio table names a script version, and no reference provider is added** (Evoni, 2026-10-28). `scriptVersions` and its pruning are as on `main`.
- Approval and re-confirmation rows keep what they approved (words, speaker, line, context hash, revision, save number), so they stay readable after the versions of their day are pruned. Approval rows are never deleted.

## R6.6 Order of changes

1. **A1c script save number** (`claude/a1c-script-seq`): migration `20261027190000-add-episode-script-seq` and `scriptSave`. Its own PR, first.
2. **B1** (`claude/voice-studio-b1`), on 1: migration `20261027200000-create-voice-studio-tables`. A migration-order test proves B1 alone refuses and creates nothing.
3. **`rawClipMedia.uploadFile` stream fix** (`claude/rawclip-upload-stream`): independent; found while testing B1.

Deploys still run only through the Deploy workflow, with its snapshot; R5.7 stands.

---

# Revision 5 (Evoni's confirmations and refinements A–G, 2026-10-27)

**Where Revision 5 disagrees with earlier text, Revision 5 wins.** Design only: nothing is implemented, pushed or deployed.

## R5.0 Confirmed decisions (Evoni, 2026-10-27)

1. **Q19:** E1 now, E2 later, as a separate reviewed change. **B1 does not modify A1c R1's script-save path.**
   > **SUPERSEDED in part (Revision 6):** B1 still does not modify the save path, but the A1c save-number change (R6.1) does, as its own PR before B1.
2. **Q21:** gameplay-only changes **only** the Prime-footage requirement. It never hides footage already placed; PIP visibility settings alone decide whether Prime appears.
3. **Q-F1 / Q-F2:** the amendment of R4.0 is confirmed.
   - No fabricated image or idle clip.
   - Working previews show gameplay with an editing warning.
   - Missing **required** footage blocks review-ready previews and final export.

**Spec Rev 5 G-5, §1, test 24 and decisions §14/§15 level 6 need a matching documentation revision.** It is owed and will be a separate docs PR.

## R5.1 Refinements A and E: coverage is independent of visibility; commentary is never muted by hiding

**A. The coverage rule** (replaces R4.2's "where the PIP is visible"):
- **A `required` beat must be covered by current Prime segments for its whole length**, from beat start to beat end on the edit's clock, **whatever the PIP visibility**.
  - Hiding the PIP in a beat, or in a range, **does not** waive or reduce the requirement.
  - **Only `prime_mode = gameplay_only`**, set explicitly for that beat, waives it.
- A `gameplay_only` beat has no Prime requirement. Footage placed there still appears according to visibility (Q21).
- **What counts as covered:** at each instant of the beat, some current (not superseded, not deleted) segment's video range is placed. Gaps longer than one frame (33 ms at 30 fps) are findings.
  - `prime_footage_missing` (required beat, gap) blocks review-ready and final.
  - In a working preview it's a warning, with the banner of R4.2.
- **The commentary doesn't count by itself.** A segment whose commentary is muted still covers: the requirement is that she was recorded, and the recording exists.

**E. Picture and commentary together** (R2.2, restated with the ruling):

| Situation | Picture | Commentary |
|---|---|---|
| Segment placed, PIP visible | shown | plays (its gain, fades, sub-range) |
| Segment placed, **PIP hidden** (beat or range rule) | not drawn | **plays**: hiding never mutes (decisions §8.1 PIP-R, Q3) |
| Segment placed, commentary **muted** | shown per visibility | silent |
| No segment (required beat) | gameplay full-screen; working-preview banner | silent; no audio invented |
| No segment (gameplay-only beat) | gameplay full-screen; no banner | silent |
| Segment moved, trimmed or split | follows | follows (same source clock; no audio offset field) |

**Acceptance (C1/D1):**
- A required beat that is fully hidden but fully covered has no finding.
- A required beat that is hidden with a gap has `prime_footage_missing`.
- A gameplay-only beat with a gap has none.
- Hiding the PIP leaves the mix plan's commentary events unchanged (the same samples).

## R5.2 Refinement B: the E1 re-confirmation workflow

> **SUPERSEDED (Revision 6):** the state table and reason codes are replaced by R6.2 (`current`, `needs_review`, `moved`, `ambiguous`, `revoked`; `moved` is not unbound). The summary route is `/api/v1/voice-studio/:episodeId/summary`. The batch, the 409 for a stale revision and "never automatic" stand; a re-confirmation pins the revision and the save number (R6.1).

**Where:**
- **The Voice Studio header:** `Re-confirm 12 · Invalid 3 · Unbound 2`, for the episode.
- **The beat chips:** each shows its own count.
- **The Script tab:** a one-line notice with the same counts, linking to Voice Studio.

**The summary**, computed on the server (`GET /api/v1/voice/:episodeId/approvals/summary`), for the current script revision. Each approval is in exactly one state:

| State | Meaning | Action offered |
|---|---|---|
| `valid` | conditions 1–4 hold at this revision | none |
| `needs_reconfirm` | conditions 1, 2 and 4 hold; the script revision changed since the last approval or re-confirm | **Re-confirm** |
| `invalid` | an `invalidated_at` is recorded | **Approve a take** (new approval) |
| `unbound` | condition 4 fails now; reason code given | **Reassign** or **Confirm move** (only for `moved`) |
| `outdated_take` | the take was re-trimmed or re-gained after approval (condition 2) | **Approve the new version** |

**Reason codes**, each shown in words:
- `speaker_changed`, `note_changed`, `words_changed`;
- `moved` (confirm), `ambiguous_duplicate` (pick a line);
- `beat_changed`, `line_removed`;
- `take_changed`;
- `approval_superseded`.

**One-click review of unchanged lines, per beat:**
1. **Review unchanged (9)** opens a list. Each line shows the approved line context beside the current line: identical speaker, note and words, and the same neighbours. **Nothing is pre-checked.**
2. **Select all 9**, then **Confirm these 9 takes still match their lines** opens a confirmation naming the script save (time and who). Pressing **Confirm** is the human action.
3. **The request carries:** `script_revision` and `[{ approval_id, context_hash }]`.
4. **On the server, in one transaction:**
   - `FOR SHARE` on the episode row; the revision must be current, **else 409 for the whole batch, nothing written**;
   - each approval is re-checked against conditions 1, 2 and 4 under `FOR UPDATE` on its candidate;
   - matching ones get a re-confirmation row (who, when, revision, context hash);
   - any that no longer match are returned with their reason and are **not** confirmed.
5. **The response lists confirmed and refused separately.** The page never assumes success.

**Never automatic:**
- no job, script save, page load or render re-confirms or approves anything;
- a re-confirmation can't be made for a revision other than the current one;
- `invalid` approvals can't be re-confirmed.

**Audit:** every approval, re-confirmation, invalidation and move confirmation is a row with who and when. Voice Studio shows a line's history.

## R5.3 Refinement C: server-side validation of every relationship

**All B1 and C1 writes:**
- `requireAuth` + `authorize(['ADMIN'])` (the convention for production writes);
- the episode must exist and not be soft-deleted;
- every child row's `episode_id` must equal the route's episode;
- each write is one transaction.

| Relationship | Validation (server, in the write transaction) |
|---|---|
| candidate → source asset | the same episode; asset not deleted |
| source asset (`extracted`) → raw clip | the clip's `episode_id` equals the asset's; performer is `lala` or `guest` (**never** `justawoman`: Prime's voice is her take); `0 ≤ in < out ≤` the clip's probed `duration_seconds` |
| source asset media | server ffprobe on upload: an audio stream, duration > 0 and ≤ `VOICE_SOURCE_MAX_SECONDS` (600, as today); the type is in the allow-list; sha256 computed on the server |
| candidate revision | `0 ≤ in_ms < out_ms ≤` the source's probed duration; gain −24..+12 dB; fades 0..2000 ms and `fade_in + fade_out ≤ out − in` |
| association → script | the sent `script_revision` equals the episode's current one (`FOR SHARE` on `episodes`); the teleprompter line at (beat, index) re-derived **from the saved script** matches speaker, note, words, row hash and neighbours; the speaker is not Prime; beat 1–14 |
| approval → candidate revision and association | `FOR UPDATE` on the candidate; the revision is the candidate's latest; the association is the current one and resolves **bound** now; the script revision is current; the partial unique index enforces one current approval per line (a race gets 409) |
| re-confirmation | as R5.2 |
| scene clip → `angle_still` / `angle_video` | the angle exists and isn't deleted; its scene set is linked to this episode (`scene_set_episodes`); a still needs `still_image_url`, a video needs `video_clip_url` |
| scene clip → `raw_clip` | the same episode; performer `lala` or `guest`; not deleted |
| scene clip media duration | **finding:** `scene_angles.video_duration` is the requested generation length (default 5, set by `sceneGenerationService` / `venueGenerationService`), **not a measured one**. So a video scene clip stores `source_duration_ms`, measured by server ffprobe on the clip URL (timeout 20 s) when placed. A failed probe refuses the placement with a message. `source_out_ms ≤ source_duration_ms`; raw clips use their probed `duration_seconds` |
| Prime segment → raw clip | the same episode; performer **`justawoman`**; not deleted; `0 ≤ source_in < source_out ≤` the probed duration; the audio sub-range is inside it (CHECK) |
| beat production | beat 1–14; `prime_mode` one of two; a change supersedes |
| visibility rule | beat 1–14 or a valid anchored range; the anchor target exists in this episode |
| timeline item / audio item | the target exists in this episode (scene clip, line association, Stage object id); `kind` is in the allowed set |
| **concurrent edits (C1)** | every write sends `edit_revision`; the transaction takes `FOR UPDATE` on `episode_edit_state`; a mismatch gets 409 with the current revision; a success bumps it. No silent merge |
| **concurrent edits (B1)** | candidate-level `FOR UPDATE`; the script revision is checked under the episode `FOR SHARE`; unique indexes for one current association and one current approval |
| raw clip performer changed later | segments and sources re-check the performer when read for render; a mismatch is the finding `source_performer_changed` (blocks review-ready) |

**What the database can enforce:** CHECKs for ranges and enums, partial unique indexes, and foreign keys with RESTRICT.

**What only the service can enforce:** checks against another table's column (performer, scene-set link, durations), held under row locks. Each is a named unit or integration test (R5.5, R5.6).

## R5.4 Refinement D: the first playable MP4, stage by stage

> **SUPERSEDED in part (Revision 8, R8.14):** the sequence is R8.14's gates; music and SFX, overlays and gameplay are in the proof of concept, and D1 runs on the separate render host (R8.10).


**Layer 1, database foundations** (no UI; each its own PR and its own migration deploy):
- **B1:** voice tables, the shared association rule, and the voice services and APIs (upload or record a source, create a candidate and revision, associate, approve, re-confirm, summary, legacy import), all server-side, tested.
- **C1:** edit tables, the services and APIs for every C1 table, and the pure `layoutAt(edit, t)` and `mixPlan(edit)`, tested with golden fixtures.

B1 and C1 are independent: either can go first, and their PRs can be reviewed in parallel.

**Layer 2, interfaces** (no migrations):
- **B2, Voice Studio, minimum:** line list by beat; **upload** a take (recording writes candidates too); play; set in and out, gain and fades; associate; **approve**; the re-confirm workflow (R5.2). The Teleprompter plays approved-and-valid only (Q3). Plus the B2 voice fixes (owner-only delete, server duration, `keepSession`, no recording on lines that never play). **Extraction from takes is not in the minimum.**
- **C2, Timeline Editor, minimum:**
  - auto-assemble a first draft (one scene clip per beat from its scene set; the starred Prime take per beat as a segment; approved dialogue at its lines); **SUPERSEDED (R7.7):** the assembly locks all 14 beat durations in one operation, and places dialogue only where actual usable timing marks exist; other approved lines stay visibly unplaced;
  - beat chips;
  - per-beat Prime-required or gameplay-only toggle;
  - PIP inspector (position, size, cutout, visibility rules);
  - commentary gain, mute, fades and sub-range;
  - scene clip trim and duration;
  - save with `edit_revision`;
  - named versions;
  - the findings panel;
  - desktop-first.

**Layer 3, rendering:**
- **D1:** `render_jobs` (migration), the dedicated render process (R2.4), and FFmpeg graph construction from `layoutAt` and `mixPlan`.
  - Scene clips (still or video) at 1920×1080, 30 fps.
  - Prime segment video overlaid (cutout WebM alpha where chosen) and its audio from the same file.
  - Dialogue from approved revisions' rendered files at their anchors.
  - Working and review-ready kinds (R2.3, R5.1).
  - Output check (ffprobe: video and AAC, duration ±1 s), S3 `previews/…`, download link.

**The smallest sequence to edit one episode and render a playable 16:9 MP4:**

```
G. snapshot retention resolved (Evoni)  ─┐
B1 ──► deploy ──► B2 ──► deploy ─────────┤
C1 ──► deploy ──► C2 ──► deploy ─────────┼──► D1 ──► deploy ──► render process started
                                         │    (Evoni, or a reviewed mechanism: Q20)
docs PR: spec G-5/§14 amendment ─────────┘
                                              ──► first working preview MP4
                                              ──► all required beats covered, all lines approved
                                              ──► first review-ready MP4
```

- **Six code PRs and five deploys:** B1, C1, B2, C2, D1. B2 and C2 have no migration, so they can share a deploy.
- **Not needed for the first MP4:**
  - extraction from takes (V3), silence detection;
  - music and SFX UI, captions, overlays;
  - E2;
  - the approved manifest and final export (A10);
  - YouTube upload.

## R5.5 B1 checklist and acceptance tests

**Checklist:**
1. Migration `…-create-voice-studio-tables.js`: the six tables of R4.3 B1, with CHECKs, partial unique indexes, RESTRICT foreign keys and `deleted_at`. `down()` refuses when any table has rows.
2. Models registered in `src/models/index.js`.
3. `src/utils/voiceLineContext.js`: the pure association rule (R2.6), shared word for word with `frontend/src/lib/voiceLineContext.js` (the coverMatch shared-block pattern, with a test that keeps them identical).
4. `src/services/voiceStudioService.js`: source create (upload / recorded; ffprobe, sha256, S3), candidate and revision create, associate, confirm move, approve, re-confirm (batch), summary, invalidate-on-observe, legacy import (idempotent, unassociated, unapproved).
5. `src/routes/voiceStudioRoutes.js` at `/api/v1/voice`: `requireAuth` + `authorize(['ADMIN'])` on writes; mounted in `app.js`; route registration validated.
6. Guard test: no code updates `voice_source_assets` media columns; nothing outside the service writes the new tables; `scriptSave.js` is unchanged (diff-guard against `main`).
7. No change to `script_voice_clips`, `scriptSave`, `scriptVersions`, the Teleprompter or the Script tab.

**Acceptance tests** (Jest unit plus Postgres integration):

| # | Test |
|---|---|
| B1-1 | Migration up on an empty database creates the six tables; `down()` drops them when empty and refuses when one row exists |
| B1-2 | Upload: a bad type is refused before S3; a file with no audio stream is refused; the duration comes from ffprobe, not the client; sha256 is stored |
| B1-3 | A second candidate for the same line leaves the first, and its source, untouched |
| B1-4 | Associate with a stale `script_revision` gets 409 and nothing is written; with the current revision but a mismatched line, 409; a Prime speaker is refused; a beat outside 1–14 is refused |
| B1-5 | Context rule, every R2.6 row: unchanged → bound; moved unique → moved; duplicate with different neighbours → ambiguous; speaker, note or words changed → unbound; another beat → unbound |
| B1-6 | Approve needs bound, current association and latest revision; a re-trim after approval puts it in `outdated_take` |
| B1-7 | Script saved (a new revision) → `needs_reconfirm`; batch re-confirm with a stale revision gets 409 and writes nothing; with the current revision, it writes a row per matching approval and returns the non-matching with reasons |
| B1-8 | A → B (line unbound, observed by an approve attempt, so `invalidated_at` is recorded) → restore A: the approval stays `invalid`, and only a new approval makes the line valid |
| B1-9 | Two concurrent approvals for one line: one succeeds, one gets 409 |
| B1-10 | An approve racing a script save: serialised; whichever is second is refused or re-checked |
| B1-11 | Legacy import twice gives one set of rows; none associated, none approved |
| B1-12 | Guard: `scriptSave.js` byte-identical to `main`; no `script_voice_clips` writes |

## R5.6 C1 checklist and acceptance tests

**Checklist:**
1. Migration `…-create-episode-edit-tables.js`: the C1 tables of R4.3 (`episode_edit_state`, `episode_beat_production`, `episode_scene_clips` with `source_duration_ms`, `episode_prime_segments`, `episode_pip_settings`, `episode_pip_visibility`, `timeline_items`, `timeline_audio_items`, `edit_versions`), with CHECKs, RESTRICT foreign keys, `deleted_at`, and a `down()` that refuses when not empty.
2. Models registered.
3. `src/services/episodeEditService.js`: per-table writes under the `edit_revision` lock; the relationship validation of R5.3; ffprobe for video scene sources; the commentary clamp on video trim; split; take replacement (supersede); beat production; versions (snapshot, restore as a new revision).
4. `src/utils/editTimeline.js`: pure `layoutAt(edit, t)` and `mixPlan(edit)`, plus `coverageFindings(edit)` (R5.1). Shared with the frontend later (C2).
5. `src/routes/episodeEditRoutes.js` at `/api/v1/episodes/:id/edit`: writes `requireAuth` + `authorize(['ADMIN'])`; reads `requireAuth`.
6. Guard: nothing writes `scenes.duration_seconds` or `scene_angles.video_duration` from the new code; legacy `timeline_data` untouched.

**Acceptance tests:**

| # | Test |
|---|---|
| C1-1 | Migration up and down (empty), and down refused when not empty |
| C1-2 | Stale `edit_revision` gets 409; a success bumps the revision; two concurrent writes, one 409 |
| C1-3 | Scene clip: an angle not linked to the episode's scene sets is refused; a video with no `video_clip_url` is refused; a failed probe refuses the placement; `out ≤ source_duration_ms`; `scenes.duration_seconds` and `scene_angles.video_duration` unchanged after trims |
| C1-4 | Prime segment: a `lala` clip refused; another episode's clip refused; audio sub-range outside the video refused (CHECK and service) |
| C1-5 | Sync: after move, video trim (audio clamped), audio trim, split, gain and mute, `mixPlan` takes commentary samples at `source_in + (t − placement)`, matching the video frame time within one frame (golden fixture with a clap marker) |
| C1-6 | Hide the PIP over a covered range: `layoutAt` draws no PIP; `mixPlan` commentary events are identical to the visible case |
| C1-7 | Coverage: required + full cover → none; required + hidden + full cover → none; required + gap → `prime_footage_missing`; gameplay-only + gap → none; muted commentary still covers |
| C1-8 | `layoutAt` defaults: PIP bottom-right, 28 % of 1920 width; a gameplay-only beat with footage still shows it (Q21) |
| C1-9 | Versions: save a version; edit; restore → new live revision equal to the snapshot; the version row unchanged (sha256) |
| C1-10 | Beat production: beat 15 refused; a change supersedes and keeps history |

## R5.7 Refinement G: snapshot retention, verified before any migration deploy

**Deploy logs only show:**
- 65 `deploy-*` snapshots;
- the role can't delete them;
- a new one is created per run.

They don't show the account's limit, or how many other manual snapshots count against it. **This design doesn't assume either.**

**Gate:** B1's and C1's deploys wait until Evoni confirms, from the AWS console or her own read-only CLI, these three:

1. The manual DB snapshot count in `us-east-1`, all kinds:
   ```
   aws rds describe-db-snapshots --snapshot-type manual --query 'length(DBSnapshots)'
   ```
2. The account's limit: Service Quotas → Amazon RDS → "Manual DB instance snapshots".
3. One of:
   - the deploy role now has the delete permission (runbook §2.1), and a deploy log shows `PRUNE_NOTE=ok`;
   - or old `deploy-*` snapshots were removed by hand (runbook §7), keeping what the recovery policy needs.

   Either way, leave headroom for at least the five deploys of R5.4.

**This session doesn't run those commands**: it contacts no AWS (Rule 7 decision of 2026-10-10).

## R5.8 Blockers that still need Evoni

> **SUPERSEDED in part (Revision 8):** Q20 and the D1 limits on the production box are closed by R8.0.3 and R8.10; the spec amendment is made (spec Rev 6). Open questions are R8.16.


**Before code (B1/C1):** none. The product decisions are made. B1 and C1 each need **implementation authorisation**.

**Before the first deploy of B1 or C1:** G (R5.7), your confirmation of the snapshot count, the limit and the cleanup.

**Before the first preview in production:**
- **Q20:** how D1's render process is started and managed in production: by you, once, by hand, or by a reviewed Deploy-workflow change (R3.3). Either is your action or approval.
- D1's resource limits on the production box (R2.4) to be confirmed against its size. I can't read the instance size from here; you or the runbook can.

**Owed documentation** (not blocking code): the spec G-5 / §14 amendment for Q-F1/Q-F2.

---

# Revision 4 (Q19, Q-F1, Q-F2 and the final schema for B1 and C1, 2026-10-27)

**Where Revision 4 disagrees with earlier revisions or the body, Revision 4 wins.** It is still design only.

## R4.0 Decisions (Evoni, 2026-10-27, proposed; final when she confirms R4.1)

**Q19:** E1 now, E2 later (definitions in R4.1).

**Q-F1:** where Prime footage is missing, the working preview shows Lala's gameplay full-screen, with a clear editing warning.
- No Prime footage is fabricated, and no stand-in Prime image or idle clip is put in the video.

**Q-F2:** missing Prime footage blocks review-ready previews and final exports **only in a beat that requires Prime**.
- A beat explicitly designated **gameplay-only** may proceed without her.

**This amends recorded rulings.** It needs a matching revision of the spec when Evoni confirms it:
- **Spec Rev 5:** §1, test 24, G-5 ("Missing footage uses a designated fallback, with a warning") and §6/§326 (Prime fallback).
- **Decisions:** §14 and the §15 level-6 source chain (take → designated fallback → placeholder).

Under Q-F1 the chain becomes **take → nothing**:
- The PIP isn't drawn, and `prime_footage_missing` is raised.
- `fallback_asset_id`, the `PRIME.PIP.FALLBACK` role and the placeholder frame are **withdrawn**.

**Unchanged from those rulings:**
- the warning;
- "never adds audio";
- "a beat without footage is *not filmed* on the production checklist";
- "never an AI avatar".

## R4.1 E1 and E2, stated exactly

> **SUPERSEDED (Revision 6):** condition 3 compares `(script_revision, script_seq)` (R6.1), not the revision alone; "no change to `scriptSave`" is replaced by the A1c save-number change (R6.1, its own PR); a neighbour change, a move or an ambiguity is not invalidation (R6.2).

**E1 (now): revision-pinned approval, with a person's re-confirmation**

An approval of a take for a line is **valid** at the current moment only when all of the following hold:

1. **It's still in force.** The approval isn't superseded, invalidated or deleted.
2. **It's for the take as it is now.** It names the take's latest candidate revision: the trim, gain, fades and normalise it was approved with are still the take's current settings.
3. **It's for the script as it is now.** The episode's current script revision (`sr1-` hash) is either:
   - **(a)** the revision the approval was made at, or
   - **(b)** a revision for which a person has stored a **re-confirmation** of this approval.
4. **The line still matches.** In the current script, the take's association resolves to **bound** with the approval's stored structured line context (R2.6: beat, position, occurrence, speaker, delivery note, words, row hash, neighbour hashes).

**How E1 works:**
- **Re-confirming:** an explicit person's action, either per line or "re-confirm unchanged lines in this beat", which lists only lines meeting condition 4.
  - It writes one re-confirmation row per approval: approval, script revision, the context hash checked, who, when.
  - It is refused unless the revision it was shown for is still current.
- **What E1 reads:** no script versions, and no change to `scriptSave`.
- **What a script save does:** every approval in the episode becomes "needs re-confirm". It is silent in the Teleprompter (Q3) and marked in working previews, and blocks review-ready previews, until re-confirmed.
- **Invalidation:**
  - When a write observes a condition-4 failure (an approve, a re-confirm attempt, or a render-job start), it records `invalidated_at` and the reason.
  - An invalidated approval is never valid again; only a **new approval** can follow.
  - A condition-3 failure on its own only means "needs re-confirm".

**E2 (later, as its own reviewed change): a script revision log**

1. **Inside `scriptSave`'s transaction** (an additive change to the A1c R1 save path), write one row per save to a never-pruned table: episode, new revision, previous revision, saved at, source, and a compact line-context index.
   - The index lists every counted line's beat, position, occurrence and row hash.
   - Empty scripts and repeated texts are logged too.
2. **Condition 3 then becomes automatic:** walk the log from the approval's revision to now, following `prev_revision` links, which prove the chain is complete. The approval stays valid only if the line was bound, with the approved context, in **every** logged revision.
   - A missing link fails closed.
   - Re-confirmation is needed only where the walk finds the line changed.
3. **E1's re-confirmation rows stay valid evidence.** E2 only adds automatic evidence; nothing is migrated or discarded.

**What E2 changes:** the A1c save path (one insert) and a new table. It does **not** touch voice tables from the save path, so A1c R4.8 holds.

**E2 needs its own design approval:** the table, its retention, and the line-context index format shared with the R2.6 rule.

## R4.2 Prime-required or gameplay-only: where it lives and how it's validated

> **SUPERSEDED (Revision 5):** its "every stretch where the PIP is visible" coverage rule and the Q21 question: coverage is the whole beat whatever the visibility (R5.1); Q21 is answered (R5.0). The table and the place it lives stand.


**It belongs to the episode's beats, in the Timeline's data. It is not the script, the scene set or the PIP visibility rules.**

| Choice | Why not |
|---|---|
| The script (a tag in the beat) | A script edit would silently change a production requirement; the script is A1c's domain |
| Scene sets | Reusable across episodes; the same set can be Prime-required in one episode and not in another |
| `episode_pip_visibility` | Visibility says whether her picture is **shown**; this says whether it's **required**. Rulings keep visibility manual and independent (decisions R2/R3, §15 level 5), and "hiding the PIP never mutes her voice". Combining them would hide footage that exists, or require footage you've hidden |

**Table `episode_beat_production`** (C1):
- `id`, `episode_id`, `beat_number`, `prime_mode` (`required` | `gameplay_only`), `note`, `set_by`, `set_at`, timestamps, `deleted_at`.
- **No row means `required`**, the default for every beat 1–14, cutscene beats 11–13 included, as rulings forbid automatic beat exemptions (decisions R2; spec §4).
- A change is a new row; the previous one is soft-deleted, which keeps the history of who changed it and when.

**Validation:**

*When it is set:*
- server-side;
- `beat_number` must be 1–14;
- `prime_mode` must be one of the two values;
- signed in, with owner or admin rights;
- a stale `edit_revision` is refused.

*When a render is requested.* For each beat:
- **required:** every stretch of the beat where the PIP is visible (default visible, minus manual hide rules) must be covered by a current Prime segment.
  - An uncovered stretch is `prime_footage_missing`.
  - It's a warning in a working preview, and **blocks** a review-ready preview and the final export.
- **gameplay_only:**
  - Missing footage is **not** a finding.
  - If footage exists, it shows according to the visibility rules: being designated gameplay-only doesn't hide footage you've placed (DECISION Q21).

*In the working preview's missing stretch:*
- no PIP is drawn (Lala's gameplay full-screen);
- a burnt-in editing banner `PRIME FOOTAGE MISSING · Beat 4 · 00:41–01:12` at the top edge, outside the PIP area;
- no Prime audio;
- no image standing in for her.

*In review-ready and final renders:* there are no banners. A required beat can't get there with a gap, and a gameplay-only beat simply shows gameplay.

*In the manifest (A10):* each beat's `prime_mode` is frozen with who set it and when, so an export shows the designation it was approved under.

- **Q21:** confirm that gameplay-only changes only the requirement, not visibility. Or should gameplay-only also hide any footage you've placed in that beat?

## R4.3 Final schema and migration scope for B1 and C1

**Conventions for both migrations:**
- Each is **one new file** under `src/migrations/`. It is additive: no existing table, column or index is changed, and nothing is dropped.
- Every table has `created_at`, `updated_at` and `deleted_at`.
- The `down()` refuses (throws) if any new table has rows, and drops only empty new tables, so a rollback can't destroy data.
- Each ships through the Deploy workflow, with its snapshot, after Evoni approves.

### B1: Voice data (migration `…-create-voice-studio-tables.js`)

> **SUPERSEDED (Revision 6):** the approval and re-confirmation columns, the approval index (no `occurrence`) and the re-confirmation uniqueness are as built in R6.3 and R6.4.

**`voice_source_assets`**: immutable source media; never edited, never hard-deleted.
- **Columns:**
  - `id` (uuid);
  - `episode_id` (FK `episodes`, **ON DELETE RESTRICT**);
  - `source_kind` (`uploaded` | `recorded` | `extracted` | `legacy`);
  - `s3_key` (unique), `sha256` (char 64), `content_type`, `file_size_bytes`;
  - `duration_ms`, `sample_rate`, `channels` (all from server-side ffprobe);
  - `original_filename`;
  - `source_raw_clip_id` (FK `episode_raw_clips`, RESTRICT), `source_in_ms`, `source_out_ms`;
  - `legacy_voice_clip_id` (FK `script_voice_clips`, RESTRICT);
  - `created_by`.
- **CHECKs:**
  - `extracted` needs a raw clip and `0 ≤ source_in_ms < source_out_ms`;
  - `legacy` needs `legacy_voice_clip_id`;
  - `uploaded` and `recorded` have neither.
- **Immutability:** the service never updates media columns, and a source guard test (like `scriptWriteGuard`) allows no `UPDATE voice_source_assets SET s3_key|sha256|duration_ms`.
- **S3:**
  - Uploads, recordings and extractions are written to `episodes/<id>/voice/sources/<sha256>.<ext>` and never overwritten.
  - Legacy rows point at the existing `script_voice_clips` file.

**`line_voice_candidates`**: one take for one line.
- `id`, `episode_id` (RESTRICT), `source_asset_id` (FK, RESTRICT), `label`, `line_key` (null until A1d), `created_by`.

**`line_voice_associations`**: which line a candidate is tied to. Append-only: a confirmed move or a reassignment is a new row.
- **Columns:**
  - `id`, `candidate_id` (FK);
  - `beat_number` (1–14), `line_index` (≥ 0), `occurrence` (≥ 1);
  - `speaker_key`, `speaker_written`, `delivery_note`, `words`;
  - `row_hash`, `prev_hash`, `next_hash`;
  - `script_revision`, `context_hash`;
  - `created_by`, `superseded_at`, `superseded_by`.
- **Index:** one current association per candidate (partial unique where `superseded_at IS NULL AND deleted_at IS NULL`).

**`line_voice_candidate_revisions`**: append-only adjustment history.
- **Columns:**
  - `id`, `candidate_id`, `revision_no` (unique per candidate);
  - `in_ms`, `out_ms`;
  - `gain_db` (numeric 4,1; −24 to +12);
  - `fade_in_ms`, `fade_out_ms` (0–2000);
  - `normalise`, `settings_hash`;
  - `rendered_s3_key`, `rendered_sha256` (a derived file, rebuildable from the source);
  - `created_by`.
- **CHECK:** `0 ≤ in_ms < out_ms`. The service also checks `out_ms` ≤ the source duration.

**`line_voice_approvals`**:
- **Columns:**
  - `id`, `episode_id`;
  - `candidate_revision_id` (FK), `association_id` (FK);
  - `beat_number`, `line_index`, `occurrence` (copied, for the index);
  - `approved_script_revision`, `approved_context` (jsonb);
  - `approved_by`, `approved_at`;
  - `superseded_by`, `superseded_at`, `invalidated_at`, `invalidated_reason`.
- **Index:** at most one current approval per line: a partial unique on `(episode_id, beat_number, line_index, occurrence)` where not superseded, not invalidated, not deleted. At A1d an index on `line_key` is added alongside.

**`line_voice_reconfirmations`** (E1):
- `id`, `approval_id` (FK), `script_revision`, `context_hash`, `confirmed_by`, `confirmed_at`.
- Unique `(approval_id, script_revision)`.

**Legacy import:**
- Not part of the migration. An idempotent service job run from Voice Studio ("bring in old clips").
- Each `script_voice_clips` row becomes a `legacy` source asset plus a candidate with **no association** (unbound) and **no approval** (Q2). You assign it to a line, validated as at creation. That way the import never guesses a line.
- Production has 0 such rows today (2026-10-27).

**Not in B1:**
- Voice Studio UI, the Teleprompter changeover and the voice bug fixes (B2);
- extraction jobs (V3);
- the E2 log.

### C1: Timeline data (migration `…-create-episode-edit-tables.js`)

**`episode_edit_state`**: the live edit's concurrency token.
- `episode_id` (unique), `edit_revision`, `updated_by`.
- Every edit write sends the revision it read; a stale one gets 409. It is never merged silently.

**`episode_beat_production`**: as in R4.2.

**`episode_scene_clips`**: the scene track (Q17).
- **Columns:**
  - `id`, `episode_id`, `beat_number` (1–14), `position` (order within the beat);
  - `source_kind` (`angle_still` | `angle_video` | `raw_clip`);
  - `source_id`;
  - `source_in_ms`, `source_out_ms` (video only);
  - `duration_ms` (**episode-specific clip length**);
  - `created_by`.
- **CHECKs:** `duration_ms > 0`; video sources need `0 ≤ in < out`.
- **What it never writes:** `scene_angles.video_duration` (the reusable source) or `scenes.duration_seconds` (the legacy editor's).
- **Raw clips:** a `raw_clip` source must have `performer = 'lala'` or `'guest'`, checked by the service.

**`episode_prime_segments`**: C3 segments with R2.2's synchronization.
- **Columns:**
  - `id`, `episode_id`, `raw_clip_id` (FK, RESTRICT; the service checks `performer = 'justawoman'`);
  - `source_in_ms`, `source_out_ms`;
  - `anchor_kind` (`beat_start` | `line_start` | `item_start`), `anchor_beat`, `anchor_ref`, `offset_ms`; **AMENDED (R7.3, R7.8):** plus `edit_start`;
  - `layout` (jsonb overrides, pixels at 1920×1080, nullable);
  - `audio_in_ms`, `audio_out_ms`, `audio_gain_db`, `audio_muted`, `audio_fade_in_ms`, `audio_fade_out_ms`;
  - `status` (draft | approved);
  - `superseded_by`, `superseded_at`.
- **CHECK:** `source_in_ms ≤ audio_in_ms < audio_out_ms ≤ source_out_ms`.
- **There is no audio offset column**, so audio can't slide. Moving changes only the anchor and offset; trimming the video clamps the audio range (service, tested).

**`episode_pip_settings`** (C3): `episode_id` (unique), `default_layout` (jsonb: bottom right, 28 % width), `default_visible` (true), `use_cutout`. **No `fallback_asset_id`** (Q-F1).

**`episode_pip_visibility`** (C3): manual rules only.
- `id`, `episode_id`, `scope` (`beat` | `range`), `beat_number`, `anchor_kind`, `anchor_ref`, `offset_ms`, `end_anchor_kind`, `end_anchor_ref`, `end_offset_ms`, `visible`, `set_by`.

**`timeline_items`** (review C1, adopted): object and camera keyframes, visibility, angle changes and transitions, **plus** these kinds:
- `audio_offset` (a dialogue nudge, targeting a line association); **SUPERSEDED (R7.4):** reserved and unused; dialogue is timed by `dialogue_placement` rows;
- `caption_override` (reserved);
- **AMENDED (R7.4, R7.8):** `dialogue_placement`, with its association, approval and line columns.

Columns: `id`, `episode_id`, `scene_clip_id`, `kind`, `target_id`, `view`, `anchor_kind`, `anchor_ref`, `offset_ms`, `values` (jsonb), `origin`, `approval`, `proposal_id`.

**`timeline_audio_items`**: music and SFX, **reserved** (Q9), with no UI in the first release.
- **Columns:**
  - `id`, `episode_id`, `track` (`music` | `sfx`);
  - `asset_ref` (library id), `slot` (the SFX slot name);
  - `source_in_ms`, `source_out_ms`;
  - `anchor_kind`, `anchor_ref`, `offset_ms`;
  - `gain_db`, `fade_in_ms`, `fade_out_ms`;
  - `duck_under_dialogue_db` (an explicit user setting, never automatic).

**`edit_versions`**: named saved versions (Q18).
- **Columns:**
  - `id`, `episode_id`, `name`;
  - `snapshot` (jsonb: every live edit row above, plus `edit_revision` and the script revision);
  - `snapshot_sha256`;
  - `created_by`.
- **Immutable**, never hard-deleted.
- **Restore** writes a new live `edit_revision`, never edits a version.
- A version is renderable as a working preview.

**Not in C1:**
- **Captions:** derived at render from approved lines and their placements. Overrides use the reserved `timeline_items` kind.
- **Overlays:** objects from the Stage (C2 ids), timed by `timeline_items`. No new table.
- **Frozen manifests:** A10 (`approved_production_manifests`, content-addressed media, never deleted).
- **Render jobs:** D1 (`render_jobs`).
- **UI:** C2.

### Retention

| Data | Kept | Deleted by |
|---|---|---|
| Voice source assets and their S3 objects | forever | nothing. No code path or lifecycle rule; soft delete only hides |
| Candidates, associations, candidate revisions, approvals, re-confirmations | forever, append-only | nothing; soft delete hides |
| Rendered (derived) voice files | while referenced | may be rebuilt; deletion only by a future reviewed cleanup |
| Prime segments, scene clips, timeline items, audio items, visibility rules, beat production | live rows; superseded rows kept | soft delete; never hard |
| Edit versions | forever | soft delete only |
| Frozen manifests (A10) | forever | never (review R3.3) |
| Script versions | unchanged: 50 + 10 per episode (`scriptVersions`) | `prune`. E1 references none, so no retention provider is added (confirmed, R6.5) |
| Raw takes (`episode_raw_clips`) | unchanged | the new foreign keys RESTRICT a hard delete of a take used as a source or segment. Production only soft-deletes episodes (`episodeController.deleteEpisode`, hard delete outside production only) |

### Rollback

- **Code rollback:** the feature flags `VOICE_STUDIO` and `EPISODE_EDIT` turn off the new pages and services. The legacy Script tab recording, the Teleprompter and the legacy Timeline Editor keep working against untouched tables. New rows stay, unused.
- **Schema rollback:** `down()` refuses while any new table has rows. Fix forward is the rule (A1c R4.7). The deploy snapshot taken before the migration is the last resort, restored only by Evoni per the runbook.
- **Teleprompter (Q3):** if B2 is rolled back, it returns to playing legacy clips as today. B1 alone changes no playback.

## R4.4 Deploy snapshots: status (from Deploy #173's log, 2026-10-27)

**What the log shows:**
- `65 deploy snapshot(s) available; keeping the newest 10.`
- `The deploy role may not delete snapshots, so none were removed.` (`PRUNE_NOTE=not-permitted`)
- Deploy #173 then created `deploy-c907ed562096-40572580920-1`, which became available.

**Can the next migration deploy safely take one?**
- **Yes, until the account's manual-snapshot limit.** The workflow's snapshot step fails **before anything on the box changes** if RDS refuses (`SnapshotQuotaExceeded`). So reaching the limit stops a deploy safely; it doesn't break production.
- **The limit itself:** I can't confirm the account's actual limit or the count of non-deploy manual snapshots from this session; I haven't queried AWS. The AWS default is 100 manual snapshots per region (adjustable), and non-deploy manual snapshots count too.
- **How many B and C need:** B1 and C1 are two migration deploys, so two more snapshots.

**Recommendation before B1 is deployed** (an action for Evoni):
- either give the deploy role the delete permission (runbook §2.1), so each run keeps the newest 10;
- or remove old `deploy-*` snapshots by hand (runbook §7), keeping the recent ones the recovery policy needs.

## R4.5 Open questions

> **SUPERSEDED (Revision 5):** answered or moved to R5.8.


**Needed before B1/C1 code:**
- **Confirm R4.1:** E1 now, E2 later.
- **Q21:** does gameplay-only change only the requirement, or also hide placed footage?

**Needed before C2/D1 (not B1/C1):**
- the spec revision amending G-5 / §14 for Q-F1;
- the D1 render process (R3.3).

---

# Revision 3 (Evoni's Q15–Q18 direction, and the approval model checked, 2026-10-27)

**Where Revision 3 disagrees with Revision 2 or the body, Revision 3 wins.**

## R3.0 Decisions recorded (Evoni, 2026-10-27, proposed direction)

**Q15:**
- Prefer approval verification through script history, **without modifying A1c R1's centralised save path**.
- Missing or pruned history must **never silently count as proof**.
- Evaluate whether durable approval-validity evidence is needed to avoid keeping script versions forever.

**Q16:**
- The dedicated render process should eventually be managed by a **reviewed deployment mechanism**, with explicit start and stop, health, resource limits and failure recovery.
- Do not modify the Deploy workflow or start a worker yet.

**Q17:**
- The scene set's **source duration** and the episode's **timeline clip duration** are separate.
- Trimming a clip in the new editor never changes a reusable scene's duration.

**Q18:**
- **One live editable timeline per episode, with named saved versions.**
- Future approved or frozen versions are immutable and independently renderable.

## R3.1 Q15 finding: script history alone cannot prove an approval stayed valid

I checked R2.1's history walk against the code (VERIFIED, `src/services/scriptVersions.js` at `08b70d28`). It is **not sound on its own**, for three reasons.

**1. Versions are pruned on every save.**
- `snapshotScript` keeps the newest **50** `save` / `lock` / `restore` versions and the newest **10** `generate` versions per episode (`KEEP`, `KEEP_GENERATED`, `prune`), deleting older ones with `force: true`.
- An episode edited many times after an approval loses the history its walk needs.
- Under "missing history never counts as proof", every such approval would then fail closed, so approvals would lapse just from ordinary editing.

**2. Some script states are never recorded.** `snapshotScript` keeps the script being **replaced**, and returns without a version when:
- that script is empty (`!text.trim()`);
- the next text is the same;
- the latest version already has that text.

So **an empty script in between is invisible**:
- A → (cleared) → A leaves versions `[A]` and current `A`.
- A walk sees A, A and would call the approval valid, though the line was absent in between.

The same holds for any state that is replaced by a save the history doesn't distinguish. **A complete chain can't be proved from versions alone.**

**3. Versions don't store the revision that replaced them.** There is no `next_revision` on a version row, so gaps can't even be detected.

**Conclusion:** durable approval-validity evidence **is needed**. Keeping versions forever (a retention provider that blocks `prune`) still doesn't close gap 2, and it grows storage without bound. That option is rejected.

**Options for that evidence:**

| | Option | Changes the A1c R1 save path? | Guess-free? | Burden on Evoni |
|---|---|---|---|---|
| E1 | **Revision-pinned approval.** An approval is valid only at the exact script revision it was approved or re-confirmed at. Any later script revision puts it in **needs re-confirm**. Re-confirm is a person's action, one tap per line or "re-confirm unchanged lines in this beat", shown beside the approved line context. Each re-confirmation is a stored row (approval, revision, by, at) | **No** | Yes: a person attests every revision that counts | High: after every script Save, approvals need re-confirming before a review-ready preview or Teleprompter playback |
| E2 | **Script revision log.** `scriptSave` writes one small row per save **in the same transaction**: `episode_id, revision, prev_revision, saved_at, source`, plus a compact **line-context index** (for each counted line: beat, position, row hash). The log is never pruned while an approval depends on it, and it's tiny compared with versions. Validity walks the log from the approval's revision to now. The chain is provable (`prev_revision` links), and every state, empty ones included, is recorded | **Yes, additively**: one insert in R1's transaction. No voice table is touched, so A1c R4.8 holds | Yes | Low: re-confirm only when a line actually changed and changed back |
| E3 | After-commit notifier (like the identity-plan log) | Yes, outside the transaction | **No**: a lost notification leaves a gap | — rejected |

**Recommendation:** start the first release with **E1**. It keeps your Q15 constraint (no R1 change) and is guess-free. Plan **E2** as its own reviewed change, to bring in when the re-confirm burden shows in practice.
- E1 can move to E2 without data loss. E1's re-confirmation rows stay as evidence, and E2 only adds automatic evidence from the log.
- This is DECISION **Q19**.

**Retention (A1c R4.5):**
- E1 references **no version rows**. Approvals store the revision hash and the line context, not version ids, so `prune` is unaffected and versions aren't kept longer.
- E2's log is a new durable record with its own retention, decided in its PR.

## R3.2 The approval model, checked case by case (under E1)

The conditions an approval is **valid** under:
1. Its candidate revision is the candidate's latest.
2. The current script revision equals the approval's revision, or a stored re-confirmation for the current revision exists.
3. The line is **bound** in the current script with the approved structured line context (R2.6).

Anything else is **not valid**: the line plays silent, previews mark it, and review-ready previews refuse.

| Case | What happens | Silent reactivation possible? |
|---|---|---|
| **Version pruning** (51st save) | Nothing changes. E1 never reads versions | No |
| **Script restored** to the approved wording (A → B → restore A) | The restore is a new save, so a new revision. The approval is "needs re-confirm" at the new revision even though the line reads A | **No.** Only a person's re-confirmation, stored, makes it valid again |
| **A → cleared → A** | The two saves give two new revisions; the approval needs re-confirm | No |
| **Duplicate dialogue** (two identical lines, one deleted) | Binding needs position **and** both neighbours (R2.6). If the surviving copy's context differs, the take is **ambiguous**: a person picks the line. Re-confirm is only offered once bound | No |
| **Speaker or delivery note changed** | The row hash changes, so it's unbound. Re-confirm isn't offered; only a fresh approval after reassigning | No |
| **Re-trim or re-gain after approval** | A new candidate revision, so condition 1 fails; it needs a new approval | No |
| **Concurrent script save and approve** | Approve runs in one transaction that takes `SELECT … FOR SHARE` on the episode row and checks the sent revision equals the row's. `scriptSave` holds `FOR UPDATE` (`scriptSave.js:104`), so the two serialise. If a save lands first, the approve gets 409 `SCRIPT_CHANGED` and nothing is written | No |
| **Two approvals for one line at once** | The partial unique index on the current approval per line lets one win; the other gets 409 | No |
| **Approve while a re-trim is being saved** | Both lock the candidate row (`FOR UPDATE`); the approve checks the candidate revision is latest under the lock | No |
| **Re-confirm sent from an old page** | Re-confirm carries the revision it was shown for; it is refused unless that revision is current | No |
| **Bulk "re-confirm unchanged lines in this beat"** | Only lines bound with an identical approved context are listed, and each is stored separately. A person presses it | No (an explicit action, recorded) |

## R3.3 Q16: render process management (recorded, not built)

> **SUPERSEDED (Revision 8, R8.0.3 and R8.10):** the render worker runs on the separate render host, installed and started only by a reviewed Deploy-workflow job Evoni approves, or by her by hand.


**Requirements for D1's eventual deployment mechanism (a reviewed change, separately authorised):**
- explicit start and stop;
- a health endpoint or heartbeat check reported in the Deploy summary;
- the resource limits of R2.4;
- recovery: the stale-heartbeat → `failed` rule, and no automatic resume or retry;
- it never restarts `episode-worker`, and leaves stopped things stopped, as the Deploy workflow already does.

**Until then:** D1 can be built and tested locally, but nothing starts it in production.

## R3.4 Q17: source duration vs timeline clip duration

**Where durations live today (VERIFIED):**
- **The reusable source:** `scene_angles.video_duration` (the scene set's angle clip, shared by episodes).
- **Per episode:** `scenes.duration_seconds`, which the legacy Timeline Editor writes and the current export reads.

**The new editor, per Q17 and Q5:**
- It writes **neither**. Each beat's scene clip is an episode-specific timeline item with its own `source_in_s`, `source_out_s` and `duration_ms`, in the episode's edit rows.
- The scene set's angle is only a source reference.
- The legacy editor keeps `scenes.duration_seconds` to itself.

This **reverses R2.5's recommendation** (scene timing on `scenes`). R2.5's `episode_scene_edits` becomes the scene track's item table, with the duration in it, not only the in and out points.

**Consequence:** the two editors can show different scene lengths for one episode. The new editor shows a notice ("this episode has a legacy timeline; its lengths are not used here"). "Adopt into Edit" copies lengths once, after a dry run (review D2).

## R3.5 Q18: one live timeline, named versions, frozen versions

**The live edit:**
- One per episode: the episode's edit rows (C1 `timeline_items`, C3 segments, the scene items, `timeline_audio_items`).
- Saves are optimistic: an `edit_revision` token, the same pattern as A1c R1's script revision. A stale save is refused, never merged silently.

**Named versions:**
- `edit_versions`: `id, episode_id, name, created_by, created_at`, plus an **immutable snapshot** (a JSON document of every edit row, the edit revision, and the script revision it was made at).
- **Restore** writes the snapshot back as a new live edit revision. It never edits a version.
- A version is renderable as a **working preview** directly from its snapshot.

**Frozen (approved) versions:**
- These are the manifest (A10): `approved_production_manifests`, immutable and content-addressed media, never deleted (review R3.2, R3.3).
- A review-ready preview or a final export renders from a frozen snapshot or manifest, never from the live edit. That makes it reproducible however the live edit changes.

## R3.6 Design questions still open

> **SUPERSEDED (Revision 5):** answered (R4.0, R5.0) or moved to R5.8.


**Needed before the first playable MP4:**
- **Q19:** E1 now (no R1 change, a person re-confirms after script edits), with E2 as a later reviewed change? Or E2 first (one additive insert in R1's save transaction, automatic and provable)?
- **Q-F1 / Q-F2** (already open): the Prime fallback's home, and whether a missing Prime stretch blocks a review-ready preview or only warns. Until decided, missing footage blocks review-ready (R2.3).

**Can wait:**
- **Q-E1:** export aspect for non-16:9 platforms.
- **Q20:** may D1's render process later be started by the Deploy workflow (a reviewed change), or only by you by hand?

---

# Revision 2 (Evoni's direction and six requirements, 2026-10-27)

**Where Revision 2 disagrees with the body below, Revision 2 wins.** The body is kept as written.

## R2.0 Decisions recorded (Evoni, 2026-10-27)

Her proposed product direction, subject to the safeguards in R2.1–R2.6:

| Q | Decision |
|---|---|
| Q1 | Yes: voice work proceeds before R3, with the validated association |
| Q2 | Legacy clips are imported **unapproved** |
| Q3 | The Teleprompter plays **approved and valid** takes only |
| Q4 | Reuse the reviewed schema **after comparison** (R2.5) |
| Q5 | Preserve the legacy editor |
| Q6 | Desktop-first |
| Q7 | **Isolated** background rendering (R2.4) |
| Q8 | SRT later |
| Q9 | Music and SFX later, with **reserved track support** |
| Q10 | Per-line approval |
| Q11 | Script hash **plus structured line context** |
| Q12 | Prime's camera and audio remain synchronized (R2.2) |
| Q13 | Working-preview warnings (R2.3) |
| Q14 | Independent bug fixes. **A1 (export job settings) is authorised for local implementation only** |

Still not authorised: B1, C1, B2, C2, D1, any push, PR, merge or deploy, restarting the worker, production data changes, and R2/R3.

## R2.1 Approval binds to an exact candidate revision and a validated association; once invalidated it never reactivates

> **SUPERSEDED (Revision 5):** the history walk is not sound (R3.1). Validity is E1 (R4.1, R5.2); tables are R4.3.


**The risk:**
1. A take is approved on script revision r1.
2. At r2 the line is reworded, so the take is now unbound.
3. At r3 the old wording comes back, by an undo, a restore or a coincidental edit.

§3.2's resolver, which looks only at the current script, would call the take bound again and silently revive the approval. That is the "guess" Evoni ruled out.

**Design (PROPOSED), replacing §4.1's approval and §3.2's approval paragraph:**

**1. Candidates have revisions.** Every change to a candidate's trim, gain, fades or normalise creates a new immutable **candidate revision**:
- table `line_voice_candidate_revisions`: `id, candidate_id, revision_no, in_s, out_s, gain_db, fade_in_ms, fade_out_ms, normalise, settings_hash, created_by, created_at`;
- the candidate row holds only identity and its association.

**2. An approval names exactly one candidate revision and one association check.**
- `line_voice_approvals`: `candidate_revision_id`, `association_check_id`, `approved_revision` (the script `sr1-` hash), `approved_line_context` (R2.6), `approved_by`, `approved_at`, `invalidated_at`, `invalidated_reason`, `superseded_by`.

**3. Validity is decided over the script's history, never by the current wording alone.** An approval is **valid** at the current script revision only when both hold:
- **(a)** its candidate revision is still the candidate's latest;
- **(b)** the line is bound, with the same structured line context (R2.6), in **every** script revision saved since `approved_revision`.

**The history it walks:** A1c R1 already guarantees it. Every write of `script_content` goes through `scriptSave`, which keeps the replaced script as a version in the same transaction (`snapshotScript` strict), so the chain of revisions is complete. The walk:
- **Read-only.** "Reading never writes" (review R3.1) holds: it reads `episode_script_versions` and computes.
- **Cached** by `(approval_id, current revision)`.
- **Deterministic.** The same history always gives the same answer.

**4. Invalidation is permanent.**
- If any revision in the chain unbound the line, the approval is invalid forever, even if a later revision restores the exact wording.
- The first write that observes an invalid approval records `invalidated_at` and the reason, for display and audit. The writes that can observe it are an approve, an association confirm, and the start of a render job.
- A restored wording makes the take **eligible for a new approval** (it is bound again), never re-approved.

**5. A new approval supersedes, never edits.** The old row keeps `superseded_by`. There is at most one current approval per line (partial unique index).

**6. Dependencies on script history:**
- **Retention.** The walk depends on the script versions between `approved_revision` and now, which makes approvals a **durable dependency on version history** under the A1c retention contract (R4.5). B1 must add the provider: `prune` may not remove a version an unsuperseded approval's walk needs, unless the walk result is first recorded on the approval.
- **A gap in the history fails closed.** If a version is missing, for example from before R1, the approval is treated as invalid.

**What this prevents:**
- reviving approvals because wording matches again;
- approvals of a take that was later re-trimmed or re-gained (a new candidate revision);
- approvals across a speaker or note change (R2.6).

**Considered and not recommended:** the script save writes "revision changed" checks into the voice tables after commit. It needs no history walk, but it puts voice writes inside the A1c save path, against A1c R4.8 ("no release reads or writes voice clips"). It is noted in case Evoni prefers it (DECISION Q15).

## R2.2 Prime's camera audio and video stay synchronized

**Rule:** a Prime segment is one take, on one clock.

**The data, under the reviewed C3 segments (R2.5):**
- **The video:** `source_in`, `source_out` and its placement (anchor plus offset).
- **The commentary:** a sub-range `audio_in`, `audio_out` in the **same source timebase**, plus `gain_db`, `muted`, `fade_in_ms` and `fade_out_ms`.
- There is **no separate audio offset field**, so audio can't slide.

**Constraints, enforced by the service and by a CHECK where SQL allows:**
- `source_in ≤ audio_in < audio_out ≤ source_out`.
- **Moving** the segment moves picture and commentary together: there is one placement.
- **Trimming the video** clamps the commentary range inside the new video range. It never shifts it.
- **Trimming the commentary** works only inside the video range.
- **Splitting** a segment splits both at the same source time.
- **Replacing the take** creates a new segment. The old one is kept, superseded.
- **Hiding** the PIP (a visibility rule) never mutes the commentary.
- **Muting** never hides the picture.

**In the render:** `mixPlan` takes the commentary from the same file at `source_in + (t − placement)` with the commentary sub-range applied, so audio and video come from one decode position.

**Golden test:** after move, trim-video, trim-audio, split and gain, a frame-exact check that the audio sample at a known clap marker equals the video frame time, ±1 frame at 30 fps.

## R2.3 Working previews and review-ready previews

There are two kinds of preview render. Neither is an export, and neither approves anything.

**Working preview**
- **When:** always renders, whatever is missing.
- **What shows:**
  - a burnt-in top banner: `WORKING PREVIEW · 7 issues`;
  - at each unapproved or invalid line, a lower-third marker `UNAPPROVED · Lala · "…"`, with silence there;
  - missing scene picture: a slate `MISSING SCENE · Beat 6`;
  - missing Prime footage: a PIP placeholder `NO PRIME FOOTAGE`, with no audio invented.
- **With it:** an `issues.json` and an on-page list with a time and a link per issue.

**Review-ready preview**
- **When:** renders only when there are **no blocking findings**:
  - every active line has a valid approval (R2.1);
  - every beat has a scene picture;
  - Prime footage or an accepted fallback for every beat (Q-F1/Q-F2 still open; until decided, missing footage blocks review-ready); **SUPERSEDED (R5.1):** full coverage of every `required` beat, whatever the visibility; no fallback.
  - no `take_overruns_scene` left unresolved. **SUPERSEDED (R7.6):** no blocking finding of R7.6's table.
- **What shows:** a small corner mark `REVIEW · <date>`, with no banners or slates.
- **If you ask while something blocks:** the request is refused with the list. Nothing renders.

**Both kinds:**
- `render_jobs.kind` is `working_preview` or `review_preview` (`final` is reserved for the manifest export).
- Both store the findings list and the exact project state hash they rendered, so the file can be traced to its inputs.
- Outputs go to `previews/working/` and `previews/review/`.

## R2.4 Render queue: isolation, limits, persistence, failure and retry

> **SUPERSEDED in part (Revision 8, R8.9 and R8.10):** no render process runs on the production box; rendering is on a separate, stateless render host, with no database access, that claims jobs from the API. The job rules here (the table is the state, no automatic retry, stale heartbeat → failed, cancel, the ffprobe gate) stand as amended by R8.9.


**Checked against today's options (VERIFIED):**

| Option | Isolated from request handling | Resource limits | Job state persists | Safe failure and retry |
|---|---|---|---|---|
| Green-removal queue (`rawClipMedia.js:146-214`) | **No.** In-process inside the API (ffmpeg is a child process at nice 15, but queueing, temp files and S3 streams share the API process) | nice 15, 2 h timeout, one at a time | **No:** in memory, lost on restart; stale after 3 h | Partial: "stale" marking only |
| `episode-worker` with Bull/Redis (`workers/start.js`, `queues/videoQueue.js`) | Yes, separate PM2 process | concurrency `EXPORT_MAX_CONCURRENT_JOBS` (default 2); no CPU or memory limit | In Redis, if Redis persists (production Redis durability is **unverified**) | 3 attempts with backoff. Automatic retry of a render is not wanted for a long job |

**Neither meets requirement 4 as it stands.** Note that the body's recommendation for Q7 (the green-removal queue) **fails isolation and persistence** and is withdrawn.

**PROPOSED for D1: a dedicated render process with a database-backed job table.**

**Isolation:**
- A separate PM2 app, `episode-render`, runs only render jobs. It is not part of the API process, and not shared with scene generation.
- The API only inserts a `render_jobs` row and reads its status.
- Starting a new PM2 process is a production action: it needs Evoni, or a reviewed change to the Deploy workflow that starts it (DECISION Q16). It does not restart `episode-worker`.

**Limits:**
- one job at a time;
- ffmpeg at `nice 19`, `ionice -c3`, `-threads 2`;
- a PM2 memory limit (`max_memory_restart`, e.g. 1.5 GB);
- a wall-clock timeout of 3× the episode length plus 10 minutes;
- a temp-disk check before starting (refuses if free space is below 3× the estimated output);
- a maximum episode length of 60 minutes per render.

**Persistence:**
- The `render_jobs` row is the state: `queued → running → done | failed | cancelled`, with `attempt`, `heartbeat_at`, `started_at`, `finished_at`, `error`, `output_s3_key`, `output_sha256` and `inputs_hash`.
- Claiming a job is atomic: `UPDATE … SET status='running' … WHERE status='queued' … RETURNING`, with `FOR UPDATE SKIP LOCKED`.

**Failure:**
- A job whose heartbeat is older than 2 minutes is marked `failed` ("render stopped unexpectedly"). It is never resumed half-written.
- Output is written to a temp key, then copied to its final key only after ffprobe confirms a playable file with the expected duration ±1 s and an audio stream.
- A failed job leaves no output row and no final key.

**Retry:** no automatic retry. "Render again" creates a new job with `attempt + 1` and the same inputs hash. Earlier failed jobs are kept for diagnosis.

**Cancel:** sets `cancel_requested`. The worker checks it between stages and kills ffmpeg.

## R2.5 Reviewed schema compared with the first release and future tracks

> **SUPERSEDED (Revision 5):** the resolution column is replaced by R4.3 C1 (scene clips own their duration, R3.4).


| Track | First release needs | Reviewed schema | Fit | Gap and resolution |
|---|---|---|---|---|
| **Scene** (Lala's scenes) | picture per beat (still or angle video), duration, order, video in/out | C1: scene length stays `scenes.duration_seconds`, order `scene_number`. `timeline_items` is for object and camera keyframes, visibility, angle change and transition | **Partial** | No scene-video in/out. Duration lives on `scenes` rows the **legacy editor also writes** (Q5 keeps it). **Resolution:** scene timing stays on `scenes` (one owner, per the ruling "the Timeline owns duration"); add `scene_video_in_s` and `scene_video_out_s` to a new per-scene edit row; the legacy editor and the new one show the same durations. DECISION Q17 |
| **Prime video** | take, trim, placement, layout, visibility | C3: segments (take, trim, anchor plus offset, layout overrides, audio gain); `episode_pip_settings`; `episode_pip_visibility` | **Good** | Add segment `superseded_by` (take replaced), keep `status` |
| **Prime commentary** | gain, mute, fades, sub-range, synced | C3 segment `audio { role: 'prime_voice', gain }` | **Partial** | Add `audio_in`, `audio_out`, `muted`, `fade_in_ms`, `fade_out_ms`, with R2.2's constraints |
| **Dialogue** | approved take placed at its line, optional nudge | none in C1/C3; voice is A6 (review R2.3) | **Missing** | Placement is derived from `line_start` anchors (no row needed). A nudge is a `timeline_items` row of a new kind, `audio_offset`, targeting the line association. C1's `kind` list is extended, not forked. **SUPERSEDED (R7.4):** an explicit `dialogue_placement` row per line, placed by hand from a beat's start or the edit's start |
| **Overlays** (later) | phone or UI overlay, time, layout | C1 `object_visibility` and keyframes cover timing; overlay objects come from the Stage (episode-scene object ids, C2) | **Good** (later) | none |
| **Music, SFX** (reserved, Q9) | library file, range, gain, fades, ducking setting | none | **Missing** | New `timeline_audio_items` (`track` ∈ music, sfx; `asset_ref` library id; `source_in`, `source_out`; anchor plus offset; gain, fades; `duck_under_dialogue_db` explicit). Created in C1 so the tracks are **reserved**, with no UI in the first release |
| **Captions** (later, Q8) | SRT from lines and timings | none | **Missing**, deferred | Derived at render from approved lines and their placements. Manual caption edits later, as `timeline_items` kind `caption_override` |
| **Project** | a saved, editable timeline | none: C1 and C3 are per episode | **Missing** | **Recommendation:** one live edit per episode (as C1/C3 and the manifest assume), plus **named saved versions** (immutable snapshots of the episode's edit rows, restorable), rather than several parallel projects. This keeps one owner per fact. DECISION Q18 |

**Result:**
- adopt C3, with the commentary fields;
- adopt C1's `timeline_items`, with the `audio_offset` kind added;
- add `timeline_audio_items` (reserved music and SFX), `episode_scene_edits` (scene video in/out), `edit_versions` (saved snapshots) and `render_jobs`.

§4.3's `edit_projects` and `edit_items` are **withdrawn**.

## R2.6 Duplicates, speaker changes, restored scripts and approval invalidation, without guessing

**Structured line context (Q11).** Each association and each approval stores:
- `beat_number` and the beat's header text, as written;
- `line_index` (teleprompter counting) and `occurrence`: which instance of identical lines in the beat, counting from the top;
- `speaker` (resolved character key and the written name), `delivery_note` and `words`;
- `row_hash`: the SHA-256 of the normalised whole line;
- `prev_hash` and `next_hash`: the row hashes of the counted lines before and after it, or a beat edge;
- `script_revision`: the `sr1-` hash.

**The one rule** (pure, shared by front and back, unit-tested case by case):

| Case | Decision | Why it doesn't guess |
|---|---|---|
| Revision unchanged since the check | bound | nothing changed |
| Same position, same row, same neighbours | bound | three independent matches |
| Same row and neighbours at another position, same beat, and the only such match | **moved**: needs a person's confirmation | the move is unambiguous, but a person still decides |
| **Identical lines** (two `Lala: Okay.` in a beat) | Bound only with position **and** both neighbours matching. Otherwise **ambiguous**: shown with each possible line; a person picks | the occurrence index alone is never trusted after an edit |
| **Speaker changed** (`Lala:` → `Guest:`), even with the same words | **unbound** | the speaker is in `row_hash` and checked separately |
| **Delivery note changed** | **unbound** | the note is in `row_hash` |
| Words changed | **unbound** | — |
| Line moved to another beat, or the beat renumbered | **unbound**, with a "possible match in beat N" hint and no action | cross-beat matches are never applied |
| **Script restored** to an older version | Evaluated like any new revision. Associations are re-checked; **approvals are not revived** (R2.1) | approval validity walks the history |
| Unsaved page text | the server refuses association or approval unless the sent revision is current | — |
| Prime's line | refused | Prime's voice is her take only |

**When an approval is invalidated:**
- the line plays silent in the Teleprompter (Q3) and in a working preview, with a marker;
- review-ready previews are refused;
- the take and its recording stay;
- Voice Studio shows the reason ("speaker changed in revision of 27 Oct 15:02"), with **Approve again** when the take is bound again, or **Reassign** otherwise.

## R2.7 New questions

> **SUPERSEDED (Revision 5):** answered (R3.0, R4.0, R5.0).


- **Q15:** approval validity by history walk (recommended), or by checks written after each script save, which touches the A1c save path?
- **Q16:** the dedicated `episode-render` PM2 process: started by Evoni by hand once, or by a reviewed Deploy-workflow change?
- **Q17:** scene duration stays on `scenes`, shared with the legacy editor (recommended), or a separate override for the new editor?
- **Q18:** one live edit per episode with named saved versions (recommended), or several parallel projects?

## R2.8 A1 status

The independent export job settings fix is implemented and tested **locally** on branch `claude/export-job-settings`. It is reported separately; nothing is pushed.

---

## 0. Summary

1. **Today no path ends in a finished episode** (VERIFIED, §1.3):
   - The only render path produces a **silent slideshow of one still per scene**.
   - It has no PIP, no audio and no video clips.
   - Its job arguments don't match what the worker reads (the fix is on the unpushed local branch `claude/export-job-args`).
   - The worker that runs it, `episode-worker`, is **stopped** in production (Deploy #171 and #172 logs).
2. **Voice clips can be recorded but not uploaded, chosen or approved** (VERIFIED, §1.1):
   - There is no file-upload control anywhere in the frontend.
   - A new recording soft-deletes the line's previous one, which is never listed again.
   - Nothing is approved, and every live clip plays.
   - Clips are tied to (beat number, line position), and the server checks nothing against the script.
3. **The architecture already decides most of the rules** (RULINGS, §2):
   - an approved source per line, with no preference by kind;
   - Prime's voice only from her take;
   - PIP visible by default at the bottom right;
   - anchor plus offset for timing;
   - one mix plan shared by preview and export;
   - export only from an immutable manifest.

   This design follows them. **New ground:** music, captions, trim, gain and fade on line clips, extracting lines from raw takes, and multiple candidates per line.
4. **Identity is the real constraint** (§3):
   - Line-keyed voice work (A1d) is gated until R3 is live and verified (A1c audit §12.3).
   - This design proposes a **restricted, validated association** that needs no line keys. It never moves audio to another line silently, and it migrates to line keys at A1d without guessing.
   - Whether to build it before R3 is DECISION Q1.
5. **The first functional goal fits the rulings as a *preview render*, not an export.**
   - The goal: one episode, assets attached, Prime's PIP and Lala's scenes arranged, saved, rendered to a playable 16:9 MP4.
   - The spec (§8, RULING) lets only an approved manifest be exported.
   - A preview MP4 rendered from the saved edit uses the same layout and mix code (spec §10, RULING) and approves nothing.
   - The approved export follows the manifest work (A10).

---

## 1. Verified inventory

### 1.1 Voice

**What exists (VERIFIED):**

| Piece | What it does | Where |
|---|---|---|
| `script_voice_clips` table | `id, episode_id, beat_number, line_index, speaker, line_text, s3_key, url, content_type, duration_seconds, file_size_bytes, created_by`, timestamps, `deleted_at`. Unique live clip per `(episode_id, beat_number, line_index)`. **In production:** the table exists, with 0 rows (Evoni's query, 2026-10-27). | migration `20261020120000-create-teleprompter-remote-and-voice-clips.js:68-87` |
| Save | `saveClip` soft-deletes the line's live clip, then inserts the new one, in one transaction | `scriptVoiceClipsService.js:128-153` |
| Routes | `GET` / `POST` / `DELETE /api/v1/script-voice-clips/:episodeId[/:clipId]`, `requireAuth` only. 25 MB limit; accepts `audio/*` or .webm .ogg .oga .opus .m4a .mp4 .mp3 .wav .aac | `scriptVoiceClipRoutes.js:30-46, 63-113`; `app.js:1067-1069` |
| Recorder | Browser microphone (MediaRecorder); format is mp4, else webm;opus, else webm, else ogg | `useVoiceRecorder.js:78-116`; `voiceClipsApi.js:23` |
| Record panel | Record → review → Re-record / Save ("replacing the old clip") / Cancel / Remove. Also the `VoiceBadge` "line changed since recorded" | `VoiceRecord.jsx:16-22, 67-129` |
| Where you record | A mic beside each line on the Script tab; the voice panel in the Teleprompter (`/teleprompter`, in the Sidebar) | `EpisodeScriptTab.jsx:589-597`; `TeleprompterReader.jsx:1535-1541` |
| Playback | Teleprompter only. One `Audio` per line; the line's clip if its words still match, else a same-beat clip with the same words | `useLineVoice.js:17-61`; `voiceClipsApi.js` `clipForLine`, `isStale` |
| Line counting | `teleprompterIndexMap` counts dialogue, actions, narration and breaths. It skips blank lines, `[UI:]`, `[SFX]`, other tags and `Lala (auto):` | `teleprompterLines.js:224-233` |
| Raw takes | `episode_raw_clips`: performer `lala` / `justawoman` / `guest`, `beat_number`, `is_favorite`, `start_line`, `beat_marks [{beat,t}]`, `url_raw`, chroma-key `url_cutout` (keeps audio, `-c:a libopus`) | `rawClipsService.js:14-38, 395-411` |
| Server media tools | ffprobe and ffmpeg; `run` at nice 15; S3 stream up and down; a one-at-a-time in-process job queue (lost on restart) | `rawClipMedia.js:70-191` |
| Waveform drawing | wavesurfer.js, Timeline only | `components/Timeline/AudioWaveform.jsx` |
| Mic level meter | AnalyserNode | `hooks/useMicLevel.js:20` |
| Draft and approved pattern | `episode_performance_clips` (video, one per beat per performer) | `performanceClipsService.js:11-13, 38-39` |

**What works end to end (VERIFIED in code; INFERRED in production):** record → review → save → the line's earlier clip replaced → badge → plays in the Teleprompter.

**What is missing:**
- an upload UI;
- candidates (several takes for one line);
- clip history;
- approval;
- source tracking (uploaded, recorded or extracted; which take; what time range);
- extracting audio from a take (no `-vn`, no `silencedetect` anywhere);
- trim, gain and fade;
- a server-measured duration;
- any server check of the line against the script;
- TTS for script lines. This is correct: paid generation stays off (review R3.4, RULING).

**Defects found (VERIFIED unless marked):**

| # | Defect | Where |
|---|---|---|
| V-1 | Any signed-in user can delete any clip (no ownership or role check) | `scriptVoiceClipRoutes.js:101-111` |
| V-2 | The duration is the browser's wall-clock time, never ffprobed. Over 600 s is refused (400) after the take is recorded | `useVoiceRecorder.js:106`; `scriptVoiceClipsService.js:24, 86` |
| V-3 | The voice upload doesn't pass `keepSession`, unlike raw takes. An expired sign-in can lose the take (effect INFERRED) | `voiceClipsApi.js:54`; `rawClipsApi.js:62` |
| V-4 | Lines in cutscene beats (11–13) can be recorded but never play | `TeleprompterReader.jsx:565, 1308-1312` |
| V-5 | Replaced and deleted files stay in S3, and nothing lists them. This is good for "preserve all recordings", but they can't be found | `scriptVoiceClipsService.js:156-167` |
| V-6 | A change of speaker only (`Lala:` to `Guest:`), or of the bracketed delivery note only, isn't detected; the old clip plays for the new speaker | `voiceClipsApi.js` `isStale`; `scriptExport.js:104` `readLine` |
| V-7 | `keyForStoredLine` (the A1d helper that would re-key clips) compares the clip's words with the whole script line (`Lala: Ooh, mail!`). Its test passes the whole line, but real clips store the words only. It would return null for every real dialogue clip. Not yet called. | `src/utils/lineKeys.js` `keyForStoredLine`; `tests/unit/utils/lineKeys.test.js:251`; `TeleprompterReader.jsx:1312` |
| V-8 | `episode_raw_clips.start_line` uses the same position counting and stores no text, so a shift can't be detected at all | `rawClipsService.js:156-160` |

### 1.2 Timeline

**What exists (VERIFIED):**
- `/episodes/:episodeId/timeline` → `TimelineEditor.jsx`. The Sidebar's "Timeline Editor" goes to the episode picker `/studio/timeline` (`StudioTimelinePage.jsx`).
- It reads `scenes` and `timeline_data`.
- It autosaves every 3 s to `POST /api/v1/episodes/:id/save` (`episodes.js:208-301`).
- **It can:** reorder scenes, resize a scene's duration (minimum 0.5 s), add or delete scenes, beats and markers, use keyframes in the preview, undo and redo, play with J/K/L, and choose a platform preset.
- **It can't:** trim (in and out points), split, set volume, play video, place a PIP, or show audio. "+ Audio" adds `audioUrl: null`.

**Defects (VERIFIED):**

| # | Defect | Where |
|---|---|---|
| T-1 | Keyframes are never saved. `/save` keeps only beats, markers, audio_clips and character_clips; `PUT /timeline-data`, which takes keyframes, is never called | `episodes.js:284-289`; `timelineData.js:40-60` |
| T-2 | Moving an element in the preview isn't saved (`onUpdateElement` is never passed) | `PreviewMonitor.jsx:17, 121` |
| T-3 | A deleted beat scene comes back (scenes with `scene_plan_id` are never removed by a save) | `episodes.js:270` |
| T-4 | Export menu: YouTube, Instagram, Schedule and Draft are `console.log` placeholders | `ExportDropdown.jsx:19-34` |

**Stores that already exist, and what this design does with them:**

| Store | Status | Use in this design |
|---|---|---|
| `timeline_data` (JSONB beats, markers, audio_clips, character_clips, keyframes) | live, legacy | Frozen and read (decisions R5); adopted only by "Adopt" (review D2) |
| `scenes` (duration, `background_url`, `scene_set_id`, `scene_angle_id`, `scene_plan_id`) | live | The Lala scene source for each beat |
| `scene_angles` (`still_image_url`, `video_clip_url`) | live | Scene picture, still or video |
| `episode_scenes` (`trim_start`, `trim_end`) | live, other path | Not the edit's store. Noted as an existing trim model |
| `timeline_placements` | live, UI dead | Not used in v1. Overlay placements later (§7, T7) |
| `audio_clips`, `character_clips` (animatic) | routes mounted, no frontend caller | **Not reused.** Keyed by scene/beat ids, not script lines, and their table is outside `src/migrations` |
| `music_cues` | AI-suggested rows, no audio file | Suggestions for the music track, later |
| `layout_templates` (`picture_in_picture`) | game-show use only | Not reused; the PIP layout follows the spec defaults |
| `VideoProcessingJob`, `LayerPreset`, `SceneLayerConfiguration`, `UiOverlayType`, `TimelinePlacementsSection.jsx` | dead | Left alone |

### 1.3 Render and export (VERIFIED)

**Path:** `POST /api/v1/episodes/:id/export` (`export.js:21`) → Bull `video-export` (`videoQueue.js:34,134`) → `workers/start.js` → `videoRenderer.js`.
- `videoRenderer.js` draws one PNG per scene with node-canvas and joins them with the FFmpeg concat demuxer (libx264, yuv420p, 30 fps) into `exports/{episode}/{ts}.mp4`.

**Problems:**
- `// TODO: Add audio mixing` (`videoRenderer.js:546`); there is no audio input.
- `platform.width` is read from a string (`:274, 529`), so the output is always 1920×1080. `job.data.timeline` isn't sent; the route sends `timelineData` (`export.js:111-135`).
- Keyframes are evaluated at t = 0 only, in a shape the editor never writes (`:315, 445`).
- The output is always `output.mp4` (`:80`); the WebM choice is ignored.
- Export first re-syncs beat backgrounds (`syncBeatScenesQuietly`, `export.js:73`), which may overwrite a background chosen in Scene Studio (INFERRED; follow-up audit).
- The worker is shared with scene generation (`start.js:29`) and is **stopped** in production. Jobs wait in Redis.
- Not read by export: video clips, raw-take cutouts, Scene Studio `scene_assets` / `canvas_settings`, placements, overlays, voice clips.
- There is **no PIP code** anywhere. `resolveSceneComposition` and `resolvePip` exist only in documents.

---

## 2. Rulings this design follows

**Voice and audio:**
1. **One approved source per Lala, NPC or guest line**, recorded or generated, with no preference by kind (decisions R4; spec §4.1; review R2.3).
   - An active line with no approved source plays silent in preview, with a marker, and blocks export (`line_audio_unapproved`, spec §4.1).
   - Unused alternates never block export.
2. **Prime's voice comes only from her take**, the `prime_voice` role of the PIP system. It is never a dialogue-line source, and no line clip is ever attached to a Prime line (spec §4.1; decisions Q3). One file, one clock: the PIP video is muted, and her voice plays once from the same file with the same in and out points (decisions Q3).
3. **Approved audio is never regenerated or replaced automatically.** A changed line marks it outdated and keeps it (review D4). Paid generation stays off without an approved provider, rights and limits (review R3.4).
4. **The voice monitor switch** while recording Prime is explicit and never inherited (review D6).

**PIP:**
5. **PIP defaults:** her real video, bottom right, about 28 % of the frame width, visible in all 14 beats.
   - Frame, position, size, background removal and visibility are each editable.
   - It is never hidden by a cutscene rule and never frozen automatically.
   - Missing footage uses the fallback with a warning and never adds audio (spec §1; decisions R2, R3, §8.1, §14). **SUPERSEDED (R4.0, R5.0):** no fallback image; gameplay full-screen with a working-preview warning; required beats block review-ready and final.
6. **Layer order:** scene < PIP < phone < overlays < toasts < cursor < stats (spec §6.6).

**Timing:**
7. **The Timeline owns duration.** Every timed item is an anchor plus an offset (spec §1, §3).
   - No approved performance is stretched, trimmed or shifted automatically; that only raises findings (spec §3.2).
   - The Director's items are proposals, accepted through the Timeline (spec §6.3).

**Approval and export:**
8. **Preview and approved are separate; export reads only an immutable manifest** (review D1; spec §8). Media are content-addressed (review R3.5). Approval is prepare, then commit (review R3.2).
9. **Preview and export share one layout and one mix plan.** Only the clock and the snapshot differ (spec §10).

**Data and identity:**
10. **Nothing is dropped.** Legacy tables, `script_voice_clips` and `timeline_data` included, are frozen or read alongside (decisions R5).
11. **Line-keyed work waits for A1c R3 and A1d** (A1c audit §12.3).
    - Any durable reference to script versions follows the retention contract (A1c R4.5).
    - The A1c releases never touch `script_voice_clips` (A1c R4.8).

**Still open (no ruling yet):** music, captions, the line-clip trim/gain/fade model, raw-take extraction, and candidates. §4 and §5 propose them; §9 asks.

---

## 3. Identity and data integrity

### 3.1 How a clip lands on the wrong line today (VERIFIED, INFERRED effects)

| Edit in beat B above or around a recorded line | Effect on the clip at (B, i) |
|---|---|
| Insert, delete or move a counted line | Every clip below shifts by one. The Script tab shows the wrong line with the stale badge and the right line with nothing; the Teleprompter's same-beat word match may rescue it |
| Insert a `[UI:]`, `[SFX]`, tag, auto-reaction or blank line | No shift |
| Move a line to another beat | Lost (the rescue is same-beat only) |
| Renumber a beat, two beats with one number, a script without headers | The clip points at another beat, or none. A script without headers is cut into 14 by position, and the Teleprompter treats it as beat `null` |
| Regenerate, AI rewrite, restore a version, event inject | Words change: stale badge, no playback |
| Change only the speaker or the delivery note | **Not detected**; it plays for the new speaker (V-6) |
| Re-record at a position | Soft-deletes whatever clip is live there, possibly another line's that moved (A1c audit §R4.8 risk) |

The server never checks the sent `line_text` or position against the saved script, and the upload carries no script revision.

### 3.2 Restricted, validated association (PROPOSED)

This is a way to tie audio to a line before stable line keys exist. It **does not read or write line keys**, so it is not an A1d "key consumer". It also **never moves audio to another line by itself**.

**At creation**, each candidate records an *association*:
- `beat_number` and `line_index` (teleprompter counting, as today);
- `speaker`, the **delivery note**, and `line_words` (as today's `line_text`);
- `line_row_hash`: the SHA-256 of the whole normalised script line, speaker included. This is the shape `scriptLines` uses (`src/utils/lineKeys.js`).
- `script_revision`: the `sr1-…` token the client read (A1c R1). This is a hash, not a version row id, so it creates **no durable reference to a version** and the retention contract (R4.5) is not engaged. DECISION Q11 confirms.

The server validates at creation:
1. It loads the saved `script_content`.
2. It refuses (409) unless the sent revision is current. This covers unsaved page text.
3. It re-derives the teleprompter line at (beat, index) and refuses unless speaker, words and row hash match.
4. Lines whose speaker is Prime are refused: they have no line clips (ruling 2).

**On every read**, one shared resolver is used by the Script tab, Voice Studio, Teleprompter, Timeline, preview render and manifest:
- **bound:** the line at (beat, index) has the same row hash.
- **moved:** exactly one line in the same beat has the row hash, at another position. It is shown as "this take is on line 7 now. Confirm?" and is **not** played or used until a person confirms. Confirming rewrites the association and records who and when.
- **unbound:** anything else, including duplicates, another beat, speaker or note changed, and words changed. Shown as "line changed since recorded". It is never played, placed or exported. The candidate stays, and it can be reassigned to a line by hand, validated as at creation.

**Approval:**
- Only a **bound** candidate can be approved.
- Approval records the row hash and revision it approved.
- A later change that makes it moved or unbound makes the approval **outdated**. The approval is kept, never dropped, but blocks export until re-approved (rulings 1 and 3).

**Nothing is replaced:**
- A new recording, upload or extraction adds a candidate.
- No save soft-deletes another candidate.
- Removing a candidate is an explicit soft delete of that one candidate; its recording stays.

### 3.3 Migration to stable line keys (PROPOSED, at A1d)

When R3 is live and verified, the A1d backfill:
1. Fixes `keyForStoredLine` (V-7) to match by `line_row_hash`.
2. Sets `line_key` on each candidate whose row hash is **unique** in the keyed script at its association revision, or in the current script.
3. Leaves every other candidate `unbound` for a person to assign, and never guesses.
4. Keeps the position columns, read as fallback only (decisions M2/F4: "alongside", nothing dropped).
5. After the backfill, the resolver prefers `line_key`, and approval binds to `line_key`. The hash check stays as a second guard.
6. Legacy `script_voice_clips` rows are imported as candidates first (§4.2), so A1d needs only one path.

### 3.4 Can the first milestone go ahead before R3? (DECISION Q1)

**Yes, with the restrictions above, if Evoni accepts them.** Why it is safe:
- Audio is never associated, played, placed or exported unless it is bound and the hash matches.
- Every association is validated against the saved script revision.
- A "moved" take needs a person's confirmation.
- Nothing is deleted or overwritten.
- No line key is read or written, so R2/R3 are untouched.

**What it costs:**
- Every script edit above a line asks for "confirm moved" on the clips below it. This is the price of no keys, and it ends at A1d.
- Approval resets more often.
- Bulk edits (Regenerate, rewrite) unbind the beat's clips until reassigned.

**Not safe, and not proposed:**
- keeping today's replace-on-save;
- keeping today's play-any-live-clip;
- any automatic rebinding beyond the single unique same-beat move, which itself needs confirmation.

This milestone also brings forward part of approved step 7 (A6a voice states) and its own data model ahead of steps 2–6 of the review's R2.6 sequence. That is a re-sequencing of an approved plan, so it is Evoni's call (Q1).

---

## 4. Data model (PROPOSED)

> **SUPERSEDED (Revision 5):** this section's tables (`voice_recordings`, `edit_projects`, `edit_items`, the approval table and the associating legacy import) are replaced by R4.3 as amended by R5.3. Do not build from §4.


**Conventions:**
- All new tables have `deleted_at`, live under `src/migrations/` and are additive.
- No existing table, column or index is changed.
- `script_voice_clips` and `timeline_data` stay as they are, frozen for writes once the new path is live, and readable.

### 4.1 Voice

**`voice_recordings`** is the immutable source media; one row per file. It is never edited.
- `id, episode_id, source_kind ('uploaded' | 'recorded' | 'extracted' | 'legacy')`
- `s3_key, sha256, content_type, file_size_bytes`
- `duration_seconds` (ffprobed on the server)
- `sample_rate, channels`
- `original_filename, created_by`
- For `extracted`: `source_raw_clip_id → episode_raw_clips`, `source_in_s`, `source_out_s`
- For `legacy`: `legacy_voice_clip_id → script_voice_clips`
- timestamps, `deleted_at`
- Stored at `episodes/<id>/voice/recordings/<sha256>.<ext>`. It is never overwritten, and this design adds no lifecycle rule.

**`line_voice_candidates`** is one take for one line: a range of a recording, plus non-destructive adjustments.
- `id, episode_id, recording_id → voice_recordings`
- `in_s, out_s` (a sub-range of the recording, 0 to duration)
- `gain_db` (−24 to +12)
- `fade_in_ms, fade_out_ms` (0–2000)
- `normalise` (bool, default false)
- The association (§3.2): `beat_number, line_index, speaker, delivery_note, line_words, line_row_hash, association_revision, associated_by, associated_at`
- `line_key` (null until A1d)
- `rendered_s3_key, rendered_sha256, rendered_for` (the hash of the settings): the derived file. It can be rebuilt from the recording and the settings at any time.
- `label, created_by`, timestamps, `deleted_at`

**`line_voice_approvals`** is the approved choice for a line, kept as history.
- `id, episode_id, candidate_id`
- `approved_row_hash, approved_revision, approved_settings_hash`
- `approved_by, approved_at`
- `superseded_at, superseded_by`
- At most one current approval per line: a partial unique index on `(episode_id, beat_number, line_index)` where current. After A1d it moves to `(episode_id, line_key)`.
- Changing the candidate's trim, gain or fade after approval makes the approval **outdated** (the settings hash differs). It stays until re-approved.

The status shown for a line (`none`, `draft`, `approved`, `outdated`, `unbound`) is **computed**, never stored, so it can't drift.

### 4.2 Legacy voice clips

`script_voice_clips` rows (0 in production on 2026-10-27) are imported by a one-way, idempotent job:
1. Each live or soft-deleted row becomes a `voice_recordings` row (`legacy`) plus one candidate.
2. The candidate's association is validated as at creation, against the current script.
3. **No import is approved.** This differs from SPV §5.4, which made them approved; DECISION Q2.
4. The old table is untouched.

The Teleprompter reads the new resolver (approved only, ruling 1), with Q3 deciding the changeover.

### 4.3 Edit project (Timeline)

**`edit_projects`**: `id, episode_id, name, status ('draft' | 'archived')`, `canvas` (1920×1080, 30 fps), `based_on_revision`, `created_by`, timestamps, `deleted_at`. One episode can have several, with one marked current.

**`edit_items`**: one row per placed thing.
- `id, project_id, track`, one of:
  - `scene` (Lala's scene)
  - `prime` (Prime PIP video and its linked commentary)
  - `dialogue`
  - `overlay`
  - `music`
  - `sfx`
  - `caption`
- `source_kind`, `source_id`: a scene / scene angle, a raw clip, a line candidate, an overlay asset, a library audio file, or a caption line.
- **Anchor:** `anchor` (`beat_start` / `beat_end` / `line_start` / `line_end` / `item_start` / `item_end`), `anchor_ref`, `offset_ms`. This follows the decisions' "anchor plus offset" (§3.2) and spec §3.
- `in_s, out_s` (source trim)
- `duration_ms` (scene items only; the Timeline owns duration)
- `layout` (`{x, y, w, h}` in 1920×1080 pixels, review G4; `z`; `crop`; `cutout` true/false): PIP and overlays
- `gain_db, muted, fade_in_ms, fade_out_ms`
- `visible`; `linked_item_id` (Prime's commentary lane, §5.2)
- `origin` (`auto` / `user` / `director`), `approval` (decisions §3.1)
- timestamps, `deleted_at`

This **overlaps with the review's C1 `timeline_items` and C3 PIP tables**, which are still awaiting Evoni's acceptance (review §6). DECISION Q4 chooses:
- **(a)** adopt C1 and C3 and add the audio and caption tracks to them, or
- **(b)** use `edit_items` and withdraw C1 and C3.

The recommendation is (a), so there is one model. This document's fields are what the tracks need either way.

**`render_jobs`**: `id, project_id, kind ('preview' | 'final')`, `manifest_id` (final only), `status`, `progress`, `settings` (resolution, fps, codec), `output_s3_key`, `output_sha256`, `error`, `started_at`, `finished_at`, `created_by`, timestamps, `deleted_at`.
- Durable, unlike today's Bull-only jobs, whose download lasts only as long as Bull keeps the job.
- A preview is never a final.

---

## 5. Page layouts (PROPOSED)

### 5.1 Voice Studio

**Route:** `/episodes/:id/voice`, linked from the Script tab, the Episode page and the Sidebar's production group (CLAUDE.md: new routes need an entry).

**Phone (375 px), one column:**

```
┌ Voice Studio · Ep 12 "I Designed My Outfit…" ─────┐
│ Beat ◀ 6 · Strategic Reaction ▶   12/31 lines OK ⚠3│
├────────────────────────────────────────────────────┤
│ LALA  "This is my moment."            ● approved   │
│ GUEST "Love the look!"                ○ 2 takes    │
│ LALA  "Wait, what?"        ⚠ line changed — 1 take │
│ PRIME "…"   Prime's voice comes from her take ▸PIP │
└────────────────────────────────────────────────────┘
  tap a line ▾
┌ LALA · "This is my moment." ──────────────────────┐
│ [● Record] [⬆ Upload] [🎞 From a take]             │
│ Takes                                              │
│  ◉ Take 3 · extracted · Take "Full ep A" 04:12–04:15│
│     ▶ ▁▂▅▇▅▂▁▁▂▅▇▆▃▁   in |◀ ▶| out                │
│     gain −2 dB · fade 40/120 ms   [Approve this]   │
│  ○ Take 2 · recorded 10/27 14:02                   │
│  ○ Take 1 · uploaded lala-line6.wav                │
│ Approved: Take 3 (Evoni, 10/27 15:10)              │
└────────────────────────────────────────────────────┘
```

**Desktop:** three panes. The beat and line list sits on the left. In the middle is the line's takes, with a waveform editor (wavesurfer.js, already a dependency). On the right is a source picker for upload, record or take.

**From a take:**
1. Choose a raw take (performer `lala` or `guest`; `justawoman` takes are refused, ruling 2).
2. It opens at the beat's mark (`beat_marks`).
3. Scrub the waveform and set in and out.
4. **Extract** queues the ffmpeg job.
5. The candidate appears when the job is done.

**States per line:**
- none
- draft (takes, none approved)
- approved
- outdated (approved, but the line or the settings changed)
- unbound (line changed, needs reassigning or confirming)
- moved (confirm)

**Prime lines:** shown read-only with a link to her PIP take in the Timeline.

### 5.2 Timeline Editor

> **SUPERSEDED (Revision 5):** track rules on missing footage: no fallback; see R4.0 and R5.1. The rest of the layout stands as a sketch.


**Route:** `/episodes/:id/edit`.
- A new page beside today's `/episodes/:id/timeline`, which keeps working on `timeline_data` until "Adopt into Edit" (review D2: legacy is adopted only by an explicit action, after a dry run).
- The Sidebar's "Timeline Editor" points here once phase T2 ships. DECISION Q5.

**Desktop:**

```
┌ Ep 12 · Edit "Main cut" (draft) ── ⚠ 4 warnings ── [Preview render] [Request approval] ┐
│ Beats: [1][2][3][4][5][6●][7][8][9][10][11][12][13][14]          00:07:42 / 00:18:30    │
├──────────────────────────────────────────────────────┬──────────────────────────────────┤
│  ┌──────────────── 16:9 preview ────────────────┐    │ Inspector: PRIME · Take "Full A" │
│  │   Lala's scene (beat 6 angle)                │    │ in 04:02.10  out 05:10.00        │
│  │                                   ┌───────┐  │    │ position x 1340 y 740  w 540     │
│  │                                   │ Prime │  │    │ cutout ✓  frame: rounded         │
│  │                                   └───────┘  │    │ visible ✓ (beat 6)               │
│  └──────────────────────────────────────────────┘    │ commentary gain −3 dB  mute ☐    │
│  ◀◀  ▶  ▶▶   J K L   snap: lines ✓                   │                                  │
├──────────────────────────────────────────────────────┴──────────────────────────────────┤
│ SCENE     |██ b5 ███|████ b6 ████████|██ b7 ██|                                          │
│ PRIME     |▓▓▓▓▓▓▓▓▓▓ Full A ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓|                                          │
│ PRIME VO  |~~~~~~~~~~ (linked) ~~~~~~~~~~~~~~~|                                          │
│ DIALOGUE  |  ▮L6.1  ▮G6.2   ⚠L6.3 unapproved  |                                          │
│ OVERLAYS  |       [phone: DM Sable]           |                                          │
│ MUSIC     |≈≈≈≈≈≈≈≈≈ "Runway" −18 dB ≈≈≈≈≈≈≈≈|                                          │
│ SFX       |   •click  •notify                 |                                          │
│ CAPTIONS  |  "This is my moment."  "Love…"    |                                          │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

**Phone:** the preview sits on top, with the beat chips. Tracks are a vertical list for the current beat. Selecting an item opens a bottom sheet with trim, position, volume and visibility. The full multitrack view is desktop only (DECISION Q6).

**Track rules:**
- **Scene:** one item per beat, from the beat's scene or scene-set angle (still or `video_clip_url`). Its duration is the Timeline's.
- **Prime:** segments from raw takes with `performer = 'justawoman'` (favourite per beat first, `is_favorite`).
  - The layout default is bottom right at 28 %, visible.
  - Missing footage shows the fallback with a warning and no audio.
- **Prime commentary:**
  - A linked lane of the same file and clock (ruling 2).
  - Its own gain, mute and fades, and it can be trimmed **inside** the video segment's range.
  - It can't slide against the video, which would break sync.
  - Hiding the PIP never mutes it.
- **Dialogue:** approved, bound candidates placed at `line_start` anchors.
  - Where teleprompter marks are missing, the timing is "estimated" (spec §3). **SUPERSEDED (R7.3, R7.4):** no line timing is ever estimated; dialogue is placed explicitly (`dialogue_placement`, beat-relative or absolute), or from actual recorded marks; an approved line without either is unplaced and blocks.
  - Overruns are findings, never automatic changes (spec §3.2).
- **Overlays:** phone and UI overlays, later (T7). **SFX:** library slots only (spec §9). **Music:** library files. **Captions:** from the script lines and the dialogue timings (T8).

**Warnings panel**, one list fed by the shared resolver; each item jumps to its source. **SUPERSEDED (R7.6):** the codes and severities are R7.6's table; `take_overruns_scene` and `line_overruns_gap` are not built.
- `line_audio_unapproved`
- outdated approval
- unbound or moved take
- missing scene picture
- missing Prime footage (fallback)
- `take_overruns_scene`
- `line_overruns_gap`
- empty SFX slot
- caption without timing

---

## 6. The workflow, from script to YouTube

```
Script tab ─ write / approve beats (A1c R1 save + revision)
   │
   ├─► Teleprompter ─ Prime records full-episode takes (beat_marks) ─► Assets → raw takes
   │                                                                       │ green removal (cutout)
   ▼                                                                       ▼
Voice Studio ─ per Lala/guest line: record | upload | extract from take ─► candidates
   │            trim · gain · fade (non-destructive) ─► Approve one per line
   ▼
Timeline Editor (edit project, draft)
   │  scenes per beat (scene sets) · Prime PIP + linked commentary · approved dialogue
   │  overlays · music · SFX · captions · warnings
   ├─► Preview render (MP4, draft, approves nothing) ─► watch, fix, repeat
   ▼
Request approval ─ prepare → commit: immutable manifest + content-addressed media (A10)
   ▼
Final export (from the manifest only) ─► 1920×1080 H.264/AAC MP4 (+ SRT)
   ▼
Evoni uploads to YouTube (the in-app upload remains a placeholder, T-4; later phase)
```

---

## 7. Phases (small, each independently testable)

> **SUPERSEDED (Revision 5):** replaced by R5.4 (sequence), R5.5 (B1) and R5.6 (C1).


**Bug fixes first, independent of the design (each its own PR):**
- **B-1:** the export job arguments. Bring the local `claude/export-job-args` (`35fb3af3`) up to date with main and review it.
- **B-2:** voice delete ownership (V-1); `keepSession` on the voice upload (V-3); server ffprobe duration and a clear error over the cap (V-2); no recording on lines that never play (V-4).
- **B-3:** Timeline keyframes saved (T-1); element moves saved (T-2); deleted beat scenes stay deleted (T-3).
- **B-4:** the `keyForStoredLine` shape (V-7), with a test on real clip text. It can wait for A1d, but must land before it.

**Voice:**
- **V1, data:** `voice_recordings`, `line_voice_candidates`, `line_voice_approvals`; the shared resolver (pure, shared by front and back, like `coverMatch`); the legacy import (§4.2). No UI change.
- **V2, Voice Studio, record and upload:**
  - the page;
  - upload with server-side type and ffprobe validation;
  - the existing recorder, writing candidates;
  - candidate list, play and approve.
  
  The Teleprompter and Script tab read the resolver (approved only).
- **V3, from a take:** the take picker, waveform in and out, the server extract job (`rawClipMedia` `run`, `downloadFile`, `uploadFile`; `ffmpeg -ss -to -vn`, then loudness and fades on the derived file), and the adjustments panel.
- **V4, silence-detection suggestions:** `silencedetect` over the beat's stretch of the take proposes ranges in line order, for a person to confirm. Free and local.

**Timeline:**
- **T1, data and pure core:** `edit_projects`, `edit_items` (or C1/C3, Q4), `render_jobs`; pure `layoutAt(project, t)` and `mixPlan(project)`. These are the review's A4a and A8, written once for preview and export. Unit-tested against fixtures.
- **T2, editor v1:** auto-assemble a draft from the episode (scenes, favourite Prime takes, approved dialogue); the PIP inspector; save; the warnings panel. **SUPERSEDED (R7.7):** see R7.7; plus the Resolve Placement workflow for stale dialogue placements (R7.4).
- **T3, editing:** trim, split, reorder, timing offsets, volume and fades on every track.
- **T4, preview render:** a `render_jobs` worker builds one FFmpeg filter graph from `layoutAt` and `mixPlan` (scale/overlay for scene and PIP, `adelay` / `volume` / `afade` / `amix` for audio) → a 1920×1080 (or 960×540 for speed) H.264/AAC MP4 under `previews/`. **This meets the first functional goal.**
- **T5, music and SFX:** library files and slots; per-item gain and fade; music ducking as an explicit user setting, never automatic.
- **T6, approval and final export:** the manifest (A10a/A10b), prepare and commit, final render from the manifest only, and an SRT sidecar.
- **T7, overlays:** phone and UI overlays drawn into the graph. The drawer choice (SPV R1/Q11) is decided first.
- **T8, captions:** burnt in and/or SRT (Q8).

**Smallest path to the first functional goal:** B-1 → V1 → V2 → T1 → T2 → T4. V3 joins as soon as Lala's lines come from takes.

### Dependencies

```
                 A1c R1 (live) ── revision tokens ──┐
                                                    ▼
  B-2 voice fixes ─► V1 data + resolver ─► V2 Studio ─► V3 extract ─► V4 silence
                          │  (validated association, no line keys)
                          │                                   ┌──────────────┐
  A1c R2 ─► A1c R3 ─► (verified in prod) ─► A1d backfill ─────►│ resolver     │
  B-4 keyForStoredLine fix ──────────────────────┘            │ prefers keys │
                                                              └──────────────┘
  B-1 export args ─┐
  B-3 timeline fixes┤
                    ▼
  T1 data + layoutAt + mixPlan ─► T2 editor ─► T3 editing ─► T4 PREVIEW MP4 ◄── V2 approved dialogue
                                                     │
                                                     ▼
                         A10 manifest ─► T6 approval + FINAL export ─► YouTube (manual)
                                   ▲
                 T5 music/SFX ─────┘   T7 overlays · T8 captions (feed T4/T6)
```

---

## 8. Acceptance, failure handling and rollback

> **SUPERSEDED (Revision 5):** acceptance tests are R5.5 and R5.6; rollback is R4.3 Rollback.


**V1:**
- A candidate can't be created against a stale revision (409) or a mismatched line (409).
- A Prime line is refused.
- Two candidates for one line both survive.
- The resolver returns bound, moved or unbound for each §3.1 case, including speaker-only and note-only changes.
- The legacy import is idempotent and approves nothing.

**V2:**
- An upload of a bad type or an over-limit file is refused before S3.
- The duration is ffprobed.
- An approval exists only for a bound candidate.
- Changing gain after approval shows "outdated" and blocks the preview's "ready".
- The Teleprompter plays approved only.

**V3:**
- An extracted candidate names its take and range.
- The source take and recording are byte-identical after any number of re-extractions and adjustments (the sha256 is unchanged).
- A failed job leaves no candidate and an error message.

**T1:** `layoutAt` and `mixPlan` golden tests: the PIP at bottom right 28 %; the Prime commentary in sync to within one frame; dialogue at its anchors; nothing stretched.

**T4:**
- The preview MP4 plays in a browser and VLC: 16:9 with an AAC track.
- Audio events land within one frame of `mixPlan` (spec test 23).
- A render with an unapproved line plays silence there, with a burnt-in "unapproved" marker, and approves nothing.

**Failure handling:**
- Jobs (extract, render) are durable rows. A restart marks running ones failed, with "start again"; nothing is half-written.
- Every upload streams to a temp file, then to S3, then the row is written. A failed S3 write leaves no row; a failed row write leaves an orphan file, which is logged, never deleted by the job.

**Rollback:**
- Every migration is additive.
- Each phase sits behind a setting (`VOICE_STUDIO`, `EDIT_PROJECTS`). Turning it off returns to today's paths, because the legacy tables are untouched and still read.
- Source recordings and takes are never deleted by any job.
- Render outputs live under their own prefixes.

**Production:**
- Migrations and deploys run only through the Deploy workflow, after Evoni approves.
- Rendering needs the worker running, or an in-process queue (Q7). Starting `episode-worker` is Evoni's action.
- The deploy snapshot backlog (64, the role can't prune) should be cleared before the first migration of this work.

---

## 9. Questions for Evoni

> **SUPERSEDED (Revision 5):** all answered (R2.0, R3.0, R4.0, R5.0). Q7's "green-removal queue" is withdrawn (R2.4).


1. **Before R3?** May V1–V3 proceed with the restricted, validated association (§3.2, §3.4), bringing voice states (A6a) ahead of the approved sequence's steps 2–6? Or should they wait for R3 and A1d?
2. **Legacy clips:** import as unapproved candidates (recommended), or approved as SPV §5.4 said?
3. **Teleprompter changeover:** approved clips only, from V2 (recommended, R4)? Or "approved, else the latest take, with a badge" until episodes are approved?
4. **One timeline model:** adopt the review's C1 and C3 and add the audio and caption tracks (recommended), or `edit_items` as written here?
5. **The old Timeline page:** keep it beside the new one until "Adopt into Edit", and move the Sidebar link at T2?
6. **Phone:** full editing on phone, or phone for review and small fixes, and the multitrack on desktop?
7. **Rendering:** start the stopped `episode-worker` for render jobs (your action), or run renders in the in-process low-priority queue that green removal uses? The second is slower, needs no worker, and shares the API box.
8. **Captions:** an SRT sidecar first (YouTube takes it), burnt-in later, or both?
9. **Music and SFX:** where do the licensed library files live, and who adds them?
10. **Approval granularity:** per line only, or also "approve all bound takes in this beat"?
11. **Association revision:** confirm that storing the `sr1-` revision hash (not a version row id) creates no durable version reference under R4.5.
12. **Prime commentary:** confirm it may be trimmed inside her video segment but never slid against it.
13. **Already open and needed by T4 and T6:** Q-F1 (the fallback's home) and Q-F2 (does an unresolved fallback block export or only warn); Q-E1 (export aspect).
14. **Bug fixes:** may B-1 to B-3 go ahead now as separate PRs?

---

## 10. PR #3612

PR #3612 (the must-cover "got to know" fix) changes only `coverMatch` and its tests. **It has no effect on this design.** Its status at writing: open and unmerged, with all six checks passed (Tests finished green at 17:14Z). It waits only on Evoni's merge.
