/**
 * Check Database Encoding for Asset Roles
 * Run this to diagnose the emoji encoding issue
 */

const { sequelize } = require('./src/models');

async function checkEncoding() {
  try {
    console.log('🔍 Checking database encoding...\n');

    // Query 1: Check database encoding
    console.log('📊 Database Encoding:');
    const [dbEncoding] = await sequelize.query(`
      SELECT 
        datname, 
        pg_encoding_to_char(encoding) as encoding,
        datcollate, 
        datctype 
      FROM pg_database 
      WHERE datname = current_database();
    `);
    console.table(dbEncoding);

    // Query 2: Check asset_roles columns
    console.log('\n📋 Asset Roles Column Info:');
    const [columns] = await sequelize.query(`
      SELECT 
        column_name,
        data_type,
        character_maximum_length,
        collation_name
      FROM information_schema.columns
      WHERE table_name = 'asset_roles'
        AND column_name IN ('role_label', 'icon', 'category', 'role_key')
      ORDER BY column_name;
    `);
    console.table(columns);

    // Query 3: Check actual data with hex encoding
    console.log('\n🎨 Branding Roles Data (with hex encoding):');
    const [brandingData] = await sequelize.query(`
      SELECT 
        role_key,
        role_label,
        icon,
        encode(role_label::bytea, 'hex') as hex_label,
        encode(icon::bytea, 'hex') as hex_icon,
        length(role_label) as char_length,
        octet_length(role_label) as byte_length
      FROM asset_roles
      WHERE role_label LIKE '%BRAND%' OR category = 'Branding'
      ORDER BY role_key;
    `);
    
    if (brandingData.length === 0) {
      console.log('⚠️  No branding roles found in database');
    } else {
      console.table(brandingData);
      
      // Decode hex to check what's stored
      console.log('\n🔬 Hex Analysis:');
      brandingData.forEach(row => {
        console.log(`\nRole: ${row.role_key}`);
        console.log(`  Label: ${row.role_label}`);
        console.log(`  Hex: ${row.hex_label}`);
        
        // Check if it's valid UTF-8
        const hexLabel = row.hex_label;
        if (hexLabel) {
          // F09F8E9C = 🎨 (correct UTF-8)
          // C3A2... = mojibake (corrupted)
          if (hexLabel.includes('f09f')) {
            console.log('  ✅ Contains emoji (valid UTF-8)');
          } else if (hexLabel.includes('c3a2') || hexLabel.includes('e2')) {
            console.log('  ❌ CORRUPTED DATA - needs to be re-inserted');
          } else {
            console.log('  ℹ️  ASCII text only');
          }
        }
      });
    }

    // Query 4: Test emoji insertion
    console.log('\n🧪 Testing Emoji Storage:');
    await sequelize.query(`
      CREATE TEMP TABLE emoji_test (test_text VARCHAR(100));
    `);
    await sequelize.query(`
      INSERT INTO emoji_test VALUES ('🎨 Test Emoji');
    `);
    const [emojiTest] = await sequelize.query(`
      SELECT 
        test_text,
        encode(test_text::bytea, 'hex') as hex_representation
      FROM emoji_test;
    `);
    console.table(emojiTest);
    
    const hex = emojiTest[0]?.hex_representation || '';
    if (hex.startsWith('f09f8e9c')) {
      console.log('✅ Database CAN store emojis correctly');
    } else {
      console.log('❌ Database CANNOT store emojis correctly');
      console.log('   Expected hex: f09f8e9c... (UTF-8 for 🎨)');
      console.log(`   Got hex: ${hex}`);
    }

    await sequelize.query(`DROP TABLE emoji_test;`);

    console.log('\n' + '='.repeat(60));
    console.log('✅ Encoding check complete!');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

checkEncoding();
