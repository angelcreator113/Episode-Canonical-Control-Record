# Prime Studios — Session-Level PE Roster

Operational and infrastructure findings that surface during fix-plan
execution sessions but are out of scope for the active fix plan.

Distinct from the **Track 8 PE roster** maintained in F-AUTH-1 fix
plan revisions (currently 9 active candidates per F-AUTH-1 plan v2.37
§5.71 + §11), which tracks F-AUTH-1 architectural follow-on candidates
specifically. The Track 8 roster is F-AUTH-1-scoped; this roster is
session-scoped.

Each entry includes: severity (P0/P1/P2), status (OPEN/CLOSED/RESOLVED),
date filed, brief description, file:line references where applicable,
deferral rationale or resolution path.

**Roster numbering** continues from the May 12 session resume document
(`Prime_Studios_Session_Resume_2026-05-12.docx`), which used PE #27,
#31, #37, #38, #39 informally without a maintained file. PE #1–#26,
#28–#30, #32–#36 are not catalogued here; they appear in F-AUTH-1
plan history under the Track 8 program-specific roster and are not
session-level findings.

**Provenance note:** Entries PE #27, #31, #37, #38, #39 transcribed from
`Prime_Studios_Session_Resume_2026-05-12.docx` on 2026-05-14 by Claude
during F-Stats-1 G6 soak verification session. The source docx is not
checked into the repo as of this writing. Future entries are filed
directly here.

---

## Active findings

### PE #27 — deploy-production.yml smoke test accepts 502/503 (HIGH, OPEN)

**Date filed:** 2026-05-12
**Severity:** P1 (HIGH priority per May 12 resume)
**Status:** OPEN

The deploy pipeline's post-deploy smoke test treats HTTP 502 and 503
responses as success. This masked the ALB routing drift (port 3000 vs
3002 mismatch + missing security group rule) for an unknown duration
prior to the 2026-05-12 session.

**Surface:** `.github/workflows/deploy-production.yml` smoke test step.

**Impact:** Deploy pipeline reports success while service is unreachable
or in a degraded state. False-positive deploy verification.

**Resolution path:** Tighten smoke test to require HTTP 200 (or
specifically validate `/health` returns `database: connected`). Bundle
with workflow inspection pass (May 12 resume Priority 3, "PR C — CI
workflow inspection").

---

### PE #31 — dev.primepisodes.com DNS drift (P2, OPEN)

**Date filed:** 2026-05-12
**Severity:** P2
**Status:** OPEN

DNS for `dev.primepisodes.com` points directly at EC2 IP
`54.163.229.144` instead of the ALB alias. Inconsistent with the
production routing pattern (`primepisodes.com` → ALB → target group).

**Impact:** No active issue. Hygiene gap. If EC2 instance IP changes
(stop/start, ASG event), dev URL would break while prod URL would
auto-recover via ALB. Also: dev URL bypasses ALB health checks and
security group routing rules.

**Resolution path:** Re-point dev DNS to ALB alias. Verify ALB has
host-based routing rule for `dev.primepisodes.com` if dev shares the
prod ALB, or route to a separate dev ALB if architecture warrants.

---

### PE #37 — DB_NAME=postgres mismatch on prod EC2 .env (P0, RESOLVED 2026-05-12)

**Date filed:** 2026-05-12
**Severity:** P0 (production data integrity)
**Status:** RESOLVED 2026-05-12

Production EC2 `.env` had `DB_NAME=postgres`, causing the app to
connect to the default system database instead of `episode_metadata`.
Fixed mid-session 2026-05-12; `currentDatabase` health endpoint field
now reports `episode_metadata` correctly.

**Surface:** `~/episode-metadata/.env` on production EC2
(`i-02ae7608c531db485`).

**Impact (pre-resolution):** App was reading/writing to the `postgres`
system database. Filed historically as the root cause of `showCount=0`
/ `episodeCount=0` observations from the health endpoint.

**Resolution:** `.env` corrected on EC2; PM2 restart picked up new
value via `DB_NAME` env var path (PM2 doesn't load `.env` directly per
ecosystem.config.js setup; app.js falls back to process env which now
matches).

**Follow-up:** PE #38 (showCount=0 persists even after fix) and PE #39
(DATABASE_URL drift) surfaced during this resolution.

---

### PE #38 — showCount=0 persists on correct DB (P1, OPEN)

**Date filed:** 2026-05-12 (after PE #37 resolution)
**Severity:** P1
**Status:** OPEN

Even after `DB_NAME` correction to `episode_metadata` (PE #37
resolution), `showCount` and `episodeCount` from the
`/health` endpoint return 0.

**Three candidate explanations:**

1. Database is truly empty (acceptable pre-launch state, no action
   needed)
2. Schema drift between dev (Neon) and prod (RDS `episode_metadata`)
3. Tables exist but health endpoint queries against wrong table names

**Investigation path:**

```bash
ssh ubuntu@54.163.229.144
psql -h episode-control-prod.csnow208wqtv.us-east-1.rds.amazonaws.com \
     -U postgres -d episode_metadata -W
\dt                          -- list all tables
SELECT COUNT(*) FROM shows;
SELECT COUNT(*) FROM episodes;
\q
```

**Estimated effort:** 15-30 min. Determines whether prod is genuinely
pre-launch (no action) or whether schema drift needs remediation.

---

### PE #39 — DATABASE_URL drift on prod .env (P2, OPEN)

**Date filed:** 2026-05-12
**Severity:** P2 (drift hazard, currently inert)
**Status:** OPEN

Production EC2 `.env` contains a Neon `DATABASE_URL` value while
`DB_HOST` points to RDS. Currently harmless because PM2 doesn't load
`.env` (app.js:7 skips dotenv under PM2, falls back to
`DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD` which are correct).

**Impact:** None at present. Latent: if `ecosystem.config.js` ever
starts loading `DATABASE_URL`, Sequelize would prefer that URL over
the `DB_*` fallback, silently switching prod to the wrong database
(Neon dev instance instead of RDS prod).

**Three hardening options:**

1. Remove `DATABASE_URL` from prod `.env` entirely (forces `DB_*`
   path).
2. Align `DATABASE_URL` to RDS endpoint so both paths agree.
3. Add startup guard that fails if `DATABASE_URL` host conflicts with
   `DB_HOST`.

**Estimated effort:** 15-20 min for any single option.

---

### PE #40 — Template Studio route loader failure at boot (P1, OPEN, NEW 2026-05-14)

**Date filed:** 2026-05-14 (surfaced during F-Stats-1 G6 soak
verification)
**Severity:** P1 (feature broken, no runtime impact, no security
implication)
**Status:** OPEN

At PM2 boot, `episode-api` logs:

```
Failed to load Template Studio routes: The "url" argument must be of
type string. Received undefined
```

**Frequency:** 1 occurrence per process boot (confirmed via
`pm2 logs episode-api --lines 500 --nostream | grep -c 'Failed to
load Template Studio'` returning `1` on 2026-05-14 at ~74min post-boot).
Not recurring; not a retry loop; not per-request.

**Impact:** Template Studio routes return 404. Other template loaders
(`templates`, `sceneTemplates`, `Thumbnail Template`) load
successfully and are unaffected. Process stability, memory usage, and
other features unaffected. Soak narrative for F-Stats-1 G6 remains
intact (process stable, no restarts, no recurring errors).

**Root cause class:** A `url` or `path` Node API receives `undefined`
during module init in the Template Studio route file. Likely
candidates: `import.meta.url` in CJS context, `path.resolve` with
undefined config var, or `require`/`import` with unset env var.

**Pre-existing status:** TBD. Need 2000-line log lookback or git
history check to date first occurrence vs. F-Stats-1 G2 deploy time
(2026-05-14 17:30 UTC).

**2026-05-16 confirmation:** Still firing on every `episode-api` boot.
Confirmed in soak check output 2026-05-16 12:50 UTC — same error text
("Failed to load Template Studio routes: The 'url' argument must be of
type string. Received undefined"), same single-occurrence-per-boot
frequency. 48+ hours unchanged. PE #40 has not regressed and has not
self-resolved.

**Defer:** Out of F-Stats-1 scope. Filed for separate fix plan when
triaged. Investigation step 1: locate the Template Studio route file
and identify which Node API call receives `undefined`.

---

### PE #41 — aiRateLimiter.js IPv6 key generation is boot-blocking on fresh installs (P0, RESOLVED 2026-05-15)

**Date filed:** 2026-05-14 (surfaced during F-Stats-1 G6 soak
verification)
**Severity:** P0 (reclassified from P2 on 2026-05-15)
**Status:** RESOLVED on main (PR #694, commit `139bbd7a`, 2026-05-15)

At PM2 boot, `episode-api` logs:

```
ERR_ERL_KEY_GEN_IPV6
```

and throws a `ValidationError` from `express-rate-limit` during
limiter initialization when using a custom key generator that reads
the request IP directly without `ipKeyGenerator`.

**Cause:** `aiRateLimiter.js` uses the bare client IP as the
rate-limit key. `express-rate-limit` requires IPv6 keys to go through
the `ipKeyGenerator` helper to avoid keying on partial v6 addresses
(otherwise multiple addresses in the same /64 may collapse to one
bucket, or the limiter may fail-open).

**Impact:** Dev deploy shows this now as a boot-time blocker on fresh
`node_modules` installs: app process appears online under PM2 but route
verification fails and API routes do not initialize cleanly. This is no
longer a degraded-warning class issue; it is deployment-blocking for
environments that install the stricter `express-rate-limit` behavior.

**Resolution path:** Update `aiRateLimiter.js` to import and use
`ipKeyGenerator` from `express-rate-limit`'s utility module. Add an
integration boot test that fails if limiter initialization throws, and
an IPv6 rate-limit test if infrastructure supports IPv6 simulation.

**Defer:** None. Treat as urgent pipeline blocker before Phase B G2
execution.

**Resolution:** Fixed by PR #694 (squash-merged to main as `139bbd7a`). The fix imports `ipKeyGenerator` from `express-rate-limit` with a safe fallback (`rateLimit.ipKeyGenerator || ((ip) => ip)`) and wraps `req.ip` through it. User keys also namespaced with `user:` prefix to prevent collision with IP literals. Verified working via dev deploy run #25940612415 (2026-05-15 ~17:30 UTC, 3m55s, clean).

---

### PE #48 — Dev migration fails: missing `version` column in `20260718000000-create-episode-scripts-and-feed-posts` (P1, RESOLVED 2026-05-15)

**Date filed:** 2026-05-15 (surfaced during Deploy-to-Development
workflow failure review)
**Severity:** P1 (pipeline-blocking schema drift)
**Status:** RESOLVED on main (PR #694, commit `139bbd7a`, 2026-05-15)

Deploy-to-Development run failed migration
`20260718000000-create-episode-scripts-and-feed-posts` with:

```
ERROR: column "version" does not exist
```

**Impact:** Dev pipeline cannot complete migration set; deploy leaves an
inconsistent runtime state (PM2 online but backend routes not verified).
This blocks safe Phase B G2 execution and is additional evidence of
cross-environment schema drift.

**Likely root cause classes:**

1. Dev DB schema drift vs prod
2. Migration dependency drift (referenced column removed/renamed)
3. Migration file changed after earlier successful environment run

**Resolution path:**

1. Inspect migration SQL and dependency tables for `version` reference
2. Diff dev/prod schema for affected tables
3. Decide canonical schema source and add corrective migration (no
  editing executed migrations in place)

**Defer:** Out of current F-Stats-1 documentation patch scope; hand off
to F-Ward-1/F-Deploy-1 execution track for remediation planning.

**Resolution:** Fixed by PR #694 (squash-merged to main as `139bbd7a`). The fix applies defensive schema coding inside the migration: `queryInterface.describeTable('episode_scripts')` checks for `version` column existence and adds it via `addColumn` if missing. All `addIndex` calls converted to raw SQL `CREATE INDEX IF NOT EXISTS` for idempotency. **Root cause understood:** Dev's `episode_scripts` table originated from the legacy standalone SQL path (`create-episode-scripts-table.js`) which created the table with `version_number` (not `version`). Later migrations layered the newer `version` column on top, producing a mixed-state schema. The migration fix tolerates that mixed state. **Pattern note:** The defensive-schema-coding pattern matches Pattern 40b in the audit handoff and represents F-Deploy-G1 / F-Ward-1 territory. Worth a follow-up finding in the F-Deploy-1 G1 audit to document `create-episode-scripts-table.js` as a Pattern 40b source.

---

### PE #42 — 7 critical/high npm audit vulnerabilities (P1, OPEN, NEW 2026-05-14)

**Date filed:** 2026-05-14 (surfaced via CFO audit during F-Stats-1
G6 soak verification)
**Severity:** P1 placeholder pending enumeration; some may upgrade to
P0, some may close as not-applicable
**Status:** OPEN

CFO audit reports 7 critical/high vulnerabilities in production
dependencies.

**Enumeration owed:** Need `npm audit` output for:

- Vulnerability CVE IDs
- Affected package names + versions
- Fix-available status per vuln
- Whether each vuln is in a direct dep or transitive

**Impact assessment owed per vuln:**

- Direct deps with vulnerable code paths exercised → real exposure,
  prioritize.
- Transitive deps where vulnerable code path isn't exercised → low
  practical risk, can defer.
- Critical-class CVEs in deps with known exploits in the wild →
  immediate.

**Resolution path:** Run `npm audit --json > audit_2026-05-14.json`,
triage each entry, file per-vuln sub-PEs as needed. Bundle low-risk
items into a single dependency-update PR. Critical-class deps may
warrant immediate hotfix branches.

**2026-05-16 confirmation:** CFO scheduled audit at 2026-05-16 06:46 UTC
and 2026-05-16 12:46 UTC both report `[dependency_audit] 7 critical/high
security vulnerabilities found!` — same count, audit score 83/100 both
runs. 48+ hours unchanged. Enumeration via `npm audit --json` still
owed.

**Defer:** Not blocking F-Stats-1 work. Should not stay open through
Phase B execution. Triage by EOW 2026-05-21.

---

### PE #43 — Thumbnail.episodeId vs episode_id JOIN failure (P1, OPEN, NEW 2026-05-15)

**Date filed:** 2026-05-15 (surfaced during F-Stats-1 Phase A G6 soak verification)
**Severity:** P1 (feature broken, endpoint returns 500, no runtime instability)
**Status:** OPEN

The `GET /thumbnails` list endpoint fails with:
column Thumbnail.episodeId does not exist
HINT: Perhaps you meant to reference the column "Thumbnail.episode_id".

**Frequency:** 16 occurrences in the last 500 episode-api log lines (2026-05-15 soak window). Recurring on every request to the affected endpoint. Not a hot loop (no retry behavior), but every request to list thumbnails fails.

**Surface:** `thumbnailController.js` (file referenced in error logs; exact line TBD). The Thumbnail Sequelize model defines `episodeId` in camelCase, but the actual `thumbnails` table column on prod RDS is `episode_id` in snake_case. The model-table mismatch surfaces on every JOIN.

**Pre-existing status:** Confirmed pre-existing. Error log timestamps from 2026-05-15 02:32 UTC onward; pattern matches Pattern 40b schema-source drift catalogued under F-Ward-1 keystone (audit handoff v8 §6.12).

**Root cause class:** Same pattern family as F-Ward-1 — schema drift between Sequelize model definitions and production RDS table schemas. The model was written assuming Sequelize's camelCase auto-conversion would map to snake_case columns; either the auto-conversion was disabled later, or the prod table was created via different migration than the dev environment.

**Defer:** Out of F-Stats-1 scope. Covered by F-Ward-1 keystone scope (schema-source drift, Pattern 40b). When F-Ward-1 lands its migration captures, the Thumbnail-episode JOIN should resolve as part of that sweep.

**2026-05-20 amendment:** Still firing during F-Deploy-1 Phase A G4 soak day 1 observable check (2026-05-20 09:31:57 UTC). 5+ days unchanged from filing. DEFERRED status holds — F-Ward-1 keystone remains the canonical resolution path, and F-Ward-1 ships downstream of F-Deploy-1 Phase A close + F-AUTH-1 execution per fix sequence. PE #43 staying OPEN through the F-Deploy-1 soak window is expected behavior, not a soak observable breach.

---

### PE #44 — shows.distribution_defaults column missing on prod RDS (P1, OPEN, NEW 2026-05-15)

**Date filed:** 2026-05-15 (surfaced during F-Stats-1 Phase A G6 soak verification)
**Severity:** P1 (feature degraded via fallback path; no user-facing breakage)
**Status:** OPEN

The `GET /shows` endpoint logs:
[GET /shows] Sequelize findAll failed, trying raw SQL fallback: column "distribution_defaults" does not exist

**Surface:**
- `Show.js:96` — model declares `distribution_defaults` column
- `distributionService.js:80` — raw-SQL SELECT on the column (works because raw SQL routes around model)
- `distributionService.js:305` — raw-SQL UPDATE on the column

**Pre-existing status:** Confirmed pre-existing. Defensive raw-SQL fallback pattern indicates the developer who wrote `distributionService.js` already knew the column was missing on prod and worked around it.

**Pattern:** F-Ward-1 / F-App-1 schema drift. The fallback pattern is the same one audit §12.7 documents at `wardrobe.js:1291` and `WorldEvent.js:57` ("Defensive schema coding around character_state_history continues").

**Defer:** Out of F-Stats-1 scope. F-Ward-1 keystone territory.

---

### PE #45 — WorldEvent.source_profile_id column missing on prod RDS (P1, OPEN, NEW 2026-05-15)

**Date filed:** 2026-05-15 (surfaced during F-Stats-1 Phase A G6 soak verification)
**Severity:** P1 (feature degraded via include-fallback path)
**Status:** OPEN

The WorldEvents listing fails its eager-loading JOIN:
[WorldEvents] Includes failed, trying without: column WorldEvent.source_profile_id does not exist

**Surface:**
- `WorldEvent.js:76` — model declares `source_profile_id` column
- `WorldEvent.js:293` — model declares the SocialProfile association via foreign key
- `SocialProfile.js:15` — inverse association
- `feedScheduler.js:830, 832, 960, 962, 989` — service code reads/writes the column

**Pre-existing status:** Confirmed pre-existing. The "try includes, fall back to no includes" pattern indicates the developer worked around the missing column at runtime.

**Pattern:** Same F-Ward-1 schema-drift family as PE #44.

**Defer:** Out of F-Stats-1 scope. F-Ward-1 keystone territory.

---

### PE #46 — Wardrobe.s3_key_regenerated column missing on prod RDS (P1, OPEN, NEW 2026-05-15)

**Date filed:** 2026-05-15 (surfaced during F-Stats-1 Phase A G6 soak verification)
**Severity:** P1 (specific column on Wardrobe model; surface symptom TBD)
**Status:** OPEN

Error referenced in the morning soak logs; specific consumer not yet traced.

**Surface:** `Wardrobe.js:69` — model declares `s3_key_regenerated` column. Likely consumer surfaces in wardrobe routes; specific file:line refs to be added when triaged.

**Pre-existing status:** Pre-existing. Cross-references audit Memory #29 (defensive schema coding indicates production migration drift).

**Pattern:** F-Ward-1 keystone family. Wardrobe model is the canonical F-Ward-1 surface (audit v8 §6.12).

**Defer:** Out of F-Stats-1 scope. F-Ward-1 keystone territory; almost certainly resolves as part of F-Ward-1's migration capture.

---

### PE #47 — ui_overlay_types relation drift (P1, OPEN, NEW 2026-05-15)

**Date filed:** 2026-05-15 (surfaced during F-Stats-1 Phase A G6 soak verification)
**Severity:** P1
**Status:** OPEN

Soak logs surfaced "missing relations like `ui_overlay_types`." Different shape from PE #43-#46: those are missing columns on existing tables; this is a missing table/relation.

**Surface:**
- `uiOverlayService.js:6` — comment documenting the table's purpose (per-show overlay types)
- `uiOverlayService.js:43` — raw-SQL SELECT from `ui_overlay_types`
- `timelinePlacementService.js:95, 120` — additional read sites
- `episodeGeneratorService.js:593` — comment referencing the table

**Pre-existing status:** Pre-existing. The OVERLAY_TYPES migration (per audit user memory: "migrations/20260725000000 already removed hardcoded OVERLAY_TYPES JS constants and moved them into ui_overlay_types DB table") may have run on dev but not prod, OR the migration ran but the table was later dropped, OR the migration was never run on prod RDS.

**Pattern:** Missing-table variant of F-Ward-1 schema drift. Worth distinguishing from PE #43-#46 because the fix path is different — column adds vs. table creation.

**Defer:** Out of F-Stats-1 scope. F-Ward-1 keystone territory, but flagging the missing-table variant explicitly because it requires migration ordering work (create table → populate → wire consumers) that's different from "add missing column to existing table."

---

### PE #49 — cost_watchdog: 50% AI call error rate flagged by CFO audit (P1, OPEN, NEW 2026-05-16)

**Date filed:** 2026-05-16 (surfaced during F-Deploy-1 Fix Plan v1.0
ship session, soak script execution)
**Severity:** P1 (cost surface, no service-availability impact, no
security implication)
**Status:** OPEN

CFO scheduled audit (runs every 6 hours) consistently flags:

```
[cost_watchdog] 50.0% error rate — failed calls waste money on partial
token processing
```

**Frequency:** Confirmed in two consecutive CFO runs (2026-05-16 06:46
UTC, 2026-05-16 12:46 UTC). Both reports show identical critical-finding
list and identical audit score (83/100). Pattern suggests a steady-state
failure mode, not an intermittent issue.

**Surface:** `cost_watchdog` is the CFO audit's name for the
cost-monitoring subsystem. Underlying code location not yet traced;
likely `services/cfo*` or `services/costWatchdog*` per `cfoAgentRoutes.js`
naming convention. Per F-AUTH-1 plan v2.37 §5.66 the cfoAgent itself is
non-AI orchestration; cost_watchdog inside it appears to monitor AI call
cost rather than execute AI calls directly.

**Impact:** Half of monitored AI calls are failing in a way that still
produces token consumption ("partial token processing"). Direct AWS /
Anthropic / Replicate / RunwayML cost waste at unknown dollar magnitude.
Severity P1 because cost waste is real but not service-breaking or
security-affecting.

**Open questions:**

- Which AI provider(s) is the 50% error rate concentrated on?
  cost_watchdog monitors multiple — Anthropic, OpenAI / DALL-E,
  RunwayML, Replicate per onboarding doc.
- Is the "50%" stable (always ~50%) or did it drift to this value?
- Are the failing calls retryable, or is the wasted token spend per-call
  irrecoverable?

**Resolution path:**

1. Identify the cost_watchdog code surface and its data source (likely
   a database table or in-memory store tracking AI call outcomes).
2. Query for the breakdown by provider + error type to identify the
   dominant failure mode.
3. Determine whether the partial-token-processing pattern is fixable at
   the call-site (retry logic, request validation) or at the AI provider
   level (different model, different parameters).
4. Implement the fix; verify the CFO audit score improves and the 50%
   rate decreases.

**Defer:** Out of F-Deploy-1 scope (cost surface, not deploy-pipeline
surface). Adjacent to but not the same as the AI surface concerns in
F-AUTH-1's aiRateLimiter (PR #694). Filed for separate fix plan when
triaged.

---

### PE #50 — External AWS infrastructure change during G4 soak: NAT Gateway count reduced 4 → 2 (P2, OPEN, NEW 2026-05-20)

**Date filed:** 2026-05-20 (surfaced during F-Deploy-1 Phase A G4 soak day 1 observable check)
**Severity:** P2 (cost-positive infrastructure change; soak-impact-negative; methodological gap as third-party action)
**Status:** OPEN

Overnight 2026-05-19/20, a third party (Evoni's husband) reduced the AWS NAT Gateway count in the production VPC from 4 to 2 via out-of-band AWS console action. Two Elastic IPs were released alongside the NAT removals:

- `eipalloc-0a1d45204993661c9` / `3.232.31.122`
- `eipalloc-0ca02e2cfc9893b4d` / `52.1.121.227`

**Soak impact:** None observable. PM2 uptime on prod backend EC2 (2D at time of observation) predates the NAT deletion. All four CFO scheduled audits across the reduction window (15:06, 21:06, 03:06, 09:06 UTC) completed successfully with no new critical findings attributable to NAT topology change. F-Deploy-1 Phase A G4 soak day 1 observables remained clean across all four soak criteria (no autonomous merges to main outside validate.yml-gated PR path; no `-X ours` events failing to notify #708; no branch protection bypasses; no F-Deploy-G1-Y recurrence).

**Significance for F-Stats-1 Phase B G1 Planning artifact §6.5:** The 4→2 reduction partially answers §6.5.2 (NAT reducibility) empirically — the workload tolerated the reduction across the soak window with no observable degradation. §6.5.1 (idle classification of the *retained* 2 NATs) remains open and now includes a methodological verification sub-question: confirm that the retained 2 NATs were the *right* 2 to keep. The empirical "system tolerated the reduction" finding is real, but the decision-quality of *which* 2 were removed was not vouched for by Prime Studios audit discipline (third-party external action). Sub-amendment to Phase B G1 Planning §6.5 folded in 2026-05-21; awaits artifact ship post-soak.

**Methodological gap:** External infrastructure change during soak window without prior coordination is a soak-discipline gap, not a soak-criterion breach. The four soak observables remained clean and the reduction was cost-positive. Recording PE #50 at P2 because it's a "this should not have happened without coordination, but it did and the system tolerated it" finding, not a defect.

**Cost impact framing:** NAT Gateways at approximately $32/month each plus data processing charges. 4→2 reduction captures approximately $64/month of pure overhead. Cost-positive change; no rollback warranted.

**Resolution path:** No code or pipeline fix required. Two follow-up items for post-soak work:

1. Route-table audit of the retained 2 NATs to confirm idle status and verify that the retained 2 are the right 2 to keep (per F-Stats-1 Phase B G1 §6.5.1 sub-amendment).
2. Soak-discipline protocol update: future soak windows should explicitly include "no AWS infrastructure changes" as a written observable, not just an implicit posture rule.

**Defer:** Both follow-ups deferred post-soak. F-Stats-1 Phase B G1 Planning artifact ships with §6.5 sub-amendment when Phase A G4 closes 2026-05-26.

---

### PE #51 — F-AUTH-1 §5.1 pre-flight input: write routes with optionalAuth (P0, OPEN, NEW 2026-05-20, AMENDED 2026-05-21)

**Date filed:** 2026-05-20 (surfaced during F-AUTH-1 §5.1 pre-flight grep preparation)
**Severity:** P0 (F-AUTH-1 keystone surface; security keystone leads fix sequence per audit memory)
**Status:** OPEN (queued behind F-Deploy-1 Phase A close + F-AUTH-1 execution)

F-AUTH-1's `optionalAuth` middleware permits writes from unauthenticated requests. Per audit v9 / v10 §4.1, F-AUTH-1's six-step coordinated recipe is the canonical fix. PE #51 catalogs the *pre-flight inventory* of `optionalAuth` write-route surface drift that F-AUTH-1 execution must address.

---

**⚠️ 2026-05-21 VERIFICATION AMENDMENT — see below for corrected inventory. The 2026-05-20 inventory was incomplete; original numbers and surface references are preserved for evidence-state continuity. The corrected inventory is authoritative for F-AUTH-1 execution.**

---

**Original 2026-05-20 inventory (preserved as evidence-state snapshot):** 16 write routes with `optionalAuth` on them, comprising:

**4 explicit per-route `optionalAuth` declarations:**
- `luxuryFilterRoutes.js:11`
- `luxuryFilterRoutes.js:32`
- `seasonRhythmRoutes.js:16`
- `worldStudio.js:2483`

These four are likely justified-public-read candidates pending per-route review during F-AUTH-1 execution.

**12 inherited via 2 file-level `router.use(optionalAuth)` mounts:**
- `authorNoteRoutes.js:18` covers 3 mutations:
  - `authorNoteRoutes.js:60` (`router.post('/')`)
  - `authorNoteRoutes.js:84` (`router.put('/:id')`)
  - `authorNoteRoutes.js:108` (`router.delete('/:id')`)
- `entanglementRoutes.js:40` covers 8 mutations:
  - `entanglementRoutes.js:88` (`router.post('/characters/:characterId/entanglements')`)
  - `entanglementRoutes.js:124` (`router.patch('/entanglements/:id')`)
  - `entanglementRoutes.js:145` (`router.delete('/entanglements/:id')`)
  - `entanglementRoutes.js:166` (`router.patch('/profiles/:profileId/state')`)
  - `entanglementRoutes.js:252` (`router.post('/events/:id/resolve')`)
  - `entanglementRoutes.js:265` (`router.post('/events/:eventId/proposals/:characterId/approve')`)
  - `entanglementRoutes.js:325` (`router.post('/characters/:characterId/unfollows')`)
  - `entanglementRoutes.js:360` (`router.patch('/unfollows/:id/confirm')`)

(Count: 3 + 8 = 11 inherited mutations from file-level mounts. Combined with the 4 explicit per-route = 15. The 16th is the file-level mount itself counted as a write-permitting middleware declaration; if counting only individual route surfaces, the total is 15. Pre-flight grep deliverable to refine the count classification.)

**Plus:** `app.js:236` global mount of `optionalAuth`. F-AUTH-1 plan v2.37 §4.3 cites this mount at `:364`; the line number has drifted (likely from refactoring or comment additions between v2.37 authoring and 2026-05-20). v2.37 §4.3 framing of "global mount as sub-form (a)" remains correct in substance; the line reference needs updating to `:236` during F-AUTH-1 execution.

---

### 2026-05-21 verification amendment — corrected inventory

**Trigger:** F-AUTH-1 §5.1 pre-flight grep script (`docs/audit/f-auth-1_preflight_grep.ps1`) executed against current repository state on 2026-05-21. Verification surfaced three errors in the original PE #51 inventory:

**Error 1 — File path correction.** The "`app.js:236` global mount" claim is correct on line number but wrong on file path. The actual global mount lives at **`src/app.js:236`**, not at root-level `app.js`. Root-level `app.js` is a 40-byte stub file; the real Express application is in `src/app.js`. v2.37 §4.3's `:364` reference is therefore a line drift in `src/app.js`, not `app.js`. F-AUTH-1 execution should target `src/app.js:236`.

**Error 2 — Second `app.use` site missed.** `src/app.js:1168` has a *second* auth-middleware mount that PE #51 missed entirely: `app.use('/admin/queues', requireAuth, authorize(['ADMIN']), queueMonitorRoutes);`. This is a path-prefixed mount applying `requireAuth` + role-based authorization to admin queue routes. Substantively safe (admin routes are auth-gated), but PE #51's "global mount" framing should account for both `app.use` sites, not just the one. F-AUTH-1 framing should record both.

**Error 3 — Three additional write-route `optionalAuth` declarations missed.** `iconSlots.js` has six per-route `optionalAuth` declarations across lines 21/31/41/51/61/71. Three are on GET routes (read surface — belongs in PE #55); three are on **write routes** (belongs in PE #51):
- `iconSlots.js:49` — `router.post(...)` declaration; `optionalAuth` middleware at line 51 (Pattern 5/6 multi-line)
- `iconSlots.js:59` — `router.put(...)` declaration; `optionalAuth` middleware at line 61 (Pattern 5/6 multi-line)
- `iconSlots.js:69` — `router.delete(...)` declaration; `optionalAuth` middleware at line 71 (Pattern 5/6 multi-line)

These three were missed in the 2026-05-20 inventory because the source grep was filtered to specific files rather than the full `src/routes/` tree.

**Line-number convention note:** PE #51 originally captured these as middleware-line references (51/61/71). Corrected to route-declaration lines (49/59/69) — the route is what F-AUTH-1 execution classifies; the middleware-line reference is preserved as documentation of where `optionalAuth` actually appears.

**Corrected write-route count:** 15 individual write routes (original) + 3 (iconSlots writes) = **18 write routes with `optionalAuth`** at the per-route layer or via file-level mount. Plus the two `src/app.js` `app.use(...)` mounts at lines 236 and 1168 — both of which apply broadly across mounted routes.

**Corrected surface inventory (authoritative for F-AUTH-1 execution):**

**Explicit per-route `optionalAuth` declarations on writes:**
- `luxuryFilterRoutes.js:11` (POST)
- `luxuryFilterRoutes.js:32` (POST)
- `seasonRhythmRoutes.js:16` (POST)
- `worldStudio.js:2483` (POST, with `degradeOnInfraFailure: true` option)
- `iconSlots.js:49` (POST) — declaration line; middleware at :51 — added 2026-05-21
- `iconSlots.js:59` (PUT) — declaration line; middleware at :61 — added 2026-05-21
- `iconSlots.js:69` (DELETE) — declaration line; middleware at :71 — added 2026-05-21

**File-level `router.use(optionalAuth)` mounts covering writes:**
- `authorNoteRoutes.js:18` covers 3 mutations (lines 60, 84, 108)
- `entanglementRoutes.js:40` covers 8 mutations (lines 88, 124, 145, 166, 252, 265, 325, 360)

**Global `app.use(...)` mounts in `src/app.js`:**
- `src/app.js:236` — bare `app.use(optionalAuth)` (applies to all routes mounted after this line, unless overridden)
- `src/app.js:1168` — `app.use('/admin/queues', requireAuth, authorize(['ADMIN']), queueMonitorRoutes)` (path-prefixed requireAuth mount)

**Sibling inventory:** PE #55 (new, filed 2026-05-21) catalogs the read-surface `optionalAuth` inventory (~40+ GET routes across ~13 files). PE #51 scope explicitly excludes read routes; PE #55 carries that.

**v2.37 §4.3 reference update owed:** v2.37 cites `app.js:364`; corrected reference is `src/app.js:236`. Update owed during F-AUTH-1 execution or in v2.37's next revision.

---

**Defer:** Out of current session scope. F-AUTH-1 execution (six-step recipe) is the canonical fix path. F-AUTH-1 execution is queued behind F-Deploy-1 Phase A close per v10 Decision #98 revised. PE #51 (corrected) is the pre-flight input to F-AUTH-1 §5.1 grep deliverable.

**Resolution path:**

1. F-AUTH-1 §5.1 pre-flight grep deliverable (now at `docs/audit/F-AUTH-1_Preflight_Grep_Deliverable.md`) formalizes the inventory + per-route classification (justified-public-read vs sub-form-a-true-positive).
2. F-AUTH-1 execution (post-Phase-A-close) applies the six-step recipe; sub-form (a) sweep absorbs PE #51 surfaces.
3. `src/app.js:236` + `src/app.js:1168` references folded into v2.37 §4.3 when v2.37 is next revised, or captured as v2.37-stale finding in v11 handoff if v2.37 doesn't get a revision before F-AUTH-1 execution.

---

### PE #52 — F-AUTH-1 §5.1 pre-flight input: write routes with no file-level auth declaration (P0, OPEN, NEW 2026-05-20, AMENDED 2026-05-21)

**Date filed:** 2026-05-20 (surfaced during F-AUTH-1 §5.1 pre-flight grep preparation)
**Severity:** P0 (F-AUTH-1 keystone surface; sub-form-b candidate list)
**Status:** OPEN (queued behind F-Deploy-1 Phase A close + F-AUTH-1 execution)

F-AUTH-1 sub-form (b) is the cluster of write routes with no auth middleware at the file-router level *and* no per-route auth middleware. PE #52 catalogs the pre-flight inventory of *candidate* sub-form (b) files — routes with no file-level `router.use(auth)` mount.

---

**⚠️ 2026-05-21 VERIFICATION AMENDMENT — original inventory was a sample, not a complete count. Corrected outer bound is below. True sub-form (b) count requires per-route classification still pending at F-AUTH-1 execution time. Original numbers preserved for evidence-state continuity.**

---

**Original 2026-05-20 inventory (preserved as evidence-state snapshot):** ~53 write routes across 9 files with no file-level auth declaration:

- `animatic.js` — 4 write routes (lines 23, 70, 98, 123)
- `compositions.js` — 13 write routes (lines 148, 617, 916, 948, 968, 1114, 1305, 1384, 1419, 1470, 1519, 1621)
- `continuityEngine.js` — 11 write routes (lines 101, 120, 140, 158, 187, 207, 225, 276, 312, 326, 407)
- `decisions.js` — 1 write route (line 12)
- `episodes.js` — 2 write routes (lines 660, 669)
- `footage.js` — 4 write routes (lines 47, 171, 256, 289)
- `roles.js` — 5 write routes (lines 98, 128, 153, 178, 239)
- `scenes.js` — 7 write routes (lines 189, 198, 307, 316, 325, 334, 343)
- `templateStudio.js` — 7 write routes (lines 143, 223, 343, 390, 470, 521, 572)

Total: 54 write routes across 9 files (matches ~53 framing within rounding).

---

### 2026-05-21 verification amendment — corrected outer-bound inventory

**Trigger:** F-AUTH-1 §5.1 pre-flight grep script (`docs/audit/f-auth-1_preflight_grep.ps1`) executed against current repository state on 2026-05-21. Script ran a full-coverage grep across `src/routes/`, surfacing significantly more candidate files than the original inventory captured.

**Methodological correction:** The original 2026-05-20 inventory was built from a partial grep output (filtered findings table covering 18 specific files), not a full-coverage grep across `src/routes/`. The original 9-file / ~53-route inventory captured only a sample of the actual candidate population. The 2026-05-21 full-coverage grep reveals the true outer bound.

**Corrected outer bound:**

- **120 candidate route files** with write routes and no file-level `router.use(auth-middleware)` mount.
- **853 candidate write routes** across those 120 files. (Original amendment cited 849 from a preliminary count; full script run on 2026-05-21 detected 853. Difference of 4 reflects undercount in the preliminary amendment, not drift.)

(Full file list with per-file write-route counts is in the F-AUTH-1 pre-flight grep script's drift summary output. Run the script for the current snapshot.)

**Important caveats (unchanged from 2026-05-20):** "No file-level auth mount" is *necessary but not sufficient* for sub-form (b) classification. Per-route classification owed at F-AUTH-1 execution time. The four-outcome classification space (sub-form-b true positive, justified-public-read, per-route auth false positive, multi-line auth false positive) holds; the count of routes requiring per-route inspection has grown from 54 to 849.

**Closure-semantic framing:** This amendment is an **evidence-state-revision** per v11 §3.3 closure-semantic vocabulary. The original PE #52 was correct at its evidence state (the partial grep output it was built from); new evidence (full-coverage grep) shows the original evidence was a sample. The original entry is preserved; the corrected count is authoritative going forward. This is the methodological pattern documented in v11 §3.3.4's discipline test — defer rather than paper over when evidence state changes.

**Specific issues with the corrected outer bound:**

1. **The 849 count likely overstates true sub-form (b) count significantly.** Many candidate files have per-route auth middleware that the file-level grep doesn't detect (e.g., `worldStudio.js` has 17+ per-route `optionalAuth` declarations on read routes despite no file-level mount). Per-route classification at F-AUTH-1 execution will reduce the 849 by some unknown but likely large fraction.

2. **Some candidate files are obviously justified-public.** Examples: `auth.js` (the auth endpoints themselves — login, refresh, validate), `onboarding.js` (initial user setup), `seed.js` (admin/dev-only seeders, probably justified by environment guards rather than HTTP auth). F-AUTH-1 execution will classify these as Outcome 2 (justified-public-read).

3. **Triage tier recommendation owed.** Given the 849-route outer bound, F-AUTH-1 execution would benefit from a triage tier system (high-likelihood sub-form-b, probably justified-public, needs per-route inspection). Per Path A.1 decision 3, this triage work is deferred to F-AUTH-1 execution time — the outer bound is the pre-flight input.

**Defer:** Out of current session scope. F-AUTH-1 execution applies per-route classification to the 120-file / 849-route outer bound and produces the refined sub-form (b) count + classification.

**Resolution path:**

1. F-AUTH-1 §5.1 pre-flight grep script (corrected version) produces the current outer-bound inventory on demand.
2. F-AUTH-1 execution applies per-route inspection across all 849 routes (or a triaged subset).
3. Each route classified to one of the four outcomes.
4. F-AUTH-1 six-step recipe applies to confirmed sub-form (b) true positives.

---

### PE #53 — v10 handoff staleness on F-App-1 keystone status (P2, OPEN, NEW 2026-05-20)

**Date filed:** 2026-05-20 (surfaced during v11 session brief outline drafting)
**Severity:** P2 (documentation drift; no production impact)
**Status:** OPEN (resolves via v11 authoring at soak close 2026-05-26)

Prime Studios Audit Handoff v10 (authored 2026-05-16, on main via PR #701 commit `b0575e56`) describes F-App-1 keystone status as "queued, unchanged from v9." This is stale.

**Actual F-App-1 status at v10 authoring time:** F-App-1 had shipped via incident-driven deployment on 2026-05-14 at 06:50 UTC per F-App-1 Fix Plan v1.1 §12.15 — predating v10 authoring by 2 days. F-App-1 v1.1 documented the deviation as Path A (accept incident-driven deployment, no revert). Code at commit `6bfd99e` was on prod backend EC2.

v10's "queued" framing reflects either (a) v10 authoring session didn't read F-App-1 v1.1 §12.15 fresh, or (b) F-App-1 v1.1 was not yet merged to main at v10 authoring time. Either way, v10 carries forward v9's pre-incident framing.

**v1.3 partial resolution:** F-Deploy-1 Fix Plan v1.3 §7 (merged 2026-05-19, PR #710) resolves the *operational implications* — F-App-1 doesn't gate downstream keystones (Director Brain, F-Stats-1 Phase B, etc), and the F-App-1 ship status is reflected in v1.3's fix-sequence framing. However, the *handoff-document* staleness in v10 §4.2 / §2.1 remains.

**Impact:** Documentation drift only. No production impact. A future-Claude (or future-Evoni) reading v10 cold without reading v1.3 first could conclude F-App-1 is still queued, which would mislead fix-sequence reasoning about which keystone is the next executable target.

**Resolution path:** v11 authoring at F-Deploy-1 Phase A G4 soak close (2026-05-26) updates F-App-1 keystone status to "shipped via incident-driven deployment 2026-05-14, Path A locked per F-App-1 v1.1 §12.15." Per v11 session brief outline §2 + §3.1 + §4.

**Defer:** v11 authoring resolves automatically. No action needed pre-v11.

---

### PE #54 — Thumbnails listing endpoint: route-ordering captures `/thumbnails/generate` under parametric `/thumbnails/:id` (P1, OPEN, NEW 2026-05-20)

**Date filed:** 2026-05-20 (surfaced during F-Deploy-1 Phase A G4 soak day 1 observable check, separate from PE #43 schema-drift recurrence)
**Severity:** P1 (feature broken via routing-table ordering; symptom mimics PE #43 schema drift but root cause differs)
**Status:** OPEN

During the 2026-05-20 09:31:57 UTC observable check, the Thumbnails listing endpoint surfaced error logs containing:

```
WHERE "Thumbnail"."id" = 'generate'
```

**Root cause class:** Express middleware route-ordering, not schema drift. The `/thumbnails/generate` action route is declared *after* a parametric `/thumbnails/:id` route in `src/routes/thumbnails.js` (or equivalent). When a request hits `/thumbnails/generate`, Express's first-match-wins routing captures it under `/thumbnails/:id` with `id='generate'`, which then attempts a SQL lookup with `WHERE "Thumbnail"."id" = 'generate'`.

**Distinct from PE #43:** PE #43 is the camelCase/snake_case JOIN failure on `thumbnails.episode_id`. PE #54 is the route-ordering capture of an action route by a parametric route. They surface on the same endpoint family but have different root causes and different fix paths:

- PE #43 fix: schema-drift correction (F-Ward-1 keystone territory).
- PE #54 fix: route-ordering correction (move `/thumbnails/generate` declaration *before* `/thumbnails/:id` in the route file).

**Surface:** `src/routes/thumbnails.js` route declaration order. Specific line numbers TBD — needs inspection of the route file to confirm the `/thumbnails/generate` and `/thumbnails/:id` declaration sequence.

**Impact:** All `/thumbnails/generate` POST requests fail with the parametric-route SQL error rather than executing the generate action. Action endpoint is effectively unreachable through normal client requests.

**Pre-existing status:** Pre-existing. Same error pattern surfaced in 2026-05-15 soak logs alongside PE #43; the route-ordering observation wasn't disentangled from PE #43 until the 2026-05-20 review.

**Pattern:** Express middleware ordering. Common Express anti-pattern where action routes (`/resource/action`) are declared after parametric routes (`/resource/:id`), causing the action to be captured. Standard fix: declare action routes before parametric routes within the same router.

**Defer:** Lower-effort fix than PE #43 (no schema migration needed, just route reordering), but bundling with PE #43 may make sense since both surface on the same endpoint family. Not blocking F-Deploy-1 soak. Triage when next thumbnails-domain work happens, or bundle with F-Ward-1 sweep if PE #43 lands first.

**Resolution path:**

1. Inspect `src/routes/thumbnails.js` for declaration order of `/thumbnails/generate` and `/thumbnails/:id`.
2. Reorder declarations so action routes precede parametric routes.
3. Add lint rule or test coverage to flag future occurrences of action-after-parametric in router files.

---

### PE #55 — F-AUTH-1 §5.1 pre-flight input: read routes with optionalAuth (sibling inventory to PE #51) (P1, OPEN, NEW 2026-05-21)

**Date filed:** 2026-05-21 (surfaced during PE #51 / PE #52 verification work)
**Severity:** P1 (lower than PE #51/#52 — read routes with `optionalAuth` are usually correct by design; F-AUTH-1 needs to verify but not necessarily fix)
**Status:** OPEN (queued behind F-Deploy-1 Phase A close + F-AUTH-1 execution)

PE #51's scope is **write routes** with `optionalAuth` (POST/PUT/PATCH/DELETE — F-AUTH-1 sub-form (a) defect class). PE #55 catalogs the *sibling* inventory of **read routes** with `optionalAuth` (GET — `optionalAuth` on reads is usually correct by design, but F-AUTH-1's §5.1 inventory should know the full surface to confirm).

**Inventory (full-coverage grep, 2026-05-21):** ~40+ GET routes with `optionalAuth` across 13 route files:

- `decisionAnalytics.js` — 7 read routes (lines 10, 38, 66, 101, 135, 163, 196)
- `feedPostRoutes.js` — 3 read routes (lines 21, 94, 134)
- `franchiseBrainRoutes.js` — 5 read routes (lines 31, 272, 452, 468, 678)
- `iconSlots.js` — 3 read routes (lines 21, 31, 41 — sibling to the 3 write routes captured in PE #51)
- `layers.js` — 2 read routes (lines 13, 57)
- `manuscript-export.js` — 3 read routes (lines 132, 162, 570 — all with `degradeOnInfraFailure: true` option)
- `press.js` — 2 read routes (lines 456, 502 — both with `degradeOnInfraFailure: true` option)
- `seasonRhythmRoutes.js` — 2 read routes (lines 50, 66 — sibling to the 1 write route captured in PE #51)
- `socialProfileRoutes.js` — 3 read routes (lines 969, 1290, 2678)
- `textureLayerRoutes.js` — 2 read routes (lines 206, 222)
- `universe.js` — 3 read routes (lines 36, 61, 111)
- `worldStudio.js` — 17 read routes (lines 1069, 1094, 1907, 1920, 2136, 2157, 2371, 2422, 2447, 2902, 2965, 3143, 3360, 3410, 3476, 3557, 3665, 3679 — sibling to the 1 write route at line 2483 captured in PE #51)
- `export.js` — special case: uses `optionalAuth` as a conditional `authMiddleware` based on `NODE_ENV` (line 16: `const authMiddleware = process.env.NODE_ENV === 'production' ? authenticate : optionalAuth;`). This means in production the routes use `authenticate` (strict), in dev they use `optionalAuth`. F-AUTH-1 execution should verify this is the intended behavior — it's an environment-gated auth pattern not seen elsewhere in the codebase.

**Total read routes with `optionalAuth`:** ~50 (counting iconSlots/seasonRhythm/worldStudio reads alongside the dedicated files), plus the `export.js` conditional pattern.

**Why this is filed separately from PE #51:**

`optionalAuth` on reads is the *intended* use case for the middleware — it provides public access while attaching user identity when a token is present. PE #51's defect framing ("`optionalAuth` permits writes from unauthenticated requests") doesn't apply to reads in the same way.

But F-AUTH-1 execution needs to verify that each read route's use of `optionalAuth` is *intentional* rather than *accidental*. A read route that was originally a write route, refactored to a read, but kept the `optionalAuth` middleware out of inertia, is still a defect-adjacent finding.

**Classification space for read routes with `optionalAuth`:**

1. **Justified-public-read** — route returns data that should be accessible to unauthenticated users, with optional user-specific augmentation when auth is present. Most common case. F-AUTH-1 recipe skips with documented rationale.
2. **Auth-uplift candidate** — route returns data that should require auth (e.g., user-specific data accidentally exposed via `optionalAuth`). F-AUTH-1 recipe applies (replace `optionalAuth` with `requireAuth`).
3. **Mixed-mode by design** — route deliberately uses `optionalAuth` to provide different responses for authenticated vs unauthenticated users (e.g., a public listing that hides private items for anonymous users, shows them for the owner). Justified, but should be documented to prevent future maintainers from "fixing" the mixed-mode behavior.

**Defer:** Out of current session scope. F-AUTH-1 execution applies per-route classification. PE #55 is the pre-flight input to F-AUTH-1's read-surface inventory step (likely a new sub-section of F-AUTH-1 plan §5.1 in next v2.x revision).

**Resolution path:**

1. F-AUTH-1 §5.1 pre-flight grep deliverable inventories the read surface alongside the write surface.
2. F-AUTH-1 execution applies per-route classification across the ~50 read routes.
3. Outcome 2 (auth-uplift) candidates get `requireAuth` migration; Outcomes 1 and 3 documented as justified-skip.
4. `export.js` conditional auth pattern verified as intentional or flagged for refactor.

---

### PE #56 — Decision #9 vs v10 Decision #98 gate-strictness drift (P2, OPEN, NEW 2026-05-21)

**Date filed:** 2026-05-21 (surfaced during F-Stats-1 v1.2 Decision #9 read)
**Severity:** P2 (documentation drift; no production impact; resolves via v11 authoring)
**Status:** OPEN (resolves via v11 authoring at soak close 2026-05-26)

F-Stats-1 Fix Plan v1.2 §9 Decision #9 (2026-05-15) and Prime Studios Audit Handoff v10 Decision #98 revised (2026-05-16) name *different* gates for the F-Stats-1 Phase B G2 unblock.

**Decision #9 gate (stricter):** Phase B G2 paused until F-Deploy-1 *keystone* lands. "F-Deploy-1 keystone fix plan to be authored before any Phase B PR ships." Reading: all phases (A + B + C) of F-Deploy-1 must close, not just Phase A.

**v10 Decision #98 revised gate (relaxed):** F-Stats-1 Phase B G2 blocked on F-Deploy-1 Fix Plan *Phase A close*. Reading: only Phase A close required; Phases B + C can run downstream of F-Stats-1 Phase B G2.

**Drift mechanism:** v10 Decision #98 deliberately relaxed Decision #9's framing. Per audit memory: "F-Stats-1 Phase B G2 serves *as* the canonical Phase B G6 soak pilot, so the unblock gate is Fix Plan-internal (Phase A close) not keystone-internal." This relaxation makes operational sense — F-Stats-1 Phase B G2 itself provides part of the testing surface F-Deploy-1 Phases B/C need.

**Impact:** Documentation drift only. v10's relaxed gate is authoritative for current planning per the v10 → v9 progression. No production impact. But future-Claude reading F-Stats-1 v1.2 Decision #9 cold (without reading v10 first) could apply the stricter gate and unnecessarily delay Phase B G2 by 1-N weeks past F-Deploy-1 Phase A close.

**Resolution path:** v11 authoring at F-Deploy-1 Phase A G4 soak close (2026-05-26) should explicitly call out that F-Stats-1 v1.2 Decision #9's gate framing was relaxed by v10 Decision #98 revised, with the v10 framing authoritative. v11 §2 (keystone status rewrite) or §7 (decisions log integration) is the natural placement. Per v11 session brief outline.

**Defer:** v11 authoring resolves automatically. No action needed pre-v11.

---

### PE #57 — Branch protection settings on main vs Decision #9 / FD-5 (P2, OPEN, NEW 2026-05-21, RECLASSIFIED P1→P2 2026-05-21, 3rd dimension added 2026-05-22)

**Date filed:** 2026-05-21 (surfaced during F-Stats-1 v1.2 Decision #9 read)
**Original severity:** P1 (live security-posture finding; admin bypass possible on main)
**Current severity:** P2 (documentation-reconciliation finding; Decision #9 phrasing vs FD-5 actual scope. Reclassified 2026-05-21 afternoon after `enforce_admins` decision-archaeology found extensive FD-5 documentation.)
**Status:** OPEN (resolves via v11 authoring at soak close 2026-05-26)

F-Stats-1 Fix Plan v1.2 §9 Decision #9 (2026-05-15) explicitly named "branch protection on `main` *with admin enforcement*" as a required F-Deploy-1 keystone scope item. The branch protection that actually shipped via FD-5 / FD-23 / FD-24 (live on main per 2026-05-19 ship) has `enforce_admins: false`.

**Surface:** GitHub branch protection rule on `origin/main`. Three required status checks (Cost Exposure Audit, Tests, Route Validation), `strict=true`, `enforce_admins=false`. Confirmed via soak observable check 2026-05-20 / 2026-05-21.

**Impact:** An admin (which includes JAWIHP's GitHub account) can push directly to main bypassing the three required status checks. This is the explicit security-shape gap Decision #9 was naming as required to close.

**Why this is filed as P1 not P2:** This isn't documentation drift — it's a live security-posture finding. The shipped branch protection is materially weaker than what Decision #9 specified. The three required status checks provide defense for non-admin contributors but provide no defense against admin pushes (including accidental admin pushes, malicious admin pushes if account compromised, or autonomous-tool admin pushes if F-Deploy-G1-Y class issues recur).

**Three possible explanations for the drift:**

1. **Decision #9 stale.** Between 2026-05-15 (Decision #9) and 2026-05-19 (FD-5/FD-23/FD-24 ship), the admin-enforcement requirement was deliberately relaxed but the revision wasn't tracked in any visible decision. Most likely if there was operational reason (e.g., emergency hotfix capability for solo-developer environment).

2. **FD-5 ships incomplete.** FD-5 implemented branch protection but didn't carry forward Decision #9's admin-enforcement requirement. Could be authoring oversight (FD-5 author didn't read Decision #9 fresh) or could be unstated deliberate exclusion.

3. **Deliberate revision happened, marker lost.** A decision was made between 2026-05-15 and 2026-05-19 to drop admin-enforcement, but the decision didn't get a numbered FD-N decision-log entry.

**Pre-existing flag:** The 2026-05-20 end-of-session note already flagged `enforce_admins: false` as "remains as observed; not addressed by v1.3, still worth flagging for v11." This PE entry anchors that flag to Decision #9's explicit requirement, strengthening the case for v11 reconciliation.

**Resolution path:** F-AUTH-1 / F-Sec-3 territory, downstream of F-Deploy-1 Phase A close. Three options for resolution:

1. **Enforce admins.** Flip `enforce_admins=true` via GitHub API. Restores Decision #9 specification. Cost: admin emergency-fix capability removed; any admin push must come through PR with all three checks passing.
2. **Document the relaxation.** Decision #9 narrows to "branch protection on main with required status checks for non-admin contributors." Update v10 § Decision #98 family. Cost: explicitly accepts the security-shape gap.
3. **Compensating control.** Keep `enforce_admins=false`, add audit-trail mechanism so admin pushes that bypass checks trigger notifications or post-push validation. Cost: complexity; doesn't prevent the bypass, only audits it.

Recommend option 1 (enforce_admins=true) as the default; option 3 if option 1 turns out to break a needed operational workflow. Option 2 is the least-secure path and should require explicit decision-log justification.

**Defer:** Out of current soak-window scope (no AWS / GitHub API touches during G4 soak). Triage at soak close 2026-05-26. F-AUTH-1 execution or F-Sec-3 scope.

---

**2026-05-21 amendment — required_approving_review_count=0 sibling finding (soak day 2 observable sweep):**

The 2026-05-21 soak day 2 observable sweep (Observable 3: branch protection verification via `gh api`) confirmed `enforce_admins: false` as expected. It also surfaced a sibling configuration that strengthens the Decision #9 vs shipped-state gap:

```
required_pull_request_reviews.required_approving_review_count: 0
```

PRs require zero approving reviews to merge. Combined with `enforce_admins=false`, the effective branch protection on main is:

- Any contributor (admin or non-admin) can self-merge a PR once the three required status checks pass.
- Admins can additionally bypass the status checks entirely.
- No human-reviewer gate exists at any level.

**Is this intentional?** Possibly, given the solo-developer environment — JAWIHP is the only active contributor and can't meaningfully review her own PRs. But the zero-review setting is *separately* configurable from admin-bypass; the deliberate-vs-oversight question applies independently to each.

Decision #9 (2026-05-15) named "branch protection on main with admin enforcement" as the required F-Deploy-1 scope. The shipped state has both `enforce_admins=false` *and* `required_approving_review_count=0`. Either or both could be intentional relaxations; the decision-archaeology question covers both.

**No change to severity (still P1).** The sibling finding doesn't escalate PE #57 — `enforce_admins=false` was already the live security-shape gap. The zero-review setting expands the surface but doesn't change the class.

**Resolution path additions:**

Option 1 (enforce_admins=true) restores admin-bypass closure. To restore the human-reviewer gate, additionally:

- Set `required_approving_review_count: 1` (with documented exception for solo-developer review hygiene), OR
- Add `code_owner_reviews` requirement on protected paths, OR
- Accept zero-review explicitly in v10 § Decision #98 family with documented rationale (solo developer, status checks provide compensating coverage).

**Observable continuity:** Future soak observable sweeps should add `required_approving_review_count` to the branch-protection check alongside `enforce_admins`. Both inform the same Decision #9 vs shipped-state question.

---

**2026-05-21 second amendment — `enforce_admins` decision-archaeology resolves framing (severity P1→P2):**

The 2026-05-21 afternoon `enforce_admins` archaeology pass (PowerShell grep across F-Deploy-1 Fix Plan v1.0 / v1.1 / v1.3 + G1 audit) found the original PE #57 framing was substantively wrong. The shipped state is NOT a Fix Plan / shipped-state drift. It is a deliberate, extensively documented design choice.

**Documentary evidence found:**

- **F-Deploy-1 G1 Audit §3.6.3** (Finding F-Deploy-G1-X): named `enforce_admins: false` as "the pragmatic default for a single-developer repo... lets the owner unblock themselves in emergencies."
- **F-Deploy-1 Fix Plan v1.0 line 387**: explicitly chose to preserve the setting — "`enforce_admins` stays at `false` (admin bypass available for emergencies)."
- **F-Deploy-1 Fix Plan v1.0 line 394**: documented the policy rationale — "`enforce_admins: false` is the pragmatic default for a single-developer repo. The policy needs explicit documentation so future contributors (or future-Evoni reading old commits) understand: admin bypass is intentional, used sparingly, logged in Decisions when invoked."
- **F-Deploy-1 Fix Plan v1.0 line 918 (Decision FD-5)**: locked the configuration as "minimal real gate — `required_status_checks: [Validate]`, zero required reviews, `enforce_admins: false`."
- **F-Deploy-1 Fix Plan v1.1 line 304**: reaffirmed FD-5 in the Gate A-G1 closure record.
- **F-Deploy-1 Fix Plan v1.3 line 21 / line 102**: shipped via direct `gh api` call per FD-5 specifications exactly. Verification command + expected output documented in §6.2.

**Corrected framing:** The drift PE #57 originally flagged is between F-Stats-1 v1.2 Decision #9's phrasing ("branch protection on main with admin enforcement," 2026-05-15) and FD-5's actual scope (`enforce_admins=false`, solo-dev emergency-bypass rationale). It is NOT a drift between Fix Plan and shipped state — those match exactly per FD-5.

**Most likely mechanism:** Decision #9 was authored as a brief lock-in of "F-Deploy-1 starts before any other work" with a generic enumeration of expected F-Deploy-1 scope. The "with admin enforcement" framing was aspirational/generic phrasing, not a deliberate override of FD-5's prior commitment. Decision #9's author (in this case Claude during the 2026-05-15 session that filed Decision #9) did not read F-Deploy-1 v1.0 §5.2.1 / FD-5 before phrasing the requirement.

**Severity reclassification: P1 → P2.** What PE #57 originally called a "live security-shape gap" is actually a documented deliberate design choice. The settings are intentional. The drift is documentation reconciliation, same class as PE #56 (Decision #9 vs v10 Decision #98 gate-strictness drift). Both are now Decision #9-phrasing-staleness findings, not live-defect findings.

**Resolution path corrected:**

- ~~Option 1 (enforce_admins=true)~~ — no longer recommended. FD-5's rationale stands; flipping to true would defeat the solo-dev emergency-bypass capability F-Deploy-G1-X identified and FD-5 deliberately chose to preserve.
- ~~Option 2 (document the relaxation)~~ — already done, extensively, in F-Deploy-1 Fix Plan v1.0 §5.2.1 / lines 387 / 394 / 918 and verified in v1.3 §6.2.
- ~~Option 3 (compensating control)~~ — no longer needed; the setting itself is not a defect.
- **New corrected resolution:** v11 authoring at soak close should reconcile F-Stats-1 v1.2 Decision #9's "with admin enforcement" phrasing to match FD-5's actual scope. v11 §3.5 (the existing PE #57 anchor) should note that Decision #9's phrasing was generic and was superseded by FD-5's specific design choice. No change to shipped state.

**The `required_approving_review_count=0` sibling finding from the 2026-05-21 morning amendment:** Same corrected framing applies. FD-5 explicitly chose "zero required reviews" — solo-dev pattern, no human-reviewer gate possible without a second contributor. Documented at v1.0 line 918, v1.3 line 21, v1.3 line 105. Not a drift; deliberate FD-5 choice. The sibling-finding observation in the morning amendment was methodologically correct (it surfaced the configuration) but the implied "Decision #9 vs shipped state gap" framing was incorrect. Settings match FD-5; Decision #9 phrasing is what needs reconciliation.

**Methodological note:** This is the second time on 2026-05-21 that a finding filed against a decision was substantially corrected after reading the decision's source document. The first was PE #51/#52 inventory miss caught by F-AUTH-1 pre-flight grep script (Path A.1 morning rework). PE #57's misframing was caught by `enforce_admins` decision-archaeology this afternoon. Pattern captured in v11 §3.7 — "filing a finding without reading the relevant prior artifact in full produces filings that survive only until verification."

---

**2026-05-22 third amendment — third drift dimension surfaced via F-Deploy-1 v1.0 base plan read:**

The 2026-05-22 soak day 3 F-Deploy-1 v1.0 base plan read (h2 track) surfaced a *third* drift dimension within the same Decision #9 vs FD-5 vs shipped-state cluster. Adding to the two dimensions documented in prior amendments (`enforce_admins=false` and `required_approving_review_count=0`):

**Third dimension: `required_status_checks.contexts` count drift.**

- **Decision FD-5 specification (F-Deploy-1 v1.0 line 918):** `required_status_checks: [Validate]` — a single context named `Validate`.
- **Shipped state (verified 2026-05-22 morning observable sweep, soak day 3):** `required_status_checks.contexts: ["Cost Exposure Audit", "Tests", "Route Validation"]` — three contexts, none of which match the literal string `Validate`.

**Possible interpretations:**

- **(a) `Validate` was a workflow name shorthand and the three contexts are its sub-jobs.** If the `Validate` workflow's job matrix produces three named contexts (Cost Exposure Audit, Tests, Route Validation), FD-5's `[Validate]` was a high-level reference and the shipped state is the implementation. The drift is between Decision-level shorthand and API-level reality, not between intent and execution.
- **(b) Phase A G2 sharpened FD-5's commitment during implementation.** The three contexts may represent a deliberate refinement during Phase A G2 work — maybe the Validate workflow originally existed and was decomposed into three named checks for finer gate control. The drift is documented somewhere in v1.2 / v1.3 implementation notes that I haven't read.
- **(c) Status checks were independently configured.** The three contexts may have been added by separate work (e.g., the Cost Exposure Audit's own ship) and FD-5's specification was never updated to reflect.

**Verification approach (post-soak-close):**

```powershell
# Inspect .github/workflows/validate.yml structure - does it produce three contexts?
Get-Content .github/workflows/validate.yml | Select-String -Pattern "^name:|^jobs:|^\s+\w+:\s*$" -Context 0,1

# Check git history for when the three context names entered branch protection
gh api -H "Accept: application/vnd.github+json" /repos/angelcreator113/Episode-Canonical-Control-Record/branches/main/protection/required_status_checks/contexts
```

**Severity unchanged: P2.** Same class as the prior two dimensions — documentation reconciliation, not live defect. The three contexts in shipped state ARE gating PRs (verified via daily observable sweeps); the gate is functional. The drift is between FD-5's `[Validate]` shorthand and the API-level three-context implementation.

**Resolution path: same as prior two dimensions.** v11 authoring at soak close reconciles FD-5's spec to match shipped state, or documents the `Validate`-as-workflow-shorthand reading explicitly. No change to shipped state.

**Cluster framing (revised):** PE #57 now documents three dimensions of Decision #9 vs FD-5 vs shipped-state drift, all P2, all documentation-reconciliation:

1. `enforce_admins=false` — Decision #9 said "with admin enforcement"; FD-5 chose `false`; shipped matches FD-5.
2. `required_approving_review_count=0` — Decision #9 generic phrasing; FD-5 explicit zero; shipped matches FD-5.
3. `required_status_checks.contexts: [Cost Exposure Audit, Tests, Route Validation]` — FD-5 said `[Validate]`; shipped has three contexts. FD-5's spec needs reconciliation OR documentation of `Validate`-as-shorthand reading.

All three dimensions resolve via v11 authoring. Resolution is "make the documentation match the deliberate design choice that is already in shipped state," not "change shipped state."

**Methodological note:** Reading Fix Plan v1.0 directly surfaced a drift dimension that v1.1/v1.2/v1.3 references didn't expose. v11 §3.7 pattern continues to apply: "filing a finding without reading the relevant prior artifact in full produces filings that survive only until verification." Today's pattern is the inverse — *reading* the prior artifact produces additional findings against the executions that came after. The discipline test for v11 §3.7 should include both directions: read both sources (the originating decision document and the implementation revisions) before declaring a finding-vs-implementation cluster complete.

---

### PE #58 — Local-tooling identity drift status unknown (P2, CLOSED 2026-05-22 with corrected mechanism)

**Date filed:** 2026-05-21 (surfaced during F-Stats-1 v1.2 Decision #9 read)
**Severity:** P2 (the original framing as "local-tooling drift" was incorrect; actual mechanism is GitHub App attribution on workflow-performed squash-merges, which is expected behavior not defect)
**Status:** CLOSED 2026-05-22 — third and final closure attempt with corrected mechanism. See 2026-05-22 second amendment below for full investigation outcome. Previous closure (2026-05-21) and reopening (2026-05-22 morning) both based on incorrect mechanism framing; corrected understanding from 2026-05-22 afternoon investigation supersedes both.

F-Stats-1 Fix Plan v1.2 §9 Decision #9 (2026-05-15) named "strategy for the local-tooling identity drift" as a required F-Deploy-1 keystone scope item. The drift: despite global `git config user.email` correction to `evonifoster@yahoo.com`, commits from local tooling continued to attribute to `TySteamTest` until explicit per-commit `--author` flags were applied.

**Status check owed:** None of F-Deploy-1 Fix Plan v1.0 / v1.1 / v1.2 / v1.3 names this as a fix item. None of the soak observables monitor for it. The end-of-session note doesn't flag it. Either:

1. **Self-resolved.** The per-commit `--author` workaround is now applied consistently and recent commits are attributing correctly. Decision #9 requirement met implicitly.
2. **Latent.** The underlying wrapper/environment-variable issue still exists but the workaround has been masking it. Removing the workaround (or working from a fresh shell) would surface the drift again.
3. **Forgotten.** The Decision #9 requirement was simply not carried forward into F-Deploy-1 Fix Plan v1.0-v1.3. No status-determination has been done.

**Verification action owed:** Spot-check recent commit attributions on a non-`--author`-flagged commit. If attribution is correct, Decision #9 requirement is met (option 1). If `TySteamTest` reappears, drift is still active (option 2).

**Suggested verification command:**

```powershell
# Make a trivial test commit without --author flag, then check attribution
git log --pretty="%h %ae %an" -1
```

If `%ae` shows `evonifoster@yahoo.com` and `%an` shows the correct name, the drift has resolved itself. If `%ae` shows the TySteamTest address, the drift is still latent and was being masked.

**Defer:** Verification can run during soak (read-only `git log` operations). Suggest running before F-AUTH-1 / F-Sec-3 execution kicks off — the identity-drift question is upstream of any work that involves commits or PRs, and resolving it cleanly closes a Decision #9 loose end.

**Resolution path:** Run verification command. Based on outcome:

- If self-resolved: file closure note in this PE entry, mark CLOSED 2026-05-21 (or later verification date). Decision #9 requirement met via per-commit `--author` workaround becoming standard practice.
- If latent: escalate to P1, file as F-Deploy-1 Fix Plan v2.0 (Phase B G1) scope or as standalone F-Tools-1 keystone.
- If forgotten: file v11-authoring item to call out Decision #9's identity-drift requirement as unaddressed in F-Deploy-1 v1.0-v1.3.

---

**2026-05-21 closure note — RESOLVED with caveats:**

Verification executed 2026-05-21 ~14:50 UTC via `git log --pretty="%h %ae %an" -10`. Output: all 10 most recent commits on main show `evonifoster@yahoo.com angelcreator113` attribution. No `TySteamTest` artifacts in the last 10 commits.

**Caveat — what this verification actually tested:** The 10 commits inspected are all PR-merged commits landed via GitHub's squash-merge UI. Squash-merge applies the PR author's GitHub-account identity (`evonifoster@yahoo.com` / `angelcreator113`) to the resulting commit on main, regardless of what local Git config was used on the original branch commits. The verification therefore confirms "no TySteamTest attribution reaching main" but does NOT confirm "local-tooling identity drift has self-resolved."

**Effective resolution shape:** The squash-merge workflow is itself a compensating control. Even if local-tooling drift remains latent on `claude/**` branches before squash, the squashed commits landing on main are guaranteed to attribute to the GitHub-account identity. Main's audit history is clean by workflow design, independent of local-tooling state.

**Status: CLOSED with caveats 2026-05-21.** PE #58 closes on the basis that the audit-relevant surface (main branch attribution) is clean. The narrower "local-tooling identity drift on pre-squash commits" question is not resolved by this verification but is also not audit-relevant given the squash-merge workflow.

**Future-revisit conditions:** PE #58 should re-open if:

- GitHub squash-merge workflow is replaced with merge-commit or rebase-merge workflow (would expose pre-squash committer attribution on main).
- A non-squash-merge commit lands on main from local tooling (would surface latent local-tooling drift).
- Multiple contributors join the repo (other contributors' local-tooling drift could surface in PR identity attribution at the PR creation step, not just commit attribution).

**Decision #9 status:** Decision #9 named "strategy for the local-tooling identity drift" as required F-Deploy-1 scope. The strategy in practice is: rely on squash-merge to flatten local-tooling attribution before commits reach main. This is documented retroactively here, not in F-Deploy-1 Fix Plan v1.0-v1.3. v11 should note the implicit strategy explicitly so future-Claude reading Decision #9 understands the requirement is met via workflow design, not via direct local-tooling remediation.

---

**2026-05-22 reopening amendment — closure invalidated by new evidence:**

The 2026-05-21 closure was based on a narrow 10-commit `git log` sample which all attributed to `evonifoster@yahoo.com angelcreator113`. The closure framing claimed this was the squash-merge workflow flattening local-tooling drift. Both claims were wrong.

**Reopening trigger:** Finding 2 of the 2026-05-22 soak day 3 F-Stats-1 Phase B G1 re-read verified that commit `d0a36c6b` (referenced in §10 Rule 6 of the planning doc) exists on main. The commit is authored by `TySteamTest`. This contradicted PE #58's closure framing — squash-merge workflow had supposedly masked all `TySteamTest` attribution on main.

**Full-history search:** `git log origin/main --author="TySteamTest"` surfaced at least 22 commits on main between 2026-05-06 and 2026-05-14, all attributed to `TySteamTest`. The list includes:

- All F-AUTH-1 fix plan v2.23 through v2.37 documentation commits (~15 commits)
- F-AUTH-1 backup-branch merge commits (2 commits)
- F-Stats-1 Phase A G1 audit + Fix Plan v1.0 / v1.1 / v1.2 commits
- F-App-1 G1 environment audit + Fix Plan v1.0 / v1.1 commits
- F-Stats-1 §12.19 deploy incident + Decision #8 commit
- The `d0a36c6b` auto-merge-to-dev exclusion commit itself
- Session PE Roster creation commit (`2283fdd6`)

All on main. All squash-merge artifacts or merge commits (judged by commit-message format). All carrying `TySteamTest` attribution despite the squash-merge workflow.

**Conclusion 1: Squash-merge does NOT flatten local-tooling identity drift.** PE #58's closure framing was incorrect. Many `TySteamTest` commits on main are squash-merge artifacts, so squash-merge isn't the compensating control. The compensating-control closure type in v11 §3.3.5 should not cite PE #58 as a canonical example — that example was based on misattributed mechanism.

**Conclusion 2: Some other mechanism fixed the drift between 2026-05-14 and 2026-05-15.** Commits before approximately 2026-05-14 evening carry `TySteamTest` attribution; commits from 2026-05-15 onward carry `evonifoster@yahoo.com angelcreator113`. Approximate transition timing coincides with `auto-merge.yml` deletion (commit `1b3a02b3` on 2026-05-15) and the F-Deploy-1 fix-cycle work beginning. The actual fix mechanism is unknown — needs investigation.

**Revised status:** REOPENED. Investigation owed:

1. Identify the exact transition commit on main (last `TySteamTest` commit + first `evonifoster@yahoo.com` commit) to bound the change window.
2. Investigate what changed in that window: was it the `auto-merge.yml` deletion? An unrelated GitHub Apps configuration change? A wrapper-layer removal? A `.gitconfig` edit?
3. Document the actual compensating control once identified.

**Severity unchanged: P2.** The drift is now contained to historical commits — current main commits attribute correctly. Not a live defect. But the underlying fix mechanism is undocumented and PE #58's closure framing was wrong, which is worth correcting.

**Historical implication for audit decision-log integrity:** Many decisions in F-AUTH-1 v2.23-v2.37, F-Stats-1 v1.0-v1.2, and F-App-1 v1.0-v1.1 were committed under `TySteamTest` attribution. The *content* of those decisions is correct (JAWIHP authored them); the *commit-author* attribution does not match. This is documented as a separate finding in PE #60 (filed same day).

**Investigation commands queued for post-soak-close** (or soak day 4 if appetite permits — both are read-only):

```powershell
# Find the transition commit
git log origin/main --pretty="%h %ad %ae %an" --date=short --since=2026-05-14 --until=2026-05-16 | Select-String -Pattern "TySteamTest|evonifoster"

# Inspect what changed at the transition window
git log origin/main --pretty="%h %s" --date=short --since=2026-05-14 --until=2026-05-16
```

**v11 §3.3.5 correction owed:** v11 §3.3.5 (compensating-control closure type, drafted yesterday) cites PE #58 as a canonical example with squash-merge as the compensating mechanism. Both citations are wrong. v11 §3.3.5 should be amended at v11 author session to either (a) cite a different canonical example for compensating-control closure or (b) cite PE #58 with corrected mechanism once the actual fix is identified per investigation above.

---

**2026-05-22 second amendment — investigation complete, mechanism identified, finding re-closed with corrected framing:**

Investigation per the post-reopening resolution path (see queued commands at end of reopening amendment above) executed 2026-05-22 afternoon. Results overturn both the original closure framing (squash-merge masks drift) AND the reopening framing (drift mechanism unknown).

**Investigation outputs:**

1. `git log` window 2026-05-13 through 2026-05-17 surfaced 30 commits with attribution patterns interleaved across three identities, not two:
   - `evonifoster@yahoo.com angelcreator113` (correct, mostly merge commits)
   - `evonifoster@yahoo.com Evoni` (correct, name field variation)
   - `130309211+TySteamTest@users.noreply.github.com TySteamTest` (the "drift" identity)
   - `noreply@anthropic.com Claude` (Claude Code attribution, e.g. commit `6bfd99e2`)
2. `git config --show-origin user.email` returned `file:C:/Users/12483/.gitconfig  evonifoster@yahoo.com` — local global config is correct. No `TySteamTest` anywhere in local git environment.
3. Commit-message scan of the transition window: `TySteamTest` attribution appears exclusively on **squash-merge artifacts** (e.g., `2283fdd6`, `d0a36c6b`, `aee8c219`, etc.). Merge-commit artifacts (e.g., `0e8ed9e4`, `67c3a8ea`) attribute correctly to JAWIHP's GitHub identity.

**Mechanism identification:** The "TySteamTest" identity is **a GitHub App**, not a local-tooling drift artifact. Email format `130309211+TySteamTest@users.noreply.github.com` matches GitHub's bot/App email pattern (numeric ID + name + `users.noreply.github.com`). The pre-2026-05-15 squash-merge artifacts on main were performed by this App via an automated workflow (the `auto-merge.yml` workflow that was deleted on 2026-05-15 in commit `1b3a02b3`). GitHub attributes workflow-performed squash-merges to the workflow's authentication identity (the App), not to the human PR author.

**Connection to PE #59:** This GitHub App is almost certainly the same one referenced via `secrets.APP_ID` + `secrets.APP_PRIVATE_KEY` in `.github/workflows/auto-merge-to-dev.yml` (current workflow, filed 2026-05-22 morning as PE #59). The `auto-merge.yml` workflow (deleted 2026-05-15) used the same or related App for pre-2026-05-15 squash-merges to main; the `auto-merge-to-dev.yml` workflow (current) uses the App for `dev`-branch squash-merges. Same App identity (`TySteamTest`), different workflow targets. PE #59's web-UI App identity inventory (owed post-soak-close) will confirm by enumerating Apps installed on the repo and matching one to the `TySteamTest` display name.

**The 2026-05-15 transition explained:** When `auto-merge.yml` was deleted (commit `1b3a02b3`), the workflow that was performing automated squash-merges to main stopped. After that point, squash-merges to main happen through different paths (manual squash-merge by JAWIHP via GitHub UI, or other workflow paths that don't use the App token). The App's identity stopped appearing on main because the workflow that surfaced it was gone. Not a fix to local tooling; a removal of the workflow that was producing the surfacing.

**Corrected severity: P2 unchanged, but for different reason.** Originally P2 because "status verification owed." Now P2 because the "drift" was never actually drift — it was expected GitHub App attribution on workflow-performed squash-merges. The historical commits with `TySteamTest` attribution are accurate records of which entity (the App) performed the squash-merge action. The audit-content authorship (JAWIHP authored the PRs that the App squash-merged) is documented elsewhere via the PR descriptions and the underlying branch commits.

**Status: CLOSED 2026-05-22 with corrected mechanism.** The investigation produced a real answer; the "drift" framing was wrong from start to finish; the actual mechanism is well-understood GitHub workflow attribution behavior. PE #58 closes for the third (and final) time with this understanding.

**v11 implications:**

- v11 §3.5 (which currently references PE #57 / #58 / #60 as Decision #9 reconciliation items) needs amendment to reflect that "local-tooling identity drift" was a misframing. Decision #9's "strategy for the local-tooling identity drift" requirement is met by understanding that there was no local-tooling drift — there was GitHub App attribution on automated workflow squash-merges, which is expected behavior. The requirement reduces to: document that the App identity will appear on workflow-performed actions, not the human's identity.
- v11 §3.3.5 (compensating-control closure type) should NOT cite PE #58 as a canonical example. The "compensating control" framing was an artifact of misreading the mechanism. The two remaining examples in F-Tools-1 §4.3 (`enforce_admins=false` + admin discipline; `required_approving_review_count=0` + status checks) are still valid compensating-control closures.
- PE #60 (audit history attribution drift) needs amendment — the ~22+ `TySteamTest` commits on main are not "drift," they are GitHub App squash-merge artifacts performed by an automated workflow. The historical-record framing holds, but the explanation shifts.

**Cross-references corrected:**

- F-Tools-1 §3.4.1 — amendment owed (this section, mechanism identified, no longer about local-tooling drift)
- F-Tools-1 §4.3 — amendment owed (PE #58 should be removed from compensating-control examples)
- PE #59 — same GitHub App; PE #58 closure cross-references PE #59's pending web-UI App inventory
- PE #60 — explanation amendment owed (App squash-merges, not drift)

**Methodological note — three iterations on the same finding in 30 hours:** PE #58 was filed 2026-05-21, closed 2026-05-21 (wrong mechanism: squash-merge as compensating control), reopened 2026-05-22 (wrong framing: drift exists with unknown fix mechanism), and now re-closed 2026-05-22 with the actual mechanism. This is *not* the pattern v11 §3.3 closure-semantic vocabulary anticipates — it's a sequence of evidence-state revisions, each correcting the prior. The methodological discipline that produced the correct answer: running progressively wider verification (the 10-commit window → the full-history search → the transition-window read + local config check). Each verification surfaced new evidence that invalidated the prior framing. The pattern is healthy when caught quickly; the cost is reader confusion when amendments stack. v11 §3.3 vocabulary should probably name this pattern explicitly: **iterative correction** as a discipline shape, distinct from evidence-state-revision (which is one correction, not a sequence).

---

*(none yet — first close will document resolution date and brief
summary here when an OPEN finding closes)*

---

### PE #59 — auto-merge-to-dev.yml uses GitHub App token, App identity + permissions not in audit history (P2, OPEN, NEW 2026-05-22)

**Date filed:** 2026-05-22 (soak day 3, surfaced during F-Tools-1 §3.3.4 / §3.5.4 follow-up investigation)
**Severity:** P2 (informational; baseline establishment for the workflow-token + GitHub-App surface; not a defect)
**Status:** OPEN

`.github/workflows/auto-merge-to-dev.yml` uses a GitHub App token (via `actions/create-github-app-token@v1`) for the merge + push operations rather than the default `GITHUB_TOKEN`. The workflow generates the token at runtime from `secrets.APP_ID` + `secrets.APP_PRIVATE_KEY` and uses it for the dev push.

**Why the workflow uses a GitHub App token:** Documented inline in the workflow file via comment — `# GITHUB_TOKEN pushes do NOT trigger other workflows (GitHub security rule).` The auto-merge-to-dev push must trigger `deploy-dev.yml` downstream, which is a GitHub-enforced security restriction that bare `GITHUB_TOKEN` pushes cannot do. The GitHub App token bypasses this restriction legitimately.

**What this finding establishes (baseline):**

- The repo has at least one GitHub App with permissions sufficient to merge PRs and push to `dev`. Specific permissions not visible from this audit's vantage point (would require web-UI Settings → Integrations → GitHub Apps to inventory).
- `secrets.APP_ID` and `secrets.APP_PRIVATE_KEY` are stored in the repo secrets vault. The secret pair together provides authentication to the GitHub App's permission surface.
- The App-token mechanism is deliberate, documented in the workflow code itself, and uses standard tooling (`actions/create-github-app-token@v1` is a Microsoft-published action).
- The App is itself a PR-capable tool in the F-Tools-1 §3.5 framing — distinct from VS Code extensions, Copilot Workspace, Claude Code, etc.

**What this finding does NOT establish:**

- The App's identity (which GitHub App is this?) — not visible from the workflow file or from `gh api` commands available in this auth context.
- The App's full permission surface (PR write, contents write, actions, etc. — only inferable from the merge + push operations actually performed).
- Whether the App is installed only on this repo or on other repos under the same account/org.
- Whether the App's private key is rotated regularly or is a long-lived static key.

**Workflow permissions context (baseline):**

The 2026-05-22 enumeration via `gh api .../actions/permissions/workflow` returned:

```json
{
  "default_workflow_permissions": "read",
  "can_approve_pull_request_reviews": false
}
```

Three of four workflow files (`deploy-dev.yml`, `deploy-production.yml`, `validate.yml`) declare explicit `contents: read` permissions. `auto-merge-to-dev.yml` has no explicit `permissions:` block and uses the repo-wide default (also `read`). The merge + push capability comes entirely from the GitHub App token, not from `GITHUB_TOKEN`.

This means: removing the App credentials from secrets, or revoking the App's installation on this repo, would break `auto-merge-to-dev.yml` but would not affect the three deploy/validate workflows. The blast radius of any App-related changes is bounded to the auto-merge path.

**Cross-references:**

- F-Tools-1 Tooling Environment Audit §3.3.4 (workflow permissions — partial close via this finding)
- F-Tools-1 Tooling Environment Audit §3.5.4 (other PR-capable tools — partial close via this finding)
- F-Deploy-1 Fix Plan v1.3 §4 (FD-22 F-Deploy-G1-Y closure — the App-token mechanism here is a *different* PR-capable surface from the loki-class extensions that F-Deploy-G1-Y investigated; not causally linked)

**Defer:** No action owed in the soak window. App identity + permission inventory is web-UI work, not gh-CLI-accessible, and not soak-safe to perform during G4 soak. Triage post-soak-close.

**Resolution path:**

1. Post-soak-close, navigate GitHub web UI: `Settings → Integrations → GitHub Apps` on the repo.
2. Identify which GitHub App has access (likely a single named App given the single secrets pair).
3. Document App identity + granted permissions in F-Tools-1 audit §3.5.4 as a full close.
4. Verify App private key rotation policy. If key is long-lived, file follow-up PE for rotation hygiene.
5. Verify App installation scope (this repo only, or broader).

**Methodological note:** This finding is the kind that an audit baseline survey is designed to surface. F-Tools-1 §3.5.4 explicitly flagged "other PR-capable tools" as not-yet-investigated; the 2026-05-22 follow-up surfaced one specific example. Future-revisit conditions per F-Tools-1 §6.3 include "F-Deploy-G1-Y recurrence" — if recurrence happens, this App is on the candidate list.

---

### PE #60 — Audit history attribution drift: ~22+ main commits attributed to TySteamTest, 2026-05-06 through 2026-05-14 (P2, OPEN, NEW 2026-05-22)

**Date filed:** 2026-05-22 (soak day 3, surfaced via PE #58 reopening investigation)
**Severity:** P2 (historical-record finding; not a live defect; documents that audit decision-log attribution does not match decision authorship for ~22+ commits on main)
**Status:** OPEN

A full main-history search via `git log --author="TySteamTest"` on 2026-05-22 surfaced at least 22 commits on main attributed to `TySteamTest` (130309211+TySteamTest@users.noreply.github.com), spanning 2026-05-06 through 2026-05-14. The commits include all of the following decision-log-bearing artifacts:

- F-AUTH-1 Fix Plan v2.23 through v2.37 (the multi-week F-AUTH-1 closure sequence, ~15 commits including Step 3 CP1 through CP10 + keystone closure at v2.37)
- F-Stats-1 Phase A G1 Audit + Fix Plan v1.0 / v1.1 / v1.2
- F-App-1 G1 environment audit + Fix Plan v1.0 / v1.1
- F-Stats-1 §12.19 deploy incident + Decision #8 commit
- The `d0a36c6b` auto-merge-to-dev exclusion commit (referenced in F-Stats-1 v1.2 §10 Rule 6)
- Session PE Roster creation commit (`2283fdd6`)
- F-AUTH-1 backup-branch merge commits

**Author identity gap:** All these commits were authored by JAWIHP / Evoni (the sole human contributor); the `TySteamTest` attribution came from a local-tooling drift mechanism that PE #58 has been tracking. The *content* of every decision and audit document is correct — the *commit-author* attribution does not match.

**Why this is a separate finding from PE #58:** PE #58 is about the drift mechanism itself (what's producing TySteamTest attribution, what fixed it around 2026-05-14/15). PE #60 is about the *historical artifact* — the audit decision-log has ~22+ commits whose author attribution doesn't match decision authorship, regardless of what fixed the underlying drift.

**Impact:** None at the audit-content level. JAWIHP authored every decision; the commits accurately reflect those decisions; the `TySteamTest` attribution is a tooling artifact, not a content artifact. But for audit-trail forensics (e.g., "who authored Decision #8?"), the git history's author field is misleading. Any future audit-history review needs to know that pre-2026-05-15 author attribution on main is unreliable.

**Cross-references:**

- PE #58 — drift mechanism investigation (reopened 2026-05-22)
- F-Tools-1 audit §3.4.1 — local-tooling identity drift (reopened 2026-05-22)
- F-Tools-1 audit §3.4.2 — `.gitconfig` scope hierarchy investigation (relevant to identifying the original drift source)
- F-Tools-1 audit §3.4.3 — env-var wrapper layers (relevant to same)

**Resolution path:**

1. **Documentation-only resolution recommended.** v11 audit handoff (target 2026-05-26 post-soak-close) should note that pre-2026-05-15 main-branch author attribution is unreliable and should not be used as evidence of authorship. The decision-log content remains authoritative.
2. **No git history rewriting.** Rewriting historical author attribution on main is destructive (rewrites every downstream SHA, invalidates all branch references, breaks any external links). The cost is far higher than the benefit; PE #60 is informational, not actionable in the destructive sense.
3. **Future audit-trail forensics queries** should use commit message content + decision-log cross-references to identify authorship, not git author field, for pre-2026-05-15 commits.

**Defer:** Documentation in v11 sufficient. No code or pipeline action owed.

**Methodological note:** PE #60 is a *baseline-correction* finding — it doesn't introduce new work, it documents what's true about existing work so future-Claude doesn't draw wrong conclusions. Same shape as PE #53 (v10 staleness on F-App-1 status) — informational, P2, resolves via v11 authoring.

---

**2026-05-22 second amendment — corrected mechanism, framing shift:**

PE #58's third closure (2026-05-22 afternoon, see PE #58 second amendment) identified the actual mechanism behind the `TySteamTest` attribution: a **GitHub App** performing workflow-driven squash-merges, not local-tooling drift. This changes PE #60's framing in two ways:

**1. Framing shift: "drift" → "App attribution."** The ~22+ `TySteamTest` commits on main are not "drift artifacts." They are **GitHub App squash-merge artifacts** — commits that GitHub attributed to the App's identity because the App (via the `auto-merge.yml` workflow, deleted 2026-05-15) performed the squash-merge action. The App is the same one referenced in PE #59 via `secrets.APP_ID` + `secrets.APP_PRIVATE_KEY` in the current `auto-merge-to-dev.yml` workflow.

**2. Audit-trail forensics framing strengthened, not weakened.** The original "pre-2026-05-15 main-branch author attribution is unreliable" framing was correct but imprecise. The corrected framing: **pre-2026-05-15 main-branch author attribution reflects which entity (App vs. human) performed the squash-merge, not which human authored the underlying PR.** For audit-trail forensics, this is actually *more useful* than treating the attribution as drift — it tells you which path the commit took to main:

- `TySteamTest` author → squash-merged by the auto-merge workflow → underlying PR was approved by automation
- `evonifoster@yahoo.com angelcreator113` author → squash-merged by Evoni via GitHub UI, or merge-commit performed by Evoni
- `noreply@anthropic.com Claude` author → direct commit by Claude Code (no PR / no squash-merge)

Three distinct path signals, not one drift signal.

**Resolution path corrected:**

1. **Documentation-only resolution still recommended.** v11 audit handoff should document the three-attribution-path pattern for pre-2026-05-15 main commits, not the original "drift" framing. Audit decision-log content remains authoritative; the App attribution on squash-merges is expected behavior, not defect.
2. **No git history rewriting** (unchanged from original framing).
3. **Future audit-trail forensics queries** should treat author field as a path-signal indicator, not as authorship evidence. For decision-authorship queries, read PR descriptions or commit message bodies.

**Cross-references corrected:**

- PE #58 (re-closed 2026-05-22 afternoon with corrected mechanism) — the App, not local-tooling drift, is the source.
- PE #59 — same App. PE #59's post-soak-close web-UI App inventory will confirm the App's identity matches `TySteamTest`.
- F-Tools-1 §3.4.1 / §4.3 amendments owed to reflect corrected mechanism.

**Severity unchanged: P2.** Documentation-only resolution. The corrected framing is *better* than the original "drift" framing — it explains what the attribution actually means rather than treating it as an anomaly.

---

### PE #61 — F-Deploy-1 Fix Plan v1.0 §4.5 pre-flight read of deploy-production.sh status unknown (P2, OPEN, NEW 2026-05-22)

**Date filed:** 2026-05-22 (soak day 3, surfaced during F-Deploy-1 v1.0 base plan read)
**Severity:** P2 (documentation gap; live consequence is "Phase B PR sequence cannot be finalized without re-running the read" — but no immediate Phase B work is happening; gap will surface when Phase B G1 is authored post-soak-close)
**Status:** OPEN

F-Deploy-1 Fix Plan v1.0 §4.5 specifies a pre-flight read of `.github/scripts/deploy-production.sh` as Gate A-G1 work. The read resolves F-Deploy-G1-T (deferred during G1 audit) and shapes Phase B G5's PR sequence: whether PR B-7 (deploy-production.sh `--env production` fix) is needed at all depends on what the read found.

**Disposition table from v1.0 §4.5:**

| Script behavior found | F-Deploy-G1-T resolution | Phase B §6.7 impact |
|---|---|---|
| Script passes `--env production` to `pm2 start` | T resolved as "prod-side mechanism is safe; F-Deploy-G1-H is dev-side only" | §6.7 narrows: only ecosystem.config.js default-port question |
| Script omits `--env production` or passes wrong env | T resolved as "prod-side mechanism also vulnerable; F-Deploy-G1-H is bilateral" | §6.7 expands: deploy-production.sh edit required as Phase B PR B-7 |
| Script behavior is conditional or unclear | T resolved as "requires careful Phase B G1 architectural decision before fix" | §6.1 architectural decision must address |

**Gap identified:** v1.1 (Gate A-G1 closure, 2026-05-16, PR #703), v1.2 (Phase A G2 progress, A-1b ship, 2026-05-17, PR #706), and v1.3 (Phase A G2 closure, 2026-05-19, PR #710) — none document the §4.5 pre-flight outcome. Either:

- **(a) The read was performed and the outcome wasn't documented** in any v1.x revision. The disposition lives somewhere outside the Fix Plan revisions (chat history, locally-only, lost). Phase B G5 sequence depends on knowing which row of the disposition table fires.
- **(b) The read was skipped silently when Gate A-G1 closed.** v1.1 §1.4 / §2 close Gate A-G1 with a "session walk" approach; possibly §4.5 was treated as deferred to Phase B rather than completed at pre-flight. If so, the deferral itself is undocumented and Phase B G5 sequence is unsettled.

**Why this matters:**

- v1.0 §6.7 says "Pre-flight read happens before Phase A. The action item is: if §4.5 read found `--env production` correctly passed: no Phase B work item. If missing or wrong: add the flag in deploy-production.sh, ships as PR B-7." Without knowing the read outcome, the PR sequence cannot be finalized.
- v1.0 §6.8 lists PR B-7 as "conditional on §4.5 outcome." That conditional is still open.
- v1.0 §11 Decisions section says "Decisions surfaced during §4 pre-flight (drift handling, F-Deploy-G1-T resolution outcome)" should be added during execution. None are present in v1.1/v1.2/v1.3.

**Cross-references:**

- F-Deploy-1 Fix Plan v1.0 §4.5 (pre-flight requirement)
- F-Deploy-1 Fix Plan v1.0 §6.7 (Phase B G5 work depending on outcome)
- F-Deploy-1 Fix Plan v1.0 §11 Decisions FD-8 (architectural decision input)
- F-Deploy-1 G1 Audit §3.4.5 (F-Deploy-G1-T deferral)

**Resolution path:**

1. **Pre-soak-close (now-2026-05-26):** Read `.github/scripts/deploy-production.sh` directly. This is a read-only operation on a committed file — soak-safe. Run `Get-Content .github/scripts/deploy-production.sh | Select-String -Pattern 'pm2 start|--env'`.
2. **Post-soak-close at v11 author session:** Document the read outcome explicitly in v11 (or in a Fix Plan v1.4 revision that closes the §4.5 gap retroactively). Update Phase B G5 PR sequence based on outcome.
3. **Or:** If the read happened and is documented somewhere (e.g., committed in a script comment, captured in a session resume doc), surface that reference and cross-link.

**Investigation command (run when convenient, no urgency before soak-close):**

```powershell
Get-Content .github/scripts/deploy-production.sh | Select-String -Pattern "pm2 start|--env" -Context 2,2
```

**Defer:** Yes. Phase B doesn't start until post-soak-close anyway. Filed now so it's surfaced for v11 author session.

**Methodological note:** This finding is the kind that a Fix Plan v1.0 re-read is designed to surface — a pre-flight commitment that may have slipped through Gate A-G1 closure without being closed itself. Similar to PE #56 / PE #57 (Decision-vs-shipped-state drift), but operating one layer up: Fix-Plan-§4-vs-execution drift. Worth naming explicitly as a discipline pattern at v11: **pre-flight gate items can slip through gate closure if the gate is closed by "session walk" without explicit item-by-item verification.**

---

## Closed findings

Closed entries remain in the chronological PE sequence above with their CLOSED status marked in the header and closure note appended. The list below indexes closures by PE number for quick scanning.

- **PE #37** — DB_NAME=postgres mismatch on prod EC2 .env (RESOLVED 2026-05-12, mid-session correction)
- **PE #41** — aiRateLimiter.js IPv6 key generation boot-blocking (RESOLVED 2026-05-15, PR #694)
- **PE #48** — Dev migration missing `version` column (RESOLVED 2026-05-15, PR #694)
- **PE #58** — Local-tooling identity drift status unknown — original CLOSED 2026-05-21 (wrong mechanism), REOPENED 2026-05-22 morning (wrong framing), **re-CLOSED 2026-05-22 afternoon with corrected mechanism** — was never local-tooling drift; actual mechanism is GitHub App attribution on workflow-performed squash-merges. See PE #58 entry in Active findings for full investigation outcome.

---

## Provenance and maintenance

- **Created:** 2026-05-14, end of F-Stats-1 G6 soak verification
  session
- **Initial author:** Evoni (JAWIHP)
- **Initial drafter:** Claude (per session collaboration)
- **Source for PE #27, #31, #37, #38, #39:**
  `Prime_Studios_Session_Resume_2026-05-12.docx` (external to repo as
  of file creation)
- **Source for PE #40, #41, #42:** F-Stats-1 G6 soak log inspection,
  2026-05-14
- **Source for PE #43 amendment, PE #50, #51, #52, #53, #54:** 2026-05-20 session work during F-Deploy-1 Phase A G4 soak day 1. PE #50 from external AWS infrastructure observation. PE #51, #52 from F-AUTH-1 §5.1 pre-flight grep preparation. PE #53 from v11 session brief outline drafting. PE #43 amendment + PE #54 from soak day 1 observable check 2026-05-20 09:31:57 UTC.
- **Source for PE #51 / PE #52 / PE #55 verification amendments:** 2026-05-21 session work during F-Deploy-1 Phase A G4 soak day 2. F-AUTH-1 §5.1 pre-flight grep script (`docs/audit/f-auth-1_preflight_grep.ps1`) executed against current repository state, surfacing original-inventory errors documented in PE #51 verification amendment and PE #52 verification amendment. PE #55 filed as sibling inventory to PE #51 capturing the read-surface `optionalAuth` usages discovered during verification.
- **Source for PE #56, #57, #58:** 2026-05-21 session work during F-Deploy-1 Phase A G4 soak day 2. F-Stats-1 Fix Plan v1.2 Decision #9 read surfaced three drift findings between Decision #9 (2026-05-15) and current state (2026-05-21): gate-strictness drift vs v10 Decision #98 revised (PE #56), enforce_admins=false vs Decision #9 admin-enforcement requirement (PE #57), and unaddressed local-tooling identity drift requirement (PE #58). PE #57 amended 2026-05-21 afternoon during soak day 2 observable sweep — `required_approving_review_count=0` surfaced as sibling finding to `enforce_admins=false`, both indicating Decision #9 vs shipped-state gap. PE #57 amended again 2026-05-21 late-afternoon during `enforce_admins` decision-archaeology pass: documentary evidence in F-Deploy-1 Fix Plan v1.0/v1.1/v1.3 + G1 Audit established that `enforce_admins=false` is a deliberate FD-5 design choice with extensive rationale; the drift PE #57 originally flagged is between Decision #9's generic phrasing and FD-5's specific scope, not between Fix Plan and shipped state. Severity reclassified P1→P2 (documentation reconciliation, not live defect). PE #58 closed 2026-05-21 late-afternoon via `git log` verification — 10 most recent commits on main attribute to `evonifoster@yahoo.com angelcreator113` (squash-merge identity), no `TySteamTest` artifacts. Squash-merge workflow effectively masks any latent local-tooling drift before commits reach main; audit-relevant surface clean.

- **Source for PE #59:** 2026-05-22 session work during F-Deploy-1 Phase A G4 soak day 3. F-Tools-1 §3.3.4 / §3.5.4 follow-up investigation via `gh api .../actions/permissions/workflow` + grep of `.github/workflows/auto-merge-to-dev.yml` for permissions/token/secrets references. Surfaced that the workflow uses a GitHub App token (via `actions/create-github-app-token@v1`) for merge + push operations, with explicit inline comment documenting the rationale (GITHUB_TOKEN pushes cannot trigger downstream workflows per GitHub security rule). App identity + permissions not visible from gh-CLI vantage point; web-UI inventory owed post-soak-close.

- **Source for PE #58 reopening + PE #60:** 2026-05-22 session work during F-Deploy-1 Phase A G4 soak day 3, F-Stats-1 Phase B G1 re-read Finding 2 verification (commit `d0a36c6b` in §10 Rule 6 reference). Verification surfaced that `d0a36c6b` is on main with `TySteamTest` author attribution. Full-history search via `git log origin/main --author="TySteamTest"` surfaced ~22+ similarly-attributed commits on main 2026-05-06 through 2026-05-14, invalidating PE #58's 2026-05-21 closure framing (squash-merge as compensating control). PE #58 reopened; PE #60 filed as separate finding documenting the audit-history attribution gap as a historical artifact, distinct from the drift mechanism question. F-Tools-1 audit §3.4.1 and §4.3 amended to reflect the corrected understanding.

- **Source for PE #58 third closure + PE #60 second amendment:** 2026-05-22 afternoon session work during F-Deploy-1 Phase A G4 soak day 3. Investigation commands (`git log origin/main --pretty=...` 2026-05-13 to 2026-05-17 window + `git config --show-origin user.email`) surfaced that the "TySteamTest" identity is a GitHub App, not local-tooling drift. The 2026-05-15 transition coincides with `auto-merge.yml` deletion (commit `1b3a02b3`); pre-2026-05-15 squash-merge artifacts on main attribute to the App because the deleted workflow performed automated squash-merges using the App token. PE #58 re-closed with corrected mechanism (third closure attempt within 30 hours). PE #60 second amendment shifts framing from "drift" to "App attribution path signal." F-Tools-1 §3.4.1 closure narrative updated; §3.4.2 / §3.4.3 closed by §3.4.1 closure; §4.3 sharpened with discipline test for distinguishing compensating-control closure from miscategorized phenomenon.

- **Source for PE #61 + PE #57 third amendment:** 2026-05-22 session work during F-Deploy-1 Phase A G4 soak day 3, h2 track (F-Deploy-1 Fix Plan v1.0 base plan read). PE #61 surfaced via §4.5 pre-flight read of `.github/scripts/deploy-production.sh` — Fix Plan v1.0 committed the read as pre-flight work, no v1.1/v1.2/v1.3 revision documents the outcome. PE #57 third amendment surfaced via FD-5 specification of `required_status_checks: [Validate]` (single context) vs shipped state of three contexts (`Cost Exposure Audit`, `Tests`, `Route Validation`) — third dimension of the same Decision #9 vs FD-5 vs shipped-state cluster, joining `enforce_admins=false` and `required_approving_review_count=0` dimensions documented in prior amendments. All three dimensions resolve via v11 authoring; no shipped-state change needed.

**Future maintenance:**

- New session-level findings: append to "Active findings" with next
  sequential PE number.
- When a finding closes: move entry from "Active" to "Closed,"
  document resolution date and one-line summary.
- Severity changes: update in place with a parenthetical note
  recording the change date.
- Verification amendments: append below original entry with `⚠️ VERIFICATION AMENDMENT` heading. Preserve original entry for evidence-state continuity per v11 §3.3 closure-semantic vocabulary. PE #51 and PE #52 entries demonstrate the pattern.


### PE #62 — Pattern 40 §12.11 residue is unowned: no keystone or follow-up plan tracks surviving schema-as-JS sites (P2, OPEN, NEW 2026-07-14)

**Finding.** F-App-1 G1 Audit §12.11 (2026-05-14) cataloged Pattern 40
instances outside F-App-1 scope and recorded "Follow-up plan recommended."
As of 2026-07-14 (main `9f3986f4`), no follow-up plan exists and no
keystone owns the sites. Ownership was declined twice, explicitly:

- F-App-1 Fix Plan v1 (Drift Inventory): type reconciliation "belongs in
  a follow-up plan addressing F-Stats-1 / the broader Pattern 40
  retirement" — deferred outward.
- F-Stats-1 Fix Plan v1.0 (scope): "Does NOT address §12.11 Pattern 40
  sites for other tables" — declined inward.

No queued keystone absorbs them: F-Ward-1 owns only `episode_wardrobe`;
F-Franchise-1 owns canon-as-JS constants, not runtime DDL. F-App-1's
formal closure retired Pattern 40 at its master instance only.

**Live enumeration (verified 2026-07-14 against origin/main `9f3986f4`,
positive-control grep per FD-51; independently re-verified same day in a
second session's review pass):**

Variant B — inline `CREATE TABLE IF NOT EXISTS` in request-path code,
5 sites / 3 tables:
- `src/controllers/videoCompositionController.js:35` — `video_compositions`
- `src/routes/admin.js:53` — `video_compositions` (second declaration of
  same table; two-file drift, two independent schema authors)
- `src/routes/storyHealth.js:244` and `:276` — `chapter_versions`
  (duplicate-within-file variant)
- `src/routes/worldStudio.js:319` — `ecosystem_previews`

Variant A — per §12.11 (not re-verified live this session): 11
`model.sync()` sites across 5 files, 7+ models (`StoryTaskArc`,
`ContinuityTimeline`, `ContinuityCharacter`, `ContinuityBeat`,
`ContinuityBeatCharacter`, `FranchiseKnowledge`, `GenerationJob`), plus
`src/models/index.js:1797` `sequelize.sync()` inside the model loader.
Variant A live re-verification owed at ownership time.

**Count delta, adjudicated closed (reads 2026-07-14):** the G1 Audit
Report's headline count ("six additional hits") conflicts with its own
itemization, which lists exactly five DDL sites — the same five, at the
same line numbers, present live at `9f3986f4` (files untouched since
audit). The sixth "hit" is best identified as
`videoCompositionController.js:33`, a comment line visible in the audit's
own grep transcript. The conflation minted inside the audit report
itself: its Steps 4–5 body counts "six additional hits across four
files," and its own §12.11 summary (line 514) hardens that to "6 Variant
B sites" — hits transcribed as sites between body and summary of the
same document. No Fix Plan carries the defect. Alternative explanation
investigated and excluded by pickaxe: an `episode_wardrobe` auto-create
in `src/routes/wardrobe.js` was added (`2da64649`) and removed
(`0ab7b04a`) the same day, 2026-02-19 — three months before the audit;
F-Ward-1 adjacency moot. No enumeration drift exists; the live count of
five is authoritative.

**Why it matters (P2, not P0):** unlike the retired boot-path master,
these fire lazily on route hits — they are live, current schema authors
in production code, drifting independently of the migration chain (the
exact mechanism behind the F-App-1 `career_goals` tier/is_active drift
and the `source` ENUM-vs-VARCHAR divergence). No incident attributed to
them to date. The hazard is silent divergence plus the double-declination
pattern itself: a recommendation with no owner does not execute.

**Resolution path:** ownership decision at a future register revision.
Candidate homes: (a) dedicated Pattern 40 retirement plan (F-Schema-1)
sequenced after current keystones; (b) explicit scope absorption into
F-Franchise-1 (weak fit — different pattern family); (c) explicit
accepted-risk disposition with periodic re-enumeration. Not a candidate
for silent absorption; the decision itself must be recorded.

**Namespace note:** distinct from F-AUTH-1 Fix Plan internal "Track 8 PE
candidates" (its PE #7–#14), which are a plan-local numbering.

**Discovery context:** surfaced during F-Deploy-1 §4.4 burn-in day 0
(read-only session, no gate contact). Session also confirmed F-App-1
formal status (shipped 2026-05-14, Decision #105, does not gate sequence)
against Handoff v11 + PE #53 — closing a records-staleness loop of
exactly the shape PE #53 predicted.