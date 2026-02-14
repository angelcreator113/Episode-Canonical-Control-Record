/**
 * Check existing templates
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const { sequelize, models } = require('./src/models');

async function checkTemplates() {
  try {
    await sequelize.authenticate();
    const templates = await models.EpisodeTemplate.findAll({
      attributes: ['id', 'name', 'slug', 'default_categories', 'is_active'],
      raw: true,
      order: [['createdAt', 'DESC']],
    });

    console.log(`\n📋 Found ${templates.length} templates:\n`);
    templates.forEach((t, i) => {
      console.log(`${i + 1}. ${t.name}`);
      console.log(`   Slug: ${t.slug}`);
      console.log(`   Categories: ${t.default_categories.join(', ')}`);
      console.log(`   Active: ${t.is_active ? '✅' : '❌'}\n`);
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkTemplates();
