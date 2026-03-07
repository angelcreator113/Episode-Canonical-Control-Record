// models/WritingRhythm.js
// Writing rhythm tracking — captures pacing, cadence, and flow patterns per author/show

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WritingRhythm = sequelize.define('WritingRhythm', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    show_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    rhythm_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    pattern_data: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    avg_sentence_length: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    pacing_score: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    sample_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('learning', 'active', 'archived'),
      defaultValue: 'learning',
    },
  }, {
    tableName: 'writing_rhythms',
    underscored: true,
    timestamps: true,
  });

  return WritingRhythm;
};
