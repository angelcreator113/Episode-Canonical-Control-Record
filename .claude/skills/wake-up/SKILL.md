---
name: wake-up
description: Establish repository position before any local read or edit (Handoff v25 Sec 6 item 1). Run at the start of every session in this repo, before reading docs/audit or trusting any remembered state.
disable-model-invocation: false
argument-hint: ""
allowed-tools: Bash(git fetch:*) Bash(git log:*) Bash(git rev-parse:*) Bash(git status:*) Bash(git rev-list:*) Bash(git branch:*)
---

# Wake-up: position before reading

Live beats docs beats memory. Do these in order and PASTE each command with its raw output (H1 rule: a precondition asserted in prose is not asserted).

1. `git fetch origin --prune` and read the output. `- [deleted]` lines mean a remote branch is gone.
2. `git log -1 --format='%H %ad %s' --date=short origin/main`. Do not carry a prior basis as the expected answer.
3. Enumerate open pull requests. Use the GitHub MCP tools if present (list_pull_requests, state open), else `gh pr list`. State the method. If no capability exists, record NOT PERFORMED.
4. POSITION: `git rev-parse HEAD` and `git rev-parse origin/main`. Note whether they match.
5. COMPLETENESS: `git rev-parse --is-shallow-repository`. If `true`, run `git fetch --unshallow origin main` before any ancestry, range, or history claim, then re-assert.
6. If POSITION differs, `git rev-list --left-right --count origin/main...HEAD`. Nonzero *behind* is the stale-worktree hazard. Nonzero *ahead* with zero behind is your own unmerged work; do not discard it.
7. Confirm production standing from the register, not from memory: read the newest `docs/audit/Prime_Studios_Audit_Handoff_v<N>.md` (version sort, `ls docs/audit | grep -E 'Audit_Handoff_v[0-9]+\.md' | sort -V | tail -1` — do NOT use `sort -t v -k3 -n`: that key has no field 3 on these filenames, so sort falls back to lexical and ranks v8 above v25) Sec 2 and Sec 3.4, and the newest `docs/audit/v25_Owed_Index_Amd<N>_*.md` (Bash numeric amendment sort, `ls docs/audit/v25_Owed_Index_Amd*_*.md | sed -E 's#^.*/v25_Owed_Index_Amd([0-9]+)_.*#\1 &#' | sort -n | tail -1 | cut -d' ' -f2-`; PowerShell numeric amendment sort, `Get-ChildItem docs/audit -File -Filter 'v25_Owed_Index_Amd*_*.md' | ForEach-Object { if ($_.Name -match 'Amd(\d+)') { [pscustomobject]@{ File = $_; Number = [int]$Matches[1] } } } | Sort-Object Number | Select-Object -Last 1 -ExpandProperty File`), and the newest `docs/audit/F-Deploy-1_Fix_Plan_v1.<N>.md` (version sort, `ls docs/audit | grep -E '^F-Deploy-1_Fix_Plan_v1\.[0-9]+\.md$' | sort -V | tail -1`; PowerShell, `Get-ChildItem docs/audit -File -Filter 'F-Deploy-1_Fix_Plan_v1.*.md' | ForEach-Object { if ($_.Name -match '^F-Deploy-1_Fix_Plan_v1\.(\d+)\.md$') { [pscustomobject]@{ File = $_; Number = [int]$Matches[1] } } } | Sort-Object Number | Select-Object -Last 1 -ExpandProperty File`). Take production standing from the newest of these three documents that states it (by the date it was filed, not by file name), and report which document that was. Whatever the standing, agent sessions never perform production actions (see Never, below).

Then report, in one short block: basis SHA, open PRs, position result, shallow result, register tail files read. Stop there and wait for the task.

Never, in this or any later step: ssh, scp, pm2, psql against an RDS host, edit a server .env, dispatch or enable a workflow. Those are Evoni's to run, personally, outside the agent session. `aws` is limited by `CLAUDE.md`'s 2026-09-16 ruling (`docs/audit/F-Tools-1_AWSReadAccess_Ruling_2026-09-16.md`): "read-only, by name — `cognito-idp describe-user-pool`, `describe-user-pool-client` (only with a `--query` excluding `ClientSecret`), `cognito-idp list-user-pool-clients` (id/name/pool-id only, returns no secrets), `cognito-idp list-groups` (group name/description/precedence/role ARN/timestamps only, no user data, no secrets), `ssm describe-parameters` (names/metadata only), `secretsmanager list-secrets` (names only), `ec2 describe-*`, `rds describe-*`. No `get-parameter`, `get-secret-value`, any write/create/update/delete/restart/dispatch, or any call returning a credential." No other `aws` call, and tooling access is not action authority.
