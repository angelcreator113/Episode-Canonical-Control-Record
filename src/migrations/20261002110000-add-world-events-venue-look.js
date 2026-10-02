'use strict';

/**
 * The Event Venue Look (Evoni's ruling L1, 2026-10-02, and her answers
 * Q1-Q10; docs/EVENT_EPISODE_FLOW.md §8(hh)):
 *
 *   L1. "Each event carries an Event Venue Look: overall look, décor and
 *   colours, lighting and time, event areas, signage, must include/avoid,
 *   and reference images. ... The venue is the place; the look is how it's
 *   dressed for this occasion."
 *   Q1. "a JSON column `venue_look` on the event, with reference images
 *   stored as asset IDs."
 *
 * world_events.venue_look JSONB, nullable: the seven parts, the reference
 * images and each part's source (src/services/venueLookService.js). No
 * backfill: an event has no look until one is drafted or written.
 *
 * Guarded: the column is added only when absent. down drops it.
 */

const tableExists = async (sequelize, transaction) => {
  const [rows] = await sequelize.query('SELECT to_regclass(:name) AS reg', { replacements: { name: 'public.world_events' }, transaction });
  return Boolean(rows[0] && rows[0].reg);
};

module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.transaction(async (transaction) => {
      if (!(await tableExists(sequelize, transaction))) return;
      await sequelize.query('ALTER TABLE world_events ADD COLUMN IF NOT EXISTS venue_look JSONB', { transaction });
    });
  },

  async down(queryInterface) {
    const { sequelize } = queryInterface;
    if (!(await tableExists(sequelize))) return;
    await sequelize.query('ALTER TABLE world_events DROP COLUMN IF EXISTS venue_look');
  },
};
