/**
 * Assign template_studio_id to composition for testing ThumbnailComposer
 */

const { sequelize, Episode, ThumbnailComposition, ThumbnailTemplate } = require('./src/models');

async function assignTemplate() {
  try {
    console.log('🔍 Finding episodes...');
    const episodes = await Episode.findAll({ 
      limit: 5,
      order: [['created_at', 'DESC']]
    });
    
    console.log('\n📺 Available Episodes:');
    episodes.forEach((ep, i) => {
      console.log(`${i + 1}. ${ep.id} - ${ep.title || ep.name || 'Untitled'}`);
    });
    
    console.log('\n🎨 Finding templates...');
    const templates = await ThumbnailTemplate.findAll({
      where: { is_active: true },
      limit: 5
    });
    
    console.log('\n🎨 Available Templates:');
    templates.forEach((tmpl, i) => {
      console.log(`${i + 1}. ${tmpl.id} - ${tmpl.name}`);
    });
    
    console.log('\n📦 Finding compositions...');
    const compositions = await ThumbnailComposition.findAll({
      include: [{ model: Episode, as: 'episode' }],
      limit: 5,
      order: [['created_at', 'DESC']]
    });
    
    console.log('\n📦 Existing Compositions:');
    compositions.forEach((comp, i) => {
      console.log(`${i + 1}. ${comp.id} - Episode: ${comp.episode?.title || 'Unknown'} - Template: ${comp.template_id || 'NONE'} - Status: ${comp.status}`);
    });
    
    // Auto-assign first template to first composition
    if (compositions.length > 0 && templates.length > 0) {
      const comp = compositions[0];
      const tmpl = templates[0];
      
      console.log(`\n✅ Auto-assigning template "${tmpl.name}" to composition ${comp.id}...`);
      
      await comp.update({
        template_id: tmpl.id
      });
      
      // Reload to confirm
      await comp.reload();
      
      console.log(`✅ SUCCESS! Template assigned.`);
      console.log(`\n🚀 Test URL: http://localhost:5175/composer/${comp.episode_id}`);
      console.log(`\n📋 Composition ID: ${comp.id}`);
      console.log(`📋 Episode ID: ${comp.episode_id}`);
      console.log(`📋 Template ID: ${comp.template_id}`);
    } else {
      console.log('\n⚠️ No compositions or templates found. Create one first.');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await sequelize.close();
  }
}

assignTemplate();
