# F-Deploy-1 Phase B G1 — Planning Artifact (separate-EC2 α vs shared-safe β decision preparation)

| | |
|---|---|
| **Predecessor revisions** | F-Deploy-1 Fix Plan v1.0–v1.3 (Phase A lineage, all on main) |
| **Audit reference** | `docs/audit/F-Deploy-1_G1_Audit.md` (main, merged via PR #698) |
| **Author start date** | 2026-05-19 |
| **Status** | DRAFT — preparation artifact |
| **Scope** | Sub-form B (deploy-dev architectural correction) |
| **Decision gate** | Phase B G1 (deferred — see §1) |

## §1 Purpose and scope

**This document is not the Phase B G1 decision.** It is the input preparation for the decision. The actual α/β commitment ships as a Fix Plan v1.4 (or a separate decision document) once the inputs named in §6 are filled in and the Phase A G4 soak closes.

What this document does:

1. Names the architectural problem sub-form B addresses (§2).
2. Inventories the eleven sub-form B findings the decision must answer for (§3).
3. Describes option α (separate-EC2) in structural terms (§4).
4. Describes option β (shared-safe) in structural terms (§5).
5. Names the inputs needed before α/β can be chosen (§6).
6. Names the contingent decisions that hinge on α/β (§7).
7. Records sub-form D outcome as input per FD-8 (§8).

What this document does NOT do:

- Does not choose α or β.
- Does not commit FD-9's H-1 port-default policy (per FD-9 the H-1 commitment is contingent on α/β).
- Does not ship architectural changes — Phase A G4 soak is running and Phase B is blocked behind soak close per FD-10.
- Does not amend Fix Plan v1.0–v1.3 on main.
- Does not add new findings or revise sub-form classifications from G1 audit.

**Path A discipline note:** Path A means full forensic audit before fixes. Fix-cycle Path A means no decision locks on insufficient evidence. The α/β fork has three pieces of missing input named in §6. Drafting an opinionated recommendation now would lock direction on insufficient evidence. This document stages the decision; the decision fires when inputs land.

## §2 The architectural problem sub-form B addresses

The G1 audit identified five structural properties of the current deploy-dev pipeline that compound to produce the failure modes documented in §2.1–§2.5 of the audit. Sub-form B is the cluster of findings that name these properties:

1. **Shared physical instance.** Dev and prod run on a single EC2 instance, share one PM2 process group, and resolve to the same OS-level resources (disk, network namespace, process table). A `pm2 stop all` issued during dev deploy stops prod processes. (F-Deploy-G1-G.)

2. **Implicit port assignment.** `ecosystem.config.js` defaults `episode-api` to dev port 3002; production binding requires `--env production` flag on the PM2 start command. Missing the flag — as happened in the §12.19 outage — silently binds prod traffic to a process configured for dev. (F-Deploy-G1-H.)

3. **Non-fatal migration failure.** `deploy-dev.yml` treats `MIGRATION_FAILED=true` as a continue condition, restarting PM2 against broken schema state. PM2 reports "online" while routes return 500. (F-Deploy-G1-C + F-Deploy-G1-F.)

4. **Drift between deploy-time and dev-local environments.** `npm ci` on the EC2 box installs versions different from the dev-local `package-lock.json` resolution, surfacing through runtime API breakage. (F-Deploy-G1-B.)

5. **No restart-policy distinction between dev and prod.** Both run with PM2 unlimited restarts on crash. A flapping prod service is indistinguishable from a flapping dev service. (F-Deploy-G1-J.)

The α vs β fork is a question of *whether to address property 1 by physical separation, or by adding safety properties to the shared topology.* Properties 2–5 require fixes regardless of α/β; their fix shape may differ between the two options.

## §3 Sub-form B findings inventory

Eleven findings — eight P0, three P1. All must be addressed by Phase B regardless of α/β choice. Severity and disposition source: v9 §11.5, phase-mapped in v10 §11.5 + Fix Plan v1.0 §12 Appendix A.

### §3.1 `.github/workflows/deploy-dev.yml` (findings A-G)

| ID | Severity | Subject | α-shape | β-shape |
|---|---|---|---|---|
| F-Deploy-G1-A | P0 | Path-ordering: PM2 binary unavailable in early build step | unchanged | unchanged |
| F-Deploy-G1-B | P0 | Dependency/runtime version delta on EC2 vs dev local | unchanged | unchanged |
| F-Deploy-G1-C | P0 | Non-fatal migration handling (`MIGRATION_FAILED=true` continues) | unchanged | unchanged |
| F-Deploy-G1-D | P1 | Disk-cleanup ordering precedes extraction | unchanged | unchanged |
| F-Deploy-G1-E | P1 | Smoke test sequence dumps logs without severity classification | unchanged | unchanged |
| F-Deploy-G1-F | P0 | `/health` success does not imply route-level correctness | unchanged | unchanged |
| F-Deploy-G1-G | P0 | Dev and prod share single EC2 + PM2 process group | **resolved structurally by α** | **requires β-specific guard mechanism** |

**Reading:** F-Deploy-G1-G is the only finding in this group whose fix-shape *depends* on the α/β choice. Findings A-F have the same fix under both options (workflow corrections, build-order hardening, migration-handling rewrite, smoke-test classification). The decision is whether F-Deploy-G1-G goes away because there's nothing to share, or whether F-Deploy-G1-G is replaced by a verifiable safety property on a still-shared topology.

### §3.2 `ecosystem.config.js` (findings H-J)

| ID | Severity | Subject | α-shape | β-shape |
|---|---|---|---|---|
| F-Deploy-G1-H | P0 | Default env block is dev port 3002; prod requires `--env production` flag | FD-9 H-1 still applies (per-box default) | FD-9 H-1 critical (cascading port mistakes on shared box) |
| F-Deploy-G1-I | P1 | `episode-worker` has no `env_production` block | unchanged | unchanged |
| F-Deploy-G1-J | P1 | No PM2 restart-policy difference between dev and prod | per-box restart policies | requires PM2 namespace separation to express |

**Reading:** F-Deploy-G1-H is the FD-9 Option H-1 (flip defaults to prod) decision. The policy applies in both options but the failure mode differs. Under α, missing `--env production` on the prod box defaults to a port the prod box doesn't bind anything else to — symptom is service-unavailable, easy to detect. Under β, missing `--env production` on the shared box defaults to a port that *another process is already bound to* — symptom is silent traffic misrouting, hard to detect.

### §3.3 `.github/workflows/deploy-production.yml` (findings S-U; T resolved at Phase A pre-flight)

| ID | Severity | Subject | α-shape | β-shape |
|---|---|---|---|---|
| F-Deploy-G1-S | P1 | Production deploy is manual-trigger only (`workflow_dispatch`) | unchanged — positive property preserved | unchanged — positive property preserved |
| F-Deploy-G1-T | DEFERRED → resolved at Phase A pre-flight | (see Fix Plan v1.1) | n/a | n/a |
| F-Deploy-G1-U | P0 | Migration step in production deploy uses same non-fatal handling as dev | unchanged — fix follows F-Deploy-G1-C | unchanged — fix follows F-Deploy-G1-C |

**Reading:** Production-deploy findings are α/β-agnostic. Fix shape is identical because the workflow is the same workflow regardless of which physical topology it targets.

### §3.4 Aggregate

- 8 findings α/β-agnostic (same fix either way).
- 3 findings α/β-shaped: F-Deploy-G1-G, F-Deploy-G1-H, F-Deploy-G1-J.

The α/β decision is therefore about three of the eleven Phase B findings, not all eleven. The remaining eight ship through Phase B G2–G5 work the same way either way.

## §4 Option α — separate-EC2

### §4.1 Structural description

Stand up a second EC2 instance dedicated to dev. Migrate the existing instance to prod-only. Each instance runs its own PM2 process group, its own disk, its own network namespace. `deploy-dev.yml` targets the dev box; `deploy-production.yml` targets the prod box. No shared OS-level resource between them.

### §4.2 What α resolves structurally

- **F-Deploy-G1-G** — physical isolation. A failed dev deploy cannot reach the prod box; `pm2 stop all` issued on the dev box only stops dev processes.
- **F-Deploy-G1-H failure mode under α** — missing `--env production` on the prod box produces service-unavailable (no other process bound to the alternative port), surfaces immediately, no silent traffic misrouting.
- **F-Deploy-G1-J shape under α** — restart policies expressed per-box, no PM2 namespace gymnastics needed.

### §4.3 What α does NOT resolve

- Findings A-F still require workflow corrections (path ordering, version drift, migration handling, smoke-test classification, /health-vs-route-correctness). α reduces the *blast radius* of those failures, doesn't eliminate the failure modes themselves.
- Migration failure on the prod box still produces broken prod schema; the migration-handling rewrite (F-Deploy-G1-C / F-Deploy-G1-U) is still required.
- `npm ci` version drift between dev local and dev EC2 still exists — α doesn't address F-Deploy-G1-B.

### §4.4 Cost shape

[INPUT NEEDED — see §6 item 1]

Order-of-magnitude framing: doubles EC2 compute cost for the application tier. Does NOT double RDS, ALB, NAT, WAF, S3 — those are shared services that don't multiply by environment count. If current EC2 cost is `$X/month`, α adds approximately `$X/month` (or less if dev box can run a smaller instance class).

### §4.5 Operational shape

- Two SSH keys, two `/home/ubuntu` directories, two PM2 process tables. Monitoring, log aggregation, and ssh-based diagnostics double or near-double in surface.
- Deploy workflows fork at the EC2 host target. `deploy-dev.yml` and `deploy-production.yml` already exist as separate workflows; under α they target separate hosts instead of separate PM2 env blocks.
- DNS / ALB routing: dev and prod each need their own listener target. Currently shared; under α, split.

### §4.6 Reversibility

α is reversible to β: tear down the dev box, repoint workflows back at shared instance. Costs are sunk EC2 hours and migration-back effort. No data migration required (RDS and S3 are shared by design — see §4.7).

### §4.7 What α does NOT separate

The α/β fork is *deploy-tier* architecture, not full environment separation. Under α:

- RDS database is still shared between dev and prod (prevents data drift from blocking schema work).
- S3 buckets still shared (asset URLs don't fork).
- Cognito user pool still shared (per Decision §9.10 in F-AUTH-1 plan).
- AI API keys (Anthropic, RunwayML, DALL-E 3) still shared.

The split is at EC2 + PM2 only. Cross-tier data and identity surfaces remain shared. This is intentional — the audit identified the *deploy-pipeline* as the failure surface, not the data layer.

## §5 Option β — shared-safe

### §5.1 Structural description

Keep the single EC2 instance. Add safety properties to the shared topology that prevent dev failures from cascading to prod. Express dev and prod as PM2 namespaces (or separate process groups within one PM2 daemon), enforce port binding via hard config that cannot fall through to defaults, gate cross-env operations at the workflow layer.

### §5.2 What β resolves with added safety properties

- **F-Deploy-G1-G** — PM2 namespace separation + workflow guard. `deploy-dev.yml` operates exclusively on the `dev` namespace; never issues `pm2 stop all` (which is the un-namespaced cascade vector). `deploy-production.yml` operates exclusively on the `prod` namespace. Cross-namespace operations require explicit override.
- **F-Deploy-G1-H failure mode under β** — FD-9 H-1 (flip defaults to prod) becomes critical. Missing `--env production` flag now defaults to *prod* port; missing the flag fails *safe* (prod traffic still works, no silent dev binding to prod port). But a misconfigured dev deploy that ports-conflicts with prod still possible.
- **F-Deploy-G1-J shape under β** — restart policies expressed via PM2 namespace metadata. Requires PM2 v6+ namespace feature or equivalent ecosystem.config.js sectioning.

### §5.3 What β does NOT resolve

- Same as α §4.3 — findings A-F still require fixes regardless.
- Safety properties under β are *added* and *must be verified*, not gotten for free. PM2 namespace boundaries are software conventions; a misconfigured deploy script can still break them. Verification is testable but ongoing.
- Cross-namespace cascade paths exist by default in PM2 (e.g. `pm2 stop all` ignores namespaces, `pm2 reload all` ignores namespaces). β requires *workflow-layer* guards against using those un-namespaced commands.

### §5.4 Cost shape

[INPUT NEEDED — see §6 item 1]

Order-of-magnitude framing: no incremental EC2 cost. Existing instance carries both environments. May require instance-class upgrade if combined workload exceeds current capacity — would need workload measurement.

### §5.5 Operational shape

- One SSH key, one `/home/ubuntu`, one PM2 daemon hosting two namespaces. Logs aggregate naturally on one box. `pm2 logs --namespace dev` and `pm2 logs --namespace prod` for filtered views.
- Deploy workflows still target the same host; they target different namespaces. The blast-radius guard lives in workflow definitions, not host topology.
- DNS / ALB routing: unchanged.

### §5.6 Reversibility

β is reversible to α: stand up a second EC2, migrate the dev namespace's PM2 config to it, retire the dev namespace on the original box. Cost is the additional EC2 + migration window. No data migration required.

### §5.7 What β requires that α does not

- Workflow-layer audit of every `pm2` command in `deploy-dev.yml` and `deploy-production.yml` to ensure no un-namespaced operations (`pm2 stop all`, `pm2 reload all`, `pm2 restart all` unscoped).
- ecosystem.config.js restructure to express dev and prod as separate apps within one config, with distinct namespaces, ports, and env blocks.
- Monitoring of namespace-boundary integrity over time (the safety properties have to *stay* true, not just be true at ship time).

## §6 Inputs needed before α/β can be chosen

Three pieces of missing input. The decision should not lock until all three are in hand.

### §6.1 Input 1 — Current EC2 cost baseline and dev workload characteristics

Needed: monthly cost of the current EC2 instance, and a workload measurement that tells us whether dev's portion of the load is light enough to run on a smaller instance class under α.

Method: AWS billing console for current cost; CloudWatch metrics on the existing instance for CPU/memory split by PM2 process group (currently un-namespaced, so this requires PM2 process-level metrics or an estimation pass).

Without this input: α cost framing is qualitative ("doubles EC2") not quantitative ("$X/month becomes $Y/month").

#### §6.1.1 Closure note — verified 2026-05-23 (Phase A G4 soak Day 4)

**Status: CLOSED** on combined cost-export + CloudWatch-Metrics evidence.

Cost baseline (AWS Cost Explorer CSV, Jan-Apr 2026 stable window):

| Component             | Apr 26    | Jan-Apr avg | Doubles under α? |
|-----------------------|-----------|-------------|------------------|
| EC2-Instances (hours) | $22.46/mo | $24.78/mo   | Partial          |
| EC2-Other (EBS, NAT)  | $132.82/mo| $132.29/mo  | Largely fixed    |
| EC2 total             | $155.28/mo| $157.07/mo  | Partial          |
| All AWS services      | $320.87/mo| $451.38/mo* | n/a              |

*Jan 26 inflated by non-recurring OpenSearch ($406) and Q ($197) charges.

App-tier instance: episode-backend, t3.small, us-east-1d, running. Confirmed from EC2 console instance list, 2026-05-23. The $22-25/mo EC2-Instances line is consistent with t3.small on-demand pricing ($15/mo) plus modest EBS-IOPS overhead.

Workload baseline (CloudWatch Metrics → EC2 → 1 week, 2026-05-17 to 2026-05-23):

- **CPUUtilization (episode-backend):** ~0.2% baseline, brief spikes to ~5%, max observed 5.34%. Instance is near-idle; substantial headroom under current workload.
- **NetworkIn/Out:** low and bursty; ~20MB peaks on NetworkIn, ~3-4MB on NetworkOut.
- **StatusCheckFailed (all three variants):** 0 events across the week. Corroborative ambient signal for Phase A G4 soak.
- **Disk metrics on EC2 namespace:** "No data available." Expected — EBS volume metrics live under the EBS namespace, not EC2. Not a real gap.
- **Memory metrics:** not collected. CloudWatch Agent not installed on episode-backend. Recorded as a separate observability gap; follow-up belongs on `Session_PE_Roster.md`, not in this §6.

α/β implications (refining v1.0 §6.1 framing):

- **α adder if dev = t3.micro:** ~$10-13/mo (t3.micro on-demand $7.59/mo + small EBS volume + minor NAT/transfer overhead).
- **α adder if dev = t3.small:** ~$18-20/mo.
- v1.0 §6.1.1's "$15-30/mo" range remains correct for t3.small dev; the lower bound under §6.3's "dev can run minimal" framing extends the range down to ~$10/mo at t3.micro.
- **β:** no incremental cost. episode-backend has substantial CPU headroom; no upgrade pressure from combined dev+prod load at the current workload baseline.

Decision input status for Phase B G1:

- §6.1 (this input):                  CLOSED ✓
- §6.2 (v1.0 §6 cross-reference):     CLOSED ✓
- §6.3 (dev workload mirror):         CLOSED ✓
- §6.4 (G4 soak outcome, bonus):      Day 4 clean; Day 7 final check pending 2026-05-26.

Cost data, workload data, and §6.3's operational framing together support α as cost-feasible (~$10-20/mo adder) and β as cost-trivial ($0 adder, no near-term upgrade pressure). The α/β decision rests on operational preference (structural isolation vs procedural safety), not on quantitative cost or workload constraints.

A separate finding surfaced during §6.1 verification — that the EC2 topology is broader than the v1.0 audit's "single shared EC2" framing assumes — is recorded as a proposed PE roster entry, not folded into §6.1. See `F-Deploy-1_Topology_Framing_PE_Draft.md` (local; for landing on `Session_PE_Roster.md` post-soak).

### §6.2 Input 2 — Fix Plan v1.0 §6 exact framing of α/β

Needed: the original framing of α and β as written in `docs/audit/F-Deploy-1_Fix_Plan_v1.0.md` §6. This planning document re-derives the framing from G1 audit findings + FD-8 summary; v1.0 §6 has the authoritative framing that should be cross-referenced rather than re-derived.

Method: read v1.0 §6 directly. If §6's framing diverges from §4–§5 of this document, this document should be amended to match v1.0 §6 before the decision gate fires.

Without this input: this document might describe α/β in terms that don't match v1.0's authoritative framing.

#### §6.2.1 Closure note — verified 2026-05-23 (Phase A G4 soak Day 4)

**Status: CLOSED.** v1.0 §6.1 read in full and diffed against this document's §4–§5. Structural framing of α and β matches. Three substantive observations from the diff:

1. **Reach overclaim in v1.0 §6.1.1.** v1.0 §6.1.1 lists α as closing findings A, B, D, E, F, G, H, I, J. v1.0 §6.2–§6.7 then walks the same findings as needing fixes regardless of α/β (e.g. §6.2 migration-failure-fatal is described as a Phase B change required under both options; §6.3 route-level health verification is required under both; §6.5 `fuser -k` retirement is required under both). v1.0 §6.1.1's enumeration overstates α's structural reach. This document's §3.4 ("8 findings α/β-agnostic, 3 findings α/β-shaped: G, H, J") is the operative count and is consistent with v1.0 §6.2–§6.7's per-finding treatment. No amendment to this document needed; a future Fix Plan v1.4 should reconcile v1.0's internal inconsistency.

2. **Cost specificity divergence.** v1.0 §6.1.1 quotes "$15-30/month additional AWS cost (one more `t3.small` or `t3.medium`)". This document's §6.1 marks cost as `[INPUT NEEDED]`. This document's framing is stricter and stands — the v1.0 ballpark is plausible but not grounded in current AWS billing data and assumes a specific dev instance class without naming the source of that assumption. §6.1 still requires real billing console + CloudWatch input.

3. **β upgrade caveat.** This document's §5.4 names an instance-upgrade-may-be-required caveat for β if combined workload exceeds current capacity. v1.0 §6.1.2 states "no AWS cost increase" flatly without this caveat. This document's framing is more complete and stands. (Note: in light of §6.3 closure below, this caveat is operative but not near-term.)

Per the planning artifact's §11 step 1: "Read v1.0 §6 to confirm α/β framing matches authoritative source." Confirmed. Framing matches; the divergences are corrections this document already carries.

### §6.3 Input 3 — Dev workload mirror requirement

Needed: a decision on whether dev needs to mirror prod in workload characteristics for testing fidelity, or whether dev can run on minimal resources.

If dev must mirror prod: α requires a same-class second instance, full cost doubling.
If dev can run minimal: α allows a smaller dev instance, partial cost increase.

Method: ask Evoni; this is a product-side judgment about how dev is used.

Without this input: α cost is bounded but not specified.

#### §6.3.1 Closure note — decided 2026-05-23 (Phase A G4 soak Day 4)

**Decision: dev can run minimal resources. Dev is a correctness environment, not a characteristics environment.**

Rationale (per JAWIHP / Evoni, 2026-05-23):

Dev serves correctness, UX flow, integration wiring, and basic regression catch. It is not, and is not intended to be, a characteristics-class test environment — no staging tier exists between dev and prod (solo-developer pattern; staging would add operational overhead with no marginal benefit at current team size).

Characteristics-class failure modes that dev does NOT and is not expected to surface:

- Timeouts and retries cascading into thundering-herd behavior
- Queue backlogs causing stale jobs, duplicate work, or memory pressure
- Database contention/locking under concurrent load
- External API rate limits hit only in concurrent traffic
- CPU-bound transforms (image compositing, AI generation, video) saturating workers and starving request threads

These are observed-in-prod-only failure classes in the Prime Studios stack. Image compositing (Sharp/Canvas), AI generation (Anthropic, RunwayML, DALL-E 3, Replicate), and video/export workflows are specifically exposed to load-shaped failures that single-user dev testing cannot reproduce. The fix for that gap is observability-driven tuning in prod, not load-mirroring in dev.

Tier model under this decision:

- **Dev:** correctness, UX flow, integration wiring, basic regressions.
- **Staging:** does not exist as a separate tier; dev plays the staging role for correctness/integration. (Characteristics-class staging would require a separate environment and is not in scope.)
- **Prod:** real-world characteristics, observability-driven tuning.

Implication for α/β cost framing:

- **Under α:** dev can run a smaller instance class than prod. Cost adder is partial-doubling, not full-doubling. v1.0 §6.1.1's $15-30/mo ballpark aligns with a t3.small dev instance under this framing. The audit's "do not downgrade prod to t3.micro given schema complexity" constraint (Prime Studios infra guidance) applies to prod; under a dev-only role with minimal traffic and correctness-only workload, t3.micro is not obviously ruled out. Concrete instance-class choice deferred to §6.1 (cost input) and Phase B G1 (architectural decision).

- **Under β:** the instance-upgrade caveat in §5.4 is operative but not near-term. Combined workload under current dev-usage pattern (correctness-only, single-developer) does not exceed t3.small headroom in the foreseeable horizon.

Net effect on the α/β decision: the cost asymmetry between α and β is smaller than v1.0 §6.1's framing implied. Both options carry similar order-of-magnitude cost burdens (α adder is a small EC2 instance, not a same-class twin). The decision now rests on operational preference and the structural-isolation-vs-procedural-safety trade-off named in §8.3, not on cost or workload.

### §6.4 Bonus input — Phase A G4 soak outcome

Not strictly required for α/β framing, but should land before the decision ships: G4 soak closes 2026-05-26. If soak completes clean, Phase A is closed and the hardened pipeline assumptions are validated. If soak surfaces an issue, the issue may affect α/β framing (e.g. if soak reveals additional autonomous-actor pressure, the case for α physical isolation gets stronger).

## §7 Contingent decisions hinging on α/β

### §7.1 FD-9 — ecosystem.config.js port-default policy

Per FD-9: recommendation is Option H-1 (flip defaults to prod). Final commitment at Phase B G1 contingent on α/β.

Under α: H-1 still preferred. Each box defaults to its own env; getting the default "right" reduces friction. Failure mode of getting it wrong is contained per-box.

Under β: H-1 critical, not just preferred. The shared box's port collisions are the principal silent-failure mode; default-to-prod makes the safer mistake the easier one.

H-1 is compatible with both α and β; the *strength of preference* shifts.

### §7.2 PM2 namespace adoption

α: optional. Each box has one env's PM2 group; namespacing is a clarity convenience.

β: mandatory. Namespace separation is the structural mechanism by which β achieves safety.

### §7.3 deploy-dev.yml command audit scope

α: minor — verify deploy-dev.yml targets the dev host; existing pm2 commands are scoped to that host's process group implicitly.

β: major — every `pm2` command in deploy-dev.yml must be inspected for un-namespaced cascade vectors. Same for deploy-production.yml.

### §7.4 Reversibility cost

α → β: re-merge two boxes into one; involves ALB rerouting, PM2 reconfiguration, possible downtime window during migration.

β → α: stand up second box, move dev namespace to it, retire from shared box; involves AWS provisioning, DNS routing, possible downtime window during migration.

Both directions reversible; reversibility cost is roughly symmetric.

## §8 Sub-form D outcome as input (per FD-8)

Per FD-8: sub-form D diagnostic outcome is part of the α/β decision input.

**Sub-form D outcome at this writing:** F-Deploy-G1-Y closed per FD-22 as "identified — removal-sufficient" on N=8 evidence with loki isolated. Correlation + sufficiency finding, not causation.

### §8.1 What this means for α/β

The sub-form D outcome removes one argument that *would have* favored α: physical isolation as mitigation against unknown autonomous actors. Pre-FD-22, the framing was "we have an autonomous-PR-opening mechanism we can't identify, so let's physically isolate dev from prod to limit blast radius." Post-FD-22, the mechanism is identified as known tooling (Copilot Workspace, Claude Code, plus the loki extension which is now removed), and N=8 of post-removal pushes have not reproduced the behavior.

This is not an argument *against* α. It's the removal of one specific argument *for* α. The remaining arguments for α — physical blast-radius isolation as a defense-in-depth property — still stand on their own merits. They just don't get the additional weight of "and we don't know what else is in there."

### §8.2 What this means for β

Sub-form D being closed (rather than open with residual mystery) makes β more defensible. Under β, the safety properties have to be *verified* — and verification requires being able to enumerate the actors operating against the box. With autonomous-actor candidate space bounded to known tooling, the enumeration is tractable. With the candidate space unbounded (as it was pre-FD-22), β's safety properties would have an unverifiable assumption baked in.

### §8.3 What this means for the decision *process*

The sub-form D outcome doesn't choose α or β. It changes the *evidence structure* available to the decision:

- The "physical isolation as defense-in-depth against unknown actors" argument for α is weaker.
- The "shared-safe verification is tractable" support for β is stronger.
- The decision now rests on cost (§6.1), workload (§6.3), and operational preference, not on autonomous-actor mystery.

## §9 What this planning artifact unblocks

Nothing on main. This document is a local-state draft prior to Phase A G4 soak completion. It does not change the Fix Plan v1.x lineage on main and does not amend canonical audit content.

What it unblocks *locally*:

- Drafting work during the G4 soak window — passive monitoring of soak observables doesn't require active drafting attention, freeing time for Phase B preparation.
- The Phase B G1 decision firing once §6 inputs land and G4 soak closes — the decision gate has a structured artifact to work from instead of starting from scratch.

## §10 What this planning artifact does NOT do

- Does not commit α or β.
- Does not commit FD-9 H-1 (depends on α/β).
- Does not commit any new Fix Plan decision number — no FD-26+ here. Decisions land when the actual Phase B G1 decision ships.
- Does not modify Fix Plan v1.0–v1.3 on main.
- Does not amend the audit handoff (v10 canonical) on main.
- Does not affect G4 soak criteria or status.

## §11 Path forward

Once Phase A G4 soak closes (2026-05-26) and the §6 inputs are filled in:

1. Read v1.0 §6 to confirm α/β framing matches authoritative source.
2. Fill in §6.1 with EC2 cost + workload data.
3. Fill in §6.3 with dev workload mirror decision.
4. Apply §8 sub-form D outcome to the decision (already documented; this is a confirmation step, not new work).
5. Choose α or β.
6. Lock FD-9 H-1 commitment (or revise) per the choice.
7. Ship the Phase B G1 decision as Fix Plan v1.4 (or a separate `F-Deploy-1_PhaseB_G1_Decision.md` if convention prefers).
8. Open Phase B G2 (implementation) — sub-form B fixes ship through the hardened pipeline that Phase A closure validated.

Until then: this document stays local. Soak monitoring stays passive.

---

*End of F-Deploy-1 Phase B G1 — Planning Artifact (preparation, not decision).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-05-19 (during Phase A G4 soak day 0 of 7).*
*Predecessor: F-Deploy-1 Fix Plan v1.3 (PR #710, merged 2026-05-19T12:54:47Z).*
*Successor: Fix Plan v1.4 or separate decision document, TBD post-soak.*
