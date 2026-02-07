'use strict';

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const DecisionPattern = sequelize.define('DecisionPattern', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    
    // Pattern identification
    pattern_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: 'Type of pattern detected',
    },
    pattern_category: {
      type: DataTypes.STRING(50),
      allowNull: false,
      comment: 'Category of pattern',
    },
    
    // Pattern data
    pattern_data: {
      type: DataTypes.JSONB,
      allowNull: false,
      comment: 'The learned pattern data',
    },
    
    // Statistics
    sample_count: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      comment: 'Number of decisions that contributed to this pattern',
    },
    confidence_score: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
      validate: {
        min: 0,
        max: 1,
      },
      comment: 'Confidence in this pattern (0.00 to 1.00)',
    },
    
    // Time tracking
    last_updated: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When this pattern was last updated',
    },
    first_detected: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
      comment: 'When this pattern was first detected',
    },
  }, {
    tableName: 'decision_patterns',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'last_updated',
    paranoid: false, // No soft deletes
    indexes: [
      { fields: ['pattern_type'] },
      { fields: ['pattern_category'] },
      { fields: ['confidence_score'] },
      { fields: ['sample_count'] },
    ],
  });

  // Class methods
  DecisionPattern.findByType = async function(patternType) {
    return await this.findAll({
      where: { pattern_type: patternType },
      order: [['confidence_score', 'DESC']],
    });
  };

  DecisionPattern.getConfidentPatterns = async function(minConfidence = 0.7) {
    return await this.findAll({
      where: {
        confidence_score: {
          [sequelize.Sequelize.Op.gte]: minConfidence,
        },
      },
      order: [['confidence_score', 'DESC']],
    });
  };

  // Instance methods
  DecisionPattern.prototype.isConfident = function() {
    return this.confidence_score >= 0.7 && this.sample_count >= 5;
  };

  DecisionPattern.prototype.needsMoreData = function() {
    return this.sample_count < 10;
  };

  return DecisionPattern;
};
