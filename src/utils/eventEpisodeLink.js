'use strict';

/**
 * One event starts at most one episode (docs/EVENT_EPISODE_FLOW.md,
 * ruling 3 "Templates repeat; events happen; episodes record what
 * happened"; Task #1751).
 *
 * An event counts as used only while world_events.used_in_episode_id
 * points at an episode row that still exists with deleted_at IS NULL.
 * The episodes table is soft-deleted by hand (Episode model has
 * paranoid: false and a softDelete() that stamps deleted_at), and there is
 * no FK from used_in_episode_id, so a link can point at a soft-deleted
 * row or at nothing at all. Neither blocks: the event may start a new
 * episode. The lookup is show-agnostic; a live episode in another show
 * still blocks.
 */

const EVENT_EPISODE_CONFLICT_CODE = 'EVENT_ALREADY_HAS_EPISODE';

/**
 * Returns the live episode an event is linked to, or null.
 */
async function findLiveLinkedEpisode(sequelize, eventId, { transaction } = {}) {
  const [eventRows] = await sequelize.query(
    `SELECT used_in_episode_id FROM world_events WHERE id = :eventId LIMIT 1`,
    { replacements: { eventId }, transaction }
  );
  const linkedId = eventRows?.[0]?.used_in_episode_id;
  if (!linkedId) return null;

  const [episodeRows] = await sequelize.query(
    'SELECT id, title, episode_number, show_id FROM episodes WHERE id = :episodeId AND deleted_at IS NULL LIMIT 1',
    { replacements: { episodeId: linkedId }, transaction }
  );
  return episodeRows?.[0] || null;
}

function eventEpisodeConflictMessage(episode) {
  const number = episode?.episode_number != null ? `Episode ${episode.episode_number} ` : 'Episode ';
  const title = episode?.title ? `"${episode.title}" ` : '';
  return `This event already started ${number}${title}(${episode?.id}). An event starts at most one episode.`;
}

/** Error thrown by generateEpisodeFromEvent; routes map it to 409. */
function eventEpisodeConflictError(episode) {
  const err = new Error(eventEpisodeConflictMessage(episode));
  err.code = EVENT_EPISODE_CONFLICT_CODE;
  err.status = 409;
  err.episode = episode;
  return err;
}

/** The 409 JSON body, in the worldEvents routes' { success, error } shape. */
function eventEpisodeConflictBody(episode) {
  return {
    success: false,
    error: eventEpisodeConflictMessage(episode),
    code: EVENT_EPISODE_CONFLICT_CODE,
    episode: {
      id: episode?.id ?? null,
      title: episode?.title ?? null,
      episode_number: episode?.episode_number ?? null,
    },
  };
}

module.exports = {
  EVENT_EPISODE_CONFLICT_CODE,
  findLiveLinkedEpisode,
  eventEpisodeConflictMessage,
  eventEpisodeConflictError,
  eventEpisodeConflictBody,
};
