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
      usage_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'general',
        field: 'usage_type',
        comment: 'Usage type (general, thumbnail, overlay, etc.)',
      },
      usageType: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('usage_type');
        },
        set(value) {
          this.setDataValue('usage_type', value);
        },
      },
      scene_number: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'scene_number',
        comment: 'Scene number this asset is used in',
      },
      sceneNumber: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('scene_number');
        },
        set(value) {
          this.setDataValue('scene_number', value);
        },
      },
      display_order: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0,
        field: 'display_order',
        comment: 'Display order within episode library',
      },
      displayOrder: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('display_order');
        },
        set(value) {
          this.setDataValue('display_order', value);
        },
      },
      metadata: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Additional metadata for this episode-asset link',
      },
    },
    {
      tableName: 'episode_assets',
      underscored: true,
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      indexes: [
        { fields: ['episode_id'] },
        { fields: ['asset_id'] },
        { fields: ['usage_type'] },
        {
          fields: ['episode_id', 'asset_id', 'usage_type'],
          unique: true,
          name: 'episode_assets_episode_id_asset_id_usage_type_key',
        },
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
