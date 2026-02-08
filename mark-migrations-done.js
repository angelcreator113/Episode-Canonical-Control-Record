const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

const migrations = [
  '20240101000001-create-episodes.js',
  '20240101000002-create-metadata-storage.js',
  '20240101000003-create-thumbnails.js',
  '20240101000004-create-processing-queue.js',
  '20240101000005-create-activity-logs.js',
  '20240101000006-create-scenes.js',
  '20240101000007-create-episode-scripts.js',
  '20240101000008-create-script-metadata.js',
  '20260106000001-add-categories-to-episodes.js',
  '20260108183816-update-assets-table.js',
  '20260108184514-update-assets-table.js',
  '20260108185054-update-assets-table.js',
  '20260108200000-create-episode-templates.js',
  '20260109132556-create-shows.js',
  '20260110000000-create-assets.js',
  '20260115000000-create-scene-library.js',
  '20260118000000-add-scene-thumbnail-assets.js',
  '20260120000000-create-episode-scenes.js',
  '20260124000000-add-clip-sequence-fields.js',
  '20260125000000-create-thumbnail-compositions.js',
  '20260127000001-add-thumbnail-compositions-deleted-at.js',
  '20260206-add-scene-footage-links.js',
  '20260206000001-add-timestamps-to-episodes.js',
  '20260206000002-add-current-ai-edit-plan-id.js',
  '20260206000003-make-show-name-nullable.js',
  '20260206000004-make-legacy-dates-nullable.js',
  '20260206000005-add-missing-scene-columns.js',
  '20260206000006-add-remaining-scene-columns.js',
  '20260206000007-add-thumbnail-url-metadata.js'
];

async function markMigrationsAsDone() {
  try {
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    for (const migration of migrations) {
      await sequelize.query(
        'INSERT INTO "SequelizeMeta" (name) VALUES (:name) ON CONFLICT DO NOTHING',
        { replacements: { name: migration } }
      );
    }

    console.log(`✅ Marked ${migrations.length} migrations as completed`);
    await sequelize.close();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

markMigrationsAsDone();
