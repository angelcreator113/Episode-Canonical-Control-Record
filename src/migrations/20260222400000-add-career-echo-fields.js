'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Career echo fields on storyteller_memories
    await queryInterface.addColumn('storyteller_memories', 'career_echo_content_type', {
      type: Sequelize.STRING(100),
      allowNull: true,
      comment: 'What this pain point becomes in the world: post | framework | coaching_offer | video | podcast | book_chapter | course | null',
    });

    await queryInterface.addColumn('storyteller_memories', 'career_echo_title', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Title of the content this becomes. e.g. "The Comparison Spiral Framework"',
    });

    await queryInterface.addColumn('storyteller_memories', 'career_echo_description', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'What this content looks like in JustAWoman\'s world. How Lala might encounter it.',
    });

    await queryInterface.addColumn('storyteller_memories', 'career_echo_lala_impact', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'How this content lands for Lala in Series 2. What it shifts for her. Never shown to JustAWoman.',
    });

    await queryInterface.addColumn('storyteller_memories', 'career_echo_confirmed', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      comment: 'Author has confirmed this echo is canon — it will appear in Series 2.',
    });

    // universe_characters: add world_exists flag
    await queryInterface.addColumn('universe_characters', 'world_exists', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
      comment: 'TRUE = exists in the world (canon eligible). FALSE = psychological force only (PNOS registry only).',
    });

    // book_series: add protagonist_id
    await queryInterface.addColumn('book_series', 'protagonist_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'registry_characters', key: 'id' },
      onDelete: 'SET NULL',
      comment: 'Who this series follows. Series 1 = JustAWoman. Series 2 = Lala.',
    });

    await queryInterface.addIndex('storyteller_memories', ['career_echo_confirmed'], {
      name: 'storyteller_memories_career_echo_idx',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('storyteller_memories', 'storyteller_memories_career_echo_idx');
    await queryInterface.removeColumn('storyteller_memories', 'career_echo_content_type');
    await queryInterface.removeColumn('storyteller_memories', 'career_echo_title');
    await queryInterface.removeColumn('storyteller_memories', 'career_echo_description');
    await queryInterface.removeColumn('storyteller_memories', 'career_echo_lala_impact');
    await queryInterface.removeColumn('storyteller_memories', 'career_echo_confirmed');
    await queryInterface.removeColumn('universe_characters', 'world_exists');
    await queryInterface.removeColumn('book_series', 'protagonist_id');
  },
};
