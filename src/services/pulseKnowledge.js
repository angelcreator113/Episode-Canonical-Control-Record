'use strict';

/**
 * Who knows what (Task #2982; The Pulse spec §6 "A character can only post or
 * comment about what they would know at that story time: they were there,
 * they were told, or it was already posted publicly. Drafts that break this
 * are flagged to Review, never auto-published";
 * docs/reads/2026-10-12-pulse-world-depth-read.md §1).
 *
 * Evoni, 2026-10-12: "told" is automatic — anyone with a close relationship
 * to someone who was there knows it from the next story moment.
 *
 *   showEvents(db, showId)
 *     the show's events with their episode number and guests
 *     (canon_consequences.automation.guest_profiles; Lala is at every event)
 *   knowsAt(db, showId, profileId, at, { lalaProfileId, events })
 *     → Map(eventId → 'there' | 'told' | 'public') for the events this
 *     Feed profile knows at story order `at`:
 *       there   a guest, or Lala, once the event is happening (its During)
 *       told    a close tie of a guest or of Lala, from the event's After
 *       public  a live post at or before `at` names it or is tagged with it
 *   unknownMentions(db, post, { lalaProfileId, events })
 *     the events a draft names, already happened by its story order, that
 *     its poster does not know. Events not yet happened or still hidden are
 *     the gate's future_event and unrevealed_event flags, not this.
 *
 * "Close" is a pair whose closeness at the moment is CLOSE_LINE or more: its
 * closest relationship type (pulseEventPosting.CLOSENESS, in
 * social_profile_relationships either way round) moved by the pair's accepted
 * changes in the closeness ledger at or before it (pulseCloseness, Task
 * #2983). So two characters who grow close are told from then on, and a tie
 * that cools stops hearing.
 */

const CLOSE_LINE = 0.7;

/**
 * The show's events: { id, name, episode_number, guests: Set<profileId> }.
 * An event's episode is the one made from it, else the one whose brief
 * names it (as pulseReveals); its guests are its attendees by the shared
 * rule, the host and the Event Package's Guests (utils/eventAttendees,
 * Task #3082).
 */
function hostProfileId(row) {
  const organizer = require('../utils/eventOrganizer').eventCreatorOrganizer(row);
  const id = organizer ? Number(organizer.profileId) : NaN;
  return Number.isInteger(id) ? id : null;
}

async function showEvents(db, showId) {
  const { eventAttendees } = require('../utils/eventAttendees');
  const [rows] = await db.sequelize.query(
    `SELECT we.id, we.name, we.canon_consequences, we.source_profile_id, e.episode_number FROM world_events we
       LEFT JOIN episodes e ON e.deleted_at IS NULL AND e.id = COALESCE(we.used_in_episode_id, (
         SELECT eb.episode_id FROM episode_briefs eb WHERE eb.event_id = we.id AND eb.deleted_at IS NULL
          ORDER BY eb.created_at ASC LIMIT 1))
      WHERE we.show_id = :showId AND we.deleted_at IS NULL`, { replacements: { showId } });
  return rows.map((r) => ({
    id: String(r.id),
    name: r.name,
    episode_number: r.episode_number == null ? null : Number(r.episode_number),
    guests: eventAttendees(r),
    // The organizer's Feed profile (utils/eventOrganizer), or null for a brand.
    host_profile_id: hostProfileId(r),
  }));
}

/**
 * The Feed profiles close to this one: closeness CLOSE_LINE or more. With a
 * show and a story order, each pair's accepted ledger changes at or before it
 * count (pulseCloseness.ledgerDeltas); without, the relationship types alone.
 */
async function closeTies(db, profileId, { showId, at } = {}) {
  const { CLOSENESS } = require('./pulseEventPosting');
  const me = Number(profileId);
  const [rows] = await db.sequelize.query(
    `SELECT source_profile_id, target_profile_id, relationship_type::text AS type FROM social_profile_relationships
      WHERE source_profile_id = :id OR target_profile_id = :id`, { replacements: { id: me } });
  const closeness = new Map();
  for (const r of rows) {
    const other = Number(r.source_profile_id) === me ? Number(r.target_profile_id) : Number(r.source_profile_id);
    closeness.set(other, Math.max(closeness.get(other) || 0, CLOSENESS[r.type] ?? 0));
  }
  if (showId && Number.isInteger(at)) {
    const { ledgerDeltas, clamp } = require('./pulseCloseness');
    for (const [other, delta] of await ledgerDeltas(db, showId, me, at)) closeness.set(other, clamp((closeness.get(other) || 0) + delta));
  }
  const ties = new Set();
  for (const [other, value] of closeness) if (other !== me && value >= CLOSE_LINE) ties.add(other);
  return ties;
}

/** The events named by, or tagged on, a live post at or before `at`. */
async function publicEventIds(db, showId, events, at) {
  if (!events.length) return new Set();
  const { postOrderSql } = require('./storyClock');
  const [posts] = await db.sequelize.query(
    `SELECT fp.event_id, fp.content_text, fp.trending_topic FROM feed_posts fp
      WHERE fp.show_id = :showId AND fp.status = 'live' AND fp.deleted_at IS NULL AND ${postOrderSql('fp')} <= :at`,
    { replacements: { showId, at } });
  const known = new Set();
  for (const post of posts) {
    if (post.event_id) known.add(String(post.event_id));
    for (const ev of namedIn(`${post.content_text || ''}\n${post.trending_topic || ''}`, events)) known.add(ev.id);
  }
  return known;
}

/** The events whose names appear in a text. */
function namedIn(text, events) {
  const { mentions } = require('./pulseGate');
  return events.filter((ev) => ev.name && mentions(text, ev.name));
}

/** The events a Feed profile knows at story order `at`, and how. */
async function knowsAt(db, showId, profileId, at, { lalaProfileId, events } = {}) {
  const { orderOf } = require('./storyClock');
  const list = events || await showEvents(db, showId);
  const lalaId = lalaProfileId !== undefined ? lalaProfileId : await require('./lalaFeedProfile').lalaProfileId(db.sequelize);
  const me = Number(profileId);
  const isLala = lalaId != null && me === Number(lalaId);
  const ties = await closeTies(db, me, { showId, at });
  const knows = new Map();
  for (const ev of list) {
    if (ev.episode_number == null) continue;
    const there = isLala || ev.guests.has(me);
    if (there && at >= orderOf(ev.episode_number, 'during_episode')) { knows.set(ev.id, 'there'); continue; }
    const witnesses = [...ev.guests, ...(lalaId != null ? [Number(lalaId)] : [])];
    if (at >= orderOf(ev.episode_number, 'after_episode') && witnesses.some((w) => ties.has(w))) knows.set(ev.id, 'told');
  }
  for (const id of await publicEventIds(db, showId, list, at)) if (!knows.has(id)) knows.set(id, 'public');
  return knows;
}

/** The events a draft names, already happened by its story order, that its poster does not know. */
async function unknownMentions(db, post, { lalaProfileId, events } = {}) {
  const at = Number.isInteger(post.story_order) ? post.story_order : null;
  if (at === null || !post.social_profile_id) return [];
  const list = events || await showEvents(db, post.show_id);
  const { orderOf } = require('./storyClock');
  const named = namedIn(`${post.content_text || ''}\n${post.trending_topic || ''}`, list)
    .filter((ev) => ev.episode_number != null && orderOf(ev.episode_number, 'during_episode') <= at);
  if (!named.length) return [];
  const knows = await knowsAt(db, post.show_id, post.social_profile_id, at, { lalaProfileId, events: list });
  return named.filter((ev) => !knows.has(ev.id));
}

/** One line for the drafter: what this poster knows at the moment, or null. */
async function knowledgeLine(db, showId, profileId, at, opts = {}) {
  if (!Number.isInteger(at) || !profileId) return null;
  const list = opts.events || await showEvents(db, showId);
  const knows = await knowsAt(db, showId, profileId, at, { ...opts, events: list });
  const HOW = { there: 'you were there', told: 'a close friend told you', public: 'it was posted' };
  const known = list.filter((ev) => knows.has(ev.id)).map((ev) => `${ev.name} (${HOW[knows.get(ev.id)]})`);
  return known.length ? known.join('; ') : null;
}

const MAX_PRIVATE = 8;          // relationships' knowledge in one prompt
const MAX_PRIVATE_TEXT = 300;   // characters of each

/**
 * What a character privately knows about the people in their confirmed
 * relationships (Task #3088; Evoni, 2026-10-13: "Use 'knows' as private
 * drafting context"): character_relationships.source_knows when they are
 * character_id_a, target_knows when they are character_id_b, never
 * reader_knows (the audience's knowledge). Returns [{ person, knows }].
 * Knowing it never authorizes posting it: the drafter keeps it PRIVATE and
 * the gate sends a draft that quotes it to Review. The secret and rumoured
 * relationships they know of come last, each saying it is not to be posted.
 */
async function privateKnowledge(db, characterId) {
  if (!characterId) return [];
  const [rows] = await db.sequelize.query(
    `SELECT CASE WHEN cr.character_id_a = :id THEN rb.display_name ELSE ra.display_name END AS person,
            CASE WHEN cr.character_id_a = :id THEN cr.source_knows ELSE cr.target_knows END AS knows
       FROM character_relationships cr
       JOIN registry_characters ra ON ra.id = cr.character_id_a AND ra.deleted_at IS NULL
       JOIN registry_characters rb ON rb.id = cr.character_id_b AND rb.deleted_at IS NULL
      WHERE cr.confirmed = true AND (cr.character_id_a = :id OR cr.character_id_b = :id)
      ORDER BY cr.created_at ASC`, { replacements: { id: characterId } });
  const notes = rows
    .map((r) => ({ person: r.person || 'someone', knows: String(r.knows || '').replace(/\s+/g, ' ').trim().slice(0, MAX_PRIVATE_TEXT) }))
    .filter((r) => r.knows)
    .slice(0, MAX_PRIVATE);
  // The secret and rumoured relationships they know of (services/relationshipKnowers,
  // 2026-10-23), so a post never gives a secret romance away.
  return [...notes, ...await require('./relationshipKnowers').secretsKnownBy(db.sequelize, characterId)];
}

module.exports = { CLOSE_LINE, showEvents, closeTies, publicEventIds, namedIn, knowsAt, unknownMentions, knowledgeLine, privateKnowledge };
