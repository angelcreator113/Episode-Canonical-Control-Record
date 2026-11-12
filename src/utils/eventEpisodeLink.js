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

const EVENT_DELETED_CODE = 'EVENT_DELETED';
const EVENT_DELETED_MESSAGE = 'This event was deleted. Nothing was started or linked.';

/** Thrown when an event turns out to be deleted once its row is locked; routes map it to 409. */
function eventDeletedError(eventId) {
  const err = new Error(EVENT_DELETED_MESSAGE);
  err.code = EVENT_DELETED_CODE;
  err.status = 409;
  err.event_id = eventId;
  return err;
}

/** The 409 JSON body, in the worldEvents routes' { success, error } shape. */
function eventDeletedBody(err) {
  return { success: false, error: EVENT_DELETED_MESSAGE, code: EVENT_DELETED_CODE, event_id: err?.event_id ?? null };
}

/**
 * Locks the event row (FOR UPDATE) and refuses, with eventDeletedError, an
 * event that is gone or soft-deleted (Evoni, 2026-11-12). Deleting an event
 * (utils/worldEventSafeDelete) takes the same lock, so a Start or a link and
 * a delete take turns: whichever commits first, the other then sees it.
 * Needs the caller's transaction.
 */
async function lockLiveEvent(sequelize, eventId, { transaction } = {}) {
  if (!transaction) throw new Error('lockLiveEvent needs the caller\'s transaction');
  const [rows] = await sequelize.query(
    'SELECT id, used_in_episode_id, deleted_at FROM world_events WHERE id = :eventId FOR UPDATE',
    { replacements: { eventId }, transaction }
  );
  const row = rows?.[0];
  if (!row || row.deleted_at) throw eventDeletedError(eventId);
  return row;
}

// The partial unique index that lets one event's own link point at an episode
// (migration 20260805000000-episode-brief-outfit-set-and-event-uniqueness).
// It is not a product rule (Evoni, 2026-11-12: an episode may have several
// events); it is what the database allows until that index is replaced.
const EVENT_EPISODE_LINK_INDEX = 'world_events_used_in_episode_unique';
const EPISODE_EVENT_LINK_TAKEN_CODE = 'EPISODE_EVENT_LINK_TAKEN';

/**
 * True only for the database refusing a second event's link to an episode:
 * PostgreSQL 23505 (unique_violation) on EVENT_EPISODE_LINK_INDEX. Any other
 * unique violation, and any other error, is not this conflict.
 */
function isEpisodeEventLinkConflict(err) {
  const pg = err && (err.original || err.parent);
  return Boolean(pg && pg.code === '23505' && pg.constraint === EVENT_EPISODE_LINK_INDEX);
}

/** The 409 body for that conflict, in the worldEvents routes' { success, error, code } shape. */
function episodeEventLinkTakenBody({ episodeId = null, holder = null } = {}) {
  const who = holder?.name ? `"${holder.name}"` : 'another event';
  return {
    success: false,
    error: `This episode already has ${who} linked to it, and a second event cannot be linked to an episode yet. Nothing was changed.`,
    code: EPISODE_EVENT_LINK_TAKEN_CODE,
    fields: ['used_in_episode_id'],
    episode_id: episodeId,
    linked_event: holder ? { id: holder.id, name: holder.name ?? null } : null,
  };
}

/** The event that holds an episode's link, for that body. Best effort: null when it cannot be read. */
async function findEpisodeLinkHolder(sequelize, episodeId, exceptEventId = null) {
  if (!episodeId) return null;
  try {
    const [rows] = await sequelize.query(
      'SELECT id, name FROM world_events WHERE used_in_episode_id = :episodeId AND deleted_at IS NULL AND (:exceptId::uuid IS NULL OR id <> :exceptId::uuid) ORDER BY created_at ASC LIMIT 1',
      { replacements: { episodeId, exceptId: exceptEventId } });
    return rows?.[0] || null;
  } catch (err) {
    console.error('[eventEpisodeLink] could not read the event already linked to the episode:', err.message);
    return null;
  }
}

module.exports = {
  EVENT_EPISODE_CONFLICT_CODE,
  EVENT_DELETED_CODE,
  eventDeletedError,
  eventDeletedBody,
  lockLiveEvent,
  findLiveLinkedEpisode,
  eventEpisodeConflictMessage,
  eventEpisodeConflictError,
  eventEpisodeConflictBody,
  EVENT_EPISODE_LINK_INDEX,
  EPISODE_EVENT_LINK_TAKEN_CODE,
  isEpisodeEventLinkConflict,
  episodeEventLinkTakenBody,
  findEpisodeLinkHolder,
};
