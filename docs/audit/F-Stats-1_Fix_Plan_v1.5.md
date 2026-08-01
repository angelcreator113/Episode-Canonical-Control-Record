# F-Stats-1 Fix Plan v1.5

## What changed in v1.5

- **§9:** Decision #14 ADDED — C1, C7, C9 deferred to PR 2; C7 reclassified
  from *retired* to *deferred*
- **§12.25 (new):** response-shape hazard class — the finding that unifies
  all four PR 2 deferrals
- **§12.26 (new):** `career_goals.deleted_at` model/schema drift; twin of
  §12.24's `world_events.deleted_at`
- **§13:** PR 1 conversion inventory RE-CUT to 14/14 — v1.4 §13 superseded
- **§11:** v1.5 row added
- Basis: `a61d4913`. Execution branch `fstats/phase-b-pr1` at `42cb1cf2`,
  six commits, unpushed at the time of writing.

This revision is written **after** PR 1 execution, not before it. The
deferrals it records were discovered by reading each unit's consumer during
conversion; they could not have been derived from the statement inventory
alone. v1.4 §13's counts are therefore superseded rather than corrected —
they were accurate to what was knowable when cut.

---

## §9 Decisions Locked (Decision #14 ADDED)

Decisions #1–#13 unchanged.

### Decision #14 — C1, C7, C9 deferred to PR 2; C7 reclassified retired → deferred

Three further PR 1 units are deferred to PR 2, joining C17 (Decision #13)
under a single response-shape resolution package:

- **C1** (`src/routes/careerGoals.js:46`, List) — three independent
  blockers, any one sufficient. See §12.25.
- **C7** (`src/routes/careerGoals.js:426`, Create re-SELECT) — **status
  changes from retired to deferred.** v1.4 §13 retires C7 into C6's
  returned instance. That collapse is not response-safe. See §12.25.
- **C9** (`src/routes/careerGoals.js:483`, Update re-SELECT) — returns its
  whole row into the response body. See §12.25.

**C6 is unaffected and ships in PR 1.** The `INSERT` converts to
`CareerGoal.create`; the returned instance is discarded and C7's raw
re-SELECT is left in place unchanged. C6's safety does not depend on C7.

**C10 is unaffected and ships in PR 1.** `CareerGoal` is `paranoid: false`,
so `destroy` issues a hard `DELETE` matching the raw statement. The
`deleted_at` column recorded in §12.26 is unused by the model and does not
alter delete parity.

Rationale for deferring rather than working around: each available
workaround (`raw: true`, `sequelize.literal()`, explicit key projection)
introduces a non-mechanical shape into a PR whose stated invariant is
mechanical conversion. Grouping the four units lets PR 2 decide the
`deleted_at` posture once, for both tables, alongside §12.24.

**Locked: 2026-08-01.**

---

## §12.25 — Response-shape hazard class (NEW)

The governing distinction, discovered during PR 1 execution:

> **A unit is conversion-safe when its result is consumed by explicit
> property access or explicit key projection. A unit is conversion-unsafe
> when its result reaches the response body whole.**

Raw `SELECT *` via `sequelize.query` returns plain objects keyed by actual
database columns. An ORM finder returns model instances exposing only
*declared attributes*, with a different serialization contract. Where the
consumer picks keys explicitly, the two are indistinguishable. Where the
consumer forwards the row itself, they are not.

Three distinct mechanisms, all silent — none throws, all return 200:

**(a) Undeclared-column omission.** A column present in the table but not
declared on the model disappears from the payload. Concretely:
`career_goals.deleted_at` (§12.26).

**(b) `toJSON` contract.** `res.json` invokes `JSON.stringify`, which calls
a Sequelize instance's `toJSON`, which emits `dataValues` only. Properties
assigned ad-hoc to an instance never reach the payload.

**(c) Spread semantics.** `{ ...instance }` copies `dataValues`,
`_previousDataValues`, `isNewRecord`, `_options` and association
machinery — not columns. Real column values end up nested rather than
top-level. Every affected row is structurally wrong.

### Per-unit application

| Unit | Consumer | Mechanism | Disposition |
|---|---|---|---|
| C1 | `goals.map(g => ({ ...g, progress, remaining }))` at :49–53 | (a) + (b) + (c) | DEFER |
| C7 | `goal.progress = 0; goal.remaining = …` then `res.json` at :430–434 | (a) + (b) | DEFER |
| C9 | `res.json({ success: true, goal: updated[0] })` at :487 | (a) | DEFER |
| C17 | `events.map(ev => ({ ...ev, suggestion_score, … }))` | (c) | DEFER (Decision #13) |

### C1 carries two blockers beyond the shape hazard

Recorded because they are independent and either alone would defer it:

1. **Conditional sort expression.** Line 44 appends
   `ORDER BY CASE type WHEN 'primary' …`. Sequelize expresses this only via
   `sequelize.literal()`, which reintroduces raw SQL under another name.
   That is a design decision, not a mechanical conversion, and it is owed
   its own decision in PR 2.
2. **Error-message coupling.** The catch at :57 inspects `error.message`
   for `'career_goals'` / `'does not exist'` to return a graceful
   `200 + note: 'Table not yet created'`. Sequelize's error text differs
   from the raw driver's, so that fallback may silently stop matching and
   begin returning 500s.

### Units confirmed safe by the same test

Verified by reading each consumer, not assumed: **E2, C2, C3, C4, C5, C6,
C8, C10, C11, C12, C13, C14, C15, C16.** Every one either picks keys
explicitly, reads scalar properties, or discards the result.

Two service-boundary crossings were checked and cleared:

- `spawnUnlockOpportunities(showId, goal, unlocks, models)` —
  `careerPipelineService.js:127–171` reads `completedGoal` by explicit
  property access only (`.title`, `.priority`, `.id`). No spread, no
  serialization. C12's instances are safe across this boundary.
- `getAccessibleCareerTier(showId, models)` — receives `showId` and
  `models`, not a converted row.

---

## §12.26 — `career_goals.deleted_at` model/schema drift (NEW)

`src/migrations/20260719000000-career-pipeline-links.js:44` adds
`deleted_at` to `career_goals`. `src/models/CareerGoal.js` declares
`paranoid: false` and no `deleted_at` attribute.

Consequences:

- The column is invisible to every ORM read (mechanism (a) above).
- The model does not treat the table as soft-deleted, while the schema
  carries the column that would make it so.

This is the direct twin of §12.24's `world_events.deleted_at`, added by the
same migration on the same date. **Both belong to one PR 2 decision.**
Neither is resolved here: F-Stats-1's mandate is raw-SQL → ORM
consolidation, and a paranoid-posture change is a behavioral change.

Live-schema execution state for both columns is **unverified** and owed
before PR 2 cuts (open items 4 and 5).

---

## §13 PR 1 Conversion Inventory (RE-CUT — v1.4 §13 superseded)

**PR 1 scope: 14 inventory units / 14 conversions.** The two counts now
coincide: C7, the only retirement, has left PR 1 scope.

Arithmetic check against v1.3 §13's 19 units for these two files:
14 shipped + 5 deferred (E1, C1, C7, C9, C17) = 19.

**`src/routes/episodes.js` — 1 unit.**

| # | Line | Statement | Converted to |
|---|---|---|---|
| ~~E1~~ | ~~931~~ | ~~SELECT world_events by used_in_episode_id~~ | **DEFERRED — Decision #13, §12.24** |
| E2 | 941 | SELECT character_state ('lala') LIMIT 1 | `CharacterState.findOne` — verbatim key + F-Sec-3 owner comment |

`sequelize` is retained in the handler's destructure for E1's benefit; it
leaves in PR 2.

**`src/routes/careerGoals.js` — 13 units.**

| # | Line | Flow | Converted to |
|---|---|---|---|
| ~~C1~~ | ~~46~~ | ~~List~~ | **DEFERRED — Decision #14, §12.25** |
| C2 | 80 | Seed | `CareerGoal.findAll` with `attributes: ['title']` |
| C3 | 300 | Seed | `CareerGoal.create`, per-item, inside existing loop |
| C4 | 370 | Create | `CareerGoal.count` |
| C5 | 386 | Create | `CharacterState.findOne` — verbatim + owner comment |
| C6 | 396 | Create | `CareerGoal.create`, return value discarded |
| ~~C7~~ | ~~426~~ | ~~Create~~ | **DEFERRED — Decision #14** (was: retired into C6) |
| C8 | 478 | Update | `CareerGoal.update` with attribute object |
| ~~C9~~ | ~~483~~ | ~~Update~~ | **DEFERRED — Decision #14, §12.25** |
| C10 | 505 | Delete | `CareerGoal.destroy` |
| C11 | 529 | Evaluate | `CharacterState.findOne` — verbatim + owner comment |
| C12 | 537 | Evaluate | `CareerGoal.findAll` |
| C13 | 553 | Evaluate | `instance.update` — no txn added (§12.23) |
| C14 | 561 | Evaluate | `instance.update` — no txn added (§12.23) |
| C15 | 601 | Suggest | `CareerGoal.findAll` |
| C16 | 609 | Suggest | `CharacterState.findOne` — verbatim + owner comment |
| ~~C17~~ | ~~625~~ | ~~Suggest~~ | **DEFERRED — Decision #13, §12.24** |

No import changes were required in `careerGoals.js`: both models reach
through the existing `getModels()` binding that already supplied
`models.sequelize`. `episodes.js` required one destructure addition.

### Deliberate mechanism differences, recorded

All four preserve behavior; none is cleanup.

1. **`JSON.stringify` removed on JSONB fields** (C3, C6, C8 —
   `unlocks_on_complete`, `episode_range`). Raw SQL passed a stringified
   object that Postgres cast to JSONB. Passing that same string through
   Sequelize would serialize the *string*, double-encoding the column.
   Passing the raw value stores byte-identical data. **This removal is
   required for fidelity.**
2. **`updated_at` no longer written explicitly** (C8, C13, C14, C3, C6).
   The model's `timestamps` config with `updatedAt: 'updated_at'` owns it.
3. **`completed_at` moves from SQL `NOW()` to `new Date()`** (C8, C14).
   DB clock to Node clock; sub-second on a single host; standard Sequelize
   idiom.
4. **`parseInt` dropped at C4.** The raw form parsed a string count out of
   the result row; `count` returns a number. Same comparison, same 400.

### Behavioral invariant (unchanged)

PR 1 is response-identical. Same rows read, same rows written, same keys,
same status codes. Only the query mechanism changes. Any diff in behavior
is a defect in the conversion, not a feature.

### Accepted assumption, recorded for challenge

C5 and C11 perform dynamic property access —
`state[goal.target_metric]` — against the converted instance.
`CareerGoal.target_metric` documents nine legal values, four of which
(`followers`, `engagement_rate`, `portfolio_strength`,
`consistency_streak`) are not declared on `CharacterState`. Conversion is
safe **only if** `character_state` has exactly the ten columns the model
declares.

Basis accepted: the committed migration record.
`20260218100000-evaluation-system.js` creates the table with exactly those
columns, and no later migration issues `addColumn` against
`character_state` (four candidate files checked; all hits are
`character_state_history` or an unrelated `character_states` JSONB field).

**Residue:** PE #62 documents inline-DDL and `model.sync` table creation in
this codebase, so the migration record is not a guaranteed-complete picture
of live schema. A `sync` against a model declaring an extra column could
have added one no migration mentions. Accepted 2026-08-01 without live
verification. Recorded here so a future session can challenge it cheaply.

### Execution record

Branch `fstats/phase-b-pr1`, cut from `origin/main` at `a61d4913` per
Decision #11's `fstats/` prefix. Six commits:

| Commit | Units |
|---|---|
| `5d93dd33` | E2 |
| `a72a7e19` | C15, C16 |
| `b63a25f8` | C11, C12, C13, C14 |
| `94561fc7` | C8, C10 |
| `8b622ca2` | C4, C5, C6 |
| `42cb1cf2` | C2, C3 |

Per-unit gates applied throughout: `git diff` hunk-scope check before
staging, `git diff --cached` before commit, `node --check` after each edit,
explicit-path `git add` only. Anchors were certified live before the branch
cut — `git diff --name-only 3cfc1718 origin/main` returned docs-only paths,
so every v1.3-derived line number held at `a61d4913`.

---

## Open items carried to PR 2

1. `episodeCompletionService` transaction posture (§12.13 residue) —
   carried, unchanged.
2. `character_state` unique-constraint status — carried since v1.1; owner
   F-Sec-3, verify-only here. Noted in passing: the creating migration adds
   `idx_character_state_unique` on `(show_id, season_id, character_key)`;
   whether it is genuinely `unique` was not read.
3. PR 2–4 inventories (wardrobe, evaluation, worldEvents) — re-derive at
   execution time. **Now also carries the full response-shape package: E1,
   C1, C7, C9, C17, plus the §12.24 paranoid decision.**
4. `world_events.deleted_at` live-schema execution state — verify against
   dev before PR 2 cuts (carried from v1.4).
5. **NEW:** `career_goals.deleted_at` live-schema execution state — same
   verification, same migration, same window (§12.26).
6. **NEW:** test coverage over the converted handlers is **unknown**.
   Fourteen conversions carry a response-identical invariant with no test
   evidence gathered. Whether branch protection's `Tests` check exercises
   these routes should be established before merge, not after.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-14 | Initial plan. Committed at `a278a69`. |
| v1.1 | 2026-05-14 | Path 1 confirmed; §12.1–§12.18 populated. Committed at `dbd32f13`. |
| v1.2 | 2026-05-14 | §12.19 (deploy incident); Decision #8 (F-Deploy-1 promoted). |
| v1.3 | 2026-07-22 | Gate satisfied (Decision #10); branch naming (Decision #11); 'lala' handling (Decision #12); §12.21–§12.23; §13 PR 1 inventory (19 units); 30f10fe7 provenance correction. |
| v1.4 | 2026-07-24 | §13 re-cut to 17/16; §12.24 WorldEvent soft-delete + attribute delta; Decision #13 (E1/C17 → PR 2); C17 anchor corrected 624 → 625. Basis `544cb9ad`. |
| v1.5 | 2026-08-01 | Decision #14 (C1/C7/C9 → PR 2; C7 retired → deferred); §12.25 response-shape hazard class; §12.26 `career_goals.deleted_at` drift; §13 re-cut to 14/14; PR 1 execution record. Basis `a61d4913`. |

v1.5 supersedes v1.4 for all forward references.

---

## Register hygiene

- Mints no FD. Tail unchanged.
- Mints: Decision #14, §12.25, §12.26. §13 re-cut.
- Closes: v1.4 open item 1 (model existence check) remains closed; no new
  closures.
- No live-database contact occurred during PR 1 execution. All schema
  conclusions derive from committed migrations, read via
  `git show origin/main:`.
- No prod-box or dev-box contact.
- FD-21 check: PR references historical; no closing keywords adjacent to
  `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.5 is the plan-of-record. PR 1 is complete at 14/14 on branch
`fstats/phase-b-pr1` and awaits push and review. PR 2's scope opens with
the response-shape package (E1, C1, C7, C9, C17) and the two-table
`deleted_at` decision, then continues to the wardrobe / evaluation /
worldEvents inventories, re-derived at execution time. After F-Stats-1
closes: the fix-cycle continues per the locked register order, F-Ward-1
next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-01. Main at `a61d4913` (#954). Predecessor: v1.4 (`cdfaf688`, #950).*
*Minted: Decision #14, §12.25, §12.26, §13 re-cut. No FD numbers. [skip-automerge]*
