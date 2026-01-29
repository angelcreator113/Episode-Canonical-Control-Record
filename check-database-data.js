/**
 * Check what data we have in the database
 */

const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

async function checkData() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // Check shows
    const [shows] = await sequelize.query('SELECT id, name FROM shows ORDER BY created_at DESC LIMIT 5');
    console.log('📺 SHOWS:');
    if (shows.length === 0) {
      console.log('   ⚠️  No shows found in database!');
    } else {
      shows.forEach(show => console.log(`   • ${show.name} (${show.id})`));
    }

    // Check episodes
    const [episodes] = await sequelize.query('SELECT id as episode_id, title as episode_title, show_id FROM episodes ORDER BY created_at DESC LIMIT 5');
    console.log('\n📼 EPISODES:');
    if (episodes.length === 0) {
      console.log('   ⚠️  No episodes found in database!');
    } else {
      episodes.forEach(ep => console.log(`   • ${ep.episode_title} (${ep.episode_id})`));
    }

    // Check templates
    const [templates] = await sequelize.query('SELECT id, name, required_roles, optional_roles FROM thumbnail_templates ORDER BY created_at DESC LIMIT 5');
    console.log('\n🎨 TEMPLATES:');
    if (templates.length === 0) {
      console.log('   ⚠️  No templates found in database!');
    } else {
      templates.forEach(t => console.log(`   • ${t.name} (${t.id}) - ${t.required_roles.length} required, ${t.optional_roles.length} optional`));
    }

    // Check assets with roles
    const [assets] = await sequelize.query(`
      SELECT id, name, asset_role, asset_scope, show_id, episode_id, approval_status 
      FROM assets 
      WHERE asset_role IS NOT NULL 
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    console.log('\n🖼️  ASSETS (with asset_role):');
    if (assets.length === 0) {
      console.log('   ⚠️  No assets with asset_role found in database!');
      console.log('   💡 You need to create assets with the asset_role field populated');
    } else {
      assets.forEach(a => console.log(`   • ${a.name} [${a.asset_role}] ${a.asset_scope} - ${a.approval_status}`));
    }

    // Summary
    console.log('\n' + '='.repeat(70));
    console.log('SUMMARY:');
    console.log('='.repeat(70));
    console.log(`Shows: ${shows.length}`);
    console.log(`Episodes: ${episodes.length}`);
    console.log(`Templates: ${templates.length}`);
    console.log(`Assets with roles: ${assets.length}`);

    if (shows.length === 0) {
      console.log('\n❌ NO SHOWS FOUND - cannot test workflow');
      console.log('💡 Please add shows to the database first');
    } else if (episodes.length === 0) {
      console.log('\n❌ NO EPISODES FOUND - cannot test workflow');
      console.log('💡 Please add episodes to the database first');
    } else if (templates.length === 0) {
      console.log('\n❌ NO TEMPLATES FOUND - migration may not have run');
      console.log('💡 Check if the migration created the default template');
    } else if (assets.length === 0) {
      console.log('\n⚠️  NO ASSETS WITH ROLES FOUND');
      console.log('💡 You need to create or update assets with asset_role field populated');
      console.log('\n   Example SQL:');
      console.log(`   UPDATE assets SET asset_role = 'BG.MAIN', asset_scope = 'GLOBAL' WHERE name LIKE '%background%';`);
      console.log(`   UPDATE assets SET asset_role = 'CHAR.HOST.PRIMARY', asset_scope = 'SHOW' WHERE name LIKE '%lala%';`);
    } else {
      console.log('\n✅ Database has sufficient data for testing!');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

checkData();
