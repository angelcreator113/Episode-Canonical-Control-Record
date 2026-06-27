# F-Deploy-1 G2 §4.2 Sequencing Readiness Decision (Path A, Draft)

**Date:** 2026-06-15  
**Mode:** Path A drafting and confirmation only (no box touch, no shared-state mutation)  
**Decision question:** Can G2 §4.2 (7-day dev burn-in, ≤820 MiB threshold) run parallel to [3] prep, or must it serialize?  
**Answer:** Serialize. Burn-in clock starts post-[3]-gate-open by declared policy.

## 0) Decision

**Burn-in execution serializes after [3] cutover.** The 7-day clock for G2 §4.2 §4.4 does not start during [3] prep; it starts when [3]'s gate-close signals readiness to proceed. This is a governance gate order, not a resource contention.

**Authority:**
- [Combined Restart Session Brief](F-Deploy-1_Combined_Restart_Session_Brief.md#L24): "[3] is therefore the gate-opener for §4.2 — not the other way around."
- [Handoff v15](Prime_Studios_Audit_Handoff_v15.md#L49): "After [3]: F-Deploy-1 toward full close (G2 §4.2 memory gate still owed...)"

## 1) Physical finding (subordinate to gate order)

| Axis | Finding |
|---|---|
| **Machines** | Dev box `i-016395bb5f7a51a0b` (98.93.190.74) and prod `54.163.229.144` are separate EC2 instances. |
| **Workload isolation** | G2 §4.4 runs dev workload on new instance; prod workload remains on `episode-backend` (shared instance). |
| **Expected coupling** | None — prod metrics are expected unchanged by dev burn-in (both documented in G2 Implementation v1.2 §5.4). |
| **Parallel-safe in isolation** | Yes. Separate machines, no shared RDS, no shared alarms or monitoring gate. Running burn-in methodology prep on dev box does not contend with [3] prep. |
| **Does isolation override gate order?** | No. Physical parallel-safety is real but it does not override the declared governance gate dependency. |

## 2) Scope boundary: parallel-safe vs gated

### 2.1 Parallel-safe scope (can prepare during [3] prep)

Methodology finalization only — *does not* include clock start or topology-dependent assertions:

- **Burn-in threshold:** Confirm ≤820 MiB peak resident memory per G2 Implementation §5 (already committed, no change needed).
- **Daily observables:** Finalize the daily measurement cadence, metric extraction patterns, and alert thresholds per §5.4.
- **Clean-close definition:** Lock the 7-day close criteria per §7.3 (all conditions must hold for 7 consecutive calendar days; no partial credit).
- **Abort/restart criteria:** Confirm abort triggers (peak > 820 MiB, OOM, PM2 restart) per §6.3 and restart-clock mechanics (clean restart, no accumulated partial days).
- **Dev-instance readiness checklist:** Verify instance provisioning, IAM role, SG, GitHub Actions secret, SSH access — pre-window validation per §4.1 gates.

### 2.2 Gated scope (must serialize post-[3])

Anything whose correctness depends on observed post-[3] topology:

- **Burn-in clock start:** Begins at §4.3 successful close per §7.1 — only valid post-[3] because [3] completes the topology alignment.
- **Process identity assertion:** Burn-in observables assert against PM2 process names (`episode-api-prod-hotfix` for prod, retired `*-dev` from shared instance). Post-[3] topology is the ground truth for these assertions. Pre-[3] prep must not bake in current (pre-cutover) topology.
- **Credential state assumption:** Burn-in may depend on post-[3] `.env` credential alignment. Current cred state is not valid for post-cutover assertions.
- **Post-[3] metrics baseline:** Prod and dev metrics post-retirement provide the baseline for "unchanged" and "healthy." Pre-[3] metrics are stale.

## 3) Sequencing implication

**Phase sequence:** [3] close → G2 §4.2 methodology finalized → [3] gate-open declaration → burn-in clock start (§4.3) → 7-day observation → close (§7.3).

The two prep work streams can converge on [3]-open:
1. [3] pre-session work: readiness reconciliation (Path A note, this session).
2. G2 §4.2 pre-session work: methodology finalization (parallel-safe scope, above).

Both are ready when [3] opens. Burn-in clock starts immediately after [3] gates close.

## 4) Scope boundary

This record does not:
- start [3],
- start G2 §4.2 burn-in,
- touch either machine,
- finalize burn-in observables or metrics,
- assert against post-[3] state.

This record is a policy and boundary-setting artifact for sequencing clarity.
