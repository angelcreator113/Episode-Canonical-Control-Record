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

**Preconditions:**
- #3711 and #3709 are both merged, each with its own approval. The commit to deploy is the head of `main` that contains both.
- **A maintenance window is declared** (start time and expected end) before step 2, and runs until step 6 passes (§3). It is mandatory.

**Three separate authorizations, each given in the session for that step alone:**
1. the guarded drop (step 2);
2. the privilege revoke (step 3);
3. the Deploy run (step 5).

None implies another. Approving the drop does not approve the revoke.

| # | Who | Command | Expect | If not |
|---|---|---|---|---|
| 1 | read-only | `as_ro ~/cutover/10-precheck.sql` | **P1** `t \| episode_app_dev \| 0`. **P2** no row. **P3** `episode_app_dev t`, `prime_readonly f`. **P4**: T1 `public \| episode_app_dev`; T2 `brain_documents`; T3 exactly `brain_documents`, `brain_documents_id_seq`, `brain_documents_pkey`, `_brain_documents`, all `episode_app_dev`. | **Stop.** Any extra row, especially a new app-owned table such as `chapter_versions` (created if someone opened version history), needs its own plan first. |
| 2 | app user, *authorization 1 of 3*, inside the window | `as_app ~/cutover/20-drop-brain-documents.sql` | `STEP 2 DONE` | `STEP 2 STOPPED …` or a lock timeout: nothing changed. Re-run step 1 and read why. |
| 3 | migration user, *authorization 2 of 3* | `as_mig ~/cutover/30-revoke-create.sql` | `STEP 3 DONE` | `STEP 3 STOPPED`: nothing changed. |
| 4 | read-only | `as_ro ~/cutover/10-precheck.sql` | **P1** `f`. **P3** `episode_app_dev f`. **P4**: no row in T1, T2 or T3. This is exactly what the Deploy trust check will find. | **Do not start the Deploy.** Fix the finding; never by re-granting. |
| 5 | Evoni, *authorization 3 of 3* | GitHub, Actions, Deploy, **Run workflow** on `main`, then approve the production environment | Plan, snapshot, Migrate (`[migration-trust] OK`, then `20261104170000` and `20261104200000` migrated), Deploy, Restart, health | Section 4 |
| 6 | read-only | `as_ro ~/cutover/50-postcheck.sql` | **Q1** every table present and owned by `postgres`. **Q2** `t t t t t f f`. **Q3** no row. | Section 4, F4 |

Steps 2 to 5 run back to back. The window between them is §3. The A/B corrections come only after step 6, with the A/B preflight and Evoni's confirmation.

## 3. The maintenance window, and requests during the transition

**The window is mandatory.**
- **Opens:** when Evoni declares it, before step 2.
- **Closes:** when step 6 passes.
- **Inside it, do not use:**
  - Show Bible document ingest and the Documents tab;
  - chapter version history (BookEditor);
  - the video compositions list (it has no frontend caller).
- Everything else stays usable.
- Run the steps as one sitting, at a quiet time.
- **No `pm2 stop`:** the application has no maintenance mode, and stopping the API would add its own restart risk for features nobody is using.

**Before the window,** avoid opening chapter version history. The old code would create `chapter_versions` as an application-owned table. Step 1 stops if it has.

### 3a. Two kinds of recovery

**Database recovery** puts the schema and privileges into a state from which the cutover can continue or wait safely, with no data lost. There is one command, **R1**: it recreates the empty `brain_documents` as the migration role.

**Restoring application functionality** is a separate matter:
- **R1 restores** the Show Bible documents list and ingest's document row, even on the old code.
- **Two routes stay unavailable until the new application version has started successfully** (step 5's Restart, confirmed by step 6). No database command restores them, because the old code needs CREATE for them and CREATE is not given back (§4):
  - `GET` and `POST /api/v1/story-health/versions/chapter/:id` (chapter version history: "permission denied for schema public"; never used in production);
  - `GET /api/v1/episodes/:id/video-compositions` (500; **already 500 in production today**, no frontend caller).
- **Never available again:** the admin test route `GET /api/v1/admin/create-video-compositions-table` is removed by #3711.

### 3b. What the old code serves between step 2 and the restart

Rehearsed (§6):

| Route | Before R1 | After R1 (old code) | New code |
|---|---|---|---|
| chapter version history GET/POST | 500 (permission denied) | 500 | 200 |
| video compositions list | 500 (as today) | 500 | 200 |
| Show Bible documents list | 500 (no table) | 200 | 200 |
| an ingest's document row | not saved (logged) | saved | saved |
| continuity, World Studio previews, scene-set jobs, generation worker, franchise brain | 200 | 200 | 200 |

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

**The "app (old code)" column below is application functionality, not database state.** See §3a for which routes return only with the new version.

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

**Known limitation of the check.** If the migration login were a true superuser, Postgres would report it as a member of every role, so the check would trust every role and both it and P4 would find nothing. Production's `postgres` is not a superuser: it is CREATEROLE, CREATEDB and a member of `rds_superuser` (Evoni's role check), with no membership in `episode_app_dev` (D10). The rehearsal used a non-superuser migration role for exactly this reason.

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

### 6a. The box commands themselves (dry run)

The §2 block was copied verbatim from this file into a script and run unchanged, with a temporary `HOME` holding a clone of the repository and three `.env` files in the box's format (the read-only password quoted, to exercise `getv`). The only substitutions:
- before the merge, `origin/main` was replaced by the PR branch (`FETCH_HEAD`);
- locally, `PGSSLMODE=disable`.

The roles were renamed to production's names (`episode_app_dev`, `prime_readonly`), so the scripts ran with their built-in defaults and no `-v`. Everything was owned by `postgres` (locally a superuser; see §5 for why P4 then shows nothing).

Results:
- the archive unpacked the 9 files;
- steps 1 to 4 exited 0 with `STEP 2 DONE` and `STEP 3 DONE`;
- step 5 (the migrate phase as `postgres`): trust check `OK`, both migrations migrated;
- step 6: Q1 all `postgres`, Q2 `t t t t t f f`, Q3 empty;
- a mistaken second step 2: `STEP 2 STOPPED: … not owned by this login`, exit 3;
- a mistaken R1 after success: no change.

## 7. Out of scope (unchanged)

- **The scene-delete renumbering bug.** It drops and recreates an index the app does not own (inventory §4a, D9). A separate suggested task.
- **`ContinuityBeatCharacter`.** Its model is soft-delete; production's table has no `deleted_at`. Recorded in the step-2 schema baseline.

## 8. Production cutover record (2026-11-05)

Run by Evoni on the box. Each step's authorization was given in the session, for that step alone. The maintenance window was opened before step 1 and closed after step 6.

| Step | Result |
|---|---|
| Deploy #195 (run 41961591667, `1d256cbb`; before steps 1–4) | **Stopped at Migrate by the trust check, as designed:** the 6 findings of §2 step 1 (`episode_app_dev` CREATE on `public`, TRIGGER on `brain_documents`, and the 4 `brain_documents` objects). "No migration was run; nothing was changed." The live tree stayed `80fd08cd`; snapshot `deploy-1d256cbbf3e6-41961591667-1`. This is failure point F2; no recovery needed. |
| 1. Pre-check | P1 `t \| episode_app_dev \| 0`; P2 no row; P3 `episode_app_dev t`, `prime_readonly f`; P4 exactly the 6 expected findings |
| 2. Guarded drop (authorization 1) | `STEP 2 DONE: the empty brain_documents (and its sequence) dropped`, exit 0 |
| 3. Revoke (authorization 2) | `STEP 3 DONE: the application role can no longer create in public`, exit 0 |
| 4. Pre-check | P1 `f`; P2 no row; P3 `episode_app_dev f`, `prime_readonly f`; P4 empty in T1–T3 |
| 5. Deploy #196 (run 42003170484, `1d256cbb`; authorization 3) | **Success:** plan, snapshot, Migrate (trust check OK; `20261104170000` and `20261104200000` migrated), Deploy `80fd08cd` → `1d256cbb`, Restart and on-box health, public health |
| 6. Post-check | Q1 all 11 tables present, owned by `postgres`; Q2 `t t t t t f f`; Q3 empty in T1–T3 |

The application role now owns nothing in `public` and can create nothing there. The migration trust check passes for future Deploys.
