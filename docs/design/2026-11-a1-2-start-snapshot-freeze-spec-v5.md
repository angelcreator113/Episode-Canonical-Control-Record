# A1.2: freezing the Start snapshot (specification v5, consolidated)

**Status:** for review. **Not implemented.** No branch, PR, migration or data change.

**This replaces v4, v3, the v3 amendment, `A1.2-SPEC-REVISED.md` and `A1.2-CLARIFICATIONS.md`.** v5 applies your rulings of 2026-11-06 (late evening): **B-1 = (b), B-2 = yes, B-3 strengthened, D-22 details, D-23**. It also resolves how late context coexists with the permanent freeze. Every earlier instruction that conflicts with this text is withdrawn, including:
- the `event_metadata` provenance marker;
- comparison-based authorship;
- `activity_logs` as the audit table;
- the Q-11 text.

**Basis:**
- code at `origin/main` `7501add1`, which is what production runs (Deploy #198);
- the read-only checks R1–R5 (2026-11-06);
- the Episode 1 inspection;
- your rulings through 2026-11-06 (late evening).

**Confidence labels:**
- **V:** read in code or production (read-only).
- **I:** inferred.
- **U:** unknown.

---

## 1. Rulings this specification implements

| Ruling | Effect here |
|---|---|
| **A1-a** | Freeze at the first raw clip. Only the historical Start context freezes; production work continues (§9). |
| **A1-b / A1-c** | No manual freeze action and no database trigger (both deferred). |
| **A1-d / Q-7** | The freeze is permanent. Exceptions go only through a separately authorized recovery process (outside A1.2). |
| **A1-e** | `narrative_purpose` stays editable. |
| **D-13 = A** | `episodes.season_context` is protected from every automatic writer. Regeneration is refused once frozen. |
| **Q-1 (revised)** | Automatic writers never write a frozen episode's `designed_intent` or `allowed_outcomes`. Authorized manual Brief edits are kept, with revision protection and an audit trail. Authorship is never inferred from values. |
| **Q-2** | Soft-deleted clips still freeze the episode. |
| **Q-3** | Moving a frozen episode to a different slot is refused. |
| **Q-4** | Season setup skips frozen episodes and reports them visibly. |
| **Q-5** | Operations that would change a frozen two-parter snapshot are refused. |
| **Q-7** | Ordinary deletion of a frozen episode is refused for everyone, admins included. Restarting the event of a deleted frozen episode is also refused. |
| **Q-8** | Revision protection on **all** intent edits, frozen or not. |
| **D-22** | The audit trail is **`episode_intent_audit`**, a dedicated append-only table. A **reason is required** for frozen-episode intent edits, and the **actor's role at edit time** is recorded. The migration stays unimplemented until separately authorized. It is never `activity_logs`, and never `data_correction_log`. |
| **B-1 = (b)** | Until A1.2b's audited workflow is **deployed**, manual changes to `designed_intent`/`allowed_outcomes` on a **frozen** episode are **refused**. Other Brief fields stay editable. |
| **B-2 = yes** | `episodes.season_number` is frozen with the episode. |
| **B-3 (strengthened)** | Historical Start-record fields are protected from ordinary edits once filming begins. A1.2a holds the **smallest interim guard** (§6). An audited correction mechanism is designed separately. Unrelated Brief fields are not restricted. |
| **D-23** | Assigned Starts create their snapshot atomically; Unassigned Starts are explicitly identified; late context never masquerades as Start context. **This is implemented in A1.3.** A1.2a defines how late context coexists with the freeze (§8a) and refuses it until A1.3. |
| **Q-9, Q-10, E1-1, E1-2, E1-3, Q-6** | **Outside A1.2.** E1-2 goes to **A1.3** (with D-23); Q-10 is a separate design; E1-1, E1-3 and Q-6 belong to A2 or the corrections work. |

---

## 2. Scope: three PRs

| PR | Contents | Depends on |
|---|---|---|
| **A1.2a** | The freeze guard; every automatic writer W1–W12; the **interim Start-record guard** (§6: `season_number`, `event_difficulty`, `arc_number`, `position_in_arc`); the **interim intent refusal** on frozen episodes (B-1b, §7); static guards; tests. | none (B-1 to B-3 ruled) |
| **A1.2c** | Q-7: refuse deleting a frozen episode (Layer 1), and refuse restarting the event of a deleted frozen episode (Layer 2). | none |
| **A1.2b** | The audited manual intent edit path: ADMIN on frozen episodes, a **required reason**, the revision token (Q-8, on all briefs) and the `episode_intent_audit` row. **It lifts the B-1b refusal.** | the D-22 migration is approved and deployed |

**A1.2a and A1.2c have no migration. A1.2b needs the D-22 migration.**

---

## 3. When an episode is frozen

> An episode is **frozen** when `episode_raw_clips` holds **any** row with its `episode_id`, deleted or not.
> `frozen_at` = the earliest `created_at` of those rows.

**Why this holds** (all V):
- Clips are only soft-deleted (`rawClipsService.removeClip`). No code hard-deletes them.
- `episode_raw_clips.episode_id` has **no foreign key**, so nothing cascades into clips (R4).
- `updateClip` cannot change `episode_id`.
- R2: no orphan clips today, and no deleted episodes with clips.

**Production today (R3):** **only Episode 1** has clips: 9 rows, the earliest **2026-10-23 20:23:51 UTC**. When A1.2a deploys, Episode 1 freezes with `frozen_at` = **2026-10-23**. No migration is needed.

---

## 4. The guard (`src/utils/snapshotFreeze.js`, new)

- `snapshotFrozen(sequelize, episodeId, { transaction }) → { frozen, frozen_at }`.
- It **requires** the caller's transaction, and that the episode is already held `FOR UPDATE` (A1.1 `holdsEpisode`). Otherwise it throws `SNAPSHOT_GUARD_WITHOUT_LOCK`, a programming error. It never opens a transaction or takes a lock.
- The query: `SELECT MIN(created_at) FROM episode_raw_clips WHERE episode_id = :id` (no `deleted_at` filter).
- **Refusal:** HTTP 409, `{ code: 'EPISODE_SNAPSHOT_FROZEN', episode_id, frozen_at, message }`. Not retryable.
- **Skip report:** `snapshot_skipped: [{ episode_id, label, frozen_at, reason: 'snapshot_frozen' }]`.
- **Placement:** the guard is **inside** the four lowest-level `season_context` writers: `snapshotEpisode`, `snapshotSpecialEpisode`, `stampTwoPart`, `unstampTwoPart`. Callers only translate the outcome.
- **Lock order:** unchanged from A1.1. Episodes are locked first and the guard runs after the lock. There are no new locks and no nested transactions. A clip attach (`FOR SHARE`) and a writer (`FOR UPDATE`) serialize in either order.

---

## 5. Automatic writers of `season_context` and their frozen behaviour

| # | Writer (file:line, V) | When frozen |
|---|---|---|
| W1 | `seasonSlotService.snapshotEpisode` (`:407-490`) | **Writes nothing:** no snapshot, no `season_number`, no brief `designed_intent`/`allowed_outcomes` (`:480-488`), no `arc_number`/`position_in_arc`/`narrative_purpose` fill. Returns `{ frozen: true, context }`. |
| W2 | Start `assignOnStartIn` (`:725`) | Not reachable (a new episode has no clips). |
| W3 | Placement `placeEpisodeIn` (`:632`) | **Refuse (409)** for a different slot (Q-3). The same slot is a no-op. |
| W4 | Regenerate (`episodeGeneratorService.generateEpisodeFromEvent` with `replacingEpisodeId`) | **Refuse (409) twice:** a read-only pre-check beside `findStartBlockers` (`:463`), **before** the paid call (`:564`); and an authoritative check after the A1.1 lock (`:670`). |
| W5 | Season setup `updateSetup` (`seasonSetupService.js:410-416`) | Arc and phase changes apply. Frozen episodes are **skipped and reported**, and the Season setup screen lists them (Q-4). |
| W6 / W7 | Intention save and redraft (`seasonIntentionService.js:288-291`, `:585-587`) | The slot saves. The snapshot is **skipped and reported**. The panel note reads: "Episode N keeps its Start snapshot; this change applies to the slot." |
| W8 | Two-parter Part 2 (`seasonSpecials.js:664-692`) | The new Part 2 is snapshotted (insert plus snapshot in one transaction, V). Part 1's re-stamp is **skipped if unchanged** and **refused if it would change** (Q-5). |
| W9 | `stampTwoPart` / `unstampTwoPart` (`:512-538`; create `:578`, remove `:635`) | **Refuse (409)** when the stamp would change a frozen episode (Q-5). |
| W10 | `snapshotSpecialEpisode` (`:463-506`) via `updateSpecial` (`:434`) | **Skip and report.** The guard is inside the function, which holds the direct UPDATE (`:505`). |
| W11 | Start special (`:727`) | Not reachable. |
| W12 | Full-season special swap and move (`seasonFullSpecials.js:402-403`) | **Refuse (409)** (Q-3). |

---

## 6. Interim Start-record guard (A1.2a; B-2 and B-3)

**Rule:** once an episode is frozen, an **ordinary edit** may not **change** a historical Start-record field.
- It is a 409 `START_RECORD_FROZEN` naming the fields.
- **Sending the unchanged value is accepted**, because Brief forms send several fields together.
- Unrelated fields in the same request still save.

**Which fields** (V: the Start insert `episodeGeneratorService.js:702-800`, `snapshotEpisode`, and the two allowlists):

| Field | Why it is a Start record | Written today by | A1.2a, when frozen |
|---|---|---|---|
| `episodes.season_number` | written with the snapshot (W1) | W1; **`PUT /episodes/:id`** allowlist (`episodeController.js` ~`:523`) | W1 doesn't write it. **`PUT /episodes/:id`: a change is refused.** |
| `episode_briefs.event_difficulty` | Start's copy of strictness and deadline (and prestige and cost after A1.3/E1-2) | the Start insert; **`PUT /episode-brief/:id`** | **A change is refused** |
| `episode_briefs.arc_number`, `position_in_arc` | filled from the snapshot (W1) | W1; **`PUT /episode-brief/:id`** | W1 doesn't write them. **A manual change is refused.** |
| `episode_briefs.event_id` | Start's event link | Start; already immutable once set (`episodeBriefRoutes.js:99-106`) | unchanged (already protected) |
| `episode_briefs.designed_intent`, `allowed_outcomes` | partly snapshot-derived; a scoring and story target | W1; `PUT /episode-brief/:id` | **B-1b: a change is refused until A1.2b is deployed** (§7) |

**Not restricted** (unrelated or creative fields):
- `narrative_purpose` (A1-e) and `forward_hook`;
- `episode_archetype`: set at Start from the event, but a creative dropdown you are meant to change (`EpisodeOverviewSummary.jsx:90-91`);
- `lala_state_snapshot`: no Start writer (V);
- every episode field other than `season_number`.

Start writes these into the brief, but neither PUT allowlist exposes them, so they can't be edited and need no guard:
- `canon_consequences`, `career_context`, `narrative_chain`, `outfit_set_id`, `invitation_asset_id`, `season_id`, `arc_id`;
- `event_metadata`. Some of its keys are runtime keys written by other features, such as `cover_marks` and `feed_moment_save`.

**The audited correction mechanism** for these fields is a **separate design**, in the Q-10 family: admin-only, reason required, audited, never through the ordinary edit routes. Until it exists, a needed correction goes through the owner-run correction procedure (`data_correction_log`).

## 7. The manual intent path (A1.2b; needs the D-22 migration)

**Applies to** `designed_intent` and `allowed_outcomes` through `PUT /episode-brief/:id`. **No automatic writer ever writes them on a frozen episode** (W1).

1. **Authorization and reason.** On a frozen episode, only **ADMIN** may change the two fields, and the request must include a **non-empty `reason`** (D22-b). The audit row records the actor's role at edit time (D22-c). On an unfrozen episode, today's authorization is unchanged. Other Brief fields are unchanged, including `narrative_purpose` (A1-e).
2. **Revision protection (Q-8: all briefs, frozen or not).**
   - **The token:** `intent_revision = 'ir1-' + sha256(stable JSON of {designed_intent, allowed_outcomes})` (the `utils/scriptRevision.js` pattern; **no column**). `GET /episode-brief/:id` returns it.
   - **A write that changes either field must send it.** The server locks the brief row (`FOR UPDATE`, after the A1.1 episode lock) and recomputes the token.
   - **Stale token:** **409 `INTENT_REVISION_STALE`**, with the current values. **Missing token:** **409 `INTENT_REVISION_REQUIRED`**. Nothing is written in either case.
3. **Audit.** Each change writes one row to **`episode_intent_audit`** **in the same transaction** as the brief update: actor, episode, brief, before and after values, before and after revision, reason, timestamp. If the audit insert fails, the edit rolls back.
4. **Locked briefs** (`status = 'locked'`) stay refused, as today. Unlock is the separate Q-10 design.
5. **Interim (B-1 = b):** from A1.2a until A1.2b is **deployed**, any change to `designed_intent`/`allowed_outcomes` on a **frozen** episode is refused: 409 `INTENT_EDIT_PENDING_AUDIT`, "Intent on a filmed episode can be changed once the audited editor is available." Unfrozen episodes are unaffected. A1.2b removes this refusal and replaces it with points 1–3.

---

## 8. Deletion and restart (A1.2c)

**Every way an episode is deleted** (V, grep):
- `episodeController.deleteEpisode` (`:824-845`; soft in production, `?hard=true` outside it);
- regenerate's soft delete (`episodeGeneratorService.js:805`; covered by W4).

The show-create purge (S4) cannot reach episodes, because there is no FK (R4).

**Layer 1: refuse deleting a frozen episode.**
- `DELETE /episodes/:id` locks the episode, runs the guard, and returns **409** for every role (admins included), and for `?hard=true` too.
- The UI hides or disables Delete and shows the reason.

**Layer 2: refuse restarting the event of a deleted frozen episode.**
- **The gap today:** `stampEventUsed` (`:401-427`) re-stamps an event whose linked episode is deleted, and `findStartBlockers` only sees **live** episodes. V
- **The new blocker:** if the event's `used_in_episode_id`, or a brief `event_id` link, points to a **deleted episode that is frozen**, then Start, `generate-episode-from-many` and `inject` are refused with **409 `EVENT_EPISODE_FROZEN`**.
- **Where it's checked:** in the pre-check (before any paid call), and again under the event lock inside the Start transaction.
- **Production impact today:** none (R2: no deleted frozen episodes).

---

## 8a. Late context and the permanent freeze: how they coexist (D-23)

**The problem:**
- The freeze makes `season_context` permanent once filming begins.
- D-23 allows an **Unassigned** episode to receive season context **after** filming, as **late context**, never as a Start snapshot.
- A general "write context when frozen" exception would be a bypass.

**The design: one narrowly shaped exception.**

1. **Every context write records what kind it is** (A1.3, inside the existing `season_context` object; not hidden metadata):
   - `context_kind: 'start'`: written in the Start transaction (assigned Starts, D-23);
   - `'placement'`: an Unassigned episode placed **before** filming;
   - `'late'`: placed **after** filming.

   Each kind keeps its own real timestamp. Only `'start'` may carry `snapshotted_at` with Start meaning. `'late'` carries `late_recorded_at`, `recorded_by`, `recorded_role`, `reason` and the episode's `frozen_at`.

   **Existing snapshots are never relabelled.** They have no `context_kind`. Readers show them as recorded on their `snapshotted_at` date. Episode 1's snapshot is untouched.
2. **The exception, all conditions together, checked under the A1.1 episode lock:**
   - **(a)** the episode is frozen;
   - **(b)** `season_context IS NULL`: there is no context of any kind. The exception **can never replace or amend** an existing context;
   - **(c)** the write comes only from **placement** (`placeEpisodeIn`) or the **specials start** for that episode, through one function, `recordLateContext()`. The static test pins it as the **only** caller allowed to write a frozen episode;
   - **(d)** ADMIN, with a required `reason`;
   - **(e)** it writes `context_kind: 'late'` and never `'start'`.
3. **Once written, the late context is itself frozen,** by the normal rule: the episode is frozen and its context is no longer NULL. So the exception is **one-time per episode**. It can't be repeated or used to edit.
4. **There is no app path that clears `season_context` to NULL.** The four writers only write objects. `unstampTwoPart`'s `COALESCE(…,'{}')` is refused for frozen episodes (W9). The static test fails if any code sets it to NULL. Only owner SQL could, and that is outside the app (A1-c).
5. **In A1.2a, before A1.3:**
   - A1.2a ships **without** the exception. Placing a frozen episode that has no context is refused: 409 `LATE_CONTEXT_NOT_AVAILABLE`.
   - **Production impact today: none** (R3: the only frozen episode, Episode 1, has a snapshot).
   - A1.3 adds `recordLateContext()` together with the `context_kind` labels, atomic assigned Starts and Unassigned Starts.

**Why it isn't a general bypass:**
- It can only fill an **empty** context, once.
- It can only come from one pinned function.
- It is ADMIN-only with a reason.
- Its result is labelled **late**, and is then frozen like any other context.

**Tests (A1.3):**
- Each condition violated, (a)–(e), → refused.
- A second late write → refused.
- A late context on an episode that has an existing snapshot → refused.
- The static writer pin includes `recordLateContext` as the only frozen-allowed writer.

## 9. What is never blocked

**V, by grep:** none of these call the four writers, `PUT /episodes/:id` with `season_number`, or the intent fields:
- script generation and editing;
- wardrobe;
- the scene plan, the 14 beats and locks, and the BeatScenes sync;
- Scene Studio;
- raw-clip upload, attach, keying and linking (the first attach is what freezes, and is never blocked);
- voice, editor, distribution, todos and overlays;
- every other Brief field.

---

## 10. Interaction with the correction procedure

- **The append-only `corrections` note** (prepared-corrections §3), run by the owner through the migration credential, adds one key inside `season_context`.
  - **A1.2 is app-level only**, so the procedure keeps working.
  - **The freeze is defined as:** every key present at freeze time is immutable. Only the append-only `corrections` key may be added, and only by the documented correction procedure.
  - The static test allows that procedure (its scripts live outside `src/`).
  - Any future DB trigger (A1-c) must allow exactly this key.
- **`data_correction_log`** stays owner-only for corrections. **The D-22 table** is for routine audited intent edits. **They are separate.**

---

## 11. Episode 1

- **Freezes on deploy** (`frozen_at` 2026-10-23).
- **Baseline (R5):** `season_context` md5 **`87af8a60b96fae7b3d7419f1fa72e6cb`**; brief `slay` / `[slay, pass, safe]`. The full JSON is saved as `ep1-season-context-baseline-2026-11-06.json`.
- **Until A1.2a deploys,** a slot-1 intention save or redraft, a season setup edit, or a two-parter or special action touching Episode 1 would overwrite its snapshot and change `slay` to `pass`. Avoid these until then.

---

## 12. Closure matrix: does A1.2a + A1.2c close every identified path?

| Path | Closed by | Notes |
|---|---|---|
| `snapshotEpisode` from Start, placement, regenerate, setup, intention save and redraft, Part 2, full-season specials | **A1.2a** (W1–W8, W12) | the guard is inside the function |
| `snapshotSpecialEpisode` (its direct UPDATE) | **A1.2a** (W10) | inside the function |
| `stampTwoPart` / `unstampTwoPart` | **A1.2a** (W9) | inside the function |
| Brief intent overwritten by the automatic slot sync | **A1.2a** (W1) | Episode 1's `slay` protected |
| **Manual** brief intent edits on a frozen episode | **A1.2a** (B-1b: refused) | **A1.2b** later re-opens them with ADMIN, reason, revision and audit |
| `season_number` via `PUT /episodes/:id` | **A1.2a** (§6) | |
| Brief `arc_number`/`position_in_arc` (manual) | **A1.2a** (§6) | |
| Brief `event_difficulty` (Start record) | **A1.2a** (§6) | |
| Late context on a frozen episode with no context | **A1.2a refuses**; **A1.3** adds the one-time exception (§8a) | |
| Regeneration | **A1.2a** (W4) | before any AI spend |
| Soft-deleted clip "un-freezing" | **A1.2a** (§3 definition) | |
| Clip hard delete or reassignment | **A1.2a** (static guards) | none exist today |
| **Ordinary delete** of a frozen episode | **A1.2c** Layer 1 | admins included |
| **Delete, then restart** via Start / from-many / inject | **A1.2c** Layer 2 | it also covers deletions made outside the app |
| A future code path writing `season_context` | **A1.2a** static guard | |
| Direct SQL by the owner | **Out of scope** | correction procedure (§10); trigger deferred (A1-c) |
| Live Event Package fields read by completion | **Out of scope** | D-14 → A2 |

**Answer:** with B-1b, B-2 and B-3 ruled, **A1.2a and A1.2c together close every identified path:**
- automatic snapshot overwrites;
- manual changes to Start-record fields and frozen intent;
- delete;
- restart.

The only remaining routes are owner SQL (outside the app) and the deliberately designed future paths: A1.2b's audited intent edit and A1.3's one-time late context.

---

## 13. Tests (acceptance)

### Unit

- **`tests/unit/utils/snapshotFreeze.test.js`:**
  - the guard requires a transaction and the `FOR UPDATE` lock;
  - frozen with only soft-deleted clips;
  - `frozen_at` is the minimum `created_at`;
  - not frozen with no rows.
- **`tests/unit/utils/intentRevision.test.js`** (A1.2b): the token is stable regardless of key order; it differs on any value change; the `ir1-` prefix.

### Integration: `tests/integration/snapshotFreeze.integration.test.js` (A1.2a)

1. **Regression:** unfrozen episodes behave as today for W1, W3, W5–W10 and W12.
2. **Frozen:** each of W1–W12 refuses or skips. `season_context` and `season_number` are **byte-identical**; brief intent, `arc_number` and `position_in_arc` are unchanged.
3. **Episode 1 shape:** frozen, range `{safe..pass}`, brief `slay`/`[slay,pass,safe]`. After every writer, the brief is still `slay`/`[slay,pass,safe]`.
4. **Season setup with mixed episodes:** the arc changes apply, the draft is re-snapshotted, and the frozen one is reported and unchanged.
5. **Regenerate frozen:** the pre-check gives 409 with **no AI call** (mock asserted). A clip inserted between the pre-check and the lock gives 409, nothing written.
6. **Two-parter:** create and remove on a frozen Part 1 → 409. Part 2 start → Part 2 snapshotted, Part 1 unchanged.
7. **Specials:** `updateSpecial` → skip and report; swap and move → 409.
8. **Races, both orders, no deadlock and a consistent end state:** clip vs intention save, clip vs setup, clip vs regenerate.
9. **Static guards:**
   - `season_context` is written only in the four functions;
   - no `DELETE FROM episode_raw_clips`;
   - `episode_id` is not in `updateClip`'s allowlist.
10. **Start-record guard (§6):**
    - `PUT /episodes/:id` changing `season_number` on a frozen episode → 409 `START_RECORD_FROZEN`; the same request's other fields save; sending the unchanged value → 200.
    - `PUT /episode-brief/:id` changing `event_difficulty`, `arc_number` or `position_in_arc` on a frozen episode → 409; unchanged values → 200; `narrative_purpose`, `forward_hook` and `episode_archetype` → 200.
    - **On an unfrozen episode, all of these save as today.**
10a. **B-1b:** changing `designed_intent`/`allowed_outcomes` on a frozen episode → 409 `INTENT_EDIT_PENDING_AUDIT`; unchanged values → 200; on an unfrozen episode → saves as today.
10b. **Late context (A1.2a):** placing a frozen episode whose `season_context` is NULL → 409 `LATE_CONTEXT_NOT_AVAILABLE`; nothing written. A static test fails if any code sets `season_context` to NULL.
11. **Correction procedure:** a simulated owner-run append of `corrections` leaves every original key byte-identical, and the app writers still skip.
12. **Planned guests:** the brief's planned-guest copy is unchanged after live guest edits on a frozen episode.

### Integration: `tests/integration/frozenEpisodeDelete.integration.test.js` (A1.2c)

13. Delete a frozen episode as non-admin, as admin, and with `?hard=true` (non-production) → 409; the episode stays live.
14. Soft-delete a frozen episode by SQL, then try Start, `generate-episode-from-many` and inject on its event → 409 `EVENT_EPISODE_FROZEN`. No new episode, no AI call.
15. Delete and restart an **unfrozen** episode → works as today (regression).
16. Race: clip attach vs delete, in both orders, gives a consistent result.

### Integration: `tests/integration/briefIntentEdit.integration.test.js` (A1.2b)

17. Non-admin changing intent on a frozen episode → 403. An admin **without a reason** → 400. The B-1b refusal is gone once A1.2b is in.
18. Missing token → 409 `INTENT_REVISION_REQUIRED`; stale token → 409 `INTENT_REVISION_STALE` (on frozen **and** unfrozen briefs, Q-8).
19. An admin with the current token and a reason → saved, plus exactly one `episode_intent_audit` row with all fields, including `actor_role` and `reason`.
20. A forced audit insert failure → the brief is unchanged (rollback).
21. `narrative_purpose` saves without a token (A1-e); other fields are unaffected.

### Existing suites stay green

`episodeLockSafety`, `startRegenerateLocks`, the season, specials and two-parter suites, `beatScenes`, `beatScenesProductionShape`, `youtubeTrainingApiDisabled`.

### Frontend

- the Season setup skipped list;
- the slot-panel note;
- the 409 messages (regenerate, move, two-parter, delete, restart);
- Delete disabled with its reason;
- (A1.2b) the intent conflict message and token handling.

---

## 14. Not changed by A1.2

- Completion and preview inputs, and guest readers (D-14, Q-6 → A2).
- The Start-record contents and atomic Start (A1.3).
- Live Event Package editability (D-15).
- The locked-brief unlock (Q-10).
- The recovery process (A1-d / Q-7).
- Episode 1 data (E1-1, E1-3).
- P0-8, P0-9 and other P0 items.

---

## 15. Questions remaining

| # | Question | Recommended | Consequence |
|---|---|---|---|
| **V-1** | Confirm the §6 classification: `episode_archetype` stays editable (a creative label), and `event_difficulty`, `arc_number`, `position_in_arc` and `season_number` are protected. | Confirm. | Any change here changes the interim guard's field list. |
| **V-2** | Late context in A1.3 needs ADMIN and a reason, recorded **inside** the late context object. Should it **also** write a durable audit row, for example a second D-22-style table, or an `episode_intent_audit`-style general context audit? | Record it inside the context for now: none exist today (R3). Revisit with A1.3. | No extra migration now. |

**B-1, B-2, B-3 and D22-a/b/c are resolved.**

## Appendix: D-23 audit of episode-creation paths (input to A1.3)

| # | Path | Event? | Slot or special? | Snapshot today | D-23 requirement |
|---|---|---|---|---|---|
| 1 | Start: `POST …/generate-episode` → `generateEpisodeFromEvent` | yes | if the event is pencilled | **after the commit, non-fatal** (`episodeGeneratorService.js:846`) | **Atomic:** assignment and snapshot inside the Start transaction when assigned; an explicit **Unassigned** state when not. |
| 2 | Generate from N events (`episodeBatch.js:86`, same function) | yes (anchor) | same | same as #1 | same as #1 (also gains the locations step, D-4) |
| 3 | Regenerate (`episodeBatch.js:225`) | yes | moves the slot | after the commit | same as #1, plus the W4 freeze refusal |
| 4 | Two-parter Part 2 (`seasonSpecials.js:664-692`) | — | slot | **atomic already** (insert plus snapshot in one transaction) | consistent ✓ |
| 5 | Special start (via #1, special branch `:727`) | yes | special | after the commit | same as #1 |
| 6 | `POST /episodes` (`episodeController.js:337`; QuickEpisodeCreator create, `episodeService.create`) | no | none | none | Explicit **Unassigned** state; later placement records **late context** (below) |
| 7 | `inject` (links an event to an existing episode) | links | — | none (`inject.js:196`) | Treat as late linking: no Start snapshot is fabricated; refuse frozen-deleted (A1.2c). |
| 8 | Seed routes (`seed.js`) | — | — | — | not mounted in production |

**Late context:** see §8a (the coexistence design).
