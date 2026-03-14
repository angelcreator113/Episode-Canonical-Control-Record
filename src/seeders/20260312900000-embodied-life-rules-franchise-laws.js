'use strict';

/**
 * Embodied Life Rules — Doc 11 · v1.0 · March 2026
 * franchise_law · always_inject
 *
 * Codifies three foundational worldbuilding rules that were implicit:
 *   1. Pregnancy, Birth & Parenthood
 *   2. Character Age Spectrum & Minor Safeguards
 *   3. Sexuality & Desire Openness
 */

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const base = {
      category:        'franchise_law',
      severity:        'critical',
      always_inject:   true,
      source_document: 'embodied-life-rules-v1.0',
      source_version:  '1.0',
      created_at:      now,
      updated_at:      now,
    };

    await queryInterface.bulkInsert('franchise_knowledge', [

      /* ── 01 · Pregnancy, Birth & Parenthood ── */
      {
        ...base,
        title: 'Pregnancy, Birth & Parenthood',
        content: JSON.stringify({
          knowledge: [
            'Characters in LalaVerse can become pregnant, carry pregnancies, and give birth.',
            'Pregnancy is a narrative life event — not a procedural system. It reshapes content strategy, relationships, public persona, and arc trajectory.',
            '',
            'Rules:',
            '• Pregnancy is disclosed on the character\'s timeline the way the character would disclose it — some announce early, some hide until they can\'t.',
            '• A pregnancy changes what the Feed sees. The audience speculation that precedes disclosure is itself a story beat.',
            '• Birth creates a new family member. The child exists in the world as a background character unless the writer explicitly promotes them to a registry character.',
            '• Children born to existing characters inherit the family_architecture dimension from both parents. The child\'s wound often mirrors or inverts the parent\'s.',
            '• Co-parenting is tracked via baby_daddy / baby_mama / co_parent relationship types in social_profile_relationships.',
            '• The parenthood transition is one of the most powerful arc accelerators in the system — it surfaces the core wound in a new register.',
            '',
            'What pregnancy is NOT:',
            '• Not automatic — characters do not randomly become pregnant.',
            '• Not consequence-free — it must ripple through the character\'s Feed, relationships, career stage, and body_history.',
            '• Not abstract — the body_history field must be updated. The body dimension must reflect the change.',
            '',
            'Relevant fields: has_children, children_ages, family_structure, parents_status, body_history',
          ].join('\n'),
          rule: 'When a character becomes a parent, the story engine must update body_history, family_architecture, and the Feed layer. The transition must be treated as an arc-level event, not a background detail.',
        }),
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'social_timeline', 'character_life_simulation']),
      },

      /* ── 02 · Character Age Spectrum & Minor Safeguards ── */
      {
        ...base,
        title: 'Character Age Spectrum & Minor Safeguards',
        content: JSON.stringify({
          knowledge: [
            'LalaVerse contains characters across the full human lifespan — from children born to existing characters, to legacy-stage elders who shaped the culture.',
            '',
            'Age categories:',
            '• Child (0–12): Exists only as family context. Cannot be a protagonist, pressure, or mirror character. Cannot have a Feed profile, career stage, or social_profile_relationships. Tracked via parent\'s has_children and children_ages fields.',
            '• Teen (13–17): May exist as an emerging character (e.g. "The Beauty Prodigy", a creator\'s child entering the industry). CAN have a limited Feed presence and a Discovery-stage career. CANNOT have sexuality_and_desire, romance-type relationships, or adult content dimensions generated.',
            '• Young Adult (18–24): Full character. All dimensions available. Career typically in Discovery or early Breakout.',
            '• Adult (25–49): Full character. All dimensions available. Career spans Breakout through Expansion.',
            '• Elder (50+): Full character. All dimensions available. Career typically in Expansion or Legacy. May serve as mentor, institution founder, or cultural reference.',
            '',
            'HARD RULES:',
            '• The sexuality_and_desire deep profile dimension MUST NOT be generated for any character with age < 18.',
            '• No romantic or sexual relationship types may be created where either character has age < 18.',
            '• Children (age < 13) cannot be registry_characters with role_type. They exist only as family data on the parent.',
            '• The story engine must never generate scenes with sexual or romantic content involving characters under 18.',
            '• The AI generation system must check the age field before generating sexuality_and_desire and skip it for minors, replacing it with a note: "Dimension deferred — character is a minor."',
          ].join('\n'),
          rule: 'The character generation system, story engine, and relationship engine must enforce age-gating. sexuality_and_desire is forbidden for characters under 18. Children under 13 cannot be full registry characters.',
        }),
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'character_generator', 'relationship_engine', 'scene_generation']),
      },

      /* ── 03 · Sexuality & Desire Openness ── */
      {
        ...base,
        title: 'Sexuality & Desire Openness',
        content: JSON.stringify({
          knowledge: [
            'LalaVerse is a world where sexuality is lived, not labeled.',
            '',
            'Foundational principles:',
            '• Orientation is a freeform field — not an enum. "Who they\'re drawn to, including the complexity of understanding it." The system never reduces attraction to a checkbox.',
            '• Gender is a freeform string. Pronouns are tracked separately from gender. Neither is binary.',
            '• All romantic relationship types (Casual Dating, Power Couple, Rival Lovers, Long-Term Partners) are gender-neutral. Any character can be in any configuration.',
            '• LGBTQ+ characters are not flagged, othered, or treated as special cases. They simply exist in the world the way all characters do.',
            '• The sexuality_and_desire dimension has seven sub-fields that treat desire as a psychological architecture, not a demographic label:',
            '  - orientation: who they\'re drawn to',
            '  - relationship_to_desire: is desire something they trust, fear, perform, suppress?',
            '  - formative_experience: what shaped how love and want got wired together',
            '  - what_intimacy_means: safety, performance, surrender, power, proof of worth?',
            '  - what_they_need_to_feel_desire: the conditions',
            '  - the_pattern: who they keep choosing and why',
            '  - what_theyve_never_said: the thing they want but have never asked for',
            '',
            'What the world does NOT do:',
            '• Never use orientation as a character\'s defining trait. It is one of 14 dimensions.',
            '• Never frame queerness as conflict source. The wound comes from the wound, not from who they love.',
            '• Never require characters to "come out" as a plot beat unless the character\'s own arc demands it.',
            '• Never generate stereotypical or reductive sexuality content. The AI must treat this dimension with the same specificity and nuance as the wound or the family architecture.',
            '',
            'The AI generation system must produce sexuality_and_desire content that is:',
            '  - Specific to the character (not generic)',
            '  - Psychologically grounded (rooted in wound, family, and formative experience)',
            '  - Non-performative (not checking a representation box)',
            '  - Narratively useful (it should generate story, not just catalog identity)',
          ].join('\n'),
          rule: 'All romantic and sexual identity in LalaVerse is freeform, gender-neutral, and psychologically grounded. The AI must never reduce sexuality to labels or stereotypes. Orientation and desire are treated as narrative architecture, not demographic data.',
        }),
        applies_to: JSON.stringify(['story_engine', 'character_registry', 'character_generator', 'character_depth_engine', 'relationship_engine']),
      },

    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('franchise_knowledge', {
      source_document: 'embodied-life-rules-v1.0',
    });
  },
};
