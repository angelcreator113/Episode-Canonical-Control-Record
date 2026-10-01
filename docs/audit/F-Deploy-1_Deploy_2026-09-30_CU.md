| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CU, 2026-09-30, backend and frontend. Four migrations ran before the restart, there was no dependency change (the only `package.json` change is the jest test script), and one plain restart. `scripts/deploy-prod.sh` stopped on the pending migrations as designed; Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. P11, P12/P13, scene quality, D12, T9 and P14 go live. CFO 89/100 with 4 warnings: CT's fifth warning is no longer present (§6).* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-09-30_CT.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `9c1cde569657972036dac0853d4925cde591d46a` (#2408),
read 2026-10-01. Deploy CU moved production to `c3bc92f5` (#2404), four
commits before it (§8).

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
migrations ran as is left out.

**The letter.** This deploy is lettered **CU**. It follows CT
(`F-Deploy-1_Deploy_2026-09-30_CT.md`, filed in #2398).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-09-30, about
23:00–23:10 UTC:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `0bff6977`, fetched 11 commits to `c3bc92f5` and **stopped at step 3**
   on four pending migrations. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The `package.json` diff was only the `"test"` script (the
     `NODE_OPTIONS` heap setting for jest). `package-lock.json` was
     unchanged, so no `npm ci` was run.
   - `git merge --ff-only` to `c3bc92f5`: 87 files.
   - `check-pending-migrations` against the canon instance: **4 pending of
     234**, exit 1.
3. **Migrate.** `npx sequelize-cli db:migrate` as a separate database user
   (name left out). Its password was entered at a hidden prompt and unset
   afterwards.
   - `20261001120000` in 0.035 s, `20261001130000` in 0.014 s,
     `20261001140000` in 0.015 s and `20261001150000` in 0.024 s; exit 0.
   - Re-check: **0 pending of 234**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 40.59 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 50, online.
   - Ready at 23:09:36.
   - `/health` at 2026-09-30T23:09:50Z: healthy, database connected,
     uptime 20.2 s.
5. **CFO.** 23:09:44–23:09:48: **89/100** (was 87), 0 critical, **4
   warnings** (was 5). CT's fifth warning is no longer present.

**App check (Evoni):** not checked yet.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor 0bff6977 c3bc92f5 && echo "ancestor: yes"
ancestor: yes
$ git rev-parse 0bff6977 c3bc92f5
0bff6977a3be33c2733d80f4c22ceb1b7baede4f
c3bc92f5d4107b73d7b6f6c930f5255055701082
```

**No gap.** CT ends at `0bff6977` (CT record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CT left it at 49 (CT
record §6), and CU's single restart brings it to 50. The script's stopped
run made no restart.

## §2. The range — MEASURED

```
$ git rev-list --count 0bff6977..c3bc92f5
11
$ git log --oneline 0bff6977..c3bc92f5
c3bc92f5d feat(episodes): approve the task list and design its overlay (P14) [skip-automerge] (#2404)
d10a18014 feat(tasks): Lala's goal tasks scale with the event (T9, with the combined limit) [skip-automerge] (#2403)
33760b18c feat(deals): Propose terms drafts deliverables scaled to the deal (D12) [skip-automerge] (#2402)
723cd6136 feat(scenes): per-set base model choice, gpt-image-1.5 outpaint, true recorded costs, model comparison [skip-automerge] (#2401)
a45155a16 fix(events): put Reopen terms beside the Terms it reopens [skip-automerge] (#2400)
c5593f083 docs(flow): record D12, T9 (with its follow-up) and P14 [skip-automerge] (#2399)
23db27fc7 docs(audit): deploy record CT [skip-automerge] (#2398)
5757f30b9 feat(episodes): viewer teaser, description as internal synopsis (P12, P13) [skip-automerge] (#2393)
2246af138 test(episodes): wait for the wardrobe empty state instead of asserting at once [skip-automerge] (#2394)
d4755e399 docs(audit): deploy record CS [skip-automerge] (#2390)
e5311b251 feat(episodes): approve the title and design its title card (P11) [skip-automerge] (#2392)
$ git diff --shortstat 0bff6977 c3bc92f5
 87 files changed, 8178 insertions(+), 602 deletions(-)
$ git diff --name-only 0bff6977 c3bc92f5 -- src/migrations/
src/migrations/20261001120000-add-episode-title-approval-and-card.js
src/migrations/20261001130000-add-episodes-teaser.js
src/migrations/20261001140000-add-scene-sets-base-model.js
src/migrations/20261001150000-add-task-list-approval-and-overlay.js
$ git diff --name-only 0bff6977 c3bc92f5 -- package.json package-lock.json frontend/package.json frontend/package-lock.json
package.json
$ git diff 0bff6977 c3bc92f5 -- package.json | grep '^[-+] '
-    "test": "cross-env NODE_ENV=test jest --coverage --runInBand --forceExit",
+    "test": "cross-env NODE_ENV=test NODE_OPTIONS=--max-old-space-size=5120 jest --coverage --runInBand --forceExit",
$ git diff --name-only 0bff6977 c3bc92f5 -- frontend/ | wc -l
31
$ git diff --name-only 0bff6977 c3bc92f5 -- src/ | wc -l
33
```

This agrees with Evoni's account:
- 11 commits;
- 87 files;
- exactly the four migrations the check listed;
- `package.json` changed only in the `"test"` script, and no lock file
  changed, so skipping `npm ci` was right. The test script does not affect
  the running app.

31 frontend files changed, so the `vite build` was needed this time. 33
backend files changed (four of them migrations); the restart was needed to
load the others.

## §3. The time

**ATTESTED.** The deploy ran about 23:00–23:10 UTC: ready at 23:09:36,
`/health` at 23:09:50, CFO done 23:09:48.

**MEASURED.** The range's last commit, #2404, is at 22:44:04 UTC, so the
deploy followed it:

```
$ git log --first-parent --format="%h %cI" 0bff6977..c3bc92f5 | head -2
c3bc92f5d 2026-09-30T18:44:04-04:00
d10a18014 2026-09-30T18:37:11-04:00
```

## §4. Migrations

**MEASURED.** The tree holds 234 migration files, four more than at CT:

```
$ git ls-tree -r --name-only c3bc92f5 src/migrations | grep -c '\.js$'
234
```

**ATTESTED (§0):** 4 pending of 234 before the run, 0 pending of 234 after
it. This agrees with the tree: CT recorded 0 pending of 230, and the range
adds exactly these four files.

**The script behaved as designed.** It stopped on the pending files, and the
migrations ran **before** the restart, as §7.1 requires on exit 1. The new
code started with its columns in place.

## §5. What went live — MEASURED

- **#2392 (`e5311b25`): ruling P11.** The episode title is approved
  explicitly, and an approved title gets a designed title card.
- **#2393 (`5757f30b`): rulings P12 and P13.** A viewer-facing teaser,
  drafted at Start Episode, with the description kept as the internal
  synopsis.
- **#2400 (`a45155a1`):** Reopen terms sits beside the Terms section it
  reopens.
- **#2401 (`723cd613`): scene quality.**
  - A base model choice per scene set.
  - gpt-image-1.5 outpaint.
  - The recorded costs are the true ones.
  - A model comparison.
- **#2402 (`33760b18`): ruling D12.** Propose terms drafts deliverables
  scaled to the deal. It also carries the jest heap setting in
  `package.json` (§2).
- **#2403 (`d10a1801`): ruling T9.** Lala's goal tasks scale with the event,
  within the combined limit.
- **#2404 (`c3bc92f5`): ruling P14.** The task list is approved explicitly,
  and an approved list gets a designed overlay.
- **#2390, #2394, #2398 and #2399:** two deploy records, a test fix and a
  rulings record. They have no runtime effect.

## §6. Restarts, workers and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 50, online.
- `.env` unchanged, so a plain restart was right (§7.2 applies only to a
  credential or `.env` change).
- The account does not mention `episode-worker`.
- CFO: 89/100, 0 critical, 4 warnings. CT's fifth warning is no longer
  present.

**INFERRED.** The CT record (§6) could not name the fifth warning from the
log. It inferred that a 2-point score drop fitted best a `resource_monitor`
or a `health_patrol` warning. Both of those checks read live state:
`health_patrol` reads RSS memory and failed queue jobs, and
`resource_monitor` reads connection count and table sizes. Such a state can
clear by itself once the process restarts. The warning's going away fits
that reading, but this record does not name it. The audit history,
`GET /api/v1/cfo/history` (ADMIN), would; this record does not call it.

The CT record's other INFERRED note still stands: once image calls
accumulate in `ai_usage_logs`, `health_patrol`'s P95 latency check may warn
about slow image models.

## §7. Schema changes

**MEASURED** (from the migration files); **ATTESTED** (that they ran, §0).
Every one adds nullable columns with `ADD COLUMN IF NOT EXISTS`, and is
skipped when its table is absent:

```
$ for f in $(git diff --name-only 0bff6977 c3bc92f5 -- src/migrations/); do echo "== $f"; git show c3bc92f5:$f | grep -nE "ADD COLUMN IF NOT EXISTS [a-z_]+ " ; done
== src/migrations/20261001120000-add-episode-title-approval-and-card.js
32:    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_approved_at TIMESTAMP WITH TIME ZONE');
33:    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_approved_value TEXT');
34:    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_card_asset_id UUID');
35:    await q('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS title_card_title TEXT');
== src/migrations/20261001130000-add-episodes-teaser.js
39:    await queryInterface.sequelize.query('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS teaser TEXT');
40:    await queryInterface.sequelize.query('ALTER TABLE episodes ADD COLUMN IF NOT EXISTS teaser_drafted TEXT');
== src/migrations/20261001140000-add-scene-sets-base-model.js
36:    await q('ALTER TABLE scene_sets ADD COLUMN IF NOT EXISTS base_model character varying(40)');
37:    await q('ALTER TABLE scene_sets ADD COLUMN IF NOT EXISTS base_generation jsonb');
== src/migrations/20261001150000-add-task-list-approval-and-overlay.js
36:    await q('ALTER TABLE episode_todo_lists ADD COLUMN IF NOT EXISTS task_list_approved_at TIMESTAMP WITH TIME ZONE');
37:    await q('ALTER TABLE episode_todo_lists ADD COLUMN IF NOT EXISTS task_list_approved_hash TEXT');
38:    await q('ALTER TABLE episode_todo_lists ADD COLUMN IF NOT EXISTS task_overlay_asset_id UUID');
39:    await q('ALTER TABLE episode_todo_lists ADD COLUMN IF NOT EXISTS task_overlay_hash TEXT');
```

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CU is `c3bc92f5` (#2404).
`origin/main` at filing is four commits ahead of it, all merged after the
deploy:
- #2405: gpt-image-1.5 input and output token prices;
- #2406: T9's second follow-up record;
- #2407: the event cost split record;
- #2408: the D13–D15 record and the deal components design note.

None of the four carries a migration.

```
$ git log --oneline c3bc92f5..origin/main
9c1cde569 docs(deals): record D13–D15 and Evoni's answers; design deal components, drafted Terms and real formats [skip-automerge] (#2408)
e4e10dca6 docs(flow): record the event cost split (terms costs vs event spending) [skip-automerge] (#2407)
5d61cf083 docs(flow): record T9's second follow-up (Start Episode writes the lower count) [skip-automerge] (#2406)
e404cb821 feat(images): price gpt-image-1.5 input and output tokens [skip-automerge] (#2405)
$ git diff --name-only c3bc92f5..origin/main -- src/migrations | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

**INFERRED:** the next deploy, CV, will also be manual per §7.1. The D15,
D14 and event-spending builds are approved to merge, and they carry the
migrations `20261001160000`, `20261001170000` and `20261001180000`.

## §9. What this document does not do

- It records no credential, database user or host.
- It edits no filed document.
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

- **Continuity:** the tree agrees with Evoni's account, with no gap after
  CT:
  - 11 commits and 87 files;
  - the four migrations;
  - only the jest test script changed in `package.json`, and no lock file.

  Production is at `c3bc92f5`, four commits behind `origin/main`, none of
  them with a migration.
- **Deploy:** the script stopped on the pending migrations as designed.
  Finished by hand per §7.1:
  - 4 pending of 234;
  - migrated, then 0 pending of 234;
  - build;
  - one restart (count 50);
  - `/health` healthy and connected.
- **CFO:** 89/100, 0 critical, 4 warnings. CT's fifth warning is no longer
  present; it is still unnamed (§6).
- **App check:** not checked yet (Evoni).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
