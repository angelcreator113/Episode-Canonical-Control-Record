# F-Stats-1 Fix Plan v1.44
*Additive-supersede on v1.43. Mints §47. Establishes reach for finding class 1. Mints no finding.*

## What changed in v1.44

**§35.5 finding class 1's reach is ESTABLISHED beyond `worldEvents.js`.** Two
instances in `arcRoutes.js`, both the scope-cashed-at-the-write shape, on a
show-partitioned table, in routes carrying `:showId`.

**§35.5's exclusion basis is false as stated for class 1.** It reads: *"Each has
multiple instances within `worldEvents.js` and no established reach beyond it."*
That was true when written and is no longer true for class 1.

**Cross-Keystone Register §2's exclusion no longer applies to class 1.** §2
excludes findings whose reach is *asserted* but not *established*. Class 1's is
now established.

**No finding is minted.** §35.5's homing conclusion is unchanged — class 1 is not
F-Stats-1's, and it is not F-AUTH-1's *as scoped*, because both `arcRoutes.js`
handlers declare `requireAuth` exactly as every `worldEvents.js` handler does.
**The class is real, spans files, and has no keystone that owns it.** Three
options are recorded at §47.5 and none is taken.

**An F-AUTH-1 instance is reported, not minted** — `worldStudio.js:2483` declares
`optionalAuth` on a write. That is F-AUTH-1 sub-form (a), which already has an
owner and needs no reach argument.

**Classes 2–6 are NOT established.** One class-2 candidate and one class-5
instance are recorded as candidates only.

**A malformed probe is recorded at §47.6**, and a manufactured finding that was
avoided at §47.2.

---

## §47 — finding class 1, reach established

### §47.1 Basis and the population

Basis `112ea6d1` (v1.43, #1016). Source-derived via `git show origin/main:` and
`git grep`. No live database contact.

**Raw-SQL concentration across `src/routes/`**, by `sequelize.query` count:

| File | Count |
|---|---|
| `worldEvents.js` | 112 |
| `worldStudio.js` | 60 |
| `memories/assistant.js` | 52 |
| `relationships.js` | 31 |
| `uiOverlayRoutes.js` | 29 |
| `storyHealth.js` | 28 |
| `shows.js` | 22 |

Then a tail to 3. `worldEvents.js` is an outlier at nearly double the next file.

**Class 1 can only apply where a show partition exists in the route.** 22 route
files carry `:showId`; that is the population. Files without it cannot omit a
scope term they never had.

Three of the 22 are already keystone or finding surfaces — `wardrobe.js`
(F-Ward-1), `uiOverlayRoutes.js` (single-instance state), `careerGoals.js` (the
four-parallel-completion-writers finding). **The population overlaps existing
audit territory rather than being fresh ground.**

### §47.2 A manufactured finding, avoided

The first probe target was `worldStudio.js`, on statement count alone. **It has no
`:showId` in any route path** — 53 routes, all `/world/characters/:id`,
`/world/scenes/:sceneId`, `/world/batches`. No show partition in its addressing.

Probing there for absent `show_id` terms would have returned hits on every
statement and manufactured a class-1 finding from a file the class cannot apply
to. **The scoping model was checked before the scoping question was asked**, and
the target was discarded.

That `worldStudio.js` has no show partition while `worldEvents.js` scopes by
`show_id` throughout is **its own question** — the two files disagree about
whether world characters are show-partitioned entities. Recorded; not pursued
here; no ownership claimed.

### §47.3 The established instances

**`arcRoutes.js`, `PUT /world/:showId/arc/phase/:phase`**

| Step | Statement | Scope |
|---|---|---|
| Read | `SELECT id, phases FROM show_arcs WHERE show_id = :showId AND status = 'active' AND deleted_at IS NULL LIMIT 1` | **scoped** |
| Write (:158) | `UPDATE show_arcs SET phases = :phases, updated_at = NOW() WHERE id = :id` | **unscoped** |

**`arcRoutes.js`, `POST /world/:showId/arc/extend`**

| Step | Statement | Scope |
|---|---|---|
| Read | Same scoped `show_arcs` read | **scoped** |
| Write (:209) | `UPDATE show_arcs SET phases = :phases, episode_end = :arcEnd, progression_log = :log, updated_at = NOW() WHERE id = :id` | **unscoped** |

Both satisfy all three tests:

1. **The route carries `:showId`.** Confirmed in the file's own header block and in
   the handler declarations.
2. **`showId` is available and used, then dropped.** Each handler destructures it
   and passes it to the read. The write does not carry it.
3. **The table is show-partitioned.** `show_arcs` has a `show_id` column — the
   scoped read demonstrates it in the same handler.

**This is the shape recorded at §44.3 for `worldEvents.js` 1837, 1910 and 1911:**
scope enforced once in a read, then cashed at a write that carries no scope term.
The write trusts a JavaScript invariant rather than a SQL predicate.

### §47.4 What is established, and what is not

**Established:** finding class 1 has instances outside `worldEvents.js`. Two, in
one additional file, in the same form.

**Not established:**

- **Extent.** Two files is establishment, not a census. Class 1's prevalence
  across the other 20 `:showId` files is unmeasured.
- **The probe was a floor, not a survey.** `git grep "WHERE id = :"` misses
  `WHERE e.id`, `WHERE id=:` without a space, and multi-line `WHERE` clauses. The
  two hits are real; the absence of others carries no weight.
- **Classes 2–6.** Untested. See §47.7.

### §47.5 The homing question, recorded and not decided

§35.5 ruled class 1 *"OWED. Not F-Stats-1. Not F-AUTH-1 as scoped — every handler
declares `requireAuth` and passes every CP12 grep."* **Both `arcRoutes.js`
handlers declare `requireAuth`.** The homing conclusion is unchanged by this
revision; only the reach precondition has moved.

Three options, recorded so the decision is taken deliberately:

1. **Mint as its own finding class.** New number, new owner, outside the locked
   fix sequence.
2. **Re-scope F-AUTH-1** to cover post-authentication authorization rather than
   authentication alone. F-AUTH-1 is first in the locked sequence and carries a
   six-step recipe; re-scoping it is a fix-cycle change.
3. **Record reach established, defer minting.** *(Taken here.)*

**Option 3 is taken because it is the only one that is not a fix-sequence
decision.** Reach established is a measured result and is cheap to record.
Minting a cross-file authorization class, or widening the keystone that sits
first in the sequence, changes what gets built and in what order. **That decision
is owed a deliberate session and is not taken at the end of this one.**

No ownership is claimed. No FD, PE, or XK number is minted.

### §47.6 Method note — a malformed probe, and the check that caught it

The first class-1 probe was:

```
Select-String -Pattern "sequelize\.query" -Context 0,3 | Select-String -Pattern "show_id" -NotMatch
```

**It cannot answer the question it was built for.** `-Context` emits individual
lines and `-NotMatch` filters lines, not statement blocks. Most of the output was
`type:` declarations and closing braces; the SQL itself sits in multi-line
template literals the filter never examined. A correctly scoped statement would
appear in the output.

Nothing was concluded from it. **This is §43.7's hazard — a probe whose null
result reports its own design rather than the register's contents — reproduced two
revisions after §43.7 recorded it.**

The check that did work was structural rather than textual: reading
`worldStudio.js`'s route declarations established that the file has no show
partition, which disqualified it as a target regardless of what any grep returned.
**Where a probe tests for the absence of a term, the target must first be shown to
be a place that term belongs.**

This joins the accumulated method-hazard set: §28's fixed-width-window and
`Measure-Object -Line` hazards, §36.4's `LIMIT\s*1` probe hazard, §39.5's
prose-population hazard, §40.6's fit-to-authority hazard, §41.5's four, §42.6's
table-beats-prose hazard, §43.7's null-control hazard, §45.6's carve-out-omission
hazard, and §46.4's shape-without-model hazard.

### §47.7 Candidates recorded, none established

**F-AUTH-1 instance — reported, not minted.** `worldStudio.js:2483`:

```
router.post('/world/generate-ecosystem-preview', optionalAuth({ degradeOnInfraFailure: true }), ...)
```

A write route declaring `optionalAuth` — **F-AUTH-1 sub-form (a)**. It is the only
write among 53 routes to do so; all PUTs and DELETEs in the file carry
`requireAuth`. It is also the only site in the file invoking `optionalAuth` with
options rather than as a bare reference, which suggests the degradation was
deliberate.

**F-AUTH-1 already owns this sub-form and needs no reach argument.** Recorded as an
instance report for whoever executes F-AUTH-1; not minted here, and F-AUTH-1's
scope is not assessed.

*Unverified adjacency:* `worldStudio.js` defines a `claude()` helper, and this
route's name implies generation. **Whether this handler invokes it was not read.**
If it does, an unauthenticated request would trigger third-party API spend — which
the repository's Cost Exposure Audit would not catch, since that check tests for
loops and budget configuration rather than auth. **Stated conditionally and not
relied upon.**

**Class 2 candidate — not established.** `opportunityRoutes.js:258`:

```
UPDATE opportunities SET deleted_at = NOW() WHERE id = :id AND show_id = :showId
```

A hand-rolled soft delete — §12.41 / XK-1's subject — outside `worldEvents.js`.
**One line, and its enclosing route was not read.** Suggestive of class 2's reach;
not established. Note the statement is **correctly scoped**, so it is not a class 1
instance.

**Class 5 instance — recorded, reach not claimed.** `arcRoutes.js`'s `/arc/extend`
handler reads `phases` and `progression_log`, mutates both in JavaScript across
~25 lines, and writes them back whole at :209. **Last-write-wins; concurrent
extends silently clobber.** Same shape as `worldEvents.js` 1580. This is the arc
progression path and both columns carry canon.

**Adjacency worth stating:** `arcRoutes.js` is already contested territory. The
audit independently records `arcProgressionService.js:119` hardcoding phase titles,
ranges and `emotional_arc` as JS constants in `seedArc()`, and `/arc/context`
feeding stale `goal_summary` zeros into AI prompts. **The class 1 instances sit on
top of findings the audit already holds against this surface.**

---

## What this revision does not do

- **Does not mint any finding class.** Class 1's reach is established; its homing
  is not decided and no number is issued.
- Does not re-scope F-AUTH-1, or assess its scope.
- Does not survey class 1's extent across the remaining 20 `:showId` files.
- Does not establish reach for classes 2, 3, 4, 5 or 6.
- Does not disposition any statement in `arcRoutes.js`, `worldStudio.js`, or
  `opportunityRoutes.js`. **No file other than `worldEvents.js` is audited.**
- Does not read `opportunityRoutes.js:258`'s enclosing route.
- Does not verify whether `worldStudio.js:2483` invokes `claude()`.
- Does not assess whether `worldStudio.js`'s `optionalAuth` GET routes are
  reachable unauthenticated; mount-level guards in `app.js` were not read.
- Does not pursue the `worldStudio.js` show-partition question at §47.2.
- Does not reopen open items 41 or 23, closed at v1.43.
- Does not resolve §39.4 defect 1 or defect 3.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN and this revision confers no
  authority to touch it.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.44 | 2026-08-13 | **§35.5 finding class 1's reach ESTABLISHED beyond `worldEvents.js`** — two instances in `arcRoutes.js` (:158 in `PUT /world/:showId/arc/phase/:phase`, :209 in `POST /world/:showId/arc/extend`), both the scope-cashed-at-the-write shape recorded at §44.3 for 1837/1910/1911: a scoped `show_arcs` read followed by an `UPDATE ... WHERE id = :id` carrying no scope term, in routes that declare `:showId` and use it for the read. All three tests satisfied — route carries `:showId`, `showId` available and dropped, table show-partitioned. **§35.5's exclusion basis is false as stated for class 1**, and **Cross-Keystone Register §2's exclusion no longer applies to it.** **No finding is minted**: §35.5's homing conclusion is unchanged, since both `arcRoutes.js` handlers declare `requireAuth` exactly as `worldEvents.js`'s do — the class is real, spans files, and has no keystone that owns it. Three options recorded at §47.5; **option 3 taken (record reach, defer minting)** because options 1 and 2 are fix-sequence decisions. **Not established:** extent (two files is establishment, not a census; the grep was a floor), and classes 2–6. **F-AUTH-1 instance reported, not minted:** `worldStudio.js:2483` declares `optionalAuth` on a write — sub-form (a), already owned. **Class 2 candidate** (`opportunityRoutes.js:258` hand-rolled soft delete, correctly scoped, route unread) and **class 5 instance** (`arcRoutes.js` `/arc/extend` whole-JSONB read-modify-write on canon columns) recorded, reach not claimed. **§47.2:** a manufactured class-1 finding was avoided — `worldStudio.js` has no `:showId` in any of 53 routes, so the class cannot apply there; the scoping model was checked before the scoping question was asked. **§47.6 method hazard:** the first probe was malformed (`-Context` emits lines, `-NotMatch` filters lines, SQL sits in multi-line literals) and nothing was concluded from it — §43.7's hazard reproduced two revisions after §43.7 recorded it. Mints no FD. No live DB contact. Prod FROZEN, untouched. §47 minted. Basis `112ea6d1`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.43. Tail: **FD-61**.
- Mints: **§47**.
- Closes: **nothing**.
- Establishes: **§35.5 finding class 1's reach beyond `worldEvents.js`**. Cross-
  Keystone Register §2's exclusion no longer applies to class 1.
- **Mints no finding class, issues no number, claims no ownership.** The homing
  decision is recorded as owed at §47.5 with three options and none taken.
- Reports: an **F-AUTH-1 sub-form (a) instance** at `worldStudio.js:2483`, for
  whoever executes F-AUTH-1. F-AUTH-1's scope is not assessed.
- Records, unestablished: a class 2 candidate (`opportunityRoutes.js:258`); a
  class 5 instance (`arcRoutes.js` `/arc/extend`); the `worldStudio.js`
  show-partition question (§47.2); §47.6's method hazard.
- Carries: open item 22 (unassigned); open item 24 (open); open item 6 (v1.31
  carve-out stands); all other items carried from v1.43. Open items 41 and 23
  remain **CLOSED** per v1.43.
- Defers: class 1's homing and extent; classes 2–6's reach; §39.4 defect 1
  (label-only) and defect 3 (unruled); §44.8 (satisfied for `worldEvents.js`,
  unruled generally); XK-1's remedy and population question.
- Forward-points: `arcRoutes.js` as a surface already carrying independent audit
  findings (`arcProgressionService.js:119`'s hardcoded constants; `/arc/context`'s
  stale `goal_summary`). Recorded, not adopted.
- Changes no unit disposition, no PR state, no gate. `worldEvents.js`'s 112
  dispositions stand unaltered.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.43; no destructive rewrite. §35.5's body is not
  modified; the reach correction lives here.
- **Numeral disambiguation:** *finding class 1 (F-Stats-1 §35.5)* is unrelated to
  any FD-1, §1, or open item 1. §47 is minted in v1.44; section numbers and their
  minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

v1.33 recorded six finding classes and declined to mint any, on the ground that
their reach was established within one file and nowhere else. It named the remedy
in the same breath: *"Establishing reach requires a probe across route files,
which is not attempted here."*

**For class 1, that probe is now run and the reach is established.** Two instances,
one additional file, the same shape — a scope check enforced in a read and dropped
at the write that follows it.

**What has not moved is the homing.** Both `arcRoutes.js` handlers declare
`requireAuth` and would pass every CP12 grep, exactly as `worldEvents.js`'s do.
§35.5's conclusion holds: this is not F-Stats-1's finding, and it is not
F-AUTH-1's as that keystone is scoped. **The class is now measured, cross-file,
and homeless.**

That is the decision this revision leaves on the table rather than taking. Minting
a new class or widening F-AUTH-1 both change what gets built and in what order,
and the locked fix sequence is not something to amend as a session's last act.

**Two files is establishment, not a census.** Twenty `:showId` route files remain
unprobed, and classes 2 through 6 remain where §35.5 left them. What this revision
proves is that the §2 exclusion was load-bearing for class 1 and no longer holds.
What it does not prove is how much is out there.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-13. Main at `112ea6d1` (#1016). Predecessor: v1.43.*
*Minted: §47. Established: finding class 1's reach beyond `worldEvents.js`. Closed: nothing. Mints no finding class, no FD. Tail: FD-61. [skip-automerge]*
