---
name: close-loop
description: Detect open claude-task issues whose dispatch branch already shipped in a merged PR, so the Step 6 close gap (DEVELOPMENT_WORKFLOW.md) is visible in one command. Reports only; never comments on or closes an issue, never opens a PR.
disable-model-invocation: false
argument-hint: ""
allowed-tools: Bash(gh issue list:*) Bash(gh pr list:*)
---

# Close-loop: sweep for shipped-but-open issues

Two instruments, both required for a match. PASTE each command with its raw output (H1 rule: a summary is not the evidence).

1. `gh issue list --label claude-task --state open --json number,title --limit 50`
2. `gh pr list --state merged --limit 40 --json number,title,headRefName,mergedAt,body`
3. For each open issue `#N` from step 1, look for a merged PR from step 2 whose `headRefName` matches `claude/issue-N-*`. That is instrument one (branch-name match).
4. For any branch-name match, check whether that PR's `body` contains the literal text `Task: #N`. That is instrument two (body reference).
5. Build a match table with three rows, not one bucket:
   - **Agreement** — both instruments hold: issue is shipped and open. Candidate for a closing comment (Evoni's call, Rule 7).
   - **Disagreement** — a branch-name match exists but `Task: #N` is absent, or the reverse. Needs a human read before assuming anything; do not treat a single instrument as sufficient.
   - **No match** — issue has no merged PR with a matching branch name at all. Likely still open for real.
6. Output the raw command output from steps 1–2, then the match table from step 5.

This skill never comments on or closes an issue, and never opens a PR. Closing is Evoni's, under Rule 7.
