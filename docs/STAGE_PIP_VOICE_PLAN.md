# Shared Stage, Prime PIP and Voice: audit and plan

**Status:** a planning document. Nothing here is built.

**Rulings it follows** (Evoni, 2026-10-26):
1. **Shared Stage.** Build Scene and the Timeline use one scene and editor foundation; the Timeline adds timing, animation and sequencing.
2. **Prime PIP.** Prime is her own recorded footage, synchronised with the gameplay automatically.
3. **Voice sources.** Prime uses her recorded voice. Lala and the NPCs use their assigned or generated voices.

**Companion to** `docs/GAMEPLAY_DIRECTOR_SPEC.md` (revision 3; where the two differ, revision 3 and Evoni's 2026-10-26 decisions win): this document supplies the Stage, PIP and voice parts that spec assumes.

**Classification** of every finding:
- **VERIFIED:** read in the code on `main` (at `cb02c6a` plus #3598/#3599), with names cited.
- **INFERRED:** follows from verified facts but wasn't directly observed.
- **NEEDS CONFIRMATION:** depends on Evoni's intent or on production data this session can't see.

---

## 1. Current implementation findings

### 1.1 The scene builder and the Timeline

| # | Finding | Class |
|---|---|---|
| S1 | **No feature is called "Build Scene".** The near-matches are "Build Scene Spec" (`SceneSetsTab`, an AI analysis of a set image) and "Build Scene Brief" (`SceneInterview`). The scene *builder* is **Scene Studio**, opened from "Open in Studio" in `EpisodeScenesTab` at the routes `/studio/scene/:sceneId` and `/studio/scene-set/:sceneSetId` (`App.jsx`). Nothing links to the scene-set route. | VERIFIED |
| S2 | That "Build Scene" means Scene Studio. | NEEDS CONFIRMATION |
| S3 | **Scene Studio** (`components/SceneStudio/*`, react-konva `StudioCanvas`) stores **one `scene_assets` row per object**: `object_type` (image, video, text, shape, overlay, decor), `asset_role`, `character_name`, `position_x`/`position_y`/`width`/`height` in **pixels** of the platform canvas (`PLATFORM_PRESETS`: YouTube 1920×1080), `layer_order`, `z_index`, `rotation`, `opacity`, `flip`, `crop_data`, `scene_angle_id`, and `start_timecode`/`end_timecode`. View settings go in `scenes.canvas_settings`. It works on a `scenes` row or a `scene_sets` row (`sceneStudioController` `getCanvas`/`saveCanvas`; `getSceneSetCanvas`/`saveSceneSetCanvas`). | VERIFIED |
| S4 | `scene_assets.start_timecode`/`end_timecode` are saved and loaded, but **nothing plays them back**. | VERIFIED |
| S5 | **"Use in Timeline"** (`SceneStudio.handleUseInTimeline`) only sets `production_status = 'storyboarded'`. It copies nothing to the Timeline. | VERIFIED |
| S6 | **TimelineEditor** (`pages/TimelineEditor`, `components/Timeline/*`) edits **`scenes.characters` and `scenes.ui_elements` (JSONB)** with **percentage positions**. It also edits `scenes.duration_seconds` and the episode's `timeline_data` (keyframes, beats, markers, audio_clips, character_clips), saving through `POST /episodes/:id/save`. **It never reads `scene_assets`.** | VERIFIED |
| S7 | **PreviewMonitor** renders with DOM and CSS (`<img>` elements, `left: x%`). The keyframes (x, y, scale, opacity, rotation) are interpolated **once per scene** and applied to the whole scene as a CSS transform. That is a camera move in practice, not per-object animation. | VERIFIED |
| S8 | **The two describe the same objects twice, with no sync either way.** The only shared field is `scenes.background_url`. `beatScenesService.syncBeatScenes` touches only the background, set and angle. | VERIFIED |
| S9 | **The export reads only the Timeline model.** `routes/export.js` selects `scenes.characters` and `ui_elements` plus `timeline_data`. `workers/videoRenderer` draws them with node-canvas, scaling from a 960-px reference (`STAGE_REFERENCE_WIDTH`). Keyframes are read only at t=0 and per element, which doesn't match the preview's per-scene transform. There is no audio mixing. **`scene_assets` is never exported.** | VERIFIED |
| S10 | So **Scene Studio, the Timeline preview and the export are three renderers** (Konva, DOM/CSS, node-canvas), and they place things differently. | VERIFIED |
| S11 | Other stages: `ThumbnailCanvas` and `TemplateDesigner` (react-konva, for thumbnails and templates; live, out of scope). Legacy or dead: `video_compositions` (no route), `/api/v1/layers` (no caller), `SceneLayerConfiguration` (unused), `SceneComposer` (gone). | VERIFIED |

### 1.2 Performer media (for Prime's PIP)

| # | Finding | Class |
|---|---|---|
| P1 | **`episode_performance_clips`** has one live row per (episode, beat, performer), with performer `justawoman` or `lala`, a pointer (`asset_id`/`video_url`) and a status (draft/approved). **It has no takes, trims, offsets, position, size or audio settings.** It is read by Production Coverage ("host" = a `justawoman` clip). | VERIFIED |
| P2 | **`episode_raw_clips`** holds **many takes per beat**: performer `lala`/`justawoman`/`guest`, `beat_number`, `duration_seconds`, width and height, `is_favorite` (one ★ per beat), `start_line`, `beat_marks` (full takes), and green removal. Green removal (`rawClipsService.chromakeyArgs`) outputs **WebM VP9 with alpha (`yuva420p`) and keeps the audio (Opus)**. | VERIFIED |
| P3 | Teleprompter takes are uploaded as raw clips with `performer = readAs === HER ? 'justawoman' : readAs === 'Lala' ? 'lala' : 'guest'` (`TeleprompterReader`), and are **never keyed** (`green_screen=false`). | VERIFIED |
| P4 | **Prime's identity in the data is `justawoman`.** `scriptSpeaker` treats Me, Prime, JustAWoman and JAWIHP as one speaker, `HER = 'JustAWoman'`. There is no `prime` performer value. | VERIFIED |
| P5 | **Not every clip is Prime:** `lala` and `guest` performers exist in both tables. | VERIFIED |
| P6 | **The take chosen per beat lives only in the browser** (`assembleTakes`, localStorage `assemble.picks.<id>`). `AssembleTakesSheet` lists and copies text; it doesn't place clips. | VERIFIED |
| P7 | **No PIP, facecam or inset feature exists.** The only mention is the legacy `layout_templates.layout_type` "picture_in_picture" (old game-show feature). Scene Studio's `VideoObject` plays a **muted, looping** video with no timing. | VERIFIED |
| P8 | **No audio mixing anywhere.** The take audio is kept in the files but never mixed. | VERIFIED |
| P9 | During a take, the teleprompter **plays other speakers' recorded clips aloud** when `playVoice` is on, which is the default. Lala's clip can bleed into Prime's microphone, and nothing records that it happened. | VERIFIED (code). Whether it bleeds in practice depends on her headphones: NEEDS CONFIRMATION |

### 1.3 Voices

| # | Finding | Class |
|---|---|---|
| V1 | **No character has an assigned speech voice.** Every "voice" field is writing style: `RegistryCharacter.voice_signature`, `WorldCharacter.speech_pattern`, `pulse_voices`, `characterVoice` (learned writing rules). | VERIFIED |
| V2 | **Text-to-speech exists only for Amber**, the app assistant (`routes/amberSessionRoutes.js`: ElevenLabs `eleven_turbo_v2`, `ELEVENLABS_API_KEY`/`ELEVENLABS_VOICE_ID`, `/speak` capped at 20 an hour; `/read-story` takes a `voice_id` and is unused). No other provider is configured. | VERIFIED |
| V3 | **TTS spend is not tracked.** `aiCostTracker` counts LLM tokens only, and Amber's route doesn't call it. That breaks the CLAUDE.md convention "every call is logged and budget-gated" if TTS is reused for dialogue. | VERIFIED |
| V4 | **`script_voice_clips`** holds Evoni's recordings of **other speakers'** lines: one live row per (episode, beat, line_index), with speaker (free text), line_text, S3 key and duration. **No status, source, voice, character id or text hash.** Prime's own lines are deliberately excluded (`voiceFor`: `l.who === HER`). | VERIFIED |
| V5 | **Lines have no stable id.** Clips are named by position, using the teleprompter's own count (`teleprompterIndexMap`). When the script changes, nothing on the server updates them. The client hides a clip whose words changed (`voiceClipsApi.isStale`), and finds a moved line by its words within the beat (`clipForLine`). | VERIFIED |
| V6 | **`AudioClip`/`audio_clips`** (track_type dialogue/sfx…, status `tts`/`temp_recording`/`final`/`needs_replacement`) is tied to the **animatic** `beats` table, and no frontend calls it. | VERIFIED |
| V7 | Dialogue plays **only in the teleprompter** (`useLineVoice`) and in the Script tab's recording panel. The Table read and the phone preview have none. | VERIFIED |
| V8 | `characterVoice.resolveCharacterKey` already maps script speaker labels to character keys. | VERIFIED |
| V9 | That Lala and the recurring NPCs all have `registry_characters` rows that could carry a voice. | NEEDS CONFIRMATION (production data) |

## 2. Authoritative models and their owners

The rule throughout: **one owner per fact**. Everything else is a view, an adapter or a renderer.

### 2.1 Scene composition: `scene_assets` becomes authoritative

| Fact | Owner (after) | Today | Change |
|---|---|---|---|
| What is in a scene and where it sits at rest | **`scene_assets`** (pixels on the scene's platform canvas, 1920×1080 for YouTube) | `scene_assets` *and* `scenes.characters`/`ui_elements` | The JSONB becomes **legacy**, read only by the adapter (§5) |
| Background, set and angle | `scenes.background_url`, `scene_set_id`, `scene_angle_id` (via `syncBeatScenes`) | Same | None |
| Platform size | `scenes.canvas_settings.platform` | Same | None |
| When an object is visible | **`scene_assets.start_timecode`/`end_timecode`** | Stored, unused | Played back |
| How an object moves | **New:** `scene_assets.keyframes` JSONB `[{ t, x, y, scale, opacity, rotation, easing }]` | Doesn't exist (S7) | Additive migration |
| Camera (pan and zoom of the whole scene) | **`timeline_data.keyframes`**, re-read as camera keyframes, which is how the preview already applies them (S7) | Same data | Renamed in the UI; same storage |
| Scene length and order | `scenes.duration_seconds`, `scene_number` (the beat); transitions in `scene_plans.transition_in` | Same | None |
| Shots within a beat | The gameplay track's `camera.view` (Director spec §6.3) | Doesn't exist | As in the spec |
| Objects shared by every scene of a set | `scene_assets` with `scene_set_id` (the set's canvas) | Stored, linked from nowhere (S1) | **NEEDS CONFIRMATION:** should a set's objects appear in every scene using that set? |

**One editor, two modes.**
- **Build** is Scene Studio as it is: arrange objects and layers.
- **Timeline** adds a track per object (visibility bars from `start_timecode`/`end_timecode`, keyframe diamonds from `keyframes`), plus the camera track and the scene sequence.

Both read and write the same rows through `sceneStudioController`. Switching modes never copies anything, so a scene can't be lost or duplicated.

**One renderer, `StageRenderer`.** It is extracted from `StudioCanvas` (react-konva) and draws a composition **at time t**. It is used:
- in Build, at t = the playhead or 0;
- in the Timeline preview, replacing PreviewMonitor's DOM/CSS drawing (S7, S10);
- in the preview player, under the phone, cursor and PIP;
- in render mode for the export (Director spec §9), so the export draws with the same code.

### 2.2 Prime's PIP: performer segments over raw clips

The takes already live in `episode_raw_clips` (P2), so no new media table is needed. What's missing is **the decision of which take plays when, and where**. That needs a small owner of its own:

**New table, `episode_performer_segments`:** `id`, `episode_id`, `raw_clip_id` (the take), `performer` (copied from the clip and checked: a PIP segment must be `justawoman`, **so a Lala or guest clip is never treated as Prime**), `source_in`/`source_out` (trim, in seconds of the take), `anchor` (`{ kind: 'beat_start' | 'line_start', beat, line }`) plus `offset`, `visible` (**on by default**; Evoni hides a range by hand: approved 2026-10-26), `layout` (`{ preset: 'corner_br' | …, x, y, w, h, shape, border, use_cutout }` in stage pixels), `audio` (`{ role: 'prime_voice', gain }`), `status` (draft/approved), and timestamps plus `deleted_at`.

- **Multiple takes:** a beat can have several segments, for example two halves from different takes, as long as they don't overlap in time.
- **Replaces the localStorage picks:** the Assemble sheet's picks become segments (a one-time "Save these picks" from the browser's stored picks).
- **Not baked in:** the PIP is its own layer, composited at render (`layout.use_cutout` uses the keyed WebM's alpha), never drawn into the background.
- **`episode_performance_clips`** stays as Production Coverage's indicator **until coverage reads segments**. Then its writes stop, so there are never two owners of "the Prime clip for beat N". That's decision Q4.

### 2.3 Dialogue lines and voices: extend what exists

| Fact | Owner (after) | Change |
|---|---|---|
| Who speaks and the words | **The script** (`episodes.script_content`), the speaker resolved by `characterVoice.resolveCharacterKey` | None |
| A line's identity | **New:** `line_key` = beat + a normalised text hash + the occurrence within the beat, shared by the Director's anchors (spec §7.2) | Shared utility (server and client), replacing position-only naming |
| A character's speech voice | **New:** `registry_characters.speech_voice` JSONB `{ provider: 'elevenlabs', voice_id, settings, approved_at }`, on the character, never per episode | Additive migration |
| A line's audio | **`script_voice_clips`, extended:** `line_key`, `character_key`, `source` (`recorded` \| `generated`), `voice_id` and settings used, `text_hash`, `status` (`draft` \| `approved` \| `stale`), `generated_at`, `provider_request_id` | Additive migration; Evoni's existing recordings become `source: recorded` |
| Prime's lines | **No clip row.** Her audio is her PIP segment's take (§2.2), so it can't play twice | Rule |
| What triggers the line | **Worked out by the Director** (spec §4): `voice_click`, `wardrobe_auto`, `message_reaction`, `npc_trigger` or `prime_take` | Not stored on the clip |
| Its timeline position and duration | **Worked out:** the Director's anchor plus the clip's `duration_seconds` | Not stored on the clip |

**The per-line view the ruling asks for** (speaker, voice, source and state, trigger, position, duration, episode/beat/line, approval) is a **read-only join** on a "Dialogue" panel. Nothing is stored twice.

**Generation** is a new `services/speechService`, the **ElevenLabs code extracted from `amberSessionRoutes`** (Amber then calls the same service). It:
- generates only lines that are Lala's or an NPC's, have an assigned voice, and have no `approved` clip whose `text_hash` and `voice_id` still match;
- **never regenerates an approved line whose words and voice haven't changed**;
- marks a line whose words changed `stale`, with a new draft generated (or waiting for a click: Q10), keeping the approved one until the new one is approved;
- logs every request and checks it against the AI budget (characters × rate) through `aiCostTracker`, which needs a non-token cost path added (V3).

**Which source wins** when Evoni has recorded a line *and* a generated one exists: Q5. The recommendation is that her recording wins.

## 3. What can be reused

| Need | Reuse | Class |
|---|---|---|
| Build editor | Scene Studio (`SceneStudio`, `useSceneStudioState`, `StudioCanvas`, the object components, `sceneStudioController`) | VERIFIED exists |
| Renderer for everything | `StudioCanvas` → extract `StageRenderer` | INFERRED feasible (it's already react-konva) |
| Timeline UI | `Timeline.jsx`, `KeyframeTrack`, `KeyframePropertyEditor`, `useSaveManager` | VERIFIED exists |
| Takes, keying, alpha video | `episode_raw_clips`, `rawClipsService.chromakeyArgs`, `rawClipMedia` | VERIFIED |
| Take timing | `beat_marks`, `start_line`; the line and cue marks from Director spec PR 1 | VERIFIED / planned |
| Choosing takes | `assembleTakes.beatOptions` (UI logic) → writes segments | VERIFIED exists |
| Speaker resolution | `scriptSpeaker.isHerSpeaker`, `characterVoice.resolveCharacterKey` | VERIFIED |
| Recorded line audio | `script_voice_clips`, `scriptVoiceClipsService`, `voiceClipsApi.clipForLine`, `useLineVoice`, `VoiceRecord` | VERIFIED |
| TTS | `amberSessionRoutes` ElevenLabs code → `speechService` | VERIFIED exists |
| Voice rules | `scriptShowRules` (`voiceOffLines`, `dressedAt`, `MESSAGES`, `AUTO_REACTION`) | VERIFIED |
| Phone and list | `PhoneDevice`, `ScreenContentRenderer`, My Little List (#3599) | VERIFIED |

## 4. Missing features and technical risks

**Missing (all VERIFIED absent):**
- one composition model (S8);
- per-object animation (S7);
- playback of object timing (S4);
- a shared renderer (S10);
- a server-side chosen take (P6);
- trim, offset and PIP layout (P1, P7);
- audio mixing (P8);
- speech voices on characters (V1);
- TTS for dialogue and its cost tracking (V2, V3);
- line identity (V5);
- status and source on line audio (V4);
- dialogue playback outside the teleprompter (V7).

**Risks:**

| # | Risk | Class | Mitigation |
|---|---|---|---|
| R1 | **Frame-accurate video in headless Chromium.** Seeking a `<video>` to an exact frame is unreliable, so PIP and base video drawn inside the browser could drift. | INFERRED | **Split by medium, not by layer:** the browser render draws every non-video layer (scene, characters, phone, cursor, toasts) as frames with alpha. FFmpeg overlays the video media (PIP, base takes) using **the same layout JSON from the same `layoutAt(composition, t)` function** the preview uses for its `<video>` elements. One geometry, two drawers for video only, covered by the parity tests (§8). |
| R2 | **Lala's audio bleeding into Prime's take** (P9) would play Lala twice. | VERIFIED possible | The teleprompter records whether line clips played during the take (`voice_playback` on the raw clip). Recommend headphones or `playVoice` off while recording (Q9). A take with playback is flagged in the PIP panel. |
| R3 | **A generated line longer than the gap** Prime left for it in her take | INFERRED | A finding: "Lala's line runs 1.2 s past the gap". Choices: hold the PIP frame, cut the PIP, or re-record (Q8). |
| R4 | **Adapting the legacy JSONB** (positions in %, sizes against 960 px) can shift objects slightly when converted to pixels | INFERRED | The adapter keeps the JSONB untouched, writes `scene_assets` once per scene, and shows "adopted from the old Timeline: check placement" |
| R5 | **TTS cost and licensing** for a commercial YouTube show | NEEDS CONFIRMATION | Budget gate; Evoni confirms the ElevenLabs plan covers commercial use (Q6) |
| R6 | **Konva text rendering** differs a little between browsers | INFERRED | The export uses one pinned Chromium; preview parity is checked against render mode, not other browsers |
| R7 | **Positional line keys:** clips recorded before `line_key` exist are named by index only | VERIFIED | A backfill computes `line_key` from the stored `line_text` and beat (read, then write once), and flags any it can't match |

## 5. Migration and backward compatibility

All migrations are **additive**, run only through Evoni's Deploy workflow, and each is guarded so the app keeps working before it runs (the `hasPersonalList` pattern from #3599).

1. **`scene_assets.keyframes`** (JSONB, default `[]`). Until it runs, the Timeline shows timing without object animation.
2. **Legacy scenes (adapt, don't migrate destructively):** when a scene with JSONB `characters`/`ui_elements` and **no** `scene_assets` objects is opened in Build or Timeline, the adapter writes equivalent `scene_assets` rows (% → pixels on the platform canvas, 960-reference sizes × width/960) and sets `scenes.canvas_settings.composition = 'scene_assets'`. The JSONB is **kept, not deleted**.
   - **Export v1** goes on reading the JSONB until `EXPORT_ENGINE=v2`.
   - A **dry-run script** reports, per episode, how many scenes would be adopted and any objects it can't place. It reads only and runs locally against a dump or in CI, never against production from a session.
3. **`episode_performer_segments`** (new table, `deleted_at`). Until it exists, Assemble keeps its browser picks.
4. **`registry_characters.speech_voice`**, plus the **`script_voice_clips`** columns (`line_key`, `character_key`, `source`, `voice_id`, `text_hash`, `status` …). Existing rows become `source: 'recorded', status: 'approved'`, and the backfill computes `line_key`/`text_hash` from their stored text.
5. **`episode_raw_clips.line_marks`, `cue_marks` and `voice_playback`** (Director spec PR 1).
6. **`episode_performance_clips`** is untouched until coverage reads segments (Q4).

**Nothing is renamed or dropped.** The old routes keep answering.

## 6. Recommended implementation order

This merges with the Director spec's PR list (§12 there). Each item is its own PR and needs its own approval.

| # | PR | Why here |
|---|---|---|
| 1 | **Line identity** (`line_key` utility, shared by server and client) and the `script_voice_clips` columns and backfill | Everything (voice, Director anchors, overrides) keys on it |
| 2 | **Take timing:** line marks, cue marks, `voice_playback` (Director PR 1) | Timing anchors (the Timeline owns duration: Director spec rev 3 §3) |
| 3 | **Performer segments:** table, API, Assemble writes segments, PIP layout presets, fallback and warning, visible by default | Prime's footage, the anchors' source |
| 4 | **`StageRenderer` extracted** from `StudioCanvas`; Build keeps working unchanged | One renderer before any new editor work |
| 5 | **Timeline on `scene_assets`:** object visibility and keyframe tracks, camera track, legacy adapter and dry-run, PreviewMonitor → `StageRenderer` | The shared Stage |
| 6 | **Speech voices:** `speech_voice` on characters, `speechService` (extracted from Amber) with budget tracking, generation queue, Dialogue panel | Lala and NPC voices |
| 7 | **Voice and trigger rules** (Director PR 2, decisions D-3 and D-4) | Validation |
| 8 | **Director core** (Director PR 3), now consuming segments, line keys and dialogue clips | Gameplay |
| 9 | **Script verbs; closet decisions** (Director PRs 4 and 5) | Gameplay |
| 10 | **Track storage and overrides** (Director PR 6) | Edits survive |
| 11 | **Preview player:** `StageRenderer` + phone + cursor + PIP `<video>` + Web Audio from **one mix plan** (Director PR 7) | Approval |
| 12 | **Render mode + compositor v2:** browser frames for non-video layers, FFmpeg for video layers from `layoutAt` plus the same mix plan (Director PRs 8 and 9) | Export |
| D6 | **Server enablement: Evoni** | — |

My Little List Phases 2 and 3 go on in parallel. Phase 2's component appears in PR 11.

## 7. Product questions for Evoni

| # | Question | Recommendation |
|---|---|---|
| Q1 | Is "Build Scene" **Scene Studio** ("Open in Studio")? | Yes. Rename its button "Build Scene" so the words match |
| Q2 | ~~Should a set's objects appear in every scene that uses it?~~ **Decided (2026-10-26):** episode scenes inherit the set's master objects and keep local overrides, copy-on-write; a customized object survives the master's deletion; gameplay references the episode-scene object, never the master | — |
| Q3 | **Prime's PIP look:** which corner, how big, rectangle or cut-out, border. **Decided (2026-10-26):** visible by default in every beat (no automatic cutscene hiding), shown or hidden by hand; missing footage uses a designated fallback, with a warning | Bottom-right, 28% width, cut-out when keyed |
| Q4 | Retire **`episode_performance_clips`** writes once Production Coverage reads performer segments? | Yes, one owner |
| Q5 | When you've **recorded** a Lala or NPC line *and* a generated one exists, which plays? | Your recording |
| Q6 | **TTS provider and plan:** ElevenLabs (the account Amber uses), a monthly cap, and commercial-use rights for YouTube? | ElevenLabs, a cap you set, rights confirmed before PR 6 merges |
| Q7 | **Who assigns voices**, and is a voice approved once per character? | You, once per character, on the character's page |
| Q8 | **A generated line longer than your pause:** hold your PIP frame, cut your PIP, or re-record? | Hold the frame (freeze), with a warning |
| Q9 | Turn **"Play voices" off while recording** (headphones on) to stop bleed into your takes? | Off while recording by default |
| Q10 | When a line's words change after approval, **generate a new draft automatically** or wait for a click? | Automatically, as a draft; never auto-approve |
| Q11 | Accept the **split render** (browser for non-video layers, FFmpeg for video, one shared layout function)? | Yes (R1) |
| Q12 | **Platform:** 1920×1080 authoritative for now, 9:16 later? | Yes |

## 8. Acceptance tests: preview and export stay in sync

**Parity**
1. **Same inputs, same plan:** the preview player and the export worker build the same `{ composition version, track version, segments, mix plan }`, and a test asserts the two JSON documents are equal.
2. **Geometry:** `layoutAt(composition, t)` is pure. Unit tests at chosen times: Build (t=0), Timeline playhead, preview and export all call it, with no other placement code.
3. **Frames:** render mode captures Episode 1 at fixed points (the A/B/C moments plus every `cursor.press`). The export's decoded frames at those times match render mode's within a small pixel tolerance on the video layers and exactly on the non-video layers (hash).
4. **Audio:**
   - the mix plan's events (Prime segment audio, Lala and NPC clips, sound effects) land within one frame in the export, checked by locating each clip's onset in the mixed track;
   - no line has two sources;
   - Prime's lines come only from segments.
5. **Determinism:** two exports of the same inputs give identical frame hashes for the non-video layers.

**Shared Stage**
6. Build a scene (3 objects) → switch to Timeline → add visibility and a keyframe → return to Build: the same 3 rows, the same rest positions, no new scene, and no JSONB write.
7. Adapter: a legacy scene (JSONB only) opens in Build with its objects placed, its JSONB unchanged, and the dry-run report listing it.

**PIP**
8. A `lala` or `guest` take can't be made a PIP segment (400).
9. Trim and offset move Prime's line marks by exactly the offset in the timeline.
10. Two takes in one beat play back to back without overlap.
11. A take with `voice_playback` is flagged.

**Voice**
12. Generation skips approved lines whose text and voice match, and makes a draft for a changed line while the old approved audio stays until the new one is approved.
13. Every generation is logged against the AI budget; a budget refusal stops the queue and shows why.
14. The Dialogue panel shows, for each Episode 1 line: speaker, voice, source and state, trigger (from the Director), position, duration, and episode/beat/line.

**Episode 1, end to end (gameplay, PIP and voice together)**

| Moment | Prime (PIP, her take) | Gameplay (track) | Lala / NPC (clips) |
|---|---|---|---|
| Beat 1–2 start | On screen, bottom-right, from her take's beat mark | Login screen, phone opens | — |
| "Let's see what Lala's up to" | Her line (take audio) | The cursor moves to Voice **while she talks**; the press lands just before her line ends | — |
| Lala speaks | Holds silent, the gap her teleprompter left ("Stay quiet · react") | `voice.on` toast | Lala's generated line in the gap; a longer line holds her frame (Q8) |
| Beat 4 notification | Reacts at her cue mark | Toast + `notify` sound at the cue mark | Lala's automatic reaction right after (no click) |
| Beat 8 equip | "The gold ones" (decision line) | Hover, compare, `[WEAR]` press on her line, tick sound | Lala's wardrobe reaction (no click) |
| Beat 9 My Little List | Comments | List opens, the outfit item ticks | — |
| Beat 10 travel | Narrates | `scene.enter` venue front → beat 11 inside, transition from the plan | — |
| Beat 11 NPC | Visible by default (hidden only by hand) | The cutscene clip, plus any gameplay the script puts in the beat | Host and guest lines, generated, trigger `npc_trigger` |
| After the NPC | Back on screen, reacts on her next line | Holds | — |
| Reel | "Posting it" | Post screen, press, the list's video item ticks | — |
| Beat 14 runway | Surprise, at her cue mark | DM toast, `list.appear` | Lala's message reaction |
| Stats | — | Stats panel from `statsAt` | — |
| Export | Same segments | Same track | Same clips; the parity tests above pass |
