'use strict';

/**
 * Add source_profile_id FK on world_events.
 *
 * Today, when an event is created via POST /world/:showId/events/from-profile,
 * the originating SocialProfile is buried inside
 * `canon_consequences.automation.host_profile_id` (a JSONB key). That works
 * for inspection but is fragile: edits to the JSONB or profile renames break
 * the audit trail silently, and no SQL query can join events back to profiles
 * without expensive JSONB extraction.
 *
 * This migration adds a real INTEGER FK that mirrors the ID stored in JSONB,
 * backfills it from existing rows, and indexes it. The from-profile route
 * sets both going forward; the JSONB copy stays for historical compatibility
 * with code that already reads it.
 *
 * Note: social_profiles.id is INTEGER autoincrement (see SocialProfile.js),
 * which is unusual in this codebase (most models use UUID). The column type
 * here matches that.
 *
 * The FK is ON DELETE SET NULL — if a profile is hard-deleted, the event
 * survives with a null pointer; we never want to cascade-delete events.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const table = await queryInterface.describeTable('world_events').catch(() => ({}));
    if (!table.source_profile_id) {
      await queryInterface.addColumn('world_events', 'source_profile_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'social_profiles', key: 'id' },
        onDelete: 'SET NULL',
        onUpdate: 'CASCADE',
        comment: 'FK to social_profiles.id when event was spawned from a feed profile. Mirrors canon_consequences.automation.host_profile_id but is queryable.',
      });

      // Backfill from existing JSONB. The cast pipeline guards against rows
      // where automation is missing or host_profile_id is non-numeric.
      await queryInterface.sequelize.query(`
        UPDATE world_events
        SET source_profile_id = NULLIF(canon_consequences->'automation'->>'host_profile_id', '')::integer
        WHERE source_profile_id IS NULL
          AND canon_consequences ? 'automation'
          AND canon_consequences->'automation' ? 'host_profile_id'
          AND canon_consequences->'automation'->>'host_profile_id' ~ '^[0-9]+$'
      `).catch(err => {
        // Backfill is best-effort. If a row's JSONB has a malformed
        // host_profile_id we leave source_profile_id null rather than fail
        // the migration.
        console.warn('[migration:add-source-profile-to-world-event] Backfill warning:', err.message);
      });

      await queryInterface.addIndex('world_events', ['source_profile_id'], {
        name: 'world_events_source_profile_id_idx',
      });
    }
  },

  down: async (queryInterface) => {
    const table = await queryInterface.describeTable('world_events').catch(() => ({}));
    if (table.source_profile_id) {
      await queryInterface.removeIndex('world_events', 'world_events_source_profile_id_idx').catch(() => {});
      await queryInterface.removeColumn('world_events', 'source_profile_id');
    }
  },
};
