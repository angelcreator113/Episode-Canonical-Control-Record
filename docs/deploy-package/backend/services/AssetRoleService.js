const { Asset, CompositionAsset, Episode, Show } = require('../models');
const { Op } = require('sequelize');

/**
 * AssetRoleService
 * 
 * Handles asset eligibility checking and role-based queries.
 * Implements the CATEGORY.ROLE.VARIANT naming system.
 */
class AssetRoleService {
  /**
   * Valid asset categories
   */
  static CATEGORIES = {
    TEXT: 'TEXT',
    BG: 'BG',
    CHAR: 'CHAR',
    GUEST: 'GUEST',
    WARDROBE: 'WARDROBE',
    UI: 'UI',
    ICON: 'ICON',
    BRAND: 'BRAND'
  };

  /**
   * Asset scope enum
   */
  static SCOPES = {
    GLOBAL: 'GLOBAL',
    SHOW: 'SHOW',
    EPISODE: 'EPISODE'
  };

  /**
   * Parse asset role into components
   * @param {string} role - Role string (e.g., "CHAR.HOST.PRIMARY")
   * @returns {Object} { category, role, variant, full }
   */
  static parseRole(role) {
    if (!role || typeof role !== 'string') {
      return null;
    }

    const parts = role.split('.');
    if (parts.length < 2 || parts.length > 3) {
      return null;
    }

    return {
      category: parts[0] || null,
      role: parts[1] || null,
      variant: parts[2] || null,
      full: role
    };
  }

  /**
   * Validate role format
   * @param {string} role - Role string
   * @returns {boolean}
   */
  static isValidRole(role) {
    const parsed = this.parseRole(role);
    return parsed !== null && parsed.category && parsed.role;
  }

  /**
   * Get all assets eligible for a specific role
   * @param {string} role - Asset role (e.g., "CHAR.HOST.PRIMARY")
   * @param {Object} context - { episodeId?, showId?, includeGlobal: true }
   * @returns {Promise<Array>}
   */
  static async getEligibleAssets(role, context = {}) {
    try {
      const parsed = this.parseRole(role);
      if (!parsed) {
        throw new Error(`Invalid role format: ${role}`);
      }

      const { episodeId, showId, includeGlobal = true } = context;

      // Build scope filter
      const scopeFilter = [];
      if (includeGlobal) {
        scopeFilter.push({ asset_scope: 'GLOBAL' });
      }
      if (showId) {
        scopeFilter.push({
          asset_scope: 'SHOW',
          show_id: showId
        });
      }
      if (episodeId) {
        // Get episode's show_id first
        const episode = await Episode.findByPk(episodeId, {
          attributes: ['show_id']
        });
        if (episode?.show_id) {
          scopeFilter.push({
            asset_scope: 'EPISODE',
            '$episodes.episode_id$': episodeId
          });
        }
      }

      if (scopeFilter.length === 0) {
        throw new Error('Must provide at least one scope context (episodeId, showId, or includeGlobal)');
      }

      // Query assets
      const assets = await Asset.findAll({
        where: {
          asset_role: {
            [Op.like]: `${parsed.category}.${parsed.role}%` // Match category.role with any variant
          },
          [Op.or]: scopeFilter
        },
        include: episodeId ? [
          {
            model: Episode,
            as: 'episodes',
            where: { episode_id: episodeId },
            required: false,
            through: { attributes: [] }
          }
        ] : [],
        order: [
          ['asset_scope', 'ASC'], // GLOBAL first
          ['asset_role', 'ASC'],
          ['created_at', 'DESC']
        ]
      });

      return assets;
    } catch (error) {
      console.error('Error getting eligible assets:', error);
      throw new Error(`Failed to get eligible assets: ${error.message}`);
    }
  }

  /**
   * Check if an asset can be used for a specific role
   * @param {string} assetId - Asset UUID
   * @param {string} role - Target role (e.g., "CHAR.HOST.PRIMARY")
   * @param {Object} context - { episodeId?, showId? }
   * @returns {Promise<Object>} { eligible: boolean, reason?: string }
   */
  static async canAssetBeUsedFor(assetId, role, context = {}) {
    try {
      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        return { eligible: false, reason: 'Asset not found' };
      }

      // Check role compatibility
      const targetParsed = this.parseRole(role);
      const assetParsed = this.parseRole(asset.asset_role);

      if (!targetParsed || !assetParsed) {
        return { eligible: false, reason: 'Invalid role format' };
      }

      // Must match category and role name (variant can differ)
      if (targetParsed.category !== assetParsed.category || targetParsed.role !== assetParsed.role) {
        return {
          eligible: false,
          reason: `Role mismatch: asset is ${asset.asset_role}, but ${role} is required`
        };
      }

      // Check scope eligibility
      const { episodeId, showId } = context;

      if (asset.asset_scope === 'GLOBAL') {
        return { eligible: true };
      }

      if (asset.asset_scope === 'SHOW') {
        if (!showId) {
          return { eligible: false, reason: 'Show-scoped asset requires showId context' };
        }
        if (asset.show_id !== showId) {
          return { eligible: false, reason: 'Asset belongs to a different show' };
        }
        return { eligible: true };
      }

      if (asset.asset_scope === 'EPISODE') {
        if (!episodeId) {
          return { eligible: false, reason: 'Episode-scoped asset requires episodeId context' };
        }
        
        // Check if asset is linked to this episode
        const episodeAsset = await asset.getEpisodes({
          where: { episode_id: episodeId }
        });

        if (episodeAsset.length === 0) {
          return { eligible: false, reason: 'Asset not linked to this episode' };
        }
        return { eligible: true };
      }

      return { eligible: false, reason: 'Unknown asset scope' };
    } catch (error) {
      console.error('Error checking asset eligibility:', error);
      throw new Error(`Failed to check eligibility: ${error.message}`);
    }
  }

  /**
   * Get assets by category
   * @param {string} category - Category (TEXT, BG, CHAR, etc.)
   * @param {Object} context - { episodeId?, showId?, includeGlobal: true }
   * @returns {Promise<Array>}
   */
  static async getAssetsByCategory(category, context = {}) {
    try {
      if (!this.CATEGORIES[category]) {
        throw new Error(`Invalid category: ${category}`);
      }

      const { episodeId, showId, includeGlobal = true } = context;

      const scopeFilter = [];
      if (includeGlobal) {
        scopeFilter.push({ asset_scope: 'GLOBAL' });
      }
      if (showId) {
        scopeFilter.push({
          asset_scope: 'SHOW',
          show_id: showId
        });
      }
      if (episodeId) {
        const episode = await Episode.findByPk(episodeId, {
          attributes: ['show_id']
        });
        if (episode?.show_id) {
          scopeFilter.push({
            asset_scope: 'EPISODE'
          });
        }
      }

      if (scopeFilter.length === 0) {
        throw new Error('Must provide at least one scope context');
      }

      const assets = await Asset.findAll({
        where: {
          asset_role: {
            [Op.like]: `${category}.%`
          },
          [Op.or]: scopeFilter
        },
        order: [
          ['asset_role', 'ASC'],
          ['created_at', 'DESC']
        ]
      });

      return assets;
    } catch (error) {
      console.error('Error getting assets by category:', error);
      throw new Error(`Failed to get assets: ${error.message}`);
    }
  }

  /**
   * Update asset role
   * @param {string} assetId - Asset UUID
   * @param {string} newRole - New role (e.g., "CHAR.HOST.PRIMARY")
   * @returns {Promise<Object>}
   */
  static async updateAssetRole(assetId, newRole) {
    try {
      if (!this.isValidRole(newRole)) {
        throw new Error(`Invalid role format: ${newRole}`);
      }

      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      await asset.update({ asset_role: newRole });
      return asset;
    } catch (error) {
      console.error('Error updating asset role:', error);
      throw new Error(`Failed to update role: ${error.message}`);
    }
  }

  /**
   * Update asset scope
   * @param {string} assetId - Asset UUID
   * @param {string} scope - GLOBAL, SHOW, or EPISODE
   * @param {string|null} showId - Required if scope is SHOW
   * @returns {Promise<Object>}
   */
  static async updateAssetScope(assetId, scope, showId = null) {
    try {
      if (!this.SCOPES[scope]) {
        throw new Error(`Invalid scope: ${scope}`);
      }

      if (scope === 'SHOW' && !showId) {
        throw new Error('showId required for SHOW scope');
      }

      const asset = await Asset.findByPk(assetId);
      if (!asset) {
        throw new Error('Asset not found');
      }

      await asset.update({
        asset_scope: scope,
        show_id: scope === 'SHOW' ? showId : null
      });

      return asset;
    } catch (error) {
      console.error('Error updating asset scope:', error);
      throw new Error(`Failed to update scope: ${error.message}`);
    }
  }

  /**
   * Get role usage statistics
   * @param {string} role - Asset role
   * @returns {Promise<Object>}
   */
  static async getRoleUsageStats(role) {
    try {
      const assetsWithRole = await Asset.count({
        where: { asset_role: role }
      });

      const compositionsUsingRole = await CompositionAsset.count({
        where: { asset_role: role }
      });

      return {
        role,
        totalAssets: assetsWithRole,
        compositionUsages: compositionsUsingRole
      };
    } catch (error) {
      console.error('Error getting role usage stats:', error);
      throw new Error(`Failed to get stats: ${error.message}`);
    }
  }

  /**
   * Get all unique roles in the system
   * @returns {Promise<Array>}
   */
  static async getAllRoles() {
    try {
      const assets = await Asset.findAll({
        attributes: ['asset_role'],
        where: {
          asset_role: { [Op.not]: null }
        },
        group: ['asset_role'],
        order: [['asset_role', 'ASC']]
      });

      return assets.map(a => a.asset_role).filter(Boolean);
    } catch (error) {
      console.error('Error getting all roles:', error);
      throw new Error(`Failed to get roles: ${error.message}`);
    }
  }

  /**
   * Suggest role for an asset based on its properties
   * @param {Object} asset - Asset properties
   * @returns {string|null}
   */
  static suggestRole(asset) {
    const { asset_type, asset_group, purpose, name } = asset;

    // Legacy mapping
    if (asset_group === 'LALA') {
      return 'CHAR.HOST.PRIMARY';
    }
    if (asset_group === 'GUEST') {
      return 'GUEST.REACTION.1';
    }
    if (asset_group === 'SHOW' && purpose === 'ICON') {
      return 'BRAND.LOGO.PRIMARY';
    }
    if (asset_group === 'WARDROBE') {
      return 'WARDROBE.ITEM.1';
    }
    if (asset_type === 'background' || purpose === 'BACKGROUND') {
      return 'BG.MAIN';
    }

    // Name-based suggestions
    const lowerName = (name || '').toLowerCase();
    if (lowerName.includes('background') || lowerName.includes('bg')) {
      return 'BG.MAIN';
    }
    if (lowerName.includes('logo') || lowerName.includes('brand')) {
      return 'BRAND.LOGO.PRIMARY';
    }
    if (lowerName.includes('title')) {
      return 'TEXT.TITLE.PRIMARY';
    }
    if (lowerName.includes('icon')) {
      return 'UI.ICON.PRIMARY';
    }

    return null;
  }
}

module.exports = AssetRoleService;
