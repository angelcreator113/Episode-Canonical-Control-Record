'use strict';

/**
 * event_deliverables.owed_to (T2, docs/EVENT_EPISODE_FLOW.md §8(bb);
 * Task #2294). T2's one task list names two deliverable sources, a host
 * requirement and a brand deliverable; this column records which a row is
 * (Evoni, 2026-09-29: a new column, set in the Event Package form).
 *
 *   host  — the event's host requires it (the default)
 *   brand — a brand is owed it
 *
 * A STRING checked by the model (EventDeliverable.js validate: isIn), not a
 * Postgres ENUM, like status. Existing rows are backfilled: 'brand' when
 * their event is a brand_deal or came from an Opportunity (opportunity_id
 * set), otherwise 'host'.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const cols = await queryInterface.describeTable('event_deliverables');
    if (!cols.owed_to) {
      await queryInterface.addColumn('event_deliverables', 'owed_to', {
        type: Sequelize.STRING(10),
        allowNull: false,
        defaultValue: 'host',
        comment: "Who the deliverable is owed to: host | brand (T2, Task #2294)",
      });
    }
    await queryInterface.sequelize.query(
      `UPDATE event_deliverables d
          SET owed_to = 'brand'
         FROM world_events e
        WHERE e.id = d.event_id
          AND d.owed_to = 'host'
          AND (e.event_type = 'brand_deal' OR e.opportunity_id IS NOT NULL)`
    );
  },

  async down(queryInterface) {
    const cols = await queryInterface.describeTable('event_deliverables');
    if (cols.owed_to) await queryInterface.removeColumn('event_deliverables', 'owed_to');
  },
};
