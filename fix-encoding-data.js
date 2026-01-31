/**
 * Fix UTF-8 Encoding Issues in Database
 * This script checks for and fixes mojibake (corrupted encoding) in the database
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: {
    client_encoding: 'UTF8',
    ssl: process.env.DB_SSL === 'true' ? {
      require: true,
      rejectUnauthorized: false
    } : false
  }
});

async function fixEncodingIssues() {
  try {
    console.log('🔌 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Connected successfully\n');

    // Set encoding for this session
    await sequelize.query('SET CLIENT_ENCODING TO UTF8;');
    console.log('✅ Set client encoding to UTF8\n');

    // Check current database encoding
    try {
      const [[encoding]] = await sequelize.query('SHOW SERVER_ENCODING;');
      console.log('📊 Server encoding:', encoding.server_encoding);
      
      const [[client]] = await sequelize.query('SHOW CLIENT_ENCODING;');
      console.log('📊 Client encoding:', client.client_encoding, '\n');
    } catch (err) {
      console.log('⏭️  Could not check encoding (not critical)\n');
    }

    // Find corrupted rows in assets table
    console.log('🔍 Searching for corrupted data in assets table...');
    const [corruptedAssets] = await sequelize.query(`
      SELECT 
        id, 
        name,
        description,
        asset_type,
        LENGTH(name) as name_len,
        octet_length(name) as name_bytes,
        CASE 
          WHEN name ~ '[À-ÿ]{2,}' THEN 'CORRUPTED'
          WHEN name ~ '[�?]' THEN 'CORRUPTED'
          ELSE 'OK'
        END as status
      FROM assets 
      WHERE name ~ '[À-ÿ]{2,}|[�?]'
         OR description ~ '[À-ÿ]{2,}|[�?]'
      LIMIT 20;
    `);

    if (corruptedAssets.length === 0) {
      console.log('✅ No obviously corrupted data found!\n');
      
      // Show sample of data instead
      console.log('📊 Sample of existing data:');
      const [sampleData] = await sequelize.query(`
        SELECT id, name, asset_type 
        FROM assets 
        ORDER BY created_at DESC 
        LIMIT 5;
      `);
      console.table(sampleData);
      
    } else {
      console.log(`⚠️  Found ${corruptedAssets.length} corrupted assets:\n`);
      console.table(corruptedAssets.map(a => ({
        id: a.id,
        name: a.name.substring(0, 50),
        status: a.status,
        name_len: a.name_len,
        name_bytes: a.name_bytes
      })));

      console.log('\n🔧 Attempting to fix encoding...');
      
      // Try to fix by converting encoding
      const [updateResult] = await sequelize.query(`
        UPDATE assets
        SET 
          name = convert_from(convert_to(name, 'LATIN1'), 'UTF8'),
          description = CASE 
            WHEN description IS NOT NULL 
            THEN convert_from(convert_to(description, 'LATIN1'), 'UTF8')
            ELSE NULL 
          END
        WHERE name ~ '[À-ÿ]{2,}|[�?]'
           OR description ~ '[À-ÿ]{2,}|[�?]';
      `);

      console.log(`✅ Fixed ${updateResult.rowCount || 0} rows\n`);

      // Verify fix
      const [afterFix] = await sequelize.query(`
        SELECT id, name, description
        FROM assets 
        WHERE name ~ '[À-ÿ]{2,}|[�?]'
           OR description ~ '[À-ÿ]{2,}|[�?]'
        LIMIT 5;
      `);

      if (afterFix.length === 0) {
        console.log('✅ All corruption fixed!');
      } else {
        console.log('⚠️  Some corruption remains:');
        console.table(afterFix);
        console.log('\n💡 The data may be beyond repair. You may need to re-upload these assets.');
      }
    }

    // Check other tables for corruption
    console.log('\n🔍 Checking other tables...');
    
    const tables = ['episodes', 'shows', 'scenes', 'thumbnail_templates', 'wardrobe_library'];
    for (const table of tables) {
      try {
        const [count] = await sequelize.query(`
          SELECT COUNT(*) as count 
          FROM ${table} 
          WHERE title ~ '[À-ÿ]{2,}|[�?]'
             OR description ~ '[À-ÿ]{2,}|[�?]'
             OR name ~ '[À-ÿ]{2,}|[�?]';
        `);
        
        if (count[0].count > 0) {
          console.log(`⚠️  ${table}: ${count[0].count} corrupted rows`);
        } else {
          console.log(`✅ ${table}: clean`);
        }
      } catch (err) {
        console.log(`⏭️  ${table}: table not found or no text columns`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await sequelize.close();
    console.log('\n✅ Database connection closed');
  }
}

// Run the fix
fixEncodingIssues()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Fatal error:', err);
    process.exit(1);
  });
