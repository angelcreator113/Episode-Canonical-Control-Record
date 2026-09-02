---
name: pr
description: Open the pull request for the current claude/ branch under Rule 7 (Draft, Confirm, Execute). Use as /pr <issue-number>. Drafts the title and body, shows them, and only creates the PR after an explicit yes.
disable-model-invocation: true
argument-hint: "[issue-number]"
arguments: issue
---

# Open PR for issue #$issue (Rule 7)

DRAFT. Show, do not send:
- Title: conventional prefix, imperative, ends with ` [skip-automerge]`. Example: `fix(routes): return 404 for missing scene set [skip-automerge]`.
- Body: use `.github/pull_request_template.md`. Reference the issue as plain text `Task: #$issue` (no `closes`/`fixes`/`resolves` - FD-21). Paste the raw validation output from `/validate`. Tick only guardrail boxes you actually satisfied.
- Base: `main`. Never `dev` (dev is 328 commits behind main and receives nothing).
- Confirm the branch is pushed: `git ls-remote --heads origin <branch>` and paste it. The pre-push hook printing "All checks passed" is not evidence the push landed.

CONFIRM. Ask: "Create this PR now? (yes/no)". Wait. In a cloud session where the user is away, stop here and leave the drafted title and body in your final message; the user creates the PR from the diff view's Create PR button.

EXECUTE, only after yes: create with the GitHub MCP tool (create_pull_request) or `gh pr create --title "<title>" --body-file <tempfile> --base main`. Never pass the body inline in PowerShell. Then print the PR URL and stop. Do not merge, do not enable auto-merge, do not request Copilot review.
