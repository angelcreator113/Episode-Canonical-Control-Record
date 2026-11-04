'use strict';

/**
 * data_correction_log (Evoni, 2026-11-04): the durable, append-only undo record
 * for approved one-off production data corrections (docs/reads/
 * 2026-11-04-prepared-corrections.md §8). Her requirement: "durable,
 * access-controlled undo records with conditional restoration".
 *
 * One row per corrected field: the show, the table and row, the field, the
 * exact before and after values, who approved it and the approval reference,
 * when and by which database role it was applied, and when and by whom it was
 * undone. UNIQUE (correction_key, record_table, record_id, field): a
 * correction cannot be applied twice.
 *
 * Audit and undo only. It is NOT a source of truth: Prime Bank
 * (financial_transactions), wardrobe ownership and episode continuity are
 * never read from here, and no application code reads or writes it (a test
 * keeps it that way). It is written only by the reviewed correction scripts.
 *
 * Tamper resistance, enforced in the database for every role that is not the
 * table owner, and for the owner unless it deliberately drops the triggers:
 *   - INSERT: applied_at, applied_by and created_at are set by the database
 *     (NOW(), current_user); a row cannot be inserted as already undone or
 *     deleted.
 *   - UPDATE: only the one undo transition is allowed: undone_at from NULL to
 *     a time, with undone_by and updated_at set by the database. Every other
 *     column is immutable, and an undone row cannot change again.
 *   - DELETE and TRUNCATE are refused.
 *   - deleted_at exists by the project convention but can never be set.
 * Privileges: nothing for PUBLIC; SELECT only for the read-only reviewer role
 * (prime_readonly) where that role exists.
 *
 * A new table only; no existing table changes. Guarded so it can run twice.
 * down refuses while the table holds any record (export them first).
 */

const TABLE = 'data_correction_log';
const FN = 'data_correction_log_guard';

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql) => sequelize.query(sql, { transaction });
      await q(`CREATE TABLE IF NOT EXISTS ${TABLE} (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        correction_key VARCHAR(100) NOT NULL CONSTRAINT data_correction_log_key_format CHECK (correction_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{2,99}$'),
        show_id UUID NOT NULL,
        record_table VARCHAR(100) NOT NULL,
        record_id VARCHAR(100) NOT NULL,
        field VARCHAR(100) NOT NULL,
        before_value JSONB NULL,
        after_value JSONB NULL,
        approved_by VARCHAR(255) NOT NULL,
        approval_ref TEXT NOT NULL CONSTRAINT data_correction_log_approval_ref CHECK (length(btrim(approval_ref)) > 0),
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        applied_by VARCHAR(255) NOT NULL DEFAULT current_user,
        undone_at TIMESTAMPTZ NULL,
        undone_by VARCHAR(255) NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ NULL,
        CONSTRAINT data_correction_log_changes CHECK (before_value IS DISTINCT FROM after_value),
        CONSTRAINT data_correction_log_undo_pair CHECK ((undone_at IS NULL) = (undone_by IS NULL))
      )`);
      await q(`CREATE UNIQUE INDEX IF NOT EXISTS data_correction_log_once
        ON ${TABLE} (correction_key, record_table, record_id, field)`);
      await q(`CREATE INDEX IF NOT EXISTS data_correction_log_show_record
        ON ${TABLE} (show_id, record_table, record_id)`);

      await q(`CREATE OR REPLACE FUNCTION ${FN}() RETURNS trigger LANGUAGE plpgsql AS $fn$
        BEGIN
          IF TG_OP = 'INSERT' THEN
            IF NEW.undone_at IS NOT NULL OR NEW.undone_by IS NOT NULL OR NEW.deleted_at IS NOT NULL THEN
              RAISE EXCEPTION '${TABLE}: a record cannot be inserted as undone or deleted';
            END IF;
            NEW.applied_at := NOW();
            NEW.applied_by := current_user;
            NEW.created_at := NOW();
            NEW.updated_at := NOW();
            RETURN NEW;
          ELSIF TG_OP = 'UPDATE' THEN
            IF OLD.undone_at IS NOT NULL THEN
              RAISE EXCEPTION '${TABLE}: record % is already undone and cannot change', OLD.id;
            END IF;
            IF NEW.undone_at IS NULL THEN
              RAISE EXCEPTION '${TABLE}: the only allowed change is marking a record undone';
            END IF;
            IF (NEW.id, NEW.correction_key, NEW.show_id, NEW.record_table, NEW.record_id, NEW.field,
                NEW.before_value, NEW.after_value, NEW.approved_by, NEW.approval_ref,
                NEW.applied_at, NEW.applied_by, NEW.created_at, NEW.deleted_at)
               IS DISTINCT FROM
               (OLD.id, OLD.correction_key, OLD.show_id, OLD.record_table, OLD.record_id, OLD.field,
                OLD.before_value, OLD.after_value, OLD.approved_by, OLD.approval_ref,
                OLD.applied_at, OLD.applied_by, OLD.created_at, OLD.deleted_at) THEN
              RAISE EXCEPTION '${TABLE}: recorded values are immutable';
            END IF;
            NEW.undone_at := NOW();
            NEW.undone_by := current_user;
            NEW.updated_at := NOW();
            RETURN NEW;
          ELSE
            RAISE EXCEPTION '${TABLE} is append-only: % is not allowed', TG_OP;
          END IF;
        END
      $fn$`);
      await q(`DROP TRIGGER IF EXISTS data_correction_log_row_guard ON ${TABLE}`);
      await q(`CREATE TRIGGER data_correction_log_row_guard
        BEFORE INSERT OR UPDATE OR DELETE ON ${TABLE}
        FOR EACH ROW EXECUTE FUNCTION ${FN}()`);
      await q(`DROP TRIGGER IF EXISTS data_correction_log_truncate_guard ON ${TABLE}`);
      await q(`CREATE TRIGGER data_correction_log_truncate_guard
        BEFORE TRUNCATE ON ${TABLE}
        FOR EACH STATEMENT EXECUTE FUNCTION ${FN}()`);

      await q(`REVOKE ALL ON ${TABLE} FROM PUBLIC`);
      await q(`REVOKE ALL ON FUNCTION ${FN}() FROM PUBLIC`);
      await q(`DO $grant$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'prime_readonly') THEN
            EXECUTE 'GRANT SELECT ON ${TABLE} TO prime_readonly';
          END IF;
        END
      $grant$`);
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql) => sequelize.query(sql, { transaction });
      const [[exists]] = await q(`SELECT to_regclass('public.${TABLE}') IS NOT NULL AS present`);
      if (exists.present) {
        const [[{ n }]] = await q(`SELECT count(*)::int AS n FROM ${TABLE}`);
        if (n > 0) {
          throw new Error(`[20261104170000] ${TABLE} holds ${n} undo record(s); export them before rolling back`);
        }
        await q(`DROP TABLE ${TABLE}`);
      }
      await q(`DROP FUNCTION IF EXISTS ${FN}()`);
    });
  },
};
