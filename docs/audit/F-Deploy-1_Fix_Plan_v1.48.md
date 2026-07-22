# F-Deploy-1 Fix Plan v1.48

**F-DEPLOY-1 KEYSTONE CLOSED 2026-07-22. s4.5.2 executed per the v1.47
plan and CLOSED: four gated prod-box contacts (one read, three writes),
zero anomalies, prod-hotfix PID 1609763 unbroken across the entire
sequence, dump persisted to the two-app prod-only manifest at 11:58:57Z.
Item 7 CLOSED: dual-health 200/200 inside the execution window. Item 8
delivered in this revision as the G2 close note (s4). G2 s8 criteria 1-8
all satisfied -> G2 CLOSED -> Phase B CLOSED -> keystone CLOSED.
Downstream unblocks per Implementation v1.4 s8: F-Stats-1 Phase B
(Decision #9 gate satisfied) and the fix-cycle sequence's continuation.
Mints no FD. Register tail: FD-61 at open and close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.47 (c5e8fb4c, #946; s4.5.2 planned, execution gated). |
| **Author date** | 2026-07-22 |
| **Gate effect** | s4.5.2 CLOSED. Item 7 CLOSED. Item 8 CLOSED (delivered herein). G2 CLOSED. Phase B CLOSED. F-Deploy-1 KEYSTONE CLOSED. |

**Basis (live, this session):** v1.47 merged to main (c5e8fb4c) as entry
condition; execution transcripts `ssm_452_step0_result.txt` (baseline
re-read, PASS), `s452_step1_result.txt` (stop, PASS),
`s452_step2_result.txt` (delete, PASS), `s452_step3_result.txt` (save +
verify, PASS); dev-health SSM 3a8246ca-b517-4993-b3db-0f69e397e6a9
(`ssm_devhealth_result.json`, DEVHEALTH:200); `gh secret list` live
read; `git show origin/main:.github/workflows/deploy-dev.yml` targeting
comment; committed root ecosystem.config.js (prod port derivation).

## s1 s4.5.2 execution record

Executed 2026-07-22, ~11:50-11:59Z, over SSH per the v1.47 s1 transport
adjudication. Every step a Rule 7 boundary; scripts byte-certified
(NO_BOM / LF_ONLY) before each contact.

- **Step 0 (11:50:06Z, read-only):** baseline re-read via
  `ssm_452_read.sh` verbatim. EXACT match to the v1.47 s2 table -- three
  apps, identical statuses, identical PIDs (1609686 / 1609763; processes
  had not even restarted since the planning read). Cleared to write.
- **Step 1 (11:54:30Z, write):** `pm2 stop episode-api`. Verified:
  episode-api stopped; prod-hotfix online PID 1609763 unchanged (10-day
  process uptime intact); HEALTH:200 on :3000 (port derived from
  committed root manifest, not assumed). PASS.
- **Step 2 (11:56:32Z, write):** `pm2 delete episode-api`. Verified:
  two-app table; prod-hotfix online 1609763; DUMPNAMES still all three
  (resurrect path certified alive at the moment before burn); HEALTH:200.
  PASS.
- **Step 3 (11:58:57Z, write -- point of no return):** `pm2 save`.
  Verified in-contact: DUMPNAMES exactly
  ['episode-api-prod-hotfix', 'episode-worker']; jlist two apps,
  prod-hotfix online 1609763; HEALTH:200; load 0.00; mem 364/1910 used
  (down from 474 baseline -- the retired dev api's footprint, lawful
  expected reduction). PASS. s6.4 posture now in effect by design.
- **Step 4 (in-window):** prod half on the Step 3 transcript; dev half
  via SSM 3a8246ca on i-016395bb5f7a51a0b: DEVHEALTH:200 on :3002.

**s4.5 gate criterion (Implementation v1.4): SATISFIED.** Shared box
hosts only prod-manifest apps; dump persisted and verified by direct
read; no load regression (reduction observed); s4.5.1 closed at v1.46.
FD-28's retirement substance is complete.

**Process notes (Rule 7 disclosure):** Steps 1-3 contacts were run by
the maintainer in the same paste as script validation -- confirm-by-
execution by the keyholder, filed as such, not as gate skips. Prod-box
contact this session totals four SSH invocations (one read, three
writes); dev-box contact one read-only SSM.

## s2 Item 7 -- dual-health verification: CLOSED

Prod: HEALTH:200 at 11:58:59Z (Step 3 transcript, localhost:3000).
Dev: DEVHEALTH:200 (SSM 3a8246ca, localhost:3002), same execution
window. Both instances healthy and serving their respective workloads.
G2 s8 criterion 7 satisfied.

## s3 G2 s8 criteria scorecard

1-4: satisfied per v1.44/v1.45 (provisioning, memory profile at
t3.small, retargeting, burn-in clean). 5: satisfied this revision (s1).
6: satisfied at v1.46 (s4.5.1). 7: satisfied this revision (s2).
8: satisfied by this revision itself (s4). **All eight: G2 CLOSED.**

## s4 G2 close note (item 8)

- **s4.2 memory profile observations:** carried in the register at Fix
  Plan v1.41 (t3.micro FAIL -- kernel-attested OOM, driver killed at
  ~474 MiB anon on a 913 MiB box) and v1.42 (t3.small PASS -- peak
  1,121 MiB vs 1,679 bar, dual-channel). Cited, not restated.
- **FD-27 confirm-or-revise: CONFIRMED-AS-REVISED.** Instance class
  t3.small per the v1.42 revision; the burn-in window (v1.45, seven of
  seven criteria) validates the revised commitment. No further revision.
- **DEV_EC2_HOST disposition: ALREADY RESOLVED pre-close.**
  `gh secret list` (live, this session) shows DEV_EC2_HOST absent.
  deploy-dev.yml's own targeting comment certifies: retired/deleted with
  that revision's gate; targeting is by instance tag
  (Name=episode-dev-backend); NO host secret on the path;
  EPISODE_DEV_BACKEND_HOST unreferenced. s4.6 step 2 satisfied by prior
  gated work; documented here.
- **Worker observation:** shared box's `episode-worker` (prod-manifest)
  found stopped (restart_time 4) inside a 122-day box uptime, duration
  unknown. Pre-existing condition, untouched per v1.47 ruling 1. Whether
  prod requires its worker running is OWED as a named question at a
  future register revision -- outside F-Deploy-1 scope.
- **Manifest riders (both carried forward, not silent):** (a) shared
  box's on-disk `/home/ubuntu/episode-metadata/ecosystem.config.js`
  (pre-split, still defines the dev entry; manual `pm2 start` replay
  hazard) -- reconcile at next prod deploy touch, per v1.47 ruling 2;
  (b) dev box's stale root ecosystem.config.js in the deployed tree --
  remove at next deploy touch, per v1.46 s4.
- **Secret observations (no action):** `EC2_HOST` (5 months old, name
  ambiguous, presumed legacy) and `EPISODE_DEV_BACKEND_HOST` (exists,
  unreferenced by any workflow) -- both owed a disposition at a future
  register revision.
- **122-day uptime note:** the box's unbroken uptime across the entire
  campaign certifies the FROZEN posture held from freeze to final write.

## s5 Keystone close and downstream unblocks

G2 CLOSED closes Phase B; Phase B was F-Deploy-1's remaining open
phase; **F-DEPLOY-1 IS CLOSED.** Per Implementation v1.4 s8 and
Decision #9:

- **F-Stats-1 Phase B** becomes the next executable keystone (its gate
  -- F-Deploy-1 keystone close -- is satisfied; the burn-in week's
  surface re-verification at #945 is its freshest input).
- The fix-cycle sequence continues per the locked register order.
- Post-G2-sequenced items now schedulable: F-Deploy-G1-AD / -AE / -AF
  resolution (AD's scope note per v1.47 s1: also restores prod SSM
  manageability), the v1.5 s8 env: pattern sweep companion, retained-NAT
  route-table audit (reframed scope per Implementation v1.4 s1),
  t3.nano optimization evaluation.
- **Standing gates unchanged by this close:** deploy-dev.yml push
  trigger remains a deliberate gated decision; credential rotation
  window (canon db_password + day-1 jlist P1, joined at v1.44) remains
  future-gated; auto-merge-live.yml disposition and PE #62 ownership
  remain on the owed ledger.

## s6 Register hygiene

- Mints no FD. Tail: FD-61 at open, FD-61 at close.
- Closes: s4.5.2, item 7, item 8, G2, Phase B, F-Deploy-1 keystone.
- Prod-box contact: four SSH invocations (s1), all gated, all
  transcribed. Dev-box contact: one read-only SSM.
- Session artifacts retained locally as evidence: step0-3 transcripts,
  dev-health result, read/step scripts and writers. Not committed;
  transcripts quoted herein are the register record.
- FD-21 check: PR references historical; no closing keywords.
- This revision ships WITH [skip-automerge] (doc-only PR).

---

*End of F-Deploy-1 Fix Plan v1.48.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-22. Predecessor: v1.47 (c5e8fb4c, #946).*
*Closed: s4.5.2, item 7, item 8, G2, Phase B, F-Deploy-1 KEYSTONE.*
*Minted: none. Tail: FD-61. [skip-automerge]*
