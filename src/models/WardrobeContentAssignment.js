'use strict';
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const WardrobeContentAssignment = sequelize.define('WardrobeContentAssignment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    library_item_id:    { type: DataTypes.INTEGER, allowNull: false },
    content_type:       { type: DataTypes.STRING,  allowNull: false },
    content_id:         { type: DataTypes.UUID,    allowNull: false },
    scene_context:      DataTypes.TEXT,
    character_id:       DataTypes.UUID,
    character_name:     DataTypes.STRING,
    narrative_function: DataTypes.STRING,
    press_triggered:    { type: DataTypes.BOOLEAN, defaultValue: false },
    press_tag_id:       DataTypes.UUID,
    removed_at:         DataTypes.DATE,
  }, {
    tableName:  'wardrobe_content_assignments',
    timestamps: true,
    underscored: true,
  });

  return WardrobeContentAssignment;
};
