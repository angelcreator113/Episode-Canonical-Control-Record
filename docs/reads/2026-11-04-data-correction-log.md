# data_correction_log: the append-only undo record (2026-11-04)

**Status:** migration `src/migrations/20261104170000-create-data-correction-log.js` in its own PR. Evoni approved implementation subject to review (2026-11-04). **Not approved to merge or deploy.** Merge and deployment each need their own approval.

**Why:** Evoni required "durable, access-controlled undo records with conditional restoration" for the two approved data corrections A (Episode 1 narrative purpose) and B (un-own four test-voided wardrobe items). The prepared scripts, which are not executed, are in `docs/reads/2026-11-04-prepared-corrections.md` §8 and `docs/reads/2026-11-04-corrections/`, on the documentation branch.

## 1. Schema (17 columns)

The proposal named 16 columns. `show_id` was added so every record is traceable to its show (requirement 4).

| # | Column | Type | Null | Default / rule |
|---|---|---|---|---|
| 1 | `id` | UUID | no | `gen_random_uuid()`, primary key |
| 2 | `correction_key` | VARCHAR(100) | no | CHECK `^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$` (e.g. `A-2026-11-04`) |
| 3 | `show_id` | UUID | no | the show the corrected record belongs to |
| 4 | `record_table` | VARCHAR(100) | no | e.g. `season_slots`, `episode_briefs`, `wardrobe` |
| 5 | `record_id` | VARCHAR(100) | no | the corrected row's id |
| 6 | `field` | VARCHAR(100) | no | the corrected column |
| 7 | `before_value` | JSONB | yes | the exact value before the correction |
| 8 | `after_value` | JSONB | yes | the exact value the correction wrote; CHECK `before_value IS DISTINCT FROM after_value` |
| 9 | `approved_by` | VARCHAR(255) | no | e.g. `Evoni` |
| 10 | `approval_ref` | TEXT | no | where the approval is recorded; CHECK not blank |
| 11 | `applied_at` | TIMESTAMPTZ | no | **set by the database** (`NOW()`) on insert, whatever the insert says |
| 12 | `applied_by` | VARCHAR(255) | no | **set by the database** (`current_user`) on insert |
| 13 | `undone_at` | TIMESTAMPTZ | yes | set only by the undo transition (database `NOW()`) |
| 14 | `undone_by` | VARCHAR(255) | yes | set only by the undo transition (database `current_user`); CHECK set exactly when `undone_at` is |
| 15 | `created_at` | TIMESTAMPTZ | no | set by the database on insert |
| 16 | `updated_at` | TIMESTAMPTZ | no | set by the database on insert and on the undo transition |
| 17 | `deleted_at` | TIMESTAMPTZ | yes | present by the project convention; **can never be set** |

**Indexes:**
- `data_correction_log_once`: UNIQUE `(correction_key, record_table, record_id, field)`. A correction cannot be applied twice to the same field.
- `data_correction_log_show_record`: `(show_id, record_table, record_id)`, for finding every correction of a record.

**Constraints:** the two CHECKs above, the key format CHECK and the non-blank approval reference CHECK.

**Triggers** (function `data_correction_log_guard()`):

| Trigger | When | What it does |
|---|---|---|
| `data_correction_log_row_guard` | BEFORE INSERT | sets `applied_at`, `applied_by`, `created_at` and `updated_at` itself; refuses a row inserted as undone or deleted |
| `data_correction_log_row_guard` | BEFORE UPDATE | allows **only** the one undo transition (`undone_at` from NULL to set), and sets `undone_at`, `undone_by` and `updated_at` itself. Refuses any change to any other column, and any change at all to a row already undone |
| `data_correction_log_row_guard` | BEFORE DELETE | refuses |
| `data_correction_log_truncate_guard` | BEFORE TRUNCATE | refuses |

**Privileges:**
- `REVOKE ALL ON data_correction_log FROM PUBLIC`;
- `REVOKE ALL ON FUNCTION data_correction_log_guard() FROM PUBLIC`;
- `GRANT SELECT` to the read-only reviewer role `prime_readonly`, only if that role exists.

No other grants are added.

## 2. Rollback

- **`down`:** refuses while the table holds **any** record ("export them before rolling back"). When empty, it drops the table and the function.
- **Under the runbook (`docs/runbooks/deploy-workflow.md` §4, §6):** down-migrations are never run as part of a rollback. A code rollback keeps the schema. If this migration had to be reverted after deploy, the table would simply stay unused (nothing in the application reads it). Restoring the pre-migration RDS snapshot (§5) is only for damaged data, and loses every write since the snapshot.

## 3. Tamper resistance (requirement 3)

Append-only, enforced **in the database**, not by convention:
- no DELETE and no TRUNCATE;
- every recorded column immutable;
- the database itself stamps who and when on insert and on undo, so the actor and times cannot be forged;
- exactly one undo transition per row, then the row is frozen.

**Limitation, stated plainly:** the **table owner** can still deliberately `ALTER TABLE … DISABLE TRIGGER` or drop the table, which needs DDL rights. In production the owner is the role that runs migrations: the application's database user from the box's `.env`, the same role the Deploy workflow uses. The triggers stop application code and accidental statements, not a deliberate act by the owner. Full separation would need a dedicated role (§5), which is a separate decision.

## 4. Traceability, exact values, duplicates (requirements 4 and 5)

**Traceability.** Every row records:
- the **show** (`show_id`);
- the **affected record** (`record_table`, `record_id`, `field`);
- the **approved change** (`before_value` → `after_value`, `approved_by`, `approval_ref`, `correction_key`);
- the **database actor** (`applied_by`, `undone_by`, from `current_user`);
- the **timestamps** (`applied_at`, `undone_at`).

**Exact values.** `before_value` and `after_value` hold the exact values (JSONB). The prepared undo restores `before_value` only while the record still equals `after_value` exactly, then marks the row undone.

**Duplicates.** `data_correction_log_once` refuses a second application. A second undo is refused by the trigger.

## 5. Which role writes it (requirement 7)

- **Who inserts records:** only the reviewed correction scripts, run by Evoni on the box as the **application database user** (from `~/episode-metadata/.env`; the read-only `prime_readonly` cannot write). There is no other database role today.
- **How it is restricted:**
  1. **No application code reads or writes the table.** `tests/unit/dataCorrectionLogNotASourceOfTruth.test.js` fails if any file under `src/` or `frontend/src/` other than this migration names it.
  2. **No API route exposes it.**
  3. **The triggers bind every role**, including the owner unless it deliberately disables them.
  4. **PUBLIC has no privileges.**
- **Possible later hardening** (needs its own approval: a database role change): a dedicated `prime_corrections` role with only `INSERT` and `UPDATE (undone_at, undone_by, updated_at)`, with ownership kept by a role the application does not use.

## 6. Audit and undo only, not a source of truth (requirement 6)

- **Prime Bank** balances come only from `financial_transactions`.
- **Wardrobe ownership** comes only from `wardrobe.is_owned`.
- **Episode continuity** comes only from the sources in the roadmap §22.

Nothing reads this table to compute any of them. The unit test above keeps it that way.

## 7. The Deploy workflow's snapshot and rollback (requirement 8), verified by reading, not triggering

Sources: `.github/workflows/deploy.yml` and `docs/runbooks/deploy-workflow.md`.

**When it runs:**
- **Manual dispatch only** (`workflow_dispatch`); a merge never starts it.
- Only when the repository variable `DEPLOY_ENABLED` is `"true"`.
- Only in the protected `production` environment, after **Evoni approves the run**.
- Agent sessions never dispatch, approve, re-run or enable it.

**What it does, in order:**
1. A read-only plan on the box, which lists pending migrations.
2. It prunes old `deploy-*` snapshots (keeping the newest few).
3. **`aws rds create-db-snapshot`** of the canon instance.
4. It **waits until the snapshot is available**.
5. `db:migrate` from a staged copy while the API keeps running the old code.
6. Deploy, restart, health checks.

**On failure:**
- On any failure it stops and **never rolls back by itself**; the summary names the snapshot.
- If **Migrate** fails, the live tree and API are unchanged, and Deploy and Restart refuse to run.
- **Restore** (runbook §5, Evoni) creates a **new** instance from the `deploy-…` snapshot, then a name swap or a `DB_HOST` change. It loses every write since the snapshot.
- **Code rollback** (runbook §6) is a revert PR; the schema stays and `down` is never run.

**For this migration:**
- It is additive (a new table, function, triggers and grants); nothing existing changes.
- It runs in one transaction: either all of it or none.
- Its rollback options are, in order:
  1. leave the unused table in place;
  2. run `down` while the table is empty;
  3. restore the snapshot only for unrelated damage.

## 8. Tests

**`tests/integration/dataCorrectionLog.integration.test.js`** runs against the test database inside one rolled-back transaction, with savepoints. It checks:
- the database stamps the actor and time;
- duplicate application is refused;
- inserting as undone or deleted is refused;
- a no-change row is refused;
- a blank approval reference is refused;
- recorded values are immutable (including `deleted_at`);
- DELETE and TRUNCATE are refused;
- exactly one undo, stamped by the database, then frozen;
- no PUBLIC grants;
- after running twice there is one table, both triggers and the unique index.

**`tests/unit/dataCorrectionLogNotASourceOfTruth.test.js`** checks that no application code names the table.

**Local, outside Jest:**
- `down` on an empty table drops it;
- `up` re-creates it;
- `down` with one record is refused ("holds 1 undo record(s); export them before rolling back").
