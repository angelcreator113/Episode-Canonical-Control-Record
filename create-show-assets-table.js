const { Client } = require('pg');
require('dotenv').config();

async function createShowAssetsTable() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    console.log('Creating show_assets table...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS show_assets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        show_id UUID NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
        asset_id UUID NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        usage_context TEXT,
        display_order INTEGER,
        is_primary BOOLEAN DEFAULT false,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP WITH TIME ZONE,
        CONSTRAINT unique_show_asset UNIQUE(show_id, asset_id)
      );
    `);

    console.log('✓ Created show_assets table');

    // Create indexes
    console.log('Creating indexes...');

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_show_assets_show_id ON show_assets(show_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_show_assets_asset_id ON show_assets(asset_id);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_show_assets_deleted_at ON show_assets(deleted_at);
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_show_assets_is_primary ON show_assets(show_id, is_primary) WHERE is_primary = true;
    `);

    console.log('✓ Created indexes');

    // Now link existing show assets
    console.log('\nLinking existing show-scoped assets...');

    // Get show IDs from episodes to link their assets
    await client.query(`
      INSERT INTO show_assets (show_id, asset_id, usage_context, is_primary)
      SELECT DISTINCT 
        e.show_id,
        ea.asset_id,
        'Migrated from episode assets',
        false
      FROM episode_assets ea
      JOIN episodes e ON e.id = ea.episode_id
      JOIN assets a ON a.id = ea.asset_id
      WHERE a.asset_group = 'SHOW'
      AND e.show_id IS NOT NULL
      ON CONFLICT (show_id, asset_id) DO NOTHING;
    `);

    const linkResult = await client.query(`
      SELECT COUNT(*) FROM show_assets;
    `);

    console.log(`✓ Linked ${linkResult.rows[0].count} show-scoped assets`);

    console.log('\n✅ show_assets table created successfully!');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

createShowAssetsTable();
