'use strict';

/**
 * An event's place and its episode's Event location kept as one (eighth
 * audit, 2026-10-19). The event's set (world_events.scene_set_id) changed
 * from Scene Sets (an event version made, "Stop using these photos"), the
 * Event Package ("Change scene set", "Generate this look") or an attach,
 * while its episode kept its Event location and beats on the old set: the
 * episode showed and dressed the everyday room, and the event's photos
 * never reached it.
 *
 *   syncEpisodeEventLocation(sequelize, { eventId, fromSetId, toSetId, transaction })
 *     For each draft episode whose event this is (episodeEventIdSql): its
 *     Event location becomes toSetId (a link the episode already has to that
 *     set takes the event role), and its unlocked, unchosen beats at the old
 *     set move with it, their angle cleared so it is placed again on the new
 *     set. An accepted episode keeps its place (the Place lock). Returns the
 *     episodes changed.
 *
 * The other way, an episode's Event location chosen in its Locations step
 * is written to its event (episodeLocationsService applyLocations).
 */

const { episodeEventIdSql } = require('../utils/episodeEventSql');

async function syncEpisodeEventLocation(sequelize, { eventId, fromSetId = null, toSetId, transaction = null }) {
  if (!eventId || !toSetId || String(fromSetId || '') === String(toSetId)) return [];
  const opts = (replacements) => ({ replacements, ...(transaction ? { transaction } : {}) });
  const [episodes] = await sequelize.query(
    `SELECT e.id FROM episodes e
      WHERE e.deleted_at IS NULL AND COALESCE(e.evaluation_status, '') <> 'accepted'
        AND ${episodeEventIdSql('e.id')} = :eventId`,
    opts({ eventId }));
  const changed = [];
  for (const { id: episodeId } of episodes) {
    const [links] = await sequelize.query(
      `SELECT id, scene_set_id, role FROM scene_set_episodes
        WHERE episode_id = :episodeId AND deleted_at IS NULL AND (role = 'event' OR scene_set_id = :toSetId)`,
      opts({ episodeId, toSetId }));
    const eventLink = links.find((l) => l.role === 'event') || null;
    const prev = eventLink?.scene_set_id || fromSetId || null;
    if (eventLink && String(eventLink.scene_set_id) === String(toSetId)) continue;
    const existing = links.find((l) => String(l.scene_set_id) === String(toSetId)) || null;
    if (existing) {
      // One live link per episode and set: the one it has takes the role.
      if (eventLink) {
        await sequelize.query('UPDATE scene_set_episodes SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', opts({ id: eventLink.id }));
      }
      await sequelize.query(
        "UPDATE scene_set_episodes SET role = 'event', role_name = NULL, updated_at = NOW() WHERE id = :id", opts({ id: existing.id }));
    } else if (eventLink) {
      await sequelize.query(
        'UPDATE scene_set_episodes SET scene_set_id = :toSetId, updated_at = NOW() WHERE id = :id', opts({ id: eventLink.id, toSetId }));
    } else {
      await sequelize.query(
        `INSERT INTO scene_set_episodes (id, scene_set_id, episode_id, sort_order, role, created_at, updated_at)
         VALUES (gen_random_uuid(), :toSetId, :episodeId, 99, 'event', NOW(), NOW())`,
        opts({ toSetId, episodeId }));
    }
    if (prev) {
      await sequelize.query(
        `UPDATE scene_plans SET scene_set_id = :toSetId, angle_label = NULL, updated_at = NOW()
          WHERE episode_id = :episodeId AND scene_set_id = :prev AND locked = false
            AND chosen_by_user = false AND deleted_at IS NULL`,
        opts({ toSetId, episodeId, prev }));
    }
    changed.push(episodeId);
  }
  return changed;
}

/**
 * Why a set cannot be this event's place, or null: not found, another
 * show's, or another event's version (eighth audit: an event was given
 * another event's dressed photos through its venue's set list).
 */
async function refuseEventSet(sequelize, { event, setId, showId = null, transaction = null }) {
  const [[set]] = await sequelize.query(
    `SELECT id, name, show_id, version_of_set_id,
            (SELECT name FROM world_events w WHERE w.scene_set_id = s.id AND w.id <> :eventId AND w.deleted_at IS NULL LIMIT 1) AS other_event
       FROM scene_sets s WHERE id = :setId AND deleted_at IS NULL`,
    { replacements: { setId, eventId: event.id }, ...(transaction ? { transaction } : {}) });
  if (!set) return { status: 400, code: 'INVALID_SCENE_SET_ID', error: 'That scene set does not exist.' };
  const show = showId || event.show_id;
  if (set.show_id && show && String(set.show_id) !== String(show)) {
    return { status: 400, code: 'SCENE_SET_SHOW_MISMATCH', error: `"${set.name}" belongs to another show.` };
  }
  if (set.version_of_set_id && String(set.id) !== String(event.scene_set_id || '')) {
    return {
      status: 409, code: 'OTHER_EVENT_VERSION',
      error: `"${set.name}" is ${set.other_event ? `${set.other_event}'s` : 'another event\'s'} photos: choose the everyday set, or make this event's own photos in Scene Sets.`,
    };
  }
  return null;
}

module.exports = { syncEpisodeEventLocation, refuseEventSet };
