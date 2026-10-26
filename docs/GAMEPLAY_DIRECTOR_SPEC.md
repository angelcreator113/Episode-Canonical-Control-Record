# Gameplay Director and animated export: implementation spec

**Status:** revision 3 of a proposal. Nothing here is built.

**Revision history**
- **Rev 1** (2026-10-26): the first draft.
- **Rev 2:** Prime's performance, the Voice icon, decisions and recovery, scenes, overrides and ownership, after Evoni's first review.
- **Rev 3:** brings in the approved production architecture (`docs/STAGE_PIP_VOICE_PLAN.md`, decisions C1–C6) and Evoni's three corrections:
  1. The Timeline owns duration.
  2. A deterministic playback snapshot.
  3. No beat is non-interactive by rule.

**Rulings this spec keeps** (Evoni, 2026-10-26, unless dated otherwise):
- The video export is a separate project; My Little List doesn't wait for it.
- The phone stays an interactive game interface, and the gameplay production system controls how it looks.
- No flattened checklist image is put into a beat's scene.
- The no-overlays-on-beats switch (2026-10-07) stays.
- The Mouse Cursor and Grabbing Hand already in World → Overlays are reused, never regenerated.
- **One authoritative episode script.**
- **One shared Stage**, on Scene Studio's composition foundation. The Timeline adds timing, animation and sequencing to that same composition.
- **Prime's PIP is her recorded footage**: an editable layer, **visible by default** and shown or hidden by hand. **Missing footage uses a designated fallback, with a warning.**
- **Lala and the NPCs use assigned or generated voices.** Lala normally speaks only after the Voice icon is clicked, except for approved automatic triggers.
- **Front and Back View belong to the same Scene Set.**
- **Episode scenes inherit master objects but keep local customizations.** A customized object survives the master's deletion.
- **Gameplay is generated automatically but stays editable**, and manual overrides are protected.
- **Preview and export use the same authoritative production data.**
- No merge, deploy or production-server change without Evoni's explicit approval.

---

## 1. The idea

The Gameplay Director is a pure compiler built on rules, not AI. From the systems that own the episode, it works out **what Prime does in the game, and when**: the script, the event, what Lala knows, the look, the coins, the Stage and Timeline, Prime's PIP takes, and the dialogue voices.

Its output is a **gameplay track**: actions anchored to the script and to Prime's performance, plus Evoni's overrides on a layer of their own.

Before anything plays, the track is paired with a **playback snapshot**: the game state at every moment the track shows, frozen and versioned (§8). Preview and export both read the track version and the snapshot version, never the live system.

**The Director owns only the gameplay actions, Evoni's adjustments to them, and the snapshot it derives.** Everything it shows comes from the system that owns it.

## 2. Who owns what (shared with the architecture session)

| Kind of thing | Owner | How the Director uses it | What the Director stores |
|---|---|---|---|
| Episode story and dialogue text | **The one episode script** (`episodes.script_content`, history and locks). The architecture session confirms this against `episode_scripts` | Reads lines, speakers and tags by **`line_key`** | Line anchors by `line_key`. Never the text |
| Line identity | **`line_key`** utility (architecture session) | Keys anchors and overrides | — |
| Event information | `world_events` (documents, terms), `event_deliverables`, `opportunities` | Reads them into the snapshot | Snapshot copy only (§8) |
| What Lala knows | Worked out by `lalaKnowledge` (PR #3599) | Resolves it into the snapshot | Snapshot copy only |
| Wardrobe state | `episode_wardrobe` (the locked look) and the script's `[WEAR]` (`wornByBeat`) | Into the snapshot | Snapshot copy only |
| Money and stats | The ledger and `character_state` (`coinBalanceGuard`); `lalaStats.statsAt` | Into the snapshot | Snapshot copy only |
| Tasks and My Little List | `episode_todo_lists` plus the My Little List service | Into the snapshot | Snapshot copy only |
| Phone layout and content | `ui_overlay_types`/`assets` (screens, zones); feed, DMs and profiles at the story moment | Into the snapshot | Snapshot copy only |
| **Stage composition** | **Shared Stage:** episode-scene objects on Scene Studio's foundation, inheriting master objects with local overrides (architecture session) | References **episode-scene object ids**, never master ids | Object ids |
| **Timing, animation, sequencing, final duration** | **Timeline:** scene order and duration, object and camera keyframes, `scene_plans.transition_in` | Places actions on the Timeline's clock (§3) | Anchors and offsets |
| **Prime's footage, take choice, trim, visibility, fallback** | **PIP system:** performer segments over the raw takes (architecture session) | Line and cue marks become timing anchors (§3) | Nothing. **No take choice in the track** |
| Lala and NPC voices | **Dialogue lines:** speaker, assigned voice, source, status, duration, by `line_key` (architecture session) | Places lines and checks they fit | Nothing |
| Render geometry and mix | **`layoutAt`, `StageRenderer`, the mix plan and the compositor** (architecture session) | Adds gameplay layers (phone, cursor, toasts) and gameplay audio events (clicks, sounds) | — |
| Gameplay actions | **`episode_gameplay_tracks`** (this spec) | — | Generated actions and Evoni's overrides |
| Playback state | **`episode_playback_snapshots`** (this spec): a frozen, derived projection | — | The snapshot (§8) |

**Rules**
1. The generated layer and the snapshot can always be rebuilt from their owners. Only the override layer is original data.
2. **The snapshot is a frozen copy for playback, never a source.** Nothing reads it except preview and export, and nothing is ever written back from it.
3. The Director never writes Stage objects, PIP segments, dialogue clips, Timeline durations or any owner's state.
4. Where an override and its owner disagree, the owner wins and the override goes to review (§7).
5. The cursor tables (`cursor_actions`, `icon_cues`) are not a source (§11).

## 3. Timing: the Timeline owns duration; Prime's takes are anchors

**The Timeline owns the episode clock.** That covers the order of scenes and beats, each scene's final duration, keyframes and transitions.

Prime's recorded performance **does not set the duration automatically**. It supplies **timing anchors**, and where the takes and the Timeline disagree, the conflict goes to review.

### 3.1 Anchors

Every gameplay action is placed relative to an anchor, then mapped onto the Timeline's clock:

| Anchor | Means | Source |
|---|---|---|
| `scene_start` / `scene_end` | The Timeline's own boundaries | Timeline |
| `line_start` / `line_end` | When Prime starts or finishes a line | PIP segment's **line marks** (teleprompter), mapped through the segment's trim and offset; else the script estimate (`lineSeconds`), spread across the Timeline's duration |
| `cue_shown` | When the teleprompter showed Prime a `[UI:]` moment | PIP segment's **cue marks** |
| `after_action` | A fixed gap after another action | The Director's rules |

An action is stored as `{ anchor, offset }`. Its time on the Timeline is worked out from the current Timeline and PIP data, so editing either moves the action with it.

### 3.2 When the takes and the Timeline disagree

These are findings for review. Nothing is resolved silently.

| Conflict | Shown as | Choices (Evoni) |
|---|---|---|
| The selected take is **longer** than the scene's Timeline duration | `take_overruns_scene` (by N s) | Extend the scene on the Timeline · trim the PIP segment · keep both and let the PIP cut at the scene end |
| The take is **shorter** | `take_underruns_scene` | Shorten the scene · let the PIP's fallback cover the rest · loop the PIP's last frame |
| An action anchored to a line falls **outside** its scene | `anchor_outside_scene` | Move the action · adjust the Timeline · re-pin it |
| A generated Lala or NPC line doesn't fit the gap Prime left | `line_overruns_gap` | Hold the PIP frame · shorten the line (regenerate) · re-record |
| No marks (an older take, or no "Follow my voice") | `estimated_timing` | Nudge the actions by hand |

### 3.3 Reactions, pauses and decisions

- A surprise sits at its `cue_shown` mark. Gameplay holds until Prime's next line anchor, so her reaction is never covered by motion.
- A decision's press ("the gold ones") sits on that line's anchor. Hovering and comparing (§5) fill the lines before it.
- The cursor **may move while Prime talks**, because she narrates while she plays. It **rests** while Lala or an NPC speaks, and during a reaction hold.
- Two ways to work, both supported: **record, then direct** (the default), or **direct, then record**, where the teleprompter shows the drafted track and the take's cue marks re-anchor it.

## 4. Lala's Voice icon

The rule and its exceptions live in `utils/scriptShowRules` (backend, with a frontend twin covered by a parity test). The Director calls `voiceOffLines` and `dressedAt`; it doesn't write a second rule engine.

| Lala line | Allowed when | In code today |
|---|---|---|
| An ordinary line | Right after a click on Lala's Voice icon: one click, one line (`isVoiceOn`) | Yes |
| `Lala (V.O.):`, her thoughts | Always | Yes |
| **Automatic wardrobe reaction** | Inside `dressedAt`: the closet is open, the line just before a `[WEAR:]`, or the first line after it | Yes |
| **Automatic reaction to a notification** | The next Lala line after `[UI:NOTIFY]`, `[UI:DM]` or `[MAIL:]` | Yes (`MESSAGES`) |
| `Lala (auto):` lines | Today, anywhere | Too loose. Decision D-3 limits them to the two triggers above |
| **NPC conversations** | Today only in beats 11–13 (`isCutsceneBeat`). An approved trigger elsewhere is decision D-4 | Partly |

**Emitted actions**
- For an ordinary line: `cursor.move` to the Voice zone, `cursor.press` with the `click` sound, and `voice.on` ("Lala speaks"), all anchored before the line. Then `lala.line`, whose audio comes from the dialogue line's clip.
- For an exception: no click, and the line is marked with its reason.

**Findings** (Script tab health, one list):
- `lala_unvoiced`, the existing finding, fixed by the existing fix;
- `auto_without_trigger` (D-3);
- `npc_without_trigger` (D-4);
- `voice_click_unreachable`.

The Director never edits the script on its own.

**Note on beats 11–13:** today `scriptShowRules` exempts them from the click rule as a cutscene. Rev 3 doesn't treat them as non-interactive (§6.4). Whether the click rule should apply in those beats when the script puts gameplay there is decision D-12.

## 5. Decisions, backtracking and recovery

**Script verbs** use the same `[UI:]` form; the parser and writers learn them in one PR:

| Verb | Shows |
|---|---|
| `[UI:HOVER x]` | The cursor resting on x |
| `[UI:PREVIEW piece]` | The piece's detail card |
| `[UI:COMPARE a \| b]` | Two pieces side by side |
| `[WEAR: id]` | Equip, as today |
| `[UI:UNEQUIP id]`, or a second `[WEAR]` in the same slot | Reconsider |
| `[UI:BACK]`, `[UI:CLOSE x]`, `[UI:OPEN x]` | Leave or return to a screen |
| `[UI:WAIT n s]` | Hold |
| `[UI:TRY action]` | An attempt that may be refused |

**Rules**
- The `[WEAR]` sequence must end on the look locked in `episode_wardrobe`. The script tells the story of choosing; the lock is the choice.
- A **read-only replay** checks the script against the owners' rules: coins under `coinBalanceGuard`'s refusal and the look's charges, the closet and pool, reachable screens (`phonePaths`), and what Lala knows. It writes nothing.
- A refused attempt becomes `action.refused`: a shake, the game's own message, and the `error` sound. The script's following lines are the recovery.
- An unintended refusal (not a `[UI:TRY]`) is a finding.

## 6. Scenes, Stage and Timeline

### 6.1 Where each beat happens

`scene_plans` holds each beat's Scene Set and angle (`planLocationsService`, `beatLocations`), plus `transition_in`. **Front and Back View are angles of the same Scene Set** (`scene_angles.angle_kind`). The Director emits:
- `scene.enter`: the set and angle, using the Timeline's transition;
- `venue.enter`: e.g. beat 10 on the venue's front, then inside at beat 11, all within one set;
- `camera.view`: a shot within a scene. It may use **only angles of that scene's Scene Set**, and is placed on the Timeline's camera track (§6.3).

### 6.2 Objects, inheritance and references

- **Composition** is the shared Stage: episode-scene objects on Scene Studio's foundation (`scene_assets`).
- An episode scene **inherits the master objects** of its Scene Set and **keeps local overrides**, copy-on-write: a changed object becomes the scene's own. A customized object **survives the master's deletion**. This is owned and specified by the architecture session.
- **Gameplay references episode-scene object ids**, never master ids, so an action pointing at "Nia's chair" stays valid if the master object changes or is deleted.
- A script beat that needs a character or prop the scene doesn't have produces a finding: "Place Nia in beat 11's scene."
- **Movement over time** is the Timeline's: per-object keyframes, and camera keyframes for the whole scene (the architecture plan). The Director refers to keyframes; it doesn't author or store motion.

### 6.3 Transitions and shots

- **Between scenes:** `scene_plans.transition_in`, owned by the Timeline. The script's `[TRANSITION: …]`, which the parser ignores today, is parsed and **proposed** as `transition_in` for Evoni to accept, never written on its own.
- **Within a scene:** a `camera.view` is written to the **Timeline's camera track**, as a cut or keyframe there, so the Timeline stays the one place for shots. The track keeps only the action that asked for it.

### 6.4 No beat is non-interactive by rule

Beats 11–13 are often staged as an AI-video cutscene, but **some outcome or deliverable beats include gameplay**: posting the Reel at the event, checking a DM at the venue, a stats moment. Rev 3 doesn't assume any beat has no phone or cursor:
- **The script decides.** A beat with `[UI:]`, `[WEAR]` or `[DELIVER]` lines gets gameplay actions, whatever its number.
- **The approved track decides what shows.** Evoni can turn gameplay layers on or off per scene through overrides.
- A beat with a cutscene clip and no gameplay lines simply has no gameplay actions. Nothing hides them; there are none.
- **Prime's PIP shows by default in every beat.** Hiding it is a manual PIP control, not a beat rule.

### 6.5 Layer order (bottom to top)

1. Scene (the angle's still or video; the Stage's objects).
2. Prime's PIP (its own layer, never baked in), unless the PIP system places it elsewhere.
3. The phone (when the track shows it).
4. Overlays (only from real `timeline_placements`, with the beat switch respected).
5. Toasts.
6. Cursor.
7. The audience stats panel, when the script displays it.

The PIP's position in this order is set by the PIP system's layout.

## 7. Regeneration and creative overrides

- **Drafting:**
  - Start Episode creates an empty track.
  - Every save of the script, the event package, the phone layout, the Stage, the Timeline or the PIP segments redrafts the generated actions of the scenes it touches. This is pure work, with no AI cost.
  - A draft is never approved automatically.
- **Stable anchor ids:** each id is the source's `line_key`, the `[WEAR]` piece id, the item key or the episode-scene object id, plus a role.
- **Overrides,** kept separately and keyed by anchor id:

| Override | Example |
|---|---|
| Timing | +0.3 s on the voice click before a line |
| Cursor | A path control point, a longer hover |
| Hold | 1.5 s after the runway notification |
| Gameplay layer | Show the phone in beat 12 / hide the cursor in beat 13 |
| Off | Don't show this hover |

  **Not overrides here:**
  - take choice, trim and PIP visibility (the PIP system);
  - shots and durations (the Timeline);
  - dialogue text (the script);
  - voice or audio (dialogue lines).

  The Director's preview opens those owners' controls rather than copying them.
- **After a change**, each override is one of:
  - **kept**, when its anchor survives with the same meaning;
  - **check**, when the line was edited but kept its place;
  - **orphaned**, when its anchor is gone: listed and never dropped silently;
  - **conflict**, when it no longer fits: keep and adjust, drop, or re-pin.
- **Locked beats** (`script_locked_beats`, `scene_plans.locked`) don't redraft; a source change there becomes a conflict.
- Approval is **per scene**. An approved scene stays approved until a redraft touches it.

## 8. The playback snapshot: deterministic phone and gameplay

Live API answers change as the show moves on: a post goes live, a deliverable is approved, coins move. **Export must not depend on them.**

**What it is:** the playback snapshot is everything the gameplay layers draw, resolved from the owners **once** and frozen.

**Contents.** For each position the track uses (scene, beat and line, at each action and each change), it holds:
- **Story knowledge:** the `lalaKnowledge` states known.
- **Phone:** the screen stack, and each screen's content at that story moment (feed posts and DMs as of their reveal, profile cards, notifications).
- **My Little List:** the public list (the same safe fields as its API).
- **Wardrobe:** pieces worn so far (`wornByBeat`), the locked look, and what each costs.
- **Coins and stats:** `statsAt`, and the coin moves the script shows.
- **Tasks and deliverables:** story-time delivery (`[DELIVER]`). Production status is shown only when the script displays it.
- **Assets:** the URLs, plus content hashes, of every image, cursor, hand and sound used.

**Storage:** `episode_playback_snapshots` (`id`, `episode_id`, `version`, `track_version`, `inputs_hash`, `s3_key`, `created_at`, `approved_at`, `deleted_at`). The body is JSON in S3, because it may be large. The row is new; the migration runs through the Deploy workflow.

**Lifecycle**
1. **Build.** When Evoni approves the track (or asks for a preview), the Director resolves every position through the owners' own read paths: the same services the live API uses, so there's no second logic.
2. **Freeze.** It writes the version, the input hashes (script, Stage, Timeline, PIP, dialogue, event, ledger position) and the body.
3. **Play.** Preview and render mode read **only the snapshot and the track version**. The phone's components render from snapshot data instead of fetching. There is one data-source switch, and nothing else changes.
4. **Out of date.** When an owner's input hash changes, the snapshot reads **outdated**. Preview shows "playing approved snapshot vN; live data changed: rebuild?", and nothing rebuilds on its own.

**Spoiler safety carries over:** the snapshot holds only what My Little List's and the other public read paths return. It never holds production labels.

## 9. Assets: reused, never regenerated

- **Mouse Cursor and Grabbing Hand:** the existing World → Overlays production types. They are chosen per show (`gameplay.cursor_type_key`, `gameplay.hand_type_key`), each with a **hotspot** (`assets.metadata.hotspot`). The asset metadata belongs to the architecture session.
- **Sounds:** a show sound library on the assets table (`UI_SOUND`), holding licensed files only.
  - Slots: `click`, `tick`, `open`, `close`, `notify`, `error`, `voice_on`, `whoosh`, plus Evoni's own.
  - A slot with no sound plays nothing and shows a warning.
- **Prime fallback:** when a scene has no PIP footage, the PIP system shows the **designated fallback**, with the warning `prime_footage_missing` (scene, time range). The Director treats the fallback as Prime for layout and never invents footage.

## 10. Preview, render and export

All of this uses the architecture session's renderer contracts.

- **One geometry:** `layoutAt(composition, t)`, used by Build, Timeline, preview and export.
- **One renderer for non-video layers:** `StageRenderer` draws the scene objects plus the gameplay layers (an HTML phone, cursor, toasts) at time t, from the **snapshot**.
- **Video layers** (Prime's PIP, base video) are drawn by `<video>` in preview and by FFmpeg in export, **from the same layout**. This split is chosen because frame-exact video seeking in a headless browser isn't reliable.
- **One mix plan** feeds both Web Audio (preview) and FFmpeg (export):
  - Prime's audio comes from her PIP segment;
  - Lala and NPC audio from their dialogue lines;
  - sounds and voice clicks from the track.
- **Render mode:** the same page, a virtual clock (`window.__renderAt(t)`), and the snapshot plus track version.
- **Compositor v2:** behind `EXPORT_ENGINE=v2`. The old exporter stays the default until Evoni switches.
- **Running it:** its own Bull queue, idempotent by snapshot version plus asset hashes. Chromium and the worker on the server are **Evoni's** to set up.

## 11. The cursor tables: existence unverified

`cursor_actions`, `icon_cues` and `icon_slot_mappings` are created only by `migrations/20260209060127-icon-cue-timeline-system.js`, a migration tree that doesn't run. The register (`docs/audit/Canon_AbsentTable_Classification_2026-09-17.md`) records them as **absent from the 2026-08-29 canon capture**, yet live routes use them.

**Status: unverified today.** Safe read-only checks, for Evoni:
1. Run `SELECT to_regclass('public.cursor_actions'), to_regclass('public.icon_cues'), to_regclass('public.icon_slot_mappings'); SELECT name FROM "SequelizeMeta" WHERE name ILIKE '%icon-cue%';` with a read-only client.
2. Or open the Icon Cue Timeline page (or `GET …/cursor-paths`) and see whether it errors.

**What follows:**
- **Absent:** an audit finding, filed through `/audit-file`.
- **Present with rows:** a read-only report. Paths worth keeping may be imported as **overrides**, never as a live source.

## 12. Acceptance test: Episode 1, end to end

| # | Step | Exists today | Must be built | Owner / PR |
|---|---|---|---|---|
| 1 | Prime starts the game | Canonical beats; the login screen; full-take beat marks | Line marks; game start in the track; preview | Arch A2 · GD-3 · GD-7 |
| 2 | Opens Lala's phone | `[UI:OPEN]`; `phonePaths`; `PhoneDevice` | Cursor and press; `phone.open`; HTML phone layer in `StageRenderer` | GD-3 · Arch A4 · GD-7 |
| 3 | Clicks Voice before ordinary Lala lines | `scriptShowRules`; Script tab finding and fix; `phoneVoice` | Voice-click actions; the line's audio from dialogue lines | GD-3 · Arch A6 |
| 4 | A notification and its automatic reaction | `[UI:NOTIFY]`; `MESSAGES` | Toast at the cue mark; `notify` sound; `auto_without_trigger` (D-3) | GD-3 · GD-2 |
| 5 | Equips clothing; automatic wardrobe reaction | `EpisodeWardrobeGameplay`; `[WEAR]`; `dressedAt` | Hover, preview, compare, undo; the replay ending on the locked look | GD-4 · GD-5 · GD-3 |
| 6 | Opens My Little List | PRs #3599 and #3601 | List ticks in the track; the list from the snapshot | GD-3 · GD-6 |
| 7 | Travels to the event | Front and inside angles of one set; `transition_in` | `scene.enter` and `venue.enter`; `[TRANSITION]` proposed; transitions in compositor v2 | GD-3 · GD-4 · Arch A9 |
| 8 | NPC conversations | Beat-11 host and guest rules | NPC trigger (D-4); `npc_without_trigger`; NPC voices | GD-2 · Arch A6 |
| 9 | Submits the Reel, gameplay inside an outcome beat | `[DELIVER]`; #3598 (submission completes the task) | Post screen and press in whatever beat the script puts it (§6.4) | GD-3 · GD-7 |
| 10 | The surprise runway opportunity | `[LEARNS]` (#3599); beat-14 check | Toast and `list.appear` at the cue mark | GD-3 |
| 11 | Accurate stats | `statsAt`; stats panel; `[STAT]` checks | Stats from the snapshot; replay flags a `[STAT]` that disagrees | GD-6 · GD-3 |
| 12 | The export matches the approved preview | The old exporter | Snapshot; render mode; compositor v2 | GD-6 · GD-8 · Arch A9 · server setup (Evoni) |

**Pass conditions**
- No Lala line without a click or an approved exception.
- No unintended `action.refused`.
- No list item before she knows it.
- No private text in any frame (the snapshot holds only public read results).
- The final look equals the locked look.
- Every stat shown equals the snapshot's `statsAt`.
- Prime's PIP shows in every beat unless hidden by hand, and missing footage shows the fallback with its warning.
- **Preview and export use the same snapshot version and track version.** The non-video layers' frame hashes match; the video layers come from the same layout; the audio events land within one frame.
- **Rebuilding the snapshot from unchanged inputs gives byte-identical JSON.**

## 13. PR sequence, coordinated with the architecture session

**Architecture session (A-numbers; their own sequence):**
- A1: `line_key` and dialogue-line identity.
- A2: teleprompter line and cue marks.
- A3: PIP segments, fallback, visibility and layout.
- A4: `StageRenderer` and `layoutAt`.
- A5: Timeline on the shared composition, including object and camera keyframes and inheritance with local overrides.
- A6: voices and dialogue audio.
- A7: asset hotspots and sound library.
- A8: mix plan.
- A9: compositor.

**Gameplay Director (GD), each its own PR and its own approval:**

| # | PR | Needs |
|---|---|---|
| GD-0 | This spec (#3600) | — |
| GD-2 | Voice and trigger findings (`auto_without_trigger`, `npc_without_trigger`) in `scriptShowRules`, both twins | D-3, D-4 |
| GD-3 | Director core: anchors on the Timeline clock, voice clicks and exceptions, messages, wardrobe, list, scene references (episode-scene ids), read-only replay, conflict findings (§3.2). No storage | A1, A2 (falls back to estimates without) |
| GD-4 | Script verbs; `[TRANSITION]` proposed as `transition_in` | GD-2 |
| GD-5 | Closet decisions: hover, preview, compare, undo in `EpisodeWardrobeGameplay` | — |
| GD-6 | Track storage and overrides, plus **playback snapshots** (build, freeze, outdated) | GD-3; migrations through Deploy |
| GD-7 | Preview player: snapshot-driven `StageRenderer` with gameplay layers, PIP `<video>`, mix plan; override editing; per-scene approve | A3, A4, A5, A8, GD-6 |
| GD-8 | Render mode for gameplay layers (virtual clock, snapshot only) | GD-7 |
| Server setup | **Evoni:** Chromium, worker, flag, first approved render | A9, GD-8, D-10 |

My Little List Phases 2 and 3 continue; GD-7 uses Phase 2's component in snapshot mode.

## 14. Open decisions

| # | Decision | Recommendation |
|---|---|---|
| D-2 | **Line timing:** live marks from "Follow my voice", or offline alignment (more exact, costs money)? | Live marks first |
| D-3 | **`Lala (auto):`** only after `[WEAR]` or a notification? | Yes; flag, never block |
| D-4 | **NPC triggers outside the cutscene:** a click on the NPC, a DM, or a new `[TALK: name]`? | `[UI:CLICK name]` / `[UI:DM name]`; flag NPC lines without one |
| D-5 | Lala's audio when you've also recorded a line | Your recording wins (plan Q5) |
| D-7 | Failed attempts on screen with the game's own wording? | Yes |
| D-9 | Redraft on every save? | Yes, never auto-approve |
| D-10 | Render host, render retention on S3, 9:16 | Before server setup |
| D-11 | The cursor tables, after the §11 check | Never a live source |
| D-12 *(new)* | **Voice clicks in gameplay beats 11–13:** today the cutscene exemption skips the click rule there. When the script puts gameplay in those beats, should ordinary Lala lines need a click? | Yes when the scene has phone gameplay; the exemption stays for cutscene-clip scenes |
| D-13 *(new)* | **Snapshot build timing:** on Approve only, or also for every preview? | Build on preview (cached by input hash); freeze on Approve |
| D-14 *(new)* | **Take and Timeline conflicts (§3.2):** which choice is the default when a take overruns its scene? | Flag only, no default; Evoni picks |
| D-15 *(new)* | **Gameplay layers per scene:** is on/off a track override (as proposed), or a Timeline track? | A track override, shown on the Timeline as a lane |

Resolved since rev 2:
- **D-1** (the clock): the Timeline owns duration, and takes are anchors.
- **D-6** (shots): the Timeline's camera track.
- **D-8** ("Build Scene"): Scene Studio, on the shared Stage.
