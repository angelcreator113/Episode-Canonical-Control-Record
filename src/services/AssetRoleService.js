const { models } = require('../models');

/**
 * AssetRoleService
 * Manages show-level asset role registry
 */
class AssetRoleService {
  /**
   * Get all roles for a show
   */
  async getRolesForShow(showId) {
    const roles = await models.AssetRole.findAll({
      where: { show_id: showId },
      order: [
        ['sort_order', 'ASC'],
        ['role_label', 'ASC'],
      ],
    });
    return roles;
  }

  /**
   * Get role by key
   */
  async getRoleByKey(showId, roleKey) {
    const role = await models.AssetRole.findOne({
      where: {
        show_id: showId,
        role_key: roleKey,
      },
    });
    return role;
  }

  /**
   * Create custom role (adds to show's registry)
   */
  async createRole(showId, roleData) {
    const { role_key, role_label, category, icon, color, is_required, sort_order, description } =
      roleData;

    // Check for duplicate key
    const existing = await this.getRoleByKey(showId, role_key);
    if (existing) {
      throw new Error(`Role with key "${role_key}" already exists`);
    }

    const role = await models.AssetRole.create({
      show_id: showId,
      role_key,
      role_label,
      category,
      icon,
      color,
      is_required: is_required || false,
      sort_order: sort_order || 999,
      description,
    });

    console.log(`✅ Created custom role: ${role_key} for show ${showId}`);
    return role;
  }

  /**
   * Update role (only label, required flag, description can be changed)
   */
  async updateRole(showId, roleKey, updates) {
    const role = await this.getRoleByKey(showId, roleKey);
    if (!role) {
      throw new Error(`Role ${roleKey} not found`);
    }

    // Only allow editing certain fields (role_key is immutable)
    const allowedUpdates = {
      role_label: updates.role_label,
      category: updates.category,
      icon: updates.icon,
      color: updates.color,
      is_required: updates.is_required,
      sort_order: updates.sort_order,
      description: updates.description,
    };

    // Filter out undefined values
    Object.keys(allowedUpdates).forEach((key) => {
      if (allowedUpdates[key] === undefined) {
        delete allowedUpdates[key];
      }
    });

    await role.update(allowedUpdates);

    console.log(`✅ Updated role: ${roleKey}`);
    return role;
  }

  /**
   * Delete role (only if no assets are using it)
   */
  async deleteRole(showId, roleKey) {
    const role = await this.getRoleByKey(showId, roleKey);
    if (!role) {
      throw new Error(`Role ${roleKey} not found`);
    }

    // Check if any assets are using this role
    const assetsUsingRole = await models.Asset.count({
      where: { role_key: roleKey },
    });

    if (assetsUsingRole > 0) {
      throw new Error(`Cannot delete role ${roleKey}: ${assetsUsingRole} asset(s) are using it`);
    }

    await role.destroy();
    console.log(`✅ Deleted role: ${roleKey}`);
    return { deleted: true, role_key: roleKey };
  }

  /**
   * Get usage statistics for roles
   */
  async getRoleUsageStats(showId) {
    const roles = await this.getRolesForshow(showId);

    const stats = await Promise.all(
      roles.map(async (role) => {
        const assetCount = await models.Asset.count({
          where: { role_key: role.role_key },
        });

        return {
          ...role.toJSON(),
          asset_count: assetCount,
        };
      })
    );

    return stats;
  }

  /**
   * Assign role to asset
   */
  async assignRoleToAsset(assetId, roleKey) {
    const asset = await models.Asset.findByPk(assetId);
    if (!asset) {
      throw new Error('Asset not found');
    }

    await models.Asset.update({ role_key: roleKey });
    console.log(`✅ Assigned role ${roleKey} to asset ${assetId}`);
    return asset;
  }

  /**
   * Bulk assign roles (for migration/batch operations)
   */
  async bulkAssignRoles(assignments) {
    // assignments = [{ assetId, roleKey }, ...]
    const results = {
      succeeded: 0,
      failed: 0,
      errors: [],
    };

    for (const { assetId, roleKey } of assignments) {
      try {
        await this.assignRoleToAsset(assetId, roleKey);
        results.succeeded++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          assetId,
          roleKey,
          error: error.message,
        });
      }
    }

    console.log(
      `✅ Bulk role assignment: ${results.succeeded} succeeded, ${results.failed} failed`
    );
    return results;
  }

  /**
   * Get assets by role (for Thumbnail Composer)
   */
  async getAssetsByRole(roleKey, options = {}) {
    const where = { role_key: roleKey };

    // Filter by show if provided
    if (options.showId) {
      where.show_id = options.showId;
    }

    // Only approved assets if specified
    if (options.approved) {
      where.approval_status = 'APPROVED';
    }

    const assets = await models.Asset.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: options.limit || 100,
    });

    return assets;
  }

  /**
   * Get most recent asset for each required role (for Composer auto-select)
   */
  async getLatestAssetsForRequiredRoles(showId) {
    const requiredRoles = await models.AssetRole.findAll({
      where: {
        show_id: showId,
        is_required: true,
      },
    });

    const roleAssets = {};

    for (const role of requiredRoles) {
      const assets = await this.getAssetsByRole(role.role_key, {
        showId,
        approved: true,
        limit: 1,
      });

      roleAssets[role.role_key] = assets[0] || null;
    }

    return roleAssets;
  }

  /**
   * Validate required roles for composer export
   */
  async validateRequiredRoles(showId, providedRoles) {
    // providedRoles = { HOST: assetId, BACKGROUND_MAIN: assetId, ... }
    const requiredRoles = await models.AssetRole.findAll({
      where: {
        show_id: showId,
        is_required: true,
      },
    });

    const missing = [];
    const warnings = [];

    for (const role of requiredRoles) {
      if (!providedRoles[role.role_key]) {
        missing.push({
          role_key: role.role_key,
          role_label: role.role_label,
          description: role.description,
        });
      }
    }

    return {
      valid: missing.length === 0,
      missing,
      warnings,
    };
  }

  /**
   * Initialize default roles for show (called on show creation)
   */
  async initializeDefaultRoles(showId) {
    const roles = models.AssetRole.DEFAULT_ROLES.map((role) => ({
      ...role,
      show_id: showId,
    }));

    await models.AssetRole.bulkCreate(roles, {
      ignoreDuplicates: true,
    });

    console.log(`✅ Initialized ${roles.length} default roles for show ${showId}`);
    return roles;
  }
}

module.exports = new AssetRoleService();
