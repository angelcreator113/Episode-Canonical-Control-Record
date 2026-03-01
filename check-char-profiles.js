const db = require('./src/models');
(async () => {
  const chars = await db.RegistryCharacter.findAll({
    attributes: [
      'character_key', 'display_name', 'core_desire', 'core_fear', 'core_wound',
      'core_belief', 'personality', 'personality_matrix', 'career_status',
      'relationships_map', 'voice_signature', 'story_presence', 'evolution_tracking',
      'pressure_type', 'pressure_quote', 'mask_persona', 'truth_persona',
      'signature_trait', 'emotional_baseline', 'emotional_function',
      'belief_pressured', 'writer_notes', 'job_options', 'description',
      'extra_fields', 'aesthetic_dna', 'role_type', 'role_label'
    ]
  });
  chars.forEach(c => {
    const d = c.get({ plain: true });
    console.log('\n=== ' + d.character_key + ' (' + d.display_name + ') ===');
    Object.entries(d).forEach(([k, v]) => {
      if (!v || k === 'character_key' || k === 'display_name') return;
      const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
      if (val.length > 0 && val !== 'null' && val !== '{}' && val !== '[]') {
        console.log('  ' + k + ': ' + val.slice(0, 200));
      }
    });
  });
  process.exit(0);
})();
