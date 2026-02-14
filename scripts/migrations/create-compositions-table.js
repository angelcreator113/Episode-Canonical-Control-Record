/**
 * Create thumbnail_compositions table manually
 */
const { sequelize } = require('./src/models');

(async () => {
  try {
    console.log('🔄 Creating thumbnail_compositions table...');
    
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS thumbnail_compositions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        episode_id UUID,
        thumbnail_id UUID,
        template_id VARCHAR(100),
        background_frame_asset_id UUID,
        lala_asset_id UUID,
        justawomen_asset_id UUID,
        guest_asset_id UUID,
        composition_config JSONB,
        version INTEGER DEFAULT 1,
        is_primary BOOLEAN DEFAULT false,
        approval_status VARCHAR(50) DEFAULT 'DRAFT',
        published_at TIMESTAMP,
        created_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        approved_by VARCHAR(100),
        approved_at TIMESTAMP
      )
    `);
    
    console.log('✅ thumbnail_compositions table created successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
})();
