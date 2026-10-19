'use strict';

/**
 * The opportunity beat 14 delivers (Evoni, 2026-10-19: "during beat 14 we
 * should include an opportunity invitation from someone at the event, so I
 * need to be able to attach an opportunity to beat 14"; services/
 * beat14Opportunity). Additive only:
 *
 *   opportunities.offered_in_episode_id UUID NULL — the episode whose beat 14
 *   offers it (ON DELETE SET NULL), with a unique index over the live rows,
 *   so an episode offers at most one.
 *
 * Until the episode is completed the opportunity waits as status 'held'; at
 * completion it is offered when the episode lands and expires when it fails,
 * in place of the random post-event offer. down: drops the index and column.
 */
module.exports = {
  async up(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query(`ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS offered_in_episode_id UUID
      REFERENCES episodes(id) ON DELETE SET NULL`);
    await sequelize.query(`CREATE UNIQUE INDEX IF NOT EXISTS opportunities_offered_in_episode_unique
      ON opportunities (offered_in_episode_id) WHERE offered_in_episode_id IS NOT NULL AND deleted_at IS NULL`);
  },
  async down(queryInterface) {
    const { sequelize } = queryInterface;
    await sequelize.query('DROP INDEX IF EXISTS opportunities_offered_in_episode_unique');
    await sequelize.query('ALTER TABLE opportunities DROP COLUMN IF EXISTS offered_in_episode_id');
  },
};
