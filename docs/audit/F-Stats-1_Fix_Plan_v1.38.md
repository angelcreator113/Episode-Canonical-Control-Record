# F-Stats-1 Fix Plan v1.38
*Additive-supersede on v1.37. Mints §41. Corrects v1.37 §40.3. Changes no disposition.*

## What changed in v1.38

**Open item 41's remainder figure is corrected from 41 to 45.** The 41 omits two
populations that were each named on the register and then not carried into the
sum: §16.2's two pending Overlays handlers (3 statements) and Outfit's
unenumerated fourth row (1 statement). Full disposition reconciliation at §41.2
returns **67 dispositioned / 45 outstanding**, summing to 112.

**v1.37 §40.3's phrase "§35.7's remainder confirmed at source" is withdrawn.**
What v1.37 confirmed at source was the nine **group totals**. A remainder is not
a group total; it requires per-statement disposition status, which v1.37 did not
read. The claim exceeded its evidence and is corrected here.

**§39.4 defect 2 remains CLOSED, and its referent is now located.** v1.37 closed
it by arithmetic over-determination without finding what §28's phrase *"less the
2 already dispositioned"* referred to. It refers to §16.2's early disposition of
`GET /events/next-suggestions` (3825, 2 statements, Venue/social group), taken at
v1.14 because that handler carries §12.35's `'justawoman'` site. The closure
stands on better ground than it was made on.

**§39.4 defect 1 remains OPEN and is now recorded as count-neutral.** Under both
admissible assignments Outfit carries exactly 1 outstanding statement and
Venue/social exactly 3. Only the labels are undetermined. **Defect 1 does not
gate disposition of the 45.**

**§39.4 defect 3 (site 570) remains untouched.**

Method hazards from this session are recorded at §41.5.

---

## §41 — the remainder, reconciled statement by statement

### §41.1 Basis and dependency

Basis `fd106d45` (v1.37, #1010). Source- and register-derived via
`git show origin/main:`. Statement and handler censuses are v1.37 §40.1's,
unchanged and not re-run.

**One stated dependency.** §35.2's dispositioned counts for Stories (2),
Distribution (3) and Financial (10) are taken at their section headers. Only
Outfit's header/row divergence was surfaced at §39.4; the others were not
independently row-summed at this basis or at v1.36's. Outfit demonstrates that a
§35.2 header can exceed its enumerated rows. **If another §35.2 header diverges
from its rows, the 67/45 split moves.** The 112 does not.

### §41.2 Disposition reconciliation

| Dispositioned | Source | Stmts |
|---|---|---|
| Core CRUD | §16.1 (v1.14), 5 convert / 16 withdraw | 21 |
| Overlays — 7 of 9 handlers | §16.2 (v1.14), 13 convert / 10 withdraw | 23 |
| Venue/social — `next-suggestions` (3825) | §16.2 (v1.14), early, both convert | 2 |
| Stories | §35.2 (v1.33) | 2 |
| Distribution | §35.2 (v1.33) | 3 |
| Financial | §35.2 (v1.33) | 10 |
| Outfit — three enumerated rows (2675, 2697, 2776) | §35.2 (v1.33), 1 / 3 / 2 | 6 |
| **Dispositioned** | | **67** |

| Outstanding | Stmts |
|---|---|
| Episode generation | 15 |
| Invitations | 23 |
| Venue/social — remainder | 3 |
| **Overlays — 2 pending handlers** | **3** |
| **Outfit — unenumerated fourth row** | **1** |
| **Outstanding** | **45** |

**67 + 45 = 112.**

### §41.3 The two omitted populations

**§16.2's pending handlers — 3 statements.** §16.2's title is
`DISPOSITIONED (2 handlers pending)`. Its table marks
`PUT /:eventId/overlay-selections` (1 statement) and
`POST /:eventId/reject-overlay` (2 statements) as `pending`, and its subtotal row
reads **"Subtotal (7 dispositioned) — 23"**. Overlays is 26 at §28 and 26 at
v1.37 §40.2's census; 23 are dispositioned and **3 are not**.

The carve-out was not lost. v1.14's open-items section names it — *"Plus two Overlays
handlers"*. v1.36's history row states it was *"carried forward into item 41's
accounting."* It was named in the prose and omitted from the sum.

**Outfit's fourth row — 1 statement.** §35.2's Outfit header reads 7; its rows
enumerate 2675 (1), 2697 (3), 2776 (2) = 6. §28 records the group at 4 handlers /
7 statements and v1.37 §40.4 eliminated the undercount branch: each row is
individually correct at source. A fourth handler's statement exists, is not on
§35.2's table, and **was therefore never dispositioned.**

### §41.4 Defect 1 is count-neutral

The unassigned pool after the seven unambiguous groups and 3825's known
membership is {2836, 3756} — one statement each. Outfit requires one; Venue/social
requires the other.

| Assignment | Outfit outstanding | V/S outstanding |
|---|---|---|
| Outfit = 2836, V/S = 3756 | 1 | 3 |
| Outfit = 3756, V/S = 2836 | 1 | 3 |

**The outstanding count is 4 either way**, and the 45 holds under both. Defect 1
determines which group label attaches to one statement. It does not determine how
many statements are outstanding, and it does not block dispositioning them.

v1.37 §40.4's conclusion — *the next move is a ruling, not a count* — is
strengthened, not weakened: v1.33 §35.4 records that **no third Venue/social
handler was identifiable by route path** in the 61-handler enumeration. Route-path
identification was attempted at v1.33 and failed. The criterion question is real.

### §41.5 Method notes

**1. A group total is not a remainder.** v1.37 verified nine group totals against
§28 and reported §35.7's remainder as confirmed. The censuses it ran cannot see
disposition status; they count statements in a file. Confirming a total says
nothing about how much of it is dispositioned. This is §39.5's mechanism —
*a count stated in prose is not a measurement* — in a new position: **a
measurement of the wrong quantity is not a measurement of the right one.**

**2. A carve-out named in prose is not a carve-out carried in arithmetic.**
§16.2's pending handlers were named at v1.14, at v1.36, and in
between. The figure never changed. Naming an exception in a sentence adjacent to
a sum does not apply it to the sum.

**3. Grep fragments are not source.** During this session two fragments from
v1.33 — *"Venue/social as closed at 3"* and *"handler was identified by route
path"* — were read from `git grep` output as positive claims. Both are the tails
of negations: *"Recorded so that no downstream document reads Venue/social as
closed at 3"* and *"**No** third Venue/social handler was identified by route
path."* An inversion was asserted on that basis and withdrawn on reading the
section. **A grep line is a pointer to a section, not a substitute for it.**

**4. Assertion outpacing inputs.** Three successive corrected remainder figures
were stated in this session before the inputs supporting them were read — each
one input short of complete. The failure is not arithmetic; it is publishing a
sum while an addend is still unread.

These join §28's fixed-width-window hazard, §28's `Measure-Object -Line` hazard,
§36.4's `LIMIT\s*1` probe hazard, §39.5's prose-population hazard, and §40.6's
fit-to-authority hazard in the accumulated method-hazard set.

### §41.6 Numeral disambiguation — a collision that has now broken

**Open item 41 is not renumbered.** Its identifier is its position in the register
(open items were minted sequentially from 22–24 at v1.14); it remains **open item
41**. What is corrected is the *figure* it carries, from 41 statements to 45.

The coincidence of the item number and its former figure was accidental and has
been a standing read hazard. **It no longer holds**, which is a net gain in
legibility: *open item 41* now unambiguously denotes the item, and *45* the
remainder.

*Open item 41 (F-Stats-1)* remains unrelated to *FD-41 (F-Deploy-1)* and to
*§41 (F-Stats-1, minted here in v1.38)*. Section numbers and their minting
revision numbers do not correspond: §41 is in v1.38, §40 is in v1.37, §28 is not
in v1.28, §16 is not in v1.16.

---

## What this revision does not do

- Does not disposition any statement. **45 remain outstanding.**
- Does not resolve §39.4 defect 1 or defect 3.
- Does not rule on group-constitution criteria.
- Does not row-sum §35.2's Stories, Distribution, or Financial tables. See §41.1.
- Does not re-run the statement or handler censuses; v1.37 §40.1's stand.
- Does not open Episode generation or Invitations.
- Does not close open item 41, or alter its closure condition beyond its figure.
- Does not mint any finding class, or assert reach beyond `worldEvents.js`.
- Does not disposition the `character_key` split at §35.6 / §12.35. F-Sec-3's
  surface, queued last in sequence. Note that §16.2's early disposition of 3825
  was taken *because* of that site and converts it literal verbatim; this
  revision does not disturb that.
- Does not draw the XK-1 population conclusion, still deferred.
- Does not evaluate XK-1's remedy, or touch F-Ward-1 or F-Ward-3.
- Does not mint an FD, PE, or XK number.
- Does not lift any gate. Decision #9's gate on F-Stats-1 Phase B was satisfied by
  F-Deploy-1's closure at its v1.48, independently of this revision.
- Does not bear on `deploy-dev.yml` trigger state, which remains a gated decision
  under the 2026-06-27 AllStopped authority.
- Does not enumerate prod. **Prod remains FROZEN and this revision confers no
  authority to touch it.**
- **No live database contact. No prod-box contact. No dev-box contact.**

---

## §11 Plan Version History (UPDATED)

| v1.38 | 2026-08-13 | **Open item 41's remainder figure corrected 41 → 45.** Full disposition reconciliation returns 67 dispositioned / 45 outstanding = 112. The 41 omitted two named-but-uncarried populations: §16.2's two pending Overlays handlers (`overlay-selections` 1, `reject-overlay` 2 = 3 statements; §16.2's subtotal is 7 dispositioned / 23 against a group of 26) and Outfit's unenumerated fourth row (1 statement, never on §35.2's table). Outstanding is Ep. generation 15, Invitations 23, Venue/social 3, Overlays pending 3, Outfit orphan 1. **v1.37 §40.3's "remainder confirmed at source" WITHDRAWN** — v1.37 verified group totals, which cannot establish disposition status. **§39.4 defect 2 stays CLOSED with its referent now located**: §28's "less the 2 already dispositioned" is §16.2's early disposition of `next-suggestions` (3825, 2 statements, V/S group, taken at v1.14 for §12.35's `'justawoman'` site). **§39.4 defect 1 stays OPEN, recorded count-neutral** — both admissible assignments give Outfit 1 outstanding and V/S 3; it does not gate disposition. Defect 3 untouched. Open item 41 **not renumbered**; the item-number/figure collision has broken. Four method hazards at §41.5. One stated dependency at §41.1: §35.2's Stories/Distribution/Financial headers not row-summed. Mints no FD. No live DB contact. Prod FROZEN, untouched. §41 minted. Basis `fd106d45`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.37. Tail: **FD-61**.
- Mints: **§41**.
- Closes: **nothing**.
- Corrects: **v1.37 §40.3** (remainder claim withdrawn; figure 41 → 45).
- Carries: **open item 41** (OPEN, figure corrected to 45, closure condition
  otherwise unchanged, denominator 112); open item 6 (v1.31 carve-out stands);
  all other items carried from v1.37.
- Notes: **item 23's register status is disputed at this revision.** The
  §16.2/Overlays exception is carried as a prose referent and arithmetic term in
  this revision, but it does not depend on the item-23 status question. That
  status is owed a dedicated ruling in a separate revision.
- Defers: §39.4 defect 1 (open, count-neutral, unowned); §39.4 defect 3
  (unruled); XK-1's remedy; the XK-1 population question; §35.2 row-summing per
  §41.1.
- Forward-points: nothing new. v1.35's §29 write hazard and
  `scripts/migrations/` hardcoded-fallback class remain forward-pointed and
  unowned; v1.37 §40.7's cross-file reach and fallback-shape observations remain
  recorded, not adopted.
- Changes no unit disposition, no PR state, no group disposition. Unit 19's
  withdrawal stands. §16.1, §16.2 and §35.2's dispositions are read, not altered.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.37; no destructive rewrite. v1.37's body is not
  modified; §40.3's withdrawal lives here.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

The 41 held across five revisions for the same reason the 63 did: each revision
took it from the one before, and the exceptions to it were carried as sentences
rather than as terms in a sum. §16.2's carve-out was never lost — it was written
down at v1.14, restated at v1.36, and added to nothing.

**A named exception that is never applied is indistinguishable from an exception
that was never noticed**, and the register cannot tell them apart at a distance.
Every figure in this plan that carries an exception in adjacent prose is a
candidate for the same defect.

`worldEvents.js` disposition is PARTIAL: **67 of 112 dispositioned, 45
outstanding** — Episode generation 15, Invitations 23, Venue/social 3, Overlays
pending 3, Outfit orphan 1. Six finding classes remain unminted and homing-owed;
finding class 1 remains outside F-AUTH-1 as scoped.

Episode generation and Invitations are contiguous, unambiguous in membership, and
account for 38 of the 45. **They are the executable surface.** Defect 1 touches
one statement and gates nothing.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-13. Main at `fd106d45` (#1010). Predecessor: v1.37.*
*Minted: §41. Closed: nothing. Corrected: v1.37 §40.3; open item 41's figure 41 → 45. Mints no FD. Tail: FD-61. [skip-automerge]*
