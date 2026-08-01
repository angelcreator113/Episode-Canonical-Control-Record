# F-Stats-1 Fix Plan v1.7

## What changed in v1.7

- **§12.28 (new):** `world_events` soft-delete visibility defect — a live,
  user-facing correctness bug at two unfiltered read sites
- **Decision #15:** E1 and C17 leave the conversion track entirely and
  become §12.28's to own. PR 2's conversion scope narrows to C1, C7, C9.
- **§12.26 correction:** `world_events.deleted_at` and
  `career_goals.deleted_at` are **not** a symmetric pair. Different
  migrations, different dates, opposite postures.
- **§13 (new cut):** PR 2 scope, 3 units, anchors derived live at
  `96ab0a97`
- **§11:** v1.7 row added
- Basis: `96ab0a97`. Mints no FD, per established F-Stats-1 practice
  through v1.1–v1.6.

---

## §12.26 — CORRECTION

v1.5 §12.26 described `career_goals.deleted_at` as "the direct twin of
§12.24's `world_events.deleted_at`, added by the same migration on the same
date." **Both halves of that are wrong.**

| Column | Migration | Date | Model posture |
|---|---|---|---|
| `world_events.deleted_at` | `20260709000000-enrich-locations-and-events.js:116` | 2026-07-09 | `WorldEvent` is **`paranoid: true`**, declares `deletedAt: 'deleted_at'` |
| `career_goals.deleted_at` | `20260719000000-career-pipeline-links.js:44` | 2026-07-19 | `CareerGoal` is **`paranoid: false`**, declares no `deleted_at` |

Ten days apart, different migrations, and — decisively — **opposite
postures**. They are not one decision. They are two unrelated situations
that happened to surface in the same audit pass.

§12.27's live verification is unaffected: the 2026-07-21 deploy reported
the schema already up to date, which covers every migration merged before
it, including both. Only the attribution was wrong.

### What each case actually is

**`career_goals.deleted_at` — inert.** A repository-wide grep finds no
reader and no writer. Nothing sets it, nothing filters on it. The column
exists and does nothing. §12.26's original reasoning holds here: the model
does not declare what the schema carries, and the consequence is the
undeclared-column omission of §12.25(a). That is C7's and C9's blocker and
remains PR 2's to resolve.

**`world_events.deleted_at` — load-bearing, and the model is right.**
`WorldEvent` is already `paranoid: true`. Every ORM read hides
soft-deleted rows automatically; the raw SQL across the codebase filters
`deleted_at IS NULL` at eight or more sites. The model is not out of sync
with the schema. **Two raw queries are out of sync with everything else.**
See §12.28.

---

## §12.28 — `world_events` soft-delete visibility defect (NEW)

**This is a live, user-facing correctness bug.** It is not a conversion
hazard, not a shape mismatch, and not a documentation nit. It is recorded
here because F-Stats-1's audit surfaced it; F-Stats-1 does not fix it.

### The chain

1. `src/routes/worldEvents.js:556–573` — `DELETE /world/:showId/events/:eventId`
   soft-deletes:
   ```
   UPDATE world_events SET deleted_at = NOW() WHERE id = :eventId AND show_id = :showId
   ```
   **`status` is not touched.** A deleted event retains
   `status = 'draft'` or `'ready'`.
2. `src/routes/careerGoals.js:593` (C17) reads:
   ```
   SELECT * FROM world_events WHERE show_id = :showId AND status IN ('draft', 'ready')
     AND (career_tier IS NULL OR career_tier <= :careerTier) ORDER BY prestige ASC
   ```
   **No `deleted_at` filter.**
3. Therefore: **a deleted world event continues to appear in career-goal
   event suggestions.**

`src/routes/episodes.js:931` (E1) is the same defect:

```
SELECT * FROM world_events WHERE used_in_episode_id = :episodeId LIMIT 1
```

No filter. A soft-deleted event linked to an episode still drives
`generate-beats` script-skeleton generation.

### Why these two are outliers, not the norm

Every other `world_events` read in the codebase excludes deleted rows,
either automatically (ORM reads, via `paranoid: true`) or explicitly.
Non-exhaustive list of raw sites that filter correctly:

`worldEvents.js:2298`, `worldEvents.js:3765`, `worldEvents.js:3857`,
`feedEventPipelineService.js:360`, `feedEventPipelineService.js:587`,
`feedEventPipelineService.js:709`, `feedEventPipelineService.js:720`,
`feedEventPipelineService.js:734`, `scenePlannerService.js:106`.

E1 and C17 are the only unfiltered reads found.

### Two adjacent findings, same area, not resolved here

**(a) Dual delete semantics.** `worldEvents.js:568–572` falls back to a
hard `DELETE FROM world_events` if the soft-delete `UPDATE` throws. One
endpoint, two irreconcilable semantics, selected by whether a statement
happens to fail. Recorded; not analyzed.

**(b) Two stale comments assert a false fact.**
`src/services/invitationGeneratorService.js:301` and
`src/services/todoListService.js:439` both carry a comment stating that
`world_events` has no `deleted_at` column. That has been untrue since
2026-07-09. If those comments are the reason those call sites omit a
filter, the defect's surface is larger than the two sites named above.
**Not verified.** A future owner should re-derive the full unfiltered-read
set rather than trusting this section's list.

### Why F-Stats-1 does not fix it

F-Stats-1's mandate is mechanical raw-SQL → ORM consolidation under a
response-identical invariant. Converting E1 or C17 to `WorldEvent.findOne`
/ `findAll` would silently **change the row set** — `paranoid: true` adds
`deleted_at IS NULL` automatically — thereby fixing this bug as an
undisclosed side effect of a PR that claims to change nothing.

This is exactly the shape Decision #12 refused for the `'lala'` drift: a
correctness fix riding inside a mechanical conversion, where the register
loses track of who owns the fix and the "mechanical" PR quietly changes
behavior. The same refusal applies.

**Ownership is unassigned.** No existing keystone covers soft-delete
consistency. Assigning it is owed at a future register revision. Until
then §12.28 is the record.

---

## §9 Decisions Locked (Decision #15 ADDED)

Decisions #1–#14 unchanged.

### Decision #15 — E1 and C17 leave the conversion track

E1 and C17 are **removed from F-Stats-1's conversion inventory entirely.**
They are not deferred to PR 2, PR 3, or any later F-Stats-1 PR. They
become §12.28's, to be resolved by whoever takes ownership of soft-delete
consistency.

Rationale: converting either one is not a conversion. It is a row-set
change — a bug fix — and F-Stats-1 has no mandate to make it. Leaving them
as raw SQL preserves current behavior, which is the correct posture for a
plan whose invariant is response-identity, even though the preserved
behavior is defective. **The defect is recorded, not fixed, and not
hidden.**

Consequence for arithmetic: v1.3 §13's original 19 units for these two
files resolve as 14 converted (PR 1) + 3 remaining (PR 2) + 2 withdrawn
(§12.28). The withdrawn pair are no longer counted as F-Stats-1 units.

**Locked: 2026-08-01.**

---

## §13 PR 2 Conversion Inventory (NEW — derived live at `96ab0a97`)

**PR 2 scope: 3 units / 3 conversions.** All in
`src/routes/careerGoals.js`. All blocked on one shared decision.

| # | Line | Flow | Statement | Blocker |
|---|---|---|---|---|
| C1 | 46 | List | Dynamic string-built SELECT + replacements | §12.25(a)(b)(c) + conditional sort + error-message coupling |
| C7 | 408 | Create | Re-SELECT created row | §12.25(a)(b) |
| C9 | 460 | Update | Re-SELECT updated row | §12.25(a) |

Anchors derived live, not carried: C1 unmoved at 46 (it precedes every
PR 1 conversion); C7 moved 426 → 408; C9 moved 483 → 460. PR 1's net
−32 lines in this file accounts for the shift.

### The decision PR 2 must make first

All three units return `career_goals` rows into response bodies. All three
are blocked by the same thing: **`career_goals.deleted_at` exists and
`CareerGoal` does not declare it**, so any ORM finder silently drops that
key from the payload (§12.25(a)).

Three postures, mutually exclusive, to be decided at PR 2 execution:

1. **Declare `deleted_at`, stay `paranoid: false`.** The key returns to
   the payload; no row-set change. Smallest behavioral delta. Requires a
   model change, which v1.4 excluded from PR 1 scope but PR 2 may permit.
2. **Declare `deleted_at`, go `paranoid: true`.** Matches `WorldEvent`'s
   posture. **Changes the row set** — but since nothing writes
   `career_goals.deleted_at`, every row currently has it `NULL` and the
   filter is a no-op today. Latent, not immediate, behavior change.
3. **Project keys explicitly** at each of the three sites, leaving the
   model untouched. No model change, no row-set change, but three
   hand-maintained key lists that will drift.

Not decided here. PR 2 owns it, and it must be decided **before** any of
the three conversions is written — the choice determines what the
conversions look like.

C1 additionally carries the two blockers recorded in v1.5 §12.25: the
`ORDER BY CASE type WHEN 'primary' …` conditional sort expression, which
Sequelize can express only via `sequelize.literal()`, and the catch clause
that inspects `error.message` for `'career_goals'` to return a graceful
`200`. Both need their own dispositions.

### Behavioral invariant

Unchanged. PR 2 is response-identical **with respect to whatever posture
it selects.** If posture 2 is chosen, the latent row-set change is a
disclosed consequence of a locked decision, not a defect.

---

## Open items carried

1. `episodeCompletionService` transaction posture (§12.13 residue) —
   carried, unchanged.
2. `character_state` unique-constraint status — carried since v1.1; owner
   F-Sec-3, verify-only here.
3. PR 3–4 inventories (wardrobe, evaluation, worldEvents) — re-derive at
   execution time. **No longer carries E1/C17** (Decision #15). Note that
   the `worldEvents` inventory will collide with §12.28's surface; whoever
   cuts it should read §12.28 first.
4. ~~`world_events.deleted_at` live-schema state~~ — CLOSED at v1.6.
5. ~~`career_goals.deleted_at` live-schema state~~ — CLOSED at v1.6.
6. Test coverage over PR 1's converted handlers — **still unknown.**
   Refined evidence: `Validate/Tests` elapsed 1m47s (#957, doc-only),
   1m58s (#955, doc-only), 2m6s (#956, 14 conversions). Doc-only runs
   alone span 11 seconds, so the code PR's 8-second excess sits inside
   normal variance. Slightly more consistent with no meaningful coverage
   than with fast coverage. **Not conclusive either way.** Unresolved.
7. `character_state` ten-column assumption (v1.5 §13) — shipped at C5 and
   C11, PE #62 residue unchanged, unverified.
8. **NEW:** §12.28 ownership unassigned. No keystone covers soft-delete
   consistency. Owed at a future register revision.
9. **NEW:** §12.28(b)'s stale comments may indicate additional unfiltered
   `world_events` reads. The unfiltered-read set in §12.28 is **not
   exhaustive** and should be re-derived by its eventual owner.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-14 | Initial plan. Committed at `a278a69`. |
| v1.1 | 2026-05-14 | Path 1 confirmed; §12.1–§12.18 populated. Committed at `dbd32f13`. |
| v1.2 | 2026-05-14 | §12.19 (deploy incident); Decision #8. |
| v1.3 | 2026-07-22 | Decisions #10–#12; §12.21–§12.23; §13 PR 1 inventory (19 units); `30f10fe7` provenance correction. |
| v1.4 | 2026-07-24 | §13 re-cut 17/16; §12.24; Decision #13 (E1/C17 → PR 2). Basis `544cb9ad`. |
| v1.5 | 2026-08-01 | Decision #14 (C1/C7/C9 → PR 2); §12.25 response-shape hazard class; §12.26; §13 re-cut 14/14. Basis `a61d4913`. |
| v1.6 | 2026-08-01 | §12.27 `deleted_at` live-schema verification; open items 4, 5 CLOSED; §13 provenance correction. Basis `4bfc3115`. |
| v1.7 | 2026-08-01 | §12.28 `world_events` soft-delete visibility defect; Decision #15 (E1/C17 withdrawn from F-Stats-1); §12.26 twin-pair correction; §13 PR 2 inventory, 3 units, anchors live. Basis `96ab0a97`. |

v1.7 supersedes v1.6 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.6.
- Mints: §12.28, Decision #15, §13 PR 2 inventory, open items 8 and 9.
- Corrects: §12.26's twin-pair claim.
- No live-database contact. No prod-box contact. No dev-box contact. All
  conclusions derive from committed files read via `git show origin/main:`.
- FD-21 check: PR references historical; no closing keywords adjacent to
  `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.7 is the plan-of-record. **PR 2 is unblocked but must open with a
decision, not a conversion**: the `career_goals.deleted_at` posture
question in §13 determines what all three conversions look like, and it
must be locked before any of them is written. Inventory is 3 units, anchors
derived live at `96ab0a97` and to be re-derived if `main` moves first.

E1 and C17 have left F-Stats-1. §12.28 records a live user-facing defect
with no owner; assigning it is owed. After F-Stats-1 closes: the fix-cycle
continues per the locked register order, F-Ward-1 next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-01. Main at `96ab0a97` (#957), which is also v1.6's squash. Predecessor: v1.6.*
*Minted: §12.28, Decision #15, §13 PR 2 inventory, open items 8, 9. Corrected: §12.26. No FD numbers. [skip-automerge]*
