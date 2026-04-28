'use strict';
const { Model, DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  class SceneSetEpisode extends Model {
    static associate(models) {
      SceneSetEpisode.belongsTo(models.SceneSet, {
        foreignKey: 'scene_set_id',
        as: 'sceneSet',
      });
      SceneSetEpisode.belongsTo(models.Episode, {
        foreignKey: 'episode_id',
        as: 'episode',
      });
    }
  }

  SceneSetEpisode.init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    scene_set_id: { type: DataTypes.UUID, allowNull: false },
    episode_id: { type: DataTypes.UUID, allowNull: false },
    sort_order: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  }, {
    sequelize,
    modelName: 'SceneSetEpisode',
    tableName: 'scene_set_episodes',
    underscored: true,
    paranoid: true,
    timestamps: true,
  });

  return SceneSetEpisode;
};
