# F-Deploy-1 Fix Plan v1.44

**s4.4 BURN-IN CLOSED CLEAN 2026-07-21: seven-calendar-day window
(2026-07-14 ~18:53Z -> 2026-07-21) adjudicated against the burn-in log
at cd2e2df7 (#940), entries certified by merge commits #936-#940. Zero
findings against either box across the window. s4.5 (PM2 retirement)
now blocked on s7.3 ONLY. Root-PM2-daemon kill RATIFIED this revision.
Mints no FD. Register tail: FD-61 at open, FD-61 at close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.43 (s4.3 closed, burn-in clock started). |
| **Author date** | 2026-07-21 |
| **Gate effect** | s4.4 CLOSED. s4.5 unblocks to s7.3-only per v1.43 gate line. Advances no other gate; authorizes no prod-box action. |

**Basis (live reads 2026-07-21, this session):** trio (main at cd2e2df7,
zero open PRs); day-7 SSM dispatch 016d3e88 (uptime 6d22:25, restarts
1/1, disk 71%, HEALTH:200 EXIT:0); 72h CloudWatch backfill both boxes;
gh run list (targeting frozen at 29359414179); burn-in log full body at
cd2e2df7.

## s1 s4.4 adjudication -- CLOSED CLEAN

The v1.43 s4.4 window ran its seven calendar days. Evidence, cited
wholesale from the burn-in log (docs/audit/F-Deploy-1_BurnIn_Log_
2026-07-14_to_21.md at cd2e2df7):

- **7/7 days metric-observed** (CloudWatch, both boxes, hourly, no gaps
  in the metric stream): dev 0.39-0.42% settling downward; prod
  0.49-0.56% with a benign plateau step, dead flat Sat-Tue.
- **5/7 days probe-observed** (SSM: days 1-4, 7). Days 5-6 gap DISCLOSED
  in the log's day-7 entry and BOUNDED: day-7 cumulative counters
  (uptime continuous since pre-deploy boot; restart counts frozen at
  heal values) retroactively exclude reboot and app-crash across the
  entire window including the gap.
- **Health 200 on every probe-observed day, 5 of 5.** Disk flat at 71%
  all week. Deploy targeting frozen at run 29359414179 all week. Zero
  F-Deploy-G1-Y recurrences all week.
- **Two watches raised in-window, both investigated and retired benign**
  (dev 01:30 cron bucket: noise; prod micro-drift: plateau, not trend).
- **One measurement-side P1** (day-1 jlist env disclosure) -- against the
  observation tooling, not the boxes; contained same-day; disposition
  at s3 below. Does not impair the window: the s5.4 observables it
  touched were re-read clean via the substituted filtered form.

**Ruling: s4.4 CLOSED CLEAN.** The close is taken with the gap named in
the ruling itself -- 5/7 probe coverage bounded by cumulative state is
the evidentiary basis, stated, not smoothed.

## s2 What the close unblocks

Per v1.43's gate line, s4.5 (PM2 retirement on the shared box) was
blocked on s7.3 clean close AND s4.4. s4.4 is closed; **s4.5 is now
blocked on s7.3 only.** No s4.5 action is taken or authorized by this
revision.

## s3 Residue dispositions

- **Root PM2 daemon kill: RATIFIED (Rule 7, this revision).** Day-1
  read side effect (root-scope pm2 ls spawned an empty daemon). One SSM
  write, dev box, root scope: `pm2 kill`. Executes post-merge of this
  revision; execution evidence files to the session record. Zero risk
  to the ubuntu-scope serving tree (separate pm2_home).
- **Day-1 jlist P1 (dev DB credential, episode_app_dev):** formally
  joined to the standing canon db_password rotation item -- ONE gated
  rotation window covers both. Window remains future-gated; not owed
  before s4.5/s7.3 work by default, schedulable at maintainer ruling.
- **auto-merge-live.yml:** still parked untracked at repo root (backed
  up 07-09); disposition unchanged -- rides with the Auto-merge to Dev
  re-enable ruling, which nobody owes yet (v1.43 s5 standing state).
- **route53-primepisodes.json:** identified (burn-in log day 2) as a
  reproducible read snapshot; rides with cutover planning; no register
  action.

## s4 Register hygiene

- Mints no FD: the close is an execution outcome under an existing gate,
  not a finding (v1.43 precedent). Tail: FD-61 at open, FD-61 at close.
- Closes no findings. FD-45 tail and carried items unchanged.
- Doc-only revision except the s3 ratified kill, which is a dev-box
  write executed post-merge under this revision's authority.
- FD-21 check: PR references herein (#936-#940) historical; no closing
  keywords. Ships with [skip-automerge].

---

*End of F-Deploy-1 Fix Plan v1.44.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-21. Predecessor: v1.43.*
*Closed: s4.4 (gate). Minted: none. [skip-automerge]*