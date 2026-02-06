const { DataTypes } = require('sequelize');

/**
 * TimelinePlacement Model
 * Unified placement system for assets, wardrobe, and audio on timeline
 * Supports both scene-attached (default) and time-based placement
 */
module.exports = (sequelize) => {
  const TimelinePlacement = sequelize.define(
    'TimelinePlacement',
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
        comment: 'Episode this placement belongs to',
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
      
      // Placement type and references
      placement_type: {
        type: DataTypes.ENUM('asset', 'wardrobe', 'audio'),
        allowNull: false,
        field: 'placement_type',
        comment: 'Type of item being placed',
      },
      placementType: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('placement_type');
        },
        set(value) {
          this.setDataValue('placement_type', value);
        },
      },
      asset_id: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'asset_id',
        comment: 'Asset reference (for asset placements)',
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
      wardrobe_item_id: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'wardrobe_item_id',
        comment: 'Wardrobe reference (for wardrobe placements)',
      },
      wardrobeItemId: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('wardrobe_item_id');
        },
        set(value) {
          this.setDataValue('wardrobe_item_id', value);
        },
      },
      
      // Scene-attached placement (default)
      scene_id: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'scene_id',
        comment: 'Scene this placement is attached to (null for time-based)',
      },
      sceneId: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('scene_id');
        },
        set(value) {
          this.setDataValue('scene_id', value);
        },
      },
      attachment_point: {
        type: DataTypes.ENUM('scene-start', 'scene-end', 'scene-middle', 'custom'),
        allowNull: true,
        defaultValue: 'scene-start',
        field: 'attachment_point',
        comment: 'Where in the scene this attaches',
      },
      attachmentPoint: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('attachment_point');
        },
        set(value) {
          this.setDataValue('attachment_point', value);
        },
      },
      offset_seconds: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        defaultValue: 0,
        field: 'offset_seconds',
        comment: 'Offset from attachment point (seconds)',
      },
      offsetSeconds: {
        type: DataTypes.VIRTUAL,
        get() {
          return parseFloat(this.getDataValue('offset_seconds') || 0);
        },
        set(value) {
          this.setDataValue('offset_seconds', value);
        },
      },
      
      // Time-based placement (for audio/global overlays)
      absolute_timestamp: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        field: 'absolute_timestamp',
        comment: 'Absolute time in episode (for time-based placements)',
      },
      absoluteTimestamp: {
        type: DataTypes.VIRTUAL,
        get() {
          const val = this.getDataValue('absolute_timestamp');
          return val ? parseFloat(val) : null;
        },
        set(value) {
          this.setDataValue('absolute_timestamp', value);
        },
      },
      
      // Display properties
      track_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 2,
        field: 'track_number',
        comment: 'Timeline track (1=scenes, 2=assets, 3=audio)',
      },
      trackNumber: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('track_number');
        },
        set(value) {
          this.setDataValue('track_number', value);
        },
      },
      duration: {
        type: DataTypes.DECIMAL(10, 3),
        allowNull: true,
        comment: 'Display duration (seconds, null for wardrobe events)',
      },
      z_index: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 10,
        field: 'z_index',
        comment: 'Layering order within track',
      },
      zIndex: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('z_index');
        },
        set(value) {
          this.setDataValue('z_index', value);
        },
      },
      
      // Metadata
      properties: {
        type: DataTypes.JSONB,
        allowNull: true,
        defaultValue: {},
        comment: 'Custom properties (opacity, position, effects, etc.)',
      },
      character: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Character name (for wardrobe placements)',
      },
      label: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'User-friendly label for this placement',
      },
      visual_role: {
        type: DataTypes.ENUM('primary-visual', 'overlay'),
        allowNull: false,
        defaultValue: 'overlay',
        field: 'visual_role',
        comment: 'Visual hierarchy: primary-visual (replaces main video) or overlay (layers on top)',
      },
      visualRole: {
        type: DataTypes.VIRTUAL,
        get() {
          return this.getDataValue('visual_role');
        },
        set(value) {
          this.setDataValue('visual_role', value);
        },
      },
    },
    {
      tableName: 'timeline_placements',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['episode_id'] },
        { fields: ['scene_id'] },
        { fields: ['episode_id', 'placement_type'] },
        { fields: ['episode_id', 'track_number'] },
      ],
    }
  );

  // Associations
  TimelinePlacement.associate = (models) => {
    TimelinePlacement.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode',
    });

    TimelinePlacement.belongsTo(models.EpisodeScene, {
      foreignKey: 'scene_id',
      as: 'scene',
    });

    TimelinePlacement.belongsTo(models.Asset, {
      foreignKey: 'asset_id',
      as: 'asset',
    });

    TimelinePlacement.belongsTo(models.Wardrobe, {
      foreignKey: 'wardrobe_item_id',
      as: 'wardrobeItem',
    });
  };

  // Virtual fields for computed properties
  TimelinePlacement.prototype.isSceneAttached = function () {
    return this.scene_id !== null;
  };

  TimelinePlacement.prototype.isTimeBased = function () {
    return this.absolute_timestamp !== null;
  };

  // Instance method to calculate absolute time for scene-attached placements
  TimelinePlacement.prototype.calculateAbsoluteTime = async function () {
    if (!this.isSceneAttached()) {
      return this.absoluteTimestamp;
    }

    // Load scene with episode context to calculate cumulative time
    const scene = await this.getScene({
      include: [{
        model: sequelize.models.EpisodeScene,
        as: 'previousScenes',
        where: {
          episode_id: this.episode_id,
          scene_order: { [sequelize.Sequelize.Op.lt]: this.scene.scene_order }
        },
        required: false,
      }]
    });

    if (!scene) return 0;

    // Calculate cumulative duration of previous scenes
    const previousScenes = scene.previousScenes || [];
    const cumulativeDuration = previousScenes.reduce(
      (sum, s) => sum + (parseFloat(s.duration_seconds) || 0),
      0
    );

    // Add offset based on attachment point
    let offset = parseFloat(this.offset_seconds) || 0;
    
    if (this.attachment_point === 'scene-end') {
      offset += parseFloat(scene.duration_seconds) || 0;
    } else if (this.attachment_point === 'scene-middle') {
      offset += (parseFloat(scene.duration_seconds) || 0) / 2;
    }

    return cumulativeDuration + offset;
  };

  // toJSON customization
  TimelinePlacement.prototype.toJSON = function () {
    const values = { ...this.get() };
    
    // Include associated data if loaded
    if (this.asset) {
      values.assetData = this.asset.toJSON();
    }
    if (this.wardrobeItem) {
      values.wardrobeData = this.wardrobeItem.toJSON();
    }
    if (this.scene) {
      values.sceneData = {
        id: this.scene.id,
        title: this.scene.title,
        scene_order: this.scene.scene_order,
        scene_number: this.scene.scene_number,
      };
    }
    
    return values;
  };

  return TimelinePlacement;
};
