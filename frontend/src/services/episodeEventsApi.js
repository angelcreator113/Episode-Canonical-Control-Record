import api from './api';

/**
 * The events an episode was made from (Task #1906): GET
 * /api/v1/episodes/:id/events. The anchor (the brief's source event)
 * comes first, flagged `link.anchor`; any additional linked events follow.
 * Episode tabs read this instead of scanning the show's event list.
 *
 * Resolves to { anchor_event_id, anchor_source, brief_event_id, events }.
 */
export const getEpisodeEvents = (episodeId) =>
  api.get(`/api/v1/episodes/${episodeId}/events`).then((r) => r.data);

/** The anchor event, or null. */
export const getEpisodeAnchorEvent = (episodeId) =>
  getEpisodeEvents(episodeId).then((data) => {
    const events = data?.events || [];
    return events.find((ev) => ev.link?.anchor) || events[0] || null;
  });
