# The editor's sources, and "Prepare From Existing Work" (read, 2026-11-03)

Evoni, 2026-11-03: "I have already done extensive work preparing my episodes before reaching the Timeline Editor … I do not want to repeat all this work manually." Part B is the evidence on how the episode editor (`/episodes/:id/editor`, `EpisodeEditor`) finds that work today. Part C is the design for **Prepare From Existing Work**, which is not built yet. Nothing here changes production.

Basis: `origin/main` at `121ce58c`. Production facts come from the Diagnostics daily snapshot (`prime-diagnostics/latest-db-snapshot.md`, taken 2026-11-03 06:27 UTC, sha256 prefix `44414f700e89e88f`). Only counts are cited, no rows.

**Limit:** the counts are table totals (soft-deleted rows included), not per episode. A per-episode read on the box was attempted through SSM and refused: the AWS keys in this session's environment are rejected (`InvalidClientTokenId`). Phase B0 below fixes that without a long-lived key.

---

## Part B: how the editor finds existing work

### B.1 What the editor reads

The page makes six reads (`EpisodeEditor`, `lib/episodeEditApi`):
- `GET /episodes/:id`
- `GET /episodes/:id/edit` and `/edit/findings`
- `GET /episode-clips/:id` (raw footage)
- `GET /episodes/:id/scene-sets` (sets linked to the episode, with their angles)
- `GET /voice-studio/:id/playable` (current approved takes)

**Nothing is ever placed automatically.**
- A new episode's edit starts empty, and each beat has length 0 until a scene clip is placed (`editTimeline.beatTimeline`, finding `scene_missing`).
- The first assembly that would have filled it (design `docs/reads/2026-10-27-voice-studio-timeline-design.md` R7.7, "C2 first assembly") was designed but never built. No route exists for it in `episodeEditRoutes`.

### B.2 What production holds (table totals, 2026-11-03 06:27 UTC)

| Table | Rows | What it means for the editor |
|---|---|---|
| `episodes` | 76 | |
| `scene_plans` (beat → set + angle label) | 70 | **Never read by the editor** |
| `scene_set_episodes` (set ↔ episode links) | 20 | The only way the editor finds sets |
| `scene_sets` / `scene_angles` | 26 / 121 | Shown when their set is linked |
| `scenes` (beat scene rows the old Timeline used) | 6 | Never read by the editor |
| `episode_raw_clips` (Lala, Prime and guest footage) | 9 | All of them are listed |
| `assets` (older uploads) | 169 | Never read by the editor |
| `line_voice_candidates` / `line_voice_approvals` | 0 / 0 | **No Voice Studio takes exist yet** |
| `script_voice_clips`, `episode_performance_clips`, `voice_footage_jobs` | 0, 0, 0 | |
| `episode_scene_clips`, `episode_prime_segments`, `timeline_items`, `timeline_audio_items`, `episode_beat_production`, `edit_versions`, `episode_edit_state` | all 0 | **Nothing has ever been placed in any episode's edit** |
| `timeline_data` (the old Timeline Editor's row) | 4 | Not read by the new editor (closed for writes by this PR) |

The C1b columns are in production (`timeline_items.duration_ms` is in the snapshot's schema), so the Lala lane, captions and visual modes can be used there.

### B.3 Per source

The table below separates the four failure kinds asked for: **missing data**, **missing link**, **missing UI discovery**, and **not placed**.

| Source | Data exists? | Linked to the episode? | Editor fetches it? | Why it may not appear |
|---|---|---|---|---|
| **Scene planning** (`scene_plans`: each beat's set and angle label; `chosen_by_user`, `locked`, `sort_order`) | Yes: 70 rows | Yes, by `episode_id` + `beat_number` | **No** | **Missing UI discovery.** The editor never reads `scene_plans`, so your beat-by-beat scene choices are invisible. The old Timeline Editor read them through `scenes.scene_angle_id` (ruling L12), and deleting it in #3683 dropped that path. The plan also names its angle by **label**, not id, so a renamed angle no longer matches. |
| **Scene sets and angles** (`scene_set_episodes` → `scene_sets` → `scene_angles`) | Yes: 26 sets, 121 angles | Only through `scene_set_episodes` (20 links), which has **no beat column** | Yes, linked sets only, in link `sort_order` | **Missing link:** a set chosen in the scene plan but not linked in `scene_set_episodes` never shows (the plan and the link are separate rows). **Missing data:** an angle with no still and no video shows "no media yet" and cannot be placed. Not placed: shown as tiles, never on the timeline. |
| **Files / raw footage** (`episode_raw_clips`) | 9 clips in total | `episode_id`, `beat_number`, `end_beat_number`, `beat_marks`, `is_favorite` (★), `start_line` | Yes, every live clip | **Missing UI discovery:** with a beat focused, a clip with no `beat_number` (for example a whole-episode take with only beat marks) is hidden (`AssetBrowser` `inBeat`). ★ and beat marks are ignored by the editor. **Missing data:** a clip with no measured `duration_seconds` is refused (`NO_DURATION`). Older uploads in `assets` (169) are never read. |
| **Background removal** (`episode_raw_clips.key_status`, `url_cutout`) | On the same row | Same row | Yes | **Missing data:** the cutout is used only when `key_status = 'done'`; queued, processing or failed shows the original. Safari always shows the original (no VP9 alpha). A Lala clip placed on the **Scene** lane always plays its original; only the **Lala & guests** lane uses the cutout. |
| **Prime / JustAWoman clips** (`episode_raw_clips.performer = 'justawoman'`) | Within the 9 | As raw footage | Yes, as Prime tiles | **Missing link:** a take recorded in the Teleprompter as Lala or as a guest is labelled `lala` or `guest`, and the Prime lane refuses it (`WRONG_PERFORMER`). **Missing UI discovery:** no take is picked for you, because ★ and beat marks are not read, and a placed take is the whole take at the playhead. |
| **Voice Studio approved takes** (`line_voice_*`) | **No: 0 candidates, 0 approvals** | `beat_number`, `line_index`, `association_id` | Yes, current approvals only | **Missing data.** Nothing has been approved in Voice Studio in production. Even when takes exist, an approval needing review after a script save, an `outdated_take`, or Voice Studio being switched off (`VOICE_STUDIO`) keeps a take out of the list. Placed by hand only; an unplaced approved line is the blocking finding `dialogue_unplaced`. |
| **The 14 beats** | The editor's 14 (`editTimeline` `BEATS`) | Script `## BEAT:` headers, `scene_plans.beat_number`, clip beats | Yes, through `/edit` | **Not placed:** a beat has a length only once a scene clip is placed or its length is set, so an empty edit shows 14 beats of 0 seconds with `scene_missing`. Script beats numbered past 14 are refused by the edit. |

**In one line:** your scene choices exist (70 plan rows) but the editor never reads them; your footage is listed but not matched to beats; there are no Voice Studio approvals yet; and nothing has been placed, because placing was always manual and the planned first assembly was never built.

---

## Part C: Prepare From Existing Work (design, not built)

### C.1 What it is

A button in the editor's top bar, **Prepare From Existing Work**. It reads everything above and proposes an arrangement. The proposal is shown for review. **Nothing is written until you approve**, and approving never deletes, overwrites or moves anything already on the edit without your explicit choice for that item. It is the R7.7 "C2 first assembly", done as a reviewed proposal instead of a one-shot write.

### C.2 Rules

1. **Discover:**
   - `scene_plans` (with each set and angle).
   - Linked sets and angles.
   - Raw clips with their performer, beats, ★, beat marks and cutout state.
   - Current Voice Studio approvals with their line associations.
   - Script beats.
   - The edit as it stands.
2. **Scene order:** within a beat, scenes follow the plan's `sort_order`, then the angle's `sort_order`. A plan row the producer chose or locked (`chosen_by_user`, `locked`) is **confirmed**; one the planner suggested is **suggested**.
3. **Lala and Prime footage:**
   - A clip matches a beat only through its own metadata: `beat_number`/`end_beat_number`, `beat_marks`, ★ for that beat.
   - **An uploaded clip is never assumed to belong at a timestamp.**
   - A clip with beat marks gets its stretch for each beat from the marks (the `lib/assembleTakes` logic Files › Footage already uses).
   - A clip with only a `beat_number` is proposed at the start of that beat as **suggested**, with "timing not marked".
   - Two candidate clips for one beat, neither starred, make the beat **ambiguous**: you pick.
   - A clip with no beat at all is listed as **unassigned**, never placed.
4. **Cutouts:** a Lala or guest clip is proposed on the Lala & guests lane (cutout when `key_status = 'done'`). A pending or failed cutout is still proposed, marked "cutout not ready: original shown".
5. **Dialogue:** each approved take is shown against its exact line (beat and line index, with the line's words).
   - It is proposed for placement only where usable timing exists (a marked line), following R7.7.
   - Otherwise it is listed as "approved, needs timing" with an optional **suggested** in-order placement inside its beat. You choose it per line or per beat; it is never confirmed.
6. **No overwrite:** a proposal item that would land where the edit already has a clip, a placed line or a locked beat is a **conflict**.
   - Its default is "keep what is there".
   - "Replace" must be chosen per item.
   - A locked beat's length is never changed by applying.
7. **Status for each item:**
   - **confirmed:** your own choice, and its media is ready.
   - **suggested:** derived from metadata; you should check it.
   - **ambiguous:** more than one candidate; you pick.
   - **missing:** the plan names something with no media, or a beat has nothing at all.
   - **conflict:** see rule 6.

   Each item carries its evidence, for example "Scene plan, beat 3: Closet · Wide, chosen by you" or "Prime take ★ for beat 5, beat marks 00:41–01:07".

### C.3 User flow

1. In the editor, **Prepare From Existing Work** opens a review sheet over the preview and timeline. The edit stays as it is.
2. **The summary** shows Confirmed, Suggested, Ambiguous, Missing, Conflicts and Unassigned counts, plus "what's missing and where to fix it" links: Scenes › Plan, Files › Footage (beats, ★, marks, cutout), Production › Voice. A set used in the plan but not linked offers "Link this set to the episode", which is its own action and needs its own confirmation.
3. **Beat by beat (1–14):** each beat lists its proposed items by lane (Scene, Lala & guests, Prime, Dialogue).
   - Each item has a checkbox, a status badge, its evidence and a thumbnail.
   - An ambiguous item has a picker.
   - A conflict shows what is on the edit now and a Keep/Replace choice.
   - Selecting a beat shows its proposal as dashed "ghost" blocks on the timeline and in the preview at the playhead.
4. **Apply:**
   - **Place selected** (or **Place all confirmed**).
   - Before anything is written, the current edit is saved as a draft ("Before Prepare From Existing Work · time").
   - The selected items are then placed in **one** change.
   - A second draft ("Prepared from existing work · time") is saved after.
5. **Afterwards:** the placed clips are ordinary edit rows. You can move, resize, trim, replace, split, lock and unlock them with the tools that exist now. Undo of the whole apply is "restore the Before draft" (one step, offered in the notice). Run Prepare again at any time: already-placed items show as "on the edit", so only new work is proposed.
6. **Experiments:** each arrangement can be saved as a named draft and restored (Save Draft and the ⋮ menu exist today). Phase C4 adds side-by-side comparison of two drafts.

### C.4 UI

- **Top bar:** a `Prepare From Existing Work` button (lucide `Wand2`, text label always shown) beside Save Draft. It is disabled with its reason for a non-admin, or while a change saves.
- **Review sheet:**
  - Full width over the upper area, with the beat rail kept on the left so a beat can be clicked.
  - Header: the six status chips, which also filter the list.
  - Body: one card per beat, with lane rows inside.
  - Footer: the "Save the current edit as a draft first" note (always on), then `Cancel`, `Place all confirmed (N)` and `Place selected (N)`.
- **Status badges** have text and an icon, never colour alone: confirmed ✓, suggested ◇, ambiguous ?, missing !, conflict ⚠.
- **Below 1024 px:** the sheet becomes a stacked list. Applying works there, since it needs no multitrack.
- Uses the editor's existing dark tokens and one CSS file (`PrepareSheet.css`).

### C.5 Backend changes

No migration for C1–C3.

- `src/services/editSourcesService.js` (new, read only) gathers the sources for one episode in one REPEATABLE READ transaction:
  - `scene_plans` with each set and its angle resolved by label;
  - the set links;
  - the angles with their media;
  - the raw clips with beats, ★, marks and cutout state;
  - the current voice approvals with line associations and words;
  - script beats.

  It names no edit table (the `episodeEditGuard` boundary stays).
- `src/utils/assemblyPlan.js` (new, pure, unit-tested): `proposeAssembly(sources, edit)` returns `{ fingerprint, items[], unassigned[], missing[], summary }`. Each item is `{ key, beat, lane, status, evidence, op }`, where `op` is the existing batch step that would place it (`scene-clip.place` with `index`, `segment.place`, `item.add` performer_clip, `dialogue.place`). The fingerprint is a hash of the sources and the edit revision it was made for.
- `GET /edit/proposal` (requireAuth): reads only.
- `POST /edit/proposal/apply` (requireAuth + ADMIN, `edit_revision`, `fingerprint`, `keys[]`, `replace[]`):
  1. Recomputes the proposal and refuses 409 `PROPOSAL_CHANGED` if the fingerprint differs.
  2. Saves the "Before" version.
  3. Runs the chosen ops through `batchOps` in one transaction. A replace soft-deletes only the item it names.
  4. Saves the "After" version.
  5. Returns both version ids.

  A conflict item without `replace` is refused, never applied.
- `batchOps` gains `scene-clip.place` with `index` (built in this PR), `segment.place` with `no_commentary` (built in this PR), and the place steps it lacks.
- **Later (C4), optional:** an `edit_proposals` table (with `deleted_at`) to keep a reviewed proposal across sessions, and a draft compare read.

### C.6 Phases

| Phase | What | Writes? |
|---|---|---|
| **A (this PR)** | Editor reliability: undo and redo identity, restore, commentary, inspector, consistent reads, admin-only, legacy writes closed, cancelled drags | Code only; no migration, no flag change |
| **B0** | A fixed Diagnostics check `edit-sources` (read only, counts per episode, no rows), or working task-scoped AWS credentials, so per-episode facts can be confirmed | Workflow and script change only |
| **B1** | Discovery fixes without assembly: an **Existing work** tab in the media panel showing the scene plan per beat (with "set not linked" and "no media" said plainly), ★ and beat marks on clip tiles, and unassigned clips listed instead of hidden when a beat is focused | Reads only |
| **C1** | `editSourcesService`, `assemblyPlan.proposeAssembly`, `GET /edit/proposal`, with unit tests on every rule in C.2 and an integration test on a seeded episode | Reads only |
| **C2** | The review sheet (read only): summary, beats, evidence, ghost blocks | Reads only |
| **C3** | Apply: version before and after, one transaction, conflicts never applied without Replace, regression tests that nothing existing is deleted or moved | Writes the edit (needs Evoni's approval to ship) |
| **C4** | Beat lengths from Prime's marks (one `lockBeatTiming`, opt-in), draft compare, kept proposals | May add a migration (separate approval) |

### C.7 Open questions for Evoni

1. When a beat's scene plan has two scenes, should both be proposed in plan order, or only the first?
2. Should a dialogue line with no timing marks be offered "in order at the start of its beat" as a suggestion, or only listed as needing timing?
3. Prime's take with beat marks: one segment per beat (cut at each mark, as Files › Footage's cue sheet does), or one long segment?
4. The 169 rows in the older `assets` table: is any of it episode footage that should be brought into Files › Footage first?
