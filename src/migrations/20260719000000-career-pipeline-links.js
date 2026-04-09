'use strict';

/**
 * Migration: Career Pipeline Links
 *
 * Adds bidirectional links between career_goals ↔ opportunities ↔ world_events
 * so the full pipeline can be traversed in any direction.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    // world_events.opportunity_id — reverse link from event back to the opportunity that created it
    await queryInterface.addColumn('world_events', 'opportunity_id', {
      type: Sequelize.UUID,
      allowNull: true,
      references: { model: 'opportunities', key: 'id' },
    }).catch(() => console.log('  opportunity_id already exists on world_events'));

    // opportunities.career_goal_id — link opportunity to the goal that spawned it
    await queryInterface.addColumn('opportunities', 'career_goal_id', {
      type: Sequelize.UUID,
      allowNull: true,
    }).catch(() => console.log('  career_goal_id already exists on opportunities'));

    // opportunities.career_tier — mirror from world_events for pipeline gating
    await queryInterface.addColumn('opportunities', 'career_tier', {
      type: Sequelize.INTEGER,
      allowNull: true,
      defaultValue: 1,
    }).catch(() => console.log('  career_tier already exists on opportunities'));

    // opportunities.fail_consequence — what happens if Lala botches it
    await queryInterface.addColumn('opportunities', 'fail_consequence', {
      type: Sequelize.TEXT,
      allowNull: true,
    }).catch(() => console.log('  fail_consequence already exists on opportunities'));

    // opportunities.success_unlock — what opens up on success
    await queryInterface.addColumn('opportunities', 'success_unlock', {
      type: Sequelize.TEXT,
      allowNull: true,
    }).catch(() => console.log('  success_unlock already exists on opportunities'));

    // career_goals.deleted_at — soft delete support
    await queryInterface.addColumn('career_goals', 'deleted_at', {
      type: Sequelize.DATE,
      allowNull: true,
    }).catch(() => console.log('  deleted_at already exists on career_goals'));

    // Indexes
    await queryInterface.addIndex('world_events', ['opportunity_id'], {
      name: 'idx_world_events_opportunity',
    }).catch(() => {});

    await queryInterface.addIndex('opportunities', ['career_goal_id'], {
      name: 'idx_opportunities_career_goal',
    }).catch(() => {});
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('world_events', 'opportunity_id').catch(() => {});
    await queryInterface.removeColumn('opportunities', 'career_goal_id').catch(() => {});
    await queryInterface.removeColumn('opportunities', 'career_tier').catch(() => {});
    await queryInterface.removeColumn('opportunities', 'fail_consequence').catch(() => {});
    await queryInterface.removeColumn('opportunities', 'success_unlock').catch(() => {});
    await queryInterface.removeColumn('career_goals', 'deleted_at').catch(() => {});
  },
};
