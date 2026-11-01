---
name: pr
description: Open the pull request for the current claude/ branch. Use as /pr <issue-number>. Drafts the title and body from the template with the raw validation output, then creates the PR against main when Evoni asked for it (F-Tools-5 §8 Q1), or asks first when she did not.
disable-model-invocation: true
argument-hint: "[issue-number]"
arguments: issue
---

# Open PR for issue #$issue

DRAFT. Show, do not send:
- Title: conventional prefix, imperative, ends with ` [skip-automerge]`. Example: `fix(routes): return 404 for missing scene set [skip-automerge]`.
- Body: use `.github/pull_request_template.md`. Reference the issue as plain text `Task: #$issue` (no `closes`/`fixes`/`resolves` - FD-21). Paste the raw validation output from `/validate`. Tick only guardrail boxes you actually satisfied.
- Base: `main`. Never `dev` (dev is 328 commits behind main and receives nothing).
- Confirm the branch is pushed: `git ls-remote --heads origin <branch>` and paste it. The pre-push hook printing "All checks passed" is not evidence the push landed.

CONFIRM. If Evoni already asked for this PR (the task, or her message, says to open it), go on: F-Tools-5 §8 Q1 needs no separate yes for a PR. Otherwise ask: "Create this PR now? (yes/no)" and wait.

EXECUTE: create with the GitHub MCP tool (create_pull_request) or `gh pr create --title "<title>" --body-file <tempfile> --base main`. Never pass the body inline in PowerShell. Then print the PR URL and stop. Do not merge, do not enable auto-merge, do not request Copilot review.
