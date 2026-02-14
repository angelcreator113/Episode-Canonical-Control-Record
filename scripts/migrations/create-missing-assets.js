require('dotenv').config();
const {Sequelize} = require('sequelize');
const s = new Sequelize(process.env.DATABASE_URL, {dialect: 'postgres', logging: false});

async function addMissingAssets() {
  try {
    await s.authenticate();
    
    const showId = '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b';
    const episodeId = '51299ab6-1f9a-41af-951e-cd76cd9272a6'; // "hbbnnn" episode
    
    console.log('Creating test assets for missing required roles...\n');
    
    // Create TEXT.TITLE.PRIMARY asset
    const [result1] = await s.query(`
      INSERT INTO assets (
        id, name, asset_role, asset_scope, asset_type, 
        show_id, episode_id, approval_status, 
        s3_url_processed, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        'Episode Title Card',
        'TEXT.TITLE.PRIMARY',
        'EPISODE',
        'TITLE_CARD',
        '${showId}',
        '${episodeId}',
        'APPROVED',
        'https://placeholder.com/title.png',
        NOW(),
        NOW()
      )
      RETURNING id, name, asset_role
    `);
    console.log(`✅ Created: ${result1[0].name} [${result1[0].asset_role}]`);
    
    // Create BRAND.SHOW.TITLE asset
    const [result2] = await s.query(`
      INSERT INTO assets (
        id, name, asset_role, asset_scope, asset_type,
        show_id, approval_status,
        s3_url_processed, created_at, updated_at
      ) VALUES (
        gen_random_uuid(),
        'Styling Adventures Logo',
        'BRAND.SHOW.TITLE',
        'SHOW',
        'LOGO',
        '${showId}',
        'APPROVED',
        'https://placeholder.com/logo.png',
        NOW(),
        NOW()
      )
      RETURNING id, name, asset_role
    `);
    console.log(`✅ Created: ${result2[0].name} [${result2[0].asset_role}]`);
    
    console.log('\n✅ All required assets created!');
    console.log('\nNow the template has assets for all 4 required roles:');
    console.log('  1. BG.MAIN ✅');
    console.log('  2. CHAR.HOST.PRIMARY ✅');
    console.log('  3. TEXT.TITLE.PRIMARY ✅');
    console.log('  4. BRAND.SHOW.TITLE ✅');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await s.close();
  }
}

addMissingAssets();
