| **PRIME STUDIOS** **F-DEPLOY-1 DEPLOY RECORD** *Deploy CX, 2026-10-01, backend and frontend. One migration ran before the restart, there was no dependency change, and there was one plain restart. `scripts/deploy-prod.sh` stopped on the pending migration as designed; Evoni finished the deploy by hand per `DEVELOPMENT_WORKFLOW.md` §7.1, outside any agent session. The show page's wardrobe-link fix and scene rulings S3, S4, S5, S6 and S7 go live, with the CW record. CFO 89/100 with 4 warnings, unchanged from CW. Evoni has not yet checked the app. Production is level with `origin/main`.* |
| --- |

**Document version**

This is a new record. It is not a Fix Plan revision, and it is not an
amendment of `F-Deploy-1_Deploy_2026-10-01_CW.md`, whose deploy this one
follows. It edits no filed document.

Basis: `origin/main` at `5ff0a20a646c5fdbee257cb6a885672390911504` (#2433),
read 2026-10-01. Deploy CX moved production to that same commit (§8).

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
migration ran as is left out, as in the CW record.

**The letter.** This deploy is lettered **CX**. It follows CW
(`F-Deploy-1_Deploy_2026-10-01_CW.md`, filed in #2427).

## §0. Evoni's account, as given

**ATTESTED.** Evoni's account of her terminal, 2026-10-01, about
15:20–15:28 UTC:

1. **The script stopped first.** `scripts/deploy-prod.sh`, run at
   `f9b5271f`, fetched 7 commits to `5ff0a20a` (#2427, #2428, #2429,
   #2430, #2431, #2432, #2433) and **stopped at step 3** on
   `20261001220000-world-locations-approved-base`. Nothing had changed.
2. **By hand, per §7.1.**
   - `frontend/dist` was backed up (sortable name).
   - The package diff was empty, so no `npm ci` was run.
   - `git merge --ff-only` to `5ff0a20a`: 41 files.
   - `check-pending-migrations` against the canon instance: **1 pending of
     241**, exit 1.
3. **Migrate.** `db:migrate` as a separate database user (name left out).
   Its password was
   entered at a hidden prompt and unset afterwards. Exit 0.
   - `20261001220000` migrated, 0.037 s.
   - Re-check: **0 pending of 241**, exit 0.
4. **Build and restart.**
   - `vite build` ✓, 37.20 s.
   - `.env` unchanged.
   - One plain `pm2 restart`: restart count 53, online.
   - Ready at 15:27:31.
   - `/health` at 2026-10-01T15:27:45Z: healthy, database connected,
     uptime 20.1 s.
5. **CFO.** 15:27:39–15:27:43: **89/100**, 0 critical, **4 warnings**.
6. **Given after the first draft of this record.**
   - `episode-worker` shows "stopped" in `pm2`, as at every deploy, so no
     worker-run scene generations run in production.
   - Her log grep included `FONT` and returned no `FONT` lines, so no font
     files are missing.

**App check: not checked yet** (Evoni). Nothing in this record says the
new scene features work in production; §5 says only what shipped.

## §1. Identity and continuity

**MEASURED.**

```
$ git merge-base --is-ancestor f9b5271f 5ff0a20a && echo "ancestor: yes"
ancestor: yes
$ git rev-parse f9b5271f 5ff0a20a
f9b5271f3723f816b0bf7d3b9a1c32cc05de51cd
5ff0a20a646c5fdbee257cb6a885672390911504
```

**No gap.** CW ends at `f9b5271f` (CW record §8), and that is where this
deploy starts.

**The restart count is continuous (ATTESTED):** CW left it at 52 (CW
record §6), and CX's single restart brings it to 53. The script's stopped
run made no restart.

## §2. The range — MEASURED

```
$ git rev-list --count f9b5271f..5ff0a20a
7
$ git log --oneline f9b5271f..5ff0a20a
5ff0a20a6 feat(scenes): a location's approved base; event-dressed versions made from it (S6) [skip-automerge] (#2433)
5301f71d8 feat(scenes): no generic style or lighting text in scene images; lighting from the brief (S4) [skip-automerge] (#2432)
52f14357c feat(events): choose or create the event's scene set in Place, from its brief (S7) [skip-automerge] (#2431)
3582317db feat(scenes): venue generation saves its brief and World Location, and keeps the style guide (S5) [skip-automerge] (#2430)
ecf7ea4d4 feat(scenes): the event for a scene image is chosen on its brief, never matched (S3) [skip-automerge] (#2429)
aed64b2e5 fix(shows): the show page's wardrobe links open Assets → Wardrobe [skip-automerge] (#2428)
51fc16238 docs(audit): deploy record CW [skip-automerge] (#2427)
$ git diff --shortstat f9b5271f 5ff0a20a
 41 files changed, 3191 insertions(+), 397 deletions(-)
$ git diff --name-only f9b5271f 5ff0a20a -- src/migrations/
src/migrations/20261001220000-world-locations-approved-base.js
$ git diff --name-only f9b5271f 5ff0a20a -- package.json package-lock.json frontend/package.json frontend/package-lock.json | wc -l
0
$ git diff --name-only f9b5271f 5ff0a20a -- frontend/ | wc -l
19
$ git diff --name-only f9b5271f 5ff0a20a -- src/ | wc -l
11
```

This agrees with Evoni's account:
- 7 commits, the seven PRs she named;
- 41 files;
- exactly the one migration the check listed;
- no package or lock file changed, so skipping `npm ci` was right.

19 frontend files changed, so the `vite build` was needed. 11 backend files
changed (one of them the migration); the restart was needed to load the
others.

## §3. The time

**ATTESTED.** The deploy ran about 15:20–15:28 UTC: ready at 15:27:31, CFO
done 15:27:43, `/health` at 15:27:45.

**MEASURED.** The range's last commit, #2433, is at 15:11:26 UTC:

```
$ git log --first-parent --format="%h %cI" f9b5271f..5ff0a20a | head -2
5ff0a20a6 2026-10-01T11:11:26-04:00
5301f71d8 2026-10-01T10:59:43-04:00
```

**INFERRED.** The script's fetch reached `5ff0a20a`, so it ran at or after
15:11:26, which fits the "about 15:20" start. Everything Evoni timed
(ready, CFO, `/health`) follows the merge.

## §4. Migrations

**MEASURED.** The tree holds 241 migration files, one more than at CW:

```
$ git ls-tree -r --name-only 5ff0a20a src/migrations | grep -c '\.js$'
241
```

**ATTESTED (§0):** 1 pending of 241 before the run, 0 pending of 241 after
it. This agrees with the tree: CW recorded 0 pending of 240, and the range
adds exactly this one file.

**The script behaved as designed.** It stopped on the pending file, and the
migration ran **before** the restart, as §7.1 requires on exit 1. The new
code started with the three columns already present.

**No row count.** Unlike CW's `20261001210000`, this migration logs
nothing and touches no rows (§7), so Evoni's account gives only its time.

## §5. What went live — MEASURED

- **#2428 (`aed64b2e`):** the show page's wardrobe links open Assets →
  Wardrobe.
- **#2429 (`ecf7ea4d`): ruling S3.** The event for a scene image is chosen
  on its brief, never matched.
- **#2430 (`3582317d`): ruling S5.** Venue generation saves its brief and
  World Location, and keeps the style guide. Adds
  `POST /world/:showId/events/:eventId/venue-brief`, behind `requireAuth`.
- **#2431 (`52f14357`): ruling S7.** The event's scene set is chosen or
  created in Place, from its brief.
- **#2432 (`5301f71d`): ruling S4.** No generic style or lighting text in
  scene images; lighting comes from the brief.
- **#2433 (`5ff0a20a`): ruling S6.** A location's approved base;
  event-dressed versions are made from it. Adds
  `POST` and `DELETE /:id/approve-base` on the scene-set routes, behind
  `requireAuth`, and the migration in §7.
- **#2427:** the CW deploy record. It has no runtime effect.

The new routes, MEASURED:

```
$ git log --oneline -S"/venue-brief'" f9b5271f..5ff0a20a -- src/routes
3582317db feat(scenes): venue generation saves its brief and World Location, and keeps the style guide (S5) [skip-automerge] (#2430)
$ git log --oneline -S"/approve-base'" f9b5271f..5ff0a20a -- src/routes
5ff0a20a6 feat(scenes): a location's approved base; event-dressed versions made from it (S6) [skip-automerge] (#2433)
$ git grep -n "router\.\(post\|delete\)('[^']*\(approve-base\|venue-brief\)'" 5ff0a20a -- src/routes
5ff0a20a:src/routes/sceneSetRoutes.js:1853:router.post('/:id/approve-base', validateUUIDParam('id'), requireAuth, async (req, res) => {
5ff0a20a:src/routes/sceneSetRoutes.js:1866:router.delete('/:id/approve-base', validateUUIDParam('id'), requireAuth, async (req, res) => {
5ff0a20a:src/routes/worldEvents.js:3344:router.post('/world/:showId/events/:eventId/venue-brief', requireAuth, async (req, res) => {
```

## §6. Restarts, workers and the CFO

**ATTESTED.**
- One plain `pm2 restart`: restart count 53, online.
- `.env` unchanged, so a plain restart was right (§7.2 applies only to a
  credential or `.env` change).
- `episode-worker` shows "stopped" in `pm2`, as at every deploy, so no
  worker-run scene generations run in production.
- The log grep included `FONT` and returned no `FONT` lines, so no font
  files are missing.
- CFO: 89/100, 0 critical, 4 warnings, the same as at CW.

**MEASURED.** #2429 changes `src/workers/sceneGenerationWorker.js`:

```
$ git log --oneline f9b5271f..5ff0a20a -- src/workers/sceneGenerationWorker.js
ecf7ea4d4 feat(scenes): the event for a scene image is chosen on its brief, never matched (S3) [skip-automerge] (#2429)
```

INFERRED: with the worker stopped, that change has no effect in production
until the worker runs.

## §7. Schema changes

**MEASURED** (from the migration file); **ATTESTED** (that it ran, §0).
- Adds three nullable columns to `world_locations`, with no default:
  `approved_base_scene_set_id UUID`, `approved_base_image_url TEXT`,
  `approved_base_at TIMESTAMPTZ`.
- `ADD COLUMN IF NOT EXISTS`, so a re-run changes nothing; skipped when the
  `world_locations` table is absent.
- No rows are written: nothing is approved automatically.
- `down` drops the three columns (`DROP COLUMN IF EXISTS`).

```
$ git show 5ff0a20a:src/migrations/20261001220000-world-locations-approved-base.js | grep -n 'ALTER TABLE'
30:    await q('ALTER TABLE world_locations ADD COLUMN IF NOT EXISTS approved_base_scene_set_id UUID');
31:    await q('ALTER TABLE world_locations ADD COLUMN IF NOT EXISTS approved_base_image_url TEXT');
32:    await q('ALTER TABLE world_locations ADD COLUMN IF NOT EXISTS approved_base_at TIMESTAMPTZ');
38:    await q('ALTER TABLE world_locations DROP COLUMN IF EXISTS approved_base_at');
39:    await q('ALTER TABLE world_locations DROP COLUMN IF EXISTS approved_base_image_url');
40:    await q('ALTER TABLE world_locations DROP COLUMN IF EXISTS approved_base_scene_set_id');
```

## §8. Basis statement

**MEASURED.** Production's tree after Deploy CX is `5ff0a20a` (#2433), and
`origin/main` at filing is the same commit:

```
$ git log --oneline 5ff0a20a..origin/main | wc -l
0
$ git rev-parse --is-shallow-repository
false
```

**Owed from this deploy.** Evoni's app check of S3–S7 and the wardrobe
links (§0). It is not discharged here.

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
  CW:
  - 7 commits and 41 files;
  - the one migration;
  - no package change.

  Production is at `5ff0a20a`, level with `origin/main`.
- **Deploy:** the script stopped on the pending migration as designed.
  Finished by hand per §7.1:
  - 1 pending of 241;
  - migrated (three nullable columns on `world_locations`), then 0 pending
    of 241;
  - build;
  - one restart (count 53);
  - `/health` healthy and connected;
  - no `FONT` lines in the log.
- **CFO:** 89/100, 0 critical, 4 warnings, unchanged from CW.
- **App check:** not checked yet (Evoni, ATTESTED). Owed (§8).
- **Worker:** `episode-worker` stopped, as at every deploy; no worker-run
  scene generations run in production (Evoni, ATTESTED, §6).
- Nothing is RULED here. The filing session made no host, AWS, database or
  Cognito contact.

*Type: deploy record. Rules: nothing. Mints: nothing. Discharges: nothing.
Host/AWS/DB/Cognito contact by the filing session: none. Task: none filed.
Production's freeze is lifted (`F-Deploy-1_Fix_Plan_v1.53.md` §1); agent
sessions still never touch hosts, AWS, RDS or Cognito (`CLAUDE.md`).*
