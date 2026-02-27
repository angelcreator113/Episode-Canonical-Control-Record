'use strict';
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wardrobe_content_assignments', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      library_item_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'FK → wardrobe_library.id',
      },
      content_type: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'episode | chapter | scene_line | press | social',
      },
      content_id: {
        type: Sequelize.UUID,
        allowNull: false,
        comment: 'UUID of the target content',
      },
      scene_context: {
        type: Sequelize.TEXT,
        comment: 'What is this piece doing in this moment',
      },
      character_id: {
        type: Sequelize.UUID,
        comment: 'FK → registry_characters.id',
      },
      character_name: {
        type: Sequelize.STRING,
      },
      narrative_function: {
        type: Sequelize.STRING,
        comment: 'establishes_status | marks_transition | reveals_interior | continuity_anchor | brand_moment',
      },
      press_triggered: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      press_tag_id: {
        type: Sequelize.UUID,
        comment: 'FK → wardrobe_brand_tags.id if press was triggered',
      },
      removed_at: {
        type: Sequelize.DATE,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex(
      'wardrobe_content_assignments', ['library_item_id'],
      { name: 'wca_library_item_idx' }
    );
    await queryInterface.addIndex(
      'wardrobe_content_assignments', ['content_type', 'content_id'],
      { name: 'wca_content_idx' }
    );
    await queryInterface.addIndex(
      'wardrobe_content_assignments', ['character_id'],
      { name: 'wca_character_idx' }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wardrobe_content_assignments');
  },
};
