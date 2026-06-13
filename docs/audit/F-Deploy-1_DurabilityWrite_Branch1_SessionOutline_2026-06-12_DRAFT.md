# F-Deploy-1 Credential Durability Write -- BRANCH 1 SESSION OUTLINE (DRAFT)

> **STAGING SCAFFOLD. AUTHORIZES NO BOX ACTION AND NO SECRET WRITE.**
> Claude-drafted outline for the durability write session. Not reviewed, not
> committed, not canon. Names no value. Templates no `put-parameter` (the put
> stays un-templated by design -- plan Sec 4). The write remains its own
> deliberate, gated Rule 7 session opened separately. Box stays FROZEN. [3] not
> primed. This document changes nothing.

| | |
|---|---|
| **Branch** | **Branch 1** -- operator holds a secure off-box copy of the live post-rotation credential (confirmed in discovery session 2026-06-12). |
| **Gate doc** | `F-Deploy-1_Canon_Credential_Durability_Scoping_Outcome_2026-06-12.md` (provenance gate resolved -> Branch 1). |
| **Authoritative plan** | `F-Deploy-1_Canon_Credential_Durability_Plan_2026-06-12.md` (Path 1, SSM SecureString). **Open and reconcile at write-session start -- this outline defers to it.** |
| **Status** | Staged, unblocked. Write session NOT yet opened. |

---

## 0 -- Provenance note (read first)

This scaffold is derived from the **scoping-outcome gate doc**, which I read in
full. I have **not** read the durability plan itself in this session. Wherever the
exact mechanics live in the plan -- the `put-parameter` write (plan Sec 4) and the
two verification checks (plan Sec 5) -- this outline names the step and defers to
the plan as the source of truth. Do not execute the put from this scaffold; open
the plan.

Branch 1 means the Sec-3 box-read costs (transient third copy, one-uninterrupted-
sequence, no-echo-both-sides, correctness gate shifting onto the re-probe) **do not
apply**. Both Sec-5 verification checks stay independent. That is the entire reason
Branch 1 is the clean path.

---

## 1 -- Pre-session re-verify (fresh window, before anything)

The write session does not inherit this discovery session's state. At its own start:

1. **Wake-up sequence:** `git fetch origin` + `git log --oneline -1 origin/main` +
   `gh pr list`. Live HEAD is ground truth; confirm it against the last known anchor.
2. **Fresh Phase 1 abort re-verify.** Credential work carries momentum risk; re-run
   the abort checks from scratch. Abort remains an explicit success condition.
3. **Re-confirm the Branch-1 premise still holds.** The "held copy is the live
   post-rotation value" fact was true on 2026-06-12. Confirm no second rotation and
   no box `.env` event has occurred since (`bd315e30` reconciled the 06-12 gap --
   anything after it that touched credentials invalidates the held-copy assumption
   and forces a re-scope, not a write).
4. **Confirm box still FROZEN and [3] still not primed.** This write does not change
   either.

If any of 1-4 surprises you, stop and re-scope. Do not write.

---

## 2 -- Rule 7 shape: Draft -> Confirm -> Execute

The write is a single real shared-state mutation. It runs as one gated Rule 7
sequence, not a series of casual commands.

### Draft
- Confirm Branch 1 (held copy) is the put source. No box read.
- Stage the put per **plan Sec 4** (un-templated -- assemble at the session,
  eyes-open, not from a pre-filled template).
- State the two independent verification checks you will run (Sec 3 below).

### Confirm (pre-write gate -- two DISTINCT confirmations, not one)
1. **Caller identity:** `aws sts get-caller-identity` -> returns account / ARN /
   UserId. **It does NOT report region.**
2. **Region, pinned separately:** force `--region us-east-1` explicitly on every AWS
   command in the session (or independently verify the configured default).
   Identity and region are two confirmations. Do not collapse them under momentum --
   this is exactly the step that gets skipped when moving fast.

Genuine stop here. If either confirmation is off, abort.

### Execute
- The single `put-parameter` to SSM SecureString, workstation-side, under operator
  admin identity. **Per plan Sec 4 -- this scaffold does not template it.**

---

## 3 -- Verification (two independent checks -- Branch 1 keeps both)

Run both. Branch 1's whole value is that these stay independent.

1. **Sec-5 step 1 -- hash-based verify.** "Did I store what I intended." Under
   Branch 1 this is a real independent check (it does NOT degrade to "did the put
   transfer faithfully" -- that degradation is the Branch-2 cost you avoided).
2. **Sec-5 step 2 -- canon auth re-probe.** Against `10.0.20.224` / canon VPC.
   **Identity by IP / VPC, never by name string** (standing RDS naming-inversion
   hazard: `episode-control-dev` = canon, `episode-control-prod` = empty fork).
   Reuse the proven gate-2.5 probe path; do **not** invent a new credential path.
   The re-probe likely runs box-side (private canon-VPC address, read-only,
   established SSL probe, inside the freeze envelope).

Exact mechanics for both: **plan Sec 5 is authoritative.** Open it.

---

## 4 -- Constraints held throughout

- Box stays **FROZEN**. The put runs workstation-side; the re-probe is a read-only
  box-side probe inside the freeze envelope. No box mutation, no `.env` touch, no
  restart.
- **Never render the secret.** No `cat .env`, no echo of the value on any terminal.
  (Branch 1 avoids the box read entirely, but the held copy must also never be
  echoed.)
- Reachability split is expected: put = workstation-side, re-probe = box-side. The
  session may legitimately span two surfaces.
- One deliberate sequence. Confirm gates are real stops.

---

## 5 -- What this write does NOT do (carry these boundaries)

- Does **NOT** resolve **AD / AE / AF.** This makes the credential *durable* in SSM;
  it does **not** add an IAM instance profile, does **not** remove static keys from
  `.env` (AD), and touches neither SG finding (AE box SG, AF RDS SG). Those remain
  the post-[3] security sweep. Never collapse durability with AD remediation.
- Does **NOT** prime, schedule, or authorize [3].
- Does **NOT** touch FD-31 (schema-fork + degraded-state legs -- still OPEN until the
  register says otherwise).
- Does **NOT** advance the runbook stitch / PR C. The BvC lean is separately RECORDED
  v1.0 (B selected, C parked) as of #781.

---

*Branch-1 staging scaffold for the F-Deploy-1 durability write. Derived from the
2026-06-12 scoping-outcome gate doc; defers to the durability plan (Sec 4 put, Sec 5
verification) as authoritative at write time. Authorizes no box action, writes no
secret, templates no put-parameter. Box FROZEN; [3] not primed.*
