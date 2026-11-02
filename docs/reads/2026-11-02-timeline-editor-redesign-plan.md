# Timeline Editor redesign: audit, visual plan and implementation plan (read, for Evoni's approval)

**Status:** plan. **Evoni ruled on D1–D7 on 2026-11-02 and authorised P0 only** (§11). Nothing here authorises P1–P6, a migration, a feature flag, a render worker or a deploy; each needs her separate approval.

**Basis:** `origin/main` `d19216db` (2026-11-02). Code is cited by stable name (component, function, route), with a line number only where it helps find the spot at this basis.

**Builds on:** `docs/reads/2026-10-27-voice-studio-timeline-design.md`, Revision 8 (the "design"; R8.x) and Revision 7 (C1 as built). Where this plan departs from a Revision 8 ruling, it says so and asks (§8). It does not replace Revision 8.

**Design reference:** Evoni's "Dark Timeline Editor Dashboard" image (1536 × 1024 px), chosen 2026-11-02. Measurements in §3 are taken from it.

**Labels:** **VERIFIED** (read in code at the basis), **INFERRED** (follows from code, not run), **PROPOSED** (this plan), **DECISION** (needs Evoni, §8).

---

## 0. Summary

1. **What exists.** There are two editor stacks, and neither is the editor in the reference.
   - **The legacy Timeline Editor** (`TimelineEditor` page at `/episodes/:episodeId/timeline`) is live but **broken**: it cannot open a real episode, and it has a latent data-loss path (§1.1). Its preview is a slideshow of stills, and its export is the legacy silent slideshow.
   - **The C1 episode edit** (`episodeEditRoutes`, `episodeEditService`, `editTimeline`) is a working, tested backend for the edit model Revision 8 builds on. It has **no page**, and it sits behind `EPISODE_EDIT=on`.
   - **Revision 8 beyond C1 is not built:** no C1b kinds, no `render_jobs`, no render host, no frontend copy of `editTimeline`, no beat status or reviews, no audio library.
2. **What we reuse rather than rebuild.**
   - The whole C1 backend: concurrency, beat clock, scene clips, Prime segments with linked commentary, PIP, dialogue placement, music/SFX items, versions and findings.
   - Approved takes (Voice Studio `playable`).
   - Raw clips with VP9-alpha cutouts (`episode-clips`).
   - Scene sets and angles.
   - The legacy `Timeline` (lanes, ruler, playhead), `AudioWaveform`, `KeyframeTrack`, the transport and undo shell, and SceneStudio's Konva transform canvas.
3. **What is new.** A new C1-backed page in the reference's layout (§3), with a client-side preview built on a shared copy of `editTimeline` (R8.11.1). It ships in small phases (§6).
4. **What stays honest.** Preview Render and Export Video are visibly disabled ("Pending: render host") until Gates 3–6 are built and Evoni has switched them on. Phone, gameplay, cursor and caption lanes are shown, labelled "Pending: C1b", until their schema exists.
5. **Four decisions block the build** (§8):
   - **D1, the page.** Revision 8 makes the Guided view the default and puts the Advanced Timeline after the PoC; this request makes the multitrack the main page.
   - **D2, the route.** `/episodes/:id/edit` is already "Edit details".
   - **D3, the Lala layer.** Revision 8's layer list has no performer layer for Lala over the background.
   - **D4, captions and titles.** Revision 8 defines no caption or title source.

---

## 1. Audit of what we currently have

### 1.1 The legacy Timeline Editor: why it "isn't working" (VERIFIED)

| # | Defect | Where | Effect |
|---|---|---|---|
| L1 | The episode response is unwrapped wrongly | `TimelineEditor` `loadEpisodeData` reads `res.data.episode \|\| res.data`. `episodeController.getEpisode` answers `{ data: episode, script_revision }` | `ep.id` is undefined. **Every episode shows "not found."** |
| L2 | The scene list is unwrapped wrongly | `loadEpisodeData` treats `scenesRes.data` as an array. `sceneController.getEpisodeScenes` answers `{ success, data: [...] }` | Scenes always load as `[]` |
| L3 | **Latent data loss** | `useSaveManager` is mounted on the error screen and binds Ctrl+S. `getSavePayload` sends `scenes: []` and `timeline: { beats: [], markers: [] … }`. `POST /episodes/:id/save` soft-deletes every live scene not in the payload (except beat scenes, `scene_plan_id`), and `[] ?? old` keeps `[]` | Pressing Ctrl+S on the "not found" screen, or any edit's 3-second autosave once L1 alone is fixed, **removes the episode's non-beat scenes and empties its beats and markers** (INFERRED runtime; code path VERIFIED) |
| L4 | `ScenePicker` has the L2 unwrap bug | `ScenePicker` | "+ Scene" always says "No scenes found" |
| L5 | Keyframes are never saved | `/save`'s `tlUpdate` has no `keyframes` | Keyframe edits are lost on reload |
| L6 | Hook order crash | `KeyframePropertyEditor` returns before its `useCallback`s | Selecting a keyframe can throw "Rendered more hooks" (INFERRED) |
| L7 | In-preview drag is lost | `PreviewMonitor` is never given `onUpdateElement` | Moves vanish on the next render |
| L8 | Resize floods undo | `handleResizeScene` calls `pushHistory` on every mousemove | One drag fills the 50-step stack |
| L9 | Modals hidden behind the page | `.timeline-editor` is `z-index: 9999`; `AssembleTakesSheet` and `ScenePicker` are lower | INFERRED |
| L10 | Tests pass on wrong mocks | `TimelineEditor.test.jsx` mocks `{data:{id}}` and `{data:[…]}` | The suite hides L1 and L2 |

**What it can do at best:**
- Scenes laid end to end with right-edge resize.
- Free-form beat flags.
- Global keyframes.
- Client snapshot undo.
- A preview of each scene's `background_url` still.

**What it cannot do:**
- No tracks and clips model.
- No video in the preview, no alpha footage, no Prime PIP.
- No audio sources: `handleAddAudio` sets `audioUrl: null`.
- No trim, split, copy or paste.
- No mute, lock, or hide track.

**Its export:**
- `POST /api/v1/episodes/:id/export` queues a Bull job for `videoRenderer`.
- That renders one PNG per scene and joins them with ffmpeg concat.
- The code says `// TODO: Add audio mixing`, so the output is silent.
- It reads `scenes` and `timeline_data`, never C1.

**This is the legacy silent slideshow, and it is not used here.** Ruling 14 keeps the legacy editor and export available until the new workflow passes testing.

### 1.2 The C1 episode edit: what the new page builds on (VERIFIED)

**Where it lives:**
- `src/routes/episodeEditRoutes.js`, mounted at `/api/v1/episodes/:episodeId/edit`.
- Every request answers 404 `EPISODE_EDIT_OFF` unless `EPISODE_EDIT=on`.
- Reads need `requireAuth`. Writes need `requireAuth + authorize(['ADMIN'])`.
- Every write sends `edit_revision`, and a stale one gets 409 `EDIT_CHANGED` with `current_revision`.
- Tests: `episodeEdit.integration` (22), `editTimeline` unit (28), `episodeEditGuard` (8).

| Area | Endpoints (all under `/edit`) | Notes |
|---|---|---|
| Load | `GET /`, `GET /layout?t=`, `GET /mix`, `GET /findings` | `layoutAt` returns only `{scene, pip, prime_missing, scene_gap}`: two layers |
| Beats | `POST /beats/:beat/mode` (`prime_mode`), `POST /beats/lock`, `POST /beats/:beat/duration` (with `dry_run`) | The 14-beat clock (R7.1–R7.2) |
| Scene clips | `POST /scene-clips`, `PATCH /scene-clips/:id` (in, out, duration, position) | Sources: `angle_still`, `angle_video`, `raw_clip` (performer `lala` or `guest`). There is no split endpoint |
| Prime segments | `POST /segments`; `POST /segments/:id/{move, trim-video, trim-audio, audio, layout, split, replace}` | `layout` is `{x,y,w,h}` at 1920×1080. Audio has gain −24 to +12 dB, mute and fades. One clock for picture and commentary |
| PIP | `PUT /pip` (`default_layout`, `default_visible`, `use_cutout`), `POST /visibility` | Hiding never mutes (R5.1) |
| Items | `POST /items`, `POST /dialogue`, `POST /dialogue/:id/move` | Item kinds today: `object_keyframe`, `camera_keyframe`, `object_visibility`, `angle_change`, `transition`, `audio_offset`, `caption_override`, `dialogue_placement` |
| Music / SFX | `POST /audio-items` | `track` is `music` or `sfx`; `asset_ref` is unvalidated text |
| Remove | `DELETE /{scene-clips, segments, visibility, items, audio-items, dialogue}/:id` | Soft delete |
| Versions | `POST /versions`, `GET /versions[/:id]`, `POST /versions/:id/restore` | Named checkpoints |

**What C1 does not have:**
- No PATCH or move for `items`, `audio-items` or `visibility`. Changing one means delete then add, which takes two revisions.
- No batch write.
- No server undo.
- No columns for opacity, rotation, z-order or lock.
- No `visual_mode`, no beat status, no render.

**Two guards any new code must respect** (`episodeEditGuard`):
- only the migration and `episodeEditService` may name the edit tables;
- the legacy editor names nothing of C1.

### 1.3 Media the editor can already use (VERIFIED unless marked)

| Lane need | Source today | Browser-playable? |
|---|---|---|
| Scene background | Scene sets and angles (`/api/v1/scene-sets/:id`: `still_image_url`, `video_clip_url`), which must be linked to the episode (`scene_set_episodes`) | Yes: stills, and MP4 (INFERRED) |
| Lala and guest footage, transparent | Raw clips (`GET /api/v1/episode-clips/:ep`: `url_raw`, `url_cutout`, `thumbnail_url`, `performer`, `beat_number`, `key_status`). The cutout is **WebM VP9 `yuva420p` + Opus** | Chrome, Edge, Firefox: yes. **Safari: no alpha** (INFERRED) |
| Prime PIP and commentary | The same raw clips, `performer = 'justawoman'`. `episode_pip_settings.use_cutout` picks the cutout | As above |
| Lala and guest dialogue | Voice Studio approved takes (`GET /api/v1/voice-studio/:ep/playable`, `audio_url`). C1's `GET /edit` carries `s3_key` but **no URL**, so the page joins the two | Yes (FLAC/Opus/MP3/WAV/M4A) |
| Phone and gameplay overlays | `/api/v1/ui-overlays/…` (skins, screen links, content zones, stats PNG) and the React `PhoneHub` / `ScreenContentRenderer` screens | Yes, as live components |
| Music and SFX | `assets` with category `music`/`sfx` exist in the enum. **There is no library endpoint and no licence record** (R8.8 not built) | Not yet available |
| Captions and titles | Nothing defined (`caption_override` is a kind with free values) | — |

### 1.4 Other candidates that are **not** this editor (do not extend)

- `StudioTimelinePage` (`/studio/timeline`): only an episode picker that redirects to `/episodes/:id/timeline`. The Sidebar "Timeline Editor" entry points here.
- `IconCueTimeline` (`/episodes/:id/icon-cues`): a separate cue editor. R8.1.2 excludes it.
- `TimelinePlacementsSection`: orphaned, imported by no page.
- `compositions.js` and `CompositionService`: thumbnail compositions, not video.
- `editMaps.js`, `AIEditPlan`, `EditingDecision`: dead or unused.
- `phoneScreenRenderer.js`: required by nothing.
- SceneStudio (`/studio/scene/:sceneId`): a one-scene Konva canvas. **We reuse its transform canvas pattern, not its data.**

---

## 2. The request against Revision 8

| Request | Revision 8 position | Plan |
|---|---|---|
| One NLE page in the reference's layout | R8.1: the **Guided view** is the default; the **Advanced Timeline** (lanes) comes **after the PoC** (Stage 5) | **D1.** Recommendation: one page in the reference layout, with the beat rail driving a **Beat focus** mode that carries the Guided view's journey (§3.7). It is still one editor on C1, so it amends R8.1's sequencing and does not compete with it |
| Lala over the real background, Prime in the corner | R8.3.1 layers: Scene, Prime PIP, Phone, Overlays, Toasts, Cursor, Stats. **There is no Lala performer layer**; a `lala` raw clip can only be a full-frame scene clip | **D3**: add a performer layer |
| Lanes for scene, Prime, commentary, dialogue, music, SFX | All in C1 | Built on C1 now |
| Phone, gameplay, cursor and UI effects lanes | R8.5 kinds `phone_screen`, `gameplay_action`, `overlay` (C1b, Gate 2) | Lanes shown and labelled "Pending: C1b" until Gate 2 |
| Captions and titles | Not specified (R8.13.4: all text is drawn as PNG by React, never `drawtext`) | **D4** |
| Gameplay / Cinematic modes | R8.2: `episode_beat_production.visual_mode` and the item kind `visual_mode` (C1b) | Shown read-only ("gameplay" by default, R8.2) until C1b |
| Readiness indicators | R8.6 `beatStatus` (Gate 2) | Interim: per-beat findings from `GET /findings` (real data), labelled as such |
| Preview render and export | R8.9 and R8.10 (Gates 3–6) | Disabled with a label until built and switched on |
| Opacity, rotation, lock, hide | Layers carry opacity (R8.3.1); there is no rotation, lock or hide in C1 | **D5** |

---

## 3. Visual implementation plan (pixel-conscious)

### 3.1 Frame and grid

**Reference canvas:** 1536 × 1024. The reference values below scale to the real viewport. Panel widths are proportional and have minimums.

| Region | Reference box (x, y, w, h) | Rule at runtime |
|---|---|---|
| Top bar | 0, 0, 1536, 60 | Fixed 60 px; full width |
| Title row | 0, 60, 1536, 50 | Fixed 50 px |
| Left browser | 12, 115, 400, 513 | 26% of width; min 280, max 440 px; collapsible |
| Centre preview | 424, 115, 764, 513 | Fills the remainder; the video area keeps 16:9 |
| Right inspector | 1200, 115, 324, 513 | 21% of width; min 280, max 380 px; collapsible |
| Edit toolbar | 0, 640, 1536, 54 | Fixed 54 px |
| Ruler | 190, 695, 1346, 26 | 26 px |
| Track header column | 0, 721, 190, — | 190 px fixed |
| Track rows | — | Video lanes 54 px; audio lanes 56 px; collapsed lanes 28 px |

**Spacing:**
- Outer gutter 12 px.
- Panel gap 12 px.
- Panel radius 8 px.
- Panel inner padding 12–16 px.
- Control height 32 px (toolbar buttons 36 px).

**Resizable panels:**
- Three splitters: left|centre, centre|right (vertical), and upper|timeline (horizontal).
- The horizontal splitter reuses the legacy editor's row-resize pattern, with its ratio kept in `localStorage` per user.
- Presets in the "⋮" menu: **Preview focus** (timeline at 30% of height) and **Timeline focus** (timeline at 60%).
- Double-clicking a splitter resets it.

### 3.2 Colour and type tokens (scoped `--tle-*`, dark)

A dark editor is a deliberate exception to the parchment `--lala-*` theme. The tokens are scoped to the page root, and gold is kept as the brand accent for the beat rail and approvals.

| Token | Value (measured from the reference) | Use |
|---|---|---|
| `--tle-bg` | `#0E1116` | Page |
| `--tle-panel` | `#151A21` | Panels |
| `--tle-panel-2` | `#1B212A` | Inputs, toolbar buttons |
| `--tle-line` | `#262D38` | Borders and dividers |
| `--tle-text` | `#E6E9EF` | Primary text |
| `--tle-muted` | `#8A93A3` | Secondary text and labels |
| `--tle-accent` | `#2F6FEB` | Primary buttons (Export, Add Media), active tab underline, sliders |
| `--tle-select` | `#F2C230` | Selected clip outline (2 px) |
| `--tle-playhead` | `#E5484D` | Playhead line and handle |
| `--tle-clip-title` | `#6B4FD1` | Text and title clips |
| `--tle-clip-dialogue` | `#1F7A5C` with waveform `#4FD1A1` | Dialogue lane |
| `--tle-clip-music` | `#1E4F8F` with waveform `#4B8FE0` | Music lane |
| `--tle-clip-sfx` | `#6B5320`, border `#C9A14A` | SFX lane |
| `--tle-clip-prime` | `#8A3D6B` (PROPOSED: magenta, so Prime is distinct from Lala) | Prime PIP and commentary |
| `--tle-gold` | `#B8962E` (the `--lala-gold` value) | Beat rail, approved state |
| `--tle-pending` | `#5A6170` on a hatched background | Pending or disabled lanes and controls |

**Type and icons:**
- UI is DM Mono 12–13 px, with clip labels at 12 px.
- The page title is 20 px, weight 600.
- Inspector labels are 13 px muted; values are 13 px.
- Icons are `lucide-react` at 16 px (18 px in the transport).

### 3.3 Top bar and title row

**Left side:**
- A back arrow, then the breadcrumb "Episodes › Episode N › Timeline Editor", with the last crumb bold.
- The title row: "Episode N: <title>", a pencil that links to Edit details (no inline rename), then a status pill.
  - The pill shows the **C1 state**: "Draft", or "Flag off" when `EPISODE_EDIT` is off.
  - After it: "Saved · rev N · 2 minutes ago", from `edit_revision` and the last write.

**Right side:**

| Button | Action | State |
|---|---|---|
| **Save Draft** | `POST /versions`, a named checkpoint | Works |
| **Preview Render** | — | Disabled: "Pending: render host (Gate 3–6)" |
| **Export Video** | — | Disabled: "Pending: render host (Gate 3–6)" |
| **⋮** | Versions list and restore, layout presets, keyboard shortcuts, "Open legacy editor" | Works |

Edits are already saved as they are made, so Save Draft is a checkpoint, not the only way to save.

### 3.4 Left: asset browser

**Header:**
- Tabs: Assets | Scenes | Audio | Text | Transitions, with a 2 px accent underline.
- Then the Add Media button, the search box, and a filter.

**Assets tab:**
- Chips: All (n), Video, Audio, Images.
- A two-column thumbnail grid: thumbnail 16:9, radius 6, duration badge bottom-right, file name beneath.
- Contents: the episode's raw clips (Lala, guest, Prime), labelled by performer and beat, plus linked angles.
- A cutout still pending shows a "Cutout pending" badge.

| Tab | Contents | State |
|---|---|---|
| **Scenes** | The episode's linked scene sets → angles (still or video) | Works |
| **Audio** | Approved dialogue takes, grouped by beat and line (Voice Studio `playable`); music and SFX | Takes work. Music and SFX show "Library pending (R8.8)" with a link to the asset upload page |
| **Text** | Captions and titles | **D4**; until then, "Pending" |
| **Transitions** | Cut, Crossfade, Dip to black (ruling 12) | Can be placed as a `transition` item (the kind exists). The preview draws them only once the shared core gains transitions (Gate 2); until then they show "Not drawn yet" |

- **Add Media** opens the existing raw-clip upload flow (`episode-clips`, with its beat-coverage question). Its dropdown links to Voice Studio and Scene Sets.
- **Drag and drop:** dragging a tile onto a lane makes the C1 write for that lane (§4.2). A lane that cannot take the tile shows a red no-drop outline and a reason tooltip.

### 3.5 Centre: preview monitor

**The video area** is 16:9 and letterboxed inside the panel, with a radius-6 inner frame. Its layers, bottom to top, follow R8.3.1 plus D3:
1. Scene
2. Lala performer cutout (D3)
3. Prime PIP (cutout or raw)
4. Phone
5. Overlays
6. Toasts
7. Cursor
8. Stats
9. Captions (D4)

**Direct manipulation:**
- Clicking a visual layer in the preview selects its clip; selection is two-way with the timeline.
- A selected layer shows a 1 px accent box, eight handles and a centre move handle (Konva `Transformer`, the SceneStudio pattern).
- Dragging writes `layout {x,y,w,h}` in 1920×1080 pixels on release, as one C1 write. While dragging, the inspector's X, Y, W and H fields update live.
- Shift keeps the aspect ratio. Snapping goes to frame edges, the centre and a 48 px safe margin.
- Rotation handles are hidden (D5).

**Transport row** (60 px, under the video):
- Timecode "00:14.23 / 02:38.12" in mm:ss.ff at 30 fps (R8.4.5).
- Previous edit, Play/Pause, Next edit.
- A volume slider, which is preview monitoring only and not saved.
- Zoom: Fit, 50%, 100%.
- Fullscreen.
- Keys: Space, J/K/L, ←/→ for one frame, Home/End.

**Honest overlays:**
- A beat with `scene_gap` shows a dark frame with "No scene here (scene_gap)".
- `prime_missing` shows a corner badge "Prime footage missing".
- A browser without VP9 alpha (Safari) shows a banner: "This browser can't play transparent video; use Chrome or Edge".

### 3.6 Right: inspector

Tabs: **Clip** | **Audio** | **Effects**. The header shows the selected clip's thumbnail, name and duration.

**Clip tab:**
- Start, End, Duration (read-only).
- Source in and out.
- **Transform:** Zoom (scale % of the default size, mapped to w/h), Position X, Position Y, Width, Height.
  - The reference shows Rotation; it appears **disabled, "Not in the edit model" (D5)**.
- **Appearance:** Opacity (D5, disabled until then).
- **Speed:** 1.0×, disabled with "Not supported: one clock (R8.4)". Retiming would break sync.
- For a Prime segment: Anchor (beat or edit start + offset) and status (draft or approved).

**Audio tab:**
- Gain (dB), Mute, Fade in and Fade out, for Prime commentary and music/SFX items.
- For dialogue: the take, its revision, and a "Trim in Voice Studio" link. Take trims live on the Voice Studio revision, not on the timeline.

**Effects tab:**
- Transition in and out (when the clip is at a cut).
- Duck under dialogue (music; `duck_under_dialogue_db`).

**With nothing selected:** the **beat card** for the beat under the playhead: mode, duration (with lock), findings with links to fix, and (after Gate 2) the review action.

### 3.7 The 14-beat rail (collapsible)

- A 32 px band between the ruler and the first lane.
- Collapsed, it is a 6 px coloured strip.
- Each beat is a segment as wide as its time on the clock, showing its number and name (from the script's beat names), a readiness dot, and a mode glyph (gamepad for Gameplay, film for Cinematic).

**Readiness dot:**
- Before Gate 2: from `GET /findings` grouped by `beat`.
  - Red: a blocking finding.
  - Amber: a warning only.
  - Grey: no rows.
  - Green: no findings.
  - Its tooltip says "From findings; full status after Gate 2".
- After Gate 2: the seven `beatStatus` values (R8.6).

**Clicking a beat** enters **Beat focus**:
- The timeline zooms to the beat.
- The inspector shows the beat card.
- The left panel filters to that beat's takes and clips.
- This is the Guided journey (R8.1.1) in this layout (D1).

**Prime required / gameplay only** (`prime_mode`) is a toggle on the beat card. It is a real C1 write.

### 3.8 Edit toolbar

**Left group:** Undo, Redo | Split, Cut, Copy, Paste, Delete.
- Each button is disabled, with a tooltip, when the selection doesn't support it (§4.1).

**Right group:**
- Snap (to beats, clip edges and playhead).
- Zoom out, a zoom slider, Zoom in.
- **Fit to Timeline.**

### 3.9 Lanes (Styling Adventures with Lala)

**Track header** (190 px):
- Name and sub-label.
- Eye: hide in the preview only.
- Lock: lock against edits, this browser only.
- Speaker: mute in the preview only, on audio lanes.
- The header copy says "View settings, not saved to the episode" (D5).

| # | Lane | Sub-label | C1 data | State at first build |
|---|---|---|---|---|
| 1 | Scene | Background | `episode_scene_clips` (angles; `gameplay_recording` later) | Works. Thumbnail strip |
| 2 | Lala | Performer · cutout | **D3** | Pending D3 |
| 3 | Prime PIP | JustAWoman | `episode_prime_segments` (picture) | Works. Thumbnail strip |
| 4 | Prime VO | Commentary · linked | The same segment's audio range, drawn as a linked sub-lane with a chain icon | Works. Waveform |
| 5 | Dialogue | Lala · guests | `timeline_items` `dialogue_placement` → approved takes | Works. Waveform, speaker colour chip |
| 6 | Phone | Screens | `phone_screen` (C1b) | Pending: C1b |
| 7 | Gameplay | Actions · cursor · UI | `gameplay_action` (C1b) | Pending: C1b |
| 8 | Overlays | Widgets · images | `overlay` (C1b) | Pending: C1b |
| 9 | Music | Bed | `timeline_audio_items` `music` | Placement works; files need the library (R8.8) |
| 10 | SFX | Effects | `timeline_audio_items` `sfx` | As music |
| 11 | Captions & titles | Text | **D4** | Pending D4 |
| — | Mode | Gameplay/Cinematic | `visual_mode` (C1b) | Thin band inside the beat rail; Pending: C1b |

**How lanes and clips are drawn:**
- Pending lanes are 28 px, hatched, with their label and the gate that unlocks them. Nothing on them is fake.
- Clip blocks have radius 4, a 12 px label at the bottom-left, a lock badge when the clip is approved (a segment with `status: approved`), and a 2 px yellow outline when selected.
- Waveforms come from `AudioWaveform` (wavesurfer), rendered once per source and cached.

### 3.10 Responsive

- **Desktop** (≥ 1280 px) is the full layout. From 1024 to 1279 px, the inspector collapses to a drawer.
- **Below 1024 px** (and at 375 px), the page becomes the stacked review layout of R8.0.3 Q6: preview, beat rail (scrollable chips), findings, beat card. **The multitrack is desktop-only**, as R8 rules. It is tested at 375 px.

---

## 4. Every control mapped to backend capability

**Legend:**
- **C1**: works on an existing endpoint.
- **C1+**: a small API addition, with no schema change.
- **C1b**: Gate 2 schema.
- **R**: render (Gates 3–6).
- **UI**: client-only.
- **D**: a decision.

### 4.1 Editing operations

| Control | Scene clip | Prime segment (+VO) | Dialogue | Music/SFX item | Phone/Gameplay/Overlay |
|---|---|---|---|---|---|
| Place from browser | C1 `POST /scene-clips` | C1 `POST /segments` | C1 `POST /dialogue` | C1 `POST /audio-items` (asset pending R8.8) | C1b |
| Select | UI | UI | UI | UI | UI |
| Move | C1 `PATCH` `position` (reorder inside a beat; clips are positional, not free) | C1 `/move` (anchor and offset) | C1 `/dialogue/:id/move` | **C1+** (delete and add today = two revisions) | C1b |
| Trim / resize | C1 `PATCH` in/out/duration | C1 `/trim-video`, `/trim-audio` | Voice Studio revision (link) | **C1+** | C1b (`duration_ms`) |
| Split | **C1+** (no endpoint; two writes today) | C1 `/split` | — (a take is one line) | **C1+** | C1b |
| Copy / paste / cut | UI → place (+ delete) | UI → place (+ delete) | UI → place | UI → place | C1b |
| Delete | C1 `DELETE` | C1 `DELETE` | C1 `DELETE` | C1 `DELETE` | C1b |
| Position / size | — (full frame) | C1 `/layout` | — | — | C1b `overlay.layout` |
| Opacity | **D5** | **D5** | — | — | **D5** |
| Rotation | **D5** (recommend: not offered) | **D5** | — | — | — |
| Volume | — | C1 `/audio` `gain_db` | Voice Studio revision gain | C1 `gain_db` at placement; edit **C1+** | — |
| Mute (clip) | — | C1 `/audio` `audio_muted` | — | **C1+** (audio items have no mute column) | — |
| Mute / hide / lock (track) | UI view setting | UI | UI | UI | UI |
| Fades | — | C1 `/audio` | Voice Studio revision | C1 at placement | — |
| PIP show/hide over a range | — | C1 `POST /visibility` | — | — | — |
| Transition | C1 `POST /items` kind `transition` (stored; drawn after Gate 2) | — | — | — | — |

### 4.2 Page-level controls

| Control | Mapping | State |
|---|---|---|
| Undo / Redo | **UI command stack**. Each command stores its inverse C1 call (place ↔ delete, move ↔ move back, trim ↔ trim back). Undo sends the inverse with the current `edit_revision`. On a 409, both stacks are cleared and the edit reloads, with a toast. Drags push one entry on release. Limit 100 | Works (P3) |
| Autosave | Every C1 operation is an atomic write, so there is nothing to lose. A drag commits on mouse-up. Text fields commit on blur or Enter | Works |
| Save Draft | C1 `POST /versions` (a named checkpoint) | Works |
| Restore | C1 `POST /versions/:id/restore`, behind a confirm dialog | Works |
| Concurrency | `edit_revision` on every write; 409 → reload banner "Changed in another tab" | Works |
| Play / scrub / preview | Client: a shared copy of `editTimeline` gives `layoutAt` and `mixPlan` at t; `<video>` and `<img>` layers; WebAudio for the mix | P2 |
| Beat mode (Prime required / gameplay only) | C1 `POST /beats/:beat/mode` | Works |
| Beat duration and lock | C1 `/beats/:beat/duration` (dry run → confirm → write), `/beats/lock` | Works |
| Gameplay / Cinematic | C1b `visual_mode` | Read-only until C1b |
| Readiness | C1 `GET /findings` (interim); `beatStatus` (Gate 2) | Interim works |
| Approve beat / request changes | `episode_beat_reviews` (Gate 2) | Pending |
| Preview Render | R `render_jobs` `kind: beat/range/working` | Disabled, labelled |
| Export Video | R `render_jobs` `kind: review` (`final` after A10) | Disabled, labelled |
| Fit / zoom / snap | UI | Works |

### 4.3 Small backend additions needed (C1+, PROPOSED; one PR, no migration)

All of these go in `episodeEditService` and its routes, keeping the guard's file boundary:
1. `PATCH /items/:id`: move (anchor, offset) and `values`.
2. `PATCH /audio-items/:id`: move, trim, gain, fades, duck.
3. `PATCH /visibility/:id`.
4. `POST /scene-clips/:id/split { at_ms }`: one transaction.
5. **`POST /ops`**: an ordered batch of the existing operations in one transaction and one revision, for paste, cut and multi-select delete, so one user action is one undo step.
6. `GET /edit` adds `audio_url` for each placed take (join with Voice Studio's `sourceUrl`), so the page doesn't need two lists.

Each item gets integration tests in `episodeEdit.integration`.

---

## 5. Reusable components (adapt, do not import their data model; R8.1.2)

| Reuse | From | For |
|---|---|---|
| Ruler with adaptive ticks, playhead with scrub, edge-resize and drag patterns, auto-scroll, label column | `components/Timeline/Timeline.jsx` | The lane area (rewritten around C1 rows; fix the zoomed-out seek bug and the stale-closure listener as we go) |
| Waveform | `components/Timeline/AudioWaveform.jsx` (wavesurfer 7) | Dialogue, VO, music, SFX |
| Keyframe drag and select | `components/Timeline/KeyframeTrack.jsx` | Later, if keyframes are ruled in |
| Transport keys (J/K/L, frame step), rAF clock, splitter | `pages/TimelineEditor.jsx` | Transport and splitters |
| Debounce, Ctrl+S, beforeunload | `hooks/useSaveManager.js` | Generalised into a `useEditOps` hook with `edit_revision`, the 409 path and the command stack |
| Konva canvas and `Transformer` | `components/SceneStudio` (`StudioCanvas`) | Preview handles for Lala and Prime |
| Raw-clip API and upload | `rawClipsApi`, the beat-coverage upload | Add Media |
| Takes | `lib/voiceStudioApi.js` | Audio tab |
| Phone screens | `PhoneHub` / `ScreenContentRenderer` | Phone lane layers (after C1b) |
| Clock, layout, mix, findings | `src/utils/editTimeline.js` | **Byte-identical frontend copy** plus a CI equality test (R8.11.1) |

**Not reused:**
- `PreviewMonitor`
- `timeline_data`
- `IconCueTimeline`
- the cue services
- `ExportPage`
- `videoRenderer`

---

## 6. Implementation phases (smallest first; each its own PR and its own yes)

| Phase | Scope | Backend? | Prod impact |
|---|---|---|---|
| **P0: Legacy safety fix** | L1, L2, L4 unwraps; disable `useSaveManager` (and Ctrl+S) unless the episode loaded; L5 keyframes in `/save`; L6 hook order; L8 one history entry per drag; tests with the real envelopes. **No redesign.** It keeps the legacy editor usable (ruling 14) and closes the data-loss path | `/save` only | None until deploy |
| **P1: Page shell, read-only** | New page (route per D2), Sidebar "Editor" entry and an episode-page link. The §3 layout, tokens, resizable panels, top bar, browser (read), lanes drawn from `GET /edit`, beat rail with findings, ruler, playhead, zoom, selection, inspector (read). Flag off → a full-page notice "The episode edit is switched off (EPISODE_EDIT)". Pending lanes and buttons labelled | None | None (works only where the flag is on) |
| **P2: Shared core and live preview** | Frontend copy of `editTimeline` + CI equality test. Preview player: scene still or video, Prime PIP (cutout), dialogue and VO via WebAudio from `mixPlan`, frame-snapped clock (30 fps), scrub, play, J/K/L, `scene_gap`/`prime_missing` overlays, the Safari notice | None | None |
| **P3: Editing on existing C1** | Drag-to-place, select, trim and resize, reorder, Prime move/trim/split/layout/audio/mute/fades, PIP visibility, dialogue place and move, music/SFX place (asset ref), delete, copy/paste/cut, beat mode and duration (dry run), lock timing, **preview handles for Prime** with live inspector sync, undo and redo, versions, 409 handling | None | None |
| **P4: C1+ API additions** | §4.3 items 1–6 | Yes, no migration | Deploy only |
| **P5: Gate 2 (R8.14)** | C1b migration (written, **not deployed**), plus D3 (performer layer) and D5 (opacity) if ruled in: `visual_mode`, `phone_screen`, `gameplay_action`, `overlay`, `duration_ms`, per-kind validation, the 7-layer `layoutAt`, `modeAt`, `gameStateAt`, transitions, `beatStatus`, content hash, `episode_beat_reviews`, licence validation. Then the Lala preview handles, mode band, Phone/Gameplay/Overlay lanes, review actions | Yes | Migration written only |
| **P6: Gate 3 render as code** | `render_jobs`, manifest, worker routes, worker, `/render/stage`, graph builder, output gate; a local proof on fixture media with parity results. Preview Render and Export stay disabled in production | Yes | None |
| **Gates 4–6** | Evoni: Deploy run for migrations, `EPISODE_EDIT` on, render host provisioned, worker started, idle stop verified | — | Evoni only |

Captions (D4) and music library (R8.8) slot into P5 or later as Evoni rules.

---

## 7. How existing episodes and edits are preserved

1. **Legacy data is never touched by the new page.** It reads and writes only `/api/v1/episodes/:id/edit/*`. `episodeEditGuard` already fails CI if C1 code writes `timeline_data`, `scenes`, the episode or the takes, and if the legacy editor names C1. The new page adds a matching guard: it calls no legacy save, timeline-data or export route.
2. **The legacy editor and export stay** at `/episodes/:id/timeline` and `/episodes/:id/export` (ruling 14), reachable from the "⋮" menu. P0 makes them safe.
3. **C1 rows are soft-deleted only**, and every change bumps `edit_revision`. Versions are never updated or deleted (guard). Save Draft and Restore use them.
4. **No automatic import.** Today's episodes keep their legacy `scenes` and `timeline_data`. Their C1 edit starts empty (INFERRED: the flag is off and no page writes C1). The C1 edit is filled by C2's first assembly (R7.7) from scene plans, approved takes and raw clips, with a dry run first. An optional per-episode "start from the legacy timeline" importer (legacy scene → `angle_still` scene clip by `scene_angle_id`) is **D6**; it would be dry-run first and never delete legacy rows.
5. **Production is unchanged** until Evoni approves a Deploy run and switches `EPISODE_EDIT` on (Gate 4). Whether C1's migration has run in production is unconfirmed; P1 does not depend on it.

---

## 8. Decisions for Evoni

| # | Decision | Recommendation |
|---|---|---|
| **D1** | **The page.** R8.1 rules the Guided view as the default and the Advanced Timeline after the PoC. Approve this NLE layout as the one editor now, with **Beat focus** carrying the Guided journey and the 375 px stacked review view? | Yes. It is one editor on C1, so it amends R8.1's sequencing, not ruling B's "one editor". Recorded as a Revision 9 note in the design doc |
| **D2** | **The route.** `/episodes/:id/edit` is `QuickEpisodeCreator` ("Edit details"), linked from `ShowEpisodesBoard`, `EpisodeDetail` and `workflowRouter` | Put the editor at **`/episodes/:id/editor`** and leave "Edit details" where it is (fewer broken links). Or move Edit details to `/episodes/:id/details` with a redirect |
| **D3** | **Lala over the background.** R8.3.1 has no performer layer | Add a `performer` layer: a `timeline_items` kind `performer_clip` `{ raw_clip_id, source_in_ms, source_out_ms, layout, layer }` with `duration_ms`, drawing the cutout between Scene and Prime PIP, on the one clock. It goes in the C1b migration. Guests use the same kind |
| **D4** | **Captions and titles.** No source is defined | A `caption` item kind with `{ text, style_key, layout }` and `duration_ms`, drawn as PNG by a React component (R8.13.4: never `drawtext`). Captions can be prefilled from approved dialogue lines; titles come from a small style set. It goes in C1b or after the PoC |
| **D5** | **Opacity, rotation, lock, hide.** | Opacity: yes, as `layout.opacity` (0–1) for performer, PIP and overlay. Rotation: **not offered** (shown disabled), since it adds render complexity for little use. Track lock, hide and mute: client view settings, not saved to the episode, so they cannot change a render |
| **D6** | **Legacy import.** | Not by default. Build it only if you want older episodes' scene choices carried into C1 |
| **D7** | **Order.** | P0 first (a data-loss fix), then P1–P3 (frontend only on existing C1), P4, then Gate 2 as P5 |

---

## 9. Acceptance tests

Run on a dev or test database with `EPISODE_EDIT=on`, never against production. Frontend tests use Vitest and Testing Library, with **the real response envelopes** (lesson L10). Browser checks use Playwright at 1440×900 and 375×812.

### 9.1 Saving and reopening
1. Place a scene clip, a Prime segment, a dialogue placement and a music item; reload the page. All four come back at the same times and with the same layout. `edit_revision` has risen by exactly 4.
2. Drag the Prime PIP in the preview to (100, 80, 480, 270) and release. The inspector shows those values during the drag. Exactly one `/layout` write is sent. After reload, `GET /edit` has that `layout`.
3. Edit in two tabs. The second tab's next write gets 409, shows "Changed in another tab", reloads, and loses no data.
4. Save Draft creates a version. Change something, Restore it: the live rows match the version snapshot (`snapshot_sha256`).
5. With `EPISODE_EDIT` off, the page shows the off notice and sends **no** write.
6. **P0:** opening the legacy editor on a real episode shows its scenes. On a failed load, Ctrl+S sends no `/save`. A `/save` with keyframes stores them.

### 9.2 Editing
7. Trim a scene clip's out point: `source_out_ms` changes, a locked beat's length does not change, and nothing after the beat moves (`timingChanges` is empty beyond the beat).
8. Split a Prime segment at the playhead: two segments, the original superseded; picture and commentary stay on one clock.
9. Undo after each of place, move, trim, split, layout and delete restores the prior `GET /edit` rows (ignoring ids and revision). Redo reapplies them. A 409 during undo clears both stacks.
10. Copy and paste a music item: one new row, at the playhead, as one undo step (after P4: one revision).
11. Mute Prime commentary: `audio_muted` is true and `mixPlan` excludes it. Hiding the PIP leaves it audible (R5.1).
12. Lock or hide a track: no request is sent, and the render input (`GET /mix`, `/layout`) is unchanged.
13. Pending lanes and the Preview Render/Export buttons are disabled and have a visible reason (accessibility check: `aria-disabled` with a description).

### 9.3 Playback
14. At fixed times the preview's layers equal the frontend `layoutAt` and the server's `GET /layout?t=` (the same scene id, source time and PIP layout).
15. The frontend `editTimeline` copy is byte-identical to `src/utils/editTimeline.js` (a CI test).
16. Playing from 0 to 10 s keeps the clock within ±1 frame of wall time. A dialogue take starts within ±1 frame of its `mixPlan` start (measured with an audio onset on fixture media).
17. In a `scene_gap` the preview shows the gap frame and a warning. On Safari, the alpha notice shows.
18. After D3: Lala's cutout is drawn above the scene and below Prime. Dragging Lala writes her layout and updates the inspector.

### 9.4 Rendering (P6 local proof; production only after Gates 4–6)
19. A beat render of the golden fixture passes the R8.9.2 output gate (H.264, yuv420p, 1920×1080, 30 fps CFR, AAC 48 kHz, duration ±1 frame, faststart, −14 LUFS ±1, true peak ≤ −1 dBTP).
20. Parity (R8.11): scene and video layers at SSIM ≥ 0.97; state layers pixel-identical; audio onsets within ±1 frame.
21. Cancel leaves no files. A killed worker gives `heartbeat_lost`. A late complete is refused. A second claim cannot win.
22. Until the render host is switched on, Preview Render and Export Video send no request, and say why.

---

## 10. What this plan does not do

- No deploy, merge, migration, feature-flag change, render worker or host.
- No change to the legacy editor beyond P0, and P0 only with Evoni's yes.
- No placeholder scenes, sample media or simulated renders. Anything not backed by data is labelled pending.

---

## 11. Evoni's rulings (2026-11-02, RULING)

The Dark Timeline Editor Dashboard reference is the final visual direction.

| # | Ruling |
|---|---|
| D1 | **Approved.** The professional multitrack timeline is the primary editing page. Clicking one of the 14 beats enters Beat Focus, the Guided editing. A usable responsive review experience is kept |
| D2 | **Approved.** The editor is at `/episodes/:id/editor`. The existing Edit Details route (`/episodes/:id/edit`) and its navigation are kept |
| D3 | **Approved for design.** A performer layer for Lala and guests, above the scene background and below Prime's PIP. It is built through the Revision 8 Gate 2 schema work, never as an unauthorised migration |
| D4 | **Approved with conditions.** Captions and titles use a structured, render-compatible item model. React may draw them in the preview, but the final render must reproduce the same text, placement and styling |
| D5 | **Modified.** Opacity is supported. Rotation is deferred. Track locking persists for the project or user, as appropriate. Preview-only hide and mute are kept distinct from saved, output-affecting visibility and mute, and the page never implies that a preview-only setting changes the exported episode |
| D6 | **Approved.** No automatic import or overwrite of legacy episode timelines |
| D7 | **Approved.** P0 comes first |

**Authorisation: P0 only.**
- **Scope.** Fix the legacy Timeline Editor's episode loading, scene loading and destructive empty-save path.
- **The requirement.** No missing, failed or incomplete episode or scene load can trigger an autosave, a Ctrl+S save, or a destructive replacement of existing scenes, beats or markers.
- **Server-side protection.** The safeguard must not depend solely on the frontend.
- **Tests.** Regression tests on the actual API response shapes, plus tests proving that failed and partial loads cannot submit destructive saves.
- **Production data.** No episode, scene, beat or marker is modified or deleted by hand.
- **Not authorised.** No merge or deploy without Evoni's separate approval. P1–P6, migrations, feature-flag changes, worker setup and production edits are not authorised. The session stops for review after P0.

**P0 as built** (the P0 PR):
- `timelineSaveGuard` (`src/utils/timelineSaveGuard.js`) and the `/save` route:
  - scenes are removed only when the save names them in `removed_scene_ids`;
  - a save that sends no scenes and would remove all of them needs `confirm_remove_all`;
  - the timeline row is written only with the `timeline_basis` from the row the editor loaded, and a stale or missing basis is a 409 with nothing written.
- `GET /timeline-data` returns `basis`.
- `TimelineEditor` reads the real response envelopes (`unwrapEpisode`, `unwrapScenes`, `unwrapTimeline` in `frontend/src/utils/timelineLoad.js`). It treats an unrecognised shape as a failed load, and enables saving only after every load succeeded.
- `useSaveManager`'s `enabled` now blocks `save()`, Ctrl+S and a pending auto-save, and saves run one at a time.
- `ScenePicker` reads the real scenes envelope.
- L5 (keyframes), L6 (hook order), L7, L8 and L9 are **not** in P0.


---

## 12. P1 as built (2026-11-02)

Evoni said "let's continue" after P0 merged (#3678). This session read that as the go-ahead for P1 only, the read-only page shell. Nothing in P1 deploys, migrates, switches a flag, starts a worker or writes to the edit.

**What P1 is:**
- **The page.** `EpisodeEditor` (`frontend/src/pages/EpisodeEditor.jsx`, `EpisodeEditor.css`) at `/episodes/:episodeId/editor` (D2), full screen like the legacy editor.
- **The entry points.**
  - The Sidebar has an **Editor** entry (`/studio/editor`, `StudioTimelinePage` with `target="editor"`).
  - The episode header has a **New editor** link beside Open Editor, which is kept (ruling 14).
- **The layout** follows §3:
  - the top bar and title row;
  - media | preview | inspector, with three splitters, sizes kept in this browser, and the preview-focus and timeline-focus presets;
  - the edit toolbar;
  - the collapsible 14-beat rail;
  - the 11-lane multitrack.

  Below 1024 px it is the stacked review layout: preview, beats, beat card, media.
- **The reads, and only these:**
  - `GET /episodes/:id`, `/edit` and `/edit/findings`;
  - `/episode-clips/:id`, `/episodes/:id/scene-sets` and `/voice-studio/:id/playable` (`frontend/src/lib/episodeEditApi.js`).

  `EPISODE_EDIT` off is a full-page notice with a link to the legacy editor.
- **Lanes, blocks, readiness and the still frame** come from `frontend/src/lib/editorModel.js`, through the edit clock.

**One departure from §6:**
- The frontend copy of `editTimeline` (`frontend/src/lib/editTimeline.js`) moved from P2 into P1, because the timeline cannot place blocks without the clock. `GET /edit` returns rows, not times.
- It is the server module byte for byte, apart from its two module lines. Two things keep it that way:
  - `frontend/src/lib/editTimeline.test.js` fails if the two differ;
  - `node scripts/sync-edit-timeline.js` rewrites the copy.

**What is live in P1:**
- Selection, from the timeline or the PIP in the preview, with its stored values in the inspector.
- The playhead: ruler or lane click, previous and next edit point, ←/→ for a frame, Shift for a second, Home and End.
- Zoom, Fit to Timeline, and Beat Focus.
- The still frame: the scene image and Prime's PIP where the edit places it.
- Track view toggles.

**Disabled, each saying why:**

| Control | Why |
|---|---|
| Play, volume | P2 |
| Save Draft, Undo/Redo, Split, Cut, Copy, Paste, Delete, Snap, transitions | P3 |
| Preview Render, Export Video | The render host, Gates 3–6 |
| Rotation | Deferred (D5) |
| Opacity, the performer lane, phone, gameplay, overlays, captions | Gate 2 |

**D5 note: track lock.**
- In P1 the lock, eye and speaker are kept in this browser (`localStorage`, per episode).
- Each is labelled as a view setting that is not saved and never changes the export.
- Persisting the lock "for the project/user" across devices needs a small server store. That is proposed for P3 with editing, when the lock first has an effect.

**Visual check.**
- The production build was served with `vite preview`. A scratch harness answered every `/api` call with generated fixtures inside the browser. Widths: 1536×1024, 1440×900, 1024×768 and 375×812.
- Result: no page errors, no write requests, no horizontal scroll.

---

## 13. P2 as built (2026-11-02)

Evoni confirmed P1 was what she meant, and approved P2: the working preview in the browser. It is frontend only. There is no backend change, migration, flag or deploy, and still no write.

**What P2 adds:**
- **One clock.**
  - While playing, the playhead is the wall clock since Play, times the rate, snapped to whole frames at 30 fps (`snapToFrame`, R8.4.5).
  - Every picture and sound follows it. Each frame, it is told where it should be in its source and is moved back when it drifts: sounds past 0.12 s, videos past 0.25 s (`usePreviewPlayback`).
  - The playhead stops at the end of the edit.
- **What plays comes from the edit**, through `previewPlan` (`framePlan` from `layoutAt`, `mixAt` from `mixPlan`):
  - **The scene:** an angle still, an angle video from its in point (holding its last frame past its out point), or a clip's original file.
  - **Prime's PIP** at her stored layout, from her VP9-alpha cutout when the edit asks for it (`use_cutout`). Her picture and her commentary are read on her take's one clock.
  - **Her commentary** from her original file, at its gain and fades. A segment muted in the edit is silent.
  - **Approved dialogue** from the take's file at its approved trim.
  - **Music and SFX** have no files until the library exists (R8.8). They are listed as "unavailable" on the monitor, and nothing plays in their place.
- **Controls:**
  - Play/Pause and Space; K pauses; L plays, then 2×; J goes back 5 s.
  - A seek while playing carries on from the new time, and the timeline follows the playhead.
  - Preview volume and mute are kept in this browser and are not saved.
  - A lane's speaker mutes that lane in preview playback only.

**What the working preview does not do, and says so:**

| Limitation | What happens instead |
|---|---|
| Gain above 0 dB | Plays at 0 dB: a browser element cannot boost without reading the file's samples across origins. The render applies it |
| A take's "normalise" | Not applied; the render applies it |
| Safari (no VP9 transparency) | Prime is shown from her original video, with a notice to use Chrome or Edge |
| A cutout that isn't ready | Prime is shown from her original video, with a notice |

R8.11's preview/render parity thresholds belong to the render pipeline (Gate 3), and are not claimed here.

**Measured in a real browser.**
- Setup:
  - the production build in Playwright's Chromium;
  - every `/api` call answered with fixtures in the browser;
  - media generated with ffmpeg as WebM: a moving scene, a VP9-alpha Prime cutout, her original with a tone, and a dialogue tone.
- At 4.06 s on the clock:

| Element | Expected | Measured |
|---|---|---|
| Prime cutout video | 6.06 s | 6.23 s |
| Her commentary | 6.06 s | 6.17 s, volume 0.401 (−6 dB × 0.8 preview volume) |
| Scene video | 2.06 s | 2.16 s |
| Dialogue | 0.56 s | 0.66 s, volume 0.8 |

- Each element started at its exact source point: 2.00, 2.00, 1.00 and 0.00 s.
- The media read about 0.1 s ahead of the displayed timecode, which is within the drift limits.
- The music with no file showed as unavailable. Space paused everything.
- There were no page errors and no write requests.
- The cutout drew with its transparency over the scene video.

---

## 14. P3 as built (2026-11-02)

Evoni approved P3: editing on the existing C1 routes. P3 is frontend only. There is no backend change, migration, flag, worker or deploy. Its writes reach a server only where `EPISODE_EDIT` is on, and an admin makes them.

**How a change is saved:**
- Every change is a command (`frontend/src/lib/editOps.js`), run by `useEditOps`.
- Its requests go one by one through the C1 routes. Each carries the `edit_revision` the page holds, or the one the request before it returned. The edit is then read again, so the page shows what the server stored.
- There is no separate autosave: each change is saved when it is made. A drag saves on release, and an inspector field saves on Enter or when the field is left, once.

**Undo and redo:**
- One change is one undo step.
- Undo runs the command's exact inverse, built from the stored row values, never from what is on screen. Some examples:
  - trimming Prime's video is undone by restoring the video range, then the commentary range and fades the server clamped;
  - deleting a segment is undone by placing the same take, range, place, commentary and level.
- Three changes are barriers that Undo explains it can't take back:
  - **a split:** the API supersedes the original segment;
  - **locking timing for all 14 beats:** clear a beat's length on its card instead;
  - **restoring a draft.**
- A change made elsewhere (409 `EDIT_CHANGED`) reloads the edit, says so, and clears both stacks.
- A refused change shows the server's reason and saves nothing.

**What can be edited:**

| What | How | Route |
|---|---|---|
| Place a scene (angle still or video, or a Lala or guest clip) | Drag from the media panel onto the Scene lane, or its + places it at the playhead, in the beat there (Beat Focus: that beat) | `POST /scene-clips` |
| Place Prime's take | Onto the Prime PIP lane, at the drop time | `POST /segments` |
| Place an approved take | Onto the Dialogue lane, in its own line's beat, with its line association | `POST /dialogue` |
| Move Prime or a line | Drag the block; a beat-relative anchor stays relative | `/segments/:id/move`, `/dialogue/:id/move` |
| Trim | Edge handles: both ends of a segment, the end of a scene clip; or the inspector's in, out and length | `/segments/:id/trim-video`, `PATCH /scene-clips/:id` |
| Split Prime | At the playhead | `/segments/:id/split` |
| Delete, cut, copy, paste | Toolbar and Del, Ctrl+X/C/V. Paste puts a copy at the playhead. A line is placed once, so dialogue is moved, not copied | `DELETE /…/:id`, then the place routes |
| Prime's place and size | Drag her in the preview, or her eight handles. Corners keep her proportions and Shift frees them. She snaps to the frame's edges, centre and the 48 px safe margin. The inspector follows the drag; one save on release | `/segments/:id/layout` |
| Prime's commentary | The inspector: gain (−24 to +12 dB), muted in the episode, fades | `/segments/:id/audio` |
| A beat | The beat card: Prime required or not needed; its length with a dry run first ("Preview the change", then Apply with the revision the preview was worked out for); back to draft timing; hide or show Prime in this beat (her commentary still plays); lock timing for all 14 beats | `/beats/:beat/mode`, `/beats/:beat/duration`, `/visibility`, `/beats/lock` |
| Save Draft | A named version; the edit is unchanged. The ⋮ menu lists saved drafts, and Restore asks first | `POST /versions`, `/versions/:id/restore` |

**Locked lanes.** A lane locked in its track header refuses every change in this browser and says so. The lock is still a per-browser setting. Keeping it for the project across devices needs a server store, which is proposed with the P4 API additions.

**Not in P3:**

| Not built | Why |
|---|---|
| Moving, trimming or changing a music or SFX item; splitting a scene clip or a sound; reordering scene clips inside a beat | These need the P4 API additions (§4.3). Deleting and copying sounds works |
| Placing music and SFX | No files until the library exists (R8.8) |
| Transitions | Wait for Gate 2, when the preview and the render can draw them |
| Snapping to other clips | Times snap to whole frames only |

**Measured end to end.**
- Setup:
  - the production frontend build in Chromium;
  - the real backend, with `EPISODE_EDIT=on` and a local admin token;
  - a throwaway local Postgres with every migration applied, and a seeded episode, a linked scene set with a still, and Prime's take with a cutout.
- The run:
  1. placed the still and Prime's take;
  2. dragged Prime 120 px left and 60 px up, and resized her from a corner;
  3. set her gain to −6 dB, then Undo (0) and Redo (−6);
  4. split her at the playhead;
  5. saved a draft;
  6. reloaded the page.
- Every write returned 200, and the revision went 0 → 8. Save Draft left it at 8.
- The database held:
  - one still in beat 1;
  - the original segment superseded, plus two halves at 0–4033 and 4033–14000 ms;
  - the dragged and resized layout (1010, 571, 649×365) and −6 dB on both halves;
  - the draft at revision 8.
- **One bug found and fixed:** the timecode rounded frames down while the clock rounds to the nearest frame, so 4033 ms showed as 04.00 instead of 04.01.

---

## 15. P4 as built (2026-11-02)

Evoni approved P4: the C1 API additions of §4.3. This is the first backend change in the redesign. It has **no migration**: no new table, column or constraint, and every addition reads and writes the existing C1 tables through `episodeEditService`. Nothing is deployed and no flag is changed. On a server the routes stay behind `EPISODE_EDIT` and ADMIN, like the rest of C1.

**New routes**, all ADMIN, and all sending `edit_revision`:

| Route | What it does |
|---|---|
| `POST /scene-clips/:clipId/split { at_ms }` | Splits a scene clip into two whose lengths add up to the old one, so the clock moves nothing. A video splits at its own source time; a split in a held last frame is refused (`SPLIT_IN_HOLD`) |
| `POST /scene-clips/:clipId/reorder { index }` | Moves a clip to another place among its beat's clips; the others keep their order. Positions are rewritten in two steps past the unique place index, in one transaction |
| `PATCH /audio-items/:audioItemId` | Moves, trims and re-levels a music or SFX item: anchor, source in and out, gain, fades, ducking. It is checked as `addAudioItem` is, and fades may not be longer than the sound |
| `PATCH /items/:itemId` | Changes a timeline item's anchor or values. Not for dialogue (`USE_DIALOGUE_MOVE`), and never anchored to itself |
| `PATCH /visibility/:ruleId` | Shows or hides Prime under a rule in place, and moves a range rule's start and end. Only a range rule has those (`NOT_A_RANGE`) |
| `POST /ops { steps: [{ op, id?, body? }] }` | Several steps as one change: one transaction, one revision check, one new revision, at most 50 steps. A refused step rolls back every step, and the answer names it ("Step 2 (segment.place): …", `extra.step`). A batch holds the same writes as their routes, by name (`BATCH_STEPS`); versions, restores, the timing lock and beat lengths are their own acts and cannot be in one |

**What else changed in the backend:**
- `GET /edit` now gives each voice take its `audio_url`, so the editor needs no second list.
- **How a batch works:** `withEdit` takes an optional `batch` (the batch's transaction). A step run in a batch skips its own revision check and bump; `batchOps` does both once. Outside a batch, every write behaves exactly as before. The 22 C1 integration tests, the Voice Studio tests and the C1 guards still pass.

**The editor uses them:**
- Sounds can be dragged to move them, trimmed at either end, and changed in the inspector: start, in and out, gain, fades, ducking. Trimming a sound's head keeps the rest where it plays, as Prime's trims do.
- A scene clip can be dragged to another place in its beat, or moved with Earlier/Later in the inspector, and split at the playhead.
- Two undos that need several steps are now one `/ops` request, applied entirely or not at all:
  - undoing a Prime trim restores the video range, then the commentary range and fades;
  - undoing a scene-clip split removes the new part and gives the first part back its length and trim.

**Still not built:**

| Not built | Why |
|---|---|
| Splitting a sound | Not in §4.3 |
| A cross-device track-lock store | It needs a new table, so a migration. Locks stay per browser |
| Snapping to other clips' edges | Not built yet |
| Placing music and SFX | Waits for the library (R8.8) |

**Measured:**
- **Integration tests on Postgres** (`tests/integration/episodeEditP4.integration.test.js`), 10 tests: split (still and video, hold and edge refusals), reorder, sound and item and rule updates (with refusals that change nothing), batch success as one revision, batch rollback naming the step, batch refusals (stale, empty, too long, unknown step), and the routes (admin only; split then `/ops` in one revision).
- **End to end** in Chromium against the real backend (`EPISODE_EDIT=on`, a throwaway local Postgres with every migration). The run:
  1. placed two stills, and moved Mirror earlier;
  2. split Mirror at 00:02, then undid it in one batch;
  3. set the music gain to −9 dB, then undid it (−6);
  4. dragged the music 1 s later;
  5. trimmed its head by 0.5 s;
  6. reloaded the page.
- Every write returned 200, and the revision went 0 → 9.
- The database held:
  - Mirror then Wide, Mirror at its full 5000 ms;
  - the split-off part soft-deleted;
  - the music at source 500–4000, offset 1500, −6 dB.
