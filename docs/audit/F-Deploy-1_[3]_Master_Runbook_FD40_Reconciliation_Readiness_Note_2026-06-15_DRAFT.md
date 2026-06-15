# F-Deploy-1 [3] Master Runbook - FD-40 Reconciliation Readiness Note (Path A, Draft)

**Date:** 2026-06-15  
**Mode:** Path A drafting and confirmation only (no box touch, no shared-state mutation)  
**Target artifact:** `docs/audit/F-Deploy-1_[3]_Master_Runbook_DRAFT.md` (PR #762, merged)  
**Intent:** Reconcile mixed-era language to one FD-40-era voice before any [3] cold session opens.

## 0) Why this note exists

The current [3] master runbook contains both updated and pre-FD-40 language. The risk is not simple staleness; it is internal contradiction under restart pressure.

Primary contradiction class:
- A cold-open operator can read a phase-map row that still advertises cutover credential rotation, then later read an execution step that says rotation already executed and must not be repeated.
- This pushes live adjudication into the restart window, which is exactly what readiness should remove.

This note is a draft step only (Rule 7). It proposes reconciliation edits for a later confirm-and-apply PR. It does not edit the runbook body in this session.

## 1) Reconcile map (line-keyed)

### 1.1 Replace targets

| Anchor | Current text (paraphrase) | Contradiction / staleness | Reconciled replacement (draft for future PR) |
|---|---|---|---|
| L159 | Phase 2 row says cutover includes credential rotation + restart-align + route fix + security sweep. | Conflicts with FD-40 closure state and with 2026-06-15 CloudTrail ordering (`ModifyDBInstance` then SSM v2 write) that records gate-close rotation in FD-40 session, not as remaining [3] payload. This is the load-bearing contradiction and highest-priority fix. | Rewrite Phase 2 row to remove credential rotation entirely. Phase 2B should read as restart-to-align / cutover confirmation / topology finalize / post-cutover security sweep only. Remove route-fix payload wording (PR #773 is merged). |
| L300 | Section preface still says restart and rotation commands are left un-templated for session-time assembly. | Mixed-era wording implies live rotation still exists in [3], despite FD-40 gate closure and replacement of SSM v1 with v2 in 2026-06-15 close evidence. | Keep un-templated mutation discipline, but scope wording to remaining live mutations only (restart-to-align and cutover-adjacent actions). Explicitly state rotation is out of scope because already executed and closed in FD-40. |
| L308 | Step 2 says rotation already executed on 2026-06-12; do not repeat at cutover. | Direction is correct (do not repeat), but the date anchor is not the FD-40 close authority. FD-40 evidence records decisive gate-close rotation activity on 2026-06-15 (CloudTrail `ModifyDBInstance` then SSM v2 write). | Keep no-repeat semantics, but re-date and re-cite this step to FD-40 closure authority (PR #799 gate record + verification note evidence chain). Treat 06-12 wording as correction target, not as reconciliation anchor. |

### 1.2 Preserve / guard targets

| Anchor | Current text (paraphrase) | Verification outcome | Guard rule for future PR |
|---|---|---|---|
| L354 | Topology language references `episode-api-prod-hotfix` naming in restart context. | Targeted scan in this runbook found no remaining "unidentified hotfix" prerequisite language. Existing references are operational re-confirm prompts, not open identity findings. | Preserve closed-identity framing: prod ingress identity is known and referenced explicitly as `episode-api-prod-hotfix` on 3000. |
| L364 | Post-cutover sweep line names fork SG and canon SG; canon shown as `sg-002578912805d1930`. | Byte-checked in target line. Canon SG string is correct. | Preserve canon SG value byte-for-byte as `sg-002578912805d1930`. Preserve fork comparator `sg-0164d0b20fbebacbb` as not-canon anti-confusion guard. |

## 2) Additional readiness deltas to carry in reconciliation PR

1. **#773 / F-CW-1 is landed**
- PR #773 is merged.
- Any [3] step text that frames route-fix as pending cutover payload should be removed or rewritten to post-merge verification wording only.

2. **#752 remains parked, now readiness-relevant**
- PR #752 is open.
- Keep policy as: parked outside routine sessions; becomes active when [3] priming begins.
- This should be tracked in readiness/checklist context, not folded into runbook execution steps unless explicitly re-scoped.

3. **FD-38 fingerprint numbers remain un-inlined**
- Do not inline table counts or fingerprint constants into this note.
- Continue pointing [3] start to the authoritative source and require live read at cold-session open.

## 3) Byte checks completed for this draft

- Canon SG string in target runbook line is byte-correct as `sg-002578912805d1930`.
- Fork SG comparator remains `sg-0164d0b20fbebacbb`.
- Contradiction confirmed between phase-map rotation wording and later no-repeat rotation rule.

## 4) Scope boundary

This note does not:
- start [3],
- perform abort re-verify,
- touch prod box `54.163.229.144`,
- mutate runbook body,
- change PM2 state, secrets, or SGs.

This note is the draft artifact for later confirm-and-apply reconciliation.
