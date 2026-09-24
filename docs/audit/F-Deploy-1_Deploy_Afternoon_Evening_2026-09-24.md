| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Eight production deploys on the afternoon and evening of 2026-09-24, all performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-24.md`. This document follows that one rather
than editing it. Basis: `origin/main` at
`b0274fd61bbc626f4990ebb92bd6c0c1f016b1eb`, measured 2026-09-24. That
basis is the tree Deploy W (§10) moved production to.

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Two standings appear below, each marked on its own claim and
never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production
  host or database states. It cannot be reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce.

This document closes no keystone, discharges no owed item, mints no FD,
XK or PE number, and rules on nothing.

The deploys are lettered P–W, continuing after Deploys J–O of
`F-Deploy-1_Deploy_2026-09-24.md`.

**The count is eight, not seven.** The issue that asked for this record
(#1802) states seven deploys in its goal and in its identity line. P
through W is eight: P, Q, R, S, T, U, V, W. Each has its own section
below (§3–§10). The count is corrected here rather than inherited.

## §1. Identity — Deploys P, Q, R, S, T, U, V and W

**ATTESTED.**
- Instance `i-02ae7608c531db485`; tree `~/episode-metadata`.
- `git status` showed only the four known untracked `.bak` files. That
  matches `F-Deploy-1_Deploy_2026-09-24.md` §1 and the records it cites.
- `episode-worker` was stopped throughout all eight deploys.
- No package or migration change appeared in any of the eight.

**MEASURED.** None of the eight commit ranges below (§3–§10) touches
`src/migrations/`, `package.json` or `package-lock.json`. For each
range, `git diff --name-only <from> <to> -- src/migrations package.json
package-lock.json` printed nothing.

## §2. Continuity

**MEASURED.** Production has no unrecorded range between Deploy O and
Deploy P, or between any two deploys recorded here:
- Deploy O ends at `b4624e92db1dc1a085d569954dc8379e2468dda0`
  (`F-Deploy-1_Deploy_2026-09-24.md` §8).
- Deploy P begins there (§3), and each of Q–W begins at the tree the
  deploy before it ended at (§4–§10).
- `git merge-base --is-ancestor b4624e92d b0274fd61` succeeds.

**ATTESTED.** The restart counts below (§5–§10) continue from Deploy N's
24 → 25 with no step between. Deploys O, P and Q made no restart.

## §3. Deploy P — 2026-09-24, after 14:08 UTC, frontend only

**ATTESTED.**
- Evoni moved the tree from `b4624e92db1dc1a085d569954dc8379e2468dda0`
  to `6a4760753083f75198460007c72d970f28e838ca`: two commits, no backend
  `src/` files, no API restart.
- Backup `pre1781`.
- The served entry changed from `index-Bdf2LqYp.js` to
  `index-_NUvpHVy.js`. HTTP 200.
- The time is not measured. It is recorded as after 14:08 UTC, the merge
  of #1781.

**MEASURED**, `git log --oneline b4624e92d..6a4760753`:

```
6a4760753 feat(frontend): set category and format in the Event Package [skip-automerge] (#1781)
1dde24d2a docs: read what the old event editor still owns [skip-automerge] (#1779)
```

Two commits (`git rev-list --count`: `2`), matching Evoni's count. PRs
#1779, #1781. `git diff --stat`, scoped to `src/`: no output. Outside
`src/`, the range touches five files under `frontend/src/`, one test file
under `tests/unit/`, and `docs/EVENT_EDITOR_REMOVAL_READ.md`.

## §4. Deploy Q — 2026-09-24 ~15:30 UTC, frontend only

**ATTESTED.**
- Evoni moved the tree from `6a4760753083f75198460007c72d970f28e838ca`
  to `37ea16de2a60daad64ce55b1c69ae45e137b2f1a`: three commits, no
  backend `src/` files, no API restart.
- Backup `pre1787`.
- The served entry changed from `index-_NUvpHVy.js` to
  `index-CoY934T1.js`. HTTP 200.
- Afterwards, five older bundle backups were deleted by explicit name,
  leaving six. Disk usage went from 90% to 89%.

**MEASURED**, `git log --oneline 6a4760753..37ea16de2`:

```
37ea16de2 fix(frontend): the old editor sends only what changed [skip-automerge] (#1787)
d47ac2c60 docs(audit): read which model validations the world_events writes bypass [skip-automerge] (#1785)
380a2b2b6 docs(audit): file the 2026-09-24 deploy record [skip-automerge] (#1783)
```

Three commits (`git rev-list --count`: `3`), matching Evoni's count. PRs
#1783, #1785, #1787. `git diff --stat`, scoped to `src/`: no output.
Outside `src/`, the range touches three files under `frontend/src/` and
adds two register documents:
`docs/audit/F-Deploy-1_Deploy_2026-09-24.md` and
`docs/audit/ValidationBypass_WorldEvents_Read_MEASURED_2026-09-24.md`.

- **The backup deletion** is not visible from a clone. It has no
  MEASURED clause. Its figures (five deleted, six left, 90% to 89%) are
  the same as those `F-Deploy-1_Deploy_2026-09-24.md` §5 records for
  Deploy L. They are recorded here as given; this record does not say
  whether the two are separate deletions with the same figures.

## §5. Deploy R — 2026-09-24 ~15:43 UTC, backend and frontend

**ATTESTED.**
- Evoni moved the tree from `37ea16de2a60daad64ce55b1c69ae45e137b2f1a`
  to `7d6f227ac07936e9e923e80b58f8b59d102d6e77`: one commit, two backend
  files, including the new `src/utils/eventVersion.js`.
- `node -c` passed on both. The utility loaded with seven exports.
- Backup `pre1789`.
- The served entry changed from `index-CoY934T1.js` to
  `index-CRVm3GHZ.js`.
- `pm2 restart`: restart count 25 → 26. `/health` returned 200.

**MEASURED**, `git log --oneline 37ea16de2..7d6f227ac`:

```
7d6f227ac fix(routes): refuse a stale event save [skip-automerge] (#1789)
```

One commit, PR #1789. `git diff --stat`, scoped to `src/`:

```
 src/routes/worldEvents.js | 52 +++++++++++++++++++++++++++---
 src/utils/eventVersion.js | 82 +++++++++++++++++++++++++++++++++++++++++++++++
 2 files changed, 129 insertions(+), 5 deletions(-)
```

- **Two files**, matching Evoni's count. `git diff --name-only
  --diff-filter=A` over the range, scoped to `src/`, lists exactly
  `src/utils/eventVersion.js`.
- **Seven exports.** `eventVersion.js` at `7d6f227ac` opens its
  `module.exports` at line 74 and lists seven names:
  `EXPECTED_VERSION_KEY`, `STALE_SAVE_CODE`, `STALE_SAVE_MESSAGE`,
  `toVersionMs`, `parseExpectedVersion`, `versionMatches` and
  `staleSaveBody`. That matches Evoni's count.
- **Outside `src/`**, the range touches four files under `frontend/src/`
  and two test files under `tests/unit/`. The `frontend/` change is
  consistent with the changed served entry.

## §6. Deploy S — 2026-09-24 ~16:33 UTC, backend and frontend

**ATTESTED.**
- Evoni moved the tree from `7d6f227ac07936e9e923e80b58f8b59d102d6e77`
  to `e95cc7db3074f107eb7ca09a3ea470d3c656b27f`: two commits, nine
  backend files, including the new `src/utils/eventOrganizer.js`.
- `node -c` passed on all nine. The utility loaded
  (`eventCreatorOrganizer`, `isOrganizedByProfile`).
- Backup `pre1794`.
- The served entry changed from `index-CRVm3GHZ.js` to
  `index-OEXK9K-Z.js`.
- `pm2 restart`: restart count 26 → 27. `/health` returned 200.

**MEASURED**, `git log --oneline 7d6f227ac..e95cc7db3`:

```
e95cc7db3 fix(frontend): define Spinner in the profile detail panel [skip-automerge] (#1794)
3a735c83f fix(services): read the event organizer from its own field [skip-automerge] (#1792)
```

Two commits (`git rev-list --count`: `2`), matching Evoni's count. PRs
#1792, #1794. `git diff --stat`, scoped to `src/`:

```
 src/routes/worldEvents.js                  |  7 +--
 src/services/characterSyncService.js       | 18 +++++---
 src/services/episodeGeneratorService.js    |  8 ++--
 src/services/episodeScriptWriterService.js |  3 +-
 src/services/feedActivityService.js        | 30 +++++++++---
 src/services/socialChecklistService.js     | 10 ++--
 src/services/storyGenerationService.js     |  5 +-
 src/services/todoListService.js            |  9 ++--
 src/utils/eventOrganizer.js                | 73 ++++++++++++++++++++++++++++++
 9 files changed, 133 insertions(+), 30 deletions(-)
```

- **Nine files**, matching Evoni's count. `git diff --name-only
  --diff-filter=A` over the range, scoped to `src/`, lists exactly
  `src/utils/eventOrganizer.js`.
- **The utility's exports.** `eventOrganizer.js` at `e95cc7db3` line 73
  reads `module.exports = { eventCreatorOrganizer, isOrganizedByProfile };`.
- **Outside `src/`**, the range touches six files under `frontend/src/`
  and two test files under `tests/unit/`.

## §7. Deploy T — 2026-09-24 ~17:05 UTC, backend and frontend

**ATTESTED.**
- Evoni moved the tree from `e95cc7db3074f107eb7ca09a3ea470d3c656b27f`
  to `751f137aace420507fc2a46ea257e9913ca758e6`: one commit, one backend
  file.
- `node -c` passed.
- Backup `pre1795` (5.9M).
- The served entry changed from `index-OEXK9K-Z.js` to
  `index-DIe2soaR.js`.
- `pm2 restart`: restart count 27 → 28. `/health` returned 200.

**MEASURED**, `git log --oneline e95cc7db3..751f137aa`:

```
751f137aa fix(routes): starting an event from the Feed no longer picks the organizer [skip-automerge] (#1795)
```

One commit, PR #1795. `git diff --stat`, scoped to `src/`:

```
 src/routes/worldEvents.js | 44 ++++++++++++++++++++++++++++++++------------
 1 file changed, 32 insertions(+), 12 deletions(-)
```

One file, matching Evoni's count. Outside `src/`, the range touches six
files under `frontend/src/` and three test files under `tests/unit/`.

## §8. Deploy U — 2026-09-24, after 17:17 UTC, backend only

**ATTESTED.**
- Evoni moved the tree from `751f137aace420507fc2a46ea257e9913ca758e6`
  to `a9576a5cf28f49a333f30cd1e33525114853f225`: one commit, one backend
  file.
- `node -c` passed.
- No frontend build and no bundle backup, because no frontend file
  changed.
- `pm2 restart`: restart count 28 → 29. `/health` returned 200.

**The time.** The draft of #1802 gave ~17:45 UTC. Evoni reported this
deploy before that time, so a clock time is not recorded. It is recorded
as after 17:17 UTC, the merge of #1798.

**MEASURED**, `git log --oneline 751f137aa..a9576a5cf`:

```
a9576a5cf fix(services): opportunity-pipeline guests exclude JustAWoman and real-world profiles [skip-automerge] (#1798)
```

One commit, PR #1798. `git diff --stat`, scoped to `src/`:

```
 src/services/feedEventPipelineService.js | 8 ++++++++
 1 file changed, 8 insertions(+)
```

One file, matching Evoni's count. Outside `src/`, the range touches one
test file under `tests/unit/` and nothing under `frontend/`. That is
consistent with no frontend build.

## §9. Deploy V — 2026-09-24, after 17:30 UTC, backend only

**ATTESTED.**
- Evoni moved the tree from `a9576a5cf28f49a333f30cd1e33525114853f225`
  to `b6fc0005e1bb084431d98ac461a16a74fb608ed3`: one commit, one backend
  file.
- `node -c` passed on `eventAutomationService.js`.
- No frontend build and no bundle backup.
- `pm2 restart`: restart count 29 → 30. `/health` returned 200.

**The time.** The draft of #1802 gave ~18:15 UTC, which was later than
the time #1802 itself was filed (17:45 UTC). A clock time is not
recorded. It is recorded as after 17:30 UTC, the merge of #1799.

**MEASURED**, `git log --oneline a9576a5cf..b6fc0005e`:

```
b6fc0005e fix(services): guest selection scores choose the guests [skip-automerge] (#1799)
```

One commit, PR #1799. `git diff --stat`, scoped to `src/`:

```
 src/services/eventAutomationService.js | 96 ++++++++++++++++++++++------------
 1 file changed, 62 insertions(+), 34 deletions(-)
```

One file, matching Evoni's count. Outside `src/`, the range touches one
test file under `tests/unit/` and nothing under `frontend/`.

## §10. Deploy W — 2026-09-24, after 17:40 UTC, backend only

**ATTESTED.**
- Evoni moved the tree from `b6fc0005e1bb084431d98ac461a16a74fb608ed3`
  to `b0274fd61bbc626f4990ebb92bd6c0c1f016b1eb`: one commit, one backend
  file.
- `node -c` passed.
- No frontend build and no bundle backup.
- `pm2 restart`: restart count 30 → 31. `/health` returned 200.

**The time.** The draft of #1802 gave ~18:50 UTC, which was later than
the time #1802 was filed. A clock time is not recorded. It is recorded
as after 17:40 UTC, the merge of #1801.

**MEASURED**, `git log --oneline b6fc0005e..b0274fd61`:

```
b0274fd61 fix(services): both guest-selection stages apply the same eligibility rules [skip-automerge] (#1801)
```

One commit, PR #1801. `git diff --stat`, scoped to `src/`:

```
 src/services/eventAutomationService.js | 53 ++++++++++++++++++++++------------
 1 file changed, 34 insertions(+), 19 deletions(-)
```

One file, matching Evoni's count. Outside `src/`, the range touches one
test file under `tests/unit/` and nothing under `frontend/`.

**After Deploy W**, production's tree is this record's basis. No commit
on `origin/main` at the basis is undeployed.

## §11. Database reads — facts Evoni obtained, not ruled on

**ATTESTED (Evoni).** Read-only queries, run personally during these
deploys. Recorded as the results she obtained. This record does not rule
on what any of them means.

- **`storyteller_memories`:** 218 rows with 13 distinct `type` values.
  Every value is inside the model's 15-value list; none is outside it.
- **`world_events`, organizer homes:** no event has a `source_profile_id`
  that disagrees with its automation host copy, and none has a
  `source_profile_id` without that copy. Both counts were zero. This
  was run before #1792 merged, as that change's step 5.
- **Event guests:**
  - No event has JustAWoman as a guest.
  - One event, "Brand Creative Director Meeting", has two
    real-world-layer guests. It is not used in any episode.
  - A follow-up query showed both guest entries carry `featured` and
    `story_role` keys and no `relationship` key.

**MEASURED**, only as far as the code the guest result can be compared
with:
- `addGuestFromFeed` in `frontend/src/pages/EventPackagePage.jsx` writes
  `{ profile_id, handle, display_name, featured: true, story_role: null }`
  and no `relationship` key.
- `assembleGuestList` in `src/services/eventAutomationService.js` writes
  a `relationship` key on every guest it adds.

That is consistent with Evoni's reading that both guests were added
through the Add from Feed picker. It does not establish it; no data is
re-derived here.

## §12. Related, by citation only — not re-derived, not ruled on

**The records this one follows.** `F-Deploy-1_Deploy_2026-09-24.md`
(filed by #1783, itself carried by Deploy Q), and through it the earlier
records it cites. None is edited here.

**The filed reads these deploys carried.** Each pairing is MEASURED only
to this extent: the deployed change's own added lines cite the read by
name. Found by `git show <commit> -- src frontend/src`, grepping added
lines for `docs/` paths and `§` references. What each read holds is not
restated here, and no read is thereby discharged.

| Change | Deploy | Read it cites |
|---|---|---|
| #1787 | Q | `docs/EVENT_EDITOR_REMOVAL_READ.md` (filed by #1779, Deploy P); `docs/EVENT_EPISODE_FLOW.md` §8(p) |
| #1792 | S | `docs/EVENT_EPISODE_FLOW.md` §8(p) |
| #1795 | T | `docs/EVENT_EPISODE_FLOW.md` §8(p), §8(r) |

- **No read citation found** in the added lines of #1781, #1789, #1794,
  #1798, #1799 or #1801. They are listed in §3–§10 and not paired here.
- **#1779, #1783 and #1785** are documents, not code:
  `docs/EVENT_EDITOR_REMOVAL_READ.md`, `F-Deploy-1_Deploy_2026-09-24.md`
  and `ValidationBypass_WorldEvents_Read_MEASURED_2026-09-24.md`.

## §13. Observations — not findings, not ruled on

- **ATTESTED (Evoni).** `POST /api/v1/social-profiles/:id/regenerate`
  returned 500 in the browser (profile 444). Neither the error log nor
  the out log records it: the out log's regenerate entries were wardrobe
  thumbnails and scanner probes.
  - No cause is established here, and the route is not read here.

None of the observations above is characterized as a defect, ruled on,
or assigned an owner in this document.

## §14. What this document does not do

This document:

- does not restate or re-verify any read cited in §12, and discharges
  none of them. A change shipping is not a ruling that a read's question
  is closed;
- does not rule on what any database result in §11 means, and
  re-derives no production data;
- does not establish a cause for the observation in §13;
- does not discharge any owed item recorded in `PROJECT_CONTEXT.md` §6.5
  or any Fix Plan revision;
- makes no fix, and mints no FD, XK or PE number;
- amends no filed document. Every document named above is cited, not
  edited;
- performs no deploy, database read or change, or credential change of
  its own, and makes no host, AWS, database or Cognito contact. Every
  ATTESTED claim above is Evoni's own account, taken outside any agent
  session. Every MEASURED claim is a repository read this filing session
  performed itself, against `origin/main`, not against any host;
- records no secret anywhere above.

## §15. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from `F-Deploy-1_Deploy_2026-09-24.md` §13. Nothing minted
here.

## §Standing

- §1 and §3–§10 each carry an ATTESTED clause and a MEASURED clause,
  marked separately and never merged into one standing:
  - ATTESTED: Evoni's own account of actions taken personally on the
    production host, not reproducible from a clone;
  - MEASURED: a read of this repository, reproducible by anyone with a
    clone.
- The times of Deploys P, U, V and W are bounds measured from each PR's
  merge on `origin/main`, not clock times. The times of Q, R, S and T are
  Evoni's approximations, each later than its merge.
- §2 carries a MEASURED continuity check and an ATTESTED restart-count
  continuity.
- §11 is ATTESTED for the database results. Its MEASURED clause reads
  only the code, never the data.
- §12 carries no standing beyond the citations and reads it names.
- §13 marks its observation's standing on the observation.
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1).
  Agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`), unchanged by that lift or by this record.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1802.*
