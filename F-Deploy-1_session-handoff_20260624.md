# F-Deploy-1 — Session Handoff Note (2026-06-24, warm session)
# STATUS: scratch / uncommitted. NOT canon. NOT for #856. Cold session: re-validate live.

> **CURRENCY BANNER (added 2026-06-25).** This is a warm scratch handoff committed for provenance. Several STATUS facts below are SUPERSEDED by 06-25 merges: FD-42/FD-41/note-851 ARE now on main (PR #856 merged); the CloudTrail events are captured in the committed REDACTED evidence (#863). The LIVE CARRY from this note is **Finding 2** (v1.15 Sec 3 understates the post-06-23 rotation + the in-memory-only claim -- pending a v1.16 supersede) and **Finding 3** (the SSM-only propagate alternate path + the load-bearing "does the running app authenticate canon" probe -- pending addition to the branch runbook). Re-validate all else live.
## Why this exists
A warm session worked the credential blocker. It is binary-disqualified from
priming [3]. These are findings to INHERIT, each to be re-verified against
origin/main + live AWS by the cold session. Do not treat as closed.

## Verified live this session
- HEAD: 13002465 (matches [3] cold-entry allow-list, PR #854)
- Fix Plan v1.15 IS on main. FD-42 / FD-41 / note-851: NOT on main (FD-42 only in OPEN #856).
- CloudTrail (canon = episode-control-dev, confirmed by IP/VPC not name):
  password-state changes since 06-15 SSM baseline:
    06-20 19:16 evoni-admin CLI  — manual password set
    06-23 19:37 root console MFA — manageMasterUserPassword:true (managed; secret 'creating')
    06-23 19:46 root console MFA — masterUserPassword set + manageMasterUserPassword:false (back to manual)
  => SSM is stale by MORE than v1.15 accounts for. Current canon value = unknown
     to both parties (HIDDEN in CloudTrail; not recoverable from logs).

## Findings to carry
1. FALSE CIRCULARITY KILLED. The "only working cred is in pm2 id-3's in-memory
   pool" claim is UNPROVEN, not foundational. The 06-23 pair postdates §3's
   evidence basis (§3 authored 06-22).

2. §3 SUPERSEDE IDENTIFIED (for a v1.16 revision, which mints the next FD —
   NOT an addendum drop, NOT via #856). v1.15 §3 understates two items:
   - "Post-06-20 canon password value — not established" → should read post-06-23 19:46
   - "Only working credential in running app's in-memory pool" → unsupported once
     06-23 rotations are in scope.

3. CONDITIONAL ALTERNATE PATH — UNEVALUATED, NOT shown viable.
   IF the on-box pool is shown to authenticate against canon (UNTESTED this
   session — this is the load-bearing open question), THEN an SSM-only propagate
   (ssm put-parameter, NO modify-db-instance) MAY avoid a DB credential change.
   §3 never evaluated this (predates 06-23 data).
   FIRST ACTION for cold [3]: run the read-only auth probe (does the running app
   authenticate against canon, and with what) BEFORE choosing this path vs §3's
   modify-db-instance direction. Do not assume either path until probed.

4. VEHICLE: #856 is OPEN/unmerged — wrong place to extend. Next finding mints in
   a v1.16 Fix Plan revision per additive-supersede convention.

## Discipline notes
- This session is WARM and CANNOT prime [3]. Cold session required.
- No shared-state change made. Box still FROZEN. No probe run.
- Wake-up trio for cold session: git fetch / git log origin/main / gh pr list --state open.
