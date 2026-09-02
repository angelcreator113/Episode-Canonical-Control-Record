---
name: task
description: Start work on a GitHub issue for this repo - read the issue, create the claude/ branch, restate the plan, and execute with the repo's guardrails. Use as /task <issue-number>.
disable-model-invocation: true
argument-hint: "[issue-number]"
arguments: issue
---

# Work issue #$issue

Preconditions: `/wake-up` has been run this session. If not, run it first.

1. Read the issue with the GitHub MCP tools (issue_read, method get, owner angelcreator113, repo Episode-Canonical-Control-Record, issue_number $issue) or `gh issue view $issue`. Quote its "Prompt for Claude Code" and "Acceptance checks" sections back verbatim before doing anything.
2. Refuse and stop if the issue asks for any of: SSH, pm2, aws, RDS or Cognito contact, server .env edits, enabling or dispatching workflows, editing an already-merged `docs/audit/*` file in place, editing a migration that has already run. Say which line triggered the refusal.
3. Branch: `git checkout -b claude/issue-$issue-<short-kebab-slug>` from `origin/main` (never from `dev`). If you are already on a `claude/**` branch the session was given, keep it.
4. Restate the plan in five lines or fewer: files to touch, validation to run, what the PR will contain. Then execute.
5. Conventions that apply to every change (from CLAUDE.md and .github/instructions/*):
   - routes use `optionalAuth` unless the F-AUTH-1 tier promotion for that route file says `requireAuth`; do not demote a `requireAuth` handler
   - every migration includes `deleted_at`; migrations go in `src/migrations/` (the only tree `sequelize db:migrate` reads)
   - AI calls use the `MODELS = ['claude-sonnet-4-6']` retry loop; SSE sets `X-Accel-Buffering: no`
   - frontend: vanilla CSS, lucide-react, hooks only, test at 375px
   - every `catch` logs; `bash scripts/lint-silent-catches.sh` must stay clean
6. Validate with `/validate` before committing.
7. Commit with explicit paths only (`git add <file> <file>`), review `git diff --cached`, subject in conventional form ending with ` [skip-automerge]`, body referencing the issue as plain text `Task: #$issue` with no closing keyword (FD-21).
8. Push with `git push -u origin <branch>` and then run `/pr $issue`.
