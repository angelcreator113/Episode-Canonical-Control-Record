const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

/**
 * CompositionAsset Model
 * 
 * Junction table linking thumbnail compositions to assets via roles.
 * Replaces hardcoded columns (lala_asset_id, guest_asset_id, etc.) with
 * flexible role-based system.
 * 
 * Each composition can have multiple assets in different roles:
 * - CHAR.HOST.PRIMARY (LaLa)
 * - BG.MAIN (background)
 * - GUEST.REACTION.1, GUEST.REACTION.2 (guests)
 * - WARDROBE.ITEM.1-8 (wardrobe items)
 * - TEXT.TITLE.PRIMARY, TEXT.SUBTITLE.PRIMARY (text)
 * - BRAND.LOGO.PRIMARY (show logo)
 */

module.exports = (sequelize) => {
  const CompositionAsset = sequelize.define('CompositionAsset', {
    composition_asset_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
      allowNull: false,
      comment: 'Unique junction record identifier'
    },
    composition_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'thumbnail_compositions',
        key: 'composition_id'
      },
      comment: 'Composition this asset belongs to'
    },
    asset_role: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        isValidRole(value) {
          const parts = value.split('.');
          if (parts.length < 2 || parts.length > 3) {
            throw new Error('asset_role must be in format CATEGORY.ROLE or CATEGORY.ROLE.VARIANT');
          }
          if (parts.some(p => p.length === 0)) {
            throw new Error('asset_role parts cannot be empty');
          }
        }
      },
      comment: 'Role this asset fills (e.g., CHAR.HOST.PRIMARY, BG.MAIN)'
    },
    asset_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'assets',
        key: 'asset_id'
      },
      comment: 'Asset being used in this role'
    },
    layer_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      },
      comment: 'Z-index for layering (0 = bottom, higher = on top)'
    },
    custom_config: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Custom positioning/scaling overrides: { x, y, width, height, rotation, opacity }'
    }
  }, {
    tableName: 'composition_assets',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    indexes: [
      {
        name: 'idx_comp_assets_composition',
        fields: ['composition_id']
      },
      {
        name: 'idx_comp_assets_asset',
        fields: ['asset_id']
      },
      {
        name: 'idx_comp_assets_comp_role',
        unique: true,
        fields: ['composition_id', 'asset_role']
      }
    ]
  });

  // ===================================
  // STATIC METHODS
  // ===================================

  /**
   * Parse role into components
   * @param {string} role - Role string (e.g., "CHAR.HOST.PRIMARY")
   * @returns {Object} { category, role, variant, full }
   */
  CompositionAsset.parseRole = function(role) {
    const parts = role.split('.');
    return {
      category: parts[0] || null,
      role: parts[1] || null,
      variant: parts[2] || null,
      full: role
    };
  };

  /**
   * Get all assets for a composition, ordered by layer
   * @param {string} compositionId - Composition UUID
   * @returns {Promise<Array>} Array of CompositionAsset instances
   */
  CompositionAsset.getForComposition = async function(compositionId) {
    return await this.findAll({
      where: { composition_id: compositionId },
      include: [{
        model: sequelize.models.Asset,
        as: 'asset',
        attributes: ['asset_id', 'asset_name', 's3_url_processed', 'asset_type', 'asset_role']
      }],
      order: [['layer_order', 'ASC']]
    });
  };

  /**
   * Get assets grouped by role category
   * @param {string} compositionId - Composition UUID
   * @returns {Promise<Object>} { BG: [...], CHAR: [...], GUEST: [...], etc. }
   */
  CompositionAsset.getGroupedByCategory = async function(compositionId) {
    const assets = await this.getForComposition(compositionId);
    const grouped = {};
    
    assets.forEach(compAsset => {
      const parsed = this.parseRole(compAsset.asset_role);
      if (!grouped[parsed.category]) {
        grouped[parsed.category] = [];
      }
      grouped[parsed.category].push(compAsset);
    });
    
    return grouped;
  };

  /**
   * Find asset by role in composition
   * @param {string} compositionId - Composition UUID
   * @param {string} role - Asset role to find
   * @returns {Promise<CompositionAsset|null>}
   */
  CompositionAsset.findByRole = async function(compositionId, role) {
    return await this.findOne({
      where: {
        composition_id: compositionId,
        asset_role: role
      },
      include: [{
        model: sequelize.models.Asset,
        as: 'asset'
      }]
    });
  };

  /**
   * Bulk create composition assets (replaces existing)
   * @param {string} compositionId - Composition UUID
   * @param {Array} assetRoles - Array of { asset_role, asset_id, layer_order?, custom_config? }
   * @param {Object} transaction - Sequelize transaction
   * @returns {Promise<Array>} Created CompositionAsset instances
   */
  CompositionAsset.setForComposition = async function(compositionId, assetRoles, transaction = null) {
    // Delete existing assets for this composition
    await this.destroy({
      where: { composition_id: compositionId },
      transaction
    });

    // Create new associations
    const records = assetRoles.map(ar => ({
      composition_id: compositionId,
      asset_role: ar.asset_role,
      asset_id: ar.asset_id,
      layer_order: ar.layer_order ?? 0,
      custom_config: ar.custom_config || null
    }));

    return await this.bulkCreate(records, { transaction });
  };

  /**
   * Check if composition has asset for role
   * @param {string} compositionId - Composition UUID
   * @param {string} role - Asset role to check
   * @returns {Promise<boolean>}
   */
  CompositionAsset.hasRole = async function(compositionId, role) {
    const count = await this.count({
      where: {
        composition_id: compositionId,
        asset_role: role
      }
    });
    return count > 0;
  };

  // ===================================
  // INSTANCE METHODS
  // ===================================

  /**
   * Get parsed role components
   * @returns {Object} { category, role, variant, full }
   */
  CompositionAsset.prototype.getParsedRole = function() {
    return CompositionAsset.parseRole(this.asset_role);
  };

  /**
   * Get role category (first part before dot)
   * @returns {string}
   */
  CompositionAsset.prototype.getCategory = function() {
    return this.getParsedRole().category;
  };

  /**
   * Get role name (second part)
   * @returns {string}
   */
  CompositionAsset.prototype.getRoleName = function() {
    return this.getParsedRole().role;
  };

  /**
   * Get role variant (third part, may be null)
   * @returns {string|null}
   */
  CompositionAsset.prototype.getVariant = function() {
    return this.getParsedRole().variant;
  };

  /**
   * Check if this is a character asset
   * @returns {boolean}
   */
  CompositionAsset.prototype.isCharacter = function() {
    return this.getCategory() === 'CHAR';
  };

  /**
   * Check if this is a background asset
   * @returns {boolean}
   */
  CompositionAsset.prototype.isBackground = function() {
    return this.getCategory() === 'BG';
  };

  /**
   * Check if this is a guest asset
   * @returns {boolean}
   */
  CompositionAsset.prototype.isGuest = function() {
    return this.getCategory() === 'GUEST';
  };

  /**
   * Check if this is a wardrobe asset
   * @returns {boolean}
   */
  CompositionAsset.prototype.isWardrobe = function() {
    return this.getCategory() === 'WARDROBE';
  };

  /**
   * Check if this is a text asset
   * @returns {boolean}
   */
  CompositionAsset.prototype.isText = function() {
    return this.getCategory() === 'TEXT';
  };

  /**
   * Check if this is a brand asset
   * @returns {boolean}
   */
  CompositionAsset.prototype.isBrand = function() {
    return this.getCategory() === 'BRAND';
  };

  /**
   * Get effective configuration (template + custom overrides)
   * @param {Object} templateLayout - Layout from template
   * @returns {Object} Merged configuration
   */
  CompositionAsset.prototype.getEffectiveConfig = function(templateLayout) {
    return {
      ...templateLayout,
      ...this.custom_config
    };
  };

  // ===================================
  // ASSOCIATIONS
  // ===================================

  CompositionAsset.associate = function(models) {
    // CompositionAsset belongs to ThumbnailComposition
    CompositionAsset.belongsTo(models.ThumbnailComposition, {
      foreignKey: 'composition_id',
      as: 'composition',
      onDelete: 'CASCADE'
    });

    // CompositionAsset belongs to Asset
    CompositionAsset.belongsTo(models.Asset, {
      foreignKey: 'asset_id',
      as: 'asset',
      onDelete: 'RESTRICT'
    });
  };

  return CompositionAsset;
};
