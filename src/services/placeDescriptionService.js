'use strict';

/**
 * A character's place described from their profile (Evoni, 2026-10-17:
 * "when creating the description for the characters homes can we use the
 * information from their profiles? like what dream city they live in, what
 * price range"). Their Home, Closet and Place of work cards on the Places
 * tab get "Write from their profile".
 *
 *   describePlace(db, { characterId, sceneSetId, client? })
 *     → { description, used: [{ label, value }], missing: [label],
 *         current: the set's description now, role }
 *
 * What it reads (each part only when the profile has it; a missing one is
 * named in `missing`, never invented):
 *   - the character file (services/characterFile): facts with the home price
 *     range, the mask and what is behind it, the people in their life;
 *   - their DREAM city (social_profiles.city) and its culture
 *     (utils/feedCities DREAM_CITY_CULTURE);
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
async function gather(db, { characterId, sceneSetId }) {
  const { validateUUID } = require('../middleware/requestValidation');
  if (!validateUUID(String(characterId || ''))) throw new PlaceDescriptionError(400, 'id must be a character id (UUID)');
  if (!validateUUID(String(sceneSetId || ''))) throw new PlaceDescriptionError(400, 'scene_set_id must be a scene set id (UUID)');

  const character = await db.RegistryCharacter.findByPk(characterId);
  if (!character) throw new PlaceDescriptionError(404, 'Character not found', 'CHARACTER_NOT_FOUND');
  const [[place]] = await db.sequelize.query(
    `SELECT ss.id, ss.name, ss.scene_type, ss.canonical_description, ss.world_location_id, cp.role
       FROM scene_sets ss
       LEFT JOIN character_places cp ON cp.scene_set_id = ss.id AND cp.registry_character_id = :characterId AND cp.deleted_at IS NULL
      WHERE ss.id = :sceneSetId AND ss.deleted_at IS NULL`,
    { replacements: { characterId, sceneSetId } });
  if (!place) throw new PlaceDescriptionError(404, 'Scene set not found', 'SCENE_SET_NOT_FOUND');
  // The lead's home and closet are the show's defaults, not character_places
  // rows (characterPlacesService): a set they link that way is read by type.
  const role = place.role || (place.scene_type === 'CLOSET' ? 'closet' : place.scene_type === 'HOME_BASE' ? 'home' : 'other');

  const { loadCharacterFile } = require('./characterFile');
  const file = await loadCharacterFile(db, { character });
  const fp = file.feedProfile;

  let location = null;
  const locationId = place.world_location_id || (role === 'home' ? fp?.home_location_id : null);
  if (locationId) {
    try {
      const [[row]] = await db.sequelize.query(
        `SELECT name, description, city, district, street_address, property_type, location_type, style_guide
           FROM world_locations WHERE id = :id AND deleted_at IS NULL`, { replacements: { id: locationId } });
      location = row || null;
    } catch (err) {
      console.error('[placeDescription] the location could not be read:', err.message);
    }
  }
  return { character: file.character, file, fp, place: { ...place, role }, location };
}

/** The profile's parts the description uses, labelled, and the ones it lacks. */
function readings({ character: c, file, fp, place, location }) {
  const { DREAM_CITY_CULTURE } = require('../utils/feedCities');
  const used = [];
  const missing = [];
  const add = (label, value, needed = true) => {
    if (value) used.push({ label, value });
    else if (needed) missing.push(label);
  };
  const cityKey = fp?.city ? String(fp.city) : null;
  const cityName = cityKey ? require('../utils/lalaHome').dreamCityName(cityKey) : null;
  add('City', cityName || (cityKey ? words(cityKey) : ''));
  const where = location
    ? [location.name, location.district, location.street_address, location.property_type && words(location.property_type)].filter(Boolean).join(', ')
    : '';
  add(place.role === 'home' ? 'Home location' : 'Location', where, place.role === 'home');
  const range = file.facts?.home_price_range;
  const rangeSet = range && !(file.facts.undecided || []).includes('home_price_range');
  add('Home price range', rangeSet ? range.label : '', place.role !== 'work');
  const origin = c?.de_money_origin_class;
  const now = c?.de_money_current_class;
  add('Class', origin || now ? [origin && `grew up ${classWord(origin)}`, now && `now ${classWord(now)}`].filter(Boolean).join(', ') : '');
  if (file.facts?.occupation) add('Occupation', file.facts.occupation, false);
  if (file.facts?.affordability) add('Can afford', file.facts.affordability.label, false);
  add('Style', clip(c?.aesthetic_dna, 200));
  add('Current life', clip(c?.living_context, 200), place.role === 'home');
  const gap = (place.role === 'home' || place.role === 'closet') ? gapOf(fp) : null;
  if (gap) add('Shown vs real', `${words(gap.kind)} gap`, false);
  return { used, missing, gap, cityName, cityCulture: cityKey ? DREAM_CITY_CULTURE[cityKey] || null : null, rangeSet };
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
    location ? `THE LOCATION ON THE MAP: ${[location.name, location.district && `district ${location.district}`, location.street_address, location.property_type && `a ${words(location.property_type)}`, location.city].filter(Boolean).join(', ')}.${location.description ? ` ${clip(location.description)}` : ''}${clip(location.style_guide) ? ` Style guide: ${clip(location.style_guide)}` : ''}` : '',
    c?.de_money_origin_class || c?.de_money_current_class ? `CLASS: grew up ${classWord(c.de_money_origin_class) || 'unknown'}; now ${classWord(c.de_money_current_class) || 'unknown'}${c.de_class_gap_direction ? ` (moving ${c.de_class_gap_direction})` : ''}. Show it in what they kept, what they bought new, and what they still cannot let go of.` : '',
    clip(c?.aesthetic_dna) ? `THEIR STYLE: ${clip(c.aesthetic_dna)}` : '',
    clip(c?.living_context) ? `THEIR LIFE NOW: ${clip(c.living_context)}` : '',
    read.gap ? `THE GAP (draw both, it is the point of the place): what they show the world is "${read.gap.claim || 'a lifestyle beyond their real one'}"; what is true is "${read.gap.reality || 'not what they show'}" (gap: ${words(read.gap.kind)}). Describe the one corner they film in, staged to look like what they show, and the rest of the ${what} as it really is. Name the corner so its angle can be found.${read.gap.kind === 'reversed' ? ' Here it is reversed: the filmed corner is plainer than the rest of the place.' : ''}` : '',
    place.canonical_description ? `THE DESCRIPTION IT HAS NOW (keep what agrees with the profile; change what does not): ${clip(place.canonical_description, 1200)}` : '',
    `Write 4 to 6 sentences: the room's size and shape; wall colours and flooring; key furniture with materials and where it stands; light and its sources; the signature things that make it theirs; the view from the windows; who else lives here, if the profile says so. Stay inside their price range and class: nothing costs more or less than the profile allows. Use only what the profile gives; where it gives nothing, keep it plain rather than invent a detail about them. Return only the description, no labels or formatting.`,
  ];
  return parts.filter(Boolean).join('\n\n');
}

async function describePlace(db, { characterId, sceneSetId, client: injected = null }) {
  if (!injected && !process.env.ANTHROPIC_API_KEY) throw new PlaceDescriptionError(503, 'ANTHROPIC_API_KEY not configured', 'AI_UNAVAILABLE');
  const ctx = await gather(db, { characterId, sceneSetId });
  const read = readings(ctx);
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

module.exports = { describePlace, gapOf, PlaceDescriptionError, _buildPrompt: buildPrompt, _readings: readings };
