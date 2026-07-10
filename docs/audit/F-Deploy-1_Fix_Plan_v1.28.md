# F-Deploy-1 Fix Plan v1.28

**Doc-vs-live correction FD-54 — G2 §4.1 executed 2026-05-28, unrecorded through five subsequent revisions including G2 Implementation v1.3's "G2 work has not yet started"; live evidence 2026-07-10. Finding FD-55 — the `episode-metadata/{env}/database` Secrets Manager architecture cited by the G2 contract does not exist in the verified regions; §4.1's IAM gate criterion was never verifiable as specced; the real credential mechanism is .env-at-rest (FD-45 surface). §4.1 retroactive gate disposition recorded. §4.3 frontier gate collision with the AllStopped workflow disposition framed for maintainer decision.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.27 (FD-52/FD-53, register-state correction + register leg; merged #912, e288144e) |
| **Author start date** | 2026-07-10 |
| **Status** | DRAFT v1.28 |
| **Gate effect** | Advances no gate. Authorizes no prod-box action. Records live G2 position; corrects doc-vs-live divergence; frames (does not take) the §4.3 workflow re-enablement decision. |

**Basis (live reads 2026-07-10; every AWS/GitHub/on-instance read below run independently by both working sessions this date — instance inspection re-run with `.env` checked by metadata only, contents not re-read):**

- `aws ec2 describe-instances` on tag `episode-dev-backend`: i-016395bb5f7a51a0b, t3.micro, LaunchTime 2026-05-28T22:43:50Z, us-east-1d, subnet-08be1e132edba5bc5, ami-0030e4319cbf4dbf2, key episode-prod-key, 98.93.190.74, instance-profile episode-dev-backend-profile attached, SG sg-06651e212aefa8a66, state running
- `aws iam get-role episode-dev-backend-role`: created 2026-05-28T21:43:19Z, RoleLastUsed 2026-07-10; inline policy `episode-dev-backend-role-permissions`; no attached managed policies
- `aws ec2 describe-security-groups` sg-06651e212aefa8a66: inbound 22 and 3002 from 108.216.160.136/32 only; no 443/80 rules
- `gh api .../actions/secrets`: `EPISODE_DEV_BACKEND_HOST` present; `DEV_DB_HOST` / `DEV_DB_NAME` / `DEV_DB_PASSWORD` / `DEV_DB_USER` also present (pipeline-injection corroboration, §3)
- `git show origin/main:.github/workflows/deploy-dev.yml`: SSH host is `secrets.DEV_EC2_HOST`; no `EPISODE_DEV_BACKEND_HOST` reference
- `aws secretsmanager list-secrets` us-east-1 and us-east-2: both empty (`[]`)
- On-instance (SSH 2026-07-10): `pm2 list` = daemon running, zero apps; `aws` CLI not installed; node v20.20.2 / npm 10.8.2; home contains boot-test/ and user-data-complete.txt (user-data provisioning); /home/ubuntu/.env = 1 line, 51 bytes, `DB_PASSWORD` only, dated 2026-06-12; `/var/run/reboot-required` present, pending package updates; root disk 53% of 7.6 GB
- AllStopped record: `F-Deploy-1_Finding_PMState_AllStopped_2026-06-30.md` (observation) + `F-Deploy-1_AllStopped_CauseClosed_WorkflowCascade_2026-07-01.md` (cause closed: pre-#872 `deploy-dev.yml` run on 2026-06-27, `pm2 stop all` class; run `createdAt 2026-06-27T12:40:14Z`)
- Doc reads: G2 Implementation v1.3 full body (§3 "G2 work has not yet started at v1.3 ship time"; §4.1 spec; §5.1 gate criteria); Fix Plan v1.27 full body (§2 register, §3 frontier, §8 item 3 workflow runtime state); FD-45 state per the v1.27 §5.2 register leg, enumeration exhibited: v1.17 (no FD-45 — pre-mint), **v1.18 (mints FD-45**, dump.pm2 plaintext-credential-at-rest), v1.19 (advanced), v1.20 (re-digest complete), v1.21 (tail; full body), v1.22–v1.27 (full bodies, this session and 07-09) — no closing revision exists anywhere in the chain v1.18→v1.27; FD-45 is OPEN

## §1 Purpose

Records that G2 §4.1 was substantially executed on 2026-05-28 — the day G2 Implementation v1.2 merged (PR #722) — via user-data provisioning, and that no revision between then and now recorded it; v1.3 (2026-07-09) and Fix Plan v1.23–v1.27 all carried §4.1 as unexecuted. Mints FD-54 (the divergence) and FD-55 (the fictional secrets architecture the §4.1 gate depended on). Records the retroactive §4.1 gate disposition against 2026-07-10 live evidence. Frames the §4.3 collision with the AllStopped workflow disposition as the decision now in front of the maintainer. Performs no first-instance reasoning beyond transcription and live verification.

## §2 FD-54 — doc-vs-live divergence on the frontier

**Decision FD-54: G2 §4.1 (provision episode-dev-backend) was executed 2026-05-28, 21:43:19Z (role created) through 22:43:50Z (instance launched), conforming to the v1.2 spec on instance class, AZ, subnet, AMI, key pair, new SG, new IAM role/profile, and GitHub secret provisioning. No Fix Plan or G2 revision recorded the execution. G2 Implementation v1.3 §3 (2026-07-09) states "G2 work has not yet started at v1.3 ship time" — false at authoring by six weeks. Family placement: FD-49 species (prose about state ≠ state), aggravated: the false claim sat in the execution contract itself, on its own frontier.**

Mechanism: the 05-28 provisioning ran via user-data automation (user-data-complete.txt on-instance) on the same day v1.2 shipped, and no session note, PR, or revision captured it. Every subsequent revision inherited "not started" by citation — the FD-53 carry pattern, on the doc-vs-live axis instead of the register axis. Noted for completeness: v1.3's authoring session (07-09) verified citations against origin/main and did not verify execution state against AWS — a verification whose authority did not extend past what it verified, restating the contract's "not started" line unread against live state. FD-53's own mechanism, one day after FD-53 was drafted.

## §3 FD-55 — fictional Secrets Manager architecture

**Decision FD-55: the secret path `episode-metadata/dev/database` — and the entire `episode-metadata/{env}/database` pattern the G2 contract §2 calls "established" — exists in neither us-east-1 (home region of all repo infrastructure) nor us-east-2, both verified empty by live `list-secrets` 2026-07-10. §4.1's gate criterion "IAM role can read episode-metadata/dev/database" and §5.1's corresponding observable were never verifiable as specced. The role's Secrets Manager permission grants read on a nonexistent resource. The operative credential mechanism, consistent with F-Deploy-G1-AD, with the `DEV_DB_*` GitHub Actions secrets present in the repo inventory (pipeline-injected env), and with the 2026-06-27 AllStopped cascade (pre-#872 `deploy-dev.yml`; cause closed 2026-07-01), is .env-at-rest. This is FD-45 surface.**

FD-45 rider: /home/ubuntu/.env on the dev box (1 line, 51 bytes, `DB_PASSWORD` only, dated 2026-06-12, restart-window era) had its leading characters disclosed in the 2026-07-10 working transcript during inspection. The password's target database is UNCONFIRMED — the file carries no host, user, or database name, so it addresses nothing by itself; the single-line shape and file date are consistent with a restart-window test value. Disposition folds into the FD-45 tail: maintainer confirms whether the value matches any live credential (canon, `-prod`, or other); if it does, rotation priority rises accordingly; rotate or retire at FD-45 close either way.

## §4 §4.1 retroactive gate disposition

Against G2 v1.3 §4.1's gate criteria, live 2026-07-10:

| Criterion | Disposition |
|---|---|
| Instance running | PASS (running; launched 05-28, up since) |
| SSH connectivity via episode-prod-key | PASS (verified live, both sessions) |
| PM2 daemon running, clean process tree | PASS (verbatim: daemon up, zero apps) |
| IAM role reads episode-metadata/dev/database | FAIL-AS-FICTIONAL (FD-55; secret does not exist; aws CLI not installed on instance) |
| GitHub secret in place | PASS (EPISODE_DEV_BACKEND_HOST present) |

Spec deviations noted, non-blocking: SG lacks the §4.1 443/80 GitHub-runner ingress rules (moot while Deploy workflows are runtime-disabled; must be added before §4.3 first run); instance has a pending kernel restart and pending package updates; root volume 53% of 7.6 GB.

**§4.1 disposition: SUBSTANTIALLY COMPLETE, gate PASS 4/5 with the fifth criterion void per FD-55.** Maintainer decision recorded here: either (a) amend the criterion to test the operative .env mechanism, or (b) create the secret and land the specced pattern — (b) aligns with §4.1's "dev gets the right pattern" principle and with FD-45's remediation direction. Concurred lean of both review sessions (2026-07-10): **(b)**. Execution of (b) is an AWS write action, gated separately, not performed by this revision. **Decision: (b), confirmed at ship 2026-07-10.**

## §5 §4.3 frontier collision — the live gate

§4.3 (deploy-dev.yml retargeting) requires the workflow to run; its gate criterion is a green end-to-end deploy landing on episode-dev-backend. Per Fix Plan v1.27 §8 item 3, `Auto-merge to Dev` and both Deploy workflows are runtime-DISABLED, and re-enablement is a gated decision under the AllStopped disposition, not a maintenance toggle.

**Therefore the G2 frontier is now, precisely: the deploy-dev.yml re-enablement decision.** Prerequisites before that gate can be taken:

1. §4.2 memory synthetic — not yet run; remains the hard gate before any cutover regardless of workflow state
2. SG 443/80 runner-ingress rules added (spec deviation above)
3. FD-55 disposition decided (§4 above) so the deployed app has a real credential path
4. deploy-dev.yml reviewed against its AllStopped failure mode (the pre-#872 `pm2 stop all` + .env-write cascade, cause closed 2026-07-01) before re-enablement is proposed — the workflow on main is post-#872, but the review is owed against the runtime-disabled posture's reason for existing

v1.28 frames this gate; it does not take it. Re-enablement, when proposed, is Rule 7: draft → explicit maintainer confirm → execute.

## §6 Retained

- Fix Plan v1.27 in full: register state (§2), phase axis (§3), FD-52/FD-53, derive sequence including the §5.2 step-8 register leg.
- G2 Implementation v1.3 as G2 contract, with §3's "not started" line corrected by FD-54 and §4.1's fifth gate criterion voided by FD-55; all other operational content stands.
- Freeze posture for prod actions outside ratified gates: unchanged (v1.20, verbatim). Nothing in this revision touches episode-backend.
- FD-45: OPEN (tail), minted v1.18, no closing revision in the chain (enumeration exhibited in basis); gains the §3 rider, not a state change.

## §7 Register hygiene

- Register tail at v1.28 open: FD-53 (v1.27). Minted here: FD-54, FD-55. Tail at close: FD-55.
- FD numbers minted only by Fix Plan revisions — conforms.
- Closes no findings. FD-45 gains a rider, not a state change.
- Step-8 register leg exhibited (basis): FD-45 mint located at v1.18 by enumeration from v1.17 forward; every revision v1.18→v1.27 read or read-at-FD-45-lines this session; no closing revision exists. FD-52/FD-53 per their minting revision v1.27, read in full, merged e288144e (#912).
- Doc-only revision. No code, config, box, or canon contact beyond the read-only inspections in the basis.
- FD-21 closing-keyword check on the commit message before commit (PR references herein — #722, #872, #911, #912 — are historical; no close/fix/resolve adjacent forms).
- Ships with `[skip-automerge]`.

---

*End of F-Deploy-1 Fix Plan v1.28 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-10.*
*Predecessor: v1.27 (e288144e, #912).*
*Closed: none. Minted: FD-54, FD-55. Advances no gate; authorizes no prod-box action. [skip-automerge]*
