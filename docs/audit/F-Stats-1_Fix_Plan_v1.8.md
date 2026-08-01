# F-Stats-1 Fix Plan v1.8

## What changed in v1.8

- **Decision #16:** `career_goals.deleted_at` posture LOCKED — declare the
  attribute, keep `paranoid: false`. Posture 1 of the three offered in
  v1.7 §13.
- **Decision #17:** PR 2 may make a single-attribute model change. v1.4's
  exclusion of model changes from PR 1 does not carry forward.
- **§13 (updated):** PR 2's three conversions are unblocked. Inventory
  unchanged; the gating decision is now made.
- **§11:** v1.8 row added
- Basis: `1d167277`. Mints no FD.

This revision is written **before** PR 2 execution, unlike v1.5. The
decision it records gates the conversions rather than describing them, so
it lands first.

---

## §9 Decisions Locked (Decisions #16, #17 ADDED)

Decisions #1–#15 unchanged.

### Decision #16 — `career_goals.deleted_at`: declare the attribute, keep `paranoid: false`

`CareerGoal` gains exactly one attribute declaration:

```js
    deleted_at: { type: DataTypes.DATE, allowNull: true },
```

Matching the schema exactly — `20260719000000-career-pipeline-links.js:44`
adds the column as `Sequelize.DATE`, `allowNull: true`, no default.

**`paranoid` stays `false`.** The attribute must be named `deleted_at`,
not `deletedAt`: `CareerGoal` uses snake_case attribute names throughout
with `underscored: true`. With `paranoid: false`, Sequelize does not treat
the field as a soft-delete marker. It is an ordinary nullable date column
that appears in payloads and does nothing else. That is the intended
behavior.

#### Why this resolves the blocker

C1, C7 and C9 all return `career_goals` rows into response bodies. Their
shared blocker is §12.25(a): the column exists in schema, the model does
not declare it, so any ORM finder silently drops the key from the payload.

Today's raw `SELECT *` returns `deleted_at: null` on every row. After this
declaration, the ORM finders return the same. **The declaration restores a
key rather than adding one** — which is why posture 1 preserves
response-identity rather than merely approximating it.

#### Why not `paranoid: true` (posture 2)

Rejected on two grounds, the first decisive.

**It would silently rewrite C10, which already shipped.** C10 converted the
delete endpoint to `CareerGoal.destroy` in PR 1 (`4bfc3115`), verified
against `paranoid: false` as a hard `DELETE` matching the raw statement it
replaced. Flipping the flag turns that same call into a soft-delete stamp.
A posture decision in PR 2 must not reach backward and change the meaning
of merged work.

**It would invent a policy the codebase does not have.** Verified live at
`1d167277`: a repository-wide grep across `src` and `frontend/src` for
`career_goals` intersected with `deleted_at`, `DELETE FROM`, and `destroy`
returns **only the migration itself** — four lines, all in
`20260719000000-career-pipeline-links.js`. No writer. No reader. No
alternative delete path. Nothing sets `career_goals.deleted_at` and nothing
filters on it.

The migration's `// career_goals.deleted_at — soft delete support` comment
is aspiration, not implemented behavior. Adopting `paranoid: true` would be
F-Stats-1 deciding a product question it has no mandate for — the same
overreach Decision #12 refused for the `'lala'` drift and Decision #15
refused for §12.28.

Note the asymmetry with `WorldEvent`, which **is** `paranoid: true` and
whose soft-delete is genuinely implemented (`worldEvents.js:565`). v1.7
§12.26 established these two tables are not a pair; the symmetry argument
for posture 2 does not survive that correction.

#### Why not explicit key projection (posture 3)

`career_goals` carries twenty columns and has gained new ones twice this
year. Three hand-maintained key lists across three call sites would drift
on the next schema change, reintroducing §12.25(a) silently and in a form
harder to spot than an undeclared attribute.

**Locked: 2026-08-01.**

### Decision #17 — PR 2 may change the model

v1.4 §13 recorded that no model creation joins PR 1 scope. That exclusion
was specific to PR 1 and does not carry forward.

**PR 2 is permitted exactly one model change: the single attribute
declaration specified in Decision #16.** No other model edit — no
`paranoid` flip, no association change, no hook, no additional attribute —
joins PR 2 scope without a further decision.

Decisions #4 and #5 (no hooks, no associations during F-Stats-1) remain in
force and are not relaxed.

**Locked: 2026-08-01.**

---

## §13 PR 2 Conversion Inventory (UPDATED — gating decision now made)

Inventory unchanged from v1.7. Anchors derived live at `96ab0a97`; **`main`
has since moved to `1d167277`, a doc-only commit**, so they hold. Re-derive
if `main` moves again before execution.

| # | Line | Flow | Statement | Convert to |
|---|---|---|---|---|
| C1 | 46 | List | Dynamic string-built SELECT + replacements | `CareerGoal.findAll` — see remaining blockers below |
| C7 | 408 | Create | Re-SELECT created row | `CareerGoal.findAll` or returned instance — see note |
| C9 | 460 | Update | Re-SELECT updated row | `CareerGoal.findAll` |

**Execution order:** the model change first, as its own commit. Then
C9, C7, C1 — bottom-up by line number, so earlier anchors do not shift
under later edits. C1 last: it is the only non-mechanical conversion in the
set.

### C7's second blocker is not resolved by Decision #16

v1.5 §12.25 recorded two independent mechanisms for C7. Decision #16
resolves (a), the undeclared-column omission. It does **not** resolve (b),
the `toJSON` contract:

```js
    const goal = created[0];
    goal.progress = 0;
    goal.remaining = goal.target_value - goal.current_value;
    return res.status(201).json({ success: true, goal });
```

`res.json` invokes `JSON.stringify`, which calls a Sequelize instance's
`toJSON`, which emits `dataValues` only. `progress` and `remaining` are
assigned ad-hoc to the object and would vanish from every 201 response if
`goal` became an instance.

**C7 therefore requires a shape decision at execution time.** The likely
resolutions are to build the response object explicitly rather than
mutating the row, or to convert the instance to a plain object before
mutation. Either is a departure from pure mechanical conversion and must be
recorded when chosen. **C7 must not be written as a naive finder swap.**

The same mechanism applies to C1, whose consumer spreads each row:
`goals.map(g => ({ ...g, progress, remaining }))`. Spreading a Sequelize
instance copies `dataValues`, `_previousDataValues`, `isNewRecord` and
`_options` rather than columns.

### C1's two further blockers, carried from v1.5 §12.25

1. **Conditional sort expression.** Line 44 appends
   `ORDER BY CASE type WHEN 'primary' …`. Sequelize expresses this only via
   `sequelize.literal()`, reintroducing raw SQL under another name. Needs
   its own disposition.
2. **Error-message coupling.** The catch clause inspects `error.message`
   for `'career_goals'` / `'does not exist'` to return a graceful
   `200 + note: 'Table not yet created'`. Sequelize's error text differs
   from the raw driver's, so that fallback may stop matching and begin
   returning 500s.

**C9 is the only clean unit of the three.** Its blocker was (a) alone, and
Decision #16 resolves it.

### Behavioral invariant

Unchanged and now fully specified: PR 2 is response-identical. With
Decision #16 in force, `deleted_at: null` appears in payloads exactly as
it does today under raw `SELECT *`. Any other diff is a defect.

---

## Open items carried

1. `episodeCompletionService` transaction posture (§12.13 residue) —
   carried, unchanged.
2. `character_state` unique-constraint status — carried since v1.1; owner
   F-Sec-3, verify-only here.
3. PR 3–4 inventories (wardrobe, evaluation, worldEvents) — re-derive at
   execution time. The `worldEvents` inventory will collide with §12.28's
   surface; read §12.28 first.
4. ~~`world_events.deleted_at` live-schema state~~ — CLOSED at v1.6.
5. ~~`career_goals.deleted_at` live-schema state~~ — CLOSED at v1.6.
6. Test coverage over PR 1's converted handlers — **still unknown.**
   Fourth `Validate/Tests` timing available: 1m51s (#958, doc-only). The
   doc-only band is now 1m47s–1m58s across three samples; the code PR
   (#956) ran 2m6s. An 11-second noise floor makes the 8-second excess
   uninformative. Unresolved.
7. `character_state` ten-column assumption (v1.5 §13) — shipped at C5 and
   C11, PE #62 residue unchanged, unverified.
8. §12.28 ownership unassigned. No keystone covers soft-delete
   consistency. Owed at a future register revision.
9. §12.28's unfiltered-read set is not exhaustive and should be re-derived
   by its eventual owner.
10. **NEW:** C7's `toJSON` shape resolution and C1's three dispositions
    (spread, conditional sort, error-message coupling) are owed at PR 2
    execution. Decision #16 unblocks the inventory; it does not resolve
    these.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-14 | Initial plan. Committed at `a278a69`. |
| v1.1 | 2026-05-14 | Path 1 confirmed; §12.1–§12.18 populated. Committed at `dbd32f13`. |
| v1.2 | 2026-05-14 | §12.19 (deploy incident); Decision #8. |
| v1.3 | 2026-07-22 | Decisions #10–#12; §12.21–§12.23; §13 PR 1 inventory (19 units); `30f10fe7` provenance correction. |
| v1.4 | 2026-07-24 | §13 re-cut 17/16; §12.24; Decision #13. Basis `544cb9ad`. |
| v1.5 | 2026-08-01 | Decision #14; §12.25 response-shape hazard class; §12.26; §13 re-cut 14/14. Basis `a61d4913`. |
| v1.6 | 2026-08-01 | §12.27 live-schema verification; open items 4, 5 CLOSED; §13 provenance correction. Basis `4bfc3115`. |
| v1.7 | 2026-08-01 | §12.28 soft-delete visibility defect; Decision #15 (E1/C17 withdrawn); §12.26 correction; §13 PR 2 inventory. Basis `96ab0a97`. |
| v1.8 | 2026-08-01 | Decision #16 (`career_goals.deleted_at` posture: declare, stay `paranoid: false`); Decision #17 (single model attribute permitted in PR 2); §13 unblocked with execution order and remaining per-unit blockers; open item 10. Basis `1d167277`. |

v1.8 supersedes v1.7 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.7.
- Mints: Decisions #16 and #17, open item 10.
- Updates: §13, gating decision made, execution order specified.
- No live-database contact. No prod-box contact. No dev-box contact. All
  conclusions derive from committed files read via `git show origin/main:`
  and `git grep origin/main`.
- FD-21 check: PR references historical; no closing keywords adjacent to
  `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.8 is the plan-of-record. **PR 2 is fully unblocked at the inventory
level**: the gating posture question is decided, the model change is
permitted and bounded to one attribute, and the execution order is
specified. What remains is per-unit and belongs to execution — C7's
`toJSON` shape and C1's three dispositions, all recorded as open item 10.

C9 is clean and should ship first among the conversions. C1 is last and is
the only unit in F-Stats-1 whose conversion may reasonably conclude that it
should not be converted at all; that finding, if reached, is a legitimate
outcome and should be recorded rather than worked around.

After F-Stats-1 closes: the fix-cycle continues per the locked register
order, F-Ward-1 next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-01. Main at `1d167277` (#958). Predecessor: v1.7.*
*Minted: Decisions #16, #17, open item 10. No FD numbers. [skip-automerge]*
