# Season Planning — Consolidated Specification

**Status.** A **new consolidated specification**, compiled on 2026-11-10 from Evoni's rulings given in the Season Planning sessions of 2026-11-09 and 2026-11-10. It is **not** a recovered copy of any earlier document. Accepted by Evoni on 2026-11-10. The rulings are recorded verbatim in `docs/EVENT_EPISODE_FLOW.md` §8(ii), and A7-x and A9-r in §8(ff). Where this file and §8(ii) differ, §8(ii) governs.

**Basis.** `origin/main` at `6588d4676f11ae9406288382598034ffa5946065`.

**Citation style.** Code is cited by stable name, with a line number only alongside it (living-doc convention, CLAUDE.md "Docs").

**Labels.**
- **RULED**: Evoni's words, quoted.
- **VERIFIED**: read in code at the basis.
- **GATE**: technical work or approval still owed.
- **OPEN**: no ruling in the source conversation.

---

## 1. Purpose and approved design (RULED)

**Quotation format.** The quotations below are Evoni's words, unchanged. Where her message used bulleted lists or line breaks, the items appear here joined into running text in their original order, with separators ("—", "·") or spaces standing in for the breaks. No words are added or removed.

Evoni, 2026-11-10, the approved Season Planning design, verbatim:

> "The proposed page has three primary views: Roadmap — Default arc-grouped presentation · Optional compact episode list · Selectable season slots · Contextual slot panel · Lightweight planning before episode creation · Move and Swap Episode actions. Story & Arc — Existing arc goals and story progression · Links to authoritative story tools · No duplicate script or Story Thread editor. Schedule — Existing release dates and scheduling context · Scheduling conflicts and discrepancies · Links to the authoritative scheduling workflow · No second publishing scheduler."

**Empty-slot planning (RULED, verbatim):**

> "An empty slot can contain lightweight planning without creating an episode. Existing planning records and fields must be reused. Creating an episode uses the existing canonical creation workflow. Slot-owned planning notes remain with their existing authority. Episode Home references the current slot's planning information rather than creating another editable copy. Selecting a slot never automatically creates an episode."

**Move and Swap (RULED, verbatim):**

> "Move an episode into an empty slot. Offer an explicit Swap when the destination contains another episode. Allow movement between arcs. Preserve episode identities and production records. Preserve story plans with their authoritative owners. Preserve release dates unless separately changed through the existing scheduling authority. Permit published episodes to move or swap with enhanced impact review. Review both episodes and affected slots during a swap. Prevent partial updates, duplicate occupancy, and stale confirmations. Never automatically regenerate scripts, scenes, footage, voice, wardrobe, or gameplay results."

**Event Packages (RULED, verbatim):**

> "A placement change must not automatically change an episode's primary Event Package or accepted commitments. Event-driven and non-event episodes must both be supported without requiring unnecessary Event Packages."

**Later rulings that narrow the Move and Swap rules.** The first rollout excludes published episodes and two-parters. See §7.

---

## 2. Ruling index

### 2.1 How to read this index

- Evoni approved R-1 to R-11 on 2026-11-10. That approval cites an earlier "Season Planning Design Specification", which is not available in the repository or the session.
- The **Outcome** column quotes Evoni's own 2026-11-10 statement of each outcome, copied from her messages in the Season Planning sessions.
- Those statements are **her restatements on 2026-11-10**. They are not quotations of the earlier specification's wording, and must not be filed as its text.
- The **Implementation** column says whether the code already does this (VERIFIED) or still owes it (PENDING).

### 2.2 Index

| # | Question (Season Planning audit §10.1) | Outcome (RULED; Evoni's 2026-11-10 statement, quoted) | Implementation |
|---|---|---|---|
| R-1 | Release dates on Move | "R-1 — Preserve release dates" (Phase 0 heading). Mechanism: "Choose A2: nullable 'season_slots.release_position', subject to integrity verification and separate migration approval." | Migration written (§4.8); nothing writes the column yet. Move/Swap PENDING |
| R-2 | Filmed and published episodes | "R-2 — Separate production freeze from placement" (Phase 0 heading). Refinement: "Adopt narrowly scoped A7-x and freeze amendments for placement-only operations." | PENDING (A7-x, Amendment 1, §6). Published episodes excluded at first (§7). |
| R-3 | Episode Home source | "R-3 — Current placement versus historical context" (Phase 0 heading). Refinement: "Historical context uses the existing working/filmed snapshot semantics, not a new at-Start record." | PENDING (read-only display) |
| R-4 | Who edits special release dates | "Special-date editing belongs in Producer Mode → Release." | PENDING. Today the Roadmap special card also edits them (`SeasonSpecials` `AddSpecialForm` and `SpecialEditor`, PATCH `/season/specials/:id`). Those inputs become read-only, linking to Release (`SpecialReleaseDates`). |
| R-5 | Pulse posts when release dates change | "The Pulse scheduling changes only when effective release dates change, with explicit review; published posts remain unchanged." | VERIFIED: A2 leaves effective dates unchanged, so a Move/Swap changes no Pulse scheduling. PENDING: the review step for date-changing actions (e.g. "Back to story order"). Today `setEpisodeDate` does not shift posts, while `episodeController.updateEpisode` shifts them with no review (`postRelease.shiftForAirDate`). |
| R-6 | Ordering key | "Preserve 'episode_number'; slot order drives Roadmap." | VERIFIED: placement never writes `episode_number`, and the Roadmap orders by `slot_number`. Note: `storyClock` and `postRelease` still order by `episode_number`, so the two orders can differ after a move. The Schedule view shows that difference; it is not corrected. |
| R-7 | What "arc-grouped" means | "Reuse existing 'ShowArc.phases' Parts." | VERIFIED: the Roadmap Grid already groups by Part (`SeasonRoadmapTab`, `roadmap.phases`). Scope (RULED 2026-11-10, Gate 1 review): movement across Parts within a season is in the initial scope; cross-season movement is **deferred, not permanently prohibited**. |
| R-8 | Plan inheritance on Move | A7-x: "A moved episode takes the destination slot's part and intention." | PENDING implementation |
| R-9 | Permissions | "New placement endpoints require ADMIN authorization." | PENDING |
| R-10 | Free-text slot notes | "No new free-text planning column." | VERIFIED: none exists. "Slot notes" remain the existing twists, reveals and needs (`SlotNotes`). |
| R-11 | Non-event episodes | "Support canonical non-event episode creation with inherited slot context." | PENDING. Every canonical Start today requires an event (`generateEpisodeFromEvent`). Manual `POST /api/v1/episodes` creates no brief and no slot. `NewEpisodeStarter`'s "Personal Story" card is disabled ("Needs your ruling first"). Design of the canonical path: GATE. |

---

## 3. Data ownership (VERIFIED; the "Proposed" column is RULED direction)

| Information | Authority | Derived copies | Proposed (RULED direction) |
|---|---|---|---|
| Slot position and Part | `season_slots.slot_number`, `.phase` (+ `ShowArc.phases`) | `episodes.season_context` | — |
| Slot occupant | `season_slots.episode_id`, `locked_at` | `season_context` | — |
| Pencilled event, before Start | `season_slots.event_id` | — | — |
| Episode's Event Package | `episode_briefs.event_id`, through `episodeEventIdSql` | `world_events.used_in_episode_id`, the slot's `event_id` after Start | Placement never changes it (RULED §1) |
| Accepted commitments | `world_events` locked fields (`eventTermsLock`), price snapshot, `event_deliverables`, offer decision | brief `event_metadata.terms` | Placement never changes them |
| Slot intention | `season_slots` intention columns, written through `seasonIntentionService.writeIntention` | `season_context` keys; brief `designed_intent`/`allowed_outcomes` (synced from `outcome_range`) | Read-only on Episode Home for slotted episodes (RULED refinement). Unslotted episodes keep editing. |
| `narrative_purpose` (K-A, K-A1) | **Episodes in a weekly season slot:** the slot's primary story purpose. **Specials' episodes and unslotted episodes:** the brief's own `episode_briefs.narrative_purpose`. | For weekly-slot episodes the brief value is a stored copy. Today it is filled only when empty (`COALESCE`, `seasonSlotService.snapshotEpisode`). No provenance marker exists for it (VERIFIED). | RULED (K-A, K-A1): for weekly-slot episodes, read-only on Episode Home, and the server refuses changes. Specials and unslotted episodes keep editing. A stored non-empty brief value is never overwritten by synchronization: provenance cannot be established reliably, and resemblance to current planning is not proof (A1.2-SPEC-v5 Q-1: "Authorship is never inferred from values"). The brief is preserved and the discrepancy is shown for review. Locked briefs and filmed history are never overwritten. |
| Twists, reveals, thread plans | `season_twists`, `season_reveals`, `show_story_threads` (keyed by slot id) | — | Stay with the slot |
| Release date | Computed by `releaseSchedule.computeDates` from the schedule plus the slot's position. Override: `episodes.air_date` | distribution `scheduled_time`, `opportunities.publish_date` | `computeDates` stays the sole authority (RULED) |
| Story date | `world_events.event_date` | — | — |

---

## 4. R-1 mechanism: A2 release position

RULED: "Choose A2: nullable 'season_slots.release_position', subject to integrity verification and separate migration approval." RULED: "Preserve 'releaseSchedule.computeDates' as the sole release-date authority."

### 4.1 Behaviour (VERIFIED by tests on hypothetical data, 32/32)

- **Numbering.** An episode's release number is `COALESCE(release_position, slot_number)`. With every position NULL, the dates are identical to today's.
- **Move and Swap exchange effective positions.** The two slots trade their effective positions, normalised so that a position equal to `slot_number` is stored as NULL. Every episode then keeps its date, its source stays "schedule", and nothing is hand-pinned.
- **Raw slot numbers must never be written.** Doing so after an earlier swap breaks the permutation, and `computeDates` then silently drops an episode's date.

### 4.2 Integrity (GATE)

The migration is to provide the following integrity rules. **The SQL below is proposed and unverified.** Its syntax, operator-class needs and extension needs are not asserted to be valid until the isolated PostgreSQL 15 tests (§4.6) pass. If written as an exclusion constraint, it would be raw SQL in a new `src/migrations/` file, because Sequelize's `addConstraint` has no EXCLUDE support.

- `CHECK (release_position IS NULL OR release_position BETWEEN 1 AND 24)`.
- **Effective-position uniqueness**, deferred to commit. Proposed form (unverified): `EXCLUDE USING btree (arc_id WITH =, (COALESCE(release_position, slot_number)) WITH =) WHERE (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED`.
  - **Unverified expectations,** to be confirmed or refuted by K1:
    - btree with `=` on `uuid` and `int4` needs no extension;
    - `btree_gist` is not required;
    - an exclusion constraint accepts `DEFERRABLE INITIALLY DEFERRED`, an expression element and a `WHERE` predicate.
  - If any expectation fails, the rule is redesigned before any migration is proposed.
- **Occupancy uniqueness** (one live slot per episode), deferred to commit. Proposed form (unverified): `EXCLUDE USING btree (episode_id WITH =) WHERE (deleted_at IS NULL AND episode_id IS NOT NULL) DEFERRABLE INITIALLY DEFERRED`.
- The existing `season_slots_arc_slot_live` UNIQUE `(arc_id, slot_number)` stays as it is. It keeps the NULL-override fallbacks distinct.
- **Application checks.**
  - Expected occupants, events and release positions are re-checked under row locks.
  - An in-transaction assertion confirms the release order is still a valid permutation of 1–24 and that every date matches.
- **Failure classes.** These are kept distinct. **No Move/Swap confirmation is ever retried automatically.** Every confirmation is bound to the impact preview it came from. **Any failed confirmation attempt, of any class, invalidates that preview in the Season page**, and the user must obtain a fresh impact preview before confirming again. The enforcement boundaries are set out below (G1-E1).

  | Class | Detected by | Meaning | Response |
  |---|---|---|---|
  | Stale state | The expected-state re-check under lock fails (occupant, event, position or date differs from the confirmed preview) | The season changed after the preview | 409 `SEASON_PLACEMENT_STALE`. Nothing is written. The preview is invalidated; **a fresh preview is required.** |
  | Validation refusal | A domain guard (frozen, accepted, published or released, two-parter, special, completed Part or season, pencil conflict, invalid special window, drift) | The placement is not allowed as requested | 409 with its domain code. Nothing is written. The preview is invalidated. **Once the conflict is resolved, a fresh preview is required.** |
  | Exclusion violation | `23P01` at COMMIT (deferred constraints) | The integrity backstop caught something the application checks missed. This is a defect signal. | Rolled back. 409 `SEASON_PLACEMENT_INTEGRITY`, logged with `console.error`. The preview is invalidated. **Once the defect is repaired, a fresh preview is required.** |
  | Deadlock or lock timeout | `40P01` / `55P03` (`episodeLocks.isLockConflict`) | A transient lock contention. The transaction rolled back and nothing was written. | 409 `SEASON_PLACEMENT_BUSY`. **This invalidates the current confirmation attempt.** The preview is invalidated, and **a fresh preview is required** before confirming again. |
  | Audit write failure | The `activity_logs` writer throws inside the transaction | The required audit entry could not be written | Rolled back. 500 with its own code. The preview is invalidated. **Once the audit log is fixed, a fresh preview is required.** |

  Today `episodeLocks.asRetryable` folds `40P01`/`55P03` into `RetryableConflictError` ("try again", code `RETRY`), and `pencilEventIn` raises `SEASON_CHANGED_RETRY`. **Move/Swap must not reuse either for any failure class**, because "try again" invites resending a confirmation. Existing operations keep them unchanged.

  **Preview invalidation and enforcement boundaries (RULED G1-E1 = Option A; PENDING implementation).**

  *Season page (client) enforcement.*
  - Every failed Move/Swap confirmation, of any class, invalidates the current preview in the Season page. The page discards the token.
  - Confirm stays disabled until a fresh impact preview is successfully generated.
  - The page never re-sends a token automatically. **No automatic confirmation retry exists, in either client or server.**

  *Server enforcement, on every confirm.* All of these run inside one transaction, under the required locks (episodes → events → slots, in id order):
  - the signed confirmation token's signature;
  - its expiration;
  - ADMIN authorization;
  - the expected placement state (occupants, events, release positions, dates);
  - the event pencils;
  - the applicable production restrictions (freeze, acceptance, published or released, two-parter, special, completed Part or season, special release window).

  The placement changes and their `activity_logs` entry commit together. Any failure rolls back the entire transaction.

  *Confirmation token (RULED 2026-11-10: Outcome B, dedicated signing secret; design wording only, PENDING implementation).*

  1. **Dedicated secret.**
     - The placement-preview signing secret is separate from `JWT_SECRET`, and is never derived from it or shared with it.
     - It is supplied through the existing dotenv environment configuration: the production `.env`, with a placeholder key in `.env.production.template`.
     - It uses the existing `jsonwebtoken` library. There is no separate authentication service and no token database.
  2. **Pinned algorithm, issuer, audience and token type, each in a stated location.**
     - **JOSE header:**
       - `alg` = `HS256`, and verification passes `algorithms: ['HS256']`.
       - `typ` = `season-placement-preview+jwt`. This is explicit typing in the RFC 8725 sense, set with the library's `header` sign option.
     - **Payload (registered claims):**
       - `iss` = the placement-specific issuer;
       - `aud` = the placement-specific audience;
       - `sub`, `iat` and `exp` as in items 3 and 5.
     - **Payload (private claim):** `purpose` = `season-placement-preview`.
       - The payload never uses the names `typ` or `type`. Existing authentication tokens carry a payload claim `type: 'access'|'refresh'` (`tokenService.generateToken`). Using a different name avoids ambiguity, and a placement token can never satisfy `tokenService.verifyToken`'s type check.
     - **Verification:**
       - It calls `jsonwebtoken.verify` with `algorithms`, `issuer`, `audience` and `maxAge`, and with `complete: true` so that the decoded header is available.
       - It then requires `header.typ === 'season-placement-preview+jwt'` **and** `payload.purpose === 'season-placement-preview'`, **as separate checks**.
       - The library does not check the header `typ` by itself, so the explicit header check is mandatory.
       - A missing or different value in either location is refused before any lock is taken.
  3. **Lifetime.** At most five minutes: `expiresIn: '5m'` on sign, and `maxAge: '5m'` with expiry enforced on verify.
  4. **Authorization, independent of the token.** The preview and confirm routes require the existing `requireAuth` + `authorize(['ADMIN'])`. Group membership is never read from the token.
  5. **Subject binding.** The token's `sub` is the authenticated user's id (`req.user.id`, the Cognito sub) at preview time. On confirm, `sub` must equal the current `req.user.id`.
  6. **Minimal payload.**
     - It holds only: `sub`, `show_id`, `arc_id`, `op` (`move` or `swap`), the affected slot ids and episode ids, `iat`/`exp`, and a SHA-256 digest of the canonical expected state.
     - It holds no event names, terms, deal values, intentions, scripts or other production content.
  7. **Two separate mandatory checks under lock.** On confirm, inside the transaction and after the required locks (episodes → events → slots, in id order), the server performs both of the following, using authoritative database state. **Passing one never substitutes for the other.**
     - **(a) Placement eligibility.** Every domain guard is evaluated afresh on current state:
       - freeze;
       - acceptance;
       - published or released state;
       - two-parter and special membership;
       - completed Part or season;
       - event-pencil conflicts and drift;
       - special release windows (C4/G1-D1);
       - liveness;
       - A9-r commitments.

       Failure returns the domain code.
     - **(b) Expected-state digest.** The canonical expected state (item 8) is recomputed from current state and compared with the token's digest. A mismatch returns `SEASON_PLACEMENT_STALE`.

     Eligibility is never inferred from a matching digest. A digest match only shows that state is unchanged since the preview; it does not show the placement is allowed.
  8. **Everything placement-relevant is in the expected state.** For both slots and both episodes:
     - slot occupancy, `locked_at` and `accepted_at`;
     - the slots' event pencils (`event_id`);
     - each episode's authoritative Event Package (`episodeEventIdSql`), plus that event's `status` and `used_in_episode_id`;
     - the release positions, and the effective release dates of every episode in the season (`computeDates` inputs: schedule, slot positions, hand `air_date`s);
     - the special release windows affected (C4/G1-D1);
     - freeze state (whether any `episode_raw_clips` row exists);
     - `evaluation_status` and published or released state;
     - two-parter and special membership;
     - the Part and season status;
     - the episodes' and slots' liveness (`deleted_at`);
     - the A9-r commitment signals relevant to the destination intention.
  9. **Logging.**
     - Token values, secret values and Event Package contents are never logged or written to `activity_logs`.
     - Errors log their code and ids only.
     - The audit entry holds ids, positions and event ids.
  10. **Fail closed, with a useful read-only preview.**
      - If the dedicated secret is missing or invalid (absent, too short, or failing the startup self-check), Move/Swap confirmations are disabled. The impact preview stays available.
      - **The dry-run still runs in full**, under the same ADMIN authorization and the same eligibility and conflict evaluation. It returns the complete read-only impact preview:
        - affected slots, episodes and Event Packages;
        - before/after pencils;
        - release positions and dates;
        - special windows;
        - A9-r commitments;
        - every conflict and refusal reason.
      - It **issues no confirmation token** and returns `confirm_available: false`, with the reason `SEASON_PLACEMENT_UNAVAILABLE`.
      - The Season page shows the preview read-only. **Confirm is disabled**, with a clear explanation that confirmations are temporarily unavailable because placement signing is not configured, and that the preview itself is accurate.
      - A confirm request returns `503 SEASON_PLACEMENT_UNAVAILABLE` and writes nothing.
      - **The process does not crash or refuse to start.** All unrelated application functionality, including authentication, is unaffected.
      - The check never logs the value.
  11. **Replay limitation preserved** (G1-E1 A, below). There is no server-side single-use guarantee.
  12. **No automatic retries.** Every failed confirmation invalidates the preview in the Season page, and a fresh impact preview is required (failure classes above).

  *Acknowledged limitation (G1-E1 A).* Without server-side token-use tracking, a previously failed but otherwise valid token may be replayed while the expected database state remains unchanged and the token has not expired. The server then validates it fully and may apply it. **The server cannot always distinguish a fresh preview from a replayed token.** That distinction is enforced by the Season page only. This is an acknowledged limitation, not server-side single-use enforcement.

  *Unaffected by any attempt, successful or failed:* the A1.2 freeze and every accepted production record.
- **Not covered by any constraint.** An episode that is in both `season_slots` and `season_specials` spans two tables. This stays an application check plus diagnostic P2.

**Status: unverified.** The constraint tests in §4.6 are proposed. None has been run, and running them on the isolated PostgreSQL 15 test database needs separate authorization. The A2 migration is not proposed for approval until they pass.

### 4.3 Readers to correct (GATE)

Several readers look up release numbers as if they were slot numbers:
- `fe/lib/releaseSchedule.js` `slotRow`;
- `seasonFullSpecials.loadPicture`;
- `releaseSchedule.suggestSpecialDate`;
- `buildView`'s two-parter labels.

All of them must read slot-keyed rows.

### 4.4 The Pulse (VERIFIED)

Posts key on `episode_number` and the stored `air_date` (`postRelease.airDateOf`, `storyClock.postOrder`). While dates and numbers are preserved, no `release_at` changes.

### 4.5 Reset

"Back to story order" lives only in the Release board, with a preview of the dates it changes.

---

### 4.6 Proposed constraint tests (inventory; none run; execution needs separate authorization)

The PostgreSQL ruling of 2026-11-10 names "K1–K16". Two tests were added later:
- **K17**, for deadlocks and lock timeouts, under the error-handling ruling;
- **K11-R**, a placement-service test documenting the G1-E1 replay limitation.

**Where they run.** Only on the isolated PostgreSQL 15 test database (the CI service or local `docker compose`). They reuse the existing test skip guard: the URL must contain `episode_metadata_test` and must not contain `amazonaws.com`.

- **Stage A** uses ordinary tables in a throwaway schema created and dropped by the test, with no migration. It is not a `TEMP` table, because the concurrency cases need two sessions.
- **Stage B** runs against the migrated `season_slots`, inside the A2 migration PR.

| ID | Stage | Checks | Expected (unverified until run) |
|---|---|---|---|
| K1 | A | The proposed CHECK and both exclusion rules can be created, and whether any extension is required | DDL succeeds; both rules deferrable and initially deferred; no extension needed. Any other outcome means the rule is redesigned |
| K2 | A | Seed 2 seasons × 24 slots, all `release_position` NULL | Succeeds |
| K3 | A | Swap two effective positions in one transaction | Commits; positions 1–24 form a permutation; the other season is untouched |
| K4 | A | K3 with the rule forced immediate | The first update fails `23P01`, showing deferral is required |
| K5 | A | Writing raw slot numbers after a prior swap | Commit fails `23P01`; prior state intact |
| K6 | A | A NULL-override collision | Commit fails `23P01` |
| K7 | A | The same effective position in different seasons | Allowed |
| K8 | A | A soft-deleted row sharing a position; then restoring it | Allowed while deleted; the restore's commit fails `23P01` |
| K9 | A | Position 0 or 25 | Immediate `23514` |
| K10 | A | Occupant swap; a live duplicate occupant; a soft-deleted duplicate | Swap commits; live duplicate fails `23P01`; soft-deleted allowed |
| K11 | A | Two sessions; the second confirms with stale expected state | Second update affects 0 rows, surfaced as `SEASON_PLACEMENT_STALE`; final state valid |
| K12 | A | Two sessions without the expected-state predicate | The constraint backstop fails the second commit `23P01`; final state valid |
| K13 | A | An error mid-transaction | Rollback; no row changed |
| K14 | A | Sequelize commit rejection with `23P01` | Mapped to `SEASON_PLACEMENT_INTEGRITY`; nothing written |
| K17 | A | Opposite lock order with a short `lock_timeout` | `40P01` or `55P03`, mapped to `SEASON_PLACEMENT_BUSY`; one attempt; no automatic retry |
| K15 | B | Migration up beside `season_slots_arc_slot_live`; existing season suites | Up succeeds; existing suites stay green |
| K16 | B | Migration down, then up again, on the test database | Both clean |
| K11-R | Placement service | Re-sending an unexpired token after `SEASON_PLACEMENT_BUSY` with unchanged state | Fully re-validated, then applied atomically or refused. Documents, and does not prevent, the replay limitation |

### 4.7 A deferred-constraint failure at COMMIT: what Sequelize does, and what Move/Swap must do (Evoni, 2026-11-10)

**Observed (Stage A tests, K14, on PostgreSQL 15, 16 and 17; `tests/integration/seasonReleasePositionConstraints.integration.test.js`, PR #3778).** When a deferred exclusion rule is violated, every statement in the transaction succeeds and PostgreSQL refuses the `COMMIT` itself with SQLSTATE `23P01`. Through Sequelize's managed transaction (`sequelize.transaction(async (t) => …)`):

- the promise rejects, and the SQLSTATE is on the error as `err.original.code` (also `err.parent.code`);
- nothing is written: PostgreSQL has rolled the transaction back;
- Sequelize logs a warning, "Committing transaction … failed with error … We are killing its connection as it is now in an undetermined state", and **discards that database connection**. The pool opens another when it needs one.

**The warning and the discarded connection are the expected consequence of a deferred-constraint failure. They are not a second fault,** and they are not to be silenced or worked around.

**Requirements for the future Move/Swap code** (not built; this section authorizes nothing):

1. **Handle the failure cleanly.** A commit rejection is caught at the placement service's boundary and becomes one refusal. Nothing is written, and there is no partial state to repair.
2. **Never reuse a failed transaction.** After any error inside the transaction, or a rejected commit, that transaction object and its connection are finished. No further statement is sent on it, and no retry is made inside it. A later attempt is a new request, with a fresh impact preview (§4.2, "No automatic retries").
3. **Preserve the original SQLSTATE.** The code reads `err.original.code` (falling back to `err.parent.code`, then `err.code`) and keeps it on the error it raises and in the `console.error` log line. `23P01` is never rewritten as a lock conflict: `episodeLocks.isLockConflict` is false for it (K14), so it is never offered as "try again".
4. **Return the right error to the person.** `23P01` at commit maps to 409 `SEASON_PLACEMENT_INTEGRITY`. The message says that nothing was changed and that a fresh preview is needed. It does not show the SQLSTATE, a constraint name or any row value. `40P01` and `55P03` map to 409 `SEASON_PLACEMENT_BUSY` (K17). A stale expected state, where a guarded update changes 0 rows, maps to 409 `SEASON_PLACEMENT_STALE` (K11).

**Test owed with the placement service:** one that provokes a commit-time `23P01` through the real service and asserts all four points. It also asserts that a subsequent request succeeds on a valid database connection from the pool. It checks the outcome only (the next request works and its transaction commits), not which physical connection served it: it must not depend on a backend process id or on a particular pool slot.

### 4.8 The A2 migration as built (Evoni, 2026-11-10: Step 3)

**Status.** §4.2's "unverified" note is superseded: the Stage A tests (K1–K14, K17) passed on PostgreSQL 15, 16 and 17 (PRs #3778, #3779), and the migration below was then written with the proposed rules unchanged.

**Migration** `src/migrations/20261110230000-add-season-slot-release-position.js`, one transaction:

| Step | SQL |
|---|---|
| Column | `ALTER TABLE season_slots ADD COLUMN release_position INTEGER` (nullable, no default) |
| `season_slots_release_position_range` | `CHECK (release_position IS NULL OR release_position BETWEEN 1 AND 24)` |
| `season_slots_effective_position_live` | `EXCLUDE USING btree (arc_id WITH =, (COALESCE(release_position, slot_number)) WITH =) WHERE (deleted_at IS NULL) DEFERRABLE INITIALLY DEFERRED` |
| `season_slots_episode_live` | `EXCLUDE USING btree (episode_id WITH =) WHERE (deleted_at IS NULL AND episode_id IS NOT NULL) DEFERRABLE INITIALLY DEFERRED` |

- It writes no `release_position` and changes no existing row.
- `up` refuses, changing nothing, when an episode is already in more than one live slot (a count is reported, never a row). Diagnostics `db-season-integrity` reads the same condition beforehand.
- `down` drops the three rules and the column. It refuses while any slot has a release position.
- Each step is skipped when already done.

**Readers (§4.3), as built.** `computeDates` keeps every output keyed by slot number and changes only the order in which release days are handed out (`COALESCE(release_position, slot_number)`, then slot number). So the four readers §4.3 lists already read slot-keyed rows and needed no change:

- `fe/lib/releaseSchedule.js` `slotRow`;
- `seasonFullSpecials.loadPicture`;
- `releaseSchedule.suggestSpecialDate`;
- `buildView`'s two-parter labels.

An episode in no slot keeps its stored slot number (`season_context`, else `episode_number` in the first season) as its story number, and takes that slot number's place in the release order.

**K15 and K16 (Stage B), as built.**

| ID | Where | What runs |
|---|---|---|
| K15 | `seasonReleasePosition.integration.test.js`, Tests job (PostgreSQL 15, the whole migration chain) | The migrated `season_slots` has the column and the three rules beside `season_slots_arc_slot_live`; the existing season suites stay green |
| K15, K16 | `seasonReleasePositionMigration.integration.test.js`, Tests job (15) and "A2 constraints (PostgreSQL 17)" job | On a scratch database: the real create-season-slots migration, then this migration up, down and up again. Rows are compared before and after each step. Both refusals are exercised |

PostgreSQL 17 coverage is narrow by ruling: the two migrations that define `season_slots` and its rules, not the whole chain.

**Not built here:** any writer of `release_position`, Move/Swap, the placement service and its error codes (§4.2, §4.7), the effective-position Diagnostics metric, and "Back to story order" (§4.5).

## 5. Rulings C4, C5, C7, C8 and G1-D1 to G1-D5 (RULED, verbatim)

> C4 — Specials: Preserve each special's story anchor. Block a placement change that would invalidate its release window. Do not automatically reschedule the special.
> G1-D1: Block newly introduced invalid special-release windows; report pre-existing invalid windows.

**Implementation note (VERIFIED/GATE).** A special's window is `before < date < next`. This is the `inside` rule of `suggestSpecialDate`, applied to the effective dates of slots `after_slot_number` and `after_slot_number + 1`. No validator for it exists today.

> C5 — Episode creation: Automatic empty-slot selection follows story order, not release order. Display the effective release date and relevant discrepancies.

**Implementation note (VERIFIED).** `assignOnStartIn` already orders the pencilled slot first, then the lowest `slot_number`. The display shown before Start is a prediction.

> C7 — AI intention provenance: Do not introduce a new "intention_source" value until all guard and consumer implications are resolved. Preserve existing semantics.

**Implementation note.** C7 governs the timing of the earlier refinement "Distinguish AI-accepted intentions through the existing source field, after checking its consumers" (connector line pending Evoni's approval).

> C8 — Stale planning inputs: Current slot planning is authoritative for new prompts. Preserve historical and frozen inputs. Flag stale unfilmed copies for explicit review; never silently regenerate content.
> G1-D2: Current slot planning drives new prompts for unfilmed episodes only. Preserve filmed snapshots.
> G1-D3: Preserve authoritative slot-to-brief synchronization for unfilmed episodes, but require explicit review when started production commitments would change.

**Implementation note.** G1-D3 changes an earlier build choice (§6.3). The commitment set is listed in §6.3.

> G1-D4: Prepare a new consolidated Season Planning specification from the approved conversation rulings. Do not represent it as a recovered historical document.
> G1-D5: Repair the existing audit-log mechanism under issue #1948 before enabling Move/Swap confirmations. Do not introduce a parallel audit system.

---

### 5.1 K-A and K-B (RULED, 2026-11-10, verbatim)

> K-A = Option A
> For slotted episodes, "narrative_purpose" belongs to authoritative season-slot planning. Episode Home displays it read-only, and the server enforces that ownership.
> Unslotted episodes retain independent editing.
> Preserve historical and filmed production values. Add an explicit, dated refinement to A1-e without rewriting the original ruling.

> K-B = Option A
> Preserve D-22's dedicated "episode_intent_audit" for its narrowly scoped future frozen-episode intent correction workflow.
> The existing "activity_logs", repaired under issue #1948, remains the authoritative general administrative audit trail, including Move/Swap.
> Do not create duplicate general-purpose audit infrastructure. Do not implement or migrate D-22.

> Event-pencil conflicts: Before a Move/Swap, inspect both affected slots' pencilled events and the episodes' authoritative Event Packages. Show the before-and-after relationships in the impact preview. Do not silently overwrite, discard or reassign an unrelated pencilled event. Block unresolved conflicts. Preserve the episode's primary Event Package, accepted terms, deliverables and offer decisions. Reuse the existing event and slot ownership systems.

> K-A1 ruling: Special episodes do not count as slotted for narrative-purpose ownership. Weekly season-slot episodes use the authoritative slot purpose. Specials and unslotted episodes retain brief-owned narrative purpose. Existing freeze and production protections remain applicable.

> Narrative-purpose synchronization: Do not infer that a stored brief value is safe to overwrite merely because it resembles current planning. Only synchronize when the existing provenance or previous authoritative value can be established reliably. Otherwise preserve the brief and display the discrepancy for review. Never overwrite locked briefs or filmed production history.

> PostgreSQL verification: Keep K1–K16 as proposed tests, but treat constraint feasibility as unproven until isolated PostgreSQL 15 testing. Distinguish: stale-state conflicts; exclusion violations; deadlocks and lock timeouts; retryable failures versus conflicts requiring a fresh preview. Do not automatically retry an invalid placement.

> Error handling: For "SEASON_PLACEMENT_BUSY", a deadlock or lock timeout must invalidate the current confirmation attempt. The user must obtain a fresh impact preview before confirming again. Apply this same fresh-preview requirement after stale-state errors, integrity failures once repaired, and domain validation conflicts once resolved. Do not automatically retry Move/Swap confirmations. Preserve the existing A1.2 freeze and all accepted production records.

> G1-E1 = Option A, with explicit enforcement boundaries. Use the existing Season page and placement validation architecture. Do not introduce server-side token-use storage or a separate confirmation system. Every failed Move/Swap confirmation invalidates the current preview in the Season page. Confirm remains disabled until a fresh impact preview is successfully generated. The server must validate the signed confirmation token, expiration, ADMIN authorization, expected placement state, event pencils, release positions and applicable production restrictions under the required locks. No automatic confirmation retry is permitted. All placement changes and their audit entry must be atomic. Any failure rolls back the entire transaction. Enforcement limitation: Without server-side token-use tracking, a previously failed but otherwise valid token may be replayed while the expected database state remains unchanged. This is an acknowledged limitation of G1-E1 A, not a guarantee of server-side single-use enforcement. Do not claim that the server can always distinguish a fresh preview from a replayed token. Preserve the A1.2 freeze and all accepted production records.

> Token Signing Decision: Outcome B — Dedicated signing secret. Use the existing jsonwebtoken library and environment configuration infrastructure. Do not introduce a separate authentication service or token database. Requirements: 1. Use a dedicated placement-preview signing secret, separate from JWT_SECRET. 2. Pin the signing algorithm, issuer, audience and token purpose/type. 3. Enforce a maximum five-minute token lifetime. 4. Require the existing authenticated ADMIN authorization independently of the preview token. 5. Bind the token subject to the authenticated user. 6. Include only necessary identifiers, operation details and a digest of the expected state. 7. Recompute and validate authoritative expected state under transaction locks. 8. Include all placement-relevant state and dependencies in the expected-state validation. 9. Never log token values, secret values or sensitive Event Package contents. 10. Fail closed when the dedicated secret is missing or invalid: disable Move/Swap confirmations without disrupting unrelated application functionality. 11. Preserve G1-E1 Option A's acknowledged replay limitation. No server-side single-use guarantee. 12. No automatic confirmation retries; every failed confirmation requires a fresh impact preview in the Season page.

> Final token wording: Clarify that when the dedicated signing secret is unavailable, the Season page continues to provide a useful, read-only Move/Swap impact preview, including affected records and conflicts, but issues no confirmation token and disables Confirm with a clear explanation. Clarify that server-side placement eligibility checks and canonical expected-state digest verification are separate mandatory checks, both performed using authoritative state under the required locks. Specify the exact JWT header/payload location for the placement token type and require verification of that location. Do not rely on an ambiguous "typ" check.

> A1.2 baseline: The recovered A1.2-SPEC-v5 specification has been confirmed as the authoritative historical baseline.

**Quotation format.** The rulings above are Evoni's words, unchanged. Where her messages used bulleted or numbered lists or line breaks (event-pencil, K-A1, synchronization, PostgreSQL, error handling, G1-E1, token signing, final token wording), the items appear joined into running text in their original order. No words are added or removed.

## 6. Additive rulings

A7-x and A9-r are recorded in `docs/EVENT_EPISODE_FLOW.md` §8(ff). A1.2 Amendment 1, the A1-e refinement and the D-22 clarification are in `docs/design/2026-11-a1-2-spec-v5-amendments.md`. None of them edits historical wording, and A1.2-SPEC-v5 is kept byte-identical.

### 6.1 Protection of committed work under A9-r (PENDING)

| Commitment signal (VERIFIED) | What an intention save on the started, unfilmed slot does |
|---|---|
| Locked brief: `episode_briefs.status = 'locked'`, set by `POST /episode-brief/:id/lock`. The brief editor refuses edits ("Brief is locked. Unlock before editing."). | **Prohibited.** The brief fields are not written, and no confirm overrides this. The slot itself still saves, and the response names the skipped brief. |
| Approved script beats (`episodes.script_locked_beats`) | **409 and confirm.** The review shows the intent, outcome and purpose changes. Approved beats stay word for word. |
| Approved or locked script (`episode_scripts.status` `approved`/`locked`; a locked script refuses edits) | **409 and confirm.** The script itself is never changed. |
| Locked beat-plan beat (`scene_plans.locked`; regenerating it is refused with `BEAT_LOCKED`) | **409 and confirm.** Plan rows are never changed. |
| Filmed episode (any `episode_raw_clips` row) | **Unchanged (A1.2).** The snapshot is skipped, and the brief intent fields are freeze-guarded. |

**Episode Home disclosure (PENDING).** For a slotted episode, Episode Home shows the current slot planning (read-only, with a link to the slot) next to the preserved production records: the working or filmed `season_context`, the brief copies, and any locked brief, approved beats, locked script or locked plan beats. It marks every difference. The comparison is made when the page is displayed and nothing is stored, so there is no new record.

---

## 7. Rollout and deferred cases

**Rollout 1 (GATE: migration, #1948, diagnostics).** Covers episodes that are started, unfilmed, unaccepted, unpublished and unreleased, in the active season. Not two-parters, specials, or slots in completed parts. ADMIN only.

**Rollout 2 (GATE: freeze amendment).** Filmed episodes under the same restrictions. The snapshot is kept (`frozenSkip`).

**Deferred until a further ruling:**
- accepted episodes and slots (outcome columns and phase progression);
- published or released episodes (§1's "enhanced impact review");
- two-parters and specials;
- moves between seasons: **deferred, not permanently prohibited**. Moves across Parts within a season are in the initial scope (R-7).
- non-current (not completed) season write protection, to be investigated separately (RULED refinement).

**Approved but not yet built:** R-4 (special-date editor), R-5 (review for date-changing actions), R-11 (canonical non-event creation), R-3 (read-only Episode Home), R-9 (ADMIN endpoints). These are pending implementation. They are not open questions.

---

## 8. Outstanding gates

Each gate is approved separately.

1. **Documentation.** §8(ii), A7-x and A9-r in `docs/EVENT_EPISODE_FLOW.md`; this file; the byte-identical A1.2-SPEC-v5 (confirmed by Evoni on 2026-11-10 as the authoritative historical baseline) and its separate amendments file.
2. **Diagnostics PR.** P1–P10, code review only.
3. **Production execution.** SSM version registration and one dispatch (P1, P2, P3 and P6 must be 0).
4. **Audit-log repair (#1948, Option C).** Code PR, then a separately authorized production schema change.
5. **A2 migration.** Constraint tests K1–K17 (§4.6) pass on isolated PostgreSQL 15, then a separately authorized migration.
6. **Enabling Move/Swap confirmations.** Only after gates 4 and 5, and the placement PRs.

---

## 9. Audit log: Option C target architecture (code as built in §9.1; the production migration needs separate authorization)

- **One authoritative writer.** `ActivityLog.logActivity({ userId, actionType, resourceType, resourceId, changes }, { transaction })`.
- **One table.** The existing `activity_logs`, in production's shape: `user_id`, `action`, `resource_type`, `resource_id`, `changes` (JSONB), `created_at`. `resource_id` is widened to varchar so it can hold UUIDs.
- **Atomic with Move/Swap.** A Move or Swap writes its entry inside its own transaction, so an audit failure rolls the operation back.
- **No page-view logging, no IP addresses or user agents, no duplicate general-purpose audit table.** Existing rows are preserved.
- **Scope (K-B, RULED).** `activity_logs` is the authoritative *general* administrative audit trail, including Move/Swap. D-22's dedicated `episode_intent_audit` (A1.2-SPEC-v5) is kept for its own narrowly scoped future workflow: audited intent corrections on frozen episodes. It is not implemented or migrated here.
- **The production schema change (rename and widen) is authorized separately.**

---

### 9.1 The audit log as built (issue #1948; Evoni, 2026-11-11: Step 5)

**The defect.** Nothing had ever been written to `activity_logs`. Production, the model and migration `20240101000005` described three different tables, `resource_id` was an integer, and each of the three loggers hid the failed insert.

**Migration `20261111230000-converge-activity-logs`** (one transaction, guarded) brings every starting shape to one:

| Column | Type |
|---|---|
| `id` | integer, serial primary key |
| `user_id` | varchar(255), nullable (nobody signed in is NULL) |
| `action` | varchar(100), nullable |
| `resource_type` | varchar(100), nullable |
| `resource_id` | varchar(255), nullable |
| `changes` | jsonb, nullable |
| `created_at` | timestamp without time zone, default `now()` |

plus the index `activity_logs_resource (resource_type, resource_id)`.

- **On production and the dev box** it changes two things: `resource_id` integer to varchar(255), and the index.
- **On CI and fresh databases** it also renames the camelCase columns, replaces the two enums with varchar, folds old and new values into `changes`, and drops the IP-address and user-agent columns.
- **Rows are kept from every shape.** Only IP-address and user-agent values are dropped, by ruling; production never had them.
- **`down` refuses once any row exists.** A UUID cannot go back into an integer column, and audit history is not deleted to make a rollback possible. After the first entry there is no rollback of this migration.

**One writer.** `ActivityLog.logActivity({ userId, action, resourceType, resourceId, changes }, { transaction })`.
- It throws when the entry cannot be written.
- With a transaction, the entry commits or rolls back with the caller's work.
- It refuses a `view`. Placeholder user ids (`anonymous`, `unknown`) are stored as NULL.

**`changes`.** `{ before?, after?, meta? }`: the old values, the new values, and anything else the caller passed. Empty is NULL.

**One call per operation.** The controllers call `logger.logAction` (in `middleware/auditLog.js`), which calls the one writer. It never fails the request: a failed entry is logged as `[audit] NOT RECORDED` and the request goes on.

| Controller | Audited operations |
|---|---|
| `episodeController` | create, update, delete, enqueue |
| `metadataController` | create, update, delete, add tags, set scenes |
| `processingController` | create, update, retry, cancel |
| `fileController` | upload, download, delete |
| `jobController` | create, retry, cancel |

- **Removed duplicates.** Episode create, update and delete each also called `ActivityService.logActivity` and `AuditLogger.log`; those calls are gone. `services/AuditLogger.js` is deleted.
- **Removed page views.** No list or read handler writes an entry.
- **Removed:** the unmounted request-logging middleware `auditLog`.

**Readers.** `GET /api/v1/audit-logs` (ADMIN; the page at `/admin/audit`) and `ActivityIndexService` read the real columns.

**Not changed.** `/api/v1/activity` (`activityController`) was already broken: it calls `ActivityService` methods that do not exist. Nothing in the frontend calls it. `ActivityService` itself only keeps entries in memory and is no longer called by any audited operation.

**For Move/Swap (not built).** It calls `ActivityLog.logActivity` itself, inside its transaction, so a failed entry rolls the placement back. `tests/unit/guards/auditSingleWriter.test.js` lists the callers of the writer; the Move/Swap caller is added there with its own approval. No existing Season Planning action writes an entry.

---

## 10. Event-pencil safeguard for Move/Swap (PENDING)

**Principles (RULED, 2026-11-10).**
- An **occupied** slot's event is derived from its episode's authoritative Event Package.
- An **empty** slot's pencilled event is an independent planning commitment.
- Move/Swap must not overwrite, discard or silently reassign an unrelated pencil.
- Unresolved conflicts block confirmation.

**Existing Place defect (VERIFIED; tracked separately).** `placeEpisodeIn` overwrites the target slot's `event_id` with the episode's own event, or with NULL for an eventless episode. It does no check and makes no report (`seasonSlotService.placeEpisodeIn`). Move/Swap must not repeat this. Repairing Place is a separately tracked fix that needs its own authorization. It is not part of Move/Swap.

**Existing behaviour that already respects pencils (VERIFIED).** At Start, `assignOnStartIn` takes a slot only where `event_id` is the starting event or NULL, so it never takes another event's pencil. `pencilEventIn` replaces a pencil only on the user's explicit pencil action, and returns `replaced_event_id`.

**Before any Move/Swap, under lock, for each affected slot and episode, read:**
- the slot's `event_id` (its pencil);
- the episode's authoritative event (`episodeEventIdSql`: brief first, then the stamp);
- that event's `status` and `used_in_episode_id`.

**Impact preview.** It shows these before and after, per slot.

**Allowed** (the slot's event follows its episode, using the existing derived-copy rule):
- the slot's event already equals its episode's event;
- the destination is empty with no pencil;
- in a Swap, each slot's event is its own episode's event.

**Blocked until resolved** (409 plus a description; nothing written):
- the destination holds a pencilled event that is not the moving episode's own event. That covers an unstarted event, and an eventless moving episode facing a pencil;
- any slot's `event_id` disagrees with its occupant's authoritative event (data drift, diagnostic P4);
- the moving episode's event is pencilled in a third slot (drift).

**Resolution** uses only the existing tools:
- re-pencil or clear the unrelated event with the existing pencil action (`PUT …/slots/:slotId/event`, `pencilEventIn`);
- repair the drift through the existing placement or ownership flows.

The Move/Swap then needs a fresh preview. It never retries automatically.

**Never touched:** `episode_briefs.event_id`, `world_events.used_in_episode_id`, locked terms, the price snapshot, deliverables, offer decisions and opportunities.

---

## 11. Proposed confirmation-token tests (not run; executing them needs separate authorization)

| ID | Area | Expected |
|---|---|---|
| T-K-1 | Missing secret | With the dedicated key absent: the app starts and authentication works. The dry-run returns the **full** read-only preview (affected records, before/after pencils, positions and dates, conflicts and reasons) with `confirm_available: false` and no token. The Season page shows it with Confirm disabled and the explanation. Confirm returns `503 SEASON_PLACEMENT_UNAVAILABLE` with nothing written. The log names the condition, not any value. |
| T-K-2 | Invalid secret | A key that is too short or fails the self-check behaves exactly as T-K-1. |
| T-K-3 | Secret separation | A static check that the placement signer and verifier never read `JWT_SECRET`, and that `tokenService` and `SocketService` never read the placement key. |
| T-X-1 | Cross-rejection | An authentication token (HS256, `JWT_SECRET`) presented as a preview token is refused (signature, audience, `typ`). |
| T-X-2 | Cross-rejection | A preview token presented to `requireAuth` / `optionalAuth` / `tokenService.verifyToken` is refused. |
| T-A-1 | Authorization | A non-ADMIN authenticated user is refused at preview and at confirm, whatever the token contains. |
| T-A-2 | Subject binding | A valid token confirmed by a different ADMIN (`sub` ≠ `req.user.id`) is refused. |
| T-E-1 | Expiration | A token older than five minutes is refused. A token whose `exp` is more than five minutes after `iat` is refused (`maxAge`). |
| T-C-1 | Claims | Each of these is refused before any lock is taken, each as its own case: a wrong `alg` (including `none`) in the header; a missing or wrong **header** `typ`; a missing or wrong **payload** `purpose`; a payload carrying `typ`/`type` in place of `purpose`; a wrong `iss` or `aud`. |
| T-V-1 | Separate checks | (i) Digest matches, but eligibility now fails (for example, an episode's scheduled release time passes between preview and confirm, so it becomes released by time while every stored digest input is unchanged): refused with the domain code. (ii) Eligibility passes, but the digest differs: `SEASON_PLACEMENT_STALE`. Neither check is skipped when the other passes. |
| T-S-1 | State mismatch | A change after the preview to any expected-state element in item 8 (occupant, pencil, Event Package, release position or date, freeze, acceptance, published state, two-parter, special window, Part/season status, liveness, A9-r signal) produces `SEASON_PLACEMENT_STALE`, with nothing written. |
| T-R-1 | Rollback | A failure injected after the slot writes (audit write, a `23P01` at commit, a verification-assertion failure) rolls back everything: slots, positions and the audit entry. `season_context`, the brief and accepted records stay byte-identical. |
| T-R-2 | No retry | Each failure produces exactly one transaction attempt, and the Season page disables Confirm until a fresh preview (T-UI-1/2). |
| T-L-1 | Logging | No log line or audit entry contains a token, a secret value, event names, terms or deal values. |
| T-UI-1 | Season page | After each failure class (validation, stale, busy, integrity, audit), the preview is discarded and Confirm is disabled. Confirm is re-enabled only by a successful new dry-run. A failed dry-run keeps it disabled. |
| T-UI-2 | Season page | Exactly one confirm request per user action, and no automatic re-send after a failure. |
| T-P-1 | Replay limitation (documents it, does not prevent it) | Re-sending an unexpired token after a BUSY failure with unchanged state is fully re-validated and either applied atomically or refused. This is the acknowledged G1-E1 A behaviour. |

## 12. Separate security findings (for an independently approved review; not changed under Gate 1)

1. **Dormant `SocketService` JWT verification.** `SocketService.authenticateConnection` calls `jwt.verify(token, JWT_SECRET)` without `algorithms`, issuer, audience or type checks (`src/services/SocketService.js:108-125`). It is wired only by `SocketService.initialize()`, which nothing calls today. If it were ever initialized, any `JWT_SECRET`-signed token would authenticate a socket.
2. **Live Socket.io authorization.** The server started at `src/server.js:184-190` (`src/sockets/index.js`) shows no authentication or authorization step: a grep for auth, token, verify and `use(` matched nothing. Whether its events need authorization should be reviewed.

Neither socket implementation is modified under Gate 1.
