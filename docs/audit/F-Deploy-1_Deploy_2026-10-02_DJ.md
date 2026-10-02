| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DJ, 2026-10-02, backend and frontend. Four commits, 33 files, from `41ca135c` (where DI left production) to `d146ad8b`: L7–L9 "Generate this look" (#2481), L11 the Beat Plan (#2482), and the DH and DI records (#2480, #2483), with two migrations; no package change; one plain restart. `scripts/deploy-prod.sh` stopped on the pending migrations as designed, and Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. CFO 89/100 with 4 warnings, unchanged from DI. The app check has not been done yet. The restart count is continuous from DI (65 → 66).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-02_DI.md`, whose deploy this one
follows. It edits no filed document.

Basis: the commit Deploy DJ moved production to,
`d146ad8b299b5890413825ee0e55acf2d750d465` (#2483), read 2026-10-02 from
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
the CW–DI records.

**The letter.** This deploy is lettered **DJ**, the letter after DI, as
Evoni named it ("deploy record DJ"). It follows DI
(`F-Deploy-1_Deploy_2026-10-02_DI.md`, filed in #2483).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-02, about
13:10–13:18 UTC, per `DEVELOPMENT_WORKFLOW.md` §7.1:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `41ca135c` (where DI left production), fetched 4 commits to `d146ad8b`
   (#2480, #2481, #2482, #2483). The script **stopped at step 3** on
   `20261002130000-create-scene-set-looks` and
   `20261002140000-add-scene-plan-chosen-by-user`. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty.
   - `git merge --ff-only` to `d146ad8b`: 33 files.
   - `check-pending-migrations` against the canon instance: **2 pending
     of 251**, exit 1.
3. **Migrate.** `db:migrate` as a database user (name left out). Its
   password was entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261002130000` migrated, 0.043 s.
   - `20261002140000` migrated, 0.015 s.
   - Re-check: **0 pending of 251**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 35.95 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 66, online.
   - Ready at 13:17:59.
   - `/health` at 2026-10-02T13:18:13Z: healthy, database connected,
     uptime 20.1 s.
5. **CFO.** 13:18:07–13:18:11: **89/100**, 0 critical, **4 warnings**.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed features work or fail in production.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse 41ca135c d146ad8b
41ca135cc435ed55cb839ef65f18ce2d6113f2a5
d146ad8b299b5890413825ee0e55acf2d750d465
$ git merge-base --is-ancestor 41ca135c d146ad8b && echo "ancestor: yes"
ancestor: yes
```

DI left production at `41ca135c` with restart count 65 (DI record §0).
DJ starts at `41ca135c`, and its one restart brings the count to 66
(ATTESTED, §0). **No gap:** no deploy ran between DI and DJ that this
account does not show.

## §2. The range — MEASURED

```
$ git rev-list --count 41ca135c..d146ad8b
4
$ git log --oneline 41ca135c..d146ad8b
d146ad8b2 docs(audit): deploy record DI [skip-automerge] (#2483)
9f78974ea feat(planner): the Beat Plan: any set from the show's library, "Chosen by you", the episode's locations, L11 [skip-automerge] (#2482)
98bcfe6c5 feat(venue): "Generate this look" on the venue's scene set, with a Looks row in Scene Sets, L7-L9 [skip-automerge] (#2481)
da0dad69b docs(audit): deploy record DH [skip-automerge] (#2480)
$ git diff --shortstat 41ca135c d146ad8b
 33 files changed, 2404 insertions(+), 90 deletions(-)
$ git diff --name-only 41ca135c d146ad8b -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only 41ca135c d146ad8b -- src/migrations/
src/migrations/20261002130000-create-scene-set-looks.js
src/migrations/20261002140000-add-scene-plan-chosen-by-user.js
$ git diff --name-only 41ca135c d146ad8b -- frontend/
frontend/src/components/Episodes/EpisodeScenesTab.jsx
frontend/src/components/EventPackage/EventLookImage.jsx
frontend/src/components/EventPackage/EventLookImage.test.jsx
frontend/src/components/EventPackage/EventVenueLook.test.jsx
frontend/src/pages/EpisodeScriptWriterPage.jsx
frontend/src/pages/EventPackagePage.css
frontend/src/pages/EventPackagePage.jsx
frontend/src/pages/ScenePlannerPage.beatPlan.test.jsx
frontend/src/pages/ScenePlannerPage.css
frontend/src/pages/ScenePlannerPage.edit.test.jsx
frontend/src/pages/ScenePlannerPage.jsx
frontend/src/pages/SceneSetsTab.css
frontend/src/pages/SceneSetsTab.jsx
frontend/src/pages/SceneSetsTab.looks.test.jsx
frontend/src/utils/sceneSets.js
$ git diff --name-only 41ca135c d146ad8b -- src/
src/migrations/20261002130000-create-scene-set-looks.js
src/migrations/20261002140000-add-scene-plan-chosen-by-user.js
src/models/ScenePlan.js
src/routes/episodeBriefRoutes.js
src/routes/episodes.js
src/routes/sceneSetRoutes.js
src/routes/worldEvents.js
src/services/episodeLocationsService.js
src/services/sceneBriefService.js
src/services/sceneGenerationService.js
src/services/scenePlannerService.js
src/services/venueLookImageService.js
$ git diff --name-only 41ca135c d146ad8b -- . ':!frontend' ':!src'
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-10-02_DH.md
docs/audit/F-Deploy-1_Deploy_2026-10-02_DI.md
tests/integration/beatPlanChosen.integration.test.js
tests/integration/venueLookImage.integration.test.js
tests/unit/routes/world-cluster-tier-promotion.test.js
```

This agrees with Evoni's account:
- 4 commits, the four PRs she named;
- 33 files (15 frontend, 12 backend including the two migrations, 3
  docs, 3 tests);
- exactly the two migrations the script and the check named;
- no package or lock file, so no `npm ci` was needed.

## §3. The time

**ATTESTED.** About 13:10–13:18 UTC; ready at 13:17:59, CFO 13:18:07 to
13:18:11, `/health` at 13:18:13Z.

**MEASURED.** The range's last commit, #2483, is at 12:45:00 UTC:

```
$ git log --first-parent --format="%h %cI" 41ca135c..d146ad8b
d146ad8b2 2026-10-02T08:45:00-04:00
9f78974ea 2026-10-02T08:21:32-04:00
98bcfe6c5 2026-10-02T08:04:16-04:00
da0dad69b 2026-10-02T07:41:58-04:00
```

**INFERRED.** Every commit in the range merged before the deploy began,
and `d146ad8b` was `origin/main` when this record was filed (§7), so the
script's fetch reached the head of main. That fits Evoni's window.

## §4. Migrations

**MEASURED.** The tree holds 251 migration files, two more than at DI:

```
$ git ls-tree -r --name-only 41ca135c src/migrations | grep -c '\.js$'
249
$ git ls-tree -r --name-only d146ad8b src/migrations | grep -c '\.js$'
251
```

**ATTESTED (§0):** 2 pending of 251 before the run, 0 pending of 251
after it. This agrees with the tree: DI recorded 0 pending of 249, and
the range adds exactly these two files.

**The script behaved as designed.** It stopped on the pending files, and
the migrations ran **before** the restart, as §7.1 requires on exit 1.
The new code needs both:
- `ScenePlan` now declares `chosen_by_user`, so a model read of
  `scene_plans` selects it (the plan read, the beat save, the planner);
- the look routes and Scene Sets' looks row read `scene_set_looks`.

## §5. What went live — MEASURED

- **#2481 (`98bcfe6c`). L7–L9, "Generate this look"** (§8(hh), with
  answers 1–4 and 6):
  - the Place section's "Generate this look", its cost shown first. With
    an approved base it makes the event's look (a Kontext edit of the
    base), stored in `scene_set_looks`. With none it makes the
    empty-room base and stops, and with a base awaiting approval it
    makes nothing;
  - the look's thumbnail with "Open in Scene Sets";
  - Scene Sets' Looks row: the approved base, then one look per event.
- **#2482 (`9f78974e`). L11, the Beat Plan** (§8(hh)):
  - the Scene Planner renamed "Beat Plan", with the episode's locations
    at its top;
  - the beat editor lists the show's library. A set not yet linked joins
    the episode's locations;
  - a beat Evoni chose is "Chosen by you" and is kept through re-plans
    and location changes.
- **#2480 (`da0dad69`) and #2483 (`d146ad8b`).** The DH and DI deploy
  records. No runtime effect. #2483 also carries a test-only fix to
  `EventVenueLook.test.jsx` (the test waits for its buttons to be
  enabled before clicking).

Three routes were added in the range, all in `worldEvents.js`:

```
$ git diff 41ca135c d146ad8b -- src/routes | grep -E "^[+-]router\."
+router.get('/world/:showId/events/:eventId/look', requireAuth, async (req, res) => {
+router.post('/world/:showId/events/:eventId/look/brief', requireAuth, async (req, res) => {
+router.post('/world/:showId/events/:eventId/look/generate', requireAuth, aiRateLimiter, async (req, res) => {
```

The generate route is the one paid route. It is behind `requireAuth` and
`aiRateLimiter`, and it shows the cost before Evoni confirms (S2).

## §6. Schema change, restart and the CFO

**Schema.** MEASURED (from the migration files); ATTESTED (that they
ran, §0).

```
$ git show d146ad8b:src/migrations/20261002130000-create-scene-set-looks.js | grep -n "createTable\|CREATE UNIQUE INDEX\|CREATE INDEX\|dropTable"
36:      await queryInterface.createTable(TABLE, {
52:        `CREATE UNIQUE INDEX IF NOT EXISTS scene_set_looks_unique_set_event
56:        'CREATE INDEX IF NOT EXISTS scene_set_looks_event ON scene_set_looks (event_id) WHERE deleted_at IS NULL',
63:    if (await tableExists(sequelize, TABLE)) await queryInterface.dropTable(TABLE);
$ git show d146ad8b:src/migrations/20261002140000-add-scene-plan-chosen-by-user.js | grep -n "ALTER TABLE"
29:      await sequelize.query('ALTER TABLE scene_plans ADD COLUMN IF NOT EXISTS chosen_by_user BOOLEAN NOT NULL DEFAULT false', { transaction });
36:    await sequelize.query('ALTER TABLE scene_plans DROP COLUMN IF EXISTS chosen_by_user');
```

- **`scene_set_looks`** (new table): one live look per event per set,
  holding its status, image, brief, estimate, cost, error and dates,
  with `deleted_at`. No backfill; the table starts empty.
- **`scene_plans.chosen_by_user`** (new, boolean, not null, default
  false): every existing beat starts as not chosen.
- Both are guarded and re-runnable. `down` drops the table and the
  column.

**Restart and CFO.** ATTESTED.
- One plain `pm2 restart`: restart count 66, online.
- `.env` unchanged, so a plain restart was right.
- CFO: 89/100, 0 critical, 4 warnings, the same as at DI.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy DJ is `d146ad8b` (#2483),
which is `origin/main` at filing:

```
$ git rev-parse origin/main
d146ad8b299b5890413825ee0e55acf2d750d465
$ git rev-parse --is-shallow-repository
false
```

L10, dressed angles (#2484), is open, not merged. It carries one
migration, `20261002150000-create-scene-set-look-angles`. The Timeline
save fix and L12 + L12a follow it; L12 carries
`20261002160000-add-scenes-scene-plan-id`. They are to deploy together
once all three have merged (Evoni).

## §8. What this document does not do

- It records no credential, database user, process name or host.
- It edits no filed document.
- It reads no production schema, calls no production endpoint (including
  the CFO history), and queries nothing in production.
- It discharges nothing and mints nothing.
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

- **Continuity:** continuous from DI (`41ca135c`, restart 65). The tree
  agrees with Evoni's account: 4 commits, 33 files, the two migrations,
  no package or lock file.
- **Deploy:** the script stopped on the pending migrations as designed.
  By hand, per §7.1:
  - fast-forward; 2 pending, migrated (`scene_set_looks` created,
    `scene_plans.chosen_by_user` added), then 0 pending of 251;
  - build; one restart (count 66); ready; `/health` healthy and
    connected.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from DI.
- **App check:** not done yet (Evoni).
- **Live:** L7–L9 "Generate this look" and the Looks row; L11 the Beat
  Plan.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
