| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Six production deploys on 2026-09-24 and one production data change (the `episode_wardrobe` cleanup), all performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_Afternoon_Evening_2026-09-23.md`. This document
follows that one rather than editing it. Basis: `origin/main` at
`6a4760753083f75198460007c72d970f28e838ca`, measured 2026-09-24. That
basis is two commits past the tree Deploy O (§8) moved production to
(§10).

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

The deploys are lettered J–O, continuing after Deploys E–I of
`F-Deploy-1_Deploy_Afternoon_Evening_2026-09-23.md`.

## §1. Identity — Deploys J, K, L, M, N and O

**ATTESTED.**
- Instance `i-02ae7608c531db485`; tree `~/episode-metadata`.
- `git status` showed only the four known untracked `.bak` files. That
  matches the standing observation in
  `F-Deploy-1_Deploy_Afternoon_Evening_2026-09-23.md` §1 and the records
  it cites.
- `episode-worker` was stopped throughout all six deploys.
- No package or migration change appeared in any of the six.

**MEASURED.** None of the six commit ranges below (§3–§8) touches
`src/migrations/`, `package.json` or `package-lock.json`. For each
range, `git diff --name-only <from> <to> -- src/migrations package.json
package-lock.json` printed nothing.

## §2. Continuity

**MEASURED.** Production has no unrecorded range between Deploy I and
Deploy J, or between any two deploys recorded here:
- Deploy I ends at `04686b39d3a3e9bba6a8f861f7d81777556eda23`
  (`F-Deploy-1_Deploy_Afternoon_Evening_2026-09-23.md` §7).
- Deploy J begins there (§3), and each of K–O begins at the tree the
  deploy before it ended at (§4–§8).
- `git merge-base --is-ancestor 04686b39d3a3e9bba6a8f861f7d81777556eda23
  af799b27` succeeds.

**ATTESTED.** The restart counts below (§3, §5, §6, §7) continue from
Deploy I's 20 → 21 with no step between. Deploys K and O made no
restart.

## §3. Deploy J — 2026-09-24 ~00:47 UTC, backend and frontend

**ATTESTED.**
- Evoni moved the tree from `04686b39d3a3e9bba6a8f861f7d81777556eda23`
  to `af799b27a429cb122e7556353a3a51a793180020`: five commits, nine
  backend files, including two new utilities.
- `node -c` passed on all nine. Both utilities loaded.
- Backup `pre1760`.
- The served entry changed from `index-DkYUGq4O.js` to
  `index-CftclGkR.js`.
- `pm2 restart`: restart count 21 → 22. `/health` returned 200.
- The SSH session dropped after the merge. It was reconnected with no
  loss.

**MEASURED**, `git log --oneline 04686b39d..af799b27a`:

```
af799b27a docs(audit): file the projected-versus-canonical difficulty decision [skip-automerge] (#1760)
9770a5be6 fix(services): stop saving derived event values at creation [skip-automerge] (#1758)
8620f7824 feat(frontend): Event Package basics with accepted suggestions [skip-automerge] (#1756)
b10be9340 docs(audit): file the 2026-09-23 afternoon and evening deploy record [skip-automerge] (#1754)
d1c5f50af fix(routes): refuse a second episode from one event [skip-automerge] (#1752)
```

Five commits (`git rev-list --count` over the range: `5`), matching
Evoni's count. PRs #1752, #1754, #1756, #1758, #1760. `git diff --stat`
over the range, scoped to `src/`:

```
 src/routes/calendarRoutes.js             |  18 +++++-
 src/routes/eventGeneratorRoute.js        |  10 ++-
 src/routes/worldEvents.js                | 104 ++++++++++++++++++++++---------
 src/services/careerPipelineService.js    |  10 ++-
 src/services/episodeGeneratorService.js  |  20 +++---
 src/services/eventAutomationService.js   |  17 ++---
 src/services/feedEventPipelineService.js |  39 ++++++++----
 src/utils/eventDateDefault.js            |  68 ++++++++++++++++++++
 src/utils/eventEpisodeLink.js            |  73 ++++++++++++++++++++++
 9 files changed, 293 insertions(+), 66 deletions(-)
```

- **Nine files**, matching Evoni's count. `git diff --name-only
  --diff-filter=A` over the range, scoped to `src/`, lists exactly the
  two new utilities: `src/utils/eventDateDefault.js` and
  `src/utils/eventEpisodeLink.js`.
- **The utilities' exports** at `af799b27`:
  - `eventDateDefault.js` line 68 reads `module.exports = {
    AUTO_SCHEDULE_DAYS, AUTO_DATE_KEY, autoScheduledEventDate,
    withAutoScheduledDate };`.
  - `eventEpisodeLink.js` opens its `module.exports` at line 67.
- **Outside `src/`**, the range touches:
  - `docs/audit/F-Deploy-1_Deploy_Afternoon_Evening_2026-09-23.md` and
    `docs/audit/F-Stats-1_EventDifficulty_ProjectedVsCanonical_Decision_2026-09-24.md`,
    both added;
  - four files under `frontend/src/`;
  - four test files under `tests/unit/`.

  The `frontend/` change is consistent with the changed served entry.

## §4. Deploy K — 2026-09-24 ~01:55 UTC, frontend only

**ATTESTED.**
- Evoni moved the tree from `af799b27a429cb122e7556353a3a51a793180020`
  to `8f1e78313949f7ad6bd50e1dd89b491637322f87`: two commits, no backend
  files, no API restart.
- Backup `pre1764`.
- The served entry changed from `index-CftclGkR.js` to
  `index-fqfKsQs-.js`. HTTP 200.

**MEASURED**, `git log --oneline af799b27a..8f1e78313`:

```
8f1e78313 refactor(frontend): Events tab leads with the queue [skip-automerge] (#1764)
4cce9bbaa feat(frontend): choose an organizer in the Event Package [skip-automerge] (#1762)
```

Two commits (`git rev-list --count`: `2`), matching Evoni's count. PRs
#1762, #1764. `git diff --stat`, scoped to `src/`: no output. The range
changes six files, all under `frontend/src/`.

## §5. Deploy L — 2026-09-24 ~03:10 UTC, backend

**ATTESTED.**
- Evoni moved the tree from `8f1e78313949f7ad6bd50e1dd89b491637322f87`
  to `4d0d8f80118d0ca766b73af3b6e566d80ef8652e`: one commit, one backend
  file.
- `node -c` passed.
- Backup `pre1766`.
- The served entry was unchanged at `index-fqfKsQs-.js`.
- `pm2 restart`: restart count 22 → 23. `/health` returned 200.
- Afterwards, five older bundle backups were deleted by explicit name,
  leaving six. Disk usage went from 90% to 89%.

**MEASURED**, `git log --oneline 8f1e78313..4d0d8f801`:

```
4d0d8f801 fix(routes): a sponsor is not an organizer [skip-automerge] (#1766)
```

One commit, PR #1766. `git diff --stat`, scoped to `src/`:

```
 src/routes/worldEvents.js | 25 +++++++++++++++++++++----
 1 file changed, 21 insertions(+), 4 deletions(-)
```

- **One file**, matching Evoni's count.
- **Outside `src/`**, the range touches two test files under
  `tests/unit/` and nothing under `frontend/`. That is consistent with
  the unchanged served entry.
- **The backup deletion** is not visible from a clone. It has no
  MEASURED clause.

## §6. Deploy M — 2026-09-24 ~12:30 UTC, backend and frontend

**ATTESTED.**
- Evoni moved the tree from `4d0d8f80118d0ca766b73af3b6e566d80ef8652e`
  to `28f759c590c8339aa0e95197d8b0fe64ff15bd38`: three commits, one
  backend file.
- `node -c` passed.
- Backup `pre1770`.
- The served entry changed from `index-fqfKsQs-.js` to
  `index-CLNrlbQu.js`.
- `pm2 restart`: restart count 23 → 24. `/health` returned 200.

**MEASURED**, `git log --oneline 4d0d8f801..28f759c59`:

```
28f759c59 docs(flow): record deliverables versus the social package [skip-automerge] (#1773)
7a0882506 feat(frontend): show wardrobe processing state [skip-automerge] (#1770)
99ce408cb docs(flow): record the four event roles [skip-automerge] (#1768)
```

Three commits (`git rev-list --count`: `3`), matching Evoni's count.
PRs #1768, #1770, #1773. `git diff --stat`, scoped to `src/`:

```
 src/controllers/wardrobeController.js | 9 +++++++--
 1 file changed, 7 insertions(+), 2 deletions(-)
```

One file, matching Evoni's count. Outside `src/`, the range touches
`docs/EVENT_EPISODE_FLOW.md`, six files under `frontend/src/` and one
test file under `tests/unit/`. The `frontend/` change is consistent with
the changed served entry.

## §7. Deploy N — 2026-09-24 ~12:55 UTC, backend and frontend

**ATTESTED.**
- Evoni moved the tree from `28f759c590c8339aa0e95197d8b0fe64ff15bd38`
  to `5a0581380210d10756f9f6ec5ee1a5f511b9691a`: one commit, one backend
  file.
- `node -c` passed.
- Backup `pre1774`.
- The served entry changed from `index-CLNrlbQu.js` to
  `index-BiiUlJXi.js`.
- `pm2 restart`: restart count 24 → 25. `/health` returned 200.

**MEASURED**, `git log --oneline 28f759c59..5a0581380`:

```
5a0581380 feat(frontend): Event Package stakes and money [skip-automerge] (#1774)
```

One commit, PR #1774. `git diff --stat`, scoped to `src/`:

```
 src/services/eventAutomationService.js | 33 ++++++++++++++++++++++++++++++---
 1 file changed, 30 insertions(+), 3 deletions(-)
```

One file, matching Evoni's count. Outside `src/`, the range touches four
files under `frontend/src/` and one test file under `tests/unit/`.

## §8. Deploy O — 2026-09-24 ~14:10 UTC, frontend only

**ATTESTED.**
- Evoni moved the tree from `5a0581380210d10756f9f6ec5ee1a5f511b9691a`
  to `b4624e92db1dc1a085d569954dc8379e2468dda0`: one commit, no backend
  files, no API restart.
- Backup `pre1776`.
- The served entry changed from `index-BiiUlJXi.js` to
  `index-Bdf2LqYp.js`. HTTP 200.

**MEASURED**, `git log --oneline 5a0581380..b4624e92d`:

```
b4624e92d refactor(frontend): readiness by Event Package section [skip-automerge] (#1776)
```

One commit, PR #1776. `git diff --stat`, scoped to `src/`: no output.
The range changes nine files, all under `frontend/src/`.

## §9. Data change — 2026-09-24 ~11:00 UTC, `episode_wardrobe` cleanup

**ATTESTED (Evoni).** Made with `psql` as the application user, on
`episode_metadata`, over SSL.
- **Before.** `episode_wardrobe` held 21 rows. All 21 pointed at
  episodes that no longer existed or were soft-deleted.
- **Change.** In one transaction, those 21 rows were deleted
  (`DELETE 21`), and the count was verified as 0 before commit. No
  rollback record was kept. The rows referenced episodes that no longer
  exist.
- **Why.** The wardrobe delete route refuses to delete an item used in
  an episode. Eight items could not be deleted because of links to
  episodes that were gone.
- **Read at the same time:**
  - `wardrobe.tags` is `data_type` `ARRAY` of `_text`.
  - All 40 wardrobe items were created within 140 milliseconds on
    2026-02-19, which is the seed route.
  - The error log begins on 09-18 and contains no "malformed array
    literal" since then.

**MEASURED**, only as far as the code the change was made around. This
is a repository read; it re-derives nothing about production data:
- **The route refuses linked items.** `deleteWardrobeItem` in
  `src/controllers/wardrobeController.js` (lines 798–810 at this basis)
  counts `EpisodeWardrobe` rows by `wardrobe_id` alone. It does not check
  whether the linked episode exists or is soft-deleted. When the count
  is above zero and `?force=true` is not passed, it returns 400 with
  `error: 'Cannot delete item'` and a `message` naming the episode count.
- **That branch writes nothing to the log.** It has no `console.error`,
  which is consistent with Evoni's account of a 400 with nothing in the
  error log (§11).

No other clause of this section is visible from a clone.

## §10. Related, by citation only — not re-derived, not ruled on

**The records this one follows.**
`F-Deploy-1_Deploy_Afternoon_Evening_2026-09-23.md` (filed by #1754,
itself carried by Deploy J), and through it
`F-Deploy-1_Deploy_2026-09-23.md` and the earlier records it cites. None
is edited here.

**The filed reads these deploys carried.** Each pairing is MEASURED only
to this extent: the deployed change's own added lines cite the read by
name. Found by `git show <commit> -- src frontend/src`, grepping added
lines for `docs/` paths and `§` references. What each read holds is not
restated here, and no read is thereby discharged.

| Change | Deploy | Read it cites |
|---|---|---|
| #1752 | J | `docs/EVENT_EPISODE_FLOW.md` (outside `docs/audit/`) |
| #1762 | K | `docs/EVENT_EPISODE_FLOW.md` §8(p) |
| #1764 | K | `docs/EVENT_EPISODE_FLOW.md` §8(m) |
| #1774 | N | `docs/audit/F-Stats-1_EventDifficulty_ProjectedVsCanonical_Decision_2026-09-24.md` (filed by #1760, Deploy J) |
| #1776 | O | `docs/EVENT_EPISODE_FLOW.md` §8(p), §8(m) |

- **No read citation found** in the added lines of #1756, #1758, #1766
  or #1770. They are listed in §3–§6 and not paired here.
- **#1768 and #1773** change `docs/EVENT_EPISODE_FLOW.md` itself.

**Not deployed by any deploy recorded here.** `origin/main` at this
record's basis holds two commits past Deploy O's tree:

```
$ git log --oneline b4624e92d..6a4760753
6a4760753 feat(frontend): set category and format in the Event Package [skip-automerge] (#1781)
1dde24d2a docs: read what the old event editor still owns [skip-automerge] (#1779)
```

#1781 changes five files under `frontend/src/` and adds one test under
`tests/unit/`; it changes nothing under `src/`. It is not live in
production as of this record.

## §11. Observations — not findings, not ruled on

- **ATTESTED (Evoni).** A wardrobe upload succeeded, and its tags were
  stored. It was the first since the type mismatch was fixed.
  - MEASURED: that fix (#1745) went live in Deploy I
    (`F-Deploy-1_Deploy_Afternoon_Evening_2026-09-23.md` §7 and §10).
  - No cause is established here beyond the citation.
- **ATTESTED (Evoni).** Deleting wardrobe items returned 400, with
  nothing in the error log. Evoni attributes this to the route refusing
  items linked to episodes, and to the frontend discarding the server's
  message.
  - MEASURED, consistent with that account and not establishing it:
    - The route branch in §9 returns 400 without logging.
    - The WorldAdmin Wardrobe handler `deleteWardrobeItem` (in
      `frontend/src/pages/WorldAdmin.jsx`) shows
      `err.response?.data?.error`, the bare "Cannot delete item". It does
      not show the `message` that names the episode count.
  - Other delete surfaces were not read.
  - No cause is ruled here.
- **ATTESTED (Evoni).** 151 "Not allowed by CORS" entries were sampled.
  They are anonymous asset requests from an outside IP, not the
  application. This is the same count
  `F-Deploy-1_Deploy_Afternoon_Evening_2026-09-23.md` §10 records. No
  cause is established here.

None of the observations above is characterized as a defect, ruled on,
or assigned an owner in this document.

## §12. What this document does not do

This document:

- does not restate or re-verify any read cited in §10, and discharges
  none of them. A change shipping is not a ruling that a read's question
  is closed;
- does not establish a cause for any observation in §11;
- does not re-derive the production data in §9. The row counts, the
  column type and the creation times are Evoni's account;
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

## §13. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from `F-Deploy-1_Deploy_Afternoon_Evening_2026-09-23.md` §12.
Nothing minted here.

## §Standing

- §1 and §3–§8 each carry an ATTESTED clause and a MEASURED clause,
  marked separately and never merged into one standing:
  - ATTESTED: Evoni's own account of actions taken personally on the
    production host, not reproducible from a clone;
  - MEASURED: a read of this repository, reproducible by anyone with a
    clone.
- §2 carries a MEASURED continuity check and an ATTESTED restart-count
  continuity.
- §9 is ATTESTED for the data change. Its MEASURED clause reads only
  the code, never the data.
- §10 carries no standing beyond the citations and reads it names.
- §11 marks each observation's standing on the observation.
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1).
  Agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`), unchanged by that lift or by this record.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1782.*
