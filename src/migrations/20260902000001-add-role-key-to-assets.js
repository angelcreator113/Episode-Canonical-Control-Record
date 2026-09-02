'use strict';

/**
 * Add role_key to assets.
 *
 * AssetRoleService.js assigns a per-show custom role (from the new
 * asset_roles registry, 20260902000000-create-asset-roles.js) to an asset by
 * writing and querying `assets.role_key` at five call sites
 * (getRoleUsageStats, assignRoleToAsset, deleteRole's in-use check,
 * getAssetsByRole, bulkAssignRoles) — but no migration ever added the
 * column. Found live: GET /api/v1/roles/stats 500s with "column
 * Asset.role_key does not exist" once the asset_roles table itself was
 * fixed (docs/audit/F-AUTH-1_FD67_Remedy_Implementation_2026-09-02.md §7.2
 * traces the discovery chain). A further instance of FD-66's schema-drift
 * class, on a different table than any FD-66 names.
 *
 * NOT the same field as the pre-existing `asset_role` column
 * (Asset.js:23) — that is a broader, hierarchical taxonomy
 * ("CHAR.HOST.LALA", "UI.ICON.CLOSET") unrelated to and untouched by the
 * per-show AssetRole registry. `role_key` is new, additive, and named to
 * match AssetRoleService.js's own already-written code rather than
 * renaming five call sites to fit an unrelated existing column.
 *
 * Plain string, not a foreign key. AssetRole.role_key is only unique
 * per-show (composite unique on (show_id, role_key) —
 * 20260902000000-create-asset-roles.js), so a single-column FK on role_key
 * alone would not express the real relationship, and the existing service
 * code never joins the two tables — it does independent string-equality
 * filters, scoped by show_id from the request, not by a database
 * constraint. Matches the loose-reference style already used for
 * asset_role.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('assets').catch(() => ({}));
    if (!table.role_key) {
      await queryInterface.addColumn('assets', 'role_key', {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Per-show custom role key (asset_roles.role_key) assigned via AssetRoleService. Not the same as asset_role.',
      });

      await queryInterface.addIndex('assets', ['role_key'], {
        name: 'idx_assets_role_key',
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('assets').catch(() => ({}));
    if (table.role_key) {
      await queryInterface.removeIndex('assets', 'idx_assets_role_key').catch(() => {});
      await queryInterface.removeColumn('assets', 'role_key');
    }
  },
};
