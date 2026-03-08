'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VoiceRule extends Model {
    static associate(models) {
      VoiceRule.hasMany(models.VoiceSignal, { foreignKey: 'proposed_rule_id', as: 'signals' });
    }
  }
  VoiceRule.init({
    id:               { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    series_id:        { type: DataTypes.INTEGER, allowNull: true },
    character_name:   { type: DataTypes.STRING(100), allowNull: true },
    rule_text:        { type: DataTypes.TEXT, allowNull: false },
    rule_type: {
      type: DataTypes.ENUM(
        'opening_phrase', 'closing_phrase', 'address_pattern',
        'scene_opening', 'scene_closing', 'dialogue_pattern',
        'interior_monologue', 'tonal_constraint', 'structural_pattern'
      ),
      defaultValue: 'dialogue_pattern',
    },
    example_original:    { type: DataTypes.TEXT, allowNull: true },
    example_edited:      { type: DataTypes.TEXT, allowNull: true },
    signal_count:        { type: DataTypes.INTEGER, defaultValue: 1 },
    confirmed_by_author: { type: DataTypes.BOOLEAN, defaultValue: false },
    confirmed_at:        { type: DataTypes.DATE, allowNull: true },
    injection_count:     { type: DataTypes.INTEGER, defaultValue: 0 },
    last_injected_at:    { type: DataTypes.DATE, allowNull: true },
    status: {
      type: DataTypes.ENUM('proposed', 'active', 'paused', 'superseded'),
      defaultValue: 'proposed',
    },
  }, { sequelize, modelName: 'VoiceRule', tableName: 'voice_rules', underscored: true });
  return VoiceRule;
};
