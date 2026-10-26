# Gameplay Director and animated export: implementation spec

**Status:** proposal, for Evoni's review. Nothing here is built.

Evoni's rulings, 2026-10-26, on the My Little List redesign:
- "Keep the video export as a separate project."
- "The phone should remain an interactive game interface, with its appearance controlled through the gameplay production system."
- "Do not insert a flattened checklist image into the beat-9 scene."
- "Preserve the previous no-overlays-on-beats ruling."
- "Reuse the existing database and S3 overlay assets. Do not regenerate the Mouse Cursor or Grabbing Hand."

This spec is not a blocker for My Little List: that ships through the phone preview, without the export.

## 1. What exists today

All of this was read from `main` at the time of writing. Code is cited by name.

| Piece | What it does | Gap |
|---|---|---|
| **Script UI tags** | `[UI:CLICK …]`, `[UI:OPEN …]`, `[UI:DISPLAY …]`, `[UI:HIDE …]`, `[UI:NOTIFY …]`, `[UI:DM …]`, plus `[WEAR]`, `[DELIVER]`, `[LEARNS]`. `utils/scriptBeatParser.parseScript` reads them into `uiActions` with a running offset per beat (`UI_ACTION_DURATIONS`: click 0.8 s, open 1.2 s, check_item 0.5 s, play_sfx 0 s). | Only the `/parse` routes call it. Nothing turns the actions into motion, sound or frames. |
| **Phone paths** | `utils/phonePaths` (and the frontend twin `lib/phonePaths`) checks that each tap is reachable from the current screen, and inserts the `[UI:OPEN]` lines that are missing. | No timing. |
| **Line timing** | `lib/scriptRuntime.lineSeconds`: 150 words a minute, 3 s for a `[UI:]` moment, 0 s for cues. Teleprompter takes are stored per beat in `episode_performance_clips` and `episode_raw_clips`. | The script's estimate and the real take length are never reconciled. |
| **Phone UI** | `components/phone/PhoneDevice`, `PhonePreviewMode` (+ `usePhonePlayback`, `usePhonePlaythrough`), `ScreenContentRenderer`: React and HTML, with tap zones (`screen_links`) and content zones per screen (`phoneOverlays.overlayStatusForShow`). | It runs on real time with real timers, so it can't be stepped frame by frame. |
| **My Little List** | `GET /episodes/:id/my-little-list?beat=&line=` (PR #3599) gives exactly what Lala sees at a line. | No tick animation yet (that's Phase 2). |
| **Cursor** | `cursorPathGeneratorService` writes `cursor_actions` rows (hover, then press at cue + 0.5 s) from `icon_cues`. | **Both tables are created only by `migrations/20260209060127-icon-cue-timeline-system.js`, a dead migration tree**, so they very probably don't exist in production. Nothing renders the rows either. |
| **Cursor and hand images** | World → Overlays: `ui_overlay_types` rows (category `production`) plus an `assets` row (`UI_OVERLAY`, `metadata.overlay_type`) whose image is on S3 under `ui-overlays/<showId>/<typeKey>-custom-<ts>.<ext>`, loaded through `GET /api/v1/ui-overlays/:showId`. | No hotspot (the pixel that does the click) is recorded. |
| **Sound** | `AudioClip` has a `track_type` of `sfx` (per scene). The script parser knows `play_sfx`. | **The repo has no sound files and no sound library.** |
| **Stage** | Scene Studio (`SceneStudio/Canvas/StudioCanvas`, react-konva) and the Timeline editor (`pages/TimelineEditor`, `components/Timeline/*`, `PreviewMonitor`, `timeline_data` keyframes and audio_clips). | Separate from the phone. |
| **Placements** | `TimelinePlacement` rows. `episodeBeatPlacement.placeOverlayOnBeat` places nothing while `overlaysOnBeats` is false (Evoni, 2026-10-07). | The export never reads placements. |
| **Export** | `POST /episodes/:id/export` (`routes/export.js`) → Bull `videoQueue` → `workers/videoRenderer`. `renderSceneFrames` draws **one still PNG per scene** (background, characters, `ui_elements`), and `renderVideo` joins them with the FFmpeg concat demuxer at 30 fps. | No audio ("TODO: Add audio mixing"). Keyframes are read only at t=0. No takes, no phone, no cursor. `ffmpegService` does analysis only. |

## 2. Goals and non-goals

**Goals**
1. **One timeline of gameplay per episode,** derived from the script and the episode's data: the phone opens, screens change, the cursor moves and presses, the list ticks, toasts appear, sounds play.
2. **The same timeline drives both places.** The in-app preview, where it stays interactive, and the export are both driven by it, so what Evoni approves is what YouTube gets.
3. **The phone in the video is the real phone UI,** rendered frame by frame, not a picture of it.
4. **The export is composited with FFmpeg:** the recorded takes, the phone, the cursor, the placed overlays, the dialogue audio and the sound effects.
5. **Everything is deterministic:** the same inputs give the same frames.

**Non-goals**
- Changing any business rule.
- Placing overlays on beats while the switch is off.
- Generating new cursor or hand art.
- Any AI call. The Director is rules, not a model, so it has no `aiCostTracker` exposure.

## 3. Architecture

```
script + phone map + episode data ──► Gameplay Director (pure) ──► gameplay track (JSON, versioned, approved)
                                                                     │
                     ┌───────────────────────────────────────────────┴──────────────────┐
                     ▼                                                                  ▼
           In-app preview (Lala's Phone tab)                         Render worker (separate Bull queue)
           PhoneDevice + cursor layer + Web Audio,                   headless Chromium, render mode page,
           real time, still interactive                              virtual clock, frame capture
                                                                                      │
                                                                                      ▼
                                                     FFmpeg compositor: takes + phone + overlays + audio ──► MP4
```

### 3.1 The gameplay track (data)

A versioned JSON document: one track per episode, built for a given script version.

```json
{
  "version": 1,
  "episode_id": "…",
  "source_hash": "sha256 of script + phone map + list inputs + asset keys",
  "fps": 30,
  "beats": [{ "number": 5, "start": 61.2, "duration": 18.4, "clock": "take" }],
  "events": [
    { "t": 63.0, "dur": 1.2, "kind": "phone.open",  "screen": "home" },
    { "t": 64.4, "dur": 0.9, "kind": "cursor.move", "to": { "screen": "home", "zone": "mail" }, "easing": "easeInOutCubic" },
    { "t": 65.3, "dur": 0.4, "kind": "cursor.hover" },
    { "t": 65.7, "dur": 0.2, "kind": "cursor.press", "sfx": "click" },
    { "t": 65.9, "dur": 0.6, "kind": "screen.navigate", "to": "mail" },
    { "t": 72.0, "dur": 0.5, "kind": "list.tick", "item": "mll_…", "sfx": "tick" },
    { "t": 80.0, "dur": 1.0, "kind": "phone.close" }
  ],
  "warnings": [{ "code": "zone_missing", "beat": 6, "line": 3, "text": "…" }]
}
```

- Times are seconds from the start of the episode. Each beat has its own clock: the approved take's length when one exists (`episode_performance_clips`), otherwise the script estimate (`lineSeconds`).
- An event inside a beat is placed by line. Its line's start time comes from the take's line marks when they exist (the teleprompter's `start_line` and marks), otherwise from the cumulative `lineSeconds`.
- List events carry My Little List's opaque item keys and never their text. The text is read at render time from the public API, so spoiler safety carries into the video.

**Storage:** a new table, `episode_gameplay_tracks`, with columns `id`, `episode_id`, `version`, `track` (JSONB), `source_hash`, `status` (`draft` | `approved`), `approved_at`, timestamps and `deleted_at`. It is a new migration under `src/migrations/` and runs only through the Deploy workflow.
- When the script, the phone map or the list inputs change, the track reads as **outdated**, the way an overlay does today.
- **`cursor_actions` and `icon_cues` are neither read nor migrated.** The track replaces them, and their dead-tree migration is left alone.

### 3.2 The Director (pure function)

`services/gameplayDirector.directEpisode(input) → track`. It is pure, and tested without a database or a browser.

Its inputs are:
- the saved script (`scriptBeats`);
- the phone map (`overlayStatusForShow`: screens, `screen_links` tap zones, `content_zones`);
- the timing (takes and marks, else estimates);
- My Little List item keys per position (the service's `buildList`);
- the episode's asset keys.

The rules:

| Script line | Track events |
|---|---|
| `[UI:OPEN <screen>]` / `[UI:SHOW phone]` | `phone.open` (when closed) or `screen.navigate` |
| `[UI:CLICK <target>]` | `cursor.move` to the target's tap zone centre → `cursor.hover` (≥ 0.3 s) → `cursor.press` (+ `click`) → the zone's `navigate`, if it has one |
| `[UI:DISPLAY <x>]` / `[UI:HIDE <x>]` | `screen.navigate` / `phone.close` |
| `[UI:NOTIFY …]`, `[UI:DM …]` | `toast.show` (+ `notify`) |
| A scroll the phone needs to reach a zone | `cursor.grab` (Grabbing Hand) → `scroll` → `cursor.release` |
| `[WEAR]` / `[DELIVER]` / `[LEARNS]` that changes a My Little List item while the list is on screen | `list.tick` / `list.reword` / `list.appear` (+ `tick`) |
| `[SFX: <key>]` | `sfx` |

Cursor motion:
- It moves on an eased curve with a slight arc. Its small human jitter is **seeded from the episode id and the event index**, so the motion is deterministic.
- It never leaves the phone's screen bounds, and never moves faster than a set px/s.
- A click on a target with no zone on its screen gives a **warning, not a guess**. The Script tab's health check lists these, next to `phoneCheck`.

### 3.3 Assets: reused, never regenerated

- **Mouse Cursor and Grabbing Hand** are the existing production overlays. The show records which type keys they are in two show settings, `gameplay.cursor_type_key` and `gameplay.hand_type_key`, picked in World → Overlays.
- **Hotspot:** each image needs its hotspot (the pixel that clicks), added as `metadata.hotspot = { x, y }` on its `assets` row, with a small picker on the overlay card. It defaults to the top-left for the cursor and the centre for the hand.
- **Sounds:** a show-level sound library holding Evoni's licensed files.
  - It uses the same assets table (`asset_type 'UI_SOUND'`, S3 `ui-sounds/<showId>/…`) with an upload card beside Overlays.
  - Slots: `click`, `tick`, `open`, `close`, `notify`, `type`, `whoosh`, plus her own.
  - A slot with no sound is silent, with a warning. It never blocks the export.

### 3.4 In-app preview (built first)

The Lala's Phone tab plays the track inside the real `PhoneDevice`:
- a cursor layer above the screen (the cursor or hand image, at its hotspot);
- press and hover animations;
- My Little List tick animations (Phase 2's component);
- sounds through Web Audio.

The phone stays interactive. Pausing hands control back to Evoni, and Play resumes the track. This is where she approves the track.

### 3.5 Render mode (deterministic frames)

A route that only the render worker loads, `/render/episodes/:id/phone?track=…`, mounts the same components with:
- **a virtual clock:** `window.__renderAt(t)` sets the time, every animation is computed from `t` (no `setTimeout` or CSS transitions in render mode), and it resolves once the frame is painted;
- **data fixed to the track's position:** My Little List from the public endpoint at each event's beat and line, and every other screen read at the same story moment (`?at=` as the DMs already are);
- **auth** through a short-lived, render-only token issued to the worker. No user session.

Frames are captured with Playwright's Chromium at the target size, as PNGs with alpha.
- Only seconds when the phone is on screen are rendered.
- Identical consecutive frames are collapsed into one image with a duration.

### 3.6 Compositor (FFmpeg, export engine v2)

Per beat, bottom to top:
1. **Base:** the approved performance clip for that beat (video and audio), else the scene's background still.
2. **Phone layer:** the PNG sequence, positioned by the platform layout preset (16:9 YouTube by default; the 9:16 preset is a later addition).
3. **Overlays:** only those with a real `TimelinePlacement`. While `overlaysOnBeats` is off, beat overlays don't appear. The export obeys the same switch.
4. **Audio:** take audio + SFX (`adelay` per event) + music bed (`amix`), normalised to −14 LUFS.

The output is H.264 1080p30 with AAC 48 kHz, uploaded to S3 with a progress record.

This becomes a new `workers/videoRendererV2` behind `EXPORT_ENGINE=v2`. The current renderer stays the default until Evoni switches.

### 3.7 Running it

- **A separate Bull queue**, `gameplay-render`, with concurrency 1, a temporary directory cleaned on success and on failure, and progress events.
- **Idempotent:** the same `source_hash` plus asset hashes reuses the last render.
- **Server work is Evoni's.** Chromium's system libraries, the worker process and the environment flag are on the EC2 host. Sessions never touch the server. The worker is added through reviewed PRs, and set up and enabled by Evoni.

## 4. Phases

Each phase is its own PR and needs its own approval.

| Phase | Builds | Shows |
|---|---|---|
| **D1** | `gameplayDirector` (pure) and its tests; the track from Episode 1's script | The track as JSON in the review; Script tab warnings |
| **D2** | Asset wiring: cursor and hand type keys, hotspot picker, sound library, `episode_gameplay_tracks` (migration), Approve | The cursor, hand and sounds chosen; a track approved |
| **D3** | In-app preview playing the track | Episode 1 plays in the Lala's Phone tab: cursor, presses, ticks, sounds |
| **D4** | Render mode and frame capture | Golden frames for Episode 1, identical on every run |
| **D5** | Compositor v2 behind `EXPORT_ENGINE=v2`: takes, phone, overlays, audio | An MP4 of Episode 1 in CI's artifact |
| **D6** | Server enablement (Evoni: Chromium libraries, worker, flag) | The first approved render, uploaded |

## 5. Acceptance criteria

- **Deterministic:** two renders of the same inputs give identical frame hashes.
- **Every `[UI:CLICK]` press** lands inside its target's tap zone, within one frame of its time, with its click sound within one frame.
- **Every list tick** in the video sits at its `[WEAR]`/`[DELIVER]` line's time. No item appears before Lala has learned it. A DOM text scan of every rendered frame finds none of the episode's private strings, using My Little List's leak test applied to render mode.
- **No beat overlay** appears in the export while `overlaysOnBeats` is off.
- **A missing asset or sound** degrades with a warning. It never fails the export silently.
- **Speed:** an Episode 1 render takes at most 3× real time on the production host. **To be measured in D4, not promised.**
- **The YouTube file** passes `ffprobe` checks: H.264 High, 1080p30, AAC 48 kHz, −14 LUFS ±1.

## 6. Risks and open decisions

1. **Where Chromium runs.** It needs memory on EC2 next to the API. Alternatives: a separate worker instance, or a container on demand. Evoni decides before D6.
2. **The dead cursor tables.** `cursor_actions` and `icon_cues` probably don't exist in production. The Icon Cue Timeline page and `cursorPathGeneratorService` may fail there today. That is out of this spec's scope, but worth its own audit finding.
3. **Take timing against script timing.** Line marks exist only for takes recorded with the teleprompter. Older takes fall back to estimates, and the cursor may drift from the voice. A per-beat nudge in the preview fixes that by hand.
4. **Sound licensing.** The library holds only files Evoni has the rights to.
5. **Hotspot data** is new metadata on existing assets. It's additive, and the images are not regenerated.
6. **Render storage:** a lifecycle rule for old renders on S3 is Evoni's infrastructure call.
7. **The 9:16 format** (Shorts) is deferred. The layout presets keep it possible.

## 7. Testing

- **Director:** unit tests on scripts, one per rule above, plus determinism (seeded jitter) and warnings.
- **Render mode:** component tests with the virtual clock (Vitest), plus golden-frame tests in CI (Playwright is already in the CI image) that pass only with exact hashes.
- **Compositor:** a pure argument builder tested without FFmpeg (as `rawClipsService` does), plus one CI integration render of a 10-second fixture checked with `ffprobe`.
- **Spoiler safety:** My Little List's fixtures (`tests/fixtures/myLittleListEpisode1.js`) rendered at A/B/C, with a DOM text scan.
