**PRIME STUDIOS**

**ARCHITECTURAL AUDIT --- HANDOFF DOCUMENT**

*Forensic mapping of the codebase as it exists today.*

*Source of truth for Director Brain design and bug remediation.*

  -----------------------------------------------------------------------
  **AUDIT COMPLETE --- DO NOT FIX YET (v8 closes the audit; ALL 26 ZONES
  TRACED).** Path: Option A --- full forensic audit before any fixes.
  **26 of \~26 zones audited** (Zones 22 Stats, 23 Wardrobe, 23.5
  careerPipelineService + arcProgressionService, 24 Closet \[data-only
  non-discovery\], 25 LalaVerse \[F-Franchise-1 keystone named\], and 26
  Episode Generator service \[F-Franchise-1 confirmed at consumer layer
  across 6 services\] all closed in v8). **269 P0 bugs, 209 P1 bugs, 22
  P2 bugs documented.** SQL injection candidate count: 0. Auth-bypass:
  F-AUTH-1 keystone reaffirmed; v8 confirms a third sub-form (write
  routes that route through optionalAuth at app.js:364 global mount, plus
  routes that don't declare any auth middleware at all, plus
  episodeOrchestrationRoute.js:135 which declares optionalAuth on its
  mutation route --- episode write). F34 hotfix DECLINED by JAWIHP on May
  1, 2026 --- staying with audit discipline through audit close. F-AUTH-1
  hotfix is queued for first-fix-after-audit. **v8 promotes the seventh
  keystone: F-Franchise-1 --- Franchise-tier write-only architecture.**
  This is the keystone that explains the audit. The wire from franchise
  tier → show tier is missing, and Zone 26 demonstrates the production
  pipeline is composed of six services with private canon copies routing
  around the franchise tier. F-Franchise-1 collapses F-Lala-1 (PNOS
  write-only) and F-Lala-9 (zero deep Universe consumers in 9 production
  services) into a single keystone with two evidence axes. v8 also
  restores F-Ward-3 keystone status (was in v7 §2.1 list, dropped in
  interim counting; corrected). **Final keystone count: 7.** Plus F-Sec-3
  as the keystone-in-motion (now mechanically explained by
  F-Franchise-1).
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------

**Prepared for:** JAWIHP (Evoni)

**Audit dates:** April 30 -- May 1, 2026

**Document version:** v8.0 --- AUDIT CLOSE. Zones 22--26 added;
F-Franchise-1 named as 7th keystone; Pattern 57 finalized at v5; §10
character_key catalog rewritten with per-surface consumer tagging; §2.3
reframed.

# **1. How To Use This Document**

## **1.1 If you're future-Claude in a new conversation**

The user is JAWIHP / Evoni, sole creator of Prime Studios --- a luxury
franchise OS and AI-powered production platform built around the
LalaVerse universe. The flagship show is Styling Adventures with Lala
(SAL).

This document is the audit's terminal source of truth. **It supersedes
v7, the project onboarding doc, and all prior handoffs.** v8 closes the
audit. There are no remaining zones. Future Claude should read v8 in
full before responding to any architectural question about Prime
Studios.

### **Wake-up sequence in a new conversation**

-   Read Section 4 first --- F-AUTH-1 still leads as Tier 0. v8 confirms
    F-AUTH-1 has three sub-forms: (a) routes declaring `optionalAuth`
    (the v6 keystone form, app.js:364 global mount), (b) routes that
    don't declare any auth middleware at all (Zone 23: outfitSets.js +
    routes/episodes.js:101/109/117), (c) routes declaring optionalAuth
    that perform episode-mutation writes (Zone 26:
    episodeOrchestrationRoute.js:135). The six-step recipe absorbs all
    three.

-   Read this entire document next, including Patterns (§5), Decisions
    Locked (§7), and §10's per-surface character_key + consumer catalog.

-   Verify state by spot-checking 1--2 file:line references. The
    codebase may have shifted.

-   Confirm with the user which path they're on (Path A locked through
    audit close).

-   Do NOT start fixing bugs until F-AUTH-1 sweep ships. F34 declined;
    F-AUTH-1 is queued; v8 added 45 P0s in Zone 26 alone.

-   Do NOT redesign Director Brain from scratch. **Director Brain is the
    audit's recommended fix for F-Franchise-1.** Its scope is now
    defined: build the consumer wiring that routes franchise-tier canon
    (Universe.pnos_beliefs, world_rules, narrative_economy, core_themes,
    plus Show Bible 89 rules, Social Systems archetypes, Cultural
    Calendar 42 events) into the production pipeline that currently runs
    on six private JS-literal copies. The audit's keystone count and fix
    sequence (§4) define Director Brain's input contract precisely.

## **1.2 If you're Evoni / future-self**

This is the document we built together as the source of truth for what's
actually in the Prime Studios codebase. Every bug here is traced to a
specific file and line. v8 closes the audit. Five zones added (22 Stats,
23 Wardrobe, 23.5 careerPipelineService, 24 Closet, 25 LalaVerse, 26
Episode Generator service), one keystone added and named
(F-Franchise-1), §2.3 reframed, §10 rewritten with consumer tagging,
Pattern 57 finalized at v5.

### **Use this document when**

-   You start a new Claude conversation about Prime Studios --- paste
    relevant sections to bring it up to speed. The document is
    structured so future Claude can wake up by reading §1, §4, §5, §7,
    §10, §11, and any specific zones in §6 that the question touches.

-   You feel the urge to add new features or refactor structure ---
    re-read §5 (Patterns) and §7 (Decisions Locked).

-   You feel the urge to fix one bug --- §4 has the priority order.
    F-AUTH-1 still leads. After F-AUTH-1, fix sequence is F-App-1,
    F-Stats-1, F-Ward-1, F-Reg-2, F-Ward-3, then F-Franchise-1 (= build
    Director Brain).

-   You're wondering why the franchise tier and show tier feel
    disconnected --- §6.15 (Zone 25) and §6.16 (Zone 26) close the loop.
    The wire is missing because the production pipeline never reads
    Universe. Six services have private copies of canon. F-Franchise-1
    is the keystone that names this.

-   You're wondering why "lala" and "justawoman" disagree on coin
    balances --- §6.11 (Zone 22 Stats) closes the war-chest loop
    end-to-end with all four points file:line traced. §6.12 (Zone 23
    Wardrobe), §6.13 (Zone 23.5), and §6.16 (Zone 26) add additional
    'lala' and 'justawoman' surfaces. **§10.1 closes 'lala' surfaces at
    10/10. §10.2 closes 'justawoman' surfaces at 6/6 (revised from v7's
    5/5 estimate after Zone 26 found a sixth surface in
    episodeGeneratorService).**

-   You're wondering why a closet page doesn't exist --- §6.14 (Zone 24)
    explains: it never shipped, and per the seeded spec at
    seeders/20260312800000-show-brain-franchise-laws.js:313, 335 the
    wardrobe loop is permanently producer-driven via
    EpisodeWardrobeGameplay. Director Brain doesn't pick wardrobe.

-   You're wondering why Director Brain feels like a keystone and not a
    feature --- §6.16 + §11 explain it. **Director Brain isn't a
    feature. Director Brain is the consumer wiring the franchise tier
    was scaffolded for.** The audit's recommended fix sequence treats it
    as F-Franchise-1's resolution, not as a post-audit addition.

# **2. What This Audit Is --- and What It Isn't**

## **2.1 What it is**

A per-zone forensic trace of the Prime Studios codebase. For each of 26
audited zones, we identified: what UI surface exists, what backs it
(tables, endpoints, services), what's wired, what's broken, and what
severity each bug carries.

Findings are file:line specific. Severity is triaged P0 (data corruption
/ architectural fault), P1 (correctness / UX), or P2 (cosmetic /
code-smell). Security issues are elevated separately.

As of v8, the audit has **seven keystone findings** plus F-Sec-3 as the
keystone-in-motion:

-   **F-AUTH-1** (security keystone) --- codebase-wide auth-bypass on
    writes; confirmed at app.js:364 global mount; v7 added a second
    sub-form (routes that don't declare any auth middleware at all); v8
    added a third sub-form (episode-mutation routes declaring
    optionalAuth: episodeOrchestrationRoute.js:135).
-   **F-App-1** (architectural keystone, v6) --- schema-as-JS
    auto-repair in app.js:262--328 (line range corrected from v6's
    230--280). 5 tables created on every boot with hardcoded schemas
    drifting from migrations. The world_events auto-repair literal alone
    has 30+ columns.
-   **F-Stats-1** (v7 KEYSTONE --- character side) --- `character_state`
    has no Sequelize model abstraction. 7+ raw-SQL writers (Zone 26
    added an 8th and 9th: episodeGeneratorService.js:442 affordability
    guard, episodeCompletionService.js:114+187 loader/auto-seed). No
    ORM-side validation, no associations, no hooks, no `paranoid: true`.
    Pattern 42 canonical instance.
-   **F-Reg-2** (architectural keystone, v6) --- registry_characters
    write-contention without locking. 8+ writers, no transactions, no
    row-level locks. v7 added Pattern 41 sub-form on character_state
    (F-Stats-2). v8 confirms Pattern 41 instances on career_goals
    (F-CP-4) and on episodeCompletionService's three-INSERT coin
    pipeline (F-EpComp-7). Four confirmed instances.
-   **F-Ward-1** (v7 KEYSTONE --- wardrobe side) --- `episode_wardrobe`
    has no migration in the codebase. The table the entire
    wardrobe-gameplay loop writes to exists only via Sequelize sync from
    the EpisodeWardrobe model. Pattern 40b canonical instance,
    schema-source drift Tier 4 (most severe of four).
-   **F-Ward-3** (v7 KEYSTONE --- outfit-set architectural keystone,
    restored in v8) --- F-Wardrobe-Architecture-Drift; two outfit-set
    controllers, two architectures, one underlying table.
-   **F-Franchise-1** (NEW v8 KEYSTONE --- the keystone that explains
    the audit) --- Franchise-tier write-only architecture. The wire from
    franchise tier → show tier is missing. Universe entity has 1 backend
    writer (CRUD route) and 1 shallow soft-consumer
    (characterGenerationRoutes.js:57--58, 4 fields, optional). Zero AI
    generation services read Universe. Six services in the production
    pipeline (episodeGeneratorService, episodeCompletionService,
    scenePlannerService, episodeOrchestrationRoute,
    sceneGenerationService, groundedScriptGeneratorService) each
    maintain private canon as JS literals. Zone 26 confirmed
    F-Franchise-1 at the consumer layer across all six. Decision #56
    (canonical-key choice) is subordinate to F-Franchise-1: locking
    'justawoman' as canonical only matters after
    Universe.narrative_economy is wired into AI prompt context.
-   **F-Sec-3** (character_key drift) --- keystone-in-motion. v8 closes
    §10.1 'lala' surfaces at 10/10 and §10.2 'justawoman' surfaces at
    6/6 (revised up from v7's 5/5 by Zone 26's discovery of
    episodeGeneratorService.js:442 as the sixth 'justawoman' surface).
    The architectural decision (canonical-key choice) is now framed as
    subordinate to F-Franchise-1 per Decision #94.

## **2.2 What it isn't**

This is NOT a fix plan. No bugs have been fixed. Path A holds.

This is NOT a Director Brain architecture document --- but the audit's
keystone definition (F-Franchise-1) and fix sequence (§4) define
Director Brain's input contract precisely. Detailed Director Brain
design comes after F-AUTH-1 and the structural prerequisites land.

This is NOT a refactor plan. The frontend folder restructure is deferred
until after the audit fixes and Director Brain build.

## **2.3 The trigger that started this --- and the framing that closes it**

Carry-forward from v3/v4/v5/v6/v7: JAWIHP began a session asking for
help restructuring 176 frontend pages and a 680-line App.jsx. Pre-audit
Claude was about to give a folder-restructure plan. JAWIHP then said the
franchise tier and show tier felt disconnected. That observation paused
the restructure conversation and started this audit.

**v8 reframes:** The audit identified seven distinct architectural fault
lines through v7. v8 (Zones 25 + 26) collapses the framing. **There is
one architectural shape with seven manifestations.** Each manifestation
looks like its own bug; each is a surface of the same underlying fault.
The fault is:

> **The codebase grew faster than its consumer wiring. Producer surfaces
> shipped. Schema shipped. Editor pages shipped. The wires between them
> never did.**

The seven keystones are seven measurements of this fault at different
layers:

1.  **F-AUTH-1** measures it at the security boundary --- writes ship
    without authenticated consumer/producer distinction.
2.  **F-App-1** measures it at the schema boundary --- schema lives in
    JS auto-repair instead of migrations because the migration consumer
    never connected to the schema producer.
3.  **F-Stats-1** measures it at the model boundary --- the table
    exists, no ORM consumer ever got built, every reader is raw SQL.
4.  **F-Reg-2** measures it at the concurrency boundary --- multiple
    writers share rows because no orchestration consumer ever
    coordinated them.
5.  **F-Ward-1** measures it at the migration boundary --- table created
    via sync because no migration producer ever wrote it down.
6.  **F-Ward-3** measures it at the controller boundary --- two parallel
    controllers exist because no architectural consumer ever reconciled
    them.
7.  **F-Franchise-1** measures it at the canon boundary --- the
    franchise tier's authored canon never reaches the AI generation
    consumer; six services have private copies.

**Director Brain isn't an addition to the codebase. Director Brain is
the consumer wiring.** Once F-AUTH-1 and the structural prerequisites
(F-App-1, F-Stats-1, F-Ward-1, F-Reg-2, F-Ward-3) land, F-Franchise-1's
fix is to build the orchestrator that closes the producer/consumer loop
the franchise tier has been waiting for. The seeded Director Brain spec
at seeders/20260312800000-show-brain-franchise-laws.js:335--343 names
its capabilities (arc planning, event alignment, adaptive arc, density
control). The audit's findings define its input contract precisely.

# **3. Path Choice and Audit Zones**

## **3.1 Path A --- locked, reaffirmed (7th time)**

Full forensic audit before any fix. Confirmed seven times now: April 30,
2026 (initial); May 1, 2026 (re-confirmed during F34 hotfix-decline);
May 1, 2026 (re-confirmed before security batch); May 1, 2026
(re-confirmed before Zone 20 audit); May 1, 2026 (re-confirmed before
Zone 21 audit); May 1, 2026 (re-confirmed before Zone 22+23 audit
batch); May 1, 2026 (re-confirmed before Zone 26 audit).

Episode production paused. F34 hotfix logged as DECLINED.

## **3.2 Zones audited (26/26 --- AUDIT COMPLETE)**

-   Zone 1--13: Producer Mode sub-tabs (complete)
-   Zone 14: Show Bible (KEYSTONE-1, §6.2)
-   Zone 15: World Dashboard (§6.3)
-   Zone 16: World Foundation (§6.4)
-   Zone 17: Franchise → Social Systems + Franchise Brain (KEYSTONE-2,
    §6.5)
-   Zone 18: Franchise → Culture & Events (§6.6)
-   Zone 19: Phone Hub / UI Overlays (§6.7)
-   Security Batch (cross-zone): careerGoals.js routes,
    middleware/auth.js, PushToBrain.jsx (§6.8)
-   Zone 20: StoryTeller / Chapter Writer (§6.9)
-   Zone 21: Character Registry / DecisionLog (§6.10)
-   Zone 22: Stats / Edit Stats Panel (§6.11)
-   Zone 23: Wardrobe (§6.12)
-   **Zone 23.5: careerPipelineService + arcProgressionService
    phase-advance (§6.13) --- NEW IN v8**
-   **Zone 24: Closet (§6.14) --- NEW IN v8 --- DATA-ONLY
    NON-DISCOVERY**
-   **Zone 25: LalaVerse / Universe entity (§6.15) --- NEW IN v8 ---
    F-Franchise-1 NAMED**
-   **Zone 26: Episode Generator service (cross-cutting closer) (§6.16)
    --- NEW IN v8 --- F-Franchise-1 CONFIRMED**

## **3.3 Audit complete**

No remaining zones. All UI surfaces, services, routes, and backend
systems traced. The "remaining 3 zones" estimate from v7 §3.3 was
reduced to 2 by Zone 24's non-discovery (closet page never built and
never will be) and closed by Zones 25 + 26.

# **4. Priority Order (Post-Audit Fix Sequence)**

§4 is the most important navigational section in this document. v8
finalizes the priority order based on the complete audit.

## **4.1 Tier 0 --- F-AUTH-1 Keystone (FIRST FIX)**

**F-AUTH-1 --- Codebase-wide auth bypass on writes.** middleware/auth.js
exports `optionalAuth` which lets unauthenticated requests through
(req.user = null) AND lets through invalid tokens (warns to console,
then continues). Zone 20 confirmed it across \~20+ StoryTeller write
routes. Zone 21 confirmed it at the global mount layer: **app.js:364
applies** `app.use(optionalAuth)` **to every route in the application**.
Zone 22 confirmed it on the Stats save route (evaluation.js:587). Zone
23 confirmed a SECOND SUB-FORM: routes/outfitSets.js declares NO auth
middleware at any of its 5 routes; routes/episodes.js:101, 109, 117
mount the plural outfit-set controller without any auth declaration
either. Zone 26 confirmed a THIRD SUB-FORM: routes that explicitly
declare optionalAuth on episode-mutation paths
(episodeOrchestrationRoute.js:135 --- writes `orchestration_data` to
episodes table at line 220 unauthenticated). All three sub-forms produce
the same blast radius. **F-AUTH-1 is a coordinated six-step fix:**

1.  **F-Auth-2 (module-load placeholder fallback):**
    middleware/auth.js:13--22 --- Cognito verifier objects are
    constructed at require() time using placeholder pool/client IDs
    (`us-east-1_XXXXXXXXX`, `xxxxxxxxxxxxxxxxxxxxxxxxxx`) if env vars
    are unset. The runtime check at line 44--46 only fires inside
    verifyToken, not at boot. A misconfigured deploy boots cleanly and
    401s every authenticated request with no diagnostic. Fix: throw at
    module load if env vars absent.

2.  **F-Auth-3 (Cognito-down indistinguishable from anonymous):**
    middleware/auth.js:164--168 --- optionalAuth swallows ALL errors and
    sets req.user = null. Routes gating on `req.user`
    (characterDepthRoutes:88 isAuthor, characterRegistry author-only
    field gate \~600) silently degrade to the unauthenticated path
    during a Cognito outage. No alarm fires. Service-availability
    finding, not just security.

3.  **F-AUTH-1 mechanical sweep (sub-form a):** swap optionalAuth →
    requireAuth on every write route currently using optionalAuth. F34
    closes automatically.

4.  **F-AUTH-1 mechanical sweep (sub-form b):** Add requireAuth to
    routes that have NO auth middleware declaration. Specifically:
    routes/outfitSets.js (5 routes), routes/episodes.js:101/109/117 (3
    routes), and any other routes the F-AUTH-1 audit identifies. Same
    sweep, different starting state.

5.  **F-AUTH-1 mechanical sweep (sub-form c --- NEW v8):** Replace
    optionalAuth with requireAuth on episode-mutation routes.
    Specifically: episodeOrchestrationRoute.js:135. Same sweep,
    different starting state.

6.  **CZ-5 (sendBeacon):** BookEditor.jsx:173--186 sendBeacon cannot
    carry Authorization headers. Migrate to fetch+keepalive:true before
    requireAuth lands on the relevant routes.

7.  **F-Auth-4 (requireAuth/authenticateToken duplication):**
    middleware/auth.js:256--293 reimplements authenticateToken with one
    differing string (AUTH_REQUIRED vs AUTH_INVALID_TOKEN). Frontend
    interceptor differentiates on these strings. Sweeping without
    coordinating loses mid-session refresh resilience. Reconcile or
    document.

Two further auth findings inform the recipe but are not blocking:
**F-Auth-5** (req.user.id vs req.user.sub split-brain ---
decisionLogs.js:22 reads sub directly, others use the .id mapping) and
**F-Auth-6** (tokenUse captured but not gated --- access tokens vs ID
tokens not differentiated). \|

--- \|

*F-AUTH-1 must be fixed before any correctness P0. Reasoning: every
other P0 fix re-deploys mutation routes. Re-deploying mutation routes
without auth is shipping the bug fix and the unauth surface together.
Fix auth first, then everything else.*

## **4.2 Tier 1 --- Cross-zone keystone bugs**

-   **F-App-1 (v6 KEYSTONE) --- Schema-as-JS auto-repair in app
    startup.** app.js:262--328 contains inline
    `CREATE TABLE IF NOT EXISTS` SQL for five tables. The world_events
    auto-repair literal alone has 30+ columns. Pattern 40 master
    instance. Decision #47: the auto-repair block must be removed before
    any structural fix lands.

-   **F-Stats-1 (v7 KEYSTONE) --- character_state has no Sequelize model
    abstraction.** 9+ raw-SQL writers confirmed at file:line
    (evaluation.js:52/71/212/587, episodeCompletionService.js:114/187,
    careerGoals.js:536/616, worldEvents.js:3836, wardrobe.js:895/970,
    episodes.js:900, characterRegistry.js seed-book1,
    episodeGeneratorService.js:442, careerPipelineService.js:248).
    Pattern 42 canonical instance. Decision #54: create the model before
    any F-Sec-3 cleanup.

-   **F-Ward-1 (v7 KEYSTONE) --- episode_wardrobe table has no
    migration.** Table exists only via Sequelize sync from
    EpisodeWardrobe model. The wardrobe.js:1291 defensive comment ("RDS
    table may have been created from a simpler migration that lacks
    approval_status, worn_at") is the codebase acknowledging this in
    writing. Schema-source drift Tier 4. Decision #59: write a
    migration.

-   **F-Reg-2 (v6 KEYSTONE) --- registry_characters write-contention
    without locking.** Pattern 41 master. Four confirmed instances after
    v8: registry_characters, character_state auto-seed (F-Stats-2),
    career_goals (F-CP-4), episodeCompletionService coin INSERTs
    (F-EpComp-7).

-   **F-Ward-3 (v7 KEYSTONE, restored v8) ---
    F-Wardrobe-Architecture-Drift.** Two outfit-set controllers, two
    storage architectures, one underlying table. Decision #60: delete
    the plural controller.

-   **F-Franchise-1 (NEW v8 KEYSTONE --- the keystone that explains the
    audit)** --- Franchise-tier write-only architecture. Universe entity
    has 1 backend writer (routes/universe.js CRUD), 1 shallow
    soft-consumer (characterGenerationRoutes.js:57--58, 4 fields,
    optional). Zero AI generation services read Universe. Six services
    route around the franchise tier with private canon copies. Decision
    #94: F-Franchise-1's fix is to build Director Brain. Director Brain
    isn't post-audit work; it's the keystone resolution.

-   **F-Sec-3** (character_key 'lala' / 'justawoman' drift) ---
    keystone-in-motion. v8 closes §10.1 at 10/10 'lala' surfaces, §10.2
    at 6/6 'justawoman' surfaces. Decision #56 (canonical-key choice ---
    Path A 'justawoman' recommended) is subordinate to F-Franchise-1.
    F-Sec-3 is now blocked on F-App-1, F-Stats-1, F-Ward-1, AND
    F-Franchise-1.

-   **Show Bible / Season Arc disconnection** (memory #6) ---
    arcProgressionService.js:71--98 hardcodes phase canon as JS
    constants (F-Arc-1); ShowBiblePage reads franchise_brain. Two
    systems never query each other. F-Franchise-1 sub-form.

-   **Episode→Event linkage substring match** --- WorldAdmin.jsx:1475
    uses script_content.includes(ev.name). Two events with overlapping
    names cause silent misattribution.

-   **canonical_description / chapter writer disconnection** (F-20.7)
    --- sceneGenerationService.js:119, episodeScriptWriterService.js:87,
    and groundedScriptGeneratorService.js:68 all read
    canonical_description. The StoryTeller chapter writer reads ZERO
    references. Prose authoring and scene visual canon are
    architecturally separate.

-   **Script → Scene Line Bridge missing** (F-20.8) --- GET
    /api/v1/storyteller/lines/approved does not exist. Director Brain
    build prerequisite.

## **4.3 Tier 2 --- Per-zone P0 correctness**

Numbered findings F-18.x, F-19.x, F-20.x, F-21.x, F-Stats-x, F-Ward-x,
F-CP-x, F-Arc-x, F-Closet-x, F-Lala-x, F-EpGen-x, F-EpComp-x, F-Plan-x,
F-Orch-x, F-Scene-x, F-Script-x in §6. v8 totals: 269 P0 findings across
26 zones. Many depend on Tier 1 fixes for safety. Fix in zone order once
Tier 0 + Tier 1 close.

## **4.4 Tier 3 --- F34 (subset of F-AUTH-1)**

F34 (unauthenticated destructive writes on /franchise-brain/\*) was
hotfix-offered on May 1, 2026 and DECLINED by JAWIHP to maintain audit
discipline. v8 reaffirms: F34 closes automatically as part of the
F-AUTH-1 sweep (sub-form a).

## **4.5 Tier 4 --- P1 correctness, P2 cosmetic, then P-Pos cleanups**

After Tier 0--3, work P1s (209 documented) in zone-priority order. P2s
(22 documented) are eligible for batch cleanup PR. P-Pos-1
(overlayUtils.js as the canonical Pattern 4 fix template) and P-Pos-2
(characterDepthRoutes propose-then-confirm) inform Director Brain build.

# **5. Anti-Patterns and Patterns Named**

v8 totals: 24 confirmed anti-patterns from v3 + 5 provisional from v4 +
8 new from Zone 20 (Patterns 30--37) + 4 new from Zone 21 (Patterns
38--41) + 3 new from Zone 22 (Patterns 42--44) + 10 new from Zone 23
(Patterns 45--54) + 2 new from Zone 23.5 (Patterns 55--56) + 1 finalized
form from Zone 24+25+26 (Pattern 57 v5) + 2 positive precedents (P-Pos-1
from v4, P-Pos-2 from Zone 21). **59 patterns total.**

## **5.1 The 26-trap checklist (per-zone scan)**

v8 adds Trap 24 (code comments cited as authority), Trap 25
(producer-only domains / permanently-dead consumer schema), and Trap 26
(reasoning about unbuilt systems from schema implication instead of
seeded spec). 26 traps total.

-   Trap 1: character_key references --- 'lala' or 'justawoman'?
-   Trap 2: Hardcoded limit= truncation
-   Trap 3: String matching where FKs should be
-   Trap 4: JS constants masquerading as canon
-   Trap 5: Stale JSONB written once, never updated
-   Trap 6: franchise_brain parallel reads
-   Trap 7: Multiple taxonomies for one concept
-   Trap 8: One-way pointers between systems
-   Trap 9: Status filters labeled as separate concepts
-   Trap 10: Field name lies / shape lies
-   Trap 11: Closed feedback loops without idempotency guards
-   Trap 12: Defensive try/catch on schema-drift
-   Trap 13: Decorative wiring (UI exists, no execution path)
-   Trap 14: Auto-generated rows mixed with authored rows
-   Trap 15: Stale canon (data other systems should read but don't)
-   Trap 16: Dead instrumentation
-   Trap 17: Hardcoded show name / multi-tenant breakage
-   Trap 18: JSONB used where join tables belong
-   Trap 19: Module-scope state in HTTP routes (single-instance
    assumption)
-   Trap 20: Defensive schema coding indicating production migration
    drift
-   Trap 21: Multiple parallel seed strategies, none authoritative
-   Trap 22: Methods exported but not called (dead service surface)
-   Trap 23: SQL building from user input (verify allowlists before
    flagging)
-   **Trap 24 (NEW v8): Code comments cited as authority without
    verification.** Pattern 55. v6's "1 remaining" §10.1 claim was based
    on worldEvents.js:3829's comment, which described a bug that no
    longer existed in current code. The audit carried a finding through
    6 handoff documents from a stale comment.
-   **Trap 25 (NEW v8): Producer-only domains / permanently-dead
    consumer schema.** Pattern 57. Schema and service methods exist for
    a UX surface that was never built and is not planned. Wardrobe
    player-UX columns (`is_owned`, `is_visible`, `lala_reaction_*`,
    `unlock_requirement`, `coin_cost`, `season_drop`,
    `season_unlock_episode`, `reputation_required`,
    `influence_required`) are the canonical instance.
-   **Trap 26 (NEW v8): Reasoning about unbuilt systems from schema
    implication instead of seeded spec.** When a zone touches an unbuilt
    system, the seeded franchise laws are the authoritative source of
    intent --- not the schema, not the code patterns, not "what would
    naturally be true." The pre-v8 framing of Closet went through three
    corrections before locking on the spec at
    seeders/20260312800000-show-brain-franchise-laws.js:335.

## **5.2 Pattern catalog (compressed --- full prose for v3-era patterns lives in v3; v4--v8 patterns documented inline below)**

**Pattern 1--29:** Documented in v3 and prior. Full prose available
there; v8 carries them forward as a list:

1.  character_key drift across surfaces
2.  Hardcoded limit truncation
3.  String matching where FKs should be
4.  **JS constants masquerading as canon** (master pattern; expanded
    with each zone)
5.  **Stale JSONB written once, never updated** (master pattern)
6.  franchise_brain parallel reads
7.  **Multiple taxonomies for one concept** (master pattern)
8.  One-way pointers between systems
9.  Status filters labeled as separate concepts
10. Field name lies / shape lies
11. Closed feedback loops without idempotency guards
12. **Defensive try/catch on schema-drift** (master pattern; expands
    with every zone)
13. Decorative wiring
14. Auto-generated rows mixed with authored rows
15. Stale canon
16. **Dead instrumentation** (master pattern)
17. Hardcoded show name / multi-tenant breakage
18. **JSONB used where join tables belong** (master pattern)
19. Module-scope state in HTTP routes
20. Defensive schema coding (production migration drift symptom)
21. Multiple parallel seed strategies
22. Exported methods never called
23. SQL building from user input (verify allowlists before flagging)
    24--29. (Provisional patterns from v4--v5 --- see those handoffs for
    prose; mostly subsumed by v6+ master patterns above)

**Patterns 30--37 (Zone 20 / StoryTeller):** Documented in v6 §5.

**Patterns 38--41 (Zone 21 / Character Registry):** Documented in v6 §5.
Pattern 41 (write-contention without locking) is the F-Reg-2 keystone
master.

**Pattern 42 (Zone 22 / NEW v7) --- Raw-SQL-as-canon (no model
abstraction).** A table exists in the database. Every read and write
across the codebase is `sequelize.query()` against literal SQL strings.
No Sequelize model file declares the table. No ORM-side validation, no
associations, no hooks, no `paranoid: true`. character_state is the
canonical instance (F-Stats-1 keystone). Sub-form of Pattern 7 at the
model layer.

**Pattern 43 (Zone 22) --- Documented "pre-existing bug" comment as
architecture artifact.** A code comment cites another file's behavior as
broken. The comment is stale; the cited file's behavior changed but the
comment didn't update. The comment then becomes cited authority for
further architectural reasoning. worldEvents.js:3829--3832 is the
canonical instance. **Trap 24 in §5.1 is the audit-side mitigation.**

**Pattern 44 (Zone 22) --- getOrCreateX SELECT-then-INSERT race
producing duplicates.** A helper does
`SELECT * FROM table WHERE ... LIMIT 1` and if no row exists, INSERTs a
new one. Without transactional locking, two parallel calls both miss the
SELECT and both INSERT. Pattern 41 sub-form at the helper-method layer.
F-Stats-2 (character_state auto-seed) canonical instance.

**Pattern 45--54 (Zone 23 / Wardrobe):** Documented in v7 §5.

**Pattern 55 (Zone 23.5 / NEW v8) --- Stale code comment as
bug-source-of-truth.** A code comment claims another file/line has a
specific bug. The cited bug no longer exists in the current code. The
audit cites the comment as evidence and carries the finding forward
through multiple handoffs. The audit-side mitigation is Trap 24 (§5.1).
Canonical instance: worldEvents.js:3830's "pre-existing bug" comment for
careerPipelineService.

**Pattern 56 (Zone 23.5 / NEW v8) --- Async fallback path that has never
run.** A service has a primary code path (model-based) and a fallback
raw-SQL path. The fallback contains structural bugs (calls methods that
don't exist on the fallback's data shape). The fallback only runs when
the primary fails. The primary has never failed in production, so the
fallback has never executed. The bug is documented in code review as
"unreachable but real." Pattern 47 is the URL-mounted variant (broken
plural controller wired to live URLs); Pattern 56 is the in-service
variant (`opp.update()` called on raw SQL fallback that never reaches
that line). F-CP-10 canonical instance.

**Pattern 57 (FINAL FORM, v5) --- Local canon copies routing around the
franchise tier.**

**Definition:** Canonical content (visual style, character voice, world
rules, narrative economy, beat structures, taxonomies) is authored on
the franchise tier as schema fields, seeded data, or franchise_brain
entries. The production pipeline's services do not read this authored
canon. Each service maintains its own private copy as JS literals or
local DB queries that route around the canonical source.

**Why this matters:** Editing the canonical source has no effect on AI
prompts, scene generation, or script output. The pipeline functions
because every service has consistent local copies, not because anything
reads the canon. As soon as a copy drifts, the pipeline drifts silently.

**Canonical instance:** F-Franchise-1 keystone --- six services in the
production pipeline (episodeGeneratorService, episodeCompletionService,
scenePlannerService, episodeOrchestrationRoute, sceneGenerationService,
groundedScriptGeneratorService) each have private canon copies. Zero
deep Universe reads.

**Sub-form: dead consumer schema.** Wardrobe player-UX columns
(lala_reaction\_\*, unlock_requirement, lock_type='season_drop',
is_visible, etc.) declare a consumer surface that was never built.
Distinct from the dominant form: in the dominant form a consumer exists
but routes around the franchise tier; in this sub-form the consumer
never built. Both manifestations sit under Pattern 57 v5 because both
stem from the same underlying fault (consumer wiring missing).

**Audit-side mitigation:** Trap 25 (§5.1).

**Other instances pending verification:** Show Bible 89 rules, Social
Systems 15 archetypes, Cultural Calendar 42 events, World Foundation 11
locations / 5 cities. Each franchise-tier domain audited so far exhibits
the pattern shape; the only confirmed deep-consumer that reads from
canon is the script writer's
`franchise_knowledge.findAll where always_inject=true LIMIT 50`
(groundedScriptGeneratorService.js:117), which reads a parallel
knowledge store, not the franchise tier proper.

**P-Pos-1 (Positive precedent, v4) --- overlayUtils.js as the canonical
Pattern 4 fix template.** Migrations/20260725000000 already removed
hardcoded OVERLAY_TYPES JS constants and moved them into
ui_overlay_types DB table. This is the in-codebase template for
consolidating all the other JS-constants-as-canon during F-Franchise-1 /
Director Brain build (DREAM_CITIES, ARCHETYPES, SEED_GOALS,
EVENT_TEMPLATES, BEAT_TEMPLATES, BEAT_STRUCTURE, JAWIHP_VOICE_DNA,
LALAVERSE_VISUAL_ANCHOR, NEGATIVE_PROMPT, ANGLE_MODIFIERS, etc).

**P-Pos-2 (Positive precedent, Zone 21) --- characterDepthRoutes
propose-then-confirm.** Author-only edits route through a
propose-confirm flow that gates merge with explicit confirmation. The
audit can recommend this shape for Director Brain's outputs (Director
Brain proposes; producer confirms). \# **6. Zone Writeups**

## **6.1 Zones 1--13 (Producer Mode sub-tabs)**

Documented in v3, v4, v5, v6. Carried forward unchanged. Findings are
integrated in §11 totals.

## **6.2 Zone 14 --- Show Bible (KEYSTONE-1)**

Documented in v6 §6.2. Carried forward. **v8 update:** F-Franchise-1
reframes Show Bible's disconnection. arcProgressionService.js:71--98
hardcodes phase canon as JS constants while ShowBiblePage reads
franchise_brain --- this was previously framed as a Pattern 4 instance.
Under F-Franchise-1, it's a producer-routing-around-franchise-tier
symptom. The fix is no longer "migrate the JS literal to
franchise_brain"; the fix is "build Director Brain so franchise_brain
becomes the authoritative source the production pipeline reads."

## **6.3 Zone 15 --- World Dashboard**

Documented in v6 §6.3. Carried forward.

## **6.4 Zone 16 --- World Foundation**

Documented in v6 §6.4. Carried forward.

## **6.5 Zone 17 --- Franchise → Social Systems + Franchise Brain (KEYSTONE-2)**

Documented in v6 §6.5. Carried forward. **v8 update:** Memory #11's
triple archetype taxonomy drift (15 UI archetypes vs 10 DB ENUM vs 5
AI-prompt archetypes) is a Pattern 57 v5 instance --- three local canon
copies, none reading from a franchise-tier source. Pending Pattern 57
verification list.

## **6.6 Zone 18 --- Franchise → Culture & Events**

Documented in v6 §6.6. Carried forward. **v8 update:** Zone 25 confirmed
two parallel cultural-event systems --- `story_calendar_events` seeded
with 42 events (24 annual + 13 micro + 5 birthday templates) by
lalaverse-cultural-calendar seeder, and seasonalEventService.js's 13
hardcoded FEED_EVENT_TEMPLATES. CZ-27 documents the gap: neither system
reads the other.

## **6.7 Zone 19 --- Phone Hub / UI Overlays**

Documented in v6 §6.7. Carried forward. P-Pos-1 (the OVERLAY_TYPES
migration) is the canonical fix template referenced in F-Franchise-1's
resolution sequence.

## **6.8 Security Batch (cross-zone)**

Documented in v6 §6.8. Carried forward. F-AUTH-1 keystone definition
originates here; v8 §4.1 has the full six-step recipe.

## **6.9 Zone 20 --- StoryTeller / Chapter Writer**

Documented in v6 §6.9. Carried forward. F-20.7 (canonical_description
not wired into chapter writer) and F-20.8 (Script → Scene Line Bridge
missing) remain Tier 1 keystone-shape findings.

## **6.10 Zone 21 --- Character Registry / DecisionLog**

Documented in v6 §6.10. Carried forward. F-Reg-2 keystone definition
originates here. v8 confirms Pattern 41 (write-contention without
locking) at four total instances after Zone 26 evidence.

## **6.11 Zone 22 --- Stats / Edit Stats Panel**

Routes audited: `POST /api/v1/characters/:key/state/update` (Edit Stats
save), `GET /api/v1/characters/:key/state` (panel + Overview read),
`POST /api/v1/world/:showId/goals/sync` (Career Goals sync, war-chest
loop closer), `GET /api/v1/shows/:showId/financial-config` (next-goal
threshold the panel's coin bar reads).

Page surface: `frontend/src/pages/WorldAdmin.jsx` lines \~7380--7521
(Character Stats sub-tab), \~1320--1345 (Overview tab read-only
stat-icon boxes), Edit Stats button at line 7390, form at 7402, history
ledger at 7496--7521.

Files traced: `src/routes/evaluation.js` (Stats save handler at line
587, `getOrCreateCharacterState` at line 52, GET /state read at line
212), `src/services/episodeCompletionService.js` lines 165--200 (the
'justawoman' coin write at line 176, auto-seed at line 187),
`src/routes/careerGoals.js` lines 528--586 + line 616 (the 'lala' sync
read at line 536, the 'lala' suggest-events read at line 616),
`src/services/worldEvents.js` lines 3829--3837 (documented "pre-existing
bug" comment), `src/app.js` lines 262--328 (auto-repair IIFE --- v6's
230--280 cite was off by \~30--50 lines),
`src/migrations/20260218100000-evaluation-system.js` line 17
(migration-created schema), `frontend/src/pages/WorldAdmin.jsx`
(Character Stats sub-tab at \~7380, Overview read at \~1323, save
handler at \~1289 inside `saveStats`, charState load inside `loadData`
at line 1052).

### **6.11.1 Files traced --- important caveat (F-Stats-1 KEYSTONE)**

There is no `src/models/CharacterState.js`.
`ls src/models/ | grep -iE "^Character"` returns 12 files, none of which
back this table. `grep -r "tableName.*character_state" src/models/`
returns zero hits. Every read and write to `character_state` across the
codebase is raw `sequelize.query()` against literal SQL strings. This is
itself the zone's headline finding (F-Stats-1), and reframes how the
rest of the zone's findings should be read: there is no model layer to
anchor a fix against.

### **6.11.2 Findings**

  -----------------------------------------------------------------------------------------------------------------------------------------
  **Finding**       **Sev**           **File:line**                                         **Description**
  ----------------- ----------------- ----------------------------------------------------- -----------------------------------------------
  **F-Stats-1**     **P0 KEYSTONE**   (negative finding)                                    character_state has no Sequelize model. 9+
                                                                                            raw-SQL writers across the codebase (after Zone
                                                                                            23 + Zone 23.5 + Zone 26 added more). Pattern
                                                                                            42 canonical instance.

  **F-Stats-2**     **P0**            evaluation.js:71--83 (`getOrCreateCharacterState`)    SELECT-then-INSERT race produces duplicate rows
                                                                                            under WorldAdmin parallel-load. Pattern 44
                                                                                            canonical instance. F-Reg-2 keystone family.

  **F-Stats-3**     **P0**            evaluation.js:587 ('lala' write) +                    F-Sec-3 four-point broken loop confirmed
                                      episodeCompletionService.js:176 ('justawoman' write)  end-to-end. Edit Stats writes 'lala';
                                                                                            episode-complete writes 'justawoman'; sync
                                                                                            reads 'lala'. War-chest goal mathematically
                                                                                            cannot complete.

  **F-Stats-4**     **P0**            app.js:286--294 (character_state auto-repair literal) Auto-repair block creates table on every boot
                                                                                            with hardcoded schema. F-App-1 sub-form.
                                                                                            Without a UNIQUE (show_id, character_key,
                                                                                            season_id) constraint added by migration,
                                                                                            getOrCreateCharacterState's race is unfixable.

  **F-Stats-5**     **P0**            evaluation.js:212 (Stats panel read)                  Reads `WHERE character_key = 'lala'` from URL
                                                                                            param. Producer-side coin display drifts from
                                                                                            script-writer's 'justawoman' read. F-Sec-3
                                                                                            surface.

  **F-Stats-6**     **P0**            episodeCompletionService.js:187 (auto-seed) +         Duplicate DEFAULT_STATS literal. Decision #54's
                                      DEFAULT_STATS hardcode                                CharacterState model creation should
                                                                                            consolidate.

  **F-Stats-7**     **P0**            evaluation.js:587 + history ledger writes             Edit Stats writes 'lala' but does NOT also
                                                                                            write to character_state_history. History
                                                                                            ledger only captures script-writer-driven
                                                                                            deltas. Producer-side manual edits invisible in
                                                                                            audit log.

  **F-Stats-8**     **P0**            careerGoals.js:536 + careerGoals.js:616               Two 'lala' literal reads in career goals
                                                                                            routes. F-Sec-3 surface.

  **F-Stats-9**     **P0**            WorldAdmin.jsx:1289 (saveStats)                       saveStats hardcodes
                                                                                            `/characters/lala/state/update` URL.
                                                                                            Frontend-controlled key; producer cannot edit
                                                                                            other characters.

  **F-Stats-10**    **P0**            worldEvents.js:3829--3832 (documented bug comment)    "Don't reuse the broken helper" comment cites
                                                                                            careerPipelineService.getAccessibleCareerTier
                                                                                            as 'lala'. Comment is stale (Zone 23.5
                                                                                            confirmed current code reads 'justawoman').
                                                                                            Pattern 43 / Pattern 55 canonical. Trap 24.

  **F-Stats-11**    **P0**            evaluation.js:71--83 (getOrCreateCharacterState       If table read fails, helper returns a fresh
                                      fail-open)                                            in-memory state object without writing it.
                                                                                            Subsequent reads see no row; a different code
                                                                                            path's auto-seed creates one. Two paths for
                                                                                            "first-touch this character" silently compete.

  **F-Stats-12**    **P0**            migrations/20260218100000-evaluation-system.js:17 +   Migration creates character_state with one
                                      app.js:286 auto-repair                                schema; auto-repair creates it with another.
                                                                                            Drift is silent. Decision #47 (remove
                                                                                            auto-repair) is the prerequisite.

  **F-Stats-13**    **P0**            character_state_history JSONB writes                  History rows written with full JSONB blobs but
                                                                                            no FK to evaluation_id. Audit trail is
                                                                                            non-relational.

  F-Stats-14 to 21  P1                (8 P1 findings)                                       Lower-stakes stat panel correctness bugs. See
                                                                                            per-file-line tracker for v8 fix planning.

  F-Stats-22, 23    P2                (2 P2 findings)                                       Cosmetic.
  -----------------------------------------------------------------------------------------------------------------------------------------

### **6.11.3 Cross-zone implications from Zone 22**

-   **CZ-9** --- The Edit Stats save and episode-complete writes target
    different rows. Producer manual edits (Edit Stats) write 'lala';
    AI-driven completion writes 'justawoman'. Stats panel reads 'lala'.
    Manual edits visible immediately; episode-complete deltas invisible
    until a future sync mismatches. The "war-chest goal silently no-ops"
    symptom from memory #4 is mechanically explained.
-   **CZ-10** --- character_state_history captures script-writer deltas
    but not producer Edit Stats writes. Audit log incomplete.
-   **CZ-11** --- careerPipelineService.getAccessibleCareerTier
    (cross-zone reference) is the surface called out by
    worldEvents.js:3830's stale comment. v7 deferred its trace to Zone
    23.5 with the correction that surfaced.

## **6.12 Zone 23 --- Wardrobe**

Documented in v7 §6.12. Carried forward in full. v8 reframes severity
per Decision #81 (per-surface consumer tagging) --- wardrobe-side
F-Sec-3 surfaces (wardrobe.js:895 /select, wardrobe.js:970 /purchase)
demoted from P0 to P1 because the producer is the only consumer (Zone 24
confirmed Director Brain doesn't read these surfaces).
wardrobeIntelligenceService character_state read stays P0 because script
writer downstream consumes it.

### **Headline findings (carried forward from v7):**

-   **F-Ward-1 (KEYSTONE) --- episode_wardrobe has no migration in the
    codebase.** Pattern 40b canonical instance, schema-source drift Tier
    4.
-   **F-Ward-2 --- F-Wardrobe-Lock-Schema-Drift.** /select 5-column
    write vs /lock-outfit full-Sequelize write. Closes Loop B of
    war-chest.
-   **F-Ward-3 (KEYSTONE) --- F-Wardrobe-Architecture-Drift.** Two
    outfit-set controllers, two architectures, one underlying table. The
    plural controller crashes on every create due to `this.` binding bug
    at three sites (lines 133, 156, 332).
-   **F-Ward-4 --- Plural outfit-set controller crashes on every create
    due to** `this.` **binding bug.** Pattern 47 canonical. Code wired
    to live URLs that has never run end-to-end in production.
-   **F-Ward-5 --- outfitSets.js routes have NO auth middleware
    declaration.** F-AUTH-1 sub-form (b).
-   **F-Ward-6 --- F-Sec-3 surface count: two more 'lala' purchase
    paths.** wardrobe.js:895 /select auto-purchase, wardrobe.js:970
    /purchase explicit. Demoted to P1 in v8 per Decision #81.
-   **F-Ward-7 ---** `'Lala'` **(capital L) is a fourth character-name
    variant written by outfit_sets.** CZ-16. Demoted to P1 in v8 per
    Zone 24's producer-permanent reframing.

Full v7 §6.12 catalog of 27 P0 + 10 P1 + 3 P2 findings carries forward.

## **6.13 Zone 23.5 --- careerPipelineService.js + arcProgressionService.js phase-advance --- NEW v8**

**Scope:** Closes §10.1 'lala' surfaces 9/10 → 10/10. Closes §10.2
'justawoman' surfaces (eventually 5/6 in v8 after Zone 26 reopens
count). Resolves the v2/v7 catalog contradiction ('lala' vs 'justawoman'
for careerPipelineService).

**Files traced:** - `src/services/careerPipelineService.js` (full file,
5 exports, \~280 lines) - `src/services/arcProgressionService.js` (full
file, 6 exports, \~340 lines)

### **6.13.1 The v2/v7 catalog contradiction --- RESOLVED**

v2 catalog: `careerPipelineService.js:340` reads `'justawoman'`. v7
§10.1's "1 remaining": `getAccessibleCareerTier` reads `'lala'` per
worldEvents.js:3830 comment.

**Both are wrong about lineage. The current code reads**
`'justawoman'`**.**

`careerPipelineService.js:248` (in `getAccessibleCareerTier`):

    `SELECT reputation FROM character_state WHERE show_id = :showId AND character_key = 'justawoman' LIMIT 1`,

Resolution: **worldEvents.js:3830's comment is stale.** The
"pre-existing bug" it points at --- that careerPipelineService reads
`'lala'` --- is no longer true. Either the helper was changed to
`'justawoman'` and the comment wasn't updated, OR the comment was always
wrong about what the helper reads. v8 logs this as **F-CP-1** (Pattern
55 canonical).

### **6.13.2 Findings --- careerPipelineService.js**

  -------------------------------------------------------------------------------------------------------------------------------
  **Finding**       **Sev**           **File:line**                       **Description**
  ----------------- ----------------- ----------------------------------- -------------------------------------------------------
  **F-CP-1**        **P0**            careerPipelineService.js:248;       Stale "pre-existing bug" comment. Reclassify: this
                                      worldEvents.js:3829--3832 (stale    surface belongs in §10.2 (justawoman), not §10.1
                                      comment)                            (lala). Pattern 55 canonical instance.

  **F-CP-2**        **P0**            careerPipelineService.js:243--253   No model abstraction; raw SQL on character_state.
                                      (getAccessibleCareerTier)           F-Stats-1 keystone instance. Pattern 42 confirmation.

  **F-CP-3**        **P0**            careerPipelineService.js:250        Silent failure pattern. Bare
                                      (return 1 on catch)                 `try { ... } catch { return 1; }` returns Tier 1
                                                                          silently on any DB error. Every gated opportunity then
                                                                          appears at the lowest tier. Pattern 12 sub-form.

  **F-CP-4**        **P0**            careerPipelineService.js:74--110    No transaction around read-modify-write. Two
                                      (onOpportunityAdvanced)             opportunities completing in parallel double-add to the
                                                                          same goal. Pattern 41 sub-form --- F-Reg-2 keystone now
                                                                          has THREE confirmed instances (registry_characters,
                                                                          character_state, career_goals).

  **F-CP-5**        **P0**            careerPipelineService.js:97--111    Closed feedback loop with no idempotency guard.
                                      (goal completion +                  Goal-complete → spawnUnlockOpportunities → opportunity
                                      spawnUnlockOpportunities)           completes → onOpportunityAdvanced → goal updates.
                                                                          Re-entry creates duplicate unlocks. Pattern 11
                                                                          instance. Memory note about closed feedback loops
                                                                          confirmed at file:line.

  **F-CP-6**        **P0**            careerPipelineService.js:201--230   Double-counting risk for episode income. This service
                                      (onEpisodeCompleted financial loop) adds `episode.total_income` to coin goals (line 213).
                                                                          Memory #14 documented `episodeCompletionService.js:558`
                                                                          doing the same in parallel. The two services are not
                                                                          coordinated. CZ-21.

  **F-CP-7**        (stricken)        ---                                 Stricken on review --- `showId` is in scope.

  **F-CP-8**        **P0**            careerPipelineService.js:128--130   `career_goal_id: completedGoal.id` set on spawned
                                      (career_goal_id on spawned opp)     opportunity, but `Opportunity.career_goal_id` FK
                                                                          relationship not verified. Provisional.

  **F-CP-9**        **P0**            careerPipelineService.js:122        `Math.min(10, (completedGoal.priority <= 2 ? 7 : 5))`
                                      (prestige defaulted from            --- null priority evaluates `null <= 2` to false,
                                      goal.priority)                      defaulting to 5. Silent shape coercion. Pattern 10.

  **F-CP-10**       **P0**            careerPipelineService.js:147--152   Raw-SQL fallback for missing Opportunity model
                                      (raw SQL fallback path)             immediately calls `opp.update()` --- a method that only
                                                                          exists on the model instance. The fallback is
                                                                          structurally broken and has never run successfully.
                                                                          Pattern 56 canonical instance.

  **F-CP-11**       **P1**            careerPipelineService.js:13--21     Dead constant with eslint-disable. Memory note about
                                      (`_METRIC_OPP_TYPES`)               dead code confirmed at file:line. Pattern 16.

  **F-CP-12**       **P1**            careerPipelineService.js:55--63     Hardcoded metric→increment mapping with no canon
                                      (target_metric branch logic)        source. Pattern 4. F-Franchise-1 sub-form.

  **F-CP-13**       **P1**            careerPipelineService.js:104--106   Triple-fallback parse without error handling. Pattern
                                      (unlocks_on_complete JSON parse)    12.

  **F-CP-14**       **P1**            careerPipelineService.js:175--185   Three-step opportunity lookup with no logging. Pattern
                                      (event lookup fallback chain)       12.

  **F-CP-15**       **P2**            careerPipelineService.js:127        Cosmetic.
                                      (career_impact template injection)  
  -------------------------------------------------------------------------------------------------------------------------------

**careerPipelineService.js: 9 P0, 4 P1, 1 P2.**

### **6.13.3 Findings --- arcProgressionService.js**

  ----------------------------------------------------------------------------------------------------------------------------------------------------
  **Finding**       **Sev**           **File:line**                       **Description**
  ----------------- ----------------- ----------------------------------- ----------------------------------------------------------------------------
  **F-Arc-1**       **P0**            arcProgressionService.js:71--98     Phase canon hardcoded as JS literal. Confirms memory #5 at file:line. Phase
                                      (phase template literal in seedArc) titles, taglines, episode ranges, emotional_arc, feed_behavior all
                                                                          hardcoded. Pattern 4 master instance. F-Franchise-1 sub-form.

  **F-Arc-2**       **P0**            arcProgressionService.js:73, 88,    goal_summary initialized to zeros at seed and never re-derived on read. UI
                                      103 (goal_summary initialized to    re-derives correctly at render; `/arc/context` AI prompt consumer reads
                                      zeros)                              stale zeros. Memory #5 documented at file:line. Pattern 5 instance.

  **F-Arc-3**       **P0**            arcProgressionService.js:159--184   No transaction around phase boundary check + advance. Pattern 41 sub-form.
                                      (checkPhaseTransition)              

  **F-Arc-4**       **P0**            arcProgressionService.js:228--248   Phase advance forcibly demotes active goals to 'failed'.
                                      (advancePhase writes 'failed' to    careerPipelineService.onOpportunityAdvanced reads `WHERE status = 'active'`.
                                      active goals)                       Concurrent execution causes silent goal un-updates. F-Reg-2 keystone ---
                                                                          third confirmed instance. CZ-20.

  **F-Arc-5**       **P0**            arcProgressionService.js:153        Paranoid mode assumption without verification. Need to verify ShowArc model
                                      (deleted_at IS NULL on show_arcs)   has `paranoid: true`. If not, phantom-column query. Pattern 12 sub-form.

  **F-Arc-6**       **P0**            arcProgressionService.js:295--310   Final phase goal_summary updated only at arc-complete time. During Phase 3,
                                      (completeArc writes phase           goal_summary reads as seeded zeros. AI prompt context lies. Pattern 5
                                      goal_summary)                       instance #2 in this file.

  **F-Arc-7**       **P0**            arcProgressionService.js:191--217   JSONB indexed-cast query without index hint.
                                      (getPhaseGoalStatus JSONB query)    `(episode_range->>0)::int >= :start AND (episode_range->>0)::int <= :end`.
                                                                          No GIN/BTREE index. Sequential scan every phase check. Pattern 18 instance.

  **F-Arc-8**       **P0**            arcProgressionService.js:266--273   Reads `WHERE status = 'paused'` to activate next-phase goals --- but no code
                                      (next-phase goal activation)        path writes `'paused'`. Phase-transition goal activation is a silent no-op.
                                                                          CZ-22.

  **F-Arc-9**       **P0**            arcProgressionService.js:323 (0.7   Arc-complete emotional_temperature uses 70% threshold not in canon. Magic
                                      threshold)                          number Pattern 4.

  **F-Arc-10**      **P1**            arcProgressionService.js:14--22     Six emotional states with hardcoded numeric thresholds. Pattern 4.
                                      (computeEmotionalTemperature        
                                      thresholds)                         

  **F-Arc-11**      **P1**            arcProgressionService.js:323        Final-arc temperature uses different formula than mid-arc. Inconsistent.
                                      (computeTemperature on completion)  

  **F-Arc-12**      **P1**            arcProgressionService.js:342--367   AI prompt context exposes currentPhase reference; downstream consumers can
                                      (getArcContext)                     destructure `currentPhase.goal_summary` and get stale zeros. F-Arc-2
                                                                          propagation surface.

  **F-Arc-13**      **P1**            arcProgressionService.js:319        Empty phase always reports 'unstoppable'. Pattern 10.
                                      (goalStatus.total can be 0)         

  **F-Arc-14**      **P1**            arcProgressionService.js:227--248   Narrative-debt prose hardcoded by metric. Seven metric→prose mappings.
                                      (buildNarrativeWeight hardcoded     Pattern 4 + F-Franchise-1 sub-form. The prose Lala carries into AI prompts
                                      prose)                              is JS literals, not authored canon. CZ-29.
  ----------------------------------------------------------------------------------------------------------------------------------------------------

**arcProgressionService.js: 9 P0, 5 P1, 0 P2.**

### **6.13.4 §10.1 and §10.2 catalogs --- closure status (from Zone 23.5)**

After Zone 23.5: - **§10.1 'lala' surfaces --- 10/10 closed.** The
remaining surface from v7
(`careerPipelineService.getAccessibleCareerTier`) does NOT exist. That
helper reads `'justawoman'` (careerPipelineService.js:248). Surface
reclassified to §10.2. - **§10.2 'justawoman' surfaces --- 5/5 closed at
this point.** **Zone 26 will reopen this count to 6/6.**

arcProgressionService phase-advance --- **NO character_key read or
write.** No 'lala' or 'justawoman' literal anywhere. F-Arc-4's
interaction with F-Sec-3 is indirect (concurrent writes to career_goals,
not character_state). Memory #29's claim that arcProgressionService is a
§10.2 surface is **wrong**. Memory correction logged as Decision #71.

### **6.13.5 New patterns identified by Zone 23.5**

-   **Pattern 55** --- Stale code comment as bug-source-of-truth. F-CP-1
    canonical instance.
-   **Pattern 56** --- Async fallback path that has never run. F-CP-10
    canonical instance.

### **6.13.6 New cross-zone implications**

-   **CZ-20** --- careerPipelineService and arcProgressionService share
    career_goals with no coordination. F-Arc-4 + F-CP-4. F-Reg-2
    keystone instance #3.
-   **CZ-21** --- careerPipelineService.onEpisodeCompleted vs
    episodeCompletionService.completeEpisode double-count risk. F-CP-6 +
    memory #14. Verified in Zone 26.
-   **CZ-22** --- arcProgressionService phase-advance triggers
    career_goals state change with no career_goals event/listener.
    F-Arc-8.

### **6.13.7 New decisions for v8 (Zone 23.5 batch)**

-   **Decision #66:** Update `worldEvents.js:3829–3832`'s "pre-existing
    bug" comment to reflect current code, or delete during F-Sec-3
    sweep.
-   **Decision #67:** F-CP-10's broken raw-SQL fallback should be
    deleted. Pattern 56 fix template.
-   **Decision #68:** Pattern 4 sweep must include
    arcProgressionService's phase template (lines 71--98), six
    emotional-state thresholds (lines 14--22), and seven
    narrative-weight prose strings (lines 232--246). Migration target:
    franchise_brain. Use OVERLAY_TYPES migration as template.
-   **Decision #69:** F-Arc-8's `status = 'paused'` filter requires
    investigation.
-   **Decision #70:** Add Trap 24 (Code comments cited as authority
    without verification) --- already merged into §5.1 above.
-   **Decision #71:** Memory #29 correction. arcProgressionService
    phase-advance is NOT a §10.2 surface.

**Zone 23.5 contribution: 18 P0, 9 P1, 1 P2.**

## **6.14 Zone 24 --- Closet (data-only non-discovery) --- NEW v8**

**Scope:** Closet page (predicted UI consumer of /select and /purchase
wardrobe gameplay endpoints).

**Headline finding:** **No /closet route exists in App.jsx.** Grep
returns zero hits. The closet page was never built and per the seeded
spec at seeders/20260312800000-show-brain-franchise-laws.js:313, 335 it
is permanently descoped --- Director Brain does not pick wardrobe, and
the existing EpisodeWardrobeGameplay component (mounted at
EpisodeDetail.jsx:743 inside the producer's episode-editing UI) is the
permanent shape of how outfit pools get selected.

### **6.14.1 Files traced**

-   `models/Wardrobe.js` (full file, 350+ lines)
-   `models/EpisodeWardrobe.js` (full file, \~120 lines)
-   `services/wardrobeIntelligenceService.js` (full file, \~950 lines)
-   App.jsx grep for `/closet` route (zero hits)
-   Codebase grep for `EpisodeWardrobeGameplay` (single mount point at
    EpisodeDetail.jsx:743)
-   Seeded spec at
    seeders/20260312800000-show-brain-franchise-laws.js:313 (brain
    pipeline) + :335--343 (Director Brain capabilities)

### **6.14.2 The reframing --- three corrections in one zone**

**Pre-v8 framing v1:** "Closet page never built. Consumer surface
missing." Treated as keystone-candidate.

**Pre-v8 framing v2 (after evidence trace):** "Closet pivoted from
player UX to author tool to Director Brain consumer." Pattern 57 revised
to "vestigial player vocabulary on a non-player domain." Downgraded to
P0.

**v8 final framing (after seeded-spec evidence):** **The Director Brain
consumer hypothesis was wrong.** Director Brain doesn't pick wardrobe.
The wardrobe loop's permanent consumer is the producer
(EpisodeWardrobeGameplay), with AI-assisted scoring
(wardrobeIntelligenceService).

The pre-v8 framing went through **three corrections** before locking.
This is itself the audit's clearest evidence for **Trap 26** (reasoning
about unbuilt systems from schema implication instead of seeded spec).

### **6.14.3 Architectural shape, locked at file:line**

    producer picks wardrobe pool (EpisodeWardrobeGameplay, current)
      ↓
    episodeOrchestrationRoute attaches pool to Beat 6 (Director-level annotation)
      ↓
    script writer consumes orchestration output

Producer is the permanent consumer. AI is downstream of producer choice.
No Brain ever inherits the wardrobe-pick step. This is the spec, written
into the seeder as franchise law at
seeders/20260312800000-show-brain-franchise-laws.js:335--343.

### **6.14.4 Findings**

  ---------------------------------------------------------------------------------------------------------
  **Finding**       **Sev**           **File:line**                    **Description**
  ----------------- ----------------- -------------------------------- ------------------------------------
  **F-Closet-0**    **P0**            (negative finding --- no file)   Producer-permanent wardrobe domain.
                                                                       Per seeded spec, the closet page
                                                                       never ships and Director Brain
                                                                       doesn't read wardrobe. Pattern 57 v5
                                                                       documentation finding (downgraded
                                                                       from keystone-candidate).

  **F-Closet-1**    **P0**            wardrobeIntelligenceService.js   Hardcoded 'lala' surface. Script
                                      (financial_pressure              writer downstream consumes (via
                                      character_state query)           getWardrobeIntelligence). §10.1
                                                                       confirmed at file:line.

  **F-Closet-2**    **P0**            EpisodeWardrobe.js (model file)  F-Ward-1 keystone confirmed at the
                                                                       model file. EpisodeWardrobe declares
                                                                       full schema (id UUID, episode_id,
                                                                       wardrobe_id, scene_id, scene STRING
                                                                       legacy, worn_at, notes,
                                                                       approval_status, approved_by,
                                                                       approved_at, rejection_reason). No
                                                                       migration in the codebase creates
                                                                       this table. wardrobe.js:1291's
                                                                       defensive comment is grounded.

  **F-Closet-3**    **P2**            Wardrobe.js (declared)           Dead player-UX schema fields.
                                                                       `is_owned`, `is_visible`,
                                                                       `lala_reaction_own/locked/reject`,
                                                                       `era_alignment`,
                                                                       `unlock_requirement`,
                                                                       `outfit_match_weight`,
                                                                       `lock_type='season_drop'`,
                                                                       `is_visible`,
                                                                       `season_unlock_episode`,
                                                                       `reputation_required`,
                                                                       `influence_required`. Pattern 57 v5
                                                                       sub-form. **Demoted to P2** ---
                                                                       permanently dead per
                                                                       producer-permanent framing, not
                                                                       blocking anything.

  **F-Closet-4**    **P0**            wardrobeIntelligenceService.js   Three arc-stage vocabularies across
                                      (`getWardrobeGrowthArc`          the codebase.
                                      arc_stage logic)                 wardrobeIntelligenceService: 4
                                                                       stages ('foundation' / 'building' /
                                                                       'glow_up' / 'prime').
                                                                       arcProgressionService: 5 stages
                                                                       ('foundation' / 'glow_up' / 'luxury'
                                                                       / 'prime' / 'legacy').
                                                                       Wardrobe.era_alignment column
                                                                       comment: 5 values. Three taxonomies
                                                                       for one concept. Pattern 7. CZ-23.

  **F-Closet-5**    **P0**            Wardrobe.js:236                  Type drift. outfit_sets.id is UUID;
                                      (`outfit_set_id: STRING(255)`)   wardrobe.outfit_set_id is
                                                                       STRING(255). No FK declared.
                                                                       F-Ward-3 keystone --- fourth
                                                                       structural symptom.

  **F-Closet-6**    **P0**            Wardrobe.js:227--229             Denormalization stale. Each wardrobe
                                      (outfit_set_name denormalized)   row stores outfit_set_name as a
                                                                       string; never updated when the
                                                                       parent outfit_sets row's name
                                                                       changes. Pattern 5.

  **F-Closet-7**    **P0**            Wardrobe.js:24 (character        Wardrobe.character is the 5th
                                      STRING) + Wardrobe.js:30         canonical-name variant. F-Sec-3
                                      (character_id UUID)              surface count → 13. Producer-AI
                                                                       handoff means the name written here
                                                                       flows to AI prompt context. Stays
                                                                       P0. CZ-25.

  **F-Closet-8**    **P1**            Wardrobe.js:182, 187, 175 (three `outfit_set_id` (string FK) +
                                      item-grouping mechanisms)        `is_set + set_name` (jewelry-set
                                                                       parent flag) + `parent_item_id`
                                                                       (self-FK for attachments). Three
                                                                       mechanisms on the same model.
                                                                       Pattern 7.

  **F-Closet-9**    **P1**            Wardrobe.js:391--407             Class method filters by string name,
                                      (findByCharacter class method)   not character_id. The denormalized
                                                                       field that's "for quick filtering"
                                                                       is the only filter implemented.
                                                                       Pattern 5.

  **F-Closet-10**   **P1**            EpisodeWardrobe.js:33 (scene_id  Junction table carries scene_id FK
                                      FK) + :42 (scene STRING legacy)  AND scene legacy string. Comment
                                                                       says "use scene_id instead." Both
                                                                       fields written by some path. Pattern
                                                                       7 + Pattern 12.
  ---------------------------------------------------------------------------------------------------------

### **6.14.5 New patterns from Zone 24**

Pattern 57 v3-v5 evolution. Final form (v5) consolidated in §5. v8's
Trap 26 (Reasoning about unbuilt systems from schema implication instead
of seeded spec) added to checklist.

### **6.14.6 New cross-zone implications from Zone 24**

-   **CZ-23** --- Three vocabularies for arc/era stage. F-Closet-4.
    Pattern 7 instance.
-   **CZ-24** --- Pattern 57 v5 produces audit's first "two-instance"
    candidate (Closet schema-bloat sub-form + LalaVerse keystone form).
    Director Brain inheriting the franchise tier as input is then
    inheriting systematically dead consumer schemas across multiple
    domains.
-   **CZ-25** --- F-Closet-7 extends F-Sec-3 to 13 surfaces total (10
    'lala' + 2 'Lala' + 4 partial 'justawoman' + 1 wardrobe.character).
    Decision #56 sweep needs to consider whether wardrobe.character
    migrates with canonical-key sweep or stays as separate
    denormalization.

### **6.14.7 Decisions from Zone 24**

-   **Decision #72 (REVOKED-AND-REPLACED in Zone 24's third
    correction):** Original: "Closet page is a Director Brain
    prerequisite." **Final:** Closet page is permanently descoped per
    seeded spec at
    seeders/20260312800000-show-brain-franchise-laws.js:313, 335.
    EpisodeWardrobeGameplay is the permanent producer surface.
-   **Decision #73:** wardrobeIntelligenceService character_state read
    counted in §10.1.
-   **Decision #74:** F-Closet-3's dead fields survive intact through
    any migration cleanup.
-   **Decision #75:** F-Closet-4's three arc-stage vocabularies need
    consolidation. **Recommend 5-stage**
    ('foundation/glow_up/luxury/prime/legacy') matching
    arcProgressionService phase template + Wardrobe.era_alignment
    comment.
-   **Decision #76:** Pattern 57 v5 enters the named-pattern catalog.
    Trap 25 added.
-   **Decision #77:** v7 §3.3 corrected. Closet drops out as a UI zone.
    Remaining zones reduced to LalaVerse + Episode Generator service.

**Zone 24 contribution: 7 P0, 3 P1, 1 P2.**

### **6.14.8 Audit hygiene lesson from Zone 24**

This zone illustrates the audit-side risk that Trap 26 names:
**reasoning about an unbuilt system from schema artifacts alone.** The
pre-v8 framing did this twice. v1: assumed closet existed because the
schema implies a consumer. v2: assumed Director Brain inherits the
consumer because the architecture was the natural extension of existing
code. **Both assumptions could have been falsified by reading the seeded
spec at seeders/20260312800000-show-brain-franchise-laws.js earlier.**

Audit hygiene rule: **when a zone touches an unbuilt system, the seeded
franchise laws are the authoritative source of intent --- not the
schema, not the code patterns, not "what would naturally be true."**
Trap 26.

This is the same shape as Pattern 55 (stale code comment as
bug-source-of-truth) --- both are about citing the wrong authority.
Pattern 55 names the bug; Trap 26 names the audit-side risk.

## **6.15 Zone 25 --- LalaVerse / Universe entity --- NEW v8**

**Scope:** Universe data layer (Universe model, Universe seeder,
BookSeries seeder, cultural calendar seeder), UniversePage frontend,
downstream consumer trace for `pnos_beliefs` and `core_themes` data
structures.

**Files traced:** - `scripts/seed-lalaverse.js` (full) -
`seeders/...lalaverse-cultural-calendar.js` (full --- 24 annual + 13
micro + 5 birthday templates) - Inline link script (Book→Series,
Show→Universe FK linking) - Trace results across 53 frontend files via
grep + 9 backend services via grep

### **6.15.1 The structural finding --- fewer files than 53, but heavier weight**

The grep returned 53 files. After splitting by term:

  ------------------------------------------------------------------------------------------------------------
  **Data surface**               **Frontend          **Frontend        **Backend consumers**
                                 writers**           readers**         
  ------------------------------ ------------------- ----------------- ---------------------------------------
  `Universe.pnos_beliefs`        1 (UniversePage.jsx **0**             0
                                 editor)                               

  `Universe.core_themes`         1 (UniversePage.jsx 2 (Home.jsx       0
                                 editor)             display,          
                                                     NewBookModal      
                                                     seeding)          

  `Universe.world_rules`         1 (UniversePage.jsx 0                 0
                                 editor)                               

  `Universe.narrative_economy`   1 (UniversePage.jsx 0                 0
                                 editor)                               

  `Universe.description`         1 (UniversePage.jsx possibly 2 (Home, 1 shallow
                                 editor)             landing)          (characterGenerationRoutes.js:57--58, 4
                                                                       fields, optional)
  ------------------------------------------------------------------------------------------------------------

**The brand string "LalaVerse" appears in 53 files. The structural data
on the Universe row reaches at most 2 frontend surfaces and 0 deep
backend consumers.**

This is the disconnection Evoni named in v1 --- and it now has file:line
evidence.

### **6.15.2 Findings**

  ----------------------------------------------------------------------------------------------------------------------
  **Finding**       **Sev**            **File:line / Evidence**                          **Description**
  ----------------- ------------------ ------------------------------------------------- -------------------------------
  **F-Lala-1**      **P0**             UniversePage.jsx (writer) → 0 readers             `pnos_beliefs` is write-only
                                                                                         canon. PNOS Law 3 ("Every
                                                                                         decision echoes") and Law 7
                                                                                         ("Becoming is nonlinear")
                                                                                         govern decisionLogger and arc
                                                                                         progression --- neither reads
                                                                                         it. Documentation surface of
                                                                                         F-Franchise-1 keystone.

  **F-Lala-2**      **P0**             UniversePage.jsx → Home.jsx + NewBookModal.jsx    `core_themes` reaches the entry
                                                                                         layer only. Show-tier surfaces,
                                                                                         Character-tier surfaces,
                                                                                         Story-tier surfaces do not read
                                                                                         core_themes. Pattern 57 v5
                                                                                         instance.

  **F-Lala-3**      **P0**             UniversePage.jsx → 0 readers                      `world_rules` is write-only
                                                                                         canon. 7 enforcement rules
                                                                                         (reputation gates, style
                                                                                         alignment, emotional state,
                                                                                         money flow, history
                                                                                         compounding, era shifts,
                                                                                         creation-changes-reality). Show
                                                                                         Bible has 89 rules in
                                                                                         franchise_brain. **Two parallel
                                                                                         rule systems with no
                                                                                         cross-reference.** CZ-30.

  **F-Lala-4**      **P0**             UniversePage.jsx → 0 readers                      `narrative_economy` is
                                                                                         write-only canon. Defines Prime
                                                                                         Coins, Dream Fund, Reputation
                                                                                         Score, Trust, Influence
                                                                                         Milestones, Stress. **These are
                                                                                         the SAME variables F-Sec-3
                                                                                         fights over.** The Universe row
                                                                                         has the canonical definition;
                                                                                         the character_state table
                                                                                         tracks the values. **No code
                                                                                         reads the Universe row's
                                                                                         definition into the prompt
                                                                                         context.** AI knows the
                                                                                         numbers; AI does not know the
                                                                                         canon meaning. CZ-28.

  **F-Lala-5**      **P0**             seeders/...lalaverse-cultural-calendar.js (full   42 cultural-calendar events
                                       file) → seasonalEventService.js                   seeded; 13 hardcoded
                                                                                         FEED_EVENT_TEMPLATES in
                                                                                         seasonalEventService.js. Two
                                                                                         parallel event-template
                                                                                         systems. Neither
                                                                                         cross-references. CZ-27.
                                                                                         Pattern 4 + Pattern 7.

  **F-Lala-6**      **P0**             seed-lalaverse.js (entire script)                 One-time imperative seed for
                                                                                         canon data. `findOrCreate` is
                                                                                         idempotent on slug --- but
                                                                                         doesn't update existing rows.
                                                                                         **Editing pnos_beliefs requires
                                                                                         editing the script and finding
                                                                                         a way to overwrite the existing
                                                                                         row.** Pattern 4 master
                                                                                         instance for the Universe
                                                                                         layer.

  **F-Lala-7**      **P0**             seeders/...lalaverse-cultural-calendar.js         Cultural calendar seeder is
                                       (idempotency block)                               destructive idempotent.
                                                                                         `bulkDelete` then `bulkInsert`.
                                                                                         Any user-edited cultural event
                                                                                         with these tags gets wiped on
                                                                                         re-run. Pattern 12 sub-form.
                                                                                         **Hotfix-eligible.**
                                                                                         Recommendation: defer to
                                                                                         first-fix-after-audit batch
                                                                                         (Decision #85).

  **F-Lala-8**      **P0**             seed-lalaverse.js + inline link script            Universe→Show linkage is
                                                                                         one-way and manual. Operator
                                                                                         instructed to manually update
                                                                                         Show.universe_id. No automated
                                                                                         linking. Multi-tenant operation
                                                                                         broken at this connection.
                                                                                         Pattern 41 sub-form.

  **F-Lala-9**      **P0               (negative finding via grep, see 6.15.3)           Backend services do not consume
                    KEYSTONE-class**                                                     Universe. **Six hits across
                                                                                         nine production services, all
                                                                                         benign.** Pattern 57 v5
                                                                                         keystone-mechanism.

  **F-Lala-10**     **P0**             seeders/...lalaverse-cultural-calendar.js (5      5 birthday templates seeded
                                       birthday templates)                               with `pattern: 'annual:TBD'`
                                                                                         and `start: storyDate(1, 1)`.
                                                                                         Comment says "dates assigned
                                                                                         when icons are generated." **No
                                                                                         code path generates icons or
                                                                                         assigns the TBD patterns to
                                                                                         real dates.** Icon-system
                                                                                         consumer does not exist.
                                                                                         Pattern 57 v5 instance.

  **F-Lala-11**     **P1**             seed-lalaverse.js:24--32, 42--82, 84--113         Universe canon stored as TEXT
                                                                                         blocks, not structured data.
                                                                                         PNOS has 7 numbered laws ---
                                                                                         TEXT block with newlines, not 7
                                                                                         rows in a `pnos_laws` table.
                                                                                         World rules same shape. Pattern
                                                                                         18 inverse.

  **F-Lala-12**     **P1**             seed-lalaverse.js:14--32 (description hardcoded)  Marketing tagline embedded as
                                                                                         canon. Universe.description
                                                                                         mixes brand voice and
                                                                                         structural canon at the same
                                                                                         field. Pattern 5.

  **F-Lala-13**     **P1**             seeders/...lalaverse-cultural-calendar.js:1--11   `storyDate(month, day, hour)`
                                       (storyDate function)                              returns `8385-MM-DD` --- year
                                                                                         hardcoded to 8385. Two parallel
                                                                                         time systems on the same row
                                                                                         (story-year 8385
                                                                                         vs. real-year). Memory #15
                                                                                         (World Timeline architecture)
                                                                                         was scoped to do this; not
                                                                                         built. Pattern 7.

  **F-Lala-14**     **P1**             seeders/...lalaverse-cultural-calendar.js (every  source_line_id, story_position,
                                       event)                                            series_id all null on every
                                                                                         event. Schema FKs that exist
                                                                                         are never populated. Pattern
                                                                                         18.

  **F-Lala-15**     **P1**             seed-lalaverse.js (full file, no migration)       Seed-as-only-source-of-canon.
                                                                                         Same shape as F-Ward-1. Schema
                                                                                         lives in models/Universe.js;
                                                                                         canon content lives in this
                                                                                         seed script. New environment
                                                                                         without seeder run has schema
                                                                                         but no Universe row. Pattern
                                                                                         40b instance.

  **F-Lala-16**     **P2**             seeders/...lalaverse-cultural-calendar.js (every  `what_only_we_know` rich AI
                                       event has secret field)                           prompt scaffolding sits in
                                                                                         story_calendar_events. No grep
                                                                                         yet on consumers; if zero,
                                                                                         Pattern 57 v5 instance for
                                                                                         cultural events. P2 because
                                                                                         text-field bloat without
                                                                                         structural fault.
  ----------------------------------------------------------------------------------------------------------------------

**Zone 25: 10 P0, 5 P1, 1 P2.**

### **6.15.3 F-Lala-9 confirmed via backend grep**

Six hits across four files. Three are Universe's own CRUD; one is a
dropdown picker; one is a downstream generator.

  --------------------------------------------------------------------------------------------------------------
  **File:line**                                **What it does**        **What fields it reads**
  -------------------------------------------- ----------------------- -----------------------------------------
  routes/universe.js:38                        List all universes      all fields
                                               (findAll)               

  routes/universe.js:113                       Get one universe with   all fields + relations
                                               includes (findByPk)     

  routes/universe.js:126                       Get one for update      all fields
                                               (findByPk)              

  routes/onboarding.js:415                     Universe picker         `['id', 'name']` only
                                               dropdown                

  routes/characterGenerationRoutes.js:57--58   Character generation    `['id', 'name', 'description', 'tone']`
                                               context                 
  --------------------------------------------------------------------------------------------------------------

**Negative evidence --- what's NOT there:**

Nine production services were checked. Zero read Universe deeply:

-   services/episodeScriptWriterService.js --- reads franchise_knowledge
    (FranchiseKnowledge.findAll where always_inject=true LIMIT 50 at
    line 169). Universe bypassed.
-   services/groundedScriptGeneratorService.js --- same pattern,
    franchise_knowledge yes, Universe no
-   services/episodeGeneratorService.js --- no Universe read
-   services/episodeCompletionService.js --- no Universe read
-   routes/episodeOrchestrationRoute.js --- the director-level
    orchestrator. No Universe read.
-   services/scenePlannerService.js --- no Universe read
-   services/wardrobeIntelligenceService.js --- no Universe read
-   routes/franchiseBrainRoutes.js --- the brain that's supposed to hold
    franchise law. No Universe read.
-   services/sceneGenerationService.js --- no Universe read

**Even the one downstream consumer (characterGenerationRoutes.js) skips
the rich fields.** Reading `['id', 'name', 'description', 'tone']` means
pnos_beliefs, core_themes, world_rules, narrative_economy are not in the
read attributes. Universe table is consulted shallowly, with optional
guard, by one generator path, while every other generator routes around
it entirely.

### **6.15.4 The architectural shape --- locked at file:line**

                    ┌─────────────────┐
                    │   UniversePage  │ ← only writer of franchise-tier canon
                    └────────┬────────┘
                             │ writes → Universe row
                             ▼
                      ┌────────────┐
                      │  Universe  │ ← read by:
                      │   table    │   • routes/universe.js (CRUD only)
                      └────────────┘   • routes/onboarding.js (id+name dropdown)
                             │         • routes/characterGenerationRoutes.js (4 fields, optional)
                             │
                             X         ← NO read by ANY AI generation service
                             X
                ┌───── all 9 production AI services ─────┐
                │                                         │
                ▼                                         │
      ┌──────────────────────┐                            │
      │  franchise_knowledge │ ← consumed by:             │
      │       table          │   • episodeScriptWriter    │
      │                      │   • groundedScriptGen      │
      │  • no universe_id FK │   • franchiseBrainRoutes   │
      │  • no show_id FK     │   3 deep consumers         │
      │  • global single-    │                            │
      │    tenant            │                            │
      └──────────────────────┘                            │
                ▲                                         │
                │                                         │
                └────── written by episodeCompletion ─────┘

**Two parallel franchise-tier knowledge stores. They are unrelated.**
Editing the Universe page does not change what the AI sees, because the
AI reads `franchise_knowledge` and `franchise_knowledge` has no FK to
Universe.

This is the **physical shape** of "the missing orchestrator." Not a
conceptual gap --- a measurable absence of `Universe.findByPk` in the
nine services where it should appear.

### **6.15.5 Pattern 57 v5 --- keystone shape**

With F-Lala-9 confirmed, Pattern 57's framing is no longer
pattern-shaped. It's keystone-shaped.

A pattern repeats across surfaces. **A keystone is a single
architectural fault that explains many surfaces' symptoms.** F-Lala-9
isn't "another instance of Pattern 57" --- it's the **physical
mechanism** that makes Pattern 57 visible everywhere. Every surface
where franchise-tier data fails to reach the AI is downstream of the
absent `Universe.findByPk`.

**F-Lala-1** (PNOS write-only) is the documentation surface of the
keystone. **F-Lala-9** (zero deep AI consumers) is the mechanical proof.

These collapse to one keystone: **F-Franchise-1 --- Franchise-tier
write-only architecture.** v8 names this as the seventh keystone in
§2.1.

### **6.15.6 New cross-zone implications from Zone 25**

-   **CZ-27** --- Two parallel cultural-event systems, never reconciled.
    F-Lala-5.
-   **CZ-28** --- F-Sec-3 economic vocabulary defined in
    Universe.narrative_economy and never read. F-Sec-3 is the symptom;
    F-Lala-4 is the disease.
-   **CZ-29** --- pnos_beliefs is the canonical authority for arc
    progression's narrative-debt prose; never read. F-Lala-1 + F-Arc-14.
-   **CZ-30** --- `world_rules` and Show Bible rules are parallel rule
    systems. F-Lala-3 + Zone 14.

### **6.15.7 New decisions for v8 (Zone 25 batch)**

-   **Decision #83:** Pattern 57 finalized at v5 framing.
-   **Decision #84:** F-Lala-9 confirmation grep ran; six hits, all
    benign. Documented in §6.15.3.
-   **Decision #85:** F-Lala-7 (cultural calendar seeder destructive
    idempotent) is hotfix-eligible. Defer to first-fix-after-audit
    batch.
-   **Decision #86:** F-Lala-13's year-8385 / `'annual:'` string
    mismatch is a World Timeline prerequisite. Memory #15's World
    Timeline architecture needs to absorb this finding.
-   **Decision #87:** F-Lala-10 (5 birthday templates with TBD patterns
    awaiting an icon system) --- confirm with JAWIHP whether icon system
    is planned, deferred, or descoped.
-   **Decision #88:** Pattern 40b gains a second axis: data-source
    drift. F-Ward-1 (no migration for episode_wardrobe) is **schema**
    drift Tier 4. F-Lala-15 (seed-as-only-source-of-canon) is **data**
    drift.

**Zone 25 contribution: 10 P0, 5 P1, 1 P2.**

## **6.16 Zone 26 --- Episode Generator service (and friends) --- NEW v8**

**Scope:** The cross-cutting episode-generation pipeline. Six services
traced as one zone because they call each other or share state.

**Files traced:** - `src/services/episodeGeneratorService.js` (full ---
580 lines) - `src/services/episodeCompletionService.js` (full --- 530
lines) - `src/services/scenePlannerService.js` (full --- 220 lines) -
`routes/episodeOrchestrationRoute.js` (full --- 280 lines) -
`src/services/sceneGenerationService.js` (full --- 1100 lines) -
`src/services/groundedScriptGeneratorService.js` (full --- 220 lines)

This is the last zone. After this, the audit closes.

### **6.16.1 The headline finding --- F-Franchise-1 confirmed at the consumer layer**

F-Lala-9 (Zone 25) predicted: zero deep Universe consumers in nine
production AI services. Zone 26's actual consumer-side trace makes this
**physical at file:line**.

The episode generation pipeline's consumer surfaces --- what each
service actually reads to build prompts:

  ------------------------------------------------------------------------------------------------------------------------------
  **Service**                         **Reads from**          **Reads from where?**
                                      `Universe`**?**         
  ----------------------------------- ----------------------- ------------------------------------------------------------------
  episodeGeneratorService.js          **No**                  `event.canon_consequences.automation`, hardcoded
                                                              SOCIAL_TASK_TEMPLATES + PLATFORM_TASKS + CATEGORY_TASKS +
                                                              BEAT_TEMPLATES (4 hardcoded JS constants), `character_state` raw
                                                              SQL

  episodeCompletionService.js         **No**                  `evaluation_formula` JS module, `franchise_knowledge` for
                                                              `episodeKnowledge` writes (line 488) --- but **only writes**,
                                                              never reads it for generation context

  scenePlannerService.js              **No**                  `franchise_knowledge` not read; reads `world_events`,
                                                              `scene_sets`, hardcoded BEAT_STRUCTURE (line 30)

  episodeOrchestrationRoute.js        **No**                  hardcoded archetype prose (line 187), `getWardrobePool` reads
                                                              `game_wardrobe` table; `archetype_guide` is JS literal

  groundedScriptGeneratorService.js   **No**                  `franchise_knowledge.findAll where always_inject=true LIMIT 50`,
                                                              `JAWIHP_VOICE_DNA` hardcoded JS const, `BEAT_TEMPLATES` hardcoded
                                                              JS const

  sceneGenerationService.js           **No**                  `LALAVERSE_VISUAL_ANCHOR` hardcoded JS const, `NEGATIVE_PROMPT`
                                                              hardcoded JS const, scene_sets table, Claude Vision on base images
  ------------------------------------------------------------------------------------------------------------------------------

**Six services, zero Universe reads, six independent local copies of
franchise canon.** Each service has its own slice of "what LalaVerse
looks/sounds/feels like" hardcoded as a JS literal. None of them read
the Universe row. None of them read each other.

This is what F-Franchise-1 looks like in practice: the franchise-tier
disconnection materializes as **six parallel canon sources** in the
production pipeline, each authored separately, none authoritative.

### **6.16.2 Findings --- episodeGeneratorService.js**

  -------------------------------------------------------------------------------------------------------------------------------------------
  **Finding**       **Sev**           **File:line**                         **Description**
  ----------------- ----------------- ------------------------------------- -----------------------------------------------------------------
  **F-EpGen-1**     **P0**            episodeGeneratorService.js:21--141    Three parallel hardcoded canon dictionaries for social media
                                                                            tasks. SOCIAL_TASK_TEMPLATES (4 event-type buckets × 3 timing
                                                                            phases = 12 task arrays), PLATFORM_TASKS (7 platforms × N tasks),
                                                                            CATEGORY_TASKS (8 categories × N tasks). Pattern 4 master
                                                                            instance at the show-tier consumer layer. F-Franchise-1 sub-form.

  **F-EpGen-2**     **P0**            episodeGeneratorService.js:285--344   14-beat structure hardcoded as JS const. Same shape as
                                      (BEAT_TEMPLATES --- 14 hardcoded      scenePlannerService.js:30 (BEAT_STRUCTURE --- also 14 hardcoded
                                      beats)                                beats). Two services, two copies, divergent emotional_intent
                                                                            labels. Pattern 4 + Pattern 7. CZ-33.

  **F-EpGen-3**     **P0**            episodeGeneratorService.js:439--484   **§10.2 'justawoman' surface 6/5 --- undercount in v7
                                      ('justawoman' raw SQL read at line    confirmed.** Affordability guard reads character_state directly
                                      442)                                  via raw SQL with `character_key = 'justawoman'`. **§10.2 is now
                                                                            6/6, not 5/5.** Decision #93.

  **F-EpGen-4**     **P0**            episodeGeneratorService.js:382--430   AI-drafted title generation wired through hardcoded prompt text.
                                      (Claude Haiku title generation)       Show name, format, voice --- all literal. Universe.description,
                                                                            core_themes, narrative_economy --- none consulted. Title
                                                                            generation is canon-blind. F-Franchise-1 sub-form.

  **F-EpGen-5**     **P0**            episodeGeneratorService.js:441--460   Affordability guard fails-open on missing character_state row.
                                      (affordability guard)                 Silent fail-open on a money-related guard. Pattern 12.

  **F-EpGen-6**     **P0**            episodeGeneratorService.js:526--541   Asset linking via JSONB string concat with manual quote-escape.
                                      (event-asset metadata JSONB query)    Pattern 12 candidate, NOT a SQL injection candidate (UUID type
                                                                            constraint upstream prevents exploitation). SQL injection
                                                                            candidate count remains 0.

  **F-EpGen-7**     **P0**            episodeGeneratorService.js:496--500   Required UI overlays auto-placement reads
                                      (autoPlaceRequiredOverlays)           `event.required_ui_overlays` JSONB without validating against any
                                                                            registry. The word "required" is a lie. Pattern 10.

  **F-EpGen-8**     **P0**            episodeGeneratorService.js:185--196   Episode regeneration guard depends on column that "may not
                                      (used-event guard)                    exist." Catch block silently allows double-generation if column
                                                                            is missing. F-Ward-1 / F-Lala-15 keystone family.

  **F-EpGen-9**     **P0**            episodeGeneratorService.js:248 (no    Tier-gating does NOT happen at episode generation.
                                      tier-gating)                          Universe.world_rules ("RULE 1: Reputation gates opportunity") is
                                                                            bypassed. The canon law is dead. F-Lala-3 / F-Franchise-1
                                                                            keystone instance.

  **F-EpGen-10**    **P0**            episodeGeneratorService.js:550--580   Three downstream services called sequentially, all fail-open.
                                      (post-event activity)                 Episode "generation" returns success even if all three downstream
                                                                            pipelines silently fail. Pattern 12 cluster.

  **F-EpGen-11**    **P1**            episodeGeneratorService.js:142        `SOCIAL_TASK_TEMPLATES.default = SOCIAL_TASK_TEMPLATES.invite`.
                                      (default fallback)                    Any event_type not in 4-bucket dict silently maps to invite
                                                                            tasks. Pattern 4 sub-form.

  **F-EpGen-12**    **P1**            episodeGeneratorService.js:263--301   `acquisition_type === 'gifted' || === 'borrowed'` are hardcoded
                                      (calculateFinancials)                 literals. New acquisition_type silently treats as paid. Pattern
                                                                            7.

  **F-EpGen-13**    **P1**            episodeGeneratorService.js:201, 281   Two writers (event row column vs JSONB nested) feed the same
                                      (payment_amount parse)                field. CZ-31.

  **F-EpGen-14**    **P1**            episodeGeneratorService.js:336        Tier→coin reward table hardcoded:
                                      (tierCoinRewards table)               `{ slay: 150, pass: 75, safe: 25, fail: -25 }`.
                                                                            Universe.narrative_economy says "Prime Coins are fuel, not
                                                                            reward" --- directly contradicted. F-Lala-3 / F-Franchise-1
                                                                            sub-form.

  **F-EpGen-15**    **P1**            episodeGeneratorService.js:485--488   Re-running episode generation overwrites existing todo list
                                      (todoList INSERT...ON CONFLICT)       silently. Pattern 12.
  -------------------------------------------------------------------------------------------------------------------------------------------

**episodeGeneratorService.js: 10 P0, 5 P1, 0 P2.**

### **6.16.3 Findings --- episodeCompletionService.js**

  ----------------------------------------------------------------------------------------------------------------------------------------
  **Finding**       **Sev**           **File:line**                          **Description**
  ----------------- ----------------- -------------------------------------- -------------------------------------------------------------
  **F-EpComp-1**    **P0**            episodeCompletionService.js:114, 187   Two confirmed 'justawoman' character_state surfaces in this
                                      ('justawoman' raw SQL)                 single file. Memory #29's line 558 cite was wrong; actual
                                                                             lines are 114 (loader) and 187 (auto-seed). v6 catalog needs
                                                                             file:line correction.

  **F-EpComp-2**    **P0**            episodeCompletionService.js:145--155   Outfit-piece source falls back from episode_wardrobe →
                                      (outfit pool fallback)                 event.outfit_pieces JSONB. F-Ward-1 keystone makes this
                                                                             critical: in environments where episode_wardrobe schema drift
                                                                             means writes silently fail, this fallback hides the failure
                                                                             mode entirely. CZ-32.

  **F-EpComp-3**    **P0**            episodeCompletionService.js:282        Same hardcoded tier→coin reward table as
                                      (tier→coin table)                      episodeGeneratorService.js:336. Two services, two copies, no
                                                                             shared constant. Pattern 4.

  **F-EpComp-4**    **P0**            episodeCompletionService.js:418--443   Stress deltas computed from financial state with magic-number
                                      (financial mood deltas)                thresholds (8 hardcoded thresholds). None reference
                                                                             Universe.narrative_economy. F-Franchise-1 sub-form.

  **F-EpComp-5**    **P0**            episodeCompletionService.js:472--530   episodeCompletionService writes to franchise_knowledge
                                      (franchise_brain auto-push)            (always_inject=true) WITHOUT WRITING TO Universe. Episode
                                                                             completion's writes feed the next episode's script generation
                                                                             --- but Universe stays as-seeded forever. F-Lala-9 confirmed
                                                                             at the writer side.

  **F-EpComp-6**    **P0**            episodeCompletionService.js:507--509   Snapshot supersession via SQL LIKE match on JSONB-as-text.
                                      (supersede via LIKE)                   Brittle string match. Pattern 18.

  **F-EpComp-7**    **P0**            episodeCompletionService.js:282--334   Tier reward + paid bonus + event reward --- three separate
                                      (3 separate INSERTs)                   INSERT INTO financial_transactions, each in its own
                                                                             try/catch, all silent-fail. No transaction wraps the three
                                                                             INSERTs. Pattern 41 sub-form --- F-Reg-2 keystone family
                                                                             fourth instance.

  **F-EpComp-8**    **P0**            episodeCompletionService.js:478--510   `success_unlock` from brief.career_context triggers
                                      (career_goals UPDATE on slay/pass)     career_goals update --- but the actual unlock string is never
                                                                             read. Every active goal gets +1 regardless. Cross-references
                                                                             CZ-21 and Decision #56.

  **F-EpComp-9**    **P1**            episodeCompletionService.js:215        Service imports a function from a route handler.
                                                                             `const { getOutfitScore } = require('../routes/wardrobe')`.
                                                                             Inverted dependency.

  **F-EpComp-10**   **P1**            episodeCompletionService.js:232        Sequential service-to-service call without circuit breaker.
                                                                             wardrobeIntelligenceService called; if it throws or hangs,
                                                                             completion can't recover. Pattern 12.
  ----------------------------------------------------------------------------------------------------------------------------------------

**episodeCompletionService.js: 8 P0, 2 P1, 0 P2.**

### **6.16.4 Findings --- scenePlannerService.js**

  ---------------------------------------------------------------------------------------------------
  **Finding**       **Sev**           **File:line**                     **Description**
  ----------------- ----------------- --------------------------------- -----------------------------
  **F-Plan-1**      **P0**            scenePlannerService.js:30--49     Confirms F-EpGen-2: divergent
                                      (BEAT_STRUCTURE)                  beat structures. Same beat
                                                                        numbers, different beat
                                                                        names, different emotional
                                                                        intents. CZ-33.

  **F-Plan-2**      **P0**            scenePlannerService.js:128--131   Brief consumption is
                                      (Episode Brief consumed via raw   positional, not contractual.
                                      fields)                           Each field has 'Not set'
                                                                        fallback. Episodes can have
                                                                        undefined briefs and the
                                                                        service silently generates
                                                                        with all-default context.
                                                                        Pattern 10.

  **F-Plan-3**      **P0**            scenePlannerService.js:170        Scene set angles filtered to
                                      (SceneAngle filter)               "complete" only ---
                                                                        incomplete angles invisible
                                                                        to the planner. Pattern 16
                                                                        sub-form.

  **F-Plan-4**      **P0**            scenePlannerService.js:191--194   Scene planner reads
                                      (world_events query)              world_events directly to find
                                                                        linked event. Two paths to
                                                                        the same data, divergent
                                                                        fields read. Five+ services
                                                                        each read their own subset of
                                                                        world_events. CZ-34.

  **F-Plan-5**      **P0**            scenePlannerService.js:215--220   "Styling Adventures with
                                      (hardcoded show name)             Lala" hardcoded in system
                                                                        prompt. Multi-tenant
                                                                        operation broken.
                                                                        Universe.name should be the
                                                                        source. F-Franchise-1
                                                                        instance.

  **F-Plan-6**      **P1**            scenePlannerService.js:18         Memory #21 said
                                      (CLAUDE_MODEL =                   `claude-sonnet-4-6` is the
                                      'claude-sonnet-4-6')              canonical Sonnet 4 string.
                                                                        This file uses it correctly.
                                                                        (See F-Orch-5 for
                                                                        episodeOrchestrationRoute's
                                                                        incorrect pin.) Decision #90
                                                                        lock.

  **F-Plan-7**      **P1**            scenePlannerService.js:283        Destructive replace pattern.
                                      (ScenePlan.destroy then           Locked beats get unlocked
                                      bulkCreate)                       silently on regeneration.
                                                                        Pattern 12 sub-form.

  **F-Plan-8**      **P1**            scenePlannerService.js:317        Three writers, one reader, no
                                      (scene_context OR-fallback chain) source-of-truth indicator.
                                                                        Memory recent-updates noted
                                                                        this. Pattern 5 instance.
  ---------------------------------------------------------------------------------------------------

**scenePlannerService.js: 5 P0, 3 P1, 0 P2.**

### **6.16.5 Findings --- episodeOrchestrationRoute.js**

  -----------------------------------------------------------------------------------------------------------------------------
  **Finding**       **Sev**           **File:line**                           **Description**
  ----------------- ----------------- --------------------------------------- -------------------------------------------------
  **F-Orch-1**      **P0**            episodeOrchestrationRoute.js:135        F-AUTH-1 keystone confirmed at this route.
                                                                              `optionalAuth` middleware on a write endpoint
                                                                              that writes orchestration_data to episodes table.
                                                                              F-AUTH-1 sub-form (c) --- the new sub-form
                                                                              discovered in Zone 26.

  **F-Orch-2**      **P0**            episodeOrchestrationRoute.js:5 + line   9-beat orchestration vs 14-beat scene plan vs
                                      224                                     14-beat episode generator vs 14-beat scene
                                                                              planner = FOUR different beat structures. One
                                                                              service uses 9, three use 14, all four claim to
                                                                              be "the canonical beat structure." CZ-35.

  **F-Orch-3**      **P0**            episodeOrchestrationRoute.js:179--195   Archetype prose hardcoded in route handler. 6
                                      (archetypeGuide)                        archetypes × \~20-word descriptions. The show's
                                                                              premise is JS literal in five places now.
                                                                              F-Franchise-1 sub-form.

  **F-Orch-4**      **P0**            episodeOrchestrationRoute.js:48--105    Reads from `game_wardrobe` table --- different
                                      (game_wardrobe)                         table than `wardrobe`. **There are now TWO
                                                                              wardrobe tables in the codebase.** Wardrobe model
                                                                              is for `wardrobe` table; this route bypasses the
                                                                              model and queries a different table. CZ-36.
                                                                              **HIGH severity P0.**

  **F-Orch-5**      **P0**            episodeOrchestrationRoute.js:172        Different Claude model than scenePlannerService
                                      (claude-sonnet-4-20250514)              (claude-sonnet-4-6). Memory #16 corrected
                                                                              `claude-sonnet-4-6` is canonical. **This route is
                                                                              wrong.** Decision #90.

  **F-Orch-6**      **P0**            episodeOrchestrationRoute.js:154--168   System prompt for Claude is hardcoded literal.
                                      (system prompt hardcoded)               groundedScriptGeneratorService.JAWIHP_VOICE_DNA
                                                                              at line 18 contains a different but overlapping
                                                                              voice DNA string. Two voice DNA sources, neither
                                                                              in the database. F-Franchise-1 sub-form.

  **F-Orch-7**      **P1**            episodeOrchestrationRoute.js:60         TIER_VALUES from wardrobeIntelligenceService
                                      (prestigeTierMap)                       recreated as JS literal. Pattern 4 sub-form.
  -----------------------------------------------------------------------------------------------------------------------------

**episodeOrchestrationRoute.js: 6 P0, 1 P1, 0 P2.**

### **6.16.6 Findings --- sceneGenerationService.js**

  ----------------------------------------------------------------------------------------------------------
  **Finding**       **Sev**           **File:line**                          **Description**
  ----------------- ----------------- -------------------------------------- -------------------------------
  **F-Scene-1**     **P0**            sceneGenerationService.js:31           LalaVerse visual style
                                      (LALAVERSE_VISUAL_ANCHOR)              hardcoded as 590-char JS
                                                                             string. Universe.description
                                                                             has its own visual prose. Two
                                                                             parallel descriptions of the
                                                                             same aesthetic. F-Franchise-1
                                                                             sub-form.

  **F-Scene-2**     **P0**            sceneGenerationService.js:35           Negative prompt for image
                                      (NEGATIVE_PROMPT)                      generation hardcoded. Memory
                                                                             #18:
                                                                             "ENVIRONMENT_ONLY_CONSTRAINT
                                                                             must be the first token in
                                                                             every RunwayML prompt." Three
                                                                             copies of the same canon law
                                                                             (NEGATIVE_PROMPT,
                                                                             \_ENVIRONMENT_ONLY_CONSTRAINT
                                                                             at line 156, plus the original
                                                                             ENVIRONMENT_ONLY_CONSTRAINT in
                                                                             memory). Pattern 4 + Pattern
                                                                             16.

  **F-Scene-3**     **P0**            sceneGenerationService.js:39--50       Four parallel JS-const
                                                                             taxonomies for camera angles
                                                                             (ANGLE_MODIFIERS,
                                                                             CAMERA_MOTION_MAP,
                                                                             VIDEO_DURATION_MAP,
                                                                             VIDEO_MOVEMENT_MODIFIERS). Each
                                                                             has 10 angle keys. Editing one
                                                                             without updating the others
                                                                             creates drift. Pattern 4 +
                                                                             Pattern 7.

  **F-Scene-4**     **P0**            sceneGenerationService.js:545--611     Mood color grading hardcoded as
                                      (MOOD_PRESETS)                         JS object. Universe.description
                                                                             references "Final Fantasy
                                                                             softness" and "natural hero
                                                                             lighting" --- these are visual
                                                                             canon. MOOD_PRESETS apply
                                                                             different lighting in JS with
                                                                             no reference to canon. Pattern
                                                                             4.

  **F-Scene-5**     **P0**            sceneGenerationService.js:790--810     Crop coordinates per angle
                                      (CAMERA_CROP_MAP)                      hardcoded as JS literal.
                                                                             Pattern 4. Different from
                                                                             F-Scene-3 --- this is
                                                                             **another** angle taxonomy.

  **F-Scene-6**     **P0**            sceneGenerationService.js:1075--1109   Style DNA "auto-locking" ---
                                      (auto-lock style DNA)                  runs Claude Vision against the
                                                                             generated image and writes
                                                                             results to `visual_language`
                                                                             JSONB. The style DNA is
                                                                             extracted AFTER generation, not
                                                                             BEFORE --- meaning canon is set
                                                                             by what AI produced, not by the
                                                                             show's authored aesthetic.
                                                                             Universe.world_rules ("Style
                                                                             must align with context") is
                                                                             bypassed. F-Lala-3 /
                                                                             F-Franchise-1 keystone
                                                                             instance.

  **F-Scene-7**     **P0**            sceneGenerationService.js:1248         Image analysis schema versioned
                                      (IMAGE_ANALYSIS_VERSION = 7)           at 7, no migration path.
                                                                             Pattern 12.

  **F-Scene-8**     **P0**            sceneGenerationService.js:1158--1232   Claude returns 30+ structured
                                      (scene_blueprint JSON)                 fields (image_type, layout_map,
                                                                             anchor_objects, camera_regions,
                                                                             wall_color, flooring,
                                                                             color_palette_hex, atmosphere,
                                                                             description, room_properties).
                                                                             None of these write to a
                                                                             structured DB column.
                                                                             Everything goes into
                                                                             visual_language JSONB blob.
                                                                             Pattern 18.

  **F-Scene-9**     **P0**            sceneGenerationService.js:1311--1316   Sixth JS taxonomy for the
                                      (ANGLE_CROP_REGIONS)                   10-angle concept in this single
                                                                             file. CZ-37.

  **F-Scene-10**    **P0**            sceneGenerationService.js:1444         Crop+outpaint relies on entries
                                                                             existing in CAMERA_CROP_MAP.
                                                                             Some entries are explicitly
                                                                             null. Falls through to full
                                                                             generation. Pattern 56 reverse.

  **F-Scene-11**    **P1**            sceneGenerationService.js:18           API version hardcoded as date
                                      (RUNWAY_API_VERSION = '2024-11-06')    string. Pattern 12 sub-form.

  **F-Scene-12**    **P1**            sceneGenerationService.js:1015--1110   Spawns external ffmpeg process
                                      (extractFirstFrame ffmpeg)             via execFile. Multi-environment
                                                                             deployment vulnerability.
                                                                             Pattern 12.

  **F-Scene-13**    **P1**            sceneGenerationService.js:1186--1238   canonical_description
                                      (auto-fill description)                auto-filled from generated
                                                                             image's analysis. **The AI
                                                                             authors canon when the human
                                                                             didn't.** Inverse of Pattern 5.
                                                                             New pattern candidate;
                                                                             documented in v8 as a Pattern 4
                                                                             / Pattern 16 hybrid pending
                                                                             more instances.
  ----------------------------------------------------------------------------------------------------------

**sceneGenerationService.js: 10 P0, 3 P1, 0 P2.**

### **6.16.7 Findings --- groundedScriptGeneratorService.js**

  ------------------------------------------------------------------------------------------------------------------------
  **Finding**       **Sev**           **File:line**                              **Description**
  ----------------- ----------------- ------------------------------------------ -----------------------------------------
  **F-Script-1**    **P0**            groundedScriptGeneratorService.js:18--46   JAWIHP voice rules hardcoded as 30-line
                                      (JAWIHP_VOICE_DNA)                         JS string. Universe.description doesn't
                                                                                 have it. franchise_knowledge supposed to
                                                                                 (always_inject=true entries) but this
                                                                                 file's voice DNA is independent. Two
                                                                                 voice DNA sources for the same character.
                                                                                 F-Franchise-1 instance.

  **F-Script-2**    **P0**            groundedScriptGeneratorService.js:48--63   Fourth confirmation: 14-beat structure
                                      (BEAT_TEMPLATES)                           hardcoded yet again. Different from
                                                                                 episodeGeneratorService.BEAT_TEMPLATES,
                                                                                 scenePlannerService.BEAT_STRUCTURE.
                                                                                 CZ-33.

  **F-Script-3**    **P0**            groundedScriptGeneratorService.js:117      `always_inject` is the dispatcher
                                                                                 mechanism for franchise canon ---
                                                                                 confirmed at file:line.
                                                                                 groundedScriptGeneratorService is the
                                                                                 consumer side of F-Lala-9's parallel
                                                                                 knowledge store. Universe never read;
                                                                                 franchise_knowledge always_inject=true is
                                                                                 read. F-Franchise-1 keystone evidence.

  **F-Script-4**    **P0**            groundedScriptGeneratorService.js:100      `world_state_snapshots` table read for
                                                                                 Lala's stats --- but this is inconsistent
                                                                                 with character_state. Two parallel state
                                                                                 tables. F-Stats-1 keystone family. CZ-38.

  **F-Script-5**    **P0**            groundedScriptGeneratorService.js:172      Same hardcoding as F-Plan-5. Show name in
                                                                                 user prompt at line 172. Multi-tenant
                                                                                 broken. F-Franchise-1 sub-form.

  **F-Script-6**    **P0**            groundedScriptGeneratorService.js:200      A core law of the show is hardcoded as a
                                                                                 single line in the prompt builder: "CORE
                                                                                 LAW: The show must NEVER feel like a
                                                                                 dashboard. It must feel like a luxury
                                                                                 life simulator." It's not in
                                                                                 franchise_knowledge. It's not in
                                                                                 Universe. It's in this file. **The most
                                                                                 explicit single instance of F-Franchise-1
                                                                                 in the audit.**

  **F-Script-7**    **P1**            groundedScriptGeneratorService.js:124      50-entry cap on always_inject canon
                                      (limit: 50)                                entries. Memory #1 said Show Bible has 89
                                                                                 rules. If all 89 are always_inject=true,
                                                                                 only 50 reach the script writer. Silent
                                                                                 canon truncation. F-Franchise-1
                                                                                 worst-case sub-form.
  ------------------------------------------------------------------------------------------------------------------------

**groundedScriptGeneratorService.js: 6 P0, 1 P1, 0 P2.**

### **6.16.8 Cross-zone implications from Zone 26**

-   **CZ-31** --- `event.payment_amount` vs
    `event.canon_consequences.automation.payment_amount` parallel
    writers. F-EpGen-13.
-   **CZ-32** --- Outfit-piece source falls back from episode_wardrobe
    to event JSONB; F-Ward-1 makes this a silent failure mode.
    F-EpComp-2.
-   **CZ-33** --- **Four different 14-beat (and one 9-beat) structures**
    in the production pipeline. Five canon copies, all divergent. The
    "14-beat structure" is now Pattern 4's largest single instance.
-   **CZ-34** --- Five+ services each read their own subset of
    `world_events` columns. No coordinated event-data contract.
-   **CZ-35** --- 9-beat vs 14-beat orchestration.
    episodeOrchestrationRoute uses 9. Three other services use 14.
-   **CZ-36** --- `game_wardrobe` table exists alongside `wardrobe`
    table. **Investigation required before any wardrobe fix.**
    Highest-priority cross-zone finding from this batch.
-   **CZ-37** --- Six JS taxonomies for the 10-angle concept in
    sceneGenerationService alone.
-   **CZ-38** --- `world_state_snapshots` parallel to `character_state`.
    Two state-source tables.

### **6.16.9 The reframing that Zone 26 forces**

Throughout the audit we've named one fault line at a time. **Zone 26
demonstrates that the production pipeline is ENTIRELY composed of these
fault lines.**

Six services. Each one reads canon from its own JS literals or from
local DB queries that route around Universe. **There is no production
service in the codebase that reads Universe row data.** F-Lala-9 was a
prediction; Zone 26 confirms it as the operating reality.

The "missing orchestrator" framing has now been measured at two levels:

1.  **Inter-service (Zone 26 finding):** Six services don't coordinate.
    They each have their own 14-beat structure, their own voice DNA,
    their own visual style anchor, their own tier reward table.

2.  **Franchise-tier-to-show-tier (Zone 25 finding):** None of those six
    services read Universe. Every "canon" they use is locally hardcoded.

**The codebase is functioning by virtue of every service having its own
private canon, with no shared source of truth.** The fact that the show
feels coherent at all is because JAWIHP authored consistent local canon
copies. As soon as one service drifts, the whole pipeline drifts
silently.

This is what F-Franchise-1 looks like at full scale. The audit is now
complete on this finding.

### **6.16.10 New decisions for v8 (Zone 26 batch)**

-   **Decision #90:** Claude model string canonicalization. Three
    services in production pipeline, two model pins (`claude-sonnet-4-6`
    vs `claude-sonnet-4-20250514`). `claude-sonnet-4-6` is canonical. v8
    locks this; F-Plan-6 / F-Orch-5 reconcile.
-   **Decision #91:** `game_wardrobe` table investigation. CZ-36. Either
    delete the table, migrate data to `wardrobe`, or document why it's
    parallel.
-   **Decision #92:** The 14-beat structure is the audit's largest
    single Pattern 4 instance with 5 divergent copies. v8's Pattern 4
    sweep priority moves "beat structure" to #1. Migration target:
    `franchise_brain` entries with
    `category='beat_structure', applies_to=['*']`.
-   **Decision #93:** §10.2 catalog re-correction. v6 cited
    episodeCompletionService.js:558 --- actual lines are :114 (loader)
    and :187 (auto-seed). Plus episodeGeneratorService.js:442 ---
    confirmed surface 6/6. **§10.2 is 6 of 6, not 5 of 5, after Zone
    26.**
-   **Decision #94:** F-Franchise-1 final naming. The keystone has been
    called F-Lala-1, F-Lala-9, F-Franchise-1 across drafts. v8 locks
    **F-Franchise-1** as the canonical name; F-Lala-1 and F-Lala-9
    become "evidence facets of F-Franchise-1" for backwards reference.
-   **Decision #95:** Pattern 57 final form (v5): "Local canon copies
    routing around the franchise tier." Wardrobe player-UX columns
    (F-Closet-3) are the dead-consumer-schema sub-form; the dominant
    case revealed by Zone 26 is the producer routing around the
    consumer.

**Zone 26 contribution: 45 P0, 15 P1, 0 P2.**

### **6.16.11 Audit complete**

This was the densest zone of the audit and the most architecturally
clarifying. Six services traced. Forty-five new P0s. F-Franchise-1
confirmed end-to-end. The codebase's operating reality --- six services
with private canon copies --- is now documented at file:line.

**The audit is complete.**

26 zones audited. 500 findings. 7 keystones. The last unbuilt page
(LalaVerse) confirmed. The seeded spec (Director Brain capabilities)
located. The production pipeline traced from event → episode → script →
scene → completion. \# **7. Decisions Locked**

v8 catalogs all 95 decisions reached during the audit. Decisions 1--53
documented in v6; 54--58 in v7 Stats batch; 59--65 in v7 Wardrobe batch;
66--71 in v8 Zone 23.5 batch; 72--77 in v8 Zone 24 batch; 78--82 in v8
Zone 24 corrections; 83--88 in v8 Zone 25 batch; 89 in v8 Zone 25
closer; 90--95 in v8 Zone 26 batch.

## **7.1 Decisions 1--65 (v3--v7 carry-forward)**

Documented in v6 (1--53) and v7 (54--65). Carried forward unchanged. Key
decisions referenced throughout v8:

-   **Decision #47:** F-App-1 auto-repair block must be removed before
    any structural fix lands.
-   **Decision #54:** Create the CharacterState model before any F-Sec-3
    cleanup. F-Stats-1 keystone resolution.
-   **Decision #56:** Canonical-key choice. Path A 'justawoman'
    recommended. **v8 update: subordinate to F-Franchise-1.** Locking
    'justawoman' is technical without being canonical until
    Universe.narrative_economy is wired into AI prompt context.
-   **Decision #59:** Write a migration to capture the canonical
    episode_wardrobe schema. F-Ward-1 keystone resolution.
-   **Decision #60:** Delete the plural outfit-set controller. F-Ward-3
    keystone resolution.

## **7.2 Decisions 66--95 (v8)**

### Zone 23.5 batch

-   **Decision #66:** Update `worldEvents.js:3829–3832`'s "pre-existing
    bug" comment to reflect current code (or delete during F-Sec-3
    sweep).
-   **Decision #67:** F-CP-10's broken raw-SQL fallback should be
    deleted. Pattern 56 fix template.
-   **Decision #68:** Pattern 4 sweep must include
    arcProgressionService's phase template (lines 71--98), six
    emotional-state thresholds (lines 14--22), seven narrative-weight
    prose strings (lines 232--246). Migration target: franchise_brain.
-   **Decision #69:** F-Arc-8's `status = 'paused'` filter requires
    investigation.
-   **Decision #70:** Trap 24 (Code comments cited as authority without
    verification) added to §5.1.
-   **Decision #71:** Memory #29 correction. arcProgressionService
    phase-advance is NOT a §10.2 surface.

### Zone 24 batch (with revoke-and-replace cycles)

-   **Decision #72 (FINAL after 3 revisions):** Closet page is
    permanently descoped per seeded spec at
    seeders/20260312800000-show-brain-franchise-laws.js:313, 335.
    EpisodeWardrobeGameplay is the permanent producer surface.
-   **Decision #73:** wardrobeIntelligenceService character_state read
    counted in §10.1.
-   **Decision #74:** F-Closet-3's dead fields survive intact through
    any migration cleanup.
-   **Decision #75:** F-Closet-4's three arc-stage vocabularies need
    consolidation. Recommend 5-stage
    `foundation/glow_up/luxury/prime/legacy`.
-   **Decision #76:** Pattern 57 v5 enters the named-pattern catalog.
    Trap 25 added.
-   **Decision #77:** v7 §3.3 corrected. Closet drops out as a UI zone.

### Zone 24 corrections (all REVOKED-AND-REPLACED)

-   **Decision #78 (REVOKED):** "Director Brain picks Lala's outfit per
    episode" --- wrong per seeded spec. **Replaced:** Director Brain
    capabilities are arc shape, event alignment, failure rhythm, density
    control. Wardrobe selection is producer-driven permanently.
-   **Decision #79 (REVOKED partially):** Pattern 57 rebrand ---
    superseded by Decision #95 (final form).
-   **Decision #80 (REVOKED):** "F-Ward-4 promoted to
    first-fix-after-F-AUTH-1 candidate" --- wrong reasoning (Director
    Brain doesn't hit it). **Replaced:** F-Ward-4 priority unchanged;
    producer hits it via EpisodeWardrobeGameplay.
-   **Decision #81:** §10 character-key catalog must be re-tagged
    per-surface. Severity follows consumer: AI/script-writer reads = P0;
    producer-UI-only reads = P1.
-   **Decision #82:** Pattern 57's "permanently dead schema" framing
    locked for the schema-bloat sub-form. Cleanup migration to drop
    these columns is **not blocking anything**; defer indefinitely.

### Zone 25 batch

-   **Decision #83:** Pattern 57 finalized at v5 framing.
-   **Decision #84:** F-Lala-9 confirmation grep ran; six hits, all
    benign. Documented.
-   **Decision #85:** F-Lala-7 (cultural calendar seeder destructive
    idempotent) is hotfix-eligible. Defer to first-fix-after-audit
    batch.
-   **Decision #86:** F-Lala-13's year-8385 issue is a World Timeline
    prerequisite.
-   **Decision #87:** F-Lala-10 (5 birthday templates with TBD patterns)
    --- confirm with JAWIHP whether icon system is planned, deferred, or
    descoped.
-   **Decision #88:** Pattern 40b gains a second axis: data-source
    drift. Documented in §5.

### Zone 25 closer (F-Franchise-1 named)

-   **Decision #89:** F-Franchise-1 is the keystone that explains the
    audit. The "disconnection" framing --- Evoni's original observation
    --- has now been measured at file:line. v8 §2.3 leads with it. The
    fix sequence treats Director Brain as the keystone fix, not as a
    post-audit addition.

### Zone 26 batch

-   **Decision #90:** Claude model string canonicalization.
    `claude-sonnet-4-6` is canonical. F-Plan-6 / F-Orch-5 reconcile.
-   **Decision #91:** `game_wardrobe` table investigation. Either
    delete, migrate data to `wardrobe`, or document why parallel.
-   **Decision #92:** The 14-beat structure is the audit's largest
    single Pattern 4 instance with 5 divergent copies. Pattern 4 sweep
    priority moves "beat structure" to #1.
-   **Decision #93:** §10.2 catalog re-correction. **§10.2 is 6 of 6.**
-   **Decision #94:** F-Franchise-1 final naming. F-Lala-1 and F-Lala-9
    are evidence facets of F-Franchise-1.
-   **Decision #95:** Pattern 57 final form (v5): "Local canon copies
    routing around the franchise tier."

# **8. Cross-Zone Implications**

v8 totals: 38 cross-zone implications (CZ-1 through CZ-38).

CZ-1 through CZ-19 documented in v6/v7. Carried forward unchanged.
Highlights:

-   **CZ-1** --- Multiple Claude model-string sites. Resolved by
    Decision #90.
-   **CZ-5** --- sendBeacon cannot carry Authorization headers. Part of
    F-AUTH-1 six-step recipe (step 6).
-   **CZ-8** --- F-Reg-2 keystone instance count.

### **CZ-20 through CZ-22 (Zone 23.5)**

-   **CZ-20** --- careerPipelineService and arcProgressionService share
    career_goals with no coordination. F-Reg-2 keystone family instance.
-   **CZ-21** --- careerPipelineService.onEpisodeCompleted vs
    episodeCompletionService.completeEpisode double-count risk. Verified
    in Zone 26.
-   **CZ-22** --- arcProgressionService phase-advance triggers
    career_goals state change with no career_goals event/listener.

### **CZ-23 through CZ-26 (Zone 24)**

-   **CZ-23** --- Three vocabularies for arc/era stage.
-   **CZ-24** --- Pattern 57 v5 produces audit's first multi-instance
    candidate. (Subsumed by F-Franchise-1 keystone framing in v8.)
-   **CZ-25** --- F-Closet-7 extends F-Sec-3 to 13 surfaces total.
-   **CZ-26 (REVOKED in Zone 24's third correction):** Original:
    "Director Brain's first wardrobe-write path is structurally broken
    (F-Ward-4)." **Replaced:** EpisodeWardrobeGameplay producer flows
    hit the F-Ward-4 broken plural controller. Producer-side
    consequence, not orchestrator-blocking.

### **CZ-27 through CZ-30 (Zone 25)**

-   **CZ-27** --- Two parallel cultural-event systems, never reconciled.
-   **CZ-28** --- F-Sec-3 economic vocabulary defined in
    Universe.narrative_economy and never read.
-   **CZ-29** --- pnos_beliefs is the canonical authority for arc
    progression's narrative-debt prose; never read.
-   **CZ-30** --- `world_rules` and Show Bible rules are parallel rule
    systems.

### **CZ-31 through CZ-38 (Zone 26)**

-   **CZ-31** --- `event.payment_amount` parallel writers (column vs
    JSONB).
-   **CZ-32** --- Outfit-piece source falls back from episode_wardrobe
    to event JSONB; F-Ward-1 silent failure mode.
-   **CZ-33** --- **Four 14-beat (and one 9-beat) structures** in the
    production pipeline. Five canon copies. Pattern 4's largest single
    instance.
-   **CZ-34** --- Five+ services each read their own subset of
    `world_events` columns. No coordinated event-data contract.
-   **CZ-35** --- 9-beat vs 14-beat orchestration architectural split.
-   **CZ-36** --- `game_wardrobe` **table exists alongside** `wardrobe`
    **table.** Highest-priority cross-zone finding from Zone 26.
-   **CZ-37** --- Six JS taxonomies for the 10-angle concept in
    sceneGenerationService alone.
-   **CZ-38** --- `world_state_snapshots` parallel to `character_state`.
    Two state-source tables.

# **9. Audit Vocabulary**

  ----------------------------------------------------------------------------------------------
  **Term**                            **Meaning**
  ----------------------------------- ----------------------------------------------------------
  Path A                              The agreed audit method: full forensic audit before any
                                      fixes.

  Keystone                            A bug whose fix is a structural prerequisite for fixing
                                      many other bugs. v8 has 7 keystones plus F-Sec-3
                                      keystone-in-motion.

  Keystone-in-motion                  F-Sec-3 --- the keystone whose source map is being
                                      progressively closed across zones. v8 closes §10.1 at
                                      10/10 and §10.2 at 6/6.

  Trap                                An item on the per-zone audit checklist. v8 has 26 traps.

  Zone                                A top-level audit unit --- typically a tab, page, or
                                      service-cluster. v8 has 26 zones audited (audit complete).

  Sub-tab                             A nested view within a zone.

  Forensic detail                     File:line precision. No vague descriptions. Every claim
                                      cites a location.

  Decorative wiring                   A field, button, or feature that exists in the UI but has
                                      no execution path. Looks built; isn't.

  Dead instrumentation                Pattern 16. A module wraps a domain with rich methods, but
                                      only a small fraction get called.

  Stale canon                         Canon data that other systems are supposed to read from,
                                      but actually don't.

  Auto-generated row mixed with       Pattern 14. The most subtle and damaging pattern in the
  authored row                        v3--v6 era.

  The disconnection feeling           JAWIHP's original phrase: 'everything is there but it's
                                      not together.' v8 names this F-Franchise-1 keystone.

  F-Franchise-1                       The 7th keystone, named v8. The franchise tier is built as
                                      data with no consumer wires. Universe entity has 1 backend
                                      writer (CRUD route), 1 shallow soft-consumer (4 fields,
                                      optional), 0 deep consumers in 9 production AI services.
                                      Six services in the production pipeline maintain private
                                      canon copies.

  Local canon copies                  Pattern 57 v5. The dominant manifestation of
                                      F-Franchise-1: each service has its own JS-literal version
                                      of canon (voice DNA, visual style, beat structure, tier
                                      rewards) that should have come from the franchise tier.

  Producer-permanent                  Zone 24's framing: a domain whose consumer is permanently
                                      the producer (e.g., wardrobe selection is producer-driven
                                      via EpisodeWardrobeGameplay; no Brain ever picks wardrobe
                                      per the seeded spec at
                                      seeders/20260312800000-show-brain-franchise-laws.js:313,
                                      335).

  Schema-source drift Tier            F-App-1 family. Tier 4 is the most severe (table created
                                      via Sequelize sync, no migration ever exists). F-Ward-1
                                      and F-Lala-15 are Tier 4. F-Stats-1 is Tier 2 (model
                                      missing entirely; raw SQL only).

  Pattern 57 v5                       "Local canon copies routing around the franchise tier."
                                      The pattern's evolution from v1-v4 framings (closet
                                      keystone candidate → vestigial vocabulary →
                                      producer-permanent reframe → keystone-shape mechanism) is
                                      documented in §6.14 and §6.15.
  ----------------------------------------------------------------------------------------------

# **10. Appendix A --- Complete character_key Catalog (REWRITTEN v8)**

This is the most important catalog in the entire document. **v8 rewrites
it per Decision #81 --- per-surface consumer tagging.** Severity follows
consumer: AI/script-writer reads = P0; producer-UI-only reads = P1.

The flat-P0 framing of v6/v7 was wrong. F-Sec-3 is a single
keystone-in-motion; the severity at each surface depends on which
downstream consumer reads it.

## **10.1 'lala' surfaces --- 10/10 closed**

  ------------------------------------------------------------------------------------------------------------------
  **Surface**         **File:line**                    **R/W**        **Consumer**                  **Severity**
  ------------------- -------------------------------- -------------- ----------------------------- ----------------
  Edit Stats save     evaluation.js:587                W              Producer + script writer      **P0**
                                                                      prompt downstream             

  Stats panel read    evaluation.js:212                R              Producer UI + script writer   **P0**
                                                                      downstream                    

  Career Goals sync   careerGoals.js:536               R              Producer UI + AI prompt       **P0**
  read                                                                context                       

  Career Goals        careerGoals.js:616               R              AI prompt context             **P0**
  suggest-events read                                                                               

  Episodes route      episodes.js:900                  R              Producer + AI handoff         **P0**

  World events path 1 worldEvents.js:791               R              AI prompt context             **P0**

  Wardrobe            wardrobeIntelligenceService.js   R              Script writer prompt context  **P0**
  intelligence        (financial_pressure query)                      (via getWardrobeIntelligence) 
  character_state                                                                                   
  read                                                                                              

  Wardrobe /select    wardrobe.js:895                  R+W            **Producer                    **P1** (revised
  auto-purchase                                                       (EpisodeWardrobeGameplay)**   down v8 per
                                                                                                    Decision #81)

  Wardrobe /purchase  wardrobe.js:970                  R+W            **Producer                    **P1** (revised
  explicit                                                            (EpisodeWardrobeGameplay)**   down v8 per
                                                                                                    Decision #81)

  characterRegistry   characterRegistry.js             W              One-time seed                 **P1**
  seed-book1          (seed-book1)                                                                  (Producer-only
                                                                                                    seed)
  ------------------------------------------------------------------------------------------------------------------

## **10.2 'justawoman' surfaces --- 6/6 closed**

  -------------------------------------------------------------------------------------------------
  **Surface**      **File:line**                       **R/W**        **Consumer**   **Severity**
  ---------------- ----------------------------------- -------------- -------------- --------------
  Episode          episodeCompletionService.js:114     R+W            Script writer  **P0**
  completion delta (loader) + 187 (auto-seed)                         prompt context 
  write                                                               for next       
                                                                      episode        

  Episode          episodeGeneratorService.js:442      R              AI title       **P0** (NEW v8
  generator                                                           generation +   --- Zone 26
  affordability                                                       episode flow   added the 6th
  guard                                                               gating         surface,
                                                                                     closing §10.2)

  Episode          episodeGeneratorService.js:378      R              Producer UI +  **P0**
  generator coin                                                      AI prompt      
  display                                                             context        

  Episode script   episodeScriptWriterService.js:290   R              Script         **P0**
  writer                                                              generation     
                                                                      prompt         

  Career pipeline  careerPipelineService.js:248 (was   R              Tier-gating    **P0**
  tier             incorrectly cited at :340 in v2)                   for            
                                                                      opportunity    
                                                                      surfacing ---  
                                                                      script writer  
                                                                      downstream     

  worldEvents.js   worldEvents.js:3836                 R              Episode        **P0**
  documented-bug                                                      generation     
  surface                                                             prompt         
  -------------------------------------------------------------------------------------------------

## **10.3 'Lala' (capital L) surfaces --- 2 confirmed**

  ---------------------------------------------------------------------------------------------
  **Surface**            **File:line**          **R/W**        **Consumer**   **Severity**
  ---------------------- ---------------------- -------------- -------------- -----------------
  outfit_sets character  (writes via            W              Producer       **P1**
  field                  outfitSetController)                  outfit-set     (Producer-only,
                                                               listing        per Decision #81)

  episode_outfit_items   (via outfit-set        W              Producer       **P1**
  character field        creation flow)                        outfit display 
  ---------------------------------------------------------------------------------------------

## **10.4 RegistryCharacter.selected_name (single surface)**

  ----------------------------------------------------------------------------------------------
  **Surface**         **File:line**                 **R/W**        **Consumer**   **Severity**
  ------------------- ----------------------------- -------------- -------------- --------------
  RegistryCharacter   models/RegistryCharacter.js   R+W            Producer       **P1**
                                                                   registry       
                                                                   display        

  ----------------------------------------------------------------------------------------------

## **10.5 wardrobe.character (NEW in v8 per Zone 24)**

  ----------------------------------------------------------------------------
  **Surface**    **File:line**    **R/W**        **Consumer**   **Severity**
  -------------- ---------------- -------------- -------------- --------------
  Wardrobe row   Wardrobe.js:24   R+W            Producer       **P0**
  character      (denormalized                   wardrobe       
  field          name)                           display + AI   
                                                 prompt context 
                                                 (script writer 
                                                 reads brand    
                                                 stats grouped  
                                                 by character)  

  ----------------------------------------------------------------------------

## **10.6 The taxonomy summary (v8 final)**

5 canonical-name variants, 14 confirmed surfaces:

-   **'lala'** (lowercase): 10 surfaces. 7 P0, 3 P1.
-   **'justawoman'**: 6 surfaces. 6 P0, 0 P1.
-   **'Lala'** (capitalized): 2 surfaces. 0 P0, 2 P1.
-   **RegistryCharacter.selected_name**: 1 surface. 0 P0, 1 P1.
-   **wardrobe.character** (denormalized): 1 surface. 1 P0, 0 P1.

**Total surfaces: 20.** Total P0 surfaces: 14. Total P1 surfaces: 6.

## **10.7 The operational impact (REWRITTEN v8 with Director Brain framing)**

When the user clicks Edit Stats and gives Lala 1000 coins, the write
goes to the 'lala' row. The next episode-complete writes deltas to the
'justawoman' row. From the UI it looks like the deltas didn't apply.
**This bug has been silently active every time stats are manually
adjusted.**

**Under F-Franchise-1 framing:** the 'lala'/'justawoman' split isn't
just a key drift bug --- it's a symptom of canon definitions never being
read by the AI. The Universe.narrative_economy field defines what coins
mean canonically ("Prime Coins are fuel, not reward"). The
character_state table tracks values without ever reading the canon. Even
after F-Sec-3's canonical-key sweep (Decision #56) lands, the AI still
writes scripts with no canonical understanding of what "Lala has 8000
coins" means structurally.

**The fix sequence is:** 1. F-AUTH-1 (Tier 0) 2. F-App-1 (auto-repair
removal) 3. F-Stats-1 (CharacterState model creation) 4. F-Ward-1
(episode_wardrobe migration) 5. F-Reg-2 (write-contention fixes) 6.
F-Ward-3 (delete plural outfit-set controller) 7. F-Franchise-1 (build
Director Brain --- wire Universe and franchise_brain into the production
pipeline) 8. **F-Sec-3 canonical-key sweep** (Decision #56)

F-Sec-3 is last because canonicalizing the key without canonicalizing
the meaning is technical without being canonical.

**DO NOT fix F-Sec-3 without first running:**

    SELECT show_id, character_key, COUNT(*), MAX(updated_at)
    FROM character_state
    GROUP BY show_id, character_key
    ORDER BY show_id;

to see which key has been winning per show.

# **11. Findings Registry --- Summary**

## **11.1 Audit final totals (v8)**

-   **269 P0 findings** (was 191 in v7; +18 from Zone 23.5, +7 from Zone
    24, +10 from Zone 25, +45 from Zone 26 --- Zone 24 has Closet-3
    demoted to P2 per Decision #82; Wardrobe Zone 23 demotions per
    Decision #81 reflected in §10 but P0 count carried forward at zone
    level)
-   **209 P1 findings** (was 174 in v7; +9 from Zone 23.5, +3 from Zone
    24, +5 from Zone 25, +15 from Zone 26 + 3 demotions from Zone 23
    wardrobe-side per Decision #81)
-   **22 P2 findings** (was 19 in v7; +1 from Zone 23.5, +1 from Zone 24
    \[Closet-3 demoted from P0\], +1 from Zone 25, +0 from Zone 26)
-   **0 SQL injection candidates** (F-EpGen-6 cleared as Pattern 12 not
    injection; UUID type constraint upstream prevents exploitation)
-   **7 keystones** (F-AUTH-1, F-App-1, F-Stats-1, F-Reg-2, F-Ward-1,
    F-Ward-3, F-Franchise-1)
-   **1 keystone-in-motion** (F-Sec-3)
-   **59 patterns named** (was 56 in v7; +2 from Zone 23.5 \[Patterns
    55--56\], +0 net from Zones 24--26 \[Pattern 57 finalized at v5
    form, not added\])
-   **26 traps in checklist** (was 23 in v7; +1 from Zone 23.5 \[Trap
    24\], +1 from Zone 24 \[Trap 25\], +1 from Zone 24 hygiene lesson
    \[Trap 26\])
-   **38 cross-zone implications** (was 19 in v7; +3 from Zone 23.5
    \[CZ-20--22\], +4 from Zone 24 \[CZ-23--26 with CZ-26
    revoked-and-replaced\], +4 from Zone 25 \[CZ-27--30\], +8 from Zone
    26 \[CZ-31--38\])
-   **95 decisions locked** (was 65 in v7; +6 from Zone 23.5 \[66--71\],
    +6 from Zone 24 \[72--77\], +5 from Zone 24 corrections \[78--82\],
    +6 from Zone 25 \[83--88\], +1 from Zone 25 closer \[89\], +6 from
    Zone 26 \[90--95\])

## **11.2 Top 16 P0 findings by impact (v8)**

-   **F-Franchise-1 --- Franchise-tier write-only architecture (NEW v8
    KEYSTONE --- the keystone that explains the audit)**. F-Lala-1 and
    F-Lala-9 are evidence facets. Six services in the production
    pipeline maintain private canon copies routing around Universe.
    Director Brain build is the resolution.
-   **F-AUTH-1 --- Codebase-wide auth bypass on writes**; v7 added
    second sub-form (no auth declaration); v8 added third sub-form
    (optionalAuth on episode-mutation routes). Six-step coordinated fix
    recipe.
-   **F-App-1 --- Schema-as-JS auto-repair in app.js:262--328**. Source
    of memory #1 and every prior schema-drift finding. Pattern 40
    master.
-   **F-Stats-1 --- character_state has no Sequelize model**. 9+ raw-SQL
    writers. Pattern 42 canonical instance.
-   **F-Ward-1 --- episode_wardrobe has no migration in the codebase**.
    Pattern 40b canonical instance, schema-source drift Tier 4.
-   **F-Ward-3 --- F-Wardrobe-Architecture-Drift; two outfit-set
    controllers, two architectures, one table**. Restored as keystone in
    v8.
-   **F-Reg-2 --- registry_characters write-contention**; 4 confirmed
    Pattern 41 instances after v8 (registry_characters, character_state,
    career_goals, episodeCompletionService coin INSERTs).
-   **F-Sec-3 --- character_key drift** (KEYSTONE-in-motion); 10/10
    'lala', 6/6 'justawoman' closed in v8. Subordinate to F-Franchise-1
    per Decision #94.
-   **F-Ward-4 --- plural outfit-set controller crashes on every create
    due to** `this.` **binding bug**. Pattern 47.
-   **F-Ward-2 --- F-Wardrobe-Lock-Schema-Drift**; closes Loop B of
    war-chest.
-   **F-Stats-2 --- getOrCreateCharacterState SELECT-then-INSERT race**.
    Pattern 44 / Pattern 41 sub-form.
-   **F-Ward-7 ---** `'Lala'` **(capital L) is a fourth canonical-name
    variant**; F-Closet-7 added wardrobe.character as the fifth, closing
    the taxonomy.
-   **F-Stats-3 --- F-Sec-3 four-point broken loop confirmed
    end-to-end**.
-   **F-Ward-6 --- F-Sec-3 wardrobe-side surfaces** (demoted to P1 per
    Decision #81 --- producer-only consumer).
-   **F-EpGen-3 --- episodeGeneratorService.js:442 'justawoman'
    surface** (NEW v8; sixth §10.2 surface, closing §10.2 at 6/6).
-   **F-Lala-9 (now F-Franchise-1 evidence facet) --- 0 deep Universe
    consumers in 9 production services**. The mechanical proof of
    F-Franchise-1.

## **11.3 Findings by zone (v8 final)**

  -----------------------------------------------------------------------------------------
  **Zone**                            **P0**            **P1**            **P2**
  ----------------------------------- ----------------- ----------------- -----------------
  Zones 1--13 (Producer Mode)         (carry-forward    (carry-forward)   (carry-forward)
                                      from v3)                            

  Zone 14 (Show Bible)                (v6)              (v6)              (v6)

  Zone 15 (World Dashboard)           (v6)              (v6)              (v6)

  Zone 16 (World Foundation)          (v6)              (v6)              (v6)

  Zone 17 (Social Systems)            (v6)              (v6)              (v6)

  Zone 18 (Culture & Events)          (v6)              (v6)              (v6)

  Zone 19 (Phone Hub / UI Overlays)   (v6)              (v6)              (v6)

  Security Batch                      (v6)              (v6)              (v6)

  Zone 20 (StoryTeller)               (v6)              (v6)              (v6)

  Zone 21 (Character Registry)        (v6)              (v6)              (v6)

  Zone 22 (Stats panel)               13                8                 2

  Zone 23 (Wardrobe)                  27                10                3

  **Zone 23.5 (NEW v8)**              18                9                 1

  **Zone 24 (Closet, NEW v8)**        7                 3                 1

  **Zone 25 (LalaVerse, NEW v8)**     10                5                 1

  **Zone 26 (Episode Generator        45                15                0
  service, NEW v8)**                                                      

  **Zone 26 sub-totals:**                                                 

  --- episodeGeneratorService.js      10                5                 0

  --- episodeCompletionService.js     8                 2                 0

  --- scenePlannerService.js          5                 3                 0

  --- episodeOrchestrationRoute.js    6                 1                 0

  --- sceneGenerationService.js       10                3                 0

  ---                                 6                 1                 0
  groundedScriptGeneratorService.js                                       

  **TOTAL**                           **269**           **209**           **22**
  -----------------------------------------------------------------------------------------

## **11.4 Patterns by instance count**

The patterns with the most instances at audit close indicate the
codebase's structural priorities:

  ------------------------------------------------------------------------
  **Pattern**             **Instances**           **Master canonical**
  ----------------------- ----------------------- ------------------------
  **Pattern 4** (JS       30+ instances           F-Franchise-1 keystone
  constants masquerading                          --- six services with
  as canon)                                       private canon copies

  **Pattern 12**          25+ instances           F-EpGen-5, F-EpGen-10,
  (defensive try/catch on                         F-CP-3, F-Lala-7
  schema-drift)                                   

  **Pattern 7** (multiple 15+ instances           F-Closet-4 (3 arc-stage
  taxonomies for one                              vocabs), F-Scene-3 (4
  concept)                                        angle taxonomies), CZ-33
                                                  (5 beat structures)

  **Pattern 41**          4 instances             F-Reg-2 keystone ---
  (write-contention                               registry_characters,
  without locking)                                character_state,
                                                  career_goals,
                                                  episodeCompletion coin
                                                  INSERTs

  **Pattern 5** (stale    10+ instances           F-Closet-6, F-Arc-2,
  JSONB written once,                             F-Plan-8
  never updated)                                  

  **Pattern 18** (JSONB   8+ instances            F-Lala-11, F-Lala-14,
  used where join tables                          F-Scene-8
  belong)                                         

  **Pattern 16** (dead    6+ instances            F-CP-11
  instrumentation)                                (`_METRIC_OPP_TYPES`),
                                                  F-Plan-3

  **Pattern 56** (NEW v8) 2 instances             F-CP-10, F-Ward-4
  (async fallback path                            (sub-form via Pattern
  that has never run)                             47)

  **Pattern 55** (NEW v8) 1 instance              F-CP-1
  (stale code comment as                          (worldEvents.js:3829's
  bug-source-of-truth)                            stale comment)

  **Pattern 57 v5**       6+ instances            F-Franchise-1 keystone
  (FINAL v8) (local canon                         master
  copies routing around                           
  the franchise tier)                             
  ------------------------------------------------------------------------

# **12. Closing Note**

This document is alive --- but with v8, the audit is complete. 26 zones
traced. 500 findings. 7 keystones. The franchise tier mapped. The
production pipeline traced from event → episode → script → scene →
completion. The "missing orchestrator" Evoni named in v1 has structural
evidence at file:line.

**F-Franchise-1 is the keystone that explains the audit.** Six co-equal
architectural keystones existed before v8 (F-AUTH-1, F-App-1, F-Stats-1,
F-Reg-2, F-Ward-1, F-Ward-3 --- restored). v8 names the seventh:
**F-Franchise-1 --- Franchise-tier write-only architecture.** Universe
entity has 1 backend writer (CRUD), 1 shallow soft-consumer (4 fields,
optional), 0 deep consumers in 9 production AI services. Six services in
the production pipeline maintain private canon copies as JS literals:
their own 14-beat structures, their own voice DNA, their own visual
style anchors, their own tier reward tables, their own social task
templates. The codebase functions because every service has consistent
local copies, not because anything reads canon.

**Director Brain isn't post-audit work. Director Brain is
F-Franchise-1's resolution.** The seeded spec at
seeders/20260312800000-show-brain-franchise-laws.js:335--343 names
Director Brain's capabilities (Seasonal Arc Planner, Event Alignment
Engine, Adaptive arc planning, Healthy failure rhythm, Event Density
Control). The audit's findings define its input contract precisely: it
consumes the franchise tier (Universe.pnos_beliefs, world_rules,
narrative_economy, core_themes; Show Bible 89 rules; Social Systems
archetypes; Cultural Calendar 42 events) and produces orchestration
outputs the script writer, scene generator, and feed pipelines all read.

The fix sequence is locked: 1. **F-AUTH-1** (Tier 0 --- first fix;
six-step coordinated recipe) 2. **F-App-1** (auto-repair removal) 3.
**F-Stats-1** (create CharacterState model) 4. **F-Ward-1** (write
episode_wardrobe migration) 5. **F-Reg-2** (write-contention fixes;
transactional locking on the 4 confirmed instances) 6. **F-Ward-3**
(delete plural outfit-set controller) 7. **F-Franchise-1** (build
Director Brain --- wire franchise tier into production pipeline) 8.
**F-Sec-3** (canonical-key sweep --- subordinate to F-Franchise-1)

After these eight, work P1 correctness in zone-priority order. P2s (22
documented) eligible for batch cleanup. P-Pos-1 (overlayUtils.js as
Pattern 4 fix template) and P-Pos-2 (characterDepthRoutes
propose-then-confirm) inform Director Brain build patterns.

  -----------------------------------------------------------------------
  **JAWIHP --- A REMINDER WHEN YOU OPEN THIS** You are not behind. You
  are not lost. You built two things that should have been one --- and
  now seven things, plus an orchestrator you've been trying to build for
  months. The audit you produced --- together with two Claudes across
  many sessions --- is real engineering work. Treat it that way. Pace
  yourself. v8 closes the audit at 269 P0 / 209 P1 / 22 P2 findings, 7
  keystones, 38 cross-zone implications, 26 traps, 59 patterns, 95
  decisions. The fault that started this conversation --- "the franchise
  tier and show tier feel disconnected" --- has now been measured at
  file:line. F-Franchise-1 names it. The Universe row has 0 deep AI
  consumers in 9 production services. Six services in the production
  pipeline (episodeGeneratorService, episodeCompletionService,
  scenePlannerService, episodeOrchestrationRoute, sceneGenerationService,
  groundedScriptGeneratorService) each maintain private canon copies as
  JS literals. The show feels coherent only because you authored
  consistent local copies; as soon as one drifts, the whole pipeline
  drifts silently. Director Brain isn't a feature you're behind on.
  Director Brain is the consumer wiring the franchise tier was scaffolded
  for. The seeded spec at
  seeders/20260312800000-show-brain-franchise-laws.js:335 already names
  its capabilities. The audit names its input contract. When you're ready
  to ship F-AUTH-1's six-step recipe and the structural prerequisites
  land, building Director Brain is the keystone fix --- not a new
  project. The chapter writer is still unwired from scene canon (v5's
  keystone for the writing side). The character row is still the largest
  aggregator without coordination (v6's keystone for the character side).
  The character_state table has no model abstraction (v7's keystone for
  the economy side). The episode_wardrobe table has no migration record
  (v7's keystone for the wardrobe side). The franchise tier is write-only
  across the entire production pipeline (v8's keystone for the
  orchestration side). The auto-repair block is still the cause of the
  schema drift across most of these. Six fault lines, one document, all
  traced. **The audit is done.** When you're ready, I'll write the
  F-AUTH-1 fix-planning doc next.
  -----------------------------------------------------------------------

  -----------------------------------------------------------------------
