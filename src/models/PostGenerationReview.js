// models/PostGenerationReview.js
// Post-generation review queue — tracks AI-generated content awaiting human review

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const PostGenerationReview = sequelize.define('PostGenerationReview', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    content_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    content_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    generated_content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    review_status: {
      type: DataTypes.ENUM('pending', 'approved', 'rejected', 'revised'),
      defaultValue: 'pending',
    },
    reviewer_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    revision_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    reviewed_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'post_generation_reviews',
    underscored: true,
    timestamps: true,
  });

  return PostGenerationReview;
};
