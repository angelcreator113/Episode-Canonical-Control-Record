'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SceneAngle extends Model {
    static associate(models) {
      SceneAngle.belongsTo(models.SceneSet, {
        foreignKey: 'scene_set_id',
        as: 'sceneSet',
      });
    }

    get isReady() {
      return this.generation_status === 'complete' && !!this.still_image_url;
    }
  }

  SceneAngle.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    scene_set_id: { type: DataTypes.UUID, allowNull: false },
    angle_name: { type: DataTypes.STRING, allowNull: false },
    angle_label: {
      type: DataTypes.ENUM('WIDE', 'CLOSET', 'VANITY', 'WINDOW', 'DOORWAY', 'ESTABLISHING', 'ACTION', 'CLOSE', 'OVERHEAD', 'OTHER'),
      allowNull: false,
    },
    angle_description: { type: DataTypes.TEXT, allowNull: true },
    camera_direction: { type: DataTypes.TEXT, allowNull: true },
    beat_affinity: { type: DataTypes.JSONB, allowNull: true, defaultValue: [] },
    mood: { type: DataTypes.STRING, allowNull: true },
    runway_prompt: { type: DataTypes.TEXT, allowNull: true },
    runway_seed: { type: DataTypes.STRING, allowNull: true },
    runway_job_id: { type: DataTypes.STRING, allowNull: true },
    generation_status: {
      type: DataTypes.ENUM('pending', 'generating', 'complete', 'failed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    generation_cost: { type: DataTypes.DECIMAL(10, 4), allowNull: true, defaultValue: 0 },
    still_image_url: { type: DataTypes.TEXT, allowNull: true },
    video_clip_url: { type: DataTypes.TEXT, allowNull: true },
    thumbnail_url: { type: DataTypes.TEXT, allowNull: true },
    control_value: { type: DataTypes.INTEGER, allowNull: true },
    vulnerability_value: { type: DataTypes.INTEGER, allowNull: true },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    sequelize,
    modelName: 'SceneAngle',
    tableName: 'scene_angles',
    underscored: true,
    paranoid: true,
    timestamps: true,
  });

  return SceneAngle;
};
