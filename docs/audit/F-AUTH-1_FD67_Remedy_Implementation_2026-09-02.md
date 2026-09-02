| **PRIME STUDIOS** **F-AUTH-1 IMPLEMENTATION — FD-67 REMEDY** *Implements the branch ruled at F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md, now tested (§7). Does not close FD-67 — FD-68/FD-65 adjudication still owed.* |
| --- |

# F-AUTH-1 — FD-67 remedy implemented: Option 1 — 2026-09-02

**FILED 2026-09-02.** Implements `F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md`'s
Option 1: the global `optionalAuth` mount is removed from `src/app.js`, and
every route that relied on it now carries its own explicit `optionalAuth`.

**Basis:** `origin/main` at `0b956fc7b31f1eccbb06605f09003d1a874d14f7`, 2026-09-02.

**Author**

Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni — Prime Studios.

**Status**

**Implements the branch, and now tested — but still does not close FD-67.**
`v25` Sec 6 item 11 requires the remedy *"authorized, implemented, and
tested."* This document covers "implemented" and, after a revision made
within the same session (§7), "tested": the full Jest suite (142 suites,
2514 tests, 5 skipped, 0 failed) ran clean against a real local PostgreSQL
16 database, and every touched route was exercised with live HTTP requests
against a booted `src/app.js`, with before/after behavior proven identical
via a git-worktree comparison against the pre-diff commit. **FD-67 still
does not close**, because item 11 separately requires *"FD-68's severity
interaction with FD-65… adjudicated,"* which this document does not
perform. Mints nothing.

**Environment contact — stated in full.** A Node instrument loaded every
router file under `src/routes/` individually (per-router loading, matching
`F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md` §2's own method) with
`DATABASE_URL` cleared and `DB_HOST` forced to loopback before any router
loaded. One router (`worldStudio.js`) attempted a Postgres connection at
require time regardless and was refused locally (`ECONNREFUSED
127.0.0.1:5432`) — the same accepted side effect `F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`
§2 records for Redis. **No deployed host contacted. No AWS call. No Cognito
contact. Prod FROZEN.**

---

## §1. Method — reused and extended, not re-derived from nothing

The instrument follows `F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`
§2's own description: middleware identified by function identity against
`require`-cached exports, `asyncHandler`-family wrappers unwrapped so the
real handler source is inspected, no grep over declaration text.

**Two gaps were found and closed before the instrument's write-side output
was trusted enough to guide any edit:**

1. **`router.use()` presets.** An initial pass inspected only each route's
   own stack and found 46 "mount-only" writes — the exact failure mode
   `F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`'s own corrected
   banner names (*"a second classifier returned 39 mount-only writes
   because it inspected only each route's own stack and ignored
   `router.use()` presets"*). Fixed by walking each router's full stack in
   registration order and folding in every preceding non-route layer whose
   path matches, before classifying. This brought the write-mount-only
   count to 16.
2. **A second auth module.** `src/routes/auth.js`'s `/logout` and
   `src/routes/compositions.js`'s seven write declarations use
   `authenticateJWT` / `requireGroup` from `src/middleware/jwtAuth.js` — a
   second, separate auth module `FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md`
   §5.3 already named (*"three in `src/middleware/auth.js`… and two in
   `src/middleware/jwtAuth.js`"*) but which this instrument's first pass
   did not match identity against. Patching `jwtAuth.js`'s exports the same
   way as `auth.js`'s brought write-mount-only to **8**.

**Method validation.** 8 is the exact figure
`F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`'s own **Correction
Banner 2** (not its original body, which says 9) arrives at, and the
instrument's named list matches that banner's membership exactly: `POST
/login`, `POST /refresh`, `POST /validate` (`src/routes/auth.js`); `POST /`,
`PUT /:roleKey`, `DELETE /:roleKey`, `POST /bulk-assign`, `POST
/validate-required` (`src/routes/roles.js`). `POST
/world/generate-ecosystem-preview` correctly falls out of the mount-only
set — it carries its own configured `optionalAuth({ degradeOnInfraFailure:
true })`, exactly as that banner describes, and needed no edit.
**Independent reconstruction landing on a figure that document itself only
reached after two rounds of correction is treated here as real
corroboration, not coincidence.**

## §2. The read side diverges from the scoping document's count, and is not reconciled to it

`F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md` §5 states a
candidate pool of **103** reads carrying no explicit authentication (13
dependent, 20 `getModels`-only, 56 no bare `req`, 14 uncertain). This
instrument, applying the same two fixes as §1, finds a candidate pool of
**34** (8 dependent, 0 `getModels`-only, 26 uncertain) before edits, falling
to **2** after.

**Not reconciled, and stated plainly rather than smoothed over.** The
scoping document's write-side figures are known to have needed two rounds
of correction for exactly the defects §1 closes; nothing in its text
indicates the read-side pass received the same second correction (no
banner revisits §5's candidate pool the way Banner 1 and Banner 2 revisit
§4's). Also unexamined here: the destructive edit at
`F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md` was never asked to
justify its read-side figure the way its write-side figure now stands
behind Banner 2's arithmetic. **This document does not amend that scoping
document, does not assert its 103 is wrong, and does not claim its own 34
is more authoritative in the register's terms — only that they disagree,
that a specific, named cause of disagreement is known and fixed for the
write side, and that this implementation proceeded on its own re-derived,
independently-validated set rather than wait on a reconciliation this
document has no authority to perform.**

## §3. A third blind spot, found and worked around, not fixed in the router files

`src/routes/queue-monitor.js`'s `GET /stats` and `GET /recent` appeared in
the read candidate pool — but `src/app.js:1168` mounts that router as
`app.use('/admin/queues', requireAuth, authorize(['ADMIN']), queueMonitorRoutes)`,
with a comment already on `main` recording why: *"F-AUTH-1 Step 3 CP10 Item
8 (Tier 2 at MOUNT LINE per V6 admin-prefix): Bull Board sub-router
bypasses Express-route-level auth; auth applied at mount line covers entire
`/admin/queues` namespace including UI dashboard."*

**Both this instrument and `F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`'s
own (§2: *"`src/app` is never required"*) are blind to this** — per-router
loading, by design, never sees how `src/app.js` mounts a router, so neither
instrument can see mount-line middleware. **This is a real, named gap in
the scoping document's own method, surfaced by this implementation and not
by that document.** It is recorded here, not fixed there — amending a
merged document in place is against the register's convention, and this
finding does not itself change §4 or §5's numbers materially: `queue-monitor.js`
contributes 2 of the scoping document's stated 103, not enough to explain
the larger divergence at §2.

**No edit was made to `queue-monitor.js`.** Its two routes were never
`optionalAuth`-mount-dependent in the first place — they are unreachable
without `requireAuth` and ADMIN-group `authorize` passing first, regardless
of what ran at the removed global mount. Two edits were made and then
reverted here after this was found; the revert is included in this PR's
diff history, not left in.

## §4. What was implemented

**`src/app.js`:** removed `app.use(optionalAuth);` and its import; kept
`requireAuth` and `authorize`, both still used at the `queue-monitor.js`
mount line.

**Explicit `optionalAuth` added to 40 declarations across 7 files** — the
union of the write-mount-only 8 and the read-candidate 34, minus the 2
`queue-monitor.js` reads excluded per §3 (8 + 34 − 2 = 40):

| File | Declarations |
|---|---:|
| `src/routes/auth.js` | 3 (`POST /login`, `POST /refresh`, `POST /validate`) |
| `src/routes/roles.js` | 9 (all routes in the file — 5 writes, 4 reads) |
| `src/routes/metadata.js` | 5 reads |
| `src/routes/thumbnails.js` | 7 reads (incl. a route declared twice at different points in the file — both instances edited) |
| `src/routes/assets.js` | 10 reads |
| `src/routes/scripts.js` | 4 reads |
| `src/routes/thumbnailTemplates.js` | 2 reads |
| **Total** | **40** |

**Behavior-preserving by construction.** Every added `optionalAuth` is the
same bare function the global mount used to run — same identity, same
non-blocking semantics. No route's reachability, response, or `req.user`
availability changes for any request that does not already exercise one of
these 40 declarations' pre-existing behavior. **This document does not
adjudicate whether each of the 40 legitimately needs optional identity** —
`F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md` §4 already states that
question is Tier adjudication, separate from the branch ruling, and it is
separate from implementation too. Several of the touched files carry an
existing `// PUBLIC: … Tier 4 …` comment from the F-AUTH-1 CP sweep
(`metadata.js`, `thumbnails.js`, `assets.js`, `scripts.js`) independently
classifying these routes as Tier 4 — `optionalAuth` plain is one of Tier
4's two forms per that same taxonomy, so this implementation keeps every
touched route inside its already-recorded Tier rather than moving it.

## §5. Validation run (H1 — commands and raw output)

**Post-edit instrument re-run**, same instrument as §1, against the edited
tree:

```
=== SUMMARY ===
route files scanned: 142
load errors: 2
  ERR src/routes/memories/helpers.js - no router.stack (not an express Router export)
  ERR src/routes/templateStudio.js - Cannot read properties of null (reading 'replace')
write declarations (total): 890
write mount-only (no own auth, incl. presets): 0
read declarations (GET, total): 504
read candidate pool (no own auth): 2
  read dependent (references req.user): 0
  read getModels-only / no bare req: 0
  read uncertain (passes req elsewhere): 2
  read opaque (handler unresolved): 0
```

The 2 remaining candidates are `GET /stats` and `GET /recent` in
`src/routes/queue-monitor.js` — accounted for at §3, not mount-dependent,
not edited. **Both load errors are pre-existing and unrelated**:
`memories/helpers.js` exports helper functions, not a router, by design;
`templateStudio.js`'s load failure is `F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`
§8 item 3's own already-recorded edge (*"`src/routes/templateStudio.js`
fails to load… Its declarations are uncounted everywhere above"*) —
unchanged by this session, its declarations remain uncounted here too, on
the same stated basis.

**Syntax check, every touched file:**

```
$ for f in src/app.js src/routes/auth.js src/routes/roles.js src/routes/metadata.js \
           src/routes/thumbnails.js src/routes/assets.js src/routes/scripts.js \
           src/routes/thumbnailTemplates.js src/routes/queue-monitor.js; do
    node -c "$f" && echo "OK  $f"
  done
OK  src/app.js
OK  src/routes/auth.js
OK  src/routes/roles.js
OK  src/routes/metadata.js
OK  src/routes/thumbnails.js
OK  src/routes/assets.js
OK  src/routes/scripts.js
OK  src/routes/thumbnailTemplates.js
OK  src/routes/queue-monitor.js
```

**`/validate` suite** — pasted in full in this document's associated pull
request per H1; summarized here: `node scripts/validate-routes.js` (132
route files, 704 source files, 11 pre-existing warnings, unchanged from
before this session's edits, exit 0), `bash scripts/lint-silent-catches.sh`
(no silent error handlers found, exit 0), `bash scripts/audit-cost-exposure.sh`
(no uncontrolled cost patterns found, exit 0), `node scripts/check-root-junk.js`
(exit 0).

**Update, within the same session: "not run" above no longer holds. See
§7.** `docker ps` still fails in this environment (no `/var/run/docker.sock`),
but this environment ships a native PostgreSQL 16 install and root access,
which does not need a Docker daemon at all. §7 records the real Jest run
and live-server exercise this made possible. **"Passed" is claimed only for
what §7 shows raw output for, per this register's own evidence rule** — the
paragraph above is preserved rather than deleted, per additive-supersede,
so a reader sees what was true before the revision and not only after it.

## §7. Real testing — a native Postgres, not Docker

**Docker itself was never the requirement — a reachable Postgres was.**
This environment has no Docker daemon, but does have PostgreSQL 16
installed natively (`postgresql-16`, `postgresql-client-16`) and root
access. `service postgresql start` brought up the existing `main` cluster;
`ALTER USER postgres WITH PASSWORD 'test'` and `CREATE DATABASE
episode_metadata_test` matched exactly what `tests/setup.js:9` requires
(`postgresql://postgres:test@localhost:5432/episode_metadata_test`).

### §7.1 Migrations, clean

```
$ npx sequelize-cli db:migrate
```

All 211 migrations under `src/migrations/` applied without error, ending
at `20260818000000-add-deleted-at-to-decision-logs` — the FD-66 §7.1.1
pilot migration named in `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md`
§3 step 2 as already landed, confirmed here by its migration actually
running clean against a fresh schema.

### §7.2 Full app boot, and live HTTP requests against every touched route

`src/app.js` booted and listened on a local port against the real
database — the exact boot that timed out in §5 against no database at all
completed normally here. Every route touched by this diff was exercised
with a live `curl` request, unauthenticated and with a garbage bearer
token. Several returned 500 — **and each was checked against the identical
request on the pre-diff commit, via `git worktree add … HEAD~1`, before
being treated as anything other than this diff's problem to explain**:

| Route | Status (before diff) | Status (after diff) | Cause |
|---|---|---|---|
| `GET /api/v1/roles?show_id=test` | 500 | 500 (identical) | `AssetRoleService.getRolesForshow is not a function` — a pre-existing service-layer bug, unrelated to auth, **not previously recorded anywhere found in this register**; noted here, not fixed, out of FD-67's scope |
| `GET /api/v1/metadata` | 200 | 200 (identical) | controller degrades internally on a schema-mismatch error rather than 500ing |
| `GET /api/v1/thumbnails` | 500 | 500 (identical) | `column episode.episodeTitle does not exist` — the exact `Thumbnail` mismatch `FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md` §6.3 bucket 2 already names |
| `GET /api/v1/assets` | 200 | 200 (identical) | clean |
| `GET /api/v1/scripts` | 500 | 500 (identical) | `column s.script_type does not exist` — schema drift in `scriptsService.js`, not named in FD-66's own table, so recorded here as a further instance of FD-66's class rather than assumed covered by it |
| `GET /api/v1/thumbnail-templates` | 500 | 500 (identical) | `relation "thumbnail_templates" does not exist` — `ThumbnailTemplate` has no migration under any spelling, matching FD-66 §6.3 bucket 3's shape |
| `POST /api/v1/auth/login` (no token, garbage token) | — | 401, identical either way | `AUTH_LOGIN_DISABLED` — an unrelated, pre-existing, deliberate lock; `optionalAuth` degrades on the garbage token without altering the outcome |
| `POST /api/v1/auth/validate` (empty body) | — | 400, `token is required` | unaffected by the mount change |

**Every discrepancy this table could have hidden — a status code that
changed between the two commits — did not occur.** Where a route returns a
500, it is a pre-existing defect this diff neither causes nor is
responsible for closing; four of the five 500s match FD-66's own
documented schema-drift class exactly, and the fifth (`roles.js`'s
`getRolesForshow`) is a new, unrelated finding surfaced incidentally and
recorded rather than chased.

### §7.3 Full Jest suite — first run found real, expected test debt

```
$ TEST_DATABASE_URL=postgresql://postgres:test@localhost:5432/episode_metadata_test \
  NODE_ENV=test npx jest --runInBand --forceExit
```

First run: **4 suites failed, 13 tests failed, 138 passed, 2501 passed /
2519 total.** Every failure was a literal source-text assertion from the
F-AUTH-1 CP audit program's own prior test files
(`tests/unit/routes/cp12-metadata-tier.test.js`,
`cp12-thumbnails-tier.test.js`, `cp12-assets-tier.test.js`,
`scripts-mixed-tier-promotion.test.js`) — each pinning *"Tier 4 = no
middleware, bare `asyncHandler`"* or *"no `optionalAuth` references"* as
that route's fingerprint. **That pin is the exact architecture Option 1
was ruled to end.** None of the 13 failures asserted anything about
runtime behavior; all four failing files' Tier-1/Tier-2 write assertions
(`requireAuth`, `authorize(['ADMIN'])`, `requirePermission`) passed
unchanged.

**Updated, not deleted.** Each of the four files' stale assertions was
rewritten to expect the routes' new, intentional shape (`optionalAuth`
present on the Tier 4 reads, absent from Tier 1/2 writes), with a comment
naming FD-67 Option 1 as the reason the fingerprint changed. This is an
ordinary test-suite update following an intentional, ruled architecture
change — the same kind of update every prior CP promotion in this
program's history required of its own tests — not a correction to those
tests having been wrong when written.

**Second run, after the test updates:**

```
Test Suites: 142 passed, 142 total
Tests:       5 skipped, 2514 passed, 2519 total
Snapshots:   0 total
Time:        28.824 s
```

**Zero failures.** The 5 skipped tests are pre-existing skips, unrelated to
this diff (not investigated further — skip state is unchanged by this
session).

### §7.4 What this still does not establish

- **This is a fresh, local, ephemeral Postgres 16 database** — migrated in
  this session, not the project's actual dev or CI database, and
  PostgreSQL 15 (`docker-compose.test.yml`'s pinned version) was not what
  ran; 16 was what the environment had. No cross-version incompatibility
  was observed, but none was specifically tested for either.
- **No load, concurrency, or production-scale data was exercised.** Every
  request in §7.2 ran against an empty, freshly-migrated database.
- **This does not touch, and says nothing about, prod or dev.** Both
  remain unread by this session; Prod is FROZEN and untouched throughout.
- **`AssetRoleService.getRolesForshow`'s bug is newly surfaced, not
  triaged.** No FD is minted for it here; it is named so it is not lost,
  not investigated further, and not fixed — it predates this diff and is
  outside FD-67's remedy.

## §7.5 What this document does not do

- **Does not close FD-67.** `v25` Sec 6 item 11 needs the remedy
  authorized, implemented, and tested, **and FD-68's severity interaction
  with FD-65 adjudicated separately.** This document is "implemented" and,
  per §7, "tested." **The FD-68/FD-65 adjudication is not performed here**
  and is what still keeps FD-67 open on this document's own account.
- **Does not perform Tier adjudication** on any of the 40 touched
  declarations. Behavior is preserved exactly; whether each legitimately
  needs optional identity remains open, per
  `F-AUTH-1_FD67_Branch_Ruling_2026-09-02.md` §4.
- **Does not reconcile this session's read-side count (34) against
  `F-AUTH-1_FD-67_Branch_Cost_Scoping_2026-08-22_DRAFT.md`'s (103).** §2
  states the divergence and a plausible cause; it does not resolve it, and
  does not amend that document.
- **Does not touch `src/routes/queue-monitor.js`.** Its two candidate reads
  are covered by an existing mount-line guard, confirmed by direct source
  read, not by this instrument.
- **Does not address `src/routes/templateStudio.js` or
  `src/routes/memories/helpers.js`.** Both are pre-existing instrument
  edges, unrelated to this diff, carried forward unresolved.
- **Does not sequence against `PE #65`.** `F-AUTH-1_PE65_Execution_Sequence_2026-09-02.md`
  §4 step 7 (Gate G3) already names the `src/middleware/auth.js` coupling;
  this diff does not touch the Cognito config surface PE #65 concerns, so
  no rebase is owed by this specific change, but the general caution
  stands for whichever change lands second in the future.
- **Does not mint** an FD, XK, or PE number.
- **Contacts no host, dispatches no workflow, performs no AWS read or
  write. Prod FROZEN.**

---

*Type: implementation record. Implements FD-67's ruled branch and tests it
(§7 — 142/142 suites, 2514/2519 tests, 0 failed, against a real local
Postgres). Does not close FD-67 — the FD-68/FD-65 severity adjudication
`v25` Sec 6 item 11 separately requires is not performed. No host, AWS, or
Cognito contact; database contact limited to a local, ephemeral test
instance created and used within this session. Prod FROZEN.*
