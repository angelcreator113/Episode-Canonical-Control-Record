'use strict';

/**
 * Episode links (scene_set_episodes) to a removed scene set that no beat of
 * that episode uses are soft-deleted (Evoni, 2026-10-07). An episode whose
 * beats all had live scenes still showed "Some beats point at scene sets
 * you removed" because of these leftovers: a set deleted "anyway" (D1,
 * §8(hh)) keeps every use. From now on DELETE /scene-sets/:id drops them
 * itself (sceneSetUsesService.dropRemovedSetLinks); this clears the ones
 * already there. Links whose set a beat still uses are kept, as are the
 * beats themselves.
 *
 * down: nothing. The rows are soft-deleted, not removed, and nothing marks
 * which ones this migration touched.
 */

module.exports = {
  async up(queryInterface) {
    const [, meta] = await queryInterface.sequelize.query(
      `UPDATE scene_set_episodes l SET deleted_at = NOW(), updated_at = NOW()
        WHERE l.deleted_at IS NULL
          AND EXISTS (SELECT 1 FROM scene_sets s WHERE s.id = l.scene_set_id AND s.deleted_at IS NOT NULL)
          AND NOT EXISTS (SELECT 1 FROM scene_plans p
                           WHERE p.episode_id = l.episode_id AND p.scene_set_id = l.scene_set_id AND p.deleted_at IS NULL)`);
    console.log(`[migration 20261007150000] dropped ${meta?.rowCount ?? 0} episode link(s) to removed scene sets`);
  },

  async down() {
    // No-op: see the header.
  },
};
