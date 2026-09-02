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
7. Confirm the freeze from the register, not from memory: read the newest `docs/audit/Prime_Studios_Audit_Handoff_v<N>.md` (version sort, `ls docs/audit | grep -E 'Audit_Handoff_v[0-9]+\.md' | sort -V | tail -1` — do NOT use `sort -t v -k3 -n`: that key has no field 3 on these filenames, so sort falls back to lexical and ranks v8 above v25) Sec 2 and Sec 3.4, and the newest `docs/audit/v25_Owed_Index_Amd<N>_*.md`. Prod is FROZEN unless that register says otherwise.

Then report, in one short block: basis SHA, open PRs, position result, shallow result, register tail files read. Stop there and wait for the task.

Never, in this or any later step: ssh, scp, pm2, aws, psql against an RDS host, edit a server .env, dispatch or enable a workflow. Those are Evoni's to run, personally, outside the agent session.
