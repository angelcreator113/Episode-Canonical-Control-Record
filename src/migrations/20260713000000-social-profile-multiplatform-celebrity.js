'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'social_profiles';

    // Helper: only add if column doesn't exist
    const desc = await queryInterface.describeTable(table);
    const addIfMissing = async (col, type, opts = {}) => {
      if (!desc[col]) {
        await queryInterface.addColumn(table, col, { type, allowNull: true, ...opts });
      }
    };

    // Multi-platform presences
    await addIfMissing('platform_presences', Sequelize.JSONB, { defaultValue: {} });

    // Public vs private persona
    await addIfMissing('public_persona', Sequelize.TEXT);
    await addIfMissing('private_reality', Sequelize.TEXT);
    await addIfMissing('front_platform', Sequelize.STRING(50));
    await addIfMissing('real_platform', Sequelize.STRING(50));

    // Celebrity tier
    await addIfMissing('celebrity_tier', Sequelize.STRING(20), { defaultValue: 'accessible' });

    // Revenue intelligence
    await addIfMissing('primary_income_source', Sequelize.STRING(100));
    await addIfMissing('income_breakdown', Sequelize.JSONB, { defaultValue: {} });
    await addIfMissing('monthly_earnings_range', Sequelize.STRING(50));

    // Social dynamics
    await addIfMissing('clout_score', Sequelize.INTEGER, { defaultValue: 0 });
    await addIfMissing('drama_magnet', Sequelize.BOOLEAN, { defaultValue: false });
    await addIfMissing('secret_connections', Sequelize.JSONB, { defaultValue: [] });
    await addIfMissing('platform_bans', Sequelize.JSONB, { defaultValue: [] });
    await addIfMissing('rebrand_history', Sequelize.JSONB, { defaultValue: [] });
  },

  async down(queryInterface) {
    const cols = [
      'platform_presences', 'public_persona', 'private_reality',
      'front_platform', 'real_platform', 'celebrity_tier',
      'primary_income_source', 'income_breakdown', 'monthly_earnings_range',
      'clout_score', 'drama_magnet', 'secret_connections',
      'platform_bans', 'rebrand_history',
    ];
    for (const col of cols) {
      try { await queryInterface.removeColumn('social_profiles', col); } catch {}
    }
  },
};
