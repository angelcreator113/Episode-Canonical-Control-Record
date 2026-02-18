/**
 * Migration: World Events Career Fields
 * 
 * Adds career progression fields to world_events:
 *   - is_paid, payment_amount
 *   - requirements (JSONB)
 *   - career_tier (1-5)
 *   - career_milestone, fail_consequence, success_unlock
 * 
 * Location: src/migrations/20260219000004-world-events-career-fields.js
 */

'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('world_events');

    if (!table.is_paid) {
      await queryInterface.addColumn('world_events', 'is_paid', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Does Lala get paid to attend (vs paying to attend)?',
      });
    }
    if (!table.payment_amount) {
      await queryInterface.addColumn('world_events', 'payment_amount', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
        comment: 'Coins earned (if paid event)',
      });
    }
    if (!table.requirements) {
      await queryInterface.addColumn('world_events', 'requirements', {
        type: Sequelize.JSONB,
        defaultValue: {},
        comment: '{"reputation_min":5,"brand_trust_min":4,"portfolio_min":10}',
      });
    }
    if (!table.career_tier) {
      await queryInterface.addColumn('world_events', 'career_tier', {
        type: Sequelize.INTEGER,
        defaultValue: 1,
        comment: '1=Emerging, 2=Rising, 3=Established, 4=Influential, 5=Elite',
      });
    }
    if (!table.career_milestone) {
      await queryInterface.addColumn('world_events', 'career_milestone', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What this event represents in her journey',
      });
    }
    if (!table.fail_consequence) {
      await queryInterface.addColumn('world_events', 'fail_consequence', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What happens narratively on fail',
      });
    }
    if (!table.success_unlock) {
      await queryInterface.addColumn('world_events', 'success_unlock', {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'What this opens up on success',
      });
    }

    await queryInterface.addIndex('world_events', ['career_tier'], { name: 'idx_world_events_career_tier' }).catch(() => {});

    console.log('✅ World events career fields added');
  },

  async down(queryInterface) {
    const cols = ['is_paid', 'payment_amount', 'requirements', 'career_tier', 'career_milestone', 'fail_consequence', 'success_unlock'];
    for (const col of cols) {
      await queryInterface.removeColumn('world_events', col).catch(() => {});
    }
  },
};
