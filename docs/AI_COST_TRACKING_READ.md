# Which AI calls bypass the cost tracker — a read

## Status of this document

A read, for Evoni to decide whether her AI spend figures are complete and whether the daily budget
actually caps spend. It changes no code, adds no tracking, and recommends nothing: §8 lists options
without choosing. Not filed under `docs/audit/`; it mints no FD/XK/PE number. Code is cited by file
and function or route name; line numbers are given where they help and hold at the basis only.

Basis: `origin/main` at `b006b41ffa8734934942cbc0495658ba8af57739` (2026-09-23). Task: #1729. No
host, AWS, database, or Cognito contact; the one runtime measurement (§2.3) used a fake network
layer and a stand-in for the database model, and made no API call.

## Short answer

- **The tracker is not a shared client.** `aiCostTracker` replaces the SDK's
  `Messages.prototype.create` when `src/app.js` requires it at startup. Every `messages.create` call
  made **in the app process** is logged and budget-checked, wherever its client was constructed.
- **193 AI call sites** in 79 files (110 client constructions). **180 are tracked.** The other 13:
  - **6 streamed calls** (`messages.stream`, in the memories routes) pass the budget check but are
    **logged with 0 tokens and $0**, and add nothing to the daily spend counter. Measured, §2.3.
  - **1 direct HTTP call** (`iconCueGeneratorService`) never touches the SDK: **not logged, not
    budget-checked**.
  - **5 calls** in `sceneGenerationService` and `sceneSpecService` are tracked when the app runs
    them, but **not logged and not budget-checked** when the `episode-worker` process runs them,
    because the worker never loads the tracker.
  - **1 call** (`sceneIdentityService`) is in a file neither process loads.
- **All three untracked paths can be triggered by any signed-in user** — none needs a script.
- **Yes, untracked calls can spend past the budget.** The gate only sees tracked, non-streamed spend,
  and its counter lives in the app's memory: it resets on every restart and is not shared with the
  worker.
- **The AI Costs page is missing the untracked spend.** It reads only `ai_usage_logs`. Streamed calls
  appear there as $0 rows; direct-HTTP and worker calls do not appear at all.

## 1. The rule

`CLAUDE.md`, Stack section:

> AI: `@anthropic-ai/sdk`; primary `claude-sonnet-4-6`, Haiku 4.5 for side calls; every call is
> logged and budget-gated by `src/services/aiCostTracker.js`.

The rest of this read measures how far "every call" holds.

## 2. How the tracker attaches, and what escapes it

### 2.1 The mechanism

`aiCostTracker` runs `applyPatch()` on require. It builds a throwaway client, takes
`Object.getPrototypeOf(tempClient.messages)`, and replaces that prototype's `create` with
`trackedCreate`. Because every client's `messages` object shares that prototype, every client in the
same process — constructed before or after, anywhere — goes through `trackedCreate`.

`src/app.js` requires it near the top (`require('./services/aiCostTracker');`), and `src/server.js`
requires `./app`. So the **app process** (`episode-api-prod-hotfix` in `ecosystem.config.js`, one
instance) is patched.

`trackedCreate` does two things:

1. **Before the call:** the budget check (§6).
2. **After the call resolves:** `logUsage(response)` reads `response.usage`, computes cost with
   `calculateCost`, adds it to the daily counter, and writes one `AIUsageLog` row
   (`ai_usage_logs`) fire-and-forget.

There is **no shared client**. Using a particular client gives a caller nothing; being in the
patched process with the patched method is what counts.

### 2.2 What escapes it

| Escape | Why | Sites |
|---|---|---|
| Another process | The patch lives in the app process's copy of the SDK. `src/workers/start.js` (the `episode-worker` process) never requires `aiCostTracker`. | 5 (§3, §5.3) |
| Another transport | A call made over HTTP directly, not through the SDK, never reaches `Messages.prototype.create`. | 1 (§5.2) |
| A streamed call | `messages.stream()` does go through the patched `create` — the SDK's `MessageStream._createMessage` calls `messages.create({ ...params, stream: true }).withResponse()` — so the budget check runs. But the value `create` resolves to is a `Stream`, not a message, and has no `usage`. `logUsage` records zero. | 6 (§2.3, §5.1) |
| Other SDK methods (`beta`, `batches`, `countTokens`, `messages.parse`) | Would need checking case by case | 0 in the code |

Only one copy of the SDK is installed (`node_modules/@anthropic-ai/sdk`, version 0.74.0), so no
nested copy escapes the patch.

### 2.3 Measured: what the tracker logs for a streamed call

A probe loaded `aiCostTracker`, replaced `src/models` in the require cache with a stand-in whose
`AIUsageLog.create` captures rows, and gave a client a fake `fetch` that answers both calls with
the same usage (1000 input, 500 output tokens). No network, no database.

```
stream finalMessage usage (what the API billed): {"input_tokens":1000,"output_tokens":500}
row 1 (messages.create): {"input_tokens":1000,"output_tokens":500,"cost_usd":0.0105,"is_error":false}
row 2 (messages.stream): {"input_tokens":0,"output_tokens":0,"cost_usd":0,"is_error":false}
rows logged: 2 | getDailySpend(): 0.0105
EXIT: 0
```

The streamed call was billed the same as the plain one, logged at $0, and added nothing to the
daily spend. The probe script is in the appendix.

## 3. Every client construction and call site

Found by reading `src/` and `scripts/` with comments stripped, and resolving which files each
process loads by following `require` from `src/app.js` (app) and `src/workers/start.js` (worker).
Line numbers hold at the basis. `scripts/` has none. `src/migrations/` was excluded.

| File | Process | `new Anthropic` | `messages.create` | `messages.stream` | Direct HTTP | Status |
|---|---|---|---|---|---|---|
| `src/controllers/sceneStudioController.js` | app | 1 (1393) | 1 (1395) | — | — | tracked |
| `src/routes/amberDiagnosticRoutes.js` | app | 1 (28) | 2 (349, 492) | — | — | tracked |
| `src/routes/amberSessionRoutes.js` | app | 1 (21) | 1 (235) | — | — | tracked |
| `src/routes/calendarRoutes.js` | app | 2 (352, 465) | 2 (353, 466) | — | — | tracked |
| `src/routes/characterAI.js` | app | 1 (39) | 2 (47, 56) | — | — | tracked |
| `src/routes/characterCrossingRoutes.js` | app | 1 (99) | 1 (101) | — | — | tracked |
| `src/routes/characterDepthRoutes.js` | app | 1 (38) | 2 (176, 186) | — | — | tracked |
| `src/routes/characterGenerator.js` | app | 3 (649, 763, 1206) | 3 (716, 765, 1208) | — | — | tracked |
| `src/routes/characterGrowthRoute.js` | app | 1 (16) | 1 (154) | — | — | tracked |
| `src/routes/characterRegistry.js` | app | 8 (1324, 1531, 1748, 1946, 2050, 2160, 2261, 2307) | 10 (1328, 1423, 1677, 1777, 1830, 1952, 2052, 2192, 2263, 2335) | — | — | tracked |
| `src/routes/characterSparkRoute.js` | app | 1 (21) | 1 (138) | — | — | tracked |
| `src/routes/consciousness.js` | app | 4 (262, 295, 397, 520) | 4 (264, 297, 442, 573) | — | — | tracked |
| `src/routes/episodeBriefRoutes.js` | app | 1 (297) | 1 (298) | — | — | tracked |
| `src/routes/episodeOrchestrationRoute.js` | app | 1 (23) | 1 (178) | — | — | tracked |
| `src/routes/episodes.js` | app | 1 (1227) | 1 (1230) | — | — | tracked |
| `src/routes/eventGeneratorRoute.js` | app | 1 (20) | 1 (59) | — | — | tracked |
| `src/routes/franchiseBrainRoutes.js` | app | 2 (26, 629) | 3 (391, 527, 630) | — | — | tracked |
| `src/routes/generate-script-from-book.js` | app | 1 (34) | 3 (352, 371, 390) | — | — | tracked |
| `src/routes/hairLibraryRoutes.js` | app | 1 (18) | 1 (151) | — | — | tracked |
| `src/routes/makeupLibraryRoutes.js` | app | 1 (18) | 1 (149) | — | — | tracked |
| `src/routes/memories/assistant.js` | app | 5 (25, 932, 1125, 1236, 1523) | 5 (149, 952, 1133, 1264, 1536) | 1 (406) | — | `create`: tracked; `stream`: **logged at $0** |
| `src/routes/memories/core.js` | app | 1 (18) | 4 (65, 168, 294, 705) | — | — | tracked |
| `src/routes/memories/engine.js` | app | 3 (30, 708, 3627) | 14 (118, 234, 710, 3121, 3132, 3628, 3945, 4150, 4166, 4266, 4612, 5142, 5216, 5388) | 2 (3370, 3390) | — | `create`: tracked; `stream`: **logged at $0** |
| `src/routes/memories/extras.js` | app | 1 (17) | 3 (229, 274, 380) | — | — | tracked |
| `src/routes/memories/helpers.js` | app | 1 (10) | — | — | — | client built, never called |
| `src/routes/memories/interview.js` | app | 1 (15) | 6 (107, 346, 463, 573, 981, 1236) | — | — | tracked |
| `src/routes/memories/planning.js` | app | 1 (15) | 3 (246, 431, 725) | — | — | tracked |
| `src/routes/memories/stories.js` | app | 1 (20) | 7 (209, 329, 535, 663, 796, 846, 863) | 3 (162, 499, 1285) | — | `create`: tracked; `stream`: **logged at $0** |
| `src/routes/memories/voice.js` | app | 1 (15) | 3 (141, 240, 576) | — | — | tracked |
| `src/routes/mirrorFieldRoutes.js` | app | 1 (48) | 1 (49) | — | — | tracked |
| `src/routes/novelIntelligenceRoutes.js` | app | 1 (16) | 2 (56, 305) | — | — | tracked |
| `src/routes/onboarding.js` | app | 2 (131, 191) | 2 (135, 203) | — | — | tracked |
| `src/routes/pdfIngestRoute.js` | app | 1 (38) | 1 (170) | — | — | tracked |
| `src/routes/phoneAIRoutes.js` | app | 2 (111, 226) | 2 (112, 227) | — | — | tracked |
| `src/routes/press.js` | app | 1 (43) | 1 (49) | — | — | tracked |
| `src/routes/relationships.js` | app | 2 (385, 848) | 2 (389, 850) | — | — | tracked |
| `src/routes/sceneProposeRoute.js` | app | 1 (17) | 1 (312) | — | — | tracked |
| `src/routes/sceneSetRoutes.js` | app | 1 (20) | 8 (108, 327, 534, 584, 796, 863, 1897, 1981) | — | — | tracked |
| `src/routes/socialProfileBulkRoutes.js` | app | 1 (27) | 3 (87, 227, 427) | — | — | tracked |
| `src/routes/socialProfileRoutes.js` | app | 1 (27) | 2 (339, 1563) | — | — | tracked |
| `src/routes/stories.js` | app | 2 (266, 391) | 2 (291, 424) | — | — | tracked |
| `src/routes/storyEvaluationRoutes.js` | app | 1 (23) | 7 (1179, 1185, 1191, 1318, 1427, 1491, 1690) | — | — | tracked |
| `src/routes/storyteller.js` | app | 1 (29) | 4 (470, 553, 610, 663) | — | — | tracked |
| `src/routes/therapy.js` | app | 1 (25) | 2 (152, 161) | — | — | tracked |
| `src/routes/tierFeatures.js` | app | 1 (38) | 6 (168, 572, 785, 890, 978, 1071) | — | — | tracked |
| `src/routes/upgradeRoutes.js` | app | 1 (29) | 5 (125, 226, 471, 588, 628) | — | — | tracked |
| `src/routes/wantFieldRoutes.js` | app | 1 (62) | 1 (66) | — | — | tracked |
| `src/routes/wardrobeBrands.js` | app | 1 (37) | 1 (43) | — | — | tracked |
| `src/routes/wardrobeEventRoutes.js` | app | 1 (229) | 1 (252) | — | — | tracked |
| `src/routes/wardrobeLibrary.js` | app | 1 (242) | 1 (309) | — | — | tracked |
| `src/routes/worldEvents.js` | app | 2 (298, 1187) | 2 (304, 1206) | — | — | tracked |
| `src/routes/worldStudio.js` | app | 1 (45) | 1 (49) | — | — | tracked |
| `src/services/characterFollowService.js` | app | 1 (4) | 1 (130) | — | — | tracked |
| `src/services/characterGenerationService.js` | app | 1 (33) | 5 (228, 273, 317, 363, 409) | — | — | tracked |
| `src/services/claudeService.js` | app | 1 (11) | 1 (27) | — | — | tracked |
| `src/services/distributionService.js` | app | 1 (19) | 1 (242) | — | — | tracked |
| `src/services/emotionalImpact.js` | app | 1 (31) | 1 (102) | — | — | tracked |
| `src/services/episodeGeneratorService.js` | app | 1 (494) | 1 (519) | — | — | tracked |
| `src/services/episodeScriptWriterService.js` | app | 2 (25, 755) | 2 (643, 758) | — | — | tracked |
| `src/services/feedEventPipelineService.js` | app | 1 (184) | 1 (185) | — | — | tracked |
| `src/services/feedPostGeneratorService.js` | app | 1 (22) | 1 (230) | — | — | tracked |
| `src/services/feedScheduler.js` | app | 2 (38, 69) | 2 (40, 79) | — | — | tracked |
| `src/services/groundedScriptGeneratorService.js` | app | 1 (14) | 1 (141) | — | — | tracked |
| `src/services/iconCueGeneratorService.js` | app | — | — | — | 1 (403) | **untracked** — direct HTTP |
| `src/services/invitationCompositingService.js` | app | 1 (350) | 1 (351) | — | — | tracked |
| `src/services/luxuryFilterService.js` | app | 1 (12) | 1 (267) | — | — | tracked |
| `src/services/registrySync.js` | app | 1 (383) | 1 (385) | — | — | tracked |
| `src/services/rippleEngine.js` | app | 1 (19) | 1 (173) | — | — | tracked |
| `src/services/sceneGenerationService.js` | app+worker | 3 (757, 868, 983) | 3 (758, 870, 985) | — | — | tracked in the app; **untracked** in `episode-worker` |
| `src/services/sceneIdentityService.js` | none | 1 (21) | 1 (51) | — | — | not loaded by either process |
| `src/services/scenePlannerService.js` | app | 1 (17) | 1 (176) | — | — | tracked |
| `src/services/sceneSpecService.js` | app+worker | 2 (32, 402) | 2 (34, 410) | — | — | tracked in the app; **untracked** in `episode-worker` |
| `src/services/seasonalEventService.js` | app | 1 (85) | 1 (86) | — | — | tracked |
| `src/services/storyEnrichmentService.js` | app | 1 (19) | 3 (116, 242, 359) | — | — | tracked |
| `src/services/storyGenerationService.js` | app | 1 (17) | 1 (168) | — | — | tracked |
| `src/services/textureLayerService.js` | app | 1 (6) | 2 (21, 27) | — | — | tracked |
| `src/services/thresholdDetection.js` | app | 1 (38) | 1 (44) | — | — | tracked |
| `src/services/todoListService.js` | app | 1 (34) | 2 (106, 644) | — | — | tracked |
| `src/services/wardrobeImageService.js` | app | 3 (670, 746, 847) | 3 (679, 755, 856) | — | — | tracked |

"What constructs the client": in every file above except the next two, the file constructs its own
client with `new Anthropic(...)`, at module scope or inside the function that calls it.
`routes/memories/helpers.js` constructs `_anthropic` and never uses or exports it.
`promptCacheHelper` mentions `messages.create` only in its doc comment; it builds parameters for
other files' calls and makes none itself (not in the table for that reason).

## 4. Tracked, untracked, undetermined

| Bucket | Call sites | Where |
|---|---|---|
| **Tracked** — logged at real cost and budget-checked | **180** | every `messages.create` in the app process, except those below |
| **Untracked spend, budget-checked** — logged at $0 | **6** | `messages.stream` in `routes/memories/assistant.js` (1), `engine.js` (2), `stories.js` (3) |
| **Untracked, not budget-checked** | **1** | direct HTTP in `iconCueGeneratorService` |
| **Depends on the process** — tracked in the app, untracked and ungated in `episode-worker` | **5** | `sceneGenerationService` (3), `sceneSpecService` (2) |
| **Undetermined** — in a file neither process loads | **1** | `sceneIdentityService` |
| **Total** | **193** | 79 files, 110 constructions |

## 5. What triggers the untracked calls, and whether a signed-in user can

### 5.1 The six streamed calls

All are inside route handlers mounted under `/api/v1/memories`, each behind `requireAuth`, so **any
signed-in user can cause one**. Four of the five routes have a frontend caller; the fifth is reachable by calling the API directly.

| Route | File | Middleware | Frontend caller |
|---|---|---|---|
| `POST /assistant-command-stream` | `memories/assistant.js` | `requireAuth`, `aiRateLimiter`, `assistantLimiter` | `AppAssistant` |
| `POST /generate-story-tasks-stream` (2 sites: first try, retry) | `memories/engine.js` | `requireAuth`, `aiRateLimiter` | none found in `frontend/src` |
| `POST /voice-to-story` | `memories/stories.js` | `requireAuth`, `aiRateLimiter` | `WriteMode` |
| `POST /story-continue` | `memories/stories.js` | `requireAuth`, `aiRateLimiter` | `WriteMode`, `BookEditor` |
| `POST /ai-writer-action` | `memories/stories.js` | `requireAuth` only — no `aiRateLimiter` | `WriteModeAIWriter`, `BookEditor` |

These are the WriteMode, BookEditor and assistant paths. This read does not measure how much they
are used, so it does not say how much unrecorded spend they account for.

### 5.2 The direct HTTP call

`iconCueGeneratorService.callClaudeAPI` posts to `https://api.anthropic.com/v1/messages` with
`axios`, model `claude-sonnet-4-20250514`, `max_tokens: 2000`. It runs from
`generateFromAIAnalysis`, which `generateFromEpisode` calls only as a fallback, when scene metadata
yields no cues and the episode has script content.

Trigger: `POST /api/v1/episodes/:episodeId/icon-cues/generate` and `/regenerate` (`routes/iconCues`,
`iconCueController`), behind `requireAuth` only. `IconCueTimeline` calls both. **Any signed-in user
can cause one.**

### 5.3 The five worker calls

`episode-worker` runs `sceneGenerationWorker`, which polls the `generation_jobs` table. Of the job
types it handles, only `cascade_regenerate` reaches Anthropic: it calls
`sceneGenService.generateBaseScene` and then `generateAngle` for each angle. Those reach:

- `sceneGenerationService`: the style auto-lock call inside `generateBaseScene`,
  `analyzeBaseImage`, and `checkAngleConsistency`;
- `sceneSpecService`: `buildSceneSpec` and `validateAngleAgainstSpec`.

Trigger: `POST /api/v1/scene-sets/:id/cascade-regenerate` (`sceneSetRoutes`, `requireAuth`,
`aiRateLimiter`) only queues the job and returns 202. `SceneSetsTab` calls it. **Any signed-in user
can queue one**; the spend happens later, in the worker, with no tracker and no budget check. The
same functions called directly by other `sceneSetRoutes` handlers in the app process are tracked.

The only other job type the app queues, `generate_angle_video`, makes no Anthropic call.

The deploy records attest that `episode-worker` was stopped throughout the 2026-09-22 and
2026-09-23 deploys (`docs/audit/F-Deploy-1_Deploy_2026-09-23.md` §1). While it is stopped, queued
`cascade_regenerate` jobs wait in `generation_jobs`, and would all run, untracked, when it starts.
This read does not know what is queued.

### 5.4 The file neither process loads

`sceneIdentityService` has one client and one call. No file requires it (`sceneTypePriors` mentions
it only in a comment). Whether it would be tracked depends on which process first loads it.

## 6. The budget gate

- **Where the budget is read:** `aiCostTracker`, at module load:
  `const DAILY_BUDGET = parseFloat(process.env.AI_DAILY_BUDGET_USD) || 50;`.
- **Default versus comment:** the code comment says "default: no limit"; the code defaults to
  **$50**. `.env.example` also sets `AI_DAILY_BUDGET_USD=50`. The production value is not known to
  this read.
- **The check:** before each patched `create`, `trackedCreate` estimates the worst case as
  `max_tokens` (default 4096) × the model's output price, and blocks the call with a 429 error if
  `dailySpend + estimate` would exceed the budget.
- **What counts toward it:** `recordSpend` adds a call's actual cost after it returns, only when
  cost > 0 and it was not an error. Streamed calls add $0 (§2.3).
- **Where `dailySpend` lives:** a module-level variable in the app process's memory.
  - It **resets on every restart** of the app, and at midnight UTC.
  - It is **not shared** with `episode-worker` or any other process.
  - It is not read from `ai_usage_logs`; the table and the counter can disagree.
- **Does it stop an untracked call?**
  - Streamed calls: **checked, but not counted.** Blocked only if tracked spend already reached the
    budget.
  - Direct HTTP: **never checked.**
  - Worker calls: **never checked.**

**Plainly: an untracked call can spend past the daily budget.** Streamed, direct-HTTP and worker
calls all go on after the budget is reached, and none of them moves the counter toward it. A
restart also forgets everything tracked calls have counted that day.

## 7. The AI Costs page

`/ai-costs` (`AICostTracker` page, Sidebar "AI Costs") calls `/api/v1/ai-usage/summary`,
`/by-model`, `/by-route`, `/daily` and `/optimizations` (`routes/aiUsageRoutes`). Every one reads
`ai_usage_logs` — the same table `trackedCreate` writes to. None reads `getDailySpend` or
`DAILY_BUDGET` (nothing outside `aiCostTracker` does), so the page does not show the budget
counter.

So:

- **Streamed calls** appear as rows with 0 tokens and $0: counted in call totals, missing from cost.
- **Direct-HTTP and worker calls** do not appear at all.
- The page's totals are therefore a **floor**, not the full spend.

The page shows the tracker's `route_name`. For worker calls, `inferRouteName` has a `worker:` branch
that would label them, but it never runs, because the worker never loads the tracker.

`cfoAgent` has its own separate budget (`CFO_DAILY_BUDGET`), outside this read's question.

## 8. Options for Evoni — no recommendation

| Option | What it would take | What it would prevent | What it would not |
|---|---|---|---|
| **A. Load the tracker in every process that makes AI calls** | One `require('../services/aiCostTracker')` at the top of `src/workers/start.js` | Worker calls become logged and checked against a worker-local budget | The worker's counter would still be separate from the app's; streams and direct HTTP unchanged |
| **B. Cover the escaping call shapes** | Streams: record usage when the stream finishes (for example from `finalMessage()` or the `message_delta` usage), in the tracker or at the six sites. Direct HTTP: switch `iconCueGeneratorService.callClaudeAPI` to the SDK. | Streamed and icon-cue spend appears on the page at real cost and counts toward the budget | Worker calls, unless A is also done |
| **C. Move the budget counter somewhere persistent and shared** | Read today's spend from `ai_usage_logs` (or a shared store) instead of a per-process variable | The budget survives restarts and is shared by every process that logs | Anything that is not logged (so it needs A and B to be complete) |
| **D. Leave it** | Nothing | Nothing | The page stays a floor; the budget stays per-process, reset on restart, and blind to 13 call sites |

A, B and C are independent and can be combined; the budget only becomes a real cap with all three.

## What this read does not do

- It changes no code and adds no tracking.
- It does not measure how much spend the untracked calls account for; that needs production logs or
  the Anthropic console.
- It does not know the production `AI_DAILY_BUDGET_USD`, or what is queued in `generation_jobs`.
- It does not rule on whether `sceneIdentityService` is dead code.
- It makes no host, AWS, database, or Cognito contact.

## Appendix: the probe (§2.3)

Run from the repository root with `node probe.js`.

```js
// Measures what aiCostTracker logs for messages.create and messages.stream. No network: a fake fetch answers.
const path = require('path');
const ROOT = process.cwd();
const rows = [];
require.cache[require.resolve(path.join(ROOT, 'src/models'))] = { exports: { AIUsageLog: { create: async (r) => { rows.push(r); } } } };
require(path.join(ROOT, 'src/services/aiCostTracker'));
const Anthropic = require(require.resolve('@anthropic-ai/sdk', { paths: [ROOT] }));
const usage = { input_tokens: 1000, output_tokens: 500 };
const msg = { id: 'm1', type: 'message', role: 'assistant', model: 'claude-sonnet-4-6', content: [{ type: 'text', text: 'hi' }], stop_reason: 'end_turn', stop_sequence: null, usage };
const sse = [
  ['message_start', { type: 'message_start', message: { ...msg, content: [], usage: { input_tokens: 1000, output_tokens: 1 } } }],
  ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
  ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'hi' } }],
  ['content_block_stop', { type: 'content_block_stop', index: 0 }],
  ['message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: 500 } }],
  ['message_stop', { type: 'message_stop' }],
].map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join('');
const fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  return body.stream
    ? new Response(sse, { status: 200, headers: { 'content-type': 'text/event-stream' } })
    : new Response(JSON.stringify(msg), { status: 200, headers: { 'content-type': 'application/json' } });
};
(async () => {
  const client = new Anthropic({ apiKey: 'test', fetch });
  await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: 'x' }] });
  const s = client.messages.stream({ model: 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: 'x' }] });
  const final = await s.finalMessage();
  await new Promise((r) => setTimeout(r, 50));
  console.log('stream finalMessage usage (what the API billed):', JSON.stringify(final.usage));
  rows.forEach((r, i) => console.log(`row ${i + 1} (${i === 0 ? 'messages.create' : 'messages.stream'}):`, JSON.stringify({ input_tokens: r.input_tokens, output_tokens: r.output_tokens, cost_usd: r.cost_usd, is_error: r.is_error })));
  console.log('rows logged:', rows.length, '| getDailySpend():', require(path.join(ROOT, 'src/services/aiCostTracker')).getDailySpend());
})().catch((e) => { console.error('probe error:', e.message); process.exit(1); });
```
