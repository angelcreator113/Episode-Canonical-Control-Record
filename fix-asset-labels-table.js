const { sequelize } = require('./src/models');

/**
 * Create missing asset_label_mappings table
 */
async function createMissingTable() {
  console.log('🔧 Creating asset_label_mappings table...\n');

  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Create the junction table
    await sequelize.query(`
      CREATE TABLE IF NOT EXISTS asset_label_mappings (
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        label_id UUID NOT NULL REFERENCES asset_labels(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        PRIMARY KEY (asset_id, label_id)
      );
      
      CREATE INDEX IF NOT EXISTS idx_asset_label_mappings_asset ON asset_label_mappings(asset_id);
      CREATE INDEX IF NOT EXISTS idx_asset_label_mappings_label ON asset_label_mappings(label_id);
    `);

    console.log('✅ Table created successfully!\n');
    
    // Verify
    const [result] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name = 'asset_label_mappings';
    `);
    
    if (result.length > 0) {
      console.log('✅ Verified: asset_label_mappings table exists');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

createMissingTable()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
