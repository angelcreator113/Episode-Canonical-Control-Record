# F-Deploy-1 Fix Plan — v1.19 (2026-07-06)

Formal revision. Supersedes v1.18's FD register only as stated below; all
other v1.18 content stands. Ratifies the sequence drafted in
F-Deploy-1_Fix_Plan_v1.19_NOTES.md. Incorporates the 07-04 and 07-05 window
records and the 07-06 session (exec_mode + NODE_ENV config edits).

## FD register (authoritative as of this revision)

- FD-31 — OPEN. Restart-to-align + save. Close sequence per NOTES (a)–(f):
  (a) id-4 identified/quarantined — DONE 07-05; (b) id-0 cluster-vs-config
  reconciled — DONE 07-06 (root cause fixed: exec_mode absent from dev
  block); (c) intended topology started BY NAME from live config — DONE
  07-06 (id-10); (d) FD-38 gate — PENDING; (e) pm2 save — PENDING;
  (f) FD-45 re-digest — PENDING. FD-31 closes when (e) and (f) complete.
- FD-42, FD-43 — OPEN, unchanged from v1.18.
- FD-44 — OPEN. Leg (a) advanced to PROVEN as of the 07-04 session (per
  Audit_Handoff_Delta_2026-07-04_id3_Window.md and Fix_Plan_v1.19_NOTES.md;
  Branch 4 dissolved). Leg (b) remains open. No other change from v1.18.
- FD-38 — MINTED by this revision. Pre-save integrity gate. Definition
  below. Prior references to FD-38 in the 07-04/07-05 window records and
  the NOTES were forward references to draft numbering; this revision
  ratifies that numbering.
- FD-45 — ADVANCED by this revision (minted by v1.18: dump.pm2
  plaintext-credential-at-rest surface; triage owed, deletion barred
  pending evidentiary read). Evidentiary read COMPLETE (07-04 session);
  deletion-bar LIFTED. Bar language in v1.18 is deletion-only (verified
  live this session across register, disposition block, and footer);
  pm2 save/overwrite was never in the bar's scope — no additional lift
  required for the save. Post-save re-digest conditions (below) are the
  next lifecycle step.

## FD-38 — pre-save integrity gate (conditions)

All verified LIVE on the box immediately before pm2 save, in one sitting:

1. ecosystem.config.js parses (node require) and every app block reports
   intended exec_mode: prod-hotfix UNSET (accepted, deferred — see Carried),
   worker fork, episode-api fork.
2. episode-api (dev) process: mode fork, restarts 0, status online,
   started FROM CONFIG by name.
3. Dev process env: PORT=3002, NODE_ENV=development, DB_HOST=canon RDS
   hostname (episode-control-dev…rds — identity by standing hostname rule).
4. Health: HTTP 200 on localhost:3002/health.
5. Prod (episode-api-prod-hotfix): online, fork, port 3000, restart count
   unchanged from window entry.
6. id-4 absent from registry; no process references
   /home/ubuntu/episode-metadata-parallel/.
7. dump.pm2 pre-image recorded before save: 2026-06-24 03:14:31Z,
   34,266 bytes.
Any condition failing → NO SAVE. Log, stop. Abort is a valid outcome.

## FD-45 — post-save resurrect-state re-digest (conditions; next lifecycle
step of the FD minted in v1.18)

1. pm2 save executed; new dump.pm2 mtime/size recorded.
2. Dump contents digested: exactly three procs — episode-api (fork, 3002,
   dev env), episode-api-prod-hotfix (fork, 3000), episode-worker (fork).
3. Verify how the stopped worker is represented in the dump and record
   whether resurrect would restore it stopped or started. If started:
   assess and record before any reboot relies on the dump.
4. Old dump: 06-24 baseline superseded; backup copy retained (cp before
   save) for forensic reference. NOTE: backup inherits the FD-45
   credential-at-rest property — record its path; disposition follows
   FD-45's eventual close, not ad-hoc deletion.
5. Credential-at-rest acknowledgment: the NEW dump.pm2 carries the same
   plaintext-env surface v1.18 flagged. This re-digest records that fact;
   remediation of the surface itself remains FD-45's open tail.

## Session record — 2026-07-06 (this session)

- exec_mode: 'fork' added to episode-api block (diff 137a138; backup
  ecosystem.config.js.bak-20260706). Start-from-config → id-9: fork, ↺0,
  env(32), 200 on 3002. Root cause of id-0 mode drift fixed at source.
- FINDING (closed same session): dev process inherited NODE_ENV=production
  from box .env via sharedEnv — same signature class as id-4. Fixed:
  explicit NODE_ENV: 'development' in dev env block (diff 147a148; backup
  ecosystem.config.js.bak-20260706-b). id-9 deleted; id-10 started from
  config: fork, ↺0, NODE_ENV=development, PORT=3002, 200 on 3002.
- Prod untouched throughout. No pm2 save executed. Freeze held.
- PROCESS FINDING: the phantom-gate condition — two window records and the
  NOTES referenced FD-38 before any ratified revision minted it. Caught at
  the gate, before save. This revision is the correction. Corollary caught
  in draft review: this revision's own first draft misframed FD-45 as a
  mint and omitted FD-44 leg (a) PROVEN — both corrected against a live
  read of v1.18 before ratification. Drafts are verified against ratified
  text, not against notes.
- Process note: one struck command draft was executed from the chat
  transcript (harmless no-op, proven by diff). Convention going forward:
  struck drafts are removed, never left inline.

## Carried items (deferred, each requires its own gated decision)

1. Prod block exec_mode pin (currently UNSET; prod runs fork by accident
   of an earlier explicit start). Protective edit, no effect on running
   process; schedule in a future window.
2. /home/ubuntu/episode-metadata-parallel/ directory + its
   ecosystem.config.js — quarantine residue; removal decision pending.
3. Frontend IA audit and remainder of keystone sequence — unchanged.

*Minted: FD-38. Advanced: FD-44 leg (a) ratified PROVEN; FD-45 to
post-read lifecycle. Closed: none (FD-31 closes on completion of its
sequence). [skip-automerge]*