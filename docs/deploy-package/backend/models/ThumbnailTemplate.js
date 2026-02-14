const { DataTypes } = require('sequelize');
const { v4: uuidv4 } = require('uuid');

/**
 * ThumbnailTemplate Model
 * 
 * Defines reusable thumbnail layouts with required/optional asset roles.
 * Templates can be global or show-specific.
 * 
 * Asset Role Format: CATEGORY.ROLE.VARIANT
 * Examples:
 * - CHAR.HOST.PRIMARY (LaLa character)
 * - BG.MAIN (background image)
 * - GUEST.REACTION.1 (first guest)
 * - WARDROBE.ITEM.1-8 (wardrobe items)
 * - TEXT.TITLE.PRIMARY (episode title)
 * - BRAND.LOGO.PRIMARY (show logo)
 */

module.exports = (sequelize) => {
  const ThumbnailTemplate = sequelize.define('ThumbnailTemplate', {
    template_id: {
      type: DataTypes.UUID,
      primaryKey: true,
      defaultValue: () => uuidv4(),
      allowNull: false,
      comment: 'Unique template identifier'
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'shows',
        key: 'show_id'
      },
      comment: 'Show this template belongs to (null = global)'
    },
    template_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      validate: {
        notEmpty: true,
        len: [1, 100]
      },
      comment: 'Human-readable template name (e.g., "Styling Adventures v1")'
    },
    template_version: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        notEmpty: true,
        is: /^\d+\.\d+(\.\d+)?$/ // Semantic versioning: 1.0, 1.2.3, etc.
      },
      comment: 'Template version string'
    },
    required_roles: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidRoles(value) {
          if (!Array.isArray(value)) {
            throw new Error('required_roles must be an array');
          }
          value.forEach(role => {
            if (!ThumbnailTemplate.isValidRole(role)) {
              throw new Error(`Invalid role format: ${role}. Expected CATEGORY.ROLE or CATEGORY.ROLE.VARIANT`);
            }
          });
        }
      },
      comment: 'Array of required asset roles that must be present'
    },
    optional_roles: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidRoles(value) {
          if (!Array.isArray(value)) {
            throw new Error('optional_roles must be an array');
          }
          value.forEach(role => {
            if (!ThumbnailTemplate.isValidRole(role)) {
              throw new Error(`Invalid role format: ${role}. Expected CATEGORY.ROLE or CATEGORY.ROLE.VARIANT`);
            }
          });
        }
      },
      comment: 'Array of optional asset roles (composition succeeds without them)'
    },
    layout_config: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
      validate: {
        isValidLayout(value) {
          if (typeof value !== 'object' || value === null) {
            throw new Error('layout_config must be an object');
          }
          if (!value.baseWidth || !value.baseHeight) {
            throw new Error('layout_config must include baseWidth and baseHeight');
          }
          if (!value.layers || typeof value.layers !== 'object') {
            throw new Error('layout_config must include layers object');
          }
        }
      },
      comment: 'Layout configuration: { baseWidth, baseHeight, layers: { ROLE: { x, y, width, height, zIndex } } }'
    },
    format_overrides: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Format-specific dimension/layout overrides: { YOUTUBE: {...}, INSTAGRAM_FEED: {...} }'
    },
    text_layers: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
      validate: {
        isValidTextLayers(value) {
          if (!Array.isArray(value)) {
            throw new Error('text_layers must be an array');
          }
        }
      },
      comment: 'Text layer definitions: [{ role, fontFamily, fontSize, color, stroke, position }]'
    },    conditional_roles: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Roles required only if other roles are present: { "UI.PANEL": { required_if: ["ITEM.1"] } }'
    },
    paired_roles: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Roles that should appear together: { "WARDROBE.ITEM.1": "ICON.WARDROBE.1" }'
    },    conditional_roles: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Roles required only if other roles are present: { "UI.PANEL": { required_if: ["ITEM.1"] } }'
    },
    paired_roles: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Roles that should appear together: { "WARDROBE.ITEM.1": "ICON.WARDROBE.1" }'
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      comment: 'Whether this template version is currently active'
    }
  }, {
    tableName: 'thumbnail_templates',
    timestamps: true,
    paranoid: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
    indexes: [
      {
        name: 'idx_templates_show_active',
        fields: ['show_id', 'is_active']
      },
      {
        name: 'idx_templates_name_version',
        fields: ['template_name', 'template_version']
      }
    ]
  });

  // ===================================
  // STATIC METHODS
  // ===================================

  /**
   * Validate role format: CATEGORY.ROLE or CATEGORY.ROLE.VARIANT
   */
  ThumbnailTemplate.isValidRole = function(role) {
    if (typeof role !== 'string') return false;
    const parts = role.split('.');
    return parts.length >= 2 && parts.length <= 3 && parts.every(p => p.length > 0);
  };

  /**
   * Parse role into components
   */
  ThumbnailTemplate.parseRole = function(role) {
    const parts = role.split('.');
    return {
      category: parts[0],
      role: parts[1],
      variant: parts[2] || null,
      full: role
    };
  };

  /**
   * Get all active templates for a show (includes global templates)
   */
  ThumbnailTemplate.getActiveForShow = async function(showId) {
    return await this.findAll({
      where: {
        is_active: true,
        [sequelize.Sequelize.Op.or]: [
          { show_id: showId },
          { show_id: null } // Global templates
        ]
      },
      order: [
        ['show_id', 'DESC NULLS LAST'], // Show-specific first
        ['template_name', 'ASC'],
        ['template_version', 'DESC']
      ]
    });
  };

  /**
   * Get latest version of a template by name
   */
  ThumbnailTemplate.getLatestVersion = async function(templateName, showId = null) {
    return await this.findOne({
      where: {
        template_name: templateName,
        is_active: true,
        show_id: showId
      },
      order: [['template_version', 'DESC']]
    });
  };

  // ===================================
  // INSTANCE METHODS
  // ===================================

  /**
   * Get all roles (required + optional)
   */
  ThumbnailTemplate.prototype.getAllRoles = function() {
    return [...this.required_roles, ...this.optional_roles];
  };

  /**
   * Check if a role is required
   */
  ThumbnailTemplate.prototype.isRoleRequired = function(role) {
    return this.required_roles.includes(role);
  };

  /**
   * Check if a role is optional
   */
  ThumbnailTemplate.prototype.isRoleOptional = function(role) {
    return this.optional_roles.includes(role);
  };

  /**
   * Get layout for a specific role
   */
  ThumbnailTemplate.prototype.getLayoutForRole = function(role) {
    return this.layout_config?.layers?.[role] || null;
  };

  /**
   * Get format-specific override or default layout
   */
  ThumbnailTemplate.prototype.getLayoutForFormat = function(format) {
    if (this.format_overrides && this.format_overrides[format]) {
      return {
        ...this.layout_config,
        ...this.format_overrides[format]
      };
    }
    return this.layout_config;
  };

  /**
   * Validate that a composition has all required assets
   * 
   * @param {Array} compositionAssets - Array of { asset_role, asset_id } objects
   * @returns {Object} { valid: boolean, errors: [], warnings: [] }
   */
  ThumbnailTemplate.prototype.validateComposition = function(compositionAssets) {
    const result = {
      valid: true,
      errors: [],
      warnings: []
    };

    const providedRoles = compositionAssets.map(ca => ca.asset_role);

    // Check required roles
    for (const requiredRole of this.required_roles) {
      if (!providedRoles.includes(requiredRole)) {
        result.valid = false;
        result.errors.push(`Missing required asset for role: ${requiredRole}`);
      }
    }

    // Check conditional roles
    if (this.conditional_roles) {
      for (const [role, condition] of Object.entries(this.conditional_roles)) {
        const { required_if } = condition;
        if (required_if && required_if.some(r => providedRoles.includes(r))) {
          // At least one trigger role is present
          if (!providedRoles.includes(role)) {
            result.valid = false;
            result.errors.push(`Role ${role} is required when ${required_if.join(' or ')} is present`);
          }
        }
      }
    }

    // Check paired roles
    if (this.paired_roles) {
      for (const [role1, role2] of Object.entries(this.paired_roles)) {
        const has1 = providedRoles.includes(role1);
        const has2 = providedRoles.includes(role2);
        
        if (has1 && !has2) {
          result.warnings.push(`${role1} is present but paired role ${role2} is missing`);
        } else if (has2 && !has1) {
          result.warnings.push(`${role2} is present but paired role ${role1} is missing`);
        }
      }
    }

    // Check for missing optional roles (warnings only)
    for (const optionalRole of this.optional_roles) {
      if (!providedRoles.includes(optionalRole)) {
        result.warnings.push(`Optional asset not provided: ${optionalRole}`);
      }
    }

    // Check for unknown roles
    for (const providedRole of providedRoles) {
      if (!this.required_roles.includes(providedRole) && !this.optional_roles.includes(providedRole)) {
        result.warnings.push(`Unknown role provided: ${providedRole}`);
      }
    }

    return result;
  };

  /**
   * Get text layer configuration for a role
   */
  ThumbnailTemplate.prototype.getTextLayerForRole = function(role) {
    return this.text_layers?.find(layer => layer.role === role) || null;
  };

  // ===================================
  // ASSOCIATIONS
  // ===================================

  ThumbnailTemplate.associate = function(models) {
    // Template belongs to a Show (or is global)
    ThumbnailTemplate.belongsTo(models.Show, {
      foreignKey: 'show_id',
      as: 'show',
      onDelete: 'CASCADE'
    });

    // Template has many Compositions
    ThumbnailTemplate.hasMany(models.ThumbnailComposition, {
      foreignKey: 'template_id',
      as: 'compositions',
      onDelete: 'SET NULL'
    });
  };

  return ThumbnailTemplate;
};
