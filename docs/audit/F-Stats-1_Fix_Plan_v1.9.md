# F-Stats-1 Fix Plan v1.9

## What changed in v1.9

- **§12.29 (new):** PR 2's two recorded departures — the plain-object
  shape adapter and the constant sort literal
- **§12.25 correction:** C1's `ORDER BY` was never a *conditional* sort
  expression. v1.5 §12.25 and v1.8 §13 both said so; both were wrong.
- **§13 (updated):** PR 2 execution record, 3/3 shipped. `careerGoals.js`
  is fully migrated except C17, withdrawn by Decision #15.
- **Open item 10: CLOSED.** All four dispositions resolved at execution.
- **§13 provenance:** PR 2 squash-merged as `0dd0b9ff` (#960)
- **§11:** v1.9 row added
- Basis: `0dd0b9ff`. Mints no FD.

Written **after** PR 2 execution, like v1.5 and unlike v1.8. The departures
it records were chosen at the keyboard against verified text; v1.8 could
name the blockers but not their resolutions.

---

## §12.25 — CORRECTION

v1.5 §12.25 listed among C1's blockers:

> **Conditional sort expression.** Line 44 appends
> `ORDER BY CASE type WHEN 'primary' …`.

v1.8 §13 repeated it. **The characterisation is wrong.** Read in full at
`96ab0a97`, line 44 is:

```js
query += ` ORDER BY CASE type WHEN 'primary' THEN 1 WHEN 'secondary' THEN 2 WHEN 'passive' THEN 3 END, priority ASC, created_at DESC`;
```

It is appended **unconditionally**, on every request, regardless of query
parameters. The two conditional appends in that handler are the `status`
and `type` WHERE fragments at lines 41–42 — not the sort.

The `CASE` is a value-to-rank mapping *inside* a fixed sort expression,
not a conditional append. The error arose from reading a truncated console
line and inferring "CASE" implied "conditional."

**Why the distinction mattered.** A conditionally-assembled sort string
would have meant per-request SQL construction inside an ORM call — hard to
justify. A constant expression means `sequelize.literal()` receives a fixed
string with no interpolation and no user input, which is what made C1
convertible at all (§12.29b). The correction is the reason the unit
shipped rather than being withdrawn.

Recorded as a reading-discipline note: **conclusions drawn from truncated
output are unreliable even when the surrounding reasoning is sound.** The
same session's 627-vs-709 line-count error had the same root cause.

---

## §12.29 — PR 2's recorded departures (NEW)

v1.8 §13 required that C7's chosen shape be recorded. Two departures
shipped; both are documented here rather than left in commit bodies, which
carry no register authority.

### §12.29a — plain-object shape adapter (C7, C1)

```js
row.get({ plain: true })
```

Applied at C7 (`careerGoals.js`, Create) and per-row at C1 (List).

**Why required.** Both consumers treat the returned row as a mutable plain
object. C7 assigns `progress` and `remaining` onto it before serializing;
C1 spreads each row into a new object. A Sequelize instance satisfies
neither: `res.json` → `JSON.stringify` → `toJSON` emits `dataValues` only,
so ad-hoc properties never reach the payload (§12.25 mechanism (b)); and
`{ ...instance }` copies `dataValues`, `_previousDataValues`,
`isNewRecord`, `_options` rather than columns (mechanism (c)).

Without the adapter, both endpoints would return structurally wrong bodies
and **nothing would throw**.

**Status: a shape adapter, not a pure mechanical swap.** It is the smallest
available resolution and the documented Sequelize idiom for this problem.
Two alternatives were considered and rejected: building the response object
explicitly with a spread (restructures the handler beyond the invariant),
and leaving the units raw (the adapter is sufficient, so withdrawal was
unwarranted).

### §12.29b — constant sort literal (C1)

```js
models.sequelize.literal(`CASE type WHEN 'primary' THEN 1 WHEN 'secondary' THEN 2 WHEN 'passive' THEN 3 END`)
```

**Status: raw SQL surviving inside an ORM call.** Accepted on three
grounds: the string is constant, with no interpolation and no user input
(§12.25 correction above); the expression has no ORM equivalent; and the
alternative was leaving C1 unconverted for a reason that turned out to
rest on a misreading.

`priority ASC` and `created_at DESC` are expressed in array form and render
identically.

**This is the only raw SQL F-Stats-1 has deliberately introduced.** Noted
so that a future consolidation pass finds it recorded rather than
mistaking it for a missed conversion.

### Departures deliberately *not* taken

Recorded because each was considered and refused:

- **No `show_id` added to C9's where clause.** The raw re-SELECT is
  unscoped by show: when the show guard fails, the preceding `UPDATE`
  affects zero rows but this read still returns the untouched goal.
  Scoping it would be a correctness fix. Refused on Decision #12's
  reasoning.
- **No optional chaining added at C7.** If the row is missing, the current
  code throws on `undefined.progress`; the converted code throws one line
  earlier on `undefined.get`. Both are unhandled TypeErrors caught by the
  same clause returning the same 500. Adding `?.` would have *prevented* a
  crash that happens today.
- **C1's error-message fallback preserved verbatim.** See §13 below.

---

## §13 PR 2 Execution Record — 3/3 SHIPPED

Squash-merged as **`0dd0b9ff`** (#960). Four branch commits, not reachable
from `main` after the squash — same provenance treatment as v1.6 §13 gave
PR 1:

| Commit | Content |
|---|---|
| `5a0831ba` | Model change — `deleted_at` declared on `CareerGoal` (Decisions #16, #17) |
| `f73297ba` | C9 — Update re-SELECT → `CareerGoal.findAll` |
| `024fbb06` | C7 — Create re-SELECT → `findAll` + `.get({ plain: true })` |
| `0ac39001` | C1 — List query → `findAll`, conditional where, literal sort |

| # | Unit | Shipped as | Departure |
|---|---|---|---|
| C9 | Update re-SELECT | `CareerGoal.findAll`, `where: { id: goalId }` | none |
| C7 | Create re-SELECT | `findAll` + `.get({ plain: true })` | §12.29a |
| C1 | List | `findAll`, conditional where, `literal` sort, per-row `.get({ plain: true })` | §12.29a, §12.29b |

**`findAll` everywhere, never `findOne`.** At C9 this is load-bearing:
`updated[0]` stays `undefined` when no row matches, so `res.json` omits the
`goal` key entirely. `findOne` would emit `goal: null` — a different body.

**Model change confirmed minimal.** One line, one attribute,
`paranoid: false` untouched. Diff across the whole PR: two files, 21
insertions, 15 deletions.

### C1's error-message fallback: preserved, with known risk

```js
if (error.message?.includes('career_goals') || error.message?.includes('does not exist')) {
  return res.json({ success: true, goals: [], note: 'Table not yet created. Run migration.' });
}
```

Sequelize wraps driver errors, so the message text may differ and this
match may stop firing. Preserved verbatim anyway: the clause guards against
`career_goals` not existing, a condition that **cannot occur**. §12.27
verified the schema live, and every other handler in this file now queries
the table through the ORM. If the path is ever observed failing, it is
revisited then.

### File state after PR 2

`src/routes/careerGoals.js` contains **exactly one** raw SQL statement:
C17, at the `suggest-events` handler. It is there by **Decision #15**, not
by omission — converting it would fix §12.28's soft-delete visibility
defect inside a PR claiming to change nothing.

Unit arithmetic across both files, closing v1.3 §13's original 19:

| | Units |
|---|---|
| PR 1 (`4bfc3115`) | 14 |
| PR 2 (`0dd0b9ff`) | 3 |
| Withdrawn to §12.28 (Decision #15) | 2 — E1, C17 |
| **Total** | **19** |

`src/routes/episodes.js` retains E1 on the same basis. The `sequelize`
destructure in its `generate-beats` handler is retained for E1's use and
does not leave with F-Stats-1.

---

## Open items

1. `episodeCompletionService` transaction posture (§12.13 residue) —
   carried, unchanged.
2. `character_state` unique-constraint status — carried since v1.1; owner
   F-Sec-3, verify-only here.
3. PR 3–4 inventories (wardrobe, evaluation, worldEvents) — re-derive at
   execution time. **The `worldEvents` inventory will collide with
   §12.28's surface; read §12.28 before cutting it.**
4. ~~`world_events.deleted_at` live-schema state~~ — CLOSED at v1.6.
5. ~~`career_goals.deleted_at` live-schema state~~ — CLOSED at v1.6.
6. Test coverage over converted handlers — **still unknown.** Fifth
   `Validate/Tests` timing: 1m51s (#960, 3 conversions + model change),
   sitting inside the 1m47s–1m58s doc-only band. Across five samples the
   signal remains uninformative. The model change did at least load
   without error, since `models/index.js` requires every model at startup.
   **Nothing run to date exercises a request against these handlers or
   compares response bodies.** Unresolved.
7. `character_state` ten-column assumption (v1.5 §13) — shipped at C5 and
   C11, PE #62 residue unchanged, unverified.
8. §12.28 ownership unassigned. No keystone covers soft-delete
   consistency. Owed at a future register revision.
9. §12.28's unfiltered-read set is not exhaustive and should be re-derived
   by its eventual owner.
10. ~~C7's shape resolution and C1's dispositions~~ — **CLOSED at v1.9.**
    Recorded in §12.29 and §13.

---

## §11 Plan Version History (UPDATED)

| Version | Date | Changes |
|---|---|---|
| v1.0 | 2026-05-14 | Initial plan. Committed at `a278a69`. |
| v1.1 | 2026-05-14 | Path 1 confirmed; §12.1–§12.18 populated. Committed at `dbd32f13`. |
| v1.2 | 2026-05-14 | §12.19 (deploy incident); Decision #8. |
| v1.3 | 2026-07-22 | Decisions #10–#12; §12.21–§12.23; §13 PR 1 inventory (19 units). |
| v1.4 | 2026-07-24 | §13 re-cut 17/16; §12.24; Decision #13. Basis `544cb9ad`. |
| v1.5 | 2026-08-01 | Decision #14; §12.25 response-shape hazard class; §12.26; §13 re-cut 14/14. Basis `a61d4913`. |
| v1.6 | 2026-08-01 | §12.27 live-schema verification; open items 4, 5 CLOSED; PR 1 provenance. Basis `4bfc3115`. |
| v1.7 | 2026-08-01 | §12.28 soft-delete visibility defect; Decision #15; §12.26 correction; PR 2 inventory. Basis `96ab0a97`. |
| v1.8 | 2026-08-01 | Decisions #16, #17; §13 unblocked with execution order; open item 10. Basis `1d167277`. |
| v1.9 | 2026-08-01 | §12.29 PR 2 departures; §12.25 correction (`ORDER BY` not conditional); §13 PR 2 execution record 3/3 and provenance; open item 10 CLOSED. Basis `0dd0b9ff`. |

v1.9 supersedes v1.8 for all forward references.

---

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.8.
- Mints: §12.29. Corrects: §12.25's conditional-sort characterisation.
- **Closes: open item 10.**
- No live-database contact. No prod-box contact. No dev-box contact.
- FD-21 check: PR references historical; no closing keywords adjacent to
  `#N`.
- This revision ships WITH `[skip-automerge]` (doc-only PR).

---

## Forward Statement

v1.9 is the plan-of-record. **`src/routes/careerGoals.js` and the
`character_state` read in `src/routes/episodes.js` are complete.** All 19
units from v1.3 §13 are resolved: 17 converted, 2 withdrawn by decision.

Phase B continues with PRs 3–4 — wardrobe, evaluation, worldEvents —
inventories underived and to be cut at execution time against `main` as it
stands then. The `worldEvents` inventory is the one to approach carefully:
it will overlap §12.28's surface, and §12.28's unfiltered-read list is
explicitly not exhaustive.

Two things remain unverified across all of F-Stats-1's shipped work: test
coverage over the converted handlers (open item 6), and the
`character_state` ten-column assumption (open item 7). Neither blocks
further conversion; both are cheap to close if a future session wants
them.

After F-Stats-1 closes: the fix-cycle continues per the locked register
order, F-Ward-1 next.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-01. Main at `0dd0b9ff` (#960). Predecessor: v1.8.*
*Minted: §12.29. Corrected: §12.25. Closed: open item 10. No FD numbers. [skip-automerge]*
