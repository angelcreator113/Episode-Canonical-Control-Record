const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DecisionLog = sequelize.define('DecisionLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    episode_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'episodes',
        key: 'id'
      },
      onDelete: 'CASCADE'
    },
    scene_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'scenes',
        key: 'id'
      },
      onDelete: 'SET NULL'
    },
    user_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'Cognito user ID'
    },
    action_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'ASSET_POSITIONED, LAYER_CREATED, TIMING_SET, etc.'
    },
    entity_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: 'asset, layer, scene, episode'
    },
    entity_id: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'ID of the entity being acted upon'
    },
    action_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Details of what was done (position, timing, etc.)'
    },
    context_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Scene type, asset type, script context, etc.'
    },
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'decision_logs',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false,
    underscored: true,
    indexes: [
      {
        fields: ['episode_id']
      },
      {
        fields: ['timestamp']
      },
      {
        fields: ['action_type']
      }
    ]
  });

  DecisionLog.associate = (models) => {
    DecisionLog.belongsTo(models.Episode, {
      foreignKey: 'episode_id',
      as: 'episode'
    });

    DecisionLog.belongsTo(models.Scene, {
      foreignKey: 'scene_id',
      as: 'scene'
    });
  };

  return DecisionLog;
};
