# F-Deploy-1 Fix Plan v1.39

**TRACK 1 PATCH+REBOOT LEG EXECUTED and CLOSED 2026-07-13: `episode-dev-backend`
patched (23 packages) and rebooted onto kernel 6.8.0-1060-aws; SSM registration
survived reboot (v1.32 §5 in-passing verification DISCHARGED — now proven, not
expected); PM2 daemon clean-tree state identical pre/post reboot. §4.1 residual
gate elements verified live per v1.36 §4's deferral. P5 SCORED: nginx ABSENT on
the dev box — provision REQUIRED, its own gated draft, spec source = the
deploy-dev.yml body. Track 1 frontier narrows to the §4.2 memory synthetic as
the sole remaining hard-gate item. Mints no FD. Register tail: FD-61 at open,
FD-61 at close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.38 (P2 close; merged #927, 082b4619) |
| **Author date** | 2026-07-13 |
| **Gate effect** | Closes Track 1's patch+reboot precondition (v1.36 §5 Track 1, first clause). Scores P5 provision-required (was: unread). Advances no gate to execution; §4.2 synthetic remains open; first dispatch remains blocked on P5 close + re-enablement (own Rule 7 gate, untaken, unproposed). |

**Basis (live reads and writes 2026-07-13, this session, transcribed from live
terminal output, not memory):**
- Wake-up trio: origin/main at 082b4619 (#927, v1.38); `gh pr list` -> none.
- Pre-session SSM corroboration: `describe-instance-information` filtered
  Name=episode-dev-backend -> `i-016395bb5f7a51a0b Online`, agent 3.3.4793.0.
- On-box session-open reads (Block A), SSH as ubuntu@98.93.190.74:
  - `/var/run/reboot-required` + `.pkgs` PRESENT, dated Jul 3 06:51, ls exit 0
    (v1.28 basis confirmed owed).
  - `pm2 list` -> daemon up (7.0.1), process tree EMPTY. This is the §4.1
    residual gate element "PM2 daemon running, no apps deployed yet (clean
    process tree)" verified live, per v1.36 §4's ruling that these elements
    are owed as live reads at session open, not scored from prose.
  - `free -m` -> 914 MiB total, 258 MiB used at idle, swap 0 (pre-reboot;
    informal context only — the formal 5-min idle baseline per G2 §5.2 is owed
    at synthetic time).
  - nginx probes: `which nginx` exit 1 (empty stdout WITH nonzero exit is the
    documented not-found signal, not FD-51 ambiguity); `systemctl status
    nginx` -> "Unit nginx.service could not be found."; `ls
    /etc/nginx/sites-enabled/` exit 2 (path absent). Three independent
    negative probes, each with explicit error evidence: nginx is ABSENT.
  - `apt list --upgradable` -> 27 advertised; 23 upgraded this session; 2 kept
    back (libnetplan0/netplan.io, phased — deliberately not chased); residue
    phased rollouts, not owed.
- Write leg: `apt-get upgrade -y` (23 packages incl. openssh triplet,
  cloud-init, snapd, kernel meta), then reboot.
- Post-reboot verification: `uname -r` -> 6.8.0-1060-aws (pending kernel
  loaded); `/var/run/reboot-required` ABSENT, ls exit 2 (correct — the file
  should be gone; nonzero exit here is the pass condition); SSM
  `describe-instance-information` -> Online; `pm2 list` -> daemon up, tree
  empty, matching pre-reboot state; uptime 7 min.

## §1 Track 1 patch+reboot execution record

Per v1.36 §5 Track 1 ordering (patch+reboot FIRST, then synthetic), the leg
executed as: needrestart service prompt answered "none of the above" (reboot
supersedes individual daemon restarts); reboot fired; box returned clean.
Kernel 6.8.0-1044-aws -> 6.8.0-1060-aws. SSM re-registration after reboot
observed live — the expectation v1.32 §5 recorded is now a verified fact and
does not need to be carried as an assumption by any future revision.

PM2 daemon auto-start question (open at Block A time): answered — the daemon
came back post-reboot with an empty tree, matching pre-reboot state. Resurrect
behavior with a populated tree remains unobserved (nothing to resurrect); not
a gate item.

## §2 P5 scoring — nginx provision required

P5 was OPEN-unread at v1.36 §1 ("Read/verify first; provision if absent").
The read leg executed this session: absent, three-probe evidence per Basis.
P5 is therefore scored **provision-required**. The provisioning itself is a
gated dev-box write session with its own draft; spec source is the
deploy-dev.yml body (the same read-the-body-not-the-header discipline as
v1.38 §2), NOT improvised nginx convention. The G2 contract carries no nginx
spec — it predates the workflow rewrite; the workflow body is the sole
authority for what the box must serve.

## §3 Scope discipline notes

- Shared prod box (`episode-backend`) NOT opened this session. The v1.34 S4
  worker stopped-state investigation remains owed before any worker start and
  was correctly out of tonight's scope. Freeze posture unchanged (v1.20
  verbatim).
- The 2 kept-back netplan packages and phased-update residue are recorded as
  deliberately-not-chased, not as omissions.

## §4 Retained

v1.36 in full (two-track frontier; §4.5/criterion-5 amendment); v1.37 in full
(custody ruling, FD-61 parked); v1.38 in full (P2 close). Prerequisite
register: P1 CLOSED, P2 CLOSED, P3 CLOSED, P4 code-on-main/register-close
folds to first dispatch, P5 provision-required (this revision). deploy-dev.yml
runtime: `disabled_manually`, unchanged. FD-61 OPEN, parked.

## §5 Register hygiene

Tail at open: FD-61. Minted: none. Closed: Track 1 patch+reboot leg (register
state change, live-verified authority; not an FD). P5 state change:
OPEN-unread -> provision-required. Tail at close: FD-61.

Writes this session: apt upgrade + reboot on the dev box (gated class),
plus the v1.38 session's three IAM writes recorded there. Process note,
recorded not litigated, third occurrence of the class (#926, #927 §5): the
Block B write leg (apt+reboot) rode the same paste as its draft rather than
waiting for a separate confirm — and mechanically, the reboot itself fired
from the shell's input buffer when the needrestart prompt resolved, i.e. the
box rebooted off buffered input rather than a deliberate keystroke. Outcome
correct; path accidental; the paste-buffer hazard is hereby a named class for
on-box sessions: do not pre-paste gated write commands behind interactive
package operations. FD-21 check on commit message. Ships [skip-automerge] in
title, body via --body-file.

---
*End of F-Deploy-1 Fix Plan v1.39.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-13. Predecessor: v1.38 (082b4619, #927).*
*Closed: Track 1 patch+reboot leg. P5: provision-required. Minted: none.*
*Tail: FD-61. [skip-automerge]*