/**
 * Direct test of thumbnail templates route logic
 */
const { ThumbnailTemplate, sequelize } = require('./src/models');
const { Op } = require('sequelize');

(async () => {
  try {
    const showId = '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b';
    
    console.log('🧪 Testing ThumbnailTemplate query logic...\n');
    
    const whereClause = {};
    if (showId) {
      whereClause[Op.or] = [
        { show_id: showId },
        { show_id: null }
      ];
    }

    console.log('📝 Where clause:', JSON.stringify(whereClause, null, 2));
    console.log('');
    
    // Enable SQL logging
    sequelize.options.logging = console.log;
    
    const templates = await ThumbnailTemplate.findAll({
      where: whereClause,
      order: [
        ['is_active', 'DESC'],
        ['created_at', 'DESC'],
      ],
    });

    console.log(`\n✅ Success! Found ${templates.length} templates`);
    console.log(JSON.stringify(templates, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
})();
