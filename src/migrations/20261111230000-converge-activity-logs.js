'use strict';

/**
 * activity_logs: one shape, the one production has, able to hold UUIDs
 * (issue #1948; Evoni's rulings G1-D5 and design §9 Option C; Step 5
 * authorized 2026-11-11).
 *
 * Nothing has ever been written to this table. Three definitions disagreed:
 *   production (scripts/migrations/MIGRATION.sql, long ago):
 *     id, user_id, action, resource_type, resource_id INTEGER, changes JSONB,
 *     created_at TIMESTAMP DEFAULT NOW()
 *   migration 20240101000005 (CI and fresh databases):
 *     id, "userId", "actionType" ENUM, "resourceType" ENUM, "resourceId",
 *     "oldValues", "newValues", "ipAddress", "userAgent", "timestamp"
 *   the model (underscored): user_id, action_type, old_values, … timestamp
 * and resource_id INTEGER cannot hold the UUIDs every resource uses.
 *
 * The target, from any of those starting shapes:
 *     id            integer, serial primary key          (unchanged)
 *     user_id       varchar, nullable   (no sign-in: NULL, never a placeholder)
 *     action        varchar, nullable
 *     resource_type varchar, nullable
 *     resource_id   varchar(255), nullable               (was INTEGER in production)
 *     changes       jsonb, nullable
 *     created_at    timestamp without time zone, default now()
 *     index activity_logs_resource (resource_type, resource_id)
 *
 * On production and the dev box (already in production's shape) this does two
 * things only: resource_id INTEGER -> VARCHAR(255), and the index.
 *
 * Rows are preserved from every starting shape. Old and new values become
 * changes = { "before": …, "after": … }. IP address and user agent columns
 * are dropped (design §9: "no IP addresses or user agents"); production never
 * had them. It reports how many rows carried one, never the values.
 *
 * Guarded: every step looks before it changes, so a re-run changes nothing.
 * One transaction: all of it applies, or none.
 *
 * down narrows resource_id back to INTEGER and drops the index: production's
 * shape before this migration. It REFUSES while the table holds any row: a
 * UUID cannot become an integer, and audit history is never deleted to make a
 * rollback possible. Once the first entry is written, there is no down.
 */

const TABLE = 'activity_logs';
const INDEX = 'activity_logs_resource';
const OLD_INDEXES = ['idx_user_timestamp', 'idx_resource', 'idx_action_type', 'idx_timestamp'];
const OLD_ENUMS = ['enum_activity_logs_actionType', 'enum_activity_logs_resourceType',
  'enum_activity_logs_action_type', 'enum_activity_logs_resource_type'];

// [target name, the names it may have today]
const RENAMES = [
  ['user_id', ['userId']],
  ['action', ['actionType', 'action_type']],
  ['resource_type', ['resourceType']],
  ['resource_id', ['resourceId']],
  ['old_values', ['oldValues']],
  ['new_values', ['newValues']],
  ['ip_address', ['ipAddress']],
  ['user_agent', ['userAgent']],
  ['created_at', ['timestamp']],
];

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      const columns = async () => {
        const [rows] = await q(
          `SELECT column_name, data_type, udt_name, is_nullable, character_maximum_length AS len FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = :table`, { table: TABLE });
        return new Map(rows.map((r) => [r.column_name, r]));
      };
      const [exists] = await q('SELECT to_regclass(:name) AS reg', { name: `public.${TABLE}` });

      if (!exists[0].reg) {
        await q(`CREATE TABLE ${TABLE} (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255),
          action VARCHAR(100),
          resource_type VARCHAR(100),
          resource_id VARCHAR(255),
          changes JSONB,
          created_at TIMESTAMP DEFAULT NOW()
        )`);
        await q(`CREATE INDEX ${INDEX} ON ${TABLE} (resource_type, resource_id)`);
        console.log('[migration 20261111230000] activity_logs did not exist; created in the target shape');
        return;
      }

      // 1. Names.
      let cols = await columns();
      for (const [target, olds] of RENAMES) {
        const old = olds.find((name) => cols.has(name));
        if (old && !cols.has(target)) await q(`ALTER TABLE ${TABLE} RENAME COLUMN "${old}" TO ${target}`);
      }
      cols = await columns();

      // 2. Types: enums and anything else become plain varchar; none is required.
      const convertedEnums = [];
      for (const [name, length] of [['user_id', 255], ['action', 100], ['resource_type', 100], ['resource_id', 255]]) {
        const type = `VARCHAR(${length})`;
        const col = cols.get(name);
        if (!col) { await q(`ALTER TABLE ${TABLE} ADD COLUMN ${name} ${type}`); continue; }
        if (col.data_type === 'USER-DEFINED') convertedEnums.push(col.udt_name);
        // Not varchar, or a shorter varchar: production's length (never narrowed).
        if (col.data_type !== 'character varying' || (col.len !== null && col.len < length)) {
          await q(`ALTER TABLE ${TABLE} ALTER COLUMN ${name} TYPE ${type} USING ${name}::text`);
        }
        if (col.is_nullable === 'NO') await q(`ALTER TABLE ${TABLE} ALTER COLUMN ${name} DROP NOT NULL`);
      }
      // Only the enum types this run took off this table, and only when nothing else uses them.
      for (const type of convertedEnums.filter((t) => OLD_ENUMS.includes(t))) {
        const [used] = await q(
          `SELECT 1 FROM pg_attribute a JOIN pg_type t ON t.oid = a.atttypid
            WHERE t.typname = :type AND a.attnum > 0 AND NOT a.attisdropped LIMIT 1`, { type });
        if (!used.length) await q(`DROP TYPE IF EXISTS "${type}"`);
      }

      // 3. changes: old and new values fold into { before, after }; no row loses them.
      if (!cols.has('changes')) await q(`ALTER TABLE ${TABLE} ADD COLUMN changes JSONB`);
      const hasOld = cols.has('old_values');
      const hasNew = cols.has('new_values');
      if (hasOld || hasNew) {
        const before = hasOld ? 'old_values::jsonb' : 'NULL::jsonb';
        const after = hasNew ? 'new_values::jsonb' : 'NULL::jsonb';
        await q(
          `UPDATE ${TABLE} SET changes = jsonb_strip_nulls(jsonb_build_object('before', ${before}, 'after', ${after}))
            WHERE changes IS NULL AND (${hasOld ? 'old_values IS NOT NULL' : 'FALSE'} OR ${hasNew ? 'new_values IS NOT NULL' : 'FALSE'})`);
        if (hasOld) await q(`ALTER TABLE ${TABLE} DROP COLUMN old_values`);
        if (hasNew) await q(`ALTER TABLE ${TABLE} DROP COLUMN new_values`);
      }

      // 4. No IP addresses or user agents (design §9). Counted, never printed.
      let carried = 0;
      for (const name of ['ip_address', 'user_agent']) {
        if (!cols.has(name)) continue;
        const [rows] = await q(`SELECT COUNT(*)::int AS n FROM ${TABLE} WHERE ${name} IS NOT NULL`);
        carried += rows[0].n;
        await q(`ALTER TABLE ${TABLE} DROP COLUMN ${name}`);
      }

      // 5. created_at: production's type and default.
      const created = cols.get('created_at');
      if (!created) {
        await q(`ALTER TABLE ${TABLE} ADD COLUMN created_at TIMESTAMP DEFAULT NOW()`);
      } else {
        if (created.data_type === 'timestamp with time zone') {
          await q(`ALTER TABLE ${TABLE} ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC'`);
        }
        await q(`ALTER TABLE ${TABLE} ALTER COLUMN created_at SET DEFAULT NOW()`);
        if (created.is_nullable === 'NO') await q(`ALTER TABLE ${TABLE} ALTER COLUMN created_at DROP NOT NULL`);
      }

      // 6. Indexes: the old migration's four go; one for "the history of this thing".
      for (const name of OLD_INDEXES) {
        const [own] = await q(
          `SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = :table AND indexname = :name`, { table: TABLE, name });
        if (own.length) await q(`DROP INDEX "${name}"`);
      }
      await q(`CREATE INDEX IF NOT EXISTS ${INDEX} ON ${TABLE} (resource_type, resource_id)`);

      const [count] = await q(`SELECT COUNT(*)::int AS n FROM ${TABLE}`);
      console.log(`[migration 20261111230000] activity_logs is in its one shape; ${count[0].n} row(s) kept`
        + (carried ? `; ${carried} IP address / user agent value(s) dropped with their columns` : ''));
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, transaction });
      const [exists] = await q('SELECT to_regclass(:name) AS reg', { name: `public.${TABLE}` });
      if (!exists[0].reg) return;
      const [count] = await q(`SELECT COUNT(*)::int AS n FROM ${TABLE}`);
      if (count[0].n > 0) {
        throw new Error(`[migration 20261111230000] down refused, nothing changed: activity_logs holds ${count[0].n} audit row(s). `
          + 'resource_id cannot go back to INTEGER with them in it, and audit history is not deleted to make a rollback possible.');
      }
      await q(`DROP INDEX IF EXISTS ${INDEX}`);
      const [col] = await q(
        `SELECT data_type FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = :table AND column_name = 'resource_id'`, { table: TABLE });
      if (col.length && col[0].data_type !== 'integer') {
        await q(`ALTER TABLE ${TABLE} ALTER COLUMN resource_id TYPE INTEGER USING NULL::integer`);
      }
    });
  },
};
