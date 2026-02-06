'use strict';
const { DataTypes } = require('sequelize');

/**
 * AIEditPlan Model
 * Stores AI-generated edit plans with confidence scores and approval workflow
 */
module.exports = (sequelize) => {
  const AIEditPlan = sequelize.define(
    'AIEditPlan',
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
      edit_structure: {
        type: DataTypes.JSONB,
        allowNull: false,
        field: 'edit_structure',
        comment: 'Complete timeline with clips, transitions, layers',
      },
      overall_confidence_score: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: false,
        defaultValue: 0.00,
        field: 'overall_confidence_score',
        comment: 'AI confidence 0.00-1.00',
      },
      status: {
        type: DataTypes.STRING(50),
        allowNull: false,
        defaultValue: 'draft',
        field: 'status',
        comment: 'draft | awaiting_approval | approved | rejected',
      },
      generated_by: {
        type: DataTypes.STRING(100),
        allowNull: false,
        defaultValue: 'claude-sonnet-4',
        field: 'generated_by',
      },
      generation_prompt: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'generation_prompt',
        comment: 'Prompt used to generate this plan',
      },
      user_feedback: {
        type: DataTypes.TEXT,
        allowNull: true,
        field: 'user_feedback',
        comment: 'User feedback if rejected',
      },
      approved_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'approved_at',
      },
      approved_by: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'approved_by',
      },
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
      deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'deleted_at',
      },
    },
    {
      sequelize,
      modelName: 'AIEditPlan',
      tableName: 'ai_edit_plans',
      underscored: true,
      timestamps: true,
      paranoid: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      deletedAt: 'deleted_at',
    }
  );

  return AIEditPlan;
};
