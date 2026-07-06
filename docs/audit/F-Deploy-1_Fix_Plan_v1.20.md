# F-Deploy-1 Fix Plan — v1.20 (2026-07-06)

Formal revision. Supersedes v1.19''s FD register only as stated below;
all other v1.19 content stands. Basis: FD-38 execution, pm2 save, and
FD-45 re-digest, all recorded in
Audit_Handoff_Delta_2026-07-06_FD38_save.md (same PR).

## FD register (authoritative as of this revision)

- FD-31 — CLOSED by this revision. Restart-to-align + save. All six
  legs of the v1.19 close sequence complete: (a) id-4 quarantined
  (07-05); (b) id-0 cluster-vs-config reconciled, root cause fixed
  (07-06); (c) topology started by name from live config (07-06,
  id-10); (d) FD-38 gate executed all-green (07-06); (e) pm2 save
  executed (07-06 00:54:41Z); (f) FD-45 re-digest complete (07-06).
- FD-38 — CLOSED by this revision. Single-execution gate; executed
  all-green 07-06 against ratified v1.19 text. Its condition set
  remains the template for any future pre-save gate.
- FD-42, FD-43 — OPEN, unchanged.
- FD-44 — OPEN. Leg (a) PROVEN (ratified v1.19); leg (b) remains open.
- FD-45 — OPEN (tail only). Re-digest lifecycle step complete per the
  07-06 delta. Remaining scope: credential-at-rest surface remediation
  (dump.pm2 + retained backup dump.pm2.bak-0624-preFD38). Backup
  disposition decided at FD-45 close.

## [3] window disposition

The restart-to-align thread of the id-3/[3] combined window is COMPLETE:
credential branch resolved (07-04), realign root-caused and fixed
(07-05/07-06), gate ratified then executed, save landed, resurrect
state verified. Remaining F-Deploy-1 scope proceeds under FD-42/43/44(b)
and the FD-45 tail per the Fix Plan; freeze posture for prod actions
outside ratified gates is unchanged.

## Carried items (restated, unchanged from v1.19)

1. Prod block exec_mode pin — deferred, future gated edit.
2. /home/ubuntu/episode-metadata-parallel/ residue — removal decision
   pending.
3. Frontend IA audit and remainder of keystone sequence — unchanged.

*Closed: FD-31, FD-38. Open: FD-42, FD-43, FD-44(b), FD-45 tail.
Minted: none. [skip-automerge]*