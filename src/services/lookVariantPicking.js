'use strict';

/**
 * The right picture, automatically (step 4 of
 * docs/VENUE_EVERYDAY_AND_EVENT_LOOKS_PLAN.md). A beat at a location's
 * everyday set shows the everyday look at the beat's time of day, and its
 * Front view in the event's season, when those variants exist
 * (location_look_variants, step 2). A variant the beat calls for that is
 * missing falls back to the plain picture and says so; it never blocks
 * (L5).
 *
 * Evoni, 2026-10-15 (beat times): "Before/after the event": beats 1-9 (home,
 * closet) are just before the event (one step earlier: an evening event,
 * golden hour at home; a morning one stays morning); 10-12 at the event's
 * time; 13-14 (recap, cliffhanger) at night. With no event time, no time
 * variant is called for. The season is the event date's, for exterior
 * (Front) pictures.
 *
 * The event's look (L10) stays first at its set: a beat showing a dressed
 * angle or the event's look is not swapped.
 */

const { timeOfDayFromEventTime, seasonFromDate } = require('./sceneBriefService');

const TIMES = Object.freeze(['morning', 'afternoon', 'golden_hour', 'evening', 'night']);
const LABELS = Object.freeze({
  morning: 'Morning', afternoon: 'Afternoon', golden_hour: 'Golden hour', evening: 'Evening', night: 'Night',
  spring: 'Spring', summer: 'Summer', fall: 'Fall', winter: 'Winter',
});

/** A beat's time of day from the event's: before (1-9) one step earlier, 10-12 the same, after (13-14) night. Pure. */
function beatTimeOfDay(beatNumber, eventTime) {
  const n = Number(beatNumber);
  if (n >= 13) return 'night';
  if (!eventTime || !TIMES.includes(eventTime)) return null;
  if (n >= 10) return eventTime;
  return TIMES[Math.max(0, TIMES.indexOf(eventTime) - 1)];
}

/**
 * The episode's moment: { time, season } from its event's time and date
 * (null each when unknown), or null without an event.
 */
async function episodeMoment(sequelize, episodeId) {
  if (!episodeId) return null;
  const [[event]] = await sequelize.query(
    `SELECT id, event_time, event_date FROM world_events
      WHERE id = ${require('../utils/episodeEventSql').EPISODE_EVENT_ID_SQL}`,
    { replacements: { episodeId } });
  if (!event) return null;
  return { time: timeOfDayFromEventTime(event.event_time), season: seasonFromDate(event.event_date) };
}

/**
 * The complete variants of the locations whose everyday set is one of
 * setIds: Map<setId, { time: Map<value, url>, season: Map<value, url> }>.
 * A set that is no location's everyday set has none. A read that fails
 * (e.g. before the variants migration ran) gives none.
 */
async function variantsForSets(sequelize, setIds) {
  const ids = [...new Set((setIds || []).filter(Boolean))];
  const out = new Map();
  if (!ids.length) return out;
  try {
    const [rows] = await sequelize.query(
      `SELECT l.approved_base_scene_set_id AS set_id, v.kind, v.value, v.image_url
         FROM world_locations l
         JOIN location_look_variants v ON v.world_location_id = l.id AND v.deleted_at IS NULL
        WHERE l.approved_base_scene_set_id IN (:ids) AND l.deleted_at IS NULL
          AND v.status = 'complete' AND v.image_url IS NOT NULL`,
      { replacements: { ids } });
    for (const r of rows) {
      if (!out.has(r.set_id)) out.set(r.set_id, { time: new Map(), season: new Map() });
      out.get(r.set_id)[r.kind]?.set(r.value, r.image_url);
    }
  } catch (err) {
    console.error('[LookVariantPicking] variants read failed:', err.message);
  }
  return out;
}

/**
 * Which variant a beat's picture calls for, and whether it exists. Pure.
 *   picture: { url, source, label } (beatPicture), or null
 *   angleKind: the beat's angle's kind ('front' for the Front view)
 *   everyday: whether the beat's set is its location's everyday set
 * Returns null when no variant applies, else
 *   { kind, value, label, url|null }   url null: the variant is missing
 */
function variantFor({ picture, angleKind, everyday, variants, beatNumber, moment }) {
  if (!picture || !everyday || !moment) return null;
  if (picture.source === 'base') {
    const time = beatTimeOfDay(beatNumber, moment.time);
    if (!time) return null;
    return { kind: 'time', value: time, label: LABELS[time], url: variants?.time.get(time) || null };
  }
  if (picture.source === 'angle' && angleKind === 'front' && moment.season) {
    const season = moment.season;
    return { kind: 'season', value: season, label: LABELS[season], url: variants?.season.get(season) || null };
  }
  return null;
}

/**
 * The picture with its variant applied: the variant's image and a label
 * naming it, or the plain picture marked with what is missing. Pure.
 */
function applyVariant(picture, variant, setName) {
  if (!picture || !variant) return picture;
  const name = setName || 'Scene set';
  if (variant.url) {
    return { ...picture, url: variant.url, source: `variant_${variant.kind}`, plain_url: picture.url, label: `${picture.label} · ${variant.label}` };
  }
  // The pages show the label, so the gap is named there (never blocking, L5).
  return {
    ...picture,
    label: `${picture.label} (no ${variant.label} ${variant.kind === 'time' ? 'variant' : 'season'} yet)`,
    variant_missing: { kind: variant.kind, value: variant.value, label: variant.label, text: `${name} has no ${variant.label} ${variant.kind === 'time' ? 'variant' : 'season'} yet` },
  };
}

module.exports = {
  TIMES,
  beatTimeOfDay,
  episodeMoment,
  variantsForSets,
  variantFor,
  applyVariant,
};
