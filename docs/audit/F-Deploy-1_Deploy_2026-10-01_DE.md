| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DE, 2026-10-01, backend and frontend. Four commits, 27 files: the DD record (#2456), the `generateAngle` "spec is not defined" fix (#2458), Episode Money Phase B PR 4 (#2457) and Season Arc A9/A10 (#2459), with two migrations; no package change; one plain restart. `scripts/deploy-prod.sh` stopped on the pending migrations as designed, and Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. CFO 89/100 with 4 warnings, unchanged from DD. The app check has not been done yet. The restart count is continuous from DD (60 → 61). Production was left at `e43014ed`; Deploy DF (`F-Deploy-1_Deploy_2026-10-02_DF.md`) followed it.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-01_DD.md`, whose deploy this one
follows. It edits no filed document.

Basis: the commit Deploy DE moved production to, `e43014edb80d91ca90728f2ee00da8fd03dc9f2a`
(#2459), read 2026-10-02 from `origin/main` at `a63eb7b8`. DE is filed
after DF, which followed it (§7).

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
migrations ran as is left out, as in the CW–DA records.

**The letter.** This deploy is lettered **DE**, the letter after DD, as
Evoni named it on 2026-10-01 ("I'm deploying DE now (main e43014ed)"). It
follows DD (`F-Deploy-1_Deploy_2026-10-01_DD.md`, filed in #2456).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-01, about
23:30–23:40 UTC, per `DEVELOPMENT_WORKFLOW.md` §7.1:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `d8bcffbd` (where DD left production), fetched 4 commits to `e43014ed`
   (#2456, #2458, #2457, #2459). The script **stopped at step 3** on
   `20261001260000-add-episode-money-plan` and
   `20261001270000-add-season-slot-story-purposes`. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty.
   - `git merge --ff-only` to `e43014ed`: 27 files.
   - `check-pending-migrations` against the canon instance: **2 pending
     of 246**, exit 1.
3. **Migrate.** `db:migrate` as a database user (name left out). Its
   password was entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261001260000` migrated, 0.031 s.
   - `20261001270000` migrated, 0.021 s; `story_purposes` backfilled on
     1 slot.
   - Re-check: **0 pending of 246**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 35.99 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 61, online.
   - Ready at 23:39:50.
   - `/health` at 2026-10-01T23:40:04Z: healthy, database connected,
     uptime 20.1 s.
   - `episode-worker` stopped (standing).
5. **CFO.** 23:39:58–23:40:04: **89/100**, 0 critical, **4 warnings**.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed features work or fail in production.

**Evoni's note, ATTESTED**, verbatim: "episode-worker is stopped in
production, so the spec bug's spend was one still per directly generated
angle, no worker retries." (See §5, #2458.)

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse d8bcffbd e43014ed
d8bcffbd417892f4d93309b5e3262e4d17c073bb
e43014edb80d91ca90728f2ee00da8fd03dc9f2a
$ git merge-base --is-ancestor d8bcffbd e43014ed && echo "ancestor: yes"
ancestor: yes
```

DD left production at `d8bcffbd` with restart count 60 (DD record §0,
§6). DE starts at `d8bcffbd`, and its one restart brings the count to 61
(ATTESTED, §0). **No gap:** no deploy ran between DD and DE that this
account does not show. DF then started at `e43014ed` with one restart to
62 (DF record §0, §1), so the count runs 60 → 61 → 62 with no restart
unaccounted for.

## §2. The range — MEASURED

```
$ git rev-list --count d8bcffbd..e43014ed
4
$ git log --oneline d8bcffbd..e43014ed
e43014edb feat(season): a started slot's intention stays editable while its episode is a draft; a slot holds up to three story purposes (Season Arc A9, A10) [skip-automerge] (#2459)
cdcc68b56 feat(money): the plan is saved at Start Episode and reconciled with what posted after Complete (Episode Money Phase B PR 4) [skip-automerge] (#2457)
530a83aaf fix(scenes): generateAngle no longer throws "spec is not defined" after every still [skip-automerge] (#2458)
b7dfac7e7 docs(audit): deploy record DD [skip-automerge] (#2456)
$ git diff --shortstat d8bcffbd e43014ed
 27 files changed, 1752 insertions(+), 66 deletions(-)
$ git diff --name-only d8bcffbd e43014ed -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only d8bcffbd e43014ed -- src/migrations/
src/migrations/20261001260000-add-episode-money-plan.js
src/migrations/20261001270000-add-season-slot-story-purposes.js
$ git diff --name-only d8bcffbd e43014ed -- frontend/ | wc -l
5
$ git diff --name-only d8bcffbd e43014ed -- src/
src/migrations/20261001260000-add-episode-money-plan.js
src/migrations/20261001270000-add-season-slot-story-purposes.js
src/models/Episode.js
src/models/SeasonSlot.js
src/services/episodeCompletionService.js
src/services/episodeGeneratorService.js
src/services/episodeMoneyLines.js
src/services/episodeMoneyService.js
src/services/episodeScriptWriterService.js
src/services/groundedScriptGeneratorService.js
src/services/sceneGenerationService.js
src/services/seasonIntentionService.js
src/services/seasonSlotService.js
src/services/storyThreadService.js
$ git diff --name-only d8bcffbd e43014ed -- . ':!frontend' ':!src'
docs/EVENT_EPISODE_FLOW.md
docs/audit/F-Deploy-1_Deploy_2026-10-01_DD.md
tests/integration/episodeMoneyReconciliation.integration.test.js
tests/integration/seasonIntention.integration.test.js
tests/integration/seasonPurposes.integration.test.js
tests/unit/services/episodeMoneyLines.test.js
tests/unit/services/sceneGenerationAngleSpec.test.js
tests/unit/services/seasonPurposes.test.js
```

This agrees with Evoni's account:
- 4 commits, the four PRs she named;
- 27 files (5 frontend, 14 backend including the 2 migrations, 2 docs,
  6 tests);
- exactly the two migrations the script and the check named;
- no package or lock file, so no `npm ci` was needed.

## §3. The time

**ATTESTED.** About 23:30–23:40 UTC; ready at 23:39:50, CFO 23:39:58 to
23:40:04, `/health` at 23:40:04Z.

**MEASURED.** The range's last commit, #2459, is at 23:34:13 UTC:

```
$ git log --first-parent --format="%h %cI" d8bcffbd..e43014ed
e43014edb 2026-10-01T19:34:13-04:00
cdcc68b56 2026-10-01T19:24:12-04:00
530a83aaf 2026-10-01T19:10:05-04:00
b7dfac7e7 2026-10-01T18:53:23-04:00
```

**INFERRED.** The script's fetch reached `e43014ed`, so it ran at or after
23:34:13. That fits Evoni's window, and her ready line at 23:39:50.

## §4. Migrations

**MEASURED.** The tree holds 246 migration files, two more than at DD:

```
$ git ls-tree -r --name-only d8bcffbd src/migrations | grep -c '\.js$'
244
$ git ls-tree -r --name-only e43014ed src/migrations | grep -c '\.js$'
246
```

**ATTESTED (§0):** 2 pending of 246 before the run, 0 pending of 246
after it. This agrees with the tree: DD recorded 0 pending of 244, and
the range adds exactly these two files.

**The script behaved as designed.** It stopped on the pending files, and
the migrations ran **before** the restart, as §7.1 requires on exit 1.
The new code reads both columns: the Money tab's reconciliation reads
`episodes.money_plan`, and the roadmap, intentions and season snapshot
read `season_slots.story_purposes`. So they had to run first.

## §5. What went live — MEASURED

- **#2456 (`b7dfac7e`).** The DD deploy record. No runtime effect.
- **#2458 (`530a83aa`).** `generateAngle` no longer throws "spec is not
  defined" after the still is made.
  - Since CW, every angle generation had thrown a ReferenceError after its
    still was made, billed and stored. The angle was then marked failed,
    with its `still_image_url` and the set's `generation_cost` not saved.
  - Evoni's note (§0): `episode-worker` is stopped in production. So the
    spend was one still per directly generated angle, with no worker
    retries.
  - Angles that failed this way need regenerating. Listing them is
    Evoni's own read; this record makes no production query.
- **#2457 (`cdcc68b5`). Episode Money Phase B PR 4** (§8(gg) MB6 and her
  four accepted choices):
  - Start Episode saves the episode's money plan.
  - After Complete, the Money tab's Reconciliation section compares the
    plan with what posted, line by line.
  - An episode started before this is compared with its current lines,
    and says so.
- **#2459 (`e43014ed`). Season Arc A9 and A10** (§8(ff), with her six
  accepted choices):
  - A started slot's intention stays editable while its episode is a
    draft, updating the episode's season snapshot and brief, and locks
    when the episode is accepted.
  - A slot holds up to three story purposes, one primary, each with an
    optional thread.
  - The script writer receives all purposes, primary first.
  - The roadmap card shows the primary purpose with "+N more".

No route was added or removed in the range:

```
$ git diff d8bcffbd e43014ed -- src/routes | grep -c "^[+-]router\."
0
```

## §6. Schema change, restart and the CFO

**Schema.** MEASURED (from the migration files); ATTESTED (that they ran,
§0).

```
$ git show e43014ed:src/migrations/20261001260000-add-episode-money-plan.js | grep -n "addColumn\|removeColumn"
45:        await queryInterface.addColumn('episodes', 'money_plan', { type: Sequelize.JSONB, allowNull: true }, { transaction });
53:      await queryInterface.removeColumn('episodes', 'money_plan');
$ git show e43014ed:src/migrations/20261001270000-add-season-slot-story-purposes.js | grep -n "addColumn\|jsonb_build_array\|WHERE story_purposes IS NULL\|removeColumn"
44:        await queryInterface.addColumn('season_slots', 'story_purposes', { type: Sequelize.JSONB, allowNull: true }, { transaction });
48:            SET story_purposes = jsonb_build_array(jsonb_build_object(
50:          WHERE story_purposes IS NULL AND story_purpose IS NOT NULL AND btrim(story_purpose) <> ''`,
60:      await queryInterface.removeColumn('season_slots', 'story_purposes');
```

- **`episodes.money_plan`** (new, JSONB, nullable): the money plan saved
  at Start Episode. No backfill: no rows written.
- **`season_slots.story_purposes`** (new, JSONB, nullable): a slot's
  purposes, primary first.
  - The backfill filled it from `story_purpose` and `story_thread_id` on
    slots that had a purpose: **1 slot** (ATTESTED, §0).
  - `story_purpose` and `story_thread_id` stay as the primary's copy.
- Both are guarded and re-runnable, and each `down` drops its column.

**Restart and CFO.** ATTESTED.
- One plain `pm2 restart`: restart count 61, online.
- `.env` unchanged, so a plain restart was right.
- `episode-worker` stopped, as at every deploy.
- CFO: 89/100, 0 critical, 4 warnings, the same as at DD.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy DE was `e43014ed` (#2459).
DE is filed after the deploy that followed it: Deploy DF moved production
on to `22824569` (DF record), and `origin/main` at filing is one commit
beyond that (#2465, the A9 draft change, not yet deployed).

```
$ git log --oneline e43014ed..origin/main
a63eb7b86 feat(season): Draft with AI on a started slot drafts from its episode, never over a purpose Evoni edited (A9 as changed) [skip-automerge] (#2465)
22824569e fix(events): attaching an event with no scene set uses its venue's sets, never a loose first match (F3) [skip-automerge] (#2464)
669d7fdc4 fix(events): attaching an event commits its required links together; a scene set that can't be linked asks to reconnect (F2) [skip-automerge] (#2463)
f4df79616 fix(venue): Generate Venue Images makes the missing image for an attached scene set and reports what happened (F1) [skip-automerge] (#2461)
fea8b5953 ci: run ESLint (npm run lint) on every PR and push [skip-automerge] (#2460)
$ git diff --name-only e43014ed origin/main -- src/migrations | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

Nothing after DE adds a migration.

## §8. What this document does not do

- It records no credential, database user or host.
- It edits no filed document.
- It reads no production schema, calls no production endpoint (including
  the CFO history), and queries nothing in production. It does not list
  the angles that failed with "spec is not defined".
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

- **Continuity:** continuous from DD (`d8bcffbd`, restart 60); DF follows
  (61 → 62). The tree agrees with Evoni's account: 4 commits, 27 files,
  the two migrations, no package or lock file.
- **Deploy:** the script stopped on the pending migrations as designed.
  By hand, per §7.1:
  - fast-forward; 2 pending, migrated (`money_plan` added;
    `story_purposes` added and backfilled on 1 slot), then 0 pending of
    246;
  - build; one restart (count 61); ready; `/health` healthy and
    connected.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from DD.
- **App check:** not done yet (Evoni).
- **Live:** the spec fix; Episode Money Phase B PR 4; Season Arc A9/A10.
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
