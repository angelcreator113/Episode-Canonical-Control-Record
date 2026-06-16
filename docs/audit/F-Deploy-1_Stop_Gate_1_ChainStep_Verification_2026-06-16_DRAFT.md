# F-Deploy-1 - Stop Gate #1 and Put-Parameter Chain-Step Verification (DRAFT)

**Date:** 2026-06-16  
**Mode:** Path A, read-only evidence synthesis.  
**Status:** FILED 2026-06-16 (filename retains _DRAFT per FD-40 naming precedent; header status is authoritative).  
**Scope:** Verify timeline consistency for the put-parameter chain step and resolve Stop Gate #1 framing on live evidence.

---

## 0. One-line

Live AWS control-plane evidence confirms a non-lockstep credential timeline across artifacts: canon RDS password-change activity on 2026-06-12, no off-box credential copy at that time (gate 2.5 RED), first SSM parameter creation on 2026-06-14 (v1) during recovery, and gate-close RDS-modify then SSM overwrite on 2026-06-15 (v2). Chain ordering is verified; value-equality is inherited from FD-40 gate-close attestation, not re-derived in this thread.

---

## 1. Authority anchors used (on-main)

- Carry-forward thread: `F-Deploy-1_Session_Close_Phase1_GREEN_2026-06-16.md` (Sec 5: "Sec 7 chain put-parameter step ... verify, don't assume").
- Execution requirement: `F-Deploy-1_[3]_Master_Runbook_DRAFT.md` Section 6.3 step 3 (two checks: box `.env` against SSM v2 authority + live auth probe). Note: this supersedes the carry-forward shorthand label "Sec 7" for the chain step location.
- Closed baseline: `F-Deploy-1_FD40_Canon_Credential_Rotation_Gate_Record_DRAFT.md` (gate 2.5 closed, SSM v2 write, box `.env` aligned, canon probe). 

## 2. Live evidence captured (this thread)

### 2.1 PutParameter events for `/episode-metadata/canon/db_password` (CloudTrail)

- **2026-06-14 14:19:58 EDT** - PutParameter, Version 1, overwrite falsey/empty, user `evoni-admin`, source `108.216.160.136`.
- **2026-06-15 09:53:10 EDT** - PutParameter, Version 2, `Overwrite=True`, user `evoni-admin`, source `108.216.160.136`.

### 2.2 ModifyDBInstance events for canon instance `episode-control-dev` (CloudTrail)

- **2026-06-12 10:18:19 EDT** - ModifyDBInstance, `masterUserPassword` present, `ApplyImmediately=False`, user `evoni-admin`, source `108.216.160.136`.
- **2026-06-12 10:35:58 EDT** - ModifyDBInstance, `masterUserPassword` present, `ApplyImmediately=True`, same user/source.
- **2026-06-12 10:57:18 EDT** - ModifyDBInstance, `masterUserPassword` present, `ApplyImmediately=True`, same user/source.
- **2026-06-15 09:50:22 EDT** - ModifyDBInstance, `masterUserPassword` present, `ApplyImmediately=True`, same user/source.

> Note: the 06-15 ordering (ModifyDBInstance -> PutParameter v2) is already on record in FD-40 banner point 4. This note's additive evidence is the 06-12 ModifyDBInstance cluster and the 06-14 SSM v1 create, which extend the timeline backward from FD-40's gate-close pair.

## 3. Findings (evidence-grounded)

1. **RDS and SSM timelines were not in lockstep.**
   - 06-12 shows canon RDS-side password-change activity.
   - SSM first receives this parameter at 06-14 (v1 create), not 06-12.
   - 06-15 shows RDS modify followed by SSM overwrite (v2) ~3 minutes later.

2. **Control-plane chain ordering at gate-close corroborates FD-40 banner point 4.**
   - 06-15 `ModifyDBInstance` (09:50:22) precedes 06-15 PutParameter v2 (09:53:10).

3. **06-12 to 06-14 is evidenced as gate-2.5-RED gap recovery, not benign lag.**
   - On 06-12, canon RDS-side password-change activity existed while no off-box copy was present (no SSM/Secrets authority copy in place at that point).
   - SSM v1 creation on 06-14 is therefore part of recovery from the RED gap.
   - The 06-14 SSM v1 create and the necessity of the 06-15 rotation are motivated by the exposure event recorded in FD-40 Section 3 (see that record for classification). This note does not restate that classification; it cross-references it as the reason the 06-15 rotation followed the 06-14 create.
   - Current authority remains FD-40 gate-close state (SSM v2 backup-of-record).

## 4. Stop Gate #1 resolution

Stop Gate #1 is addressed as a **timeline reconciliation across artifacts**, while preserving the runbook's count-OPEN posture.

- On the **live DB side** (RDS), evidence places two control-plane password-change episodes on record: 06-12 emergency gap-recovery activity and 06-15 gate-close activity. The 06-15 episode followed the 06-14 SSM v1 create; FD-40 Section 3 records the motivation for rotating after that create. The two RDS episodes are thus separated by a documented intervening event, not unexplained.
- On the **SSM parameter side**, evidence shows one create (v1) then one overwrite (v2).
- The apparent one-vs-two ambiguity is explained by asynchronous RDS-vs-SSM writes on the combined timeline.
- Value-count remains unasserted due to CloudTrail redaction, and reconciliation does not depend on forcing a value-count claim.
- This remains consistent with the runbook's corrected count-OPEN block and no-repeat-at-cutover posture.

## 5. Explicit non-claims (to avoid over-read)

- The three 06-12 `ModifyDBInstance` calls are **not** asserted as three distinct final password values; CloudTrail redaction does not permit value-level determination.
- This thread does **not** re-derive 06-15 value equality (`SSM v2 == box .env`) from first principles; it relies on FD-40 gate-close attestation for that link.
- This thread does **not** execute the box-consumption verification (`.env` vs SSM v2 + live auth probe) because box-touch remained out of scope in this read-only session.

## 6. Chain-step status after this verification

- **Control-plane links:** verified on live evidence.
- **Gate-close baseline attestation:** inherited from FD-40 / PR #799 + #801.
- **Consumption link at [3] cold-open:** explicitly deferred to the runbook's Section 6.3 step 3 execution context.

## 7. What this note does and does not do

- **Does:** provide evidence-grounded closure text for Stop Gate #1 framing and chain ordering.
- **Does not:** prime [3], modify any AWS resource, or mutate box/runtime state.
- **Does not:** approve runbook-body edits by itself.

## 8. Session-close state

- Box touch: none
- AWS mutations: none in this thread
- Repo commit/push: filed 2026-06-16 (this commit)
- Draft-only artifact: no - filed; filename retains _DRAFT per FD-40 precedent
