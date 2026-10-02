| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DL, 2026-10-02, backend and frontend. Two commits, 11 files, from `f2880006` (where DK left production) to `d3f2edb8`: the DK record (#2489) and the base model comparison drawn from two scene sets' Scene Briefs (#2490). No migration; no package change; one plain restart. `scripts/deploy-prod.sh` ran end to end, outside any agent session. CFO 84/100 with 5 warnings, the same as DK. The app check has not been done yet. The restart count is continuous from DK (67 → 68).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-02_DK.md`, whose deploy this one
follows. It edits no filed document.

Basis: the commit Deploy DL moved production to,
`d3f2edb863a593dc2d84df3b8994466cac9f8d71` (#2490), read 2026-10-02 from
`origin/main` at the same commit (§6).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email address, password, hostname, IP address, key
path, account number, database name, database user, process name, backup
directory name or ARN. Evoni's paste carried a shell prompt with the
host's name, the database the pending check read, the user it read as,
the process name and the backup directory; all are left out here, as in
the CW–DK records.

**The letter.** This deploy is lettered **DL**, the letter after DK, as
Evoni named it ("deploy record DL"). It follows DK
(`F-Deploy-1_Deploy_2026-10-02_DK.md`, filed in #2489).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-02, from
`scripts/deploy-prod.sh`, with the excluded items above removed:

1. **Tree.** `f28800068c02b48c37b75f858b4935cd62bdb273` →
   `d3f2edb863a593dc2d84df3b8994466cac9f8d71`, fast-forward.
2. **Range.** 2 commits, 11 files; PRs #2489 and #2490. No migration
   and no package or lock file in the range.
3. **Build.**
   - The previous `frontend/dist` was backed up (at 15:23:58 UTC, by the
     backup's timestamp).
   - `vite build`: built in 38.48 s.
4. **Pending check.**
   - Read in production mode, against the production database (confirmed
     by Evoni).
   - Result: "OK: 0 pending of 253 migration files checked." (exit 0).
5. **Environment.** `ANTHROPIC_API_KEY` in `.env`: count 1 (the value
   was not read). `.env` was not changed.
6. **Restart.**
   - One plain `pm2 restart`: restart count 68.
   - Ready at 15:24:50 ("Ready to accept requests").
   - `/health` at 2026-10-02T15:24:50Z: healthy, environment
     production, database connected, uptime 6.1 s.
7. **CFO.** Scheduled audit 15:24:58–15:25:04: **84/100**, 0 critical,
   **5 warnings**, 6576 ms. The same score and count as DK.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed change works or fails in production.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse f2880006 d3f2edb8
f28800068c02b48c37b75f858b4935cd62bdb273
d3f2edb863a593dc2d84df3b8994466cac9f8d71
$ git merge-base --is-ancestor f2880006 d3f2edb8 && echo "ancestor: yes"
ancestor: yes
```

DK left production at `f2880006` with restart count 67 (DK record §0).
DL starts at `f2880006`, and its one restart brings the count to 68
(ATTESTED, §0). **No gap:** no deploy ran between DK and DL that this
account does not show.

## §2. The range — MEASURED

```
$ git rev-list --count f2880006..d3f2edb8
2
$ git log --oneline f2880006..d3f2edb8
d3f2edb86 feat(scenes): the base model comparison draws two scene sets' Scene Briefs [skip-automerge] (#2490)
d6c2a7c79 docs(audit): deploy record DK [skip-automerge] (#2489)
$ git diff --shortstat f2880006 d3f2edb8
 11 files changed, 732 insertions(+), 89 deletions(-)
$ git diff --name-only f2880006 d3f2edb8 -- src/migrations/ | wc -l
0
$ git diff --name-only f2880006 d3f2edb8 -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ for p in frontend src docs tests; do printf "%s %s\n" $p $(git diff --name-only f2880006 d3f2edb8 -- $p | wc -l); done
frontend 4
src 3
docs 2
tests 2
$ ls src/migrations | wc -l
253
```

This agrees with Evoni's account:
- 2 commits, the two PRs she named;
- 11 files (4 frontend, 3 backend, 2 docs, 2 tests);
- no migration, so 0 pending of 253, as at DK;
- no package or lock file, so no `npm ci` was needed.

## §3. #2490 is the comparison change — MEASURED

Evoni asked that this be confirmed. #2490 merged at 15:19:35 UTC, about
four minutes before the deploy's backup (15:23:58, §0). Its squash
commit `d3f2edb8` has the same tree as the PR's reviewed head
`7b51c25f`:

```
$ git log -1 --format='%H %cI %s' d3f2edb86
d3f2edb863a593dc2d84df3b8994466cac9f8d71 2026-10-02T11:19:35-04:00 feat(scenes): the base model comparison draws two scene sets' Scene Briefs [skip-automerge] (#2490)
$ git diff --quiet 7b51c25f7219195aa67b6e4404ef7fe939935323 d3f2edb86 && echo "tree of #2490 head == d3f2edb8: identical"
tree of #2490 head == d3f2edb8: identical
$ git show --stat --format= d3f2edb86 | tail -1
 10 files changed, 323 insertions(+), 89 deletions(-)
```

What it changes, at `d3f2edb8`:

```
$ git grep -n "Free prompts are not taken\|prepareSceneBrief(db.sequelize" d3f2edb86 -- src/services/sceneModelComparisonService.js
d3f2edb86:src/services/sceneModelComparisonService.js:93:    throw badRequest(`Free prompts are not taken: send scene_set_ids, ${PROMPTS_PER_COMPARISON} scene sets whose Scene Briefs are drawn`);
d3f2edb86:src/services/sceneModelComparisonService.js:106:    const brief = await prepareSceneBrief(db.sequelize, src, {
$ git grep -n "options.brief ||" d3f2edb86 -- src/services/sceneGenerationService.js
d3f2edb86:src/services/sceneGenerationService.js:839:  const brief = options.brief || await prepareSceneBrief(briefDb(models), sceneSet, {
$ git grep -n "Scene set {i + 1}" d3f2edb86 -- frontend/src/components/SceneModelComparison.jsx
d3f2edb86:frontend/src/components/SceneModelComparison.jsx:191:          <span>Scene set {i + 1}</span>
```

So, at the deployed commit:
- "Compare base models" refuses free prompts and takes two scene sets.
- Each set's Scene Brief is built once and sent unchanged to every
  model: the no-people rule, the place layer from its World Location,
  the shot, the environment.
- A set with no World Location or no description is refused.
- The panel offers two "Scene set" choosers and shows each brief's
  prompt with the estimate.

The ruling it answers is recorded in `docs/EVENT_EPISODE_FLOW.md`
§8(dd) ("The scene model comparison draws scene sets' briefs").

**Not run.** The comparison is a paid action for Evoni; the filing
session ran no generation, here or in production.

## §4. Restart and the CFO

**Restart.** ATTESTED (§0). One plain restart, count 67 → 68. No
schema change.

**CFO.** ATTESTED (§0). 84/100, 0 critical, 5 warnings: unchanged from
DK. The cause of the warning DK added stands as Evoni ruled it there (DK record
§6a). The small fix ruled at DK — the scheduled run logs every finding,
not only those containing "budget" — is still unscheduled, so this
run's log shows only the summary line.

## §5. The time

**ATTESTED.** Backup 15:23:58 UTC; ready and `/health` 15:24:50; CFO
15:24:58 to 15:25:04.

**MEASURED.** The range's last commit, #2490, is at 15:19:35 UTC (§3),
before the backup.

## §6. Basis statement

**MEASURED.** Production's tree after Deploy DL is `d3f2edb8` (#2490),
which is `origin/main` at filing:

```
$ git rev-parse origin/main
d3f2edb863a593dc2d84df3b8994466cac9f8d71
$ git rev-parse --is-shallow-repository
false
```

## §7. What this document does not do

- It records no credential, database name or user, process name or host.
- It edits no filed document.
- It reads no production schema, calls no production endpoint, and
  queries nothing in production.
- It runs no comparison and no generation.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §8. Tails — re-derived, not carried

```
$ ls docs/audit | grep -E '^FD-[0-9]+_' | sort -t- -k2 -n | tail -1
FD-69_Unauthenticated_Token_Issuance_2026-08-22_DRAFT.md
$ grep -n '^### XK-' docs/audit/Cross_Keystone_Register.md | tail -1
410:### XK-4 — tenancy absent from the route contract
$ grep -oE '^### PE #[0-9]+' docs/audit/Session_PE_Roster.md | grep -oE '[0-9]+' | sort -n | tail -1
68
```

The tails are FD-69, XK-4 and PE 68. Nothing is minted here.

## §Standing

- **Continuity:** continuous from DK (`f2880006`, restart 67). The tree
  agrees with Evoni's account: 2 commits, 11 files, no migration, no
  package or lock file.
- **Deploy:** `scripts/deploy-prod.sh` end to end: fast-forward; build;
  0 pending of 253; one restart (count 68); ready; `/health` healthy and
  connected.
- **CFO:** 84/100, 0 critical, 5 warnings, unchanged from DK.
- **#2490 is the comparison change** (§3): its merge commit carries the
  reviewed head's tree; the comparison now draws two scene sets' Scene
  Briefs.
- **App check:** not done yet (Evoni).
- **Live:** the base model comparison from scene sets' Scene Briefs; the
  DK record (docs only).
- Nothing is RULED here. The filing session made no host, AWS, database
  or Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
