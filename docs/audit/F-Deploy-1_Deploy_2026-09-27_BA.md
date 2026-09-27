| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy BA, 2026-09-27, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. The Phone Hub opens with a setup guide across the phone's build.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_AZ.md` (the AZ record). This document follows
that one rather than editing it. Basis:
`574cc9117e9f3564559753f21281f4e569753b70` (#2057), the tree Deploy BA moved
production to. `origin/main` at filing is `073e57f8` (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings are marked on each claim and never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production host,
  database or running app states, from her terminal output and screenshots.
  It cannot be reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`show` any clone can reproduce, and register documents
  already merged under `docs/audit/`.
- **INFERRED** marks one reading of the page header in §5.4, and nothing
  else.

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
database host, user id, account number or ARN.

The deploy is lettered BA, continuing after Deploy AZ. It is one of two
records (BA and BB) filed together under Task #2072.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27):**

- Fast-forward `df51d3b8` → `574cc911`. Frontend only: no backend restart,
  no migration. The steps were `DEVELOPMENT_WORKFLOW.md` §7.3's.
- Backup `~/dist.bak-20260927-pre2055`, taken before the build, holding the
  previous entry `index-D9PvZP9y.js`.
- The build succeeded. New entry `index-DTWwk6K3.js`.
- The rsync to `/var/www/html` followed.
- **Live check** (her screenshot): the setup guide at the top of the Phone
  Hub read "Setup 1 of 3 done":
  - Screens: 6, with an image of 6;
  - Icons: 8 placed of 10;
  - Links: 7 of 8 zones have a destination;
  - Content: 0 screens with content zones;
  - Preview: not run yet;
  - "Continue setup →" present.
- Her screenshot also shows the page header reading "16/16 screens ready"
  while there were 6 screens and 10 icons. Recorded in §5.4.

## §1. Identity and continuity

**ATTESTED.** The tree moved from `df51d3b8` to `574cc911` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse df51d3b8 574cc911
df51d3b803704e17efd1686bd3546bcc68a34aee
574cc9117e9f3564559753f21281f4e569753b70
$ git merge-base --is-ancestor df51d3b8 574cc911; echo "exit=$?"
exit=0
```

Deploy AZ ends at `df51d3b8` (AZ record §1, §8); Deploy BA begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent df51d3b8..574cc911
574cc9117 docs(audit): F-Stats-1 reads slice, memories/core.js [skip-automerge] (#2057)
b6a99decc docs(audit): F-Stats-1 reads slice, upgradeRoutes.js [skip-automerge] (#2054)
64a7ec776 feat(phone): a setup guide across the phone's build [skip-automerge] (#2055)
c245c2f48 docs(audit): F-Stats-1 reads slice, franchiseBrainRoutes.js [skip-automerge] (#2051)
fe56d758d docs(context): refresh §6.5 and §10 (part B3) [skip-automerge] (#2049)
cf34e3a6d docs(audit): file deploy records AX–AZ [skip-automerge] (#2047)
$ git diff --name-only df51d3b8 574cc911 -- src frontend/src src/migrations package.json frontend/package.json
frontend/src/components/phone/PhoneSetupGuide.css
frontend/src/components/phone/PhoneSetupGuide.jsx
frontend/src/components/phone/PhoneSetupGuide.test.jsx
frontend/src/pages/UIOverlaysTab.jsx
frontend/src/pages/UIOverlaysTab.setupGuide.test.jsx
frontend/src/pages/UIOverlaysTab.topArea.pinned.test.jsx
$ git diff --name-only df51d3b8 574cc911 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
$ git diff --name-only df51d3b8 574cc911 -- . ':!frontend/src' ':!docs/audit'
PROJECT_CONTEXT.md
```

Six commits: #2047, #2049, #2051, #2054, #2055 and #2057. #2047, #2051,
#2054 and #2057 are register documents only; #2049 is `PROJECT_CONTEXT.md`
only. #2055 carries the code, all under `frontend/src`:
`PhoneSetupGuide.jsx` and `PhoneSetupGuide.css` (new), `UIOverlaysTab.jsx`,
and three test files (not served). Nothing under `src/`, no migration file,
no package manifest or lockfile.

**Beside her account.** "Frontend only" agrees with the measurement.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for BA.

**MEASURED.** The newest commit in the range is #2057, 16:57:50 UTC on
2026-09-27, so the deploy followed it:

```
$ git log --first-parent --format="%h %cI %s" df51d3b8..574cc911
574cc9117 2026-09-27T12:57:50-04:00 docs(audit): F-Stats-1 reads slice, memories/core.js [skip-automerge] (#2057)
b6a99decc 2026-09-27T12:47:22-04:00 docs(audit): F-Stats-1 reads slice, upgradeRoutes.js [skip-automerge] (#2054)
64a7ec776 2026-09-27T12:39:47-04:00 feat(phone): a setup guide across the phone's build [skip-automerge] (#2055)
c245c2f48 2026-09-27T12:14:23-04:00 docs(audit): F-Stats-1 reads slice, franchiseBrainRoutes.js [skip-automerge] (#2051)
fe56d758d 2026-09-27T11:52:48-04:00 docs(context): refresh §6.5 and §10 (part B3) [skip-automerge] (#2049)
cf34e3a6d 2026-09-27T11:12:05-04:00 docs(audit): file deploy records AX–AZ [skip-automerge] (#2047)
```

## §4. Pre-deploy checks

**ATTESTED.** Frontend only. Her account reports no pending-migration check
and no `node -c`. Neither applied: no backend or migration file changed (§2).

**MEASURED.** The migration tree holds 218 files at the end of the range:

```
$ git ls-tree -r --name-only 574cc911 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

- #2055 (`64a7ec77`, `feat(phone)`): a setup guide, `PhoneSetupGuide`
  (`frontend/src/components/phone/PhoneSetupGuide.jsx`, with its CSS), shown
  at the top of the Phone Hub (`UIOverlaysTab.jsx`). It reports the build's
  steps (Screens, Icons, Links, Content, Preview), counts "N of 3 done" over
  Screens, Icons and Links, and offers one "Continue setup →" action.

```
$ git grep -n "of 3 done\|Continue setup →" 574cc911 -- frontend/src/components/phone/PhoneSetupGuide.jsx
574cc911:frontend/src/components/phone/PhoneSetupGuide.jsx:3: * "Continue setup →" (doctrine rule 18, Task #2053).
574cc911:frontend/src/components/phone/PhoneSetupGuide.jsx:12: * Setup is complete when Screens, Icons and Links are. "Continue setup →"
574cc911:frontend/src/components/phone/PhoneSetupGuide.jsx:126:            {complete ? '✓ Screens, icons and links are done' : `${doneCount} of 3 done`}
574cc911:frontend/src/components/phone/PhoneSetupGuide.jsx:137:            Continue setup →
```

### §5.2 The live check, beside the code

**ATTESTED (§0).** The guide read "Setup 1 of 3 done": Screens 6 with an
image of 6; Icons 8 placed of 10; Links 7 of 8 zones have a destination;
Content 0 screens with content zones; Preview not run yet; "Continue setup →"
present (her screenshot).

**MEASURED.** A guide at the top of the Phone Hub with a "N of 3 done" count
and a "Continue setup →" action is #2055's change (§5.1).

**Not attested:** following "Continue setup →" to its step.

### §5.3 Production's path and the backup

**Production's request path**, cited from `F-Deploy-1_Fix_Plan_v1.56.md` §1 to
§3: HTTPS requests reach the box's app on port 3000 through the load
balancer, and the app serves the built frontend from `frontend/dist`.
`DEVELOPMENT_WORKFLOW.md` §7.3 gives the steps that follow from it. The rsync
to `/var/www/html` does not serve production's HTTPS path.

**The backup and the build, ATTESTED.** Before the build she backed up
`frontend/dist` to `~/dist.bak-20260927-pre2055`, which holds the previous
entry, `index-D9PvZP9y.js`. The build produced the new entry
`index-DTWwk6K3.js`. The rsync to `/var/www/html` followed.

**Continuity, ATTESTED, across the two records.** The entry this backup holds,
`index-D9PvZP9y.js`, is the entry Deploy AZ built (AZ record §0, §5.3).

### §5.4 Observed, not ruled: the header count

**ATTESTED (§0).** The page header read "16/16 screens ready" while there
were 6 screens and 10 icons.

**MEASURED.** The header's count is taken over every overlay, not over
screens only; the screen list filters with `isScreen`:

```
$ git show 574cc911:frontend/src/pages/UIOverlaysTab.jsx | grep -n "const generatedCount\|const screenOverlays\|screens ready"
1324:  const generatedCount = overlays.filter(o => o.generated).length;
1328:  const screenOverlays = overlays.filter(o => isScreen(o));
1455:                {generatedCount}/{overlays.length} screens ready
```

The header line is not part of #2055: at the range's start it reads the
same, at other line numbers.

```
$ git show df51d3b8:frontend/src/pages/UIOverlaysTab.jsx | grep -n "screens ready\|const generatedCount"
1240:  const generatedCount = overlays.filter(o => o.generated).length;
1316:                {generatedCount}/{overlays.length} screens ready
```

**INFERRED.** 16 is 6 screens plus 10 icons, all generated: the header counts
icons as screens. Nothing here rules on it, and nothing in the app is changed
for it.

## §6. Restarts

**ATTESTED.** No backend restart. Frontend only.

**MEASURED.** No backend file changed (§2), so no restart was needed.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy BA, production's tree was this record's basis,
`574cc911`, until Deploy BB (the BB record, filed with this one). At filing,
after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
073e57f8c73ca7988c1abd4c5684d14eec947539 2026-09-27 fix(world): deleting a character is all-or-nothing [skip-automerge] (#2071)
```

That is Deploy BB's end.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from the screenshot beyond what §0 and §5
  state in words;
- does not edit the AZ record or any other filed document;
- does not discharge any owed item in `PROJECT_CONTEXT.md` §6.5 or any Fix
  Plan revision, and closes no keystone;
- makes no fix, and mints no FD, XK or PE number;
- performs no deploy, migration, database read or change, workflow
  dispatch, or credential change of its own, and makes no host, AWS, database
  or Cognito contact. Every ATTESTED claim is Evoni's own account, taken
  outside any agent session. Every MEASURED claim is a repository read this
  filing session performed itself.

## §10. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md
$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from the AZ record §10. Nothing minted here.

## §Standing

- §1 and §2 each carry ATTESTED and MEASURED clauses, marked separately.
- The tree agrees with her account: six commits, the code all under
  `frontend/src` from #2055, no migration, no package change (§2).
- **The live check (§5.2):** the guide read "Setup 1 of 3 done" with the
  step readings in §0 (her screenshot). Following "Continue setup →":
  **not attested.**
- Production's path (§5.3) is cited from `F-Deploy-1_Fix_Plan_v1.56.md`; the
  steps from `DEVELOPMENT_WORKFLOW.md` §7.3.
- One clause is INFERRED: what the header's 16 counts (§5.4). Nothing in this
  document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2072.*
