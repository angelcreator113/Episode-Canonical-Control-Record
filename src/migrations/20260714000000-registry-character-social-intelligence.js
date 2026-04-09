'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'registry_characters';
    const desc = await queryInterface.describeTable(table);
    const addIfMissing = async (col, type, opts = {}) => {
      if (!desc[col]) {
        await queryInterface.addColumn(table, col, { type, allowNull: true, ...opts });
      }
    };

    await addIfMissing('celebrity_tier', Sequelize.STRING(20));
    await addIfMissing('platform_presences', Sequelize.JSONB);
    await addIfMissing('public_persona', Sequelize.TEXT);
    await addIfMissing('private_reality', Sequelize.TEXT);
    await addIfMissing('primary_income_source', Sequelize.STRING(100));
    await addIfMissing('income_breakdown', Sequelize.JSONB);
    await addIfMissing('monthly_earnings_range', Sequelize.STRING(50));
    await addIfMissing('clout_score', Sequelize.INTEGER);
    await addIfMissing('drama_magnet', Sequelize.BOOLEAN);
    await addIfMissing('social_leverage', Sequelize.TEXT);
    await addIfMissing('content_category', Sequelize.STRING(100));
    await addIfMissing('brand_partnerships', Sequelize.JSONB);
    await addIfMissing('controversy_history', Sequelize.JSONB);
    await addIfMissing('secret_connections', Sequelize.JSONB);
    await addIfMissing('rebrand_history', Sequelize.JSONB);
    await addIfMissing('social_synced_at', Sequelize.DATE);
  },

  async down(queryInterface) {
    const cols = [
      'celebrity_tier', 'platform_presences', 'public_persona', 'private_reality',
      'primary_income_source', 'income_breakdown', 'monthly_earnings_range',
      'clout_score', 'drama_magnet', 'social_leverage', 'content_category',
      'brand_partnerships', 'controversy_history', 'secret_connections',
      'rebrand_history', 'social_synced_at',
    ];
    for (const col of cols) {
      try { await queryInterface.removeColumn('registry_characters', col); } catch {}
    }
  },
};
