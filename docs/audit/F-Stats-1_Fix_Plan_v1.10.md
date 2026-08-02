# F-Stats-1 Fix Plan v1.10

## What changed in v1.10

- **§13 (new cut):** PR 3 inventory — `src/routes/evaluation.js`, 10 units
  derived live, 7 in scope, 3 withdrawn
- **Decision #18:** unit 6/7 `rowCount` → `affectedCount` adaptation locked
- **Decision #19:** units 9 and 10 withdrawn; the transaction block stays
  wholly raw
- **Decision #20:** unit 8 withdrawn to §12.28 — third site
- **§12.28 extension:** a third unfiltered `world_events` read, found the
  first time anyone looked at a new file. Open item 9's warning was
  correct.
- **§12.30 (new):** swallowed-error auto-insert on the keystone table
- **§12.31 (new):** hardcoded destructive default show UUID
- **§12.32 (new):** the `'justawoman'` canonicality comment — evidence for
  F-Sec-3
- **§11:** v1.10 row added
- Basis: `ee5742b1`. Mints no FD.

Written **before** PR 3 execution, like v1.8. Both gating decisions are
made here on verified evidence rather than deferred.

---

## §13 PR 3 Conversion Inventory (NEW — derived live at `ee5742b1`)

**Target: `src/routes/evaluation.js`.** Ten raw statements. **7 in scope,
3 withdrawn.**

### Derivation note

A `sequelize\.query` grep returns 14 matches; **four are option lines**
(`type: sequelize.QueryTypes.SELECT` at 55, 138, 150, 154 — 150 also
carries `replacements`) belonging to the statement above them. The unit
count is **ten**, not fourteen. Recorded because the same miscount would
recur on any file using the `QueryTypes` option form.

### Two raw-query conventions coexist in this file

Unlike `careerGoals.js`, which used one form throughout:

- **`QueryTypes.SELECT` form** (units 1, 3, 4, 5) returns rows **directly**
- **Destructuring form** (units 6, 7, 8) returns `[rows, metadata]`

The conversion differs per form. Unit 1 additionally grafts
`.then(rows => [rows])` onto a `QueryTypes.SELECT` call purely to make a
destructure work.

Binding also varies: units 1–7 use a bare `sequelize`, units 8–10 use
`models.sequelize`. This is cosmetic — line 133 shows
`const { sequelize } = models;`, so both reach the same object via
`getModels()`.

### Inventory

| # | Line | Handler | Statement | Disposition |
|---|---|---|---|---|
| 1 | 46 | `getOrCreateCharacterState` | SELECT `character_state`, `ORDER BY season_id DESC NULLS LAST LIMIT 1` | Convert — §12.30, literal sort |
| 2 | 65 | `getOrCreateCharacterState` | INSERT `character_state` | Convert — verbatim key |
| 3 | 136 | admin reset | SELECT `id, name FROM shows` | Convert |
| 4 | 148 | admin reset | `COUNT(*)` `character_state` | Convert → `.count()` |
| 5 | 152 | admin reset | `COUNT(*)` `episodes` | Convert → `.count()` |
| 6 | 158 | admin reset | UPDATE `character_state` (reset) | Convert — Decision #18 |
| 7 | 171 | admin reset | UPDATE `episodes` (clear evaluations) | Convert — Decision #18 |
| ~~8~~ | ~~299~~ | ~~evaluate~~ | ~~SELECT `world_events`~~ | **WITHDRAWN — Decision #20, §12.28** |
| ~~9~~ | ~~643~~ | ~~state/update~~ | ~~UPDATE `character_state`~~ | **WITHDRAWN — Decision #19** |
| ~~10~~ | ~~652~~ | ~~state/update~~ | ~~INSERT `character_state_history`~~ | **WITHDRAWN — Decision #19** |

**Execution order:** bottom-up by line number — 7, 6, 5, 4, 3, 2, 1.
Unit 1 last: it carries the literal sort and the §12.30 defect and is the
only unit whose function signature may change.

### Per-unit notes

**Unit 1.** `ORDER BY season_id DESC NULLS LAST` needs
`sequelize.literal('season_id DESC NULLS LAST')` — a second instance of
§12.29b, constant string, no interpolation. The `.then(rows => [rows])`
wrapper disappears with the destructure. The `.catch()` is §12.30 and is
**preserved verbatim**, not fixed.

`getOrCreateCharacterState(sequelize, showId, seasonId, characterKey)`
takes `sequelize` as a parameter. Conversion needs `CharacterState`
reachable inside it — a signature change to accept `models`, plus
call-site updates. Bounded and mechanical: line 133 confirms callers
already hold `models`.

**Unit 2.** `characterKey` passes through verbatim from the parameter;
Decision #12 is satisfied by not touching it. `...DEFAULT_STATS` spreads
five keys — `coins`, `reputation`, `brand_trust`, `influence`, `stress` —
**verified live** against `src/utils/evaluationFormula.js`; all five are
declared `CharacterState` attributes. `CareerGoal.create`-style conversion
is safe.

The function returns **two different shapes** by path: a real row from
unit 1's SELECT, or a hand-built plain object at lines 79–86 on the insert
path. The synthetic object omits `created_at`/`updated_at`. **That
inconsistency exists today and must be preserved, not tidied.**

**Units 4, 5.** Consumed as `parseInt(x[0]?.cnt || 0)`. `Model.count()`
returns a number, so `parseInt` drops — exactly as at C4.

**Unit 3.** `shows` is consumed by `.length` and returned whole as
`all_shows` in the response, so rows need `.get({ plain: true })` per
§12.29a. Confirm a `Show` model is loader-registered before execution.

---

## §9 Decisions Locked (Decisions #18–#20 ADDED)

Decisions #1–#17 unchanged.

### Decision #18 — units 6 and 7: `rowCount` → `affectedCount`, explicitly

Both units destructure metadata and read `rowCount`:

```js
const [, csMeta] = await sequelize.query(`UPDATE character_state ...`);
...
character_state_updated: csMeta?.rowCount ?? 0,
```

`Model.update()` returns `[affectedCount]` — a plain array containing a
number, with **no `rowCount` property**. A naive conversion makes both
`character_state_updated` and `episodes_updated` report `0` on every
reset, silently, while the reset itself succeeds.

**This is §12.25 mechanism (a)'s class of failure on a destructive admin
operation**, where the count is the operator's only feedback that anything
happened.

Locked shape:

```js
const [csUpdated] = await models.CharacterState.update({ ... }, { where: { show_id: showId } });
```

and the response field reads `csUpdated ?? 0`. Same for unit 7 against
`Episode`.

Recorded as a **third instance of the §12.29a shape-adapter pattern**. It
is an explicit adaptation, not a mechanical swap, and it is required for
response-identity.

**Locked: 2026-08-01.**

### Decision #19 — units 9 and 10 withdrawn; the transaction block stays raw

Units 9 (`UPDATE character_state`) and 10 (`INSERT
character_state_history`) sit inside
`models.sequelize.transaction(async (t) => { ... })` and both carry
`transaction: t`. **Both are withdrawn from F-Stats-1's conversion
inventory.**

Unit 10's blocker is decisive: **`character_state_history` has no
Sequelize model.** Verified live at `ee5742b1` — no match for
`CharacterStateHistory` in `src/models/index.js`, and no model file
matching `History` under `src/models`.

Creating one was considered and rejected on three grounds:

1. **`source` is a Postgres ENUM whose values are not in one place.**
   Created as `ENUM('computed','override','manual')`, then extended by
   `ALTER TYPE` in `20260219000007-csh-source-add-wardrobe-purchase.js`
   and `20260724000002-create-financial-transactions.js`. Declaring it in
   a model creates **a fourth location for the same canon**, which drifts
   the next time anyone runs `ALTER TYPE`. This is the
   hardcoded-constants-as-canon anti-pattern F-Franchise-1 owns.
2. **The creating migration is not the authoritative schema.**
   `20260218100000-evaluation-system.js` declares `episode_id` as
   `allowNull: false`, yet unit 10 inserts `NULL` into it — reconciled
   only by the later
   `20260219000004-fix-csh-episode-id-nullable.js`. Modelling from the
   creating migration alone would be wrong, and reconciling migrations to
   derive a schema is beyond a conversion pass.
3. **Model creation is out of scope by precedent.** v1.4 excluded it from
   PR 1; Decision #17 bounded PR 2 to exactly one attribute. A new model
   is a durable artifact outliving F-Stats-1.

Unit 9 is withdrawn **with** unit 10 rather than converted alone. The two
are one atomic write. Converting half would leave an ORM call and a raw
query sharing `transaction: t` — functional, but a hybrid inside the one
block in this codebase whose atomicity was explicitly engineered to fix a
prior ledger-drift bug (lines 615–624). Not worth the risk for one unit.

**A `CharacterStateHistory` model remains a legitimate future item.** Its
natural owner is F-Franchise-1, whose mandate covers migrating
constants-as-canon into the database; the `source` ENUM is exactly that
shape. Recorded, unassigned.

**Locked: 2026-08-01.**

### Decision #20 — unit 8 withdrawn to §12.28

`evaluation.js:299` reads `world_events` by `used_in_episode_id` with **no
`deleted_at` filter**, identical in shape to E1. `WorldEvent` is
`paranoid: true`, so any ORM conversion would auto-append
`deleted_at IS NULL` and fix §12.28's defect as an undisclosed side
effect.

Decision #15's reasoning applies verbatim. Unit 8 is **withdrawn from
F-Stats-1**, not deferred, and joins E1 and C17 under §12.28.

**Locked: 2026-08-01.**

---

## §12.28 — EXTENDED: third unfiltered read

v1.7 §12.28 named two unfiltered `world_events` reads and stated
explicitly that the list was **not exhaustive** (open item 9). **That
warning was correct.** A third site was found the first time a new file
was examined:

| Site | Feeds | Impact of a soft-deleted row |
|---|---|---|
| `episodes.js:931` (E1) | `generate-beats` | Deleted event drives script-skeleton generation |
| `careerGoals.js` C17 | `suggest-events` | Deleted event appears in career-goal suggestions |
| **`evaluation.js:299` (unit 8)** | **episode evaluation** | **Deleted event's `dress_code`, `prestige`, `strictness` feed the computed score** |

The third is the most consequential: the other two surface a deleted event
in a list or a draft; this one lets it **alter a computed evaluation
result** that is then persisted.

The site is otherwise clean to convert — six columns selected explicitly,
consumed by explicit property picks, no spread. It is withdrawn solely
because converting it would fix the bug silently.

**Open item 9 remains open and its priority is raised.** Three sites found
across three files, with `wardrobe.js` (35 raw statements) and
`worldEvents.js` (144) unexamined. The eventual owner should assume more
exist.

Note also `evaluation.js:316`: `catch (weErr) { /* world_events join
optional */ }` swallows every error from this read — so a failure here is
indistinguishable from "no event linked," and evaluation proceeds with an
empty event context.

---

## §12.30 — swallowed-error auto-insert on the keystone table (NEW)

`getOrCreateCharacterState`, `evaluation.js:46–65`:

```js
const [CharacterState] = await sequelize.query( /* SELECT character_state */ )
  .then(rows => [rows])
  .catch(() => [[]]);

if (CharacterState && CharacterState.length > 0) return CharacterState[0];

// Auto-seed with defaults
const id = uuidv4();
await sequelize.query(`INSERT INTO character_state ...`);
```

`.catch(() => [[]])` swallows **every** failure — connection error, syntax
error, missing table, permission denial — into an empty result. The empty
result is then indistinguishable from "no state exists," and control falls
through to an **INSERT**.

**On any transient read failure, this function creates a new
`character_state` row.** On the table whose duplicate-key drift is the P0
keystone bug, and which has no unique constraint (open item 2, carried
since v1.1).

**Not F-Stats-1's to fix.** Conversion preserves the `.catch()` verbatim;
correcting it would change behavior inside a response-identical PR, the
shape Decisions #12, #15, #19 and #20 all refuse. Recorded here because
the failure mode is silent, sits on the keystone table, and compounds the
missing unique constraint.

**Ownership unassigned.** Natural owner is F-Sec-3, which owns
`character_key` consolidation on this table, or whoever takes open item 2.

---

## §12.31 — hardcoded destructive default show UUID (NEW)

`evaluation.js:145`, inside `POST /admin/reset-character-stats`:

```js
const showId = req.body?.showId || '9bd0655f-0426-4da4-95b8-44cdfd608b2b';
```

A destructive admin endpoint **defaults to a hardcoded show ID** when
called with no body. It then resets that show's `character_state` to
starting values and, at unit 7, clears every episode's `evaluation_json`,
`evaluation_status` and `formula_version` **and reverts `status` to
`'draft'`**.

Two findings in one:

1. **Franchise canon as a JS constant** — the dominant audit anti-pattern,
   F-Franchise-1's territory. Here the constant is a *destructive
   default*.
2. **The blast radius exceeds the endpoint name.** "reset-character-stats"
   also reverts episode status. An operator reading the route name would
   not expect that.

Not F-Stats-1's to fix. The units are converted; the default and the
status write are preserved verbatim.

---

## §12.32 — `'justawoman'` canonicality, stated in code (NEW)

`evaluation.js:621–624`, in the comment documenting the transaction fix:

> The `key === 'lala'` gate was also dropped: `'justawoman'` is the
> canonical key writers actually use, so the old check meant no ledger
> mirror ever fired for the real character.

This is **direct evidence about the P0 drift's semantics**, sitting in a
code comment rather than the register: it names which side of the
`'lala'` / `'justawoman'` split writers actually use, and records a live
bug that the drift already caused — a ledger mirror that never fired.

Surfaced here so F-Sec-3's consolidation does not have to rediscover it.
F-Stats-1 takes no action.

---

## Open items

1. `episodeCompletionService` transaction posture (§12.13 residue) —
   carried.
2. `character_state` unique-constraint status — carried since v1.1; owner
   F-Sec-3, verify-only here. **§12.30 raises its priority**: without the
   constraint, a swallowed read error can create a duplicate row.
3. PR 4+ inventories — re-derive at execution. Remaining: `wardrobe.js`
   (35 raw statements) and `worldEvents.js` (144), counts derived live at
   `ee5742b1`. **`worldEvents.js` is larger than everything F-Stats-1 has
   converted to date combined and will likely need splitting across
   several PRs.** It also carries §12.28's densest surface.
4. ~~`world_events.deleted_at` live-schema state~~ — CLOSED at v1.6.
5. ~~`career_goals.deleted_at` live-schema state~~ — CLOSED at v1.6.
6. Test coverage over converted handlers — **still unknown.** Nothing run
   to date exercises a request against any converted handler or compares
   response bodies. Unresolved.
7. `character_state` ten-column assumption (v1.5 §13) — shipped at C5 and
   C11, PE #62 residue unchanged, unverified.
8. §12.28 ownership unassigned.
9. §12.28's unfiltered-read set is not exhaustive — **confirmed by a third
   site (Decision #20). Priority raised.** Two large unexamined files
   remain.
10. ~~C7 shape, C1 dispositions~~ — CLOSED at v1.9.
11. **NEW:** §12.30 ownership unassigned — swallowed-error auto-insert on
    `character_state`.
12. **NEW:** §12.31 ownership unassigned — hardcoded destructive default.
13. **NEW:** a `CharacterStateHistory` model does not exist. Creating one
    is a legitimate future item, likely F-Franchise-1's given the `source`
    ENUM's constants-as-canon shape. Unassigned (Decision #19).
14. **NEW:** confirm a `Show` model is loader-registered before unit 3
    executes.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0–v1.2 | 2026-05-14 | Initial plan through §12.19; Decision #8. |
| v1.3 | 2026-07-22 | Decisions #10–#12; §12.21–§12.23; §13 PR 1 inventory (19 units). |
| v1.4 | 2026-07-24 | §13 re-cut 17/16; §12.24; Decision #13. Basis `544cb9ad`. |
| v1.5 | 2026-08-01 | Decision #14; §12.25 response-shape hazard class; §12.26; §13 14/14. Basis `a61d4913`. |
| v1.6 | 2026-08-01 | §12.27 live-schema verification; open items 4, 5 CLOSED. Basis `4bfc3115`. |
| v1.7 | 2026-08-01 | §12.28; Decision #15; §12.26 correction; PR 2 inventory. Basis `96ab0a97`. |
| v1.8 | 2026-08-01 | Decisions #16, #17; PR 2 execution order. Basis `1d167277`. |
| v1.9 | 2026-08-01 | §12.29 PR 2 departures; §12.25 correction; PR 2 execution record; open item 10 CLOSED. Basis `0dd0b9ff`. |
| v1.10 | 2026-08-01 | §13 PR 3 inventory (10 units, 7 in scope); Decisions #18–#20; §12.28 extended to a third site; §12.30, §12.31, §12.32; open items 11–14. Basis `ee5742b1`. |

v1.10 supersedes v1.9 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.9.
- Mints: Decisions #18–#20, §12.30, §12.31, §12.32, §13 PR 3 inventory,
  open items 11–14.
- Extends: §12.28 (third site).
- No live-database contact. No prod-box contact. No dev-box contact. All
  conclusions derive from committed files read via `git show origin/main:`
  and `git ls-tree`.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.10 is the plan-of-record. **PR 3 is fully gated**: seven units, both
gating decisions locked on verified evidence, execution order specified,
three units withdrawn with recorded reasons. What remains at execution is
mechanical, with one confirmation owed (open item 14, the `Show` model).

`evaluation.js` produced three new findings and a third §12.28 site from a
single derivation pass. That rate matters for what comes next:
`wardrobe.js` and `worldEvents.js` are 35 and 144 raw statements
respectively, and `worldEvents.js` is where §12.28's surface is densest.
**Neither should be inventoried in the same session as its execution.**

After F-Stats-1 closes: the fix-cycle continues per the locked register
order, F-Ward-1 next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-01. Main at `ee5742b1` (#961). Predecessor: v1.9.*
*Minted: Decisions #18–#20, §12.30, §12.31, §12.32, §13 PR 3 inventory, open items 11–14. Extended: §12.28. No FD numbers. [skip-automerge]*
