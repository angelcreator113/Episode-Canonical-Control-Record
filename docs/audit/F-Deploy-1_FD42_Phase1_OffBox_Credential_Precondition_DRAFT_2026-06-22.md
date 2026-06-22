# F-Deploy-1 -- FD-42 (PROVISIONAL) -- Phase 1 unstated off-box-credential precondition + FD-40<->FD-41 SSM v2 contradiction

**Status:** DRAFT, additive. Provisional number -- FD-42 is NOT minted until folded into
the next Fix Plan revision (v1.15). Filed as a standalone note for the record ahead of the
next cold [3] attempt; do not treat the number as canon until the Fix Plan rev lands.
This note executed no query, made no on-box or on-canon contact. Box remained FROZEN.

## Source / evidence base
- Master Runbook DRAFT Sec 5 (Phase 1 definition): workstation->canon read-only re-verify.
- Master Runbook Sec 0 + Phase 2 step 3: "SSM v2 = backup-of-record"; FD-40 (06-15)
  verified box `.env` == SSM v2 SHA-256 identical; gate 2.5 GREEN.
- 06-22 [3]-entry AbortNote (#844) + AbortAdjudication (#845): cold session pulled SSM v2,
  got `97aac3b0...` len 38 (documented-stale), failed canon auth, aborted at Phase 1 entry.
- FD-41 chain: SESSION2 adjudication (06-21), InMemory HashID (06-22) -- stale-SSM /
  auth-fail evidence.

## Finding
Sec 5 (Phase 1) defines the workstation->canon abort re-verify (content counts, snapshot,
dump) but does NOT name the credential the workstation authenticates with. It silently
assumes a working off-box canon credential exists. As of the 06-20/06-22 evidence, that
assumption is FALSE: the only off-box credential a cold session can reach (SSM v2) returns
the documented-stale `97aac3b0...` len 38, which fails canon auth. The working canon
credential exists only on-box -- in `/home/ubuntu/episode-metadata/.env` and in pm2 id-3's
in-memory pool. A cold workstation session therefore cannot satisfy Phase 1 as written; it
aborts at the door before reaching any count check. This is the mechanism of the 06-22
abort, and it will recur identically on every future cold attempt until the off-box
credential is reconciled.

This is NOT a "Sec 5 gives a wrong instruction" defect. Sec 5's instructions are correct;
it carries an unstated precondition (a valid off-box credential) that is currently unmet.

## Contradiction (FD-40 <-> FD-41), stated for the record
These two on-record claims cannot both currently be true:
- (FD-40, 06-15) box `.env` == SSM v2, SHA-256 identical; SSM v2 is the valid
  backup-of-record; gate 2.5 GREEN.
- (FD-41 / 06-22) SSM v2 pulls `97aac3b0...` len 38 = documented-stale, fails canon auth.
Reconciliation requires one of: (i) SSM v2 was overwritten between 06-15 and 06-20 (a write
event after the FD-40 verification); (ii) a canon credential rotation episode landed after
the 06-16 Stop-Gate-#1 count closed at two episodes, leaving SSM v2 behind; (iii) the
06-15 FD-40 SHA-256 verification compared something other than the live canon-valid value.
This note does not choose among (i)-(iii); it records that the contradiction is open and
that the off-box backup-of-record is currently NOT a working canon credential.

## Impact on cold Phase 1
Until an off-box canon-valid credential is re-established (or Phase 1 is re-scoped to source
the credential differently), the cold [3] window cannot pass Phase 1. Every cold attempt
will abort at credential/identity, as #844 did. This is now the binding blocker on opening
[3] under the current documented Phase 1 workstation-auth path, upstream of the
count/snapshot/dump checks.

## What this note does NOT decide
- Does NOT establish which of the three FD-41 credential groups is canon-valid (validity is
  cold-[3]-locked, warm-testable = false -- Rotation Scoping v2; D1 holds).
- Does NOT close the Candidate-B canon-auth question.
- Does NOT resolve the 100.50.2.212 <-> 10.0.20.224 closure.
- Does NOT modify Sec 5, the runbook, or gate 2.5 state -- recording only.
- Does NOT authorize any box, canon, or rotation action.

## Recommended next step (separate, provenance-only)
A read-only `aws ssm get-parameter-history` on `/episode-metadata/canon/db_password` would
show whether SSM v2 was written/overwritten after the 06-15 FD-40 verification -- testing
hypothesis (i) and bounding (ii). This is AWS control-plane read-only, warm-safe, box-free.
It is PROVENANCE-ONLY: it explains the contradiction's mechanism and tells whether SSM v2
needs re-anchoring; it does NOT establish canon-validity of any credential (that stays
cold-locked). To be run as its own warm diagnostic, recorded as provenance-only, not as a
Phase 1 unblock.

---
*FD-42 (PROVISIONAL) finding note. Additive. Records that Phase 1 (Sec 5) carries an
unstated, currently-unmet off-box-credential precondition, and that the FD-40<->FD-41 SSM v2
status is contradictory and open. Decides no cold-[3]-locked question; authorizes no
action. FD-42 is NOT minted until folded into Fix Plan v1.15.*
## FD-42 provenance addendum (2026-06-22, warm, read-only) -- hypothesis (i) RULED OUT

Read: aws ssm get-parameter-history on /episode-metadata/canon/db_password, --no-with-decryption, metadata-only query (no value retrieved). Account 637423256673, user evoni-admin. Warm-safe, no box/canon contact, no mutation.

Result -- two versions, both SecureString, both written by evoni-admin:
- v1: 2026-06-14T14:19:58 -04:00
- v2: 2026-06-15T09:53:10 -04:00 (latest; matches the FD-40 06-15 09:53 SSM write)

No SSM write exists after 2026-06-15. SSM v2 has been unchanged since FD-40 wrote it.

Bearing on the FD-40<->FD-41 contradiction:
- (i) SSM v2 overwritten after FD-40 verification -- RULED OUT. v2 is the same value FD-40 SHA-256-verified on 06-15; never rewritten since.
- (ii) post-06-16 rotation stranding SSM -- constrained: no SSM write landed after 06-15, so any later canon-password change never propagated to SSM regardless.
- (iii) the 06-15 FD-40 verification proved .env==SSM internal consistency, NOT live canon auth of either. Branch (iii) is now the leading unresolved explanation branch, but remains unproven; this read establishes parameter-write provenance only, not canon-auth validity.

This read CANNOT distinguish:
- v2 was never canon-valid at 06-15, vs.
- canon was rotated later, outside SSM propagation.
Separating these needs a canon RDS CloudTrail ModifyDBInstance read after 06-15 -- a separate warm diagnostic, to open with fresh intent/gate, not momentum.

Does NOT establish canon-validity of any credential (cold-[3]-locked; D1 holds). Provenance only. No gate moved. Box FROZEN.

## FD-42 provenance addendum #2 (2026-06-22, warm, read-only) — hypothesis (ii) CONFIRMED; (iii) ruled out as mechanism
Read scope: AWS CloudTrail lookup for ModifyDBInstance in us-east-1 from 2026-06-15T00:00:00Z, followed by event-body inspection of the canon-instance hit. Warm-safe, control-plane read-only, box-free, no canon RDS data-plane contact, no mutation.
### Result
CloudTrail shows a post-06-15 modify event on the canon instance:
- Instance: episode-control-dev
- Event time: 2026-06-20T23:16:50Z (table view: 2026-06-20T19:16:50-04:00)
- User: evoni-admin
- Source context: 108.216.160.136, aws-cli on Windows
- requestParameters.masterUserPassword: present as HIDDEN_DUE_TO_SECURITY_REASONS
- applyImmediately: true
- pendingModifiedValues.masterUserPassword: present
Interpretation bound to evidence:
- This proves a master-password modify request was issued and queued with applyImmediately true.
- This note does not separately prove completion state from CloudTrail alone.
Identity cross-checks in event body (naming-inversion-safe):
- VPC: vpc-0754967be21268e7e
- SG: sg-002578912805d1930 (cited for canon-identity cross-check only; AF investigation untouched)
### Bearing on FD-40 versus FD-41 contradiction
- Addendum #1 established SSM v2 write provenance: written 2026-06-15 09:53 and not rewritten afterward.
- This addendum establishes a later canon password-modify request on 2026-06-20 against canon.
- Therefore the stale-SSM mechanism is resolved: canon moved later while SSM remained unchanged.
Conclusions:
- Hypothesis (ii), post-06-15 canon rotation stranding SSM: CONFIRMED.
- Hypothesis (iii), as mechanism for the observed staleness: ruled out as mechanism.
### Scope limits
This addendum establishes provenance and mechanism only. It does not establish:
- the post-06-20 password value,
- canon-validity of any credential group,
- any cold-[3]-locked credential-validity decision,
- any authorization for box, canon, or rotation action.
No gate moved. Box FROZEN. [3] not primed. FD-42 remains provisional until folded into Fix Plan v1.15.

## FD-42 provenance addendum #3 (2026-06-22, warm, read-only) — 06-15 09:50 canon password modify confirmed; event chain now complete
Read scope: CloudTrail event-body inspection of the earlier canon-instance ModifyDBInstance hit in the same us-east-1 window. Warm-safe, control-plane read-only, box-free, no canon RDS data-plane contact, no mutation.
### Result
The 2026-06-15 09:50:22Z ModifyDBInstance event on canon (`episode-control-dev`) is also a master-password modify request:
- requestParameters.masterUserPassword: present (`HIDDEN_DUE_TO_SECURITY_REASONS`)
- applyImmediately: true
- pendingModifiedValues.masterUserPassword: present
- Same instance / operator / source context as the later 06-20 event
Interpretation bound to evidence:
- This proves a master-password change was requested and queued on canon at 09:50:22Z.
- It does not, by itself, prove which exact secret value SSM v2 captured versus the prior on-box state.
- It does not establish canon-validity of any credential group; cold-[3]-locked remains in force.
### Bearing on the provenance chain
With this event plus addendum #1 and #2, the chain is now event-complete:
- 2026-06-15 09:50:22Z -- canon password modify request
- 2026-06-15 09:53:10Z -- SSM v2 write
- 2026-06-20 23:16:50Z -- later canon password modify request
That makes the mechanism symmetric and gap-free as to recorded events: SSM v2 was written after the first canon modify and before the second, then left untouched after 06-15. The stale-SSM explanation remains the right mechanism, and this addendum closes the remaining uninspected event in the window.
### Scope limits
This addendum establishes provenance only. It does not establish:
- the exact secret value at 09:50,
- whether SSM v2 captured that exact post-modify value or the prior on-box state,
- canon-validity of any credential group,
- any cold-[3]-locked credential-validity decision,
- any authorization for box, canon, or rotation action.
No gate moved. Box FROZEN. [3] not primed. FD-42 remains provisional until folded into Fix Plan v1.15.