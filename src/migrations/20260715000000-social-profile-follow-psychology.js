'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'social_profiles';
    const desc = await queryInterface.describeTable(table);
    const addIfMissing = async (col, type, opts = {}) => {
      if (!desc[col]) {
        await queryInterface.addColumn(table, col, { type, allowNull: true, ...opts });
      }
    };

    // Follow psychology
    await addIfMissing('follow_motivation', Sequelize.STRING(30));
    await addIfMissing('follow_emotion', Sequelize.STRING(30));
    await addIfMissing('follow_trigger', Sequelize.TEXT);
    await addIfMissing('event_excitement', Sequelize.INTEGER);

    // Lifestyle layer
    await addIfMissing('lifestyle_claim', Sequelize.TEXT);
    await addIfMissing('lifestyle_reality', Sequelize.TEXT);
    await addIfMissing('lifestyle_gap', Sequelize.STRING(100));

    // Beauty & influence
    await addIfMissing('beauty_factor', Sequelize.INTEGER);
    await addIfMissing('beauty_description', Sequelize.TEXT);
    await addIfMissing('aesthetic_power', Sequelize.TEXT);
  },

  async down(queryInterface) {
    const cols = [
      'follow_motivation', 'follow_emotion', 'follow_trigger', 'event_excitement',
      'lifestyle_claim', 'lifestyle_reality', 'lifestyle_gap',
      'beauty_factor', 'beauty_description', 'aesthetic_power',
    ];
    for (const col of cols) {
      try { await queryInterface.removeColumn('social_profiles', col); } catch {}
    }
  },
};
