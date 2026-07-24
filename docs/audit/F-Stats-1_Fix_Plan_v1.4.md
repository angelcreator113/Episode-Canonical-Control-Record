# F-Stats-1 Fix Plan v1.4
**CharacterState Sequelize Model Creation + Raw-SQL Consolidation — Prime Studios audit canon**

| | |
|---|---|
| **Version** | 1.4 |
| **Date** | 2026-07-24 |
| **Author** | Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni |
| **Supersedes** | v1.3 (plan-of-record 2026-07-22) |
| **Predecessor keystone** | F-Deploy-1 (KEYSTONE CLOSED 2026-07-22, Fix Plan v1.48, #947) |
| **Gate status** | Decision #9 gate SATISFIED (Decision #10, unchanged) — Phase B G2 executable |
| **Basis** | Derived live at main 544cb9ad (#949), 2026-07-24, this session |
| **Register effect** | Mints no FD. Adds §12.24, Decision #13. Revises §13, §11. Forward-pointer to PE #62; claims no ownership. |

---

## What changed in v1.4

v1.3's substantive content carries forward except as revised below.

- **§13 re-cut:** PR 1 scope reduced from 19 inventory units / 18 conversions
  to **17 inventory units / 16 conversions**. E1 and C17 — the two WorldEvent
  units — deferred to PR 2.
- **§12.24 (new):** WorldEvent soft-delete + attribute-declaration delta blocks
  verbatim conversion of E1 and C17.
- **Decision #13 (new):** E1/C17 deferral, with the paranoid posture named as an
  explicit PR 2 decision rather than a PR 1 side effect.
- **§11:** v1.4 row added.
- **Line-anchor correction:** v1.3 §13 cites C17 at line 624. Confirmed live at
  origin/main this session: the statement is at **line 625**, single match in
  file. v1.3's number was off by one; v1.4 normalizes to 625.
- **Path precision:** v1.3 §13 cites `careerGoals.js` / `episodes.js` / model
  paths bare. Canon paths are `src/routes/` and `src/models/`. There is no
  `models/` at repo root; a `git ls-tree origin/main models/` call returns empty
  and no-ops silently. Noted so a future session does not read that empty result
  as model absence.

---

## §9 Decisions Locked (Decision #13 ADDED)

Decisions #1–#12 unchanged. Decision #12's four verbatim-convert `'lala'` sites
are **E2, C5, C11, C16** — all four survive the split and remain in PR 1.

### Decision #13 — E1 and C17 deferred to PR 2; paranoid posture is PR 2's to decide

PR 1's contract is response-identical (§13 behavioral invariant). The two
WorldEvent units cannot satisfy it as specified in v1.3 §13, per §12.24.
Converting them inside PR 1 would change the row set silently and in a way the
call sites' swallowing `catch` blocks would conceal.

E1 and C17 move to PR 2, whose inventory §13 open item 4 already schedules for
live re-derivation against the worldEvents surface.

**PR 2 must decide on the record** whether to pass `paranoid: false` on these two
calls to preserve raw behavior, or to accept the soft-delete filter as a
deliberate behavior change with its own justification. Either is defensible. The
defect would be PR 1 making that choice by accident.

**Locked: 2026-07-24.**

---

## §12.24 — WorldEvent soft-delete + attribute-declaration delta (NEW)

Two independent mechanisms break the §13 behavioral invariant for E1
(`src/routes/episodes.js:931`) and C17 (`src/routes/careerGoals.js:625`). Both
sites are raw `SELECT * FROM world_events`.

**(a) Soft-delete row-set delta.** `src/models/WorldEvent.js:249` declares
`paranoid: true` with `deletedAt: 'deleted_at'`. Neither raw query carries a
`deleted_at` predicate. `WorldEvent.findOne` / `findAll` inject
`deleted_at IS NULL`. Different row set. `CareerGoal` is `paranoid: false` and
carries no such delta — the break is WorldEvent-specific, not class-wide.

*Provenance of `world_events.deleted_at`, repo side — ESTABLISHED:*
- `src/migrations/20260309130000-add-deleted-at-to-all-tables.js` does **not**
  cover it. Despite the filename, the migration iterates a hardcoded 13-table
  list; `world_events` is absent. **Navigation hazard: the filename asserts
  coverage the file does not provide.** Any future session grepping this name and
  stopping at the filename will conclude wrongly.
- `src/migrations/20260709000000-enrich-locations-and-events.js` **does** carry an
  explicit add-if-missing path for `world_events.deleted_at`. This is the sole
  repo-side origin.
- `src/migrations/20260719000000-career-pipeline-links.js` does not add it.

*Live-schema execution state — OPEN.* Whether 20260709 has run against dev and
prod is unverified. Two branches follow:
- Column present → (a) stands as stated: row-set delta on conversion.
- Column absent → `paranoid: true` emits `deleted_at IS NULL` against a
  nonexistent column, and all WorldEvent ORM call sites error. This would be a
  live defect well outside F-Stats-1 scope, and it would be invisible at the two
  call sites that swallow (see (c)).

**(b) Attribute-declaration delta.** Raw `SELECT *` returns every DB column. The
ORM emits an explicit column list from declared attributes. `WorldEvent.js`
deliberately omits eight columns across three migrations, each marked "may not
exist" in-file, with matching associations disabled for the same reason:
`venue_location_id` / `venue_name` / `venue_address` / `event_date` /
`event_time` / `guest_list` / `invitation_details` (20260709),
`source_calendar_event_id` (20260711), `opportunity_id` (20260719). Any of these
present in DB is silently dropped from the converted response.

E1 feeds context-aware episode generation (AI prompt content). C17 feeds event
scoring against active goals; undeclared fields read `undefined` and scores move.

*Partial mitigation, noted:* `src/services/careerPipelineService.js:249` and
`src/services/feedPostGeneratorService.js:39` already run
`WorldEvent.findOne({ where: { used_in_episode_id } })` — E1's exact shape —
through the ORM in production. The conversion will not throw. It will return the
narrower shape production already uses elsewhere. Still an invariant break under
§13's contract; a well-precedented one.

**(c) Detection amplifier.** Both call sites wrap in
`catch (e) { /* no world_events table or no match */ }`. A conversion defect does
not throw — it degrades to `null` / empty and the route returns 200. Neither (a)
nor (b) announces itself.

**Disposition:** out of PR 1 scope per Decision #13. Not a new finding against
the model layer — `paranoid: true` appears on 41 models and is migration-backed
in general; this is a WorldEvent-specific conversion hazard, not a class finding.

**Forward-pointer, not ownership:** the `sequelize.sync()` residue at
`src/models/index.js` (F-App-1 §12.11, tracked as PE #62, unowned) is a candidate
alternative schema source if the live-schema branch resolves against migrations.
F-Stats-1 does not adopt PE #62 and mints no ownership here.

---

## §13 PR 1 Conversion Inventory (RE-CUT — v1.3 §13 superseded)

**PR 1 scope: 17 inventory units / 16 conversions.** C7 is retired in place
(collapses into C6's returned instance), so inventory count and conversion count
differ by one.

**episodes.js — 1 unit (E1 deferred).**

| # | Line | Statement | Convert to |
|---|---|---|---|
| ~~E1~~ | ~~931~~ | ~~SELECT world_events by used_in_episode_id~~ | **DEFERRED to PR 2 — §12.24** |
| E2 | 941 | SELECT character_state ('lala') LIMIT 1 | CharacterState.findOne — verbatim key + F-Sec-3 owner comment |

**careerGoals.js — 16 units, 15 conversions (C17 deferred, C7 retired).**

C1–C16 carry forward from v1.3 §13 unchanged, including:
- C5, C11, C16 — `character_state` ('lala') reads, verbatim + owner comment per Decision #12
- C7 — retired into C6
- C13, C14 — `instance.update`, **no transaction added** per §12.23

| # | Line | Flow | Statement | Convert to |
|---|---|---|---|---|
| ~~C17~~ | ~~625~~ | ~~Suggest~~ | ~~SELECT world_events (draft/ready)~~ | **DEFERRED to PR 2 — §12.24** |

**Model prerequisite check — CLOSED for PR 1 scope.** Verified live at 544cb9ad:
`src/models/CareerGoal.js` and `src/models/WorldEvent.js` both exist and are
loader-registered in `src/models/index.js` (required, exported, association-wired).
`CareerGoal` is `paranoid: false`, `tableName: 'career_goals'`, `underscored`,
with full attribute coverage for C1's dynamic WHERE and C8's interpolated SET
(`title`, `status`, `current_value`, `target_value`, `type`, `priority`,
`completed_at`). `CharacterState` exists at 30f10fe7, unmodified. No model
creation joins PR 1 scope.

**Behavioral invariant (unchanged):** PR 1 is response-identical. Same rows read,
same rows written, same keys, same status codes. Only the query mechanism changes.
Any diff in behavior is a defect in the conversion, not a feature.

---

## Open items carried to the executing session

1. ~~CareerGoal / WorldEvent model existence check~~ — **CLOSED at v1.4**
2. episodeCompletionService transaction posture (§12.13 residue)
3. character_state unique-constraint status (carried since v1.1; owner F-Sec-3,
   verify-only here)
4. PR 2–4 inventories (wardrobe, evaluation, worldEvents) — re-derive at execution
   time; **now also carries E1 + C17 and the §12.24 paranoid decision**
5. **NEW:** `world_events.deleted_at` live-schema execution state — verify against
   dev before PR 2 cuts

---

## §11 Revision History

| Revision | Date | Summary |
|---|---|---|
| v1.4 | 2026-07-24 | §13 re-cut to 17/16; §12.24 WorldEvent soft-delete + attribute delta; Decision #13 (E1/C17 → PR 2); C17 line anchor corrected 624 → 625; path precision note; PE #62 forward-pointer. Basis 544cb9ad. |

---

## Forward Statement

v1.4 is the plan-of-record. Phase B G2 PR 1 scope: **17 inventory units / 16
conversions** (C1–C16 + E2), branch `fstats/phase-b-pr1`, behavioral invariant
enforced, `'lala'` keys preserved verbatim per Decision #12 at E2/C5/C11/C16.
E1 + C17 carry to PR 2 per Decision #13. After PR 1: PRs 2–4 per the planning
doc, inventories re-derived per PR. After F-Stats-1 closes: fix-cycle continues
per the locked register order (F-Ward-1 next).

---
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-24. Main at 544cb9ad (#949). Predecessor: v1.3.*
*Minted: §12.24, Decision #13. No FD numbers. [skip-automerge]*