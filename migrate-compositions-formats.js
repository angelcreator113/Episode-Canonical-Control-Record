/**
 * Migration: Add selected_formats to existing compositions
 * Reads composition_config and adds selected_formats based on template
 */

require('dotenv').config();
const { sequelize, models } = require('./src/models');
const { ThumbnailComposition } = models;

const TEMPLATE_FORMATS = {
  'youtube-1920x1080': ['YOUTUBE_1920x1080'],
  'instagram-1080x1080': ['INSTAGRAM_1080x1080'],
  'tiktok-1080x1920': ['TIKTOK_1080x1920'],
  'facebook-1200x628': ['FACEBOOK_1200x628'],
};

async function migrateCompositions() {
  try {
    console.log('🔄 Starting migration: Add selected_formats to compositions...\n');

    // Get all compositions
    const compositions = await ThumbnailComposition.findAll({
      raw: false,
    });

    console.log(`📊 Found ${compositions.length} compositions to migrate\n`);

    for (const comp of compositions) {
      try {
        const config = comp.composition_config || {};
        
        // If selected_formats already exists, skip
        if (config.selected_formats && config.selected_formats.length > 0) {
          console.log(`✅ Composition ${comp.id} already has selected_formats, skipping`);
          continue;
        }

        // Determine formats based on template_id
        const template_id = comp.template_id || config.template_id;
        let formats = TEMPLATE_FORMATS[template_id] || [];
        
        // If no template match, default to both formats
        if (formats.length === 0) {
          console.log(`⚠️  Unknown template: ${template_id}, using defaults`);
          formats = ['YOUTUBE_1920x1080', 'INSTAGRAM_1080x1080'];
        }

        // Update the composition_config
        comp.composition_config = {
          ...config,
          selected_formats: formats,
        };

        // Save the composition
        await comp.save();

        console.log(`✅ Updated composition ${comp.id} with formats: ${formats.join(', ')}`);
      } catch (error) {
        console.error(`❌ Error updating composition ${comp.id}:`, error.message);
      }
    }

    console.log('\n✨ Migration complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrateCompositions();
