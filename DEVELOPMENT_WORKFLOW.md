# Development Workflow — phone-first, Claude-driven

**Repo:** `angelcreator113/Episode-Canonical-Control-Record` · **Owner:** Evoni (JustAWomanInHerPrime, `angelcreator113`) · **Written:** 2026-09-01 against `origin/main` at `433b1f22`.

This is the step-by-step operating manual for one loop:

```
 Claude Desktop project            GitHub                 Claude Code                GitHub mobile
 (knowledge + instructions)        issue                  (cloud session, laptop     (review, approve,
 drafts the task prompt  ───────►  #N   ───────────────►  CLI, or Remote Control)  ► squash-merge)
        ▲                                                  branch claude/issue-N
        │                                                  /wake-up → /task N → /validate → PR
        └────────────── PROJECT_CONTEXT.md is refreshed by a task like any other ──────────────┘
```

Read `PROJECT_CONTEXT.md` first. It says what the product is, what is frozen, and what is owed. This document only says how to move work.

---

## 0. Ground rules that every lane inherits

These come from the repo's audit register (`docs/audit/NEW_CHAT_ONBOARDING.md` §4, Handoff v25 Sec 6) and are enforced where a machine can enforce them (`.claude/settings.json`, `.claude/hooks/guard-dangerous-commands.js`, the CI `Validate` workflow, branch protection).

| Rule | What it means in practice | Enforced by |
|---|---|---|
| **Prod is FROZEN** | No agent session, ever, runs `ssh`, `scp`, `pm2`, `aws`, connects to an RDS host, edits a server `.env`, or dispatches/enables a workflow. Evoni does those personally, outside any Claude session, after a Rule 7 confirm. | deny rules + PreToolUse hook |
| **Rule 7 — Draft → Confirm → Execute** | Push, PR create, merge, force-push, branch delete each get an explicit yes. Local mechanical ops do not. | `/pr` skill stops and asks |
| **Live beats docs beats memory** | Start every session with `/wake-up`. Never trust a remembered SHA, PR list, or "the docs say". | `/wake-up` skill |
| **`[skip-automerge]`** | Every commit subject and PR title carries it. Auto-merge is disabled today; the token stays because the guard that failed once (2026-05-30) was "remember the tag". | PR template, `/task` skill |
| **FD-21 commit hygiene** | No `closes`/`fixes`/`resolves` next to `#N`. Reference issues as plain text `Task: #N`. PR bodies via `--body-file`, never inline in PowerShell. | `/pr` skill |
| **Explicit-path `git add`** | Never `git add .` or `-A`. Review `git diff --cached` before every commit. | `/task` skill, root-junk pre-commit guard |
| **One issue = one branch = one PR** | Branch `claude/issue-N-slug` from `origin/main`. Base `main`. Squash-merge, delete branch. `dev` receives nothing (328 commits behind). | convention; `/pr` refuses base `dev` |
| **Register documents are immutable** | Nothing under `docs/audit/` is edited in place after merge. Corrections are new amendments or additive, dated banners. | `/audit-file` skill |
| **H1 — paste the command and its output** | "Validation passed" is not evidence. The raw tail of each check is. | `/validate` skill, PR template |

---

## 1. Accounts and devices

| Thing | Why | Notes |
|---|---|---|
| claude.ai account on **Pro or Max** | Cloud sessions, the mobile Code tab, Remote Control, Routines, Dispatch, and `--teleport` all require a claude.ai subscription login, not an API key. | Feature table: https://code.claude.com/docs/en/feature-availability |
| GitHub account `angelcreator113` | Repo owner; admin bypass on `main` is on (0 required reviews, 3 required checks). | Fine-grained PAT needed only for the optional GitHub MCP server. |
| **Claude app** on the phone (iOS/Android) | Code tab: start and steer cloud sessions; drive Remote Control; message Dispatch. | Same account as the laptop. `claude.ai/code/new` opens the app. |
| **GitHub Mobile** on the phone | Review diff, approve, squash-merge, comment, create issues. It cannot dispatch `workflow_dispatch` workflows (use a browser). | |
| Windows laptop | Claude Code CLI, Claude Desktop, local Postgres via Docker. | PowerShell hazards apply (§9). |

---

## 2. One-time setup — laptop (about 30 minutes)

### 2.1 Toolchain

1. Install **Git for Windows** (gives Claude Code a Bash tool; without it the PowerShell tool is used and the repo's hooks assume bash paths).
2. Install **Node.js 20 LTS** (`package.json` engines: node ≥ 20, npm ≥ 9). Check: `node --version`.
3. Install **Docker Desktop** if you want `npm test` locally (Postgres 15 container). Optional; CI runs the DB tests on every PR.
4. Install the **GitHub CLI** (`winget install GitHub.cli`), then `gh auth login` (browser flow, HTTPS, default scopes plus `workflow`). Claude Code's `/web-setup` and `/pr` both use it.

### 2.2 Claude Code

```powershell
irm https://claude.ai/install.ps1 | iex      # native installer (or: winget install Anthropic.ClaudeCode)
claude --version
claude doctor
```

Open a terminal in the repo and run `claude`, then `/login` and choose the claude.ai account (not an API key). Confirm with `/status` that **Login method** shows the claude.ai account.

### 2.3 Repo

```powershell
git clone https://github.com/angelcreator113/Episode-Canonical-Control-Record.git
cd Episode-Canonical-Control-Record
npm install            # `prepare` sets core.hooksPath=.githooks (root-junk + cost-audit pre-commit, validate pre-push)
cd frontend; npm install; cd ..
Copy-Item .env.example .env
```

Edit `.env` for **local only**: `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/episode_metadata`, `PORT=3002`, leave AWS/Cognito blank. Never put an RDS hostname, the server `.env`, or any live credential in this file. Then:

```powershell
docker compose up -d postgres
npm run migrate:up      # runs src/migrations only (the tree .sequelizerc names)
npm run dev             # nodemon; set PORT=3002 to match frontend/vite.config.js proxy
cd frontend; npm run dev   # Vite on 5174, proxies /api to 127.0.0.1:3002
```

`npm test` needs `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/episode_metadata_test` (create the DB first). CI does the same in `.github/workflows/validate.yml`. (That URL matches `docker compose up -d postgres` from `docker-compose.yml`; if you use `docker-compose.test.yml` instead, its Postgres is on host port 5433.) Note that `tests/setup.js` refuses to start any backend test, even DB-free ones, without this variable.

**Testing from a phone on the same wifi.** `frontend/vite.config.js` binds the
dev server to all interfaces, so a phone on the same network can reach it
directly — no extra flag needed.

1. Both dev servers must be running: `npm run dev` (backend, :3002) and
   `cd frontend; npm run dev` (Vite, :5174).
2. Find the laptop's LAN IP on Windows: `ipconfig` in a new terminal, then
   read the `IPv4 Address` under the adapter you're connected through (Wi-Fi
   or Ethernet) — looks like `192.168.x.x` or `10.x.x.x`.
3. On the phone's browser, load `http://<laptop-lan-ip>:5174` (the port
   does not change).
4. The backend's CORS allowlist detects the laptop's current LAN IP at
   startup (`getLocalNetworkOrigins()` in `src/app.js`) — restart `npm run
   dev` (backend) if you reconnect to a different network, since **the LAN
   IP can change on reconnect** and the allowlist is only as current as the
   backend process's last start.

### 2.4 Project-level Claude configuration (already committed)

When you first run `claude` in the repo it asks you to trust the folder and to approve the project MCP server in `.mcp.json`. Say yes to both. What is in the repo:

| File | Purpose |
|---|---|
| `CLAUDE.md` | Standing instructions loaded every session (short; points at `PROJECT_CONTEXT.md`). |
| `.claude/settings.json` | Allow-list for the validation commands; **deny-list** for `ssh`, `scp`, `pm2`, `aws`, `gh workflow run/enable`, pushes to `main`/`dev`, force-push; `Read` deny for `.env*` and `backups/`; the SessionStart dependency hook; the PreToolUse guard. |
| `.claude/hooks/guard-dangerous-commands.js` | Second layer: blocks the same things inside compound commands, plus connections to RDS hostnames and `DB_SYNC_FORCE`. Matches command position only, so documents that mention these words are not blocked. Exit 2 shows Claude why. |
| `.claude/hooks/session-start.sh` | In cloud sessions (`CLAUDE_CODE_REMOTE=true`) installs backend and frontend deps in the background. Does nothing locally. |
| `.claude/skills/*` | `/wake-up`, `/task N`, `/validate`, `/pr N`, `/audit-file` (§6). |
| `.mcp.json` | GitHub MCP server (hosted, `https://api.githubcopilot.com/mcp/`) authenticated with `${GITHUB_PAT}`. |
| `.github/ISSUE_TEMPLATE/claude-task.yml` | The issue form the Desktop project fills in. |
| `.github/pull_request_template.md` | Validation output + guardrail checklist. |

### 2.5 GitHub access for Claude Code (pick one, both is fine)

**(a) claude.ai GitHub connector — simplest.** Connect GitHub once at https://claude.ai/customize/connectors. When the CLI is signed in with the subscription, claude.ai connectors load automatically and appear in `/mcp`. This is the same connector Claude Desktop and the web use.

**(b) Project `.mcp.json` with a fine-grained PAT — explicit and scoped.**
1. GitHub → Settings → Developer settings → Fine-grained tokens → Generate. Repository access: only this repo. Permissions: Contents RW, Issues RW, Pull requests RW, Metadata R, Actions R (read-only). 90-day expiry.
2. `setx GITHUB_PAT "github_pat_…"` in PowerShell, open a new terminal.
3. `claude` → `/mcp` → `github` should show connected. If not: `claude mcp reset-project-choices` and re-approve.

Never commit the PAT. `.mcp.json` only references `${GITHUB_PAT}`.

### 2.6 Connect the laptop to Claude Code on the web

Inside `claude`: run `/web-setup`. It syncs the `gh` token to your claude.ai account and creates the **Default** cloud environment (Trusted network: npm and GitHub reachable, nothing else). Alternatively do it in the browser at https://claude.ai/code (Continue on web → Sign in with GitHub → Default environment).

Optional but recommended: install the **Claude GitHub App** on this one repository (https://github.com/apps/claude). It is what enables PR **Auto-fix** (Claude reacts to CI failures and review comments) and GitHub-event **Routines**. It does not change what sessions can read.

---

## 3. One-time setup — the Claude Desktop project (about 15 minutes)

The Desktop/web project is the planning brain. It never touches the repo directly; it produces prompts and issues.

1. claude.ai (or Claude Desktop → Chat) → **Projects** → New project → name it `Prime Studios — Dev Control`.
2. **Project instructions**: paste the contents of `.claude/desktop/PROJECT_INSTRUCTIONS.md`.
3. **Project knowledge** (upload these files from the repo; re-upload when they change):
   - `PROJECT_CONTEXT.md` (the state of code and conversations)
   - `DEVELOPMENT_WORKFLOW.md` (this file)
   - `.claude/desktop/PROMPT_LIBRARY.md`
   - `CLAUDE.md`
   - `docs/audit/NEW_CHAT_ONBOARDING.md`
   - `F-Deploy-1_PROD_SplitBrain_HAZARD.md`
   - the newest `docs/audit/Prime_Studios_Audit_Handoff_v<N>.md` (v25 today) and the newest `v25_Owed_Index_Amd<N>` (Amd30 today)
   On Pro/Max, large knowledge switches to retrieval automatically, so uploading the whole audit handoff is fine.
4. **Connect GitHub** to the project chat: click **+** → *Add from GitHub* to pull files for context, and turn on the **GitHub connector** (Settings → Connectors) so the project can **create issues** for you. In Claude Desktop the same connector is under **+ → Connectors → GitHub**.
5. Test: ask the project "What is the next task in the locked sequence, and draft the issue." It should return a filled `Claude Code task` form. Ask it to create the issue; confirm it appears in GitHub Mobile.

Projects and connectors are on the Claude mobile app too, so this planning step works from the phone.

---

## 4. One-time setup — phone (5 minutes)

1. Install the **Claude** app, sign in with the same account. Tap **Code**. You should see your sessions and be able to pick the repo. If the Code tab is missing, the plan does not include cloud sessions.
2. Install **GitHub Mobile**, sign in as `angelcreator113`, enable notifications for pull requests and workflow failures on this repo.
3. Save two links to the home screen:
   - New cloud session prefilled for this repo: `https://claude.ai/code?repositories=angelcreator113/Episode-Canonical-Control-Record`
   - The repo's issues list in GitHub Mobile.

---

## 5. The daily loop (phone-first)

### Step 1 — Plan (Claude Desktop / claude.ai project, 5 minutes)

Ask the project for the next task. It answers with a filled **Claude Code task** form: lane, area, goal, the exact prompt, acceptance checks, guardrail confirmation. Say "create it" and the GitHub connector opens the issue with the `claude-task` label. If the connector is off, copy the text and use GitHub Mobile → Issues → New → *Claude Code task*.

What a good prompt contains (the project is instructed to produce this shape): the goal in one sentence; the files it may touch; the conventions that apply (from `CLAUDE.md`); the validation commands; the branch name; the PR title with `[skip-automerge]`; the words "no host, AWS, database, or Cognito contact".

### Step 2 — Execute (choose a lane)

**Lane A — cloud session from the phone (default).**
Claude app → **Code** → new session → repository `Episode-Canonical-Control-Record`, branch `main`, mode **Accept edits** → paste:

```
Run /wake-up, then /task 123
```

Claude clones the repo in an isolated VM, runs the SessionStart hook (deps install), and works. Close the app; the session continues. You get the session back on any device.

Prefill link (works from any app that can open a URL): `https://claude.ai/code?repositories=angelcreator113/Episode-Canonical-Control-Record&prompt=Run%20%2Fwake-up%2C%20then%20%2Ftask%20123`

**Lane B — laptop CLI.** In the repo: `claude` → `/wake-up` → `/task 123`. Same skills, full local tools, local Postgres available for `npm test`.

**Lane C — laptop does the work, phone drives it.** On the laptop: `claude remote-control` in the repo (press space for a QR code). On the phone: Claude app → Code → pick the session. Local filesystem and MCP servers stay available; the laptop must stay awake.

**Lane D — send from the laptop to the cloud.** `claude --cloud "Run /wake-up, then /task 123"` creates a cloud session from the current branch (push first). `claude --teleport <session-id>` pulls a cloud session back to the terminal.

### Step 3 — Review the diff before there is a PR

In the session (phone or web): tap the `+42 −18` indicator → diff view → tap a line → type a comment → it is bundled with your next message. Iterate until the diff is right. Nothing has reached GitHub except the branch.

### Step 4 — Create the PR

- Cloud session: **Create PR** at the top of the diff view. Title must end with `[skip-automerge]`; base `main`. Choose the full PR (not draft) when acceptance checks are pasted in the body.
- Laptop: `/pr 123`. It drafts, asks for confirmation, then creates via the GitHub MCP tool or `gh pr create --body-file`.

The `Validate` workflow runs on the PR: *Cost Exposure Audit*, *Route Validation* (registration + silent-catch lint), *Tests* (Jest against Postgres 15), *Frontend Tests* (Vitest). The first three are required on `main`.

Optional: reply in the session "watch this PR and fix CI failures or review comments" (needs the Claude GitHub App). Claude pushes fixes to the same branch and replies on threads under your name, labelled as Claude Code.

### Step 5 — Approve and merge from GitHub Mobile

Pull request → **Files changed** → skim → **Review** → **Approve** (you are the only reviewer; approval is a record, not a gate) → when checks are green: **Merge** → choose **Squash and merge** → confirm → **Delete branch**.

Do not use *Rebase and merge* or *Create a merge commit*; the register's ancestry instruments assume squash. Do not merge red.

### Step 6 — Close the loop

- GitHub Mobile: comment on the issue `Merged: #<PR>` (plain text) and close it.
- If the change altered a fact stated in `PROJECT_CONTEXT.md` (a route moved, a keystone changed standing, a doc superseded), file the follow-up task "refresh PROJECT_CONTEXT.md §X" the same way. The context document is maintained by the loop, not by hand.
- If the work produced a register finding, the session files it with `/audit-file` inside the same PR or a separate `docs(audit): … [skip-automerge]` PR.

---

## 6. The skills (what each `/command` does)

| Skill | Use | What it refuses |
|---|---|---|
| `/wake-up` | Position: fetch --prune, basis SHA, open PRs, POSITION vs `origin/main`, shallow check, register tail. Paste-the-output style. | Reading anything before position is known. |
| `/task N` | Reads issue N, quotes its prompt back, creates `claude/issue-N-slug` from `origin/main`, restates the plan, executes under the conventions, validates, commits with explicit paths and `[skip-automerge]`, pushes, hands off to `/pr`. | Any issue asking for host/AWS/DB contact, in-place edits to `docs/audit`, or edits to already-run migrations. |
| `/validate` | The four static checks + `node -c` on touched files + Vite build/Vitest when the frontend changed. Raw output only. | Declaring `npm test` passed in a cloud session (no DB there; CI covers it). |
| `/pr N` | Rule 7: drafts title/body, waits for "yes", creates PR against `main`, prints URL. | Base `dev`, merging, auto-merge, Copilot review. |
| `/audit-file` | Files a register document with basis SHA, standing labels, re-derived tails, additive banners. | Editing filed documents, minting FD/XK/PE numbers. |

Commands and skills are the same mechanism in Claude Code; these live in `.claude/skills/<name>/SKILL.md` and load in cloud sessions because they are committed.

---

## 7. What stays human (Evoni-only), and the safe way to do it

| Action | Why it is not for an agent | Safe procedure |
|---|---|---|
| Anything on the production box (`episode-backend`, 54.163.229.144): process manager, reboot, `.env`, deploy | Split-brain: the running process serves the populated canon RDS instance; the on-disk `.env` points at the empty one. A reload silently swaps prod onto empty. | Only inside the gated reconciliation session described in `F-Deploy-1_PROD_SplitBrain_HAZARD.md`, with a verified backup first. |
| Any AWS CLI or console action | Amd30 §AF2.6: an agent session ran an AWS enumeration that was authorized for Evoni personally; ruled a crossing. | You run it in your own terminal, paste the output into a session if it needs to be recorded, and the session files it as ATTESTED. |
| Dispatching `Deploy to Development` (workflow_dispatch, SSM path) | Authorized manual lever (F-Deploy-1 v1.49). Needs a browser (GitHub Mobile cannot dispatch). | Rule 7: draft the reason in the session, confirm, dispatch from the github.com Actions tab yourself. |
| Enabling `Deploy to Production` or `Auto-merge to Dev` | Both `disabled_manually`; re-enabling is reconciliation-gated. | Not before the reconciliation session. |
| Merging PRs | Squash-merge is the ancestry contract the register relies on. | GitHub Mobile, Step 5. |
| Rotating or storing credentials | Method of record is paper + SHA256 fingerprint (onboarding §4.11). | Never in a Claude session, never in a repo file. |

---

## 8. Optional automation lanes (off by default — each is a Rule 7 decision)

### 8.1 `@claude` on an issue from the phone (Claude Code GitHub Action)

The most phone-native lane: comment `@claude please implement this` on the issue in GitHub Mobile and a GitHub Actions run does the work and opens the PR.

Enable it deliberately:
1. Laptop: `claude` → `/install-github-app`. It installs the Claude GitHub App, stores `CLAUDE_CODE_OAUTH_TOKEN` (subscription) or `ANTHROPIC_API_KEY` as a repo secret, and opens a PR adding `.github/workflows/claude.yml`.
2. Before merging that PR, edit the workflow so the run is bounded: `if: contains(github.event.comment.body, '@claude') && github.event.comment.user.login == 'angelcreator113'`, permissions `contents: write, pull-requests: write, issues: write, id-token: write`. The committed `.claude/settings.json` deny rules and the guard hook apply inside the run because the repo is checked out.
3. Merge it with `[skip-automerge]` in the title like everything else.

Why it is opt-in: this repo's autonomous-PR history (F-Deploy-G1-Y, PE #58, the 2026-05-30 incident) is exactly why every new automation gets a written decision first.

### 8.2 Routines (claude.ai/code/routines)

Cloud sessions on a schedule or on GitHub events, no laptop needed. Two that fit this repo:
- **Nightly health**: prompt "Run /wake-up, then /validate on main; open a PR only if a fix is trivial, otherwise report." Schedule: weekdays 06:00.
- **PR review**: GitHub trigger `pull_request.opened`, base `main`, prompt "Review this PR against PROJECT_CONTEXT.md §Conventions and the F-AUTH-1 tier rules; leave inline comments; never push." Needs the Claude GitHub App on the repo.
Routines run with no permission prompts, so give them the fewest connectors possible (remove everything except GitHub).

### 8.3 Dispatch (Claude Desktop, Pro/Max)

Message Dispatch from the phone ("open a Code session and do issue 123"); it spawns a local Desktop Code session on the laptop and pushes a notification when done. The laptop must be on with Claude Desktop running. Same skills apply.

---

## 9. Troubleshooting and hazards

| Symptom | Cause / fix |
|---|---|
| A cloud session says `git merge-base` returns false for a commit that is on main | Shallow clone. `git fetch --unshallow origin main` (the `/wake-up` skill does this). |
| Pre-push hook prints "All checks passed" but the branch is not on GitHub | The hook reports validation, not transfer (Handoff v25 Sec 4.3). `git ls-remote --heads origin <branch>` is the test. |
| PowerShell mangles a command | One command per line; `&&` is invalid in Windows PowerShell 5; `<placeholder>` parse-errors; `>` redirect writes UTF-16 (use `cmd /c "git show … > file"`); use single-quoted here-strings; never round-trip no-BOM UTF-8 through `Get-Content`. |
| `/web-setup` says "Unknown command" | Signed in with an API key. `/login` with the claude.ai account. |
| GitHub MCP shows disconnected | `GITHUB_PAT` not in the environment of the terminal that launched `claude`, or expired. `setx` then open a new terminal; `claude mcp reset-project-choices`. |
| Session expired | Reopen from claude.ai/code; history restores, background processes do not. |
| The session wants to run `ssh`, the process manager, or the AWS CLI | It is blocked by design. If the task truly needs it, the task is Evoni's, not the agent's (§7). |
| The guard blocks a legitimate command | Heredocs to `cat`/`tee` are ignored, prose is ignored; only command position matches. If a real command is wrongly blocked, run it yourself and file a task to adjust `.claude/hooks/guard-dangerous-commands.js` with a test case. |
| Issue prompt mentions Neon, "memories.js is 12K lines", "use optionalAuth" | Stale facts from old `CLAUDE.md`. `PROJECT_CONTEXT.md` has the current ones (RDS, `src/routes/memories/` directory, F-AUTH-1 tiers). |

---

## 10. Copy-paste prompt starters

The project knowledge file `.claude/desktop/PROMPT_LIBRARY.md` has the full set with fill-in fields. The two you will use most:

**Standard task (paste into a session after the issue exists):**
```
Run /wake-up, then /task 123.
```

**Ad-hoc task without an issue (laptop or cloud):**
```
Run /wake-up first. Then, on a new branch claude/<slug> from origin/main:
GOAL: <one sentence>
FILES: <list>
CONVENTIONS: CLAUDE.md + .github/instructions/<area>.instructions.md
VALIDATE: /validate
STOP before pushing and show me the diff summary and the PR title (must end with [skip-automerge]).
No host, AWS, database, or Cognito contact.
```
