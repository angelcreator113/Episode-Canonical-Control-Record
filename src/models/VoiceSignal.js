'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
  class VoiceSignal extends Model {
    static associate(models) {
      VoiceSignal.belongsTo(models.VoiceRule, { foreignKey: 'proposed_rule_id', as: 'proposedRule' });
    }
  }
  VoiceSignal.init({
    id:                 { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    series_id:          { type: DataTypes.INTEGER, allowNull: true },
    book_id:            { type: DataTypes.INTEGER, allowNull: true },
    chapter_id:         { type: DataTypes.INTEGER, allowNull: true },
    line_id:            { type: DataTypes.INTEGER, allowNull: true },
    original_text:      { type: DataTypes.TEXT, allowNull: false },
    edited_text:        { type: DataTypes.TEXT, allowNull: false },
    diff_summary:       { type: DataTypes.TEXT, allowNull: true },
    scene_context:      { type: DataTypes.STRING(100), allowNull: true },
    pattern_tag:        { type: DataTypes.STRING(100), allowNull: true },
    pattern_confidence: { type: DataTypes.FLOAT, defaultValue: 0 },
    proposed_rule_id:   { type: DataTypes.INTEGER, allowNull: true },
    status: {
      type: DataTypes.ENUM('raw', 'analyzed', 'grouped', 'promoted', 'dismissed'),
      defaultValue: 'raw',
    },
  }, { sequelize, modelName: 'VoiceSignal', tableName: 'voice_signals', underscored: true });
  return VoiceSignal;
};
