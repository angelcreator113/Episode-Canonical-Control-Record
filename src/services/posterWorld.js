'use strict';

/**
 * The world a Pulse poster lives in, for the post and message drafters
 * (Evoni, 2026-10-18: "yes start giving the post drafter the world"; the
 * world-level audit found the drafter read no city, home, venue or Show
 * Bible, only "stay in the world").
 *
 *   posterWorldLine(db, profileId)  their DREAM city and its culture, their
 *     home studio and the venues they frequent, as prompt lines ('' when
 *     none is known, or on a failed read, logged). A place they may post
 *     from; never a reason to name it in every post.
 *   posterWorldLines(db, profileId)  the same as bare lines, for the
 *     character file's own heading.
 *   showBible(db, showId, label)  the Show Bible's always-on rules for the
 *     show (brainRules.loadBrainContext): { block, ids }, block null when
 *     there are none. The caller counts the rules it used (recordRuleUse)
 *     once the call succeeds.
 */

const { feedCity, DREAM_CITY_CULTURE } = require('../utils/feedCities');

const cityName = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
const MAX_VENUES = 3;

/** The lines of their world (no heading): [] when none is known, or on a failed read (logged). */
async function posterWorldLines(db, profileId) {
  try {
    const [[p]] = await db.sequelize.query(
      'SELECT city, home_location_id, frequent_venues FROM social_profiles WHERE id = :id', { replacements: { id: profileId } });
    if (!p) return [];
    const lines = [];
    const key = feedCity(p.city);
    if (key) lines.push(`They live in ${cityName(key)}, a DREAM city: ${DREAM_CITY_CULTURE[key]}`);
    const ids = [p.home_location_id, ...(Array.isArray(p.frequent_venues) ? p.frequent_venues : [])].filter(Boolean);
    if (ids.length) {
      const [rows] = await db.sequelize.query(
        'SELECT id, name, venue_type FROM world_locations WHERE id IN (:ids) AND deleted_at IS NULL', { replacements: { ids: [...new Set(ids.map(String))] } });
      const byId = new Map(rows.map((r) => [String(r.id), r]));
      const home = p.home_location_id ? byId.get(String(p.home_location_id)) : null;
      if (home) lines.push(`Where they work and create: ${home.name}${home.venue_type && home.venue_type !== 'other' ? ` (${home.venue_type.replace(/_/g, ' ')})` : ''}.`);
      const haunts = ids.slice(1).map((id) => byId.get(String(id))).filter((v) => v && v !== home).slice(0, MAX_VENUES);
      if (haunts.length) lines.push(`Places they go: ${haunts.map((v) => v.name).join(', ')}.`);
    }
    return lines;
  } catch (err) {
    console.error('[posterWorld] their city and places could not be read; drafting without them:', err.message);
    return [];
  }
}

async function posterWorldLine(db, profileId) {
  const lines = await posterWorldLines(db, profileId);
  return lines.length ? `Their world (a post may be set here; it need not name it):\n${lines.map((l) => `- ${l}`).join('\n')}\n` : '';
}

async function showBible(db, showId, label = 'PulseDrafter') {
  const { block, ids } = await require('./brainRules').loadBrainContext(db, { showId, label });
  return { block: block || null, ids };
}

module.exports = { posterWorldLines, posterWorldLine, showBible };
