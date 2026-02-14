/**
 * Verify file_hash migration was successful
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'episode_metadata',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: false,
  }
);

async function verify() {
  try {
    await sequelize.authenticate();
    console.log('🔌 Connected to database');

    // Check if file_hash column exists
    const [columns] = await sequelize.query(`
      SELECT column_name, data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_name = 'assets' AND column_name = 'file_hash';
    `);

    if (columns.length === 0) {
      console.log('❌ file_hash column NOT found');
      process.exit(1);
    }

    console.log('✅ file_hash column exists:', columns[0]);

    // Check indexes
    const [indexes] = await sequelize.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'assets' AND indexname LIKE '%file_hash%';
    `);

    console.log(`✅ Found ${indexes.length} file_hash indexes:`);
    indexes.forEach((idx) => {
      console.log(`   - ${idx.indexname}`);
    });

    // Check asset count
    const [assetCount] = await sequelize.query(`
      SELECT COUNT(*) as total,
             COUNT(file_hash) as with_hash,
             COUNT(*) - COUNT(file_hash) as without_hash
      FROM assets
      WHERE deleted_at IS NULL;
    `);

    console.log('📊 Asset Statistics:');
    console.log(`   Total active assets: ${assetCount[0].total}`);
    console.log(`   With hash: ${assetCount[0].with_hash}`);
    console.log(`   Without hash: ${assetCount[0].without_hash}`);

    if (assetCount[0].without_hash > 0) {
      console.log('\n⚠️  Note: Existing assets need hash backfill');
      console.log('   Run: node backfill-file-hashes.js (when implemented)');
    }

    console.log('\n🎉 Migration verification complete!');
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

verify();
