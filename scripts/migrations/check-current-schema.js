/**
 * Check current database schema for wardrobe tables
 */
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  logging: false,
  dialect: 'postgres'
});

async function checkSchema() {
  try {
    console.log('🔍 Checking current wardrobe schema...\n');

    // Check wardrobe table
    const [wardrobeColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'wardrobe'
      ORDER BY ordinal_position
    `);
    
    console.log('📋 WARDROBE TABLE:');
    console.log('==================');
    wardrobeColumns.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // Check episode_wardrobe table
    const [episodeWardrobeColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_name = 'episode_wardrobe'
      ORDER BY ordinal_position
    `);
    
    console.log('\n📋 EPISODE_WARDROBE TABLE:');
    console.log('===========================');
    episodeWardrobeColumns.forEach(col => {
      console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
    });

    // Check wardrobe_library table
    const [libraryColumns] = await sequelize.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'wardrobe_library'
      ORDER BY ordinal_position
    `);
    
    if (libraryColumns.length > 0) {
      console.log('\n📋 WARDROBE_LIBRARY TABLE:');
      console.log('===========================');
      libraryColumns.forEach(col => {
        console.log(`  ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
      });
    }

    // Check for outfit-related tables
    const [outfitTables] = await sequelize.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name LIKE '%outfit%'
    `);
    
    console.log('\n📋 OUTFIT-RELATED TABLES:');
    console.log('==========================');
    if (outfitTables.length > 0) {
      outfitTables.forEach(t => console.log(`  ${t.table_name}`));
    } else {
      console.log('  (none found)');
    }

    console.log('\n✅ Schema check complete');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkSchema();
