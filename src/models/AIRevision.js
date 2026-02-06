'use strict';
const { DataTypes } = require('sequelize');

/**
 * AIRevision Model
 * Tracks AI revision attempts when user rejects edit plan
 */
module.exports = (sequelize) => {
  const AIRevision = sequelize.define(
    'AIRevision',
    {
      id: {
        type: DataTypes.UUID,
        primaryKey: true,
        defaultValue: DataTypes.UUIDV4,
        allowNull: false,
      },
      original_plan_id: {
        type: DataTypes.UUID,
        allowNull: false,
        references: {
          model: 'ai_edit_plans',
          key: 'id',
        },
        onDelete: 'CASCADE',
        field: 'original_plan_id',
      },
      revision_number: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'revision_number',
        comment: 'Incremental revision number (1, 2, 3)',
      },
      feedback_type: {
        type: DataTypes.STRING(100),
        allowNull: false,
        field: 'feedback_type',
        comment: 'pacing_too_slow | transitions_jarring | wrong_clips | etc.',
      },
      user_feedback_text: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'user_feedback_text',
      },
      revised_plan: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: 'revised_plan',
        comment: 'New edit structure based on feedback',
      },
      confidence_score_before: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        field: 'confidence_score_before',
      },
      confidence_score_after: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        field: 'confidence_score_after',
      },
      changes_summary: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'changes_summary',
        comment: 'AI explanation of what changed',
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
      modelName: 'AIRevision',
      tableName: 'ai_revisions',
      underscored: true,
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: false,
    }
  );

  return AIRevision;
};
