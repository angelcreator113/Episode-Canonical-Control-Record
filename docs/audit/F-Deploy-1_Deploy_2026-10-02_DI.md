| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DI, 2026-10-02, backend and frontend. Four commits, 26 files, from `8ab9f8bd` (where DH left production) to `41ca135c`: L(c) the Place picker (#2476), L(d) the planner's location roles and angle kinds (#2478), L(e) scene image readiness (#2479) and the DG record (#2477), with one migration; no package change; one plain restart. `scripts/deploy-prod.sh` stopped on the pending migration as designed, and Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. CFO 89/100 with 4 warnings, unchanged from DH. The app check has not been done yet. The restart count is continuous from DH (64 → 65).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-02_DH.md`, whose deploy this one
follows. It edits no filed document.

Basis: the commit Deploy DI moved production to,
`41ca135cc435ed55cb839ef65f18ce2d6113f2a5` (#2477), read 2026-10-02 from
`origin/main` at `da0dad69b8fe55d6617f3032b24d2b3fd3add45e` (§7).

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
path, account number, database user or ARN. The database user the
migration ran as is left out, as in the CW–DH records.

**The letter.** This deploy is lettered **DI**, the letter after DH, as
Evoni named it ("deploy record DI"). It follows DH
(`F-Deploy-1_Deploy_2026-10-02_DH.md`, filed in #2480).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-02, about
11:25–11:36 UTC, per `DEVELOPMENT_WORKFLOW.md` §7.1:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `8ab9f8bd` (where DH left production), fetched 4 commits to `41ca135c`
   (#2476, #2478, #2479, #2477). The script **stopped at step 3** on
   `20261002120000-add-scene-angle-kind`. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty.
   - `git merge --ff-only` to `41ca135c`: 26 files.
   - `check-pending-migrations` against the canon instance: **1 pending
     of 249**, exit 1.
3. **Migrate.** `db:migrate` as a database user (name left out). Its
   password was entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261002120000` migrated, 0.051 s. Angle kinds backfilled: **21**.
   - npm printed a "new major version" notice. It was ignored; npm was
     not upgraded.
   - Re-check: **0 pending of 249**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 38.78 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 65, online.
   - Ready at 11:35:34.
   - `/health` at 2026-10-02T11:35:49Z: healthy, database connected,
     uptime 20.1 s.
5. **CFO.** 11:35:42–11:35:46: **89/100**, 0 critical, **4 warnings**.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed features work or fail in production.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse 8ab9f8bd 41ca135c
8ab9f8bd417d968a2fd83d0def4c77bff66c6a1c
41ca135cc435ed55cb839ef65f18ce2d6113f2a5
$ git merge-base --is-ancestor 8ab9f8bd 41ca135c && echo "ancestor: yes"
ancestor: yes
```

DH left production at `8ab9f8bd` with restart count 64 (DH record §0).
DI starts at `8ab9f8bd`, and its one restart brings the count to 65
(ATTESTED, §0). **No gap:** no deploy ran between DH and DI that this
account does not show.

## §2. The range — MEASURED

```
$ git rev-list --count 8ab9f8bd..41ca135c
4
$ git log --oneline 8ab9f8bd..41ca135c
41ca135cc docs(audit): deploy record DG [skip-automerge] (#2477)
33fb358d4 feat(planner): scene image readiness on the checklist and the planner header, L(e) [skip-automerge] (#2479)
823a0d4da feat(planner): beats mapped to location roles and angle kinds, with missing-angle actions, L(d) [skip-automerge] (#2478)
3263b3e28 feat(events): the Place scene-set picker shows thumbnails, search and each set's angles, L(c) [skip-automerge] (#2476)
$ git diff --shortstat 8ab9f8bd 41ca135c
 26 files changed, 1720 insertions(+), 48 deletions(-)
$ git diff --name-only 8ab9f8bd 41ca135c -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only 8ab9f8bd 41ca135c -- src/migrations/
src/migrations/20261002120000-add-scene-angle-kind.js
$ git diff --name-only 8ab9f8bd 41ca135c -- frontend/
frontend/src/components/EpisodeLocationsStep.css
frontend/src/components/EpisodeLocationsStep.jsx
frontend/src/components/Episodes/EpisodeProductionChecklist.jsx
frontend/src/components/Episodes/EpisodeProductionChecklist.sceneImages.test.jsx
frontend/src/components/Episodes/EpisodeScenesTab.jsx
frontend/src/pages/EventPackagePage.css
frontend/src/pages/EventPackagePage.jsx
frontend/src/pages/EventPackagePage.sceneSet.test.jsx
frontend/src/pages/EventPackagePage.startEpisode.test.jsx
frontend/src/pages/ScenePlannerPage.css
frontend/src/pages/ScenePlannerPage.jsx
frontend/src/pages/ScenePlannerPage.missingAngle.test.jsx
frontend/src/pages/SceneSetsTab.jsx
$ git diff --name-only 8ab9f8bd 41ca135c -- src/
src/constants/beatLocations.js
src/migrations/20261002120000-add-scene-angle-kind.js
src/models/SceneAngle.js
src/routes/episodeBriefRoutes.js
src/routes/episodes.js
src/routes/sceneSetRoutes.js
src/routes/worldEvents.js
src/services/episodeGeneratorService.js
src/services/planLocationsService.js
src/services/scenePlannerService.js
$ git diff --name-only 8ab9f8bd 41ca135c -- . ':!frontend' ':!src'
docs/audit/F-Deploy-1_Deploy_2026-10-02_DG.md
tests/integration/plannerAngles.integration.test.js
tests/unit/services/planLocationsService.readiness.test.js
```

This agrees with Evoni's account:
- 4 commits, the four PRs she named;
- 26 files (13 frontend, 10 backend including the migration, 1 docs,
  2 tests);
- exactly the one migration the script and the check named;
- no package or lock file, so no `npm ci` was needed.

## §3. The time

**ATTESTED.** About 11:25–11:36 UTC; ready at 11:35:34, CFO 11:35:42 to
11:35:46, `/health` at 11:35:49Z.

**MEASURED.** The range's last commit, #2477, is at 07:34:26 UTC:

```
$ git log --first-parent --format="%h %cI" 8ab9f8bd..41ca135c
41ca135cc 2026-10-02T03:34:26-04:00
33fb358d4 2026-10-02T03:24:40-04:00
823a0d4da 2026-10-02T02:51:29-04:00
3263b3e28 2026-10-02T02:33:24-04:00
```

**INFERRED.** The script's fetch reached `41ca135c` and not #2480 (the
DH record), which merged at 11:42 UTC, after the deploy. That fits
Evoni's window.

## §4. Migrations

**MEASURED.** The tree holds 249 migration files, one more than at DH:

```
$ git ls-tree -r --name-only 8ab9f8bd src/migrations | grep -c '\.js$'
248
$ git ls-tree -r --name-only 41ca135c src/migrations | grep -c '\.js$'
249
```

**ATTESTED (§0):** 1 pending of 249 before the run, 0 pending of 249
after it. This agrees with the tree: DH recorded 0 pending of 248, and
the range adds exactly this file.

**The script behaved as designed.** It stopped on the pending file, and
the migration ran **before** the restart, as §7.1 requires on exit 1.
The new code reads the column: `SceneAngle` now declares `angle_kind`, so
an unrestricted model read of `scene_angles` selects it, and the
planner's beat mapping, the plan read and Start Episode's plan rows read
it. So it had to run first.

**The npm notice.** ATTESTED (§0): an npm "new major version" notice was
printed during the migrate step and ignored; npm was not upgraded. It
changed nothing in the tree or the database.

## §5. What went live — MEASURED

- **#2476 (`3263b3e2`). L(c), the Place picker** (L2, Q11, §8(hh)): the
  Event Package's scene-set picker shows each set's thumbnail, type and
  venue; search covers name, venue and type; the highlighted set shows a
  strip of its angles.
- **#2478 (`823a0d4d`). L(d), the planner's mapping** (L4; Q5, Q17–Q19):
  - `scene_angles.angle_kind`, set on new angles and filled for existing
    ones from their labels;
  - each beat at its location's role, the event beats on the angle of
    their kind (arrival on the entrance or exterior, the event on the
    main interior);
  - each beat's missing angle named in the planner, with Upload image and
    Generate angle; the Episode Locations step lists the same gaps;
  - suggest-angles offers the event's areas and uses beats 1–14.
- **#2479 (`33fb358d`). L(e), readiness** (L5, Q21): the plan read's
  readiness, the production checklist's optional "Scene images for every
  beat" and the planner header's flag; never blocking.
- **#2477 (`41ca135c`).** The DG deploy record. No runtime effect.

No route was added or removed in the range:

```
$ git diff 8ab9f8bd 41ca135c -- src/routes | grep -cE "^[+-]router\."
0
```

## §6. Schema change, restart and the CFO

**Schema.** MEASURED (from the migration file); ATTESTED (that it ran,
§0).

```
$ git show 41ca135c:src/migrations/20261002120000-add-scene-angle-kind.js | grep -n "ALTER TABLE\|UPDATE scene_angles"
30:      await sequelize.query('ALTER TABLE scene_angles ADD COLUMN IF NOT EXISTS angle_kind VARCHAR(30)', { transaction });
32:        `UPDATE scene_angles SET angle_kind = CASE UPPER(angle_label)
47:    await sequelize.query('ALTER TABLE scene_angles DROP COLUMN IF EXISTS angle_kind');
```

- **`scene_angles.angle_kind`** (new, VARCHAR(30), nullable): exterior,
  entrance, main_interior, area, detail or other.
- The backfill, on live angles with no kind, set ESTABLISHING → exterior,
  DOORWAY → entrance and WIDE → main_interior: **21 angles** (ATTESTED,
  §0). Every other angle keeps no kind.
- Guarded and re-runnable; `down` drops the column.

**Restart and CFO.** ATTESTED.
- One plain `pm2 restart`: restart count 65, online.
- `.env` unchanged, so a plain restart was right.
- CFO: 89/100, 0 critical, 4 warnings, the same as at DH.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy DI is `41ca135c` (#2477).
`origin/main` at filing is one commit beyond it, the DH record (#2480),
with no migration:

```
$ git rev-parse origin/main
da0dad69b8fe55d6617f3032b24d2b3fd3add45e
$ git log --oneline 41ca135c..origin/main
da0dad69b docs(audit): deploy record DH [skip-automerge] (#2480)
$ git diff --name-only 41ca135c origin/main -- src/migrations | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

L7–L9 ("Generate this look", #2481) is open, not merged. It carries one
migration, `20261002130000-create-scene-set-looks`, and is to deploy
separately (Evoni).

## §8. What this document does not do

- It records no credential, database user or host.
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

- **Continuity:** continuous from DH (`8ab9f8bd`, restart 64). The tree
  agrees with Evoni's account: 4 commits, 26 files, the one migration, no
  package or lock file.
- **Deploy:** the script stopped on the pending migration as designed.
  By hand, per §7.1:
  - fast-forward; 1 pending, migrated (`angle_kind` added, 21 angles
    backfilled), then 0 pending of 249;
  - build; one restart (count 65); ready; `/health` healthy and
    connected.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from DH.
- **App check:** not done yet (Evoni).
- **Live:** L(c) the Place picker; L(d) the planner's roles and angle
  kinds; L(e) readiness.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
