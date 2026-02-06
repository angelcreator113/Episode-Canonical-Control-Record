const { DataTypes } = require('sequelize');

/**
 * EpisodeAsset Model
 * Join table for episode-level asset library (Library → Episode layer)
 * Represents assets available for use in a specific episode
 */
module.exports = (sequelize) => {
  const EpisodeAsset = sequelize.define(
    'EpisodeAsset',
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'episode_id',
        comment: 'Episode this asset is available in',
      },
      episodeId: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('episode_id');
        },
        set(value) {
          this.setDataValue('episode_id', value);
        },
      },
      asset_id: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'asset_id',
        comment: 'Show-level asset reference',
      },
      assetId: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('asset_id');
        },
        set(value) {
          this.setDataValue('asset_id', value);
        },
      },
      folder: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Organization folder (Promo, Overlays, Lower Thirds, etc.)',
      },
      sort_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        field: 'sort_order',
        comment: 'Display order within episode library',
      },
      sortOrder: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('sort_order');
        },
        set(value) {
          this.setDataValue('sort_order', value);
        },
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.STRING),
        allowNull: true,
        defaultValue: [],
        comment: 'Episode-specific tags for filtering',
      },
      added_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'added_at',
      },
      addedAt: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('added_at');
        },
        set(value) {
          this.setDataValue('added_at', value);
        },
      },
      added_by: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'added_by',
        comment: 'User who added this asset to episode',
      },
      addedBy: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('added_by');
        },
        set(value) {
          this.setDataValue('added_by', value);
        },
      },
    },
    {
      tableName: 'episode_assets',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['episode_id'] },
        { fields: ['asset_id'] },
        { fields: ['episode_id', 'folder'] },
        { fields: ['episode_id', 'asset_id'], unique: true, name: 'unique_episode_asset' },
      ],
    }
  );

  // Associations
  EpisodeAsset.associate = (models) => {
    EpisodeAsset.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode',
    });

    EpisodeAsset.belongsTo(models.Asset, {
      foreignKey: 'asset_id',
      as: 'asset',
    });
  };

  // Instance methods
  EpisodeAsset.prototype.toJSON = function () {
    const values = { ...this.get() };
    
    // Include associated asset data if loaded
    if (this.asset) {
      values.assetData = this.asset.toJSON();
    }
    
    return values;
  };

  return EpisodeAsset;
};
