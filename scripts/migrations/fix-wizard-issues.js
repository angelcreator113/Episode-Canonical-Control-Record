/**
 * Fix wizard data issues
 */

const { models, sequelize } = require('./src/models');

async function fixIssues() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    // 1. Fix episode show_id
    console.log('🔧 Fixing episode show_id...');
    const showId = '32bfbf8b-1f46-46dd-8a5d-3b705d324c1b';
    const [updatedCount] = await models.Episode.update(
      { show_id: showId },
      { where: { show_id: null } }
    );
    console.log(`✅ Updated ${updatedCount} episode(s) to link to show\n`);

    // 2. Rename template
    console.log('🔧 Renaming template...');
    const [templateCount] = await models.ThumbnailTemplate.update(
      { name: 'Main Episode Thumbnail' },
      { where: { name: 'Styling Adventures v1' } }
    );
    console.log(`✅ Renamed ${templateCount} template(s)\n`);

    // 3. Check current asset roles vs template requirements
    console.log('🔍 Checking asset roles...');
    const template = await models.ThumbnailTemplate.findOne({
      where: { name: 'Main Episode Thumbnail' },
    });
    
    if (template) {
      console.log(`Template requires: ${JSON.stringify(template.required_roles)}`);
      
      const assets = await models.Asset.findAll({
        attributes: ['asset_role'],
      });
      
      const roleSet = new Set(assets.map(a => a.asset_role).filter(r => r));
      console.log(`Assets have roles: ${Array.from(roleSet).join(', ')}`);
      
      const requiredRoles = template.required_roles || [];
      const missingRoles = requiredRoles.filter(role => !roleSet.has(role));
      
      if (missingRoles.length > 0) {
        console.log(`\n⚠️  PROBLEM: Template requires roles that don't exist in assets:`);
        console.log(`   Missing: ${missingRoles.join(', ')}`);
        console.log(`\n   OPTIONS:`);
        console.log(`   A) Update template to use simple roles: ["lala", "background_frame", "guest", "justawomen"]`);
        console.log(`   B) Update asset roles to match template requirements`);
        console.log(`\n   Which would you prefer? (Type A or B)`);
      } else {
        console.log(`✅ All required roles exist in assets`);
      }
    }

    console.log('\n✅ Fixes applied!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

fixIssues();
