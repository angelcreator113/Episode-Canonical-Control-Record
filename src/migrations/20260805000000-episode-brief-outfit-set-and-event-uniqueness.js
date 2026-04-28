'use strict';

/**
 * Add outfit_set_id to episode_briefs + a partial unique index on
 * world_events.used_in_episode_id.
 *
 * The outfit_set field captures which saved OutfitSet drove the
 * episode at generate time, separate from the individual outfit_pieces
 * that get exploded into EpisodeWardrobe rows. Without it we lose the
 * audit trail of "which set was this" the moment the episode is
 * created — only the pieces survive.
 *
 * The partial unique index closes a race window: two near-simultaneous
 * generate-episode clicks could both pass the app-level "already used?"
 * check before either UPDATE writes back. The index makes a duplicate
 * link impossible at the DB level. WHERE NOT NULL so events that
 * haven't been used yet (the common case) don't conflict with each
 * other on the NULL value.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const briefCols = await queryInterface.describeTable('episode_briefs').catch(() => ({}));
    if (!briefCols.outfit_set_id) {
      await queryInterface.addColumn('episode_briefs', 'outfit_set_id', {
        type: Sequelize.UUID,
        allowNull: true,
        comment: 'OutfitSet that drove this episode, copied from the event at generate time',
      });
    }
    if (!briefCols.beat_outline) {
      await queryInterface.addColumn('episode_briefs', 'beat_outline', {
        type: Sequelize.JSONB,
        allowNull: true,
        defaultValue: [],
        comment: 'AI-drafted beat outline at generate time: [{ beat_number, summary, dramatic_function }]. Feeds the Suggest-Scenes flow before any script exists.',
      });
    }

    // Partial unique index — Postgres-only. Wrapped in try/catch in case
    // the index already exists from a hand-applied migration on dev.
    try {
      await queryInterface.sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS world_events_used_in_episode_unique
        ON world_events (used_in_episode_id)
        WHERE used_in_episode_id IS NOT NULL
      `);
    } catch (err) {
      console.warn('[migration] world_events used_in_episode_unique index skipped:', err.message);
    }
  },

  down: async (queryInterface) => {
    const briefCols = await queryInterface.describeTable('episode_briefs').catch(() => ({}));
    if (briefCols.outfit_set_id) await queryInterface.removeColumn('episode_briefs', 'outfit_set_id');
    if (briefCols.beat_outline) await queryInterface.removeColumn('episode_briefs', 'beat_outline');
    try {
      await queryInterface.sequelize.query('DROP INDEX IF EXISTS world_events_used_in_episode_unique');
    } catch { /* ignore */ }
  },
};
