# Episode Canonical Control Record — guidelines for coding agents

Rewritten 2026-11-05 (Task #3722). The authorities are `CLAUDE.md` (rules) and `PROJECT_CONTEXT.md` (current state). If this file disagrees with them, they win.

## What this is

Solo-operator "franchise OS" for the LalaVerse (owner: Evoni, `angelcreator113`):
- the show *Styling Adventures with Lala* (Producer Mode);
- the memoir novel *Before Lala* (JustAWoman; WriteMode and the Story Engine);
- the franchise tier (Show Bible, DREAM cities, the Feed, Character Registry).

## Stack

- **Backend:** Node 20, Express 5, Sequelize 6. `src/app.js` composes everything.
- **Database:** PostgreSQL 17 on **AWS RDS**. The production instance is misleadingly named `episode-control-dev`. Not Neon.
- **Frontend:** React 18 + Vite 7 (`frontend/`), dev port **5174**, proxying `/api` to `127.0.0.1:3002`.
  - Styling: vanilla CSS per page plus a thin Tailwind v4 import, with `--lala-*` tokens (parchment `#FAF7F0`, gold `#B8962E`, ink `#2C2C2C`).
  - Fonts: Lora for prose, DM Mono for UI.
  - Icons: lucide-react.
- **AI:** `@anthropic-ai/sdk`, primary model `claude-sonnet-4-6`, with Haiku 4.5 for side calls. Every call is logged and budget-gated by `src/services/aiCostTracker.js`.
- **Hosting:** pm2 on EC2. Production is served through an ALB, which forwards to the prod box on port 3000.

## Layout

```
src/app.js           mounts, middleware, static SPA
src/routes/memories/ AI writing hub (several files; memories.js no longer exists)
src/routes/          world / feed / production routes
src/services/        services (aiCostTracker, feedScheduler, sceneGenerationService, …)
src/models/          Sequelize models
src/migrations/      the ONLY migration tree that runs
src/workers/         episode-worker (scene generation queue, video export via Redis)
frontend/src/pages/  route-level pages
docs/audit/          the audit register — immutable once merged
docs/runbooks/       operating procedures (deploy-workflow.md, dev-environment.md, …)
scripts/dev-db/      dev box: local Postgres, refresh, install, deploy scripts
```

## Conventions

- **Auth on routes:** writes use `requireAuth` (or `requireAuth` plus `authorize(['ADMIN'])`). Public catalog GETs use `optionalAuth`, marked with a `// PUBLIC:` comment. AI handlers add `aiRateLimiter`. Never demote a `requireAuth` route.
- **AI calls:** `const MODELS = ['claude-sonnet-4-6']` with a two-attempt retry loop. SSE responses set `X-Accel-Buffering: no`. Context loaders return `null` and are injected only when present. `characterKey` is the slug, not the primary key.
- **Errors:** try/catch, `console.error`, a JSON response. Every `catch` logs (`scripts/lint-silent-catches.sh`).
- **Migrations:** new files only, under `src/migrations/`, always with `deleted_at`. Never `Model.sync()` or an inline `CREATE TABLE`.
- **Frontend:** hooks only, one CSS file per page, test at 375px. A new route needs a Sidebar entry or an in-app link.
- **Git:** branch `claude/<slug>` from `origin/main`. Use explicit-path `git add`. Commit subjects end with ` [skip-automerge]`. Reference issues in the body as plain text `Task: #N`. Never push to `main` or `dev`. PRs are squash-merged.

## Commands

```bash
npm run dev                      # backend (PORT=3002)
cd frontend && npm run dev       # Vite on 5174
npm test                         # Jest; needs TEST_DATABASE_URL (docker compose up -d postgres)
cd frontend && npx vite build    # production build
node scripts/validate-routes.js && bash scripts/lint-silent-catches.sh && bash scripts/audit-cost-exposure.sh && node scripts/check-root-junk.js
```

A PR body's "Validation run" block must list those four commands **in that order**, each followed by `EXIT: 0` (`scripts/check-pr-validation-block.js`).

## Production and dev (2026-11-05)

- **Production access (F-Tools-5, `docs/audit/F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`):** agent sessions may operate production for what Evoni asks in the conversation.
  - **Explicit yes first:** anything that deletes or irreversibly changes data or infrastructure needs her explicit yes in that session.
  - **Secrets:** never printed, committed or put in chat.
  - **Deploys and migrations:** go through the *Deploy* workflow (`.github/workflows/deploy.yml`).
  - **Cloud sessions:** their AWS identity is the IAM user `claude-code-ops`, which can use SSM only. Evoni makes IAM, secret and EC2 changes.
- **Prod box** `episode-backend`: `episode-api-prod-hotfix` on port 3000. `episode-worker` is **stopped, pending #3714**, which moves it off the `postgres` login.
- **Dev box** `episode-dev-backend` (runbook `docs/runbooks/dev-environment.md`):
  - **Database:** its own local PostgreSQL 17, a copy of production refreshed through the read-only role `dev_refresh_ro`. No production credential is on the box.
  - **Exposure:** the app listens on **`127.0.0.1:3002` only**, and nginx is off until dev gets its own Cognito pool.
  - **Also on the box:** 1 GiB swap, loopback-only Redis, and a dev-only `JWT_SECRET` for local test tokens.
  - **Deployed by** *Deploy to Development* (`deploy-dev.yml`). The frontend is built on the runner; **never build it on the 2 GB box.**
  - **Refreshed by** *Refresh dev data* (`refresh-dev-data.yml`, a parameterless SSM document). The repo is public, so its logs show match yes/no only.
- **DNS:** `dev.primepisodes.com` still points at the **prod** box and returns 502. The dev box has no DNS name yet.

## Do not follow

- `README.md` (Jan 2026 plan) and `SESSION_HANDOFF.md` (Apr 2026).
- `.github/agents/deploy.agent.md` and `.github/prompts/deploy-dev.prompt.md`: manual SSH deploys, retired.
- Most of `docs/*.md`.
- Any instruction to SSH with a local key, use Neon, or edit `memories.js`.
