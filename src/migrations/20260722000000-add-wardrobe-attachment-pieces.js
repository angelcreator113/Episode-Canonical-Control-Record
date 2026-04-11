'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add parent_item_id for self-referential attachment relationship
    await queryInterface.addColumn('wardrobe', 'parent_item_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'wardrobe', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Parent item this piece attaches to (null = standalone item)',
    });

    // Add attachment_type to describe what kind of piece this is
    await queryInterface.addColumn('wardrobe', 'attachment_type', {
      type: Sequelize.STRING(50),
      allowNull: true,
      comment: 'Type of attachment: belt, brooch, collar, sleeve, chain, earring, necklace, bracelet, ring, bag, scarf, pin, etc.',
    });

    // Add is_set flag to mark items that are "set parents" (jewelry sets, dress ensembles)
    await queryInterface.addColumn('wardrobe', 'is_set', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      comment: 'Whether this item is a matching set parent (jewelry set, dress ensemble)',
    });

    // Add set_name for grouping matching pieces (e.g., "Gold Filigree Collection")
    await queryInterface.addColumn('wardrobe', 'set_name', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'Name of the matching set this piece belongs to',
    });

    // Add index for parent lookups
    await queryInterface.addIndex('wardrobe', ['parent_item_id'], {
      name: 'wardrobe_parent_item_id_idx',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeIndex('wardrobe', 'wardrobe_parent_item_id_idx');
    await queryInterface.removeColumn('wardrobe', 'set_name');
    await queryInterface.removeColumn('wardrobe', 'is_set');
    await queryInterface.removeColumn('wardrobe', 'attachment_type');
    await queryInterface.removeColumn('wardrobe', 'parent_item_id');
  },
};
