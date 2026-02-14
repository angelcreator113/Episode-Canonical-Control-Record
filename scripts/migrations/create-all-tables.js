/**
 * Create Core Tables for Episode Management
 * Creates all necessary tables for the application
 */

require('dotenv').config();
const { sequelize } = require('./src/models');

async function createAllTables() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    const tables = [
      // Thumbnails table
      {
        name: 'thumbnails',
        sql: `
          CREATE TABLE IF NOT EXISTS thumbnails (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            episode_id UUID NOT NULL,
            user_id UUID,
            file_name VARCHAR(255) NOT NULL,
            file_path VARCHAR(500),
            s3_key VARCHAR(500),
            s3_url VARCHAR(500),
            width_pixels INTEGER,
            height_pixels INTEGER,
            aspect_ratio VARCHAR(50),
            format VARCHAR(50),
            file_size_bytes INTEGER,
            thumbnail_type VARCHAR(100),
            is_primary BOOLEAN DEFAULT FALSE,
            publish_status VARCHAR(50) DEFAULT 'DRAFT',
            ai_generated BOOLEAN DEFAULT FALSE,
            ai_prompt TEXT,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_thumbnails_episode ON thumbnails(episode_id);
          CREATE INDEX IF NOT EXISTS idx_thumbnails_type ON thumbnails(thumbnail_type);
          CREATE INDEX IF NOT EXISTS idx_thumbnails_primary ON thumbnails(is_primary);
        `
      },
      // Thumbnail templates table
      {
        name: 'thumbnail_templates',
        sql: `
          CREATE TABLE IF NOT EXISTS thumbnail_templates (
            id VARCHAR(100) PRIMARY KEY,
            name VARCHAR(200) NOT NULL,
            template_type VARCHAR(50),
            width_pixels INTEGER,
            height_pixels INTEGER,
            aspect_ratio VARCHAR(20),
            layout_json JSONB,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          );
        `
      },
      // Thumbnail compositions table
      {
        name: 'thumbnail_compositions',
        sql: `
          CREATE TABLE IF NOT EXISTS thumbnail_compositions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            episode_id UUID NOT NULL,
            user_id UUID,
            template_id VARCHAR(100),
            name VARCHAR(255),
            description TEXT,
            template_id_ref UUID,
            template_name VARCHAR(100),
            composition_data JSONB,
            publish_status VARCHAR(50) DEFAULT 'DRAFT',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_compositions_episode ON thumbnail_compositions(episode_id);
          CREATE INDEX IF NOT EXISTS idx_compositions_template ON thumbnail_compositions(template_id);
        `
      },
      // Episode templates table
      {
        name: 'episode_templates',
        sql: `
          CREATE TABLE IF NOT EXISTS episode_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL UNIQUE,
            slug VARCHAR(255) UNIQUE,
            description TEXT,
            default_status VARCHAR(50) DEFAULT 'draft',
            default_categories JSONB DEFAULT '[]'::jsonb,
            default_duration INTEGER,
            default_rating DECIMAL,
            layout_json JSONB,
            usage_count INTEGER DEFAULT 0,
            is_active BOOLEAN DEFAULT TRUE,
            is_default BOOLEAN DEFAULT FALSE,
            created_by UUID,
            metadata JSONB,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            deleted_at TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_templates_active ON episode_templates(is_active);
          CREATE INDEX IF NOT EXISTS idx_templates_slug ON episode_templates(slug);
        `
      }
    ];

    for (const table of tables) {
      console.log(`📝 Creating ${table.name} table...`);
      await sequelize.query(table.sql);
      console.log(`✅ ${table.name} table created successfully`);
    }

    // Verify all tables were created
    const [result] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name;
    `);

    console.log('\n📋 Tables in database:');
    result.forEach(row => {
      console.log(`  ✓ ${row.table_name}`);
    });

    await sequelize.close();
    console.log('\n✅ All tables created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating tables:');
    console.error(error.message);
    process.exit(1);
  }
}

createAllTables();
