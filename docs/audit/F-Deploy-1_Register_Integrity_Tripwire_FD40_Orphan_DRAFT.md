> **[RESOLVED - 2026-06-18, FD-40 / v1.12 / PR #821 / 9d6961f2]**
> The contradiction this draft flagged is closed. At filing, the register tail was
> FD-39 and no revision minted FD-40 - correct then. Fix Plan v1.12 (PR #821,
> 9d6961f2) has now minted FD-40 in-register; the tail advances to FD-40 and Gate
> 2.5 is register-authoritative CLOSED. This file is retained as the integrity-defect
> trail (it is the artifact that caught the missing mint) and should be tracked
> in-repo in this supersede pass so the trail is complete. The at-filing PROPOSED
> DRAFT text is preserved below verbatim.
# F-Deploy-1 Register Integrity Tripwire: Orphaned FD-40 Gate Record
**Status: PROPOSED DRAFT ONLY**

## 1) Flat factual contradiction

1. The authoritative Fix Plan register tail is FD-39 in F-Deploy-1_Fix_Plan_v1.11.md.
2. A standalone record file exists at F-Deploy-1_FD40_Canon_Credential_Rotation_Gate_Record_DRAFT.md claiming FD-40 and Gate 2.5 closed.
3. That standalone file cites no Fix Plan minting revision.

## 2) Immediate consequence

No minting revision is evident for the FD-40 number (grep was for the FD-40 string in Fix Plan revisions; it returned nothing). Gate 2.5 register status is therefore unconfirmed pending a positive register check. This is a register-integrity defect (numbered standalone ahead of demonstrated mint), not a claim that rotation work did or did not happen.

## 3) Tripwire requirement (load-bearing)

Any session that accounts [3] preconditions must reconcile this contradiction before trusting Gate 2.5 as closed in precondition accounting.

Where this note and F-Deploy-1_FD40_Canon_Credential_Rotation_Gate_Record_DRAFT.md conflict on register status, THIS NOTE GOVERNS until reconciliation lands. The FD-40 record CLOSED banner is not register authority; a Fix Plan mint is.

## 4) Non-assertions

This note does not resolve whether the canon-credential finding is done-but-unminted, mis-numbered, or otherwise. It forces reconciliation before trust; it does not pre-decide outcome.

## 5) Clearing condition

This tripwire stands until a Fix Plan revision either:
1. Mints FD-40 for the canon-credential finding, or
2. Renumbers or withdraws the FD-40 standalone

And the register tail and the FD-40 record agree on the resulting number. Until one of those, do not treat it as stale.