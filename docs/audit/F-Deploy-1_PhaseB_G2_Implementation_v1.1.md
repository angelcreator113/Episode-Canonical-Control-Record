# F-Deploy-1 Phase B G2 Implementation

**Status:** Phase B G2 implementation plan. Authored 2026-05-26 immediately after Fix Plan v1.4 merge (PR #717, commit `75f2052a`). Revised 2026-05-27 (v1.1) per v1.0 review pass: §7.3 criterion 1 wording clarified, §4.5 split into §4.5.1 / §4.5.2 with explicit ordering, §4.3 dangling cross-reference removed. Specifies the implementation sequence, observables, rollback procedures, and close criteria for α deployment.

**Parent keystone:** F-Deploy-1. Phase B G1 closed via PR #716 (Planning doc) + PR #717 (Fix Plan v1.4). G2 is the implementation gate.

**Companion documents:**
- `docs/audit/F-Deploy-1_PhaseB_G1_Planning.md` (Planning doc, PR #716) — what was decided and why
- `docs/audit/F-Deploy-1_Fix_Plan_v1.4.md` (Fix Plan v1.4, PR #717) — decision register lock (FD-26/27/28) + G2 entry criteria stub
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
- G2-specific risks not duplicated from Planning doc §9 (§9)

**Out of scope (deferred per Planning doc §13 / Fix Plan v1.4):**

- Exact AWS CLI command syntax with literal flag values — this doc is abstract per planning-time choice. Execution-time fills in AMI ID, subnet ID, security group ID, IAM role ARN against live console state.
- §6.5.1 route-table audit of retained 2 NAT Gateways — post-soak work, separate from G2
- t3.nano optimization — post-G2 work, gated on memory profile observation
- F-Stats-1 Phase B G2 pilot — separate keystone; unblocks at this doc's G2 close

**Abstract vs concrete command specificity:** This doc names what each step must accomplish and what the success criterion is. It does not lock literal AWS CLI invocations. Rationale: execution-time decisions about subnet placement, IAM role selection, and security group composition need live console state (existing subnet IDs, current SG rule sets) that the doc cannot pre-lock without going stale. Concrete commands are the executor's responsibility at G2 ship time, following the gate criteria defined here.

---

## §2 Prior art & inputs

- **Planning doc §10** — six-step implementation sequence at planning level. This doc mirrors §10's structure with one insertion: §4.2 pre-cutover memory profile check, added per hard-gate decision documented in §4.2 of this doc.
- **Planning doc §6.3** — dev-can-run-minimal close (2026-05-20). Anchors §4.1's t3.micro provisioning.
- **Planning doc §9.1** — t3.small fallback if t3.micro memory ceiling insufficient. Operationalized in §4.2 and §6.1.
- **Fix Plan v1.4 §4** — Phase B G2 entry criteria. This doc inherits §4.1 prerequisites as G2 start gate.
- **Fix Plan v1.4 §4.3** — rollback triggers. This doc operationalizes each trigger as a concrete rollback procedure in §6.
- **PE #48 Phase 2B (May 2026)** — archived provisioning scripts contain dead infrastructure references (e.g. dead staging VPC IDs). Informs §9.3.
- **Existing GitHub Actions secrets inventory** — per-environment secret pattern (`DEV_EC2_HOST`, `PROD_EC2_HOST`, etc.) is the precedent for new `episode-dev-backend` secret provisioning in §4.1.
- **Existing AWS Secrets Manager paths** — `episode-metadata/{env}/database` is the established path pattern. New instance's IAM role needs access to the existing dev path, not a new path.

---

## §3 Status & version history

**Current status:** G2 implementation plan at v1.1. v1.0 published 2026-05-26 as the contract for G2 execution. v1.1 revises per v1.0 review pass; G2 work has not yet started at v1.1 ship time. The executor (Evoni) ships against this contract at v1.1.

**Version history:**

| Version | Date | Author | Change |
|---------|------|--------|--------|
| 1.0 | 2026-05-26 | Evoni | First authored. Locks the six-step sequence, observables, rollback procedures, 7-day burn-in window, and G2 close criterion. |
| 1.1 | 2026-05-27 | Evoni | §7.3 criterion 1 wording clarified (synthetic peak vs idle baseline). §4.5 split into §4.5.1 (repo-side ecosystem config) and §4.5.2 (SSH retirement) with explicit ordering. §4.3 step 5 dangling §9.5 cross-reference removed. No scope change; substantive edit is §4.5 ordering (item 3 from v1.0 review). |

Future revisions are expected if execution surfaces a fact that retroactively requires plan changes (e.g. memory profile in §4.2 reveals t3.micro is insufficient → §4.1 must commit to t3.small, requiring a v1.2 revision). Path A discipline applies: in-place edits are acceptable for typo/clarity fixes; substantive plan changes require version bump and explicit author note.

---

## §4 Six-step implementation sequence

Mirrors Planning doc §10 with §4.2 inserted as a pre-cutover hard gate. The full sequence:

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

**Scope:** Provision a new EC2 instance per FD-26 / FD-27 specifications:

- Instance name: `episode-dev-backend`
- Instance class: t3.micro
- Availability zone: us-east-1d (prod-AZ parity per Planning doc §12)
- Outbound internet access: required (npm install, AWS SDK, AI API calls)
- Subnet placement: preference for an existing subnet already routing through a retained NAT Gateway, to keep α's incremental NAT cost at zero per Planning doc §6.5.3

**Concurrent configuration work:**

1. **GitHub Actions secret.** Add a new secret (recommended name: `DEV_EC2_HOST` if the existing one is being replaced, or `EPISODE_DEV_BACKEND_HOST` if both are kept in parallel during cutover). The secret value is the new instance's public IP or DNS. Must be in place before §4.3.
2. **IAM role.** Attach an IAM role with the same permissions as the existing `episode-backend` instance role, or a role with equivalent permissions: read access to `episode-metadata/dev/database` in Secrets Manager, S3 access to dev buckets, CloudWatch logs write, ECR pull. See §9.2 for the access-pattern rationale.
3. **Security group.** Inbound: SSH from maintainer IP, HTTPS from the existing dev workflow's egress range. Outbound: open (matches `episode-backend` pattern). Concrete SG ID determined at execution time against current rules.
4. **Tags.** At minimum: `Environment=dev`, `Keystone=F-Deploy-1`, `Phase=B`, `Cost-Attribution=dev-isolation`. Cost-attribution tag enables Planning doc §6.1 cost-decomposition observability at billing-console resolution.
5. **Application install.** SSH to instance, install Node.js + PM2, clone the repo, install dependencies. Same provisioning steps as the original `episode-backend` setup; see PE #48 Phase 2B archaeology for what NOT to copy (dead VPC IDs).

**Gate to §4.2:**

- `aws ec2 describe-instances --instance-ids <ID>` returns `State.Name=running` for the new instance
- SSH connectivity verified from maintainer workstation
- PM2 daemon running, no apps deployed yet (clean process tree)
- IAM role can read `episode-metadata/dev/database` (verified via `aws secretsmanager get-secret-value` from the instance)
- GitHub secret in place (verified by viewing in Settings → Secrets, not by reading the value)

### §4.2 Pre-cutover memory profile check (HARD GATE)

**Scope:** Verify that the t3.micro memory ceiling (1 GiB) is sufficient for the workload's peak memory profile, specifically the video-render path, BEFORE committing to cutover.

This step is the "option 1" placement chosen during planning: the memory check happens pre-cutover as a controlled synthetic test, not post-cutover under live load. Rationale: Planning doc §9.1 framed the t3.small fallback as in-place class change, which only works clean if the memory ceiling is verified before `*-dev` PM2 retirement in §4.5 — once retirement ships, rollback to shared-instance dev is gone.

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

1. SSH host secret reference: change from current `DEV_EC2_HOST` (which points at the shared instance) to whatever secret name was provisioned in §4.1. If the secret name is the same (`DEV_EC2_HOST` value swapped), no workflow file change is needed — only the secret value changes. If a new name was added in parallel (`EPISODE_DEV_BACKEND_HOST`), the workflow's host reference updates accordingly.
2. PM2 namespace targeting: remove any `--namespace dev` flags or `*-dev` app references. The new instance runs a single PM2 process tree with no namespacing.
3. Deploy path: confirm the deploy target directory on the new instance matches the workflow's expected path.

**Procedure:**

1. Branch from main: `claude/f-deploy-1-phase-b-g2-deploy-dev-retarget` (or matching name).
2. Edit `deploy-dev.yml`.
3. Open PR. Pipeline runs FD-5 required checks (Cost Exposure Audit, Tests, Route Validation) + Auto-merge to Dev. Same hardened-pipeline stack as PR #716 and PR #717.
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
2. **If a committed ecosystem config exists with `*-dev` entries:** Branch from main (e.g. `claude/f-deploy-1-phase-b-g2-ecosystem-config-retire-dev`). Edit the config to remove the `*-dev` entries. Open PR. Pipeline runs the hardened stack (same as PR #716, #717). Review diff. Merge to main via standard squash-merge.
3. **If no committed ecosystem config exists OR no `*-dev` entries are present:** §4.5.1 is trivially satisfied. Document the absence (e.g. in the §4.5 PR description or the eventual G2 close note) so the audit trail shows §4.5.1 was checked, not skipped.

**Gate to §4.5.2:**

- Either: the §4.5.1 PR is merged to main with `*-dev` entries removed from the committed ecosystem config.
- Or: §4.5.1 trivially satisfied (no committed ecosystem config, or no `*-dev` entries), and the absence is documented.

#### §4.5.2 SSH retirement (SECOND, gated on §4.5.1)

**Procedure (planning-doc §10.3 steps, made concrete):**

1. SSH to `episode-backend` (shared instance).
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
2. Document G2 close in a Fix Plan revision (likely v1.5) or as a standalone G2-close note in the audit directory.
3. Update memory state / onboarding doc to reflect Phase B closed status.

**Gate criterion:** All §8 close criteria satisfied. G2 closes at this step's completion.

---

## §5 Per-step observables & thresholds

Operationalizes Fix Plan v1.4 §4.2 (observable categories) with concrete thresholds where possible. Where a threshold needs live baseline data, the doc names the baseline collection step as a prerequisite.

### §5.1 §4.1 provisioning observables

- **Instance state:** `running` within 5 minutes of `run-instances`. If not running by 5 min, investigate.
- **SSH connectivity:** First SSH session establishes within 1 minute of instance reaching `running`. If not, investigate security group / network ACL.
- **IAM role attachment:** `aws sts get-caller-identity` from inside the instance returns the expected role ARN. If it returns the EC2 instance default profile or no role, IAM attachment is wrong.
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
2. Decide: in-place class change to t3.small per Planning doc §9.1, OR investigate the workload's memory pattern to determine if t3.micro could work with optimization.
3. If in-place change: `aws ec2 stop-instances --instance-ids <ID>`, wait for stopped state, `aws ec2 modify-instance-attribute --instance-id <ID> --instance-type t3.small`, `aws ec2 start-instances --instance-ids <ID>`, wait for running state, re-run §4.2 synthetic against t3.small. New threshold: 80% of t3.small's 2 GiB = ≤ 1.64 GiB.
4. If t3.small passes: update FD-27 in a Fix Plan v1.5 revision (instance class changed from t3.micro to t3.small per memory profile fail; cite §6.1 of this doc as evidence). Path A: this is a substantive plan change requiring version bump.
5. If t3.small also fails: this is a Phase B G2 architectural problem, not a class problem. Escalate to a new PE filing; G2 does not ship until resolved.

**Cost:** §6.1 rollback path adds ~$10/month to the α adder if t3.small is the locked class. Total α adder becomes ~$22-30/month at t3.small per Planning doc §4.4 original framing. Still small in absolute terms.

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

After §4.5.2 ships, `*-dev` PM2 apps on the shared instance are deleted from disk and from PM2's persisted state. There is no planned rollback path — re-creating `*-dev` apps on the shared instance is rebuild-from-scratch using Planning doc §10 as the rebuild guide and is incident-response territory, not planned rollback. The Path A implication: §4.5.2 should not ship until §4.4 burn-in is unambiguously clean and the executor has confidence the new instance is the durable home for dev workload. If there is any doubt at the §4.5 gate, extend §4.4 burn-in by another 7 days rather than ship §4.5.2 and discover a problem with no rollback. Note that §4.5.1 (repo-side PR) is independently revertable via a follow-up revert PR; §4.5.1 alone does not trigger §6.4.

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
2. §4.2 memory profile check passed at locked instance class (t3.micro per FD-27, or t3.small if §6.1 fallback fired, which would require Fix Plan v1.5 documentation).
3. `deploy-dev.yml` retargeted to new instance per §4.3, with at least one successful end-to-end deploy completed.
4. 7-day burn-in window completed clean per §7.3.
5. `*-dev` PM2 app definitions retired from shared `episode-backend` instance per §4.5.2; PM2 process tree on shared instance contains only prod apps.
6. PM2 ecosystem config in repo (if any) updated to remove `*-dev` entries per §4.5.1; updates merged to main. If no committed ecosystem config existed, the documented absence satisfies this criterion.
7. Both instances healthy and serving their respective workloads (dev on `episode-dev-backend`, prod on `episode-backend`).
8. G2 close documented in a Fix Plan revision (v1.5 or named G2-close note) on main.

At G2 close, F-Deploy-1 Phase B is fully closed. Downstream keystones unblock per Fix Plan v1.4 §7.2:

- F-Stats-1 Phase B G2 pilot becomes executable (the dev/prod isolation that motivated α is now real)
- F-AUTH-1 fix execution (the v9 fix sequence's first post-F-Deploy-1 keystone) unblocks
- The downstream sequence F-App-1 → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 → F-Sec-3 inherits unblocking from F-AUTH-1's progression

---

## §9 G2-specific risks

Risks not duplicated from Planning doc §9 (memory profile, NAT audit, cutover state loss, scope drift). G2 doc §9 adds risks specific to execution, grounded in past evidence rather than speculation.

### §9.1 GitHub Actions secret provisioning gap

`deploy-dev.yml` retargeting in §4.3 will fail if the GitHub Actions secret pointing at the new instance host is not in place at workflow-run time. Established secret pattern in the repo is per-environment (`DEV_EC2_HOST`, `PROD_EC2_HOST`).

**Mitigation:** §4.1 names secret provisioning as concurrent setup work, with the §4.1 gate including secret-in-place verification. The check is "secret exists in Settings → Secrets" not "secret value is correct" (no way to verify the value without running the workflow). First §4.3 workflow run is the value verification.

### §9.2 IAM role / Secrets Manager access

The new instance must be able to read `episode-metadata/dev/database` from Secrets Manager. Established access pattern: instance IAM role grants per-environment secret-path access. If the new instance's IAM role lacks this permission, the app will fail to start (no DB connection string).

**Mitigation:** §4.1 gate includes the explicit `aws secretsmanager get-secret-value` verification from inside the instance. If access fails at §4.1, fix IAM role permissions before declaring §4.1 gate passed.

### §9.3 Stale provisioning template reuse

Archived provisioning scripts (e.g. `setup-rds.ps1` removed in PE #48 Phase 2B) contained hardcoded infrastructure IDs including dead VPCs. Risk: reusing snippets from archived scripts could pull in stale references that don't exist in current AWS state.

**Mitigation:** Provision against live console state, verifying each ID via `aws ec2 describe-vpcs`, `aws ec2 describe-subnets`, `aws iam list-roles` before committing to `aws ec2 run-instances` command construction. Do not copy-paste from archived scripts in `scripts/deploy/` (most were deleted in PE #48 anyway; remaining ones are not authoritative).

### §9.4 Burn-in window weekend handling

7-day burn-in crosses at least one weekend. Solo-maintainer observability response on weekends is degraded vs weekdays.

**Mitigation:** §7.1 documents the weekend-handling consideration. Practical guidance: target §4.3 close for Monday-Wednesday to land burn-in close on a weekday. Acceptable to slip §4.3 start by up to 2-3 days to align the schedule.

### §9.5 `[skip-automerge]` token usage during retargeting PR

§4.3 retargeting PR is a workflow file change — it might warrant the `[skip-automerge]` token if the change should not trigger auto-merge to dev. Precedent: Fix Plan v1.3 and v1.4 ship plans used the token for doc-only PRs that shouldn't merge to dev branch.

**Mitigation:** The retargeting PR's intent is to update the dev deploy workflow itself; auto-merging the PR to dev branch is desirable (the dev branch should pick up the new workflow). So `[skip-automerge]` should NOT be used for §4.3's PR. This is opposite to the v1.3/v1.4 doc PRs. Document the decision in the PR description.

---

## §10 Open items / deferred work (post-G2)

Items that depend on G2 close but are not in G2 scope:

| Open item | Why deferred | When |
|---|---|---|
| §4.2 memory profile data (peak, baseline, workload footprint) folded into FD-27 audit trail | Data doesn't exist until §4.2 fires | At G2 close, add to Fix Plan v1.5 or G2-close note |
| t3.nano evaluation | Gated on §4.2 + at least one full burn-in cycle of observed memory pattern | Post-G2, if memory profile leaves substantial headroom |
| Planning doc §6.5.1 route-table audit (retained 2 NAT Gateways) | Soak-posture rule applies during G2 in spirit (AWS infrastructure touches limited to scope); fits naturally after G2 close | Post-G2, separate work item |
| Planning doc §6.5.2 further NAT reduction | Sequenced behind §6.5.1 | Post-§6.5.1 |
| F-Stats-1 Phase B G2 pilot | Was the architectural motivation for α; pilot becomes executable at this doc's G2 close | At G2 close |
| F-AUTH-1 fix execution | Next keystone in v9 fix sequence | At G2 close |
| Topology framing PE (audit's "shared single EC2" elision) | Low-priority audit-doc framing fix; not gated by G2 | When convenient; could land alongside Fix Plan v1.5 |

---

## §11 Ship plan

This implementation plan ships in this order:

1. **G2 doc PR opened** on branch `claude/f-deploy-1-phase-b-g2-implementation` (v1.0) or `claude/f-deploy-1-phase-b-g2-implementation-v1-1` (v1.1 revision), doc-only change. v1.0 and v1.1 both used `[skip-automerge]` token consistent with Fix Plan v1.4.
2. **Pipeline runs.** Same hardened-pipeline stack. 8-for-8 expected if clean.
3. **G2 doc merges to main.** No state change beyond doc-on-main; G2 work has not started.
4. **G2 work begins** as a separate, sequenced executor session. Step 1 of §4 is §4.1 provisioning. Each step's gate is enforced before the next step begins.

Steps 1-3 are this doc's ship sequence. Step 4 is the G2 work itself and operates against this doc as its contract.

**Rule 7 gates** apply per-step inside §4 work, not just at the doc ship. Each of §4.1, §4.2, §4.3, §4.4, §4.5 (both §4.5.1 and §4.5.2), §4.6 is a Draft → Confirm → Execute boundary for the executor.

---

*End of F-Deploy-1 Phase B G2 Implementation v1.1.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Branch: `claude/f-deploy-1-phase-b-g2-implementation-v1-1` (to be created at file-write time).*
*Date: 2026-05-27.*
*Parent: Fix Plan v1.4 (PR #717, merged 2026-05-26).*
*Companion: Phase B G1 Planning doc (PR #716, merged 2026-05-26).*
*v1.0: PR #718 (merged 2026-05-26).*
*Successor: TBD. Likely Fix Plan v1.5 at G2 close to record the close in the decision register, fold in §4.2 memory profile observations, and either confirm FD-27 (t3.micro held) or revise FD-27 (t3.small under §6.1 fallback).*
