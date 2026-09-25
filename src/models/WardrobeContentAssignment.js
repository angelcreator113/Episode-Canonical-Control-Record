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
    // Not paranoid (Task #1869). The global define in src/config/sequelize.js
    // sets paranoid: true; the production table has no deleted_at column
    // (docs/audit/EvidenceNote_Canon_Schema_Capture_2026-09-17.txt:2486-2498),
    // so every model read and create failed on it. destroy() is now a real DELETE.
    // Its own removal marker is removed_at, which callers filter on directly.
    paranoid: false,
  });

  return WardrobeContentAssignment;
};
