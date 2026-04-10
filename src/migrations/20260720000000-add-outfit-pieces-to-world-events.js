'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('world_events', 'outfit_pieces', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Selected wardrobe pieces for this event — [{id, name, category, brand, tier, price, image_url}]',
    }).catch(() => console.log('  outfit_pieces already exists'));

    await queryInterface.addColumn('world_events', 'outfit_score', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: 'Outfit match intelligence — {match_score, narrative_mood, signals, repeats, brand_loyalty}',
    }).catch(() => console.log('  outfit_score already exists'));
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('world_events', 'outfit_pieces').catch(() => {});
    await queryInterface.removeColumn('world_events', 'outfit_score').catch(() => {});
  },
};
