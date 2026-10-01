| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CY, 2026-10-01, backend and frontend. Two migrations ran before the restart, there was no dependency change (only `package.json`'s `test` script changed), and there was one plain restart. `scripts/deploy-prod.sh` stopped on the pending migrations as designed; Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. Season Arc PRs 1–4 go live with the script writer's season fix and the Season Arc rulings. CFO 89/100 with 4 warnings, unchanged from CX. Evoni's app check passed for the Season Arc roadmap, slot 1 and her episode's season position. Production is one commit behind `origin/main` (#2442, merged after CY). A gap before CY: one deploy after CX is unrecorded (§1).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-01_CX.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `d760ba00dca805ed579cf5f3c8b76fa705df1163` (#2442),
read 2026-10-01. Deploy CY moved production to `a077ad55` (#2441), one
commit behind it (§8).

**Author**

JAWIHP / Evoni — Prime Studios

**Status**

RECORD. Standings:
- **ATTESTED**: Evoni's account of her terminal, as she gave it.
- **MEASURED**: what this repository shows, with output pasted.
- **INFERRED**: marked where used.
- **CANNOT-TELL**: marked where used.

Nothing is upgraded. This document closes no keystone and discharges no
owed item. It mints no FD, XK or PE number, and it rules on nothing.

It records no token, email address, password, hostname, IP address, key
path, account number, database user or ARN. The database user the
migrations ran as is left out, as in the CW and CX records.

**The letter.** This deploy is lettered **CY**. It follows CX
(`F-Deploy-1_Deploy_2026-10-01_CX.md`, filed in #2434).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-01, about
18:30–18:38 UTC:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `9df565d0` (not `5ff0a20a`, where CX left production; see §1), fetched
   6 commits to `a077ad55` (#2435, #2436, #2437, #2439, #2440, #2441) and
   **stopped at step 3** on two migrations. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The `package.json` diff was only the `test` script (`--runInBand`
     removed); the lockfile was unchanged, so no `npm ci` was run.
   - `git merge --ff-only` to `a077ad55`: 30 files.
   - `check-pending-migrations` against the canon instance: **2 pending of
     243**, exit 1.
3. **Migrate.** `db:migrate` as a separate database user (name left out).
   Its password was entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261001230000`, 0.087 s: 24 slots for 1 active arc; 1 current
     episode placed in slot 1; 0 left to place.
   - `20261001240000`, 0.027 s: season context snapshotted on 1 slotted
     episode.
   - Re-check: **0 pending of 243**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 34.93 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 55, online.
   - Ready at 18:37:58.
   - `/health` at 2026-10-01T18:38:12Z: healthy, database connected,
     uptime 20.1 s.
   - No `FONT` lines in the log.
   - `episode-worker` stopped (standing).
5. **CFO.** 18:38:06–18:38:09: **89/100**, 0 critical, **4 warnings**.

**App check (Evoni), ATTESTED, given after the deploy:** "the Season Arc
works (roadmap, slot 1, my episode's season position)."

- **The roadmap** (#2437) shows in production.
- **Slot 1** holds her current episode, as the first migration logged.
- **Her episode's season position** (#2440): the Overview's Season
  Position reads from the snapshot the second migration wrote. INFERRED:
  "S1 · E1 · Phase 1: Foundation"; the account does not quote it.
- Not covered by the check: pencilling (#2439) and acceptance (#2441).
  Neither is said to work or to fail.

## §1. Identity, continuity and the gap

**MEASURED.**

```
$ git merge-base --is-ancestor 5ff0a20a 9df565d0 && echo "ancestor: yes"
ancestor: yes
$ git merge-base --is-ancestor 9df565d0 a077ad55 && echo "ancestor: yes"
ancestor: yes
$ git rev-parse 5ff0a20a 9df565d0 a077ad55
5ff0a20a646c5fdbee257cb6a885672390911504
9df565d015bcaed79a558a207bd2b9016d3e505d
a077ad55e2ac1c38113ca550d1a74d929bd7b4b2
```

**A gap after CX.** CX left production at `5ff0a20a` with restart count
53 (CX record §6, §8). The script's CY run started at `9df565d0`, and
CY's single restart brought the count to 55 (ATTESTED, §0). So one
deploy ran between CX and CY that no record covers:
- **MEASURED:** it moved production from `5ff0a20a` to `9df565d0`, a
  docs-only range, the CX deploy record itself:

  ```
  $ git log --oneline 5ff0a20a..9df565d0
  9df565d01 docs(audit): deploy record CX [skip-automerge] (#2434)
  $ git diff --stat 5ff0a20a 9df565d0 | tail -1
   1 file changed, 302 insertions(+)
  ```
- **INFERRED:** it made one restart (53 → 54), since CY's one restart
  ends at 55.
- **CANNOT-TELL** beyond that: when it ran, how (script or by hand),
  and whether it built the frontend or checked migrations (the range
  holds no migration and no frontend file, so neither was needed).

**The restart count from here is continuous (ATTESTED):** CY's one
restart brings it to 55. The script's stopped run made no restart.

## §2. The range — MEASURED

```
$ git rev-list --count 9df565d0..a077ad55
6
$ git log --oneline 9df565d0..a077ad55
a077ad55e feat(season): accepting an episode updates its slot, goals and phase (Season Arc PR 4) [skip-automerge] (#2441)
43945f769 feat(season): snapshot the season context onto the episode; Overview and scripts read it (Season Arc PR 3) [skip-automerge] (#2440)
32834e572 feat(season): pencil events into future slots, place episodes, lock at Start Episode (Season Arc PR 2) [skip-automerge] (#2439)
ad84a8458 feat(season): the season's 24 slots and a read-only roadmap; Extend removed (Season Arc PR 1) [skip-automerge] (#2437)
168c2261b fix(scripts): the script writer's SEASON ARC block reads the active arc [skip-automerge] (#2436)
feb37ab1a docs: Season Arc rulings, read and design note [skip-automerge] (#2435)
$ git diff --shortstat 9df565d0 a077ad55
 30 files changed, 2988 insertions(+), 170 deletions(-)
$ git diff --name-only 9df565d0 a077ad55 -- src/migrations/
src/migrations/20261001230000-create-season-slots.js
src/migrations/20261001240000-add-episode-season-context.js
$ git diff --name-only 9df565d0 a077ad55 -- package.json package-lock.json frontend/package.json frontend/package-lock.json
package.json
$ git diff 9df565d0 a077ad55 -- package.json | grep '^[-+] '
-    "test": "cross-env NODE_ENV=test NODE_OPTIONS=--max-old-space-size=5120 jest --coverage --runInBand --forceExit",
+    "test": "cross-env NODE_ENV=test NODE_OPTIONS=--max-old-space-size=5120 jest --coverage --forceExit",
$ git diff --name-only 9df565d0 a077ad55 -- frontend/ | wc -l
4
$ git diff --name-only 9df565d0 a077ad55 -- src/ | wc -l
12
```

This agrees with Evoni's account:
- 6 commits, the six PRs she named;
- 30 files;
- exactly the two migrations the check listed;
- the only package change is the `test` script, which the running app
  never reads, and no lock file changed, so skipping `npm ci` was right.

4 frontend files changed (two of them tests), so the `vite build` was
needed. 12 backend files changed (two of them migrations); the restart
was needed to load the others.

## §3. The time

**ATTESTED.** The deploy ran about 18:30–18:38 UTC: ready at 18:37:58,
CFO done 18:38:09, `/health` at 18:38:12.

**MEASURED.** The range's last commit, #2441, is at 18:10:02 UTC:

```
$ git log --first-parent --format="%h %cI" 9df565d0..a077ad55 | head -2
a077ad55e 2026-10-01T14:10:02-04:00
43945f769 2026-10-01T13:59:26-04:00
```

**INFERRED.** The script's fetch reached `a077ad55`, so it ran at or after
18:10:02, which fits the "about 18:30" start.

## §4. Migrations

**MEASURED.** The tree holds 243 migration files, two more than at CX:

```
$ git ls-tree -r --name-only a077ad55 src/migrations | grep -c '\.js$'
243
```

**ATTESTED (§0):** 2 pending of 243 before the run, 0 pending of 243 after
it. This agrees with the tree: CX recorded 0 pending of 241, and the range
adds exactly these two files.

**The script behaved as designed.** It stopped on the pending files, and
the migrations ran **before** the restart, as §7.1 requires on exit 1.
The second adds a column the new code's `Episode` model reads, so it had
to.

**The migrations' own counts.** The counts Evoni gave are the ones the
migrations log. MEASURED:

```
$ git show a077ad55:src/migrations/20261001230000-create-season-slots.js | grep -n "console.log" -A1
144:      console.log(`[migration 20261001230000] ${created} slot(s) for ${arcs.length} active arc(s); `
145-        + `${placed} current episode(s) placed in slot 1; ${unplaced} episode(s) left for Evoni to place`);
$ git show a077ad55:src/migrations/20261001240000-add-episode-season-context.js | grep -n "console.log"
104:      console.log(`[migration 20261001240000] season context snapshotted on ${slots.length} slotted episode(s)`);
```

- "24 slots for 1 active arc; 1 current episode placed in slot 1; 0 left
  to place" is the shape Evoni described before the build: one live
  episode, the earlier one deleted (§8(ff) Q1, Q4; PR #2437).
- "Season context snapshotted on 1 slotted episode" is that same episode;
  Evoni's app check saw its season position (§0).

## §5. What went live — MEASURED

- **#2435 (`feb37ab1`):** the Season Arc rulings A1–A8 and Evoni's
  answers recorded as `docs/EVENT_EPISODE_FLOW.md` §8(ff);
  `docs/SEASON_ARC_READ.md` and `docs/SEASON_ARC_DESIGN_NOTE.md`. No
  runtime effect.
- **#2436 (`168c2261`):** the script writer's SEASON ARC prompt block
  reads the active arc (its query named two columns `show_arcs` does not
  have, so the block was always empty).
- **#2437 (`ad84a845`): Season Arc PR 1.** `season_slots`, 24 per
  season; the read-only roadmap (`GET /api/v1/world/:showId/season/roadmap`);
  Extend removed. Also `npm test` drops `--runInBand` and
  `jest.config.js` adds `workerIdleMemoryLimit` (CI only; the leak behind
  it is owed in issue 2438).
- **#2439 (`32834e57`): PR 2.** Pencilling events into future slots,
  placing episodes, and Start Episode locking the slot.
- **#2440 (`43945f76`): PR 3.** `episodes.season_context`, snapshotted at
  Start Episode and placement; the Overview's Season Position and both
  script generators read it.
- **#2441 (`a077ad55`): PR 4.** Accepting an episode records the slot's
  actual outcome and pressure, sets career goals from what they measure
  (no more +1), and calls `checkPhaseTransition`; at a phase boundary the
  roadmap asks before advancing.

New routes in the range, all behind `requireAuth`: the roadmap, the
slot's event and episode `PUT`s.

## §6. Restarts, workers and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 55, online.
- `.env` unchanged, so a plain restart was right.
- `episode-worker` stopped, as at every deploy (CX record §6).
- No `FONT` lines in the log.
- CFO: 89/100, 0 critical, 4 warnings, the same as at CX.

## §7. Schema changes

**MEASURED** (from the migration files); **ATTESTED** (that they ran, §0).

```
$ git show a077ad55:src/migrations/20261001230000-create-season-slots.js | grep -n "createTable('season_slots'\|CREATE UNIQUE INDEX\|CREATE INDEX"
71:        await queryInterface.createTable('season_slots', {
102:        `CREATE UNIQUE INDEX IF NOT EXISTS season_slots_arc_slot_live
105:        'CREATE INDEX IF NOT EXISTS season_slots_show_id ON season_slots (show_id)', { transaction });
$ git show a077ad55:src/migrations/20261001240000-add-episode-season-context.js | grep -n "addColumn('episodes'"
54:        await queryInterface.addColumn('episodes', 'season_context', { type: Sequelize.JSONB, allowNull: true }, { transaction });
```

- **`season_slots`** (new): one row per (arc, slot 1–24), unique per arc
  and slot while live; its phase, a pencilled event, its episode, the
  intention and result columns, and `locked_at`. Rows written: the 24
  slots of the active season, slot 1 holding the current episode and
  locked.
- **`episodes.season_context`** (new, JSONB, nullable). Rows written: the
  one slotted episode's snapshot, its `season_number`, and its brief's
  `arc_number` and `position_in_arc` where empty.
- Both are guarded and re-runnable; both `down`s drop what they add.

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CY is `a077ad55` (#2441).
`origin/main` at filing is one commit ahead: Season Arc PR 5, merged after
CY ran so that CY would not carry it.

```
$ git log --oneline a077ad55..origin/main
d760ba00d feat(season): slot intentions, edited or auto-drafted; the range sets the brief (Season Arc PR 5) [skip-automerge] (#2442)
$ git rev-parse --is-shallow-repository
false
```

**The app check** (§0) covered the roadmap, slot 1 and the episode's
season position. Pencilling and acceptance were not part of it.

**Next.** #2442 ships in the next deploy. It adds no migration:

```
$ git diff --name-only a077ad55 origin/main -- src/migrations/ | wc -l
0
```

## §9. What this document does not do

- It records no credential, database user or host.
- It edits no filed document; the gap in §1 is recorded here, not in the
  CX record.
- It reads no production schema, calls no production endpoint (including
  the CFO history), and queries nothing in production.
- It discharges nothing and mints nothing.
- The filing session made no host, AWS, database or Cognito contact.

## §10. Tails — re-derived, not carried

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

- **Continuity:** one unrecorded deploy after CX moved production to
  `9df565d0` (docs only, #2434; restart 54 INFERRED; CANNOT-TELL beyond
  that). From there the tree agrees with Evoni's account:
  - 6 commits and 30 files;
  - the two migrations;
  - only the `test` script in `package.json`, no lock file.

  Production is at `a077ad55`, one commit behind `origin/main` (#2442).
- **Deploy:** the script stopped on the pending migrations as designed.
  Finished by hand per §7.1:
  - 2 pending of 243;
  - migrated (24 slots, the current episode in slot 1; its season
    context snapshotted), then 0 pending of 243;
  - build;
  - one restart (count 55);
  - `/health` healthy and connected;
  - no `FONT` lines; `episode-worker` stopped.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from CX.
- **App check (Evoni, ATTESTED):** the Season Arc works: the roadmap,
  slot 1, and her episode's season position (§0). Pencilling and
  acceptance were not checked.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
