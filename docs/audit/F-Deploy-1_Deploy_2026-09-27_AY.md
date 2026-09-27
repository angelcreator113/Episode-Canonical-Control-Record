| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy AY, 2026-09-27, frontend only, no backend restart, no migration, performed personally by Evoni, outside any agent session. Each screen card in the Phone Hub shows its status and one next action.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-27_AX.md` (the AX record, filed with this one).
This document follows that one rather than editing it. Basis:
`0c2d2d73ef2bce8fee9ce5a483b79c5e6399cea9` (#2043), the tree Deploy AY moved
production to. `origin/main` at filing is `df51d3b8` (§8).

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

This document closes no keystone, discharges no owed item, mints no FD, XK or
PE number, and rules on nothing. It records no token, email, password,
database host, user id, account number or ARN.

The deploy is lettered AY, continuing after Deploy AX. It is one of three
records (AX to AZ) filed together under Task #2046.

## §0. Evoni's account, as given

**ATTESTED (Evoni, 2026-09-27):**

- Fast-forward `061c3737` → `0c2d2d73`. Frontend only: no backend restart,
  no migration. The steps were `DEVELOPMENT_WORKFLOW.md` §7.3's.
- Backup `~/dist.bak-20260927-pre2043`, taken before the build, holding the
  previous entry `index-CovCtrE9.js`.
- The build succeeded. New entry `index-CAwZc9Iv.js`.
- The optional rsync to `/var/www/html` followed.
- **Live check:**
  - Screen cards show Ready or Needs setup, with status lines.
  - Homepage's card reads "★ HOME", "Needs setup", "1 zone has no destination" and "Continue →" (her screenshot).

## §1. Identity and continuity

**ATTESTED.** The tree moved from `061c3737` to `0c2d2d73` by fast-forward.

**MEASURED.** Both SHAs resolve, and the start is an ancestor of the end:

```
$ git rev-parse 061c3737 0c2d2d73
061c3737addbd9b56ad4cb2484760974ab527137
0c2d2d73ef2bce8fee9ce5a483b79c5e6399cea9
$ git merge-base --is-ancestor 061c3737 0c2d2d73; echo "exit=$?"
exit=0
```

Deploy AX ends at `061c3737` (AX record §1, §8); Deploy AY begins there.

## §2. The range — MEASURED

```
$ git log --oneline --first-parent 061c3737..0c2d2d73
0c2d2d73e feat(phone): screen cards show status and one next action [skip-automerge] (#2043)
351209fcc docs(context): refresh §4 (part B2) [skip-automerge] (#2041)
287cb9e1a docs(audit): F-Stats-1 reads slice, calendarRoutes.js [skip-automerge] (#2039)
98dd2e3a3 docs(audit): F-Stats-1 reads slice, episodes.js [skip-automerge] (#2037)
164977d6e docs(context): refresh basis, §0 and §7 (part B1) [skip-automerge] (#2035)
$ git diff --name-only 061c3737 0c2d2d73 -- src frontend/src src/migrations package.json frontend/package.json
frontend/src/components/PhoneHub.cards.pinned.test.jsx
frontend/src/components/PhoneHub.jsx
frontend/src/components/PhoneHub.statusCards.test.jsx
frontend/src/pages/UIOverlaysTab.homeAndIconSave.test.jsx
frontend/src/pages/UIOverlaysTab.jsx
frontend/src/pages/UIOverlaysTab.statusCards.test.jsx
$ git diff --name-only 061c3737 0c2d2d73 -- src/ src/migrations/ package.json package-lock.json frontend/package.json frontend/package-lock.json; echo "exit=$?"
exit=0
$ git diff --name-only 061c3737 0c2d2d73 -- . ':!frontend/src'
PROJECT_CONTEXT.md
docs/audit/F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md
docs/audit/F-Stats-1_ReadsSlice_episodes_2026-09-27.md
```

Five commits, #2035, #2037, #2039, #2041 and #2043. The code is six files, all
under `frontend/src`, four of them tests, from #2043. Nothing under `src/`, no
migration file, no package manifest or lockfile. The other three files are
documents, not served: `PROJECT_CONTEXT.md` and the two F-Stats-1 reads-slice
notes under `docs/audit/`.

## §3. The time

**ATTESTED.** Her account gives no login or deploy time for AY.

**MEASURED.** The newest commit in the range is #2043, 13:55:38 UTC on 2026-09-27, so the deploy
followed it:

```
$ git log --first-parent --format="%h %cI %s" 061c3737..0c2d2d73
0c2d2d73e 2026-09-27T09:55:38-04:00 feat(phone): screen cards show status and one next action [skip-automerge] (#2043)
351209fcc 2026-09-27T09:41:14-04:00 docs(context): refresh §4 (part B2) [skip-automerge] (#2041)
287cb9e1a 2026-09-27T07:27:02-04:00 docs(audit): F-Stats-1 reads slice, calendarRoutes.js [skip-automerge] (#2039)
98dd2e3a3 2026-09-27T06:57:13-04:00 docs(audit): F-Stats-1 reads slice, episodes.js [skip-automerge] (#2037)
164977d6e 2026-09-27T06:20:56-04:00 docs(context): refresh basis, §0 and §7 (part B1) [skip-automerge] (#2035)
```

## §4. Pre-deploy checks

**ATTESTED.** Frontend only. Her account reports no pending-migration check
and no `node -c`. Neither applied: no backend or migration file changed (§2).

**MEASURED.** The migration tree holds 218 files at the end of the range:

```
$ git ls-tree -r --name-only 0c2d2d73 src/migrations | wc -l
218
```

## §5. What went live

### §5.1 The change, MEASURED

- #2035 (`164977d6`): `PROJECT_CONTEXT.md`, refresh part B1. Not served.
- #2037 (`98dd2e3a`): `F-Stats-1_ReadsSlice_episodes_2026-09-27.md`. Not
  served.
- #2039 (`287cb9e1`): `F-Stats-1_ReadsSlice_calendarRoutes_2026-09-27.md`. Not
  served.
- #2041 (`351209fc`): `PROJECT_CONTEXT.md` §4, refresh part B2. Not served.
- #2043 (`0c2d2d73`, Task #2042): each Phone Hub screen card shows Ready or
  Needs setup and up to three lines ("✓ Image" / "⚠ No image"; icons and
  links, or zones with no destination; "⚠ Nothing links here" for a non-home
  screen), and one "Continue →" for the first unmet line (`PhoneHub.jsx`,
  `UIOverlaysTab.jsx`). Doctrine rule 18.

### §5.2 The live check, beside the code

**ATTESTED (§0).**
- Screen cards show Ready or Needs setup, with status lines.
- Homepage's card reads "★ HOME", "Needs setup", "1 zone has no destination" and "Continue →" (her screenshot).

**MEASURED.** Each is #2043's wording. On a screen with an image, "N zone(s) has/have no
destination" is the first unmet line, so the card's one action is Continue →,
and a home screen's card never reads "Nothing links here". That her Homepage
holds one zone with no destination is what the card states; this record does
not read her data.

Where Continue → leads (Build or Connect): **not attested.**

### §5.3 Production's path and the backup

**Production's request path**, cited from `F-Deploy-1_Fix_Plan_v1.56.md` §1 to
§3 (filed by #2031): HTTPS requests reach the box's app on port 3000 through
the load balancer, and the app serves the built frontend from `frontend/dist`.
`DEVELOPMENT_WORKFLOW.md` §7.3 (#2032) gives the steps that follow from it.
The rsync to `/var/www/html` reaches `dev.primepisodes.com` and plain HTTP
only.

**The backup and the build, ATTESTED.** Before the build she backed up
`frontend/dist` to `~/dist.bak-20260927-pre2043`, which holds the previous
entry, `index-CovCtrE9.js`. The build produced the new entry
`index-CAwZc9Iv.js`. The optional rsync to `/var/www/html` followed.

**Continuity, ATTESTED, across the two records.** The entry this backup holds,
`index-CovCtrE9.js`, is the entry Deploy AX built (AX record §0, filed with
this one).

## §6. Restarts

**ATTESTED.** No backend restart. Frontend only.

**MEASURED.** No backend file changed (§2), so no restart was needed.

## §7. Schema changes

**ATTESTED.** No migration.

**MEASURED.** No file under `src/migrations/` changes (§2, §4).

## §8. Basis statement

**MEASURED.** After Deploy AY, production's tree is this record's basis,
`0c2d2d73`. At filing, after `git fetch origin --prune`, `origin/main` is:

```
$ git log -1 --format='%H %ad %s' --date=short origin/main
df51d3b803704e17efd1686bd3546bcc68a34aee 2026-09-27 fix(phone): the first zone can be added on any screen [skip-automerge] (#2045)
```

`df51d3b8` is Deploy AZ's tree (AZ record, filed with this one); Deploy AY's tree, `0c2d2d73`, is its ancestor.

## §9. What this document does not do

This document:

- records no token, email, password, database host, user id, account number
  or ARN, and reproduces no value from the screenshots beyond what §0 and §5
  state in words;
- does not edit the AX record or any other filed document;
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

Unchanged from the AW record §10. Nothing minted here.

## §Standing

- §1 and §2 each carry ATTESTED and MEASURED clauses, marked separately.
- The tree agrees with her account: five commits, the code six files, all under `frontend/src`, four of them tests, no migration, no package change (§2).
- **The live check (§5.2):** Screen cards show Ready or Needs setup, with status lines. Homepage's card reads "★ HOME", "Needs setup", "1 zone has no destination" and "Continue →" (her screenshot). Where Continue → leads (Build or Connect): **not attested.**
- Production's path (§5.3) is cited from `F-Deploy-1_Fix_Plan_v1.56.md`; the
  steps from `DEVELOPMENT_WORKFLOW.md` §7.3.
- Nothing in this document is labelled RULED or INFERRED.
- No host, AWS, database or Cognito contact was made by the agent session
  that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
  sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: #2046.*
