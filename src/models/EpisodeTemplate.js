/**
 * Episode Template Model
 * Stores reusable episode templates for quick creation
 * Enhanced with validation, hooks, scopes, and helper methods
 */

module.exports = (sequelize) => {
  const { DataTypes, Op } = require('sequelize');

  const EpisodeTemplate = sequelize.define(
    'EpisodeTemplate',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        comment: 'Unique template identifier',
      },

      // ==================== BASIC INFO ====================
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: {
          notEmpty: {
            msg: 'Template name cannot be empty',
          },
          len: {
            args: [3, 255],
            msg: 'Template name must be between 3 and 255 characters',
          },
        },
        comment: 'Template display name',
      },

      slug: {
        type: DataTypes.STRING(255),
        allowNull: true,
        unique: true,
        comment: 'URL-friendly version of name',
      },

      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: '',
        validate: {
          len: {
            args: [0, 2000],
            msg: 'Description must be less than 2000 characters',
          },
        },
        comment: 'Template description for users',
      },

      // ==================== DEFAULT VALUES ====================
      defaultStatus: {
        type: DataTypes.STRING(50),
        defaultValue: 'draft',
        allowNull: false,
        field: 'default_status',
        validate: {
          isIn: [['draft', 'published', 'archived', 'pending']],
        },
        comment: 'Default episode status when using this template',
      },

      defaultCategories: {
        type: DataTypes.JSON,
        defaultValue: [],
        allowNull: false,
        field: 'default_categories',
        validate: {
          isArray(value) {
            if (!Array.isArray(value)) {
              throw new Error('defaultCategories must be an array');
            }
          },
          maxLength(value) {
            if (value.length > 20) {
              throw new Error('Maximum 20 categories allowed');
            }
          },
        },
        get() {
          const value = this.getDataValue('defaultCategories');
          return Array.isArray(value) ? value : [];
        },
        comment: 'Default categories/tags for episodes',
      },

      defaultDuration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'default_duration',
        validate: {
          min: {
            args: 1,
            msg: 'Duration must be at least 1 minute',
          },
          max: {
            args: 1440,
            msg: 'Duration cannot exceed 1440 minutes (24 hours)',
          },
        },
        comment: 'Default episode duration in minutes',
      },

      // ==================== TEMPLATE CONFIG ====================
      config: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: false,
        validate: {
          isValidConfig(value) {
            if (typeof value !== 'object' || value === null) {
              throw new Error('Config must be a valid JSON object');
            }
          },
        },
        get() {
          const value = this.getDataValue('config');
          return value || {};
        },
        comment: 'Additional template configuration',
      },

      // ==================== METADATA ====================
      icon: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: '📺',
        validate: {
          len: {
            args: [0, 100],
            msg: 'Icon must be less than 100 characters',
          },
        },
        comment: 'Emoji or icon identifier',
      },

      color: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: '#667eea',
        validate: {
          isValidColor(value) {
            if (value && !/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(value)) {
              throw new Error('Color must be a valid hex color (e.g., #667eea)');
            }
          },
        },
        comment: 'Template color theme (hex)',
      },

      sortOrder: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'sort_order',
        comment: 'Display order (lower numbers first)',
      },

      usageCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'usage_count',
        validate: {
          min: 0,
        },
        comment: 'Number of times template has been used',
      },

      // ==================== STATUS ====================
      isActive: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'is_active',
        comment: 'Whether template is available for use',
      },

      isDefault: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_default',
        comment: 'Whether this is the default template',
      },

      isSystemTemplate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_system_template',
        comment: 'System templates cannot be deleted by users',
      },

      // ==================== TRACKING ====================
      createdBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'created_by',
        comment: 'User who created this template',
      },

      updatedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'updated_by',
        comment: 'User who last updated this template',
      },

      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at',
        comment: 'When template was last used',
      },

      // ==================== TIMESTAMPS ====================
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },

      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },

      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
        comment: 'Soft delete timestamp',
      },
    },
    {
      tableName: 'episode_templates',
      timestamps: true,
      underscored: true,
      paranoid: true, // Enable soft deletes

      indexes: [
        {
          fields: ['name'],
          unique: true,
          where: { deleted_at: null },
        },
        {
          fields: ['slug'],
          unique: true,
          where: { deleted_at: null },
        },
        {
          fields: ['is_active'],
        },
        {
          fields: ['is_default'],
        },
        {
          fields: ['sort_order'],
        },
        {
          fields: ['created_by'],
        },
        {
          fields: ['usage_count'],
        },
      ],

      // ==================== HOOKS ====================
      hooks: {
        beforeValidate: (template) => {
          // Auto-generate slug from name
          if (template.name && !template.slug) {
            template.slug = template.name
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-|-$/g, '');
          }
        },

        beforeCreate: async (template) => {
          // Ensure only one default template
          if (template.isDefault) {
            await EpisodeTemplate.update({ isDefault: false }, { where: { isDefault: true } });
          }
        },

        beforeUpdate: async (template) => {
          // Ensure only one default template
          if (template.changed('isDefault') && template.isDefault) {
            await EpisodeTemplate.update(
              { isDefault: false },
              { where: { isDefault: true, id: { [Op.ne]: template.id } } }
            );
          }
        },

        beforeDestroy: (template) => {
          // Prevent deletion of system templates
          if (template.isSystemTemplate) {
            throw new Error('System templates cannot be deleted');
          }
        },
      },

      // ==================== SCOPES ====================
      scopes: {
        active: {
          where: { isActive: true },
        },
        inactive: {
          where: { isActive: false },
        },
        default: {
          where: { isDefault: true },
        },
        system: {
          where: { isSystemTemplate: true },
        },
        userCreated: {
          where: { isSystemTemplate: false },
        },
        popular: {
          order: [['usage_count', 'DESC']],
          limit: 10,
        },
        recent: {
          order: [['created_at', 'DESC']],
          limit: 10,
        },
      },
    }
  );

  // ==================== CLASS METHODS ====================

  /**
   * Get the default template
   */
  EpisodeTemplate.getDefault = async function () {
    return await this.findOne({ where: { isDefault: true, isActive: true } });
  };

  /**
   * Get all active templates
   */
  EpisodeTemplate.getActive = async function (options = {}) {
    return await this.findAll({
      where: { isActive: true },
      order: [
        ['sort_order', 'ASC'],
        ['name', 'ASC'],
      ],
      ...options,
    });
  };

  /**
   * Get template by slug
   */
  EpisodeTemplate.getBySlug = async function (slug) {
    return await this.findOne({ where: { slug, isActive: true } });
  };

  /**
   * Get popular templates
   */
  EpisodeTemplate.getPopular = async function (limit = 5) {
    return await this.findAll({
      where: { isActive: true },
      order: [['usage_count', 'DESC']],
      limit,
    });
  };

  /**
   * Create system template (cannot be deleted)
   */
  EpisodeTemplate.createSystem = async function (data) {
    return await this.create({
      ...data,
      isSystemTemplate: true,
    });
  };

  // ==================== INSTANCE METHODS ====================

  /**
   * Increment usage count
   */
  EpisodeTemplate.prototype.incrementUsage = async function () {
    this.usageCount += 1;
    this.lastUsedAt = new Date();
    await this.save();
    return this;
  };

  /**
   * Toggle active status
   */
  EpisodeTemplate.prototype.toggleActive = async function () {
    this.isActive = !this.isActive;
    await this.save();
    return this;
  };

  /**
   * Set as default template
   */
  EpisodeTemplate.prototype.setAsDefault = async function () {
    // Remove default from all others
    await EpisodeTemplate.update({ isDefault: false }, { where: { isDefault: true } });

    // Set this as default
    this.isDefault = true;
    await this.save();
    return this;
  };

  /**
   * Create episode from this template
   */
  EpisodeTemplate.prototype.createEpisode = function (overrides = {}) {
    return {
      status: this.defaultStatus,
      categories: [...this.defaultCategories],
      duration: this.defaultDuration,
      ...this.config,
      ...overrides,
    };
  };

  /**
   * Get formatted template data
   */
  EpisodeTemplate.prototype.toJSON = function () {
    const values = Object.assign({}, this.get());

    return {
      id: values.id,
      name: values.name,
      slug: values.slug,
      description: values.description,
      icon: values.icon,
      color: values.color,
      defaultStatus: values.defaultStatus,
      defaultCategories: values.defaultCategories,
      defaultDuration: values.defaultDuration,
      config: values.config,
      isActive: values.isActive,
      isDefault: values.isDefault,
      isSystemTemplate: values.isSystemTemplate,
      usageCount: values.usageCount,
      sortOrder: values.sortOrder,
      lastUsedAt: values.lastUsedAt,
      createdAt: values.createdAt,
      updatedAt: values.updatedAt,
    };
  };

  return EpisodeTemplate;
};
