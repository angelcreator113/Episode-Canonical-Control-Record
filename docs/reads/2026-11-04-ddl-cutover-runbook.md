# Runtime-DDL cutover: production runbook and recovery (2026-11-04)

**What it is.** The production steps that let #3711 (no runtime DDL) and #3709 (data_correction_log) deploy under #3710's migration trust check, with a recovery path for every failure point. Rehearsed locally with production-equivalent ownership and privileges (§6).

**Status.** **Nothing here has been run in production.** Each step marked *approval* needs Evoni's explicit yes in the session, given for that step.

The scripts are in `docs/reads/2026-11-04-ddl-cutover/`:
- they take the role names as psql variables, defaulting to production's (`postgres`, `episode_app_dev`, `prime_readonly`);
- every check runs inside the step's own transaction, after its lock;
- a failed check prints `STOPPED`, rolls back and exits 3;
- they print no credential.

## 1. Facts this rests on

These come from Evoni's read-only catalog check, `2026-11-04-runtime-ddl-inventory.md` §4a.

- **`brain_documents`:**
  - owned by `episode_app_dev`, with 0 rows;
  - no foreign keys, views or other dependents;
  - `postgres` cannot take ownership of it (no membership in `episode_app_dev`).
- **CREATE on `public`:** `episode_app_dev` holds it by explicit grant. PUBLIC has only USAGE.
- **Default privileges:**
  - tables `postgres` creates give `episode_app_dev` `arwd` and `prime_readonly` `r`;
  - sequences give `episode_app_dev` `rU`.
- **Tables the migration covers:** every one exists and is owned by `postgres`, except `chapter_versions`, which is absent.

## 2. The sequence

On the box. Fetch the scripts once, read-only for the live tree. Before #3711 is merged they come from its branch; after, use `origin/main`:

```bash
cd ~/episode-metadata && git fetch --quiet origin main && rm -rf ~/cutover && mkdir ~/cutover \
  && git archive origin/main docs/reads/2026-11-04-ddl-cutover | tar -x -C ~/cutover --strip-components=3 && ls ~/cutover
getv(){ grep -E "^$1=" "$2" | tail -1 | cut -d= -f2- | sed -e "s/^[\"']//" -e "s/[\"']\$//"; }
APP=~/episode-metadata/.env; RO=~/.episode-readonly.env; MIG=~/.episode-migrate.env
export PGHOST="$(getv DB_HOST $APP)" PGDATABASE="$(getv DB_NAME $APP)" PGPORT="$(getv DB_PORT $APP)"
[ -z "$PGDATABASE" ] && export PGDATABASE="$(getv DB_DATABASE $APP)"; export PGPORT="${PGPORT:-5432}" PGSSLMODE=require
as_ro()  { PGUSER="$(getv DB_USER $RO)"  PGPASSWORD="$(getv DB_PASSWORD $RO)"  psql -X -q -f "$1"; }
as_app() { PGUSER="$(getv DB_USER $APP)" PGPASSWORD="$(getv DB_PASSWORD $APP)" psql -X -q -f "$1"; }
as_mig() { PGUSER="$(getv DB_USER $MIG)" PGPASSWORD="$(getv DB_PASSWORD $MIG)" psql -X -q -f "$1"; }
```

**Precondition:** #3711 and #3709 are both merged (approval for each). The commit to deploy is the head of `main` that contains both.

| # | Who | Command | Expect | If not |
|---|---|---|---|---|
| 1 | read-only | `as_ro ~/cutover/10-precheck.sql` | **P1** `t \| episode_app_dev \| 0`. **P2** no row. **P3** `episode_app_dev t`, `prime_readonly f`. **P4**: T1 `public \| episode_app_dev`; T2 `brain_documents`; T3 exactly `brain_documents`, `brain_documents_id_seq`, `brain_documents_pkey`, `_brain_documents`, all `episode_app_dev`. | **Stop.** Any extra row, especially a new app-owned table such as `chapter_versions` (created if someone opened version history), needs its own plan first. |
| 2 | app user, *approval* | `as_app ~/cutover/20-drop-brain-documents.sql` | `STEP 2 DONE` | `STEP 2 STOPPED …` or a lock timeout: nothing changed. Re-run step 1 and read why. |
| 3 | migration user, *approval* | `as_mig ~/cutover/30-revoke-create.sql` | `STEP 3 DONE` | `STEP 3 STOPPED`: nothing changed. |
| 4 | read-only | `as_ro ~/cutover/10-precheck.sql` | **P1** `f`. **P3** `episode_app_dev f`. **P4**: no row in T1, T2 or T3. This is exactly what the Deploy trust check will find. | **Do not start the Deploy.** Fix the finding; never by re-granting. |
| 5 | Evoni, *approval* | GitHub, Actions, Deploy, **Run workflow** on `main`, then approve the production environment | Plan, snapshot, Migrate (`[migration-trust] OK`, then `20261104170000` and `20261104200000` migrated), Deploy, Restart, health | Section 4 |
| 6 | read-only | `as_ro ~/cutover/50-postcheck.sql` | **Q1** every table present and owned by `postgres`. **Q2** `t t t t t f f`. **Q3** no row. | Section 4, F4 |

Steps 2 to 5 run back to back. The window between them is §3. The A/B corrections come only after step 6, with the A/B preflight and Evoni's confirmation.

## 3. Requests during the transition

**What fails, and for how long.** From step 2 until the Deploy's restart (minutes), the **old** code runs without CREATE and without `brain_documents`. Rehearsed (§6):

| Route | Status |
|---|---|
| chapter version history GET and POST | 500 `permission denied for schema public`. Never used in production: the table has never existed. |
| video compositions list | 500. **Already 500 in production today** (the old code's index statement on a table it does not own); no frontend caller. |
| Show Bible documents list | 500 until the migration recreates the table. 0 documents. |
| An ingest's document row | not saved (logged, not raised) |
| Continuity, World Studio previews, scene-set jobs, generation worker, franchise brain | unaffected |

**Protection: a controlled window instead of a code change.** The application has no maintenance mode, and every affected route is unused or already failing.
1. Run steps 1 to 6 at a quiet time, as one sitting.
2. Between step 2 and the restart, **do not use** Show Bible document ingest, the Documents tab, or chapter version history.
3. The scene and feed workers need nothing; their tables are untouched.
4. **Until cutover day,** avoid opening chapter version history. The old code would create `chapter_versions` as an application-owned table. Step 1 detects that and stops.

A full outage (`pm2 stop` of the API) is not needed: nothing the window affects is in use. It would also add its own restart risk.

## 4. If the Deploy fails

**The snapshot is never the recovery here.**
- The Deploy never rolls back by itself.
- Each migration runs in one transaction: a failing one leaves nothing, and those before it stay.
- `down` is never run.
- Restoring the snapshot is only for unrelated damage (runbook §5), because it loses every write since.

The only database recovery command is **R1** (`as_mig ~/cutover/R1-recreate-brain-documents.sql`):
- it recreates the empty `brain_documents` as the migration role, with the same definition;
- the default privileges give the application its access back;
- it changes nothing if the table exists;
- it runs as the migration user and needs approval.

| Failure point | Deploy steps | Database after | The app (old code) | Recovery |
|---|---|---|---|---|
| **F1: before the snapshot** | configuration check, SSM preflight, Plan, pruning, snapshot request or wait | unchanged since step 3 | §3 window | **Retry today:** nothing to run. Fix the cause, run step 4, start the Deploy again. **Postpone:** R1, which restores the Documents tab; CREATE stays revoked; version history and video compositions stay unavailable, as before. Later: step 4 (P4 must be empty), then the Deploy. **Do not re-grant CREATE:** rehearsed, the old code then creates app-owned tables again (`chapter_versions`, with a real row), and the next trust check refuses. |
| **F2: after the snapshot, before `db:migrate`** | staging, staged-file verification, the ledger check, the migration credential check, the **trust check** | unchanged since step 3; the snapshot exists | §3 window | As F1. A trust-check refusal names the finding, and step 4 shows the same. Fix it, never by granting. |
| **F3: during `db:migrate`** | either migration fails, or a lock waits more than 30 s | **#3709 fails:** nothing migrated. **#3709 done, #3711 fails:** `data_correction_log` exists (empty, unused); #3711 left nothing (rehearsed: its earlier `chapter_versions` was rolled back too) | §3 window | R1 now (the old code keeps working). Fix the cause in a PR or on the box as the error says, then step 4 and the Deploy again: only the pending migration runs. Never `down`, never the snapshot. |
| **F4: after `db:migrate`, before a healthy restart** | the frontend artifact, Deploy (fast-forward), Restart or health | complete: both migrations recorded, every table owned by `postgres` | **Deploy failed before restart:** the old code keeps serving, as in §3 but with the Documents tab working. **Restart failed:** the API's state is as after any failed restart (runbook §4). | **Re-run the Deploy:** nothing is pending, the migrate phase passes straight through, and Deploy and Restart run again. **If the new code itself cannot start:** a revert PR (runbook §6) and a Deploy. The schema stays, and the old code works on it as in the F4 rehearsal. No database command. |
| **F4b: the box dies after a migration committed but before it was recorded** | inside `db:migrate` | the migration applied, its ledger row missing | as F4 | Re-run the Deploy: both migrations are guarded and re-run cleanly (rehearsed). |

**What is never lost:**
- `brain_documents` has 0 rows, and step 2 refuses otherwise;
- every other table is untouched by steps 2 and 3;
- the migrations only create what is missing;
- R1 only creates.

## 5. #3710's trust check, and #3709 with #3711 in one Deploy

**The trust check will pass.**
- Step 4's P4 runs the trust check's own three queries, generated from `scripts/deploy/migration-trust-check.js` with the migration login written in. It runs as the read-only user immediately before the Deploy.
- Rehearsed: P4 matched the real trust check every time.
  - Before steps 2 and 3, both showed the same 6 findings: the CREATE grant, the TRIGGER grant on `brain_documents`, and its 4 objects.
  - After, both showed none, and the real check printed `OK`.

**Both PRs in one Deploy:**
- **Order:** `20261104170000` (#3709) runs before `20261104200000` (#3711). Each pins its own search path and names its objects with `public.`.
- **No dependency:** neither touches the other's tables. Neither creates a foreign key on a hot table: `chapter_versions` and `brain_documents` have none, and the others already exist.
- **The Plan phase's checks pass:** no package file changes, and no existing migration is modified (checked on a local merge of both).
- **One test conflict:** the two PRs each add a line to `tests/unit/guards/scriptWriteGuard.test.js`. Whichever merges second needs its branch updated, keeping both lines (resolved and tested in the local merge).

## 6. Rehearsal (local Postgres 16, 2026-11-04)

**Setup** (`docs/reads/2026-11-04-ddl-cutover/rehearsal/`). The stand-in roles are:
- **`cut_mig`** for `postgres`: not a superuser; CREATEROLE; owns the database. All 396 of `main`'s migrations ran as it, under #3710's pinned path.
- **`cut_app`** for `episode_app_dev`: CREATE on public, the default privileges, and it owns an empty `brain_documents`.
- **`cut_ro`** for `prime_readonly`: NOINHERIT.

The production-only tables use production's definitions. **"Old code"** is `origin/main`; **"new code"** is `main` with #3709 and #3711 merged locally. The Deploy's migrate phase is simulated with `phase_migrate`'s exact commands (the trust check, then `sequelize-cli db:migrate` with the same `PGOPTIONS`). Routes were probed as the app role. Each scenario starts from a fresh copy of the base.

| Scenario | Result |
|---|---|
| G1 `brain_documents` holds a row | `STEP 2 STOPPED: … holds 1 row(s)`, exit 3, table kept |
| G2 a view depends on it; G2b another table's default uses its sequence | `STEP 2 STOPPED: 1 object(s) depend …`, exit 3 |
| G3 step 2 as the migration user; step 3 as the app user | both `STOPPED: not run as …`, exit 3, nothing changed |
| G4 an app insert in flight during step 2 | lock timeout after 5 s, exit 3, nothing changed. After the insert committed, step 2 stopped (1 row). |
| S0 happy path | P4 before listed the same 6 findings as the trust check. Steps 2 and 3 done; P4 then empty; the trust check printed `OK`; both migrations ran; post-check Q1 all `cut_mig`, Q2 `t t t t t f f`, Q3 empty. New code: all 7 routes 200. Data unchanged. |
| §3 window (old code) | version history 500 (permission denied); video compositions 500 (also 500 in today's state); Documents 500 (no table); continuity, previews and jobs 200 |
| F1/F2, then postpone with R1 | the Documents tab back to 200; later, P4 empty, the trust check `OK`, both migrated, new code 7/7 |
| F1/F2, then re-grant CREATE (rejected) | the old code created `chapter_versions` as `cut_app` with a row; the next trust check refused (4 findings). Re-granting is therefore not a recovery. |
| F2 step 3 forgotten | the trust check refused (1 finding); nothing migrated |
| F3a #3709 fails (injected) | `db:migrate exit 1`, nothing recorded; R1; cause removed; re-run migrated both |
| F3b #3711 fails at its last table (injected) | #3709 recorded, #3711 rolled back whole (`chapter_versions` absent); R1, and the old code's routes 200 (Documents included); re-run migrated #3711 only |
| F4 migrated, no restart | old code: as the window, but Documents 200; ledger `0 pending`; the restart is then only the new code (7/7) |
| F4b ledger rows deleted after commit | re-run: both migrations ran again cleanly; same end state |

## 7. Out of scope (unchanged)

- **The scene-delete renumbering bug.** It drops and recreates an index the app does not own (inventory §4a, D9). A separate suggested task.
- **`ContinuityBeatCharacter`.** Its model is soft-delete; production's table has no `deleted_at`. Recorded in the step-2 schema baseline.
