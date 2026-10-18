'use strict';

/**
 * The Gallery tab (Evoni, 2026-10-18: "we need a separate tab for the
 * gallery now this tab will get over crowded"): every picture already
 * linked to a character, in one place, grouped. Reads only: no AI call, no
 * new table, nothing saved.
 *
 *   galleryFor(db, characterId) → { groups: [{ key, label, items }] }
 *     item: { id, url, caption, source }
 *
 *   portraits  registry_characters.portrait_url (their photo), cover_url,
 *              and appearance.portraits (made on the Appearance tab)
 *   places     their places' pictures (services/characterPlaceShare: the
 *              set's everyday or base still, and the venue's own photo)
 *   wardrobe   wardrobe items whose character is their name or key (the
 *              wardrobe names its wearer by text, not by registry id)
 *   events     for the events they host or are a guest of
 *              (services/characterEvents): the invitation (assets) and the
 *              event's scene set still
 *   posts      their feed profile's posts with photos (feed_posts.photos,
 *              else image_url), drafts included and marked
 *
 * A character with no feed profile has no events or posts yet.
 */

const PER_GROUP = 60;

class GalleryError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const clip = (text, n = 120) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
};

const ROLE_WORDS = { home: 'Home', closet: 'Closet', work: 'Work', other: 'Place' };

function portraitsOf(character) {
  const items = [];
  const seen = new Set();
  const add = (url, caption, source) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    items.push({ id: `portrait:${items.length}`, url, caption, source });
  };
  add(character.portrait_url, 'Their profile photo', 'profile_photo');
  add(character.cover_url, 'Their cover photo', 'cover_photo');
  const appearance = character.appearance && typeof character.appearance === 'object' ? character.appearance : {};
  for (const p of Array.isArray(appearance.portraits) ? appearance.portraits : []) {
    add(p && p.url, 'A portrait from their look', 'portrait');
  }
  return items;
}

async function placesOf(sequelize, characterId) {
  const { placesForCharacter } = require('./characterPlaceShare');
  const { places } = await placesForCharacter(sequelize, characterId);
  const items = [];
  for (const p of places) {
    const label = p.label || ROLE_WORDS[p.role] || 'Place';
    const name = p.scene_set_name ? `${label}: ${p.scene_set_name}` : label;
    if (p.image_url) items.push({ id: `place:${p.scene_set_id}`, url: p.image_url, caption: name, source: 'scene_set' });
    if (p.venue_photo_url && p.venue_photo_url !== p.image_url) {
      items.push({ id: `venue:${p.scene_set_id}`, url: p.venue_photo_url, caption: `${name} (the venue)`, source: 'venue' });
    }
  }
  return items;
}

async function wardrobeOf(sequelize, character) {
  const names = [...new Set([character.character_key, character.display_name, character.selected_name]
    .filter(Boolean).map((n) => String(n).trim().toLowerCase()).filter(Boolean))];
  if (!names.length) return [];
  const [rows] = await sequelize.query(
    `SELECT id, name, COALESCE(s3_url_processed, s3_url, thumbnail_url) AS url
       FROM wardrobe
      WHERE deleted_at IS NULL AND LOWER(TRIM(character)) IN (:names)
        AND COALESCE(s3_url_processed, s3_url, thumbnail_url) IS NOT NULL
      ORDER BY created_at DESC
      LIMIT ${PER_GROUP}`,
    { replacements: { names } });
  return rows.map((r) => ({ id: `wardrobe:${r.id}`, url: r.url, caption: r.name || 'A wardrobe piece', source: 'wardrobe' }));
}

async function eventsOf(sequelize, profileId) {
  if (profileId == null) return [];
  const { eventsForProfile } = require('./characterEvents');
  const events = await eventsForProfile(sequelize, profileId);
  if (!events.length) return [];
  const [rows] = await sequelize.query(
    `SELECT we.id, COALESCE(a.s3_url_processed, a.s3_url_raw) AS invitation_url, ss.base_still_url AS set_url
       FROM world_events we
       LEFT JOIN assets a ON a.id = we.invitation_asset_id AND a.deleted_at IS NULL
       LEFT JOIN scene_sets ss ON ss.id = we.scene_set_id AND ss.deleted_at IS NULL
      WHERE we.id IN (:ids)`,
    { replacements: { ids: events.map((e) => e.id) } });
  const byId = new Map(rows.map((r) => [String(r.id), r]));
  const items = [];
  for (const ev of events) {
    const r = byId.get(String(ev.id));
    if (!r) continue;
    const who = ev.role === 'host' ? 'They host' : 'A guest at';
    if (r.invitation_url) items.push({ id: `invite:${ev.id}`, url: r.invitation_url, caption: `${ev.name}: the invitation`, source: 'invitation' });
    if (r.set_url) items.push({ id: `event:${ev.id}`, url: r.set_url, caption: `${who} ${ev.name}`, source: 'event_set' });
  }
  return items.slice(0, PER_GROUP);
}

async function postsOf(sequelize, profileId) {
  if (profileId == null) return [];
  const [rows] = await sequelize.query(
    `SELECT id, content_text, image_url, photos, status
       FROM feed_posts
      WHERE social_profile_id = :pid AND deleted_at IS NULL
        AND (image_url IS NOT NULL OR (jsonb_typeof(photos) = 'array' AND jsonb_array_length(photos) > 0))
      ORDER BY posted_at DESC NULLS LAST, created_at DESC
      LIMIT ${PER_GROUP}`,
    { replacements: { pid: profileId } });
  const items = [];
  for (const r of rows) {
    const photos = Array.isArray(r.photos) ? r.photos.filter((p) => p && p.url) : [];
    const urls = photos.length ? photos.map((p) => p.url) : [r.image_url];
    const caption = `${r.status === 'draft' ? 'Draft: ' : ''}${clip(r.content_text) || 'A post'}`;
    urls.forEach((url, i) => items.push({ id: `post:${r.id}:${i}`, url, caption, source: r.status === 'draft' ? 'draft_post' : 'post' }));
  }
  return items.slice(0, PER_GROUP);
}

async function galleryFor(db, characterId) {
  const { sequelize } = db;
  const character = await db.RegistryCharacter.findByPk(characterId, {
    attributes: ['id', 'character_key', 'display_name', 'selected_name', 'portrait_url', 'cover_url', 'appearance', 'feed_profile_id'],
  });
  if (!character) throw new GalleryError(404, 'Character not found');
  const profileId = character.feed_profile_id;
  const [places, wardrobe, events, posts] = await Promise.all([
    placesOf(sequelize, character.id),
    wardrobeOf(sequelize, character),
    eventsOf(sequelize, profileId),
    postsOf(sequelize, profileId),
  ]);
  return {
    linked: profileId != null,
    groups: [
      { key: 'portraits', label: 'Portraits', items: portraitsOf(character) },
      { key: 'places', label: 'Places', items: places },
      { key: 'wardrobe', label: 'Wardrobe', items: wardrobe },
      { key: 'events', label: 'Events', items: events },
      { key: 'posts', label: 'Posts', items: posts },
    ],
  };
}

module.exports = { galleryFor, GalleryError, PER_GROUP };
