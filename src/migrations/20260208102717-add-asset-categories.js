'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if category column exists
    const table = await queryInterface.describeTable('assets');
    
    if (!table.category) {
      // Add category column to assets table
      await queryInterface.addColumn('assets', 'category', {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'Asset category: background, raw_footage, wardrobe, prop, graphic, text, audio, b_roll'
      });
    }

    // Create index for faster filtering (if not exists)
    try {
      await queryInterface.addIndex('assets', ['category'], {
        name: 'assets_category_idx'
      });
    } catch (error) {
      // Index might already exist
      console.log('Index may already exist, skipping');
    }

    // Simple categorization based on asset_type
    await queryInterface.sequelize.query(`
      UPDATE assets
      SET category = CASE
        WHEN asset_type LIKE 'image%' THEN 'background'
        WHEN asset_type LIKE 'video%' THEN 'raw_footage'
        WHEN asset_type LIKE 'audio%' THEN 'audio'
        WHEN media_type LIKE 'image%' THEN 'background'
        WHEN media_type LIKE 'video%' THEN 'raw_footage'
        WHEN media_type LIKE 'audio%' THEN 'audio'
        ELSE 'prop'
      END
      WHERE category IS NULL;
    `);
  },

  down: async (queryInterface, Sequelize) => {
    try {
      await queryInterface.removeIndex('assets', 'assets_category_idx');
    } catch (error) {
      // Index might not exist
    }
    await queryInterface.removeColumn('assets', 'category');
  }
};
