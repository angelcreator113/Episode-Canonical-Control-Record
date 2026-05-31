# F-Deploy-1 Phase B G1 — Pre-drafted Amendments

**Status:** Drafted 2026-05-19 (originally mis-labeled as "F-Stats-1 Phase B G1 Four-Amendment Revision"). PE #50 sub-amendment folded in 2026-05-21 via revision-pass. Filename corrected and header reframed 2026-05-22 soak day 3 — the original "F-Stats-1" label was a keystone-confusion (the per-PR `F-Stats-1_PhaseB_G1_Planning.md` is a different document with different section numbering; this file's content is about **F-Deploy-1 Phase B G1** α/β cost-decision planning, not F-Stats-1 raw-SQL consolidation work).

Local-state only, not committed to main during G4 soak.

**Parent document status:** **DOES NOT YET EXIST.** This file is *pre-drafted scope* for the F-Deploy-1 Phase B G1 planning doc that will be authored *during* F-Deploy-1 Phase B G1 — after F-Deploy-1 Phase A close at soak end 2026-05-26. When the parent doc gets authored, its §4.4 / §5.4 / §6.3 / §6.5 sections incorporate the content below (or whatever those section numbers correspond to in the parent doc's authored structure).

**Scope of amendments below:** §4.4 strip-and-replace, §5.4 strip-and-replace, §6.3 reframe, §6.5 new section (with PE #50 NAT baseline shift folded in 2026-05-21). Section numbers reference the *anticipated* structure of the parent F-Deploy-1 Phase B G1 planning doc, not any existing on-disk document.

**Trigger context:** §6.1 close findings on the F-Deploy-1 audit side (EC2 t3.small at 0.74% avg CPU, $320/month AWS bill, 4 unused NAT Gateways as headline finding) revealed that the §4.4/§5.4 cost framing assumed instance class as the dominant cost lever. NAT topology is the larger lever and is α/β-independent. §6.3 product-judgment question is preserved but its scope narrows.

**Methodological note:** The 2026-05-22 rename surfaced a documentation-discipline finding — pre-drafted scope artifacts should be filename-anchored to the keystone+phase+gate they target, not to the keystone+phase+gate they were *thought* to target during drafting. Original mis-labeling ("F-Stats-1") was caught during soak day 3 F-Stats-1 Phase B G1 re-read (which surfaced the section-number mismatch between this file's amendment targets and the actual on-disk `F-Stats-1_PhaseB_G1_Planning.md`).

---

## §4.4 Cost shape — REVISED

α adds approximately $22–30/month for a second t3.small compute instance plus EC2-Other delta (EBS volume, data transfer). This is the compute cost only.

The α decision does **not** drive NAT topology cost. NAT gateway provisioning is independent of the α/β choice — see §6.5. Earlier framing of this section as "doubles EC2 compute cost" remains accurate in shape but understates how small the absolute delta is given that current compute load is 0.74% of a t3.small.

---

## §5.4 Cost shape — REVISED

β has no incremental compute cost. The current single-instance EC2 t3.small runs at 0.74% average CPU; this validates the no-incremental claim — combined dev + prod workload under β fits inside the headroom already provisioned, and instance-class upgrade is not implied by β's adoption.

The β decision does **not** drive NAT topology cost. See §6.5 for NAT considerations, which apply equally to both options.

---

## §6.3 Input 3 — Dev workload mirror requirement — REVISED

Needed: a decision on whether dev needs to mirror prod in workload characteristics for testing fidelity, or whether dev can run on minimal resources.

**What this input gates:** under α, the instance class of the dev box. If dev must mirror prod, α requires a same-class second instance (t3.small). If dev can run minimal, α allows a smaller dev instance class (t3.micro or t3.nano).

**What this input does NOT gate:** the α/β cost decision at the top level. Per §6.1, compute cost under α is small in absolute terms regardless of instance-class choice — the second-instance compute delta is ~$22–30/month at t3.small and lower for smaller classes. The dominant infrastructure cost lever is NAT topology (§6.5), not instance class.

Method: ask Evoni; this is a product-side judgment about how dev is used.

Without this input: α's compute delta is bounded ($22–30/month or lower) but not specified to a single number.

**Status:** Answered 2026-05-20. **DEV CAN RUN MINIMAL.** Rationale: dev serves double duty as development environment and pre-prod staging for solo-developer workflow. Functional parity (env vars, schema, S3 bucket structure, dependency versions) is the operational requirement, not resource parity. Current single-shared-instance evidence at 0.74% avg CPU validates that dev's resource ceiling is well below t3.small. Under α, dev instance class can be t3.micro (or smaller pending memory-ceiling check for the video render path). Decision-implementation detail: confirm worker video-render memory profile before committing to t3.nano; t3.micro is the safer floor.

**Consequence for §4.4:** α compute delta tightens to approximately $10–15/month for a second t3.micro (vs $22–30/month for a second t3.small). Either way, α's compute cost is small in absolute terms relative to NAT topology cost.

---

## §6.5 Input 5 — NAT topology — NEW SECTION

Current state: 2 NAT Gateways provisioned in the existing AWS infrastructure (down from 4 at §6.1 audit time; see PE #50 for the 4 → 2 reduction). The reduction occurred via external action overnight 2026-05-19/20, not as Prime Studios deliberate change, with two EIPs released alongside the NAT removals. Soak observables remained clean across the reduction, providing empirical evidence that the workload tolerated 4 → 2. NAT topology is independent of the α/β choice — both options inherit whatever NAT decisions the post-soak cost-reduction work lands on.

The 4 → 2 reduction partially answers §6.5.2 (reducibility) empirically while leaving §6.5.1 (idle classification of the *retained* 2 NATs) open. This input is decomposed into four sub-questions, each with its own resolution path.

### §6.5.1 Are the 2 retained NAT Gateways actually unused?

The §6.1 finding read four NAT Gateways as unused based on AWS billing console output. Two of those four were removed via external action (PE #50). The retained 2 NATs require route-table audit to confirm idle status: which subnets route through which retained NAT Gateway, and which of those subnets host live workload.

The audit scope now also includes a methodological verification step: confirm that the *retained* 2 NATs were the right 2 to keep. The 4 → 2 reduction was external action without Prime Studios audit discipline applied to the choice of which to remove. The empirical "system tolerated the reduction" finding is real, but the decision-quality of *which* 2 were removed is not vouched for. If the route-table audit reveals that one of the retained NATs is idle while one of the removed NATs was load-bearing, the system tolerated the reduction by routing around the removal — a different finding than "the right 2 were kept."

**Resolution:** route-table audit, deferred post-soak per soak-posture rule (no AWS infrastructure touches during G4).

**Risk if skipped:** the "idle" finding for the retained 2 might be partially wrong (e.g. one carries low-volume but live outbound traffic). Additionally, the methodological gap above might be papered over by the empirical tolerance finding. Acting on the finding without the audit risks removing infrastructure that's actually load-bearing.

### §6.5.2 If unused, are they reducible regardless of α/β?

Partially answered empirically by PE #50. The 4 → 2 reduction occurred without Prime Studios action and the soak tolerated it cleanly, demonstrating that *some* reduction is possible without breaking the workload. Whether the remaining 2 are further reducible depends on §6.5.1's route-table audit.

If §6.5.1 confirms the retained 2 are idle, further reduction is α/β-independent — removing idle NAT Gateways is straightforward cost reduction that doesn't depend on which deploy-tier architecture ships.

**Resolution:** post-soak work. §6.5.1 sequences first (idle confirmation of retained 2), then any further reduction decision sequences after.

**Cost impact framing:** NAT Gateways at approximately $32/month each plus data processing charges. At §6.1 audit time, four NATs represented approximately $128/month of pure overhead before the α/β decision even fires. The 4 → 2 reduction captured approximately $64/month of that already; the remaining $64/month is in play pending §6.5.1.

### §6.5.3 Does α require additional NAT capacity or can the second instance route through existing infrastructure?

Under α, the second EC2 instance needs outbound internet access (npm install, AWS SDK calls, AI API calls). Whether this requires a new NAT Gateway or routes through existing infrastructure depends on subnet placement.

If the second instance lands in a subnet already routing through one of the four existing NATs, no incremental NAT cost. If the second instance lands in a new subnet without an existing NAT route, either a new NAT is provisioned (incremental cost) or the existing topology is reused (no incremental cost, requires subnet placement decision).

**Resolution:** subnet-dependent. Determined at α implementation time if α is chosen. Not a decision input — a decision-implementation detail.

**Reading:** α's NAT cost ceiling is +1 NAT Gateway (~$32/month). α's NAT cost floor is zero (reuse existing). At §6.1 audit time the baseline was $128/month of idle NAT capacity; post-PE-#50 the baseline is $64/month of NAT capacity with idle classification of those 2 pending §6.5.1. Either baseline puts α's NAT impact bounded by existing infrastructure rather than driven by net-new provisioning. The bound holds in both pre- and post-PE-#50 framings — the conclusion about α's NAT impact does not depend on the baseline shift.

### §6.5.4 Does β's PM2-namespace separation have NAT implications?

PM2 namespaces are a process-table concept; they do not affect OS-level network routing. Both namespaces share the same outbound interface, the same route table, the same NAT path.

**Resolution:** probably not — same outbound routing regardless of PM2 namespace. Confirm during β implementation if β is chosen, but no architectural change to NAT topology is implied by β adoption.

---

## Cross-section consistency note

After this revision:

- §4.4 and §5.4 describe compute-only deltas. NAT framing removed from both.
- §6.3 narrowed scope — gates instance class under α, not the α/β top-level decision. Answered 2026-05-20: dev can run minimal.
- §6.5 owns NAT topology as a separate input, applies to both α and β. Baseline shifted from 4 NATs (at §6.1 audit time) to 2 NATs (post-PE-#50, external action 2026-05-19/20). Sub-amendment folded in via revision-pass; sub-question count unchanged (still four).
- §8.3 (existing in pre-revision artifact) names cost as one of three decision rests — that framing still holds, but "cost" now means compute-cost-plus-NAT-topology, decomposed across §6.1, §6.3, §6.5. §8.3 internal-pointer hygiene tweak deferred (not a fifth amendment in the 2026-05-19 set).

---

## Sub-amendment history

Sub-amendment for PE #50 NAT baseline shift folded in 2026-05-21 via revision-pass against §6.5.1, §6.5.2, §6.5.3 plus intro paragraph and cross-section consistency note. §6.5.4 unchanged.
