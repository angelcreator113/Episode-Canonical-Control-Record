> **BANNER — RULING 1'S PROVENANCE IS PARTIAL, NOT FULL** (added
> 2026-09-03, additive). §6 Ruling 1's Rationale contains two clauses
> whose wording originated with the drafting session rather than with
> Evoni: the classification of the itemized audit as a `v27` Sec 6.B
> register entry (not an FD), and its framing as owed pending explicit
> authorization rather than sitting in the default task loop. Evoni
> approved the assembled text; the clauses were not composed by her. The
> remainder of Ruling 1 — the discharge itself and its distinguishing
> sentences — is her own composition. Rulings 3, 4, and 5 were verified
> against the record and carry no such clauses; Ruling 2's own disclosure
> is unchanged. This banner applies the same test as that disclosure:
> wording that originated session-side is labeled, regardless of who
> approved it. This document's landing issue (#1210) stated that Rulings
> 1, 3, 4, and 5 were Evoni's own words, given directly — accurate for 3,
> 4, and 5; incorrect for Ruling 1's two clauses. Noted here because the
> issue itself is not a register document and cannot be corrected by
> amendment. This banner points; it does not carry. The Rationale text is
> unedited.

| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT** *Discharges limb 1. Closes FD-64. Closes PE #65. Leaves FD-67 open on a named gap. Declines to mint FD-70.* |
| --- |

**Document version**

**v2.69 — FIX PLAN REVISION. Mints nothing. Closes two items, discharges
one gate-limb, leaves one open on a named gap, declines to mint one
number.** This document lands the five rulings recorded at
`F-AUTH-1_Fix_Plan_v2.69_SCAFFOLD.md` §6, filed by Evoni. **The register
tail moves from `v2.68` to `v2.69` as of this filing.**

**Predecessor:** `F-AUTH-1_Fix_Plan_v2.68.md`. **v2.68's five definitional
rulings stand and are not re-ruled here** — this document acts on their
result (limb 1 as v2.68 defined it: a unit, a population, a judgment
definition, a decomposition) rather than re-deriving any of them. **What
v2.69 supersedes:** v2.68's own status line, which recorded "Limb 1 remains
OPEN. This revision defines it; it does not perform it" — limb 1 has since
been performed (12/12 CPs) and is discharged here. **What stands
unchanged:** the `~700` work-estimate withdrawal (v2.68 §6), the CP1–CP12
population definition (v2.68 §3), and every dimension disposition carried
via `Prime_Studios_Audit_Handoff_v26.md` Sec 3 (Dimensions 1–5 unchanged by
this revision).

**Basis:** `origin/main` at `5e52daf5de943e014026585e029106bd107edc82`,
2026-09-03.

```
$ ls docs/audit | grep -E '^F-AUTH-1_Fix_Plan_v[0-9.]+' | sort -V | tail -3
F-AUTH-1_Fix_Plan_v2.67.md
F-AUTH-1_Fix_Plan_v2.68.md
F-AUTH-1_Fix_Plan_v2.69_SCAFFOLD.md
```

No `F-AUTH-1_Fix_Plan_v2.69.md` (the SCAFFOLD does not count — different
filename) existed on `main` before this document. `v2.68` was the newest
Fix Plan revision; this document supersedes it as tail.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.
**Rulings by Evoni**, filed at the scaffold and transcribed verbatim below
— see §6.

**Status**

**Revision. Rules five items, on Evoni's word.** Limb 1 **DISCHARGED**.
FD-64 **CLOSED**. PE #65 **CLOSED**. FD-67 remains **OPEN/P2** — remedy
implemented and tested, one named gap outstanding (FD-68/FD-65 severity
adjudication). FD-70 **not minted**. FD tail remains **FD-69** (FD-70
next-available, unminted); XK tail **XK-3**; PE tail **PE #68**. Prod
**FROZEN**.

---

# §1. Keystone and G3 state, after this revision

**F-AUTH-1: REOPENED-QUALIFIED.** Gate G3 **PARTIALLY DISCHARGED, OPEN**
(limb 3 still open; G4 not enterable).

| part | state | source |
|---|---|---|
| Limb 1 | **DISCHARGED**, this revision (§6 Ruling 1). 12/12 CPs confirmed, 127 recorded dispositions (120 agree, 2 disagree, 5 cannot-tell). The 2 disagree rows are resolved as documentation errors, not minted (§6 Ruling 5). The 5 cannot-tell rows are accepted as unconfirmed under the confirm-not-re-derive method, not left pending under it; an itemized audit that could settle them under a different instrument is owed separately (§7 item 1), and does not block this discharge. | CP1–CP12 confirmations; `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md`; this document §6 Ruling 1 |
| Limb 3 | open; ASSESSMENT NOT COMPLETED, unchanged | `v2.61`–`v2.68`, carried via v26 Sec 3 |
| G4 | never entered; not enterable, unchanged | carried |
| Dimension 1 | PASS — carried historical, unchanged | `v2.60`, per `v25_Owed_Index_Amd10_2026-08-27.md` §J3 |
| Dimension 2 | PASS — current at `v2.60` basis, unchanged | `v2.61` |
| Dimension 3 | NOT PERFORMED — current, unchanged | `v2.68` |
| Dimension 4 | FAIL — carried historical, unchanged | `v2.61`, per Amd10 §J3 |
| Dimension 5 | NOT PERFORMED — current, unchanged | `v2.61` |

**This revision does not enter G4.** Discharging limb 1 closes one of G3's
components; limb 3 remains open and no dimension disposition changes here.

FD-68 vs FD-65 severity interaction: **unadjudicated**, unchanged — the
named gap keeping FD-67 open (§6 Ruling 3).

---

# §2. Register tails, re-derived with both instruments

**Onboarding §4 rule 4, both instruments, re-run at this basis:**

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ for f in v2.66 v2.67 v2.68; do
    echo "$f: $(grep -oE 'FD-[0-9]+' docs/audit/F-AUTH-1_Fix_Plan_$f.md | sort -t- -k2 -n -u | tail -1)"
  done
v2.66: FD-68
v2.67: FD-69
v2.68: FD-69

$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md
56:### XK-1 — `paranoid` exposure
207:### XK-2 — row-scope not enforced in SQL
288:### XK-3 — no authorization substrate for the tenancy root

$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -3
66
67
68
```

**Unchanged from the scaffold.** Both FD instruments agree at FD-69. FD
tail **FD-69** (retired). **FD-70 remains next-available and unminted** —
this revision's Ruling 5 (§6) declines to mint it. XK tail **XK-3**. PE
tail **PE #68**.

---

# §3. Shipping evidence for the closed items

**Carried from the scaffold, re-verification not repeated — the SHAs and
path did not change between the scaffold's basis and this one.**

- **FD-64** — `65cbe7013` (PR #1186): `getRolesForShow` typo fix and
  `AssetRole` model registration. `2e5dbdf28` (PR #1187): `AssetRoleService`
  missing `where` clause. Neither commit is mentioned in `v2.68`.
- **FD-67** — `7a1eb427c` (PR #1185) implements
  `F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md`'s Option 1.
  `F-AUTH-1_FD67_Remedy_Implementation_2026-09-02.md` §7.5 states the
  remedy is "implemented" and "tested," and names FD-68/FD-65 severity
  adjudication as the specific remaining gap — see §6 Ruling 3.
- **PE #65** — `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` supplies
  the ordered execution sequence `F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md`
  §5 named as the missing piece of its closing criterion — see §6 Ruling 4.

---

# §4. The two CP6 disagrees — resolved

Both in `src/routes/universe.js`. Row 11 (Tier 1 writes,
`universe.js:46,76,87,99,124`) records 4, the five cited lines are five
`requireAuth` writes. Row 12 (Tier 4 GETs, `universe.js:36,61,111`) records
4, the three cited lines are three `optionalAuth` GETs. **5 + 3 = 8, the
same total as the recorded 4 + 4** — a split error, not a count or Tier
error; neither row implies a handler is under-protected or mis-assigned.
**Ruled at §6 Ruling 5: not minted, no further action.** Full detail at
`F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` §3.

---

# §5. What the five cannot-tells are, and are not

**Carried forward because §6 Ruling 1 depends on this being stated
plainly, not pointed at.** All five `cannot-tell` verdicts across the
twelve limb 1 CPs are aggregate figures over an unitemized remainder — a
recorded count with no file or line named for any of it. **None names an
address a `git show` could check.** This is a property of the method
applied to an aggregate disposition, not a property of any individual CP's
confirmation pass: a pass confirming per-address claims can return `agree`
or `disagree`; a pass confirming an aggregate class total has nothing to
check the total against except a re-derivation. **Ruling 1 (§6) accepts
this as the five's permanent status under this method, not as a reason to
withhold discharge.**

---

# §6. The five rulings

**Filed by Evoni at `F-AUTH-1_Fix_Plan_v2.69_SCAFFOLD.md` §6, transcribed
verbatim. No word altered.**

## 1. Limb 1's discharge

**Ruling:** Ratified. Limb 1 discharges.

**Rationale:** Limb 1 asked whether 127 recorded dispositions hold at
their bases. 122 were answered. The remaining five cannot be answered
under confirm-not-re-derive, because each is an aggregate figure over an
unitemized remainder with no address to read — a property of the
disposition shape, not of any pass. Limb 1 is discharged on the ground
that it did what it was scoped to do, and those five are accepted as
unconfirmed under this method rather than left pending under it. They are
not thereby unconfirmable: an itemized file-by-file audit would settle
them, under a different instrument. That audit is owed as a register entry
(`v27` Sec 6.B), not as an FD — nothing is broken; a question is
unanswered — and it is owed pending explicit authorization rather than
sitting in the default agent-session task loop. It is not blocking this
discharge. Discharge is ruled here, not adopted from CP12, which made no
ruling.

## 2. FD-64 close

> **Provenance, disclosed per `F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md`
> §1's precedent.** The Ruling and Rationale text below was proposed by the
> drafting session, from its own read of the shipping commits, and adopted
> by Evoni's explicit approval in session — not composed by her from
> scratch. Recorded so a later reader does not cite this ruling's prose as
> freeform, unprompted language the way §1's cited precedent distinguishes.
> The decision — whether FD-64 closes, and on what evidence — is hers; the
> wording is not.

**Ruling:** Close FD-64, citing `65cbe7013` (PR #1186) and `2e5dbdf28` (PR
#1187).

**Rationale:** Both named remedies verified — the `getRolesForshow` typo
is gone from all of `src/` (both call sites, `roles.js:19` and
`AssetRoleService.js:124`), and `Asset.update()` at
`AssetRoleService.js:151` is scoped by `id: assetId`. Closing required a
third defect FD-64 didn't name: `getRolesForShow` itself calls
`models.AssetRole.findAll(...)`, and `src/models/index.js`'s
hand-maintained `models` subset never included `AssetRole` — so the
casing fix alone would have traded one `TypeError` for another. The
registration gap is not itself a finding this closes; it's carried
forward, unminted, because the hand-maintained subset omitting other
models is a distinct, unevaluated question.

## 3. FD-67 close

**Ruling:** FD-67 remains OPEN.

**Rationale:** The branch is ruled (Option 1) and the remedy is
implemented and tested — `F-AUTH-1_FD67_Remedy_Implementation_2026-09-02.md`
§7.5 states "implemented" and "tested" (142/142 Jest suites, against a
real Postgres 16 database). What keeps FD-67 open is not the
branch-ruling document's own authority disclaimer but a specific
remaining task that same §7.5 names: FD-68's severity interaction with
FD-65 has not been adjudicated. That adjudication is not performed by
this revision.

## 4. PE #65 close

**Ruling:** PE #65 is CLOSED.

**Rationale:** `F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md` §5 states
PE #65 closes when a branch is chosen and costed against real config and
sequencing. `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` supplies the
missing piece — the ordered sequence with gates — completing all three.
That document's own §7 withholds only the closing act, on authority
grounds ("a document cannot close the item it was written to complete"),
naming no remaining substance. This revision performs that closing act.

## 5. FD-70 — the two CP6 disagrees

**Ruling:** Do not mint FD-70. No further action.

**Rationale:** The two `universe.js` counting errors (row 11: 4 recorded
vs. 5 observed; row 12: 4 recorded vs. 3 observed) are counting errors on
an otherwise-correct Tier ruling — the total (8) and Tier assignment as a
class are unaffected; only the 4/4 split reads as 5/3. A documentation
error, not a protection gap. Already fully described at
`F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` §3; nothing further
is owed.

---

# §7. Owed carried forward — none minted here

1. **The itemized audit of the five aggregate cannot-tell dispositions** —
   owed as a `v27` Sec 6.B entry, pending Evoni's explicit authorization,
   not in the default agent-session task loop. Named at Ruling 1's own
   rationale (§6).
2. **`src/models/index.js`'s hand-maintained `models` subset omitting
   `AssetRole`** (and possibly others, unevaluated) — a distinct,
   unminted question surfaced by Ruling 2's rationale (§6). Whether other
   models are similarly missing from this subset is not checked here.
3. **Per-item Tier adjudication of the 40 declarations touched by FD-67's
   remedy.** `F-AUTH-1_FD67_Remedy_Implementation_2026-09-02.md` §4/§7.5:
   behavior-preserving and verified, but whether each of the 40
   legitimately needs optional identity is unruled — separate from, and
   not resolved by, this revision's FD-67 ruling (§6 Ruling 3).

None of the three mints an FD, XK, or PE number. None is closed by this
revision.

---

# §8. What this revision does not do

- **Does not close FD-63.** Untouched by any of the five rulings; remains
  as carried at `v2.68`.
- **Does not adjudicate FD-68 vs FD-65 severity.** Named as the reason
  FD-67 stays open (§6 Ruling 3); not performed here.
- **Does not rule on the 40 Tier declarations FD-67's remedy touched.**
  Carried forward, unruled (§7 item 3).
- **Does not evaluate `src/models/index.js`'s hand-maintained subset**
  beyond the one gap (`AssetRole`) found while closing FD-64. Carried
  forward (§7 item 2).
- **Does not perform the itemized audit of the five cannot-tell
  dispositions**, or authorize a future session to perform it without a
  separate go-ahead. Carried forward (§7 item 1).
- **Does not advance Dimension 3 or 5, discharge limb 3, or enter G4.**
- **Does not edit `v2.68`, `Prime_Studios_Audit_Handoff_v26.md`,
  `F-AUTH-1_Fix_Plan_v2.69_SCAFFOLD.md`, or any other filed document.**
  The scaffold stays on `main`, unedited, as filed.
- **Does not amend or re-rule any of v2.68's five definitional rulings.**
  They stand; this document acts on their result.
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Type: Fix Plan revision. Mints nothing. Closes FD-64 and PE #65.
Discharges limb 1. Leaves FD-67 open on a named gap. Declines to mint
FD-70. Rulings are Evoni's, transcribed verbatim; Ruling 2's wording is
session-proposed and Evoni-approved, disclosed as such. No host, AWS,
database, or Cognito contact. Prod FROZEN.*
