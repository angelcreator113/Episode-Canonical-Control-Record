'use strict';

/**
 * Migration: create asset_roles
 *
 * src/models/AssetRole.js (tableName: 'asset_roles') has existed with no
 * migration under any spelling — the exact shape FD-66's own §6.3 "bucket 3"
 * names (a model whose table migrations never build), found here while
 * fixing an unrelated typo bug in AssetRoleService.js during F-AUTH-1 FD-67
 * Option 1's real-database testing. GET /api/v1/roles and GET
 * /api/v1/roles/stats have never returned 200 — first a JS TypeError from
 * the typo, then (once that and a separate missing-model-registration bug
 * were fixed) "relation \"asset_roles\" does not exist". This migration is
 * the remaining piece.
 *
 * Columns, indexes and their (show_id, role_key) uniqueness match
 * src/models/AssetRole.js exactly. `deleted_at` is added per CLAUDE.md's
 * migration convention ("always deleted_at") even though the model sets
 * `timestamps: false` and does not opt out of the global `paranoid: true`
 * default (src/config/sequelize.js:63) — FD-66 §B1 names this exact shape
 * "inoperatively paranoid": Sequelize never names `deleted_at` in a query
 * it issues for this model, so the column exists and is always NULL rather
 * than being actively unused. Not a defect this migration introduces or is
 * positioned to fix; recorded so a future reader does not mistake a present
 * `deleted_at` column for evidence the model soft-deletes rows.
 *
 * Does not seed AssetRole.DEFAULT_ROLES. That happens per-show, at show
 * creation, via AssetRoleService.initializeDefaultRoles(showId) — this
 * migration is schema only, matching the create-table convention used
 * elsewhere in this tree (e.g. 20260730000000-create-phone-playthrough-state.js).
 *
 * IDEMPOTENT, Task #1942. Production already has asset_roles: 12 columns,
 * no deleted_at (canon capture 2026-09-17; it existed at the 2026-08-29
 * capture too, before this file was written; docs/MIGRATION_DRIFT_READ.md
 * §3). The unguarded createTable failed there, so this file has never run in
 * production and is edited in place. Now:
 *
 *   - asset_roles absent (CI, a fresh database): created exactly as before,
 *     deleted_at included, then the three indexes.
 *   - asset_roles present: createTable is skipped; deleted_at is added if
 *     missing (nullable, no default, so no row changes meaning); then each
 *     of the three indexes is created only if it is missing.
 *
 * "Missing" means no index of that name, and no index over the same columns
 * in the same order with the same uniqueness. Production's index names are
 * not in the register, and every candidate creator of its table (the
 * scripts/migrations SQL, migrations/20260629000000 batch 1, sync()) builds
 * UNIQUE (show_id, role_key) plus one index on show_id and one on role_key
 * under names of their own. An equivalent index under another name is left
 * alone and logged rather than duplicated. A full UNIQUE (show_id, role_key)
 * already enforces everything the partial unique index would (it is
 * stricter), so it counts as equivalent.
 *
 * down: drops the table only when it holds no rows. up cannot tell a table
 * it created from one it adopted, and production's holds roles seeded per
 * show; with rows present, down logs and leaves the table as it is (a later
 * up adopts it again).
 */

const TABLE = 'asset_roles';
const LOG = '[migration 20260902000000]';

const INDEXES = [
  { name: 'uq_asset_roles_show_role_key', fields: ['show_id', 'role_key'], unique: true, where: { deleted_at: null } },
  { name: 'idx_asset_roles_show_id', fields: ['show_id'], unique: false },
  { name: 'idx_asset_roles_role_key', fields: ['role_key'], unique: false },
];

/**
 * The index in `existing` (queryInterface.showIndex rows) that already
 * serves `wanted`, or null. Same name; or the same columns in the same order
 * and the same uniqueness, with a full (non-partial) unique index counting
 * for the partial unique one.
 */
function equivalentIndex(existing, wanted) {
  const byName = existing.find((ix) => ix.name === wanted.name);
  if (byName) return byName;
  return existing.find((ix) => {
    if (ix.primary) return false;
    const cols = (ix.fields || []).map((f) => f.attribute);
    if (cols.length !== wanted.fields.length || !cols.every((c, i) => c === wanted.fields[i])) return false;
    if (!!ix.unique !== wanted.unique) return false;
    const partial = / WHERE /i.test(ix.definition || '');
    // A partial index is never taken as equivalent: its predicate is unread.
    return !partial;
  }) || null;
}

module.exports = {
  equivalentIndex,
  INDEXES,

  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.transaction(async (transaction) => {
      const exists = await queryInterface.tableExists(TABLE, { transaction });

      if (!exists) {
        await queryInterface.createTable('asset_roles', {
          id: {
            type: Sequelize.UUID,
            defaultValue: Sequelize.literal('gen_random_uuid()'),
            primaryKey: true,
          },
          show_id: {
            type: Sequelize.UUID,
            allowNull: true,
            references: { model: 'shows', key: 'id' },
          },
          role_key: {
            type: Sequelize.STRING(100),
            allowNull: false,
            comment: 'Immutable identifier (HOST, GUEST_1, etc.)',
          },
          role_label: {
            type: Sequelize.STRING(255),
            allowNull: false,
            comment: 'Editable display name',
          },
          category: {
            type: Sequelize.STRING(100),
            allowNull: true,
            comment: 'Characters, UI Icons, UI Chrome, Branding, Background',
          },
          icon: {
            type: Sequelize.STRING(50),
            allowNull: true,
            comment: 'Emoji or icon code for UI display',
          },
          color: {
            type: Sequelize.STRING(20),
            allowNull: true,
            comment: 'Hex color for UI display',
          },
          is_required: {
            type: Sequelize.BOOLEAN,
            allowNull: true,
            defaultValue: false,
            comment: 'Must be filled for composer export',
          },
          sort_order: {
            type: Sequelize.INTEGER,
            allowNull: true,
            defaultValue: 0,
          },
          description: {
            type: Sequelize.TEXT,
            allowNull: true,
          },
          created_at: {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: Sequelize.literal('NOW()'),
          },
          updated_at: {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: Sequelize.literal('NOW()'),
          },
          deleted_at: {
            type: Sequelize.DATE,
            allowNull: true,
          },
        }, { transaction });
        for (const ix of INDEXES) {
          const { fields, ...options } = ix;
          await queryInterface.addIndex(TABLE, fields, { ...options, transaction });
        }
        console.log(`${LOG} created ${TABLE} with its three indexes.`);
        return;
      }

      console.log(`${LOG} ${TABLE} already exists; adopting it (Task #1942).`);
      const columns = await queryInterface.describeTable(TABLE, { transaction });
      if (!columns.deleted_at) {
        await queryInterface.addColumn(TABLE, 'deleted_at', { type: Sequelize.DATE, allowNull: true }, { transaction });
        console.log(`${LOG} added ${TABLE}.deleted_at.`);
      } else {
        console.log(`${LOG} ${TABLE}.deleted_at already exists.`);
      }

      const existing = await queryInterface.showIndex(TABLE, { transaction });
      for (const ix of INDEXES) {
        const found = equivalentIndex(existing, ix);
        if (found) {
          console.log(`${LOG} ${ix.name}: already served by ${found.name}; not created.`);
          continue;
        }
        const { fields, ...options } = ix;
        await queryInterface.addIndex(TABLE, fields, { ...options, transaction });
        console.log(`${LOG} ${ix.name}: created.`);
      }
    });
  },

  async down(queryInterface) {
    if (!(await queryInterface.tableExists(TABLE))) {
      console.warn(`${LOG} ${TABLE} does not exist here; nothing to drop.`);
      return;
    }
    const [rows] = await queryInterface.sequelize.query(`SELECT COUNT(*)::int AS n FROM "${TABLE}"`);
    const n = rows && rows[0] ? Number(rows[0].n) : 0;
    if (n > 0) {
      console.warn(`${LOG} ${TABLE} holds ${n} rows; not dropped (this migration may have adopted it rather than created it).`);
      return;
    }
    await queryInterface.dropTable(TABLE);
  },
};
