'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    // LalaVerse brand registry
    await queryInterface.createTable('lalaverse_brands', {
      id:                 { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      slug:               { type: Sequelize.STRING, allowNull: false, unique: true },
      name:               { type: Sequelize.STRING, allowNull: false },
      type:               { type: Sequelize.STRING, defaultValue: 'lalaverse' },
      category:           { type: Sequelize.STRING },
      description:        { type: Sequelize.TEXT },
      aesthetic:          { type: Sequelize.TEXT },
      niche:              { type: Sequelize.TEXT },
      founder:            { type: Sequelize.TEXT },
      press_angle:        { type: Sequelize.TEXT },
      contact_name:       { type: Sequelize.STRING },
      contact_email:      { type: Sequelize.STRING },
      partnership_status: { type: Sequelize.STRING },
      website:            { type: Sequelize.STRING },
      created_at:         { type: Sequelize.DATE, allowNull: false },
      updated_at:         { type: Sequelize.DATE, allowNull: false },
    });

    // Wardrobe piece -> brand + event/scene tags
    await queryInterface.createTable('wardrobe_brand_tags', {
      id:                  { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      wardrobe_item_id:    { type: Sequelize.UUID, allowNull: false },
      wardrobe_item_name:  { type: Sequelize.STRING },
      brand_id:            { type: Sequelize.UUID, allowNull: false },
      show_id:             { type: Sequelize.UUID },
      chapter_id:          { type: Sequelize.UUID },
      event_name:          { type: Sequelize.STRING },
      scene_summary:       { type: Sequelize.TEXT },
      coverage_status:     { type: Sequelize.STRING, defaultValue: 'uncovered' },
      coverage_content:    { type: Sequelize.TEXT },
      coverage_author:     { type: Sequelize.STRING },
      coverage_url:        { type: Sequelize.STRING },
      coverage_generated:  { type: Sequelize.DATE },
      coverage_published:  { type: Sequelize.DATE },
      created_at:          { type: Sequelize.DATE, allowNull: false },
      updated_at:          { type: Sequelize.DATE, allowNull: false },
    });

    // Therapy pending sessions -- characters waiting to be seen
    await queryInterface.createTable('therapy_pending_sessions', {
      id:                  { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      character_id:        { type: Sequelize.UUID, allowNull: false },
      character_name:      { type: Sequelize.STRING },
      character_slug:      { type: Sequelize.STRING },
      character_type:      { type: Sequelize.STRING },
      knock_message:       { type: Sequelize.TEXT },
      wound:               { type: Sequelize.TEXT },
      emotional_state:     { type: Sequelize.JSONB },
      trigger_dimension:   { type: Sequelize.STRING },
      trigger_value:       { type: Sequelize.INTEGER },
      status:              { type: Sequelize.STRING, defaultValue: 'waiting' },
      created_at:          { type: Sequelize.DATE, allowNull: false },
      updated_at:          { type: Sequelize.DATE, allowNull: false },
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('lalaverse_brands');
    await queryInterface.dropTable('wardrobe_brand_tags');
    await queryInterface.dropTable('therapy_pending_sessions');
  },
};
