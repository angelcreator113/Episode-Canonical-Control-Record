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
 */

module.exports = {
  async up(queryInterface, Sequelize) {
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
    });

    await queryInterface.addIndex('asset_roles', ['show_id', 'role_key'], {
      unique: true,
      name: 'uq_asset_roles_show_role_key',
      where: { deleted_at: null },
    });

    await queryInterface.addIndex('asset_roles', ['show_id'], {
      name: 'idx_asset_roles_show_id',
    });

    await queryInterface.addIndex('asset_roles', ['role_key'], {
      name: 'idx_asset_roles_role_key',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('asset_roles');
  },
};
