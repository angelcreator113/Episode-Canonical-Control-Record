+-----------------------------------------------------------------------+
| **PRIME STUDIOS**                                                     |
|                                                                       |
| **F-AUTH-1 FIX-PLANNING DOCUMENT**                                    |
|                                                                       |
| *First fix after audit close. Tier 0 keystone.*                       |
|                                                                       |
| *Six-step coordinated single-PR plan.*                                |
+-----------------------------------------------------------------------+

**Document version**

v1.3 --- Single-PR plan, derived from Prime Studios Audit Handoff v8
§4.1. F-Auth-4 Path 1 + F-Auth-5 fold-in + gate-driven deploy sequence
locked.

**Author**

JAWIHP / Evoni --- Prime Studios

**Status**

*READY TO IMPLEMENT --- pending pre-flight verification (Gate G1)*

**1. Executive Summary**

F-AUTH-1 is a codebase-wide auth bypass on writes. It is the Tier 0
keystone in audit handoff v8 §4.1. Every other P0 fix re-deploys
mutation routes; re-deploying mutation routes without auth ships the bug
fix and the unauth surface together. v8 is explicit: **partial execution
is worse than no change.** This plan ships all six steps in one
coordinated PR.

+-----------------------------------------------------------------------+
| **Why this fix is one PR --- not six**                                |
|                                                                       |
| Steps 1--2 (F-Auth-2, F-Auth-3) harden the auth module itself. Steps  |
| 3--5 are the mechanical sweep across three sub-forms. Step 6 is the   |
| frontend coordination (sendBeacon + interceptor strings) that         |
| prevents silent 401s the moment the sweep lands. If sub-form (a)      |
| ships before sub-form (c), every episode-mutation surface still       |
| bypasses auth. If the sweep ships before CZ-5, BookEditor.jsx         |
| silently 401s on every beforeunload save. If the sweep ships before   |
| F-Auth-4 reconciliation, mid-session token refresh stops working. The |
| six steps interlock.                                                  |
+-----------------------------------------------------------------------+

**Scope summary**

-   Fix the codebase-wide auth bypass on writes by closing all three
    F-AUTH-1 sub-forms.

-   Harden middleware/auth.js so misconfiguration is loud (boot-fail)
    and Cognito outages are distinguishable from anonymous traffic.

-   Coordinate the frontend so requireAuth landing does not silently
    break mid-session refresh or beforeunload saves.

-   Close F34 automatically (it is sub-form a inside
    franchiseBrainRoutes.js).

-   Close F-Auth-5 (req.user.sub vs req.user.id drift) as a folded-in
    sub-step of Step 6.

**Out of scope (deferred)**

-   F-Auth-6 --- tokenUse (access vs ID token) gating. Informs but does
    not block. Deferred to follow-up.

-   Director Brain build (F-Franchise-1 resolution). Sequenced after
    F-AUTH-1 + structural prerequisites per Decision #94.

-   Any of the 269 P0 correctness findings outside auth. Sequenced after
    Tier 0.

**2. Keystone Precedence (why this is the first fix)**

Prime Studios Audit Handoff v8 locks F-AUTH-1 as Tier 0. The reasoning,
restated from §4.1 and §12 of v8: every other P0 fix touches mutation
routes. Shipping a P0 fix to a route that still accepts unauthenticated
writes ships the security exposure with the correctness fix. Therefore:
**every correctness fix is blocked on auth.**

v8 also makes the partial-execution warning explicit (§4.1, end of
recipe). Closing optionalAuth without fixing F-Auth-2 ships a server
that silently 401s every authenticated request when env vars are
missing. Closing the sweep without F-Auth-3 means a Cognito outage looks
identical to anonymous traffic. Closing the sweep without CZ-5 means
BookEditor.jsx beforeunload saves silently 401 on every page navigation.
Closing the sweep without F-Auth-4 reconciliation means the frontend
interceptor cannot distinguish AUTH_REQUIRED from AUTH_INVALID_TOKEN and
mid-session refresh degrades silently.

+-----------------------------------------------------------------------+
| **F34 disposition**                                                   |
|                                                                       |
| F34 (unauthenticated destructive writes on /franchise-brain/\*) was   |
| hotfix-offered May 1, 2026 and DECLINED to maintain audit discipline  |
| (Decision #34). v8 reaffirms: F34 closes automatically inside Step 3  |
| (sub-form a) of this plan. No separate F34 hotfix ships. The exposure |
| window is being closed, not patched around.                           |
+-----------------------------------------------------------------------+

**3. The Six Steps**

All six steps land in a single PR. Each step has its own §4.x detail
section below. The steps are listed here in dependency order; the
implementation order is given in §5.

  ---------------------------------------------------------------------------------------------------
  **\#**   **Finding**    **What it does**                         **Surface**
  -------- -------------- ---------------------------------------- ----------------------------------
  **1**    **F-Auth-2**   Throw at module load if Cognito env vars middleware/auth.js:13--22, :44--46
                          are absent. Boot-fail beats silent 401s  
                          on every authenticated request.          

  **2**    **F-Auth-3**   Distinguish \"Cognito down\" from        middleware/auth.js:164--168
                          \"anonymous user\" in optionalAuth. Stop 
                          swallowing all errors. Add an alarm      
                          signal.                                  

  **3**    **Sweep (a)**  Replace optionalAuth → requireAuth on    app.js:364 + per-route
                          every write route currently using        
                          optionalAuth. F34 closes here.           

  **4**    **Sweep (b)**  Add requireAuth to write routes with NO  outfitSets.js +
                          auth middleware declaration at all.      episodes.js:101/109/117

  **5**    **Sweep (c)**  Replace optionalAuth → requireAuth on    episodeOrchestrationRoute.js:135
                          episode-mutation routes that explicitly  
                          declare optionalAuth.                    

  **6**    **CZ-5 +       Migrate sendBeacon → fetch+keepalive.    BookEditor.jsx:173--186 +
           F-Auth-4 +     Reconcile requireAuth/authenticateToken  middleware/auth.js:256--293 +
           F-Auth-5**     duplication with frontend interceptor.   decisionLogs.js:22
                          Close req.user.sub/req.user.id drift.    
  ---------------------------------------------------------------------------------------------------

**4. Step Details**

**4.1 Step 1 --- F-Auth-2: Boot-fail on missing Cognito env vars**

**Current behavior**

middleware/auth.js:13--22 constructs Cognito ID-token and access-token
verifier objects at require() time using
process.env.COGNITO_USER_POOL_ID \|\| \'us-east-1_XXXXXXXXX\' and
process.env.COGNITO_CLIENT_ID \|\| \'xxxxxxxxxxxxxxxxxxxxxxxxxx\'. The
runtime check at lines 44--46 only fires *inside* verifyToken --- it
does not fire at boot. A misconfigured deploy with missing env vars
produces a server that boots cleanly and 401s every authenticated
request with a generic "Token verification failed" error and no
diagnostic hint that env vars are absent.

**Why it must ship before the sweep**

-   Once Steps 3--5 land, every write route requires a valid token. If a
    deploy is missing Cognito env vars, those routes 401 silently with
    no operator-visible cause.

-   The placeholder verifier objects make the failure mode look like a
    token problem, not an env-var problem. Triage gets pointed at the
    wrong layer.

**Fix**

-   Add a top-of-module check in middleware/auth.js that throws if
    either COGNITO_USER_POOL_ID or COGNITO_CLIENT_ID is undefined or
    matches the placeholder string.

-   The throw must happen at require() time, before the verifier objects
    are constructed.

-   Throw text must name the missing variable explicitly so deploy logs
    make the cause obvious.

-   Remove the placeholder fallback strings entirely once the throw is
    in place --- they exist only to defer the failure to runtime.

**Verification**

1.  Boot the app locally with both env vars unset → expect immediate
    startup failure with a named error.

2.  Boot with one env var set, one unset → expect immediate startup
    failure naming the missing variable.

3.  Boot with both env vars set to real values → expect normal startup.

**Risk**

-   Risk: a staging or dev environment that was running on placeholder
    values breaks immediately on first deploy of this PR. Mitigation:
    confirm env vars are set in every environment in pre-flight (§5.1).

**4.2 Step 2 --- F-Auth-3: Distinguish Cognito-down from anonymous**

**Current behavior**

middleware/auth.js:164--168 --- optionalAuth swallows **all** errors and
sets req.user = null with a console.warn. Routes that gate behavior on
req.user (characterDepthRoutes:88 isAuthor, characterRegistry
author-only field gate \~600) silently degrade to the unauthenticated
path during a Cognito outage. No alarm fires. Response codes are
identical to legitimate anonymous traffic. This is a
service-availability finding, not just security.

**Why it must ship with the sweep**

-   Once requireAuth replaces optionalAuth on writes, the failure mode
    for those routes becomes 401-on-Cognito-outage instead of
    silent-degradation. That is correct.

-   But routes that legitimately remain on optionalAuth (genuine
    read-where-auth-is-optional) still need to differentiate \"no
    token\" from \"Cognito broken\" so the gating logic does not
    silently flip during outages.

**Fix**

-   In optionalAuth, catch token-verification errors separately from
    \"no Authorization header\" and \"header but verifier rejected as
    invalid token\".

-   On verifier-throws-unexpected-error (Cognito timeout, DNS failure,
    JWKS unreachable): log at error level (not warn), increment a
    metric, and return 503 with a clear message --- do NOT silently
    degrade to req.user = null.

-   On no-Authorization-header: req.user = null is correct, no log
    needed.

-   On invalid-token: req.user = null with a debug log (current
    console.warn is too loud for an expected case).

**Verification**

4.  Hit a route under optionalAuth with no Authorization header →
    req.user = null, no log spam.

5.  Hit it with a malformed token → req.user = null, debug log only.

6.  Simulate Cognito unavailability (e.g., point JWKS URI at an invalid
    host) → expect 503, error log, metric incremented.

**Risk**

-   Routes that intentionally accept partial-degradation behavior may
    need explicit opt-in. Audit each remaining optionalAuth use during
    pre-flight (§5.1) to confirm 503-on-outage is the correct response.

**4.3 Step 3 --- Sweep sub-form (a): optionalAuth → requireAuth on
writes**

**Current behavior**

app.js:364 applies app.use(optionalAuth) globally. Individual write
routes either redundantly re-apply optionalAuth (storyteller.js,
careerGoals.js, uiOverlayRoutes.js, calendarRoutes.js,
characterRegistry.js, evaluation.js, wardrobe.js --- and many more
confirmed across Zones 18--26) or do nothing --- meaning the global
mount IS the bypass on those routes.

**Confirmed surfaces (from v8 audit)**

  -----------------------------------------------------------------------------
  **File**                  **Lines / count**           **Audit zone**
  ------------------------- --------------------------- -----------------------
  app.js                    :364 (global mount)         Zone 21 (cross-zone
                                                        root)

  storyteller.js            :38--43 (require), :53,     Zone 20
                            :113, :192, :213, :241,     
                            :263, :312, :333, :354,     
                            :553, :615, :636, :663,     
                            :738, :769, :790, :826,     
                            :856, :880, :910            

  characterRegistry.js      \~1700 lines; requireAuth   Zone 21
                            applied to ONE legacy route 
                            (/deep-profile/generate);   
                            every other write under     
                            optionalAuth ---            
                            set-status,                 
                            promote-to-canon,           
                            bulk-delete, bulk-status,   
                            bulk-move, JSONB PUTs, AI   
                            generation endpoints        

  evaluation.js             :587 (Stats save)           Zone 22

  careerGoals.js            every mutation route        Security Batch / Zone
                                                        22

  uiOverlayRoutes.js        every mutation route        Security Batch

  calendarRoutes.js         event CRUD, auto-spawn,     Security Batch
                            world-event spawn           

  franchiseBrainRoutes.js   10 mutation routes (entries F34 root
                            POST/PATCH/DELETE,          
                            activate, activate-all,     
                            archive/unarchive,          
                            ingest-document, guard,     
                            seed)                       

  wardrobe.js               :895 (/select), :970        Zone 23
                            (/purchase) and others      
  -----------------------------------------------------------------------------

**Notes:**

-   The list above is the audit-confirmed inventory. Pre-flight (§5.1)
    requires a fresh codebase grep to catch any optionalAuth uses added
    since v8 closed (May 1, 2026).

-   characterRegistry.js has a no-op fallback in its require block
    (lines 12--22) if the auth module fails to load. The fallback must
    be removed as part of this step --- it is the same anti-pattern as
    F-Auth-2.

**Fix**

-   For every confirmed surface above and every match found in
    pre-flight grep: replace optionalAuth with requireAuth.

-   Where optionalAuth is applied at app.js:364 globally and individual
    routes do NOT re-declare it, add explicit requireAuth at the route
    level.

-   After the per-route requireAuth is in place, remove the global
    optionalAuth mount at app.js:364 --- leaving it creates two passes
    through auth and confuses error handling.

-   Remove no-op fallback require blocks (characterRegistry.js:12--22
    and any twin instances).

-   For routes confirmed during pre-flight as genuinely public
    (read-only, no req.user gating downstream), document the exemption
    in a comment with the audit reasoning. Do not leave bare
    optionalAuth without a justifying comment.

**F34 absorbed here**

All 10 mutation routes on franchiseBrainRoutes.js close in this step.
Decision #33 / #34 are honored: F34 closes as part of the sweep, not as
a separate hotfix. The push-from-page route (already requireAuth) is the
model the rest of the file conforms to.

**Verification**

7.  Pre-flight grep result list (§5.1 deliverable) is fully addressed
    --- every entry either swapped to requireAuth or commented as a
    justified exemption.

8.  Zero matches for optionalAuth on a write route with no comment. Run:

grep -rE \"optionalAuth\" src/routes/ src/app.js \| grep -E
\"(post\|put\|patch\|delete)\" \| grep -v \"// PUBLIC:\"

9.  Authenticated request to a previously-unauth route returns 200 with
    req.user populated.

10. Unauthenticated request to the same route returns 401 with
    AUTH_REQUIRED.

**4.4 Step 4 --- Sweep sub-form (b): write routes with NO auth
declaration**

**Current behavior**

Zone 23 confirmed routes/outfitSets.js declares no auth middleware on
any of its 5 routes. routes/episodes.js mounts the plural outfit-set
controller at lines 101, 109, 117 with no auth declaration. Same blast
radius as sub-form (a) --- different starting state.

**Confirmed surfaces**

-   routes/outfitSets.js --- all 5 routes (no auth middleware declared
    anywhere in file).

-   routes/episodes.js:101 --- mounts plural outfit-set controller
    without auth.

-   routes/episodes.js:109 --- same pattern.

-   routes/episodes.js:117 --- same pattern.

-   Pre-flight (§5.1) requires a sweep for any other route file that
    does not import auth middleware at all.

**Fix**

-   Add requireAuth import at the top of routes/outfitSets.js.

-   Apply requireAuth to all 5 outfitSets routes.

-   Apply requireAuth at routes/episodes.js:101, :109, :117.

-   Note: F-Ward-3 keystone (Decision #60) calls for *deleting* the
    plural outfit-set controller --- it is dead code wired to live URLs
    (Pattern 47, the this. binding bug crashes every create). The
    F-AUTH-1 PR should still apply requireAuth to these routes; deletion
    is a separate post-AUTH PR. Reasoning: leaving them open during the
    AUTH PR window is a security exposure; deleting them is a structural
    change that warrants its own review.

**Verification**

11. grep for \"router\\.(post\|put\|patch\|delete)\" in
    routes/outfitSets.js → every match has requireAuth.

12. Pre-flight grep produces no untouched routes.

**4.5 Step 5 --- Sweep sub-form (c): episode-mutation routes that
declare optionalAuth**

**Current behavior**

Zone 26 confirmed a third sub-form: episodeOrchestrationRoute.js:135
explicitly declares optionalAuth on its mutation handler. The handler at
line 220 writes orchestration_data to the episodes table. This is
distinct from sub-form (a) because the route file has its own
optionalAuth declaration --- sweeping the global app.js mount alone does
not touch it.

**Confirmed surfaces**

-   episodeOrchestrationRoute.js:135 --- declares optionalAuth on
    episode-mutation handler.

-   Pre-flight (§5.1) requires a sweep for any other route file that
    explicitly declares optionalAuth on a mutation route. v8 named only
    the orchestration route, but the audit closed before a comprehensive
    grep of this sub-form across the full codebase.

**Fix**

-   Replace optionalAuth with requireAuth at
    episodeOrchestrationRoute.js:135.

-   Apply same fix to any additional sub-form (c) instances pre-flight
    grep identifies.

**Verification**

13. Authenticated POST/PUT to the orchestration route returns 200 with
    req.user populated and writes to episodes.orchestration_data
    succeed.

14. Unauthenticated POST/PUT returns 401 with AUTH_REQUIRED.

**4.6 Step 6 --- CZ-5 (sendBeacon) + F-Auth-4 (interceptor
reconciliation) + F-Auth-5 (user-id drift)**

**CZ-5 --- sendBeacon current behavior**

BookEditor.jsx:173--186 uses navigator.sendBeacon for the beforeunload
save. sendBeacon cannot carry Authorization headers. The moment Steps
3--5 land, every BookEditor beforeunload save silently 401s --- and
silently fails to save the user's last edits before navigation. This is
a data-loss path, not just an auth-noise path.

**CZ-5 --- fix**

-   Replace navigator.sendBeacon with fetch(url, { method: \...,
    headers, body, keepalive: true }). The keepalive flag preserves the
    request through page navigation, the same property sendBeacon was
    used for.

-   Confirm the Authorization header is added by the existing api
    service interceptor --- sendBeacon was bypassing the interceptor
    entirely.

-   Test: trigger beforeunload → confirm request fires with
    Authorization header → confirm 200 response in network log → confirm
    save persisted on next page load.

**F-Auth-4 --- current behavior**

middleware/auth.js:256--293 reimplements authenticateToken with one
differing string: AUTH_REQUIRED instead of AUTH_INVALID_TOKEN. The
frontend interceptor differentiates on these strings to decide whether
to wipe credentials and redirect (per the comment at lines 250--255).
Two parallel auth-checking code paths must be kept in sync.

**F-Auth-4 --- fix (Path 1 LOCKED)**

-   Delete the duplicate authenticateToken implementation at
    middleware/auth.js:256--293.

-   Have requireAuth emit two distinct error codes: AUTH_REQUIRED when
    no Authorization header is present, AUTH_INVALID_TOKEN when a header
    is present but verifier rejects the token.

-   Update every call site that referenced authenticateToken to use
    requireAuth.

-   Update the frontend interceptor to consume the unified contract:
    AUTH_REQUIRED → redirect to login; AUTH_INVALID_TOKEN → attempt
    token refresh once, then redirect on failure.

-   Confirm the comment at middleware/auth.js:250--255 (which documents
    the old contract) is updated or removed.

**F-Auth-5 --- current behavior**

decisionLogs.js:22 reads req.user.sub directly. Other call sites read
req.user.id --- the value the auth middleware maps from sub onto the
user object. Both resolve to the same Cognito subject identifier today,
but the contract has drifted: one file consumes a raw claim, the rest
consume the middleware-mapped field. The moment the middleware mapping
changes (e.g., to a numeric internal ID, or to a UUID indirection layer
for a multi-tenant change), decisionLogs.js silently writes the wrong
value with no test failure.

**F-Auth-5 --- why fold in here**

-   Step 6 is already the auth-contract reconciliation step. F-Auth-4
    Path 1 is unifying requireAuth and authenticateToken; F-Auth-5 is
    unifying user-object access. Same conceptual fix.

-   The change is one line. PR-scope cost is negligible.

-   Deferring it as a one-line follow-up PR has higher operational cost
    than fixing it now (the follow-up tends to never get scheduled).

**F-Auth-5 --- fix**

-   At decisionLogs.js:22, replace req.user?.sub with req.user?.id.

-   Pre-flight (§5.1) requires a fresh grep for any other call site
    reading req.user.sub (with or without optional chaining) directly.
    v8 named only decisionLogs.js:22, but a comprehensive sweep was not
    part of the audit. The codebase uses optional chaining
    (req.user?.sub), so the grep must be a regex that matches both
    forms.

grep -rnE \"req\\.user\\??\\.sub\" src/

-   For each match outside test files: replace with req.user?.id
    (preserve optional chaining --- the .id mapping is set by
    middleware/auth.js so req.user is non-null on auth-gated routes,
    but the chain is preserved for consistency with the rest of the
    codebase). Document any intentional req.user.sub use with a //
    PUBLIC: justifying comment if one exists (none expected).

**F-Auth-5 --- verification**

15. Authenticated POST to a /decision-logs route succeeds and the
    persisted user_id field matches the value other authenticated routes
    write for the same user.

16. Regex grep returns zero matches for req.user(?.).sub outside test
    fixtures and middleware/auth.js itself:

grep -rnE \"req\\.user\\??\\.sub\" src/

**Verification**

17. Open BookEditor, edit content, navigate away → save fires via
    fetch+keepalive, 200 response, edits persist.

18. Open authenticated session, manually delete token from storage,
    attempt write → interceptor sees AUTH_REQUIRED, redirects to login.

19. Open authenticated session, manually corrupt token, attempt write →
    interceptor sees AUTH_INVALID_TOKEN, attempts refresh.

**5. Execution Sequence**

All six steps land in one PR. Within the PR, the work order matters
because it minimizes the time the codebase spends in a half-fixed state
during local development and review.

**5.1 Pre-flight verification (before writing any code)**

Pre-flight produces a complete, current inventory. v8 closed May 1, 2026
--- any code added since then is not in the audit. Pre-flight catches
it.

**Pre-flight checklist**

20. Spot-check 3 v8 file:line references to confirm the codebase still
    matches the audit:

    -   middleware/auth.js:13--22, :44--46, :164--168, :256--293

    -   app.js:364

    -   episodeOrchestrationRoute.js:135 (and confirm the write at :220)

21. Run the master grep for sub-form (a). Capture full output. This is
    the inventory step 3 must address.

grep -rn \"optionalAuth\" src/routes/ src/app.js src/middleware/ \| sort

22. Run the sub-form (b) grep --- files in src/routes/ that do NOT
    import auth middleware:

for f in src/routes/\*.js; do grep -l \"require.\*middleware/auth\"
\"\$f\" \>/dev/null \|\| echo \"NO AUTH IMPORT: \$f\"; done

23. Run the sub-form (c) grep --- explicit optionalAuth on mutation
    routes:

grep -rnE \"router\\.(post\|put\|patch\|delete).\*optionalAuth\"
src/routes/

24. Confirm Cognito env vars are set in dev, staging, and prod
    environments. Step 1 (F-Auth-2) WILL boot-fail any environment
    missing them.

25. Identify the frontend interceptor file. Confirm the strings it
    differentiates on. Save this as the contract Step 6 reconciles
    against.

26. Pull a list of all routes currently using optionalAuth that are
    genuinely public reads. Pre-tag them as exemptions so step 3 does
    not blanket-swap them.

**Pre-flight deliverables**

-   Inventory file: src/routes/ optionalAuth surface count + file:line
    list.

-   Sub-form (b) file list (routes with no auth import).

-   Sub-form (c) file:line list (explicit optionalAuth on mutations).

-   Genuine-public-route exemption list with reasoning per route.

-   Frontend interceptor contract reference (file:line + string list).

-   Env-var confirmation per environment.

**5.2 Implementation order within the PR**

27. Step 6a (CZ-5 only) --- migrate sendBeacon → fetch+keepalive in
    BookEditor.jsx. This change is independent and can be merged to the
    working branch first; it does not break anything when sendBeacon is
    no longer the path.

28. Step 2 (F-Auth-3) --- refine optionalAuth error handling.
    Independent of route changes; safer to land before the sweep so any
    remaining optionalAuth routes get the better error semantics during
    the brief overlap window.

29. Step 6b (F-Auth-4 Path 1) --- reconcile the
    requireAuth/authenticateToken duplication. Land before the sweep so
    the frontend interceptor contract is stable when sweep traffic
    shifts.

30. Step 6c (F-Auth-5) --- replace req.user.sub with req.user.id at
    decisionLogs.js:22 and any other call sites pre-flight identifies.
    Independent of route changes; safe to land any time during Step 6.

31. Step 3 (Sweep a) --- biggest mechanical change. Land in dependency
    order: per-route requireAuth additions FIRST, then remove the global
    optionalAuth at app.js:364. This avoids a brief window where neither
    layer guards the routes.

32. Step 4 (Sweep b) --- add requireAuth to outfitSets.js +
    episodes.js:101/109/117.

33. Step 5 (Sweep c) --- replace optionalAuth at
    episodeOrchestrationRoute.js:135.

34. Step 1 (F-Auth-2) --- boot-fail on missing env vars. LAST.
    Reasoning: this change is the most disruptive in environments where
    env vars may be misconfigured. Landing it last means every other
    change in the PR is already exercised against working auth before
    the boot-fail check is added.

+-----------------------------------------------------------------------+
| **Why F-Auth-2 lands last**                                           |
|                                                                       |
| F-Auth-2 boot-fails any environment with missing or placeholder       |
| Cognito env vars. If it lands first, every step after it depends on   |
| those env vars being set in every dev/test environment. By landing    |
| last, the rest of the PR has already been exercised in those          |
| environments under real auth. Pre-flight (§5.1) confirms env vars are |
| set; F-Auth-2 last is belt-and-suspenders.                            |
+-----------------------------------------------------------------------+

**5.3 PR mechanics**

-   Single PR title: \"F-AUTH-1: codebase-wide auth bypass on writes ---
    six-step coordinated fix\"

-   PR description references audit handoff v8 §4.1 and §12.

-   PR description includes the pre-flight inventory as collapsed
    sections.

-   Each commit corresponds to one step (or substep). Bisectability
    matters if a regression surfaces.

-   Branch coordination: confirm with the second developer (VS Code
    collaborator) before opening the PR. F-AUTH-1 touches
    middleware/auth.js, app.js, and a wide swath of src/routes/ ---
    merge conflicts are likely if other branches are in flight.

-   CI must pass before merge. If the test suite does not currently
    exercise auth on the swept routes, add tests as part of the PR ---
    at minimum, one authenticated + one unauthenticated test per
    sub-form.

**6. Deployment Plan --- Gate-Driven Sequence**

primepisodes.com has no real-user traffic at the time this plan locks.
The deploy plan therefore does not use a calendar window --- it uses a
gate sequence. Each gate must pass before the next begins. There is no
pressure to ship by a date; there is pressure to not skip a gate.

+-----------------------------------------------------------------------+
| **Why gates instead of a calendar**                                   |
|                                                                       |
| A calendar deploy window is a tool for minimizing user impact during  |
| a risky change. With no real users, there is no user impact to        |
| minimize --- the calendar window solves a problem you don't have.     |
| What you DO have: a codebase that has accumulated months of untested  |
| assumptions (the audit found 269 P0 bugs) and a fix that touches      |
| authentication on every write route. The gates exist to prevent the   |
| temptation to skip discipline because \"no one will see it.\" The     |
| gates are not theater. F-AUTH-1 is the first fix; how it ships sets   |
| the precedent for every fix that follows.                             |
+-----------------------------------------------------------------------+

**6.1 The Seven Gates**

  ----------------------------------------------------------------------------
  **Gate**   **Name**            **What must be true before proceeding**
  ---------- ------------------- ---------------------------------------------
  **G1**     **Pre-flight        All §5.1 inventory deliverables produced and
             complete**          reviewed: optionalAuth surface inventory,
                                 sub-form (b) file list, sub-form (c)
                                 file:line list, exemption list with
                                 reasoning, frontend interceptor contract
                                 reference, env-var confirmation, req.user.sub
                                 grep results (F-Auth-5). Drift from v8
                                 file:line references documented or absent.
                                 Branch coordination with second developer
                                 confirmed.

  **G2**     **Implementation    All six steps coded per §5.2 order. Each
             complete**          commit corresponds to one step or substep
                                 (bisectability). CI passing. PR opened. PR
                                 description references audit handoff v8
                                 §4.1 + this fix plan and includes the
                                 pre-flight inventory in collapsed sections.

  **G3**     **Self-review       Every commit in the PR read end-to-end. Test
             passed**            coverage minimum: one authenticated + one
                                 unauthenticated test per sub-form. F-Auth-5
                                 has its specific test (decisionLogs write
                                 persists matching user_id). Frontend
                                 interceptor handles AUTH_REQUIRED and
                                 AUTH_INVALID_TOKEN as distinct paths.

  **G4**     **Dev verified**    Backend deployed to dev. Boot tested with
                                 valid env vars (succeeds), missing env var
                                 (boot-fails with named error), placeholder
                                 env var values (boot-fails). §7 verification
                                 checklist run end-to-end on dev. Every
                                 checkbox confirmed.

  **G5**     **Staging           Frontend deployed to staging first, then
             verified**          backend. §7 checklist re-run on staging.
                                 Boot/restart cycle exercised (kill the
                                 process, confirm clean restart, confirm auth
                                 still works). 2-hour soak --- server stays
                                 up, no error log spam, no unexpected
                                 restarts. You are reachable for alerts during
                                 this window.

  **G6**     **Prod cutover**    Frontend deployed to prod, then backend. You
                                 spend 30 focused minutes exercising the app:
                                 log in, write to a Stats route, write to a
                                 wardrobe route, write to a franchise-brain
                                 route (this is where F34 closes), write
                                 something in BookEditor and navigate away
                                 (CZ-5 path), write to a /decision-logs route
                                 (F-Auth-5 path). Confirm boot logs are clean.
                                 No errors visible in app or server logs.

  **G7**     **Post-deploy       Server stays up overnight. Next morning,
             soak**              exercise the app again --- same surfaces as
                                 G6. If clean, declare F-AUTH-1 closed. Tier 1
                                 fix queue (F-App-1, F-Stats-1, F-Ward-1,
                                 F-Reg-2, F-Ward-3, F-Sec-3, F-Franchise-1) is
                                 now unblocked.
  ----------------------------------------------------------------------------

**6.2 Pre-G6 readiness check**

Before opening the prod cutover at G6, run this short list. If any item
fails, do not proceed to G6. Return to the appropriate earlier gate.

35. Cognito env vars confirmed set in prod (verified once during
    pre-flight; re-confirmed here because Step 1 / F-Auth-2 boot-fails
    any env without them).

36. Second developer confirmed not mid-deploy. No conflicting branch in
    flight.

37. Frontend build deployed to prod is using the updated interceptor
    contract from Step 6b. Hard requirement --- backend cutover before
    frontend cutover ships AUTH_REQUIRED responses to a frontend that
    does not know how to handle them.

38. Rollback procedure (§8) read and understood. Revert path is one
    command, not a discovery exercise.

39. You have a clear 30 minutes. Phone on do-not-disturb. No meetings.
    No \"I can do this between calls.\"

**6.3 What to watch during deploy**

Without real-user traffic, the standard \"watch the metrics\" framing
does not apply. There is no 401-rate-spike to investigate. There is no
user-write-success-rate dashboard. What you watch instead:

-   Boot logs --- server starts cleanly. No exceptions during module
    load. F-Auth-2 emits no warnings (because env vars are set). No
    \"Token verification failed\" loops in the first minute.

-   App exercise --- every surface listed in G6 returns 200 under your
    own authenticated session. Every unauthenticated test (open an
    incognito window, attempt a write) returns 401 with AUTH_REQUIRED.

-   BookEditor exercise --- write content, navigate away, return. Edits
    persist. Network log shows fetch with keepalive: true (not
    sendBeacon) carrying the Authorization header.

-   Frontend interceptor exercise --- manually delete the auth token
    from browser storage, attempt a write. Interceptor sees
    AUTH_REQUIRED, redirects to login. Manually corrupt the token,
    attempt a write. Interceptor sees AUTH_INVALID_TOKEN, attempts
    refresh.

-   Server logs during exercise --- no error-level entries from
    middleware/auth.js. F-Auth-3 503 path is not firing (Cognito is
    reachable). No console.warn floods.

-   Overnight (G7) --- server uptime metric matches deploy time the next
    morning. No unexpected restarts. No memory growth visible in process
    metrics.

+-----------------------------------------------------------------------+
| **What you are NOT watching for**                                     |
|                                                                       |
| No 401 rate spike to investigate (no traffic to produce one).         |
|                                                                       |
| No write success rate dashboard (no traffic).                         |
|                                                                       |
| No 503 rate from F-Auth-3 (Cognito-down detection only fires under    |
| load that you do not have).                                           |
+-----------------------------------------------------------------------+

**6.4 If a gate fails**

-   G1 fails --- pre-flight surfaced drift, missing env vars, or branch
    conflict. Resolve before G2. Drift may require updating this fix
    plan to v1.4+.

-   G2 fails --- implementation incomplete or CI red. Stay at G2. Do not
    let \"I can fix this in staging\" pressure push you forward.

-   G3 fails --- self-review found a bug or a missing test. Return to
    G2. Add the test, fix the bug, re-run CI.

-   G4 fails --- boot-fail when it should succeed, or unexpected
    behavior in §7 checklist. Diagnose. Likely a code bug, not a deploy
    issue. Return to G2 if a code change is needed.

-   G5 fails --- staging crash, error spam, or §7 checklist regression.
    Diagnose. If staging-specific (env, infra), fix in place. If code,
    return to G2.

-   G6 fails --- prod cutover surfaces an issue. Roll back per §8. Do
    not try to fix forward in prod. Return to G2 or G4 depending on
    cause.

-   G7 fails --- overnight soak revealed instability. Roll back. Same
    rule: do not fix forward in prod.

**7. Post-Deploy Verification Checklist**

Run this checklist in staging before prod, and again in prod after
deploy.

**7.1 Auth module integrity**

-   [ ] Server boot with valid Cognito env vars --- succeeds.

-   [ ] Server boot with missing COGNITO_USER_POOL_ID --- fails
    immediately with named error.

-   [ ] Server boot with missing COGNITO_CLIENT_ID --- fails immediately
    with named error.

-   [ ] Server boot with placeholder env var values --- fails
    immediately with named error.

**7.2 optionalAuth error semantics (F-Auth-3)**

-   [ ] optionalAuth route, no Authorization header --- req.user = null,
    no log spam.

-   [ ] optionalAuth route, malformed token --- req.user = null, debug
    log only.

-   [ ] optionalAuth route, simulated Cognito unavailability --- 503
    response, error log, metric incremented.

**7.3 Sweep (a) --- optionalAuth → requireAuth**

-   [ ] storyteller.js write routes: authenticated request 200, unauth
    401.

-   [ ] characterRegistry.js writes: authenticated request 200, unauth
    401.

-   [ ] characterRegistry.js author-only fields: authenticated request
    as author succeeds; previously-broken because req.user was null is
    now functional.

-   [ ] evaluation.js:587 (Stats save): authenticated 200, unauth 401.

-   [ ] careerGoals.js mutation routes: authenticated 200, unauth 401.

-   [ ] uiOverlayRoutes.js mutation routes: authenticated 200, unauth
    401.

-   [ ] calendarRoutes.js mutation routes: authenticated 200, unauth
    401.

-   [ ] franchiseBrainRoutes.js all 10 mutation routes: authenticated
    200, unauth 401. F34 closed.

-   [ ] wardrobe.js:895 (/select), :970 (/purchase): authenticated 200,
    unauth 401.

**7.4 Sweep (b) --- no-auth-declaration routes**

-   [ ] outfitSets.js all 5 routes: authenticated 200, unauth 401.

-   [ ] episodes.js:101, :109, :117: authenticated 200, unauth 401.

**7.5 Sweep (c) --- explicit optionalAuth on mutations**

-   [ ] episodeOrchestrationRoute.js:135: authenticated 200 (writes
    orchestration_data at :220), unauth 401.

**7.6 Step 6 --- CZ-5 + F-Auth-4 + F-Auth-5**

-   [ ] BookEditor.jsx beforeunload save: triggers fetch+keepalive (not
    sendBeacon), Authorization header present, 200 response, edits
    persisted on next load.

-   [ ] Frontend interceptor sees AUTH_REQUIRED → redirects to login.

-   [ ] Frontend interceptor sees AUTH_INVALID_TOKEN → attempts refresh,
    then redirects on failure.

-   [ ] Mid-session token expiry: refresh path works, user is not
    silently logged out.

-   [ ] Authenticated POST to /decision-logs persists user_id matching
    the value other authenticated routes write for the same user
    (F-Auth-5).

-   [ ] grep \"req\\.user\\.sub\" src/ returns zero matches outside
    middleware/auth.js itself and test fixtures (F-Auth-5).

**7.7 Regression checks**

-   [ ] App.js no longer applies global optionalAuth (line 364 confirmed
    removed).

-   [ ] characterRegistry.js no-op fallback at lines 12--22 confirmed
    removed.

-   [ ] No bare optionalAuth on a write route without a // PUBLIC:
    justifying comment.

-   [ ] Pre-existing read-only routes still work for unauthenticated
    users (where applicable per exemption list).

**8. Rollback Plan**

Rollback is a single revert of the merge commit. Because all six steps
land in one PR, rollback restores the entire pre-fix state --- including
the F34 exposure. This is acceptable because the alternative (partial
rollback) leaves the codebase in a half-fixed state v8 §4.1 explicitly
warns against.

**8.1 Rollback triggers**

-   Production write success rate drops more than 2% on any route within
    30 minutes of deploy and the cause is auth-related.

-   BookEditor beforeunload save failure rate measurably increases.

-   Boot failure on any production instance not caused by missing env
    vars (i.e., a code bug).

-   Frontend interceptor regression --- users being silently logged out,
    mid-session refresh broken.

**8.2 Rollback procedure**

40. Revert the merge commit on the deploy branch.

41. Redeploy backend to prod.

42. Redeploy frontend to prod (the old frontend works against the
    rolled-back backend; the new frontend will work against either, but
    rolling back both is cleaner).

43. Confirm metrics return to pre-deploy baseline.

44. Open an incident review. Identify which of the six steps caused the
    regression. Re-plan the next attempt.

**8.3 What rollback restores**

-   F-AUTH-1 sweep undone --- all sub-forms back to optionalAuth or
    no-auth.

-   F34 exposure restored. Mitigation: rollback should be brief; do not
    soak in the rolled-back state.

-   F-Auth-2 boot-fail removed.

-   F-Auth-3 error semantics reverted.

-   CZ-5 sendBeacon restored. BookEditor data-loss path reopened.

-   F-Auth-4 reconciliation/documentation undone.

**9. Open Questions / Decisions to Lock Before Implementation**

**9.1 F-Auth-4 path --- LOCKED**

Path 1 (reconcile, delete authenticateToken duplicate) --- **LOCKED.**
Decision recorded. Implementation per Step 6b.

**9.2 Genuine-public-route exemption list**

Pre-flight (§5.1) produces this list. Each entry needs explicit
confirmation: \"this route is genuinely public; optionalAuth is
correct.\" If any entry is uncertain, default to requireAuth ---
public-by-default is a worse failure mode than auth-by-default for a
luxury franchise OS.

**9.3 F-Auth-5 --- LOCKED. F-Auth-6 --- deferred.**

F-Auth-5 --- **LOCKED to fold in.** Implementation as Step 6c (see
§4.6). F-Auth-6 (tokenUse not gated for access vs ID tokens) ---
**deferred to follow-up PR** per v8 framing. Larger change, real scope,
not coupled to the auth-contract reconciliation Step 6 is doing.

**9.4 Deploy window --- LOCKED (gate-driven, no calendar)**

Locked: **no calendar deploy window.** Gate-driven sequence per §6.
Reasoning: primepisodes.com has no real-user traffic at the time of this
fix. The standard deploy-window framing (low-traffic prod window,
24-hour staging soak) optimizes for user-impact minimization, which does
not apply here. Discipline comes from the gates, not the clock.
Quality-over-speed locked as the binding constraint.

**9.5 Branch coordination with second developer**

F-AUTH-1 touches middleware/auth.js, app.js, and the route layer.
Confirm with the VS Code collaborator that no in-flight branches
conflict before opening the PR. v8 §1.2 names this as a real production
risk.

**10. What This Unblocks**

Per v8 §4.1: every other P0 fix touches mutation routes. With F-AUTH-1
closed, the next-fix queue opens. The audit-locked sequence (§4 of v8)
is:

  --------------------------------------------------------------------------------
  **Tier**   **Keystone**        **Why it can ship after F-AUTH-1**
  ---------- ------------------- -------------------------------------------------
  **1**      **F-App-1**         Schema-as-JS auto-repair removed from
                                 app.js:262--328. Structural prerequisite for
                                 F-Sec-3 and any character_state UNIQUE migration.
                                 Decision #47.

  **1**      **F-Stats-1**       Build the missing CharacterState Sequelize model.
                                 Prerequisite for any F-Sec-3 cleanup. Decision
                                 #54.

  **1**      **F-Ward-1**        Write the migration that captures
                                 episode_wardrobe canonical schema. Decision #59.

  **1**      **F-Reg-2**         Address registry_characters write-contention.
                                 Pattern 41 master.

  **1**      **F-Ward-3**        Delete the plural outfit-set controller (the
                                 routes the F-AUTH-1 sweep just protected).
                                 Decision #60.

  **1**      **F-Sec-3**         Canonical-key consolidation. Subordinate to
                                 F-Franchise-1 per Decision #94. Blocked on
                                 F-App-1, F-Stats-1, F-Ward-1, AND F-Franchise-1.

  **1**      **F-Franchise-1**   Director Brain build. The keystone fix for the
                                 disconnection between franchise tier and show
                                 tier. Decision #94. Builds the consumer wiring
                                 that routes Universe.pnos_beliefs, world_rules,
                                 narrative_economy, and core_themes into the
                                 production pipeline that currently runs on six
                                 private JS-literal copies.
  --------------------------------------------------------------------------------

+-----------------------------------------------------------------------+
| **Director Brain framing**                                            |
|                                                                       |
| Director Brain is not a feature being built late. Per v8 §1.2 and     |
| Decision #94, Director Brain is the audit-recommended fix for         |
| F-Franchise-1. Its scope is now defined precisely: build the consumer |
| wiring that the franchise tier was scaffolded for. The seeded spec at |
| seeders/20260312800000-show-brain-franchise-laws.js:335 already names |
| its capabilities. The audit names its input contract. F-AUTH-1 is the |
| foundation that makes shipping any of this safe.                      |
+-----------------------------------------------------------------------+

**11. Appendix A --- File:line Reference Card**

All references derived from Prime Studios Audit Handoff v8. Pre-flight
(§5.1) confirms each before implementation.

**Auth module (middleware/auth.js)**

-   :13--22 --- Cognito verifier construction with placeholder fallback
    (F-Auth-2 surface)

-   :44--46 --- runtime env-var check inside verifyToken (the check that
    fires too late)

-   :164--168 --- optionalAuth swallows all errors (F-Auth-3 surface)

-   :256--293 --- duplicate authenticateToken implementation (F-Auth-4
    surface)

**Global mount**

-   app.js:364 --- global app.use(optionalAuth) (sub-form a root)

**Sub-form (a) --- confirmed surfaces**

-   storyteller.js:38--43, 53, 113, 192, 213, 241, 263, 312, 333, 354,
    553, 615, 636, 663, 738, 769, 790, 826, 856, 880, 910

-   characterRegistry.js:12--22 (require-with-fallback), \~600 (isAuthor
    gate), \~1700-line file with requireAuth on one route only

-   evaluation.js:587 (Stats save)

-   careerGoals.js --- every mutation route

-   uiOverlayRoutes.js --- every mutation route

-   calendarRoutes.js --- event CRUD, auto-spawn, world-event spawn

-   franchiseBrainRoutes.js --- 10 mutation routes (entries CRUD,
    activate, activate-all, archive/unarchive, ingest-document, guard,
    seed)

-   wardrobe.js:895 (/select), :970 (/purchase)

**Sub-form (b) --- confirmed surfaces**

-   routes/outfitSets.js --- all 5 routes, no auth import

-   routes/episodes.js:101, :109, :117 --- plural outfit-set controller
    mounts

**Sub-form (c) --- confirmed surfaces**

-   episodeOrchestrationRoute.js:135 (declares optionalAuth) → :220
    (writes orchestration_data)

**CZ-5**

-   BookEditor.jsx:173--186 --- sendBeacon beforeunload save

**12. Appendix B --- Glossary**

-   **F-AUTH-1** --- Tier 0 keystone in v8. Codebase-wide auth bypass on
    writes. Three sub-forms.

-   **F-Auth-2** --- middleware/auth.js module-load placeholder fallback
    (Step 1).

-   **F-Auth-3** --- optionalAuth cannot distinguish \"Cognito down\"
    from \"anonymous user\" (Step 2).

-   **F-Auth-4** --- requireAuth and authenticateToken are duplicate
    logic with one differing string (Step 6b).

-   **F-Auth-5** --- req.user.id vs req.user.sub split-brain at
    decisionLogs.js:22. Folded into the F-AUTH-1 PR as Step 6c.

-   **F-Auth-6** --- tokenUse captured but not gated. Non-blocking;
    informs the recipe.

-   **F34** --- unauthenticated destructive writes on
    /franchise-brain/\*. Subset of sub-form (a). Closes automatically in
    Step 3.

-   **CZ-5** --- sendBeacon cannot carry Authorization headers.
    BookEditor beforeunload save data-loss risk (Step 6a).

-   **Sub-form (a)** --- write routes currently using optionalAuth. The
    v6 keystone form.

-   **Sub-form (b)** --- write routes with NO auth middleware declared.
    Zone 23 finding.

-   **Sub-form (c)** --- write routes that explicitly declare
    optionalAuth on mutation paths. Zone 26 finding.

-   **F-Franchise-1** --- 7th keystone in v8. Director Brain build
    resolves it. Sequenced after F-AUTH-1.

*--- end of document ---*
