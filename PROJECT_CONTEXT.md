# PROJECT CONTEXT — Prime Studios / Episode Canonical Control Record

**Basis:** `origin/main` at `dd5e6ce4` (2026-09-02). Derived from a full read of the repository, the GitHub API, and the audit register. Facts are MEASURED (checkable in the repo) unless marked ASSERTED (the register says so; requires host/AWS/DB contact to verify, which agent sessions never make). §6.1, §6.5 and §10 items 1–11 were re-checked against this basis 2026-09-03 (Task #1196); unmarked facts elsewhere were carried, not re-verified.

**How to use this file:** it is the knowledge file for the Claude Desktop project and the first thing a Claude Code session should read after `/wake-up`. It replaces the stale facts in the old `CLAUDE.md`, `README.md`, `.github/copilot-instructions.md`, and `SESSION_HANDOFF.md`. When a fact here changes, the change lands as a task through the workflow in `DEVELOPMENT_WORKFLOW.md`, not by hand.

---

## 0. Ten things to know before anything else

1. **Production is FROZEN.** The prod box (`episode-backend`, 54.163.229.144) serves the populated canon database through a process whose on-disk `.env` points at a second, empty database. Any restart, deploy, reboot, or `.env` edit can silently swap production onto nothing. See §7 and `F-Deploy-1_PROD_SplitBrain_HAZARD.md` (repo root).
2. **Agent sessions never touch hosts, AWS, RDS, or Cognito.** Evoni does that personally. The one time an agent session ran an AWS command it was ruled a crossing (v25 Owed Index Amd30 §AF2.6). The repo now enforces this with `.claude/settings.json` deny rules and a PreToolUse guard.
3. **The code has been static since May 2026.** Feature work stopped around 2026-05-09. Since then the only source changes are F-Stats-1's raw-SQL-to-ORM PRs (Aug 1–4) and F-AUTH-1's auth hardening (Aug 17–22). Everything else is `docs(audit)`.
4. **The repo is mostly an audit register now.** `docs/audit/` holds 427 files: keystone fix plans, findings, evidence notes, and a chain of "Owed Index" amendments (Amd1–Amd30). The register has its own rules (§8). They are the project's real canon.
5. **No one can log in to the app on `main`.** `POST /api/v1/auth/login` returns `401 AUTH_LOGIN_DISABLED` unconditionally (FD-65). There is no Cognito hosted UI or SDK anywhere. The only token sources are an out-of-band Cognito `USER_PASSWORD_AUTH` call (freeze-gated) or the test token service.
6. **The old `CLAUDE.md` was wrong in six places**: the DB is AWS RDS, not Neon; `src/routes/memories.js` is now a 10-file directory; routes use `requireAuth`, not `optionalAuth`; Tailwind v4 is imported; the dev port is 5174, not 5173; several files still use `claude-sonnet-4-20250514`. Corrected in the new `CLAUDE.md`.
7. **Only one GitHub issue has ever existed** (#708, the auto-merge `-X ours` incident log). Work has always flowed through PRs (about 1,168 of them, squash-merged). Issue-driven work is new.
8. **Branch protection on `main`** requires three checks (Cost Exposure Audit, Tests, Route Validation), zero reviews, and admins can bypass. Auto-merge to `dev` and Deploy to Production are `disabled_manually`. Deploy to Development is active but `workflow_dispatch` only, via SSM.
9. **`dev` is dead.** It is 328 commits behind `main` with 81 unmerged commits of its own (last 2026-06-27). Base every PR on `main`.
10. **The product intent** is a solo-creator "franchise OS": the LalaVerse world (DREAM cities, the Feed, events, wardrobe), the show *Styling Adventures with Lala*, and the memoir novel *Before Lala* (protagonist JustAWoman), with AI generation everywhere. The architectural keystone still unbuilt is Director Brain: making the franchise tier the single canon source instead of the dozens of private JavaScript literals that production code carries today.

---

## 1. Identity and people

| | |
|---|---|
| Repository | `angelcreator113/Episode-Canonical-Control-Record` (private). Description: "The Episode page is the canonical index of everything that happened because of this episode — NOT the system that manages those things." |
| Owner / operator | Evoni, also JustAWomanInHerPrime (JAWIHP), GitHub `angelcreator113`. Windows PowerShell laptop. Sole developer since May 2026. |
| Second developer (historical) | `TySteamTest` — 1,578 commits, January to May 2026. Also the identity under which a GitHub App squash-merged autonomous PRs (PE #58–#60). |
| Claude | 1,733 commits authored as "Claude" plus co-author trailers on many more; every `docs(audit)` document is "Claude, with JAWIHP / Evoni". |
| Bots | `github-actions[bot]` 707 (auto-merges to `dev`, now disabled), `copilot-swe-agent[bot]` 15, `dependabot[bot]` 14. |
| Deployments (ASSERTED) | `primepisodes.com` → prod box, frozen, ~3 months behind `main`. `dev.primepisodes.com` → DNS still points at the prod box (v1.40); the dev box `episode-dev-backend` (54.87.253.45) is deployed by manual SSM dispatch. |
| Brand names | Prime Studios (studio/company), LalaVerse (world), *Styling Adventures with Lala* / SAL (show), *Before Lala* (Book 1, JustAWoman's memoir), Lala (the show's protagonist; the "daughter" in one framing, a "sentient fashion game character" in another — an unresolved canon split), Amber (the in-app AI assistant persona). |

---

## 2. History in one page

| Period | What happened | Evidence |
|---|---|---|
| Dec 31 2025 | Requirements v2.0, technical architecture, and 8–10 week roadmap written for an "Episode Metadata Storage Solution" for *Styling Adventures w Lala*: PostgreSQL, Express, Cognito, S3, Lambda thumbnails, ECS. Target launch Feb 14 2026. | `Mvp/*.txt`, `README.md` |
| Jan 2026 (415 commits) | Phase 0–2: repo, CRUD API, thumbnails gallery, search, migrations, shows/episodes/assets. Global `paranoid: true` added 2026-01-09 without a schema-wide `deleted_at` (root of XK-1). | `src/migrations/2024…`, `docs/PHASE_*` |
| Feb 2026 (680) | Video-production suite: scene composer, thumbnail templates, timeline editor, video composer, game-show features, wardrobe library, AI edit maps. From Feb 20: storyteller books/chapters, character registry, universes — the *Before Lala* novel tooling begins. | `docs/SCENE_COMPOSER_*`, migrations 20260220+ |
| Mar 2026 (1,472) | The LalaVerse pivot: social profiles (the Feed), franchise knowledge (Show Bible / Franchise Brain), world characters, relationships, story engine, texture layers, novel intelligence, `memories.js` split into `src/routes/memories/` (PR #328, 2026-03-25). | migrations 20260302–20260324 |
| Apr 2026 (1,881, peak) | DREAM cities, world map, consolidated world pages, Phone Hub and screen links, feed moments, financial ledger, wardrobe product shots, phone missions/playthrough. Last feature session handoff dated 2026-04-14. | `SESSION_HANDOFF.md`, migrations 20260725–20260807 (file dates, not commit dates) |
| May 2026 (299) | Six incidents in one week (outages from shared-box deploys, autonomous PRs, `-X ours` merges) start the audit program. F-AUTH-1 backend sweep (12 CPs) lands. F-App-1 ships. Prod split-brain found May 29–30; freeze declared; automated deploy breaches it May 30; prod found 502 for days June 1. | `docs/audit/F-Deploy-1_G1_Audit.md`, root incident docs |
| Jun–Jul 2026 (283) | F-Deploy-1 executes: credential rotations, a parallel-tree restart plan that is abandoned, all-stopped incident June 27, split-brain aligned July 6, dev box + SSM deploy path July 10–14, burn-in, keystone closed July 22. F-Stats-1 Phase B begins. Frontend IA audit and ghost cleanup (PR #896). | `docs/audit/F-Deploy-1_Fix_Plan_v1.*` |
| Aug 2026 (221) | F-Stats-1 ORM PRs; F-AUTH-1 reopened (FD-63), 95 handlers promoted (#1039), `/test-token` deleted (#1044), FD-68 shipped (#1087/#1088), password login disabled (#1100). Handoffs v23–v25; the v25 Owed Index and its amendment chain. Cognito pool topology decided (Branch B, Aug 28). | `docs/audit/F-AUTH-1_Fix_Plan_v2.4x–v2.68` |
| Sep 2026 (4) | Amd27–Amd30: canon schema reads, an authorized-but-crossed AWS enumeration, correction banners. | `docs/audit/v25_Owed_Index_Amd2*` |

Repository totals: 5,255 commits on `main`; ~1,168 PRs; commit types `fix` 1,307, `auto-merge` 710, `docs` 513, `merge` 500, `feat` 237. Source-touching commits per month: Jan 152, Feb 491, Mar 1,071, Apr 619, May 33, Jun 2, Jul 3, Aug 17.

---

## 3. What the product is (intent)

Three tiers, one operator:

- **Franchise tier** ("LalaVerse" in the sidebar): `universes`, `franchise_knowledge` (the Show Bible / Franchise Brain, 102 seeded "franchise law" rows), the DREAM world (Dazzle District, Radiance Row, Echo Park, Ascent Tower, Maverick Harbor), social systems (15 influencer archetypes, celebrity tiers, gossip outlets), a cultural calendar (42 events in story-year 8385), and the Character Registry (`registry_characters`, the hub of the character graph).
- **Show tier / Producer Mode** (`/shows/:id/world`, `WorldAdmin.jsx`, 8,122 lines): the *Styling Adventures with Lala* production loop. World events (invitations, prestige, cost, dress code) get injected into episode scripts as `[EVENT: …]` tags; episodes are evaluated (SLAY/PASS/SAFE/FAIL) and apply stat deltas to `character_state` (Prime Coins, Reputation, Influence, Brand Trust); wardrobe, scene sets (Konva Scene Studio), Lala's Phone (screen overlays, tap zones, missions, playthrough), career goals, opportunities, and a financial ledger.
- **Write tier**: *Before Lala*. `storyteller_books → chapters → lines → memories`. WriteMode (`/write/:bookId/:chapterId`) gives voice-matched AI prose (voice-to-story, continue, deepen, nudge, rewrite options, scene planner) grounded in a Memory Bank of confirmed character memories and a 15-loader context block. A Story Engine can generate a 50-chapter arc and full stories from hardcoded character DNA, but its UI pages were deleted as ghosts in July; the backend survives without a caller.

The intended keystone, **F-Franchise-1 / Director Brain**, is that the franchise tier is currently *write-only*: `Universe` is read by three shallow routes and no generator; every generator carries its own canon literal (`WORLD_CONFIGS`, `DREAM_INFRA`, `CHARACTER_FOLLOW_PROFILES`, `SEED_GOALS`, `JAWIHP_VOICE_DNA`, frontend `data/*.js`), and those copies disagree (three different "Book 1 casts", two Lala origin stories, legacy city names still in the feed scheduler). Director Brain is last in the locked fix sequence and has zero repository presence.

---

## 4. Architecture (measured)

### 4.1 Backend

- **Stack:** Node 20, Express 5.2, Sequelize 6.37 on PostgreSQL 15, `@anthropic-ai/sdk` 0.74, `aws-jwt-verify`, Bull + Redis (optional), Socket.io, sharp, fluent-ffmpeg, canvas, multer. 706 files under `src/`, ~190k lines.
- **Composition:** `src/app.js` (1,744 lines) is the whole HTTP composition; `src/server.js` (293) owns the process. Boot order: `dotenv` (cwd-relative at `server.js:7`; the PM2 ecosystem files load `.env` by explicit path, which is why a bare `pm2 start src/server.js` failed on 2026-06-01) → `services/aiCostTracker` and `services/aiResponseCache` monkey-patch the Anthropic SDK → `require('./models')` (fatal on failure) → async DB authenticate → middleware → ~160 route mounts → static SPA serving from `frontend/dist` → 404/error handlers. Two in-process schedulers start at boot: CFO agent every 6h, feed scheduler every 4h (`app.js:666–675`, skipped in test).
- **Middleware order:** `trust proxy=1` → `/ping` → CORS (hard-coded allowlist incl. raw EC2 IPs, plus LAN IPs) → helmet with CSP off → JSON 10 MB → (F-AUTH-1 FD-67 Option 1, PR #1185 / `7a1eb427c`, merged 2026-09-02: the app-wide `optionalAuth` mount that used to run here at `app.js:236` is removed; every route that relied on it for optional identity now carries its own explicit `optionalAuth`) → `attachRBAC` → `captureResponseData` → rate limiters (500 req/15 min/IP on `/api`, 60 writes/min/IP) → `/health` → routes.
- **Mount table (highlights):** `/api/v1/memories` hosts seven routers (the `memories/` hub plus six more); bare `/api/v1` hosts sixteen (markers, export, beats, evaluation, world, worldEvents, worldStudio, careerGoals, arcRoutes, …); `/api/v1/episodes` hosts eleven. Mount order is the only arbiter of param-route shadowing. Legacy unversioned mounts survive: `/api/scripts`, `/api/footage`, `/api/scene-links`, `/api/decision-analytics`, `/api/youtube`. Full table: `src/app.js:425–1551`.
- **Route loading:** ~30 modules use `trackRouteLoad()` (failure → 500 "Routes not available" and visible at `/api/v1/debug/routes`); ~100 use inline try/catch (failure → prefix silently 404s). `npm run validate` statically checks every route file is registered.
- **Auth model:** dual verifier by JWT `alg` (`src/middleware/auth.js`): RS256 → Cognito (`aws-jwt-verify`, lazily built; missing/placeholder config → `500 AUTH_CONFIG_MISSING`), HS256 → `tokenService` with `JWT_SECRET` (≥32 chars). Both yield an equally trusted `req.user`. `requireAuth` is on ~1,400 handler declarations across 133 route files; `optionalAuth` survives on ~64 public catalog GETs (Tier 4) and two "degrade on infra failure" routes (Tier 3). `authorize(['ADMIN'])` guards ~35 sites; a separate lowercase `rbac.js` scheme guards four legacy files. `/api/v1/auth/login` is disabled; `/refresh`, `/logout`, `/me`, `/validate` remain (HS256 only).
- **DB config:** `src/config/sequelize.js` — development/test parse `DATABASE_URL` (test prefers `TEST_DATABASE_URL`); **production ignores `DATABASE_URL` and reads `DB_HOST/DB_USER/DB_PASSWORD/DB_NAME` only** (PE #41). Global `define`: `underscored`, `timestamps`, `paranoid: true`, `freezeTableName`. `server.js` still runs one boot-time DDL (shows unique partial indexes).
- **Workers:** PM2 `episode-worker` runs `src/workers/start.js`: Bull `video-export` renderer (ffmpeg/canvas → S3) and a DB-polling `generation_jobs` worker (scene generation via RunwayML/Replicate/fal). In non-production `server.js` embeds the scene worker so `npm run dev` processes jobs.
- **AI plumbing:** `aiCostTracker` wraps `Messages.prototype.create`, logs every call to `ai_usage_logs`, and enforces `AI_DAILY_BUDGET_USD` (default $50, in-process, resets at UTC midnight or restart; rejects with 429). `aiResponseCache` adds a Redis SHA-256 cache for non-streaming, low-temperature calls. `aiRateLimiter` (30 req/5 min per user or IP) is imported by 56 route files.

### 4.2 Story / AI writing domain (`src/routes/memories/` and neighbours)

- `src/routes/memories.js` **does not exist**; PR #328 (2026-03-25) split it into `memories/{index,helpers,core,interview,voice,stories,planning,assistant,engine,extras}.js`, 12,867 lines total (engine.js alone 5,511). `CONTRIBUTING.md`'s domain table is accurate except that the 17 context loaders live in `engine.js`, not `helpers.js`.
- Every memories route is `requireAuth` (+ `aiRateLimiter` for AI calls), changed in the F-AUTH-1 backup commits of May 8–9.
- **Context system:** `getCharacterVoiceContext(characterId)` (helpers.js:144) builds a voice block from `registry_characters` fields and `voice_signature` JSONB; `loadWriteModeContext(characterId)` (engine.js:2295) resolves PK → `character_key` and runs 15 loaders in parallel (memories, relationships, threads, locations, canon events, prose anchor, voice cards, dramatic irony, follow influence, voice fingerprints, arc context, therapy, growth logs, franchise knowledge, recent world events); `buildWriteModeContextBlock` joins only non-null sections, prose anchor capped at 600 chars. `generate-story` adds `loadCharacterProfile` and `loadWorldState` (17).
- **WriteMode endpoints:** voice-to-story (SSE), story-edit/continue/deepen/nudge, ai-writer-action (continue|dialogue|interior|reaction|lala), rewrite-options, scene-planner, prose-critique, chapter-synopsis, scene-transition, story-outline, story-planner-chat. The "PNOS 5-act" system is `WRITE_MODE_ACT_VOICE` act_1..act_5 (stories.js:29–56) chosen by a request field; the `storyteller_chapters.pnos_act` column exists in a migration but not in the model.
- **Story Engine (engine.js):** hardcoded `CHARACTER_DNA` (just-a-woman, the-husband David, the-witness, the-comparison-creator Nia Vale, the-almost-mentor, lala); `ARC_SYSTEM_PROMPT` generates exactly 50 chapter briefs in four phases (establishment 1–10, pressure 11–25, crisis 26–40, integration 41–50), nine tones, wound clock from 75, a required Lala bleed in chapter 47; generate-story writes 3,300–4,800 words with a Haiku quality gate and background auto-extraction of memories, relationships, locations, and events; pipeline/batch generation uses a process-local `backgroundJobs` map (lost on restart). **No frontend caller exists** for the arc/task/generate/revise/batch/consistency endpoints since the ghost-page deletion (PR #896).
- **Amber** (assistant.js): a JSON-command interpreter with ~26 server-executed actions, SSE streaming, a recycle bin over raw `deleted_at` SQL; `amberDiagnosticRoutes` can shell out to the `claude` CLI on the server (`execute`, behind `requireAuth` only); `amberSessionRoutes` does ElevenLabs TTS with 20/hr and 5/hr limits; `lambda/alexa-amber-skill` is an Alexa front end.
- **Model IDs in code:** `claude-sonnet-4-6` ×103, `claude-sonnet-4-20250514` ×60 (storyEvaluationRoutes, consciousness, generate-script-from-book, onboarding, stories.js root, textureLayerService, worldStudio, franchiseBrain guard, calendar ripples, relationships, hair/makeup, tierFeatures, characterDepth), `claude-haiku-4-5-20251001` ×45. `stories.js:146` lists a non-existent fallback `claude-sonnet-4-5-20250514`. Retry patterns vary from a two-attempt MODELS loop to bare single calls.
- **Story Evaluation Engine v2** generates three blind voices and an editorial synthesis (header says "Opus"; code uses sonnet-4-20250514). Texture layers: 9 generators. Novel intelligence: edit-as-signal → voice rules. Manuscript export: DOCX/PDF of approved lines. Press: four seeded press characters.

### 4.3 World / franchise / social domain

- ~29,400 lines across 49 route files; nothing functionally changed since 2026-05-09 except ORM conversions and auth promotions.
- `worldEvents.js` (4,005 lines, ~60 handlers): event CRUD, inject-into-script, invitation pipeline (generate → edit → render → approve; PDF; RunwayML animation), episode generation from events, financial pressure/forecast, venue images via fal, overlay approval writing `assets` rows, a deterministic next-event suggester reading `character_state` for `justawoman` while `generate-script` reads `lala` (the F-Sec-3 key drift).
- `worldStudio.js` (3,709): character ecosystem generator with its own `WORLD_CONFIGS` (two worlds: `lalaverse` protagonist Lala; `book-1` protagonist JustAWoman), `syncToRegistry` mirroring `world_characters` → `registry_characters`, relationship seeding from a 43-rule pairing table, `world_locations` CRUD with the `DREAM_INFRA` seed, world state snapshots, DREAM map upload, intimate-scene generation; an inline `CREATE TABLE ecosystem_previews` at line 319 (PE #62).
- `socialProfileRoutes.js` (2,699): the Feed. AI-generated creator profiles; `FEED_CAPS = {real_world: 443, lalaverse: 200}` (soft on `/generate`, hard in the scheduler); hardcoded follow-psychology profiles for `justawoman` and `lala`; the hand-authored `@justawoman` record is locked (403 on eight handlers); `/:id/cross` promotes a profile into a registry character. `feedScheduler.js` runs six sub-agents every 4h at boot and still uses the five legacy city names.
- **Characters live in four tables:** `registry_characters` (canonical dossier, `character_key`, role/status/depth ENUMs, ~35 JSONB blobs, target of ~15 associations), `world_characters` (World Studio cast), `universe_characters` (promoted canon, created only by `promote-to-canon`), `characters` (legacy per-show, wardrobe owner). `character_key` is a free-text slug that drifts between `lala`, `justawoman`, and `just-a-woman`; five raw-SQL services hardcode `'justawoman'`; the fix is assigned to F-Sec-3.
- **Franchise Brain:** `franchise_knowledge` rows (category/severity/status ENUMs); `POST /franchise-brain/seed` runs the ten seeders in-process; `buildKnowledgeInjection()` prepends active critical rules to prompts in ten consumers. Show Brain canon: 24 episodes/season in three arcs of eight, nine World Laws, six stats, Prime Bank's four currencies, a 14-beat episode structure, "Lala does not know she is in a show."
- **Verified register claims:** the five PE #62 inline `CREATE TABLE` sites and the XK-2 unscoped-write line references all resolve at current `main`.

### 4.4 Production tooling domain (episodes, scenes, wardrobe, assets, phone)

The show-tier production stack is the January–February 2026 metadata/CMS/video-suite code plus the April 2026 phone game. It is still fully mounted; nothing in it has changed functionally since April except F-AUTH-1 auth promotions and F-Stats-1 ORM conversions. Size: 132 top-level route files (63,349 lines) and 33 controllers (18,928 lines; `wardrobeController` 2,320, `sceneStudioController` 1,863, `sceneController` 1,667, `wardrobeLibraryController` 1,596, `episodeController` 1,409).

- **Mount map.** `/api/v1/episodes` hosts eleven routers (episodes, timelineData, wardrobeApproval, scriptGenerator, lalaScript, scriptParse, gameShow, iconCue, cursorPath, musicCue, productionPackage) plus `/:episodeId/phone-state`; `/api/v1/shows` hosts shows and gameShow; scene work is spread over `/scene-sets`, `/scenes`, `/scene-studio-episodes`, `/lala-scenes`; wardrobe over `/wardrobe`, `/wardrobe-library`, `/wardrobe-brands`, `/wardrobe-events`, `/outfit-sets`; `/assets` hosts assets and imageProcessing; then `/compositions`, `/thumbnails`, `/layers`, `/scripts`, `/export`, and `/ui-overlays` (+ `/:showId/ai`, `/:showId/missions`). Mount lines: `src/app.js:634–941` and `1146–1534`.
- **`episodes.js`** (1,360 lines, ~70 handlers): CRUD, `/:id/status`, `/:id/save`, `/:id/enqueue`, `/:id/thumbnail`; sub-resources for wardrobe, outfits (→ `outfitSetsController`), assets, platform, scenes (reorder, stats, from-angle, scene assets), scripts and versions, library scenes and assets (with folders), timeline placements and `timeline/wardrobe/current`, sequence items, video compositions, scene sets (with reorder) and `suggest-scenes`. The file uses both `:id` and `:episodeId` for the same resource and declares library-assets and timeline-placements twice (lines 540–617 and 637–715); the second declarations are reachable only where the paths differ.
- **`shows.js`** (1,487): show CRUD, cover image, `config` / `template` / `wardrobe` reads, and the Prime Bank finance layer: `financial-config`, `financial-summary`, `seed-finance-apps`, `redecorate-finance-app`, `financial-breakdowns`, `financial-suggestions`, `seed-balance`, `wardrobe-config`.
- **`sceneSetRoutes.js`** (2,467; 59 async handlers): scene sets and angles. AI describe/refine/learn-location, base-still upload and generation, angle suggestion (also from an image), camera direction, per-angle generate / generate-video / upload / review / analyze / regenerate / post-process / auto-refine / depth map, a refinement queue with jobs, `by-type` and `for-beat` lookups, a spec sub-resource (generate, validate-angle, create-angles), canvas and objects (the Konva Scene Studio), lock-style, generate-all-angles, time variants, cascade regenerate, promote-to-base, and episode links. Backed by `sceneGenerationService.js` (1,888): fal.ai Flux stills, OpenAI `gpt-image-1` edits and outpaint, Runway `gen3a_turbo` image-to-video, Claude Vision consistency checks, S3.
- **`wardrobe.js`** (1,895): item CRUD, per-item image ops (process-background, product shot, upscale, premium-enhance, add-shadow, analyze, send-to-phone), bulk ops, staging and categories audit, seed, outfit history, pieces, set, and the **money path** `browse-pool` → `select` → `purchase`, which debits `character_state` Prime Coins under the `lala` key (the F-Stats-1 PR 4 conversions and the F-Sec-3 drift both live here). Services: `wardrobeController` 2,320, `wardrobeLibraryController` 1,596, `wardrobeImageService` 1,173 (sharp pipeline, Replicate Real-ESRGAN upscale, Claude Vision colour and tag extraction still pinned to `claude-sonnet-4-20250514`).
- **`assets.js`** (1,355): list / eligible / by-folder / approved / pending, labels, bulk delete / process-background / add-labels / change-type, search, CRUD, approve / reject / process, per-asset labels / usage / download, `config/check`. `imageProcessing.js` (473) adds remove.bg, Runway and Cloudinary operations under the same mount.
- **`compositions.js`** (1,666): composition CRUD, approve / primary / publish, thumbnail and format generation, assets by role, versions (compare, revert, stats), outputs, drafts (save, apply), slot positions. Its `VersioningService` and `FilterService` open their own `pg` pools outside Sequelize.
- **Lala's Phone** (`uiOverlayRoutes.js` 980 + `phoneAIRoutes.js` + `phoneMissionRoutes.js` + `phonePlaythroughRoutes.js`): per-show overlay generation (Flux via `uiOverlayService`), upload, remove-bg, frame, global-fit, style-prefix, category and image-fit, **screen-links** (tap zones), content-zones, and overlay-type CRUD. `phoneRuntime.js` (263 lines) is the single evaluator shared by the editor preview, the AI zone proposals and the reader playthrough: AND-ed `{key, op, value}` conditions (`eq/neq/gt/gte/lt/lte/exists/not_exists`, fail-closed on unknown operators), an action allowlist (`navigate`, `set_state`, `show_toast`, `complete_episode`), missions as objective lists whose `reward_actions` fire once; `phoneConditionSchema.js` (Joi) is shared by the save route, the AI route and the runtime; state lives in `phone_playthrough_state` (unique per user + episode) and `phone_missions` (migrations 20260730–20260802). AI proposals use `claude-sonnet-4-20250514` (`phoneAIRoutes.js:22`). This is the newest production code (PRs #561–#601, April 2026).
- **Feb 2026 video suite, still mounted:** thumbnails (PE #54: `/thumbnails/generate` is captured by `/:id`), scripts / scriptGenerator / lalaScript / scriptParse, gameShows (the Lala Formula 8-act / 11-beat structure), layers, iconCue / cursorPath / musicCue / productionPackage, export (manuscript DOCX/PDF), lala-scenes. The Phase-1/2 controllers for files, jobs, notifications, presence, sockets and search are mounted but their test files are on Jest's ignore list, so none of them has an executed test.
- **Duplicates and dead declarations.** `outfitSetController.js` (170 lines, serves `/api/v1/outfit-sets`) and `outfitSetsController.js` (449, serves `/api/v1/episodes/:id/outfits`) both live: F-Ward-3's subject. The Route Shadowing Survey's six dead declarations all resolve at `main`: `compositions.js` `PUT /:id` at 817 (shadowed by 480) and `GET /search` at 1188 (by `GET /:id` at 458); `thumbnails.js:136`; `sceneSetRoutes.js` `GET /artifact-categories` at 1099 (by `GET /:id` at 229); `wardrobe.js` `/bulk/upscale` at 248 and `/bulk/analyze` at 251 (by `/:id/upscale` at 226 and `/:id/analyze` at 238). No shadowed twin carries auth its live twin lacks; whether they warrant an FD is v25 item 10-B.

### 4.5 Data model and migrations

- 154 files in `src/models/`: 151 Sequelize models + two raw-pg classes (`file.js`, `job.js`); `index.js` (2,072 lines) registers 149 (`SocialProfileTemplate` and `UiOverlayType` never registered) and defines ~150 associations. ~118 UUID PKs, 30 integer PKs. 40 models set `paranoid: true`, 36 `paranoid: false`, ~75 inherit, 17 have `timestamps: false` (paranoid inoperative).
- **Five migration trees exist; only one runs.** `src/migrations/` (211 files, 20240101000001 → 20260818000000) is what `sequelize db:migrate` reads (`.sequelizerc`), and it creates 133 tables. Root `migrations/` (20), `migrations/sequelize-migrations/` (16, misnamed, five are node-pg-migrate), `migrations-node-pg-migrate/` (3, creates the 8 AI-editing tables), and `scripts/migrations/` (226 ad-hoc files, including an unguarded `DROP TABLE shows CASCADE`) are never invoked by any script or workflow. Nine basenames are duplicated across roots; two differ.
- **Consequences:** 40 model tables are not created by `src/migrations`; 21 migration tables have no model; 6 model tables are created by no tree at all (`FileStorages`, `asset_asset_labels`, `layers`, `layer_assets`, `script_learning_profiles`, `script_templates`). Eleven request-path `Model.sync()` calls and five inline `CREATE TABLE IF NOT EXISTS` sites create tables at runtime. A fresh `npm run migrate:up` yields a schema no deployed database matches.
- **XK-1 (paranoid exposure):** 48 → 37 → 13 → 12 model tables exist without `deleted_at` on a migrations-built DB; inserts through them fail with `column "deleted_at" does not exist`. **FD-66 (DRAFT, P0):** 28 mismatched + 38 no-table models; three routes confirmed 500 (`GET /api/v1/audit-logs`, `POST /api/v1/decision-logs`, `POST /api/v1/thumbnails/:id/publish`).
- **Canon vs prod fork (ASSERTED, from pre-freeze live reads):** canon `episode-control-dev` = 143 tables, populated (episodes 72, shows 10, social_profiles 444, franchise_knowledge 605), with both `pgmigrations` (stopped 2026-01-22) and `SequelizeMeta` ledgers; `episode-control-prod` = 171 tables, empty; 37 prod-only, 9 dev-only; neither a superset. `SequelizeMeta` on canon records migrations whose effects are absent (Amd22). Decision FD-31: canon = `-dev`; prod-only tables preserved in `docs/audit/FD31-prod-only-schema-20260601.sql` (DO NOT RUN).
- Seeders: 14 files in `src/seeders/` with no npm entry point; `scripts/seed.js` (`npm run seed`) is a raw-pg TODO stub. `docs/DATABASE_SETUP_GUIDE.md` documents node-pg-migrate commands that no longer exist.

### 4.6 Frontend

- React 18.2 + react-router 6 + Vite 7 (`frontend/`), 560 source files, 132 CSS files, 99 Vitest files (~786 cases). Dev server **5174** (HMR 5175), proxies `/api` → `127.0.0.1:3002`.
- **Auth:** local email/password against `/api/v1/auth/login` (disabled server-side), tokens in `localStorage`, axios singleton with the F-Auth-4 interceptor (refresh once on `AUTH_INVALID_TOKEN`, wipe and redirect on `AUTH_REQUIRED`; redirect skipped in Vite DEV). No Cognito code.
- **IA (Sidebar):** FRANCHISE (LalaVerse, Show Bible, World Dashboard, World Foundation, Social Systems, Culture & Events) · CREATE SHOW (Producer Mode, Shows) · WRITE (Stories, Characters, Relationships) · STUDIO (Timeline Editor, Compositions) · MANAGE (CFO Agent, Site Organizer, Design Agent, Search, Admin, Recycle Bin, Settings). ~121 authenticated routes (~103 live, ~18 redirects); ~23 feature pages reachable only by URL.
- **Design system reality:** `index.css` imports Tailwind v4 (thin utility use); tokens are a Tailwind-blue palette with a secondary `--lala-*` palette (parchment `#FAF7F0`, gold `#B8962E`, ink `#2C2C2C`, Lora / DM Mono); lucide-react in 42 files, emoji glyphs elsewhere; desktop-first media queries (359 `max-width` vs 55 `min-width`).
- **Known debt:** stale nav targets (`Home.jsx` → `/studio/scene-composer`, CommandPalette → `/story-engine`), orphan files (`NewBookModal.jsx`, `StoryInspector.jsx`, `StoryNavigator.jsx`, `StoryEngine.css`), three env-var names for the API base, committed `dist.tar.gz` and `build-output.txt`, tracked `.env.production` despite `.gitignore`, `frontend/README.md` describes a Phase-2 app, `SESSION_HANDOFF.md` Part 2 (device frames, safe-area guides) was never built.
- **Big files:** `WorldAdmin.jsx` 8,122, `WriteMode.jsx` 3,708, `SceneSetsTab.jsx` 3,214, `UIOverlaysTab.jsx` 2,987, `StoryEvaluationEngine.jsx` 2,716, `WorldStudio.jsx` 2,402, `SceneStudio/SceneStudio.jsx` 2,264.

### 4.7 Services and external integrations

`src/services/` holds 108 files (~42,500 lines). Largest: `sceneGenerationService` 1,888, `AssetService` 1,453, `feedScheduler` 1,184, `wardrobeImageService` 1,173. Last service commit 2026-05-07. There is **no shared Anthropic client**: roughly 30 services and many routes each construct `new Anthropic()`; the SDK monkey-patch in `aiCostTracker` is what makes them uniform.

**Six groups.**

1. **AI core.** `aiCostTracker.js` (252) and `aiResponseCache.js` (189) are required first in `app.js:19–21` and wrap `Messages.prototype.create` (call chain: cache → tracker → SDK). The tracker prices every call from a table (`aiCostTracker.js:24–38`: Sonnet $3/$15, Haiku 4.5 $0.80/$4, cache write 1.25×, cache read 0.10×; unknown IDs priced as Sonnet), rejects with 429 when the worst-case estimate would exceed `AI_DAILY_BUDGET_USD` (default $50 in code; its header comment wrongly says "no limit"), and inserts an `ai_usage_logs` row via `setImmediate`. Cache hits never reach the tracker, so they are absent from the logs. `aiModelRouter.js` and `promptCacheHelper.js` are effectively unused. `claudeService.js` is only a Haiku video-script analyzer for `youtubeService`. `iconCueGeneratorService.js:396–420` calls `api.anthropic.com` directly with axios and so escapes tracking, budget and cache.
2. **Story generation.** A `WorldEvent` flows through `episodeGeneratorService` (Haiku: title, description, tags, beat outline) → `scenePlannerService` (Sonnet 4.6, the canonical 14-beat structure) → `episodeScriptWriterService` / `groundedScriptGeneratorService` (Sonnet 4.6 with locked JAWIHP and Lala voice DNA, Haiku franchise-rule guard) → `episodeCompletionService` (SLAY / PASS / SAFE / FAIL and coin finalization) → `feedPostGeneratorService`, `characterSyncService`, `registrySyncService` → `storyGenerationService` (prose formats) → `storyEnrichmentService` (Haiku, fire-and-forget). `arcTrackingService` turns wound-clock / stakes / visibility numbers into narrative text for prompts; `textureLayerService` is still pinned to `claude-sonnet-4-20250514`. All character-generation outputs are proposals the author confirms.
3. **World and feed engine.** `feedScheduler` (six sub-agents: auto-fill, finalize, relate, follow, cross, discover; caps `real_world` 443 / `lalaverse` 200; Sonnet 4.6 profiles + Haiku sparks). It is started at `app.js:675` on a 4-hour interval but returns immediately unless `FEED_SCHEDULER_ENABLED === 'true'` (`feedScheduler.js:1109`; the code comment estimates $30–50 per cycle). **The manual endpoints `POST /api/v1/feed-scheduler/run-now`, `/fill-one`, `/auto-generate` bypass that gate** behind `requireAuth`. No-LLM services: `eventAutomationService` (cultural calendar → draft events), `financialTransactionService` / `financialPressureService` / `financialFeedService` (coin ledger and pressure; `financialPressureService.js:208` UPDATEs the append-only history ledger), `careerPipelineService`, `worldTemperatureService` (COLD 0–15 … VOLATILE 81–100), `feedEngagementService` (viral tiers), `arcProgressionService`. LLM services: `thresholdDetection` and `emotionalImpact` (Haiku; the therapy "knock" that also sends Gmail), `rippleEngine` (Haiku Amber scene proposals), `seasonalEventService` (Sonnet 4.6), `feedEventPipelineService` (Haiku).
4. **Characters.** `characterGenerationService` (one `claude-sonnet-4-20250514` deep profile plus four Haiku calls), `characterFollowService` (sonnet-4-20250514), `characterSyncService` / `registrySyncService` / `registrySync` (post-event and real-time registry mirroring), `decisionAnalyticsService` (raw SQL over `user_decisions`).
5. **Image and video.** `imageGenerationService` is the unified entry point and, despite its header describing DALL-E/Flux routing, maps every use case to fal.ai Flux (`flux-pro/v1.1` $0.005, `flux/dev` $0.003, `flux-pro/kontext` $0.04) and counts them against `AI_DAILY_IMAGE_BUDGET_USD` (default $10); its DALL-E branch is unreachable. OpenAI is still called directly (raw axios) for `gpt-image-1` edits/outpaint in `sceneGenerationService` and `dall-e-3` in `objectGenerationService`, outside any budget. Replicate hosts SAM-2 / grounded-SAM (segmentation), SDXL inpaint, LaMa, flux-fill-pro, rembg (inpainting), DepthAnythingV2, SDXL img2img (restyle), Real-ESRGAN (wardrobe upscale). Runway is used two ways: `api.dev.runwayml.com` `gen3a_turbo` image-to-video, and the legacy `api.runwayml.com` background removal (`AssetProcessingService` reads `RUNWAY_API_KEY`; everything else reads `RUNWAY_ML_API_KEY`). remove.bg is called from six services plus controllers. Cloudinary is an optional enhancement pass. ffmpeg is wrapped three ways (`ffmpegService` defaults to Windows paths). `youtubeService` shells out to `yt-dlp`; there is no YouTube Data API. ElevenLabs TTS is used only by `amberSessionRoutes`.
6. **Infrastructure.** S3 through both `aws-sdk` v2 (`S3Service`, `AssetProcessingService`, `config/aws.js`) and `@aws-sdk/client-s3` v3 (most newer services) with at least ten different bucket env-var names; three parallel SQS wrappers (`sqsService` unused by the app; `QueueService` defaults to LocalStack; `JobQueueService`); `SocketService` (throws at load if `JWT_SECRET` is unset outside test), `PresenceService` and `NotificationService` are in-memory; `notifications.js` sends Gmail SMTP through nodemailer; `tokenService` issues HS256 JWTs; `winston-cloudwatch` is a dependency nothing requires. Agents with no LLM calls: `cfoAgent` (five sub-agents, runs every 6h unconditionally from `app.js:666`, executes `npm outdated` inside the web process, and its Windows `2>nul` redirect creates a stray `nul` file on Linux), `designAgent`, `siteOrganizerAgent`.

**Amber and the Lambdas.** Amber is a persona over Sonnet 4.6: `routes/memories/assistant.js` (1,906) `assistant-command(-stream)` with roster, ecosystem, franchise-brain and arc context; `amberSessionRoutes` greeting / speak / read-story (Haiku + ElevenLabs, 20/hour); `amberDiagnosticRoutes` (574) a scan engine (`AmberFinding`, `AmberScanRun`, `AmberTaskQueue`) that can execute fixes against `CLAUDE_CODE_PROJECT_DIR` behind `AMBER_AUTO_APPROVE_*` flags — a self-modifying path that deserves review. `lambda/alexa-amber-skill` ("prime studios") proxies voice into `assistant-command` with a static bearer; `lambda/video-analyzer` (SQS → S3 → ffmpeg → AWS Transcribe → `PUT /api/v1/edit-maps`) has stubbed face and audio-event detection and a 16.7 MB `function_deploy.zip` committed beside it.

**Dead or orphaned:** `aiModelRouter.js`, `phoneScreenRenderer.js`, `sceneIdentityService.js` (+ `sceneTypePriors.js`), `sqsService.js` (only a validation script requires it), the DALL-E branch of `imageGenerationService`, `winston-cloudwatch`. Legacy Phase-1/2 services (`S3Service`, `QueueService`, `JobQueueService`, `ErrorRecovery`, `VersioningService`, `FilterService`, `scriptsService`, `ThumbnailService`, `ThumbnailGeneratorService`) survive with their own AWS v2 clients or separate `pg` pools; `ThumbnailGeneratorService.js:375` constructs a new Sequelize instance per call.

**Cost-control facts to remember.** Both daily budgets are in-process counters: they reset at UTC midnight or on any process restart, and N cluster workers mean N × $50. The image budget covers only the fal.ai path; OpenAI, Replicate, Runway, remove.bg, Cloudinary and ElevenLabs spend is neither tracked nor capped. `aiRateLimiter` is 30 requests / 5 minutes per user or IP. `ecosystem.config.js` does not set `AI_DAILY_BUDGET_USD`, `AI_DAILY_IMAGE_BUDGET_USD`, `FEED_SCHEDULER_ENABLED`, `OPENAI_API_KEY` or `CLOUDINARY_*`, so production relies on code defaults unless the on-box `.env` sets them.

**Env keys by provider** (full list in `.env.example`): `ANTHROPIC_API_KEY` (113 refs); `FAL_KEY`; `OPENAI_API_KEY`; `REPLICATE_API_TOKEN` (+ model/version overrides); `RUNWAY_ML_API_KEY` / `RUNWAY_API_KEY`; `REMOVEBG_API_KEY`; `CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET`; `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID`; `LALAVERSE_EMAIL`, `LALAVERSE_EMAIL_PASSWORD`, `NOTIFY_EMAIL`; `REDIS_HOST/PORT/PASSWORD`; `AWS_REGION` plus the bucket and queue names; `DATABASE_URL` or `DB_HOST/PORT/NAME/USER/PASSWORD` + `DB_SSL=true` against RDS; `JWT_SECRET`; `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`. Danger switches that must never be set by an agent: `DB_SYNC_FORCE`, `DB_SYNC_ALTER`, `ENABLE_DB_SYNC`, `CONFIRM_FORCE_SYNC`, `CONFIRM_DROP`.

### 4.8 Tests and CI

**Backend (Jest 29).** `jest.config.js`: `testMatch` limited to `tests/unit/**` and `tests/integration/**`, `maxWorkers: 1`, `setupFilesAfterEnv: tests/setup.js`, coverage thresholds all **0**. 162 `*.test.js` files exist under `tests/`; `jest --listTests` collects **142**: 19 are dropped by `testPathIgnorePatterns` (`jest.config.js:24–44`: the job / file / search / scene / notification / presence / socket controller, model and integration suites, plus phase3a and assets integration) and `tests/api/endpoints.test.js` is outside `testMatch`. Nothing announces the exclusions. `tests/setup.js:8–11` throws unless `TEST_DATABASE_URL` is set and then overwrites `DATABASE_URL` with it, so **even DB-free unit tests cannot start without a Postgres URL**; it also mocks `uuid`, the Bull video queue and `aws-sdk`, and mints real HS256 tokens through `tokenService`. `npm test` = `jest --coverage --runInBand --forceExit`; coverage is collected, never enforced, never recorded. The integration suites self-skip when `DATABASE_URL` contains `amazonaws.com` (`f-auth-1-fd63.test.js:34`).

**What the backend suite is.** 74 files in `tests/unit/routes` match `*-tier*` (43 `*-tier-promotion*`; cp10 19, cp11 3, cp12 21; four `f-auth-1-fd63-shape*`). 84 of the 92 files in that directory are static-source diff-locks: they `readFileSync` a route file and regex-assert that `requireAuth` is imported, that no `optionalAuth` / `authenticateToken` / lazy-noop survivors remain, that each `router.verb('/path', requireAuth, …)` chain exists, that `authorize(['ADMIN'])` is preserved, and that `// PUBLIC:` markers exist. They never send a request. "Tier" means the F-AUTH-1 Fix Plan v2.37 §5.2 Step 3 disposition tier (1 `requireAuth`; 2 + `authorize(['ADMIN'])`; 3 `optionalAuth({degradeOnInfraFailure:true})`; 4 PUBLIC `optionalAuth` with rationale; 5 env-gated dev-only mount). The runtime complement is `tests/integration/f-auth-1-fd63.test.js` (supertest through `src/app.js`, asserts `AUTH_REQUIRED` / `AUTH_INVALID_FORMAT` codes), `f-auth-1-fd65` (login issues no caller-supplied groups/roles) and `f-auth-1-g3-clause3`. `tests/unit/security/jwt-secret-strict-fail.test.js` (F-SOCKET-1) asserts `SocketService` throws at load without `JWT_SECRET`. Four `phoneRuntime*` files cover the phone evaluator, schema, missions and once-only rewards. `tests/unit/route-health.test.js` requires all 132 route files and hits `/health`. 16 service unit tests exist. F-AUTH-1 v2.37 recorded 2,390 passing at CP12; 1,878 static `it()/test()` sites exist in the collected files (the rest is `test.each` expansion, unverified here).

**Frontend (Vitest 0.34.6, jsdom, globals; `frontend/vitest.config.js`, no setupFiles).** 99 files (53 pages, 40 components, 3 hooks, 2 services, 1 utils), 793 tests. Mostly module-scope helper tests asserting the URL an API helper calls, structural tests reading a component's own source, and the F-Auth-4 interceptor tests in `services/api.test.js`. Vitest reads `frontend/.env`; a developer-only absolute `VITE_API_URL` once caused ~181 local failures (finding of 2026-07-04); CI gained the Frontend Tests job the same day (#900) but the finding doc still says the gap is open.

**CI (`.github/workflows/validate.yml`).** On `pull_request` and `push` to `main` and `dev`, plus `workflow_dispatch` (#989). Four jobs on Node 20: Cost Exposure Audit; Route Validation (`validate-routes.js` + `lint-silent-catches.sh`); Tests (postgres:15 service, `npm run migrate:up`, `npm test` with `TEST_DATABASE_URL` and `JWT_SECRET`); Frontend Tests (`npx vitest run`). **ESLint, `prettier --check` and frontend lint run nowhere in CI or hooks.** Branch protection on `main` (F-Tools-1 §3.3.1, verified 2026-05-21): required contexts Cost Exposure Audit, Tests, Route Validation; `strict=true`; `enforce_admins=false`; zero required reviews; Frontend Tests is not documented as required. Dependabot is monthly and monitor-only (`open-pull-requests-limit: 0`; security updates disabled per Amd15).

**Local gates.** `npm install` → `prepare` → `git config core.hooksPath .githooks`. pre-commit: `check-root-junk.js` (root allowlist; origin: the `ct_modifydb.json` incident of 2026-06-26) + `audit-cost-exposure.sh`. pre-push: `audit-cost-exposure.sh` + `validate-routes.js` (its header claiming "routes + lint + tests" is stale). `npm run validate` = routes + `npm run lint` + `test:route-health` + cost audit, so it **fails at HEAD** (ESLint) and needs `TEST_DATABASE_URL` (route-health). The repo's `/validate` skill runs the four static scripts plus `node -c` instead. `docker-compose.test.yml` exposes Postgres on host port **5433**, while the README quotes a 5432 URL; `docker-compose.yml`'s postgres is on 5432.

**Check results at `433b1f22`** (run 2026-09-01, Node 22, no DB, no network):

| Check | Result |
|---|---|
| `node scripts/validate-routes.js` | exit 0; 132 route files, 704 src files; 0 errors, 11 try/catch warnings (`animatic.js` 6/6, `timelineData.js` 2/2, `amberSessionRoutes.js` 2/4, …) |
| `bash scripts/lint-silent-catches.sh` | exit 0; clean |
| `bash scripts/audit-cost-exposure.sh` | exit 0; three non-failing HIGH API DENSITY notices (`characterGenerationService` 5, `feedScheduler` 5, `promptCacheHelper` 4) |
| `node scripts/check-root-junk.js` | exit 0 (inspects staged files only) |
| `npx eslint src/ tests/` (eslint 8.57.1) | **exit 1**; 39 problems (38 errors, 1 warning) in 23 `src/` files: `no-unused-vars` 24, `prefer-const` 7, `no-empty` 5, `no-unreachable` 1, `no-undef` 1, `no-console` 1 |
| `cd frontend && npx vitest run` | exit 0; 99/99 files, 793/793 tests, ~27 s |
| `node -c src/app.js`, `node -c src/routes/memories/*.js` | OK (10 files) |
| `jest --listTests` | 142 of 162 files collected |
| `npm test` | NOT RUN (needs Postgres) |

**Gaps worth a task:** ESLint not in CI while `main` fails it; 20 backend test files silently excluded; the `TEST_DATABASE_URL` hard gate on DB-free tests; coverage collected with no threshold; frontend ESLint 9 installed with only a legacy `.eslintrc.json` and no lint script; the `amazonaws.com` guard is the only thing standing between `TEST_DATABASE_URL` and a live database.

---

## 5. Conventions that are actually true (supersedes old CLAUDE.md)

| Topic | Convention |
|---|---|
| Route auth | Writes: `requireAuth` (Tier 1) or `requireAuth + authorize(['ADMIN'])` (Tier 2). Public catalog GETs: `optionalAuth` with a `// PUBLIC:` comment (Tier 4). Never demote a `requireAuth` handler. AI handlers add `aiRateLimiter`. |
| AI calls | Primary model `claude-sonnet-4-6`; Haiku 4.5 for cheap side calls. Prefer the `MODELS` array + two-attempt retry (skip to next model on 529/503/404). Every call is auto-logged and budget-gated by `aiCostTracker`. Do not add schedulers or `setInterval` AI loops without an env gate. |
| SSE | `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`; frames `data: {type:'text'|'done'|'error'}`. |
| Context loaders | Return `null` when empty; inject conditionally. `characterKey` is the slug from `RegistryCharacter.character_key`, not the integer PK. |
| Errors | try/catch, `console.error`, JSON error response; every `catch` logs (`lint-silent-catches.sh`). |
| Migrations | New files only, under `src/migrations/`, timestamp `YYYYMMDDHHMMSS`, always `deleted_at`, `down` drops ENUM types. Never edit a migration that has run. Never add `Model.sync()` or inline `CREATE TABLE`. |
| Models | `(sequelize, DataTypes) => …` factory, `tableName` snake_case plural, `underscored: true`, register in `src/models/index.js`. Do not add `paranoid: true` (global). |
| Frontend | React hooks only; one CSS file per page; lucide-react for new icons; test at 375px; API calls through `services/api.js`; new pages must get a Sidebar entry or an in-app link. |
| Ports | Backend `PORT=3002` locally (server default is 3000; nginx dev proxies 3002, prod 3000). Frontend 5174. |
| Git | `claude/<slug>` branches from `origin/main`; explicit-path `git add`; `git diff --cached` before commit; subject ends with ` [skip-automerge]`; no closing keywords next to `#N` (FD-21); squash-merge + delete branch; never push to `main` or `dev`. |
| Register | Nothing in `docs/audit/` is edited in place after merge; corrections are new amendments or additive newest-first banners; FD numbers are minted only by Fix Plan revisions, XK by the Cross-Keystone Register, PE by `Session_PE_Roster.md`; every claim carries a standing (MEASURED / ATTESTED / RULED / INFERRED). |
| Agent boundaries | No `ssh`, `scp`, `pm2`, `aws`, RDS connections, server `.env` edits, workflow enable/dispatch. Rule 7 (Draft → Confirm → Execute) for push, PR create, merge. H1: paste the command and its output. |

---

## 6. The audit register — what the conversation has been about

### 6.1 Keystones and standing (Handoff v25, basis `6aea0f73`, plus later amendments)

| Keystone | What it is | Standing at `433b1f22` | Authority file |
|---|---|---|---|
| **F-AUTH-1** | Codebase-wide auth bypass on writes (three sub-forms) | **REOPENED-QUALIFIED.** Backend sweep done (12 CPs, ~700–750 handlers, May 2026); reopened at FD-63; 95 more handlers promoted Aug 17. Gate G3 partially discharged: limb 1 (confirm-not-re-derive audit of recorded CP dispositions) **PARTIAL** — all 12/12 CPs now have a filed confirmation pass (`docs/audit/F-AUTH-1_Limb1_CP1_Confirmation_2026-09-02.md` through `…CP12_Confirmation_2026-09-02.md`; CP10 committed 2026-09-01, the other eleven 2026-09-02), confirming **127** recorded dispositions (120 agree, 2 disagree, 5 cannot-tell) — re-derived from the twelve CP documents' own header lines, correcting the previously carried 129. CP12's own text asserts *"Limb 1 discharges,"* but that is the confirming document's own claim, not a handoff ruling, so it is carried here as partial pending a ratifying revision; limb 3 (five-dimension production-readiness) NOT COMPLETED (D1 PASS, D2 PASS, D3 not performed, D4 FAIL, D5 not performed). G4 never entered; G5 blocked; prod frozen. FD-63 OPEN; FD-64 fixed at `65cbe7013` (spelling) and `2e5dbdf28` (`where` clause) — close not recorded in a Fix Plan revision; FD-67 shipped at `7a1eb427c` (Option 1, PR #1185) — checked `v2.68`, the newest Fix Plan on `main`, and no revision closes it, so close not recorded; FD-65 and FD-68 CLOSED (v25 wrongly lists FD-68 open); FD-69 retired as duplicate. | `docs/audit/F-AUTH-1_Fix_Plan_v2.68.md` |
| **F-Deploy-1** | Deploy pipeline + autonomous-merge failure modes (37 lettered findings A–AK) | **CLOSED** at v1.48 (2026-07-22), carriage-corrected at v1.49. Dev box + SSM `workflow_dispatch` deploy path live; prod deploy path still SSH-based and disabled. Owed after close: AD (no instance profile on prod), AE (four SG ports still open; `/32` on port 22 needs re-scoping), fork RDS teardown, dev DNS repoint, `deploy-production.yml` SSM migration, PE #62 ownership. | `docs/audit/F-Deploy-1_Fix_Plan_v1.49.md` |
| **F-App-1** | Schema-as-JS auto-repair in `app.js` | SHIPPED 2026-05-14 (out of sequence); residue = PE #62 (five inline `CREATE TABLE` + eleven `Model.sync()` sites) and FD-66. | `docs/audit/F-App-1_Fix_Plan_v1.1.md` |
| **F-Stats-1** | `character_state` model + raw-SQL writers | Phase B live: raw SQL → ORM PRs 1–4f landed Aug 1–4; items 23 and 36 closed; open item 40 became XK-1. | `docs/audit/F-Stats-1_Fix_Plan_v1.60.md` |
| **F-Ward-1** | `episode_wardrobe` migration gap | Queued; zero repository presence. | none |
| **F-Reg-2** | Registry write contention | Queued; zero presence. | none |
| **F-Ward-3** | Duplicate outfit-set controllers | Queued; zero presence. | none |
| **F-Franchise-1** | Write-only franchise tier → Director Brain | Queued; zero presence; scoping note only. | `docs/audit/DirectorBrain_FrontendLeg_ScopingNote_2026-07-03.md` |
| **F-Sec-3** | `character_key` drift (`lala` / `justawoman`) | Queued last; canonical-key decision recorded 2026-07-02. | `docs/audit/F-Sec-3_*` |
| **F-Tools-1** | Tooling environment (VS Code extensions, hooks, repo settings) | One-time audit 2026-05-21; loki extension removed; branch protection verified. | `docs/audit/F-Tools-1_Tooling_Environment_Audit.md` |

**Locked sequence (Path A):** F-AUTH-1 → F-Deploy-1 → F-App-1 → F-Stats-1 Phase B → F-Ward-1 → F-Reg-2 → F-Ward-3 → F-Franchise-1 (= Director Brain) → F-Sec-3. Standing rule from the onboarding doc: no feature additions, schema redesigns, or "optimize later" during the fix cycle.

### 6.2 Cross-keystone register (`docs/audit/Cross_Keystone_Register.md`)

- **XK-1** paranoid exposure (owned by F-Stats-1; fix unevaluated; admission now contingent because reach shrank to `character_state` alone).
- **XK-2** row scope not enforced in SQL: handlers scope a read by `showId` then write by row id alone (`worldEvents.js` 1229/1271/1510/1605/1837/1910/1911, `arcRoutes.js` 158/209). Owned F-Stats-1; fix unevaluated.
- **XK-3** no authorization substrate for the tenancy root: no `User` model, no user↔show relation, `show_id` is caller-asserted everywhere; `roles.js` is the F-AUTH-1 instance. Owned F-Stats-1; Gate 3 needs a live DB read under freeze.

### 6.3 Register tails and numbering

FD tail **FD-69** (retired; **FD-70** next, unminted). XK tail **XK-3**. PE tail **PE #68** (v25 says #67; the roster carries #68 from 2026-08-28). Notation warning: `§AD`, `§AE`, `§AF` in the Owed Index amendments collide with finding letters AD/AE/AF.

### 6.4 The v25 Owed Index chain (Amd1–Amd30, Aug 22 → Sep 1)

Carries rulings made in session but not yet held by a revision. Highlights: the shallow-clone hazard (Amd1); the carriage rule and blast-radius rule; four method rules (Amd20/21); the item-8 canon schema read performed Aug 29 (Amd18/22/29) showing that canon's migration ledger does not describe what canon contains; Amd24: two of nine duplicate migrations change schema; Amd28: credential location; **Amd30: an SSM `describe-parameters` enumeration was authorized for Evoni personally but run by an agent session — ruled a crossing; four parameters exist, none under `/episode-metadata/`.** Item 8's follow-up reads (Addenda A/B) are authorized, not performed.

### 6.5 What is owed / open (consolidated, with owner)

Reconciled from Handoff v25 Sec 6, the v25 Owed Index chain through Amd30, F-Stats-1 v1.60, the Cross-Keystone Register and `Session_PE_Roster.md`. "Evoni-gated" items are never agent tasks; agent sessions record them NOT PERFORMED.

**Evoni-gated (host, AWS, DB, Cognito, GitHub settings, or a ruling)**

| Item | Source |
|---|---|
| **STILL OWED** (the read itself is DONE). v25 item 8 **disposition**: what the canon-schema reconciliation requires. The read itself was PERFORMED 2026-08-29 (2,760 rows / 143 tables; canon is a "third schema"; `SequelizeMeta` does not record what the database contains). Precondition: which of the four migration roots is canon (two cross-root duplicates change schema: `20260127000001`, `20260216000001`). | Amd18, Amd22–24, Amd29 |
| **STILL OWED**, unchanged at this basis. Addendum A/B follow-up canon reads: authorized 2026-09-01, NOT PERFORMED; blocked on credential location (both DB passwords exist only on the frozen box; Secrets Manager and SSM hold nothing under `/episode-metadata/`). | Amd28 §AD2, Amd30 §AF2 |
| **STILL OWED.** `JWT_SECRET` dev/prod environment read (item 9). | v25 Sec 6 |
| **STILL OWED** (severity adjudication). FD-68 vs FD-65 severity (item 11). FD-67's own remedy is authorized and shipped at `7a1eb427c` (Option 1, PR #1185); close status is not recorded by a Fix Plan revision. | v25 Sec 6 |
| **STILL OWED.** F-AUTH-1 limb 3 dimensions 3 and 5 (host and shared-Cognito reads). | F-AUTH-1 v2.68 |
| **MIXED.** PE #64 severity re-rule — **STILL OWED**. PE #65 Branch B costing — **DONE** (`F-AUTH-1_PE65_Resolution_BranchB_2026-08-28.md`); its ordered execution sequence is now also **DONE** (`F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md`, filed 2026-09-02, derived entirely from documents already on `main`); whether PE #65 itself closes is explicitly left open by that document (§7: "not decided here… a ratifying revision or Evoni directly") — **STILL OWED**. Re-recording §9.10's P1 in a Fix Plan revision — **STILL OWED** (that same document confirms §9.10 occurs zero times in `v2.68` as of 2026-09-02). | PE roster, Amd16; F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md |
| **CANNOT-TELL** — by the item's own terms, only a real push or reading the credential settles it, and neither is repo-derivable. PE #68: whether the injected git credential acts as `angelcreator113`. | Amd12, Amd14 |
| **STILL OWED**, unchanged at this basis. F-Deploy-1 post-close: AD (no instance profile), AE (open SG ports; `/32` on 22 re-scoping), AF (RDS SG `0.0.0.0/0:5432`), fork-RDS teardown, dev DNS repoint or retire, prod transport to SSM, credential rotations, the prod reconciliation session. | F-Deploy-1 v1.49 |
| **STILL OWED** — newest evidence note on file is still 2026-07-07. Branch-protection bypass disposition (enforce / accept / PR-required for `docs/audit/**`). | Finding_Main_BranchProtection_Bypass |
| **STILL OWED, all sub-items** — confirmed unplaced/unfiled at this basis: no banner text found on `v25_Owed_Index_Amd28_2026-09-01.md` beyond its own §AD2 status update; no `Prime_Studios_Audit_Handoff_v26*.md` exists. Rulings owed on the register itself: v25 item 5 replacement text; Amd6's missing pointer banner; the status banner on Amd28 §AD3.3; whether measurement corrections need ratification (XK-1); the VENDOR DOCUMENTATION source class; attribution-gap remedies (ALB access logs, actor on write paths); minting the production-provenance mechanism; the `deploy-production.yml` header figures; the authorship-record preservation choice. | Amd10, Amd13, Amd30, drafts of 2026-08-22/24 |

**Register work an agent session can do (repo-only, filed with `/audit-file`, pushed and merged under Rule 7)**

| Item | Source |
|---|---|
| **DONE (confirmation sweep); ratification STILL OWED.** F-AUTH-1 limb 1: per-CP confirmation passes now filed for all 12/12 CPs, confirming 127 recorded dispositions (120 agree, 2 disagree, 5 cannot-tell), not 129. See §6.1 for the count and §11's note. Ratifying the discharge in a handoff revision is not this table's item, and is not done. | CP1–CP12 confirmations, 2026-09-01/02; v2.68 |
| **STILL OWED**, unchanged — newest F-Stats-1 authority is still `v1.60`. F-Stats-1 owed: the reads slice (since v1.49 §52.6); read F-App-1 §12.11 to close the PE #62 overlap (the eleventh sync is `workers/sceneGenerationWorker.js:235`); §35.5 classes 2–6 homing; the second-shape mint decision (40 sites / 39 handlers / 20 files; Evoni rules); StorytellerMemory references; `worldStudio.js:1838–1859` transactionality; `worldEvents.js:570`, `:1973`, `worldStudio.js:3121` unread. | v1.60 §63.5 |
| **STILL OWED.** XK-1 admission status after reach collapsed to F-Stats-1 alone (limb 2 boot-path reading); XK-2 extent census (20 of 22 `:showId` files unprobed); XK-3 full `authorize` call-site population (Gate 3 needs a live DB: Evoni). | CKR |
| **STILL OWED** — FD-70 remains next-available and unminted per `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md` §8. Route-shadowing FD decision for the six dead declarations (item 10-B, under limb 1). | Route_Shadowing_Survey |
| **STILL OWED** — no `Prime_Studios_Audit_Handoff_v26*.md` exists at this basis. v26 handoff: supersede v25 Sec 1/2/3/6, carry Amd10 §J3/§J4/§J5 and the v26 draft material; F-Stats-1's "Phase B live" face read needs re-derivation. | v26_Draft_Material_* |
| **STILL OWED** — `Session_PE_Roster.md` last touched 2026-08-27 (PE #68 mint), before this window's activity. Roster hygiene: closed index omits PE #63 and #66; PE #64's status line is superseded by its amendments; the `§AD/§AE/§AF` letter collision. | PE roster, Amd29/30 |
| **STILL OWED.** F-Sec-3 cold items: `socialProfileRoutes.js:1010` classification; `evaluation.js` frontend key audit; history-table consolidation; the `financialPressureService.js:208` ledger mutation. | F-Sec-3 inventory §5 |
| **STILL OWED.** F-Tools-1 opens: stop hook, deploy-hook noise, deploy-production hardening, GitHub App identity inventory (PE #59); PE #67 fail-closed branch-base gate script. | F-Tools-1 §4 |
| **STILL OWED** — the DRAFT still reads "Nothing records that it also closed cross-environment write." F-Deploy-1 amendment recording that the SSM rewrite also closed cross-environment write. | Production_State_Provenance §8 |

**Code PRs (small, inside or adjacent to the sequence)**

| Item | Source |
|---|---|
| **DONE (code); recording STILL OWED.** FD-64: fixed — `getRolesForshow` → `getRolesForShow` at `65cbe7013`; `Model.update()` `where` clause added at `AssetRoleService.js:151` at `2e5dbdf28`. Close not recorded in a Fix Plan revision. | F-AUTH-1 v2.6x |
| **STILL OWED.** FD-66 disposition and a baseline migration sequence (after item 8; Evoni rules, a PR executes). | FD-66 DRAFT |
| **STILL OWED.** 28 `claude/**` branch tips lack `[skip-automerge]` while `auto-merge-to-dev.yml` still carries the push trigger in YAML (re-enable decision is gated; the fix is a branch-cleanup ruling, not a code change). | Amd26 §AB3 |

**Session PE roster (PE #27–#68), carried unchanged — see the roster-hygiene item above for what is stale in it.** Closed: #37, #41, #48, #58, #63, #66. P0 open: #51, #52 (F-AUTH-1 pre-flight inventories). P1 open: #27 (prod smoke test accepts 502/503), #38, #40, #42–#47 (npm audit; prod-RDS column drift), #49 (50% AI error rate), #54, #55, #64. P2 open: #31, #39, #50, #53, #56, #57, #59–#62, #65, #67, #68. PE #1–#26 and #28–#36 live in F-AUTH-1's Track 8 roster, not here.

Declined or bounded non-actions (do not reopen without a reason): fourteen in-place-amended documents outside the chain; three `.docx`-only handoff revisions; bare `#NNN` in 279 documents; Amd4's ruling that the second-party observation is not an operating assumption.

---

## 7. Infrastructure and the freeze (ASSERTED unless noted)

| Thing | State |
|---|---|
| Prod box `episode-backend` | `i-02ae7608c531db485`, 54.163.229.144, t3.small, Ubuntu 22.04, no IAM instance profile (so no SSM). Runs `episode-api-prod-hotfix` on :3000 (process started 2026-07-11 by an unrecorded actor) and `episode-worker` (stopped). Code on disk is debris from failed deploy-dev run 28289269164 (2026-06-27), before the Aug auth fixes; the login disable was hand-applied 2026-08-22. |
| Dev box `episode-dev-backend` | `i-016395bb5f7a51a0b`, EIP 54.87.253.45, t3.small, SSM-managed, role `episode-dev-backend-role`; deployed by manual `workflow_dispatch` of `deploy-dev.yml` (OIDC role `episode-gha-deploy-dev`, artifact via S3, DB creds from Secrets Manager `episode-metadata/dev/database`). |
| Canon RDS `episode-control-dev` | 10.0.20.224, `episode_metadata`, 143 tables, populated. **Misleadingly named: it is the production data.** Master credential lives only in Evoni's password manager (paper + fingerprint custody). FD-61: `StorageEncrypted=false`. |
| Fork RDS `episode-control-prod` | 171 tables, empty; SG still `0.0.0.0/0:5432` per docs; teardown deferred. |
| Cognito | One shared user pool and client for dev and prod (PE #64); three accounts, all Evoni's; Branch B (new prod pool, existing stays dev) ruled 2026-08-28, unexecuted. `docs/cognito-ids.txt` and `docs/COGNITO_USER_POOL_SETTINGS.md` retired as authority (PE #66). |
| Secrets | Secrets Manager: only the dev DB secret. SSM Parameter Store: four parameters, none for this app (Amd30). Static AWS keys in the prod `.env` (AD). Feb 2026 credential blobs remain in git history (rotated). |
| Workflows (MEASURED via API) | `Validate` active; `Deploy to Development` active, dispatch-only; `Deploy to Production` and `Auto-merge to Dev` `disabled_manually`; a Copilot cloud agent workflow exists with no file in the tree. |
| DNS | `dev.primepisodes.com` A record → prod box (repoint drafted, never recorded executed). Prod behind an ALB; `PE #27`: prod smoke test accepts 502/503. |
| Monitoring | Three CloudWatch billing alarms ($100/$300/$500 → SNS). The ELB 5xx availability alarm `prod-availability-elb-5xx` is the F-Deploy-G1-AJ plan; Handoff v13 records it live from 2026-06-01, the AJ plan's own baseline lists zero availability alarms, and no later document re-verifies it. The June 2026 multi-day prod 502 was found by a manual check. |

**Freeze rules (from the hazard doc Sec 3):** no `pm2 restart/reload/save/delete`, no reboot, no deploy, no `.env` edit, no RDS modification, no data copy between instances, no SG "fixes", no re-enabling the disabled workflows. Reconciliation is its own gated session with a verified canon backup first.

**What is safe today:** local development against Docker Postgres; cloud sessions and laptop CLI on branches; PRs to `main`; dispatching `Deploy to Development` (Evoni, from a browser, Rule 7).

---

## 8. Register conventions (how to read and write `docs/audit/`)

- **Authority by numeric sort.** Newest `F-<Keystone>_Fix_Plan_v<N>.md` and `Prime_Studios_Audit_Handoff_v<N>.md` by *numeric* version; `ls | sort -V`. Record blob SHAs alongside numbers (an in-place amendment moves the blob, not the number).
- **Per-claim authority.** The newest revision governs only what it closes; older revisions stay authoritative for what they closed.
- **Banners newest-first; banner governs body.** Additive-supersede: never edit a filed document; prepend a dated correction banner or mint an amendment/revision. A banner may point but may not carry.
- **Standings:** MEASURED (repo read, anyone can check; paste command + output), ATTESTED (session record only), RULED (Evoni's decision, quoted), INFERRED (say so). Never upgrade a standing.
- **H1:** a precondition asserted in prose is not asserted; paste the command and raw output. **H2:** read `origin/main` explicitly (`git show origin/main:path`).
- **Evidence:** a claim is not a close; the artifact is the close. Empty stdout is not evidence unless exit 0 (FD-51). Workflow runtime state needs the Actions API (FD-50). Prose about other documents is never authority (FD-49).
- **Identity by function, never by label:** RDS by `SELECT current_user, current_database(), inet_server_addr()`; processes by ingress route then port then PID; hosts are addresses.
- **Commit hygiene:** `docs(audit): <what> [skip-automerge]`; no closing keywords next to `#N`; PR bodies via `--body-file`; explicit-path `git add`; squash-merge; branch delete.
- **Navigation documents outlive their windows:** before following any doc that tells you what you may read, check its subject is still open against the live register tail (onboarding §4 rule 13; the `[3]` cold-entry docs are VOID).
- **Standing labels on humans:** "Evoni-gated" means only she can perform or authorize it; agent sessions record NOT PERFORMED, never infer.

---

## 9. Stale and dangerous documents (do not follow)

| File | Problem |
|---|---|
| `.github/agents/deploy.agent.md`, `.github/prompts/deploy-dev.prompt.md` | Instruct SSH to 54.163.229.144 (the frozen prod box), `git pull`, `pm2 restart` — the exact actions the hazard doc forbids. |
| `.github/copilot-instructions.md`, old `CLAUDE.md` | Neon DB, `memories.js` single file, `optionalAuth` convention, port 5173, "no Tailwind". |
| `.github/instructions/memories-routes.instructions.md` | `applyTo: src/routes/memories.js` with a line map of a deleted file; `optionalAuth` scaffold. |
| `.github/agents/story-engine.agent.md` | Names deleted `StoryEngine.jsx`; "12K-line memories.js". |
| `README.md` | Jan 2026 plan: ECS, RDS Multi-AZ, Feb 14 launch, `dev` branch flow, Cognito groups. |
| `SESSION_HANDOFF.md` | 2026-04-14; Part 1 built, Part 2 (Screen Layer System) never built; PhoneHub has since changed. |
| `docs/*.md` (344 files) | All written 2026-01-01 → 2026-03-01: the January metadata-API/CMS phases (110 `PHASE_*`, 8 `WEEK*`) and the February video suite; none describes the Before Lala / LalaVerse product. Treat as history. `docs/API_REFERENCE.md` (3 route groups) and `API_QUICK_REFERENCE.md` (4) versus 91 mounted `/api/v1` prefixes today. |
| `docs/DEPLOYMENT*.md`, `GITHUB_DEPLOYMENT_SETUP.md`, `AWS_SETUP.md`, `CLOUDSHELL_MIGRATION_GUIDE.md`, `MIGRATE_NOW.md`, `RDS_READY_FOR_MIGRATIONS.md`, `00_NEXT_STEPS_ROADMAP.md` | Describe ECS / staging-branch / push-to-dev pipelines that never existed or are disabled, and contain copy-paste `aws` and migration commands against RDS. Following any of them recreates the May 30 incident path. |
| `docs/README_AUDIT_FEBRUARY_2026.md`, `docs/SECURITY_AUDIT_FINDINGS.md` | The May 11 redaction (#665) missed a staging RDS password literal that is still printed in both files' rotation lists. Redact (a docs PR), do not quote. |
| `.github/prompts/new-endpoint.prompt.md`, `new-context-loader.prompt.md`, `.github/MERGE_CONFLICT_RESOLUTION_CHECKLIST.md`, `.github/agents/endpoint-validator.agent.md` | Line ranges and scaffolds into the deleted `memories.js`; the validator nudges toward PM2 logs on the frozen box. |
| `package.json` `deploy:production` / `health:production` scripts | Call a root `deploy-production.sh` that does not exist. |
| `docs/cognito-ids.txt`, `docs/COGNITO_USER_POOL_SETTINGS.md`, `docs/connect-to-ec2.txt`, `docs/rds-endpoint-dev.txt` | Retired as authority; carry identifiers; do not paste their contents into prompts. |
| `docs/audit/F-Deploy-1_[3]_*` cold-entry docs | VOID (terminal banners); would lead a session to mint a duplicate close and a freeze-lift. |
| `backups/staging/*.sql` | Database dumps committed to the repo (Jan 2026). Read-denied in `.claude/settings.json`. |

---

## 10. Suggested work for the loop (Evoni chooses; nothing here is ruled)

Inside the locked sequence and safe for agent sessions:
1. **DONE (confirmation sweep); ratification STILL OWED.** ~~Limb 1 per-CP confirmation passes (repo-only, decomposable, cannot-tell first-class).~~ All 12/12 CPs confirmed (`F-AUTH-1_Limb1_CP1…CP12_Confirmation_2026-09-02.md`, CP10 committed 2026-09-01, the rest 2026-09-02): 127 recorded dispositions, 120 agree / 2 disagree / 5 cannot-tell. See §6.1. A handoff revision ratifying the discharge is still owed — CP12's "Limb 1 discharges" is its own claim, not a ruling.
2. ~~FD-64 fix: rename `getRolesForshow` → `getRolesForShow` and the `Model.update()` without `where` in `AssetRoleService.js:152`.~~ **DONE** — `65cbe7013` and `2e5dbdf28`; close not recorded in a Fix Plan revision (**STILL OWED**).
3. Register hygiene tasks — **MIXED**: place the owed banner on Amd28 §AD3 — **STILL OWED** (confirmed unplaced at this basis: `v25_Owed_Index_Amd28_2026-09-01.md` carries only its own §AD2 status-update banner); reconcile v25's FD-68 status — **DONE** (§6.1 already carries "FD-65 and FD-68 CLOSED (v25 wrongly lists FD-68 open)"); PE tail correction — **DONE** (§6.3 already carries "PE tail PE #68").
4. **STILL OWED** — both files unchanged at this basis (`.github/agents/deploy.agent.md`, `.github/prompts/deploy-dev.prompt.md` still present, still listed in §9). Retire the dangerous Copilot deploy prompts (replace with a pointer to the freeze).
5. **STILL OWED** — confirmed still present in both files at this basis. Redact the surviving staging RDS password literal in the two February audit docs (§9).
6. **STILL OWED** — no `eslint` reference in `.github/workflows/validate.yml` at this basis. Add ESLint to the CI Validate workflow after clearing the 38 pre-existing errors in 23 `src/` files (§4.8), or record why not.

Product-adjacent, small, and reversible (would need Evoni's "scope creep" waiver, since the onboarding doc forbids feature work during the fix cycle):
7. **STILL OWED** — 61 occurrences of the stale model IDs remain under `src/` at this basis. Normalize model IDs (`claude-sonnet-4-20250514` → `claude-sonnet-4-6`; delete the invalid `claude-sonnet-4-5-20250514`; route `iconCueGeneratorService` through the SDK so it is budget-tracked).
8. **STILL OWED** — §4.6 still lists the same stale nav targets and orphan files, unchanged. Fix stale navigation targets and delete orphan frontend files listed in §4.6.
9. **STILL OWED** — `src/routes/storyEvaluationRoutes.js` still present, no disposition document found. Decide the Story Engine backend's fate (retire, keep as API, or rebuild UI).
10. **STILL OWED** — no `docs/archive/` directory exists at this basis. Archive `docs/*.md` phase reports into `docs/archive/` with an index, keeping the few live guides; remove `backups/staging/*.sql` and the three identifier `.txt` files from the tree.
11. **STILL OWED** — no evidence found of the gate being lifted or the mismatch being fixed at this basis. Test hygiene: lift the `TEST_DATABASE_URL` gate for DB-free unit tests, surface the 20 silently excluded files, fix the `docker-compose.test.yml` 5433 / README 5432 mismatch.

Evoni-only (never an agent task): everything in §6.5 marked Evoni, and the prod reconciliation session.

---

## 11. Where to look

| Need | Path |
|---|---|
| App composition, mounts, middleware | `src/app.js`, `src/server.js` |
| Auth | `src/middleware/auth.js`, `src/middleware/jwtAuth.js`, `src/middleware/rbac.js`, `src/routes/auth.js`, `src/services/tokenService.js` |
| DB config / models / migrations | `src/config/sequelize.js`, `src/models/index.js`, `src/migrations/` |
| Story/AI | `src/routes/memories/*.js`, `src/routes/storyteller.js`, `src/services/textureLayerService.js`, `src/routes/storyEvaluationRoutes.js` |
| World/Feed | `src/routes/worldEvents.js`, `worldStudio.js`, `socialProfileRoutes.js`, `characterRegistry.js`, `franchiseBrainRoutes.js`, `src/services/feedScheduler.js`, `src/seeders/` |
| Production | `src/routes/episodes.js`, `shows.js`, `sceneSetRoutes.js`, `wardrobe.js`, `assets.js`, `uiOverlayRoutes.js`, `src/controllers/*` |
| Frontend | `frontend/src/App.jsx`, `components/layout/Sidebar.jsx`, `pages/WorldAdmin.jsx`, `pages/WriteMode.jsx`, `pages/UIOverlaysTab.jsx`, `components/SceneStudio/` |
| CI / validation | `.github/workflows/validate.yml`, `scripts/validate-routes.js`, `scripts/lint-silent-catches.sh`, `scripts/audit-cost-exposure.sh`, `scripts/check-root-junk.js`, `.githooks/` |
| Deploy | `.github/workflows/deploy-dev.yml` (live path), `deploy-production.yml` (disabled), `ecosystem.config.js`, `nginx/` |
| Register entry points | `docs/audit/NEW_CHAT_ONBOARDING.md`, newest `Prime_Studios_Audit_Handoff_v*.md`, newest `v25_Owed_Index_Amd*.md`, `Cross_Keystone_Register.md`, `Session_PE_Roster.md` |
| Freeze | `F-Deploy-1_PROD_SplitBrain_HAZARD.md`, `F-Deploy-1_INCIDENT_2026-05-30_prod-autodeploy.md` (repo root) |
| Workflow for humans and agents | `DEVELOPMENT_WORKFLOW.md`, `.claude/skills/`, `.claude/desktop/` |
