'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class EntanglementEvent extends Model {
    static associate(models) {
      EntanglementEvent.belongsTo(models.SocialProfile, {
        foreignKey: 'profile_id',
        as: 'profile',
      });
    }
  }
  EntanglementEvent.init({
    id: {
      type:         DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey:   true,
    },
    profile_id: {
      type:      DataTypes.INTEGER,
      allowNull: false,
    },
    event_type: {
      type: DataTypes.ENUM(
        'post', 'collab', 'callout', 'rebrand', 'scandal',
        'silence', 'disappearance', 'state_change'
      ),
      allowNull: false,
    },
    previous_state: {
      type: DataTypes.ENUM(
        'rising', 'peaking', 'plateauing', 'controversial',
        'cancelled', 'reinventing', 'gone_dark', 'posthumous'
      ),
      allowNull: true,
    },
    new_state: {
      type: DataTypes.ENUM(
        'rising', 'peaking', 'plateauing', 'controversial',
        'cancelled', 'reinventing', 'gone_dark', 'posthumous'
      ),
      allowNull: true,
    },
    affected_character_ids: {
      type:         DataTypes.JSONB,
      allowNull:    false,
      defaultValue: [],
    },
    affected_dimensions: {
      type:         DataTypes.JSONB,
      allowNull:    false,
      defaultValue: [],
    },
    scene_proposals: {
      type:         DataTypes.JSONB,
      allowNull:    true,
      defaultValue: null,
    },
    description: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    resolved: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
    },
  }, {
    sequelize,
    modelName:   'EntanglementEvent',
    tableName:   'entanglement_events',
    underscored: true,
  });
  return EntanglementEvent;
};
