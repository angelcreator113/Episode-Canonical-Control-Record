'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const addIfMissing = async (table, col, def) => {
      const desc = await queryInterface.describeTable(table).catch(() => ({}));
      if (!desc[col]) await queryInterface.addColumn(table, col, def);
    };

    // ── Wardrobe: acquisition + rental/resale ──
    await addIfMissing('wardrobes', 'acquisition_type', {
      type: Sequelize.STRING(30),
      allowNull: true,
      defaultValue: 'purchased',
      comment: 'purchased | gifted | borrowed | rented | custom | vintage',
    });
    await addIfMissing('wardrobes', 'rental_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Cost to borrow for one event (in coins)',
    });
    await addIfMissing('wardrobes', 'resale_value', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'What Lala can sell it for after wearing',
    });

    // ── Episode: financial tracking ──
    await addIfMissing('episodes', 'total_income', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Total income from event payments + brand deals + content revenue',
    });
    await addIfMissing('episodes', 'total_expenses', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      defaultValue: 0,
      comment: 'Total expenses: outfit costs + event costs + beauty/styling',
    });
    await addIfMissing('episodes', 'financial_score', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Financial intelligence score 0-10',
    });

    // ── Episode todo list: extend with social media tasks ──
    await addIfMissing('episode_todo_lists', 'social_tasks', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: [],
      comment: 'Social media content tasks: [{slot, label, description, required, completed, platform, timing}]',
    });
    await addIfMissing('episode_todo_lists', 'financial_summary', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: null,
      comment: '{ total_outfit_cost, event_income, event_expense, content_revenue, net_profit }',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('wardrobes', 'acquisition_type').catch(() => {});
    await queryInterface.removeColumn('wardrobes', 'rental_price').catch(() => {});
    await queryInterface.removeColumn('wardrobes', 'resale_value').catch(() => {});
    await queryInterface.removeColumn('episodes', 'total_income').catch(() => {});
    await queryInterface.removeColumn('episodes', 'total_expenses').catch(() => {});
    await queryInterface.removeColumn('episodes', 'financial_score').catch(() => {});
    await queryInterface.removeColumn('episode_todo_lists', 'social_tasks').catch(() => {});
    await queryInterface.removeColumn('episode_todo_lists', 'financial_summary').catch(() => {});
  },
};
