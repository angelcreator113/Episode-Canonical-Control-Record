'use strict';

/**
 * The events an episode was made from (Task #1906) — the one reader the
 * episode tabs use, behind GET /api/v1/episodes/:id/events.
 *
 * The anchor is the event the episode's brief names (EpisodeBrief.event_id,
 * snapshotted by Start Episode). It resolves from the brief even when the
 * event's used_in_episode_id stamp is missing or has moved. Additional
 * events are the ones whose world_events.used_in_episode_id points at the
 * episode (generate-episode-from-many extras, the Overview linker, inject).
 * An episode with no brief anchor (made by hand, linked by inject) gets the
 * first stamped event as its anchor.
 *
 * Each event carries `link`:
 *   anchor           — this is the episode's source event
 *   anchor_source    — 'brief' or 'stamp' (only on the anchor)
 *   stamped          — its used_in_episode_id points at this episode
 *   stamped_elsewhere — its used_in_episode_id points at another episode
 */

function eventAttributes(WorldEvent) {
  return Array.isArray(WorldEvent.CURRENT_ATTRIBUTES) ? WorldEvent.CURRENT_ATTRIBUTES : undefined;
}

function eventIncludes(models) {
  const include = [];
  if (models.Asset) include.push({ model: models.Asset, as: 'invitationAsset', attributes: ['id', 's3_url_processed', 's3_url_raw'], required: false });
  if (models.SceneSet) include.push({ model: models.SceneSet, as: 'sceneSet', attributes: ['id', 'name', 'base_still_url', 'scene_type'], required: false });
  return include;
}

// Same include-then-plain fallback the show events list uses: an include
// that fails (a missing association or column) retries without includes.
async function findEvents(models, query) {
  const { WorldEvent } = models;
  const attributes = eventAttributes(WorldEvent);
  const include = eventIncludes(models);
  if (include.length > 0) {
    try {
      return await WorldEvent.findAll({ ...query, include, attributes });
    } catch (includeErr) {
      console.warn('[EpisodeEvents] Event read with includes failed, retrying without:', includeErr.message);
    }
  }
  return WorldEvent.findAll({ ...query, attributes });
}

function toPlain(row) {
  const json = typeof row?.toJSON === 'function' ? row.toJSON() : { ...row };
  json.invitation_url = json.invitationAsset?.s3_url_processed || json.invitation_url || null;
  return json;
}

/**
 * @returns {Promise<{ anchor_event_id: string|null, anchor_source: 'brief'|'stamp'|null, brief_event_id: string|null, events: object[] }>}
 */
async function listEpisodeEvents(models, episodeId) {
  const { WorldEvent, EpisodeBrief } = models;
  if (!WorldEvent) throw new Error('WorldEvent model not loaded');

  let briefEventId = null;
  if (EpisodeBrief) {
    const brief = await EpisodeBrief.findOne({ where: { episode_id: episodeId }, attributes: ['id', 'event_id'] });
    briefEventId = brief?.event_id || null;
  }

  const stampedRows = await findEvents(models, {
    where: { used_in_episode_id: episodeId },
    order: [['created_at', 'ASC']],
  });
  const stamped = stampedRows.map(toPlain);

  let anchor = null;
  let anchorSource = null;
  if (briefEventId) {
    anchor = stamped.find((ev) => ev.id === briefEventId) || null;
    if (!anchor) {
      const briefRows = await findEvents(models, { where: { id: briefEventId } });
      anchor = briefRows[0] ? toPlain(briefRows[0]) : null;
    }
    if (anchor) anchorSource = 'brief';
  }
  if (!anchor && stamped.length > 0) {
    anchor = stamped[0];
    anchorSource = 'stamp';
  }

  const events = [];
  if (anchor) {
    events.push({
      ...anchor,
      link: {
        anchor: true,
        anchor_source: anchorSource,
        stamped: anchor.used_in_episode_id === episodeId,
        stamped_elsewhere: !!anchor.used_in_episode_id && anchor.used_in_episode_id !== episodeId,
      },
    });
  }
  for (const ev of stamped) {
    if (anchor && ev.id === anchor.id) continue;
    events.push({ ...ev, link: { anchor: false, stamped: true, stamped_elsewhere: false } });
  }

  return {
    anchor_event_id: anchor?.id || null,
    anchor_source: anchorSource,
    // What the brief names, even when that event no longer resolves.
    brief_event_id: briefEventId,
    events,
  };
}

module.exports = { listEpisodeEvents };
