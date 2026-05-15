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

**Defer:** Out of F-Stats-1 scope. Filed for separate fix plan when
triaged. Investigation step 1: locate the Template Studio route file
and identify which Node API call receives `undefined`.

---

### PE #41 — aiRateLimiter.js IPv6 key generation degraded (P2, OPEN, NEW 2026-05-14)

**Date filed:** 2026-05-14 (surfaced during F-Stats-1 G6 soak
verification)
**Severity:** P2
**Status:** OPEN

At PM2 boot, `episode-api` logs:

```
ERR_ERL_KEY_GEN_IPV6
```

warning from `express-rate-limit` regarding `aiRateLimiter.js`.

**Cause:** `aiRateLimiter.js` uses the bare client IP as the
rate-limit key. `express-rate-limit` requires IPv6 keys to go through
the `ipKeyGenerator` helper to avoid keying on partial v6 addresses
(otherwise multiple addresses in the same /64 may collapse to one
bucket, or the limiter may fail-open).

**Impact:** IPv6 clients are not correctly rate-limited. IPv4 clients
are unaffected. App boots and runs normally. No restart risk; no
security implication at current traffic levels (Prime Studios is
single-user during pre-launch).

**Resolution path:** Update `aiRateLimiter.js` to import and use
`ipKeyGenerator` from `express-rate-limit`'s utility module. ~10 LOC
change. Add an IPv6 rate-limit test if test infrastructure supports
simulating IPv6 requests.

**Defer:** Future hardening pass; bundle with other rate-limit
hygiene. Not blocking any current fix plan.

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

**Defer:** Not blocking F-Stats-1 work. Should not stay open through
Phase B execution. Triage by EOW 2026-05-21.

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
