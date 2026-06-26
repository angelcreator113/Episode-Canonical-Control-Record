# F-Deploy-1 Fix Plan v1.16

## Sec 1 Purpose

Mints FD-43. Incorporates the 2026-06-23 canon master-password rotation (committed
REDACTED CloudTrail evidence, PR #863; provenance addendum #4 on main) into the FD-42
credential-staleness record. FD-43 supersedes FD-42's CloudTrail chain (which terminated
at 06-20) and re-qualifies FD-42's remediation premise (which assumed the stored 06-15
value was the apply target, written when 06-20 was believed latest). FD-42's precondition
finding, stale-by-later-rotation mechanism, observation legs, and severity are RETAINED.
No credential-validity conclusion is asserted -- the resolution stays cold-[3]-locked.
Advances no gate; authorizes no prod-box action; does not prime [3]. Freeze stands;
FD-31/FD-42 remain OPEN.

## Sec 2 Reference documents

| Doc | Role |
|---|---|
| `F-Deploy-1_Fix_Plan_v1.15.md` (#852) | Immediate predecessor; mints FD-42. Retained verbatim; FD-43 supersedes only its CloudTrail chain + remediation premise. |
| `F-Deploy-1_CT_ModifyDB_06-23_Rotation_Evidence_REDACTED.json` (#863) | Primary evidence for the 06-23 rotation FD-43 incorporates. |
| `F-Deploy-1_FD42_Phase1_OffBox_Credential_Precondition_DRAFT_2026-06-22.md` (addendum #4) | Prose record of the 06-23 canon + fork rotation. |
| `F-Deploy-1_[3]_Credential_Branch_Execution_Runbook.md` (#861) | The four-branch probe procedure the re-qualified remediation now routes through. |

## Sec 3 Register entry -- FD-43

FD-43 -- 06-23 canon rotation incorporated into the FD-42 staleness record;
FD-42's CloudTrail chain and remediation premise superseded (resolution stays cold-locked).

SUPERSEDES (additive; FD-42 retained otherwise):
  FD-42's CloudTrail provenance chain terminated at the 2026-06-20 23:16:50Z modify
  ("no SSM write after 06-15"). A later canon rotation, not in FD-42's chain, is now
  on main as committed evidence:
    - 2026-06-23 23:46:43Z  canon (episode-control-dev) master-password modify
                            (resId db-GBZ2JQVM3UIG4S6KD3WJ2RDWN4, identity-bound, not
                            name-trusted; CT evidence #863, addendum #4)
    - 2026-06-23 23:46:00Z  fork (episode-control-prod) master-password modify,
                            same operator pass, fork 43s ahead (noted for the
                            post-[3] fork SG/teardown sweep; out of canon scope)
  Effect on the chain: canon was rotated AGAIN after 06-20. SSM v2 (06-15-era value)
  is now stale by TWO canon rotations (06-20, 06-23), not one. The masterUserPassword
  field is confirmed the changed parameter (CT records it HIDDEN_DUE_TO_SECURITY_REASONS
  -- field presence proven, value never logged), applyImmediately true.

REMEDIATION PREMISE RE-QUALIFIED (supersedes FD-42's remediation direction):
  FD-42 planned "apply the stored 2026-06-15 value to canon ... making canon's live
  password match .env/SSM." That direction was framed when 06-20 was believed the latest
  rotation. With 06-23 in scope, the stored 06-15 value is now stale by two canon
  rotations (06-20 and 06-23), and its validity as an apply target cannot be confirmed
  warm. The apply-vs-recover-vs-propagate decision now routes through the cold probe and
  the four-branch procedure (Credential Branch Execution Runbook, #861): the live probe
  selects whether a stored/candidate value authenticates (re-anchor, no canon write) or
  none do (canon write or masked in-memory recovery). FD-43 does NOT pick a branch.

RETAINED FROM FD-42 (unaffected by this supersede):
  - The Phase 1 off-box-credential precondition finding (cold workstation cannot satisfy
    Phase 1; aborts at credential/identity). Unchanged (addendum #4: "reinforced, not changed").
  - The stale-by-later-rotation mechanism. 06-23 reinforces it; does not alter it.
  - Observation legs (.env == SSM v2 byte-identity; stored value fails canon auth now;
    only-working credential in the running app's in-memory pool, fragility leg).
  - Severity (binding cold-Phase-1 blocker + fragility).

CARRIED-OPEN (cold-[3]-locked, unchanged):
  - Canon's current live password value (now post-06-23) -- not established in any
    warm-readable source.
  - Which credential group (if any stored) is canon-valid -- warm-testable = false.
  - Candidate-B canon-auth status -- UNRESOLVED, load-bearing.
  All gated behind FD-31 Sec 7 green. The freeze stands.

EVIDENCE-DEPENDENCY CAVEAT (carried from FD-42): the 06-23 incorporation rests on the
committed CT evidence (#863) and addendum #4. Revisitable if those are later found
mis-scoped. A fresh warm CloudTrail re-read is optional hardening, not a prerequisite.

Evidence: CT ModifyDB 06-23 evidence (#863); FD-42 addendum #4; Fix Plan v1.15 (FD-42).
Status: OPEN -- closed by the [3] reconciliation (the cold probe selects the branch;
apply/re-anchor/propagate per the branch runbook + restart-to-align).

## Sec 4 Register decision -- supersede FD-42's chain + remediation premise, do not retract FD-42

FD-43 mints as a new register number, not an edit to FD-42. Discriminator (same as FD-42's own Sec 4):

1. Independent content/lifecycle? Yes -- the 06-23 rotation is a new evidence event
   (not in FD-42's chain) and it shifts the remediation premise. New, actionable content
   with its own OPEN lifecycle (closed by the [3] reconciliation).
2. Retracts FD-42? No. FD-42 stands verbatim in v1.15. FD-43 supersedes FD-42's
   CloudTrail chain (additive: extended to 06-23, not erased) and re-qualifies its
   remediation premise (the stored-value apply direction is routed through the cold
   probe). FD-42's precondition finding, mechanism, observations, and severity are retained.

Register topology: FD-41 (v1.14, mechanism superseded by FD-42, observations retained)
-> FD-42 (v1.15, mechanism reconciled + precondition finding, OPEN) -> FD-43 (v1.16,
06-23 rotation incorporated, chain + remediation premise superseded, resolution
cold-locked, OPEN). No prior register entry is rewritten.

## Sec 5 Closing

*Fix Plan revision v1.16. Mints FD-43 -- incorporates the 2026-06-23 canon master-password
rotation (committed CT evidence #863; addendum #4) into the FD-42 staleness record. FD-43
supersedes FD-42's CloudTrail chain (which terminated at 06-20; SSM v2 now stale by two
rotations, 06-20 and 06-23) and re-qualifies FD-42's remediation premise (the stored-06-15
apply direction, framed when 06-20 was believed latest, now routes through the cold probe
and the four-branch runbook #861). FD-42's precondition finding, stale-by-later-rotation
mechanism, observation legs, and severity are retained. No credential-validity conclusion
is asserted; which value canon accepts stays cold-[3]-locked behind FD-31 Sec 7. Advances no
gate; authorizes no prod-box action; does not prime [3]. The freeze stands; FD-31/FD-42
remain OPEN. v1.15 (and the chain beneath it) canonical for anything v1.16 does not supersede.*