# F-Stats-1 Fix Plan v1.39
*Additive-supersede on v1.38. Mints §42. Corrects v1.38 §41.2. Changes no disposition.*

## What changed in v1.39

**Open item 41's remainder figure is corrected from 45 to 43.** v1.38 recorded
Venue/social's statements at 2560 and 2626 as outstanding. **They were
dispositioned at v1.33 §35.2**, which carries a Venue/social disposition table in
the same format as every reconciling group — per-handler line, statement count,
injection verdict, non-injection findings. v1.38 read §35.4's prose about the
group's count defect and did not read §35.2's table for it.

**Corrected reconciliation at §42.3 returns 69 dispositioned / 43 outstanding**,
summing to 112.

**Venue/social's outstanding count is 1, not 3.** Its five statements are 2560
(1) and 2626 (1) dispositioned at v1.33, 3825 (2) dispositioned at v1.14, and one
orphan. §28's *"less the 2 already dispositioned"* refers to 3825 — correctly
located at v1.38 — but v1.38 then failed to also subtract the two dispositioned at
v1.33.

**A group may fail to reconcile against a total and still have its measured
statements dispositioned.** §35.4's `DOES NOT RECONCILE` is a count defect
against §28's group total. It is not a withheld disposition. v1.38 conflated the
two.

**v1.33's own "22 statements" figure is defective in two compensating
directions** — §42.4. Its §35.2 rows sum to 23.

**§39.4 defect 1 is now disposition-neutral as well as count-neutral** — §42.5.
The two outstanding orphan statements are identified: 2846 and 3764. Only their
group labels are undetermined.

**§41.1's stated dependency is DISCHARGED.** §35.2's Stories (2), Distribution
(3) and Financial (10) headers are row-summed at this revision and all three
reconcile. **Outfit remains the only §35.2 header that exceeds its rows.**

---

## §42 — Venue/social's dispositions, and the corrected remainder

### §42.1 Basis

Basis `b250161c` (v1.38, #1011). Source- and register-derived via
`git show origin/main:`. Censuses are v1.37 §40.1's, unchanged and not re-run.

### §42.2 What §35.2 actually contains

§35.2's opening states: *"Five groups dispositioned: Stories, Distribution,
Outfit, Venue/social, Financial."* **Venue/social is named among the
dispositioned groups.**

Its table:

| Line | Handler | Stmts | Injection |
|---|---|---|---|
| 2560 | `POST .../generate-venue` | 1 | CLEAN |
| 2626 | `POST .../generate-social-checklist` | 1 | CLEAN |

Both rows carry injection verdicts and non-injection findings in the same format
as Stories, Distribution, Outfit and Financial. 2626 is characterised in the
surrounding prose as *"the strongest single instance in the pass"* — a
scope check present on the raw path and lost on the model fallback. **That is
disposition work, not a deferral.**

The header reads *"2 statements measured. DOES NOT RECONCILE. See §35.4."* The
non-reconciliation is against **§28's group total of 5**, and §35.4 says so
explicitly: §28 implies 3 remain, measurement returns 2. The defect is in the
count, not in the disposition of what was counted.

**All three §35.2 headers flagged as unverified at v1.38 §41.1 are row-summed at
this revision:**

| Group | Header | Rows | |
|---|---|---|---|
| Stories | 2 | 3520 (1) + 3538 (1) | 2 ✓ |
| Distribution | 3 | 3585 (1) + 3605 (1) + 3638 (1) | 3 ✓ |
| Financial | 10 | 2219 (2) + 2252 (1) + 2278 (4) + 2352 (2) + 3730 (1) | 10 ✓ |
| Venue/social | — | 2560 (1) + 2626 (1) | 2 |
| Outfit | 7 | 2675 (1) + 2697 (3) + 2776 (2) | **6** |

Financial's five rows also match §28's enumerated non-contiguous members exactly.
**§41.1's dependency is discharged; Outfit remains the sole divergence.**

### §42.3 Corrected reconciliation

| Dispositioned | Source | Stmts |
|---|---|---|
| Core CRUD | §16.1 (v1.14) | 21 |
| Overlays — 7 of 9 handlers | §16.2 (v1.14) | 23 |
| Venue/social — `next-suggestions` (3825) | §16.2 (v1.14), early | 2 |
| Stories | §35.2 (v1.33) | 2 |
| Distribution | §35.2 (v1.33) | 3 |
| Outfit — three enumerated rows | §35.2 (v1.33) | 6 |
| **Venue/social — 2560, 2626** | **§35.2 (v1.33)** | **2** |
| Financial | §35.2 (v1.33) | 10 |
| **Dispositioned** | | **69** |

| Outstanding | Stmts |
|---|---|
| Episode generation | 15 |
| Invitations | 23 |
| Overlays — 2 pending handlers | 3 |
| Outfit — orphan | 1 |
| **Venue/social — orphan** | **1** |
| **Outstanding** | **43** |

**69 + 43 = 112.**

Group membership now closes on both ambiguous groups:

- **Outfit (4 handlers / 7):** 2675, 2697, 2776 dispositioned = 6; one orphan.
- **Venue/social (4 handlers / 5):** 2560, 2626, 3825 dispositioned = 4; one
  orphan.

### §42.4 v1.33's "22" is defective in two compensating directions

v1.33 states *"22 statements"* for its five dispositioned groups. **Its own rows
sum to 23**: Stories 2 + Distribution 3 + Outfit 6 + Venue/social 2 + Financial
10.

The 22 is reconstructible as **2 + 3 + 7 + 10** — Outfit's *header* (7) in place
of its rows (6), and Venue/social omitted entirely. **+1 and −2, netting −1.**
v1.36 §39.1's composition table reproduces exactly this derivation, which is the
basis for stating it rather than hypothesising it.

v1.33 is therefore internally inconsistent on a second point: its opening names
Venue/social among the five dispositioned groups, and its Forward Statement places
*"Venue/social's unreconciled remainder"* inside the 41 outstanding. **The same
two statements are on both sides of its own ledger.** Every revision from v1.33
to v1.38 inherited one side or the other and none compared them.

Nothing in v1.33's disposition work is disturbed. Its tables are sound. **The
defect is in its summary arithmetic, twice, in directions that partly cancelled
and so escaped notice for six revisions.**

### §42.5 Defect 1 is disposition-neutral

The two orphan statements are **2846** (in handler 2836) and **3764** (in handler
3756). One belongs to Outfit and one to Venue/social; §39.4 defect 1 is the
question of which.

| Assignment | Outfit orphan | V/S orphan | Outstanding |
|---|---|---|---|
| Outfit = 2836, V/S = 3756 | 2846 | 3764 | 2 |
| Outfit = 3756, V/S = 2836 | 3764 | 2846 | 2 |

**Both statements are outstanding under either assignment.** Defect 1 determines
which group label attaches to each. It does not determine the count (v1.38
§41.4), and it does not determine *which statements need dispositioning* — both
do, and both are identified by line.

Defect 1 can be left open through the disposition of all 43 without affecting any
of it. Its resolution is a labelling question owed a ruling on group-constitution
criteria, per v1.38 §41.4 and v1.33 §35.4's failed route-path attempt.

### §42.6 Method note — a table beats prose about the table

v1.38 established Venue/social's outstanding count from §35.4, a section whose
subject is the group's **count defect**. §35.2, whose subject is the group's
**disposition**, was in the same document, forty lines earlier, and carries the
table.

§35.4's closing line — *"Recorded so that no downstream document reads
Venue/social as closed at 3"* — is a warning against over-reading the total. v1.38
under-read the disposition instead, which the warning does not cover and which
reading §35.2 would have prevented.

**Where a document contains both a table and prose discussing that table, the
table is the source.** This is §41.5 hazard 3 (*grep fragments are not source*)
one layer up: a section is not a substitute for the section it cites, even inside
the same file.

The compounding is worth recording plainly. v1.36 corrected v1.35's denominator;
v1.37 asserted a remainder it had not measured; v1.38 corrected the remainder and
inherited v1.33's unexamined side; v1.39 corrects that. **Four consecutive
revisions on one figure, each correcting its predecessor and each introducing or
inheriting one further defect.** The register's additive-supersede convention has
absorbed this without loss, which is the convention working as designed — but the
rate is itself a finding about the method, not only about the figure.

---

## What this revision does not do

- Does not disposition any statement. **43 remain outstanding.**
- Does not resolve §39.4 defect 1 or defect 3.
- Does not rule on group-constitution criteria.
- Does not disturb any v1.33 §35.2 disposition. Its tables are read, not altered.
- Does not correct v1.33's body. Its summary arithmetic is recorded as defective
  at §42.4 by additive-supersede; v1.33 is not rewritten.
- Does not re-run the statement or handler censuses; v1.37 §40.1's stand.
- Does not open Episode generation or Invitations.
- Does not close open item 41, or alter its closure condition beyond its figure.
- Does not rule on item 23's register status. That remains disputed per v1.38 and
  is owed a dedicated revision.
- Does not mint any finding class, or assert reach beyond `worldEvents.js`.
- Does not disposition the `character_key` split at §35.6 / §12.35. F-Sec-3's
  surface, queued last in sequence.
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

| v1.39 | 2026-08-13 | **Open item 41's remainder figure corrected 45 → 43.** v1.38 recorded Venue/social's 2560 and 2626 as outstanding; **§35.2 carries a Venue/social disposition table** and names the group among its five dispositioned, in the same per-handler format as every reconciling group. §35.4's `DOES NOT RECONCILE` is a count defect against §28's total of 5, not a withheld disposition; v1.38 conflated the two. Corrected reconciliation: **69 dispositioned / 43 outstanding = 112.** V/S outstanding is **1**, not 3: 2560 and 2626 dispositioned at v1.33, 3825 (2) at v1.14, one orphan. Outstanding is Ep. generation 15, Invitations 23, Overlays pending 3, Outfit orphan 1, V/S orphan 1. **v1.38 §41.2 superseded.** **§41.1's dependency DISCHARGED** — Stories (2), Distribution (3), Financial (10) all row-summed and reconciling; Financial's rows match §28's enumerated non-contiguous members; Outfit remains the sole header/row divergence. **v1.33's own "22" recorded defective** at §42.4: rows sum to 23, and 22 = 2+3+**7**+10 uses Outfit's header for its rows and omits V/S — +1 and −2, netting −1; v1.33 places the same two statements among its dispositioned groups and inside its 41 remainder. **§39.4 defect 1 now disposition-neutral as well as count-neutral** — the orphans are 2846 and 3764, both outstanding under either assignment; only the labels are undetermined. Defect 3 untouched. Method note at §42.6. Mints no FD. No live DB contact. Prod FROZEN, untouched. §42 minted. Basis `b250161c`. |

## Register hygiene

- **Mints no FD**, consistent with F-Stats-1 practice v1.1–v1.38. Tail: **FD-61**.
- Mints: **§42**.
- Closes: **nothing**.
- Corrects: **v1.38 §41.2** (reconciliation superseded; figure 45 → 43).
- Discharges: **v1.38 §41.1's stated dependency**.
- Records: **v1.33's summary arithmetic defect** (§42.4), unowned, no ruling
  sought.
- Carries: **open item 41** (OPEN, figure corrected to 43, closure condition
  otherwise unchanged, denominator 112); open item 6 (v1.31 carve-out stands);
  all other items carried from v1.38.
- Notes: **item 23's register status remains disputed**, per v1.38. This
  revision's arithmetic does not depend on it and it is owed a dedicated ruling.
- Defers: §39.4 defect 1 (open, count- and disposition-neutral, unowned); §39.4
  defect 3 (unruled); XK-1's remedy; the XK-1 population question.
- Forward-points: nothing new. v1.35's §29 write hazard and
  `scripts/migrations/` hardcoded-fallback class remain forward-pointed and
  unowned; v1.37 §40.7's observations remain recorded, not adopted.
- Changes no unit disposition, no PR state, no group disposition. Unit 19's
  withdrawal stands. §16.1, §16.2 and §35.2's dispositions are read, not altered.
- Does not evaluate any fix, does not lift any gate, does not enumerate prod.
- **No live database contact. No prod-box contact. No dev-box contact.** Prod
  remains FROZEN.
- Additive-supersede on v1.38; no destructive rewrite. v1.38's body is not
  modified; §41.2's correction lives here.
- **Numeral disambiguation:** *open item 41 (F-Stats-1)* is unrelated to *FD-41
  (F-Deploy-1)* and to any §41. Its figure is now 43; the item number is not
  renumbered, per v1.38 §41.6. §42 is minted in v1.39; section numbers and their
  minting revision numbers do not correspond.
- FD-21 check: no closing keywords adjacent to `#N`.
- Ships WITH `[skip-automerge]` (doc-only PR).

## Forward Statement

The figure has moved four times in four revisions: 41 (inherited), 41
(reasserted), 45, 43. Each move was a real correction and each rested on reading
one document the predecessor had not read. **The figure was never measured; it
was inherited, and every revision that touched it found the previous one short.**

43 is the first value derived from every disposition table in the corpus —
§16.1, §16.2, and all five of §35.2's — rather than from a predecessor's summary.
That is the difference in kind, and it is the reason to expect this one to hold.

`worldEvents.js` disposition is PARTIAL: **69 of 112 dispositioned, 43
outstanding** — Episode generation 15, Invitations 23, Overlays pending 3, Outfit
orphan 1, Venue/social orphan 1. Six finding classes remain unminted and
homing-owed; finding class 1 remains outside F-AUTH-1 as scoped.

**Episode generation and Invitations account for 38 of the 43**, are contiguous,
and are unambiguous in membership. They are the executable surface. The remaining
5 are three named Overlays statements and two identified orphans at 2846 and
3764. Nothing outstanding is unlocated.

---

*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-08-13. Main at `b250161c` (#1011). Predecessor: v1.38.*
*Minted: §42. Closed: nothing. Corrected: v1.38 §41.2; open item 41's figure 45 → 43. Discharged: v1.38 §41.1's dependency. Mints no FD. Tail: FD-61. [skip-automerge]*
