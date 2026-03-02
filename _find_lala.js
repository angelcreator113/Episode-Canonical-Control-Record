const { Client } = require('pg');
const c = new Client({
  host: 'episode-control-dev.csnow208wqtv.us-east-1.rds.amazonaws.com',
  port: 5432, database: 'episode_metadata', user: 'postgres',
  password: 'Ayanna123!!', ssl: { rejectUnauthorized: false }
});
c.connect().then(async () => {
  // Get full Lala record
  const r = await c.query("SELECT * FROM registry_characters WHERE character_key = 'lala'");
  const lala = r.rows[0];
  console.log('Lala record:');
  console.log(JSON.stringify(lala, null, 2));

  // Insert Lala into LalaVerse
  const lalaVerseId = '0ed07537-2cc0-45f9-9b11-bf0b9fd0031c';
  
  // Check if already exists
  const existing = await c.query("SELECT id FROM registry_characters WHERE registry_id = $1 AND character_key = 'lala'", [lalaVerseId]);
  if (existing.rows.length > 0) {
    console.log('Lala already exists in LalaVerse!');
  } else {
    const ins = await c.query(`
      INSERT INTO registry_characters (
        registry_id, character_key, icon, display_name, subtitle, role_type, role_label,
        appearance_mode, status, core_belief, pressure_type, pressure_quote,
        personality, description, personality_matrix, sort_order,
        canon_tier, first_appearance, era_introduced, creator,
        core_desire, core_fear, core_wound, mask_persona, truth_persona,
        character_archetype, signature_trait, emotional_baseline, aesthetic_dna,
        career_status, relationships_map, story_presence, voice_signature,
        evolution_tracking, portrait_url, wound_depth, belief_pressured,
        emotional_function, writer_notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        $13, $14, $15, $16,
        $17, $18, $19, $20,
        $21, $22, $23, $24, $25,
        $26, $27, $28, $29,
        $30, $31::jsonb, $32::jsonb, $33,
        $34, $35, $36, $37,
        $38, $39
      ) RETURNING id, display_name
    `, [
      lalaVerseId, lala.character_key, lala.icon, lala.display_name, lala.subtitle,
      lala.role_type, lala.role_label, lala.appearance_mode, 'accepted',
      lala.core_belief, lala.pressure_type, lala.pressure_quote,
      lala.personality, lala.description,
      lala.personality_matrix ? JSON.stringify(lala.personality_matrix) : null, 0,
      lala.canon_tier, lala.first_appearance, lala.era_introduced, lala.creator,
      lala.core_desire, lala.core_fear, lala.core_wound, lala.mask_persona, lala.truth_persona,
      lala.character_archetype, lala.signature_trait, lala.emotional_baseline, lala.aesthetic_dna,
      lala.career_status,
      lala.relationships_map ? JSON.stringify(lala.relationships_map) : null,
      lala.story_presence ? JSON.stringify(lala.story_presence) : null,
      lala.voice_signature,
      lala.evolution_tracking ? JSON.stringify(lala.evolution_tracking) : null,
      lala.portrait_url, lala.wound_depth, lala.belief_pressured,
      lala.emotional_function, lala.writer_notes
    ]);
    console.log('Inserted Lala into LalaVerse:', ins.rows[0]);
  }

  // Verify
  const verify = await c.query("SELECT rc.id, rc.display_name, rc.status, cr.title FROM registry_characters rc JOIN character_registries cr ON cr.id = rc.registry_id WHERE rc.character_key = 'lala'");
  console.log('\nLala in registries:');
  verify.rows.forEach(r => console.log('  ' + r.title + ' -> ' + r.display_name + ' (' + r.status + ')'));

  await c.end();
});
