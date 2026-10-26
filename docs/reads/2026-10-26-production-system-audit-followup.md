# Prime Studios — Production System Audit, follow-up (read)

**Basis.** `cb02c6a7`, the same as `2026-10-26-production-system-audit.md`. `origin/main` has since moved to `390de42b`; that change is season specials only, and it adds no new path that creates episodes (VERIFIED by diff).

**Mode.** Read-only. The one exception is the export-argument fix in §5. It is written and tested on a separate local branch, `claude/export-job-args`. It is **not pushed and not proposed for merge** until Evoni approves.

**Labels.** VERIFIED (read in code) · INFERRED · NEEDS CONFIRMATION. §7 sorts the confirmation items by who can confirm them.

**Kept separate.** My Little List (PR #3599), the Gameplay Director specification, and this audit stay separate pieces of work. §6 only says where the Director must wait.

---

## 1. Script tab vs Script Writer page

**What is authoritative today: `episodes.script_content`.** Every reader that is still in use reads it. VERIFIED.

- **Production readers:**
  - teleprompter (`Teleprompter.jsx`, `teleprompterScript`)
  - phone needs (`EpisodePhoneNeeds`)
  - evaluation (`routes/evaluation.js`, `parseEventTag`)
  - post drafts (`scriptPostDrafts.getScriptPostDrafts`)
- **Story readers:**
  - story threads (`threadInbox.openFromRecord`)
  - story record (`episodeStoryRecord.draftRecord`)
  - season twists, loader and intention services
- **Money, wardrobe and voice readers:**
  - deal checklist
  - to-do `wornAsOf`
  - terms reopen
  - character voice (`captureOnLock`)
- **Other routes:** `world.js`, `suggest-scenes`, `inject`, `scriptParse`.
- **Script tab helpers:** `scriptHealth`, `ScriptReadActions`.
- **Status and planning helpers:** `productionSteps`, `episodePipeline`, `episodePlanning`, the production checklist, the board and the ledger.
- **My Little List on its PR branch:** `myLittleListService.loadListInput`.

That is about 25 readers in all.

**`episode_scripts.*` is read only by `EpisodeScriptWriterPage`.** VERIFIED.

- **Two incompatible migrations exist.** `20240101000007` has an INTEGER id and `content`. `20260718000000` has a UUID id, `script_text` and `script_json`. The model follows the second. VERIFIED.
- **The register says canon has neither.** `Canon_EpisodeScripts_ColumnDrift_2026-09-21.md` records 21 legacy columns and **no `script_text`/`script_json`**. It is still owed. **So the Script Writer's `EpisodeScript.create` may never have saved on production.** NEEDS CONFIRMATION (production database).

**What only one of them has** (VERIFIED):

| Only the Script tab (grounded, `generateGroundedScript`) | Only the Script Writer (`generateEpisodeScript`) |
|---|---|
| Beat locks; line rewrite; regenerate one beat (`generateGroundedBeat`) | Typed `script_json` and the Structured view |
| Hand edit and save (`PUT /episodes/:id`) | Haiku franchise guard (stored in `context_snapshot`, never shown) |
| Coverage, show rules, phone paths, coin lines | Wardrobe Intelligence in the prompt (the tab runs `lite:true`) |
| Version history UI (`ScriptHistory`, over `episode_script_versions`) | Brain-rule `injection_count` (`recordRuleUse`) |
| Import, health panel, teleprompter link, export, voice clips | Per-generation metadata (model, tokens, cost, prompt hash, context) |
| Overwrite guard on every write | Whole-script "locked" status; **its `/lock` copies over `script_content` with no guard** (it does snapshot first) |

The two already share `loadScriptContext`, `storyContextBlocks`, `MODELS` and `deterministicFixes`. VERIFIED.

**What breaks if one is removed.**

- **Without the Script Writer:**
  - Two "Write Script" buttons go dead: `EpisodeProductionChecklist`, and `EpisodeBlueprintModal` from EventLibrary.
  - The guard, Wardrobe Intelligence and rule counting are lost unless they are ported.
  - Any `episode_scripts` rows in the new shape are orphaned.
  - Every downstream reader keeps working. (VERIFIED / INFERRED)
- **Without the Script tab:** about 25 readers lose their only editor, along with locks, history, import and health. The Writer cannot edit or lock beats, so it cannot replace the tab. (INFERRED)

**Recommendation: one script source of truth, losing no feature.**

- **Canonical text:** `episodes.script_content` + `script_locked_beats`.
- **History:** `episode_script_versions`.
- **The Writer becomes a mode of the tab.** It is a "Full context" mode of the Script tab's Generate: the same route and the same lock-keeping, snapshot and overwrite guard.
- **The Writer's features become steps of that one pipeline.** The franchise guard is shown in `ScriptHealthPanel`. Wardrobe Intelligence is a context option. Rule counting is kept.
- **The typed view is derived when read.** `script_json` comes from the shared parser (`scriptBeatParser.parseScript`), which serves the Structured view.
- **The old page redirects.** `/episodes/:id/script-writer` → `/episodes/:id?tab=scripts`.
- **Option A, no migration:**
  - Generation metadata stays in `ai_usage_logs`.
  - The guard result is returned in the response.
  - `episode_scripts` is frozen: reads only, no writes.
  - Precondition: `20261015100000` (`episode_script_versions`) is applied on canon. NEEDS CONFIRMATION.
- **Option B, migration through the Deploy workflow:**
  - Add `episode_script_versions.meta JSONB` for model, tokens, guard and mode.
  - Back-fill any recoverable Writer rows after a canon read.
  - Rule separately on the legacy `episode_scripts` drift.
- **Not recommended:** making `script_json` canonical.

## 2. Scene Studio, "Build Scene", Timeline preview: one Stage

**What exists** (VERIFIED):

| Surface | Draws | Coordinates | Reads / writes | Reaches Timeline / export? |
|---|---|---|---|---|
| Scene Studio (`/studio/scene/:id`, `/studio/scene-set/:id` → `SceneStudio` / `StudioCanvas`, react-konva) | Background (cover or parallax), objects (image/text/shape/video), mask | Absolute px of the preset canvas (`PLATFORM_PRESETS`, default 1920×1080), zoomed to fit | `scene_assets` (by `scene_id`, or by `scene_set_id`/`scene_angle_id`), `scenes.canvas_settings`, `scenes.background_url` via `sceneStudioController.getCanvas` / `saveCanvas` | **No.** Only `background_url` carries through |
| "Build Scene" | **No such editor.** The nearest is the Script tab's read-only "Builds the scene" strip (`EpisodeScriptTab`, `beatOnScreen()`), with chips derived from the script; it also matches "Build Scene Spec" (Scene Sets AI) and "Build Scene Brief" | none | reads `script_content` only | No |
| Timeline preview (`TimelineEditor` → `PreviewMonitor`, DOM) | `background_url`, `characters[]`, `ui_elements[]` as text boxes; keyframes on the whole scene | CSS % of the frame | reads `scenes` + `timeline_data`; writes through `POST /episodes/:id/save`; **drag not saved** (`onUpdateElement` not passed) | It is what export reads, but nothing authors `characters`/`ui_elements` (INFERRED: empty) |
| Export preview (`ExportPage`, `ScenePreview`) | Thumbnail of scene 0 | CSS cover | `scenes` | — |
| Export (`videoRenderer.renderSceneFrames`, node-canvas) | Background, characters, UI elements | positions: "%" of the output, or **raw output px**; sizes: relative to `STAGE_REFERENCE_WIDTH = 960` | `scenes` + `timeline_data` | — |

So there are three coordinate conventions: Studio pixels at 1920, Timeline percentages, and the renderer's 960-based sizes with %-or-raw positions. Scene Studio's richer layer store (`layer_order`, `is_visible`, variants, `asset_role`, `start_timecode`/`end_timecode`, crop/style) is read by nothing after it. VERIFIED.

**Recommendation: one Stage, not another editor.**

1. **One composition store: `scene_assets`**, with `canvas_settings` (it adds a saved reference size) and `background_url`.
   - `scenes.characters`/`ui_elements` stop being authored. If anything still needs them, they become a read-only projection.
   - `timeline_data` holds **time only**: beats, clips, and keyframes keyed by `scene_asset.id`.
   - One coordinate convention: fractions of the reference frame, or px plus a saved reference size.
   - Converting existing rows is a reviewed migration that Evoni runs.
2. **One `<Stage>` component** built from `StudioCanvas`, with `mode = edit | preview | thumbnail`:
   - **edit:** this is Scene Studio.
   - **preview:** driven by the Timeline playhead; it replaces `PreviewMonitor`'s frame.
   - **thumbnail:** this is the Export preview.
   - The "Builds the scene" strip stays as a checklist. An optional "place on Stage" action could create `scene_assets` rows (INFERRED design).
3. **The server renderer reads the same store.** `export.js` selects `scene_assets` joined to `assets`, plus `canvas_settings`. `renderSceneFrames` draws them by `layer_order` with the same layout function the client uses (`objectToRect(obj, refSize, outSize)` in shared code). Add a golden-frame test with a fixed fixture rendered by Konva and by node-canvas, compared within a pixel tolerance.

**Risks and decisions** (NEEDS CONFIRMATION):
- **Base layer.** Should a scene's Stage show its set or angle objects as a locked base layer, or copy them in? Today `getCanvas` reads only `scene_id`.
- **Background overwrites.** `syncBeatScenes` re-syncs `background_url` on every export. The Timeline save also writes `background_url`. Either may overwrite a background chosen in Scene Studio (INFERRED).
- **Effects with no server path.** Parallax, masks and video objects have no node-canvas path. They should be preview-only or baked into the image.
- **Fonts.** Lora and DM Mono must be registered in node-canvas.

## 3. Audio and performance path

**Identity first** (VERIFIED):
- **Prime is Evoni on camera.** The script speakers `Me`/`Prime`/`JustAWoman`/`JAWIHP` are one performer, "her" (`scriptSpeaker.KNOWN`, `teleprompterLines`). Clips record her as `justawoman`.
- **No Prime PIP exists.**
- **"Voice" in the code means writing style, not sound.** That covers `characterVoice`, `pulseVoices` and cast `voice_id`.

| | Prime (Evoni on camera) | Lala | NPCs (hosts, guests, Feed/phone characters) |
|---|---|---|---|
| Authored | `Me:`/`Prime:`/`JustAWoman:` lines → teleprompter `kind:'mine'` | `Lala:`, `Lala (V.O.):`; `Lala (auto):` → screen cue | Any `Name:` line → `kind:'cue'`; Feed and phone characters are text only |
| Produced | Teleprompter camera and mic (`useTakeRecorder`, MediaRecorder): per-beat takes or "Record whole episode"; uploads on Assets → Files | Evoni records a take "Read as" Lala (`performer:'lala'`) or an audio-only voice clip (`VoiceRecord`, `useVoiceRecorder`). **No TTS** | Evoni's own voice clips per line, or a take with `performer:'guest'`. **No TTS anywhere in the show path** (ElevenLabs serves only the Amber assistant; `speechSynthesis` only in WriteMode/StoryPlanner) |
| Stored | IndexedDB chunks until saved → S3 + `episode_raw_clips`; chroma key → WebM with alpha that **keeps the audio**; `episode_performance_clips` per beat | S3 `episodes/<id>/voice-clips/` + `script_voice_clips` (episode, beat, line_index); **409 until migration `20261020120000`** | same as Lala |
| Speech triggered and synced | Whole-episode takes record `beat_marks [{beat,t}]` (needs migration `20261023235900`; until then markers can only be downloaded). **Beat level only** | Teleprompter plays the clip (`useLineVoice`, `new Audio`) and holds the scroll until it ends (1.5 s stall fallback); cutscene beats 11–13 are skipped. Rehearsal only; the app says "use headphones" to keep it out of the take | same as Lala |
| Previewed | Takes list; `AssembleTakesSheet` (★ saved on the server; other picks only in **localStorage**, which leave only via "Copy the order") | Teleprompter and the Script tab mic | Teleprompter |
| Exported | **Never** | **Never** | **Never** |

All VERIFIED, except that Evoni voices Lala (INFERRED).

**Music, SFX and audio models** (VERIFIED):
- **Music cues** are metadata rows ("Lala Theme v1") with no file.
- **`[SFX:]`/`[MUSIC:]`** become a 3-second teleprompter cue and a text cue sheet.
- **`audio_clips` (AudioClip)** has CRUD routes and no frontend caller.
- **Animatic `dialogue-clips`** creates placeholders with `video_url:null`.
- **Timeline "+ Audio"** sets `audioUrl:null`.
- **The renderer** has `// TODO: Add audio mixing`. Whether the MP4 carries an empty audio track is NEEDS CONFIRMATION.

**Timing that exists to sync speech with gameplay:**
- **Estimates:** `scriptRuntime` (150 wpm, 3 s per action) and the teleprompter's fixed 3 s per `[UI:]`.
- **Measured per beat:** `beat_marks`.
- **Measured per line, rehearsal only:** voice-clip length and `useVoiceFollow` (saves nothing).
- **Hand-set:** Timeline markers.
- **Missing:** nothing ties a `[UI:*]` action to a time in a take or in the render. **Per-line or per-action timing must be captured or derived before speech and gameplay can be synced.**

## 4. Every episode-creation route

| # | Route → insert | Caller | Brief | Slot | 14 beats | Locations | To-do | Wardrobe | Event stamped | Price snapshot | Deliverables | Overlays | Server readiness | `setup_status` |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| A | `…/events/:id/generate-episode` → `generateEpisodeFromEvent` | Event Package Start | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ (+ client gates) | ✔ |
| B | `…/events/generate-episode-from-many` (anchor event) | EventLibrary; `NextEventSuggestionsOverlay` | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔, **no client gate** | ✔ |
| B′ | same, the *other* events (`UPDATE`, `episodeBatch.js:96`) | — | **✘** | n/a | n/a | ✘ | ✘ | ✘ | partial (no `times_used`) | ✔ | ✘ | ✘ | prices only | n/a |
| C | `…/events/:id/regenerate-episode` | EventLibrary; Overview | ✔ (old brief left on the soft-deleted episode) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | partial (price check skipped) | ✔ |
| D | `…/two-parters/:id/part-two` → `startPartTwo` (raw INSERT) | SeasonSpecials; SeasonPageRoadmap | partial (no `beat_outline`/`forward_hook`/`narrative_purpose`) | ✔ | **✘** | ✘ | ✘ (by design) | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | **✘** |
| E | `POST /api/v1/episodes` → `episodeController.createEpisode` | none reachable (`QuickEpisodeCreator`'s create branch can't be reached from the router; `CreateEpisode.jsx` isn't mounted) | **✘** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| F | **`GET /api/v1/episodes/test-create`** (`episodes.js:26`) | none, but **any signed-in user who loads the URL creates an episode with no show** | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ | ✘ |
| G | `POST /api/v1/seed/episodes[/all]` (admin; not mounted in production) | none | ✘ | … | | | | | | | | | | |

Matrix VERIFIED, except that E cannot be reached (INFERRED). Seed scripts under `scripts/` are not app code. NewEpisodeStarter creates events, not episodes. No route duplicates or imports episodes.

**Paths that link an event to an existing episode without a brief** (VERIFIED):

| Path | Effect |
|---|---|
| `POST …/events/:id/inject` (EventLibrary, QuickEpisodeCreator) | Adds the `[EVENT:]` tag, stamps the event used, links the set. No brief, price snapshot, deliverables, beats, to-do or wardrobe. |
| `PUT …/events/:id {used_in_episode_id}` (EpisodeOverviewTab) | The link only. |
| QuickEpisodeCreator fallback `PUT {episode_id}` | `episode_id` is not on the allow-list, so this probably does nothing, and one branch swallows the failure (INFERRED). |

**What breaks without a brief** (VERIFIED):
- **The brief is created blank.** `GET /episode-brief/:id` creates an empty brief on first read, with no `event_id`.
- **Thirty readers lose the event.** About 30 readers resolve the event through `episodeEventIdSql`, which falls back to `used_in_episode_id`. With no stamp they see no event.
- **The scene plan generates from nothing.** `generate-plan` runs with every field reading "Not set".
- **Completion loses its event without a trace.** It loads the event inside `.catch(() => [])` (`episodeCompletionService.js:273`), a silent catch that breaks the repo rule. Without it there are no event rewards and no `filmed` stamp.
- **Terms lock without a price snapshot.** After inject or the PUT, the terms lock through the fallback, but no prices were frozen.
- **Worst: nothing flags the unfinished setup.** The production checklist flags it only if `setup_status.complete === false` or some beats exist (`EpisodeProductionChecklist.jsx:548`). An episode with no `setup_status` and no beats (D, E, F, G) is **never** flagged, so "Resume setup" never appears.

## 5. Export argument mismatches: smallest safe fix (written, tested, not pushed)

**The mismatches** (VERIFIED):

| Field | Route queues (`routes/export.js`) | Worker read (`workers/videoRenderer.js`) | Effect |
|---|---|---|---|
| Size | `platform: 'youtube'` (a key), `resolution: '1280x720'` | `platform.width` / `platform.height` | Every export came out 1920×1080 |
| Timeline | `timelineData` | `timeline` | No timeline ever reached the worker |

**The fix.** Branch `claude/export-job-args`, local commit `35fb3af3`, from `origin/main` `390de42b`. It changes 4 files (+230/−1):
- `src/utils/exportJobData.js` (new): `readExportJob(data)` returns `{ platform: {platform, width, height}, timeline }`.
  - The size comes from `resolution`. A job already shaped as `{width,height}` is read as it is. Anything unreadable falls back to 1920×1080.
  - The timeline comes from `timeline || timelineData`.
- `src/workers/videoRenderer.js`: the processor reads `platform` and `timeline` through `readExportJob`. That is 4 lines changed.
- **The route is unchanged.** The status and list responses still show `platform` as the key, and jobs already queued in either shape still read correctly.

**Tests.**
- `tests/unit/utils/exportJobData.test.js` covers the helper.
- `tests/unit/workers/videoRendererJobArgs.test.js` sends a job through the **real export route** (supertest; the queue is mocked to capture the payload), then through the **real worker processor** (canvas, FFmpeg, S3 and sockets faked). It checks four things:
  1. The route still queues key, resolution and `timelineData`.
  2. `quality:'720p'` gives canvases of 1280×720 and FFmpeg `-s 1280x720`.
  3. A worker-shaped keyframe (`sceneId`, `elementId`, opacity 0.4) changes the drawing.
  4. **It is not parity.** The Timeline editor's own keyframe shape (`{id,time,properties}`) still draws as no transform.

**Evidence: without the fix** (worker change stashed):
```
✓ the route still queues a platform key, a resolution and timelineData
✕ the chosen size reaches the frames and the FFmpeg output
✕ the timeline reaches the renderer: a worker-shaped keyframe changes the drawing
✓ not parity: the Timeline editor's keyframes still draw as no transform
Tests:       2 failed, 2 passed, 4 total
```
**With the fix:**
```
PASS tests/unit/utils/exportJobData.test.js
Test Suites: 2 passed, 2 total
Tests:       9 passed, 9 total
```
ESLint exits 0; `node -c` passes; `lint-silent-catches.sh` finds no new silent error handlers.

**What this does NOT fix.** These limits are pinned by the last test or still open:
- The editor's keyframes are not applied: the shapes differ, and keyframes are evaluated only at t=0.
- No audio, no video backgrounds, no Scene Studio layers, no gameplay, no PIP.
- `format` is ignored: the output is always MP4.
- **A related route defect, not changed here:** the quality preset overrides the platform's aspect ratio. Instagram + `1080p` resolves to `1920x1080`, landscape. Before the fix nothing reached the worker, so this was invisible. After the fix the worker honours it. It should be decided together with the fix (Q-E1).

## 6. Dependency-aware implementation order

The Gameplay Director's inputs are four interfaces that are **about to change**:
- **Script:** beat identity and the tag grammar.
- **Stage:** the composition store and coordinate convention, plus the phone's placement on the Stage.
- **Timeline:** the time model.
- **Performance timing:** when each line or action happens.

The Director's implementation must wait until each of these is frozen. Its *specification* can be written now, marking those inputs as provisional.

| Step | Work | Depends on | Freezes | Can run in parallel with |
|---|---|---|---|---|
| 0 | Independent fixes, no interface change: the export argument fix (§5) + the aspect decision; remove or gate `GET /test-create`; log the completion catch; flag "no `setup_status` and no beats" in the checklist; guard the Script Writer `/lock` overwrite; client gates before B/C | — | — | everything |
| 1 | **Script contract.** Option A single source of truth (§1); one shared tag parser for backend and frontend, with a written grammar and fixtures; stable beat identity (beats 1–14 are canonical, `BEAT_COUNT`; decide whether lines need ids) | owner Q-S1 | script interface | 2 |
| 2 | **Creation contract.** One initializer used by A/B/B′/C/D and by every link path (inject, PUT link). It always makes a brief with `event_id`, a price snapshot and deliverables; it repairs existing brief-less episodes through "Resume setup" | — | "an episode always has X" | 1 |
| 3 | **Stage contract.** `scene_assets` as the composition store, one coordinate convention, the `<Stage>` component in edit/preview modes, **the phone's on-Stage placement** | owner Q1 (what is Stage), Q-ST1 (set base layer); a migration through the Deploy workflow | stage interface | 4-prep, 7a |
| 4 | **Timeline contract.** Time-only `timeline_data` keyed to `scene_asset.id` and beats; retire the five unused timeline stores | 3 | time interface | 7a |
| 5 | **Event-change detection.** Fact fingerprints written by the step-2 initializer; a "changed upstream" panel; regeneration that keeps edits using the step-1 locks | 1, 2 | — | 3, 4 |
| 6 | **Gameplay Director implementation.** Gameplay track store; generator from step-1 tags + Phone Hub zone geometry + step-3 phone placement, timed against the step-4 model | 1, 3, 4 (+7a for speech sync) | gameplay track | — |
| 7a | **Performance timing capture.** Server-saved take picks (replacing localStorage), `beat_marks`, then per-line marks | 1 (line identity); migration `20261023235900` on canon | performance timing | 3, 4 |
| 7b | **Audio decisions and sources.** Takes vs TTS vs captions; music library | owner Q3 | — | — |
| 8 | **Renderer parity.** The worker reads `scene_assets` + the timeline + the gameplay track + audio; a golden-frame test against the Stage | 3, 4, 6, 7 | — | — |
| 9 | **Auto-drafted episode.** Start chains brief → script → gameplay track → timeline → Stage preview, all drafts with per-layer approval | everything | — | — |
| 10 | **Navigation consolidation** (audit §F) | 1, 3, 4 | — | — |

My Little List Phase 2 (its UI) depends only on the phone and on the step-1 tag grammar (`[WEAR]`, `[DELIVER]`, `[LEARNS]`). It does not depend on Stage or Timeline. It can proceed in its own scope once step 1's grammar is agreed, or before that if it keeps to today's tags.

## 7. What kind of verification each finding needs

**A. Verified by reading code** (no further test needed to state the finding):
- the two export mismatches (now also shown by test)
- worker draws one still per scene, with no audio
- no PIP or Prime layer
- cursor paths only reach a ZIP
- playthrough stores flags only
- event PUT is raw SQL with no hooks; only terms and place are locked
- fields that are snapshotted vs read live
- 9 script generators, 2 live
- `script_content` read by about 25 readers
- `LalaEpisodeFormula` model missing (G6 500)
- `Scene` model has no `metadata`
- icon-cue sources are wrong
- six timeline stores, one used
- Scene Studio output never read downstream
- three coordinate conventions
- every row in the §4 creation matrix
- `GET /test-create`
- the silent completion catch
- the checklist misses an episode with no setup record and no beats
- audio paths never reach export
- Assemble Takes picks in localStorage
- navigation and label findings

**B. Need a running-app test** (local stack with Postgres, Redis and ffmpeg; no production access):

The rendering and editor behaviour:
1. That an export job completes end to end and how the MP4 looks, including whether it has an empty audio track.
2. Timeline drag not persisted.
3. Visual divergence between the PreviewMonitor and the export frame.
4. Whether `syncBeatScenes` or the Timeline save overwrites a background chosen in Scene Studio.

The broken routes and pages:

5. `IconCueTimeline` returns 401 (raw axios).
6. G6 `/generate-lala-script` and `gameShows` return 500.
7. `apply-scene-plan` drops `metadata` silently.
8. The QuickEpisodeCreator `PUT {episode_id}` fallback links nothing.

The episode-creation and phone behaviour:

9. Cursor-path "Regenerate" duplicates rows (needs the tables).
10. Whether the phone content zone in the preview shows a beat-aware list.
11. B/C run without client readiness gates.
12. The brief is created blank on first read and `generate-plan` then runs on it.

**C. Need production database or server verification** (Evoni only; sessions have no access):

The server's export dependencies:
1. Redis, the `ffmpeg` binary and the `episode-worker` PM2 process are running (otherwise export returns 503).

Tables, columns and migrations on canon:

2. `cursor_actions`, `icon_cues` and `icon_slot_mappings` exist on canon (the register says they are absent).
3. `episode_scripts` live columns: has the Script Writer ever saved?
4. `scenes.metadata` column.
5. Migrations applied:
   - `20261026150000` (specials)
   - `20261020120000` (voice clips)
   - `20261023235900` (`beat_marks`)
   - `20261015100000` (`episode_script_versions`)
   - `20261026170000` (My Little List, when merged)

Data already on production:

6. Episodes with no brief, or a blank brief (from `/test-create` or the old creators).
7. `brief.season_id`/`arc_id` null on Event Package episodes.
8. Whether any exports have actually been produced (S3 `exports/`).

---

## Owner decisions added by this follow-up

- **Q-S1:** Script source of truth: Option A (no migration) or B (`meta JSONB` on versions)?
- **Q-ST1:** Should a scene's Stage inherit its scene set's or angle's objects as a locked base layer, or copy them?
- **Q-E1:** Export size: keep "quality overrides platform" (which turns Instagram 1080p landscape), or scale the platform's aspect to the quality's short side?
- **Q-A1:** Is Lala's voice in the episode Evoni's recorded take (on camera or voice clip), TTS, or captions? Same question for NPCs.
- **Q-C1:** Should `GET /test-create` be removed, or gated to non-production?
