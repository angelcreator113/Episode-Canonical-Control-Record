'use strict';
const { DataTypes } = require('sequelize');

/**
 * EditingDecision Model
 * Captures every user editing action for AI learning
 */
module.exports = (sequelize) => {
  const EditingDecision = sequelize.define(
    'EditingDecision',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      episode_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'episodes',
          key: 'id',
        },
        onDelete: 'CASCADE',
        field: 'episode_id',
      },
      scene_id: {
        type: DataTypes.UUID,
        allowNull: true,
        references: {
          model: 'scenes',
          key: 'id',
        },
        onDelete: 'SET NULL',
        field: 'scene_id',
      },
      action_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'action_type',
        comment: 'TRIM_CLIP | REORDER_CLIPS | SELECT_TAKE | CHANGE_TRANSITION | etc.',
      },
      before_state: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: 'before_state',
        comment: 'State before user action',
      },
      after_state: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: 'after_state',
        comment: 'State after user action',
      },
      context: {
        type: DataTypes.JSONB,
        allowNull: true,
        field: 'context',
        comment: 'Scene type, energy level, timing context',
      },
      ai_suggested: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'ai_suggested',
        comment: 'Was this action originally suggested by AI?',
      },
      user_id: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'user_id',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
    },
    {
      sequelize,
      modelName: 'EditingDecision',
      tableName: 'editing_decisions',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return EditingDecision;
};
