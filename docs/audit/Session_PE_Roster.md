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

## Closed findings

*(none yet — first close will document resolution date and brief
summary here when an OPEN finding closes)*

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

**Future maintenance:**

- New session-level findings: append to "Active findings" with next
  sequential PE number.
- When a finding closes: move entry from "Active" to "Closed,"
  document resolution date and one-line summary.
- Severity changes: update in place with a parenthetical note
  recording the change date.
