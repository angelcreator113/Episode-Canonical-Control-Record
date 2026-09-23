| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Five production deploys on 2026-09-23 after Deploy C (~14:20 UTC), and one backup-directory maintenance action, all performed personally by Evoni, outside any agent session.* |
| --- |

**Document version**

New record, not a Fix Plan revision, and not an amendment of
`F-Deploy-1_Deploy_2026-09-23.md`. This document follows that one
rather than editing it. Basis: `origin/main` at
`d1c5f50aff8b73d8ee993720d92ee93de3212375`, measured 2026-09-23. That
basis is one commit past the tree Deploy I (§7) moved production to
(§9).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Two standings appear below, each marked on its own claim and
never upgraded:

- **ATTESTED** covers what only Evoni's own account of the production
  host states. It cannot be reproduced from a clone.
- **MEASURED** covers what this repository itself shows: a
  `git log`/`diff`/`grep` any clone can reproduce.

This document closes no keystone, discharges no owed item, mints no FD,
XK or PE number, and rules on nothing.

The deploys are lettered E–I, continuing after the filed record's
Deploys A, B and C. There is no Deploy D (§2).

## §1. Identity — Deploys E, F, G, H and I

**ATTESTED.**
- Instance `i-02ae7608c531db485`; tree `~/episode-metadata`.
- `git status` showed only the four known untracked `.bak` files. That
  matches the standing observation in `F-Deploy-1_Deploy_2026-09-23.md`
  §1 and the records it cites.
- `episode-worker` was stopped throughout all five deploys.
- No package or migration change appeared in any of the five.

**MEASURED.** None of the five commit ranges below (§3–§7) touches
`src/migrations/`, `package.json` or `package-lock.json`. For each
range, `git diff --name-only <from> <to> -- src/migrations package.json
package-lock.json` printed nothing.

## §2. No Deploy D

**ATTESTED (Evoni).** A "Deploy D" was first supplied for this record,
at ~16:00 UTC over `9f04c821 → ae7d6623`. Evoni withdrew it. It
duplicated Deploy B of `F-Deploy-1_Deploy_2026-09-23.md` (§5, ~13:40
UTC), which is already filed. It is not recorded here as a deploy.

**MEASURED.** Production has no range between Deploy C and Deploy E:
- Deploy C ends at `5dc8a484bb72008a2f2788fda3be1804f1853a1c`
  (`F-Deploy-1_Deploy_2026-09-23.md` §6).
- Deploy E begins there (§3).
- `git merge-base --is-ancestor 5dc8a484 2de57435` succeeds.

The restart counts below (§3, §4, §7) continue from Deploy B's 17 → 18
with no step between.

## §3. Deploy E — 2026-09-23 ~16:57 UTC, backend

**ATTESTED.**
- Evoni moved the tree from `5dc8a484bb72008a2f2788fda3be1804f1853a1c`
  to `2de57435a7bffb2f397bf0a4977792592fd4fcb3`: four commits, four
  backend files, including `services/aiCostTracker.js`.
- `node -c` passed. The tracker loaded and announced itself.
- Backup `pre1732`.
- The served entry was `index-BRI34et4.js`, unchanged, as no frontend
  source changed.
- `pm2 restart`: restart count 18 → 19. `/health` returned 200.

**MEASURED**, `git log --oneline
5dc8a484bb72008a2f2788fda3be1804f1853a1c..2de57435a7bffb2f397bf0a4977792592fd4fcb3`:

```
2de57435a fix(services): log usage for streamed AI calls and route icon cues through the SDK [skip-automerge] (#1732)
97f6cf9d5 docs: read which AI calls bypass the cost tracker [skip-automerge] (#1730)
b006b41ff fix(routes): whitelist and gate texture-layer generate writes [skip-automerge] (#1728)
cd30c3b0f docs(audit): file the 2026-09-23 deploy record [skip-automerge] (#1726)
```

Four commits (`git rev-list --count` over the range: `4`), matching
Evoni's count. PRs #1726, #1728, #1730, #1732. `git diff --stat` over
the range, scoped to `src/`:

```
 src/routes/textureLayerRoutes.js        |  7 +++
 src/services/aiCostTracker.js           | 68 ++++++++++++++++++++++++++---
 src/services/iconCueGeneratorService.js | 36 +++++++--------
 src/services/textureLayerService.js     | 77 ++++++++++++++++++++++++++++++---
 4 files changed, 154 insertions(+), 34 deletions(-)
```

Four files, one of them `aiCostTracker.js`. Outside `src/`, the range
touches `docs/AI_COST_TRACKING_READ.md`,
`docs/audit/F-Deploy-1_Deploy_2026-09-23.md` and three test files under
`tests/unit/`. No file under `frontend/` changed, which is consistent
with the unchanged served entry.

## §4. Deploy F — 2026-09-23 ~17:39 UTC, backend

**ATTESTED.**
- Evoni moved the tree from `2de57435a7bffb2f397bf0a4977792592fd4fcb3`
  to `2003cd765a4b74e21dc1876ee3e97b0b94e2ee5f`: two commits, two
  backend files.
- The tracker loaded and listed its new exports `SPEND_CACHE_MS` and
  `refreshSpend`.
- Backup `pre1736`.
- The served entry was `index-BRI34et4.js`, unchanged.
- `pm2 restart`: restart count 19 → 20. `/health` returned 200.
- The SSH session dropped after the merge and before the syntax checks.
  It was reconnected with no loss.

**MEASURED**, `git log --oneline
2de57435a7bffb2f397bf0a4977792592fd4fcb3..2003cd765a4b74e21dc1876ee3e97b0b94e2ee5f`:

```
2003cd765 fix(services): count AI spend from logged usage [skip-automerge] (#1736)
7e291c4b7 fix(routes): whitelist manuscript cascade writes [skip-automerge] (#1734)
```

Two commits (`git rev-list --count`: `2`), matching Evoni's count. PRs
#1734, #1736. `git diff --stat`, scoped to `src/`:

```
 src/routes/novelIntelligenceRoutes.js |  50 ++++++++++++-
 src/services/aiCostTracker.js         | 137 +++++++++++++++++++++++++++-------
 2 files changed, 155 insertions(+), 32 deletions(-)
```

At `2003cd76`, `src/services/aiCostTracker.js` line 389 reads
`module.exports = { calculateCost, MODEL_PRICING, getDailySpend,
DAILY_BUDGET, SPEND_CACHE_MS, refreshSpend };`. That is consistent with
Evoni's account of the two new exports. Outside `src/`, the range
touches two test files under `tests/unit/` and nothing under
`frontend/`.

## §5. Deploy G — 2026-09-23 ~18:15 UTC, frontend only

**ATTESTED.**
- Evoni moved the tree from `2003cd765a4b74e21dc1876ee3e97b0b94e2ee5f`
  to `efa5d7dcc2943cc1fbb2c5c3e2520af983150d0f`: one commit, no backend
  files, no API restart.
- Backup `pre1738`.
- The served entry changed from `index-BRI34et4.js` to
  `index-DkYUGq4O.js`. HTTP 200.
- The frontend build took 31.83s.

**MEASURED**, `git log --oneline 2003cd765..efa5d7dcc`:

```
efa5d7dcc feat(frontend): add the Library group, remove the progress card [skip-automerge] (#1738)
```

One commit, PR #1738. `git diff --stat`, scoped to `src/`: no output.
The range changes two files, both under `frontend/`. Its starting entry
`index-BRI34et4.js` is where Deploy C
(`F-Deploy-1_Deploy_2026-09-23.md` §6) left production, which is
consistent with §3 and §4 changing no frontend source.

## §6. Deploy H — 2026-09-23 ~19:05 UTC, frontend only

**ATTESTED.**
- Evoni moved the tree from `efa5d7dcc2943cc1fbb2c5c3e2520af983150d0f`
  to `71db61613fba4786c9370ad41c90676cd1e8847c`: one commit, no backend
  files, no API restart.
- Backup `pre1740`.
- The served entry changed from `index-DkYUGq4O.js` to
  `index-GvW5rcXY.js`. HTTP 200.
- On the first attempt the rsync step was skipped, so the built bundle
  was not served. The step was run immediately afterwards, and the entry
  then changed.

**MEASURED**, `git log --oneline efa5d7dcc..71db61613`:

```
71db61613 refactor(frontend): regroup the sidebar [skip-automerge] (#1740)
```

One commit, PR #1740. `git diff --stat`, scoped to `src/`: no output.
The range changes two files, both under `frontend/`.

## §7. Deploy I — 2026-09-23 ~19:44 UTC, backend

**ATTESTED.**
- Evoni moved the tree from `71db61613fba4786c9370ad41c90676cd1e8847c`
  to `04686b39d3a3e9bba6a8f861f7d81777556eda23`: five commits, four
  backend files, including the new `utils/canonConsequencesMerge.js`
  and `models/Wardrobe.js`.
- `node -c` passed on all four. The merge utility loaded.
- Backup `pre1749`.
- The served entry was unchanged at `index-GvW5rcXY.js`.
- `pm2 restart`: restart count 20 → 21. `/health` returned 200.

**MEASURED**, `git log --oneline
71db61613fba4786c9370ad41c90676cd1e8847c..04686b39d3a3e9bba6a8f861f7d81777556eda23`:

```
04686b39d fix(routes): merge canon_consequences instead of replacing [skip-automerge] (#1749)
9ae338f38 docs: refresh PROJECT_CONTEXT.md after the 2026-09-23 work [skip-automerge] (#1750)
6384eba9f docs: read what the old event editor still owns [skip-automerge] (#1746)
1a42f788d fix(routes): keep wardrobe tags and description [skip-automerge] (#1745)
abd12b28c docs: read which store owns Lala's wardrobe [skip-automerge] (#1742)
```

Five commits (`git rev-list --count`: `5`), matching Evoni's count. PRs
#1742, #1745, #1746, #1749, #1750. `git diff --stat`, scoped to `src/`:

```
 src/controllers/wardrobeController.js | 54 ++++++++++++++++++++-------
 src/models/Wardrobe.js                | 11 +++++-
 src/routes/worldEvents.js             | 35 ++++++++++++++++--
 src/utils/canonConsequencesMerge.js   | 70 +++++++++++++++++++++++++++++++++++
 4 files changed, 151 insertions(+), 19 deletions(-)
```

Four files, including `src/utils/canonConsequencesMerge.js` (new) and
`src/models/Wardrobe.js`. At `04686b39`, that utility's line 70 reads
`module.exports = { mergeCanonConsequences };`. Outside `src/`, the
range touches `PROJECT_CONTEXT.md`, `docs/EVENT_EDITOR_READ.md`,
`docs/WARDROBE_OWNERSHIP_READ.md` and two test files under
`tests/unit/`. No file under `frontend/` changed, which is consistent
with the unchanged served entry.

## §8. Maintenance — 2026-09-23 ~19:00 UTC, backup directories

**ATTESTED.**
- Seven `/var/www/html.bak-*` directories were deleted by explicit name:
  - `pre1724`, `pre1722`, `pre1700` and `pre1690` of `20260923`;
  - `pre1688`, `pre1682` and `pre1675` of `20260922`.
- Six were left: the three most recent, and the three 2026-09-19
  backups, which are kept as evidence per the earlier record.
- Disk usage went from 90% to 89%.

No MEASURED clause: nothing in this action is visible from a clone.

## §9. Related, by citation only — not re-derived, not ruled on

**The records this one follows.** `F-Deploy-1_Deploy_2026-09-23.md`
(filed by #1726), and through it `F-Deploy-1_Deploy_Late_2026-09-22.md`,
`F-Deploy-1_Deploy_Evening_2026-09-22.md`,
`F-Deploy-1_Deploy_2026-09-22.md`,
`F-Deploy-1_Deploy_2026-09-20_2026-09-21.md` and
`F-Deploy-1_Deploy_2026-09-20.md`. None is edited here.

**The filed reads these deploys' fixes relate to.** Each pairing is
MEASURED only to this extent: the read's own basis precedes the fix,
and the read names the code the fix changed. What each read holds is not
restated here, and no read is thereby discharged.

| Fix | Deploy | Read it relates to |
|---|---|---|
| #1728, #1734 | E, F | `docs/audit/F-AUTH-1_RuntimeColumnWrites_Read_MEASURED_2026-09-23.md` (basis `f8644c94`, #1710) |
| #1732, #1736 | E, F | `docs/AI_COST_TRACKING_READ.md` (#1730; outside `docs/audit/`) |
| #1745 | I | `docs/WARDROBE_OWNERSHIP_READ.md` (#1742; outside `docs/audit/`), §4.6 and §5.1 |
| #1749 | I | `docs/EVENT_EDITOR_READ.md` (#1746; outside `docs/audit/`), §5 and §6 |

**Not deployed by any deploy recorded here.** `origin/main` at this
record's basis holds one commit past Deploy I's tree:

```
$ git log --oneline 04686b39d..d1c5f50a
d1c5f50af fix(routes): refuse a second episode from one event [skip-automerge] (#1752)
```

## §10. Observations — not findings, not ruled on

- **ATTESTED (Evoni).** After Deploy I, Evoni uploaded a wardrobe item
  successfully.
  - `docs/WARDROBE_OWNERSHIP_READ.md` and PR #1745's own description
    record the upload path as broken before #1745.
  - This was the first successful upload since the table was seeded on
    2026-02-19.
  - No cause is established here beyond the citation.
- **ATTESTED (Evoni).** The error log holds 151 "Not allowed by CORS"
  entries. A sample read shows anonymous requests for asset files from
  an outside IP, not from the application. No cause is established here.
- **ATTESTED (Evoni), browser only.** Deleting wardrobe items returned
  400 in the browser, with nothing written to the error log. Two API
  requests returned 401, with nothing logged either. No server-side
  record of any of these exists. No cause is established here.
- **Where the four named fixes went live.** MEASURED by
  `git merge-base --is-ancestor` against each deploy's ending tree:
  - **Wardrobe upload** (#1745) and **`canon_consequences` merge**
    (#1749) went live in Deploy I (§7).
  - **Author-field** fixes (#1704, #1707) were not in any range recorded
    here. They went live in Deploy B of
    `F-Deploy-1_Deploy_2026-09-23.md` (§5).
  - **Guest-profile** fix (#1688, "give opportunity-path guests a
    profile link") was not in any range recorded here either. Its commit
    `70cc93f4` is the tree at which `F-Deploy-1_Deploy_Late_2026-09-22.md`
    §4 leaves production.
  - Those two pairs are cited, not re-recorded.
- **ATTESTED (Evoni).** Two facts first supplied for this record were
  withdrawn before filing, and neither is recorded above:
  - The Deploy D entry (§2).
  - An entry-name pair, `index-DNo1UBvf.js` → `index-BSRXK5fG.js`. It
    belongs to `F-Deploy-1_Deploy_Evening_2026-09-22.md` (§4, that
    record's Deploy B), not to 2026-09-23. MEASURED:
    `grep -rn 'DNo1UBvf\|BSRXK5fG' docs/audit` finds it only in that
    file.

None of the observations above is characterized as a defect, ruled on,
or assigned an owner in this document.

## §11. What this document does not do

This document:

- does not record a Deploy D. The entry first supplied for it
  duplicated the already-filed Deploy B and was withdrawn (§2);
- does not restate or re-verify any read cited in §9, and discharges
  none of them. A fix shipping is not a ruling that a read's question is
  closed;
- does not establish a cause for any observation in §10;
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

## §12. Tails — re-derived, not carried

```
$ ls docs/audit/ | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n
FD-66_Model_Migration_Contract_Mismatch_2026-08-18_DRAFT.md
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md

$ ls docs/audit/ | grep -E '^XK-[0-9]+_'
XK-2_Extent_Census_2026-09-05.md

$ grep -oE 'PE #[0-9]+' docs/audit/Session_PE_Roster.md | sort -t'#' -k2 -n | tail -1
PE #68
```

Unchanged from `F-Deploy-1_Deploy_2026-09-23.md` §10. Nothing minted
here.

## §Standing

- §1 and §3–§7 each carry an ATTESTED clause and a MEASURED clause,
  marked separately and never merged into one standing:
  - ATTESTED: Evoni's own account of actions taken personally on the
    production host, not reproducible from a clone;
  - MEASURED: a read of this repository, reproducible by anyone with a
    clone.
- §2 carries an ATTESTED withdrawal and a MEASURED continuity check.
- §8 is ATTESTED only.
- §9 carries no standing beyond the citations and reads it names.
- §10 marks each observation's standing on the observation.
- Nothing in this document is labelled RULED.
- No host, AWS, database or Cognito contact was made by the agent
  session that filed it.
- Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1).
  Agent sessions still never touch hosts, AWS, RDS or Cognito
  (`CLAUDE.md`), unchanged by that lift or by this record.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges:
nothing. Host/AWS/DB/Cognito contact by the filing session: none.
Task: #1753.*
