# F-Stats-1 Fix Plan v1.46
*Additive-supersede on v1.45. Mints §49. Ratifies the admission of XK-2 to the Cross-Keystone Register.*

## What changed in v1.46

**XK-2 is MINTED and admitted to the Cross-Keystone Register.**
*Row-scope not enforced in SQL* — a scope parameter present in the route, used
for a read, and dropped at the write that follows it.

**Origin:** §35.5 finding class 1 (v1.33). Reach established at v1.44 §47.3;
exclusion from F-AUTH-1 upheld on categorical grounds at v1.45 §48.4.

**Reach:** F-Stats-1 (`worldEvents.js`) and F-AUTH-1 (`arcRoutes.js`, CP7
cluster).

**Ownership:** OWNED, by this revision. **Fix: UNEVALUATED.**

**All three CKR §2 admission criteria are satisfied** — §49.2.

**A convention gap is recorded and a precedent set** — §49.5. XK-1 was admitted by
the revision that created the register; **XK-2 is the register's first second
entry**, and the mechanics of admitting one were unwritten.

**Extent remains unestablished.** Two files is establishment, not a census. 20 of
the 22 `:showId` route files are unprobed.

---

## §49 — XK-2, minted and admitted

### §49.1 Basis

Basis `055da746` (v1.45, #1018). Cross-Keystone Register read at that
basis; its true length is **133 lines** (see §49.6). **XK-1 confirmed as the live tail** by direct probe; XK-2 is
the next number in the space.

F-AUTH-1 state read at its tail, v2.42. No live database contact. No source file
is read in this revision; the finding's instances were established at v1.44 §47.3
and are cited, not re-derived.

### §49.2 Admission against CKR §2

CKR §2 admits an entry when **all three** hold.

**1. *"Upstream of two or more keystones in the locked sequence, or sits outside
the sequence entirely."* — SATISFIED, first branch.**

| Keystone | Surface | Instances |
|---|---|---|
| F-Stats-1 | `worldEvents.js` | 1837, 1910, 1911, 1229, and the unscoped-statement population at §44.7 |
| F-AUTH-1 | `arcRoutes.js` | :158, :209 (v1.44 §47.3) |

`arcRoutes.js` is enumerated **twice** in F-AUTH-1 v2.37's **CP7 cluster**
(Storyteller + memories, 28 files / ~160 handlers), including in a ~14-file subset
described there as a largest concentration.

*Stated as inference, not fact:* `arcRoutes.js`'s specific tier dispositions were
not read, and CP7's completion is inferred from the backend sweep's closure at
**CP12** rather than from a CP7-specific closure marker. **What is established is
that `arcRoutes.js` lies inside a keystone's enumerated sweep scope and the
instances survive.**

The second branch is also available and is not relied upon: §48.4 established that
neither keystone's category reaches row-level tenancy.

**2. *"Does not resolve by work inside any single keystone."* — SATISFIED.**

- **Not F-AUTH-1.** Its five-tier model governs **which callers may reach an
  endpoint**. `PUT /world/:showId/arc/phase/:phase` is correctly Tier 1 —
  `requireAuth`, a mutation, auth required regardless — and still writes another
  show's arc. **A route can be perfectly tiered and still cross tenants**
  (v1.45 §48.4). Its backend sweep closed at CP12 with the instances intact.
- **Not F-Stats-1.** This keystone converts raw SQL to ORM calls. **An ORM call
  without a scope clause is exactly as unscoped as the SQL it replaces.**
  Conversion neither fixes nor worsens the defect; it is orthogonal to it.
  §44.3 ruled 1837, 1910 and 1229 **WITHDRAW**, so most instances are not even
  converted.

**3. *"A Fix Plan revision ratifies its admission."* — SATISFIED by this
revision.**

**Not excluded.** CKR §2's three exclusions are checked: it is not single-keystone
residue (criterion 1); not a production-environment observation (it is a
source-code defect, and no prod state is asserted); and its reach is **established,
not asserted** — the distinction v1.44 §47.3 exists to make.

### §49.3 The finding

**Mechanism.** A handler destructures `showId` from its route, uses it to scope a
read, and then issues a write keyed on the row id alone. **The tenancy boundary is
enforced once, in JavaScript, and the write trusts that invariant rather than
restating it as a SQL predicate.**

```
SELECT id, phases FROM show_arcs WHERE show_id = :showId AND status = 'active' ...   -- scoped
UPDATE show_arcs SET phases = :phases, updated_at = NOW() WHERE id = :id             -- unscoped
```

**Why it survives every existing check.** Every instance declares `requireAuth`.
Every instance passes F-AUTH-1's CP12 greps, **because CP12 greps auth
declarations and these declarations are correct.** The defect is invisible to a
probe that reads middleware and visible only to one that reads predicates.

**Sub-forms observed.** Recorded at the strength the evidence supports:

| Sub-form | Instances |
|---|---|
| Scope cashed at the write | `worldEvents.js` 1837, 1910, 1911; `arcRoutes.js` :158, :209 |
| Caller-supplied FK written unvalidated | `worldEvents.js` 1229 |
| Route scope parameters entirely unread | `worldEvents.js` 1271, 1605, 1510 (§44.7) |

**Severity, bounded honestly.** Exploitation requires a known row UUID, and none of
the examined handlers provides an enumeration path. **That bounds it; it does not
remove it.** The `arcRoutes.js` instances write `phases` and `progression_log` on
`show_arcs` — canon columns on the arc progression path.

**Not evaluated here:** whether any instance is reachable in practice, whether
prod's data makes it consequential, and what a remedy would look like. **Fix:
UNEVALUATED**, consistent with CKR §5.

### §49.4 What is not established

- **Extent.** Two files. 20 of the 22 `:showId` route files are unprobed, and the
  probe that found `arcRoutes.js` was a floor — `git grep "WHERE id = :"` misses
  `WHERE e.id`, `WHERE id=:` without a space, and multi-line `WHERE` clauses.
- **Whether other keystones' surfaces carry it.** Only F-Stats-1's and F-AUTH-1's
  are demonstrated. F-Ward-1, F-Ward-3, F-Reg-2, F-Franchise-1 and F-Sec-3
  surfaces are unexamined.
- **Prod.** No prod enumeration, consistent with CKR §5. **Prod remains FROZEN and
  this revision confers no authority to touch it.**
- **`arcRoutes.js`'s tier dispositions**, per §49.2's stated inference.

**XK-2's admission does not depend on any of these.** Reach is established at two
keystones; extent is a measurement question that a later revision may answer
without disturbing the entry.

### §49.5 Convention — the register's first second entry

**XK-1 was admitted by the revision that created the register** (v1.31,
2026-08-09). Every mechanic of adding a *further* entry was therefore unwritten.

CKR §6 states: *"Additive-supersede applies. Entries are not edited in place after
merge; corrections prepend a banner and preserve the body."*

**Reading applied here, and recorded as precedent:** §6 governs **existing
entries**, not the admission of new ones. A register whose purpose is to admit
entries must have a means of admitting them; §6 prohibits rewriting what is
already admitted.

Three placements follow, and all three are additive:

| Location | Action |
|---|---|
| §4 entries table | **Insert** XK-2's row after XK-1's |
| After XK-1's detail section | **Insert** XK-2's detail section, before §5 |
| Footer | **Append** a new dated admission line **below** the original; the `Admitted: XK-1` line and its `2026-08-09` date are **left intact** |

**The footer treatment is the deliberate part.** Amending the original line would
edit a merged record; omitting the new line would leave the footer stating the
register holds one entry when it holds two. **Appending preserves the creation
record and states the admission.**

XK-1's entry, its detail section, and the register's §1–§3 and §5–§6 text are
**not modified in any respect.**

### §49.6 Method note

**The CKR's length was misreported and the error mattered.** `Measure-Object -Line` returned 100; the file is **133 lines**, because that cmdlet counts zero for blank lines on piped string input — §28's recorded hazard. Two reads covering 120 lines looked like full coverage against the false count and left an unread 13-line gap, closed only when a later probe reported the true length. **The defect was not a wrong number; it was a false sense of complete coverage.** §6's maintenance clause and the
footer's dated admission line both sit in the final third of the file, and both
determined how this revision writes.

**The live XK tail was probed, not assumed.** A truncated read showing XK-1 is
consistent with XK-1 being the tail and with XK-1 being the first of several; only
a probe over entry headers distinguishes them. Minting XK-2 against a remembered
tail would collide silently.

This joins the accumulated method-hazard set alongside §28's window and
`Measure-Object` hazards, §36.4's probe hazard, §39.5's prose-population hazard,
§40.6's fit-to-authority hazard, §41.5's four, §42.6's table-beats-prose hazard,
§43.7's null-control hazard, §45.6's carve-out-omission hazard, §46.4's
shape-without-model hazard, §47.6's malformed-probe hazard, and §48.2's
declaration-without-rationale hazard.

---

## What this revision does not do

- **Does not evaluate or select a fix.** XK-2's remedy is UNEVALUATED, per CKR §5.
- Does not assess whether any instance is exploitable in practice.
- Does not survey XK-2's extent beyond the two established files.
- Does not examine F-Ward-1, F-Ward-3, F-Reg-2, F-Franchise-1 or F-Sec-3 surfaces
  for instances.
- Does not assess, reopen, or assert anything about F-AUTH-1's execution. **Its
  backend sweep is CLOSED at CP12; its Track G5 remains gated on the prod freeze;
  nothing here bears on either.** `arcRoutes.js` is cited as within CP7's
  enumerated scope, not as an F-AUTH-1 defect.
- Does not read `arcRoutes.js`'s tier dispositions.
- Does not mint a finding class for §35.5's classes 2–6, or establish their reach.
- Does not amend XK-1, its detail section, or CKR §1–§3, §5–§6.
- Does not alter the locked fix-cycle sequence, or assign XK-2 a position in it.
  **Minting is not scheduling** (v1.45 §48.5).
- Does not mint an FD or PE number. **FD numbers are minted only by Fix Plan
  revisions and this revision mints none.**
- Does not lift any gate.
- Does not enumerate prod. **Prod remains FROZEN.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.46 | 2026-08-14 | **XK-2 MINTED and admitted to the Cross-Keystone Register** — *row-scope not enforced in SQL*: a scope parameter present in the route, used for a read, dropped at the write that follows it. **Origin** §35.5 finding class 1 (v1.33); reach established v1.44 §47.3; F-AUTH-1 exclusion upheld on categorical grounds v1.45 §48.4. **Reach:** F-Stats-1 (`worldEvents.js` 1837/1910/1911/1229 and the §44.7 population) and F-AUTH-1 (`arcRoutes.js` :158/:209, enumerated twice in v2.37's CP7 cluster). **OWNED by this revision; fix UNEVALUATED.** All three CKR §2 criteria satisfied and all three exclusions checked — reach is **established, not asserted**. **Not F-AUTH-1:** its five-tier model governs endpoint reachability; `PUT /world/:showId/arc/phase/:phase` is correctly Tier 1 and still writes another show's arc. **Not F-Stats-1:** an ORM call without a scope clause is exactly as unscoped as the SQL it replaces, and §44.3 ruled most instances WITHDRAW anyway. **Why it survives every existing check:** CP12 greps auth declarations and these declarations are correct — the defect is visible only to a probe that reads predicates. Severity bounded: exploitation needs a known row UUID and no examined handler provides an enumeration path. **§49.5 sets precedent** — XK-1 was admitted by the register's creating revision, so admitting a second entry was unwritten mechanics; CKR §6 governs existing entries, not new admissions; the footer gains an **appended** dated line with `Admitted: XK-1` left intact. **Not established:** extent (2 files; 20 of 22 `:showId` files unprobed; the probe was a floor), other keystones' surfaces, prod. Minting is not scheduling; the locked sequence is unchanged. Mints no FD. No live DB contact. Prod FROZEN, untouched. §49 minted. Basis `055da746`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.45. Tail: **FD-61**.
- Mints: **§49**, and **XK-2** (Cross-Keystone Register).
- **Ratifies: XK-2's admission to the Cross-Keystone Register**, per CKR §2
  criterion 3 and CKR §3's rule that XK numbers are minted only by a ratifying
  Fix Plan revision.
- **XK tail: XK-2.** Confirmed live before minting; XK-1 was the tail at basis.
- Closes: **nothing**.
- Records: §49.5's admission-mechanics precedent; §49.6's method note.
- Carries: v1.44 §47.3's reach finding; the class 2 candidate at
  `opportunityRoutes.js:258`; the class 5 instance in `arcRoutes.js`; §35.5's
  classes 2–6, unminted and homing-owed; open items 22, 24, 6; all other items
  carried from v1.45. Open items 41 and 23 remain **CLOSED** per v1.43.
- Defers: XK-2's extent, remedy, and sequence position; classes 2–6's reach;
  §39.4 defect 1 (label-only) and defect 3 (unruled); §44.8 (satisfied for
  `worldEvents.js`, unruled generally); XK-1's remedy and population question.
- Forward-points: `FD31-prod-only-schema-20260601.sql` lists `show_arcs`, so the
  table may sit inside the prod/dev schema divergence F-Deploy-1 recorded.
  Recorded, not adopted, not verified, and **no prod statement is made.**
- Changes no unit disposition, no PR state, no gate. `worldEvents.js`'s 112
  dispositions stand unaltered. **F-AUTH-1's dispositions, tracks and gates are
  untouched.**
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.45; no destructive rewrite. The Cross-Keystone
  Register is **appended to, never rewritten** — XK-1's row, XK-1's detail
  section, and §1–§3 / §5–§6 are unmodified.
- **Numeral disambiguation:** *XK-2 (Cross-Keystone Register)* is unrelated to
  FD-2, PE #2, §2, or any keystone's open item 2. *Finding class 1
  (F-Stats-1 §35.5)* is unrelated to *F-AUTH-1's Tier 1*. **F-AUTH-1 section and
  revision numbers cited here (§5.71, CP7, CP12, v2.37, v2.42) belong to
  F-AUTH-1's register.** §49 is minted in v1.46; section numbers and their
  minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

§35.5 recorded six finding classes at v1.33 and minted none, because their reach
was established in one file and nowhere else. It named what would change that:
*"a probe across route files."* For class 1 that probe ran at v1.44, the reach
held, and the class has had a measured basis and no home for two revisions.

**It has a number now.** XK-2 — *row-scope not enforced in SQL* — owned, with its
remedy unevaluated and its extent unmeasured. That is what the Cross-Keystone
Register is for: **a home and a reader, not a selected fix.**

The reason it needed that register rather than a keystone is worth restating,
because it took two revisions to get right. F-AUTH-1 asks **who may call this
endpoint** and answers it across five tiers. F-Stats-1 asks **how is this
statement expressed** and answers convert or withdraw. **Neither asks which rows
the handler may touch**, and a defect that lives between two correct questions is
invisible to both. `PUT /world/:showId/arc/phase/:phase` passes every check either
keystone applies, and writes another show's arc.

**Five of §35.5's six classes remain unminted and homing-owed**, their reach
established in one file and nowhere else. Class 1 took a probe, a retraction, and
a categorical argument to move. **The others have not been tried.**

XK-2 has a number, not a schedule. Where it sits in the locked sequence — or
whether it sits outside it, as XK-1 does — is a decision this revision leaves
open by design.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-14. Main at `055da746` (#1018). Predecessor: v1.45.*
*Minted: §49, XK-2. Ratified: XK-2's admission to the Cross-Keystone Register. Closed: nothing. Mints no FD. Tail: FD-61. XK tail: XK-2. [skip-automerge]*
