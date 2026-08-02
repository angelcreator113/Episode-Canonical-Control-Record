# F-Stats-1 Fix Plan v1.11

## What changed in v1.11
- **§12.33 (new):** paranoid models diverge silently under ORM conversion.
  A class finding. **Owned by F-Stats-1**, closed within this revision.
- **Decision #21:** unit 3 converts with `.unscoped()`. Deferred to PR 4 or
  a standalone, not withdrawn.
- **§13 amendment:** PR 3 execution record — units 1, 2, 4, 5, 6, 7 shipped
  at `ce953f57` (#963). Unit 3 deferred.
- **Open items 15, 16.**
- **§11:** v1.11 row added.
- Basis: `ce953f57`. Mints no FD.

Written **after** PR 3 execution, unlike v1.8 and v1.10. The finding that
prompted it was produced by execution, not by planning, and the record
follows the v1.9 precedent for departures discovered at the keyboard.

---

## §12.33 — paranoid models diverge silently under ORM conversion (NEW)

### Statement

Sequelize models registered `paranoid: true` append `deleted_at IS NULL` to
`findAll`, `findOne`, `count`, and `update`. Raw SQL carrying no such
predicate does not. Converting one to the other **silently changes the row
set** — no error, no warning, no test failure absent a soft-deleted row.

Verified live at `ce953f57`: **40 model files carry `paranoid: true`**
against ~151 registered models. The list includes `Show`, **`WorldEvent`**,
and **`WardrobeLibrary`**.

### Why this is a class, not an incident

The two files remaining in F-Stats-1's conversion inventory target two of
the affected models:

| File | Raw statements | Target model | Paranoid |
|---|---|---|---|
| `wardrobe.js` | 35 | `WardrobeLibrary` | **yes** |
| `worldEvents.js` | 144 | `WorldEvent` | **yes** |

Every conversion in PR 4 and beyond therefore carries a per-statement
question that §13's existing per-unit note format does not ask: *does the
raw statement filter `deleted_at`, and does the ORM call need `.unscoped()`
to match it?*

### First instance

Unit 3 of PR 3 — `SELECT id, name FROM shows ORDER BY created_at`, converted
against `Show`. Three divergences, all silent:

1. `all_shows` in the response body loses soft-deleted rows. The code
   comment at the call site reads *"List ALL shows so we can see what's in
   the DB"* — a diagnostic that hides rows is a broken diagnostic.
2. `if (!shows.length)` changes control flow. Where every show is
   soft-deleted, the raw query proceeds and `findAll()` bails.
3. Both sit on `POST /admin/reset-character-stats`, a destructive endpoint.

Caught at execution because unit 3 happened to be checked last. **Ordering
luck, not process.** §13's unit 3 note asked only whether a `Show` model was
loader-registered (open item 14) — the right question for reachability, the
wrong question for row-set identity.

### Detection rule for PR 4+

Before converting any raw statement, read the target model's registration.
If `paranoid: true` and the raw statement carries no `deleted_at` predicate,
the conversion requires `.unscoped()`. If `paranoid: true` and the raw
statement **does** filter `deleted_at`, the default scope is correct and
`.unscoped()` must be omitted. Both directions are wrong by default.

Named scopes are not a hazard. `Episode` carries an `active` scope with
`where: { deleted_at: null }`, but it is opt-in — `Episode.count()` appends
nothing. Verified at PR 3 across three routes: `paranoid`, `defaultScope`,
and named `scopes`. Only the first two bind implicitly.

### Ownership

**F-Stats-1.** The class is fully contained in F-Stats-1's remaining scope:
both affected target models are F-Stats-1 conversion targets, and the
detection rule above discharges it. This revision closes §12.33. It does not
join §12.28 as an unassigned finding.

---

## §9 Decisions Locked (Decision #21 ADDED)

Decisions #1–#20 unchanged.

### Decision #21 — unit 3 converts with `.unscoped()`

Unit 3 was deferred at PR 3 execution rather than converted, on the §12.33
finding. Three dispositions were considered:

- **(a)** convert with `.unscoped()`
- **(b)** withdraw permanently, as units 9 and 10 under Decision #19
- **(c)** defer ownership out of F-Stats-1

**(a) is locked.** The divergence is fully characterized and the remedy is
mechanical. (b) was rejected: units 9 and 10 were withdrawn on a structural
blocker — `character_state_history` has no model — whereas unit 3 has no
blocker, only a scope adjustment. Leaving one raw statement in an otherwise
converted file is the residue shape that produced PE #62.

Locked shape:

```js
const showRows = await models.Show.unscoped().findAll({
  attributes: ['id', 'name'],
  order: [['created_at', 'ASC']],
});
const shows = showRows.map(r => r.get({ plain: true }));
```

`.unscoped()` restores the raw row set. `.get({ plain: true })` per §12.29a,
since `shows` is returned whole as `all_shows`. `attributes` stays limited to
`id, name` — widening to `SELECT *` would add fields the response never had.
`ORDER BY created_at` with no direction is ASC in Postgres.

Ships in PR 4 or a standalone. **Locked: 2026-08-02.**

---

## §13 PR 3 Execution Record (AMENDED)

Shipped at `ce953f57` (#963), squash-merged, four required checks green.

#
Line
Statement
Planned
Shipped

1
46
SELECT `character_state`, literal sort
Convert
Converted

2
65
INSERT `character_state`
Convert
Converted

3
136
SELECT `id, name FROM shows`
Convert
**Deferred — §12.33, Decision #21**

4
148
`COUNT(*)` `character_state`
Convert
Converted

5
152
`COUNT(*)` `episodes`
Convert
Converted

6
158
UPDATE `character_state`
Convert
Converted

7
171
UPDATE `episodes`
Convert
Converted

**6 of 7.** Execution order 7, 6, 5, 4, 2, 1 as specified.

### Departures

**Unit 1 `.catch()` shape.** `[[]]` became `[]` — the destructure is removed
by the conversion, so the fallback shape follows it. The §12.30 defect is
preserved exactly: the error is swallowed, treated as no-row-found, and falls
through to auto-insert. Recorded because the text differs; the behavior does
not.

**Decision #18 payload.** The locked shape elided the update payload as
`{ ... }`. `updated_at` was omitted from both unit 6 and unit 7 payloads;
`CharacterState` and `Episode` are both `timestamps: true`, so the column is
written by the ORM. No departure from a locked field list — none existed.

### Verifications performed at execution

Recorded because each was cheap and one of them changed the outcome:

- `Episode` — `paranoid: false`, `active` is a named scope. Units 5 and 7
preserve row sets.
- `CharacterState` — no paranoid, no scopes, `timestamps: true`,
`underscored: true`.
- `Show` — `paranoid: true`. **This produced §12.33.**
- All three `getOrCreateCharacterState` call sites read scalars off `state`
and none serialize it, so the instance return needs no plain-object
adapter at unit 1.
- `models.Sequelize` is exported from `src/models/index.js`, so `Op` resolves
without a new import. Note that `models.sequelize.Op` is **undefined** —
`Op` hangs off the constructor, not the instance, and a computed key of
`undefined` would silently drop the `OR` clause.

---

## Open items

Items 1, 2, 3, 6, 7, 8, 9, 11, 12, 13 carried unchanged from v1.10.
Item 14 (`Show` loader registration) **CLOSED** — confirmed registered at PR 3.

1. ~~confirm a `Show` model is loader-registered~~ — CLOSED at v1.11.
2. **NEW:** per-statement `.unscoped()` audit owed for `wardrobe.js` and
`worldEvents.js` at their inventory sessions, per §12.33's detection
rule. **A `deleted_at` grep count is not a predicate count** —
`worldEvents.js` returns 39 matches against 144 statements, but those
include column lists, soft-delete writes, and non-target statements.
The ratio is not derivable in bulk and must not be reported as though
it were.
3. **NEW:** §12.33 and §12.28 may be the same underlying problem seen from
two directions — both concern rows a query should return and does not.
**Hypothesis only.** PR 4's inventory tests it; it is not asserted here.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0-v1.2 | 2026-05-14 | Initial plan through S12.19; Decision #8. |
| v1.3 | 2026-07-22 | Decisions #10-#12; S12.21-S12.23; S13 PR 1 inventory (19 units). |
| v1.4 | 2026-07-24 | S13 re-cut 17/16; S12.24; Decision #13. Basis 544cb9ad. |
| v1.5 | 2026-08-01 | Decision #14; S12.25 response-shape hazard class; S12.26; S13 14/14. Basis a61d4913. |
| v1.6 | 2026-08-01 | S12.27 live-schema verification; open items 4, 5 CLOSED. Basis 4bfc3115. |
| v1.7 | 2026-08-01 | S12.28; Decision #15; S12.26 correction; PR 2 inventory. Basis 96ab0a97. |
| v1.8 | 2026-08-01 | Decisions #16, #17; PR 2 execution order. Basis 1d167277. |
| v1.9 | 2026-08-01 | S12.29 PR 2 departures; S12.25 correction; PR 2 execution record; open item 10 CLOSED. Basis 0dd0b9ff. |
| v1.10 | 2026-08-01 | S13 PR 3 inventory (10 units, 7 in scope); Decisions #18-#20; S12.28 extended to a third site; S12.30, S12.31, S12.32; open items 11-14. Basis ee5742b1. |
| v1.11 | 2026-08-02 | §12.33 paranoid-model class, owned and closed; Decision #21; §13 PR 3 execution record; open item 14 CLOSED; open items 15, 16. Basis `ce953f57`. |

v1.11 supersedes v1.10 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.10.
- Mints: Decision #21, §12.33, open items 15 and 16.
- Amends: §13 (PR 3 execution record).
- Closes: open item 14, §12.33.
- No live-database contact. No prod-box contact. No dev-box contact. All
conclusions derive from committed files read via `git show origin/main:`
and `git grep`, and from PR 3's execution.
- FD-21 check: no closing keywords adjacent to `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

PR 3 shipped 6 of 7 units and produced a finding the plan did not anticipate.
That is the second consecutive revision where a derivation pass on a single
file surfaced material the previous revision could not have known — v1.10
found a third §12.28 site the same way.

The rate is the argument for §12.33's detection rule being applied at
inventory rather than at execution. Unit 3 was caught by ordering luck. At
144 statements, `worldEvents.js` will not be caught by luck.

`wardrobe.js` and `worldEvents.js` remain uninventoried. **Neither should be
inventoried in the same session as its execution**, unchanged from v1.10.
Decision #21's `.unscoped()` conversion of unit 3 ships with PR 4 or as a
standalone, whichever comes first.

After F-Stats-1 closes: the fix-cycle continues per the locked register
order, F-Ward-1 next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-02. Main at `ce953f57` (#963). Predecessor: v1.10.*
*Minted: Decision #21, §12.33, open items 15–16. Amended: §13. Closed: open item 14, §12.33. No FD numbers. [skip-automerge]*
