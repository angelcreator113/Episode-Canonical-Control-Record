require('dotenv').config();
const { EpisodeTemplate } = require('../src/models');

async function testTemplates() {
  try {
    console.log('🧪 Testing Episode Templates...\n');

    // Get all templates
    const all = await EpisodeTemplate.getActive();
    console.log(`📋 Found ${all.length} active templates:\n`);
    all.forEach(t => {
      console.log(`  ${t.icon} ${t.name} (${t.slug})`);
      console.log(`     Color: ${t.color}, Sort: ${t.sortOrder}, Used: ${t.usageCount}x`);
    });

    // Get default template
    console.log('\n🎯 Default template:');
    const defaultTemplate = await EpisodeTemplate.getDefault();
    if (defaultTemplate) {
      console.log(`  ${defaultTemplate.icon} ${defaultTemplate.name}`);
    }

    // Get popular templates
    console.log('\n🔥 Popular templates:');
    const popular = await EpisodeTemplate.getPopular(3);
    popular.forEach(t => {
      console.log(`  ${t.icon} ${t.name} - ${t.usageCount} uses`);
    });

    // Test creating episode from template
    console.log('\n📝 Creating episode from template:');
    const template = all[0];
    const episodeData = template.createEpisode({
      title: 'Test Episode',
      episode_number: 1,
    });
    console.log('  Episode data:', episodeData);

    // Test incrementing usage
    console.log('\n📊 Incrementing usage count:');
    await template.incrementUsage();
    console.log(`  ${template.name} usage: ${template.usageCount}`);

    console.log('\n✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

testTemplates();