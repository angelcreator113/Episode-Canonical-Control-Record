'use strict';

/**
 * Visual Memory, phase 1 (Evoni's "Character Visual Memory System",
 * 2026-10-18): one shared library of pictures, each stored once and tagged
 * with every character, place, event, brand and post it is of or belongs to
 * (migration 20261019120000-media-library: media_assets, media_asset_links).
 * "The gallery remembers how LalaWorld looks; the story systems determine
 * what actually happened": nothing here writes canon, attendance, events or
 * anything outside the two media tables.
 *
 *   visibilityWhere(audience, alias)  the SQL filter for who is reading:
 *                       admin   every live picture
 *                       member  approved, and internal or public
 *                       public  approved and public only (feeds, The Pulse)
 *   createAsset(db, { url, ..., links, by })   one row per URL: an existing
 *                       live picture is reused and only gains the new links
 *   updateAsset(db, id, fields)     caption, status, visibility, usage_rights,
 *                                   details
 *   linkAsset / unlinkLink           tag and untag (soft)
 *   removeAsset(db, id)              soft delete with its links
 *   getAsset / listFor(db, { entityType, entityId, audience })
 *   assetsByUrl(db, urls)            the library rows for pictures shown
 *                                    elsewhere (the gallery's Edit tags)
 *   taggables(db, q)                 characters, places, events and brands
 *                                    to tag, by name
 *   bringExisting(db, { by })        carries portraits, cover photos,
 *                                    scene stills, invitations, event sets
 *                                    and post pictures into the library,
 *                                    tagged with what they belong to now;
 *                                    the same URL is never stored twice
 */

const { notConfidentialSql } = require('../utils/confidentialCharacters');

const STATUSES = Object.freeze(['draft', 'approved', 'archived']);
const VISIBILITIES = Object.freeze(['private', 'internal', 'public']);
const ROLES = Object.freeze(['pictured', 'owner', 'location']);
const SOURCES = Object.freeze(['upload', 'generated', 'portrait', 'cover', 'scene_set', 'venue', 'invitation', 'event_set', 'post']);
const DETAIL_KEYS = Object.freeze(['objects', 'wardrobe', 'style', 'season', 'time_of_day', 'camera_angle', 'notes']);

// What a picture can be tagged with, and the table each id lives in.
const ENTITIES = Object.freeze({
  character: { table: 'registry_characters', id: 'uuid', label: "COALESCE(selected_name, display_name)" },
  scene_set: { table: 'scene_sets', id: 'uuid', label: 'name' },
  event: { table: 'world_events', id: 'uuid', label: 'name' },
  brand: { table: 'lalaverse_brands', id: 'uuid', label: 'name' },
  post: { table: 'feed_posts', id: 'uuid', label: "LEFT(content_text, 80)" },
  episode: { table: 'episodes', id: 'uuid', label: 'title' },
  deal: { table: 'opportunities', id: 'uuid', label: 'name' },
  wardrobe: { table: 'wardrobe', id: 'uuid', label: 'name' },
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class MediaError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function visibilityWhere(audience, alias = 'ma') {
  const a = alias ? `${alias}.` : '';
  if (audience === 'admin') return `${a}deleted_at IS NULL`;
  if (audience === 'member') return `${a}deleted_at IS NULL AND ${a}status = 'approved' AND ${a}visibility IN ('internal', 'public')`;
  return `${a}deleted_at IS NULL AND ${a}status = 'approved' AND ${a}visibility = 'public'`;
}

/** The audience a request reads as: an ADMIN sees everything; anyone else signed in, what is approved and not private. */
function audienceOf(user) {
  const groups = (user && user.groups) || [];
  return groups.some((g) => String(g).toLowerCase() === 'admin') ? 'admin' : 'member';
}

const clean = (v, n) => {
  const t = v == null ? '' : String(v).replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, n) : null;
};

/** A link as given, checked: a known kind, a well-formed id, a known role. */
function normalizeLink(link) {
  const type = String(link?.entity_type || '').trim();
  if (!ENTITIES[type]) throw new MediaError(400, `entity_type must be one of ${Object.keys(ENTITIES).join(', ')}.`);
  const id = String(link?.entity_id ?? '').trim();
  if (ENTITIES[type].id === 'uuid' ? !UUID_RE.test(id) : !/^\d+$/.test(id)) throw new MediaError(400, `entity_id is not a ${type} id.`);
  const role = link?.role == null ? 'pictured' : String(link.role);
  if (!ROLES.includes(role)) throw new MediaError(400, `role must be one of ${ROLES.join(', ')}.`);
  return { entity_type: type, entity_id: id, role };
}

/** Only the known detail keys, as short text or lists of short text. */
function normalizeDetails(raw) {
  if (raw == null) return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) throw new MediaError(400, 'details must be an object.');
  const out = {};
  for (const k of DETAIL_KEYS) {
    if (raw[k] == null || raw[k] === '') continue;
    out[k] = Array.isArray(raw[k]) ? raw[k].map((x) => clean(x, 120)).filter(Boolean).slice(0, 30) : clean(raw[k], 500);
  }
  return out;
}

function checkUrl(url) {
  const u = String(url || '').trim();
  if (!u) throw new MediaError(400, 'A picture needs a url.');
  if (!/^(https?:\/\/|\/|data:image\/(png|jpeg|webp);base64,)/i.test(u)) throw new MediaError(400, 'url must be an http(s) address, a site path or an image data URL.');
  return u;
}

async function entityExists(db, { entity_type: type, entity_id: id }) {
  const { table } = ENTITIES[type];
  const [rows] = await db.sequelize.query(`SELECT 1 AS x FROM ${table} WHERE id::text = :id AND deleted_at IS NULL LIMIT 1`, { replacements: { id } });
  return rows.length > 0;
}

async function linkAsset(db, assetId, link, { by = null } = {}) {
  const l = normalizeLink(link);
  if (!(await entityExists(db, l))) throw new MediaError(404, `That ${l.entity_type} was not found.`);
  const [rows] = await db.sequelize.query(
    `INSERT INTO media_asset_links (asset_id, entity_type, entity_id, role, created_by)
     SELECT :assetId, :type, :id, :role, :by WHERE EXISTS (SELECT 1 FROM media_assets WHERE id = :assetId AND deleted_at IS NULL)
     ON CONFLICT (asset_id, entity_type, entity_id) WHERE deleted_at IS NULL DO NOTHING RETURNING id`,
    { replacements: { assetId, type: l.entity_type, id: l.entity_id, role: l.role, by } });
  return { added: rows.length > 0 };
}

async function unlinkLink(db, assetId, linkId) {
  if (!UUID_RE.test(String(linkId))) throw new MediaError(404, 'That tag was not found.');
  const [, meta] = await db.sequelize.query(
    'UPDATE media_asset_links SET deleted_at = NOW(), updated_at = NOW() WHERE id = :linkId AND asset_id = :assetId AND deleted_at IS NULL',
    { replacements: { assetId, linkId } });
  if (!(meta?.rowCount)) throw new MediaError(404, 'That tag was not found.');
  return { removed: true };
}

async function getAsset(db, id, { audience = 'admin' } = {}) {
  if (!UUID_RE.test(String(id))) throw new MediaError(404, 'Picture not found.');
  const [[asset]] = await db.sequelize.query(`SELECT ma.* FROM media_assets ma WHERE ma.id = :id AND ${visibilityWhere(audience)}`, { replacements: { id } });
  if (!asset) throw new MediaError(404, 'Picture not found.');
  return { ...asset, links: await linksOf(db, [asset.id]).then((m) => m.get(asset.id) || []) };
}

/** Each asset's live links with the name of what they point at. */
async function linksOf(db, assetIds) {
  const out = new Map();
  if (!assetIds.length) return out;
  const [links] = await db.sequelize.query(
    `SELECT id, asset_id, entity_type, entity_id, role FROM media_asset_links
      WHERE asset_id IN (:ids) AND deleted_at IS NULL ORDER BY created_at ASC`, { replacements: { ids: assetIds } });
  const byType = new Map();
  for (const l of links) byType.set(l.entity_type, [...(byType.get(l.entity_type) || []), l.entity_id]);
  const names = new Map();
  for (const [type, ids] of byType) {
    const e = ENTITIES[type];
    if (!e) continue;
    const [rows] = await db.sequelize.query(`SELECT id::text AS id, ${e.label} AS name FROM ${e.table} WHERE id::text IN (:ids)`, { replacements: { ids } });
    for (const r of rows) names.set(`${type}:${r.id}`, r.name);
  }
  for (const l of links) {
    out.set(l.asset_id, [...(out.get(l.asset_id) || []), { ...l, name: names.get(`${l.entity_type}:${l.entity_id}`) || null }]);
  }
  return out;
}

async function createAsset(db, {
  url, thumbnailUrl = null, storageKey = null, width = null, height = null, caption = null, source = 'upload',
  status = 'approved', visibility = 'internal', usageRights = null, details = null, generation = null, links = [], by = null,
}) {
  const u = checkUrl(url);
  if (!SOURCES.includes(source)) throw new MediaError(400, `source must be one of ${SOURCES.join(', ')}.`);
  if (!STATUSES.includes(status)) throw new MediaError(400, `status must be one of ${STATUSES.join(', ')}.`);
  if (!VISIBILITIES.includes(visibility)) throw new MediaError(400, `visibility must be one of ${VISIBILITIES.join(', ')}.`);
  const normalized = (Array.isArray(links) ? links : []).map(normalizeLink);
  for (const l of normalized) if (!(await entityExists(db, l))) throw new MediaError(404, `That ${l.entity_type} was not found.`);
  const [inserted] = await db.sequelize.query(
    `INSERT INTO media_assets (url, thumbnail_url, storage_key, width, height, caption, source, status, visibility, usage_rights, details, generation, created_by)
     VALUES (:url, :thumb, :key, :width, :height, :caption, :source, :status, :visibility, :rights, CAST(:details AS JSONB), CAST(:generation AS JSONB), :by)
     ON CONFLICT ((md5(url))) WHERE deleted_at IS NULL DO NOTHING RETURNING id`,
    {
      replacements: {
        url: u, thumb: thumbnailUrl, key: storageKey, width, height, caption: clean(caption, 500), source, status, visibility,
        rights: clean(usageRights, 500), details: JSON.stringify(normalizeDetails(details)), generation: generation ? JSON.stringify(generation) : null, by,
      },
    });
  let id = inserted[0]?.id;
  const reused = !id;
  if (!id) {
    const [[existing]] = await db.sequelize.query('SELECT id FROM media_assets WHERE md5(url) = md5(:url) AND deleted_at IS NULL', { replacements: { url: u } });
    id = existing.id;
  }
  for (const l of normalized) await linkAsset(db, id, l, { by });
  return { asset: await getAsset(db, id), reused };
}

async function updateAsset(db, id, fields = {}) {
  await getAsset(db, id);
  const sets = [];
  const r = { id };
  if ('caption' in fields) { sets.push('caption = :caption'); r.caption = clean(fields.caption, 500); }
  if ('status' in fields) {
    if (!STATUSES.includes(fields.status)) throw new MediaError(400, `status must be one of ${STATUSES.join(', ')}.`);
    sets.push('status = :status'); r.status = fields.status;
  }
  if ('visibility' in fields) {
    if (!VISIBILITIES.includes(fields.visibility)) throw new MediaError(400, `visibility must be one of ${VISIBILITIES.join(', ')}.`);
    sets.push('visibility = :visibility'); r.visibility = fields.visibility;
  }
  if ('usage_rights' in fields) { sets.push('usage_rights = :rights'); r.rights = clean(fields.usage_rights, 500); }
  if ('details' in fields) { sets.push('details = CAST(:details AS JSONB)'); r.details = JSON.stringify(normalizeDetails(fields.details)); }
  if (!sets.length) throw new MediaError(400, 'Nothing to change.');
  await db.sequelize.query(`UPDATE media_assets SET ${sets.join(', ')}, updated_at = NOW() WHERE id = :id`, { replacements: r });
  return getAsset(db, id);
}

async function removeAsset(db, id) {
  await getAsset(db, id);
  await db.sequelize.query('UPDATE media_asset_links SET deleted_at = NOW(), updated_at = NOW() WHERE asset_id = :id AND deleted_at IS NULL', { replacements: { id } });
  await db.sequelize.query('UPDATE media_assets SET deleted_at = NOW(), updated_at = NOW() WHERE id = :id', { replacements: { id } });
  return { removed: true };
}

async function listFor(db, { entityType, entityId, audience = 'member', limit = 200 }) {
  const { entity_type: type, entity_id: eid } = normalizeLink({ entity_type: entityType, entity_id: entityId });
  const [rows] = await db.sequelize.query(
    `SELECT ma.*, l.role AS link_role FROM media_asset_links l JOIN media_assets ma ON ma.id = l.asset_id
      WHERE l.entity_type = :type AND l.entity_id = :eid AND l.deleted_at IS NULL AND ${visibilityWhere(audience)}
      ORDER BY ma.created_at DESC LIMIT ${Math.min(Number(limit) || 200, 500)}`, { replacements: { type, eid } });
  const links = await linksOf(db, rows.map((a) => a.id));
  return rows.map((a) => ({ ...a, links: links.get(a.id) || [] }));
}

/** The library rows (with their tags) for pictures shown by URL elsewhere, keyed by URL. */
async function assetsByUrl(db, urls, { audience = 'admin' } = {}) {
  const list = [...new Set((urls || []).filter(Boolean))];
  if (!list.length) return new Map();
  const [rows] = await db.sequelize.query(
    `SELECT ma.* FROM media_assets ma WHERE md5(ma.url) IN (SELECT md5(u) FROM unnest(ARRAY[:urls]::text[]) AS u) AND ${visibilityWhere(audience)}`,
    { replacements: { urls: list } });
  const links = await linksOf(db, rows.map((a) => a.id));
  return new Map(rows.map((a) => [a.url, { ...a, links: links.get(a.id) || [] }]));
}

/** Characters (Dr. Sinclair kept out), places, events and brands whose name matches, for the tag picker. */
async function taggables(db, q) {
  const term = `%${String(q || '').trim().slice(0, 60)}%`;
  const [rows] = await db.sequelize.query(
    `(SELECT 'character' AS entity_type, rc.id::text AS entity_id, COALESCE(rc.selected_name, rc.display_name) AS name
        FROM registry_characters rc
       WHERE rc.deleted_at IS NULL AND COALESCE(rc.selected_name, rc.display_name) ILIKE :term AND ${notConfidentialSql('rc')}
       ORDER BY 3 LIMIT 10)
     UNION ALL
     (SELECT 'scene_set', id::text, name FROM scene_sets WHERE deleted_at IS NULL AND name ILIKE :term ORDER BY 3 LIMIT 10)
     UNION ALL
     (SELECT 'event', id::text, name FROM world_events WHERE deleted_at IS NULL AND name ILIKE :term ORDER BY 3 LIMIT 10)
     UNION ALL
     (SELECT 'brand', id::text, name FROM lalaverse_brands WHERE deleted_at IS NULL AND name ILIKE :term ORDER BY 3 LIMIT 10)`,
    { replacements: { term } });
  return rows;
}

/**
 * "Bring existing pictures into the library": idempotent, set-based. Each
 * picture is stored once (the unique md5(url) among live rows) and tagged
 * with what it belongs to now. Post pictures keep their post's standing: a
 * live post's picture is approved and public, a draft's is a private draft.
 * Returns how many pictures and tags were added.
 */
async function bringExisting(db, { by = null } = {}) {
  const { sequelize } = db;
  const run = async (sql, label) => {
    const [, meta] = await sequelize.query(sql, { replacements: { by } });
    return { label, count: meta?.rowCount || 0 };
  };
  const notDr = notConfidentialSql('rc');
  const insertAssets = (select) => `INSERT INTO media_assets (url, caption, source, source_ref, status, visibility, created_by)
    SELECT DISTINCT ON (md5(url)) url, caption, source, source_ref, status, visibility, :by FROM (${select}) s
     WHERE url IS NOT NULL AND url <> ''
    ON CONFLICT ((md5(url))) WHERE deleted_at IS NULL DO NOTHING`;
  const insertLinks = (select) => `INSERT INTO media_asset_links (asset_id, entity_type, entity_id, role, created_by)
    SELECT DISTINCT ON (ma.id, s.entity_type, s.entity_id) ma.id, s.entity_type, s.entity_id, s.role, :by
      FROM (${select}) s JOIN media_assets ma ON md5(ma.url) = md5(s.url) AND ma.deleted_at IS NULL
     WHERE s.url IS NOT NULL AND s.url <> ''
    ON CONFLICT (asset_id, entity_type, entity_id) WHERE deleted_at IS NULL DO NOTHING`;

  const portraits = `
    SELECT rc.id::text AS entity_id, rc.portrait_url AS url, 'Their profile photo' AS caption, 'portrait' AS source,
           'registry_characters:' || rc.id || ':portrait_url' AS source_ref
      FROM registry_characters rc WHERE rc.deleted_at IS NULL AND ${notDr}
    UNION ALL
    SELECT rc.id::text, rc.cover_url, 'Their cover photo', 'cover', 'registry_characters:' || rc.id || ':cover_url'
      FROM registry_characters rc WHERE rc.deleted_at IS NULL AND ${notDr}
    UNION ALL
    SELECT rc.id::text, p->>'url', 'A portrait from their look', 'portrait', 'registry_characters:' || rc.id || ':appearance.portraits'
      FROM registry_characters rc, jsonb_array_elements(CASE WHEN jsonb_typeof(rc.appearance->'portraits') = 'array' THEN rc.appearance->'portraits' ELSE '[]'::jsonb END) p
     WHERE rc.deleted_at IS NULL AND ${notDr}`;
  const sceneStills = `
    SELECT s.id::text AS entity_id, s.base_still_url AS url, s.name AS caption, 'scene_set' AS source, 'scene_sets:' || s.id || ':base_still_url' AS source_ref
      FROM scene_sets s WHERE s.deleted_at IS NULL
    UNION ALL
    SELECT s.id::text, wl.approved_base_image_url, s.name, 'scene_set', 'world_locations:' || wl.id || ':approved_base_image_url'
      FROM world_locations wl JOIN scene_sets s ON s.id = wl.approved_base_scene_set_id AND s.deleted_at IS NULL
     WHERE wl.deleted_at IS NULL
    UNION ALL
    -- The venue's own photo (world_locations.venue_photo_url; Evoni, 2026-10-19:
    -- bring venue photos in too), for each set at that venue.
    SELECT s.id::text, wl.venue_photo_url, s.name || ' (the venue)', 'venue', 'world_locations:' || wl.id || ':venue_photo_url'
      FROM scene_sets s JOIN world_locations wl ON wl.id = s.world_location_id AND wl.deleted_at IS NULL
     WHERE s.deleted_at IS NULL`;
  const events = `
    SELECT we.id::text AS entity_id, COALESCE(a.s3_url_processed, a.s3_url_raw) AS url, we.name || ': the invitation' AS caption,
           'invitation' AS source, 'assets:' || a.id AS source_ref
      FROM world_events we JOIN assets a ON a.id = we.invitation_asset_id AND a.deleted_at IS NULL WHERE we.deleted_at IS NULL
    UNION ALL
    SELECT we.id::text, ss.base_still_url, we.name, 'event_set', 'world_events:' || we.id || ':scene_set'
      FROM world_events we JOIN scene_sets ss ON ss.id = we.scene_set_id AND ss.deleted_at IS NULL WHERE we.deleted_at IS NULL`;
  const posts = `
    SELECT fp.id::text AS entity_id, fp.social_profile_id, ph->>'url' AS url, LEFT(fp.content_text, 200) AS caption, 'post' AS source,
           'feed_posts:' || fp.id AS source_ref,
           CASE WHEN fp.status = 'live' THEN 'approved' ELSE 'draft' END AS status,
           CASE WHEN fp.status = 'live' THEN 'public' ELSE 'private' END AS visibility
      FROM feed_posts fp, jsonb_array_elements(CASE WHEN jsonb_typeof(fp.photos) = 'array' THEN fp.photos ELSE '[]'::jsonb END) ph
     WHERE fp.deleted_at IS NULL
    UNION ALL
    SELECT fp.id::text, fp.social_profile_id, fp.image_url, LEFT(fp.content_text, 200), 'post', 'feed_posts:' || fp.id,
           CASE WHEN fp.status = 'live' THEN 'approved' ELSE 'draft' END,
           CASE WHEN fp.status = 'live' THEN 'public' ELSE 'private' END
      FROM feed_posts fp
     WHERE fp.deleted_at IS NULL AND fp.image_url IS NOT NULL
       AND NOT COALESCE(jsonb_typeof(fp.photos) = 'array' AND jsonb_array_length(fp.photos) > 0, false)`;
  const asAsset = (select, { status = "'approved'", visibility = "'internal'" } = {}) =>
    `SELECT url, caption, source, source_ref, ${status} AS status, ${visibility} AS visibility FROM (${select}) x`;

  const done = [];
  done.push(await run(insertAssets(asAsset(portraits)), 'portraits'));
  done.push(await run(insertAssets(asAsset(sceneStills)), 'scene stills'));
  done.push(await run(insertAssets(asAsset(events)), 'event pictures'));
  done.push(await run(insertAssets(`SELECT url, caption, source, source_ref, status, visibility FROM (${posts}) x`), 'post pictures'));

  const tags = [];
  tags.push(await run(insertLinks(`SELECT url, 'character' AS entity_type, entity_id, 'pictured' AS role FROM (${portraits}) x`), 'characters in portraits'));
  tags.push(await run(insertLinks(`SELECT url, 'scene_set' AS entity_type, entity_id, 'location' AS role FROM (${sceneStills}) x`), 'places'));
  // The characters whose place it is (character_places) see it too.
  tags.push(await run(insertLinks(`
    SELECT x.url, 'character' AS entity_type, cp.registry_character_id::text AS entity_id, 'location' AS role
      FROM (${sceneStills}) x JOIN character_places cp ON cp.scene_set_id::text = x.entity_id AND cp.deleted_at IS NULL
      JOIN registry_characters rc ON rc.id = cp.registry_character_id AND rc.deleted_at IS NULL AND ${notDr}`), 'characters at their places'));
  tags.push(await run(insertLinks(`SELECT url, 'event' AS entity_type, entity_id, 'pictured' AS role FROM (${events}) x`), 'events'));
  tags.push(await run(insertLinks(`SELECT url, 'post' AS entity_type, entity_id, 'owner' AS role FROM (${posts}) x`), 'posts'));
  // A post's picture also belongs to the character who posted it.
  tags.push(await run(insertLinks(`
    SELECT x.url, 'character' AS entity_type, rc.id::text AS entity_id, 'owner' AS role
      FROM (${posts}) x JOIN registry_characters rc ON rc.feed_profile_id = x.social_profile_id AND rc.deleted_at IS NULL AND ${notDr}`), 'characters who posted'));

  return {
    pictures: done.reduce((n, d) => n + d.count, 0),
    tags: tags.reduce((n, d) => n + d.count, 0),
    by_kind: [...done, ...tags],
  };
}

module.exports = {
  STATUSES, VISIBILITIES, ROLES, SOURCES, ENTITIES, DETAIL_KEYS, MediaError,
  visibilityWhere, audienceOf, normalizeLink, normalizeDetails, checkUrl,
  createAsset, updateAsset, removeAsset, linkAsset, unlinkLink, getAsset, listFor, assetsByUrl, taggables, bringExisting,
};
