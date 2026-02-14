/**
 * Add JustAWomanInHerPrime support to database
 * Direct column addition (no migration runner needed)
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize({
  dialect: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'admin',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'episode_metadata_dev',
  logging: false,
  dialectOptions: {
    ssl: {
      require: false,
      rejectUnauthorized: false,
    },
  },
});

async function addJustawomanSupport() {
  try {
    console.log('🔄 Adding JustAWoman columns to thumbnail_compositions...');

    // Add columns to thumbnail_compositions
    await sequelize.query(`
      ALTER TABLE thumbnail_compositions
      ADD COLUMN IF NOT EXISTS justawomaninherprime_asset_id UUID REFERENCES assets(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS include_justawomaninherprime BOOLEAN DEFAULT false NOT NULL,
      ADD COLUMN IF NOT EXISTS justawomaninherprime_position JSONB;
    `);
    console.log('✅ Columns added to thumbnail_compositions');

    // Create index
    await sequelize.query(`
      CREATE INDEX IF NOT EXISTS idx_tc_justawomaninherprime_asset 
      ON thumbnail_compositions(justawomaninherprime_asset_id);
    `);
    console.log('✅ Index created');

    // Update template layouts to include justawomaninherprime position
    const templates = [
      {
        id: 'youtube-1920x1080',
        justawomanPosition: { width_percent: 20, left_percent: 75, top_percent: 5 }
      },
      {
        id: 'instagram-1080x1080',
        justawomanPosition: { width_percent: 25, left_percent: 70, top_percent: 5 }
      }
    ];

    for (const template of templates) {
      await sequelize.query(`
        UPDATE thumbnail_templates
        SET layout_config = layout_config || $1
        WHERE id = $2
      `, {
        bind: [
          { justawomaninherprime: template.justawomanPosition },
          template.id
        ]
      });
    }
    console.log('✅ Template layouts updated');

    console.log('\n✨ JustAWomanInHerPrime support successfully added!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

addJustawomanSupport();
