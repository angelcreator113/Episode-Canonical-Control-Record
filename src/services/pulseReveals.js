'use strict';

/**
 * Reveals on The Pulse (Task #2938; The Pulse spec §5; Evoni, 2026-10-11;
 * docs/reads/2026-10-11-pulse-story-clock-read.md). A reveal places one
 * item (post, image, event, character) on the story clock
 * (services/storyClock.js): a moment of its event's episode or a set
 * story time. Before that moment the item is hidden or a blurred "first
 * look" teaser; from it, revealed.
 *
 *   resolveOrder(db, fields)   the reveal's story order (null when its
 *                              episode is not known yet)
 *   stateAt(reveal, at)        'revealed' | 'teaser' | 'hidden'
 *   metLala(db, showId)        the episode each Feed profile first meets
 *                              Lala in: the first episode whose event lists
 *                              them as a guest, else their earliest episode
 *                              post. Derived on read; a set reveal
 *                              (item_type 'character') overrides it.
 */

const { orderOf } = require('./storyClock');

const ITEM_TYPES = ['post', 'image', 'event', 'character'];
const IMAGE_KINDS = ['fit', 'city', 'city_bubble', 'cover', 'post_photo'];
const MODES = ['hidden', 'teaser'];
// The spec's moments, each a phase of the event's episode on the story clock.
const MOMENT_PHASES = {
  announced: 'announced',
  invitation_sent: 'invitation_sent',
  lala_arrives: 'lala_arrives',
  during: 'during_episode',
  after: 'after_episode',
};
const MOMENTS = [...Object.keys(MOMENT_PHASES), 'story_time'];

const parse = (v) => {
  if (v == null || typeof v !== 'string') return v || null;
  try { return JSON.parse(v); } catch (err) {
    console.error('[PulseReveals] stored JSON parse failed:', err.message);
    return null;
  }
};

/** The episode number a reveal hangs on: its episode, else its event's (used_in_episode_id, else a brief's). */
async function episodeNumberOf(db, { episode_id: episodeId, event_id: eventId }) {
  const { sequelize } = db;
  if (episodeId) {
    const [[row]] = await sequelize.query('SELECT episode_number FROM episodes WHERE id = :id AND deleted_at IS NULL', { replacements: { id: episodeId } });
    return row?.episode_number ?? null;
  }
  if (eventId) {
    const [[row]] = await sequelize.query(
      `SELECT ep.episode_number FROM episodes ep
        WHERE ep.deleted_at IS NULL AND ep.episode_number IS NOT NULL
          AND (ep.id = (SELECT used_in_episode_id FROM world_events WHERE id = :id)
               OR EXISTS (SELECT 1 FROM episode_briefs eb WHERE eb.episode_id = ep.id AND eb.event_id = :id AND eb.deleted_at IS NULL))
        ORDER BY ep.episode_number LIMIT 1`, { replacements: { id: eventId } });
    return row?.episode_number ?? null;
  }
  return null;
}

/** The reveal's story order: a set story time as given, else its moment in its episode; null when not known yet. */
async function resolveOrder(db, fields) {
  if (fields.moment === 'story_time') return Number.isInteger(fields.story_order) ? fields.story_order : null;
  const phase = MOMENT_PHASES[fields.moment];
  if (!phase) return null;
  return orderOf(await episodeNumberOf(db, fields), phase);
}

/**
 * The item's state at a story moment. With no moment (Director view) it is
 * revealed; a reveal whose moment is not known yet waits (its mode).
 */
function stateAt(reveal, at) {
  if (!reveal) return 'revealed';
  if (!Number.isInteger(at)) return 'revealed';
  const order = reveal.story_order;
  if (Number.isInteger(order) && order <= at) return 'revealed';
  return reveal.mode === 'hidden' ? 'hidden' : 'teaser';
}

async function hasColumn(sequelize, table, column) {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
    { replacements: { table, column } });
  return rows.length > 0;
}

const guestIds = (list) => (Array.isArray(list) ? list : [])
  .map((g) => Number(g?.profile_id ?? g?.id ?? g))
  .filter((id) => Number.isInteger(id) && id > 0);

/**
 * Map profile id → { episode_id, episode_number, from: 'guest' | 'post' }:
 * the first episode each profile meets Lala in, derived.
 */
async function metLala(db, showId) {
  const { sequelize } = db;
  const met = new Map();
  const keep = (profileId, episode, from) => {
    const cur = met.get(profileId);
    if (!cur || episode.episode_number < cur.episode_number) met.set(profileId, { episode_id: episode.episode_id, episode_number: episode.episode_number, from });
  };

  // (1) Guests of the event an episode was made from, or of its brief's event.
  const withGuestList = await hasColumn(sequelize, 'world_events', 'guest_list');
  const [events] = await sequelize.query(
    `SELECT ep.id AS episode_id, ep.episode_number, we.canon_consequences${withGuestList ? ', we.guest_list' : ''}
       FROM world_events we
       JOIN episodes ep ON ep.deleted_at IS NULL AND ep.show_id = we.show_id AND ep.episode_number IS NOT NULL
        AND (ep.id = we.used_in_episode_id OR EXISTS (
              SELECT 1 FROM episode_briefs eb WHERE eb.episode_id = ep.id AND eb.event_id = we.id AND eb.deleted_at IS NULL))
      WHERE we.show_id = :showId AND we.deleted_at IS NULL`,
    { replacements: { showId } });
  for (const ev of events) {
    const ids = new Set([...guestIds(parse(ev.canon_consequences)?.automation?.guest_profiles), ...guestIds(parse(ev.guest_list))]);
    for (const id of ids) keep(id, ev, 'guest');
  }
  const fromGuests = new Set(met.keys());

  // (2) Otherwise, the profile's earliest episode post.
  const [posts] = await sequelize.query(
    `SELECT DISTINCT ON (fp.social_profile_id) fp.social_profile_id, ep.id AS episode_id, ep.episode_number
       FROM feed_posts fp
       JOIN episodes ep ON ep.id = fp.episode_id AND ep.deleted_at IS NULL AND ep.episode_number IS NOT NULL
      WHERE fp.show_id = :showId AND fp.deleted_at IS NULL AND fp.social_profile_id IS NOT NULL
      ORDER BY fp.social_profile_id, ep.episode_number`,
    { replacements: { showId } });
  for (const p of posts) {
    if (!fromGuests.has(p.social_profile_id)) keep(p.social_profile_id, p, 'post');
  }
  return met;
}

/** Each reveal's story order, resolved now in two queries (episodes, events' episodes). */
async function resolveOrders(db, reveals) {
  const { sequelize } = db;
  const episodeIds = [...new Set(reveals.map((r) => r.episode_id).filter(Boolean))];
  const eventIds = [...new Set(reveals.filter((r) => !r.episode_id).map((r) => r.event_id).filter(Boolean))];
  const episodeNumber = new Map();
  const eventNumber = new Map();
  if (episodeIds.length) {
    const [rows] = await sequelize.query('SELECT id, episode_number FROM episodes WHERE id IN (:ids) AND deleted_at IS NULL', { replacements: { ids: episodeIds } });
    for (const r of rows) episodeNumber.set(r.id, r.episode_number);
  }
  if (eventIds.length) {
    const [rows] = await sequelize.query(
      `SELECT we.id, MIN(ep.episode_number) AS episode_number
         FROM world_events we
         JOIN episodes ep ON ep.deleted_at IS NULL AND ep.episode_number IS NOT NULL
          AND (ep.id = we.used_in_episode_id OR EXISTS (
                SELECT 1 FROM episode_briefs eb WHERE eb.episode_id = ep.id AND eb.event_id = we.id AND eb.deleted_at IS NULL))
        WHERE we.id IN (:ids)
        GROUP BY we.id`, { replacements: { ids: eventIds } });
    for (const r of rows) eventNumber.set(r.id, r.episode_number);
  }
  return reveals.map((r) => {
    if (r.moment === 'story_time') return Number.isInteger(r.story_order) ? r.story_order : null;
    const phase = MOMENT_PHASES[r.moment];
    if (!phase) return null;
    const n = r.episode_id ? episodeNumber.get(r.episode_id) : eventNumber.get(r.event_id);
    return orderOf(n ?? null, phase);
  });
}

const keyOf = (type, id, kind) => `${type}:${kind || ''}:${id}`;

/**
 * The Pulse's reveals as of a story moment (Task #2939): stateOf(type, id,
 * kind) gives 'revealed' | 'teaser' | 'hidden'; hiddenIds(type, kind) the ids
 * hidden then; hiddenProfiles the Feed profiles Lala has not met by then (a
 * set character reveal, else the derived episode, met during it), never
 * Lala herself. With no moment (Director view) everything is revealed.
 */
async function revealsAt(db, showId, at, { lalaProfileId = null } = {}) {
  const view = {
    at,
    states: new Map(),
    hiddenProfiles: new Set(),
    stateOf(type, id, kind) { return this.states.get(keyOf(type, id, kind)) || 'revealed'; },
    hiddenIds(type, kind) {
      const prefix = `${type}:${kind || ''}:`;
      return [...this.states].filter(([k, v]) => v === 'hidden' && k.startsWith(prefix)).map(([k]) => k.slice(prefix.length));
    },
  };
  if (!Number.isInteger(at) || !db.PulseReveal) return view;
  const rows = await db.PulseReveal.findAll({ where: { show_id: showId }, raw: true });
  const orders = await resolveOrders(db, rows);
  const setCharacters = new Map();
  rows.forEach((r, i) => {
    const state = stateAt({ story_order: orders[i], mode: r.mode }, at);
    if (r.item_type === 'character') setCharacters.set(Number(r.item_id), state);
    else if (state !== 'revealed') view.states.set(keyOf(r.item_type, r.item_id, r.image_kind), state);
  });
  const derived = await metLala(db, showId);
  for (const [profileId, met] of derived) {
    if (setCharacters.has(profileId)) continue;
    const order = orderOf(met.episode_number, 'during_episode');
    if (!(Number.isInteger(order) && order <= at)) view.hiddenProfiles.add(profileId);
  }
  for (const [profileId, state] of setCharacters) if (state !== 'revealed') view.hiddenProfiles.add(profileId);
  if (lalaProfileId) view.hiddenProfiles.delete(Number(lalaProfileId));
  return view;
}

module.exports = {
  ITEM_TYPES, IMAGE_KINDS, MODES, MOMENTS, MOMENT_PHASES,
  episodeNumberOf, resolveOrder, resolveOrders, stateAt, metLala, revealsAt,
};
