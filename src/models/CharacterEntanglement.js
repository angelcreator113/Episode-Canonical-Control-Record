'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class CharacterEntanglement extends Model {
    static associate(models) {
      CharacterEntanglement.belongsTo(models.RegistryCharacter, {
        foreignKey: 'character_id',
        as: 'character',
      });
      CharacterEntanglement.belongsTo(models.SocialProfile, {
        foreignKey: 'profile_id',
        as: 'profile',
      });
    }
  }
  CharacterEntanglement.init({
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
    dimension: {
      type: DataTypes.ENUM(
        'ambition_identity', 'the_body', 'class_money',
        'religion_meaning', 'race_culture', 'sexuality_desire',
        'family_architecture', 'friendship_loyalty', 'habits_rituals',
        'speech_silence', 'grief_loss', 'politics_justice', 'the_unseen',
        'life_stage'
      ),
      allowNull: false,
    },
    intensity: {
      type:         DataTypes.ENUM('peripheral', 'moderate', 'significant', 'identity_anchor'),
      allowNull:    false,
      defaultValue: 'peripheral',
    },
    directionality: {
      type:         DataTypes.ENUM('character_knows', 'mutual', 'neither'),
      allowNull:    false,
      defaultValue: 'character_knows',
    },
    entanglement_type: {
      type:      DataTypes.ENUM('knows_in_real_life', 'writes_about', 'identity_anchor'),
      allowNull: false,
    },
    is_active: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: true,
    },
    turbulence_flag: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
    },
    turbulence_reason: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },
    amber_proposed: {
      type:         DataTypes.BOOLEAN,
      allowNull:    false,
      defaultValue: false,
    },
    notes: {
      type:      DataTypes.TEXT,
      allowNull: true,
    },

    /* ── Want Field (Component 3) ── */
    what_they_want: { type: DataTypes.TEXT, allowNull: true },
    want_category: {
      type: DataTypes.ENUM('to_become','to_have','to_destroy','to_be_seen_by','to_escape','to_protect','to_understand'),
      allowNull: true,
    },
  }, {
    sequelize,
    modelName:  'CharacterEntanglement',
    tableName:  'character_entanglements',
    underscored: true,
    paranoid:    false,
  });
  return CharacterEntanglement;
};
