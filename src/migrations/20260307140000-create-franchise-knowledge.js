'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {

    await queryInterface.createTable('franchise_knowledge', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },

      // ── The decision itself ──────────────────────────────────────────────
      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'The actual decision, rule, or truth — written as a direct statement',
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
        comment: 'Short label for UI display and search',
      },

      // ── Classification ───────────────────────────────────────────────────
      category: {
        type: Sequelize.ENUM(
          'character',
          'narrative',
          'locked_decision',
          'franchise_law',
          'technical',
          'brand',
          'world'
        ),
        allowNull: false,
        defaultValue: 'narrative',
      },
      severity: {
        type: Sequelize.ENUM(
          'critical',
          'important',
          'context'
        ),
        allowNull: false,
        defaultValue: 'important',
      },

      // ── Targeting ────────────────────────────────────────────────────────
      applies_to: {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'Tags for relevance matching: character names, scene types, arc stages, themes',
      },
      always_inject: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'If true — injects into EVERY generation call regardless of relevance. Reserved for franchise laws.',
      },

      // ── Source tracking ──────────────────────────────────────────────────
      source_document: {
        type: Sequelize.STRING(200),
        allowNull: true,
        comment: 'Which document this came from: franchise_bible | tdd | roadmap | deviations | conversation | direct',
      },
      source_version: {
        type: Sequelize.STRING(20),
        allowNull: true,
        comment: 'Document version: v3.1, v3.2, etc.',
      },
      extracted_by: {
        type: Sequelize.ENUM('document_ingestion', 'conversation_extraction', 'direct_entry', 'system'),
        defaultValue: 'direct_entry',
      },

      // ── Lifecycle ────────────────────────────────────────────────────────
      status: {
        type: Sequelize.ENUM('pending_review', 'active', 'superseded', 'archived'),
        defaultValue: 'pending_review',
        comment: 'Only active entries inject into generation',
      },
      superseded_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'ID of the entry that replaced this one',
      },
      review_note: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Author note on review — why accepted, modified, or archived',
      },

      // ── Usage tracking ───────────────────────────────────────────────────
      injection_count: {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'How many times this entry has been injected into generation',
      },
      last_injected_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('NOW()'),
      },
      deleted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('franchise_knowledge', ['category']);
    await queryInterface.addIndex('franchise_knowledge', ['severity']);
    await queryInterface.addIndex('franchise_knowledge', ['status']);
    await queryInterface.addIndex('franchise_knowledge', ['always_inject']);

    // ── Seed the six absolute franchise laws immediately ──────────────────
    const now = new Date();
    await queryInterface.bulkInsert('franchise_knowledge', [
      {
        title: 'JustAWoman is always self-possessed',
        content: 'JustAWoman is NEVER insecure, NEVER blocked by fear, NEVER a passive object. Her self-esteem is her foundation, not a performance. She is conceited in the best possible way — fully in possession of herself. She would post a naked photo without hesitation because she considers her body art and owns every inch of it. She does not compare herself to other women — she watches successful women, gets inspired, and pushes herself harder. Any scene that writes her as small, uncertain, or passive is a franchise violation.',
        category: 'franchise_law',
        severity: 'critical',
        applies_to: JSON.stringify(['JustAWoman', 'all_scenes', 'all_generation']),
        always_inject: true,
        source_document: 'franchise_bible',
        source_version: 'v3.1',
        extracted_by: 'system',
        status: 'active',
        injection_count: 0,
        created_at: now,
        updated_at: now,
      },
      {
        title: 'Lala never knows she was built by JustAWoman',
        content: 'Lala does NOT know she was built by JustAWoman. She does not know about the consciousness transfer. She does not know about her origin. She just lives her life with JustAWoman\'s entire playbook running invisibly underneath. This secret NEVER breaks — not in dialogue, not in Lala\'s interior monologue, not in narration addressed to Lala. Any scene that gives Lala awareness of her origin is a franchise violation. This is the franchise\'s central dramatic irony and it must be protected absolutely.',
        category: 'franchise_law',
        severity: 'critical',
        applies_to: JSON.stringify(['Lala', 'all_scenes', 'consciousness_transfer']),
        always_inject: true,
        source_document: 'franchise_bible',
        source_version: 'v3.1',
        extracted_by: 'system',
        status: 'active',
        injection_count: 0,
        created_at: now,
        updated_at: now,
      },
      {
        title: 'The reader holds all three layers — no character knows what the reader knows',
        content: 'The reader is the only one who holds all three franchise layers simultaneously: JustAWoman\'s real world, LalaVerse canon, and the Series 2 mirror. No character inside the story knows what the reader knows. JustAWoman does not know what Lala is becoming. Lala does not know she was built. David does not know the full picture. The system must never write a character with the reader\'s omniscience. The dramatic irony is the gift the franchise gives the reader — it cannot be given to the characters.',
        category: 'franchise_law',
        severity: 'critical',
        applies_to: JSON.stringify(['all_characters', 'all_scenes', 'narrative_structure']),
        always_inject: true,
        source_document: 'franchise_bible',
        source_version: 'v3.1',
        extracted_by: 'system',
        status: 'active',
        injection_count: 0,
        created_at: now,
        updated_at: now,
      },
      {
        title: 'David is not the obstacle — his concern comes from love',
        content: 'David is not the villain. He is not the obstacle. He chose JustAWoman fully knowing who she was and has never asked her to be less. His role is safety — he keeps her safe instead of keeping her small. That is the deal he made. He does not like the men in her DMs and does not trust the dynamic — but that concern comes from love, not control. Any scene that frames David as the antagonist, as limiting her, or as the thing she needs to escape is a franchise violation.',
        category: 'franchise_law',
        severity: 'critical',
        applies_to: JSON.stringify(['David', 'JustAWoman', 'marriage_scenes']),
        always_inject: true,
        source_document: 'franchise_bible',
        source_version: 'v3.1',
        extracted_by: 'system',
        status: 'active',
        injection_count: 0,
        created_at: now,
        updated_at: now,
      },
      {
        title: 'Coaching realization comes in Book 2 — never Book 1',
        content: 'JustAWoman\'s realization that her pain points have coaching and curriculum value comes in Book 2. It does NOT happen in Book 1. Book 1 is about the genesis of Lala — from searching to knowing. Any scene in Book 1 that moves JustAWoman toward a coaching or teaching identity is premature and a franchise violation. She can feel the weight of her experiences. She cannot yet name them as content or curriculum.',
        category: 'franchise_law',
        severity: 'critical',
        applies_to: JSON.stringify(['JustAWoman', 'book_1', 'career_echo']),
        always_inject: true,
        source_document: 'franchise_bible',
        source_version: 'v3.1',
        extracted_by: 'system',
        status: 'active',
        injection_count: 0,
        created_at: now,
        updated_at: now,
      },
      {
        title: 'Lala appears in Book 1 as ONE intrusive thought only',
        content: 'In Book 1, Lala appears as ONE intrusive thought — a tonal rupture, brief, styled, confident. JustAWoman catching a glimpse of who Lala is becoming as she builds her. The thought crosses her mind like a door left open. By the end of Book 1: a name. Lala does NOT appear as a full scene, a conversation, a developed character presence, or anything beyond a single moment of tonal rupture in Book 1. Any second Lala emergence in Book 1 is a franchise violation.',
        category: 'franchise_law',
        severity: 'critical',
        applies_to: JSON.stringify(['Lala', 'book_1', 'lala_seed']),
        always_inject: true,
        source_document: 'franchise_bible',
        source_version: 'v3.1',
        extracted_by: 'system',
        status: 'active',
        injection_count: 0,
        created_at: now,
        updated_at: now,
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('franchise_knowledge');
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_franchise_knowledge_category";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_franchise_knowledge_severity";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_franchise_knowledge_extracted_by";`);
    await queryInterface.sequelize.query(`DROP TYPE IF EXISTS "enum_franchise_knowledge_status";`);
  },
};
