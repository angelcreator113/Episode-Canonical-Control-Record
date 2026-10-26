# Gameplay Director and animated export: implementation spec

**Status:** revision 2 of a proposal. Nothing here is built. It revises revision 1 after Evoni's review of 2026-10-26.

**Rulings this spec keeps** (Evoni, 2026-10-26):
- The video export is a separate project. My Little List does not wait for it.
- The phone stays an interactive game interface. Its appearance is controlled through the gameplay production system.
- No flattened checklist image goes into the beat-9 scene.
- The no-overlays-on-beats switch of 2026-10-07 stays as it is.
- The Mouse Cursor and Grabbing Hand already in World → Overlays are reused, never regenerated.
- No merge, deploy or production-server change without Evoni's explicit yes.

**What revision 2 adds** (her review):
- Prime's performance as the clock (§3).
- The Voice icon rules (§4).
- Decisions and backtracking (§5).
- Scenes and locations (§6).
- Regeneration and overrides (§7).
- Who owns what (§2).
- The Episode 1 walkthrough (§11).
- A check on the cursor tables (§10).

---

## 1. The idea in one paragraph

The Gameplay Director is a pure, rule-based compiler; it makes no AI calls. From the systems that already own the episode, it works out **what Prime does in the game, when, and why**:
- the script (her lines, Lala's lines, the `[UI:]` actions);
- the event and its terms;
- what Lala knows;
- the look;
- the coins;
- the scene plan and the Stage;
- her recorded takes.

The result is a **gameplay track**: actions anchored to Prime's performance, plus Evoni's overrides kept on a layer of their own. The same track drives the in-app preview and the exported video.

The Director **owns only one new thing: the gameplay actions and Evoni's adjustments to them.** It owns no story, no state and no money. Everything it shows, it reads from the system that owns it.

## 2. Who owns what: no second source of truth

| Kind of thing | Owner today | How the Director uses it | What the track stores |
|---|---|---|---|
| Episode story and dialogue text | `episodes.script_content`, with history in `episode_script_versions` and locks in `episodes.script_locked_beats` (`scriptBeatLocks`); `episode_briefs`; the approved `episode_story_records` | Reads lines, speakers and tags (`scriptBeats`, `scriptSpeaker`) | Line anchors (beat, line, content hash), never the text. A dialogue edit goes to the script. |
| Event information | `world_events`, including `canon_consequences.documents` and `.terms`; `event_deliverables`; `opportunities` | Reads the invitation, offer, deliverables and opportunity | Nothing |
| What Lala knows | Worked out, not stored: `utils/lalaKnowledge` (PR #3599) from the script, the event and the opportunities | Asks `knowsAt(beat, line)` | Nothing |
| Wardrobe state | `episode_wardrobe` (the approved look, locked by `/wardrobe/lock-outfit-atomic`); what she has on by a line comes from the `[WEAR]` cues (`scriptWear.wornByBeat`) | Reads pieces and `[WEAR]` lines | Nothing (no "worn" state) |
| Money and stats | The `financial_transactions` ledger; `character_state` via `coinBalanceGuard`; `lalaStats.statsAt` for what is shown; `episodeCompletionService` for stat changes | Reads `statsAt` for any stats it shows; checks script `[STAT:]` lines against it | Nothing |
| Recorded takes | `episode_raw_clips` (takes, `is_favorite`, `start_line`, `beat_marks`); `script_voice_clips` (per-line recordings); `episode_performance_clips` (the approved clip per beat and performer) | Uses the takes as the clock (§3) | Which take each beat uses, if Evoni overrides the favourite |
| Phone layout | `ui_overlay_types` and `assets` (screens, `screen_links` tap zones, `content_zones`), through `phoneOverlays.overlayStatusForShow` | Resolves tap targets to zones | Zone ids, never coordinates (except Evoni's cursor nudges, as offsets) |
| My Little List | PR #3599's service (a view of `episode_todo_lists`) | Item keys and visibility at each line | Item keys |
| Stage composition | `scene_plans` (set, `angle_label`, `transition_in`, `locked`, `chosen_by_user` per beat); `scenes` (`syncBeatScenes`); `scene_assets` (Scene Studio positions); `timeline_data` (keyframes); `timeline_placements` (overlays) | Reads the set and angle per beat, transitions, and character positions | Shots *within* a beat (§6.3), which nothing else owns today |
| Gameplay actions | **New:** `episode_gameplay_tracks` | — | The generated actions (rebuildable) plus Evoni's overrides (original data) |
| Final rendering | Today: `routes/export.js`, `videoQueue`, `workers/videoRenderer` | — | A render record: the track version and input hashes it was made from |

**Rules that keep it single-sourced:**
1. The generated layer can always be rebuilt from its inputs. Only the override layer is original.
2. The track never stores a value another system owns: no coins, no list text, no positions, no set choice, no dialogue.
3. Where the track and an owner disagree (an override names a zone the phone no longer has), the owner wins and the override goes to review (§7).
4. The cursor tables (`cursor_actions`, `icon_cues`) are not a source for the track (§10).

## 3. Prime's performance is the clock

Prime is the streamer playing the game. Her reactions only make sense if the game waits for her and reacts with her. So **the take leads, and the gameplay follows it**.

### 3.1 Timing anchors

Every gameplay action is placed relative to an **anchor**, never at a bare number of seconds:

| Anchor | Means | Source today | Gap |
|---|---|---|---|
| `beat_start` | The beat's first frame in the take | `episode_raw_clips.beat_marks` (full takes); a per-beat favourite starts at 0 | None |
| `line_start` / `line_end` | When Prime starts or finishes a script line in the take | **None:** timing is per beat only | **To build:** line marks (§3.2) |
| `cue_shown` | When the teleprompter showed her a `[UI:]` moment, which is what she reacted to | **None:** the teleprompter shows cues for 3 s but doesn't record when | **To build:** cue marks (§3.2) |
| `after_action` | A fixed gap after another action (the screen opens 0.6 s after the press) | The Director's rules | None |

An action is stored as `{ anchor, offset }`. For example, `cursor.press` sits at `line_start(beat 5, line 2) − 0.4 s`, so the press lands just before Prime says "Oh, a letter."

### 3.2 Capturing line and cue marks

**Line marks:** the teleprompter already follows her voice (`lib/voiceFollow`) and knows which line she is on. When a line becomes current, it records `{ beat, line, t }` in take time, with pauses excluded, the same clock as `fullEpisodeTake`'s beat marks. Stored as a new `episode_raw_clips.line_marks` JSONB, capped like `beat_marks`.

**Cue marks:** when the teleprompter shows a `[UI:]` moment (`teleprompterScreen`), it records `{ beat, line, verb, t }` in `episode_raw_clips.cue_marks`. When she reacts to "a letter arrives", the letter arrives in the video at the moment she saw it.

**Without marks:** older takes, or takes not read with "Follow my voice", fall back to the script estimate (`scriptRuntime.lineSeconds`) scaled to the beat's real length. The preview labels that beat **"estimated timing"**, and Evoni can nudge it (§7).

### 3.3 Reactions, pauses, jokes and decisions

- **Surprise:** an event that surprises her (a notification, a refused action, the runway) is placed at its `cue_shown` mark. The take holds her reaction: the gameplay doesn't move until her next line anchor, so a laugh or a pause is never covered by motion.
- **Decisions:** "I'm going with the gold heels" puts the equip press on that line's anchor. Hovering and comparing (§5) fill the lines before it, so she is seen thinking with the cursor.
- **Pauses for dialogue:** while Prime or Lala is speaking, the cursor *rests*. Any motion is scheduled between lines, unless the script ties an action to a line (`[UI:CLICK x]` written mid-line).
- **Jokes or asides with no game action** produce no gameplay. The cursor idles with small, seeded drift so the screen doesn't look frozen.

### 3.4 Two recording workflows; both work

1. **Record, then direct** (the default). Prime records the beat. The Director places actions on her line and cue marks. Evoni nudges them in the preview.
2. **Direct, then record** (rehearsal). The preview plays the drafted track while the teleprompter shows it. The take's cue marks then re-anchor the track to what she actually reacted to.

## 4. Lala's Voice icon

### 4.1 The rule and its exceptions, from one place

Both the rule and its exceptions live in `utils/scriptShowRules` (backend, with an identical frontend twin and a parity test). The Director calls `voiceOffLines` and `dressedAt` and **does not write a second rule engine**.

| Lala line | Allowed when | In code today |
|---|---|---|
| An ordinary line | Right after Prime clicks Lala's Voice icon: one click, one line (`isVoiceOn`: CLICK, TAP or SELECT on a target matching /voice/, or `[UI:VOICE_ACTIVATE]`) | Yes |
| Her thoughts, `Lala (V.O.):` | Always; thoughts aren't speech | Yes |
| An **automatic wardrobe reaction** | While she is being dressed (`dressedAt`: the closet is open, the line just before a `[WEAR:]`, or the first line after a `[WEAR:]` and its `[STAT:]` lines) | Yes (the `dressedAt` window) |
| `Lala (auto):` lines | Today, anywhere (`AUTO_REACTION` is skipped wherever it appears) | Yes, but too loose (decision D-3) |
| A **reaction to a notification** | The next Lala line after a `[UI:NOTIFY]`, `[UI:DM]` or `[MAIL:]` | Yes (`MESSAGES`) |
| **NPC conversations** | Cutscene beats 11 to 13 (`isCutsceneBeat`), where beat 11's host and guest lines are required (`scriptRuleChecks` `beat11-*`) | Only in the cutscene; **no trigger exists for an NPC talk outside it** (decision D-4) |

### 4.2 What the Director emits

For every ordinary Lala line, it emits, anchored before the line:
1. `cursor.move` to the Voice zone (`phoneVoice.isVoiceZone`);
2. `cursor.press` with the `click` sound;
3. `voice.on`, which shows the "Lala speaks" toast (`phoneVoice.VOICE_TOAST`).

Then comes `lala.line`, which plays her line's audio: the `script_voice_clips` row for that line, or the Lala performance clip for the beat. The click lands 0.3 to 0.5 s before the line's `line_start`.

For an exception it emits no click. It marks the line with its reason (`wardrobe_auto`, `message_reaction`, `voice_over`, `cutscene`), so the preview can show why no click was needed.

### 4.3 Validation (Script tab health, one finding list)

| Finding | When | Fix offered |
|---|---|---|
| `lala_unvoiced` | An ordinary Lala line with no click before it: `voiceOffLines`, the same finding the Script tab shows today | The existing fix, `beatWithVoiceClicks` |
| `auto_without_trigger` *(new, needs D-3)* | `Lala (auto):` that is not right after a `[WEAR]` (or inside `dressedAt`) or a message | "Make it a voiced line (adds a click)" or "Move it after the `[WEAR]`/notification" |
| `npc_without_trigger` *(new, needs D-4)* | An NPC line outside beats 11 to 13 with no approved trigger before it | "Add the trigger" |
| `voice_click_unreachable` | The Voice zone isn't on the screen the phone shows at that line | The `phonePaths` fix that adds `[UI:OPEN]` |

The Director never "fixes" a script by itself. Findings appear in the Script tab, and the writer's prompt already states the rule (`groundedScriptGeneratorService`).

## 5. Decisions, backtracking and recovery: a game, not a click list

### 5.1 More verbs for the script, in the same `[UI:]` form

| Tag | Gameplay |
|---|---|
| `[UI:HOVER <target>]` | The cursor rests on a target; its tooltip or price shows |
| `[UI:PREVIEW <piece>]` | The piece's detail card opens (`inspecting` in `EpisodeWardrobeGameplay`); Lala's figure shows it as a try-on preview where the closet supports it |
| `[UI:COMPARE <piece> \| <piece>]` | Two pieces side by side |
| `[WEAR: <id>]` | Equips the piece, as now. It moves the `wornByBeat` state, and its wardrobe reaction is allowed (§4) |
| `[UI:UNEQUIP <id>]` / a second `[WEAR]` for the same slot | Reconsidering: takes off, or replaces |
| `[UI:BACK]`, `[UI:CLOSE <screen>]`, `[UI:OPEN <screen>]` | Closing and reopening screens. `phonePaths` already checks reachability |
| `[UI:WAIT <n>s]` | An explicit hold for dialogue or a beat of thought |
| `[UI:TRY <action>]` | An attempt that may be refused (§5.3) |

The parser reads them as it reads `[UI:CLICK]`, and gives them durations in `UI_ACTION_DURATIONS`. The writers' prompts learn them in the same PR (§12, PR 4).

### 5.2 The look is the one the game locked

The order of `[WEAR]` lines must end in the approved look (`episode_wardrobe` `approved`). A piece worn and then replaced is fine; it's the reconsidering. A finding flags a script that ends in a look other than the locked one. **The script tells the story of choosing; the lock is the choice.**

### 5.3 Invalid or unavailable actions

To validate the script line by line, the Director **replays** it against the owners' rules:
- coins from `statsAt` with the look's charges (`episodeLookCharges`), using the same refusal as `coinBalanceGuard`;
- what's in the closet or the pool;
- which screens can be reached (`phonePaths`);
- what she knows (`lalaKnowledge`).

The replay writes nothing. When the script tries something the game would refuse ("buy the 900-coin coat" with 600 coins), the track shows the refusal:
- `action.refused`: a shake, plus a toast with the game's own message ("Not enough coins");
- the `error` sound.

**Recovery** is simply the script's next lines (pick the rental instead). A refusal the script didn't intend, meaning an action that isn't a `[UI:TRY]`, is a finding, not a silent success.

## 6. Scenes, locations, Stage and Timeline

The phone is one layer. A beat on screen has a **scene layer**, a **character layer**, the **phone layer**, the **cursor layer** and the **overlays**. The Director coordinates them; the Stage and Timeline still own what they own.

### 6.1 Where each beat takes place

`scene_plans` already holds the set and angle for each beat:
- `scene_set_id` and `angle_label`, chosen by `planLocationsService.placeBeat` with `beatLocations` (`BEAT_KINDS`: beat 10 = front, beats 11 and 12 = inside);
- `transition_in` (cut, glow, push, wipe, dissolve or none);
- `locked` and `chosen_by_user`.

The Director reads these and emits:
- `scene.enter` at each beat's start: the set, the angle and the transition from `transition_in`;
- `venue.enter` for the event: beat 10 Event Travel opens on the venue's **front**; beat 11 cuts **inside** (`angle_kind` front → inside), using `transition_in`;
- `camera.view` for shots **within** a beat (§6.3).

### 6.2 Characters and positions

- Positions live where they are placed today: `scene_assets` rows (Scene Studio: `position_x`/`position_y`, size, `layer_order`, `character_name`, `scene_angle_id`) and `scenes.characters`.
- Movement over time lives in `timeline_data.keyframes`.
- The Director **references** them: `character.show <scene asset id>` and `character.move <keyframe id>`. It never copies coordinates.
- A script beat that needs a character the Stage hasn't placed gives a finding: "Place Nia in beat 11's scene."

### 6.3 Cinematic transitions and shots

- **Between beats:** `transition_in` (owned by `scene_plans`). The script's `[TRANSITION: …]` tag is written by the writers today, but **the parser ignores it** (`scriptBeatParser` hard-codes cut/dissolve). PR 4 parses it and proposes it as `transition_in` for Evoni to accept, rather than having two owners.
- **Within a beat:** a cut from the front view to a close-up while Lala reacts has **no owner today**. It is the one Stage-like thing the track owns: `camera.view { angle_id, at: anchor }`, chosen by Evoni in the preview. If the Stage later gains per-shot rows, they move there.
- **Cutscene beats 11 to 13** (AI-video, no phone UI) are a `cutscene` segment: the clip plays, and no cursor or phone appears.

### 6.4 "Build Scene"

There is no "Build Scene" action. The nearest things are **Build Scene Spec** (`sceneSpecService.buildSceneSpec`, in the Scene Sets tab) and **Build Scene Brief** (`SceneInterview`). The Director needs neither directly; it uses their results through `scene_sets` and `scene_angles`. Decision D-8 asks which one Evoni meant.

### 6.5 Layer order (bottom to top)

1. Scene (the set and angle still, or the performance clip as the base video).
2. Characters (the Stage).
3. Phone (when shown).
4. Overlays, only from real `timeline_placements`, so the beat switch applies.
5. Toasts.
6. Cursor.
7. The audience stats panel (`statsPanelService`), when the script displays it.

## 7. Regeneration and creative overrides

### 7.1 Drafting automatically

- **Start Episode** creates an empty track for the episode ("waiting for a script"). Start Episode writes no script today.
- **Every script save** (the writers, the Script tab, a restore) redrafts the generated layer of the beats that changed. It is cheap, pure and has no AI cost.
- **Other changes redraft the beats they touch:**
  - an event package change (terms, documents, deliverables);
  - a phone layout change (zones, screens);
  - a scene plan change (set, angle, transition);
  - a new take or new marks.
- **A draft is never approved automatically.** Every redraft leaves the track *draft*, or *changed since approval* for just the beats it touched.

### 7.2 Generated layer and override layer

Each generated action has a **stable anchor id**: its source (beat + line content hash + which occurrence, or the `[WEAR]` piece id, or the item key) plus its role ("voice click before line …").

Evoni's adjustments are stored **separately**, keyed by that id:

| Override | Example |
|---|---|
| Timing | +0.3 s on the voice click before "Oh, a letter" |
| Cursor | A path control point, or a hover held longer |
| Hold | A 1.5 s pause after the runway notification |
| Camera | The within-beat close-up at line 4 |
| Take | Use take 3 for beat 8, not the favourite |
| Off | Don't show this hover |

**Dialogue edits are not track overrides:** dialogue is the script's, so it is edited in the Script tab. The redraft then follows it, and a timing override survives if its line's anchor survives.

### 7.3 What happens to an override after a change

| What changed | Outcome |
|---|---|
| Its anchor still exists, with the same meaning | Kept and re-applied. Nothing to do. |
| The line's text changed but it's the same line (same beat and position, similar text) | Kept, marked *check*: shown in the preview with "line edited" |
| The anchor is gone (the line was deleted) | **Orphaned:** listed for review and never dropped silently. Re-pin it to a line, or delete it. |
| It no longer fits (the zone it nudges was removed, or a hold now overlaps the next line) | **Conflict:** listed with three choices: keep and adjust, drop, or re-pin |
| The beat is locked (`script_locked_beats` or `scene_plans.locked`) | The beat's generated actions don't move. If its sources change, the beat shows a conflict instead of a redraft |

Approval is **per beat**: an approved beat stays approved until a redraft touches it.

## 8. Assets: reused, never regenerated

- **Mouse Cursor and Grabbing Hand:** the existing World → Overlays production types, chosen once per show in two settings, `gameplay.cursor_type_key` and `gameplay.hand_type_key`. Each image gets a **hotspot** (the click pixel) as `assets.metadata.hotspot`, an additive field set with a picker on the overlay card.
- **Sounds:** the repo has none. The plan is a show sound library on the same assets table (`asset_type 'UI_SOUND'`), uploaded beside Overlays.
  - Slots: `click`, `tick`, `open`, `close`, `notify`, `error`, `voice_on`, `whoosh`, plus Evoni's own.
  - It holds only licensed files.
  - A slot with no sound plays nothing and shows a warning.

## 9. Preview, render and export (unchanged in substance from revision 1)

- **Preview** (the Lala's Phone tab, or an Episode Preview page): the real `PhoneDevice` over the scene layer, with the cursor layer, toasts, My Little List animations and Web Audio sounds. The Prime and Lala audio come from the chosen takes. Pausing hands the phone back to Evoni. **This is where she approves the track and makes overrides.**
- **Render mode:** the same components with a virtual clock (`window.__renderAt(t)`), driven by the approved track version and captured frame by frame in headless Chromium.
  - Data is read at each action's beat and line (My Little List's public endpoint; `?at=` for DMs).
  - The same render mode also produces the preview's "frame-exact" check, so the export provably matches the preview.
- **Compositor v2:** FFmpeg layers in the §6.5 order, with audio from the takes plus sounds (`adelay`, `amix`, −14 LUFS). It runs behind `EXPORT_ENGINE=v2`; the old exporter stays the default.
- **Running it:** its own Bull queue, idempotent by input hashes. Chromium and the worker on the server are **Evoni's setup**, decision D-10.

## 10. The cursor tables: existence unverified

**What is known:**
- `cursor_actions` and `icon_cues` (and `icon_slot_mappings`) are created only by `migrations/20260209060127-icon-cue-timeline-system.js`. That is a migration tree CLAUDE.md says never runs; only `src/migrations/` runs.
- The audit register's **`docs/audit/Canon_AbsentTable_Classification_2026-09-17.md`** lists all three as **absent from the 2026-08-29 canon capture**, and classifies them REAL-ROUTE: live routes use them through `cursorPathController`, `iconCueController` and `iconSlotController`, mounted in `app.js`.
- No `src/migrations/` file has created them since.

**Status: unverified for today's database.** This session has no database access, by rule.

**Safe, read-only check (Evoni, any one of these):**
1. In the read-only database client she already uses:
   ```sql
   SELECT to_regclass('public.cursor_actions')    AS cursor_actions,
          to_regclass('public.icon_cues')          AS icon_cues,
          to_regclass('public.icon_slot_mappings') AS icon_slot_mappings;
   SELECT name FROM "SequelizeMeta" WHERE name ILIKE '%icon-cue%';
   ```
   A NULL means the table doesn't exist. Both are reads; nothing is written.
2. In the app: open an episode's **Icon Cue Timeline**, or call `GET /api/v1/episodes/:id/cursor-paths`. A "relation … does not exist" error means it is absent. This is a read, but it hits production, so it is hers to do.

**Then:**
- **Absent:** the track never depends on them, as planned. The broken pages become their own audit finding, filed through `/audit-file`, not edited here.
- **Present with rows:** a one-time, read-only report of what's in them. Evoni decides whether any cursor paths are worth importing as **overrides** (§7). They are still never a live source.

## 11. Acceptance test: Episode 1, end to end

Each step lists what exists, what must be built, and the PR (§12) that builds it.

| # | Step | Exists today | Must be built | PR |
|---|---|---|---|---|
| 1 | **Prime starts the game** (beats 1–2: Opening Ritual, Login Sequence) | Canonical beats; the phone's login screen in the Phone Hub; full-take `beat_marks` | Line marks; a `game.start` / login sequence in the track; the preview player | 1, 3, 7 |
| 2 | **Opens Lala's phone** | `[UI:OPEN phone]`; `phonePaths`; `PhoneDevice` | Cursor move and press to the phone; `phone.open` anchored to her line | 3, 7 |
| 3 | **Clicks Voice before ordinary Lala dialogue** | `scriptShowRules.voiceOffLines`; the Script tab's voice row and fix; `phoneVoice`; `script_voice_clips` | Voice click, toast and `lala.line` actions; the line's audio in the preview | 3, 7 |
| 4 | **A notification, and its automatic reaction** | `[UI:NOTIFY]`; the `MESSAGES` exception; beat 4 Interruption Pulse | `toast.show` at the cue mark; the `notify` sound; `auto_without_trigger` (D-3) | 3, 4, 2 |
| 5 | **Equips clothing; hears automatic wardrobe reactions** | `EpisodeWardrobeGameplay` (equip, remove, lock); `[WEAR]`; `dressedAt` | `HOVER`, `PREVIEW`, `COMPARE` and `UNEQUIP` in the closet and the script; the replay that ends in the locked look; reaction lines after `[WEAR]` | 4, 5, 3 |
| 6 | **Opens My Little List** | PR #3599's list (what she knows, her words) | The Phase 2 phone component; `list.tick` and `list.reword` actions | MLL Phase 2, 3 |
| 7 | **Travels to the event** | Beat 10 front angle and beat 11 inside (`beatLocations`, `scene_plans`); `transition_in` | `scene.enter` and `venue.enter`; `[TRANSITION]` parsing; transitions in the compositor | 3, 4, 9 |
| 8 | **Triggers NPC conversations** | Beat 11 host and guest rules (cutscene) | An NPC trigger outside the cutscene (D-4); `npc_without_trigger` | 4, 3 |
| 9 | **Submits the Reel** | `[DELIVER]`; the deliverable's status route; PR #3598 (submitting completes the task) | The submit gesture on the phone (the post screen) anchored to her line; the list item ticks. The production status moves only by Evoni's hand | 3, 7 |
| 10 | **Gets the surprise runway opportunity** | Beat 14's opportunity check; `[LEARNS: opportunity_discovered]` (PR #3599) | `toast.show` and `list.appear`, at the cue mark | 3 |
| 11 | **Accurate stats** | `lalaStats.statsAt`; `statsPanelService`; the `[STAT:]` checks | A stats panel action reading `statsAt` at that line; the replay flags a `[STAT:]` that doesn't match the ledger-based value | 3, 7 |
| 12 | **The export matches the approved preview** | The old still-per-scene exporter | Render mode; golden frames; compositor v2. Acceptance: the export's frames equal render mode's frames for the approved track version (hash per frame), with audio within one frame | 8, 9, D6 |

**Pass conditions for the whole run:**
- No Lala line without a click or an allowed exception.
- No `action.refused` the script didn't mean.
- No list item before she knows it, and no private text in any frame (My Little List's leak scan over the frame DOM).
- The final look equals the locked look.
- Every stat shown equals `statsAt` at that line.
- The export's frame hashes equal render mode's.

## 12. Recommended PR sequence

Each PR is separate and needs its own approval. Nothing reaches production except through Evoni's Deploy workflow.

| # | PR | Contains | Migration | Depends on |
|---|---|---|---|---|
| 0 | **This spec** | `docs/GAMEPLAY_DIRECTOR_SPEC.md` | — | — |
| 1 | **Line and cue marks** | The teleprompter records `line_marks` and `cue_marks`; `episode_raw_clips` columns; tests | Yes | — |
| 2 | **Voice and trigger rules** | `auto_without_trigger` and `npc_without_trigger` in `scriptShowRules` (both twins), per D-3 and D-4; Script tab rows; writer prompts | — | D-3, D-4 |
| 3 | **Director core (D1)** | `gameplayDirector.directEpisode`: anchors, voice and exceptions, messages, wardrobe, the list, scenes (read-only), the replay validator; findings into Script tab health. Episode 1 fixture tests. No storage. | — | 1 (it falls back to estimates without marks) |
| 4 | **Script verbs** | `HOVER`, `PREVIEW`, `COMPARE`, `UNEQUIP`, `BACK`, `WAIT`, `TRY`; `[TRANSITION]` parsing proposed as `transition_in`; NPC trigger syntax; parser, health checks and writer prompts | — | 2 |
| 5 | **Closet decisions** | Hover, preview, compare and undo in `EpisodeWardrobeGameplay` (the game UI) | — | — |
| 6 | **Track storage and overrides (D2)** | `episode_gameplay_tracks` (generated + overrides, fingerprints, per-beat approval); redraft on save and on input changes; conflict review; cursor and hand keys, hotspot, sound library | Yes | 3 |
| 7 | **Preview player (D3)** | Scene + phone + cursor + toasts + list + audio; override editing (timing, cursor, hold, camera, take); per-beat Approve | — | 6, MLL Phase 2 |
| 8 | **Render mode (D4)** | Virtual clock; frame capture; golden frames in CI | — | 7 |
| 9 | **Compositor v2 (D5)** | FFmpeg layers and audio behind `EXPORT_ENGINE=v2` | — | 8 |
| D6 | **Server enablement** | **Evoni:** Chromium libraries, the worker, the flag, the first approved render | — | 9, D-10 |

My Little List Phase 2 and Phase 3 go on as already planned. PR 7 uses Phase 2's component.

## 13. Open product decisions

| # | Decision | Recommendation |
|---|---|---|
| D-1 | **The clock.** Take-led (the gameplay follows Prime), or gameplay-led (she records to a fixed track)? | Take-led, with the rehearsal workflow available (§3.4) |
| D-2 | **Line timing.** Live marks from "Follow my voice", or offline alignment of each take (more exact; needs a speech service, which costs money)? | Live marks first. Offline alignment only if live marks drift. |
| D-3 | **Auto reactions.** Should `Lala (auto):` be allowed only right after a `[WEAR]` or a notification? Scripts written so far may gain findings. | Yes. Flag, never block. |
| D-4 | **NPC triggers outside beats 11–13.** What starts an NPC conversation: clicking the NPC in the scene, a DM thread, the event's own moment? Should it get a tag (`[TALK: <name>]`)? | A click on the NPC or a DM, written as `[UI:CLICK <name>]` / `[UI:DM <name>]`; an NPC line with neither is flagged |
| D-5 | **Lala's audio.** Is her voice always the per-line `script_voice_clips`, the Lala performance clip, or Prime's own read? | Per-line clips, else the performance clip |
| D-6 | **Within-beat camera shots.** Owned by the track (as proposed), or a new per-shot table on the Stage? | The track for now; move them if the Stage grows shots |
| D-7 | **Failed attempts on screen.** May scripts stage a refusal for drama (`[UI:TRY]`), and is the game's own wording right for the video? | Yes; reuse the game's wording |
| D-8 | **"Build Scene."** Was that Build Scene Spec, Build Scene Brief, or a new feature? | Clarify; nothing here depends on it |
| D-9 | **Redraft on every script save, or on request?** | On every save, never approving automatically |
| D-10 | **Rendering host, render retention on S3, 9:16 Shorts.** | Decide before D6 |
| D-11 | **The cursor tables,** after the §10 check | Leave them out of the track either way |
