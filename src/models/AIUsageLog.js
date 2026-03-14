'use strict';

module.exports = (sequelize, DataTypes) => {
  const AIUsageLog = sequelize.define('AIUsageLog', {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    route_name: {
      type: DataTypes.STRING(200),
      allowNull: true,
      comment: 'Express route or feature that triggered the call',
    },
    model_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Anthropic model used (e.g. claude-sonnet-4-20250514)',
    },
    input_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    output_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    cache_creation_input_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    cache_read_input_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    cost_usd: {
      type: DataTypes.DECIMAL(10, 6),
      defaultValue: 0,
      comment: 'Estimated cost in USD',
    },
    duration_ms: {
      type: DataTypes.INTEGER,
      allowNull: true,
      comment: 'Wall-clock time for the API call',
    },
    is_error: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    error_type: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: sequelize.literal('NOW()'),
    },
  }, {
    tableName: 'ai_usage_logs',
    timestamps: false,
    indexes: [
      { fields: ['created_at'] },
      { fields: ['model_name'] },
      { fields: ['route_name'] },
    ],
  });

  return AIUsageLog;
};
