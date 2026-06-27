# Decision Analysis - Canon Credential Recovery vs Fresh Rotation After PM2 Identity Correction

**Date:** 2026-06-14
**Session:** Read-only decision analysis only
**Status:** DRAFT FILED LOCALLY - additive analysis only. No credential extraction. No rotation. No restart.
**Additive on:** `Prime_Studios_Audit_Handoff_v20.md`, `F-Deploy-1_Finding_BoxEnv_CredentialDrift_2026-06-13.md`, and `F-Deploy-1_Finding_PM2_ProcessIdentity_Inversion_2026-06-14.md`. Supersedes nothing.

---

## 0. One-line

The decision is not whether a restart is needed. A restart window is required either way. The real decision is whether the canon credential can be recovered from an in-policy live surface or whether the system is already foreclosed to fresh rotation.

## 1. Why this analysis exists

`#791` closed the recovery-surface question under the pre-inversion process map. `#793` corrected that map by proving the production listener is `episode-api-prod-hotfix` on PORT 3000, not `episode-api` on PORT 3002. That correction changes how the prior recovery inventory should be interpreted.

The point of this analysis is to decide whether recover remains viable after the identity correction, or whether the evidence now forces rotate.

## 2. Decision statement

Re-establish a durable, known-good canon credential by one of two routes:

- **Recover:** extract a working credential from a running process's in-policy surface, write it back to durable storage, and restart to align processes.
- **Rotate:** set a new canon RDS password, update every consumer, and restart atomically.

Both routes require the same restart window. The decision only changes which credential value is loaded and how much fan-out is required.

## 3. What the evidence says about recoverability

The prior inventory from `#791` said the safe recovery surfaces were exhausted:
- on-disk `.env` was canon-invalid
- API-process environ had no usable `DB_PASSWORD`
- worker/hotfix environ returned stale-FATAL
- PM2 dump was stale by mtime
- live heap was off-limits by policy on frozen production

If that inventory is complete under the corrected process map, recover is foreclosed and rotate is forced.

The problem is that `#791` bucketed worker and hotfix together before `#793` established that the actual production API listener is the hotfix process. That means the old inventory may have been asking the right question of the wrong identity map. The critical unresolved question is now narrower:

- Does the actual production process, `episode-api-prod-hotfix` on PORT 3000, hold an in-policy credential that authenticates to canon?

If yes, recover is back on the table. If no, rotate is the only defensible route.

## 4. Path A - Recover

Recover would require all of the following:
- A live, in-policy surface such as environ holds the working credential.
- The value is extracted without echoing plaintext.
- The value is hash-verified and probe-verified against canon.
- The corrected on-disk `.env` and durable backing store are updated.
- The restart window is executed to align the running processes.

Pros:
- Preserves the known-working credential.
- Avoids changing canon RDS password.
- Avoids a full consumer fan-out.

Cons:
- If `#791` remains true under the corrected identity map, there is nothing recoverable in policy.
- Live environ inspection on a frozen production box is still a risk action.
- The restart is still mandatory.

## 5. Path B - Rotate fresh

Rotate would require:
- Enumerating every consumer of the canon credential before any change.
- Setting a new canon RDS password.
- Updating the corrected on-disk `.env` and any durable backup store.
- Restarting all affected processes in one atomic window.

Pros:
- Produces a known-good durable credential from the start.
- Fixes the broken on-disk `.env` as part of the same move.
- Does not depend on recovering a live-memory copy.

Cons:
- Larger blast radius.
- Requires complete consumer enumeration.
- Any missed consumer will fail after rotation.

## 6. Provisional lean

The provisional lean is **rotate fresh**.

Reasoning:
- The recovery surfaces appear exhausted under `#791`.
- Live heap is policy-blocked on frozen production.
- The on-disk `.env` is already broken.
- Rotate gives a durable value immediately instead of depending on a possibly absent in-policy live surface.

## 7. Single flip condition

This lean is not yet a final decision. One bounded read-only reconciliation still matters:

- Re-validate the corrected production process identity against the prior environ result.
- Confirm whether the actual prod process, `episode-api-prod-hotfix`, has a canon-authenticating credential in an in-policy surface.

If id-3 environ genuinely fails canon, recover is foreclosed and rotate is forced.
If id-3 holds a value that was not correctly probed before, recover returns to the table.

## 8. What `#793` changed in the decision model

`#793` did more than identify the hotfix process. It corrected the process-identity model that the earlier recovery inventory depended on.

That means any specific-looking timestamp or surface bucket in earlier analysis should be treated as sourcing-sensitive unless it is directly supported by live data. This finding is the decision-level record of that correction.

## 9. Recommendation for the next session

Start with one bounded read-only reconciliation of the actual production process's environ against canon auth, using the established no-plaintext discipline. Do not rotate or restart until that read is done or until policy rejects the read.

That next step is the decision gate. Everything else is downstream.

## 10. Session-close state

- Box changes: none
- Process changes: none
- Credential changes: none
- Artifact: this analysis file only

## 11. Canonical cross-references

- `docs/audit/Prime_Studios_Audit_Handoff_v20.md`
- `docs/audit/F-Deploy-1_Finding_BoxEnv_CredentialDrift_2026-06-13.md`
- `docs/audit/F-Deploy-1_Finding_PM2_ProcessIdentity_Inversion_2026-06-14.md`
- `#791` recovery-surface closure chain
- `#793` process-identity correction / PR `793`
