'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('scene_angles', 'quality_score', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Quality score 0-100, from artifact detection analysis',
    });

    await queryInterface.addColumn('scene_angles', 'artifact_flags', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of detected artifact flags [{category, label, severity, auto}]',
    });

    await queryInterface.addColumn('scene_angles', 'quality_review', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Manual quality review data {flags, notes, reviewedAt, refinedPromptSuffix}',
    });

    await queryInterface.addColumn('scene_angles', 'generation_attempt', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      comment: 'Number of generation attempts (increments on regeneration)',
    });

    await queryInterface.addColumn('scene_angles', 'refined_prompt', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'Refined prompt used for regeneration after artifact review',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('scene_angles', 'quality_score');
    await queryInterface.removeColumn('scene_angles', 'artifact_flags');
    await queryInterface.removeColumn('scene_angles', 'quality_review');
    await queryInterface.removeColumn('scene_angles', 'generation_attempt');
    await queryInterface.removeColumn('scene_angles', 'refined_prompt');
  },
};
