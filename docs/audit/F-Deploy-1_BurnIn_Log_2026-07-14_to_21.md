# F-Deploy-1 Burn-In Log: 2026-07-14 to 2026-07-21

**Purpose:** Daily observables for the Phase B G2 s4.4 burn-in window (Fix Plan
v1.43: clock started 2026-07-14 ~18:53Z, closes Tuesday 2026-07-21). One dated
entry per day, shipped daily so each entry is certified by its own merge commit.
Cited wholesale by the s4.4 close.

**Boxes:** dev = episode-dev-backend, i-016395bb5f7a51a0b, t3.small,
54.87.253.45 (EIP, address of record, permanent per v1.43 s1). prod =
episode-backend, i-02ae7608c531db485, 54.163.229.144 (FROZEN; CloudWatch
reads only, no box contact).

**Observables per v1.43 s5.4:** dev CPU/memory/disk trend; prod metrics
unchanged; deploy targeting spot-checks; zero F-Deploy-G1-Y recurrences;
timestamps recorded even when clean.

## Runbook (hardened day 1; days 2-7 use this verbatim)

1. Session preamble: `$env:PYTHONUTF8 = "1"` (AWS CLI charmap guard).
2. SSM parameters ALWAYS via JSON file (`--parameters file://...`), never
   inline (PowerShell quoting shreds inline JSON).
3. PM2 read: `pm2 jlist` is BANNED over SSM (dumps full process env
   including credentials -- see Day 1 finding). Use the filtered on-box
   read inside the SSM command:
   `sudo -u ubuntu bash -lc "pm2 jlist" | python3 -c "import json,sys; [print(p['name'], p['pm2_env']['status'], p['pm2_env']['restart_time'], p['pid']) for p in json.load(sys.stdin)]"`
4. Health probe: port 3002 (per deploy-dev.yml), ubuntu-scoped, with
   HTTP code AND exit code echoed: `curl -s -o /dev/null -w HEALTH:%{http_code} http://localhost:3002/health; echo EXIT:$?`
5. No placeholders in any drafted command: every command ships fully
   resolved or opens with a variable assignment. (Day 1: four literal
   placeholder executions -- v1.N, CMD_ID, PORT, PROD-ID. Drafting defect,
   structural fix.)
6. Empty output is not evidence without its exit code (FD-51). A
   CloudWatch query against a wrong instance ID returns empty SILENTLY.
7. G1-Y sweep form: `git log --oneline -10 origin/main` and eyeball for
   un-numbered subjects (squash merges do not appear under --merges).

## Day 1 -- 2026-07-15 (recorded 10:48-11:30 local, 14:48-15:30Z)

**Verdict: GREEN. All s5.4 observables clean. One P1 security disclosure
(measurement-side, not box-side). Three probe artifacts, adjudicated.**

- **Dev box:** up 1 day 1:47 at read (no reboot since pre-deploy boot);
  load 0.00; mem 394-403 / 1910 MB; disk 71% /dev/root (7.6G, 2.3G avail)
  -- day-1 baseline for the week's trend.
- **Dev CPU (CloudWatch, 24h hourly):** ~0.11% pre-deploy, 0.83% bucket at
  the 18:53Z dispatch, steady ~0.42% serving idle since. 0.42% = trend
  baseline.
- **PM2 tree (ubuntu scope):** exists under ubuntu; episode-worker
  confirmed online with DB_SSL=true live in process env (#933 fix
  operating), NODE_ENV=development, canon RDS host as episode_app_dev.
  episode-api status inferred healthy via health probe (direct filtered
  read joins the day-2 runbook).
- **Health:** HEALTH:200 EXIT:0, first attempt, ubuntu-scoped, port 3002
  (SSM command 5c1e1724, executed 15:11:34Z).
- **Prod (CloudWatch only, box untouched):** CPU flat 0.49-0.59% across
  24h INCLUDING both of yesterday's dispatch windows; single 0.82% bucket
  at 05:16 local, cron-shaped, within noise. Prod unchanged: CONFIRMED.
- **Deploy targeting:** gh run list shows nothing since run 29359414179
  (green, 07-14); prior failed run 29357042127 known (DB_SSL finding);
  older entries are pre-disable dev-push history. Clean.
- **F-Deploy-G1-Y:** zero recurrences. HEAD 1d5ffe31 = numbered PR (#935);
  zero open PRs; recent subjects all carry PR numbers.

### Day 1 finding (P1): pm2 jlist env disclosure over SSM

Dispatch three (SSM command 3cca8331, 15:08Z) ran `pm2 jlist` under sudo
to work around PM2's box-drawing characters breaking the Windows read
channel. jlist dumps FULL process env: the dev DB credential
(episode_app_dev on canon RDS) was disclosed in cleartext into the
session transcript and a local result file. Same mechanism-class as the
07-04 transcript disclosure (standing P1 precedent).

- **Adjudication: P1, not P0.** Dev-scoped app credential, not canon
  master; RDS SG admits 5432 only from the EIP rule + three legacy rules
  (v1.43 s1 end-state); credential alone does not reach the DB from the
  internet.
- **Disposition:** rotation owed at a future gated window -- NOT mid-burn-in
  (rotation touches the pm2-env-carried model the burn-in is validating;
  AllStopped rotation-collision lesson). Joins the owed-P1 ledger beside
  the canon db_password rotation; candidate for the same window.
- **Containment done day 1:** local result file destroyed; jlist banned
  over SSM (runbook item 3); filtered read substituted.
- **Cause:** drafting error in this session's tooling (jlist substituted
  for a rendering problem without flagging its env-dump behavior).

### Day 1 artifacts (adjudicated, not findings)

- Probes against port 3001 (HEALTH:000 EXIT:7): wrong-port guess; nothing
  was ever meant to listen there. Retroactively artifact once
  deploy-dev.yml established 3002.
- Dispatch three health leg (HEALTH:000 EXIT:0 on a literal-PORT URL):
  void under FD-51 -- quoting mangle, evidence of nothing.
- Root-scope pm2 reads returned empty table / []: SSM runs as root; the
  tree lives under ubuntu. Empty != absent.

### Day 1 residue (owed)

- **Root PM2 daemon:** dispatch one's `pm2 ls` as root SPAWNED an empty
  root-scope PM2 daemon (read with a write side effect). Cleanup = one
  `pm2 kill` as root via SSM. Drafted, UNRATIFIED; may ride any daily or
  the window close.

## Day 2 -- 2026-07-16 (recorded 14:13-14:30 local, 18:13-18:30Z)

**Verdict: GREEN. All s5.4 observables clean. Zero findings. Filtered
PM2 read (runbook item 3) proven in service: both apps read without env
disclosure.**

- **Dev box:** up 2 days 5:10 (no reboot); load 0.00; mem 432/1910 MB;
  disk 71% (stable vs day 1).
- **PM2 (filtered read):** episode-worker online restart_time=1;
  episode-api online restart_time=1 -- both frozen at heal values.
- **Health:** HEALTH:200 EXIT:0 (SSM 354fa340, 18:15:41Z).
- **Dev CPU:** flat ~0.42% across 24h, on baseline.
- **Prod (CloudWatch only):** 0.49-0.59% baseline; cron-shaped bumps
  0.80 (23:17 local), 1.10 (01:17), 0.75 (10:17). 1.10 = week max,
  noted-not-finding; watch only if the 01:17 bump grows day over day.
- **Targeting:** nothing since run 29359414179. Clean.
- **F-Deploy-G1-Y:** zero. Ten most recent subjects all numbered PRs;
  zero open PRs. HEAD 251db9da (#936).
- **Trio note:** one transient GitHub connection reset at session open;
  cleared on retry, TCP verified. No impact.
- **route53-primepisodes.json identified (day-1 ledger item):** read-only
  snapshot of the live zone (list-resource-record-sets output). Confirms
  the A record aliases to ALB primepisodes-alb-1912818060, not the prod
  box directly. Reproducible via one CLI read -- no backup owed;
  disposition rides with cutover planning.
- **Residue unchanged:** root PM2 daemon kill still drafted/unratified.
## Day 3 -- 2026-07-17 (recorded 18:30-18:45 local, 22:30-22:45Z)

**Verdict: GREEN. All s5.4 observables clean. Zero findings. Third
consecutive green day.**

- **Dev box:** up 3 days 9:25 (no reboot); load 0.14/0.04/0.01
  (momentary, = our own SSM dispatch); mem 417/1910 MB; disk 71%
  (flat, day 3 of 3).
- **PM2 (filtered read):** episode-worker online restart_time=1;
  episode-api online restart_time=1 -- frozen at heal values, day 3.
- **Health:** HEALTH:200 EXIT:0 (SSM 957a8722, 22:30:59Z).
- **Dev CPU:** flat ~0.42%; one 1.02% bucket ~01:31 local -- overnight
  cron-shaped, same slot as prod's nightly bump; noted, not a finding.
- **Prod (CloudWatch only):** 0.49-0.53% baseline (mild +0.04pp drift in
  back half, within noise, day 4 confirms); bumps 0.81 (01:17 slot) and
  0.72. **Day-2 watch retired:** 01:17 bump SHRANK (1.10 -> 0.81), not
  grew.
- **Targeting:** nothing since run 29359414179. Clean.
- **F-Deploy-G1-Y:** zero. Five most recent subjects all numbered PRs;
  zero open PRs. HEAD d9e6cffe (#937).
- **Procedural artifact (drafting-side):** one placeholder fetch executed
  (PASTE-FULL-UUID) before the real UUID was substituted; re-fetched
  correctly, no data lost. Runbook amendment 3 minted: fetch commands
  are drafted only AFTER the UUID exists -- never pre-staged with a
  placeholder.
- **Runbook amendments 1-2 (day-2 close, recorded here):** certify reads
  must show the pattern on screen -- an exit code alone certifies nothing;
  sync = pull + confirm new HEAD hash -- checkout's "up to date" is a
  stale-ref statement, never sync confirmation.
- **Residue unchanged:** root PM2 daemon kill drafted/unratified.