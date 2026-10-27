# Voice Studio and Timeline Editor: one episode-production workflow (read, design proposal)

**Status:** audit and design proposal only. Nothing is implemented, migrated, pushed or deployed. Each phase in §7 needs Evoni's approval before any code, and each needs its own approval to push, open a PR, merge or deploy.

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
   - Missing footage uses the fallback with a warning and never adds audio (spec §1; decisions R2, R3, §8.1, §14).
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
  - Where teleprompter marks are missing, the timing is "estimated" (spec §3).
  - Overruns are findings, never automatic changes (spec §3.2).
- **Overlays:** phone and UI overlays, later (T7). **SFX:** library slots only (spec §9). **Music:** library files. **Captions:** from the script lines and the dialogue timings (T8).

**Warnings panel**, one list fed by the shared resolver; each item jumps to its source:
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
- **T2, editor v1:** auto-assemble a draft from the episode (scenes, favourite Prime takes, approved dialogue); the PIP inspector; save; the warnings panel.
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
