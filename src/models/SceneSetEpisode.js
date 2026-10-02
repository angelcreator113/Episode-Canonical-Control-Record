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
    // L3/L6 (Evoni, 2026-10-02; §8(hh)): the set's role in the episode: home,
    // closet, event (one each) or extra (any number, each with role_name).
    role: { type: DataTypes.STRING(20), allowNull: true },
    role_name: { type: DataTypes.STRING(80), allowNull: true },
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
