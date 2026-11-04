'use strict';

/**
 * What the story needs, for "Make one for me" on The Cast (Task #3200; the
 * cast read §7, docs/reads/2026-10-14-cast-generator-read.md). Reads only;
 * no AI call. Each gap is { kind, label }, the label a short sentence the
 * proposal's reason can name ("No one in Maverick Harbor").
 *
 *   archetype   Society archetypes no LalaVerse profile has
 *               (services/societyArchetypes: the saved list and its counts)
 *   city        Dream Cities no LalaVerse profile lives in (utils/feedCities)
 *   thread      the show's open story threads (services/storyThreadService)
 *   storyline   Pulse storylines, planned or running, with no beat yet, so
 *               no one posts them
 *   event       the next event Lala is going to, with no host or few guests
 *               (services/feedSidebar's upcoming events)
 *
 * Fail-soft, like the readers it uses: a reader that fails logs and its
 * gaps are left out, so a proposal is never blocked by one.
 */

const PER_KIND = 3;
const FEW_GUESTS = 3;

async function softly(kind, fn) {
  try {
    return (await fn()) || [];
  } catch (err) {
    console.error(`[castStoryGaps] the ${kind} gaps could not be read:`, err.message);
    return [];
  }
}

async function archetypeGaps(db) {
  const { loadSocietyArchetypes, societyArchetypeCounts } = require('./societyArchetypes');
  const list = await loadSocietyArchetypes(db);
  const counts = await societyArchetypeCounts(db);
  return list.filter((a) => !counts[a.name])
    .slice(0, PER_KIND)
    .map((a) => ({ kind: 'archetype', label: `No one on The Pulse is ${a.name} yet` }));
}

async function cityGaps(db) {
  const { DREAM_CITIES } = require('../utils/lalaHome');
  const { DREAM_CITY_KEYS } = require('../utils/feedCities');
  const [rows] = await db.sequelize.query(
    `SELECT city, COUNT(*)::int AS n FROM social_profiles
      WHERE feed_layer = 'lalaverse' AND deleted_at IS NULL AND city IS NOT NULL
      GROUP BY city`);
  const lived = new Set(rows.filter((r) => r.n > 0).map((r) => r.city));
  return DREAM_CITY_KEYS
    .map((key, i) => ({ key, name: DREAM_CITIES[i] }))
    .filter((c) => !lived.has(c.key))
    .map((c) => ({ kind: 'city', label: `No one lives in ${c.name}` }));
}

async function threadGaps(db, showId) {
  if (!showId) return [];
  const { listThreads } = require('./storyThreadService');
  const threads = await listThreads(db.sequelize, showId);
  return threads.filter((t) => t.status !== 'closed' && t.title)
    .slice(0, PER_KIND)
    .map((t) => ({ kind: 'thread', label: `The story thread "${t.title}" is still open` }));
}

async function storylineGaps(db, showId) {
  if (!showId) return [];
  const [rows] = await db.sequelize.query(
    `SELECT s.title FROM pulse_storylines s
      WHERE s.show_id = :showId AND s.deleted_at IS NULL AND s.status IN ('planned', 'running')
        AND NOT EXISTS (SELECT 1 FROM pulse_storyline_beats b WHERE b.storyline_id = s.id AND b.deleted_at IS NULL)
      ORDER BY s.created_at DESC LIMIT :n`,
    { replacements: { showId, n: PER_KIND } });
  return rows.filter((r) => r.title)
    .map((r) => ({ kind: 'storyline', label: `The storyline "${r.title}" has no face yet` }));
}

async function eventGaps(db, showId) {
  if (!showId) return [];
  const { getFeedSidebar } = require('./feedSidebar');
  const next = (await getFeedSidebar(db, showId)).upcoming.find((ev) => !ev.teaser);
  if (!next) return [];
  const [rows] = await db.sequelize.query(
    'SELECT source_profile_id, canon_consequences FROM world_events WHERE id = :id', { replacements: { id: next.id } });
  const { eventCreatorOrganizer } = require('../utils/eventOrganizer');
  const gaps = [];
  if (rows[0] && !eventCreatorOrganizer(rows[0])) gaps.push({ kind: 'event', label: `The next event, ${next.name}, has no host` });
  if ((next.guest_count || 0) < FEW_GUESTS) {
    gaps.push({ kind: 'event', label: `The next event, ${next.name}, has ${next.guest_count ? `only ${next.guest_count} guest${next.guest_count === 1 ? '' : 's'}` : 'no guests'}` });
  }
  return gaps;
}

/** What the story needs, gap by gap, for the show the registry belongs to. LalaVerse only: Book 1 has no Pulse. */
async function castStoryGaps(db, { showId = null } = {}) {
  const parts = await Promise.all([
    softly('archetype', () => archetypeGaps(db)),
    softly('city', () => cityGaps(db)),
    softly('thread', () => threadGaps(db, showId)),
    softly('storyline', () => storylineGaps(db, showId)),
    softly('event', () => eventGaps(db, showId)),
  ]);
  return parts.flat();
}

module.exports = { castStoryGaps, PER_KIND, FEW_GUESTS };
