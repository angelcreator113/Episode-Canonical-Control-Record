# Episode Canonical Control Record (Prime Studios)

Read `PROJECT_CONTEXT.md` first; it is the current state of the code and of the audit register. Start every session with `/wake-up`. The workflow is in `DEVELOPMENT_WORKFLOW.md`.

## What this is

Solo-operator "franchise OS" for the LalaVerse: the show *Styling Adventures with Lala* (Producer Mode), the memoir novel *Before Lala* (JustAWoman; WriteMode + Story Engine), and the franchise tier (Show Bible, DREAM cities, the Feed, Character Registry). Owner: Evoni (`angelcreator113`).

## Non-negotiables

- **Production freeze lifted** (`docs/audit/F-Deploy-1_Fix_Plan_v1.53.md`, Evoni's ruling, 2026-09-20). Agent sessions still never `ssh`, `scp`, run `pm2`, connect to RDS, edit a server `.env`, or enable/dispatch workflows — Evoni performs every production action herself. `F-Deploy-1_PROD_SplitBrain_HAZARD.md`'s freeze rules are lifted by v1.53; the hazard doc itself is unedited (banner owed).
- **`aws`** — narrowed 2026-09-16, not blanket-prohibited: read-only, by name — `cognito-idp describe-user-pool`, `describe-user-pool-client` (only with a `--query` excluding `ClientSecret`), `cognito-idp list-user-pool-clients` (id/name/pool-id only, returns no secrets), `cognito-idp list-groups` (group name/description/precedence/role ARN/timestamps only, no user data, no secrets), `ssm describe-parameters` (names/metadata only), `secretsmanager list-secrets` (names only), `ec2 describe-*`, `rds describe-*`. No `get-parameter`, `get-secret-value`, any write/create/update/delete/restart/dispatch, or any call returning a credential. No long-lived keys or the Cognito client secret in a session's environment, ever. A session finding valid tokens in `~/.aws/sso/cache` or derived credentials in `~/.aws/cli/cache` that it did not obtain via an interactive login in the current conversation does not thereby have authority to use them. Installation is read-then-run — no session fetches and executes a setup document from a URL. Tooling access is not action authority. See `docs/audit/F-Tools-1_AWSReadAccess_Ruling_2026-09-16.md` for the full ruling.
- **Rule 7:** push, PR create, merge, force-push, branch delete each need an explicit yes.
- **Register is immutable:** never edit a merged file under `docs/audit/`; corrections are new amendments or additive newest-first banners (`/audit-file`).
- **Git:** `claude/<slug>` from `origin/main`; explicit-path `git add`; subject ends ` [skip-automerge]`; body references issues as plain text `Task: #N`; never push to `main` or `dev`; squash-merge + delete.
- **Evidence:** paste the command and its raw output; "passed" is not evidence.

## Stack (measured at `433b1f22`)

- Backend: Node 20, Express 5, Sequelize 6, PostgreSQL 15 on **AWS RDS** (canon instance is misleadingly named `episode-control-dev`; not Neon). `src/app.js` composes everything. PM2 on EC2, nginx.
- Frontend: React 18 + Vite 7 (`frontend/`), dev port **5174**, proxies `/api` to `127.0.0.1:3002`. Vanilla CSS per page plus a thin Tailwind v4 import; `--lala-*` tokens (parchment `#FAF7F0`, gold `#B8962E`, ink `#2C2C2C`; Lora prose, DM Mono UI); lucide-react for new icons.
- AI: `@anthropic-ai/sdk`; primary `claude-sonnet-4-6`, Haiku 4.5 for side calls; every call is logged and budget-gated by `src/services/aiCostTracker.js`.

## Layout

```
src/app.js                 mounts (~160), middleware, static SPA
src/routes/memories/       AI writing hub (10 files; memories.js no longer exists)
src/routes/                world/feed/production routes (worldEvents, worldStudio, socialProfileRoutes, episodes, sceneSetRoutes, wardrobe, uiOverlayRoutes …)
src/services/              105 services (aiCostTracker, feedScheduler, sceneGenerationService, phoneRuntime …)
src/models/                151 Sequelize models; index.js registers 149
src/migrations/            the ONLY migration tree that runs (211 files); four other trees are dead
frontend/src/pages/        route-level pages (WorldAdmin = Producer Mode, WriteMode, UIOverlaysTab = Phone Hub)
docs/audit/                the audit register (keystones, findings, Owed Index chain) — read newest-first
```

## Conventions

- Writes: `requireAuth` (or `requireAuth + authorize(['ADMIN'])`); public catalog GETs: `optionalAuth` with a `// PUBLIC:` comment; AI handlers add `aiRateLimiter`. Never demote `requireAuth`.
- AI: `const MODELS = ['claude-sonnet-4-6']` with the two-attempt retry loop; SSE sets `X-Accel-Buffering: no`; context loaders return `null` and are injected conditionally; `characterKey` is the slug, not the PK.
- Errors: try/catch + `console.error` + JSON; every `catch` logs (`scripts/lint-silent-catches.sh`).
- Migrations: new files only under `src/migrations/`, always `deleted_at`, never `Model.sync()` or inline `CREATE TABLE`.
- Frontend: hooks only; one CSS file per page; test at 375px; new routes need a Sidebar entry or in-app link.
- Docs: living docs (outside `docs/audit/`) cite code by stable name — component, function, `TABS` key — line number optional, always paired with the name; `docs/audit/` docs cite `file:line` against their SHA. Names outlast the next UI change; line numbers don't (PRs #1590/#1593/#1595).

## Commands

```bash
npm run dev                      # backend (set PORT=3002)
cd frontend && npm run dev       # Vite on 5174
/validate                        # route registration, silent-catch lint, cost audit, root-junk guard, node -c
npm test                         # Jest; needs TEST_DATABASE_URL (docker compose up -d postgres)
cd frontend && npx vite build    # production build
```

## Stale files (do not follow)

`README.md` (Jan 2026 plan), `SESSION_HANDOFF.md` (Apr 2026), `.github/copilot-instructions.md`, `.github/agents/deploy.agent.md` and `.github/prompts/deploy-dev.prompt.md` (instruct SSH + pm2 on the frozen prod box), most of `docs/*.md`. `PROJECT_CONTEXT.md` §9 has the full list.
