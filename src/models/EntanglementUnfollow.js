'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class EntanglementUnfollow extends Model {
    static associate(models) {
      EntanglementUnfollow.belongsTo(models.RegistryCharacter, {
        foreignKey: 'character_id',
        as: 'character',
      });
      EntanglementUnfollow.belongsTo(models.SocialProfile, {
        foreignKey: 'profile_id',
        as: 'profile',
      });
    }
  }
  EntanglementUnfollow.init({
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    character_id: {
      type:      DataTypes.UUID,
      allowNull: false,
    },
    profile_id: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    reason: {
      type: DataTypes.ENUM(
        'disillusionment', 'protection', 'growth', 'conflict', 'drama'
      ),
      allowNull: true,
    },
    story_timestamp: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    noticed_by: {
      type:         DataTypes.JSONB,
      allowNull:    false,
      defaultValue: [],
    },
    visibility: {
      type:         DataTypes.ENUM('public', 'private', 'unnoticed'),
      allowNull:    false,
      defaultValue: 'unnoticed',
    },
    amber_proposed_reason: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    author_confirmed: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
    },
    notes: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
  }, {
    sequelize,
    modelName:   'EntanglementUnfollow',
    tableName:   'entanglement_unfollows',
    underscored: true,
    paranoid:    false,
  });
  return EntanglementUnfollow;
};
