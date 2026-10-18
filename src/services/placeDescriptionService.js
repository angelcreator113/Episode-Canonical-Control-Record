'use strict';

/**
 * A character's place described from their profile (Evoni, 2026-10-17:
 * "when creating the description for the characters homes can we use the
 * information from their profiles? like what dream city they live in, what
 * price range"). Their Home, Closet and Place of work cards on the Places
 * tab get "Write from their profile".
 *
 *   describePlace(db, { characterId, sceneSetId, role?, client? })
 *     → { description, used: [{ label, value }], missing: [label],
 *         current: the set's description now, role }
 *
 * What it reads (each part only when the profile has it; a missing one is
 * named in `missing`, never invented):
 *   - the character file (services/characterFile): facts with the home price
 *     range, the mask and what is behind it, the people in their life;
 *   - their DREAM city (social_profiles.city) and its culture
 *     (the saved DREAM city list's words, services/dreamCityText);
 *   - the place's World location, else their home location
 *     (social_profiles.home_location_id): district, street, property type;
 *   - the class they grew up in and are in now (de_money_*);
 *   - their style (aesthetic_dna) and current life (living_context).
 *
 * The gap (Evoni, 2026-10-17: "turn the gap on"): a home or closet whose
 * owner's shown lifestyle (lifestyle_claim) differs from the real one
 * (lifestyle_reality, lifestyle_gap) is described as both: the corner they
 * film in, and the rest as it really is. Always on; with no gap, one honest
 * place.
 *
 * The set must be one of their places (characterPlaceShare
 * placesForCharacter, the list the tab shows): its role is the place's, so
 * the lead's home and closet, which are the show's defaults, are a home and
 * a closet whatever the set's type. `role` picks between two places that are
 * the same set (the lead's home that is also her closet). Sixth audit.
 *
 * Nothing is saved here: the tab shows the text next to the set's own and
 * saves it with PUT /scene-sets/:id when Evoni chooses it.
 */

const MODELS = ['claude-sonnet-4-6'];
const CLIP = 400;
const ROLE_WORDS = { home: 'home', closet: 'closet', work: 'place of work', other: 'place' };

class PlaceDescriptionError extends Error {
  constructor(status, message, code = 'PLACE_DESCRIPTION_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let client = null;
function getClient() {
  if (!client) {
    const Anthropic = require('@anthropic-ai/sdk');
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const clip = (v, max = CLIP) => {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'object' && !Object.keys(v).length) return '';
  const s = (typeof v === 'string' ? v : JSON.stringify(v)).replace(/\s+/g, ' ').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};
const words = (s) => String(s || '').replace(/_/g, ' ');
const CLASS_WORDS = {
  poverty: 'poverty', working_class: 'working class', middle_class: 'middle class',
  upper_middle: 'upper middle class', wealthy: 'wealthy', ultra_wealthy: 'ultra wealthy',
};
const classWord = (v) => CLASS_WORDS[v] || words(v);
const GAP_DIRECTION_WORDS = { up: 'moving up', down: 'moving down' };

/**
 * A JSON field as text, field by field: "colour palette: blush, gold; era
 * aesthetic: 90s". Empty values are left out, so a field with nothing in it
 * is '' (sixth audit: aesthetic_dna with every key null was "used").
 */
function fieldsText(value, max = CLIP) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t.startsWith('{') && !t.startsWith('[')) return clip(t, max);
    try { return fieldsText(JSON.parse(t), max); } catch (err) {
      console.error('[placeDescription] a stored field is not JSON:', err.message);
      return clip(t, max);
    }
  }
  const flat = (v) => {
    if (v === null || v === undefined || v === '' || v === false) return '';
    if (Array.isArray(v)) return v.map(flat).filter(Boolean).join(', ');
    if (typeof v === 'object') {
      return Object.entries(v).map(([k, x]) => {
        const t = flat(x);
        return t ? `${words(k)}: ${t}` : '';
      }).filter(Boolean).join('; ');
    }
    return String(v).trim();
  };
  return clip(flat(value), max);
}

/**
 * The gap between the lifestyle they show and the one they live, or null
 * when there is none to draw.
 */
function gapOf(fp) {
  if (!fp) return null;
  const kind = String(fp.lifestyle_gap || '').trim().toLowerCase();
  const claim = clip(fp.lifestyle_claim);
  const reality = clip(fp.lifestyle_reality);
  if (kind === 'authentic' || (!claim && !reality)) return null;
  if (!kind && (!claim || !reality)) return null;
  return { kind: kind || 'unstated', claim, reality };
}

/** The place, the character and everything the description is written from. */
async function gather(db, { characterId, sceneSetId, role: askedRole = null }) {
  const { validateUUID } = require('../middleware/requestValidation');
  if (!validateUUID(String(characterId || ''))) throw new PlaceDescriptionError(400, 'id must be a character id (UUID)');
  if (!validateUUID(String(sceneSetId || ''))) throw new PlaceDescriptionError(400, 'scene_set_id must be a scene set id (UUID)');

  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new PlaceDescriptionError(404, 'Character not found', 'CHARACTER_NOT_FOUND');
  const { placesForCharacter } = require('./characterPlaceShare');
  const { places } = await placesForCharacter(db.sequelize, characterId);
  const theirs = places.filter((p) => String(p.scene_set_id) === String(sceneSetId));
  const mine = theirs.find((p) => p.role === askedRole) || theirs[0];
  if (!mine) throw new PlaceDescriptionError(404, 'That set is not one of their places', 'PLACE_NOT_FOUND');
  const role = mine.role;
  const [[place]] = await db.sequelize.query(
    `SELECT id, name, scene_type, canonical_description, world_location_id
       FROM scene_sets WHERE id = :sceneSetId AND deleted_at IS NULL`,
    { replacements: { sceneSetId } });
  if (!place) throw new PlaceDescriptionError(404, 'Scene set not found', 'SCENE_SET_NOT_FOUND');

  const { loadCharacterFile } = require('./characterFile');
  const file = await loadCharacterFile(db, { character });
  const fp = file.feedProfile;

  let location = null;
  // A closet is in the home: with no location of its own, the home's.
  const locationId = place.world_location_id || (role === 'home' || role === 'closet' ? fp?.home_location_id : null);
  if (locationId) {
    try {
      const read = async (id) => (await db.sequelize.query(
        `SELECT name, description, city, district, street_address, property_type, location_type, style_guide, parent_location_id
           FROM world_locations WHERE id = :id AND deleted_at IS NULL`, { replacements: { id } }))[0][0] || null;
      location = await read(locationId);
      // Its style guide over its building's, as the Scene Brief reads it.
      if (location) {
        const parent = location.parent_location_id ? await read(location.parent_location_id) : null;
        const json = (v) => (typeof v === 'string' ? JSON.parse(v) : v || {});
        location.style_guide = require('./propertyService').getEffectiveStyleGuide(
          { style_guide: json(location.style_guide) }, parent ? { style_guide: json(parent.style_guide) } : null);
      }
    } catch (err) {
      console.error('[placeDescription] the location could not be read:', err.message);
    }
  }
  return { character: file.character, file, fp, place: { ...place, role }, location };
}

/** The profile's parts the description uses, labelled, and the ones it lacks. */
function readings({ character: c, file, fp, place, location, cityCulture = require('../utils/feedCities').DREAM_CITY_CULTURE }) {
  const used = [];
  const missing = [];
  const add = (label, value, needed = true) => {
    if (value) used.push({ label, value });
    else if (needed) missing.push(label);
  };
  const { feedCity } = require('../utils/feedCities');
  // An old city name is read as its DREAM city (feedCity), as the Feed does.
  const cityKey = fp?.city ? feedCity(fp.city) : null;
  const cityName = cityKey ? require('../utils/lalaHome').dreamCityName(cityKey) : null;
  add('City', cityName || '');
  const lived = place.role === 'home' || place.role === 'closet';
  const where = location
    ? [location.name, location.district, location.street_address, location.property_type && words(location.property_type)].filter(Boolean).join(', ')
    : '';
  add(lived ? 'Home location' : 'Location', where, lived);
  const { isDecided } = require('./characterFacts');
  const rangeSet = isDecided(file.facts, 'home_price_range');
  // The home's price is the home's and the closet's, not a place of work's.
  if (lived) add('Home price range', rangeSet ? file.facts.home_price_range.label : '');
  const origin = c?.de_money_origin_class;
  const now = c?.de_money_current_class;
  add('Class', origin || now ? [origin && `grew up ${classWord(origin)}`, now && `now ${classWord(now)}`].filter(Boolean).join(', ') : '');
  // Only decided facts are "used": the prompt tells the model never to state
  // an undecided one.
  if (isDecided(file.facts, 'occupation')) add('Occupation', file.facts.occupation, false);
  if (file.facts?.affordability && isDecided(file.facts, 'income')) add('Can afford', file.facts.affordability.label, false);
  add('Style', fieldsText(c?.aesthetic_dna, 200));
  add('Current life', fieldsText(c?.living_context, 200), place.role === 'home');
  const gap = lived ? gapOf(fp) : null;
  if (gap) add('Shown vs real', `${words(gap.kind)} gap`, false);
  return { used, missing, gap, lived, cityName, cityCulture: cityKey ? cityCulture[cityKey] || null : null, rangeSet };
}

function buildPrompt(ctx, read) {
  const { character: c, file, place, location } = ctx;
  const name = c?.selected_name || c?.display_name || 'this character';
  const what = ROLE_WORDS[place.role] || 'place';
  const { characterFileBlock } = require('./characterFile');
  const parts = [
    `You are the production designer for "Styling Adventures with Lala", set in the LalaVerse. Write the description of ${name}'s ${what}, the scene set "${place.name}". It is used to generate images of the place, and it is the description every scene there is written from.`,
    characterFileBlock(file),
    read.cityName ? `THEIR CITY: ${read.cityName}.${read.cityCulture ? ` ${read.cityCulture}` : ''} The building and the street outside the windows belong to this city.` : '',
    location ? `THE LOCATION ON THE MAP: ${[location.name, location.district && `district ${location.district}`, location.street_address, location.property_type && `a ${words(location.property_type)}`, location.city].filter(Boolean).join(', ')}.${location.description ? ` ${clip(location.description)}` : ''}${fieldsText(location.style_guide) ? ` Style guide: ${fieldsText(location.style_guide)}` : ''}` : '',
    c?.de_money_origin_class || c?.de_money_current_class ? `CLASS: grew up ${classWord(c.de_money_origin_class) || 'unknown'}; now ${classWord(c.de_money_current_class) || 'unknown'}${GAP_DIRECTION_WORDS[c.de_class_gap_direction] ? ` (${GAP_DIRECTION_WORDS[c.de_class_gap_direction]})` : ''}. Show it in their taste: what they kept, what they bought new, and what they still cannot let go of.${read.rangeSet && read.lived ? ' Class shapes taste, not price: what the home costs is their home price range.' : ''}` : '',
    fieldsText(c?.aesthetic_dna) ? `THEIR STYLE: ${fieldsText(c.aesthetic_dna)}` : '',
    fieldsText(c?.living_context) ? `THEIR LIFE NOW: ${fieldsText(c.living_context)}` : '',
    read.gap ? `THE GAP (draw both, it is the point of the place): what they show the world is "${read.gap.claim || 'a lifestyle beyond their real one'}"; what is true is "${read.gap.reality || 'not what they show'}" (gap: ${words(read.gap.kind)}). Describe the one corner they film in, staged to look like what they show, and the rest of the ${what} as it really is. Name the corner so its angle can be found.${read.gap.kind === 'reversed' ? ' Here it is reversed: the filmed corner is plainer than the rest of the place.' : ''}` : '',
    place.canonical_description ? `THE DESCRIPTION IT HAS NOW (keep what agrees with the profile; change what does not): ${clip(place.canonical_description, 1200)}` : '',
    `Write 4 to 6 sentences: the room's size and shape; wall colours and flooring; key furniture with materials and where it stands; light and its sources; the signature things that make it theirs; the view from the windows${place.role === 'home' ? '; who else lives here, if the profile says so' : ''}.${read.lived ? (read.rangeSet ? ' What the place costs is their home price range: nothing in it costs more or less.' : ' Keep what it costs within what the profile says they can afford.') : ` It is a ${what}, not their home: it costs what such a place costs, not what their home does; their own things in it fit their means.`} Use only what the profile gives; where it gives nothing, keep it plain rather than invent a detail about them. Return only the description, no labels or formatting.`,
  ];
  return parts.filter(Boolean).join('\n\n');
}

async function describePlace(db, { characterId, sceneSetId, role = null, client: injected = null }) {
  if (!injected && !process.env.ANTHROPIC_API_KEY) throw new PlaceDescriptionError(503, 'ANTHROPIC_API_KEY not configured', 'AI_UNAVAILABLE');
  const ctx = await gather(db, { characterId, sceneSetId, role });
  const read = readings({ ...ctx, cityCulture: await require('./dreamCityText').cityCultures(db) });
  const prompt = buildPrompt(ctx, read);
  const ai = injected || getClient();
  let message;
  for (const model of MODELS) {
    try {
      message = await ai.messages.create({ model, max_tokens: 700, messages: [{ role: 'user', content: prompt }] });
      break;
    } catch (modelErr) {
      console.warn(`[placeDescription] describing with ${model} failed:`, modelErr.message);
      if (model === MODELS[MODELS.length - 1]) throw modelErr;
    }
  }
  const description = (message?.content?.[0]?.text || '').trim();
  if (!description) throw new PlaceDescriptionError(502, 'The description came back empty. Try again.', 'EMPTY');
  return {
    description,
    used: read.used,
    missing: read.missing,
    gap: Boolean(read.gap),
    current: ctx.place.canonical_description || null,
    role: ctx.place.role,
  };
}

module.exports = { describePlace, gapOf, fieldsText, PlaceDescriptionError, _buildPrompt: buildPrompt, _readings: readings };
