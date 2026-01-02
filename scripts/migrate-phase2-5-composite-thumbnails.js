/**
 * Migration: Phase 2.5 - Composite Thumbnail System
 * Creates tables for assets, compositions, and templates
 * 
 * Status: Ready for execution
 * Timeline: Week 3 Phase 2.5
 * Reversible: Yes (rollback provided)
 */

require('dotenv').config();
const { sequelize } = require('../src/models');

async function migrate() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🚀 Starting Phase 2.5 migration: Composite Thumbnail System\n');

    // Step 1: Create assets table
    console.log('1️⃣  Creating assets table...');
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        asset_type VARCHAR(50) NOT NULL,
        -- Values: PROMO_LALA, PROMO_GUEST, BRAND_LOGO, EPISODE_FRAME
        
        s3_key_raw VARCHAR(500),
        s3_key_processed VARCHAR(500),
        
        has_transparency BOOLEAN DEFAULT false,
        width INTEGER,
        height INTEGER,
        file_size_bytes INTEGER,
        content_type VARCHAR(100),
        
        uploaded_by VARCHAR(100),
        approval_status VARCHAR(50) DEFAULT 'PENDING',
        -- Values: PENDING, APPROVED, REJECTED
        
        metadata JSONB,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      { transaction }
    );
    console.log('   ✅ assets table created\n');

    // Step 2: Create thumbnail_templates table
    console.log('2️⃣  Creating thumbnail_templates table...');
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS thumbnail_templates (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        platform VARCHAR(50),
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        aspect_ratio VARCHAR(20),
        
        layout_config JSONB,
        
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )`,
      { transaction }
    );
    console.log('   ✅ thumbnail_templates table created\n');

    // Step 3: Create thumbnail_compositions table
    console.log('3️⃣  Creating thumbnail_compositions table...');
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS thumbnail_compositions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID REFERENCES episodes(id),
        thumbnail_id UUID REFERENCES thumbnails(id),
        template_id VARCHAR(100) REFERENCES thumbnail_templates(id),
        
        -- Layer assets
        background_frame_asset_id UUID REFERENCES assets(id),
        lala_asset_id UUID REFERENCES assets(id),
        guest_asset_id UUID REFERENCES assets(id),
        
        -- Composition config
        composition_config JSONB,
        version INTEGER DEFAULT 1,
        
        -- Status & approval
        is_primary BOOLEAN DEFAULT false,
        approval_status VARCHAR(50) DEFAULT 'DRAFT',
        -- Values: DRAFT, PENDING, APPROVED, REJECTED
        published_at TIMESTAMP,
        
        -- Audit
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW(),
        approved_by VARCHAR(100),
        approved_at TIMESTAMP
      )`,
      { transaction }
    );
    console.log('   ✅ thumbnail_compositions table created\n');

    // Step 4: Update thumbnails table with type field
    console.log('4️⃣  Updating thumbnails table with type field...');
    await sequelize.query(
      `ALTER TABLE thumbnails 
       ADD COLUMN IF NOT EXISTS thumbnail_type VARCHAR(50) DEFAULT 'AUTO_GENERATED'`,
      { transaction }
    );
    console.log('   ✅ thumbnail_type column added\n');

    // Step 5: Create indexes for performance
    console.log('5️⃣  Creating indexes...');
    
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_assets_type 
       ON assets(asset_type)`,
      { transaction }
    );
    
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_assets_approval 
       ON assets(approval_status)`,
      { transaction }
    );
    
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_compositions_episode 
       ON thumbnail_compositions(episode_id)`,
      { transaction }
    );
    
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_compositions_template 
       ON thumbnail_compositions(template_id)`,
      { transaction }
    );
    
    await sequelize.query(
      `CREATE INDEX IF NOT EXISTS idx_thumbnails_type 
       ON thumbnails(thumbnail_type)`,
      { transaction }
    );
    
    console.log('   ✅ Indexes created\n');

    // Step 6: Seed thumbnail templates (2 formats for MVP)
    console.log('6️⃣  Seeding thumbnail templates...');
    
    const templates = [
      {
        id: 'youtube-hero',
        name: 'YouTube Hero',
        platform: 'YOUTUBE',
        width: 1920,
        height: 1080,
        aspect_ratio: '16:9',
        layout_config: JSON.stringify({
          background: { type: 'frame', blur: 5 },
          lala: {
            width_percent: 30,
            height_percent: 70,
            top_percent: 15,
            left_percent: 5
          },
          guest: {
            width_percent: 25,
            height_percent: 60,
            top_percent: 20,
            left_percent: 70
          },
          text: {
            top_percent: 85,
            left_percent: 5,
            font_size: 72,
            color: '#FFFFFF'
          }
        })
      },
      {
        id: 'instagram-feed',
        name: 'Instagram Feed',
        platform: 'INSTAGRAM',
        width: 1080,
        height: 1080,
        aspect_ratio: '1:1',
        layout_config: JSON.stringify({
          background: { type: 'frame', blur: 3 },
          lala: {
            width_percent: 35,
            height_percent: 60,
            top_percent: 20,
            left_percent: 10
          },
          guest: {
            width_percent: 30,
            height_percent: 55,
            top_percent: 25,
            left_percent: 60
          },
          text: {
            top_percent: 90,
            left_percent: 10,
            font_size: 48,
            color: '#FFFFFF'
          }
        })
      }
    ];

    for (const template of templates) {
      await sequelize.query(
        `INSERT INTO thumbnail_templates 
         (id, name, platform, width, height, aspect_ratio, layout_config) 
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO NOTHING`,
        {
          bind: [
            template.id,
            template.name,
            template.platform,
            template.width,
            template.height,
            template.aspect_ratio,
            template.layout_config
          ],
          transaction
        }
      );
    }
    console.log('   ✅ 2 templates seeded (YouTube Hero, Instagram Feed)\n');

    await transaction.commit();
    
    console.log('✨ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('   ✓ assets table created');
    console.log('   ✓ thumbnail_templates table created');
    console.log('   ✓ thumbnail_compositions table created');
    console.log('   ✓ thumbnails.thumbnail_type column added');
    console.log('   ✓ 5 performance indexes created');
    console.log('   ✓ 2 templates seeded\n');
    
    process.exit(0);
  } catch (error) {
    await transaction.rollback();
    console.error('❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    if (sequelize) await sequelize.close();
  }
}

migrate();
