'use strict';

/**
 * The episode's event, as one SQL expression (Task #1917; §8(w) P2 of
 * docs/EVENT_EPISODE_FLOW.md: the brief's event is canonical).
 *
 * An episode's event is the one its live brief names
 * (episode_briefs.event_id), when that event still exists; else, for an
 * episode with no brief anchor (made by hand, linked by inject), the first
 * event stamped with it (world_events.used_in_episode_id, oldest first).
 * It is the same rule as services/episodeEventsService listEpisodeEvents,
 * the reader the episode's tabs use, so the screens and the story engine
 * work from one event even after the stamp moves (a reassign, an unlink or
 * the stale-link cleanup).
 *
 * Use it where a service read `WHERE used_in_episode_id = :episodeId`:
 *   `SELECT ... FROM world_events WHERE id = ${EPISODE_EVENT_ID_SQL}`
 * with an `episodeId` replacement. It yields NULL when the episode has no
 * event, so the query finds nothing.
 */
const EPISODE_EVENT_ID_SQL = `(SELECT COALESCE(
    (SELECT eb_w.id FROM episode_briefs eb_b
       JOIN world_events eb_w ON eb_w.id = eb_b.event_id AND eb_w.deleted_at IS NULL
      WHERE eb_b.episode_id = :episodeId AND eb_b.deleted_at IS NULL
      ORDER BY eb_b.created_at DESC LIMIT 1),
    (SELECT st_w.id FROM world_events st_w
      WHERE st_w.used_in_episode_id = :episodeId AND st_w.deleted_at IS NULL
      ORDER BY st_w.created_at ASC LIMIT 1)))`;

module.exports = { EPISODE_EVENT_ID_SQL };
