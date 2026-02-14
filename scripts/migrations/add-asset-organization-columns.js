const { Client } = require('pg');
require('dotenv').config();

async function addAssetOrganizationColumns() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('✓ Connected to database');

    // Add new columns to assets table
    console.log('Adding asset organization columns...');

    await client.query(`
      -- Asset Group (identity)
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS asset_group VARCHAR(50);
    `);
    console.log('✓ Added asset_group column');

    await client.query(`
      -- Purpose (category)
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS purpose VARCHAR(50);
    `);
    console.log('✓ Added purpose column');

    await client.query(`
      -- Allowed uses (array of use cases)
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS allowed_uses TEXT[];
    `);
    console.log('✓ Added allowed_uses column');

    await client.query(`
      -- Global availability flag
      ALTER TABLE assets 
      ADD COLUMN IF NOT EXISTS is_global BOOLEAN DEFAULT false;
    `);
    console.log('✓ Added is_global column');

    // Create indexes for performance
    console.log('Creating indexes...');
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assets_asset_group ON assets(asset_group);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assets_purpose ON assets(purpose);
    `);
    
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_assets_is_global ON assets(is_global);
    `);

    console.log('✓ Indexes created');

    // Now migrate existing data based on asset_type
    console.log('\nMigrating existing assets...');

    // LALA assets
    await client.query(`
      UPDATE assets 
      SET 
        asset_group = 'LALA',
        purpose = 'MAIN',
        allowed_uses = ARRAY['THUMBNAIL', 'SOCIAL', 'UI'],
        is_global = true
      WHERE asset_type LIKE '%LALA%' AND asset_group IS NULL;
    `);
    console.log('✓ Migrated LALA assets');

    // JUSTAWOMAN / SHOW assets
    await client.query(`
      UPDATE assets 
      SET 
        asset_group = 'SHOW',
        purpose = 'MAIN',
        allowed_uses = ARRAY['THUMBNAIL', 'SOCIAL', 'SCENE'],
        is_global = false
      WHERE (asset_type LIKE '%JUSTAWOMAN%' OR asset_type LIKE '%SHOW%') AND asset_group IS NULL;
    `);
    console.log('✓ Migrated SHOW assets');

    // GUEST assets
    await client.query(`
      UPDATE assets 
      SET 
        asset_group = 'GUEST',
        purpose = 'MAIN',
        allowed_uses = ARRAY['THUMBNAIL', 'SCENE'],
        is_global = false
      WHERE asset_type LIKE '%GUEST%' AND asset_group IS NULL;
    `);
    console.log('✓ Migrated GUEST assets');

    // BACKGROUND assets
    await client.query(`
      UPDATE assets 
      SET 
        asset_group = 'EPISODE',
        purpose = 'BACKGROUND',
        allowed_uses = ARRAY['SCENE', 'BACKGROUND_PLATE'],
        is_global = false
      WHERE asset_type LIKE '%BACKGROUND%' AND asset_group IS NULL;
    `);
    console.log('✓ Migrated BACKGROUND assets');

    // EPISODE FRAME assets
    await client.query(`
      UPDATE assets 
      SET 
        asset_group = 'EPISODE',
        purpose = 'MAIN',
        allowed_uses = ARRAY['THUMBNAIL', 'SOCIAL'],
        is_global = false
      WHERE asset_type LIKE '%EPISODE%' AND asset_group IS NULL;
    `);
    console.log('✓ Migrated EPISODE assets');

    // BRAND/LOGO assets
    await client.query(`
      UPDATE assets 
      SET 
        asset_group = 'LALA',
        purpose = 'ICON',
        allowed_uses = ARRAY['UI', 'SOCIAL', 'SCENE'],
        is_global = true
      WHERE asset_type LIKE '%BRAND%' OR asset_type LIKE '%LOGO%' AND asset_group IS NULL;
    `);
    console.log('✓ Migrated BRAND/LOGO assets');

    // VIDEO assets - need different defaults
    await client.query(`
      UPDATE assets 
      SET 
        asset_group = CASE 
          WHEN asset_type LIKE '%PROMO%' THEN 'LALA'
          WHEN asset_type LIKE '%EPISODE%' THEN 'EPISODE'
          ELSE 'EPISODE'
        END,
        purpose = 'MAIN',
        allowed_uses = ARRAY['SCENE', 'SOCIAL'],
        is_global = false
      WHERE asset_type LIKE '%VIDEO%' AND asset_group IS NULL;
    `);
    console.log('✓ Migrated VIDEO assets');

    // Any remaining unmapped assets
    await client.query(`
      UPDATE assets 
      SET 
        asset_group = 'EPISODE',
        purpose = 'MAIN',
        allowed_uses = ARRAY['SCENE', 'THUMBNAIL'],
        is_global = false
      WHERE asset_group IS NULL;
    `);
    console.log('✓ Migrated remaining assets');

    // Get counts
    const result = await client.query(`
      SELECT 
        asset_group,
        purpose,
        COUNT(*) as count
      FROM assets
      GROUP BY asset_group, purpose
      ORDER BY asset_group, purpose;
    `);

    console.log('\n✅ Migration complete! Asset distribution:');
    console.table(result.rows);

    const totalResult = await client.query('SELECT COUNT(*) FROM assets');
    console.log(`\nTotal assets: ${totalResult.rows[0].count}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

addAssetOrganizationColumns();
