'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class GenerationJob extends Model {
    static associate(models) {
      if (models.SceneSet) {
        GenerationJob.belongsTo(models.SceneSet, {
          foreignKey: 'scene_set_id',
          as: 'sceneSet',
        });
      }
      if (models.SceneAngle) {
        GenerationJob.belongsTo(models.SceneAngle, {
          foreignKey: 'scene_angle_id',
          as: 'sceneAngle',
        });
      }
    }
  }

  GenerationJob.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    job_type: {
      type: DataTypes.ENUM('generate_base', 'generate_angle', 'generate_angle_video', 'regenerate_angle', 'cascade_regenerate'),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('queued', 'processing', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'queued',
    },
    scene_set_id: { type: DataTypes.UUID, allowNull: false },
    scene_angle_id: { type: DataTypes.UUID, allowNull: true },
    payload: { type: DataTypes.JSONB, allowNull: true, defaultValue: {} },
    result: { type: DataTypes.JSONB, allowNull: true },
    error: { type: DataTypes.TEXT, allowNull: true },
    priority: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    max_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 3 },
    started_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
  }, {
    sequelize,
    modelName: 'GenerationJob',
    tableName: 'generation_jobs',
    underscored: true,
    paranoid: true,
    timestamps: true,
  });

  return GenerationJob;
};
