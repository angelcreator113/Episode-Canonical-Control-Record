# F-Deploy-1 Fix Plan v1.30

**G2 frontier prerequisite 4 executed 2026-07-10: `deploy-dev.yml` reviewed at HEAD against the AllStopped failure mode, six-axis record (R1–R6). Trigger cascade severed at three layers and the stop-scope fix holds — but the secret-clobber mechanism (CauseClosed Sec 4) is INTACT at HEAD, and the workflow's dispatch target `DEV_EC2_HOST` exists live and uninspectable, presumptively still the frozen shared box. §4.3 is recharacterized: a REWRITE gate, not a toggle gate. Finding FD-57 minted: deploy-ingress mechanism = SSM zero-inbound; runner-IP-on-22 rejected as F-Deploy-G1-AE-species. Finding FD-58 minted: FD-55's "role grants read on a nonexistent secret" characterization is contradicted by the live policy — NO Secrets Manager statement exists on `episode-dev-backend-role` at all; FD-55(b) execution scope widens to secret-create + policy-write; v1.29 §5 step 7's IAM check is pre-answered as a guaranteed mismatch. Prerequisite 4 CLOSED as a review; the re-enablement gate it guards remains untaken.**

| | |
|---|---|
| **Predecessor revision** | Fix Plan v1.29 (FD-56, FD-55(b) execution-attempt record, FD-45 riders; merged #914, 18f40468) |
| **Author start date** | 2026-07-10 |
| **Status** | DRAFT v1.30 |
| **Gate effect** | Advances no gate. Authorizes no prod-box action. Fires zero writes. Closes G2 frontier prerequisite 4 as a review record; takes the ingress mechanism decision (FD-57); corrects the FD-55 characterization (FD-58); recharacterizes and specs (does not execute) the §4.3 rewrite. Re-enablement remains ungated and unproposed. |

**Basis (live reads 2026-07-10, same working session as v1.29's ship; zero writes fired):**

- `git show origin/main:.github/workflows/deploy-dev.yml`: full body read. `push:` trigger commented with the dated freeze block (the only `push:` in the file is inside the comment — the CauseClosed Sec 6 binary check passes as specced); `workflow_dispatch:` retained; cleanup scoped to `pm2 stop episode-api episode-worker`; `restore_pm2` EXIT trap scoped `--only episode-api,episode-worker --update-env`; `write_env_key` block writes `FAL_KEY` / `REMOVEBG_API_KEY` / `ANTHROPIC_API_KEY` from `secrets.*` into `$APP_DIR/.env`; DB credentials exported from `secrets.DEV_DB_*` into the deploy shell; SSH host is `secrets.DEV_EC2_HOST`; deploy transport is runner→SSH-22.
- `git show origin/main:docs/audit/F-Deploy-1_AllStopped_CauseClosed_WorkflowCascade_2026-07-01.md`: full body read. Failure-mode components for the review rubric: (i) autonomous trigger cascade, (ii) `pm2 stop all`-class action, (iii) secret-clobber (`write_env_key` + `--update-env`) against rotation surfaces S2/S3.
- `gh workflow list --all`: `Deploy to Development` = `disabled_manually` (224506682); `Deploy to Production` = `disabled_manually`; `Auto-merge to Dev` = `disabled_manually`; `Validate` and `Copilot cloud agent` active. FD-50 discipline satisfied — runtime state read live, not inferred from YAML.
- `gh api .../actions/secrets` (names only; values write-only by construction): `DEV_EC2_HOST` EXISTS. `EPISODE_DEV_BACKEND_HOST` EXISTS. Both dev-host secrets coexist. Also present: `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (static keys — F-Deploy-G1-AD-family corroboration, recorded in passing, no new FD; AD is a filed posture finding).
- `aws iam get-role-policy --role-name episode-dev-backend-role --policy-name episode-dev-backend-role-permissions`: seven statements — S3DevBucketsListAndAccess, S3DevBucketObjects, SQSThumbnailQueue, CloudWatchLogsWrite, CloudWatchMetricsPut, ECRPullEpisodeMetadataApi, ECRPullEpisodeMetadataApiRepo. **No `secretsmanager:*` statement. No `ssm:*` statement.** No attached managed policies (per v1.28 basis, `get-role`).
- `aws ssm describe-instance-information` filtered to i-016395bb5f7a51a0b: `InstanceInformationList` EMPTY — the instance is not SSM-registered.

## §1 Purpose

Executes G2 frontier prerequisite 4 (v1.28 §5, as amended by v1.29 §6): the review of `deploy-dev.yml` against its AllStopped failure mode, plus the deploy-ingress mechanism decision folded into it. Records the six-axis review (§2), mints FD-57 (ingress mechanism, §3) and FD-58 (FD-55 characterization correction, §4), and recharacterizes the §4.3 gate as a rewrite gate with its rewrite specced but not executed (§5). Performs no first-instance reasoning beyond transcription and live verification; every review-axis conclusion cites a basis read.

## §2 Prerequisite 4 review record — `deploy-dev.yml` at HEAD vs. the AllStopped signature

| Axis | Disposition | Basis |
|---|---|---|
| **R1 — Trigger cascade** | **SEVERED ×3.** `push:` commented in-file (git-verifiable; CauseClosed Sec 6 binary check passes); workflow runtime `disabled_manually`; `Auto-merge to Dev` runtime `disabled_manually`. The 06-27 chain (claude/** PR → auto-merge → deploy) cannot fire at any layer. | workflow body; `gh workflow list --all` |
| **R2 — Stop scope** | **FIXED (post-#872 holds).** Cleanup stops only `episode-api` + `episode-worker`; `restore_pm2` EXIT trap restores only those two via `startOrRestart --only ... --update-env`; `pm2 resurrect` explicitly banned in-file. The all-four signature cannot reproduce from HEAD. | workflow body; CauseClosed Sec 3 |
| **R3 — Secret-clobber** | **INTACT AT HEAD.** `write_env_key` still writes `ANTHROPIC_API_KEY` / `FAL_KEY` / `REMOVEBG_API_KEY` from GitHub Secrets into the target box `.env`, then the trap's `--update-env` restart loads them. #872 fixed the stop scope, not this. A dispatch today would re-run the CauseClosed Sec 4 mechanism against whatever box `DEV_EC2_HOST` names. Dormant only because R1 is severed. | workflow body lines (write_env_key block + trap); CauseClosed Sec 4 |
| **R4 — Host targeting** | **AMBIGUOUS-DANGEROUS.** Workflow SSH host is `secrets.DEV_EC2_HOST`, which EXISTS live and is uninspectable (write-only). Its value is presumptively the pre-G2 shared box (`.144`) — the workflow predates the new dev box, and nothing in the record retargets it. `EPISODE_DEV_BACKEND_HOST` (provisioned at §4.1, v1.28 basis) also exists but is unreferenced by any workflow. The intentionally-retained `workflow_dispatch` lever therefore points, today, at an unverifiable and presumptively frozen target. **The §4.3 retargeting is unexecuted in the file itself.** | workflow body; secrets inventory |
| **R5 — Credential path** | **AD-PATTERN.** DB credentials arrive as pipeline-injected env from `secrets.DEV_DB_*` — the exact mechanism FD-55 identified as the operative one and that decision (b) replaces with the `episode-metadata/dev/database` secret + instance-role read. R3 and R5 dissolve together under decision (b): a workflow that injects no secrets has no clobber surface. | workflow body; v1.28 §3 |
| **R6 — Ingress** | **DECISION TAKEN → FD-57 (§3).** Deploy transport at HEAD is runner→SSH-22. Live SG (v1.28 basis): 22 and 3002 from 108.216.160.136/32 only — the runner cannot reach the new box as-is. SSM path verified this session: instance NOT registered, and the role carries no `ssm:*` permission and no managed policies — cause of non-registration is visible and cheap (one gated IAM write + registration verify). | `describe-instance-information`; `get-role-policy`; v1.28 basis SG read |

**Review conclusion: `deploy-dev.yml` at HEAD is not a re-enable-in-place candidate.** The file is written for the shared-box topology throughout — the prod-hotfix exclusion logic exists because prod shared the box; `/var/www/html`, `episode-dev.conf`, and the trap's scoping all assume it. Re-enablement without rewrite re-arms R3 onto `.144` via R4's unverifiable target. Prerequisite 4 is CLOSED as a review; its output is the §5 rewrite spec and the FD-57 decision. The re-enablement gate itself remains untaken and unproposed.

## §3 FD-57 — deploy-ingress mechanism: SSM zero-inbound

**Decision FD-57: the retargeted dev deploy path uses AWS SSM (Session Manager / RunCommand) with zero new inbound rules, not GitHub-runner IP ranges on port 22. Runner-IP allow-listing is rejected as F-Deploy-G1-AE-species — a broad, churny inbound exposure of exactly the class the AE finding filed against the prod box, and the workflow's own preflight comments document the operational pain of that path ("ensure Security Group allows TCP/22 from this IP (or GitHub Actions IP ranges)"). The SG stays as it is: 22/3002 from the maintainer address only. G2 §4.1's "Inbound HTTPS (443): GitHub Actions runner egress range" spec line, already flagged wrong-in-kind at v1.29 §6, is resolved by this decision: struck, replaced by the SSM mechanism.**

Enablement cost, verified live this session, both legs currently absent:

1. IAM: the role carries no `ssm:*` permission and no attached managed policies. One gated IAM write owed — attach `AmazonSSMManagedInstanceCore` (or a scoped inline equivalent, decided at the write's own draft).
2. Registration: instance absent from `describe-instance-information`. Expected to self-resolve once the IAM leg lands (Ubuntu 24 AMIs ship the agent), verified by re-running the read; if it does not, the agent leg is a follow-up on-box action, gated.

Neither write is performed or scheduled by this revision. Both fold into the §5 rewrite's prerequisite list. Cost is bounded and one-time; the rejected alternative's cost (IP-range churn maintenance) is unbounded and forever.

## §4 FD-58 — FD-55 characterization corrected: no Secrets Manager permission exists

**Decision FD-58: FD-55's operative sentence — "The role's Secrets Manager permission grants read on a nonexistent resource" (v1.28 §3, carried into v1.29 §5 step 7's "IAM inline-policy ARN check") — is contradicted by the live policy. `episode-dev-backend-role-permissions`, read in full this session, contains seven statements (S3 ×2, SQS, CloudWatch Logs, CloudWatch Metrics, ECR ×2) and NO `secretsmanager` statement whatsoever. The fictional-architecture finding was correct in kind and understated in degree: the secret does not exist AND the permission to read it does not exist either.**

Two hypotheses for the divergence, recorded, not adjudicated:

- (a) the permission existed at FD-55's authoring read and was removed since — no IAM write appears anywhere in the record between v1.28's ship and this read, which weighs against this;
- (b) FD-55's authoring transcribed the G2 contract's *spec* of the permission as if it were the *live policy* — prose-about-state-≠-state, the FD-49 mechanism, inside a finding that was itself about fictional architecture.

Resolution is optional and read-only (CloudTrail `PutRolePolicy`/`DeleteRolePolicy` lookup on the role); owed only if the distinction ever becomes load-bearing. What is load-bearing now:

- **FD-55(b) execution scope widens to two writes on this axis:** create `episode-metadata/dev/database` AND add the Secrets Manager read statement to the role policy. Both fold into the FD-45 remediation window (v1.29 §5), whose step 7 is amended accordingly.
- **v1.29 §5 step 7 is pre-answered:** the "IAM inline-policy ARN check" is a guaranteed mismatch, known today. The step's "mismatch after creation = flagged follow-up IAM write" branch is the only branch; the window's draft should carry the policy write as a planned step, not a contingency.

## §5 §4.3 recharacterized — rewrite gate, not toggle gate; rewrite specced, not executed

The §4.3 gate's content is a rewrite of `deploy-dev.yml`, Rule 7 end to end. Spec, from the R1–R6 record:

1. **Retarget:** SSH/host references move from `secrets.DEV_EC2_HOST` to `secrets.EPISODE_DEV_BACKEND_HOST`. `DEV_EC2_HOST` is retired — retirement is a GitHub-secret deletion (a write, gated, taken with the rewrite) so no lever can ever again point at the shared box.
2. **Transport:** runner→SSH-22 replaced by SSM per FD-57. Prerequisites: the FD-57 IAM write + registration verify.
3. **Credential path:** the `DEV_DB_*` pipeline injection and the entire `write_env_key` block are DELETED. The app reads `episode-metadata/dev/database` via the instance role at boot (per FD-55 decision (b), scope per FD-58). R3 and R5 dissolve structurally — a workflow that carries no secrets cannot clobber any.
4. **Shared-box logic retired:** prod-hotfix exclusion reasoning, shared-box cleanup assumptions, and the trap's shared-box scoping rationale are removed; a scoped restart trap is retained on its own merits (restart-on-failure is good on any box). Nginx/frontend paths re-specced against the new box's actual provisioning at rewrite draft.
5. **Ordering:** the rewrite lands and is reviewed BEFORE any re-enablement is proposed; the §4.2 memory synthetic (prerequisite 1, still the hard gate, still not run) and the FD-45 remediation window are independent prerequisites on their own tracks. Re-enablement, when proposed, is its own Rule 7 gate per v1.28 §5, unchanged.

Nothing in this section is executed by this revision. The rewrite PR, the IAM write, the secret deletion, and re-enablement are each separately gated future actions.

## §6 G2 frontier state after this revision

1. §4.2 memory synthetic — OPEN, unchanged, hard gate. Noted for the executing session: the box carries `/var/run/reboot-required` + pending package updates (v1.28 basis); patch+reboot (gated, dev-box) before the synthetic or the result is polluted.
2. ~~SG 443/80~~ — struck at v1.29 §6; resolved by FD-57.
3. FD-55 disposition — decided (b) at v1.28; execution scope per FD-58; re-homed to the FD-45 remediation window (v1.29 §5, step 7 amended).
4. deploy-dev.yml review — **CLOSED this revision (§2)**; its successor obligation is the §5 rewrite, then the re-enablement gate.

## §7 Retained

- Fix Plan v1.29 in full: FD-56, FD-45 riders §4.1–§4.4, the remediation window shape (§5, step 7 amended per §4 above), §6 reframe (consumed here), §7 tooling note.
- Fix Plan v1.28 in full, with FD-55's characterization corrected per FD-58 — FD-55 itself stands (the architecture is fictional; more fictional than filed).
- G2 Implementation v1.3 as G2 contract, with §4.1's 443/80 line resolved-struck per FD-57 (resolution owed at this review per v1.29 §8 — now delivered; the contract text itself is not edited by a Fix Plan revision, the strike is recorded here).
- Freeze posture for prod actions outside ratified gates: unchanged (v1.20, verbatim). Nothing in this revision touches episode-backend; R4's presumptive `.144` target is precisely why nothing was dispatched.
- CauseClosed Sec 6 abort-precondition: verified live this session, HOLDS (the only `push:` is commented).
- FD-45: OPEN (tail). FD-56: OPEN. FD-55: decision (b) stands, execution scope widened (FD-58).

## §8 Register hygiene

- Register tail at v1.30 open: FD-56 (v1.29). Minted here: FD-57, FD-58. Tail at close: FD-58.
- FD numbers minted only by Fix Plan revisions — conforms.
- Closes no findings. Closes G2 frontier prerequisite 4 as a review obligation (not an FD).
- Zero writes fired this session segment: no AWS write, no GitHub write, no box write. All six basis reads are read-only; secret values never inspected (names only; GitHub secrets write-only by construction).
- Doc-only revision.
- FD-21 closing-keyword check on the commit message before commit (PR references herein — #872, #913, #914 — are historical; the phrase "prerequisite 4 CLOSED" appears in the body only, not the commit message; commit message must avoid close/fix/resolve adjacent forms).
- Ships with `[skip-automerge]` in the title, PR body via `--body-file`.

---

*End of F-Deploy-1 Fix Plan v1.30 (draft).*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-10.*
*Predecessor: v1.29 (18f40468, #914).*
*Closed: none. Minted: FD-57, FD-58. Advances no gate; authorizes no prod-box action; executes nothing. [skip-automerge]*
