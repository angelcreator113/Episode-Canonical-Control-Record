# F-Deploy-1 Fix Plan v1.38

**P2 (G2 dispatch prerequisite) EXECUTED and CLOSED 2026-07-13: GitHub OIDC
provider + role `episode-gha-deploy-dev` created as three gated IAM writes,
readback-verified statement-for-statement. Trust scoped to
`repo:angelcreator113/Episode-Canonical-Control-Record:environment:development`
(aud `sts.amazonaws.com`). Permission policy scoped to the workflow text, not
the workflow header: three spec deltas recorded (§2) where the body demands
more than the header lists. Deliberate exclusions itemized per the v1.32 §2
read-before-grant discipline: no secretsmanager, no Parameter Store, no IAM,
no EC2 mutation — the role carries ZERO secret-read surface; DB env resolves
on-box under the instance profile (P3/P4 architecture, unchanged). Assume-proof
(federation live) folds forward to first dispatch, same shape as P4's on-box
leg. Mints no FD. Register tail: FD-61 at open, FD-61 at close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.37 (custody recovery; merged #925, f1c30507) |
| **Author date** | 2026-07-13 |
| **Gate effect** | Closes prerequisite P2 (write leg + readback; assume-proof at first dispatch). Advances no other gate. Authorizes no box action. First dispatch remains blocked on P5 + re-enablement (its own Rule 7 gate, untaken, unproposed). |

**Basis (live reads and writes 2026-07-13, transcribed from live terminal
output, not memory):**
- Wake-up trio: origin/main at 83482351 (#926, onboarding pointer doc);
  `gh pr list` → none.
- Full-body read `origin/main:.github/workflows/deploy-dev.yml` — P2 spec
  source (header) + permission-surface derivation (body).
- `aws iam list-open-id-connect-providers` pre-write → `[]` (true empty; no
  dedupe risk). Post-write → provider ARN present.
- `aws sts get-caller-identity` → account 637423256673, matching the role ARN
  hardcoded in the workflow.
- `aws iam list-roles` filtered episode-gha-deploy-dev pre-write → `[]` (no
  half-built residue).
- Policy JSONs written no-BOM via `[System.IO.File]::WriteAllText`
  (UTF8Encoding $false), byte-verified `7B-0A-20` both files pre-CLI, per the
  standing Windows-encoding hazard class.
- Writes: `create-open-id-connect-provider` (ARN returned);
  `create-role` (AROAZI2LDARQTOWHBGTZZ, 2026-07-13T16:34:41Z);
  `put-role-policy episode-gha-deploy-dev-permissions` (exit 0).
- Readbacks: `get-role` trust document exact match; `get-role-policy` four
  statements exact match (Sids `DeployArtifactObjects`, `DeployPrefixList`,
  `SSMSendCommandScoped`, `SSMCommandRead`).

## §1 P2 execution record

Three writes, additive-only (nothing pre-existing was an argument to any
write; rollback = delete-role-policy + delete-role +
delete-open-id-connect-provider, touching nothing else):

1. **OIDC provider** `token.actions.githubusercontent.com`, client-id
   `sts.amazonaws.com`, thumbprint `6938fd4d…aea1`. Thumbprint note for the
   record: AWS has trusted GitHub's OIDC issuer via its own trust store since
   mid-2023 — the API requires the field but it is no longer
   security-load-bearing; NOT a custody value.
2. **Role** `episode-gha-deploy-dev` — the exact name the merged workflow
   (#917) hardcodes; not negotiable at this layer. Trust conditions:
   `aud = sts.amazonaws.com`; `sub =
   repo:angelcreator113/Episode-Canonical-Control-Record:environment:development`
   (StringEquals — exact match, no wildcard; a dispatch from any other repo,
   or outside the `development` environment, cannot assume).
3. **Inline permission policy** `episode-gha-deploy-dev-permissions`, four
   statements (§2).

## §2 Permission surface — derived from workflow body; three spec deltas

The workflow header's P2 line lists: S3 Put/Get on `deploys/*`, SendCommand
scoped to instance ARN + AWS-RunShellScript, ListCommandInvocations,
GetCommandInvocation. The body demands more; the policy follows the body:

- **Delta 1 — `s3:DeleteObject` + `s3:ListBucket` (prefix-conditioned):**
  the cleanup step runs `aws s3 rm --recursive` on the deploy prefix. Without
  these, every deploy ends in a failed cleanup step.
- **Delta 2 — `ssm:DescribeInstanceInformation`:** the preflight step calls
  it before anything uploads. Absent from the header list; without it,
  preflight fails closed on permissions rather than open on P1.
- **Delta 3 — `s3:GetObject` is load-bearing beyond artifact download:** the
  presigned URLs the box curls inherit the signer's permissions; if the role
  cannot GetObject, the presigned URL 403s on-box.

Scoping decisions:
- SendCommand: instance-ARN scoping (not tag-condition) — tighter; a box
  replacement is its own gated event that revisits this role anyway.
- `SSMCommandRead` Resource `*`: Get/ListCommandInvocations scope only to
  command IDs (unknowable pre-fire); DescribeInstanceInformation is
  unscopeable. Read-only plane.
- **Deliberate exclusions:** `secretsmanager:*`, `ssm:GetParameter(s)`,
  all IAM, all EC2 mutation. The GHA role holds zero secret-read surface —
  if a future edit wants secrets on this role, that is a design smell and a
  stop-and-litigate, not an amendment.

## §3 Prerequisite register — state after this revision

| # | Prerequisite | State |
|---|---|---|
| P1 | Instance role SSM perms + registration | CLOSED (v1.32) |
| P2 | OIDC provider + episode-gha-deploy-dev | **CLOSED here** (write leg + readback; assume-proof at first dispatch) |
| P3 | Secret + role read statement | CLOSED (v1.36) |
| P4 | scripts/print-db-env.js | Code on main (#923); register closure folds into first-dispatch revision (deliberate, v1.36-era ruling) |
| P5 | Nginx on episode-dev-backend | OPEN — folds into the §4.2 on-box session |

First dispatch: blocked on P5 close AND re-enablement passing its own Rule 7
gate (v1.28 §5 — untaken, unproposed, unchanged).

## §4 Retained

v1.36 in full (two-track frontier; §4.5/criterion-5 amendment); v1.37 in full
(custody ruling, FD-61 parked). Freeze posture unchanged (v1.20 verbatim).
deploy-dev.yml runtime: `disabled_manually`, unchanged. FD-61 OPEN, parked.

## §5 Register hygiene

Tail at open: FD-61. Minted: none. Closed: prerequisite P2 (register state
change, readback authority; not an FD). Tail at close: FD-61. Writes this
revision records: three IAM writes (§1), all under the session's confirm
cycle; all other operations read-only or local-temp. Process note, recorded
not litigated: the write set fired in the same paste-pass as the file-prep
steps rather than after a separate confirm — maintainer executor authority,
same shape as the #926 note. FD-21 check on commit message. Ships
[skip-automerge] in title, body via --body-file.

---
*End of F-Deploy-1 Fix Plan v1.38.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-13. Predecessor: v1.37 (f1c30507, #925).*
*Closed: prerequisite P2. Minted: none. Tail: FD-61. [skip-automerge]*