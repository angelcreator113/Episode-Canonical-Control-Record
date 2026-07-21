# F-Deploy-1 Fix Plan v1.46

**s4.5.1 CLOSED TRUE 2026-07-21: repo-side ecosystem config split shipped
(PR #943, 1844e56b, six files), exercised end-to-end by verification
dispatch run 29841468909 (all jobs green), and box-confirmed (SSM
a8606673: apps online, health 200, ecosystem.dev.config.js deployed
14:59Z). Adjudicated SUBSTANTIVELY, not by the *-dev letter: the root
config's episode-api entry (port 3002, Development) WAS the shared-box
dev posture FD-28 retires; trivial satisfaction was available by the
spec's literal glob and REFUSED. G2 s8 items 1-4 and 6 now satisfied.
Remaining to keystone close: s4.5.2 (prod-box write, own cold session),
item 7, item 8. Mints no FD. Register tail: FD-61 at open and close.**

| | |
|---|---|
| **Predecessor** | Fix Plan v1.45 (4024be3d, #942; s7.3 closed clean, s4.5 unblocked). |
| **Author date** | 2026-07-21 |
| **Gate effect** | s4.5.1 CLOSED TRUE. s4.5.2 next-executable, gated on its own Rule 7 planning session. No prod-box action taken or authorized. |

**Basis (live, this session):** Implementation v1.4 s4.5.1 text; committed
ecosystem.config.js full read; deploy-dev.yml RF-1 comment block;
scripts/check-asset-cols.js and check-dev-schema2.js full reads; PR #943
(commit 1844e56b, merged, four checks green); verification dispatch run
29841468909 (test/build/deploy all success); SSM a8606673 box confirm;
executable certifies via node loads of both manifests from merged main.

## s1 The adjudication -- letter vs substance

Implementation v1.4 s4.5.1 step 1 searches for configs defining "*-dev
apps." Literally: none exist -- trivial satisfaction was available. The
committed root config's third entry (name episode-api, PORT 3002,
APP_NAME "...(Development)", dev CORS origins, comment "DEV app...serves
dev.primepisodes.com") IS the config-side definition of the shared-box
dev posture. The naming-reality gap (v1.43: the box's dev pair was never
*-dev-named) explains the divergence: the spec's glob is a carried v1.3
assumption. Ruling: closing on the letter would certify the spec's
assumption over the repo's facts -- refused. s4.5.1 executed as a real
change.

## s2 RF-1 symmetry -- the design rationale

deploy-dev.yml's RF-1 comment (v1.31) documents the mirror hazard: on
the dev box, an unscoped startOrRestart of the shared config would
materialize the PROD entry. s4.5.1's hazard is the same knife's other
edge: on the shared box, the dev entry could replay post-retirement.
RF-1 itself disclaims --only as "config hygiene, not shared-box
exclusion." The split closes both edges structurally: root manifest =
episode-api-prod-hotfix + episode-worker only; dev manifest =
episode-api + episode-worker only, ZERO env_production blocks (a
prod-env block in the dev manifest would be a loaded gun for --env
production on the dev box -- struck at ratification). --only RETAINED in
the workflow as hygiene per RF-1. Neither box can materialize the
other's process from its own manifest.

## s3 The package as shipped (PR #943, six files)

1. ecosystem.config.js -- dev entry removed (24 deletions); prod-hotfix
   + worker byte-unchanged. Executable certify: apps.length 2.
2. ecosystem.dev.config.js -- NEW; dev api + worker; no env_production
   anywhere. Executable certify: two apps, apps[0].env.PORT 3002,
   env_production count 0.
3. .github/workflows/deploy-dev.yml -- three filename repoints (artifact
   cp, extract list, restore startOrRestart); RF-1 comment revised to
   state the split; --only retained verbatim.
4. scripts/check-dev-schema2.js -- repointed (correctness: apps[0] must
   be the dev entry).
5. scripts/check-asset-cols.js -- repointed (clarity only; behaviorally
   inert -- sharedEnv DB values identical across entries).
6. scripts/check-root-junk.js -- ALLOWED_ROOT gains the new manifest.
   The pre-commit guard BLOCKED the first commit attempt (unregistered
   root file), its designed behavior; its own message prescribed this
   fix. Guard functioned as built; the block and remedy are the audit
   trail. (The blocked attempt also produced one empty-branch push and
   one failed PR create -- both inert, disclosed.)

Ships WITHOUT [skip-automerge] per Implementation v1.4 s9.5, decision
documented in the PR body as the spec requires. Auto-merge to Dev
remains runtime-disabled; no automerge behavior was exercised.

## s4 Gate evidence -- merge + dispatch + box

- **Merge:** #943 squashed to main as 1844e56b, four checks green.
  Executable certify from merged main: ROOT two apps / DEV two apps /
  dev PORT 3002.
- **Verification dispatch:** run 29841468909 on 1844e56b -- test 1m50s,
  build 2m11s, deploy 47s, all success. The three repoints exercised
  end-to-end on the real box.
- **Box confirm (SSM a8606673, 15:01Z):** episode-worker online 2,
  episode-api online 2 (restart counts +1 = the deploy's own deliberate
  restart, lawful per s7.3's exclusion -- NOT a burn-in-baseline
  violation), HEALTH:200 EXIT:0, ecosystem.dev.config.js on disk
  timestamped 14:59Z Jul 21.
- **Residue named:** the OLD ecosystem.config.js lingers in the deployed
  tree (Jul 14 18:52, inert -- no reference remains). Cleanup rider:
  remove at s4.5.2 or next deploy touch. Not silent.

## s5 Distance to G2 close (s8, Implementation v1.4)

Items 1-4: satisfied (v1.44/v1.45). Item 6: satisfied (this revision).
Remaining: **s4.5.2** (shared-box PM2 retirement -- prod-box write, full
Rule 7, its own cold session), **item 7** (dual-health verification),
**item 8** (G2 close note carrying s4.2 memory observations + FD-27
confirm-or-revise). Hazards carried forward by name for the s4.5.2
planning session: (a) naming-reality gap -- the shared box's dev posture
is episode-api/episode-worker in the default namespace, NOT *-dev-named;
the spec's "for each *-dev app" glob matches nothing there and the true
retirement target must be reconciled against the box's live pm2 list
before any stop command is drafted; (b) s6.4 -- post-s4.5.2 there is no
planned rollback; (c) the shared box's on-disk manifest state is
unreconciled with the repo's new split.

## s6 Register hygiene

- Mints no FD. Tail: FD-61 at open, FD-61 at close.
- Closes s4.5.1 (gate). Closes no findings.
- Code revision (repo + workflow); zero prod-box contact; dev-box
  contact = the verification deploy + one read-only SSM confirm.
- FD-21 check: PR references (#943) historical; no closing keywords.
- This revision ships WITH [skip-automerge] (doc-only PR).

---

*End of F-Deploy-1 Fix Plan v1.46.*
*Author: Claude, with JustAWomanInHerPrime (JAWIHP) / Evoni.*
*Date: 2026-07-21. Predecessor: v1.45 (4024be3d, #942).*
*Closed: s4.5.1 (gate). Minted: none. Tail: FD-61. [skip-automerge]*