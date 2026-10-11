'use strict';

/**
 * The Feed page's right column (Task #2750;
 * docs/reads/2026-10-11-feed-wiring-read.md §1): the events Lala is going
 * to and the people she may know from them. Reads only.
 *
 *   upcoming   the show's events tied to one of Lala's episodes that is not
 *              published yet: the event the episode was made from
 *              (world_events.used_in_episode_id) or its brief's event
 *              (episode_briefs.event_id). Soonest first by the event's own
 *              date, then episode order. Each with its date, time and venue
 *              as the event has them (the automation copy when the column
 *              is empty), and its episode.
 *   mayKnow    the people on those events' guest lists
 *              (canon_consequences.automation.guest_profiles) who are not
 *              Lala's friends (lala_relationship 'direct'; Task #2747) and
 *              not Lala, up to five, in the order the events come.
 */

const MAY_KNOW_MAX = 5;
const UPCOMING_MAX = 10;

const parse = (v) => {
  if (v == null || typeof v !== 'string') return v || null;
  try { return JSON.parse(v); } catch (err) {
    console.error('[FeedSidebar] stored JSON parse failed:', err.message);
    return null;
  }
};
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

async function upcomingEvents(sequelize, showId) {
  const [rows] = await sequelize.query(
    `SELECT DISTINCT ON (we.id) we.id, we.name, we.event_date, we.event_time, we.venue_name, we.canon_consequences,
            ep.id AS episode_id, ep.episode_number, ep.title AS episode_title
       FROM world_events we
       JOIN episodes ep ON ep.deleted_at IS NULL AND ep.show_id = we.show_id
        AND COALESCE(ep.status, 'draft') NOT IN ('published', 'archived')
        AND (ep.id = we.used_in_episode_id OR EXISTS (
              SELECT 1 FROM episode_briefs eb
               WHERE eb.episode_id = ep.id AND eb.event_id = we.id AND eb.deleted_at IS NULL))
      WHERE we.show_id = :showId AND we.deleted_at IS NULL AND COALESCE(we.status, 'draft') <> 'archived'
      ORDER BY we.id, ep.episode_number`,
    { replacements: { showId } });
  return rows.map((r) => {
    const auto = parse(r.canon_consequences)?.automation || {};
    return {
      id: r.id,
      name: r.name,
      date: text(r.event_date) || text(auto.event_date),
      time: text(r.event_time) || text(auto.event_time),
      venue: text(r.venue_name) || text(auto.venue_name),
      episode: { id: r.episode_id, number: r.episode_number, title: r.episode_title },
      guests: Array.isArray(auto.guest_profiles) ? auto.guest_profiles.filter(Boolean) : [],
    };
  }).sort((a, b) => {
    if (a.date && b.date && a.date !== b.date) return a.date < b.date ? -1 : 1;
    if (!!a.date !== !!b.date) return a.date ? -1 : 1;
    return (a.episode.number ?? Infinity) - (b.episode.number ?? Infinity);
  }).slice(0, UPCOMING_MAX);
}

async function peopleToMeet(sequelize, events, lalaProfileId) {
  const ids = [];
  for (const ev of events) {
    for (const g of ev.guests) {
      const id = Number(g.profile_id ?? g.id);
      if (Number.isInteger(id) && id > 0 && !ids.includes(id)) ids.push(id);
    }
  }
  if (!ids.length) return [];
  const [rows] = await sequelize.query(
    `SELECT id, handle, display_name FROM social_profiles
      WHERE id IN (:ids) AND deleted_at IS NULL
        AND COALESCE(lala_relationship::text, '') <> 'direct'
        AND COALESCE(is_justawoman_record, false) = false
        AND (CAST(:lala AS INTEGER) IS NULL OR id <> CAST(:lala AS INTEGER))`,
    { replacements: { ids, lala: lalaProfileId || null } });
  const byId = new Map(rows.map((r) => [r.id, r]));
  return ids.map((id) => byId.get(id)).filter(Boolean).slice(0, MAY_KNOW_MAX);
}

/** { upcoming: [...], may_know: [...] } for the show; `lalaProfileId` is left out of may_know. */
async function getFeedSidebar(models, showId, { lalaProfileId = null } = {}) {
  const { sequelize } = models;
  const events = await upcomingEvents(sequelize, showId);
  const mayKnow = await peopleToMeet(sequelize, events, lalaProfileId);
  return {
    upcoming: events.map(({ guests, ...ev }) => ({ ...ev, guest_count: guests.length })),
    may_know: mayKnow,
  };
}

module.exports = { getFeedSidebar, MAY_KNOW_MAX };
