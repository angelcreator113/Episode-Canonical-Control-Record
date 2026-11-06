# The Start snapshot freeze (A1.2a)

**Status:** a living note on how the freeze works in code. The rulings are Evoni's of 2026-11-06 (A1-a to A1-e, D-13 = A, Q-1 to Q-8, B-1 = b, B-2, B-3, V-1). The design is A1.2-SPEC-v5.

## When an episode is frozen

An episode is **frozen** once `episode_raw_clips` holds any row for it, including removed (soft-deleted) clips. `frozen_at` is the earliest of those rows' `created_at`. The first clip upload is what freezes it, and uploads are never blocked.

The freeze is permanent. There is no switch to turn it off.

## The guard: `src/utils/snapshotFreeze.js`

- **`snapshotFrozen(sequelize, episodeId, { transaction })`**
  - It needs the caller's transaction, with the episode already locked `FOR UPDATE` by `lockEpisodes` (A1.1). Otherwise it throws `SNAPSHOT_GUARD_WITHOUT_LOCK`.
  - A clip attaches under `FOR SHARE` on its episode, so a clip and a snapshot writer always take turns.
- **`peekFrozen`** is a read-only pre-check used only before a paid model call (regenerate). The authoritative check is always under the lock.
- **Refusals** are 409s and are never retried:

| Code | When |
|---|---|
| `EPISODE_SNAPSHOT_FROZEN` | A writer would change a frozen episode's `season_context`: a move to another slot, regenerate, a two-parter stamp, a special swap or a move to the next season |
| `START_RECORD_FROZEN` | An ordinary edit would change a Start-record field (below) |
| `INTENT_EDIT_PENDING_AUDIT` | An edit would change a frozen episode's `designed_intent` or `allowed_outcomes`, before A1.2b's audited editor is deployed |
| `LATE_CONTEXT_NOT_AVAILABLE` | Placing a frozen episode that has no season context. Recording late context is A1.3's one-time, labelled path, never a Start snapshot |

## The four writers of `episodes.season_context`

The guard sits **inside** each of the four writers, so no caller can skip it. `tests/unit/guards/snapshotFreezeStatic.test.js` fails if a fifth writer appears, or if any code sets `season_context` to NULL.

| Writer | When the episode is frozen |
|---|---|
| `seasonSlotService.snapshotEpisode` | Writes nothing: not the context, `season_number`, the brief's intent, arc number, position or purpose. It returns `{ frozen: true, context }` |
| `seasonSpecials.snapshotSpecialEpisode` | Writes nothing; returns the same marker |
| `seasonSpecials.stampTwoPart` / `unstampTwoPart` | Allowed only when the stamp is already exactly there (Part 1 when Part 2 starts); otherwise 409 |

## What callers do with a skip

| Caller | What happens |
|---|---|
| Intention save and redraft | The slot saves. The response lists `snapshot_skipped`, and the slot panel says the episode keeps its Start snapshot |
| Season setup | The season's change saves. Filmed episodes are listed in `snapshot_skipped` and named in the Season page's note |
| Special edit (title, type or position) and "move to its story position" | The special saves, and its filmed episode is listed |
| Placement into another slot; the full-season swap and move to the next season; making or undoing a two-parter on a filmed Part 1; regenerate | Refused (409) before anything is written. Regenerate is refused before the model is asked, and again under the lock |

## The interim Start-record and intent guards

**Protected once frozen** (V-1, exactly these):
- `episodes.season_number`, through `PUT /episodes/:id`;
- `episode_briefs.event_difficulty`, `arc_number` and `position_in_arc`, through `PUT /episode-brief/:id`.

How a request is treated:
- Sending the value already stored is accepted.
- A refused request writes nothing, including its other fields.
- A request that sends none of these fields saves exactly as before, without the extra lock.

**Frozen intent:** `designed_intent` and `allowed_outcomes` changes are refused on a frozen episode until A1.2b (ADMIN, a required reason, the revision token and an `episode_intent_audit` row) is deployed.

**Still editable:** `episode_archetype`, `narrative_purpose`, `forward_hook` and `lala_state_snapshot`. The existing `event_id` rule (immutable once set, `EVENT_TERMS_LOCKED`) is unchanged.

## What is never blocked

Script writing and saving, wardrobe, the scene plan and beats, Scene Studio, raw-clip upload and keying, voice, the editor, distribution, todos and overlays, and every other Brief and episode field. None of them call the four writers.

## Corrections

The owner-run correction procedure appends a `corrections` key with SQL through the migration credential, outside the app. The freeze is app-level, so that procedure still works: every key present at freeze time stays byte-identical.
