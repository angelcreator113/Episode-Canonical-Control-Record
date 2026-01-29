/**
 * Fix template to match actual asset roles
 */

const { models, sequelize } = require('./src/models');

async function fixTemplateRoles() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected\n');

    console.log('🔧 Updating template to match actual asset roles...');
    
    const [updated] = await models.ThumbnailTemplate.update(
      { 
        required_roles: ['CHAR.HOST.PRIMARY', 'BG.MAIN'],
        name: 'Main Episode Thumbnail',
      },
      { where: { id: '0d99b285-97c8-4f99-959b-3aca8f60c269' } }
    );

    console.log(`✅ Updated template with:`);
    console.log(`   - Name: "Main Episode Thumbnail"`);
    console.log(`   - Required roles: CHAR.HOST.PRIMARY, BG.MAIN`);
    console.log(`   - Optional roles: CHAR.GUEST, TEXT.TITLE.PRIMARY, BRAND.SHOW.TITLE, etc.`);

    // Verify
    const template = await models.ThumbnailTemplate.findByPk('0d99b285-97c8-4f99-959b-3aca8f60c269');
    console.log(`\n✅ Verified: ${template.name}`);
    console.log(`   Required: ${JSON.stringify(template.required_roles)}`);

    console.log('\n✅ Fix complete! Restart backend and try creating a composition.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixTemplateRoles();
