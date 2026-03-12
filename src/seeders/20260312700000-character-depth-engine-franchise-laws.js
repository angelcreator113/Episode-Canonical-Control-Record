'use strict';

/** ═══════════════════════════════════════════════════════════════
 *  The Character Depth Engine — Doc 09 · v1.0 · March 2026
 *  franchise_law · always_inject
 *  12 entries — 11 sections + "What Makes a Character Last" principle
 *  ═══════════════════════════════════════════════════════════════ */

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const base = {
      category:        'franchise_law',
      severity:        'critical',
      always_inject:   true,
      source_document: 'character-depth-engine-v1.0',
      source_version:  '1.0',
      created_at:      now,
      updated_at:      now,
    };

    await queryInterface.bulkInsert('franchise_knowledge', [

      /* ── 01 · The Body as Narrative Force ── */
      {
        ...base,
        title: 'The Body as Narrative Force',
        knowledge_text: [
          'A character\'s relationship to their physical self is not appearance — it is the site where everything else lands.',
          'Stress, desire, grief, and shame live in the body. The body shapes what a character can do, fear, hide, and what they\'re vulnerable to.',
          'Four registry fields:',
          '• body_relationship — fundamental orientation: owned, weaponized, hidden, performed, disciplined, currency, site of shame, site of power',
          '• body_history — what has happened to this body that shaped the relationship: illness, pregnancy, injury, transformation, violation',
          '• body_currency — whether/how the character uses physical appearance as economic or social capital',
          '• body_control_pattern — how the character uses physical discipline, deprivation, or indulgence as stress response',
        ].join('\n'),
        rule_text: 'The story engine must read body fields before generating any scene involving physical presence, self-perception, attraction, or stress response. The body is narrative force, not decoration.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation']),
      },

      /* ── 02 · Money as Behavior, Not Status ── */
      {
        ...base,
        title: 'Money as Behavior, Not Status',
        knowledge_text: [
          'Money is a behavior pattern, not a status. How a character moves when money is present or absent generates from family architecture and wound.',
          'Six behavior patterns:',
          '• Hoarder — accumulates, rarely spends; scarcity wound (real or inherited)',
          '• Compulsive giver — gives before it can be taken; guilt wound about having more',
          '• Spends to feel powerful — large visible purchases; powerlessness/class wound',
          '• Deprives out of guilt — refuses to enjoy money; unworthiness wound',
          '• Uses money to control — financial generosity as leverage; control wound / fear of loss',
          '• Performs wealth — spends to maintain appearance beyond means; belonging wound',
          'Registry fields: money_behavior_pattern (enum) + money_behavior_note (text — specific flavor and origin)',
        ].join('\n'),
        rule_text: 'The story engine must read money behavior before generating any scene involving financial decisions, brand deals, career choices, or relationship dynamics where resources are at play.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation']),
      },

      /* ── 03 · Time Orientation ── */
      {
        ...base,
        title: 'Time Orientation',
        knowledge_text: [
          'A character\'s personal relationship to time shapes every decision. Time orientation explains behavior nothing else does.',
          'Five orientations:',
          '• Past-anchored — constantly referencing who they were; memory as home; slow to change, loyal to old decisions',
          '• Future-focused — living in the version they\'re building; high ambition, low presence; relationships suffer',
          '• Present-impulsive — present moment is the only real thing; fast decisions, difficulty with long-term planning',
          '• Suspended — waiting for the right moment or permission; slow to act, often misses the window',
          '• Cyclical — experiences time as seasons; recurring patterns, anniversaries as pressure points',
          'Registry fields: time_orientation (enum) + time_orientation_note (text)',
        ].join('\n'),
        rule_text: 'The story engine must read time orientation before generating decision-making scenes, career planning, relationship timing, or any moment where temporal perspective drives choice.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation']),
      },

      /* ── 04 · Luck, Circumstance, and the Operative Cosmology ── */
      {
        ...base,
        title: 'Luck, Circumstance, and Operative Cosmology',
        knowledge_text: [
          'Some of what happens to characters is not character — it is the world. The circumstance layer captures what they didn\'t choose. The operative cosmology captures how they interpret it.',
          'Four fields:',
          '• circumstance_advantages — unchosen advantages: access, timing, proximity to right people',
          '• circumstance_disadvantages — unchosen obstacles: systems against them, closed doors before arrival',
          '• luck_belief — operative belief: Random / Rigged / Divinely ordered / Responsive / Chaotic',
          '• luck_belief_vs_stated_belief — whether operative luck belief matches stated worldview; the gap is where contradictions live',
        ].join('\n'),
        rule_text: 'The story engine must read circumstance and luck belief before generating success/failure scenes, moments of privilege awareness, or any scene where a character interprets why something happened to them.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation']),
      },

      /* ── 05 · Self-Narrative vs. Actual Narrative ── */
      {
        ...base,
        title: 'Self-Narrative vs. Actual Narrative',
        knowledge_text: [
          'Every person has a story they tell about who they are. That story is almost always partially wrong. The system generates both versions.',
          'Three fields:',
          '• self_narrative — the story the character tells herself; her origin, turning points, villains, justifications; read for first-person voice',
          '• actual_narrative — the story the system knows; what actually happened, who was responsible; read for third-person narration and revelation',
          '• narrative_gap_type — the specific distortion: villain_misidentified, hero_exaggerated, wound_mislocated, cause_reversed, timeline_collapsed, significance_inverted',
          'The gap between self-narrative and actual narrative is where the deepest character work lives.',
        ].join('\n'),
        rule_text: 'The story engine must read both narratives and the gap type before generating internal monologue, backstory references, or character revelation scenes. The self-narrative drives voice; the actual narrative drives arc direction.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation']),
      },

      /* ── 06 · The Blind Spot ── */
      {
        ...base,
        title: 'The Blind Spot',
        knowledge_text: [
          'Every character has something true about themselves they literally cannot see. Not a secret — a blind spot is something you genuinely don\'t know.',
          'Three fields:',
          '• blind_spot — the specific truth the character cannot access; the thing the story is built to eventually deliver',
          '• blind_spot_category — what kind of blindness: self_assessment, motivation, impact, pattern, relationship, wound',
          '• blind_spot_visible_to — which other characters can see this character\'s blind spot clearly',
          'RULE: Author knowledge only. Never generated into character voice. Never surfaced in internal monologue. Only in author layer and evaluation engine.',
        ].join('\n'),
        rule_text: 'The blind spot must NEVER appear in character voice or internal monologue. It is author-layer only. The story engine reads it to shape arc direction and scene construction, never to surface it directly.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'evaluation_engine']),
      },

      /* ── 07 · Change Capacity ── */
      {
        ...base,
        title: 'Change Capacity',
        knowledge_text: [
          'Not every character can change equally. Change capacity determines whether a character has an arc or is the thing that doesn\'t change while everything around them does.',
          'Three fields:',
          '• change_capacity — rigid (armor too thick) / slow (sustained pressure required) / conditional (specific conditions needed) / fluid (takes shape of whoever is near) / ready (on edge of shift)',
          '• change_conditions — specific conditions under which change becomes possible: who must be present, what must be lost/gained',
          '• change_blocker — what prevents change: the story she tells herself, the relationship she won\'t end, the identity she can\'t lose, the load-bearing belief, the unnamed fear',
          'Rigid characters are not static — they\'re the story\'s pressure test. Both arcs are valid.',
        ].join('\n'),
        rule_text: 'The story engine must read change capacity before generating character development scenes, confrontation outcomes, or arc progression. Rigid characters must remain consistent; fluid characters must be recognized as unreliable in their change.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation']),
      },

      /* ── 08 · Operative Cosmology ── */
      {
        ...base,
        title: 'Operative Cosmology',
        knowledge_text: [
          'Not religion — the actual logic a character uses to make meaning out of what happens. The most load-bearing thing a person carries.',
          'Five cosmology types:',
          '• Merit-based — effort determines outcome; loss = personal failure; extreme ambition; breaks when doing right doesn\'t work',
          '• Rigged — systems favor some, punish others; loss is structural not personal; strategic ambition; breaks when unexpected good happens',
          '• Divinely ordered — everything happens for a reason; loss is a lesson; surrendered ambition; breaks when loss too large for any reason',
          '• Random — nothing means anything beyond what we make it; loss is weather; liberated or nihilistic; breaks when meaning is needed',
          '• Relational — meaning is in the people; person-loss is existential; ambient ambition; breaks when core relationship ends or reveals itself',
          'Registry fields: operative_cosmology (enum) + cosmology_vs_stated_religion (text — the gap between stated belief and operative logic)',
        ].join('\n'),
        rule_text: 'The story engine must read operative cosmology before generating scenes of loss, success, betrayal, or grace. Two characters with identical wounds move in opposite directions because their cosmology is different.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation']),
      },

      /* ── 09 · Foreclosed Possibility ── */
      {
        ...base,
        title: 'Foreclosed Possibility',
        knowledge_text: [
          'What does this character believe is still possible for them? Not what they want — what they actually believe is still available. Some characters have secretly given up on whole categories.',
          'Three fields:',
          '• foreclosed_category — the category secretly given up on: love, safety, belonging, success, rest, joy, visibility, being_known, being_chosen, starting_over',
          '• foreclosure_origin — when and why it happened; often the actual wound, not the one the character identifies',
          '• foreclosure_vs_stated_want — the gap between what she says she wants and what she\'s foreclosed on; she may actively pursue what she secretly doesn\'t believe she can have',
          'The foreclosure controls everything. The story is often about whether it was permanent — or whether something cracks it open.',
        ].join('\n'),
        rule_text: 'The story engine must read foreclosed possibility before generating scenes where a character reaches for or flinches from something. They want it. They don\'t believe it\'s available. Both are true simultaneously.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation']),
      },

      /* ── 10 · The Experience of Joy ── */
      {
        ...base,
        title: 'The Experience of Joy',
        knowledge_text: [
          'Characters need to be alive in the direction of joy. Not happy — alive. Present. Lit up. A character defined entirely by damage is not a person — it\'s a case study.',
          'Three fields:',
          '• joy_source — the specific thing that makes this character come completely alive, not what they say but what actually lights them up',
          '• joy_accessibility — how accessible currently: freely_accessible / conditional / buried / forgotten',
          '• joy_vs_ambition — whether joy source and ambition are aligned or in tension; the most painful revelation: she built the thing and the feeling didn\'t come',
          'The arc of joy accessibility is the arc of the character\'s aliveness. The thing the story takes from her. The thing she finds again.',
        ].join('\n'),
        rule_text: 'The story engine must read joy fields before generating any scene of character aliveness, sacrifice, loss, or recovery. Joy accessibility must track across the story arc — freely_accessible → buried is a real cost.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation']),
      },

      /* ── 11 · The Complete Character Depth Architecture ── */
      {
        ...base,
        title: 'The Complete Character Depth Architecture',
        knowledge_text: [
          'When all dimensions are stacked, the system knows things about the character that the character doesn\'t know about themselves.',
          'Eight layers:',
          '• Interior World — Wound, Mask, Trigger, Want Architecture, Secret Layer, Desire Network',
          '• Social World — Personality traits, Posting archetype, Motivation type, Relationship dynamics, Reputation',
          '• Physical World — Body relationship, Body history, Body currency, Body control pattern',
          '• Economic World — Money behavior pattern, Class wound, Circumstance advantages/disadvantages',
          '• Temporal World — Time orientation, Change capacity, Change conditions, Change blocker',
          '• Meaning World — Operative cosmology, Luck belief, Foreclosed possibility, Self-narrative vs. actual narrative',
          '• Blind Structure — Blind spot, Blind spot category, Who can see it (author knowledge only)',
          '• Aliveness — Joy source, Joy accessibility, Joy vs. ambition',
        ].join('\n'),
        rule_text: 'All eight layers must be read as a complete stack before generating any character-defining scene. The layers interact — the wound shapes the body, the cosmology shapes the money behavior, the blind spot shapes the self-narrative.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation', 'evaluation_engine']),
      },

      /* ── Core Principle: What Makes a Character Last ── */
      {
        ...base,
        title: 'What Makes a Character Last — Core Principle',
        knowledge_text: [
          'The characters that last — that people tattoo and name children after — have contradiction that doesn\'t resolve.',
          'Goodness coexists with damage. Moments where they are completely wrong about themselves and the reader can see it even when they can\'t.',
          'Readers are psychologically literate. They can spot a shallow character because they\'re self-aware humans who recognize when a fictional person doesn\'t have the complexity they themselves carry.',
          'The system generates the contradiction. Preserves the blind spot. Never lets the character be too neat.',
          'A character who is irreducible — impossible to summarize in a sentence — real enough to surprise you.',
        ].join('\n'),
        rule_text: 'The system must generate contradiction, preserve the blind spot, and never let the character be too neat. Every character must be irreducible. The depth dimensions are not decorative — they are the architecture that prevents simplification.',
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'scene_generation', 'evaluation_engine']),
      },

    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: 'character-depth-engine-v1.0',
    });
  },
};
