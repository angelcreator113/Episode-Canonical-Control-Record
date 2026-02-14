const { DataTypes } = require('sequelize');

/**
 * Marker Model
 * Timeline markers for episodes (Phase 2)
 * Episode-scoped with optional scene references
 */
module.exports = (sequelize) => {
  const Marker = sequelize.define(
    'Marker',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
        field: 'episode_id',
        references: {
          model: 'episodes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        comment: 'Episode this marker belongs to',
      },
      scene_id: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'scene_id',
        references: {
          model: 'scenes',
          key: 'id',
        },
        onDelete: 'SET NULL',
        comment: 'Optional scene reference',
      },
      timecode: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        validate: {
          min: 0,
        },
        comment: 'Absolute time in seconds from episode start',
      },
      title: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'Marker title or label',
      },
      marker_type: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'note',
        field: 'marker_type',
        validate: {
          isIn: [['note', 'chapter', 'cue', 'script', 'deliverable', 'custom']],
        },
        comment: 'Type of marker',
      },
      category: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'User-defined category for grouping',
      },
      tags: {
        type: DataTypes.ARRAY(DataTypes.TEXT),
        allowNull: true,
        defaultValue: [],
        comment: 'Array of tags',
      },
      color: {
        type: DataTypes.STRING(7),
        allowNull: false,
        defaultValue: '#3B82F6',
        validate: {
          is: /^#[0-9A-Fa-f]{6}$/,
        },
        comment: 'Hex color code for display',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Extended description or notes',
      },
      scene_relative_timecode: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        field: 'scene_relative_timecode',
        comment: 'Position within referenced scene (auto-calculated)',
      },
      deliverable_id: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'deliverable_id',
        comment: 'External deliverable tracking ID',
      },
      fulfillment_checkpoint: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'fulfillment_checkpoint',
        comment: 'Marks fulfillment milestones',
      },
      created_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'created_by',
      },
      updated_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'updated_by',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
    },
    {
      tableName: 'markers',
      timestamps: true,
      paranoid: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
      indexes: [
        {
          fields: ['episode_id'],
          name: 'idx_markers_episode',
        },
        {
          fields: ['scene_id'],
          name: 'idx_markers_scene',
        },
        {
          fields: ['episode_id', 'timecode'],
          name: 'idx_markers_timecode',
        },
        {
          fields: ['marker_type'],
          name: 'idx_markers_type',
        },
        {
          fields: ['category'],
          name: 'idx_markers_category',
        },
      ],
      hooks: {
        beforeUpdate: (marker) => {
          marker.updated_at = new Date();
        },
      },
    }
  );

  /**
   * Model Associations
   */
  Marker.associate = (models) => {
    // Marker belongs to Episode
    Marker.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode',
      onDelete: 'CASCADE',
    });

    // Marker optionally belongs to Scene
    Marker.belongsTo(models.Scene, {
      foreignKey: 'scene_id',
      as: 'scene',
      onDelete: 'SET NULL',
    });
  };

  /**
   * Instance Methods
   */

  /**
   * Calculate scene-relative timecode if scene is referenced
   */
  Marker.prototype.calculateSceneRelativeTime = async function () {
    if (!this.scene_id) {
      this.scene_relative_timecode = null;
      return null;
    }

    const Scene = sequelize.models.Scene;
    const scene = await Scene.findByPk(this.scene_id);

    if (!scene) {
      this.scene_relative_timecode = null;
      return null;
    }

    // Get all scenes for this episode to calculate cumulative start time
    const scenes = await Scene.findAll({
      where: { episode_id: this.episode_id },
      order: [['scene_number', 'ASC']],
    });

    let cumulativeTime = 0;
    let sceneStartTime = 0;

    for (const s of scenes) {
      if (s.id === this.scene_id) {
        sceneStartTime = cumulativeTime;
        break;
      }
      cumulativeTime += parseFloat(s.duration_seconds || 0);
    }

    const relativeTime = parseFloat(this.timecode) - sceneStartTime;
    this.scene_relative_timecode = relativeTime >= 0 ? relativeTime : null;

    return this.scene_relative_timecode;
  };

  /**
   * Find which scene contains this marker's timecode
   */
  Marker.prototype.findContainingScene = async function () {
    const Scene = sequelize.models.Scene;
    const scenes = await Scene.findAll({
      where: { episode_id: this.episode_id },
      order: [['scene_number', 'ASC']],
    });

    let cumulativeTime = 0;
    const markerTime = parseFloat(this.timecode);

    for (const scene of scenes) {
      const sceneDuration = parseFloat(scene.duration_seconds || 0);
      const sceneEndTime = cumulativeTime + sceneDuration;

      if (markerTime >= cumulativeTime && markerTime < sceneEndTime) {
        return {
          scene,
          sceneStartTime: cumulativeTime,
          sceneEndTime,
          relativeTime: markerTime - cumulativeTime,
        };
      }

      cumulativeTime = sceneEndTime;
    }

    return null; // Marker is outside all scene boundaries
  };

  /**
   * Class Methods
   */

  /**
   * Get all markers for an episode within a time range
   */
  Marker.getByTimeRange = async function (episodeId, startTime, endTime) {
    return await this.findAll({
      where: {
        episode_id: episodeId,
        timecode: {
          [sequelize.Sequelize.Op.between]: [startTime, endTime],
        },
      },
      order: [['timecode', 'ASC']],
    });
  };

  /**
   * Get markers by type
   */
  Marker.getByType = async function (episodeId, markerType) {
    return await this.findAll({
      where: {
        episode_id: episodeId,
        marker_type: markerType,
      },
      order: [['timecode', 'ASC']],
    });
  };

  return Marker;
};
