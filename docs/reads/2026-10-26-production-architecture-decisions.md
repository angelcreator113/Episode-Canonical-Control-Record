# Prime Studios — Production architecture: approved direction, rules and contracts (read)

**Status:** architecture proposal. This document records Evoni's approved direction and product rules (2026-10-26). It answers her eight pre-implementation questions and gives the dependency-aware sequence. **Nothing here is implemented.** Each step listed in §5 is its own reviewable change, and each needs its own approval to push, open a PR, merge or deploy.

**Basis:** `origin/main` `390de42b` (code facts unchanged from `cb02c6a7`). It builds on `2026-10-26-production-system-audit.md` and `2026-10-26-production-system-audit-followup.md`, and where this document disagrees with them, this document wins.

**Not revised here:**
- **The Gameplay Director companion plan.** It is not in this repository, on any branch, or in any PR or issue (searched 2026-10-26). Its rules from Evoni's review are recorded in §1–§2 so that whoever revises it works from them. The plan itself needs to be shared before it can be revised.
- **My Little List** (PR #3599). It stays separate.

**Labels:** VERIFIED (read in code) · INFERRED · PROPOSED (design, not yet approved) · NEEDS CONFIRMATION.

---

## 1. Approved direction (Evoni, 2026-10-26)

1. **One script.** There is one authoritative episode script: `episodes.script_content`, written from the Script tab.
2. **Script Writer features stay.** The Script Writer's useful features (franchise check, Wardrobe Intelligence, rule counting, the structured view) move into that one workflow. No competing script is created.
3. **One Stage.** Scene Studio and the Timeline share one Stage foundation.
4. **Prime's PIP.** Prime is Evoni's own recorded footage, shown in an editable picture-in-picture (PIP) layer.
5. **Voices.** Lala and NPCs use assigned or generated voices. Each line's voice needs explicit approval, and its source is tracked.
6. **The Gameplay Director** generates most interactions automatically.
7. **Same data everywhere.** Preview and export use the same authoritative production data.

## 2. Product rules: changes to the earlier recommendations

| # | Rule | Replaces |
|---|---|---|
| R1 | **Scene-set objects are inherited as defaults, with scene-specific overrides.** A customised scene composition is never overwritten. | Follow-up §2 "base layer or copy" (Q-ST1, now answered) |
| R2 | **Prime's PIP is visible by default and can be edited beat by beat and by timeline segment** (§8). No beat range is hard-coded as hidden. Today's `isCutsceneBeat` (beats 11–13, `frontend/src/lib/scriptShowRules.js`) is a *script and voice* rule (VERIFIED). It must not be reused as PIP visibility. | Any plan text hiding the PIP in beats 11–13 |
| R3 | **Prime's PIP is never frozen automatically when dialogue runs long.** Timing conflicts are resolved by the strategy in §3.2, and anything left unresolved is shown as a warning. | Any automatic freeze |
| R4 | **Voice playback uses the approved source for each line.** Recordings are not automatically favoured over generated speech. | The current teleprompter behaviour, which plays the line's voice clip whenever one exists (`useLineVoice`, VERIFIED), and any plan text that favours recordings |
| R5 | **Legacy performance tables are not retired** until their data and every reader are safely migrated. This covers `episode_raw_clips`, `episode_performance_clips`, `script_voice_clips`, `audio_clips`, and animatic `character_clips`/`dialogue_clips`. | Follow-up §6 step 4 "retire", for performance data. The unused *timeline* stores are frozen first and also retired only after a reader inventory. |
| R6 | **Regenerating a production draft keeps the user's adjustments.** This covers camera placement, timing, gameplay and audio. | Every regeneration path (§3.1) |

---

## 3. Shared mechanisms (PROPOSED) that the answers rely on

### 3.1 Provenance on every production element

Every element in these layers carries the same five fields:
- the Stage (`scene_assets`, the PIP placement);
- the Gameplay track (actions);
- the Timeline (keyframes, segment in and out points);
- the audio plan (line → source).

| Field | Meaning |
|---|---|
| `origin` | `generated` · `inherited` (from a scene set or angle) · `manual` |
| `overrides` | The set of fields the user changed (for example `{x, y}` or `{offset_ms}`). Field-level, not row-level. |
| `approval` | `draft` · `approved` (with who and when) |
| `derived_from` | `{ kind, id, fingerprint }`: the inputs and their hash when the element was generated or inherited |
| *computed* `outdated` | True when the current fingerprint of the inputs differs from `derived_from.fingerprint` |

**Regeneration rule (R6).**
1. Regenerating recomputes only generated values.
2. Fields listed in `overrides` are kept.
3. An **approved** element is never changed in place. It is marked Outdated, with a proposed replacement shown as a difference, and Evoni picks "Use new" or "Keep mine".
4. An element whose input disappeared, such as a deleted line or a removed master object, is marked **Orphaned** and kept with a warning. It is never silently deleted.

This generalises mechanisms that already exist (VERIFIED):
- `scene_plans.locked` and `chosen_by_user`
- `scriptBeatLocks.scriptKeepingLocks`
- `styleSheetService` `inputs_hash` / `stale`
- `eventDocumentOverlayService.overlayState` → `'outdated'`
- the voice clips' "line changed since recorded" (`script_voice_clips.line_text`)

### 3.2 Timing: anchors, not absolute seconds

- **What gets an anchor.** Each gameplay action, PIP segment edge, keyframe and audio placement is stored as an **anchor plus an offset**. The anchor is one of: line start or end, an action's start or end, or beat start or end.
- **What holds the absolute times.** The anchors resolve to absolute times against the **approved Prime take's measured marks**.
- **Where user changes live.** A user's timing adjustment is stored as an `offset_ms` override on top of the anchor.

**Resolution order** when a beat's gameplay needs more time than the dialogue gives it (R3):
1. Use slack inside the allowed bounds. Shorten cursor travel down to a minimum speed, and reading holds down to a minimum read time.
2. Start the gameplay earlier, where the previous line allows an overlap.
3. Let the gameplay run under the next line, if that line is not gameplay-dependent.
4. **Otherwise stop and warn.** The warning reads "Beat 6: gameplay needs 2.4 s more than the take". Evoni chooses one of:
   - extend with a Lala reaction or hold,
   - trim a pause in the take,
   - move the action,
   - accept a held frame.

   Nothing is frozen automatically.

When the dialogue is longer than the gameplay, the cursor rests. That is not a conflict.

**Marks today** (VERIFIED):
- Only beat-level `beat_marks`, which need migration `20261023235900`.
- Per-line marks do not exist.

**Until per-line marks exist:**
- Anchors inside a beat resolve **proportionally** within the beat.
- They are labelled "estimated timing".

### 3.3 Line identity

- **Every script line gets a stable `line_id` plus a text hash.**
  - The parser assigns them.
  - On every save they are carried forward by matching against the previous version, the same way `snapshotScript` already keeps versions.
- **The `line_id` is the key for every line-level link:** voice clips, the audio plan, gameplay anchors and the PIP.
- **This fixes a real defect.** Today voice clips are keyed by `(episode, beat_number, line_index)` (VERIFIED, `scriptVoiceClipsService.js` header). Inserting a line above a recorded one shifts every index below it, so the clips attach to the wrong lines (INFERRED from the key).

### 3.4 Lala line triggers, from the existing show rule

`scriptShowRules.voiceOffLines`, used by `scriptHealth` (VERIFIED, Evoni's rule of 2026-10-17), already decides per line whether Lala may talk:
- after `[UI:CLICK Voice Icon]` in that beat;
- answering a `NOTIFY`/`DM`/`NOTIFICATION`;
- while she is being dressed (the closet is open);
- in the cutscene beats.

It runs only in the frontend. The contract moves it into the shared parser and gives every Lala line one `trigger`:

| `trigger` | Source rule | What the Gameplay Director does |
|---|---|---|
| `voice_click` | The line follows `[UI:CLICK Voice Icon]` | Generates the cursor move and the click on the Voice icon's tap zone before the line |
| `notification_reply` | She answers a notification or message | Anchors the line to that notification action. No click. |
| `wardrobe_reaction` | She is being dressed | Anchors the line to the equip action. Automatic. |
| `auto_reaction` | `Lala (auto):` lines (teleprompter screen cue, VERIFIED) | Anchors to the action before it. Automatic. |
| `cutscene` | `isCutsceneBeat` | No gameplay. **The PIP is unaffected (R2).** |
| `violation` | She talks with none of the above | A Script health warning. The Director does not invent a click. |

---

## 4. Answers to the eight questions

### Q1. How does a master Scene Set update existing scenes without overwriting local changes?

> **Superseded in detail by §7** (Evoni's Scene Set inheritance ruling, later on 2026-10-26). The summary below still holds; §7 is the design and §10 has the acceptance tests.

**Today** (VERIFIED):
- **The set's objects never reach a scene.** Scene Studio stores set and angle objects in `scene_assets` keyed by `scene_set_id`/`scene_angle_id`, but an episode scene's `getCanvas` reads only `where: { scene_id }`.
- **The background is overwritten.** `syncBeatScenes` rewrites `scenes.background_url` from the angle on every export (`export.js` → `syncBeatScenesQuietly`), and the Timeline save writes `background_url` too. Either can overwrite a background chosen in the Studio (INFERRED).

**Proposed** (R1):
- **Composition.** A scene's composition is *the master objects* (from the set and angle) with *the scene's overrides* laid over them.
- **Scene-level rows come in three kinds:**
  - an **override row**, with `inherits_from_asset_id` and only the changed fields in `overrides`;
  - a **hidden marker** (the master object is hidden in this scene);
  - a **scene-only object**.
- **Fields nobody overrode follow the master automatically** and immediately, because they are inherited when read, not copied.
- **If the master changes a field that a scene overrode,** the scene keeps its value and shows **"Master changed under your edit"**, with *Take master* / *Keep mine*.
- **If a master object is deleted,** its override rows become **Orphaned**. They stay visible with a warning.
- **The background follows the same rule.** It is inherited from the angle unless the scene overrides it. `syncBeatScenes` and the Timeline save must stop writing an overridden background. That is a bug-fix PR that can land before the Stage work.

This needs a migration that adds the inheritance columns to `scene_assets`.

### Q2. What happens when I change Prime's approved take after gameplay timing has been generated?

- **Changing the approved take is itself an approval action.** The take becomes the new timing reference.
- **Every anchored element is re-resolved** against the new take's marks (§3.2).
- **Adjustments carry over.** The user's `offset_ms` overrides are kept on top of the new anchors.
- **Approved timing elements move only by their anchors.** Their offsets never change. They are marked "retimed" for review.
- **The system reports a summary,** for example "14 actions moved; 2 conflicts":
  - **Conflicts:** an anchor line not found in the new take, an action that now runs past the beat, or an overlap.
  - Conflicts are listed as warnings and are not fixed automatically.
- **If the new take has only beat-level marks,** the timing inside each beat is estimated proportionally and labelled.
- **The previous take stays available.** Switching back restores the earlier resolution exactly, because the anchors and offsets are unchanged.

### Q3. How are Prime's video and audio kept in sync without playing her voice twice?

- **One file, one clock.** A take is one recording that holds both video and audio. Chroma keying re-encodes to WebM with alpha and **keeps the audio** (`-c:a libopus`, `rawClipsService.js`, VERIFIED). Prime's dialogue audio is always taken from the **same file and the same in and out points** as the PIP segment, so it cannot drift.
- **One player for her voice.**
  - In preview and export alike, the PIP video layer is always **muted**.
  - Her voice is played once, by the audio plan, as the "Prime dialogue" stem from that same file.
  - Export does the same in the FFmpeg graph: the take is mapped once for video and once for audio.
- **One source per line.**
  - The audio plan allows exactly one approved source per line (R4).
  - For Prime's lines that source must be her take. A voice clip or a generated voice on a Prime line is refused by validation.
- **Hiding the PIP does not mute her voice.** Visibility and audio are separate controls, and hiding the PIP on a beat leaves her lines audible by default.
- **Risk: other voices leak into her take** (INFERRED):
  - **The cause.** If the teleprompter plays other characters' voice clips through speakers while she records, those voices are in her take. The app already warns "use headphones" (VERIFIED).
  - **The proposed handling.** With per-line marks, the Prime stem is gated to her own lines and lowered during other lines. Anything that still overlaps is flagged "possible double voice" for review.

### Q4. How does the system know which Lala lines need a Voice icon click and which are automatic wardrobe or notification reactions?

From the existing show rule, given one shared home (§3.4). Each Lala line is classified `voice_click`, `notification_reply`, `wardrobe_reaction`, `auto_reaction`, `cutscene` or `violation`. Only `voice_click` lines make the Director generate a click on the Voice icon zone. Reactions anchor to the action that causes them. A `violation` stays a Script health warning: the Director never adds a click the writer did not intend.

### Q5. How does a changed script line affect approved voice audio, gameplay timing and Timeline keyframes?

Every line-level element is keyed by `line_id` plus a text hash (§3.3).

| Element | Line text changed (same id) | Line deleted | Line added |
|---|---|---|---|
| Approved voice (generated) | **Outdated** ("line changed since approved"). The old audio still plays in preview, with the badge. A new version is generated as a draft for approval. | Orphaned (kept, unused) | No audio until assigned and approved |
| Approved voice (recorded clip) | Outdated, needs re-recording. No automatic replacement. | Orphaned | — |
| Prime take | That line's segment is marked "script changed after filming" | Its segment is flagged | Flagged: "not in the take" |
| Gameplay actions anchored to the line | Anchors hold. If the line's length changes, later anchors move with it. User offsets are kept. | Anchored actions become **Orphaned** (warning, not deleted) | New tags (for example a new `[UI:CLICK]`) produce new **draft** generated actions |
| Timeline keyframes | Keyed to `scene_asset.id` plus an anchor, so they follow the line. Any inside a span whose length changed are flagged for review. | Orphaned | — |

**Export behaviour.** The export preflight lists every Outdated and Orphaned element. Export goes ahead only after Evoni accepts each one: an outdated approved voice is used as it is only if she accepts it.

### Q6. How will I recognise generated, manually edited, approved and outdated elements in the interface?

One badge set is used on the Script, Stage, Gameplay, Timeline and Audio views, driven by §3.1:

| Badge | Means |
|---|---|
| **Generated** (outlined, ✦) | Made by a generator, not yet touched |
| **Inherited** (link icon) | Comes from the scene set or angle |
| **Edited** (pencil, with the changed fields on hover) | Has user overrides that regeneration keeps |
| **Approved** (✓) | Evoni approved it; it changes only by her choice |
| **Outdated** (amber, "changed upstream", with *Review*) | Its inputs changed since it was made or approved |
| **Orphaned** (grey, ⚠) | Its source line or object is gone |
| **Conflict** (red) | An unresolved timing conflict (§3.2) |

**Where the counts appear:**
- An episode-level **"Needs attention"** list groups the Outdated, Orphaned and Conflict elements, each with a link to where it lives.
- The export preflight shows the same counts.

**Reused wording.** These states reuse wording that already exists rather than adding new terms: "Auto-drafted", a locked beat, the style sheet's stale flag, an overlay's "outdated", and "line changed since recorded".

### Q7. How will an episode made through any creation route get the same required setup?

**PROPOSED:** one idempotent service, `initializeEpisode(episodeId, { eventId, mode })`.

**What it covers.** Each step records itself in `setup_status`:
- the brief with `event_id`;
- the slot snapshot;
- the 14 beat plans;
- locations;
- to-do;
- wardrobe;
- event stamped as used;
- the price snapshot;
- deliverables;
- overlays;
- fingerprints.

**Who calls it.** Every route that creates an episode or links one to an event (follow-up §4):

| Route | How it calls the initializer |
|---|---|
| A (Start Episode) | Calls it directly |
| B (generate from several events) | Calls it; the events that are not the anchor go through `mode:'link'`, which writes the brief link, price snapshot and deliverables |
| C (regenerate an episode) | Calls it |
| D (Part 2) | `mode:'part_two'`, whose differences from A Evoni rules on explicitly. It shares Part 1's to-do. |
| E (`POST /api/v1/episodes`) | Calls it |
| `inject` and the `PUT used_in_episode_id` link | `mode:'link'` |

**Repairs.**
- "Resume setup" runs the same service.
- The production checklist flags an episode with **no** `setup_status`. Today it does not (VERIFIED, `EpisodeProductionChecklist.jsx`).
- `GET /episodes/test-create` is removed or gated (separate bug-fix PR).
- Existing episodes are repaired by a backfill job. Evoni runs it through the Deploy workflow.

### Q8. Which PR sets up the shared source-of-truth contracts before the Gameplay Director uses them?

**PR C1, "Production contracts". It is code, adds no migration and changes no behaviour.** It is the first code PR the Director depends on. It contains:

- **`docs/PRODUCTION_CONTRACTS.md`**, which covers:
  - the script tag grammar;
  - line identity (§3.3);
  - the Lala trigger classes (§3.4);
  - the provenance fields and badge states (§3.1);
  - anchors and timing resolution (§3.2);
  - the Stage coordinate convention (fractions of a saved reference frame);
  - audio source kinds (`take`, `voice_clip`, `generated`, `none`) with approval.
- **One shared script parser and the classifiers,** with fixture tests that **both** the backend Jest suite and the frontend test suite run. Today the backend's `scriptBeatParser` and the frontend's `lib/*` are separate (VERIFIED). Where the shared module should live, and how Vite imports it, is NEEDS CONFIRMATION at C1 design time.
- **The existing readers swapped to the shared parser,** but only where the outputs are identical, which the fixtures prove.

**What follows C1:**
1. **Migration PRs (M1–M4).** Each is separate. Each is applied on canon by Evoni through the Deploy workflow.
2. **Gameplay Director implementation.** It starts only after C1 is merged *and* M1–M3 have been applied on canon.
3. **The Gameplay Director specification.** It can be written now as a separate document. It cites C1's contract names and marks them provisional until C1 merges.

---

## 5. Dependency-aware implementation sequence (updated)

**PR types:** **D** documentation · **B** bug fix (no interface change) · **C** contract (code, no migration) · **M** migration (applied by Evoni via the Deploy workflow) · **F** feature.

Each row is one reviewable change and each needs its own approval.

| Order | PR | Type | Content | Depends on | Unblocks |
|---|---|---|---|---|---|
| 0 | D1 | D | The three audit/decision documents (this branch) | — | review |
| 0 | B1 | B | Export worker reads `resolution` and `timelineData` (`claude/export-job-args`, local, tested), **plus** the quality-vs-platform aspect decision (Q-E1) | Q-E1 | honest export size |
| 0 | B2 | B | Remove or gate `GET /episodes/test-create` | Q-C1 | — |
| 0 | B3 | B | Log the completion event-load catch (`episodeCompletionService`) | — | — |
| 0 | B4 | B | Checklist flags episodes with no `setup_status` | — | Q7 repair visibility |
| 0 | B5 | B | Guard the Script Writer `/lock` overwrite | — | — |
| 0 | B6 | B | `syncBeatScenes` and the Timeline save stop overwriting a Studio-chosen background | — | R1 groundwork |
| 1 | C1 | C | Production contracts (§4 Q8) | D1 approved | everything below |
| 2 | F1 | F | Script unification, Option A: the Writer as a "Full context" mode of the Script tab; guard shown in Health; structured view derived; redirect | C1 | — |
| 2 | F2 | F | `initializeEpisode` used by every route (Q7); Part 2 mode ruled | C1 (fingerprints), Evoni's Part 2 ruling | event sync |
| 3 | M1 | M | `scene_assets` inheritance and provenance columns, additive only (§7.3); the partial unique index on `(scene_id, inherits_from_asset_id)` | C1 | F3 |
| 3 | M2 | M | Line identity: `line_id` storage; `script_voice_clips.line_id` added **alongside** `line_index` (R5: nothing is dropped) | C1 | F4, F6 |
| 3 | M3 | M | Gameplay track, PIP track (with `fallback_asset_id`, §14) and PIP visibility rules (§8.2), and audio plan tables, all with provenance and anchors; take marks per line (extends `beat_marks`) | C1 | F5–F7 |
| 4 | F3 | F | One shared resolver `resolveSceneComposition` (§7.5); one `<Stage>` (edit, preview, thumbnail) drawing it; inheritance badges, Reset to master, Hide in this scene, conflict review; `saveCanvas` writes only the changed fields for an inherited object (§7.4); PIP drawn as its own top layer from the PIP track (§8), never written into `scene_assets` or a background; phone's on-Stage placement | M1, M3 | F5, F8 |
| 4 | F4 | F | Line-id carry-forward on save; voice clips re-keyed by `line_id` with read fallback to `line_index` | M2 | F6 |
| 5 | F5 | F | Time-only Timeline keyed to `{object_key, view}` and anchors, with a per-scene view track (§13.3); unused timeline stores **frozen** (read-only), not dropped | F3, M3 | F7 |
| 5 | F6 | F | Audio plan: per-line approved source (R4); voice assignment per character; generated voice behind `aiCostTracker` (provider is an owner decision); per-line approval and source tracking; teleprompter plays the approved source | M2, M3, F4 | F8 |
| 6 | F7 | F | **Gameplay Director:** generates actions from the C1 grammar, Lala triggers, Phone Hub zone geometry and the phone's Stage placement; anchors against the approved take; timing resolution with warnings (R3); keeps overrides (R6); follows §11 | C1, F3, F5, F6 (for speech anchors) | F8, F9 |
| 7 | F8 | F | Renderer parity: the worker calls the **same** `resolveSceneComposition` and PIP visibility functions as the Stage (§7.5, §8.4), then the Timeline, gameplay track and audio plan; golden-frame tests (§10) | F3, F5, F6, F7 | YouTube-ready export |
| 8 | F9 | F | Auto-drafted episode: Start chains brief → script → gameplay → Timeline → Stage preview, all drafts with per-layer approval | everything | decision 1 |
| 8 | F10 | F | Event change detection: "Needs attention" from fingerprints, routing changes by the audit's §C classes | F2, F1 | decision 2 |
| 9 | F11 | F | Navigation consolidation | F1, F3, F5 | — |
| later | M5+ | M | Retire legacy performance/timeline tables **only** after a reader inventory and a verified data copy on canon (R5) | everything reading them migrated | — |

**Kept separate:**
- **My Little List Phase 2.** It depends only on the phone and today's tags (`[WEAR]`, `[DELIVER]`, `[LEARNS]`). It can follow its own scope. If C1 changes the grammar, C1 keeps those tags as they are.
- **The Gameplay Director spec.** It is a separate document, and may be written against C1's draft.

---

## 6. Source-of-truth and inheritance diagrams (updated with §12–§15)

**Source of truth per production layer.** Arrows point from the owner to the readers. Nothing is copied unless it is marked SNAPSHOT.

```
Event Package (world_events) ──facts──► Episode Brief (event_id + fingerprints)
                                                │
Script tab ── episodes.script_content (+ line_id, text hash; versions) ── C1 shared parser
   │            │                                   │
   │            ├─► Lala line triggers (§3.4)        └─► Gameplay Director ──► gameplay track (anchors)
   │            └─► audio plan: line_id → approved source (take | voice_clip | generated | none)
   │
Scene Set (master) ── scene_assets[scene_set_id]        Approved Prime take (episode_raw_clips /
   ├─ View: Front ── scene_assets[scene_set_id, angle]     episode_performance_clips, referenced)
   ├─ View: Back  ── scene_assets[scene_set_id, angle]        │ marks (beat → line)
   │                                                           ▼
Episode scene ── scene_assets[scene_id(, angle)] overrides   PIP track + PIP rules + fallback (§8, §14)
   │                                                           │
   └──────► resolveSceneComposition(view, t) ◄── Timeline: view cuts + keyframes (time only)
                     │                                         │
                     ▼                                         ▼
             ONE resolved frame spec  ◄──────────── resolvePip(t)
                     │
        ┌────────────┼──────────────┐
        ▼            ▼              ▼
   Scene Studio   Stage preview   Export worker (FFmpeg)
   (edit mode)    (Timeline)      ← golden-frame tests compare preview and export
```

**Property inheritance chain** (one object, one property, at time `t`; §15 defines the rules):

```
[1] Set master value
      │ overridden by
[2] View value (Front/Back override of the set object, or a view-only object)
      │ overridden by
[3a] Scene override, all views ──► [3b] Scene override, this view (more specific wins)
      │ then
[4] Timeline: relative animation applied to the resolved base; timeline visibility segment, if any, replaces visibility
      ═══════════ scene composition ends here ═══════════
PIP (separate top layer):
[5] Manual PIP rule (segment > beat) ── else track default ON
[6] Source: approved take ── else designated fallback (with warning) ── else placeholder (with warning)
     Fallback never changes visibility, never adds audio.
```

## 7. Scene Set inheritance (Evoni's ruling, 2026-10-26)

**The ruling, in short.** A Scene Set is a reusable master environment. An episode scene inherits the master's background, objects, props and default positions, and can customise its own composition independently. Nine requirements follow (SI-R1 … SI-R9 in §10):
- clear ownership;
- stable ids;
- no write-back to the master;
- automatic propagation of the properties nobody overrode;
- overrides preserved;
- conflicts visible;
- hiding without deleting;
- one resolved composition everywhere;
- regeneration never silently discards approved adjustments.

### 7.1 What `scene_assets` is today (VERIFIED, `src/models/SceneAsset.js`, `src/controllers/sceneStudioController.js`)

- **One table already holds both kinds of object.** Master objects have `scene_set_id` (and optionally `scene_angle_id`) set. Scene objects have `scene_id` set (migration `20260625100000-scene-studio-scene-set-support`). Each row has a UUID `id`, is paranoid (`deleted_at`), and carries every visual property:
  - position: `position_x/y`, `width/height`, `rotation`, `scale`, `opacity`, `flip_x/y`;
  - layering and state: `layer_order`, `z_index`, `is_visible`, `is_locked`;
  - content and style: `crop_data`, `style_data`;
  - grouping and variants: `group_id`, `variant_group_id/label`, `is_active_variant`;
  - timing: `start_timecode`/`end_timecode`;
  - extras: `metadata`.
- **Ids are already stable.** `saveCanvas` upserts by `id`, falls back to `(asset_id, usage_type)`, and soft-deletes the rows the client dropped. A row keeps its UUID across saves.
- **Scenes never read master objects.** `getCanvas` reads only `{ scene_id }`. `getSceneSetCanvas` reads `{ scene_set_id }`.
- **Saving writes the whole row.** `saveCanvas` writes **every column of every object it is sent**. If a client sent resolved inherited values, they would become full local copies that could no longer be told apart from overrides.
- **The model declares a unique index on `(scene_id, asset_id, usage_type)`.** No migration in `src/migrations/` creates it. Its presence on canon is NEEDS CONFIRMATION (production database).
- **Positions are integer pixels of the preset canvas.** The preset is `canvas_settings.platform`, 1920×1080 by default.

### 7.2 Verdict: `scene_assets` can carry property-level inheritance with additive columns. No second composition store.

The table already has the identity, ownership split, soft delete and every property that needs overriding. What it lacks is all additive (§7.3):
- a link from a scene row to the master row it overrides;
- a sparse record of which properties are local;
- a snapshot of the master values those overrides were made against, used for conflict detection;
- provenance fields.

No demonstrated technical need for a second store was found. INFERRED design on VERIFIED facts.

### 7.3 Storage (PROPOSED, migration M1; additive only, nothing dropped)

| New column on `scene_assets` | Purpose |
|---|---|
| `object_key UUID NOT NULL` (back-filled as `id`) | The object's **stable identity** across the set, its views, scenes and detachment (§12). A master row's key is its own `id`. Every view or scene override of it, and any detached copy, carries the same key. Keyframes, gameplay anchors and badges refer to `object_key`, so nothing is ever re-keyed. |
| `inherits_from_asset_id UUID NULL` → `scene_assets.id` | Set on an **override row** (view-level or scene-level, §13): names the row it customises. NULL means a master object, a scene-only object or a detached object. |
| `detached_from_asset_id UUID NULL` | History only: the master row that a detached object came from (§12). Never used for resolution. |
| `overrides JSONB NULL` | Only the locally changed properties, for example `{ "position_x": 640, "is_visible": false }`. An absent key means the value is inherited. |
| `override_base JSONB NULL` | The master's value for each overridden key **at the time it was overridden**. Used to detect "master changed under your edit". |
| `origin VARCHAR` (`inherited` · `scene` · `generated` · `detached` · `legacy`) | Ownership and badges (§3.1) |
| `approval VARCHAR`, `approved_at`, `approved_by` | R6 / SI-R9 |
| `derived_from JSONB NULL` | Generator inputs and fingerprint for generated rows (§3.1) |

**Index.** Add a partial unique index on `(COALESCE(scene_id, scene_set_id), COALESCE(scene_angle_id, '00000000-…'), object_key) WHERE deleted_at IS NULL AND inherits_from_asset_id IS NOT NULL`. This allows at most one override per object per owner and per view scope. It replaces the earlier `(scene_id, inherits_from_asset_id)` proposal, which did not cover views (§13).

**Ownership** (SI-R1):
- **Master rows** have `scene_set_id`/`scene_angle_id` set. They are edited **only** in the Scene Set's Studio.
- **Override rows** have `scene_id` and `inherits_from_asset_id` set.
- **Scene-only rows** have `scene_id` set and `inherits_from_asset_id` NULL.

**Writing.** Scene saves write **only** rows with `scene_id = this scene`. They can never write a master row (SI-R3, enforced by the existing `where: { id, scene_id }` on update).

**Stable ids** (SI-R2):
- The inherited object's identity, its **object key**, is the master row's `id`.
- The override row has its own `id`, but everything that refers to the object uses the master id:
  - Timeline keyframes;
  - gameplay anchors;
  - the scene's layer order;
  - badges.
- Scene-only objects use their own `id`.

**Hiding** (SI-R7). Hiding uses `overrides.is_visible = false` on an override row. The master row is untouched. Deleting a hidden override row brings the object back.

**Master and angle precedence.**
1. Set-level master objects (`scene_angle_id` NULL) apply to every angle.
2. Angle-level master objects apply only to scenes on that angle.
3. The scene's overrides apply last.

The **background** follows the same chain: the angle still, else the set's base still, else the scene's own `background_url` override. INFERRED. The current fallback order in `beatScenesService.beatBackground` (angle → event look → base) must be kept as the inherited default.

### 7.4 How inherited objects resolve when the master changes (SI-R4, R5, R6)

Resolution happens **when read**, never by copying:

`resolved(property) = scene override if the key is in overrides, else angle master, else set master`

| Master change | Scene without an override | Scene with an override on that property | Scene that hid the object |
|---|---|---|---|
| Property changed | Picks it up at the next read; nothing is written to the scene | Keeps its value. If `master_now ≠ override_base[key]`, the row shows **Conflict: "Master changed under your edit"** with *Take master* (drops the key) or *Keep mine* (sets `override_base[key] = master_now` and clears the conflict) | Stays hidden. The change is recorded so that un-hiding shows the current master. |
| New object added | Appears | Appears | n/a |
| Object deleted (soft) | **Superseded by §12:** draft scene → removed with a notice; approved scene → detached | **Superseded by §12:** detached automatically into a locally owned row (`origin='detached'`) with every override kept | **Superseded by §12:** detached as a hidden local row |
| Master regenerated (new still or new generated objects) | Follows | Overrides kept; approved overrides never changed (SI-R9) | Stays hidden |

**Scene Studio editing an inherited object.**
- **On the first edit,** the server creates the override row. It sends only the changed keys plus the master's current values as `override_base`.
- **Reset to master** removes keys from `overrides`. When none remain, the override row is soft-deleted.

**Required changes to existing writers.**
- `saveCanvas` must write the sparse form for inherited objects and keep the full-row form for scene-only objects.
- `syncBeatScenes` and the Timeline save must stop writing `background_url` when the scene overrides it (bug-fix B6).

### 7.5 One resolved composition everywhere (SI-R8)

- **One function, shared by server and client.** It is `resolveSceneComposition({ scene, angleMasters, setMasters, overrides, sceneObjects, canvasSettings })`. It returns an ordered list of layers. Each layer has:
  - the object key and the resolved properties;
  - `origin`, `overrides` and `conflict`/`orphaned` flags;
  - geometry as **fractions of the saved reference frame**, so output size does not matter.
- **Where it lives.** It is part of the C1 contracts, in shared code with fixture tests run by both test suites (§4 Q8).
- **Who calls it:**
  - **Scene Studio** (edit mode). It also shows the badges.
  - **The Stage preview and the Timeline,** at playhead time `t`. Timeline animation is applied after it (§7.6).
  - **The export worker,** per output frame (F8).
  - **`GET /scenes/:id/composition`,** which returns the resolved list for every client that does not edit.
- **Parity is tested, not assumed.** Golden-frame tests (§10) render the same fixture through Konva and node-canvas.

### 7.6 How Timeline animation interacts with inherited positions

- **What a keyframe stores.** A keyframe belongs to the **scene**, keyed by the object key (the master id for inherited objects). It stores its value **relative to the resolved base**: `Δx, Δy, scale×, rotation Δ, opacity×`.
  - **Effect on a moved master:** when the master moves an object the scene never overrode, the whole animation moves with it.
  - **Effect on a moved override:** when the scene overrides the base position, the animation plays from the new base.
- **Absolute keyframes, an option per keyframe.** "Pin to this spot" stores an absolute position for that keyframe. It is shown with a pin badge, and the master position does not affect it.
- **Order of evaluation:**
  `final(t) = animate(resolveSceneComposition(...)[key], keyframes[key], t)`
  The same order is used in the preview and the export.
- **A hidden object's keyframes are kept but not drawn.**
- **An orphaned object's keyframes** are listed with the orphan.
- **Today:** Timeline keyframes are global per scene, with no object key (VERIFIED). They are not tied to objects at all. Existing ones migrate as "whole-scene" keyframes, applied to every layer as today (§7.7).

### 7.7 How older scenes stay compatible

- **Existing scene rows** (`scene_id` set, no `inherits_from_asset_id`) get `origin='legacy'`. They resolve exactly as they draw today.
  - Nothing is attached to a master automatically, because that could duplicate objects already copied by hand.
  - An optional **"Link to scene set"** review matches legacy rows to master rows by `asset_id` + `usage_type`. Only on Evoni's approval does it convert each match into an override row, keeping every differing property as an override.
- **The legacy background stays where it is.** An existing `scenes.background_url` that **equals** the angle's still is treated as inherited. One that **differs** becomes a scene override. Either way, what is on screen does not change.
- **The Timeline's legacy `scenes.characters` / `ui_elements` JSON** is read by the resolver as a `legacy` layer group until migrated (R5 spirit: kept until every reader moves).
- **Coordinates are converted only when read.** Existing pixel positions are converted to fractions using the reference size in `canvas_settings.platform` (default 1920×1080). Stored values are never rewritten.

## 8. Prime PIP visibility (Evoni's ruling, 2026-10-26)

### 8.1 Rules (PIP-R1 … PIP-R8 in §10)

1. Visibility is **on** by default.
2. No beat is excluded automatically.
3. Prime is **not** hidden in beats 11–13 by default.
4. Visibility can be changed per beat and per timeline segment.
5. Manual visibility choices survive regeneration.
6. Preview and export read the same visibility data.
7. Position, size, trim, timing and audio can each be edited on their own.
8. The PIP is never baked into backgrounds.

**Evidence for rule 3** (VERIFIED). In the cutscene the teleprompter shows "Cutscene · watch & comment", and **JustAWoman's lines there are still read** (`TeleprompterReader.jsx` header). So Prime is on camera in 11–13. `isCutsceneBeat` stays a script, voice and phone rule, and is never a PIP rule.

### 8.2 Storage (PROPOSED, migration M3)

**Why a separate table, and why it is not a second composition store.** The PIP spans scenes and follows the approved take. It is an **episode track**, not a scene object. Storing it in `scene_assets` would copy it into every scene, which would amount to baking it into compositions. The Stage and the export draw it as a **separate top layer** above the resolved scene composition (PIP-R8).

| Table | Columns (all with provenance, §3.1) |
|---|---|
| `episode_pip_tracks` (one per episode and performer) | `default_visible BOOLEAN NOT NULL DEFAULT true` · `take_ref` (the approved take: `episode_raw_clips.id` or `episode_performance_clips` rows per beat, R5: referenced, not copied) · default placement `{x, y, w, h}` as fractions · `audio_gain`, `audio_muted` (independent of visibility) |
| `episode_pip_rules` (visibility) | `scope` (`beat` · `segment`) · `beat_number` or `start_anchor`/`end_anchor` (§3.2 anchors on the approved take's marks) · `visible BOOLEAN` · `origin` (`manual` · `generated`) · `approval` |
| `episode_pip_layout` (optional per-beat placement or trim) | `beat_number` · `overrides` (`{x, y, w, h}`, `trim_in_ms`, `trim_out_ms`, `offset_ms`) |

**Visibility at time `t`** (PIP-R1, R2, R4):
`visible(t) = the most specific rule covering t: segment rule > beat rule > track default (true)`

- **Nothing generates a hide rule by default** (PIP-R2, R3).
- **If a generator ever proposes one,** it is `origin='generated'`, `approval='draft'`, and has no effect until approved.
- **Regeneration rewrites only generated rules.** Manual rules are never touched (PIP-R5).

### 8.3 Keeping the PIP in sync with the approved take

- **Segment rules are anchored, not absolute.** A segment rule is stored as anchors on the approved take's marks (beat marks today, line marks once M3 adds them).
- **Changing the take re-resolves them** (§4 Q2). A manual rule keeps its anchors and offsets. Where an anchor is missing in the new take, the rule shows **Conflict** and is not dropped.
- **Beat rules need no anchors.** They resolve against whatever take is approved.
- **Trim and timing.** `trim_in_ms`/`trim_out_ms`/`offset_ms` are per-beat overrides on the take-to-episode time mapping. They are edited independently of visibility and placement (PIP-R7).
- **Audio is independent of visibility** (PIP-R7, §4 Q3). Prime's lines come from the same take file and the same mapping, through the audio plan. Hiding the PIP does not mute her. Muting is its own control.

### 8.4 Preview and export use the same data (PIP-R6)

One shared function, `resolvePip({ track, rules, layout, take, t })`, returns `{ visible, rect, sourceTime }`. It lives in C1 shared code, next to `resolveSceneComposition`.
- **The Stage preview** draws the take video, muted (audio comes from the audio plan), at `rect` when `visible`.
- **The export worker** places the same take frames at the same rect in the FFmpeg graph, from the same function, for the same `t`.
- **Nothing is rasterised into a background or a scene still** (PIP-R8).

## 9. Earlier recommendations that conflict with these rulings

| Where | Earlier text | Now |
|---|---|---|
| Follow-up §2 "Risks and decisions" | "Should a scene's Stage show its set or angle objects as a locked base layer, or copy them in?" | **Inherit with property-level overrides** (§7). Copying is rejected. |
| Follow-up §2 recommendation 1 | "`scenes.characters`/`ui_elements` stop being authored. If anything still needs them, they become a read-only projection." | Kept, but as a `legacy` layer group the resolver reads until every reader has moved (§7.7). Not retired early. |
| Follow-up §2 "Risks" | "Parallax, masks and video objects … should be preview-only or baked into the image." | Baking stays an option for scene effects only. It **never** applies to the PIP (PIP-R8). |
| Follow-up §2 recommendation 1 | "timeline_data holds time only … keyframes keyed by `scene_asset.id`" | Keyed by the **object key** (the master id for inherited objects), stored relative to the resolved base, with an optional pin (§7.6). |
| Follow-up §6 step 4 / audit §7 Phase 3 | "retire the five unused timeline stores" | Freeze, then retire only after a reader inventory and a verified data copy (R5). |
| Decisions §3.1 | Listed "the PIP placement" under the Stage's provenance | The PIP is its own episode track (§8.2), drawn above the Stage composition. It is not a `scene_assets` row. |
| Decisions §4 Q3 | "Hiding the PIP does not mute her voice" | Unchanged, and now a test (PIP-6). |
| Teleprompter (code, VERIFIED) | `isCutsceneBeat` changes reading and skips voice clips in beats 11–13 | Rehearsal behaviour. It stays as it is and is **not** reused for PIP visibility. |
| The Gameplay Director companion plan | Not available in the repository | Must follow R1–R6, §7 and §8: cursor targets use resolved object keys and the phone's resolved Stage placement, and it never writes PIP rules unless they are approved drafts. Revision needs the plan text. |

## 10. Acceptance tests

**Where each test runs:**
- **U:** shared-resolver unit tests, run by both test suites.
- **A:** API tests.
- **G:** golden-frame tests: the same fixture rendered through the Konva Stage and the node-canvas worker, compared within a pixel tolerance.
- **E2E:** a browser test against the running app.

**Fixture.** Master set `S` with object `chandelier` (x = 0.40) and `sofa`; angle `A`; scenes `P` and `Q` on `A`.

**Scene Set inheritance**

| ID | Given | When | Then | Level |
|---|---|---|---|---|
| SI-1 | P, Q with no overrides | Resolve | Both show S's background, chandelier at 0.40 and sofa; each layer has `origin=inherited` and the object key is the master id | U |
| SI-2 | P | Move chandelier to 0.55 in P's Studio and save | An override row with `overrides={position_x}` and `override_base={position_x: 0.40}`; **S's row is unchanged**; Q still resolves 0.40 | A, U |
| SI-3 | SI-2 | Master moves chandelier to 0.30 | Q resolves 0.30 (automatic); P keeps 0.55 and shows **Conflict** | U, A |
| SI-4 | SI-3 | P chooses *Keep mine* | P keeps 0.55, the conflict clears, `override_base` becomes 0.30 | A |
| SI-5 | SI-3 | P chooses *Take master* | The key is removed; P resolves 0.30; with no keys left, the override row is soft-deleted | A |
| SI-6 | P | Master changes the chandelier's opacity (a property P never overrode) | P picks up the new opacity and keeps its own position | U |
| SI-7 | P | Hide sofa in P | P does not draw the sofa; S still has it; Q draws it; un-hiding restores it with S's current properties | A, U |
| SI-8 | SI-2 | Master deletes the chandelier | **Superseded by MD-2 (§17):** P keeps a detached, locally owned chandelier at 0.55 | A, U |
| SI-9 | Any scene save | Payload tries to update a master row id | Refused; the master is unchanged | A |
| SI-10 | SI-2 | Reload Studio, Timeline, preview and export | All four resolve the same layers and properties | U, G |
| SI-11 | An approved override in P | Regenerate the master angle or the scene draft | The approved override is unchanged; anything new is a draft | A |
| SI-12 | A legacy scene with full copied rows | Deploy M1 | It draws pixel-for-pixel as before (`origin=legacy`); nothing is auto-linked | G |
| SI-13 | Legacy scene | Run "Link to scene set" and approve | Matched rows become overrides that hold only the properties that differed; the drawing is unchanged | A, G |
| SI-14 | Legacy `background_url` different from the angle still | Resolve | The scene keeps its background (treated as an override) | U |
| SI-15 | `syncBeatScenes`, the Timeline save, export | P has a background override | None of them overwrites it | A |
| SI-16 | A keyframe Δx = +0.1 on the chandelier in Q | Master moves the chandelier | The animation path shifts with the master | U, G |
| SI-17 | A pinned (absolute) keyframe | Master moves the chandelier | The pinned keyframe position is unchanged and shows the pin badge | U |
| SI-18 | An angle-level master object and a set-level one with the same key | Resolve on angle A | The angle wins over the set; the scene override wins over both | U |

**PIP visibility**

| ID | Given | When | Then | Level |
|---|---|---|---|---|
| PIP-1 | A new episode with an approved take | Resolve the whole episode | `visible` is true at every t, **including beats 11–13** | U |
| PIP-2 | Run every generator (Director, auto-draft) | — | No visibility rule with an effect is created; any proposal is a draft with no effect | A |
| PIP-3 | Hide beat 7 (beat rule) | Resolve | Hidden through beat 7, visible elsewhere | U |
| PIP-4 | Beat 7 hidden, plus a segment rule that shows lines 3–4 of beat 7 | Resolve | Visible only for lines 3–4 (segment beats beat) | U |
| PIP-5 | Manual rules exist | Regenerate gameplay or the episode draft | Manual rules are unchanged | A |
| PIP-6 | Beat 7 hidden | Play and export | Prime's audio for beat 7 is present at the same level; the visibility and mute controls are independent | U, G |
| PIP-7 | Change the PIP size in beat 2 only | Resolve | Beat 2 uses the new rect, other beats the default; trim and visibility are unchanged | U |
| PIP-8 | Trim beat 5's take in by 400 ms | Play | Video and Prime's audio both start 400 ms later in the take, still in sync | U, G |
| PIP-9 | Segment rule anchored to line 4 | Approve a different take | The rule re-resolves to line 4's mark in the new take; if line 4 has no mark, it shows Conflict and is kept | A, U |
| PIP-10 | Any rules | Compare preview and export at sampled t | Same `visible`, rect and source time; golden frames match | G |
| PIP-11 | Any export | Inspect scene stills and backgrounds | No PIP pixels in any background or scene still; the PIP exists only as its own layer | G |
| PIP-12 | An existing episode with no PIP track | Open the Stage | A track is created with the default visible; nothing else changes | A |

## 11. Gameplay Director: requirements its specification must meet

The companion specification is not in the repository (see the header). Until its text is shared, these are the binding requirements from Evoni's rulings, for whoever revises or rewrites it:

1. **Script input.** It reads the script only through the C1 parser, and Lala lines only through the C1 triggers (§3.4).
2. **What it targets.** Cursor and click targets refer to Phone Hub zone keys and to **resolved** object keys (`object_key`). The phone's position comes from the **resolved** Stage composition for the active view (§13). It never uses raw `scene_assets` rows or pixel positions.
3. **Timing.** Every action is an anchor plus offset on the approved take's marks (§3.2). Long dialogue is resolved by the §3.2 order with warnings. **It never freezes or hides the PIP** (R3, PIP-R2).
4. **Regeneration.** It replaces only its own `origin='generated'` draft actions. Manual offsets and approved actions follow R6.
5. **What it never writes:** PIP visibility rules (it may propose drafts, which have no effect until approved), scene overrides, or anything that changes the master.
6. **View cuts.** It may *propose* view cuts (§13.3) as drafts. It never changes a scene's default view.
7. **Missing footage.** It treats beats on fallback (§14) as untimed. It anchors to beat bounds, labels the timing "estimated", and does not invent Prime audio.

## 12. Master Scene Set deletion (Evoni's ruling, 2026-10-26)

**The rule.** One deterministic rule runs in the same transaction as the master soft-delete. Master rows are already paranoid, so they are soft-deleted, never hard-deleted (VERIFIED, `SceneAsset` `paranoid: true`). The rule applies to each scene that resolved the object:

| Scene's instance | Draft scene (episode not approved) | Approved scene, or episode accepted/complete |
|---|---|---|
| **Untouched inherited** (no override row) | **Removed** from the scene, with a "Removed from the Scene Set" notice in Needs attention, *Undo* (restores the master row) for 30 days | **Detached**: a locally owned row is created with the master's last values (`origin='detached'`, same `object_key`, `detached_from_asset_id` set). The approved scene looks exactly as it did. |
| **Customised** (override row: position, appearance or visibility) | **Detached**: the override row becomes a full local row, filled from master-last plus overrides. `inherits_from_asset_id` is cleared and every override is kept. | Same |
| **Hidden** (override with `is_visible:false`) | **Detached as hidden**: kept, not drawn, not brought back | Same |
| **Locally added** (scene-only) | Unaffected | Unaffected |
| **Legacy** (full copied rows, `origin='legacy'`) | Unaffected; it was never linked | Unaffected |

**Consequences** (VERIFIED basis, PROPOSED rule):
- **Detached objects are locally owned.** Later master changes, and restoring the master row, never touch them. They are badged **Detached** and can be offered *Re-link to master* if a matching master object exists again. The offer is never taken automatically.
- **Animation survives.** Keyframes and gameplay anchors keep working because they use `object_key`, which does not change.
- **Undo is exact for drafts.** Undoing a master delete restores the master row, and untouched draft instances reappear because they were never copied. Detached instances stay detached.
- **The recommendation for untouched instances, with its backward-compatible reason:** remove them from drafts and detach them in approved scenes. An approved composition must never change because a reusable set was edited. Draft scenes should stay light, never filling with copies.
- **Regenerating the set's objects counts as a master edit by `object_key`, not as delete-and-create.** A generator that replaces an object keeps its key, so instances keep their overrides. A generator that truly removes one goes through this rule.

## 13. Front View and Back View (Evoni's ruling, 2026-10-26)

### 13.1 What already exists (VERIFIED)

- **Views are already zones of one set.** A Scene Set's views are already rows in `scene_angles` with `angle_kind` ∈ `front · inside · back · area · zone · extra` (L14 zones, migrations `20261002120000`, `20261002170000`). An `extra` framing belongs to a zone through `zone_angle_id`.
- **Front and Back are siblings.** They are two `scene_angles` of the **same** `scene_set_id`. Generation already treats them as one place ("so Front, Inside and Back read as one place", `sceneGenerationService.js`), and the Front view feeds weather and season variants (`LookVariants.jsx`).
- **`scene_assets` already has `scene_angle_id`.** It is used for view-level objects (`getSceneSetCanvas` reads every row of the set, set-wide or per angle).
- **Today an episode scene is on one view.** `scenes.scene_angle_id` comes from its beat's `scene_plans.angle_label` through `syncBeatScenes`. There is no view change inside a scene.

So the ruling fits the existing model. **Front and Back stay `scene_angles` of one set. No new Scene Set type is needed, and no 3D navigation is assumed.**

### 13.2 What is shared and what differs (PROPOSED)

| Shared by every view (set level) | May differ per view (view level) |
|---|---|
| Scene Set identity, the World Location and location metadata (`scene_sets` row) | Background image (`scene_angles.still_image_url`, already per view) |
| **Object identity** (`object_key` of set-level master rows) | Object position and scale: `position_x/y`, `width/height`, `scale`, `rotation`, `flip_x/y` |
| Shared environment properties: `style_data`, the active variant (for example "lamp on"), `object_label`, `asset_id` | Visibility and occlusion: `is_visible`, `layer_order`, `z_index`, `crop_data` |
| | Camera composition: `canvas_settings` per view |

**Rows, using existing columns:**
- A **view override** of a set object is a `scene_assets` row with `scene_set_id`, `scene_angle_id`, `inherits_from_asset_id` (the set row), `object_key` and sparse `overrides`.
- A **view-only object** is a set row with `scene_angle_id` set and no `inherits_from_asset_id`. Its `object_key` is its own `id`. This is what angle-level objects already are.
- **New set objects.** When an object is added at set level while editing one view, it is placed in that view. In every other view it is **"Not placed"**: excluded from the drawing, with a badge, until it is placed there. That avoids pretending that 2D positions carry between views (Q-VW1).

**Scene overrides have a view scope.** On a scene row, `scene_angle_id` NULL means the override applies in every view; that is the default for *shared* properties. `scene_angle_id` set means the override applies in that view only; that is the default for *per-view* properties. Studio picks the scope by property class (the table above), and the user can change it.

### 13.3 How a scene changes view on the Timeline without duplicating or losing objects

- **A view change is a cut, not a new scene.** The Timeline (time only, F5) gets a **view track** on each scene: segments `{ start_anchor, end_anchor, scene_angle_id }`. With no segments, the scene's default view (`scenes.scene_angle_id`) applies throughout.
- **One set of objects, resolved per view.** At time `t` the resolver picks the view from the view track, then resolves the **same** object keys for that view (§15). No row is copied, so nothing is duplicated.
- **Objects that don't fit a view are kept, not lost.** An object hidden, occluded or not placed in the active view is simply not drawn in that segment. It keeps its overrides and animation and reappears when the view cuts back.
- **Animation is scoped by view by default.** A keyframe carries `{ object_key, scene_angle_id | null }`.
  - Authored in Front, it is Front-scoped, because a Δx in Front has no meaning in Back.
  - "All views" is an explicit choice, for properties like opacity.
- **Gameplay follows the cut.** Gameplay anchors are on lines and actions, not on views. A cursor target that needs a phone position takes it from the view active at that time. If the phone is not placed there, that is a **Conflict** warning.

## 14. Missing Prime footage (Evoni's ruling, 2026-10-26)

**Status is checked per beat, separately for video and audio.** `resolvePip` (§8.4) returns `{ visible, rect, source, sourceTime, video_status, audio_status, warnings }`.

| Case | `visible` | Drawn | Audio | Warning |
|---|---|---|---|---|
| Approved take covers the beat | per §15 [5] | The take | The take's audio (when it has an audio track) | — |
| Take has video but **no audio track**, or the line falls outside it | per §15 [5] | The take | **Silence.** Nothing is invented, and generated voice on a Prime line stays refused (§4 Q3). | "Prime audio missing: beat N, lines …" (distinct from missing video) |
| **No take** for the beat; a fallback is designated | per §15 [5] | The designated fallback image or idle clip (looped to the beat), badged **Fallback** | **Silence**, unless audio was assigned on its own (audio is tracked separately) | "Prime footage missing: beat N (using fallback)" |
| No take, **no** fallback designated | per §15 [5] | A neutral placeholder frame labelled "Prime footage missing" | Silence | Same, plus "No fallback chosen" |
| Manually **hidden** (§15 [5]) | false | Nothing | Unchanged: audio follows the audio plan, not visibility | Video warning suppressed, because hiding is a deliberate choice. Missing Prime **audio** for lines in the beat is still reported. |

**Rules:**
- **A fallback is never a completed performance.** The production checklist and filming status count only assigned takes. A fallback beat stays "not filmed".
- **The pre-export review lists every beat on fallback or placeholder, and every Prime line without audio.**
  - Each needs one resolution: *assign a take*, *hide the PIP*, or *accept the fallback for this export*. The acceptance is recorded with who and when, and it lapses if the beat's footage status changes.
  - Export is blocked while any item is unresolved (Q-F2).
- **Where the fallback comes from.** `episode_pip_tracks.fallback_asset_id`, defaulting to a show-level designated asset. A new asset role such as `PRIME.PIP.FALLBACK` would fit the existing canonical-roles system (`src/constants/canonicalRoles.js`) (Q-F1).
- **Preview and export behave the same,** because both read `resolvePip`. The idle clip loops by the same `sourceTime` rule in both.

## 15. Deterministic precedence

The six levels below are evaluated in order. A higher-numbered level overrides a lower one for the same property. Within a level, **manual beats generated**, and **the more specific scope beats the general one**. There are no time-based tie-breaks: unique indexes allow one entry per (level, scope, object, property).

| Level | Source | Scope order inside the level | Regeneration |
|---|---|---|---|
| [1] Set master default | `scene_assets` row on `scene_set_id`, `scene_angle_id` NULL | — | Regenerating the set edits by `object_key` (§12) |
| [2] View default | View override or view-only row (`scene_set_id` + `scene_angle_id`) | — | Generated view rows replaced; manual kept |
| [3] Episode-scene override | Scene row (`scene_id`) | [3a] all views < [3b] this view | Never touched by regeneration unless `origin='generated'` and not approved |
| [4] Timeline | Keyframes (relative to the [1–3] base, or pinned) and visibility segments | All views < this view; for visibility, a segment replaces [1–3] visibility for its time range | Generated keyframes and segments replaced; manual kept |
| [5] Manual PIP visibility | `episode_pip_rules` | Track default ON < beat rule < segment rule | Only generated, unapproved rules may be replaced; they have no effect anyway |
| [6] Missing-footage fallback | `resolvePip` source choice | Approved take > designated fallback > placeholder | Recomputed every time it is read. It is a source choice, never stored as a decision. |

**Interaction rules:**
- **Levels 1–4 decide the scene composition.**
- **Levels 5–6 decide the PIP layer,** which is always drawn above the composition (PIP-R8).
- **Level 6 never changes visibility.** It only chooses what a visible PIP shows. A manual hide (level 5) therefore always wins over a fallback.
- **A fallback never adds audio.**
- **Approval freezes values against lower-level edits.** An approved value at any level is not changed by edits *below* it. A changed input marks it Outdated (§3.1), never rewritten.

## 16. Migration risks

| Risk | Detail | Mitigation |
|---|---|---|
| Legacy readers of `scene_assets` | `sceneController` `getSceneAssets`, `addSceneAsset`, `updateSceneAsset`, `removeSceneAsset`, `listSceneAssets`, `updateSceneAssets` and `sceneStudioController` read rows by `scene_id` directly (VERIFIED); frontend `sceneService.js` calls them. Sparse override rows would look like objects with empty columns. | Route every reader through `resolveSceneComposition` **before** any override row is written. Keep inheritance switched off until every reader is moved, and test that it reads the same with the flag on and off. |
| `saveCanvas` writes the whole row | (VERIFIED, §7.1) A client sending resolved values would turn inheritance into copies. | F3 changes the save contract to diffs for inherited objects, with server-side validation that refuses full writes to override rows. |
| Unique index on `(scene_id, asset_id, usage_type)` | Declared in the model; no `src/migrations/` file creates it (VERIFIED). Its presence on canon is NEEDS CONFIRMATION. It also stops two instances of one asset in one scene. | Read canon before M1. M1 adds the `object_key` index and decides whether the old one stays. |
| Pixel coordinates | Existing rows are integer pixels of the preset canvas (VERIFIED). | Convert to fractions **when read** from `canvas_settings.platform` (default 1920×1080). Never rewrite stored values in M1. |
| Existing view-level objects are unlinked | Angle rows today are separate objects, not overrides (VERIFIED). | They become view-only objects (`object_key = id`). A link review is optional and needs approval. |
| Global keyframes | Today's keyframes have no object or view (VERIFIED). | They migrate as "whole-scene, all views" keyframes and draw as today. |
| Back-filling `object_key` | Every existing row needs `object_key = id`. | Back-fill in M1, in one statement, inside the migration transaction. The down migration drops only the new columns. |
| Approved episodes and master deletion | Detaching writes rows into approved scenes. | The detach is in the same transaction as the delete, logged and covered by tests MD-1…MD-5. |
| Timeline save and background | The Timeline save and `syncBeatScenes` write `background_url` (VERIFIED). | Bug fix B6 before inheritance. |
| Performance | Resolution happens on every read (set + view + scene rows). | Small row counts per scene (INFERRED). Fetch the set's rows once per scene set in the export worker. |
| Deploy | Every migration runs only through the Deploy workflow that Evoni approves (CLAUDE.md). | Additive, reversible migrations, each its own PR (M1, M3). |

## 17. Acceptance tests: deletion, views, fallback, precedence

**Fixture:** set `S` with views `F` (front) and `B` (back); objects `lamp`, `sofa`, `mirror`; draft scene `P` and approved scene `A`, both on `S`.

**Master deletion**

| ID | Given | When | Then | Level |
|---|---|---|---|---|
| MD-1 | `lamp` untouched in draft `P` | Master deletes `lamp` | `P` no longer draws `lamp`; "Removed from the Scene Set" notice with Undo; no row created in `P`. Undo brings it back as inherited. | A, U |
| MD-2 | `lamp` repositioned in `P` (x = 0.55) with a keyframe | Master deletes `lamp` | `P` has a `detached` row at x = 0.55, same `object_key`, keyframe still applies. A later master restore or edit does not change it. | A, U, G |
| MD-3 | `sofa` hidden in `P` | Master deletes `sofa` | `P` keeps a hidden detached `sofa`, not drawn; restoring the master does not bring it back | A, U |
| MD-4 | `P` adds a scene-only `plant` | Master deletes `lamp` and `sofa` | `plant` is unchanged | A |
| MD-5 | Approved `A` with untouched `lamp` | Master deletes `lamp` | `A` gets a detached `lamp` with the master's last values. Golden frame of `A` is identical before and after. | A, G |
| MD-6 | Legacy scene with copied rows | Master deletes `lamp` | Legacy scene unchanged | A, G |

**Front and Back views**

| ID | Given | When | Then | Level |
|---|---|---|---|---|
| VW-1 | `lamp` placed in `F` at 0.30 and in `B` at 0.70 | Resolve `P` in `F`, then in `B` | Same `object_key`, positions 0.30 and 0.70; style shared | U |
| VW-2 | Master changes `lamp` style (shared) | Resolve `F` and `B` | Both show the new style; positions unchanged | U |
| VW-3 | `P` overrides `lamp` position in `F` only | Resolve `P` in `B` | `B` uses the view default 0.70 | U |
| VW-4 | `P` overrides `lamp` colour (all views) | Resolve `F` and `B` | Both show the scene's colour | U |
| VW-5 | `P` view track: `F` for lines 1–3, `B` for lines 4–6 | Play and export | Cut at line 4; objects keep their identities; nothing is duplicated in the database (row count unchanged) | A, G |
| VW-6 | `mirror` not placed in `B` | Cut to `B` | `mirror` is not drawn and keeps its overrides; it reappears on the cut back to `F` | U |
| VW-7 | Front-scoped keyframe on `lamp` | Resolve in `B` | The keyframe is not applied in `B` | U |
| VW-8 | Gameplay targets the phone, which is not placed in `B` | Director runs over a `B` segment | Conflict warning; no guessed position | U |
| VW-9 | Existing set with front/back `scene_angles` and angle-level rows | Deploy M1 | Every view draws as before; angle rows become view-only objects | G |

**Missing Prime footage**

| ID | Given | When | Then | Level |
|---|---|---|---|---|
| MF-1 | Beat 4 has no take; fallback designated | Preview and export | Fallback drawn at the PIP rect in both; "Prime footage missing" warning; no Prime audio | U, G |
| MF-2 | Beat 4 has no take and no fallback | Preview | Placeholder frame labelled; warning includes "No fallback chosen" | U |
| MF-3 | Take with video, no audio track, for beat 5 | Resolve | Video drawn; `audio_status=missing`; silence; separate audio warning | U |
| MF-4 | Beat 4 manually hidden and no take | Resolve | Nothing drawn; no video warning; Prime-line audio warning still listed | U |
| MF-5 | Beat 4 on fallback | Open the production checklist | Beat 4 is "not filmed" | A |
| MF-6 | Beat 4 on fallback | Start export | Pre-export review lists beat 4; export blocked until a take is assigned, the PIP hidden, or the fallback accepted | A, E2E |
| MF-7 | Fallback accepted, then a take is assigned to beat 4 | Re-open review | The acceptance has lapsed; the take is used | A |
| MF-8 | Any fallback beat | Inspect the generated script and audio | No generated Prime dialogue or audio exists | A |

**Precedence**

| ID | Given | When | Then | Level |
|---|---|---|---|---|
| PR-1 | Values at [1], [2], [3a], [3b] for one property | Resolve | [3b] wins; remove [3b] → [3a]; remove [3a] → [2]; remove [2] → [1] | U |
| PR-2 | Scene hides `lamp` ([3]); timeline visibility segment shows it for 2 s ([4]) | Resolve across the segment | Visible only during the segment | U |
| PR-3 | Manual and generated entries at the same level and scope | Resolve | Manual wins | U |
| PR-4 | PIP beat rule hide; take missing; fallback designated | Resolve | Hidden (level 5 over 6) | U |
| PR-5 | Every level populated with manual entries | Regenerate everything | Every manual and approved entry unchanged; resolved frame identical (golden) | A, G |
| PR-6 | Same inputs | Resolve twice, in client and worker | Identical output (determinism) | U, G |

## 18. Earlier proposals that conflict with §12–§15

| Where | Earlier | Now |
|---|---|---|
| §7.4 (deleted master object) and SI-8 | Override rows become **Orphaned**, with "Keep as scene object" | Detached automatically (§12); orphan status is no longer used for scene objects |
| §7.3 index | `(scene_id, inherits_from_asset_id)` | Index on owner, view scope and `object_key` (§7.3, as revised) |
| §7.3 / §7.6 object identity | "The object key is the master row's `id`" (implied, not stored) | An explicit `object_key` column, so detached copies and views keep one identity |
| §7.6 keyframes | Keyed by object only | Keyed by `{object_key, view}`; view-scoped by default (§13.3) |
| §8.2 PIP track | No fallback | `fallback_asset_id`, and audio and video status kept separately (§14) |
| §9 "Orphaned" badge for scene objects | — | Replaced by the **Detached** badge. Orphaned still applies to line-anchored items (§4 Q5). |

## 19. Open owner decisions

**Resolved by this document:**
- Q2 (PIP source)
- Q3 (voices)
- Q4 (drawn from data by the Director)
- Q6 (script: Option A direction)
- Q-ST1 (inherit with overrides)
- Q-A1 (generated or assigned voices, with approval)

**Still open:**
- **Q1:** confirm that the "one Stage foundation" is the Scene Studio canvas in edit/preview/thumbnail modes.
- **Q-E1:** export size: quality vs platform aspect.
- **Q-C1:** remove or gate `test-create`.
- **Q-V1:** which generated-voice provider, and whose voices may be used (consent and licensing).
- **Q-V2:** may an outdated approved voice ship with an explicit accept, or must it be regenerated first?
- **Q-P1:** Part 2's required setup, compared with a normal Start.
- **Q-T1:** minimum cursor speed, minimum read hold, and which lines count as "gameplay-dependent" (§3.2 bounds).
- **Q-MD1:** how long is the Undo window for a master delete in draft scenes (proposed 30 days), and does "approved scene" mean the scene's own composition approval or the episode's acceptance (§12 treats either as approved)?
- **Q-VW1:** a set object added while editing one view: "Not placed" in the other views (proposed), or placed at the same fractional position?
- **Q-VW2:** may a Scene Set view be deleted while scenes use it, or must they be moved first?
- **Q-F1:** the fallback's home: a show-level asset with a new role (`PRIME.PIP.FALLBACK`), per-episode override allowed?
- **Q-F2:** does an unresolved fallback **block** export (proposed) or only warn?
- **Q-GD1:** share the Gameplay Director specification so it can be revised, or have a new one drafted from §11 as its own document.

**Decided by Evoni since the first draft of this document:** scene inheritance (§7), PIP visibility (§8), master deletion (§12), Front and Back View (§13), missing footage (§14), and the precedence order (§15).
