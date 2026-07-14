# F-Deploy-1 Fix Plan v1.43

**§4.3 CLOSED 2026-07-14: FIRST DISPATCH GREEN end-to-end (run 29359414179,
head c25a9db6) — test, build, deploy all success; on-box tail '✅ Full
deployment complete'. THE 7-DAY BURN-IN CLOCK STARTED ~18:53Z; window lands
Tuesday 2026-07-21, mid-week per §7.1. En route this session: EIP
54.87.253.45 allocated and associated (eipalloc-0bc2185830934352b — the IP
coupling is ended PERMANENTLY for every consumer); SG rule lifecycle
completed (EIP rule sgr-03dbcb141545deeb5 minted-and-ratified, 184-rule
revoked clean); RE-ENABLEMENT RULING TAKEN AND EXECUTED — Deploy to
Development active after 13 days disabled_manually, the gate carried
"untaken, unproposed" since v1.28 §5. Dispatch one FAILED at the
migration-bootstrap leg (DB_SSL absent from the staged env — pg_hba
"no encryption"); finding session pinned it to one line; fix PR #933
(c25a9db6) staged export DB_SSL=true adjacent to the loader eval, upstream
of the trap; dispatch two cleared the wall: SequelizeMeta 219 entries
recognized, migrations no-op (schema current), PM2 restart healed the
trap-launched apps (Rider 1 confirmed), health first-attempt. Route-check
"false" lines adjudicated as the pre-registered 401 false-negative — auth
working over a live DB, not a defect. Mints no FD. Register tail: FD-61 at
open, FD-61 at close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.42 (§4.2 PASS at t3.small; merged #931, f6c1213b). Interleaved: G2 Implementation v1.4 (#932, 2c8a1259) discharged v1.42 §4's sequencing gate; fix PR #933 (c25a9db6) is code, recorded here. |
| **Author date** | 2026-07-14 |
| **Gate effect** | §4.3 gate CLOSED (first dev deploy landed on episode-dev-backend and serves — G2 v1.4 §4.3 gate meaning, satisfied via the FD-57 path). §4.4 burn-in window OPEN: 7 calendar days from 2026-07-14 ~18:53Z, closing Tuesday 2026-07-21. §5.4 daily observables begin 2026-07-15. §4.5 (PM2 retirement) remains blocked on §7.3 clean close. |

**Basis (live reads and writes 2026-07-14, this session, transcribed from
live terminal output, not memory):**
- Trio: main at 2c8a1259 (#932) at session segment open; #933 merged
  mid-session (c25a9db6); dispatch two ran on c25a9db6.
- Pre-dispatch reads: workflow runtime states live (gh workflow list —
  FD-50 form); dead-IP sweep of workflows clean; P2 role first-hand
  (created 2026-07-13T16:34Z); deploy bucket exists exit 0.
- All control-plane writes, both dispatches, and the finding per §1–§4.

## §1 EIP block — the coupling ended

Ruling (Rule 7, in-channel): ALLOCATE now, pre-dispatch — the cheapest
moment the fix will ever have; deferring re-runs the orphan dance later
with more consumers attached.
- **Write 1:** allocate — eipalloc-0bc2185830934352b, 54.87.253.45,
  tagged (Name=episode-dev-backend-eip, Keystone=F-Deploy-1).
- **Write 2:** associate — eipassoc-0f6a90811eafd9ca2; verified in one
  read: running / t3.small / 54.87.253.45. 184.73.130.72 released
  (lifetime: ~6 hours; appears only in v1.41/v1.42, valid as history).
- **Write 3:** EIP rule minted — sgr-03dbcb141545deeb5,
  54.87.253.45/32 tcp/5432, description "…PERMANENT - coupling ended,
  ratified at mint." Ratified AT mint; no dangling disposition.
- **Write 4:** 184-rule (sgr-069e6deadaa82f08a) revoked — mint-before-
  revoke ordering left zero window with no admitting rule. SG end-state
  verified: EIP rule + three legacy rules, four total.
- **Address of record: 54.87.253.45, permanent.** The v1.42 §4 doc-sweep
  scope SHRINKS to lingering 98.93.190.74 references only.

## §2 Re-enablement — the fourteen-revision gate

Pre-dispatch reads: Deploy to Development confirmed disabled_manually
live; Deploy to Production and Auto-merge to Dev also disabled_manually
(the latter explains every [skip-automerge] PR sitting for manual merge
regardless of token — consistent, no action). Ruling (Rule 7, in-channel,
proposed and taken): ENABLE. Each leg of the 2026-07-01 AllStopped
cascade is structurally dead in the current file — no push trigger,
auto-merge itself disabled, SSM-by-tag transport (no SSH, no host
secret), zero workflow-carried app secrets, dev physically isolated.
Enabling ≠ running: workflow_dispatch is the only trigger. Executed:
gh workflow enable 224506682; verified active; prod and auto-merge
untouched. Rollback symmetric (one command), unneeded.

## §3 Dispatch one — FAIL, finding, fix

Run 29357042127 (head 2c8a1259). FIRSTS THAT PASSED: OIDC assume of
episode-gha-deploy-dev (P2 exercised clean), SSM preflight by tag, S3
upload + presign, artifact fetch (87M, sha match), frontend + nginx
deploy — **P5's placeholder substrate passed nginx -t IN FIRE**, the
exhibit C3 pre-proved — backend extract to ~/episode-metadata (real
deploy path; coexists with the synthetic clone, no collision),
print-db-env's third field run (count basis: workstation smoke
excluded; §4.2 dev-box runs 1–2, dispatch-1 is 3). **RF-2's trap fired
as designed on its first real failure:** the mid-script abort still
launched both PM2 apps with the eval'd env — the insurance path's first
live exhibit.

FAILURE: `Bootstrap error: no pg_hba.conf entry for host
"54.87.253.45" … no encryption`. Root cause, single defect: **DB_SSL
absent from the staged environment.** The loader's 5-export contract
deliberately excludes it (config, not secret); the real deploy path has
no populated .env (dotenv "env (0)"), unlike every prior tree where
app+RDS was proven; both bootstrap-sequelize-meta.js and sequelize.js
gate SSL on DB_SSL === 'true'; RDS enforces force_ssl. The connection
REACHED pg_hba — network path (EIP rule) healthy.

FIX: PR #933 (c25a9db6) — `export DB_SSL=true` adjacent to the eval,
**upstream of `trap restore_pm2 EXIT`** (Rider 2: an export between
trap-arm and bootstrap would leave restore_pm2 firing SSL-less on early
failure — the R3-family clobber reintroduced one variable at a time;
placement stated in-file and in the PR body, reasoned not lucky).
Rider 1 pre-registered: re-dispatch IS the heal intervention for the
DB-broken trap-launched apps; health = heal exhibit.

## §4 Dispatch two — GREEN, §4.3 closed

Run 29359414179 (head c25a9db6). All three jobs success. On-box tail:
- Bootstrap: `Connected to database` → `SequelizeMeta entries: 219,
  episodes table exists: true` → no bootstrap needed. **The run-1 wall,
  cleared.**
- Migrations: `No migrations were executed, database schema was already
  up to date` — first canon-RDS migration contact was a no-op by design;
  the highest-consequence leg ran at zero consequence.
- PM2: restartProcessId both apps (↺ 1 — the restart FROM broken TO
  healed), tree saved. **Rider 1 heal: CONFIRMED** — health check green
  attempt 1 (health requires DB; stale-env state dead).
- Route checks `false`: **the pre-registered 401 false-negative,
  exactly** — curl -sf scores AUTH_REQUIRED (4xx) as failure; the API
  answering 401 is auth working over a live DB connection.
  Informational lines, non-gating, adjudicated in advance. NAMED CLASS
  for future tail-readers: curl -sf route probes against auth-gated
  endpoints report false on success-shaped auth denials.
- pm2 save ran (script design): with a populated HEALTHY tree this is
  correct — the resurrect ban targeted stale-env manifests; this dump
  is the live deployment's own. **The box is no longer substrate-only:
  it is the serving dev backend.** That is §4.3's gate meaning.
- Site dark externally BY DESIGN (DNS on prod box until cutover;
  localhost health is the gate per G2 v1.4 §4.3 pointer).
- **Shared-box leg (v1.4 §4.3 gate criterion, read not argued):**
  episode-backend pm2 tree read post-dispatch (ratified read-only prod
  open, single command, disclosed here) — tree unchanged: episode-api and
  episode-api-prod-hotfix online at 2-day uptime, zero restarts across
  today's dispatch window; src/server.js mtime Jun 27, deploy tree mtime
  Jul 11. Artifacts landed on episode-dev-backend ONLY. Naming-reality
  note: the gate text's "*-dev PM2 apps" is a carried v1.3 assumption —
  no *-dev-named apps exist on the shared box; its dev-posture pair is
  episode-api / episode-worker (default namespace). §4.5 retirement
  scope must target actual names, not the *-dev glob. (episode-worker
  observed stopped, ↺4, pre-existing; parked observation.)
  Consequence: G2 v1.4 §4.5's procedure text ("for each *-dev app")
  inherits the empty-referent defect; correction folds into §4.5's own
  pre-execution contract read (or any earlier doc touch).

**§4.3 CLOSED. §4.4 burn-in clock: 2026-07-14 ~18:53Z → Tuesday
2026-07-21.** §5.4 dailies begin 2026-07-15: dev CPU/memory/disk trend,
prod metrics unchanged, deploy targeting spot-checks, zero
F-Deploy-G1-Y recurrences, timestamps recorded even when clean.

## §5 Corrections and disclosures

- **Ride-along family, two further occurrences** (EIP writes 2 and 3
  executed ahead of their confirms; ordinal position per register scan —
  the running count is not carried from memory, per the FD-60 counter
  lesson). Outcomes correct; the pattern held through a four-write
  control-plane block only at writes 1 and 4. The mitigation's residual
  value is the draft-review beat, not the execution gate; recorded
  without relitigating.
- **jq-quoting defect (mine):** the first poll loop passed the jq
  expression double-quoted; PowerShell stripped the inner quotes and
  the loop fell through instantly. Corrected form single-quotes the
  expression and null-coalesces .conclusion. Minor, but it cost one
  polling cycle and is the standing shell-quoting hazard's jq face.
- **Pre-read 2 exit-code omission:** the workflow dead-IP sweep ran
  without the echo'd exit code (FD-51 form specified, not executed);
  acquitted by construction (pattern proven, FD-57 design corroborates)
  and recorded rather than re-run.
- **actions/setup-node deprecation residue:** run logs warn Node 20
  runner deprecation (Node 24 default). Workflow-maintenance item,
  not chased; joins the residue pile with the SDK-v2 loader note.
  Also into the pile: describe-addresses surfaced six additional EIPs,
  several ENI-associated with no instance — rider for the post-G2
  NAT/cost audit.
- **Auto-merge to Dev observed disabled_manually:** standing state,
  explains token-independent manual merges; its own re-enablement (if
  ever) is a separate ruling nobody owes yet.

## §6 Retained

v1.36–v1.42 in full; G2 Implementation v1.4 is the standing contract.
Prerequisite register: P1–P3 CLOSED, **P4's register close FOLDS TO
DONE — discharging the deferred decision from the v1.36-era session
(fold-at-first-dispatch, condition: instance-role/on-box leg proven at
dispatch). Condition met four times over: the loader is four-for-four
in the field (two §4.2 sessions, two dispatches), twice on the real
deploy path.** The app-boot secret-reading model remains the
acknowledged design per the workflow header; P4's code-PR migration
note (SDK v2) stands. P5 CLOSED-placeholder (real cert at cutover).
FD-61 OPEN, parked. Cutover-inherits-six unchanged; prod certbot
cleanup ~mid-August. Doc sweep: 98.93.190.74 only, plus propagating
54.87.253.45 as address of record.

## §7 Register hygiene

Tail at open: FD-61. Minted: none (EIP and SG rule are AWS resources,
dispositions closed at mint). Closed: §4.3 gate; re-enablement ruling;
the DB_SSL finding (fixed same-session, #933). Opened: §4.4 burn-in
window (clock, not a finding). Writes this session: four AWS
control-plane (allocate, associate, authorize, revoke) + one workflow
runtime enable + one code PR (#933) + two dispatches (one failed, one
green — the failed run's writes were healed by the green run's
restart). FD-21 check on commit message. Ships [skip-automerge] in
title, body via --body-file.

---
*End of F-Deploy-1 Fix Plan v1.43.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-14. Predecessor: v1.42 (f6c1213b, #931); interleaved
G2 Impl v1.4 (#932), fix PR #933 (c25a9db6).*
*Closed: §4.3 (first dispatch green), re-enablement, DB_SSL finding.*
*Open: §4.4 burn-in → 2026-07-21. Minted: none. Tail: FD-61.*
*Box: i-016395bb5f7a51a0b @ 54.87.253.45 (EIP, permanent), t3.small,*
*SERVING dev backend. Frontier: §4.4 burn-in dailies → §4.5 retirement.*
*[skip-automerge]*
