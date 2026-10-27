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

> **Superseded by Revision 2, §R2.1.** Evoni chose durable `line_key`s stored with the script. `matchLines` stays, for recovery only.
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

> **Superseded by Revision 2, §R2.6.**

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

> **Superseded by Revision 2, §R2.5.** A1a stays first, but its content changes.

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

> **Answered by Evoni.** See Revision 2, §R2.0.

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

---

# Revision 2 (Evoni's decisions and two corrections, 2026-10-26)

**Status:** local review draft. Nothing implemented, pushed, merged or deployed.

**Basis:** `origin/main` `93a7b74a`.

Where Revision 2 disagrees with the sections above, Revision 2 wins.

## R2.0 Decisions recorded

| # | Evoni's decision | Effect on the plan |
|---|---|---|
| D1 | **Approval freezes the complete production.** Changes to the Stage, Timeline, PIP, voices, gameplay or assets never alter an approved export. | G2 closed: an immutable approved-production manifest (§R2.2). Export reads only a manifest. |
| D2 | **Old Timeline scenes are adopted only when Evoni chooses, after reviewing the proposed changes.** Never silently. | The adapter is a dry run that produces a per-scene **proposal** (objects, converted positions, anything it cannot place). Evoni accepts per scene. Opening a scene never writes (G5 closed). |
| D3 | **TTS provider deferred.** First specify voice assignment, approval, clip reuse, cost limits and commercial-use requirements. | A6 splits: **A6-spec** first (§R2.3), then a provider-neutral implementation. No provider code until the provider is chosen. |
| D4 | **No automatic regeneration when dialogue changes.** Mark the audio outdated, keep the approved clip, Evoni chooses when to regenerate. | Line audio state `approved → outdated` (§R2.3). Generation happens only on an explicit action. |
| D5 | **A default voice per character, with episode and line overrides.** | Voice precedence: line > episode > character (§R2.3) |
| D6 | **"Play voices" off by default while recording Prime; an explicit monitored-audio option for headphones.** | A teleprompter change (B8, §R2.6). Today `DEFAULTS.playVoice` is `true`, and a saved preference carries over (VERIFIED, `TeleprompterReader.jsx`). |

## R2.1 Correction 1: persistent, immutable `line_key`s with the one script

### What exists today (VERIFIED)

- **The script is one text column.** It is `episodes.script_content`, and nothing else holds line content.
- **About ten code paths write it, all through Sequelize, none through raw SQL** (VERIFIED: a grep for `SET … script_content` finds nothing):
  - `PUT /episodes/:id` (`episodeController`, the Script tab's Save and Restore with `restored_from`);
  - the script-locks route (`episodeController`);
  - the grounded generate (`episodeBriefRoutes`);
  - Script Writer `/lock` and generate (`episodeScriptWriterRoutes`, `episodeScriptWriterService`);
  - `generate-beats` (`episodes.js`);
  - skeleton script (`scriptAndBulk`);
  - Start Episode's draft (`episodeGenerate`);
  - batch (`episodeBatch`, through a static `Episode.update`, which **skips per-row model hooks**);
  - event inject (`inject.js`).
- **There is no single choke point.** `Episode` has no hooks (VERIFIED), and `snapshotScript` is called from 11 places but not from every write.
- **Today's line identity is session-only.**
  - The Script tab has `nextLineIds`: an LCS carry-forward guided by the editor's own splice and move operations. Its ids live **only in the browser session** (`line-1`, `line-2`, …), so a reload loses them (VERIFIED).
  - Voice clips are keyed by the position `(beat, line_index)`.

### Options considered

| Option | Durable | One script | Cost and risk | Verdict |
|---|---|---|---|---|
| A. Key derived from content (the earlier §5) | **No.** An edit changes the key, and identity is recovered only by matching. | Yes | Lowest | Rejected (Evoni) |
| B. Inline markers in the text (`⟦k:…⟧` on each line) | Yes | Yes (ids inside the text) | **High.** About 25 readers, the teleprompter, exports, AI prompts and imports would all have to strip them; AI generators rewrite text and drop them; a marker could leak to the screen or into a prompt | Rejected |
| C. A separate lines table holding the text | Yes | **No.** It becomes a second script. | High | Rejected |
| **D. A key list stored beside the text, in the same row** | **Yes** | **Yes.** The text stays the only content; the key list holds identity only. | Low: one additive JSONB column, written atomically with the text | **Recommended** |

### Recommended design (option D)

- **Storage.** One additive column, `episodes.script_line_keys JSONB`:
  ```
  { "v": 1, "text_hash": "<hash of script_content>",
    "lines": [ { "k": "ln_7f3k9q2m4x", "b": 4, "h": "<hash of the normalised line>" }, … ] }
  ```
  The `lines` array is aligned one-to-one with `scriptLines(script_content)`: every non-blank, non-header line in order. Hidden cues and `[UI:]` tags are included.
- **History.** The same column is added to `episode_script_versions`, so every snapshot keeps its keys (migration M-A1, additive).
- **Immutable and never reused.** A key is minted once, randomly (`ln_` plus 10 base-32 characters), and never changes for its line. A deleted line's key is **retired**. It survives in version history, and is never given to another line.
- **Same row, same transaction.** The text and its keys are written by one `UPDATE`. They cannot drift apart unless some writer leaves out the keys, which is covered next.

**One write path.** The text and keys are written by a single function, `saveEpisodeScript(episode, nextText, { transaction, hints, source })`, in A1c.
- **What it does:**
  - takes a row lock on the episode;
  - reconciles the keys (below);
  - writes `script_content` and `script_line_keys` together;
  - takes the version snapshot.
- **What moves to it:** all ten writers.
- **What stops new writers bypassing it:** a guard test, in the style of the repo's existing static lints (`scripts/lint-silent-catches.sh`). It fails CI if any file other than the service writes `script_content`.

**Reconciliation** is `reconcileLineKeys(prevEntries, nextText, hints)`, pure, in A1a. It is deterministic apart from minting a new key.
1. **Editor hints first.** The Script tab sends, with each save, the key of every line it still holds. It already tracks its lines through edits (`nextLineIds`); A1c seeds that from the server's keys instead of `line-N`.
   - A hinted key is accepted if it is live in the previous entries and used once.
   - **An edited line therefore keeps its key whatever its new words are.** This is the durable identity Evoni asked for.
2. **Then `matchLines`, for writers that send no hints** (AI regeneration, inject, import, an old client):
   - exact matches, per beat, by longest common run;
   - then edited-in-place pairing between matched neighbours;
   - then `moved` across beats.
3. **Anything still unmatched gets a new key.** An unmatched previous key is retired.

> **Revision 3, §R3.1: no repair on read.** The recovery paragraph below is superseded. A mismatch is detected and reported; only a controlled repair writes keys.

**Recovery.** A write that bypasses the service leaves `text_hash` different from `script_content`, for example a manual database edit or old code still running during a deploy. In that case:
- the next read runs the same reconciliation from the stored entries;
- it writes the repaired keys under the row lock;
- it logs the event.

Matching is therefore the recovery path, never the main one.

### How keys survive each situation

| Situation | What happens to `line_key`s |
|---|---|
| **Save** from the Script tab | Kept for every line the editor held (hints), even with entirely new words; minted only for new lines; retired for deleted lines |
| **Page reload** | The keys are stored in the episode row and returned with the script by the GET. The Script tab, teleprompter and every reader receive them, so nothing is recomputed in the browser. |
| **Substantial edit in the editor** (rewrites, reorders, splits) | Hints carry identity through any wording change. A **split** keeps the key on the first part and mints one for the second. A **merge** keeps the first line's key and retires the other. |
| **Whole-script regeneration (AI)** | Locked beats come back word for word (`scriptKeepingLocks`, VERIFIED), so they match exactly and keep their keys. Regenerated lines are matched where they are unchanged or edited in place; everything else is new content with new keys. Dependants anchored to retired keys go to review (Rev 5 §7.2: *check* / *orphaned*), never silently re-pointed. |
| **Restore a version** | The version's own `script_line_keys` are restored with its text, so the old keys come back exactly. Retired keys reappear only because the restored text is the same text. |
| **Import or paste a new script** | No hints, so matching applies. A summary is shown: "N lines kept their identity, M new". |
| **Writer bypass or old code** | Repaired on the next read (above) |
| **Concurrent saves** | A row lock plus the existing stale-save checks. The second save reconciles against the first one's keys. |

**Effect on the one-script rule.** None. `script_content` remains the only place line content lives. `script_line_keys` holds identity only, is valid only while its `text_hash` matches, and no reader takes text from it.

**What `matchLines` is used for:**
- recovery;
- writers that send no hints;
- the one-time backfill of `line_key` onto existing voice clips (`keyForStoredLine` from their `line_text`).

It is **never** used for lines the editor knows.

## R2.2 Correction 2: the immutable approved-production manifest

**What it is.** One immutable record of **everything an approved export uses**. Export, and "play approved" in preview, read **only** a manifest, never live tables (D1).

**Where it belongs and who owns it.**
- **Owner:** an architecture **Production Approval** service. It spans every owner, so no single owner can hold it.
- **Gameplay Director:** keeps owning its gameplay track versions and playback snapshots (Rev 5 §8). The manifest **references** them by immutable id plus content hash; it does not own them.
- **Each owner** provides a `freeze(episode, scenes)` function that returns its exact data, resolved, as JSON with content hashes. The approval service only collects, hashes, stores and points.

**Contents** (per scene, plus episode-level items):

| Part | Frozen as |
|---|---|
| Script | `script_content` text, `script_line_keys`, `script_locked_beats` and the script version id |
| Stage | The **resolved** composition per scene and per view used: episode-scene object ids, every resolved property, and asset references |
| Timeline | Every `timeline_items` row in scope (ids and values), scene order and durations, transitions |
| Prime PIP | Segments (take `raw_clip` id, trim, offsets, layout), visibility resolved to intervals, the fallback asset, and the take media references |
| Dialogue | For each **active** line: `line_key`, speaker, voice used, source (recorded or generated), clip id, media reference, duration and approval |
| Gameplay | The approved track version (id + hash) |
| Playback snapshot | The approved snapshot id + hash (Rev 5 §8) |
| Assets | Every file the export draws or plays (backgrounds, objects, phone screens and icons, cursor and hand, sounds, fallback, takes, voice clips), as **content-addressed** references (§below) |
| Derived plans | `layoutAt` keyframe plan and mix plan hashes, with the contract versions that produced them (for verification) |

**Asset immutability.** This is the part live data most easily breaks:
- Phone Hub icons are drawn by their **current** image, so changing an icon updates every placement (VERIFIED, PROJECT_CONTEXT §4.4, placements by icon key).
- S3 objects can be overwritten.

**Proposed:**
- **What gets copied.** At approval, every referenced file is copied **once** into a content-addressed prefix: `approved-media/<sha256>.<ext>`, deduplicated by hash and never overwritten. The manifest stores the hash and that key.
- **Large takes.** Large takes may be referenced by S3 `VersionId` instead, if bucket versioning is on (NEEDS CONFIRMATION, which only Evoni can check). Otherwise they are copied the same way.
- **What it costs.** Storage grows only with *distinct* approved files.

> **Revision 3, §R3.2–R3.3:** approval is a prepare/commit process, manifests are never deleted (the `deleted_at` allowance below is withdrawn), and media are always copied by content (no dependence on S3 versioning).

**Storage.**
- **Table** (new migration): `approved_production_manifests`
  - columns: `id`, `episode_id`, `version` (1, 2, 3 …), `supersedes_id`, `scope` (`episode` or the scene list), `body_sha256`, `s3_key`, `approved_by`, `approved_at`, `created_at`, `updated_at`, `deleted_at` (repo convention);
  - a database trigger refuses any `UPDATE` of the content columns and any `DELETE`;
  - the only permitted change is setting `deleted_at` on a manifest that no export references.
- **Body:** canonical JSON in S3 at `manifests/<episode>/<version>-<sha256>.json`, never overwritten.
- **Current pointer:** `episodes.approved_manifest_id`, the only mutable piece. Each move is logged.

**Re-approval creates a new version.**
1. Evoni re-approves an episode or a scene.
2. The service calls each owner's `freeze` for the scenes being re-approved, and copies the other scenes' entries **by value** from the current manifest (they are already immutable JSON).
3. It writes manifest `version + 1` with `supersedes_id = previous`, then moves `episodes.approved_manifest_id`.
4. **The previous manifest is never touched.** Earlier exports record the manifest id they used (in the export job and its result), so any past export can be traced and re-rendered from its own manifest.
5. **Outdated detection** compares each owner's live fingerprint with the manifest's stored hashes and shows "inputs changed since approval" (Rev 5 §7.2). Nothing changes until Evoni re-approves.

**What cannot be frozen.** Renderer code changes. The manifest records the contract versions (`layoutAt`, resolver, mix plan). A re-render under different contract versions is flagged before it starts.

**This is a gap in Rev 5, not a contradiction.** Rev 5 §8's snapshot stays the Director's game-state part. The manifest wraps it together with the other owners' frozen data, and Rev 5 test 22 then holds for every layer.

## R2.3 Voice specification (D3, D4, D5): provider-neutral, A6-spec

**Assignment** (D5). The precedence is **line override > episode override > character default**.
- **Character default:** `registry_characters.speech_voice` (SPV §2.3) holds `{ voice_ref, settings, rights_ref, assigned_by, assigned_at }`.
- **Episode override:** `episode_voice_overrides (episode_id, character_key, voice_ref, settings)`.
- **Line override:** keyed by `(episode_id, line_key)` on the dialogue line record.
- **What changing the assignment does:** the affected lines' approved clips become **outdated** (D4). Nothing is regenerated.

**Line audio states:**
- `none` → `draft` → `approved`;
- `approved` → **`outdated`** when the line's text hash, its assigned voice or its settings change. **The approved clip is kept** and stays playable with an Outdated badge until Evoni regenerates and approves a replacement, or re-approves it as it is (D4);
- `rejected`.

**Sources.**
- A line's source is `recorded` or `generated`. Each line plays only its **approved** clip (Rev 5 §4.1), and nothing is preferred by kind.
- Prime's lines have no dialogue source: they come from her take.

**Clip reuse.**
- A generated clip is identified by `(voice_ref, settings, normalised text)`.
- An approved clip with the same identity is offered for reuse on another line or episode **before** any generation. That saves money, and reuse still needs line approval.
- Recorded clips are reused only by explicit choice.

> **Revision 3, §R3.4:** paid generation stays off until the provider, rights and limits are each explicitly approved.

**Cost limits** (before any provider is chosen):
- Every generation is a non-token entry in `aiCostTracker`, which needs a characters/seconds cost path; the Amber TTS calls are not tracked today (VERIFIED, SPV V3).
- An estimate is shown before generating.
- There are a per-episode cap and a monthly cap, and refusal is visible.
- Generation happens only on an explicit action. No batch runs on save.

**Commercial-use requirements:** a voice can be assigned only with a `rights_ref`, which records:
- the provider plan permits monetised YouTube use;
- the voice is a stock voice, or a clone of a real person **with a recorded consent**;
- the date and terms version.

Generation is refused for a voice without one. The provider choice (D3) is made against this list.

## R2.4 D2 and D6 specifics

- **D2 adoption.** "Adopt into Stage" is an action on each legacy scene.
  - It shows the proposal: objects to create, positions converted from percentages and 960-px sizes to platform pixels, and anything it cannot place.
  - On **Accept** it writes `scene_assets` rows and records `canvas_settings.composition = 'scene_assets'`.
  - The legacy JSONB is kept, and export v1 keeps reading it until the scene is adopted.
  - The read-only dry run lists every scene.
- **D6 recording.**
  - When a take is recording **as Prime**, line voices are off unless **"Monitor voices in headphones"** is switched on for that take. That switch is explicit, is never inherited from the saved `playVoice` preference, and asks for confirmation.
  - The take records `voice_playback: { monitored, clips_played }` (migration M-A3), so the PIP panel can warn about possible bleed.
  - Rehearsal (not recording) keeps today's preference.

## R2.5 Does this change A1a? Yes: the content, not the position

> **Superseded by Revision 3, §R3.6** (the final A1a scope).

**A1a stays the first PR.** It is still pure, with no migration, no route and no caller switched. But it now produces the parts for **durable** keys, not content-derived keys:

| In A1a now | Notes |
|---|---|
| `scriptLines(text)` | The one definition of "a line": beats from `## BEAT:` headers; every non-blank, non-header line including tags and hidden cues; `{ b, index, text, norm, h }` |
| `normaliseLine`, `lineHash` | The hash algorithm is specified (for example 32-bit FNV-1a, hex) |
| `mintLineKey(random)` | `ln_` + 10 base-32 characters, with the random source injectable so tests are deterministic |
| `reconcileLineKeys(prevEntries, nextText, { hints, mint })` | Returns `{ entries, kept, edited, moved, retired, minted, rejectedHints }`: hints first, then `matchLines`, then mint |
| `matchLines(old, new)` | Recovery and no-hint writers only |
| `keyForStoredLine(stored, entries)` | For the voice-clip backfill; returns `null` rather than guessing |

**Copies.**
- **Server:** `src/utils/lineKeys.js`, which is authoritative for minting and reconciliation.
- **Frontend:** `frontend/src/lib/lineKeys.js`, with only `scriptLines`, `normaliseLine` and `lineHash`. The editor needs these to align lines with the server's key list and to build hints. It never mints.
- **Parity:** a test checks the two copies agree on the fixtures.

**A1a acceptance tests** (they replace the earlier list):
1. **Parity:** the server and frontend `scriptLines`, `normaliseLine` and `lineHash` agree on every fixture, including Episode 1 (`tests/fixtures/myLittleListEpisode1.js`, on `main`).
2. **Durable through edits:** with hints, every line keeps its key after rewording, reordering inside and across beats, splitting (the first part keeps it) and merging (the first line keeps it, the other is retired).
3. **Hints validated:** a hint that is unknown, retired or duplicated is rejected and reported, and that line goes to matching.
4. **No-hint matching:** the matching cases (unchanged, edited in place, moved, removed, added) give the expected `kept`/`edited`/`moved`/`retired`/`minted`.
5. **Never reused:** a retired key is never minted or assigned again in later reconciliations of the same history.
6. **Locked beats:** a beat returned word for word by a regeneration keeps every key without hints.
7. **Restore:** reconciling to a version's own entries returns exactly those keys.
8. **Deterministic:** the same inputs with a seeded `mint` give identical output.
9. **Coverage:** headers and blank lines get no key; `[UI:CLICK Voice Icon]`, `[WEAR:]`, `[TALK:]` and `[LEARNS:]` lines do.
10. **Stored lines:** `keyForStoredLine` finds a voice clip's `line_text` after insertions above it, and returns `null` when the text is gone.
11. **No behaviour change:** nothing imports the new modules; every existing suite, lint and `/validate` pass.

**What follows A1a:**
- **A1b (migration):** `episodes.script_line_keys` and `episode_script_versions.script_line_keys`, additive and nullable. Episodes without keys are keyed on first save or read.
- **A1c (wiring):**
  - `saveEpisodeScript` used by all ten writers;
  - the guard test;
  - GET returns the keys;
  - Script tab hints, with `useLineIds` seeded from server keys;
  - recovery on read.
- **A1d:** the `script_voice_clips.line_key` backfill (the former M-A1).

## R2.6 Updated sequence

| Step | PR | Kind | Needs |
|---|---|---|---|
| 0 | B1 export arguments (local), **B8: D6 recording default and the monitored option** (teleprompter), GD-2, GD-5, MLL-3 | bug fixes and independent work | — |
| 1 | **A1a** line identity contract (§R2.5) | pure | — |
| 2 | A5a composition resolver and episode-scene ids; A4a `layoutAt` | pure | — |
| 3 | **A10a manifest contract:** canonical JSON, hashing, the `freeze` interface each owner implements, manifest schema | pure | 1, 2 |
| 4 | A1b, then A1c | migration, then wiring | 1 |
| 5 | M-A5 (inheritance columns, `timeline_items`), M-A3 (PIP tables, take marks, `voice_playback`) | migrations | 2 |
| 6 | A2 marks; A3 PIP; A5b Stage and D2 adoption; A5c Timeline with `applyProposal` | features | 4, 5 |
| 7 | **A6-spec** (§R2.3) approved by Evoni, then A6a provider-neutral voice assignment, states, reuse and cost paths, then A1d backfill | spec, then feature | 4 |
| 8 | GD-3 Director core | Director | 4, 6, 7 (no provider needed: approved sources may all be recorded) |
| 9 | A4b StageRenderer, A7, A8 mix plan | features | 6 |
| 10 | **A10b manifest service:** migration, trigger, content-addressed media copy, `approved_manifest_id`; every owner's `freeze` | migration + feature | 3, 6, 7, 9 |
| 11 | GD-6, GD-7 (snapshots register into manifests) | Director | 10 |
| 12 | Export phase: the compositor reads only manifests | export | 11, B1 |
| later | A6b TTS provider adapter, once D3 is decided against §R2.3 | feature | D3 |

**Why the manifest contract is early (step 3):** every owner's storage PR (steps 4–7) can then add its `freeze` function and hash test in the same PR. That avoids a later pass over every owner.

## R2.7 Decisions still needing Evoni

- **D3 provider:** deferred by Evoni. First, approve the §R2.3 voice specification (assignment, states, reuse, caps, rights).
- **Caps:** the per-episode and monthly TTS amounts, once a provider exists.
- **Media freezing:** is S3 bucket versioning on for the media buckets? If not, approved takes are copied, which means storage cost (NEEDS CONFIRMATION by Evoni; a session cannot check).
- **Manifest deletion:** may an approved manifest that no export used ever be deleted (soft), or are manifests permanent?

---

# Revision 3 (Evoni's final safeguards, 2026-10-26)

**Status.** Local review draft. Nothing is implemented, pushed, merged or deployed.

**Approved by Evoni:**
- persistent line keys;
- one authoritative script;
- centralised script saves;
- an immutable approved-production manifest;
- the R2.6 sequence.

Revision 3 adds five safeguards. Where it disagrees with R2, R3 wins.

## R3.1 Script key integrity

**Reading never writes.** A read of the script, or of its keys, compares `script_line_keys.text_hash` with `script_content` and returns one of these statuses:

| Status | Meaning | Readers get |
|---|---|---|
| `ok` | The keys match the text | Keys |
| `unkeyed` | The episode has never been keyed (it predates A1) | No keys. Readers behave as today: voice clips by position, and the editor's session ids. |
| `mismatch` | The text changed without its keys: an old writer, a manual edit, or a header-rule change | **No keys**, the same as `unkeyed`, plus a visible report: "Line identities need checking" |

**Keys are written in only two places:**
1. **`saveEpisodeScript`**, on a save Evoni or a generator makes. It works only when the stored keys are `ok`. When the episode is `unkeyed`, the first save keys it; nothing existed to repair, so this is initial keying.
2. **The controlled repair**, `POST …/script/line-keys/repair`, which needs `requireAuth`:
   - **Step 1, the dry run** (default). It returns what reconciliation would do: kept, edited, moved, minted and retired lines, and any hints refused.
   - **Step 2, the apply.** It runs only with an explicit `confirm`, and with the dry run's `plan_hash`, so it applies exactly what was shown.
   - **Effect.** It writes only `script_line_keys`, never the text, under the episode row lock. It records a version snapshot with `source: 'line-key-repair'` and logs the counts.

**A save while the status is `mismatch`:**
- The text is saved, because the script is never blocked.
- The keys stay `mismatch`. No reconciliation is guessed during the save.
- The save response carries the mismatch report. The only way out is the repair.

**Retired-key history is kept and never reused.**
- **Where it lives.** `script_line_keys` holds `retired: [{ k, h, b, retired_in }]`. This list only ever grows. Every write (save, generation, import, repair, restore) merges the stored list with any newly retired keys, so it never shrinks.
- **Version snapshots keep it too.** `episode_script_versions.script_line_keys` stores the whole object, `retired` included.
- **Minting is checked.** A new key is checked against every key the episode has ever had: live, retired, and every key in its versions. If it collides, it is minted again.
- **Restore** reinstates a key only for the **same dialogue**. A version's entry `(k, h)` is reinstated only where the restored line has that same hash `h`, which it has by construction because it is that version's text. Every reinstated key is removed from `retired`. A key retired in the current history that the restored text does not contain stays retired.
- **Import or paste** of a whole script sends no hints. Lines are matched (`matchLines`); everything else is minted. A retired key is **never** matched to a new line, because matching considers only live keys.
- **Regeneration** works the same way: locked beats keep their keys, and new content gets new keys.

## R3.2 Atomic production approval: prepare, then commit

**Rule.** A manifest is published, and the approved pointer moves, only after **every** required input has been validated and frozen. Any failure leaves the pointer and the published manifests exactly as they were.

**Tables** (approval migration, A10b):
- `approved_production_manifests`: committed manifests only, immutable (R3.3).
- `production_approval_preparations`:
  - columns: `id`, `episode_id`, `scope`, `status` (`preparing` · `ready` · `committed` · `failed` · `expired`), `expected_manifest_id` (the pointer when preparation began), `inputs_fingerprint`, `staged_body_key`, `media_refs` (content hashes copied), `errors`, `started_at`, `finished_at`, `created_at`, `updated_at`, `deleted_at`;
  - a partial unique index allows **one** active (`preparing` or `ready`) preparation per episode.

**Prepare** (it can fail at any step; nothing is published):
1. **Start.** Record the preparation, `expected_manifest_id` and the inputs fingerprint (each owner's fingerprint).
2. **Freeze.** Call every owner's `freeze(episode, scope)`. The database reads happen in one `REPEATABLE READ` transaction, so every owner sees the same moment.
3. **Validate the required inputs.** Each item below either freezes or fails with a named error:

   | Required | Fails when |
   |---|---|
   | Stage objects | A referenced object or asset is missing; the scene is not adopted (D2) |
   | Timeline items | One is invalid (references a missing object or angle); a scene has no duration |
   | PIP | A beat with Prime visible has neither a frozen take segment nor a **fallback Evoni accepted** (Rev 5 / missing-footage ruling); the take media cannot be read |
   | Dialogue clips | An **active** line has no approved clip, or its clip is outdated and not re-approved (D4); the media cannot be read |
   | Gameplay | No approved track version, or no approved playback snapshot for the scope |
   | Assets | Any referenced file cannot be read or copied |
   | Script | The line keys are not `ok` (R3.1) |

4. **Copy media** into content-addressed storage (R3.5). Each copy is put-if-absent, then re-read to verify its sha256.
5. **Stage the body.** Write the canonical JSON to a **staging** key, re-read it, verify its hash, and mark the preparation `ready`.

**Commit** (one database transaction):
- Lock the episode row.
- Check that `episodes.approved_manifest_id` still equals `expected_manifest_id` (compare-and-swap).
- Check that the inputs fingerprint is unchanged since the freeze.
- Then:
  1. copy the staged body to its final immutable key (verified);
  2. insert the manifest row (`version + 1`, `supersedes_id`);
  3. move the pointer;
  4. mark the preparation `committed`.

  These four steps happen together or not at all.

**If a commit check fails:** the preparation becomes `failed`, with the reason ("approval changed meanwhile" or "inputs changed during approval"). The pointer does not move. Evoni approves again.

**Cleanup of incomplete preparations** (a scheduled job, also runnable by hand):
- A preparation stuck in `preparing`/`ready` past a time limit becomes `expired`.
- The staging bodies of `failed` and `expired` preparations are deleted.
- A media copy is deleted only when **no committed manifest** and **no active preparation** references its hash. A copy any manifest references is never deleted (R3.3).
- Cleanup never touches committed manifests or the pointer.

**Exports and preview.** Export and "play approved" read only a committed manifest, by id, and every export records the manifest id it used.

## R3.3 Manifest retention

- **Approved manifests are never deleted automatically,** whether or not an export used them. **Superseded versions stay available** for reproducibility.
- **Enforced in the database.** The trigger refuses `DELETE`, and refuses every `UPDATE`, including setting `deleted_at`. The column is kept only for the repo's migration convention. This **withdraws R2.2's allowance** to soft-delete an unused manifest.
- **Media lasts as long as its manifest.** Media referenced by any committed manifest is retained just as long.
- **Archiving is designed later.** An archive or retention policy is a later, separate design. Until then, nothing removes a manifest or its media.

## R3.4 Voice generation stays off

The A6-spec (R2.3) is provider-neutral, and covers:
- assignment (character default, then episode, then line);
- audio states, including outdated (D4);
- reuse before generation;
- the rights record;
- the cost paths.

**Without any provider,** A6a delivers voice assignment, the recorded-clip flow, approval, the outdated status and reuse. All of that works with recorded clips alone.

**Paid generation stays disabled.** The generation endpoint refuses with a clear reason unless **all three** of these exist, each recorded with who approved it and when:
1. **An approved provider**, set in server configuration. Evoni sets it; a session never does.
2. **An approved rights record** for the voice (R2.3).
3. **Approved spending limits**: per episode and monthly amounts, configurable and stored, never hard-coded.

The default is "off". No code path generates paid audio implicitly: not on save, not on approval, and not in a batch.

## R3.5 Media storage

- **Default:** immutability **never depends on S3 versioning**. Every approved file is copied into content-addressed storage (`approved-media/<sha256>.<ext>`), written put-if-absent, verified by re-reading, and never overwritten. This applies to takes too, which withdraws R2.2's "reference by `VersionId`" option.
- **Versioning check:**
  - **What to check.** Whether the media buckets have S3 versioning enabled. It is useful to know, as extra protection against accidental overwrites of *live* media, but the design does not rely on it.
  - **Who checks.** `CLAUDE.md`'s read-only `aws` allowance does not include `s3api get-bucket-versioning`, so **a session cannot check it**. Evoni checks it in the AWS console, or approves adding the call to the read-only list.
  - **Recorded as** NEEDS CONFIRMATION. It is not a dependency.
- **Storage cost.** It grows only with distinct approved files, deduplicated by hash.

## R3.6 Final A1a scope

**Name.** A1a: the line identity contract, pure functions.

**Files** (all new):

| File | Contents |
|---|---|
| `src/utils/lineKeys.js` | The authoritative copy: `scriptLines`, `normaliseLine`, `lineHash`, `checkLineKeys`, `mintLineKey`, `reconcileLineKeys`, `matchLines`, `restoreLineKeys`, `keyForStoredLine` |
| `frontend/src/lib/lineKeys.js` | Read-only twin: `scriptLines`, `normaliseLine`, `lineHash`, `checkLineKeys`. It never mints or reconciles. |
| `tests/unit/utils/lineKeys.test.js` | Server tests |
| `frontend/src/lib/lineKeys.test.js` | Frontend tests |
| `tests/fixtures/lineKeysScripts.js` | Shared fixtures (edge cases). It reuses the existing `tests/fixtures/myLittleListEpisode1.js` read-only. |

**What each function does:**
- **`scriptLines(text)`**: the single definition of a line.
  - Beat headers are recognised and numbered by the **existing** `normalizeBeatHeaders` and `headerNumber` (`src/utils/beatLabelNumber.js` and its frontend twin). These are imported read-only and not modified, so line beats agree with the Script tab and beat locks.
  - Every non-blank, non-header line is a line, including `[UI:]`, `[WEAR:]`, `[TALK:]` and `[LEARNS:]`.
  - Text before the first header (the preamble, for example `[EVENT:]`) is beat `0`.
  - A script with no headers puts every line in beat `null`.
  - Returns `{ b, index, text, norm, h }`.
- **`normaliseLine` / `lineHash`.**
  - Normalisation: CRLF to LF, whitespace collapsed, quotes and dashes unified, trailing space trimmed. Case and words are kept.
  - Hash: 32-bit FNV-1a, 8 hex characters, specified in a header comment so both copies agree.
- **`checkLineKeys(text, stored)`**: returns `ok` · `unkeyed` · `mismatch` (R3.1). It is pure and never repairs.
- **`mintLineKey(rand, taken)`**:
  - Returns `ln_` + 10 base-32 characters.
  - `rand` is injected, for deterministic tests.
  - `taken` is every key ever used. On a collision it mints again.
- **`reconcileLineKeys(stored, nextText, { hints, rand, history })`**:
  - Order: hints first (validated), then `matchLines` over **live** keys only, then mint.
  - Returns the new `script_line_keys` object (lines, `text_hash`, `retired` merged so it only grows) and a report: kept, edited, moved, minted, retired, refused hints.
- **`restoreLineKeys(current, versionKeys, versionText)`**: reinstates a version's keys only where `(k, h)` matches. It keeps every other retired key retired (R3.1).
- **`matchLines(oldLines, newLines)`**: exact matches per beat by longest common run (the `nextLineIds` rule), then edited-in-place pairing between matched neighbours, then `moved` for unique exact text across beats.
- **`keyForStoredLine(stored, entries)`**: finds a stored `line_text` (for example a voice clip's). Returns `null` rather than guessing.

**Not in A1a:**
- **No storage:** no migration, no column, no model change.
- **No new or changed interface:** no route, no controller.
- **No caller switched:** no existing file imports the new modules, so no writer, reader, teleprompter or Script tab code changes.
- **No change to the reused helpers:** `beatLabelNumber.js` is unmodified.
- **Nothing external:** no AI call, no configuration.

## R3.7 A1a acceptance tests

1. **Parity:** the server and frontend `scriptLines`, `normaliseLine`, `lineHash` and `checkLineKeys` give identical output on every fixture, including Episode 1.
2. **Header rules match the Script tab:** for `## BEAT: 5 · Reveal`, `## Beat 5: Reveal`, `### BEAT: 5`, the bold variants, a name-only canonical header and CRLF text, line beat numbers equal `headerNumber`'s. The preamble is beat 0.
3. **Coverage:** headers and blank lines get no entry; tag and hidden-cue lines do.
4. **Normalisation:** whitespace, quote and dash variants keep the hash; a changed word changes it.
5. **Hints keep identity:** with hints, every line keeps its key through rewording, reordering within and across beats, a split (the first part keeps it) and a merge (the first line keeps it, the other is retired).
6. **Hints are validated:** an unknown, retired or duplicated hint is refused and reported, and that line goes to matching.
7. **No-hint matching:** unchanged, edited-in-place, moved, removed and added lines give the expected `kept`/`edited`/`moved`/`retired`/`minted`.
8. **Retired history only grows:** across a sequence of saves, imports and restores, `retired` never loses an entry unless that exact `(k, h)` is reinstated by a restore.
9. **Never reassigned:** a retired key is never given to a line with a different hash, after edits, a full-script import, or a restore of a different version. Minting never returns any key in `taken`.
10. **Restore:** restoring a version reinstates its keys exactly for its lines. Keys retired since, which that version's text doesn't contain, stay retired.
11. **Locked beats:** a beat returned word for word by a regeneration keeps every key without hints.
12. **Integrity check:** `checkLineKeys` returns `ok` for matching text, `unkeyed` for no stored keys, and `mismatch` for text changed without keys. It never returns repaired keys.
13. **Deterministic:** the same inputs with the same injected `rand` give byte-identical JSON.
14. **Stored lines:** `keyForStoredLine` finds a stored `line_text` after insertions above it, and returns `null` when the text is gone or ambiguous.
15. **No behaviour change:** `git grep` finds no import of `lineKeys` outside the new tests. The full backend and frontend suites, ESLint, `scripts/lint-silent-catches.sh` and `/validate` pass unchanged. A production build (`npx vite build`) contains no `lineKeys` code, because the module is imported nowhere.

## R3.8 Dependencies, independence and production impact

**Dependencies:**
- `main` at or after `93a7b74a`, which has #3599 merged.
- The existing `beatLabelNumber.js` twins, read only.
- Nothing else.

It does **not** need:
- #3600 (the spec) merged;
- any other architecture PR;
- any migration or Deploy-workflow run;
- any decision still open (voice provider, caps, S3 versioning, archiving).

**Independence:**
- **Code:** A1a is completely independent. It adds new files only.
- **Overlap with open work:** it overlaps no file touched by GD-2 (`scriptShowRules`, `scriptHealth`), #3601 (My Little List Phase 2) or the export fix branch.
- **Downstream:** it is the dependency of A1b/A1c/A1d, the voice-clip backfill and GD-3. It depends on none of them.

**Production behaviour:** none.
- **Backend:** no existing file requires the new module, so the server never loads it. `src/app.js`, routes, models and services are untouched.
- **Frontend:** no page imports the new module, so Vite leaves it out of the bundle, and the deployed bundle's behaviour is unchanged.
- **Database, configuration, AWS:** no table, column or configuration is touched, and there is no call to AWS, S3 or any provider.
- **Its only effect is new tests in CI.**

**Once A1a merges, behaviour changes only with later, separately approved PRs:**
- A1b (migration, run through the Deploy workflow by Evoni);
- A1c (the central save, the guard test, read status, the controlled repair, Script tab hints).

## R3.9 A1c requirements (Evoni, 2026-10-26, on approving the A1a PR)

A1a is PR #3603 (`claude/a1a-line-keys`, `61ec633f`): five new files, unused by production callers. A1c needs its own approval, and when it comes it must meet these four requirements:

1. **Valid editor-provided keys always take precedence over text matching.** `reconcileLineKeys` already applies hints first. A1c's save path must pass the Script tab's keys for every line it holds.
2. **Ambiguous or low-confidence matches never silently reuse an existing key.**
   - **What A1a already does:** it pairs a line as "edited" only when the previous text is known and in step with its keys, and at least half its words match. Otherwise the line gets a new key. `keyForStoredLine` returns `null` when it is unsure.
   - **What A1c adds:** it shows what was matched, never applying it silently.
3. **Settle how scripts without beat headers behave before connecting persistent keys to the Script tab.** Today the Script tab shows a script with no headers as up to 14 beats by position, while A1a gives those lines no beat. Identity does not depend on the beat, but the beat shown and the beat stored must agree first.
4. **Out-of-step keys need a controlled repair or explicit conflict resolution before an ordinary save goes ahead.**
   - This **replaces R3.1's "a save while the status is `mismatch` saves the text and leaves the keys as `mismatch`"**.
   - In A1c, a save on a `mismatch` episode is held: either a repair or an explicit conflict resolution happens first, and then the save completes. The text is never changed while its identity record is stale.
