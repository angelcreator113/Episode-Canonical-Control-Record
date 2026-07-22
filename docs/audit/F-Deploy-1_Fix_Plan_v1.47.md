# F-Deploy-1 Fix Plan v1.47

**s4.5.2 PLANNED 2026-07-21: the Rule 7 planning session mandated by v1.46
executed cold and closed. Live prod-box read (one read-only SSH contact,
ubuntu-scope, disclosed in s2) reconciled the retirement target against
the box: the sole target is `episode-api` (the dev posture). The
worker-name collision hazard resolved in the OPPOSITE direction from the
paper risk -- `episode-worker` on the shared box is a PROD-manifest app
(stopped) and is EXCLUDED from retirement. Transport adjudicated: SSM
rejected (InvalidInstanceId, cause traced to F-Deploy-G1-AD); execution
proceeds over SSH per Implementation v1.4 s4.5.2 step 1's original
letter. Three maintainer rulings ratified (s3). Execution remains gated
in its own future window per the plan at s4. Mints no FD. Register tail:
FD-61 at open and close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.46 (s4.5.1 closed true; s4.5.2 gated on this planning session). |
| **Author date** | 2026-07-21 |
| **Gate effect** | s4.5.2 PLANNED. Execution authorized ONLY per the s4 plan, in its own gated window, on explicit maintainer confirm at each Rule 7 boundary. No prod-box write taken or authorized by this revision. |

**Basis (live, this session):** wake-up trio at c7fc5926 (#945); Fix Plan
v1.44/v1.45/v1.46 full-trail reads; Implementation v1.4 s4.5.2 + s6.4 +
s8 spec text; burn-in log window-close section; SSM
describe-instance-information (prod absent, dev i-016395bb5f7a51a0b
Online); EC2 IP-anchored identity (i-02ae7608c531db485 <->
54.163.229.144); prod-box read transcript `ssm_452_read_result.txt` via
script `ssm_452_read.sh` (certified NO_BOM / LF_ONLY pre-contact).

## s1 Transport adjudication -- SSM to SSH

FD-57's SSM supersession binds only boxes SSM can reach. SendCommand
against i-02ae7608c531db485 returned InvalidInstanceId ("Instances not
in a valid state for account"); describe-instance-information confirms
the prod box is absent from SSM inventory while the dev box is Online.
Causal trace: F-Deploy-G1-AD (Implementation v1.4 s9.7) -- the prod box
runs with IamInstanceProfile null, so the SSM agent cannot register.
Ruling: s4.5.2 executes over SSH with `episode-prod-key` per
Implementation v1.4 s4.5.2 step 1's original letter. Attaching an
instance profile to enable SSM is REFUSED here: that is AD's resolution,
sequenced post-G2, and would itself be a config mutation on the FROZEN
box. AD's resolution scope gains a note: it also restores SSM
manageability.

Execution mechanics inherited from this session's proven pattern:
commands ship as a local script written via Python (LF endings, no BOM,
byte-certified before contact), piped over a single
`ssh ... "bash -s" < script` invocation hosted under `cmd /c` (PowerShell
reserves `<`), output captured to a local transcript file.

## s2 Target reconciliation -- the live read

One read-only SSH contact was made this session (ubuntu-scope, zero
writes, zero sudo; script and transcript filed as `ssm_452_read.sh` /
`ssm_452_read_result.txt`). Naming retains the ssm_ prefix for
session-artifact continuity despite the transport change; the transport
is SSH.

Live process table (jlist, filtered fields):

| App | Namespace | Status | restart_time | cwd |
|---|---|---|---|---|
| episode-worker | default | stopped | 4 | /home/ubuntu/episode-metadata |
| episode-api | default | online | 0 | /home/ubuntu/episode-metadata |
| episode-api-prod-hotfix | default | online | 0 | /home/ubuntu/episode-metadata |

dump.pm2 carries all three (dev api would resurrect on daemon restart).
On-disk manifests: `/home/ubuntu/episode-metadata/ecosystem.config.js`
(Jul 6, pre-split -- still defines the dev entry) and an inert copy at
`/home/ubuntu/episode-metadata-parallel/ecosystem.config.js` (Jun 23).
Baseline load: up 122 days, load 0.00, mem 501/1910 MB used, swap 0.

**Worker-collision ruling (hazard raised at planning open):** the
post-split root manifest (v1.46 s3) defines `episode-worker` as a PROD
app. Exactly one `episode-worker` exists on the box and it matches the
prod definition. It is NOT a dev app and is EXCLUDED from retirement.
The paper hazard inverts: the risk was never stopping the wrong worker;
it was that a "*-dev substance" sweep drafted from paper might have
classified the worker as dev and deleted a prod-manifest app. The live
read forbids that. FD-28's true retirement set on this box is exactly
one app: **episode-api**.

## s3 Maintainer rulings (Rule 7, ratified this revision)

1. **episode-worker: UNTOUCHED.** Stopped-state (restart_time 4, box up
   122 days) filed as an observation for the G2 close note (item 8).
   Whether prod needs its worker running is a pre-existing condition
   outside s4.5.2 scope. Any action on it would be an unratified prod
   mutation.
2. **On-disk manifest: LEFT IN PLACE.** `pm2 save` closes the automatic
   resurrection path (dump rewrite). The residual manual-replay hazard
   (a human running `pm2 start ecosystem.config.js` would re-create the
   dev entry) is carried as a NAMED RIDER: reconcile the shared box's
   on-disk manifest with the repo's post-split root config at the next
   prod deploy touch. Not silent. Same pattern as v1.46's dev-box rider.
3. **v1.46 dev-box cleanup rider: EXCLUDED from s4.5.2.** The stale
   ecosystem.config.js in the DEV box's deployed tree stays on "next
   deploy touch." s4.5.2 remains single-box; the campaign's final prod
   write does not expand across boxes.

## s4 Execution plan (future gated window; every step a Rule 7 boundary)

**Entry conditions:** cold or cold-adjacent session; wake-up trio; this
revision merged to main; explicit maintainer confirm to open the window.

**Step 0 -- pre-write gate (read-only).** Re-run the s2 read script
verbatim. Baseline match required: exactly 3 apps, statuses and cwds as
the s2 table. ANY drift (app added/removed, status change on prod-hotfix
or worker, cwd change) = ABORT, re-plan against the new state. An
`episode-api` status change alone is evaluated (stopped dev api still
retires; a missing dev api means someone else acted -- investigate).

**Step 1 -- stop.** `pm2 stop episode-api`. Then verify: prod health 200
(item-7 endpoint), `episode-api-prod-hotfix` still online via filtered
jlist. Fail either check = ABORT: `pm2 start episode-api` restores the
exact prior state (dump untouched); file incident note.

**Step 2 -- delete.** `pm2 delete episode-api`. Re-verify: health 200,
prod-hotfix online. Fail = ABORT: `pm2 resurrect` restores all three
apps from the still-untouched dump; file incident note.

**Step 3 -- point of no return: save.** `pm2 save`. This is the LAST
write. After it, s6.4 applies (no planned rollback; rebuild is
incident-response). Every abort path above sits before this line.

**Step 4 -- post-write gate (read-only).** Filtered jlist: prod-hotfix
online, worker stopped, zero episode-api. Dump re-read: no episode-api
entry. Dual-health (item 7): prod endpoint 200 AND dev-box endpoint 200
(dev checked via SSM per standing runbook -- dev IS SSM-managed).
`uptime` + `free -m` vs the s2 baseline: no regression; modest memory
reduction expected and lawful.

**Step 5 -- evidence.** Full transcript to a result file; files with the
next Fix Plan revision, which records s4.5.2 CLOSED and carries item 8
(G2 close note: s4.2 memory observations, FD-27 confirm-or-revise, the
worker-stopped observation, both manifest riders, DEV_EC2_HOST secret
disposition per s4.6).

**Gate criterion (Implementation v1.4 s4.5 overall):** satisfied when
Step 4 passes -- shared box hosts only prod-manifest apps, dump
persisted, no load regression, s4.5.1 already closed (v1.46).

## s5 Observations filed (no action)

- Prod worker stopped for an unknown duration inside a 122-day uptime;
  restart_time 4. To G2 close note.
- Both on-disk manifests pre-date the v1.46 split; riders per s3.
- dump.pm2 resurrect hazard confirmed live; closed by Step 3.
- The 122-day uptime itself certifies the FROZEN posture held.

## s6 Register hygiene

- Mints no FD. Tail: FD-61 at open, FD-61 at close.
- Closes no gates; PLANS s4.5.2. Execution closes it in the successor.
- Prod-box contact this session: ONE read-only SSH invocation (s2),
  zero writes. An additional inert local parse error (PowerShell `<`
  rejection) and one inert missing-file cmd invocation occurred before
  contact; neither launched ssh. Disclosed.
- One process note: the Block B invocation was run once ahead of its
  confirm; it was inert (input file absent, ssh never spawned) and the
  gate was re-asserted before actual contact. Disclosed per Rule 7.
- FD-21 check: PR references historical; no closing keywords.
- This revision ships WITH [skip-automerge] (doc-only PR).

---

*End of F-Deploy-1 Fix Plan v1.47.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-21. Predecessor: v1.46.*
*Closed: none (planning). Minted: none. Tail: FD-61. [skip-automerge]*
