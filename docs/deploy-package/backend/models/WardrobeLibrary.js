'use strict';
const { DataTypes } = require('sequelize');

/**
 * WardrobeLibrary Model
 * Master library for all wardrobe items and outfit sets
 */
module.exports = (sequelize) => {
  const WardrobeLibrary = sequelize.define(
    'WardrobeLibrary',
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      // Basic Info
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'item or set',
        validate: {
          isIn: [['item', 'set']],
        },
      },
      // Item Classification (for type=item)
      itemType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'item_type',
        comment: 'top, bottom, dress, shoes, accessory, etc.',
      },
      // Storage
      imageUrl: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'image_url',
      },
      thumbnailUrl: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'thumbnail_url',
      },
      s3Key: {
        type: DataTypes.STRING(500),
        allowNull: true,
        field: 's3_key',
      },
      // Metadata (optional, can be overridden per episode)
      defaultCharacter: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'default_character',
      },
      defaultOccasion: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'default_occasion',
      },
      defaultSeason: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'default_season',
      },
      color: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      tags: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: [],
      },
      // External References
      website: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      vendor: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      // Show Association (optional - NULL means cross-show)
      showId: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'show_id',
        references: {
          model: 'shows',
          key: 'id',
        },
      },
      // Usage Tracking
      totalUsageCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'total_usage_count',
      },
      lastUsedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'last_used_at',
      },
      viewCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'view_count',
      },
      selectionCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
        field: 'selection_count',
      },
      // Audit
      createdBy: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'created_by',
      },
      updatedBy: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'updated_by',
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'created_at',
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'updated_at',
      },
      deletedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
    },
    {
      tableName: 'wardrobe_library',
      timestamps: true,
      underscored: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      indexes: [
        { fields: ['type'] },
        { fields: ['item_type'] },
        { fields: ['show_id'] },
        { fields: ['deleted_at'] },
        { fields: ['color'] },
      ],
    }
  );

  // Instance methods
  WardrobeLibrary.prototype.incrementUsage = async function () {
    this.totalUsageCount += 1;
    this.lastUsedAt = new Date();
    await this.save();
    return this;
  };

  WardrobeLibrary.prototype.trackView = async function () {
    this.viewCount += 1;
    await this.save();
    return this;
  };

  WardrobeLibrary.prototype.trackSelection = async function () {
    this.selectionCount += 1;
    await this.save();
    return this;
  };

  // Associations will be defined in models/index.js
  WardrobeLibrary.associate = function (models) {
    // Has many wardrobe items (items can reference library items)
    WardrobeLibrary.hasMany(models.Wardrobe, {
      foreignKey: 'library_item_id',
      as: 'wardrobeItems',
    });

    // Has many usage history records
    WardrobeLibrary.hasMany(models.WardrobeUsageHistory, {
      foreignKey: 'library_item_id',
      as: 'usageHistory',
    });

    // Has many S3 references
    WardrobeLibrary.hasMany(models.WardrobeLibraryReferences, {
      foreignKey: 'library_item_id',
      as: 's3References',
    });

    // Belongs to Show (optional)
    WardrobeLibrary.belongsTo(models.Show, {
      foreignKey: 'show_id',
      as: 'show',
    });

    // Self-referential: Outfit sets contain items
    // Outfit set has many items through outfit_set_items
    WardrobeLibrary.belongsToMany(models.WardrobeLibrary, {
      through: models.OutfitSetItems,
      foreignKey: 'outfit_set_id',
      otherKey: 'wardrobe_item_id',
      as: 'items',
    });

    // Item belongs to many outfit sets through outfit_set_items
    WardrobeLibrary.belongsToMany(models.WardrobeLibrary, {
      through: models.OutfitSetItems,
      foreignKey: 'wardrobe_item_id',
      otherKey: 'outfit_set_id',
      as: 'outfitSets',
    });
  };

  return WardrobeLibrary;
};
