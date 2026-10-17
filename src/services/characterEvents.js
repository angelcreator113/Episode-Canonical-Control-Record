'use strict';

/**
 * The events a character hosts or attends, and what each is for (Evoni,
 * 2026-10-15: "shouldn't character profiles know about the events
 * characters are hosting, purpose, etc").
 *
 *   eventsForProfile(sequelize, profileId)
 *     the events of a Feed profile, each with its role ('host' or 'guest'),
 *     what it is for (description, theme, dress code, stakes) and the
 *     episode made from it. The host is world_events.source_profile_id,
 *     else the automation copy's host_profile_id (utils/eventOrganizer);
 *     guests are the automation copy's guest_profiles (profile_id, or id on
 *     older rows). Same rule as GET /cast/characters/:id/appearances,
 *     which reads it from here.
 *   eventsPromptLines(events, { max })
 *     the same events as short lines for an AI prompt, hosted first; '' when
 *     there are none.
 *
 * Only columns every database has are read (WorldEvent.CURRENT_ATTRIBUTES).
 */

const HOST_ID_SQL = `COALESCE(we.source_profile_id,
  CASE WHEN we.canon_consequences->'automation'->>'host_profile_id' ~ '^[0-9]+$'
       THEN (we.canon_consequences->'automation'->>'host_profile_id')::int END)`;

async function eventsForProfile(sequelize, profileId) {
  if (profileId == null) return [];
  const [rows] = await sequelize.query(`
    WITH mine AS (
      SELECT we.*, CASE WHEN ${HOST_ID_SQL} = :pid THEN 'host' ELSE 'guest' END AS role
        FROM world_events we
       WHERE we.deleted_at IS NULL AND (
             ${HOST_ID_SQL} = :pid
          OR EXISTS (
               SELECT 1 FROM jsonb_array_elements(
                 CASE WHEN jsonb_typeof(we.canon_consequences->'automation'->'guest_profiles') = 'array'
                      THEN we.canon_consequences->'automation'->'guest_profiles' ELSE '[]'::jsonb END) g
                WHERE COALESCE(g->>'profile_id', g->>'id') = :pidText))
    )
    SELECT m.id, m.show_id, m.name, m.role, m.event_type, m.event_date, m.event_time, m.venue_name, m.venue_location_id,
           m.is_paid, m.payment_amount, m.description, m.theme, m.dress_code, m.narrative_stakes, m.host_brand,
           m.canon_consequences->'automation'->'relationship_goals' AS goals,
           e.id AS episode_id, e.episode_number, e.title AS episode_title,
           -- The event's scene set (2026-10-17: the Places tab adds the event's
           -- photos and angles there): its id, name, and the everyday set it is
           -- an event version of, when it is one.
           ss.id AS scene_set_id, ss.name AS scene_set_name, ss.version_of_set_id AS scene_set_version_of
      FROM mine m
      LEFT JOIN scene_sets ss ON ss.id = m.scene_set_id AND ss.deleted_at IS NULL
      LEFT JOIN LATERAL (
        SELECT ep.id, ep.episode_number, ep.title FROM episodes ep
         WHERE ep.deleted_at IS NULL AND (ep.id = m.used_in_episode_id
            OR ep.id IN (SELECT eb.episode_id FROM episode_briefs eb WHERE eb.event_id = m.id AND eb.deleted_at IS NULL))
         ORDER BY ep.episode_number NULLS LAST LIMIT 1
      ) e ON true
     ORDER BY e.episode_number NULLS LAST, m.created_at`,
  { replacements: { pid: profileId, pidText: String(profileId) } });
  return rows;
}

const clip = (text, n) => {
  const s = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : '';
  return s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;
};

/** One line per event for a prompt: role, name, episode, what it is for. */
function eventsPromptLines(events, { max = 8 } = {}) {
  const list = Array.isArray(events) ? [...events] : [];
  list.sort((a, b) => (a.role === 'host' ? 0 : 1) - (b.role === 'host' ? 0 : 1));
  return list.slice(0, max).map((ev) => {
    const parts = [
      `${ev.role === 'host' ? 'Hosts' : 'Guest at'} "${ev.name}"`
        + (ev.episode_number != null ? ` (Episode ${ev.episode_number})` : ''),
      clip(ev.description, 220) && `what it is: ${clip(ev.description, 220)}`,
      clip(ev.narrative_stakes, 160) && `stakes: ${clip(ev.narrative_stakes, 160)}`,
      ev.theme && `theme: ${clip(ev.theme, 60)}`,
      ev.dress_code && `dress code: ${clip(ev.dress_code, 80)}`,
      ev.host_brand && `with ${clip(ev.host_brand, 60)}`,
    ].filter(Boolean);
    return `- ${parts.join('; ')}`;
  }).join('\n');
}

module.exports = { eventsForProfile, eventsPromptLines };
