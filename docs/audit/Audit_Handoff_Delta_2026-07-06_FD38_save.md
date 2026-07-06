# Audit Handoff Delta — 2026-07-06 — FD-38 execution + pm2 save + FD-45 re-digest

Supplements the 07-04 and 07-05 window deltas and Fix Plan v1.19.
Supersedes nothing. Records live reads from the 2026-07-06 session
(same session that ratified v1.19; gate executed AFTER merge, against
ratified text at origin/main ec73e675).

## FD-38 — executed, all 7 conditions GREEN

1. Config parse: prod-hotfix UNSET (accepted/deferred per v1.19 Carried),
   worker fork, episode-api fork. PASS.
2. Registry: id-10 episode-api fork ↺0 online; id-3 prod-hotfix fork ↺0
   online; id-1 worker stopped. PASS.
3. id-10 env: PORT=3002, NODE_ENV=development, DB_HOST=canon RDS hostname
   (episode-control-dev…rds, identity by standing hostname rule). PASS.
4. Health: HTTP 200 on localhost:3002/health. PASS.
5. id-3: online, restarts 0 — unchanged from window entry. PASS.
6. pm2 jlist grep episode-metadata-parallel: count 0 (grep exit 1 =
   no matches = expected state). PASS.
7. dump.pm2 pre-image: 2026-06-24 03:14:31 +0000, 34266 bytes — exact
   match to the recorded pre-image. PASS.

## Backup + save

- Backup taken pre-save: ~/.pm2/dump.pm2.bak-0624-preFD38 — 34266 bytes,
  created 2026-07-06 00:54:33Z. Retained; inherits the FD-45
  credential-at-rest property; disposition follows FD-45 close, not
  ad-hoc deletion.
- pm2 save executed 2026-07-06 00:54:41Z. First save since the 06-27
  incident. Freeze-era dump superseded.

## FD-45 re-digest — all 5 conditions recorded

1. New dump.pm2: mtime 2026-07-06 00:54:41Z, 36032 bytes (grew from
   34266 — consistent with id-10 entering the snapshot).
2. Digest: exactly 3 procs — episode-api (fork, 3002, dev env, online),
   episode-api-prod-hotfix (fork, 3000, online), episode-worker (fork,
   stopped).
3. Worker representation in dump: status "stopped" — resurrect restores
   it STOPPED. No finding; expected behavior. A reboot relying on this
   dump is safe with respect to the worker.
4. Old-dump backup path recorded above (see Backup + save).
5. Credential-at-rest acknowledgment: the new dump serializes live env
   including DB_PASSWORD for both online api processes — same surface
   v1.18 flagged at FD-45 mint. No new exposure; recorded as the
   re-digest requires. Remediation remains FD-45's open tail.

## Resulting state

- Registry and config now agree: what runs is what the config specifies,
  and what the dump resurrects is what runs. First time all three align
  since 2026-06-27.
- FD-31 close sequence (a)–(f): ALL COMPLETE. Close eligibility is
  ratified by Fix Plan v1.20 (same PR), per the minting rule — deltas
  record, revisions close.
- Execution-environment note: FD-38/save/re-digest commands were run via
  a remote-shell connector session against the prod box rather than an
  interactive SSH terminal; outputs recorded verbatim. Same box, same
  user, same commands.

*Mints/closes nothing. v1.20 (same PR) closes FD-31. [skip-automerge]*