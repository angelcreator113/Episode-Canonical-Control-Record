| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DK, 2026-10-02, backend and frontend. Five commits, 50 files, from `d146ad8b` (where DJ left production) to `f2880006`: L10 dressed angles (#2484), the Timeline save fix (#2485), L12 + L12a the Scenes tab (#2486), the DJ record (#2487) and DJ bugs 1–6 (#2488), with two migrations; no package change; one plain restart. `scripts/deploy-prod.sh` stopped on the pending migrations as designed, and Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. CFO 84/100 with 5 warnings, down from 89/100 with 4 at DJ; §6a reads which check most likely added the warning. Evoni's app check passed: everything works. She accepts the likely cause of the new warning; no action. The restart count is continuous from DJ (66 → 67).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-02_DJ.md`, whose deploy this one
follows. It edits no filed document.

Basis: the commit Deploy DK moved production to,
`f28800068c02b48c37b75f858b4935cd62bdb273` (#2488), read 2026-10-02 from
`origin/main` at the same commit (§7).

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
path, account number, database user, process name, backup directory
name or ARN. The database user the migrations ran as is left out, as in
the CW–DJ records.

**The letter.** This deploy is lettered **DK**, the letter after DJ, as
Evoni named it ("deploy record DK"). It follows DJ
(`F-Deploy-1_Deploy_2026-10-02_DJ.md`, filed in #2487).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-02, about
14:35–14:43 UTC, per `DEVELOPMENT_WORKFLOW.md` §7.1:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `d146ad8b` (where DJ left production), fetched 5 commits to `f2880006`
   (#2484, #2485, #2486, #2487, #2488). The script **stopped at step 3** on
   `20261002150000-create-scene-set-look-angles` and
   `20261002160000-add-scenes-scene-plan-id`. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty.
   - `git merge --ff-only` to `f2880006`: 50 files.
   - `check-pending-migrations` against the canon instance: **2 pending
     of 253**, exit 1.
3. **Migrate.** `db:migrate` as a database user (name left out). Its
   password was entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261002150000` migrated, 0.041 s.
   - `20261002160000` migrated, 0.021 s.
   - Re-check: **0 pending of 253**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 37.13 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 67, online.
   - Ready at 14:42:59.
   - `/health` at 2026-10-02T14:43:13Z: healthy, database connected,
     uptime 20.1 s.
5. **CFO.** 14:43:07–14:43:11: **84/100** (was 89), 0 critical,
   **5 warnings** (was 4).

**App check: passed.** ATTESTED (Evoni, 2026-10-02): "everything works".
She checked:
- the Scenes tab;
- the Place, with the approved base and Generate this look;
- the scene-set choice on a draft episode;
- a base upload, with no regeneration.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse d146ad8b f2880006
d146ad8b299b5890413825ee0e55acf2d750d465
f28800068c02b48c37b75f858b4935cd62bdb273
$ git merge-base --is-ancestor d146ad8b f2880006 && echo "ancestor: yes"
ancestor: yes
```

DJ left production at `d146ad8b` with restart count 66 (DJ record §0).
DK starts at `d146ad8b`, and its one restart brings the count to 67
(ATTESTED, §0). **No gap:** no deploy ran between DJ and DK that this
account does not show.

## §2. The range — MEASURED

```
$ git rev-list --count d146ad8b..f2880006
5
$ git log --oneline d146ad8b..f2880006
f28800068 fix(venue): DJ bugs 1-6: the look's base path, the Place lock (L13), base uploads, the approved base [skip-automerge] (#2488)
5d1e9f16e docs(audit): deploy record DJ [skip-automerge] (#2487)
e560ed34d feat(episode): the Scenes tab is the one scene workspace; each beat gets its scene row, L12 + L12a [skip-automerge] (#2486)
6bcfc57d3 fix(timeline): the Timeline's save updates scene rows in place, L12a [skip-automerge] (#2485)
a862a8498 feat(venue): episode angles at the venue made from the event's dressed look, L10 [skip-automerge] (#2484)
$ git diff --shortstat d146ad8b f2880006
 50 files changed, 3565 insertions(+), 1084 deletions(-)
$ git diff --name-only d146ad8b f2880006 -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only d146ad8b f2880006 -- src/migrations/
src/migrations/20261002150000-create-scene-set-look-angles.js
src/migrations/20261002160000-add-scenes-scene-plan-id.js
$ for p in frontend src; do printf "%s %s\n" $p $(git diff --name-only d146ad8b f2880006 -- $p | wc -l); done
frontend 22
src 19
$ git diff --name-only d146ad8b f2880006 -- . ':!frontend' ':!src'
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-10-02_DJ.md
tests/integration/beatScenes.integration.test.js
tests/integration/dressedAngles.integration.test.js
tests/integration/lookBaseFixes.integration.test.js
tests/integration/placeLock.integration.test.js
tests/integration/timelineSaveInPlace.integration.test.js
tests/integration/venueLookImage.integration.test.js
tests/unit/routes/episodes-cluster-tier-promotion.test.js
```

This agrees with Evoni's account:
- 5 commits, the five PRs she named;
- 50 files (22 frontend, 19 backend including the two migrations, 2
  docs, 7 tests);
- exactly the two migrations the script and the check named;
- no package or lock file, so no `npm ci` was needed.

## §3. The time

**ATTESTED.** About 14:35–14:43 UTC; ready at 14:42:59, CFO 14:43:07 to
14:43:11, `/health` at 14:43:13Z.

**MEASURED.** The range's last commit, #2488, is at 14:37:29 UTC:

```
$ git log --first-parent --format="%h %cI" d146ad8b..f2880006
f28800068 2026-10-02T10:37:29-04:00
5d1e9f16e 2026-10-02T10:27:52-04:00
e560ed34d 2026-10-02T10:17:56-04:00
6bcfc57d3 2026-10-02T09:53:22-04:00
a862a8498 2026-10-02T09:22:44-04:00
```

**INFERRED.** #2488 merged at 14:37:29 UTC, inside Evoni's window, so
the script's fetch ran after it, between 14:37:29 and the migrate step.
That fits a start "about 14:35".

## §4. Migrations

**MEASURED.** The tree holds 253 migration files, two more than at DJ:

```
$ git ls-tree -r --name-only d146ad8b src/migrations | grep -c '\.js$'
251
$ git ls-tree -r --name-only f2880006 src/migrations | grep -c '\.js$'
253
```

**ATTESTED (§0):** 2 pending of 253 before the run, 0 pending of 253
after it. This agrees with the tree: DJ recorded 0 pending of 251, and
the range adds exactly these two files.

**The script behaved as designed.** It stopped on the pending files, and
the migrations ran **before** the restart, as §7.1 requires on exit 1.
The new code needs both:
- `Scene` now declares `scene_plan_id`, so a model read of `scenes`
  selects it (the Timeline's load and save, the scene list);
- the plan read and the dressed-angle routes read `scene_set_look_angles`.

## §5. What went live — MEASURED

- **#2484 (`a862a849`). L10, dressed angles** (§8(hh), Evoni's answers 1–4):
  - at a set the episode's event has a complete look on, the Beat Plan's
    Generate angle and Upload image make the angle from the look;
  - Generate is one Kontext edit of the look image, its cost shown
    first; dressed angles are stored per look, and the set's angles stay
    plain;
  - such beats show and count the dressed angle when there is one.
- **#2485 (`6bcfc57d`). The Timeline's save** (L12a) updates scene rows
  in place:
  - ids are kept, and Scene Studio assets and object variants are no
    longer cascaded away on each autosave;
  - removed scenes are soft-deleted, and the export, cue, production
    package and phone-context readers skip them.
- **#2486 (`e560ed34`). L12 + L12a, the Scenes tab:**
  - every beat with a set gets its scene row (`scenes.scene_plan_id`);
  - the tab is the one scene workspace: a status bar, the Locations, the
    beats grouped by location and edited in place, Open in Studio per
    beat, and older scenes until removed.
- **#2488 (`f2880006`). DJ bugs 1–6:**
  - the look's base path: its status, the failure reason, a 10-minute
    timeout, the analysis id, the event's time of day;
  - the Place lock (L13): open while the episode is a draft, locked on
    acceptance;
  - a base upload replaces the base only;
  - the venue's approved base shows in the Place section.
- **#2487 (`5d1e9f16`).** The DJ deploy record. No runtime effect.

Three routes were added in the range, all in `episodeBriefRoutes.js`:

```
$ git diff d146ad8b f2880006 -- src/routes | grep -E "^[+-]router\."
+router.post('/:episodeId/dressed-angles/:angleId/brief', requireAuth, async (req, res) => {
+router.post('/:episodeId/dressed-angles/:angleId/generate', requireAuth, aiRateLimiter, async (req, res) => {
+router.post('/:episodeId/dressed-angles/:angleId/upload', requireAuth, dressedUpload, async (req, res) => {
```

The generate route is the one paid route. It is behind `requireAuth` and
`aiRateLimiter`, and it shows the cost before Evoni confirms (S2).

**One write on read, for the app check.** INFERRED from the code at
`f2880006` (`beatScenesService.syncBeatScenes`). The first time an
episode's plan, Scenes tab or Timeline is opened after this deploy, each
beat with a set gets its scene row (L12a). So the first opening of an
existing episode writes rows to `scenes`. Scenes made before (by "Use in
Episode" or the Timeline) stay untied and appear under "Older scenes".

## §6. Schema change, restart and the CFO

**Schema.** MEASURED (from the migration files); ATTESTED (that they
ran, §0).

```
$ git show f2880006:src/migrations/20261002150000-create-scene-set-look-angles.js | grep -n "createTable\|CREATE UNIQUE INDEX\|dropTable"
34:      await queryInterface.createTable(TABLE, {
51:        `CREATE UNIQUE INDEX IF NOT EXISTS scene_set_look_angles_unique_look_angle
59:    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
$ git show f2880006:src/migrations/20261002160000-add-scenes-scene-plan-id.js | grep -n "ALTER TABLE\|CREATE UNIQUE INDEX\|DROP"
33:        await sequelize.query('ALTER TABLE scenes ADD COLUMN scene_plan_id UUID NULL', { transaction });
36:        `CREATE UNIQUE INDEX IF NOT EXISTS scenes_unique_scene_plan
44:    await sequelize.query('DROP INDEX IF EXISTS scenes_unique_scene_plan');
46:      await sequelize.query('ALTER TABLE scenes DROP COLUMN scene_plan_id');
```

- **`scene_set_look_angles`** (new table): one live dressed angle per
  look per angle, holding its status, image, source, brief, estimate,
  cost, error and dates, with `deleted_at`. No backfill; it starts empty.
- **`scenes.scene_plan_id`** (new, uuid, nullable), with one live scene
  per beat (a partial unique index). No backfill: existing scenes stay
  untied.
- Both are guarded and re-runnable. `down` drops the table, and the
  index and the column.

**Restart.** ATTESTED.
- One plain `pm2 restart`: restart count 67, online.
- `.env` unchanged, so a plain restart was right.

## §6a. The CFO change: 89 → 84, 4 → 5 warnings

**ATTESTED (§0).** DJ: 89/100, 0 critical, 4 warnings. DK: 84/100,
0 critical, 5 warnings.

**MEASURED (the scoring, read from `src/services/cfoAgent.js` at
`f2880006`).** The overall score is a weighted average of five
sub-agents, each starting at 100 and losing points per finding:

```
$ grep -n "weights = " src/services/cfoAgent.js
605:  const weights = { cost_watchdog: 30, dependency_audit: 15, resource_monitor: 20, lights_off: 10, health_patrol: 25 };
$ grep -n "todayCost > avgCost \* 2" -A2 src/services/cfoAgent.js
84:    if (avgCost > 0 && todayCost > avgCost * 2) {
85-      findings.push({ level: 'warning', msg: `Today's spend ($${todayCost.toFixed(4)}) is ${(todayCost / avgCost).toFixed(1)}× your 7-day average ($${avgCost.toFixed(4)})` });
86-      score -= 15;
```

A warning's effect on the overall score is its deduction times its
agent's weight, divided by 100. The warning-level checks, with that
effect:

| Agent (weight) | Warning | Deduction | Overall |
| --- | --- | --- | --- |
| cost_watchdog (30) | Today's spend is more than 2× the 7-day average | 15 | −4.5 |
| cost_watchdog (30) | Daily budget ≥ 80% | 10 | −3.0 |
| cost_watchdog (30) | Monthly budget ≥ 80% | 10 | −3.0 |
| cost_watchdog (30) | Opus calls in 30 days | 10 | −3.0 |
| health_patrol (25) | Memory high | 15 | −3.75 |
| health_patrol (25) | P95 AI latency | 10 | −2.5 |
| health_patrol (25) | Failed queue jobs | 5 | −1.25 |
| resource_monitor (20) | Database > 5 GB / DB connections | 10 | −2.0 |
| resource_monitor (20) | Log tables large | 5 | −1.0 |
| dependency_audit (15) | Major updates / moderate vulnerabilities | ≤ 20 / ≤ 10 | ≤ −3.0 / ≤ −1.5 |
| lights_off (10) | More than 15 empty tables | 10 | −1.0 |

**INFERRED.** The overall score is rounded. A rounded 89 → 84 is a raw
drop of more than 4.0. One new warning with no new critical can do that
on its own only through **cost_watchdog's "Today's spend ($…) is N× your
7-day average ($…)"** (−4.5); every other warning is worth −3.75 or less.
Two smaller changes together could also do it, such as a new warning
plus a deeper deduction in a check already firing. So this is the likely
new warning, not a measured one.

**Does today's image spend explain it?** INFERRED, not measured.
- Image calls write their cost to `ai_usage_logs` (`imageCostService`,
  rows with `billing_unit` set), and the check sums every row since
  `CURRENT_DATE`.
- Today's generations therefore count: looks, bases, dressed angles and
  the Claude analyses after each base.
- Whether they push today past twice the 7-day average needs production
  numbers, which this session does not read.

The scheduled run's log does not name the warning: it prints only
findings whose text contains "budget", and the 7-day-average message
does not:

```
$ grep -n "f.msg.includes('budget')" src/services/cfoAgent.js
696:    const budgetFindings = report.all_findings.filter(f => f.agent === 'cost_watchdog' && f.msg.includes('budget'));
```

Its history (`GET /api/v1/cfo/history`) is held in memory, so the
restart cleared DJ's report. Two read-only checks would settle it, both
Evoni's:
- `GET /api/v1/cfo/audit` (admin) lists every finding by agent.
- This query splits each day's spend into image and the rest:

```sql
SELECT DATE(created_at) AS day,
       ROUND(SUM(cost_usd)::numeric, 4) AS total,
       ROUND(COALESCE(SUM(cost_usd) FILTER (WHERE billing_unit IS NOT NULL), 0)::numeric, 4) AS image,
       COUNT(*) FILTER (WHERE billing_unit IS NOT NULL) AS image_calls
  FROM ai_usage_logs
 WHERE created_at >= NOW() - INTERVAL '7 days'
 GROUP BY 1 ORDER BY 1;
```

It explains the warning if:
- today's total is more than twice the average of the listed days'
  totals (today included, as the check computes it);
- and today's total less today's image spend is not.

**Ruling.** RULED (Evoni, 2026-10-02): "accept 'today's spend > 2× the
7-day average' as the likely cause; no action." The SQL above was not
needed to close it.

**Small fix, unscheduled.** RULED (Evoni): "the scheduled CFO run logs
every finding (not only ones containing 'budget')." Today
`scheduledRun` logs only findings whose message contains "budget"
(`src/services/cfoAgent.js:696`). No task is filed and no fix is made here.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy DK is `f2880006` (#2488),
which is `origin/main` at filing:

```
$ git rev-parse origin/main
f28800068c02b48c37b75f858b4935cd62bdb273
$ git rev-parse --is-shallow-repository
false
```

No PR is open.

## §8. What this document does not do

- It records no credential, database user, process name or host.
- It edits no filed document.
- It reads no production schema, calls no production endpoint (including
  the CFO audit or history), and queries nothing in production. §6a's
  query is for Evoni to run.
- It discharges nothing and mints nothing. It fixes nothing in the CFO.
- The filing session made no host, AWS, database or Cognito contact.

## §9. Tails — re-derived, not carried

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

- **Continuity:** continuous from DJ (`d146ad8b`, restart 66). The tree
  agrees with Evoni's account: 5 commits, 50 files, the two migrations,
  no package or lock file.
- **Deploy:** the script stopped on the pending migrations as designed.
  By hand, per §7.1:
  - fast-forward; 2 pending, migrated (`scene_set_look_angles` created,
    `scenes.scene_plan_id` added), then 0 pending of 253;
  - build; one restart (count 67); ready; `/health` healthy and
    connected.
- **CFO:** 84/100, 0 critical, 5 warnings (DJ: 89, 4). The new warning
  is most likely cost_watchdog's today-versus-7-day-average (INFERRED,
  §6a); RULED (Evoni) as the likely cause, no action. Unscheduled small
  fix: the scheduled CFO run logs every finding.
- **App check:** passed, ATTESTED (Evoni): the Scenes tab; the Place
  with the approved base and Generate this look; the scene-set choice on
  a draft episode; a base upload with no regeneration. Opening an
  existing episode now writes its beats' scene rows (§5).
- **Live:** L10 dressed angles; the Timeline's in-place save; L12 + L12a
  the Scenes tab; DJ bugs 1–6.
- RULED here: only Evoni's acceptance of the CFO warning's likely cause
  (§6a). Nothing is minted. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing itself; records Evoni's CFO ruling (§6a). Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
