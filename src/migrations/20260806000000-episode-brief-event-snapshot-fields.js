'use strict';

/**
 * Snapshot the rest of the event onto the episode brief at generate time.
 *
 * Closes a long list of silent data drops in the event → episode pipeline.
 * After tracing every WorldEvent column through episodeGeneratorService,
 * 15+ fields were going in but never reaching anything queryable on the
 * episode side. The user's specific complaint was that scene_set_id wasn't
 * showing on the episode (separate fix in the generator), but the rest are
 * just as load-bearing for downstream features:
 *
 *   - season_id / arc_id  — story scaffolding
 *   - invitation_asset_id — direct reference, not just metadata join
 *   - narrative_chain     — parent_event_id, chain_position, chain_reason,
 *                           seeds_future_events grouped together
 *   - canon_consequences  — full object (only the automation sub-key was
 *                           used before)
 *   - career_context      — career_tier, career_milestone,
 *                           fail_consequence, success_unlock
 *   - event_metadata      — rewards, requirements, browse_pool_*,
 *                           overlay_template, required_ui_overlays
 *   - required_ui_overlays for visibility ("this event expected these")
 *
 * Snapshot semantics: the values are copied to the brief at generate time.
 * If the underlying event later changes, the brief keeps the original
 * intent — different from the location/wardrobe read-through (which
 * tracks event edits live). For story-progression metadata, the snapshot
 * is what we want.
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    const cols = await queryInterface.describeTable('episode_briefs').catch(() => ({}));
    const add = async (name, def) => {
      if (!cols[name]) await queryInterface.addColumn('episode_briefs', name, def);
    };
    await add('invitation_asset_id', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Direct FK to assets — invite asset chosen at event time',
    });
    await add('season_id', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Snapshotted from event at generate time',
    });
    await add('arc_id', {
      type: Sequelize.UUID,
      allowNull: true,
      comment: 'Snapshotted from event at generate time',
    });
    await add('narrative_chain', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: '{ parent_event_id, chain_position, chain_reason, seeds_future_events } from event',
    });
    await add('canon_consequences', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: 'Full canon_consequences object snapshotted from event',
    });
    await add('career_context', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: '{ career_tier, career_milestone, fail_consequence, success_unlock }',
    });
    await add('event_metadata', {
      type: Sequelize.JSONB,
      allowNull: true,
      defaultValue: {},
      comment: '{ rewards, requirements, browse_pool_bias, browse_pool_size, overlay_template, required_ui_overlays }',
    });
  },

  down: async (queryInterface) => {
    const cols = await queryInterface.describeTable('episode_briefs').catch(() => ({}));
    for (const name of [
      'invitation_asset_id', 'season_id', 'arc_id', 'narrative_chain',
      'canon_consequences', 'career_context', 'event_metadata',
    ]) {
      if (cols[name]) await queryInterface.removeColumn('episode_briefs', name);
    }
  },
};
