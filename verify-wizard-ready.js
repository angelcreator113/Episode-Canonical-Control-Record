/**
 * Verify Wizard Ready
 * Quick verification that all wizard components are properly configured
 */

require('dotenv').config();
const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
  process.env.DB_NAME || 'episode_metadata',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST || '127.0.0.1',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: false
  }
);

async function verify() {
  try {
    console.log('\n🔍 WIZARD READINESS VERIFICATION\n');
    
    // 1. Check Shows
    const [shows] = await sequelize.query(`
      SELECT id, name FROM shows ORDER BY created_at DESC LIMIT 5
    `);
    console.log('📺 SHOWS:', shows.length);
    shows.forEach(s => console.log(`   - ${s.name} (${s.id.substring(0, 8)}...)`));
    
    // 2. Check Episodes linked to shows
    const [episodes] = await sequelize.query(`
      SELECT e.id, e.title, e.episode_number, e.show_id, s.name as show_name
      FROM episodes e
      LEFT JOIN shows s ON e.show_id = s.id
      ORDER BY e.created_at DESC
      LIMIT 5
    `);
    console.log('\n📝 EPISODES:', episodes.length);
    episodes.forEach(ep => {
      const showInfo = ep.show_id ? `→ ${ep.show_name}` : '⚠️  NO SHOW LINKED';
      console.log(`   - Episode ${ep.episode_number}: ${ep.title} ${showInfo}`);
    });
    
    // 3. Check Templates
    const [templates] = await sequelize.query(`
      SELECT id, name, required_roles, optional_roles
      FROM thumbnail_templates
      ORDER BY created_at DESC
      LIMIT 3
    `);
    console.log('\n🎨 TEMPLATES:', templates.length);
    templates.forEach(t => {
      console.log(`   - ${t.name}`);
      console.log(`     Required: ${JSON.stringify(t.required_roles)}`);
      if (t.optional_roles?.length > 0) {
        console.log(`     Optional: ${JSON.stringify(t.optional_roles)}`);
      }
    });
    
    // 4. Check Assets by role
    const [assetsByRole] = await sequelize.query(`
      SELECT 
        asset_role,
        COUNT(*) as count,
        COUNT(CASE WHEN s3_url_processed IS NOT NULL OR s3_url_raw IS NOT NULL THEN 1 END) as with_urls
      FROM assets
      WHERE asset_role IS NOT NULL
      GROUP BY asset_role
      ORDER BY asset_role
    `);
    console.log('\n🖼️  ASSETS BY ROLE:');
    assetsByRole.forEach(ar => {
      const urlInfo = ar.with_urls === ar.count ? '✓ all have URLs' : `⚠️  ${ar.count - ar.with_urls} missing URLs`;
      console.log(`   - ${ar.asset_role}: ${ar.count} assets (${urlInfo})`);
    });
    
    // 5. Check template-asset compatibility
    const mainTemplate = templates.find(t => t.name === 'Main Episode Thumbnail');
    if (mainTemplate) {
      console.log('\n🎯 TEMPLATE-ASSET COMPATIBILITY:');
      console.log(`   Template: ${mainTemplate.name}`);
      
      for (const role of mainTemplate.required_roles || []) {
        const roleAssets = assetsByRole.find(ar => ar.asset_role === role);
        if (roleAssets) {
          console.log(`   ✓ ${role}: ${roleAssets.count} assets available`);
        } else {
          console.log(`   ❌ ${role}: NO ASSETS FOUND`);
        }
      }
    }
    
    // 6. Test API query format
    const [testQuery] = await sequelize.query(`
      SELECT id, name, asset_role, s3_url_processed, s3_url_raw
      FROM assets
      WHERE asset_role = 'CHAR.HOST.PRIMARY'
      LIMIT 3
    `);
    console.log('\n🧪 API QUERY TEST (asset_role = CHAR.HOST.PRIMARY):');
    console.log(`   Found ${testQuery.length} assets`);
    testQuery.forEach(a => {
      const url = a.s3_url_processed || a.s3_url_raw || 'NO URL';
      console.log(`   - ${a.name}: ${url.substring(0, 50)}...`);
    });
    
    console.log('\n✅ VERIFICATION COMPLETE\n');
    
    // Summary
    const allEpisodesLinked = episodes.every(e => e.show_id !== null);
    const templateExists = templates.some(t => t.name === 'Main Episode Thumbnail');
    const hasRequiredAssets = mainTemplate && mainTemplate.required_roles.every(role => 
      assetsByRole.some(ar => ar.asset_role === role && ar.count > 0)
    );
    
    console.log('📊 READINESS CHECKLIST:');
    console.log(`   ${allEpisodesLinked ? '✅' : '❌'} All episodes linked to shows`);
    console.log(`   ${templateExists ? '✅' : '❌'} "Main Episode Thumbnail" template exists`);
    console.log(`   ${hasRequiredAssets ? '✅' : '❌'} All required assets available`);
    
    if (allEpisodesLinked && templateExists && hasRequiredAssets) {
      console.log('\n🎉 WIZARD IS READY FOR TESTING!\n');
    } else {
      console.log('\n⚠️  WIZARD NOT READY - Fix issues above\n');
    }
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  } finally {
    await sequelize.close();
  }
}

verify();
