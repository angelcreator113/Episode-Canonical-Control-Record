# Prompt library — Prime Studios

Copy-paste prompts for the Claude Desktop project to fill in, and for Evoni to paste into Claude Code (cloud session from the phone, or the laptop CLI). Every prompt assumes the repo's committed skills (`/wake-up`, `/task`, `/validate`, `/pr`, `/audit-file`) and guardrails are present on the branch.

Fill-in fields are in `<angle brackets>`. Keep the "No host, AWS, database, or Cognito contact" line in every prompt; it is what the guard hook enforces, and saying it keeps the model from planning around it.

---

## P0 — Session openers

**Start any session**
```
Run /wake-up and stop.
```

**Work an existing issue** (the default loop)
```
Run /wake-up, then /task <N>.
```

**Resume after a limit reset or a new session on the same branch**
```
Run /wake-up. The branch claude/issue-<N>-<slug> already has commits; do not recreate it. Read the issue #<N> again, list what is done vs not done in the branch (git log origin/main..HEAD --stat), then continue from the first undone step. No host, AWS, database, or Cognito contact.
```

---

## P1 — Register (docs/audit) tasks

**File an Owed Index amendment**
```
Run /wake-up, then /audit-file amendment "<short title>".
Content to record: <the finding or ruling, with standings: MEASURED / ATTESTED / RULED>.
Basis: origin/main at the SHA /wake-up reported. Re-derive the FD/XK/PE tails with pasted grep instruments. This amendment mints nothing and edits no other file. Prod FROZEN. Commit as docs(audit): <title> [skip-automerge]. Then /pr <N>.
No host, AWS, database, or Cognito contact.
```

**Place a correction banner** (additive, on one filed document)
```
Run /wake-up. On branch claude/issue-<N>-banner-<doc>: prepend a dated CORRECTION BANNER to docs/audit/<file>.md, newest-first, above existing banners, that says exactly: <text>. It may point to <authority doc/section>; it may not carry new rulings. Do not touch any other line of the file. Show me the diff before committing. No host, AWS, database, or Cognito contact.
```

**Limb 1 per-CP confirmation pass** (repo-only)
```
Run /wake-up. Task: F-AUTH-1 limb 1 for CP<k> only, per docs/audit/F-AUTH-1_Fix_Plan_v2.68.md §2–§6. Unit = one recorded CP disposition; population = the recorded dispositions for CP<k> (source: the CP commit body and any closure document recoverable with git show at its adding commit). For each recorded disposition, confirm it against the code at the CP's basis commit (git show <sha>:<path>) and record agree / disagree / cannot-tell with the file:line read. Do not re-derive tiers. Output a MEASURED table plus the cannot-tell rate, filed with /audit-file evidence "Limb1_CP<k>_Confirmation". No host, AWS, database, or Cognito contact.
```

**Measure a claim before anyone acts on it**
```
Run /wake-up. Measure, do not fix: <claim, e.g. "six shadowed route declarations exist in four files">. Paste each command and its raw output (H1). Report MEASURED facts and file:line refs only; no recommendation. No host, AWS, database, or Cognito contact.
```

---

## P2 — Backend code tasks (inside or adjacent to the fix sequence)

**Small correctness fix**
```
Run /wake-up, then on branch claude/issue-<N>-<slug> from origin/main:
Fix: <exact defect with file:line>.
Constraints: keep the handler's auth tier (never demote requireAuth); every catch logs; no schema changes.
Add or extend a Jest test under tests/unit/<area>/ that fails before and passes after (you may run it on the laptop; in a cloud session write it and rely on CI).
Validate with /validate. Commit with explicit paths, subject `fix(<area>): <imperative> [skip-automerge]`, body `Task: #<N>`. Then /pr <N>.
No host, AWS, database, or Cognito contact.
```

**Normalize a model ID in one file**
```
Run /wake-up, then on branch claude/issue-<N>-model-<file>: in <path>, replace the hardcoded model id `claude-sonnet-4-20250514` with the repo's MODELS retry pattern (`const MODELS = ['claude-sonnet-4-6']` with the two-attempt loop from PROJECT_CONTEXT.md §5). Do not change prompts, max_tokens, or temperature. grep the file afterwards to prove no other model string remains. /validate, commit `refactor(ai): use claude-sonnet-4-6 in <file> [skip-automerge]`, /pr <N>. No host, AWS, database, or Cognito contact.
```

**New migration + model change** (rare during the fix cycle)
```
Run /wake-up, then on branch claude/issue-<N>-<slug>: add src/migrations/<YYYYMMDDHHMMSS>-<name>.js that <change>, with deleted_at where a table is created, guarded `describeTable` checks, and a real `down`. Update src/models/<Model>.js to match and register nothing new in index.js unless a model is added. Do NOT add Model.sync() or CREATE TABLE anywhere else. Run `node -c` on both files and /validate. Explain in the PR body why this migration is inside the locked sequence. No host, AWS, database, or Cognito contact.
```

**New memories endpoint** (WriteMode / Story Engine)
```
Run /wake-up, then on branch claude/issue-<N>-<slug>: add POST /api/v1/memories/<name> in src/routes/memories/<domain>.js following .github/instructions/memories-routes.instructions.md EXCEPT: use requireAuth + aiRateLimiter (not optionalAuth), and load context with getCharacterVoiceContext from ./helpers and loadWriteModeContext / buildWriteModeContextBlock from ./engine. MODELS = ['claude-sonnet-4-6'] with the retry loop; SSE if `stream` is true with X-Accel-Buffering: no. `node -c` every file in src/routes/memories/, then /validate. No host, AWS, database, or Cognito contact.
```

---

## P3 — Frontend tasks

**Fix a stale navigation target**
```
Run /wake-up, then on branch claude/issue-<N>-nav-<slug>: in frontend/src/<file>, change the navigate/link target <old> to <new route that exists in App.jsx>. Grep App.jsx to prove the target route exists. Update the sibling *.test.jsx if it asserts the old path. Run `cd frontend && npx vitest run <test file>` and `npx vite build`. Commit `fix(frontend): <imperative> [skip-automerge]`, /pr <N>. No host, AWS, database, or Cognito contact.
```

**Delete verified orphan files**
```
Run /wake-up, then on branch claude/issue-<N>-orphans: for each of <files>, prove it has no importer (`grep -rn "<basename>" frontend/src --include=*.jsx --include=*.js` excluding itself and its own test), then delete it and its test/CSS siblings. If any file has an importer, leave it and say so. `cd frontend && npx vite build` and `npx vitest run`. Commit `chore(frontend): remove orphan files <list> [skip-automerge]`. No host, AWS, database, or Cognito contact.
```

**Page polish at phone width**
```
Run /wake-up, then on branch claude/issue-<N>-<page>-mobile: in frontend/src/pages/<Page>.jsx and <Page>.css, make <specific element> usable at 375px: <what breaks>. Use the existing --lala-* tokens and lucide-react icons; add `@media (max-width: 767px)` rules in the page's own CSS; do not touch responsive.css. Build with `npx vite build`. Commit `style(frontend): <imperative> [skip-automerge]`. No host, AWS, database, or Cognito contact.
```

---

## P4 — Tests and CI

**Add a route-health guard for a route file**
```
Run /wake-up, then on branch claude/issue-<N>-test-<file>: add tests/unit/routes/<file>-tier.test.js in the style of tests/unit/routes/cp12-*-tier.test.js that reads src/routes/<file>.js and asserts every write handler declares requireAuth (or requireAuth + authorize) and every AI handler declares aiRateLimiter. It must run with no database (mock ../../src/models if imported). Run it on the laptop with TEST_DATABASE_URL set, or in a cloud session write it and rely on the CI Tests job. No host, AWS, database, or Cognito contact.
```

**Investigate a CI failure on a PR**
```
Run /wake-up. PR #<PR> failed the <job> job. Read the failing step's output via the GitHub MCP tools (get_job_logs) or by reproducing the command locally. Classify: this PR's change / pre-existing on main / infrastructure. If it is this PR's, push a fix to the same branch with /validate output. If pre-existing on main, say so with the evidence and stop. Never re-run, skip, or quarantine a test. No host, AWS, database, or Cognito contact.
```

---

## P5 — Docs and tooling

**Refresh PROJECT_CONTEXT.md after a merge**
```
Run /wake-up, then on branch claude/issue-<N>-context-refresh: update PROJECT_CONTEXT.md §<n> to reflect <merged PR/commit>: <what changed>. Change only the sentences that are now false; keep the Basis line updated to the SHA /wake-up reported; keep standings (MEASURED/ASSERTED). Commit `docs(context): <imperative> [skip-automerge]`. No host, AWS, database, or Cognito contact.
```

**Retire a dangerous instruction file**
```
Run /wake-up, then on branch claude/issue-<N>-retire-deploy-prompts: replace the bodies of .github/agents/deploy.agent.md and .github/prompts/deploy-dev.prompt.md with a short notice that production is FROZEN, that deploys are Evoni-only via workflow_dispatch of deploy-dev.yml, and a pointer to F-Deploy-1_PROD_SplitBrain_HAZARD.md and DEVELOPMENT_WORKFLOW.md §7. Keep the frontmatter so Copilot still resolves the files. Commit `docs(tooling): retire SSH/pm2 deploy prompts [skip-automerge]`. No host, AWS, database, or Cognito contact.
```

**Archive phase-era docs**
```
Run /wake-up, then on branch claude/issue-<N>-docs-archive: move every docs/*.md whose content is a Jan–Apr 2026 phase/status/completion report into docs/archive/ (git mv, keep names), leaving in docs/ only: DATABASE_SETUP_GUIDE.md, DESIGN_TOKENS_GUIDE.md, ENV_VARIABLES.md, LAYER_API_REFERENCE.md, WARDROBE_LIBRARY_API_REFERENCE.md, SCENE_COMPOSER_API_DOCUMENTATION.md, and docs/audit/ untouched. Write docs/archive/INDEX.md listing each moved file with its original date and one line. Do not edit file contents. No host, AWS, database, or Cognito contact.
```

---

## P6 — Review prompts (for Claude Desktop, given a diff or PR link)

**Review a PR against the disciplines**
```
Review this PR for the Prime Studios repo. Check: [skip-automerge] in the title; plain-text issue reference (no closing keywords); raw validation output pasted; diff limited to the issue's files; no in-place edit under docs/audit/ of an already-merged file; no edit to a migration that has run; no requireAuth demotion; no Model.sync() or CREATE TABLE added; no credentials or RDS hostnames. Answer "MERGE" or up to three bullets of what to fix.
```

---

## Do-not-ask list (the planning project must never generate these)

- "SSH to the server and check…", "restart pm2", "run aws …", "connect to the RDS instance", "edit the .env on the box", "enable the deploy workflow", "dispatch Deploy to Production".
- "Edit docs/audit/<filed document> to say…" (use an amendment or banner instead).
- "Edit migration <already-run file>".
- "Push to main/dev", "force-push", "rebase the shared branch".
- "Mint FD-70" (only a Fix Plan revision mints; Evoni rules it).
