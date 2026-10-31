# Runbook: Claude Code's scoped AWS access (agent-access role)

Rulings: `docs/audit/F-Tools-3_TaskScopedProductionReads_Ruling_2026-10-29.md` (default-deny; short-lived credentials only), `docs/audit/F-Tools-1_AWSReadAccess_Ruling_2026-09-16.md` and `docs/audit/F-Tools-2_ReadOnlyProdVisibility_Ruling_2026-10-29.md` (no long-lived keys in a session).

**Evoni runs everything here. An agent session never runs `scripts/setup-agent-access.sh` or any AWS command.**

## 1. What this sets up, and what it does not

| Piece | File | What it is |
|---|---|---|
| Role `PrimeStudios-AgentAccess-GHA` | `infra/agent-access/assume-role-policy.json` | Only a GitHub Actions job in this repository's `agent-access` environment can assume it, through OIDC. Credentials last at most 1 hour and are never seen by a session |
| Inline policy `AgentAccessScoped` | `infra/agent-access/policy.json` | Allows reading and listing the one project bucket and reading CloudWatch Logs. Explicitly denies `s3:DeleteObject`, `s3:DeleteBucket`, every other `s3:Delete*`, every `s3:Put*`, `iam:*`, `sts:AssumeRole`, `ec2:TerminateInstances`/`ec2:Terminate*`, `ec2:Modify*`, `rds:Delete*`, `rds:Modify*`, `cognito-idp:*`, log writes and `logs:Unmask`, `ssm:GetParameter*` and `secretsmanager:GetSecretValue`. An explicit Deny cannot be overridden by any later Allow |
| Bucket versioning | (script) | Turned on, so an overwrite or delete by anything can be undone |
| RDS backups | (script) | Reported only. The script never changes RDS |

**Not created:** no IAM user, no access key, nothing in Claude Code's environment secrets. The original request was an IAM user `claude-code-agent` with a key in Claude Code's environment secrets. That conflicts with all three rulings above, so this design uses a short-lived role instead (Evoni chose option A, 2026-10-31).

**Not yet usable by a session.** No workflow assumes this role yet. The workflow is a separate, reviewed PR. Before a session may rely on it for a task, it must be an approved method under F-Tools-3 §3, and each use still needs Evoni's task authorization (§2 there). The session may never dispatch, approve or re-run it.

## 2. Run it once in AWS CloudShell from a phone (one paste)

1. Sign in to the AWS console in the phone's browser as yourself, in the region where the bucket and the database live.
2. Open **CloudShell**: the `>_` icon in the top bar, or search "CloudShell".
3. Copy the line below into a note first and replace `<your-bucket-name>`. Then paste it into CloudShell and press Enter:

```
B=<your-bucket-name>; R=https://raw.githubusercontent.com/angelcreator113/Episode-Canonical-Control-Record/main; mkdir -p ~/agent-access && cd ~/agent-access && curl -fsSL --fail-early --remote-name-all "$R/scripts/setup-agent-access.sh" "$R/infra/agent-access/policy.json" "$R/infra/agent-access/assume-role-policy.json" && bash setup-agent-access.sh "$B" --dry-run && read -rp "Apply these changes? [y/N] " a && [ "$a" = y ] && bash setup-agent-access.sh "$B"
```

What the paste does:
1. It downloads the three reviewed files from `main`.
2. It runs a **dry run**, which makes only read calls. The dry run prints the policies exactly as they would be applied, and what would change.
3. It asks before changing anything. Type `y` to apply; anything else stops.

**If the download fails** (the repository is private): open CloudShell's **Actions** menu, choose **Upload file**, and upload the same three files from GitHub. Then paste:

```
B=<your-bucket-name>; bash setup-agent-access.sh "$B" --dry-run && read -rp "Apply these changes? [y/N] " a && [ "$a" = y ] && bash setup-agent-access.sh "$B"
```

Running it again is safe. The role's trust policy and inline policy are reapplied, and versioning that is already on is left alone.

**Check the output for:**
- `RDS automated backups`: each instance shows `ON (N-day retention)` or `OFF`. If one is OFF, turn it on in the RDS console (the instance, then **Modify**, then **Backup retention period**). The script does not do this for you.
- `Old IAM user claude-code-agent`: this should say `none (good)`. If it exists, follow §5.
- `Role ARN`: you need this for §3. **Do not paste it into a Claude conversation**, because it contains your account id.

If the bucket uses a KMS key, reading objects also needs `kms:Decrypt` limited to S3 (`kms:ViaService = s3.<region>.amazonaws.com`). That is not in this policy; add it in a later reviewed PR.

## 3. Where the "key" goes: a GitHub environment secret, not Claude Code

There is no key. The only value to store is the role ARN, and it goes into GitHub, not into Claude Code's environment secrets.

1. github.com, this repository, **Settings**, **Environments**, **New environment**, `agent-access`.
2. **Required reviewers**: you. Every run then waits for your approval.
3. **Deployment branches and tags**: **Selected branches**, `main` only.
4. **Environment secret**: name `AWS_AGENT_ACCESS_ROLE_ARN`, value the role ARN from §2.

**Claude Code's environment secrets stay free of AWS credentials.** Do not add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` or a session token there. The guard hook blocks a session from reading AWS credentials from its environment anyway (F-Tools-3 §5).

## 4. Rotate or revoke

**Rotation:** there is nothing to rotate. Each approved run gets new credentials that expire within an hour.

**Revoke, from quickest to most complete:**
1. **Stop new runs:** GitHub, Settings, Environments, `agent-access`, then delete the environment or remove the `AWS_AGENT_ACCESS_ROLE_ARN` secret.
2. **Kill credentials already issued:** AWS console, IAM, Roles, `PrimeStudios-AgentAccess-GHA`, **Revoke active sessions**. This adds a deny for every credential issued before that moment.
3. **Remove the role entirely:** IAM, Roles, `PrimeStudios-AgentAccess-GHA`, open the inline policy `AgentAccessScoped` and delete it, then **Delete** the role.

To restore access later, run §2 again.

## 5. If an old IAM user `claude-code-agent` exists

It is not part of this setup and should not hold a key. In the console: IAM, Users, `claude-code-agent`, **Security credentials**. Deactivate and then delete each access key. Next remove its policies on the **Permissions** tab, then **Delete** the user. If a key was ever pasted anywhere (a conversation, a note, Claude Code's secrets), treat it as exposed: delete it, and remove it from wherever it was pasted.

## 6. What never happens

- No session runs the script, assumes the role, or holds its credentials.
- No access key is created. Nothing the script does is written to disk.
- No deletes, writes or `Put*` in S3 through this role; no IAM, EC2 terminate/modify, RDS delete/modify or Cognito actions.
- No change to RDS, Cognito, a server `.env`, or a workflow by this setup.
