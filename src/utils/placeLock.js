'use strict';

/**
 * The Place lock (Evoni's ruling L13, 2026-10-02; docs/EVENT_EPISODE_FLOW.md
 * §8(hh)): "an event's Place section (scene set choice, venue look,
 * Generate this look) stays editable while its episode is a draft, even
 * after Start Episode; only the terms lock at Start Episode. It locks when
 * the episode is accepted."
 *
 * The episode is the one the terms lock names (findTermsLockEpisode: the
 * live brief that names the event, else used_in_episode_id), else the
 * used_in_episode_id stamp. No live episode: not locked.
 */

const PLACE_LOCKED_CODE = 'PLACE_LOCKED';
const PLACE_LOCKED_MESSAGE = "This event's episode is accepted: its Place is locked";

async function isPlaceLocked(sequelize, eventId) {
  const { findTermsLockEpisode } = require('./eventTermsLock');
  let episodeId = (await findTermsLockEpisode(sequelize, eventId))?.id || null;
  if (!episodeId) {
    const [[row]] = await sequelize.query(
      'SELECT used_in_episode_id FROM world_events WHERE id = :eventId', { replacements: { eventId } });
    episodeId = row?.used_in_episode_id || null;
  }
  if (!episodeId) return false;
  const [[episode]] = await sequelize.query(
    'SELECT evaluation_status FROM episodes WHERE id = :episodeId AND deleted_at IS NULL', { replacements: { episodeId } });
  return episode?.evaluation_status === 'accepted';
}

module.exports = { PLACE_LOCKED_CODE, PLACE_LOCKED_MESSAGE, isPlaceLocked };
