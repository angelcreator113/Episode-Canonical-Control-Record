# Apparent CI / Local Jest Divergence Resolves to Local DB Auth Fault — 2026-09-11

*Standalone measurement note. Measurement only. Rules nothing, mints nothing,
fixes nothing, and proposes no remedy.*

**Face note:** the same-SHA CI/local comparison began as an apparent suite-result
divergence, but the decisive local measurement found a local host-to-Docker
PostgreSQL authentication failure. This note does not record evidence that the
five named suites fail against a confirmed reachable local test database.

## Basis

`origin/main` at `089cfa85a1af699f3ea900fc11b3a5e0f64a4eff` (2026-09-11).

```
$ git rev-parse HEAD
089cfa85a1af699f3ea900fc11b3a5e0f64a4eff
head_sha_EXIT:0
$ git rev-parse origin/main
089cfa85a1af699f3ea900fc11b3a5e0f64a4eff
origin_main_sha_EXIT:0
```

MEASURED. The branch used for this note was
`claude/issue-1358-ci-local-divergence`, created from this `origin/main`.

## What is compared

MEASURED same-SHA comparison:

- CI Validate workflow run `34600872175`, event `push`, head SHA
  `089cfa85a1af699f3ea900fc11b3a5e0f64a4eff`, conclusion `success`.
- Local laptop run of the CI Tests job's test command, `npm test`, at the same
  `HEAD`/`origin/main` SHA, with local reproduction of CI environment as far as
  this laptop could reproduce it.

Related prior baseline, **not the same tree**: issue #1356 measured
`npx jest --runInBand --forceExit` before PR #1357 landed. That baseline was on
`origin/main` before `089cfa85` and collected 142 suites. It is carried here only
as context because issue #1358 asked for it; it is not treated as same-SHA proof.

## Tests job in `.github/workflows/validate.yml`, verbatim

```yaml
  tests:
    name: Tests
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: episode_metadata_test
        options: >-
          --health-cmd "pg_isready -U postgres"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup test database
        run: |
          PGPASSWORD=postgres psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS episode_metadata_test;"
          PGPASSWORD=postgres psql -h localhost -U postgres -c "CREATE DATABASE episode_metadata_test;"

      - name: Run database migrations
        run: npm run migrate:up
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/episode_metadata_test
          NODE_ENV: test

      - name: Run tests
        run: npm test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/episode_metadata_test
          TEST_DATABASE_URL: postgresql://postgres:postgres@localhost:5432/episode_metadata_test
          JWT_SECRET: test-secret-key-minimum-32-characters-long
          NODE_ENV: test
```

MEASURED from `.github/workflows/validate.yml` at this basis. The Tests job has
no `strategy.matrix` block and no path filter inside the job. The workflow-level
triggers are `pull_request` and `push` for branches `[main, dev]`, plus
`workflow_dispatch`; no `paths` filter is present.

## CI result at the same SHA

```
$ gh run list --repo angelcreator113/Episode-Canonical-Control-Record --workflow Validate --branch main --limit 10 --json databaseId,headSha,status,conclusion,event,displayTitle,createdAt
{ 
  "conclusion": "success",
  "createdAt": "2026-09-11T12:48:53Z",
  "databaseId": 34600872175,
  "displayTitle": "test(ci): collect passing backend test files [skip-automerge]",
  "event": "push",
  "headSha": "089cfa85a1af699f3ea900fc11b3a5e0f64a4eff",
  "status": "completed"
}
```

```
$ gh run view 34600872175 --repo angelcreator113/Episode-Canonical-Control-Record --json headSha,status,conclusion,event,createdAt,jobs
{ 
  "conclusion": "success",
  "createdAt": "2026-09-11T12:48:53Z",
  "event": "push",
  "headSha": "089cfa85a1af699f3ea900fc11b3a5e0f64a4eff",
  "jobs": [
    { "name": "Route Validation", "status": "completed", "conclusion": "success" },
    { "name": "Cost Exposure Audit", "status": "completed", "conclusion": "success" },
    { "name": "Frontend Tests", "status": "completed", "conclusion": "success" },
    { "name": "Tests", "status": "completed", "conclusion": "success" }
  ],
  "status": "completed"
}
```

CI Tests job log excerpt, MEASURED from job `103267564829`:

```
Tests   Run tests       2026-09-11T12:50:01.5066214Z npm test
Tests   Run tests       2026-09-11T12:50:28.7883010Z PASS tests/integration/f-auth-1-g3-clause3.test.js
Tests   Run tests       2026-09-11T12:50:30.8992638Z PASS tests/integration/episodes.integration.test.js
Tests   Run tests       2026-09-11T12:50:32.6971981Z PASS tests/integration/wardrobe-money.integration.test.js
Tests   Run tests       2026-09-11T12:50:34.2640780Z PASS tests/unit/route-health.test.js
Tests   Run tests       2026-09-11T12:50:39.0965118Z PASS tests/unit/app.test.js
Tests   Run tests       2026-09-11T12:50:47.7138299Z Test Suites: 144 passed, 144 total
Tests   Run tests       2026-09-11T12:50:47.7138613Z Tests:       5 skipped, 2582 passed, 2587 total
Tests   Run tests       2026-09-11T12:50:47.7139118Z Ran all test suites.
```

MEASURED. CI's Tests job ran `npm test`, collected 144 suites, and passed all
144 at the basis SHA.

## Local reproduction of CI's test command

The CI command itself was run locally as `npm test`. CI's exact service port
mapping was not reproduced: CI maps Postgres to host `localhost:5432`; this
repo's local test compose file defines service `postgres-test` with host port
`5433:5432`. The local run therefore used `localhost:5433` for
`DATABASE_URL` and `TEST_DATABASE_URL`.

Local environment facts:

```
$ node -v
v22.22.0
node_version_EXIT:0
$ npm -v
10.9.4
npm_version_EXIT:0
$ [System.Environment]::OSVersion.VersionString
Microsoft Windows NT 10.0.26200.0
```

Local database access facts after the run:

```
$ psql -h 127.0.0.1 -p 5433 -U postgres -d episode_metadata_test -c "SELECT current_database(), current_user;"
psql: error: connection to server at "127.0.0.1", port 5433 failed: FATAL:  password authentication failed for user "postgres"
psql_127_5433_check_EXIT:2
$ docker exec episode-control-test-db psql -U postgres -d episode_metadata_test -c "SELECT current_database(), current_user;"
   current_database    | current_user 
-----------------------+--------------
 episode_metadata_test | postgres
(1 row)

docker_exec_psql_check_EXIT:0
```

MEASURED. The Docker container could read the database internally as `postgres`,
but host TCP auth to the published local test port failed with
`postgres`/`postgres` after the local run. This is the load-bearing measured
local-environment difference in this note: the local test process reaches the
test database over host TCP, and that access path was measured failing
authentication. This note takes no position on why the published-port password
state differs from the in-container access path.

Local CI-command run, with locally reproducible environment:

```
$env:DATABASE_URL='postgresql://postgres:postgres@localhost:5433/episode_metadata_test'
$env:TEST_DATABASE_URL='postgresql://postgres:postgres@localhost:5433/episode_metadata_test'
$env:JWT_SECRET='test-secret-key-minimum-32-characters-long'
$env:NODE_ENV='test'
$ npm test
FAIL  tests/integration/episodes.integration.test.js (50.804 s)
FAIL  tests/integration/f-auth-1-g3-clause3.test.js
FAIL  tests/unit/route-health.test.js
FAIL  tests/integration/wardrobe-money.integration.test.js
FAIL  tests/unit/app.test.js
Test Suites: 5 failed, 139 passed, 144 total
Tests:       13 failed, 5 skipped, 2569 passed, 2587 total
Snapshots:   0 total
Time:        157.386 s
Ran all test suites.
ci_local_npm_test_EXIT:1
```

MEASURED. The same `npm test` command, on the same repository SHA, collected
144 suites locally and failed five suites.

## Local failure cause check

Because the local DB access check failed, the five locally failing suites were
run again individually under the same local environment to pull the actual
failure messages. Raw excerpts:

```
SUITE=tests/integration/episodes.integration.test.js EXIT=1
Episode list with Show include failed, retrying without: password authentication failed for user "postgres"
Error in listEpisodes: ConnectionError [SequelizeConnectionError]: password authentication failed for user "postgres"

SUITE=tests/integration/f-auth-1-g3-clause3.test.js EXIT=1
Error creating decision log: ConnectionError [SequelizeConnectionError]: password authentication failed for user "postgres"
"error": "password authentication failed for user \"postgres\""
SequelizeConnectionError: password authentication failed for user "postgres"

SUITE=tests/integration/wardrobe-money.integration.test.js EXIT=1
Wardrobe purchase error: ConnectionError [SequelizeConnectionError]: password authentication failed for user "postgres"
Expected: 404
Received: 500

SUITE=tests/unit/route-health.test.js EXIT=1
Expected: 200
Received: 503

SUITE=tests/unit/app.test.js EXIT=1
expected 200 "OK", got 503 "Service Unavailable"
```

The two health suites were then checked by calling `/health` directly under the
same local environment:

```
HEALTH_STATUS:503
HEALTH_BODY:{"status":"degraded","timestamp":"2026-09-11T13:05:08.130Z","uptime":4.8108768,"version":"v1","environment":"test","config":{"DATABASE_URL":"SET","DB_HOST":"127.0.0.1","DB_NAME":"episode_metadata","DB_SSL":"false"},"database":"disconnected","databaseError":"password authentication failed for user \"postgres\""}
```

MEASURED. The five local failures are not five independent application-result
failures in this run. Three expose PostgreSQL authentication failure directly;
the two unit health suites fail because `/health` reports `database` as
`disconnected` with the same PostgreSQL authentication error. This note does
not assert how those suites behave when host TCP database authentication is
working.

The same `/health` body's `config` block names `DB_HOST` as `127.0.0.1` and
`DB_NAME` as `episode_metadata`, while the local reproduction env shown above
set both `DATABASE_URL` and `TEST_DATABASE_URL` to
`postgresql://postgres:postgres@localhost:5433/episode_metadata_test`. This
mismatch is recorded, not explained.

## Prior issue #1356 baseline, not same SHA

Issue #1356's laptop baseline was taken before PR #1357's merge commit. It is a
useful comparison point because it shows the same five suite names and the same
13 failing tests before the collection-widening PR, but it is **not** a same-SHA
comparison with CI run `34600872175`.

```
FAIL  tests/integration/episodes.integration.test.js
FAIL  tests/integration/f-auth-1-g3-clause3.test.js
FAIL  tests/integration/wardrobe-money.integration.test.js
FAIL  tests/unit/route-health.test.js
FAIL  tests/unit/app.test.js
Test Suites: 5 failed, 137 passed, 142 total
Tests:       13 failed, 5 skipped, 2501 passed, 2519 total
baseline_full_jest_EXIT:1
```

MEASURED from the issue #1356 session output. Basis differed from this note's
basis; PR #1357 then added two passing suites, producing 144 collected suites at
`089cfa85`.

## Collection status of the five locally failing suites

```
$ npx jest --listTests
listTests_for_five_EXIT=0
COLLECTED_COUNT=144
SUITE=tests\integration\episodes.integration.test.js COLLECTED=YES PATH=C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\tests\integration\episodes.integration.test.js
SUITE=tests\integration\f-auth-1-g3-clause3.test.js COLLECTED=YES PATH=C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\tests\integration\f-auth-1-g3-clause3.test.js
SUITE=tests\integration\wardrobe-money.integration.test.js COLLECTED=YES PATH=C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\tests\integration\wardrobe-money.integration.test.js
SUITE=tests\unit\route-health.test.js COLLECTED=YES PATH=C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\tests\unit\route-health.test.js
SUITE=tests\unit\app.test.js COLLECTED=YES PATH=C:\Users\12483\Projects\Episode-Canonical-Control-Record-1\tests\unit\app.test.js
```

MEASURED. All five suites are collected by the current Jest configuration.
The CI Tests job log also shows all five as `PASS`, so this is not a case where
CI passed because it skipped those suite files.

## Established differences between CI and local

MEASURED or directly derived from measured configuration/output:

| Dimension | CI Tests job | Local laptop run |
|---|---|---|
| Basis SHA | `089cfa85a1af699f3ea900fc11b3a5e0f64a4eff` | `089cfa85a1af699f3ea900fc11b3a5e0f64a4eff` |
| Command | `npm test` | `npm test` |
| Test scope | 144 suites, all passed | 144 suites, 5 failed / 139 passed |
| Tests | 5 skipped / 2582 passed / 2587 total | 13 failed / 5 skipped / 2569 passed / 2587 total |
| OS | `ubuntu-latest` | Windows `Microsoft Windows NT 10.0.26200.0` |
| Node | `actions/setup-node@v4` with `node-version: '20'` | `v22.22.0` |
| npm | Not independently measured from CI log here | `10.9.4` |
| Database service | GitHub Actions `postgres:15`, `5432:5432` | Docker Compose `postgres-test`, `5433:5432` |
| DB access | CI Tests job log shows all five suites passed after CI drop/create/migrate | Host TCP auth to the local published test port failed with `password authentication failed for user "postgres"`; in-container `psql` succeeded |
| DB setup | CI drops/creates DB, runs `npm run migrate:up`, then `npm test` | Local reproduction used the same command shape but could not reproduce the 5432 service mapping; the local failure-cause check ties all five local failing suites to the host TCP PostgreSQL auth failure |
| Worker count | `npm test` script includes `jest --coverage --runInBand --forceExit` | same command/script |
| Coverage | `npm test` includes `--coverage` | same command/script |
| Ordering | CI log records all five named suites as `PASS` in one `npm test` run | Local Jest summary lists the same five suite files as `FAIL`; order differs in output, not assessed |

Unreproducible parts of CI's environment in this session:

- GitHub-hosted Ubuntu runner image (`ubuntu-latest`) was not reproduced on the
  Windows laptop.
- Node 20 from `actions/setup-node@v4` was not reproduced; the laptop ran Node
  `v22.22.0`.
- GitHub Actions service networking with Postgres on `localhost:5432` was not
  reproduced; the repo's local test compose service exposes the test container
  on host `5433`.
- A working host TCP connection to the local test DB as `postgres` with password
  `postgres` was not reproduced after the local run; `docker exec` inside the
  container succeeded, but host `psql` to `127.0.0.1:5433` failed password auth.
- The complete hosted-runner environment variables and filesystem state were
  not reproduced. Only the env values stated in `validate.yml`'s Tests job were
  set locally where applicable.

## Standing

MEASURED: the workflow text, CI run/job result, CI Tests job log excerpt,
current Jest collection of the five suites, local Node/npm/OS facts, local DB
access facts, local `npm test` summary, focused reruns of the five locally
failing suites, and the direct `/health` response under the same local env.

This note takes no position on which result is correct. It does not declare the
five suites broken. It does not declare the CI job inadequate. It proposes no
remedy. The local evidence in this note measures a misconfigured or otherwise
non-authenticating local host-to-Docker test DB path; it does not measure those
five suites failing against a confirmed reachable local test database.

## FD / XK / PE tails

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -3
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
fd_tail_EXIT:0
```

MEASURED. FD filename tail remains FD-69; FD-70 is not minted here.

```
$ ls docs/audit | grep -E '^XK-[0-9]+_' | sort -t- -k2 -n | tail -3
XK-2_Extent_Census_2026-09-05.md
xk_file_tail_EXIT:0
$ Select-String XK-3 in Cross_Keystone_Register.md
52:| XK-3 | No authorization substrate for the tenancy root — no user↔show relation exists, so `show_id` is caller-asserted and unverifiable | F-AUTH-1, F-Stats-1 | OWNED (F-Stats-1 v1.57) | UNEVALUATED |
288:### XK-3 — no authorization substrate for the tenancy root
312:These are **XK-3 Gate 1 … XK-3 Gate 4**, always written in full; they are unrelated
317:| XK-3 Gate 1 | `shows` has no ownership column, at creation or in any ALTER | `src/models/Show.js`; `src/migrations/20260109132556-create-shows.js`; `scripts/migrations/fix-shows-schema.sql`; `create-shows-only.sql`; `recreate-shows-table.js`; plus `src/models/Universe.js` above it |
318:| XK-3 Gate 2 | no resource-scoped authorization tier exists | `src/middleware/auth.js` direct read; `authorize` = `verifyGroup` by its own comment; 30 call sites all pass `admin`/`ADMIN` |
xk3_register_EXIT:0
```

MEASURED. Filename scan alone reaches XK-2; Cross-Keystone Register carries
XK-3. No XK is minted here.

```
$ grep -n '^### PE #6[4-9]' docs/audit/Session_PE_Roster.md
1631:### PE #64 — Cognito User Pool shared between dev and prod: F-AUTH-1 Fix Plan v1.5 §9.10's P1 has been unrecorded since v2.38 (P1, OPEN, NEW 2026-08-21)
1813:### PE #65 — F-AUTH-1 v1.5 §9.10's remedy is unspecifiable as written: plan and trigger describe different operations, and the pool it retains does not exist (P2, OPEN, NEW 2026-08-21)
1920:### PE #66 — `docs/cognito-ids.txt` names two Cognito pools that do not exist, under an abandoned three-environment topology (P2, OPEN, NEW 2026-08-21)
2026:### PE #67 — feature branch cut from a squash-merged predecessor branch produced a 749-line PR diff with 332 lines of predecessor inflation (P2, OPEN, NEW 2026-08-22)
2146:### PE #68 — an agent harness injects a git credential that authorizes write to this repository, and whose identity was asserted and withdrawn; a live third candidate for the standing autonomous-PR pattern (P2, OPEN, NEW 2026-08-28)
2372:### PE #66 — `docs/cognito-ids.txt` names two Cognito pools that do not exist, under an abandoned three-environment topology (P2, OPEN, NEW 2026-08-21)
2386:### PE #64 — Cognito User Pool shared between dev and prod: F-AUTH-1 Fix Plan v1.5 §9.10's P1 has been unrecorded since v2.38 (P1, OPEN, NEW 2026-08-21)
pe_tail_EXIT:0
```

MEASURED. Highest PE heading in this scan remains PE #68; duplicate later PE #64
and PE #66 headings are visible in the same output and not assessed here. No PE
is minted here.

## What this note does not do

- Does not modify any test file, `jest.config.js`, workflow, or source file.
- Does not fix, skip, or silence any failing suite.
- Does not edit any filed document in place.
- Does not mint FD, XK, or PE.
- Does not propose a remedy or rank possible causes.
- Does not contact any host, AWS, or Cognito.
- Uses only the local Docker test DB for local test reproduction.

## Footer

**Type:** standalone measurement note. **Rules:** nothing. **Mints:** nothing —
no FD, no XK, no PE. **Host/AWS/Cognito contact:** none. **Database contact:**
local Docker test DB only. **Prod FROZEN**, untouched.

*Author: GitHub Copilot, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-09-11. Basis: `origin/main` at
`089cfa85a1af699f3ea900fc11b3a5e0f64a4eff`.*
