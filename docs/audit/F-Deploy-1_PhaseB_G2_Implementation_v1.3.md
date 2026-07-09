# F-Deploy-1 Phase B G2 Implementation

**Status:** Phase B G2 implementation plan. Authored 2026-05-26 (v1.0). Revised 2026-05-27 (v1.1) per v1.0 review pass: §7.3 criterion 1 wording clarified, §4.5 split into §4.5.1 / §4.5.2 with explicit ordering, §4.3 dangling cross-reference removed. Revised 2026-05-28 (v1.2) per §4.1 pre-execution AWS discovery: topology assumptions in §4.1 corrected against actual VPC/subnet/IAM/SG facts, three pre-existing production findings (F-Deploy-G1-AD / -AE / -AF) filed and sequenced post-G2. Revised 2026-07-09 (v1.3) per FD-48 (Fix Plan v1.25): citation-repair pass — Planning-doc section citations re-homed to Fix Plan v1.4 §4 + §6, where FD-26/27/28 rationale is carried inline; citation disposition map added at §2.1. No operational content changed.

**Parent keystone:** F-Deploy-1. Phase B G1 closed via PR #716 (Planning doc) + PR #717 (Fix Plan v1.4). G2 is the implementation gate.

**Companion documents:**
- `docs/audit/F-Deploy-1_PhaseB_G1_Planning.md` (Planning doc, PR #716) — pre-decision planning artifact (options, inputs, contingencies). Decision authority for FD-26/27/28 is not here; it is re-homed to Fix Plan v1.4 §6 per FD-48 (Fix Plan v1.25)
- `docs/audit/F-Deploy-1_Fix_Plan_v1.4.md` (Fix Plan v1.4, PR #717) — decision register lock (FD-26/27/28) + G2 entry criteria stub
- `docs/audit/F-Deploy-1_Fix_Plan_v1.5.md` (Fix Plan v1.5, PR #721) — register entries for FD-29/FD-30 (auto-merge-to-dev workflow fixes) + §8 env: pattern audit guard
- This document — how G2 ships

---

## §1 Purpose & scope

This document specifies the execution plan for Phase B G2 of F-Deploy-1: provisioning `episode-dev-backend` (FD-26 + FD-27) and retiring `*-dev` PM2 app definitions on the shared `episode-backend` instance (FD-28). G2 closes when the new dev instance is serving dev workload independently and the shared-instance dev posture is retired.

**In scope:**

- Six-step implementation sequence (§4)
- Per-step observables and thresholds (§5)
- Rollback procedures at each step (§6)
- Burn-in window length, observables, and close criteria (§7)
- G2 close criterion at full specificity (§8)
- G2-specific execution risks (§9); entry-criteria-level risk categories per Fix Plan v1.4 §4.2–§4.3

**Out of scope (deferred per Fix Plan v1.4 §7.2):**

- Retained-NAT route-table audit (work item labeled §6.5.1 in Fix Plan v1.4 §7.2; the Planning-doc section that label once named does not exist — see §2.1) — post-soak work, separate from G2. v1.2 update: per §4.1 discovery, the retained NAT Gateways are in a different VPC than `episode-backend` (see §9.6); the post-G2 audit scope of this item is reframed accordingly.
- t3.nano optimization — post-G2 work, gated on memory profile observation
- F-Stats-1 Phase B G2 pilot — separate keystone; unblocks at this doc's G2 close
- Resolution of F-Deploy-G1-AD / -AE / -AF (newly-filed sub-findings, see §9.7) — sequenced post-G2 with the existing v1.5 §8 env: pattern sweep

**Concrete vs abstract command specificity (v1.2 update):** v1.0 and v1.1 deliberately left §4.1's AMI ID, subnet ID, security group ID, and IAM role ARN abstract, to be filled in by the executor against live console state. The pre-execution AWS discovery (run 2026-05-28) made the values concrete enough to lock here. v1.2's §4.1 names the specific resource IDs to use and the rationale for each, replacing v1.1's "preference for an existing subnet already routing through a retained NAT Gateway" — which turned out to be mismatched against the actual topology, see §9.6.

---

## §2 Prior art & inputs

- **This doc §4 (v1.0 origin)** — six-step implementation sequence, with one insertion: §4.2 pre-cutover memory profile check, added per hard-gate decision documented in §4.2 of this doc. Prior revisions attributed the sequence to Planning doc §10, which does not contain it (FD-48; §2.1). Gating authority: Fix Plan v1.4 §4.4.
- **FD-27 (Fix Plan v1.4 §6)** — dev-can-run-minimal close (2026-05-20), carried inline in FD-27's register entry. Anchors §4.1's t3.micro provisioning. Prior revisions cited Planning doc §6.3, which poses the dev-mirror input question but does not record the close (§2.1).
- **FD-27 (Fix Plan v1.4 §6) + Fix Plan v1.4 §4.3** — t3.small fallback if t3.micro memory ceiling insufficient, carried inline in both. Operationalized in §4.2 and §6.1. Prior revisions cited Planning doc §9.1, which does not exist (§2.1).
- **NAT-cost-zero placement assumption (v1.0/v1.1 of this doc)** — attributed by those revisions to a Planning doc §6.5.3 that does not exist (§2.1). **v1.2 finding:** mooted by topology reality (see §9.6). The 2 retained NAT Gateways are in `vpc-09cc6fa2ee3ce35ba` (the prod RDS VPC), not in `vpc-0648ebfe73202e60d` where `episode-backend` runs. Placing `episode-dev-backend` in default VPC alongside prod EC2 does not incur NAT cost because the default VPC uses an IGW, not a NAT, for egress.
- **Fix Plan v1.4 §4** — Phase B G2 entry criteria. This doc inherits §4.1 prerequisites as G2 start gate.
- **Fix Plan v1.4 §4.3** — rollback triggers. This doc operationalizes each trigger as a concrete rollback procedure in §6.
- **Fix Plan v1.5** — FD-29/FD-30 register entries (auto-merge-to-dev workflow fixes); §8 env: pattern audit guard. v1.2 inherits without amendment.
- **PE #48 Phase 2B (May 2026)** — archived provisioning scripts contain dead infrastructure references (e.g. dead staging VPC IDs). Informs §9.3.
- **AWS discovery 2026-05-28** — read-only `aws ec2 describe-*` / `aws iam list-*` batch run before §4.1 execution. Surfaced the concrete IDs locked in v1.2 §4.1 plus the topology mismatch (§9.6) and three pre-existing production findings (§9.7).
- **Existing GitHub Actions secrets inventory** — per-environment secret pattern (`DEV_EC2_HOST`, `PROD_EC2_HOST`, etc.) is the precedent for new `episode-dev-backend` secret provisioning in §4.1. v1.2 update: also visible are `EC2_HOST` (unsuffixed, third secret of unknown current use) and `EC2_SSH_KEY` (private-key storage for the existing `episode-prod-key` keypair).
- **Existing AWS Secrets Manager paths** — `episode-metadata/{env}/database` is the established path pattern. New instance's IAM role needs access to the existing dev path, not a new path.

### §2.1 Citation disposition map (v1.3, per FD-48)

Every Planning-doc section citation carried by v1.2, with its live disposition (all reads against `origin/main`, 2026-07-09) and its re-homed authority. FD-26/27/28 rationale is carried inline in Fix Plan v1.4 §6; entry criteria, observable categories, and rollback triggers in Fix Plan v1.4 §4. The Planning doc (on main) ends at §11; its §6 ends at §6.4; its §9 and §10 have no subsections.

| Cited by v1.0–v1.2 | Live disposition | Re-homed to |
|---|---|---|
| Planning §10 (six-step sequence; rebuild guide) | Exists; contains a does-not-do list, no sequence, no rebuild content | This doc §4 (v1.0 origin); gating authority Fix Plan v1.4 §4.4 |
| Planning §10.3 (retirement steps) | Does not exist | FD-28, Fix Plan v1.4 §6 |
| Planning §12 (AZ parity / α decision) | Does not exist | FD-26, Fix Plan v1.4 §6 |
| Planning §13 (deferred work) | Does not exist | Fix Plan v1.4 §7.2 |
| Planning §9 (risk list) | Exists; unblocks-list, no risk content | Fix Plan v1.4 §4.2–§4.3 |
| Planning §9.1 (t3.small fallback) | Does not exist | FD-27, Fix Plan v1.4 §6; Fix Plan v1.4 §4.3 |
| Planning §6.3 (dev-can-run-minimal close) | Exists; poses the input question, does not record the close | FD-27, Fix Plan v1.4 §6 (close date 2026-05-20 carried inline) |
| Planning §4.4 (α cost framing) | Exists; cost-shape placeholder (`[INPUT NEEDED]`), carries no figure | FD-26, Fix Plan v1.4 §6 (~$10–15/month at t3.micro inline) |
| Planning §6.5.1–§6.5.3 (NAT audit / reduction / cost-zero) | Do not exist | Retained as work-item labels per Fix Plan v1.4 §7.2's usage; substance in this doc §9.6 |
| Planning §6.1 (cost-decomposition observability) | **Resolves as cited** — billing-console cost-decomposition method is in §6.1's text | Unchanged (§4.1 tags item 4) |

Adjacent repair in the same class: v1.0–v1.2 forward-referenced "Fix Plan v1.6" as the G2-close revision slot. Fix Plan v1.6 now exists on main and is an unrelated revision. Those references are generalized to "a Fix Plan revision, numbered at authoring" (§4.6, §6.1, §8, §10, footer).

---

## §3 Status & version history

**Current status:** G2 implementation plan at v1.3. v1.0 published 2026-05-26 as the contract for G2 execution; v1.1 published 2026-05-27 with three doc-hygiene review fixes; v1.2 published 2026-05-28 with §4.1 topology corrections and three filed sub-findings; v1.3 published 2026-07-09 as the FD-48 citation-repair pass (pointers only, no operational change). G2 work has not yet started at v1.3 ship time. The executor (Evoni) ships against this contract at v1.3.

**Version history:**

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-05-26 | Evoni | First authored. Locks the six-step sequence, observables, rollback procedures, 7-day burn-in window, and G2 close criterion. |
| 1.1 | 2026-05-27 | Evoni | §7.3 criterion 1 wording clarified (synthetic peak vs idle baseline). §4.5 split into §4.5.1 (repo-side ecosystem config) and §4.5.2 (SSH retirement) with explicit ordering. §4.3 step 5 dangling §9.5 cross-reference removed. No scope change; substantive edit is §4.5 ordering. |
| 1.2 | 2026-05-28 | Evoni | §4.1 made concrete with discovered AWS resource IDs. Topology assumption corrected: the retained NAT Gateways are in a different VPC than `episode-backend`, so the v1.1 "subnet routing through a retained NAT Gateway" preference is mooted; dev lands in the same public subnet as prod EC2 in the default VPC. §4.1 IAM step reframed: `episode-backend` has no instance profile (filed F-Deploy-G1-AD); dev does not inherit the absence — a new role with explicit permissions is created. §4.1 SG step clarified: new SG created rather than reusing `episode-backend-sg` (filed F-Deploy-G1-AE for the 0.0.0.0/0 ingress). Three pre-existing production sub-findings filed and sequenced post-G2 (§9.7). No scope expansion to F-Deploy-1; findings filed, not resolved. |
| 1.3 | 2026-07-09 | Evoni | Citation-repair pass per FD-48 (Fix Plan v1.25). Planning-doc section citations re-homed to Fix Plan v1.4 §4 + §6, where FD-26/27/28 rationale is carried inline; citation disposition map added at §2.1; stale forward-references to a "Fix Plan v1.6" G2-close slot generalized (that number was consumed by an unrelated revision). No operational content changed — §4.1, §4.2, §4.5, §6, §9.6 (incl. AD/AE/AF) remain sound as written per FD-48's ruling. |

Future revisions are expected if execution surfaces a fact that retroactively requires plan changes (e.g. memory profile in §4.2 reveals t3.micro is insufficient → §4.1 must commit to t3.small, requiring a v1.3 revision). Path A discipline applies: in-place edits are acceptable for typo/clarity fixes; substantive plan changes require version bump and explicit author note.

---

## §4 Six-step implementation sequence

Six-step sequence originating in this doc at v1.0 (previously attributed to Planning doc §10 — FD-48, §2.1), with §4.2 inserted as a pre-cutover hard gate. Gating authority: Fix Plan v1.4 §4.4. The full sequence:

| Step | Name | Gate to next step |
|---|---|---|
| §4.1 | Provision `episode-dev-backend` | Instance running, health checks green, GitHub secret + IAM access verified |
| §4.2 | Pre-cutover memory profile check | Synthetic video-render completes within t3.micro memory ceiling; failure routes to §6.1 fallback |
| §4.3 | `deploy-dev.yml` retargeting | First dev deploy lands on new instance and serves dev workload |
| §4.4 | Cutover burn-in window | §7 burn-in window completes clean |
| §4.5 | `*-dev` PM2 app-def retirement (FD-28) | Shared instance's PM2 process tree contains only prod apps; §4.5.1 precedes §4.5.2 |
| §4.6 | Post-retirement verification & G2 close | §8 close criteria all satisfied |

**Hard gates between every step.** Step N+1 does not begin until step N's gate criterion is satisfied. Mid-step rollback procedures in §6.

### §4.1 Provision `episode-dev-backend`

**Scope:** Provision a new EC2 instance per FD-26 / FD-27 specifications, using the concrete resource selections locked at v1.2.

**Concrete resource selections (v1.2):**

- **Instance name:** `episode-dev-backend`
- **Instance class:** t3.micro (per FD-27; t3.small fallback per §6.1 only on §4.2 fail)
- **Availability zone:** us-east-1d (prod-AZ parity per FD-26, Fix Plan v1.4 §6, which carries the AZ-pinned-confound rationale inline; matches `episode-backend`)
- **AMI:** `ami-0030e4319cbf4dbf2` (parity with `episode-backend`'s current image)
- **VPC:** `vpc-0648ebfe73202e60d` (default VPC, where `episode-backend` runs)
- **Subnet:** `subnet-08be1e132edba5bc5` (172.31.16.0/20, public-IP-on-launch=true, the only us-east-1d subnet in the default VPC; `episode-dev-backend` shares this subnet with `episode-backend`, see "Subnet-sharing rationale" below)
- **Key pair:** `episode-prod-key` (reused from `episode-backend`; the private key is already stored in the `EC2_SSH_KEY` GitHub secret, and reuse aligns with FD-26's "operational simplicity for solo-maintainer" rationale)
- **Security group:** **new SG to be created** as part of §4.1 (do NOT reuse `episode-backend-sg = sg-05c3a6ed6eee7b3a6` — see "Security group rationale" below)
- **IAM instance profile:** **new role to be created** as part of §4.1 (no existing instance profile to inherit — see "IAM rationale" below)

**Subnet-sharing rationale (v1.2):** The default VPC contains exactly one subnet per AZ. `episode-backend` occupies the only us-east-1d subnet. The contract's us-east-1d directive (FD-26, Fix Plan v1.4 §6) combined with default-VPC placement therefore necessitates subnet-sharing with `episode-backend`. This is operationally equivalent to placing the two instances in adjacent dedicated subnets, since they remain isolated at the ENI/IP/SG level. The only cost is that a subnet-wide misconfiguration would affect both instances; given the subnet's configuration (public IP on launch, IGW egress) is stable and matches what dev needs, the shared-subnet posture is the simplest correct placement. The NAT-cost-zero framing that v1.0/v1.1 cited as a subnet-selection input (attributed to a Planning doc §6.5.3 that does not exist — §2.1) is mooted by the topology fact recorded in §9.6 — there are no NAT-routed subnets in this VPC.

**IAM rationale (v1.2):** AWS discovery surfaced that `episode-backend` runs with `IamInstanceProfile: null` — no instance profile attached. The mechanism by which the prod app currently authenticates to Secrets Manager, S3, and CloudWatch is opaque from the AWS-side discovery (possible mechanisms: access keys in env vars on disk; inherited credentials from the deploy pipeline's machine; AWS_*  GitHub secrets injected at deploy time). This is filed as F-Deploy-G1-AD (§9.7); its **resolution** is sequenced post-G2 (the prod app currently works, and changing its auth mechanism is outside F-Deploy-1's scope). For `episode-dev-backend`, v1.2 commits to **creating a new IAM role with explicit permissions** rather than mirroring `episode-backend`'s absence-of-profile, on the principle that dev is where we have the opportunity to use the right pattern even if prod is currently wrong. Permissions: read access to `episode-metadata/dev/database` in Secrets Manager, S3 access to dev buckets, CloudWatch Logs write, ECR pull.

**Security group rationale (v1.2):** `episode-backend-sg` (sg-05c3a6ed6eee7b3a6) currently allows SSH (port 22) and application ports (3000, 3002, 80, 443) from `0.0.0.0/0` — internet-wide ingress. This is filed as F-Deploy-G1-AE (§9.7); resolution is sequenced post-G2 (prod has been running with this posture for months and is not actively burning, but the exposure is real and warrants a separate fix). For `episode-dev-backend`, v1.2 commits to **creating a new SG `episode-dev-backend-sg`** with tighter rules rather than reusing `episode-backend-sg`. Same reasoning as the IAM choice: dev gets the right pattern. Concrete rules:

- Inbound SSH (22): maintainer IP only (executor fills in at §4.1 time)
- Inbound HTTPS (443): GitHub Actions runner egress range (executor fills in from current GH docs)
- Inbound HTTP (80): same as 443, only if required by the dev deploy flow; omit otherwise
- Inbound application port (3002): maintainer IP only (for dev observability), or omit if maintainer accesses via SSH tunnel
- Outbound: open (matches `episode-backend` pattern; this is conventional for outbound-everything-allowed)

**Concurrent configuration work:**

1. **GitHub Actions secret.** Add a new secret. Recommended name: `EPISODE_DEV_BACKEND_HOST` (parallel-add pattern; preserves the existing `DEV_EC2_HOST` value as a rollback anchor during §4.3 cutover). The secret value is the new instance's public IP or DNS. Must be in place before §4.3.
2. **IAM role.** Create new role `episode-dev-backend-role` with permissions: Secrets Manager read on `episode-metadata/dev/database`, S3 dev bucket access, CloudWatch Logs write, ECR pull. Create instance profile `episode-dev-backend-profile` wrapping the role.
3. **Security group.** Create new SG `episode-dev-backend-sg` with rules above. SG name pattern matches the `episode-frontend-sg` / `episode-backend-sg` family.
4. **Tags.** At minimum: `Environment=dev`, `Keystone=F-Deploy-1`, `Phase=B`, `Cost-Attribution=dev-isolation`. Cost-attribution tag enables Planning doc §6.1 cost-decomposition observability at billing-console resolution.
5. **Application install.** SSH to instance, install Node.js + PM2, clone the repo, install dependencies. Same provisioning steps as the original `episode-backend` setup; see PE #48 Phase 2B archaeology for what NOT to copy (dead VPC IDs).

**Gate to §4.2:**

- `aws ec2 describe-instances --instance-ids <ID>` returns `State.Name=running` for the new instance
- SSH connectivity verified from maintainer workstation using `episode-prod-key`
- PM2 daemon running, no apps deployed yet (clean process tree)
- IAM role can read `episode-metadata/dev/database` (verified via `aws secretsmanager get-secret-value` from the instance)
- GitHub secret in place (verified by viewing in Settings → Secrets, not by reading the value)

### §4.2 Pre-cutover memory profile check (HARD GATE)

**Scope:** Verify that the t3.micro memory ceiling (1 GiB) is sufficient for the workload's peak memory profile, specifically the video-render path, BEFORE committing to cutover.

This step is the "option 1" placement chosen during planning: the memory check happens pre-cutover as a controlled synthetic test, not post-cutover under live load. Rationale: FD-27 and Fix Plan v1.4 §4.3 frame the t3.small fallback as in-place class change (previously attributed to a Planning doc §9.1 that does not exist — §2.1), which only works clean if the memory ceiling is verified before `*-dev` PM2 retirement in §4.5 — once retirement ships, rollback to shared-instance dev is gone.

**Procedure:**

1. Deploy a minimal app build to `episode-dev-backend` (one-off deploy, not via the production `deploy-dev.yml` workflow — direct PM2 start from a local clone is acceptable).
2. Run a synthetic video-render workload. The synthetic should exercise the highest-memory code path used in dev: full render pipeline, image compositing, Sharp/Canvas operations, queue draining. The synthetic should be representative of the peak, not the average.
3. Monitor memory usage during the synthetic via `pm2 monit` and CloudWatch memory metric (Memory utilization custom metric, since EC2 default metrics do not report memory).
4. Record peak memory usage observed.

**Gate criterion:**

- **Pass:** Peak memory ≤ 80% of t3.micro's 1 GiB ceiling, with no OOM events during or after the synthetic.
- **Fail:** Peak memory > 80% OR OOM event observed OR PM2 process restart during synthetic.

The 80% threshold accounts for OS + Node baseline + PM2 daemon + headroom for unforeseen workload spikes. A pass at 80% leaves 200+ MB of margin; a fail above 80% indicates the workload is too close to the ceiling for safe operation.

**On fail:** route to §6.1 fallback procedure (in-place class change to t3.small). Do not proceed to §4.3 with a known-marginal memory profile.

**Pass:** proceed to §4.3.

### §4.3 `deploy-dev.yml` retargeting

**Scope:** Update `deploy-dev.yml` to target `episode-dev-backend` instead of the shared `episode-backend` instance.

**Changes to `.github/workflows/deploy-dev.yml`:**

1. SSH host secret reference: change from current `DEV_EC2_HOST` (which points at the shared instance) to `EPISODE_DEV_BACKEND_HOST` (added in §4.1 in parallel). After §4.3 ships clean and §4.4 burn-in passes, `DEV_EC2_HOST` may be either deleted or repointed at the new instance for post-cutover hygiene (decided at §4.6).
2. PM2 namespace targeting: remove any `--namespace dev` flags or `*-dev` app references. The new instance runs a single PM2 process tree with no namespacing.
3. Deploy path: confirm the deploy target directory on the new instance matches the workflow's expected path.
4. **v1.2 audit note:** per FD-29/v1.5 §8, this workflow file is one of the three remaining unaudited workflows for the env: pattern guard. The §4.3 retargeting touch is the natural opportunity to fold the env: audit into the same PR rather than waiting for a separate sweep. Executor decision at §4.3 time; not strictly required for retargeting to be correct.

**Procedure:**

1. Branch from main: `claude/f-deploy-1-phase-b-g2-deploy-dev-retarget` (or matching name).
2. Edit `deploy-dev.yml`.
3. Open PR. Pipeline runs FD-5 required checks (Cost Exposure Audit, Tests, Route Validation) + Auto-merge to Dev. Same hardened-pipeline stack as PR #716, PR #717, PR #719, PR #720, PR #721.
4. Review the PR's diff carefully — workflow file changes have full repo-write blast radius if merged with a bug.
5. Merge to main via the standard squash-merge path (no `--admin` needed unless mergeStateStatus is UNSTABLE).
6. Trigger a manual `deploy-dev.yml` run via `workflow_dispatch` or push to the dev branch trigger. First run is the test.

**Gate criterion:**

- Workflow run completes successfully (green status across all steps)
- Deploy artifacts land on `episode-dev-backend`, NOT on `episode-backend`
- PM2 process tree on `episode-dev-backend` shows the deployed apps running
- PM2 process tree on `episode-backend` is unchanged (shared instance still hosting `*-dev` PM2 apps; retirement deferred to §4.5)
- Dev workload functions on the new instance: an HTTP request to the dev endpoint returns expected response

**On fail:** route to §6.2 rollback (revert `deploy-dev.yml` to prior targeting).

### §4.4 Cutover burn-in window

**Scope:** Run dev workload against the new instance for 7 days while shared-instance `*-dev` PM2 apps remain in place as a fallback. No PM2 retirement during burn-in.

Burn-in window specification in §7. Observables in §5.4. Close criteria in §7.3.

**Gate to §4.5:** Burn-in window completes clean per §7.3.

**On fail mid-burn-in:** route to §6.3 (mid-burn-in rollback).

### §4.5 `*-dev` PM2 app-def retirement (FD-28 implementation)

**Scope:** Retire the `*-dev` PM2 app definitions on the shared `episode-backend` instance. After this step, the shared instance hosts only prod apps; dev is fully isolated on `episode-dev-backend`.

**Ordering rationale:** §4.5 splits into §4.5.1 (repo-side ecosystem config update) and §4.5.2 (SSH retirement on the shared instance). §4.5.1 precedes §4.5.2 so that when `pm2 save` in §4.5.2 writes the post-retirement manifest to disk, the repo's ecosystem config (if any) is already in the post-retirement state. The reverse ordering — SSH retirement then PR — creates a window where a shared-instance PM2 restart could replay the pre-retirement manifest from a still-merged repo config. If no ecosystem config is committed to the repo, the window does not exist and direct §4.5.2 proceeds with §4.5.1 trivially satisfied.

#### §4.5.1 Repo-side ecosystem config update (FIRST)

**Procedure:**

1. Locate any committed PM2 ecosystem config in the repo (e.g. `ecosystem.config.js`, `ecosystem.config.json`, or similar) that defines `*-dev` apps. Search the deploy path used by `deploy-dev.yml` and the repo root.
2. **If a committed ecosystem config exists with `*-dev` entries:** Branch from main (e.g. `claude/f-deploy-1-phase-b-g2-ecosystem-config-retire-dev`). Edit the config to remove the `*-dev` entries. Open PR. Pipeline runs the hardened stack. Review diff. Merge to main via standard squash-merge.
3. **If no committed ecosystem config exists OR no `*-dev` entries are present:** §4.5.1 is trivially satisfied. Document the absence (e.g. in the §4.5 PR description or the eventual G2 close note) so the audit trail shows §4.5.1 was checked, not skipped.

**Gate to §4.5.2:**

- Either: the §4.5.1 PR is merged to main with `*-dev` entries removed from the committed ecosystem config.
- Or: §4.5.1 trivially satisfied (no committed ecosystem config, or no `*-dev` entries), and the absence is documented.

#### §4.5.2 SSH retirement (SECOND, gated on §4.5.1)

**Procedure (FD-28 retirement steps per Fix Plan v1.4 §6, made concrete; previously attributed to a planning-doc §10.3 that does not exist — §2.1):**

1. SSH to `episode-backend` (shared instance) using `episode-prod-key`.
2. `pm2 list` — confirm current state: should show prod apps + `*-dev` apps.
3. For each `*-dev` app: `pm2 stop <app-name-dev>` then `pm2 delete <app-name-dev>`.
4. `pm2 save` — persist the updated process list to disk. This is the last action of §4.5.2 and locks the on-disk manifest to match the §4.5.1 merged repo state (or the no-repo-config state).

**Gate criterion (§4.5 overall, checked at §4.5.2 completion):**

- §4.5.1 gate satisfied (PR merged or trivially satisfied) before §4.5.2 began.
- `pm2 list` on shared instance shows only prod apps; zero `*-dev` apps remaining.
- `pm2 save` persisted (verified via `pm2 startup` dry-run showing only prod apps in restart manifest, or via inspection of `~/.pm2/dump.pm2`).
- Shared instance load (CPU, memory) shows no regression vs pre-retirement baseline (some reduction expected as `*-dev` apps stop consuming resources).

**On fail:** route to §6.4 rollback-exhaustion paragraph. After §4.5.2 ships, the planned rollback path narrows significantly.

### §4.6 Post-retirement verification & G2 close

**Scope:** Final verification that the α posture is healthy on both instances and that G2 close criteria (§8) are satisfied.

**Procedure:**

1. Verify §8 close criteria one by one (see §8 for the list).
2. Decide `DEV_EC2_HOST` secret disposition (delete vs. repoint at new instance) and record the decision in the G2 close note.
3. Document G2 close in a Fix Plan revision (numbered at authoring; the "v1.6" slot named by prior revisions was consumed by an unrelated revision — §2.1) or as a standalone G2-close note in the audit directory.
4. Update memory state / onboarding doc to reflect Phase B closed status.

**Gate criterion:** All §8 close criteria satisfied. G2 closes at this step's completion.

---

## §5 Per-step observables & thresholds

Operationalizes Fix Plan v1.4 §4.2 (observable categories) with concrete thresholds where possible. Where a threshold needs live baseline data, the doc names the baseline collection step as a prerequisite.

### §5.1 §4.1 provisioning observables

- **Instance state:** `running` within 5 minutes of `run-instances`. If not running by 5 min, investigate.
- **SSH connectivity:** First SSH session establishes within 1 minute of instance reaching `running`. If not, investigate security group / network ACL.
- **IAM role attachment:** `aws sts get-caller-identity` from inside the instance returns `arn:aws:sts::637423256673:assumed-role/episode-dev-backend-role/<instance-id>` (or equivalent for the v1.2-locked role name). If it returns the EC2 instance default profile or no role, IAM attachment is wrong.
- **Secrets Manager access:** `aws secretsmanager get-secret-value --secret-id episode-metadata/dev/database` returns the secret from the new instance. If access-denied, IAM role permissions are wrong.

### §5.2 §4.2 memory profile observables (THE HARD GATE)

- **Peak memory during synthetic:** Recorded via `pm2 monit` and CloudWatch custom memory metric (provisioned if not already in place — this is one-time setup at §4.1 if not already configured for the existing `episode-backend`).
- **OOM events:** Zero. Any OOM during the synthetic = fail.
- **PM2 process restarts:** Zero. Any restart during the synthetic = fail (could be memory-induced, could be other; either way fail).
- **Threshold for pass:** Peak ≤ 80% of 1 GiB = ≤ 820 MiB. If observed peak is above 820 MiB at any point, this is a fail.

Baseline collection: before running the synthetic, observe idle memory usage (OS + Node + PM2 with no app load) for 5 minutes. Subtract baseline from peak to get "workload memory footprint." Both numbers go in the G2 close documentation.

### §5.3 §4.3 retargeting observables

- **Workflow run status:** Green across all steps. Any red = investigate, do not proceed.
- **Deploy target verification:** SSH to `episode-dev-backend` post-deploy; verify file timestamps on deployed files match the workflow run timestamp. SSH to `episode-backend`; verify file timestamps on the previous dev deploy directory have NOT changed.
- **First HTTP response:** dev endpoint returns 2xx for a known-good GET request. Latency baseline: same order of magnitude as prod's response time for an equivalent request (within 2-3x; the new instance is smaller so some latency increase is expected).

### §5.4 §4.4 burn-in observables

Tracked daily during the 7-day burn-in:

- **`episode-dev-backend` CPU:** Daily average. Watch for trend. Expected: similar to the 0.74% baseline on the shared instance, since workload didn't change, only host.
- **`episode-dev-backend` memory:** Daily peak. Expected: at or below the §4.2 memory profile peak. Any drift upward = investigate.
- **`episode-dev-backend` disk:** Free space trend. Expected: stable. Trend toward exhaustion = investigate.
- **`episode-backend` (prod) metrics:** CPU, memory, error rate, response latency vs pre-G2 baseline. Expected: unchanged (the two instances are physically separate). Any regression = stop-and-investigate per Fix Plan v1.4 §4.3.
- **Dev deploys during burn-in:** All deploys must target `episode-dev-backend`. Spot-check one deploy per day to confirm targeting hasn't drifted.
- **F-Deploy-G1-Y recurrence:** Zero recurrences. Any recurrence = stop-and-investigate per Fix Plan v1.4 §4.3.

### §5.5 §4.5 retirement observables

- **PM2 process count on shared instance:** Before retirement = N (prod + dev count). After = M (prod count only). N - M = number of `*-dev` apps retired. Document N, M, and the retired app names.
- **Shared instance CPU/memory post-retirement:** Some reduction expected. If no reduction observed, the `*-dev` apps weren't actually consuming resources (which means the §5.4 burn-in observations were already in this state — sanity-check that workload truly moved to the new instance).
- **PM2 startup config persisted:** Verified via reboot drill (optional, low priority) or via inspection of `~/.pm2/dump.pm2` content.
- **§4.5.1 PR state:** If a §4.5.1 PR was opened, verify it merged to main before §4.5.2 began. If §4.5.1 was trivially satisfied, the documented absence is the observable.

---

## §6 Rollback procedures

Operationalizes Fix Plan v1.4 §4.3 rollback triggers at the command level for each step.

### §6.1 §4.1 / §4.2 rollback — pre-cutover

**Trigger:** §4.2 memory profile check fails (peak > 820 MiB OR OOM OR PM2 restart during synthetic).

**Procedure:**

1. Do not proceed to §4.3 (retargeting). Shared-instance dev posture remains live; no workflow changes have shipped at this point.
2. Decide: in-place class change to t3.small per FD-27 (Fix Plan v1.4 §6), OR investigate the workload's memory pattern to determine if t3.micro could work with optimization.
3. If in-place change: `aws ec2 stop-instances --instance-ids <ID>`, wait for stopped state, `aws ec2 modify-instance-attribute --instance-id <ID> --instance-type t3.small`, `aws ec2 start-instances --instance-ids <ID>`, wait for running state, re-run §4.2 synthetic against t3.small. New threshold: 80% of t3.small's 2 GiB = ≤ 1.64 GiB.
4. If t3.small passes: update FD-27 in a subsequent Fix Plan revision (instance class changed from t3.micro to t3.small per memory profile fail; cite §6.1 of this doc as evidence). Path A: this is a substantive plan change requiring version bump.
5. If t3.small also fails: this is a Phase B G2 architectural problem, not a class problem. Escalate to a new PE filing; G2 does not ship until resolved.

**Cost:** §6.1 rollback path adds ~$10/month to the α adder if t3.small is the locked class. Total α adder becomes ~$22-30/month at t3.small — this doc's arithmetic on FD-26's inline cost framing (~$10–15/month at t3.micro, Fix Plan v1.4 §6); the Planning doc §4.4 cited by prior revisions carries a cost-shape placeholder and no figure (§2.1). Still small in absolute terms.

### §6.2 §4.3 rollback — workflow retargeting failure

**Trigger:** §4.3 workflow run fails OR deploys land on wrong instance OR dev workload doesn't function on new instance after retargeting.

**Procedure:**

1. Revert the `deploy-dev.yml` change. Either: (a) open a revert PR, or (b) cherry-pick the pre-change state to a new commit on main. (a) is cleaner; (b) is faster if the issue is urgent.
2. Trigger `deploy-dev.yml` to verify it lands back on shared instance correctly.
3. Investigate root cause: wrong secret value, wrong PM2 namespace removal, network issue, application config mismatch. Document the failure mode.
4. Decide: fix forward (new PR with corrected retargeting) or escalate. Either way, §4.4 does not begin until §4.3 gate is achieved on a known-good retargeting commit.

**Cost:** §6.2 rollback adds ~1 day to G2 elapsed time per round-trip. Multiple round-trips suggest a deeper issue that should be a PE filing.

### §6.3 §4.4 rollback — mid-burn-in

**Trigger:** Any §5.4 observable hits a fail threshold during the 7-day window. Most likely fail modes: new instance memory drift upward, prod instance regression, F-Deploy-G1-Y recurrence.

**Procedure:**

1. Decide: pause burn-in (stop the clock on §7's 7-day requirement) and investigate, OR roll back retargeting and restart burn-in after fix.
2. If pause: document the pause start time. Investigation must conclude with a fix and a clean restart of the 7-day window (no partial credit for the days already accumulated). Path A discipline: the burn-in is intentionally conservative; do not shortcut.
3. If roll back: §6.2 procedure (revert `deploy-dev.yml`). Burn-in clock resets when retargeting is re-attempted in a future cycle.

**Decision heuristic:** if the failure mode is on the new instance and could plausibly be fixed in-place (e.g. config tweak), pause. If the failure mode is structural (e.g. networking, IAM, fundamental compatibility), roll back retargeting and re-plan.

### §6.4 §4.5 rollback exhaustion — post-retirement

After §4.5.2 ships, `*-dev` PM2 apps on the shared instance are deleted from disk and from PM2's persisted state. There is no planned rollback path — re-creating `*-dev` apps on the shared instance is rebuild-from-scratch, using FD-28's retirement steps (Fix Plan v1.4 §6) in reverse plus this doc's §4 as the closest available rebuild guide (the Planning doc §10 cited by prior revisions contains no rebuild content — §2.1), and is incident-response territory, not planned rollback. The Path A implication: §4.5.2 should not ship until §4.4 burn-in is unambiguously clean and the executor has confidence the new instance is the durable home for dev workload. If there is any doubt at the §4.5 gate, extend §4.4 burn-in by another 7 days rather than ship §4.5.2 and discover a problem with no rollback. Note that §4.5.1 (repo-side PR) is independently revertable via a follow-up revert PR; §4.5.1 alone does not trigger §6.4.

---

## §7 Burn-in window specification

Closes the Fix Plan v1.4 §4.5 punt: "burn-in window length owned by G2 doc."

### §7.1 Length

**7 days, calendar days, no weekend exclusion.** Matches Phase A G4 soak length (8 days; 7 is the rounded floor). Long enough to observe at least one weekend workload pattern; conservative against the §6.4 rollback exhaustion that follows.

**Start day specification:** Burn-in begins at §4.3 successful close (first dev deploy lands on new instance and serves dev workload). The 7-day window is then 7 calendar days from that timestamp.

**Weekend handling consideration per §9.4:** If §4.3 closes on a Thursday or Friday, the burn-in window will terminate mid-week (Thursday/Friday + 7 = Thursday/Friday again, mid-workweek). This is acceptable. If §4.3 closes on a Saturday or Sunday, the burn-in terminates on a weekend, which is suboptimal (observability response degraded on weekends for a solo maintainer). Mitigation: schedule §4.3 close for a Monday-Wednesday if possible, accepting up to 2-3 day calendar slip if §4.3 readiness lands on a weekend.

### §7.2 Observables tracked during burn-in

See §5.4 for the per-day observable list. Operational discipline during burn-in:

- Spot-check observables at least once per day.
- Any threshold breach triggers §6.3 evaluation (pause or rollback).
- Document daily check timestamps even if all observables are clean. Per Path A: clean evidence is still evidence and the record matters at §8 close.

### §7.3 Burn-in close criteria

Burn-in closes clean when ALL of the following hold for 7 consecutive calendar days:

- `episode-dev-backend` memory peak ≤ §4.2 measured synthetic peak + 10% (allows for natural drift; large deviation = investigate)
- `episode-dev-backend` no OOM events
- `episode-dev-backend` no PM2 process restarts other than deliberate deploys
- `episode-backend` (prod) metrics unchanged vs pre-G2 baseline (within normal variance)
- Zero F-Deploy-G1-Y recurrences across the window
- All dev deploys during the window landed on `episode-dev-backend` (no targeting drift)
- Zero unplanned escalations or PE filings against the G2 execution

If all hold: §4.4 gate passes, §4.5 (PM2 retirement) becomes the next executable step.
If any fails at any point during the window: §6.3 procedure. The 7-day clock resets when retried.

---

## §8 G2 close criterion

G2 closes when ALL of the following are true:

1. `episode-dev-backend` provisioned per §4.1 and continuously running for at least the full burn-in window + post-retirement period.
2. §4.2 memory profile check passed at locked instance class (t3.micro per FD-27, or t3.small if §6.1 fallback fired, which would require documentation in a subsequent Fix Plan revision).
3. `deploy-dev.yml` retargeted to new instance per §4.3, with at least one successful end-to-end deploy completed.
4. 7-day burn-in window completed clean per §7.3.
5. `*-dev` PM2 app definitions retired from shared `episode-backend` instance per §4.5.2; PM2 process tree on shared instance contains only prod apps.
6. PM2 ecosystem config in repo (if any) updated to remove `*-dev` entries per §4.5.1; updates merged to main. If no committed ecosystem config existed, the documented absence satisfies this criterion.
7. Both instances healthy and serving their respective workloads (dev on `episode-dev-backend`, prod on `episode-backend`).
8. G2 close documented in a Fix Plan revision or named G2-close note on main, also carrying the §4.2 memory profile observations and the FD-27 confirm-or-revise.

At G2 close, F-Deploy-1 Phase B is fully closed. Downstream keystones unblock per Fix Plan v1.4 §7.2:

- F-Stats-1 Phase B G2 pilot becomes executable (the dev/prod isolation that motivated α is now real)
- F-AUTH-1 fix execution (the v9 fix sequence's first post-F-Deploy-1 keystone) unblocks
- The downstream sequence F-App-1 → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 → F-Sec-3 inherits unblocking from F-AUTH-1's progression

---

## §9 G2-specific risks

Entry-criteria-level risk categories are Fix Plan v1.4 §4.2–§4.3's (memory ceiling, prod-instance regression, deploy-targeting error, F-Deploy-G1-Y recurrence) and are not duplicated here. Prior revisions attributed a risk list to Planning doc §9, which contains no risk content (§2.1). G2 doc §9 adds risks specific to execution, grounded in past evidence rather than speculation.

### §9.1 GitHub Actions secret provisioning gap

`deploy-dev.yml` retargeting in §4.3 will fail if the GitHub Actions secret pointing at the new instance host is not in place at workflow-run time. Established secret pattern in the repo is per-environment (`DEV_EC2_HOST`, `PROD_EC2_HOST`).

**Mitigation:** §4.1 names secret provisioning as concurrent setup work, with the §4.1 gate including secret-in-place verification. The check is "secret exists in Settings → Secrets" not "secret value is correct" (no way to verify the value without running the workflow). First §4.3 workflow run is the value verification.

### §9.2 IAM role / Secrets Manager access

The new instance must be able to read `episode-metadata/dev/database` from Secrets Manager. v1.2 update: the established access pattern at the prod tier is **not** instance-profile based (see F-Deploy-G1-AD in §9.7); dev does not inherit that. §4.1 creates a new role + instance profile for dev with explicit permissions on `episode-metadata/dev/database`. The mitigation pattern is unchanged from v1.1's framing — verify access at §4.1 gate, before declaring §4.1 gate passed.

**Mitigation:** §4.1 gate includes the explicit `aws secretsmanager get-secret-value` verification from inside the instance. If access fails at §4.1, fix IAM role permissions before declaring §4.1 gate passed.

### §9.3 Stale provisioning template reuse

Archived provisioning scripts (e.g. `setup-rds.ps1` removed in PE #48 Phase 2B) contained hardcoded infrastructure IDs including dead VPCs. Risk: reusing snippets from archived scripts could pull in stale references that don't exist in current AWS state. v1.2 update: the AWS discovery batch surfaced an additional stale-routing finding — the default VPC's main route table contains an `active` route for `10.2.0.0/16` with no gateway or NAT target. This is a stale route to a since-deleted VPC peering or VPN. Does not block §4.1 but is worth filing as a minor cleanup item; not formally a sub-finding because it has no operational impact.

**Mitigation:** Provision against live console state, verifying each ID via `aws ec2 describe-vpcs`, `aws ec2 describe-subnets`, `aws iam list-roles` before committing to `aws ec2 run-instances` command construction. Do not copy-paste from archived scripts in `scripts/deploy/` (most were deleted in PE #48 anyway; remaining ones are not authoritative). v1.2 §4.1 locks the concrete IDs against the 2026-05-28 discovery batch, removing this risk for §4.1 itself.

### §9.4 Burn-in window weekend handling

7-day burn-in crosses at least one weekend. Solo-maintainer observability response on weekends is degraded vs weekdays.

**Mitigation:** §7.1 documents the weekend-handling consideration. Practical guidance: target §4.3 close for Monday-Wednesday to land burn-in close on a weekday. Acceptable to slip §4.3 start by up to 2-3 days to align the schedule.

### §9.5 `[skip-automerge]` token usage during retargeting PR

§4.3 retargeting PR is a workflow file change — it might warrant the `[skip-automerge]` token if the change should not trigger auto-merge to dev. Precedent: Fix Plan v1.3, v1.4, v1.5 ship plans used the token for doc-only PRs that shouldn't merge to dev branch.

**Mitigation:** The retargeting PR's intent is to update the dev deploy workflow itself; auto-merging the PR to dev branch is desirable (the dev branch should pick up the new workflow). So `[skip-automerge]` should NOT be used for §4.3's PR. This is opposite to the v1.3/v1.4/v1.5 doc PRs. Document the decision in the PR description. v1.2 note: with FD-30 (Fix Plan v1.5) live, the merge-to-dev job now surfaces correctly as `skipped` rather than red X when the token is used; the cosmetic concern that may have biased prior decisions is gone.

### §9.6 Topology framing PE — actual VPC/NAT topology differs from audit assumption

**v1.2 addition.** v1.0/v1.1 of this doc (citing a Planning doc §6.5.3 that does not exist — §2.1) assumed `episode-backend` runs in a VPC with retained NAT Gateways routing private subnets, and that placing `episode-dev-backend` in a NAT-routed subnet would keep α's incremental NAT cost at zero. The 2026-05-28 AWS discovery surfaced the actual topology:

- `episode-backend` runs in `vpc-0648ebfe73202e60d` (the AWS default VPC). Default VPC uses an Internet Gateway (`igw-0a55aea16c7c93838`) for egress. No NAT involved.
- The 2 retained NAT Gateways are in `vpc-09cc6fa2ee3ce35ba` (a different VPC, the prod RDS VPC). They serve resources in that VPC, not in the default VPC.
- All `episode-backend`'s default-VPC subnets are public-IP-on-launch with IGW egress.

**Implications for §4.1:** the v1.1 directive "preference for an existing subnet already routing through a retained NAT Gateway" is mooted. Subnet selection for `episode-dev-backend` is driven by the contract's us-east-1d directive (FD-26) and operational parity with `episode-backend`. v1.2 §4.1 locks the placement: default VPC, the only us-east-1d subnet, shared with `episode-backend`.

**Implications for the post-G2 NAT audit (work item labeled §6.5.1 in Fix Plan v1.4 §7.2):** the audit's scope is reframed. The 2 retained NAT Gateways are not idle from the F-Deploy-1 perspective; they are arguably idle from the *whole-AWS* perspective if no resources in `vpc-09cc6fa2ee3ce35ba` use them, but verifying that is outside F-Deploy-1's scope. A separate audit-doc framing PE is the natural home for full reconciliation; v1.2 records this rescoping but does not move the destination forward.

This finding does NOT block §4.1; it confirms what §4.1 should do given live state. It is filed in §9.6 rather than §9.7 because it is a framing/documentation correction, not a production posture finding.

### §9.7 Newly-surfaced pre-existing production findings — F-Deploy-G1-AD / -AE / -AF

**v1.2 addition.** The 2026-05-28 AWS discovery surfaced three pre-existing production findings that are NOT in §4.1's path of execution but should be recorded as F-Deploy-G1 sub-findings for future resolution. Per Path A discipline, these are *filed* in v1.2 but *not resolved* — their fix sequencing is post-G2 alongside the existing v1.5 §8 env: pattern audit-checklist guard sweep. F-Deploy-1's scope is not expanded; these are CI/CD posture observations recorded in the right place.

**F-Deploy-G1-AD: `episode-backend` has no IAM instance profile.** `aws ec2 describe-instances` returns `IamInstanceProfile: null` for the prod EC2. The mechanism by which the prod app authenticates to Secrets Manager, S3, and CloudWatch is opaque from AWS-side discovery. Possible mechanisms: access keys in env vars on disk (security antipattern); inherited credentials via the deploy pipeline; AWS_* GitHub secrets injected at deploy time and persisted; some other mechanism. v1.2 §4.1 does not inherit this posture for dev — dev gets a properly-scoped IAM role. AD's resolution (whether to attach an instance profile to `episode-backend` or to document the current mechanism explicitly) is post-G2.

**F-Deploy-G1-AE: `episode-backend-sg` allows SSH and application ports from 0.0.0.0/0.** Specifically: port 22 (SSH), 3000, 3002, 80, 443 all allow ingress from any IP on the internet. Port 3000 has a tighter rule (only from `sg-0bbe523f9dd31661a`), but the 0.0.0.0/0 rules are independent and active. v1.2 §4.1 does not reuse `episode-backend-sg` for dev — dev gets a new SG with maintainer-IP-restricted SSH and the minimum required application ports. AE's resolution (tightening prod's SG) is post-G2.

**F-Deploy-G1-AF: All three RDS security groups allow Postgres (5432) from 0.0.0.0/0.** Dev RDS SG (`sg-002578912805d1930`), staging RDS SG (`sg-0eb718001b40007f9` — note: actually staging-named SG ingress is 10.1.0.0/16-only, so this is the cleaner of the three; the public-facing rule is on `sg-0ba79cea46f35188f` named `episode-metadata-rds-staging` in default VPC), and prod RDS SG (`sg-0164d0b20fbebacbb`) all permit 5432 ingress from the entire internet. Specific-IP ingress rules in the same SGs are subsumed by the wildcard and are dead config. This is the most serious of the three findings — prod database is internet-facing. AF's resolution is post-G2 with the rest of the security sweep, but its priority within that sweep is higher than AD/AE. Bounded by Postgres authentication strength in the meantime.

**Sequencing of AD/AE/AF resolution:** post-G2, alongside the v1.5 §8 env: pattern sweep of `validate.yml` / `deploy-dev.yml` / `deploy-production.yml`. The pattern naturally extends: G2 close (Fix Plan revision numbered at authoring — §2.1) → security posture sweep → env: workflow audit sweep. None of these are F-Deploy-1's responsibility to fix as scope; they are F-Deploy-1's responsibility to *file* as the audit framework that surfaced them.

---

## §10 Open items / deferred work (post-G2)

Items that depend on G2 close but are not in G2 scope:

| Open item | Why deferred | When |
|---|---|---|
| §4.2 memory profile data (peak, baseline, workload footprint) folded into FD-27 audit trail | Data doesn't exist until §4.2 fires | At G2 close, add to the G2-close Fix Plan revision or G2-close note |
| t3.nano evaluation | Gated on §4.2 + at least one full burn-in cycle of observed memory pattern | Post-G2, if memory profile leaves substantial headroom |
| Retained-NAT route-table audit (work item labeled §6.5.1 in Fix Plan v1.4 §7.2) — scope reframed per §9.6 | Topology fact moved the destination | Post-G2, separate work item, scope reframed per §9.6 |
| Further NAT reduction (labeled §6.5.2 by prior revisions; the label's Planning-doc referent does not exist — §2.1) | Sequenced behind the route-table audit | Post-route-table audit |
| F-Stats-1 Phase B G2 pilot | Was the architectural motivation for α; pilot becomes executable at this doc's G2 close | At G2 close |
| F-AUTH-1 fix execution | Next keystone in v9 fix sequence | At G2 close |
| F-Deploy-G1-AD / -AE / -AF resolution | Pre-existing production findings, not in F-Deploy-1's fix path | Post-G2 security posture sweep |
| v1.5 §8 env: pattern audit sweep (validate.yml, deploy-dev.yml, deploy-production.yml) | Three workflows still unaudited against FD-29 | Post-G2 workflow audit sweep, possibly overlapping with §4.3's deploy-dev.yml touch |
| Topology framing PE (full reconciliation of audit's "shared single EC2" elision vs. actual 5-VPC topology) | Surfaced more fully by v1.2 §4.1 discovery | When convenient post-G2; could land alongside the G2-close Fix Plan revision |
| `10.2.0.0/16` stale route in default VPC main route table | Minor cleanup, no operational impact | Cleanup when convenient, no formal finding filed |

---

## §11 Ship plan

This implementation plan ships in this order:

1. **G2 doc PR opened** on branch `claude/f-deploy-1-phase-b-g2-implementation` (v1.0), `claude/f-deploy-1-phase-b-g2-implementation-v1-1` (v1.1), `claude/f-deploy-1-phase-b-g2-implementation-v1-2` (v1.2), or `claude/f-deploy-1-phase-b-g2-implementation-v1-3` (v1.3 revision), doc-only change. All revisions use `[skip-automerge]` token consistent with Fix Plan v1.4/v1.5.
2. **Pipeline runs.** Same hardened-pipeline stack. Through v1.2, merge-to-dev now surfaces correctly as `skipped` per FD-30 (v1.5).
3. **G2 doc merges to main.** No state change beyond doc-on-main; G2 work has not started.
4. **G2 work begins** as a separate, sequenced executor session. Step 1 of §4 is §4.1 provisioning. Each step's gate is enforced before the next step begins. v1.2 makes §4.1 concrete enough that the executor session can begin immediately at v1.2 merge.

Steps 1-3 are this doc's ship sequence. Step 4 is the G2 work itself and operates against this doc as its contract.

**Rule 7 gates** apply per-step inside §4 work, not just at the doc ship. Each of §4.1, §4.2, §4.3, §4.4, §4.5 (both §4.5.1 and §4.5.2), §4.6 is a Draft → Confirm → Execute boundary for the executor.

---

*End of F-Deploy-1 Phase B G2 Implementation v1.3.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Branch: `claude/f-deploy-1-phase-b-g2-implementation-v1-3` (to be created at file-write time).*
*Date: 2026-07-09.*
*Parent: Fix Plan v1.4 (PR #717, merged 2026-05-26); Fix Plan v1.5 (PR #721, merged 2026-05-28). Citation authority: FD-48 (Fix Plan v1.25, PR #909).*
*Companion: Phase B G1 Planning doc (PR #716, merged 2026-05-26).*
*v1.0: PR #718 (merged 2026-05-26).*
*v1.1: PR #719 (merged 2026-05-28).*
*v1.2: PR #722 (merged 2026-05-28).*
*Successor: TBD. G2 close will be recorded in a Fix Plan revision numbered at authoring time; prior revisions named "v1.6" for that slot, but v1.6 was consumed by an unrelated revision.*
