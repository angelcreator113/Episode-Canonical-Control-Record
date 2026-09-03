| **PRIME STUDIOS** **F-AUTH-1 FIX-PLANNING DOCUMENT — SCAFFOLD** *Not a revision. Carries re-derived state and five ruling placeholders. Mints nothing. Closes nothing. Ships no code.* |
| --- |

**Document version**

**SCAFFOLD for v2.69 — NOT A REVISION.** This file exists so the five
decisions it names can be answered in place, next to the evidence, rather
than dictated in a chat message and transcribed elsewhere. **The register's
tail remains `F-AUTH-1_Fix_Plan_v2.68.md` until a filled version of this
document lands under the name `F-AUTH-1_Fix_Plan_v2.69.md`.** This file
mints no FD, XK, or PE number; closes no finding; ratifies no discharge;
changes no gate, severity, owner, or standing. A second task lands the
filled version once Evoni has completed the five blocks below.

**Basis:** `origin/main` at `f5b5c69ee48f97da10bef6a49f3acd494eedd2eb`,
2026-09-03.

```
$ ls docs/audit | grep -E '^F-AUTH-1_Fix_Plan_v[0-9.]+' | sort -V | tail -3
F-AUTH-1_Fix_Plan_v2.66.md
F-AUTH-1_Fix_Plan_v2.67.md
F-AUTH-1_Fix_Plan_v2.68.md
```

No `v2.69` on `main` before this document. `v2.68` is the newest F-AUTH-1
Fix Plan revision by numeric sort, and remains the tail until a filled
`v2.69` lands.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Scaffold. Rules nothing.** Every fact above the five `[RULING OWED —
EVONI]` blocks is re-derived at this basis, not copied from `v2.68` or any
other predecessor. Every Ruling and Rationale line inside those blocks is
**left blank by this document, deliberately** — see §7.

---

# §1. Keystone and G3 state, re-derived

**F-AUTH-1: REOPENED-QUALIFIED.** Backend sweep done (12 CPs, ~700–750
handlers, May 2026); reopened at FD-63; 95 more handlers promoted Aug 17.
Gate G3 **PARTIALLY DISCHARGED, OPEN.**

| part | state | source |
|---|---|---|
| Limb 1 | **PARTIAL.** Confirmation sweep complete: 12/12 CPs carry a filed confirmation pass, confirming **127** recorded dispositions (120 agree, 2 disagree, 5 cannot-tell). `~700` estimate remains WITHDRAWN (`v2.68` §6). **Not ratified as discharged by any filed document** — `Prime_Studios_Audit_Handoff_v26.md` Sec 8 explicitly declines to make that ruling. | CP1–CP12 confirmations, 2026-09-01/02; `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md`; `Prime_Studios_Audit_Handoff_v26.md` Sec 3, Sec 8 |
| Limb 3 | open; ASSESSMENT NOT COMPLETED, unchanged | `v2.61`–`v2.68`, carried via v26 Sec 3 |
| G4 | never entered; not enterable, unchanged | carried |
| Dimension 1 | PASS — carried historical | `v2.60`, per `v25_Owed_Index_Amd10_2026-08-27.md` §J3 |
| Dimension 2 | PASS — current at `v2.60` basis | `v2.61` |
| Dimension 3 | NOT PERFORMED — current | `v2.68` |
| Dimension 4 | FAIL — carried historical | `v2.61`, per Amd10 §J3 |
| Dimension 5 | NOT PERFORMED — current | `v2.61` |

**Re-derived by re-citing `Prime_Studios_Audit_Handoff_v26.md` Sec 3, the
newest source for this state, not by independently re-walking `v2.59`–`v2.61`
a second time.** v26 Sec 7 discloses the same limit on its own table; this
scaffold carries that limit forward rather than repeating the walk a third
time without new information.

FD-68 vs FD-65 severity interaction: **unadjudicated**, unchanged. FD-67
remains OPEN/P2 by its own branch-ruling document's explicit statement
(§4: *"Does not close FD-67"*) despite the remedy being ruled and shipped —
see §3 below.

---

# §2. Register tails, re-derived with both instruments

**Onboarding §4 rule 4: a filename scan alone understates the FD ceiling.**
Both instruments run here, independently, at this basis:

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

**Both FD instruments agree at FD-69.** FD tail **FD-69** (retired, spent on
a duplicate). **FD-70 is next-available and unminted.** XK tail **XK-3**. PE
tail **PE #68**.

**Not derived by counting mentions.** `grep`-counting occurrences of
`FD-70`, `XK-4`, or `PE #69` across `docs/audit/` returns dozens of hits;
every one on inspection is a citation of the next-available, unminted
number inside an instrument like this one, never a mint.

---

# §3. Shipping evidence for the mechanical items

**Verified with `git show --name-only` against each cited SHA, this basis:**

```
$ git show --name-only 65cbe7013
commit 65cbe70133a3c1a941e77d99514425163e203dde
    fix(roles): getRolesForShow typo, AssetRole model registration,
    asset_roles migration [skip-automerge] (#1186)

$ git show --name-only 7a1eb427c
commit 7a1eb427c597cfea0f365d8f9d8af1da0a6139b0
    fix(auth): implement FD-67 Option 1 - remove global optionalAuth mount
    [skip-automerge] (#1185)

$ ls docs/audit/F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md
docs/audit/F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md
```

**All three SHAs and the one path match what was expected. No mismatch to
report.**

- **FD-64** — `65cbe7013` (PR #1186), commit message confirms the
  `getRolesForShow` typo fix and `AssetRole` model registration; a second
  commit, `2e5dbdf28` (PR #1187), adds the missing `where` clause in
  `AssetRoleService.js`. Neither commit is mentioned in `v2.68` (`grep -c
  "FD-64" docs/audit/F-AUTH-1_Fix_Plan_v2.68.md` → `0`) — no Fix Plan
  revision records this close.
- **FD-67** — `7a1eb427c` (PR #1185) implements
  `F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md`'s Option 1 (remove the global
  `optionalAuth` mount). That ruling document's own §4 states explicitly:
  *"Does not close FD-67."* `v2.68` predates both documents and does not
  mention FD-67 (`grep -c "FD-67"` → `0`).
- **PE #65** — `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` supplies the
  ordered execution sequence its own resolution document named as the
  missing piece. That document's own §7 states: *"Whether its filing
  discharges the criterion is a register-authority question this document
  cannot rule on itself… That determination is for a ratifying revision or
  for Evoni directly."*

---

# §4. The two CP6 disagrees — restated, not re-derived

**Full detail already filed** at
`F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` §3; restated here
only to the depth the ruling in §7 block 5 needs.

Both are in `src/routes/universe.js`, both counting errors on an otherwise
correct Tier ruling: row 11 (`universe.js:46,76,87,99,124`, Tier 1 writes)
records 4, the five cited lines are five `requireAuth` writes; row 12
(`universe.js:36,61,111`, Tier 4 GETs) records 4, the three cited lines are
three `optionalAuth` GETs. **5 + 3 = 8, the same total as the recorded
4 + 4** — the disagreement is about how the eight handlers split between
the two Tiers, not about how many exist or their Tier assignment as a
class. Neither row implies a handler is under-protected or mis-assigned.

---

# §5. What the five cannot-tells are, and are not

**Restated in full here because block 1 in §7 needs it stated plainly, not
pointed at.** All five `cannot-tell` verdicts across the twelve limb 1 CPs
— `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` §4 — are aggregate
figures over an unitemized remainder: a recorded count (e.g. "~19 other
files," "~65 unitemized," "~115," "~28," "~25") with no file or line named
for any of it. **None of the five names an address a `git show` could
check.** Settling any of them would require independently classifying every
handler in the remaining files or routes — the re-derivation the
confirm-not-re-derive method exists to avoid.

**This is a property of the method applied to an aggregate disposition, not
a property of any individual CP's confirmation pass.** A pass that confirms
per-address claims (`path:line`) can return `agree` or `disagree`; a pass
confirming an aggregate class total has nothing to check the total against
except a re-derivation. **Five for five, confirm-not-re-derive returns
`cannot-tell` on every aggregate disposition it was asked to confirm — not
because five passes were weak, but because the method cannot produce
anything else from that shape of claim.**

---

# §6. Rulings owed

**Exactly five blocks. Every Ruling and Rationale line below is blank.
Nothing in this document recommends, ranks, or calls any option likely.**

## [RULING OWED — EVONI] 1. Limb 1's discharge

Evidence: 12/12 CPs confirmed, 127 recorded dispositions (120 agree, 2
disagree, 5 cannot-tell) — `F-AUTH-1_Limb1_CP1…CP12_Confirmation_2026-09-02.md`,
`F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md`. Per §5 above, all
five cannot-tells are aggregate figures with no address to read, and this
is a property of the method applied to that disposition shape, not a
property of any individual pass. `Prime_Studios_Audit_Handoff_v26.md` Sec 8
declines to rule on discharge; CP12's own text asserts "Limb 1 discharges"
but that is the confirming document's own claim about its own population,
not a ruling.

Question: Does limb 1 discharge as complete, or does it ratify as PARTIAL
with the five aggregate dispositions recorded as permanently unconfirmable
under the confirm-not-re-derive method?

Options:
- Ratify limb 1 as fully discharged.
- Ratify limb 1 as PARTIAL, with the five cannot-tell dispositions recorded
  as unconfirmable under this method (not merely unconfirmed-so-far), and
  no further limb 1 pass expected to change that.
- Neither — hold limb 1 open pending a different instrument for the five
  aggregate dispositions specifically.

Ruling: _____________________________________________

Rationale: __________________________________________

## [RULING OWED — EVONI] 2. FD-64 close

Evidence: Fixed in code at `65cbe7013` (PR #1186, `getRolesForShow` typo +
`AssetRole` model registration) and `2e5dbdf28` (PR #1187, `AssetRoleService`
missing `where` clause). No Fix Plan revision records a close; `v2.68`
predates both commits and does not mention FD-64.

Question: Does FD-64 close, on this shipped code?

Options:
- Close FD-64, citing `65cbe7013` and `2e5dbdf28`.
- Leave FD-64 open pending further verification.

Ruling: _____________________________________________

Rationale: __________________________________________

## [RULING OWED — EVONI] 3. FD-67 close

Evidence: Branch ruled at `F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md`
(Option 1) and implemented at `7a1eb427c` (PR #1185, removes the global
`optionalAuth` mount). The branch-ruling document's own §4 states it does
not close FD-67, does not resolve the 14 uncertain reads the scoping
document left open, and does not adjudicate FD-68's severity interaction
with FD-65.

Question: Does FD-67 close, on this shipped remedy, and separately, is
FD-68's severity interaction with FD-65 adjudicated?

Options:
- Close FD-67, citing `7a1eb427c`; adjudicate FD-68/FD-65 severity now.
- Close FD-67; leave FD-68/FD-65 severity adjudication open as a separate
  item.
- Leave FD-67 open pending resolution of the 14 uncertain reads or further
  testing.

Ruling: _____________________________________________

Rationale: __________________________________________

## [RULING OWED — EVONI] 4. PE #65 close

Evidence: Branch B costed (`F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md`)
and sequenced (`F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md`), which
states PE #65's closing criterion (§5 of the resolution document: a branch
chosen and costed against real config and sequencing) is now fully
supplied. That same document's §7 states the determination of whether its
filing discharges the criterion is not its own to make.

Question: Does PE #65 close, on the costing and sequencing now filed?

Options:
- Close PE #65, citing the resolution and execution-sequence documents.
- Leave PE #65 open pending execution of Phase 2's AWS/host steps (which
  remain entirely Evoni's, gated on Gate G0 per the execution-sequence
  document).

Ruling: _____________________________________________

Rationale: __________________________________________

## [RULING OWED — EVONI] 5. FD-70 — the two CP6 disagrees

Evidence: §4 above restates both rows in full. Both are counting errors
(4 recorded vs. 5 observed on row 11; 4 recorded vs. 3 observed on row 12)
on an otherwise-correct Tier ruling — the total (8) and Tier assignment as
a class are unaffected; only the 4/4 split reads as 5/3. FD-70 is
next-available and unminted (§2).

Question: Do the two `universe.js` counting errors warrant minting FD-70,
or are they recorded without a mint?

Options:
- Mint FD-70 for the two-row counting discrepancy in `universe.js`.
- Record the discrepancy as an amendment to the CP6 confirmation or to a
  future handoff, without minting.
- Take no further action — the discrepancy is fully described at
  `F-AUTH-1_Limb1_Exceptions_Consolidated_2026-09-03.md` §3 and needs
  nothing further recorded.

Ruling: _____________________________________________

Rationale: __________________________________________

---

# §7. What this scaffold does not do

- **Does not draft, suggest, or imply a ruling anywhere.** Every Ruling and
  Rationale line in §6 is left literally blank. No option in any block is
  recommended, ranked, or described as likely.
- **Does not close FD-64, FD-67, or FD-70's minting question, or PE #65.**
  All four are named in §6 as owed and answered by no one but Evoni.
- **Does not ratify limb 1's discharge.** §6 block 1 states the question;
  it does not answer it.
- **Does not mint FD-70, XK-4, or PE #69.** §2 confirms all three remain
  next-available and unminted.
- **Does not change any gate, severity, owner, or standing.** Every fact in
  §1–§5 is carried or re-derived from a filed document; none is asserted
  new here.
- **Is not `F-AUTH-1_Fix_Plan_v2.69.md`.** The register's tail remains
  `v2.68` until a filled version of this document lands under that name, in
  a separate task, after Evoni completes §6.
- **Does not edit `v2.68`, `Prime_Studios_Audit_Handoff_v26.md`, or any
  other filed document.**
- **Contacts no host, AWS, database, or Cognito. Prod FROZEN.**

---

*Type: scaffold, not a revision. Mints nothing, closes nothing, rules
nothing — five blocks left blank for Evoni. No host, AWS, database, or
Cognito contact. Prod FROZEN.*
