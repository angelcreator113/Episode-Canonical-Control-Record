const { Scene, ScriptMetadata } = require('./src/models');
const { sequelize } = require('./src/models');

async function checkSceneData() {
  try {
    console.log('Checking Scene data...\n');
    
    // Get scenes with raw footage
    const scenes = await Scene.findAll({
      where: { deleted_at: null },
      limit: 5,
      raw: true
    });
    
    console.log('Scenes in database:');
    console.table(scenes.map(s => ({
      id: s.id.substring(0, 8),
      title: s.title || 'Untitled',
      scene_number: s.scene_number,
      type: s.scene_type,
      has_footage: !!s.raw_footage_s3_key,
      ai_detected: s.ai_scene_detected,
      ai_confidence: s.ai_confidence_score
    })));
    
    // Get script metadata
    const scriptMetadata = await ScriptMetadata.findAll({
      limit: 5,
      raw: true
    });
    
    console.log('\nScript Metadata (AI Scenes):');
    console.table(scriptMetadata.map(sm => ({
      scene_id: sm.scene_id,
      scene_type: sm.scene_type,
      duration_target: sm.duration_target_seconds,
      energy: sm.energy_level,
      clips_needed: sm.estimated_clips_needed
    })));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSceneData();
