'use strict';

/**
 * The Scene Brief (ruling S1, Evoni 2026-09-30; docs/EVENT_EPISODE_FLOW.md
 * §8(dd)):
 *
 *   "Every scene image is generated from one Scene Brief with three layers:
 *   the place (permanent: the World Location's architecture, materials,
 *   layout, equipment, approved reference images, and its district for
 *   neighbourhood and window views; map display colours never recolour
 *   buildings); the event (temporary: the explicitly chosen event's concept,
 *   activity setup, colours as décor and props); the shot (camera, required
 *   visible features, clear space for character overlays). Environment
 *   (time, weather, season) applies throughout. No people are generated."
 *
 * A brief is plain data: { version, scene_set_id, world_location_id,
 * event_id, angle, lines, rules, missing }. Each line is
 *   { layer: 'place' | 'event' | 'shot' | 'environment', key, label, text,
 *     source: 'venue' | 'event' | 'look' | 'override', essential }
 * so S2 can show it before a paid generation, each line labelled "From
 * venue", "From event", "From venue look" (L1) or "Your override", with
 * missing essentials flagged.
 * briefToPrompt turns it into the one prompt every scene image path sends.
 *
 * What it reads, and what it never reads:
 *   - the place: the scene set (its name, description, room properties,
 *     anchor objects, time of day, season, style reference) and its World
 *     Location (style_guide architecture, materials, flooring, ceiling,
 *     lighting, palette as the building's own colours; venue_type,
 *     property_type, venue_details; district and city, and a parent's when
 *     its own are empty). A room inherits its property's style guide
 *     (propertyService.getEffectiveStyleGuide). Map display colours are
 *     frontend styling only and are never read.
 *   - the event: only the event passed explicitly (eventId); never the first
 *     event linked to the set. Its theme, description, format, mood and
 *     colour palette (as décor and props, never the building).
 *   - the shot: a camera for the angle (no lighting in it: lighting comes
 *     from the place and the environment), the required visible features,
 *     clear space for character overlays.
 *   - the environment: time of day (the event's time, else the set's),
 *     season (the event's date, else the set's), weather (an override only;
 *     nothing stores it yet).
 *   - overrides: { <key>: text } replaces a line (source 'override'); an
 *     empty text removes it.
 *
 * Event dressing (ruling S6, Evoni 2026-09-30, with her answers of
 * 2026-10-01): "A recurring location keeps one approved permanent base
 * image; event-dressed versions are made from it, so the place stays
 * recognisable across episodes." and "Event-dressed versions are made by
 * editing the approved base with only the event layer, using Flux Kontext
 * by default, priced and shown in the brief." When the location has an
 * approved base, an event is chosen, and the brief is for another set's
 * base (WIDE), the brief's mode is 'event_dressing': it names the approved
 * base, and its prompt sends only the event layer, as an edit of that
 * image. Otherwise the mode is 'full'.
 */

const { readVenueLook, hasLookContent } = require('./venueLookService');

const BRIEF_VERSION = 1;
const MODES = Object.freeze(['full', 'event_dressing']);

// The edit a dressed version asks of the approved base (S6): the place
// stays as it is; only the event layer is added.
const DRESSING_KEEP = 'Edit this photograph of the place. Keep the place exactly as it is: the same architecture, walls, floor, windows, furniture, layout, lighting and camera. Add only the event dressing below.';
const DRESSING_END = 'Change nothing else.';
const SOURCES = Object.freeze(['venue', 'event', 'look', 'override']);
const LAYERS = Object.freeze(['place', 'event', 'shot', 'environment']);

// "No people are generated." Always first in the prompt.
const BRIEF_RULES = Object.freeze([
  'An empty space with no people: no person, figure, silhouette, face, hands or reflection of a person.',
  'No text, labels, logos, signage text or watermarks.',
]);

// The camera for each angle: framing only, no lighting (S1, S4).
const SHOT_CAMERAS = Object.freeze({
  WIDE: 'Wide establishing shot of the whole space from corner to corner, ceiling, floor and walls in view.',
  CLOSET: 'Camera facing the wardrobe area: full-height rails, shelving and accessories, the full depth of the closet.',
  VANITY: 'Camera at the vanity or dressing table: the full mirror, its surface and the wall around it.',
  WINDOW: 'Camera facing the window wall: the full window, the wall around it, and the view beyond the glass.',
  DOORWAY: 'Camera at the doorway looking in: the full door frame and the room revealed from the threshold.',
  ESTABLISHING: 'Grand establishing shot from far back: the full facade, entrance or interior, with the approach.',
  ACTION: 'Slightly asymmetric, dynamic composition that follows the flow of the space.',
  CLOSE: 'Close-up on a signature surface or detail: texture, material and craftsmanship.',
  OVERHEAD: 'High overhead angle looking down: the whole layout and floor pattern.',
  OTHER: 'A composition suited to this place.',
});

// Where the clear space for character overlays sits, by angle.
const OVERLAY_SPACE = Object.freeze({
  WIDE: 'the centre foreground',
  ESTABLISHING: 'the centre foreground',
  DOORWAY: 'the centre of the room beyond the threshold',
  CLOSE: 'one side of the frame',
  OVERHEAD: 'the centre of the floor',
});

const TIME_LIGHT = Object.freeze({
  morning: 'Morning, with soft early daylight.',
  afternoon: 'Afternoon, with bright, even daylight.',
  golden_hour: 'Golden hour, with low warm sun and long shadows.',
  evening: 'Evening, with interior lamps lit and the last daylight outside.',
  night: 'Night, lit by the place\'s own lamps and fixtures, dark outside.',
});

const SEASON_TEXT = Object.freeze({
  spring: 'Spring.',
  summer: 'Summer.',
  fall: 'Autumn.',
  winter: 'Winter.',
});

const ROOM_SIZE = { compact: 'compact', medium: 'medium-sized', spacious: 'spacious', grand: 'grand and expansive' };
const CEILING = { tall: 'tall ceilings', vaulted: 'vaulted ceilings', double_height: 'double-height ceilings' };
const SHAPE = { square: 'a square layout', l_shaped: 'an L-shaped layout', open_plan: 'an open-plan layout' };

const clean = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
const sentence = (t) => {
  const s = clean(t);
  if (!s) return '';
  return /[.!?]$/.test(s) ? s : `${s}.`;
};
const listText = (v) => (Array.isArray(v) ? v.map(clean).filter(Boolean).join(', ') : clean(v));

function parseJson(value, fallback) {
  if (value == null) return fallback;
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch (err) {
    console.error('[SceneBrief] stored JSON parse failed:', err.message);
    return fallback;
  }
}

function materialsText(materials) {
  if (!materials || typeof materials !== 'object') return clean(materials);
  const parts = [];
  if (materials.hardware) parts.push(`${materials.hardware} hardware`);
  if (materials.stone) parts.push(`${materials.stone} stone`);
  if (materials.wood) parts.push(`${materials.wood} wood`);
  if (materials.metal) parts.push(`${materials.metal} metal fixtures`);
  for (const [k, v] of Object.entries(materials)) {
    if (!['hardware', 'stone', 'wood', 'metal'].includes(k) && v) parts.push(`${v} ${k.replace(/_/g, ' ')}`);
  }
  return parts.join(', ');
}

/** Bucket an event time ("19:30", "7:30 PM") into a time of day key, or null. */
function timeOfDayFromEventTime(eventTime) {
  const m = String(eventTime || '').trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ampm = (m[3] || '').toLowerCase();
  if (ampm === 'pm' && h < 12) h += 12;
  if (ampm === 'am' && h === 12) h = 0;
  if (h < 5) return 'night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 19) return 'golden_hour';
  if (h < 22) return 'evening';
  return 'night';
}

/** Northern-hemisphere season of an event date, or null. */
function seasonFromDate(date) {
  const d = date ? new Date(date) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const month = d.getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return 'spring';
  if (month >= 6 && month <= 8) return 'summer';
  if (month >= 9 && month <= 11) return 'fall';
  return 'winter';
}

/**
 * Build the brief. Pure.
 *   sceneSet:        the scene set (required)
 *   location:        its World Location, with `effective_style_guide` and
 *                    `parent` ({ district, city, name }) when loaded
 *   event:           the explicitly chosen event, or null
 *   angleLabel:      WIDE, CLOSET, ...
 *   cameraDirection: a custom camera direction for the angle
 *   requiredFeatures: text naming what must be visible (spec constraints
 *                    or anchor objects)
 *   continuity:      true for an angle made from the set's base image
 *   overrides:       { <key>: text }
 */
function buildSceneBrief({
  sceneSet, location = null, event = null, angleLabel = 'WIDE', cameraDirection = null,
  requiredFeatures = null, continuity = false, overrides = {}, lookDressing = false,
} = {}) {
  const set = sceneSet || {};
  const angle = String(angleLabel || 'WIDE').toUpperCase();
  const lines = [];
  const add = (layer, key, label, text, source, essential = false) => {
    lines.push({ layer, key, label, text: clean(text), source, essential });
  };

  // ── The place (permanent) ──
  const guide = location?.effective_style_guide || parseJson(location?.style_guide, null) || {};
  const placeType = clean(location?.venue_type || location?.property_type || '').replace(/_/g, ' ');
  add('place', 'identity', 'Place', sentence(`${clean(set.name || location?.name || 'The place')}${placeType ? `, ${/^[aeiou]/i.test(placeType) ? 'an' : 'a'} ${placeType}` : ''}`), 'venue', true);
  add('place', 'description', 'Description', sentence(set.canonical_description || location?.description), 'venue', true);
  if (guide.architecture) add('place', 'architecture', 'Architecture', sentence(`Architecture: ${listText(guide.architecture)}`), 'venue');
  const materials = materialsText(guide.materials);
  if (materials) add('place', 'materials', 'Materials', sentence(`Materials: ${materials}`), 'venue');
  if (guide.flooring) add('place', 'flooring', 'Flooring', sentence(`Flooring: ${listText(guide.flooring)}`), 'venue');
  if (guide.ceiling) add('place', 'ceiling', 'Ceiling', sentence(`Ceiling: ${listText(guide.ceiling)}`), 'venue');
  if (Array.isArray(guide.palette) && guide.palette.length) {
    add('place', 'building_colours', 'Building colours', sentence(`The building's own colours: ${listText(guide.palette.slice(0, 4))}`), 'venue');
  }
  const rp = parseJson(set.visual_language, {})?.room_properties || {};
  const layoutParts = [ROOM_SIZE[rp.room_size] ? `${ROOM_SIZE[rp.room_size]} space` : null,
    CEILING[rp.ceiling_height] || null, SHAPE[rp.room_shape] || null].filter(Boolean);
  const floorPlan = parseJson(location?.floor_plan, null);
  if (floorPlan?.description) layoutParts.push(clean(floorPlan.description));
  if (layoutParts.length) add('place', 'layout', 'Layout', sentence(`Layout: ${layoutParts.join(', ')}`), 'venue');
  const details = parseJson(location?.venue_details, {}) || {};
  const equipment = guide.equipment || details.equipment;
  if (equipment) add('place', 'equipment', 'Equipment', sentence(`Equipment and fixtures: ${listText(equipment)}`), 'venue');
  if (guide.lighting) add('place', 'lighting', 'Lighting', sentence(`Lighting fixtures: ${listText(guide.lighting)}`), 'venue');
  const district = clean(location?.district || location?.parent?.district);
  const city = clean(location?.city || location?.parent?.city);
  if (district || city) {
    add('place', 'surroundings', 'Neighbourhood', sentence(`Outside, through windows and doorways: ${[district, city].filter(Boolean).join(', ')}`), 'venue');
  }
  if (set.style_reference_url) add('place', 'reference', 'Reference image', 'Match the reference image\'s materials and palette.', 'venue');

  // ── The event (temporary; only the event chosen explicitly) ──
  // With an Event Venue Look (L1; Evoni's answers Q3 and Q4, 2026-10-02),
  // the look replaces the theme, mood and colours in the brief: "the look
  // replaces them in the brief; they stay only as inputs for drafting the
  // look." Its lighting replaces the time line, falling back to event_time
  // when it is empty.
  const look = event ? readVenueLook(event.venue_look) : null;
  if (event && hasLookContent(look)) {
    const name = clean(event.name);
    const lead = look.overall || (event.description ? clean(event.description).split(/(?<=[.!?])\s/)[0] : '');
    add('event', 'concept', 'Event', sentence(`Dressed for ${name || 'the event'}${lead ? `: ${lead}` : ''}`), look.overall ? 'look' : 'event', true);
    if (event.format) add('event', 'setup', 'Activity setup', sentence(`Set up for a ${String(event.format).replace(/_/g, ' ')}`), 'event');
    if (look.decor) add('event', 'decor', 'Décor and colours', sentence(`Décor and colours, only in décor and props, never on the building: ${look.decor}`), 'look');
    if (look.areas.length) add('event', 'areas', 'Event areas', sentence(`Event areas: ${listText(look.areas)}`), 'look');
    if (look.signage) add('event', 'signage', 'Signage', sentence(`Signage shapes, with no readable text: ${look.signage}`), 'look');
    if (look.must_include) add('event', 'must_include', 'Must include', sentence(`Must include: ${look.must_include}`), 'look');
    if (look.must_avoid) add('event', 'must_avoid', 'Must avoid', sentence(`Must avoid: ${look.must_avoid}`), 'look');
  } else if (event) {
    const concept = [clean(event.name), clean(event.theme) && `themed "${clean(event.theme)}"`].filter(Boolean).join(', ');
    add('event', 'concept', 'Event', sentence(`Dressed for ${concept || 'the event'}${event.description ? `: ${clean(event.description).split(/(?<=[.!?])\s/)[0]}` : ''}`), 'event', true);
    if (event.format) add('event', 'setup', 'Activity setup', sentence(`Set up for a ${String(event.format).replace(/_/g, ' ')}`), 'event');
    const palette = parseJson(event.color_palette, null);
    const colours = Array.isArray(palette) ? listText(palette.slice(0, 4)) : clean(palette);
    if (colours) add('event', 'decor_colours', 'Décor colours', sentence(`The event's colours appear only in décor and props (flowers, linens, signage shapes, balloons), never on the building: ${colours}`), 'event');
    if (event.mood) add('event', 'mood', 'Mood', sentence(`Mood: ${clean(event.mood)}`), 'event');
  }

  // ── The shot ──
  add('shot', 'camera', 'Camera', sentence(cameraDirection || SHOT_CAMERAS[angle] || SHOT_CAMERAS.WIDE), 'venue', true);
  if (requiredFeatures) add('shot', 'required_features', 'Must be visible', sentence(requiredFeatures), 'venue');
  if (continuity) add('shot', 'continuity', 'Continuity', 'The same room as the reference image: same walls, furniture and decor; only the camera moved.', 'venue');
  add('shot', 'overlay_space', 'Space for characters', sentence(`Leave clear, uncluttered floor space in ${OVERLAY_SPACE[angle] || 'the centre of the frame'} for character overlays`), 'venue');

  // ── The environment ──
  const eventTime = event ? timeOfDayFromEventTime(event.event_time) : null;
  const timeKey = eventTime || set.time_of_day || null;
  if (look?.lighting) add('environment', 'time', 'Lighting and time', sentence(look.lighting), 'look', true);
  else if (timeKey && TIME_LIGHT[timeKey]) add('environment', 'time', 'Time of day', TIME_LIGHT[timeKey], eventTime ? 'event' : 'venue', true);
  else add('environment', 'time', 'Time of day', '', 'venue', true);
  const eventSeason = event ? seasonFromDate(event.event_date) : null;
  const seasonKey = eventSeason || set.season || null;
  if (seasonKey && SEASON_TEXT[seasonKey]) add('environment', 'season', 'Season', SEASON_TEXT[seasonKey], eventSeason ? 'event' : 'venue');

  // ── Overrides ──
  const over = overrides && typeof overrides === 'object' ? overrides : {};
  for (const [key, value] of Object.entries(over)) {
    const text = clean(value);
    const existing = lines.find((l) => l.key === key);
    if (existing) {
      existing.text = text ? sentence(text) : '';
      existing.source = 'override';
    } else if (text) {
      const layer = key === 'weather' ? 'environment' : 'place';
      add(layer, key, key === 'weather' ? 'Weather' : key.replace(/_/g, ' '), sentence(text), 'override');
    }
  }

  const kept = lines.filter((l) => l.text || l.essential);
  const missing = kept.filter((l) => l.essential && !l.text).map((l) => ({ layer: l.layer, key: l.key, label: l.label }));
  if (!location) missing.unshift({ layer: 'place', key: 'world_location', label: 'World Location' });

  // S6: an event-dressed version of the location's approved base. An
  // event's look (L7-L9; answer 2, §8(hh)) is always a dressing of the
  // approved base, on any set at the venue, the approved set included: it
  // is written to the event's look, never to the set's base.
  const dressing = lookDressing
    ? Boolean(location?.approved_base_image_url && event)
    : Boolean(
      location?.approved_base_image_url && event && angle === 'WIDE' && !continuity
      && (!set.id || set.id !== location.approved_base_scene_set_id)
    );

  return {
    version: BRIEF_VERSION,
    scene_set_id: set.id || null,
    world_location_id: location?.id || set.world_location_id || null,
    event_id: event?.id || null,
    angle,
    mode: dressing ? 'event_dressing' : 'full',
    approved_base: dressing
      ? { scene_set_id: location.approved_base_scene_set_id || null, image_url: location.approved_base_image_url }
      : null,
    lines: kept,
    rules: [...BRIEF_RULES],
    missing,
    overrides: Object.fromEntries(Object.entries(over).map(([k, v]) => [k, clean(v)])),
  };
}

// S2: the "Your override" lines the person set on the brief they were shown:
// { <brief line key>: text }; an empty text removes the line. { value } when
// absent (null) or valid, { error } otherwise. Used by the scene-set routes
// and venue generation (S5).
const BRIEF_OVERRIDE_MAX_KEYS = 40;
const BRIEF_OVERRIDE_MAX_LEN = 1000;
function readBriefOverrides(raw) {
  if (raw === undefined || raw === null) return { value: null };
  if (typeof raw !== 'object' || Array.isArray(raw)) return { error: 'overrides must be an object of { line key: text }' };
  const entries = Object.entries(raw);
  if (entries.length > BRIEF_OVERRIDE_MAX_KEYS) return { error: `at most ${BRIEF_OVERRIDE_MAX_KEYS} overrides` };
  const value = {};
  for (const [key, text] of entries) {
    if (!/^[a-z0-9_.-]{1,64}$/i.test(key)) return { error: `override key "${key}" is not a brief line key` };
    if (text !== null && typeof text !== 'string') return { error: `override "${key}" must be text` };
    const t = String(text ?? '');
    if (t.length > BRIEF_OVERRIDE_MAX_LEN) return { error: `override "${key}" must be at most ${BRIEF_OVERRIDE_MAX_LEN} characters` };
    value[key] = t;
  }
  return { value };
}

/**
 * The prompt a brief sends: the rules, then the place, event, shot and
 * environment. An event-dressed version (S6) sends the rules and only the
 * event layer, as an edit of the approved base.
 */
function briefToPrompt(brief) {
  const byLayer = (layer) => (brief?.lines || []).filter((l) => l.layer === layer && l.text).map((l) => l.text);
  if (brief?.mode === 'event_dressing') {
    return [...(brief.rules || BRIEF_RULES), DRESSING_KEEP, ...byLayer('event'), DRESSING_END]
      .join(' ').replace(/\s+/g, ' ').trim();
  }
  const parts = [
    ...(brief?.rules || BRIEF_RULES),
    ...byLayer('place'),
    ...byLayer('event'),
    ...byLayer('shot'),
    ...byLayer('environment'),
    'Photorealistic.',
  ];
  const full = parts.join(' ').replace(/\s+/g, ' ').trim();
  return full.length > 3500 ? `${full.slice(0, 3497)}...` : full;
}

/** The World Location of a scene set, with its effective style guide and parent; null without one. */
async function loadBriefLocation(sequelize, worldLocationId, { transaction } = {}) {
  if (!worldLocationId) return null;
  const [rows] = await sequelize.query(
    `SELECT id, name, description, location_type, parent_location_id, city, district, venue_type, venue_details,
            style_guide, floor_plan, property_type, approved_base_scene_set_id, approved_base_image_url
       FROM world_locations WHERE id = :id AND deleted_at IS NULL LIMIT 1`,
    { replacements: { id: worldLocationId }, transaction }
  );
  const location = rows?.[0];
  if (!location) return null;
  let parent = null;
  if (location.parent_location_id) {
    const [parents] = await sequelize.query(
      `SELECT id, name, city, district, style_guide FROM world_locations
        WHERE id = :id AND deleted_at IS NULL LIMIT 1`,
      { replacements: { id: location.parent_location_id }, transaction }
    );
    parent = parents?.[0] || null;
  }
  const { getEffectiveStyleGuide } = require('./propertyService');
  return {
    ...location,
    parent,
    effective_style_guide: getEffectiveStyleGuide(
      { style_guide: parseJson(location.style_guide, {}) },
      parent ? { style_guide: parseJson(parent.style_guide, {}) } : null
    ),
  };
}

/** The event chosen explicitly, in the scene set's show; null without one. */
async function loadBriefEvent(sequelize, eventId, showId, { transaction } = {}) {
  if (!eventId) return null;
  const [rows] = await sequelize.query(
    `SELECT id, show_id, name, description, theme, format, mood, color_palette, event_time, event_date, venue_look
       FROM world_events WHERE id = :id AND deleted_at IS NULL LIMIT 1`,
    { replacements: { id: eventId }, transaction }
  );
  const event = rows?.[0] || null;
  if (event && showId && event.show_id && String(event.show_id) !== String(showId)) return null;
  return event;
}

/**
 * The brief for one generation, with its sources loaded:
 *   options: { angleLabel, cameraDirection, requiredFeatures, continuity,
 *              eventId, overrides }
 */
async function prepareSceneBrief(sequelize, sceneSet, options = {}) {
  const location = await loadBriefLocation(sequelize, sceneSet?.world_location_id);
  const event = await loadBriefEvent(sequelize, options.eventId, sceneSet?.show_id);
  return buildSceneBrief({ sceneSet, location, event, ...options });
}

module.exports = {
  BRIEF_VERSION,
  MODES,
  DRESSING_KEEP,
  SOURCES,
  LAYERS,
  BRIEF_RULES,
  SHOT_CAMERAS,
  timeOfDayFromEventTime,
  seasonFromDate,
  buildSceneBrief,
  briefToPrompt,
  loadBriefLocation,
  loadBriefEvent,
  prepareSceneBrief,
  readBriefOverrides,
};
