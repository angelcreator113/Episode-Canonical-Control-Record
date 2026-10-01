| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy DA, 2026-10-01, backend and frontend. One commit, 12 files: Season Arc PR 7 (#2445, story threads) with its one migration; no package change; one plain restart. `scripts/deploy-prod.sh` stopped on the pending migration as designed, and Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. CFO 89/100 with 4 warnings, unchanged from CZ. The app check has not been done yet. The restart count is continuous from CZ (56 → 57). Production is one commit behind `origin/main`: #2446 (Season Arc PR 8), merged after DA's fetch, with no migration.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-01_CZ.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `72ba7bbdb92b8297a48e0e50157b4e19d979383b` (#2446),
read 2026-10-01. Deploy DA moved production to `20cb81db` (#2445), one
commit behind it (§7).

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
migration ran as is left out, as in the CW, CX and CY records.

**The letter.** This deploy is lettered **DA**, the letter after CZ. It
follows CZ (`F-Deploy-1_Deploy_2026-10-01_CZ.md`, filed in #2447, which
was still open when this record was written).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-01, about
20:05–20:13 UTC, per `DEVELOPMENT_WORKFLOW.md` §7.1:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `21d4172e` (where CZ left production), fetched 1 commit to `20cb81db`
   (#2445, Season Arc PR 7). PR 8 (#2446) was not yet merged and is not
   in this range. The script **stopped at step 3** on
   `20261001250000-create-show-story-threads`. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty.
   - `git merge --ff-only` to `20cb81db`: 12 files.
   - `check-pending-migrations` against the canon instance: **1 pending
     of 244**, exit 1.
3. **Migrate.** `db:migrate` as a database user (name left out). Its
   password was entered at a hidden prompt and unset afterwards.
   - `20261001250000` migrated, 0.042 s; exit 0.
   - Re-check: **0 pending of 244**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 39.61 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 57, online.
   - Ready at 20:12:28.
   - `/health` at 2026-10-01T20:12:42Z: healthy, database connected,
     uptime 20.1 s.
   - `episode-worker` stopped (standing).
5. **CFO.** 20:12:36–20:12:40: **89/100**, 0 critical, **4 warnings**.

**App check: not checked yet** (Evoni). Nothing in this record says the
deployed features work or fail in production.

## §1. Identity and continuity

**MEASURED.**

```
$ git rev-parse origin/main 21d4172e 20cb81db
72ba7bbdb92b8297a48e0e50157b4e19d979383b
21d4172ec5d6ff3604dd17bbcef4e7f51d174981
20cb81db69e23955de7dc0c136af6865185d9464
$ git merge-base --is-ancestor 21d4172e 20cb81db && echo "ancestor: yes"
ancestor: yes
```

CZ left production at `21d4172e` with restart count 56 (CZ record §0,
§7). DA starts at `21d4172e`, and its one restart brings the count to 57
(ATTESTED, §0). The script's stopped run made no restart. **No gap:** no
deploy ran between CZ and DA that this account does not show.

## §2. The range — MEASURED

```
$ git rev-list --count 21d4172e..20cb81db
1
$ git log --oneline 21d4172e..20cb81db
20cb81db6 feat(season): story threads for the show; a slot continues one, acceptance advances it (Season Arc PR 7) [skip-automerge] (#2445)
$ git diff --shortstat 21d4172e 20cb81db
 12 files changed, 844 insertions(+), 11 deletions(-)
$ git diff --name-only 21d4172e 20cb81db
docs/EVENT_EPISODE_FLOW.md
frontend/src/pages/WorldAdmin.jsx
frontend/src/pages/WorldAdmin.seasonRoadmap.test.jsx
src/migrations/20261001250000-create-show-story-threads.js
src/routes/arcRoutes.js
src/services/episodeCompletionService.js
src/services/episodeScriptWriterService.js
src/services/seasonIntentionService.js
src/services/seasonSlotService.js
src/services/storyThreadService.js
tests/integration/storyThreads.integration.test.js
tests/unit/routes/arc-routes-tier-promotion.test.js
$ git diff --name-only 21d4172e 20cb81db -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
```

This agrees with Evoni's account:
- 1 commit, the PR she named;
- 12 files;
- exactly the one migration the script and the check named;
- no package or lock file, so no `npm ci` was needed.

`WorldAdmin.jsx` changed, so the `vite build` was needed. Six backend
files besides the migration changed, so the restart was needed.

## §3. The time

**ATTESTED.** The deploy ran about 20:05–20:13 UTC: ready at 20:12:28,
CFO done 20:12:40, `/health` at 20:12:42.

**MEASURED.** The range's only commit, #2445, is at 19:50:48 UTC:

```
$ git log --first-parent --format="%h %cI" 21d4172e..20cb81db
20cb81db6 2026-10-01T15:50:48-04:00
```

**MEASURED.** #2446's squash commit on `main` is at 20:12:14 UTC:

```
$ git log -1 --format="%h %cI" 72ba7bbd
72ba7bbdb 2026-10-01T16:12:14-04:00
```

**INFERRED.** The script's fetch, at about 20:05, came before that merge,
so it reached `20cb81db` and not `72ba7bbd`. This agrees with Evoni's
statement that PR 8 was not yet merged.

## §4. Migrations

**MEASURED.** The tree holds 244 migration files, one more than at CZ:

```
$ git ls-tree -r --name-only 20cb81db src/migrations | grep -c '\.js$'
244
```

**ATTESTED (§0):** 1 pending of 244 before the run, 0 pending of 244 after
it. This agrees with the tree: CZ recorded 0 pending of 243, and the
range adds exactly this one file.

**The script behaved as designed.** It stopped on the pending file, and
the migration ran **before** the restart, as §7.1 requires on exit 1. The
new code's story-thread routes and its roadmap query read the new table,
so it had to.

## §5. What went live — MEASURED

- **#2445 (`20cb81db`): Season Arc PR 7, story threads** (§8(ff) A3, A6,
  Q9, and Evoni's PR 7 choices):
  - Evoni creates and names a show's story threads; drafts are offered
    from the episodes' `seeds_future_events`;
  - a slot's intention names the thread it continues; the roadmap, the
    season snapshot and the script writer's season block carry it;
  - accepting an episode marks its slot's thread "advanced";
  - only Evoni closes a thread, and she can reopen a closed one (with a
    confirm), keeping its history.

New routes in the range, all behind `requireAuth`:

```
$ git diff 21d4172e 20cb81db -- src/routes | grep "^+router\.\(get\|post\|put\|delete\)"
+router.get('/world/:showId/season/threads', requireAuth, async (req, res) => {
+router.post('/world/:showId/season/threads', requireAuth, async (req, res) => {
+router.put('/world/:showId/season/threads/:threadId', requireAuth, async (req, res) => {
+router.post('/world/:showId/season/threads/:threadId/close', requireAuth, async (req, res) => {
+router.post('/world/:showId/season/threads/:threadId/reopen', requireAuth, async (req, res) => {
```

## §6. Schema change, restart and the CFO

**Schema.** MEASURED (from the migration file); ATTESTED (that it ran,
§0).

```
$ git show 20cb81db:src/migrations/20261001250000-create-show-story-threads.js | grep -n "createTable('show_story_threads'\|CREATE INDEX\|reopened_at"
26: *   reopened_at       set when Evoni reopens a closed thread
43:        await queryInterface.createTable('show_story_threads', {
58:          reopened_at: { type: Sequelize.DATE, allowNull: true },
65:        'CREATE INDEX IF NOT EXISTS show_story_threads_show_id ON show_story_threads (show_id)', { transaction });
```

- **`show_story_threads`** (new): one row per thread, with its title,
  description, status (open, advanced or closed), source, the seed it
  came from, the episodes that opened and last advanced it, `closed_at`,
  `reopened_at` and `deleted_at`, plus an index on `show_id`.
- **Rows written:** none. The migration creates the table only and logs
  no count. `season_slots.story_thread_id` (from `20261001230000`, CY)
  already existed.
- Guarded and re-runnable; its `down` drops the table.

**Restart and CFO.** ATTESTED.
- One plain `pm2 restart`: restart count 57, online.
- `.env` unchanged, so a plain restart was right.
- `episode-worker` stopped, as at every deploy.
- CFO: 89/100, 0 critical, 4 warnings, the same as at CY and CZ.

## §7. Basis statement

**MEASURED.** Production's tree after Deploy DA is `20cb81db` (#2445).
`origin/main` at filing is one commit ahead: Season Arc PR 8, merged after
DA's fetch.

```
$ git log --oneline 20cb81db..origin/main
72ba7bbdb feat(season): Planning Insights; the season-health line reads the slot ranges; no cost_coins tag in the Episode Ledger (Season Arc PR 8) [skip-automerge] (#2446)
$ git rev-parse --is-shallow-repository
false
```

**Next.** #2446 adds no migration, so the next deploy can run by script
end to end:

```
$ git diff --name-only 20cb81db origin/main -- src/migrations/ | wc -l
0
```

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

- **Continuity:** continuous from CZ (`21d4172e`, restart 56). The tree
  agrees with Evoni's account: 1 commit, 12 files, the one migration, no
  package change. Production is at `20cb81db`, one commit behind
  `origin/main` (#2446, no migration).
- **Deploy:** the script stopped on the pending migration as designed.
  Finished by hand per §7.1:
  - 1 pending of 244;
  - migrated (`show_story_threads` created), then 0 pending of 244;
  - build;
  - one restart (count 57);
  - `/health` healthy and connected;
  - `episode-worker` stopped.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from CZ.
- **App check:** not done yet (Evoni).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
