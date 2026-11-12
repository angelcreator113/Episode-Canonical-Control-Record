# Episode Canonical Control Record — guidelines for coding agents

Rewritten 2026-11-05 (Task #3722); production and dev section updated 2026-11-11 (Task #3801). The authorities are `CLAUDE.md` (rules) and `PROJECT_CONTEXT.md` (current state). If this file disagrees with them, they win.

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
- **Hosting:** pm2 on EC2. Production is served through an ALB, which forwards HTTPS to the prod box on port 3000 and redirects plain HTTP to HTTPS.

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

## Production and dev (2026-11-11)

- **Production access (F-Tools-5, `docs/audit/F-Tools-5_AgentProductionAccess_Ruling_2026-10-31.md`):** agent sessions may operate production for what Evoni asks in the conversation.
  - **Explicit yes first:** anything that deletes or irreversibly changes data or infrastructure needs her explicit yes in that session.
  - **Secrets:** never printed, committed or put in chat.
  - **Deploys and migrations:** go through the *Deploy* workflow (`.github/workflows/deploy.yml`).
  - **Cloud sessions:** their AWS identity is the IAM user `claude-code-ops`, which can use SSM only. Evoni makes IAM, secret and EC2 changes.
- **Load balancer** `primepisodes-alb`: HTTPS forwards to the prod box on port 3000; port 80 redirects to HTTPS. It has its own security group, `primepisodes-alb-sg`. The `primepisodes-frontend` target group is deleted, the `episode-frontend` instance is stopped, and the VPC default security group has no inbound rules.
- **Prod box** `episode-backend`: `episode-api-prod-hotfix` on port 3000, the only pm2 process.
  - **Security group:** 3000 from the load balancer's group and 22 from Evoni's address, nothing else.
  - **Worker:** `episode-worker` is **not running and not in pm2**. Its own login, `episode_worker`, is set up (credential file on the box, secret `episode-metadata/prod/worker-db`). Starting it is Evoni's call (#3714).
  - **Deploy snapshots:** each *Deploy* run removes older `deploy-*` snapshots before taking its own.
- **Sign-in (Cognito):** one pool and client for production and dev. Access and ID tokens last 15 minutes; the frontend refreshes silently. Logging out revokes the refresh token at Cognito (`POST /logout` takes `refreshToken` in the body).
- **Dev box** `episode-dev-backend` (runbook `docs/runbooks/dev-environment.md`):
  - **Public site:** `https://dev.primepisodes.com`, through nginx with a Let's Encrypt certificate. nginx serves the built frontend and proxies only `/api/` and `/health`.
  - **Exposure:** the app still listens on **`127.0.0.1:3002` only**. The security group opens 80 and 443, and 22 to Evoni's address. **Never open 3002 or 5432.**
  - **Mode:** the API runs as `NODE_ENV=production`; the deploy and nginx scripts refuse anything else.
  - **Sign-in:** production's Cognito pool, so production users can sign in to dev.
  - **Database:** its own local PostgreSQL 17, a copy of production refreshed through the read-only role `dev_refresh_ro`. No production credential is on the box.
  - **S3:** read-only on the two dev buckets. Uploads and thumbnail generation fail there by design.
  - **Also on the box:** 1 GiB swap, loopback-only Redis, and a dev-only `JWT_SECRET` for local test tokens.
  - **Deployed by** *Deploy to Development* (`deploy-dev.yml`). It skips its tests when CI already passed them for the same commit. The frontend is built on the runner; **never build it on the 2 GB box.**
  - **Refreshed by** *Refresh dev data* (`refresh-dev-data.yml`, a parameterless SSM document). The repo is public, so its logs show match yes/no only. `dev_refresh_ro` can read the AI gateway ledger tables, and the refresh re-applies `episode_worker`'s grants.

## Do not follow

- `README.md` (Jan 2026 plan) and `SESSION_HANDOFF.md` (Apr 2026).
- `.github/agents/deploy.agent.md` and `.github/prompts/deploy-dev.prompt.md`: manual SSH deploys, retired.
- Most of `docs/*.md`.
- Any instruction to SSH with a local key, use Neon, or edit `memories.js`.
