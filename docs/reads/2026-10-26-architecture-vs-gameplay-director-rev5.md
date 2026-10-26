# Architecture vs Gameplay Director Revision 5: review (read)

**What this is.** A read-only review of the architecture documents against the planning baseline, `docs/GAMEPLAY_DIRECTOR_SPEC.md` **Revision 5**:
- the spec is on branch `claude/gameplay-director-spec` (`ab9df29a`, PR #3600);
- the architecture documents reviewed are `docs/STAGE_PIP_VOICE_PLAN.md` (same branch, written against Rev 3) and `docs/reads/2026-10-26-production-architecture-decisions.md` (this branch).

**Not changed by this review:** no document, no code, no push. The corrections are listed for Evoni to accept first.

**Basis.** Implementation status was checked on `origin/main` `93a7b74a` (My Little List Phase 1 merged).

**Labels:**
- **VERIFIED:** read in code on `main`.
- **SPECIFIED:** written in a plan, not built.
- **INFERRED.**
- **DECISION:** needs Evoni.

**Precedence.** Where documents disagree, Rev 5 and Evoni's rulings win. My own earlier proposals give way first.

---

## 1. Your eight points against the documents

| # | Your point | Rev 5 | STAGE_PIP_VOICE_PLAN (SPV) | Decisions doc | Result |
|---|---|---|---|---|---|
| 1 | One Stage: Studio owns composition; Timeline adds timing, camera, object animation, sequencing | §2, §6.3: Timeline owns object and camera keyframes, angle changes, duration | §2.1 puts **object keyframes on `scene_assets.keyframes`** and visibility timing on `scene_assets.start/end_timecode`, which are Stage rows | §7.6 keyframes in the Timeline, keyed by object and view | **Conflict C1** (SPV) |
| 2 | Front/Back = angles of one set; inherit; keep local changes; **stable episode-scene object ids** | §2, §6.2: gameplay references **episode-scene object ids, never master ids** | Q2 decided, but no data model | §7.3 `object_key` = **master id** used for references | **Conflict C2** (decisions doc) |
| 3 | Prime's PIP: take, trim, marks, position, visibility, fallback belong to PIP | §2, G-5 | §2.2 `episode_performer_segments` with a per-segment `visible` field | §8.2 separate `episode_pip_*` tables | **Conflict C3** (two designs; SPV's per-segment visibility) |
| 4 | One script with stable line keys; approved sources; Voice-icon click in any beat; reactions automatic; Director owns clicks, not audio | §4, §4.1 | §2.3 `line_key` = beat + text hash + occurrence; Q5 "recording wins" | §3.3 `line_id` minted and carried; §3.4 **`cutscene` trigger class** | **Conflicts C4, C5, C6** |
| 5 | Timeline owns duration; Prime's marks are anchors; conflicts flagged, never silently corrected | §3, §3.2 | Q8 recommends **freezing the PIP frame** | §3.2 resolution steps 1–3 adjust automatically, step 3 runs gameplay **under the next line** | **Conflicts C7, C8** |
| 6 | Director proposes; Timeline validates and applies through its write interface | §6.3 `timeline.applyProposal` | §2.1 "shots within a beat: the gameplay track's `camera.view`" (Rev 3) | §11 "may propose view cuts as drafts" | **Conflict C9** (SPV only) |
| 7 | Preview and export: same composition, layout, mix and approved data; PIP separate | §8, §10, §6.6 | §2.1 StageRenderer, R1 split render | §7.5 node-canvas worker plus golden tests | **Gap G1** (renderer approach; deferred to export phase) and **Gap G2** (what an approval freezes) |
| 8 | A1–A9 status | §14 | §6 order | §5 order | §2 below; **Gap G3** ("active line" ownership) |

## 2. A1–A9: what exists on `main` (checked at `93a7b74a`)

| # | Deliverable | Status | What exists (VERIFIED) | Blocks |
|---|---|---|---|---|
| A1 | `line_key` and line identity | **Specified only** | `voiceClipsApi.lineKey(beat, index)` is **positional** (`"4:2"`). `script_voice_clips` is keyed by `(episode, beat_number, line_index)` plus `line_text`. The client hides a clip whose words changed (`isStale`). `EpisodeScriptTab.nextLineIds` carries line identity across edits by an LCS match, but **only in the browser session, for React keys**. Nothing on the server. | GD-3 |
| A2 | Teleprompter line and cue marks | **Partly**: beat level only | `episode_raw_clips.beat_marks` for whole-episode takes (needs migration `20261023235900`; `has_beat_marks` guards it). No `line_marks`, `cue_marks` or `voice_playback`. | GD-3 (soft: estimates otherwise) |
| A3 | PIP segments | **Specified only** | Takes in `episode_raw_clips` (`is_favorite`, `start_line`); chroma key keeps the audio. Picks live only in localStorage (`assembleTakes`). No segment, trim, layout, visibility or fallback. | GD-3, GD-7 |
| A4 | `StageRenderer` and `layoutAt` | **Specified only** | `StudioCanvas` (react-konva) exists; `PreviewMonitor` (DOM) and `videoRenderer` (node-canvas) are separate | GD-7 |
| A5 objects | Episode-scene objects, inheritance, stable ids | **Specified only** | `scene_assets` rows for scenes and for sets/angles exist separately. Row UUIDs are stable across Studio saves. A scene never reads its set's objects. No inheritance columns. | GD-3 |
| A5 Timeline | Timeline on the shared composition, `applyProposal`, lane API | **Specified only** | `TimelineEditor` edits legacy `scenes.characters`/`ui_elements` and the episode-level `timeline_data` JSONB. No proposal or lane interface. | GD-6, GD-7 |
| A6 | Dialogue lines: voice, approved source, status | **Partly** | `script_voice_clips` (recorded only; no status, source or voice). TTS exists only for Amber (ElevenLabs), with no cost tracking. No `speech_voice`. | GD-3, GD-7 |
| A7 | Cursor and hand hotspots; sound library | **Partly** | Asset role `UI.MOUSE.CURSOR` (`canonicalRoles`, S3 `ui/mouse/…`). No hotspot field. No sound library in code. Whether a "Grabbing Hand" overlay exists in production data is NEEDS CONFIRMATION. | GD-7 |
| A8 | Mix plan | **Not started** | No audio mixing anywhere; export has `// TODO: Add audio mixing` | GD-7 |
| A9 | Compositor | **Not started** (export phase) | The export worker draws one still per scene. The argument fix is on local branch `claude/export-job-args` (unpushed). | Export only |

**Unblocked now** (Rev 5 §14): GD-2 (trigger-based voice rules), GD-5 (closet decisions) and MLL-3 (the beat 9 rename). None of them needs any A-deliverable.

## 3. Remaining conflicts and gaps, with proposed resolutions

**C1. Object animation storage (SPV §2.1, §5.1).**
- SPV stores keyframes on `scene_assets.keyframes` and visibility timing on `start_timecode`/`end_timecode`.
- That gives the Stage rows Timeline data, against your point 1 and Rev 5 §2.
- It also cannot work with inheritance. An untouched inherited object has **no** episode-scene row (master rows are shared by every scene), so animating it would force a copy, and the copy would stop master updates.
- **Proposed:**
  - A Timeline-owned table, `timeline_items` (one migration), holds `id`, `episode_id`, `scene_id`, `kind` (`object_keyframe` · `object_visibility` · `camera_keyframe` · `angle_change` · `transition`), `target_id` (the episode-scene object id, or the angle id), the view it applies in, the anchor plus offset, values, `origin`, `approval`, `proposal_id` and `deleted_at`.
  - `timeline.applyProposal` validates and writes rows here. The accepted proposal records the row's `id` (Rev 5 §6.3 step 4).
  - Scene length stays `scenes.duration_seconds`; order stays `scene_number`.
  - `scene_assets.start/end_timecode` and `timeline_data.keyframes` stay as legacy and are read only by an adapter (R5: nothing dropped).

**C2. Episode-scene object ids (decisions doc §7.3, §11).**
- The decisions doc made references use `object_key` (the master id). Rev 5 says gameplay references **episode-scene object ids, never master ids**.
- **Proposed:** every object a scene shows has a stable **episode-scene object id**.
  - **Scene-only object:** its row `id`.
  - **Inherited object:** a **deterministic id**, `uuidv5(scene_id + ':' + object_key)`. It exists without a row, so untouched objects still inherit live. The first override row is created **with that same id**, and so is a detached copy (§12 of the decisions doc). The id therefore never changes across untouched → customised → detached.
  - **Views:** Front and Back share the id. Identity is per scene, not per view.
  - **When the master deletes an untouched object in a draft scene,** its id disappears. Gameplay and Timeline references to it become findings and `stale` proposals (Rev 5 §6.3). They are never silently re-pointed.
  - **Implementation:** the backend already depends on `uuid` (`^9.0.1`, which has v5; VERIFIED). The frontend does not (VERIFIED). So the server's resolver computes these ids and clients receive them from the API, and no frontend dependency is added. `object_key` remains internal, for inheritance only.

**C3. Two PIP data models (SPV §2.2 vs decisions doc §8.2).**
- SPV's `episode_performer_segments` (take, trim, anchor plus offset, layout, audio role) is the better base, because it reuses `episode_raw_clips`.
- Its **per-segment `visible`** breaks two of your rules:
  - a hide on a segment is lost when the take changes (a new segment replaces it);
  - nothing can be hidden in a beat that has no footage.
- **Proposed** (one design):
  - **segments** for take, trim, offset, layout overrides and audio gain;
  - **one `episode_pip_settings` row** per episode for the default layout (bottom-right, 28% width, G-5), `default_visible = true` and `fallback_asset_id`;
  - **`episode_pip_visibility`** rules (beat or anchored range, manual only, kept across take changes). This is the decisions doc's §8.2 rules table, trimmed.
  - The decisions doc's `episode_pip_tracks` and `episode_pip_layout` are dropped in favour of SPV's segments.

**C4. Line identity (SPV §2.3 vs decisions doc §3.3 vs Rev 5 §7.2).**
- SPV's key (beat + normalised text hash + occurrence) is deterministic and needs no storage. But **an edited line gets a new key**. That turns Rev 5 §7.2's "an override on an edited line is marked **check**" into "orphaned".
- The decisions doc's minted `line_id` survives edits, but needs a stored map that every one of about 25 script writers would have to maintain.
- **Proposed:** keep SPV's content-derived `line_key`, and add a pure **`matchLines(oldLines, newLines)`**.
  - It generalises the existing `nextLineIds` LCS: exact matches first, then pairing changed lines that sit between matched neighbours.
  - Consumers already store the `line_key` **and the text** they anchored to (overrides, voice clips, PIP marks). When the script changes, `matchLines` reports `kept` / `edited` (old key → new key) / `moved` / `removed` / `added`.
  - Rev 5's *kept*, *check* and *orphaned* follow directly, with no central id store and no migration.
  - The decisions doc's `line_id` is withdrawn.

**C5. A `cutscene` trigger class (decisions doc §3.4).**
- It contradicts Rev 5 §4: there are no beat-number exemptions, and an ordinary Lala line in beats 11–13 needs a click.
- **Proposed:** withdraw it, and adopt Rev 5's trigger table, including NPC triggers (`[UI:CLICK name]`, DM, `[TALK:]`) and click-free `Lala (V.O.)`. The decisions doc missed NPC triggers entirely.

**C6. "Recording wins" (SPV Q5).**
- It contradicts your rule that each line plays its **explicitly approved** source (Rev 5 §4.1).
- **Proposed:** withdraw Q5. Nothing is preferred by kind.

**C7. Automatic PIP freeze (SPV Q8 and R3).**
- It contradicts Rev 5 §3.2 and your earlier ruling: holding the frame is one of Evoni's choices on `line_overruns_gap`, never a default.
- **Proposed:** withdraw the recommendation.

**C8. Automatic timing adjustments (decisions doc §3.2, steps 1–3).**
- Step 3, "let the gameplay run under the next line", breaks G-1: the cursor rests during Lala and NPC lines.
- Steps 1–2 are generation choices inside G-1's natural-movement bounds. They are not corrections.
- **Proposed:**
  - Keep the cursor planning inside G-1.
  - Remove step 3.
  - Anything that still doesn't fit becomes a Rev 5 §3.2 finding (`anchor_outside_scene`, `line_overruns_gap`).
  - The decisions doc's Q-T1 (bounds) is answered by G-1 and closes.

**C9. Camera in the gameplay track (SPV §2.1).**
- SPV's "shots within a beat: the gameplay track's `camera.view`" is from Rev 3.
- **Proposed:** replace it with Rev 5 §6.3. Camera moves and Front/Back changes are proposals; once accepted they are `timeline_items` (C1).

**G1. Which renderer, Konva in Chromium or node-canvas.**
- SPV (R1, Q11) proposes headless-browser frames for the non-video layers plus FFmpeg for video. The decisions doc assumed node-canvas.
- Rev 5 §10 defers rendering infrastructure to the export phase.
- **Both approaches need the same pure `layoutAt(composition, t)`** (A4) and the same mix plan (A8). Those are what to build now. The drawer choice stays open until the export phase (SPV Q11).

**G2. What an approval freezes.**
- Rev 5 test 22 says a live data change after approval does not change the export. But the Rev 5 §8 snapshot holds only *game state*. The Stage composition, Timeline items, PIP segments and visibility, and the dialogue audio selection are read live.
- So, as written, editing the Timeline after approval **would** change the export.
- **Proposed:** the approved snapshot also stores the architecture's **resolved plan**: the resolved composition per scene, the Timeline items, the PIP plan and the mix plan. These are derived JSON produced by the architecture's own resolvers; the Director only stores and references them.
- That makes test 22 hold for every layer. **DECISION D1.**

**G3. Who knows which lines are "active".**
- Rev 5 §14 puts "which lines are active in the approved production" inside A6 (dialogue). But *active* means "the approved track plays it" (Rev 5 §4.1), and that is Director data (GD-6).
- **Proposed:**
  - A6 exposes source and approval per line.
  - The Director exposes the active set from the approved track.
  - The **export preflight** joins them to raise `line_audio_unapproved`.
- No ownership changes, and A6 is not blocked on GD-6.

**G4. Coordinates.**
- The decisions doc proposed fractions. SPV and every existing row use **pixels on the platform canvas** (1920×1080, `canvas_settings.platform`), and 9:16 is deferred (SPV Q12).
- **Proposed:** keep pixels on the platform canvas as the stored unit. `layoutAt` scales to the output.
- The decisions doc's fractions proposal is withdrawn. Legacy JSONB percentages are converted only by the adapter.

**G5. Legacy adoption on open (SPV §5.2).**
- SPV writes `scene_assets` rows from legacy JSONB automatically when a scene is opened.
- That writes data on read, and could duplicate objects a scene already has.
- **Proposed:** adopt only by an explicit "Adopt into Stage" action (after the read-only dry run), so opening never writes. **DECISION D2** (small).

**No conflict:**
- PIP visible by default in all 14 beats;
- layer order (Rev 5 §6.6: scene < PIP < phone < overlays < toasts < cursor < stats);
- Prime's voice only from her take;
- R5 (legacy performance tables kept until their readers move), which matches SPV Q4;
- master-deletion detach rules;
- Front/Back as `scene_angles` of one set (VERIFIED: `angle_kind` front/back on one `scene_set_id`).

## 4. Implementation sequence (minimum duplicated work)

Principles:
- Pure contracts first (no migration, no behaviour change).
- Then each owner's storage, as its own migration PR.
- Then each owner's interface.
- The Director only consumes finished interfaces.

GD-2, GD-5 and MLL-3 run in parallel throughout, since they have no dependencies.

| Step | PR | Kind | Delivers | Needs |
|---|---|---|---|---|
| 1 | **A1a: line keys and matching** (§5) | contract, pure | `lineKeys(script)`, `matchLines(old, new)`; server and frontend copies with a parity fixture | — |
| 2 | **A5a: composition resolver and episode-scene ids** | contract, pure | `resolveSceneComposition` (set → view → scene precedence, detach rules) and `episodeSceneObjectId`, tested on fixtures with **no** inheritance data yet (legacy scenes resolve exactly as today) | — |
| 3 | **A4a: `layoutAt`** | contract, pure | Pixel geometry at time `t` from the resolved composition, `timeline_items` and the PIP plan, as plain JSON | 2 |
| 4 | M-A1 | migration | `script_voice_clips.line_key`, `text_hash`, `source`, `status`, `character_key` (additive; backfill computed with A1a) | 1 |
| 5 | M-A5 | migration | `scene_assets` inheritance columns; `timeline_items` table | 2 |
| 6 | M-A3 | migration | `episode_performer_segments`, `episode_pip_settings`, `episode_pip_visibility`; `episode_raw_clips.line_marks`, `cue_marks`, `voice_playback` (A2) | 1 |
| 7 | A2 | feature | The teleprompter records line and cue marks | 6 |
| 8 | A3 | feature | PIP API and panel: segments from Assemble picks, layout, visibility, fallback and warnings | 6, 3 |
| 9 | A5b | feature | Studio and every `scene_assets` reader go through the resolver; inheritance editing; *Adopt into Stage* | 5, 2 |
| 10 | A5c | feature | The Timeline on `timeline_items`; `applyProposal`; the Gameplay lane API | 5, 9 |
| 11 | A6 | feature | Character speech voices; `speechService` (extracted from Amber) with budget tracking; approval per line | 4, D3–D5 |
| 12 | **GD-3** | Director core | Anchors, triggers, replay, findings, proposals (in memory) | 1, 7 (soft), 8, 9, 11 |
| 13 | A4b, A7, A8 | feature | `StageRenderer` used by Studio, Timeline and preview; hotspots and sound library; mix plan | 3, 9, 10 |
| 14 | GD-6, then GD-7 | Director | Storage, overrides, snapshots (with G2's resolved plan); preview player | 10, 13 |
| 15 | A9 and the export phase | export | Compositor, infrastructure | 14; B1 export fix first |

**Why this order avoids rework:**
- Steps 1–3 fix the interfaces (line keys, episode-scene ids, layout) that the storage PRs, the UI PRs and the Director all code against. None of them changes data or behaviour.
- Each migration lands before the feature that writes to it.
- GD-3 starts only after all four inputs it reads have real interfaces: line keys, PIP marks, resolved objects and dialogue sources.

## 5. The first small, independently testable architecture PR: **A1a, line keys and matching**

**Why first:**
- Every later owner keys on lines: voice clips (A6), PIP marks (A2/A3), Director anchors and overrides (GD-3/GD-6), and outdated detection.
- It is pure functions, with no migration, no route, no AI call and no change to existing behaviour.
- It touches only new files, so it cannot conflict with GD-2 (`scriptShowRules`, `scriptHealth`) or #3601.

**Scope:**
- New `src/utils/lineKeys.js` and `frontend/src/lib/lineKeys.js`. This follows the repo's existing server and frontend twin pattern, for example `src/utils/scriptShowRules.js` and `frontend/src/lib/scriptShowRules.js` (VERIFIED).
- **`scriptLines(scriptText)`**: the beats (`## BEAT:` headers) and their lines.
  - Every non-blank, non-header line is included: dialogue, directions, `[UI:]`/`[WEAR:]`/`[TALK:]` tags, and hidden cues such as `[LEARNS:]`.
  - Each line carries `{ beat, index, text, norm }`.
- **`lineKeys(scriptText)`**: adds `line_key = b<beat>:<hash>:<occurrence>`.
  - `hash` is a short, stable hash of the normalised text: whitespace collapsed, quotes and dashes unified, trailing spaces trimmed. Case and words are kept.
  - `occurrence` counts identical normalised lines earlier in the beat.
  - **The hash function is specified in the PR** (for example 32-bit FNV-1a, hex), so both copies agree.
- **`matchLines(oldLines, newLines)`**: returns `{ kept, edited: [{from, to}], moved, removed, added }`.
  1. Exact matches are made per beat by the same longest-common-run rule as `EpisodeScriptTab.nextLineIds`.
  2. An unmatched old line and an unmatched new line in the same gap between matched neighbours are paired as `edited`.
  3. Exact text that is unique in both scripts but in a different beat is `moved`.
- **`keyForStoredLine({ beat, line_text }, lines)`**: finds a stored line (for example a voice clip's `line_text`) in the current script. A later migration backfill uses it.
- **No caller is switched in this PR.**

**Dependencies:** none. `main` is at `93a7b74a`, which includes #3599. It does not need #3600 to merge, because it implements a contract the spec names.

**Acceptance tests** (both suites; one shared fixture: Episode 1 from `tests/fixtures/myLittleListEpisode1.js` plus edge cases):
1. **Parity:** the server and frontend copies give identical `lineKeys` and `matchLines` output on every fixture.
2. **Deterministic:** the same script always gives the same keys. Keys contain only `[a-z0-9:]`.
3. **Normalisation:** whitespace, curly-vs-straight quotes and dash variants don't change a key. Changing a word does.
4. **Insertion stability:** inserting a line above another leaves every other line's key unchanged. This is unlike today's positional `voiceClipsApi.lineKey`, and the test shows the difference.
5. **Duplicates:** two identical lines in one beat get `…:0` and `…:1`. Deleting the first makes the second `…:0`, and `matchLines` reports it as kept, not edited.
6. **Edited:** changing a word in line 3 gives `edited` with the old and new keys. Lines 2 and 4 are `kept`.
7. **Removed and added:** deleting a line reports `removed`; a new line reports `added`. Neither is paired as an edit when an exact match exists elsewhere.
8. **Moved:** a unique line moved from beat 4 to beat 5 reports `moved`.
9. **Coverage:** `## BEAT:` headers and blank lines get no key. `[UI:CLICK Voice Icon]`, `[WEAR: …]`, `[TALK: Nia]` and `[LEARNS: …]` lines do.
10. **Stored lines:** `keyForStoredLine` finds a voice clip's `line_text` after lines are inserted above it, and returns `null` (never a guess) when the text no longer exists.
11. **No behaviour change:** no existing file imports the new modules. The full backend and frontend suites pass unchanged, and so do lint and `/validate`.

## 6. Decisions that genuinely need you

| # | Decision | Recommendation |
|---|---|---|
| D1 | **What approval freezes (G2):** should an edit to the Stage, Timeline, PIP or dialogue selection *after* a scene is approved change the export? | No. The approved snapshot stores the resolved plan, and any later edit shows "inputs changed since approval" until you re-approve. This is what Rev 5 test 22 already says. |
| D2 | **Legacy scenes (G5):** adopt old Timeline objects into the Stage automatically on open, or only by your explicit action? | Explicit, after the dry-run report |
| D3 | **TTS provider and rights** (SPV Q6): ElevenLabs (Amber's account), a monthly cap, and confirmed commercial-use rights? | Confirm before A6 merges |
| D4 | **Changed line after approval** (SPV Q10): generate a new draft voice automatically, which costs money, or wait for your click? | Wait for a click. The line shows "changed since approved", and the old approved audio keeps playing in preview with the badge. |
| D5 | **Who assigns voices** (SPV Q7): once per character, on the character's page? | Yes |
| D6 | **Recording bleed** (SPV Q9): turn "Play voices" off while recording by default? | Yes, plus record `voice_playback` on the take |

**Already decided, so not asked again:**
- Build Scene = Scene Studio;
- inheritance;
- PIP look and visibility;
- deletion;
- Front/Back;
- fallback;
- precedence;
- G-1 to G-5;
- active-dialogue export block.

**Deferred by Rev 5:** the renderer drawer (SPV Q11 / G1), render infrastructure and 9:16.

**Document corrections waiting on your acceptance of this review:**
- **SPV:** withdraw C1, C3 (per-segment `visible`), C6, C7 and C9; G5 depends on D2.
- **Decisions doc:**
  - correct C2 (episode-scene ids), C4 (`line_id` → `line_key` plus `matchLines`), C5 (drop `cutscene`) and C8 (drop step 3);
  - correct G4 (fractions → pixels);
  - close Q-T1.
- **Rev 5 needs no change.** Two clarifications could be added: G2 (what the approved snapshot freezes), and G3 (where "active" is computed).
