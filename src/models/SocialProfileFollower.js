'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class SocialProfileFollower extends Model {
    static associate(models) {
      if (models.SocialProfile) {
        SocialProfileFollower.belongsTo(models.SocialProfile, {
          foreignKey: 'social_profile_id',
          as: 'socialProfile',
        });
      }
    }
  }

  SocialProfileFollower.init({
    id:                  { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    social_profile_id:   { type: DataTypes.INTEGER, allowNull: false },
    character_key:       { type: DataTypes.STRING(100), allowNull: false },
    character_name:      { type: DataTypes.STRING(200), allowNull: false },
    follow_context:      { type: DataTypes.TEXT, allowNull: true },
    emotional_reaction:  { type: DataTypes.TEXT, allowNull: true },
    influence_type:      { type: DataTypes.STRING(50), allowNull: true },
    influence_level:     { type: DataTypes.INTEGER, allowNull: true, defaultValue: 5 },
    discovered_in:       { type: DataTypes.STRING(200), allowNull: true },
  }, {
    sequelize,
    modelName:  'SocialProfileFollower',
    tableName:  'social_profile_followers',
    underscored: true,
  });

  return SocialProfileFollower;
};
