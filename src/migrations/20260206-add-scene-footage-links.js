'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Create scene_footage_links table
    await queryInterface.createTable('scene_footage_links', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      script_metadata_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'script_metadata',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      scene_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'scenes',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      match_type: {
        type: Sequelize.ENUM('auto', 'manual', 'suggested'),
        allowNull: false,
        defaultValue: 'manual',
      },
      confidence_score: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: true,
        comment: 'Confidence score for auto-matching (0.00-1.00)',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      created_by: {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'User ID who created the link',
      },
    });

    // Add indexes
    await queryInterface.addIndex('scene_footage_links', ['script_metadata_id']);
    await queryInterface.addIndex('scene_footage_links', ['scene_id']);
    await queryInterface.addIndex('scene_footage_links', ['match_type']);
    
    // Unique constraint: one footage can only be linked to one AI scene
    await queryInterface.addConstraint('scene_footage_links', {
      fields: ['scene_id'],
      type: 'unique',
      name: 'unique_scene_footage',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('scene_footage_links');
  },
};
