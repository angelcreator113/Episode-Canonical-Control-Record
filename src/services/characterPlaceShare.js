'use strict';

/**
 * A character's places on their own page, and sharing one on The Pulse.
 *
 * Evoni, 2026-10-15: "a character's home venue scene set which is their
 * everyday scene set which can be shared on the pulse". The places are the
 * character homes of #3228 (characterPlacesService: home, closet, other;
 * the show's lead keeps hers in the show's scene defaults). Here they are
 * read for one character, with each set's picture, and one can be posted:
 * a DRAFT post on The Pulse from the character's feed profile, with the
 * picture and the set's venue tagged, to finish and publish on The Pulse.
 *
 * The picture is the venue's everyday look when that look is this set
 * (world_locations.approved_base_*), else the set's base still.
 */

const { listPlaces, CharacterPlacesError } = require('./characterPlacesService');

const CAPTION_MAX = 2000;

class PlaceShareError extends Error {
  constructor(message, status = 400, code = 'PLACE_SHARE_INVALID') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/** The character and the show their registry belongs to (null when none). */
async function characterAndShow(sequelize, characterId) {
  const [[row]] = await sequelize.query(
    `SELECT rc.id, rc.display_name, rc.selected_name, rc.feed_profile_id, cr.show_id
       FROM registry_characters rc
       LEFT JOIN character_registries cr ON cr.id = rc.registry_id
      WHERE rc.id = :id AND rc.deleted_at IS NULL`,
    { replacements: { id: characterId } });
  return row || null;
}

/** Each set's picture and venue: the everyday look when it is this set, else its base still. */
async function setPictures(sequelize, setIds) {
  if (!setIds.length) return new Map();
  const [rows] = await sequelize.query(
    `SELECT s.id, s.base_still_url, s.world_location_id,
            CASE WHEN wl.approved_base_scene_set_id = s.id THEN wl.approved_base_image_url END AS everyday_url
       FROM scene_sets s
       LEFT JOIN world_locations wl ON wl.id = s.world_location_id AND wl.deleted_at IS NULL
      WHERE s.id IN (:ids)`,
    { replacements: { ids: setIds } });
  return new Map(rows.map((r) => [String(r.id), {
    image_url: r.everyday_url || r.base_still_url || null,
    everyday: !!r.everyday_url,
    world_location_id: r.world_location_id || null,
  }]));
}

/**
 * The character's places with their pictures. A character in no show's
 * registry has none (show_id null): places belong to a show.
 */
async function placesForCharacter(sequelize, characterId) {
  const character = await characterAndShow(sequelize, characterId);
  if (!character) throw new PlaceShareError('Character not found', 404, 'CHARACTER_NOT_FOUND');
  if (!character.show_id) return { show_id: null, is_lead: false, places: [] };
  const { characters } = await listPlaces(sequelize, character.show_id);
  const mine = characters.find((c) => String(c.id) === String(characterId));
  const places = mine?.places || [];
  const pictures = await setPictures(sequelize, places.map((p) => p.scene_set_id));
  // The venue's own photo (2026-10-17), from each set's World Location.
  const venuePhotos = await require('./venuePhotoService').venuePhotosFor(sequelize, [...pictures.values()].map((p) => p.world_location_id));
  return {
    show_id: character.show_id,
    is_lead: !!mine?.is_lead,
    places: places.map((p) => {
      const picture = pictures.get(String(p.scene_set_id)) || { image_url: null, everyday: false, world_location_id: null };
      return { ...p, ...picture, venue_photo_url: (picture.world_location_id && venuePhotos.get(String(picture.world_location_id))) || null };
    }),
  };
}

/**
 * Posts one of the character's places on The Pulse, as a draft from their
 * feed profile. Refused when they have no feed profile, the set is not one
 * of their places, or it has no picture yet.
 */
async function sharePlace(models, { characterId, sceneSetId, caption }) {
  const { sequelize } = models;
  const character = await characterAndShow(sequelize, characterId);
  if (!character) throw new PlaceShareError('Character not found', 404, 'CHARACTER_NOT_FOUND');
  if (!character.feed_profile_id) {
    throw new PlaceShareError('They need a feed profile to post on The Pulse. Match them to a feed person on The cast.', 409, 'NO_FEED_PROFILE');
  }
  const { show_id: showId, places } = await placesForCharacter(sequelize, characterId);
  const place = places.find((p) => String(p.scene_set_id) === String(sceneSetId));
  if (!place) throw new PlaceShareError('That set is not one of their places', 404, 'PLACE_NOT_FOUND');
  if (!place.image_url) throw new PlaceShareError(`"${place.scene_set_name}" has no picture yet. Upload or generate its base first.`, 409, 'NO_PICTURE');

  const profile = await models.SocialProfile.findByPk(character.feed_profile_id, { attributes: ['id', 'handle', 'display_name'] });
  if (!profile) throw new PlaceShareError('Their feed profile was not found', 404, 'NO_FEED_PROFILE');

  const text = typeof caption === 'string' && caption.trim() ? caption.trim().slice(0, CAPTION_MAX) : `${place.role === 'home' ? 'home' : place.scene_set_name}.`;
  const alt = `${character.selected_name || character.display_name}'s ${place.role === 'other' ? (place.label || place.scene_set_name) : place.role}`;
  let placeValues = {};
  if (place.world_location_id) {
    const resolved = await require('../utils/feedPlaces').resolvePlace(models, { place_location_id: place.world_location_id });
    if (!resolved.error) placeValues = resolved.values;
  }
  const post = await models.FeedPost.create({
    show_id: showId,
    social_profile_id: profile.id,
    poster_handle: String(profile.handle || '').replace(/^@/, ''),
    poster_display_name: profile.display_name || null,
    poster_platform: 'lalaverse',
    post_type: 'post',
    content_text: text,
    image_url: place.image_url,
    image_description: alt,
    photos: [{ url: place.image_url, alt }],
    ...placeValues,
    likes: 0, comments_count: 0, shares: 0, sample_comments: [],
    posted_at: null,
    story_order: await require('./storyClock').presentOrder(models, showId),
    ai_generated: false,
    status: 'draft',
    sort_order: 0,
  });
  return { post, place };
}

module.exports = { PlaceShareError, CharacterPlacesError, placesForCharacter, sharePlace };
