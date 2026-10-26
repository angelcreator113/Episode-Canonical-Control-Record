# Gameplay Director and animated export: implementation spec

**Status:** revision 4, final for planning (2026-10-26). Nothing here is built.

**Revision history**
- **Rev 1:** the first draft.
- **Rev 2:** Prime's performance, the Voice icon, decisions, scenes, overrides and ownership.
- **Rev 3:** the approved production architecture (C1–C6); the Timeline owns duration; a playback snapshot; no beat non-interactive by rule.
- **Rev 4:** Evoni's final recommendations and corrections:
  - marks first;
  - the voice rule by dialogue trigger;
  - NPC triggers;
  - approved audio sources;
  - failed attempts kept;
  - outdated detection and targeted regeneration, not redraft-on-save;
  - rendering deferred;
  - no dependency on the cursor tables;
  - preview snapshots kept apart from approved ones;
  - conflicts flagged;
  - visibility as a track setting shown in a Timeline lane;
  - Timeline proposals written only through the Timeline.

**Rulings this spec keeps** (Evoni, 2026-10-26, unless dated otherwise):
- The video export is a separate project; My Little List doesn't wait for it.
- The phone stays an interactive game interface, and the gameplay production system controls how it looks.
- No flattened checklist image is put into a scene.
- The no-overlays-on-beats switch (2026-10-07) stays.
- The Mouse Cursor and Grabbing Hand already in World → Overlays are reused, never regenerated.
- **One authoritative episode script.**
- **One shared Stage** (Scene Studio's composition foundation). The **Timeline** adds timing, animation and sequencing to that same composition, and owns final duration.
- **Prime's PIP is her recorded footage**: an editable layer, **visible by default** and controlled by hand. Take choice belongs to the PIP system. **Missing footage uses a designated fallback, with a warning.**
- **Lala and the NPCs use assigned or generated voices**, and each line uses its **explicitly approved audio source**.
- **Ordinary Lala dialogue needs a Voice-icon click**, decided by the line's trigger, never by its beat number. Approved wardrobe and notification reactions are automatic.
- **Front and Back View belong to the same Scene Set.**
- **Episode scenes inherit master objects and keep local customizations.** A customized object survives the master's deletion. **Gameplay references episode-scene objects**, never master ids.
- **Gameplay is generated automatically but stays editable.** Manual overrides and approved work are protected.
- **Preview and export use the same authoritative production data.**
- No merge, deploy or production-server change without Evoni's explicit approval.

---

## 1. The idea

The Gameplay Director is a pure compiler built on rules, not AI. From the systems that own the episode, it works out **what Prime does in the game, and when**: the script, the event, what Lala knows, the look, the coins, the Stage and Timeline, Prime's PIP takes and the dialogue voices.

**It owns three things:**
1. **The gameplay track:** generated actions plus Evoni's overrides. This includes track-owned **gameplay visibility**.
2. **Timeline proposals:** suggested camera moves, Front/Back View changes and object animations. They become Timeline data only when Evoni accepts them, and only through the Timeline's own interface (§6.3).
3. **Playback snapshots:** frozen, versioned copies of game state for playback. Temporary ones are for preview; the approved one is for export (§8).

**It owns nothing else.** Everything it shows is read from its owner.

## 2. The ownership boundary

| Kind of thing | Owner | Gameplay Director |
|---|---|---|
| Episode script, dialogue text, line identity (`line_key`) | **Architecture:** the one script and the `line_key` utility | Reads; anchors by `line_key` |
| Event, deliverables, opportunities | Their tables (`world_events`, `event_deliverables`, `opportunities`) | Reads into snapshots |
| What Lala knows | `lalaKnowledge` (#3599) | Reads into snapshots |
| Wardrobe, money, stats, tasks, My Little List | `episode_wardrobe` and `wornByBeat`; the ledger, `character_state` and `statsAt`; `episode_todo_lists` and the My Little List service | Reads into snapshots; the replay checks them; never writes |
| Phone screens and content | `ui_overlay_types`/`assets`; feed, DMs and profiles at the story moment | Reads into snapshots |
| **Stage composition** (episode-scene objects, master inheritance, local overrides) | **Architecture: shared Stage** | References episode-scene object ids |
| **Timeline** (scene order and final duration, object keyframes, camera keyframes, Front/Back angle changes, transitions) | **Architecture: Timeline**, written only through its own interface | Reads; *proposes* (§6.3) |
| **Prime PIP** (take choice, trim, offset, visibility, fallback, line and cue marks) | **Architecture: PIP system** | Reads marks as anchors |
| **Dialogue audio** (speaker, assigned voice, approved source, status, duration) | **Architecture: dialogue lines** | Reads the approved source |
| **Renderer, layout, mix plan, compositor** | **Architecture** | Adds gameplay layers (phone, cursor, toasts) and gameplay audio events (clicks, sounds) |
| Asset metadata (cursor and hand hotspots, sound library) | **Architecture** | Reads |
| **Gameplay track:** generated actions, overrides, gameplay visibility | **Gameplay Director** (`episode_gameplay_tracks`) | Owns |
| **Timeline proposals** (pending / accepted / rejected) | **Gameplay Director**, inside the track; once accepted, the item belongs to the Timeline | Owns the proposal, never the Timeline item |
| **Playback snapshots** (preview and approved) | **Gameplay Director** (`episode_playback_snapshots`) | Owns (derived copies) |

**Rules**
1. The generated actions and the snapshots can be rebuilt from their owners. Only overrides, visibility settings and proposal decisions are original data.
2. **Snapshots are playback copies, never a source.** Only preview and export read them, and nothing is written back.
3. The Director never writes Stage objects, Timeline items, PIP segments, dialogue audio or any owner's state.
4. Where an override and its owner disagree, the owner wins and the override goes to review (§7).
5. **No dependency on `cursor_actions` or `icon_cues`.** Their existence in production is unverified (§11), and nothing here reads them.

## 3. Timing: the Timeline owns duration; Prime's marks are anchors

**The Timeline owns the episode clock:** order, final durations, keyframes and transitions. Prime's recorded performance supplies **anchors**, never durations.

### 3.1 Anchors
- **First choice: the teleprompter's line and cue marks**, recorded on the PIP segment's take (architecture A2). They're mapped through the segment's trim and offset.
  - `line_start` / `line_end`: when Prime starts or finishes a line.
  - `cue_shown`: when the teleprompter showed her a `[UI:]` moment.
- **Without marks:** the script estimate (`lineSeconds`), spread across the Timeline's duration, labelled **estimated timing**.
- **Offline alignment** (analysing the take's audio) is a **future option**. It isn't planned or needed for the first build.
- `scene_start` / `scene_end` come from the Timeline. `after_action` is a fixed gap after another action.

An action is `{ anchor, offset }`. Its Timeline time is worked out from the current Timeline and PIP data.

### 3.2 Conflicts are flagged, never resolved silently

No approved performance is ever stretched, trimmed, sped up or shifted automatically.

| Conflict | Finding | Evoni chooses |
|---|---|---|
| The take is longer than the scene | `take_overruns_scene` | Extend the scene (Timeline) · trim the segment (PIP) · let it cut at the scene end |
| The take is shorter than the scene | `take_underruns_scene` | Shorten the scene · cover with the fallback · hold the last frame |
| An anchored action falls outside its scene | `anchor_outside_scene` | Move it · adjust the Timeline · re-pin it |
| A Lala or NPC line doesn't fit Prime's pause | `line_overruns_gap` | Hold the PIP frame · choose a shorter approved audio · re-record |
| No marks | `estimated_timing` | Nudge by hand |

Each choice is made in its owner's tool: the Timeline, the PIP system or dialogue. The finding only links there.

### 3.3 Reactions, pauses and decisions
- A surprise sits on its `cue_shown` mark, and gameplay holds until Prime's next line.
- A decision's press sits on the line where she decides.
- The cursor **may move while Prime talks**. It **rests** while Lala or an NPC speaks, and during a reaction hold.

## 4. Dialogue triggers and Lala's Voice icon

**The rule follows the line's trigger, never its beat number.**

| Line | Trigger | Voice click |
|---|---|---|
| **Ordinary Lala dialogue** | Prime clicks Lala's Voice icon | **Required:** one click per line, in any beat |
| **Wardrobe reaction** | Equipping a piece: inside `dressedAt` (the closet open, around a `[WEAR:]`) | Not needed (automatic) |
| **Notification reaction** | The next Lala line after `[UI:NOTIFY]`, `[UI:DM]` or `[MAIL:]` | Not needed (automatic) |
| `Lala (auto):` | Valid only as one of the two reactions above | A finding when it has neither trigger |
| `Lala (V.O.):` (her thoughts) | Not dialogue | Not needed (as today; see decision G-4) |
| **NPC conversation** | **Clicking the NPC** (`[UI:CLICK <name>]`), **opening a DM** (`[UI:DM <name>]` / `[UI:OPEN DM <name>]`), or **an explicit scripted event** (`[TALK: <name>]`, a new cue) | No Voice click (they aren't Lala); the conversation's lines follow its trigger |

**Beat-number exemptions are removed.** Today `scriptShowRules` exempts beats 11–13 as a cutscene (`isCutsceneBeat`). GD-2 replaces that with trigger-based rules: an ordinary Lala line in a cutscene beat needs a click like any other, and NPC lines there need one of the three triggers. Scripts already written may gain findings, which flag and never block.

**Emitted actions** for an ordinary Lala line:
1. `cursor.move` to the Voice zone;
2. `cursor.press` with the `click` sound;
3. `voice.on` ("Lala speaks");
4. then `lala.line`.

Automatic reactions and NPC lines get no click; each line is marked with its trigger.

**Audio:** every Lala and NPC line plays its **explicitly approved audio source** from dialogue lines. That may be Evoni's recording or a generated clip, whichever she approved. A line with **no approved source** is a finding (`line_audio_unapproved`). In preview it plays silent with a marker; export is blocked until it is resolved.

**Findings** (Script tab health, one list):
- `lala_unvoiced`
- `auto_without_trigger`
- `npc_without_trigger`
- `voice_click_unreachable`
- `line_audio_unapproved`

The Director never edits the script on its own.

## 5. Decisions, backtracking and failed attempts

**Script verbs:**
- `[UI:HOVER x]`
- `[UI:PREVIEW piece]`
- `[UI:COMPARE a | b]`
- `[WEAR: id]`
- `[UI:UNEQUIP id]` (or a second `[WEAR]` in the same slot)
- `[UI:BACK]`, `[UI:CLOSE x]`, `[UI:OPEN x]`
- `[UI:WAIT n s]`
- `[UI:TRY action]`
- `[TALK: name]`

**Rules**
- The `[WEAR]` sequence ends on the look locked in `episode_wardrobe`.
- A **read-only replay** checks the script against the owners' rules: coins and `coinBalanceGuard`'s refusal, the closet and pool, reachable screens (`phonePaths`), and knowledge.
- **Failed attempts are kept and shown.** A `[UI:TRY]` the game refuses plays as `action.refused`, with **game-appropriate feedback**: the real screen's own refusal (a shake, the game's message such as "Not enough coins", the `error` sound). The script's following lines are the recovery.
- A refusal the script didn't mark as an attempt is a finding, never a silent success.

## 6. Scenes, Stage and Timeline

### 6.1 Where each scene happens
- `scene_plans` holds each beat's Scene Set and angle, plus `transition_in`.
- **Front and Back View are angles of the same Scene Set.**
- The Director emits `scene.enter` and `venue.enter` as gameplay context.
- Any camera or angle *change* is a **proposal** (§6.3), never a write.

### 6.2 Objects
- **Composition:** the shared Stage's episode-scene objects. They inherit master objects and keep local overrides; a customized object survives the master's deletion.
- **Gameplay references episode-scene object ids**, never master ids.
- A line that needs a character or prop the scene doesn't have produces a finding ("Place Nia in this scene").

### 6.3 Timeline proposals (the Director never owns Timeline data)

The Director can **suggest** Timeline changes that gameplay implies:
- **camera moves:** push in on the phone while Prime reads her list;
- **Front/Back View changes:** cut to the venue's Back View as she leaves;
- **object animations:** Lala's figure turning to the mirror on `[WEAR]`.

| Step | What happens | Who writes |
|---|---|---|
| 1. Propose | The Director stores the proposal in the track: kind, target (episode-scene object id, or angle id **within the scene's Scene Set**), anchor, suggested values, reason, and status `pending` | Director (track) |
| 2. Show | The Timeline shows pending proposals as **ghost items** in their lanes, never as real items | Timeline UI, reading the track |
| 3. Accept | Evoni accepts one, or a scene's worth. The Director calls the **Timeline's authoritative interface** (`timeline.applyProposal(proposal)`, architecture A5). The Timeline validates it and writes its own item | **Timeline only** |
| 4. Record | The proposal becomes `accepted`, with the Timeline item's id. **From then on the item is the Timeline's.** Editing or deleting it on the Timeline is final, and the Director never re-creates it | Director (proposal status only) |
| 5. Reject | It becomes `rejected` and is **not proposed again** for the same anchor, unless its source changes and Evoni asks for targeted regeneration | Director (proposal status) |

A proposal whose target vanished (object deleted, angle removed) becomes `stale`, is listed, and can't be accepted.

### 6.4 No beat is non-interactive by rule
- **The script decides where gameplay is.** Any beat with `[UI:]`, `[WEAR]`, `[DELIVER]` or `[TALK]` lines gets gameplay actions, outcome and deliverable beats included.
- A beat with only a cutscene clip has no gameplay actions. Nothing hides them; there are none.

### 6.5 Gameplay visibility: a track setting, shown as a Timeline lane
- Whether the phone, cursor and toasts show in a scene or time range is a **track-owned setting**. By default it follows the script: shown where there are gameplay actions.
- The Timeline shows it as a **"Gameplay" lane** that reads and writes the track's setting through the Director's interface.
- The Timeline doesn't store it.
- **Prime's PIP visibility is not this setting.** It belongs to the PIP system (visible by default, manual control).

### 6.6 Layer order (bottom to top)
1. Scene (angle and Stage objects)
2. Prime's PIP (placed by the PIP system's layout)
3. Phone
4. Overlays (only from real `timeline_placements`)
5. Toasts
6. Cursor
7. Audience stats panel (when the script shows it)

## 7. Outdated detection and targeted regeneration

**Nothing redrafts on save.**

- **Start Episode** creates an empty track. The **first draft** is made when Evoni asks for it (Draft gameplay).
- **Outdated detection.** The track keeps each scene's input fingerprint: script lines by `line_key`, the event package, phone layout, Stage objects, Timeline, PIP segments and dialogue audio. When an input changes, the affected scenes read **outdated**, and the changes are listed (lines edited, objects removed, take changed…). Nothing is regenerated by that.
- **Targeted regeneration.** Evoni chooses what to regenerate: one action, one scene, or every outdated scene. Regeneration rebuilds **only the generated actions** of what she chose.
  - **Overrides and approved work are preserved.** An override is re-applied by its anchor id.
  - An override whose anchor still means the same thing is **kept**.
  - An override on an edited line is marked **check**.
  - An override whose anchor is gone is **orphaned** (listed, never dropped).
  - An override that no longer fits is a **conflict** (keep and adjust, drop, or re-pin).
  - Accepted Timeline proposals are untouched (they're the Timeline's). Rejected ones stay rejected unless their source changed.
  - Locked beats (`script_locked_beats`, `scene_plans.locked`) are never regenerated; a source change there becomes a conflict.
- **Approval is per scene.**
  - An approved scene that becomes outdated stays approved: its approved snapshot still plays, flagged "inputs changed since approval".
  - Regenerating it creates a **new draft** beside the approved one.
  - The approved version is replaced only when Evoni approves the new one.

**Overrides** (keyed by anchor id):

| Override | Example |
|---|---|
| Timing | +0.3 s on a voice click |
| Cursor | A path point, a longer hover |
| Hold | A pause after the runway notification |
| Gameplay visibility | Hide the cursor in this range |
| Off | Don't show this hover |

**Not overrides here:** take choice, trim and PIP visibility (PIP); shots, angles and durations (Timeline); dialogue text (script); audio source (dialogue).

## 8. Playback snapshots: temporary for preview, approved for export

Live answers change, so playback uses a snapshot: the game state at every position the track uses, resolved through **the owners' own read paths**. The same services as the live API, so there's no second logic.

**Contents:**
- knowledge states;
- the phone's screen stack and each screen's content at that story moment;
- My Little List (public fields only);
- wardrobe worn so far and the locked look with its costs;
- `statsAt` and the coin moves shown;
- story-time delivery;
- asset URLs and content hashes.

**Production labels are never included.**

| | **Preview snapshot** | **Approved snapshot** |
|---|---|---|
| Made | Whenever a preview needs one; cached by input hash | Only when Evoni explicitly approves the track (per scene, or the episode) |
| Lifetime | Temporary; replaced freely; cleared after a set age | Frozen; never modified; superseded only by the next explicit approval |
| Used by | Preview only | **Export only** (and "play approved" in preview) |
| Approves anything? | **Never.** Playing a preview approves nothing and never replaces the approved snapshot | — |

**Storage:**
- `episode_playback_snapshots`: `id`, `episode_id`, `kind` (`preview` \| `approved`), `version`, `track_version`, `inputs_hash`, `s3_key`, `created_at`, `approved_at`, `deleted_at`.
- The body is JSON in S3.
- A new migration, run through the Deploy workflow.

**Outdated:** when an owner's input hash changes after approval, export still uses the approved snapshot. The episode shows "inputs changed since approval"; re-approving is Evoni's choice.

## 9. Assets
- **Cursor and hand:** the existing World → Overlays types, with hotspots (architecture A7). Never regenerated.
- **Sounds:** the show's sound library (architecture A7), licensed files only. A missing slot plays nothing, with a warning.
- **Prime fallback:** the PIP system's designated fallback, with `prime_footage_missing`. The Director lays it out like Prime and never invents footage.

## 10. Preview and export behaviour

**The rendering infrastructure is deferred to the export phase.** That covers the render host, the queue, Chromium on the server, storage retention and 9:16. This spec fixes only the **behaviour**:
- **Preview** plays the latest **preview snapshot** plus the **draft or approved track**. The non-video layers come from the architecture's shared renderer; the PIP and video from the same layout; audio from the one mix plan.
- **Export** plays **only the approved snapshot plus the approved track**, through the same renderer contracts and mix plan.
- Both use the same layout, the same gameplay layers and the same mix plan. The only differences are the clock (real time or virtual) and which snapshot.

## 11. The cursor tables
- **Not a dependency.**
- `cursor_actions`, `icon_cues` and `icon_slot_mappings` are created only by a migration tree that doesn't run, and the register records them as absent from the 2026-08-29 canon capture. Their existence today is **unverified**.
- If Evoni ever runs the read-only check, the result only affects the old Icon Cue pages (an audit finding), not this spec.

---

## 12. Episode 1 walkthrough

Times are illustrative and come from the Timeline. Prime's PIP is visible throughout, bottom-right.

| Time | Prime (PIP: her take) | Lala | Cursor and phone | Sound | Owner of the timing |
|---|---|---|---|---|---|
| 0:00 | "Morning, everyone." Scene: home, Front View | — | — | — | Timeline (scene start) |
| 0:06 | "Let's see what Lala's up to." | — | Cursor moves to the phone while she talks; press; **phone opens** | `click`, `open` | Prime's line mark |
| 0:12 | "Lala, good morning!" | — | Cursor to **Voice**; press; "Lala speaks" | `click`, `voice_on` | Before Lala's line |
| 0:13 | Quiet (her pause) | "Morning! Big day?" (approved source) | Cursor rests | — | Lala's line in Prime's gap |
| 0:31 | Reacts on her cue mark | — | **Notification** toast: a letter arrives | `notify` | Cue mark |
| 0:33 | — | Automatic reaction: "Ooh, mail!" (no click) | Rests | — | Notification trigger |
| 0:40 | Reads it | — | Invitation opens; then the offer letter | `open` | Line marks |
| 1:05 | "Can we afford this?" | — | Coins screen: the snapshot's `statsAt` | `click` | Line mark |
| 1:30 | "The gold ones." | — | Hover, compare two heels, `[WEAR]` press on her line | `click`, `tick` | Line mark (decision) |
| 1:32 | — | Wardrobe reaction (no click) | Rests | — | Wardrobe trigger |
| 1:45 | "Let me check my list." | — | **My Little List** opens; the outfit item ticks | `open`, `tick` | Line mark |
| 2:10 | "Okay, heading out." | — | Phone closes. **Proposal:** cut to the venue's Front View (accepted on the Timeline) | `close`, `whoosh` | Timeline (accepted proposal) |
| 2:40 | Reacts | — | Click on **Nia** at the venue: NPC conversation | `click` | NPC trigger |
| 2:41 | Quiet | Nia's lines (approved source) | Rests | — | NPC trigger |
| 3:05 | "Posting it now." | — | Post screen; press; the list's video item ticks | `click`, `tick` | Line mark (outcome beat, gameplay allowed) |
| 3:30 | Surprise, on her cue mark | — | DM toast: the runway; `list.appear` | `notify` | Cue mark |
| 3:32 | — | Automatic reaction to the DM (no click) | — | — | Notification trigger |
| 3:50 | Sign-off | — | Stats panel from the snapshot | — | Timeline (scene end) |

---

## 13. Acceptance tests: gameplay preview and export

**Voice and triggers**
1. Every ordinary Lala line in any beat, beats 11–13 included, has a Voice click 0.3–0.5 s before it. A line without one is `lala_unvoiced`.
2. Wardrobe and notification reactions have no click. `Lala (auto):` outside those triggers is `auto_without_trigger`.
3. NPC lines start only from a click on the NPC, a DM or `[TALK:]`; otherwise `npc_without_trigger`.
4. Each Lala and NPC line plays its approved audio source. A line without one is flagged, plays silent in preview, and blocks export.

**Timing**
5. Actions sit on line and cue marks when present; estimates are labelled.
6. A take longer or shorter than its scene, an action outside its scene, and a line overrunning Prime's gap each give their finding. **No duration, trim or speed changes on its own.**

**Gameplay and state**
7. A refused `[UI:TRY]` shows the game's own refusal and sound; an unmarked refusal is a finding.
8. The `[WEAR]` sequence ends on the locked look; the replay writes nothing.
9. No list item, post, DM or name appears before Lala learns it; no production label appears in any snapshot.

**Timeline proposals**
10. A pending proposal shows as a ghost item and changes no Timeline data.
11. Accepting writes only through `timeline.applyProposal`; the Timeline item then belongs to the Timeline, and later Timeline edits are never undone by the Director.
12. A rejected proposal isn't offered again for the same anchor.
13. A proposal can only target an episode-scene object or an angle of the scene's own Scene Set.

**Regeneration**
14. Saving the script or another input marks the affected scenes **outdated**, with the changes listed, and regenerates nothing.
15. Regenerating one scene leaves other scenes, all overrides (kept, check, orphaned or conflict, never dropped), accepted proposals and locked beats untouched.
16. Regenerating an approved scene makes a new draft; the approved version and its snapshot stay until Evoni approves the new one.

**Snapshots and parity**
17. Playing a preview creates or reuses a **preview** snapshot and never creates, changes or replaces the **approved** one.
18. Rebuilding a snapshot from unchanged inputs gives byte-identical JSON.
19. Export reads only the approved snapshot and approved track. A live data change after approval doesn't change the export, and the episode shows "inputs changed since approval".
20. **Preview of the approved version and export match:** the non-video layers' frame hashes match at every action time; the video layers use the same layout; every audio event lands within one frame.

**PIP and assets**
21. Prime's PIP shows in every scene unless hidden in the PIP system. Missing footage shows the fallback, with `prime_footage_missing`.
22. Cursor and hand use the existing Overlays assets with their hotspots. A missing sound plays nothing and warns.

---

## 14. What architecture must deliver before gameplay implementation starts

| # | Architecture deliverable | Needed by | Blocks |
|---|---|---|---|
| A1 | **`line_key`** utility and dialogue-line identity | Anchors, overrides, outdated detection | GD-3 |
| A2 | **Teleprompter line and cue marks** on takes | Anchors (else estimates) | GD-3 (soft) |
| A3 | **PIP segments**: take choice, trim, offset, visibility, fallback and warning, marks exposed per segment | Anchors; PIP layer | GD-3, GD-7 |
| A5 | **Timeline on the shared composition**: object and camera keyframes, angle changes within a Scene Set, **`timeline.applyProposal`** (validated write), a **lane API** for the Gameplay lane | Proposals; visibility lane | GD-6, GD-7 |
| A5 | **Episode-scene objects** with master inheritance and local overrides, and stable ids | Object references | GD-3 |
| A6 | **Dialogue lines**: assigned voice, **approved audio source**, duration, status | Line audio, `line_overruns_gap` | GD-3, GD-7 |
| A4 | **`StageRenderer` and `layoutAt`**, with hooks for gameplay layers (an HTML phone, cursor, toasts) | Preview | GD-7 |
| A8 | **Mix plan** that accepts gameplay audio events | Preview and export audio | GD-7 |
| A7 | **Cursor and hand hotspots; sound library** | Cursor layer, sounds | GD-7 |
| A9 | **Compositor** (export phase) | Export | Export phase only |

**What can start before any of this:**
- **GD-2:** trigger-based voice rules and the new findings, a `scriptShowRules` change;
- **GD-5:** closet hover, preview, compare and undo.

Both are self-contained.

## 15. Gameplay PR sequence

Each step is its own PR with its own approval.

| # | PR | Needs |
|---|---|---|
| GD-0 | This spec (#3600) | — |
| GD-2 | Trigger-based voice rules: drop the beat exemption; `auto_without_trigger`, `npc_without_trigger`; `[TALK:]` | — |
| GD-4 | Script verbs; `[TRANSITION]` read as a proposal | GD-2 |
| GD-5 | Closet decisions in `EpisodeWardrobeGameplay` | — |
| GD-3 | Director core: anchors, triggers, replay, findings, proposals (in memory) | A1, A2, A3, A5 (objects), A6 |
| GD-6 | Track storage, overrides, visibility, proposals, outdated detection, targeted regeneration, preview and approved snapshots | GD-3, A5 (`applyProposal`, lane API); migrations through Deploy |
| GD-7 | Preview player and approval | A4, A7, A8, GD-6 |
| Export phase | Render mode, compositor, infrastructure decisions | A9, GD-7, Evoni's infrastructure decisions |

---

## 16. Decisions

**Settled** (Evoni, 2026-10-26):
- marks first, with offline alignment as a future option;
- the voice rule by trigger;
- NPC triggers (click, DM, scripted event);
- approved audio sources;
- failed attempts kept with game feedback;
- outdated detection and targeted regeneration;
- rendering infrastructure deferred;
- no cursor-table dependency;
- preview and approved snapshots kept apart;
- conflicts flagged;
- visibility as a track setting shown in a Timeline lane;
- proposals applied through the Timeline;
- the Timeline owns duration;
- the PIP owns takes;
- scene objects inherit masters with local overrides.

**Still needing Evoni's creative decision:**

| # | Decision | Default until decided |
|---|---|---|
| G-1 | **Cursor feel:** speed, arc and how much natural wobble; whether it idles while Prime chats | Moderate speed, gentle arc, slight seeded wobble, small idle drift |
| G-2 | **The sound palette:** which sounds fill `click`, `tick`, `open`, `close`, `notify`, `error`, `voice_on`, `whoosh` | Silent slots, with a warning |
| G-3 | **Failed-attempt style:** the shake and wording when the game refuses ("Not enough coins") | The game's existing refusal text, a short shake |
| G-4 | **Lala's thoughts (`V.O.`):** stay click-free as "not dialogue"? | Click-free (as today) |
| G-5 | **Prime's PIP look:** corner, size, cut-out or frame (the PIP system's controls) | Bottom-right, about 28% width, cut-out when keyed |

**Deferred to the export phase:** render host, queue, render retention on S3, 9:16 format.
