'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const UserDecision = sequelize.define('UserDecision', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    
    // Foreign Keys
    episode_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'episodes',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    scene_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'scenes',
        key: 'id',
      },
      onDelete: 'SET NULL',
    },
    
    // Decision Details
    decision_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Type of decision: scene_duration, transition_type, music_choice, etc.',
    },
    decision_category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Category: timing, style, content, asset_selection',
    },
    
    // What was chosen
    chosen_option: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'The option that was selected',
    },
    
    // What was rejected
    rejected_options: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Options that were not selected',
    },
    
    // AI involvement
    was_ai_suggestion: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      comment: 'Was this based on an AI suggestion?',
    },
    ai_confidence_score: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true,
      validate: {
        min: 0,
        max: 1,
      },
      comment: 'AI confidence in the suggestion (0.00 to 1.00)',
    },
    
    // User feedback
    user_rating: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5,
      },
      comment: 'User rating of this decision (1-5 stars)',
    },
    user_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      comment: 'User notes about this decision',
    },
    
    // Additional context
    context_data: {
      type: DataTypes.JSONB,
      allowNull: true,
      comment: 'Additional metadata about the decision context',
    },
    
    // Timestamp
    timestamp: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When the decision was made',
    },
    
    // Tracking
    created_by: {
      type: DataTypes.STRING(255),
      allowNull: true,
      comment: 'User who made the decision',
    },
  }, {
    tableName: 'user_decisions',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false, // No updated_at for decisions (immutable)
    paranoid: false, // No soft deletes
    indexes: [
      { fields: ['episode_id'] },
      { fields: ['scene_id'] },
      { fields: ['decision_type'] },
      { fields: ['decision_category'] },
      { fields: ['timestamp'] },
      { fields: ['was_ai_suggestion'] },
      { fields: ['chosen_option'], using: 'gin' },
      { fields: ['context_data'], using: 'gin' },
    ],
  });

  // Class methods
  UserDecision.getDecisionTypes = function() {
    return [
      'scene_duration',
      'transition_type',
      'music_choice',
      'asset_selection',
      'color_grading',
      'text_style',
      'pacing_adjustment',
      'clip_trim',
      'scene_order',
      'background_choice',
      'effect_application',
    ];
  };

  UserDecision.getDecisionCategories = function() {
    return [
      'timing',
      'style',
      'content',
      'asset_selection',
      'technical',
    ];
  };

  // Instance methods
  UserDecision.prototype.toSafeJSON = function() {
    return {
      id: this.id,
      episode_id: this.episode_id,
      scene_id: this.scene_id,
      decision_type: this.decision_type,
      decision_category: this.decision_category,
      chosen_option: this.chosen_option,
      was_ai_suggestion: this.was_ai_suggestion,
      ai_confidence_score: this.ai_confidence_score,
      user_rating: this.user_rating,
      timestamp: this.timestamp,
      created_at: this.created_at,
    };
  };

  return UserDecision;
};
