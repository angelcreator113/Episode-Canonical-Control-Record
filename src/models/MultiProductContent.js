// models/MultiProductContent.js
// Multi-product content — tracks content pieces that span multiple products/platforms

const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const MultiProductContent = sequelize.define('MultiProductContent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    source_content_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    source_type: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    target_products: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    adaptation_notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'adapting', 'review', 'published', 'archived'),
      defaultValue: 'draft',
    },
    published_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'multi_product_content',
    underscored: true,
    timestamps: true,
  });

  return MultiProductContent;
};
