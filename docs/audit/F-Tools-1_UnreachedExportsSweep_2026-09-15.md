# F-Tools-1 — Unreached Exports and Shadowed Registrations Sweep

**Standing:** MEASURED (repo read; every count below is a paste-and-rerun command against this basis).

**Basis:** `origin/main` at `e7311a25730d6bfdda21575666fc558ad9f40079`, committed 2026-09-15 (`git rev-parse origin/main`; `git log -1 --format='%ad' --date=iso-strict origin/main` → `2026-09-15T12:46:26-04:00`).

**Filename date derivation:** the filename carries the filing date, not the basis commit date (the two happen to coincide here). Filing date is this session's date, `2026-09-15`, taken from the same wake-up read that established the basis SHA above — the environment's current-date value at the moment this note was drafted. Nothing about the filename date is inferred from repo content.

**Relationship to #1453:** issue #1453 ("read for unreachable exports and shadowed route registrations in `src/`") is prior work in name only. It was checked at this basis: `mcp__github__issue_read` (method `get_comments`, owner `angelcreator113`, repo `episode-canonical-control-record`, issue `1453`) returned an empty comment list — no report has been posted against it. There is nothing to carry forward or cite claim-by-claim; #1453's issue body names five cases to re-confirm, and this sweep re-derives all five independently (see "The five known cases" below) rather than transcribing anything. Two of the five turn out to read differently once the src/tests split (correction b, below) is applied — that is flagged in place, not silently folded in.

This note mints nothing, rules nothing, and recommends no removal. See "Closing" at the foot.

---

## 1. Method

### 1.1 Extraction — what counts as an export

For every `.js` file under `src/services/` (108 files) and `src/middleware/` (10 files), 118 files total, the file's own `module.exports` statement was read and classed as one of:

- **whole-module** — `module.exports = <expr>;` where `<expr>` is not an object literal (a class, a singleton instance, a bound function). The file itself is the reachable unit; there is no per-name grep for it.
- **named** — `module.exports = { a, b, c: renamed, ... };`, exporting one or more identifiers. Multi-line object-literal exports were parsed by brace-depth tracking (a single-line `sed`/`grep` cannot reliably split a block export that spans dozens of lines), and one file (`src/services/tokenService.js`) uses repeated `module.exports.NAME = ...` statements instead of one block; both forms were counted as named exports.

First-pass command that finds every export statement's start line (checkable directly, 118 hits, one per file):

```
$ grep -n "^module.exports" src/services/*.js src/middleware/*.js
```

Result: **419 named export names** across 80 files, **38 whole-module exports**. 419 + 38 = 457 export units checked.

For each named export, the definition line inside its own file was located by pattern (function declaration, arrow/function-expression `const`, class-method shorthand, or `static` class method — `tokenService.js`'s six exports are `TokenService.NAME.bind(TokenService)` re-exports of `static` class methods, and needed the `static NAME(` pattern to resolve a definition line). The definition's own line text was used to classify the export as **function** (338), **data** (74 — plain object/array/string/number literals, JSON-shaped constants, zod-style schema builders), or **class** (7 — `errorHandler.js`'s seven error subclasses). Classes are grouped with functions/middleware in the tier split below: like a function, a class's export is exercised by calling it (`new X(...)` / `throw new X(...)`), not by importing a data shape, so it answers the "nobody calls this" question, not the "nobody imports this shape" one.

### 1.2 Reach check — per-name grep, then a require trace

For each of the 419 named exports, two raw word-boundary searches were run, excluding the defining file itself:

```
$ grep -rlw '<name>' src tests --include='*.js' | grep -v '<definingFile>'      # combined
$ grep -rlw '<name>' src --include='*.js'       | grep -v '<definingFile>'      # src-only
```

706 files under `src/` and 165 under `tests/` (871 total) were the search universe (`find src tests -name '*.js' | wc -l`). All 419 names were run through both searches (838 raw greps); 293 of the 419 produced at least one raw combined hit and moved to the require-trace pass described next. Representative outputs, chosen to show a clean unreached case, a whole-module case, a false-positive caught by the trace, and a genuinely-reached case for contrast:

```
$ grep -rlw "calculateCost" src tests --include='*.js' | grep -v "src/services/aiCostTracker.js"
(no output — zero hits; tier i)

$ grep -rlw "MODEL_PRICING" src tests --include='*.js' | grep -v "src/services/aiCostTracker.js"
(no output — zero hits; tier ii)

$ grep -rlw "logTransaction" src tests --include='*.js' | grep -v "src/services/financialPressureService.js"
src/services/financialTransactionService.js
src/routes/evaluation.js
src/routes/wardrobe.js

$ grep -rlw "requireRole" src tests --include='*.js' | grep -v "src/middleware/jwtAuth.js"
src/middleware/rbac.js
tests/unit/middleware/rbac.test.js

$ grep -rlw "optionalJWTAuth" src tests --include='*.js' | grep -v "src/middleware/jwtAuth.js"
tests/unit/middleware/jwtAuth.test.js

$ grep -rlw "requireAuth" src/routes --include='*.js' | wc -l
133
```

`requireAuth` (133 route-file hits, `src/middleware/auth.js:543`) is not a finding anywhere below — it is the contrast case showing the method returns "reached" for something genuinely wired in, not just anything that raises a hit count.

### 1.3 Correction (a) — a name match is not a require

A raw hit only proves the string appears in another file, not that the file requires *this* file's export under that name. Two different files can export the same identifier (`requireRole` is defined independently in both `jwtAuth.js` and `rbac.js`), and a hit on the string doesn't say which one the hitting file actually uses.

Every name with ≥1 raw combined hit (293 of 419) was traced: for each hit file, its `require(...)` statements were resolved to a file path (relative requires only — `src/services/` and `src/middleware/` files are never required by bare specifier), and the binding checked —
- a destructured require (`const { name } = require('./file')`) — the name must appear inside the braces; or
- a default require (`const local = require('./file')`) — the file must then reference `local.name` somewhere.

Only a confirmed binding counts as reach. **26 of the 293 traced names flipped from "raw-reached" to "unreached"** once traced — every one of them a same-name collision with an unrelated definition in the hit file (`requireRole` above is one; `logTransaction` above is another — both routes.js hits destructure `logTransaction` from `financialTransactionService.js`, confirmed by `grep -n "require.*financialTransactionService" src/routes/evaluation.js src/routes/wardrobe.js`, not from `financialPressureService.js`). No two-step `const x = require(...)` followed by a later `const { a } = x` destructure exists anywhere in `src/` or `tests/` (checked directly — zero matches), and no file does a bare `require('../services/x').name(...)` without an intermediate binding, so the two binding shapes above are exhaustive for this codebase; the trace does not need to handle either.

The same correction applies to whole-module checks, where it matters even more because the "name" being searched is a common English word. `src/middleware/asyncHandler.js` is a worked example: a raw combined search for `asyncHandler` returns dozens of files (it's used as a wrapper in nearly every route file), but resolving each hit's `require(...)` shows every one of them resolves to `src/middleware/errorHandler.js`'s own, separate, same-named `asyncHandler` export (`grep -n "asyncHandler" src/middleware/errorHandler.js` shows it's defined at line 182 and exported at line 295) — never to `src/middleware/asyncHandler.js` itself. Because of that, whole-module reach below was established by require-path resolution from the start, not by a raw text search.

### 1.4 Correction (b) — tests count as reach under a combined grep

The sweep was run twice per name, as shown in 1.2: once against `src/` + `tests/` together, once against `src/` alone. Kept separate, this distinguishes "nothing calls it, including tests" from "only its own test file calls it, production code never does." **34 of the 419 named exports (25 function/middleware, 9 data) show zero src-only hits but ≥1 combined hit** — these are tier iii/iv below, not tier i/ii, and not lumped in with genuinely-reached names either.

### 1.5 Dynamic-reference search

Searched for patterns that could resolve into `src/services/` or `src/middleware/` without a static, grep-visible name:

```
$ grep -rnE "require\(\s*[a-zA-Z_$][\w.]*\s*\)" src tests --include='*.js' | grep -v "require('" | grep -v 'require("'
(no output)

$ grep -rn "require(\`" src tests --include='*.js'
(no output)

$ grep -rniE "readdirSync.*services|readdirSync.*middleware" src --include='*.js'
(no output)

$ grep -rn "require.context" src --include='*.js'
(no output)
```

No string-built `require()`, no template-literal `require()`, no directory-scanning module loader, and no `require.context`-style bundler indirection exists anywhere in `src/`. The codebase's `require()` calls are all string-literal and resolve statically (`dynamic import()` calls that do exist are for external npm packages — `node-fetch`, `form-data` — never for internal services or middleware). Handler-shaped objects that do exist (e.g. `src/middleware/auditLog.js`'s `actionMap`) map HTTP-method strings to plain string labels, not to function references, so they don't dispatch into any of the exports below either. **The static result stands — no finding in this note is marked cannot-tell.**

---

## 2. The five known cases, re-confirmed at this basis

| Case | This sweep's result |
|---|---|
| `optionalJWTAuth` (`src/middleware/jwtAuth.js`) | Reached only by `tests/unit/middleware/jwtAuth.test.js` (traced: `require('../../../src/middleware/jwtAuth')` destructures it at test line 43) — **tier iii**, not fully unreached |
| `logTransaction` (`src/services/financialPressureService.js`) | Zero src/tests hits after tracing (raw hits are all `financialTransactionService.js`'s own `logTransaction`) — **tier i** |
| `requireRole` (`src/middleware/jwtAuth.js`) | Zero src/tests hits after tracing (raw hits are all `rbac.js`'s own `requireRole`) — **tier i** |
| `requireRole` (`src/middleware/rbac.js`) | Reached only by `tests/unit/middleware/rbac.test.js` (traced: destructured at test lines 6 and 844) — **tier iii**, not fully unreached |
| shadowed `PUT /:id` at `src/routes/compositions.js:813` | Confirmed — see §8 |

Two of the five (`optionalJWTAuth`, `rbac.js`'s `requireRole`) land in tier iii rather than tier i once the src/tests split (§1.4) is applied to them specifically — they are called from their own unit test, so a combined-only grep reads them as "reached" and a naive unreached-in-src-and-tests bar would misclassify them either way without the split. That is the one place this sweep's number differs from what a single-pass, unsplit grep over the five would have reported.

---

## 3. Tier i — unreached functions and middleware (zero hits in src/ and tests/)

103 entries.

| Name | File | Def line | Export line |
|---|---|---|---|
| `verifyGroup` | src/middleware/auth.js | 462 | 625 |
| `requireRole` | src/middleware/jwtAuth.js | 150 | 178 |
| `getUserRole` | src/middleware/rbac.js | 43 | 212 |
| `hasPermission` | src/middleware/rbac.js | 68 | 213 |
| `calculateCost` | src/services/aiCostTracker.js | 43 | 252 |
| `getDailySpend` | src/services/aiCostTracker.js | 130 | 252 |
| `selectModel` | src/services/aiModelRouter.js | 56 | 79 |
| `checkPhaseTransition` | src/services/arcProgressionService.js | 142 | 486 |
| `computeEmotionalTemperature` | src/services/arcProgressionService.js | 19 | 489 |
| `stakesNarrative` | src/services/arcTrackingService.js | 17 | 193 |
| `visibilityNarrative` | src/services/arcTrackingService.js | 34 | 194 |
| `woundClockNarrative` | src/services/arcTrackingService.js | 7 | 192 |
| `generateFollowProfile` | src/services/characterFollowService.js | 127 | 362 |
| `determinesSocialPresence` | src/services/characterGenerationService.js | 256 | 474 |
| `extractGhostCharacters` | src/services/characterGenerationService.js | 425 | 478 |
| `generateBelongingMap` | src/services/characterGenerationService.js | 379 | 477 |
| `generateFamilyTree` | src/services/characterGenerationService.js | 333 | 476 |
| `generateFeedProfile` | src/services/characterGenerationService.js | 289 | 475 |
| `generateInteriorArchitecture` | src/services/characterGenerationService.js | 212 | 473 |
| `calculateAutoState` | src/services/characterSyncService.js | 14 | 280 |
| `gatherEpisodeContext` | src/services/distributionService.js | 65 | 313 |
| `analyzeProse` | src/services/emotionalImpact.js | 50 | 226 |
| `applyShifts` | src/services/emotionalImpact.js | 121 | 227 |
| `processChapterProse` | src/services/emotionalImpact.js | 141 | 228 |
| `computeSocialTaskBonuses` | src/services/episodeCompletionService.js | 32 | 590 |
| `computeWardrobeBonuses` | src/services/episodeCompletionService.js | 72 | 591 |
| `calculateFinancials` | src/services/episodeGeneratorService.js | 294 | 907 |
| `inferArchetype` | src/services/episodeGeneratorService.js | 272 | 908 |
| `inferIntent` | src/services/episodeGeneratorService.js | 284 | 909 |
| `renderScriptText` | src/services/episodeScriptWriterService.js | 774 | 802 |
| `findHostProfile` | src/services/eventAutomationService.js | 106 | 659 |
| `generateEventName` | src/services/eventAutomationService.js | 456 | 663 |
| `calculateVelocity` | src/services/feedEngagementService.js | 48 | 407 |
| `generateUniqueVenue` | src/services/feedEventPipelineService.js | 169 | 756 |
| `pickVenue` | src/services/feedEventPipelineService.js | 158 | 755 |
| `generateBStoryActivity` | src/services/feedMomentsService.js | 353 | 403 |
| `resolveLalaProfile` | src/services/financialFeedService.js | 56 | 171 |
| `logTransaction` | src/services/financialPressureService.js | 190 | 221 |
| `checkMilestones` | src/services/financialTransactionService.js | 200 | 628 |
| `markGoalTriggered` | src/services/financialTransactionService.js | 165 | 627 |
| `generateDallE` | src/services/imageGenerationService.js | 259 | 349 |
| `generateFlux` | src/services/imageGenerationService.js | 135 | 348 |
| `getImageBudgetStatus` | src/services/imageGenerationService.js | 95 | 351 |
| `getProvider` | src/services/imageGenerationService.js | 57 | 350 |
| `processVideoThumbnail` | src/services/ImageProcessingService.js | 161 | 228 |
| `queueImageProcessing` | src/services/ImageProcessingService.js | 172 | 229 |
| `checkRateLimit` | src/services/imageRestyleService.js | 37 | 235 |
| `checkRateLimit` | src/services/inpaintingService.js | 117 | 898 |
| `checkFonts` | src/services/invitationCompositingService.js | 155 | 623 |
| `buildBackgroundPrompt` | src/services/invitationGeneratorService.js | 92 | 458 |
| `sendEmail` | src/services/notifications.js | 47 | 338 |
| `checkRateLimit` | src/services/objectGenerationService.js | 46 | 342 |
| `validateZoneRules` | src/services/phoneConditionSchema.js | 90 | 173 |
| `evaluateMission` | src/services/phoneRuntime.js | 189 | 167 |
| `evaluateMissions` | src/services/phoneRuntime.js | 216 | 168 |
| `evaluateOne` | src/services/phoneRuntime.js | 37 | 161 |
| `filterContentItems` | src/services/phoneRuntime.js | 144 | 165 |
| `filterZones` | src/services/phoneRuntime.js | 131 | 164 |
| `resolveKey` | src/services/phoneRuntime.js | 64 | 166 |
| `renderPhoneScreen` | src/services/phoneScreenRenderer.js | 34 | 296 |
| `formatMultiBlockSystem` | src/services/promptCacheHelper.js | 58 | 116 |
| `isWorthCaching` | src/services/promptCacheHelper.js | 91 | 118 |
| `smartCacheSystemPrompt` | src/services/promptCacheHelper.js | 105 | 119 |
| `withCaching` | src/services/promptCacheHelper.js | 75 | 117 |
| `getEffectiveStyleGuide` | src/services/propertyService.js | 255 | 309 |
| `validateRoomConnections` | src/services/propertyService.js | 278 | 310 |
| `generateSocialLeverage` | src/services/registrySyncService.js | 20 | 209 |
| `isClothingCategory` | src/services/removeBgParams.js | 23 | 41 |
| `generateSceneProposal` | src/services/rippleEngine.js | 155 | 211 |
| `applyMoodVariant` | src/services/sceneGenerationService.js | 1108 | 1869 |
| `checkAngleConsistency` | src/services/sceneGenerationService.js | 979 | 1866 |
| `cropReferenceRegion` | src/services/sceneGenerationService.js | 1205 | 1867 |
| `extractFirstFrame` | src/services/sceneGenerationService.js | 807 | 1876 |
| `generateBestVariation` | src/services/sceneGenerationService.js | 555 | 1875 |
| `generateDepthMap` | src/services/sceneGenerationService.js | 1266 | 1868 |
| `storeBufferInS3` | src/services/sceneGenerationService.js | 611 | 1879 |
| `storeInS3` | src/services/sceneGenerationService.js | 581 | 1878 |
| `getValidationPrompt` | src/services/sceneSpecService.js | 357 | 517 |
| `suggestNextOutcome` | src/services/seasonRhythmValidator.js | 329 | 348 |
| `segmentWithPoints` | src/services/segmentationService.js | 220 | 676 |
| `uploadChecklist` | src/services/socialChecklistService.js | 234 | 352 |
| `createWorldTimelineEvents` | src/services/storyEnrichmentService.js | 346 | 419 |
| `extractContinuityBeats` | src/services/storyEnrichmentService.js | 88 | 416 |
| `updateCharacterArcs` | src/services/storyEnrichmentService.js | 194 | 417 |
| `updateStoryThreads` | src/services/storyEnrichmentService.js | 224 | 418 |
| `isAftermathEligible` | src/services/textureLayerService.js | 73 | 737 |
| `isMomToneEligible` | src/services/textureLayerService.js | 63 | 736 |
| `checkAllThresholds` | src/services/thresholdDetection.js | 251 | 378 |
| `clearWaitingSession` | src/services/thresholdDetection.js | 343 | 380 |
| `detectJustAwomanMoment` | src/services/thresholdDetection.js | 356 | 381 |
| `getWaitingSessions` | src/services/thresholdDetection.js | 332 | 379 |
| `findFirstSceneId` | src/services/timelinePlacementService.js | 31 | 168 |
| `generateCareerTasks` | src/services/todoListService.js | 607 | 725 |
| `getCustomOverlayTypes` | src/services/uiOverlayService.js | 68 | 453 |
| `getShowOverlays` | src/services/uiOverlayService.js | 378 | 454 |
| `buildVenueIdentity` | src/services/venueGenerationService.js | 24 | 237 |
| `autoCenterCrop` | src/services/wardrobeImageService.js | 432 | 1155 |
| `enhanceTexture` | src/services/wardrobeImageService.js | 602 | 1157 |
| `generateBackdropVariants` | src/services/wardrobeImageService.js | 1126 | 1169 |
| `normalizeColors` | src/services/wardrobeImageService.js | 523 | 1156 |
| `suggestTags` | src/services/wardrobeImageService.js | 740 | 1161 |
| `buildScriptContext` | src/services/wardrobeIntelligenceService.js | 1024 | 1078 |
| `getTemperatureLabel` | src/services/worldTemperatureService.js | 247 | 367 |

---

## 4. Tier ii — unreached constants, schemas, and other exported data (zero hits in src/ and tests/)

49 entries.

| Name | File | Def line | Export line |
|---|---|---|---|
| `MAX_FILE_SIZE` | src/middleware/fileValidation.js | 25 | 275 |
| `MAX_FILE_SIZE_IMAGE` | src/middleware/fileValidation.js | 26 | 276 |
| `PERMISSIONS` | src/middleware/rbac.js | 16 | 211 |
| `ROLES` | src/middleware/rbac.js | 10 | 210 |
| `DAILY_BUDGET` | src/services/aiCostTracker.js | 106 | 252 |
| `MODEL_PRICING` | src/services/aiCostTracker.js | 24 | 252 |
| `HAIKU` | src/services/aiModelRouter.js | 22 | 79 |
| `HAIKU_TASK_TYPES` | src/services/aiModelRouter.js | 26 | 79 |
| `SONNET` | src/services/aiModelRouter.js | 23 | 79 |
| `SONNET_TASK_TYPES` | src/services/aiModelRouter.js | 37 | 79 |
| `CONSUMPTION_STYLES` | src/services/characterFollowService.js | 26 | 369 |
| `CONTENT_CATEGORIES` | src/services/characterFollowService.js | 7 | 366 |
| `CREATOR_ARCHETYPES` | src/services/characterFollowService.js | 16 | 367 |
| `FOLLOW_MOTIVATIONS` | src/services/characterFollowService.js | 23 | 368 |
| `PLATFORM_SPECS` | src/services/distributionService.js | 24 | 312 |
| `BEAT_TEMPLATES` | src/services/episodeGeneratorService.js | 253 | 913 |
| `CATEGORY_TASKS` | src/services/episodeGeneratorService.js | 119 | 912 |
| `PLATFORM_TASKS` | src/services/episodeGeneratorService.js | 84 | 911 |
| `SOCIAL_TASK_TEMPLATES` | src/services/episodeGeneratorService.js | 21 | 910 |
| `CATEGORY_TO_CONTENT` | src/services/eventAutomationService.js | 23 | 665 |
| `CATEGORY_TO_VENUE` | src/services/eventAutomationService.js | 37 | 666 |
| `EVENT_TEMPLATES` | src/services/eventAutomationService.js | 49 | 667 |
| `POST_TEMPLATES` | src/services/feedActivityService.js | 18 | 116 |
| `VIRAL_THRESHOLDS` | src/services/feedEngagementService.js | 21 | 406 |
| `EVENT_TYPE_CONFIGS` | src/services/feedEventPipelineService.js | 21 | 754 |
| `BEAT_PHONE_MOMENTS` | src/services/feedMomentsService.js | 57 | 405 |
| `CONTENT_LENSES` | src/services/feedMomentsService.js | 23 | 404 |
| `BRAND_PALETTE` | src/services/financialFrameGeneratorService.js | 23 | 137 |
| `MAX_CALLS_PER_OP` | src/services/imageGenerationService.js | 69 | 352 |
| `USE_CASE_PROVIDERS` | src/services/imageGenerationService.js | 40 | 353 |
| `THUMBNAIL_SIZES` | src/services/ImageProcessingService.js | 30 | 230 |
| `actionsArraySchema` | src/services/phoneConditionSchema.js | 81 | 172 |
| `actionSchema` | src/services/phoneConditionSchema.js | 69 | 171 |
| `CONDITION_OPS` | src/services/phoneConditionSchema.js | 23 | 167 |
| `conditionsArraySchema` | src/services/phoneConditionSchema.js | 36 | 170 |
| `conditionSchema` | src/services/phoneConditionSchema.js | 29 | 169 |
| `missionPayloadSchema` | src/services/phoneConditionSchema.js | 145 | 176 |
| `objectiveSchema` | src/services/phoneConditionSchema.js | 139 | 175 |
| `ROOM_TEMPLATES` | src/services/propertyService.js | 17 | 302 |
| `STYLE_PRESETS` | src/services/propertyService.js | 104 | 303 |
| `MOOD_PRESETS` | src/services/sceneGenerationService.js | 1044 | 1871 |
| `BEAT_STRUCTURE` | src/services/scenePlannerService.js | 22 | 300 |
| `SPEC_VERSION` | src/services/sceneSpecService.js | 5 | 520 |
| `FORMAT_SPECS` | src/services/storyGenerationService.js | 20 | 252 |
| `WOUND_THRESHOLDS` | src/services/thresholdDetection.js | 54 | 382 |
| `BACKDROP_CANVAS_H` | src/services/wardrobeImageService.js | 1058 | 1171 |
| `BACKDROP_CANVAS_W` | src/services/wardrobeImageService.js | 1057 | 1170 |
| `BACKDROP_PALETTE` | src/services/wardrobeImageService.js | 1066 | 1172 |
| `TEMPERATURE_LABELS` | src/services/worldTemperatureService.js | 24 | 368 |

---

## 5. Tier iii — functions and middleware reached only by their own test file (zero hits in src/)

25 entries.

| Name | File | Def line | Export line |
|---|---|---|---|
| `auditLog` | src/middleware/auditLog.js | 102 | 255 |
| `getActionType` | src/middleware/auditLog.js | 12 | 258 |
| `getResourceInfo` | src/middleware/auditLog.js | 26 | 259 |
| `ApiError` | src/middleware/errorHandler.js | 9 | 286 |
| `ForbiddenError` | src/middleware/errorHandler.js | 74 | 290 |
| `ServiceUnavailableError` | src/middleware/errorHandler.js | 92 | 292 |
| `UnauthorizedError` | src/middleware/errorHandler.js | 65 | 289 |
| `checkStorageQuota` | src/middleware/fileValidation.js | 221 | 272 |
| `validateBatchFileUpload` | src/middleware/fileValidation.js | 115 | 271 |
| `validateFileUpload` | src/middleware/fileValidation.js | 31 | 270 |
| `optionalJWTAuth` | src/middleware/jwtAuth.js | 75 | 176 |
| `authorize` | src/middleware/rbac.js | 83 | 214 |
| `requireRole` | src/middleware/rbac.js | 113 | 215 |
| `sanitizeString` | src/middleware/requestValidation.js | 17 | 328 |
| `validateEmail` | src/middleware/requestValidation.js | 7 | 326 |
| `validateUUID` | src/middleware/requestValidation.js | 12 | 327 |
| `cloudinaryEnhanceStill` | src/services/postProcessingService.js | 111 | 369 |
| `ffmpegEnhanceVideo` | src/services/postProcessingService.js | 172 | 370 |
| `sharpEnhanceStill` | src/services/postProcessingService.js | 45 | 368 |
| `detectPhone` | src/services/textureLayerService.js | 111 | 734 |
| `isConflictEligible` | src/services/textureLayerService.js | 86 | 735 |
| `isPostPosition` | src/services/textureLayerService.js | 106 | 739 |
| `isPrivateMomentPosition` | src/services/textureLayerService.js | 100 | 738 |
| `generateTestToken` | src/services/tokenService.js | 184 | 215 |
| `generateToken` | src/services/tokenService.js | 20 | 210 |

---

## 6. Tier iv — constants and data reached only by their own test file

9 entries.

| Name | File | Def line | Export line |
|---|---|---|---|
| `validateRequest` | src/middleware/errorHandler.js | 193 | 296 |
| `ALLOWED_EXTENSIONS` | src/middleware/fileValidation.js | 10 | 274 |
| `ALLOWED_FILE_TYPES` | src/middleware/fileValidation.js | 4 | 273 |
| `SEVERITY_WEIGHTS` | src/services/artifactDetectionService.js | 84 | 283 |
| `ANGLE_MODIFIERS` | src/services/sceneGenerationService.js | 48 | 1882 |
| `CAMERA_MOTION_MAP` | src/services/sceneGenerationService.js | 63 | 1883 |
| `LALAVERSE_VISUAL_ANCHOR` | src/services/sceneGenerationService.js | 40 | 1880 |
| `VIDEO_DURATION_MAP` | src/services/sceneGenerationService.js | 78 | 1884 |
| `VIDEO_MOVEMENT_MODIFIERS` | src/services/sceneGenerationService.js | 96 | 1885 |

---

## 7. Whole-module results (separate unit from the per-name tiers above)

A singleton or default export (`module.exports = new X()`, `module.exports = X`) has no per-name grep — the file itself is the unit, and reach was established by resolving every `require(...)` in `src/` and `tests/` to a file path and checking whether any resolves to the file in question (method in §1.3; this is stricter than the per-name raw grep because these names are frequently common English words).

38 whole-module files in `src/services/` + `src/middleware/`.

**Never required anywhere (src/ or tests/) — 2:**

| File | Export line |
|---|---|
| `src/services/sceneIdentityService.js` | 238 |
| `src/services/sqsService.js` | 127 |

Confirmed by direct check — the only other repo-wide mention of either name is a code comment, not a require:
```
$ grep -rn "sceneIdentityService\|sqsService" src tests --include='*.js' | grep -v "src/services/sceneIdentityService.js:\|src/services/sqsService.js:"
src/services/sceneTypePriors.js:4: * Scene-Type Priors — shared by sceneIdentityService (extraction) and
```

**Required only from its own test file, never from src/ — 1:**

| File | Export line | Required by |
|---|---|---|
| `src/middleware/asyncHandler.js` | 34 | `tests/unit/middleware/asyncHandler.test.js` |

This is the case described in §1.3: every route file that appears to use `asyncHandler` requires it from `src/middleware/errorHandler.js` instead (`const { asyncHandler } = require('../middleware/errorHandler')` — e.g. `src/routes/scenes.js:5`), which has its own independent `asyncHandler` definition (`errorHandler.js:182`, exported at `errorHandler.js:295`, and already counted separately in tier iii above). `src/middleware/asyncHandler.js`'s own export is a second, unrelated implementation that only its own unit test ever requires.

**Required from src/ — 35 files, not listed** (this note reports what's unreached, not what's fine).

---

## 8. Shadowed route registrations

Every `router.<method>('<path>'` registration in source order was extracted from all 142 files under `src/routes/` (recursive, includes `src/routes/memories/`), and any method+path registered more than once inside the same file was flagged. The extraction pattern allows whitespace — including a newline — between the method's opening paren and the path string (`router\.(get|post|put|patch|delete|all|use)\(\s*['"]([^'"]*)['"]`, where `\s` matches `\n`), so a registration whose call is wrapped across lines (`router.get(\n  '/path',\n  ...)`) is still captured with its path. **This is a method detail that matters, not just an implementation footnote:** a registration regex anchored to a single line — one that requires the path's opening quote on the same line as `router.<method>(` — will silently skip any wrapped call and undercount duplicates. §10 below names a specific case where that distinction changes the result.

```
$ grep -n "router\.put(\s*'/:id'" src/routes/compositions.js
476:router.put('/:id', authenticateJWT, async (req, res) => {
813:router.put('/:id', authenticateJWT, async (req, res) => {

$ grep -n "'/episode/:episodeId'" src/routes/thumbnails.js
65:router.get('/episode/:episodeId', optionalAuth, asyncHandler(thumbnailController.getEpisodeThumbnails));
137:  '/episode/:episodeId',
```
(the second registration's `router.get(` call opens at line 136, one line above the path argument shown at 137 — this one wraps its arguments across lines, unlike the first.)

Before calling either registration below dead: both files were confirmed to declare exactly one `Router()` (`grep -c "Router()" <file>` → 1 in each) and to be mounted exactly once in `src/app.js`:

```
$ grep -n "compositions" src/app.js
455:const compositionRoutes = trackRouteLoad('compositions', () => require('./routes/compositions'));
689:app.use('/api/v1/compositions', compositionRoutes);

$ grep -n "thumbnails" src/app.js
436:const thumbnailRoutes = trackRouteLoad('thumbnails', () => require('./routes/thumbnails'));
641:app.use('/api/v1/thumbnails', thumbnailRoutes);
```

Single router, single mount confirmed for both — neither is cannot-tell.

| File | Method + path | Registrations (line) | Express reaches | Shadowed |
|---|---|---|---|---|
| `src/routes/compositions.js` | `PUT /:id` | 476, 813 | line 476 ("Update composition config (increments version)") | line 813 ("Edit/update existing composition") — this is the known case from #1453/#1454's issue text |
| `src/routes/thumbnails.js` | `GET /episode/:episodeId` | 65, 136 | line 65 (`thumbnailController.getEpisodeThumbnails`) | line 136 ("Get thumbnails by episode (new method for gallery)", calls `ThumbnailService.getThumbnailsByEpisode`) — not previously known |

Both shadowed handlers are unreachable Express dispatch to the first registered match for an identical method+path and neither earlier handler calls `next()` on a normal response path (both `res.json(...)` and return).

No other file among the 142 had a duplicate method+path registration.

---

## 9. Counts

| Category | Count |
|---|---|
| Tier i — unreached function/middleware | 103 |
| Tier ii — unreached constant/data | 49 |
| Tier iii — function/middleware, test-only reach | 25 |
| Tier iv — constant/data, test-only reach | 9 |
| **Named-export tiers, total** | **186** (of 419 named exports checked) |
| Whole-module, never required | 2 |
| Whole-module, test-only required | 1 |
| **Whole-module tiers, total** | **3** (of 38 whole-module exports checked) |
| Route files with a shadowed method+path registration | 2 |
| **All findings across every category** | **191** |

**The five known cases as a fraction:**
- Of the 186 named-export tier entries: 4 of the five are named exports (`logTransaction` and `jwtAuth.js`'s `requireRole` in tier i; `optionalJWTAuth` and `rbac.js`'s `requireRole` in tier iii) → **4/186 ≈ 2.2%**.
- Of the 2 route-duplicate files: 1 of the five (`compositions.js`) → **1/2 = 50%**.
- Of all 191 findings in this note: **5/191 ≈ 2.6%**.

The known five are a small fraction of what a from-scratch, corrected sweep turns up; the large majority — 186 of 191 findings — is new at this basis.

---

## 10. Differences from #1453

Issue #1453 has no report on the record at this basis: `mcp__github__issue_read` (method `get_comments`) on #1453 returns an empty list, and no pull request exists for its branch (`mcp__github__list_pull_requests`, filtered to `head: claude/issue-1453-unreachable-code-sweep`, returns empty), checked again as of this basis. Evoni has relayed a summary of that session in conversation — three headline numbers (169 named-export findings, one shadowed-route file, six traced collisions) — but that summary is a session record, not a pasteable command-and-output artifact, and this note does not treat it as MEASURED. What follows is this sweep's own numbers and method, with the three specific points Evoni raised addressed against them directly, not reconciled set-against-set against figures that can't be checked from here.

**1. Shadowed-route count: 2 files here, versus 1 reported.** This sweep's own method (§8) explains the gap without needing #1453's working: the second file, `src/routes/thumbnails.js`, has its `GET /episode/:episodeId` duplicate's second registration wrapped across lines —

```
136: router.get(
137:   '/episode/:episodeId',
138:   optionalAuth,
```

— while the first registration is on one line (`src/routes/thumbnails.js:65`). This sweep's extraction pattern tolerates the newline between `router.get(` and the path string; a registration regex anchored to require the path on the same line as the method call would match line 65 but never see line 136, and would report `compositions.js` as the only duplicate across all 142 route files without knowing it had skipped a shape of registration it couldn't parse. Re-verified directly against the file (`express.Router()` once at line 2, `module.exports = router` once at the tail, `app.use('/api/v1/thumbnails', ...)` once in `src/app.js`) — single-router, single-mount, not cannot-tell. If #1453 used a single-line-anchored pattern, "132/132 files, one duplicate" was an undercount stated with more confidence than the method supported; there is no way to confirm that from here, only to show this sweep's own pattern does not have that blind spot.

**2. Collision-trace count: 26 status changes here, versus 6 reported.** The 26 in §1.3 is already a status-change count, not a raw appears-twice count — it is incremented only when a name's traced reach (post-require-trace) differs from its raw reach (pre-trace), which by construction can only ever move a name from "raw-reached" to "unreached," never the other way. Of the 26, several are collisions across more than two files: `checkRateLimit` alone is independently defined five times (`src/services/imageRestyleService.js:37`, `src/services/inpaintingService.js:117`, `src/services/objectGenerationService.js:46`, `src/routes/socialProfileRoutes.js:273`, `src/services/depthEstimationService.js:44` — each confirmed by reading its own definition, not by name alone) and every one of the raw hits against each of the first three resolves to one of the other four, not to the file being checked. If #1453's trace found six, either its collision surface was narrower by construction (checked fewer names, or stopped at the first confirmed collision per name instead of tracing every raw hit) or it used a different definition of "changed status" — that distinction is exactly the thing its working would need to show, and it isn't on the record to check.

**3. The five known cases: agreement, not a third reading.** §2 already places `optionalJWTAuth` and `rbac.js`'s `requireRole` in tier iii (reached only by their own unit test) rather than tier i (fully unreached). Evoni's account of #1453 also found both reached by their own tests. That reads as the same underlying fact — src-vs-test reach — surfaced by both sweeps; this note's tier split (§1.4) is what gives it a name (tier iii, not tier i) rather than leaving it as an unlabeled "reached" that could be misread as fully wired in.

None of the above is a claim that #1453 was wrong in a way this note can prove — only that its numbers can't be checked from this repository state, while every number in this note can be, by the commands pasted alongside it.

---

## 11. Closing

This note is a measurement, not a disposition. It mints no FD number, no XK entry, and no PE roster line. It rules nothing. It recommends no removal, consolidation, or rename for any entry in any tier, in the whole-module results, or in the shadowed-registration table — a removal is a separate decision to be made per item, by Evoni, outside this note. No entry here should be read as "safe to delete": several entries are dead by construction (the shadowed route registrations, the `logTransaction`/`requireRole` name collisions) but even those are reported as what they are, not as what to do about them.

---

**Type:** standalone MEASURED note. **Mints:** nothing. **Rules:** nothing. **Host/AWS/DB/Cognito contact:** none — this note is a static read of the checked-out working tree only. **Prod FROZEN** (per Audit Handoff v26 Sec 3.2, unchanged from v25 Sec 3.4 — re-confirmed at wake-up this session, not carried from memory).
