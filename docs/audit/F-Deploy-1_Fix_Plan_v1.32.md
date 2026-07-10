# F-Deploy-1 Fix Plan v1.32

**P1 (v1.31 §4) EXECUTED and CLOSED 2026-07-10: the FD-57 enablement leg fired as one gated IAM write — inline policy `episode-dev-backend-ssm-agent` added to `episode-dev-backend-role` as a SEPARATE, additively-named policy (the existing seven-statement document untouched, byte-verified) — followed by the named agent-restart contingency (snap `amazon-ssm-agent` restart on the dev box after the first registration poll exhausted), after which the instance registered SSM **Online** within 15 seconds. `AmazonSSMManagedInstanceCore` was read in full and REJECTED on its text: it grants `ssm:GetParameter`/`GetParameters` on `Resource:"*"` — blanket Parameter Store read, an ambient side-door secret surface landing the same register-week P3 makes Secrets Manager access deliberate and scoped. The scoped inline carries four statements and no parameter read. Also recorded here: the #917 merge (9557df38) and its two post-merge verifications, the `DEV_EC2_HOST` secret deletion as-executed (the v1.30 §5 pt 1 rider, double-gated, verified absent by read), the G2 v1.3 §4.6 disposition (resolved DELETE, executed), and the secret-retirement check discipline. Mints no FD. Register tail unchanged: FD-58.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.31 (rewrite-draft record; merged #916, c4840890). Workflow rewrite merged after it: #917, 9557df38, feat(deploy). |
| **Author start date** | 2026-07-10 |
| **Status** | DRAFT v1.32 |
| **Gate effect** | Records two writes executed under their own gates this date (the P1 IAM write; the `DEV_EC2_HOST` secret deletion) and one gated dev-box service action (SSM agent snap restart — Branch B contingency, named before it was needed). CLOSES prerequisite P1 of the v1.31 §4 register with live verification as basis. Advances no other gate. Authorizes no prod-box action. Re-enablement remains untaken, unproposed, and unaffected (`disabled_manually` verified to survive the #917 merge). |

**Basis (live reads and writes 2026-07-10, transcribed from live terminal output, not memory):**

- `aws iam get-policy-version` on `arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore` (default version): full document read. Contains `ssm:GetParameter` + `ssm:GetParameters` on `Resource:"*"` alongside the agent-registration, association, inventory, compliance, and patch actions. Grounds the rejection (§2).
- `aws iam list-attached-role-policies` / `list-role-policies` on `episode-dev-backend-role` (pre-write): zero managed policies; one inline (`episode-dev-backend-role-permissions`) — FD-58's basis re-derived live, not inherited.
- Policy file byte check before the write: first three bytes `7B-0A-20` (`{`, LF, space) — no UTF-8 BOM (`EF-BB-BF`). Written via `[System.IO.File]::WriteAllText` with `UTF8Encoding($false)`, per the standing Windows-encoding hazard class.
- `aws ec2 describe-instances` on i-016395bb5f7a51a0b: AZ `us-east-1d` (document-ARN region match confirmed pre-fire); KeyName `episode-prod-key`; running at 98.93.190.74.
- `aws iam put-role-policy ... --policy-name episode-dev-backend-ssm-agent`: exit 0.
- Post-write readback (`get-role-policy`, both policies): new policy = four statements exactly as drafted (Sids `SSMAgentRegistration`, `SSMRunCommandDocumentRead`, `SSMMessagesChannels`, `EC2MessagesPlane`); original policy = the same seven Sids in the same order (`S3DevBucketsListAndAccess`, `S3DevBucketObjects`, `SQSThumbnailQueue`, `CloudWatchLogsWrite`, `CloudWatchMetricsPut`, `ECRPullEpisodeMetadataApi`, `ECRPullEpisodeMetadataApiRepo`).
- `aws ssm describe-instance-information` first poll: `[]`, exit 0 — a true empty per FD-51 (the read succeeded; the instance was absent). Bounded poll (30s interval): still absent at 19:01:19 local after 8 minutes.
- Dev-box SSH service-form read (read-only, pre-restart): `amazon-ssm-agent.service` systemd unit NOT FOUND; snap `amazon-ssm-agent 3.3.4793.0` present, `enabled`/`active` — running since before the grant, holding pre-grant instance-profile credentials.
- `sudo snap restart amazon-ssm-agent` on the dev box: `Restarted.`; service `enabled`/`active` after.
- Re-poll: **REGISTERED at 19:02:25 local** — `["i-016395bb5f7a51a0b", "Online", "3.3.4793.0", "Ubuntu", "22.04", "2026-07-10T19:02:12.561000-04:00"]`.
- **Pre-ship re-verification (fresh read, maintainer-required closure basis):** `describe-instance-information` unfiltered-fields read — `PingStatus: Online`, `LastPingDateTime: 2026-07-10T19:05:06.545000-04:00` (a heartbeat AFTER the registration ping — the agent is reporting continuously, not just registered once), `AgentVersion: 3.3.4793.0` (`IsLatestVersion: true`), Ubuntu 22.04, private IP 172.31.19.114. Exit 0.
- `gh api .../actions/secrets` (names) piped to `Select-String DEV_EC2_HOST`: empty over a successful call (exit 0 = `gh api` succeeded; PowerShell `$LASTEXITCODE` after `native | Select-String` carries the native status) — `DEV_EC2_HOST` ABSENT, FD-51 satisfied in strong form.
- `git grep -n "secrets.DEV_EC2_HOST" origin/main -- ".github/" "scripts/" "*.yml" "*.yaml" "*.js" "*.sh" "*.ps1"`: empty, exit 1 — zero consumers at deletion time.
- Post-#917 (both earlier this date, same working session): CauseClosed Sec 6 binary check EMPTY on new origin/main (no `push:` exists at any level); `gh workflow list --all`: `Deploy to Development` = `disabled_manually` (224506682) — survived the merge, as v1.31 §5 pt 3 claimed.

## §1 Purpose

Records P1's execution end to end — the decision basis, the write as-executed, the three verification legs with their outputs, and the contingency taken — and closes P1 in the v1.31 §4 prerequisite register with live verification as its authority, per the per-claim-authority rule. Also lands the housekeeping owed from the #917 segment: the merge and its post-merge verifications, the `DEV_EC2_HOST` deletion record, the G2 v1.3 §4.6 disposition, and the check-discipline notes. Performs no first-instance reasoning beyond transcription and live verification.

## §2 P1 execution record

**Decision — scoped inline over `AmazonSSMManagedInstanceCore`, on the policy text, not instinct.** The managed policy was read in full before rejection. Its disqualifying grant: `ssm:GetParameter` + `ssm:GetParameters` on `Resource:"*"` — blanket read of Parameter Store, a parallel secret surface handed to the box ambient. Accepting it would open a side-door secret path in the same register-week P3 (FD-55(b), scope per FD-58) makes Secrets Manager access deliberate, scoped, and gated. Same species as the AD static-keys posture finding and the ambient-credential family FD-58 tightened. The remaining managed-policy surplus (associations, inventory, compliance, patch-snapshot, manifest) is benign-in-kind but unneeded — RunCommand-target minimum only.

**Shape — additive second policy, never a rewrite of the first.** `put-role-policy` against the existing `episode-dev-backend-role-permissions` would replace its whole seven-statement document — a clobber-shaped write. The grant landed as a separately-named inline policy (`episode-dev-backend-ssm-agent`); the original document was never an argument to any write. Rollback is a single `delete-role-policy` touching nothing else. Recorded as a pattern: **additive-second-policy** — the IAM analogue of the additive-supersede convention this register already runs on docs.

**Policy as-executed** (readback-verified statement-for-statement):

1. `SSMAgentRegistration` — `ssm:UpdateInstanceInformation`, `Resource:"*"` (API offers no useful scoping).
2. `SSMRunCommandDocumentRead` — `ssm:GetDocument`, `ssm:DescribeDocument`, scoped to `arn:aws:ssm:us-east-1::document/AWS-RunShellScript` — the only document the rewritten workflow sends. Region confirmed against the instance's AZ (`us-east-1d`) before firing.
3. `SSMMessagesChannels` — the four `ssmmessages` channel actions, `Resource:"*"` (unscopeable).
4. `EC2MessagesPlane` — the six `ec2messages` actions, `Resource:"*"` (unscopeable).

Deliberate exclusions: `ssm:GetParameter(s)`; all association/inventory/compliance/patch actions.

**Verification legs (all three PASS):**

1. **Readback** — new policy matches the draft statement-for-statement; no parameter-read leaked in.
2. **Registration** — not immediate: the first poll was a true empty (exit 0) and the 8-minute bounded poll exhausted, because the snap agent had been running since before the grant, holding stale instance-profile credentials. The **named contingency** (Branch B, specified before it was needed) executed as one gated dev-box action: service-form read first (no deb systemd unit; snap `3.3.4793.0` active), then one `snap restart`. Registration followed within ~15 seconds: **Online**, agent 3.3.4793.0, LastPing 2026-07-10T19:02:12 −04:00. One record correction from the live read: the box is **Ubuntu 22.04**, not 24 — service-form and platform now pinned by output, not recollection.
3. **Original policy untouched** — post-write re-read returned the same seven Sids in the same order; the additive shape did what it promised.

**P1 status: CLOSED.** Both clauses of the v1.31 §4 P1 row are satisfied live: the role carries the SSM permissions (scoped), and `describe-instance-information` returns the instance Online. The rewritten workflow's preflight (which fails fast citing P1) will now find its target.

## §3 #917 and the DEV_EC2_HOST deletion — as-executed record

Attribution: the writes and verifications in this section were executed in the PRIOR segment of this same working session (2026-07-10), before this revision's authoring began — under their own gates, with their own live verifications at execution time. This revision records them; it does not claim them as its own segment's actions.

1. **#917 MERGED** (9557df38, `feat(deploy)`, 286+/355−): `deploy-dev.yml` on main is the SSM RunCommand rewrite recorded at v1.31. Post-merge verifications, both PASS live: (a) CauseClosed Sec 6 binary check EMPTY on the new origin/main — no `push:` exists at any level, commented or otherwise (the stronger form); (b) `Deploy to Development` still `disabled_manually` — v1.31 §5 pt 3's claim tested against runtime state, FD-50 discipline, not assumed from the file.
2. **`DEV_EC2_HOST` deleted** (`gh secret delete`, the day's only GitHub-state write), double-gated per the maintainer's rule. The bare-name grep gate FAILED rightly (30 hits — all record prose and the rewrite's header comment; audit docs always name what they audit); the decisive consumer-syntax check (`secrets.DEV_EC2_HOST` across executable classes) returned empty at exit 1. Verified ABSENT by read: secrets list piped to `Select-String` returned empty over a successful call. No lever can again point the deploy path at the shared box.
3. **G2 Implementation v1.3 §4.6 disposition — resolved DELETE, executed 2026-07-10.** The delete-vs-repoint decision the G2 contract deferred to the close note is taken and done; this entry is its record.
4. **Rider closed:** the v1.30 §5 pt 1 rider (deletion travels with the workflow PR's gate) traveled and landed as specified.

## §4 Check-discipline notes (housekeeping, owed from this date)

1. **Secret-retirement check discipline:** the gate for "is secret X still consumed?" is `git grep "secrets.<NAME>"` across executable classes (`.github/`, `scripts/`, `*.yml`, `*.yaml`, `*.js`, `*.sh`, `*.ps1`) — never a bare-name grep, which audit prose will always trip.
2. **Wrong-in-kind check pattern — three caught this date:** the SG 443/80 spec (deploy path was SSH, reframed at v1.29); the bare-name deletion grep (§3.2 above); a bash-exit-semantics prediction applied to a PowerShell pipeline (`$LASTEXITCODE` after `native | Select-String` carries the native command's status — the empty-at-exit-0 result was the *stronger* pass). Pattern named so the next check gets shaped to its target before it fires.
3. **Windows policy-file hazard, applied not suffered:** IAM policy JSON written no-BOM by construction and byte-verified before the CLI read it. The hazard class is documented; this is its clean application.
4. **CANDIDATE FINDING for the next revision — shared SSH key pair across prod and dev boxes.** The Branch B contingency reached the dev box (98.93.190.74) with `episode-prod-key` — the same key pair as the frozen shared box (`describe-instances` KeyName read, this session). One credential opens both boxes: FD-56's shared-blast-radius species at the transport layer instead of the DB layer. Not minted here (FDs mint in the revision that litigates them); parked deliberately: disposition is a separate dev key pair, or a recorded acceptance of the coupling. Mitigating context for the litigation: FD-57's SSM path exists precisely to make deploy-time SSH unnecessary; the residual exposure is human/ad-hoc SSH.

## §5 Prerequisite register — state after this revision

| # | Prerequisite | State |
|---|---|---|
| P1 | Instance role SSM permissions + registration | **CLOSED (§2)** — verified live, Online |
| P2 | GitHub OIDC provider + `episode-gha-deploy-dev` role | OPEN — gated IAM writes, own draft; natural next enablement action |
| P3 | `episode-metadata/dev/database` + role read statement | OPEN — folds into the FD-45 remediation window (FD-55(b), scope per FD-58) |
| P4 | `scripts/print-db-env.js` | OPEN — code PR, separate, own review |
| P5 | Nginx provisioning on episode-dev-backend | OPEN — read/verify first; provision if absent (gated dev-box action) |

First dispatch remains blocked on P2–P5; re-enablement additionally on the §4.2 memory synthetic (hard gate, unchanged, dev-box patch+reboot first — note: patch+reboot will restart the SSM agent as a side effect; registration should survive it, and the synthetic session verifies that in passing).

## §6 Retained

- Fix Plan v1.31 in full: the rewrite design record, spec deltas 1–3, RF-1–RF-4, merge order (consumed — both merges executed in order), §5 gate posture.
- Fix Plan v1.30, v1.29, v1.28 per v1.31's carriage.
- Freeze posture for prod actions outside ratified gates: unchanged (v1.20, verbatim). The dev-box snap restart touched episode-dev-backend only; episode-backend untouched this segment.
- FD-45 OPEN (tail); FD-56 OPEN — still the FD-45 window's first internal decision (new-app-user vs master, v1.29 §3 corollary); FD-55 decision (b) stands, scope per FD-58.
- §4.2 memory synthetic: OPEN, hard gate, unchanged.

## §7 Register hygiene

- Register tail at v1.32 open: FD-58 (v1.30). Minted here: none. Tail at close: FD-58.
- FD numbers minted only by Fix Plan revisions — conforms (P1's closure is a prerequisite-register state change with live verification as authority; the contingency and platform correction are facts of execution, not findings).
- Closes prerequisite P1 (v1.31 §4). Closes no FD. Advances no gate beyond P1.
- Writes this revision records: `put-role-policy` (IAM, gated, §2); `gh secret delete DEV_EC2_HOST` (GitHub state, double-gated, §3); `snap restart amazon-ssm-agent` (dev-box service action, gated lightweight per the Branch B plan, §2). All other operations read-only.
- Doc-only revision (this file).
- FD-21 closing-keyword check on the commit message before commit (PR references herein — #916, #917 — historical; "CLOSED"/"executed" are register-status forms, no issue-closing syntax adjacent to a PR/issue number).
- Ships with `[skip-automerge]` in the title, PR body via `--body-file`.

---

*End of F-Deploy-1 Fix Plan v1.32 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-10.*
*Predecessor: v1.31 (c4840890, #916); workflow rewrite #917 (9557df38) merged between.*
*Closed: prerequisite P1. Minted: none. Advances no gate beyond P1; authorizes no prod-box action. [skip-automerge]*
